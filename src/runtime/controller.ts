import { applyCommand } from '../simulation/commands';
import { createMatch } from '../simulation/match';
import { stepMatch } from '../simulation/step';
import { getFactionView } from '../simulation/view';
import type {
  Cell,
  FactionView,
  Command,
  CommandResult,
  FactionId,
  MatchState,
  RejectCode,
  ScenarioId,
  UnitKind,
} from '../simulation/types';
import { FixedStepClock } from './clock';

export interface CommandEntry {
  readonly seq: number;
  readonly tickBefore: number;
  readonly actor: FactionId;
  readonly command: Command | null;
  readonly summary: string;
  readonly ok: boolean;
  readonly reason?: RejectCode;
  readonly runtimeReject?: 'CONTEXT_LOST';
}
export interface RuntimeSnapshot {
  readonly state: MatchState;
  readonly history: readonly CommandEntry[];
  readonly selectedUnitId: string | null;
  readonly droppedTimeMs: number;
  readonly contextLost: boolean;
  readonly message: string;
}
export interface RuntimeOptions {
  readonly onChange: (snapshot: PlayerSnapshot) => void;
  readonly onFrame?: (
    previousTick: FactionView,
    current: FactionView,
    alpha: number,
  ) => void;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
}

/** Normal presentation boundary: no full match state or opponent secrets. */
export interface PlayerSnapshot {
  readonly view: FactionView;
  readonly selectedUnitId: string | null;
  readonly droppedTimeMs: number;
  readonly contextLost: boolean;
  readonly message: string;
}

function safeCommand(value: unknown): {
  readonly command: Command | null;
  readonly summary: string;
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return { command: null, summary: '不正な命令' };
  const item = value as Record<string, unknown>;
  if (
    item.type === 'enqueue-production' &&
    typeof item.baseId === 'string' &&
    typeof item.unitKind === 'string'
  )
    return {
      command: {
        type: 'enqueue-production',
        baseId: item.baseId,
        unitKind: item.unitKind as UnitKind,
      },
      summary: `生産 ${item.unitKind}`,
    };
  if (item.type === 'cancel-production' && typeof item.jobId === 'string')
    return {
      command: { type: 'cancel-production', jobId: item.jobId },
      summary: '生産取消',
    };
  if (item.type === 'start-research' && typeof item.researchId === 'string')
    return {
      command: {
        type: 'start-research',
        researchId: item.researchId as 'firepower-1' | 'firepower-2',
      },
      summary: `研究 ${item.researchId}`,
    };
  if (item.type === 'start' || item.type === 'pause' || item.type === 'resume')
    return { command: { type: item.type }, summary: item.type };
  if (item.type === 'stop' && typeof item.unitId === 'string')
    return {
      command: { type: 'stop', unitId: item.unitId.slice(0, 64) },
      summary: `stop ${item.unitId.slice(0, 64)}`,
    };
  if (
    item.type === 'move' &&
    typeof item.unitId === 'string' &&
    typeof item.target === 'object' &&
    item.target !== null
  ) {
    const target = item.target as Record<string, unknown>;
    if (
      typeof target.x === 'number' &&
      Number.isFinite(target.x) &&
      typeof target.y === 'number' &&
      Number.isFinite(target.y)
    ) {
      const x = target.x;
      const y = target.y;
      const command: Command = {
        type: 'move',
        unitId: item.unitId.slice(0, 64),
        target: { x, y },
      };
      return {
        command,
        summary: `move ${item.unitId.slice(0, 64)} (${x},${y})`,
      };
    }
  }
  const kind =
    typeof item.type === 'string' ? item.type.slice(0, 32) : 'unknown';
  return { command: null, summary: `不正な命令 (${kind})` };
}

export class MatchRuntime {
  private readonly views = new WeakMap<MatchState, FactionView>();
  private state: MatchState;
  private previousTickState: MatchState;
  private history: CommandEntry[] = [];
  private selectedUnitId: string | null = null;
  private readonly clock = new FixedStepClock();
  private frame: number | null = null;
  private started = false;
  private contextLost = false;
  private message = 'seed 42 · 開始待ち';
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;

  constructor(
    private readonly options: RuntimeOptions,
    seed = 42,
    scenarioId: ScenarioId = 'standard',
  ) {
    this.state = createMatch(seed, { scenarioId });
    this.previousTickState = this.state;
    this.requestFrame =
      options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame =
      options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
  }

  snapshot(): RuntimeSnapshot {
    return {
      state: this.state,
      history: this.history,
      selectedUnitId: this.selectedUnitId,
      droppedTimeMs: this.clock.droppedTimeMs,
      contextLost: this.contextLost,
      message: this.message,
    };
  }

  private viewFor(state: MatchState): FactionView {
    let view = this.views.get(state);
    if (view === undefined) {
      view = getFactionView(state, 'A');
      this.views.set(state, view);
    }
    return view;
  }

  playerSnapshot(): PlayerSnapshot {
    return {
      view: this.viewFor(this.state),
      selectedUnitId: this.selectedUnitId,
      droppedTimeMs: this.clock.droppedTimeMs,
      contextLost: this.contextLost,
      message: this.message,
    };
  }

  previewMove(unitId: string, target: Cell): readonly Cell[] | null {
    if (this.contextLost) return null;
    const result = applyCommand(this.state, 'A', {
      type: 'move',
      unitId,
      target,
    });
    if (!result.ok) return null;
    return (
      result.state.units
        .find((unit) => unit.id === unitId && unit.factionId === 'A')
        ?.path.map((cell) => ({ ...cell })) ?? null
    );
  }

