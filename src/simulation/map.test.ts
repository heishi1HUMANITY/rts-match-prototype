import { describe, expect, it } from 'vitest';
import {
  BASE_CELLS,
  INITIAL_UNIT_PLACEMENTS,
  MAP_HEIGHT,
  MAP_WIDTH,
} from './config';
import {
  canTraverse,
  createMap,
  getReachableCells,
  isCellBlocked,
  terrainAt,
} from './map';
import { findPath } from './pathfinding';

describe('seeded terrain map generation', () => {
  it.each([0, 42, 43, 0xffffffff])(
    'reproduces geography and local access for seed %s',
    (seed) => {
      const map = createMap(seed);
      expect(map).toEqual(createMap(seed));
      expect(map.width).toBe(MAP_WIDTH);
      expect(map.height).toBe(MAP_HEIGHT);
      expect(map.blocked).toHaveLength(MAP_WIDTH * MAP_HEIGHT);
      expect(map.terrain).toHaveLength(MAP_WIDTH * MAP_HEIGHT);
      expect(map.terrainLevel).toHaveLength(MAP_WIDTH * MAP_HEIGHT);
      expect(map.crossingSites?.length).toBeGreaterThan(0);
      expect(map.ports).toHaveLength(3);

      const reachable = getReachableCells(map);
      for (const placement of INITIAL_UNIT_PLACEMENTS) {
        expect(isCellBlocked(map, placement.cell)).toBe(false);
        expect(reachable.has(`${placement.cell.x},${placement.cell.y}`)).toBe(
          true,
        );
      }
      for (const base of BASE_CELLS.filter(
        ({ factionId }) => factionId !== null,
      )) {
        expect(isCellBlocked(map, base.cell)).toBe(false);
        expect(reachable.has(`${base.cell.x},${base.cell.y}`)).toBe(true);
      }
      const homeDistances = (['A', 'B', 'C'] as const).map((factionId) => {
        const spawn = INITIAL_UNIT_PLACEMENTS.find(
          (placement) => placement.factionId === factionId,
        )!.cell;
        const home = BASE_CELLS.find(
          (base) => base.id === `HOME-${factionId}`,
        )!.cell;
        return findPath(map, spawn, home)!.length;
      });
      expect(Math.max(...homeDistances) - Math.min(...homeDistances)).toBe(0);
      expect(terrainAt(map, { x: 20, y: 20 })).toBe('land');
      expect(reachable.has('20,20')).toBe(false);
      expect(
        map.ports?.every(
          ({ cell, shore }) =>
            terrainAt(map, cell) === 'river' &&
            terrainAt(map, shore) === 'riverbank',
        ),
      ).toBe(true);
      expect(canTraverse(map, { x: 20, y: 20 }, { domain: 'air' })).toBe(true);
    },
  );

  it('distinguishes land, river, mountain, air and water travel', () => {
    const map = createMap(42);
    const river = map.terrain!.findIndex((kind) => kind === 'river');
    const mountain = map.terrain!.findIndex((kind) => kind === 'mountain');
    const riverCell = {
      x: river % MAP_WIDTH,
      y: Math.floor(river / MAP_WIDTH),
    };
    const mountainCell = {
      x: mountain % MAP_WIDTH,
      y: Math.floor(mountain / MAP_WIDTH),
    };
    expect(canTraverse(map, riverCell, { domain: 'land' })).toBe(false);
    expect(canTraverse(map, riverCell, { domain: 'water' })).toBe(true);
    expect(canTraverse(map, mountainCell, { domain: 'land' })).toBe(false);
    expect(canTraverse(map, mountainCell, { domain: 'water' })).toBe(false);
    expect(canTraverse(map, mountainCell, { domain: 'air' })).toBe(true);
    const ports = map.ports!;
    for (const port of ports) {
      expect(
        findPath(map, ports[0]!.cell, port.cell, { domain: 'water' }),
      ).not.toBeNull();
    }
    const crossing = map.crossingSites![1]!;
    const pathWithoutRights = findPath(map, crossing.bankA, crossing.bankB);
    expect(pathWithoutRights).toBeNull();
    expect(
      findPath(map, crossing.bankA, crossing.bankB, {
        factionId: 'A',
        crossings: [{ ...crossing, owner: 'A', complete: true }],
      }),
    ).not.toBeNull();
    expect(
      findPath(map, crossing.bankA, crossing.bankB, {
        factionId: 'B',
        crossings: [{ ...crossing, owner: 'A', complete: true }],
      }),
    ).toBeNull();
  });

  it('rejects invalid seeds', () => {
    for (const seed of [-1, 1.5, NaN, Infinity, 0x100000000]) {
      expect(() => createMap(seed)).toThrow(RangeError);
    }
  });
});
