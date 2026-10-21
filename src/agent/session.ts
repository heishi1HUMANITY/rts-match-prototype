import { CONFIG, type BreachMethod, type EscapeMethod } from '../config';
import { LEVEL as L, idx, useLayout } from '../map/level';
import { pickErrand } from '../sim/civ';
import { type Command, issue } from '../sim/commands';
import { createGame } from '../sim/create';
import { step } from '../sim/step';
import type { Game, Side, Unit } from '../sim/types';
import { computeVisibility, emptyVis } from '../sim/vision';
import { active } from '../sim/world';
import { instantlyReportable } from '../sim/rules';

// エージェント対戦のセッション。両陣営が n 秒ごとにコマンドを出し、両方そろったら n 秒進める。
// 状態はJSONで保存し、CLI呼び出しをまたいで続ける。

export type AgentCommand =
  | Command
  | { t: 'plan'; breach: BreachMethod; escape: EscapeMethod }
  | { t: 'blend'; ids: number[] }
  | { t: 'patrol'; ids: number[]; points: { x: number; y: number }[] }
  | { t: 'stop'; ids: number[] }
  | { t: 'observeQueue'; targets: string[] }
  | { t: 'autoReport'; on: boolean };

export interface AgentSession {
  version: 1;
  seed: number;
  layout: number;
  every: number;
  turn: number;
  game: Omit<Game, 'vis'>;
  ai: Record<Side, boolean>;
  pending: Partial<Record<Side, unknown[]>>;
  waitingSince: number;
  macros: {
    blend: number[];
    blendWait: Record<number, number>;
    patrol: Record<number, { points: { x: number; y: number }[]; i: number; wait: number }>;
    observeQueue: string[];
    autoReport: boolean;
    unitQueue: Record<string, unknown[]>; // 同じターンに同じユニットへ出した2つ目以降の命令（前の命令が終わったら実行）
    policeQueue: unknown[]; // 警察到着前に出した警察への命令（到着した瞬間に実行）
  };
  sightings: Record<Side, Record<string, { x: number; y: number; t: number; what: string }>>;
  alias: Record<Side, { toReal: Record<string, number>; toAlias: Record<number, string>; next: number }>;
  eventCursor: Record<Side, number>;
  crewSeenCams: number[];
  results: Record<Side, string[]>;
  history: { turn: number; time: number; phase: string; side: Side; commands: unknown[]; results: string[] }[];
  result: null | { winner: Side | null; reason: string; time: number; turn: number; stats: Game['stats']; plan: Game['plan']; loud: string; bags: number };
}

export function hydrate(s: AgentSession): Game {
  const g = s.game as Game;
  g.layout ??= s.layout ?? 0;
  useLayout(g.layout);
  g.vis = { bank: emptyVis(), crew: emptyVis() };
  computeVisibility(g);
  return g;
}

export function dehydrate(s: AgentSession, g: Game): void {
  const { vis: _vis, ...rest } = g;
  void _vis;
  s.game = rest;
}

export function newSession(opts: {
  seed: number;
  every: number;
  layout?: number;
  ai?: Partial<Record<Side, boolean>>;
  plan?: { breach: BreachMethod; escape: EscapeMethod };
}): AgentSession {
  const ai = { bank: !!opts.ai?.bank, crew: !!opts.ai?.crew };
  const layout = opts.layout ?? 0;
  const g = createGame({ seed: opts.seed, plan: opts.plan ?? { breach: 'drill', escape: 'van' }, ai, layout });
  const s: AgentSession = {
    version: 1,
    seed: opts.seed,
    layout,
    every: opts.every,
    turn: 0,
    game: g,
    ai,
    pending: {},
    waitingSince: 0,
    macros: { blend: [], blendWait: {}, patrol: {}, observeQueue: [], autoReport: true, unitQueue: {}, policeQueue: [] },
    sightings: { bank: {}, crew: {} },
    alias: { bank: { toReal: {}, toAlias: {}, next: 0 }, crew: { toReal: {}, toAlias: {}, next: 0 } },
    eventCursor: { bank: 0, crew: 0 },
    crewSeenCams: [],
    results: { bank: [], crew: [] },
    history: [],
    result: null,
  };
  dehydrate(s, g);
  return s;
}

