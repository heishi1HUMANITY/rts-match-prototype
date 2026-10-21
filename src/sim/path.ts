import { CONFIG } from '../config';
import { H, W, idx } from '../map/level';
import type { Game } from './types';
import { type MoverClass, passable } from './world';

// A*（8方向・角抜け禁止）。作業用バッファは使い回す。
const N = W * H;
const gScore = new Float32Array(N);
const came = new Int32Array(N);
const stamp = new Uint32Array(N);
const closedStamp = new Uint32Array(N);
let gen = 1;

class Heap {
  items: number[] = [];
  pri: number[] = [];
  push(v: number, p: number) {
    const a = this.items;
    const b = this.pri;
    let i = a.length;
    a.push(v);
    b.push(p);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (b[parent]! <= p) break;
      a[i] = a[parent]!;
      b[i] = b[parent]!;
      i = parent;
    }
    a[i] = v;
    b[i] = p;
  }
  pop(): number {
    const a = this.items;
    const b = this.pri;
    const top = a[0]!;
    const lv = a.pop()!;
    const lp = b.pop()!;
    if (a.length) {
      let i = 0;
      const n = a.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && b[c + 1]! < b[c]!) c++;
        if (b[c]! >= lp) break;
        a[i] = a[c]!;
        b[i] = b[c]!;
        i = c;
      }
      a[i] = lv;
      b[i] = lp;
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

const DIRS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

export function nearestPassable(g: Game, cls: MoverClass, tx: number, ty: number, maxR = 3): [number, number] | null {
  if (passable(g, cls, tx, ty)) return [tx, ty];
  for (let r = 1; r <= maxR; r++) {
    let best: [number, number] | null = null;
    let bd = 1e9;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!passable(g, cls, tx + dx, ty + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = [tx + dx, ty + dy];
        }
      }
    if (best) return best;
  }
  return null;
}

export function findPath(
  g: Game,
  cls: MoverClass,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  extraCost?: (x: number, y: number) => number,
): { x: number; y: number }[] | null {
  const s0x = Math.floor(sx);
  const s0y = Math.floor(sy);
  const goal = nearestPassable(g, cls, Math.floor(tx), Math.floor(ty));
  if (!goal) return null;
  const [gx, gy] = goal;
  const start = idx(s0x, s0y);
  const goalI = idx(gx, gy);
  gen++;
  if (gen > 0xfffffff0) {
    gen = 1;
    stamp.fill(0);
    closedStamp.fill(0);
  }
  const heap = new Heap();
  gScore[start] = 0;
  stamp[start] = gen;
  came[start] = -1;
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - gx);
    const dy = Math.abs(y - gy);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  heap.push(start, h(s0x, s0y));
  let found = start === goalI;
  let guard = 0;
  while (heap.size && !found) {
    const cur = heap.pop();
    if (closedStamp[cur] === gen) continue;
    closedStamp[cur] = gen;
    if (cur === goalI) {
      found = true;
      break;
    }
    if (++guard > 9000) break;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    for (const [dx, dy, c] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!passable(g, cls, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!passable(g, cls, cx + dx, cy) || !passable(g, cls, cx, cy + dy))) continue;
      const ni = idx(nx, ny);
      if (closedStamp[ni] === gen) continue;
      const ng = gScore[cur]! + c + (extraCost ? extraCost(nx, ny) : 0);
      if (stamp[ni] !== gen || ng < gScore[ni]!) {
        stamp[ni] = gen;
        gScore[ni] = ng;
        came[ni] = cur;
        heap.push(ni, ng + h(nx, ny));
      }
    }
  }
  if (!found) return null;
  const tiles: number[] = [];
  for (let c = goalI; c !== -1 && c !== start; c = came[c]!) tiles.push(c);
  tiles.reverse();
  const pts = tiles.map((c) => ({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 }));
  // 目的地が通れるタイルなら正確な位置で終える（同じタイル内でも空の経路にしない）。
  // ただし壁際すぎて体が収まらない点は、タイルの内側へ寄せる（届かない点を目指し続けないように）
  const exact = Math.floor(tx) === gx && Math.floor(ty) === gy;
  let ex = tx;
  let ey = ty;
  if (exact && !walkLine(g, cls, tx, ty, tx, ty)) {
    const r = CONFIG.move.radius + 0.02;
    ex = Math.min(Math.max(tx, gx + r), gx + 1 - r);
    ey = Math.min(Math.max(ty, gy + r), gy + 1 - r);
  }
  if (!pts.length) pts.push(exact ? { x: ex, y: ey } : { x: gx + 0.5, y: gy + 0.5 });
  else if (exact) pts[pts.length - 1] = { x: ex, y: ey };
  return smooth(g, cls, sx, sy, pts);
}

export function walkLine(g: Game, cls: MoverClass, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(d / 0.2));
  const r = CONFIG.move.radius;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    if (
      !passable(g, cls, Math.floor(px - r), Math.floor(py - r)) ||
      !passable(g, cls, Math.floor(px + r), Math.floor(py - r)) ||
      !passable(g, cls, Math.floor(px - r), Math.floor(py + r)) ||
      !passable(g, cls, Math.floor(px + r), Math.floor(py + r))
    )
      return false;
  }
  return true;
}

function smooth(g: Game, cls: MoverClass, sx: number, sy: number, pts: { x: number; y: number }[]) {
  if (pts.length < 3) return pts;
  const out: { x: number; y: number }[] = [];
  let ax = sx;
  let ay = sy;
  let i = 0;
  while (i < pts.length) {
    let j = Math.min(pts.length - 1, i + 12);
    while (j > i && !walkLine(g, cls, ax, ay, pts[j]!.x, pts[j]!.y)) j--;
    const p = pts[j]!;
    out.push(p);
    ax = p.x;
    ay = p.y;
    i = j + 1;
  }
  return out;
}
