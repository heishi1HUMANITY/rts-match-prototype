import { CONFIG } from '../config';
import { LEVEL as L, idx } from '../map/level';
import { issue } from '../sim/commands';
import { VAULT_DOOR, officeDoor } from '../sim/rules';
import { roadblockPos } from '../sim/step';
import type { ActionKind, Game, Side, Unit } from '../sim/types';
import { active, dist, isArmedPhase, isOutdoorAt } from '../sim/world';

// 右クリックの文脈コマンド。ツールチップと実行で同じ判定を使う。

export interface ContextCmd {
  label: string;
  cost?: string;
  run: () => string | null;
}

export function selectedUnits(g: Game, side: Side, ids: Set<number>): Unit[] {
  return g.units.filter((u) => ids.has(u.id) && active(u) && (side === 'crew' ? u.kind === 'crew' : u.kind === 'guard' || u.kind === 'swat'));
}

export function unitAt(g: Game, side: Side | 'spectator', x: number, y: number, filter: (u: Unit) => boolean = () => true): Unit | null {
  let best: Unit | null = null;
  let bd = 0.6;
  for (const u of g.units) {
    if (u.escaped || u.kind === 'sniper' || u.role === 'invan' || u.brain?.state === 'gone') continue;
    if (side !== 'spectator' && !g.vis[side].units.has(u.id)) continue;
    if (!filter(u)) continue;
    const d = dist(u.x, u.y, x, y);
    if (d < bd) {
      bd = d;
      best = u;
    }
  }
  return best;
}

function nearestTo(units: Unit[], x: number, y: number): Unit {
  return units.slice().sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y))[0]!;
}

