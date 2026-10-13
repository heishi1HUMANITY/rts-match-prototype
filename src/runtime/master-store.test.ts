import { createMatch } from '../simulation/match';
import { applyCommand } from '../simulation/commands';
import { researchEffectValue, isUnitUnlocked } from '../simulation/research';
import { maximumBaseLevel } from '../simulation/base-upgrades';
import { replay, rulesContentId } from './diagnostics';
import { SCHEMA_VERSION } from '../simulation/config';
import { RULES_VERSION } from '../simulation/rules';
import type { CommandEntry } from './controller';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../simulation/rules';
import { MasterStore, type StorageLike } from './master-store';

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('quota');
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

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
      const damageBonus = definition.effects
        .filter((effect) => effect.id === 'damage-bonus')
        .reduce((sum, effect) => sum + effect.value, 0);
      const unlocksCrossing =
        definition.effects.find((effect) => effect.id === 'crossing-unlock')
          ?.crossingTier ?? null;
      return [
        id,
        {
          costCenti: definition.costCenti,
          prerequisite: definition.prerequisites[0] ?? null,
          damageBonus,
          unlocksCrossing,
        },
      ];
    }),
  );
}

describe('F17 browser master store', () => {
  it('migrates schema 11 capture settings without dropping saved edits', () => {
    const storage = new MemoryStorage();
    const { restoredHpPercent: _removed, ...capture } = DEFAULT_RULES.capture;
    storage.setItem(
      'rts-match-prototype.master.v1',
      JSON.stringify({
        masterSchemaVersion: 11,
        revision: 42,
        rules: {
          ...DEFAULT_RULES,
          capture: { ...capture, requiredTicks: 57 },
          npc: { ...DEFAULT_RULES.npc, decisionIntervalTicks: 60 },
        },
      }),
    );
    expect(new MasterStore(storage).load()).toMatchObject({
      ok: true,
      source: 'storage',
      envelope: {
        masterSchemaVersion: 17,
        revision: 42,
        rules: {
          capture: { requiredTicks: 57, restoredHpPercent: 30 },
          npc: { decisionIntervalTicks: 60 },
        },
      },
    });
  });

  it('round-trips garrison and capture settings and rejects bad saves/imports', () => {
    const storage = new MemoryStorage();
    const store = new MasterStore(storage);
    const rules = {
      ...DEFAULT_RULES,
      units: {
        ...DEFAULT_RULES.units,
        assault: { ...DEFAULT_RULES.units.assault, canGarrison: false },
      },
      capture: { ...DEFAULT_RULES.capture, restoredHpPercent: 50 },
    };
    expect(store.saveRules(rules).ok).toBe(true);
    const savedBytes = storage.getItem('rts-match-prototype.master.v1');
    const exported = store.exportJson();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(
      new MasterStore(new MemoryStorage()).importJson(exported.json),
    ).toMatchObject({
      ok: true,
      envelope: {
        rules: {
          units: { assault: { canGarrison: false } },
          capture: { restoredHpPercent: 50 },
        },
      },
    });
    for (const restoredHpPercent of [0, 101, 50.5, NaN, Infinity]) {
      const invalid = {
        ...rules,
        capture: { ...rules.capture, restoredHpPercent },
      };
      expect(store.saveRules(invalid).ok).toBe(false);
      expect(
        store.importJson(
          JSON.stringify({
            masterSchemaVersion: 13,
            revision: 8,
            rules: invalid,
          }),
        ).ok,
      ).toBe(false);
      expect(storage.getItem('rts-match-prototype.master.v1')).toBe(savedBytes);
    }
    expect(store.reset()).toMatchObject({
      ok: true,
      envelope: {
        rules: {
          units: { helicopter: { canGarrison: false } },
          capture: { restoredHpPercent: 30 },
        },
      },
    });
  });

  it('persists a complete validated rules envelope and round-trips portable JSON', () => {
    const storage = new MemoryStorage();
    const store = new MasterStore(storage);
    const changed = structuredClone(DEFAULT_RULES);
    const rules = {
      ...changed,
      units: {
        ...changed.units,
        scout: { ...changed.units.scout, costCenti: 7_000 },
      },
    };
    const saved = store.saveRules(rules);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.envelope.revision).toBe(1);
    expect(store.load()).toMatchObject({
      ok: true,
      source: 'storage',
      envelope: { rules: { units: { scout: { costCenti: 7_000 } } } },
    });
    const exported = store.exportJson();
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    store.reset();
    const imported = store.importJson(exported.json);
    expect(imported.ok).toBe(true);
    expect(store.load()).toMatchObject({
      ok: true,
      envelope: { rules: { units: { scout: { costCenti: 7_000 } } } },
    });
  });

  it('loads and upgrades schema 3 saved settings while preserving user values', () => {
    const storage = new MemoryStorage();
    const v3Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete v3Rules.defenses;
    v3Rules.research.definitions = legacyResearchDefinitions();
    v3Rules.units.scout.costCenti = 8_000;
    storage.values.set(
      'rts-match-prototype.master.v1',
      JSON.stringify({ masterSchemaVersion: 3, revision: 9, rules: v3Rules }),
    );
    const loaded = new MasterStore(storage).load();
    expect(loaded).toMatchObject({
      ok: true,
      source: 'storage',
      envelope: {
        masterSchemaVersion: 17,
        revision: 9,
        rules: {
          units: { scout: { costCenti: 8_000 } },
          defenses: DEFAULT_RULES.defenses,
        },
      },
    });
  });

  it('loads and upgrades schema 4 defense settings while preserving user values', () => {
    const storage = new MemoryStorage();
    const v4Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete v4Rules.defenses.respawnEnabled;
    v4Rules.research.definitions = legacyResearchDefinitions();
    v4Rules.defenses.medium.respawnTicks = 480;
    storage.values.set(
      'rts-match-prototype.master.v1',
      JSON.stringify({ masterSchemaVersion: 4, revision: 10, rules: v4Rules }),
    );
    const loaded = new MasterStore(storage).load();
    expect(loaded).toMatchObject({
      ok: true,
      source: 'storage',
      envelope: {
        masterSchemaVersion: 17,
        revision: 10,
        rules: {
          defenses: {
            respawnEnabled: true,
            medium: { respawnTicks: 480 },
          },
        },
      },
    });
  });

  it('migrates schema 6 research parameters into the registered effect tree', () => {
    const storage = new MemoryStorage();
    const v6Rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    v6Rules.research.definitions = {
      'firepower-1': {
        costCenti: 7_500,
        prerequisite: null,
        damageBonus: 2,
        unlocksCrossing: null,
      },
      'firepower-2': {
        costCenti: 9_000,
        prerequisite: 'firepower-1',
        damageBonus: 1,
        unlocksCrossing: null,
      },
      'bridge-2': {
        costCenti: 5_000,
        prerequisite: 'firepower-1',
        damageBonus: 0,
        unlocksCrossing: 'bridge-2',
      },
      'bridge-3': {
        costCenti: 7_000,
        prerequisite: 'bridge-2',
        damageBonus: 0,
        unlocksCrossing: 'bridge-3',
      },
      'ropeway-1': {
        costCenti: 4_000,
        prerequisite: null,
        damageBonus: 0,
        unlocksCrossing: 'ropeway-1',
      },
      'ropeway-2': {
        costCenti: 6_000,
        prerequisite: 'ropeway-1',
        damageBonus: 0,
        unlocksCrossing: 'ropeway-2',
      },
    };
    storage.values.set(
      'rts-match-prototype.master.v1',
      JSON.stringify({ masterSchemaVersion: 6, revision: 14, rules: v6Rules }),
    );
    const loaded = new MasterStore(storage).load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.envelope.masterSchemaVersion).toBe(17);
    expect(loaded.envelope.revision).toBe(14);
    expect(
      loaded.envelope.rules.research.definitions['firepower-1'],
    ).toMatchObject({
      costCenti: 7_500,
      domain: 'power',
      effects: [{ id: 'damage-bonus', value: 2 }],
    });
    expect(loaded.envelope.rules.research.definitions['survey-1']).toEqual(
      DEFAULT_RULES.research.definitions['survey-1'],
    );
  });

  it('keeps the previous valid bytes after invalid imports and failed writes', () => {
    const storage = new MemoryStorage();
    const store = new MasterStore(storage);
    const first = store.saveRules(DEFAULT_RULES);
    expect(first.ok).toBe(true);
    const before = storage.getItem('rts-match-prototype.master.v1');
    expect(store.importJson('{bad json').ok).toBe(false);
    expect(storage.getItem('rts-match-prototype.master.v1')).toBe(before);
    storage.failWrites = true;
    const saved = store.saveRules({
      ...DEFAULT_RULES,
      match: { ...DEFAULT_RULES.match, timeLimitTicks: 2_000 },
    });
    expect(saved.ok).toBe(false);
    expect(storage.getItem('rts-match-prototype.master.v1')).toBe(before);
  });

  it('upgrades schema 7 unit values and keeps the expanded research defaults', () => {
    const storage = new MemoryStorage();
    const legacy = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    for (const kind of ['artillery', 'antiAir', 'helicopter', 'patrolBoat'])
      delete legacy.units[kind];
    for (const unit of Object.values(legacy.units) as Record<string, any>[]) {
      const oldDamage = unit.baseDamage ?? 2;
      delete unit.movementDomain;
      delete unit.damageVsLand;
      delete unit.damageVsAir;
      delete unit.damageVsWater;
      delete unit.damageVsStructure;
      delete unit.lossTicketsCenti;
      delete unit.unlockResearchId;
      unit.baseDamage = oldDamage;
    }
    for (const id of ['artillery-1', 'air-defense-1', 'aircraft-1', 'naval-1'])
      delete legacy.research.definitions[id];
    legacy.units.assault.maxHp = 111;
    legacy.units.assault.baseDamage = 5;
    storage.setItem(
      'rts-match-prototype.master.v1',
      JSON.stringify({ masterSchemaVersion: 7, revision: 20, rules: legacy }),
    );
    const loaded = new MasterStore(storage).load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.envelope.rules.units.assault).toMatchObject({
      maxHp: 111,
      damageVsLand: 5,
      damageVsAir: 5,
      damageVsWater: 5,
      damageVsStructure: 5,
      movementDomain: 'land',
    });
    expect(loaded.envelope.rules.units.patrolBoat.unlockResearchId).toBe(
      'naval-1',
    );
    expect(loaded.envelope.rules.research.definitions['naval-1']).toBeDefined();
  });

  it('migrates schema 10 rules and adds F10 defaults without dropping edited values', () => {
    const storage = new MemoryStorage();
    const legacy = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete legacy.baseUpgrades;
    delete legacy.research.definitions['base-development-1'];
    delete legacy.research.definitions['base-development-2'];
    legacy.bases.outpost.supplyIncomeCentiPerTick = 27;
    storage.setItem(
      'rts-match-prototype.master.v1',
      JSON.stringify({ masterSchemaVersion: 10, revision: 31, rules: legacy }),
    );
    const loaded = new MasterStore(storage).load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.envelope).toMatchObject({
      masterSchemaVersion: 17,
      revision: 31,
      rules: {
        bases: { outpost: { supplyIncomeCentiPerTick: 27 } },
        baseUpgrades: { recoveryPerTick: 1, recoveryDelayTicks: 10 },
        research: {
          definitions: {
            'base-development-1': {
              effects: [{ id: 'base-upgrade-max', value: 2 }],
            },
            'base-development-2': {
              effects: [{ id: 'base-upgrade-max', value: 3 }],
            },
          },
        },
      },
    });
  });

  it('loads and upgrades schema 16 rules adding F16 attack profiles', () => {
    const storage = new MemoryStorage();
    const legacy = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    for (const unit of Object.values(legacy.units) as Record<string, any>[]) {
      delete unit.windupTicks;
      delete unit.intervalTicks;
      delete unit.canAttackWhileMoving;
    }
    for (const def of Object.values(legacy.defenses) as Record<string, any>[]) {
      if (typeof def === 'object' && def !== null) {
        delete def.windupTicks;
        delete def.intervalTicks;
        delete def.canAttackWhileMoving;
      }
    }
    legacy.units.assault.maxHp = 222;
    storage.setItem(
      'rts-match-prototype.master.v1',
      JSON.stringify({ masterSchemaVersion: 16, revision: 50, rules: legacy }),
    );
    const loaded = new MasterStore(storage).load();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.envelope).toMatchObject({
      masterSchemaVersion: 17,
      revision: 50,
      rules: {
        units: {
          assault: {
            maxHp: 222,
            windupTicks: 0,
            intervalTicks: 10,
            canAttackWhileMoving: true,
          },
        },
        defenses: {
          outpost: {
            windupTicks: 0,
            intervalTicks: 1,
            canAttackWhileMoving: true,
          },
        },
      },
    });
  });
});

