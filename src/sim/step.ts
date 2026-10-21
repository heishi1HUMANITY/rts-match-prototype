import { CONFIG } from '../config';
import { W } from '../map/level';
import { robberAI } from '../ai/robber';
import { managerAI } from '../ai/manager';
import { updateCivilians } from './civ';
import {
  actionDuration,
  actionTarget,
  blastAlarm,
  callPolice,
  completeAction,
  crewSuspicious,
  damageUnit,
  endGame,
  inGas,
  killUnit,
  openVault,
  officeDoor,
  policeFrozen,
  setPath,
  speedOf,
  startAssault,
  tally,
  validateAction,
  VAULT_DOOR,
} from './rules';
import type { Bag, Fx, Game, Side, Unit } from './types';
import { computeVisibility, los } from './vision';
import { nearestPassable } from './path';
import { updateAutomation } from './auto';
import {
  L,
  active,
  alertBank,
  angleDiff,
  dist,
  isArmedPhase,
  isPrivateAt,
  isRooftopAt,
  makeUnit,
  moverClass,
  news,
  passable,
  rand,
  roomNameAt,
  securedBags,
  unitById,
} from './world';

export function step(g: Game, dt: number): void {
  updateFx(g, dt);
  if (g.phase === 'ended') return;
  g.tick++;
  g.time += dt;
  g.phaseTime += dt;
  phaseLogic(g, dt);
  updateCivilians(g, dt);
  if (g.controllers.crew.ai) robberAI(g, dt);
  if (g.controllers.bank.ai) managerAI(g, dt);
  updateAutomation(g);
  updateDoors(g);
  updateUnits(g, dt);
  separate(g);
  updateCombat(g);
  updateObjects(g, dt);
  if (g.tick % 3 === 0) computeVisibility(g);
  updateObserve(g, dt);
  checkWin(g);
  cleanup(g);
}

function phaseLogic(g: Game, dt: number) {
  const n = g.negotiation;
  n.freeze = Math.max(0, n.freeze - dt);
  n.cooldown = Math.max(0, n.cooldown - dt);
  g.gasCooldown = Math.max(0, g.gasCooldown - dt);
  if (g.phase === 'casing' && g.phaseTime >= CONFIG.phase.casingSeconds) {
    callPolice(g, '閉店時刻 — 館内に残った不審者を確認');
  } else if (g.phase === 'response' && g.phaseTime >= CONFIG.phase.responseSeconds) {
    startAssault(g);
  } else if (g.phase === 'assault') {
    if (n.freeze <= 0) g.cp = Math.min(CONFIG.police.cpMax, g.cp + CONFIG.police.cpRegen * dt);
    if (g.phaseTime >= CONFIG.phase.assaultSeconds) endGame(g, 'bank', '包囲完了 — 強盗団は逃げ場を失い投降');
  }
}

function updateDoors(g: Game) {
  for (const d of g.doors) {
    if (d.destroyed || d.jammed) {
      d.open = true;
      continue;
    }
    const tiles = L.doorSlots[d.slot]!.tiles;
    let open = false;
    for (const u of g.units) {
      if (!active(u) || u.kind === 'sniper') continue;
      const cls = moverClass(u.kind);
      if (d.locked && (cls === 'crew' || cls === 'civ')) continue;
      for (const [tx, ty] of tiles) {
        if (Math.abs(u.x - tx - 0.5) < 1.3 && Math.abs(u.y - ty - 0.5) < 1.3) {
          open = true;
          break;
        }
      }
      if (open) break;
    }
    d.open = open;
  }
}

// ---- ユニット ----
function inBalloon(g: Game, u: Unit) {
  return g.crewBalloons.some((b) => b.unit === u.id);
}

function updateUnits(g: Game, dt: number) {
  const frozen = policeFrozen(g);
  for (const u of g.units) {
    if (!active(u) || u.kind === 'sniper') continue;
    u.stun = Math.max(0, u.stun - dt);
    u.cooldown -= dt;
    u.repath -= dt;
    if (u.kind === 'crew') {
      u.suspicious = crewSuspicious(g, u);
      u.privateSeen = isPrivateAt(u.x, u.y) && g.vis.bank.units.has(u.id) ? u.privateSeen + dt : 0;
    }
    if (frozen && u.kind === 'swat') {
      u.moving = false;
      continue;
    }
    if (u.stun > 0 || inBalloon(g, u)) {
      u.moving = false;
      continue;
    }
    if (u.deserting) {
      if (!u.path.length) {
        if (u.x < 1 || u.x > W - 1.5 || u.y < 2.5) u.escaped = true;
        else setPath(g, u, u.x < 42 ? 0.3 : W - 0.3, 40.5);
      }
      move(g, u, dt);
      continue;
    }
    processOrder(g, u);
    processAction(g, u, dt);
    move(g, u, dt);
  }
}

