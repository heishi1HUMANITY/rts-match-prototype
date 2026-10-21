import './style.css';
import { CONFIG, type BreachMethod, type EscapeMethod } from './config';
import { Renderer, type View } from './render/renderer';
import { createGame, type GameOptions } from './sim/create';
import { step } from './sim/step';
import type { Side } from './sim/types';
import type { App } from './ui/app';
import { Hud } from './ui/hud';
import { Input } from './ui/input';
import { briefing, planScreen, resultScreen, titleScreen } from './ui/screens';

const DT = 1 / CONFIG.tickRate;

const canvas = document.createElement('canvas');
canvas.className = 'map';
document.body.appendChild(canvas);
const renderer = new Renderer(canvas);

function newView(human: Side | null): View {
  return { side: human ?? 'spectator', selected: new Set(), observeTarget: -1, placement: null, mouse: null, box: null, knownCameras: new Set(), marks: [] };
}

function randomPlan(): { breach: BreachMethod; escape: EscapeMethod } {
  const b: BreachMethod[] = ['drill', 'thermal', 'charge'];
  const e: EscapeMethod[] = ['van', 'fulton'];
  return { breach: b[Math.floor(Math.random() * b.length)]!, escape: e[Math.floor(Math.random() * e.length)]! };
}

const seed = () => Math.floor(Math.random() * 2 ** 31);
// 支店のレイアウトも試合ごとに変える（0 は基準配置なので 1 以降から選ぶ）
const newGame = (o: Omit<GameOptions, 'seed' | 'layout'>) => {
  const s = seed();
  return createGame({ ...o, seed: s, layout: 1 + (s % 9999) });
};

const app: App = {
  g: newGame({ plan: randomPlan(), ai: { bank: true, crew: true } }),
  view: newView(null),
  renderer,
  human: null,
  speed: 1,
  paused: false,
  toast: (msg, kind) => hud.toast(msg, kind),
  restart: () => {},
  toTitle: () => {},
};

const hud = new Hud(app, document.body);
const input = new Input(app, hud, canvas);
let mode: 'title' | 'menu' | 'play' | 'result' = 'title';
let last: { human: Side | null; plan: { breach: BreachMethod; escape: EscapeMethod } } | null = null;
const pauseBox = document.createElement('div');
pauseBox.className = 'pausebox';
pauseBox.innerHTML = '<b>一時停止中</b><span>中継はこのあとも続きます — Spaceで再開</span>';
document.body.appendChild(pauseBox);
let helpOpen: HTMLElement | null = null;

function setMode(m: typeof mode) {
  mode = m;
  document.body.dataset.mode = m;
}

function start(human: Side | null, plan: { breach: BreachMethod; escape: EscapeMethod }) {
  last = { human, plan };
  app.g = newGame({ plan, ai: { bank: human !== 'bank', crew: human !== 'crew' } });
  app.human = human;
  app.view = newView(human);
  app.speed = 1;
  app.paused = true;
  setMode('play');
  briefing(human, app.g.layout, () => {
    app.paused = false;
  });
}

function toTitle() {
  setMode('title');
  app.g = newGame({ plan: randomPlan(), ai: { bank: true, crew: true } });
  app.human = null;
  app.view = newView(null);
  app.speed = 1;
  app.paused = false;
  titleScreen((human) => {
    if (human === 'crew') {
      setMode('menu');
      planScreen((plan) => start('crew', plan), toTitle);
    } else start(human, randomPlan());
  });
}

app.restart = () => last && start(last.human, last.plan);
app.toTitle = toTitle;
input.onPause = () => {
  if (mode !== 'play') return;
  app.paused = !app.paused;
};
input.onHelp = () => {
  if (mode !== 'play') return;
  if (helpOpen) {
    helpOpen.remove();
    helpOpen = null;
    app.paused = false;
    return;
  }
  app.paused = true;
  helpOpen = briefing(app.human, app.g.layout, () => {
    helpOpen = null;
    app.paused = false;
  });
};

// Webフォントの読み込み後に床の文字を描き直す
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
  const running = !app.paused && mode !== 'result';
  if (running) {
    acc += dt * app.speed;
    let n = 0;
    while (acc >= DT && n < 12) {
      step(g, DT);
      acc -= DT;
      n++;
    }
    if (n >= 12) acc = 0;
  }
  // タイトル裏の「中継映像」は決着したら撮り直す
  if ((mode === 'title' || mode === 'menu') && g.phase === 'ended') app.g = newGame({ plan: randomPlan(), ai: { bank: true, crew: true } });
  renderer.draw(app.g, app.view, now / 1000);
  hud.update(dt);
  input.update(dt);
  pauseBox.classList.toggle('on', app.paused && mode === 'play' && !helpOpen && !document.querySelector('.screen'));
  if (mode === 'play' && g.phase === 'ended') {
    setMode('result');
    setTimeout(() => resultScreen(app.g, app.human, () => app.restart(), toTitle), 1600);
  }
  requestAnimationFrame(frame);
}

toTitle();
requestAnimationFrame(frame);

// 検証用（ブラウザのコンソールから状態を確認できる）
(window as unknown as { robyou: App }).robyou = app;
