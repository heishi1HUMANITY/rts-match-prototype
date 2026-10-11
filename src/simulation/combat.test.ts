import { describe, expect, it } from 'vitest';
import { createMatch } from './match';
import { resolveCombat } from './combat';
import type { MatchState, UnitState } from './types';

const removeAllBut = (state: MatchState, units: UnitState[]): MatchState => ({
  ...state,
  units,
});

describe('simultaneous combat target selection', () => {
  it('prefers units, then breaks equal-distance ties by stable unit ID', () => {
    let state = createMatch(42);
    const attacker = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
    };
    const b = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 21, y: 20 },
    };
    const c = {
      ...state.units.find(({ id }) => id === 'C-01')!,
      cell: { x: 19, y: 20 },
    };
    state = removeAllBut(state, [attacker, c, b]);
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'OUT-02' ? { ...base, owner: 'B', hp: 100 } : base,
      ),
    };
    const next = resolveCombat(state);
    expect(next.units.find(({ id }) => id === 'B-01')?.hp).toBe(98);
    expect(next.units.find(({ id }) => id === 'C-01')?.hp).toBe(100);
    expect(next.bases.find(({ id }) => id === 'OUT-02')?.hp).toBe(100);
  });

  it('fires on a visible enemy base when no enemy unit is in range and neutral bases are ignored', () => {
    let state = createMatch(42);
    const attacker = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 19, y: 20 },
    };
    state = removeAllBut(state, [attacker]);
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'OUT-02'
          ? { ...base, owner: 'B', hp: 1 }
          : base.id === 'HQ-A'
            ? { ...base, cell: { x: 18, y: 20 } }
            : base,
      ),
    };
    const destroyed = resolveCombat(state);
    expect(destroyed.bases.find(({ id }) => id === 'HQ-A')?.hp).toBe(300);
    expect(destroyed.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      owner: null,
      hp: 0,
      captureCandidate: null,
      captureTicks: 0,
    });

    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'OUT-02' ? { ...base, owner: null, hp: 0 } : base,
      ),
    };
    const neutral = resolveCombat(state);
    expect(neutral.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      owner: null,
      hp: 0,
    });
  });

  it('applies damage from the same snapshot even when both units die', () => {
    let state = createMatch(42, { scenarioId: 'g2-combat' });
    const a = { ...state.units.find(({ id }) => id === 'A-01')!, hp: 2 };
    const b = { ...state.units.find(({ id }) => id === 'B-01')!, hp: 2 };
    state = removeAllBut(state, [b, a]);
    const next = resolveCombat(state);
    expect(next.units.some(({ id }) => id === 'A-01' || id === 'B-01')).toBe(
      false,
    );
    expect(next.factions.find(({ id }) => id === 'A')?.ticketsCenti).toBe(
      99_200,
    );
    expect(next.factions.find(({ id }) => id === 'B')?.ticketsCenti).toBe(
      99_200,
    );
  });

  it('can destroy an owned outpost while its final attacker dies in the same snapshot', () => {
    let state = createMatch(42);
    const scout = {
      ...state.units.find(({ id }) => id === 'A-02')!,
      cell: { x: 19, y: 20 },
      hp: 2,
    };
    const defender = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 21, y: 20 },
    };
    state = removeAllBut(state, [scout, defender]);
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'OUT-02' ? { ...base, owner: 'B', hp: 1 } : base,
      ),
    };
    const next = resolveCombat(state);
    expect(next.units.some(({ id }) => id === 'A-02')).toBe(false);
    expect(next.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      owner: null,
      hp: 0,
      captureCandidate: null,
      captureTicks: 0,
    });
  });

  it('applies HQ loss once when multiple attackers overkill the same HQ', () => {
    let state = createMatch(42);
    const first = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 32, y: 33 },
    };
    const second = {
      ...state.units.find(({ id }) => id === 'A-02')!,
      cell: { x: 32, y: 34 },
    };
    state = removeAllBut(state, [first, second]);
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'HQ-B' ? { ...base, hp: 1 } : base,
      ),
      factions: state.factions.map((faction) =>
        faction.id === 'B'
          ? {
              ...faction,
              productionJobs: [
                {
                  id: 'B-J01',
                  baseId: 'HQ-B',
                  unitId: 'B-03',
                  unitKind: 'scout' as const,
                  costCenti: 6_000,
                  status: 'active' as const,
                  remainingTicks: 1,
                },
              ],
            }
          : faction,
      ),
    };
    const next = resolveCombat(state);
    expect(next.bases.find(({ id }) => id === 'HQ-B')).toMatchObject({
      owner: 'B',
      homeFactionId: 'B',
      hp: 0,
    });
    expect(next.factions.find(({ id }) => id === 'B')).toMatchObject({
      ticketsCenti: 90_000,
      productionJobs: [],
      supplyCenti: 26_000,
    });
  });
});
