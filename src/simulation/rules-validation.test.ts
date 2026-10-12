import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, MASTER_SCHEMA_VERSION } from './rules';
import { validateEnvelope, validateRules } from './rules-validation';

function legacyResearchDefinitions() {
  return Object.fromEntries(
    [
      'firepower-1',
      'firepower-2',
      'bridge-2',
      'bridge-3',
      'ropeway-1',
      'ropeway-2',
    ].map((id) => {
      const definition = DEFAULT_RULES.research.definitions[id]!;
      return [
        id,
        {
          costCenti: definition.costCenti,
          prerequisite: definition.prerequisites[0] ?? null,
          damageBonus: definition.effects
            .filter((effect) => effect.id === 'damage-bonus')
            .reduce((sum, effect) => sum + effect.value, 0),
          unlocksCrossing:
            definition.effects.find((effect) => effect.id === 'crossing-unlock')
              ?.crossingTier ?? null,
        },
      ];
    }),
  );
}

describe('F03 rules validation', () => {
  it.each([0, -1, 101, 50.5, NaN, Infinity, -Infinity])(
    'rejects invalid capture HP percent %s',
    (restoredHpPercent) => {
      const result = validateRules({
        ...DEFAULT_RULES,
        capture: { ...DEFAULT_RULES.capture, restoredHpPercent },
      });
      expect(result).toMatchObject({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ key: 'rules.capture.restoredHpPercent' }),
        ]),
      });
    },
  );

  it('returns a detached canonical default-shaped snapshot', () => {
    const result = validateRules(DEFAULT_RULES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rules).toEqual(DEFAULT_RULES);
    expect(result.rules).not.toBe(DEFAULT_RULES);
    expect(result.rules.units.assault).not.toBe(DEFAULT_RULES.units.assault);
  });

  it('rejects research cycles, one-sided exclusions, and unknown effect IDs', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.research.definitions['firepower-1'].prerequisites = ['firepower-2'];
    invalid.research.definitions['supply-lines-1'].exclusiveWith = [];
    invalid.research.definitions['survey-1'].effects[0].id = 'free-units';
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'rules.research.definitions.firepower-1.prerequisites',
        'rules.research.definitions.maintenance-1.exclusiveWith',
        'rules.research.definitions.survey-1.effects.0.id',
      ]),
    );
  });

  it('rejects unknown keys, fractional cents, zero movement interval, and prerequisite cycles', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.extra = true;
    invalid.units.assault.costCenti = 1.5;
    invalid.npc.decisionIntervalTicks = 0;
    invalid.research.definitions['firepower-1'].prerequisites = ['firepower-2'];
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'rules.extra',
        'rules.units.assault.costCenti',
        'rules.npc.decisionIntervalTicks',
        'rules.research.definitions.firepower-1.prerequisites',
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

  it('requires the garrison respawn setting to be a boolean', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.defenses.respawnEnabled = 'false';
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toContain(
      'rules.defenses.respawnEnabled',
    );
  });

  it('validates editable attack target sets and capture flags', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.units.helicopter.attackTargets = ['unit', 'unknown', 'unit'];
    invalid.units.helicopter.canCaptureBase = 'true';
    invalid.units.helicopter.captureEfficiencyPercent = 1001;
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'rules.units.helicopter.attackTargets',
        'rules.units.helicopter.canCaptureBase',
        'rules.units.helicopter.captureEfficiencyPercent',
      ]),
    );
  });

  it('migrates schema 8 unit attack profiles to editable F08 defaults', () => {
    const v8Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    for (const unit of Object.values(v8Rules.units) as Record<string, any>[]) {
      delete unit.attackTargets;
      delete unit.canCaptureBase;
      delete unit.captureEfficiencyPercent;
    }
    v8Rules.units.helicopter.maxHp = 95;
    const result = validateEnvelope({
      masterSchemaVersion: 8,
      revision: 28,
      rules: v8Rules,
    });
    expect(result).toMatchObject({
      ok: true,
      envelope: {
        masterSchemaVersion: MASTER_SCHEMA_VERSION,
        revision: 28,
        rules: {
          units: {
            helicopter: {
              maxHp: 95,
              attackTargets: ['unit', 'defender', 'base', 'stronghold'],
              canCaptureBase: false,
            },
          },
        },
      },
    });
  });

  it('preserves schema 9 target and capture settings while defaulting efficiency', () => {
    const v9Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    for (const unit of Object.values(v9Rules.units) as Record<string, any>[])
      delete unit.captureEfficiencyPercent;
    v9Rules.units.helicopter.attackTargets = ['unit', 'base'];
    v9Rules.units.helicopter.canCaptureBase = true;
    const result = validateEnvelope({
      masterSchemaVersion: 9,
      revision: 29,
      rules: v9Rules,
    });
    expect(result).toMatchObject({
      ok: true,
      envelope: {
        masterSchemaVersion: MASTER_SCHEMA_VERSION,
        revision: 29,
        rules: {
          units: {
            helicopter: {
              attackTargets: ['unit', 'base'],
              canCaptureBase: true,
              captureEfficiencyPercent: 100,
            },
          },
        },
      },
    });
  });

  it('rejects impossible local-faction limits, appearance and overflow growth', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.localFaction.initialUnits = 9;
    invalid.localFaction.maxUnits = 8;
    invalid.match.timeLimitTicks = 100_000_000;
    invalid.localFaction.appearanceTick = invalid.match.timeLimitTicks + 1;
    invalid.localFaction.growthPercentPerMinute = 1_000_000_000;
    invalid.units.assault.maxHp = 1_000_000_000;
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'rules.localFaction.initialUnits',
        'rules.localFaction.appearanceTick',
        'rules.localFaction.growthPercentPerMinute',
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
    v3Rules.research.definitions = legacyResearchDefinitions();
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
          units: {
            assault: {
              damageVsLand: 7,
              damageVsAir: 7,
              damageVsWater: 7,
              damageVsStructure: 7,
            },
          },
          defenses: DEFAULT_RULES.defenses,
        },
      },
    });
  });

  it('migrates schema 4 defense values and enables the prior respawn behavior', () => {
    const v4Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete v4Rules.defenses.respawnEnabled;
    v4Rules.research.definitions = legacyResearchDefinitions();
    v4Rules.defenses.outpost.respawnTicks = 525;
    const result = validateEnvelope({
      masterSchemaVersion: 4,
      revision: 17,
      rules: v4Rules,
    });
    expect(result).toMatchObject({
      ok: true,
      envelope: {
        masterSchemaVersion: MASTER_SCHEMA_VERSION,
        revision: 17,
        rules: {
          defenses: {
            respawnEnabled: true,
            outpost: { respawnTicks: 525 },
          },
        },
      },
    });
  });

  it('adds F06 defaults when upgrading a schema 5 master', () => {
    const v5Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete v5Rules.localFaction;
    v5Rules.research.definitions = legacyResearchDefinitions();
    const result = validateEnvelope({
      masterSchemaVersion: 5,
      revision: 21,
      rules: v5Rules,
    });
    expect(result).toMatchObject({
      ok: true,
      envelope: {
        masterSchemaVersion: MASTER_SCHEMA_VERSION,
        revision: 21,
        rules: { localFaction: DEFAULT_RULES.localFaction },
      },
    });
  });
});
