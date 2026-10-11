import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { createMatch } from './match';
import { stepMatch } from './step';
import type { FactionId, MatchState, UnitState } from './types';

const start = { type: 'start' } as const;

function startMatch(seed = 42): MatchState {
  const state = createMatch(seed);
  const result = applyCommand(state, 'A', start);
  if (!result.ok) throw new Error(`could not start match: ${result.reason}`);
  return result.state;
}

function unit(state: MatchState, unitId = 'A-01'): UnitState {
  const found = state.units.find(({ id }) => id === unitId);
  if (!found) throw new Error(`missing test unit ${unitId}`);
  return found;
}

function issueMove(
  state: MatchState,
  target: { x: number; y: number },
  unitId = 'A-01',
) {
  return applyCommand(state, 'A', { type: 'move', unitId, target });
}

describe('shared command validation', () => {
  it.each([
    null,
    undefined,
    [],
    {},
    { type: 'unknown' },
    { type: 'start', extra: true },
    { type: 'move', unitId: 'A-01' },
    { type: 'move', unitId: 'A-01', target: { x: 1, y: 2, z: 3 } },
    { type: 'move', unitId: 'A-01', target: { x: '1', y: 2 } },
    { type: 'move', unitId: 'A-01', target: { x: Number.NaN, y: 2 } },
    {
      type: 'move',
      unitId: 'A-01',
      target: { x: Number.POSITIVE_INFINITY, y: 2 },
    },
    { type: 'stop', unitId: 42 },
  ])('rejects malformed command %j before checking actor or phase', (input) => {
    const state = createMatch(42);
    const result = applyCommand(state, 'invalid' as FactionId, input);
    expect(result).toEqual({ ok: false, state, reason: 'INVALID_COMMAND' });
  });

  it('rejects invalid actors, wrong phases, and non-player lifecycle commands in order', () => {
    const ready = createMatch(42);
    expect(applyCommand(ready, 'invalid' as FactionId, start)).toMatchObject({
      ok: false,
      reason: 'INVALID_ACTOR',
    });
    expect(applyCommand(ready, 'A', { type: 'pause' })).toMatchObject({
      ok: false,
      reason: 'INVALID_PHASE',
    });
    expect(applyCommand(ready, 'B', start)).toMatchObject({
      ok: false,
      reason: 'INVALID_ACTOR',
    });
    expect(applyCommand(ready, 'C', start)).toMatchObject({
      ok: false,
      reason: 'INVALID_ACTOR',
    });
  });

  it('validates existence and ownership before target coordinates', () => {
    const state = startMatch();
    expect(
      applyCommand(state, 'A', {
        type: 'move',
        unitId: 'missing',
        target: { x: 999, y: 999 },
      }),
    ).toMatchObject({ ok: false, reason: 'UNIT_NOT_FOUND' });
    expect(
      applyCommand(state, 'A', {
        type: 'move',
        unitId: 'B-01',
        target: { x: 999, y: 999 },
      }),
    ).toMatchObject({ ok: false, reason: 'NOT_OWNER' });
  });

  it('rejects bounds, blocked and unreachable cells without changing the original state or path', () => {
    let state = startMatch();
    const initial = issueMove(state, { x: 10, y: 33 });
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    state = initial.state;
    const oldPath = unit(state).path;

    for (const [target, reason] of [
      [{ x: -1, y: 33 }, 'OUT_OF_BOUNDS'],
      [{ x: 29, y: 9 }, 'BLOCKED'],
      [{ x: 30, y: 10 }, 'UNREACHABLE'],
    ] as const) {
      const result = issueMove(state, target);
      expect(result).toEqual({ ok: false, state, reason });
      expect(result.state).toBe(state);
      expect(unit(state).path).toBe(oldPath);
    }
  });

  it('allows each faction to control its own units through the same command API', () => {
    const state = startMatch();
    const result = applyCommand(state, 'B', {
      type: 'move',
      unitId: 'B-01',
      target: { x: 30, y: 33 },
    });
    expect(result.ok).toBe(true);
  });

  it('accepts same-cell and same-destination moves as no-ops', () => {
    const state = startMatch();
    const sameCell = issueMove(state, unit(state).cell);
    expect(sameCell).toEqual({ ok: true, state });

    const moving = issueMove(state, { x: 10, y: 33 });
    expect(moving.ok).toBe(true);
    if (!moving.ok) return;
    const sameDestination = issueMove(moving.state, { x: 10, y: 33 });
    expect(sameDestination).toEqual({ ok: true, state: moving.state });
  });

  it('rejects move and stop while paused and preserves the route', () => {
    let state = startMatch();
    const moving = issueMove(state, { x: 10, y: 33 });
    if (!moving.ok) throw new Error('test move should be accepted');
    state = moving.state;
    const paused = applyCommand(state, 'A', { type: 'pause' });
    if (!paused.ok) throw new Error('test pause should be accepted');
    const beforePath = unit(paused.state).path;
    expect(issueMove(paused.state, { x: 8, y: 33 })).toMatchObject({
      ok: false,
      reason: 'INVALID_PHASE',
    });
    expect(
      applyCommand(paused.state, 'A', { type: 'stop', unitId: 'A-01' }),
    ).toMatchObject({
      ok: false,
      reason: 'INVALID_PHASE',
    });
    expect(unit(paused.state).path).toBe(beforePath);
    expect(stepMatch(paused.state)).toBe(paused.state);
  });

  it('replays tick/sequence commands through finalTick, including ticks after the last command', () => {
    const seed = 42;
    const events = [
      { seq: 0, tickBefore: 0, actor: 'A' as const, command: start },
      {
        seq: 1,
        tickBefore: 0,
        actor: 'A' as const,
        command: { type: 'move', unitId: 'A-01', target: { x: 10, y: 33 } },
      },
      {
        seq: 2,
        tickBefore: 2,
        actor: 'A' as const,
        command: { type: 'move', unitId: 'B-01', target: { x: 32, y: 32 } },
      },
      {
        seq: 3,
        tickBefore: 3,
        actor: 'A' as const,
        command: { type: 'pause' },
      },
      {
        seq: 4,
        tickBefore: 3,
        actor: 'A' as const,
        command: { type: 'resume' },
      },
    ];
    const replay = (): {
      readonly state: MatchState;
      readonly results: string[];
    } => {
      let state = createMatch(seed);
      const results: string[] = [];
      for (const event of events) {
        while (state.elapsedTicks < event.tickBefore) {
          const next = stepMatch(state);
          if (next === state)
            throw new Error('replay waits for a tick while paused or ready');
          state = next;
        }
        const result = applyCommand(state, event.actor, event.command);
        results.push(result.ok ? 'ok' : `reject:${result.reason}`);
        state = result.state;
      }
      const finalTick = 12;
      while (state.elapsedTicks < finalTick) {
        const next = stepMatch(state);
        if (next === state)
          throw new Error('replay finalTick requires running phase');
        state = next;
      }
      return { state, results };
    };

    const firstReplay = replay();
    expect(replay()).toEqual(firstReplay);
    expect(firstReplay.results).toEqual([
      'ok',
      'ok',
      'reject:NOT_OWNER',
      'ok',
      'ok',
    ]);
    expect(firstReplay.state.elapsedTicks).toBe(12);
    expect(unit(firstReplay.state).cell).toEqual({ x: 10, y: 33 });
    expect(unit(firstReplay.state).path).toEqual([]);
  });
});

