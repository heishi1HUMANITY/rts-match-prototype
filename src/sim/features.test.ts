import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { issue } from './commands';
import { createGame } from './create';
import { callPolice, setPath } from './rules';
import { step } from './step';
import type { Game, Unit } from './types';
import { computeVisibility } from './vision';
import { L, dist, isRooftopAt, makeUnit, zoneAt } from './world';

const DT = 1 / CONFIG.tickRate;

function fultonGame(): Game {
  return createGame({ seed: 7, plan: { breach: 'thermal', escape: 'fulton' }, ai: { bank: false, crew: false } });
}

function run(g: Game, seconds: number, each?: () => void) {
  for (let i = 0; i < seconds * CONFIG.tickRate && g.phase !== 'ended'; i++) {
    step(g, DT);
    each?.();
  }
}

function carry(g: Game, u: Unit) {
  const bag = g.bags.find((b) => b.kind === 'gold' && b.state === 'vault')!;
  bag.state = 'carried';
  bag.carrier = u.id;
  u.carrying = bag.id;
  return bag;
}

describe('fulton from the hotel rooftop', () => {
  it('only lets balloons go up on the rooftop, reached by the fire escapes', () => {
    const g = fultonGame();
    const c = g.units.find((u) => u.kind === 'crew')!;
    carry(g, c);
    c.x = 17.5;
    c.y = 4.5; // 裏通り（屋外だが屋上ではない）
    expect(issue(g, 'crew', { t: 'act', id: c.id, kind: 'fulton', target: 0 })).not.toBeNull();
    const spot = L.rooftopSpots[0]!;
    expect(isRooftopAt(spot.x, spot.y)).toBe(true);
    c.x = spot.x;
    c.y = spot.y;
    expect(issue(g, 'crew', { t: 'act', id: c.id, kind: 'fulton', target: 0 })).toBeNull();
    // 屋上へは路地から歩いて上がれる
    expect(setPath(g, c, 10.5, 25.5)).toBe(true);
    expect(setPath(g, c, spot.x, spot.y)).toBe(true);
  });

  it('brings the plane only when called, and it snags ready balloons as it passes', () => {
    const g = fultonGame();
    const bag = g.bags.find((b) => b.kind === 'gold')!;
    Object.assign(bag, { state: 'balloon', x: 6, y: 12, balloon: 0, balloonHp: CONFIG.escape.fulton.balloonHp });
    run(g, 30);
    expect(bag.state).toBe('balloon');
    expect(issue(g, 'crew', { t: 'callPlane' })).toBeNull();
    expect(issue(g, 'crew', { t: 'callPlane' })).not.toBeNull();
    run(g, CONFIG.escape.fulton.arriveTime + 0.5);
    expect(bag.state).toBe('secured');
    // 通過後しばらくは呼べない
    expect(issue(g, 'crew', { t: 'callPlane' })).not.toBeNull();
  });

  it('keeps rooftop balloons out of reach of shooters on the ground', () => {
    const g = fultonGame();
    callPolice(g, 'test');
    const bag = g.bags.find((b) => b.kind === 'gold')!;
    Object.assign(bag, { state: 'balloon', x: 7.5, y: 12.5, balloon: 0, balloonHp: CONFIG.escape.fulton.balloonHp });
    const swat = makeUnit(g, 'swat', 11.5, 12.5); // 西の路地
    run(g, 6);
    expect(bag.balloonHp).toBe(CONFIG.escape.fulton.balloonHp);
    swat.x = 3.5; // 屋上に上がれば撃てる
    swat.y = 13.5;
    run(g, 6);
    expect(bag.state === 'ground' || bag.balloonHp < CONFIG.escape.fulton.balloonHp).toBe(true);
  });

  it('keeps the rooftop and the street from shooting at each other', () => {
    const taken = (roof: boolean) => {
      const g = fultonGame();
      callPolice(g, 'test');
      for (const u of g.units) if (u.kind === 'guard') u.alive = false;
      const c = g.units.find((u) => u.kind === 'crew')!;
      for (const u of g.units) if (u.kind === 'crew' && u !== c) u.alive = false;
      c.x = roof ? 8.5 : 11.5;
      c.y = roof ? 12.5 : 9.5;
      c.armor = 0;
      makeUnit(g, 'swat', 11.5, 12.5);
      const hp = c.hp;
      run(g, 4, () => {
        c.x = roof ? 8.5 : 11.5;
        c.y = roof ? 12.5 : 9.5;
        c.cooldown = 99; // 撃ち返さない
      });
      return hp - c.hp;
    };
    expect(taken(true)).toBe(0);
    expect(taken(false)).toBeGreaterThan(0);
  });
});

