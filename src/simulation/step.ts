import { advanceFacilities, cleanupFacilities } from './facilities';
import { advanceCapture } from './capture';
import { resolveCombat } from './combat';
import { applyEconomyTick } from './economy';
import { resolveMatchOutcome } from './outcome';
import { advanceProduction } from './production';
import { advanceResearch } from './research';
import { applyTicketTick } from './tickets';
import { updateFactionKnowledge } from './visibility';
import { advanceMarchOrders, clearObservedDeadMarchTargets } from './march';
import {
  activeCrossings,
  advanceCrossings,
  knownActiveCrossings,
} from './crossings';
import { canTraverse } from './map';
import { findPath } from './pathfinding';
import { unitCapabilities } from './unit-capabilities';
import { advanceLocalFaction } from './local-faction';
import { advanceBaseUpgrades } from './base-upgrades';
import type { MatchState, UnitState } from './types';

export function stepUnit(unit: UnitState, state?: MatchState): UnitState {
  if (unit.path.length === 0) {
    if (
      unit.moveTarget &&
      unit.cell.x === unit.moveTarget.x &&
      unit.cell.y === unit.moveTarget.y
    )
      return { ...unit, moveTarget: null, edgeProgress: 0 };
    return unit.edgeProgress === 0 ? unit : { ...unit, edgeProgress: 0 };
  }
  if (
    state &&
    unit.edgeProgress === 0 &&
    unit.path[0] &&
    !canTraverse(state.map, unit.path[0], {
      factionId: unit.factionId,
      domain: unitCapabilities(unit.kind, state.rules).movementDomain,
      crossings: activeCrossings(state),
      unitKind: unit.kind,
    })
  )
    return unit;
  const progress = unit.edgeProgress + 1;
  if (progress < (unit.moveTicksPerCell ?? 2))
    return { ...unit, edgeProgress: progress };

  const [nextCell, ...remainingPath] = unit.path;
  if (nextCell === undefined) return { ...unit, edgeProgress: 0 };
  return {
    ...unit,
    cell: nextCell,
    path: remainingPath,
    edgeProgress: 0,
    ...(remainingPath.length === 0 &&
    unit.moveTarget &&
    nextCell.x === unit.moveTarget.x &&
    nextCell.y === unit.moveTarget.y
      ? { moveTarget: null }
      : {}),
  };
}

function recoverNearHeadquarters(
  state: MatchState,
  beforeCombat: MatchState,
): MatchState {
  if (state.elapsedTicks % 10 !== 0) return state;
  const damagedThisTick = new Set(
    beforeCombat.units.flatMap((unit) => {
      const after = state.units.find(({ id }) => id === unit.id);
      return after && after.hp < unit.hp ? [unit.id] : [];
    }),
  );
  let changed = false;
  const units = state.units.map((unit) => {
    if (
      damagedThisTick.has(unit.id) ||
      unit.hp >= unit.maxHp ||
      unit.path.length > 0
    )
      return unit;
    const hq = state.bases.find(
      (base) =>
        base.kind === 'hq' &&
        base.homeFactionId === unit.factionId &&
        base.hp > 0,
    );
    if (
      !hq ||
      Math.abs(unit.cell.x - hq.cell.x) + Math.abs(unit.cell.y - hq.cell.y) > 3
    )
      return unit;
    const hp = Math.min(
      unit.maxHp,
      unit.hp + Math.max(1, Math.ceil((unit.maxHp * 4) / 100)),
    );
    if (hp === unit.hp) return unit;
    changed = true;
    return { ...unit, hp };
  });
  return changed ? { ...state, units } : state;
}

function revalidateRoutes(state: MatchState): MatchState {
  let changed = false;
  const units = state.units.map((unit) => {
    const crossings = knownActiveCrossings(state, unit.factionId);
    const destination = unit.moveTarget ?? unit.path.at(-1);
    if (!destination) return unit;
    const edge = unit.edgeProgress > 0 ? unit.path[0] : undefined;
    const origin = edge ?? unit.cell;
    const route = findPath(state.map, origin, destination, {
      factionId: unit.factionId,
      domain: unitCapabilities(unit.kind, state.rules).movementDomain,
      crossings,
      unitKind: unit.kind,
      allowBlockedStart: true,
    });
    const nextPath =
      route === null ? (edge ? [edge] : []) : edge ? [edge, ...route] : route;
    if (
      nextPath.length === unit.path.length &&
      nextPath.every(
        (cell, index) =>
          cell.x === unit.path[index]?.x && cell.y === unit.path[index]?.y,
      )
    )
      return unit;
    changed = true;
    return { ...unit, path: nextPath };
  });
  return changed ? { ...state, units } : state;
}

