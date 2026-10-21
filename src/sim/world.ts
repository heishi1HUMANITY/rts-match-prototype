import { CONFIG } from '../config';
import { H, LEVEL as L, Mat, W, Zone, idx, inBounds } from '../map/level';
import type { Game, Kind, Look, NewsEvent, Side, Unit } from './types';

// 試合ごとに差し替わる支店レイアウト（useLayout）。再エクスポートなので常に現在のものを指す
export { LEVEL as L } from '../map/level';

// ---- 乱数（状態に保持して再現可能にする） ----
export function rand(g: Game): number {
  let t = (g.rng = (g.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randRange(g: Game, a: number, b: number): number {
  return a + (b - a) * rand(g);
}
export function pick<T>(g: Game, arr: readonly T[]): T {
  return arr[Math.floor(rand(g) * arr.length) % arr.length]!;
}

// ---- 地形の問い合わせ ----
export function zoneAt(x: number, y: number): Zone {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!inBounds(tx, ty)) return Zone.Out;
  return L.zone[idx(tx, ty)] as Zone;
}
export function isPrivateAt(x: number, y: number): boolean {
  const z = zoneAt(x, y);
  return z === Zone.Private || z === Zone.Vault;
}
export function isOutdoorAt(x: number, y: number): boolean {
  return zoneAt(x, y) === Zone.Out;
}
// ホテル屋上（フルトン回収ができる場所）
export function isRooftopAt(x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (!inBounds(tx, ty)) return false;
  const i = idx(tx, ty);
  return L.mat[i] === Mat.Roof && !L.solid[i];
}
export function isInteriorAt(x: number, y: number): boolean {
  const z = zoneAt(x, y);
  return z === Zone.Public || z === Zone.Private || z === Zone.Vault;
}
export function roomNameAt(x: number, y: number): string {
  for (const r of L.rooms) if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r.name;
  if (x >= 13 && x < 60 && y >= 14 && y < 16) return '廊下';
  if (isOutdoorAt(x, y)) return y < 7 ? '裏通り' : y > 39 ? '表通り' : '路地';
  return '館内';
}

export type MoverClass = 'civ' | 'staff' | 'crew' | 'bank';

export function moverClass(kind: Kind): MoverClass {
  if (kind === 'civilian') return 'civ';
  if (kind === 'staff' || kind === 'manager') return 'staff';
  if (kind === 'crew') return 'crew';
  return 'bank';
}

// 移動できるタイルか。扉の施錠・バリケード・タレットなど動的な障害を含む。
export function passable(g: Game, cls: MoverClass, tx: number, ty: number): boolean {
  if (!inBounds(tx, ty)) return false;
  const i = idx(tx, ty);
  if (isHole(g, i)) return true;
  if (L.vaultAt[i]) return g.breach.open;
  if (L.solid[i]) return false;
  const d = L.doorAt[i]!;
  if (d >= 0) {
    const door = g.doors[d]!;
    if (door.locked && !door.jammed && !door.destroyed && (cls === 'crew' || cls === 'civ')) return false;
  }
  const z = L.zone[i];
  if (cls === 'civ' && (z === Zone.Private || z === Zone.Vault)) return false;
  if (cls !== 'crew') {
    for (const b of g.barricades) if (Math.floor(b.x) === tx && Math.floor(b.y) === ty) return false;
    for (const t of g.turrets) if (Math.floor(t.x) === tx && Math.floor(t.y) === ty) return false;
  }
  return true;
}

// 警察が爆破した壁穴（状態は g.holes の配列、判定用のマスクだけキャッシュする）
const holeCache = new WeakMap<Game, { n: number; mask: Uint8Array }>();
export function isHole(g: Game, i: number): boolean {
  if (!g.holes.length) return false;
  let c = holeCache.get(g);
  if (!c || c.n !== g.holes.length) {
    const mask = new Uint8Array(W * H);
    for (const h of g.holes) mask[h] = 1;
    c = { n: g.holes.length, mask };
    holeCache.set(g, c);
  }
  return c.mask[i] === 1;
}

export function barricadeAt(g: Game, tx: number, ty: number) {
  return g.barricades.find((b) => Math.floor(b.x) === tx && Math.floor(b.y) === ty) ?? null;
}

// ---- ユニット ----
const SHIRTS = ['#d9d4c7', '#7d93a8', '#a35d5d', '#5f7f6b', '#c8a96b', '#6b6f8f', '#9a7aa0', '#e0e3e8', '#4f6d7a', '#b88a6e', '#8aa37b', '#d69e7a'];
const PANTS = ['#3a3f4b', '#2d3440', '#5a4a3e', '#4b5563', '#2f3b33', '#6b5d4f'];
const SKINS = ['#f1c9a5', '#e0ac85', '#c68d63', '#a26e4b', '#7a5236', '#f6dcc4'];
const HAIRS = ['#2b2220', '#4a3423', '#7b5a36', '#b8925a', '#1d1d22', '#8c8c8c', '#a2482c'];
const BAGS = ['#3c4a5c', '#6d3b3b', '#2f4f3f', '#55473a', '#444'];
export const MASK_NAMES = ['フォックス', 'オウル', 'ラビット', 'クロコ', 'キャット'];

export function randomLook(g: Game, bagChance: number): Look {
  const r = rand(g);
  const bag: Look['bag'] = r < bagChance * 0.6 ? 'gym' : r < bagChance ? 'tote' : 'none';
  return {
    shirt: pick(g, SHIRTS),
    pants: pick(g, PANTS),
    skin: pick(g, SKINS),
    hair: pick(g, HAIRS),
    bag,
    bagColor: pick(g, BAGS),
  };
}

export function makeUnit(g: Game, kind: Kind, x: number, y: number): Unit {
  const look = randomLook(g, kind === 'civilian' ? CONFIG.civilians.bagChance : 0);
  if (kind === 'staff') {
    look.shirt = '#f4f5f7';
    look.pants = '#27324a';
  }
  if (kind === 'guard') {
    look.shirt = '#2c3e66';
    look.pants = '#1d2840';
  }
  if (kind === 'swat' || kind === 'sniper') {
    look.shirt = '#1f2630';
    look.pants = '#151a21';
  }
  const stats =
    kind === 'crew'
      ? { hp: CONFIG.crew.hp, armor: CONFIG.crew.armor }
      : kind === 'guard'
        ? { hp: CONFIG.guard.hp, armor: CONFIG.guard.armor }
        : kind === 'swat'
          ? { hp: CONFIG.swat.hp, armor: CONFIG.swat.armor }
          : { hp: 60, armor: 0 };
  const u: Unit = {
    id: g.nextId++,
    kind,
    x,
    y,
    facing: rand(g) * Math.PI * 2,
    hp: stats.hp,
    maxHp: stats.hp,
    armor: stats.armor,
    maxArmor: stats.armor,
    alive: true,
    escaped: false,
    walk: randRange(g, CONFIG.move.civilianWalk[0], CONFIG.move.civilianWalk[1]),
    look,
    path: [],
    order: null,
    action: null,
    cooldown: 0,
    stun: 0,
    moving: false,
    lastShot: -99,
    repath: 0,
    stuck: 0,
    near: 1e9,
    nearLen: 0,
    hurt: {},
    auto: { intercept: false, attack: false, hostage: false, roam: false, home: null, wait: 0, engaged: false },
    autoOrder: false,
    masked: false,
    heavy: false,
    maskStyle: 0,
    callsign: '',
    hasTool: false,
    hasKey: false,
    carrying: -1,
    suspicious: false,
    privateSeen: 0,
    bribed: false,
    deserting: false,
    brain: null,
    spot: '',
    role: '',
    aiTimer: 0,
  };
  g.units.push(u);
  return u;
}

export function unitById(g: Game, id: number): Unit | undefined {
  return g.units.find((u) => u.id === id);
}

export function active(u: Unit): boolean {
  return u.alive && !u.escaped && u.role !== 'invan' && u.brain?.state !== 'gone';
}

export function sideOf(u: Unit): Side | null {
  if (u.kind === 'crew') return 'crew';
  if (u.kind === 'guard' || u.kind === 'swat' || u.kind === 'sniper') return 'bank';
  return null;
}

export function isArmedPhase(g: Game): boolean {
  return g.phase === 'response' || g.phase === 'assault';
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---- ニュース・通知 ----
export function news(g: Game, text: string, vis: NewsEvent['vis'] = 'all', big = false): void {
  g.events.push({ id: g.nextId++, t: g.time, text, vis, big });
  if (g.events.length > 120) g.events.splice(0, g.events.length - 120);
}

export function alertBank(g: Game, x: number, y: number, text: string): void {
  g.alerts.push({ id: g.nextId++, x, y, text, t: 6 });
  g.fx.push({ type: 'ping', x, y, t: 1.6, side: 'bank' });
  news(g, text, 'bank');
}

export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function securedBags(g: Game): number {
  return g.bags.filter((b) => b.kind === 'gold' && b.state === 'secured').length;
}

// フルトンで「次の回収機が来れば持ち去れる」金塊：回収済み＋屋上の気球＋気球を付けたクルーが抱えている袋
export function fultonCommitted(g: Game): number {
  const inBalloons = g.crewBalloons.filter((cb) => (g.units.find((u) => u.id === cb.unit)?.carrying ?? -1) >= 0).length;
  return securedBags(g) + g.bags.filter((b) => b.kind === 'gold' && b.state === 'balloon').length + inBalloons;
}
