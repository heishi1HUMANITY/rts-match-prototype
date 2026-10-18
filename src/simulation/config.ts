import type {
  BaseKind,
  CombatTargetKind,
  ResearchDomain,
  ResearchEffect,
  ResearchId,
  ScenarioId,
  UnitKind,
} from './types';

export const SCHEMA_VERSION = 28 as const;
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
export const BASE_RESEARCH_INCOME_CENTI_PER_TICK = 12;
export const BASE_UNITS = 5;
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
          costCenti: 7_200,
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
    costCenti: 15_600,
    prerequisites: [
      'facility-turret',
      'facility-antiair',
      'facility-mine',
      'facility-watchtower',
      'facility-jammer',
      'bridge-2',
      'ropeway-1',
      'naval-1',
      'base-development-1',
    ],
    exclusiveWith: [],
    effects: [{ id: 'facility-build-speed-percent', value: 100 }],
  },
  'firepower-1': {
    domain: 'power',
    stage: 1,
    costCenti: 9_600,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'damage-bonus', value: 1 }],
  },
  'firepower-2': {
    domain: 'power',
    stage: 2,
    costCenti: 15_600,
    prerequisites: ['firepower-1', 'artillery-1', 'air-defense-1'],
    exclusiveWith: [],
    effects: [{ id: 'damage-bonus', value: 1 }],
  },
  'firepower-3': {
    domain: 'power',
    stage: 3,
    costCenti: 21_600,
    prerequisites: ['firepower-2'],
    exclusiveWith: [],
    effects: [{ id: 'damage-bonus', value: 1 }],
  },
  'bridge-2': {
    domain: 'engineering',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'crossing-unlock', value: 0, crossingTier: 'bridge-2' }],
  },
  'bridge-3': {
    domain: 'engineering',
    stage: 2,
    costCenti: 15_600,
    prerequisites: [
      'facility-turret',
      'facility-antiair',
      'facility-mine',
      'facility-watchtower',
      'facility-jammer',
      'bridge-2',
      'ropeway-1',
      'naval-1',
      'base-development-1',
    ],
    exclusiveWith: [],
    effects: [{ id: 'crossing-unlock', value: 0, crossingTier: 'bridge-3' }],
  },
  'ropeway-1': {
    domain: 'engineering',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'crossing-unlock', value: 0, crossingTier: 'ropeway-1' }],
  },
  'ropeway-2': {
    domain: 'engineering',
    stage: 2,
    costCenti: 15_600,
    prerequisites: [
      'facility-turret',
      'facility-antiair',
      'facility-mine',
      'facility-watchtower',
      'facility-jammer',
      'bridge-2',
      'ropeway-1',
      'naval-1',
      'base-development-1',
    ],
    exclusiveWith: [],
    effects: [{ id: 'crossing-unlock', value: 0, crossingTier: 'ropeway-2' }],
  },
  'supply-lines-1': {
    domain: 'logistics',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'supply-income-bonus', value: 1 }],
  },
  'maintenance-1': {
    domain: 'logistics',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'upkeep-reduction', value: 1 }],
  },
  'survey-1': {
    domain: 'information',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'vision-bonus', value: 1 }],
  },
  'survey-2': {
    domain: 'information',
    stage: 2,
    costCenti: 15_600,
    prerequisites: ['survey-1', 'aircraft-1'],
    exclusiveWith: [],
    effects: [{ id: 'vision-bonus', value: 1 }],
  },
  'artillery-1': {
    domain: 'power',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'unit-unlock', value: 0, unitKind: 'artillery' }],
  },
  'air-defense-1': {
    domain: 'power',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'unit-unlock', value: 0, unitKind: 'antiAir' }],
  },
  'aircraft-1': {
    domain: 'information',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'unit-unlock', value: 0, unitKind: 'helicopter' }],
  },
  'naval-1': {
    domain: 'engineering',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'unit-unlock', value: 0, unitKind: 'patrolBoat' }],
  },
  'base-development-1': {
    domain: 'engineering',
    stage: 1,
    costCenti: 7_200,
    prerequisites: [],
    exclusiveWith: [],
    effects: [{ id: 'base-upgrade-max', value: 2 }],
  },
  'base-development-2': {
    domain: 'engineering',
    stage: 2,
    costCenti: 15_600,
    prerequisites: [
      'facility-turret',
      'facility-antiair',
      'facility-mine',
      'facility-watchtower',
      'facility-jammer',
      'bridge-2',
      'ropeway-1',
      'naval-1',
      'base-development-1',
    ],
    exclusiveWith: [],
    effects: [{ id: 'base-upgrade-max', value: 3 }],
  },
  'specialization-power': {
    domain: 'power',
    stage: 4,
    costCenti: 27_600,
    prerequisites: ['firepower-3'],
    exclusiveWith: [
      'specialization-logistics',
      'specialization-information',
      'specialization-engineering',
      'specialization-wartime-economy',
      'specialization-information-warfare',
    ],
    effects: [{ id: 'damage-bonus', value: 1 }],
  },
  'specialization-wartime-economy': {
    domain: 'logistics',
    stage: 4,
    costCenti: 27_600,
    prerequisites: ['supply-lines-1', 'maintenance-1'],
    exclusiveWith: [
      'specialization-power',
      'specialization-logistics',
      'specialization-information',
      'specialization-engineering',
      'specialization-information-warfare',
    ],
    effects: [
      { id: 'supply-income-percent', value: 30 },
      { id: 'production-time-percent', value: 20 },
    ],
  },
  'specialization-logistics': {
    domain: 'logistics',
    stage: 4,
    costCenti: 27_600,
    prerequisites: ['supply-lines-1', 'maintenance-1'],
    exclusiveWith: [
      'specialization-power',
      'specialization-information',
      'specialization-engineering',
      'specialization-wartime-economy',
      'specialization-information-warfare',
    ],
    effects: [{ id: 'frontline-deployment', value: 1 }],
  },
  'specialization-information': {
    domain: 'information',
    stage: 4,
    costCenti: 27_600,
    prerequisites: ['survey-2', 'aircraft-1'],
    exclusiveWith: [
      'specialization-power',
      'specialization-logistics',
      'specialization-engineering',
      'specialization-wartime-economy',
      'specialization-information-warfare',
    ],
    effects: [{ id: 'global-observation', value: 1 }],
  },
  'specialization-engineering': {
    domain: 'engineering',
    stage: 4,
    costCenti: 27_600,
    prerequisites: [
      'bridge-3',
      'ropeway-2',
      'base-development-2',
      'facility-engineering',
      'naval-1',
    ],
    exclusiveWith: [
      'specialization-power',
      'specialization-logistics',
      'specialization-information',
      'specialization-wartime-economy',
      'specialization-information-warfare',
    ],
    effects: [{ id: 'blockade', value: 1 }],
  },
  'specialization-information-warfare': {
    domain: 'information',
    stage: 4,
    costCenti: 27_600,
    prerequisites: ['survey-2', 'aircraft-1'],
    exclusiveWith: [
      'specialization-power',
      'specialization-logistics',
      'specialization-information',
      'specialization-engineering',
      'specialization-wartime-economy',
    ],
    effects: [{ id: 'information-kill-bonus', value: 50 }],
  },
};

export { LEGACY_BASE_CELLS as BASE_CELLS } from './map-snapshot';
export { LEGACY_INITIAL_UNIT_PLACEMENTS as INITIAL_UNIT_PLACEMENTS } from './map-snapshot';

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
    supplyIncomeCentiPerTick: 0,
    researchIncomeCentiPerTick: 0,
  },
  outpost: {
    maxHp: 300,
    vision: 4,
    supplyIncomeCentiPerTick: 0,
    researchIncomeCentiPerTick: 0,
  },
  medium: {
    maxHp: 500,
    vision: 5,
    supplyIncomeCentiPerTick: 0,
    researchIncomeCentiPerTick: 0,
  },
  large: {
    maxHp: 800,
    vision: 6,
    supplyIncomeCentiPerTick: 0,
    researchIncomeCentiPerTick: 0,
  },
};

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
  'f86-point-fire',
  'f87-specializations',
  'f88-combat-estimate',
  'f120-combat-estimate-ui',
  'f121-combat-visibility',
];
