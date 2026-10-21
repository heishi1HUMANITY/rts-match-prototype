import { BUDGET, CONFIG, type BreachMethod, type EscapeMethod } from '../config';
import { planCost } from '../sim/create';
import type { Game, Side } from '../sim/types';
import { securedBags } from '../sim/world';
import { money } from './context';

export interface StartChoice {
  human: Side | null;
  plan: { breach: BreachMethod; escape: EscapeMethod };
}

const BREACH: { id: BreachMethod; name: string; en: string; desc: string; pros: string; cons: string }[] = [
  {
    id: 'drill',
    name: 'ドリル',
    en: 'THERMAL DRILL',
    desc: `${CONFIG.breach.drill.time}秒で穿孔。安いが、ときどき止まる。`,
    pros: '安価・支店長室のキーカードと併用しやすい',
    cons: '振動センサーで異音が支店長に届く／止められる',
  },
  {
    id: 'thermal',
    name: 'サーマルペースト',
    en: 'THERMAL PASTE',
    desc: `${CONFIG.breach.thermal.time}秒で扉を焼き切る。止められない。`,
    pros: '静か・妨害されない',
    cons: '高価・赤く光るのでカメラに映ると目立つ',
  },
  {
    id: 'charge',
    name: '指向性爆薬',
    en: 'SHAPED CHARGE',
    desc: `設置から${CONFIG.breach.charge.time}秒で吹き飛ばす。`,
    pros: '最速',
    cons: '最も高価・爆発で即通報／解除されうる',
  },
];

const ESCAPE: { id: EscapeMethod; name: string; en: string; desc: string; pros: string; cons: string }[] = [
  {
    id: 'van',
    name: '逃走バン',
    en: 'GETAWAY VAN',
    desc: `裏通りの花屋のバンに${CONFIG.gold.quotaBags}袋以上積んで走り去る。`,
    pros: '一度に全員で逃げられる',
    cons: '道路封鎖で止められ、走行中は撃たれる',
  },
  {
    id: 'fulton',
    name: 'フルトン回収',
    en: 'FULTON EXTRACTION',
    desc: `ホテル屋上（西の路地の非常階段から上がる）で金塊に気球を付け、呼んだ回収機が${CONFIG.escape.fulton.arriveTime}秒で飛来して吊り上げる。`,
    pros: '速い・道路封鎖に止められない・屋上は地上から撃たれない',
    cons: '金塊を屋上まで運ぶ・費用が高い',
  },
];

function overlay(cls: string, html: string): HTMLElement {
  const d = document.createElement('div');
  d.className = `screen ${cls}`;
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}

export function titleScreen(onPick: (human: Side) => void): HTMLElement {
  const d = overlay(
    'title',
    `<div class="title-bug"><b>LBN</b><span>24</span><em>SPECIAL REPORT</em></div>
    <div class="title-box">
      <div class="title-kicker"><span>LIVE</span>ハーバーライト銀行 中央支店前</div>
      <h1>ROB YOU</h1>
      <p class="title-sub">非対称型 見下ろし対戦ストラテジー</p>
      <p class="title-tag">金庫の金塊 <b>${money(BUDGET)}</b>。同じ額の予算で、守るか、奪うか。</p>
      <div class="title-picks">
        <button class="pick bank" data-pick="bank"><small>DEFEND</small><b>支店長として守る</b><span>防犯カメラと警備員で不審者を見抜き、通報後は警察を指揮する</span></button>
        <button class="pick crew" data-pick="crew"><small>STEAL</small><b>強盗団として奪う</b><span>客に紛れて下準備。金庫を破り、金塊を抱えて逃げ切る</span></button>
      </div>
      <div class="title-phases">
        <div><b>1 偵察</b><span>強盗は客と見分けがつかない。支店長は不審な行動を5秒観察してはじめて通報できる</span></div>
        <div><b>2 警察到着待ち</b><span>銃撃戦が始まる。強盗は人質を取り、籠城装備を展開する</span></div>
        <div><b>3 突入</b><span>支店長は警察を指揮。SWAT・狙撃手・道路封鎖・壁の爆破で包囲する</span></div>
      </div>
    </div>`,
  );
  d.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
    if (!b) return;
    const p = b.dataset.pick;
    d.remove();
    onPick(p as Side);
  });
  return d;
}

export function planScreen(onStart: (plan: StartChoice['plan']) => void, onBack: () => void) {
  let breach: BreachMethod = 'drill';
  let escape: EscapeMethod = 'van';
  const d = overlay('plan', '');
  const render = () => {
    const cost = planCost({ breach, escape });
    const card = (kind: 'b' | 'e', o: (typeof BREACH)[number] | (typeof ESCAPE)[number], on: boolean, price: number) =>
      `<button class="plan-card ${on ? 'on' : ''}" data-${kind}="${o.id}"><small>${o.en}</small><b>${o.name}</b><span class="price">${money(price)}</span><p>${o.desc}</p><p class="pro">＋ ${o.pros}</p><p class="con">− ${o.cons}</p></button>`;
    d.innerHTML = `<div class="plan-box">
      <div class="plan-head"><span class="breaking">PRE-PLANNING</span><h2>事前計画 — 金庫の破り方と逃げ方</h2></div>
      <p class="plan-note">突破手段はクルーの1人（FOX）が工具バッグに隠して持ち込みます。支店長室を小型ドリルで開けて<b>キーカード</b>を奪えば、金庫は手段に関係なく開けられます。</p>
      <h3>金庫の突破</h3><div class="plan-row">${BREACH.map((o) => card('b', o, o.id === breach, CONFIG.breach[o.id].cost)).join('')}</div>
      <h3>逃走手段 <small>金塊${CONFIG.gold.quotaBags}袋（${money(CONFIG.gold.quotaBags * CONFIG.gold.bagValue)}）以上で脱出成功</small></h3><div class="plan-row">${ESCAPE.map((o) => card('e', o, o.id === escape, CONFIG.escape[o.id].cost)).join('')}</div>
      <div class="plan-foot"><div>予算 ${money(BUDGET)} − 計画 ${money(cost)} = <b>${money(BUDGET - cost)}</b> が現場で使える資金</div>
      <button class="ghost" data-act="back">戻る</button><button class="go" data-act="go">作戦開始</button></div></div>`;
  };
  render();
  d.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.dataset.b) breach = t.dataset.b as BreachMethod;
    if (t.dataset.e) escape = t.dataset.e as EscapeMethod;
    if (t.dataset.act === 'go') {
      d.remove();
      onStart({ breach, escape });
      return;
    }
    if (t.dataset.act === 'back') {
      d.remove();
      onBack();
      return;
    }
    render();
  });
}