function attackTargetPos(g: Game, u: Unit): { x: number; y: number } | null {
  const o = u.order;
  if (!o || o.type !== 'attack') return null;
  switch (o.targetKind) {
    case 'unit': {
      const t = unitById(g, o.target);
      return t && active(t) ? t : null;
    }
    case 'camera': {
      const c = g.cameras.find((c) => c.id === o.target && !c.destroyed);
      return c ?? null;
    }
    case 'turret':
      return g.turrets.find((t) => t.id === o.target) ?? null;
    case 'barricade':
      return g.barricades.find((t) => t.id === o.target) ?? null;
    case 'roadblock': {
      const r = g.roadblocks.find((r) => r.id === o.target);
      return r ? roadblockPos(r.slot) : null;
    }
    case 'van':
      return g.van && (g.van.state === 'driving' || g.van.state === 'blocked') ? g.van : null;
    case 'balloon': {
      const b = g.bags.find((b) => b.id === o.target && b.state === 'balloon');
      return b ?? null;
    }
  }
}

export function roadblockPos(slotId: string): { x: number; y: number } {
  const s = L.roadblocks.find((s) => s.id === slotId)!;
  return { x: s.x + 0.5, y: (s.y0 + s.y1 + 1) / 2 };
}

function processOrder(g: Game, u: Unit) {
  const o = u.order;
  if (!o) return;
  if (o.type === 'move') {
    if (!u.path.length) u.order = null;
    return;
  }
  if (o.type === 'attack') {
    const p = attackTargetPos(g, u);
    if (!p) {
      u.order = null;
      return;
    }
    const range = weapon(u).range;
    if (dist(u.x, u.y, p.x, p.y) <= range * 0.92 && los(g, u.x, u.y, p.x, p.y)) {
      u.path = [];
    } else if (u.repath <= 0) {
      setPath(g, u, p.x, p.y);
      u.repath = 0.8;
    }
    return;
  }
  if (u.action) return;
  const tgt = actionTarget(g, u, o.kind, o.target);
  if (!tgt) {
    u.order = null;
    return;
  }
  if (dist(u.x, u.y, tgt.x, tgt.y) <= tgt.reach) {
    const err = validateAction(g, u, o.kind, o.target);
    u.order = null;
    if (err) {
      if (u.kind === 'crew') news(g, `${u.callsign}: ${err}`, 'crew');
      else news(g, err, 'bank');
      return;
    }
    u.path = [];
    u.action = { kind: o.kind, t: 0, dur: actionDuration(g, u, o.kind, o.target), target: o.target };
    u.facing = Math.atan2(tgt.y - u.y, tgt.x - u.x);
    return;
  }
  const movingTarget = o.kind === 'bribe' || o.kind === 'hostage';
  if (!u.path.length || (movingTarget && u.repath <= 0)) {
    if (!u.path.length && dist(u.x, u.y, tgt.approach.x, tgt.approach.y) < 0.4) {
      u.order = null;
      return;
    }
    if (!setPath(g, u, tgt.approach.x, tgt.approach.y)) {
      u.order = null;
      if (u.kind === 'crew') news(g, `${u.callsign}: そこへは行けない`, 'crew');
      return;
    }
    u.repath = movingTarget ? 0.6 : 3;
  }
}

function processAction(g: Game, u: Unit, dt: number) {
  const a = u.action;
  if (!a) return;
  const tgt = actionTarget(g, u, a.kind, a.target);
  if (!tgt || dist(u.x, u.y, tgt.x, tgt.y) > tgt.reach * 1.5) {
    u.action = null;
    return;
  }
  if (a.kind === 'bribe' || a.kind === 'hostage') {
    const t = unitById(g, a.target);
    if (t) {
      t.path = [];
      t.facing = Math.atan2(u.y - t.y, u.x - t.x);
    }
  }
  if (tgt.reach !== Infinity) u.facing = Math.atan2(tgt.y - u.y, tgt.x - u.x);
  a.t += dt;
  if (a.t >= a.dur) {
    u.action = null;
    completeAction(g, u, a.kind, a.target);
  }
}

function blockedAt(g: Game, u: Unit, x: number, y: number): boolean {
  const r = CONFIG.move.radius;
  const cls = moverClass(u.kind);
  return (
    !passable(g, cls, Math.floor(x - r), Math.floor(y - r)) ||
    !passable(g, cls, Math.floor(x + r), Math.floor(y - r)) ||
    !passable(g, cls, Math.floor(x - r), Math.floor(y + r)) ||
    !passable(g, cls, Math.floor(x + r), Math.floor(y + r))
  );
}

function tryMove(g: Game, u: Unit, nx: number, ny: number): boolean {
  if (!blockedAt(g, u, nx, ny)) {
    u.x = nx;
    u.y = ny;
    return true;
  }
  // 壁沿いに滑らせる。その軸で実際に動けるときだけ成功（動かないのに成功扱いにすると壁に押し付け続ける）
  if (Math.abs(nx - u.x) > 1e-4 && !blockedAt(g, u, nx, u.y)) {
    u.x = nx;
    return true;
  }
  if (Math.abs(ny - u.y) > 1e-4 && !blockedAt(g, u, u.x, ny)) {
    u.y = ny;
    return true;
  }
  return false;
}

