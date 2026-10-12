import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, MASTER_SCHEMA_VERSION } from './rules';
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

  it('requires positive whole-tick defender stats in the master', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.defenses.large.respawnTicks = 0;
    invalid.defenses.medium.baseDamage = 1.5;
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'rules.defenses.large.respawnTicks',
        'rules.defenses.medium.baseDamage',
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
        masterSchemaVersion: MASTER_SCHEMA_VERSION,
        revision: 0,
        rules: DEFAULT_RULES,
        extra: true,
      }).ok,
    ).toBe(false);
  });

  it('migrates a validated schema 3 master without losing its prior values', () => {
    const v3Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete v3Rules.defenses;
    v3Rules.units.assault.baseDamage = 7;
    const result = validateEnvelope({
      masterSchemaVersion: 3,
      revision: 12,
      rules: v3Rules,
    });
    expect(result).toMatchObject({
      ok: true,
      envelope: {
        masterSchemaVersion: MASTER_SCHEMA_VERSION,
        revision: 12,
        rules: {
          units: { assault: { baseDamage: 7 } },
          defenses: DEFAULT_RULES.defenses,
        },
      },
    });
  });
});
