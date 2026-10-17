import {
  BASE_STATS,
  BASE_RESEARCH_INCOME_CENTI_PER_TICK,
  CAPTURE_RADIUS,
  CAPTURE_TICKS_REQUIRED,
  INITIAL_RESEARCH_CENTI,
  INITIAL_SUPPLY_CENTI,
  INITIAL_TICKETS_CENTI,
  PRODUCTION_QUEUE_LIMIT,
  STANDARD_TIME_LIMIT_TICKS,
  BASE_UNITS,
  UNITS_PER_OWNED_BASE,
  MAX_UNITS,
  UNIT_LOSS_TICKETS_CENTI,
  UNIT_STATS,
  RESEARCH_DEFINITIONS,
  type ResearchDefinition,
} from './config';
import type {
  BaseKind,
  FacilityKind,
  CombatTargetKind,
  CrossingTierId,
  ResearchId,
  StartPositionId,
  UnitKind,
} from './types';

export const MASTER_SCHEMA_VERSION = 26 as const;
export const RULES_VERSION = 'cp13-point-artillery-v1' as const;

export interface NpcDifficultyProfile {
  readonly decisionIntervalTicks: number;
  readonly maxCommandsPerDecision: number;
  readonly nextBestPercent: number;
  readonly publicReactionDelayTicks: number;
  readonly targetSwitchGraceTicks: number;
  readonly scoutUsePercent: number;
}

export interface TacticalAbilityRules {
  readonly costCenti: number;
  readonly cooldownTicks: number;
  readonly durationTicks: number;
  readonly radius: number;
  readonly unitDamage: number;
  readonly structureDamage: number;
  readonly supplyGrantCenti: number;
  readonly productionTimePercent: number;
  readonly damageTakenPercent: number;
  readonly visionPercent: number;
}

export interface ArtilleryBombardmentRules {
  readonly range: number;
  readonly preparationTicks: number;
  readonly intervalTicks: number;
  readonly observedImpactTicks: number;
  readonly unobservedImpactTicks: number;
  readonly observedScatterRadius1024: number;
  readonly unobservedScatterRadius1024: number;
  readonly blastRadius1024: number;
  readonly unitDamage: number;
  readonly structureDamage: number;
}

export interface BaseUpgradeTier {
  readonly costCenti: number;
  readonly buildTicks: number;
  readonly maxHpPercent: number;
  readonly supplyIncomePercent: number;
  readonly researchIncomePercent: number;
  /** Damage dealt by one shot every intervalTicks. */
  readonly turretDamage: number;
  readonly turretRange: number;
  readonly turretIntervalTicks?: number;
  readonly windupTicks: number;
  readonly intervalTicks: number;
  readonly canAttackWhileMoving: boolean;
}

export interface BaseUpgradeRules {
  readonly recoveryPerTick: number;
  readonly recoveryDelayTicks: number;
  readonly level2ResearchId: string;
  readonly level3ResearchId: string;
  readonly kinds: Readonly<
    Record<
      BaseKind,
      { readonly level2: BaseUpgradeTier; readonly level3: BaseUpgradeTier }
    >
  >;
}

