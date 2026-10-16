import { describe, expect, it } from 'vitest';
import { createMap100 } from './map-100';
import { getReachableCells, terrainAt } from './map';

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
});
