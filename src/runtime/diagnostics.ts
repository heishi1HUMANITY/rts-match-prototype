import { applyCommand } from '../simulation/commands';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  MOVE_TICKS_PER_CELL,
  SCHEMA_VERSION,
  TICK_DURATION_MS,
} from '../simulation/config';
import { createMatch } from '../simulation/match';
import { stepMatch } from '../simulation/step';
import type { MatchState } from '../simulation/types';
import type { CommandEntry, RuntimeSnapshot } from './controller';

export interface BuildInfo {
  readonly commit: string;
  readonly dirty: boolean;
  readonly rulesVersion: string;
  readonly schemaVersion: number;
}
export interface ReplayInput {
  readonly seed: number;
  readonly history: readonly CommandEntry[];
  readonly finalTick: number;
}

const stable = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => {
    if (Array.isArray(item)) return item;
    if (typeof item === 'object' && item !== null)
      return Object.fromEntries(
        Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
      );
    return item;
  });

export function replay(input: ReplayInput): {
  readonly state: MatchState;
  readonly outcomes: readonly {
    readonly seq: number;
    readonly ok: boolean;
    readonly reason?: string;
  }[];
} {
  if (
    !Number.isInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > 0xffff_ffff ||
    !Number.isInteger(input.finalTick) ||
    input.finalTick < 0
  )
    throw new Error('invalid replay header');
  let state = createMatch(input.seed);
  let previousTick = 0;
  const outcomes: { seq: number; ok: boolean; reason?: string }[] = [];
  for (const entry of input.history) {
    if (
      !Number.isInteger(entry.tickBefore) ||
      entry.tickBefore < previousTick ||
      entry.tickBefore > input.finalTick
    )
      throw new Error(`invalid tick order at seq ${entry.seq}`);
    while (state.elapsedTicks < entry.tickBefore && state.phase === 'running')
      state = stepMatch(state);
    if (state.elapsedTicks !== entry.tickBefore)
      throw new Error(`unreachable tick at seq ${entry.seq}`);
    if (entry.runtimeReject === 'CONTEXT_LOST') {
      if (
        entry.ok ||
        entry.reason !== 'INVALID_PHASE' ||
        (entry.command?.type !== 'start' && entry.command?.type !== 'resume')
      )
        throw new Error(`invalid context-lost outcome at seq ${entry.seq}`);
      outcomes.push({ seq: entry.seq, ok: false, reason: 'INVALID_PHASE' });
      previousTick = entry.tickBefore;
      continue;
    }
    const applied = applyCommand(state, entry.actor, entry.command);
    if (
      applied.ok !== entry.ok ||
      (!applied.ok && applied.reason !== entry.reason)
    )
      throw new Error(`outcome mismatch at seq ${entry.seq}`);
    state = applied.state;
    outcomes.push({
      seq: entry.seq,
      ok: applied.ok,
      ...(!applied.ok ? { reason: applied.reason } : {}),
    });
    previousTick = entry.tickBefore;
  }
  while (state.elapsedTicks < input.finalTick && state.phase === 'running')
    state = stepMatch(state);
  if (state.elapsedTicks !== input.finalTick)
    throw new Error('finalTick cannot be replayed');
  return { state, outcomes };
}

export function assertReplayMatches(snapshot: RuntimeSnapshot): void {
  const result = replay({
    seed: snapshot.state.seed,
    history: snapshot.history,
    finalTick: snapshot.state.elapsedTicks,
  });
  if (stable(result.state) !== stable(snapshot.state))
    throw new Error('replay state differs');
}

export function createDiagnostic(
  snapshot: RuntimeSnapshot,
  build: BuildInfo,
): object {
  assertReplayMatches(snapshot);
  return {
    build,
    rules: {
      rulesVersion: build.rulesVersion,
      schemaVersion: SCHEMA_VERSION,
      width: MAP_WIDTH,
      height: MAP_HEIGHT,
      tickDurationMs: TICK_DURATION_MS,
      moveTicksPerCell: MOVE_TICKS_PER_CELL,
    },
    seed: snapshot.state.seed,
    phase: snapshot.state.phase,
    finalTick: snapshot.state.elapsedTicks,
    history: snapshot.history,
    state: snapshot.state,
    droppedTimeMs: snapshot.droppedTimeMs,
  };
}
