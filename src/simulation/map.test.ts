import { describe, expect, it } from 'vitest';
import {
  INITIAL_UNIT_PLACEMENTS,
  ISOLATED_CELL,
  MAP_HEIGHT,
  MAP_WIDTH,
} from './config';
import { createMap, getReachableCells, isCellBlocked } from './map';

const seeds = [0, 42, 43, 0xffffffff];
const mapFingerprints = new Map<number, number>([
  [0, 0x97309721],
  [42, 0x4b33b75c],
  [43, 0x386ee5e6],
  [0xffffffff, 0x57a32972],
]);

describe('seeded map generation', () => {
  it.each(seeds)(
    'reproduces the map and preserves connectivity for seed %s',
    (seed) => {
      const map = createMap(seed);
      let fingerprint = 0x811c9dc5;
      for (const blocked of map.blocked) {
        fingerprint =
          Math.imul(fingerprint ^ Number(blocked), 0x01000193) >>> 0;
      }
      expect(fingerprint).toBe(mapFingerprints.get(seed));
      expect(map).toEqual(createMap(seed));
      expect(map.width).toBe(MAP_WIDTH);
      expect(map.height).toBe(MAP_HEIGHT);
      expect(map.blocked).toHaveLength(MAP_WIDTH * MAP_HEIGHT);

      const reachable = getReachableCells(map);
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const cell = { x, y };
          if (isCellBlocked(map, cell)) continue;
          if (x === ISOLATED_CELL.x && y === ISOLATED_CELL.y) continue;
          expect(reachable.has(`${x},${y}`)).toBe(true);
        }
      }
      for (const placement of INITIAL_UNIT_PLACEMENTS) {
        expect(isCellBlocked(map, placement.cell)).toBe(false);
        expect(reachable.has(`${placement.cell.x},${placement.cell.y}`)).toBe(
          true,
        );
      }
    },
  );

  it('keeps the isolated inspection cell and its eight blockers fixed', () => {
    const map = createMap(42);
    expect(isCellBlocked(map, ISOLATED_CELL)).toBe(false);
    for (let y = ISOLATED_CELL.y - 1; y <= ISOLATED_CELL.y + 1; y += 1) {
      for (let x = ISOLATED_CELL.x - 1; x <= ISOLATED_CELL.x + 1; x += 1) {
        if (x === ISOLATED_CELL.x && y === ISOLATED_CELL.y) continue;
        expect(isCellBlocked(map, { x, y })).toBe(true);
      }
    }
    expect(
      getReachableCells(map).has(`${ISOLATED_CELL.x},${ISOLATED_CELL.y}`),
    ).toBe(false);
  });

  it('rejects invalid seeds', () => {
    for (const seed of [-1, 1.5, NaN, Infinity, 0x100000000]) {
      expect(() => createMap(seed)).toThrow(RangeError);
    }
  });
});
