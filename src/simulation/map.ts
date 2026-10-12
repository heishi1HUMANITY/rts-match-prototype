import {
  BASE_CELLS,
  INITIAL_UNIT_PLACEMENTS,
  MAP_HEIGHT,
  MAP_WIDTH,
} from './config';
import { createRandom } from './random';
import type {
  ActiveCrossing,
  Cell,
  GridMap,
  MovementDomain,
  TerrainKind,
  UnitKind,
} from './types';

const indexOf = (x: number, y: number): number => y * MAP_WIDTH + x;
const inBounds = (x: number, y: number): boolean =>
  x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT;

const PORTS = [
  {
    id: 'PORT-A',
    factionId: 'A' as const,
    cell: { x: 15, y: 25 },
    shore: { x: 14, y: 26 },
  },
  {
    id: 'PORT-B',
    factionId: 'B' as const,
    cell: { x: 25, y: 25 },
    shore: { x: 26, y: 26 },
  },
  {
    id: 'PORT-C',
    factionId: 'C' as const,
    cell: { x: 20, y: 13 },
    shore: { x: 20, y: 12 },
  },
] as const;

function createTerrain(): { terrain: TerrainKind[]; levels: number[] } {
  const terrain = new Array<TerrainKind>(MAP_WIDTH * MAP_HEIGHT).fill('land');
  const levels = new Array<number>(terrain.length).fill(0);
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const dx = x + 0.5 - 20;
      const dy = y + 0.5 - 20;
      const radius = Math.hypot(dx, dy);
      const index = indexOf(x, y);
      // A closed multi-cell river ring ensures the central island is unreachable on foot.
      if (radius >= 6.2 && radius <= 8.0) {
        terrain[index] = 'river';
        levels[index] = 1;
        continue;
      }
      // Three short boundary rivers split the outer approaches. They stop short
      // of the capitals so the starting land component remains playable.
      if (radius > 8 && radius < 15) {
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const normalized = (angle + 360) % 360;
        const boundary = [0, 120, 240].some((bearing) => {
          const difference = Math.abs(normalized - bearing);
          const wrapped = Math.min(difference, 360 - difference);
          return wrapped < 2.2;
        });
        if (boundary) {
          terrain[index] = 'river';
          levels[index] = radius < 11 ? 2 : 3;
          continue;
        }
      }
      // Mountain ridges flank the ring. A few gaps remain as named crossing
      // anchors for future ropeways.
      if (radius >= 8 && radius <= 9.2) {
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const normalized = (angle + 360) % 360;
        const ridge = [55, 175, 295].some((bearing) => {
          const difference = Math.abs(normalized - bearing);
          return Math.min(difference, 360 - difference) < 6;
        });
        if (ridge) {
          terrain[index] = 'mountain';
          levels[index] = 1;
        }
      }
      if (radius >= 16.4 && radius <= 17.2 && (x === 20 || y === 20)) {
        terrain[index] = 'mountain';
        levels[index] = 2;
      }
    }
  }
  // Ports occupy a river tile beside a land cell, as a future water spawn.
  for (const port of PORTS) {
    terrain[indexOf(port.cell.x, port.cell.y)] = 'river';
    levels[indexOf(port.cell.x, port.cell.y)] = 1;
    terrain[indexOf(port.shore.x, port.shore.y)] = 'riverbank';
    levels[indexOf(port.shore.x, port.shore.y)] = 0;
  }
  return { terrain, levels };
}

function isLandTerrain(kind: TerrainKind | undefined): boolean {
  return kind === undefined || kind === 'land' || kind === 'riverbank';
}

