import { CONFIG } from '../config';
import { Mat, Zone, idx } from '../map/level';
import { findPath } from './path';
import type { ActionKind, Game, Side, Unit } from './types';
import { L, active, alertBank, dist, fultonCommitted, isOutdoorAt, isPrivateAt, isRooftopAt, moverClass, news, passable, rand, randRange, roomNameAt, unitById } from './world';

export const VAULT_DOOR = { x: 40, y: 13.5 };

export function endGame(g: Game, winner: Side, reason: string): void {
  if (g.phase === 'ended') return;
  g.winner = winner;
  g.endReason = reason;
  g.phase = 'ended';
  news(g, reason, 'all', true);
}

// 通報 → 警察到着待ちフェーズへ
export function callPolice(g: Game, reason: string): void {
  if (g.phase !== 'casing') return;
  g.phase = 'response';
  g.phaseTime = 0;
  g.loudReason = reason;
  g.observe.target = -1;
  g.observe.holding = false;
  g.observe.progress = 0;
  for (const c of g.cameras) c.loop = 0;
  for (const u of g.units) {
    if (!u.alive) continue;
    if (u.kind === 'crew') u.masked = true;
    if (u.kind === 'guard' && u.bribed) {
      u.deserting = true;
      u.order = null;
      u.action = null;
      const exit = nearest(u, [...L.publicExits, ...L.staffExits]);
      setPath(g, u, exit.x, exit.y + (exit.y > 30 ? 2 : -1.5));
    }
    if (u.kind === 'manager' && u.brain) {
      u.brain.state = 'cower';
      u.path = [];
    } else if ((u.kind === 'civilian' || u.kind === 'staff') && u.brain && u.brain.state !== 'gone') {
      const outside = isOutdoorAt(u.x, u.y);
      if (!outside && rand(g) < CONFIG.civilians.cowerChance) {
        u.brain.state = 'cower';
        u.path = [];
      } else {
        u.brain.state = 'flee';
        u.brain.timer = 0;
        u.path = [];
      }
    }
  }
  news(g, `【速報】ハーバーライト銀行 中央支店で強盗事件 — ${reason}`, 'all', true);
  news(g, `警察に通報が入りました。到着まで約${CONFIG.phase.responseSeconds}秒`, 'all');
}

// 爆発音。偵察中なら通報され、警察到着待ちの間なら警察の到着が早まる
export function blastAlarm(g: Game): void {
  if (g.phase === 'casing') {
    callPolice(g, '銀行内で爆発音');
    return;
  }
  if (g.phase !== 'response') return;
  const left = CONFIG.phase.responseSeconds - g.phaseTime;
  if (left > CONFIG.phase.blastResponse) {
    g.phaseTime = CONFIG.phase.responseSeconds - CONFIG.phase.blastResponse;
    news(g, '銀行内で爆発 — 警察が到着を急ぐ', 'all', true);
  }
}

export function startAssault(g: Game): void {
  g.phase = 'assault';
  g.phaseTime = 0;
  g.cp = CONFIG.police.cpStart;
  news(g, '【中継】警察特殊部隊が現場に到着 突入を開始', 'all', true);
  news(g, '指揮権が警察に移りました。SWAT・狙撃手・道路封鎖を展開できます', 'bank');
}

