import {
  BASE_STATS,
  BASE_RESEARCH_INCOME_CENTI_PER_TICK,
  CAPTURE_RADIUS,
  CAPTURE_TICKS_REQUIRED,
  HQ_LOSS_TICKETS_CENTI,
  INITIAL_RESEARCH_CENTI,
  INITIAL_SUPPLY_CENTI,
  INITIAL_TICKETS_CENTI,
  MOVE_TICKS_PER_CELL,
  PRODUCTION_QUEUE_LIMIT,
  STANDARD_TIME_LIMIT_TICKS,
  UNIT_LIMIT,
  UNIT_LOSS_TICKETS_CENTI,
  UNIT_STATS,
  RESEARCH_DEFINITIONS,
  type ResearchDefinition,
} from './config';
import type {
  BaseKind,
  CombatTargetKind,
  CrossingTierId,
  ResearchId,
  UnitKind,
} from './types';

export const MASTER_SCHEMA_VERSION = 10 as const;
export const RULES_VERSION = 'f08-v3' as const;

export interface RulesMaster {
  readonly units: Readonly<
    Record<
      UnitKind,
      {
        readonly maxHp: number;
        readonly range: number;
        readonly vision: number;
        readonly costCenti: number;
        readonly buildTicks: number;
        readonly upkeepCentiPerTick: number;
        readonly moveTicksPerCell: number;
        readonly movementDomain: 'land' | 'air' | 'water';
        readonly attackTargets: readonly CombatTargetKind[];
        readonly canCaptureBase: boolean;
        readonly captureEfficiencyPercent: number;
        readonly damageVsLand: number;
        readonly damageVsAir: number;
        readonly damageVsWater: number;
        readonly damageVsStructure: number;
        readonly lossTicketsCenti: number;
        readonly unlockResearchId: string | null;
      }
    >
  >;
  readonly bases: Readonly<
    Record<
      BaseKind,
      {
        readonly maxHp: number;
        readonly vision: number;
        readonly supplyIncomeCentiPerTick: number;
        readonly researchIncomeCentiPerTick: number;
        readonly ticketWeight: number;
      }
    >
  >;
  readonly defenses: {
    readonly respawnEnabled: boolean;
    readonly outpost: {
      readonly maxHp: number;
      readonly baseDamage: number;
      readonly range: number;
      readonly respawnTicks: number;
    };
    readonly medium: {
      readonly maxHp: number;
      readonly baseDamage: number;
      readonly range: number;
      readonly respawnTicks: number;
    };
    readonly large: {
      readonly maxHp: number;
      readonly baseDamage: number;
      readonly range: number;
      readonly respawnTicks: number;
    };
  };
  readonly research: {
    readonly baseIncomeCentiPerTick: number;
    readonly definitions: Readonly<Record<ResearchId, ResearchDefinition>>;
  };
  readonly crossings: Readonly<
    Record<
      CrossingTierId,
      {
        readonly costCenti: number;
        readonly buildTicks: number;
        readonly dismantleTicks: number;
        readonly maxHp: number;
        readonly regenerationPerTick: number;
        readonly vision: number;
      }
    >
  >;
  readonly match: {
    readonly timeLimitTicks: number;
    readonly initialSupplyCenti: number;
    readonly initialResearchCenti: number;
    readonly initialTicketsCenti: number;
    readonly unitLossTicketsCenti: number;
    readonly hqLossTicketsCenti: number;
  };
  readonly limits: {
    readonly unitsPerFaction: number;
    readonly productionQueue: number;
  };
  readonly capture: {
    readonly requiredTicks: number;
    readonly radius: number;
  };
  readonly tickets: {
    readonly updateIntervalTicks: number;
    readonly penaltyPerWeightCenti: number;
    readonly maximumPenaltyWeight: number;
  };
  readonly npc: {
    readonly decisionIntervalTicks: number;
    readonly defenseAttentionRadius: number;
    readonly maxCommandsPerDecision: number;
  };
  readonly localFaction: {
    readonly appearanceTick: number;
    readonly strongholdMaxHp: number;
    readonly initialUnits: number;
    readonly spawnIntervalTicks: number;
    readonly maxUnits: number;
    readonly startingSupplyCenti: number;
    readonly unitCostCenti: number;
    readonly growthPercentPerMinute: number;
    readonly rescueRadius: number;
    readonly captureRewardSupplyCenti: number;
    readonly captureRewardResearchCenti: number;
    readonly strongholdRewardSupplyCenti: number;
    readonly strongholdRewardResearchCenti: number;
  };
}

export interface MasterEnvelope {
  readonly masterSchemaVersion: typeof MASTER_SCHEMA_VERSION;
  readonly revision: number;
  readonly rules: RulesMaster;
}