function move(g: Game, u: Unit, dt: number) {
  if (!u.path.length) {
    u.moving = false;
    u.stuck = 0;
    return;
  }
  // 家具や壁に食い込んで動けなくなったら、近くの通れる場所へ出す
  if (blockedAt(g, u, u.x, u.y)) {
    const free = nearestPassable(g, moverClass(u.kind), Math.floor(u.x), Math.floor(u.y), 3);
    if (free) {
      u.x = free[0] + 0.5;
      u.y = free[1] + 0.5;
    }
  }
  // 進んだかどうかは「次の通過点への最短距離を更新したか」で測る（障害物の前で行き来しているだけなら進んでいない）
  if (u.nearLen !== u.path.length) {
    u.nearLen = u.path.length;
    u.near = 1e9;
  }
  const len0 = u.path.length;
  let remaining = speedOf(g, u) * dt;
  let moved = false;
  let guard = 0;
  while (remaining > 1e-4 && u.path.length && guard++ < 6) {
    const p = u.path[0]!;
    const dx = p.x - u.x;
    const dy = p.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d > 1e-3 && g.time - u.lastShot > 0.5) u.facing = Math.atan2(dy, dx);
    if (d <= remaining) {
      // 端点は壁際になりうるので、ずれても到着扱いにする
      tryMove(g, u, p.x, p.y);
      u.path.shift();
      remaining -= d;
      moved = true;
    } else {
      const ok = tryMove(g, u, u.x + (dx / d) * remaining, u.y + (dy / d) * remaining);
      remaining = 0;
      moved = ok;
      if (!ok && d < 0.5) u.path.shift();
      else if (!ok) {
        // 角や扉枠に引っかかった：今いるタイルの中心へ寄せてから進み直す。
        // それでも進めなければ下の stuck 判定で経路を引き直す
        const cx = Math.floor(u.x) + 0.5;
        const cy = Math.floor(u.y) + 0.5;
        const dd = Math.hypot(cx - u.x, cy - u.y);
        if (dd > 0.02) {
          const s = Math.min(dd, speedOf(g, u) * dt);
          moved = tryMove(g, u, u.x + ((cx - u.x) / dd) * s, u.y + ((cy - u.y) / dd) * s);
        }
      }
    }
  }
  u.moving = moved;
  // 経路があるのに進めない状態が続いたら引き直す。2回引き直しても進めなければ移動をあきらめる（同じ場所へ引き直し続けない）
  let progressed = u.path.length < len0;
  if (u.path.length) {
    const wp = u.path[0]!;
    const d = Math.hypot(wp.x - u.x, wp.y - u.y);
    if (progressed || d < u.near - speedOf(g, u) * dt * 0.2) {
      progressed = true;
      u.near = d;
      u.nearLen = u.path.length;
    }
  }
  if (!progressed) {
    const before = u.stuck;
    u.stuck += dt;
    if (u.stuck >= 2.4) {
      u.path = [];
      if (u.order?.type === 'move') u.order = null;
      u.stuck = 0;
    } else if (u.path.length && ((before < 0.8 && u.stuck >= 0.8) || (before < 1.6 && u.stuck >= 1.6))) {
      const end = u.path[u.path.length - 1]!;
      if (!setPath(g, u, end.x, end.y)) u.path = [];
    }
  } else u.stuck = 0;
}

// 重なりを軽く押し出す
function separate(g: Game) {
  const list = g.units.filter((u) => active(u) && u.kind !== 'sniper' && u.brain?.state !== 'hostage');
  for (let i = 0; i < list.length; i++) {
    const a = list[i]!;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.36 || d2 < 1e-6) continue;
      // すれ違う者どうしは押し合わない（狭い廊下で正面から詰まるため）。
      // 歩いている者は立ち止まっている者を押しのけ、作業中の者は動かさない
      const aWalk = a.path.length > 0;
      const bWalk = b.path.length > 0;
      if (aWalk && bWalk) continue;
      const d = Math.sqrt(d2);
      const push = (0.6 - d) * 0.25;
      const px = (dx / d) * push;
      const py = (dy / d) * push;
      const moveA = !a.action && !aWalk;
      const moveB = !b.action && !bWalk;
      const ka = moveA ? (moveB ? 1 : 2) : 0;
      const kb = moveB ? (moveA ? 1 : 2) : 0;
      if (ka && !blockedAt(g, a, a.x - px * ka, a.y - py * ka)) {
        a.x -= px * ka;
        a.y -= py * ka;
      }
      if (kb && !blockedAt(g, b, b.x + px * kb, b.y + py * kb)) {
        b.x += px * kb;
        b.y += py * kb;
      }
    }
  }
}

