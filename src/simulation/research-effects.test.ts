import { describe, expect, it } from 'vitest';
import { createMatch } from './match';
import { updateFactionKnowledge } from './visibility';

describe('F09 registered research effects', () => {
  it('expands only the researched faction vision from completed information research', () => {
    const state = createMatch(42);
    const before = state.knowledge.find(({ factionId }) => factionId === 'A')!;
    const researched = {
      ...state,
      factions: state.factions.map((faction) =>
        faction.id === 'A'
          ? { ...faction, completedResearchIds: ['survey-1'] }
          : faction,
      ),
    };
    const after = updateFactionKnowledge(researched).find(
      ({ factionId }) => factionId === 'A',
    )!;
    const count = (visible: readonly boolean[]) =>
      visible.filter(Boolean).length;

    expect(count(after.visible)).toBeGreaterThan(count(before.visible));
    expect(
      updateFactionKnowledge(researched).find(
        ({ factionId }) => factionId === 'B',
      )!.visible,
    ).toEqual(
      updateFactionKnowledge(state).find(({ factionId }) => factionId === 'B')!
        .visible,
    );
  });
});
