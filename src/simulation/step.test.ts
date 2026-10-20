import { describe, expect, it } from 'vitest';
import { applyTicketTick } from './tickets';
import { createMatch } from './match';
import { stepMatch, stepUnit } from './step';
import { DEFAULT_RULES } from './rules';
import type { MatchState, ProductionJob, UnitState } from './types';

function running(state: MatchState): MatchState {
  return { ...state, phase: 'running' };
}
function setFaction(
  state: MatchState,
  id: 'A' | 'B' | 'C',
  update: Partial<MatchState['factions'][number]>,
): MatchState {
  return {
    ...state,
    factions: state.factions.map((faction) =>
      faction.id === id ? { ...faction, ...update } : faction,
    ),
  };
}
function onlyUnits(state: MatchState, units: UnitState[]): MatchState {
  return { ...state, units };
}

describe('G2 fixed-tick integration', () => {
  it('uses the match snapshot movement time for speed, interpolation, and later reset isolation', () => {
    const rules = structuredClone(DEFAULT_RULES);
    const customRules = {
      ...rules,
      units: {
        ...rules.units,
        assault: { ...rules.units.assault, moveTicksPerCell: 4 },
      },
    };
    const match = createMatch(42, { rules: customRules });
    const unit = match.units.find(({ id }) => id === 'A-01')!;
    expect(unit.moveTicksPerCell).toBe(4);
    let moving: UnitState = { ...unit, path: [{ x: 7, y: 20 }] };
    for (const progress of [1, 2, 3]) {
      moving = stepUnit(moving);
      expect(moving.edgeProgress).toBe(progress);
      expect(moving.cell).toEqual({ x: 6, y: 20 });
    }
    moving = stepUnit(moving);
    expect(moving.edgeProgress).toBe(0);
    expect(moving.cell).toEqual({ x: 7, y: 20 });
    const mutableView = JSON.parse(
      JSON.stringify(match.rules),
    ) as typeof match.rules;
    (
      mutableView.units.assault as { moveTicksPerCell: number }
    ).moveTicksPerCell = 9;
    expect(match.rules.units.assault.moveTicksPerCell).toBe(4);
  });

  it('keeps ready and paused states referentially unchanged', () => {
    const ready = createMatch(42);
    expect(stepMatch(ready)).toBe(ready);
    const paused = { ...ready, phase: 'paused' as const };
    expect(stepMatch(paused)).toBe(paused);
  });

  it('adds present unit capture efficiencies while income stays flat', () => {
    let state = running(
      createMatch(42, {
        scenarioId: 'g2-capture',
        rules: {
          ...DEFAULT_RULES,
          capture: { ...DEFAULT_RULES.capture, requiredTicks: 30 },
        },
      }),
    );
    for (let i = 0; i < 15; i += 1) state = stepMatch(state);
    expect(state.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: 'A',
      hp: 90,
      captureCandidate: null,
      captureProgressCentiTicks: 0,
    });
    for (let i = 0; i < 15; i += 1) state = stepMatch(state);
    expect(state.elapsedTicks).toBe(30);
    expect(state.factions.find(({ id }) => id === 'A')).toMatchObject({
      supplyCenti: 23_150,
      researchCenti: 720,
    });
  });

  it('g2-combat damages both sides for one tick and removes both on the second', () => {
    let state = running(createMatch(42, { scenarioId: 'g2-combat' }));
    state = stepMatch(state);
    expect(state.units.find(({ id }) => id === 'A-01')?.hp).toBe(20);
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(20);
    for (let tick = 0; tick < 10; tick += 1) state = stepMatch(state);
    expect(state.units.some(({ id }) => id === 'A-01' || id === 'B-01')).toBe(
      false,
    );
    expect(state.factions.find(({ id }) => id === 'A')?.ticketsCenti).toBe(
      39_200,
    );
    expect(state.factions.find(({ id }) => id === 'B')?.ticketsCenti).toBe(
      39_200,
    );
  });

  it('uses the post-movement half-cell snapshot for attack range', () => {
    let state = running(createMatch(42));
    const a = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 19, y: 20 },
      path: [{ x: 20, y: 20 }],
      edgeProgress: 0 as const,
    };
    const b = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 22, y: 20 },
    };
    state = onlyUnits(state, [a, b]);
    state = {
      ...state,
      // Neutral bases sit out of the way so only unit combat is measured.
      bases: state.bases.map((base) =>
        base.kind === 'hq'
          ? base
          : { ...base, defender: null, cell: { x: 0, y: 39 } },
      ),
    };
    state = stepMatch(stepMatch(state));
    expect(state.units.find(({ id }) => id === 'A-01')).toMatchObject({
      cell: { x: 19, y: 20 },
      edgeProgress: 2,
    });
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(200);
    state = stepMatch(stepMatch(state));
    expect(state.units.find(({ id }) => id === 'A-01')).toMatchObject({
      cell: { x: 20, y: 20 },
      edgeProgress: 0,
    });
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(180);
  });

  it('completes research after combat and applies its bonus starting next tick', () => {
    let state = running(createMatch(42));
    const a = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
    };
    const b = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 22, y: 20 },
      hp: 41,
      maxHp: 200,
    };
    state = onlyUnits(state, [a, b]);
    state = setFaction(state, 'A', {
      activeResearch: { researchId: 'firepower-1' },
      researchCenti: 0,
      researchProgressCenti: {
        'firepower-1': 9_588,
        'firepower-2': 0,
        'bridge-2': 0,
        'bridge-3': 0,
        'ropeway-1': 0,
        'ropeway-2': 0,
      },
      completedResearchIds: [],
    });
    state = stepMatch(state);
    expect(state.factions.find(({ id }) => id === 'A')).toMatchObject({
      activeResearch: null,
      completedResearchIds: ['firepower-1'],
    });
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(21);
    for (let tick = 0; tick < 10; tick += 1) state = stepMatch(state);
    expect(state.units.some(({ id }) => id === 'B-01')).toBe(false);
  });

  it('does not let a unit produced at tick end attack until the next tick', () => {
    let state = running(createMatch(42));
    const enemy = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 7, y: 20 },
      hp: 50,
      maxHp: 100,
    };
    state = onlyUnits(state, [enemy]);
    const job: ProductionJob = {
      id: 'A-J01',
      baseId: 'HQ-A',
      unitId: 'A-03',
      unitKind: 'assault',
      costCenti: 12_000,
      status: 'active',
      remainingTicks: 1,
    };
    state = setFaction(state, 'A', { productionJobs: [job] });
    state = stepMatch(state);
    expect(state.units.find(({ id }) => id === 'A-03')).toMatchObject({
      cell: { x: 5, y: 20 },
      hp: 200,
    });
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(50);
  });

  it('cancels and refunds all production when an HQ is destroyed at remaining tick one', () => {
    let state = running(createMatch(42));
    state = {
      ...state,
      elapsedTicks: 1200,
    };
    const attacker = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 27, y: 33 },
    };
    state = onlyUnits(state, [attacker]);
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'HQ-B' ? { ...base, hp: 2 } : base,
      ),
    };
    const job: ProductionJob = {
      id: 'B-J01',
      baseId: 'HQ-B',
      unitId: 'B-03',
      unitKind: 'scout',
      costCenti: 6_000,
      status: 'active',
      remainingTicks: 1,
    };
    state = setFaction(state, 'B', {
      productionJobs: [job],
      supplyCenti: 5_000,
    });
    state = stepMatch(state);
    expect(state.bases.find(({ id }) => id === 'HQ-B')).toMatchObject({
      owner: 'B',
      homeFactionId: 'B',
      hp: 0,
    });
    expect(state.factions.find(({ id }) => id === 'B')).toMatchObject({
      supplyCenti: 11_120,
      productionJobs: [],
      ticketsCenti: 0,
      eliminationReason: 'hq',
    });
    expect(state.units.some(({ id }) => id === 'B-03')).toBe(false);
  });

  it('combines unit loss, HQ loss, and boundary ticket pressure before clamping', () => {
    let state = running(createMatch(42));
    const a = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 22, y: 20 },
    };
    const b = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 20, y: 20 },
      hp: 2,
    };
    const c = {
      ...state.units.find(({ id }) => id === 'C-01')!,
      cell: { x: 29, y: 33 },
    };
    state = onlyUnits(state, [a, b, c]);
    state = {
      ...state,
      rules: {
        ...state.rules,
        match: { ...state.rules.match, hqProtectionTicks: 0 },
      },
      elapsedTicks: 9,
      bases: state.bases.map((base) => {
        if (base.id === 'HQ-B') return { ...base, hp: 2 };
        if (base.id === 'OUT-03') return { ...base, owner: 'A', hp: 100 };
        return base;
      }),
      factions: state.factions.map((faction) =>
        faction.id === 'B' ? { ...faction, ticketsCenti: 500 } : faction,
      ),
    };
    state = stepMatch(state);
    expect(state.elapsedTicks).toBe(10);
    expect(state.units.some(({ id }) => id === 'B-01')).toBe(false);
    expect(state.bases.find(({ id }) => id === 'HQ-B')?.hp).toBe(0);
    expect(state.factions.find(({ id }) => id === 'B')?.ticketsCenti).toBe(0);
    expect(state.phase).toBe('running');
  });

  it('applies ticket pressure only at 10-tick boundaries and clamps each faction at zero', () => {
    let state = createMatch(42);
    state = {
      ...state,
      elapsedTicks: 9,
      bases: state.bases.map((base) =>
        base.id === 'OUT-03' ? { ...base, owner: 'A', hp: 100 } : base,
      ),
    };
    const beforeBoundary = applyTicketTick(state);
    expect(beforeBoundary).toBe(state);
    state = { ...state, elapsedTicks: 10 };
    state = setFaction(state, 'B', { ticketsCenti: 5 });
    state = applyTicketTick(state);
    expect(state.factions.find(({ id }) => id === 'A')?.ticketsCenti).toBe(
      40_000,
    );
    expect(state.factions.find(({ id }) => id === 'B')?.ticketsCenti).toBe(0);
    expect(state.factions.find(({ id }) => id === 'C')?.ticketsCenti).toBe(
      39_990,
    );
  });

  it('is invariant to unit and base array order for a combat/capture tick', () => {
    const initial = running(createMatch(42, { scenarioId: 'g2-combat' }));
    const forward = stepMatch(initial);
    const reversed = stepMatch({
      ...initial,
      units: [...initial.units].reverse(),
      bases: [...initial.bases].reverse(),
    });
    const normalize = (state: MatchState) => ({
      units: [...state.units].sort((a, b) => a.id.localeCompare(b.id)),
      bases: [...state.bases].sort((a, b) => a.id.localeCompare(b.id)),
      factions: [...state.factions].sort((a, b) => a.id.localeCompare(b.id)),
      elapsedTicks: state.elapsedTicks,
    });
    expect(normalize(reversed)).toEqual(normalize(forward));
  });
});
