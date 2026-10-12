import type { RulesMaster } from './rules';

/** Plain, serializable state. Browser and renderer dependencies belong elsewhere. */
export type FactionId = 'A' | 'B' | 'C';
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
  | 'f04-crossing';
export type UnitKind = 'assault' | 'scout';
export type CrossingTierId =
  | 'bridge-1'
  | 'bridge-2'
  | 'bridge-3'
  | 'ropeway-1'
  | 'ropeway-2';
export type ResearchId =
  | 'firepower-1'
  | 'firepower-2'
  | 'bridge-2'
  | 'bridge-3'
  | 'ropeway-1'
  | 'ropeway-2';
export type BaseKind = 'hq' | 'outpost' | 'medium' | 'large';
export type TerrainKind = 'land' | 'riverbank' | 'river' | 'mountain';
export type MovementDomain = 'land' | 'air' | 'water';
export type EliminationReason = 'tickets' | 'forces';

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
}
export type Faction = FactionState;

export interface UnitState {
  readonly id: string;
  readonly factionId: FactionId;
  readonly kind: UnitKind;
  readonly hp: number;
  readonly maxHp: number;
  readonly cell: Cell;
  /** Excludes cell and begins with the next cell to reach. */
  readonly path: readonly Cell[];
  /** Completed ticks on the current two-tick edge. */
  readonly edgeProgress: number;
  readonly moveTicksPerCell?: number;
  readonly marchOrder?: MarchOrder | null;
  /** Retains a direct order while a newly closed crossing blocks its route. */
  readonly moveTarget?: Cell | null;
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
  readonly owner: FactionId | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly captureCandidate: FactionId | null;
  readonly captureTicks: number;
  /** Immutable original owner for HQs; null for neutral outposts. */
  readonly homeFactionId: FactionId | null;
}

export interface BaseMemory {
  readonly baseId: string;
  readonly owner: FactionId | null;
  readonly hp: number;
  readonly seenTick: number;
  readonly selfReportedLost: boolean;
}

export interface FactionKnowledge {
  readonly factionId: FactionId;
  /** Row-major maps. */
  readonly visible: readonly boolean[];
  readonly explored: readonly boolean[];
  readonly baseMemory: readonly BaseMemory[];
  readonly crossingMemory: readonly CrossingMemory[];
}

export interface MatchState {
  readonly schemaVersion: 9;
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
  readonly crossings: readonly CrossingState[];
  readonly knowledge: readonly FactionKnowledge[];
  readonly result: MatchResult | null;
}

export interface OwnUnitView extends UnitState {
  readonly control: 'own';
}

/** Enemy DTO intentionally excludes cell, route, destination, queue, and resources. */
export interface VisibleEnemyUnitView {
  readonly control: 'enemy';
  readonly id: string;
  readonly factionId: FactionId;
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
}

export interface RememberedBaseView {
  readonly visibility: 'remembered';
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly owner: FactionId | null;
  readonly hp: number;
  readonly seenTick: number;
  readonly selfReportedLost: boolean;
}

export interface VisibleBaseView {
  readonly visibility: 'visible';
  readonly id: string;
  readonly kind: BaseKind;
  readonly cell: Cell;
  readonly owner: FactionId | null;
  readonly hp: number;
  readonly maxHp: number;
  readonly captureCandidate: FactionId | null;
  readonly captureTicks: number;
}

export interface OwnedBaseView extends Omit<
  VisibleBaseView,
  'visibility' | 'owner'
> {
  readonly visibility: 'owned';
  readonly owner: FactionId;
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
  readonly visible: readonly boolean[];
  readonly explored: readonly boolean[];
  readonly ownFaction: OwnFactionView;
  readonly ownUnits: readonly OwnUnitView[];
  readonly visibleEnemies: readonly VisibleEnemyUnitView[];
  readonly bases: readonly BaseView[];
  readonly crossings: readonly CrossingView[];
}

export type Command =
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
      readonly type: 'enqueue-production';
      readonly baseId: string;
      readonly unitKind: UnitKind;
    }
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
  | 'UNIT_LIMIT'
  | 'QUEUE_FULL'
  | 'ALREADY_RESEARCHED'
  | 'PREREQUISITE_MISSING'
  | 'FACTION_ELIMINATED'
  | 'TARGET_NOT_FOUND'
  | 'INVALID_TARGET'
  | 'CROSSING_NOT_FOUND'
  | 'CROSSING_TAKEN'
  | 'CROSSING_BUSY'
  | 'CROSSING_NOT_OWNED'
  | 'CROSSING_NOT_ADJACENT'
  | 'CROSSING_UNIT_RESTRICTED'
  | 'CROSSING_RESEARCH_REQUIRED';

export type CommandResult =
  | { readonly ok: true; readonly state: MatchState }
  | {
      readonly ok: false;
      readonly state: MatchState;
      readonly reason: RejectCode;
    };
