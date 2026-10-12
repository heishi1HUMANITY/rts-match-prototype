import { describe, expect, it } from 'vitest';
import { advanceCapture } from './capture';
import { createMatch } from './match';
import type { MatchState, UnitState } from './types';

function withUnits(state: MatchState, units: UnitState[]): MatchState {
  return { ...state, units };
}
function unguarded(state: MatchState, id = 'OUT-02'): MatchState {
  return {
    ...state,
    bases: state.bases.map((base) =>
      base.id === id ? { ...base, hp: 0, defender: null } : base,
    ),
  };
}

describe('outpost capture', () => {
  it('requires 30 uninterrupted ticks and captures on the threshold tick', () => {
    let state = unguarded(createMatch(42));
    const unit = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
    };
    state = withUnits(state, [unit]);
    for (let tick = 1; tick < 30; tick += 1) {
      state = advanceCapture(state);
      expect(state.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
        owner: null,
        captureCandidate: 'A',
        captureProgressCentiTicks: tick * 100,
      });
    }
    state = advanceCapture(state);
    expect(state.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      owner: 'A',
      hp: Math.floor(state.rules.bases.large.maxHp * 0.3),
      defender: null,
      captureCandidate: null,
      captureProgressCentiTicks: 0,
    });
  });

  it('resets progress for no occupants and for two or three competing factions', () => {
    let state = unguarded(createMatch(42));
    const a = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
    };
    const b = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 21, y: 20 },
    };
    const c = {
      ...state.units.find(({ id }) => id === 'C-01')!,
      cell: { x: 20, y: 21 },
    };
    const baseIndex = state.bases.findIndex(({ id }) => id === 'OUT-02');
    const bases = state.bases.map((base, index) =>
      index === baseIndex
        ? {
            ...base,
            captureCandidate: 'A' as const,
            captureProgressCentiTicks: 1200,
          }
        : base,
    );
    state = { ...state, bases, units: [a, b, c] };
    state = advanceCapture(state);
    expect(state.bases[baseIndex]).toMatchObject({
      owner: null,
      captureCandidate: null,
      captureProgressCentiTicks: 0,
    });
    state = { ...state, units: [] };
    state = advanceCapture(state);
    expect(state.bases[baseIndex]).toMatchObject({
      captureCandidate: null,
      captureProgressCentiTicks: 0,
    });
  });

  it('starts a changed sole candidate at one tick and ignores dead units', () => {
    let state = unguarded(createMatch(42));
    const baseIndex = state.bases.findIndex(({ id }) => id === 'OUT-02');
    const bases = state.bases.map((base, index) =>
      index === baseIndex
        ? {
            ...base,
            captureCandidate: 'A' as const,
            captureProgressCentiTicks: 1000,
          }
        : base,
    );
    const deadA = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
      hp: 0,
    };
    const b = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 20, y: 20 },
    };
    state = { ...state, bases, units: [deadA, b] };
    state = advanceCapture(state);
    expect(state.bases[baseIndex]).toMatchObject({
      captureCandidate: 'B',
      captureProgressCentiTicks: 100,
    });
  });

  it('uses inclusive radius-one boundaries with doubled positions', () => {
    let state = unguarded(createMatch(42));
    const atBoundary = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 21, y: 20 },
    };
    state = withUnits(state, [atBoundary]);
    state = advanceCapture(state);
    expect(state.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      captureCandidate: 'A',
      captureProgressCentiTicks: 100,
    });
    const outside = { ...atBoundary, cell: { x: 22, y: 20 } };
    state = { ...state, units: [outside] };
    state = advanceCapture(state);
    expect(state.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      captureCandidate: null,
      captureProgressCentiTicks: 0,
    });
  });

  it('adds capture progress at the configured per-unit efficiency', () => {
    let state = unguarded(createMatch(42));
    const unit = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
    };
    state = {
      ...state,
      units: [unit],
      rules: {
        ...state.rules,
        units: {
          ...state.rules.units,
          assault: {
            ...state.rules.units.assault,
            captureEfficiencyPercent: 200,
          },
        },
      },
    };
    for (let tick = 0; tick < 15; tick += 1) state = advanceCapture(state);
    expect(state.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      owner: 'A',
      captureProgressCentiTicks: 0,
    });
  });
});
