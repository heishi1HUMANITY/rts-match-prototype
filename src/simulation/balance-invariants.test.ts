import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from './rules';

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
});
