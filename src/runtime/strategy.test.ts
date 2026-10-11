import { describe, expect, it } from 'vitest';
import { MatchRuntime } from './controller';
import { assertReplayMatches, createDiagnostic, replay } from './diagnostics';
import type { ScenarioId } from '../simulation/types';

function running(scenario: ScenarioId) {
  let next: FrameRequestCallback | null = null;
  let timestamp = 0;
  const runtime = new MatchRuntime(
    {
      onChange: () => undefined,
      requestFrame: (callback) => {
        next = callback;
        return 1;
      },
      cancelFrame: () => {
        next = null;
      },
    },
    42,
    scenario,
  );
  runtime.startLoop();
  runtime.dispatch({ type: 'start' });
  const run = (time: number): void => {
    next?.(time);
  };
  run(0);
  const advance = (ticks: number): void => {
    for (let i = 0; i < ticks; i++) {
      timestamp += 100;
      run(timestamp);
    }
  };
  return { runtime, advance };
}

describe('G2 presentation and diagnostic boundaries', () => {
  it('presents only the faction view, with a pure drag preview', () => {
    const { runtime } = running('standard');
    const before = runtime.snapshot();
    const path = runtime.previewMove('A-01', { x: 20, y: 28 });
    expect(path?.at(-1)).toEqual({ x: 20, y: 28 });
    expect(runtime.snapshot().state).toBe(before.state);
    expect(runtime.snapshot().history).toBe(before.history);
    expect(runtime.previewMove('B-01', { x: 20, y: 28 })).toBeNull();
    expect(runtime.playerSnapshot()).not.toHaveProperty('state');
    expect(runtime.playerSnapshot()).not.toHaveProperty('history');
    expect(runtime.playerSnapshot().view.visibleEnemies).toEqual([]);
    expect(runtime.playerSnapshot().view).not.toHaveProperty('factions');
  });

  it('replays production, cancellation, research and rejected commands in sequence', () => {
    const { runtime, advance } = running('g2-economy');
    runtime.dispatch({
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    });
    runtime.dispatch({
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    runtime.dispatch({
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    const job = runtime.playerSnapshot().view.ownFaction.productionJobs[0]!;
    runtime.dispatch({ type: 'cancel-production', jobId: job.id });
    runtime.dispatch({ type: 'cancel-production', jobId: job.id });
    runtime.dispatch({
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    });
    runtime.dispatch({ type: 'start-research', researchId: 'firepower-2' });
    runtime.dispatch({ type: 'start-research', researchId: 'firepower-1' });
    advance(100);
    expect(
      runtime.playerSnapshot().view.ownFaction.completedResearchIds,
    ).toContain('firepower-1');
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
    const diagnostic = createDiagnostic(runtime.snapshot(), {
      commit: 'test',
      dirty: false,
      rulesVersion: 'g2-v2',
      schemaVersion: 4,
    });
    expect(diagnostic).toMatchObject({
      scenarioId: 'g2-economy',
      rules: { schemaVersion: 4, rulesVersion: 'g2-v2' },
    });
    runtime.stopLoop();
  });

  it('clears a destroyed selected unit and replays simultaneous combat', () => {
    const { runtime, advance } = running('g2-combat');
    runtime.select('A-01');
    advance(2);
    expect(runtime.playerSnapshot().selectedUnitId).toBeNull();
    expect(
      runtime.playerSnapshot().view.ownUnits.some((unit) => unit.id === 'A-01'),
    ).toBe(false);
    expect(runtime.playerSnapshot().view.ticketsCenti.A).toBe(99200);
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
    runtime.stopLoop();
  });

  it('retains scenario on reset and clears all transient strategy state', () => {
    const { runtime, advance } = running('g2-economy');
    runtime.dispatch({
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    runtime.dispatch({ type: 'start-research', researchId: 'firepower-1' });
    advance(20);
    runtime.select('A-01');
    runtime.reset(43);
    const view = runtime.playerSnapshot().view;
    expect(view).toMatchObject({
      seed: 43,
      scenarioId: 'g2-economy',
      phase: 'ready',
      tick: 0,
    });
    expect(view.ownFaction).toMatchObject({
      supplyCenti: 18000,
      researchCenti: 15000,
      productionJobs: [],
      activeResearch: null,
      researchProgressCenti: { 'firepower-1': 0, 'firepower-2': 0 },
      completedResearchIds: [],
    });
    expect(runtime.playerSnapshot().selectedUnitId).toBeNull();
    expect(runtime.snapshot().history).toEqual([]);
    runtime.reset(42, 'standard');
    expect(runtime.playerSnapshot().view.scenarioId).toBe('standard');
    runtime.stopLoop();
  });

  it('rejects mismatched rule/schema headers instead of reading G1 state as G2', () => {
    const input = {
      seed: 42,
      scenarioId: 'standard' as const,
      history: [],
      finalTick: 0,
      schemaVersion: 4 as const,
      rulesVersion: 'g2-v2' as const,
    };
    expect(() =>
      replay({ ...input, rulesVersion: 'g1-v1' } as unknown as typeof input),
    ).toThrow('invalid replay header');
    expect(() =>
      replay({ ...input, schemaVersion: 3 } as unknown as typeof input),
    ).toThrow('invalid replay header');
  });

  it('records unknown production and research names as replayable rejections', () => {
    const { runtime } = running('g2-economy');
    runtime.dispatch({
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'tank',
    });
    expect(runtime.snapshot().history.at(-1)?.reason).toBe('INVALID_UNIT_KIND');
    runtime.dispatch({ type: 'start-research', researchId: 'unknown' });
    expect(runtime.snapshot().history.at(-1)?.reason).toBe(
      'RESEARCH_NOT_FOUND',
    );
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
    runtime.stopLoop();
  });

  it('replays research selection, bank mode and retained progress without point loss', () => {
    const { runtime, advance } = running('standard');
    runtime.dispatch({ type: 'start-research', researchId: 'firepower-1' });
    advance(50);
    expect(runtime.playerSnapshot().view.ownFaction).toMatchObject({
      researchCenti: 0,
      researchProgressCenti: { 'firepower-1': 100 },
      activeResearch: { researchId: 'firepower-1' },
    });
    runtime.dispatch({ type: 'start-research', researchId: null });
    advance(50);
    expect(runtime.playerSnapshot().view.ownFaction).toMatchObject({
      researchCenti: 100,
      researchProgressCenti: { 'firepower-1': 100 },
      activeResearch: null,
    });
    runtime.dispatch({ type: 'start-research', researchId: 'firepower-1' });
    runtime.dispatch({ type: 'start-research', researchId: 'firepower-1' });
    expect(runtime.playerSnapshot().view.ownFaction).toMatchObject({
      researchCenti: 0,
      researchProgressCenti: { 'firepower-1': 200 },
    });
    runtime.dispatch({ type: 'pause' });
    advance(10);
    expect(
      runtime.playerSnapshot().view.ownFaction.researchProgressCenti[
        'firepower-1'
      ],
    ).toBe(200);
    expect(() => assertReplayMatches(runtime.snapshot())).not.toThrow();
    runtime.stopLoop();
  });
});