  startLoop(): void {
    if (this.started) return;
    this.started = true;
    const frame = (timestamp: number): void => {
      if (!this.started) return;
      let previousTick = this.previousTickState;
      const result = this.clock.advance(
        timestamp,
        this.state.phase === 'running' && !this.contextLost,
        () => {
          previousTick = this.state;
          this.state = stepMatch(this.state);
        },
      );
      this.previousTickState = previousTick;
      this.options.onFrame?.(
        this.viewFor(previousTick),
        this.viewFor(this.state),
        result.alpha,
      );
      const previous = previousTick;
      if (result.ticks > 0 || result.droppedMs > 0) this.emit(previous);
      this.frame = this.requestFrame(frame);
    };
    this.frame = this.requestFrame(frame);
  }

  stopLoop(): void {
    this.started = false;
    if (this.frame !== null) this.cancelFrame(this.frame);
    this.frame = null;
    this.clock.reset(false);
  }

  dispatch(input: unknown): CommandResult {
    const safe = safeCommand(input);
    const previous = this.state;
    const tickBefore = this.state.elapsedTicks;
    let result: CommandResult = applyCommand(this.state, 'A', input);
    const runtimeReject =
      this.contextLost &&
      result.ok &&
      (safe.command?.type === 'resume' || safe.command?.type === 'start')
        ? ('CONTEXT_LOST' as const)
        : undefined;
    if (runtimeReject !== undefined)
      result = { ok: false, state: this.state, reason: 'INVALID_PHASE' };
    else this.state = result.state;
    const resultReason = result.ok ? undefined : result.reason;
    this.history = [
      ...this.history,
      {
        seq: this.history.length + 1,
        tickBefore,
        actor: 'A',
        command: resultReason === 'INVALID_COMMAND' ? null : safe.command,
        summary: safe.summary,
        ok: result.ok,
        ...(resultReason === undefined ? {} : { reason: resultReason }),
        ...(runtimeReject === undefined ? {} : { runtimeReject }),
      },
    ];
    if (previous.phase !== this.state.phase) this.clock.reset(false);
    this.previousTickState = this.state;
    this.message = result.ok
      ? this.phaseMessage()
      : rejectMessage(result.reason);
    this.emit(previous);
    return result;
  }

  reset(seed: number, scenarioId: ScenarioId = this.state.scenarioId): void {
    const previous = this.state;
    this.state = createMatch(seed, { scenarioId });
    this.previousTickState = this.state;
    this.history = [];
    this.selectedUnitId = null;
    this.clock.reset(true);
    this.message = this.contextLost
      ? '盤面復旧待ち · リセット済み'
      : `seed ${seed} · 開始待ち`;
    this.emit(previous);
  }

  select(unitId: string | null): void {
    const previous = this.state;
    this.selectedUnitId = this.state.units.some(
      (unit) => unit.id === unitId && unit.factionId === 'A',
    )
      ? unitId
      : null;
    this.emit(previous);
  }

  notify(message: string): void {
    this.message = message.slice(0, 160);
    this.emit(this.state);
  }

  onHidden(): void {
    if (this.state.phase === 'running') this.dispatch({ type: 'pause' });
    this.clock.reset(false);
    this.message = 'タブ非表示のため停止しました。再開してください。';
    this.emit(this.state);
  }

  onContextLost(): void {
    this.contextLost = true;
    if (this.state.phase === 'running') this.dispatch({ type: 'pause' });
    this.message = '描画を復旧中です。復旧後に再開してください。';
    this.emit(this.state);
  }

  onContextRestored(): void {
    this.contextLost = false;
    this.clock.reset(false);
    this.message = '盤面が復旧しました。必要なら再開してください。';
    this.emit(this.state);
  }

  get droppedTimeMs(): number {
    return this.clock.droppedTimeMs;
  }

  private phaseMessage(): string {
    return this.state.phase === 'running'
      ? '対戦中'
      : this.state.phase === 'paused'
        ? '一時停止中'
        : `seed ${this.state.seed} · 開始待ち`;
  }
  private emit(_previous: MatchState): void {
    if (
      this.selectedUnitId !== null &&
      !this.state.units.some(
        (unit) => unit.id === this.selectedUnitId && unit.factionId === 'A',
      )
    )
      this.selectedUnitId = null;
    this.options.onChange(this.playerSnapshot());
  }
}

export function rejectMessage(reason: RejectCode): string {
  const messages: Record<RejectCode, string> = {
    INVALID_COMMAND: '命令の形式が正しくありません',
    INVALID_ACTOR: '操作できない陣営です',
    INVALID_PHASE: '今はその操作をできません',
    UNIT_NOT_FOUND: '部隊が見つかりません',
    NOT_OWNER: '自軍の部隊を選んでください',
    OUT_OF_BOUNDS: '盤面の外です',
    BLOCKED: '障害物があります',
    UNREACHABLE: '経路がありません',
    BASE_NOT_FOUND: '拠点が見つかりません',
    JOB_NOT_FOUND: '生産予約が見つかりません',
    INVALID_UNIT_KIND: '兵種が正しくありません',
    RESEARCH_NOT_FOUND: '研究が見つかりません',
    HQ_UNAVAILABLE: '首都が破壊されているため生産できません',
    INSUFFICIENT_SUPPLY: '補給が不足しています',
    INSUFFICIENT_RESEARCH: '研究ポイントが不足しています',
    UNIT_LIMIT: '部隊上限に達しています',
    QUEUE_FULL: '生産予約は3件までです',
    RESEARCH_BUSY: '別の研究が進行中です',
    ALREADY_RESEARCHED: '完了済みの研究です',
    PREREQUISITE_MISSING: '先に戦力研究Iを完了してください',
  };
  return messages[reason];
}
