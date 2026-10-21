import type { Unit } from '../sim/types';
import { drawText } from './text';

// 人物の見下ろし描画（タイル座標・1 = 1タイル、+x が正面）。
// ドアキッカーズのように、肩・腕・頭・装備の輪郭がはっきり読める立ち絵にする。
// 素顔のクルーと民間人は同じ関数・同じ見た目の分布（ID由来）で描かれるので見分けがつかない。

export interface PersonStyle {
  armed: boolean;
  flash: boolean;
  carryingGold: boolean;
  time: number;
}

const K = 1.28; // 全体表示でも読めるよう少し大きめに描く
const INK = '#121419';

const JACKETS = ['#2e3a4f', '#4a4f57', '#5b4a3a', '#3f5a48', '#6b3a3f', '#3d4f6e', '#7a6a55', '#2f2f35'];
const HATS = ['#2b2f3a', '#7a2e2e', '#3b5a7a', '#c9b48a', '#2e4a35'];

interface Cosmetic {
  hairStyle: number; // 0 短髪 1 長髪 2 坊主 3 くせ毛
  outfit: number; // 0 シャツ 1 ジャケット 2 コート 3 パーカー
  jacket: string;
  hat: number; // 0 なし 1 キャップ 2 ニット帽
  hatColor: string;
  glasses: boolean;
}

