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

  it('requires each unit garrison setting to be boolean', () => {
    const result = validateRules({
      ...DEFAULT_RULES,
      units: {
        ...DEFAULT_RULES.units,
        assault: { ...DEFAULT_RULES.units.assault, canGarrison: 'false' },
      },
    });
    expect(result).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ key: 'rules.units.assault.canGarrison' }),
      ]),
    });
  });

  it('migrates master schema 14 with per-unit defaults', () => {
    const legacyRules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      unknown
    >;
    for (const value of Object.values(
      legacyRules.units as Record<string, Record<string, unknown>>,
    ))
      delete value.canGarrison;
    const result = validateEnvelope({
      masterSchemaVersion: 14,
      revision: 7,
      rules: legacyRules,
    });
    expect(result).toMatchObject({
      ok: true,
      envelope: {
        masterSchemaVersion: MASTER_SCHEMA_VERSION,
        revision: 7,
        rules: {
          units: {
            assault: { canGarrison: true },
            helicopter: { canGarrison: false },
          },
        },
      },
    });
  });

  it('migrates schema 15 global garrison setting to per-unit settings', () => {
    const rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    rules.garrisonEnabled = true;
    for (const value of Object.values(rules.units) as Record<string, any>[])
      delete value.canGarrison;
    const result = validateEnvelope({
      masterSchemaVersion: 15,
      revision: 8,
      rules,
    });
    expect(result).toMatchObject({
      ok: true,
      envelope: {
        rules: {
          units: {
            assault: { canGarrison: true },
            helicopter: { canGarrison: false },
          },
        },
      },
    });
  });

  it('rejects research cycles, one-sided exclusions, and unknown effect IDs', () => {
    const invalid = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    invalid.research.definitions['firepower-1'].prerequisites = ['firepower-2'];
    invalid.research.definitions['specialization-power'].exclusiveWith = [];
    invalid.research.definitions['survey-1'].effects[0].id = 'free-units';
    const result = validateRules(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map(({ key }) => key)).toEqual(
      expect.arrayContaining([
        'rules.research.definitions.firepower-1.prerequisites',
        'rules.research.definitions.specialization-power.exclusiveWith',
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
              attackTargets: [
                'unit',
                'defender',
                'base',
                'stronghold',
                'facility',
              ],
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
              attackTargets: ['unit', 'base', 'facility'],
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

describe('F21 variable research definitions', () => {
  const editable = () =>
    structuredClone(DEFAULT_RULES) as unknown as Record<string, any>;
  it('accepts an added stable ID and removing an unreferenced default node', () => {
    const rules = editable();
    delete rules.research.definitions['survey-2'];
    rules.research.definitions['specialization-information'].prerequisites = [
      'survey-1',
    ];
    rules.research.definitions['custom-power'] = {
      ...rules.research.definitions['firepower-1'],
      prerequisites: [],
    };
    const result = validateRules(rules);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rules.research.definitions['custom-power']).toEqual(
      rules.research.definitions['custom-power'],
    );
    expect(Object.hasOwn(result.rules.research.definitions, 'survey-2')).toBe(
      false,
    );
  });
  it('reports every dangling external reference when removing a node', () => {
    const rules = editable();
    delete rules.research.definitions['base-development-1'];
    delete rules.research.definitions['artillery-1'];
    const result = validateRules(rules);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'rules.baseUpgrades.level2ResearchId',
          message: expect.stringContaining('base-development-1'),
        }),
        expect.objectContaining({
          key: 'rules.units.artillery.unlockResearchId',
          message: expect.stringContaining('artillery-1'),
        }),
        expect.objectContaining({
          key: 'rules.research.definitions.base-development-2.prerequisites',
          message: expect.stringContaining('base-development-1'),
        }),
      ]),
    );
  });
  it.each(['Uppercase', 'contains.dot', '__proto__', 'a'.repeat(65), ''])(
    'rejects unsafe ID %s',
    (id) => {
      const rules = editable();
      Object.defineProperty(rules.research.definitions, id, {
        value: rules.research.definitions['firepower-1'],
        enumerable: true,
      });
      expect(validateRules(rules).ok).toBe(false);
    },
  );
  it('rejects too many nodes, invalid effect-specific values and unknown effects', () => {
    for (const effect of [
      { id: 'base-upgrade-max', value: 4 },
      { id: 'unit-unlock', value: 1, unitKind: 'artillery' },
      { id: 'crossing-unlock', value: 0, crossingTier: 'bridge-1' },
      { id: 'free-resources', value: 1 },
    ]) {
      const rules = editable();
      rules.research.definitions['custom'] = {
        ...rules.research.definitions['firepower-1'],
        effects: [effect],
      };
      expect(validateRules(rules).ok).toBe(false);
    }
  });
});

