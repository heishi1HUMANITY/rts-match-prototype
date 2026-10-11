/** Plain, serializable state. Browser and renderer dependencies belong elsewhere. */
export type FactionId = 'A' | 'B' | 'C';

export type Phase = 'ready' | 'running' | 'paused';

export interface Faction {
  readonly id: FactionId;
  readonly controller: 'human' | 'bot';
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

export interface UnitState {
  readonly id: string;
  readonly factionId: FactionId;
  readonly cell: Cell;
  /** Excludes cell and begins with the next cell to reach. */
  readonly path: readonly Cell[];
  /** Completed ticks on the current two-tick edge. */
  readonly edgeProgress: 0 | 1;
}

export interface MatchState {
  readonly schemaVersion: 2;
  readonly seed: number;
  readonly elapsedTicks: number;
  readonly factions: readonly Faction[];
  readonly phase: Phase;
  readonly map: GridMap;
  readonly units: readonly UnitState[];
}

export type Command =
  | { readonly type: 'start' }
  | { readonly type: 'pause' }
  | { readonly type: 'resume' }
  | { readonly type: 'move'; readonly unitId: string; readonly target: Cell }
  | { readonly type: 'stop'; readonly unitId: string };

export type RejectCode =
  | 'INVALID_COMMAND'
  | 'INVALID_ACTOR'
  | 'INVALID_PHASE'
  | 'UNIT_NOT_FOUND'
  | 'NOT_OWNER'
  | 'OUT_OF_BOUNDS'
  | 'BLOCKED'
  | 'UNREACHABLE';

export type CommandResult =
  | { readonly ok: true; readonly state: MatchState }
  | {
      readonly ok: false;
      readonly state: MatchState;
      readonly reason: RejectCode;
    };
