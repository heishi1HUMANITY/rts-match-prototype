import { CONFIG } from '../config';
import { idx } from '../map/level';
import { type Command, issue } from '../sim/commands';
import { breachableWall, instantlyReportable } from '../sim/rules';
import type { Game, Unit } from '../sim/types';
import { L, active, dist, isPrivateAt, pick, rand, randRange } from '../sim/world';

// 銀行側AI（偵察〜警報は支店長、突入は警察）。見えている情報（vis.bank）とアラートだけを使う。

interface Known {
  x: number;
  y: number;
  t: number;
}

interface Mem {
  t: number;
  setup: number;
  patrol: Record<number, number>;
  wait: Record<number, number>;
  known: Known[];
  vanSeen: boolean;
  balloonsSeen: boolean;
  breaches: number;
  nextBreach: number;
  stagingFlip: number;
}

function mem(g: Game): Mem {
  let m = g.aiMemory.bank as Mem | undefined;
  if (!m) {
    m = { t: 0, setup: 0, patrol: {}, wait: {}, known: [], vanSeen: false, balloonsSeen: false, breaches: 0, nextBreach: randRange(g, 25, 45), stagingFlip: 0 };
    g.aiMemory.bank = m;
  }
  return m;
}

const cmd = (g: Game, c: Command) => issue(g, 'bank', c);

const PATROLS: { x: number; y: number }[][] = [
  [
    { x: 28, y: 26 },
    { x: 55, y: 26 },
    { x: 55, y: 36 },
    { x: 28, y: 36 },
  ],
  [
    { x: 15, y: 14.5 },
    { x: 40, y: 15 },
    { x: 58, y: 14.5 },
    { x: 65, y: 12 },
  ],
  [
    { x: 17, y: 30 },
    { x: 42, y: 32 },
    { x: 66, y: 33 },
  ],
  [{ x: 41, y: 15.2 }],
];

function setupPurchases(g: Game, m: Mem) {
  // 時間をずらして少しずつ整える
  const steps: (() => void)[] = [
    () => cmd(g, { t: 'secdoor', slot: L.doorSlots.findIndex((s) => s.id === 'gate') }),
    () => {
      const c = L.cameraIdeas[0]!;
      cmd(g, { t: 'camera', x: c.x, y: c.y, dir: c.dir });
    },
    () => cmd(g, { t: 'hire' }),
    () => {
      const c = L.cameraIdeas[1 + Math.floor(rand(g) * 3)]!;
      cmd(g, { t: 'camera', x: c.x, y: c.y, dir: c.dir });
    },
    () => cmd(g, { t: 'secdoor', slot: L.doorSlots.findIndex((s) => s.id === (rand(g) < 0.5 ? 'dock' : 'locker')) }),
    () => cmd(g, { t: 'hire' }),
    () => cmd(g, { t: 'sensor', x: 40.5, y: 14.5 }),
    () => {
      const c = pick(g, L.cameraIdeas.slice(3));
      cmd(g, { t: 'camera', x: c.x, y: c.y, dir: c.dir });
    },
    () => {
      if (g.funds.bank > CONFIG.breach.reinforceCost + 350_000) cmd(g, { t: 'reinforce' });
    },
  ];
  if (m.setup < steps.length) steps[m.setup++]!();
}

function guards(g: Game): Unit[] {
  return g.units.filter((u) => u.kind === 'guard' && active(u) && !u.deserting);
}

function idle(u: Unit) {
  return !u.order && !u.action && !u.path.length;
}

function visibleCrew(g: Game): Unit[] {
  // 警報後は覆面なので見えていれば強盗とわかる
  return g.units.filter((u) => u.kind === 'crew' && active(u) && g.vis.bank.units.has(u.id));
}

function remember(g: Game, m: Mem) {
  for (const u of visibleCrew(g)) {
    if (g.phase === 'casing' && !instantlyReportable(u)) continue;
    m.known.push({ x: u.x, y: u.y, t: g.time });
  }
  m.known = m.known.filter((k) => g.time - k.t < 25).slice(-30);
  if (g.vis.bank.van && g.phase !== 'casing') m.vanSeen = true;
  if (g.bags.some((b) => b.state === 'balloon' && g.vis.bank.bags.has(b.id))) m.balloonsSeen = true;
}

