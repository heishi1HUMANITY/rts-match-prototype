import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { issue } from './commands';
import { createGame, spawnCrew } from './create';
import { findPath } from './path';
import { callPolice, officeDoor } from './rules';
import { step } from './step';
import type { Game } from './types';
import { computeVisibility } from './vision';
import { L, makeUnit, passable } from './world';
import { idx } from '../map/level';

const DT = 1 / CONFIG.tickRate;

function game(ai = { bank: false, crew: false }): Game {
  return createGame({ seed: 7, plan: { breach: 'drill', escape: 'van' }, ai });
}

function run(g: Game, seconds: number) {
  for (let i = 0; i < seconds * CONFIG.tickRate && g.phase !== 'ended'; i++) step(g, DT);
}

describe('map', () => {
  it('connects the street, lobby and vault', () => {
    const g = game();
    expect(findPath(g, 'civ', L.entrance.x, L.entrance.y, 41.5, 30)).not.toBeNull();
    expect(findPath(g, 'crew', L.entrance.x, L.entrance.y, L.vaultFront.x, L.vaultFront.y)).not.toBeNull();
    // 民間人は関係者エリアに入れない
    expect(findPath(g, 'civ', 41.5, 30, L.vaultFront.x, L.vaultFront.y)?.at(-1)?.y ?? 99).toBeGreaterThan(20);
  });
});

describe('reporting', () => {
  it('needs suspicious behaviour during the 5 second observation', () => {
    const g = game();
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.x = 41.5;
    c.y = 30.5;
    computeVisibility(g);
    expect(g.vis.bank.units.has(c.id)).toBe(true);
    // 素顔・ロビーでは即通報できない
    expect(issue(g, 'bank', { t: 'report', target: c.id })).not.toBeNull();
    // 何もしていなければ誤認
    issue(g, 'bank', { t: 'observe', target: c.id, holding: true });
    run(g, CONFIG.observe.duration + 0.2);
    expect(g.phase).toBe('casing');
    expect(g.observe.result).toBe('fail');
  });

  it('calls the police when suspicious behaviour is observed', () => {
    const g = game();
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.x = 41.5;
    c.y = 30.5;
    computeVisibility(g);
    issue(g, 'bank', { t: 'observe', target: c.id, holding: true });
    for (let i = 0; i < (CONFIG.observe.duration + 0.2) * CONFIG.tickRate; i++) {
      c.action = { kind: 'medkit', t: 0, dur: 99, target: c.id };
      c.x = 41.5;
      c.y = 30.5;
      step(g, DT);
    }
    expect(g.phase).toBe('response');
  });

  it('allows an instant report for masked crew or crew in a private area', () => {
    const g = game();
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.x = 41.5;
    c.y = 30.5;
    c.masked = true;
    computeVisibility(g);
    expect(issue(g, 'bank', { t: 'report', target: c.id })).toBeNull();
    expect(g.phase).toBe('response');
  });

  it('needs a short continuous sighting before a staff-only intruder is reportable', () => {
    const g = game();
    const c = g.units.find((u) => u.kind === 'crew')!;
    // 警備室（関係者エリア）の中、警備員の目の前
    c.x = 21.5;
    c.y = 19.5;
    computeVisibility(g);
    expect(g.vis.bank.units.has(c.id)).toBe(true);
    expect(issue(g, 'bank', { t: 'report', target: c.id })).not.toBeNull();
    for (let i = 0; i < (CONFIG.observe.privateGrace + 0.3) * CONFIG.tickRate; i++) {
      c.x = 21.5;
      c.y = 19.5;
      c.path = [];
      step(g, DT);
    }
    expect(issue(g, 'bank', { t: 'report', target: c.id })).toBeNull();
    expect(g.phase).toBe('response');
  });

  it('hides crew from a looped camera', () => {
    const g = game();
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.x = 41.5;
    c.y = 30.5;
    for (const cam of g.cameras) cam.loop = 100;
    // 支店長室の窓からも見えない位置
    c.x = 30.5;
    c.y = 36.5;
    computeVisibility(g);
    expect(g.vis.bank.units.has(c.id)).toBe(false);
  });
});

