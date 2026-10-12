import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { createMatch } from './match';
import { advanceMarchOrders, clearObservedDeadMarchTargets } from './march';
import { resolveCombat } from './combat';
import { stepMatch } from './step';
import { isUnitVisibleToFaction } from './visibility';
import type { MatchState, UnitState } from './types';

function running(seed = 42): MatchState {
  const result = applyCommand(
    createMatch(seed, { scenarioId: 'f02-pursuit' }),
    'A',
    { type: 'start' },
  );
  if (!result.ok) throw new Error(`could not start: ${result.reason}`);
  return result.state;
}

function unit(state: MatchState, id: string): UnitState {
  const found = state.units.find((entry) => entry.id === id);
  if (!found) throw new Error(`missing unit ${id}`);
  return found;
}

function replaceUnit(
  state: MatchState,
  id: string,
  next: UnitState,
): MatchState {
  return {
    ...state,
    units: state.units.map((entry) => (entry.id === id ? next : entry)),
  };
}

function onlyUnits(state: MatchState, ids: readonly string[]): MatchState {
  const keep = new Set(ids);
  return { ...state, units: state.units.filter(({ id }) => keep.has(id)) };
}

function issueMarch(
  state: MatchState,
  target: { readonly kind: 'unit' | 'base'; readonly id: string },
  unitId = 'A-01',
) {
  return applyCommand(state, 'A', { type: 'march', unitId, target });
}

function flatState(state: MatchState): MatchState {
  return {
    ...state,
    map: {
      ...state.map,
      terrain: new Array(state.map.width * state.map.height).fill('land'),
      terrainLevel: new Array(state.map.width * state.map.height).fill(0),
      blocked: new Array(state.map.width * state.map.height).fill(false),
    },
    units: state.units.map((entry) => ({
      ...entry,
      path: [],
      edgeProgress: 0,
    })),
  };
}