export function contextCommand(g: Game, side: Side, ids: Set<number>, x: number, y: number, shift: boolean): ContextCmd | null {
  const sel = selectedUnits(g, side, ids);
  if (!sel.length) return null;
  const move = (): ContextCmd => ({ label: '移動', run: () => issue(g, side, { t: 'move', ids: sel.map((u) => u.id), x, y }) });
  const act = (u: Unit, kind: ActionKind, target: number) => () => issue(g, side, { t: 'act', id: u.id, kind, target });
  const armed = isArmedPhase(g);
  const hit = unitAt(g, side, x, y, (u) => u.alive);

  if (side === 'crew') {
    if (hit && (hit.kind === 'guard' || hit.kind === 'swat')) {
      if (armed) return { label: '攻撃', run: () => issue(g, side, { t: 'attack', ids: sel.map((u) => u.id), targetKind: 'unit', target: hit.id }) };
      if (hit.kind === 'guard' && !hit.bribed) {
        const u = sel.filter((s) => !s.masked)[0];
        if (u) return { label: '警備員を買収', cost: money(CONFIG.actions.bribe.cost), run: act(u, 'bribe', hit.id) };
      }
    }
    if (hit && (hit.kind === 'civilian' || hit.kind === 'staff' || hit.kind === 'manager') && armed && hit.brain?.state !== 'hostage')
      return { label: '人質にする', run: act(nearestTo(sel, hit.x, hit.y), 'hostage', hit.id) };

    const bag = g.bags.find((b) => (b.state === 'ground' || b.state === 'vault') && dist(b.x, b.y, x, y) < 0.6);
    if (bag) {
      if (bag.kind === 'gold') {
        const u = sel.filter((s) => s.carrying < 0)[0];
        if (u) return { label: '金塊を運ぶ', run: act(u, 'pickup', bag.id) };
      } else return { label: bag.kind === 'tool' ? '突破ツールを拾う' : 'キーカードを取る', run: act(nearestTo(sel, bag.x, bag.y), 'pickup', bag.id) };
    }
    const cam = g.cameras.find((c) => !c.destroyed && g.vis.crew.cameras.has(c.id) && dist(c.x, c.y, x, y) < 0.6);
    if (cam) {
      if (g.phase === 'casing') return { label: 'カメラにループ映像を仕込む', cost: money(CONFIG.actions.tamper.cost), run: act(nearestTo(sel, cam.x, cam.y), 'tamper', cam.id) };
      return { label: 'カメラを撃つ', run: () => issue(g, side, { t: 'attack', ids: sel.map((u) => u.id), targetKind: 'camera', target: cam.id }) };
    }
    if (g.van && g.van.state === 'parked' && dist(g.van.x, g.van.y, x, y) < 1.6) {
      const u = sel.find((s) => s.carrying >= 0);
      if (u) return { label: 'バンに金塊を積む', run: act(u, 'deposit', 0) };
    }
    if (dist(x, y, VAULT_DOOR.x, VAULT_DOOR.y) < 1.2 && !g.breach.open) {
      const key = sel.find((s) => s.hasKey);
      if (key) return { label: 'キーカードで金庫を開ける', run: act(key, 'keycard', 0) };
      const tool = sel.find((s) => s.hasTool);
      if (tool && !g.breach.installed) return { label: '金庫に突破装置を設置', run: act(tool, 'install', 0) };
      if (g.breach.installed && g.breach.jammed) return { label: 'ドリルを再起動', run: act(nearestTo(sel, x, y), 'fix', 0) };
    }
    const slot = L.doorAt[idx(Math.floor(x), Math.floor(y))] ?? -1;
    if (slot >= 0) {
      const d = g.doors[slot]!;
      const office = L.doorSlots[slot]!.kind === 'office';
      if (!d.destroyed && (d.locked || d.security) && !(d.jammed && !d.security)) {
        const u = nearestTo(sel, x, y);
        if (shift && !office) return { label: '爆薬で扉を破る（大きな音）', cost: money(CONFIG.actions.c4.cost), run: act(u, 'c4', d.id) };
        if (office) {
          if (g.officeDrill.installed) return { label: 'ドリル作動中…', run: () => null };
          if (g.stock.drill > 0) return { label: '小型ドリルを設置（在庫から）', run: act(u, 'officedrill', d.id) };
          return { label: 'カード錠 — 小型ドリル（ショップ）で開けられる', run: () => '小型ドリルが必要です' };
        }
        if (d.locked && !d.jammed) return { label: d.security ? 'ピッキング（防犯扉・長い）' : 'ピッキング', run: act(u, 'lockpick', d.id) };
      }
    }
    for (const r of g.roadblocks) {
      const p = roadblockPos(r.slot);
      if (armed && Math.abs(p.x - x) < 0.8 && Math.abs(p.y - y) < 2.2)
        return { label: '封鎖を撃つ', run: () => issue(g, side, { t: 'attack', ids: sel.map((u) => u.id), targetKind: 'roadblock', target: r.id }) };
    }
    return move();
  }

  // 銀行側（警備員・SWAT）
  if (hit && hit.kind === 'crew' && armed) return { label: '攻撃', run: () => issue(g, side, { t: 'attack', ids: sel.map((u) => u.id), targetKind: 'unit', target: hit.id }) };
  const turret = g.turrets.find((t) => g.vis.bank.turrets.has(t.id) && dist(t.x, t.y, x, y) < 0.6);
  if (turret && armed) return { label: 'タレットを攻撃', run: () => issue(g, side, { t: 'attack', ids: sel.map((u) => u.id), targetKind: 'turret', target: turret.id }) };
  const bar = g.barricades.find((t) => g.vis.bank.barricades.has(t.id) && dist(t.x, t.y, x, y) < 0.7);
  if (bar && armed) return { label: 'バリケードを壊す', run: () => issue(g, side, { t: 'attack', ids: sel.map((u) => u.id), targetKind: 'barricade', target: bar.id }) };
  const slot = L.doorAt[idx(Math.floor(x), Math.floor(y))] ?? -1;
  if (slot >= 0) {
    const d = g.doors[slot]!;
    const guard = sel.find((u) => u.kind === 'guard');
    if (L.doorSlots[slot]!.kind === 'office' && g.officeDrill.installed) return { label: '小型ドリルを撤去', run: act(nearestTo(sel, x, y), 'sabotage', officeDoor(g).id) };
    if (d.jammed && !d.destroyed && guard) return { label: '扉を修理して再施錠', run: act(guard, 'repair', d.id) };
  }
  if (dist(x, y, VAULT_DOOR.x, VAULT_DOOR.y) < 1.4 && g.breach.installed && !g.breach.open && g.breach.method !== 'thermal')
    return { label: '金庫の装置を止める', run: act(nearestTo(sel, x, y), 'sabotage', 0) };
  return move();
}

export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function outdoorHint(u: Unit): boolean {
  return isOutdoorAt(u.x, u.y);
}
