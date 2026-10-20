import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { createMatch } from './match';
import { resolveCombat } from './combat';
import { getFactionView } from './view';
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
    expect(next.units.find(({ id }) => id === 'B-01')?.hp).toBe(180);
    expect(next.units.find(({ id }) => id === 'C-01')?.hp).toBe(200);
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
    expect(destroyed.bases.find(({ id }) => id === 'HQ-A')?.hp).toBe(1200);
    expect(destroyed.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      owner: null,
      hp: 800,
      captureCandidate: null,
      captureProgressCentiTicks: 0,
      defender: { hp: 160, maxHp: 160 },
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
      39_200,
    );
    expect(next.factions.find(({ id }) => id === 'B')?.ticketsCenti).toBe(
      39_200,
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
      hp: 800,
      captureCandidate: null,
      captureProgressCentiTicks: 0,
      defender: { hp: 160, maxHp: 160 },
    });
  });

  it('applies HQ loss once when multiple attackers overkill the same HQ', () => {
    let state = createMatch(42);
    const first = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 27, y: 33 },
    };
    const second = {
      ...state.units.find(({ id }) => id === 'A-02')!,
      cell: { x: 28, y: 32 },
    };
    state = removeAllBut(state, [first, second]);
    state = {
      ...state,
      elapsedTicks: 1200,
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
      ticketsCenti: 40_000,
      productionJobs: [],
      supplyCenti: 26_000,
    });
  });

  it('cancels windup without entering cooldown when target moves out of range', () => {
    let state = createMatch(42);
    const attacker: UnitState = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      kind: 'artillery',
      cell: { x: 20, y: 20 },
      attack: { targetId: 'B-01', phase: 'windup', phaseEndsTick: 15 },
    };
    const target: UnitState = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 26, y: 20 }, // out of artillery range (range 4)
      hp: 200,
      maxHp: 200,
    };
    state = removeAllBut(state, [attacker, target]);
    const after = resolveCombat(state);
    const nextAttacker = after.units.find(({ id }) => id === 'A-01')!;
    expect(nextAttacker.attack).toEqual({
      targetId: null,
      phase: 'idle',
      phaseEndsTick: 0,
    });
    expect(after.units.find(({ id }) => id === 'B-01')?.hp).toBe(200);
  });

  it('cancels windup when unit with canAttackWhileMoving: false is moving', () => {
    let state = createMatch(42);
    const attacker: UnitState = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      kind: 'artillery',
      cell: { x: 20, y: 20 },
      path: [{ x: 21, y: 20 }],
      edgeProgress: 1,
      attack: { targetId: 'B-01', phase: 'windup', phaseEndsTick: 15 },
    };
    const target: UnitState = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 22, y: 20 },
      hp: 200,
      maxHp: 200,
    };
    state = removeAllBut(state, [attacker, target]);
    const after = resolveCombat(state);
    const nextAttacker = after.units.find(({ id }) => id === 'A-01')!;
    expect(nextAttacker.attack).toEqual({
      targetId: null,
      phase: 'idle',
      phaseEndsTick: 0,
    });
    expect(after.units.find(({ id }) => id === 'B-01')?.hp).toBe(200);
  });

  it('two standard assault units duel for roughly 10 seconds (100 ticks) until mutual defeat', () => {
    let state = createMatch(42);
    state = {
      ...state,
      phase: 'running',
      // Neutral bases sit out of the way so only unit combat is measured.
      bases: state.bases.map((base) =>
        base.kind === 'hq'
          ? base
          : { ...base, defender: null, cell: { x: 0, y: 39 } },
      ),
    };
    const a: UnitState = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
      hp: 200,
      maxHp: 200,
      attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
    };
    const b: UnitState = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 22, y: 20 },
      hp: 200,
      maxHp: 200,
      attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
    };
    state = removeAllBut(state, [a, b]);

    // Tick 1: first attack deals 20 damage (HP 200 -> 180), enters cooldown until tick 11
    state = { ...state, elapsedTicks: 1 };
    state = resolveCombat(state);
    expect(state.units.find(({ id }) => id === 'A-01')?.hp).toBe(180);
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(180);
    expect(state.units.find(({ id }) => id === 'A-01')?.attack).toMatchObject({
      lastFiredTargetId: 'B-01',
      lastFiredTick: 1,
    });
    expect(state.units.find(({ id }) => id === 'A-01')?.attack?.phase).toBe(
      'cooldown',
    );
    expect(
      state.units.find(({ id }) => id === 'A-01')?.attack?.phaseEndsTick,
    ).toBe(11);

    // Ticks 2-10: cooldown, no damage dealt
    for (let tick = 2; tick <= 10; tick += 1) {
      state = { ...state, elapsedTicks: tick };
      state = resolveCombat(state);
      expect(state.units.find(({ id }) => id === 'A-01')?.hp).toBe(180);
      expect(state.units.find(({ id }) => id === 'A-01')?.attack).toMatchObject(
        {
          lastFiredTargetId: 'B-01',
          lastFiredTick: 1,
        },
      );
    }

    // Tick 11: second attack deals 20 damage (HP 180 -> 160)
    state = { ...state, elapsedTicks: 11 };
    state = resolveCombat(state);
    expect(state.units.find(({ id }) => id === 'A-01')?.hp).toBe(160);
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(160);

    // Advance through ticks until mutual elimination at tick 91 (10th shot)
    for (let tick = 12; tick <= 91; tick += 1) {
      state = { ...state, elapsedTicks: tick };
      state = resolveCombat(state);
    }
    // Both assault units destroyed at tick 91 (9.1 seconds / roughly 10s)
    expect(
      state.units.filter(({ id }) => id === 'A-01' || id === 'B-01'),
    ).toHaveLength(0);
  });

  it('protects HQs from attack and damage during hqProtectionTicks and enables damage afterward', () => {
    let state = createMatch(42);
    state = {
      ...state,
      phase: 'running',
    };
    const hqB = state.bases.find(({ id }) => id === 'HQ-B')!;
    expect(hqB.hp).toBe(1200);

    // Place an assault unit right next to HQ-B
    const attacker: UnitState = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: hqB.cell.x - 1, y: hqB.cell.y },
      attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
    };
    state = removeAllBut(state, [attacker]);

    // During protection (elapsedTicks < 1200), HQ cannot be targeted by auto-attack or march
    state = { ...state, elapsedTicks: 100 };
    const marchCmd = applyCommand(state, 'A', {
      type: 'march',
      unitId: 'A-01',
      target: { kind: 'base', id: 'HQ-B' },
    });
    expect(marchCmd).toMatchObject({ ok: false, reason: 'HQ_PROTECTED' });

    // Combat resolution: attacker should remain idle because HQ is protected
    const afterCombatProtected = resolveCombat(state);
    expect(
      afterCombatProtected.units.find(({ id }) => id === 'A-01')?.attack?.phase,
    ).toBe('idle');
    expect(afterCombatProtected.bases.find(({ id }) => id === 'HQ-B')?.hp).toBe(
      1200,
    );

    // After protection expires (elapsedTicks >= 1200), HQ can be attacked and damaged
    state = { ...state, elapsedTicks: 1200 };
    const marchCmdExpired = applyCommand(state, 'A', {
      type: 'march',
      unitId: 'A-01',
      target: { kind: 'base', id: 'HQ-B' },
    });
    expect(marchCmdExpired.ok).toBe(true);
    if (!marchCmdExpired.ok) return;

    state = resolveCombat(marchCmdExpired.state);
    const updatedHq = state.bases.find(({ id }) => id === 'HQ-B')!;
    expect(updatedHq.hp).toBeLessThan(1200);
    expect(updatedHq.hp).toBe(1180); // deals 20 structure damage
  });
});

