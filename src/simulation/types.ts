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
  | 'f02-pursuit';
export type UnitKind = 'assault' | 'scout';
export type ResearchId = 'firepower-1' | 'firepower-2';
export type BaseKind = 'hq' | 'outpost';
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
  /** Row-major; true means terrain blocks movement. */
  readonly blocked: readonly boolean[];
}

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
}

export interface MatchState {
  readonly schemaVersion: 7;
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
  | { readonly type: 'start-research'; readonly researchId: ResearchId | null };

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
  | 'INVALID_TARGET';

export type CommandResult =
  | { readonly ok: true; readonly state: MatchState }
  | {
      readonly ok: false;
      readonly state: MatchState;
      readonly reason: RejectCode;
    };
