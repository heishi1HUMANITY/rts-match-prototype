import { BUDGET, CONFIG, type BreachMethod, type EscapeMethod } from '../config';
import type { Game, Side } from './types';
import { seedCivilians } from './civ';
import { emptyVis } from './vision';
import { useLayout } from '../map/level';
import { L, MASK_NAMES, makeUnit, news, passable, pick, rand, randRange } from './world';

export interface GameOptions {
  seed: number;
  plan: { breach: BreachMethod; escape: EscapeMethod };
  ai: Record<Side, boolean>;
  layout?: number; // 省略時は基準配置
}

export const CALLSIGNS = ['FOX', 'OWL', 'HARE', 'CROC', 'CAT'];

export function planCost(plan: { breach: BreachMethod; escape: EscapeMethod }): number {
  return CONFIG.breach[plan.breach].cost + CONFIG.escape[plan.escape].cost;
}

export function createGame(opts: GameOptions): Game {
  const layout = opts.layout ?? 0;
  useLayout(layout);
  const g: Game = {
    seed: opts.seed,
    layout,
    rng: opts.seed | 0,
    tick: 0,
    time: 0,
    phase: 'casing',
    phaseTime: 0,
    nextId: 1,
    plan: { ...opts.plan },
    controllers: { bank: { ai: opts.ai.bank }, crew: { ai: opts.ai.crew } },
    funds: { bank: BUDGET, crew: BUDGET - planCost(opts.plan) },
    cp: 0,
    crewHired: 0,
    units: [],
    cameras: [],
    doors: [],
    turrets: [],
    barricades: [],
    traps: [],
    sensors: [],
    bags: [],
    roadblocks: [],
    gases: [],
    gasCooldown: 0,
    breach: {
      method: opts.plan.breach,
      installed: false,
      running: false,
      jammed: false,
      progress: 0,
      nextJam: 0,
      noiseTimer: 0,
      open: false,
      reinforced: false,
    },
    van: null,
    plane: { eta: -1, pass: 0, cooldown: 0 },
    crewBalloons: [],
    c4: [],
    wallCharges: [],
    holes: [],
    officeDrill: { installed: false, progress: 0, noise: 0 },
    stock: { turret: 0, barricade: 0, trap: 0, drill: 0 },
    tickets: 0,
    pendingSwat: [],
    intel: false,
    observe: { target: -1, holding: false, progress: 0, suspicious: 0, cooldown: 0, result: '', resultT: 0 },
    alerts: [],
    negotiation: { cards: 0, freeze: 0, cooldown: 0, released: 0 },
    events: [],
    fx: [],
    vis: { bank: emptyVis(), crew: emptyVis() },
    winner: null,
    endReason: '',
    stats: { crewKilled: 0, policeKilled: 0, guardsKilled: 0, hostagesTaken: 0, shots: 0 },
    civSpawnTimer: 0,
    loudReason: '',
    aiMemory: {},
    dealt: { bank: {}, crew: {} },
  };
  // 乱数を少し回して種の偏りを消す
  for (let i = 0; i < 8; i++) rand(g);

  L.doorSlots.forEach((s, i) => {
    g.doors.push({ id: g.nextId++, slot: i, locked: s.defaultLocked, security: false, jammed: false, destroyed: false, open: false, alerted: false });
  });

  for (const c of L.defaultCameras.slice(0, CONFIG.bank.startCameras)) {
    g.cameras.push({ id: g.nextId++, x: c.x, y: c.y, dir: c.dir, hp: CONFIG.bank.cameraHp, destroyed: false, loop: 0 });
  }

  for (let i = 0; i < CONFIG.guard.startCount; i++) spawnGuard(g);

  // 職員: 窓口係と事務員
  for (const p of L.tellerSpots.slice(0, 4)) {
    const s = makeUnit(g, 'staff', p.x, p.y);
    s.facing = Math.PI / 2;
    s.brain = { state: 'work', timer: randRange(g, 20, 60), errands: 0, home: { x: p.x, y: p.y } };
  }
  for (let i = 0; i < 4; i++) {
    const p = pick(g, L.staffPois);
    const s = makeUnit(g, 'staff', p.x, p.y);
    s.brain = { state: 'work', timer: randRange(g, 3, 15), errands: 0, home: { x: p.x, y: p.y } };
  }

  // 支店長（見た目は一般客と同じ）。自室の窓からロビーを見ている
  const mgr = makeUnit(g, 'manager', L.managerSeat.x, L.managerSeat.y);
  mgr.facing = Math.PI / 2;
  mgr.brain = { state: 'work', timer: 9999, errands: 0, home: { ...L.managerSeat } };
  g.bags.push({ id: g.nextId++, x: L.keycardSpot.x, y: L.keycardSpot.y, state: 'ground', carrier: -1, balloon: 0, balloonHp: 0, kind: 'keycard' });

  // 金庫の金塊
  for (const p of L.bagSpots.slice(0, CONFIG.gold.bags)) {
    g.bags.push({ id: g.nextId++, x: p.x, y: p.y, state: 'vault', carrier: -1, balloon: 0, balloonHp: 0, kind: 'gold' });
  }

  if (opts.plan.escape === 'van') {
    g.van = { x: L.vanSpot.x, y: L.vanSpot.y, state: 'parked', dir: 0, hp: CONFIG.escape.van.hp, crew: [], bags: 0 };
  }

  // クルー: 歩行者として表通り・裏通りから現れる
  for (let i = 0; i < CONFIG.crew.startCount; i++) spawnCrew(g, i === 0);

  seedCivilians(g);
  news(g, 'ハーバーライト銀行 中央支店 本日も通常営業', 'all');
  return g;
}

export function spawnGuard(g: Game) {
  const p = L.guardPost;
  // 家具に重ならない位置を選ぶ（重なると動けなくなる）
  let x = p.x;
  let y = p.y;
  for (let i = 0; i < 20; i++) {
    const cx = p.x + randRange(g, -1.5, 1.5);
    const cy = p.y + randRange(g, -1, 0.2);
    const r = CONFIG.move.radius;
    const ok = [[-r, -r], [r, -r], [-r, r], [r, r]].every(([dx, dy]) => passable(g, 'bank', Math.floor(cx + dx!), Math.floor(cy + dy!)));
    if (ok) {
      x = cx;
      y = cy;
      break;
    }
  }
  const u = makeUnit(g, 'guard', x, y);
  u.walk = CONFIG.move.guardWalk;
  return u;
}

export function spawnCrew(g: Game, breacher: boolean) {
  const n = g.crewHired;
  let x: number;
  let y: number;
  if (g.phase === 'casing') {
    const e = pick(g, L.pedestrianEnds);
    x = e.x < 1 ? 0.6 : e.x - 0.1;
    y = e.y;
  } else {
    // 警察到着前の増員は裏のバン付近から
    x = randRange(g, 60, 70);
    y = 5.5;
  }
  const u = makeUnit(g, 'crew', x, y);
  u.walk = CONFIG.move.crewWalk;
  u.maskStyle = n % MASK_NAMES.length;
  u.callsign = CALLSIGNS[n % CALLSIGNS.length]!;
  u.masked = g.phase !== 'casing';
  if (breacher) {
    u.hasTool = true;
    // 工具はジム用バッグに隠して持ち込む（客の荷物と見分けがつかない）
    u.look.bag = 'gym';
  }
  g.crewHired++;
  return u;
}