// ---- 戦闘 ----
interface Weapon {
  damage: number;
  interval: number;
  range: number;
  accuracy: number;
}

export function weapon(u: Unit): Weapon {
  switch (u.kind) {
    case 'crew': {
      const C = CONFIG.crew;
      return { damage: C.damage * (u.heavy ? CONFIG.heavy.damageMul : 1), interval: C.fireInterval, range: C.range, accuracy: C.accuracy };
    }
    case 'guard':
      return { damage: CONFIG.guard.damage, interval: CONFIG.guard.fireInterval, range: CONFIG.guard.range, accuracy: CONFIG.guard.accuracy };
    case 'swat':
      return { damage: CONFIG.swat.damage, interval: CONFIG.swat.fireInterval, range: CONFIG.swat.range, accuracy: CONFIG.swat.accuracy };
    case 'sniper':
      return { damage: CONFIG.sniper.damage, interval: CONFIG.sniper.fireInterval, range: CONFIG.vision.sniper.range, accuracy: CONFIG.sniper.accuracy };
    default:
      return { damage: 0, interval: 1, range: 0, accuracy: 0 };
  }
}

type Target =
  | { kind: 'unit'; u: Unit; x: number; y: number }
  | { kind: 'turret'; id: number; x: number; y: number }
  | { kind: 'barricade'; id: number; x: number; y: number }
  | { kind: 'camera'; id: number; x: number; y: number }
  | { kind: 'roadblock'; id: number; x: number; y: number }
  | { kind: 'van'; x: number; y: number }
  | { kind: 'balloon'; bag: Bag; x: number; y: number }
  | { kind: 'crewballoon'; unit: number; x: number; y: number };

function canShoot(g: Game, u: { x: number; y: number; kind?: string }, range: number, x: number, y: number, cone?: { dir: number; fov: number }) {
  const d = dist(u.x, u.y, x, y);
  if (d > range) return false;
  // ホテル屋上と地上の間では撃ち合えない（手すりの陰）。高所の狙撃手だけは別
  if (u.kind !== 'sniper' && isRooftopAt(u.x, u.y) !== isRooftopAt(x, y)) return false;
  if (cone && Math.abs(angleDiff(Math.atan2(y - u.y, x - u.x), cone.dir)) > cone.fov / 2) return false;
  return los(g, u.x, u.y, x, y);
}

function chooseTarget(g: Game, u: Unit): Target | null {
  const w = weapon(u);
  const side: Side = u.kind === 'crew' ? 'crew' : 'bank';
  const spot = u.kind === 'sniper' ? L.sniperSpots.find((s) => s.id === u.spot) : undefined;
  const cone = spot ? { dir: spot.dir, fov: (CONFIG.vision.sniper.fov * Math.PI) / 180 } : undefined;
  const ok = (x: number, y: number) => canShoot(g, u, w.range, x, y, cone);

  const o = u.order;
  if (o && o.type === 'attack') {
    const p = attackTargetPos(g, u);
    if (p && ok(p.x, p.y)) {
      switch (o.targetKind) {
        case 'unit':
          return { kind: 'unit', u: p as Unit, x: p.x, y: p.y };
        case 'van':
          return { kind: 'van', x: p.x, y: p.y };
        case 'balloon':
          // 屋上の気球は屋上にいる者しか撃てない
          if (!isRooftopAt(u.x, u.y)) break;
          return { kind: 'balloon', bag: p as Bag, x: p.x, y: p.y };
        default:
          return { kind: o.targetKind, id: o.target, x: p.x, y: p.y };
      }
    }
  }

  let best: Target | null = null;
  let bd = Infinity;
  const consider = (t: Target, bias = 0) => {
    const d = dist(u.x, u.y, t.x, t.y) + bias;
    if (d < bd && ok(t.x, t.y)) {
      bd = d;
      best = t;
    }
  };
  for (const v of g.units) {
    if (!active(v)) continue;
    const enemy = side === 'crew' ? v.kind === 'guard' && !v.deserting || v.kind === 'swat' : v.kind === 'crew' && !inBalloon(g, v);
    if (!enemy) continue;
    consider({ kind: 'unit', u: v, x: v.x, y: v.y });
  }
  if (best) return best;
  if (side === 'bank') {
    for (const t of g.turrets) consider({ kind: 'turret', id: t.id, x: t.x, y: t.y });
    // 屋上の気球は屋上にいる者しか撃てない（地上からは手すりと建物の陰）
    if (isRooftopAt(u.x, u.y)) {
      for (const b of g.bags) if (b.state === 'balloon') consider({ kind: 'balloon', bag: b, x: b.x, y: b.y - 0.8 });
      for (const cb of g.crewBalloons) {
        const v = unitById(g, cb.unit);
        if (v) consider({ kind: 'crewballoon', unit: cb.unit, x: v.x, y: v.y });
      }
    }
    if (g.van && (g.van.state === 'driving' || g.van.state === 'blocked')) consider({ kind: 'van', x: g.van.x, y: g.van.y });
    if (u.kind === 'swat') for (const b of g.barricades) if (dist(u.x, u.y, b.x, b.y) < 2.5) consider({ kind: 'barricade', id: b.id, x: b.x, y: b.y });
  } else if (g.van && g.van.state === 'blocked') {
    for (const r of g.roadblocks) {
      const p = roadblockPos(r.slot);
      consider({ kind: 'roadblock', id: r.id, x: p.x, y: p.y });
    }
  }
  return best;
}

