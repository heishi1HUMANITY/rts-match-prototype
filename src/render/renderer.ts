import { CONFIG } from '../config';
import { H, LEVEL as L, W } from '../map/level';
import { breachableWall, instantlyReportable, officeDoor, VAULT_DOOR } from '../sim/rules';
import type { DeployKind } from '../sim/commands';
import type { Game, Side, Unit } from '../sim/types';
import { pointSeen, polygon, sourcesFor, type Source } from '../sim/vision';
import { active, dist, isArmedPhase } from '../sim/world';
import { drawGoldBag, drawPerson } from './sprites';
import { drawStatic } from './staticLayer';
import { drawText } from './text';

export type ViewSide = Side | 'spectator';

export type Placement =
  | { kind: 'camera'; start: { x: number; y: number } | null }
  | { kind: 'secdoor' }
  | { kind: 'sensor' }
  | { kind: 'deploy'; item: DeployKind }
  | { kind: 'swat' }
  | { kind: 'sniper' }
  | { kind: 'roadblock' }
  | { kind: 'gas' }
  | { kind: 'wallbreach' }
  | { kind: 'c4' };

export interface View {
  side: ViewSide;
  selected: Set<number>;
  observeTarget: number;
  placement: Placement | null;
  mouse: { x: number; y: number } | null;
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  knownCameras: Set<number>;
  marks: { x: number; y: number; t: number; color: string }[];
}

const TAU = Math.PI * 2;

// 陣営の色（目印・名札・選択）
const TEAM: Record<Side, { ring: string; glow: string; tag: string }> = {
  crew: { ring: '#ff5a3c', glow: 'rgba(255,90,60,0.38)', tag: '#d8432f' },
  bank: { ring: '#4aa3ff', glow: 'rgba(74,163,255,0.36)', tag: '#2a6cc9' },
};