function hash(n: number): number {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

// 見た目の細部はIDから決める（ゲームの乱数を消費しない）
function cosmetic(id: number): Cosmetic {
  const h = hash(id + 7);
  return {
    hairStyle: h % 4,
    outfit: (h >>> 3) % 4,
    jacket: JACKETS[(h >>> 6) % JACKETS.length]!,
    hat: (h >>> 10) % 7 === 0 ? 1 : (h >>> 10) % 11 === 1 ? 2 : 0,
    hatColor: HATS[(h >>> 14) % HATS.length]!,
    glasses: (h >>> 18) % 5 === 0,
  };
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

// 腕：肩から手までの太い線＋手
function arm(ctx: CanvasRenderingContext2D, sx: number, sy: number, hx: number, hy: number, sleeve: string, hand: string, w = 0.1) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 0.04;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.strokeStyle = sleeve;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = INK;
  circle(ctx, hx, hy, 0.062);
  ctx.fillStyle = hand;
  circle(ctx, hx, hy, 0.045);
}

function rifle(ctx: CanvasRenderingContext2D, x0: number, len: number, heavy: boolean) {
  ctx.fillStyle = INK;
  ctx.fillRect(x0 - 0.02, -0.045, len + 0.04, 0.09);
  ctx.fillStyle = heavy ? '#3a3d42' : '#2a2d33';
  ctx.fillRect(x0, -0.03, len, 0.06);
  ctx.fillStyle = '#1a1c20';
  ctx.fillRect(x0 + len * 0.35, 0.02, 0.07, 0.09); // マガジン
  ctx.fillRect(x0 + len, -0.015, 0.1, 0.03); // 銃身
}

function pistol(ctx: CanvasRenderingContext2D, x: number) {
  ctx.fillStyle = INK;
  ctx.fillRect(x - 0.01, -0.035, 0.2, 0.07);
  ctx.fillStyle = '#30343a';
  ctx.fillRect(x, -0.025, 0.18, 0.05);
}

export function drawPerson(ctx: CanvasRenderingContext2D, u: Unit, s: PersonStyle): void {
  const state = u.brain?.state;
  const c = cosmetic(u.id);
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.scale(K, K);

  if (!u.alive) {
    drawDead(ctx, u, c);
    ctx.restore();
    return;
  }

  // 接地影
  const sh = ctx.createRadialGradient(0.04, 0.06, 0.05, 0.04, 0.06, 0.42);
  sh.addColorStop(0, 'rgba(0,0,0,0.32)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ellipse(ctx, 0.04, 0.06, 0.42, 0.38);
  ctx.fill();

  if (state === 'hostage' || state === 'cower') {
    drawKneeling(ctx, u, c, state === 'hostage');
    ctx.restore();
    return;
  }

  ctx.rotate(u.facing);
  const walk = u.moving ? Math.sin(s.time * 10 + u.id) : 0;
  const role = u.kind;
  const masked = role === 'crew' && u.masked;

  // 靴（歩くと交互に前へ出る）
  const shoe = role === 'swat' || role === 'sniper' ? '#14171c' : role === 'guard' ? '#111' : '#2a221d';
  for (const [dx, dy] of [
    [walk * 0.11, -0.11],
    [-walk * 0.11, 0.11],
  ] as const) {
    ctx.fillStyle = INK;
    ellipse(ctx, 0.04 + dx, dy, 0.09, 0.055);
    ctx.fill();
    ctx.fillStyle = shoe;
    ellipse(ctx, 0.04 + dx, dy, 0.07, 0.04);
    ctx.fill();
  }

  // 背中の荷物
  if (s.carryingGold) drawSack(ctx, -0.27, 0, 0.21);
  else if (u.look.bag === 'gym' || (masked && u.hasTool)) {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(-0.36, -0.2, 0.22, 0.4, 0.07);
    ctx.fill();
    ctx.fillStyle = u.look.bagColor;
    ctx.beginPath();
    ctx.roundRect(-0.34, -0.18, 0.18, 0.36, 0.06);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(-0.25, -0.17);
    ctx.lineTo(-0.25, 0.17);
    ctx.stroke();
  } else if (c.outfit === 3 && (role === 'civilian' || role === 'crew' || role === 'manager')) {
    // リュック
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(-0.3, -0.15, 0.16, 0.3, 0.06);
    ctx.fill();
    ctx.fillStyle = shade(c.jacket, 1.25);
    ctx.beginPath();
    ctx.roundRect(-0.285, -0.135, 0.13, 0.27, 0.05);
    ctx.fill();
  }

  // 胴体と腕
  const skin = u.look.skin;
  const gloves = masked || role === 'swat' || role === 'sniper' ? '#1c1e22' : skin;
  if (role === 'swat' || role === 'sniper') drawSwatBody(ctx);
  else if (role === 'guard') drawGuardBody(ctx);
  else if (role === 'staff') drawStaffBody(ctx, u);
  else drawCivilianBody(ctx, u, c, u.heavy);

  const sleeve =
    role === 'swat' || role === 'sniper' ? '#232a33' : role === 'guard' ? '#26375c' : role === 'staff' ? '#eef0f3' : u.heavy ? '#3a3f47' : c.outfit === 0 ? u.look.shirt : c.jacket;

  if (s.armed) {
    if (role === 'guard') {
      // 拳銃を両手で構える
      arm(ctx, 0.02, -0.22, 0.32, -0.03, sleeve, gloves);
      arm(ctx, 0.02, 0.22, 0.32, 0.03, sleeve, gloves);
      pistol(ctx, 0.34);
    } else {
      // ライフル：右手がグリップ、左手が前の支え
      rifle(ctx, 0.04, u.heavy ? 0.5 : 0.46, u.heavy);
      arm(ctx, -0.02, 0.23, 0.2, 0.06, sleeve, gloves);
      arm(ctx, 0.0, -0.23, 0.4, -0.02, sleeve, gloves);
    }
    if (s.flash) {
      ctx.fillStyle = 'rgba(255,226,140,0.95)';
      ctx.beginPath();
      ctx.moveTo(0.62, 0);
      ctx.lineTo(0.84, -0.11);
      ctx.lineTo(0.78, 0);
      ctx.lineTo(0.84, 0.11);
      ctx.closePath();
      ctx.fill();
    }
  } else if (s.carryingGold) {
    arm(ctx, -0.02, -0.24, -0.16, -0.14, sleeve, gloves);
    arm(ctx, -0.02, 0.24, -0.16, 0.14, sleeve, gloves);
  } else {
    // 歩くと腕を振る
    arm(ctx, 0.0, -0.25, 0.06 - walk * 0.12, -0.3, sleeve, gloves);
    arm(ctx, 0.0, 0.25, 0.06 + walk * 0.12, 0.3, sleeve, gloves);
    if (u.look.bag === 'tote') {
      const bx = walk * 0.12;
      ctx.fillStyle = INK;
      ctx.fillRect(bx - 0.08, 0.31, 0.16, 0.15);
      ctx.fillStyle = u.look.bagColor;
      ctx.fillRect(bx - 0.065, 0.325, 0.13, 0.12);
    }
  }

  drawHead(ctx, u, c);
  ctx.restore();
}

function torsoPath(ctx: CanvasRenderingContext2D, wide: number, back: number, front: number) {
  ctx.beginPath();
  ctx.roundRect(back, -wide, front - back, wide * 2, 0.12);
}

function fillTorso(ctx: CanvasRenderingContext2D, color: string, wide: number, back = -0.17, front = 0.14) {
  ctx.fillStyle = INK;
  torsoPath(ctx, wide + 0.025, back - 0.025, front + 0.025);
  ctx.fill();
  const gr = ctx.createLinearGradient(-0.2, 0, 0.15, 0);
  gr.addColorStop(0, shade(color, 0.72));
  gr.addColorStop(0.6, color);
  gr.addColorStop(1, shade(color, 1.12));
  ctx.fillStyle = gr;
  torsoPath(ctx, wide, back, front);
  ctx.fill();
}

function drawCivilianBody(ctx: CanvasRenderingContext2D, u: Unit, c: Cosmetic, heavy: boolean) {
  if (heavy) {
    // 重武装：防弾プレートの塊
    fillTorso(ctx, '#3a3f47', 0.34, -0.21, 0.17);
    ctx.fillStyle = '#4c535d';
    ctx.fillRect(-0.15, -0.28, 0.27, 0.56);
    ctx.fillStyle = '#e08a2c';
    ctx.fillRect(-0.04, -0.28, 0.05, 0.56);
    ctx.fillStyle = '#2b2f36';
    for (let i = -1; i <= 1; i++) ctx.fillRect(0.06, i * 0.15 - 0.05, 0.08, 0.1);
    return;
  }
  const shirt = u.look.shirt;
  if (c.outfit === 0) {
    fillTorso(ctx, shirt, 0.27);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(0.1, -0.06);
    ctx.lineTo(0.13, 0);
    ctx.lineTo(0.1, 0.06);
    ctx.stroke();
  } else if (c.outfit === 1 || c.outfit === 3) {
    fillTorso(ctx, c.jacket, 0.28);
    // 前を開けたジャケットから中のシャツが見える
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.moveTo(0.14, -0.07);
    ctx.lineTo(0.0, 0);
    ctx.lineTo(0.14, 0.07);
    ctx.closePath();
    ctx.fill();
    if (c.outfit === 3) {
      ctx.fillStyle = shade(c.jacket, 0.85); // フード
      ellipse(ctx, -0.12, 0, 0.08, 0.16);
      ctx.fill();
    }
  } else {
    // ロングコート：裾が後ろに長い
    fillTorso(ctx, c.jacket, 0.29, -0.24, 0.15);
    ctx.fillStyle = shade(c.jacket, 0.7);
    ctx.fillRect(-0.03, -0.29, 0.04, 0.58);
  }
}

function drawStaffBody(ctx: CanvasRenderingContext2D, u: Unit) {
  fillTorso(ctx, '#f1f3f6', 0.27);
  // 紺のベストとネクタイ
  ctx.fillStyle = '#27324a';
  ctx.beginPath();
  ctx.roundRect(-0.14, -0.24, 0.24, 0.48, 0.08);
  ctx.fill();
  ctx.fillStyle = '#f1f3f6';
  ctx.beginPath();
  ctx.moveTo(0.11, -0.08);
  ctx.lineTo(0.0, 0);
  ctx.lineTo(0.11, 0.08);
  ctx.fill();
  ctx.fillStyle = (u.id & 1) === 0 ? '#9a2a32' : '#2f4f8a';
  ctx.fillRect(0.02, -0.025, 0.1, 0.05);
}

function drawGuardBody(ctx: CanvasRenderingContext2D) {
  fillTorso(ctx, '#2c3e66', 0.28);
  // 肩章・無線機・バッジ・ベルト
  ctx.fillStyle = '#1b2742';
  ctx.fillRect(-0.06, -0.29, 0.12, 0.06);
  ctx.fillRect(-0.06, 0.23, 0.12, 0.06);
  ctx.fillStyle = '#111';
  ctx.fillRect(0.02, -0.2, 0.08, 0.06);
  ctx.fillStyle = '#d8b24a';
  circle(ctx, 0.07, 0.13, 0.035);
  ctx.fillStyle = '#1b2742';
  ctx.fillRect(-0.15, -0.02, 0.27, 0.04);
}

function drawSwatBody(ctx: CanvasRenderingContext2D) {
  fillTorso(ctx, '#232a33', 0.3, -0.19, 0.15);
  // プレートキャリアとポーチ
  ctx.fillStyle = '#323a45';
  ctx.beginPath();
  ctx.roundRect(-0.16, -0.24, 0.29, 0.48, 0.06);
  ctx.fill();
  ctx.fillStyle = '#1b2027';
  for (let i = -1; i <= 1; i++) ctx.fillRect(0.06, i * 0.14 - 0.05, 0.08, 0.1);
  ctx.fillStyle = '#e9ecf0'; // 背中のPOLICE表示
  ctx.fillRect(-0.15, -0.09, 0.07, 0.18);
  ctx.fillStyle = '#323a45';
  ctx.fillRect(-0.14, -0.06, 0.03, 0.12);
}

function drawHead(ctx: CanvasRenderingContext2D, u: Unit, c: Cosmetic) {
  const hx = 0.03;
  const role = u.kind;
  if (role === 'crew' && u.masked) {
    drawMask(ctx, u.maskStyle, hx);
    return;
  }
  if (role === 'swat' || role === 'sniper') {
    // ヘルメット（暗視装置のマウント付き）
    ctx.fillStyle = INK;
    circle(ctx, hx, 0, 0.17);
    const gr = ctx.createRadialGradient(hx - 0.04, -0.04, 0.02, hx, 0, 0.16);
    gr.addColorStop(0, '#4a5360');
    gr.addColorStop(1, '#1f252d');
    ctx.fillStyle = gr;
    circle(ctx, hx, 0, 0.15);
    ctx.fillStyle = '#11151a';
    ctx.fillRect(hx + 0.09, -0.04, 0.07, 0.08);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.arc(hx, 0, 0.1, Math.PI * 0.6, Math.PI * 1.4);
    ctx.stroke();
    return;
  }
  // 顔（上から見ると額と鼻先がわずかに見える）
  ctx.fillStyle = INK;
  circle(ctx, hx, 0, 0.155);
  ctx.fillStyle = u.look.skin;
  circle(ctx, hx, 0, 0.135);
  ctx.fillStyle = shade(u.look.skin, 0.85);
  circle(ctx, hx + 0.12, 0, 0.03);
  if (role === 'guard') {
    // 制帽
    ctx.fillStyle = '#16203a';
    ellipse(ctx, hx + 0.1, 0, 0.07, 0.12);
    ctx.fill();
    ctx.fillStyle = '#1f2b48';
    circle(ctx, hx - 0.01, 0, 0.14);
    ctx.fillStyle = '#d8b24a';
    circle(ctx, hx + 0.06, 0, 0.028);
    return;
  }
  // 職員は帽子をかぶらない
  const hat = role === 'staff' ? 0 : c.hat;
  if (hat === 1) {
    ctx.fillStyle = shade(c.hatColor, 0.8);
    ellipse(ctx, hx + 0.11, 0, 0.07, 0.11);
    ctx.fill();
    ctx.fillStyle = c.hatColor;
    circle(ctx, hx - 0.01, 0, 0.13);
  } else if (hat === 2) {
    ctx.fillStyle = c.hatColor;
    circle(ctx, hx - 0.015, 0, 0.135);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 0.015;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(hx - 0.13, i * 0.045);
      ctx.lineTo(hx + 0.08, i * 0.045);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = u.look.hair;
    switch (c.hairStyle) {
      case 0: // 短髪：後頭部から頭頂まで
        ctx.beginPath();
        ctx.arc(hx - 0.01, 0, 0.13, Math.PI * 0.42, Math.PI * 1.58);
        ctx.arc(hx + 0.03, 0, 0.09, Math.PI * 1.5, Math.PI * 0.5, true);
        ctx.fill();
        break;
      case 1: // 長髪：後ろに流れる
        ctx.beginPath();
        ctx.arc(hx - 0.01, 0, 0.14, Math.PI * 0.38, Math.PI * 1.62);
        ctx.arc(hx + 0.04, 0, 0.09, Math.PI * 1.5, Math.PI * 0.5, true);
        ctx.fill();
        ellipse(ctx, hx - 0.17, 0, 0.09, 0.11);
        ctx.fill();
        break;
      case 2: // 坊主
        ctx.globalAlpha = 0.45;
        circle(ctx, hx - 0.01, 0, 0.125);
        ctx.globalAlpha = 1;
        break;
      default: // くせ毛
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * 0.55 + (i / 6) * Math.PI * 0.9;
          circle(ctx, hx - 0.01 + Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.06);
        }
        break;
    }
  }
  if (c.glasses) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(hx + 0.1, -0.09);
    ctx.lineTo(hx + 0.1, 0.09);
    ctx.stroke();
  }
}

