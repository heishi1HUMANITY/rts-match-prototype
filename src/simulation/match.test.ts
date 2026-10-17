import { describe, expect, it } from 'vitest';
import { INITIAL_UNIT_PLACEMENTS } from './config';
import { createMap, isCellBlocked } from './map';
import { createMatch } from './match';

describe('initial match contract', () => {
  it('creates schema-v26 ready state with three ranked factions, typed units, and bases', () => {
    const match = createMatch(42);
    expect(match.schemaVersion).toBe(26);
    expect(match.timeLimitTicks).toBe(12000);
    expect(match.result).toBeNull();
    expect(
      match.factions.every(({ eliminatedAtTick }) => eliminatedAtTick === null),
    ).toBe(true);
    expect(match.scenarioId).toBe('standard');
    expect(match.factions.map(({ id }) => id)).toEqual(['A', 'B', 'C']);
    expect(
      match.factions.filter(({ controller }) => controller === 'human'),
    ).toHaveLength(1);
    expect(
      match.factions.filter(({ controller }) => controller === 'bot'),
    ).toHaveLength(2);
    expect(match.phase).toBe('ready');
    expect(match.elapsedTicks).toBe(0);
    expect(match.units).toHaveLength(6);
    expect(match.bases).toHaveLength(12);
    expect(match.knowledge).toHaveLength(4);
    expect(
      match.units.map(
        ({ id, factionId, kind, hp, maxHp, cell, path, edgeProgress }) => ({
          id,
          factionId,
          kind,
          hp,
          maxHp,
          cell,
          path,
          edgeProgress,
        }),
      ),
    ).toEqual(
      INITIAL_UNIT_PLACEMENTS.map(({ id, factionId, kind, cell }) => ({
        id,
        factionId,
        kind,
        hp: kind === 'assault' ? 200 : 120,
        maxHp: kind === 'assault' ? 200 : 120,
        cell,
        path: [],
        edgeProgress: 0,
      })),
    );
    expect(match.factions[0]).toMatchObject({
      supplyCenti: 20_000,
      researchCenti: 0,
      ticketsCenti: 30_000,
    });
  });

  it('reproduces state and survives JSON round trips for representative seeds', () => {
    for (const seed of [0, 42, 43, 0xffffffff]) {
      const match = createMatch(seed);
      expect(createMatch(seed)).toEqual(match);
      expect(JSON.parse(JSON.stringify(match))).toEqual(match);
    }
  });

  it('snapshots the 100-cell map, faction-to-start assignment, ownership, and ports', () => {
    const match = createMatch(1, { mapId: 'ring-three-fronts-100' });
    expect(match.map.width).toBe(100);
    expect(match.map.height).toBe(100);
    expect(match.map.definitionId).toBe('ring-three-fronts');
    expect(match.map.startAssignment?.A).toBe('south-east');
    expect(match.map.basePlacements).toEqual(
      match.bases.map(({ id, kind, cell, owner }) => ({
        id,
        kind,
        cell,
        factionId: owner,
      })),
    );
    expect(JSON.parse(JSON.stringify(match))).toEqual(match);
    expect(createMatch(1, { mapId: 'ring-three-fronts-100' })).toEqual(match);
  });

  it('serializes research bank/progress and starts a new match without carrying them over', () => {
    const initial = createMatch(42);
    const state = {
      ...initial,
      factions: initial.factions.map((faction) =>
        faction.id === 'A'
          ? {
              ...faction,
              researchCenti: 123,
              researchProgressCenti: {
                'firepower-1': 5_000,
                'firepower-2': 7_000,
              },
              activeResearch: { researchId: 'firepower-1' as const },
            }
          : faction,
      ),
    };
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    const reset = createMatch(42);
    expect(reset.factions.find(({ id }) => id === 'A')).toMatchObject({
      researchCenti: 0,
      researchProgressCenti: { 'firepower-1': 0, 'firepower-2': 0 },
      activeResearch: null,
      completedResearchIds: [],
    });
  });

  it('does not share mutable match structures across matches', () => {
    const first = createMatch(42);
    const second = createMatch(42);
    expect(first.map).not.toBe(second.map);
    expect(first.map.blocked).not.toBe(second.map.blocked);
    expect(first.units).not.toBe(second.units);
    expect(first.factions).not.toBe(second.factions);
    expect(first.bases).not.toBe(second.bases);
    expect(first.knowledge).not.toBe(second.knowledge);
    expect(first.knowledge[0]!.visible).not.toBe(second.knowledge[0]!.visible);
    first.units.forEach((unit, index) => {
      const counterpart = second.units[index]!;
      expect(unit).not.toBe(counterpart);
      expect(unit.cell).not.toBe(counterpart.cell);
      expect(unit.path).not.toBe(counterpart.path);
    });
    first.factions.forEach((faction, index) =>
      expect(faction).not.toBe(second.factions[index]!),
    );
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

  it.each([
    'standard',
    'g2-capture',
    'g2-combat',
    'g2-economy',
    'g3-timeout',
    'g3-elimination',
    'g3-mutual',
    'g3-spectate',
    'f02-pursuit',
    'f04-crossing',
    'f05-neutral-defense',
    'f10-base-upgrades',
    'f18-garrison',
    'f86-point-fire',
  ] as const)('reproduces scenario fixture %s', (scenarioId) => {
    const match = createMatch(42, { scenarioId });
    expect(createMatch(42, { scenarioId })).toEqual(match);
    expect(match.scenarioId).toBe(scenarioId);
    expect(JSON.parse(JSON.stringify(match))).toEqual(match);
    expect(
      match.units.every(({ cell }) => !isCellBlocked(match.map, cell)),
    ).toBe(true);
    expect(
      match.factions.every(
        (faction, index) => faction !== match.factions[(index + 1) % 3],
      ),
    ).toBe(true);
  });

  it('applies only the specified fixture differences', () => {
    const standard = createMatch(42);
    const pointFire = createMatch(42, { scenarioId: 'f86-point-fire' });
    expect(pointFire.units.find(({ id }) => id === 'A-01')).toMatchObject({
      kind: 'artillery',
      cell: { x: 20, y: 20 },
    });
    expect(
      pointFire.factions.find(({ id }) => id === 'A')!.completedResearchIds,
    ).toContain('specialization-power');
    const capture = createMatch(42, { scenarioId: 'g2-capture' });
    expect(capture.units.find(({ id }) => id === 'A-01')!.cell).toEqual({
      x: 20,
      y: 28,
    });
    expect(capture.units.find(({ id }) => id === 'A-02')!.cell).toEqual({
      x: 20,
      y: 29,
    });
    const combat = createMatch(42, { scenarioId: 'g2-combat' });
    expect(combat.units.find(({ id }) => id === 'A-01')).toMatchObject({
      cell: { x: 20, y: 20 },
      hp: 40,
      maxHp: 200,
    });
    expect(combat.units.find(({ id }) => id === 'B-01')).toMatchObject({
      cell: { x: 22, y: 20 },
      hp: 40,
      maxHp: 200,
    });
    expect(combat.units.find(({ id }) => id === 'A-02')!.cell).toEqual({
      x: 10,
      y: 20,
    });
    expect(combat.units.find(({ id }) => id === 'B-02')!.cell).toEqual({
      x: 30,
      y: 20,
    });
    const economy = createMatch(42, { scenarioId: 'g2-economy' });
    expect(economy.factions.find(({ id }) => id === 'A')).toMatchObject({
      supplyCenti: 18_000,
      researchCenti: 15_000,
    });
    expect(economy.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: 'A',
      hp: 100,
    });
    expect(standard.factions.find(({ id }) => id === 'A')).toMatchObject({
      supplyCenti: 20_000,
      researchCenti: 0,
    });
    expect(standard.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: null,
      hp: 300,
      defender: { hp: 60, maxHp: 60 },
    });
  });
});