describe('F21 master imports', () => {
  it('keeps variable IDs and intentional removals in schema11 migration and schema12 roundtrip', () => {
    const rules = structuredClone(DEFAULT_RULES) as unknown as Record<
      string,
      any
    >;
    delete rules.research.definitions['survey-2'];
    rules.research.definitions['custom-power'] = {
      ...rules.research.definitions['firepower-1'],
      costCenti: 1234,
    };
    const store = new MasterStore(new MemoryStorage());
    expect(
      store.importJson(
        JSON.stringify({ masterSchemaVersion: 11, revision: 12, rules }),
      ).ok,
    ).toBe(true);
    const result = store.load();
    expect(result.ok).toBe(true);
    expect(
      result.envelope.rules.research.definitions['custom-power']?.costCenti,
    ).toBe(1234);
    expect(
      Object.hasOwn(result.envelope.rules.research.definitions, 'survey-2'),
    ).toBe(false);
    const exported = store.exportJson();
    expect(exported.ok).toBe(true);
    if (exported.ok)
      expect(
        new MasterStore(new MemoryStorage()).importJson(exported.json).ok,
      ).toBe(true);
  });
  it('rejects duplicate research JSON keys and retains the stored bytes', () => {
    const storage = new MemoryStorage();
    const store = new MasterStore(storage);
    expect(store.saveRules(DEFAULT_RULES).ok).toBe(true);
    const before = storage.getItem('rts-match-prototype.master.v1');
    const exported = store.exportJson();
    if (!exported.ok) throw new Error('export failed');
    const json = exported.json.replace(
      '"definitions": {',
      '"definitions": {"firepower-1": {},',
    );
    expect(store.importJson(json)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_JSON' },
    });
    expect(storage.getItem('rts-match-prototype.master.v1')).toBe(before);
  });
});