describe('hostage exchange and stock', () => {
  it('grants a negotiation card and one purchase during the assault', () => {
    const g = game();
    callPolice(g, 'test');
    g.phase = 'assault';
    expect(issue(g, 'crew', { t: 'buyStock', item: 'barricade' })).not.toBeNull();
    const civ = makeUnit(g, 'civilian', 40, 30);
    civ.brain = { state: 'hostage', timer: 0, errands: 0 };
    expect(issue(g, 'crew', { t: 'release' })).toBeNull();
    expect(g.negotiation.cards).toBe(1);
    expect(issue(g, 'crew', { t: 'buyStock', item: 'barricade' })).toBeNull();
    expect(g.stock.barricade).toBe(1);
    expect(issue(g, 'crew', { t: 'buyStock', item: 'barricade' })).not.toBeNull();
  });
});

describe('police and keycard gimmicks', () => {
  it('lets SWAT blow a hole in a wall', () => {
    const g = game();
    callPolice(g, 'test');
    g.phase = 'assault';
    g.cp = 200;
    const swat = makeUnit(g, 'swat', 30.5, 40.5);
    const wall = idx(30, 39);
    expect(issue(g, 'bank', { t: 'act', id: swat.id, kind: 'wallbreach', target: wall })).toBeNull();
    run(g, CONFIG.wallBreach.plantTime + CONFIG.wallBreach.fuse + 1);
    expect(g.holes).toContain(wall);
    expect(passable(g, 'bank', 30, 39)).toBe(true);
  });

  it('opens the vault with the manager keycard taken from the drilled office', () => {
    const g = game();
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.masked = true;
    g.stock.drill = 1;
    const door = officeDoor(g);
    c.x = 56.5;
    c.y = 15.2;
    expect(issue(g, 'crew', { t: 'act', id: c.id, kind: 'officedrill', target: door.id })).toBeNull();
    run(g, CONFIG.breach.installTime + CONFIG.breach.officeDrill.time + 1);
    expect(door.destroyed).toBe(true);
    const card = g.bags.find((b) => b.kind === 'keycard')!;
    issue(g, 'crew', { t: 'act', id: c.id, kind: 'pickup', target: card.id });
    run(g, 6);
    expect(c.hasKey).toBe(true);
    issue(g, 'crew', { t: 'act', id: c.id, kind: 'keycard', target: 0 });
    run(g, 20);
    expect(g.breach.open).toBe(true);
  });

  it('keeps the manager office closed to explosives', () => {
    const g = game();
    const c = g.units.find((u) => u.kind === 'crew')!;
    expect(issue(g, 'crew', { t: 'act', id: c.id, kind: 'c4', target: officeDoor(g).id })).not.toBeNull();
  });

  it('sells medkits during the assault without a ticket', () => {
    const g = game();
    callPolice(g, 'test');
    g.phase = 'assault';
    const c = g.units.find((u) => u.kind === 'crew')!;
    c.hp = 50;
    expect(issue(g, 'crew', { t: 'act', id: c.id, kind: 'medkit', target: c.id })).toBeNull();
    expect(issue(g, 'crew', { t: 'act', id: c.id, kind: 'equip', target: c.id })).not.toBeNull();
  });

  it('speeds up the police when something explodes while they are on the way', () => {
    const g = game();
    callPolice(g, 'test');
    g.phaseTime = 5;
    const c = g.units.find((u) => u.kind === 'crew')!;
    const shutter = g.doors[L.doorSlots.findIndex((d) => d.id === 'shutter')]!;
    c.x = 65.5;
    c.y = 6.4;
    expect(issue(g, 'crew', { t: 'act', id: c.id, kind: 'c4', target: shutter.id })).toBeNull();
    run(g, CONFIG.actions.c4.time + CONFIG.actions.c4.fuse + 0.5);
    expect(shutter.destroyed).toBe(true);
    expect(CONFIG.phase.responseSeconds - g.phaseTime).toBeLessThanOrEqual(CONFIG.phase.blastResponse);
  });

  it('lets the crew replace fallen members up to the living cap', () => {
    const g = game();
    for (let i = g.crewHired; i < CONFIG.crew.max; i++) expect(issue(g, 'crew', { t: 'hire' })).toBeNull();
    expect(issue(g, 'crew', { t: 'hire' })).not.toBeNull();
    g.units.find((u) => u.kind === 'crew')!.alive = false;
    expect(issue(g, 'crew', { t: 'hire' })).toBeNull();
  });

  it('stops guard hiring once the alarm is raised', () => {
    const g = game();
    expect(issue(g, 'bank', { t: 'hire' })).toBeNull();
    callPolice(g, 'test');
    expect(issue(g, 'bank', { t: 'hire' })).not.toBeNull();
  });
});