export const DEFAULT_RULES: RulesMaster = {
  units: Object.fromEntries(
    (Object.keys(UNIT_STATS) as (keyof typeof UNIT_STATS)[]).map((kind) => {
      const stats = UNIT_STATS[kind];
      return [
        kind,
        {
          maxHp: stats.maxHp,
          range: stats.range,
          vision: stats.vision,
          costCenti: stats.costCenti,
          buildTicks: stats.buildTicks,
          upkeepCentiPerTick: stats.upkeepCenti,
          moveTicksPerCell:
            kind === 'helicopter'
              ? 1
              : kind === 'artillery'
                ? 3
                : MOVE_TICKS_PER_CELL,
          movementDomain: stats.movementDomain,
          attackTargets: [...stats.attackTargets],
          canCaptureBase: stats.canCaptureBase,
          captureEfficiencyPercent: 100,
          damageVsLand: stats.damageVsLand,
          damageVsAir: stats.damageVsAir,
          damageVsWater: stats.damageVsWater,
          damageVsStructure: stats.damageVsStructure,
          lossTicketsCenti: stats.lossTicketsCenti,
          unlockResearchId: stats.unlockResearchId,
        },
      ];
    }),
  ) as unknown as RulesMaster['units'],
  bases: {
    hq: { ...BASE_STATS.hq, ticketWeight: 0 },
    outpost: { ...BASE_STATS.outpost, ticketWeight: 1 },
    medium: {
      maxHp: 180,
      vision: 5,
      supplyIncomeCentiPerTick: 30,
      researchIncomeCentiPerTick: 15,
      ticketWeight: 2,
    },
    large: {
      maxHp: 300,
      vision: 6,
      supplyIncomeCentiPerTick: 40,
      researchIncomeCentiPerTick: 20,
      ticketWeight: 3,
    },
  },
  defenses: {
    respawnEnabled: true,
    outpost: { maxHp: 60, baseDamage: 1, range: 2, respawnTicks: 300 },
    medium: { maxHp: 100, baseDamage: 2, range: 3, respawnTicks: 300 },
    large: { maxHp: 160, baseDamage: 3, range: 3, respawnTicks: 300 },
  },
  research: {
    baseIncomeCentiPerTick: BASE_RESEARCH_INCOME_CENTI_PER_TICK,
    definitions: {
      ...(Object.fromEntries(
        Object.entries(RESEARCH_DEFINITIONS).map(([id, definition]) => [
          id,
          { ...definition },
        ]),
      ) as Record<ResearchId, ResearchDefinition>),
    },
  },
  crossings: {
    'bridge-1': {
      costCenti: 6_000,
      buildTicks: 180,
      dismantleTicks: 40,
      maxHp: 180,
      regenerationPerTick: 1,
      vision: 5,
    },
    'bridge-2': {
      costCenti: 8_000,
      buildTicks: 240,
      dismantleTicks: 40,
      maxHp: 260,
      regenerationPerTick: 1,
      vision: 5,
    },
    'bridge-3': {
      costCenti: 12_000,
      buildTicks: 300,
      dismantleTicks: 50,
      maxHp: 340,
      regenerationPerTick: 1,
      vision: 5,
    },
    'ropeway-1': {
      costCenti: 5_000,
      buildTicks: 180,
      dismantleTicks: 40,
      maxHp: 200,
      regenerationPerTick: 1,
      vision: 6,
    },
    'ropeway-2': {
      costCenti: 9_000,
      buildTicks: 240,
      dismantleTicks: 50,
      maxHp: 300,
      regenerationPerTick: 1,
      vision: 6,
    },
  },
  match: {
    timeLimitTicks: STANDARD_TIME_LIMIT_TICKS,
    initialSupplyCenti: INITIAL_SUPPLY_CENTI,
    initialResearchCenti: INITIAL_RESEARCH_CENTI,
    initialTicketsCenti: INITIAL_TICKETS_CENTI,
    unitLossTicketsCenti: UNIT_LOSS_TICKETS_CENTI,
    hqLossTicketsCenti: HQ_LOSS_TICKETS_CENTI,
  },
  limits: {
    unitsPerFaction: UNIT_LIMIT,
    productionQueue: PRODUCTION_QUEUE_LIMIT,
  },
  capture: { requiredTicks: CAPTURE_TICKS_REQUIRED, radius: CAPTURE_RADIUS },
  tickets: {
    updateIntervalTicks: 10,
    penaltyPerWeightCenti: 10,
    maximumPenaltyWeight: 6,
  },
  npc: {
    decisionIntervalTicks: 10,
    defenseAttentionRadius: 10,
    maxCommandsPerDecision: 8,
  },
  localFaction: {
    appearanceTick: 300,
    strongholdMaxHp: 2_500,
    initialUnits: 2,
    spawnIntervalTicks: 450,
    maxUnits: 8,
    startingSupplyCenti: 12_000,
    unitCostCenti: 6_000,
    growthPercentPerMinute: 8,
    rescueRadius: 10,
    captureRewardSupplyCenti: 15_000,
    captureRewardResearchCenti: 3_000,
    strongholdRewardSupplyCenti: 40_000,
    strongholdRewardResearchCenti: 10_000,
  },
};

export function cloneRules(rules: RulesMaster): RulesMaster {
  return JSON.parse(JSON.stringify(rules)) as RulesMaster;
}
