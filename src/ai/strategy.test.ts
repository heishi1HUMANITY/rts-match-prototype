import { describe, expect, it } from 'vitest';
import {
  decideBotCommands,
  knownAirDefenseDetour,
  planBotDecision,
  selectNpcResearchRoute,
} from './strategy';
import { createMatch } from '../simulation/match';
import { getFactionView } from '../simulation/view';
import { applyCommand } from '../simulation/commands';
import { findPath } from '../simulation/pathfinding';
import { updateFactionKnowledge } from '../simulation/visibility';
import { vi } from 'vitest';
import * as combatEstimate from '../simulation/combat-estimate';
import type {
  FactionView,
  MatchState,
  NpcPolicyMemory,
} from '../simulation/types';

function running(state: MatchState): MatchState {
  return {
    ...state,
    phase: 'running',
    rules: {
      ...state.rules,
      npc: { ...state.rules.npc, maxCommandsPerDecision: 8 },
    },
  };
}

function replaceOwnFaction(
  view: FactionView,
  update: Partial<FactionView['ownFaction']>,
): FactionView {
  return { ...view, ownFaction: { ...view.ownFaction, ...update } };
}

describe('faction-view NPC policy', () => {
  it('uses the same frontline site for NPC production after logistics specialization', () => {
    const initial = running(createMatch(109));
    const state = {
      ...initial,
      bases: initial.bases.map((base) =>
        base.id === 'OUT-03'
          ? { ...base, owner: 'B' as const, hp: base.maxHp }
          : base,
      ),
      factions: initial.factions.map((faction) =>
        faction.id === 'B'
          ? {
              ...faction,
              supplyCenti: 120_000,
              completedResearchIds: ['specialization-logistics'],
            }
          : faction,
      ),
    };
    const view = getFactionView(state, 'B');
    const command = decideBotCommands(view).find(
      (entry) => entry.type === 'enqueue-production',
    );
    expect(command?.type).toBe('enqueue-production');
    if (command?.type !== 'enqueue-production') return;
    const productionBase = view.bases.find(
      (base) => base.id === command.baseId,
    );
    expect(productionBase?.visibility).toBe('owned');
    expect(productionBase?.kind).not.toBe('hq');
  });

  it('uses point fire only against observed ground targets beyond gun range', () => {
    const initial = running(createMatch(108, { scenarioId: 'g2-combat' }));
    const artillery = {
      ...initial.units.find(({ id }) => id === 'B-01')!,
      id: 'B-GUN',
      kind: 'artillery' as const,
      cell: { x: 20, y: 20 },
      path: [],
      edgeProgress: 0,
      attack: { targetId: null, phase: 'idle' as const, phaseEndsTick: 0 },
    };
    const spotter = {
      ...artillery,
      id: 'B-SPOT',
      kind: 'scout' as const,
      cell: { x: 24, y: 20 },
    };
    const enemy = {
      ...initial.units.find(({ id }) => id === 'A-01')!,
      cell: { x: 27, y: 20 },
      path: [],
      edgeProgress: 0,
    };
    const viewWith = (units: MatchState['units']) => {
      const state: MatchState = { ...initial, units };
      return getFactionView(
        { ...state, knowledge: updateFactionKnowledge(state) },
        'B',
      );
    };
    const view = viewWith([artillery, spotter, enemy]);
    expect(view.ownFaction.completedResearchIds).not.toContain(
      'specialization-power',
    );
    expect(decideBotCommands(view)).toContainEqual({
      type: 'point-fire',
      unitId: 'B-GUN',
      cell: { x: 27, y: 20 },
    });
    expect(
      decideBotCommands({ ...view, visibleEnemies: [] }).some(
        (command) => command.type === 'point-fire',
      ),
    ).toBe(false);
    const close = viewWith([
      artillery,
      spotter,
      { ...enemy, cell: { x: 23, y: 20 } },
    ]);
    expect(
      decideBotCommands(close).some((command) => command.type === 'point-fire'),
    ).toBe(false);
  });

  it('routes helicopters around remembered AA while unseen AA has no influence', () => {
    const base = running(createMatch(103, { mapId: 'ring-three-fronts-100' }));
    const template = base.units[0]!;
    const helicopter = {
      ...template,
      id: 'B-HELI',
      factionId: 'B' as const,
      kind: 'helicopter' as const,
      cell: { x: 50, y: 50 },
      path: [],
      edgeProgress: 0,
      moveTarget: null,
      waypoints: [],
      moveTicksPerCell: base.rules.units.helicopter.moveTicksPerCell,
    };
    const state = { ...base, units: [helicopter] };
    const view = getFactionView(state, 'B');
    const noKnownAA = { ...view, airDefenseMemory: [] };
    expect(decideBotCommands(noKnownAA)).toEqual(decideBotCommands(view));
    const ownHelicopter = view.ownUnits[0]!;
    const goal = { x: 80, y: 80 };
    const route = findPath(view.map, helicopter.cell, goal, { domain: 'air' })!;
    const middle = route[Math.floor(route.length / 2)]!;
    expect(knownAirDefenseDetour(view, ownHelicopter, goal)).toBeUndefined();
    const knownThreat = {
      ...view,
      airDefenseMemory: [
        {
          unitId: 'AA-B',
          cell: middle,
          range: 3,
          seenTick: view.tick,
        },
      ],
    };
    const detour = knownAirDefenseDetour(knownThreat, ownHelicopter, goal);
    expect(detour).toBeDefined();
    const detouredRoute = findPath(view.map, ownHelicopter.cell, detour!, {
      domain: 'air',
    })!;
    const lastLeg = findPath(view.map, detour!, goal, { domain: 'air' })!;
    expect(
      [...detouredRoute, ...lastLeg].some(
        ({ x, y }) => (x - middle.x) ** 2 + (y - middle.y) ** 2 <= 25,
      ),
    ).toBe(false);
  });

  it('selects one of two legal, military-capable research routes from public start terrain', () => {
    const state = running(createMatch(7, { mapId: 'ring-three-fronts-100' }));
    const baseView = getFactionView(state, 'B');
    for (const start of ['north', 'south-east', 'south-west'] as const) {
      const view = {
        ...baseView,
        map: {
          ...baseView.map,
          startAssignment: {
            ...baseView.map.startAssignment!,
            B: start,
          },
        },
      };
      const candidates = view.rules.npc.researchRoutes[start];
      expect(Object.keys(candidates)).toHaveLength(2);
      expect(candidates.crossing).not.toEqual(candidates.field);
      for (const route of Object.values(candidates)) {
        const research = view.rules.research.definitions;
        expect(route).toContain('artillery-1');
        expect(route.indexOf('firepower-1')).toBeLessThan(
          route.indexOf('artillery-1'),
        );
        for (const id of route) expect(research[id]).toBeDefined();
        expect(
          research['artillery-1']!.effects.some(
            (effect) =>
              effect.id === 'unit-unlock' && effect.unitKind === 'artillery',
          ),
        ).toBe(true);
      }
      expect(selectNpcResearchRoute(view)).toBe(selectNpcResearchRoute(view));
    }
    const southEast = {
      ...baseView,
      map: {
        ...baseView.map,
        startAssignment: {
          ...baseView.map.startAssignment!,
          B: 'south-east' as const,
        },
      },
    };
    const origin = southEast.map.startPoints!['south-east'];
    const floodedTerrain = [...southEast.map.terrain!];
    for (let y = origin.y - 10; y <= origin.y + 10; y += 1)
      for (let x = origin.x - 10; x <= origin.x + 10; x += 1)
        if (
          x >= 0 &&
          y >= 0 &&
          x < southEast.map.width &&
          y < southEast.map.height
        )
          floodedTerrain[y * southEast.map.width + x] = 'river';
    expect(selectNpcResearchRoute(southEast)).toBe('field');
    expect(
      selectNpcResearchRoute({
        ...southEast,
        map: { ...southEast.map, terrain: floodedTerrain },
      }),
    ).toBe('crossing');
  });

  it('difficulty presets change the decision budget without changing the shared command pipeline', () => {
    const base = getFactionView(running(createMatch(43)), 'B');
    for (const difficulty of ['weak', 'standard', 'strong'] as const) {
      const view = {
        ...base,
        rules: {
          ...base.rules,
          npc: {
            ...base.rules.npc,
            selectedDifficulty: difficulty,
          },
        },
      };
      const limit =
        difficulty === 'standard'
          ? view.rules.npc.maxCommandsPerDecision
          : view.rules.npc.difficultyProfiles[difficulty]
              .maxCommandsPerDecision;
      const commands = decideBotCommands(view);
      expect(commands.length).toBeLessThanOrEqual(limit);
      expect(commands).toEqual(decideBotCommands(view));
    }
  });

  it('reacts to a public leader only after the configured delay and respects switch grace', () => {
    const base = getFactionView(running(createMatch(43)), 'B');
    const view = {
      ...base,
      tick: 0,
      ticketsCenti: { A: 90_000, B: 80_000, C: 60_000 },
    };
    const first = planBotDecision(view);
    expect(first.memory.reactedLeader).toBeNull();
    const beforeDelay = planBotDecision({ ...view, tick: 59 }, first.memory);
    expect(beforeDelay.memory.reactedLeader).toBeNull();
    const matured = planBotDecision({ ...view, tick: 60 }, beforeDelay.memory);
    expect(matured.memory.reactedLeader).toBe('A');
    const changedLeader = planBotDecision(
      {
        ...view,
        tick: 90,
        ticketsCenti: { A: 50_000, B: 80_000, C: 100_000 },
      },
      matured.memory,
    );
    expect(changedLeader.memory.observedLeader).toBe('C');
    expect(changedLeader.memory.reactedLeader).toBe('A');
  });

  it('switches at the target-grace boundary, not one tick before', () => {
    const base = getFactionView(running(createMatch(434)), 'B');
    const memory: NpcPolicyMemory = {
      observedLeader: 'C',
      observedLeaderSinceTick: 0,
      reactedLeader: 'C',
      targetFaction: 'A',
      targetChangedAtTick: 0,
      researchNoticeKey: null,
      researchPriority: [],
    };
    const view = {
      ...base,
      ticketsCenti: { A: 90_000, B: 80_000, C: 100_000 },
      rules: {
        ...base.rules,
        npc: {
          ...base.rules.npc,
          difficultyProfiles: {
            ...base.rules.npc.difficultyProfiles,
            standard: {
              ...base.rules.npc.difficultyProfiles.standard,
              targetSwitchGraceTicks: 90,
            },
          },
        },
      },
    };
    expect(
      planBotDecision({ ...view, tick: 89 }, memory).memory.targetFaction,
    ).toBe('A');
    expect(
      planBotDecision({ ...view, tick: 90 }, memory).memory.targetFaction,
    ).toBe('C');
  });

  it('uses public specialization notices to alter an eligible next research command', () => {
    const base = getFactionView(running(createMatch(431)), 'B');
    const completedResearchIds = [
      'firepower-1',
      'artillery-1',
      'air-defense-1',
      'bridge-2',
      'survey-1',
      'aircraft-1',
      'supply-lines-1',
      'maintenance-1',
    ];
    const common = {
      ...base,
      ownFaction: { ...base.ownFaction, completedResearchIds },
      ticketsCenti: { A: 90_000, B: 80_000, C: 60_000 },
    };
    const initialMemory = planBotDecision({ ...common, tick: 0 }).memory;
    const plain = planBotDecision({ ...common, tick: 60 }, initialMemory);
    const noticed = planBotDecision(
      {
        ...common,
        tick: 60,
        researchAnnouncements: [
          {
            factionId: 'A',
            researchId: 'specialization-wartime-economy',
            tick: 0,
          },
        ],
      },
      initialMemory,
    );
    const researchId = (commands: typeof plain.commands) =>
      commands.find((command) => command.type === 'start-research');
    expect(researchId(noticed.commands)).not.toEqual(
      researchId(plain.commands),
    );
    expect(researchId(noticed.commands)).toEqual({
      type: 'start-research',
      researchId: 'facility-turret',
    });
  });

  it('keeps policy evaluation independent of which faction is marked human', () => {
    const view = getFactionView(running(createMatch(432)), 'B');
    const swapped = {
      ...view,
      ownFaction: {
        ...view.ownFaction,
        controller:
          view.ownFaction.controller === 'bot'
            ? ('human' as const)
            : ('bot' as const),
      },
    };
    expect(decideBotCommands(swapped)).toEqual(decideBotCommands(view));
  });

  it('expires remembered opportunity targets from their last observed tick', () => {
    const view = getFactionView(running(createMatch(433)), 'B');
    const unknownBase = view.bases.find(
      (base) => base.visibility === 'unknown',
    );
    expect(unknownBase).toBeDefined();
    if (!unknownBase || unknownBase.visibility !== 'unknown') return;
    const rememberedC = {
      visibility: 'remembered' as const,
      id: unknownBase.id,
      kind: unknownBase.kind,
      cell: view.ownUnits[0]!.cell,
      owner: 'C' as const,
      hp: 600,
      seenTick: 0,
      selfReportedLost: false,
      defenderHp: 0,
      defenderMaxHp: 0,
    };
    const memory: NpcPolicyMemory = {
      observedLeader: 'A',
      observedLeaderSinceTick: 0,
      reactedLeader: 'A',
      targetFaction: 'C',
      targetChangedAtTick: 0,
      researchNoticeKey: null,
      researchPriority: [],
    };
    const policyView = (tick: number): FactionView => ({
      ...view,
      tick,
      ticketsCenti: { A: 100_000, B: 80_000, C: 50_000 },
      ownUnits: [{ ...view.ownUnits[0]!, cell: rememberedC.cell }],
      rules: {
        ...view.rules,
        npc: {
          ...view.rules.npc,
          difficultyProfiles: {
            ...view.rules.npc.difficultyProfiles,
            standard: {
              ...view.rules.npc.difficultyProfiles.standard,
              targetMemoryTtlTicks: 300,
              targetSwitchGraceTicks: 0,
              nextBestPercent: 100,
            },
          },
        },
      },
      bases: view.bases.map((base) =>
        base.id === rememberedC.id ? { ...rememberedC, seenTick: 0 } : base,
      ),
    });
    const estimate = vi
      .spyOn(combatEstimate, 'estimateCombat')
      .mockReturnValue({
        status: 'favorable',
        ticks: 10,
        ownLost: 0,
        ownRemaining: 1,
        threatsRemaining: 0,
        threatsIncluded: 1,
        memoryNotes: [],
        reason: null,
        assumptions: [],
      });
    expect(planBotDecision(policyView(300), memory).memory.targetFaction).toBe(
      'C',
    );
    expect(estimate).toHaveBeenCalledTimes(1);
    estimate.mockClear();
    expect(planBotDecision(policyView(301), memory).memory.targetFaction).toBe(
      'A',
    );
    expect(estimate).not.toHaveBeenCalled();
    estimate.mockRestore();
  });

  it('is deterministic and only acts from the supplied faction view', () => {
    const state = running(createMatch(42));
    const view = getFactionView(state, 'B');
    const changedHiddenEnemy = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'A-01'
          ? {
              ...unit,
              kind: 'artillery' as const,
              cell: { x: 1, y: 1 },
              path: [],
              marchOrder: null,
            }
          : unit,
      ),
      factions: state.factions.map((faction) =>
        faction.id === 'A'
          ? {
              ...faction,
              completedResearchIds: [
                ...faction.completedResearchIds,
                'specialization-information-warfare',
              ],
            }
          : faction,
      ),
    };
    const secondView = getFactionView(changedHiddenEnemy, 'B');

    expect(view.visibleEnemies.some(({ id }) => id === 'A-01')).toBe(false);
    expect(secondView).toEqual(view);
    expect(decideBotCommands(view)).toEqual(decideBotCommands(secondView));
    expect(planBotDecision(view)).toEqual(planBotDecision(secondView));
    expect(decideBotCommands(view).length).toBeLessThanOrEqual(8);
  });

  it('selects research without points and uses the shared production budget', () => {
    const view = getFactionView(running(createMatch(43)), 'B');
    const commands = decideBotCommands(view);
    expect(commands).toContainEqual({
      type: 'start-research',
      researchId: 'bridge-2',
    });
    expect(commands).toContainEqual({
      type: 'enqueue-production',
      baseId: 'HQ-B',
      unitKind: 'assault',
    });
    expect(commands.some(({ type }) => type === 'march')).toBe(true);
    expect(commands).toContainEqual({
      type: 'march',
      unitId: 'B-01',
      target: { kind: 'base', id: expect.any(String) },
    });
  });

  it('resumes its own paused crossing job without charging or needing new supply', () => {
    let state = running(createMatch(42, { scenarioId: 'f04-crossing' }));
    const site = state.map.crossingSites!.find(
      ({ id }) => id === 'CROSS-RING-N',
    )!;
    state = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'B-01' ? { ...unit, cell: site.bankA } : unit,
      ),
      crossings: state.crossings.map((crossing) =>
        crossing.siteId === site.id
          ? {
              ...crossing,
              job: {
                kind: 'build',
                factionId: 'B',
                progressTicks: 12,
                requiredTicks: 180,
                paidCostCenti: 6_000,
              },
            }
          : crossing,
      ),
      factions: state.factions.map((faction) =>
        faction.id === 'B' ? { ...faction, supplyCenti: 0 } : faction,
      ),
    };
    let view = getFactionView(state, 'B');
    view = {
      ...view,
      bases: [],
      ownUnits: view.ownUnits.filter(({ id }) => id === 'B-01'),
      visibleEnemies: [],
    };
    expect(decideBotCommands(view)).toContainEqual({
      type: 'build-crossing',
      siteId: site.id,
      unitId: 'B-01',
    });
  });

  it('defends against visible threats beyond the legacy 40-cell bounds on the 100-cell map', () => {
    const view = getFactionView(
      running(createMatch(0, { mapId: 'ring-three-fronts-100' })),
      'B',
    );
    expect(view.map.startAssignment?.B).toBe('south-east');
    // Clamping this cell to the old 40-cell grid lands on river and drops the threat.
    const enemy = {
      control: 'enemy' as const,
      id: 'A-01',
      factionId: 'A' as const,
      kind: 'assault' as const,
      positionX1024: 66 * 1024 + 512,
      positionY1024: 76 * 1024 + 512,
      hp: 100,
      maxHp: 100,
    };
    expect(
      decideBotCommands({ ...view, visibleEnemies: [enemy] }),
    ).toContainEqual({
      type: 'march',
      unitId: 'B-01',
      target: { kind: 'unit', id: 'A-01' },
    });
  });

  it('tracks a visible threat and keeps the same order while it is searching', () => {
    const view = getFactionView(running(createMatch(42)), 'B');
    const enemy = {
      control: 'enemy' as const,
      id: 'A-01',
      factionId: 'A' as const,
      kind: 'assault' as const,
      positionX1024: 24064,
      positionY1024: 34304,
      hp: 100,
      maxHp: 100,
    };
    const threatened = { ...view, visibleEnemies: [enemy] };
    expect(decideBotCommands(threatened)).toContainEqual({
      type: 'march',
      unitId: 'B-01',
      target: { kind: 'unit', id: 'A-01' },
    });
    const pending = {
      ...threatened,
      ownUnits: threatened.ownUnits.map((unit) =>
        unit.id === 'B-01'
          ? {
              ...unit,
              marchOrder: {
                target: { kind: 'unit' as const, id: enemy.id },
                lastKnownCell: { x: 23, y: 33 },
                lastSeenTick: 0,
                status: 'tracking' as const,
              },
            }
          : unit,
      ),
    };
    expect(
      decideBotCommands(pending).some(
        (command) => command.type === 'march' && command.unitId === 'B-01',
      ),
    ).toBe(false);
    const searching = {
      ...pending,
      visibleEnemies: [],
      ownUnits: pending.ownUnits.map((unit) =>
        unit.id === 'B-01' && unit.marchOrder
          ? {
              ...unit,
              marchOrder: { ...unit.marchOrder, status: 'searching' as const },
            }
          : unit,
      ),
    };
    expect(
      decideBotCommands(searching).some(
        (command) => command.type === 'march' && command.unitId === 'B-01',
      ),
    ).toBe(false);
    expect(
      decideBotCommands({
        ...searching,
        visibleEnemies: [{ ...enemy, id: 'A-02' }],
      }),
    ).toContainEqual({
      type: 'march',
      unitId: 'B-01',
      target: { kind: 'unit', id: 'A-02' },
    });
  });

  it('respects supply, queue, unit, elimination, and phase constraints', () => {
    const view = getFactionView(running(createMatch(44)), 'B');
    const noSupply = replaceOwnFaction(view, { supplyCenti: 0 });
    expect(
      decideBotCommands(noSupply).some(
        ({ type }) => type === 'enqueue-production',
      ),
    ).toBe(false);

    const fullQueue = replaceOwnFaction(view, {
      productionJobs: [
        {
          id: 'J1',
          baseId: 'HQ-B',
          unitId: 'B-03',
          unitKind: 'assault',
          costCenti: 1,
          status: 'active',
          remainingTicks: 1,
        },
        {
          id: 'J2',
          baseId: 'HQ-B',
          unitId: 'B-04',
          unitKind: 'assault',
          costCenti: 1,
          status: 'queued',
          remainingTicks: 1,
        },
        {
          id: 'J3',
          baseId: 'HQ-B',
          unitId: 'B-05',
          unitKind: 'assault',
          costCenti: 1,
          status: 'queued',
          remainingTicks: 1,
        },
      ],
    });
    expect(
      decideBotCommands(fullQueue).some(
        ({ type }) => type === 'enqueue-production',
      ),
    ).toBe(false);

    const unitCapped = {
      ...view,
      ownUnits: Array.from({ length: 6 }, (_, index) => ({
        ...view.ownUnits[0]!,
        id: `B-cap-${index}`,
      })),
    };
    expect(
      decideBotCommands(unitCapped).some(
        ({ type }) => type === 'enqueue-production',
      ),
    ).toBe(false);
    expect(
      decideBotCommands(
        replaceOwnFaction(view, {
          eliminatedAtTick: 0,
          eliminationReason: 'tickets',
        }),
      ),
    ).toEqual([]);
    expect(decideBotCommands({ ...view, phase: 'paused' })).toEqual([]);
  });

  it('applies the NPC command limit to production, research, and movement together', () => {
    const view = getFactionView(running(createMatch(45)), 'B');
    const limited = {
      ...view,
      rules: {
        ...view.rules,
        npc: { ...view.rules.npc, maxCommandsPerDecision: 1 },
      },
    };

    expect(decideBotCommands(limited)).toHaveLength(1);
  });

  it.each([1, 2])(
    'gives every unit a turn with a %i-command budget despite continuous economy candidates',
    (maxCommandsPerDecision) => {
      const initial = getFactionView(running(createMatch(45)), 'B');
      const ownUnits = Array.from({ length: 4 }, (_, index) => ({
        ...initial.ownUnits[0]!,
        id: `B-${index}`,
      }));
      const limited = {
        ...initial,
        ownUnits,
        rules: {
          ...initial.rules,
          limits: {
            ...initial.rules.limits,
            baseUnits: 6,
          },
          npc: {
            ...initial.rules.npc,
            decisionIntervalTicks: 30,
            maxCommandsPerDecision,
          },
        },
      };
      const moved = new Set<string>();
      const economicTypes = new Set<string>();
      for (let decision = 0; decision < ownUnits.length + 4; decision += 1) {
        const view = { ...limited, tick: decision * 30 };
        const commands = decideBotCommands(view);
        expect(commands.length).toBeLessThanOrEqual(maxCommandsPerDecision);
        expect(commands).toEqual(decideBotCommands(view));
        for (const command of commands) {
          if (command.type === 'march') moved.add(command.unitId);
          else economicTypes.add(command.type);
        }
      }
      expect([...moved].sort()).toEqual(ownUnits.map(({ id }) => id));
      expect(economicTypes).toContain('enqueue-production');
      expect(economicTypes).toContain('start-research');
    },
  );

  it('lets active research finish instead of switching to a different topic', () => {
    const initial = getFactionView(running(createMatch(45)), 'B');
    const charging = replaceOwnFaction(initial, {
      activeResearch: { researchId: 'firepower-1' },
    });
    for (let decision = 0; decision < 8; decision += 1) {
      expect(
        decideBotCommands({
          ...charging,
          tick: decision * charging.rules.npc.decisionIntervalTicks,
        }).some(({ type }) => type === 'start-research'),
      ).toBe(false);
    }
    const finished = replaceOwnFaction(charging, {
      activeResearch: null,
      completedResearchIds: ['firepower-1'],
    });
    expect(decideBotCommands(finished)).toContainEqual({
      type: 'start-research',
      researchId: 'bridge-2',
    });
  });

  it('applies limited orders through shared validation and keeps every unit marching without reissuing orders', () => {
    const initial = running(createMatch(45));
    let state: MatchState = {
      ...initial,
      rules: {
        ...initial.rules,
        npc: {
          ...initial.rules.npc,
          decisionIntervalTicks: 30,
          maxCommandsPerDecision: 1,
        },
      },
    };
    const ownIds = state.units
      .filter(({ factionId }) => factionId === 'B')
      .map(({ id }) => id);
    const commanded = new Set<string>();
    for (let decision = 0; decision < 16; decision += 1) {
      state = { ...state, elapsedTicks: decision * 30 };
      for (const command of decideBotCommands(getFactionView(state, 'B'))) {
        if (command.type === 'march') {
          expect(commanded.has(command.unitId)).toBe(false);
          commanded.add(command.unitId);
        }
        const result = applyCommand(state, 'B', command);
        expect(result.ok).toBe(true);
        state = result.state;
      }
    }
    expect([...commanded].sort()).toEqual(ownIds.sort());
    expect(
      state.units
        .filter(({ factionId }) => factionId === 'B')
        .every(({ marchOrder }) => marchOrder !== null),
    ).toBe(true);
  });

  it('uses only its owned-base view and emits the shared upgrade command', () => {
    const initial = running(createMatch(42));
    const state = {
      ...initial,
      phase: 'running' as const,
      factions: initial.factions.map((faction) =>
        faction.id === 'B'
          ? {
              ...faction,
              supplyCenti: 100_000,
              completedResearchIds: ['base-development-1'],
            }
          : faction,
      ),
    };
    const view = getFactionView(state, 'B');
    const commands = decideBotCommands(view);
    expect(commands).toContainEqual({ type: 'upgrade-base', baseId: 'HOME-B' });
    expect(
      commands.some(
        (command) =>
          command.type === 'upgrade-base' && command.baseId === 'HOME-A',
      ),
    ).toBe(false);
  });
});

it('chooses arbitrary IDs using registered effects and shared prerequisites', () => {
  const state = running(createMatch(42));
  const view = getFactionView(state, 'B');
  const custom = {
    ...view,
    rules: {
      ...view.rules,
      research: {
        ...view.rules.research,
        definitions: {
          'renamed-power': view.rules.research.definitions['firepower-1']!,
          'renamed-survey': view.rules.research.definitions['survey-1']!,
        },
      },
    },
  };
  expect(decideBotCommands(custom)).toContainEqual({
    type: 'start-research',
    researchId: 'renamed-power',
  });
  expect(
    decideBotCommands(
      replaceOwnFaction(custom, { completedResearchIds: ['renamed-power'] }),
    ),
  ).toContainEqual({ type: 'start-research', researchId: 'renamed-survey' });
});
