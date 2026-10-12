import type { PlayerSnapshot } from '../runtime/controller';
import { marchOrderLabel } from './march-target';
import type {
  BaseOwnerId,
  FactionView,
  ResearchId,
  UnitKind,
} from '../simulation/types';
import { crossingResearchComplete } from '../simulation/crossings';
import { researchEffectValue, isUnitUnlocked } from '../simulation/research';

export type HudPanel = 'production' | 'research' | 'base' | 'crossings' | null;
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
const UNIT_KINDS: readonly UnitKind[] = [
  'assault',
  'scout',
  'artillery',
  'antiAir',
  'helicopter',
  'patrolBoat',
];
const kindName = (kind: UnitKind): string =>
  ({
    assault: '強襲',
    scout: '偵察',
    artillery: '自走砲',
    antiAir: '対空車両',
    helicopter: '攻撃ヘリ',
    patrolBoat: '哨戒艇',
  })[kind];
const kindGlyph = (kind: UnitKind): string =>
  ({
    assault: '強',
    scout: '偵',
    artillery: '砲',
    antiAir: '空',
    helicopter: 'ヘ',
    patrolBoat: '艇',
  })[kind];
const baseKindName = (kind: FactionView['bases'][number]['kind']): string =>
  kind === 'hq'
    ? '首都'
    : kind === 'medium'
      ? '中拠点'
      : kind === 'large'
        ? '大拠点'
        : '小拠点';
const baseOwnerName = (owner: BaseOwnerId | null): string =>
  owner === 'local' ? '● 現地勢力' : (owner ?? '中立');
const researchName = (id: ResearchId, view?: FactionView): string =>
  ({
    'firepower-1': '戦力研究 I',
    'firepower-2': '戦力研究 II',
    'bridge-2': '架橋 II',
    'bridge-3': '架橋 III',
    'ropeway-1': '索道 I',
    'ropeway-2': '索道 II',
    'supply-lines-1': '供給路 I',
    'maintenance-1': '維持効率 I',
    'survey-1': '測量 I',
    'survey-2': '広域観測 II',
    'artillery-1': '自走砲',
    'air-defense-1': '対空車両',
    'aircraft-1': '攻撃ヘリ',
    'naval-1': '哨戒艇',
  })[id] ??
  (view?.rules.research.definitions[id]
    ? `${({ power: '戦力', logistics: '兵站', information: '情報', engineering: '工兵' } as const)[view.rules.research.definitions[id].domain]} ${view.rules.research.definitions[id].stage}`
    : id);
const effectLabel = (effect: {
  id: string;
  value: number;
  crossingTier?: string;
  unitKind?: string;
}): string => {
  switch (effect.id) {
    case 'damage-bonus':
      return `攻撃 +${effect.value}`;
    case 'vision-bonus':
      return `視界 +${effect.value}`;
    case 'supply-income-bonus':
      return `拠点補給収入 +${effect.value} centi/tick`;
    case 'upkeep-reduction':
      return `維持費 -${effect.value} centi/tick/部隊`;
    case 'crossing-unlock':
      return `${effect.crossingTier ? crossingName(effect.crossingTier) : '渡河'}を解放`;
    case 'unit-unlock':
      return `${effect.unitKind ? kindName(effect.unitKind as UnitKind) : '兵種'}を解放`;
    default:
      return '未対応の効果';
  }
};
const crossingName = (tier: string): string =>
  tier.startsWith('bridge') ? `橋 ${tier.slice(-1)}` : `索道 ${tier.slice(-1)}`;
const amount = (n: number): string =>
  Math.floor(n / 100).toLocaleString('ja-JP');
const seconds = (ticks: number): string => `${(ticks / 10).toFixed(1)}秒`;