export interface FacilityDefinition {
  readonly costCenti: number;
  readonly buildTicks: number;
  readonly maxHp: number;
  readonly range: number;
  readonly damageVsLand: number;
  readonly damageVsAir: number;
  readonly damageVsWater: number;
  readonly attackIntervalTicks?: number;
  readonly windupTicks: number;
  readonly intervalTicks: number;
  readonly canAttackWhileMoving: boolean;
  readonly vision: number;
  readonly jamRange: number;
}
export interface RulesMaster {
  readonly artilleryBombardment: ArtilleryBombardmentRules;
  readonly airDefense: {
    readonly deployTicks: number;
    readonly recognitionGraceTicks: number;
    readonly jammedRecognitionGraceTicks: number;
    readonly movingRangePercent: number;
    readonly movingDamagePercent: number;
  };
  readonly economy: {
    readonly flatSupplyIncomeCentiPerTick: number;
  };
  readonly facilities: {
    readonly slotsPerAnchor: number;
    readonly maxPerFaction: number;
    readonly definitions: Readonly<Record<FacilityKind, FacilityDefinition>>;
  };
  readonly baseUpgrades: BaseUpgradeRules;
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
        readonly canGarrison: boolean;
        readonly attackTargets: readonly CombatTargetKind[];
        readonly canCaptureBase: boolean;
        readonly captureEfficiencyPercent: number;
        readonly damageVsLand: number;
        readonly damageVsAir: number;
        readonly damageVsWater: number;
        readonly damageVsStructure: number;
        readonly lossTicketsCenti: number;
        readonly unlockResearchId: string | null;
        readonly windupTicks: number;
        readonly intervalTicks: number;
        readonly canAttackWhileMoving: boolean;
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
        readonly garrisonCapacity: number;
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
      readonly windupTicks: number;
      readonly intervalTicks: number;
      readonly canAttackWhileMoving: boolean;
    };
    readonly medium: {
      readonly maxHp: number;
      readonly baseDamage: number;
      readonly range: number;
      readonly respawnTicks: number;
      readonly windupTicks: number;
      readonly intervalTicks: number;
      readonly canAttackWhileMoving: boolean;
    };
    readonly large: {
      readonly maxHp: number;
      readonly baseDamage: number;
      readonly range: number;
      readonly respawnTicks: number;
      readonly windupTicks: number;
      readonly intervalTicks: number;
      readonly canAttackWhileMoving: boolean;
    };
  };
  readonly research: {
    readonly baseIncomeCentiPerTick: number;
    readonly completionCostIncreaseBpsPerCompleted: number;
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
    readonly hqProtectionTicks: number;
  };
  readonly limits: {
    readonly baseUnits: number;
    readonly unitsPerOwnedBase: number;
    readonly maxUnits: number;
    readonly productionQueue: number;
  };
  readonly capture: {
    readonly requiredTicks: number;
    readonly radius: number;
    readonly restoredHpPercent: number;
  };
  readonly tickets: {
    readonly updateIntervalTicks: number;
    readonly penaltyPerWeightCenti: number;
    readonly maximumPenaltyWeight: number;
    readonly decay: {
      readonly startTick: number;
      readonly startCentiPerTick: number;
      readonly endTick: number;
      readonly endCentiPerTick: number;
      readonly territoryPercentPerWeight: number;
      readonly territoryMinPercent: number;
      readonly territoryMaxPercent: number;
    };
  };
  readonly npc: {
    readonly decisionIntervalTicks: number;
    readonly defenseAttentionRadius: number;
    readonly maxCommandsPerDecision: number;
    readonly selectedDifficulty: 'weak' | 'standard' | 'strong';
    readonly difficultyProfiles: Readonly<
      Record<'weak' | 'standard' | 'strong', NpcDifficultyProfile>
    >;
    readonly routeScoring: {
      readonly riverPenalty: number;
      readonly mountainPenalty: number;
      readonly portPreference: number;
      readonly nearBestPercent: number;
    };
    readonly researchRoutes: Readonly<
      Record<
        StartPositionId,
        Readonly<Record<'crossing' | 'field', readonly ResearchId[]>>
      >
    >;
  };
  readonly localFaction: {
    readonly enabled: boolean;
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
  readonly tacticalAbilities: Readonly<
    Record<import('./types').TacticalAbilityId, TacticalAbilityRules>
  >;
}

export interface MasterEnvelope {
  readonly masterSchemaVersion: typeof MASTER_SCHEMA_VERSION;
  readonly revision: number;
  readonly rules: RulesMaster;
  readonly rulesVersion?: string;
}

