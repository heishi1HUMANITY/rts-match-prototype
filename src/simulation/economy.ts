import type { CombatantId, MatchState } from './types';
import { researchEffectValue } from './research';

/** Applies fixed faction income and surviving-unit upkeep, independent of territory. */
export function applyEconomyTick(state: MatchState): MatchState {
  const income = new Map<CombatantId, { supply: number; research: number }>();
  for (const faction of state.factions) {
    if (faction.eliminatedAtTick !== null) continue;
    const supplyBonus = researchEffectValue(
      faction,
      state.rules,
      'supply-income-bonus',
    );
    income.set(faction.id, {
      supply: state.rules.economy.flatSupplyIncomeCentiPerTick + supplyBonus,
      research: state.rules.research.baseIncomeCentiPerTick,
    });
  }
  if (state.localFaction.active && !state.localFaction.defeated)
    income.set('local', { supply: 0, research: 0 });
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