describe('march command', () => {
  it.each([
    { type: 'march' },
    {
      type: 'march',
      unitId: 'A-01',
      target: { kind: 'unit', id: 'B-01', extra: 1 },
    },
    {
      type: 'march',
      unitId: 'A-01',
      target: { kind: 'base', id: 'OUT-01' },
      extra: true,
    },
    { type: 'march', unitId: 'A-01', target: { kind: 'unknown', id: 'x' } },
    { type: 'march', unitId: 'A-01', target: { kind: 'unit', id: '' } },
  ])('rejects malformed exact shape %j', (command) => {
    const state = running();
    expect(applyCommand(state, 'A', command)).toEqual({
      ok: false,
      state,
      reason: 'INVALID_COMMAND',
    });
  });

  it('requires visible enemy units, hides missing and hidden IDs, and rejects own units as invalid targets', () => {
    const state = running();
    expect(isUnitVisibleToFaction(state, unit(state, 'B-01'), 'A')).toBe(true);
    expect(issueMarch(state, { kind: 'unit', id: 'B-01' }).ok).toBe(true);
    expect(issueMarch(state, { kind: 'unit', id: 'C-01' })).toMatchObject({
      ok: false,
      reason: 'TARGET_NOT_FOUND',
    });
    expect(issueMarch(state, { kind: 'unit', id: 'missing' })).toMatchObject({
      ok: false,
      reason: 'TARGET_NOT_FOUND',
    });
    expect(issueMarch(state, { kind: 'unit', id: 'A-02' })).toMatchObject({
      ok: false,
      reason: 'INVALID_TARGET',
    });
  });

  it('allows public unknown bases without claiming their unseen observation time', () => {
    const state = running();
    const result = issueMarch(state, { kind: 'base', id: 'HQ-B' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(unit(result.state, 'A-01').marchOrder).toMatchObject({
      target: { kind: 'base', id: 'HQ-B' },
      lastKnownCell: { x: 33, y: 34 },
      lastSeenTick: -1,
      status: 'searching',
    });
  });

  it('rejects unreachable target paths without changing path or order', () => {
    let state = running();
    state = {
      ...state,
      map: {
        ...state.map,
        blocked: state.map.blocked.map((blocked, index) =>
          index % state.map.width === 18 ? true : blocked,
        ),
      },
    };
    const before = unit(state, 'A-01');
    const result = issueMarch(state, { kind: 'unit', id: 'B-01' });
    expect(result).toEqual({ ok: false, state, reason: 'UNREACHABLE' });
    expect(unit(state, 'A-01')).toBe(before);
  });

  it('move and stop clear march orders, including idempotent replacement and a half-edge', () => {
    let state = running();
    const accepted = issueMarch(state, { kind: 'unit', id: 'B-01' });
    if (!accepted.ok) throw new Error('march should be accepted');
    state = accepted.state;
    const destination = unit(state, 'A-01').path.at(-1)!;
    const sameMove = applyCommand(state, 'A', {
      type: 'move',
      unitId: 'A-01',
      target: destination,
    });
    expect(sameMove.ok).toBe(true);
    if (!sameMove.ok) return;
    expect(unit(sameMove.state, 'A-01').marchOrder).toBeNull();

    const marchAgain = issueMarch(sameMove.state, { kind: 'unit', id: 'B-01' });
    if (!marchAgain.ok) throw new Error('march should be accepted');
    const halfway = stepMatch(marchAgain.state);
    const edge = unit(halfway, 'A-01').path[0];
    expect(unit(halfway, 'A-01').edgeProgress).toBe(1);
    const retargeted = issueMarch(halfway, { kind: 'unit', id: 'B-01' });
    expect(retargeted.ok).toBe(true);
    if (!retargeted.ok) return;
    expect(unit(retargeted.state, 'A-01').path[0]).toEqual(edge);
    const stopped = applyCommand(retargeted.state, 'A', {
      type: 'stop',
      unitId: 'A-01',
    });
    expect(stopped.ok).toBe(true);
    if (stopped.ok) {
      expect(unit(stopped.state, 'A-01').marchOrder).toBeNull();
      expect(unit(stopped.state, 'A-01').path).toEqual([edge]);
    }
  });
});

describe('deterministic march updates', () => {
  it('prefers a visible in-range march target over a nearer automatic target', () => {
    let state = flatState(running());
    const attacker = {
      ...unit(state, 'A-01'),
      cell: { x: 20, y: 20 },
      marchOrder: {
        target: { kind: 'unit' as const, id: 'B-01' },
        lastKnownCell: { x: 22, y: 20 },
        lastSeenTick: 0,
        status: 'tracking' as const,
      },
    };
    const target = {
      ...unit(state, 'B-01'),
      cell: { x: 22, y: 20 },
      hp: 1000,
      maxHp: 1000,
    };
    const nearer = {
      ...unit(state, 'C-01'),
      cell: { x: 21, y: 20 },
      hp: 1000,
      maxHp: 1000,
    };
    state = onlyUnits(state, ['A-01', 'B-01', 'C-01']);
    state = replaceUnit(state, 'A-01', attacker);
    state = replaceUnit(state, 'B-01', target);
    state = replaceUnit(state, 'C-01', nearer);

    const combat = resolveCombat(state);
    expect(unit(combat, 'B-01').hp).toBe(998);
    expect(unit(combat, 'C-01').hp).toBe(998);
  });

  it('tracks a moving visible target from each pre-movement snapshot', () => {
    let state = flatState(running());
    const pursuer = { ...unit(state, 'A-01'), cell: { x: 17, y: 20 } };
    const movingTarget: UnitState = {
      ...unit(state, 'B-01'),
      cell: { x: 21, y: 20 },
      path: [
        { x: 22, y: 20 },
        { x: 23, y: 20 },
        { x: 24, y: 20 },
      ],
      edgeProgress: 0,
    };
    state = replaceUnit(state, 'A-01', pursuer);
    state = replaceUnit(state, 'B-01', movingTarget);
    const accepted = issueMarch(state, { kind: 'unit', id: 'B-01' });
    if (!accepted.ok) throw new Error('march should be accepted');
    state = accepted.state;
    const seenAt = unit(state, 'A-01').marchOrder!.lastSeenTick;
    state = stepMatch(state);
    expect(unit(state, 'A-01').marchOrder?.lastSeenTick).toBe(seenAt);
    state = stepMatch(state);
    expect(unit(state, 'A-01').marchOrder?.lastSeenTick).toBeGreaterThan(
      seenAt,
    );
    expect(unit(state, 'A-01').marchOrder?.lastKnownCell).toEqual({
      x: 22,
      y: 20,
    });
  });

  it('does not learn hidden movement or death, and reacquires a visible target', () => {
    let state = flatState(running());
    const visibleTarget = { ...unit(state, 'B-01'), cell: { x: 21, y: 20 } };
    state = replaceUnit(state, 'B-01', visibleTarget);
    const accepted = issueMarch(state, { kind: 'unit', id: 'B-01' });
    if (!accepted.ok) throw new Error('march should be accepted');
    state = accepted.state;
    const oldOrder = unit(state, 'A-01').marchOrder!;
    const hiddenA = {
      ...unit(state, 'A-01'),
      cell: { x: 6, y: 34 },
      path: [],
      edgeProgress: 0 as const,
    };
    const hiddenB = {
      ...visibleTarget,
      cell: { x: 34, y: 34 },
    };
    const hidden1 = replaceUnit(
      replaceUnit(state, 'A-01', hiddenA),
      'B-01',
      hiddenB,
    );
    const hidden2 = replaceUnit(hidden1, 'B-01', {
      ...hiddenB,
      cell: { x: 36, y: 36 },
    });
    expect(isUnitVisibleToFaction(hidden1, hiddenB, 'A')).toBe(false);
    const next1 = advanceMarchOrders(hidden1);
    const next2 = advanceMarchOrders(hidden2);
    expect(unit(next1, 'A-01').marchOrder).toEqual({
      ...oldOrder,
      status: 'searching',
    });
    expect(unit(next2, 'A-01').marchOrder).toEqual(
      unit(next1, 'A-01').marchOrder,
    );
    expect(unit(next1, 'A-01').path).toEqual(unit(next2, 'A-01').path);

    const hiddenDeath = {
      ...next1,
      units: next1.units.filter(({ id }) => id !== 'B-01'),
    };
    const afterHiddenDeath = clearObservedDeadMarchTargets(next1, hiddenDeath);
    expect(unit(afterHiddenDeath, 'A-01').marchOrder?.target.id).toBe('B-01');

    const reacquired = replaceUnit(
      replaceUnit(next1, 'A-01', {
        ...unit(next1, 'A-01'),
        cell: { x: 30, y: 30 },
      }),
      'B-01',
      { ...hiddenB, cell: { x: 34, y: 34 } },
    );
    const updated = advanceMarchOrders(reacquired);
    expect(unit(updated, 'A-01').marchOrder?.lastKnownCell).toEqual({
      x: 34,
      y: 34,
    });
    expect(unit(updated, 'A-01').marchOrder?.status).toBe('tracking');
  });

  it('clears visible target death and holds the current edge', () => {
    let before = flatState(running());
    before = replaceUnit(before, 'A-01', {
      ...unit(before, 'A-01'),
      cell: { x: 17, y: 20 },
      path: [
        { x: 18, y: 20 },
        { x: 19, y: 20 },
      ],
      edgeProgress: 1,
      marchOrder: {
        target: { kind: 'unit', id: 'B-01' },
        lastKnownCell: { x: 21, y: 20 },
        lastSeenTick: 0,
        status: 'tracking',
      },
    });
    const after = {
      ...before,
      units: before.units.filter(({ id }) => id !== 'B-01'),
    };
    const cleared = clearObservedDeadMarchTargets(before, after);
    expect(unit(cleared, 'A-01').marchOrder).toBeNull();
    expect(unit(cleared, 'A-01').path).toEqual([{ x: 18, y: 20 }]);
  });

  it('ignores hidden base ownership and HP changes while searching', () => {
    let state = flatState(running());
    const base = state.bases.find(({ id }) => id === 'HQ-B')!;
    const accepted = issueMarch(state, { kind: 'base', id: base.id });
    if (!accepted.ok) throw new Error('public base should be accepted');
    state = accepted.state;
    const changedHiddenBase = {
      ...state,
      bases: state.bases.map((entry) =>
        entry.id === base.id ? { ...entry, owner: 'C' as const, hp: 1 } : entry,
      ),
    };
    const next1 = advanceMarchOrders(state);
    const next2 = advanceMarchOrders(changedHiddenBase);
    expect(unit(next1, 'A-01').marchOrder).toEqual(
      unit(next2, 'A-01').marchOrder,
    );
    expect(unit(next1, 'A-01').path).toEqual(unit(next2, 'A-01').path);
  });

  it('marks blocked routes and holds at the next center without dropping the order', () => {
    let state = flatState(running());
    const accepted = issueMarch(state, { kind: 'base', id: 'HQ-B' });
    if (!accepted.ok) throw new Error('public base should be accepted');
    state = accepted.state;
    const width = state.map.width;
    const blocked = state.map.blocked.map((value, index) =>
      index % width === 25 ? true : value,
    );
    state = { ...state, map: { ...state.map, blocked } };
    const next = advanceMarchOrders(state);
    expect(unit(next, 'A-01').marchOrder?.status).toBe('blocked');
    expect(unit(next, 'A-01').marchOrder?.target.id).toBe('HQ-B');
    expect(unit(next, 'A-01').path).toEqual([]);
  });

  it('keeps a hidden unit order searching after reaching last-known position', () => {
    let state = flatState(running());
    const pursuer = {
      ...unit(state, 'A-01'),
      cell: { x: 21, y: 20 },
      marchOrder: {
        target: { kind: 'unit' as const, id: 'B-01' },
        lastKnownCell: { x: 21, y: 20 },
        lastSeenTick: 3,
        status: 'tracking' as const,
      },
    };
    const hiddenTarget = { ...unit(state, 'B-01'), cell: { x: 34, y: 34 } };
    state = onlyUnits(state, ['A-01', 'B-01']);
    state = replaceUnit(state, 'A-01', pursuer);
    state = replaceUnit(state, 'B-01', hiddenTarget);
    expect(isUnitVisibleToFaction(state, hiddenTarget, 'A')).toBe(false);

    const first = advanceMarchOrders(state);
    const second = advanceMarchOrders(first);
    expect(unit(first, 'A-01').marchOrder?.status).toBe('searching');
    expect(unit(second, 'A-01').marchOrder?.status).toBe('searching');
    expect(unit(first, 'A-01').path).toEqual([]);
    expect(unit(second, 'A-01').path).toEqual([]);
    expect(unit(second, 'A-01').marchOrder?.lastSeenTick).toBe(3);
  });

  it('marches onto an enemy outpost, captures it after destruction, then holds ownership', () => {
    let state = flatState(running());
    state = onlyUnits(state, ['A-01']);
    state = replaceUnit(state, 'A-01', {
      ...unit(state, 'A-01'),
      cell: { x: 21, y: 28 },
      hp: 1000,
      maxHp: 1000,
    });
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'OUT-03' ? { ...base, owner: 'B' as const, hp: 1 } : base,
      ),
    };
    const accepted = issueMarch(state, { kind: 'base', id: 'OUT-03' });
    if (!accepted.ok) throw new Error('visible enemy base should be accepted');
    state = accepted.state;

    state = stepMatch(state);
    expect(state.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: null,
      hp: 100,
      defender: { hp: state.rules.defenses.outpost.maxHp },
    });
    for (let tick = 0; tick < state.rules.defenses.outpost.maxHp / 2; tick += 1)
      state = stepMatch(state);
    expect(state.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: null,
      hp: 100,
      defender: { hp: 0 },
    });
    for (let tick = 0; tick < 50; tick += 1) state = stepMatch(state);
    expect(state.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: null,
      hp: 0,
      captureCandidate: 'A',
      captureTicks: 1,
    });
    for (let tick = 0; tick < 30; tick += 1) state = stepMatch(state);
    expect(state.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: 'A',
      hp: 30,
      captureCandidate: null,
      captureTicks: 0,
    });
    expect(unit(state, 'A-01').marchOrder?.target).toEqual({
      kind: 'base',
      id: 'OUT-03',
    });
    expect(unit(state, 'A-01').marchOrder?.status).toBe('arrived');
    expect(unit(state, 'A-01').path).toEqual([]);
    const held = stepMatch(stepMatch(state));
    expect(unit(held, 'A-01').path).toEqual([]);
    expect(unit(held, 'A-01').marchOrder?.status).toBe('arrived');
  });

  it('moves to a friendly base and holds without repeatedly reissuing movement', () => {
    let state = flatState(running());
    state = onlyUnits(state, ['A-01']);
    state = replaceUnit(state, 'A-01', {
      ...unit(state, 'A-01'),
      cell: { x: 8, y: 34 },
    });
    const accepted = issueMarch(state, { kind: 'base', id: 'HQ-A' });
    if (!accepted.ok) throw new Error('friendly base should be a valid target');
    state = accepted.state;
    for (let tick = 0; tick < 5; tick += 1) state = stepMatch(state);
    expect(unit(state, 'A-01').cell).toEqual({ x: 6, y: 34 });
    expect(unit(state, 'A-01').path).toEqual([]);
    expect(unit(state, 'A-01').marchOrder?.status).toBe('arrived');
    const held = stepMatch(stepMatch(state));
    expect(unit(held, 'A-01').cell).toEqual({ x: 6, y: 34 });
    expect(unit(held, 'A-01').path).toEqual([]);
    expect(unit(held, 'A-01').marchOrder?.status).toBe('arrived');
  });

  it('holds at a known destroyed HQ instead of issuing an endless attack route', () => {
    let state = flatState(running());
    state = onlyUnits(state, ['A-01']);
    state = replaceUnit(state, 'A-01', {
      ...unit(state, 'A-01'),
      cell: { x: 32, y: 34 },
    });
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'HQ-B' ? { ...base, hp: 0 } : base,
      ),
    };
    const accepted = issueMarch(state, { kind: 'base', id: 'HQ-B' });
    if (!accepted.ok) throw new Error('known HQ should be a valid target');
    state = accepted.state;
    state = stepMatch(stepMatch(stepMatch(state)));
    expect(unit(state, 'A-01').cell).toEqual({ x: 33, y: 34 });
    expect(unit(state, 'A-01').path).toEqual([]);
    expect(unit(state, 'A-01').marchOrder?.status).toBe('arrived');
    const held = stepMatch(stepMatch(state));
    expect(unit(held, 'A-01').cell).toEqual({ x: 33, y: 34 });
    expect(unit(held, 'A-01').path).toEqual([]);
  });

  it('does not advance a march order while paused', () => {
    let state = flatState(running());
    const accepted = issueMarch(state, { kind: 'base', id: 'HQ-B' });
    if (!accepted.ok) throw new Error('public base should be accepted');
    const paused = applyCommand(accepted.state, 'A', { type: 'pause' });
    if (!paused.ok) throw new Error('pause should be accepted');
    expect(stepMatch(paused.state)).toBe(paused.state);
  });

  it('replays the same pursuit state through ticks after the final command', () => {
    const replay = () => {
      let state = createMatch(42, { scenarioId: 'f02-pursuit' });
      const start = applyCommand(state, 'A', { type: 'start' });
      if (!start.ok) throw new Error('start failed');
      state = start.state;
      const order = issueMarch(state, { kind: 'unit', id: 'B-01' });
      if (!order.ok) throw new Error('march failed');
      state = order.state;
      for (let tick = 0; tick < 20; tick += 1) state = stepMatch(state);
      return state;
    };
    expect(replay()).toEqual(replay());
  });
});