// 扉の開く向き（横の扉は +1 で南、縦の扉は +1 で東へ開く）
const DOOR_SWING: Record<string, 1 | -1> = {
  gate: -1,
  office: 1,
  locker: -1,
  security: 1,
  storage: -1,
  break: -1,
  manager: 1,
  dock: 1,
  staffdoor: 1,
  exitw: -1,
  exite: 1,
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private staticCanvas = document.createElement('canvas');
  private fog = document.createElement('canvas');
  private dpr = 1;
  private drawnLayout = -1;
  ts = 20;
  ox = 0;
  oy = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    // マップは画面いっぱい（縦横比を保ってはみ出さない最大）
    this.ts = Math.min(w / W, h / H);
    this.ox = (w - W * this.ts) / 2;
    this.oy = (h - H * this.ts) / 2;
    for (const c of [this.staticCanvas, this.fog]) {
      c.width = this.canvas.width;
      c.height = this.canvas.height;
    }
    this.drawnLayout = -1;
  }

  // 床・壁・家具の下絵（レイアウトが変わったときと画面サイズが変わったときだけ描き直す）
  private ensureStatic() {
    if (this.drawnLayout === L.layout) return;
    const sctx = this.staticCanvas.getContext('2d')!;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, this.staticCanvas.width, this.staticCanvas.height);
    this.tileTransform(sctx);
    drawStatic(sctx);
    this.drawnLayout = L.layout;
  }

  private tileTransform(c: CanvasRenderingContext2D) {
    const k = this.ts * this.dpr;
    c.setTransform(k, 0, 0, k, this.ox * this.dpr, this.oy * this.dpr);
  }

  toTile(px: number, py: number) {
    return { x: (px - this.ox) / this.ts, y: (py - this.oy) / this.ts };
  }

  toScreen(x: number, y: number) {
    return { x: this.ox + x * this.ts, y: this.oy + y * this.ts };
  }

  draw(g: Game, v: View, time: number): void {
    const ctx = this.ctx;
    this.ensureStatic();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.staticCanvas, 0, 0);
    this.tileTransform(ctx);
    const side = v.side;
    const sees = (u: Unit) => side === 'spectator' || g.vis[side].units.has(u.id);
    if (side === 'crew') for (const c of g.cameras) if (g.vis.crew.cameras.has(c.id)) v.knownCameras.add(c.id);

    this.drawHoles(g);
    for (const f of g.fx) {
      if (f.type !== 'blood') continue;
      ctx.fillStyle = 'rgba(122,28,36,0.55)';
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.r, f.r * 0.75, f.x, 0, TAU);
      ctx.fill();
    }
    this.drawDoors(g, time);
    this.drawVault(g, side, time);
    this.drawBags(g, side);
    this.drawObjects(g, side, time);
    this.drawVehicles(g, side, time);

    // 人物（死体 → 生存者の順）
    for (const u of g.units) if (!u.alive && !u.escaped && sees(u) && u.kind !== 'sniper') this.drawUnit(g, u, side, time);
    for (const u of g.units) if (u.alive && active(u) && u.kind !== 'sniper' && sees(u)) this.drawUnit(g, u, side, time, v.selected.has(u.id));

    this.drawAir(g, side, time);
    this.drawFx(g, side, time);
    if (side !== 'spectator') this.drawFog(g, side);
    this.drawOverlays(g, v, time);
  }

  // ---- 地形の変化 ----
  private drawHoles(g: Game) {
    const ctx = this.ctx;
    for (const i of g.holes) {
      const x = i % W;
      const y = Math.floor(i / W);
      ctx.fillStyle = '#8d8f93';
      ctx.fillRect(x, y, 1, 1);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 ? '#5d6066' : '#b4b6ba';
        const a = ((i * 37 + k * 71) % 100) / 100;
        const b = ((i * 13 + k * 29) % 100) / 100;
        ctx.fillRect(x + a * 0.8, y + b * 0.8, 0.18, 0.14);
      }
    }
    for (const w of g.wallCharges) {
      ctx.fillStyle = Math.floor(g.time * 6) % 2 ? '#ff3b3b' : '#5a1010';
      ctx.fillRect(w.x - 0.18, w.y - 0.18, 0.36, 0.36);
    }
  }

  private drawDoors(g: Game, time: number) {
    const ctx = this.ctx;
    g.doors.forEach((d, i) => {
      const s = L.doorSlots[i]!;
      const xs = s.tiles.map((t) => t[0]);
      const ys = s.tiles.map((t) => t[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const x1 = Math.max(...xs) + 1;
      const y1 = Math.max(...ys) + 1;
      // 扉の向きにそろえた局所座標：u が開口の幅方向、v が通り抜ける方向
      ctx.save();
      if (s.vertical) {
        ctx.translate(x0 + 0.5, y0);
        ctx.rotate(Math.PI / 2);
      } else ctx.translate(x0, y0 + 0.5);
      const len = s.vertical ? y1 - y0 : x1 - x0;
      const swing = DOOR_SWING[s.id] ?? 1;
      const sv = s.vertical ? -swing : swing; // 回転で v の向きが反転する
      // 枠（両側の抱き）
      ctx.fillStyle = '#14171c';
      ctx.fillRect(-0.04, -0.5, 0.1, 1);
      ctx.fillRect(len - 0.06, -0.5, 0.1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, -0.5, len, 1);
      if (d.destroyed) {
        // 吹き飛んだ扉の破片
        ctx.fillStyle = '#3a3d42';
        for (let k = 0; k < 6; k++) {
          const a = ((i * 37 + k * 53) % 100) / 100;
          const b = ((i * 11 + k * 71) % 100) / 100;
          ctx.save();
          ctx.translate(a * len, (b - 0.5) * 1.6);
          ctx.rotate(a * 6);
          ctx.fillRect(-0.12, -0.04, 0.24 + b * 0.2, 0.08);
          ctx.restore();
        }
        ctx.restore();
        return;
      }
      const color = s.kind === 'office' ? '#5a3a26' : d.security ? '#7d8896' : s.kind === 'shutter' ? '#8a929b' : s.kind === 'gate' ? '#a88a5e' : s.kind === 'exit' ? '#9aa3ad' : s.kind === 'staff' ? '#6f7a86' : '#b08a5e';
      const leaf = (hx: number, dir: 1 | -1, l: number, angle: number) => {
        // hx を蝶番に、dir 方向へ伸びる扉板を angle だけ開く
        ctx.save();
        ctx.translate(hx, 0);
        ctx.rotate(dir * sv * angle);
        ctx.fillStyle = '#14171c';
        ctx.fillRect(dir > 0 ? -0.02 : -l - 0.02, -0.09, l + 0.04, 0.18);
        ctx.fillStyle = color;
        ctx.fillRect(dir > 0 ? 0 : -l, -0.065, l, 0.13);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(dir > 0 ? 0 : -l, -0.065, l, 0.025);
        // 取っ手
        ctx.fillStyle = s.kind === 'exit' ? '#2b2f36' : '#d8d2c4';
        if (s.kind === 'exit') ctx.fillRect(dir > 0 ? l * 0.2 : -l * 0.8, -0.1, l * 0.6, 0.035);
        else ctx.fillRect(dir > 0 ? l - 0.16 : -l + 0.08, -0.11, 0.08, 0.22);
        if (d.security) {
          ctx.fillStyle = '#e2b93b';
          ctx.fillRect(dir > 0 ? 0 : -l, -0.065, l, 0.03);
          ctx.fillRect(dir > 0 ? 0 : -l, 0.035, l, 0.03);
        }
        ctx.restore();
      };
      if (s.kind === 'shutter') {
        if (d.open) {
          // 巻き上げ済み：上部のボックスだけ
          ctx.fillStyle = '#14171c';
          ctx.fillRect(0, -0.5, len, 0.2);
          ctx.fillStyle = '#5d646d';
          ctx.fillRect(0.02, -0.48, len - 0.04, 0.16);
        } else {
          ctx.fillStyle = '#14171c';
          ctx.fillRect(0, -0.2, len, 0.4);
          for (let k = 0; k < len; k += 0.25) {
            ctx.fillStyle = Math.round(k * 4) % 2 ? '#8a929b' : '#9ea6af';
            ctx.fillRect(k, -0.17, 0.25, 0.34);
          }
          ctx.fillStyle = '#e2b93b';
          ctx.fillRect(0, 0.12, len, 0.05);
        }
      } else if (s.kind === 'gate') {
        // カウンター脇の腰高扉
        const ang = d.open ? 1.45 : 0;
        leaf(0, 1, len / 2, ang);
        leaf(len, -1, len / 2, ang);
      } else if (len > 1.5) {
        // 両開き
        const ang = d.open ? 1.4 : 0;
        if (d.open) this.swingArc(0, len / 2, sv);
        if (d.open) this.swingArc(len, -len / 2, sv);
        leaf(0, 1, len / 2 - 0.02, ang);
        leaf(len, -1, len / 2 - 0.02, ang);
      } else {
        const ang = d.open ? 1.4 : 0;
        if (d.open) this.swingArc(0.06, len - 0.12, sv);
        leaf(0.06, 1, len - 0.12, ang);
      }
      // 施錠ランプ（カードリーダー）
      if (s.kind !== 'shutter') {
        ctx.fillStyle = '#14171c';
        ctx.fillRect(len + 0.04, -0.42 * sv - 0.08, 0.14, 0.16);
        ctx.fillStyle = d.locked && !d.jammed ? '#ff3b3b' : '#3bd16f';
        ctx.fillRect(len + 0.07, -0.42 * sv - 0.05, 0.08, 0.1);
      }
      ctx.restore();
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (d.locked && !d.jammed) {
        ctx.fillStyle = '#14171c';
        ctx.beginPath();
        ctx.arc(cx, cy, 0.12, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#e04848';
        ctx.beginPath();
        ctx.arc(cx, cy, 0.085, 0, TAU);
        ctx.fill();
      }
      if (d.jammed) {
        ctx.strokeStyle = Math.floor(time * 3) % 2 ? '#ff5a3c' : 'rgba(255,90,60,0.3)';
        ctx.lineWidth = 0.08;
        ctx.strokeRect(x0 - 0.1, y0 - 0.1, x1 - x0 + 0.2, y1 - y0 + 0.2);
      }
    });
    // 支店長室の小型ドリル
    if (g.officeDrill.installed) {
      const d = officeDoor(g);
      const [tx, ty] = L.doorSlots[d.slot]!.tiles[0]!;
      ctx.fillStyle = '#14171c';
      ctx.fillRect(tx + 0.17, ty - 0.38, 0.66, 0.46);
      ctx.fillStyle = '#e07a2e';
      ctx.fillRect(tx + 0.2, ty - 0.35, 0.6, 0.4);
      ctx.fillStyle = '#2b2f36';
      ctx.fillRect(tx + 0.45, ty + 0.05, 0.1, 0.25);
      this.progressArc(tx + 0.5, ty - 0.7, 0.28, g.officeDrill.progress, '#ffb347');
    }
  }

  // 開いた扉の軌跡（薄い円弧）
  private swingArc(hx: number, l: number, sv: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(20,23,28,0.35)';
    ctx.lineWidth = 0.025;
    ctx.setLineDash([0.08, 0.06]);
    ctx.beginPath();
    const r = Math.abs(l);
    const a0 = l > 0 ? 0 : Math.PI;
    const a1 = l > 0 ? sv * 1.4 : Math.PI - sv * 1.4;
    ctx.arc(hx, 0, r, Math.min(a0, a1), Math.max(a0, a1));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawVault(g: Game, side: ViewSide, time: number) {
    const ctx = this.ctx;
    const b = g.breach;
    const cx = VAULT_DOOR.x;
    const cy = VAULT_DOOR.y;
    // 扉枠
    ctx.fillStyle = '#14171c';
    ctx.fillRect(cx - 1.08, cy - 0.5, 2.16, 1);
    ctx.fillStyle = '#5d646d';
    ctx.fillRect(cx - 1.02, cy - 0.46, 0.14, 0.92);
    ctx.fillRect(cx + 0.88, cy - 0.46, 0.14, 0.92);
    if (!b.open) {
      // 円形の金庫扉：ボルト・ハンドル車輪
      ctx.fillStyle = '#14171c';
      ctx.beginPath();
      ctx.arc(cx, cy, 0.74, 0, TAU);
      ctx.fill();
      const gr = ctx.createRadialGradient(cx - 0.2, cy - 0.2, 0.05, cx, cy, 0.7);
      gr.addColorStop(0, '#b9c2cc');
      gr.addColorStop(1, '#6b7580');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.68, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,23,28,0.6)';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.56, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#3c444e';
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * 0.62, cy + Math.sin(a) * 0.62, 0.035, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = '#2b3138';
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.arc(cx, cy, 0.3, 0, TAU);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI + 0.3;
        ctx.moveTo(cx + Math.cos(a) * 0.38, cy + Math.sin(a) * 0.38);
        ctx.lineTo(cx - Math.cos(a) * 0.38, cy - Math.sin(a) * 0.38);
      }
      ctx.stroke();
      ctx.fillStyle = '#d8b24a';
      ctx.beginPath();
      ctx.arc(cx, cy, 0.09, 0, TAU);
      ctx.fill();
      if (b.reinforced) {
        ctx.strokeStyle = '#e2b93b';
        ctx.lineWidth = 0.08;
        ctx.setLineDash([0.14, 0.1]);
        ctx.beginPath();
        ctx.arc(cx, cy, 0.8, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else {
      // 開いた扉：東の蝶番から廊下側へ倒れた厚い扉
      ctx.save();
      ctx.translate(cx + 0.95, cy + 0.1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-0.15, 0.08, 0.42, 1.35);
      ctx.fillStyle = '#14171c';
      ctx.fillRect(-0.24, -0.02, 0.44, 1.42);
      const gr = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
      gr.addColorStop(0, '#6b7580');
      gr.addColorStop(0.5, '#b9c2cc');
      gr.addColorStop(1, '#6b7580');
      ctx.fillStyle = gr;
      ctx.fillRect(-0.2, 0.02, 0.36, 1.34);
      ctx.fillStyle = '#3c444e';
      for (let k = 0; k < 6; k++) ctx.fillRect(-0.28, 0.12 + k * 0.22, 0.1, 0.06);
      ctx.restore();
    }
    if (b.installed && !b.open) {
      const visible = side !== 'bank' || pointSeen(g, sourcesFor(g, 'bank'), cx, cy + 0.9);
      if (visible) {
        if (b.method === 'drill') {
          ctx.fillStyle = '#14171c';
          ctx.fillRect(cx - 0.39, cy + 0.41, 0.78, 0.53);
          ctx.fillStyle = '#d9822b';
          ctx.fillRect(cx - 0.35, cy + 0.45, 0.7, 0.45);
          ctx.fillStyle = '#2b2f36';
          ctx.fillRect(cx - 0.25, cy + 0.55, 0.5, 0.1);
          ctx.fillStyle = '#333';
          ctx.fillRect(cx - 0.06, cy + 0.2, 0.12, 0.3);
          if (b.jammed) {
            ctx.fillStyle = '#ff3b3b';
            drawText(ctx, 'JAM', cx, cy + 1.45, '700 0.5px Oswald, sans-serif');
          }
        } else if (b.method === 'thermal') {
          const pulse = 0.6 + Math.sin(time * 8) * 0.2;
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1.4);
          grad.addColorStop(0, `rgba(255,240,200,${pulse})`);
          grad.addColorStop(0.4, `rgba(255,140,40,${pulse * 0.6})`);
          grad.addColorStop(1, 'rgba(255,80,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, 1.4, 0, TAU);
          ctx.fill();
        } else {
          ctx.fillStyle = Math.floor(time * 4) % 2 ? '#ff3b3b' : '#7a1a1a';
          for (let k = -1; k <= 1; k++) ctx.fillRect(cx + k * 0.45 - 0.12, cy + 0.35, 0.24, 0.3);
        }
        if (side !== 'bank') this.progressArc(cx, cy, 0.85, b.progress, b.jammed ? '#ff3b3b' : '#ffd166');
      }
    }
  }

  private progressArc(x: number, y: number, r: number, p: number, color: string) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, p));
    ctx.stroke();
  }

  private drawBags(g: Game, side: ViewSide) {
    const ctx = this.ctx;
    for (const b of g.bags) {
      if (b.state !== 'vault' && b.state !== 'ground' && b.state !== 'balloon') continue;
      if (side === 'bank' && !g.vis.bank.bags.has(b.id) && b.state !== 'vault') continue;
      if (b.kind === 'gold') drawGoldBag(ctx, b.x, b.y, b.state === 'vault');
      else if (b.kind === 'tool') {
        ctx.fillStyle = '#3c4a5c';
        ctx.fillRect(b.x - 0.2, b.y - 0.12, 0.4, 0.24);
        ctx.fillStyle = '#e07a2e';
        ctx.fillRect(b.x - 0.05, b.y - 0.12, 0.1, 0.24);
      } else if (b.kind === 'keycard') {
        if (side === 'bank' && !g.vis.bank.bags.has(b.id)) continue;
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(b.x - 0.16, b.y - 0.1, 0.32, 0.2);
        ctx.fillStyle = '#c8a24a';
        ctx.fillRect(b.x - 0.12, b.y - 0.05, 0.08, 0.07);
        ctx.fillStyle = '#d6303a';
        ctx.fillRect(b.x - 0.16, b.y + 0.04, 0.32, 0.04);
      }
    }
  }

  private cameraSource(c: { x: number; y: number; dir: number }): Source {
    return { x: c.x, y: c.y, dir: c.dir, fov: (CONFIG.vision.camera.fov * Math.PI) / 180, range: CONFIG.vision.camera.range, live: true, blindToCrew: false, kind: 'camera' };
  }

  private drawObjects(g: Game, side: ViewSide, time: number) {
    const ctx = this.ctx;
    // カメラ：壁の金具から首を出した箱型カメラ
    for (const c of g.cameras) {
      if (side === 'crew' && !g.vis.crew.cameras.has(c.id)) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.dir);
      ctx.fillStyle = '#14171c';
      ctx.fillRect(-0.34, -0.05, 0.2, 0.1);
      ctx.beginPath();
      ctx.arc(-0.34, 0, 0.08, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-0.2, -0.15, 0.46, 0.3, 0.05);
      ctx.fill();
      ctx.fillStyle = c.destroyed ? '#55585d' : '#e6e8eb';
      ctx.beginPath();
      ctx.roundRect(-0.17, -0.12, 0.38, 0.24, 0.04);
      ctx.fill();
      ctx.fillStyle = c.destroyed ? '#3a3d42' : '#9aa3ad';
      ctx.fillRect(-0.17, 0.05, 0.38, 0.07);
      ctx.fillStyle = '#14171c';
      ctx.fillRect(0.18, -0.1, 0.1, 0.2);
      ctx.fillStyle = c.destroyed ? '#333' : c.loop > 0 && side !== 'bank' ? '#e2b93b' : '#4fd0ff';
      ctx.beginPath();
      ctx.arc(0.26, 0, 0.06, 0, TAU);
      ctx.fill();
      if (c.destroyed) {
        ctx.strokeStyle = '#14171c';
        ctx.lineWidth = 0.03;
        ctx.beginPath();
        ctx.moveTo(-0.1, -0.12);
        ctx.lineTo(0.02, 0.0);
        ctx.lineTo(-0.05, 0.12);
        ctx.stroke();
      } else if (Math.floor(time * 1.5 + c.id) % 2 === 0) {
        ctx.fillStyle = '#ff3b3b';
        ctx.beginPath();
        ctx.arc(-0.1, -0.06, 0.03, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // センサー
    for (const s of g.sensors) {
      if (side === 'crew' && !s.intel && !pointSeen(g, sourcesFor(g, 'crew'), s.x, s.y)) continue;
      ctx.fillStyle = '#14171c';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.17, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f0f0f0';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = s.reveal > 0 ? '#ff3b3b' : '#3bd16f';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.06, 0, TAU);
      ctx.fill();
      if (side !== 'crew' && s.reveal > 0) {
        ctx.strokeStyle = 'rgba(255,90,60,0.6)';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.arc(s.x, s.y, CONFIG.vision.sensorRadius, 0, TAU);
        ctx.stroke();
      }
    }
    // 罠（強盗側にしか見えない）：指向性地雷とワイヤー
    if (side !== 'bank') {
      for (const t of g.traps) {
        ctx.strokeStyle = 'rgba(255,80,60,0.6)';
        ctx.lineWidth = 0.025;
        ctx.setLineDash([0.06, 0.05]);
        ctx.beginPath();
        ctx.arc(t.x, t.y, 0.34, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#14171c';
        ctx.fillRect(t.x - 0.16, t.y - 0.11, 0.32, 0.22);
        ctx.fillStyle = '#4b5a3c';
        ctx.fillRect(t.x - 0.13, t.y - 0.08, 0.26, 0.16);
        ctx.fillStyle = Math.floor(time * 2) % 2 ? '#ff3b3b' : '#6a1a1a';
        ctx.fillRect(t.x - 0.03, t.y - 0.03, 0.06, 0.06);
      }
    }
    // バリケード：土のうの壁
    for (const b of g.barricades) {
      if (side === 'bank' && !g.vis.bank.barricades.has(b.id)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x - 0.42, b.y - 0.36, 0.98, 0.9);
      const bags: [number, number][] = [
        [-0.25, -0.24],
        [0.25, -0.24],
        [0, 0],
        [-0.25, 0.24],
        [0.25, 0.24],
      ];
      for (const [dx, dy] of bags) {
        ctx.fillStyle = '#14171c';
        ctx.beginPath();
        ctx.roundRect(b.x + dx - 0.26, b.y + dy - 0.16, 0.52, 0.32, 0.12);
        ctx.fill();
        ctx.fillStyle = (dx + dy) % 0.5 === 0 ? '#a48a5c' : '#b39a6a';
        ctx.beginPath();
        ctx.roundRect(b.x + dx - 0.23, b.y + dy - 0.13, 0.46, 0.26, 0.1);
        ctx.fill();
        ctx.fillStyle = 'rgba(80,60,30,0.4)';
        ctx.fillRect(b.x + dx - 0.02, b.y + dy - 0.12, 0.04, 0.24);
      }
      this.hpBar(b.x, b.y - 0.62, b.hp / CONFIG.fort.barricade.hp, '#e2b93b');
    }
    // タレット：三脚に据えた機関銃
    for (const t of g.turrets) {
      if (side === 'bank' && !g.vis.bank.turrets.has(t.id)) continue;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(0.06, 0.08, 0.42, 0, TAU);
      ctx.fill();
      ctx.rotate(t.facing);
      ctx.lineCap = 'round';
      for (const a of [Math.PI, Math.PI * 0.4, -Math.PI * 0.4]) {
        ctx.strokeStyle = '#14171c';
        ctx.lineWidth = 0.09;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 0.4, Math.sin(a) * 0.4);
        ctx.stroke();
        ctx.strokeStyle = '#4a4f57';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 0.38, Math.sin(a) * 0.38);
        ctx.stroke();
      }
      ctx.fillStyle = '#14171c';
      ctx.fillRect(-0.24, -0.14, 0.5, 0.28);
      ctx.fillRect(0.2, -0.06, 0.52, 0.12);
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(-0.21, -0.11, 0.44, 0.22);
      ctx.fillStyle = '#2b2f36';
      ctx.fillRect(0.22, -0.04, 0.48, 0.08);
      ctx.fillStyle = '#e07a2e'; // 弾薬箱
      ctx.fillRect(-0.12, 0.12, 0.24, 0.16);
      ctx.fillStyle = '#14171c';
      ctx.fillRect(-0.12, 0.12, 0.24, 0.03);
      ctx.restore();
      this.hpBar(t.x, t.y - 0.6, t.hp / CONFIG.fort.turret.hp, '#e07a2e');
    }
  }

  private drawVehicles(g: Game, side: ViewSide, time: number) {
    const ctx = this.ctx;
    // 道路封鎖
    for (const r of g.roadblocks) {
      const s = L.roadblocks.find((s) => s.id === r.slot)!;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(s.x + 0.1, s.y0 + 0.1, 0.9, s.y1 - s.y0 + 1);
      for (let y = s.y0; y <= s.y1; y++) {
        ctx.fillStyle = '#14171c';
        ctx.fillRect(s.x + 0.2, y + 0.02, 0.6, 0.96);
        ctx.fillStyle = (y + Math.floor(time * 2)) % 2 ? '#f2f2f2' : '#e0662c';
        ctx.fillRect(s.x + 0.25, y + 0.05, 0.5, 0.9);
        ctx.fillStyle = (y + Math.floor(time * 2)) % 2 ? '#e0662c' : '#f2f2f2';
        ctx.fillRect(s.x + 0.25, y + 0.35, 0.5, 0.3);
      }
      this.policeCar(s.x + (s.x < 40 ? -1.6 : 2.6), (s.y0 + s.y1 + 1) / 2, time, Math.PI / 2);
    }
    // パトカー（警察到着後）
    if (g.phase === 'assault' || (g.phase === 'ended' && g.stats.shots > 0)) {
      this.policeCar(36, 43.2, time, 0);
      this.policeCar(47.5, 43.6, time, Math.PI);
    }
    const v = g.van;
    if (v && v.state !== 'gone' && (side !== 'bank' || g.vis.bank.van || v.state !== 'parked')) {
      ctx.save();
      ctx.translate(v.x, v.y);
      if (v.dir < 0) ctx.scale(-1, 1);
      const wrecked = v.state === 'wrecked';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.roundRect(-1.25, -0.6, 2.75, 1.38, 0.2);
      ctx.fill();
      ctx.fillStyle = '#111';
      for (const [wx, wy] of [
        [-1.0, -0.78],
        [-1.0, 0.64],
        [0.55, -0.78],
        [0.55, 0.64],
      ] as const)
        ctx.fillRect(wx, wy, 0.42, 0.14);
      ctx.fillStyle = '#14171c';
      ctx.beginPath();
      ctx.roundRect(-1.4, -0.74, 2.8, 1.48, 0.22);
      ctx.fill();
      ctx.fillStyle = wrecked ? '#3a3a3a' : '#eef0f2';
      ctx.beginPath();
      ctx.roundRect(-1.36, -0.7, 2.72, 1.4, 0.2);
      ctx.fill();
      // 運転席の屋根とフロントガラス、荷室の屋根
      ctx.fillStyle = '#26303c';
      ctx.beginPath();
      ctx.roundRect(0.78, -0.6, 0.34, 1.2, 0.08);
      ctx.fill();
      ctx.fillStyle = wrecked ? '#2e2e2e' : '#dfe3e7';
      ctx.fillRect(0.45, -0.62, 0.32, 1.24);
      ctx.fillStyle = wrecked ? '#333' : '#d3d8de';
      ctx.fillRect(-1.26, -0.62, 1.66, 1.24);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.03;
      for (let k = -1.1; k < 0.4; k += 0.3) {
        ctx.beginPath();
        ctx.moveTo(k, -0.6);
        ctx.lineTo(k, 0.6);
        ctx.stroke();
      }
      ctx.fillStyle = '#14171c';
      ctx.fillRect(1.05, -0.84, 0.14, 0.12);
      ctx.fillRect(1.05, 0.72, 0.14, 0.12);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(1.32, -0.55, 0.05, 0.22);
      ctx.fillRect(1.32, 0.33, 0.05, 0.22);
      if (!wrecked) {
        ctx.fillStyle = '#4a8a5c';
        drawText(ctx, 'HARBOR', -0.42, -0.05, '700 0.32px Oswald, sans-serif');
        drawText(ctx, 'FLOWERS', -0.42, 0.3, '700 0.32px Oswald, sans-serif');
        ctx.fillStyle = '#e07a9a';
        ctx.beginPath();
        ctx.arc(-1.0, -0.38, 0.1, 0, TAU);
        ctx.arc(-1.0, 0.38, 0.1, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      if (side !== 'bank' && v.state === 'parked') {
        ctx.fillStyle = '#ffd166';
        drawText(ctx, `${v.bags}/${CONFIG.gold.quotaBags}`, v.x, v.y - 1.0, '700 0.55px Oswald, sans-serif');
      }
      if (v.state === 'driving' || v.state === 'blocked') this.hpBar(v.x, v.y - 1, v.hp / CONFIG.escape.van.hp, '#ff5a3c');
    }
  }

  private policeCar(x: number, y: number, time: number, rot: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(-1.08, -0.46, 2.3, 1.05, 0.2);
    ctx.fill();
    ctx.fillStyle = '#111';
    for (const [wx, wy] of [
      [-0.85, -0.62],
      [-0.85, 0.5],
      [0.5, -0.62],
      [0.5, 0.5],
    ] as const)
      ctx.fillRect(wx, wy, 0.36, 0.12);
    ctx.fillStyle = '#14171c';
    ctx.beginPath();
    ctx.roundRect(-1.19, -0.59, 2.38, 1.18, 0.24);
    ctx.fill();
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath();
    ctx.roundRect(-1.15, -0.55, 2.3, 1.1, 0.22);
    ctx.fill();
    ctx.fillStyle = '#1d2433';
    ctx.beginPath();
    ctx.roundRect(-1.15, -0.55, 0.62, 1.1, [0.22, 0, 0, 0.22]);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(0.68, -0.55, 0.47, 1.1, [0, 0.22, 0.22, 0]);
    ctx.fill();
    // ガラス
    ctx.fillStyle = '#2c3a4d';
    ctx.beginPath();
    ctx.roundRect(0.36, -0.44, 0.3, 0.88, 0.06);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-0.52, -0.42, 0.22, 0.84, 0.05);
    ctx.fill();
    ctx.fillStyle = '#e9ecf0';
    ctx.fillRect(-0.3, -0.45, 0.66, 0.9);
    ctx.fillStyle = '#1d2433';
    drawText(ctx, '24', -0.2, 0.08, '700 0.26px Oswald, sans-serif');
    const on = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = '#14171c';
    ctx.fillRect(0.04, -0.5, 0.22, 1.0);
    ctx.fillStyle = on ? '#ff3344' : '#5a1520';
    ctx.fillRect(0.07, -0.47, 0.16, 0.44);
    ctx.fillStyle = on ? '#1a2a66' : '#4466ff';
    ctx.fillRect(0.07, 0.03, 0.16, 0.44);
    ctx.fillStyle = '#ffe9b0';
    ctx.fillRect(1.12, -0.45, 0.04, 0.18);
    ctx.fillRect(1.12, 0.27, 0.04, 0.18);
    ctx.restore();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 2.2);
    glow.addColorStop(0, on ? 'rgba(255,50,70,0.22)' : 'rgba(70,100,255,0.22)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, TAU);
    ctx.fill();
  }

  // 自陣営のユニット（観戦では両陣営の戦闘員）に付ける目印の色。素顔のクルーは銀行側の視点では付けない
  private teamOf(u: Unit, side: ViewSide): Side | null {
    const crew = u.kind === 'crew';
    const bank = u.kind === 'guard' || u.kind === 'swat';
    if (side === 'spectator') return crew ? 'crew' : bank ? 'bank' : null;
    if (side === 'crew') return crew ? 'crew' : null;
    return bank ? 'bank' : null;
  }

  // 足元の目印：陣営色の光と輪、向きの矢じり
  private drawMarker(u: Unit, team: Side, selected: boolean, time: number) {
    const ctx = this.ctx;
    const col = TEAM[team];
    const glow = ctx.createRadialGradient(u.x, u.y, 0.1, u.x, u.y, 0.8);
    glow.addColorStop(0, col.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 0.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(10,12,16,0.75)';
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 0.58, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = col.ring;
    ctx.lineWidth = selected ? 0.1 : 0.07;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 0.58, 0, TAU);
    ctx.stroke();
    // 向き
    const a = u.facing;
    ctx.fillStyle = col.ring;
    ctx.beginPath();
    ctx.moveTo(u.x + Math.cos(a) * 0.82, u.y + Math.sin(a) * 0.82);
    ctx.lineTo(u.x + Math.cos(a + 0.32) * 0.6, u.y + Math.sin(a + 0.32) * 0.6);
    ctx.lineTo(u.x + Math.cos(a - 0.32) * 0.6, u.y + Math.sin(a - 0.32) * 0.6);
    ctx.closePath();
    ctx.fill();
    if (selected) {
      // 選択中は外側に回る白い破線
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 0.05;
      ctx.setLineDash([0.22, 0.14]);
      ctx.lineDashOffset = -time * 0.8;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 0.74, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }
  }

  // 名札（陣営色の札に白文字）
  private nameTag(x: number, y: number, text: string, team: Side) {
    const ctx = this.ctx;
    const k = 0.36;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = '700 100px Oswald, "Noto Sans JP", sans-serif';
    const w = (ctx.measureText(text).width / 100) * k + 0.24;
    ctx.restore();
    ctx.fillStyle = 'rgba(10,12,16,0.8)';
    ctx.beginPath();
    ctx.roundRect(x - w / 2 - 0.04, y - 0.04, w + 0.08, 0.5, 0.1);
    ctx.fill();
    ctx.fillStyle = TEAM[team].tag;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y, w, 0.42, 0.08);
    ctx.fill();
    ctx.fillStyle = '#fff';
    drawText(ctx, text, x, y + 0.33, `700 ${k}px Oswald, "Noto Sans JP", sans-serif`);
  }

  private unitLabel(g: Game, u: Unit): string {
    // 自動行動は頭文字で添える（迎・攻・人・徘）
    const a = u.auto;
    const auto = [a.intercept ? '迎' : '', a.attack ? '攻' : '', a.hostage ? '人' : '', a.roam ? '徘' : ''].join('');
    if (u.kind === 'crew') return [u.callsign, u.hasTool ? '⚒' : '', u.hasKey ? '🔑' : '', auto].filter(Boolean).join(' ');
    const same = g.units.filter((x) => x.kind === u.kind).sort((a, b) => a.id - b.id);
    return [`${u.kind === 'swat' ? 'S' : 'G'}${same.indexOf(u) + 1}`, auto].filter(Boolean).join(' ');
  }

  private drawUnit(g: Game, u: Unit, side: ViewSide, time: number, selected = false) {
    const armed =
      isArmedPhase(g) && (u.kind === 'crew' || (u.kind === 'guard' && !u.deserting) || u.kind === 'swat') && !u.action;
    const team = u.alive ? this.teamOf(u, side) : null;
    if (team) this.drawMarker(u, team, selected, time);
    drawPerson(this.ctx, u, { armed: armed || u.kind === 'swat', flash: g.time - u.lastShot < 0.07, carryingGold: u.carrying >= 0, time });
    if (!u.alive) return;
    const ctx = this.ctx;
    const own = side !== 'spectator' && ((side === 'crew' && u.kind === 'crew') || (side === 'bank' && (u.kind === 'guard' || u.kind === 'swat')));
    // 作業中の様子は誰が見てもわかる
    if (u.action) {
      if (own || side === 'spectator') this.progressArc(u.x, u.y, 0.48, u.action.t / u.action.dur, '#ffd166');
      else {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let k = 0; k < 3; k++) {
          const on = Math.floor(time * 4) % 3 === k;
          ctx.globalAlpha = on ? 1 : 0.35;
          ctx.beginPath();
          ctx.arc(u.x - 0.18 + k * 0.18, u.y - 0.55, 0.06, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    if (u.stun > 0) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.arc(u.x, u.y - 0.5, 0.15, time * 6, time * 6 + 4);
      ctx.stroke();
    }
    const combatant = u.kind === 'crew' || u.kind === 'guard' || u.kind === 'swat';
    if (combatant && (own || (isArmedPhase(g) && (u.hp < u.maxHp || u.kind !== 'crew' || u.masked)))) {
      if (own || u.hp < u.maxHp || u.armor < u.maxArmor) {
        // 足元の輪にかからないよう頭上に出す
        this.hpBar(u.x, u.y - 1.0, u.hp / u.maxHp, own ? (side === 'crew' ? '#ff6b4a' : '#5aa9ff') : '#ddd');
        if (u.maxArmor > 0) this.hpBar(u.x, u.y - 0.9, u.armor / u.maxArmor, '#9aa7b5', 0.06);
      }
    }
    if (team) this.nameTag(u.x, u.y + 0.86, this.unitLabel(g, u), team);
    if ((side === 'crew' || side === 'spectator') && u.kind === 'crew') {
      if (g.phase === 'casing' && side === 'crew') {
        const reportable = instantlyReportable(u);
        if (u.suspicious) {
          ctx.fillStyle = reportable ? '#ff3b3b' : '#ffd166';
          drawText(ctx, reportable ? '!!' : '!', u.x + 0.42, u.y - 0.35, '700 0.5px Oswald, sans-serif');
        }
      }
    }
  }

  private hpBar(x: number, y: number, p: number, color: string, h = 0.08) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 0.4, y, 0.8, h);
    ctx.fillStyle = color;
    ctx.fillRect(x - 0.4, y, 0.8 * Math.max(0, Math.min(1, p)), h);
  }

  private drawAir(g: Game, side: ViewSide, time: number) {
    const ctx = this.ctx;
    // 催涙ガス
    for (const k of g.gases) {
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + time * 0.3;
        const r = CONFIG.gas.radius * (0.45 + 0.1 * Math.sin(time + i));
        ctx.fillStyle = `rgba(200,215,190,${0.16 * Math.min(1, k.t / 2)})`;
        ctx.beginPath();
        ctx.arc(k.x + Math.cos(a) * r * 0.6, k.y + Math.sin(a) * r * 0.6, r, 0, TAU);
        ctx.fill();
      }
    }
    // フルトン気球
    const balloon = (x: number, y: number, inflate: number) => {
      const r = 0.25 + 0.45 * (1 - inflate / CONFIG.escape.fulton.inflateTime);
      ctx.strokeStyle = 'rgba(230,230,230,0.8)';
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.6, y - 1.2);
      ctx.stroke();
      ctx.fillStyle = '#e8e4da';
      ctx.strokeStyle = '#8a8478';
      ctx.beginPath();
      ctx.arc(x + 0.6, y - 1.2, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
    };
    for (const b of g.bags) {
      if (b.state !== 'balloon') continue;
      if (side === 'bank' && !g.vis.bank.bags.has(b.id)) continue;
      balloon(b.x, b.y, b.balloon);
    }
    for (const cb of g.crewBalloons) {
      const u = g.units.find((x) => x.id === cb.unit);
      if (u && (side !== 'bank' || g.vis.bank.units.has(u.id))) balloon(u.x, u.y, cb.t);
    }
    // フルトン回収機：呼ばれたときだけ北から飛来し、ホテル屋上の上空を南へ抜ける
    if (g.plan.escape === 'fulton') {
      const p = g.plane;
      const lane = L.helipad.x;
      const mid = L.helipad.y;
      const speed = 28;
      if (p.eta >= 0 && side !== 'bank') {
        // 強盗側には飛来する経路と残り時間を出す
        ctx.strokeStyle = 'rgba(255,209,102,0.55)';
        ctx.lineWidth = 0.08;
        ctx.setLineDash([0.5, 0.35]);
        ctx.lineDashOffset = -time * 3;
        ctx.beginPath();
        ctx.moveTo(lane, -1);
        ctx.lineTo(lane, H + 1);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.lineWidth = 0.1;
        drawText(ctx, `回収機 ${Math.max(0, Math.ceil(p.eta))}秒`, lane, 7.2, '700 0.5px Oswald, "Noto Sans JP", sans-serif', 'center', true);
      }
      let py: number | null = null;
      if (p.eta >= 0 && p.eta < 2) py = mid - p.eta * speed;
      else if (p.pass > 0) py = mid + (2.5 - p.pass) * speed;
      if (py !== null && py > -6 && py < H + 6) this.drawPlane(lane, py);
    }
    // 狙撃手のスコープの反射
    for (const u of g.units) {
      if (u.kind !== 'sniper' || !u.alive) continue;
      const tw = 0.6 + 0.4 * Math.sin(time * 5 + u.id);
      ctx.fillStyle = `rgba(255,80,80,${tw})`;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 0.18, 0, TAU);
      ctx.fill();
      if (g.time - u.lastShot < 0.6 || side !== 'crew') {
        ctx.strokeStyle = 'rgba(255,60,60,0.35)';
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        ctx.lineTo(u.x + Math.cos(u.facing) * 8, u.y + Math.sin(u.facing) * 8);
        ctx.stroke();
      }
    }
  }

  // 回収機（上から見た小型輸送機、機首のフォークで気球の索を引っかける）。機首は南向き
  private drawPlane(x: number, y: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.translate(x + 1.4, y + 1.8);
    ctx.rotate(Math.PI / 2);
    this.planeShape(true);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2);
    this.planeShape(false);
    ctx.restore();
  }

  private planeShape(shadow: boolean) {
    const ctx = this.ctx;
    const body = shadow ? 'rgba(0,0,0,0.28)' : '#4a525d';
    const top = shadow ? 'rgba(0,0,0,0)' : '#6b7480';
    const ink = shadow ? 'rgba(0,0,0,0)' : '#14171c';
    // 主翼
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0.7, -3.7);
    ctx.lineTo(1.3, -3.7);
    ctx.lineTo(1.0, 3.7);
    ctx.lineTo(0.4, 3.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0.75, -3.6);
    ctx.lineTo(1.25, -3.6);
    ctx.lineTo(0.95, 3.6);
    ctx.lineTo(0.45, 3.6);
    ctx.closePath();
    ctx.fill();
    // エンジン
    ctx.fillStyle = shadow ? body : '#2b3036';
    for (const e of [-2.2, -1.1, 1.1, 2.2]) ctx.fillRect(1.15, e - 0.13, 0.55, 0.26);
    // 尾翼
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-2.3, -1.3);
    ctx.lineTo(-2.0, -1.3);
    ctx.lineTo(-1.7, 0);
    ctx.lineTo(-2.0, 1.3);
    ctx.lineTo(-2.3, 1.3);
    ctx.closePath();
    ctx.fill();
    // 胴体
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.6, 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.55, 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = top;
    ctx.fillRect(-2.0, -0.08, 3.8, 0.16);
    if (shadow) return;
    ctx.fillStyle = '#9fd3ea';
    ctx.fillRect(2.05, -0.2, 0.25, 0.4);
    // 機首の回収フォーク
    ctx.strokeStyle = '#d8b24a';
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    ctx.moveTo(2.5, 0);
    ctx.lineTo(3.3, -0.55);
    ctx.moveTo(2.5, 0);
    ctx.lineTo(3.3, 0.55);
    ctx.stroke();
  }

  private drawFx(g: Game, side: ViewSide, time: number) {
    const ctx = this.ctx;
    for (const f of g.fx) {
      switch (f.type) {
        case 'tracer': {
          ctx.strokeStyle = f.side === 'crew' ? `rgba(255,190,90,${f.t * 7})` : `rgba(170,215,255,${f.t * 7})`;
          ctx.lineWidth = 0.06;
          ctx.beginPath();
          ctx.moveTo(f.x1, f.y1);
          ctx.lineTo(f.x2, f.y2);
          ctx.stroke();
          break;
        }
        case 'boom': {
          const p = 1 - f.t / 0.8;
          ctx.fillStyle = `rgba(255,220,150,${Math.max(0, 0.7 - p)})`;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r * (0.4 + p), 0, TAU);
          ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.8 - p)})`;
          ctx.lineWidth = 0.1;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r * (0.6 + p * 1.2), 0, TAU);
          ctx.stroke();
          break;
        }
        case 'spark':
          ctx.fillStyle = `rgba(255,${200 + Math.floor(Math.random() * 55)},120,${f.t * 2})`;
          ctx.fillRect(f.x, f.y, 0.08, 0.08);
          break;
        case 'ping':
          if (side === 'crew') break;
          ctx.strokeStyle = `rgba(255,170,60,${f.t / 1.6})`;
          ctx.lineWidth = 0.08;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 0.4 + (1.6 - f.t) * 1.6, 0, TAU);
          ctx.stroke();
          break;
        default:
          break;
      }
    }
    void time;
  }

  private drawFog(g: Game, side: Side) {
    const f = this.fog.getContext('2d')!;
    f.setTransform(1, 0, 0, 1, 0, 0);
    f.globalCompositeOperation = 'source-over';
    f.clearRect(0, 0, this.fog.width, this.fog.height);
    f.fillStyle = 'rgba(9,12,20,0.7)';
    f.fillRect(0, 0, this.fog.width, this.fog.height);
    f.globalCompositeOperation = 'destination-out';
    this.tileTransform(f);
    f.filter = `blur(${Math.max(1, this.ts * this.dpr * 0.18)}px)`;
    f.fillStyle = '#000';
    for (const s of sourcesFor(g, side)) {
      const pts = polygon(g, s);
      f.beginPath();
      f.moveTo(pts[0]!, pts[1]!);
      for (let i = 2; i < pts.length; i += 2) f.lineTo(pts[i]!, pts[i + 1]!);
      f.closePath();
      f.fill();
    }
    f.filter = 'none';
    f.globalCompositeOperation = 'source-over';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.fog, 0, 0);
    this.tileTransform(this.ctx);
  }

  private drawOverlays(g: Game, v: View, time: number) {
    const ctx = this.ctx;
    const side = v.side;
    // 強盗側: 見つけたカメラの視界（赤）
    if (side === 'crew' || side === 'spectator') {
      for (const c of g.cameras) {
        if (c.destroyed || (side === 'crew' && !v.knownCameras.has(c.id))) continue;
        const pts = polygon(g, this.cameraSource(c));
        ctx.fillStyle = c.loop > 0 ? 'rgba(226,185,59,0.08)' : 'rgba(255,60,60,0.10)';
        ctx.strokeStyle = c.loop > 0 ? 'rgba(226,185,59,0.5)' : 'rgba(255,70,70,0.45)';
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(pts[0]!, pts[1]!);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (c.loop > 0) {
          ctx.fillStyle = '#e2b93b';
          drawText(ctx, `LOOP ${Math.ceil(c.loop)}`, c.x, c.y - 0.35, '700 0.4px Oswald, sans-serif');
        }
      }
    }
    // 銀行側: アラート
    if (side === 'bank' || side === 'spectator') {
      for (const a of g.alerts) {
        ctx.strokeStyle = `rgba(255,170,60,${Math.min(1, a.t / 2)})`;
        ctx.lineWidth = 0.07;
        ctx.setLineDash([0.25, 0.15]);
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.1, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // 選択中ユニット
    for (const id of v.selected) {
      const u = g.units.find((x) => x.id === id);
      if (!u || !active(u)) continue;
      const col = u.kind === 'crew' ? TEAM.crew.ring : TEAM.bank.ring;
      // 迎撃・徘徊の持ち場と範囲
      const home = u.auto.home;
      if (home && (u.auto.roam || u.auto.intercept)) {
        const r = u.auto.intercept ? CONFIG.auto.interceptRange : CONFIG.auto.roamRadius;
        ctx.fillStyle = col + '14';
        ctx.strokeStyle = col + '66';
        ctx.lineWidth = 0.05;
        ctx.setLineDash([0.3, 0.2]);
        ctx.beginPath();
        ctx.arc(home.x, home.y, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(home.x, home.y, 0.12, 0, TAU);
        ctx.fill();
      }
      if (u.path.length) {
        ctx.strokeStyle = col + '88';
        ctx.lineWidth = 0.04;
        ctx.setLineDash([0.2, 0.15]);
        ctx.beginPath();
        ctx.moveTo(u.x, u.y);
        for (const p of u.path) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const end = u.path[u.path.length - 1]!;
        ctx.beginPath();
        ctx.arc(end.x, end.y, 0.12, 0, TAU);
        ctx.stroke();
      }
    }
    // 観察対象
    if ((side === 'bank' || side === 'spectator') && v.observeTarget >= 0 && g.phase === 'casing') {
      const t = g.units.find((x) => x.id === v.observeTarget);
      if (t && t.alive && (side === 'spectator' || g.vis.bank.units.has(t.id))) {
        const o = g.observe;
        const r = 0.62;
        ctx.strokeStyle = o.holding ? '#ffd166' : '#ffffff';
        ctx.lineWidth = 0.07;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          ctx.beginPath();
          ctx.moveTo(t.x + sx * r, t.y + sy * (r - 0.22));
          ctx.lineTo(t.x + sx * r, t.y + sy * r);
          ctx.lineTo(t.x + sx * (r - 0.22), t.y + sy * r);
          ctx.stroke();
        }
        if (o.holding && o.target === t.id) this.progressArc(t.x, t.y, 0.78, o.progress / CONFIG.observe.duration, '#ffd166');
      }
    }
    // 配置モード
    const p = v.placement;
    const m = v.mouse;
    if (p) this.drawPlacement(g, p, m, time);
    for (const mk of v.marks) {
      ctx.strokeStyle = mk.color;
      ctx.lineWidth = 0.06;
      ctx.globalAlpha = Math.min(1, mk.t * 3);
      ctx.beginPath();
      ctx.arc(mk.x, mk.y, 0.15 + (0.5 - mk.t) * 0.9, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (v.box) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 0.04;
      const { x0, y0, x1, y1 } = v.box;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }

  private drawPlacement(g: Game, p: Placement, m: { x: number; y: number } | null, time: number) {
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    const label = (text: string, x: number, y: number, color = '#fff') => {
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.lineWidth = 0.1;
      ctx.fillStyle = color;
      drawText(ctx, text, x, y, '700 0.42px "Noto Sans JP", sans-serif', 'center', true);
    };
    switch (p.kind) {
      case 'camera': {
        const at = p.start ?? m;
        if (!at) break;
        const dir = p.start && m ? Math.atan2(m.y - p.start.y, m.x - p.start.x) : -Math.PI / 2;
        const pts = polygon(g, this.cameraSource({ x: at.x, y: at.y, dir }));
        ctx.fillStyle = 'rgba(80,170,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(pts[0]!, pts[1]!);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
        ctx.closePath();
        ctx.fill();
        label(p.start ? 'ドラッグで向きを決めて離す' : 'クリック＆ドラッグで設置', at.x, at.y - 0.6);
        break;
      }
      case 'secdoor':
        L.doorSlots.forEach((s, i) => {
          const d = g.doors[i]!;
          if (!s.securable || d.security) return;
          ctx.strokeStyle = `rgba(255,209,102,${0.5 + pulse * 0.5})`;
          ctx.lineWidth = 0.08;
          for (const [x, y] of s.tiles) ctx.strokeRect(x, y, 1, 1);
          const [x, y] = s.tiles[0]!;
          label(s.name, x + 0.5, y - 0.2, '#ffd166');
        });
        break;
      case 'sensor':
        if (m) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 0.05;
          ctx.beginPath();
          ctx.arc(Math.floor(m.x) + 0.5, Math.floor(m.y) + 0.5, CONFIG.vision.sensorRadius, 0, TAU);
          ctx.stroke();
        }
        break;
      case 'deploy':
        for (const u of g.units) {
          if (u.kind !== 'crew' || !active(u)) continue;
          ctx.strokeStyle = 'rgba(255,90,60,0.35)';
          ctx.lineWidth = 0.04;
          ctx.beginPath();
          ctx.arc(u.x, u.y, 6, 0, TAU);
          ctx.stroke();
        }
        if (m) {
          ctx.fillStyle = 'rgba(255,90,60,0.4)';
          ctx.fillRect(Math.floor(m.x), Math.floor(m.y), 1, 1);
          label({ turret: 'タレット', barricade: 'バリケード', trap: '罠' }[p.item], Math.floor(m.x) + 0.5, Math.floor(m.y) - 0.2);
        }
        break;
      case 'swat':
        for (const s of L.staging) {
          ctx.fillStyle = `rgba(74,163,255,${0.4 + pulse * 0.4})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 0.7, 0, TAU);
          ctx.fill();
          label(s.name, Math.min(W - 3, Math.max(3, s.x)), s.y - 0.9, '#9ccbff');
        }
        break;
      case 'sniper':
        for (const s of L.sniperSpots) {
          const taken = g.units.some((u) => u.kind === 'sniper' && u.alive && u.spot === s.id);
          ctx.fillStyle = taken ? 'rgba(150,150,150,0.5)' : `rgba(255,90,90,${0.4 + pulse * 0.4})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 0.55, 0, TAU);
          ctx.fill();
          if (m && dist(m.x, m.y, s.x, s.y) < 1.5) {
            const pts = polygon(g, { x: s.x, y: s.y, dir: s.dir, fov: (CONFIG.vision.sniper.fov * Math.PI) / 180, range: CONFIG.vision.sniper.range, live: true, blindToCrew: false, kind: 'sniper' });
            ctx.fillStyle = 'rgba(255,90,90,0.12)';
            ctx.beginPath();
            ctx.moveTo(pts[0]!, pts[1]!);
            for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
            ctx.closePath();
            ctx.fill();
            label(s.name, s.x, s.y - 0.8, '#ffb0b0');
          }
        }
        break;
      case 'roadblock':
        for (const s of L.roadblocks) {
          if (g.roadblocks.some((r) => r.slot === s.id)) continue;
          ctx.strokeStyle = `rgba(255,140,60,${0.5 + pulse * 0.5})`;
          ctx.lineWidth = 0.1;
          ctx.strokeRect(s.x, s.y0, 1, s.y1 - s.y0 + 1);
          label(s.name, s.x + 0.5, s.y0 - 0.2, '#ffb36b');
        }
        break;
      case 'gas':
        if (m) {
          ctx.fillStyle = 'rgba(200,215,190,0.25)';
          ctx.beginPath();
          ctx.arc(m.x, m.y, CONFIG.gas.radius, 0, TAU);
          ctx.fill();
        }
        break;
      case 'wallbreach':
        if (m) {
          const tx = Math.floor(m.x);
          const ty = Math.floor(m.y);
          const ok = breachableWall(g, tx, ty);
          ctx.strokeStyle = ok ? '#ffd166' : 'rgba(255,60,60,0.7)';
          ctx.lineWidth = 0.1;
          ctx.strokeRect(tx, ty, 1, 1);
          label(ok ? '爆破地点' : '爆破できない壁', tx + 0.5, ty - 0.2, ok ? '#ffd166' : '#ff8080');
        }
        break;
      case 'c4':
        if (m) label('施錠された扉を右クリック', m.x, m.y - 0.6, '#ffd166');
        break;
    }
  }
}

