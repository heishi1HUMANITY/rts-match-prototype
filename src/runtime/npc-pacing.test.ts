import { afterEach, describe, expect, it, vi } from 'vitest';
import * as strategy from '../ai/strategy';
import * as local from '../ai/local-faction';
import { applyCommand } from '../simulation/commands';
import { createMatch } from '../simulation/match';
import { RULES_VERSION } from '../simulation/rules';
import { advanceMatch } from './advance';
import { replay, rulesContentId } from './diagnostics';

afterEach(() => vi.restoreAllMocks());

describe('NPC-R01 runtime pacing', () => {
  it('schedules B/C every 30 ticks and local orders every 10 ticks independently', () => {
    const bots = vi.spyOn(strategy, 'planBotDecision');
    const locals = vi.spyOn(local, 'advanceLocalFactionOrders');
    let state = { ...createMatch(42), phase: 'running' as const };
    for (let tick = 0; tick < 90; tick += 1) {
      state = advanceMatch(state) as typeof state;
    }
    expect(
      bots.mock.calls.map(([view]) => [view.viewerFactionId, view.tick]),
    ).toEqual([
      ['B', 0],
      ['C', 0],
      ['B', 30],
      ['C', 30],
      ['B', 60],
      ['C', 60],
    ]);
    expect(
      bots.mock.results.every((result) => result.value.commands.length <= 2),
    ).toBe(true);
    expect(
      state.factions
        .filter(({ controller }) => controller === 'bot')
        .every(({ npcPolicyMemory }) => npcPolicyMemory !== undefined),
    ).toBe(true);
    expect(
      locals.mock.calls.map(([snapshot]) => snapshot.elapsedTicks),
    ).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80]);
    const before = bots.mock.calls.length;
    const paused = { ...state, phase: 'paused' as const };
    expect(advanceMatch(paused)).toBe(paused);
    expect(bots).toHaveBeenCalledTimes(before);
  });

  it.each([42, 43, 44])(
    'replays paced NPC decisions for seed %i and rejects the old policy version',
    (seed) => {
      const initial = createMatch(seed);
      const started = applyCommand(initial, 'A', { type: 'start' });
      expect(started.ok).toBe(true);
      let state = started.state;
      for (let tick = 0; tick < 120; tick += 1) state = advanceMatch(state);
      const input = {
        schemaVersion: state.schemaVersion,
        rulesVersion: RULES_VERSION,
        rules: state.rules,
        rulesContentId: rulesContentId(state.rules),
        scenarioId: state.scenarioId,
        seed,
        history: [
          {
            seq: 0,
            tickBefore: 0,
            actor: 'A' as const,
            command: { type: 'start' as const },
            summary: 'start',
            ok: true,
          },
        ],
        finalTick: state.elapsedTicks,
      };
      expect(replay(input).state).toEqual(state);
      expect(() =>
        replay({ ...input, rulesVersion: 'f10-v1' } as unknown as typeof input),
      ).toThrow('invalid replay header');
    },
  );
});
