import { H, LEVEL as L, Mat, W, Zone, idx } from '../map/level';
import type { Decor, Furniture } from '../map/level';
import { drawText } from './text';

// 床・壁・家具など変化しないものを一度だけ描く（タイル座標系）。
// ドアキッカーズのような「図面に質感を足した」見下ろし表現：
// 素材ごとの床、壁際の陰、輪郭のはっきりした家具、当たり判定のない小物。

const TAU = Math.PI * 2;
const INK = '#14171c';

function hash(x: number, y: number, k = 0): number {
  let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function tileMat(x: number, y: number): number {
  if (x < 0 || y < 0 || x >= W || y >= H) return Mat.Roof;
  return L.mat[idx(x, y)]!;
}

function isWall(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  return L.mat[idx(x, y)] === Mat.Wall;
}

// 屋上（建物ブロック）
const BLOCKS = {
  warehouse: [0, 0, W, 2] as const,
  hotel: [0, 7, 10, 33] as const,
  garage: [74, 7, 10, 33] as const,
  south: [0, 45, W, 3] as const,
};

export function drawStatic(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(-2, -2, W + 4, H + 4);

  floorBase(ctx);
  floorTexture(ctx);
  roofs(ctx);
  roadMarkings(ctx);
  for (const d of L.decor) if (FLOOR_DECOR.has(d.type)) decor(ctx, d);
  lighting(ctx);
  wallShadow(ctx);
  privateHatch(ctx);
  for (const f of L.furniture) furniture(ctx, f);
  for (const d of L.decor) if (!FLOOR_DECOR.has(d.type)) decor(ctx, d);
  walls(ctx);
  roomLabels(ctx);
}

// ---------------------------------------------------------------- 床

function marbleTone(x: number, y: number): string {
  const sx = Math.floor(x / 2);
  const sy = Math.floor(y / 2);
  const v = hash(sx, sy, 3) * 0.04 - 0.02;
  return (sx + sy) % 2 === 0 ? shade('#ebe5d8', 1 + v) : shade('#ddd4c2', 1 + v);
}

function floorColor(m: number, x: number, y: number): string {
  const v = hash(x, y, 1) * 0.05 - 0.025;
  switch (m) {
    case Mat.Marble:
      return marbleTone(x, y);
    case Mat.Carpet:
      return shade('#5a3a3c', 1 + v * 0.6);
    case Mat.OfficeCarpet:
      return shade('#566273', 1 + v * 0.8);
    case Mat.Tile:
      return shade('#cfd3d8', 1 + v * 0.5);
    case Mat.Restroom:
      return '#d3e2e6';
    case Mat.Concrete:
      return shade('#9a9c9e', 1 + v);
    case Mat.VaultFloor:
      return '#4a515b';
    case Mat.Asphalt:
      return shade('#353940', 1 + v * 0.6);
    case Mat.Sidewalk:
      return shade('#a9acb0', 1 + v * 1.4);
    case Mat.Wood:
      return '#b48a5e';
    default:
      return '#2c313a';
  }
}

function floorBase(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const m = tileMat(x, y);
      if (m === Mat.Wall || m === Mat.Glass || m === Mat.Roof) continue;
      ctx.fillStyle = floorColor(m, x, y);
      ctx.fillRect(x, y, 1.01, 1.01);
    }
}

function floorTexture(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const m = tileMat(x, y);
      switch (m) {
        case Mat.Marble:
          marble(ctx, x, y);
          break;
        case Mat.Tile:
          ceramic(ctx, x, y, 0.5, 'rgba(90,98,108,0.32)', 0.022);
          break;
        case Mat.Restroom:
          mosaic(ctx, x, y);
          break;
        case Mat.Wood:
          planks(ctx, x, y);
          break;
        case Mat.OfficeCarpet:
          carpetTile(ctx, x, y, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.1)');
          break;
        case Mat.Carpet:
          carpetTile(ctx, x, y, 'rgba(255,220,200,0.035)', 'rgba(0,0,0,0.08)');
          break;
        case Mat.Concrete:
          concrete(ctx, x, y);
          break;
        case Mat.VaultFloor:
          diamondPlate(ctx, x, y);
          break;
        case Mat.Asphalt:
          asphalt(ctx, x, y);
          break;
        case Mat.Sidewalk:
          paving(ctx, x, y);
          break;
      }
    }
}

function marble(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // 2×2タイルの石板、細い目地、薄い石目
  ctx.fillStyle = 'rgba(120,104,80,0.22)';
  if (x % 2 === 0) ctx.fillRect(x, y, 0.025, 1);
  if (y % 2 === 0) ctx.fillRect(x, y, 1, 0.025);
  const r = hash(x, y, 5);
  if (r < 0.45) {
    ctx.strokeStyle = r < 0.15 ? 'rgba(110,100,90,0.2)' : 'rgba(150,135,115,0.16)';
    ctx.lineWidth = 0.015 + r * 0.03;
    ctx.beginPath();
    const a = hash(x, y, 6);
    const b = hash(x, y, 7);
    ctx.moveTo(x, y + a);
    ctx.quadraticCurveTo(x + 0.5, y + b, x + 1, y + (a + b) / 2);
    if (r < 0.2) {
      ctx.moveTo(x + 0.5, y + b * 0.8);
      ctx.quadraticCurveTo(x + 0.7, y + 0.6, x + 0.6 + a * 0.4, y + 1);
    }
    ctx.stroke();
  }
  // 光沢
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(x + 0.08, y + 0.08, 0.3, 0.04);
}

function ceramic(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, line: string, lw: number) {
  for (let a = 0; a < 1; a += s)
    for (let b = 0; b < 1; b += s) {
      const v = hash(Math.round((x + a) * 10), Math.round((y + b) * 10), 9);
      if (v < 0.3) {
        ctx.fillStyle = v < 0.15 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + a, y + b, s, s);
      }
    }
  ctx.fillStyle = line;
  for (let a = 0; a < 1; a += s) {
    ctx.fillRect(x + a, y, lw, 1);
    ctx.fillRect(x, y + a, 1, lw);
  }
}

function mosaic(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const cols = ['#cfe0e5', '#c3d7de', '#dbe8ec', '#b9d0d8'];
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = cols[Math.floor(hash(x * 4 + a, y * 4 + b, 2) * 4)]!;
      ctx.fillRect(x + a * 0.25 + 0.015, y + b * 0.25 + 0.015, 0.22, 0.22);
    }
}

function planks(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // 横張りのフローリング（4枚/タイル、継ぎ目は互い違い）
  for (let k = 0; k < 4; k++) {
    const row = y * 4 + k;
    const off = (row * 0.37) % 1;
    const tone = hash(Math.floor(x + off), row, 4) * 0.16 - 0.08;
    ctx.fillStyle = shade('#b48a5e', 1 + tone);
    ctx.fillRect(x, y + k * 0.25, 1.01, 0.25);
    ctx.fillStyle = 'rgba(70,40,15,0.3)';
    ctx.fillRect(x, y + k * 0.25, 1, 0.018);
    const jx = x + ((1 - off) % 1);
    ctx.fillRect(jx, y + k * 0.25, 0.018, 0.25);
    ctx.strokeStyle = 'rgba(90,55,25,0.12)';
    ctx.lineWidth = 0.012;
    ctx.beginPath();
    ctx.moveTo(x, y + k * 0.25 + 0.12 + tone * 0.3);
    ctx.lineTo(x + 1, y + k * 0.25 + 0.1 - tone * 0.3);
    ctx.stroke();
  }
}

function carpetTile(ctx: CanvasRenderingContext2D, x: number, y: number, light: string, dark: string) {
  // タイルカーペット：1枚ごとに毛並みの向きを変える
  const vertical = (x + y) % 2 === 0;
  ctx.fillStyle = vertical ? light : 'rgba(0,0,0,0.03)';
  ctx.fillRect(x, y, 1, 1);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.018;
  ctx.beginPath();
  for (let k = 0.1; k < 1; k += 0.14) {
    if (vertical) {
      ctx.moveTo(x + k, y + 0.04);
      ctx.lineTo(x + k, y + 0.96);
    } else {
      ctx.moveTo(x + 0.04, y + k);
      ctx.lineTo(x + 0.96, y + k);
    }
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x, y, 1, 0.02);
  ctx.fillRect(x, y, 0.02, 1);
}

function concrete(ctx: CanvasRenderingContext2D, x: number, y: number) {
  for (let k = 0; k < 5; k++) {
    const a = hash(x, y, 20 + k);
    const b = hash(x, y, 30 + k);
    ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x + a * 0.92, y + b * 0.92, 0.06, 0.06);
  }
  // 伸縮目地（4タイルごと）
  ctx.fillStyle = 'rgba(40,40,40,0.28)';
  if (x % 4 === 0) ctx.fillRect(x, y, 0.03, 1);
  if (y % 4 === 0) ctx.fillRect(x, y, 1, 0.03);
  const r = hash(x, y, 8);
  if (r < 0.06) {
    ctx.strokeStyle = 'rgba(30,30,30,0.25)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(x + r * 10, y);
    ctx.lineTo(x + 0.4, y + 0.5);
    ctx.lineTo(x + 0.6, y + 1);
    ctx.stroke();
  }
}

function diamondPlate(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // 縞鋼板
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 0.015;
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++) {
      const cx = x + a * 0.25 + 0.125;
      const cy = y + b * 0.25 + 0.125;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((a + b) % 2 ? Math.PI / 4 : -Math.PI / 4);
      ctx.fillRect(-0.09, -0.025, 0.18, 0.05);
      ctx.strokeRect(-0.09, -0.025, 0.18, 0.05);
      ctx.restore();
    }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  if (x % 2 === 0) ctx.fillRect(x, y, 0.03, 1);
  if (y % 2 === 0) ctx.fillRect(x, y, 1, 0.03);
}

