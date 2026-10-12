import { describe, expect, it } from 'vitest';
import { decideBotCommands } from './strategy';
import { createMatch } from '../simulation/match';
import { getFactionView } from '../simulation/view';
import type { FactionView, MatchState } from '../simulation/types';

function running(state: MatchState): MatchState {
  return { ...state, phase: 'running' };
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

  it('uses only its owned-base view and emits the shared upgrade command', () => {
    const initial = createMatch(42);
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
