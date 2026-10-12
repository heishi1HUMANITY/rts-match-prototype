import { describe, expect, it } from 'vitest';
import { resolveCombat } from './combat';
import { createMatch } from './match';
import { updateFactionKnowledge } from './visibility';

function crossingFight(includeC: boolean) {
  let state = createMatch(42, { scenarioId: 'f04-crossing' });
  const site = state.map.crossingSites!.find(
    ({ id }) => id === 'CROSS-RING-SE',
  )!;
  const damage = state.rules.units.assault.baseDamage;
  state = {
    ...state,
    units: state.units
      .filter(({ id }) => id === 'B-01' || (includeC && id === 'C-01'))
      .map((unit) =>
        unit.id === 'B-01'
          ? { ...unit, cell: site.bankA }
          : { ...unit, cell: site.bankB },
      ),
    bases: [],
    crossings: state.crossings.map((crossing) =>
      crossing.siteId === site.id
        ? {
            ...crossing,
            owner: 'A',
            hp: includeC ? damage * 2 : damage,
            maxHp: state.rules.crossings[site.tier].maxHp,
          }
        : crossing,
    ),
  };
  state = { ...state, knowledge: updateFactionKnowledge(state) };
  return { state, site, damage };
}

describe('crossing combat', () => {
  it('transfers a destroyed crossing to its sole attacking faction at 30% durability', () => {
    const { state, site, damage } = crossingFight(false);
    const result = resolveCombat(state);
    expect(
      result.crossings.find(({ siteId }) => siteId === site.id),
    ).toMatchObject({
      owner: 'B',
      hp: Math.floor(state.rules.crossings[site.tier].maxHp * 0.3),
      lastDamagedTick: state.elapsedTicks,
    });
    expect(activeCrossingCount(result, site.id)).toBe(true);
    expect(damage).toBeGreaterThan(0);
  });

  it('neutralizes a crossing when the highest simultaneous damage is tied', () => {
    const { state, site } = crossingFight(true);
    const result = resolveCombat(state);
    expect(
      result.crossings.find(({ siteId }) => siteId === site.id),
    ).toMatchObject({
      owner: null,
      hp: 0,
      job: null,
    });
  });
});

function activeCrossingCount(
  state: ReturnType<typeof createMatch>,
  siteId: string,
) {
  return state.crossings.some(
    ({ siteId: currentId, owner, hp }) =>
      currentId === siteId && owner !== null && hp > 0,
  );
}
