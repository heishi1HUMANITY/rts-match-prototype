import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { applyEconomyTick } from './economy';
import { createMatch } from './match';
import {
  advanceProduction,
  cancelAllProductionForDestroyedHq,
} from './production';
import {
  advanceResearch,
  firepowerBonus,
  researchEffectValue,
} from './research';
import type { FactionState, MatchState } from './types';

function runningMatch(): MatchState {
  const start = applyCommand(createMatch(42), 'A', { type: 'start' });
  if (!start.ok) throw new Error('start should succeed');
  return start.state;
}

function withFaction(
  state: MatchState,
  changes: Partial<FactionState>,
): MatchState {
  return {
    ...state,
    factions: state.factions.map((faction) =>
      faction.id === 'A' ? { ...faction, ...changes } : faction,
    ),
  };
}

function faction(state: MatchState): FactionState {
  const found = state.factions.find(({ id }) => id === 'A');
  if (found === undefined) throw new Error('missing faction A');
  return found;
}

function accepted(state: MatchState, command: unknown): MatchState {
  const result = applyCommand(state, 'A', command);
  if (!result.ok) throw new Error(`unexpected rejection: ${result.reason}`);
  return result.state;
}

describe('G2 integer economy', () => {
  it('accrues HQ income minus surviving unit upkeep exactly in centi', () => {
    let state = runningMatch();
    for (let tick = 0; tick < 10; tick += 1) state = applyEconomyTick(state);
    expect(faction(state).supplyCenti).toBe(20_520);
    expect(faction(state).researchCenti).toBe(120);

    const outpost = state.bases.find(({ id }) => id === 'OUT-03');
    if (outpost === undefined) throw new Error('missing outpost');
    const owned = {
      ...state,
      bases: state.bases.map((base) =>
        base === outpost ? { ...base, owner: 'A' as const, hp: 100 } : base,
      ),
    };
    const next = applyEconomyTick(owned);
    expect(faction(next).supplyCenti).toBe(20_592);
    expect(faction(next).researchCenti).toBe(142);
    expect(faction(owned).supplyCenti).toBe(20_520);
  });

  it('clamps upkeep at zero without creating supply or damaging units', () => {
    const state = withFaction(runningMatch(), { supplyCenti: 0 });
    const withoutHq = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'HQ-A' ? { ...base, hp: 0 } : base,
      ),
    };
    const next = applyEconomyTick(withoutHq);
    expect(faction(next).supplyCenti).toBe(12);
    expect(next.units).toBe(withoutHq.units);
  });
});

