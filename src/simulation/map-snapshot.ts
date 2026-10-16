import { MAP_DEFINITIONS } from './map-definitions';
import type {
  FactionId,
  GridMap,
  MapBasePlacement,
  MapUnitPlacement,
  TerrainKind,
} from './types';

type DefinitionId = keyof typeof MAP_DEFINITIONS;
type SeatId = 'A' | 'B' | 'C';

const TERRAIN_BY_CODE: Readonly<Record<string, TerrainKind>> = {
  '.': 'land',
  b: 'riverbank',
  r: 'river',
  m: 'mountain',
};

function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff)
    throw new RangeError('seed must be an unsigned 32-bit integer');
}

function decodeRows<T>(
  rows: readonly string[],
  width: number,
  decode: (code: string) => T,
): T[] {
  const values = rows.join('');
  if (rows.some((row) => row.length !== width))
    throw new Error('map definition row width does not match its dimensions');
  return Array.from(values, decode);
}

/** Builds a JSON-safe, complete map snapshot from one declarative map entry. */
export function createMapSnapshot(
  definitionId: DefinitionId,
  seed: number,
  assignFactionSeats = false,
): GridMap {
  validateSeed(seed);
  const definition = MAP_DEFINITIONS[definitionId];
  if (definition.terrainRows.length !== definition.height)
    throw new Error('map definition row count does not match its dimensions');

  const seats = ['A', 'B', 'C'] as const;
  const offset = assignFactionSeats ? seed % seats.length : 0;
  const seatForFaction: Record<FactionId, SeatId> = {
    A: seats[offset]!,
    B: seats[(offset + 1) % seats.length]!,
    C: seats[(offset + 2) % seats.length]!,
  };
  const factionForSeat: Record<SeatId, FactionId> = {
    A: 'A',
    B: 'B',
    C: 'C',
  };
  for (const faction of seats)
    factionForSeat[seatForFaction[faction]] = faction;
  const remap = (owner: FactionId | null): FactionId | null =>
    owner === null ? null : factionForSeat[owner];

  const basePlacements: MapBasePlacement[] = definition.basePlacements.map(
    (base) => ({
      ...base,
      factionId: remap(base.factionId),
      cell: { ...base.cell },
    }),
  );
  const initialUnitPlacements: MapUnitPlacement[] =
    definition.initialUnitPlacements.map((unit) => {
      const factionId = remap(unit.factionId)!;
      return {
        ...unit,
        id: `${factionId}${unit.id.slice(1)}`,
        factionId,
        cell: { ...unit.cell },
      };
    });
  const terrain = decodeRows(
    definition.terrainRows,
    definition.width,
    (code) => {
      const kind = TERRAIN_BY_CODE[code];
      if (kind === undefined) throw new Error(`invalid terrain code: ${code}`);
      return kind;
    },
  );
  const terrainLevel = decodeRows(
    definition.terrainLevelRows,
    definition.width,
    (code) => {
      const value = Number(code);
      if (!Number.isInteger(value) || value < 0 || value > 9)
        throw new Error(`invalid terrain level: ${code}`);
      return value;
    },
  );
  const blocked = decodeRows(
    definition.blockedRows,
    definition.width,
    (code) => {
      if (code !== '0' && code !== '1')
        throw new Error(`invalid blocked-cell code: ${code}`);
      return code === '1';
    },
  );
  const ports = definition.ports.map((port) => ({
    ...port,
    factionId: remap(port.factionId)!,
    cell: { ...port.cell },
    shore: { ...port.shore },
  }));
  const crossingSites = definition.crossingSites.map((site) => ({
    ...site,
    bankA: { ...site.bankA },
    bankB: { ...site.bankB },
    cells: site.cells.map((cell) => ({ ...cell })),
  }));
  const startAssignment = Object.fromEntries(
    seats.map((faction) => [
      faction,
      definition.startAssignment[seatForFaction[faction]],
    ]),
  ) as NonNullable<GridMap['startAssignment']>;
  const startPoints = Object.fromEntries(
    Object.entries(definition.startPoints).map(([position, cell]) => [
      position,
      { ...cell },
    ]),
  ) as NonNullable<GridMap['startPoints']>;

  return {
    width: definition.width,
    height: definition.height,
    definitionId: definition.id,
    definitionVersion: definition.version,
    startAssignment,
    startPoints,
    basePlacements,
    initialUnitPlacements,
    terrain,
    terrainLevel,
    crossingSites,
    ports,
    blocked,
  };
}

export const LEGACY_BASE_CELLS = MAP_DEFINITIONS.legacy40.basePlacements;
export const LEGACY_INITIAL_UNIT_PLACEMENTS =
  MAP_DEFINITIONS.legacy40.initialUnitPlacements;
