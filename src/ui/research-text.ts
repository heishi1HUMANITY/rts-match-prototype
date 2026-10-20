import { FACILITY_NAMES } from './facilities';
import type { RulesMaster } from '../simulation/rules';
import type { FacilityKind, UnitKind } from '../simulation/types';

const UNIT_NAMES: Readonly<Record<UnitKind, string>> = {
  assault: '強襲',
  scout: '偵察',
  artillery: '自走砲',
  antiAir: '対空車両',
  helicopter: '攻撃ヘリ',
  patrolBoat: '哨戒艇',
};

const crossingName = (tier: string): string =>
  tier.startsWith('bridge') ? `橋 ${tier.slice(-1)}` : `索道 ${tier.slice(-1)}`;

/** Real-time amount per second for a centi-per-tick value, in display points. */
const pointsPerSecond = (centiPerTick: number, rules: RulesMaster): string =>
  ((centiPerTick * 1000) / rules.match.tickDurationMs / 100).toFixed(2);

/** A research effect in concrete terms: per-second amounts and shares of the base. */
export function researchEffectLabel(
  effect: {
    readonly id: string;
    readonly value: number;
    readonly crossingTier?: string;
    readonly unitKind?: string;
    readonly facilityKind?: string;
  },
  rules: RulesMaster,
): string {
  switch (effect.id) {
    case 'damage-bonus':
      return `全兵種の攻撃 +${effect.value}/発（強襲${rules.units.assault.damageVsLand}の${Math.round((effect.value * 100) / rules.units.assault.damageVsLand)}%）`;
    case 'vision-bonus':
      return `視界 +${effect.value}セル`;
    case 'supply-income-bonus':
      return `補給収入 +${pointsPerSecond(effect.value, rules)}/秒（基礎の${Math.round((effect.value * 100) / rules.economy.flatSupplyIncomeCentiPerTick)}%）`;
    case 'supply-income-percent':
      return `基礎補給収入 +${effect.value}%`;
    case 'upkeep-reduction':
      return `維持費 -${pointsPerSecond(effect.value, rules)}/秒/部隊（強襲の${Math.round((effect.value * 100) / Math.max(1, rules.units.assault.upkeepCentiPerTick))}%）`;
    case 'crossing-unlock':
      return `${effect.crossingTier ? crossingName(effect.crossingTier) : '渡河'}を建設可能`;
    case 'unit-unlock':
      return `${effect.unitKind ? (UNIT_NAMES[effect.unitKind as UnitKind] ?? effect.unitKind) : '兵種'}を生産可能`;
    case 'facility-unlock':
      return `${FACILITY_NAMES[effect.facilityKind as FacilityKind] ?? '施設'}を建築可能`;
    case 'facility-build-speed-percent':
      return `施設の建築速度 +${effect.value}%`;
    case 'production-time-percent':
      return `生産時間 -${effect.value}%`;
    case 'frontline-deployment':
      return `所有拠点で生産、半径${rules.cp87.frontlineRadius}で回復`;
    case 'global-observation':
      return '周期的な全域観測';
    case 'blockade':
      return '地雷の発見抑制・減速';
    case 'information-kill-bonus':
      return `撃破した敵の損失チケット +${effect.value}%`;
    case 'base-upgrade-max':
      return `拠点をLv${effect.value}まで強化可能`;
    default:
      return '未対応の効果';
  }
}

/** Research IDs whose prerequisites include `researchId`. */
export function researchUnlocks(
  rules: RulesMaster,
  researchId: string,
): string[] {
  return Object.entries(rules.research.definitions)
    .filter(([, definition]) => definition.prerequisites.includes(researchId))
    .map(([id]) => id);
}
