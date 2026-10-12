import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { applyEconomyTick } from './economy';
import { createMatch } from './match';
import { resolveMatchOutcome } from './outcome';
import { advanceResearch } from './research';
import { stepMatch } from './step';
import { applyTicketTick } from './tickets';
import { getFactionView } from './view';
import type { MatchState } from './types';

function running(
  scenarioId: MatchState['scenarioId'] = 'standard',
): MatchState {
  const result = applyCommand(createMatch(42, { scenarioId }), 'A', {
    type: 'start',
  });
  if (!result.ok) throw new Error(`start failed: ${result.reason}`);
  return result.state;
}

function byId(state: MatchState, id: 'A' | 'B' | 'C') {
  const faction = state.factions.find((entry) => entry.id === id);
  if (faction === undefined) throw new Error(`missing faction ${id}`);
  return faction;
}

describe('G3 simultaneous elimination and result', () => {
  it('ends the initial two-defeated fixture at tick zero without granting income or production', () => {
    const finished = running('g3-elimination');
    expect(finished.elapsedTicks).toBe(0);
    expect(finished.phase).toBe('finished');
    expect(finished.result?.reason).toBe('last-standing');
    expect(finished.result?.standings).toEqual([
      {
        factionId: 'A',
        rank: 1,
        ticketsCenti: 100_000,
        eliminatedAtTick: null,
        eliminationReason: null,
      },
      {
        factionId: 'B',
        rank: 2,
        ticketsCenti: 0,
        eliminatedAtTick: 0,
        eliminationReason: 'tickets',
      },
      {
        factionId: 'C',
        rank: 2,
        ticketsCenti: 0,
        eliminatedAtTick: 0,
        eliminationReason: 'tickets',
      },
    ]);
    expect(finished.units.every((unit) => unit.factionId === 'A')).toBe(true);
    expect(byId(finished, 'A').supplyCenti).toBe(20_000);
    expect(byId(finished, 'A').researchCenti).toBe(0);
    expect(stepMatch(finished)).toBe(finished);
    for (const command of [
      { type: 'pause' },
      { type: 'resume' },
      { type: 'move', unitId: 'A-01', target: { x: 7, y: 33 } },
      { type: 'enqueue-production', baseId: 'HQ-A', unitKind: 'scout' },
      { type: 'start-research', researchId: 'firepower-1' },
    ]) {
      expect(applyCommand(finished, 'A', command)).toEqual({
        ok: false,
        state: finished,
        reason: 'INVALID_PHASE',
      });
    }
  });

  it('reports mutual elimination without an arbitrary faction winner', () => {
    const finished = running('g3-mutual');
    expect(finished.phase).toBe('finished');
    expect(finished.result?.reason).toBe('mutual-elimination');
    expect(finished.result?.standings.map(({ rank }) => rank)).toEqual([
      1, 1, 1,
    ]);
    expect(finished.units).toEqual([]);
    expect(
      finished.bases
        .filter(({ kind }) => kind === 'hq')
        .every(({ hp }) => hp === 0),
    ).toBe(true);
  });

  it('continues spectators after A is eliminated, without income, sight, or commands', () => {
    const before = running('g3-spectate');
    expect(byId(before, 'A')).toMatchObject({
      eliminatedAtTick: 0,
      eliminationReason: 'tickets',
    });
    expect(before.units.some(({ factionId }) => factionId === 'A')).toBe(false);
    expect(
      applyCommand(before, 'A', {
        type: 'move',
        unitId: 'A-01',
        target: { x: 8, y: 33 },
      }),
    ).toEqual({
      ok: false,
      state: before,
      reason: 'FACTION_ELIMINATED',
    });
    const next = stepMatch(before);
    expect(next.phase).toBe('running');
    expect(next.elapsedTicks).toBe(1);
    expect(byId(next, 'A')).toMatchObject({
      eliminatedAtTick: 0,
      eliminationReason: 'tickets',
    });
    expect(next.units.some(({ factionId }) => factionId === 'A')).toBe(false);
    expect(next.bases.find(({ id }) => id === 'HQ-A')?.hp).toBe(0);
    const spectatorView = getFactionView(next, 'A');
    expect(spectatorView.visible.some(Boolean)).toBe(false);
    expect(spectatorView.result).toBeNull();
    expect(spectatorView.publicEliminations.A).toEqual({
      eliminatedAtTick: 0,
      eliminationReason: 'tickets',
    });
    expect(spectatorView.publicEliminations.B).toEqual({
      eliminatedAtTick: null,
      eliminationReason: null,
    });
    const balance = byId(next, 'A').supplyCenti;
    const research = byId(next, 'A').researchCenti;
    const further = advanceResearch(applyEconomyTick(next));
    expect(byId(further, 'A').supplyCenti).toBe(balance);
    expect(byId(further, 'A').researchCenti).toBe(research);
    expect(
      applyCommand(next, 'A', {
        type: 'start-research',
        researchId: 'firepower-1',
      }),
    ).toEqual({
      ok: false,
      state: next,
      reason: 'FACTION_ELIMINATED',
    });
    const paused = applyCommand(next, 'A', { type: 'pause' });
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(stepMatch(paused.state)).toBe(paused.state);
    expect(applyCommand(paused.state, 'A', { type: 'resume' }).ok).toBe(true);
  });

  it('requires both HQ destruction and no surviving units for forces elimination', () => {
    const state = running();
    const brokenHq = {
      ...state,
      bases: state.bases.map((base) =>
        base.id === 'HQ-B' ? { ...base, hp: 0 } : base,
      ),
    };
    const surviving = resolveMatchOutcome(brokenHq);
    expect(byId(surviving, 'B').eliminatedAtTick).toBeNull();
    const noForces = {
      ...brokenHq,
      units: brokenHq.units.filter(({ factionId }) => factionId !== 'B'),
    };
    const eliminated = resolveMatchOutcome(noForces);
    expect(byId(eliminated, 'B')).toMatchObject({
      eliminatedAtTick: 0,
      eliminationReason: 'forces',
    });
    expect(eliminated.phase).toBe('running');
  });

  it('removes outposts, queue and research on elimination, then freezes balances', () => {
    const state = running('g2-economy');
    const withDefeat = {
      ...state,
      factions: state.factions.map((faction) =>
        faction.id === 'A'
          ? {
              ...faction,
              ticketsCenti: 0,
              activeResearch: { researchId: 'firepower-1' as const },
              productionJobs: [
                {
                  id: 'A-J01',
                  baseId: 'HQ-A',
                  unitId: 'A-03',
                  unitKind: 'scout' as const,
                  costCenti: 6_000,
                  status: 'active' as const,
                  remainingTicks: 1,
                },
              ],
            }
          : faction,
      ),
    };
    const cleaned = resolveMatchOutcome(withDefeat);
    expect(byId(cleaned, 'A').productionJobs).toEqual([]);
    expect(byId(cleaned, 'A').activeResearch).toBeNull();
    expect(cleaned.bases.find(({ id }) => id === 'OUT-03')).toMatchObject({
      owner: null,
      hp: 100,
      defender: { hp: 60, maxHp: 60, disabledTicks: 0 },
      captureCandidate: null,
      captureTicks: 0,
    });
    expect(cleaned.bases.find(({ id }) => id === 'HQ-A')).toMatchObject({
      owner: 'A',
      hp: 0,
    });
    const afterTick = stepMatch(cleaned);
    expect(byId(afterTick, 'A').supplyCenti).toBe(
      byId(cleaned, 'A').supplyCenti,
    );
    expect(byId(afterTick, 'A').researchCenti).toBe(
      byId(cleaned, 'A').researchCenti,
    );
    expect(byId(afterTick, 'A').ticketsCenti).toBe(0);
  });

  it('times out at the configured 200th tick with competition ties and a detached public result', () => {
    let state = running('g3-timeout');
    expect(state.timeLimitTicks).toBe(200);
    for (let tick = 0; tick < 199; tick += 1) state = stepMatch(state);
    expect(state.phase).toBe('running');
    state = stepMatch(state);
    expect(state.elapsedTicks).toBe(200);
    expect(state.result?.reason).toBe('time-limit');
    expect(state.result?.standings.map(({ rank }) => rank)).toEqual([1, 1, 1]);
    const view = getFactionView(state, 'A');
    expect(view.result).toEqual(state.result);
    expect(view.result).not.toBe(state.result);
    expect(view.result?.standings).not.toBe(state.result?.standings);
    (view.result?.standings[0] as { rank: number }).rank = 99;
    expect(state.result?.standings[0]?.rank).toBe(1);
  });

  it('ranks living ticket ties above earlier losses with competition ranks', () => {
    const state = running();
    const fixture = {
      ...state,
      elapsedTicks: 4,
      timeLimitTicks: 4,
      factions: state.factions.map((faction) =>
        faction.id === 'B'
          ? {
              ...faction,
              ticketsCenti: 0,
              eliminatedAtTick: 2,
              eliminationReason: 'tickets' as const,
            }
          : { ...faction, ticketsCenti: 500 },
      ),
    };
    const finished = resolveMatchOutcome(fixture);
    expect(
      finished.result?.standings.map(({ factionId, rank }) => [
        factionId,
        rank,
      ]),
    ).toEqual([
      ['A', 1],
      ['C', 1],
      ['B', 3],
    ]);
  });

  it('ranks a later eliminated faction ahead of an earlier loss and uses ticket reason first', () => {
    const initial = running();
    const bOut = {
      ...initial,
      factions: initial.factions.map((faction) =>
        faction.id === 'B' ? { ...faction, ticketsCenti: 0 } : faction,
      ),
    };
    const afterB = stepMatch(bOut);
    expect(byId(afterB, 'B').eliminatedAtTick).toBe(0);
    const cOut = {
      ...afterB,
      units: afterB.units.filter(({ factionId }) => factionId !== 'C'),
      factions: afterB.factions.map((faction) =>
        faction.id === 'C' ? { ...faction, ticketsCenti: 0 } : faction,
      ),
      bases: afterB.bases.map((base) =>
        base.id === 'HQ-C' ? { ...base, hp: 0 } : base,
      ),
    };
    const finished = stepMatch(cOut);
    expect(finished.result?.reason).toBe('last-standing');
    expect(
      finished.result?.standings.map(({ factionId, rank }) => [
        factionId,
        rank,
      ]),
    ).toEqual([
      ['A', 1],
      ['C', 2],
      ['B', 3],
    ]);
    expect(byId(finished, 'C').eliminationReason).toBe('tickets');
  });

  it('replays the same seed, command and tick sequence to the same result', () => {
    const play = (): MatchState => {
      let state = { ...running(), timeLimitTicks: 20 };
      const moved = applyCommand(state, 'A', {
        type: 'move',
        unitId: 'A-01',
        target: { x: 8, y: 33 },
      });
      if (!moved.ok) throw new Error(`move failed: ${moved.reason}`);
      state = moved.state;
      for (let tick = 0; tick < 20; tick += 1) state = stepMatch(state);
      return state;
    };
    const first = play();
    expect(first.result?.reason).toBe('time-limit');
    expect(JSON.parse(JSON.stringify(first))).toEqual(play());
  });

  it('applies two-faction ticket pressure only to surviving factions', () => {
    const state = running();
    const fixture = {
      ...state,
      elapsedTicks: 10,
      factions: state.factions.map((faction) =>
        faction.id === 'B'
          ? {
              ...faction,
              ticketsCenti: 0,
              eliminatedAtTick: 1,
              eliminationReason: 'tickets' as const,
            }
          : faction,
      ),
      bases: state.bases.map((base) =>
        base.id === 'OUT-03' ? { ...base, owner: 'C' as const, hp: 100 } : base,
      ),
    };
    const updated = applyTicketTick(fixture);
    expect(byId(updated, 'A').ticketsCenti).toBe(99_990);
    expect(byId(updated, 'C').ticketsCenti).toBe(100_000);
    expect(byId(updated, 'B').ticketsCenti).toBe(0);
  });
});
