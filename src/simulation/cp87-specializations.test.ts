import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { resolveCombat } from './combat';
import { applyEconomyTick } from './economy';
import { createMatch } from './match';
import { findPath } from './pathfinding';
import { advanceProduction, enqueueProduction } from './production';
import { DEFAULT_RULES } from './rules';
import { stepMatch, stepUnit } from './step';
import { getFactionView } from './view';
import {
  isGlobalObservationActive,
  isMineDetectedToFaction,
  updateFactionKnowledge,
} from './visibility';
import type { FactionState, MatchState, UnitState } from './types';

function runningMatch(): MatchState {
  const result = applyCommand(
    createMatch(42, { mapId: 'ring-three-fronts-100' }),
    'A',
    {
      type: 'start',
    },
  );
  if (!result.ok) throw new Error('start should succeed');
  return result.state;
}

function setFaction(
  state: MatchState,
  factionId: FactionState['id'],
  changes: Partial<FactionState>,
): MatchState {
  return {
    ...state,
    factions: state.factions.map((faction) =>
      faction.id === factionId ? { ...faction, ...changes } : faction,
    ),
  };
}

function withUnits(state: MatchState, units: readonly UnitState[]): MatchState {
  return { ...state, units };
}

describe('CP13 non-fire specializations', () => {
  it('limits global observation to a periodic view snapshot and excludes mines and orders', () => {
    let state = runningMatch();
    const a = state.units.find(({ id }) => id === 'A-01')!;
    const enemy = state.units.find(({ id }) => id === 'B-01')!;
    const hiddenCell = { x: 50, y: 50 };
    state = withUnits(state, [
      a,
      {
        ...enemy,
        cell: hiddenCell,
        path: [{ x: 51, y: 50 }],
        moveTarget: { x: 55, y: 50 },
      },
    ]);
    state = {
      ...state,
      elapsedTicks: 1,
      bases: state.bases.map((base) =>
        base.id === 'OUT-01' ? { ...base, owner: 'B', hp: base.maxHp } : base,
      ),
      facilities: [
        {
          id: 'B-T1',
          kind: 'turret',
          owner: 'B',
          anchor: { kind: 'base', id: 'OUT-01' },
          slot: 0,
          cell: { x: 52, y: 50 },
          hp: 100,
          maxHp: 100,
          remainingBuildTicks: 0,
          lastDamagedTick: -1,
          lastActivatedTick: -1,
        },
        {
          id: 'B-M1',
          kind: 'mine',
          owner: 'B',
          anchor: { kind: 'base', id: 'OUT-01' },
          slot: 1,
          cell: { x: 53, y: 50 },
          hp: 1,
          maxHp: 1,
          remainingBuildTicks: 0,
          lastDamagedTick: -1,
          lastActivatedTick: -1,
        },
      ],
    };
    state = setFaction(state, 'A', {
      completedResearchIds: ['specialization-information'],
    });
    state = { ...state, knowledge: updateFactionKnowledge(state) };
    const ordinaryMask = state.knowledge.find(
      ({ factionId }) => factionId === 'A',
    )!.visible;
    const view = getFactionView(state, 'A');
    expect(isGlobalObservationActive(state, 'A')).toBe(true);
    expect(view.visible).toEqual(ordinaryMask);
    expect(view.visibleEnemies.map(({ id }) => id)).toContain('B-01');
    expect(Object.keys(view.visibleEnemies[0]!).sort()).toEqual([
      'control',
      'factionId',
      'hp',
      'id',
      'kind',
      'maxHp',
      'positionX1024',
      'positionY1024',
    ]);
    expect(view.bases.find(({ id }) => id === 'OUT-01')?.visibility).toBe(
      'visible',
    );
    expect(view.facilities.some(({ id }) => id === 'B-T1')).toBe(true);
    expect(view.facilities.some(({ id }) => id === 'B-M1')).toBe(false);

    const expired = { ...state, elapsedTicks: 100 };
    expect(isGlobalObservationActive(expired, 'A')).toBe(false);
    const expiredView = getFactionView(expired, 'A');
    expect(expiredView.visibleEnemies.map(({ id }) => id)).not.toContain(
      'B-01',
    );
    expect(expiredView.facilities.some(({ id }) => id === 'B-T1')).toBe(false);
  });

  it('opens the pulse at its period boundary and stops without its research source', () => {
    const state = setFaction(runningMatch(), 'A', {
      completedResearchIds: ['specialization-information'],
    });
    for (const [tick, active] of [
      [0, true],
      [99, true],
      [100, false],
      [299, false],
      [300, true],
    ] as const)
      expect(
        isGlobalObservationActive({ ...state, elapsedTicks: tick }, 'A'),
      ).toBe(active);
    expect(
      isGlobalObservationActive(
        setFaction(state, 'A', { completedResearchIds: [] }),
        'A',
      ),
    ).toBe(false);
  });

  it('keeps the faction queue global and refunds only jobs whose production site was lost', () => {
    let state = runningMatch();
    const outpost = state.bases.find(({ id }) => id === 'OUT-03')!;
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === outpost.id ? { ...base, owner: 'A', hp: base.maxHp } : base,
      ),
    };
    state = setFaction(state, 'A', {
      completedResearchIds: ['specialization-logistics'],
    });
    const hqJob = enqueueProduction(state, 'A', 'HQ-A', 'scout');
    expect(hqJob.ok).toBe(true);
    if (!hqJob.ok) return;
    const frontlineJob = enqueueProduction(
      hqJob.state,
      'A',
      outpost.id,
      'assault',
    );
    expect(frontlineJob.ok).toBe(true);
    if (!frontlineJob.ok) return;
    const beforeLoss = frontlineJob.state.factions.find(
      ({ id }) => id === 'A',
    )!;
    const lost = {
      ...frontlineJob.state,
      bases: frontlineJob.state.bases.map((base) =>
        base.id === outpost.id ? { ...base, owner: 'B' as const } : base,
      ),
    };
    const afterLoss = advanceProduction(lost);
    const afterFaction = afterLoss.factions.find(({ id }) => id === 'A')!;
    expect(afterFaction.productionJobs.map(({ baseId }) => baseId)).toEqual([
      'HQ-A',
    ]);
    expect(afterFaction.productionJobs[0]?.status).toBe('active');
    expect(afterFaction.supplyCenti).toBe(
      beforeLoss.supplyCenti + DEFAULT_RULES.units.assault.costCenti,
    );
    expect(
      advanceProduction(afterLoss).factions.find(({ id }) => id === 'A')
        ?.supplyCenti,
    ).toBe(afterFaction.supplyCenti);
  });

  it('shortens the standard flat-map approach from 144 ticks to 52 ticks with a frontline site', () => {
    const state = createMatch(42, { scenarioId: 'f87-specializations' });
    const hqA = state.bases.find(({ id }) => id === 'HQ-A')!;
    const hqB = state.bases.find(({ id }) => id === 'HQ-B')!;
    const forward = state.bases.find(({ id }) => id === 'OUT-03')!;
    const hqRoute = findPath(state.map, hqA.cell, hqB.cell, {
      factionId: 'A',
      domain: 'land',
    });
    const frontlineRoute = findPath(state.map, forward.cell, hqB.cell, {
      factionId: 'A',
      domain: 'land',
    });
    expect(hqRoute).not.toBeNull();
    expect(frontlineRoute).not.toBeNull();
    expect(hqRoute!.length * DEFAULT_RULES.units.assault.moveTicksPerCell).toBe(
      144,
    );
    expect(
      frontlineRoute!.length * DEFAULT_RULES.units.assault.moveTicksPerCell,
    ).toBe(52);
  });

  it('shortens wartime production multiplicatively with surge using integer tick progress', () => {
    const state = runningMatch();
    const baseline = enqueueProduction(state, 'A', 'HQ-A', 'scout');
    const wartime = enqueueProduction(
      setFaction(state, 'A', {
        completedResearchIds: ['specialization-wartime-economy'],
      }),
      'A',
      'HQ-A',
      'scout',
    );
    expect(baseline.ok && wartime.ok).toBe(true);
    if (!baseline.ok || !wartime.ok) return;
    let ordinary = baseline.state;
    let fast = wartime.state;
    for (let index = 0; index < 4; index += 1) {
      ordinary = advanceProduction(ordinary);
      fast = advanceProduction(fast);
    }
    expect(
      fast.factions.find(({ id }) => id === 'A')!.productionJobs[0]!
        .remainingTicks,
    ).toBe(
      ordinary.factions.find(({ id }) => id === 'A')!.productionJobs[0]!
        .remainingTicks - 1,
    );
    const surged = setFaction(fast, 'A', {
      productionBoostUntilTick: fast.elapsedTicks + 20,
    });
    const before = surged.factions.find(({ id }) => id === 'A')!
      .productionJobs[0]!.remainingTicks;
    const after = advanceProduction(surged).factions.find(
      ({ id }) => id === 'A',
    )!.productionJobs[0]!.remainingTicks;
    expect(before - after).toBeGreaterThanOrEqual(2);
  });

  it('adds 30 percent of the flat supply income while wartime economy is active', () => {
    const state = runningMatch();
    const normal = applyEconomyTick(state).factions.find(
      ({ id }) => id === 'A',
    )!.supplyCenti;
    const wartime = applyEconomyTick(
      setFaction(state, 'A', {
        completedResearchIds: ['specialization-wartime-economy'],
      }),
    ).factions.find(({ id }) => id === 'A')!.supplyCenti;
    expect(wartime - normal).toBe(
      Math.floor((state.rules.economy.flatSupplyIncomeCentiPerTick * 30) / 100),
    );
    expect(
      DEFAULT_RULES.research.definitions['specialization-wartime-economy']!
        .effects,
    ).toContainEqual({ id: 'production-time-percent', value: 20 });
  });

  it('heals a quiet, stopped unit near a captured frontline base at the configured rate', () => {
    let state = runningMatch();
    const hq = state.bases.find(({ id }) => id === 'HQ-A')!;
    const outpost = [...state.bases]
      .filter(({ kind }) => kind !== 'hq')
      .sort((a, b) => {
        const da =
          Math.abs(a.cell.x - hq.cell.x) + Math.abs(a.cell.y - hq.cell.y);
        const db =
          Math.abs(b.cell.x - hq.cell.x) + Math.abs(b.cell.y - hq.cell.y);
        return db - da;
      })[0]!;
    state = {
      ...state,
      elapsedTicks: 49,
      units: [
        {
          ...state.units.find(({ id }) => id === 'A-01')!,
          cell: { ...outpost.cell },
          path: [],
          hp: 100,
          maxHp: 200,
          lastDamagedTick: 0,
          lastAttackTick: 0,
          attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
        },
      ],
      bases: state.bases.map((base) =>
        base.id === outpost.id ? { ...base, owner: 'A', hp: base.maxHp } : base,
      ),
    };
    state = setFaction(state, 'A', {
      completedResearchIds: ['specialization-logistics'],
    });
    const healed = stepMatch(state).units[0]!;
    expect(healed.hp).toBe(104);
    expect(
      stepMatch({
        ...state,
        units: state.units.map((unit) => ({ ...unit, lastAttackTick: 49 })),
      }).units[0]!.hp,
    ).toBe(100);
    expect(
      stepMatch({
        ...state,
        units: state.units.map((unit) => ({ ...unit, lastDamagedTick: 49 })),
      }).units[0]!.hp,
    ).toBe(100);
  });

  it('uses separate normal and blockade detection radii and applies timed movement slowdown', () => {
    const state = runningMatch();
    const mine = {
      id: 'B-M1',
      kind: 'mine' as const,
      owner: 'B' as const,
      anchor: { kind: 'base' as const, id: 'OUT-01' },
      slot: 0,
      cell: { x: 30, y: 30 },
      hp: 1,
      maxHp: 1,
      remainingBuildTicks: 0,
      lastDamagedTick: -1,
      lastActivatedTick: -1,
    };
    const ordinaryScout = {
      ...state.units[0]!,
      kind: 'scout' as const,
      cell: { x: 26, y: 30 },
    };
    const ordinary = { ...state, units: [ordinaryScout], facilities: [mine] };
    expect(isMineDetectedToFaction(ordinary, mine, 'A')).toBe(true);
    const ordinaryAssault = {
      ...ordinaryScout,
      kind: 'assault' as const,
      cell: { x: 28, y: 30 },
    };
    const concealed = setFaction(
      { ...ordinary, units: [ordinaryAssault] },
      'B',
      { completedResearchIds: ['specialization-engineering'] },
    );
    expect(isMineDetectedToFaction(concealed, mine, 'A')).toBe(false);
    const inRange = { ...ordinaryAssault, cell: { x: 29, y: 30 } };
    expect(
      isMineDetectedToFaction({ ...concealed, units: [inRange] }, mine, 'A'),
    ).toBe(true);
    const moving = {
      ...ordinaryAssault,
      cell: { x: 20, y: 20 },
      path: [{ x: 21, y: 20 }],
      edgeProgress: 0,
      moveTicksPerCell: 2,
      slowedUntilTick: 10,
      slowedMovePercent: 50,
    };
    expect(stepUnit(moving, { ...state, elapsedTicks: 1 }).edgeProgress).toBe(
      1,
    );
    expect(stepUnit(moving, { ...state, elapsedTicks: 1 }).cell).toEqual({
      x: 20,
      y: 20,
    });

    const mines = [0, 1].map((slot) => ({ ...mine, id: `B-M${slot}`, slot }));
    const attacker = {
      ...ordinaryAssault,
      id: 'A-01',
      cell: { x: 30, y: 30 },
      hp: 500,
      maxHp: 500,
      path: [{ x: 31, y: 30 }],
      edgeProgress: 0,
      moveTicksPerCell: 2,
    };
    const mineStrike = resolveCombat({
      ...state,
      elapsedTicks: 1,
      units: [attacker],
      facilities: mines,
      factions: state.factions.map((faction) =>
        faction.id === 'B'
          ? { ...faction, completedResearchIds: ['specialization-engineering'] }
          : faction,
      ),
    });
    const slowed = mineStrike.units[0]!;
    expect(slowed.hp).toBe(260);
    expect(slowed.slowedUntilTick).toBe(41);
    expect(slowed.slowedMovePercent).toBe(50);
    const slowedFirstStep = stepUnit(slowed, {
      ...mineStrike,
      elapsedTicks: 2,
    });
    expect(slowedFirstStep.edgeProgress).toBe(1);
    let traversed = slowedFirstStep;
    for (const tick of [3, 4, 5])
      traversed = stepUnit(traversed, { ...mineStrike, elapsedTicks: tick });
    expect(traversed.cell).toEqual({ x: 31, y: 30 });
  });

  it('charges the victim once and weights the information-war loss bonus by lethal-tick damage', () => {
    const base = runningMatch();
    const a = base.units.find(({ id }) => id === 'A-01')!;
    const b = base.units.find(({ id }) => id === 'B-01')!;
    const rules = {
      ...base.rules,
      units: {
        ...base.rules.units,
        assault: { ...base.rules.units.assault, damageVsLand: 10 },
      },
    };
    let state: MatchState = {
      ...base,
      rules,
      units: [
        { ...a, kind: 'assault', cell: { x: 49, y: 50 }, hp: 500, maxHp: 500 },
        { ...b, kind: 'assault', cell: { x: 50, y: 50 }, hp: 15, maxHp: 500 },
        {
          ...base.units.find(({ id }) => id === 'C-01')!,
          kind: 'assault',
          cell: { x: 51, y: 50 },
          hp: 500,
          maxHp: 500,
        },
      ],
      elapsedTicks: 1,
    };
    state = setFaction(state, 'A', {
      completedResearchIds: ['specialization-information-warfare'],
    });
    const beforeTickets = state.factions.find(
      ({ id }) => id === 'B',
    )!.ticketsCenti;
    const baseLoss = rules.units.assault.lossTicketsCenti;
    const after = resolveCombat(state);
    expect(after.units.some(({ id }) => id === 'B-01')).toBe(false);
    expect(after.factions.find(({ id }) => id === 'B')!.ticketsCenti).toBe(
      beforeTickets - baseLoss - Math.floor((baseLoss * 50 * 10) / (100 * 50)),
    );
  });
});
