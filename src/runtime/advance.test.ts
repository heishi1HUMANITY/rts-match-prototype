import { describe, expect, it } from 'vitest';
import { UNIT_LIMIT } from '../simulation/config';
import { applyCommand } from '../simulation/commands';
import { createMatch } from '../simulation/match';
import type { MatchState, ScenarioId } from '../simulation/types';
import { advanceMatch } from './advance';

function running(state: MatchState): MatchState {
  return { ...state, phase: 'running' };
}

function runTicks(
  seed: number,
  scenarioId: ScenarioId,
  count: number,
): MatchState {
  let state = running(createMatch(seed, { scenarioId }));
  for (let index = 0; index < count && state.phase === 'running'; index += 1) {
    state = advanceMatch(state);
  }
  return state;
}

describe('advanceMatch NPC orchestration', () => {
  it('leaves stopped matches untouched and applies both bot orders before tick zero step', () => {
    const ready = createMatch(42);
    expect(advanceMatch(ready)).toBe(ready);

    const next = advanceMatch(running(ready));
    expect(next.elapsedTicks).toBe(1);
    for (const factionId of ['B', 'C'] as const) {
      const faction = next.factions.find((entry) => entry.id === factionId)!;
      expect(faction.productionJobs).toHaveLength(1);
      expect(faction.productionJobs[0]).toMatchObject({
        unitKind: 'assault',
        remainingTicks: 119,
      });
      expect(faction.activeResearch).toEqual({ researchId: 'firepower-1' });
      expect(faction.researchProgressCenti['firepower-1']).toBe(12);
      expect(faction.supplyCenti).toBeLessThan(8_100);
    }
  });

  it('keeps the legacy G2 fixtures manual and skips zero-ticket bot orders', () => {
    const g2 = advanceMatch(
      running(createMatch(42, { scenarioId: 'g2-economy' })),
    );
    expect(g2.factions.find(({ id }) => id === 'B')?.productionJobs).toEqual(
      [],
    );
    expect(g2.factions.find(({ id }) => id === 'B')?.activeResearch).toBeNull();

    const zeroTicket = createMatch(42);
    const fixture: MatchState = {
      ...running(zeroTicket),
      factions: zeroTicket.factions.map((faction) =>
        faction.id === 'B' ? { ...faction, ticketsCenti: 0 } : faction,
      ),
    };
    const next = advanceMatch(fixture);
    expect(next.factions.find(({ id }) => id === 'B')).toMatchObject({
      productionJobs: [],
      activeResearch: null,
      eliminatedAtTick: 0,
    });
  });

  it('keeps the F02 pursuit fixture free of bot orders for a manual tracking check', () => {
    const next = advanceMatch(
      running(createMatch(42, { scenarioId: 'f02-pursuit' })),
    );
    expect(next.elapsedTicks).toBe(1);
    for (const id of ['B', 'C'] as const) {
      const faction = next.factions.find((entry) => entry.id === id)!;
      expect(faction.productionJobs).toEqual([]);
      expect(faction.activeResearch).toBeNull();
    }
  });

  it('replays standard matches deterministically across seeds', () => {
    for (const seed of [0, 43, 0xffff_ffff]) {
      expect(runTicks(seed, 'standard', 120)).toEqual(
        runTicks(seed, 'standard', 120),
      );
    }
  });

  it('moves bots beyond their starting bases and captures neutral territory', () => {
    const state = runTicks(42, 'standard', 180);
    expect(
      state.bases.some(
        (base) =>
          base.kind === 'outpost' && (base.owner === 'B' || base.owner === 'C'),
      ),
    ).toBe(true);
  });

  it('reaches the short time-limit result and reproduces its full final state', () => {
    for (const seed of [42, 43]) {
      const first = runTicks(seed, 'g3-timeout', 250);
      const replay = runTicks(seed, 'g3-timeout', 250);
      expect(first.phase).toBe('finished');
      expect(first.elapsedTicks).toBe(200);
      expect(first.result?.reason).toBe('time-limit');
      expect(replay).toEqual(first);
    }
  });

  it('resolves initial zero-ticket fixtures before issuing those factions commands', () => {
    const initial = createMatch(43, { scenarioId: 'g3-elimination' });
    const result = advanceMatch(running(initial));
    expect(result.phase).toBe('finished');
    expect(result.elapsedTicks).toBe(0);
    for (const id of ['B', 'C'] as const) {
      const faction = result.factions.find((entry) => entry.id === id)!;
      expect(faction.productionJobs).toEqual([]);
      expect(faction.activeResearch).toBeNull();
      expect(faction.eliminatedAtTick).not.toBeNull();
    }
  });

  it('finishes full standard matches with active NPC strategy and valid final standings', () => {
    for (const seed of [0, 42, 43]) {
      const initial = createMatch(seed);
      const started = applyCommand(initial, 'A', { type: 'start' });
      expect(started.ok).toBe(true);
      if (!started.ok) throw new Error('standard match failed to start');
      let state = started.state;
      const observed = {
        B: { produced: false, moved: false, researched: false },
        C: { produced: false, moved: false, researched: false },
      };
      let captured = false;
      let combat = false;
      const initialUnits = new Map(
        initial.units.map((unit) => [
          unit.id,
          { hp: unit.hp, cell: unit.cell },
        ]),
      );

      for (let tick = 0; tick < 3_000 && state.phase === 'running'; tick += 1) {
        state = advanceMatch(state);
        for (const factionId of ['A', 'B', 'C'] as const) {
          const faction = state.factions.find(
            (entry) => entry.id === factionId,
          )!;
          expect(faction.supplyCenti).toBeGreaterThanOrEqual(0);
          expect(faction.researchCenti).toBeGreaterThanOrEqual(0);
          expect(faction.ticketsCenti).toBeGreaterThanOrEqual(0);
          expect(
            state.units.filter(
              (unit) => unit.factionId === factionId && unit.hp > 0,
            ).length + faction.productionJobs.length,
          ).toBeLessThanOrEqual(UNIT_LIMIT);
          for (const job of faction.productionJobs) {
            expect(job.remainingTicks).toBeGreaterThan(0);
            expect(job.costCenti).toBeGreaterThanOrEqual(0);
          }
        }
        for (const unit of state.units) {
          expect(unit.hp).toBeGreaterThan(0);
          expect(unit.hp).toBeLessThanOrEqual(unit.maxHp);
        }
        for (const base of state.bases) {
          expect(base.hp).toBeGreaterThanOrEqual(0);
          expect(base.hp).toBeLessThanOrEqual(base.maxHp);
        }

        for (const factionId of ['B', 'C'] as const) {
          const faction = state.factions.find(
            (entry) => entry.id === factionId,
          )!;
          observed[factionId].produced ||= faction.nextUnitSerial > 3;
          observed[factionId].moved ||= state.units.some((unit) => {
            if (unit.factionId !== factionId) return false;
            const original = initialUnits.get(unit.id);
            return (
              unit.path.length > 0 ||
              (original !== undefined &&
                (unit.cell.x !== original.cell.x ||
                  unit.cell.y !== original.cell.y))
            );
          });
          observed[factionId].researched ||=
            faction.activeResearch !== null ||
            faction.completedResearchIds.length > 0 ||
            faction.researchProgressCenti['firepower-1'] > 0 ||
            faction.researchProgressCenti['firepower-2'] > 0;
        }
        captured ||= state.bases.some(
          (base) =>
            base.kind === 'outpost' &&
            (base.owner !== null || base.captureTicks > 0),
        );
        combat ||= initial.units.some((unit) => {
          const current = state.units.find((entry) => entry.id === unit.id);
          return current === undefined || current.hp < unit.hp;
        });
      }

      expect(state.phase, `seed ${seed} did not finish within 3000 ticks`).toBe(
        'finished',
      );
      expect(state.elapsedTicks).toBeLessThanOrEqual(3_000);
      expect(state.result?.standings).toHaveLength(3);
      expect(
        state.result?.standings.map(({ factionId }) => factionId).sort(),
      ).toEqual(['A', 'B', 'C']);
      expect(
        state.result?.standings.every(
          ({ rank }) => Number.isInteger(rank) && rank >= 1 && rank <= 3,
        ),
      ).toBe(true);
      expect(advanceMatch(state)).toBe(state);
      expect(observed).toEqual({
        B: { produced: true, moved: true, researched: true },
        C: { produced: true, moved: true, researched: true },
      });
      expect(captured || combat).toBe(true);
    }
  }, 120_000);
});
