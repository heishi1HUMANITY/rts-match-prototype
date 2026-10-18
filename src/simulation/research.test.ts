import { describe, it, expect } from 'vitest';
import { createMatch } from './match';
import { cloneRules, DEFAULT_RULES, type RulesMaster } from './rules';
import type { MatchState } from './types';
import {
  advanceResearch,
  researchCostForFaction,
  startResearch,
} from './research';
import { applyEconomyTick } from './economy';
import { getFactionView } from './view';
import { validateRules } from './rules-validation';

describe('arbitrary research IDs', () => {
  it('treats constructor as a normal ID without inherited progress or NaN', () => {
    const defaults = cloneRules(DEFAULT_RULES);
    const rules: RulesMaster = {
      ...defaults,
      research: {
        ...defaults.research,
        definitions: {
          ...defaults.research.definitions,
          constructor: {
            domain: 'power' as const,
            stage: 1,
            costCenti: 100,
            prerequisites: [],
            exclusiveWith: [],
            effects: [{ id: 'damage-bonus' as const, value: 7 }],
          },
        },
      },
    };
    expect(validateRules(rules).ok).toBe(true);
    const initial = createMatch(42, { rules });
    const state = {
      ...initial,
      factions: initial.factions.map((faction) => ({
        ...faction,
        researchCenti: 100,
      })),
    };
    expect(state.factions[0]!.researchProgressCenti['constructor']).toBe(0);
    const result = startResearch(state, 'A', 'constructor');
    expect(result.ok).toBe(true);
    const faction = result.state.factions.find((entry) => entry.id === 'A')!;
    expect(Number.isFinite(faction.researchCenti)).toBe(true);
    expect(faction.completedResearchIds).toContain('constructor');
    expect(faction.researchProgressCenti['constructor']).toBe(100);
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });
});

