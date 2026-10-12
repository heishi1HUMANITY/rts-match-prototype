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
