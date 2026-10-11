import { BASE_STATS, UNIT_STATS } from './config';
import type { FactionId, MatchState } from './types';

/** Applies income from surviving owned bases and upkeep for surviving units. */
export function applyEconomyTick(state: MatchState): MatchState {
  const income = new Map<FactionId, { supply: number; research: number }>();
  for (const faction of state.factions) {
    income.set(faction.id, { supply: 0, research: 0 });
  }
  for (const base of state.bases) {
    if (base.owner === null || base.hp <= 0) continue;
    const entry = income.get(base.owner);
    if (entry === undefined) continue;
    const stats = BASE_STATS[base.kind];
    entry.supply += stats.supplyIncomeCentiPerTick;
    entry.research += stats.researchIncomeCentiPerTick;
  }
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    const entry = income.get(unit.factionId);
    if (entry !== undefined) entry.supply -= UNIT_STATS[unit.kind].upkeepCenti;
  }

  return {
    ...state,
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
