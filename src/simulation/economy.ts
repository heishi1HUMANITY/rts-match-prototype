import type { CombatantId, MatchState } from './types';
import { researchEffectValue } from './research';

/** Applies income from surviving owned bases and upkeep for surviving units. */
export function applyEconomyTick(state: MatchState): MatchState {
  const income = new Map<CombatantId, { supply: number; research: number }>();
  for (const faction of state.factions) {
    if (faction.eliminatedAtTick !== null) continue;
    income.set(faction.id, {
      supply: 0,
      research: state.rules.research.baseIncomeCentiPerTick,
    });
  }
  if (state.localFaction.active && !state.localFaction.defeated)
    income.set('local', { supply: 0, research: 0 });
  for (const base of state.bases) {
    if (base.owner === null || base.hp <= 0) continue;
    const entry = income.get(base.owner);
    if (entry === undefined) continue;
    const stats = state.rules.bases[base.kind];
    const faction = state.factions.find(({ id }) => id === base.owner);
    const supplyBonus = faction
      ? researchEffectValue(faction, state.rules, 'supply-income-bonus')
      : 0;
    entry.supply += stats.supplyIncomeCentiPerTick + supplyBonus;
    entry.research += stats.researchIncomeCentiPerTick;
  }
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    const entry = income.get(unit.factionId);
    if (entry !== undefined) {
      const faction = state.factions.find(({ id }) => id === unit.factionId);
      const reduction = faction
        ? researchEffectValue(faction, state.rules, 'upkeep-reduction')
        : 0;
      entry.supply -= Math.max(
        0,
        state.rules.units[unit.kind].upkeepCentiPerTick - reduction,
      );
    }
  }

  const localDelta = income.get('local');
  return {
    ...state,
    localFaction:
      localDelta === undefined
        ? state.localFaction
        : {
            ...state.localFaction,
            supplyCenti: Math.max(
              0,
              state.localFaction.supplyCenti + localDelta.supply,
            ),
          },
    factions: state.factions.map((faction) => {
      const delta = income.get(faction.id);
      if (delta === undefined) return faction;
      return {
        ...faction,
        supplyCenti: Math.max(0, faction.supplyCenti + delta.supply),
        researchCenti: faction.researchCenti + delta.research,
      };
    }),
  };
}
