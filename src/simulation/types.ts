import type { RulesMaster } from './rules';

/** Plain, serializable state. Browser and renderer dependencies belong elsewhere. */
export type FactionId = 'A' | 'B' | 'C';
/** Combat ownership includes local PvE forces without adding a ranked faction. */
export type CombatantId = FactionId | 'local';
export type BaseOwnerId = CombatantId;
export type Phase = 'ready' | 'running' | 'paused' | 'finished';
export type ScenarioId =
  | 'standard'
  | 'g2-capture'
  | 'g2-combat'
  | 'g2-economy'
  | 'g3-timeout'
  | 'g3-elimination'
  | 'g3-mutual'
  | 'g3-spectate'
  | 'f02-pursuit'
  | 'f04-crossing'
  | 'f05-neutral-defense'
  | 'f06-local-faction'
  | 'f08-unit-domains'
  | 'f10-base-upgrades'
  | 'f19-capture'
  | 'f11-facilities'
  | 'f18-garrison'
  | 'f15-tactical-abilities';
export type UnitKind =
  | 'assault'
  | 'scout'
  | 'artillery'
  | 'antiAir'
  | 'helicopter'
  | 'patrolBoat';
export type CrossingTierId =
  | 'bridge-1'
  | 'bridge-2'
  | 'bridge-3'
  | 'ropeway-1'
  | 'ropeway-2';
/** Research IDs are stable master keys; validity comes from the match RulesMaster. */
export type ResearchId = string;
export type ResearchDomain =
  | 'power'
  | 'logistics'
  | 'information'
  | 'engineering';
export type TacticalAbilityId =
  | 'artillery'
  | 'surge'
  | 'smoke'
  | 'bulwark'
  | 'survey'
  | 'jam';
export const TACTICAL_ABILITY_IDS: readonly TacticalAbilityId[] = [
  'artillery',
  'surge',
  'smoke',
  'bulwark',
  'survey',
  'jam',
];
export type ResearchEffectId =
  | 'damage-bonus'
  | 'vision-bonus'
  | 'supply-income-bonus'
  | 'upkeep-reduction'
  | 'crossing-unlock'
  | 'unit-unlock'
  | 'base-upgrade-max'
  | 'facility-unlock'
  | 'facility-build-speed-percent';
export interface ResearchEffect {
  readonly id: ResearchEffectId;
  readonly value: number;
  readonly crossingTier?: CrossingTierId;
  readonly unitKind?: UnitKind;
  readonly facilityKind?: FacilityKind;
}
export type BaseKind = 'hq' | 'outpost' | 'medium' | 'large';
export type TerrainKind = 'land' | 'riverbank' | 'river' | 'mountain';
export type MovementDomain = 'land' | 'air' | 'water';
export type CombatTargetKind =
  | 'unit'
  | 'defender'
  | 'base'
  | 'crossing'
  | 'stronghold'
  | 'facility';
export type EliminationReason = 'tickets' | 'hq' | 'forces';

export interface EliminationStatus {
  readonly eliminatedAtTick: number | null;
  readonly eliminationReason: EliminationReason | null;
}

export interface MatchStanding extends EliminationStatus {
  readonly factionId: FactionId;
  readonly rank: number;
  readonly ticketsCenti: number;
}

export interface MatchResult {
  readonly reason: 'last-standing' | 'mutual-elimination' | 'time-limit';
  readonly endedAtTick: number;
  readonly standings: readonly MatchStanding[];
}

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface GridMap {
  readonly width: number;
  readonly height: number;
  /** Immutable map-definition and physical-start assignment snapshot. */
  readonly definitionId?: string;
  readonly definitionVersion?: number;
  readonly startAssignment?: Readonly<
    Record<FactionId, 'north' | 'south-east' | 'south-west'>
  >;
  readonly basePlacements?: readonly MapBasePlacement[];
  readonly initialUnitPlacements?: readonly MapUnitPlacement[];
  /** Row-major terrain classes. */
  readonly terrain?: readonly TerrainKind[];
  /** Row-major river/mountain levels; zero for other cells. */
  readonly terrainLevel?: readonly number[];
  /** Public F04 construction anchors; these do not grant passage by themselves. */
  readonly crossingSites?: readonly CrossingSite[];
  readonly ports?: readonly PortSite[];
  /** Row-major compatibility mirror: land-blocked cells. */
  readonly blocked: readonly boolean[];
}