describe('wind-up attacks on a defeated neutral base', () => {
  it('lets artillery finish its wind-up and damage a neutral base whose defender is down', () => {
    const start = createMatch(42);
    const base = start.bases.find(({ id }) => id === 'OUT-02')!;
    const artillery: UnitState = {
      ...start.units.find(({ id }) => id === 'A-01')!,
      kind: 'artillery',
      maxHp: start.rules.units.artillery.maxHp,
      hp: start.rules.units.artillery.maxHp,
      cell: { ...base.cell },
      path: [],
      edgeProgress: 0,
    };
    let state: MatchState = {
      ...start,
      phase: 'running',
      units: [artillery],
      bases: start.bases.map((entry) =>
        entry.id === base.id
          ? {
              ...entry,
              owner: null,
              hp: 185,
              defender: entry.defender ? { ...entry.defender, hp: 0 } : null,
            }
          : // Other neutral defenders in range would be chosen first.
            { ...entry, defender: null },
      ),
    };
    const windup = start.rules.units.artillery.windupTicks;
    expect(windup).toBeGreaterThan(0);
    for (let tick = 0; tick <= windup; tick += 1) {
      state = resolveCombat(state);
      state = { ...state, elapsedTicks: state.elapsedTicks + 1 };
    }
    expect(state.bases.find(({ id }) => id === base.id)!.hp).toBe(
      185 - start.rules.units.artillery.damageVsStructure,
    );
  });
});

describe('unit loss causes', () => {
  it('records the source of a lethal hit and shows it only to the loser', () => {
    const start = createMatch(42);
    const a = {
      ...start.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
      hp: 1,
    };
    const b = {
      ...start.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 21, y: 20 },
    };
    const state: MatchState = {
      ...start,
      phase: 'running',
      units: [a, b],
      bases: start.bases.map((base) =>
        base.kind === 'hq'
          ? base
          : { ...base, defender: null, cell: { x: 0, y: 39 } },
      ),
    };
    const next = resolveCombat(state);
    expect(next.unitLossLog).toEqual([
      {
        tick: 0,
        unitId: 'A-01',
        factionId: 'A',
        kind: 'assault',
        cell: { x: 20, y: 20 },
        cause: 'unit:assault',
        killerFactionId: 'B',
      },
    ]);
    expect(getFactionView(next, 'A').ownLosses).toHaveLength(1);
    expect(getFactionView(next, 'B').ownLosses).toEqual([]);
    expect(getFactionView(next, 'B').ownKills).toHaveLength(1);
    expect(getFactionView(next, 'C').ownKills).toEqual([]);
  });
});