describe('movement through doorways', () => {
  it('lets four carriers walk out of the vault to the van together', () => {
    const g = game();
    callPolice(g, 'test');
    g.breach.open = true;
    g.doors[L.doorSlots.findIndex((d) => d.id === 'shutter')]!.jammed = true;
    const crew = [0, 1, 2].map(() => spawnCrew(g, false));
    crew.push(g.units.find((u) => u.kind === 'crew')!);
    const bags = g.bags.filter((b) => b.kind === 'gold');
    crew.forEach((u, i) => {
      u.x = 36.5 + i * 2;
      u.y = 10.5;
      bags[i]!.state = 'carried';
      bags[i]!.carrier = u.id;
      u.carrying = bags[i]!.id;
    });
    for (const u of crew) expect(issue(g, 'crew', { t: 'act', id: u.id, kind: 'deposit', target: 0 })).toBeNull();
    run(g, 45);
    expect(g.van!.bags).toBe(4);
  });

  it('lets two units pass each other head-on in the corridor', () => {
    const g = game();
    const [a, b] = g.units.filter((u) => u.kind === 'crew');
    a!.x = 30.5;
    a!.y = 15;
    b!.x = 44.5;
    b!.y = 15;
    issue(g, 'crew', { t: 'move', ids: [a!.id], x: 44.5, y: 15 });
    issue(g, 'crew', { t: 'move', ids: [b!.id], x: 30.5, y: 15 });
    run(g, 12);
    expect(a!.x).toBeGreaterThan(43);
    expect(b!.x).toBeLessThan(32);
  });

  it('gets every guard out of the security room', () => {
    const g = game();
    for (let i = 1; i < CONFIG.guard.max; i++) issue(g, 'bank', { t: 'hire' });
    const guards = g.units.filter((u) => u.kind === 'guard');
    expect(guards.length).toBe(CONFIG.guard.max);
    issue(g, 'bank', { t: 'move', ids: guards.map((u) => u.id), x: 40, y: 14.6 });
    run(g, 25);
    for (const u of guards) expect(Math.hypot(u.x - 40, u.y - 14.6)).toBeLessThan(2.5);
  });
});

describe('crew counterplay', () => {
  it('reveals installed cameras with the security plan', () => {
    const g = game();
    issue(g, 'bank', { t: 'camera', x: 45.4, y: 14.4, dir: Math.PI });
    expect(issue(g, 'crew', { t: 'intel' })).toBeNull();
    computeVisibility(g);
    for (const c of g.cameras) expect(g.vis.crew.cameras.has(c.id)).toBe(true);
  });

  it('protects heavy armor from most tear gas damage', () => {
    const g = game();
    callPolice(g, 'test');
    g.phase = 'assault';
    const [a, b] = g.units.filter((u) => u.kind === 'crew');
    a!.x = b!.x = 40;
    a!.y = b!.y = 30;
    b!.heavy = true;
    g.gases.push({ id: 999, x: 40, y: 30, t: CONFIG.gas.duration });
    run(g, CONFIG.gas.duration);
    expect(b!.hp).toBeGreaterThan(a!.hp);
  });
});

describe('full AI matches', () => {
  const plans = [
    { breach: 'drill', escape: 'van' },
    { breach: 'thermal', escape: 'fulton' },
    { breach: 'charge', escape: 'van' },
    { breach: 'drill', escape: 'fulton' },
  ] as const;
  for (const [i, plan] of plans.entries()) {
    it(`finishes (${plan.breach}/${plan.escape})`, { timeout: 30_000 }, () => {
      const g = createGame({ seed: 100 + i, plan: { ...plan }, ai: { bank: true, crew: true } });
      const total = CONFIG.phase.casingSeconds + CONFIG.phase.responseSeconds + CONFIG.phase.assaultSeconds + 5;
      run(g, total);
      expect(g.phase).toBe('ended');
      expect(g.winner).not.toBeNull();
    });
  }
});
