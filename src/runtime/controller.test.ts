import { describe, expect, it } from 'vitest';
import { MatchRuntime } from './controller';
import { assertReplayMatches } from './diagnostics';

describe('MatchRuntime diagnostic history', () => {
  it('normalizes malformed commands and replays context-loss resume rejection', () => {
    const runtime = new MatchRuntime({ onChange: () => undefined });
    runtime.dispatch({ type: 'start', extra: true });
    expect(runtime.snapshot().history[0]?.command).toBeNull();
    runtime.dispatch({ type: 'start' });
    runtime.onContextLost();
    runtime.dispatch({ type: 'resume' });
    expect(runtime.snapshot().history.at(-1)).toMatchObject({
      runtimeReject: 'CONTEXT_LOST',
      ok: false,
      reason: 'INVALID_PHASE',
    });
    runtime.onContextRestored();
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
  });

  it('keeps failed commands in history without changing the underlying match state', () => {
    const runtime = new MatchRuntime({ onChange: () => undefined });
    runtime.dispatch({ type: 'start' });
    const before = runtime.snapshot().state;
    runtime.dispatch({
      type: 'move',
      unitId: 'B-01',
      target: { x: 20, y: 20 },
    });
    expect(runtime.snapshot().history.at(-1)?.reason).toBe('UNIT_NOT_FOUND');
    expect(runtime.snapshot().state).toBe(before);
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
  });

  it('owns one continuing RAF and pauses on hidden without resuming automatically', () => {
    let queued: FrameRequestCallback | null = null;
    let nextId = 1;
    const frames: { previous: number; current: number; alpha: number }[] = [];
    const runtime = new MatchRuntime({
      onChange: () => undefined,
      onFrame: (previous, current, alpha) => {
        frames.push({
          previous: previous.tick,
          current: current.tick,
          alpha,
        });
      },
      requestFrame: (callback) => {
        queued = callback;
        return nextId++;
      },
      cancelFrame: () => {
        queued = null;
      },
    });
    runtime.startLoop();
    const runFrame = (timestamp: number): void => {
      const callback = queued;
      queued = null;
      callback?.(timestamp);
    };
    runtime.dispatch({ type: 'start' });
    runFrame(0);
    runFrame(100);
    expect(runtime.snapshot().state.elapsedTicks).toBe(1);
    runFrame(200);
    expect(runtime.snapshot().state.elapsedTicks).toBe(2);
    runFrame(250);
    expect(frames).toHaveLength(4);
    expect(frames[3]).toEqual({ previous: 1, current: 2, alpha: 0.5 });
    runtime.onHidden();
    expect(runtime.snapshot().state.phase).toBe('paused');
    runFrame(10000);
    expect(runtime.snapshot().state.elapsedTicks).toBe(2);
    expect(runtime.snapshot().state.phase).toBe('paused');
    runtime.stopLoop();
  });
});
