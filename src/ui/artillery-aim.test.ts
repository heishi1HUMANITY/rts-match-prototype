import { describe, expect, it } from 'vitest';
import { createMatch } from '../simulation/match';
import { updateFactionKnowledge } from '../simulation/visibility';
import { getFactionView } from '../simulation/view';
import type { MatchState, UnitState } from '../simulation/types';
import { artilleryAimPreview } from './artillery-aim';

function view(gun: Partial<UnitState> = {}) {
  const initial = createMatch(2468, { scenarioId: 'g2-combat' });
  const artillery: UnitState = {
    ...initial.units.find(({ id }) => id === 'A-01')!,
    id: 'A-GUN',
    kind: 'artillery',
    cell: { x: 20, y: 20 },
    path: [],
    edgeProgress: 0,
    ...gun,
  };
  const state: MatchState = {
    ...initial,
    phase: 'running',
    bases: [],
    facilities: [],
    crossings: [],
    units: [artillery],
  };
  return getFactionView(
    { ...state, knowledge: updateFactionKnowledge(state) },
    'A',
  );
}

describe('artillery aim preview', () => {
  it('widens the reticle with distance and when the cell is out of sight', () => {
    const current = view();
    const near = artilleryAimPreview(current, 'A-GUN', { x: 22, y: 20 })!;
    const edge = artilleryAimPreview(current, 'A-GUN', { x: 24, y: 20 })!;
    const hidden = artilleryAimPreview(current, 'A-GUN', { x: 27, y: 20 })!;
    expect(near.status).toBe('observed');
    expect(edge.status).toBe('observed');
    expect(hidden.status).toBe('unobserved');
    expect(edge.scatterRadius).toBeGreaterThan(near.scatterRadius);
    expect(hidden.scatterRadius).toBeGreaterThan(2 * edge.scatterRadius);
    expect(hidden.hitPercent).toBeLessThan(edge.hitPercent);
    expect(near.hint).toContain('◎ 観測');
    expect(hidden.hint).toContain('△ 未観測');
    expect(hidden.hint).toMatch(/着弾\d+\.\d秒/);
  });

  it('marks out-of-range and moving guns as invalid', () => {
    const outside = artilleryAimPreview(view(), 'A-GUN', { x: 36, y: 20 })!;
    expect(outside.status).toBe('invalid');
    expect(outside.hint).toContain('射程外');
    const moving = artilleryAimPreview(
      view({ path: [{ x: 21, y: 20 }] }),
      'A-GUN',
      { x: 22, y: 20 },
    )!;
    expect(moving.status).toBe('invalid');
    expect(moving.hint).toContain('移動中');
    expect(artilleryAimPreview(view(), 'missing', null)).toBeNull();
  });
});
