import { describe, expect, it } from 'vitest';
import { INITIAL_UNIT_PLACEMENTS } from './config';
import { createMap } from './map';
import { createMatch } from './match';

describe('initial match contract', () => {
  it('creates schema-v2 ready state with three factions and six fixed units', () => {
    const match = createMatch(42);
    expect(match.schemaVersion).toBe(2);
    expect(match.factions.map((faction) => faction.id)).toEqual([
      'A',
      'B',
      'C',
    ]);
    expect(
      match.factions.filter((faction) => faction.controller === 'human'),
    ).toHaveLength(1);
    expect(
      match.factions.filter((faction) => faction.controller === 'bot'),
    ).toHaveLength(2);
    expect(match.phase).toBe('ready');
    expect(match.elapsedTicks).toBe(0);
    expect(match.units).toHaveLength(6);
    expect(
      match.units.map(({ id, factionId, cell, path, edgeProgress }) => ({
        id,
        factionId,
        cell,
        path,
        edgeProgress,
      })),
    ).toEqual(
      INITIAL_UNIT_PLACEMENTS.map(({ id, factionId, cell }) => ({
        id,
        factionId,
        cell,
        path: [],
        edgeProgress: 0,
      })),
    );
  });

  it('reproduces state and survives a JSON round trip for representative seeds', () => {
    for (const seed of [0, 42, 43, 0xffffffff]) {
      const match = createMatch(seed);
      expect(createMatch(seed)).toEqual(match);
      expect(JSON.parse(JSON.stringify(match))).toEqual(match);
    }
  });

  it('does not share mutable match structures across matches', () => {
    const first = createMatch(42);
    const second = createMatch(42);
    expect(first.map).not.toBe(second.map);
    expect(first.map.blocked).not.toBe(second.map.blocked);
    expect(first.units).not.toBe(second.units);
    expect(first.factions).not.toBe(second.factions);
    first.units.forEach((unit, index) => {
      const counterpart = second.units[index]!;
      expect(unit).not.toBe(counterpart);
      expect(unit.cell).not.toBe(counterpart.cell);
      expect(unit.path).not.toBe(counterpart.path);
    });
    first.factions.forEach((faction, index) => {
      expect(faction).not.toBe(second.factions[index]!);
    });
    expect(first.map).toEqual(createMap(42));
  });

  it.each([0, 0xffffffff])('accepts uint32 boundary seed %s', (seed) => {
    expect(createMatch(seed).seed).toBe(seed);
  });

  it.each([-1, 1.5, NaN, Infinity, 0x100000000])(
    'rejects invalid seed %s',
    (seed) => {
      expect(() => createMatch(seed)).toThrow(RangeError);
    },
  );
});
