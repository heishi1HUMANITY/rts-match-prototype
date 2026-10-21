import { CONFIG } from '../config';
import { idx, inBounds } from '../map/level';
import type { Game, Side, Unit, Visibility } from './types';
import { L, active, angleDiff, dist, isHole } from './world';

export interface Source {
  x: number;
  y: number;
  dir: number;
  fov: number; // ラジアン。2π以上で全周
  range: number;
  live: boolean; // falseならループ映像（範囲は見えているつもりだが人は映らない）
  blindToCrew: boolean; // 買収された警備員
  kind: 'unit' | 'camera' | 'office' | 'sniper' | 'turret' | 'van' | 'sensor';
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export function opaqueAt(g: Game, tx: number, ty: number): boolean {
  if (!inBounds(tx, ty)) return true;
  const i = idx(tx, ty);
  if (isHole(g, i)) return false;
  if (L.vaultAt[i]) return !g.breach.open;
  const d = L.doorAt[i]!;
  if (d >= 0) return !g.doors[d]!.open;
  return L.opaque[i] === 1;
}

// 2点間の視線。始点のタイルは無視する（壁際のカメラや屋上の狙撃手のため）。
export function los(g: Game, x0: number, y0: number, x1: number, y1: number): boolean {
  let tx = Math.floor(x0);
  let ty = Math.floor(y0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? tx + 1 - x0 : x0 - tx) * tDeltaX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? ty + 1 - y0 : y0 - ty) * tDeltaY : Infinity;
  let guard = 0;
  while ((tx !== ex || ty !== ey) && guard++ < 200) {
    if (tMaxX < tMaxY) {
      tMaxX += tDeltaX;
      tx += stepX;
    } else {
      tMaxY += tDeltaY;
      ty += stepY;
    }
    if (tx === ex && ty === ey) return true;
    if (opaqueAt(g, tx, ty)) return false;
  }
  return true;
}

// 光線の到達距離（不透明タイルの手前まで、壁面が見えるよう少し食い込ませる）
export function rayLength(g: Game, x0: number, y0: number, ang: number, range: number): number {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let tx = Math.floor(x0);
  let ty = Math.floor(y0);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const tDeltaX = Math.abs(dx) > 1e-9 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = Math.abs(dy) > 1e-9 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = Math.abs(dx) > 1e-9 ? (dx > 0 ? tx + 1 - x0 : x0 - tx) * tDeltaX : Infinity;
  let tMaxY = Math.abs(dy) > 1e-9 ? (dy > 0 ? ty + 1 - y0 : y0 - ty) * tDeltaY : Infinity;
  for (let k = 0; k < 120; k++) {
    let t: number;
    if (tMaxX < tMaxY) {
      t = tMaxX;
      tMaxX += tDeltaX;
      tx += stepX;
    } else {
      t = tMaxY;
      tMaxY += tDeltaY;
      ty += stepY;
    }
    if (t >= range) return range;
    if (opaqueAt(g, tx, ty)) return Math.min(range, t + 0.45);
  }
  return range;
}

