import { describe, expect, it } from 'vitest';
import { createMap100 } from './map-100';
import { getReachableCells, terrainAt } from './map';
import { findPath } from './pathfinding';
import {
  describeExpansionRoutes,
  describeTransferRoutes,
} from './expansion-routes';
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
    expect(maps[0]?.definitionVersion).toBe(6);
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

  it('gives every start two expansions of different kinds, one overland and one behind its own ring bridge', () => {
    const routes = describeExpansionRoutes(createMap100(0), DEFAULT_RULES);
    const summary = (start: keyof typeof routes) =>
      routes[start]
        .slice(0, 2)
        .map(({ baseId, kind, pathCells, crossings }) => [
          baseId,
          kind,
          pathCells,
          crossings.map(({ siteId }) => siteId),
        ]);
    expect(summary('south-west')).toEqual([
      ['OUT-02', 'large', 37, ['CROSS-RING-SW']],
      ['MID-02', 'medium', 40, []],
    ]);
    expect(summary('south-east')).toEqual([
      ['MID-01', 'medium', 41, []],
      ['OUT-02', 'large', 53, ['CROSS-RING-SE']],
    ]);
    expect(summary('north')).toEqual([
      ['MID-03', 'medium', 37, []],
      ['OUT-01', 'outpost', 45, ['CROSS-RING-N']],
    ]);
    for (const list of Object.values(routes)) {
      const [first, second] = list;
      expect(first!.kind).not.toBe(second!.kind);
      for (const route of [first!, second!]) {
        expect(route.crossings.every(({ tier }) => tier === 'bridge-1')).toBe(
          true,
        );
        expect(route.assaultTravelTicks).toBe(
          route.pathCells * DEFAULT_RULES.units.assault.moveTicksPerCell,
        );
      }
    }
  });

  it('puts the three central bases on an island reached through one ring bridge per start', () => {
    const map = createMap100(0);
    const island = ['OUT-01', 'OUT-02', 'OUT-03'];
    const cells = new Map(
      (map.basePlacements ?? []).map((base) => [base.id, base.cell]),
    );
    expect(island.map((id) => cells.get(id))).toEqual([
      { x: 47, y: 40 },
      { x: 50, y: 50 },
      { x: 48, y: 59 },
    ]);
    for (const origin of Object.values(map.startPoints ?? {}))
      for (const id of island)
        expect(
          findPath(map, origin, cells.get(id)!, {
            domain: 'land',
            unitKind: 'assault',
          }),
        ).toBeNull();
    const routes = describeExpansionRoutes(map, DEFAULT_RULES);
    const islandBridges = Object.fromEntries(
      Object.entries(routes).map(([start, list]) => [
        start,
        [
          ...new Set(
            list
              .filter(({ baseId }) => island.includes(baseId))
              .flatMap(({ crossings }) =>
                crossings.map(({ siteId }) => siteId),
              ),
          ),
        ],
      ]),
    );
    expect(islandBridges).toEqual({
      north: ['CROSS-RING-N'],
      'south-east': ['CROSS-RING-SE'],
      'south-west': ['CROSS-RING-SW'],
    });
  });

  it('gives each start a bridge-II detour into the medium base on a neighbour side', () => {
    const routes = describeExpansionRoutes(createMap100(0), DEFAULT_RULES);
    const detour = (start: keyof typeof routes, baseId: string) => {
      const route = routes[start].find((entry) => entry.baseId === baseId)!;
      return [
        route.pathCells,
        route.researchBypass?.pathCells,
        route.researchBypass?.crossings
          .filter(({ tier }) => tier === 'bridge-2')
          .map(({ siteId, unlockResearch }) => [
            siteId,
            unlockResearch.map(({ id }) => id),
          ]),
      ];
    };
    expect(detour('north', 'MID-01')).toEqual([
      94,
      50,
      [['CROSS-BORDER-000-B2', ['bridge-2']]],
    ]);
    expect(detour('south-east', 'MID-02')).toEqual([
      104,
      50,
      [['CROSS-BORDER-120-B2', ['bridge-2']]],
    ]);
    expect(detour('south-west', 'MID-03')).toEqual([
      68,
      52,
      [['CROSS-BORDER-240-B2', ['bridge-2']]],
    ]);
  });

  it('reports front-transfer routes between bases and boat routes between ports', () => {
    const routes = describeTransferRoutes(createMap100(0));
    const pair = (from: string, to: string) =>
      routes.bases.find((entry) => entry.from === from && entry.to === to);
    expect(routes.bases).toHaveLength(36);
    expect(routes.bases.every(({ bridgeI }) => bridgeI !== null)).toBe(true);
    // Island bases sit one bridge away from each other and from the home fronts.
    expect(pair('OUT-01', 'OUT-02')).toMatchObject({ bridgeI: 13 });
    expect(pair('OUT-02', 'OUT-03')).toMatchObject({ bridgeI: 11 });
    // Bridge-II research shortens each home-to-neighbour-medium intervention.
    expect(pair('HOME-C', 'MID-01')).toMatchObject({
      bridgeI: 82,
      bridgeII: 52,
    });
    expect(pair('HOME-B', 'MID-02')).toMatchObject({
      bridgeI: 106,
      bridgeII: 38,
    });
    expect(pair('HOME-A', 'MID-03')).toMatchObject({
      bridgeI: 56,
      bridgeII: 40,
    });
    expect(routes.ports).toEqual([
      { from: 'PORT-A', to: 'PORT-B', cells: 36 },
      { from: 'PORT-A', to: 'PORT-C', cells: 55 },
      { from: 'PORT-B', to: 'PORT-C', cells: 35 },
    ]);
  });

  it('keeps the start-side overland expansions clear of the local ridges', () => {
    const map = createMap100(0);
    const bases = new Map(
      (map.basePlacements ?? []).map((base) => [base.id, base.cell]),
    );
    const ridgeCells = [
      { x: 28, y: 55 },
      { x: 29, y: 55 },
      { x: 65, y: 69 },
      { x: 66, y: 69 },
      { x: 57, y: 24 },
      { x: 58, y: 24 },
    ];
    const starts = map.startPoints!;
    for (const [origin, target, expectedLength] of [
      [starts['south-west'], bases.get('MID-02')!, 40],
      [starts['south-east'], bases.get('MID-01')!, 41],
      [starts.north, bases.get('MID-03')!, 37],
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
