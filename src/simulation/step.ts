import type { MatchState, UnitState } from './types';

function stepUnit(unit: UnitState): UnitState {
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

/** Advances one deterministic simulation tick while running. */
export function stepMatch(state: MatchState): MatchState {
  if (state.phase !== 'running') return state;
  return {
    ...state,
    elapsedTicks: state.elapsedTicks + 1,
    units: state.units.map(stepUnit),
  };
}
