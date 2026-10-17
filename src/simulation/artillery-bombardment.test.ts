import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { resolveCombat } from './combat';
import { createMatch } from './match';
import { stepMatch } from './step';
import { isCellVisibleToFaction, updateFactionKnowledge } from './visibility';
import { getFactionView } from './view';
import type { MatchState, UnitState } from './types';

function fixture(targetCell = { x: 27, y: 20 }): MatchState {
  const initial = createMatch(2468, { scenarioId: 'g2-combat' });
  const artillery: UnitState = {
    ...initial.units.find(({ id }) => id === 'A-01')!,
    id: 'A-GUN',
    kind: 'artillery',
    cell: { x: 20, y: 20 },
    path: [],
    edgeProgress: 0,
    attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
  };
  const target: UnitState = {
    ...initial.units.find(({ id }) => id === 'B-01')!,
    cell: targetCell,
    path: [],
    edgeProgress: 0,
    hp: 200,
    maxHp: 200,
  };
  const state: MatchState = {
    ...initial,
    phase: 'running',
    bases: [],
    facilities: [],
    crossings: [],
    units: [artillery, target],
    factions: initial.factions.map((faction) =>
      faction.id === 'A'
        ? { ...faction, completedResearchIds: ['specialization-power'] }
        : faction,
    ),
  };
  return { ...state, knowledge: updateFactionKnowledge(state) };
}

function issuePointFire(
  state: MatchState,
  cell = { x: 27, y: 20 },
): MatchState {
  const result = applyCommand(state, 'A', {
    type: 'point-fire',
    unitId: 'A-GUN',
    cell,
  });
  if (!result.ok) throw new Error(`point-fire rejected: ${result.reason}`);
  return result.state;
}

function visibleTargetCell(state: MatchState) {
  for (let y = 16; y <= 24; y++)
    for (let x = 16; x <= 24; x++)
      if (
        (x !== 20 || y !== 20) &&
        isCellVisibleToFaction(state, { x, y }, 'A')
      )
        return { x, y };
  throw new Error('no visible artillery target cell');
}

