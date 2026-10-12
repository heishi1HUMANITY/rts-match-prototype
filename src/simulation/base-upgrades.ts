import type { BaseUpgradeTier, RulesMaster } from './rules';
import type {
  BaseKind,
  BaseState,
  CommandResult,
  FactionId,
  MatchState,
} from './types';

export function maximumBaseLevel(
  faction: Pick<MatchState['factions'][number], 'completedResearchIds'>,
  rules: RulesMaster,
): number {
  return faction.completedResearchIds.reduce(
    (maximum, id) =>
      Math.max(
        maximum,
        ...(rules.research.definitions[id]?.effects ?? [])
          .filter((effect) => effect.id === 'base-upgrade-max')
          .map((effect) => effect.value),
      ),
    1,
  );
}

export function baseUpgradeTier(
  baseKind: BaseKind,
  targetLevel: 2 | 3,
  rules: RulesMaster,
): BaseUpgradeTier {
  return rules.baseUpgrades.kinds[baseKind][
    targetLevel === 2 ? 'level2' : 'level3'
  ];
}

export function beginBaseUpgrade(
  state: MatchState,
  actor: FactionId,
  baseId: string,
): CommandResult {
  const base = state.bases.find((entry) => entry.id === baseId);
  if (!base) return { ok: false, state, reason: 'BASE_NOT_FOUND' };
  const faction = state.factions.find((entry) => entry.id === actor);
  if (!faction) return { ok: false, state, reason: 'INVALID_ACTOR' };
  if (
    base.owner !== actor ||
    base.hp <= 0 ||
    (base.kind === 'hq' && base.homeFactionId !== actor)
  )
    return { ok: false, state, reason: 'BASE_UPGRADE_NOT_OWNED' };
  if (base.upgradeJob) return { ok: false, state, reason: 'BASE_UPGRADE_BUSY' };
  if (base.level >= 3) return { ok: false, state, reason: 'BASE_UPGRADE_MAX' };
  const targetLevel = (base.level + 1) as 2 | 3;
  if (maximumBaseLevel(faction, state.rules) < targetLevel)
    return {
      ok: false,
      state,
      reason: 'BASE_UPGRADE_RESEARCH_REQUIRED',
    };
  const tier = baseUpgradeTier(base.kind, targetLevel, state.rules);
  if (faction.supplyCenti < tier.costCenti)
    return { ok: false, state, reason: 'INSUFFICIENT_SUPPLY' };
  return {
    ok: true,
    state: {
      ...state,
      factions: state.factions.map((entry) =>
        entry.id === actor
          ? { ...entry, supplyCenti: entry.supplyCenti - tier.costCenti }
          : entry,
      ),
      bases: state.bases.map((entry) =>
        entry.id === baseId
          ? {
              ...entry,
              upgradeJob: {
                targetLevel,
                costCenti: tier.costCenti,
                remainingTicks: tier.buildTicks,
              },
            }
          : entry,
      ),
    },
  };
}

function baseStatsMaxHp(base: BaseState, rules: RulesMaster): number {
  return rules.bases[base.kind].maxHp;
}

/** Progresses paid jobs and passive recovery after combat and capture resolve. */
export function advanceBaseUpgrades(state: MatchState): MatchState {
  let changed = false;
  const bases = state.bases.map((base) => {
    let next = base;
    if (base.upgradeJob) {
      if (base.owner === null || base.hp <= 0) {
        next = { ...base, upgradeJob: null };
      } else {
        const remainingTicks = base.upgradeJob.remainingTicks - 1;
        if (remainingTicks <= 0) {
          const targetLevel = base.upgradeJob.targetLevel;
          const tier = baseUpgradeTier(base.kind, targetLevel, state.rules);
          const maxHp = Math.ceil(
            (baseStatsMaxHp(base, state.rules) * tier.maxHpPercent) / 100,
          );
          next = {
            ...base,
            level: targetLevel,
            maxHp,
            hp: Math.min(
              maxHp,
              Math.max(1, Math.round((base.hp * maxHp) / base.maxHp)),
            ),
            upgradeJob: null,
          };
        } else {
          next = {
            ...base,
            upgradeJob: { ...base.upgradeJob, remainingTicks },
          };
        }
      }
    }
    if (
      next.owner !== null &&
      next.hp > 0 &&
      next.hp < next.maxHp &&
      state.elapsedTicks - next.lastDamagedTick >=
        state.rules.baseUpgrades.recoveryDelayTicks
    ) {
      next = {
        ...next,
        hp: Math.min(
          next.maxHp,
          next.hp + state.rules.baseUpgrades.recoveryPerTick,
        ),
      };
    }
    if (next !== base) changed = true;
    return next;
  });
  return changed ? { ...state, bases } : state;
}

/** Applies level-dependent income percentages, preserving centi-unit precision. */
export function upgradedIncome(
  base: BaseState,
  incomeCentiPerTick: number,
  rules: RulesMaster,
  incomeKind: 'supply' | 'research',
): number {
  if (base.level === 1) return incomeCentiPerTick;
  const tier = baseUpgradeTier(base.kind, base.level as 2 | 3, rules);
  const percent =
    incomeKind === 'supply'
      ? tier.supplyIncomePercent
      : tier.researchIncomePercent;
  return Math.floor((incomeCentiPerTick * percent) / 100);
}

export function resetBaseToLevelOne(
  base: BaseState,
  rules: RulesMaster,
  tick: number,
  hpRatio: number,
): BaseState {
  const maxHp = rules.bases[base.kind].maxHp;
  return {
    ...base,
    level: 1,
    upgradeJob: null,
    maxHp,
    hp: Math.max(0, Math.min(maxHp, Math.floor(maxHp * hpRatio))),
    lastDamagedTick: tick,
  };
}

export function baseTurretDamage(
  base: BaseState,
  rules: RulesMaster,
): {
  readonly damage: number;
  readonly range: number;
  readonly interval: number;
} | null {
  if (base.level < 2) return null;
  const tier = baseUpgradeTier(base.kind, base.level as 2 | 3, rules);
  return {
    damage: tier.turretDamage,
    range: tier.turretRange,
    interval: tier.turretIntervalTicks,
  };
}
