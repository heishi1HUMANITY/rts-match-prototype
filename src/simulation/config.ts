import type {
  BaseKind,
  Cell,
  FactionId,
  ResearchId,
  ScenarioId,
  UnitKind,
} from './types';

export const SCHEMA_VERSION = 3 as const;
export const MAP_WIDTH = 40;
export const MAP_HEIGHT = 40;
export const BLOCKED_CELL_PERCENT = 10;
export const MOVE_TICKS_PER_CELL = 2;
export const TICK_DURATION_MS = 100;

export const INITIAL_SUPPLY_CENTI = 20_000;
export const INITIAL_RESEARCH_CENTI = 0;
export const INITIAL_TICKETS_CENTI = 100_000;
export const UNIT_LIMIT = 6;
/** Active job plus two queued jobs. */
export const PRODUCTION_QUEUE_LIMIT = 3;
export const CAPTURE_TICKS_REQUIRED = 30;
export const CAPTURE_RADIUS = 1;
export const UNIT_LOSS_TICKETS_CENTI = 800;
export const HQ_LOSS_TICKETS_CENTI = 10_000;

export const UNIT_STATS: Readonly<
  Record<
    UnitKind,
    {
      readonly costCenti: number;
      readonly buildTicks: number;
      readonly upkeepCenti: number;
      readonly maxHp: number;
      readonly baseDamage: number;
      readonly range: number;
      readonly vision: number;
    }
  >
> = {
  assault: {
    costCenti: 12_000,
    buildTicks: 120,
    upkeepCenti: 5,
    maxHp: 100,
    baseDamage: 2,
    range: 2,
    vision: 6,
  },
  scout: {
    costCenti: 6_000,
    buildTicks: 60,
    upkeepCenti: 3,
    maxHp: 60,
    baseDamage: 1,
    range: 1,
    vision: 8,
  },
};

export interface ResearchDefinition {
  readonly costCenti: number;
  readonly durationTicks: number;
  readonly prerequisite: ResearchId | null;
  readonly damageBonus: number;
}

export const RESEARCH_DEFINITIONS: Readonly<
  Record<ResearchId, ResearchDefinition>
> = {
  'firepower-1': {
    costCenti: 6_000,
    durationTicks: 100,
    prerequisite: null,
    damageBonus: 1,
  },
  'firepower-2': {
    costCenti: 9_000,
    durationTicks: 150,
    prerequisite: 'firepower-1',
    damageBonus: 1,
  },
};

export const BASE_CELLS: readonly {
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly factionId: FactionId | null;
}[] = [
  { id: 'HQ-A', kind: 'hq', cell: { x: 6, y: 34 }, factionId: 'A' },
  { id: 'HQ-B', kind: 'hq', cell: { x: 33, y: 34 }, factionId: 'B' },
  { id: 'HQ-C', kind: 'hq', cell: { x: 20, y: 5 }, factionId: 'C' },
  { id: 'OUT-01', kind: 'outpost', cell: { x: 20, y: 12 }, factionId: null },
  { id: 'OUT-02', kind: 'outpost', cell: { x: 20, y: 20 }, factionId: null },
  { id: 'OUT-03', kind: 'outpost', cell: { x: 20, y: 28 }, factionId: null },
];

export const BASE_STATS: Readonly<
  Record<
    BaseKind,
    {
      readonly maxHp: number;
      readonly vision: number;
      readonly supplyIncomeCentiPerTick: number;
      readonly researchIncomeCentiPerTick: number;
    }
  >
> = {
  hq: {
    maxHp: 300,
    vision: 6,
    supplyIncomeCentiPerTick: 40,
    researchIncomeCentiPerTick: 0,
  },
  outpost: {
    maxHp: 100,
    vision: 4,
    supplyIncomeCentiPerTick: 20,
    researchIncomeCentiPerTick: 10,
  },
};

export const ISOLATED_CELL: Cell = { x: 30, y: 10 };

export const INITIAL_UNIT_PLACEMENTS: readonly {
  readonly id: string;
  readonly factionId: FactionId;
  readonly kind: UnitKind;
  readonly cell: Cell;
}[] = [
  { id: 'A-01', factionId: 'A', kind: 'assault', cell: { x: 6, y: 33 } },
  { id: 'A-02', factionId: 'A', kind: 'scout', cell: { x: 7, y: 33 } },
  { id: 'B-01', factionId: 'B', kind: 'assault', cell: { x: 33, y: 33 } },
  { id: 'B-02', factionId: 'B', kind: 'scout', cell: { x: 32, y: 33 } },
  { id: 'C-01', factionId: 'C', kind: 'assault', cell: { x: 20, y: 6 } },
  { id: 'C-02', factionId: 'C', kind: 'scout', cell: { x: 21, y: 6 } },
];

export const SCENARIO_IDS: readonly ScenarioId[] = [
  'standard',
  'g2-capture',
  'g2-combat',
  'g2-economy',
];