// ---- 他陣営ユニットの呼び名（IDの並びから正体が漏れないよう、出会った順に乱数の番号を振る） ----
export function aliasOf(s: AgentSession, side: Side, u: Unit): string {
  const a = s.alias[side];
  const known = a.toAlias[u.id];
  if (known) return known;
  const prefix =
    side === 'bank'
      ? u.kind === 'staff'
        ? 'S'
        : u.kind === 'manager'
          ? 'M'
          : 'P'
      : u.kind === 'guard'
        ? 'G'
        : u.kind === 'swat'
          ? 'W'
          : u.kind === 'staff'
            ? 'S'
            : 'P';
  let n: number;
  do {
    a.next = (a.next * 1103515245 + 12345 + s.seed + (side === 'bank' ? 7 : 3)) & 0x7fffffff;
    n = 1000 + (a.next % 9000);
  } while (a.toReal[`${prefix}${n}`] !== undefined);
  const name = `${prefix}${n}`;
  a.toAlias[u.id] = name;
  a.toReal[name] = u.id;
  return name;
}

function realId(s: AgentSession, side: Side, ref: unknown): number | null {
  if (typeof ref === 'number') return ref;
  if (typeof ref === 'string') {
    if (/^\d+$/.test(ref)) return Number(ref);
    const r = s.alias[side].toReal[ref.trim()];
    return r ?? null;
  }
  return null;
}

export function ownUnit(side: Side, u: Unit): boolean {
  return side === 'crew' ? u.kind === 'crew' : u.kind === 'guard' || u.kind === 'swat' || u.kind === 'sniper';
}

