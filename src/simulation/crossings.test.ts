import { describe, expect, it } from 'vitest';
import {
  beginCrossingBuild,
  beginCrossingDismantle,
  advanceCrossings,
  activeCrossings,
  crossingResearchComplete,
} from './crossings';
import { createMatch } from './match';
import { findPath } from './pathfinding';

describe('crossing construction', () => {
  it.each(['bankA', 'bankB'] as const)(
    'accepts bridge construction from the %s endpoint with identical rules',
    (endpoint) => {
      const initial = createMatch(42, { scenarioId: 'f04-crossing' });
      const site = initial.map.crossingSites!.find(
        ({ id }) => id === 'CROSS-RING-N',
      )!;
      const unitCell = site[endpoint];
      const state = {
        ...initial,
        units: initial.units.map((unit) =>
          unit.id === 'A-01' ? { ...unit, cell: unitCell } : unit,
        ),
      };
      const before = state.factions.find(({ id }) => id === 'A')!.supplyCenti;

      const result = beginCrossingBuild(state, 'A', site.id, 'A-01');

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(
        result.state.crossings.find(({ siteId }) => siteId === site.id),
      ).toMatchObject({
        owner: null,
        job: { kind: 'build', progressTicks: 0 },
      });
      expect(
        result.state.factions.find(({ id }) => id === 'A')!.supplyCenti,
      ).toBe(before - result.state.rules.crossings[site.tier].costCenti);
    },
  );

  it('accepts any completed custom node granting the same crossing tier', () => {
    const state = createMatch(42);
    const rules = {
      ...state.rules,
      research: {
        ...state.rules.research,
        definitions: {
          ...state.rules.research.definitions,
          'custom-bridge': {
            domain: 'engineering' as const,
            stage: 1,
            costCenti: 100,
            prerequisites: [],
            exclusiveWith: [],
            effects: [
              {
                id: 'crossing-unlock' as const,
                value: 0,
                crossingTier: 'bridge-2' as const,
              },
            ],
          },
        },
      },
    };
    expect(
      crossingResearchComplete(
        { completedResearchIds: ['custom-bridge'] },
        rules,
        'bridge-2',
      ),
    ).toBe(true);
    expect(
      crossingResearchComplete({ completedResearchIds: [] }, rules, 'bridge-2'),
    ).toBe(false);
  });
  it('charges once, pauses when the assault leaves, then completes and opens a route', () => {
    let state = createMatch(42, { scenarioId: 'f04-crossing' });
    const faction = state.factions.find(({ id }) => id === 'A')!;
    const site = state.map.crossingSites!.find(
      ({ id }) => id === 'CROSS-RING-N',
    )!;
    const before = faction.supplyCenti;

    const started = beginCrossingBuild(state, 'A', site.id, 'A-01');
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    state = started.state;
    expect(state.factions.find(({ id }) => id === 'A')!.supplyCenti).toBe(
      before - state.rules.crossings[site.tier].costCenti,
    );
    const repeated = beginCrossingBuild(state, 'A', site.id, 'A-01');
    expect(repeated.ok).toBe(true);
    expect(
      repeated.state.factions.find(({ id }) => id === 'A')!.supplyCenti,
    ).toBe(before - state.rules.crossings[site.tier].costCenti);

    state = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: { x: 17, y: 10 } } : unit,
      ),
    };
    state = advanceCrossings(state);
    expect(
      state.crossings.find(({ siteId }) => siteId === site.id)!.job,
    ).toMatchObject({
      progressTicks: 0,
    });

    state = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: { x: 19, y: 10 } } : unit,
      ),
    };
    for (
      let tick = 0;
      tick < state.rules.crossings[site.tier].buildTicks;
      tick += 1
    )
      state = advanceCrossings(state);
    expect(
      state.crossings.find(({ siteId }) => siteId === site.id),
    ).toMatchObject({
      owner: 'A',
      hp: state.rules.crossings[site.tier].maxHp,
      job: null,
    });
    expect(activeCrossings(state).some(({ id }) => id === site.id)).toBe(true);

    expect(
      findPath(state.map, site.bankA, site.bankB, {
        factionId: 'A',
        crossings: activeCrossings(state),
        unitKind: 'assault',
      }),
    ).not.toBeNull();
    const dismantling = beginCrossingDismantle(state, 'A', site.id, 'A-01');
    expect(dismantling.ok).toBe(true);
    if (!dismantling.ok) return;
    state = dismantling.state;
    for (
      let tick = 0;
      tick < state.rules.crossings[site.tier].dismantleTicks;
      tick += 1
    )
      state = advanceCrossings(state);
    expect(
      state.crossings.find(({ siteId }) => siteId === site.id),
    ).toMatchObject({
      owner: null,
      hp: 0,
      job: null,
    });
  });

  it('rejects a scout builder without changing match state', () => {
    const initial = createMatch(42, { scenarioId: 'f04-crossing' });
    const state = {
      ...initial,
      units: initial.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, kind: 'scout' as const } : unit,
      ),
    };
    const result = beginCrossingBuild(state, 'A', 'CROSS-RING-N', 'A-01');
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });
});
