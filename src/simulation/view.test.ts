import { describe, expect, it } from 'vitest';
import { getFactionView } from './view';
import { createMatch } from './match';
import {
  getUnitPositionX1024,
  getUnitPositionY1024,
  isUnitVisibleToFaction,
  updateFactionKnowledge,
} from './visibility';
import type { MatchState } from './types';

const withState = (
  state: MatchState,
  change: Partial<MatchState>,
): MatchState => ({ ...state, ...change });

describe('faction visibility and view isolation', () => {
  it('copies own march orders and never exposes enemy orders', () => {
    const initial = createMatch(42, { scenarioId: 'f02-pursuit' });
    const state: MatchState = {
      ...initial,
      units: initial.units.map((unit) => ({
        ...unit,
        marchOrder: {
          target: {
            kind: 'unit',
            id: unit.factionId === 'A' ? 'B-01' : 'A-01',
          },
          lastKnownCell: { x: 20, y: 20 },
          lastSeenTick: 0,
          status: 'tracking',
        },
      })),
    };
    const view = getFactionView(state, 'A');
    const source = state.units.find((unit) => unit.id === 'A-01')!.marchOrder!;
    const order = view.ownUnits.find((unit) => unit.id === 'A-01')!.marchOrder!;
    expect(order).toEqual(source);
    expect(order).not.toBe(source);
    expect(order.target).not.toBe(source.target);
    expect(order.lastKnownCell).not.toBe(source.lastKnownCell);
    expect(view.visibleEnemies.length).toBeGreaterThan(0);
    for (const enemy of view.visibleEnemies)
      expect(enemy).not.toHaveProperty('marchOrder');
  });

  it('initializes all faction masks and exploration at tick zero with inclusive doubled-radius boundaries', () => {
    const match = createMatch(42);
    expect(match.knowledge.map((entry) => entry.visible.length)).toEqual([
      1600, 1600, 1600, 1600,
    ]);
    expect(match.knowledge.map((entry) => entry.explored.length)).toEqual([
      1600, 1600, 1600, 1600,
    ]);
    expect(match.knowledge.map((entry) => entry.visible.some(Boolean))).toEqual(
      [true, true, true, false],
    );

    const factionA = match.knowledge.find(
      ({ factionId }) => factionId === 'A',
    )!;
    // The A scout is centered at (6, 21): x=14 is exactly 8 cells away.
    expect(factionA.visible[21 * 40 + 14]).toBe(true);
    expect(factionA.visible[21 * 40 + 15]).toBe(false);
  });

  it('uses half-cell doubled coordinates to reveal enemies at exact and outside sight radii', () => {
    const state = createMatch(42);
    const scout = state.units.find(({ id }) => id === 'A-02')!;
    const exact = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 14, y: 21 },
      path: [],
      edgeProgress: 0 as const,
    };
    const outside = { ...exact, cell: { x: 15, y: 21 } };
    const withExact = withState(state, {
      units: [...state.units.filter(({ id }) => id !== exact.id), exact],
    });
    const withOutside = withState(state, {
      units: [...state.units.filter(({ id }) => id !== outside.id), outside],
    });
    expect(getUnitPositionX1024(scout)).toBe(6656);
    expect(getUnitPositionY1024(scout)).toBe(22016);
    expect(isUnitVisibleToFaction(withExact, exact, 'A')).toBe(true);
    expect(isUnitVisibleToFaction(withOutside, outside, 'A')).toBe(false);

    const halfway = {
      ...exact,
      cell: { x: 13, y: 21 },
      path: [{ x: 14, y: 21 }],
      edgeProgress: 1 as const,
    };
    expect(getUnitPositionX1024(halfway)).toBe(14336);
    expect(
      isUnitVisibleToFaction(
        withState(state, { units: [scout, halfway] }),
        halfway,
        'A',
      ),
    ).toBe(true);
  });

  it('removes enemies from the current view when they become hidden', () => {
    const state = createMatch(42);
    const a = state.units.find(({ id }) => id === 'A-01')!;
    const enemy = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 8, y: 20 },
    };
    let next: MatchState = withState(state, { units: [a, enemy] });
    next = { ...next, knowledge: updateFactionKnowledge(next) };
    expect(
      getFactionView(next, 'A').visibleEnemies.map(({ id }) => id),
    ).toContain('B-01');
    const hidden = {
      ...enemy,
      cell: { x: 33, y: 33 },
      hp: 1,
      path: [{ x: 34, y: 33 }],
    };
    next = withState(next, { units: [a, hidden] });
    next = { ...next, knowledge: updateFactionKnowledge(next) };
    expect(getFactionView(next, 'A').visibleEnemies).toEqual([]);
  });

  it('keeps unknown bases distinct from remembered neutral bases', () => {
    const state = createMatch(42);
    const view = getFactionView(state, 'A');
    const unseen = view.bases.find(({ id }) => id === 'OUT-01')!;
    expect(unseen).toEqual({
      visibility: 'unknown',
      id: 'OUT-01',
      kind: 'outpost',
      cell: { x: 18, y: 17 },
      defenderHp: null,
      defenderMaxHp: null,
    });
    expect('owner' in unseen).toBe(false);
  });

  it('applies the same vision rules to A, B, and C', () => {
    const state = createMatch(42);
    for (const factionId of ['A', 'B', 'C'] as const) {
      const view = getFactionView(state, factionId);
      expect(view.ownUnits).toHaveLength(2);
      expect(view.ownUnits.every(({ control }) => control === 'own')).toBe(
        true,
      );
      expect(view.visible.length).toBe(1600);
      expect(view.explored.length).toBe(1600);
    }
  });

  it('does not leak changes to hidden enemy fields or detach view data from state', () => {
    const first = createMatch(42);
    const a = first.units.find(({ id }) => id === 'A-01')!;
    const b = first.units.find(({ id }) => id === 'B-01')!;
    const firstState = withState(first, { units: [a, b] });
    const alteredB = {
      ...b,
      hp: 1,
      cell: { x: 35, y: 10 },
      path: [{ x: 34, y: 10 }],
    };
    const secondState = withState(first, {
      units: [a, alteredB],
      factions: first.factions.map((faction) =>
        faction.id === 'B'
          ? {
              ...faction,
              supplyCenti: 999,
              researchCenti: 100,
              researchProgressCenti: {
                'firepower-1': 42,
                'firepower-2': 12,
                'bridge-2': 0,
                'bridge-3': 0,
                'ropeway-1': 0,
                'ropeway-2': 0,
              },
              productionJobs: [
                {
                  id: 'hidden',
                  baseId: 'HQ-B',
                  unitId: 'B-09',
                  unitKind: 'assault',
                  costCenti: 12000,
                  status: 'active' as const,
                  remainingTicks: 2,
                },
              ],
              activeResearch: { researchId: 'firepower-1' },
            }
          : faction,
      ),
    });
    const firstView = getFactionView(firstState, 'A');
    const secondView = getFactionView(secondState, 'A');
    expect(JSON.stringify(firstView)).toBe(JSON.stringify(secondView));
    expect(
      firstView.visibleEnemies.every(
        (enemy) =>
          Object.keys(enemy).sort().join(',') ===
          'control,factionId,hp,id,kind,maxHp,positionX1024,positionY1024',
      ),
    ).toBe(true);

    const detached = getFactionView(first, 'A');
    (detached.map.blocked as boolean[])[0] = !detached.map.blocked[0]!;
    (detached.visible as boolean[])[0] = !detached.visible[0]!;
    (detached.ownUnits[0]!.cell as { x: number; y: number }).x = 999;
    expect(first.map.blocked[0]).not.toBe(detached.map.blocked[0]);
    expect(first.knowledge[0]!.visible[0]).not.toBe(detached.visible[0]);
    expect(first.units[0]!.cell.x).not.toBe(999);
  });

  it('keeps self-reported base loss without revealing the new hidden owner', () => {
    let state = createMatch(42, { scenarioId: 'g2-economy' });
    const owned = state.bases.find(({ id }) => id === 'OUT-03')!;
    expect(
      getFactionView(state, 'A').bases.find(({ id }) => id === 'OUT-03')
        ?.visibility,
    ).toBe('owned');
    state = withState(state, {
      bases: state.bases.map((base) =>
        base.id === owned.id ? { ...base, owner: 'B', hp: 100 } : base,
      ),
    });
    state = { ...state, knowledge: updateFactionKnowledge(state) };
    const lost = getFactionView(state, 'A').bases.find(
      ({ id }) => id === 'OUT-03',
    )!;
    expect(lost).toMatchObject({
      visibility: 'remembered',
      owner: 'A',
      hp: 100,
      selfReportedLost: true,
    });
    expect(lost).not.toHaveProperty('captureProgressCentiTicks');
  });
});
