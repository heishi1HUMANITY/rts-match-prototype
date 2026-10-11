import { INITIAL_UNIT_PLACEMENTS, SCHEMA_VERSION } from './config';
import { createMap } from './map';
import type { Faction, MatchState, UnitState } from './types';

export type { Faction, FactionId } from './types';
export type {
  Cell,
  Command,
  CommandResult,
  GridMap,
  MatchState,
  Phase,
  RejectCode,
  UnitState,
} from './types';

export { applyCommand } from './commands';
export { findPath } from './pathfinding';
export { stepMatch } from './step';

/** Creates a fresh schema-v2 match with a seeded, connected map. */
export function createMatch(seed: number): MatchState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }

  const factions: Faction[] = [
    { id: 'A', controller: 'human' },
    { id: 'B', controller: 'bot' },
    { id: 'C', controller: 'bot' },
  ];
  const units: UnitState[] = INITIAL_UNIT_PLACEMENTS.map((placement) => ({
    id: placement.id,
    factionId: placement.factionId,
    cell: { x: placement.cell.x, y: placement.cell.y },
    path: [],
    edgeProgress: 0,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    seed,
    elapsedTicks: 0,
    factions,
    phase: 'ready',
    map: createMap(seed),
    units,
  };
}
