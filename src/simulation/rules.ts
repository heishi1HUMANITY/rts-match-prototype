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
} from './config';
import type { BaseKind, ResearchId, UnitKind } from './types';

export const MASTER_SCHEMA_VERSION = 2 as const;
export const RULES_VERSION = 'f03-v1' as const;

export interface RulesMaster {
  readonly units: Readonly<
    Record<
      UnitKind,
      {
        readonly maxHp: number;
        readonly baseDamage: number;
        readonly range: number;
        readonly vision: number;
        readonly costCenti: number;
        readonly buildTicks: number;
        readonly upkeepCentiPerTick: number;
        readonly moveTicksPerCell: number;
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
  readonly research: {
    readonly baseIncomeCentiPerTick: number;
    readonly definitions: Readonly<
      Record<
        ResearchId,
        {
          readonly costCenti: number;
          readonly prerequisite: ResearchId | null;
          readonly damageBonus: number;
        }
      >
    >;
  };
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
}

export interface MasterEnvelope {
  readonly masterSchemaVersion: typeof MASTER_SCHEMA_VERSION;
  readonly revision: number;
  readonly rules: RulesMaster;
}

export const DEFAULT_RULES: RulesMaster = {
  units: {
    assault: {
      maxHp: UNIT_STATS.assault.maxHp,
      baseDamage: UNIT_STATS.assault.baseDamage,
      range: UNIT_STATS.assault.range,
      vision: UNIT_STATS.assault.vision,
      costCenti: UNIT_STATS.assault.costCenti,
      buildTicks: UNIT_STATS.assault.buildTicks,
      upkeepCentiPerTick: UNIT_STATS.assault.upkeepCenti,
      moveTicksPerCell: MOVE_TICKS_PER_CELL,
    },
    scout: {
      maxHp: UNIT_STATS.scout.maxHp,
      baseDamage: UNIT_STATS.scout.baseDamage,
      range: UNIT_STATS.scout.range,
      vision: UNIT_STATS.scout.vision,
      costCenti: UNIT_STATS.scout.costCenti,
      buildTicks: UNIT_STATS.scout.buildTicks,
      upkeepCentiPerTick: UNIT_STATS.scout.upkeepCenti,
      moveTicksPerCell: MOVE_TICKS_PER_CELL,
    },
  },
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
  research: {
    baseIncomeCentiPerTick: BASE_RESEARCH_INCOME_CENTI_PER_TICK,
    definitions: {
      'firepower-1': { ...RESEARCH_DEFINITIONS['firepower-1'] },
      'firepower-2': { ...RESEARCH_DEFINITIONS['firepower-2'] },
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
};

export function cloneRules(rules: RulesMaster): RulesMaster {
  return JSON.parse(JSON.stringify(rules)) as RulesMaster;
}
