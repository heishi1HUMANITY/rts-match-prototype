import { describe, expect, it } from 'vitest';
import { createMatch } from '../simulation/match';
import { getFactionView } from '../simulation/view';
import { marchOrderLabel, resolveMarchTarget } from './march-target';

describe('march target presentation boundary', () => {
  it('resolves only visible enemy positions and public base locations', () => {
    const view = getFactionView(createMatch(42), 'A');
    expect(
      resolveMarchTarget(view, { kind: 'unit', unitId: 'B-01' }),
    ).toBeNull();
    expect(
      resolveMarchTarget(view, { kind: 'unit', unitId: 'A-01' }),
    ).toBeNull();
    expect(
      resolveMarchTarget(view, { kind: 'base', baseId: 'missing' }),
    ).toBeNull();
    const base = view.bases[0]!;
    const target = resolveMarchTarget(view, { kind: 'base', baseId: base.id })!;
    expect(target.target).toEqual({ kind: 'base', id: base.id });
    expect(target.cell).toEqual(base.cell);
    expect(target.cell).not.toBe(base.cell);
    const visible = {
      ...view,
      visibleEnemies: [
        {
          control: 'enemy' as const,
          id: 'B-visible',
          factionId: 'B' as const,
          kind: 'scout' as const,
          positionX2: 15,
          positionY2: 18,
          hp: 60,
          maxHp: 60,
        },
      ],
    };
    expect(
      resolveMarchTarget(visible, { kind: 'unit', unitId: 'B-visible' }),
    ).toMatchObject({
      target: { kind: 'unit', id: 'B-visible' },
      cell: { x: 7, y: 9 },
    });
  });

  it('describes own pending orders without claiming hidden death or hidden position', () => {
    const unit = getFactionView(createMatch(42), 'A').ownUnits[0]!;
    expect(marchOrderLabel(unit)).toBe('');
    expect(
      marchOrderLabel({
        ...unit,
        marchOrder: {
          target: { kind: 'unit', id: 'B-01' },
          lastKnownCell: { x: 9, y: 9 },
          lastSeenTick: 1,
          status: 'searching',
        },
      }),
    ).toBe('B-01 · 最終確認位置へ・追跡保留');
  });
});
