import { isCellBlocked } from './map';
import { resolveMatchOutcome } from './outcome';
import { findPath } from './pathfinding';
import { cancelProduction, enqueueProduction } from './production';
import { startResearch } from './research';
import {
  getUnitPositionX1024,
  getUnitPositionY1024,
  isCellVisibleToFaction,
  isUnitVisibleToFaction,
} from './visibility';
import { advanceMarchOrder } from './march';
import type {
  Cell,
  Command,
  CommandResult,
  FactionId,
  MatchState,
  MarchTarget,
  RejectCode,
  UnitState,
} from './types';

type UnknownRecord = Record<string, unknown>;
type ParsedCommand =
  | Command
  | {
      readonly type: 'enqueue-production';
      readonly baseId: string;
      readonly unitKind: string;
    }
  | {
      readonly type: 'march';
      readonly unitId: string;
      readonly target: MarchTarget;
    }
  | { readonly type: 'start-research'; readonly researchId: string | null };

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: UnknownRecord,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => keys.includes(key))
  );
}

function isFactionId(value: unknown): value is FactionId {
  return value === 'A' || value === 'B' || value === 'C';
}

function parseCommand(input: unknown): ParsedCommand | null {
  if (!isRecord(input) || typeof input.type !== 'string') return null;
  if (
    (input.type === 'start' ||
      input.type === 'pause' ||
      input.type === 'resume') &&
    hasExactKeys(input, ['type'])
  ) {
    return { type: input.type };
  }
  if (input.type === 'stop' && hasExactKeys(input, ['type', 'unitId'])) {
    return typeof input.unitId === 'string'
      ? { type: 'stop', unitId: input.unitId }
      : null;
  }
  if (
    input.type === 'enqueue-production' &&
    hasExactKeys(input, ['type', 'baseId', 'unitKind']) &&
    typeof input.baseId === 'string' &&
    typeof input.unitKind === 'string'
  ) {
    return {
      type: 'enqueue-production',
      baseId: input.baseId,
      unitKind: input.unitKind,
    };
  }
  if (
    input.type === 'cancel-production' &&
    hasExactKeys(input, ['type', 'jobId']) &&
    typeof input.jobId === 'string'
  ) {
    return { type: 'cancel-production', jobId: input.jobId };
  }
  if (
    input.type === 'start-research' &&
    hasExactKeys(input, ['type', 'researchId']) &&
    (typeof input.researchId === 'string' || input.researchId === null)
  ) {
    return { type: 'start-research', researchId: input.researchId };
  }
  if (
    input.type === 'move' &&
    hasExactKeys(input, ['type', 'unitId', 'target']) &&
    typeof input.unitId === 'string' &&
    isRecord(input.target) &&
    hasExactKeys(input.target, ['x', 'y']) &&
    typeof input.target.x === 'number' &&
    Number.isFinite(input.target.x) &&
    Number.isInteger(input.target.x) &&
    typeof input.target.y === 'number' &&
    Number.isFinite(input.target.y) &&
    Number.isInteger(input.target.y)
  ) {
    return {
      type: 'move',
      unitId: input.unitId,
      target: { x: input.target.x, y: input.target.y },
    };
  }
  if (
    input.type === 'march' &&
    hasExactKeys(input, ['type', 'unitId', 'target']) &&
    typeof input.unitId === 'string' &&
    isMarchTarget(input.target)
  ) {
    return {
      type: 'march',
      unitId: input.unitId,
      target: { kind: input.target.kind, id: input.target.id },
    };
  }
  return null;
}

function isMarchTarget(value: unknown): value is MarchTarget {
  return (
    isRecord(value) &&
    hasExactKeys(value, ['kind', 'id']) &&
    (value.kind === 'unit' || value.kind === 'base') &&
    typeof value.id === 'string' &&
    value.id.length > 0
  );
}

function reject(state: MatchState, reason: RejectCode): CommandResult {
  return { ok: false, state, reason };
}

function succeed(state: MatchState): CommandResult {
  return { ok: true, state };
}

