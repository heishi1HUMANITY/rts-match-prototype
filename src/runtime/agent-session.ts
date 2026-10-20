import { advanceMatch } from './advance';
import type { CommandEntry } from './controller';
import { rulesContentId, type ReplayInput } from './diagnostics';
import { SCHEMA_VERSION } from '../simulation/config';
import { applyCommand } from '../simulation/commands';
import { createMatch } from '../simulation/match';
import { researchCostForFaction } from '../simulation/research';
import { RULES_VERSION, type RulesMaster } from '../simulation/rules';
import { getFactionView } from '../simulation/view';
import type {
  Command,
  FactionId,
  FactionView,
  MatchState,
  RejectCode,
} from '../simulation/types';

/**
 * A headless match that an agent plays as faction A through the same command
 * validation as the browser. Time only moves on an explicit step, and every
 * observation is A's FactionView, so the agent never sees hidden state.
 */
export interface AgentSession {
  readonly version: 1;
  readonly mapId: 'legacy-40' | 'ring-three-fronts-100';
  readonly history: readonly CommandEntry[];
  readonly state: MatchState;
  /** Optional cap on accepted orders per window, to play with a human's pace. */
  readonly commandBudget: CommandBudget | null;
}

export interface CommandBudget {
  readonly windowTicks: number;
  readonly maxCommands: number;
}

export interface AgentSessionOptions {
  readonly seed?: number;
  readonly mapId?: AgentSession['mapId'];
  readonly rules?: RulesMaster;
  readonly commandBudget?: CommandBudget | null;
}

const ACTOR: FactionId = 'A';

export function createAgentSession(
  options: AgentSessionOptions = {},
): AgentSession {
  const mapId = options.mapId ?? 'ring-three-fronts-100';
  const state = createMatch(options.seed ?? 42, {
    mapId,
    ...(options.rules ? { rules: options.rules } : {}),
  });
  const session: AgentSession = {
    version: 1,
    mapId,
    history: [],
    state,
    commandBudget: options.commandBudget ?? null,
  };
  return record(session, { type: 'start' }).session;
}

function summaryOf(command: Command): string {
  return 'unitId' in command
    ? `${command.type} ${command.unitId}`
    : command.type;
}

function record(
  session: AgentSession,
  command: Command,
): {
  readonly session: AgentSession;
  readonly ok: boolean;
  readonly reason?: RejectCode;
} {
  const result = applyCommand(session.state, ACTOR, command);
  const entry: CommandEntry = {
    seq: session.history.length + 1,
    tickBefore: session.state.elapsedTicks,
    actor: ACTOR,
    command: result.ok || result.reason !== 'INVALID_COMMAND' ? command : null,
    summary: summaryOf(command),
    ok: result.ok,
    ...(result.ok ? {} : { reason: result.reason }),
  };
  return {
    session: {
      ...session,
      state: result.state,
      history: [...session.history, entry],
    },
    ok: result.ok,
    ...(result.ok ? {} : { reason: result.reason }),
  };
}

/** Accepted orders in the current budget window, excluding the match start. */
export function commandsInWindow(session: AgentSession): number {
  const budget = session.commandBudget;
  if (!budget) return 0;
  const from = session.state.elapsedTicks - budget.windowTicks;
  return session.history.filter(
    (entry) =>
      entry.ok && entry.command?.type !== 'start' && entry.tickBefore > from,
  ).length;
}

export type AgentCommandResult =
  | { readonly ok: true; readonly session: AgentSession }
  | {
      readonly ok: false;
      readonly session: AgentSession;
      readonly reason: RejectCode | 'COMMAND_BUDGET';
    };

/** Issues one order as A. The budget is a harness limit and is not replayed. */
export function issueAgentCommand(
  session: AgentSession,
  command: Command,
): AgentCommandResult {
  const budget = session.commandBudget;
  if (budget && commandsInWindow(session) >= budget.maxCommands)
    return { ok: false, session, reason: 'COMMAND_BUDGET' };
  const result = record(session, command);
  return result.ok
    ? { ok: true, session: result.session }
    : { ok: false, session: result.session, reason: result.reason! };
}