function landReachable(
  blocked: readonly boolean[],
  terrain: readonly TerrainKind[],
  origin: Cell,
): boolean[] {
  const seen = new Uint8Array(blocked.length);
  const queue = new Int32Array(blocked.length);
  let head = 0;
  let tail = 0;
  const start = indexOf(origin.x, origin.y);
  seen[start] = 1;
  queue[tail++] = start;
  while (head < tail) {
    const index = queue[head++]!;
    const x = index % MAP_WIDTH;
    const y = Math.floor(index / MAP_WIDTH);
    for (const [nx, ny] of [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ] as const) {
      if (!inBounds(nx, ny)) continue;
      const next = indexOf(nx, ny);
      if (seen[next] || blocked[next] || !isLandTerrain(terrain[next]))
        continue;
      seen[next] = 1;
      queue[tail++] = next;
    }
  }
  return Array.from(seen, Boolean);
}

function crossingSites() {
  return [
    {
      id: 'CROSS-RING-N',
      tier: 'bridge-1' as const,
      bankA: { x: 19, y: 11 },
      bankB: { x: 19, y: 14 },
      cells: [
        { x: 19, y: 12 },
        { x: 19, y: 13 },
      ],
    },
    {
      id: 'CROSS-RING-SE',
      tier: 'bridge-1' as const,
      bankA: { x: 28, y: 20 },
      bankB: { x: 25, y: 20 },
      cells: [
        { x: 27, y: 20 },
        { x: 26, y: 20 },
      ],
    },
    {
      id: 'CROSS-RING-SW',
      tier: 'bridge-1' as const,
      bankA: { x: 11, y: 20 },
      bankB: { x: 14, y: 20 },
      cells: [
        { x: 12, y: 20 },
        { x: 13, y: 20 },
      ],
    },
    {
      id: 'CROSS-MTN-E',
      tier: 'ropeway-1' as const,
      bankA: { x: 22, y: 27 },
      bankB: { x: 24, y: 27 },
      cells: [{ x: 23, y: 27 }],
    },
    {
      id: 'CROSS-MTN-OUT',
      tier: 'ropeway-2' as const,
      bankA: { x: 20, y: 4 },
      bankB: { x: 20, y: 2 },
      cells: [{ x: 20, y: 3 }],
    },
    {
      id: 'CROSS-BORDER-000-B2',
      tier: 'bridge-2' as const,
      bankA: { x: 29, y: 18 },
      bankB: { x: 29, y: 21 },
      cells: [
        { x: 29, y: 19 },
        { x: 29, y: 20 },
      ],
    },
    {
      id: 'CROSS-BORDER-000-B3',
      tier: 'bridge-3' as const,
      bankA: { x: 33, y: 18 },
      bankB: { x: 33, y: 21 },
      cells: [
        { x: 33, y: 19 },
        { x: 33, y: 20 },
      ],
    },
    {
      id: 'CROSS-BORDER-120-B2',
      tier: 'bridge-2' as const,
      bankA: { x: 16, y: 27 },
      bankB: { x: 14, y: 27 },
      cells: [{ x: 15, y: 27 }],
    },
    {
      id: 'CROSS-BORDER-120-B3',
      tier: 'bridge-3' as const,
      bankA: { x: 14, y: 30 },
      bankB: { x: 12, y: 30 },
      cells: [{ x: 13, y: 30 }],
    },
    {
      id: 'CROSS-BORDER-240-B2',
      tier: 'bridge-2' as const,
      bankA: { x: 16, y: 12 },
      bankB: { x: 14, y: 12 },
      cells: [{ x: 15, y: 12 }],
    },
    {
      id: 'CROSS-BORDER-240-B3',
      tier: 'bridge-3' as const,
      bankA: { x: 14, y: 8 },
      bankB: { x: 12, y: 8 },
      cells: [{ x: 13, y: 8 }],
    },
  ];
}

