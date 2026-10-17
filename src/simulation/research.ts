import type {
  ActiveResearch,
  CommandResult,
  FactionId,
  FactionState,
  MatchState,
  ResearchId,
} from './types';
import { DEFAULT_RULES } from './rules';
import type { RulesMaster } from './rules';
import type { ResearchEffectId, CrossingTierId, UnitKind } from './types';

function isResearchId(state: MatchState, value: string): value is ResearchId {
  return Object.prototype.hasOwnProperty.call(
    state.rules.research.definitions,
    value,
  );
}

/** Base cost grows with the number complete when the node receives its first point. */
export function researchCostForFaction(
  rules: RulesMaster,
  faction: Pick<FactionState, 'completedResearchIds' | 'researchRequiredCenti'>,
  researchId: ResearchId,
): number {
  const locked = faction.researchRequiredCenti?.[researchId];
  if (locked !== undefined) return locked;
  const definition = rules.research.definitions[researchId]!;
  const increase = rules.research.completionCostIncreaseBpsPerCompleted;
  return Math.ceil(
    (definition.costCenti *
      (10_000 + faction.completedResearchIds.length * increase)) /
      10_000,
  );
}

function fillSelectedResearch(
  state: MatchState,
  faction: FactionState,
  selection: ActiveResearch | null,
): FactionState {
  if (selection === null) return { ...faction, activeResearch: null };
  const { researchId } = selection;
  const progress = faction.researchProgressCenti[researchId] ?? 0;
  const cost = researchCostForFaction(state.rules, faction, researchId);
  const required = Math.max(0, cost - progress);
  const consumed = Math.min(faction.researchCenti, required);
  const nextProgress = progress + consumed;
  const researchProgressCenti = {
    ...faction.researchProgressCenti,
    [researchId]: nextProgress,
  };
  const completed = nextProgress >= cost;
  const researchRequiredCenti =
    nextProgress > 0 &&
    faction.researchRequiredCenti?.[researchId] === undefined
      ? { ...faction.researchRequiredCenti, [researchId]: cost }
      : faction.researchRequiredCenti;
  return {
    ...faction,
    researchCenti: faction.researchCenti - consumed,
    researchProgressCenti,
    ...(researchRequiredCenti ? { researchRequiredCenti } : {}),
    activeResearch: completed ? null : selection,
    completedResearchIds:
      completed && !faction.completedResearchIds.includes(researchId)
        ? [...faction.completedResearchIds, researchId]
        : faction.completedResearchIds,
  };
}

/** Selects or banks research; available bank is applied immediately to a selection. */
export function startResearch(
  state: MatchState,
  actor: FactionId,
  requestedResearchId: string | null,
): CommandResult {
  const faction = state.factions.find(({ id }) => id === actor);
  if (faction === undefined)
    return { ok: false, state, reason: 'INVALID_ACTOR' };
  if (requestedResearchId === null) {
    if (faction.activeResearch === null) return { ok: true, state };
    return {
      ok: true,
      state: {
        ...state,
        factions: state.factions.map((entry) =>
          entry === faction ? { ...entry, activeResearch: null } : entry,
        ),
      },
    };
  }
  if (!isResearchId(state, requestedResearchId)) {
    return { ok: false, state, reason: 'RESEARCH_NOT_FOUND' };
  }
  const researchId = requestedResearchId;
  if (faction.completedResearchIds.includes(researchId)) {
    return { ok: false, state, reason: 'ALREADY_RESEARCHED' };
  }
  if (faction.activeResearch?.researchId === researchId) {
    return { ok: true, state };
  }
  const definition = state.rules.research.definitions[researchId]!;
  if (
    definition.exclusiveWith.some((id) =>
      faction.completedResearchIds.includes(id),
    )
  )
    return { ok: false, state, reason: 'RESEARCH_EXCLUDED' };
  if (
    definition.prerequisites.length > 0 &&
    !definition.prerequisites.some((id) =>
      faction.completedResearchIds.includes(id),
    )
  ) {
    return { ok: false, state, reason: 'PREREQUISITE_MISSING' };
  }
  const selection: ActiveResearch = { researchId };
  const updatedFaction = fillSelectedResearch(state, faction, selection);
  const completedNow =
    !faction.completedResearchIds.includes(researchId) &&
    updatedFaction.completedResearchIds.includes(researchId);
  const completedIsSpecialization =
    state.rules.research.definitions[researchId]!.stage === 4;
  return {
    ok: true,
    state: {
      ...state,
      ...(completedNow && completedIsSpecialization
        ? {
            researchAnnouncements: [
              ...(state.researchAnnouncements ?? []),
              { factionId: actor, researchId, tick: state.elapsedTicks },
            ].slice(-32),
          }
        : {}),
      factions: state.factions.map((entry) =>
        entry === faction ? updatedFaction : entry,
      ),
    },
  };
}

/** Applies banked tick income to selected research after combat/capture/economy. */
export function advanceResearch(state: MatchState): MatchState {
  let changed = false;
  const researchAnnouncements = [...(state.researchAnnouncements ?? [])];
  const factions = state.factions.map((faction) => {
    if (faction.eliminatedAtTick !== null) return faction;
    const active = faction.activeResearch;
    if (active === null) return faction;
    const updated = fillSelectedResearch(state, faction, active);
    if (updated !== faction) changed = true;
    const completedNow = updated.completedResearchIds.filter(
      (id) => !faction.completedResearchIds.includes(id),
    );
    for (const researchId of completedNow)
      if (state.rules.research.definitions[researchId]?.stage === 4)
        researchAnnouncements.push({
          factionId: faction.id,
          researchId,
          tick: state.elapsedTicks,
        });
    return updated;
  });
  return changed
    ? {
        ...state,
        factions,
        researchAnnouncements: researchAnnouncements.slice(-32),
      }
    : state;
}

export function firepowerBonus(
  faction: FactionState,
  rules: RulesMaster = DEFAULT_RULES,
): number {
  return researchEffectValue(faction, rules, 'damage-bonus');
}

/** Sums only registered effects on this faction's completed research. */
export function researchEffectValue(
  faction: Pick<FactionState, 'completedResearchIds'>,
  rules: RulesMaster,
  effectId: ResearchEffectId,
  crossingTier?: CrossingTierId,
): number {
  return faction.completedResearchIds.reduce((sum, id) => {
    const definition = rules.research.definitions[id];
    if (!definition) return sum;
    return (
      sum +
      definition.effects.reduce(
        (total, effect) =>
          total +
          (effect.id === effectId &&
          (effectId !== 'crossing-unlock' ||
            effect.crossingTier === crossingTier)
            ? effect.value
            : 0),
        0,
      )
    );
  }, 0);
}

export function isUnitUnlocked(
  faction: Pick<FactionState, 'completedResearchIds'>,
  rules: RulesMaster,
  kind: UnitKind,
): boolean {
  const researchId = rules.units[kind].unlockResearchId;
  return (
    researchId === null ||
    faction.completedResearchIds.some((id) =>
      rules.research.definitions[id]?.effects.some(
        (effect) => effect.id === 'unit-unlock' && effect.unitKind === kind,
      ),
    )
  );
}
