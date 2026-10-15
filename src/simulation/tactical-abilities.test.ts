import { describe, expect, it } from 'vitest';
import { advanceProduction, enqueueProduction } from './production';
import { applyCommand } from './commands';
import { createMatch } from './match';
import { resolveCombat } from './combat';
import { isCellVisibleToFaction, isUnitVisibleToFaction } from './visibility';
import { incomingDamage } from './tactical-abilities';
import { getFactionView } from './view';
import { decideBotCommands } from '../ai/strategy';
import { DEFAULT_RULES } from './rules';
import type { Cell, MatchState } from './types';

function running(
  scenarioId: 'standard' | 'f15-tactical-abilities' = 'standard',
) {
  const initial = createMatch(42, { scenarioId });
  const started = applyCommand(initial, 'A', { type: 'start' });
  if (!started.ok) throw new Error('match did not start');
  return started.state;
}

function moveFactionNear(
  state: MatchState,
  factionId: 'A' | 'B',
  cell: Cell,
): MatchState {
  return {
    ...state,
    units: state.units.map((unit) =>
      unit.id === `${factionId}-01`
        ? {
            ...unit,
            cell,
            attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
          }
        : unit,
    ),
  };
}

describe('shared tactical abilities', () => {
  it('rejects unadopted ability ids and malformed target variants', () => {
    const state = running();
    expect(
      applyCommand(state, 'A', {
        type: 'activate-ability',
        abilityId: 'leader-hero',
      }),
    ).toEqual({ ok: false, state, reason: 'INVALID_COMMAND' });
    expect(
      applyCommand(state, 'A', {
        type: 'activate-ability',
        abilityId: 'artillery',
      }),
    ).toEqual({ ok: false, state, reason: 'INVALID_COMMAND' });
  });

  it('charges the shared cost, records cooldowns, and validates visible targets for every faction', () => {
    const state = running('f15-tactical-abilities');
    const target = state.units.find(({ id }) => id === 'B-01')!.cell;
    const result = applyCommand(state, 'B', {
      type: 'activate-ability',
      abilityId: 'survey',
      cell: target,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.factions[1]!.supplyCenti).toBe(
      state.factions[1]!.supplyCenti -
        DEFAULT_RULES.tacticalAbilities.survey.costCenti,
    );
    expect(result.state.factions[1]!.abilityReadyAtTick.survey).toBe(
      DEFAULT_RULES.tacticalAbilities.survey.cooldownTicks,
    );
    expect(
      applyCommand(result.state, 'B', {
        type: 'activate-ability',
        abilityId: 'survey',
        cell: target,
      }),
    ).toMatchObject({ ok: false, reason: 'ABILITY_NOT_READY' });
  });

  it('lets both NPC factions select and execute tactical commands through shared validation', () => {
    const state = running();
    for (const factionId of ['B', 'C'] as const) {
      const view = getFactionView(state, factionId);
      const decisionTick = 3 * view.rules.npc.decisionIntervalTicks;
      const commands = decideBotCommands({ ...view, tick: decisionTick });
      const ability = commands.find(
        (command) => command.type === 'activate-ability',
      );
      expect(ability).toBeDefined();
      expect(applyCommand(state, factionId, ability)).toMatchObject({
        ok: true,
      });
    }
  });

  it('leaves resources and effects unchanged when supply or visibility blocks an activation', () => {
    const state = running('f15-tactical-abilities');
    const poor = {
      ...state,
      factions: state.factions.map((faction) =>
        faction.id === 'A' ? { ...faction, supplyCenti: 0 } : faction,
      ),
    };
    expect(
      applyCommand(poor, 'A', { type: 'activate-ability', abilityId: 'surge' }),
    ).toEqual({ ok: false, state: poor, reason: 'INSUFFICIENT_SUPPLY' });
    expect(
      applyCommand(state, 'A', {
        type: 'activate-ability',
        abilityId: 'survey',
        cell: { x: 0, y: 0 },
      }),
    ).toEqual({ ok: false, state, reason: 'ABILITY_TARGET_NOT_VISIBLE' });
  });

  it('schedules artillery deterministically, damages ground units and owned structures, and excludes air units', () => {
    const base = running('f15-tactical-abilities');
    const a = base.units.find(({ id }) => id === 'A-01')!;
    let state: MatchState = {
      ...base,
      units: base.units.map((unit) =>
        unit.id === 'B-02'
          ? {
              ...unit,
              cell: { x: a.cell.x + 1, y: a.cell.y },
              kind: 'helicopter' as const,
              hp: DEFAULT_RULES.units.helicopter.maxHp,
              maxHp: DEFAULT_RULES.units.helicopter.maxHp,
              attack: {
                targetId: null,
                phase: 'cooldown' as const,
                phaseEndsTick: 9_999,
              },
            }
          : {
              ...unit,
              attack: {
                targetId: null,
                phase: 'cooldown' as const,
                phaseEndsTick: 9_999,
              },
            },
      ),
      bases: base.bases.map((entry) =>
        entry.id === 'OUT-03'
          ? {
              ...entry,
              owner: 'B' as const,
              hp: 300,
              cell: { x: a.cell.x + 2, y: a.cell.y },
            }
          : entry,
      ),
    };
    const activation = applyCommand(state, 'A', {
      type: 'activate-ability',
      abilityId: 'artillery',
      cell: a.cell,
    });
    expect(activation.ok).toBe(true);
    if (!activation.ok) return;
    state = activation.state;
    expect(state.scheduledStrikes).toHaveLength(1);
    const impactTick = state.scheduledStrikes[0]!.impactTick;
    const atImpact = resolveCombat({ ...state, elapsedTicks: impactTick });
    expect(atImpact.units.find(({ id }) => id === 'B-01')?.hp).toBe(
      DEFAULT_RULES.units.assault.maxHp -
        DEFAULT_RULES.tacticalAbilities.artillery.unitDamage,
    );
    expect(atImpact.units.find(({ id }) => id === 'B-02')?.hp).toBe(
      DEFAULT_RULES.units.helicopter.maxHp,
    );
    expect(atImpact.bases.find(({ id }) => id === 'OUT-03')?.hp).toBe(
      300 - DEFAULT_RULES.tacticalAbilities.artillery.structureDamage,
    );
  });

  it('applies smoke, survey and jam only through visibility rules', () => {
    const original = running('f15-tactical-abilities');
    const a = original.units.find(({ id }) => id === 'A-01')!;
    let state = moveFactionNear(original, 'B', {
      x: a.cell.x + 2,
      y: a.cell.y,
    });
    let enemy = state.units.find(({ id }) => id === 'A-01')!;
    expect(isUnitVisibleToFaction(state, enemy, 'B')).toBe(true);
    const smoke = applyCommand(state, 'A', {
      type: 'activate-ability',
      abilityId: 'smoke',
      cell: a.cell,
    });
    expect(smoke.ok).toBe(true);
    if (!smoke.ok) return;
    state = smoke.state;
    expect(getFactionView(state, 'A').ownFaction.activeSmokeUntilTick).toBe(
      DEFAULT_RULES.tacticalAbilities.smoke.durationTicks,
    );
    enemy = state.units.find(({ id }) => id === 'A-01')!;
    expect(isUnitVisibleToFaction(state, enemy, 'B')).toBe(false);

    const jamState: MatchState = {
      ...original,
      units: original.units
        .filter(({ id }) => id === 'B-01')
        .map((unit) => ({ ...unit, cell: { x: a.cell.x + 5, y: a.cell.y } })),
      bases: original.bases.filter(({ owner }) => owner !== 'B'),
      crossings: original.crossings.filter(({ owner }) => owner !== 'B'),
    };
    const beforeJam = isCellVisibleToFaction(jamState, a.cell, 'B');
    const jam = applyCommand(jamState, 'A', {
      type: 'activate-ability',
      abilityId: 'jam',
      targetFactionId: 'B',
    });
    expect(jam.ok).toBe(true);
    if (!jam.ok) return;
    expect(beforeJam).toBe(true);
    expect(isCellVisibleToFaction(jam.state, a.cell, 'B')).toBe(false);
    expect(getFactionView(jam.state, 'B').ownFaction.jammedUntilTick).toBe(200);
    expect(getFactionView(jam.state, 'C').ownFaction.jammedUntilTick).toBe(0);
  });

  it('applies production acceleration, structure protection, and survey radius from fixed-tick state', () => {
    const base = running('f15-tactical-abilities');
    const production = enqueueProduction(base, 'A', `HQ-A`, 'scout');
    expect(production.ok).toBe(true);
    if (!production.ok) return;
    const surge = applyCommand(production.state, 'A', {
      type: 'activate-ability',
      abilityId: 'surge',
    });
    expect(surge.ok).toBe(true);
    if (!surge.ok) return;
    expect(
      advanceProduction(surge.state).factions[0]!.productionJobs[0]!
        .remainingTicks,
    ).toBe(DEFAULT_RULES.units.scout.buildTicks - 2);
    const bulwark = applyCommand(surge.state, 'A', {
      type: 'activate-ability',
      abilityId: 'bulwark',
    });
    expect(bulwark.ok).toBe(true);
    if (!bulwark.ok) return;
    expect(incomingDamage(bulwark.state, 'A', 100)).toBe(
      DEFAULT_RULES.tacticalAbilities.bulwark.damageTakenPercent,
    );
    const a = base.units.find(({ id }) => id === 'A-01')!;
    const survey = applyCommand(base, 'A', {
      type: 'activate-ability',
      abilityId: 'survey',
      cell: a.cell,
    });
    expect(survey.ok).toBe(true);
    if (!survey.ok) return;
    expect(
      getFactionView(survey.state, 'A').ownFaction.activeSurveyUntilTick,
    ).toBe(DEFAULT_RULES.tacticalAbilities.survey.durationTicks);
    expect(
      isCellVisibleToFaction(
        survey.state,
        { x: a.cell.x + 7, y: a.cell.y },
        'A',
      ),
    ).toBe(true);
  });
});