export interface MapBasePlacement {
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly factionId: FactionId | null;
}

export interface MapUnitPlacement {
  readonly id: string;
  readonly factionId: FactionId;
  readonly kind: UnitKind;
  readonly cell: Cell;
}

export interface PortSite {
  readonly id: string;
  readonly factionId: FactionId;
  readonly cell: Cell;
  readonly shore: Cell;
}

export interface CrossingSite {
  readonly id: string;
  readonly tier: CrossingTierId;
  readonly bankA: Cell;
  readonly bankB: Cell;
  readonly cells: readonly Cell[];
}

export interface ActiveCrossing extends CrossingSite {
  readonly owner: FactionId;
  readonly allowedUnitKinds: readonly UnitKind[];
}

export interface CrossingJob {
  readonly kind: 'build' | 'dismantle';
  readonly factionId: FactionId;
  readonly progressTicks: number;
  readonly requiredTicks: number;
  readonly paidCostCenti: number;
}

export interface CrossingState {
  readonly siteId: string;
  readonly owner: FactionId | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly lastDamagedTick: number;
  readonly job: CrossingJob | null;
}

export interface CrossingMemory {
  readonly siteId: string;
  readonly owner: FactionId | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly job: CrossingJob | null;
  readonly seenTick: number;
}

export type CrossingView =
  | {
      readonly visibility: 'unknown';
      readonly site: CrossingSite;
      readonly owner: null;
      readonly hp: null;
      readonly maxHp: null;
      readonly job: null;
    }
  | {
      readonly visibility: 'remembered' | 'visible' | 'owned';
      readonly site: CrossingSite;
      readonly owner: FactionId | null;
      readonly hp: number;
      readonly maxHp: number;
      readonly job: CrossingJob | null;
      readonly seenTick?: number;
    };

export interface ProductionJob {
  readonly id: string;
  readonly baseId: string;
  /** Reserved on enqueue so cancellation never reuses a unit identity. */
  readonly unitId: string;
  readonly unitKind: UnitKind;
  readonly costCenti: number;
  readonly status: 'active' | 'queued';
  readonly remainingTicks: number;
}

export interface ActiveResearch {
  readonly researchId: ResearchId;
}

/** Legacy name retained as an alias for the expanded faction state. */
export interface FactionState extends EliminationStatus {
  readonly id: FactionId;
  readonly controller: 'human' | 'bot';
  readonly supplyCenti: number;
  readonly researchCenti: number;
  readonly researchProgressCenti: Readonly<Record<ResearchId, number>>;
  readonly ticketsCenti: number;
  readonly productionJobs: readonly ProductionJob[];
  readonly activeResearch: ActiveResearch | null;
  readonly completedResearchIds: readonly ResearchId[];
  readonly nextUnitSerial: number;
  readonly nextJobSerial: number;
  readonly abilityReadyAtTick: Readonly<Record<TacticalAbilityId, number>>;
  readonly productionBoostUntilTick: number;
  /** Fractional production-tick progress, with denominator productionProgressPercent. */
  readonly productionProgressRemainder: number;
  readonly productionProgressPercent: number;
  readonly bulwarkUntilTick: number;
  readonly jammedUntilTick: number;
}
export type Faction = FactionState;

export interface AttackState {
  readonly targetId: string | null;
  readonly phase: 'idle' | 'windup' | 'cooldown';
  readonly phaseEndsTick: number;
}

export interface AttackProfile {
  readonly windupTicks: number;
  readonly intervalTicks: number;
  readonly canAttackWhileMoving: boolean;
}

export interface UnitState {
  readonly id: string;
  readonly factionId: CombatantId;
  readonly kind: UnitKind;
  readonly hp: number;
  readonly maxHp: number;
  /** Percent multiplier in hundredths, present only on local-faction units. */
  readonly growthCenti?: number;
  readonly cell: Cell;
  /** Excludes cell and begins with the next cell to reach. */
  readonly path: readonly Cell[];
  /** Completed ticks on the current two-tick edge. */
  readonly edgeProgress: number;
  readonly moveTicksPerCell?: number;
  readonly marchOrder?: MarchOrder | null;
  /** Retains a direct order while a newly closed crossing blocks its route. */
  readonly moveTarget?: Cell | null;
  /** Set while this unit is defending a friendly base from its garrison slot. */
  readonly garrisonedAtBaseId?: string | null;
  readonly smokeUntilTick?: number;
  readonly attack?: AttackState;
}

