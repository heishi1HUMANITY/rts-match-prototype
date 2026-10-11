import { advanceCapture } from './capture';
import { resolveCombat } from './combat';
import { applyEconomyTick } from './economy';
import { advanceProduction } from './production';
import { advanceResearch } from './research';
import { applyTicketTick } from './tickets';
import { updateFactionKnowledge } from './visibility';
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
 * Advances one deterministic G2 tick: movement, simultaneous combat, capture,
 * economy and research fill, production, tickets, then final visibility.
 */
export function stepMatch(state: MatchState): MatchState {
  if (state.phase !== 'running') return state;
  let next: MatchState = {
    ...state,
    elapsedTicks: state.elapsedTicks + 1,
  };
  next = { ...next, units: next.units.map(stepUnit) };
  next = resolveCombat(next);
  next = advanceCapture(next);
  next = applyEconomyTick(next);
  next = advanceResearch(next);
  next = advanceProduction(next);
  next = applyTicketTick(next);
  return { ...next, knowledge: updateFactionKnowledge(next) };
}
