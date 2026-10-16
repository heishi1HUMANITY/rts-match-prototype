import type {
  BaseKind,
  Cell,
  CombatTargetKind,
  FactionId,
  ResearchDomain,
  ResearchEffect,
  ResearchId,
  ScenarioId,
  UnitKind,
} from './types';

export const SCHEMA_VERSION = 24 as const;
export const STANDARD_TIME_LIMIT_TICKS = 12_000;
export const SHORT_TIME_LIMIT_TICKS = 200;
/** Current trial map; the original 40-cell layout remains available as LEGACY_MAP_SIZE. */
export const LEGACY_MAP_SIZE = 40;
export const MAP_WIDTH = LEGACY_MAP_SIZE;
export const MAP_HEIGHT = LEGACY_MAP_SIZE;
export const BLOCKED_CELL_PERCENT = 10;
export const MOVE_TICKS_PER_CELL = 2;
export const TICK_DURATION_MS = 100;

export const INITIAL_SUPPLY_CENTI = 20_000;
export const INITIAL_RESEARCH_CENTI = 0;
export const INITIAL_TICKETS_CENTI = 30_000;
export const BASE_RESEARCH_INCOME_CENTI_PER_TICK = 2;
export const BASE_UNITS = 3;
export const UNITS_PER_OWNED_BASE = 1;
export const MAX_UNITS = 9;
export const UNIT_LIMIT = MAX_UNITS;
/** Active job plus two queued jobs. */
export const PRODUCTION_QUEUE_LIMIT = 3;
export const CAPTURE_TICKS_REQUIRED = 200;
export const CAPTURE_RADIUS = 1;
export const UNIT_LOSS_TICKETS_CENTI = 800;

export const UNIT_STATS: Readonly<
  Record<
    UnitKind,
    {
      readonly costCenti: number;
      readonly buildTicks: number;
      readonly upkeepCenti: number;
      readonly maxHp: number;
      readonly range: number;
      readonly vision: number;
      readonly movementDomain: 'land' | 'air' | 'water';
      readonly attackTargets: readonly CombatTargetKind[];
      readonly canCaptureBase: boolean;
      readonly damageVsLand: number;
      readonly damageVsAir: number;
      readonly damageVsWater: number;
      readonly damageVsStructure: number;
      readonly lossTicketsCenti: number;
      readonly unlockResearchId: string | null;
      readonly moveTicksPerCell: number;
      readonly windupTicks: number;
      readonly intervalTicks: number;
      readonly canAttackWhileMoving: boolean;
    }
  >
> = {
  assault: {
    costCenti: 12_000,
    buildTicks: 200,
    upkeepCenti: 10,
    moveTicksPerCell: 4,
    maxHp: 200,
    range: 2,
    vision: 6,
    movementDomain: 'land',
    attackTargets: ['unit', 'defender', 'base', 'crossing'],
    canCaptureBase: true,
    damageVsLand: 20,
    damageVsAir: 20,
    damageVsWater: 20,
    damageVsStructure: 20,
    lossTicketsCenti: 800,
    unlockResearchId: null,
    windupTicks: 0,
    intervalTicks: 10,
    canAttackWhileMoving: true,
  },
  scout: {
    costCenti: 6_000,
    buildTicks: 100,
    upkeepCenti: 5,
    moveTicksPerCell: 3,
    maxHp: 120,
    range: 1,
    vision: 8,
    movementDomain: 'land',
    attackTargets: ['unit', 'defender', 'base', 'crossing'],
    canCaptureBase: true,
    damageVsLand: 5,
    damageVsAir: 5,
    damageVsWater: 5,
    damageVsStructure: 5,
    lossTicketsCenti: 400,
    unlockResearchId: null,
    windupTicks: 0,
    intervalTicks: 5,
    canAttackWhileMoving: true,
  },
  artillery: {
    costCenti: 10_000,
    buildTicks: 180,
    upkeepCenti: 14,
    moveTicksPerCell: 6,
    maxHp: 160,
    range: 5,
    vision: 5,
    movementDomain: 'land',
    attackTargets: ['unit', 'defender', 'base', 'crossing'],
    canCaptureBase: true,
    damageVsLand: 150,
    damageVsAir: 0,
    damageVsWater: 150,
    damageVsStructure: 150,
    lossTicketsCenti: 960,
    unlockResearchId: 'artillery-1',
    windupTicks: 10,
    intervalTicks: 30,
    canAttackWhileMoving: false,
  },
  antiAir: {
    costCenti: 9_000,
    buildTicks: 160,
    upkeepCenti: 10,
    moveTicksPerCell: 4,
    maxHp: 180,
    range: 4,
    vision: 7,
    movementDomain: 'land',
    attackTargets: ['unit', 'defender', 'base', 'crossing'],
    canCaptureBase: true,
    damageVsLand: 10,
    damageVsAir: 80,
    damageVsWater: 10,
    damageVsStructure: 10,
    lossTicketsCenti: 800,
    unlockResearchId: 'air-defense-1',
    windupTicks: 0,
    intervalTicks: 10,
    canAttackWhileMoving: true,
  },
  helicopter: {
    costCenti: 14_000,
    buildTicks: 220,
    upkeepCenti: 16,
    moveTicksPerCell: 2,
    maxHp: 180,
    range: 3,
    vision: 8,
    movementDomain: 'air',
    attackTargets: ['unit', 'defender', 'base', 'stronghold'],
    canCaptureBase: false,
    damageVsLand: 40,
    damageVsAir: 40,
    damageVsWater: 40,
    damageVsStructure: 10,
    lossTicketsCenti: 1040,
    unlockResearchId: 'aircraft-1',
    windupTicks: 0,
    intervalTicks: 10,
    canAttackWhileMoving: true,
  },
  patrolBoat: {
    costCenti: 12_000,
    buildTicks: 200,
    upkeepCenti: 14,
    moveTicksPerCell: 4,
    maxHp: 220,
    range: 3,
    vision: 7,
    movementDomain: 'water',
    attackTargets: ['unit', 'defender', 'base', 'crossing', 'stronghold'],
    canCaptureBase: false,
    damageVsLand: 40,
    damageVsAir: 40,
    damageVsWater: 40,
    damageVsStructure: 40,
    lossTicketsCenti: 960,
    unlockResearchId: 'naval-1',
    windupTicks: 0,
    intervalTicks: 10,
    canAttackWhileMoving: true,
  },
};

