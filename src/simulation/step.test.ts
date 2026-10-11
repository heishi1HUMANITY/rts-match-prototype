import { describe, expect, it } from 'vitest';
import { applyTicketTick } from './tickets';
import { createMatch } from './match';
import { stepMatch } from './step';
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
  it('keeps ready and paused states referentially unchanged', () => {
    const ready = createMatch(42);
    expect(stepMatch(ready)).toBe(ready);
    const paused = { ...ready, phase: 'paused' as const };
    expect(stepMatch(paused)).toBe(paused);
  });

  it('captures an uncontested outpost on tick 30 and includes its income that tick', () => {
    let state = running(createMatch(42, { scenarioId: 'g2-capture' }));
    for (let i = 0; i < 30; i += 1) state = stepMatch(state);
    expect(state.elapsedTicks).toBe(30);
    expect(state.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: 'A',
      hp: 100,
      captureCandidate: null,
      captureTicks: 0,
    });
    expect(state.factions.find(({ id }) => id === 'A')).toMatchObject({
      supplyCenti: 20_980,
      researchCenti: 10,
    });
  });

  it('g2-combat damages both sides for one tick and removes both on the second', () => {
    let state = running(createMatch(42, { scenarioId: 'g2-combat' }));
    state = stepMatch(state);
    expect(state.units.find(({ id }) => id === 'A-01')?.hp).toBe(2);
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(2);
    state = stepMatch(state);
    expect(state.units.some(({ id }) => id === 'A-01' || id === 'B-01')).toBe(
      false,
    );
    expect(state.factions.find(({ id }) => id === 'A')?.ticketsCenti).toBe(
      99_200,
    );
    expect(state.factions.find(({ id }) => id === 'B')?.ticketsCenti).toBe(
      99_200,
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
    state = stepMatch(state);
    expect(state.units.find(({ id }) => id === 'A-01')).toMatchObject({
      cell: { x: 19, y: 20 },
      edgeProgress: 1,
    });
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(100);
    state = stepMatch(state);
    expect(state.units.find(({ id }) => id === 'A-01')).toMatchObject({
      cell: { x: 20, y: 20 },
      edgeProgress: 0,
    });
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(98);
  });

  it('applies a research project completing this tick to this tick combat', () => {
    let state = running(createMatch(42));
    const a = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 20, y: 20 },
    };
    const b = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 22, y: 20 },
      hp: 5,
      maxHp: 100,
    };
    state = onlyUnits(state, [a, b]);
    state = setFaction(state, 'A', {
      activeResearch: {
        researchId: 'firepower-1',
        costCenti: 6_000,
        remainingTicks: 1,
      },
      completedResearchIds: [],
    });
    state = stepMatch(state);
    expect(state.factions.find(({ id }) => id === 'A')).toMatchObject({
      activeResearch: null,
      completedResearchIds: ['firepower-1'],
    });
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(2);
  });

  it('does not let a unit produced at tick end attack until the next tick', () => {
    let state = running(createMatch(42));
    const enemy = {
      ...state.units.find(({ id }) => id === 'B-01')!,
      cell: { x: 8, y: 34 },
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
      cell: { x: 6, y: 34 },
      hp: 100,
    });
    expect(state.units.find(({ id }) => id === 'B-01')?.hp).toBe(50);
  });

  it('cancels and refunds all production when an HQ is destroyed at remaining tick one', () => {
    let state = running(createMatch(42));
    const attacker = {
      ...state.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 32, y: 33 },
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
      supplyCenti: 11_000,
      productionJobs: [],
      ticketsCenti: 90_000,
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
      cell: { x: 32, y: 33 },
    };
    state = onlyUnits(state, [a, b, c]);
    state = {
      ...state,
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
      100_000,
    );
    expect(state.factions.find(({ id }) => id === 'B')?.ticketsCenti).toBe(0);
    expect(state.factions.find(({ id }) => id === 'C')?.ticketsCenti).toBe(
      99_990,
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
