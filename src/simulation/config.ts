import type { Cell, FactionId } from './types';

export const SCHEMA_VERSION = 2 as const;
export const MAP_WIDTH = 40;
export const MAP_HEIGHT = 40;
export const BLOCKED_CELL_PERCENT = 10;
export const MOVE_TICKS_PER_CELL = 2;
export const TICK_DURATION_MS = 100;

export const ISOLATED_CELL: Cell = { x: 30, y: 10 };

export const INITIAL_UNIT_PLACEMENTS: readonly {
  readonly id: string;
  readonly factionId: FactionId;
  readonly cell: Cell;
}[] = [
  { id: 'A-01', factionId: 'A', cell: { x: 6, y: 33 } },
  { id: 'A-02', factionId: 'A', cell: { x: 7, y: 33 } },
  { id: 'B-01', factionId: 'B', cell: { x: 33, y: 33 } },
  { id: 'B-02', factionId: 'B', cell: { x: 32, y: 33 } },
  { id: 'C-01', factionId: 'C', cell: { x: 20, y: 6 } },
  { id: 'C-02', factionId: 'C', cell: { x: 21, y: 6 } },
];
