import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { createMatch } from './match';
import { DEFAULT_RULES } from './rules';
import { stepMatch } from './step';
import { getFactionView } from './view';
import { getUnitFrames } from '../render/view-model';
import type { MatchState, UnitState } from './types';

function withUnits(state: MatchState, units: readonly UnitState[]): MatchState {
  return { ...state, phase: 'running', units: [...units] };
}

function unit(state: MatchState, id: string): UnitState {
  const found = state.units.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing unit ${id}`);
  return found;
}

describe('F18 base garrisons', () => {
  it('disables the garrison command and automatic parking when the master switch is off', () => {
    const initial = createMatch(42, {
      scenarioId: 'f18-garrison',
      rules: { ...structuredClone(DEFAULT_RULES), garrisonEnabled: false },
    });
    const hq = initial.bases.find(({ id }) => id === 'HQ-A')!;
    const requestState = withUnits(initial, [
      { ...unit(initial, 'A-01'), cell: { ...hq.cell } },
    ]);
    expect(
      applyCommand(requestState, 'A', {
        type: 'garrison',
        unitId: 'A-01',
        baseId: 'HQ-A',
      }),
    ).toMatchObject({ ok: false, reason: 'GARRISON_DISABLED' });

    let arrivalState = withUnits(initial, [
      {
        ...unit(initial, 'A-01'),
        cell: { x: hq.cell.x, y: hq.cell.y - 1 },
        path: [{ ...hq.cell }],
        moveTarget: { ...hq.cell },
      },
    ]);
    for (let tick = 0; tick < 20; tick += 1)
      arrivalState = stepMatch(arrivalState);
    expect(unit(arrivalState, 'A-01').cell).toEqual(hq.cell);
    expect(unit(arrivalState, 'A-01').garrisonedAtBaseId ?? null).toBeNull();
  });

  it('moves a ground unit to its owned base, parks it on arrival, and hides its frame', () => {
    const initial = createMatch(42, { scenarioId: 'f18-garrison' });
    const state = withUnits(initial, [unit(initial, 'A-01')]);
    const result = applyCommand(state, 'A', {
      type: 'garrison',
      unitId: 'A-01',
      baseId: 'HQ-A',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    let next = result.state;
    for (let i = 0; i < 2; i += 1) next = stepMatch(next);
    expect(unit(next, 'A-01')).toMatchObject({
      cell: { x: 6, y: 34 },
      path: [],
      garrisonedAtBaseId: 'HQ-A',
    });
    const view = getFactionView(next, 'A');
    expect(
      view.ownUnits.find(({ id }) => id === 'A-01')?.garrisonedAtBaseId,
    ).toBe('HQ-A');
    expect(
      getUnitFrames(view, view, 0).some(
        ({ unit: entry }) => entry.id === 'A-01',
      ),
    ).toBe(false);
    expect(stepMatch(next)).toEqual(stepMatch(structuredClone(next)));
  });

  it('rejects full, enemy-owned, and non-ground garrison requests without mutating state', () => {
    const clonedRules = structuredClone(DEFAULT_RULES);
    const rules = {
      ...clonedRules,
      bases: {
        ...clonedRules.bases,
        hq: { ...clonedRules.bases.hq, garrisonCapacity: 1 },
      },
    };
    const initial = createMatch(42, { scenarioId: 'f18-garrison', rules });
    const base = initial.bases.find(({ id }) => id === 'HQ-A')!;
    const atBase = initial.units.map((entry) =>
      entry.id === 'A-01' || entry.id === 'A-02'
        ? { ...entry, cell: { ...base.cell } }
        : entry,
    );
    const state = withUnits(initial, atBase);
    const first = applyCommand(state, 'A', {
      type: 'garrison',
      unitId: 'A-01',
      baseId: 'HQ-A',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(
      applyCommand(first.state, 'A', {
        type: 'garrison',
        unitId: 'A-02',
        baseId: 'HQ-A',
      }),
    ).toEqual({ ok: false, state: first.state, reason: 'GARRISON_FULL' });

    const enemyBaseState = {
      ...state,
      bases: state.bases.map((entry) =>
        entry.id === 'HQ-A' ? { ...entry, owner: 'B' as const } : entry,
      ),
    };
    expect(
      applyCommand(enemyBaseState, 'A', {
        type: 'garrison',
        unitId: 'A-01',
        baseId: 'HQ-A',
      }),
    ).toMatchObject({
      ok: false,
      state: enemyBaseState,
      reason: 'GARRISON_NOT_OWNED',
    });

    const waterUnitState = {
      ...state,
      units: state.units.map((entry) =>
        entry.id === 'A-01' ? { ...entry, kind: 'patrolBoat' as const } : entry,
      ),
    };
    expect(
      applyCommand(waterUnitState, 'A', {
        type: 'garrison',
        unitId: 'A-01',
        baseId: 'HQ-A',
      }),
    ).toMatchObject({ ok: false, reason: 'GARRISON_NOT_ALLOWED' });
  });

  it('clears the garrison slot on a move order and allows another unit to occupy it', () => {
    const initial = createMatch(42, { scenarioId: 'f18-garrison' });
    const hq = initial.bases.find(({ id }) => id === 'HQ-A')!;
    const state = withUnits(
      initial,
      initial.units.map((entry) =>
        entry.id === 'A-01' || entry.id === 'A-02'
          ? {
              ...entry,
              cell: { ...hq.cell },
              garrisonedAtBaseId: entry.id === 'A-01' ? 'HQ-A' : null,
            }
          : entry,
      ),
    );
    const exit = applyCommand(state, 'A', {
      type: 'move',
      unitId: 'A-01',
      target: { x: 7, y: 34 },
    });
    expect(exit.ok).toBe(true);
    if (!exit.ok) return;
    expect(unit(exit.state, 'A-01').garrisonedAtBaseId).toBeNull();
    const replacement = applyCommand(exit.state, 'A', {
      type: 'garrison',
      unitId: 'A-02',
      baseId: 'HQ-A',
    });
    expect(replacement.ok).toBe(true);
    if (replacement.ok)
      expect(unit(replacement.state, 'A-02').garrisonedAtBaseId).toBe('HQ-A');
  });

  it('lets a march-to-base attacker hit its live garrison before base structure', () => {
    const initial = createMatch(42, { scenarioId: 'f18-garrison' });
    const hq = initial.bases.find(({ id }) => id === 'HQ-A')!;
    const units = [
      {
        ...unit(initial, 'A-01'),
        cell: { ...hq.cell },
        garrisonedAtBaseId: 'HQ-A',
      },
      {
        ...unit(initial, 'B-01'),
        cell: { x: 6, y: 33 },
        marchOrder: {
          target: { kind: 'base' as const, id: 'HQ-A' },
          lastKnownCell: { ...hq.cell },
          lastSeenTick: 0,
          status: 'tracking' as const,
        },
      },
    ];
    const state = withUnits(initial, units);
    const next = stepMatch(state);
    expect(unit(next, 'A-01').hp).toBeLessThan(unit(state, 'A-01').hp);
    expect(next.bases.find(({ id }) => id === 'HQ-A')?.hp).toBe(hq.hp);
  });

  it('does not treat a parked unit as base defense while garrison is disabled', () => {
    const initial = createMatch(42, {
      scenarioId: 'f18-garrison',
      rules: { ...structuredClone(DEFAULT_RULES), garrisonEnabled: false },
    });
    const hq = initial.bases.find(({ id }) => id === 'HQ-A')!;
    const defender = {
      ...unit(initial, 'A-01'),
      cell: { ...hq.cell },
      garrisonedAtBaseId: 'HQ-A',
    };
    const attacker = {
      ...unit(initial, 'B-01'),
      cell: { x: hq.cell.x, y: hq.cell.y - 1 },
      marchOrder: {
        target: { kind: 'base' as const, id: 'HQ-A' },
        lastKnownCell: { ...hq.cell },
        lastSeenTick: 0,
        status: 'tracking' as const,
      },
    };
    const state = withUnits(initial, [defender, attacker]);
    const next = stepMatch(state);
    expect(unit(next, 'A-01').hp).toBe(unit(state, 'A-01').hp);
    expect(next.bases.find(({ id }) => id === 'HQ-A')?.hp).toBeLessThan(hq.hp);
  });

  it('releases surviving garrison units when combat destroys their base', () => {
    const clonedRules = structuredClone(DEFAULT_RULES);
    const rules = {
      ...clonedRules,
      units: {
        ...clonedRules.units,
        assault: {
          ...clonedRules.units.assault,
          attackTargets: ['base'] as const,
        },
      },
    };
    const initial = createMatch(42, { scenarioId: 'f18-garrison', rules });
    const outpost = initial.bases.find(({ id }) => id === 'HOME-A')!;
    const attacker = {
      ...unit(initial, 'B-01'),
      cell: { ...outpost.cell },
      marchOrder: {
        target: { kind: 'base' as const, id: outpost.id },
        lastKnownCell: { ...outpost.cell },
        lastSeenTick: 0,
        status: 'tracking' as const,
      },
    };
    const defender = {
      ...unit(initial, 'A-01'),
      cell: { ...outpost.cell },
      garrisonedAtBaseId: outpost.id,
    };
    const state = {
      ...withUnits(initial, [defender, attacker]),
      bases: initial.bases.map((base) =>
        base.id === outpost.id ? { ...base, owner: 'A' as const, hp: 1 } : base,
      ),
    };
    const next = stepMatch(state);
    expect(next.bases.find(({ id }) => id === outpost.id)?.owner).toBeNull();
    expect(unit(next, 'A-01')).toMatchObject({ garrisonedAtBaseId: null });
  });
});