export function createHud(app: HTMLElement): HudElements {
  app.className = 'game-shell g2-shell';
  app.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark">◆</span><div><strong>RTS MATCH</strong><small>1v1v1 RTS</small></div></div>
      <div class="faction-legend ticket-strip" aria-label="公開チケット"><span class="legend-a"><b>◆ A</b><strong data-ticket="A"></strong></span><span class="legend-b"><b>■ B</b><strong data-ticket="B"></strong></span><span class="legend-c"><b>⬡ C</b><strong data-ticket="C"></strong></span><span data-local-status aria-live="polite" style="max-width:230px;color:#59636c;font:600 9px/1.2 system-ui,sans-serif;white-space:normal"></span></div>
      <div class="top-actions"><button data-action="start" class="primary">開始</button><button data-action="pause">一時停止</button><button data-action="resume" class="primary">再開</button><button data-action="reset">リセット</button><button data-action="master">マスタ</button></div>
      <details class="test-settings"><summary>検査設定</summary><div class="settings-popover">
      <label>seed <input data-seed type="number" min="0" max="4294967295" step="1" value="42" aria-label="試合seed"></label>
        <label>シナリオ <select data-scenario aria-label="検査シナリオ"><option value="standard">通常設定</option><option value="f08-unit-domains">検査：6兵種・陸空水</option><option value="f06-local-faction">検査：現地勢力</option><option value="f05-neutral-defense">検査：中立守備・制圧</option><option value="f04-crossing">検査：橋の建設</option><option value="f02-pursuit">検査：移動する敵の追跡</option><option value="g2-capture">検査：制圧</option><option value="g2-combat">検査：相互交戦</option><option value="g2-economy">検査：生産・研究（NPC停止）</option><option value="g3-timeout">検査：20秒で時間切れ</option><option value="g3-elimination">検査：相手2軍脱落</option><option value="g3-mutual">検査：同時全滅</option><option value="g3-spectate">検査：自軍脱落と観戦</option></select></label>
        <button data-action="apply-seed">適用してリセット</button><button data-action="download">全情報を含む診断JSONを保存</button>
        <p>通常設定はNPC2陣営・5分制。チケット0、または首都と全部隊を失うと脱落。G2検査のみNPC停止。現地勢力検査はA/B/Cの順位へ加わらない独立勢力を表示します。短時間検査は初期チケットと制限時間を変更します。</p>
      </div></details>
    </header>
    <main class="board-frame" aria-label="盤面"><div class="board-host"></div><canvas class="mini-map" width="160" height="160" aria-label="地形と公開情報のミニマップ"></canvas><div class="terrain-legend" aria-label="地形記号">▰ 陸 · ≋ 川 · ▲ 山 · ⚓ 港 · ⇄ 渡河予定 · 拠点記号の大きさ＝規模</div><div class="board-hint">敵へドロップで追跡 · 拠点へドロップで進軍 · 地面ドラッグでカメラ</div><span class="scenario-badge"></span>
      <aside class="strategy-panel" aria-label="戦略操作" hidden><div class="panel-heading"><strong data-panel-title></strong><button data-action="close-panel">閉じる ×</button></div><p class="panel-live"></p>
        <section data-panel="production" hidden><p class="production-summary"></p>
          <label>生産場所 <select data-production-site aria-label="部隊の生産場所"></select></label><div class="production-options"></div>
          <h3>生産キュー</h3><div class="production-queue"></div>
        </section>
        <section data-panel="research" hidden><button data-action="bank-research">指定解除・バンクする</button><p>選択中の研究にポイントを充填。必要量で完了。指定しない間はバンクします。切替・解除でも充填済みポイントは残ります。</p>
          <div class="research-cards"></div>
        </section>
        <section data-panel="crossings" hidden><p>予定地は公開情報です。敵設備の所有・耐久・作業は視界内だけ更新します。</p><div class="crossing-list"></div></section>
        <section data-panel="base" hidden><label>拠点 <select data-base-select aria-label="表示する拠点"></select></label><div class="base-detail"></div><p data-capture-help></p><button data-action="production">生産を開く</button></section>
      </aside>
    </main>
    <footer class="bottom-bar"><div class="resource-strip"><strong data-resources></strong><span data-income></span><span data-research-status></span><div class="bottom-actions"><button data-action="production">生産</button><button data-action="research">研究</button><button data-action="bases">拠点</button><button data-action="crossings">渡河</button><button data-action="stop">部隊停止</button><button data-action="clear">選択解除</button><button data-action="camera">カメラ</button></div></div>
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
        : panel === 'crossings'
          ? '橋・索道'
          : '拠点情報';
  for (const name of ['production', 'research', 'bases', 'crossings'])
    elements.root
      .querySelector(`[data-action="${name}"]`)
      ?.setAttribute(
        'aria-expanded',
        String(panel === (name === 'bases' ? 'base' : name)),
      );
}
function productionReason(
  view: FactionView,
  kind: UnitKind,
  siteId: string,
): string | null {
  if (view.ownFaction.eliminatedAtTick !== null) return '脱落 · 観戦中';
  if (view.phase === 'finished') return '試合は終了しました';
  if (view.phase !== 'running') return '開始・再開後に操作できます';
  const stats = view.rules.units[kind];
  if (!isUnitUnlocked(view.ownFaction, view.rules, kind))
    return `研究「${stats.unlockResearchId ? researchName(stats.unlockResearchId, view) : '兵種解放'}」が必要です`;
  if (stats.movementDomain === 'water') {
    if (
      !view.map.ports?.some(
        (port) => port.id === siteId && port.factionId === view.viewerFactionId,
      )
    )
      return '自陣の港を選んでください';
  } else {
    const hq = view.bases.find(
      (base) => base.id === siteId && base.kind === 'hq',
    );
    if (hq?.visibility !== 'owned' || hq.hp <= 0)
      return '稼働中の首都を選んでください';
  }
  if (
    view.ownUnits.length + view.ownFaction.productionJobs.length >=
    view.rules.limits.unitsPerFaction
  )
    return `部隊上限${view.rules.limits.unitsPerFaction}（予約を含む）`;
  if (
    view.ownFaction.productionJobs.length >= view.rules.limits.productionQueue
  )
    return `予約は${view.rules.limits.productionQueue}件までです`;
  return view.ownFaction.supplyCenti < stats.costCenti
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
  drawMiniMap(
    elements.root.querySelector<HTMLCanvasElement>('.mini-map'),
    view,
  );
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
  const localStatus = elements.root.querySelector<HTMLElement>(
    '[data-local-status]',
  )!;
  localStatus.hidden =
    view.scenarioId !== 'standard' && view.scenarioId !== 'f06-local-faction';
  if (!localStatus.hidden) {
    const local = view.localFaction;
    const activity = local.defeated
      ? '活動停止'
      : local.active
        ? '活動中'
        : '未出現';
    const stronghold =
      local.stronghold.visibility === 'hidden'
        ? '本拠 未確認'
        : local.stronghold.visibility === 'destroyed'
          ? '本拠 撃破'
          : `本拠 HP${local.stronghold.hp ?? '?'}/${local.stronghold.maxHp ?? '?'}`;
    localStatus.textContent = `● 現地勢力 ${activity} · 可視部隊${local.visibleUnitCount} · 占領拠点${local.publicBaseCount} · ${stronghold}`;
  }
  text(
    '.scenario-badge',
    `${view.scenarioId === 'standard' ? '通常設定 · NPC2陣営' : `検査：${view.scenarioId === 'f06-local-faction' ? '現地勢力' : view.scenarioId === 'f08-unit-domains' ? '6兵種・陸空水' : view.scenarioId}${view.scenarioId.startsWith('g2-') || view.scenarioId === 'f02-pursuit' || view.scenarioId === 'f05-neutral-defense' || view.scenarioId === 'f08-unit-domains' ? ' · NPC停止' : ''}`} · 残り ${Math.floor(Math.max(0, view.timeLimitTicks - view.tick) / 600)}:${String(Math.floor(Math.max(0, view.timeLimitTicks - view.tick) / 10) % 60).padStart(2, '0')}`,
  );
  for (const kind of UNIT_KINDS) {
    const stats = view.rules.units[kind];
    const detail = `${stats.movementDomain === 'land' ? '陸' : stats.movementDomain === 'air' ? '空' : '水'} · 補給${amount(stats.costCenti)} · ${seconds(stats.buildTicks)} · HP${stats.maxHp} · 射程${stats.range} · 視界${stats.vision}`;
    const selector = `[data-unit-details="${kind}"]`;
    const details = elements.root.querySelector<HTMLElement>(selector);
    if (details) details.textContent = detail;
  }
  const researchIds = Object.keys(
    view.rules.research.definitions,
  ) as ResearchId[];
  const researchCards =
    elements.root.querySelector<HTMLElement>('.research-cards')!;
  if (researchCards.dataset.ids !== researchIds.join('|')) {
    researchCards.dataset.ids = researchIds.join('|');
    researchCards.replaceChildren(
      ...researchIds.map((id) => {
        const card = document.createElement('div');
        card.className = 'action-card';
        const button = document.createElement('button');
        button.dataset.research = id;
        const details = document.createElement('small');
        details.dataset.researchDetails = id;
        const progress = document.createElement('progress');
        progress.dataset.researchProgress = id;
        progress.max = 100;
        const reason = document.createElement('span');
        reason.dataset.researchReason = id;
        card.append(button, details, progress, reason);
        return card;
      }),
    );
  }
  for (const id of researchIds) {
    const def = view.rules.research.definitions[id]!;
    const domainName = (
      {
        power: '戦力',
        logistics: '兵站',
        information: '情報',
        engineering: '工兵',
      } as const
    )[def.domain];
    const prerequisite = def.prerequisites.length
      ? ` · 前提 ${def.prerequisites.map((id) => researchName(id, view)).join('・')}`
      : '';
    const exclusions = def.exclusiveWith.length
      ? ` · 排他 ${def.exclusiveWith.map((id) => researchName(id, view)).join('・')}`
      : '';
    text(
      `[data-research-details="${id}"]`,
      `${domainName} ${def.stage} · 必要${amount(def.costCenti)}ポイント · ${def.effects.map(effectLabel).join('、')}${prerequisite}${exclusions}`,
    );
  }
  text(
    '[data-capture-help]',
    `中立拠点は守備を撃破し、拠点HPを0にしてから半径${view.rules.capture.radius}へ自軍だけが${seconds(view.rules.capture.requiredTicks)}いると制圧できます。`,
  );
  text(
    '[data-resources]',
    `補給 ${amount(own.supplyCenti)} / 研究バンク ${(own.researchCenti / 100).toFixed(1)}`,
  );
  const bases = view.bases.filter(
    (base) => base.visibility === 'owned' && base.hp > 0,
  );
  const income = bases.reduce(
      (n, base) =>
        n +
        view.rules.bases[base.kind].supplyIncomeCentiPerTick +
        researchEffectValue(own, view.rules, 'supply-income-bonus'),
      0,
    ),
    rp =
      view.rules.research.baseIncomeCentiPerTick +
      bases.reduce(
        (n, base) => n + view.rules.bases[base.kind].researchIncomeCentiPerTick,
        0,
      ),
    upkeep = view.ownUnits.reduce(
      (n, unit) =>
        n +
        Math.max(
          0,
          view.rules.units[unit.kind].upkeepCentiPerTick -
            researchEffectValue(own, view.rules, 'upkeep-reduction'),
        ),
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
        ? `${researchName(own.activeResearch.researchId, view)} 充填 ${((own.researchProgressCenti[own.activeResearch.researchId] ?? 0) / 100).toFixed(1)}pt`
        : `バンク中 · 研究完了 ${own.completedResearchIds.length}/${Object.keys(view.rules.research.definitions).length}`,
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
    `部隊 ${view.ownUnits.length}＋予約 ${own.productionJobs.length} / 上限${view.rules.limits.unitsPerFaction} · 首都/港で直列生産`,
  );
  const siteSelect = elements.root.querySelector<HTMLSelectElement>(
    '[data-production-site]',
  )!;
  const sites = [
    {
      id: `HQ-${view.viewerFactionId}`,
      label: `首都 HQ-${view.viewerFactionId}`,
    },
    ...(view.map.ports ?? [])
      .filter((port) => port.factionId === view.viewerFactionId)
      .map((port) => ({ id: port.id, label: `港 ${port.id}` })),
  ];
  if (siteSelect.dataset.sites !== sites.map(({ id }) => id).join('|')) {
    const selected = siteSelect.value;
    siteSelect.replaceChildren(
      ...sites.map(({ id, label }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        return option;
      }),
    );
    siteSelect.dataset.sites = sites.map(({ id }) => id).join('|');
    if (sites.some(({ id }) => id === selected)) siteSelect.value = selected;
  }
  if (!siteSelect.value && sites[0]) siteSelect.value = sites[0].id;
  const productionHost = elements.root.querySelector<HTMLElement>(
    '.production-options',
  )!;
  if (productionHost.dataset.kinds !== UNIT_KINDS.join('|')) {
    productionHost.dataset.kinds = UNIT_KINDS.join('|');
    productionHost.replaceChildren(
      ...UNIT_KINDS.map((kind) => {
        const card = document.createElement('div');
        card.className = 'action-card';
        const button = document.createElement('button');
        button.dataset.produce = kind;
        button.textContent = `${kindGlyph(kind)} ${kindName(kind)}を生産`;
        const detail = document.createElement('small');
        detail.dataset.unitDetails = kind;
        const reason = document.createElement('span');
        reason.dataset.productionReason = kind;
        card.append(button, detail, reason);
        return card;
      }),
    );
  }
  for (const kind of UNIT_KINDS) {
    const reason = productionReason(view, kind, siteSelect.value);
    const stats = view.rules.units[kind];
    elements.root.querySelector<HTMLElement>(
      `[data-unit-details="${kind}"]`,
    )!.textContent =
      `${stats.movementDomain === 'land' ? '陸' : stats.movementDomain === 'air' ? '空' : '水'} · 補給${amount(stats.costCenti)} · ${seconds(stats.buildTicks)} · HP${stats.maxHp} · 射程${stats.range} · 視界${stats.vision}`;
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
  for (const id of researchIds) {
    const def = view.rules.research.definitions[id]!;
    const done = own.completedResearchIds.includes(id);
    const active = own.activeResearch?.researchId === id;
    const progress = own.researchProgressCenti[id] ?? 0;
    const reason =
      own.eliminatedAtTick !== null
        ? '脱落 · 研究停止'
        : done
          ? `完了 · ${def.effects.map(effectLabel).join('、')}`
          : view.phase !== 'running'
            ? '開始・再開後に選択できます'
            : def.prerequisites.some(
                  (id) => !own.completedResearchIds.includes(id),
                )
              ? `前提：${def.prerequisites
                  .filter((id) => !own.completedResearchIds.includes(id))
                  .map((id) => researchName(id, view))
                  .join('・')}が必要です`
              : def.exclusiveWith.some((id) =>
                    own.completedResearchIds.includes(id),
                  )
                ? `排他：${def.exclusiveWith
                    .filter((id) => own.completedResearchIds.includes(id))
                    .map((id) => researchName(id, view))
                    .join('・')}完了済みです`
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
  const crossingHost =
    elements.root.querySelector<HTMLElement>('.crossing-list')!;
  const crossingIds = view.crossings.map(({ site }) => site.id);
  if (crossingHost.dataset.ids !== crossingIds.join('|')) {
    crossingHost.dataset.ids = crossingIds.join('|');
    crossingHost.replaceChildren(
      ...view.crossings.map(({ site }) => {
        const row = document.createElement('article');
        row.className = 'crossing-card';
        row.dataset.crossing = site.id;
        const title = document.createElement('strong');
        const status = document.createElement('span');
        status.className = 'crossing-status';
        const build = document.createElement('button');
        build.dataset.crossingBuild = site.id;
        build.textContent = '建設';
        const dismantle = document.createElement('button');
        dismantle.dataset.crossingDismantle = site.id;
        dismantle.textContent = '解体';
        const reason = document.createElement('small');
        reason.className = 'crossing-reason';
        row.append(title, status, build, dismantle, reason);
        return row;
      }),
    );
  }
  const selectedBuilder =
    selectedUnits.find(({ kind }) => kind === 'assault') ?? selectedUnits[0];
  for (const crossing of view.crossings) {
    const { site } = crossing;
    const row = crossingHost.querySelector<HTMLElement>(
      `[data-crossing="${site.id}"]`,
    )!;
    row.querySelector('strong')!.textContent =
      `${crossingName(site.tier)} · ${site.id}`;
    let status = '未観測 · 状態不明';
    if (crossing.visibility === 'remembered')
      status = `最終観測 T${crossing.seenTick}: ${crossing.owner ?? '中立'} HP${crossing.hp}/${crossing.maxHp}`;
    else if (
      crossing.visibility === 'visible' ||
      crossing.visibility === 'owned'
    ) {
      const job = crossing.job;
      status =
        crossing.owner === null
          ? job?.kind === 'build'
            ? `${job.factionId} 建設 ${job.progressTicks}/${job.requiredTicks} tick`
            : '未建設'
          : `${crossing.owner}所有 · HP${crossing.hp}/${crossing.maxHp}${job ? ` · ${job.kind === 'dismantle' ? '解体' : '建設'} ${job.progressTicks}/${job.requiredTicks}` : ''}`;
    }
    row.querySelector<HTMLElement>('.crossing-status')!.textContent = status;
    const requiredResearch = Object.entries(
      view.rules.research.definitions,
    ).find(([, definition]) =>
      definition.effects.some(
        (effect) =>
          effect.id === 'crossing-unlock' && effect.crossingTier === site.tier,
      ),
    )?.[0] as ResearchId | undefined;
    let buildReason: string | null = null;
    if (view.phase !== 'running') buildReason = '開始・再開後に操作できます';
    else if (
      crossing.visibility !== 'visible' &&
      crossing.visibility !== 'owned'
    )
      buildReason = '予定地へ移動し、状態を確認してください';
    else if (crossing.owner !== null) buildReason = '他陣営が所有中です';
    else if (crossing.job)
      buildReason = `${crossing.job.factionId}が作業中です`;
    else if (!selectedBuilder) buildReason = '強襲部隊を選択してください';
    else if (selectedBuilder.kind !== 'assault')
      buildReason = '強襲部隊が建設できます';
    else if (
      ![site.bankA, site.bankB].some(
        (bank) =>
          Math.abs(selectedBuilder.cell.x - bank.x) +
            Math.abs(selectedBuilder.cell.y - bank.y) <=
          1,
      )
    )
      buildReason = '部隊を端点に隣接させてください';
    else if (!crossingResearchComplete(own, view.rules, site.tier))
      buildReason = requiredResearch
        ? `前提研究: ${researchName(requiredResearch, view)}`
        : '渡河設備を解放する研究がありません';
    else if (own.supplyCenti < view.rules.crossings[site.tier].costCenti)
      buildReason = '補給が不足しています';
    const build = row.querySelector<HTMLButtonElement>(
      '[data-crossing-build]',
    )!;
    build.disabled =
      buildReason !== null ||
      snapshot.contextLost ||
      own.eliminatedAtTick !== null;
    const dismantle = row.querySelector<HTMLButtonElement>(
      '[data-crossing-dismantle]',
    )!;
    const canDismantle =
      crossing.visibility === 'owned' &&
      crossing.owner === view.viewerFactionId &&
      crossing.job === null &&
      selectedUnits.some((unit) =>
        [site.bankA, site.bankB].some(
          (bank) =>
            Math.abs(unit.cell.x - bank.x) + Math.abs(unit.cell.y - bank.y) <=
            1,
        ),
      );
    dismantle.disabled =
      !canDismantle || view.phase !== 'running' || snapshot.contextLost;
    row.querySelector<HTMLElement>('.crossing-reason')!.textContent =
      buildReason ??
      `費用 ${amount(view.rules.crossings[site.tier].costCenti)} · 建設 ${seconds(view.rules.crossings[site.tier].buildTicks)} · 選択部隊で建設`;
  }
  const selector =
    elements.root.querySelector<HTMLSelectElement>('[data-base-select]')!;
  if (!selector.options.length)
    for (const base of view.bases) {
      const option = document.createElement('option');
      option.value = base.id;
      option.textContent = `${baseKindName(base.kind)} ${base.id}`;
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
      detail = `${location}\n最終観測 TICK ${base.seenTick}：${baseOwnerName(base.owner)} / HP${base.hp}${base.defenderMaxHp > 0 ? ` / 守備${base.defenderHp}/${base.defenderMaxHp}` : ''}\n${base.selfReportedLost ? '自軍の所有喪失を確認。現在の所有者は不明。' : '現在の状態は不明です。'}`;
    else
      detail = `${location}\n所有：${baseOwnerName(base.owner)} · HP${base.hp}/${base.maxHp}${base.defenderMaxHp === null ? '' : `\n中立守備：${base.defenderHp === 0 ? '撃破済み' : `${base.defenderHp}/${base.defenderMaxHp}`}`}\n${base.captureCandidate ? `${base.captureCandidate} 制圧 ${base.captureProgressCentiTicks / 100}/${view.rules.capture.requiredTicks}` : base.defenderHp !== null && base.defenderHp > 0 ? '守備を撃破してください' : base.owner === null && base.hp > 0 ? '守備撃破済み · 拠点HPを0にしてください' : base.hp > 0 ? '稼働中' : base.kind === 'hq' ? '破壊済み・再建なし' : '中立・制圧可能'}${base.visibility === 'owned' && base.hp > 0 ? `\n補給 +${view.rules.bases[base.kind].supplyIncomeCentiPerTick / 10}/秒 · 研究 +${view.rules.bases[base.kind].researchIncomeCentiPerTick / 10}/秒` : ''}`;
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

function drawMiniMap(
  canvas: HTMLCanvasElement | null,
  view: FactionView,
): void {
  if (canvas === null) return;
  try {
    const context = canvas.getContext('2d');
    if (context === null) return;
    const cellWidth = canvas.width / view.map.width;
    const cellHeight = canvas.height / view.map.height;
    for (let y = 0; y < view.map.height; y += 1) {
      for (let x = 0; x < view.map.width; x += 1) {
        const index = y * view.map.width + x;
        const kind =
          view.map.terrain?.[index] ??
          (view.map.blocked[index] ? 'mountain' : 'land');
        context.fillStyle =
          kind === 'river'
            ? '#398da6'
            : kind === 'riverbank'
              ? '#b6a16f'
              : kind === 'mountain' || view.map.blocked[index]
                ? '#68736b'
                : '#aebf92';
        context.fillRect(
          x * cellWidth,
          y * cellHeight,
          cellWidth + 0.2,
          cellHeight + 0.2,
        );
      }
    }
    for (const port of view.map.ports ?? []) {
      context.fillStyle = '#173f57';
      context.fillRect(port.cell.x * cellWidth, port.cell.y * cellHeight, 3, 3);
    }
    for (const site of view.map.crossingSites ?? []) {
      const crossing = view.crossings.find(
        (entry) => entry.site.id === site.id,
      );
      context.fillStyle =
        crossing?.visibility === 'owned' || crossing?.visibility === 'visible'
          ? crossing.owner === 'A'
            ? '#e47a2f'
            : crossing.owner === 'B'
              ? '#2d9fc5'
              : crossing.owner === 'C'
                ? '#d8ad24'
                : '#78858c'
          : site.tier.startsWith('bridge')
            ? '#f4d35e'
            : '#f28f3b';
      context.fillRect(
        site.bankA.x * cellWidth,
        site.bankA.y * cellHeight,
        3,
        3,
      );
    }
    for (const base of view.bases) {
      context.fillStyle =
        base.visibility === 'unknown'
          ? '#70777b'
          : base.owner === 'local'
            ? '#66747c'
            : base.owner === 'A'
              ? '#e47a2f'
              : base.owner === 'B'
                ? '#2d9fc5'
                : base.owner === 'C'
                  ? '#d8ad24'
                  : '#70777b';
      context.beginPath();
      context.arc(
        (base.cell.x + 0.5) * cellWidth,
        (base.cell.y + 0.5) * cellHeight,
        base.kind === 'large' ? 3 : base.kind === 'medium' ? 2.5 : 2,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.fillStyle = '#fff';
    for (const unit of view.ownUnits) {
      context.fillRect(unit.cell.x * cellWidth, unit.cell.y * cellHeight, 2, 2);
    }
    context.fillStyle = '#a71818';
    for (const enemy of view.visibleEnemies) {
      context.fillStyle = enemy.factionId === 'local' ? '#66747c' : '#a71818';
      context.fillRect(
        (enemy.positionX1024 / 1024) * cellWidth,
        (enemy.positionY1024 / 1024) * cellHeight,
        2,
        2,
      );
    }
  } catch {
    // Canvas rendering can be unavailable in test DOMs; the game view remains usable.
  }
}
