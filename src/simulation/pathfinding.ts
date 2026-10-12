import { canTraverse } from './map';
import type {
  ActiveCrossing,
  Cell,
  CombatantId,
  GridMap,
  MovementDomain,
  UnitKind,
} from './types';

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

/** Returns the deterministic shortest four-way route, excluding `from`. */
export function findPath(
  map: GridMap,
  from: Cell,
  to: Cell,
  options: {
    readonly factionId?: CombatantId;
    readonly domain?: MovementDomain;
    readonly crossings?: readonly ActiveCrossing[];
    readonly unitKind?: UnitKind;
    readonly allowBlockedStart?: boolean;
  } = {},
): readonly Cell[] | null {
  if (
    map.width <= 0 ||
    map.height <= 0 ||
    map.blocked.length !== map.width * map.height ||
    (!options.allowBlockedStart && !canTraverse(map, from, options)) ||
    !canTraverse(map, to, options)
  ) {
    return null;
  }
  if (from.x === to.x && from.y === to.y) return [];
  if (options.domain === 'air') return linePath(from, to);

  const startIndex = from.y * map.width + from.x;
  const targetIndex = to.y * map.width + to.x;
  const parents = new Int32Array(map.blocked.length).fill(-1);
  const visited = new Uint8Array(map.blocked.length);
  const queue = new Int32Array(map.blocked.length);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIndex;
  visited[startIndex] = 1;

  while (head < tail && !visited[targetIndex]) {
    const index = queue[head++];
    if (index === undefined) continue;
    const x = index % map.width;
    const y = Math.floor(index / map.width);
    for (const direction of DIRECTIONS) {
      const nextX = x + direction.x;
      const nextY = y + direction.y;
      const nextCell = { x: nextX, y: nextY };
      if (!canTraverse(map, nextCell, options)) continue;
      const nextIndex = nextY * map.width + nextX;
      if (visited[nextIndex]) continue;
      visited[nextIndex] = 1;
      parents[nextIndex] = index;
      queue[tail++] = nextIndex;
      if (nextIndex === targetIndex) break;
    }
  }

  if (!visited[targetIndex]) return null;
  const reversed: Cell[] = [];
  for (let index = targetIndex; index !== startIndex; ) {
    reversed.push({ x: index % map.width, y: Math.floor(index / map.width) });
    const parent = parents[index];
    if (parent === undefined || parent < 0) return null;
    index = parent;
  }
  reversed.reverse();
  return reversed;
}

/** Deterministic integer Bresenham path for aircraft; both endpoints are excluded/included as usual. */
function linePath(from: Cell, to: Cell): readonly Cell[] {
  const points: Cell[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const sx = from.x < to.x ? 1 : -1;
  const dy = -Math.abs(to.y - from.y);
  const sy = from.y < to.y ? 1 : -1;
  let error = dx + dy;
  while (x !== to.x || y !== to.y) {
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += sx;
    }
    if (twice <= dx) {
      error += dx;
      y += sy;
    }
    points.push({ x, y });
  }
  return points;
}