export function polygon(g: Game, s: Source): number[] {
  const full = s.fov >= TAU - 1e-3;
  const span = full ? TAU : s.fov;
  const rays = Math.max(16, Math.ceil((span / TAU) * Math.min(260, 40 + s.range * 12)));
  const pts: number[] = [];
  if (!full) pts.push(s.x, s.y);
  const a0 = full ? 0 : s.dir - span / 2;
  for (let i = 0; i <= rays; i++) {
    const a = a0 + (span * i) / rays;
    const r = rayLength(g, s.x, s.y, a, s.range);
    pts.push(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
  }
  return pts;
}

export function sourcesFor(g: Game, side: Side): Source[] {
  const out: Source[] = [];
  const omni = (x: number, y: number, range: number, kind: Source['kind'], blind = false): Source => ({
    x,
    y,
    dir: 0,
    fov: TAU,
    range,
    live: true,
    blindToCrew: blind,
    kind,
  });
  if (side === 'bank') {
    const e = L.officeEye;
    // 支店長が自室にいる間だけ、窓越しにロビーが見える
    const mgr = g.units.find((u) => u.kind === 'manager');
    if (mgr && mgr.alive && mgr.brain?.state !== 'hostage' && dist(mgr.x, mgr.y, L.managerSeat.x, L.managerSeat.y) < 3)
      out.push({ x: e.x, y: e.y, dir: e.dir, fov: CONFIG.vision.office.fov * DEG, range: CONFIG.vision.office.range, live: true, blindToCrew: false, kind: 'office' });
    for (const c of g.cameras) {
      if (c.destroyed) continue;
      out.push({ x: c.x, y: c.y, dir: c.dir, fov: CONFIG.vision.camera.fov * DEG, range: CONFIG.vision.camera.range, live: c.loop <= 0, blindToCrew: false, kind: 'camera' });
    }
    for (const u of g.units) {
      if (!active(u)) continue;
      if (u.kind === 'guard' && !u.deserting) out.push(omni(u.x, u.y, CONFIG.vision.unit, 'unit', u.bribed && g.phase === 'casing'));
      if (u.kind === 'swat') out.push(omni(u.x, u.y, CONFIG.vision.unit, 'unit'));
      if (u.kind === 'sniper')
        out.push({ x: u.x, y: u.y, dir: u.facing, fov: CONFIG.vision.sniper.fov * DEG, range: CONFIG.vision.sniper.range, live: true, blindToCrew: false, kind: 'sniper' });
    }
    for (const s of g.sensors) if (s.reveal > 0) out.push(omni(s.x, s.y, CONFIG.vision.sensorRadius + 0.5, 'sensor'));
  } else {
    for (const u of g.units) if (u.kind === 'crew' && active(u)) out.push(omni(u.x, u.y, CONFIG.vision.unit, 'unit'));
    for (const t of g.turrets) out.push(omni(t.x, t.y, CONFIG.vision.turret, 'turret'));
    if (g.van && g.van.state === 'parked') out.push(omni(g.van.x, g.van.y, CONFIG.vision.van, 'van'));
  }
  return out;
}

export function sourceSees(g: Game, s: Source, x: number, y: number): boolean {
  const d = dist(s.x, s.y, x, y);
  if (d > s.range) return false;
  if (s.fov < TAU - 1e-3 && d > 0.6 && Math.abs(angleDiff(Math.atan2(y - s.y, x - s.x), s.dir)) > s.fov / 2) return false;
  return los(g, s.x, s.y, x, y);
}

export function pointSeen(g: Game, srcs: Source[], x: number, y: number, isCrew = false): boolean {
  for (const s of srcs) {
    if (!s.live) continue;
    if (isCrew && s.blindToCrew) continue;
    if (sourceSees(g, s, x, y)) return true;
  }
  return false;
}

export function emptyVis(): Visibility {
  return { units: new Set(), cameras: new Set(), turrets: new Set(), barricades: new Set(), bags: new Set(), van: false };
}

export function computeVisibility(g: Game): void {
  for (const side of ['bank', 'crew'] as Side[]) {
    const srcs = sourcesFor(g, side);
    const v = emptyVis();
    for (const u of g.units) {
      if (u.escaped || u.role === 'invan' || u.brain?.state === 'gone') continue;
      if (ownedBy(u, side)) {
        v.units.add(u.id);
        continue;
      }
      if (u.kind === 'sniper') continue; // 屋上の狙撃手は見えない
      if (pointSeen(g, srcs, u.x, u.y, u.kind === 'crew')) v.units.add(u.id);
    }
    if (side === 'crew') {
      for (const c of g.cameras) if (!c.destroyed && (pointSeen(g, srcs, c.x, c.y) || (g.intel && c.intel))) v.cameras.add(c.id);
      for (const b of g.bags) if (b.state !== 'carried' && b.state !== 'secured' && b.state !== 'lost') v.bags.add(b.id);
      v.van = !!g.van;
    } else {
      for (const t of g.turrets) if (pointSeen(g, srcs, t.x, t.y)) v.turrets.add(t.id);
      for (const b of g.barricades) if (pointSeen(g, srcs, b.x, b.y)) v.barricades.add(b.id);
      for (const b of g.bags) if ((b.state === 'ground' || b.state === 'balloon' || b.state === 'vault') && pointSeen(g, srcs, b.x, b.y)) v.bags.add(b.id);
      v.van = !!g.van && g.van.state !== 'gone' && pointSeen(g, srcs, g.van.x, g.van.y);
      for (const c of g.cameras) v.cameras.add(c.id);
    }
    g.vis[side] = v;
  }
}

export function ownedBy(u: Unit, side: Side): boolean {
  if (side === 'crew') return u.kind === 'crew';
  return u.kind === 'guard' || u.kind === 'swat' || u.kind === 'sniper';
}
