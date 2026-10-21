import { LEVEL as L, idx } from '../map/level';
import { canPlaceCameraAt, issue } from '../sim/commands';
import { instantlyReportable } from '../sim/rules';
import type { Command } from '../sim/commands';
import { active, dist } from '../sim/world';
import type { App } from './app';
import { contextCommand, selectedUnits, unitAt } from './context';
import type { Hud } from './hud';

export class Input {
  private down: { px: number; py: number; x: number; y: number; shift: boolean } | null = null;
  private fHeld = false;
  onHelp: () => void = () => {};
  onPause: () => void = () => {};

  constructor(
    private app: App,
    private hud: Hud,
    canvas: HTMLCanvasElement,
  ) {
    canvas.addEventListener('mousedown', (e) => this.mouseDown(e));
    window.addEventListener('mousemove', (e) => this.mouseMove(e));
    window.addEventListener('mouseup', (e) => this.mouseUp(e));
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.rightClick(e);
    });
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
  }

  private tile(e: MouseEvent) {
    return this.app.renderer.toTile(e.clientX, e.clientY);
  }

  private run(c: Command) {
    const side = this.app.human;
    if (!side) return;
    const err = issue(this.app.g, side, c);
    if (err) this.app.toast(err);
    return err;
  }

  private mouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const t = this.tile(e);
    const v = this.app.view;
    this.down = { px: e.clientX, py: e.clientY, x: t.x, y: t.y, shift: e.shiftKey };
    if (v.placement?.kind === 'camera') {
      if (!canPlaceCameraAt(t.x, t.y)) {
        this.app.toast('館内の床にのみ設置できます（化粧室は不可）');
        this.down = null;
        return;
      }
      v.placement.start = t;
    }
  }

  private mouseMove(e: MouseEvent) {
    const t = this.tile(e);
    const v = this.app.view;
    v.mouse = t;
    if (this.down && !v.placement && Math.hypot(e.clientX - this.down.px, e.clientY - this.down.py) > 5) {
      v.box = { x0: this.down.x, y0: this.down.y, x1: t.x, y1: t.y };
    }
    // ツールチップ
    const tip = this.hud.tooltip;
    const side = this.app.human;
    let text = '';
    if (side && !v.placement && v.selected.size && (e.target as HTMLElement).tagName === 'CANVAS') {
      const c = contextCommand(this.app.g, side, v.selected, t.x, t.y, e.shiftKey);
      if (c && c.label !== '移動') text = `<b>右クリック</b> ${c.label}${c.cost ? ` <span>${c.cost}</span>` : ''}`;
    }
    if (side === 'bank' && this.app.g.phase === 'casing' && !v.placement && (e.target as HTMLElement).tagName === 'CANVAS') {
      const p = unitAt(this.app.g, 'bank', t.x, t.y, (u) => u.kind === 'civilian' || u.kind === 'crew');
      if (p) text = instantlyReportable(p) ? '<b>即通報できる人物</b> クリックで選択 → R' : '<b>来店客</b> クリックで選択 → F長押しで観察';
    }
    if (text) {
      tip.innerHTML = text;
      tip.style.left = `${e.clientX + 16}px`;
      tip.style.top = `${e.clientY + 14}px`;
      tip.classList.add('on');
    } else tip.classList.remove('on');
  }

  private mouseUp(e: MouseEvent) {
    if (e.button !== 0 || !this.down) return;
    const { g, view } = this.app;
    const side = this.app.human;
    const t = this.tile(e);
    const start = this.down;
    this.down = null;
    const p = view.placement;
    if (p && side) {
      const keep = e.shiftKey;
      let err: string | null | undefined = null;
      switch (p.kind) {
        case 'camera': {
          if (!p.start) return;
          const dx = t.x - p.start.x;
          const dy = t.y - p.start.y;
          const dir = Math.hypot(dx, dy) > 0.3 ? Math.atan2(dy, dx) : -Math.PI / 2;
          err = this.run({ t: 'camera', x: p.start.x, y: p.start.y, dir });
          p.start = null;
          break;
        }
        case 'secdoor': {
          const s = L.doorAt[idx(Math.floor(t.x), Math.floor(t.y))] ?? -1;
          err = s < 0 ? '扉をクリックしてください' : this.run({ t: 'secdoor', slot: s });
          break;
        }
        case 'sensor':
          err = this.run({ t: 'sensor', x: t.x, y: t.y });
          break;
        case 'deploy':
          err = this.run({ t: 'deploy', item: p.item, x: t.x, y: t.y });
          break;
        case 'swat': {
          const s = L.staging.find((s) => dist(s.x, s.y, t.x, t.y) < 2.5);
          err = s ? this.run({ t: 'swat', staging: s.id }) : '展開地点（青い印）をクリックしてください';
          break;
        }
        case 'sniper': {
          const s = L.sniperSpots.find((s) => dist(s.x, s.y, t.x, t.y) < 1.5);
          err = s ? this.run({ t: 'sniper', spot: s.id }) : '狙撃地点（赤い印）をクリックしてください';
          break;
        }
        case 'roadblock': {
          const s = L.roadblocks.find((s) => Math.abs(s.x + 0.5 - t.x) < 1.5 && t.y >= s.y0 - 1 && t.y <= s.y1 + 2);
          err = s ? this.run({ t: 'roadblock', slot: s.id }) : '封鎖地点（オレンジの枠）をクリックしてください';
          break;
        }
        case 'gas':
          err = this.run({ t: 'gas', x: t.x, y: t.y });
          break;
        case 'wallbreach': {
          const swat = selectedUnits(g, 'bank', view.selected).filter((u) => u.kind === 'swat');
          if (!swat.length) err = 'SWAT隊員を選択してから壁をクリックしてください';
          else {
            const u = swat.sort((a, b) => dist(a.x, a.y, t.x, t.y) - dist(b.x, b.y, t.x, t.y))[0]!;
            err = this.run({ t: 'act', id: u.id, kind: 'wallbreach', target: idx(Math.floor(t.x), Math.floor(t.y)) });
          }
          break;
        }
        case 'c4': {
          const s = L.doorAt[idx(Math.floor(t.x), Math.floor(t.y))] ?? -1;
          const crew = selectedUnits(g, 'crew', view.selected);
          if (s < 0) err = '扉をクリックしてください';
          else if (!crew.length) err = 'クルーを選択してください';
          else {
            const u = crew.sort((a, b) => dist(a.x, a.y, t.x, t.y) - dist(b.x, b.y, t.x, t.y))[0]!;
            err = this.run({ t: 'act', id: u.id, kind: 'c4', target: g.doors[s]!.id });
          }
          break;
        }
      }
      if (err) {
        if (p.kind === 'secdoor' || p.kind === 'swat' || p.kind === 'sniper' || p.kind === 'roadblock' || p.kind === 'c4' || p.kind === 'wallbreach' || p.kind === 'camera') this.app.toast(err);
        return;
      }
      if (!keep) view.placement = null;
      view.marks.push({ x: t.x, y: t.y, t: 0.5, color: '#ffd166' });
      return;
    }
    if (!side) return;
    // 範囲選択
    if (view.box) {
      const b = view.box;
      view.box = null;
      const x0 = Math.min(b.x0, b.x1);
      const x1 = Math.max(b.x0, b.x1);
      const y0 = Math.min(b.y0, b.y1);
      const y1 = Math.max(b.y0, b.y1);
      const picked = selectedUnits(g, side, new Set(g.units.map((u) => u.id))).filter((u) => u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
      if (!start.shift) view.selected.clear();
      for (const u of picked) view.selected.add(u.id);
      return;
    }
    const own = unitAt(g, side, t.x, t.y, (u) => active(u) && (side === 'crew' ? u.kind === 'crew' : u.kind === 'guard' || u.kind === 'swat'));
    if (own) {
      if (start.shift) {
        if (view.selected.has(own.id)) view.selected.delete(own.id);
        else view.selected.add(own.id);
      } else view.selected = new Set([own.id]);
      return;
    }
    if (side === 'bank' && g.phase === 'casing') {
      const person = unitAt(g, 'bank', t.x, t.y, (u) => u.kind === 'civilian' || u.kind === 'crew');
      if (person) {
        if (view.observeTarget !== person.id) issue(g, 'bank', { t: 'observe', target: person.id, holding: false });
        view.observeTarget = person.id;
        return;
      }
    }
    if (!start.shift) view.selected.clear();
  }

  private rightClick(e: MouseEvent) {
    const { g, view } = this.app;
    const side = this.app.human;
    if (view.placement) {
      view.placement = null;
      return;
    }
    if (!side) return;
    const t = this.tile(e);
    const c = contextCommand(g, side, view.selected, t.x, t.y, e.shiftKey);
    if (!c) return;
    const err = c.run();
    if (err) this.app.toast(err);
    else view.marks.push({ x: t.x, y: t.y, t: 0.45, color: c.label === '移動' ? (side === 'crew' ? '#ff5a3c' : '#4aa3ff') : '#ffd166' });
  }

  private key(e: KeyboardEvent, down: boolean) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const { g, view } = this.app;
    const side = this.app.human;
    const k = e.key.toLowerCase();
    if (k === 'f' && side === 'bank') {
      if (down && !this.fHeld) {
        this.fHeld = true;
        this.hud.setObserve(true);
      } else if (!down) {
        this.fHeld = false;
        this.hud.setObserve(false);
      }
      return;
    }
    if (!down) return;
    if (k === ' ') {
      e.preventDefault();
      this.onPause();
    } else if (k === 'escape') {
      if (view.placement) view.placement = null;
      else view.selected.clear();
    } else if (k === 'h' || k === '?') this.onHelp();
    else if (k === 'q' && side) {
      view.selected = new Set(selectedUnits(g, side, new Set(g.units.map((u) => u.id))).map((u) => u.id));
    } else if (k === 'm' && side === 'crew') this.run({ t: 'mask', ids: [...view.selected] });
    else if (k === 'r' && side === 'bank') this.run({ t: 'report', target: view.observeTarget });
    else if (k === '1' || k === '2' || k === '3') this.app.speed = Number(k);
  }

  update(dt: number) {
    const v = this.app.view;
    for (const m of v.marks) m.t -= dt;
    v.marks = v.marks.filter((m) => m.t > 0);
  }
}