it('bounds variable node count and accepts many same-stage independent nodes', () => {
  const rules = structuredClone(DEFAULT_RULES) as unknown as Record<
    string,
    any
  >;
  for (let index = 0; index < 80; index += 1)
    rules.research.definitions[`node-${index}`] = {
      ...rules.research.definitions['firepower-1'],
      prerequisites: [],
    };
  expect(validateRules(rules).ok).toBe(true);
  for (let index = 80; index < 129; index += 1)
    rules.research.definitions[`node-${index}`] =
      rules.research.definitions['firepower-1'];
  expect(validateRules(rules).ok).toBe(false);
});

it('rejects inherited object names as references without throwing', () => {
  const rules = structuredClone(DEFAULT_RULES) as unknown as Record<
    string,
    any
  >;
  rules.research.definitions['firepower-1'].exclusiveWith = ['toString'];
  expect(validateRules(rules).ok).toBe(false);
});

it('rejects a research-reference array even when its coercion matches a valid ID', () => {
  const rules = structuredClone(DEFAULT_RULES) as unknown as Record<
    string,
    any
  >;
  rules.units.assault.unlockResearchId = ['firepower-1'];
  expect(validateRules(rules).ok).toBe(false);
});

describe('F11 and F21 combined migration contract', () => {
  it('migrates schema 21 defaults while preserving a user-edited research cost', () => {
    const v21Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    const definitions = v21Rules.research.definitions;
    delete definitions['firepower-3'];
    for (const id of Object.keys(definitions))
      if (id.startsWith('specialization-')) delete definitions[id];
    definitions['firepower-1'].costCenti = 6_000;
    definitions['firepower-2'].costCenti = 9_000;
    definitions['firepower-2'].prerequisites = ['firepower-1'];
    definitions['bridge-2'].prerequisites = ['firepower-1'];
    definitions['supply-lines-1'].exclusiveWith = ['maintenance-1'];

    const result = validateEnvelope({
      masterSchemaVersion: 21,
      revision: 11,
      rules: v21Rules,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.masterSchemaVersion).toBe(MASTER_SCHEMA_VERSION);
    expect(result.envelope.revision).toBe(11);
    expect(
      result.envelope.rules.research.definitions['firepower-1']!.costCenti,
    ).toBe(9_600);
    expect(
      result.envelope.rules.research.definitions['firepower-3'],
    ).toBeDefined();
    expect(
      result.envelope.rules.research.definitions['specialization-power'],
    ).toBeDefined();
    expect(
      result.envelope.rules.research.definitions['bridge-2']!.prerequisites,
    ).toEqual([]);
    expect(
      result.envelope.rules.research.definitions['supply-lines-1']!
        .exclusiveWith,
    ).toEqual([]);

    definitions['firepower-1'].costCenti = 7_777;
    const edited = validateEnvelope({
      masterSchemaVersion: 21,
      revision: 12,
      rules: v21Rules,
    });
    expect(edited.ok).toBe(true);
    if (edited.ok)
      expect(
        edited.envelope.rules.research.definitions['firepower-1']!.costCenti,
      ).toBe(7_777);
  });

  it('migrates schema 20 masters with default tactical ability rules', () => {
    const v20Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete v20Rules.tacticalAbilities;
    v20Rules.units.assault.costCenti = 4321;

    const result = validateEnvelope({
      masterSchemaVersion: 20,
      revision: 9,
      rules: v20Rules,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.masterSchemaVersion).toBe(MASTER_SCHEMA_VERSION);
    expect(result.envelope.revision).toBe(9);
    expect(result.envelope.rules.units.assault.costCenti).toBe(4321);
    expect(result.envelope.rules.tacticalAbilities).toEqual(
      DEFAULT_RULES.tacticalAbilities,
    );
  });

  it.each([11, 12])(
    'preserves arbitrary schema %i IDs, edits and deliberate removals',
    (version) => {
      const rules = structuredClone(DEFAULT_RULES) as unknown as Record<
        string,
        any
      >;
      delete rules.facilities;
      delete rules.research.definitions['survey-2'];
      for (const id of Object.keys(rules.research.definitions))
        if (id.startsWith('facility-')) delete rules.research.definitions[id];
      rules.research.definitions['custom-power'] = {
        ...rules.research.definitions['firepower-1'],
        costCenti: 4321,
      };
      const result = validateEnvelope({
        masterSchemaVersion: version,
        revision: 7,
        rules,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.envelope.masterSchemaVersion).toBe(MASTER_SCHEMA_VERSION);
      expect(
        result.envelope.rules.research.definitions['custom-power']!.costCenti,
      ).toBe(4321);
      expect(
        Object.hasOwn(result.envelope.rules.research.definitions, 'survey-2'),
      ).toBe(false);
      expect(
        Object.hasOwn(
          result.envelope.rules.research.definitions,
          'facility-turret',
        ),
      ).toBe(true);
      expect(result.envelope.rules.facilities).toEqual(
        DEFAULT_RULES.facilities,
      );
    },
  );
  it('validates custom facility unlocks and rejects nonzero unlock values or unknown facility kinds', () => {
    for (const effect of [
      { id: 'facility-unlock', value: 0, facilityKind: 'jammer' },
      { id: 'facility-unlock', value: 1, facilityKind: 'jammer' },
      { id: 'facility-unlock', value: 0, facilityKind: 'unknown' },
    ]) {
      const rules = structuredClone(DEFAULT_RULES) as unknown as Record<
        string,
        any
      >;
      rules.research.definitions['custom-facility'] = {
        ...rules.research.definitions['firepower-1'],
        effects: [effect],
      };
      expect(validateRules(rules).ok).toBe(
        effect.value === 0 && effect.facilityKind === 'jammer',
      );
    }
  });

  it('migrates schema 16 master to schema 17 by defaulting attack profile fields', () => {
    const v16Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    // Remove new F16 fields to simulate schema 16
    for (const unit of Object.values(v16Rules.units) as Record<string, any>[]) {
      delete unit.windupTicks;
      delete unit.intervalTicks;
      delete unit.canAttackWhileMoving;
    }
    for (const def of Object.values(v16Rules.defenses) as Record<
      string,
      any
    >[]) {
      if (typeof def === 'object' && def !== null) {
        delete def.windupTicks;
        delete def.intervalTicks;
        delete def.canAttackWhileMoving;
      }
    }
    for (const fac of Object.values(v16Rules.facilities.definitions) as Record<
      string,
      any
    >[]) {
      delete fac.windupTicks;
      delete fac.intervalTicks;
      delete fac.canAttackWhileMoving;
    }
    for (const kind of Object.values(v16Rules.baseUpgrades.kinds) as Record<
      string,
      any
    >[]) {
      for (const tier of Object.values(kind) as Record<string, any>[]) {
        delete tier.windupTicks;
        delete tier.intervalTicks;
        delete tier.canAttackWhileMoving;
      }
    }

    const result = validateEnvelope({
      masterSchemaVersion: 16,
      revision: 1,
      rules: v16Rules,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.masterSchemaVersion).toBe(MASTER_SCHEMA_VERSION);
    expect(result.envelope.rules.units.assault.windupTicks).toBe(0);
    expect(result.envelope.rules.units.assault.intervalTicks).toBe(1);
    expect(result.envelope.rules.units.assault.canAttackWhileMoving).toBe(true);
    expect(result.envelope.rules.units.artillery.windupTicks).toBe(0);
    expect(result.envelope.rules.units.artillery.intervalTicks).toBe(1);
    expect(result.envelope.rules.units.artillery.canAttackWhileMoving).toBe(
      true,
    );
    expect(result.envelope.rules.defenses.outpost.windupTicks).toBe(0);
    expect(result.envelope.rules.defenses.outpost.intervalTicks).toBe(1);
    expect(
      result.envelope.rules.facilities.definitions.turret.windupTicks,
    ).toBe(0);
    expect(result.envelope.rules.match.hqProtectionTicks).toBe(1200);
  });

  it('migrates schema 17 master to schema 18 by defaulting hqProtectionTicks', () => {
    const v17Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete v17Rules.match.hqProtectionTicks;

    const result = validateEnvelope({
      masterSchemaVersion: 17,
      revision: 1,
      rules: v17Rules,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.masterSchemaVersion).toBe(MASTER_SCHEMA_VERSION);
    expect(result.envelope.rules.match.hqProtectionTicks).toBe(1200);
  });

  it('migrates schema 18 master to schema 19 defaulting limits, decay, and upkeeps', () => {
    const v18Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    v18Rules.limits = {
      unitsPerFaction: 6,
      productionQueue: 3,
    };
    delete v18Rules.tickets.decay;
    v18Rules.match.hqLossTicketsCenti = 10_000;
    v18Rules.units.assault.upkeepCentiPerTick = 5; // old default

    const result = validateEnvelope({
      masterSchemaVersion: 18,
      revision: 1,
      rules: v18Rules,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.envelope.masterSchemaVersion).toBe(MASTER_SCHEMA_VERSION);
    expect(result.envelope.rules.limits.baseUnits).toBe(3);
    expect(result.envelope.rules.limits.unitsPerOwnedBase).toBe(1);
    expect(result.envelope.rules.limits.maxUnits).toBe(9);
    expect(result.envelope.rules.tickets.decay).toEqual(
      DEFAULT_RULES.tickets.decay,
    );
    expect(
      (result.envelope.rules.match as Record<string, unknown>)
        .hqLossTicketsCenti,
    ).toBeUndefined();
    expect(result.envelope.rules.units.assault.upkeepCentiPerTick).toBe(10);
  });

  it('rejects invalid attack profile values in rules validation', () => {
    const base = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    // negative windupTicks
    const invalidWindup = structuredClone(base);
    invalidWindup.units.assault.windupTicks = -1;
    expect(validateRules(invalidWindup).ok).toBe(false);

    // zero intervalTicks
    const invalidInterval = structuredClone(base);
    invalidInterval.units.assault.intervalTicks = 0;
    expect(validateRules(invalidInterval).ok).toBe(false);

    // fractional intervalTicks
    const fractionalInterval = structuredClone(base);
    fractionalInterval.units.assault.intervalTicks = 1.5;
    expect(validateRules(fractionalInterval).ok).toBe(false);
  });
});
