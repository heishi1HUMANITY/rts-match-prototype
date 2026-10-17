import { describe, expect, it } from 'vitest';
import { createMap100 } from './map-100';
import { getReachableCells, terrainAt } from './map';
import { findPath } from './pathfinding';
import { DEFAULT_RULES } from './rules';

describe('100-cell trial map definition', () => {
  it('keeps terrain fixed while assigning the human faction to all three starts', () => {
    const maps = [0, 1, 2].map((seed) => createMap100(seed));
    expect(maps.map((map) => map.startAssignment?.A)).toEqual([
      'south-west',
      'south-east',
      'north',
    ]);
    expect(maps[0]?.blocked).toEqual(maps[1]?.blocked);
    expect(maps[1]?.terrain).toEqual(maps[2]?.terrain);
    expect(maps[0]?.width).toBe(100);
    expect(maps[0]?.height).toBe(100);
    expect(maps[0]?.definitionId).toBe('ring-three-fronts');
    expect(maps[0]?.definitionVersion).toBe(5);
    expect(maps[0]?.startPoints).toEqual({
      'south-west': { x: 13, y: 50 },
      'south-east': { x: 70, y: 83 },
      north: { x: 70, y: 18 },
    });
    expect(maps[0]?.startAssignment).toEqual({
      A: 'south-west',
      B: 'south-east',
      C: 'north',
    });
    expect(maps[0]?.basePlacements).toHaveLength(12);
    expect(maps[0]?.initialUnitPlacements).toHaveLength(6);
    for (const map of maps) {
      expect(
        map.basePlacements
          ?.filter((base) => base.kind === 'hq')
          .map((base) => base.factionId)
          .sort(),
      ).toEqual(['A', 'B', 'C']);
      expect(
        map.initialUnitPlacements?.map((unit) => unit.factionId).sort(),
      ).toEqual(['A', 'A', 'B', 'B', 'C', 'C']);
      expect(map.ports?.map((port) => port.factionId).sort()).toEqual([
        'A',
        'B',
        'C',
      ]);
    }
  });

  it('preserves traversable land starts, continuous crossing water and adjacent port shores', () => {
    const map = createMap100(42);
    for (const cell of [
      { x: 28, y: 55 },
      { x: 29, y: 55 },
      { x: 65, y: 69 },
      { x: 66, y: 69 },
      { x: 57, y: 24 },
      { x: 58, y: 24 },
    ]) {
      expect(terrainAt(map, cell)).toBe('mountain');
      expect(map.blocked[cell.y * map.width + cell.x]).toBe(true);
    }
    for (const placement of map.initialUnitPlacements ?? [])
      expect(getReachableCells(map, placement.cell).size).toBeGreaterThan(0);
    for (const port of map.ports ?? []) {
      expect(terrainAt(map, port.cell)).toBe('river');
      expect(terrainAt(map, port.shore)).toBe('riverbank');
      expect(
        Math.abs(port.cell.x - port.shore.x) +
          Math.abs(port.cell.y - port.shore.y),
      ).toBe(1);
    }
    for (const crossing of map.crossingSites ?? []) {
      expect(terrainAt(map, crossing.bankA)).toBe('land');
      expect(terrainAt(map, crossing.bankB)).toBe('land');
      expect(crossing.cells.length).toBeGreaterThan(0);
      const axis = crossing.bankA.x === crossing.bankB.x ? 'y' : 'x';
      const ordered = [...crossing.cells].sort((a, b) => a[axis] - b[axis]);
      expect(
        ordered.every(
          (cell) =>
            terrainAt(map, cell) ===
            (crossing.tier.startsWith('bridge') ? 'river' : 'mountain'),
        ),
      ).toBe(true);
    }
  });

  it('provides two distinct neutral expansion routes from every physical start with bridge-I sites built', () => {
    const map = createMap100(0);
    const completedSites = (map.crossingSites ?? [])
      .filter((site) => site.tier === 'bridge-1')
      .map((site) => ({
        ...site,
        owner: 'A' as const,
        allowedUnitKinds: ['assault', 'scout', 'artillery', 'antiAir'] as const,
      }));
    const neutralBases = (map.basePlacements ?? []).filter(
      (base) => base.factionId === null,
    );
    const expectedNearest: Record<string, readonly [string, number][]> = {
      'south-west': [
        ['OUT-01', 39],
        ['MID-02', 40],
      ],
      'south-east': [
        ['OUT-03', 33],
        ['MID-01', 41],
      ],
      north: [
        ['MID-03', 37],
        ['OUT-01', 50],
      ],
    };
    for (const [start, origin] of Object.entries(map.startPoints ?? {})) {
      const reachable = neutralBases
        .map((base) => ({
          id: base.id,
          path: findPath(map, origin, base.cell, {
            domain: 'land',
            factionId: 'A',
            unitKind: 'assault',
            crossings: completedSites,
          }),
        }))
        .filter(({ path }) => path !== null)
        .sort((a, b) => a.path!.length - b.path!.length);
      expect(reachable.length, start).toBeGreaterThanOrEqual(2);
      expect(new Set(reachable.slice(0, 2).map(({ id }) => id)).size).toBe(2);
      expect(
        reachable.slice(0, 2).map(({ id, path }) => [id, path!.length]),
        start,
      ).toEqual(expectedNearest[start]);
    }
    const baseById = new Map(neutralBases.map((base) => [base.id, base]));
    const returnPairs = [
      ['OUT-02', 'OUT-01'],
      ['OUT-03', 'MID-01'],
      ['MID-03', 'OUT-01'],
    ] as const;
    for (const [firstId, secondId] of returnPairs) {
      const first = baseById.get(firstId)!;
      const second = baseById.get(secondId)!;
      expect(first.kind).not.toBe(second.kind);
      expect(DEFAULT_RULES.bases[first.kind].ticketWeight).not.toBe(
        DEFAULT_RULES.bases[second.kind].ticketWeight,
      );
    }
  });

  it('keeps the large neutral base within an eight-cell shortest-path spread', () => {
    const map = createMap100(0);
    const large = map.basePlacements?.find((base) => base.id === 'OUT-02');
    expect(large?.cell).toEqual({ x: 58, y: 41 });
    const bridge1Sites = (map.crossingSites ?? [])
      .filter((site) => site.tier === 'bridge-1')
      .map((site) => ({
        ...site,
        owner: 'A' as const,
        allowedUnitKinds: ['assault', 'scout', 'artillery', 'antiAir'] as const,
      }));
    const distances = Object.entries(map.startPoints ?? {}).map(
      ([start, origin]) => {
        const path = findPath(map, origin, large!.cell, {
          domain: 'land',
          factionId: 'A',
          unitKind: 'assault',
          crossings: bridge1Sites,
        });
        expect(path, start).not.toBeNull();
        return path!.length;
      },
    );
    expect(distances).toEqual([54, 54, 55]);
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThanOrEqual(
      8,
    );
  });

  it('separates the southwest bridge approach from two start-side expansion approaches', () => {
    const map = createMap100(0);
    const southWest = map.startPoints?.['south-west'];
    const southEast = map.startPoints?.['south-east'];
    const north = map.startPoints?.north;
    const bases = new Map(
      (map.basePlacements ?? []).map((base) => [base.id, base.cell]),
    );
    expect(
      findPath(map, southWest!, bases.get('OUT-02')!, {
        domain: 'land',
        unitKind: 'assault',
      }),
    ).toBeNull();
    const bridge = map.crossingSites?.find(
      (site) => site.id === 'CROSS-RING-SW',
    );
    expect(bridge).toBeDefined();
    expect(
      findPath(map, southWest!, bases.get('OUT-02')!, {
        domain: 'land',
        factionId: 'A',
        unitKind: 'assault',
        crossings: [
          {
            ...bridge!,
            owner: 'A',
            allowedUnitKinds: ['assault', 'scout', 'artillery', 'antiAir'],
          },
        ],
      })?.length,
    ).toBe(54);
    expect(
      findPath(map, southEast!, bases.get('OUT-03')!, {
        domain: 'land',
        unitKind: 'assault',
      })?.length,
    ).toBe(33);
    expect(
      findPath(map, north!, bases.get('MID-03')!, {
        domain: 'land',
        unitKind: 'assault',
      })?.length,
    ).toBe(37);
    const ridgeCells = [
      { x: 28, y: 55 },
      { x: 29, y: 55 },
      { x: 65, y: 69 },
      { x: 66, y: 69 },
      { x: 57, y: 24 },
      { x: 58, y: 24 },
    ];
    for (const [origin, target, expectedLength] of [
      [southWest!, bases.get('MID-02')!, 40],
      [southEast!, bases.get('OUT-03')!, 33],
      [north!, bases.get('MID-03')!, 37],
    ] as const) {
      const route = findPath(map, origin, target, {
        domain: 'land',
        unitKind: 'assault',
      });
      expect(route?.length).toBe(expectedLength);
      expect(
        route?.some((cell) =>
          ridgeCells.some((ridge) => ridge.x === cell.x && ridge.y === cell.y),
        ),
      ).toBe(false);
    }
  });

  it('has continuous water routes between all three public ports for boats', () => {
    const map = createMap100(0);
    const expected: Record<string, Record<string, number>> = {
      'PORT-A': { 'PORT-B': 36, 'PORT-C': 55 },
      'PORT-B': { 'PORT-A': 36, 'PORT-C': 35 },
      'PORT-C': { 'PORT-A': 55, 'PORT-B': 35 },
    };
    for (const from of map.ports ?? []) {
      for (const to of map.ports ?? []) {
        if (from.id === to.id) continue;
        expect(
          findPath(map, from.cell, to.cell, {
            domain: 'water',
            unitKind: 'patrolBoat',
          })?.length,
        ).toBe(expected[from.id]?.[to.id]);
      }
    }
  });

  it('prices a research-gated bridge-II bypass against the defended ring route', () => {
    const map = createMap100(0);
    const origin = map.startPoints?.['south-east'];
    const destination = map.startPoints?.north;
    const bridge1Sites = (map.crossingSites ?? [])
      .filter((site) => site.tier === 'bridge-1')
      .map((site) => ({
        ...site,
        owner: 'A' as const,
        allowedUnitKinds: ['assault', 'scout', 'artillery', 'antiAir'] as const,
      }));
    const regularRoute = findPath(map, origin!, destination!, {
      domain: 'land',
      factionId: 'A',
      unitKind: 'assault',
      crossings: bridge1Sites,
    });
    const bypass = map.crossingSites?.find(
      (site) => site.id === 'CROSS-BORDER-000-B2',
    );
    expect(bypass?.tier).toBe('bridge-2');
    expect(bypass?.cells).toHaveLength(7);
    const bypassRoute = findPath(map, origin!, destination!, {
      domain: 'land',
      factionId: 'A',
      unitKind: 'assault',
      crossings: [
        ...bridge1Sites,
        {
          ...bypass!,
          owner: 'A',
          allowedUnitKinds: ['assault', 'scout', 'artillery', 'antiAir'],
        },
      ],
    });
    expect(regularRoute).toHaveLength(109);
    expect(bypassRoute).toHaveLength(91);
    expect(regularRoute!.length - bypassRoute!.length).toBe(18);
    const crossedSites = (route: readonly { x: number; y: number }[]) =>
      (map.crossingSites ?? [])
        .filter((site) =>
          route.some((cell) =>
            site.cells.some(
              (crossingCell) =>
                crossingCell.x === cell.x && crossingCell.y === cell.y,
            ),
          ),
        )
        .map(({ id }) => id)
        .sort();
    expect(crossedSites(regularRoute!)).toEqual([
      'CROSS-RING-N',
      'CROSS-RING-SE',
    ]);
    expect(crossedSites(bypassRoute!)).toContain('CROSS-BORDER-000-B2');
    expect(
      map.crossingSites?.find((site) => site.id === 'CROSS-RING-N')?.cells,
    ).toHaveLength(6);
    expect(
      map.crossingSites?.find((site) => site.id === 'CROSS-RING-SE')?.cells,
    ).toHaveLength(6);
    expect(DEFAULT_RULES.research.definitions['bridge-2']?.costCenti).toBe(
      7200,
    );
  });

  it('opens a narrow southern flank to the western expansion front after bridge-II research', () => {
    const map = createMap100(0);
    const origin = map.startPoints?.['south-east'];
    const destination = map.basePlacements?.find(
      (base) => base.id === 'MID-02',
    )?.cell;
    const bridge1Sites = (map.crossingSites ?? [])
      .filter((site) => site.tier === 'bridge-1')
      .map((site) => ({
        ...site,
        owner: 'A' as const,
        allowedUnitKinds: ['assault', 'scout', 'artillery', 'antiAir'] as const,
      }));
    const flank = map.crossingSites?.find(
      (site) => site.id === 'CROSS-FLANK-SOUTH-B2',
    );
    expect(flank?.tier).toBe('bridge-2');
    expect(flank?.cells).toHaveLength(8);
    const ringRoute = findPath(map, origin!, destination!, {
      domain: 'land',
      factionId: 'A',
      unitKind: 'assault',
      crossings: bridge1Sites,
    });
    const flankRoute = findPath(map, origin!, destination!, {
      domain: 'land',
      factionId: 'A',
      unitKind: 'assault',
      crossings: [
        ...bridge1Sites,
        {
          ...flank!,
          owner: 'A',
          allowedUnitKinds: ['assault', 'scout', 'artillery', 'antiAir'],
        },
      ],
    });
    expect(ringRoute).toHaveLength(104);
    expect(flankRoute).toHaveLength(96);
    for (const cell of flank!.cells) expect(flankRoute).toContainEqual(cell);
    expect(flankRoute).toContainEqual(flank!.bankA);
    expect(flankRoute).toContainEqual(flank!.bankB);
  });
});
