import { advanceCapture } from './capture';
import { resolveCombat } from './combat';
import { applyEconomyTick } from './economy';
import { resolveMatchOutcome } from './outcome';
import { advanceProduction } from './production';
import { advanceResearch } from './research';
import { applyTicketTick } from './tickets';
import { updateFactionKnowledge } from './visibility';
import { advanceMarchOrders, clearObservedDeadMarchTargets } from './march';
import type { MatchState, UnitState } from './types';

export function stepUnit(unit: UnitState): UnitState {
  if (unit.path.length === 0) {
    return unit.edgeProgress === 0 ? unit : { ...unit, edgeProgress: 0 };
  }
  if (unit.edgeProgress === 0) return { ...unit, edgeProgress: 1 };

  const [nextCell, ...remainingPath] = unit.path;
  if (nextCell === undefined) return { ...unit, edgeProgress: 0 };
  return {
    ...unit,
    cell: nextCell,
    path: remainingPath,
    edgeProgress: 0,
  };
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
  let next: MatchState = advanceMarchOrders(initial);
  next = { ...next, elapsedTicks: initial.elapsedTicks + 1 };
  next = { ...next, units: next.units.map(stepUnit) };
  const beforeCombat = next;
  next = clearObservedDeadMarchTargets(beforeCombat, resolveCombat(next));
  next = advanceCapture(next);
  next = applyEconomyTick(next);
  next = advanceResearch(next);
  next = advanceProduction(next);
  next = applyTicketTick(next);
  next = resolveMatchOutcome(next);
  return { ...next, knowledge: updateFactionKnowledge(next) };
}