function fire(g: Game, shooter: { x: number; y: number; moving: boolean }, w: Weapon, t: Target, side: Side, mods = 1, label = 'gunfire') {
  const d = dist(shooter.x, shooter.y, t.x, t.y);
  const targetMoving = t.kind === 'unit' && t.u.moving;
  let p = w.accuracy * (1 - 0.45 * (d / Math.max(1, w.range))) * (shooter.moving ? 0.75 : 1) * (targetMoving ? 0.9 : 1) * mods;
  if (t.kind !== 'unit') p = Math.max(p, 0.7);
  p = Math.min(0.95, Math.max(0.05, p));
  const hit = rand(g) < p;
  g.stats.shots++;
  const ex = hit ? t.x : t.x + (rand(g) - 0.5) * 1.6;
  const ey = hit ? t.y : t.y + (rand(g) - 0.5) * 1.6;
  g.fx.push({ type: 'tracer', x1: shooter.x, y1: shooter.y, x2: ex, y2: ey, t: 0.12, side, hit });
  if (!hit) return;
  const dmg = w.damage;
  tally(g, side, t.kind === 'unit' ? String(t.u.id) : t.kind, dmg);
  switch (t.kind) {
    case 'unit':
      damageUnit(g, t.u, dmg, false, label);
      break;
    case 'turret': {
      const k = g.turrets.find((x) => x.id === t.id);
      if (k && (k.hp -= dmg) <= 0) {
        g.turrets = g.turrets.filter((x) => x !== k);
        g.fx.push({ type: 'boom', x: k.x, y: k.y, t: 0.6, r: 1 });
        news(g, 'タレットを破壊', 'bank');
        news(g, 'タレットが破壊された', 'crew');
      }
      break;
    }
    case 'barricade': {
      const k = g.barricades.find((x) => x.id === t.id);
      if (k && (k.hp -= dmg) <= 0) g.barricades = g.barricades.filter((x) => x !== k);
      break;
    }
    case 'camera': {
      const k = g.cameras.find((x) => x.id === t.id);
      if (k && (k.hp -= dmg) <= 0) {
        k.destroyed = true;
        news(g, 'カメラが破壊された', 'bank');
      }
      break;
    }
    case 'roadblock': {
      // 封鎖は警察車両と鉄柵なので銃弾が通りにくい
      const k = g.roadblocks.find((x) => x.id === t.id);
      if (k && (k.hp -= dmg * CONFIG.roadblock.gunfireMul) <= 0) g.roadblocks = g.roadblocks.filter((x) => x !== k);
      break;
    }
    case 'van':
      if (g.van) g.van.hp -= dmg;
      break;
    case 'balloon':
      if ((t.bag.balloonHp -= dmg) <= 0) {
        t.bag.state = 'ground';
        t.bag.balloon = 0;
        news(g, 'フルトン気球を撃ち落とした', 'bank');
        news(g, '気球が撃ち抜かれた！ 金塊が落ちた', 'crew');
      }
      break;
    case 'crewballoon': {
      const cb = g.crewBalloons.find((b) => b.unit === t.unit);
      if (cb && (cb.hp -= dmg) <= 0) {
        g.crewBalloons = g.crewBalloons.filter((b) => b !== cb);
        news(g, '気球が撃ち抜かれた！', 'crew');
      }
      break;
    }
  }
}