function garrisonArrivals(before: MatchState, after: MatchState): MatchState {
  if (!after.rules.garrisonEnabled) return after;
  const baseCounts = new Map<string, number>();
  for (const unit of after.units)
    if (unit.garrisonedAtBaseId)
      baseCounts.set(
        unit.garrisonedAtBaseId,
        (baseCounts.get(unit.garrisonedAtBaseId) ?? 0) + 1,
      );
  let changed = false;
  const units = [...after.units]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((unit) => {
      const old = before.units.find(({ id }) => id === unit.id);
      if (
        !old ||
        old.garrisonedAtBaseId ||
        unit.path.length > 0 ||
        (unit.cell.x === old.cell.x && unit.cell.y === old.cell.y)
      )
        return unit;
      const base = after.bases.find(
        (candidate) =>
          candidate.owner === unit.factionId &&
          candidate.cell.x === unit.cell.x &&
          candidate.cell.y === unit.cell.y &&
          old.moveTarget?.x === candidate.cell.x &&
          old.moveTarget?.y === candidate.cell.y,
      );
      if (
        !base ||
        unitCapabilities(unit.kind, after.rules).movementDomain !== 'land' ||
        (baseCounts.get(base.id) ?? 0) >=
          after.rules.bases[base.kind].garrisonCapacity
      )
        return unit;
      changed = true;
      baseCounts.set(base.id, (baseCounts.get(base.id) ?? 0) + 1);
      return {
        ...unit,
        garrisonedAtBaseId: base.id,
        moveTarget: null,
        marchOrder: null,
      };
    });
  return changed ? { ...after, units } : after;
}

function releaseInvalidGarrisons(
  before: MatchState,
  after: MatchState,
): MatchState {
  let changed = false;
  const units = after.units.map((unit) => {
    if (!unit.garrisonedAtBaseId) return unit;
    const oldBase = before.bases.find(
      ({ id }) => id === unit.garrisonedAtBaseId,
    );
    const newBase = after.bases.find(
      ({ id }) => id === unit.garrisonedAtBaseId,
    );
    if (
      !newBase ||
      newBase.owner !== unit.factionId ||
      newBase.hp <= 0 ||
      (oldBase !== undefined && oldBase.owner !== newBase.owner)
    ) {
      changed = true;
      return { ...unit, garrisonedAtBaseId: null };
    }
    return unit;
  });
  return changed ? { ...after, units } : after;
}

/**
 * Advances one deterministic G3 tick: movement, simultaneous combat, capture,
 * economy and research fill, production, tickets, simultaneous eliminations,
 * then final visibility.
 */
export function stepMatch(state: MatchState): MatchState {
  if (state.phase !== 'running') return state;
  const initial = resolveMatchOutcome(state);
  if (initial.phase === 'finished') return initial;
  let next: MatchState = revalidateRoutes(advanceMarchOrders(initial));
  next = { ...next, elapsedTicks: initial.elapsedTicks + 1 };
  next = advanceLocalFaction(next);
  next = advanceFacilities(next);
  const beforeMovement = next;
  next = {
    ...next,
    units: next.units.map((unit) => stepUnit(unit, next)),
  };
  next = garrisonArrivals(beforeMovement, next);
  const beforeCombat = next;
  next = clearObservedDeadMarchTargets(beforeCombat, resolveCombat(next));
  next = recoverNearHeadquarters(next, beforeCombat);
  const beforeCapture = next;
  next = releaseInvalidGarrisons(beforeCapture, advanceCapture(next));
  next = advanceBaseUpgrades(next);
  next = applyEconomyTick(next);
  next = advanceResearch(next);
  next = advanceProduction(next);
  next = applyTicketTick(next);
  next = advanceCrossings(next);
  next = cleanupFacilities(resolveMatchOutcome(next));
  return { ...next, knowledge: updateFactionKnowledge(next) };
}