describe('fixed tick unit movement', () => {
  it('moves one cell in two ticks, then stops at its target', () => {
    const state = startMatch();
    const accepted = issueMove(state, { x: 8, y: 33 });
    if (!accepted.ok) throw new Error('test move should be accepted');
    const moving = accepted.state;
    expect(unit(moving).path).toEqual([
      { x: 7, y: 33 },
      { x: 8, y: 33 },
    ]);
    const firstTick = stepMatch(moving);
    expect(firstTick.elapsedTicks).toBe(1);
    expect(unit(firstTick).cell).toEqual({ x: 6, y: 33 });
    expect(unit(firstTick).edgeProgress).toBe(1);
    const secondTick = stepMatch(firstTick);
    expect(secondTick.elapsedTicks).toBe(2);
    expect(unit(secondTick).cell).toEqual({ x: 7, y: 33 });
    expect(unit(secondTick).edgeProgress).toBe(0);
    const finished = stepMatch(stepMatch(secondTick));
    expect(unit(finished).cell).toEqual({ x: 8, y: 33 });
    expect(unit(finished).path).toEqual([]);
    expect(unit(finished).edgeProgress).toBe(0);
  });

  it('finishes an in-progress edge before applying a replacement route', () => {
    const state = startMatch();
    const initialMove = issueMove(state, { x: 8, y: 33 });
    if (!initialMove.ok) throw new Error('test move should be accepted');
    const halfway = stepMatch(initialMove.state);
    expect(unit(halfway).edgeProgress).toBe(1);

    const retargeted = issueMove(halfway, { x: 7, y: 34 });
    expect(retargeted.ok).toBe(true);
    if (!retargeted.ok) return;
    expect(unit(retargeted.state).cell).toEqual({ x: 6, y: 33 });
    expect(unit(retargeted.state).edgeProgress).toBe(1);
    expect(unit(retargeted.state).path).toEqual([
      { x: 7, y: 33 },
      { x: 7, y: 34 },
    ]);
    const completedEdge = stepMatch(retargeted.state);
    expect(unit(completedEdge).cell).toEqual({ x: 7, y: 33 });
    expect(unit(completedEdge).edgeProgress).toBe(0);
    expect(unit(completedEdge).path).toEqual([{ x: 7, y: 34 }]);
  });

  it('keeps only the current edge when stopping halfway and succeeds when already stopped', () => {
    const state = startMatch();
    const initialMove = issueMove(state, { x: 9, y: 33 });
    if (!initialMove.ok) throw new Error('test move should be accepted');
    const halfway = stepMatch(initialMove.state);
    const stopped = applyCommand(halfway, 'A', {
      type: 'stop',
      unitId: 'A-01',
    });
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(unit(stopped.state).path).toEqual([{ x: 7, y: 33 }]);
    expect(unit(stopped.state).edgeProgress).toBe(1);
    const repeatedStop = applyCommand(stopped.state, 'A', {
      type: 'stop',
      unitId: 'A-01',
    });
    expect(repeatedStop).toEqual({ ok: true, state: stopped.state });
    const atCenter = stepMatch(stopped.state);
    expect(unit(atCenter).cell).toEqual({ x: 7, y: 33 });
    expect(unit(atCenter).path).toEqual([]);
  });
});