describe('per-unit automation', () => {
  it('roams around its post without leaving that area', () => {
    const g = createGame({ seed: 3, plan: { breach: 'thermal', escape: 'van' }, ai: { bank: false, crew: false } });
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.x = 41.5;
    c.y = 30.5;
    expect(issue(g, 'crew', { t: 'auto', ids: [c.id], mode: 'roam', on: true })).toBeNull();
    let far = 0;
    run(g, 30, () => {
      far = Math.max(far, dist(c.x, c.y, 41.5, 30.5));
      expect(zoneAt(c.x, c.y)).toBe(zoneAt(41.5, 30.5));
    });
    expect(far).toBeGreaterThan(1);
    expect(far).toBeLessThan(CONFIG.auto.roamRadius + 1);
  });

  it('intercepts an enemy near its post and walks back afterwards', () => {
    const g = createGame({ seed: 3, plan: { breach: 'thermal', escape: 'van' }, ai: { bank: false, crew: false } });
    callPolice(g, 'test');
    const guard = g.units.find((u) => u.kind === 'guard')!;
    guard.x = 41.5;
    guard.y = 30.5;
    expect(issue(g, 'bank', { t: 'auto', ids: [guard.id], mode: 'intercept', on: true })).toBeNull();
    const c = g.units.find((u) => u.kind === 'crew')!;
    for (const u of g.units) if (u.kind === 'crew' && u !== c) u.alive = false;
    c.x = 47.5;
    c.y = 30.5;
    c.masked = true;
    computeVisibility(g);
    run(g, 1, () => (c.cooldown = 99));
    expect(guard.order?.type).toBe('attack');
    c.alive = false;
    run(g, 8);
    expect(dist(guard.x, guard.y, 41.5, 30.5)).toBeLessThan(1.5);
  });

  it('takes a nearby civilian hostage after the alarm', () => {
    const g = createGame({ seed: 3, plan: { breach: 'thermal', escape: 'van' }, ai: { bank: false, crew: false } });
    callPolice(g, 'test');
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.x = 41.5;
    c.y = 30.5;
    const civ = makeUnit(g, 'civilian', 43.5, 30.5);
    civ.brain = { state: 'cower', timer: 99, errands: 0 };
    computeVisibility(g);
    expect(issue(g, 'crew', { t: 'auto', ids: [c.id], mode: 'hostage', on: true })).toBeNull();
    run(g, 6);
    expect(civ.brain?.state).toBe('hostage');
  });

  it('never overrides a manual order', () => {
    const g = createGame({ seed: 3, plan: { breach: 'thermal', escape: 'van' }, ai: { bank: false, crew: false } });
    callPolice(g, 'test');
    const guard = g.units.find((u) => u.kind === 'guard')!;
    guard.x = 41.5;
    guard.y = 30.5;
    issue(g, 'bank', { t: 'auto', ids: [guard.id], mode: 'attack', on: true });
    issue(g, 'bank', { t: 'move', ids: [guard.id], x: 56.5, y: 36.5 });
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.x = 38.5;
    c.y = 30.5;
    c.masked = true;
    computeVisibility(g);
    run(g, 1, () => (c.cooldown = 99));
    expect(guard.order?.type).toBe('move');
    expect(guard.autoOrder).toBe(false);
  });
});

describe('getting unstuck', () => {
  it('arrives at a move target pressed against a wall instead of pushing forever', () => {
    const g = createGame({ seed: 3, plan: { breach: 'thermal', escape: 'van' }, ai: { bank: false, crew: false } });
    const guard = g.units.find((u) => u.kind === 'guard')!;
    guard.x = 20.5;
    guard.y = 14.8;
    issue(g, 'bank', { t: 'move', ids: [guard.id], x: 14.17, y: 14.07 }); // 廊下の北の壁ぎりぎり
    run(g, 6);
    expect(guard.order).toBeNull();
    expect(guard.path.length).toBe(0);
    expect(dist(guard.x, guard.y, 14.17, 14.4)).toBeLessThan(0.5);
  });

  it('walks around a barricade dropped onto its planned route', () => {
    const g = createGame({ seed: 3, plan: { breach: 'thermal', escape: 'van' }, ai: { bank: false, crew: false } });
    const guard = g.units.find((u) => u.kind === 'guard')!;
    guard.x = 35.5;
    guard.y = 18.5;
    const door = L.doorSlots.find((s) => s.id === 'office')!.tiles[0]!;
    callPolice(g, 'test'); // 走らせる（遠回りになる）
    issue(g, 'bank', { t: 'move', ids: [guard.id], x: 35.5, y: 14.5 });
    g.barricades.push({ id: g.nextId++, x: door[0] + 0.5, y: door[1] + 0.5, hp: CONFIG.fort.barricade.hp });
    run(g, 60);
    expect(dist(guard.x, guard.y, 35.5, 14.5)).toBeLessThan(1);
  });

  it('lets a released branch manager walk out', () => {
    const g = createGame({ seed: 3, plan: { breach: 'thermal', escape: 'van' }, ai: { bank: false, crew: false } });
    const m = g.units.find((u) => u.kind === 'manager')!;
    m.brain = { state: 'flee', timer: 0, errands: 0 };
    setPath(g, m, L.publicExits[0]!.x, L.publicExits[0]!.y + 2);
    const x0 = m.x;
    const y0 = m.y;
    run(g, 6);
    expect(dist(m.x, m.y, x0, y0)).toBeGreaterThan(4);
  });
});
