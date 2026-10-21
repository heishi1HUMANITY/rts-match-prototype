import { CONFIG } from '../config';
import { Zone, idx, inBounds } from '../map/level';
import { spawnCrew, spawnGuard } from './create';
import { callPolice, instantlyReportable, setPath, validateAction } from './rules';
import type { ActionKind, AutoMode, FortKind, Game, Order, Side, Unit } from './types';
import { los, pointSeen, sourcesFor } from './vision';
import { L, active, dist, makeUnit, news, passable, roomNameAt, unitById, zoneAt } from './world';

// 人間とAIは同じコマンドを通して操作する。成功ならnull、失敗なら理由を返す。

export type AttackKind = Extract<Order, { type: 'attack' }>['targetKind'];
export type DeployKind = Exclude<FortKind, 'drill'>;

export type Command =
  | { t: 'move'; ids: number[]; x: number; y: number }
  | { t: 'attack'; ids: number[]; targetKind: AttackKind; target: number }
  | { t: 'act'; id: number; kind: ActionKind; target: number }
  | { t: 'mask'; ids: number[] }
  | { t: 'hire' }
  | { t: 'buyStock'; item: FortKind }
  | { t: 'deploy'; item: DeployKind; x: number; y: number }
  | { t: 'camera'; x: number; y: number; dir: number }
  | { t: 'secdoor'; slot: number }
  | { t: 'sensor'; x: number; y: number }
  | { t: 'reinforce' }
  | { t: 'swat'; staging: string; x?: number; y?: number }
  | { t: 'intel' }
  | { t: 'sniper'; spot: string }
  | { t: 'roadblock'; slot: string }
  | { t: 'gas'; x: number; y: number }
  | { t: 'observe'; target: number; holding: boolean }
  | { t: 'report'; target: number }
  | { t: 'goLoud' }
  | { t: 'release' }
  | { t: 'negotiate' }
  | { t: 'escape' }
  | { t: 'auto'; ids: number[]; mode: AutoMode; on: boolean }
  | { t: 'callPlane' };

export function controllable(g: Game, side: Side, u: Unit | undefined): u is Unit {
  if (!u || !active(u) || u.stun > 0) return false;
  if (side === 'crew') return u.kind === 'crew' && !g.crewBalloons.some((b) => b.unit === u.id);
  if (u.kind === 'guard') return !u.deserting;
  if (u.kind === 'swat') return g.negotiation.freeze <= 0;
  return false;
}

const AUTO_MODE_SET = new Set<AutoMode>(['intercept', 'attack', 'hostage', 'roam']);

const SHOP_OPEN = (g: Game) => g.phase === 'casing' || g.phase === 'response';

// 突入中は人質交換で得た購入機会がある時だけ買える
function crewCanBuy(g: Game): string | null {
  if (SHOP_OPEN(g)) return null;
  if (g.phase === 'assault' && g.tickets > 0) return null;
  return g.phase === 'assault' ? '突入中は購入できません（人質を解放すると1回買えます）' : '購入できません';
}
function useTicket(g: Game) {
  if (g.phase === 'assault') g.tickets--;
}

// 上限は生きているクルーの数（警察到着前なら欠員を補充できる）
export function livingCrew(g: Game): number {
  return g.units.filter((u) => u.kind === 'crew' && u.alive && !u.escaped).length;
}

export function fortCount(g: Game, item: FortKind): number {
  const deployed = item === 'turret' ? g.turrets.length : item === 'barricade' ? g.barricades.length : item === 'trap' ? g.traps.length : 0;
  return deployed + g.stock[item];
}

export function fortMax(item: FortKind): number {
  return item === 'drill' ? 2 : CONFIG.fort[item].max;
}

export function fortCost(item: FortKind): number {
  return item === 'drill' ? CONFIG.breach.officeDrill.cost : CONFIG.fort[item].cost;
}