export interface ResearchDefinition {
  readonly domain: ResearchDomain;
  readonly stage: number;
  readonly costCenti: number;
  readonly prerequisites: readonly ResearchId[];
  readonly exclusiveWith: readonly ResearchId[];
  readonly effects: readonly ResearchEffect[];
}

export const RESEARCH_DEFINITIONS: Readonly<
  Record<string, ResearchDefinition>
> = {
  ...Object.fromEntries(
    (['turret', 'antiAir', 'mine', 'watchtower', 'jammer'] as const).map(
      (kind) => [
        `facility-${kind.toLowerCase()}`,
        {
          domain: 'engineering' as const,
          stage: 1,
          costCenti: 3000,
          prerequisites: [],
          exclusiveWith: [],
          effects: [
            { id: 'facility-unlock' as const, value: 0, facilityKind: kind },
          ],
        },
      ],
    ),
  ),
  'facility-engineering': {
    domain: 'engineering',
    stage: 2,
    costCenti: 6000,
    prerequisites: ['facility-turret'],
    exclusiveWith: [],
    effects: [{ id: 'facility-build-speed-percent', value: 100 }],
  },
  'firepower-1': {
    domain: 'power',
    stage: 1,
    costCenti: 6_000,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'damage-bonus', value: 1 }],
  },
  'firepower-2': {
    domain: 'power',
    stage: 2,
    costCenti: 9_000,
    prerequisites: ['firepower-1'],
    exclusiveWith: [],
    effects: [{ id: 'damage-bonus', value: 1 }],
  },
  'bridge-2': {
    domain: 'engineering',
    stage: 1,
    costCenti: 5_000,
    prerequisites: ['firepower-1'],
    exclusiveWith: [],
    effects: [{ id: 'crossing-unlock', value: 0, crossingTier: 'bridge-2' }],
  },
  'bridge-3': {
    domain: 'engineering',
    stage: 2,
    costCenti: 7_000,
    prerequisites: ['bridge-2'],
    exclusiveWith: [],
    effects: [{ id: 'crossing-unlock', value: 0, crossingTier: 'bridge-3' }],
  },
  'ropeway-1': {
    domain: 'engineering',
    stage: 1,
    costCenti: 4_000,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'crossing-unlock', value: 0, crossingTier: 'ropeway-1' }],
  },
  'ropeway-2': {
    domain: 'engineering',
    stage: 2,
    costCenti: 6_000,
    prerequisites: ['ropeway-1'],
    exclusiveWith: [],
    effects: [{ id: 'crossing-unlock', value: 0, crossingTier: 'ropeway-2' }],
  },
  'supply-lines-1': {
    domain: 'logistics',
    stage: 1,
    costCenti: 5_000,
    prerequisites: [],
    exclusiveWith: ['maintenance-1'],
    effects: [{ id: 'supply-income-bonus', value: 1 }],
  },
  'maintenance-1': {
    domain: 'logistics',
    stage: 1,
    costCenti: 5_000,
    prerequisites: [],
    exclusiveWith: ['supply-lines-1'],
    effects: [{ id: 'upkeep-reduction', value: 1 }],
  },
  'survey-1': {
    domain: 'information',
    stage: 1,
    costCenti: 5_000,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'vision-bonus', value: 1 }],
  },
  'survey-2': {
    domain: 'information',
    stage: 2,
    costCenti: 8_000,
    prerequisites: ['survey-1'],
    exclusiveWith: [],
    effects: [{ id: 'vision-bonus', value: 1 }],
  },
  'artillery-1': {
    domain: 'power',
    stage: 1,
    costCenti: 5_000,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'unit-unlock', value: 0, unitKind: 'artillery' }],
  },
  'air-defense-1': {
    domain: 'power',
    stage: 1,
    costCenti: 5_000,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'unit-unlock', value: 0, unitKind: 'antiAir' }],
  },
  'aircraft-1': {
    domain: 'information',
    stage: 1,
    costCenti: 5_000,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'unit-unlock', value: 0, unitKind: 'helicopter' }],
  },
  'naval-1': {
    domain: 'engineering',
    stage: 1,
    costCenti: 5_000,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'unit-unlock', value: 0, unitKind: 'patrolBoat' }],
  },
  'base-development-1': {
    domain: 'engineering',
    stage: 1,
    costCenti: 6_000,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'base-upgrade-max', value: 2 }],
  },
  'base-development-2': {
    domain: 'engineering',
    stage: 2,
    costCenti: 10_000,
    prerequisites: ['base-development-1'],
    exclusiveWith: [],
    effects: [{ id: 'base-upgrade-max', value: 3 }],
  },
};

