import {
  LEGACY_INITIAL_UNIT_PLACEMENTS,
  createMapSnapshot,
} from './map-snapshot';
import type {
  ActiveCrossing,
  Cell,
  GridMap,
  MovementDomain,
  TerrainKind,
  UnitKind,
} from './types';

export function createMap(seed: number): GridMap {
  return createMapSnapshot('legacy40', seed);
}

function isLandTerrain(kind: TerrainKind | undefined): boolean {
  return kind === undefined || kind === 'land' || kind === 'riverbank';
}
export function terrainAt(map: GridMap, cell: Cell): TerrainKind | null {
  if (
    !Number.isInteger(cell.x) ||
    !Number.isInteger(cell.y) ||
    cell.x < 0 ||
    cell.y < 0 ||
    cell.x >= map.width ||
    cell.y >= map.height
  )
    return null;
  return (
    map.terrain?.[cell.y * map.width + cell.x] ??
    (map.blocked[cell.y * map.width + cell.x] ? 'mountain' : 'land')
  );
}

export function isCellBlocked(map: GridMap, cell: Cell): boolean {
  return !canTraverse(map, cell, { domain: 'land' });
}

export function canTraverse(
  map: GridMap,
  cell: Cell,
  options: {
    readonly domain?: MovementDomain;
    readonly factionId?: string;
    readonly crossings?: readonly ActiveCrossing[];
    readonly unitKind?: UnitKind;
  } = {},
): boolean {
  if (
    !Number.isInteger(cell.x) ||
    !Number.isInteger(cell.y) ||
    cell.x < 0 ||
    cell.y < 0 ||
    cell.x >= map.width ||
    cell.y >= map.height
  )
    return false;
  const index = cell.y * map.width + cell.x;
  if (index >= map.blocked.length) return false;
  const kind = terrainAt(map, cell);
  const domain = options.domain ?? 'land';
  if (domain === 'air') return true;
  if (domain === 'water') return kind === 'river';
  const crossing = options.crossings?.find(
    (entry) =>
      (entry.owner === options.factionId || options.factionId === 'local') &&
      (options.unitKind === undefined ||
        entry.allowedUnitKinds.includes(options.unitKind)) &&
      entry.cells.some(({ x, y }) => x === cell.x && y === cell.y),
  );
  if (crossing) return true;
  return isLandTerrain(kind ?? undefined) && !map.blocked[index];
}

/** Flood fill over land, useful for validating local access without crossing islands. */
export function getReachableCells(
  map: GridMap,
  origin: Cell = LEGACY_INITIAL_UNIT_PLACEMENTS[0]!.cell,
): ReadonlySet<string> {
  const seen = new Set<number>();
  const queue: number[] = [];
  const start = origin.y * map.width + origin.x;
  if (isCellBlocked(map, origin)) return new Set();
  seen.add(start);
  queue.push(start);
  const directions = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head]!;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const [dx, dy] of directions) {
      const nextCell = { x: x + dx, y: y + dy };
      if (isCellBlocked(map, nextCell)) continue;
      const next = nextCell.y * map.width + nextCell.x;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return new Set(
    [...seen].map(
      (index) => `${index % map.width},${Math.floor(index / map.width)}`,
    ),
  );
}
