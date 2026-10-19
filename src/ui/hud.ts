import { FACILITY_NAMES, updateFacilitiesPanel } from './facilities';
import { updateTicketsHud } from './tickets';
import type { PlayerSnapshot } from '../runtime/controller';
import { marchOrderLabel } from './march-target';
import type {
  BaseOwnerId,
  FactionView,
  ResearchDomain,
  ResearchId,
  ScenarioId,
  UnitKind,
} from '../simulation/types';
import { crossingResearchComplete } from '../simulation/crossings';
import {
  researchCostForFaction,
  researchEffectValue,
  isUnitUnlocked,
} from '../simulation/research';
import { baseUpgradeTier, maximumBaseLevel } from '../simulation/base-upgrades';
import { TACTICAL_ABILITY_LABELS } from '../simulation/tactical-abilities';
import { TACTICAL_ABILITY_IDS } from '../simulation/types';

export type HudPanel =
  | 'production'
  | 'research'
  | 'base'
  | 'crossings'
  | 'facilities'
  | 'abilities'
  | null;
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
  readonly outdatedDialog: HTMLDialogElement;
  panel: HudPanel;
  selectedBaseId: string;
  multiSelect: boolean;
  researchDomain: ResearchDomain;
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
  Object.entries({
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
    'base-development-1': '拠点整備',
    'base-development-2': '要塞化',
    'specialization-power': '専攻・戦力',
    'specialization-logistics': '専攻・前線展開',
    'specialization-information': '専攻・全域観測',
    'specialization-engineering': '専攻・封鎖',
    'specialization-wartime-economy': '専攻・戦時経済',
    'specialization-information-warfare': '専攻・情報戦',
    'firepower-3': '戦力研究 III',
    'facility-turret': '砲座',
    'facility-antiair': '対空陣地',
    'facility-mine': '地雷原',
    'facility-watchtower': '観測塔',
    'facility-jammer': '妨害塔',
    'facility-engineering': '施設工学',
  }).find(([key]) => key === id)?.[1] ??
  (view?.rules.research.definitions[id]
    ? `${({ power: '戦力', logistics: '兵站', information: '情報', engineering: '工兵' } as const)[view.rules.research.definitions[id].domain]} ${view.rules.research.definitions[id].stage}`
    : id);
const effectLabel = (effect: {
  id: string;
  value: number;
  crossingTier?: string;
  unitKind?: string;
  facilityKind?: string;
}): string => {
  switch (effect.id) {
    case 'damage-bonus':
      return `攻撃 +${effect.value}`;
    case 'vision-bonus':
      return `視界 +${effect.value}`;
    case 'supply-income-bonus':
      return `定額補給収入 +${effect.value} centi/tick`;
    case 'supply-income-percent':
      return `基礎定額補給収入 +${effect.value}%`;
    case 'upkeep-reduction':
      return `維持費 -${effect.value} centi/tick/部隊`;
    case 'crossing-unlock':
      return `${effect.crossingTier ? crossingName(effect.crossingTier) : '渡河'}を解放`;
    case 'unit-unlock':
      return `${effect.unitKind ? kindName(effect.unitKind as UnitKind) : '兵種'}を解放`;
    case 'facility-unlock':
      return `${FACILITY_NAMES[effect.facilityKind as keyof typeof FACILITY_NAMES] ?? '施設'}を解放`;
    case 'facility-build-speed-percent':
      return `施設の建築速度 +${effect.value}%`;
    case 'production-time-percent':
      return `生産時間 -${effect.value}%`;
    case 'frontline-deployment':
      return '前線拠点から生産・回復';
    case 'global-observation':
      return '周期的な全域観測';
    case 'blockade':
      return '地雷の発見抑制・減速';
    case 'information-kill-bonus':
      return `攻撃寄与に応じて敵の損失ticket +${effect.value}%`;
    case 'base-upgrade-max':
      return `拠点をLv${effect.value}まで強化`;
    default:
      return '未対応の効果';
  }
};
const crossingName = (tier: string): string =>
  tier.startsWith('bridge') ? `橋 ${tier.slice(-1)}` : `索道 ${tier.slice(-1)}`;
const amount = (n: number): string =>
  Math.floor(n / 100).toLocaleString('ja-JP');
const seconds = (ticks: number): string => `${(ticks / 10).toFixed(1)}秒`;

const SCENARIO_OPTIONS = `<option value="standard">通常設定</option><option value="f88-combat-estimate">検査：戦闘見込み</option><option value="f120-combat-estimate-ui">検査：見込み表示</option><option value="f121-combat-visibility">検査：交戦表示</option><option value="f87-specializations">検査：CP13専攻</option><option value="f86-point-fire">検査：地点砲撃</option><option value="f15-tactical-abilities">検査：作戦指令</option><option value="f19-capture">検査：制圧後HP率</option><option value="f18-garrison">検査：拠点駐留・防衛</option><option value="f11-facilities">検査：施設建築</option><option value="f10-base-upgrades">検査：拠点強化</option><option value="f08-unit-domains">検査：6兵種・陸空水</option><option value="f06-local-faction">検査：現地勢力</option><option value="f05-neutral-defense">検査：中立守備・制圧</option><option value="f04-crossing">検査：橋の建設</option><option value="f02-pursuit">検査：移動する敵の追跡</option><option value="g2-capture">検査：制圧</option><option value="g2-combat">検査：相互交戦</option><option value="g2-economy">検査：生産・研究（NPC停止）</option><option value="g3-timeout">検査：20秒で時間切れ</option><option value="g3-elimination">検査：相手2軍脱落</option><option value="g3-mutual">検査：同時全滅</option><option value="g3-spectate">検査：自軍脱落と観戦</option>`;
const ticketCard = (id: 'A' | 'B' | 'C', shape: string, name: string) =>
  `<div class="ticket t-${id.toLowerCase()} legend-${id.toLowerCase()}${id === 'A' ? ' me' : ''}"><div class="row"><span class="sym ${shape}" aria-hidden="true"></span><b class="civ">${id} · ${name}</b><span class="rank" data-rank="${id}"></span></div><div class="row"><div class="bar"><i data-ticket-bar="${id}"></i></div><strong class="val" data-ticket="${id}"></strong></div><div class="ticket-meta"></div></div>`;
const RESEARCH_DOMAINS: readonly {
  readonly id: ResearchDomain;
  readonly name: string;
  readonly hint: string;
}[] = [
  { id: 'power', name: '戦力', hint: '攻撃・兵種' },
  { id: 'logistics', name: '兵站', hint: '収入・前線' },
  { id: 'information', name: '情報', hint: '視界・航空' },
  { id: 'engineering', name: '工兵', hint: '渡河・施設' },
];