export const DEFAULT_RULES: RulesMaster = {
  artilleryBombardment: {
    range: 8,
    preparationTicks: 10,
    intervalTicks: 80,
    observedImpactTicks: 30,
    unobservedImpactTicks: 50,
    observedScatterRadius1024: 512,
    unobservedScatterRadius1024: 2048,
    blastRadius1024: 1024,
    unitDamage: 100,
    structureDamage: 150,
  },
  airDefense: {
    deployTicks: 20,
    recognitionGraceTicks: 30,
    jammedRecognitionGraceTicks: 10,
    movingRangePercent: 50,
    movingDamagePercent: 25,
  },
  economy: { flatSupplyIncomeCentiPerTick: 120 },
  baseUpgrades: {
    recoveryPerTick: 1,
    recoveryDelayTicks: 10,
    level2ResearchId: 'base-development-1',
    level3ResearchId: 'base-development-2',
    kinds: {
      hq: {
        level2: {
          costCenti: 60_000,
          buildTicks: 600,
          maxHpPercent: 130,
          supplyIncomePercent: 125,
          researchIncomePercent: 125,
          turretDamage: 25,
          turretRange: 6,
          turretIntervalTicks: 10,
          windupTicks: 0,
          intervalTicks: 10,
          canAttackWhileMoving: true,
        },
        level3: {
          costCenti: 120_000,
          buildTicks: 900,
          maxHpPercent: 160,
          supplyIncomePercent: 150,
          researchIncomePercent: 150,
          turretDamage: 120,
          turretRange: 6,
          turretIntervalTicks: 10,
          windupTicks: 0,
          intervalTicks: 10,
          canAttackWhileMoving: true,
        },
      },
      outpost: {
        level2: {
          costCenti: 30_000,
          buildTicks: 450,
          maxHpPercent: 130,
          supplyIncomePercent: 130,
          researchIncomePercent: 130,
          turretDamage: 12,
          turretRange: 6,
          turretIntervalTicks: 10,
          windupTicks: 0,
          intervalTicks: 10,
          canAttackWhileMoving: true,
        },
        level3: {
          costCenti: 60_000,
          buildTicks: 750,
          maxHpPercent: 160,
          supplyIncomePercent: 160,
          researchIncomePercent: 160,
          turretDamage: 25,
          turretRange: 6,
          turretIntervalTicks: 10,
          windupTicks: 0,
          intervalTicks: 10,
          canAttackWhileMoving: true,
        },
      },
      medium: {
        level2: {
          costCenti: 50_000,
          buildTicks: 600,
          maxHpPercent: 130,
          supplyIncomePercent: 130,
          researchIncomePercent: 130,
          turretDamage: 20,
          turretRange: 6,
          turretIntervalTicks: 10,
          windupTicks: 0,
          intervalTicks: 10,
          canAttackWhileMoving: true,
        },
        level3: {
          costCenti: 100_000,
          buildTicks: 900,
          maxHpPercent: 160,
          supplyIncomePercent: 160,
          researchIncomePercent: 160,
          turretDamage: 40,
          turretRange: 6,
          turretIntervalTicks: 10,
          windupTicks: 0,
          intervalTicks: 10,
          canAttackWhileMoving: true,
        },
      },
      large: {
        level2: {
          costCenti: 80_000,
          buildTicks: 600,
          maxHpPercent: 130,
          supplyIncomePercent: 130,
          researchIncomePercent: 130,
          turretDamage: 30,
          turretRange: 6,
          turretIntervalTicks: 10,
          windupTicks: 0,
          intervalTicks: 10,
          canAttackWhileMoving: true,
        },
        level3: {
          costCenti: 160_000,
          buildTicks: 900,
          maxHpPercent: 160,
          supplyIncomePercent: 160,
          researchIncomePercent: 160,
          turretDamage: 60,
          turretRange: 6,
          turretIntervalTicks: 10,
          windupTicks: 0,
          intervalTicks: 10,
          canAttackWhileMoving: true,
        },
      },
    },
  },
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
          moveTicksPerCell: stats.moveTicksPerCell,
          movementDomain: stats.movementDomain,
          canGarrison: stats.movementDomain === 'land',
          attackTargets: [
            ...stats.attackTargets,
            ...(stats.damageVsStructure > 0 ? ['facility' as const] : []),
          ],
          canCaptureBase: stats.canCaptureBase,
          captureEfficiencyPercent: 100,
          damageVsLand: stats.damageVsLand,
          damageVsAir: stats.damageVsAir,
          damageVsWater: stats.damageVsWater,
          damageVsStructure: stats.damageVsStructure,
          lossTicketsCenti: stats.lossTicketsCenti,
          unlockResearchId: stats.unlockResearchId,
          windupTicks: stats.windupTicks,
          intervalTicks: stats.intervalTicks,
          canAttackWhileMoving: stats.canAttackWhileMoving,
        },
      ];
    }),
  ) as unknown as RulesMaster['units'],
  bases: {
    hq: { ...BASE_STATS.hq, ticketWeight: 0, garrisonCapacity: 5 },
    outpost: { ...BASE_STATS.outpost, ticketWeight: 1, garrisonCapacity: 1 },
    medium: { ...BASE_STATS.medium, ticketWeight: 2, garrisonCapacity: 2 },
    large: { ...BASE_STATS.large, ticketWeight: 3, garrisonCapacity: 3 },
  },
  defenses: {
    respawnEnabled: true,
    outpost: {
      maxHp: 60,
      baseDamage: 10,
      range: 2,
      respawnTicks: 300,
      windupTicks: 0,
      intervalTicks: 10,
      canAttackWhileMoving: true,
    },
    medium: {
      maxHp: 100,
      baseDamage: 20,
      range: 3,
      respawnTicks: 300,
      windupTicks: 0,
      intervalTicks: 10,
      canAttackWhileMoving: true,
    },
    large: {
      maxHp: 160,
      baseDamage: 30,
      range: 3,
      respawnTicks: 300,
      windupTicks: 0,
      intervalTicks: 10,
      canAttackWhileMoving: true,
    },
  },
  research: {
    baseIncomeCentiPerTick: BASE_RESEARCH_INCOME_CENTI_PER_TICK,
    completionCostIncreaseBpsPerCompleted: 450,
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
  facilities: {
    slotsPerAnchor: 2,
    maxPerFaction: 6,
    definitions: {
      turret: {
        costCenti: 15000,
        buildTicks: 300,
        maxHp: 300,
        range: 3,
        damageVsLand: 25,
        damageVsAir: 0,
        damageVsWater: 20,
        attackIntervalTicks: 10,
        windupTicks: 0,
        intervalTicks: 10,
        canAttackWhileMoving: true,
        vision: 3,
        jamRange: 0,
      },
      antiAir: {
        costCenti: 15000,
        buildTicks: 300,
        maxHp: 250,
        range: 4,
        damageVsLand: 0,
        damageVsAir: 50,
        damageVsWater: 0,
        attackIntervalTicks: 10,
        windupTicks: 0,
        intervalTicks: 10,
        canAttackWhileMoving: true,
        vision: 4,
        jamRange: 0,
      },
      mine: {
        costCenti: 10000,
        buildTicks: 200,
        maxHp: 1,
        range: 1,
        damageVsLand: 120,
        damageVsAir: 0,
        damageVsWater: 0,
        attackIntervalTicks: 10,
        windupTicks: 0,
        intervalTicks: 10,
        canAttackWhileMoving: true,
        vision: 0,
        jamRange: 0,
      },
      watchtower: {
        costCenti: 12000,
        buildTicks: 250,
        maxHp: 200,
        range: 0,
        damageVsLand: 0,
        damageVsAir: 0,
        damageVsWater: 0,
        attackIntervalTicks: 10,
        windupTicks: 0,
        intervalTicks: 10,
        canAttackWhileMoving: true,
        vision: 10,
        jamRange: 0,
      },
      jammer: {
        costCenti: 18000,
        buildTicks: 350,
        maxHp: 220,
        range: 0,
        damageVsLand: 0,
        damageVsAir: 0,
        damageVsWater: 0,
        attackIntervalTicks: 10,
        windupTicks: 0,
        intervalTicks: 10,
        canAttackWhileMoving: true,
        vision: 0,
        jamRange: 7,
      },
    },
  },
  match: {
    timeLimitTicks: STANDARD_TIME_LIMIT_TICKS,
    initialSupplyCenti: INITIAL_SUPPLY_CENTI,
    initialResearchCenti: INITIAL_RESEARCH_CENTI,
    initialTicketsCenti: INITIAL_TICKETS_CENTI,
    unitLossTicketsCenti: UNIT_LOSS_TICKETS_CENTI,
    hqProtectionTicks: 1200,
  },
  limits: {
    baseUnits: BASE_UNITS,
    unitsPerOwnedBase: UNITS_PER_OWNED_BASE,
    maxUnits: MAX_UNITS,
    productionQueue: PRODUCTION_QUEUE_LIMIT,
  },
  capture: {
    requiredTicks: CAPTURE_TICKS_REQUIRED,
    radius: CAPTURE_RADIUS,
    restoredHpPercent: 30,
  },
  tickets: {
    updateIntervalTicks: 10,
    penaltyPerWeightCenti: 10,
    maximumPenaltyWeight: 6,
    decay: {
      startTick: 3000,
      startCentiPerTick: 3,
      endTick: 6000,
      endCentiPerTick: 15,
      territoryPercentPerWeight: 25,
      territoryMinPercent: 50,
      territoryMaxPercent: 200,
    },
  },
  npc: {
    decisionIntervalTicks: 30,
    defenseAttentionRadius: 10,
    maxCommandsPerDecision: 2,
    selectedDifficulty: 'standard',
    difficultyProfiles: {
      weak: {
        decisionIntervalTicks: 50,
        maxCommandsPerDecision: 1,
        nextBestPercent: 75,
        publicReactionDelayTicks: 120,
        targetSwitchGraceTicks: 180,
        scoutUsePercent: 10,
      },
      standard: {
        decisionIntervalTicks: 30,
        maxCommandsPerDecision: 2,
        nextBestPercent: 35,
        publicReactionDelayTicks: 60,
        targetSwitchGraceTicks: 90,
        scoutUsePercent: 40,
      },
      strong: {
        decisionIntervalTicks: 20,
        maxCommandsPerDecision: 3,
        nextBestPercent: 10,
        publicReactionDelayTicks: 20,
        targetSwitchGraceTicks: 30,
        scoutUsePercent: 75,
      },
    },
    routeScoring: {
      riverPenalty: 4,
      mountainPenalty: 8,
      portPreference: 5,
      nearBestPercent: 15,
    },
    researchRoutes: {
      north: {
        crossing: ['bridge-2', 'firepower-1', 'artillery-1', 'air-defense-1'],
        field: ['firepower-1', 'artillery-1', 'air-defense-1', 'bridge-2'],
      },
      'south-east': {
        crossing: ['bridge-2', 'firepower-1', 'air-defense-1', 'artillery-1'],
        field: ['firepower-1', 'air-defense-1', 'artillery-1', 'bridge-2'],
      },
      'south-west': {
        crossing: ['bridge-2', 'air-defense-1', 'firepower-1', 'artillery-1'],
        field: ['firepower-1', 'artillery-1', 'bridge-2', 'air-defense-1'],
      },
    },
  },
  localFaction: {
    enabled: false,
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
  tacticalAbilities: {
    artillery: {
      costCenti: 12_000,
      cooldownTicks: 1_800,
      durationTicks: 50,
      radius: 3,
      unitDamage: 70,
      structureDamage: 60,
      supplyGrantCenti: 0,
      productionTimePercent: 100,
      damageTakenPercent: 100,
      visionPercent: 100,
    },
    surge: {
      costCenti: 8_000,
      cooldownTicks: 1_800,
      durationTicks: 300,
      radius: 0,
      unitDamage: 0,
      structureDamage: 0,
      supplyGrantCenti: 0,
      productionTimePercent: 50,
      damageTakenPercent: 100,
      visionPercent: 100,
    },
    smoke: {
      costCenti: 6_000,
      cooldownTicks: 1_500,
      durationTicks: 200,
      radius: 4,
      unitDamage: 0,
      structureDamage: 0,
      supplyGrantCenti: 0,
      productionTimePercent: 100,
      damageTakenPercent: 100,
      visionPercent: 100,
    },
    bulwark: {
      costCenti: 8_000,
      cooldownTicks: 1_800,
      durationTicks: 200,
      radius: 0,
      unitDamage: 0,
      structureDamage: 0,
      supplyGrantCenti: 0,
      productionTimePercent: 100,
      damageTakenPercent: 50,
      visionPercent: 100,
    },
    survey: {
      costCenti: 7_000,
      cooldownTicks: 1_200,
      durationTicks: 150,
      radius: 8,
      unitDamage: 0,
      structureDamage: 0,
      supplyGrantCenti: 0,
      productionTimePercent: 100,
      damageTakenPercent: 100,
      visionPercent: 100,
    },
    jam: {
      costCenti: 8_000,
      cooldownTicks: 1_800,
      durationTicks: 200,
      radius: 0,
      unitDamage: 0,
      structureDamage: 0,
      supplyGrantCenti: 0,
      productionTimePercent: 100,
      damageTakenPercent: 100,
      visionPercent: 50,
    },
  },
};

export function cloneRules(rules: RulesMaster): RulesMaster {
  return JSON.parse(JSON.stringify(rules)) as RulesMaster;
}
