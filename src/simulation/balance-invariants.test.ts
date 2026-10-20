import { describe, expect, it } from 'vitest';
import { createMatch, stepMatch } from './match';
import { DEFAULT_RULES } from './rules';
import type { MatchState, UnitState } from './types';

/** Relationships the 2026-10-20 tuning keeps regardless of the concrete numbers. */
describe('default balance invariants', () => {
  const definitions = DEFAULT_RULES.research.definitions;
  const unlockStage = (
    predicate: (
      effect: (typeof definitions)[string]['effects'][number],
    ) => boolean,
  ): number[] =>
    Object.values(definitions)
      .filter(({ effects }) => effects.some(predicate))
      .map(({ stage }) => stage);

  it('unlocks attack helicopters after the earliest anti-air option', () => {
    const helicopter = unlockStage(
      (effect) =>
        effect.id === 'unit-unlock' && effect.unitKind === 'helicopter',
    );
    const antiAir = unlockStage(
      (effect) =>
        (effect.id === 'unit-unlock' && effect.unitKind === 'antiAir') ||
        (effect.id === 'facility-unlock' && effect.facilityKind === 'antiAir'),
    );
    expect(helicopter.length).toBeGreaterThan(0);
    expect(antiAir.length).toBeGreaterThan(1);
    expect(Math.min(...helicopter)).toBeGreaterThan(Math.min(...antiAir));
  });

  it('keeps base anti-air between helicopter range and vision and below dedicated anti-air', () => {
    const helicopter = DEFAULT_RULES.units.helicopter;
    const dedicated = Math.min(
      DEFAULT_RULES.units.antiAir.damageVsAir,
      DEFAULT_RULES.facilities.definitions.antiAir.damageVsAir,
    );
    for (const [kind, base] of Object.entries(DEFAULT_RULES.bases)) {
      expect(base.airDefenseRange, kind).toBeGreaterThanOrEqual(
        helicopter.range,
      );
      expect(base.airDefenseRange, kind).toBeLessThan(helicopter.vision);
      expect(base.airDefenseDamage, kind).toBeLessThanOrEqual(dedicated);
      const tiers = DEFAULT_RULES.baseUpgrades.kinds[kind as 'hq'];
      for (const tier of [tiers.level2, tiers.level3]) {
        expect(tier.turretRange, kind).toBeLessThan(helicopter.vision);
        expect(tier.turretDamageVsAir, kind).toBeLessThan(
          DEFAULT_RULES.units.antiAir.damageVsAir,
        );
      }
    }
  });

  /** n enemy helicopters attack an undefended level-1 outpost owned by A. */
  function helicopterRaid(count: number): {
    readonly owner: string | null;
    readonly survivors: number;
    readonly remainingShots: number;
  } {
    const start = createMatch(42, {
      rules: {
        ...DEFAULT_RULES,
        match: { ...DEFAULT_RULES.match, hqProtectionTicks: 0 },
      },
    });
    const target = start.bases.find(({ kind }) => kind === 'outpost')!;
    const template = start.units[0]!;
    const helicopters: UnitState[] = Array.from(
      { length: count },
      (_, index) => ({
        ...template,
        id: `B-${String(index + 1).padStart(2, '0')}`,
        factionId: 'B',
        kind: 'helicopter',
        maxHp: DEFAULT_RULES.units.helicopter.maxHp,
        hp: DEFAULT_RULES.units.helicopter.maxHp,
        moveTicksPerCell: DEFAULT_RULES.units.helicopter.moveTicksPerCell,
        cell: { x: target.cell.x + 6, y: target.cell.y },
        path: [],
        edgeProgress: 0,
        marchOrder: {
          target: { kind: 'base', id: target.id },
          lastKnownCell: target.cell,
          lastSeenTick: 0,
          status: 'tracking',
        },
      }),
    );
    let state: MatchState = {
      ...start,
      phase: 'running',
      units: helicopters,
      bases: start.bases.map((base) =>
        base.id === target.id
          ? { ...base, owner: 'A', hp: base.maxHp, defender: null }
          : base,
      ),
    };
    for (let tick = 0; tick < 600; tick += 1) {
      state = stepMatch(state);
      const base = state.bases.find(({ id }) => id === target.id)!;
      if (base.owner !== 'A' || state.units.length === 0) break;
    }
    return {
      owner: state.bases.find(({ id }) => id === target.id)!.owner,
      survivors: state.units.filter(({ factionId }) => factionId === 'B')
        .length,
      remainingShots: state.units
        .filter(({ factionId }) => factionId === 'B')
        .reduce(
          (sum, unit) =>
            sum + (unit.ammo ?? DEFAULT_RULES.units.helicopter.ammo),
          0,
        ),
    };
  }

  it('lets two helicopters fail against a level-1 outpost', () => {
    expect(helicopterRaid(2).owner).toBe('A');
  });

  it('makes five helicopters lose at least one aircraft to neutralize a level-1 outpost', () => {
    const raid = helicopterRaid(5);
    expect(raid.owner).toBeNull();
    expect(raid.survivors).toBeLessThan(5);
    expect(raid.survivors).toBeGreaterThan(0);
  });

  it('leaves a five-helicopter sortie without the shots for a second outpost', () => {
    const raid = helicopterRaid(5);
    expect(raid.owner).toBeNull();
    expect(
      raid.remainingShots * DEFAULT_RULES.units.helicopter.damageVsStructure,
    ).toBeLessThan(DEFAULT_RULES.bases.outpost.maxHp);
  });
});