export function nearest<T extends { x: number; y: number }>(u: { x: number; y: number }, pts: T[]): T {
  let best = pts[0]!;
  let bd = Infinity;
  for (const p of pts) {
    const d = dist(u.x, u.y, p.x, p.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

export function setPath(g: Game, u: Unit, x: number, y: number): boolean {
  const p = findPath(g, moverClass(u.kind), u.x, u.y, x, y);
  if (!p) {
    u.path = [];
    return false;
  }
  u.path = p;
  u.near = 1e9;
  return true;
}

export function speedOf(g: Game, u: Unit): number {
  const M = CONFIG.move;
  let s: number;
  switch (u.kind) {
    case 'civilian':
    case 'staff':
    case 'manager': // 支店長も人質から解放されれば逃げる（以前は速さ0で、解放後も動けなかった）
      s = u.brain?.state === 'flee' ? 3.1 : u.walk;
      break;
    case 'crew':
      s = g.phase === 'casing' && !u.masked ? M.crewWalk : M.run;
      if (u.heavy) s *= CONFIG.heavy.speedMul;
      if (u.carrying >= 0) s *= M.carryMul;
      if (inGas(g, u.x, u.y)) s *= CONFIG.gas.slow;
      break;
    case 'guard':
      s = g.phase === 'casing' ? M.guardWalk : M.guardRun;
      break;
    case 'swat':
      s = M.swat;
      break;
    default:
      s = 0;
  }
  return s;
}

export function inGas(g: Game, x: number, y: number): boolean {
  for (const k of g.gases) if (dist(k.x, k.y, x, y) <= CONFIG.gas.radius) return true;
  return false;
}

export function policeFrozen(g: Game): boolean {
  return g.negotiation.freeze > 0;
}

// ---- 被弾・死亡 ----
// 与えた被害の集計（エージェント向けの手応え表示）。銃撃は fire() 側で数える
export function tally(g: Game, side: Side, key: string, dmg: number): void {
  const t = g.dealt[side];
  t[key] = (t[key] ?? 0) + dmg;
}

export function damageUnit(g: Game, u: Unit, dmg: number, armorPierce = false, source = 'unknown'): void {
  if (!u.alive) return;
  u.hurt[source] = (u.hurt[source] ?? 0) + dmg;
  if (!source.includes('gunfire') && source !== 'turret') {
    const by: Side = source === 'tear gas' || source === 'wall breach blast' ? 'bank' : 'crew';
    if (source !== 'unknown') tally(g, by, String(u.id), dmg);
  }
  let d = dmg;
  if (!armorPierce && u.armor > 0) {
    const absorbed = Math.min(u.armor, d * 0.7);
    u.armor -= absorbed;
    d -= absorbed;
  }
  u.hp -= d;
  if (u.hp <= 0) killUnit(g, u);
}

export function killUnit(g: Game, u: Unit): void {
  u.alive = false;
  u.hp = 0;
  u.action = null;
  u.order = null;
  u.path = [];
  if (u.carrying >= 0) {
    const b = g.bags.find((b) => b.id === u.carrying);
    if (b) {
      b.state = 'ground';
      b.carrier = -1;
      b.x = u.x;
      b.y = u.y;
    }
    u.carrying = -1;
  }
  if (u.hasTool) {
    g.bags.push({ id: g.nextId++, x: u.x, y: u.y, state: 'ground', carrier: -1, balloon: 0, balloonHp: 0, kind: 'tool' });
    u.hasTool = false;
  }
  g.crewBalloons = g.crewBalloons.filter((b) => b.unit !== u.id);
  g.fx.push({ type: 'blood', x: u.x, y: u.y, t: 9999, r: 0.45 + rand(g) * 0.2 });
  if (u.kind === 'crew') {
    g.stats.crewKilled++;
    news(g, `強盗団の1人（${u.callsign}）を制圧`, 'bank');
    news(g, `${u.callsign} がやられた`, 'crew');
  } else if (u.kind === 'guard') {
    g.stats.guardsKilled++;
    news(g, '警備員が撃たれた', 'bank');
  } else if (u.kind === 'swat') {
    g.stats.policeKilled++;
    news(g, 'SWAT隊員が負傷し戦線離脱', 'bank');
  }
}

// ---- 行動 ----
export interface ActTarget {
  x: number;
  y: number;
  reach: number;
  approach: { x: number; y: number };
}

export function doorTiles(slot: number): [number, number][] {
  return L.doorSlots[slot]!.tiles;
}

export function actionTarget(g: Game, u: Unit, kind: ActionKind, target: number): ActTarget | null {
  const self = { x: u.x, y: u.y, reach: Infinity, approach: { x: u.x, y: u.y } };
  switch (kind) {
    case 'tamper': {
      const c = g.cameras.find((c) => c.id === target);
      return c ? { x: c.x, y: c.y, reach: 1.5, approach: { x: c.x, y: c.y } } : null;
    }
    case 'bribe':
    case 'hostage': {
      const t = unitById(g, target);
      return t && t.alive ? { x: t.x, y: t.y, reach: 1.5, approach: { x: t.x, y: t.y } } : null;
    }
    case 'lockpick':
    case 'c4':
    case 'repair': {
      const d = g.doors.find((d) => d.id === target);
      if (!d) return null;
      const tiles = doorTiles(d.slot);
      let best = tiles[0]!;
      let bd = Infinity;
      for (const t of tiles) {
        const dd = dist(u.x, u.y, t[0] + 0.5, t[1] + 0.5);
        if (dd < bd) {
          bd = dd;
          best = t;
        }
      }
      const cx = best[0] + 0.5;
      const cy = best[1] + 0.5;
      // 扉の手前（ユニットのいる側）に立つ
      const slot = L.doorSlots[d.slot]!;
      const ax = slot.vertical ? cx + (u.x < cx ? -1 : 1) : cx;
      const ay = slot.vertical ? cy : cy + (u.y < cy ? -1 : 1);
      return { x: cx, y: cy, reach: 1.55, approach: { x: ax, y: ay } };
    }
    case 'officedrill':
      return officeDoorTarget(g, u);
    case 'sabotage':
      if (target === officeDoor(g).id) return officeDoorTarget(g, u);
      return { x: VAULT_DOOR.x, y: VAULT_DOOR.y, reach: 1.8, approach: L.vaultFront };
    case 'install':
    case 'fix':
    case 'keycard':
      return { x: VAULT_DOOR.x, y: VAULT_DOOR.y, reach: 1.8, approach: L.vaultFront };
    case 'wallbreach': {
      const tx = target % L.w;
      const ty = Math.floor(target / L.w);
      const ap = wallApproach(g, u, tx, ty);
      return ap ? { x: tx + 0.5, y: ty + 0.5, reach: 1.6, approach: ap } : null;
    }
    case 'pickup': {
      const b = g.bags.find((b) => b.id === target);
      return b ? { x: b.x, y: b.y, reach: 1.1, approach: { x: b.x, y: b.y } } : null;
    }
    case 'deposit': {
      const v = g.van;
      return v ? { x: v.x, y: v.y, reach: CONFIG.escape.van.loadRadius, approach: { x: v.x, y: v.y + 1.8 } } : null;
    }
    case 'fulton':
    case 'extract':
    case 'equip':
    case 'medkit':
      return self;
  }
}

export function officeDoor(g: Game) {
  const slot = L.doorSlots.findIndex((s) => s.kind === 'office');
  return g.doors[slot]!;
}

function officeDoorTarget(g: Game, u: Unit): ActTarget {
  const d = officeDoor(g);
  const [tx, ty] = L.doorSlots[d.slot]!.tiles[0]!;
  return { x: tx + 0.5, y: ty + 0.5, reach: 1.55, approach: { x: tx + 0.5, y: ty + (u.y < ty + 0.5 ? -0.5 : 1.5) } };
}

// 爆破できる壁（銀行の外壁・内壁・窓。金庫扉と隣のビルは不可）
export function breachableWall(g: Game, tx: number, ty: number): boolean {
  if (tx < 12 || tx > 71 || ty < 7 || ty > 39) return false;
  const i = idx(tx, ty);
  if (L.vaultAt[i] || L.doorAt[i]! >= 0) return false;
  if (g.holes.includes(i)) return false;
  if (L.mat[i] !== Mat.Wall && L.mat[i] !== Mat.Glass) return false;
  // 金庫の壁は抜けない
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const j = idx(tx + dx, ty + dy);
    if (L.zone[j] === Zone.Vault) return false;
  }
  return !L.furniture.some((f) => tx >= f.x && ty >= f.y && tx < f.x + f.w && ty < f.y + f.h);
}

function wallApproach(g: Game, u: Unit, tx: number, ty: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (!passable(g, 'bank', tx + dx, ty + dy)) continue;
    const p = { x: tx + dx + 0.5, y: ty + dy + 0.5 };
    const d = dist(u.x, u.y, p.x, p.y);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

// 壁の向きに沿って2タイル幅の穴を開ける
export function wallHoleTiles(g: Game, tx: number, ty: number): number[] {
  const out = [idx(tx, ty)];
  const horiz = breachableWall(g, tx - 1, ty) || breachableWall(g, tx + 1, ty);
  const cands = horiz ? [[tx + 1, ty], [tx - 1, ty]] : [[tx, ty + 1], [tx, ty - 1]];
  for (const [x, y] of cands) {
    if (breachableWall(g, x!, y!)) {
      out.push(idx(x!, y!));
      break;
    }
  }
  return out;
}

export function actionDuration(g: Game, u: Unit, kind: ActionKind, target: number): number {
  const A = CONFIG.actions;
  const fast = u.masked ? A.maskedSpeedMul : 1;
  switch (kind) {
    case 'tamper':
      return A.tamper.time * fast;
    case 'bribe':
      return A.bribe.time;
    case 'lockpick': {
      const d = g.doors.find((d) => d.id === target);
      return (d?.security ? A.lockpick.securityTime : A.lockpick.time) * fast;
    }
    case 'c4':
      return A.c4.time;
    case 'install':
      return CONFIG.breach.installTime * fast;
    case 'fix':
      return CONFIG.breach.fixTime * fast;
    case 'sabotage':
      return CONFIG.breach.sabotageTime;
    case 'pickup':
      return A.pickup;
    case 'officedrill':
      return CONFIG.breach.installTime * fast;
    case 'keycard':
      return CONFIG.breach.keycardTime;
    case 'wallbreach':
      return CONFIG.wallBreach.plantTime;
    case 'deposit':
      return A.deposit;
    case 'hostage':
      return A.hostage.time;
    case 'fulton':
    case 'extract':
      return CONFIG.escape.fulton.attachTime;
    case 'repair':
      return A.repairDoor;
    case 'equip':
      return CONFIG.heavy.equipTime;
    case 'medkit':
      return CONFIG.medkit.time;
  }
}

// 行動を始められるか（できなければ理由を返す）
export function validateAction(g: Game, u: Unit, kind: ActionKind, target: number): string | null {
  if (!active(u)) return '行動できません';
  const crewOnly = ['tamper', 'bribe', 'lockpick', 'c4', 'install', 'fix', 'pickup', 'deposit', 'hostage', 'fulton', 'extract', 'equip', 'medkit', 'officedrill', 'keycard'];
  if (crewOnly.includes(kind) && u.kind !== 'crew') return 'クルーのみ実行できます';
  const A = CONFIG.actions;
  switch (kind) {
    case 'tamper': {
      if (g.phase !== 'casing') return '警報後はループ映像が無効です（撃って壊せます）';
      const c = g.cameras.find((c) => c.id === target);
      if (!c || c.destroyed) return 'カメラがありません';
      if (c.loop > 0) return 'すでにループ映像中です';
      if (g.funds.crew < A.tamper.cost) return '資金が足りません';
      return null;
    }
    case 'bribe': {
      if (g.phase !== 'casing') return '警報後は買収できません';
      if (u.masked) return '覆面のままでは買収できません';
      const t = unitById(g, target);
      if (!t || t.kind !== 'guard' || !t.alive) return '警備員を選んでください';
      if (t.bribed) return '買収済みです';
      if (g.funds.crew < A.bribe.cost) return '資金が足りません';
      return null;
    }
    case 'lockpick': {
      const d = g.doors.find((d) => d.id === target);
      if (!d || !d.locked || d.jammed || d.destroyed) return '施錠された扉ではありません';
      if (L.doorSlots[d.slot]!.kind === 'office') return 'カード錠はピッキングできません（小型ドリルか爆薬で）';
      return null;
    }
    case 'officedrill': {
      const d = g.doors.find((d) => d.id === target);
      if (!d || L.doorSlots[d.slot]!.kind !== 'office') return '支店長室の扉を選んでください';
      if (d.destroyed || d.jammed) return 'すでに開いています';
      if (g.officeDrill.installed) return 'すでにドリルを設置済みです';
      if (g.stock.drill <= 0) return '小型ドリルの在庫がありません（ショップで購入）';
      return null;
    }
    case 'keycard':
      if (!u.hasKey) return 'キーカードを持っていません';
      if (g.breach.open) return '金庫はすでに開いています';
      return null;
    case 'wallbreach': {
      if (u.kind !== 'swat') return 'SWATのみ壁を爆破できます';
      if (g.phase !== 'assault') return '突入フェーズのみ';
      if (!breachableWall(g, target % L.w, Math.floor(target / L.w))) return 'その壁は爆破できません';
      if (g.cp < CONFIG.wallBreach.cost) return '指揮ポイントが足りません';
      return null;
    }
    case 'c4': {
      const d = g.doors.find((d) => d.id === target);
      if (!d || d.destroyed || (!d.locked && !d.security)) return '施錠された扉ではありません';
      if (d.jammed && !d.security) return 'すでに開いています';
      if (L.doorSlots[d.slot]!.kind === 'office') return '支店長室の扉は補強されていて爆薬では開きません（小型ドリルで）';
      if (g.funds.crew < A.c4.cost) return '資金が足りません';
      return null;
    }
    case 'install':
      if (!u.hasTool) return '金庫突破ツールを持っていません';
      if (g.breach.installed || g.breach.open) return 'すでに設置済みです';
      return null;
    case 'fix':
      if (!g.breach.installed || !g.breach.jammed) return '修理の必要はありません';
      return null;
    case 'sabotage':
      if (u.kind !== 'guard' && u.kind !== 'swat') return '警備員・SWATのみ実行できます';
      if (target === officeDoor(g).id) return g.officeDrill.installed ? null : '支店長室にドリルはありません';
      if (!g.breach.installed || g.breach.open) return '金庫に装置はありません';
      if (g.breach.method === 'thermal') return 'サーマルペーストは止められません';
      if (g.breach.method === 'drill' && g.breach.jammed) return 'ドリルは止まっています';
      return null;
    case 'pickup': {
      const b = g.bags.find((b) => b.id === target);
      if (!b) return '対象がありません';
      if (b.kind === 'tool') return u.hasTool ? 'すでにツールを持っています' : null;
      if (b.kind === 'keycard') return null;
      if (u.carrying >= 0) return 'すでに袋を運んでいます';
      if (b.state === 'vault' && !g.breach.open) return '金庫が開いていません';
      if (b.state !== 'vault' && b.state !== 'ground') return '拾えません';
      return null;
    }
    case 'deposit':
      if (!g.van || g.van.state !== 'parked') return 'バンがありません';
      if (u.carrying < 0) return '金塊を運んでいません';
      return null;
    case 'hostage': {
      if (g.phase === 'casing') return '人質は警報後から取れます';
      const t = unitById(g, target);
      if (!t || !t.alive || (t.kind !== 'civilian' && t.kind !== 'staff' && t.kind !== 'manager')) return '民間人を選んでください';
      if (t.brain?.state === 'hostage' || t.brain?.state === 'gone') return '人質にできません';
      return null;
    }
    case 'fulton':
      if (g.plan.escape !== 'fulton') return 'フルトン回収を計画していません';
      if (u.carrying < 0) return '金塊を運んでいません';
      if (!isRooftopAt(u.x, u.y)) return 'ホテル屋上でのみ使えます（西の路地の非常階段から上がる）';
      return null;
    case 'extract':
      if (g.plan.escape !== 'fulton') return 'フルトン回収を計画していません';
      if (!isRooftopAt(u.x, u.y)) return 'ホテル屋上でのみ使えます（西の路地の非常階段から上がる）';
      // 抱えている袋ごと回収される。次の通過で目標に届くなら脱出できる
      if (fultonCommitted(g) + (u.carrying >= 0 ? 1 : 0) < CONFIG.gold.quotaBags) return `回収済み・回収待ちの金塊が${CONFIG.gold.quotaBags}袋に届きません`;
      return null;
    case 'repair': {
      if (u.kind !== 'guard') return '警備員のみ修理できます';
      const d = g.doors.find((d) => d.id === target);
      if (!d || !d.jammed || d.destroyed) return '修理が必要な扉ではありません';
      return null;
    }
    case 'equip':
      if (u.heavy) return 'すでに重武装です';
      if (g.funds.crew < CONFIG.heavy.cost) return '資金が足りません';
      return null;
    case 'medkit':
      if (u.hp >= u.maxHp) return '負傷していません';
      if (g.funds.crew < CONFIG.medkit.cost) return '資金が足りません';
      return null;
  }
}

export function completeAction(g: Game, u: Unit, kind: ActionKind, target: number): void {
  const err = validateAction(g, u, kind, target);
  if (err) {
    if (u.kind === 'crew') news(g, `${u.callsign}: ${err}`, 'crew');
    return;
  }
  const A = CONFIG.actions;
  switch (kind) {
    case 'tamper': {
      const c = g.cameras.find((c) => c.id === target)!;
      c.loop = A.tamper.loop;
      g.funds.crew -= A.tamper.cost;
      news(g, `${u.callsign}: カメラにループ映像を仕込んだ（${A.tamper.loop}秒）`, 'crew');
      break;
    }
    case 'bribe': {
      const t = unitById(g, target)!;
      t.bribed = true;
      g.funds.crew -= A.bribe.cost;
      news(g, `${u.callsign}: 警備員を買収した。こちらを見逃し、警報で持ち場を離れる`, 'crew');
      break;
    }
    case 'lockpick': {
      const d = g.doors.find((d) => d.id === target)!;
      d.jammed = true;
      const s = L.doorSlots[d.slot]!;
      const [tx, ty] = s.tiles[0]!;
      alertBank(g, tx + 0.5, ty + 0.5, `扉センサー異常：${s.name}`);
      news(g, `${u.callsign}: ${s.name}をこじ開けた`, 'crew');
      break;
    }
    case 'c4': {
      const d = g.doors.find((d) => d.id === target)!;
      g.funds.crew -= A.c4.cost;
      g.c4.push({ door: d.id, t: A.c4.fuse });
      news(g, `${u.callsign}: 爆薬を設置。離れろ！`, 'crew');
      break;
    }
    case 'install': {
      const b = g.breach;
      b.installed = true;
      b.running = true;
      b.jammed = false;
      b.nextJam = randRange(g, CONFIG.breach.drill.jamEvery[0], CONFIG.breach.drill.jamEvery[1]);
      b.noiseTimer = 1;
      u.hasTool = false;
      u.look.bag = 'none';
      const name = b.method === 'drill' ? 'ドリル' : b.method === 'thermal' ? 'サーマルペースト' : '指向性爆薬';
      news(g, `${u.callsign}: 金庫扉に${name}を設置した`, 'crew');
      if (b.method === 'thermal') g.fx.push({ type: 'spark', x: VAULT_DOOR.x, y: VAULT_DOOR.y, t: 1 });
      break;
    }
    case 'fix':
      g.breach.jammed = false;
      g.breach.running = true;
      g.breach.nextJam = randRange(g, CONFIG.breach.drill.jamEvery[0], CONFIG.breach.drill.jamEvery[1]);
      news(g, `${u.callsign}: ドリルを再起動`, 'crew');
      break;
    case 'sabotage': {
      const b = g.breach;
      if (target === officeDoor(g).id) {
        g.officeDrill.installed = false;
        g.officeDrill.progress = 0;
        news(g, '支店長室のドリルを撤去した', 'bank');
        news(g, '支店長室のドリルが撤去された！', 'crew');
      } else if (b.method === 'drill') {
        b.jammed = true;
        b.running = false;
        news(g, '金庫のドリルを停止させた', 'bank');
        news(g, 'ドリルが止められた！', 'crew');
      } else {
        b.installed = false;
        b.running = false;
        b.progress = 0;
        g.bags.push({ id: g.nextId++, x: L.vaultFront.x, y: L.vaultFront.y, state: 'ground', carrier: -1, balloon: 0, balloonHp: 0, kind: 'tool' });
        news(g, '金庫の爆薬を解除した', 'bank');
        news(g, '爆薬が解除された！ ツールを拾って再設置しろ', 'crew');
      }
      break;
    }
    case 'pickup': {
      const b = g.bags.find((b) => b.id === target)!;
      if (b.kind === 'tool') {
        b.state = 'lost';
        u.hasTool = true;
        u.look.bag = 'gym';
        news(g, `${u.callsign}: 金庫突破ツールを拾った`, 'crew');
      } else if (b.kind === 'keycard') {
        b.state = 'lost';
        u.hasKey = true;
        news(g, `${u.callsign}: 支店長のキーカードを手に入れた。金庫扉で使える`, 'crew');
      } else {
        b.state = 'carried';
        b.carrier = u.id;
        u.carrying = b.id;
      }
      break;
    }
    case 'deposit': {
      const b = g.bags.find((b) => b.id === u.carrying);
      if (b) {
        b.state = 'van';
        b.carrier = -1;
        g.van!.bags++;
      }
      u.carrying = -1;
      news(g, `バンに積み込み ${g.van!.bags}/${CONFIG.gold.quotaBags}袋`, 'crew');
      break;
    }
    case 'hostage': {
      const t = unitById(g, target)!;
      t.brain!.state = 'hostage';
      t.path = [];
      t.order = null;
      g.stats.hostagesTaken++;
      news(g, `人質 ${hostageCount(g)}名 — 強盗団が民間人を拘束`, 'all');
      break;
    }
    case 'fulton': {
      const b = g.bags.find((b) => b.id === u.carrying);
      if (b) {
        b.state = 'balloon';
        b.carrier = -1;
        b.x = u.x;
        b.y = u.y;
        b.balloon = CONFIG.escape.fulton.inflateTime;
        b.balloonHp = CONFIG.escape.fulton.balloonHp;
      }
      u.carrying = -1;
      news(g, `${u.callsign}: フルトン気球を展開。回収機を呼べば次の通過で回収`, 'crew');
      break;
    }
    case 'extract':
      g.crewBalloons.push({ unit: u.id, t: CONFIG.escape.fulton.inflateTime, hp: CONFIG.escape.fulton.balloonHp });
      u.path = [];
      u.order = null;
      news(g, `${u.callsign}: 自分に気球を付けた。回収機を待つ`, 'crew');
      break;
    case 'repair': {
      const d = g.doors.find((d) => d.id === target)!;
      d.jammed = false;
      d.alerted = false;
      news(g, `${L.doorSlots[d.slot]!.name}を修理・再施錠`, 'bank');
      break;
    }
    case 'equip':
      g.funds.crew -= CONFIG.heavy.cost;
      u.heavy = true;
      u.maxArmor += CONFIG.heavy.armor;
      u.armor += CONFIG.heavy.armor;
      news(g, `${u.callsign}: 重武装を装着`, 'crew');
      break;
    case 'medkit':
      g.funds.crew -= CONFIG.medkit.cost;
      u.hp = Math.min(u.maxHp, u.hp + CONFIG.medkit.heal);
      break;
    case 'officedrill':
      g.stock.drill--;
      g.officeDrill.installed = true;
      g.officeDrill.progress = 0;
      g.officeDrill.noise = 1;
      news(g, `${u.callsign}: 支店長室の扉に小型ドリルを設置`, 'crew');
      break;
    case 'keycard':
      u.hasKey = false;
      openVault(g);
      alertBank(g, VAULT_DOOR.x, VAULT_DOOR.y, '金庫扉の認証ログ：支店長カードで解錠');
      news(g, `${u.callsign}: キーカードで金庫を開けた！`, 'crew');
      break;
    case 'wallbreach': {
      const tx = target % L.w;
      const ty = Math.floor(target / L.w);
      g.cp -= CONFIG.wallBreach.cost;
      g.wallCharges.push({ x: tx + 0.5, y: ty + 0.5, t: CONFIG.wallBreach.fuse, tiles: wallHoleTiles(g, tx, ty) });
      news(g, '壁に破壊用爆薬を設置', 'bank');
      break;
    }
  }
}

export function openVault(g: Game): void {
  const b = g.breach;
  if (b.open) return;
  b.open = true;
  b.running = false;
  b.progress = 1;
  news(g, '金庫が開いた！ 金塊を運び出せ', 'crew', true);
}

export function hostageCount(g: Game): number {
  return g.units.filter((u) => u.alive && u.brain?.state === 'hostage').length;
}

// 偵察中、今まさに不審行動をしているか（真の状態）
export function crewSuspicious(g: Game, u: Unit): boolean {
  if (u.kind !== 'crew') return false;
  return !!u.action || u.carrying >= 0 || u.masked || u.heavy || isPrivateAt(u.x, u.y) || g.crewBalloons.some((b) => b.unit === u.id);
}

// 見えている事実だけで即通報できるか（覆面・重武装・立入禁止区域）
// 関係者エリアは、続けて privateGrace 秒見られて初めて通報できる（横切る一瞬は見逃しうる）
export function instantlyReportable(u: Unit): boolean {
  if (!u.alive || (u.kind !== 'crew' && u.kind !== 'civilian')) return false;
  return u.masked || u.heavy || (isPrivateAt(u.x, u.y) && u.privateSeen >= CONFIG.observe.privateGrace);
}

export function doorAtTile(g: Game, tx: number, ty: number) {
  const s = L.doorAt[idx(tx, ty)]!;
  return s >= 0 ? g.doors[s]! : null;
}

export function roomOf(u: { x: number; y: number }): string {
  return roomNameAt(u.x, u.y);
}
