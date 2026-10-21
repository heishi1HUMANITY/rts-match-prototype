import { describe, expect, it } from 'vitest';
import { H, W, buildLevel, idx, inBounds, type Level, type Pt } from './level';

const LAYOUTS = Array.from({ length: 300 }, (_, i) => i);

// 扉・金庫扉は開くものとして、正面入口から歩いて行けるタイルを数える
function reachable(lv: Level): Uint8Array {
  const seen = new Uint8Array(W * H);
  const open = (x: number, y: number) => inBounds(x, y) && (!lv.solid[idx(x, y)] || lv.vaultAt[idx(x, y)] === 1);
  const start = idx(Math.floor(lv.entrance.x), Math.floor(lv.entrance.y));
  const queue = [start];
  seen[start] = 1;
  while (queue.length) {
    const c = queue.pop()!;
    const x = c % W;
    const y = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (!open(nx, ny) || seen[idx(nx, ny)]) continue;
      seen[idx(nx, ny)] = 1;
      queue.push(idx(nx, ny));
    }
  }
  return seen;
}

function keyPoints(lv: Level): [string, Pt][] {
  const named = (name: string, ps: Pt[]) => ps.map((p, i) => [`${name}${i}`, p] as [string, Pt]);
  return [
    ...Object.entries(lv.pois).flatMap(([k, ps]) => named(k, ps)),
    ...named('staff', lv.staffPois),
    ...named('teller', lv.tellerSpots),
    ...named('bag', lv.bagSpots),
    ...named('defense', lv.defenseSpots),
    ['guardPost', lv.guardPost],
    ['vaultFront', lv.vaultFront],
    ['managerSeat', lv.managerSeat],
    ['keycard', lv.keycardSpot],
    ['entrance', lv.entrance],
    ['van', lv.vanSpot],
  ];
}

describe('branch layouts', () => {
  it('layout 0 keeps the standard floor plan', () => {
    const lv = buildLevel(0);
    const door = (id: string) => lv.doorSlots.find((s) => s.id === id)!.tiles[0];
    expect(door('office')).toEqual([35, 16]);
    expect(door('break')).toEqual([53, 13]);
    expect(lv.bagSpots[0]).toEqual({ x: 35.5, y: 9.5 });
    expect(lv.keycardSpot).toEqual({ x: 58.4, y: 19.5 });
    expect(lv.furniture.find((f) => f.type === 'kiosk')).toMatchObject({ x: 41, y: 26 });
  });

  it('every layout is fully connected and every key point is walkable', () => {
    for (const n of LAYOUTS) {
      const lv = buildLevel(n);
      const seen = reachable(lv);
      for (let i = 0; i < W * H; i++) {
        if (lv.solid[i] && !lv.vaultAt[i]) continue;
        if (!seen[i]) throw new Error(`layout ${n}: tile (${i % W},${(i / W) | 0}) is cut off`);
      }
      for (const [name, p] of keyPoints(lv)) {
        const i = idx(Math.floor(p.x), Math.floor(p.y));
        if (lv.solid[i]) throw new Error(`layout ${n}: ${name} (${p.x},${p.y}) is inside furniture or a wall`);
      }
      // 扉の両側は家具で塞がない（幅のある扉は少なくとも1タイル空いていればよい）
      for (const s of lv.doorSlots) {
        for (const k of [-1, 1]) {
          const free = s.tiles.some(([x, y]) => {
            const sx = s.vertical ? x + k : x;
            const sy = s.vertical ? y : y + k;
            return !inBounds(sx, sy) || !lv.solid[idx(sx, sy)];
          });
          if (!free) throw new Error(`layout ${n}: door ${s.id} is blocked on side ${k}`);
        }
      }
      expect(new Set(lv.bagSpots.map((p) => `${p.x},${p.y}`)).size).toBe(lv.bagSpots.length);
    }
  });

  it('layouts actually differ from match to match', () => {
    const office = new Set<number>();
    const bags = new Set<string>();
    const kiosks = new Set<string>();
    for (const n of LAYOUTS.slice(1, 60)) {
      const lv = buildLevel(n);
      office.add(lv.doorSlots.find((s) => s.id === 'office')!.tiles[0]![0]);
      bags.add(lv.bagSpots.map((p) => `${p.x},${p.y}`).join(' '));
      const k = lv.furniture.find((f) => f.type === 'kiosk')!;
      kiosks.add(`${k.x},${k.y}`);
    }
    expect(office.size).toBeGreaterThan(1);
    expect(kiosks.size).toBeGreaterThan(1);
    expect(bags.size).toBeGreaterThan(50);
  });

  it('is deterministic for the same layout number', () => {
    const a = buildLevel(1234);
    const b = buildLevel(1234);
    expect(Array.from(a.solid)).toEqual(Array.from(b.solid));
    expect(a.bagSpots).toEqual(b.bagSpots);
    expect(a.decor).toEqual(b.decor);
  });
});