function updateCombat(g: Game) {
  if (!isArmedPhase(g)) return;
  const frozen = policeFrozen(g);
  for (const u of g.units) {
    if (!active(u) || u.cooldown > 0 || u.stun > 0) continue;
    if (u.kind === 'crew') {
      if (u.action || inBalloon(g, u)) continue;
    } else if (u.kind === 'guard') {
      if (u.deserting || u.action) continue;
    } else if (u.kind === 'swat' || u.kind === 'sniper') {
      if (frozen || u.action) continue;
    } else continue;
    const t = chooseTarget(g, u);
    if (!t) continue;
    const w = weapon(u);
    u.cooldown = w.interval * (0.85 + 0.3 * rand(g));
    u.facing = Math.atan2(t.y - u.y, t.x - u.x);
    u.lastShot = g.time;
    const mods = u.kind === 'crew' && inGas(g, u.x, u.y) ? CONFIG.gas.accuracyMul : 1;
    fire(g, u, w, t, u.kind === 'crew' ? 'crew' : 'bank', mods, u.kind === 'crew' ? 'crew gunfire' : `${u.kind} gunfire`);
  }
  const T = CONFIG.fort.turret;
  for (const k of g.turrets) {
    k.cooldown -= 1 / CONFIG.tickRate;
    if (k.cooldown > 0) continue;
    let best: Unit | null = null;
    let bd = Infinity;
    for (const v of g.units) {
      if (!active(v) || (v.kind !== 'guard' && v.kind !== 'swat') || v.deserting) continue;
      const d = dist(k.x, k.y, v.x, v.y);
      if (d < bd && d <= T.range && los(g, k.x, k.y, v.x, v.y)) {
        bd = d;
        best = v;
      }
    }
    if (!best) continue;
    k.cooldown = T.fireInterval;
    k.facing = Math.atan2(best.y - k.y, best.x - k.x);
    fire(g, { x: k.x, y: k.y, moving: false }, { damage: T.damage, interval: T.fireInterval, range: T.range, accuracy: T.accuracy }, { kind: 'unit', u: best, x: best.x, y: best.y }, 'crew', 1, 'turret');
  }
}

// ---- 設置物・装置 ----
function explode(g: Game, x: number, y: number, r: number, dmg: number, stun: number, filter: (u: Unit) => boolean, label = 'explosion') {
  g.fx.push({ type: 'boom', x, y, t: 0.8, r });
  for (const u of g.units) {
    if (!active(u) || !filter(u)) continue;
    const d = dist(u.x, u.y, x, y);
    if (d > r) continue;
    u.stun = Math.max(u.stun, stun);
    damageUnit(g, u, dmg * (1 - (d / r) * 0.5), false, label);
  }
}

function updateObjects(g: Game, dt: number) {
  for (const c of g.cameras) c.loop = Math.max(0, c.loop - dt);

  // 金庫の突破
  const b = g.breach;
  if (b.installed && b.running && !b.open) {
    const base = CONFIG.breach[b.method].time;
    const time = base * (b.reinforced ? CONFIG.breach.reinforceMul : 1);
    b.progress += dt / time;
    if (b.method === 'drill') {
      b.nextJam -= dt;
      b.noiseTimer -= dt;
      if (b.noiseTimer <= 0) {
        b.noiseTimer = CONFIG.breach.drill.noiseEvery;
        alertBank(g, VAULT_DOOR.x, VAULT_DOOR.y, '金庫振動センサー反応');
      }
      if (b.nextJam <= 0 && b.progress < 1) {
        b.jammed = true;
        b.running = false;
        news(g, 'ドリルが止まった！ 金庫扉で再起動が必要', 'crew');
      }
    }
    if (g.tick % 6 === 0) g.fx.push({ type: 'spark', x: VAULT_DOOR.x + (rand(g) - 0.5) * 1.2, y: VAULT_DOOR.y + 0.4, t: 0.4 });
    if (b.progress >= 1) {
      if (b.method === 'charge') {
        explode(g, VAULT_DOOR.x, VAULT_DOOR.y, 2.2, 60, 2, () => true);
        blastAlarm(g);
      }
      openVault(g);
      if (g.phase !== 'casing') news(g, '金庫扉が破られた模様', 'bank');
    }
  }

  // 支店長室の小型ドリル
  const od = g.officeDrill;
  if (od.installed) {
    od.progress += dt / CONFIG.breach.officeDrill.time;
    od.noise -= dt;
    const door = officeDoor(g);
    const [tx, ty] = L.doorSlots[door.slot]!.tiles[0]!;
    if (od.noise <= 0) {
      od.noise = CONFIG.breach.officeDrill.noiseEvery;
      alertBank(g, tx + 0.5, ty + 0.5, '支店長室の扉から異音');
    }
    if (g.tick % 8 === 0) g.fx.push({ type: 'spark', x: tx + 0.5 + (rand(g) - 0.5) * 0.6, y: ty + 0.2, t: 0.4 });
    if (od.progress >= 1) {
      od.installed = false;
      door.destroyed = true;
      news(g, '支店長室が開いた！ デスク横のキーカードを奪え', 'crew', true);
      alertBank(g, tx + 0.5, ty + 0.5, '支店長室の扉が破られた');
    }
  }

  // 扉の爆薬
  for (const c of g.c4) c.t -= dt;
  for (const c of g.c4.filter((c) => c.t <= 0)) {
    const d = g.doors.find((d) => d.id === c.door);
    if (d) {
      d.destroyed = true;
      const [tx, ty] = L.doorSlots[d.slot]!.tiles[0]!;
      explode(g, tx + 0.5, ty + 0.5, 1.8, 40, 1.5, () => true);
      blastAlarm(g);
    }
  }
  g.c4 = g.c4.filter((c) => c.t > 0);

  // 警察の壁爆破
  for (const w of g.wallCharges) w.t -= dt;
  for (const w of g.wallCharges.filter((w) => w.t <= 0)) {
    for (const i of w.tiles) if (!g.holes.includes(i)) g.holes.push(i);
    const W2 = CONFIG.wallBreach;
    explode(g, w.x, w.y, W2.radius, W2.damage, W2.stun, (u) => u.kind !== 'swat', 'wall breach blast');
    news(g, '【中継】警察が壁を爆破 — 突入口を確保', 'all', true);
  }
  g.wallCharges = g.wallCharges.filter((w) => w.t > 0);

  // SWAT到着
  for (const p of g.pendingSwat) p.t -= dt;
  for (const p of g.pendingSwat.filter((p) => p.t <= 0)) {
    const u = makeUnit(g, 'swat', p.x, p.y);
    u.facing = p.y > 20 ? -Math.PI / 2 : Math.PI / 2;
    if (p.dest && setPath(g, u, p.dest.x, p.dest.y)) u.order = { type: 'move', x: p.dest.x, y: p.dest.y };
  }
  g.pendingSwat = g.pendingSwat.filter((p) => p.t > 0);

  updateVan(g, dt);
  updateFulton(g, dt);

  // 罠
  for (const t of g.traps) {
    if (!t.armed) continue;
    const victim = g.units.find((u) => active(u) && (u.kind === 'guard' || u.kind === 'swat') && dist(u.x, u.y, t.x, t.y) < 0.8);
    if (victim) {
      t.armed = false;
      const T = CONFIG.fort.trap;
      explode(g, t.x, t.y, T.radius, T.damage, T.stun, (u) => u.kind === 'guard' || u.kind === 'swat', 'trap');
      news(g, '罠が作動！', 'crew');
      news(g, '仕掛け爆弾が作動 — 隊員が負傷', 'bank');
    }
  }
  g.traps = g.traps.filter((t) => t.armed);

  // 催涙ガス
  for (const k of g.gases) {
    k.t -= dt;
    for (const u of g.units) if (u.kind === 'crew' && active(u) && dist(u.x, u.y, k.x, k.y) <= CONFIG.gas.radius) damageUnit(g, u, CONFIG.gas.dps * dt * (u.heavy ? CONFIG.heavy.gasMul : 1), true, 'tear gas');
  }
  g.gases = g.gases.filter((k) => k.t > 0);

  // 人感センサー
  for (const s of g.sensors) {
    s.cooldown -= dt;
    s.reveal -= dt;
    if (s.cooldown > 0) continue;
    const hit = g.units.find((u) => u.kind === 'crew' && active(u) && dist(u.x, u.y, s.x, s.y) <= CONFIG.vision.sensorRadius && los(g, s.x, s.y, u.x, u.y));
    if (hit) {
      s.reveal = CONFIG.vision.sensorReveal;
      s.cooldown = 6;
      alertBank(g, s.x, s.y, `人感センサー反応：${roomNameAt(s.x, s.y)}`);
    }
  }

  for (const a of g.alerts) a.t -= dt;
  g.alerts = g.alerts.filter((a) => a.t > 0);
}

