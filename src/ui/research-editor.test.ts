import { describe, expect, it } from 'vitest';
import { cloneRules, DEFAULT_RULES } from '../simulation/rules';
import { editResearchNode, newResearchProblem } from './research-editor';

describe('research editor draft boundaries', () => {
  it('rejects unsafe, duplicate, overlong and excessive node IDs before editing', () => {
    const rules = cloneRules(DEFAULT_RULES);
    for (const id of [
      '',
      '__proto__',
      'UPPER',
      'a.b',
      'a'.repeat(65),
      'firepower-1',
    ])
      expect(newResearchProblem(rules, id)).not.toBeNull();
    expect(newResearchProblem(rules, 'field-logistics-2')).toBeNull();
    const node = rules.research.definitions['firepower-1']!;
    const full = {
      ...rules,
      research: {
        ...rules.research,
        definitions: Object.fromEntries(
          Array.from({ length: 128 }, (_, i) => [`node-${i}`, node]),
        ),
      },
    };
    expect(newResearchProblem(full, 'one-more')).not.toBeNull();
  });

  it('keeps dangling and temporarily cyclic relations editable without changing the live snapshot', () => {
    const active = cloneRules(DEFAULT_RULES);
    const before = JSON.stringify(active);
    const edited = editResearchNode(active, 'firepower-1', (node) => ({
      ...node,
      prerequisites: ['missing-node', 'firepower-1'],
      costCenti: 7000,
    }));
    expect(JSON.stringify(active)).toBe(before);
    expect(edited.research.definitions['firepower-1']?.prerequisites).toEqual([
      'missing-node',
      'firepower-1',
    ]);
    const repaired = editResearchNode(edited, 'firepower-1', (node) => ({
      ...node,
      prerequisites: [],
    }));
    expect(repaired.research.definitions['firepower-1']?.costCenti).toBe(7000);
    expect(repaired.units).toEqual(active.units);
    expect(repaired.defenses).toEqual(active.defenses);
  });

  it('does not recreate a removed node from a stale editor callback', () => {
    expect(
      editResearchNode(DEFAULT_RULES, 'removed-node', () => {
        throw new Error('stale callback');
      }),
    ).toBe(DEFAULT_RULES);
  });
});
