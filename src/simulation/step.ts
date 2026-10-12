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
      domain: 'land',
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
      domain: 'land',
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
  next = { ...next, units: next.units.map((unit) => stepUnit(unit, next)) };
  const beforeCombat = next;
  next = clearObservedDeadMarchTargets(beforeCombat, resolveCombat(next));
  next = advanceCapture(next);
  next = applyEconomyTick(next);
  next = advanceResearch(next);
  next = advanceProduction(next);
  next = applyTicketTick(next);
  next = advanceCrossings(next);
  next = resolveMatchOutcome(next);
  return { ...next, knowledge: updateFactionKnowledge(next) };
}