describe('G2 production commands and tick helpers', () => {
  it('validates exact payload, actor, phase and cost boundary without mutation', () => {
    const ready = createMatch(42);
    const malformed = {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
      extra: 1,
    };
    expect(applyCommand(ready, 'bad' as 'A', malformed)).toEqual({
      ok: false,
      state: ready,
      reason: 'INVALID_COMMAND',
    });
    const valid = {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    };
    expect(applyCommand(ready, 'bad' as 'A', valid)).toEqual({
      ok: false,
      state: ready,
      reason: 'INVALID_ACTOR',
    });
    expect(applyCommand(ready, 'A', valid)).toEqual({
      ok: false,
      state: ready,
      reason: 'INVALID_PHASE',
    });

    const poor = withFaction(runningMatch(), { supplyCenti: 11_999 });
    expect(applyCommand(poor, 'A', valid)).toEqual({
      ok: false,
      state: poor,
      reason: 'INSUFFICIENT_SUPPLY',
    });
    const exact = withFaction(poor, { supplyCenti: 12_000 });
    const ordered = accepted(exact, valid);
    expect(faction(ordered).supplyCenti).toBe(0);
    expect(faction(ordered).productionJobs[0]).toMatchObject({
      id: 'A-J01',
      unitId: 'A-03',
      costCenti: 12_000,
      remainingTicks: 120,
      status: 'active',
    });
    expect(faction(exact).nextUnitSerial).toBe(3);
  });

  it('serializes active and waiting jobs and starts the next only on a later tick', () => {
    let state = withFaction(runningMatch(), { supplyCenti: 100_000 });
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    });
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    expect(faction(state).productionJobs.map(({ status }) => status)).toEqual([
      'active',
      'queued',
      'queued',
    ]);
    expect(
      applyCommand(state, 'A', {
        type: 'enqueue-production',
        baseId: 'HQ-A',
        unitKind: 'scout',
      }),
    ).toEqual({
      ok: false,
      state,
      reason: 'QUEUE_FULL',
    });
    for (let tick = 0; tick < 59; tick += 1) state = advanceProduction(state);
    expect(
      faction(state).productionJobs.map(({ remainingTicks }) => remainingTicks),
    ).toEqual([1, 120, 60]);
    state = advanceProduction(state);
    expect(state.units.some(({ id }) => id === 'A-03')).toBe(true);
    expect(
      faction(state).productionJobs.map(({ remainingTicks }) => remainingTicks),
    ).toEqual([120, 60]);
    expect(faction(state).productionJobs[0]?.status).toBe('active');
    state = advanceProduction(state);
    expect(faction(state).productionJobs[0]?.remainingTicks).toBe(119);
  });

  it('refunds only once, reserves monotonic IDs, and hides other factions jobs', () => {
    let state = runningMatch();
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    });
    const firstJob = faction(state).productionJobs[0];
    if (firstJob === undefined) throw new Error('job missing');
    state = accepted(state, { type: 'cancel-production', jobId: firstJob.id });
    expect(faction(state).supplyCenti).toBe(20_000);
    expect(
      applyCommand(state, 'A', {
        type: 'cancel-production',
        jobId: firstJob.id,
      }),
    ).toEqual({
      ok: false,
      state,
      reason: 'JOB_NOT_FOUND',
    });
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    expect(faction(state).productionJobs[0]).toMatchObject({
      id: 'A-J02',
      unitId: 'A-04',
    });
    const bOrder = applyCommand(state, 'B', {
      type: 'enqueue-production',
      baseId: 'HQ-B',
      unitKind: 'scout',
    });
    if (!bOrder.ok) throw new Error('B should order through same API');
    expect(
      applyCommand(bOrder.state, 'A', {
        type: 'cancel-production',
        jobId: 'B-J01',
      }),
    ).toEqual({
      ok: false,
      state: bOrder.state,
      reason: 'JOB_NOT_FOUND',
    });
  });

  it('cancels a waiting job without changing active progress and never reuses killed unit IDs', () => {
    let state = withFaction(runningMatch(), { supplyCenti: 100_000 });
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    });
    const afterTick = advanceProduction(state);
    expect(faction(afterTick).productionJobs[0]?.remainingTicks).toBe(59);
    const afterCancel = accepted(afterTick, {
      type: 'cancel-production',
      jobId: 'A-J02',
    });
    expect(faction(afterCancel).productionJobs).toHaveLength(1);
    expect(faction(afterCancel).productionJobs[0]?.remainingTicks).toBe(59);
    expect(faction(afterCancel).supplyCenti).toBe(94_000);

    let completed = afterCancel;
    for (let tick = 0; tick < 59; tick += 1)
      completed = advanceProduction(completed);
    expect(completed.units.some(({ id }) => id === 'A-03')).toBe(true);
    const killed = {
      ...completed,
      units: completed.units.filter(({ id }) => id !== 'A-03'),
    };
    const reordered = accepted(killed, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    expect(faction(reordered).productionJobs[0]).toMatchObject({
      id: 'A-J03',
      unitId: 'A-05',
    });
  });

  it('rejects bad targets in a stable order without exposing enemy queues', () => {
    const state = runningMatch();
    for (const malformed of [
      { type: 'enqueue-production', baseId: 'HQ-A', unitKind: 1 },
      { type: 'cancel-production', jobId: 'A-J01', extra: true },
    ]) {
      expect(applyCommand(state, 'A', malformed)).toEqual({
        ok: false,
        state,
        reason: 'INVALID_COMMAND',
      });
    }
    expect(
      applyCommand(state, 'A', { type: 'start-research', researchId: null }),
    ).toEqual({ ok: true, state });
    expect(
      applyCommand(state, 'A', {
        type: 'enqueue-production',
        baseId: 'missing',
        unitKind: 'unknown',
      }),
    ).toEqual({
      ok: false,
      state,
      reason: 'BASE_NOT_FOUND',
    });
    expect(
      applyCommand(state, 'A', {
        type: 'enqueue-production',
        baseId: 'HQ-B',
        unitKind: 'assault',
      }),
    ).toEqual({
      ok: false,
      state,
      reason: 'NOT_OWNER',
    });
    expect(
      applyCommand(state, 'A', {
        type: 'enqueue-production',
        baseId: 'HQ-A',
        unitKind: 'unknown',
      }),
    ).toEqual({
      ok: false,
      state,
      reason: 'INVALID_UNIT_KIND',
    });
    expect(
      applyCommand(state, 'A', {
        type: 'start-research',
        researchId: 'unknown',
      }),
    ).toEqual({
      ok: false,
      state,
      reason: 'RESEARCH_NOT_FOUND',
    });
  });

  it('refunds all jobs on HQ destruction and prevents same-tick completion', () => {
    let state = withFaction(runningMatch(), { supplyCenti: 100_000 });
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    });
    const paidBalance = faction(state).supplyCenti;
    const nearComplete = withFaction(state, {
      productionJobs: faction(state).productionJobs.map((job, index) =>
        index === 0 ? { ...job, remainingTicks: 1 } : job,
      ),
    });
    const destroyed = {
      ...nearComplete,
      bases: nearComplete.bases.map((base) =>
        base.id === 'HQ-A' ? { ...base, hp: 0 } : base,
      ),
    };
    const refunded = cancelAllProductionForDestroyedHq(destroyed, 'A');
    expect(faction(refunded).supplyCenti).toBe(paidBalance + 18_000);
    expect(faction(refunded).productionJobs).toEqual([]);
    expect(cancelAllProductionForDestroyedHq(refunded, 'A')).toBe(refunded);
    expect(
      advanceProduction(refunded).units.some(({ id }) => id === 'A-03'),
    ).toBe(false);
  });

  it('counts live units and reservations toward the six-unit cap', () => {
    let state = withFaction(runningMatch(), { supplyCenti: 100_000 });
    for (let i = 0; i < 3; i += 1) {
      state = accepted(state, {
        type: 'enqueue-production',
        baseId: 'HQ-A',
        unitKind: 'scout',
      });
      for (let tick = 0; tick < 60; tick += 1) state = advanceProduction(state);
    }
    state = accepted(state, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    expect(
      applyCommand(state, 'A', {
        type: 'enqueue-production',
        baseId: 'HQ-A',
        unitKind: 'scout',
      }),
    ).toEqual({
      ok: false,
      state,
      reason: 'UNIT_LIMIT',
    });
  });
});

