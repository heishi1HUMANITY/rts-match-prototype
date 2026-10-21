import { CONFIG } from '../config';
import type { Pt } from '../map/level';
import { setPath } from './rules';
import type { Game, Unit } from './types';
import { L, isInteriorAt, makeUnit, pick, rand, randRange } from './world';

// 民間人・職員の振る舞い。強盗クルーと見分けがつかないよう、歩き方と寄り道の仕方を揃えている。

type PoiKind = keyof typeof L.pois;
const ERRANDS: [PoiKind, number, [number, number]][] = [
  ['teller', 0.28, [7, 16]],
  ['atm', 0.18, [4, 9]],
  ['seats', 0.18, [6, 18]],
  ['lobby', 0.12, [2, 6]],
  ['kiosk', 0.07, [3, 7]],
  ['consult', 0.07, [8, 16]],
  ['loan', 0.06, [8, 16]],
  ['restroom', 0.04, [5, 10]],
];

export function pickErrand(g: Game): { p: Pt; wait: number; face: number | null } {
  let r = rand(g);
  for (const [k, w, [a, b]] of ERRANDS) {
    r -= w;
    if (r <= 0) {
      const p = pick(g, L.pois[k]);
      const jitter = k === 'lobby' ? 1.2 : 0.15;
      return {
        p: { x: p.x + randRange(g, -jitter, jitter), y: p.y + randRange(g, -jitter, jitter) },
        wait: randRange(g, a, b),
        face: k === 'teller' ? -Math.PI / 2 : k === 'atm' ? Math.PI : null,
      };
    }
  }
  return { p: pick(g, L.pois.lobby), wait: 4, face: null };
}

export function spawnCivilian(g: Game, mode: 'enter' | 'walkby' | 'inside'): Unit {
  let u: Unit;
  if (mode === 'inside') {
    const e = pickErrand(g);
    u = makeUnit(g, 'civilian', e.p.x, e.p.y);
    u.brain = { state: 'wait', timer: randRange(g, 1, e.wait), errands: 1 + Math.floor(rand(g) * 3) };
    if (e.face !== null) u.facing = e.face;
    return u;
  }
  const end = pick(g, L.pedestrianEnds);
  u = makeUnit(g, 'civilian', end.x < 1 ? 0.6 : end.x > 82 ? 83.4 : end.x, end.y);
  u.brain = { state: mode, timer: 0, errands: 2 + Math.floor(rand(g) * 3) };
  if (mode === 'walkby') {
    const others = L.pedestrianEnds.filter((p) => Math.abs(p.x - end.x) > 20);
    const d = pick(g, others.length ? others : L.pedestrianEnds);
    u.brain.dest = { x: d.x < 1 ? 0.5 : d.x > 82 ? 83.5 : d.x, y: d.y };
    setPath(g, u, u.brain.dest.x, u.brain.dest.y);
  } else {
    setPath(g, u, L.entrance.x + randRange(g, -1.5, 1.5), 37.5);
  }
  return u;
}

export function seedCivilians(g: Game): void {
  for (let i = 0; i < Math.round(CONFIG.civilians.inside * 0.7); i++) spawnCivilian(g, 'inside');
  for (let i = 0; i < Math.round(CONFIG.civilians.outside * 0.6); i++) {
    const u = spawnCivilian(g, 'walkby');
    // 歩道の途中から始める
    const t = rand(g);
    if (u.path.length) {
      const k = Math.floor(t * u.path.length);
      const p = u.path[k]!;
      u.x = p.x;
      u.y = p.y;
      u.path = u.path.slice(k + 1);
    }
  }
}

function arrived(u: Unit): boolean {
  return u.path.length === 0;
}

function exitTo(g: Game, u: Unit): void {
  const end = pick(g, L.pedestrianEnds);
  setPath(g, u, end.x < 1 ? 0.5 : end.x > 82 ? 83.5 : end.x, end.y);
}

function atEdge(u: Unit): boolean {
  return u.x < 1.2 || u.x > 82.8;
}

export function updateCivilians(g: Game, dt: number): void {
  if (g.phase === 'casing') {
    g.civSpawnTimer -= dt;
    if (g.civSpawnTimer <= 0) {
      g.civSpawnTimer = randRange(g, 1.5, 3.5);
      let inside = 0;
      let outside = 0;
      for (const u of g.units) {
        if (u.kind !== 'civilian' || !u.brain || u.brain.state === 'gone') continue;
        if (u.brain.state === 'walkby') outside++;
        else if (u.brain.state !== 'leave') inside++;
      }
      if (inside < CONFIG.civilians.inside) spawnCivilian(g, 'enter');
      else if (outside < CONFIG.civilians.outside) spawnCivilian(g, 'walkby');
    }
  }

  for (const u of g.units) {
    const b = u.brain;
    if (!b || !u.alive || b.state === 'gone') continue;
    if (u.kind === 'crew') continue;
    switch (b.state) {
      case 'walkby':
      case 'leave':
      case 'flee':
        if (u.path.length <= 1 && atEdge(u)) b.state = 'gone';
        else if (arrived(u)) {
          if (b.timer > 25) b.state = 'gone';
          else {
            b.timer += 1;
            exitTo(g, u);
          }
        }
        break;
      case 'enter':
        if (arrived(u)) {
          b.state = 'errand';
        }
        break;
      case 'errand': {
        const e = pickErrand(g);
        if (setPath(g, u, e.p.x, e.p.y)) {
          b.state = 'wait';
          b.timer = e.wait;
          b.dest = { x: e.face ?? 99, y: 0 };
        } else {
          b.state = 'leave';
          exitTo(g, u);
        }
        break;
      }
      case 'wait':
        if (!arrived(u)) break;
        if (b.dest && b.dest.x !== 99) u.facing = b.dest.x;
        b.timer -= dt;
        if (b.timer <= 0) {
          b.errands--;
          if (b.errands > 0) b.state = 'errand';
          else {
            b.state = 'leave';
            exitTo(g, u);
          }
        }
        break;
      case 'work':
        if (u.kind === 'manager') break;
        if (!arrived(u)) break;
        b.timer -= dt;
        if (b.timer <= 0) {
          if (b.errands === 0) {
            const p = pick(g, L.staffPois);
            setPath(g, u, p.x, p.y);
            b.errands = 1;
            b.timer = randRange(g, 4, 10);
          } else {
            setPath(g, u, b.home!.x, b.home!.y);
            b.errands = 0;
            b.timer = randRange(g, 25, 70);
          }
        } else if (b.errands === 0 && b.home && Math.abs(u.x - b.home.x) < 0.3 && L.tellerSpots.some((t) => t.x === b.home!.x && t.y === b.home!.y)) {
          u.facing = Math.PI / 2;
        }
        break;
      case 'cower':
      case 'hostage':
        u.path = [];
        break;
    }
    // 警報後に館内へ取り残された人は外へ逃げ続ける
    if (b.state === 'flee' && arrived(u) && isInteriorAt(u.x, u.y) && b.timer > 30) b.state = 'cower';
  }
}
