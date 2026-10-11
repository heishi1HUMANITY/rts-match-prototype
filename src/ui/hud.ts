import type { PlayerSnapshot } from '../runtime/controller';
import {
  BASE_STATS,
  RESEARCH_DEFINITIONS,
  UNIT_STATS,
} from '../simulation/config';
import type { FactionView, ResearchId, UnitKind } from '../simulation/types';

export type HudPanel = 'production' | 'research' | 'base' | null;
export interface HudElements {
  readonly root: HTMLElement;
  readonly board: HTMLElement;
  readonly seed: HTMLInputElement;
  readonly scenario: HTMLSelectElement;
  readonly start: HTMLButtonElement;
  readonly pause: HTMLButtonElement;
  readonly resume: HTMLButtonElement;
  readonly reset: HTMLButtonElement;
  readonly applySeed: HTMLButtonElement;
  readonly stop: HTMLButtonElement;
  readonly clear: HTMLButtonElement;
  readonly camera: HTMLButtonElement;
  readonly units: HTMLElement;
  readonly status: HTMLElement;
  readonly download: HTMLButtonElement;
  panel: HudPanel;
  selectedBaseId: string;
}
const kindName = (kind: UnitKind): string =>
  kind === 'assault' ? '強襲' : '偵察';
const researchName = (id: ResearchId): string =>
  id === 'firepower-1' ? '戦力研究 I' : '戦力研究 II';
const amount = (n: number): string =>
  Math.floor(n / 100).toLocaleString('ja-JP');
const seconds = (ticks: number): string => `${(ticks / 10).toFixed(1)}秒`;

