import { describe, expect, it } from 'vitest';
import { createMatch } from './match';

describe('single-player match contract', () => {
  it('creates three independent factions with exactly one human and two bots', () => {
    const match = createMatch(42);
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
  });

  it('reproduces the initial state and survives a JSON round trip', () => {
    const match = createMatch(42);
    expect(createMatch(42)).toEqual(match);
    expect(JSON.parse(JSON.stringify(match))).toEqual(match);
    expect(createMatch(43).seed).toBe(43);
    expect(match.elapsedTicks).toBe(0);
  });

  it('does not share faction objects between matches', () => {
    const first = createMatch(1);
    const second = createMatch(1);
    expect(first.factions).not.toBe(second.factions);
    first.factions.forEach((faction, index) => {
      expect(faction).not.toBe(second.factions[index]);
    });
  });

  it.each([0, 0xffffffff])('accepts boundary seed %s', (seed) => {
    expect(createMatch(seed).seed).toBe(seed);
  });

  it.each([-1, 1.5, NaN, Infinity, 0x100000000])(
    'rejects invalid seed %s',
    (seed) => {
      expect(() => createMatch(seed)).toThrow(RangeError);
    },
  );
});
