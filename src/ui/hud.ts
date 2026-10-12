import type { PlayerSnapshot } from '../runtime/controller';
import { marchOrderLabel } from './march-target';
import {
  BASE_STATS,
  BASE_RESEARCH_INCOME_CENTI_PER_TICK,
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
  multiSelect: boolean;
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
      <div class="brand"><span class="brand-mark">◆</span><div><strong>RTS MATCH</strong><small>F02 · 対象への進軍</small></div></div>
      <div class="faction-legend ticket-strip" aria-label="公開チケット"><span class="legend-a"><b>◆ A</b><strong data-ticket="A"></strong></span><span class="legend-b"><b>■ B</b><strong data-ticket="B"></strong></span><span class="legend-c"><b>⬡ C</b><strong data-ticket="C"></strong></span></div>
      <div class="top-actions"><button data-action="start" class="primary">開始</button><button data-action="pause">一時停止</button><button data-action="resume" class="primary">再開</button><button data-action="reset">リセット</button></div>
      <details class="test-settings"><summary>検査設定</summary><div class="settings-popover">
        <label>seed <input data-seed type="number" min="0" max="4294967295" step="1" value="42" aria-label="試合seed"></label>
        <label>シナリオ <select data-scenario aria-label="検査シナリオ"><option value="standard">通常設定</option><option value="f02-pursuit">検査：移動する敵の追跡</option><option value="g2-capture">検査：制圧</option><option value="g2-combat">検査：相互交戦</option><option value="g2-economy">検査：生産・研究（NPC停止）</option><option value="g3-timeout">検査：20秒で時間切れ</option><option value="g3-elimination">検査：相手2軍脱落</option><option value="g3-mutual">検査：同時全滅</option><option value="g3-spectate">検査：自軍脱落と観戦</option></select></label>
        <button data-action="apply-seed">適用してリセット</button><button data-action="download">全情報を含む診断JSONを保存</button>
        <p>通常設定はNPC2陣営・5分制。チケット0、または首都と全部隊を失うと脱落。G2検査のみNPC停止。短時間検査は初期チケットと制限時間を変更します。</p>
      </div></details>
    </header>
    <main class="board-frame" aria-label="盤面"><div class="board-host"></div><div class="board-hint">敵へドロップで追跡 · 拠点へドロップで進軍 · 地面ドラッグでカメラ</div><span class="scenario-badge"></span>
      <aside class="strategy-panel" aria-label="戦略操作" hidden><div class="panel-heading"><strong data-panel-title></strong><button data-action="close-panel">閉じる ×</button></div><p class="panel-live"></p>
        <section data-panel="production" hidden><p class="production-summary"></p>
          <div class="action-card"><button data-produce="assault">強襲を生産</button><small>補給120 · 12秒 · HP100 · 射程2</small><span data-production-reason="assault"></span></div>
          <div class="action-card"><button data-produce="scout">偵察を生産</button><small>補給60 · 6秒 · HP60 · 視界8</small><span data-production-reason="scout"></span></div>
          <h3>生産キュー</h3><div class="production-queue"></div>
        </section>
        <section data-panel="research" hidden><button data-action="bank-research">指定解除・バンクする</button><p>選択中の研究にポイントを充填。必要量で完了。指定しない間はバンクします。切替・解除でも充填済みポイントは残ります。</p>
          <div class="action-card"><button data-research="firepower-1">戦力研究 I</button><small>必要60ポイント · 全部隊の攻撃 +1</small><progress data-research-progress="firepower-1" max="100" value="0"></progress><span data-research-reason="firepower-1"></span></div>
          <div class="action-card"><button data-research="firepower-2">戦力研究 II</button><small>必要90ポイント · さらに攻撃 +1 · 前提 I</small><progress data-research-progress="firepower-2" max="100" value="0"></progress><span data-research-reason="firepower-2"></span></div>
        </section>
        <section data-panel="base" hidden><label>拠点 <select data-base-select aria-label="表示する拠点"></select></label><div class="base-detail"></div><p>中立拠点は半径1に自軍だけが3秒いると制圧。敵所有なら先にHPを0にします。</p><button data-action="production">生産を開く</button></section>
      </aside>
    </main>
    <footer class="bottom-bar"><div class="resource-strip"><strong data-resources></strong><span data-income></span><span data-research-status></span><div class="bottom-actions"><button data-action="production">生産</button><button data-action="research">研究</button><button data-action="bases">拠点</button><button data-action="stop">部隊停止</button><button data-action="clear">選択解除</button><button data-action="camera">カメラ</button></div></div>
      <div class="unit-strip"><div class="selection-summary"><strong class="selection-name"></strong><span class="selection-instruction"></span></div><div class="selection-controls" aria-label="部隊選択"><button type="button" data-action="multi-select" aria-pressed="false">複数選択</button><button type="button" data-action="select-all">すべて選択</button></div><div class="unit-list" aria-label="自軍部隊"></div><div class="status-stack"><span class="status" role="status" aria-live="polite"></span><span class="tick-readout"></span></div></div>
    </footer>
    <dialog class="result-dialog" aria-labelledby="result-title"><h1 id="result-title">試合結果</h1><p data-result-reason></p><p data-result-rule>生存陣営をチケット順、脱落陣営を脱落が遅い順に順位付け。同点・同時脱落は同順位です。</p><ol class="result-standings" aria-label="最終順位"></ol><div class="result-actions"><button data-action="replay" class="primary">同じ設定でもう一戦</button><button data-action="reset">設定に戻る</button><button data-action="download">診断JSONを保存</button></div></dialog>`;
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
    multiSelect: false,
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
  if (view.ownFaction.eliminatedAtTick !== null) return '脱落 · 観戦中';
  if (view.phase === 'finished') return '試合は終了しました';
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
  const selectedIds = new Set(snapshot.selectedUnitIds);
  const selectedUnits = view.ownUnits.filter((unit) =>
    selectedIds.has(unit.id),
  );
  const canSelect =
    view.phase !== 'finished' &&
    own.eliminatedAtTick === null &&
    !snapshot.contextLost;
  const multiSelectButton = elements.root.querySelector<HTMLButtonElement>(
    '[data-action="multi-select"]',
  )!;
  multiSelectButton.disabled = !canSelect;
  multiSelectButton.setAttribute('aria-pressed', String(elements.multiSelect));
  elements.root.querySelector<HTMLButtonElement>(
    '[data-action="select-all"]',
  )!.disabled = !canSelect || view.ownUnits.length === 0;
  elements.stop.disabled =
    !canSelect || view.phase !== 'running' || selectedUnits.length === 0;
  elements.stop.textContent =
    selectedUnits.length > 1 ? `${selectedUnits.length}部隊を停止` : '部隊停止';
  elements.clear.disabled = !canSelect || selectedUnits.length === 0;
  elements.status.textContent = snapshot.message;
  text('.tick-readout', `TICK ${view.tick} · ${view.phase.toUpperCase()}`);
  for (const id of ['A', 'B', 'C'] as const)
    text(
      `[data-ticket="${id}"]`,
      `${amount(view.ticketsCenti[id])}${view.publicEliminations[id].eliminatedAtTick !== null ? ' · 脱落' : ''}`,
    );
  text(
    '.scenario-badge',
    `${view.scenarioId === 'standard' ? '通常設定 · NPC2陣営' : `検査：${view.scenarioId}${view.scenarioId.startsWith('g2-') || view.scenarioId === 'f02-pursuit' ? ' · NPC停止' : ''}`} · 残り ${Math.floor(Math.max(0, view.timeLimitTicks - view.tick) / 600)}:${String(Math.floor(Math.max(0, view.timeLimitTicks - view.tick) / 10) % 60).padStart(2, '0')}`,
  );
  text(
    '[data-resources]',
    `補給 ${amount(own.supplyCenti)} / 研究バンク ${(own.researchCenti / 100).toFixed(1)}`,
  );
  const bases = view.bases.filter(
    (base) => base.visibility === 'owned' && base.hp > 0,
  );
  const income = bases.reduce(
      (n, base) => n + BASE_STATS[base.kind].supplyIncomeCentiPerTick,
      0,
    ),
    rp =
      BASE_RESEARCH_INCOME_CENTI_PER_TICK +
      bases.reduce(
        (n, base) => n + BASE_STATS[base.kind].researchIncomeCentiPerTick,
        0,
      ),
    upkeep = view.ownUnits.reduce(
      (n, unit) => n + UNIT_STATS[unit.kind].upkeepCenti,
      0,
    );
  text(
    '[data-income]',
    own.eliminatedAtTick !== null || view.phase === 'finished'
      ? '収入停止'
      : `補給収支 ${((income - upkeep) / 10).toFixed(2)}/秒 · 研究 +${(rp / 10).toFixed(1)}/秒`,
  );
  text(
    '[data-research-status]',
    own.eliminatedAtTick !== null
      ? '脱落 · 研究停止'
      : own.activeResearch
        ? `${researchName(own.activeResearch.researchId)} 充填 ${(own.researchProgressCenti[own.activeResearch.researchId] / 100).toFixed(1)}pt`
        : `バンク中 · 研究完了 ${own.completedResearchIds.length}/2`,
  );
  const selected = selectedUnits[0];
  text(
    '.selection-name',
    selectedUnits.length > 1
      ? `◆ ${selectedUnits.length}部隊を選択`
      : selected
        ? `◆ ${selected.id} ${kindName(selected.kind)} HP${selected.hp}/${selected.maxHp}`
        : '部隊未選択',
  );
  let selectionInstruction: string;
  if (own.eliminatedAtTick !== null)
    selectionInstruction = '脱落 · 探索済み盤面で観戦できます';
  else if (view.phase === 'finished') selectionInstruction = '試合終了';
  else if (view.phase === 'paused')
    selectionInstruction = '一時停止中 · 再開後に移動できます';
  else if (view.phase === 'ready')
    selectionInstruction = '開始後にドラッグ・地面タップで移動';
  else if (selectedUnits.length > 1)
    selectionInstruction = 'まとめてドラッグ、または地面タップで移動';
  else if (selected)
    selectionInstruction = selected.path.length
      ? `移動中 · ${elements.multiSelect ? 'タップで選択を追加' : 'ドラッグで行先変更'}`
      : `ドラッグで移動${elements.multiSelect ? ' · タップで追加/解除' : ''}`;
  else
    selectionInstruction = elements.multiSelect
      ? '複数選択中 · 自軍をタップで追加、すべて選択も可'
      : '自軍をドラッグで移動 · 複数選択も可';
  const orderLabels = selectedUnits.map(marchOrderLabel).filter(Boolean);
  if (view.phase === 'running' && orderLabels.length > 0)
    selectionInstruction =
      selectedUnits.length === 1
        ? orderLabels[0]!
        : `進軍指定 ${orderLabels.length}/${selectedUnits.length}部隊 · ドラッグで変更`;
  text('.selection-instruction', selectionInstruction);
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
    const selected = selectedIds.has(unit.id);
    node.classList.toggle('selected', selected);
    node.setAttribute('aria-pressed', String(selected));
    node.querySelector('small')!.textContent =
      `${kindName(unit.kind)} ${unit.hp}/${unit.maxHp}${unit.marchOrder ? ' →' : ''}`;
    const orderLabel = marchOrderLabel(unit);
    node.title = orderLabel;
    node.setAttribute(
      'aria-label',
      `${unit.id} ${kindName(unit.kind)} HP${unit.hp}/${unit.maxHp}${orderLabel ? ` ${orderLabel}` : ''}`,
    );
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
  elements.root.querySelector<HTMLButtonElement>(
    '[data-action="bank-research"]',
  )!.disabled =
    view.phase !== 'running' ||
    snapshot.contextLost ||
    own.activeResearch === null ||
    own.eliminatedAtTick !== null;
  for (const id of ['firepower-1', 'firepower-2'] as const) {
    const def = RESEARCH_DEFINITIONS[id];
    const done = own.completedResearchIds.includes(id);
    const active = own.activeResearch?.researchId === id;
    const progress = own.researchProgressCenti[id];
    const reason =
      own.eliminatedAtTick !== null
        ? '脱落 · 研究停止'
        : done
          ? '完了 · 攻撃+1'
          : view.phase !== 'running'
            ? '開始・再開後に選択できます'
            : def.prerequisite !== null &&
                !own.completedResearchIds.includes(def.prerequisite)
              ? '前提：戦力研究Iが必要です'
              : null;
    const button = elements.root.querySelector<HTMLButtonElement>(
      `[data-research="${id}"]`,
    )!;
    button.disabled = reason !== null || snapshot.contextLost;
    button.setAttribute('aria-pressed', String(active));
    button.textContent = `${researchName(id)}${done ? ' · 完了' : active ? ' · 選択中' : 'を選択'}`;
    text(
      `[data-research-reason="${id}"]`,
      reason ??
        `${active ? '充填中' : progress > 0 ? '進捗保持' : '選択可能'} · ${(progress / 100).toFixed(1)} / ${def.costCenti / 100}pt`,
    );
    const bar = elements.root.querySelector<HTMLProgressElement>(
      `[data-research-progress="${id}"]`,
    )!;
    bar.value = (100 * progress) / def.costCenti;
    bar.setAttribute('aria-label', `${researchName(id)}の充填率`);
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
  const dialog =
    elements.root.querySelector<HTMLDialogElement>('.result-dialog')!;
  if (view.result !== null) {
    setHudPanel(elements, null);
    const result = view.result;
    const playerStanding = result.standings.find(
      (standing) => standing.factionId === view.viewerFactionId,
    )!;
    const tiedFirst =
      result.standings.filter((standing) => standing.rank === 1).length > 1;
    text(
      '#result-title',
      result.reason === 'mutual-elimination'
        ? '引き分け · 試合結果'
        : playerStanding.rank === 1
          ? `${tiedFirst ? '同率1位' : '勝利'} · 試合結果`
          : `敗北 · ${playerStanding.rank}位`,
    );
    text(
      '[data-result-reason]',
      `${result.reason === 'time-limit' ? '制限時間に到達' : result.reason === 'mutual-elimination' ? '全陣営が脱落 · 引き分け' : '最後の1陣営が生存'} · ${(result.endedAtTick / 10).toFixed(1)}秒`,
    );
    const key = JSON.stringify(result);
    const list =
      elements.root.querySelector<HTMLOListElement>('.result-standings')!;
    if (list.dataset.result !== key) {
      list.dataset.result = key;
      list.replaceChildren(
        ...result.standings.map((standing) => {
          const row = document.createElement('li');
          const tied =
            result.standings.filter((entry) => entry.rank === standing.rank)
              .length > 1;
          const symbol =
            standing.factionId === 'A'
              ? '◆'
              : standing.factionId === 'B'
                ? '■'
                : '⬡';
          row.className = `legend-${standing.factionId.toLowerCase()}`;
          row.textContent = `${tied ? '同率' : ''}${standing.rank}位 · ${symbol} ${standing.factionId}${standing.factionId === 'A' ? '（あなた）' : '（NPC）'} · チケット ${amount(standing.ticketsCenti)} · ${standing.eliminatedAtTick === null ? '生存' : `${(standing.eliminatedAtTick / 10).toFixed(1)}秒に脱落（${standing.eliminationReason === 'tickets' ? 'チケット0' : '首都・全部隊喪失'}）`}`;
          return row;
        }),
      );
    }
    if (!dialog.open) {
      dialog.showModal();
      dialog
        .querySelector<HTMLButtonElement>('[data-action="replay"]')!
        .focus();
    }
  } else if (dialog.open) {
    dialog.close();
    elements.start.focus();
  }
}
