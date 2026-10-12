import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from './rules';
import { validateEnvelope, validateRules } from './rules-validation';

describe('F03 rules validation', () => {
  it('returns a detached canonical default-shaped snapshot', () => {
    const result = validateRules(DEFAULT_RULES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rules).toEqual(DEFAULT_RULES);
    expect(result.rules).not.toBe(DEFAULT_RULES);
    expect(result.rules.units.assault).not.toBe(DEFAULT_RULES.units.assault);
  });

  it('rejects unknown keys, fractional cents, zero movement interval, and prerequisite cycles', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.extra = true;
    invalid.units.assault.costCenti = 1.5;
    invalid.npc.decisionIntervalTicks = 0;
    invalid.research.definitions['firepower-1'].prerequisite = 'firepower-2';
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'rules.extra',
        'rules.units.assault.costCenti',
        'rules.npc.decisionIntervalTicks',
        'rules.research.definitions.firepower-1.prerequisite',
      ]),
    );
  });

  it('rejects incompatible intervals and unsafe whole-match income products', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.limits.unitsPerFaction = 1;
    invalid.match.timeLimitTicks = 100_000_000;
    invalid.research.baseIncomeCentiPerTick = 1_000_000_000;
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'rules.match.timeLimitTicks',
        'rules.limits.unitsPerFaction',
      ]),
    );
  });

  it('requires a supported master envelope version and exact fields', () => {
    expect(
      validateEnvelope({
        masterSchemaVersion: 1,
        revision: 0,
        rules: DEFAULT_RULES,
      }).ok,
    ).toBe(false);
    expect(
      validateEnvelope({
        masterSchemaVersion: 2,
        revision: 0,
        rules: DEFAULT_RULES,
        extra: true,
      }).ok,
    ).toBe(false);
  });
});