describe('artillery point fire', () => {
  it('uses the shared attack cooldown and cancels an order without clearing it', () => {
    const initial = fixture();
    const artillery = initial.units[0]!;
    const cooling = {
      ...artillery,
      attack: { targetId: null, phase: 'cooldown' as const, phaseEndsTick: 24 },
    };
    const state = { ...initial, units: [cooling, initial.units[1]!] };
    const ordered = issuePointFire(state);
    expect(ordered.units[0]!.bombardOrder).toEqual({
      cell: { x: 27, y: 20 },
      fireAtTick: 34,
    });
    const moved = applyCommand(ordered, 'A', {
      type: 'move',
      unitId: 'A-GUN',
      target: { x: 19, y: 20 },
    });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.units[0]!.bombardOrder).toBeNull();
    expect(moved.state.units[0]!.attack).toEqual(cooling.attack);

    const stopped = applyCommand(ordered, 'A', {
      type: 'stop',
      unitId: 'A-GUN',
    });
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    expect(stopped.state.units[0]!.bombardOrder).toBeNull();
    expect(stopped.state.units[0]!.attack).toEqual(cooling.attack);
  });

  it('locks observation, impact delay, and scatter at the firing tick deterministically', () => {
    const makeStrike = (initial: MatchState, cell = { x: 27, y: 20 }) => {
      let state = issuePointFire(initial, cell);
      state = { ...state, elapsedTicks: 10 };
      const fired = resolveCombat(state);
      return fired.scheduledStrikes.find(
        ({ sourceUnitId }) => sourceUnitId === 'A-GUN',
      )!;
    };
    const hidden = fixture({ x: 27, y: 20 });
    const hiddenStrike = makeStrike(hidden);
    expect(hiddenStrike.impactTick).toBe(60);
    expect(
      Math.hypot(
        hiddenStrike.centerX1024! - (27 * 1024 + 512),
        hiddenStrike.centerY1024! - (20 * 1024 + 512),
      ),
    ).toBeLessThanOrEqual(2048);
    expect(makeStrike(hidden)).toEqual(hiddenStrike);

    const observed = fixture({ x: 27, y: 20 });
    const observedCell = visibleTargetCell(observed);
    const observedStrike = makeStrike(observed, observedCell);
    expect(observedStrike.impactTick).toBe(40);
    expect(
      Math.hypot(
        observedStrike.centerX1024! - (observedCell.x * 1024 + 512),
        observedStrike.centerY1024! - (observedCell.y * 1024 + 512),
      ),
    ).toBeLessThanOrEqual(512);
  });

  it('resolves nearby units from the same impact snapshot and hides unseen warnings', () => {
    const initial = fixture({ x: 34, y: 20 });
    const strike = {
      factionId: 'C' as const,
      cell: { x: 28, y: 20 },
      centerX1024: 28 * 1024 + 512,
      centerY1024: 20 * 1024 + 512,
      impactTick: 10,
      radius: 1024,
      unitDamage: 200,
      structureDamage: 150,
      sourceUnitId: 'C-GUN',
    };
    const twoTargets = [
      { ...initial.units[1]!, id: 'B-01', cell: { x: 28, y: 20 }, hp: 200 },
      { ...initial.units[1]!, id: 'B-02', cell: { x: 29, y: 20 }, hp: 200 },
    ];
    let state: MatchState = {
      ...initial,
      elapsedTicks: 10,
      units: [initial.units[0]!, ...twoTargets],
      scheduledStrikes: [strike],
    };
    state = { ...state, knowledge: updateFactionKnowledge(state) };
    const viewA = getFactionView(state, 'A');
    expect(viewA.ownFaction.incomingArtilleryWarnings).toEqual([]);
    const impacted = resolveCombat(state);
    expect(
      impacted.units.filter(({ factionId }) => factionId === 'B'),
    ).toHaveLength(0);
    expect(impacted.factions.find(({ id }) => id === 'B')!.ticketsCenti).toBe(
      state.factions.find(({ id }) => id === 'B')!.ticketsCenti -
        2 * state.rules.units.assault.lossTicketsCenti,
    );
  });

  it('keeps hidden enemy health, position, and pending impact out of the view', () => {
    const initial = fixture({ x: 34, y: 20 });
    const hiddenStrike = {
      factionId: 'C' as const,
      cell: { x: 33, y: 20 },
      impactTick: 20,
      sourceUnitId: 'C-GUN',
    };
    const changedHiddenState: MatchState = {
      ...initial,
      units: initial.units.map((unit) =>
        unit.id === 'B-01' ? { ...unit, cell: { x: 35, y: 20 }, hp: 1 } : unit,
      ),
      scheduledStrikes: [hiddenStrike],
    };
    const refreshed = {
      ...changedHiddenState,
      knowledge: updateFactionKnowledge(changedHiddenState),
    };
    expect(getFactionView(refreshed, 'A')).toEqual(
      getFactionView(initial, 'A'),
    );
  });

  it('preserves a pending order until fire, then waits before normal attacks resume', () => {
    const initial = fixture({ x: 27, y: 20 });
    const target = visibleTargetCell(initial);
    let relocated: MatchState = {
      ...initial,
      units: [initial.units[0]!, { ...initial.units[1]!, cell: target }],
    };
    relocated = { ...relocated, knowledge: updateFactionKnowledge(relocated) };
    let state = issuePointFire(relocated, target);
    for (let tick = 0; tick < 10; tick++) state = stepMatch(state);
    const fired = state.scheduledStrikes.find(
      ({ sourceUnitId }) => sourceUnitId === 'A-GUN',
    );
    expect(fired?.impactTick).toBe(40);
    expect(state.units.find(({ id }) => id === 'A-GUN')!.attack).toMatchObject({
      phase: 'cooldown',
      phaseEndsTick: 90,
    });
    while (state.elapsedTicks < 40) state = stepMatch(state);
    expect(state.units.find(({ id }) => id === 'B-01')!.hp).toBeLessThan(200);

    const gun = state.units.find(({ id }) => id === 'A-GUN')!;
    const normalAttack = resolveCombat({
      ...state,
      elapsedTicks: 11,
      units: [
        gun,
        { ...state.units.find(({ id }) => id === 'B-01')!, cell: target },
      ],
    });
    expect(normalAttack.units.find(({ id }) => id === 'A-GUN')!.attack).toEqual(
      {
        targetId: null,
        phase: 'cooldown',
        phaseEndsTick: 90,
      },
    );
    expect(normalAttack.units.find(({ id }) => id === 'B-01')!.hp).toBe(
      state.units.find(({ id }) => id === 'B-01')!.hp,
    );
  });

  it('keeps a fired shell after its shooter dies and aggregates simultaneous losses once', () => {
    const initial = fixture({ x: 34, y: 20 });
    const target = { ...initial.units[1]!, cell: { x: 28, y: 20 }, hp: 200 };
    const strike = (factionId: 'A' | 'C', sourceUnitId: string) => ({
      factionId,
      cell: { x: 28, y: 20 },
      centerX1024: 28 * 1024 + 512,
      centerY1024: 20 * 1024 + 512,
      impactTick: 10,
      radius: 0,
      unitDamage: 100,
      structureDamage: 150,
      sourceUnitId,
    });
    const shooterDied = {
      ...initial,
      elapsedTicks: 5,
      units: [initial.units[1]!],
      scheduledStrikes: [strike('A', 'A-GUN'), strike('C', 'C-GUN')],
    };
    const impact = resolveCombat({
      ...shooterDied,
      elapsedTicks: 10,
      units: [target],
    });
    expect(impact.units).toHaveLength(0);
    expect(impact.factions.find(({ id }) => id === 'B')!.ticketsCenti).toBe(
      initial.factions.find(({ id }) => id === 'B')!.ticketsCenti -
        initial.rules.units.assault.lossTicketsCenti,
    );
    expect(impact.scheduledStrikes).toHaveLength(2);
  });
});