describe('G2 research', () => {
  it('completes at exactly the required amount without leaving bank or active work', () => {
    let state = withFaction(runningMatch(), { researchCenti: 6_000 });
    state = accepted(state, {
      type: 'start-research',
      researchId: 'firepower-1',
    });
    expect(faction(state)).toMatchObject({
      researchCenti: 0,
      researchProgressCenti: { 'firepower-1': 6_000 },
      activeResearch: null,
      completedResearchIds: ['firepower-1'],
    });
  });

  it('fills exactly to a selected cost, banks excess, and completes immediately', () => {
    let state = withFaction(runningMatch(), { researchCenti: 7_000 });
    state = accepted(state, {
      type: 'start-research',
      researchId: 'firepower-1',
    });
    expect(faction(state)).toMatchObject({
      researchCenti: 1_000,
      researchProgressCenti: { 'firepower-1': 6_000, 'firepower-2': 0 },
      activeResearch: null,
      completedResearchIds: ['firepower-1'],
    });
    expect(firepowerBonus(faction(state))).toBe(1);
    expect(
      applyCommand(state, 'A', {
        type: 'start-research',
        researchId: 'firepower-1',
      }),
    ).toEqual({
      ok: false,
      state,
      reason: 'ALREADY_RESEARCHED',
    });
  });

  it('allows selection without enough bank and preserves partial progress when banking/reselecting', () => {
    let state = withFaction(runningMatch(), { researchCenti: 2_000 });
    state = accepted(state, {
      type: 'start-research',
      researchId: 'firepower-1',
    });
    expect(faction(state)).toMatchObject({
      researchCenti: 0,
      researchProgressCenti: { 'firepower-1': 2_000 },
      activeResearch: { researchId: 'firepower-1' },
    });
    const sameSelection = applyCommand(state, 'A', {
      type: 'start-research',
      researchId: 'firepower-1',
    });
    expect(sameSelection).toEqual({ ok: true, state });
    expect(sameSelection.state).toBe(state);
    state = accepted(state, { type: 'start-research', researchId: null });
    state = withFaction(state, { researchCenti: 400 });
    state = accepted(state, {
      type: 'start-research',
      researchId: 'firepower-1',
    });
    expect(faction(state)).toMatchObject({
      researchCenti: 0,
      researchProgressCenti: { 'firepower-1': 2_400 },
      activeResearch: { researchId: 'firepower-1' },
    });
  });

  it('retains each research progress record and rejects prerequisite selection without mutation', () => {
    let state = withFaction(runningMatch(), { researchCenti: 1_000 });
    const rejected = applyCommand(state, 'A', {
      type: 'start-research',
      researchId: 'firepower-2',
    });
    expect(rejected).toEqual({
      ok: false,
      state,
      reason: 'PREREQUISITE_MISSING',
    });
    state = withFaction(state, {
      researchCenti: 0,
      completedResearchIds: ['firepower-1'],
      researchProgressCenti: {
        'firepower-1': 6_000,
        'firepower-2': 8_000,
        'bridge-2': 0,
        'bridge-3': 0,
        'ropeway-1': 0,
        'ropeway-2': 0,
      },
    });
    state = accepted(state, {
      type: 'start-research',
      researchId: 'firepower-2',
    });
    expect(faction(state)).toMatchObject({
      researchProgressCenti: { 'firepower-2': 8_000 },
      activeResearch: { researchId: 'firepower-2' },
    });
    state = accepted(state, { type: 'start-research', researchId: null });
    state = applyEconomyTick(state);
    expect(faction(state).researchCenti).toBe(12);
    state = accepted(state, {
      type: 'start-research',
      researchId: 'firepower-2',
    });
    expect(faction(state)).toMatchObject({
      researchCenti: 0,
      researchProgressCenti: { 'firepower-1': 6_000, 'firepower-2': 8_012 },
      activeResearch: { researchId: 'firepower-2' },
    });
    state = accepted(state, { type: 'start-research', researchId: null });
    expect(faction(state)).toMatchObject({
      researchProgressCenti: { 'firepower-1': 6_000, 'firepower-2': 8_012 },
      activeResearch: null,
    });
  });

  it('banks all-faction base income, including after HQ destruction, when unselected', () => {
    let state = withFaction(runningMatch(), {
      researchCenti: 0,
      activeResearch: null,
    });
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'HQ-A' ? { ...base, hp: 0 } : base,
      ),
    };
    for (let tick = 0; tick < 10; tick += 1) state = applyEconomyTick(state);
    expect(faction(state).researchCenti).toBe(120);
    expect(faction(state).researchProgressCenti).toEqual({
      'firepower-1': 0,
      'firepower-2': 0,
      'bridge-2': 0,
      'bridge-3': 0,
      'ropeway-1': 0,
      'ropeway-2': 0,
      'supply-lines-1': 0,
      'maintenance-1': 0,
      'survey-1': 0,
      'survey-2': 0,
    });
    for (const id of ['A', 'B', 'C'] as const) {
      const current = state.factions.find((entry) => entry.id === id)!;
      expect(current.researchCenti).toBe(120);
    }
  });

  it('applies completed logistics effects to base income and per-unit upkeep', () => {
    const baseline = runningMatch();
    const expectedWithoutTech = applyEconomyTick(baseline);
    let state = withFaction(baseline, {
      completedResearchIds: ['supply-lines-1', 'maintenance-1'],
    });
    state = applyEconomyTick(state);
    // Two owned bases each add 1 centi/tick; two units each save 1 centi/tick.
    expect(
      faction(state).supplyCenti - faction(expectedWithoutTech).supplyCenti,
    ).toBe(4);
    expect(
      researchEffectValue(faction(state), state.rules, 'upkeep-reduction'),
    ).toBe(1);
  });

  it('rejects selecting a research excluded by a completed peer without mutating state', () => {
    const state = withFaction(runningMatch(), {
      completedResearchIds: ['maintenance-1'],
      researchCenti: 1_000,
    });
    expect(
      applyCommand(state, 'A', {
        type: 'start-research',
        researchId: 'supply-lines-1',
      }),
    ).toEqual({ ok: false, state, reason: 'RESEARCH_EXCLUDED' });
  });

  it('uses the income from this tick to finish after combat, so its bonus starts next tick', () => {
    let state = withFaction(runningMatch(), {
      researchCenti: 0,
      researchProgressCenti: {
        'firepower-1': 5_998,
        'firepower-2': 0,
        'bridge-2': 0,
        'bridge-3': 0,
        'ropeway-1': 0,
        'ropeway-2': 0,
      },
      activeResearch: { researchId: 'firepower-1' },
    });
    for (let tick = 0; tick < 10; tick += 1) state = applyEconomyTick(state);
    state = advanceResearch(state);
    expect(faction(state)).toMatchObject({
      researchCenti: 118,
      researchProgressCenti: { 'firepower-1': 6_000 },
      activeResearch: null,
      completedResearchIds: ['firepower-1'],
    });
    expect(firepowerBonus(faction(state))).toBe(1);
  });
});