export function issue(g: Game, side: Side, c: Command): string | null {
  if (g.phase === 'ended') return '試合は終了しました';
  switch (c.t) {
    case 'auto': {
      // 自動行動の切り替え（迎撃・攻撃・人質・徘徊）
      if (!AUTO_MODE_SET.has(c.mode)) return '自動行動の種類が違います';
      if (c.mode === 'hostage' && side !== 'crew') return '人質は強盗団だけが取れます';
      const units = c.ids.map((id) => unitById(g, id)).filter((u): u is Unit => !!u && active(u) && (side === 'crew' ? u.kind === 'crew' : u.kind === 'guard' || u.kind === 'swat'));
      if (!units.length) return '自陣営の戦闘員を選んでください';
      for (const u of units) {
        u.auto[c.mode] = c.on;
        if (c.on && (c.mode === 'roam' || c.mode === 'intercept')) u.auto.home = { x: u.x, y: u.y };
        if (!c.on && c.mode === 'intercept') u.auto.engaged = false;
      }
      return null;
    }
    case 'callPlane': {
      // フルトン回収機を呼ぶ（呼んだときだけ来る）
      if (side !== 'crew') return '強盗団だけが呼べます';
      if (g.plan.escape !== 'fulton') return 'フルトン回収を計画していません';
      const p = g.plane;
      if (p.eta >= 0 || p.pass > 0) return '回収機はすでに向かっています';
      if (p.cooldown > 0) return `回収機は旋回中です（あと${Math.ceil(p.cooldown)}秒）`;
      p.eta = CONFIG.escape.fulton.arriveTime;
      news(g, `回収機を要請 — ${p.eta}秒後にホテル屋上の上空を通過`, 'crew');
      return null;
    }
    case 'move': {
      let n = 0;
      const units = c.ids.map((id) => unitById(g, id)).filter((u) => controllable(g, side, u));
      units.forEach((u, i) => {
        // 複数選択時は少し散らして同じ点に重ならないようにする
        const ring = i === 0 ? 0 : 0.7 + 0.25 * Math.floor((i - 1) / 6);
        const a = (i * Math.PI * 2) / 6;
        const tx = c.x + Math.cos(a) * ring;
        const ty = c.y + Math.sin(a) * ring;
        u.action = null;
        if (setPath(g, u, tx, ty) || setPath(g, u, c.x, c.y)) {
          u.order = { type: 'move', x: tx, y: ty };
          u.autoOrder = false;
          // 迎撃・徘徊の持ち場は、手動で動かした先に移る
          u.auto.home = u.auto.roam || u.auto.intercept ? { x: tx, y: ty } : u.auto.home;
          u.auto.engaged = false;
          n++;
        }
      });
      return n ? null : 'そこへは移動できません';
    }
    case 'attack': {
      if (g.phase !== 'response' && g.phase !== 'assault') return '警報前は撃てません';
      let n = 0;
      for (const id of c.ids) {
        const u = unitById(g, id);
        if (!controllable(g, side, u)) continue;
        u.action = null;
        u.order = { type: 'attack', target: c.target, targetKind: c.targetKind };
        u.autoOrder = false;
        u.repath = 0;
        n++;
      }
      return n ? null : '攻撃できるユニットがいません';
    }
    case 'act': {
      const u = unitById(g, c.id);
      if (!controllable(g, side, u)) return '操作できません';
      if (c.kind === 'equip') {
        const err = crewCanBuy(g);
        if (err) return err;
      }
      // 距離以外の条件はその場で確かめる（届いてから失敗しないように）
      const pre = validateAction(g, u, c.kind, c.target);
      if (pre) return pre;
      u.action = null;
      u.order = { type: 'act', kind: c.kind, target: c.target, x: u.x, y: u.y, reach: 0 };
      u.autoOrder = false;
      u.path = [];
      u.repath = 0;
      return null;
    }
    case 'mask': {
      if (side !== 'crew') return null;
      for (const id of c.ids) {
        const u = unitById(g, id);
        if (u && u.kind === 'crew' && u.alive && !u.masked) {
          u.masked = true;
          news(g, `${u.callsign}: マスク装着`, 'crew');
        }
      }
      return null;
    }
    case 'hire': {
      if (!SHOP_OPEN(g)) return '警察到着後は雇えません';
      if (side === 'bank' && g.phase !== 'casing') return '警報後は警備員を増やせません';
      if (side === 'crew') {
        if (livingCrew(g) >= CONFIG.crew.max) return `クルーは同時に${CONFIG.crew.max}人までです`;
        if (g.funds.crew < CONFIG.crew.hireCost) return '資金が足りません';
        g.funds.crew -= CONFIG.crew.hireCost;
        const u = spawnCrew(g, false);
        news(g, `新しいクルー ${u.callsign} が合流`, 'crew');
      } else {
        const n = g.units.filter((u) => u.kind === 'guard' && u.alive && !u.deserting).length;
        if (n >= CONFIG.guard.max) return `警備員は最大${CONFIG.guard.max}人までです`;
        if (g.funds.bank < CONFIG.guard.hireCost) return '予算が足りません';
        g.funds.bank -= CONFIG.guard.hireCost;
        spawnGuard(g);
        news(g, '警備員を1名増員', 'bank');
      }
      return null;
    }
    case 'buyStock': {
      if (side !== 'crew') return null;
      const err = crewCanBuy(g);
      if (err) return err;
      const cost = fortCost(c.item);
      if (fortCount(g, c.item) >= fortMax(c.item)) return '上限に達しています';
      if (g.funds.crew < cost) return '資金が足りません';
      g.funds.crew -= cost;
      g.stock[c.item]++;
      useTicket(g);
      return null;
    }
    case 'deploy': {
      if (side !== 'crew') return null;
      if (g.stock[c.item] <= 0) return '在庫がありません';
      const tx = Math.floor(c.x);
      const ty = Math.floor(c.y);
      if (!passable(g, 'bank', tx, ty) || !inBounds(tx, ty)) return 'そこには置けません';
      if (L.doorAt[idx(tx, ty)]! >= 0 && c.item === 'turret') return '扉の上にタレットは置けません';
      const occupied =
        g.turrets.some((t) => Math.floor(t.x) === tx && Math.floor(t.y) === ty) ||
        g.barricades.some((t) => Math.floor(t.x) === tx && Math.floor(t.y) === ty) ||
        g.traps.some((t) => Math.floor(t.x) === tx && Math.floor(t.y) === ty);
      if (occupied) return 'すでに設置物があります';
      const x = tx + 0.5;
      const y = ty + 0.5;
      const near = g.units.some((u) => u.kind === 'crew' && active(u) && dist(u.x, u.y, x, y) <= 6 && los(g, u.x, u.y, x, y));
      if (!near) return 'クルーの近く（6マス以内・見通し）にしか置けません';
      g.stock[c.item]--;
      if (c.item === 'turret') g.turrets.push({ id: g.nextId++, x, y, hp: CONFIG.fort.turret.hp, cooldown: 0, facing: -Math.PI / 2 });
      else if (c.item === 'barricade') g.barricades.push({ id: g.nextId++, x, y, hp: CONFIG.fort.barricade.hp });
      else g.traps.push({ id: g.nextId++, x, y, armed: true });
      // 偵察中に目立つ装置を見られたら即通報
      if (g.phase === 'casing' && c.item !== 'trap' && pointSeen(g, sourcesFor(g, 'bank'), x, y)) {
        callPolice(g, '館内で不審な装置を発見');
      }
      return null;
    }
    case 'camera': {
      if (side !== 'bank') return null;
      if (!SHOP_OPEN(g)) return '突入中は設置できません';
      if (g.cameras.filter((k) => !k.destroyed).length >= CONFIG.bank.cameraMax) return 'カメラの上限です';
      if (g.funds.bank < CONFIG.bank.cameraCost) return '予算が足りません';
      const tx = Math.floor(c.x);
      const ty = Math.floor(c.y);
      const z = zoneAt(c.x, c.y);
      if (z !== Zone.Public && z !== Zone.Private && z !== Zone.Vault) return '館内にのみ設置できます';
      if (L.noCamera[idx(tx, ty)]) return '化粧室には設置できません（プライバシー保護）';
      if (L.solid[idx(tx, ty)] && L.doorAt[idx(tx, ty)]! < 0) return 'そこには設置できません';
      g.funds.bank -= CONFIG.bank.cameraCost;
      g.cameras.push({ id: g.nextId++, x: c.x, y: c.y, dir: c.dir, hp: CONFIG.bank.cameraHp, destroyed: false, loop: 0 });
      return null;
    }
    case 'secdoor': {
      if (side !== 'bank') return null;
      if (g.phase !== 'casing') return '警報後は扉を交換できません';
      const d = g.doors[c.slot];
      const s = L.doorSlots[c.slot];
      if (!d || !s || !s.securable) return 'その扉は強化できません';
      if (d.security && !d.destroyed) return 'すでに防犯扉です';
      if (g.funds.bank < CONFIG.bank.securityDoorCost) return '予算が足りません';
      g.funds.bank -= CONFIG.bank.securityDoorCost;
      d.security = true;
      d.locked = true;
      d.jammed = false;
      d.destroyed = false;
      news(g, `${s.name}を防犯扉に交換`, 'bank');
      return null;
    }
    case 'sensor': {
      if (side !== 'bank') return null;
      if (!SHOP_OPEN(g)) return '突入中は設置できません';
      if (g.sensors.length >= CONFIG.bank.sensorMax) return 'センサーの上限です';
      if (g.funds.bank < CONFIG.bank.sensorCost) return '予算が足りません';
      const z = zoneAt(c.x, c.y);
      if (z !== Zone.Private && z !== Zone.Vault) return '関係者エリアにのみ設置できます';
      g.funds.bank -= CONFIG.bank.sensorCost;
      g.sensors.push({ id: g.nextId++, x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + 0.5, reveal: 0, cooldown: 0 });
      return null;
    }
    case 'intel': {
      if (side !== 'crew') return null;
      if (g.phase !== 'casing') return '警備図面は偵察中にしか手に入りません';
      if (g.funds.crew < CONFIG.actions.intel.cost) return '資金が足りません';
      g.funds.crew -= CONFIG.actions.intel.cost;
      g.intel = true;
      for (const k of g.cameras) k.intel = true;
      for (const k of g.sensors) k.intel = true;
      news(g, `清掃業者から警備図面を入手：カメラ${g.cameras.filter((c) => !c.destroyed).length}台・センサー${g.sensors.length}個の位置が判明`, 'crew');
      return null;
    }
    case 'reinforce': {
      if (side !== 'bank') return null;
      if (g.phase !== 'casing') return '偵察フェーズのみ';
      if (g.breach.reinforced) return '強化済みです';
      if (g.funds.bank < CONFIG.breach.reinforceCost) return '予算が足りません';
      g.funds.bank -= CONFIG.breach.reinforceCost;
      g.breach.reinforced = true;
      news(g, `金庫扉を強化（突破時間×${CONFIG.breach.reinforceMul}）`, 'bank');
      return null;
    }
    case 'swat': {
      const err = policeReady(g, side, CONFIG.swat.cost);
      if (err) return err;
      const active = g.units.filter((u) => u.kind === 'swat' && u.alive).length + g.pendingSwat.length;
      if (active >= CONFIG.swat.maxActive) return `SWATの同時展開は${CONFIG.swat.maxActive}人までです`;
      const st = L.staging.find((s) => s.id === c.staging);
      if (!st) return '展開地点を選んでください';
      g.cp -= CONFIG.swat.cost;
      g.pendingSwat.push({ x: st.x, y: st.y, t: CONFIG.swat.arrivalDelay, ...(typeof c.x === 'number' && typeof c.y === 'number' ? { dest: { x: c.x, y: c.y } } : {}) });
      return null;
    }
    case 'sniper': {
      const err = policeReady(g, side, CONFIG.sniper.cost);
      if (err) return err;
      const spot = L.sniperSpots.find((s) => s.id === c.spot);
      if (!spot) return '狙撃地点を選んでください';
      const snipers = g.units.filter((u) => u.kind === 'sniper' && u.alive);
      if (snipers.some((s) => s.spot === c.spot)) return 'すでに配置済みです';
      if (snipers.length >= CONFIG.sniper.maxActive) {
        // 上限時は一番古い狙撃手を移動させる
        snipers[0]!.escaped = true;
      }
      g.cp -= CONFIG.sniper.cost;
      const u = makeUnit(g, 'sniper', spot.x, spot.y);
      u.spot = spot.id;
      u.facing = spot.dir;
      news(g, `狙撃手を${spot.name}に配置`, 'bank');
      return null;
    }
    case 'roadblock': {
      const err = policeReady(g, side, CONFIG.roadblock.cost);
      if (err) return err;
      const slot = L.roadblocks.find((s) => s.id === c.slot);
      if (!slot) return '封鎖地点を選んでください';
      if (g.roadblocks.some((r) => r.slot === c.slot)) return 'すでに封鎖済みです';
      if (g.van && g.van.state !== 'parked' && slot.road === 'alley' && Math.abs(g.van.x - slot.x) < 3) return '車両が通過中です';
      g.cp -= CONFIG.roadblock.cost;
      g.roadblocks.push({ id: g.nextId++, slot: c.slot, hp: CONFIG.roadblock.hp });
      news(g, `${slot.name}を設置`, 'bank');
      return null;
    }
    case 'gas': {
      const err = policeReady(g, side, CONFIG.gas.cost);
      if (err) return err;
      if (g.gasCooldown > 0) return `催涙ガスの再使用まで${Math.ceil(g.gasCooldown)}秒`;
      g.cp -= CONFIG.gas.cost;
      g.gasCooldown = CONFIG.gas.cooldown;
      g.gases.push({ id: g.nextId++, x: c.x, y: c.y, t: CONFIG.gas.duration });
      news(g, `警察が催涙ガスを撃ち込んだ（${roomNameAt(c.x, c.y)}）`, 'all');
      return null;
    }
    case 'observe': {
      if (side !== 'bank') return null;
      const o = g.observe;
      if (g.phase !== 'casing') {
        o.holding = false;
        return '通報済みです';
      }
      if (c.holding && o.cooldown > 0) return `観察できません（誤認のため${Math.ceil(o.cooldown)}秒待機）`;
      const t = unitById(g, c.target);
      if (c.holding && (!t || !g.vis.bank.units.has(t.id) || (t.kind !== 'civilian' && t.kind !== 'crew'))) return '見えている客を選んでください';
      if (o.target !== c.target) {
        o.progress = 0;
        o.suspicious = 0;
      }
      o.target = c.target;
      o.holding = c.holding;
      return null;
    }
    case 'report': {
      if (side !== 'bank') return null;
      if (g.phase !== 'casing') return '通報済みです';
      const t = unitById(g, c.target);
      if (!t || !g.vis.bank.units.has(t.id)) return '対象が見えていません';
      if (!instantlyReportable(t)) return '通報する根拠がありません（長押しで5秒観察してください）';
      const why = t.masked ? '覆面の人物を確認' : t.heavy ? '重武装の人物を確認' : '立入禁止区域に不審者';
      callPolice(g, `支店長が通報 — ${why}`);
      return null;
    }
    case 'goLoud': {
      if (side !== 'crew') return null;
      if (g.phase !== 'casing') return null;
      callPolice(g, '強盗団が銃を抜いた — 店内は騒然');
      return null;
    }
    case 'release': {
      if (side !== 'crew') return null;
      if (g.phase === 'casing') return '人質がいません';
      const h = g.units.find((u) => u.alive && u.brain?.state === 'hostage');
      if (!h) return '人質がいません';
      h.brain!.state = 'flee';
      h.brain!.timer = 0;
      h.path = [];
      g.negotiation.cards++;
      g.negotiation.released++;
      g.tickets++;
      news(g, '人質1名が解放されました — 交渉に進展', 'all', true);
      news(g, '人質交換: 交渉カード+1（警察を一時拘束）、突入中の購入機会+1', 'crew');
      return null;
    }
    case 'negotiate': {
      if (side !== 'crew') return null;
      const n = g.negotiation;
      if (g.phase !== 'assault') return '突入フェーズで使えます';
      if (n.cards <= 0) return '交渉カードがありません（人質を解放すると得られます）';
      if (n.cooldown > 0) return `再使用まで${Math.ceil(n.cooldown)}秒`;
      n.cards--;
      n.freeze = CONFIG.negotiation.freeze;
      n.cooldown = CONFIG.negotiation.cooldown;
      for (const u of g.units) if (u.kind === 'swat') u.path = [];
      news(g, '【中継】犯人側と交渉中 — 警察は一時待機', 'all', true);
      return null;
    }
    case 'escape': {
      if (side !== 'crew') return null;
      const v = g.van;
      if (!v || v.state !== 'parked') return 'バンがありません';
      if (v.bags < CONFIG.gold.quotaBags) return `金塊が${CONFIG.gold.quotaBags}袋に達していません（${v.bags}袋）`;
      const riders = g.units.filter((u) => u.kind === 'crew' && active(u) && dist(u.x, u.y, v.x, v.y) <= CONFIG.escape.van.loadRadius + 0.6);
      if (!riders.length) return 'バンの近くにクルーがいません';
      for (const u of riders) {
        u.role = 'invan';
        u.path = [];
        u.order = null;
        u.action = null;
        if (u.carrying >= 0) {
          const b = g.bags.find((b) => b.id === u.carrying);
          if (b) {
            b.state = 'van';
            v.bags++;
          }
          u.carrying = -1;
        }
      }
      v.crew = riders.map((u) => u.id);
      const blocked = (id: string) => g.roadblocks.some((r) => r.slot === id);
      const eastFree = !blocked('ae');
      const westFree = !blocked('aw');
      v.dir = eastFree ? 1 : westFree ? -1 : 1;
      v.state = 'driving';
      news(g, '裏通りから不審なバンが急発進', 'all', true);
      return null;
    }
  }
}

function policeReady(g: Game, side: Side, cost: number): string | null {
  if (side !== 'bank') return '警察のみ';
  if (g.phase !== 'assault') return '警察到着後に使えます';
  if (g.negotiation.freeze > 0) return '交渉中のため待機命令が出ています';
  if (g.cp < cost) return '指揮ポイントが足りません';
  return null;
}

export function canPlaceCameraAt(x: number, y: number): boolean {
  const z = zoneAt(x, y);
  const i = idx(Math.floor(x), Math.floor(y));
  return (z === Zone.Public || z === Zone.Private || z === Zone.Vault) && !L.noCamera[i] && (!L.solid[i] || L.doorAt[i]! >= 0);
}
