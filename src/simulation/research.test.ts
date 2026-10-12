import { describe, it, expect } from 'vitest';
import { createMatch } from './match';
import { cloneRules, DEFAULT_RULES, type RulesMaster } from './rules';
import { startResearch } from './research';
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
            domain: 'power',
            stage: 1,
            costCenti: 100,
            prerequisites: [],
            exclusiveWith: [],
            effects: [{ id: 'damage-bonus', value: 7 }],
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