function lastKnown(m: Mem, u: { x: number; y: number }): Known | null {
  let best: Known | null = null;
  let bd = Infinity;
  for (const k of m.known) {
    const d = dist(u.x, u.y, k.x, k.y) + (0 - k.t) * 0.01;
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

export function managerAI(g: Game, dt: number): void {
  const m = mem(g);
  m.t -= dt;
  if (m.t > 0) return;
  m.t = 0.3;
  remember(g, m);

  if (g.phase === 'casing') {
    if (g.phaseTime > 1 + m.setup * 4) setupPurchases(g, m);
    casingGuards(g, m);
    observe(g);
    return;
  }
  // 警報後: 警備員で迎撃
  fight(g, m, guards(g));
  if (g.phase === 'assault') police(g, m);
}

function casingGuards(g: Game, m: Mem) {
  const gs = guards(g);
  // アラートには一番近い警備員を向かわせる
  const alert = g.alerts.find((a) => a.t > 5.6);
  if (alert && gs.length) {
    const u = gs.slice().sort((a, b) => dist(a.x, a.y, alert.x, alert.y) - dist(b.x, b.y, alert.x, alert.y))[0]!;
    cmd(g, { t: 'move', ids: [u.id], x: alert.x, y: alert.y + 1 });
    m.wait[u.id] = 6;
  }
  // 壊された扉は修理
  const jammed = g.doors.find((d) => d.jammed && !d.destroyed);
  if (jammed && gs.length && rand(g) < 0.1) {
    const u = gs[gs.length - 1]!;
    if (idle(u)) cmd(g, { t: 'act', id: u.id, kind: 'repair', target: jammed.id });
  }
  gs.forEach((u, i) => {
    if (!idle(u)) return;
    m.wait[u.id] = (m.wait[u.id] ?? 0) - 0.3;
    if (m.wait[u.id]! > 0) return;
    const route = PATROLS[Math.min(i, PATROLS.length - 1)]!;
    const k = ((m.patrol[u.id] ?? -1) + 1) % route.length;
    m.patrol[u.id] = k;
    const p = route[k]!;
    cmd(g, { t: 'move', ids: [u.id], x: p.x + randRange(g, -1, 1), y: p.y + randRange(g, -0.5, 0.5) });
    m.wait[u.id] = randRange(g, 2, 6);
  });
}

// 見えている手がかりだけで観察対象を選ぶ
function observe(g: Game) {
  const o = g.observe;
  const seen = g.units.filter((u) => (u.kind === 'civilian' || u.kind === 'crew') && u.alive && g.vis.bank.units.has(u.id));
  for (const u of seen) {
    if (instantlyReportable(u)) {
      cmd(g, { t: 'report', target: u.id });
      return;
    }
  }
  if (o.holding || o.cooldown > 0) return;
  let best: Unit | null = null;
  let bs = 0;
  for (const u of seen) {
    let s = rand(g) * 1.5;
    if (u.action) s += 6; // 何か作業している様子は見て取れる
    if (u.carrying >= 0) s += 6;
    if (u.look.bag !== 'none') s += 1;
    for (const d of L.doorSlots) {
      const [tx, ty] = d.tiles[0]!;
      if (isPrivateAt(tx + 0.5, ty + 0.5) && dist(u.x, u.y, tx + 0.5, ty + 0.5) < 2.2) s += 1.5;
    }
    if (s > bs) {
      bs = s;
      best = u;
    }
  }
  if (best && (bs >= 3 || rand(g) < 0.04)) cmd(g, { t: 'observe', target: best.id, holding: true });
}

function fight(g: Game, m: Mem, units: Unit[]) {
  const vis = visibleCrew(g);
  for (const u of units) {
    if (u.action) continue;
    const near = vis.slice().sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (near && dist(near.x, near.y, u.x, u.y) < 14) {
      if (!u.order || u.order.type !== 'attack' || u.order.target !== near.id) cmd(g, { t: 'attack', ids: [u.id], targetKind: 'unit', target: near.id });
      continue;
    }
    if (!idle(u)) continue;
    // 金庫に装置があれば止めに行く
    if (g.breach.installed && !g.breach.open && g.breach.method !== 'thermal' && !(g.breach.method === 'drill' && g.breach.jammed) && dist(u.x, u.y, 40, 14.6) < 3) {
      cmd(g, { t: 'act', id: u.id, kind: 'sabotage', target: 0 });
      continue;
    }
    const k = lastKnown(m, u);
    const goal = k ?? (g.breach.installed || g.breach.open ? L.vaultFront : null);
    if (goal) {
      const r = cmd(g, { t: 'move', ids: [u.id], x: goal.x + randRange(g, -1.5, 1.5), y: goal.y + randRange(g, -1, 1) });
      if (r && u.kind === 'swat') breachToward(g, m, u, goal);
    } else if (u.kind === 'swat') {
      cmd(g, { t: 'move', ids: [u.id], x: 41.5 + randRange(g, -6, 6), y: 30 + randRange(g, -3, 3) });
    }
  }
}

const BREACH_POINTS = [
  [12, 14],
  [30, 7],
  [71, 14],
  [12, 30],
  [71, 26],
  [52, 7],
];

function breachToward(g: Game, m: Mem, u: Unit, goal: { x: number; y: number }) {
  if (m.breaches >= 3) return;
  let best: number[] | null = null;
  let bd = Infinity;
  for (const p of BREACH_POINTS) {
    if (!breachableWall(g, p[0]!, p[1]!)) continue;
    const d = dist(p[0]!, p[1]!, goal.x, goal.y) + dist(p[0]!, p[1]!, u.x, u.y) * 0.5;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  if (best && !cmd(g, { t: 'act', id: u.id, kind: 'wallbreach', target: idx(best[0]!, best[1]!) })) m.breaches++;
}

function police(g: Game, m: Mem) {
  const swat = g.units.filter((u) => u.kind === 'swat' && active(u));
  fight(g, m, swat);
  if (g.negotiation.freeze > 0) return;

  if (m.vanSeen) {
    for (const slot of ['ae', 'aw']) if (!g.roadblocks.some((r) => r.slot === slot) && g.cp >= CONFIG.roadblock.cost + 10) cmd(g, { t: 'roadblock', slot });
  }
  const snipers = g.units.filter((u) => u.kind === 'sniper' && u.alive);
  if (snipers.length < CONFIG.sniper.maxActive && g.cp >= CONFIG.sniper.cost + 20) {
    const wanted = m.vanSeen || m.balloonsSeen ? ['se', 'fc', 'sw'] : ['fc', 'w', 'e'];
    const spot = wanted.find((s) => !snipers.some((u) => u.spot === s));
    if (spot) cmd(g, { t: 'sniper', spot });
  }
  if (swat.length + g.pendingSwat.length < CONFIG.swat.maxActive && g.cp >= CONFIG.swat.cost) {
    const k = m.known[m.known.length - 1];
    const staging = k ? L.staging.slice().sort((a, b) => dist(a.x, a.y, k.x, k.y) - dist(b.x, b.y, k.x, k.y))[m.stagingFlip++ % 2]! : L.staging[1]!;
    cmd(g, { t: 'swat', staging: staging.id });
  }
  // 固まっている強盗に催涙ガス
  const vis = visibleCrew(g);
  for (const a of vis) {
    const n = vis.filter((b) => dist(a.x, a.y, b.x, b.y) < CONFIG.gas.radius).length;
    if (n >= 2 && g.cp >= CONFIG.gas.cost + 30) {
      cmd(g, { t: 'gas', x: a.x, y: a.y });
      break;
    }
  }
  // 定期的に壁を抜いて別方向から入る
  if (g.phaseTime > m.nextBreach && swat.length) {
    m.nextBreach = g.phaseTime + randRange(g, 60, 100);
    const u = swat.find(idle) ?? swat[0]!;
    breachToward(g, m, u, lastKnown(m, u) ?? L.vaultFront);
  }
}
