import { describe, expect, it } from 'vitest';
import { MatchRuntime } from './controller';
import { assertReplayMatches, createDiagnostic } from './diagnostics';

describe('MatchRuntime diagnostic history', () => {
  it('measures tick work in runtime diagnostics outside the simulation state', () => {
    let frame: FrameRequestCallback | null = null;
    const runtime = new MatchRuntime(
      {
        onChange: () => undefined,
        requestFrame: (callback) => {
          frame = callback;
          return 1;
        },
        cancelFrame: () => undefined,
      },
      1,
      'standard',
      undefined,
      'ring-three-fronts-100',
    );
    runtime.dispatch({ type: 'start' });
    runtime.startLoop();
    frame!(0);
    frame!(100);
    const snapshot = runtime.snapshot();
    expect(snapshot.tickProcessing.tickCount).toBe(1);
    expect(snapshot.tickProcessing.totalMs).toBeGreaterThanOrEqual(0);
    const diagnostic = createDiagnostic(snapshot, {
      commit: 'test',
      dirty: false,
      rulesVersion: 'test',
      schemaVersion: snapshot.state.schemaVersion,
    }) as { mapId: string; timing: { measuredTickCount: number } };
    expect(diagnostic.mapId).toBe('ring-three-fronts-100');
    expect(diagnostic.timing.measuredTickCount).toBe(1);
  });

  it('keeps the 100-cell definition and faction assignment through reset and replay', () => {
    const runtime = new MatchRuntime(
      { onChange: () => undefined },
      1,
      'standard',
      undefined,
      'ring-three-fronts-100',
    );
    const assignment = runtime.snapshot().state.map.startAssignment;
    runtime.dispatch({ type: 'start' });
    runtime.reset(1);
    expect(runtime.snapshot().state.map.width).toBe(100);
    expect(runtime.snapshot().state.map.startAssignment).toEqual(assignment);
    runtime.dispatch({ type: 'start' });
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
  });

  it('dispatches and replays facility construction through the runtime boundary', () => {
    const runtime = new MatchRuntime(
      { onChange: () => undefined },
      42,
      'f11-facilities',
    );
    runtime.dispatch({ type: 'start' });
    runtime.dispatch({
      type: 'build-facility',
      kind: 'turret',
      anchor: { kind: 'base', id: 'HQ-A' },
    });
    expect(runtime.snapshot().history.at(-1)).toMatchObject({
      ok: true,
      command: { type: 'build-facility' },
    });
    expect(runtime.snapshot().state.facilities).toHaveLength(1);
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
    runtime.dispatch({ type: 'build-facility', kind: 'turret', anchor: [] });
    expect(runtime.snapshot().history.at(-1)).toMatchObject({
      command: null,
      ok: false,
    });
  });
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
