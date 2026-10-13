import type { CombatantId, MatchState } from './types';
import { researchEffectValue } from './research';
import { upgradedIncome } from './base-upgrades';
import { supplyNetwork } from './supply';

/** Applies income from surviving owned bases and upkeep for surviving units. */
export function applyEconomyTick(state: MatchState): MatchState {
  const supplyByFaction = new Map(
    state.factions.map((faction) => [
      faction.id,
      supplyNetwork(state, faction.id),
    ]),
  );
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
    const disconnected =
      base.owner !== 'local' &&
      !supplyByFaction.get(base.owner)?.connectedBaseIds.includes(base.id);
    const incomePercent = disconnected
      ? state.rules.supplyLines.disconnectedIncomePercent
      : 100;
    entry.supply += Math.floor(
      ((upgradedIncome(
        base,
        stats.supplyIncomeCentiPerTick,
        state.rules,
        'supply',
      ) +
        supplyBonus) *
        incomePercent) /
        100,
    );
    entry.research += upgradedIncome(
      base,
      stats.researchIncomeCentiPerTick,
      state.rules,
      'research',
    );
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