export const BASE_CELLS: readonly {
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly factionId: FactionId | null;
}[] = [
  { id: 'HQ-A', kind: 'hq', cell: { x: 5, y: 20 }, factionId: 'A' },
  { id: 'HQ-B', kind: 'hq', cell: { x: 28, y: 33 }, factionId: 'B' },
  { id: 'HQ-C', kind: 'hq', cell: { x: 28, y: 7 }, factionId: 'C' },
  { id: 'HOME-A', kind: 'outpost', cell: { x: 10, y: 20 }, factionId: 'A' },
  { id: 'HOME-B', kind: 'outpost', cell: { x: 25, y: 31 }, factionId: 'B' },
  { id: 'HOME-C', kind: 'outpost', cell: { x: 25, y: 9 }, factionId: 'C' },
  { id: 'OUT-01', kind: 'outpost', cell: { x: 18, y: 17 }, factionId: null },
  { id: 'OUT-02', kind: 'large', cell: { x: 20, y: 20 }, factionId: null },
  { id: 'OUT-03', kind: 'outpost', cell: { x: 20, y: 28 }, factionId: null },
  { id: 'MID-01', kind: 'medium', cell: { x: 33, y: 22 }, factionId: null },
  { id: 'MID-02', kind: 'medium', cell: { x: 12, y: 29 }, factionId: null },
  { id: 'MID-03', kind: 'medium', cell: { x: 16, y: 10 }, factionId: null },
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
    maxHp: 1200,
    vision: 6,
    supplyIncomeCentiPerTick: 40,
    researchIncomeCentiPerTick: 0,
  },
  outpost: {
    maxHp: 300,
    vision: 4,
    supplyIncomeCentiPerTick: 20,
    researchIncomeCentiPerTick: 10,
  },
  medium: {
    maxHp: 500,
    vision: 5,
    supplyIncomeCentiPerTick: 30,
    researchIncomeCentiPerTick: 15,
  },
  large: {
    maxHp: 800,
    vision: 6,
    supplyIncomeCentiPerTick: 40,
    researchIncomeCentiPerTick: 20,
  },
};

export const INITIAL_UNIT_PLACEMENTS: readonly {
  readonly id: string;
  readonly factionId: FactionId;
  readonly kind: UnitKind;
  readonly cell: Cell;
}[] = [
  { id: 'A-01', factionId: 'A', kind: 'assault', cell: { x: 6, y: 20 } },
  { id: 'A-02', factionId: 'A', kind: 'scout', cell: { x: 6, y: 21 } },
  { id: 'B-01', factionId: 'B', kind: 'assault', cell: { x: 27, y: 33 } },
  { id: 'B-02', factionId: 'B', kind: 'scout', cell: { x: 27, y: 32 } },
  { id: 'C-01', factionId: 'C', kind: 'assault', cell: { x: 27, y: 7 } },
  { id: 'C-02', factionId: 'C', kind: 'scout', cell: { x: 27, y: 8 } },
];

export const SCENARIO_IDS: readonly ScenarioId[] = [
  'standard',
  'g2-capture',
  'g2-combat',
  'g2-economy',
  'g3-timeout',
  'g3-elimination',
  'g3-mutual',
  'g3-spectate',
  'f02-pursuit',
  'f04-crossing',
  'f05-neutral-defense',
  'f06-local-faction',
  'f08-unit-domains',
  'f10-base-upgrades',
  'f19-capture',
  'f11-facilities',
  'f18-garrison',
  'f15-tactical-abilities',
];