// ---- コマンドの適用 ----
function applyOne(s: AgentSession, g: Game, side: Side, raw: unknown): string {
  if (!raw || typeof raw !== 'object') return 'error: コマンドはオブジェクトで指定してください';
  const c = { ...(raw as Record<string, unknown>) };
  const t = c.t;
  const ids = Array.isArray(c.ids) ? (c.ids as unknown[]).map((x) => realId(s, side, x)).filter((x): x is number => x !== null) : [];
  const dropMacros = (list: number[]) => {
    s.macros.blend = s.macros.blend.filter((id) => !list.includes(id));
    for (const id of list) delete s.macros.patrol[id];
  };
  switch (t) {
    case 'plan':
      return 'error: 作戦計画は最初のターンにだけ指定できます';
    case 'blend': {
      if (side !== 'crew') return 'error: blend は強盗側のみ';
      const own = ids.filter((id) => g.units.some((u) => u.id === id && u.kind === 'crew' && active(u)));
      dropMacros(own);
      s.macros.blend.push(...own);
      return own.length ? `ok: ${own.length}人が客のふりで館内を回る` : 'error: 対象のクルーがいません';
    }
    case 'patrol': {
      if (side !== 'bank') return 'error: patrol は銀行側のみ';
      const pts = Array.isArray(c.points) ? (c.points as { x: number; y: number }[]).filter((p) => typeof p?.x === 'number' && typeof p?.y === 'number') : [];
      if (!pts.length) return 'error: points が必要です';
      const own = ids.filter((id) => g.units.some((u) => u.id === id && (u.kind === 'guard' || u.kind === 'swat') && active(u)));
      dropMacros(own);
      for (const id of own) s.macros.patrol[id] = { points: pts, i: -1, wait: 0 };
      return own.length ? `ok: ${own.length}人が巡回` : 'error: 対象のユニットがいません';
    }
    case 'stop': {
      dropMacros(ids);
      for (const id of ids) {
        const u = g.units.find((x) => x.id === id);
        if (u && ownUnit(side, u)) {
          u.order = null;
          u.path = [];
          u.action = null;
        }
      }
      return 'ok';
    }
    case 'autoReport': {
      if (side !== 'bank') return 'error: 銀行側のみ';
      s.macros.autoReport = c.on !== false;
      return `ok: auto report ${s.macros.autoReport ? 'on' : 'off'}`;
    }
    case 'observeQueue': {
      if (side !== 'bank') return 'error: 銀行側のみ';
      const targets = Array.isArray(c.targets) ? (c.targets as unknown[]).map(String) : [];
      s.macros.observeQueue = targets.filter((x) => s.alias.bank.toReal[x] !== undefined);
      return `ok: ${s.macros.observeQueue.length}人を順に観察`;
    }
  }
  // ここからはゲーム本体のコマンド
  if (c.ids) c.ids = ids;
  if ('id' in c) {
    const id = realId(s, side, c.id);
    if (id === null) return 'error: id が不明です';
    c.id = id;
  }
  if (t === 'move' || t === 'attack' || t === 'act' || t === 'mask') dropMacros(t === 'act' ? [c.id as number] : ids);
  if (t === 'observe' || t === 'report' || (t === 'attack' && (c.targetKind ?? 'unit') === 'unit') || (t === 'act' && (c.kind === 'bribe' || c.kind === 'hostage'))) {
    const id = realId(s, side, c.target);
    if (id === null) return `error: 対象 ${String(c.target)} が見つかりません`;
    c.target = id;
    if (t === 'attack' && !c.targetKind) c.targetKind = 'unit';
  }
  if (t === 'attack' && c.targetKind === 'roadblock' && typeof c.target === 'string') {
    const r = g.roadblocks.find((x) => x.slot === c.target);
    if (!r) return `error: 封鎖 ${c.target} はありません`;
    c.target = r.id;
  }
  if (t === 'secdoor' && typeof c.slot === 'string') {
    const k = L.doorSlots.findIndex((d) => d.id === c.slot);
    if (k < 0) return `error: 扉 ${c.slot} はありません`;
    c.slot = k;
  }
  if (t === 'camera' && typeof c.dir === 'number') c.dir = (c.dir * Math.PI) / 180;
  if (t === 'observe') {
    s.macros.observeQueue = [];
    if (c.holding === undefined) c.holding = true;
  }
  if (t === 'act' && c.kind === 'wallbreach' && typeof c.x === 'number' && typeof c.y === 'number') c.target = idx(Math.floor(c.x), Math.floor(c.y));
  // 金塊は "nearest" で一番近いものを拾える
  if (t === 'act' && c.kind === 'pickup' && (c.target === 'nearest' || c.target === 'gold')) {
    const u = g.units.find((x) => x.id === c.id);
    const bags = g.bags.filter((b) => b.kind === 'gold' && (b.state === 'ground' || (b.state === 'vault' && g.breach.open)));
    const taken = new Set(g.units.filter((x) => x.order?.type === 'act' && x.order.kind === 'pickup').map((x) => (x.order as { target: number }).target));
    const pool = bags.filter((b) => !taken.has(b.id));
    const best = u ? (pool.length ? pool : bags).sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0] : undefined;
    if (!best) return 'error: 拾える金塊がありません（金庫が開いていないかもしれません）';
    c.target = best.id;
  }
  if (t === 'act' && (c.kind === 'install' || c.kind === 'fix' || c.kind === 'keycard' || c.kind === 'deposit' || c.kind === 'fulton' || c.kind === 'extract' || c.kind === 'equip' || c.kind === 'medkit') && c.target === undefined)
    c.target = c.kind === 'equip' || c.kind === 'medkit' ? c.id : 0;
  if (t === 'act' && c.kind === 'sabotage' && c.target === undefined) c.target = 0;
  if (t === 'attack' && Array.isArray(c.ids) && !c.ids.length) return 'error: ids が空です';
  try {
    const err = issue(g, side, c as Command);
    return err ? `error: ${err}` : 'ok';
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

// 1つのユニットだけに向けた命令ならそのユニットのIDを返す
function singleUnit(s: AgentSession, side: Side, raw: unknown): number | null {
  const c = raw as Record<string, unknown>;
  if (!c || typeof c !== 'object') return null;
  if ('id' in c && c.t === 'act') return realId(s, side, c.id);
  if (Array.isArray(c.ids) && c.ids.length === 1 && (c.t === 'move' || c.t === 'attack' || c.t === 'mask' || c.t === 'stop' || c.t === 'blend')) return realId(s, side, c.ids[0]);
  return null;
}

const POLICE = ['swat', 'sniper', 'roadblock', 'gas'];

function involvesSwat(g: Game, raw: unknown): boolean {
  const c = raw as { ids?: unknown[]; id?: unknown };
  const ids = [...(Array.isArray(c.ids) ? c.ids : []), ...(c.id !== undefined ? [c.id] : [])];
  return ids.some((id) => g.units.some((u) => u.id === Number(id) && u.kind === 'swat'));
}

function applyAll(s: AgentSession, g: Game, side: Side, cmds: unknown[]): string[] {
  const seen = new Set<number>();
  return cmds.slice(0, 25).map((c, i) => {
    const t = (c as { t?: string })?.t ?? '';
    // 交渉による待機中の警察への命令は、待機が明けた瞬間に実行する（20秒の手番で丸ごと無駄にならないように）
    if (side === 'bank' && g.phase === 'assault' && g.negotiation.freeze > 0 && (POLICE.includes(t) || involvesSwat(g, c))) {
      s.macros.policeQueue.push(c);
      return `${i + 1}. queued: police are on a negotiation stand-down for ${Math.ceil(g.negotiation.freeze)}s; runs right after`;
    }
    if (side === 'bank' && g.phase === 'response' && POLICE.includes(t)) {
      // 到着時のCPを超える予約は受け付けない（到着時に失敗して気づけないため）
      const cost = (x: unknown) => {
        const k = (x as { t?: string }).t;
        return k === 'swat' ? CONFIG.swat.cost : k === 'sniper' ? CONFIG.sniper.cost : k === 'roadblock' ? CONFIG.roadblock.cost : k === 'gas' ? CONFIG.gas.cost : 0;
      };
      const planned = s.macros.policeQueue.reduce<number>((a, x) => a + cost(x), 0);
      if (planned + cost(c) > CONFIG.police.cpStart)
        return `${i + 1}. error: the police arrive with ${CONFIG.police.cpStart} CP and ${planned} CP is already queued; this order (${cost(c)} CP) does not fit`;
      s.macros.policeQueue.push(c);
      return `${i + 1}. queued (${planned + cost(c)}/${CONFIG.police.cpStart} CP): runs the moment the police arrive`;
    }
    const id = singleUnit(s, side, c);
    const cc = c as { t?: string; kind?: string; target?: unknown };
    const waitsForVault = cc.t === 'act' && cc.kind === 'pickup' && !g.breach.open && (cc.target === 'nearest' || cc.target === 'gold' || g.bags.some((b) => b.id === cc.target && b.state === 'vault'));
    if (id !== null) {
      const key = `${side}:${id}`;
      if (!seen.has(id) && waitsForVault) {
        seen.add(id);
        s.macros.unitQueue[key] = [c];
        return `${i + 1}. queued: #${id} will pick up gold as soon as the vault opens`;
      }
      if (seen.has(id)) {
        (s.macros.unitQueue[key] ??= []).push(c);
        return `${i + 1}. queued: runs after #${id} finishes its previous order`;
      }
      seen.add(id);
      delete s.macros.unitQueue[key];
    }
    return `${i + 1}. ${applyOne(s, g, side, c)}`;
  });
}

// ---- 1ティックごとの補助操作（客のふり・巡回・観察の連続実行） ----
function macros(s: AgentSession, g: Game) {
  const m = s.macros;
  m.blend = m.blend.filter((id) => g.units.some((u) => u.id === id && u.kind === 'crew' && active(u)));
  if (g.phase === 'casing') {
    for (const id of m.blend) {
      const u = g.units.find((x) => x.id === id)!;
      if (u.order || u.action || u.path.length) continue;
      m.blendWait[id] = (m.blendWait[id] ?? 0) - 1 / CONFIG.tickRate;
      if (m.blendWait[id]! > 0) continue;
      const e = pickErrand(g);
      issue(g, 'crew', { t: 'move', ids: [id], x: e.p.x, y: e.p.y });
      m.blendWait[id] = e.wait;
    }
  }
  for (const [key, p] of Object.entries(m.patrol)) {
    const u = g.units.find((x) => x.id === Number(key));
    if (!u || !active(u)) {
      delete m.patrol[Number(key)];
      continue;
    }
    if (u.order || u.action || u.path.length) continue;
    p.wait -= 1 / CONFIG.tickRate;
    if (p.wait > 0) continue;
    p.i = (p.i + 1) % p.points.length;
    const pt = p.points[p.i]!;
    issue(g, 'bank', { t: 'move', ids: [u.id], x: pt.x, y: pt.y });
    p.wait = 2;
  }
  // 見えた瞬間に通報できる人物は自動で通報する（ターン制で気づきが遅れないように）
  if (g.phase === 'casing' && m.autoReport && !s.ai.bank && g.tick % 3 === 0) {
    for (const u of g.units) {
      if ((u.kind === 'crew' || u.kind === 'civilian') && u.alive && g.vis.bank.units.has(u.id) && instantlyReportable(u)) {
        if (!issue(g, 'bank', { t: 'report', target: u.id })) break;
      }
    }
  }
  // 前の命令が終わったユニットに、次の命令を出す
  for (const [key, list] of Object.entries(m.unitQueue)) {
    const [side, idStr] = key.split(':') as [Side, string];
    const u = g.units.find((x) => x.id === Number(idStr));
    if (!u || !active(u) || !list.length) {
      delete m.unitQueue[key];
      continue;
    }
    // 気絶中（爆風など）は操作できないので、起き上がるまで待つ
    if (u.stun > 0 || u.order || u.action || u.path.length || m.blend.includes(u.id) || m.patrol[u.id]) continue;
    // 金庫が開くまで、金塊の回収は待たせておく
    const head = list[0] as { t?: string; kind?: string; target?: unknown };
    if (head?.t === 'act' && head.kind === 'pickup' && !g.breach.open && (head.target === 'nearest' || head.target === 'gold' || g.bags.some((b) => b.id === head.target && b.state === 'vault'))) continue;
    const next = list.shift()!;
    const r = applyOne(s, g, side, next);
    if (r.startsWith('error')) s.results[side].push(`(queued for #${u.id}) ${r}`);
    if (!list.length) delete m.unitQueue[key];
  }
  // 逃走は成立した瞬間に勝ちなので、条件がそろったら自動でバンを出す（20秒刻みの手番で取り逃がさない）
  if (!s.ai.crew && g.van && g.van.state === 'parked' && g.van.bags >= CONFIG.gold.quotaBags && g.tick % 3 === 0) {
    if (!issue(g, 'crew', { t: 'escape' })) s.results.crew.push('(auto) the van left as soon as the quota was loaded');
  }
  if (g.phase === 'assault' && m.policeQueue.length && g.negotiation.freeze <= 0) {
    for (const c of m.policeQueue) s.results.bank.push(`(queued police order) ${applyOne(s, g, 'bank', c)}`);
    m.policeQueue = [];
  }
  if (g.phase === 'casing' && m.observeQueue.length && !g.observe.holding && g.observe.cooldown <= 0) {
    while (m.observeQueue.length) {
      const id = s.alias.bank.toReal[m.observeQueue.shift()!];
      if (id !== undefined && g.vis.bank.units.has(id) && !issue(g, 'bank', { t: 'observe', target: id, holding: true })) break;
    }
  }
}

// ターンの途中で見えた敵の最後の位置を覚えておく（人間なら画面で見ているはずの情報）
function recordSightings(s: AgentSession, g: Game) {
  for (const u of g.units) {
    if (!active(u)) continue;
    if ((u.kind === 'guard' || u.kind === 'swat') && g.vis.crew.units.has(u.id)) {
      s.sightings.crew[aliasOf(s, 'crew', u)] = { x: u.x, y: u.y, t: g.time, what: u.kind };
    }
    if (u.kind === 'crew' && g.vis.bank.units.has(u.id) && (g.phase !== 'casing' || instantlyReportable(u) || u.action || u.carrying >= 0)) {
      const what = u.masked ? 'masked robber' : u.carrying >= 0 ? 'person carrying a money bag' : u.action ? 'person doing something' : 'person';
      s.sightings.bank[aliasOf(s, 'bank', u)] = { x: u.x, y: u.y, t: g.time, what };
    }
  }
}

// 両陣営のコマンドを適用して every 秒進める
export function advance(s: AgentSession): void {
  let g = hydrate(s);
  const crewCmds = (s.pending.crew ?? []) as unknown[];
  // 最初のターンだけ、強盗側の作戦計画で試合を作り直す
  if (s.turn === 0) {
    const plan = crewCmds.find((c) => (c as { t?: string })?.t === 'plan') as { breach?: BreachMethod; escape?: EscapeMethod } | undefined;
    if (plan && plan.breach && plan.escape && ['drill', 'thermal', 'charge'].includes(plan.breach) && ['van', 'fulton'].includes(plan.escape)) {
      g = createGame({ seed: s.seed, plan: { breach: plan.breach, escape: plan.escape }, ai: s.ai, layout: g.layout });
      computeVisibility(g);
    }
  }
  const order: Side[] = s.turn % 2 === 0 ? ['bank', 'crew'] : ['crew', 'bank'];
  for (const side of order) {
    const cmds = ((s.pending[side] ?? []) as unknown[]).filter((c) => !(s.turn === 0 && (c as { t?: string })?.t === 'plan'));
    const results = s.ai[side] ? [] : applyAll(s, g, side, cmds);
    if (s.turn === 0 && side === 'crew' && crewCmds.some((c) => (c as { t?: string })?.t === 'plan')) results.unshift(`plan: ${g.plan.breach} + ${g.plan.escape}`);
    s.results[side] = results;
    s.history.push({ turn: s.turn, time: g.time, phase: g.phase, side, commands: cmds, results });
  }
  const ticks = Math.round(s.every * CONFIG.tickRate);
  for (let i = 0; i < ticks && g.phase !== 'ended'; i++) {
    macros(s, g);
    step(g, 1 / CONFIG.tickRate);
    if (g.tick % 3 === 0) {
      for (const id of g.vis.crew.cameras) if (!s.crewSeenCams.includes(id)) s.crewSeenCams.push(id);
      recordSightings(s, g);
    }
  }
  computeVisibility(g);
  s.pending = {};
  s.turn++;
  if (g.phase === 'ended' && !s.result) {
    s.result = {
      winner: g.winner,
      reason: g.endReason,
      time: Math.round(g.time),
      turn: s.turn,
      stats: g.stats,
      plan: g.plan,
      loud: g.loudReason,
      bags: g.van ? g.van.bags : g.bags.filter((b) => b.state === 'secured').length,
    };
  }
  dehydrate(s, g);
}

export const DOOR_IDS = L.doorSlots.map((d) => d.id);