function updateVan(g: Game, dt: number) {
  const v = g.van;
  if (!v || (v.state !== 'driving' && v.state !== 'blocked')) return;
  const V = CONFIG.escape.van;
  const front = v.x + v.dir * 1.4;
  let blocker = null;
  for (const r of g.roadblocks) {
    const s = L.roadblocks.find((s) => s.id === r.slot)!;
    if (s.road !== 'alley') continue;
    const bx = s.x + 0.5;
    if ((v.dir > 0 && bx > v.x && front >= bx - 0.6) || (v.dir < 0 && bx < v.x && front <= bx + 0.6)) blocker = r;
  }
  if (blocker) {
    v.state = 'blocked';
    blocker.hp -= V.ramDps * dt;
    if (blocker.hp <= 0) {
      g.roadblocks = g.roadblocks.filter((r) => r !== blocker);
      news(g, 'バンが封鎖を突破！', 'all');
    }
  } else {
    v.state = 'driving';
    v.x += v.dir * V.speed * dt;
  }
  for (const id of v.crew) {
    const u = unitById(g, id);
    if (u) {
      u.x = v.x;
      u.y = v.y;
    }
  }
  if (v.hp <= 0) {
    v.state = 'wrecked';
    g.fx.push({ type: 'boom', x: v.x, y: v.y, t: 1.2, r: 2.5 });
    for (const id of v.crew) {
      const u = unitById(g, id);
      if (u) {
        u.role = '';
        killUnit(g, u);
      }
    }
    for (const b of g.bags) if (b.state === 'van') b.state = 'lost';
    news(g, '【中継】逃走車両が大破 — 乗っていた強盗団を制圧', 'all', true);
    return;
  }
  if (v.x < -2 || v.x > W + 2) {
    v.state = 'gone';
    for (const id of v.crew) {
      const u = unitById(g, id);
      if (u) u.escaped = true;
    }
    endGame(g, 'crew', `強盗団、金塊${v.bags}袋（${money(v.bags)}）を積んだバンで逃走`);
  }
}