it('applies custom-ID effects and replays the old snapshot after a different master is saved', () => {
  const rules = structuredClone(DEFAULT_RULES);
  const custom = {
    ...rules,
    match: { ...rules.match, initialResearchCenti: 1000 },
    research: {
      ...rules.research,
      definitions: {
        ...rules.research.definitions,
        'custom-effects': {
          domain: 'power' as const,
          stage: 1,
          costCenti: 123,
          prerequisites: [],
          exclusiveWith: [],
          effects: [
            { id: 'damage-bonus' as const, value: 7 },
            { id: 'vision-bonus' as const, value: 2 },
            { id: 'supply-income-bonus' as const, value: 4 },
            { id: 'upkeep-reduction' as const, value: 3 },
            {
              id: 'unit-unlock' as const,
              value: 0,
              unitKind: 'artillery' as const,
            },
            { id: 'base-upgrade-max' as const, value: 3 },
          ],
        },
      },
    },
  };
  const store = new MasterStore(new MemoryStorage());
  expect(store.saveRules(custom).ok).toBe(true);
  let state = createMatch(42, {
    scenarioId: 'standard',
    rules: store.load().envelope.rules,
  });
  const history: CommandEntry[] = [];
  for (const command of [
    { type: 'start' as const },
    { type: 'start-research' as const, researchId: 'custom-effects' },
  ]) {
    const result = applyCommand(state, 'A', command);
    expect(result.ok).toBe(true);
    history.push({
      seq: history.length + 1,
      actor: 'A',
      command,
      summary: '',
      tickBefore: 0,
      ok: result.ok,
    });
    state = result.state;
  }
  const faction = state.factions.find(({ id }) => id === 'A')!;
  expect(faction.researchCenti).toBe(877);
  expect(faction.completedResearchIds).toContain('custom-effects');
  expect(researchEffectValue(faction, state.rules, 'damage-bonus')).toBe(7);
  expect(researchEffectValue(faction, state.rules, 'vision-bonus')).toBe(2);
  expect(researchEffectValue(faction, state.rules, 'supply-income-bonus')).toBe(
    4,
  );
  expect(researchEffectValue(faction, state.rules, 'upkeep-reduction')).toBe(3);
  expect(isUnitUnlocked(faction, state.rules, 'artillery')).toBe(true);
  expect(maximumBaseLevel(faction, state.rules)).toBe(3);
  const before = structuredClone(state);
  expect(store.saveRules(DEFAULT_RULES).ok).toBe(true);
  expect(state).toEqual(before);
  expect(
    replay({
      schemaVersion: SCHEMA_VERSION,
      rulesVersion: RULES_VERSION,
      rules: state.rules,
      rulesContentId: rulesContentId(state.rules),
      scenarioId: state.scenarioId,
      seed: state.seed,
      history,
      finalTick: 0,
    }).state,
  ).toEqual(before);
});
