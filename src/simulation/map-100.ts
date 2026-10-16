import { BASE_CELLS, INITIAL_UNIT_PLACEMENTS } from './config';
import { createMap as createLegacyMap, terrainAt } from './map';
import type {
  Cell,
  FactionId,
  GridMap,
  MapBasePlacement,
  MapUnitPlacement,
  TerrainKind,
} from './types';

const SIZE = 100;
const SOURCE_SIZE = 40;
const SCALE = SIZE / SOURCE_SIZE;
// The old generator performs reachability checks for each candidate obstacle;
// calculate the frozen reference once when the 100-cell definition is requested.
let legacyReference: GridMap | null = null;
const assignedMaps = new Map<number, GridMap>();

/** Map discrete cells by their covered area; each 40-cell axis becomes 2/3-cell bands. */
function cellSpan(value: number): readonly [number, number] {
  return [Math.floor(value * SCALE), Math.ceil((value + 1) * SCALE)];
}

/** Point anchors use nearest-integer rounding; site cells are rebuilt between rounded banks. */
function scalePoint(cell: Cell): Cell {
  return { x: Math.round(cell.x * SCALE), y: Math.round(cell.y * SCALE) };
}

function expand<T>(source: readonly T[]): T[] {
  const output = new Array<T>(SIZE * SIZE);
  for (let y = 0; y < SOURCE_SIZE; y += 1) {
    const [y0, y1] = cellSpan(y);
    for (let x = 0; x < SOURCE_SIZE; x += 1) {
      const value = source[y * SOURCE_SIZE + x]!;
      const [x0, x1] = cellSpan(x);
      for (let yy = y0; yy < y1; yy += 1)
        for (let xx = x0; xx < x1; xx += 1) output[yy * SIZE + xx] = value;
    }
  }
  return output;
}

export function createMap100(seed: number): GridMap {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff)
    throw new RangeError('seed must be an unsigned 32-bit integer');
  const assignmentIndex = seed % 3;
  const cached = assignedMaps.get(assignmentIndex);
  if (cached) return cached;

  // Seed 0 freezes the old seed-generated obstacle layout. Future seed changes only seat assignment.
  const source = (legacyReference ??= createLegacyMap(0));
  const seats = ['A', 'B', 'C'] as const;
  const seatForFaction = {
    A: seats[assignmentIndex]!,
    B: seats[(assignmentIndex + 1) % 3]!,
    C: seats[(assignmentIndex + 2) % 3]!,
  } as const;
  const factionForSeat = Object.fromEntries(
    Object.entries(seatForFaction).map(([faction, seat]) => [seat, faction]),
  ) as Record<FactionId, FactionId>;
  const remap = (owner: FactionId | null): FactionId | null =>
    owner === null ? null : factionForSeat[owner];

  const basePlacements: MapBasePlacement[] = BASE_CELLS.map((base) => ({
    ...base,
    factionId: remap(base.factionId),
    cell: scalePoint(base.cell),
  }));
  const initialUnitPlacements: MapUnitPlacement[] = INITIAL_UNIT_PLACEMENTS.map(
    (unit) => {
      const factionId = remap(unit.factionId)!;
      return {
        ...unit,
        id: `${factionId}${unit.id.slice(1)}`,
        factionId,
        cell: scalePoint(unit.cell),
      };
    },
  );
  const ports = (source.ports ?? []).map((port) => {
    const cell = scalePoint(port.cell);
    const dx = port.shore.x - port.cell.x;
    const dy = port.shore.y - port.cell.y;
    const shore =
      Math.abs(dx) >= Math.abs(dy)
        ? { x: cell.x + Math.sign(dx), y: cell.y }
        : { x: cell.x, y: cell.y + Math.sign(dy) };
    return { ...port, factionId: remap(port.factionId)!, cell, shore };
  });
  const crossingSites = (source.crossingSites ?? []).map((site) => {
    const bankA = scalePoint(site.bankA);
    const bankB = scalePoint(site.bankB);
    const cells: Cell[] = [];
    if (bankA.x === bankB.x) {
      for (
        let y = Math.min(bankA.y, bankB.y) + 1;
        y < Math.max(bankA.y, bankB.y);
        y += 1
      )
        cells.push({ x: bankA.x, y });
    } else if (bankA.y === bankB.y) {
      for (
        let x = Math.min(bankA.x, bankB.x) + 1;
        x < Math.max(bankA.x, bankB.x);
        x += 1
      )
        cells.push({ x, y: bankA.y });
    }
    return { ...site, bankA, bankB, cells };
  });

  const terrain = expand(
    source.terrain ?? new Array<TerrainKind>(SOURCE_SIZE ** 2).fill('land'),
  );
  const terrainLevel = expand(
    source.terrainLevel ?? new Array<number>(SOURCE_SIZE ** 2).fill(0),
  );
  const blocked = expand(source.blocked);
  const setTerrain = (cell: Cell, kind: TerrainKind, level = 0): void => {
    const index = cell.y * SIZE + cell.x;
    terrain[index] = kind;
    terrainLevel[index] = level;
    blocked[index] = kind !== 'land' && kind !== 'riverbank';
  };

  for (const base of basePlacements) setTerrain(base.cell, 'land');
  for (const unit of initialUnitPlacements) setTerrain(unit.cell, 'land');
  for (const port of ports) {
    setTerrain(port.cell, 'river', 1);
    setTerrain(port.shore, 'riverbank');
  }
  for (const site of crossingSites) {
    setTerrain(site.bankA, 'land');
    setTerrain(site.bankB, 'land');
    const kind = site.tier.startsWith('bridge') ? 'river' : 'mountain';
    for (const cell of site.cells) setTerrain(cell, kind, 1);
  }

  const startAssignment = Object.fromEntries(
    Object.entries(seatForFaction).map(([faction, seat]) => [
      faction,
      seat === 'A' ? 'south-west' : seat === 'B' ? 'south-east' : 'north',
    ]),
  ) as NonNullable<GridMap['startAssignment']>;

  const map: GridMap = {
    width: SIZE,
    height: SIZE,
    definitionId: 'ring-three-fronts',
    definitionVersion: 1,
    startAssignment,
    basePlacements,
    initialUnitPlacements,
    terrain,
    terrainLevel,
    crossingSites,
    ports,
    blocked,
  };

  // Guard the scaling contract at generation time so bad anchors never enter saved state.
  for (const site of crossingSites) {
    if (
      terrainAt(map, site.bankA) !== 'land' ||
      terrainAt(map, site.bankB) !== 'land' ||
      site.cells.some(
        (cell) =>
          terrainAt(map, cell) !==
          (site.tier.startsWith('bridge') ? 'river' : 'mountain'),
      )
    )
      throw new Error(`invalid crossing geometry: ${site.id}`);
  }
  assignedMaps.set(assignmentIndex, map);
  return map;
}
