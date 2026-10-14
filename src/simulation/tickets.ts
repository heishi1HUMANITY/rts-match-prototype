import type { FactionId, MatchState } from './types';
import type { RulesMaster } from './rules';

export function calculateBaseDecayPerTick(
  elapsedTicks: number,
  decay: RulesMaster['tickets']['decay'],
): number {
  if (elapsedTicks < decay.startTick) return 0;
  if (elapsedTicks >= decay.endTick) return decay.endCentiPerTick;
  const progress =
    (elapsedTicks - decay.startTick) / (decay.endTick - decay.startTick);
  return (
    decay.startCentiPerTick +
    progress * (decay.endCentiPerTick - decay.startCentiPerTick)
  );
}

export function calculateTerritoryMultiplierPercent(
  ownWeight: number,
  otherWeights: readonly number[],
  decay: RulesMaster['tickets']['decay'],
): number {
  if (otherWeights.length === 0) return 100;
  const avgOther =
    otherWeights.reduce((sum, w) => sum + w, 0) / otherWeights.length;
  const raw = 100 + decay.territoryPercentPerWeight * (avgOther - ownWeight);
  return Math.max(
    decay.territoryMinPercent,
    Math.min(decay.territoryMaxPercent, raw),
  );
}

/** Calculates per-interval ticket loss in centi for a faction. */
export function calculateIntervalTicketLossCenti(
  state: MatchState,
  factionId: FactionId,
): { penalty: number; decayCenti: number; totalLoss: number } {
  const alive = state.factions.filter(
    ({ eliminatedAtTick }) => eliminatedAtTick === null,
  );
  if (alive.length <= 1) return { penalty: 0, decayCenti: 0, totalLoss: 0 };
  const aliveIds = new Set(alive.map(({ id }) => id));
  const weights: Record<FactionId, number> = { A: 0, B: 0, C: 0 };
  for (const base of state.bases) {
    if (
      base.kind !== 'hq' &&
      base.owner !== null &&
      base.owner !== 'local' &&
      aliveIds.has(base.owner) &&
      base.hp > 0
    ) {
      weights[base.owner] += state.rules.bases[base.kind].ticketWeight;
    }
  }

  const otherAlive = alive.filter((other) => other.id !== factionId);
  const otherWeightTotal = otherAlive.reduce(
    (sum, other) => sum + weights[other.id],
    0,
  );

  const penalty =
    Math.max(
      0,
      Math.min(
        state.rules.tickets.maximumPenaltyWeight,
        otherWeightTotal - (alive.length - 1) * weights[factionId],
      ),
    ) * state.rules.tickets.penaltyPerWeightCenti;

  const baseDecayPerTick = calculateBaseDecayPerTick(
    state.elapsedTicks,
    state.rules.tickets.decay,
  );
  const otherWeights = otherAlive.map((other) => weights[other.id]);
  const territoryPercent = calculateTerritoryMultiplierPercent(
    weights[factionId],
    otherWeights,
    state.rules.tickets.decay,
  );
  const interval = state.rules.tickets.updateIntervalTicks;
  const decayCenti = Math.round(
    (baseDecayPerTick * interval * territoryPercent) / 100,
  );

  return { penalty, decayCenti, totalLoss: penalty + decayCenti };
}

/** Returns the estimated loss rate in centi per second (10 ticks). */
export function getFactionTicketLossRateCentiPerSec(
  state: MatchState,
  factionId: FactionId,
): number {
  const { totalLoss } = calculateIntervalTicketLossCenti(state, factionId);
  const interval = state.rules.tickets.updateIntervalTicks;
  return totalLoss * (10 / interval);
}

/** Applies periodic outpost-weight ticket pressure and base decay. */
export function applyTicketTick(state: MatchState): MatchState {
  if (state.elapsedTicks % state.rules.tickets.updateIntervalTicks !== 0)
    return state;
  const alive = state.factions.filter(
    ({ eliminatedAtTick }) => eliminatedAtTick === null,
  );
  if (alive.length <= 1) return state;

  return {
    ...state,
    factions: state.factions.map((faction) => {
      if (faction.eliminatedAtTick !== null) return faction;
      const { totalLoss } = calculateIntervalTicketLossCenti(state, faction.id);
      if (totalLoss === 0) return faction;
      return {
        ...faction,
        ticketsCenti: Math.max(0, faction.ticketsCenti - totalLoss),
      };
    }),
  };
}