export function createHud(app: HTMLElement): HudElements {
  app.className = 'game-shell mock-shell';
  app.innerHTML = `
    <main class="board-frame" aria-label="盤面"><div class="board-host"></div></main>
    <div class="hud-layer">
      <section class="hud-system" aria-label="試合の操作">
        <span class="brand-mark" aria-hidden="true">◆</span>
        <button data-action="start" class="cta-sm" aria-label="開始"><b>START</b><small>開始</small></button>
        <button data-action="pause" class="btn-light" aria-label="一時停止"><span aria-hidden="true">Ⅱ</span> 一時停止</button>
        <button data-action="resume" class="cta-sm" aria-label="再開"><b>RESUME</b><small>再開</small></button>
        <details class="hud-menu"><summary>メニュー</summary><div class="menu-pop">
          <span class="eyebrow">MENU</span>
          <button data-action="reset">リセット</button>
          <button data-action="master">マスタ</button>
          <details class="test-settings"><summary>検査設定</summary><div class="settings-popover">
            <label>seed <input data-seed type="number" min="0" max="4294967295" step="1" value="42" aria-label="試合seed"></label>
            <label>シナリオ <select data-scenario aria-label="検査シナリオ">${SCENARIO_OPTIONS}</select></label>
            <button data-action="apply-seed">適用してリセット</button><button data-action="download">全情報を含む診断JSONを保存</button>
            <p>通常設定はNPC2陣営・5分制。チケット0、または首都と全部隊を失うと脱落。G2検査のみNPC停止。現地勢力検査はA/B/Cの順位へ加わらない独立勢力を表示します。短時間検査は初期チケットと制限時間を変更します。</p>
          </div></details>
        </div></details>
      </section>
      <section class="hud-top">
        <div class="tickets ticket-strip" aria-label="公開チケット">${ticketCard('A', 'diamond', 'あなた')}${ticketCard('B', 'square', 'NPC')}${ticketCard('C', 'hex', 'NPC')}</div>
        <div class="timer"><span class="ph-name" data-phase-name>READY</span><span class="t" data-timer>0:00</span></div>
        <div class="npc-strip"><span class="scenario-badge"></span><span data-local-status aria-live="polite"></span></div>
        <div class="hud-banners"><span data-testid="hq-protection-banner" class="hq-protection-banner" hidden></span><span data-testid="hq-warning-banner" class="hq-warning-banner" hidden></span></div>
        <p class="status" role="status" aria-live="polite"></p>
      </section>
      <section class="hud-map panel marks" aria-label="ミニマップ">
        <div class="mini-map-wrap"><canvas class="mini-map" width="160" height="160" aria-label="地形と公開情報のミニマップ"></canvas><canvas class="mini-map-view" width="160" height="160" aria-label="ミニマップをタップして視点を移動"></canvas></div>
        <button class="icon-btn camera-btn" data-action="camera" aria-label="カメラ" title="自軍へ視点を戻す">◎</button>
        <div class="terrain-legend" aria-label="地形記号">▰陸 ≋川 ▲山 ⚓港 ⇄渡河</div>
      </section>
      <div class="hud-alerts"><button class="air-defense-alert" data-action="focus-air-defense" hidden>対空の最終確認位置へ</button><button class="artillery-alert" data-action="focus-artillery-warning" hidden>砲撃警告</button></div>
      <aside class="combat-estimate" data-testid="combat-estimate" aria-live="polite" hidden><div class="combat-estimate-heading"><span class="eyebrow">FORECAST</span><strong data-estimate-heading>戦闘見込み · 予測</strong><button type="button" data-action="close-combat-estimate" aria-label="戦闘見込みを閉じる">×</button></div><span class="estimate-result" data-estimate-result></span><span class="estimate-losses" data-estimate-losses></span><details><summary>前提と限界</summary><p data-estimate-assumptions></p></details></aside>
      <div class="board-hint">敵へドロップで追跡 · 拠点へドロップで進軍 · 地面ドラッグでカメラ</div>
      <div class="pause-stamp" aria-hidden="true"><b>PAUSED</b><small>一時停止中</small></div>
      <section class="left-bottom">
        <div class="panel res marks"><div><span class="eyebrow">SUPPLY · 補給</span><b class="v" data-supply></b><span class="d" data-income></span></div><div><span class="eyebrow">RESEARCH · 研究</span><b class="v" data-research-bank></b><span class="d" data-research-rate></span></div></div>
        <p class="research-line"><span data-research-status></span> <span data-research-announcement role="status" aria-live="polite"></span> <span data-facility-jam role="status"></span></p>
        <div class="cmd-row"><button class="btn-ink" data-action="research" aria-label="研究"><b>RESEARCH</b><small>研究</small></button><button class="btn-light" data-action="base-sheet" aria-label="拠点"><b>BASE</b><small>拠点</small></button></div>
      </section>
      <section class="hud-squads" aria-label="自軍部隊">
        <div class="squad-card"><div class="selection-summary"><strong class="selection-name"></strong><span class="selection-combat" data-selection-combat></span><span class="selection-instruction"></span></div>
          <div class="selection-controls" aria-label="部隊選択"><button type="button" data-action="multi-select" aria-pressed="false">複数選択</button><button type="button" data-action="select-all">すべて選択</button><button type="button" data-action="stop">部隊停止</button><button type="button" data-action="clear">選択解除</button><button type="button" data-action="point-fire" hidden>地点砲撃</button><button type="button" data-action="flight-route" aria-pressed="false">航空経路</button></div></div>
        <div class="unit-list" aria-label="自軍部隊の一覧"></div>
      </section>
      <section class="addon-dock" aria-label="作戦指令">
        <div class="addon-head"><button type="button" data-action="abilities" class="addon-toggle" aria-label="作戦"><span class="eyebrow">ORDERS</span> 作戦 <span aria-hidden="true">▴</span></button><label class="jam-target">妨害先 <select data-ability-target aria-label="電波妨害の対象陣営"></select></label></div>
        <section data-panel="abilities" class="addon-detail" hidden><span class="eyebrow">作戦指令 · 全陣営共通</span><p>効果・費用・待ち時間はマスタで調整できます。地点を狙う指令は、ボタンを押してから盤面をタップしてください。</p></section>
        <div class="tactical-abilities addons"></div>
        <p data-ability-active role="status"></p>
      </section>
      <section class="base-pop" data-panel="base" hidden aria-label="拠点情報">
        <div class="pop-head"><div class="pop-mark" aria-hidden="true" data-base-glyph>◆</div><div><span class="eyebrow" data-base-eyebrow>BASE</span><strong class="h3" data-base-title>拠点情報</strong></div><button type="button" data-action="close-panel" class="icon-btn" aria-label="パネルを閉じる">×</button></div>
        <div class="pop-body"><label class="base-select">拠点 <select data-base-select aria-label="表示する拠点"></select></label><div class="bar base-hp"><i data-base-hp></i></div><div class="base-detail"></div><p data-upgrade-reason></p><p data-capture-help></p></div>
        <div class="pop-acts"><button data-action="march-base" class="btn-ink">ここへ移動</button><button data-action="upgrade-base" class="btn-light">拠点を強化</button><button data-action="garrison" class="btn-light">選択部隊を駐留</button><button data-action="production" class="btn-light">生産を開く</button></div>
      </section>
      <section class="base-sheet sheet" hidden aria-label="拠点の運用">
        <div class="sheet-head"><div class="sheet-title"><span class="eyebrow">BASE · 拠点の運用</span><strong class="h2" data-panel-title></strong></div>
          <nav class="tabs strategy-tabs" aria-label="拠点メニュー"><button class="tab" data-action="production">生産</button><button class="tab" data-action="facilities">防御施設</button><button class="tab" data-action="crossings">渡河</button><button class="tab" data-action="bases">拠点情報</button></nav>
          <span class="coin"><i>S</i><b data-sheet-supply></b></span><button type="button" data-action="close-panel" class="icon-btn" aria-label="パネルを閉じる">×</button></div>
        <p class="panel-live"></p>
        <div class="sheet-body">
        <section data-panel="production" hidden><div class="production-main"><label class="inline-field">生産場所 <select data-production-site aria-label="部隊の生産場所"></select></label><div class="production-options units"></div></div>
          <div class="queue-side"><span class="eyebrow ink">QUEUE · 生産キュー</span><p class="production-summary"></p><div class="production-queue"></div></div>
        </section>
        <section data-panel="crossings" hidden><p class="sheet-note">予定地は公開情報です。敵設備の所有・耐久・作業は視界内だけ更新します。</p><div class="crossing-list"></div></section>
        <section data-panel="facilities" hidden><div class="production-main"><p class="sheet-note">所有拠点・完成した橋/索道へ建築します。位置は自動、建築中も枠を使います。アンカーを失うと施設は消えます。</p><label class="inline-field">設置先 <select data-facility-anchor aria-label="施設の設置先"></select></label><div class="facility-options units"></div></div><div class="queue-side"><span class="eyebrow ink">SLOTS · 設置枠</span><p data-facility-slots></p><p data-facility-status></p></div></section>
        </div>
      </section>
      <section class="research-sheet" data-panel="research" hidden aria-label="研究">
        <div class="research-head"><button type="button" data-action="close-panel" class="back-btn" aria-label="戻る">← 戻る</button><div class="sheet-title"><span class="eyebrow">RESEARCH · 試合は進行中</span><strong class="h1">研究</strong></div>
          <div class="rp"><span class="eyebrow">POINTS</span><b class="num" data-research-points></b><span class="mono dim" data-research-points-rate></span></div>
          <div class="now"><span class="eyebrow ink">NOW</span><b data-research-now>バンク中</b><div class="bar"><i data-research-now-bar></i></div><button data-action="bank-research" class="btn-light">指定解除・バンク</button></div></div>
        <div class="research-main"><nav class="branches" aria-label="研究の分野">${RESEARCH_DOMAINS.map(({ id, name, hint }) => `<button type="button" class="br" data-research-domain="${id}" aria-pressed="false"><b>${name}</b><span class="d">${hint}</span><span class="c" data-research-domain-count="${id}"></span></button>`).join('')}</nav>
          <div class="tiers research-cards">${[1, 2, 3, 4].map((tier) => `<div class="tier" data-tier="${tier}"><span class="eyebrow tl">TIER ${tier}</span></div>`).join('')}</div></div>
        <aside class="research-tip"><span class="eyebrow">TIP</span><p>選択中の研究にポイントを充填。必要量で完了。指定しない間はバンクします。切替・解除でも充填済みポイントは残ります。専攻（TIER 4）はどれか1つだけ。</p></aside>
      </section>
      <span class="tick-readout"></span>
    </div>
    <dialog class="result-dialog" aria-labelledby="result-title"><div class="report"><header class="report-head"><div><span class="eyebrow">AFTER ACTION REPORT</span><strong class="h2">戦闘詳報</strong></div><p class="report-reason" data-result-reason></p></header>
      <div class="report-body"><section class="standing"><span class="eyebrow">FINAL STANDING</span><b class="rank-big" data-result-rank>#1<small>/3</small></b><h1 id="result-title">試合結果</h1><span class="team"><span class="sym diamond t-a" aria-hidden="true"></span> TEAM A · あなた</span></section>
        <section class="report-table"><span class="eyebrow">RESULT · 最終順位</span><ol class="result-standings" aria-label="最終順位"></ol><p data-result-rule>生存陣営をチケット順、脱落陣営を脱落が遅い順に順位付け。同点・同時脱落は同順位です。</p></section></div>
      <div class="result-actions"><button data-action="download" class="btn-light">診断JSONを保存</button><button data-action="reset" class="btn-light">設定に戻る</button><button data-action="replay" class="cta" aria-label="同じ設定でもう一戦"><span><b>REMATCH</b><small>同じ設定でもう一戦</small></span><i aria-hidden="true">→</i></button></div></div></dialog>
    <dialog class="master-outdated-dialog" aria-labelledby="outdated-title"><h2 id="outdated-title">マスタ標準値の更新</h2><p>標準値が更新されています。標準値へ戻しますか？</p><div class="outdated-actions"><button type="button" data-action="outdated-reset" class="primary">戻す</button><button type="button" data-action="outdated-dismiss">このまま</button></div></dialog>`;
  const find = <T extends Element>(selector: string): T =>
    app.querySelector<T>(selector)!;
  const action = (id: string): HTMLButtonElement =>
    find(`[data-action="${id}"]`);
  const elements: HudElements = {
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
    outdatedDialog: find('.master-outdated-dialog'),
    units: find('.unit-list'),
    status: find('.status'),
    panel: null,
    selectedBaseId: 'HQ-A',
    multiSelect: false,
    researchDomain: 'power',
  };
  setHudPanel(elements, null);
  return elements;
}
const PANEL_TITLES: Partial<Record<Exclude<HudPanel, null>, string>> = {
  production: '部隊生産',
  facilities: '防御施設',
  crossings: '橋・索道',
};
export function setHudPanel(
  elements: HudElements,
  panel: HudPanel,
  baseId?: string,
): void {
  elements.panel = panel;
  if (baseId !== undefined) elements.selectedBaseId = baseId;
  const root = elements.root;
  const sheetPanel =
    panel === 'production' || panel === 'facilities' || panel === 'crossings';
  root.querySelector<HTMLElement>('.base-sheet')!.hidden = !sheetPanel;
  root.querySelector<HTMLElement>('.research-sheet')!.hidden =
    panel !== 'research';
  root.querySelector<HTMLElement>('.base-pop')!.hidden = panel !== 'base';
  root
    .querySelector<HTMLElement>('.addon-dock')!
    .classList.toggle('expanded', panel === 'abilities');
  for (const section of root.querySelectorAll<HTMLElement>(
    '.base-sheet [data-panel], .addon-dock [data-panel]',
  ))
    section.hidden = section.dataset.panel !== panel;
  root.querySelector<HTMLElement>('[data-panel-title]')!.textContent =
    (panel && PANEL_TITLES[panel]) ?? '';
  root.dataset.panel = panel ?? '';
  for (const name of [
    'production',
    'research',
    'bases',
    'crossings',
    'facilities',
    'abilities',
  ]) {
    for (const button of root.querySelectorAll(`[data-action="${name}"]`)) {
      button.setAttribute(
        'aria-expanded',
        String(panel === (name === 'bases' ? 'base' : name)),
      );
    }
  }
  root
    .querySelector('[data-action="base-sheet"]')!
    .setAttribute('aria-expanded', String(sheetPanel));
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
  if (!isUnitUnlocked(view.ownFaction, view.rules, kind)) {
    const candidates = Object.entries(view.rules.research.definitions)
      .filter(([, definition]) =>
        definition.effects.some(
          (effect) => effect.id === 'unit-unlock' && effect.unitKind === kind,
        ),
      )
      .map(([id]) => researchName(id, view));
    return candidates.length
      ? `研究「${candidates.join(' / ')}」のいずれかが必要です`
      : 'この兵種を解放する研究が登録されていません';
  }
  if (stats.movementDomain === 'water') {
    if (
      !view.map.ports?.some(
        (port) => port.id === siteId && port.factionId === view.viewerFactionId,
      )
    )
      return '自陣の港を選んでください';
  } else {
    const base = view.bases.find(
      (base) => base.id === siteId && base.visibility === 'owned',
    );
    if (!base || base.visibility !== 'owned' || base.hp <= 0)
      return '稼働中の自軍拠点を選んでください';
    if (
      base.kind !== 'hq' &&
      !view.ownFaction.completedResearchIds.includes('specialization-logistics')
    )
      return '前線生産には専攻・前線展開が必要です';
  }
  const ownedBases = view.bases.filter(
    (base) => base.visibility === 'owned' && base.kind !== 'hq' && base.hp > 0,
  ).length;
  const { baseUnits, unitsPerOwnedBase, maxUnits } = view.rules.limits;
  const limit = Math.min(maxUnits, baseUnits + ownedBases * unitsPerOwnedBase);
  if (view.ownUnits.length + view.ownFaction.productionJobs.length >= limit)
    return `部隊上限${limit}（拠点${ownedBases}、予約を含む）`;
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
  updateTicketsHud(elements, snapshot);
  text('.tick-readout', `TICK ${view.tick} · ${view.phase.toUpperCase()}`);
  elements.root.dataset.phase = view.phase;
  const initialTickets = Math.max(
    1,
    view.rules.match.initialTicketsCenti,
    ...(['A', 'B', 'C'] as const).map((id) => view.ticketsCenti[id]),
  );
  const ranked = (['A', 'B', 'C'] as const)
    .slice()
    .sort((a, b) => view.ticketsCenti[b] - view.ticketsCenti[a]);
  for (const id of ['A', 'B', 'C'] as const) {
    const eliminated = view.publicEliminations[id].eliminatedAtTick !== null;
    text(
      `[data-ticket="${id}"]`,
      `${amount(view.ticketsCenti[id])}${eliminated ? ' · 脱落' : ''}`,
    );
    text(
      `[data-rank="${id}"]`,
      eliminated
        ? 'OUT'
        : `#${ranked.findIndex((entry) => view.ticketsCenti[entry] === view.ticketsCenti[id]) + 1}`,
    );
    elements.root.querySelector<HTMLElement>(
      `[data-ticket-bar="${id}"]`,
    )!.style.width =
      `${Math.max(0, Math.min(100, (100 * view.ticketsCenti[id]) / initialTickets))}%`;
    elements.root
      .querySelector(`.ticket.legend-${id.toLowerCase()}`)!
      .classList.toggle('out', eliminated);
  }
  const remainingTicks = Math.max(0, view.timeLimitTicks - view.tick);
  const clock = `${Math.floor(remainingTicks / 600)}:${String(Math.floor(remainingTicks / 10) % 60).padStart(2, '0')}`;
  text('[data-timer]', clock);
  const elapsedShare =
    view.timeLimitTicks > 0 ? view.tick / view.timeLimitTicks : 0;
  text(
    '[data-phase-name]',
    view.phase === 'ready'
      ? 'READY'
      : view.phase === 'paused'
        ? 'PAUSED'
        : view.phase === 'finished'
          ? 'END'
          : elapsedShare < 1 / 3
            ? 'EARLY'
            : elapsedShare < 2 / 3
              ? 'MID'
              : 'LATE',
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
  const scenarioLabel: Partial<Record<ScenarioId, string>> = {
    'f06-local-faction': '現地勢力',
    'f08-unit-domains': '6兵種・陸空水',
    'f10-base-upgrades': '拠点強化',
    'f15-tactical-abilities': '作戦指令',
    'f86-point-fire': '地点砲撃',
    'f87-specializations': 'CP13専攻',
    'f88-combat-estimate': '戦闘見込み',
    'f120-combat-estimate-ui': '見込み表示',
    'f121-combat-visibility': '交戦表示',
  };
  const npcStopped =
    view.scenarioId.startsWith('g2-') ||
    view.scenarioId === 'f02-pursuit' ||
    view.scenarioId === 'f05-neutral-defense' ||
    view.scenarioId === 'f08-unit-domains' ||
    view.scenarioId === 'f10-base-upgrades' ||
    view.scenarioId === 'f15-tactical-abilities' ||
    view.scenarioId === 'f86-point-fire' ||
    view.scenarioId === 'f87-specializations' ||
    view.scenarioId === 'f88-combat-estimate' ||
    view.scenarioId === 'f120-combat-estimate-ui' ||
    view.scenarioId === 'f121-combat-visibility';
  const scenarioName =
    view.scenarioId === 'standard'
      ? '通常設定 · NPC2陣営'
      : `検査：${scenarioLabel[view.scenarioId] ?? view.scenarioId}${npcStopped ? ' · NPC停止' : ''}`;
  text('.scenario-badge', `${scenarioName} · 残り ${clock}`);
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
    for (const card of researchCards.querySelectorAll('[data-research-card]'))
      card.remove();
    for (const id of researchIds) {
      const def = view.rules.research.definitions[id]!;
      const card = document.createElement('article');
      card.className = 'nd action-card';
      card.dataset.researchCard = id;
      card.dataset.domain = def.domain;
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
      researchCards
        .querySelector<HTMLElement>(
          `[data-tier="${Math.max(1, Math.min(4, def.stage))}"]`,
        )!
        .append(card);
    }
  }
  for (const button of elements.root.querySelectorAll<HTMLButtonElement>(
    '[data-research-domain]',
  )) {
    const domain = button.dataset.researchDomain as ResearchDomain;
    const active = domain === elements.researchDomain;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', String(active));
    const ids = researchIds.filter(
      (id) => view.rules.research.definitions[id]!.domain === domain,
    );
    text(
      `[data-research-domain-count="${domain}"]`,
      `${ids.filter((id) => own.completedResearchIds.includes(id)).length} / ${ids.length}`,
    );
  }
  for (const card of researchCards.querySelectorAll<HTMLElement>(
    '[data-research-card]',
  ))
    card.hidden = card.dataset.domain !== elements.researchDomain;
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
      ? ` · 前提いずれか ${def.prerequisites.map((id) => researchName(id, view)).join('・')}`
      : '';
    const exclusions = def.exclusiveWith.length
      ? ` · 排他 ${def.exclusiveWith.map((id) => researchName(id, view)).join('・')}`
      : '';
    text(
      `[data-research-details="${id}"]`,
      `${domainName} ${def.stage} · 次の充填時に必要${amount(researchCostForFaction(view.rules, own, id))}ポイント · ${def.effects.map(effectLabel).join('、')}${prerequisite}${exclusions}`,
    );
  }
  text(
    '[data-capture-help]',
    `中立拠点は守備を撃破し、拠点HPを0にしてから半径${view.rules.capture.radius}へ自軍だけが${seconds(view.rules.capture.requiredTicks)}いると制圧できます。`,
  );
  text('[data-supply]', amount(own.supplyCenti));
  text('[data-sheet-supply]', amount(own.supplyCenti));
  text('[data-research-bank]', (own.researchCenti / 100).toFixed(1));
  text('[data-research-points]', (own.researchCenti / 100).toFixed(1));
  const income =
      view.rules.economy.flatSupplyIncomeCentiPerTick +
      researchEffectValue(own, view.rules, 'supply-income-bonus'),
    rp = view.rules.research.baseIncomeCentiPerTick,
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
  const incomeStopped =
    own.eliminatedAtTick !== null || view.phase === 'finished';
  const net = (income - upkeep) / 10;
  text(
    '[data-income]',
    incomeStopped
      ? '収入停止'
      : `${net >= 0 ? '+' : '−'}${Math.abs(net).toFixed(2)}/秒 · 維持 −${(upkeep / 10).toFixed(2)}`,
  );
  elements.root
    .querySelector('[data-income]')!
    .classList.toggle('negative', !incomeStopped && net < 0);
  text(
    '[data-research-rate]',
    incomeStopped ? '研究停止' : `+${(rp / 10).toFixed(1)}/秒`,
  );
  text('[data-research-points-rate]', `+${(rp / 10).toFixed(1)}/秒`);
  text(
    '[data-research-status]',
    own.eliminatedAtTick !== null
      ? '脱落 · 研究停止'
      : own.activeResearch
        ? `${researchName(own.activeResearch.researchId, view)} 充填 ${((own.researchProgressCenti[own.activeResearch.researchId] ?? 0) / 100).toFixed(1)}pt`
        : `バンク中 · 研究完了 ${own.completedResearchIds.length}/${Object.keys(view.rules.research.definitions).length}`,
  );
  const latestResearchNotice = view.researchAnnouncements?.at(-1);
  text(
    '[data-research-announcement]',
    latestResearchNotice
      ? `専攻完成 · ${latestResearchNotice.factionId} ${researchName(latestResearchNotice.researchId, view)}`
      : '',
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
  const visibleTarget = (
    targetId: string | null | undefined,
  ): string | null => {
    if (!targetId) return null;
    const unit = [...view.ownUnits, ...view.visibleEnemies].find(
      (entry) => entry.id === targetId,
    );
    if (unit) return `${targetId} ${kindName(unit.kind)}`;
    const base = view.bases.find(
      (entry) =>
        entry.id === targetId &&
        (entry.visibility === 'visible' || entry.visibility === 'owned'),
    );
    if (base) return `${targetId} 拠点`;
    const facility = view.facilities.find(
      (entry) =>
        entry.id === targetId &&
        (entry.visibility === 'visible' || entry.visibility === 'owned'),
    );
    return facility ? `${targetId} 施設` : null;
  };
  let combatText = '';
  if (selectedUnits.length === 1 && selected) {
    const strike = own.pendingStrikes.find(
      (entry) => entry.sourceUnitId === selected.id,
    );
    if (selected.bombardOrder)
      combatText = `地点砲撃準備 · ${selected.bombardOrder.cell.x},${selected.bombardOrder.cell.y} · 発射まで ${seconds(Math.max(0, selected.bombardOrder.fireAtTick - view.tick))}`;
    else if (strike)
      combatText = `地点砲撃飛翔 · ${strike.cell.x},${strike.cell.y} · 着弾まで ${seconds(Math.max(0, strike.impactTick - view.tick))}`;
    else if (selected.attack?.phase === 'windup')
      combatText = `攻撃準備${visibleTarget(selected.attack.targetId) ? ` → ${visibleTarget(selected.attack.targetId)}` : ' · 対象は視界外'}`;
    else if (selected.attack?.phase === 'cooldown')
      combatText = '攻撃後の周期待ち';
    if (
      selected.lastDamagedTick !== undefined &&
      view.tick - selected.lastDamagedTick <= 2
    )
      combatText = `${combatText ? `${combatText} · ` : ''}被弾`;
  }
  text('[data-selection-combat]', combatText);
  const pointFireButton = elements.root.querySelector<HTMLButtonElement>(
    '[data-action="point-fire"]',
  )!;
  const pointFireResearch = own.completedResearchIds.includes(
    'specialization-power',
  );
  pointFireButton.hidden =
    selectedUnits.length !== 1 ||
    selectedUnits[0]?.kind !== 'artillery' ||
    !pointFireResearch;
  pointFireButton.disabled =
    view.phase !== 'running' ||
    snapshot.contextLost ||
    own.eliminatedAtTick !== null ||
    selectedUnits[0]?.path.length !== 0 ||
    selectedUnits[0]?.garrisonedAtBaseId != null;
  pointFireButton.title = `射程${view.rules.artilleryBombardment.range} · 観測時着弾${seconds(view.rules.artilleryBombardment.observedImpactTicks)}/散布${(view.rules.artilleryBombardment.observedScatterRadius1024 / 1024).toFixed(1)} · 未観測${seconds(view.rules.artilleryBombardment.unobservedImpactTicks)}/散布${(view.rules.artilleryBombardment.unobservedScatterRadius1024 / 1024).toFixed(1)} · 待ち${seconds(view.rules.artilleryBombardment.intervalTicks)}`;
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
    selectionInstruction = selected.garrisonedAtBaseId
      ? `駐留中 · 地面へ移動指示で ${selected.garrisonedAtBaseId} から出撃`
      : selected.path.length
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
  const artilleryWarning = own.incomingArtilleryWarnings[0];
  const artilleryAlertButton = elements.root.querySelector<HTMLButtonElement>(
    '[data-action="focus-artillery-warning"]',
  )!;
  artilleryAlertButton.hidden = artilleryWarning === undefined;
  if (artilleryWarning) {
    artilleryAlertButton.dataset.x = String(artilleryWarning.cell.x);
    artilleryAlertButton.dataset.y = String(artilleryWarning.cell.y);
    artilleryAlertButton.textContent = `砲撃警告 ${artilleryWarning.cell.x},${artilleryWarning.cell.y} · ${seconds(Math.max(0, artilleryWarning.impactTick - view.tick))}`;
  }
  const expected = view.ownUnits.map((unit) => unit.id).join('|');
  if (elements.units.dataset.ids !== expected) {
    elements.units.dataset.ids = expected;
    elements.units.replaceChildren(
      ...view.ownUnits.map((unit) => {
        const node = document.createElement('button');
        node.type = 'button';
        node.dataset.unit = unit.id;
        node.className = 'unit-card squad t-a';
        const title = document.createElement('strong');
        title.className = 'no';
        title.textContent = unit.id.replace(/^[A-C]-/, '');
        const kind = document.createElement('span');
        kind.className = 'ty';
        const state = document.createElement('span');
        state.className = 'st';
        const label = document.createElement('small');
        const bar = document.createElement('span');
        bar.className = 'bar';
        bar.append(document.createElement('i'));
        node.append(title, kind, state, label, bar);
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
    node.classList.toggle(
      'fight',
      unit.attack?.phase === 'windup' || unit.attack?.phase === 'cooldown',
    );
    node.setAttribute('aria-pressed', String(selected));
    node.querySelector('.ty')!.textContent = kindName(unit.kind);
    node.querySelector('.st')!.textContent = unit.garrisonedAtBaseId
      ? '⌂'
      : unit.marchOrder
        ? '→'
        : unit.path.length
          ? '▸'
          : '';
    node.querySelector('small')!.textContent =
      `${unit.hp}/${unit.maxHp}${unit.garrisonedAtBaseId ? ` · 駐留 ${unit.garrisonedAtBaseId}` : ''}`;
    const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
    const fill = node.querySelector<HTMLElement>('.bar > i')!;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    fill.dataset.level = ratio > 0.6 ? 'ok' : ratio > 0.3 ? 'warn' : 'danger';
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
  const ownedBases = view.bases.filter(
    (base) => base.visibility === 'owned' && base.kind !== 'hq' && base.hp > 0,
  ).length;
  const { baseUnits, unitsPerOwnedBase, maxUnits } = view.rules.limits;
  const unitLimit = Math.min(
    maxUnits,
    baseUnits + ownedBases * unitsPerOwnedBase,
  );
  text(
    '.production-summary',
    `部隊 ${view.ownUnits.length}＋予約 ${own.productionJobs.length} / 上限${unitLimit}（拠点${ownedBases}） · 共通キュー`,
  );
  const siteSelect = elements.root.querySelector<HTMLSelectElement>(
    '[data-production-site]',
  )!;
  const sites = [
    {
      id: `HQ-${view.viewerFactionId}`,
      label: `首都 HQ-${view.viewerFactionId}`,
    },
    ...(own.completedResearchIds.includes('specialization-logistics')
      ? view.bases
          .filter(
            (base) =>
              base.visibility === 'owned' && base.kind !== 'hq' && base.hp > 0,
          )
          .map((base) => ({ id: base.id, label: `前線 ${base.id}` }))
      : []),
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
        card.className = 'u action-card';
        const button = document.createElement('button');
        button.dataset.produce = kind;
        button.textContent = `${kindGlyph(kind)} ${kindName(kind)}を生産`;
        const cost = document.createElement('b');
        cost.className = 'cost';
        cost.dataset.unitCost = kind;
        const detail = document.createElement('small');
        detail.dataset.unitDetails = kind;
        const reason = document.createElement('span');
        reason.dataset.productionReason = kind;
        card.append(button, cost, detail, reason);
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
    const produceButton = elements.root.querySelector<HTMLButtonElement>(
      `[data-produce="${kind}"]`,
    )!;
    produceButton.disabled = reason !== null || snapshot.contextLost;
    produceButton.closest('.u')?.classList.toggle('locked', reason !== null);
    text(`[data-unit-cost="${kind}"]`, amount(stats.costCenti));
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
        const bar = document.createElement('span');
        bar.className = 'bar';
        bar.append(document.createElement('i'));
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.dataset.cancelJob = job.id;
        cancel.textContent = '取消・返金';
        row.append(label, bar, cancel);
        return row;
      }),
    );
    if (!own.productionJobs.length) queue.textContent = '生産予約はありません';
  }
  for (const job of own.productionJobs) {
    const row = queue.querySelector<HTMLElement>(`[data-job="${job.id}"]`)!;
    row.querySelector('span')!.textContent =
      `${kindName(job.unitKind)} · ${job.status === 'active' ? `生産中 ${seconds(job.remainingTicks)}` : '待機中'}`;
    const total = view.rules.units[job.unitKind].buildTicks;
    row.querySelector<HTMLElement>('.bar > i')!.style.width =
      job.status === 'active' && total > 0
        ? `${Math.max(0, Math.min(100, Math.round(100 * (1 - job.remainingTicks / total))))}%`
        : '0%';
    row.classList.toggle('waiting', job.status !== 'active');
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
    const cost = researchCostForFaction(view.rules, own, id);
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
            : def.prerequisites.length > 0 &&
                !def.prerequisites.some((id) =>
                  own.completedResearchIds.includes(id),
                )
              ? `前提いずれか：${def.prerequisites
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
    button.textContent = `${researchName(id, view)}${done ? ' · 完了' : active ? ' · 選択中' : 'を選択'}`;
    const card = button.closest<HTMLElement>('[data-research-card]');
    if (card) {
      card.classList.toggle('done', done);
      card.classList.toggle('doing', active);
      card.classList.toggle(
        'ex',
        !done && !active && reason !== null && view.phase === 'running',
      );
      card.classList.toggle('exclusive', def.exclusiveWith.length > 0);
    }
    text(
      `[data-research-reason="${id}"]`,
      reason ??
        `${active ? '充填中' : progress > 0 ? '進捗保持' : '選択可能'} · ${(progress / 100).toFixed(1)} / ${(cost / 100).toFixed(1)}pt`,
    );
    const bar = elements.root.querySelector<HTMLProgressElement>(
      `[data-research-progress="${id}"]`,
    )!;
    bar.value = (100 * progress) / cost;
    bar.setAttribute('aria-label', `${researchName(id, view)}の充填率`);
  }
  const activeResearchId = own.activeResearch?.researchId;
  text(
    '[data-research-now]',
    activeResearchId ? researchName(activeResearchId, view) : 'バンク中',
  );
  elements.root.querySelector<HTMLElement>(
    '[data-research-now-bar]',
  )!.style.width = activeResearchId
    ? `${Math.min(100, (100 * (own.researchProgressCenti[activeResearchId] ?? 0)) / researchCostForFaction(view.rules, own, activeResearchId))}%`
    : '0%';
  const jammedUnits = view.ownUnits.filter((unit) => unit.jammed);
  text(
    '[data-facility-jam]',
    jammedUnits.length
      ? `妨害中：自軍${jammedUnits.length}部隊の視界が低下しています`
      : '',
  );
  updateFacilitiesPanel(elements.root, view, snapshot.contextLost);
  const abilityHost = elements.root.querySelector<HTMLElement>(
    '.tactical-abilities',
  )!;
  if (abilityHost.dataset.ids !== TACTICAL_ABILITY_IDS.join('|')) {
    abilityHost.dataset.ids = TACTICAL_ABILITY_IDS.join('|');
    abilityHost.replaceChildren(
      ...TACTICAL_ABILITY_IDS.map((abilityId) => {
        const card = document.createElement('article');
        card.className = 'tactical-ability-card';
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.ability = abilityId;
        const details = document.createElement('small');
        details.dataset.abilityDetails = abilityId;
        const status = document.createElement('span');
        status.dataset.abilityStatus = abilityId;
        card.append(button, details, status);
        return card;
      }),
    );
  }
  const abilitySummaries = {
    artillery: (
      rules: FactionView['rules']['tacticalAbilities']['artillery'],
    ) =>
      `補給${amount(rules.costCenti)} · ${seconds(rules.durationTicks)}後に半径${rules.radius}、部隊${rules.unitDamage}/構造物${rules.structureDamage}damage · 待ち${seconds(rules.cooldownTicks)}`,
    surge: (rules: FactionView['rules']['tacticalAbilities']['surge']) =>
      `補給${amount(rules.costCenti)} · ${seconds(rules.durationTicks)}間、生産時間${rules.productionTimePercent}%・追加補給${amount(rules.supplyGrantCenti)} · 待ち${seconds(rules.cooldownTicks)}`,
    smoke: (rules: FactionView['rules']['tacticalAbilities']['smoke']) =>
      `補給${amount(rules.costCenti)} · 半径${rules.radius}の非交戦部隊を${seconds(rules.durationTicks)}隠す · 待ち${seconds(rules.cooldownTicks)}`,
    bulwark: (rules: FactionView['rules']['tacticalAbilities']['bulwark']) =>
      `補給${amount(rules.costCenti)} · ${seconds(rules.durationTicks)}間、構造物damage${rules.damageTakenPercent}% · 待ち${seconds(rules.cooldownTicks)}`,
    survey: (rules: FactionView['rules']['tacticalAbilities']['survey']) =>
      `補給${amount(rules.costCenti)} · 半径${rules.radius}を${seconds(rules.durationTicks)}観測 · 待ち${seconds(rules.cooldownTicks)}`,
    jam: (rules: FactionView['rules']['tacticalAbilities']['jam']) =>
      `補給${amount(rules.costCenti)} · 対象視界を${rules.visionPercent}%に${seconds(rules.durationTicks)} · 待ち${seconds(rules.cooldownTicks)}`,
  };
  const possibleJamTargets = (['A', 'B', 'C'] as const).filter(
    (factionId) =>
      factionId !== view.viewerFactionId &&
      view.publicEliminations[factionId].eliminatedAtTick === null,
  );
  const abilityTarget = elements.root.querySelector<HTMLSelectElement>(
    '[data-ability-target]',
  )!;
  const abilityTargetIds = possibleJamTargets.join('|');
  if (abilityTarget.dataset.targets !== abilityTargetIds) {
    const previous = abilityTarget.value;
    abilityTarget.replaceChildren(
      ...possibleJamTargets.map((factionId) => {
        const option = document.createElement('option');
        option.value = factionId;
        option.textContent = `陣営 ${factionId}`;
        return option;
      }),
    );
    abilityTarget.dataset.targets = abilityTargetIds;
    if (
      possibleJamTargets.includes(
        previous as (typeof possibleJamTargets)[number],
      )
    )
      abilityTarget.value = previous;
  }
  abilityTarget.disabled =
    possibleJamTargets.length === 0 ||
    view.phase !== 'running' ||
    snapshot.contextLost;
  for (const abilityId of TACTICAL_ABILITY_IDS) {
    const rules = view.rules.tacticalAbilities[abilityId];
    const readyAtTick = own.abilityReadyAtTick[abilityId];
    const onCooldown = view.tick < readyAtTick;
    const lowSupply = own.supplyCenti < rules.costCenti;
    const button = elements.root.querySelector<HTMLButtonElement>(
      `[data-ability="${abilityId}"]`,
    )!;
    button.disabled =
      view.phase !== 'running' ||
      snapshot.contextLost ||
      own.eliminatedAtTick !== null ||
      onCooldown ||
      lowSupply ||
      (abilityId === 'jam' && possibleJamTargets.length === 0);
    const kind =
      abilityId === 'artillery' ||
      abilityId === 'smoke' ||
      abilityId === 'survey'
        ? ' · 地点指定'
        : abilityId === 'jam'
          ? ' · 陣営指定'
          : ' · 発動';
    button.textContent = TACTICAL_ABILITY_LABELS[abilityId];
    button.dataset.kind = kind.replace(' · ', '');
    button.setAttribute(
      'aria-label',
      `${TACTICAL_ABILITY_LABELS[abilityId]}${kind}`,
    );
    const abilityCard = button.closest<HTMLElement>('.tactical-ability-card');
    abilityCard?.classList.toggle('cd', onCooldown);
    abilityCard?.classList.toggle('low', !onCooldown && lowSupply);
    abilityCard?.classList.toggle('ready', !button.disabled);
    abilityCard?.setAttribute('title', abilitySummaries[abilityId](rules));
    elements.root.querySelector<HTMLElement>(
      `[data-ability-details="${abilityId}"]`,
    )!.textContent = abilitySummaries[abilityId](rules);
    text(
      `[data-ability-status="${abilityId}"]`,
      onCooldown
        ? `待機中 · 残り${seconds(readyAtTick - view.tick)}`
        : lowSupply
          ? `補給不足 · ${amount(rules.costCenti)}`
          : `発動可能 · ${amount(rules.costCenti)}`,
    );
  }
  const activeAbilityEffects = [
    own.completedResearchIds.includes('specialization-information') &&
    view.rules.cp87.globalObservationPeriodTicks > 0 &&
    view.tick % view.rules.cp87.globalObservationPeriodTicks <
      view.rules.cp87.globalObservationDurationTicks
      ? `全域観測 残り${seconds(view.rules.cp87.globalObservationDurationTicks - (view.tick % view.rules.cp87.globalObservationPeriodTicks))}`
      : '',
    own.productionBoostUntilTick > view.tick
      ? `増産 残り${seconds(own.productionBoostUntilTick - view.tick)}`
      : '',
    own.bulwarkUntilTick > view.tick
      ? `鉄壁 残り${seconds(own.bulwarkUntilTick - view.tick)}`
      : '',
    own.jammedUntilTick > view.tick
      ? `視界妨害 残り${seconds(own.jammedUntilTick - view.tick)}`
      : '',
    own.activeSmokeUntilTick > view.tick
      ? `煙幕 残り${seconds(own.activeSmokeUntilTick - view.tick)}`
      : '',
    own.activeSurveyUntilTick > view.tick
      ? `広域観測 残り${seconds(own.activeSurveyUntilTick - view.tick)}`
      : '',
    ...own.pendingStrikes.map(
      (strike) =>
        `砲撃着弾まで${seconds(Math.max(0, strike.impactTick - view.tick))}`,
    ),
  ].filter(Boolean);
  text(
    '[data-ability-active]',
    activeAbilityEffects.length > 0
      ? `進行中：${activeAbilityEffects.join(' · ')}`
      : '',
  );
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
        const moveA = document.createElement('button');
        moveA.dataset.crossingEndpoint = `${site.id}:A`;
        moveA.textContent = 'A端へ移動';
        moveA.setAttribute('aria-label', `${site.id} A端へ移動`);
        const moveB = document.createElement('button');
        moveB.dataset.crossingEndpoint = `${site.id}:B`;
        moveB.textContent = 'B端へ移動';
        moveB.setAttribute('aria-label', `${site.id} B端へ移動`);
        const build = document.createElement('button');
        build.dataset.crossingBuild = site.id;
        build.textContent = '建設';
        const dismantle = document.createElement('button');
        dismantle.dataset.crossingDismantle = site.id;
        dismantle.textContent = '解体';
        const reason = document.createElement('small');
        reason.className = 'crossing-reason';
        row.append(title, status, moveA, moveB, build, dismantle, reason);
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
    const siteNumber =
      (view.map.crossingSites ?? []).findIndex(({ id }) => id === site.id) + 1;
    row.querySelector('strong')!.textContent =
      `${crossingName(site.tier)} ${siteNumber} · ${site.id}`;
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
      buildReason = `部隊を端点へ移動してください (A ${site.bankA.x},${site.bankA.y} / B ${site.bankB.x},${site.bankB.y})`;
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
  let upgradeReason = '自軍所有の稼働拠点を選ぶと強化できます';
  const upgradeButton = elements.root.querySelector<HTMLButtonElement>(
    '[data-action="upgrade-base"]',
  )!;
  const garrisonButton = elements.root.querySelector<HTMLButtonElement>(
    '[data-action="garrison"]',
  )!;
  const marchButton = elements.root.querySelector<HTMLButtonElement>(
    '[data-action="march-base"]',
  )!;
  marchButton.disabled =
    base === undefined ||
    selectedUnits.length === 0 ||
    view.phase !== 'running' ||
    snapshot.contextLost ||
    own.eliminatedAtTick !== null;
  marchButton.title =
    selectedUnits.length === 0
      ? '先に自軍部隊を選択してください'
      : `選択中の${selectedUnits.length}部隊を${base?.id ?? ''}へ進軍`;
  upgradeButton.hidden = base?.visibility !== 'owned';
  upgradeButton.disabled = true;
  upgradeButton.textContent = '拠点を強化';
  garrisonButton.hidden = base?.visibility !== 'owned';
  const selectedCanGarrison =
    selectedUnits.length > 0 &&
    selectedUnits.every((unit) => view.rules.units[unit.kind].canGarrison);
  garrisonButton.disabled =
    base?.visibility !== 'owned' ||
    !selectedCanGarrison ||
    view.phase !== 'running' ||
    snapshot.contextLost ||
    own.eliminatedAtTick !== null;
  garrisonButton.textContent =
    selectedUnits.length > 0 && !selectedCanGarrison
      ? '選択部隊に駐留不可の兵種があります'
      : '選択部隊を駐留';
  if (base) {
    const location = `${base.id} (${base.cell.x},${base.cell.y})`;
    if (base.visibility === 'unknown')
      detail = `${location}\n未観測：所有・HPは不明`;
    else if (base.visibility === 'remembered')
      detail = `${location}\n最終観測 TICK ${base.seenTick}：${baseOwnerName(base.owner)} / HP${base.hp}${base.defenderMaxHp > 0 ? ` / 守備${base.defenderHp}/${base.defenderMaxHp}` : ''}\n${base.selfReportedLost ? '自軍の所有喪失を確認。現在の所有者は不明。' : '現在の状態は不明です。'}`;
    else {
      const level = base.level;
      detail = `${location}\n所有：${baseOwnerName(base.owner)} · Lv${level} · HP${base.hp}/${base.maxHp}${base.defenderMaxHp === null ? '' : `\n中立守備：${base.defenderHp === 0 ? '撃破済み' : `${base.defenderHp}/${base.defenderMaxHp}`}`}\n${base.captureCandidate ? `${base.captureCandidate} 制圧 ${Math.floor((base.captureProgressCentiTicks / (view.rules.capture.requiredTicks * 100)) * 100)}%` : base.defenderHp !== null && base.defenderHp > 0 ? '守備を撃破してください' : base.owner === null && base.hp > 0 ? '守備撃破済み · 拠点HPを0にしてください' : base.hp > 0 ? '稼働中' : base.kind === 'hq' ? '破壊済み・再建なし' : '中立・制圧可能'}`;
      if (base.visibility === 'owned') {
        if (base.upgradeJob) {
          upgradeReason = `Lv${base.upgradeJob.targetLevel}へ強化中 · 残り${seconds(base.upgradeJob.remainingTicks)}`;
        } else if (level >= 3) {
          upgradeReason = '最大レベルです';
        } else if (
          base.kind === 'hq' &&
          base.id !== `HQ-${view.viewerFactionId}`
        ) {
          upgradeReason = '首都は元の所有陣営のみ強化できます';
        } else {
          const targetLevel = (level + 1) as 2 | 3;
          const tier = baseUpgradeTier(base.kind, targetLevel, view.rules);
          if (maximumBaseLevel(own, view.rules) < targetLevel) {
            const candidates = Object.entries(view.rules.research.definitions)
              .filter(([, definition]) =>
                definition.effects.some(
                  (effect) =>
                    effect.id === 'base-upgrade-max' &&
                    effect.value >= targetLevel,
                ),
              )
              .map(([id]) => researchName(id, view));
            upgradeReason = candidates.length
              ? `研究「${candidates.join(' / ')}」のいずれかが必要です`
              : `Lv${targetLevel}を解放する研究が登録されていません`;
          } else if (base.hp <= 0 || view.phase !== 'running') {
            upgradeReason = '試合開始後、稼働中の拠点を強化できます';
          } else if (own.supplyCenti < tier.costCenti) {
            upgradeReason = `補給不足 · 必要 ${amount(tier.costCenti)}`;
          } else {
            upgradeReason = `完了後: 最大HP ${Math.ceil((view.rules.bases[base.kind].maxHp * tier.maxHpPercent) / 100)} · 砲座 ${tier.turretDamage} damage / 射程${tier.turretRange}`;
            upgradeButton.disabled =
              snapshot.contextLost || own.eliminatedAtTick !== null;
            upgradeButton.textContent = `Lv${targetLevel}へ強化 · 補給${amount(tier.costCenti)} · ${seconds(tier.buildTicks)}`;
          }
        }
      }
    }
  }
  if (base?.visibility === 'owned') {
    const garrison = view.ownUnits.filter(
      (unit) => unit.garrisonedAtBaseId === base.id,
    );
    detail += `\n駐留 ${garrison.length}/${view.rules.bases[base.kind].garrisonCapacity}`;
    if (garrison.length > 0)
      detail += ` · ${garrison
        .map(
          (unit) =>
            `${unit.id} ${kindName(unit.kind)} HP${unit.hp}/${unit.maxHp}`,
        )
        .join('、')}`;
  }
  text('.base-detail', detail);
  text('[data-upgrade-reason]', upgradeReason);
  const basePop = elements.root.querySelector<HTMLElement>('.base-pop')!;
  const popOwner =
    base === undefined || base.visibility === 'unknown' ? null : base.owner;
  basePop.dataset.owner = popOwner ?? 'neutral';
  text(
    '[data-base-eyebrow]',
    base === undefined
      ? 'BASE'
      : `${base.visibility === 'owned' ? 'OWN BASE' : popOwner === null ? 'NEUTRAL' : popOwner === 'local' ? 'LOCAL FORCE' : `TEAM ${popOwner}`} · ${baseKindName(base.kind)}`,
  );
  text(
    '[data-base-title]',
    base === undefined
      ? '拠点情報'
      : `${base.id}${base.visibility === 'visible' || base.visibility === 'owned' ? ` · Lv${base.level}` : ''}`,
  );
  text(
    '[data-base-glyph]',
    popOwner === 'A'
      ? '◆'
      : popOwner === 'B'
        ? '■'
        : popOwner === 'C'
          ? '⬡'
          : popOwner === 'local'
            ? '●'
            : '○',
  );
  elements.root.querySelector<HTMLElement>('[data-base-hp]')!.style.width =
    base &&
    (base.visibility === 'visible' || base.visibility === 'owned') &&
    base.maxHp > 0
      ? `${Math.round((100 * base.hp) / base.maxHp)}%`
      : '0%';
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
    const rankHost =
      elements.root.querySelector<HTMLElement>('[data-result-rank]')!;
    rankHost.replaceChildren(
      `#${playerStanding.rank}`,
      Object.assign(document.createElement('small'), {
        textContent: `/${result.standings.length}`,
      }),
    );
    dialog.dataset.outcome =
      result.reason === 'mutual-elimination'
        ? 'draw'
        : playerStanding.rank === 1
          ? 'win'
          : 'lose';
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
          row.textContent = `${tied ? '同率' : ''}${standing.rank}位 · ${symbol} ${standing.factionId}${standing.factionId === 'A' ? '（あなた）' : '（NPC）'} · チケット ${amount(standing.ticketsCenti)} · ${standing.eliminatedAtTick === null ? '生存' : `${(standing.eliminatedAtTick / 10).toFixed(1)}秒に脱落（${standing.eliminationReason === 'tickets' ? 'チケット0' : '首都陥落'}）`}`;
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
      if (unit.garrisonedAtBaseId) continue;
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
