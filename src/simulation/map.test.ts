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
  it.each([0, 1, 2, 42, 43, 0xffffffff])(
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

      for (const factionId of ['A', 'B', 'C'] as const) {
        const spawn = INITIAL_UNIT_PLACEMENTS.find(
          (placement) => placement.factionId === factionId,
        )!.cell;
        const factionReachable = getReachableCells(map, spawn);
        for (const placement of INITIAL_UNIT_PLACEMENTS.filter(
          (p) => p.factionId === factionId,
        )) {
          expect(isCellBlocked(map, placement.cell)).toBe(false);
          expect(
            factionReachable.has(`${placement.cell.x},${placement.cell.y}`),
          ).toBe(true);
        }
        for (const base of BASE_CELLS.filter(
          (b) => b.factionId === factionId,
        )) {
          expect(isCellBlocked(map, base.cell)).toBe(false);
          expect(factionReachable.has(`${base.cell.x},${base.cell.y}`)).toBe(
            true,
          );
        }
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
      expect(getReachableCells(map).has('20,20')).toBe(false);
      expect(
        map.ports?.every(
          ({ cell, shore }) =>
            terrainAt(map, cell) === 'river' &&
            terrainAt(map, shore) === 'riverbank',
        ),
      ).toBe(true);
      expect(canTraverse(map, { x: 20, y: 20 }, { domain: 'air' })).toBe(true);

      // F16-02: 橋なしで他陣営首都へ陸路なし
      const hqA = BASE_CELLS.find((b) => b.id === 'HQ-A')!.cell;
      const hqB = BASE_CELLS.find((b) => b.id === 'HQ-B')!.cell;
      const hqC = BASE_CELLS.find((b) => b.id === 'HQ-C')!.cell;

      expect(findPath(map, hqA, hqB)).toBeNull();
      expect(findPath(map, hqA, hqC)).toBeNull();
      expect(findPath(map, hqB, hqC)).toBeNull();

      // F16-02: bridge-2 完成で隣接陣営へ到達可
      const b120 = map.crossingSites!.find(
        (c) => c.id === 'CROSS-BORDER-120-B2',
      )!;
      const b240 = map.crossingSites!.find(
        (c) => c.id === 'CROSS-BORDER-240-B2',
      )!;
      const b000 = map.crossingSites!.find(
        (c) => c.id === 'CROSS-BORDER-000-B2',
      )!;

      const pathAB = findPath(map, hqA, hqB, {
        factionId: 'A',
        crossings: [
          { ...b120, owner: 'A', allowedUnitKinds: ['assault', 'scout'] },
        ],
      });
      expect(pathAB).not.toBeNull();

      const pathAC = findPath(map, hqA, hqC, {
        factionId: 'A',
        crossings: [
          { ...b240, owner: 'A', allowedUnitKinds: ['assault', 'scout'] },
        ],
      });
      expect(pathAC).not.toBeNull();

      const pathBC = findPath(map, hqB, hqC, {
        factionId: 'B',
        crossings: [
          { ...b000, owner: 'B', allowedUnitKinds: ['assault', 'scout'] },
        ],
      });
      expect(pathBC).not.toBeNull();

      // F16-02: 首都間の最短陸路が全組で等しい
      const allActive = map.crossingSites!.map((c) => ({
        ...c,
        owner: 'A' as const,
        allowedUnitKinds: ['assault', 'scout'] as const,
      }));
      const fullAB = findPath(map, hqA, hqB, {
        factionId: 'A',
        crossings: allActive,
      })!;
      const fullAC = findPath(map, hqA, hqC, {
        factionId: 'A',
        crossings: allActive,
      })!;
      const fullBC = findPath(map, hqB, hqC, {
        factionId: 'A',
        crossings: allActive,
      })!;
      expect(fullAB.length).toBe(fullAC.length);
      expect(fullAB.length).toBe(fullBC.length);

      // F16-02 / #28: 各首都から各中立拠点への陸路長（橋なし・bridge-2完成後）が陣営を入れ替えても同じ多重集合になる
      const neutralBases = BASE_CELLS.filter((b) => b.factionId === null);
      const noBridgeDists = (['A', 'B', 'C'] as const).map((fid) => {
        const hq = BASE_CELLS.find((b) => b.id === `HQ-${fid}`)!.cell;
        const reachable = neutralBases.filter(
          (base) => findPath(map, hq, base.cell) !== null,
        );
        expect(
          reachable.filter((base) => base.kind === 'outpost'),
        ).toHaveLength(1);
        expect(reachable.filter((base) => base.kind === 'medium')).toHaveLength(
          1,
        );
        return neutralBases
          .map((n) => findPath(map, hq, n.cell)?.length ?? null)
          .sort((a, b) => (a === null ? 1 : b === null ? -1 : a - b));
      });
      expect(noBridgeDists[0]).toEqual(noBridgeDists[1]);
      expect(noBridgeDists[0]).toEqual(noBridgeDists[2]);

      const borderB2Active = [b000, b120, b240].map((c) => ({
        ...c,
        owner: 'A' as const,
        allowedUnitKinds: ['assault', 'scout'] as const,
      }));
      const b2Dists = (['A', 'B', 'C'] as const).map((fid) => {
        const hq = BASE_CELLS.find((b) => b.id === `HQ-${fid}`)!.cell;
        return neutralBases
          .map(
            (n) =>
              findPath(map, hq, n.cell, {
                factionId: 'A',
                crossings: borderB2Active,
              })?.length ?? null,
          )
          .sort((a, b) => (a === null ? 1 : b === null ? -1 : a - b));
      });
      expect(b2Dists[0]).toEqual(b2Dists[1]);
      expect(b2Dists[0]).toEqual(b2Dists[2]);
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
        crossings: [
          { ...crossing, owner: 'A', allowedUnitKinds: ['assault', 'scout'] },
        ],
      }),
    ).not.toBeNull();
    expect(
      findPath(map, crossing.bankA, crossing.bankB, {
        factionId: 'B',
        crossings: [
          { ...crossing, owner: 'A', allowedUnitKinds: ['assault', 'scout'] },
        ],
      }),
    ).toBeNull();
  });

  it('places every crossing anchor between traversable banks and enforces ropeway unit access', () => {
    const map = createMap(42);
    for (const site of map.crossingSites!) {
      expect(terrainAt(map, site.bankA)).toBe('land');
      expect(terrainAt(map, site.bankB)).toBe('land');
      const crossingTerrain = site.tier.startsWith('bridge')
        ? 'river'
        : 'mountain';
      for (const cell of site.cells)
        expect(terrainAt(map, cell)).toBe(crossingTerrain);

      const rights = {
        owner: 'A' as const,
        allowedUnitKinds: site.tier.startsWith('bridge')
          ? (['assault', 'scout'] as const)
          : (['scout'] as const),
      };
      expect(
        findPath(map, site.bankA, site.bankB, {
          factionId: 'A',
          crossings: [{ ...site, ...rights }],
          unitKind: 'scout',
        }),
      ).not.toBeNull();
      if (site.tier.startsWith('ropeway'))
        for (const cell of site.cells)
          expect(
            canTraverse(map, cell, {
              factionId: 'A',
              crossings: [{ ...site, ...rights }],
              unitKind: 'assault',
            }),
          ).toBe(false);
    }
  });

  it('rejects invalid seeds', () => {
    for (const seed of [-1, 1.5, NaN, Infinity, 0x100000000]) {
      expect(() => createMap(seed)).toThrow(RangeError);
    }
  });
});