export interface MarchTarget {
  readonly kind: 'unit' | 'base';
  readonly id: string;
}

export interface MarchOrder {
  readonly target: MarchTarget;
  readonly lastKnownCell: Cell;
  readonly lastSeenTick: number;
  readonly status: 'tracking' | 'searching' | 'blocked' | 'arrived';
}

export interface BaseState {
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly owner: BaseOwnerId | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly level: 1 | 2 | 3;
  readonly upgradeJob: BaseUpgradeJob | null;
  readonly lastDamagedTick: number;
  readonly captureCandidate: CombatantId | null;
  readonly captureProgressCentiTicks: number;
  /** Neutral garrison; it is not a faction and never participates in standings. */
  readonly defender: NeutralDefenderState | null;
  /** True after a local-faction base is destroyed and while it awaits recapture. */
  readonly conqueredFromLocal?: boolean;
  /** Immutable original owner for HQs; null for neutral outposts. */
  readonly homeFactionId: FactionId | null;
  readonly attack?: AttackState;
}

export interface BaseUpgradeJob {
  readonly targetLevel: 2 | 3;
  readonly costCenti: number;
  readonly remainingTicks: number;
}

export interface NeutralDefenderState {
  readonly hp: number;
  readonly maxHp: number;
  /** Consecutive ticks without eligible capturers while disabled. */
  readonly disabledTicks: number;
  readonly attack?: AttackState;
}

export interface BaseMemory {
  readonly baseId: string;
  readonly owner: BaseOwnerId | null;
  readonly hp: number;
  readonly seenTick: number;
  readonly selfReportedLost: boolean;
  readonly defenderHp: number;
  readonly defenderMaxHp: number;
}

export interface FactionKnowledge {
  readonly factionId: CombatantId;
  /** Row-major maps. */
  readonly visible: readonly boolean[];
  readonly explored: readonly boolean[];
  readonly baseMemory: readonly BaseMemory[];
  readonly crossingMemory: readonly CrossingMemory[];
  readonly facilityMemory: readonly FacilityMemory[];
}

export interface MatchState {
  readonly schemaVersion: 24;
  readonly rules: RulesMaster;
  readonly seed: number;
  readonly scenarioId: ScenarioId;
  readonly elapsedTicks: number;
  readonly timeLimitTicks: number;
  readonly factions: readonly FactionState[];
  readonly phase: Phase;
  readonly map: GridMap;
  readonly units: readonly UnitState[];
  readonly bases: readonly BaseState[];
  readonly localFaction: LocalFactionState;
  readonly crossings: readonly CrossingState[];
  readonly facilities: readonly FacilityState[];
  readonly scheduledStrikes: readonly ScheduledStrike[];
  readonly surveys: readonly SurveyEffect[];
  readonly knowledge: readonly FactionKnowledge[];
  readonly result: MatchResult | null;
}

export interface ScheduledStrike {
  readonly factionId: FactionId;
  readonly cell: Cell;
  readonly impactTick: number;
}

export interface SurveyEffect {
  readonly factionId: FactionId;
  readonly cell: Cell;
  readonly radius: number;
  readonly expiresAtTick: number;
}

export interface OwnUnitView extends UnitState {
  readonly jammed?: boolean;
  readonly control: 'own';
}

/** Enemy DTO intentionally excludes cell, route, destination, queue, and resources. */
export interface VisibleEnemyUnitView {
  readonly control: 'enemy';
  readonly id: string;
  readonly factionId: CombatantId;
  readonly kind: UnitKind;
  readonly positionX1024: number;
  readonly positionY1024: number;
  readonly hp: number;
  readonly maxHp: number;
}

export interface UnknownBaseView {
  readonly visibility: 'unknown';
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly defenderHp: null;
  readonly defenderMaxHp: null;
}

export interface RememberedBaseView {
  readonly visibility: 'remembered';
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly owner: BaseOwnerId | null;
  readonly hp: number;
  readonly seenTick: number;
  readonly selfReportedLost: boolean;
  readonly defenderHp: number;
  readonly defenderMaxHp: number;
}

