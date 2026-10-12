import { describe, expect, it } from 'vitest';
import { createMatch } from '../simulation/match';
import { getFactionView } from '../simulation/view';
import { applyCommand } from '../simulation/commands';
import { validateFacilityBuild } from '../simulation/facilities';
import { facilityConstructionCommand } from '../ai/strategy';
import {
  FACILITY_KINDS,
  facilityBuildReason,
  ownFacilityAnchors,
} from './facilities';
import type { MatchState } from '../simulation/types';

function fixture(): MatchState {
  const state = createMatch(42);
  return {
    ...state,
    phase: 'running',
    factions: state.factions.map((faction) => ({
      ...faction,
      supplyCenti: 1_000_000,
      completedResearchIds: Object.keys(state.rules.research.definitions),
    })),
  };
}

describe('facility player-view controls and conservative NPC construction', () => {
  it('allows all five kinds from an owned base using the same core validation', () => {
    const state = fixture();
    const view = getFactionView(state, 'A');
    const anchor = { kind: 'base' as const, id: 'HQ-A' };
    expect(ownFacilityAnchors(view)).toContainEqual({
      anchor,
      label: '拠点 HQ-A',
    });
    for (const kind of FACILITY_KINDS) {
      expect(facilityBuildReason(view, kind, anchor)).toBeNull();
      expect(validateFacilityBuild(state, 'A', kind, anchor)).toBeNull();
    }
  });

  it('explains reserved slots and research denial without hidden enemy information', () => {
    let state = fixture();
    const anchor = { kind: 'base' as const, id: 'HQ-A' };
    for (const kind of ['turret', 'watchtower'] as const) {
      const built = applyCommand(state, 'A', {
        type: 'build-facility',
        kind,
        anchor,
      });
      expect(built.ok).toBe(true);
      state = built.state;
    }
    expect(
      facilityBuildReason(getFactionView(state, 'A'), 'mine', anchor),
    ).toContain('枠');
    const fresh = createMatch(42);
    expect(
      facilityBuildReason(
        getFactionView({ ...fresh, phase: 'running' }, 'A'),
        'jammer',
        anchor,
      ),
    ).toContain('研究');
    expect(
      facilityBuildReason(getFactionView(state, 'A'), 'mine', {
        kind: 'base',
        id: 'HQ-B',
      }),
    ).toContain('所有');
  });

  it('NPC defense spends through the shared command and keeps the pacing and budget limits', () => {
    const state = fixture();
    const command = facilityConstructionCommand(getFactionView(state, 'B'));
    expect(command?.type).toBe('build-facility');
    const applied = applyCommand(state, 'B', command);
    expect(applied.ok).toBe(true);
    expect(
      applied.state.factions.find((faction) => faction.id === 'B')!.supplyCenti,
    ).toBeLessThan(1_000_000);
    expect(applied.state.rules.npc).toEqual(state.rules.npc);
    const view = getFactionView(state, 'B');
    expect(
      facilityConstructionCommand({
        ...view,
        ownFaction: { ...view.ownFaction, supplyCenti: 0 },
      }),
    ).toBeUndefined();
  });
});
