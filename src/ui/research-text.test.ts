import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../simulation/rules';
import { researchEffectLabel, researchUnlocks } from './research-text';

describe('research text', () => {
  it('states effects as real-time amounts and shares of the base value', () => {
    expect(
      researchEffectLabel(
        { id: 'supply-income-bonus', value: 12 },
        DEFAULT_RULES,
      ),
    ).toBe('補給収入 +0.60/秒（基礎の10%）');
    expect(
      researchEffectLabel({ id: 'damage-bonus', value: 1 }, DEFAULT_RULES),
    ).toBe('全兵種の攻撃 +1/発（強襲20の5%）');
    expect(
      researchEffectLabel(
        { id: 'unit-unlock', value: 0, unitKind: 'helicopter' },
        DEFAULT_RULES,
      ),
    ).toBe('攻撃ヘリを生産可能');
  });

  it('lists the nodes a research opens', () => {
    expect(researchUnlocks(DEFAULT_RULES, 'survey-1')).toEqual(
      expect.arrayContaining(['survey-2', 'aircraft-1']),
    );
    expect(researchUnlocks(DEFAULT_RULES, 'firepower-3')).toEqual([
      'specialization-power',
    ]);
  });
});
