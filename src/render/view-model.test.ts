import { describe, expect, it } from 'vitest';
import { createMatch } from '../simulation/match';
import { getFactionView } from '../simulation/view';
import type { FactionView, VisibleEnemyUnitView } from '../simulation/types';
import {
  baseLabel,
  getUnitFrames,
  ownGroupPreviews,
  ownUnitIds,
  placeUnitLabel,
} from './view-model';

const enemy: VisibleEnemyUnitView = {
  control: 'enemy',
  id: 'B-01',
  factionId: 'B',
  kind: 'scout',
  positionX1024: 10752,
  positionY1024: 11776,
  hp: 60,
  maxHp: 60,
};
function view(
  tick: number,
  enemies: readonly VisibleEnemyUnitView[],
): FactionView {
  return {
    ...getFactionView(createMatch(42), 'A'),
    phase: 'running',
    tick,
    visibleEnemies: enemies,
  };
}

describe('V06 view-only render frames', () => {
  it('keeps only distinct living own unit selections', () => {
    const current = view(1, [enemy]);
    expect(
      ownUnitIds(current, ['A-01', enemy.id, 'A-01', 'missing', 'A-02']),
    ).toEqual(['A-01', 'A-02']);
    expect(
      ownUnitIds({ ...current, ownUnits: current.ownUnits.slice(1) }, [
        'A-01',
        'A-02',
      ]),
    ).toEqual(['A-02']);
  });
  it('keeps legal and rejected group previews separate and copies arbitrary path lengths', () => {
    const current = view(1, [enemy]);
    const longPath = Array.from({ length: 1_601 }, (_, index) => ({
      x: index % 40,
      y: Math.floor(index / 40),
    }));
    const requested = [
      { unitId: 'A-01', path: longPath },
      { unitId: 'A-02', path: null },
      { unitId: 'A-01', path: null },
      { unitId: enemy.id, path: longPath },
      { unitId: 'missing', path: longPath },
    ];
    const result = ownGroupPreviews(current, requested);
    expect(result.map(({ unitId, path }) => [unitId, path === null])).toEqual([
      ['A-01', false],
      ['A-02', true],
    ]);
    expect(result[0]?.path).toHaveLength(1_601);
    expect(result[0]?.path).not.toBe(longPath);
    expect(result[0]?.path?.[0]).not.toBe(longPath[0]);
    expect(ownGroupPreviews({ ...current, ownUnits: [] }, requested)).toEqual(
      [],
    );
  });
  it('keeps six stacked production units individually selectable at the lower board edge', () => {
    const labels: { x: number; y: number }[] = [];
    for (let index = 0; index < 6; index += 1)
      labels.push(placeUnitLabel({ x: 12, y: 280 }, labels, 900, 284));
    for (const label of labels) {
      expect(label.x).toBeGreaterThanOrEqual(22);
      expect(label.x).toBeLessThanOrEqual(878);
      expect(label.y).toBeGreaterThanOrEqual(22);
      expect(label.y).toBeLessThanOrEqual(262);
      expect(
        labels.filter(
          (other) =>
            Math.abs(other.x - label.x) < 44 &&
            Math.abs(other.y - label.y) < 44,
        ),
      ).toHaveLength(1);
    }
  });
  it('removes a newly hidden enemy from frames immediately, including at alpha zero', () => {
    expect(
      getUnitFrames(view(0, [enemy]), view(1, []), 0).map(
        ({ unit }) => unit.id,
      ),
    ).not.toContain(enemy.id);
  });
  it('places a newly discovered enemy at its current position without hidden history', () => {
    const frames = getUnitFrames(view(0, []), view(1, [enemy]), 0);
    expect(frames.find(({ unit }) => unit.id === enemy.id)).toEqual({
      unit: enemy,
      x: 10.5,
      z: 11.5,
    });
  });
  it('interpolates a continuously visible enemy only across adjacent ticks of the same scenario', () => {
    const moved = { ...enemy, positionX1024: 11776 };
    expect(
      getUnitFrames(view(0, [enemy]), view(1, [moved]), 0.5).find(
        ({ unit }) => unit.id === enemy.id,
      )?.x,
    ).toBe(11);
    expect(
      getUnitFrames(view(0, [enemy]), view(2, [moved]), 0).find(
        ({ unit }) => unit.id === enemy.id,
      )?.x,
    ).toBe(11.5);
    expect(
      getUnitFrames(
        view(0, [enemy]),
        { ...view(1, [moved]), scenarioId: 'g2-capture' },
        0,
      ).find(({ unit }) => unit.id === enemy.id)?.x,
    ).toBe(11.5);
  });
  it('uses the half-cell own position without mutating the view', () => {
    const current = view(1, []);
    const own = {
      ...current.ownUnits[0]!,
      cell: { x: 6, y: 6 },
      path: [{ x: 7, y: 6 }],
      edgeProgress: 1 as const,
    };
    const input = { ...current, ownUnits: [own] };
    const before = JSON.stringify(input);
    expect(getUnitFrames(input, input, 1)[0]).toEqual({
      unit: own,
      x: 7,
      z: 6.5,
    });
    expect(JSON.stringify(input)).toBe(before);
  });
  it('distinguishes unknown from neutral and marks remembered information as old without capture progress', () => {
    const base = {
      id: 'outpost-1',
      kind: 'outpost' as const,
      cell: { x: 20, y: 20 },
    };
    expect(baseLabel({ ...base, visibility: 'unknown' })).toBe('拠点 · 未観測');
    const remembered = baseLabel({
      ...base,
      visibility: 'remembered',
      owner: 'B',
      hp: 42,
      seenTick: 17,
      selfReportedLost: false,
    });
    expect(remembered).toContain('B HP42 · T17の観測');
    expect(remembered).not.toContain('制圧');
    expect(
      baseLabel({
        ...base,
        visibility: 'visible',
        owner: null,
        hp: 0,
        maxHp: 100,
        captureCandidate: 'A',
        captureTicks: 12,
      }),
    ).toContain('中立 HP0/100 · A制圧 12/30');
  });
});
