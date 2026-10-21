import { CONFIG } from '../config';
import { idx } from '../map/level';
import { pickErrand } from '../sim/civ';
import { type Command, fortCost, issue } from '../sim/commands';
import { findPath } from '../sim/path';
import { officeDoor } from '../sim/rules';
import type { FortKind, Game, Unit } from '../sim/types';
import { type Source, sourceSees, sourcesFor } from '../sim/vision';
import { L, active, dist, fultonCommitted, isOutdoorAt, isRooftopAt, rand, randRange } from '../sim/world';

// 強盗側AI。視界外の情報（警備員の位置など）は vis.crew で見えているものだけを使う。

interface Mem {
  t: number;
  goAt: number; // 突入役が金庫へ向かう時刻
  tampered: number;
  bribed: boolean;
  useKeycard: boolean;
  bought: boolean;
  released: number;
  waitEscape: number;
  seenCams: number[];
  balloonSince?: number; // フルトン：最初の気球が上がった時刻（回収機を呼ぶ判断用）
}

function mem(g: Game): Mem {
  let m = g.aiMemory.crew as Mem | undefined;
  if (!m) {
    m = {
      t: 0,
      goAt: randRange(g, 70, 150),
      tampered: 0,
      bribed: false,
      useKeycard: g.plan.breach === 'drill' && rand(g) < 0.5,
      bought: false,
      released: 0,
      waitEscape: 0,
      seenCams: [],
    };
    g.aiMemory.crew = m;
  }
  return m;
}

const cmd = (g: Game, c: Command) => issue(g, 'crew', c);

function crew(g: Game): Unit[] {
  return g.units.filter((u) => u.kind === 'crew' && active(u) && !g.crewBalloons.some((b) => b.unit === u.id));
}

function idle(u: Unit) {
  return !u.order && !u.action && !u.path.length;
}

// 客のふりをして館内をうろつく
function blend(g: Game, u: Unit, dt: number) {
  if (!idle(u)) return;
  u.aiTimer -= dt;
  if (u.aiTimer > 0) return;
  const e = pickErrand(g);
  cmd(g, { t: 'move', ids: [u.id], x: e.p.x, y: e.p.y });
  u.aiTimer = e.wait;
}

// 鍵のかかった扉を経由して目的地へ。最初に塞いでいる扉を返す
function blockingDoor(g: Game, u: Unit, x: number, y: number): number | null {
  if (findPath(g, 'crew', u.x, u.y, x, y)) return null;
  const p = findPath(g, 'staff', u.x, u.y, x, y);
  if (!p) return null;
  let px = u.x;
  let py = u.y;
  for (const q of p) {
    const d = dist(px, py, q.x, q.y);
    const n = Math.max(1, Math.ceil(d / 0.25));
    for (let i = 1; i <= n; i++) {
      const sx = px + ((q.x - px) * i) / n;
      const sy = py + ((q.y - py) * i) / n;
      const s = L.doorAt[idx(Math.floor(sx), Math.floor(sy))]!;
      if (s >= 0) {
        const door = g.doors[s]!;
        if (door.locked && !door.jammed && !door.destroyed) return door.id;
      }
    }
    px = q.x;
    py = q.y;
  }
  return null;
}

function goTo(g: Game, u: Unit, x: number, y: number): void {
  const door = blockingDoor(g, u, x, y);
  if (door !== null) {
    const d = g.doors.find((d) => d.id === door)!;
    const office = L.doorSlots[d.slot]!.kind === 'office';
    if (office && g.stock.drill > 0) cmd(g, { t: 'act', id: u.id, kind: 'officedrill', target: door });
    else if (!office) cmd(g, { t: 'act', id: u.id, kind: 'lockpick', target: door });
    return;
  }
  cmd(g, { t: 'move', ids: [u.id], x, y });
}

