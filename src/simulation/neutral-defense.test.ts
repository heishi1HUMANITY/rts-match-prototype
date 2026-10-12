import { describe, expect, it } from 'vitest';
import { createMatch } from './match';
import { resolveCombat } from './combat';
import { getFactionView } from './view';
import { stepMatch } from './step';
import { updateFactionKnowledge } from './visibility';
import type { MatchState } from './types';

function running(state: MatchState): MatchState {
  return { ...state, phase: 'running' };
}

describe('F05 neutral garrisons and capture', () => {
  it('resolves faction fire and garrison fire from the same unit snapshot', () => {
    const state = running(
      createMatch(42, { scenarioId: 'f05-neutral-defense' }),
    );
    const forward = resolveCombat(state);
    const reversed = resolveCombat({
      ...state,
      units: [...state.units].reverse(),
    });
    expect(forward.bases).toEqual(reversed.bases);
    expect([...forward.units].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...reversed.units].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it('requires garrison defeat, base destruction, then uncontested land control', () => {
    let state = running(createMatch(42, { scenarioId: 'f05-neutral-defense' }));
    const outpost = () => state.bases.find(({ id }) => id === 'OUT-03')!;
    for (let tick = 0; tick < 20; tick += 1) state = stepMatch(state);
    expect(outpost()).toMatchObject({
      owner: null,
      hp: 100,
      defender: { hp: 0 },
    });
    expect(state.units.find(({ id }) => id === 'A-01')?.hp).toBe(80);

    for (let tick = 0; tick < 34; tick += 1) state = stepMatch(state);
    expect(outpost()).toMatchObject({
      owner: null,
      hp: 0,
      captureCandidate: 'A',
      captureTicks: 1,
      defender: { hp: 0 },
    });
    for (let tick = 0; tick < 29; tick += 1) state = stepMatch(state);
    expect(outpost()).toMatchObject({
      owner: 'A',
      hp: 30,
      captureCandidate: null,
      captureTicks: 0,
      defender: null,
    });
  });

  it('restores a disabled garrison and base after 300 safe ticks', () => {
    let state = createMatch(42, { scenarioId: 'f05-neutral-defense' });
    state = {
      ...state,
      units: [],
      bases: state.bases.map((base) =>
        base.id === 'OUT-03'
          ? {
              ...base,
              hp: 0,
              defender: { hp: 0, maxHp: 60, disabledTicks: 0 },
            }
          : base,
      ),
    };
    for (let tick = 0; tick < 300; tick += 1) {
      state = stepMatch(running(state));
      if (tick < 299)
        expect(
          state.bases.find(({ id }) => id === 'OUT-03')?.defender?.hp,
        ).toBe(0);
    }
    expect(state.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      hp: 100,
      defender: { hp: 60, maxHp: 60, disabledTicks: 0 },
    });
  });

  it('rebuilds a full neutral garrison when an owned outpost is destroyed', () => {
    let state = createMatch(42);
    const attacker = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 19, y: 20 },
    };
    state = {
      ...state,
      units: [attacker],
      bases: state.bases.map((base) =>
        base.id === 'OUT-02'
          ? { ...base, owner: 'B', hp: 1, defender: null }
          : base,
      ),
    };
    state = {
      ...state,
      phase: 'running',
    };
    state = stepMatch(state);
    expect(state.bases.find(({ id }) => id === 'OUT-02')).toMatchObject({
      owner: null,
      hp: 300,
      defender: { hp: 160, maxHp: 160, disabledTicks: 0 },
    });
  });

  it('keeps defender strength at visible or last-observed information only', () => {
    let state = createMatch(42);
    state = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: { x: 17, y: 17 } } : unit,
      ),
      bases: state.bases.map((base) =>
        base.id === 'OUT-01'
          ? {
              ...base,
              defender: { hp: 7, maxHp: 60, disabledTicks: 0 },
            }
          : base,
      ),
    };
    state = { ...state, knowledge: updateFactionKnowledge(state) };
    expect(
      getFactionView(state, 'A').bases.find(({ id }) => id === 'OUT-01'),
    ).toMatchObject({
      visibility: 'visible',
      defenderHp: 7,
      defenderMaxHp: 60,
    });
    state = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: { x: 6, y: 33 } } : unit,
      ),
    };
    state = { ...state, knowledge: updateFactionKnowledge(state) };
    expect(
      getFactionView(state, 'A').bases.find(({ id }) => id === 'OUT-01'),
    ).toMatchObject({
      visibility: 'remembered',
      defenderHp: 7,
      defenderMaxHp: 60,
    });
    expect(
      getFactionView(createMatch(42), 'A').bases.find(
        ({ id }) => id === 'OUT-01',
      ),
    ).toMatchObject({
      visibility: 'unknown',
      defenderHp: null,
      defenderMaxHp: null,
    });
  });
});
