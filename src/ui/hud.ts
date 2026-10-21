import { CONFIG } from '../config';
import { LEVEL as L } from '../map/level';
import { type Command, fortCount, fortMax, issue, livingCrew } from '../sim/commands';
import { hostageCount, instantlyReportable } from '../sim/rules';
import type { AutoMode, FortKind, Side, Unit } from '../sim/types';
import { MASK_NAMES, active, isRooftopAt, roomNameAt, securedBags } from '../sim/world';
import type { App } from './app';
import { money, selectedUnits } from './context';
import { morph } from './morph';

const FLAVOR = [
  '金相場 1オンス=4,812ドル 史上最高値を更新',
  'ハーバーライト銀行 創業90周年 定期預金金利を0.02%上乗せ',
  '市交通局：中央通りで午後から舗装工事 迂回にご協力を',
  '市警本部長「今年の銀行強盗件数は過去最少」',
  '天気：晴れのち曇り 夕方から局地的に雷雨のおそれ',
  'スポーツ：ハーバーシティ・ガルズ 延長戦を制し5連勝',
  '新型ドリル「グラインドマスター9000」発売 DIY愛好家に人気',
  '市立動物園のカワウソ「ノリ」の誕生日に300人が祝福',
  '【お詫び】昨夜の放送で金庫メーカー名に誤りがありました',
  '花屋「HARBOR FLOWERS」配送車 本日も市内を巡回中',
  '人気マスクブランド 動物シリーズが品薄に',
  '警備会社の求人倍率 過去最高 「時給より誇り」と担当者',
];

// フェーズは番号で示さず、ニュースのテロップの文面と色で間接的に伝える
const PHASE_TEXT: Record<string, { tag: string; lines: string[]; clock: string }> = {
  casing: {
    tag: 'LBN 24',
    lines: ['ハーバーライト銀行 中央支店前から中継', '本日も窓口は15時まで通常営業', '金相場は史上最高値 — 地下金庫の金塊にも注目', '支店長「当行の警備は万全です」'],
    clock: '閉店まで',
  },
  response: {
    tag: '速報',
    lines: ['銀行で強盗事件か — 通報受け警察が現場へ急行中', '付近の方は現場に近づかないでください', '店内には客が取り残されている模様'],
    clock: '警察到着まで',
  },
  assault: {
    tag: '緊急中継',
    lines: ['POLICE ASSAULT IN PROGRESS', '警察特殊部隊が突入を開始', '現場は騒然 — 上空から中継中'],
    clock: '包囲完了まで',
  },
  ended: { tag: '中継終了', lines: ['本日の中継はここまで — END OF BROADCAST'], clock: '' },
};

