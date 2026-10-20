import { advanceMatch } from '../src/runtime/advance';
import { applyCommand } from '../src/simulation/commands';
import { createMatch } from '../src/simulation/match';
import { calculateIntervalTicketLossCenti } from '../src/simulation/tickets';
import type { FactionId } from '../src/simulation/types';
import { rulesFromArgs } from './rules-override';

/**
 * Real-time length of all-NPC standard matches on the 100-cell map, with the
 * ticket loss split into combat, time decay and territory pressure.
 * Usage: npx tsx scripts/audit-match-length.ts [--seeds=0,1,2] [--rules=patch.json]
 */
const seedsArgument = process.argv.find((argument) =>
  argument.startsWith('--seeds='),
);
const SEEDS = seedsArgument
  ? seedsArgument.slice('--seeds='.length).split(',').map(Number)
  : Array.from({ length: 12 }, (_, index) => index);
const TICK_LIMIT = 30_000;
const RULES = rulesFromArgs(process.argv);

const minutes: number[] = [];
for (const seed of SEEDS) {
  let state = createMatch(seed, {
    mapId: 'ring-three-fronts-100',
    controllers: { A: 'bot', B: 'bot', C: 'bot' },
    ...(RULES ? { rules: RULES } : {}),
  });
  state = applyCommand(state, 'A', { type: 'start' }).state;
  const loss = Object.fromEntries(
    (['A', 'B', 'C'] as const).map((id) => [
      id,
      { combat: 0, time: 0, territory: 0 },
    ]),
  ) as Record<FactionId, { combat: number; time: number; territory: number }>;
  while (state.phase === 'running' && state.elapsedTicks < TICK_LIMIT) {
    const before = state;
    const periodic =
      (state.elapsedTicks + 1) % state.rules.tickets.updateIntervalTicks === 0
        ? Object.fromEntries(
            state.factions.map((faction) => [
              faction.id,
              calculateIntervalTicketLossCenti(state, faction.id),
            ]),
          )
        : {};
    state = advanceMatch(state);
    for (const faction of state.factions) {
      const previous = before.factions.find(({ id }) => id === faction.id)!;
      const dropped = previous.ticketsCenti - faction.ticketsCenti;
      if (dropped <= 0 || previous.eliminatedAtTick !== null) continue;
      const interval = periodic[faction.id];
      const scheduled = interval ? Math.min(dropped, interval.totalLoss) : 0;
      const time = interval ? Math.min(scheduled, interval.decayCenti) : 0;
      loss[faction.id].time += time;
      loss[faction.id].territory += scheduled - time;
      loss[faction.id].combat += dropped - scheduled;
    }
  }
  const toMinutes = (ticks: number): number =>
    (ticks * state.rules.match.tickDurationMs) / 60_000;
  minutes.push(toMinutes(state.elapsedTicks));
  console.log(
    JSON.stringify({
      seed,
      minutes: Number(toMinutes(state.elapsedTicks).toFixed(1)),
      reason: state.result?.reason ?? state.phase,
      eliminatedAtMinute: Object.fromEntries(
        state.factions.map((faction) => [
          faction.id,
          faction.eliminatedAtTick === null
            ? null
            : Number(toMinutes(faction.eliminatedAtTick).toFixed(1)),
        ]),
      ),
      ticketLoss: Object.fromEntries(
        Object.entries(loss).map(([id, value]) => [
          id,
          {
            combat: Math.round(value.combat / 100),
            time: Math.round(value.time / 100),
            territory: Math.round(value.territory / 100),
          },
        ]),
      ),
    }),
  );
}
const sorted = [...minutes].sort((a, b) => a - b);
const middle = Math.floor(sorted.length / 2);
const median =
  sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
console.log(
  `median ${median.toFixed(1)} min · range ${sorted[0]!.toFixed(1)}-${sorted.at(-1)!.toFixed(1)} min · ${SEEDS.length} matches`,
);
