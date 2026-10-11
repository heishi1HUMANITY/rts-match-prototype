import type { FactionId, MatchState } from './types';

/** Applies periodic outpost-weight ticket pressure after other per-tick losses. */
export function applyTicketTick(state: MatchState): MatchState {
  if (state.elapsedTicks % 10 !== 0) return state;
  const weights: Record<FactionId, number> = { A: 0, B: 0, C: 0 };
  for (const base of state.bases) {
    if (base.kind === 'outpost' && base.owner !== null && base.hp > 0) {
      weights[base.owner] += 1;
    }
  }
  return {
    ...state,
    factions: state.factions.map((faction) => {
      const otherWeight = (['A', 'B', 'C'] as const)
        .filter((id) => id !== faction.id)
        .reduce((sum, id) => sum + weights[id], 0);
      const penalty =
        Math.max(0, Math.min(6, otherWeight - 2 * weights[faction.id])) * 10;
      if (penalty === 0) return faction;
      return {
        ...faction,
        ticketsCenti: Math.max(0, faction.ticketsCenti - penalty),
      };
    }),
  };
}
