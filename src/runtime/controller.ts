import { applyCommand } from '../simulation/commands';
import { createMatch } from '../simulation/match';
import { advanceMatch } from './advance';
import { getFactionView } from '../simulation/view';
import type {
  Cell,
  FactionView,
  Command,
  CommandResult,
  FactionId,
  MatchState,
  MarchTarget,
  RejectCode,
  ScenarioId,
  ResearchId,
  UnitKind,
  FacilityKind,
} from '../simulation/types';
import { FixedStepClock } from './clock';
import type { RulesMaster } from '../simulation/rules';
import { getFactionUnitLimit } from '../simulation/production';

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
  readonly selectedUnitIds: readonly string[];
  readonly droppedTimeMs: number;
  readonly contextLost: boolean;
  readonly message: string;
}

export interface BatchCommandResult {
  readonly accepted: readonly string[];
  readonly rejected: readonly {
    readonly unitId: string;
    readonly reason: RejectCode;
  }[];
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
  readonly selectedUnitIds: readonly string[];
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
    item.type === 'build-facility' &&
    typeof item.kind === 'string' &&
    typeof item.anchor === 'object' &&
    item.anchor !== null &&
    !Array.isArray(item.anchor)
  ) {
    const anchor = item.anchor as Record<string, unknown>;
    if (
      (anchor.kind === 'base' || anchor.kind === 'crossing') &&
      typeof anchor.id === 'string'
    )
      return {
        command: {
          type: 'build-facility',
          kind: item.kind as FacilityKind,
          anchor: { kind: anchor.kind, id: anchor.id },
        },
        summary: `施設建築 ${item.kind.slice(0, 32)} → ${anchor.kind}:${anchor.id.slice(0, 64)}`,
      };
  }
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
  if (
    item.type === 'start-research' &&
    (typeof item.researchId === 'string' || item.researchId === null)
  )
    return {
      command: {
        type: 'start-research',
        researchId: item.researchId as ResearchId | null,
      },
      summary:
        item.researchId === null
          ? '研究指定解除・バンク'
          : `研究選択 ${item.researchId}`,
    };
  if (
    (item.type === 'build-crossing' || item.type === 'dismantle-crossing') &&
    typeof item.siteId === 'string' &&
    typeof item.unitId === 'string'
  )
    return {
      command: {
        type: item.type,
        siteId: item.siteId.slice(0, 64),
        unitId: item.unitId.slice(0, 64),
      },
      summary: `${item.type === 'build-crossing' ? '渡河設備建設' : '渡河設備解体'} ${item.siteId.slice(0, 64)}`,
    };
  if (item.type === 'start' || item.type === 'pause' || item.type === 'resume')
    return { command: { type: item.type }, summary: item.type };
  if (item.type === 'stop' && typeof item.unitId === 'string')
    return {
      command: { type: 'stop', unitId: item.unitId.slice(0, 64) },
      summary: `stop ${item.unitId.slice(0, 64)}`,
    };
  if (
    item.type === 'garrison' &&
    typeof item.unitId === 'string' &&
    typeof item.baseId === 'string'
  )
    return {
      command: {
        type: 'garrison',
        unitId: item.unitId.slice(0, 64),
        baseId: item.baseId.slice(0, 64),
      },
      summary: `駐留 ${item.unitId.slice(0, 64)} → ${item.baseId.slice(0, 64)}`,
    };
  if (
    item.type === 'march' &&
    typeof item.unitId === 'string' &&
    typeof item.target === 'object' &&
    item.target !== null &&
    !Array.isArray(item.target)
  ) {
    const target = item.target as Record<string, unknown>;
    if (
      (target.kind === 'unit' || target.kind === 'base') &&
      typeof target.id === 'string'
    )
      return {
        command: {
          type: 'march',
          unitId: item.unitId,
          target: { kind: target.kind, id: target.id },
        },
        summary: `追跡/進軍 ${item.unitId.slice(0, 64)} → ${target.kind}:${target.id.slice(0, 64)}`,
      };
  }
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
  private selectedUnitIds: string[] = [];
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
    rules?: RulesMaster,
  ) {
    this.state = createMatch(seed, { scenarioId, ...(rules ? { rules } : {}) });
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
      selectedUnitIds: [...this.selectedUnitIds],
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
      selectedUnitIds: [...this.selectedUnitIds],
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

  previewGroupMove(
    unitIds: readonly string[],
    target: Cell,
  ): readonly {
    readonly unitId: string;
    readonly path: readonly Cell[] | null;
    readonly reason: RejectCode | null;
  }[] {
    return uniqueSortedIds(unitIds).map((unitId) => {
      if (this.contextLost)
        return { unitId, path: null, reason: 'INVALID_PHASE' as const };
      const result = applyCommand(this.state, 'A', {
        type: 'move',
        unitId,
        target,
      });
      if (!result.ok) return { unitId, path: null, reason: result.reason };
      const unit = result.state.units.find(
        (entry) => entry.id === unitId && entry.factionId === 'A',
      );
      return {
        unitId,
        path: unit?.path.map((cell) => ({ ...cell })) ?? null,
        reason: null,
      };
    });
  }

  previewGroupMarch(
    unitIds: readonly string[],
    target: MarchTarget,
  ): readonly {
    readonly unitId: string;
    readonly path: readonly Cell[] | null;
    readonly reason: RejectCode | null;
  }[] {
    return uniqueSortedIds(unitIds).map((unitId) => {
      if (this.contextLost)
        return { unitId, path: null, reason: 'INVALID_PHASE' as const };
      const result = applyCommand(this.state, 'A', {
        type: 'march',
        unitId,
        target,
      });
      if (!result.ok) return { unitId, path: null, reason: result.reason };
      const unit = result.state.units.find(
        (entry) => entry.id === unitId && entry.factionId === 'A',
      );
      return {
        unitId,
        path: unit?.path.map((cell) => ({ ...cell })) ?? null,
        reason: null,
      };
    });
  }

  groupMove(
    target: Cell,
    unitIds: readonly string[] = this.selectedUnitIds,
  ): BatchCommandResult {
    return this.dispatchBatch('move', unitIds, target);
  }

  groupMarch(
    target: MarchTarget,
    unitIds: readonly string[] = this.selectedUnitIds,
  ): BatchCommandResult {
    return this.dispatchBatch('march', unitIds, target);
  }

  groupGarrison(
    baseId: string,
    unitIds: readonly string[] = this.selectedUnitIds,
  ): BatchCommandResult {
    return this.dispatchBatch('garrison', unitIds, baseId);
  }

  groupStop(
    unitIds: readonly string[] = this.selectedUnitIds,
  ): BatchCommandResult {
    return this.dispatchBatch('stop', unitIds);
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
          this.state = advanceMatch(this.state);
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
    const previous = this.state;
    const result = this.dispatchCommand(input);
    this.emit(previous);
    return result;
  }

  reset(
    seed: number,
    scenarioId: ScenarioId = this.state.scenarioId,
    rules: RulesMaster = this.state.rules,
  ): void {
    const previous = this.state;
    this.state = createMatch(seed, { scenarioId, rules });
    this.previousTickState = this.state;
    this.history = [];
    this.selectedUnitIds = [];
    this.clock.reset(true);
    this.message = this.contextLost
      ? '盤面復旧待ち · リセット済み'
      : `seed ${seed} · 開始待ち`;
    this.emit(previous);
  }

  select(unitId: string | null): void {
    const previous = this.state;
    this.selectedUnitIds =
      unitId !== null && this.isLivingOwnUnit(unitId) ? [unitId] : [];
    this.emit(previous);
  }

  toggleSelection(unitId: string): void {
    if (!this.isLivingOwnUnit(unitId)) return;
    const previous = this.state;
    this.selectedUnitIds = this.selectedUnitIds.includes(unitId)
      ? this.selectedUnitIds.filter((selected) => selected !== unitId)
      : [...this.selectedUnitIds, unitId];
    this.emit(previous);
  }

  selectAll(): void {
    const previous = this.state;
    this.selectedUnitIds = this.state.units
      .filter((unit) => unit.factionId === 'A' && unit.hp > 0)
      .map((unit) => unit.id);
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

  private get selectedUnitId(): string | null {
    return this.selectedUnitIds[0] ?? null;
  }

  private isLivingOwnUnit(unitId: string): boolean {
    return this.state.units.some(
      (unit) => unit.id === unitId && unit.factionId === 'A' && unit.hp > 0,
    );
  }

  private dispatchBatch(
    type: 'move' | 'stop' | 'march' | 'garrison',
    unitIds: readonly string[],
    target?: Cell | MarchTarget | string,
  ): BatchCommandResult {
    const ids = uniqueSortedIds(unitIds);
    if (ids.length === 0) {
      this.message = '部隊を選択してください';
      this.emit(this.state);
      return { accepted: [], rejected: [] };
    }

    const previous = this.state;
    const accepted: string[] = [];
    const rejected: { unitId: string; reason: RejectCode }[] = [];
    for (const unitId of ids) {
      const input: Command =
        type === 'move'
          ? { type, unitId, target: target as Cell }
          : type === 'march'
            ? { type, unitId, target: target as MarchTarget }
            : type === 'garrison'
              ? { type, unitId, baseId: target as string }
              : { type, unitId };
      const result = this.dispatchCommand(input);
      if (result.ok) accepted.push(unitId);
      else rejected.push({ unitId, reason: result.reason });
    }
    this.message = batchMessage(type, accepted, rejected, this.state, 'A');
    this.emit(previous);
    return { accepted, rejected };
  }

  private dispatchCommand(input: unknown): CommandResult {
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
      : rejectMessage(result.reason, this.state, 'A');
    return result;
  }

  private phaseMessage(): string {
    if (this.state.phase === 'finished')
      return '試合終了 · 結果から再戦できます';
    if (
      this.state.factions.find((faction) => faction.id === 'A')
        ?.eliminatedAtTick !== null
    )
      return this.state.phase === 'paused'
        ? '脱落 · 観戦一時停止中'
        : '脱落 · 観戦中（カメラ操作・一時停止は可能）';
    return this.state.phase === 'running'
      ? '対戦中'
      : this.state.phase === 'paused'
        ? '一時停止中'
        : `seed ${this.state.seed} · 開始待ち`;
  }
  private emit(_previous: MatchState): void {
    this.selectedUnitIds = this.selectedUnitIds.filter((id) =>
      this.isLivingOwnUnit(id),
    );
    if (
      this.state.phase === 'finished' ||
      this.state.factions.find((faction) => faction.id === 'A')
        ?.eliminatedAtTick !== null
    ) {
      this.selectedUnitIds = [];
      this.message = this.phaseMessage();
    }
    this.options.onChange(this.playerSnapshot());
  }
}

export function rejectMessage(
  reason: RejectCode,
  state?: MatchState,
  actor?: FactionId,
): string {
  if (reason === 'UNIT_LIMIT' && state !== undefined && actor !== undefined) {
    const { limit, ownedBases } = getFactionUnitLimit(state, actor);
    return `部隊上限（拠点${ownedBases}で${limit}）`;
  }
  const messages: Record<RejectCode, string> = {
    FACTION_ELIMINATED: '脱落しているため部隊・生産・研究を操作できません',
    INVALID_COMMAND: '命令の形式が正しくありません',
    INVALID_ACTOR: '操作できない陣営です',
    INVALID_PHASE: '今はその操作をできません',
    UNIT_NOT_FOUND: '部隊が見つかりません',
    TARGET_NOT_FOUND: '追跡先が見つからないか視界にありません',
    INVALID_TARGET: '追跡先を指定できません',
    NOT_OWNER: '自軍の部隊を選んでください',
    OUT_OF_BOUNDS: '盤面の外です',
    BLOCKED: '川・山などの地形が通行を妨げています',
    UNREACHABLE: '陸路がつながっていません（渡河設備が必要です）',
    BASE_NOT_FOUND: '拠点が見つかりません',
    JOB_NOT_FOUND: '生産予約が見つかりません',
    INVALID_UNIT_KIND: '兵種が正しくありません',
    RESEARCH_REQUIRED: '必要な兵種解放研究が完了していません',
    PORT_UNAVAILABLE: '自陣の稼働中の港がありません',
    RESEARCH_NOT_FOUND: '研究が見つかりません',
    HQ_UNAVAILABLE: '首都が破壊されているため生産できません',
    INSUFFICIENT_SUPPLY: '補給が不足しています',
    BASE_UPGRADE_MAX: '拠点はすでに最大レベルです',
    BASE_UPGRADE_BUSY: 'この拠点はすでに強化中です',
    BASE_UPGRADE_RESEARCH_REQUIRED: '拠点強化の研究が必要です',
    BASE_UPGRADE_NOT_OWNED: '強化できる自軍所有の稼働拠点がありません',
    UNIT_LIMIT: '部隊上限に達しています',
    QUEUE_FULL: '生産キューの上限に達しています',
    ALREADY_RESEARCHED: '完了済みの研究です',
    PREREQUISITE_MISSING: '必要な前提研究が完了していません',
    RESEARCH_EXCLUDED: '排他関係にある研究を完了済みです',
    INVALID_FACILITY_KIND: '未対応の施設です',
    FACILITY_ANCHOR_UNAVAILABLE:
      '所有する生存拠点・完成渡河設備を選んでください',
    FACILITY_LIMIT: '陣営の施設上限です',
    GARRISON_FULL: 'この拠点の駐留上限です',
    GARRISON_DISABLED: 'この兵種はマスタ設定で駐留・防衛が無効です',
    GARRISON_NOT_OWNED: '自軍所有の拠点だけ駐留できます',
    FACILITY_DUPLICATE: '同じ設置先に同種施設があります',
    FACILITY_SLOTS_FULL: '設置先の施設枠が使用中です',
    FACILITY_NO_CELL: '施設を配置できる隣接セルがありません',
    CROSSING_NOT_FOUND: '渡河予定地が見つかりません',
    CROSSING_TAKEN: 'すでに他陣営が所有しています',
    CROSSING_BUSY: '他陣営が建設中か、別の作業中です',
    CROSSING_NOT_OWNED: '自陣が所有する渡河設備ではありません',
    CROSSING_NOT_ADJACENT: '端点に隣接する部隊が必要です',
    CROSSING_UNIT_RESTRICTED: 'この部隊では建設できません',
    CROSSING_RESEARCH_REQUIRED: '必要な工兵研究が完了していません',
    HQ_PROTECTED: '首都保護期間中のため攻撃・進軍できません',
  };
  return messages[reason];
}

function uniqueSortedIds(unitIds: readonly string[]): string[] {
  return [...new Set(unitIds)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function batchMessage(
  type: 'move' | 'stop' | 'march' | 'garrison',
  accepted: readonly string[],
  rejected: readonly { readonly unitId: string; readonly reason: RejectCode }[],
  state?: MatchState,
  actor?: FactionId,
): string {
  const acceptedLabel =
    type === 'move'
      ? '移動指示'
      : type === 'march'
        ? '追跡/進軍指示'
        : type === 'garrison'
          ? '駐留指示'
          : '停止指示';
  const prefix = `${accepted.length}部隊に${acceptedLabel}`;
  if (rejected.length === 0) return prefix;
  const details = rejected
    .map(
      ({ unitId, reason }) =>
        `${unitId} ${rejectMessage(reason, state, actor)}`,
    )
    .join('、');
  return `${prefix} / ${rejected.length}部隊は拒否: ${details}`;
}
