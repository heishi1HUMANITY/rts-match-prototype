import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { resolveCombat } from './combat';
import { createMatch, stepMatch } from './match';
import { DEFAULT_RULES } from './rules';
import { advanceResupply, triggerResupplyReturns } from './sustainment';
import type { MatchState, UnitState } from './types';

function running(): MatchState {
  const state = createMatch(42, {
    rules: {
      ...DEFAULT_RULES,
      match: { ...DEFAULT_RULES.match, hqProtectionTicks: 0 },
    },
  });
  return {
    ...state,
    phase: 'running',
    // Base anti-air batteries stay quiet so only unit fire is measured.
    bases: state.bases.map((base) => ({
      ...base,
      attack: { targetId: null, phase: 'cooldown', phaseEndsTick: 99_999 },
    })),
  };
}

const unit = (state: MatchState, id: string): UnitState =>
  state.units.find((entry) => entry.id === id)!;

/** A-01 faces B-01 on A's side of the river, outside resupply range. */
function duel(ammo: number): MatchState {
  const state = running();
  const a = unit(state, 'A-01');
  const b = unit(state, 'B-01');
  const cell = { x: 10, y: 14 };
  return {
    ...state,
    units: [
      { ...a, cell, path: [], edgeProgress: 0, ammo },
      {
        ...b,
        cell: { x: 11, y: 14 },
        path: [],
        edgeProgress: 0,
        attack: { targetId: null, phase: 'cooldown', phaseEndsTick: 99_999 },
      },
    ],
  };
}

