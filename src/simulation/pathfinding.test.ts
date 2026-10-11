import { describe, expect, it } from 'vitest';
import { findPath } from './pathfinding';
import type { GridMap } from './types';

function makeMap(
  width: number,
  height: number,
  blockedCells: readonly string[] = [],
): GridMap {
  const blocked = new Array<boolean>(width * height).fill(false);
  for (const cell of blockedCells) {
    const [x = 0, y = 0] = cell.split(',').map(Number);
    blocked[y * width + x] = true;
  }
  return { width, height, blocked };
}

describe('deterministic breadth-first pathfinding', () => {
  it('uses up, right, down, left neighbor priority for equal routes', () => {
    expect(findPath(makeMap(3, 3), { x: 1, y: 1 }, { x: 2, y: 2 })).toEqual([
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('routes around blocked cells with a shortest four-way path', () => {
    const path = findPath(
      makeMap(4, 3, ['1,0']),
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    );
    expect(path).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]);
  });

  it('returns empty for the same walkable cell and null for invalid endpoints', () => {
    const map = makeMap(2, 2, ['1,1']);
    expect(findPath(map, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([]);
    expect(findPath(map, { x: -1, y: 0 }, { x: 0, y: 0 })).toBeNull();
    expect(findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeNull();
    expect(findPath(map, { x: 0.5, y: 0 }, { x: 0, y: 0 })).toBeNull();
  });

  it('returns null when walkable endpoints are separated', () => {
    const map = makeMap(3, 3, ['1,0', '1,1', '1,2']);
    expect(findPath(map, { x: 0, y: 1 }, { x: 2, y: 1 })).toBeNull();
  });
});
