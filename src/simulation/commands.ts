import { isCellBlocked } from './map';
import { findPath } from './pathfinding';
import type {
  Cell,
  Command,
  CommandResult,
  FactionId,
  MatchState,
  RejectCode,
  UnitState,
} from './types';

type UnknownRecord = Record<string, unknown>;

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

function parseCommand(input: unknown): Command | null {
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
  return null;
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
    return succeed({ ...state, phase });
  }

  if (state.phase !== 'running') return reject(state, 'INVALID_PHASE');
  const unit = state.units.find(({ id }) => id === command.unitId);
  if (unit === undefined) return reject(state, 'UNIT_NOT_FOUND');
  if (unit.factionId !== actor) return reject(state, 'NOT_OWNER');

  if (command.type === 'stop') {
    const stoppedPath = unit.edgeProgress === 1 ? unit.path.slice(0, 1) : [];
    if (
      stoppedPath.length === unit.path.length &&
      stoppedPath.every((cell, index) => cell === unit.path[index])
    ) {
      return succeed(state);
    }
    return succeed(copyWithUnit(state, unit, { ...unit, path: stoppedPath }));
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
  if (isCurrentDestination(unit, target)) return succeed(state);

  const currentEdge = unit.edgeProgress === 1 ? unit.path[0] : undefined;
  const origin = currentEdge ?? unit.cell;
  const route = findPath(state.map, origin, target);
  if (route === null) return reject(state, 'UNREACHABLE');

  const path = currentEdge === undefined ? route : [currentEdge, ...route];
  return succeed(
    copyWithUnit(state, unit, {
      ...unit,
      path,
      edgeProgress: unit.edgeProgress,
    }),
  );
}
