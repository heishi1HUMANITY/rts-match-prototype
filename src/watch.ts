import './style.css';
import { CONFIG, type BreachMethod, type EscapeMethod } from './config';
import { Renderer, type View, type ViewSide } from './render/renderer';
import { createGame } from './sim/create';
import { step } from './sim/step';
import type { Side } from './sim/types';
import type { App } from './ui/app';
import { Hud } from './ui/hud';
import { resultScreen } from './ui/screens';

// AI 対 AI の中継だけを流す版。人間は操作せず、視点と速度だけ選べる。静的ファイルとして配信できる。
// URL で試合を指定できる: ?seed=12&layout=5038&plan=thermal-van&view=crew&speed=2

const DT = 1 / CONFIG.tickRate;
const BREACH: BreachMethod[] = ['drill', 'thermal', 'charge'];
const ESCAPE: EscapeMethod[] = ['van', 'fulton'];
const VIEWS: ViewSide[] = ['spectator', 'crew', 'bank'];
const PLAN_NAME: Record<string, string> = { drill: 'ドリル', thermal: 'サーマル', charge: '爆薬', van: 'バン', fulton: 'フルトン' };
const NEXT_AFTER = 12; // 決着から次の試合まで（秒）

interface Match {
  seed: number;
  layout: number;
  plan: { breach: BreachMethod; escape: EscapeMethod };
}

function randomMatch(): Match {
  const seed = Math.floor(Math.random() * 2 ** 31);
  return {
    seed,
    layout: 1 + (seed % 9999),
    plan: { breach: BREACH[Math.floor(Math.random() * BREACH.length)]!, escape: ESCAPE[Math.floor(Math.random() * ESCAPE.length)]! },
  };
}

function matchFromUrl(q: URLSearchParams): Match | null {
  const seed = Number(q.get('seed'));
  if (!q.has('seed') || !Number.isFinite(seed)) return null;
  const [b, e] = (q.get('plan') ?? 'thermal-van').split('-');
  return {
    seed: seed | 0,
    layout: q.has('layout') ? Number(q.get('layout')) | 0 : 1 + (Math.abs(seed | 0) % 9999),
    plan: { breach: BREACH.includes(b as BreachMethod) ? (b as BreachMethod) : 'thermal', escape: ESCAPE.includes(e as EscapeMethod) ? (e as EscapeMethod) : 'van' },
  };
}

const query = new URLSearchParams(location.search);
const canvas = document.createElement('canvas');
canvas.className = 'map';
document.body.appendChild(canvas);
const renderer = new Renderer(canvas);

const startView = query.get('view') as ViewSide | null;
function newView(): View {
  return {
    side: app?.view?.side ?? (startView && VIEWS.includes(startView) ? startView : 'spectator'),
    selected: new Set(),
    observeTarget: -1,
    placement: null,
    mouse: null,
    box: null,
    knownCameras: new Set(),
    marks: [],
  };
}

let match: Match = matchFromUrl(query) ?? randomMatch();
const pinned = query.has('seed'); // URL で指定した試合は自動で次へ進まない
let count = 1;
const score: Record<Side, number> = { crew: 0, bank: 0 };
let resultEl: HTMLElement | null = null;
let nextTimer = 0;
let ended = false;

const app: App = {
  g: createGame({ seed: match.seed, plan: { ...match.plan }, ai: { bank: true, crew: true }, layout: match.layout }),
  view: undefined as unknown as View,
  renderer,
  human: null,
  speed: Math.min(4, Math.max(1, Number(query.get('speed')) || 1)),
  paused: false,
  toast: (msg, kind) => hud.toast(msg, kind),
  restart: () => play(match),
  toTitle: () => next(),
  watch: {
    info: () => {
      const link = `?seed=${match.seed}&layout=${match.layout}&plan=${match.plan.breach}-${match.plan.escape}`;
      return `<div class="watch-info">
        第<b>${count}</b>試合　支店レイアウト <b>No.${match.layout}</b><br>
        強盗の作戦：<b>${PLAN_NAME[match.plan.breach]}＋${PLAN_NAME[match.plan.escape]}</b>
        <div class="score"><span class="c">強盗 ${score.crew}</span><span>通算</span><span class="b">${score.bank} 銀行</span></div>
        <a href="${link}">この試合のURL</a>　<span>V 視点・N 次へ</span><br>
        <a href="../index.html">自分で遊ぶ（強盗・支店長）→</a>
      </div>`;
    },
    next: () => next(),
  },
};
app.view = newView();
const hud = new Hud(app, document.body);

function play(m: Match) {
  match = m;
  resultEl?.remove();
  resultEl = null;
  clearInterval(nextTimer);
  ended = false;
  app.g = createGame({ seed: m.seed, plan: { ...m.plan }, ai: { bank: true, crew: true }, layout: m.layout });
  app.view = newView();
  app.paused = false;
  document.body.dataset.mode = 'play';
}

function next() {
  count++;
  play(randomMatch());
}

function onEnded() {
  ended = true;
  const g = app.g;
  if (g.winner) score[g.winner]++;
  document.body.dataset.mode = 'result';
  setTimeout(() => {
    if (app.g !== g) return;
    resultEl = resultScreen(g, null, () => play(match), () => next());
    resultEl.querySelector('[data-act="again"]')!.textContent = '同じ試合をもう一度';
    resultEl.querySelector('[data-act="title"]')!.textContent = '次の試合へ';
    if (pinned && count === 1) return;
    const note = document.createElement('p');
    note.className = 'result-loud';
    resultEl.querySelector('.result-btns')!.before(note);
    let left = NEXT_AFTER;
    const tick = () => {
      note.textContent = `${left}秒後に次の試合を中継します`;
      if (left-- <= 0) next();
    };
    tick();
    nextTimer = window.setInterval(tick, 1000);
  }, 1600);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ') {
    e.preventDefault();
    app.paused = !app.paused;
  } else if (k === '1' || k === '2' || k === '3') app.speed = [1, 2, 4][Number(k) - 1]!;
  else if (k === 'v') {
    app.view.side = VIEWS[(VIEWS.indexOf(app.view.side) + 1) % VIEWS.length]!;
  } else if (k === 'n') next();
});

document.fonts?.ready.then(() => {
  renderer.resize();
  hud.setLayout(renderer.ts);
});
window.addEventListener('resize', () => {
  renderer.resize();
  hud.setLayout(renderer.ts);
});
hud.setLayout(renderer.ts);

let acc = 0;
let prev = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  const g = app.g;
  if (!app.paused && !ended) {
    acc += dt * app.speed;
    let n = 0;
    while (acc >= DT && n < 12) {
      step(g, DT);
      acc -= DT;
      n++;
    }
    if (n >= 12) acc = 0;
    if (g.phase === 'ended') onEnded();
  }
  renderer.draw(app.g, app.view, now / 1000);
  hud.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 検証用
(window as unknown as { robyou: App }).robyou = app;