function asphalt(ctx: CanvasRenderingContext2D, x: number, y: number) {
  for (let k = 0; k < 9; k++) {
    const a = hash(x, y, 40 + k);
    const b = hash(x, y, 60 + k);
    ctx.fillStyle = k % 3 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + a * 0.95, y + b * 0.95, 0.045, 0.045);
  }
  const r = hash(x, y, 11);
  if (r < 0.05) {
    // ひび割れ
    ctx.strokeStyle = 'rgba(15,15,18,0.45)';
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 15);
    ctx.lineTo(x + 0.35, y + 0.45);
    ctx.lineTo(x + 0.55, y + 0.4);
    ctx.lineTo(x + 1, y + 0.8);
    ctx.moveTo(x + 0.35, y + 0.45);
    ctx.lineTo(x + 0.3, y + 0.9);
    ctx.stroke();
  } else if (r < 0.08) {
    // 補修跡
    ctx.fillStyle = 'rgba(20,22,26,0.35)';
    ctx.fillRect(x + 0.1, y + 0.15, 0.8, 0.6);
  }
}

function paving(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(70,74,80,0.32)';
  ctx.fillRect(x, y, 1, 0.025);
  ctx.fillRect(x, y, 0.025, 1);
  if ((x + y) % 2 === 0) {
    ctx.fillStyle = 'rgba(70,74,80,0.18)';
    ctx.fillRect(x + 0.5, y, 0.018, 1);
  }
  const r = hash(x, y, 12);
  if (r < 0.12) {
    ctx.fillStyle = 'rgba(40,40,40,0.12)';
    ctx.beginPath();
    ctx.arc(x + 0.3 + r * 3, y + 0.5, 0.08 + r, 0, TAU);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- 屋外

function roadMarkings(ctx: CanvasRenderingContext2D) {
  // 表通り：センターライン（二重黄線）と横断歩道
  ctx.fillStyle = '#d8b24a';
  ctx.fillRect(0, 43.42, 37, 0.06);
  ctx.fillRect(0, 43.56, 37, 0.06);
  ctx.fillRect(46, 43.42, W - 46, 0.06);
  ctx.fillRect(46, 43.56, W - 46, 0.06);
  ctx.fillStyle = 'rgba(235,235,235,0.8)';
  for (let x = 37.1; x < 45.9; x += 0.9) ctx.fillRect(x, 42.15, 0.5, 2.7);
  ctx.fillStyle = 'rgba(235,235,235,0.65)';
  ctx.fillRect(36.4, 42.1, 0.12, 1.3);
  ctx.fillRect(46.5, 43.6, 0.12, 1.3);
  // 裏通り：白い側線
  ctx.fillStyle = 'rgba(230,230,230,0.45)';
  for (let x = 0; x < W; x += 2.2) ctx.fillRect(x, 2.15, 1.3, 0.06);
  // 搬入口前の荷捌き枠
  ctx.strokeStyle = 'rgba(232,196,72,0.7)';
  ctx.lineWidth = 0.08;
  ctx.strokeRect(63.8, 2.5, 4.2, 2.6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(63.8, 2.5, 4.2, 2.6);
  ctx.clip();
  ctx.strokeStyle = 'rgba(232,196,72,0.25)';
  ctx.lineWidth = 0.06;
  for (let k = -3; k < 7; k += 0.6) {
    ctx.beginPath();
    ctx.moveTo(63.8 + k, 5.1);
    ctx.lineTo(63.8 + k + 2.6, 2.5);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(232,196,72,0.8)';
  drawText(ctx, 'LOADING ONLY', 65.9, 3.95, '600 0.5px Oswald, sans-serif');
  // 縁石
  for (const [y, h] of [
    [41.86, 0.14],
    [5.86, 0.14],
  ] as const) {
    ctx.fillStyle = '#c4c6c9';
    ctx.fillRect(0, y, W, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + h, W, 0.06);
  }
  ctx.fillStyle = '#c4c6c9';
  ctx.fillRect(9.86, 6, 0.14, 34);
  ctx.fillRect(74, 6, 0.14, 34);
}

function gravel(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, base: string, seed: number) {
  ctx.fillStyle = base;
  ctx.fillRect(x0, y0, w, h);
  const n = Math.floor(w * h * 7);
  for (let k = 0; k < n; k++) {
    const a = hash(k, seed, 1);
    const b = hash(k, seed, 2);
    ctx.fillStyle = k % 3 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.14)';
    ctx.fillRect(x0 + a * w, y0 + b * h, 0.07, 0.07);
  }
}

// 非常階段：路地の上に張り出した鉄の踊り場と段板（y0 から2タイル）
function fireEscape(ctx: CanvasRenderingContext2D, y0: number) {
  const x0 = 8.55;
  const w = 1.9;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x0 + 0.12, y0 + 0.14, w, 2);
  ctx.fillStyle = INK;
  ctx.fillRect(x0 - 0.04, y0 - 0.04, w + 0.08, 2.08);
  ctx.fillStyle = '#5a636e';
  ctx.fillRect(x0, y0, w, 2);
  ctx.strokeStyle = 'rgba(20,23,28,0.7)';
  ctx.lineWidth = 0.03;
  for (let k = 0.1; k < w; k += 0.16) {
    ctx.beginPath();
    ctx.moveTo(x0 + k, y0);
    ctx.lineTo(x0 + k, y0 + 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a939e';
  ctx.fillRect(x0, y0, w, 0.08);
  ctx.fillRect(x0, y0 + 1.92, w, 0.08);
  ctx.fillStyle = 'rgba(230,234,240,0.85)';
  drawText(ctx, '▲', x0 + w / 2, y0 + 1.25, '700 0.5px sans-serif');
}

function parapet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = '#5a616c';
  ctx.lineWidth = 0.28;
  ctx.strokeRect(x + 0.14, y + 0.14, w - 0.28, h - 0.28);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.12;
  ctx.strokeRect(x + 0.34, y + 0.34, w - 0.68, h - 0.68);
}

function roofs(ctx: CanvasRenderingContext2D) {
  // ホテル：砂利敷きの屋上。歩ける範囲（フルトン回収地点）を黄色い安全線で示し、路地からの非常階段を描く
  const [hx, hy, hw, hh] = BLOCKS.hotel;
  gravel(ctx, hx, hy, hw, hh, '#3b4048', 1);
  parapet(ctx, hx, hy, hw, hh);
  ctx.strokeStyle = 'rgba(226,185,59,0.7)';
  ctx.lineWidth = 0.07;
  ctx.setLineDash([0.4, 0.25]);
  ctx.strokeRect(1.1, 8.1, 7.8, 8.8);
  ctx.setLineDash([]);
  for (const f of L.fireEscapes) fireEscape(ctx, Math.floor(f.y) - 1);
  ctx.fillStyle = 'rgba(255,209,102,0.85)';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 0.08;
  drawText(ctx, 'ROOFTOP  フルトン回収', L.helipad.x, 16.65, '700 0.42px Oswald, "Noto Sans JP", sans-serif', 'center', true);
  // 立体駐車場：コンクリートの屋上階
  const [gx, gy, gw, gh] = BLOCKS.garage;
  ctx.fillStyle = '#5b5f65';
  ctx.fillRect(gx, gy, gw, gh);
  for (let y = gy; y < gy + gh; y++)
    for (let x = gx; x < gx + gw; x++) {
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
        ctx.fillRect(x + hash(x, y, 70 + k) * 0.94, y + hash(x, y, 80 + k) * 0.94, 0.06, 0.06);
      }
    }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = gy; y < gy + gh; y += 6) ctx.fillRect(gx, y, gw, 0.04);
  // 車路の矢印
  ctx.fillStyle = 'rgba(240,240,240,0.4)';
  for (const y of [14, 24]) {
    ctx.beginPath();
    ctx.moveTo(79, y);
    ctx.lineTo(79.5, y + 0.8);
    ctx.lineTo(79.15, y + 0.8);
    ctx.lineTo(79.15, y + 1.6);
    ctx.lineTo(78.85, y + 1.6);
    ctx.lineTo(78.85, y + 0.8);
    ctx.lineTo(78.5, y + 0.8);
    ctx.closePath();
    ctx.fill();
  }
  // 下りスロープ
  ctx.fillStyle = '#4a4e54';
  ctx.fillRect(77.6, 33.6, 2.8, 5);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.05;
  for (let y = 33.9; y < 38.6; y += 0.35) {
    ctx.beginPath();
    ctx.moveTo(77.7, y);
    ctx.lineTo(80.3, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#d8b24a';
  ctx.fillRect(77.5, 33.5, 0.1, 5.2);
  ctx.fillRect(80.4, 33.5, 0.1, 5.2);
  parapet(ctx, gx, gy, gw, gh);
  // 倉庫：波板の屋根
  const [wx, wy, ww, wh] = BLOCKS.warehouse;
  ctx.fillStyle = '#4b5560';
  ctx.fillRect(wx, wy, ww, wh);
  for (let x = 0; x < ww; x += 0.25) {
    ctx.fillStyle = Math.round(x * 4) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, wy, 0.125, wh);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let x = 0; x < ww; x += 12) ctx.fillRect(x, wy, 0.06, wh);
  ctx.fillStyle = 'rgba(150,80,40,0.18)'; // 錆
  for (let k = 0; k < 14; k++) ctx.fillRect(hash(k, 3) * ww, wy + hash(k, 4) * 1.5, 0.6 + hash(k, 5), 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 1.9, W, 0.1);
  ctx.fillStyle = 'rgba(220,225,235,0.2)';
  drawText(ctx, 'HARBOR LOGISTICS  —  WAREHOUSE 7', 41, 1.3, '700 0.75px Oswald, sans-serif');
  // 向かいの商店街：建物ごとに屋根材を変え、表通り側に日よけ
  const [, sy, , sh] = BLOCKS.south;
  const shops = [
    { x: 0, w: 10, roof: '#3a3f47', name: '', awn: '' },
    { x: 10, w: 9, roof: '#4a423b', name: 'CAFE MOKA', awn: '#7b5a42' },
    { x: 19, w: 11, roof: '#3d434c', name: '', awn: '' },
    { x: 30, w: 9, roof: '#353b45', name: 'LBN SKY STUDIO', awn: '#a8323a' },
    { x: 39, w: 11, roof: '#41464d', name: '', awn: '' },
    { x: 50, w: 9, roof: '#3b4540', name: 'PHARMACY', awn: '#3f7a5a' },
    { x: 59, w: 11, roof: '#3e3f46', name: '', awn: '' },
    { x: 70, w: 9, roof: '#47403a', name: 'NOODLE 88', awn: '#b8862f' },
    { x: 79, w: 5, roof: '#393e46', name: '', awn: '' },
  ];
  shops.forEach((s, i) => {
    gravel(ctx, s.x, sy, s.w, sh, s.roof, 10 + i);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.1;
    ctx.strokeRect(s.x + 0.05, sy, s.w - 0.1, sh);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.18;
    ctx.strokeRect(s.x + 0.2, sy + 0.2, s.w - 0.4, sh - 0.4);
    if (s.awn) {
      // 縞の日よけ
      for (let k = 0; k < s.w - 1; k += 0.5) {
        ctx.fillStyle = Math.round(k * 2) % 2 ? s.awn : '#ece6da';
        ctx.fillRect(s.x + 0.5 + k, sy - 0.05, 0.5, 0.65);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(s.x + 0.5, sy + 0.6, s.w - 1, 0.08);
      ctx.fillStyle = 'rgba(230,230,230,0.4)';
      drawText(ctx, s.name, s.x + s.w / 2, sy + 1.75, '600 0.62px Oswald, sans-serif');
    }
  });
  // 屋号
  ctx.save();
  ctx.fillStyle = 'rgba(200,210,225,0.2)';
  ctx.translate(hx + hw / 2, hy + 26);
  ctx.rotate(-Math.PI / 2);
  drawText(ctx, 'GRAND HOTEL', 0, 0.25, '700 0.85px Oswald, sans-serif');
  ctx.restore();
  ctx.fillStyle = 'rgba(230,230,230,0.22)';
  drawText(ctx, 'P', 79, 38.2, '700 1.1px Oswald, sans-serif');
}

// ---------------------------------------------------------------- 光と陰

function lighting(ctx: CanvasRenderingContext2D) {
  // 天井照明のたまり（明るい屋内の広間）
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const pools: [number, number, number][] = [
    [30, 30, 5],
    [42, 28, 5],
    [54, 30, 5],
    [36, 36, 4],
    [48, 36, 4],
    [18, 27, 4],
    [18, 35, 4],
    [66, 33, 4],
  ];
  for (const [x, y, r] of pools) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,244,220,0.07)');
    gr.addColorStop(1, 'rgba(255,244,220,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 街灯の光
  for (const d of L.decor) {
    if (d.type !== 'lamp') continue;
    const gr = ctx.createRadialGradient(d.x, d.y + 0.6, 0, d.x, d.y + 0.6, 2.6);
    gr.addColorStop(0, 'rgba(255,214,150,0.09)');
    gr.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(d.x - 2.6, d.y - 2, 5.2, 5.2);
  }
  ctx.restore();
}

function wallShadow(ctx: CanvasRenderingContext2D) {
  // 壁際の陰（アンビエントオクルージョン）
  const D = 0.38;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const m = tileMat(x, y);
      if (m === Mat.Wall || m === Mat.Glass || m === Mat.Roof) continue;
      for (const [dx, dy] of [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ] as const) {
        if (!isWall(x + dx, y + dy)) continue;
        const sx = dx === 1 ? x + 1 : x;
        const sy = dy === 1 ? y + 1 : y;
        const ex = sx - dx * D;
        const ey = sy - dy * D;
        const gr = ctx.createLinearGradient(sx, sy, dx ? ex : sx, dy ? ey : sy);
        const a = dy === -1 || dx === -1 ? 0.3 : 0.18; // 光は南東から
        gr.addColorStop(0, `rgba(0,0,0,${a})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        if (dx) ctx.fillRect(Math.min(sx, ex), y, D, 1);
        else ctx.fillRect(x, Math.min(sy, ey), 1, D);
      }
    }
}

// 関係者以外立入禁止エリア：赤い網掛けと境界線で一目でわかるようにする
function isPrivateTile(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const z = L.zone[idx(x, y)];
  return z === Zone.Private || z === Zone.Vault;
}

function privateHatch(ctx: CanvasRenderingContext2D) {
  ctx.save();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isPrivateTile(x, y) || L.solid[idx(x, y)]) continue;
      ctx.fillStyle = 'rgba(214,32,48,0.09)';
      ctx.fillRect(x, y, 1, 1);
      ctx.strokeStyle = 'rgba(214,32,48,0.26)';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      for (const k of [0, 0.5]) {
        ctx.moveTo(x + k, y + 1);
        ctx.lineTo(x + 1, y + k);
        ctx.moveTo(x, y + 1 - k);
        ctx.lineTo(x + 1 - k, y);
        ctx.moveTo(x + k, y);
        ctx.lineTo(x + 1, y + 1 - k);
        ctx.moveTo(x, y + k);
        ctx.lineTo(x + 1 - k, y + 1);
      }
      ctx.stroke();
    }
  }
  // 公開エリアとの境界（扉・カウンター）を赤い破線で縁取る
  ctx.strokeStyle = 'rgba(230,40,55,0.85)';
  ctx.lineWidth = 0.09;
  ctx.setLineDash([0.3, 0.18]);
  ctx.beginPath();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isPrivateTile(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = nx >= 0 && ny >= 0 && nx < W && ny < H ? L.zone[idx(nx, ny)] : Zone.Blocked;
        if (nz !== Zone.Public && nz !== Zone.Out) continue;
        if (dx === 1) (ctx.moveTo(x + 1, y), ctx.lineTo(x + 1, y + 1));
        if (dx === -1) (ctx.moveTo(x, y), ctx.lineTo(x, y + 1));
        if (dy === 1) (ctx.moveTo(x, y + 1), ctx.lineTo(x + 1, y + 1));
        if (dy === -1) (ctx.moveTo(x, y), ctx.lineTo(x + 1, y));
      }
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ---------------------------------------------------------------- 壁

function walls(ctx: CanvasRenderingContext2D) {
  const path = new Path2D();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (isWall(x, y)) path.rect(x - 0.005, y - 0.005, 1.01, 1.01);
  ctx.fillStyle = '#262a31';
  ctx.fill(path);
  // 断面のハッチ（図面の壁の表現）
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  for (let k = -H; k < W + H; k += 0.45) {
    ctx.moveTo(k, 0);
    ctx.lineTo(k + H, H);
  }
  ctx.stroke();
  ctx.restore();
  // 縁：床に面する辺を明るく、外側に濃い輪郭
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!isWall(x, y)) continue;
      const open = (dx: number, dy: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
        return tileMat(nx, ny) !== Mat.Wall;
      };
      if (open(0, -1)) {
        ctx.fillStyle = '#69717d';
        ctx.fillRect(x, y, 1, 0.06);
        ctx.fillStyle = INK;
        ctx.fillRect(x, y - 0.03, 1, 0.03);
      }
      if (open(0, 1)) {
        ctx.fillStyle = '#4a515c';
        ctx.fillRect(x, y + 0.94, 1, 0.06);
        ctx.fillStyle = INK;
        ctx.fillRect(x, y + 1, 1, 0.03);
      }
      if (open(-1, 0)) {
        ctx.fillStyle = '#5c646f';
        ctx.fillRect(x, y, 0.06, 1);
        ctx.fillStyle = INK;
        ctx.fillRect(x - 0.03, y, 0.03, 1);
      }
      if (open(1, 0)) {
        ctx.fillStyle = '#4a515c';
        ctx.fillRect(x + 0.94, y, 0.06, 1);
        ctx.fillStyle = INK;
        ctx.fillRect(x + 1, y, 0.03, 1);
      }
    }
  // ガラス：窓台・ガラス面・方立て
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (tileMat(x, y) !== Mat.Glass) continue;
      const horiz = tileMat(x - 1, y) === Mat.Glass || tileMat(x + 1, y) === Mat.Glass || tileMat(x - 1, y) === Mat.Wall;
      ctx.fillStyle = '#3a414b';
      ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = '#727b87';
      if (horiz) {
        ctx.fillRect(x, y + 0.28, 1, 0.08);
        ctx.fillRect(x, y + 0.64, 1, 0.08);
      } else {
        ctx.fillRect(x + 0.28, y, 0.08, 1);
        ctx.fillRect(x + 0.64, y, 0.08, 1);
      }
      ctx.fillStyle = 'rgba(150,210,235,0.75)';
      if (horiz) ctx.fillRect(x, y + 0.36, 1, 0.28);
      else ctx.fillRect(x + 0.36, y, 0.28, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      if (horiz) {
        ctx.moveTo(x + 0.2, y + 0.6);
        ctx.lineTo(x + 0.4, y + 0.4);
        ctx.moveTo(x + 0.35, y + 0.6);
        ctx.lineTo(x + 0.5, y + 0.45);
      } else {
        ctx.moveTo(x + 0.4, y + 0.2);
        ctx.lineTo(x + 0.6, y + 0.4);
        ctx.moveTo(x + 0.4, y + 0.35);
        ctx.lineTo(x + 0.55, y + 0.5);
      }
      ctx.stroke();
      ctx.fillStyle = INK;
      if (horiz) ctx.fillRect(x - 0.03, y + 0.28, 0.06, 0.44);
      else ctx.fillRect(x + 0.28, y - 0.03, 0.44, 0.06);
    }
}

function roomLabels(ctx: CanvasRenderingContext2D) {
  // 部屋名は北側の壁に表札として出す（家具と重ならない）
  ctx.save();
  for (const r of L.rooms) {
    const wy = r.y - 1;
    const text = `${r.en}  ${r.name}`;
    const need = r.en.length * 0.24 + r.name.length * 0.4 + 0.7;
    const runs: [number, number][] = [];
    let start = -1;
    for (let x = r.x - 1; x <= r.x + r.w + 1; x++) {
      if (isWall(x, wy) && x <= r.x + r.w) {
        if (start < 0) start = x;
      } else if (start >= 0) {
        runs.push([start, x]);
        start = -1;
      }
    }
    const mid = r.x + r.w / 2;
    const fits = runs.filter(([a, b]) => b - a >= need);
    const pool = fits.length ? fits : runs;
    if (!pool.length) continue;
    pool.sort((p, q) => Math.abs((p[0] + p[1]) / 2 - mid) - Math.abs((q[0] + q[1]) / 2 - mid) || q[1] - q[0] - (p[1] - p[0]));
    const [a, b] = pool[0]!;
    const cx = Math.min(Math.max(mid, a + need / 2), b - need / 2);
    const private_ = r.zone === Zone.Private || r.zone === Zone.Vault;
    ctx.fillStyle = '#1a1d23';
    ctx.beginPath();
    ctx.roundRect(cx - need / 2, wy + 0.2, need, 0.6, 0.06);
    ctx.fill();
    ctx.strokeStyle = private_ ? 'rgba(230,60,70,0.55)' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.035;
    ctx.stroke();
    ctx.fillStyle = 'rgba(230,234,240,0.78)';
    drawText(ctx, text, cx, wy + 0.66, '600 0.42px Oswald, "Noto Sans JP", sans-serif');
  }
  ctx.fillStyle = 'rgba(180,30,30,0.6)';
  drawText(ctx, '関係者以外立入禁止', 25, 23.9, '700 0.45px "Noto Sans JP", sans-serif');
  ctx.restore();
}

// ---------------------------------------------------------------- 家具

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 0.04) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x - 0.03, y - 0.03, w + 0.06, h + 0.06, r + 0.02);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function dropShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 0.28) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.roundRect(x + 0.1, y + 0.12, w, h, 0.08);
  ctx.fill();
}

function monitorAt(ctx: CanvasRenderingContext2D, cx: number, cy: number, facingDown: boolean, glow = '#7fb8d8') {
  // 薄型モニター：画面は職員側を向く
  const y = facingDown ? cy - 0.08 : cy;
  box(ctx, cx - 0.3, y, 0.6, 0.08, '#22272e', 0.02);
  ctx.fillStyle = glow;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(cx - 0.26, facingDown ? y + 0.06 : y, 0.52, 0.02);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#30353d';
  ctx.fillRect(cx - 0.07, facingDown ? y - 0.1 : y + 0.08, 0.14, 0.1);
}

function keyboard(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  box(ctx, cx - 0.2, cy - 0.05, 0.4, 0.1, '#d9dce0', 0.02);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let k = 0; k < 6; k++) ctx.fillRect(cx - 0.17 + k * 0.06, cy - 0.02, 0.04, 0.04);
  box(ctx, cx + 0.27, cy - 0.03, 0.06, 0.08, '#d9dce0', 0.03);
}

function paperSheet(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(-0.1, -0.13, 0.22, 0.28);
  ctx.fillStyle = '#f4f2ec';
  ctx.fillRect(-0.12, -0.15, 0.22, 0.28);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let k = 0; k < 4; k++) ctx.fillRect(-0.09, -0.1 + k * 0.05, 0.14 - (k % 2) * 0.04, 0.012);
  ctx.restore();
}

function mug(ctx: CanvasRenderingContext2D, x: number, y: number, c = '#e9e6df') {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x, y, 0.065, 0, TAU);
  ctx.fill();
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, 0.05, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4a2e1c';
  ctx.beginPath();
  ctx.arc(x, y, 0.033, 0, TAU);
  ctx.fill();
}

function plantTop(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number) {
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + seed * 6;
    const rr = r * (0.55 + hash(k, Math.floor(seed * 100), 3) * 0.45);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * rr * 0.5, cy + Math.sin(a) * rr * 0.5, rr * 0.62, rr * 0.26, a, 0, TAU);
    ctx.fill();
  }
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + seed * 6;
    const rr = r * (0.55 + hash(k, Math.floor(seed * 100), 3) * 0.45);
    ctx.fillStyle = k % 3 === 0 ? '#4f9a62' : k % 3 === 1 ? '#3b8150' : '#2d6a40';
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * rr * 0.5, cy + Math.sin(a) * rr * 0.5, rr * 0.55, rr * 0.2, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#5daa6f';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.18, 0, TAU);
  ctx.fill();
}

function furniture(ctx: CanvasRenderingContext2D, f: Furniture) {
  const { x, y, w, h } = f;
  ctx.save();
  switch (f.type) {
    case 'counter':
      counter(ctx, f);
      break;
    case 'desk':
      desk(ctx, f);
      break;
    case 'bench':
      dropShadow(ctx, x, y + 0.15, w, h - 0.3);
      if (y < 13) {
        // ロッカー室の木製ベンチ
        box(ctx, x + 0.05, y + 0.28, w - 0.1, h - 0.56, '#a77d52');
        ctx.fillStyle = 'rgba(60,35,15,0.35)';
        for (let k = 1; k < 4; k++) ctx.fillRect(x + 0.05, y + 0.28 + k * 0.11, w - 0.1, 0.015);
      } else {
        // ロビーの革張りベンチ
        box(ctx, x + 0.05, y + 0.18, w - 0.1, h - 0.36, '#2f3a46', 0.08);
        for (let k = 0; k < w; k++) {
          box(ctx, x + k + 0.1, y + 0.24, 0.8, h - 0.48, '#465566', 0.1);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(x + k + 0.16, y + 0.28, 0.68, 0.06);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.arc(x + k + 0.5, y + 0.5, 0.03, 0, TAU);
          ctx.fill();
        }
      }
      break;
    case 'plant': {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(x + 0.6, y + 0.62, 0.44, 0, TAU);
      ctx.fill();
      box(ctx, x + 0.18, y + 0.18, 0.64, 0.64, '#8d8478', 0.08);
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(x + 0.26, y + 0.26, 0.48, 0.48);
      plantTop(ctx, x + 0.5, y + 0.5, 0.48, hash(x, y));
      break;
    }
    case 'atm':
      dropShadow(ctx, x + 0.05, y + 0.05, w - 0.25, h - 0.1);
      box(ctx, x + 0.05, y + 0.06, w - 0.25, h - 0.12, '#2b3846', 0.05);
      ctx.fillStyle = '#c8333b';
      ctx.fillRect(x + 0.05, y + 0.06, 0.16, h - 0.12);
      // 画面・キーパッド（東向き）
      ctx.fillStyle = '#5ec8f2';
      ctx.fillRect(x + 0.58, y + 0.18, 0.12, 0.36);
      ctx.fillStyle = '#9aa6b2';
      ctx.fillRect(x + 0.42, y + 0.62, 0.22, 0.22);
      ctx.fillStyle = '#1b2129';
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) ctx.fillRect(x + 0.44 + a * 0.07, y + 0.64 + b * 0.07, 0.04, 0.04);
      ctx.fillStyle = '#e8b33c';
      ctx.fillRect(x + 0.32, y + 0.2, 0.05, 0.16);
      break;
    case 'pillar': {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(x + 0.62, y + 0.66, 0.6, 0, TAU);
      ctx.fill();
      box(ctx, x - 0.08, y - 0.08, 1.16, 1.16, '#d9d1c1', 0.04);
      const gr = ctx.createRadialGradient(x + 0.38, y + 0.36, 0.05, x + 0.5, y + 0.5, 0.48);
      gr.addColorStop(0, '#f6f1e6');
      gr.addColorStop(1, '#bdb3a0');
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.5, 0.47, 0, TAU);
      ctx.fill();
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.5, 0.44, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,108,88,0.35)';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.5, 0.34, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'locker': {
      dropShadow(ctx, x, y, w, h - 0.35);
      box(ctx, x + 0.02, y + 0.04, w - 0.04, h - 0.4, '#71808f', 0.02);
      for (let k = 0; k < w * 2; k++) {
        const lx = x + 0.02 + k * 0.5;
        ctx.fillStyle = k % 2 ? '#6a7987' : '#788796';
        ctx.fillRect(lx + 0.02, y + 0.06, 0.46, h - 0.44);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(lx, y + 0.04, 0.02, h - 0.4);
        for (let v = 0; v < 3; v++) ctx.fillRect(lx + 0.12, y + 0.12 + v * 0.05, 0.26, 0.018);
        ctx.fillStyle = '#c9ced4';
        ctx.fillRect(lx + 0.34, y + h - 0.5, 0.08, 0.04);
      }
      break;
    }
    case 'shelf':
      shelf(ctx, f);
      break;
    case 'crate': {
      dropShadow(ctx, x + 0.05, y + 0.05, w - 0.1, h - 0.1);
      box(ctx, x + 0.06, y + 0.06, w - 0.12, h - 0.12, '#a57c4a', 0.02);
      ctx.fillStyle = 'rgba(70,45,20,0.35)';
      const n = Math.round(w * 4);
      for (let k = 1; k < n; k++) ctx.fillRect(x + 0.06 + ((w - 0.12) * k) / n, y + 0.06, 0.02, h - 0.12);
      ctx.strokeStyle = '#7a5a33';
      ctx.lineWidth = 0.09;
      ctx.strokeRect(x + 0.12, y + 0.12, w - 0.24, h - 0.24);
      ctx.beginPath();
      ctx.moveTo(x + 0.14, y + 0.14);
      ctx.lineTo(x + w - 0.14, y + h - 0.14);
      ctx.stroke();
      if (w > 1) {
        ctx.fillStyle = 'rgba(20,20,20,0.5)';
        drawText(ctx, 'FRAGILE', x + w / 2, y + h - 0.25, '600 0.22px Oswald, sans-serif');
      }
      break;
    }
    case 'sofa': {
      const vertical = h > w;
      dropShadow(ctx, x, y, w, h);
      box(ctx, x + 0.05, y + 0.05, w - 0.1, h - 0.1, '#6e4049', 0.1);
      if (vertical) {
        // 背もたれは東（壁側）
        ctx.fillStyle = '#5a333b';
        ctx.fillRect(x + w - 0.32, y + 0.08, 0.26, h - 0.16);
        for (let k = 0; k < h; k++) box(ctx, x + 0.12, y + k + 0.18, w - 0.48, 0.66, '#8a5560', 0.08);
        ctx.fillStyle = '#5a333b';
        ctx.fillRect(x + 0.08, y + 0.06, w - 0.16, 0.14);
        ctx.fillRect(x + 0.08, y + h - 0.2, w - 0.16, 0.14);
      } else {
        ctx.fillStyle = '#4e4e56';
        ctx.fillRect(x + 0.08, y + h - 0.32, w - 0.16, 0.26);
        for (let k = 0; k < w; k++) box(ctx, x + k + 0.18, y + 0.12, 0.66, h - 0.48, '#6a6a74', 0.08);
        ctx.fillStyle = '#4e4e56';
        ctx.fillRect(x + 0.06, y + 0.08, 0.14, h - 0.16);
        ctx.fillRect(x + w - 0.2, y + 0.08, 0.14, h - 0.16);
      }
      break;
    }
    case 'vending': {
      dropShadow(ctx, x, y, w, h);
      box(ctx, x + 0.05, y + 0.04, w - 0.1, h - 0.08, '#b9333a', 0.04);
      ctx.fillStyle = '#e9edf0';
      ctx.fillRect(x + 0.12, y + 0.14, 0.28, h - 0.6);
      const cols = ['#d6453d', '#3a7bd5', '#f2c14e', '#4caf6a', '#e07a2e'];
      for (let r = 0; r < 6; r++)
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = cols[(r * 2 + c) % cols.length]!;
          ctx.fillRect(x + 0.15 + c * 0.12, y + 0.18 + r * 0.22, 0.08, 0.14);
        }
      ctx.fillStyle = '#1b1d22';
      ctx.fillRect(x + 0.12, y + h - 0.4, 0.28, 0.2);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(x + 0.62, y + 0.3, 0.16, 0.06);
      break;
    }
    case 'monitor': {
      // 監視卓：南向きのモニター列
      dropShadow(ctx, x, y, w, h);
      box(ctx, x + 0.02, y + 0.3, w - 0.04, h - 0.32, '#3a4049', 0.03);
      ctx.fillStyle = '#2e333b';
      ctx.fillRect(x + 0.05, y + 0.72, w - 0.1, 0.22);
      for (let k = 0; k < w; k++) {
        box(ctx, x + k + 0.08, y + 0.04, 0.84, 0.24, '#1c2026', 0.02);
        const feed = ['#3fb3d9', '#4fd08f', '#8fa7c9', '#d9c24f'][k % 4]!;
        ctx.fillStyle = feed;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x + k + 0.12, y + 0.22, 0.76, 0.05);
        ctx.globalAlpha = 1;
        keyboard(ctx, x + k + 0.45, y + 0.55);
      }
      mug(ctx, x + 0.25, y + 0.84, '#c8333b');
      break;
    }
    case 'deposit': {
      ctx.fillStyle = INK;
      ctx.fillRect(x - 0.02, y - 0.02, w + 0.04, h + 0.04);
      const gr = ctx.createLinearGradient(x, y, x + w, y + h);
      gr.addColorStop(0, '#b4bac1');
      gr.addColorStop(1, '#8c939b');
      ctx.fillStyle = gr;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(50,55,62,0.55)';
      ctx.lineWidth = 0.02;
      for (let a = 0; a < w - 0.01; a += 0.33)
        for (let b = 0; b < h - 0.01; b += 0.33) {
          ctx.strokeRect(x + a + 0.02, y + b + 0.02, 0.29, 0.29);
          ctx.fillStyle = '#d6b85a';
          ctx.fillRect(x + a + 0.15, y + b + 0.14, 0.04, 0.04);
        }
      break;
    }
    case 'dumpster': {
      dropShadow(ctx, x, y, w, h);
      box(ctx, x + 0.05, y + 0.08, w - 0.1, h - 0.16, '#2f6046', 0.05);
      ctx.fillStyle = '#25503a';
      ctx.fillRect(x + 0.1, y + 0.13, w / 2 - 0.12, h - 0.26);
      ctx.fillStyle = '#336a4d';
      ctx.fillRect(x + w / 2 + 0.02, y + 0.13, w / 2 - 0.12, h - 0.26);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      drawText(ctx, 'WASTE', x + w / 2, y + 0.62, '600 0.22px Oswald, sans-serif');
      break;
    }
    case 'kiosk': {
      // 番号札の発券機と記入台
      dropShadow(ctx, x, y, w, h);
      box(ctx, x + 0.1, y + 0.12, w - 0.2, h - 0.24, '#e8e5de', 0.05);
      ctx.fillStyle = '#c8333b';
      ctx.fillRect(x + 0.1, y + 0.12, w - 0.2, 0.12);
      box(ctx, x + 0.25, y + 0.32, 0.5, 0.36, '#2c3540', 0.03);
      ctx.fillStyle = '#5ec8f2';
      ctx.fillRect(x + 0.3, y + 0.37, 0.4, 0.18);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      drawText(ctx, '042', x + 0.5, y + 0.52, '700 0.14px Oswald, sans-serif');
      paperSheet(ctx, x + 1.2, y + 0.5, 0.2);
      paperSheet(ctx, x + 1.5, y + 0.48, -0.15);
      ctx.fillStyle = '#1b1d22';
      ctx.fillRect(x + 1.0, y + 0.72, 0.6, 0.03);
      break;
    }
    case 'table': {
      dropShadow(ctx, x, y, w, h);
      box(ctx, x + 0.12, y + 0.12, w - 0.24, h - 0.24, '#9a7652', 0.1);
      ctx.strokeStyle = 'rgba(70,45,20,0.25)';
      ctx.lineWidth = 0.015;
      for (let k = 0.3; k < h - 0.2; k += 0.18) {
        ctx.beginPath();
        ctx.moveTo(x + 0.2, y + k);
        ctx.lineTo(x + w - 0.2, y + k);
        ctx.stroke();
      }
      mug(ctx, x + 0.7, y + 0.6);
      mug(ctx, x + 2.2, y + 1.3, '#d6453d');
      ctx.fillStyle = '#f2efe8';
      ctx.beginPath();
      ctx.arc(x + 1.5, y + 1.0, 0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#e2a640';
      ctx.beginPath();
      ctx.arc(x + 1.5, y + 1.0, 0.1, 0, TAU);
      ctx.fill();
      paperSheet(ctx, x + 1.0, y + 1.4, 0.4);
      break;
    }
    case 'gold':
      break;
  }
  ctx.restore();
}

function counter(ctx: CanvasRenderingContext2D, f: Furniture) {
  // 窓口カウンター：北が職員側、南が客側。窓口ごとに仕切りガラスと番号札
  const { x, y, w } = f;
  dropShadow(ctx, x, y + 0.05, w, 0.9, 0.25);
  box(ctx, x, y + 0.06, w, 0.88, '#6d4730', 0.02);
  ctx.fillStyle = '#8c5f3f';
  ctx.fillRect(x, y + 0.08, w, 0.34);
  ctx.fillStyle = '#e4ddcf';
  ctx.fillRect(x, y + 0.58, w, 0.34);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, y + 0.56, w, 0.03);
  // ガラスの仕切り
  ctx.fillStyle = 'rgba(160,215,235,0.75)';
  ctx.fillRect(x, y + 0.47, w, 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(x, y + 0.47, w, 0.015);
  L.tellerSpots.forEach((p, i) => {
    const cx = p.x;
    // 窓口の切れ目と端末
    ctx.fillStyle = '#e4ddcf';
    ctx.fillRect(cx - 0.35, y + 0.47, 0.7, 0.07);
    ctx.fillStyle = INK;
    ctx.fillRect(cx - 1.9, y + 0.4, 0.08, 0.22);
    monitorAt(ctx, cx - 0.45, y + 0.12, false);
    keyboard(ctx, cx + 0.15, y + 0.3);
    // 番号札
    box(ctx, cx - 0.14, y + 0.66, 0.28, 0.2, '#1f3557', 0.02);
    ctx.fillStyle = '#fff';
    drawText(ctx, String(i + 1), cx, y + 0.83, '700 0.18px Oswald, sans-serif');
    paperSheet(ctx, cx + 0.5, y + 0.74, 0.15 * (i % 2 ? 1 : -1));
  });
  ctx.fillStyle = INK;
  ctx.fillRect(x + w - 0.08, y + 0.4, 0.08, 0.22);
}

function desk(ctx: CanvasRenderingContext2D, f: Furniture) {
  const { x, y, w, h } = f;
  const face = f.face ?? 's';
  const manager = x >= 54 && x < 60 && y >= 17 && y < 22;
  const staffY = face === 's' ? y + h : y; // 職員が座る辺
  dropShadow(ctx, x + 0.05, y + 0.08, w - 0.1, h - 0.16);
  if (manager) {
    // 支店長のデスク：濃い木目と革のデスクマット
    box(ctx, x + 0.04, y + 0.06, w - 0.08, h - 0.12, '#5a3a26', 0.04);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.015;
    for (let k = 0.18; k < h - 0.1; k += 0.14) {
      ctx.beginPath();
      ctx.moveTo(x + 0.08, y + k);
      ctx.lineTo(x + w - 0.08, y + k + 0.02);
      ctx.stroke();
    }
    box(ctx, x + 0.9, y + 0.4, 1.2, 0.42, '#2a3b33', 0.03);
    monitorAt(ctx, x + 1.5, y + 0.2, false);
    keyboard(ctx, x + 1.45, y + 0.62);
    // 卓上ランプ・電話・名札
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + 0.35, y + 0.35, 0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2f6b4a';
    ctx.beginPath();
    ctx.arc(x + 0.35, y + 0.35, 0.13, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f5e2a0';
    ctx.beginPath();
    ctx.arc(x + 0.35, y + 0.35, 0.05, 0, TAU);
    ctx.fill();
    box(ctx, x + 2.45, y + 0.25, 0.3, 0.22, '#1b1d22', 0.03);
    ctx.fillStyle = '#d8b24a';
    ctx.fillRect(x + 2.3, y + 0.72, 0.5, 0.08);
    paperSheet(ctx, x + 0.5, y + 0.7, -0.3);
    mug(ctx, x + 2.75, y + 0.65);
    return;
  }
  box(ctx, x + 0.04, y + 0.06, w - 0.08, h - 0.12, '#d6cbb5', 0.03);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x + 0.04, face === 's' ? y + 0.06 : y + h - 0.12, w - 0.08, 0.06);
  // 机の継ぎ目（1人分ずつ）
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let k = 1; k < w; k++) ctx.fillRect(x + k, y + 0.06, 0.015, h - 0.12);
  const s = face === 's' ? 1 : -1;
  const cx = x + w / 2;
  const back = staffY - s * 0.78;
  monitorAt(ctx, cx, back, face === 'n');
  keyboard(ctx, cx, staffY - s * 0.32);
  monitorAt(ctx, cx - 1, back, face === 'n', '#9ad0a8');
  paperSheet(ctx, x + w - 0.45, y + 0.48, 0.3 * s);
  paperSheet(ctx, x + w - 0.5, y + 0.46, -0.1);
  mug(ctx, x + 0.3, staffY - s * 0.3);
}

function shelf(ctx: CanvasRenderingContext2D, f: Furniture) {
  const { x, y, w, h } = f;
  dropShadow(ctx, x, y, w, h);
  if (y < 10) {
    // 金庫の棚：鋼製ラックに延べ棒
    box(ctx, x + 0.02, y + 0.04, w - 0.04, h - 0.1, '#5d646d', 0.02);
    ctx.fillStyle = '#3e444c';
    for (let k = 0; k <= w; k += 2) ctx.fillRect(x + k - 0.04, y + 0.04, 0.08, h - 0.1);
    for (let k = 0; k < w * 2; k++) {
      const bx = x + 0.1 + k * 0.5;
      for (let r = 0; r < 2; r++) {
        const gr = ctx.createLinearGradient(bx, y + 0.15 + r * 0.36, bx + 0.32, y + 0.45 + r * 0.36);
        gr.addColorStop(0, '#ffe08a');
        gr.addColorStop(0.5, '#e2b437');
        gr.addColorStop(1, '#a87b16');
        ctx.fillStyle = gr;
        ctx.fillRect(bx, y + 0.14 + r * 0.36, 0.32, 0.28);
        ctx.strokeStyle = 'rgba(110,80,10,0.8)';
        ctx.lineWidth = 0.015;
        ctx.strokeRect(bx, y + 0.14 + r * 0.36, 0.32, 0.28);
      }
    }
    return;
  }
  box(ctx, x + 0.02, y + 0.04, w - 0.04, h - 0.1, '#5b4636', 0.02);
  if (h > w) {
    // 縦長の本棚（壁沿い）
    for (let k = 0; k < h * 7; k++) {
      ctx.fillStyle = ['#8a3b33', '#2f4f7a', '#c9b06a', '#3f6a48', '#6b4e8a'][k % 5]!;
      ctx.fillRect(x + 0.12 + (k % 3) * 0.04, y + 0.1 + k * 0.13, 0.62 - (k % 3) * 0.08, 0.1);
    }
  } else {
    // ファイル棚
    for (let k = 0; k < w * 8; k++) {
      ctx.fillStyle = ['#d8c27a', '#3d6a8a', '#a14b3b', '#e8e4da'][k % 4]!;
      ctx.fillRect(x + 0.1 + k * 0.23, y + 0.14, 0.18, 0.54 - (k % 3) * 0.06);
    }
  }
}

// ---------------------------------------------------------------- 小物

const FLOOR_DECOR = new Set<Decor['type']>(['rug', 'runner', 'emblem', 'inlay', 'mat', 'hazard', 'lane', 'oil', 'puddle', 'manhole', 'drain', 'parking', 'helipad']);

function chairShape(ctx: CanvasRenderingContext2D, color: string, wide: number) {
  // 原点が座面中心、+x が座る人の正面
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(0.04, 0.05, wide + 0.04, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2a2e35';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    ctx.fillRect(Math.cos(a) * 0.2 - 0.025, Math.sin(a) * 0.2 - 0.025, 0.05, 0.05);
  }
  box(ctx, -wide * 0.7, -wide, wide * 1.6, wide * 2, color, 0.08);
  box(ctx, -wide * 0.95, -wide * 0.95, 0.12, wide * 1.9, shade(color, 0.75), 0.05);
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function decor(ctx: CanvasRenderingContext2D, d: Decor) {
  const { x, y } = d;
  const w = d.w ?? 1;
  const h = d.h ?? 1;
  ctx.save();
  switch (d.type) {
    case 'rug': {
      const c = d.color ?? '#5d4a3c';
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 0.05, y + 0.06, w, h);
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = shade(c, 1.35);
      ctx.lineWidth = 0.08;
      ctx.strokeRect(x + 0.2, y + 0.2, w - 0.4, h - 0.4);
      ctx.strokeStyle = shade(c, 0.7);
      ctx.lineWidth = 0.04;
      ctx.strokeRect(x + 0.32, y + 0.32, w - 0.64, h - 0.64);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let k = 0; k < w; k += 0.1) ctx.fillRect(x + k, y, 0.03, h);
      break;
    }
    case 'runner': {
      ctx.fillStyle = d.color ?? '#8a2a33';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#d8b24a';
      ctx.fillRect(x + 0.12, y, 0.06, h);
      ctx.fillRect(x + w - 0.18, y, 0.06, h);
      break;
    }
    case 'inlay': {
      ctx.strokeStyle = '#5f6f68';
      ctx.lineWidth = 0.2;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = '#b39b6a';
      ctx.lineWidth = 0.035;
      ctx.strokeRect(x + 0.17, y + 0.17, w - 0.34, h - 0.34);
      break;
    }
    case 'emblem': {
      // 床の紋章：コンパス（ハーバーライト銀行）
      const r = w;
      disc(ctx, x, y, r, '#5f6f68');
      disc(ctx, x, y, r - 0.16, '#ece6d8');
      ctx.strokeStyle = '#b39b6a';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.arc(x, y, r - 0.3, 0, TAU);
      ctx.stroke();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU - Math.PI / 2;
        const len = k % 2 ? r * 0.55 : r * 0.82;
        ctx.fillStyle = k % 2 ? '#b39b6a' : '#5f6f68';
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.lineTo(x + Math.cos(a + 0.35) * 0.18, y + Math.sin(a + 0.35) * 0.18);
        ctx.lineTo(x + Math.cos(a - 0.35) * 0.18, y + Math.sin(a - 0.35) * 0.18);
        ctx.closePath();
        ctx.fill();
      }
      disc(ctx, x, y, 0.16, '#d8b24a');
      break;
    }
    case 'mat': {
      box(ctx, x, y, w, h, '#2b2f36', 0.06);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let k = 0.1; k < w - 0.1; k += 0.12) ctx.fillRect(x + k, y + 0.1, 0.05, h - 0.2);
      ctx.fillStyle = 'rgba(216,178,74,0.75)';
      drawText(ctx, 'HARBORLIGHT BANK', x + w / 2, y + h / 2 + 0.12, '600 0.32px Oswald, sans-serif');
      break;
    }
    case 'hazard': {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.fillStyle = '#e2b93b';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#1b1d22';
      for (let k = -h; k < w; k += 0.4) {
        ctx.beginPath();
        ctx.moveTo(x + k, y + h);
        ctx.lineTo(x + k + 0.2, y + h);
        ctx.lineTo(x + k + 0.2 + h, y);
        ctx.lineTo(x + k + h, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x, y, w, h);
      break;
    }
    case 'lane': {
      ctx.fillStyle = d.color ?? 'rgba(232,196,72,0.85)';
      ctx.globalAlpha = 0.8;
      for (let k = 0; k < h; k += 0.5) ctx.fillRect(x - 0.04, y + k, 0.08, 0.3);
      break;
    }
    case 'oil': {
      ctx.fillStyle = 'rgba(20,20,24,0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.5, w * 0.32, hash(Math.round(x), Math.round(y)) * 3, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w * 0.3, y + 0.15, w * 0.18, w * 0.12, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'puddle': {
      const gr = ctx.createRadialGradient(x - 0.1, y - 0.1, 0.05, x, y, w * 0.6);
      gr.addColorStop(0, 'rgba(150,175,200,0.35)');
      gr.addColorStop(1, 'rgba(60,75,95,0.25)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.6, w * 0.38, hash(Math.round(x), Math.round(y)) * 2, 0, TAU);
      ctx.ellipse(x + w * 0.35, y + 0.12, w * 0.3, w * 0.2, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'manhole': {
      disc(ctx, x, y, 0.4, INK);
      disc(ctx, x, y, 0.36, '#4b4f55');
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.03;
      for (let k = -0.24; k <= 0.24; k += 0.12) {
        const half = Math.sqrt(0.36 * 0.36 - k * k) * 0.85;
        ctx.beginPath();
        ctx.moveTo(x - half, y + k);
        ctx.lineTo(x + half, y + k);
        ctx.stroke();
      }
      break;
    }
    case 'drain': {
      box(ctx, x - 0.35, y - 0.2, 0.7, 0.24, '#2b2e33', 0.02);
      ctx.fillStyle = '#0d0f12';
      for (let k = 0; k < 6; k++) ctx.fillRect(x - 0.3 + k * 0.105, y - 0.16, 0.05, 0.16);
      break;
    }
    case 'parking': {
      ctx.strokeStyle = 'rgba(240,240,240,0.55)';
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
      break;
    }
    case 'helipad': {
      const r = w;
      disc(ctx, x, y, r + 0.3, '#4a5058');
      ctx.strokeStyle = '#e2b93b';
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240,240,240,0.85)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(x, y, r - 0.35, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,240,240,0.9)';
      ctx.fillRect(x - 0.8, y - 1.1, 0.35, 2.2);
      ctx.fillRect(x + 0.45, y - 1.1, 0.35, 2.2);
      ctx.fillRect(x - 0.45, y - 0.17, 0.9, 0.34);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        disc(ctx, x + Math.cos(a) * (r + 0.15), y + Math.sin(a) * (r + 0.15), 0.07, '#7fd36b');
      }
      break;
    }
    case 'chair':
      ctx.translate(x, y);
      ctx.rotate(d.rot ?? 0);
      chairShape(ctx, '#3a414c', 0.2);
      break;
    case 'armchair':
      ctx.translate(x, y);
      ctx.rotate(d.rot ?? 0);
      chairShape(ctx, '#6e4049', 0.28);
      break;
    case 'stool':
      disc(ctx, x + 0.04, y + 0.05, 0.2, 'rgba(0,0,0,0.25)');
      disc(ctx, x, y, 0.17, INK);
      disc(ctx, x, y, 0.14, '#4a5260');
      break;
    case 'stall': {
      // 個室：左右の仕切りと便器（北の壁際）
      ctx.fillStyle = '#8b97a3';
      ctx.fillRect(x, y, 0.07, h);
      ctx.fillRect(x + w - 0.07, y, 0.07, h);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 0.02, y, 0.02, h);
      ctx.fillRect(x + w, y, 0.02, h);
      ctx.strokeStyle = 'rgba(80,90,100,0.4)';
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.arc(x + 0.07, y + h, w - 0.14, -Math.PI / 2, 0);
      ctx.stroke();
      const cx = x + w / 2;
      box(ctx, cx - 0.2, y + 0.04, 0.4, 0.18, '#f2f4f6', 0.04);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(cx, y + 0.42, 0.18, 0.24, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f2f4f6';
      ctx.beginPath();
      ctx.ellipse(cx, y + 0.42, 0.155, 0.215, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#c9d6dd';
      ctx.beginPath();
      ctx.ellipse(cx, y + 0.45, 0.09, 0.13, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case 'sink': {
      box(ctx, x - 0.3, y - 0.22, 0.6, 0.42, '#e8ecef', 0.06);
      ctx.fillStyle = '#c3cfd6';
      ctx.beginPath();
      ctx.ellipse(x, y + 0.02, 0.2, 0.13, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#8a949e';
      ctx.fillRect(x - 0.03, y - 0.2, 0.06, 0.12);
      ctx.fillStyle = 'rgba(200,230,245,0.6)'; // 鏡
      ctx.fillRect(x - 0.32, y - 0.27, 0.64, 0.04);
      break;
    }
    case 'bin':
      disc(ctx, x + 0.04, y + 0.05, 0.18, 'rgba(0,0,0,0.25)');
      disc(ctx, x, y, 0.17, INK);
      disc(ctx, x, y, 0.145, '#5f6872');
      disc(ctx, x, y, 0.1, '#2b3036');
      ctx.fillStyle = '#e8e4da';
      ctx.fillRect(x - 0.05, y - 0.04, 0.08, 0.06);
      break;
    case 'papers':
      paperSheet(ctx, x, y, 0.4);
      paperSheet(ctx, x + 0.15, y + 0.06, -0.5);
      break;
    case 'extinguisher':
      disc(ctx, x, y, 0.12, INK);
      disc(ctx, x, y, 0.095, '#d0303a');
      ctx.fillStyle = '#1b1d22';
      ctx.fillRect(x - 0.02, y - 0.02, 0.16, 0.04);
      break;
    case 'wetsign': {
      ctx.translate(x, y);
      ctx.rotate(0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-0.18, -0.1, 0.4, 0.3);
      box(ctx, -0.2, -0.14, 0.4, 0.28, '#f2c94c', 0.03);
      ctx.fillStyle = '#1b1d22';
      ctx.beginPath();
      ctx.moveTo(0, -0.09);
      ctx.lineTo(0.08, 0.07);
      ctx.lineTo(-0.08, 0.07);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'cooler':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 0.18, y - 0.16, 0.44, 0.44);
      box(ctx, x - 0.22, y - 0.22, 0.44, 0.44, '#e8ecef', 0.05);
      disc(ctx, x, y, 0.17, INK);
      disc(ctx, x, y, 0.15, 'rgba(110,180,230,0.85)');
      disc(ctx, x - 0.05, y - 0.05, 0.05, 'rgba(255,255,255,0.55)');
      break;
    case 'kitchen': {
      box(ctx, x, y, w, h, '#c9ccd0', 0.02);
      ctx.fillStyle = '#b0b4b9';
      ctx.fillRect(x, y + h - 0.08, w, 0.08);
      // シンク・電子レンジ・コーヒーメーカー
      box(ctx, x + 0.4, y + 0.1, 0.7, 0.4, '#9aa3ac', 0.06);
      ctx.fillStyle = '#7b848d';
      ctx.fillRect(x + 0.48, y + 0.16, 0.54, 0.28);
      box(ctx, x + 1.6, y + 0.06, 0.8, 0.46, '#2b2f36', 0.03);
      ctx.fillStyle = '#4a5a68';
      ctx.fillRect(x + 1.66, y + 0.12, 0.52, 0.34);
      box(ctx, x + 2.9, y + 0.08, 0.36, 0.4, '#1b1d22', 0.04);
      ctx.fillStyle = '#c8333b';
      ctx.fillRect(x + 3.0, y + 0.36, 0.06, 0.06);
      mug(ctx, x + 3.5, y + 0.3);
      mug(ctx, x + 3.75, y + 0.36, '#3a7bd5');
      paperSheet(ctx, x + 4.3, y + 0.3, 0.2);
      break;
    }
    case 'coffeetable':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 0.06, y + 0.07, w, h);
      box(ctx, x, y, w, h, '#6b513a', 0.05);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 0.05, y + 0.05, w - 0.1, 0.04);
      paperSheet(ctx, x + 0.5, y + h / 2, -0.4);
      mug(ctx, x + 1.3, y + h / 2);
      break;
    case 'mop':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x - 0.2, y - 0.15, 0.46, 0.38);
      box(ctx, x - 0.24, y - 0.2, 0.44, 0.36, '#e2b93b', 0.06);
      ctx.fillStyle = '#5f7f95';
      ctx.fillRect(x - 0.18, y - 0.14, 0.32, 0.24);
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(x - 0.05, y - 0.02);
      ctx.lineTo(x + 0.4, y - 0.4);
      ctx.stroke();
      break;
    case 'pallet': {
      ctx.translate(x, y);
      ctx.rotate(d.rot ?? 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-0.55, -0.5, 1.2, 1.1);
      for (let k = 0; k < 5; k++) box(ctx, -0.6, -0.55 + k * 0.24, 1.2, 0.14, '#b08a58', 0.01);
      // 上に積んだ段ボール
      box(ctx, -0.45, -0.45, 0.55, 0.45, '#b98d5a', 0.02);
      box(ctx, 0.12, -0.4, 0.4, 0.4, '#c49a66', 0.02);
      box(ctx, -0.3, 0.06, 0.6, 0.38, '#ad8250', 0.02);
      ctx.fillStyle = 'rgba(80,55,25,0.45)';
      ctx.fillRect(-0.45, -0.25, 0.55, 0.03);
      ctx.fillRect(-0.3, 0.23, 0.6, 0.03);
      break;
    }
    case 'palletjack':
      ctx.translate(x, y);
      ctx.rotate(d.rot ?? 0);
      ctx.fillStyle = '#d24d33';
      ctx.fillRect(-0.6, -0.3, 0.9, 0.12);
      ctx.fillRect(-0.6, 0.18, 0.9, 0.12);
      box(ctx, 0.25, -0.32, 0.22, 0.64, '#d24d33', 0.04);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(0.47, 0);
      ctx.lineTo(0.85, 0);
      ctx.stroke();
      box(ctx, 0.8, -0.12, 0.08, 0.24, '#1b1d22', 0.02);
      break;
    case 'forklift': {
      ctx.translate(x, y);
      ctx.rotate(d.rot ?? 0);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(-0.85, -0.55, 1.9, 1.25);
      ctx.fillStyle = '#1b1d22';
      for (const [wx, wy] of [
        [-0.55, -0.62],
        [-0.55, 0.48],
        [0.45, -0.62],
        [0.45, 0.48],
      ] as const)
        ctx.fillRect(wx, wy, 0.36, 0.14);
      box(ctx, -0.8, -0.5, 1.5, 1.0, '#e2a92b', 0.1);
      box(ctx, -0.75, -0.42, 0.45, 0.84, '#3a3f47', 0.05); // カウンターウェイト
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.06;
      ctx.strokeRect(-0.25, -0.42, 0.75, 0.84); // 屋根の枠
      ctx.beginPath();
      ctx.moveTo(-0.25, -0.42);
      ctx.lineTo(0.5, 0.42);
      ctx.moveTo(0.5, -0.42);
      ctx.lineTo(-0.25, 0.42);
      ctx.stroke();
      ctx.fillStyle = '#5a5f66';
      ctx.fillRect(0.7, -0.45, 0.1, 0.9);
      ctx.fillStyle = '#7a7f86';
      ctx.fillRect(0.8, -0.35, 0.65, 0.1);
      ctx.fillRect(0.8, 0.25, 0.65, 0.1);
      break;
    }
    case 'boxes': {
      const s = w;
      box(ctx, x, y, s * 0.55, s * 0.5, '#b98d5a', 0.02);
      box(ctx, x + s * 0.45, y + s * 0.25, s * 0.45, s * 0.4, '#c49a66', 0.02);
      ctx.fillStyle = 'rgba(80,55,25,0.45)';
      ctx.fillRect(x, y + s * 0.22, s * 0.55, 0.03);
      ctx.fillRect(x + s * 0.45, y + s * 0.43, s * 0.45, 0.03);
      break;
    }
    case 'trash':
      for (const [dx, dy, r, c] of [
        [0, 0, 0.26, '#22262b'],
        [0.3, 0.12, 0.2, '#2c3138'],
        [-0.15, 0.22, 0.18, '#3a4048'],
      ] as const) {
        disc(ctx, x + dx, y + dy, r + 0.03, INK);
        disc(ctx, x + dx, y + dy, r, c);
        disc(ctx, x + dx - r * 0.3, y + dy - r * 0.3, r * 0.3, 'rgba(255,255,255,0.12)');
      }
      break;
    case 'ac':
      box(ctx, x - 0.35, y, 0.7, 0.38, '#b8bec5', 0.03);
      disc(ctx, x, y + 0.19, 0.14, INK);
      ctx.strokeStyle = '#7b828a';
      ctx.lineWidth = 0.02;
      ctx.beginPath();
      ctx.moveTo(x - 0.12, y + 0.19);
      ctx.lineTo(x + 0.12, y + 0.19);
      ctx.moveTo(x, y + 0.07);
      ctx.lineTo(x, y + 0.31);
      ctx.stroke();
      break;
    case 'lamp': {
      // 街灯：柱と車道側へ伸びる腕
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 0.05, y + 0.05, 0.12, 0.9);
      disc(ctx, x, y, 0.13, INK);
      disc(ctx, x, y, 0.1, '#5a616b');
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(x - 0.03, y, 0.06, 0.75);
      box(ctx, x - 0.12, y + 0.7, 0.24, 0.32, '#3a3f47', 0.05);
      ctx.fillStyle = '#ffe3a8';
      ctx.fillRect(x - 0.07, y + 0.76, 0.14, 0.2);
      break;
    }
    case 'tree': {
      ctx.fillStyle = '#3a3a36';
      ctx.fillRect(x - 0.42, y - 0.42, 0.84, 0.84);
      ctx.strokeStyle = '#6a6a64';
      ctx.lineWidth = 0.03;
      for (let k = -0.3; k <= 0.3; k += 0.15) {
        ctx.beginPath();
        ctx.moveTo(x - 0.4, y + k);
        ctx.lineTo(x + 0.4, y + k);
        ctx.stroke();
      }
      // 樹冠：丸い葉のかたまりを重ねる
      const seed = hash(Math.round(x * 10), Math.round(y * 10), 9);
      disc(ctx, x + 0.14, y + 0.18, 0.68, 'rgba(0,0,0,0.25)');
      const blobs: [number, number, number][] = [];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + seed * 6;
        blobs.push([x + Math.cos(a) * 0.36, y + Math.sin(a) * 0.36, 0.3 + hash(k, Math.round(seed * 1000), 4) * 0.1]);
      }
      blobs.push([x, y, 0.36]);
      ctx.globalAlpha = 0.94;
      for (const [bx, by, r] of blobs) disc(ctx, bx, by, r + 0.035, INK);
      for (const [bx, by, r] of blobs) disc(ctx, bx, by, r, '#3f7d4c');
      for (const [bx, by, r] of blobs) disc(ctx, bx - r * 0.25, by - r * 0.28, r * 0.6, '#58995f');
      for (const [bx, by, r] of blobs) disc(ctx, bx - r * 0.35, by - r * 0.4, r * 0.25, 'rgba(160,210,140,0.5)');
      break;
    }
    case 'bollard':
      disc(ctx, x + 0.04, y + 0.05, 0.13, 'rgba(0,0,0,0.3)');
      disc(ctx, x, y, 0.13, INK);
      disc(ctx, x, y, 0.1, '#5f6670');
      disc(ctx, x, y, 0.045, '#e2b93b');
      break;
    case 'busstop':
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 0.08, y + 0.08, w, 0.62);
      box(ctx, x, y, w, 0.62, 'rgba(150,200,225,0.45)', 0.03);
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(x, y, w, 0.08);
      ctx.fillRect(x, y, 0.08, 0.62);
      ctx.fillRect(x + w - 0.08, y, 0.08, 0.62);
      box(ctx, x + 0.3, y + 0.14, w - 0.6, 0.2, '#6b513a', 0.02);
      box(ctx, x + w + 0.15, y + 0.2, 0.22, 0.22, '#1f6fb2', 0.11);
      ctx.fillStyle = '#fff';
      drawText(ctx, 'BUS', x + w + 0.26, y + 0.35, '700 0.11px Oswald, sans-serif');
      break;
    case 'bikerack':
      ctx.strokeStyle = '#8a929c';
      ctx.lineWidth = 0.05;
      for (let k = 0; k < w; k += 0.6) {
        ctx.beginPath();
        ctx.moveTo(x + k, y - 0.3);
        ctx.lineTo(x + k, y + 0.3);
        ctx.stroke();
      }
      // 自転車2台
      for (const bx of [x + 0.3, x + 1.5]) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(bx, y - 0.45);
        ctx.lineTo(bx, y + 0.45);
        ctx.stroke();
        ctx.strokeStyle = bx < x + 1 ? '#3a7bd5' : '#c8333b';
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.moveTo(bx, y - 0.25);
        ctx.lineTo(bx, y + 0.25);
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.fillRect(bx - 0.14, y - 0.3, 0.28, 0.04);
      }
      break;
    case 'hydrant':
      disc(ctx, x + 0.04, y + 0.05, 0.15, 'rgba(0,0,0,0.3)');
      disc(ctx, x, y, 0.15, INK);
      disc(ctx, x, y, 0.12, '#d0303a');
      ctx.fillRect(x - 0.2, y - 0.04, 0.4, 0.08);
      disc(ctx, x, y, 0.04, '#f0c0c0');
      break;
    case 'newsbox':
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x - 0.18, y - 0.14, 0.46, 0.4);
      box(ctx, x - 0.22, y - 0.18, 0.44, 0.36, '#1f6fb2', 0.04);
      ctx.fillStyle = '#e9edf0';
      ctx.fillRect(x - 0.15, y - 0.1, 0.3, 0.12);
      ctx.fillStyle = '#c8333b';
      ctx.fillRect(x - 0.15, y + 0.06, 0.3, 0.04);
      break;
    case 'hvac': {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 0.15, y + 0.2, w, h);
      box(ctx, x, y, w, h, '#9aa1a9', 0.04);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let k = 0.15; k < w * 0.45; k += 0.1) ctx.fillRect(x + k, y + 0.12, 0.04, h - 0.24);
      const fr = Math.min(h, w * 0.5) * 0.36;
      const fx = x + w * 0.72;
      const fy = y + h / 2;
      disc(ctx, fx, fy, fr + 0.04, INK);
      disc(ctx, fx, fy, fr, '#5a6068');
      ctx.strokeStyle = '#2b2f36';
      ctx.lineWidth = 0.05;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.4;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr);
        ctx.stroke();
      }
      break;
    }
    case 'tank': {
      const r = w;
      disc(ctx, x + 0.2, y + 0.25, r, 'rgba(0,0,0,0.35)');
      disc(ctx, x, y, r + 0.04, INK);
      const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.1, x, y, r);
      gr.addColorStop(0, '#c4c9cf');
      gr.addColorStop(1, '#7c838b');
      disc(ctx, x, y, r, '#7c838b');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'skylight':
      box(ctx, x, y, w, h, '#5a6270', 0.03);
      for (let k = 0; k < w - 0.2; k += 1) {
        ctx.fillStyle = 'rgba(150,205,230,0.45)';
        ctx.fillRect(x + 0.12 + k, y + 0.12, 0.8, h - 0.24);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x + 0.18 + k, y + 0.16, 0.12, h - 0.32);
      }
      break;
    case 'vent':
      disc(ctx, x + 0.08, y + 0.1, 0.32, 'rgba(0,0,0,0.3)');
      disc(ctx, x, y, 0.32, INK);
      disc(ctx, x, y, 0.28, '#8a9198');
      disc(ctx, x, y, 0.16, '#5a6068');
      break;
    case 'car': {
      ctx.translate(x, y);
      ctx.rotate(d.rot ?? 0);
      const c = d.color ?? '#b8bec6';
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.roundRect(-0.95, -0.42, 2.0, 0.95, 0.2);
      ctx.fill();
      ctx.fillStyle = '#111';
      for (const [wx, wy] of [
        [-0.75, -0.5],
        [-0.75, 0.38],
        [0.45, -0.5],
        [0.45, 0.38],
      ] as const)
        ctx.fillRect(wx, wy, 0.32, 0.12);
      box(ctx, -1.0, -0.45, 2.0, 0.9, c, 0.22);
      ctx.fillStyle = '#26303c';
      ctx.beginPath();
      ctx.roundRect(0.25, -0.36, 0.32, 0.72, 0.06);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-0.72, -0.34, 0.22, 0.68, 0.05);
      ctx.fill();
      ctx.fillStyle = shade(c, 1.1);
      ctx.fillRect(-0.48, -0.36, 0.7, 0.72);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(-0.44, -0.32, 0.62, 0.08);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillRect(0.94, -0.36, 0.05, 0.16);
      ctx.fillRect(0.94, 0.2, 0.05, 0.16);
      ctx.fillStyle = '#b52b2b';
      ctx.fillRect(-1.0, -0.36, 0.05, 0.14);
      ctx.fillRect(-1.0, 0.22, 0.05, 0.14);
      break;
    }
    case 'cone':
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x - 0.16, y - 0.12, 0.36, 0.36);
      ctx.fillStyle = '#e0662c';
      ctx.fillRect(x - 0.2, y - 0.2, 0.4, 0.4);
      disc(ctx, x, y, 0.15, INK);
      disc(ctx, x, y, 0.12, '#ff7a3c');
      disc(ctx, x, y, 0.07, '#f2f2f2');
      disc(ctx, x, y, 0.035, '#ff7a3c');
      break;
  }
  ctx.restore();
}
