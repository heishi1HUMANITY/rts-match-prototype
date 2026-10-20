import { applyCommand } from '../simulation/commands';
import { SCHEMA_VERSION } from '../simulation/config';
import { createMatch } from '../simulation/match';
import { cloneRules } from '../simulation/rules';
import { validateRules } from '../simulation/rules-validation';
import { MASTER_SCHEMA_VERSION, RULES_VERSION } from '../simulation/rules';
import type { RulesMaster } from '../simulation/rules';
import { advanceMatch } from './advance';
import type { MatchState, ScenarioId } from '../simulation/types';
import type { CommandEntry, RuntimeSnapshot } from './controller';

export interface BuildInfo {
  readonly commit: string;
  readonly dirty: boolean;
  readonly rulesVersion: string;
  readonly schemaVersion: number;
}
export interface ReplayInput {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly rulesVersion: typeof RULES_VERSION;
  readonly rules: RulesMaster;
  readonly rulesContentId: string;
  readonly scenarioId: ScenarioId;
  readonly mapId?: 'legacy-40' | 'ring-three-fronts-100';
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

export function rulesContentId(rules: RulesMaster): string {
  const text = stable(rules);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `f16-${hash.toString(16).padStart(16, '0')}`;
}

export function replay(input: ReplayInput): {
  readonly state: MatchState;
  readonly outcomes: readonly {
    readonly seq: number;
    readonly ok: boolean;
    readonly reason?: string;
  }[];
} {
  if (
    input.schemaVersion !== SCHEMA_VERSION ||
    input.rulesVersion !== RULES_VERSION ||
    !Number.isInteger(input.seed) ||
    input.seed < 0 ||
    input.seed > 0xffff_ffff ||
    !Number.isInteger(input.finalTick) ||
    input.finalTick < 0
  )
    throw new Error('invalid replay header');
  const validation = validateRules(input.rules);
  if (
    !validation.ok ||
    rulesContentId(validation.rules) !== input.rulesContentId
  )
    throw new Error('invalid replay rules snapshot');
  let state = createMatch(input.seed, {
    scenarioId: input.scenarioId,
    mapId: input.mapId ?? 'legacy-40',
    rules: validation.rules,
  });
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
      state = advanceMatch(state);
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
    state = advanceMatch(state);
  if (state.elapsedTicks !== input.finalTick)
    throw new Error('finalTick cannot be replayed');
  return { state, outcomes };
}

export function assertReplayMatches(snapshot: RuntimeSnapshot): void {
  const result = replay({
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    rules: snapshot.state.rules,
    rulesContentId: rulesContentId(snapshot.state.rules),
    scenarioId: snapshot.state.scenarioId,
    mapId:
      snapshot.state.map.definitionId === 'ring-three-fronts'
        ? 'ring-three-fronts-100'
        : 'legacy-40',
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
      rulesVersion: RULES_VERSION,
      schemaVersion: SCHEMA_VERSION,
      width: snapshot.state.map.width,
      height: snapshot.state.map.height,
      tickDurationMs: snapshot.state.rules.match.tickDurationMs,
      rulesContentId: rulesContentId(snapshot.state.rules),
      masterSchemaVersion: MASTER_SCHEMA_VERSION,
      rules: cloneRules(snapshot.state.rules),
    },
    seed: snapshot.state.seed,
    phase: snapshot.state.phase,
    scenarioId: snapshot.state.scenarioId,
    mapId:
      snapshot.state.map.definitionId === 'ring-three-fronts'
        ? 'ring-three-fronts-100'
        : 'legacy-40',
    matchOutcome: snapshot.state.result
      ? {
          endedAtTick: snapshot.state.result.endedAtTick,
          reason: snapshot.state.result.reason,
        }
      : null,
    timing: {
      firstContactTick: snapshot.tickProcessing.firstContactTick,
      measuredTickCount: snapshot.tickProcessing.tickCount,
      tickProcessingTotalMs: snapshot.tickProcessing.totalMs,
      tickProcessingMaxMs: snapshot.tickProcessing.maxMs,
    },
    finalTick: snapshot.state.elapsedTicks,
    history: snapshot.history,
    state: snapshot.state,
    droppedTimeMs: snapshot.droppedTimeMs,
  };
}