// 金庫までの道筋（スタッフゲート → 営業室 → 営業室扉 → 金庫前）。扉の位置はレイアウトで変わる
function route(): { x: number; y: number }[] {
  const ox = L.doorSlots.find((s) => s.id === 'office')!.tiles[0]![0] + 0.5;
  return [
    { x: 24.5, y: 23.5 },
    { x: 24.8, y: 22.5 },
    { x: (24.8 + ox) / 2, y: 19.5 },
    { x: ox, y: 16.5 },
    { x: (ox + L.vaultFront.x) / 2, y: 14.6 },
    { ...L.vaultFront },
  ];
}

// 強盗側が把握している監視の目（見つけたカメラと支店長室の窓）
function knownWatchers(g: Game, m: Mem): Source[] {
  return sourcesFor(g, 'bank').filter(
    (s) => s.live && (s.kind === 'office' || (s.kind === 'camera' && g.cameras.some((c) => m.seenCams.includes(c.id) && c.x === s.x && c.y === s.y))),
  );
}

function watched(g: Game, m: Mem, x: number, y: number, except?: { x: number; y: number }): boolean {
  return knownWatchers(g, m).some((s) => !(except && s.x === except.x && s.y === except.y) && sourceSees(g, s, x, y));
}

function tamperTargets(g: Game, m: Mem) {
  const out: { id: number; score: number }[] = [];
  const bank = sourcesFor(g, 'bank');
  for (const c of g.cameras) {
    if (c.destroyed || c.loop > 0 || !m.seenCams.includes(c.id)) continue;
    const s = bank.find((s) => s.kind === 'camera' && s.x === c.x && s.y === c.y);
    if (!s) continue;
    // 細工する姿が別のカメラに映るなら後回し
    if (watched(g, m, c.x, c.y, c)) continue;
    const score = route().filter((p) => sourceSees(g, s, p.x, p.y)).length;
    if (score > 0) out.push({ id: c.id, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

function routeWatched(g: Game, m: Mem): boolean {
  return route().slice(1).some((p) => watched(g, m, p.x, p.y));
}

function buy(g: Game, item: FortKind, n: number, reserve = 0) {
  for (let i = 0; i < n; i++) {
    if (g.funds.crew - fortCost(item) < reserve) return;
    if (cmd(g, { t: 'buyStock', item })) return;
  }
}

const TURRET_SPOTS = [
  { x: 37.5, y: 14.5 },
  { x: 43.5, y: 15.5 },
  { x: 30.5, y: 14.5 },
];
function trapSpots() {
  const ox = L.doorSlots.find((s) => s.id === 'office')!.tiles[0]![0] + 0.5;
  return [
    { x: 26.5, y: 14.5 },
    { x: 55.5, y: 15.5 },
    { x: ox, y: 17.5 },
    { x: 45.5, y: 14.5 },
  ];
}

function deployStock(g: Game, team: Unit[]) {
  if (g.phase === 'casing') return;
  const tryAt = (item: 'turret' | 'barricade' | 'trap', spots: { x: number; y: number }[]) => {
    for (const p of spots) {
      if (g.stock[item] <= 0) return;
      if (!team.some((u) => dist(u.x, u.y, p.x, p.y) < 6)) continue;
      cmd(g, { t: 'deploy', item, x: p.x, y: p.y });
    }
  };
  tryAt('turret', TURRET_SPOTS);
  const doorSpots: { x: number; y: number }[] = [];
  for (const id of ['dock', 'security', 'locker', 'office', 'storage']) {
    const s = L.doorSlots.find((s) => s.id === id)!;
    for (const [x, y] of s.tiles) doorSpots.push({ x: x + 0.5, y: y + 0.5 });
  }
  tryAt('barricade', doorSpots);
  tryAt('trap', trapSpots());
}


function escapePoint(g: Game, u: Unit): { x: number; y: number } {
  if (g.plan.escape === 'van' && g.van) return { x: g.van.x, y: g.van.y + 1.8 };
  // フルトンはホテル屋上（非常階段を上がってすぐの場所）で気球を上げる
  let best = L.rooftopSpots[0]!;
  let bl = Infinity;
  for (const p of L.rooftopSpots) {
    const path = findPath(g, 'crew', u.x, u.y, p.x, p.y);
    if (!path) continue;
    let len = 0;
    let px = u.x;
    let py = u.y;
    for (const q of path) {
      len += dist(px, py, q.x, q.y);
      px = q.x;
      py = q.y;
    }
    if (len < bl) {
      bl = len;
      best = p;
    }
  }
  return best;
}

export function robberAI(g: Game, dt: number): void {
  const m = mem(g);
  const team = crew(g);
  // 客のふりは毎フレーム
  if (g.phase === 'casing') for (const u of team) if (u.role === '' || u.role === 'blend') blend(g, u, dt);
  m.t -= dt;
  if (m.t > 0) return;
  m.t = 0.4;
  if (!team.length) return;
  // フルトン：屋上に気球が上がっていれば回収機を呼ぶ。脱出の段階では屋上に向かう仲間がそろうのを少し待つ
  const p = g.plane;
  const up = g.bags.some((b) => b.state === 'balloon') || g.crewBalloons.length > 0;
  if (!up) m.balloonSince = undefined;
  else m.balloonSince ??= g.time;
  if (g.plan.escape === 'fulton' && up && p.eta < 0 && p.pass <= 0 && p.cooldown <= 0) {
    const leaving = escapeReady(g, team);
    const gathered = team.every((u) => isRooftopAt(u.x, u.y));
    if (!leaving || gathered || g.time - (m.balloonSince ?? g.time) > 15) cmd(g, { t: 'callPlane' });
  }

  const breacher = team.find((u) => u.hasTool) ?? null;
  const keyHolder = team.find((u) => u.hasKey) ?? null;
  const time = g.phaseTime;
  for (const id of g.vis.crew.cameras) if (!m.seenCams.includes(id)) m.seenCams.push(id);

  if (g.phase === 'casing') {
    // 増員と装備の事前購入（購入は相手から見えない）
    if (time > 8 && g.crewHired < 3 && g.funds.crew > CONFIG.crew.hireCost + 500_000) cmd(g, { t: 'hire' });
    if (!m.bought && time > 15) {
      m.bought = true;
      if (m.useKeycard) buy(g, 'drill', 1);
      buy(g, 'turret', 1, 450_000);
      buy(g, 'barricade', 2, 400_000);
      buy(g, 'trap', 1, 400_000);
    }
    for (const u of team) if (u.role === '') u.role = 'blend';

    // カメラ細工（見えている範囲で、侵入経路を映すもの）
    if (m.tampered < 2 && time > 25 && g.funds.crew > CONFIG.actions.tamper.cost + 200_000) {
      const t = tamperTargets(g, m)[0];
      const worker = team.find((u) => u !== breacher && u.role === 'blend' && idle(u)) ?? team.find((u) => u.role === 'blend' && u !== breacher);
      if (t && worker) {
        worker.role = 'task';
        cmd(g, { t: 'act', id: worker.id, kind: 'tamper', target: t.id });
        m.tampered++;
      }
    }
    // 警備員の買収
    if (!m.bribed && time > 40 && g.funds.crew > CONFIG.actions.bribe.cost + 250_000) {
      const guard = g.units.find((u) => u.kind === 'guard' && u.alive && !u.bribed && g.vis.crew.units.has(u.id));
      const worker = team.find((u) => u !== breacher && u.role === 'blend');
      if (guard && worker) {
        worker.role = 'task';
        cmd(g, { t: 'act', id: worker.id, kind: 'bribe', target: guard.id });
        m.bribed = true;
      }
    }
    for (const u of team) if (u.role === 'task' && idle(u)) u.role = 'blend';

    // 突入役が金庫へ（経路が見張られていれば、ループ映像が効くまで少し待つ）
    if (time > m.goAt && (!routeWatched(g, m) || time > m.goAt + 70)) infiltrate(g, m, team, breacher, keyHolder);
    if (g.breach.open) carryGold(g, team);
    if (time > CONFIG.phase.casingSeconds - 20 && !g.breach.installed && !g.breach.open) cmd(g, { t: 'goLoud' });
    if (escapeReady(g, team)) escape(g, m, team);
    return;
  }

  // ---- 警報後 ----
  for (const u of team) if (u.role === 'blend' || u.role === 'task' || u.role === '') u.role = 'defend';
  if (g.phase === 'response') {
    if (g.crewHired < 4 && g.funds.crew > CONFIG.crew.hireCost + 300_000) cmd(g, { t: 'hire' });
    buy(g, 'turret', 1, 300_000);
    buy(g, 'barricade', 2, 200_000);
    const armor = team.find((u) => !u.heavy && u !== breacher && idle(u));
    if (armor && g.funds.crew > CONFIG.heavy.cost + 200_000) cmd(g, { t: 'act', id: armor.id, kind: 'equip', target: armor.id });
  }
  deployStock(g, team);
  // 屋上への近道は、金庫が開く頃に開ける（突破中は守りを手薄にしない）
  if (g.plan.escape === 'fulton' && (g.breach.open || g.breach.progress > 0.6)) openStaffDoor(g, team);

  // 人質を確保（逃げている人や屋外の人を追いかけ回さない）
  const hostages = g.units.filter((u) => u.alive && u.brain?.state === 'hostage').length;
  if (hostages < 3) {
    for (const u of team) {
      if (u === breacher || u.role === 'opener' || !idle(u) || u.carrying >= 0) continue;
      const civ = g.units
        .filter(
          (c) =>
            (c.kind === 'civilian' || c.kind === 'staff' || c.kind === 'manager') &&
            c.alive &&
            c.brain &&
            c.brain.state !== 'hostage' &&
            c.brain.state !== 'gone' &&
            c.brain.state !== 'flee' &&
            !isOutdoorAt(c.x, c.y) &&
            g.vis.crew.units.has(c.id),
        )
        .sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
      if (civ && dist(civ.x, civ.y, u.x, u.y) < 8) {
        cmd(g, { t: 'act', id: u.id, kind: 'hostage', target: civ.id });
        break;
      }
    }
  }

  if (g.phase === 'assault') {
    // 人質交換: 購入機会と交渉カード
    if (hostages > 0 && (m.released === 0 || (m.released < 3 && g.negotiation.cards === 0 && time > 60 * (m.released + 1)))) {
      if (!cmd(g, { t: 'release' })) {
        m.released++;
        buy(g, g.funds.crew >= fortCost('turret') ? 'turret' : 'barricade', 1, 0);
      }
    }
    const swatNear = g.units.filter((u) => u.kind === 'swat' && active(u) && g.vis.crew.units.has(u.id)).length;
    if (swatNear >= 2 && g.negotiation.cards > 0) cmd(g, { t: 'negotiate' });
  }

  if (escapeReady(g, team)) {
    escape(g, m, team);
    return;
  }
  if (!g.breach.open) infiltrate(g, m, team, breacher, keyHolder);
  else carryGold(g, team);

  // 守備役は金庫前の廊下を固める
  for (const u of team) {
    if (u.role !== 'defend' || !idle(u)) continue;
    const p = TURRET_SPOTS[u.id % TURRET_SPOTS.length]!;
    if (dist(u.x, u.y, p.x, p.y) > 4) goTo(g, u, p.x + randRange(g, -1, 1), p.y + 0.5);
  }
}

// フルトン：屋上の非常階段への近道（ロッカー室の通用口 → 裏通り）を開けておく。警報後なので爆薬で手早く
function openStaffDoor(g: Game, team: Unit[]) {
  const slot = L.doorSlots.findIndex((s) => s.id === 'staffdoor');
  const door = g.doors[slot]!;
  const opener = team.find((u) => u.role === 'opener');
  if (!door.locked || door.jammed || door.destroyed) {
    if (opener && idle(opener)) opener.role = 'defend';
    return;
  }
  if (opener && !idle(opener)) return;
  const [tx, ty] = L.doorSlots[slot]!.tiles[0]!;
  const u =
    opener ??
    team
      .filter((u) => u.role === 'defend' && idle(u) && u.carrying < 0)
      .sort((a, b) => dist(a.x, a.y, tx, ty) - dist(b.x, b.y, tx, ty))[0];
  if (!u) return;
  u.role = 'opener';
  const kind = g.funds.crew >= CONFIG.actions.c4.cost ? 'c4' : 'lockpick';
  // 内側（ロッカー室）から破る。途中の扉が施錠されていれば先にそれを破る
  const ax = tx + 0.5;
  const ay = ty + 1.5;
  if (!findPath(g, 'crew', u.x, u.y, ax, ay)) {
    const first = blockingDoor(g, u, ax, ay);
    if (first !== null) cmd(g, { t: 'act', id: u.id, kind, target: first });
    return;
  }
  cmd(g, { t: 'act', id: u.id, kind, target: door.id });
}

function infiltrate(g: Game, m: Mem, team: Unit[], breacher: Unit | null, keyHolder: Unit | null) {
  const b = g.breach;
  if (b.open) return;
  // キーカードがあれば最優先
  if (keyHolder && idle(keyHolder)) {
    keyHolder.role = 'breach';
    if (dist(keyHolder.x, keyHolder.y, L.vaultFront.x, L.vaultFront.y) < 1.5) cmd(g, { t: 'act', id: keyHolder.id, kind: 'keycard', target: 0 });
    else goTo(g, keyHolder, L.vaultFront.x, L.vaultFront.y);
    return;
  }
  // 支店長室ルート
  const od = officeDoor(g);
  if (m.useKeycard && !keyHolder) {
    const worker = team.find((u) => u.role === 'office') ?? team.find((u) => u !== breacher && (u.role === 'blend' || u.role === 'defend'));
    if (worker && idle(worker)) {
      worker.role = 'office';
      const card = g.bags.find((k) => k.kind === 'keycard' && k.state === 'ground');
      if (od.destroyed && card) cmd(g, { t: 'act', id: worker.id, kind: 'pickup', target: card.id });
      else if (!od.destroyed && !g.officeDrill.installed && g.stock.drill > 0) {
        if (dist(worker.x, worker.y, 56.5, 15.2) < 1.2) cmd(g, { t: 'act', id: worker.id, kind: 'officedrill', target: od.id });
        else goTo(g, worker, 56.5, 15.2);
      } else if (!card && !worker.hasKey) worker.role = 'blend';
    }
  }
  // 落ちている突破ツールを拾う
  if (!breacher && !b.installed) {
    const tool = g.bags.find((k) => k.kind === 'tool' && k.state === 'ground');
    const u = team.filter(idle).sort((a, c) => (tool ? dist(a.x, a.y, tool.x, tool.y) - dist(c.x, c.y, tool.x, tool.y) : 0))[0];
    if (tool && u) cmd(g, { t: 'act', id: u.id, kind: 'pickup', target: tool.id });
  }
  if (breacher && idle(breacher) && !b.installed) {
    breacher.role = 'breach';
    if (dist(breacher.x, breacher.y, L.vaultFront.x, L.vaultFront.y) < 1.5) cmd(g, { t: 'act', id: breacher.id, kind: 'install', target: 0 });
    else goTo(g, breacher, L.vaultFront.x, L.vaultFront.y);
  }
  // ドリルの修理
  if (b.installed && b.jammed) {
    const fixer = team.filter((u) => idle(u) || u.role === 'breach').sort((a, c) => dist(a.x, a.y, 40, 14.6) - dist(c.x, c.y, 40, 14.6))[0];
    if (fixer && !fixer.action) {
      if (dist(fixer.x, fixer.y, L.vaultFront.x, L.vaultFront.y) < 1.5) cmd(g, { t: 'act', id: fixer.id, kind: 'fix', target: 0 });
      else if (idle(fixer)) goTo(g, fixer, L.vaultFront.x, L.vaultFront.y);
    }
  }
  // 設置後の突入役は扉の前で待つ
  if (b.installed) {
    const w = team.find((u) => u.role === 'breach');
    if (w && idle(w) && dist(w.x, w.y, L.vaultFront.x, L.vaultFront.y) > 3) goTo(g, w, L.vaultFront.x + 1.5, L.vaultFront.y);
  }
}

function carryGold(g: Game, team: Unit[]) {
  const left = g.bags.filter((b) => b.kind === 'gold' && (b.state === 'vault' || b.state === 'ground'));
  const defenders = g.phase === 'casing' ? 0 : Math.min(1, team.length - 1);
  let assigned = 0;
  for (const u of team) {
    if (u.carrying >= 0) {
      if (!idle(u)) continue;
      const p = escapePoint(g, u);
      if (g.plan.escape === 'van' && g.van && dist(u.x, u.y, g.van.x, g.van.y) <= CONFIG.escape.van.loadRadius) {
        cmd(g, { t: 'act', id: u.id, kind: 'deposit', target: 0 });
      } else if (g.plan.escape === 'fulton' && isRooftopAt(u.x, u.y)) {
        cmd(g, { t: 'act', id: u.id, kind: 'fulton', target: 0 });
      } else goTo(g, u, p.x, p.y);
      continue;
    }
    if (u.role === 'defend' && assigned >= team.length - defenders) continue;
    if (!idle(u) && u.role !== 'blend') continue;
    const bag = left.sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (!bag) break;
    left.splice(left.indexOf(bag), 1);
    u.role = 'carry';
    assigned++;
    cmd(g, { t: 'act', id: u.id, kind: 'pickup', target: bag.id });
  }
}

function escapeReady(g: Game, team: Unit[]): boolean {
  const q = CONFIG.gold.quotaBags;
  if (g.plan.escape === 'van') {
    const v = g.van;
    if (!v || v.state !== 'parked' || v.bags < q) return false;
    const remaining = g.bags.filter((b) => b.kind === 'gold' && (b.state === 'vault' || b.state === 'ground' || b.state === 'carried')).length;
    const hurt = team.filter((u) => u.hp < u.maxHp * 0.5).length;
    return v.bags >= q + 2 || remaining === 0 || g.phaseTime > 240 || team.length <= 2 || hurt >= 2 || g.phase === 'casing';
  }
  // フルトン：回収済み・回収待ち・運搬中の袋が目標に届いたら、屋上へ集まって袋ごと脱出する
  return fultonCommitted(g) + team.filter((u) => u.carrying >= 0).length >= q;
}

function escape(g: Game, m: Mem, team: Unit[]) {
  if (g.plan.escape === 'van' && g.van && g.van.state === 'parked') {
    const v = g.van;
    const R = CONFIG.escape.van.loadRadius;
    m.waitEscape += 0.4;
    for (const u of team) {
      const d = dist(u.x, u.y, v.x, v.y);
      if (u.carrying >= 0 && d <= R) {
        if (!u.action) cmd(g, { t: 'act', id: u.id, kind: 'deposit', target: 0 });
      } else if (d > R - 0.4 && !u.action && (!u.order || u.order.type !== 'move' || !u.path.length)) goTo(g, u, v.x + randRange(g, -1, 1), v.y + 1.6);
    }
    const near = team.filter((u) => dist(u.x, u.y, v.x, v.y) <= R && u.carrying < 0).length;
    if (near >= team.length || (near > 0 && m.waitEscape > 8)) cmd(g, { t: 'escape' });
  }
  if (g.plan.escape === 'fulton') {
    for (const u of team) {
      if (!idle(u) || g.crewBalloons.some((b) => b.unit === u.id)) continue;
      if (isRooftopAt(u.x, u.y)) cmd(g, { t: 'act', id: u.id, kind: 'extract', target: 0 });
      else {
        const p = escapePoint(g, u);
        goTo(g, u, p.x + randRange(g, -1, 1), p.y);
      }
    }
  }
}
