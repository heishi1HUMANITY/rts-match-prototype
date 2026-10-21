import { CONFIG } from '../config';
import { type Command, controllable, issue } from './commands';
import type { AutoMode, Game, Side, Unit } from './types';
import { active, dist, isArmedPhase, moverClass, passable, rand, randRange, zoneAt } from './world';

// 自動行動：プレイヤーが戦闘員ごとに設定した迎撃・攻撃・人質・徘徊を、手動と同じ命令の仕組みで実行する。
// 手動で出した命令が残っている間は動かない（手動が優先）。自動で出した命令は自動行動が出し直してよい。

export const AUTO_MODES: AutoMode[] = ['intercept', 'attack', 'hostage', 'roam'];

export function autoSide(u: Unit): Side | null {
  if (u.kind === 'crew') return 'crew';
  if (u.kind === 'guard' || u.kind === 'swat') return 'bank';
  return null;
}

function anyAuto(u: Unit): boolean {
  const a = u.auto;
  return a.intercept || a.attack || a.hostage || a.roam;
}

function isEnemy(side: Side, v: Unit): boolean {
  return side === 'crew' ? (v.kind === 'guard' && !v.deserting) || v.kind === 'swat' : v.kind === 'crew';
}

function nearest(list: Unit[], u: Unit): Unit {
  return list.reduce((a, b) => (dist(a.x, a.y, u.x, u.y) <= dist(b.x, b.y, u.x, u.y) ? a : b));
}

// 自動行動として命令を出す（持ち場は手動の移動命令でしか変わらない）
function order(g: Game, u: Unit, side: Side, c: Command): boolean {
  const { home, engaged } = u.auto;
  const err = issue(g, side, c);
  u.auto.home = home;
  u.auto.engaged = engaged;
  if (!err) u.autoOrder = true;
  return !err;
}

export function updateAutomation(g: Game): void {
  const C = CONFIG.auto;
  const period = Math.max(1, Math.round(C.think * CONFIG.tickRate));
  for (const u of g.units) {
    if (!anyAuto(u) || !active(u)) continue;
    // 判断は一定間隔で、ユニットごとに時間をずらす
    if ((g.tick + u.id) % period !== 0) continue;
    const side = autoSide(u);
    if (!side || !controllable(g, side, u) || u.action) continue;
    if (u.order && !u.autoOrder) continue;
    think(g, u, side);
  }
}

function think(g: Game, u: Unit, side: Side) {
  const C = CONFIG.auto;
  const a = u.auto;
  const home = a.home ?? { x: u.x, y: u.y };
  const seen = g.vis[side].units;
  const armed = isArmedPhase(g);
  const enemies = armed ? g.units.filter((v) => active(v) && isEnemy(side, v) && seen.has(v.id)) : [];
  const chase = (t: Unit) => {
    if (u.order?.type === 'attack' && u.order.target === t.id) return;
    order(g, u, side, { t: 'attack', ids: [u.id], targetKind: 'unit', target: t.id });
  };

  // 攻撃：見えている一番近い敵を追う
  if (a.attack && enemies.length) {
    chase(nearest(enemies, u));
    return;
  }
  // 迎撃：持ち場の近くに来た敵だけを迎え撃ち、いなくなったら持ち場へ戻る
  if (a.intercept) {
    const near = enemies.filter((v) => dist(v.x, v.y, home.x, home.y) <= C.interceptRange);
    if (near.length) {
      a.engaged = true;
      chase(nearest(near, u));
      return;
    }
    if (a.engaged) {
      a.engaged = false;
      order(g, u, side, { t: 'move', ids: [u.id], x: home.x, y: home.y });
      return;
    }
  }
  // 人質：手ぶらのとき、近くの民間人を拘束する（強盗のみ・警報後）
  if (a.hostage && side === 'crew' && armed && u.carrying < 0) {
    const civs = g.units.filter(
      (v) =>
        v.alive &&
        (v.kind === 'civilian' || v.kind === 'staff' || v.kind === 'manager') &&
        v.brain?.state !== 'hostage' &&
        v.brain?.state !== 'gone' &&
        v.brain?.state !== 'flee' &&
        seen.has(v.id) &&
        dist(v.x, v.y, u.x, u.y) <= C.hostageRange,
    );
    if (civs.length) {
      const t = nearest(civs, u);
      if (!(u.order?.type === 'act' && u.order.kind === 'hostage')) order(g, u, side, { t: 'act', id: u.id, kind: 'hostage', target: t.id });
      return;
    }
  }
  // 徘徊：立ち止まって少し待ってから、持ち場のまわり（持ち場と同じ区域）の別の場所へ歩く
  if (a.roam && !u.order && !u.path.length) {
    a.wait -= C.think;
    if (a.wait > 0) return;
    const zone = zoneAt(home.x, home.y);
    for (let k = 0; k < 8; k++) {
      const ang = rand(g) * Math.PI * 2;
      const r = Math.sqrt(rand(g)) * C.roamRadius;
      const x = home.x + Math.cos(ang) * r;
      const y = home.y + Math.sin(ang) * r;
      if (zoneAt(x, y) !== zone || !passable(g, moverClass(u.kind), Math.floor(x), Math.floor(y))) continue;
      if (order(g, u, side, { t: 'move', ids: [u.id], x, y })) {
        a.wait = randRange(g, C.roamWait[0], C.roamWait[1]);
        break;
      }
    }
  }
}