export interface VisibleBaseView {
  readonly visibility: 'visible';
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly owner: BaseOwnerId | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly level: 1 | 2 | 3;
  readonly captureCandidate: CombatantId | null;
  readonly captureProgressCentiTicks: number;
  readonly defenderHp: number | null;
  readonly defenderMaxHp: number | null;
}

export interface OwnedBaseView extends Omit<
  VisibleBaseView,
  'visibility' | 'owner'
> {
  readonly visibility: 'owned';
  readonly owner: BaseOwnerId;
  readonly upgradeJob: BaseUpgradeJob | null;
}

export type BaseView =
  | UnknownBaseView
  | RememberedBaseView
  | VisibleBaseView
  | OwnedBaseView;

export interface OwnFactionView extends EliminationStatus {
  readonly id: FactionId;
  readonly controller: 'human' | 'bot';
  readonly supplyCenti: number;
  readonly researchCenti: number;
  readonly researchProgressCenti: Readonly<Record<ResearchId, number>>;
  readonly ticketsCenti: number;
  readonly productionJobs: readonly ProductionJob[];
  readonly activeResearch: ActiveResearch | null;
  readonly completedResearchIds: readonly ResearchId[];
  readonly abilityReadyAtTick: Readonly<Record<TacticalAbilityId, number>>;
  readonly productionBoostUntilTick: number;
  readonly bulwarkUntilTick: number;
  readonly jammedUntilTick: number;
  readonly activeSmokeUntilTick: number;
  readonly activeSurveyUntilTick: number;
  readonly pendingStrikes: readonly ScheduledStrike[];
}

export interface FactionView {
  readonly viewerFactionId: FactionId;
  readonly seed: number;
  readonly scenarioId: ScenarioId;
  readonly phase: Phase;
  readonly tick: number;
  readonly timeLimitTicks: number;
  readonly rules: RulesMaster;
  readonly result: MatchResult | null;
  /** Public elimination status, without hidden force counts or resources. */
  readonly publicEliminations: Readonly<Record<FactionId, EliminationStatus>>;
  readonly map: GridMap;
  readonly ticketsCenti: Readonly<Record<FactionId, number>>;
  readonly ticketRatesCentiPerSec: Readonly<Record<FactionId, number>>;
  readonly visible: readonly boolean[];
  readonly explored: readonly boolean[];
  readonly ownFaction: OwnFactionView;
  readonly ownUnits: readonly OwnUnitView[];
  readonly visibleEnemies: readonly VisibleEnemyUnitView[];
  readonly bases: readonly BaseView[];
  readonly localFaction: LocalFactionView;
  readonly crossings: readonly CrossingView[];
  readonly facilities: readonly FacilityView[];
}

export interface LocalFactionState {
  readonly active: boolean;
  readonly defeated: boolean;
  readonly appearedAtTick: number | null;
  readonly nextSpawnTick: number | null;
  readonly rosterIndex: number;
  readonly stronghold: {
    readonly id: string;
    readonly cell: Cell;
    readonly hp: number;
    readonly maxHp: number;
  };
  readonly supplyCenti: number;
  readonly conqueredBaseIds: readonly string[];
  readonly rewardedBaseIds: readonly string[];
}

/** Public summary excludes hidden units, exact production timing, and resources. */
export interface LocalFactionView {
  readonly active: boolean;
  readonly defeated: boolean;
  readonly stronghold: {
    readonly visibility: 'hidden' | 'visible' | 'destroyed';
    readonly id: string;
    readonly cell: Cell | null;
    readonly hp: number | null;
    readonly maxHp: number | null;
  };
  readonly visibleUnitCount: number;
  readonly publicBaseCount: number;
}

export type FacilityKind =
  | 'turret'
  | 'antiAir'
  | 'mine'
  | 'watchtower'
  | 'jammer';
export interface FacilityAnchor {
  readonly kind: 'base' | 'crossing';
  readonly id: string;
}
export interface FacilityState {
  readonly id: string;
  readonly kind: FacilityKind;
  readonly owner: FactionId;
  readonly anchor: FacilityAnchor;
  readonly slot: number;
  readonly cell: Cell;
  readonly hp: number;
  readonly maxHp: number;
  readonly remainingBuildTicks: number;
  readonly lastDamagedTick: number;
  readonly lastActivatedTick: number;
  readonly attack?: AttackState;
}
export interface FacilityMemory extends FacilityState {
  readonly seenTick: number;
}
export interface FacilityView extends FacilityState {
  readonly visibility: 'owned' | 'visible' | 'remembered';
  readonly seenTick?: number;
}