export function createMap(seed: number): GridMap {
  const random = createRandom(seed);
  const { terrain, levels } = createTerrain();
  const plannedCrossings = crossingSites();
  // Keep a land apron around every capital spawn.
  for (const { cell } of INITIAL_UNIT_PLACEMENTS) {
    for (let y = cell.y - 1; y <= cell.y + 1; y += 1) {
      for (let x = cell.x - 1; x <= cell.x + 1; x += 1) {
        if (!inBounds(x, y)) continue;
        terrain[indexOf(x, y)] = 'land';
        levels[indexOf(x, y)] = 0;
      }
    }
  }
  for (const { cell } of BASE_CELLS) {
    terrain[indexOf(cell.x, cell.y)] = 'land';
    levels[indexOf(cell.x, cell.y)] = 0;
  }
  for (const crossing of plannedCrossings) {
    for (const bank of [crossing.bankA, crossing.bankB]) {
      terrain[indexOf(bank.x, bank.y)] = 'land';
      levels[indexOf(bank.x, bank.y)] = 0;
    }
    const terrainKind = crossing.tier.startsWith('bridge')
      ? 'river'
      : 'mountain';
    for (const cell of crossing.cells) {
      terrain[indexOf(cell.x, cell.y)] = terrainKind;
      levels[indexOf(cell.x, cell.y)] = 1;
    }
  }
  const blocked = terrain.map((kind) => !isLandTerrain(kind));
  const protectedCells = new Set<string>();
  for (const { cell } of INITIAL_UNIT_PLACEMENTS) {
    for (let y = cell.y - 2; y <= cell.y + 2; y += 1)
      for (let x = cell.x - 2; x <= cell.x + 2; x += 1)
        protectedCells.add(`${x},${y}`);
  }
  for (const base of BASE_CELLS.filter(({ factionId }) => factionId !== null)) {
    const spawn = INITIAL_UNIT_PLACEMENTS.find(
      (placement) => placement.factionId === base.factionId,
    )!.cell;
    for (
      let y = Math.min(spawn.y, base.cell.y);
      y <= Math.max(spawn.y, base.cell.y);
      y += 1
    ) {
      for (
        let x = Math.min(spawn.x, base.cell.x);
        x <= Math.max(spawn.x, base.cell.x);
        x += 1
      ) {
        protectedCells.add(`${x},${y}`);
      }
    }
  }
  for (const { cell } of BASE_CELLS) {
    protectedCells.add(`${cell.x},${cell.y}`);
  }
  for (const port of PORTS) {
    protectedCells.add(`${port.cell.x},${port.cell.y}`);
    protectedCells.add(`${port.shore.x},${port.shore.y}`);
  }
  for (const crossing of plannedCrossings) {
    for (const cell of [crossing.bankA, crossing.bankB])
      protectedCells.add(`${cell.x},${cell.y}`);
  }
  const initialReachable = landReachable(
    blocked,
    terrain,
    INITIAL_UNIT_PLACEMENTS[0]!.cell,
  );
  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      const index = indexOf(x, y);
      if (!initialReachable[index] || protectedCells.has(`${x},${y}`)) continue;
      if (terrain[index] !== 'land') continue;
      if (random.nextUint32() % 100 >= 7) continue;
      blocked[index] = true;
      const reachable = landReachable(
        blocked,
        terrain,
        INITIAL_UNIT_PLACEMENTS[0]!.cell,
      );
      const required = [
        ...INITIAL_UNIT_PLACEMENTS.map(({ cell }) => cell),
        ...BASE_CELLS.filter(({ factionId }) => factionId !== null).map(
          ({ cell }) => cell,
        ),
      ];
      if (required.some((cell) => !reachable[indexOf(cell.x, cell.y)]))
        blocked[index] = false;
    }
  }
  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    terrainLevel: levels,
    crossingSites: plannedCrossings,
    ports: PORTS.map((port) => ({
      ...port,
      cell: { ...port.cell },
      shore: { ...port.shore },
    })),
    blocked,
  };
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
export function getReachableCells(map: GridMap): ReadonlySet<string> {
  const seen = new Set<number>();
  const queue: number[] = [];
  const origin = INITIAL_UNIT_PLACEMENTS[0]!.cell;
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
