import { describe, expect, it } from 'vitest';
import { ISOLATED_CELL } from '../simulation/config';
import { MatchRuntime } from './controller';
import { assertReplayMatches } from './diagnostics';

function runtimeFor(scenarioId?: 'g2-combat' | 'g3-mutual' | 'g3-spectate') {
  return new MatchRuntime(
    { onChange: () => undefined },
    42,
    scenarioId ?? 'standard',
  );
}

describe('runtime group selection and orders', () => {
  it('previews and batches base marches without mutating or losing replay history', () => {
    const runtime = runtimeFor();
    runtime.dispatch({ type: 'start' });
    const target = { kind: 'base' as const, id: 'OUT-03' };
    const before = runtime.snapshot();
    const preview = runtime.previewGroupMarch(
      ['B-01', 'A-02', 'A-01', 'A-01'],
      target,
    );
    expect(preview.map(({ unitId }) => unitId)).toEqual([
      'A-01',
      'A-02',
      'B-01',
    ]);
    expect(preview.filter(({ path }) => path !== null)).toHaveLength(2);
    expect(preview.find(({ unitId }) => unitId === 'B-01')).toMatchObject({
      path: null,
      reason: 'UNIT_NOT_FOUND',
    });
    expect(runtime.snapshot().state).toBe(before.state);
    expect(runtime.snapshot().history).toBe(before.history);

    const batch = runtime.groupMarch(target, ['B-01', 'A-02', 'A-01']);
    expect(batch).toEqual({
      accepted: ['A-01', 'A-02'],
      rejected: [{ unitId: 'B-01', reason: 'UNIT_NOT_FOUND' }],
    });
    expect(runtime.snapshot().message).toContain('2部隊に追跡/進軍指示');
    expect(
      runtime
        .snapshot()
        .history.slice(1)
        .map(({ command }) => command),
    ).toEqual([
      { type: 'march', unitId: 'A-01', target },
      { type: 'march', unitId: 'A-02', target },
      { type: 'march', unitId: 'B-01', target },
    ]);
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
  });

  it('records visible-unit pursuit targets exactly and rejects hidden enemy targets', () => {
    const pursuit = new MatchRuntime(
      { onChange: () => undefined },
      42,
      'f02-pursuit',
    );
    pursuit.dispatch({ type: 'start' });
    const target = { kind: 'unit' as const, id: 'B-01' };
    expect(pursuit.previewGroupMarch(['A-01'], target)[0]).toMatchObject({
      unitId: 'A-01',
      reason: null,
    });
    expect(pursuit.groupMarch(target, ['A-01']).accepted).toEqual(['A-01']);
    expect(pursuit.snapshot().history.at(-1)?.command).toEqual({
      type: 'march',
      unitId: 'A-01',
      target,
    });
    expect(() => assertReplayMatches(pursuit.snapshot())).not.toThrow();

    const hidden = runtimeFor();
    hidden.dispatch({ type: 'start' });
    expect(hidden.previewGroupMarch(['A-01'], target)[0]).toMatchObject({
      path: null,
      reason: 'TARGET_NOT_FOUND',
    });
    expect(
      hidden.dispatch({ type: 'march', unitId: 'A-01', target }),
    ).toMatchObject({
      ok: false,
      reason: 'TARGET_NOT_FOUND',
    });
    expect(hidden.snapshot().history.at(-1)?.command).toEqual({
      type: 'march',
      unitId: 'A-01',
      target,
    });
    expect(() => assertReplayMatches(hidden.snapshot())).not.toThrow();
  });
  it('preserves single selection compatibility and exposes detached ordered IDs', () => {
    const runtime = runtimeFor();
    runtime.select('A-01');
    runtime.toggleSelection('A-02');
    expect(runtime.playerSnapshot()).toMatchObject({
      selectedUnitId: 'A-01',
      selectedUnitIds: ['A-01', 'A-02'],
    });

    runtime.toggleSelection('A-01');
    runtime.toggleSelection('B-01');
    expect(runtime.snapshot()).toMatchObject({
      selectedUnitId: 'A-02',
      selectedUnitIds: ['A-02'],
    });

    runtime.selectAll();
    const fullSnapshot = runtime.snapshot();
    const playerSnapshot = runtime.playerSnapshot();
    expect(fullSnapshot.selectedUnitIds).toEqual(['A-01', 'A-02']);
    (fullSnapshot.selectedUnitIds as string[]).push('B-01');
    (playerSnapshot.selectedUnitIds as string[]).splice(0, 1);
    expect(runtime.snapshot().selectedUnitIds).toEqual(['A-01', 'A-02']);

    runtime.select(null);
    expect(runtime.snapshot()).toMatchObject({
      selectedUnitId: null,
      selectedUnitIds: [],
    });
  });

  it('previews without mutation and emits one mixed batch result with replayable history', () => {
    const updates: { readonly message: string }[] = [];
    const runtime = new MatchRuntime(
      { onChange: (snapshot) => updates.push(snapshot) },
      42,
      'g2-combat',
    );
    runtime.dispatch({ type: 'start' });
    const before = runtime.snapshot();
    const preview = runtime.previewGroupMove(['B-01', 'A-02', 'A-01', 'A-01'], {
      x: 20,
      y: 28,
    });
    expect(preview.map(({ unitId }) => unitId)).toEqual([
      'A-01',
      'A-02',
      'B-01',
    ]);
    expect(preview.filter(({ path }) => path !== null)).toHaveLength(2);
    expect(preview.find(({ unitId }) => unitId === 'B-01')).toMatchObject({
      path: null,
      reason: 'NOT_OWNER',
    });
    expect(runtime.snapshot().state).toBe(before.state);
    expect(runtime.snapshot().history).toBe(before.history);

    updates.length = 0;
    const result = runtime.groupMove({ x: 20, y: 28 }, [
      'B-01',
      'A-02',
      'A-01',
      'A-01',
    ]);
    expect(result).toEqual({
      accepted: ['A-01', 'A-02'],
      rejected: [{ unitId: 'B-01', reason: 'NOT_OWNER' }],
    });
    expect(runtime.snapshot().message).toContain(
      '2部隊に移動指示 / 1部隊は拒否',
    );
    expect(updates).toHaveLength(1);
    expect(updates[0]?.message).toContain('2部隊に移動指示 / 1部隊は拒否');
    expect(
      runtime
        .snapshot()
        .history.slice(1)
        .map(({ seq, command }) => [seq, command]),
    ).toEqual([
      [2, { type: 'move', unitId: 'A-01', target: { x: 20, y: 28 } }],
      [3, { type: 'move', unitId: 'A-02', target: { x: 20, y: 28 } }],
      [4, { type: 'move', unitId: 'B-01', target: { x: 20, y: 28 } }],
    ]);
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
  });

  it('deduplicates IDs, records unreachable/blocked/unknown rejects, and explains empty groups', () => {
    const runtime = runtimeFor();
    runtime.dispatch({ type: 'start' });
    const result = runtime.groupMove(ISOLATED_CELL, [
      'missing',
      'A-02',
      'B-01',
      'A-01',
      'A-02',
    ]);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toEqual([
      { unitId: 'A-01', reason: 'UNREACHABLE' },
      { unitId: 'A-02', reason: 'UNREACHABLE' },
      { unitId: 'B-01', reason: 'UNIT_NOT_FOUND' },
      { unitId: 'missing', reason: 'UNIT_NOT_FOUND' },
    ]);
    expect(runtime.snapshot().history.map(({ seq }) => seq)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(runtime.snapshot().message).toContain('4部隊は拒否');
    const map = runtime.snapshot().state.map;
    const blockedIndex = map.blocked.findIndex(Boolean);
    expect(blockedIndex).toBeGreaterThanOrEqual(0);
    const blocked = runtime.groupMove(
      {
        x: blockedIndex % map.width,
        y: Math.floor(blockedIndex / map.width),
      },
      ['A-01'],
    );
    expect(blocked.rejected).toEqual([{ unitId: 'A-01', reason: 'BLOCKED' }]);

    const length = runtime.snapshot().history.length;
    const empty = runtime.groupStop([]);
    expect(empty).toEqual({ accepted: [], rejected: [] });
    expect(runtime.snapshot().history).toHaveLength(length);
    expect(runtime.snapshot().message).toBe('部隊を選択してください');
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
  });

  it('stops selected routes as a replayable batch and rejects group orders outside running phase', () => {
    const runtime = runtimeFor();
    runtime.dispatch({ type: 'start' });
    runtime.selectAll();
    expect(runtime.groupMove({ x: 20, y: 28 }).accepted).toEqual([
      'A-01',
      'A-02',
    ]);
    expect(runtime.groupStop().accepted).toEqual(['A-01', 'A-02']);
    expect(
      runtime
        .snapshot()
        .state.units.filter((unit) => unit.factionId === 'A')
        .every(({ path }) => path.length === 0),
    ).toBe(true);
    expect(runtime.snapshot().history).toHaveLength(5);
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();

    runtime.dispatch({ type: 'pause' });
    const paused = runtime.groupMove({ x: 19, y: 28 });
    expect(paused.accepted).toEqual([]);
    expect(paused.rejected).toEqual([
      { unitId: 'A-01', reason: 'INVALID_PHASE' },
      { unitId: 'A-02', reason: 'INVALID_PHASE' },
    ]);
  });

  it('removes only destroyed units, then clears selection on reset, elimination, and finish', () => {
    let queued: FrameRequestCallback[] = [];
    let frameId = 0;
    const combat = new MatchRuntime(
      {
        onChange: () => undefined,
        requestFrame: (callback) => {
          queued.push(callback);
          frameId += 1;
          return frameId;
        },
        cancelFrame: () => {
          queued = [];
        },
      },
      42,
      'g2-combat',
    );
    combat.select('A-01');
    combat.toggleSelection('A-02');
    combat.dispatch({ type: 'start' });
    combat.startLoop();
    const frame = (timestamp: number): void => {
      const callback = queued.shift();
      callback?.(timestamp);
    };
    frame(0);
    frame(200);
    combat.stopLoop();
    expect(combat.snapshot().state.units.some(({ id }) => id === 'A-01')).toBe(
      false,
    );
    expect(combat.snapshot().selectedUnitIds).toEqual(['A-02']);
    combat.reset(43);
    expect(combat.snapshot().selectedUnitIds).toEqual([]);

    const eliminated = runtimeFor('g3-spectate');
    eliminated.selectAll();
    eliminated.dispatch({ type: 'start' });
    expect(
      eliminated.snapshot().state.factions.find(({ id }) => id === 'A')
        ?.eliminatedAtTick,
    ).not.toBeNull();
    expect(eliminated.snapshot().selectedUnitIds).toEqual([]);

    const finished = runtimeFor('g3-mutual');
    finished.select('A-01');
    finished.dispatch({ type: 'start' });
    expect(finished.snapshot().state.phase).toBe('finished');
    expect(finished.snapshot().selectedUnitIds).toEqual([]);
    expect(finished.groupStop(['A-01']).rejected).toEqual([
      { unitId: 'A-01', reason: 'INVALID_PHASE' },
    ]);

    const contextLost = runtimeFor();
    contextLost.dispatch({ type: 'start' });
    contextLost.onContextLost();
    expect(contextLost.groupMove({ x: 20, y: 28 }, ['A-01']).rejected).toEqual([
      { unitId: 'A-01', reason: 'INVALID_PHASE' },
    ]);
  });
});
