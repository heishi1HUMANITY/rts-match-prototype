import type { FactionId, MatchState } from './types';

/** Applies periodic outpost-weight ticket pressure after other per-tick losses. */
export function applyTicketTick(state: MatchState): MatchState {
  if (state.elapsedTicks % state.rules.tickets.updateIntervalTicks !== 0)
    return state;
  const alive = state.factions.filter(
    ({ eliminatedAtTick }) => eliminatedAtTick === null,
  );
  if (alive.length <= 1) return state;
  const aliveIds = new Set(alive.map(({ id }) => id));
  const weights: Record<FactionId, number> = { A: 0, B: 0, C: 0 };
  for (const base of state.bases) {
    if (
      base.kind === 'outpost' &&
      base.owner !== null &&
      aliveIds.has(base.owner) &&
      base.hp > 0
    ) {
      weights[base.owner] += state.rules.bases[base.kind].ticketWeight;
    }
  }
  return {
    ...state,
    factions: state.factions.map((faction) => {
      if (faction.eliminatedAtTick !== null) return faction;
      const otherWeight = alive
        .filter((other) => other.id !== faction.id)
        .reduce((sum, other) => sum + weights[other.id], 0);
      const penalty =
        Math.max(
          0,
          Math.min(
            state.rules.tickets.maximumPenaltyWeight,
            otherWeight - (alive.length - 1) * weights[faction.id],
          ),
        ) * state.rules.tickets.penaltyPerWeightCenti;
      if (penalty === 0) return faction;
      return {
        ...faction,
        ticketsCenti: Math.max(0, faction.ticketsCenti - penalty),
      };
    }),
  };
}