export function briefing(side: Side, layout: number, onGo: () => void) {
  const crew = `<li><b>偵察</b>：クルーは客と同じ見た目。<b>右クリック</b>で移動・行動。カメラの赤い視界を避けて準備を進める。</li>
    <li>カメラにループ映像を仕込む・警備員を買収する・扉をピッキングする。<b>作業中・関係者エリア・金塊運搬</b>は不審行動。</li>
    <li><b>マスク</b>・<b>重武装</b>・<b>関係者エリア</b>で見つかると即通報。それ以外は支店長が5秒観察しないと通報できない。</li>
    <li>籠城装備（タレット・バリケード・罠）は警察到着前に買って<b>在庫</b>にため、いつでも展開できる。突入中は人質を解放すると1回だけ買える。</li>
    <li>金塊${CONFIG.gold.quotaBags}袋以上を持って逃げ切れば勝ち。全員倒されるか時間切れで負け。</li>`;
  const bank = `<li><b>偵察</b>：見えるのは防犯カメラ、支店長室の窓、警備員の周り（明るい部分）だけ。</li>
    <li>客を<b>左クリック</b>で選び、<kbd>F</kbd>を<b>長押し</b>して${CONFIG.observe.duration}秒観察。不審な行動が見えれば通報できる。見誤ると${CONFIG.observe.failCooldown}秒観察できない。</li>
    <li>覆面・重武装・関係者エリアにいる客は<kbd>R</kbd>で即通報。オレンジの波紋はセンサーや異音のアラート。</li>
    <li>通報後は警備員で応戦。警察到着後は<b>SWAT（同時${CONFIG.swat.maxActive}人）</b>・狙撃手・道路封鎖・催涙ガス・<b>壁の爆破</b>で強盗を全滅させる。</li>
    <li>強盗が金塊を持ち出して逃げ切れば負け。</li>`;
  const d = overlay(
    'brief',
    `<div class="brief-box"><div class="plan-head"><span class="breaking">BRIEFING</span><h2>${side === 'crew' ? '強盗団' : '支店長'} — 作戦説明</h2></div>
    <ul>${side === 'crew' ? crew : bank}
    <li>支店の間取りは毎回少し違う（扉の位置・家具・金塊の置き場・キーカードの場所）。今回は <b>レイアウト No.${layout}</b>。</li></ul>
    <div class="keys"><span><kbd>左</kbd>選択／ドラッグで範囲</span><span><kbd>右</kbd>移動・行動</span><span><kbd>Q</kbd>全員選択</span><span><kbd>Space</kbd>一時停止</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd>速度</span><span><kbd>H</kbd>ヘルプ</span></div>
    <button class="go" data-act="go">中継開始</button></div>`,
  );
  d.querySelector('[data-act="go"]')!.addEventListener('click', () => {
    d.remove();
    onGo();
  });
  return d;
}

export function resultScreen(g: Game, human: Side, onAgain: () => void, onTitle: () => void) {
  const crewWon = g.winner === 'crew';
  const you = g.winner === human ? '<span class="win">YOU WIN</span>' : '<span class="lose">YOU LOSE</span>';
  const bags = g.van ? g.van.bags : securedBags(g);
  const d = overlay(
    'result',
    `<div class="result-box ${crewWon ? 'crew' : 'bank'}">
      <div class="result-tag"><span class="breaking">${crewWon ? '速報' : '続報'}</span>${you}</div>
      <h2>${crewWon ? '強盗団 逃走 — 金塊が消えた' : '強盗団を制圧 — 金庫は守られた'}</h2>
      <p class="result-reason">${g.endReason}</p>
      <div class="result-stats">
        <div><b>${crewWon ? money(bags * CONFIG.gold.bagValue) : '$0'}</b><span>被害額</span></div>
        <div><b>${g.stats.crewKilled}/${g.crewHired}</b><span>制圧された強盗</span></div>
        <div><b>${g.stats.hostagesTaken}</b><span>人質</span></div>
        <div><b>${g.stats.policeKilled + g.stats.guardsKilled}</b><span>負傷した警備・警官</span></div>
        <div><b>${Math.floor(g.time / 60)}分${Math.floor(g.time % 60)}秒</b><span>事件発生から</span></div>
      </div>
      <p class="result-loud">発覚の経緯：${g.loudReason || '—'}</p>
      <div class="result-btns"><button class="go" data-act="again">もう一度</button><button class="ghost" data-act="title">タイトルへ</button></div>
    </div>`,
  );
  d.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    d.remove();
    if (t.dataset.act === 'again') onAgain();
    else onTitle();
  });
  return d;
}

