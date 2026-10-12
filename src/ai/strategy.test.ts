import { describe, expect, it } from 'vitest';
import { decideBotCommands } from './strategy';
import { createMatch } from '../simulation/match';
import { getFactionView } from '../simulation/view';
import { applyCommand } from '../simulation/commands';
import type { FactionView, MatchState } from '../simulation/types';

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

describe('stateless faction-view NPC policy', () => {
  it('is deterministic and only acts from the supplied faction view', () => {
    const state = running(createMatch(42));
    const view = getFactionView(state, 'B');
    const changedHiddenEnemy = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: { x: 1, y: 1 } } : unit,
      ),
    };
    const secondView = getFactionView(changedHiddenEnemy, 'B');

    expect(view.visibleEnemies.some(({ id }) => id === 'A-01')).toBe(false);
    expect(secondView).toEqual(view);
    expect(decideBotCommands(view)).toEqual(decideBotCommands(secondView));
    expect(decideBotCommands(view).length).toBeLessThanOrEqual(8);
  });

  it('selects research without points and uses the shared production budget', () => {
    const view = getFactionView(running(createMatch(43)), 'B');
    const commands = decideBotCommands(view);
    expect(commands).toContainEqual({
      type: 'start-research',
      researchId: 'firepower-1',
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

  it('tracks a visible threat and keeps the same order while it is searching', () => {
    const view = getFactionView(running(createMatch(42)), 'B');
    const enemy = {
      control: 'enemy' as const,
      id: 'A-01',
      factionId: 'A' as const,
      kind: 'assault' as const,
      positionX1024: 29184,
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
                lastKnownCell: { x: 28, y: 33 },
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
          npc: {
            ...initial.rules.npc,
            decisionIntervalTicks: 30,
            maxCommandsPerDecision,
          },
        },
      };
      const moved = new Set<string>();
      const economicTypes = new Set<string>();
      for (let decision = 0; decision < ownUnits.length + 3; decision += 1) {
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
      researchId: 'survey-1',
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
