import { describe, expect, it } from 'vitest';
import { createMatch } from './match';
import { applyEconomyTick } from './economy';
import { supplyNetwork } from './supply';

function isolatedMapState() {
  const initial = createMatch(42);
  const wallX = 15;
  const terrain = new Array(initial.map.width * initial.map.height).fill(
    'land',
  );
  const blocked = new Array(initial.map.width * initial.map.height).fill(false);
  for (let y = 0; y < initial.map.height; y += 1)
    blocked[y * initial.map.width + wallX] = true;
  const site = initial.map.crossingSites!.find(
    ({ id }) => id === 'CROSS-BORDER-120-B2',
  )!;
  const bases = initial.bases.map((base) =>
    base.id === 'OUT-03'
      ? { ...base, owner: 'A' as const, hp: base.maxHp, defender: null }
      : base,
  );
  return {
    ...initial,
    units: [],
    map: { ...initial.map, terrain, blocked },
    bases,
    crossings: initial.crossings.map((crossing) =>
      crossing.siteId === site.id
        ? {
            ...crossing,
            owner: 'A' as const,
            hp: initial.rules.crossings[site.tier].maxHp,
            maxHp: initial.rules.crossings[site.tier].maxHp,
          }
        : crossing,
    ),
  };
}

describe('F12 supply network', () => {
  it('connects owned bases through complete owned crossings and recalculates on loss', () => {
    const state = isolatedMapState();
    expect(supplyNetwork(state, 'A').connectedBaseIds).toContain('OUT-03');
    const lost = {
      ...state,
      crossings: state.crossings.map((crossing) =>
        crossing.siteId === 'CROSS-BORDER-120-B2'
          ? { ...crossing, owner: null, hp: 0, maxHp: 0 }
          : crossing,
      ),
    };
    const disconnected = supplyNetwork(lost, 'A');
    expect(disconnected.connectedBaseIds).not.toContain('OUT-03');
    expect(disconnected.disconnectedBaseReasons['OUT-03']).toContain(
      'CROSS-BORDER-120-B2',
    );
  });

  it('applies the same crossing reachability rule to bot factions B and C', () => {
    const state = isolatedMapState();
    for (const factionId of ['B', 'C'] as const) {
      const forBot = {
        ...state,
        bases: state.bases.map((base) =>
          base.id === 'MID-02'
            ? { ...base, owner: factionId, hp: base.maxHp, defender: null }
            : base,
        ),
        crossings: state.crossings.map((crossing) =>
          crossing.siteId === 'CROSS-BORDER-120-B2'
            ? { ...crossing, owner: factionId }
            : crossing,
        ),
      };
      expect(supplyNetwork(forBot, factionId).connectedBaseIds).toContain(
        'MID-02',
      );
    }
  });

  it('reduces disconnected base supply income without changing research income', () => {
    const state = isolatedMapState();
    const disconnected = {
      ...state,
      crossings: state.crossings.map((crossing) =>
        crossing.siteId === 'CROSS-BORDER-120-B2'
          ? { ...crossing, owner: null, hp: 0, maxHp: 0 }
          : crossing,
      ),
      factions: state.factions.map((faction) =>
        faction.id === 'A'
          ? { ...faction, supplyCenti: 0, researchCenti: 0 }
          : faction,
      ),
      localFaction: { ...state.localFaction, active: false },
    };
    const result = applyEconomyTick(disconnected);
    const factionA = result.factions.find(({ id }) => id === 'A')!;
    // HQ 40 + home outpost 20 + disconnected outpost 20 * 50%.
    expect(factionA.supplyCenti).toBe(70);
    expect(factionA.researchCenti).toBe(
      state.rules.research.baseIncomeCentiPerTick + 20,
    );
  });
});
