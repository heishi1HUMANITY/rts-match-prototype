import { describe, expect, it } from 'vitest';
import { advanceCapture } from './capture';
import { createMatch } from './match';
import type { MatchState, UnitState } from './types';
import { DEFAULT_RULES } from './rules';

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
  it.each([
    ['outpost', 300],
    ['medium', 500],
    ['large', 800],
  ] as const)(
    'restores the configured percentage for %s bases',
    (kind, maxHp) => {
      for (const percent of [1, 30, 50, 100]) {
        const state = createMatch(42, {
          rules: {
            ...DEFAULT_RULES,
            capture: { ...DEFAULT_RULES.capture, restoredHpPercent: percent },
          },
        });
        const target = state.bases.find((base) => base.kind === kind)!;
        const capturing: MatchState = {
          ...state,
          units: [{ ...state.units[0]!, cell: target.cell }],
          bases: state.bases.map((base) =>
            base.id === target.id
              ? {
                  ...base,
                  owner: null,
                  hp: 0,
                  defender: null,
                  captureCandidate: 'A',
                  captureProgressCentiTicks:
                    state.rules.capture.requiredTicks * 100 - 100,
                }
              : base,
          ),
        };
        expect(
          advanceCapture(capturing).bases.find((base) => base.id === target.id),
        ).toMatchObject({
          owner: 'A',
          maxHp,
          hp: Math.floor((maxHp * percent) / 100),
        });
      }
    },
  );

  it('rounds fractional HP down and retains positive HP for small edited bases', () => {
    for (const maxHp of [1, 101]) {
      const state = createMatch(42, {
        rules: {
          ...DEFAULT_RULES,
          bases: {
            ...DEFAULT_RULES.bases,
            large: { ...DEFAULT_RULES.bases.large, maxHp },
          },
          capture: {
            ...DEFAULT_RULES.capture,
            restoredHpPercent: 30,
            requiredTicks: 1,
          },
        },
      });
      const base = state.bases.find(({ kind }) => kind === 'large')!;
      const capturing: MatchState = {
        ...unguarded(state, base.id),
        units: [{ ...state.units[0]!, cell: base.cell }],
      };
      expect(
        advanceCapture(capturing).bases.find(({ id }) => id === base.id),
      ).toMatchObject({ owner: 'A', hp: maxHp === 1 ? 1 : 30 });
    }
  });

  it('requires 200 uninterrupted ticks and captures on the threshold tick', () => {
    let state = unguarded(createMatch(42));
    const unit = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
    };
    state = withUnits(state, [unit]);
    for (let tick = 1; tick < 200; tick += 1) {
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

  it('pauses progress while enemy is present, resumes when enemy leaves, and resets when no occupants', () => {
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
    // When enemy B and C are present with A: progress is PAUSED (held, not reset)
    state = { ...state, bases, units: [a, b, c] };
    state = advanceCapture(state);
    expect(state.bases[baseIndex]).toMatchObject({
      owner: null,
      captureCandidate: 'A',
      captureProgressCentiTicks: 1200,
    });

    // When enemy leaves and only A remains: progress RESUMES
    state = { ...state, units: [a] };
    state = advanceCapture(state);
    expect(state.bases[baseIndex]).toMatchObject({
      owner: null,
      captureCandidate: 'A',
      captureProgressCentiTicks: 1300,
    });

    // When all units leave (no occupants): progress RESETS
    state = { ...state, units: [] };
    state = advanceCapture(state);
    expect(state.bases[baseIndex]).toMatchObject({
      owner: null,
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
    for (let tick = 0; tick < 100; tick += 1) state = advanceCapture(state);
    expect(state.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      owner: 'A',
      captureProgressCentiTicks: 0,
    });
  });
});