describe('unit sustainment', () => {
  it('spends one shot per attack and fires at the depleted percent when empty', () => {
    const loaded = resolveCombat(duel(5));
    expect(unit(loaded, 'A-01').ammo).toBe(4);
    const fullDamage = unit(duel(5), 'B-01').hp - unit(loaded, 'B-01').hp;
    expect(fullDamage).toBe(DEFAULT_RULES.units.assault.damageVsLand);

    const empty = resolveCombat(duel(0));
    expect(unit(empty, 'A-01').ammo).toBe(0);
    expect(unit(duel(0), 'B-01').hp - unit(empty, 'B-01').hp).toBe(
      Math.floor(
        (DEFAULT_RULES.units.assault.damageVsLand *
          DEFAULT_RULES.sustainment.depletedDamagePercent) /
          100,
      ),
    );
  });

  it('returns to an owned base when a shot reaches the threshold, unless switched off', () => {
    const threshold = Math.ceil(
      (DEFAULT_RULES.units.assault.ammo *
        DEFAULT_RULES.sustainment.autoReturnThresholdPercent) /
        100,
    );
    const before = duel(threshold + 1);
    const after = triggerResupplyReturns(before, resolveCombat(before));
    const returning = unit(after, 'A-01');
    expect(returning.ammo).toBe(threshold);
    expect(returning.resupplyReturn).toBe(true);
    expect(returning.path.length).toBeGreaterThan(0);
    const destination = returning.moveTarget!;
    expect(
      after.bases.some(
        (base) =>
          base.owner === 'A' &&
          Math.abs(base.cell.x - destination.x) +
            Math.abs(base.cell.y - destination.y) <=
            DEFAULT_RULES.sustainment.resupplyRadius,
      ),
    ).toBe(true);

    const off = {
      ...before,
      units: before.units.map((entry) =>
        entry.id === 'A-01' ? { ...entry, autoResupply: false } : entry,
      ),
    };
    const stayed = unit(
      triggerResupplyReturns(off, resolveCombat(off)),
      'A-01',
    );
    expect(stayed.resupplyReturn).toBeUndefined();
    expect(stayed.path).toEqual([]);
  });

  it('keeps a unit holding a capture on the base instead of returning', () => {
    const threshold = Math.ceil(
      (DEFAULT_RULES.units.assault.ammo *
        DEFAULT_RULES.sustainment.autoReturnThresholdPercent) /
        100,
    );
    const duelState = duel(threshold + 1);
    const before: MatchState = {
      ...duelState,
      bases: duelState.bases.map((base) =>
        base.id === 'OUT-02'
          ? {
              ...base,
              cell: { x: 10, y: 14 },
              owner: null,
              hp: 0,
              defender: base.defender ? { ...base.defender, hp: 0 } : null,
            }
          : base,
      ),
    };
    const after = triggerResupplyReturns(before, resolveCombat(before));
    expect(unit(after, 'A-01').ammo).toBe(threshold);
    expect(unit(after, 'A-01').resupplyReturn).toBeUndefined();
    expect(unit(after, 'A-01').path).toEqual([]);
  });

  it('lets a manual order win over the return until the load runs out', () => {
    const threshold = Math.ceil(
      (DEFAULT_RULES.units.assault.ammo *
        DEFAULT_RULES.sustainment.autoReturnThresholdPercent) /
        100,
    );
    const before = duel(threshold + 1);
    const triggered = triggerResupplyReturns(before, resolveCombat(before));
    const moved = applyCommand(triggered, 'A', {
      type: 'move',
      unitId: 'A-01',
      target: { x: 10, y: 14 },
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(unit(moved.state, 'A-01').resupplyReturn).toBe(false);

    // A later shot above zero does not re-trigger; the last shot does.
    const nextShot = {
      ...moved.state,
      units: moved.state.units.map((entry) =>
        entry.id === 'A-01'
          ? {
              ...entry,
              path: [],
              moveTarget: null,
              attack: {
                targetId: null,
                phase: 'idle' as const,
                phaseEndsTick: 0,
              },
            }
          : entry,
      ),
    };
    const kept = triggerResupplyReturns(nextShot, resolveCombat(nextShot));
    expect(unit(kept, 'A-01').resupplyReturn).toBe(false);
    const last = {
      ...nextShot,
      units: nextShot.units.map((entry) =>
        entry.id === 'A-01' ? { ...entry, ammo: 1 } : entry,
      ),
    };
    const empty = triggerResupplyReturns(last, resolveCombat(last));
    expect(unit(empty, 'A-01')).toMatchObject({
      ammo: 0,
      resupplyReturn: true,
    });
  });

  it('restores one shot per interval near an owned base and ends the return when full', () => {
    const state = running();
    const hq = state.bases.find(({ id }) => id === 'HQ-A')!;
    const capacity = DEFAULT_RULES.units.assault.ammo;
    let next: MatchState = {
      ...state,
      elapsedTicks: 0,
      units: state.units.map((entry) =>
        entry.id === 'A-01'
          ? {
              ...entry,
              cell: { x: hq.cell.x + 1, y: hq.cell.y },
              path: [],
              ammo: capacity - 2,
              resupplyReturn: true,
            }
          : entry,
      ),
    };
    const interval = DEFAULT_RULES.sustainment.resupplyIntervalTicks;
    next = advanceResupply({ ...next, elapsedTicks: interval });
    expect(unit(next, 'A-01')).toMatchObject({
      ammo: capacity - 1,
      resupplyReturn: true,
    });
    next = advanceResupply({ ...next, elapsedTicks: interval + 1 });
    expect(unit(next, 'A-01').ammo).toBe(capacity - 1);
    next = advanceResupply({ ...next, elapsedTicks: interval * 2 });
    expect(unit(next, 'A-01')).toMatchObject({
      ammo: capacity,
      resupplyReturn: false,
    });
  });

  it('switches the automatic return per unit through the shared command', () => {
    const state = running();
    const off = applyCommand(state, 'A', {
      type: 'set-auto-resupply',
      unitId: 'A-01',
      enabled: false,
    });
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    expect(unit(off.state, 'A-01').autoResupply).toBe(false);
    expect(unit(off.state, 'A-02').autoResupply).toBeUndefined();
    const foreign = applyCommand(state, 'A', {
      type: 'set-auto-resupply',
      unitId: 'B-01',
      enabled: false,
    });
    expect(foreign.ok).toBe(false);
    expect(
      applyCommand(state, 'A', {
        type: 'set-auto-resupply',
        unitId: 'A-01',
        enabled: 'no',
      }).ok,
    ).toBe(false);
  });

  it('runs the whole loop in the simulation: deplete, return and refill', () => {
    let state = duel(DEFAULT_RULES.units.assault.ammo);
    state = {
      ...state,
      units: state.units.map((entry) =>
        entry.id === 'B-01' ? { ...entry, hp: 100_000, maxHp: 100_000 } : entry,
      ),
    };
    let returned = false;
    for (let tick = 0; tick < 3_000; tick += 1) {
      state = stepMatch(state);
      if (unit(state, 'A-01').resupplyReturn) returned = true;
      if (returned && !unit(state, 'A-01').resupplyReturn) break;
    }
    expect(returned).toBe(true);
    expect(unit(state, 'A-01').ammo).toBe(DEFAULT_RULES.units.assault.ammo);
  });
});
