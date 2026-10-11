import {
  BLOCKED_CELL_PERCENT,
  INITIAL_UNIT_PLACEMENTS,
  ISOLATED_CELL,
  MAP_HEIGHT,
  MAP_WIDTH,
} from './config';
import { createRandom } from './random';
import type { Cell, GridMap } from './types';

const indexOf = (x: number, y: number): number => y * MAP_WIDTH + x;

function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT;
}

function reserveCells(): Uint8Array {
  const reserved = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  const reserve = (x: number, y: number): void => {
    if (isInBounds(x, y)) reserved[indexOf(x, y)] = 1;
  };

  // Outer rim.
  for (let x = 0; x < MAP_WIDTH; x += 1) {
    reserve(x, 0);
    reserve(x, MAP_HEIGHT - 1);
  }
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    reserve(0, y);
    reserve(MAP_WIDTH - 1, y);
  }

  // Keep each spawn and its Chebyshev-radius-two neighborhood clear.
  for (const { cell } of INITIAL_UNIT_PLACEMENTS) {
    for (let y = cell.y - 2; y <= cell.y + 2; y += 1) {
      for (let x = cell.x - 2; x <= cell.x + 2; x += 1) reserve(x, y);
    }
  }

  for (let i = 0; i < MAP_WIDTH; i += 1) {
    reserve(20, i);
    reserve(i, 20);
  }

  // The test island and its one-cell exterior are fixed.
  for (let y = 8; y <= 12; y += 1) {
    for (let x = 28; x <= 32; x += 1) reserve(x, y);
  }
  return reserved;
}

function addFixedIsland(blocked: boolean[]): void {
  for (let y = ISOLATED_CELL.y - 1; y <= ISOLATED_CELL.y + 1; y += 1) {
    for (let x = ISOLATED_CELL.x - 1; x <= ISOLATED_CELL.x + 1; x += 1) {
      if (x !== ISOLATED_CELL.x || y !== ISOLATED_CELL.y) {
        blocked[indexOf(x, y)] = true;
      }
    }
  }
}

function allWalkableCellsReachable(blocked: readonly boolean[]): boolean {
  const startIndex = indexOf(20, 20);
  const seen = new Uint8Array(blocked.length);
  const queue = new Int32Array(blocked.length);
  let head = 0;
  let tail = 0;
  if (blocked[startIndex]) return false;
  seen[startIndex] = 1;
  queue[tail++] = startIndex;

  while (head < tail) {
    const index = queue[head++];
    if (index === undefined) continue;
    const x = index % MAP_WIDTH;
    const y = Math.floor(index / MAP_WIDTH);
    const neighbors = [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ] as const;
    for (const [nx, ny] of neighbors) {
      if (!isInBounds(nx, ny)) continue;
      const next = indexOf(nx, ny);
      if (blocked[next] || seen[next]) continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }

  for (let index = 0; index < blocked.length; index += 1) {
    if (index === indexOf(ISOLATED_CELL.x, ISOLATED_CELL.y)) continue;
    if (!blocked[index] && !seen[index]) return false;
  }
  return true;
}

export function createMap(seed: number): GridMap {
  const random = createRandom(seed);
  const blocked = new Array<boolean>(MAP_WIDTH * MAP_HEIGHT).fill(false);
  addFixedIsland(blocked);
  const reserved = reserveCells();

  // The RNG advances exactly once for every unreserved cell in row-major order.
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const index = indexOf(x, y);
      if (reserved[index]) continue;
      const candidate = random.nextUint32() % 100 < BLOCKED_CELL_PERCENT;
      if (!candidate) continue;
      blocked[index] = true;
      if (!allWalkableCellsReachable(blocked)) blocked[index] = false;
    }
  }

  return { width: MAP_WIDTH, height: MAP_HEIGHT, blocked };
}

export function isCellBlocked(map: GridMap, cell: Cell): boolean {
  if (
    !Number.isInteger(cell.x) ||
    !Number.isInteger(cell.y) ||
    cell.x < 0 ||
    cell.y < 0 ||
    cell.x >= map.width ||
    cell.y >= map.height
  ) {
    return true;
  }
  return map.blocked[cell.y * map.width + cell.x] ?? true;
}

/** Flood fill from (20,20), excluding the intentionally isolated test cell. */
export function getReachableCells(map: GridMap): ReadonlySet<string> {
  const seen = new Set<number>();
  const queue: number[] = [];
  const start = 20 * map.width + 20;
  if (isCellBlocked(map, { x: 20, y: 20 })) return new Set();
  seen.add(start);
  queue.push(start);
  const directions = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const;
  for (let head = 0; head < queue.length; head += 1) {
    const index = queue[head];
    if (index === undefined) continue;
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
  seen.delete(ISOLATED_CELL.y * map.width + ISOLATED_CELL.x);
  return new Set(
    [...seen].map(
      (index) => `${index % map.width},${Math.floor(index / map.width)}`,
    ),
  );
}