export type Command =
  | {
      readonly type: 'activate-ability';
      readonly abilityId: 'artillery' | 'smoke' | 'survey';
      readonly cell: Cell;
    }
  | {
      readonly type: 'activate-ability';
      readonly abilityId: 'jam';
      readonly targetFactionId: FactionId;
    }
  | {
      readonly type: 'activate-ability';
      readonly abilityId: 'surge' | 'bulwark';
    }
  | {
      readonly type: 'build-facility';
      readonly kind: FacilityKind;
      readonly anchor: FacilityAnchor;
    }
  | { readonly type: 'start' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'move'; readonly unitId: string; readonly target: Cell }
  | {
      readonly type: 'march';
      readonly unitId: string;
      readonly target: MarchTarget;
    }
  | { readonly type: 'stop'; readonly unitId: string }
  | {
      readonly type: 'garrison';
      readonly unitId: string;
      readonly baseId: string;
    }
  | {
      readonly type: 'enqueue-production';
      readonly baseId: string;
      readonly unitKind: UnitKind;
    }
  | { readonly type: 'upgrade-base'; readonly baseId: string }
  | { readonly type: 'cancel-production'; readonly jobId: string }
  | { readonly type: 'start-research'; readonly researchId: ResearchId | null }
  | {
      readonly type: 'build-crossing';
      readonly siteId: string;
      readonly unitId: string;
    }
  | {
      readonly type: 'dismantle-crossing';
      readonly siteId: string;
      readonly unitId: string;
    };

export type RejectCode =
  | 'INVALID_COMMAND'
  | 'INVALID_ACTOR'
  | 'INVALID_PHASE'
  | 'UNIT_NOT_FOUND'
  | 'NOT_OWNER'
  | 'OUT_OF_BOUNDS'
  | 'BLOCKED'
  | 'UNREACHABLE'
  | 'BASE_NOT_FOUND'
  | 'JOB_NOT_FOUND'
  | 'INVALID_UNIT_KIND'
  | 'RESEARCH_NOT_FOUND'
  | 'HQ_UNAVAILABLE'
  | 'INSUFFICIENT_SUPPLY'
  | 'BASE_UPGRADE_MAX'
  | 'BASE_UPGRADE_BUSY'
  | 'BASE_UPGRADE_RESEARCH_REQUIRED'
  | 'BASE_UPGRADE_NOT_OWNED'
  | 'UNIT_LIMIT'
  | 'QUEUE_FULL'
  | 'ALREADY_RESEARCHED'
  | 'PREREQUISITE_MISSING'
  | 'RESEARCH_EXCLUDED'
  | 'FACTION_ELIMINATED'
  | 'TARGET_NOT_FOUND'
  | 'INVALID_TARGET'
  | 'RESEARCH_REQUIRED'
  | 'PORT_UNAVAILABLE'
  | 'CROSSING_NOT_FOUND'
  | 'CROSSING_TAKEN'
  | 'CROSSING_BUSY'
  | 'CROSSING_NOT_OWNED'
  | 'CROSSING_NOT_ADJACENT'
  | 'CROSSING_UNIT_RESTRICTED'
  | 'CROSSING_RESEARCH_REQUIRED'
  | 'INVALID_FACILITY_KIND'
  | 'FACILITY_ANCHOR_UNAVAILABLE'
  | 'FACILITY_LIMIT'
  | 'GARRISON_FULL'
  | 'GARRISON_DISABLED'
  | 'GARRISON_NOT_OWNED'
  | 'FACILITY_SLOTS_FULL'
  | 'FACILITY_DUPLICATE'
  | 'FACILITY_NO_CELL'
  | 'HQ_PROTECTED'
  | 'ABILITY_NOT_READY'
  | 'ABILITY_TARGET_INVALID'
  | 'ABILITY_TARGET_NOT_VISIBLE';

export type CommandResult =
  | { readonly ok: true; readonly state: MatchState }
  | {
      readonly ok: false;
      readonly state: MatchState;
      readonly reason: RejectCode;
    };
