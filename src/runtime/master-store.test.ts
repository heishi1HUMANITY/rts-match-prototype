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
        masterSchemaVersion: 7,
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
        masterSchemaVersion: 7,
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
    expect(loaded.envelope.masterSchemaVersion).toBe(7);
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
});