function mmss(s: number): string {
  const t = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (html) e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

export class Hud {
  root: HTMLElement;
  private phase: HTMLElement;
  private phaseTag: HTMLElement;
  private phaseTrack: HTMLElement;
  private phaseTimer: HTMLElement;
  private phaseCaption: HTMLElement;
  private phaseSub: HTMLElement;
  private trackText = '';
  private clock: HTMLElement;
  private role: HTMLElement;
  private funds: HTMLElement;
  private left: HTMLElement;
  private right: HTMLElement;
  private headline: HTMLElement;
  private tickerTrack: HTMLElement;
  private toastBox: HTMLElement;
  tooltip: HTMLElement;
  private lastPhase = '';
  private lastHeadline = '';
  private panelT = 0;
  private leftHtml = '';
  private rightHtml = '';
  private tickerSeen = 0;

  constructor(private app: App, parent: HTMLElement) {
    const root = el('div', 'hud', parent);
    this.root = root;
    const bug = el('div', 'bug', root);
    bug.innerHTML = `<div class="bug-logo"><b>LBN</b><span>24</span></div><div class="bug-live"><i></i>LIVE</div><div class="bug-loc">ハーバーライト銀行<br>中央支店前より中継</div>`;
    this.phase = el('div', 'phase', root);
    this.phaseTag = el('div', 'phase-tag', this.phase);
    const main = el('div', 'phase-main', this.phase);
    this.phaseTrack = el('div', 'phase-track', main);
    const tbox = el('div', 'phase-timer', this.phase);
    this.phaseCaption = el('small', '', tbox);
    this.phaseTimer = el('b', '', tbox);
    this.phaseSub = el('div', 'phase-sub', root);
    const clock = el('div', 'clock', root);
    this.clock = el('div', 'clock-time', clock);
    this.role = el('div', 'clock-role', clock);
    this.funds = el('div', 'clock-funds', clock);
    this.left = el('aside', 'panel panel-left', root);
    this.right = el('aside', 'panel panel-right', root);
    const lower = el('div', 'lower', root);
    const top = el('div', 'lower-top', lower);
    el('span', 'breaking', top, '速報<small>BREAKING</small>');
    this.headline = el('span', 'headline', top);
    const ticker = el('div', 'ticker', lower);
    el('span', 'ticker-label', ticker, 'LBN NEWS');
    const tw = el('div', 'ticker-window', ticker);
    this.tickerTrack = el('div', 'ticker-track', tw);
    this.tickerTrack.addEventListener('animationiteration', () => this.refreshTicker());
    this.toastBox = el('div', 'toasts', root);
    this.tooltip = el('div', 'tooltip', root);

    root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]');
      if (b && !b.hasAttribute('disabled')) this.onCommand(b.dataset.cmd!, b);
    });
    root.addEventListener('pointerdown', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-hold]');
      if (b) this.setObserve(true);
    });
    window.addEventListener('pointerup', () => {
      if (this.app.g.observe.holding && this.app.human === 'bank') this.setObserve(false);
    });
    this.refreshTicker();
  }

  setLayout(ts: number) {
    this.root.style.setProperty('--tile', `${ts}px`);
  }

  setObserve(holding: boolean) {
    const { g, view } = this.app;
    if (this.app.human !== 'bank') return;
    if (holding && view.observeTarget < 0) {
      this.app.toast('観察する人物をクリックで選んでください');
      return;
    }
    const err = issue(g, 'bank', { t: 'observe', target: view.observeTarget, holding });
    if (err && holding) this.app.toast(err);
  }

  toast(msg: string, kind: 'err' | 'info' = 'err') {
    const t = el('div', `toast ${kind}`, this.toastBox, msg);
    setTimeout(() => t.classList.add('out'), 2200);
    setTimeout(() => t.remove(), 2700);
    while (this.toastBox.children.length > 3) this.toastBox.firstElementChild?.remove();
  }

  private refreshTicker() {
    const g = this.app.g;
    const side = this.app.human;
    const items: string[] = [];
    const evs = g.events.filter((e) => e.vis === 'all' || e.vis === side || side === null).slice(-6);
    for (const e of evs.reverse()) items.push(`<b>${e.text}</b>`);
    const n = FLAVOR.length;
    for (let i = 0; i < 5; i++) items.push(FLAVOR[(this.tickerSeen + i) % n]!);
    this.tickerSeen += 2;
    this.tickerTrack.innerHTML = items.map((s) => `<span>${s}</span>`).join('<i>◆</i>');
    const len = this.tickerTrack.textContent?.length ?? 100;
    this.tickerTrack.style.animationDuration = `${Math.max(30, len * 0.28)}s`;
  }

  update(dt: number) {
    const { g, human } = this.app;
    const pt = PHASE_TEXT[g.phase]!;
    if (this.lastPhase !== g.phase) {
      this.lastPhase = g.phase;
      this.phase.className = `phase ${g.phase}`;
      this.phaseTag.textContent = pt.tag;
      this.phase.classList.add('flash');
      setTimeout(() => this.phase.classList.remove('flash'), 900);
      this.refreshTicker();
    }
    const hostages = hostageCount(g);
    const lines = [...pt.lines];
    if (hostages) lines.splice(1, 0, `人質 ${hostages}名`);
    if (g.negotiation.freeze > 0) lines.unshift('犯人側と交渉中 — 警察は一時待機');
    if (g.phase === 'assault' && g.holes.length) lines.push('警察が壁を爆破 — 複数方向から突入');
    const text = lines.join('　／　');
    if (text !== this.trackText) {
      this.trackText = text;
      this.phaseTrack.innerHTML = `<span>${text}</span><span>${text}</span>`;
      this.phaseTrack.style.animationDuration = `${Math.max(8, text.length * (g.phase === 'assault' ? 0.16 : 0.3))}s`;
    }
    const left = g.phase === 'casing' ? CONFIG.phase.casingSeconds : g.phase === 'response' ? CONFIG.phase.responseSeconds : CONFIG.phase.assaultSeconds;
    this.phaseCaption.textContent = pt.clock;
    this.phaseTimer.textContent = g.phase === 'ended' ? '--:--' : mmss(left - g.phaseTime);
    this.phaseSub.textContent = '';

    // 時計（偵察中は営業時間、以降は経過時間）
    const minutes = CONFIG.clock.open + (Math.min(g.time, CONFIG.phase.casingSeconds) / CONFIG.phase.casingSeconds) * (CONFIG.clock.close - CONFIG.clock.open) + Math.max(0, g.time - CONFIG.phase.casingSeconds) / 30;
    this.clock.textContent = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;
    this.role.textContent = human === 'crew' ? '強盗団 CREW' : human === 'bank' ? (g.phase === 'assault' ? '警察 POLICE' : '支店長 MANAGER') : '';
    this.role.className = `clock-role ${human ?? ''}`;
    if (human === 'bank' && g.phase === 'assault') this.funds.textContent = `指揮 ${Math.floor(g.cp)} CP`;
    else if (human) this.funds.textContent = money(g.funds[human]);
    else this.funds.textContent = `${money(g.funds.bank)} / ${money(g.funds.crew)}`;

    // 見出し
    const recent = g.events.filter((e) => e.big && (e.vis === 'all' || e.vis === human || human === null) && g.time - e.t < 14);
    let head = recent.length ? recent[recent.length - 1]!.text : '';
    if (!head) {
      if (g.phase === 'casing') head = 'ハーバーライト銀行 中央支店 — 本日も平常どおり営業中';
      else if (g.phase === 'response') head = '【速報】銀行強盗発生 — 警察が現場へ急行中';
      else if (g.phase === 'assault') head = `【中継】警察が突入 — 人質${hostages}名 強盗団は立てこもり`;
      else head = g.endReason;
    }
    if (head !== this.lastHeadline) {
      this.lastHeadline = head;
      this.headline.textContent = head;
      this.headline.classList.remove('in');
      void this.headline.offsetWidth;
      this.headline.classList.add('in');
    }
    if (this.tickerSeen === 0) this.refreshTicker();

    this.panelT -= dt;
    if (this.panelT <= 0) {
      this.panelT = 0.15;
      // 操作していないとき（タイトル裏の中継）はパネルを出さない
      const l = human === 'crew' ? this.crewLeft() : human === 'bank' ? this.bankLeft() : '';
      const r = human === 'crew' ? this.crewRight() : human === 'bank' ? this.bankRight() : '';
      if (l !== this.leftHtml) morph(this.left, (this.leftHtml = l));
      if (r !== this.rightHtml) morph(this.right, (this.rightHtml = r));
    }
  }

  // ---------- パネル ----------
  private btn(cmd: string, label: string, opts: { cost?: string; disabled?: boolean; key?: string; hot?: boolean; hold?: boolean; note?: string } = {}) {
    return `<button class="btn${opts.hot ? ' hot' : ''}" ${opts.hold ? 'data-hold="1"' : `data-cmd="${cmd}"`} ${opts.disabled ? 'disabled' : ''}>
      <span class="btn-label">${label}${opts.key ? `<kbd>${opts.key}</kbd>` : ''}</span>${opts.cost ? `<span class="btn-cost">${opts.cost}</span>` : ''}${opts.note ? `<span class="btn-note">${opts.note}</span>` : ''}</button>`;
  }

  private bar(p: number, cls: string) {
    return `<div class="bar ${cls}"><i style="width:${Math.round(Math.max(0, Math.min(1, p)) * 100)}%"></i></div>`;
  }

  // 自動行動の切り替え（選んだ全員が有効なら点灯、一部なら半点灯）
  private autoRow(sel: Unit[], side: Side) {
    const modes: [AutoMode, string][] = [
      ['intercept', '迎撃'],
      ['attack', '攻撃'],
      ['hostage', '人質'],
      ['roam', '徘徊'],
    ];
    const cells = modes
      .filter(([m]) => side === 'crew' || m !== 'hostage')
      .map(([m, label]) => {
        const n = sel.filter((u) => u.auto[m]).length;
        return `<button class="${n === sel.length ? 'on' : n ? 'part' : ''}" data-cmd="auto:${m}">${label}</button>`;
      });
    return `<h3>自動行動 <small>選んだ${sel.length}人に設定</small></h3><div class="seg">${cells.join('')}</div>`;
  }

  private autoTags(u: Unit) {
    const names: [AutoMode, string][] = [
      ['intercept', '迎撃'],
      ['attack', '攻撃'],
      ['hostage', '人質'],
      ['roam', '徘徊'],
    ];
    return names.filter(([m]) => u.auto[m]).map(([, n]) => `<em class="t auto">${n}</em>`).join('');
  }

  private bankName(u: Unit) {
    const same = this.app.g.units.filter((x) => x.kind === u.kind).sort((a, b) => a.id - b.id);
    return `${u.kind === 'swat' ? 'S' : 'G'}${same.indexOf(u) + 1}`;
  }

  private crewCard(u: Unit) {
    const tags: string[] = [];
    tags.push(u.masked ? `<em class="t red">覆面</em>` : `<em class="t">素顔</em>`);
    if (u.heavy) tags.push(`<em class="t dark">重武装</em>`);
    if (u.hasTool) tags.push(`<em class="t gold">突破ツール</em>`);
    if (u.hasKey) tags.push(`<em class="t gold">キーカード</em>`);
    if (u.carrying >= 0) tags.push(`<em class="t gold">金塊</em>`);
    if (u.action) tags.push(`<em class="t blue">作業中</em>`);
    const g = this.app.g;
    if (g.phase === 'casing' && u.suspicious) tags.push(`<em class="t warn">${instantlyReportable(u) ? '通報されうる' : '不審'}</em>`);
    if (g.crewBalloons.some((b) => b.unit === u.id)) tags.push(`<em class="t blue">回収待ち</em>`);
    tags.push(this.autoTags(u));
    return `<div class="card" data-cmd="solo:${u.id}"><div class="card-head"><b>${u.callsign}</b><span>${MASK_NAMES[u.maskStyle]}・${roomNameAt(u.x, u.y)}</span></div>
      ${this.bar(u.hp / u.maxHp, 'hp')}${u.maxArmor ? this.bar(u.armor / u.maxArmor, 'armor') : ''}<div class="tags">${tags.join('')}</div></div>`;
  }

  private crewLeft() {
    const { g, view } = this.app;
    const sel = selectedUnits(g, 'crew', view.selected);
    const all = g.units.filter((u) => u.kind === 'crew' && active(u));
    const list = sel.length ? sel : [];
    let h = `<h3>クルー <small>${all.length}/${CONFIG.crew.max}人</small></h3>`;
    if (!list.length) h += `<p class="hint">クルーを左クリック／ドラッグで選択。右クリックで移動・行動。<br><kbd>Q</kbd>全員選択</p>`;
    h += `<div class="cards">${list.map((u) => this.crewCard(u)).join('')}</div>`;
    const roster = all.filter((u) => !view.selected.has(u.id));
    if (roster.length) h += `<div class="roster">${roster.map((u) => `<button class="chip" data-cmd="solo:${u.id}">${u.callsign}${u.masked ? '' : '·'}</button>`).join('')}</div>`;
    if (sel.length) {
      const buy = g.phase === 'assault' && g.tickets <= 0;
      const any = (f: (u: Unit) => boolean) => sel.some(f);
      h += `<div class="actions">`;
      if (g.phase === 'casing' && any((u) => !u.masked)) h += this.btn('mask', 'マスク装着', { key: 'M', note: '作業が速くなるが即通報される' });
      if (any((u) => !u.heavy)) h += this.btn('equip', '重武装を装着', { cost: money(CONFIG.heavy.cost), disabled: buy, note: g.phase === 'casing' ? '偵察中は異常者として通報可能に' : '' });
      if (g.phase !== 'casing' && any((u) => u.hp < u.maxHp)) h += this.btn('medkit', '医療キット', { cost: money(CONFIG.medkit.cost) });
      if (g.plan.escape === 'fulton' && any((u) => u.carrying >= 0)) {
        const onRoof = any((u) => u.carrying >= 0 && isRooftopAt(u.x, u.y));
        h += this.btn('fulton', '金塊にフルトン気球', { hot: onRoof, disabled: !onRoof, note: onRoof ? '' : 'ホテル屋上でのみ（西の路地の非常階段から）' });
      }
      if (g.plan.escape === 'fulton' && securedBags(g) >= CONFIG.gold.quotaBags) {
        const onRoof = any((u) => isRooftopAt(u.x, u.y));
        h += this.btn('extract', '自分を回収させる（脱出）', { hot: onRoof, disabled: !onRoof, note: onRoof ? '' : 'ホテル屋上でのみ' });
      }
      h += this.btn('c4mode', '爆薬で扉を破る', { cost: money(CONFIG.actions.c4.cost), note: 'Shift+右クリックでも可' });
      h += `</div>`;
      h += this.autoRow(sel, 'crew');
    }
    return h;
  }

  private crewRight() {
    const g = this.app.g;
    const b = g.breach;
    const method = { drill: 'ドリル', thermal: 'サーマルペースト', charge: '指向性爆薬' }[b.method];
    const esc = g.plan.escape === 'van' ? '逃走バン' : 'フルトン回収';
    let vault = b.open ? '<b class="ok">開放済み</b>' : b.installed ? `${method} ${Math.floor(b.progress * 100)}%${b.jammed ? ' <b class="bad">停止中</b>' : ''}` : '未設置';
    if (!b.open && g.officeDrill.installed) vault += `<br>支店長室ドリル ${Math.floor(g.officeDrill.progress * 100)}%`;
    const loot = g.plan.escape === 'van' ? `バン積載 ${g.van?.bags ?? 0}/${CONFIG.gold.quotaBags}袋` : `回収済み ${securedBags(g)}/${CONFIG.gold.quotaBags}袋`;
    let h = `<h3>作戦 <small>${method} ＋ ${esc}</small></h3>
      <div class="kv"><span>金庫</span><span>${vault}</span></div>
      ${b.installed && !b.open ? this.bar(b.progress, 'gold') : ''}
      <div class="kv"><span>戦利品</span><span>${loot}</span></div>`;
    const shop = g.phase === 'casing' || g.phase === 'response' || g.tickets > 0;
    h += `<h3>調達 <small>${g.phase === 'assault' ? `購入機会 ${g.tickets}回` : '籠城装備は在庫にためておける'}</small></h3>`;
    if (g.phase === 'casing') h += this.btn('intel', '警備図面を入手', { cost: money(CONFIG.actions.intel.cost), disabled: g.intel, note: g.intel ? '入手済み' : '今あるカメラとセンサーの位置がわかる' });
    if (g.phase !== 'assault') h += this.btn('hire', 'クルーを雇う', { cost: money(CONFIG.crew.hireCost), disabled: livingCrew(g) >= CONFIG.crew.max, note: `${livingCrew(g)}/${CONFIG.crew.max}人` });
    const items: [FortKind, string][] = [
      ['turret', 'タレット'],
      ['barricade', 'バリケード'],
      ['trap', '罠（1回作動）'],
      ['drill', '小型ドリル（支店長室用）'],
    ];
    for (const [k, name] of items) {
      const cost = k === 'drill' ? CONFIG.breach.officeDrill.cost : CONFIG.fort[k].cost;
      h += this.btn(`buy:${k}`, name, { cost: money(cost), disabled: !shop || fortCount(g, k) >= fortMax(k), note: `在庫 ${g.stock[k]}` });
    }
    h += `<h3>展開</h3><div class="row">`;
    for (const [k, name] of items.slice(0, 3)) h += this.btn(`deploy:${k}`, `${name.replace('（1回作動）', '')} ×${g.stock[k]}`, { disabled: g.stock[k] <= 0 });
    h += `</div><h3>人質・交渉</h3>`;
    const hostages = hostageCount(g);
    h += this.btn('release', `人質を1名解放 <small>(${hostages}名)</small>`, { disabled: hostages === 0, note: '交渉カード+1・突入中の購入機会+1' });
    h += this.btn('negotiate', `交渉カードを使う ×${g.negotiation.cards}`, { disabled: g.phase !== 'assault' || g.negotiation.cards <= 0 || g.negotiation.cooldown > 0, note: `警察を${CONFIG.negotiation.freeze}秒拘束` });
    if (g.phase === 'casing') h += this.btn('goloud', '強行開始（自ら警報）', { note: '全員覆面・即座に通報される' });
    if (g.plan.escape === 'van' && g.van?.state === 'parked') h += this.btn('escape', 'バンで逃走', { hot: true, disabled: (g.van?.bags ?? 0) < CONFIG.gold.quotaBags, note: 'バン付近のクルーが乗り込む' });
    if (g.plan.escape === 'fulton') {
      const p = g.plane;
      const ready = g.bags.some((b) => b.state === 'balloon') || g.crewBalloons.length > 0;
      const busy = p.eta >= 0 || p.pass > 0;
      const note = busy ? `飛来まで ${Math.max(0, Math.ceil(p.eta))}秒` : p.cooldown > 0 ? `旋回中 あと${Math.ceil(p.cooldown)}秒` : ready ? '屋上の気球を回収する' : `呼ぶと${CONFIG.escape.fulton.arriveTime}秒で屋上上空を通過`;
      h += this.btn('callplane', '回収機を呼ぶ', { hot: ready && !busy && p.cooldown <= 0, disabled: busy || p.cooldown > 0, note });
    }
    return h;
  }

  private bankLeft() {
    const { g, view } = this.app;
    let h = '';
    if (g.phase === 'casing') {
      const t = g.units.find((u) => u.id === view.observeTarget);
      const seen = t && g.vis.bank.units.has(t.id) && t.alive;
      h += `<h3>不審者の確認 <small>通報には根拠が必要</small></h3>`;
      if (!seen) h += `<p class="hint">客を<b>左クリック</b>で選び、<kbd>F</kbd>長押しで${CONFIG.observe.duration}秒観察。<br>覆面・重武装・立入禁止区域にいる人物は即通報できます。</p>`;
      else {
        const instant = instantlyReportable(t);
        const why = t.masked ? '覆面' : t.heavy ? '重武装' : instant ? '立入禁止区域にいる' : '';
        const o = g.observe;
        h += `<div class="card observe"><div class="card-head"><b>来店客</b><span>${roomNameAt(t.x, t.y)}</span></div>
          ${why ? `<div class="tags"><em class="t red">${why}</em></div>` : ''}
          ${this.bar(o.target === t.id ? o.progress / CONFIG.observe.duration : 0, 'gold')}
          <div class="obs-state">${o.cooldown > 0 ? `誤認のため待機 ${Math.ceil(o.cooldown)}秒` : o.holding ? '観察中…' : o.result === 'fail' && o.resultT > 0 ? '異常なし' : o.result === 'lost' && o.resultT > 0 ? '見失った' : ''}</div></div>`;
        h += this.btn('observe', '観察する（長押し）', { key: 'F', hold: true, disabled: o.cooldown > 0 });
        h += this.btn('report', '警察に通報', { key: 'R', hot: instant, disabled: !instant });
      }
    }
    const sel = selectedUnits(g, 'bank', view.selected);
    const units = g.units.filter((u) => (u.kind === 'guard' || u.kind === 'swat') && active(u) && !u.deserting);
    h += `<h3>${g.phase === 'assault' ? '部隊' : '警備員'} <small>${units.length}人</small></h3>`;
    if (!sel.length) h += `<p class="hint">左クリック／ドラッグで選択、右クリックで移動・攻撃。<kbd>Q</kbd>全員</p>`;
    h += `<div class="cards">${sel
      .map(
        (u) =>
          `<div class="card" data-cmd="solo:${u.id}"><div class="card-head"><b>${this.bankName(u)} ${u.kind === 'swat' ? 'SWAT' : '警備員'}</b><span>${roomNameAt(u.x, u.y)}</span></div>${this.bar(u.hp / u.maxHp, 'hp blue')}${this.bar(u.armor / Math.max(1, u.maxArmor), 'armor')}<div class="tags">${u.action ? '<em class="t blue">作業中</em>' : ''}${this.autoTags(u)}</div></div>`,
      )
      .join('')}</div>`;
    if (sel.length) h += this.autoRow(sel, 'bank');
    const alerts = g.alerts.slice(-4).reverse();
    if (alerts.length) h += `<h3>アラート</h3>${alerts.map((a) => `<div class="alert">⚠ ${a.text}</div>`).join('')}`;
    return h;
  }

  private bankRight() {
    const g = this.app.g;
    let h = '';
    if (g.phase !== 'assault') {
      const cams = g.cameras.filter((c) => !c.destroyed).length;
      const guards = g.units.filter((u) => u.kind === 'guard' && u.alive && !u.deserting).length;
      h += `<h3>防犯設備 <small>予算は金庫の金塊と同額</small></h3>`;
      h += this.btn('camera', '防犯カメラ', { cost: money(CONFIG.bank.cameraCost), note: `${cams}/${CONFIG.bank.cameraMax}台・ドラッグで向き` });
      h += this.btn('secdoor', '防犯扉に交換', { cost: money(CONFIG.bank.securityDoorCost), disabled: g.phase !== 'casing', note: '警報前のみ・強盗は解錠に時間がかかる' });
      h += this.btn('sensor', '人感センサー', { cost: money(CONFIG.bank.sensorCost), note: `${g.sensors.length}/${CONFIG.bank.sensorMax}・関係者エリア` });
      h += this.btn('hire', '警備員を雇う', { cost: money(CONFIG.guard.hireCost), disabled: guards >= CONFIG.guard.max || g.phase !== 'casing', note: `${guards}/${CONFIG.guard.max}人・警報前のみ` });
      if (g.phase === 'casing') h += this.btn('reinforce', '金庫扉を強化', { cost: money(CONFIG.breach.reinforceCost), disabled: g.breach.reinforced, note: `突破時間×${CONFIG.breach.reinforceMul}` });
      h += `<h3>状況</h3><div class="kv"><span>金庫</span><span>${g.breach.open ? '<b class="bad">破られた</b>' : '施錠中'}</span></div>`;
      h += `<p class="hint">見えるのは防犯カメラ・支店長室の窓・警備員の周囲だけ。強盗は客と見分けがつかない。</p>`;
      return h;
    }
    const swat = g.units.filter((u) => u.kind === 'swat' && u.alive).length + g.pendingSwat.length;
    const snipers = g.units.filter((u) => u.kind === 'sniper' && u.alive).length;
    h += `<h3>警察 指揮 <small>${g.negotiation.freeze > 0 ? '交渉中・待機' : '突入中'}</small></h3>${this.bar(g.cp / CONFIG.police.cpMax, 'blue')}<div class="kv"><span>指揮ポイント</span><span>${Math.floor(g.cp)} / ${CONFIG.police.cpMax}</span></div>`;
    const frozen = g.negotiation.freeze > 0;
    h += this.btn('swat', 'SWATを投入', { cost: `${CONFIG.swat.cost} CP`, disabled: frozen || swat >= CONFIG.swat.maxActive, note: `同時 ${swat}/${CONFIG.swat.maxActive}` });
    h += this.btn('sniper', '狙撃手を配置', { cost: `${CONFIG.sniper.cost} CP`, disabled: frozen, note: `${snipers}/${CONFIG.sniper.maxActive}・隣のビル屋上` });
    h += this.btn('roadblock', '道路を封鎖', { cost: `${CONFIG.roadblock.cost} CP`, disabled: frozen });
    h += this.btn('gas', '催涙ガス', { cost: `${CONFIG.gas.cost} CP`, disabled: frozen || g.gasCooldown > 0 });
    h += this.btn('wallbreach', '壁を爆破して突入口', { cost: `${CONFIG.wallBreach.cost} CP`, disabled: frozen, note: 'SWATを選んでから壁をクリック' });
    h += `<h3>状況</h3><div class="kv"><span>人質</span><span>${hostageCount(g)}名</span></div><div class="kv"><span>金庫</span><span>${g.breach.open ? '<b class="bad">破られた</b>' : '施錠中'}</span></div>`;
    return h;
  }

  // ---------- コマンド ----------
  private onCommand(cmd: string, _el: HTMLElement) {
    const app = this.app;
    const { g, view } = app;
    const side = app.human;
    if (!side) return;
    const sel = selectedUnits(g, side, view.selected);
    const run = (c: Command) => {
      const err = issue(g, side, c);
      if (err) app.toast(err);
      return err;
    };
    const [name, arg] = cmd.split(':');
    switch (name) {
      case 'solo':
        view.selected = new Set([Number(arg)]);
        return;
      case 'mask':
        run({ t: 'mask', ids: sel.map((u) => u.id) });
        return;
      case 'equip':
      case 'medkit': {
        const target = sel.filter((u) => (name === 'equip' ? !u.heavy : u.hp < u.maxHp));
        if (!target.length) return app.toast('対象のクルーがいません');
        for (const u of target.slice(0, 1)) run({ t: 'act', id: u.id, kind: name, target: u.id });
        return;
      }
      case 'fulton':
      case 'extract': {
        const u = sel.find((u) => (name === 'fulton' ? u.carrying >= 0 : true) && isRooftopAt(u.x, u.y));
        if (u) run({ t: 'act', id: u.id, kind: name, target: 0 });
        return;
      }
      case 'callplane':
        run({ t: 'callPlane' });
        return;
      case 'auto': {
        // 選んだ全員が有効なら無効に、そうでなければ全員を有効にする
        const mode = arg as AutoMode;
        const on = !sel.every((u) => u.auto[mode]);
        if (sel.length) run({ t: 'auto', ids: sel.map((u) => u.id), mode, on });
        return;
      }
      case 'c4mode':
        view.placement = { kind: 'c4' };
        return;
      case 'hire':
        run({ t: 'hire' });
        return;
      case 'buy':
        run({ t: 'buyStock', item: arg as FortKind });
        return;
      case 'deploy':
        view.placement = { kind: 'deploy', item: arg as 'turret' | 'barricade' | 'trap' };
        return;
      case 'release':
      case 'negotiate':
      case 'escape':
        run({ t: name });
        return;
      case 'goloud':
        run({ t: 'goLoud' });
        return;
      case 'camera':
        view.placement = { kind: 'camera', start: null };
        return;
      case 'secdoor':
      case 'sensor':
      case 'swat':
      case 'sniper':
      case 'roadblock':
      case 'gas':
      case 'wallbreach':
        view.placement = { kind: name };
        return;
      case 'reinforce':
        run({ t: 'reinforce' });
        return;
      case 'intel':
        run({ t: 'intel' });
        return;
      case 'report':
        run({ t: 'report', target: view.observeTarget });
        return;
    }
  }
}

export function sideName(s: Side): string {
  return s === 'crew' ? '強盗団' : '銀行';
}

export { L };