/** Advances up to `ticks` ticks, stopping early when the match ends. */
export function stepAgentSession(
  session: AgentSession,
  ticks: number,
): { readonly session: AgentSession; readonly events: readonly string[] } {
  if (!Number.isInteger(ticks) || ticks < 1)
    throw new RangeError('ticks must be a positive integer');
  const before = getFactionView(session.state, ACTOR);
  let state = session.state;
  for (let index = 0; index < ticks && state.phase === 'running'; index += 1)
    state = advanceMatch(state);
  return {
    session: { ...session, state },
    events: describeChanges(before, getFactionView(state, ACTOR)),
  };
}

const minutes = (view: FactionView, ticks: number): string => {
  const seconds = Math.floor((ticks * view.rules.match.tickDurationMs) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** What A could have noticed between two of its own views. */
export function describeChanges(
  before: FactionView,
  after: FactionView,
): string[] {
  const events: string[] = [];
  const at = `[${minutes(before, before.tick)}→${minutes(after, after.tick)}]`;
  for (const unit of before.ownUnits)
    if (!after.ownUnits.some(({ id }) => id === unit.id))
      events.push(`${at} 自軍 ${unit.id} ${unit.kind} を失った`);
  for (const unit of after.ownUnits)
    if (!before.ownUnits.some(({ id }) => id === unit.id))
      events.push(`${at} 自軍 ${unit.id} ${unit.kind} が配備された`);
  for (const unit of after.ownUnits) {
    const previous = before.ownUnits.find(({ id }) => id === unit.id);
    if (previous && !previous.resupplyReturn && unit.resupplyReturn)
      events.push(`${at} ${unit.id} が補給へ自動帰還を開始した`);
    if (previous && (previous.ammo ?? 0) > 0 && unit.ammo === 0)
      events.push(`${at} ${unit.id} が弾切れになった`);
  }
  for (const base of after.bases) {
    const previous = before.bases.find(({ id }) => id === base.id);
    const owner = (view: (typeof after.bases)[number] | undefined) =>
      view && 'owner' in view ? view.owner : undefined;
    if (owner(previous) !== owner(base) && owner(base) !== undefined)
      events.push(
        `${at} 拠点 ${base.id} の所有者: ${owner(previous) ?? '不明'} → ${owner(base) ?? '中立'}`,
      );
  }
  for (const id of after.ownFaction.completedResearchIds)
    if (!before.ownFaction.completedResearchIds.includes(id))
      events.push(`${at} 研究完了 ${id}`);
  for (const notice of after.researchAnnouncements ?? [])
    if (
      !(before.researchAnnouncements ?? []).some(
        (entry) =>
          entry.factionId === notice.factionId &&
          entry.researchId === notice.researchId,
      )
    )
      events.push(
        `${at} 公開通知: ${notice.factionId} が専攻 ${notice.researchId}`,
      );
  for (const id of ['A', 'B', 'C'] as const) {
    const was = before.publicEliminations[id]?.eliminatedAtTick ?? null;
    const now = after.publicEliminations[id]?.eliminatedAtTick ?? null;
    if (was === null && now !== null) events.push(`${at} ${id} が脱落した`);
  }
  for (const enemy of after.visibleEnemies)
    if (!before.visibleEnemies.some(({ id }) => id === enemy.id))
      events.push(
        `${at} 敵 ${enemy.id} ${enemy.kind} を発見 (${Math.floor(enemy.positionX1024 / 1024)},${Math.floor(enemy.positionY1024 / 1024)})`,
      );
  if (before.phase === 'running' && after.phase === 'finished')
    events.push(`${at} 試合終了: ${after.result?.reason ?? ''}`);
  return events;
}

/** A compact, JSON-friendly digest of A's view for an agent to read. */
export function summarizeAgentView(view: FactionView): object {
  const own = view.ownFaction;
  const cell = (x1024: number, y1024: number) => ({
    x: Math.floor(x1024 / 1024),
    y: Math.floor(y1024 / 1024),
  });
  const definitions = view.rules.research.definitions;
  const availableResearch = Object.entries(definitions)
    .filter(
      ([id, definition]) =>
        !own.completedResearchIds.includes(id) &&
        !definition.exclusiveWith.some((peer) =>
          own.completedResearchIds.includes(peer),
        ) &&
        (definition.prerequisites.length === 0 ||
          definition.prerequisites.some((parent) =>
            own.completedResearchIds.includes(parent),
          )),
    )
    .map(([id, definition]) => ({
      id,
      domain: definition.domain,
      stage: definition.stage,
      remaining:
        (researchCostForFaction(view.rules, own, id) -
          (own.researchProgressCenti[id] ?? 0)) /
        100,
      effects: definition.effects.map((effect) =>
        'unitKind' in effect && effect.unitKind
          ? `${effect.id}:${effect.unitKind}`
          : 'facilityKind' in effect && effect.facilityKind
            ? `${effect.id}:${effect.facilityKind}`
            : `${effect.id}:${effect.value}`,
      ),
    }));
  const ownedBases = view.bases.filter((base) => base.visibility === 'owned');
  const unitLimit = Math.min(
    view.rules.limits.maxUnits,
    view.rules.limits.baseUnits +
      ownedBases.filter((base) => base.kind !== 'hq' && base.hp > 0).length *
        view.rules.limits.unitsPerOwnedBase,
  );
  return {
    time: minutes(view, view.tick),
    tick: view.tick,
    phase: view.phase,
    result: view.result
      ? {
          reason: view.result.reason,
          standings: view.result.standings.map((entry) => ({
            factionId: entry.factionId,
            rank: entry.rank,
          })),
        }
      : null,
    tickets: Object.fromEntries(
      Object.entries(view.ticketsCenti).map(([id, value]) => [
        id,
        {
          tickets: Math.floor(value / 100),
          lossPerSecond:
            Math.round(view.ticketRatesCentiPerSec[id as FactionId] ?? 0) / 100,
          eliminated:
            view.publicEliminations[id as FactionId]?.eliminatedAtTick !== null,
        },
      ]),
    ),
    supply: Math.floor(own.supplyCenti / 100),
    researchBank: Math.floor(own.researchCenti / 100),
    activeResearch: own.activeResearch?.researchId ?? null,
    completedResearch: own.completedResearchIds,
    availableResearch,
    production: {
      units: view.ownUnits.length,
      queued: own.productionJobs.length,
      unitLimit,
      jobs: own.productionJobs.map((job) => ({
        id: job.id,
        unitKind: job.unitKind,
        status: job.status,
        remainingTicks: job.remainingTicks,
      })),
    },
    units: view.ownUnits.map((unit) => ({
      id: unit.id,
      kind: unit.kind,
      hp: `${unit.hp}/${unit.maxHp}`,
      cell: unit.cell,
      ammo:
        view.rules.units[unit.kind].ammo > 0
          ? `${unit.ammo}/${view.rules.units[unit.kind].ammo}`
          : 'unlimited',
      autoResupply: unit.autoResupply,
      status: unit.garrisonedAtBaseId
        ? `garrison ${unit.garrisonedAtBaseId}`
        : unit.resupplyReturn
          ? 'returning to resupply'
          : unit.marchOrder
            ? `march ${unit.marchOrder.target.kind}:${unit.marchOrder.target.id} (${unit.marchOrder.status})`
            : unit.path.length > 0
              ? `moving to ${JSON.stringify(unit.moveTarget ?? unit.path.at(-1))}`
              : 'idle',
      attacking: unit.attack?.lastFiredTargetId ?? null,
    })),
    bases: view.bases.map((base) =>
      base.visibility === 'unknown'
        ? { id: base.id, kind: base.kind, cell: base.cell, seen: 'unknown' }
        : base.visibility === 'remembered'
          ? {
              id: base.id,
              kind: base.kind,
              cell: base.cell,
              seen: `remembered at tick ${base.seenTick}`,
              owner: base.owner,
              hp: base.hp,
            }
          : {
              id: base.id,
              kind: base.kind,
              cell: base.cell,
              seen: base.visibility,
              owner: base.owner,
              hp: `${base.hp}/${base.maxHp}`,
              level: base.level,
              ...(base.defenderHp !== null
                ? { defender: `${base.defenderHp}/${base.defenderMaxHp}` }
                : {}),
              ...(base.captureCandidate
                ? {
                    capturing: `${base.captureCandidate} ${Math.floor(base.captureProgressCentiTicks / view.rules.capture.requiredTicks)}%`,
                  }
                : {}),
            },
    ),
    visibleEnemies: view.visibleEnemies.map((enemy) => ({
      id: enemy.id,
      factionId: enemy.factionId,
      kind: enemy.kind,
      hp: `${enemy.hp}/${enemy.maxHp}`,
      cell: cell(enemy.positionX1024, enemy.positionY1024),
    })),
    rememberedAirDefense: view.airDefenseMemory.map((memory) => ({
      ...memory,
    })),
    crossings: view.crossings.map((crossing) => ({ ...crossing })),
    facilities: view.facilities
      .filter((facility) => facility.visibility !== 'remembered')
      .map((facility) => ({ ...facility })),
  };
}

/** Replay header compatible with the browser diagnostic replay. */
export function agentReplayInput(session: AgentSession): ReplayInput {
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    rules: session.state.rules,
    rulesContentId: rulesContentId(session.state.rules),
    scenarioId: session.state.scenarioId,
    mapId: session.mapId,
    seed: session.state.seed,
    history: session.history,
    finalTick: session.state.elapsedTicks,
  };
}

const TERRAIN_GLYPH: Readonly<Record<string, string>> = {
  land: '.',
  riverbank: ',',
  river: '~',
  mountain: '^',
};

/**
 * Text map of A's public terrain and current knowledge. Each character covers
 * scale x scale cells; units outrank bases, which outrank crossings and terrain.
 */
export function renderAgentMap(view: FactionView, scale = 1): string {
  const { map } = view;
  const width = Math.ceil(map.width / scale);
  const height = Math.ceil(map.height / scale);
  const rank = (glyph: string): number =>
    glyph === '*'
      ? 5
      : glyph === '!'
        ? 4
        : /[A-Z?]/.test(glyph)
          ? 3
          : glyph === '='
            ? 2
            : glyph === '~'
              ? 1
              : 0;
  const grid = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      let glyph = '';
      for (let dy = 0; dy < scale; dy += 1)
        for (let dx = 0; dx < scale; dx += 1) {
          const cx = x * scale + dx;
          const cy = y * scale + dy;
          if (cx >= map.width || cy >= map.height) continue;
          const kind =
            map.terrain?.[cy * map.width + cx] ??
            (map.blocked[cy * map.width + cx] ? 'mountain' : 'land');
          const candidate = TERRAIN_GLYPH[kind] ?? '.';
          if (!glyph || rank(candidate) > rank(glyph)) glyph = candidate;
        }
      return glyph;
    }),
  );
  const put = (cell: { x: number; y: number }, glyph: string): void => {
    const row = grid[Math.floor(cell.y / scale)];
    const x = Math.floor(cell.x / scale);
    if (row && row[x] !== undefined && rank(glyph) >= rank(row[x]!))
      row[x] = glyph;
  };
  for (const site of map.crossingSites ?? [])
    for (const cell of site.cells) put(cell, '=');
  for (const base of view.bases)
    put(
      base.cell,
      base.visibility === 'unknown'
        ? '?'
        : base.owner === null
          ? 'N'
          : base.owner === 'local'
            ? 'L'
            : base.owner,
    );
  for (const enemy of view.visibleEnemies)
    put(
      {
        x: Math.floor(enemy.positionX1024 / 1024),
        y: Math.floor(enemy.positionY1024 / 1024),
      },
      '!',
    );
  for (const unit of view.ownUnits) put(unit.cell, '*');
  const ruler = Array.from({ length: width }, (_, x) =>
    (x * scale) % 10 === 0 ? String(((x * scale) / 10) % 10) : ' ',
  ).join('');
  return [
    `scale ${scale} · . land , bank ~ river ^ mountain = crossing site · base owner A/B/C, N neutral, ? unseen · * own unit ! enemy`,
    `     ${ruler}`,
    ...grid.map((row, y) => `${String(y * scale).padStart(4)} ${row.join('')}`),
  ].join('\n');
}