function copyWithUnit(
  state: MatchState,
  oldUnit: UnitState,
  newUnit: UnitState,
): MatchState {
  return {
    ...state,
    units: state.units.map((unit) => (unit === oldUnit ? newUnit : unit)),
  };
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function isCurrentDestination(unit: UnitState, target: Cell): boolean {
  if (unit.path.length === 0)
    return unit.edgeProgress === 0 && sameCell(unit.cell, target);
  const destination = unit.path[unit.path.length - 1];
  return destination !== undefined && sameCell(destination, target);
}

export function applyCommand(
  state: MatchState,
  actor: FactionId,
  input: unknown,
): CommandResult {
  const command = parseCommand(input);
  if (command === null) return reject(state, 'INVALID_COMMAND');
  if (!isFactionId(actor)) return reject(state, 'INVALID_ACTOR');
  if (state.phase === 'finished') return reject(state, 'INVALID_PHASE');

  if (
    command.type === 'start' ||
    command.type === 'pause' ||
    command.type === 'resume'
  ) {
    if (actor !== 'A') return reject(state, 'INVALID_ACTOR');
    const validPhase =
      (command.type === 'start' && state.phase === 'ready') ||
      (command.type === 'pause' && state.phase === 'running') ||
      (command.type === 'resume' && state.phase === 'paused');
    if (!validPhase) return reject(state, 'INVALID_PHASE');
    const phase =
      command.type === 'start' || command.type === 'resume'
        ? 'running'
        : 'paused';
    const next: MatchState = { ...state, phase };
    return succeed(command.type === 'start' ? resolveMatchOutcome(next) : next);
  }

  if (state.phase !== 'running') return reject(state, 'INVALID_PHASE');
  const faction = state.factions.find(({ id }) => id === actor);
  if (
    faction === undefined ||
    faction.eliminatedAtTick !== null ||
    faction.ticketsCenti <= 0
  ) {
    return reject(state, 'FACTION_ELIMINATED');
  }
  if (command.type === 'enqueue-production') {
    return enqueueProduction(state, actor, command.baseId, command.unitKind);
  }
  if (command.type === 'cancel-production') {
    return cancelProduction(state, actor, command.jobId);
  }
  if (command.type === 'start-research') {
    return startResearch(state, actor, command.researchId);
  }
  const unit = state.units.find(({ id }) => id === command.unitId);
  if (unit === undefined) return reject(state, 'UNIT_NOT_FOUND');
  if (unit.factionId !== actor) {
    return reject(
      state,
      isUnitVisibleToFaction(state, unit, actor)
        ? 'NOT_OWNER'
        : 'UNIT_NOT_FOUND',
    );
  }

  if (command.type === 'stop') {
    const stoppedPath = unit.edgeProgress > 0 ? unit.path.slice(0, 1) : [];
    if (
      (unit.marchOrder === undefined || unit.marchOrder === null) &&
      stoppedPath.length === unit.path.length &&
      stoppedPath.every((cell, index) => cell === unit.path[index])
    ) {
      return succeed(state);
    }
    return succeed(
      copyWithUnit(state, unit, {
        ...unit,
        path: stoppedPath,
        marchOrder: null,
      }),
    );
  }

  if (command.type === 'march') {
    let lastKnownCell: Cell;
    let lastSeenTick = state.elapsedTicks;
    let initialStatus: 'tracking' | 'searching' = 'tracking';
    if (command.target.kind === 'base') {
      const base = state.bases.find(({ id }) => id === command.target.id);
      if (base === undefined) return reject(state, 'TARGET_NOT_FOUND');
      lastKnownCell = base.cell;
      if (!isCellVisibleToFaction(state, base.cell, actor)) {
        const memory = state.knowledge
          .find(({ factionId }) => factionId === actor)
          ?.baseMemory.find(({ baseId }) => baseId === base.id);
        lastSeenTick = memory?.seenTick ?? -1;
        initialStatus = 'searching';
      }
    } else {
      const target = state.units.find(({ id }) => id === command.target.id);
      if (target === undefined) return reject(state, 'TARGET_NOT_FOUND');
      if (target.factionId === actor) return reject(state, 'INVALID_TARGET');
      if (!isUnitVisibleToFaction(state, target, actor))
        return reject(state, 'TARGET_NOT_FOUND');
      lastKnownCell = {
        x: Math.floor(getUnitPositionX1024(target) / 1024),
        y: Math.floor(getUnitPositionY1024(target) / 1024),
      };
    }
    const march = advanceMarchOrder(
      state,
      unit,
      command.target,
      lastKnownCell,
      lastSeenTick,
      initialStatus,
    );
    if (march === null) return reject(state, 'UNREACHABLE');
    return succeed(copyWithUnit(state, unit, march));
  }

  const target = command.target;
  if (
    target.x < 0 ||
    target.y < 0 ||
    target.x >= state.map.width ||
    target.y >= state.map.height
  ) {
    return reject(state, 'OUT_OF_BOUNDS');
  }
  if (isCellBlocked(state.map, target)) return reject(state, 'BLOCKED');
  if (isCurrentDestination(unit, target)) {
    if (unit.marchOrder === undefined || unit.marchOrder === null)
      return succeed(state);
    return succeed(copyWithUnit(state, unit, { ...unit, marchOrder: null }));
  }

  const currentEdge = unit.edgeProgress > 0 ? unit.path[0] : undefined;
  const origin = currentEdge ?? unit.cell;
  const route = findPath(state.map, origin, target, {
    factionId: unit.factionId,
    domain: 'land',
  });
  if (route === null) return reject(state, 'UNREACHABLE');

  const path = currentEdge === undefined ? route : [currentEdge, ...route];
  return succeed(
    copyWithUnit(state, unit, {
      ...unit,
      path,
      edgeProgress: unit.edgeProgress,
      marchOrder: null,
    }),
  );
}