export function createHud(app: HTMLElement): HudElements {
  app.className = 'game-shell g2-shell';
  app.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">◆</span><div><strong>RTS MATCH</strong><small>G2 · 戦略ループ</small></div></div>
      <div class="faction-legend ticket-strip" aria-label="公開チケット"><span class="legend-a"><b>◆ A</b><strong data-ticket="A"></strong></span><span class="legend-b"><b>■ B</b><strong data-ticket="B"></strong></span><span class="legend-c"><b>⬡ C</b><strong data-ticket="C"></strong></span></div>
      <div class="top-actions"><button data-action="start" class="primary">開始</button><button data-action="pause">一時停止</button><button data-action="resume" class="primary">再開</button><button data-action="reset">リセット</button></div>
      <details class="test-settings"><summary>検査設定</summary><div class="settings-popover">
        <label>seed <input data-seed type="number" min="0" max="4294967295" step="1" value="42" aria-label="試合seed"></label>
        <label>シナリオ <select data-scenario aria-label="検査シナリオ"><option value="standard">通常設定</option><option value="g2-capture">検査：制圧</option><option value="g2-combat">検査：相互交戦</option><option value="g2-economy">検査：生産・研究</option></select></label>
        <button data-action="apply-seed">適用してリセット</button><button data-action="download">全情報を含む診断JSONを保存</button>
        <p>B/Cの自動進軍・勝敗は未実装。視界内では自動交戦します。検査設定は初期配置・資源のみ変更します。</p>
      </div></details>
    </header>
    <main class="board-frame" aria-label="盤面"><div class="board-host"></div><div class="board-hint">部隊をドラッグして移動 · 地面ドラッグでカメラ · 中立拠点のそばに3秒で制圧</div><span class="scenario-badge"></span>
      <aside class="strategy-panel" aria-label="戦略操作" hidden><div class="panel-heading"><strong data-panel-title></strong><button data-action="close-panel">閉じる ×</button></div><p class="panel-live"></p>
        <section data-panel="production" hidden><p class="production-summary"></p>
          <div class="action-card"><button data-produce="assault">強襲を生産</button><small>補給120 · 12秒 · HP100 · 射程2</small><span data-production-reason="assault"></span></div>
          <div class="action-card"><button data-produce="scout">偵察を生産</button><small>補給60 · 6秒 · HP60 · 視界8</small><span data-production-reason="scout"></span></div>
          <h3>生産キュー</h3><div class="production-queue"></div>
        </section>
        <section data-panel="research" hidden><p>効果はこの試合だけ。研究中も試合は進みます。</p>
          <div class="action-card"><button data-research="firepower-1">戦力研究 I</button><small>研究60 · 10秒 · 全部隊の攻撃 +1</small><progress data-research-progress="firepower-1" max="100" value="0"></progress><span data-research-reason="firepower-1"></span></div>
          <div class="action-card"><button data-research="firepower-2">戦力研究 II</button><small>研究90 · 15秒 · さらに攻撃 +1 · 前提 I</small><progress data-research-progress="firepower-2" max="100" value="0"></progress><span data-research-reason="firepower-2"></span></div>
        </section>
        <section data-panel="base" hidden><label>拠点 <select data-base-select aria-label="表示する拠点"></select></label><div class="base-detail"></div><p>中立拠点は半径1に自軍だけが3秒いると制圧。敵所有なら先にHPを0にします。</p><button data-action="production">生産を開く</button></section>
      </aside>
    </main>
    <footer class="bottom-bar"><div class="resource-strip"><strong data-resources></strong><span data-income></span><span data-research-status></span><div class="bottom-actions"><button data-action="production">生産</button><button data-action="research">研究</button><button data-action="bases">拠点</button><button data-action="stop">部隊停止</button><button data-action="clear">選択解除</button><button data-action="camera">カメラ</button></div></div>
      <div class="unit-strip"><div class="selection-summary"><strong class="selection-name"></strong><span class="selection-instruction"></span></div><div class="unit-list" aria-label="自軍部隊"></div><div class="status-stack"><span class="status" role="status" aria-live="polite"></span><span class="tick-readout"></span></div></div>
    </footer>`;
  const find = <T extends Element>(selector: string): T =>
    app.querySelector<T>(selector)!;
  const action = (id: string): HTMLButtonElement =>
    find(`[data-action="${id}"]`);
  return {
    root: app,
    board: find('.board-host'),
    seed: find('[data-seed]'),
    scenario: find('[data-scenario]'),
    start: action('start'),
    pause: action('pause'),
    resume: action('resume'),
    reset: action('reset'),
    applySeed: action('apply-seed'),
    stop: action('stop'),
    clear: action('clear'),
    camera: action('camera'),
    download: action('download'),
    units: find('.unit-list'),
    status: find('.status'),
    panel: null,
    selectedBaseId: 'HQ-A',
  };
}
export function setHudPanel(
  elements: HudElements,
  panel: HudPanel,
  baseId?: string,
): void {
  elements.panel = panel;
  if (baseId !== undefined) elements.selectedBaseId = baseId;
  const host = elements.root.querySelector<HTMLElement>('.strategy-panel')!;
  host.hidden = panel === null;
  for (const section of host.querySelectorAll<HTMLElement>('[data-panel]'))
    section.hidden = section.dataset.panel !== panel;
  host.querySelector<HTMLElement>('[data-panel-title]')!.textContent =
    panel === 'production'
      ? '部隊生産'
      : panel === 'research'
        ? '戦力研究'
        : '拠点情報';
  for (const name of ['production', 'research', 'bases'])
    elements.root
      .querySelector(`[data-action="${name}"]`)
      ?.setAttribute(
        'aria-expanded',
        String(panel === (name === 'bases' ? 'base' : name)),
      );
}
function productionReason(view: FactionView, kind: UnitKind): string | null {
  if (view.phase !== 'running') return '開始・再開後に操作できます';
  const hq = view.bases.find(
    (base) => base.id === `HQ-${view.viewerFactionId}`,
  );
  if (hq?.visibility !== 'owned' || hq.hp <= 0)
    return '首都が破壊されているため生産できません';
  if (view.ownUnits.length + view.ownFaction.productionJobs.length >= 6)
    return '部隊上限6（予約を含む）';
  if (view.ownFaction.productionJobs.length >= 3) return '予約は3件までです';
  return view.ownFaction.supplyCenti < UNIT_STATS[kind].costCenti
    ? '補給が不足しています'
    : null;
}
export function updateHud(
  elements: HudElements,
  snapshot: PlayerSnapshot,
): void {
  const view = snapshot.view,
    own = view.ownFaction;
  const text = (selector: string, value: string): void => {
    elements.root.querySelector<HTMLElement>(selector)!.textContent = value;
  };
  if (elements.seed.dataset.syncedSeed !== String(view.seed)) {
    elements.seed.value = String(view.seed);
    elements.seed.dataset.syncedSeed = String(view.seed);
  }
  if (elements.scenario.dataset.syncedScenario !== view.scenarioId) {
    elements.scenario.value = view.scenarioId;
    elements.scenario.dataset.syncedScenario = view.scenarioId;
  }
  elements.start.hidden = view.phase !== 'ready' || snapshot.contextLost;
  elements.pause.hidden = view.phase !== 'running';
  elements.resume.hidden = view.phase !== 'paused' || snapshot.contextLost;
  elements.stop.disabled =
    view.phase !== 'running' || snapshot.selectedUnitId === null;
  elements.clear.disabled = snapshot.selectedUnitId === null;
  elements.status.textContent = snapshot.message;
  text('.tick-readout', `TICK ${view.tick} · ${view.phase.toUpperCase()}`);
  for (const id of ['A', 'B', 'C'] as const)
    text(`[data-ticket="${id}"]`, amount(view.ticketsCenti[id]));
  text(
    '.scenario-badge',
    view.scenarioId === 'standard'
      ? '通常設定 · B/Cは固定'
      : `検査専用：${view.scenarioId} · B/Cは固定`,
  );
  text(
    '[data-resources]',
    `補給 ${amount(own.supplyCenti)} / 研究 ${amount(own.researchCenti)}`,
  );
  const bases = view.bases.filter(
    (base) => base.visibility === 'owned' && base.hp > 0,
  );
  const income = bases.reduce(
      (n, base) => n + BASE_STATS[base.kind].supplyIncomeCentiPerTick,
      0,
    ),
    rp = bases.reduce(
      (n, base) => n + BASE_STATS[base.kind].researchIncomeCentiPerTick,
      0,
    ),
    upkeep = view.ownUnits.reduce(
      (n, unit) => n + UNIT_STATS[unit.kind].upkeepCenti,
      0,
    );
  text(
    '[data-income]',
    `補給収支 ${((income - upkeep) / 10).toFixed(2)}/秒 · 研究 +${(rp / 10).toFixed(1)}/秒`,
  );
  text(
    '[data-research-status]',
    own.activeResearch
      ? `${researchName(own.activeResearch.researchId)} 残り${seconds(own.activeResearch.remainingTicks)}`
      : `研究完了 ${own.completedResearchIds.length}/2`,
  );
  const selected = view.ownUnits.find(
    (unit) => unit.id === snapshot.selectedUnitId,
  );
  text(
    '.selection-name',
    selected
      ? `◆ ${selected.id} ${kindName(selected.kind)} HP${selected.hp}/${selected.maxHp}`
      : '部隊未選択',
  );
  text(
    '.selection-instruction',
    selected
      ? selected.path.length
        ? '移動中 · ドラッグで行先変更'
        : 'ドラッグで目的地を指定'
      : 'A部隊をドラッグして移動',
  );
  const expected = view.ownUnits.map((unit) => unit.id).join('|');
  if (elements.units.dataset.ids !== expected) {
    elements.units.dataset.ids = expected;
    elements.units.replaceChildren(
      ...view.ownUnits.map((unit) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.dataset.unit = unit.id;
        node.className = 'unit-card';
        const title = document.createElement('strong');
        title.textContent = `◆ ${unit.id}`;
        const label = document.createElement('small');
        node.append(title, label);
        return node;
      }),
    );
  }
  for (const node of elements.units.querySelectorAll<HTMLButtonElement>(
    '[data-unit]',
  )) {
    const unit = view.ownUnits.find((item) => item.id === node.dataset.unit)!;
    const selected = unit.id === snapshot.selectedUnitId;
    node.classList.toggle('selected', selected);
    node.setAttribute('aria-pressed', String(selected));
    node.querySelector('small')!.textContent =
      `${kindName(unit.kind)} ${unit.hp}/${unit.maxHp}`;
  }
  text(
    '.panel-live',
    `${view.phase === 'running' ? '● 進行中' : '■ 停止中'} · ${(view.tick / 10).toFixed(1)}秒 · 補給${amount(own.supplyCenti)} / 研究${amount(own.researchCenti)}`,
  );
  text(
    '.production-summary',
    `部隊 ${view.ownUnits.length}＋予約 ${own.productionJobs.length} / 上限6 · 首都で直列生産`,
  );
  for (const kind of ['assault', 'scout'] as const) {
    const reason = productionReason(view, kind);
    elements.root.querySelector<HTMLButtonElement>(
      `[data-produce="${kind}"]`,
    )!.disabled = reason !== null || snapshot.contextLost;
    text(`[data-production-reason="${kind}"]`, reason ?? '生産できます');
  }
  const queue = elements.root.querySelector<HTMLElement>('.production-queue')!,
    queueKey = own.productionJobs.map((job) => job.id).join('|');
  if (queue.dataset.ids !== queueKey) {
    queue.dataset.ids = queueKey;
    queue.replaceChildren(
      ...own.productionJobs.map((job) => {
        const row = document.createElement('div');
        row.className = 'queue-row';
        row.dataset.job = job.id;
        const label = document.createElement('span');
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.dataset.cancelJob = job.id;
        cancel.textContent = '取消・返金';
        row.append(label, cancel);
        return row;
      }),
    );
    if (!own.productionJobs.length) queue.textContent = '生産予約はありません';
  }
  for (const job of own.productionJobs) {
    const row = queue.querySelector<HTMLElement>(`[data-job="${job.id}"]`)!;
    row.querySelector('span')!.textContent =
      `${kindName(job.unitKind)} · ${job.status === 'active' ? `生産中 ${seconds(job.remainingTicks)}` : '待機中'}`;
    row.querySelector('button')!.disabled =
      view.phase !== 'running' || snapshot.contextLost;
  }
  for (const id of ['firepower-1', 'firepower-2'] as const) {
    const def = RESEARCH_DEFINITIONS[id],
      done = own.completedResearchIds.includes(id),
      active = own.activeResearch?.researchId === id;
    const reason = done
      ? '完了 · 攻撃+1'
      : active
        ? `研究中 · 残り${seconds(own.activeResearch!.remainingTicks)}`
        : view.phase !== 'running'
          ? '開始・再開後に操作できます'
          : own.activeResearch !== null
            ? '別の研究が進行中です'
            : def.prerequisite !== null &&
                !own.completedResearchIds.includes(def.prerequisite)
              ? '前提：戦力研究Iが必要です'
              : own.researchCenti < def.costCenti
                ? '研究ポイントが不足しています'
                : null;
    elements.root.querySelector<HTMLButtonElement>(
      `[data-research="${id}"]`,
    )!.disabled = reason !== null || snapshot.contextLost;
    text(`[data-research-reason="${id}"]`, reason ?? '研究できます');
    elements.root.querySelector<HTMLProgressElement>(
      `[data-research-progress="${id}"]`,
    )!.value = done
      ? 100
      : active
        ? 100 * (1 - own.activeResearch!.remainingTicks / def.durationTicks)
        : 0;
  }
  const selector =
    elements.root.querySelector<HTMLSelectElement>('[data-base-select]')!;
  if (!selector.options.length)
    for (const base of view.bases) {
      const option = document.createElement('option');
      option.value = base.id;
      option.textContent = `${base.kind === 'hq' ? '首都' : '拠点'} ${base.id}`;
      selector.append(option);
    }
  selector.value = elements.selectedBaseId;
  const base = view.bases.find((base) => base.id === elements.selectedBaseId);
  let detail = '拠点を選んでください';
  if (base) {
    const location = `${base.id} (${base.cell.x},${base.cell.y})`;
    if (base.visibility === 'unknown')
      detail = `${location}\n未観測：所有・HPは不明`;
    else if (base.visibility === 'remembered')
      detail = `${location}\n最終観測 TICK ${base.seenTick}：${base.owner ?? '中立'} / HP${base.hp}\n${base.selfReportedLost ? '自軍の所有喪失を確認。現在の所有者は不明。' : '現在の状態は不明です。'}`;
    else
      detail = `${location}\n所有：${base.owner ?? '中立'} · HP${base.hp}/${base.maxHp}\n${base.captureCandidate ? `${base.captureCandidate} 制圧 ${base.captureTicks}/30` : base.hp > 0 ? '稼働中' : base.kind === 'hq' ? '破壊済み・再建なし' : '中立・制圧可能'}${base.visibility === 'owned' && base.hp > 0 ? `\n補給 +${BASE_STATS[base.kind].supplyIncomeCentiPerTick / 10}/秒 · 研究 +${BASE_STATS[base.kind].researchIncomeCentiPerTick / 10}/秒` : ''}`;
  }
  text('.base-detail', detail);
}
