import type {
  EliminationReason,
  FactionId,
  FactionState,
  MatchResult,
  MatchStanding,
  MatchState,
} from './types';
import { updateFactionKnowledge } from './visibility';

function eliminationReason(
  state: MatchState,
  faction: FactionState,
): EliminationReason | null {
  if (faction.ticketsCenti <= 0) return 'tickets';
  const hq = state.bases.find(
    (base) => base.kind === 'hq' && base.homeFactionId === faction.id,
  );
  const hasUnits = state.units.some(
    (unit) => unit.factionId === faction.id && unit.hp > 0,
  );
  return hq?.hp === 0 && !hasUnits ? 'forces' : null;
}

function standingOrder(a: FactionState, b: FactionState): number {
  const aAlive = a.eliminatedAtTick === null;
  const bAlive = b.eliminatedAtTick === null;
  if (aAlive !== bAlive) return aAlive ? -1 : 1;
  if (aAlive) return b.ticketsCenti - a.ticketsCenti;
  return (b.eliminatedAtTick ?? 0) - (a.eliminatedAtTick ?? 0);
}

function makeStandings(factions: readonly FactionState[]): MatchStanding[] {
  const sorted = [...factions].sort(
    (a, b) => standingOrder(a, b) || a.id.localeCompare(b.id),
  );
  let rank = 1;
  return sorted.map((faction, index) => {
    if (index > 0 && standingOrder(sorted[index - 1]!, faction) !== 0) {
      rank = index + 1;
    }
    return {
      factionId: faction.id,
      rank,
      ticketsCenti: faction.ticketsCenti,
      eliminatedAtTick: faction.eliminatedAtTick,
      eliminationReason: faction.eliminationReason,
    };
  });
}

/** Resolves simultaneous eliminations after ticket updates, then ends at one survivor or timeout. */
export function resolveMatchOutcome(state: MatchState): MatchState {
  if (state.phase !== 'running') return state;
  const newlyEliminated = new Map<FactionId, EliminationReason>();
  for (const faction of state.factions) {
    if (faction.eliminatedAtTick !== null) continue;
    const reason = eliminationReason(state, faction);
    if (reason !== null) newlyEliminated.set(faction.id, reason);
  }

  const factions = state.factions.map((faction) => {
    const reason = newlyEliminated.get(faction.id);
    return reason === undefined
      ? faction
      : {
          ...faction,
          eliminatedAtTick: state.elapsedTicks,
          eliminationReason: reason,
          productionJobs: [],
          activeResearch: null,
        };
  });
  const units =
    newlyEliminated.size === 0
      ? state.units
      : state.units.filter((unit) => !newlyEliminated.has(unit.factionId));
  const bases =
    newlyEliminated.size === 0
      ? state.bases
      : state.bases.map((base) => {
          if (base.kind === 'hq') {
            return base.homeFactionId !== null &&
              newlyEliminated.has(base.homeFactionId)
              ? { ...base, hp: 0, captureCandidate: null, captureTicks: 0 }
              : base;
          }
          return base.owner !== null && newlyEliminated.has(base.owner)
            ? {
                ...base,
                owner: null,
                hp: 0,
                captureCandidate: null,
                captureTicks: 0,
              }
            : base;
        });
  const alive = factions.filter((faction) => faction.eliminatedAtTick === null);
  const reason: MatchResult['reason'] | null =
    alive.length === 0
      ? 'mutual-elimination'
      : alive.length === 1
        ? 'last-standing'
        : state.elapsedTicks >= state.timeLimitTicks
          ? 'time-limit'
          : null;
  if (newlyEliminated.size === 0 && reason === null) return state;
  const result: MatchResult | null =
    reason === null
      ? null
      : {
          reason,
          endedAtTick: state.elapsedTicks,
          standings: makeStandings(factions),
        };
  const resolved: MatchState = {
    ...state,
    factions,
    units,
    bases,
    phase: result === null ? 'running' : 'finished',
    result,
  };
  return newlyEliminated.size === 0
    ? resolved
    : { ...resolved, knowledge: updateFactionKnowledge(resolved) };
}