describe('stage-based research economy', () => {
  it('measures completion against one-match research capacity despite capstone choice growth', () => {
    const completionCapacity = (
      definitions: RulesMaster['research']['definitions'],
    ): number => {
      const capstoneCount = Object.values(definitions).filter(
        ({ stage }) => stage === 4,
      ).length;
      return Object.keys(definitions).length - Math.max(capstoneCount - 1, 0);
    };
    const definitions = DEFAULT_RULES.research.definitions;
    const capstones = Object.entries(definitions)
      .filter(([, definition]) => definition.stage === 4)
      .map(([id]) => id);
    expect(capstones).toHaveLength(6);
    for (const id of capstones)
      for (const peer of capstones)
        if (peer !== id) expect(definitions[id]!.exclusiveWith).toContain(peer);
    expect(completionCapacity(definitions)).toBe(24);

    const addedCandidate = {
      ...definitions,
      'test-capstone': {
        ...definitions['specialization-power']!,
        exclusiveWith: capstones,
      },
    };
    expect(completionCapacity(addedCandidate)).toBe(24);
    const removedCandidate = Object.fromEntries(
      Object.entries(definitions).filter(
        ([id]) => id !== 'specialization-information-warfare',
      ),
    );
    expect(completionCapacity(removedCandidate)).toBe(24);
  });

  it('allows stage 1 choices, uses OR prerequisites, and locks only one global stage 4', () => {
    const initial = createMatch(45);
    let state: MatchState = {
      ...initial,
      factions: initial.factions.map((faction) =>
        faction.id === 'A' ? { ...faction, researchCenti: 200_000 } : faction,
      ),
    };
    for (const researchId of ['firepower-1', 'artillery-1', 'air-defense-1']) {
      const started = startResearch(state, 'A', researchId);
      expect(started.ok).toBe(true);
      if (started.ok) state = started.state;
    }
    expect(state.factions[0]!.completedResearchIds).toEqual([
      'firepower-1',
      'artillery-1',
      'air-defense-1',
    ]);
    expect(startResearch(state, 'A', 'firepower-2').ok).toBe(true);
    state = startResearch(state, 'A', 'firepower-2').state;
    state = startResearch(state, 'A', 'firepower-3').state;
    state = startResearch(state, 'A', 'specialization-power').state;
    expect(state.factions[0]!.completedResearchIds).toContain(
      'specialization-power',
    );
    expect(state.researchAnnouncements).toEqual([
      { factionId: 'A', researchId: 'specialization-power', tick: 0 },
    ]);
    expect(
      getFactionView(state, 'B').researchAnnouncements?.at(-1),
    ).toMatchObject({ factionId: 'A', researchId: 'specialization-power' });
    expect(getFactionView(state, 'B').ownFaction.completedResearchIds).toEqual(
      [],
    );
    expect(getFactionView(state, 'B').ownFaction).not.toHaveProperty(
      'researchRequiredCenti',
    );
    expect(startResearch(state, 'A', 'specialization-logistics')).toMatchObject(
      { ok: false, reason: 'RESEARCH_EXCLUDED' },
    );
  });

  it('does not reserve a cheap cost at zero progress and preserves the first contributed cost across switches', () => {
    let state = createMatch(46);
    let first = startResearch(state, 'A', 'firepower-1');
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = first.state;
    expect(state.factions[0]!.researchRequiredCenti).toBeUndefined();

    state = {
      ...state,
      factions: state.factions.map((faction) =>
        faction.id === 'A'
          ? {
              ...faction,
              completedResearchIds: ['artillery-1', 'air-defense-1'],
              researchCenti: 100,
            }
          : faction,
      ),
    };
    const advanced = advanceResearch(applyEconomyTick(state));
    const faction = advanced.factions[0]!;
    expect(faction.researchRequiredCenti?.['firepower-1']).toBe(10_464);
    const stopped = startResearch(advanced, 'A', null);
    expect(stopped.ok).toBe(true);
    if (!stopped.ok) return;
    const resumed = startResearch(stopped.state, 'A', 'firepower-1');
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(
      researchCostForFaction(
        resumed.state.rules,
        resumed.state.factions[0]!,
        'firepower-1',
      ),
    ).toBe(10_464);
  });

  it('reaches the declared 20-minute completion band on current standard starting income', () => {
    const rules = cloneRules(DEFAULT_RULES);
    let state: MatchState = { ...createMatch(47, { rules }), phase: 'running' };
    const complete = (researchId: string): void => {
      const selected = startResearch(state, 'A', researchId);
      expect(selected.ok).toBe(true);
      if (!selected.ok) throw new Error(`could not select ${researchId}`);
      state = selected.state;
      for (let attempts = 0; attempts < 12_000; attempts += 1) {
        if (state.factions[0]!.completedResearchIds.includes(researchId))
          return;
        state = {
          ...state,
          elapsedTicks: state.elapsedTicks + 1,
        };
        state = advanceResearch(applyEconomyTick(state));
      }
      throw new Error(`research did not complete: ${researchId}`);
    };

    for (const researchId of [
      'firepower-1',
      'firepower-2',
      'firepower-3',
      'specialization-power',
    ])
      complete(researchId);
    const specializationTick = state.elapsedTicks;
    for (const researchId of [
      'artillery-1',
      'air-defense-1',
      'aircraft-1',
      'naval-1',
      'supply-lines-1',
      'maintenance-1',
    ])
      complete(researchId);

    expect(specializationTick).toBe(6_731);
    expect(specializationTick / 120).toBeCloseTo(56.09, 1);
    expect(state.elapsedTicks).toBe(11_384);
    expect(state.elapsedTicks).toBeLessThanOrEqual(rules.match.timeLimitTicks);
    expect(state.researchAnnouncements).toEqual([
      { factionId: 'A', researchId: 'specialization-power', tick: 6_731 },
    ]);
    const stage4Options = Object.values(rules.research.definitions).filter(
      ({ stage }) => stage === 4,
    ).length;
    const attainableInOneMatch =
      Object.keys(rules.research.definitions).length - stage4Options + 1;
    const completionRate =
      state.factions[0]!.completedResearchIds.length / attainableInOneMatch;
    expect(completionRate).toBeGreaterThanOrEqual(0.35);
    expect(completionRate).toBeLessThanOrEqual(0.45);
    expect(completionRate).toBeCloseTo(10 / 24, 4);
  });
});
