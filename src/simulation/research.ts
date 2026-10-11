import { RESEARCH_DEFINITIONS } from './config';
import type {
  CommandResult,
  FactionId,
  FactionState,
  MatchState,
  ResearchId,
} from './types';

function isResearchId(value: string): value is ResearchId {
  return Object.prototype.hasOwnProperty.call(RESEARCH_DEFINITIONS, value);
}

/** Validates and pays for exactly one non-cancellable research project. */
export function startResearch(
  state: MatchState,
  actor: FactionId,
  researchId: string,
): CommandResult {
  if (!isResearchId(researchId)) {
    return { ok: false, state, reason: 'RESEARCH_NOT_FOUND' };
  }
  const faction = state.factions.find(({ id }) => id === actor);
  if (faction === undefined) {
    return { ok: false, state, reason: 'INVALID_ACTOR' };
  }
  if (faction.completedResearchIds.includes(researchId)) {
    return { ok: false, state, reason: 'ALREADY_RESEARCHED' };
  }
  if (faction.activeResearch !== null) {
    return { ok: false, state, reason: 'RESEARCH_BUSY' };
  }
  const definition = RESEARCH_DEFINITIONS[researchId];
  if (
    definition.prerequisite !== null &&
    !faction.completedResearchIds.includes(definition.prerequisite)
  ) {
    return { ok: false, state, reason: 'PREREQUISITE_MISSING' };
  }
  if (faction.researchCenti < definition.costCenti) {
    return { ok: false, state, reason: 'INSUFFICIENT_RESEARCH' };
  }
  return {
    ok: true,
    state: {
      ...state,
      factions: state.factions.map((entry) =>
        entry === faction
          ? {
              ...entry,
              researchCenti: entry.researchCenti - definition.costCenti,
              activeResearch: {
                researchId,
                costCenti: definition.costCenti,
                remainingTicks: definition.durationTicks,
              },
            }
          : entry,
      ),
    },
  };
}

/** Called first in each running tick, before combat computes damage. */
export function advanceResearch(state: MatchState): MatchState {
  return {
    ...state,
    factions: state.factions.map((faction) => {
      const active = faction.activeResearch;
      if (active === null) return faction;
      if (active.remainingTicks > 1) {
        return {
          ...faction,
          activeResearch: {
            ...active,
            remainingTicks: active.remainingTicks - 1,
          },
        };
      }
      return {
        ...faction,
        activeResearch: null,
        completedResearchIds: [
          ...faction.completedResearchIds,
          active.researchId,
        ],
      };
    }),
  };
}

export function firepowerBonus(faction: FactionState): number {
  return faction.completedResearchIds.reduce(
    (sum, id) => sum + RESEARCH_DEFINITIONS[id].damageBonus,
    0,
  );
}