const MASKS = [
  { base: '#e07a2e', accent: '#fbefe0', ears: 'pointy' },
  { base: '#8a6a4a', accent: '#f0d27a', ears: 'tufts' },
  { base: '#f2f0ea', accent: '#e79aa8', ears: 'long' },
  { base: '#4d8a4f', accent: '#e7e3c8', ears: 'none' },
  { base: '#2a2a30', accent: '#f2d23a', ears: 'pointy' },
] as const;

function drawMask(ctx: CanvasRenderingContext2D, style: number, hx: number) {
  const m = MASKS[style % MASKS.length]!;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.035;
  ctx.fillStyle = m.base;
  for (const sgn of [-1, 1]) {
    if (m.ears === 'pointy') {
      ctx.beginPath();
      ctx.moveTo(hx - 0.07, sgn * 0.1);
      ctx.lineTo(hx - 0.04, sgn * 0.26);
      ctx.lineTo(hx + 0.07, sgn * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (m.ears === 'long') {
      ellipse(ctx, hx - 0.21, sgn * 0.08, 0.19, 0.055, sgn * 0.25);
      ctx.fill();
      ctx.stroke();
    } else if (m.ears === 'tufts') {
      ctx.beginPath();
      ctx.moveTo(hx - 0.09, sgn * 0.09);
      ctx.lineTo(hx - 0.16, sgn * 0.23);
      ctx.lineTo(hx + 0.02, sgn * 0.13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(hx, 0, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = m.accent;
  if (m.ears === 'none') {
    ellipse(ctx, hx + 0.18, 0, 0.15, 0.085);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(hx + 0.07, -0.09);
    ctx.lineTo(hx + 0.25, 0);
    ctx.lineTo(hx + 0.07, 0.09);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#0d0d0f';
  circle(ctx, hx + 0.08, -0.065, 0.032);
  circle(ctx, hx + 0.08, 0.065, 0.032);
}

function bodyColor(u: Unit, c: Cosmetic): string {
  if (u.kind === 'swat' || u.kind === 'sniper') return '#232a33';
  if (u.kind === 'guard') return '#2c3e66';
  if (u.kind === 'staff') return '#f1f3f6';
  if (u.heavy) return '#3a3f47';
  return c.outfit === 0 ? u.look.shirt : c.jacket;
}

function drawKneeling(ctx: CanvasRenderingContext2D, u: Unit, c: Cosmetic, tied: boolean) {
  ctx.rotate(u.facing);
  ctx.scale(0.88, 0.88);
  const body = bodyColor(u, c);
  // 膝をついた脚
  for (const sgn of [-1, 1]) {
    ctx.fillStyle = INK;
    ellipse(ctx, 0.12, sgn * 0.12, 0.13, 0.08);
    ctx.fill();
    ctx.fillStyle = u.look.pants;
    ellipse(ctx, 0.12, sgn * 0.12, 0.11, 0.06);
    ctx.fill();
  }
  fillTorso(ctx, body, 0.24, -0.16, 0.1);
  if (tied) {
    // 後ろ手に結束バンド
    arm(ctx, -0.05, -0.2, -0.2, -0.05, body, u.look.skin, 0.09);
    arm(ctx, -0.05, 0.2, -0.2, 0.05, body, u.look.skin, 0.09);
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.moveTo(-0.21, -0.07);
    ctx.lineTo(-0.21, 0.07);
    ctx.stroke();
  } else {
    // 頭を抱える
    arm(ctx, 0.0, -0.22, 0.1, -0.1, body, u.look.skin, 0.09);
    arm(ctx, 0.0, 0.22, 0.1, 0.1, body, u.look.skin, 0.09);
  }
  ctx.fillStyle = INK;
  circle(ctx, 0.0, 0, 0.145);
  ctx.fillStyle = u.look.hair;
  circle(ctx, 0.0, 0, 0.125);
}

function drawDead(ctx: CanvasRenderingContext2D, u: Unit, c: Cosmetic) {
  ctx.rotate(u.facing + 1.1);
  ctx.globalAlpha = 0.9;
  const body = bodyColor(u, c);
  // 投げ出された手足
  arm(ctx, 0.0, -0.18, 0.18, -0.42, body, u.look.skin, 0.09);
  arm(ctx, -0.05, 0.2, 0.1, 0.38, body, u.look.skin, 0.09);
  ctx.fillStyle = INK;
  ellipse(ctx, -0.36, -0.1, 0.18, 0.07, 0.2);
  ctx.fill();
  ellipse(ctx, -0.36, 0.1, 0.18, 0.07, -0.2);
  ctx.fill();
  fillTorso(ctx, body, 0.24, -0.22, 0.14);
  ctx.fillStyle = INK;
  circle(ctx, 0.25, 0, 0.15);
  ctx.fillStyle = u.kind === 'crew' && u.masked ? MASKS[u.maskStyle % MASKS.length]!.base : u.kind === 'swat' ? '#2a3038' : u.look.hair;
  circle(ctx, 0.25, 0, 0.13);
  ctx.globalAlpha = 1;
}

function drawSack(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = INK;
  ellipse(ctx, x, y, r + 0.025, r * 0.9 + 0.025);
  ctx.fill();
  const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0.02, x, y, r);
  gr.addColorStop(0, '#d9c28e');
  gr.addColorStop(1, '#a88a50');
  ctx.fillStyle = gr;
  ellipse(ctx, x, y, r, r * 0.9);
  ctx.fill();
  ctx.fillStyle = '#6d5a32';
  ellipse(ctx, x + r * 0.75, y, r * 0.18, r * 0.3);
  ctx.fill();
}

export function drawGoldBag(ctx: CanvasRenderingContext2D, x: number, y: number, inVault: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (inVault) {
    // 金の延べ棒を積んだパレット
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-0.36, -0.22, 0.78, 0.52);
    ctx.fillStyle = '#6b5a44';
    ctx.fillRect(-0.4, -0.26, 0.8, 0.52);
    ctx.strokeStyle = '#4c3f2f';
    ctx.lineWidth = 0.03;
    ctx.strokeRect(-0.4, -0.26, 0.8, 0.52);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const bx = -0.34 + col * 0.23;
        const by = -0.2 + row * 0.22;
        const gr = ctx.createLinearGradient(bx, by, bx + 0.2, by + 0.18);
        gr.addColorStop(0, '#ffe08a');
        gr.addColorStop(0.5, '#e6b531');
        gr.addColorStop(1, '#a87b16');
        ctx.fillStyle = gr;
        ctx.fillRect(bx, by, 0.2, 0.18);
        ctx.strokeStyle = '#8a6412';
        ctx.lineWidth = 0.015;
        ctx.strokeRect(bx, by, 0.2, 0.18);
      }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, 0.05, 0.08, 0.27, 0.23);
    ctx.fill();
    drawSack(ctx, 0, 0, 0.24);
    ctx.fillStyle = '#6d5a32';
    drawText(ctx, '$', 0, 0.09, '700 0.26px Oswald, sans-serif');
  }
  ctx.restore();
}