function money(bags: number) {
  return '$' + (bags * CONFIG.gold.bagValue).toLocaleString('en-US');
}

// フルトン回収機：呼ばれたときだけ来て、屋上（ヘリポート）上空を通過する瞬間に膨らんだ気球を引っかけていく
function updateFulton(g: Game, dt: number) {
  if (g.plan.escape !== 'fulton') return;
  const F = CONFIG.escape.fulton;
  const p = g.plane;
  p.pass = Math.max(0, p.pass - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  for (const b of g.bags) if (b.state === 'balloon') b.balloon = Math.max(0, b.balloon - dt);
  for (const cb of g.crewBalloons) cb.t = Math.max(0, cb.t - dt);
  if (p.eta < 0) return;
  const before = p.eta;
  p.eta -= dt;
  if (before > F.warnAt && p.eta <= F.warnAt) news(g, '低空を飛ぶ小型機がホテルの方角へ向かっている', 'bank');
  if (p.eta > 0) return;
  p.eta = -1;
  p.pass = 2.5;
  p.cooldown = F.callCooldown;
  let snagged = 0;
  for (const b of g.bags) {
    if (b.state === 'balloon' && b.balloon <= 0) {
      b.state = 'secured';
      snagged++;
    }
  }
  // 気球を付けたクルーは抱えている袋ごと吊り上げられる
  const people = g.crewBalloons.filter((c) => c.t <= 0);
  let lifted = 0;
  for (const cb of people) {
    const u = unitById(g, cb.unit);
    g.crewBalloons = g.crewBalloons.filter((c) => c !== cb);
    if (!u || !u.alive) continue;
    u.escaped = true;
    lifted++;
    const bag = g.bags.find((b) => b.id === u.carrying);
    if (bag) {
      bag.state = 'secured';
      bag.carrier = -1;
      u.carrying = -1;
      snagged++;
    }
  }
  if (snagged) {
    news(g, `回収機が金塊を回収 ${securedBags(g)}/${CONFIG.gold.quotaBags}袋`, 'crew');
    news(g, 'ホテル屋上から何かが吊り上げられていった', 'bank');
  } else if (!lifted) news(g, '回収機が通過 — 膨らんだ気球がなかった', 'crew');
  if (lifted && securedBags(g) >= CONFIG.gold.quotaBags) endGame(g, 'crew', `強盗団、回収機で空へ逃走 — 金塊${securedBags(g)}袋（${money(securedBags(g))}）が消えた`);
}

// ---- 観察（長押し） ----
function updateObserve(g: Game, dt: number) {
  const o = g.observe;
  o.cooldown = Math.max(0, o.cooldown - dt);
  o.resultT = Math.max(0, o.resultT - dt);
  const C = CONFIG.observe;
  if (g.phase !== 'casing' || !o.holding || o.target < 0 || o.cooldown > 0) {
    o.progress = 0;
    o.suspicious = 0;
    return;
  }
  const t = unitById(g, o.target);
  if (!t || !t.alive || !g.vis.bank.units.has(t.id)) {
    o.progress = 0;
    o.suspicious = 0;
    o.holding = false;
    o.result = 'lost';
    o.resultT = 2;
    return;
  }
  o.progress += dt;
  if (t.kind === 'crew' && t.suspicious) o.suspicious += dt;
  if (o.progress >= C.duration) {
    const ok = o.suspicious >= C.requiredSuspicious;
    o.progress = 0;
    o.suspicious = 0;
    o.holding = false;
    o.resultT = 2.5;
    if (ok) {
      o.result = 'ok';
      callPolice(g, '支店長が不審な行動を確認し通報');
    } else {
      o.result = 'fail';
      o.cooldown = C.failCooldown;
      news(g, '異常なし — ただのお客様のようだ', 'bank');
    }
  }
}

function checkWin(g: Game) {
  if (g.phase === 'ended' || g.crewHired === 0) return;
  const alive = g.units.some((u) => u.kind === 'crew' && u.alive && !u.escaped);
  if (!alive) endGame(g, 'bank', '強盗団 全員制圧 — 金庫の金塊は守られた');
}

function cleanup(g: Game) {
  if (g.tick % 30 !== 0) return;
  g.units = g.units.filter((u) => !(u.brain?.state === 'gone') && !(u.kind === 'sniper' && u.escaped));
  const blood = g.fx.filter((f) => f.type === 'blood');
  if (blood.length > 80) {
    const drop = new Set<Fx>(blood.slice(0, blood.length - 80));
    g.fx = g.fx.filter((f) => !drop.has(f));
  }
}

function updateFx(g: Game, dt: number) {
  for (const f of g.fx) f.t -= dt;
  g.fx = g.fx.filter((f) => f.t > 0);
}

