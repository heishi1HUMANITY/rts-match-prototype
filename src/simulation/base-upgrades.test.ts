import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { resolveCombat } from './combat';
import { applyEconomyTick } from './economy';
import { advanceBaseUpgrades, maximumBaseLevel } from './base-upgrades';
import { createMatch } from './match';
import { advanceCapture } from './capture';
import type { MatchState } from './types';

function running(scenarioId: 'standard' | 'f10-base-upgrades' = 'standard') {
  const ready = createMatch(42, { scenarioId });
  const started = applyCommand(ready, 'A', { type: 'start' });
  if (!started.ok) throw new Error('start rejected');
  return started.state;
}

function faction(state: MatchState, factionId: 'A' | 'B' | 'C') {
  return state.factions.find((entry) => entry.id === factionId)!;
}

describe('F10 base upgrades', () => {
  it('charges once and rejects a second concurrent job at the same base', () => {
    const state = running('f10-base-upgrades');
    const beforeSupply = faction(state, 'A').supplyCenti;
    const started = applyCommand(state, 'A', {
      type: 'upgrade-base',
      baseId: 'OUT-01',
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(faction(started.state, 'A').supplyCenti).toBe(beforeSupply - 30_000);
    expect(
      started.state.bases.find(({ id }) => id === 'OUT-01')?.upgradeJob,
    ).toEqual({ targetLevel: 2, costCenti: 30_000, remainingTicks: 450 });
    expect(
      applyCommand(started.state, 'A', {
        type: 'upgrade-base',
        baseId: 'OUT-01',
      }),
    ).toMatchObject({
      ok: false,
      reason: 'BASE_UPGRADE_BUSY',
      state: started.state,
    });
  });

  it('requires ownership, level research, and available supply', () => {
    const state = running();
    expect(
      applyCommand(state, 'A', { type: 'upgrade-base', baseId: 'HQ-B' }),
    ).toMatchObject({ ok: false, reason: 'BASE_UPGRADE_NOT_OWNED' });
    expect(
      applyCommand(state, 'A', { type: 'upgrade-base', baseId: 'HQ-A' }),
    ).toMatchObject({ ok: false, reason: 'BASE_UPGRADE_RESEARCH_REQUIRED' });
    const poor = {
      ...state,
      factions: state.factions.map((entry) =>
        entry.id === 'A'
          ? {
              ...entry,
              supplyCenti: 0,
              completedResearchIds: ['base-development-1'],
            }
          : entry,
      ),
    };
    expect(
      applyCommand(poor, 'A', { type: 'upgrade-base', baseId: 'HQ-A' }),
    ).toMatchObject({ ok: false, reason: 'INSUFFICIENT_SUPPLY' });
  });

  it('completes the level change with maximum HP ratio preserved', () => {
    const state = running('f10-base-upgrades');
    const damaged = {
      ...state,
      elapsedTicks: 20,
      bases: state.bases.map((base) =>
        base.id === 'OUT-01'
          ? {
              ...base,
              hp: 50,
              lastDamagedTick: 20,
              upgradeJob: {
                targetLevel: 2 as const,
                costCenti: 30_000,
                remainingTicks: 1,
              },
            }
          : base,
      ),
    };
    const completed = advanceBaseUpgrades(damaged).bases.find(
      ({ id }) => id === 'OUT-01',
    )!;
    expect(completed).toMatchObject({
      level: 2,
      maxHp: 390,
      hp: 65,
      upgradeJob: null,
    });
  });

  it('changes income and only regenerates after the damage delay', () => {
    const state = running('f10-base-upgrades');
    const base = state.bases.find(({ id }) => id === 'OUT-01')!;
    const levelOne = {
      ...state,
      bases: state.bases.map((entry) =>
        entry.id === base.id
          ? { ...entry, hp: 50, maxHp: 100, lastDamagedTick: 0 }
          : entry,
      ),
    };
    const levelTwo = {
      ...levelOne,
      bases: levelOne.bases.map((entry) =>
        entry.id === base.id
          ? { ...entry, level: 2 as const, maxHp: 130 }
          : entry,
      ),
    };
    const oneIncome = applyEconomyTick(levelOne);
    const twoIncome = applyEconomyTick(levelTwo);
    expect(
      faction(twoIncome, 'A').supplyCenti - faction(oneIncome, 'A').supplyCenti,
    ).toBe(6);
    expect(
      faction(twoIncome, 'A').researchCenti -
        faction(oneIncome, 'A').researchCenti,
    ).toBe(3);

    const stillPaused = advanceBaseUpgrades({
      ...levelTwo,
      elapsedTicks: 9,
    }).bases.find(({ id }) => id === base.id)!;
    const recovering = advanceBaseUpgrades({
      ...levelTwo,
      elapsedTicks: 10,
    }).bases.find(({ id }) => id === base.id)!;
    expect(stillPaused.hp).toBe(50);
    expect(recovering.hp).toBe(51);
  });

  it('fires level 2 turrets on interval boundaries and damages air at half rate', () => {
    const state = running('f10-base-upgrades');
    const battle = {
      ...state,
      elapsedTicks: 10,
      units: state.units
        .filter(({ id }) => id === 'B-01')
        .map((unit) => ({
          ...unit,
          kind: 'helicopter' as const,
          cell: { x: 10, y: 20 },
          hp: 90,
          maxHp: 90,
        })),
      bases: state.bases.map((base) =>
        base.id === 'HQ-A' ? { ...base, level: 2 as const } : base,
      ),
    };
    const after = resolveCombat(battle);
    expect(after.units[0]?.hp).toBe(77);
  });

  it('resets level and cancels unpaid work when control changes', () => {
    const state = running('f10-base-upgrades');
    const base = state.bases.find(({ id }) => id === 'OUT-01')!;
    const capturing: MatchState = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: base.cell } : { ...unit, hp: 0 },
      ),
      bases: state.bases.map((entry) =>
        entry.id === base.id
          ? {
              ...entry,
              owner: null,
              hp: 0,
              level: 3,
              maxHp: 160,
              upgradeJob: {
                targetLevel: 3,
                costCenti: 60_000,
                remainingTicks: 4,
              },
              captureCandidate: 'A',
              captureProgressCentiTicks:
                state.rules.capture.requiredTicks * 100 - 100,
              defender: null,
            }
          : entry,
      ),
    };
    const captured = advanceCapture(capturing).bases.find(
      ({ id }) => id === base.id,
    )!;
    expect(captured).toMatchObject({
      owner: 'A',
      level: 1,
      maxHp: 300,
      hp: 90,
      upgradeJob: null,
    });
  });
});

it('applies registered base level effects from any completed research ID', () => {
  const state = running();
  const rules = {
    ...state.rules,
    research: {
      ...state.rules.research,
      definitions: {
        ...state.rules.research.definitions,
        'custom-fortification': {
          ...state.rules.research.definitions['base-development-2']!,
          prerequisites: [],
        },
      },
    },
  };
  expect(
    maximumBaseLevel({ completedResearchIds: ['custom-fortification'] }, rules),
  ).toBe(3);
  expect(maximumBaseLevel({ completedResearchIds: ['missing'] }, rules)).toBe(
    1,
  );
});
