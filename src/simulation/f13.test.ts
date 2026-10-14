import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { createMatch } from './match';
import { DEFAULT_RULES } from './rules';
import { advanceProduction } from './production';
import { resolveCombat } from './combat';
import { stepMatch, stepUnit } from './step';
import type { UnitState } from './types';

const started = (
  scenarioId: 'standard' | 'g2-combat' | 'f13-behavior' = 'standard',
) => {
  const state = createMatch(42, { scenarioId });
  const result = applyCommand(state, 'A', { type: 'start' });
  if (!result.ok) throw new Error('match start failed');
  return result.state;
};

describe('F13 unit behavior', () => {
  it('applies selected stance and master-defined movement profile', () => {
    const state = started();
    const result = applyCommand(state, 'A', {
      type: 'set-stance',
      unitId: 'A-01',
      stance: 'retreat',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const unit = result.state.units.find(({ id }) => id === 'A-01')!;
    expect(unit).toMatchObject({ stance: 'retreat', retreating: true });
    const moving = { ...unit, path: [{ x: 7, y: 20 }] };
    expect(stepUnit(moving, result.state).edgeProgress).toBe(1);
    expect(
      stepUnit(
        {
          ...moving,
          stance: 'aggressive',
          edgeProgress: (unit.moveTicksPerCell ?? 2) - 1,
        },
        result.state,
      ).cell,
    ).toEqual({ x: 6, y: 20 });
    expect(
      result.state.rules.unitBehavior.stanceProfiles.retreat.movementPercent,
    ).toBe(80);
    const combatState = started('g2-combat');
    const damageByStance = (stance: 'aggressive' | 'hold' | 'retreat') => {
      const combat = resolveCombat({
        ...combatState,
        units: combatState.units.map((item) =>
          item.id === 'A-01' ? { ...item, stance } : item,
        ),
      });
      return 40 - combat.units.find(({ id }) => id === 'B-01')!.hp;
    };
    expect(damageByStance('aggressive')).toBe(damageByStance('hold'));
    expect(damageByStance('hold')).toBeGreaterThan(damageByStance('retreat'));
    const autoRetreat = resolveCombat({
      ...combatState,
      units: combatState.units.map((item) =>
        item.id === 'A-01'
          ? { ...item, stance: 'aggressive' as const, retreating: true }
          : item,
      ),
    });
    expect(40 - autoRetreat.units.find(({ id }) => id === 'B-01')!.hp).toBe(
      damageByStance('retreat'),
    );
    const movementState = started();
    const movementSample: UnitState = {
      ...movementState.units.find(({ id }) => id === 'A-01')!,
      path: [{ x: 7, y: 20 }],
    };
    const aggressiveTicks = movementSample.moveTicksPerCell ?? 2;
    const advanceTicks = (unit: UnitState, ticks: number): UnitState => {
      let current = unit;
      for (let tick = 0; tick < ticks; tick += 1)
        current = stepUnit(current, movementState);
      return current;
    };
    expect(
      advanceTicks({ ...movementSample, retreating: true }, aggressiveTicks)
        .cell,
    ).toEqual(movementSample.cell);
    expect(advanceTicks(movementSample, aggressiveTicks).cell).toEqual({
      x: 7,
      y: 20,
    });
  });

  it('stores a valid rally point and sends the next production unit there', () => {
    const rules = {
      ...DEFAULT_RULES,
      units: {
        ...DEFAULT_RULES.units,
        assault: { ...DEFAULT_RULES.units.assault, buildTicks: 1 },
      },
    };
    let state = createMatch(42, { rules });
    const start = applyCommand(state, 'A', { type: 'start' });
    if (!start.ok) throw new Error('match start failed');
    state = start.state;
    const rally = applyCommand(state, 'A', {
      type: 'set-rally',
      target: { x: 7, y: 20 },
    });
    expect(rally.ok).toBe(true);
    if (!rally.ok) return;
    const enqueue = applyCommand(rally.state, 'A', {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    });
    expect(enqueue.ok).toBe(true);
    if (!enqueue.ok) return;
    const spawned = advanceProduction(enqueue.state).units.find(
      ({ id }) => id === 'A-03',
    );
    expect(spawned).toMatchObject({
      moveTarget: { x: 7, y: 20 },
      path: [
        { x: 6, y: 20 },
        { x: 7, y: 20 },
      ],
    });
    expect(
      applyCommand(rally.state, 'A', {
        type: 'set-rally',
        target: { x: 99, y: 99 },
      }),
    ).toMatchObject({ ok: false, reason: 'OUT_OF_BOUNDS' });
  });

  it('retreats below the master HP threshold and recovers only while at the HQ', () => {
    const state = started('f13-behavior');
    const next = stepMatch(state);
    const retreating = next.units.find(({ id }) => id === 'A-01')!;
    expect(retreating.retreating).toBe(true);
    expect(retreating.moveTarget).toEqual(
      next.bases.find(({ id }) => id === 'HQ-A')!.cell,
    );

    const nearHq = {
      ...state,
      elapsedTicks: 9,
      units: state.units.map((unit) =>
        unit.id === 'A-01'
          ? { ...unit, hp: 50, cell: { x: 5, y: 20 }, retreating: true }
          : unit,
      ),
    };
    const recovered = stepMatch(nearHq).units.find(({ id }) => id === 'A-01')!;
    expect(recovered.hp).toBeGreaterThan(50);
    const away = {
      ...nearHq,
      units: nearHq.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: { x: 10, y: 20 } } : unit,
      ),
    };
    expect(stepMatch(away).units.find(({ id }) => id === 'A-01')!.hp).toBe(50);

    const ordered = applyCommand(state, 'A', {
      type: 'move',
      unitId: 'A-01',
      target: { x: 7, y: 20 },
    });
    expect(ordered.ok).toBe(true);
    if (ordered.ok) {
      const moved = stepMatch(ordered.state).units.find(
        ({ id }) => id === 'A-01',
      )!;
      expect(moved.retreating).toBe(false);
      expect(moved.moveTarget).toEqual({ x: 7, y: 20 });
    }
  });

  it('keeps a manually selected retreat stance and routes the unit to its HQ', () => {
    const state = started();
    const command = applyCommand(state, 'A', {
      type: 'set-stance',
      unitId: 'A-01',
      stance: 'retreat',
    });
    expect(command.ok).toBe(true);
    if (!command.ok) return;
    const next = stepMatch(command.state);
    const unit = next.units.find(({ id }) => id === 'A-01')!;
    expect(unit.retreating).toBe(true);
    expect(unit.moveTarget).toEqual(
      next.bases.find(({ id }) => id === 'HQ-A')!.cell,
    );
  });

  it('awards bounded, replay-local experience from effective unit damage', () => {
    const state = started('g2-combat');
    const rules = {
      ...state.rules,
      unitBehavior: {
        ...state.rules.unitBehavior,
        experiencePerDamageCenti: 10_000,
      },
    };
    const combat = resolveCombat({ ...state, rules });
    const attacker = combat.units.find(({ id }) => id === 'A-01')!;
    expect(attacker.experienceCenti).toBeGreaterThan(0);
    expect(attacker.experienceCenti).toBe(30_000);
    expect(attacker.rank).toBeLessThanOrEqual(3);
    expect(
      createMatch(42, { scenarioId: 'g2-combat' }).units.find(
        ({ id }) => id === 'A-01',
      ),
    ).toMatchObject({ experienceCenti: 0, rank: 0 });
  });

  it('does not award a unit experience for a turret contribution', () => {
    const state = started('g2-combat');
    const rules = {
      ...state.rules,
      unitBehavior: {
        ...state.rules.unitBehavior,
        experiencePerDamageCenti: 10_000,
      },
    };
    const facility = {
      id: 'A-TURRET-01',
      kind: 'turret' as const,
      owner: 'A' as const,
      anchor: { kind: 'base' as const, id: 'HQ-A' },
      slot: 0,
      cell: { x: 21, y: 21 },
      hp: 300,
      maxHp: 300,
      remainingBuildTicks: 0,
      lastDamagedTick: -1,
      lastActivatedTick: -1,
      attack: { targetId: null, phase: 'idle' as const, phaseEndsTick: 0 },
    };
    const result = resolveCombat({
      ...state,
      rules,
      facilities: [facility],
      units: state.units.map((unit) =>
        unit.id === 'B-01' ? { ...unit, hp: 500, maxHp: 500 } : unit,
      ),
    });
    const target = { ...state.units.find(({ id }) => id === 'B-01')!, hp: 500 };
    const damage = target.hp - result.units.find(({ id }) => id === 'B-01')!.hp;
    const attacker = result.units.find(({ id }) => id === 'A-01')!;
    expect(damage).toBeGreaterThan(0);
    expect(attacker.experienceCenti).toBeLessThan(damage * 10_000);
  });
});
