import type { BreachMethod, EscapeMethod } from '../config';

export type Side = 'bank' | 'crew';
export type FortKind = 'turret' | 'barricade' | 'trap' | 'drill';
export type Phase = 'casing' | 'response' | 'assault' | 'ended';
export type Kind = 'civilian' | 'staff' | 'manager' | 'crew' | 'guard' | 'swat' | 'sniper';

export interface Look {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  bag: 'none' | 'gym' | 'tote';
  bagColor: string;
}

export type ActionKind =
  | 'tamper'
  | 'bribe'
  | 'lockpick'
  | 'c4'
  | 'install'
  | 'fix'
  | 'sabotage'
  | 'pickup'
  | 'deposit'
  | 'hostage'
  | 'fulton'
  | 'extract'
  | 'repair'
  | 'equip'
  | 'medkit'
  | 'officedrill'
  | 'keycard'
  | 'wallbreach';

export interface Action {
  kind: ActionKind;
  t: number;
  dur: number;
  target: number; // 対象ID（種類はkindで決まる）
}

export type Order =
  | { type: 'move'; x: number; y: number }
  | { type: 'attack'; target: number; targetKind: 'unit' | 'camera' | 'turret' | 'barricade' | 'roadblock' | 'balloon' | 'van' }
  | { type: 'act'; kind: ActionKind; target: number; x: number; y: number; reach: number };

export type CivState = 'enter' | 'errand' | 'wait' | 'leave' | 'walkby' | 'flee' | 'cower' | 'hostage' | 'work' | 'gone';

export interface Brain {
  state: CivState;
  timer: number;
  errands: number;
  home?: { x: number; y: number }; // 職員の持ち場
  dest?: { x: number; y: number };
}

export interface Unit {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  facing: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  alive: boolean;
  escaped: boolean;
  walk: number; // 平常時の歩行速度
  look: Look;
  path: { x: number; y: number }[];
  order: Order | null;
  action: Action | null;
  cooldown: number;
  stun: number;
  moving: boolean;
  lastShot: number;
  repath: number;
  stuck: number; // 経路があるのに進めていない時間
  near: number; // 今の通過点に最も近づいた距離（これを更新できない間は進んでいないとみなす）
  nearLen: number; // near を測った時点の経路の長さ
  hurt: Record<string, number>; // 前回の観測以降に受けた被害（発生源別）
  // クルー
  masked: boolean;
  heavy: boolean;
  maskStyle: number;
  callsign: string;
  hasTool: boolean;
  hasKey: boolean;
  carrying: number; // 運搬中の金塊袋ID（-1でなし）
  suspicious: boolean; // 今この瞬間に不審行動をしているか（真値）
  privateSeen: number; // 関係者エリアで銀行側に見られ続けている秒数
  // 警備員
  bribed: boolean;
  deserting: boolean;
  // 民間人・職員
  brain: Brain | null;
  // スナイパー
  spot: string;
  // 自動行動（プレイヤーが陣営の戦闘員ごとに設定する）
  auto: AutoFlags;
  autoOrder: boolean; // 今の命令が自動行動によるものか（手動の命令は自動行動より優先）
  // AI用メモ
  role: string;
  aiTimer: number;
}

export type AutoMode = 'intercept' | 'attack' | 'hostage' | 'roam';

export interface AutoFlags {
  intercept: boolean; // 持ち場の近くに見えた敵を迎え撃ち、片付いたら戻る
  attack: boolean; // 見えている敵を自分から追って攻撃する
  hostage: boolean; // 近くの民間人を人質に取る（強盗のみ・警報後）
  roam: boolean; // 持ち場のまわりを歩き回る（持ち場と同じ区域の中だけ）
  home: { x: number; y: number } | null; // 持ち場（迎撃・徘徊の基準点）
  wait: number; // 徘徊の次の移動まで
  engaged: boolean; // 迎撃のために持ち場を離れている
}

export interface Camera {
  id: number;
  x: number;
  y: number;
  dir: number;
  hp: number;
  destroyed: boolean;
  loop: number; // ループ映像の残り秒数
  intel?: boolean; // 警備図面に載っている（入手時点で設置済み）
}

export interface Door {
  id: number;
  slot: number;
  locked: boolean;
  security: boolean;
  jammed: boolean; // ピッキングで壊れて開きっぱなし
  destroyed: boolean;
  open: boolean; // 今の開閉（視線を通すか）
  alerted: boolean;
}

export interface Turret {
  id: number;
  x: number;
  y: number;
  hp: number;
  cooldown: number;
  facing: number;
}

export interface Barricade {
  id: number;
  x: number;
  y: number;
  hp: number;
}

export interface Trap {
  id: number;
  x: number;
  y: number;
  armed: boolean;
}

export interface Sensor {
  id: number;
  x: number;
  y: number;
  intel?: boolean;
  reveal: number;
  cooldown: number;
}

export type BagState = 'vault' | 'ground' | 'carried' | 'van' | 'balloon' | 'secured' | 'lost';

export interface Bag {
  id: number;
  x: number;
  y: number;
  state: BagState;
  carrier: number;
  balloon: number; // 気球の状態: 膨張中は残り秒、待機は0
  balloonHp: number;
  kind: 'gold' | 'tool' | 'keycard';
}

export interface Roadblock {
  id: number;
  slot: string;
  hp: number;
}

export interface Gas {
  id: number;
  x: number;
  y: number;
  t: number;
}

export interface Breach {
  method: BreachMethod;
  installed: boolean;
  running: boolean;
  jammed: boolean;
  progress: number; // 0..1
  nextJam: number;
  noiseTimer: number;
  open: boolean;
  reinforced: boolean;
}

export interface Van {
  x: number;
  y: number;
  state: 'parked' | 'driving' | 'blocked' | 'gone' | 'wrecked';
  dir: number;
  hp: number;
  crew: number[];
  bags: number;
}

export interface CrewBalloon {
  unit: number;
  t: number; // 膨張残り秒（0で待機）
  hp: number;
}

export interface Alert {
  id: number;
  x: number;
  y: number;
  text: string;
  t: number;
}

export interface NewsEvent {
  id: number;
  t: number;
  text: string;
  vis: 'all' | Side;
  big: boolean;
}

export type Fx =
  | { type: 'tracer'; x1: number; y1: number; x2: number; y2: number; t: number; side: Side; hit: boolean }
  | { type: 'boom'; x: number; y: number; t: number; r: number }
  | { type: 'spark'; x: number; y: number; t: number }
  | { type: 'ping'; x: number; y: number; t: number; side: Side }
  | { type: 'blood'; x: number; y: number; t: number; r: number }
  | { type: 'text'; x: number; y: number; t: number; text: string; side: Side | 'all' };

export interface Observe {
  target: number;
  holding: boolean;
  progress: number;
  suspicious: number;
  cooldown: number;
  result: '' | 'ok' | 'fail' | 'lost';
  resultT: number;
}

export interface Visibility {
  units: Set<number>; // 相手陣営から見えている（ライブ）ユニット
  cameras: Set<number>;
  turrets: Set<number>;
  barricades: Set<number>;
  bags: Set<number>;
  van: boolean;
}

export interface SideController {
  ai: boolean;
}

export interface Game {
  seed: number;
  layout: number; // 支店レイアウトの番号（0 が基準配置）
  rng: number;
  tick: number;
  time: number;
  phase: Phase;
  phaseTime: number;
  nextId: number;
  plan: { breach: BreachMethod; escape: EscapeMethod };
  controllers: Record<Side, SideController>;
  funds: Record<Side, number>;
  cp: number;
  crewHired: number;
  units: Unit[];
  cameras: Camera[];
  doors: Door[];
  turrets: Turret[];
  barricades: Barricade[];
  traps: Trap[];
  sensors: Sensor[];
  bags: Bag[];
  roadblocks: Roadblock[];
  gases: Gas[];
  gasCooldown: number;
  breach: Breach;
  van: Van | null;
  plane: { eta: number; pass: number; cooldown: number }; // フルトン回収機：呼ぶと eta 秒後に屋上上空を通過
  crewBalloons: CrewBalloon[];
  c4: { door: number; t: number }[];
  wallCharges: { x: number; y: number; t: number; tiles: number[] }[];
  holes: number[]; // 警察が爆破した壁タイル
  officeDrill: { installed: boolean; progress: number; noise: number };
  stock: Record<FortKind, number>; // 強盗側の購入済み・未展開の装備
  tickets: number; // 人質交換で得た突入中の購入機会
  pendingSwat: { x: number; y: number; t: number; dest?: { x: number; y: number } }[];
  intel: boolean; // 強盗側が警備図面（カメラ・センサーの位置）を入手したか
  observe: Observe;
  alerts: Alert[];
  negotiation: { cards: number; freeze: number; cooldown: number; released: number };
  events: NewsEvent[];
  fx: Fx[];
  vis: Record<Side, Visibility>; // vis.bank = 銀行側が見ているもの
  winner: Side | null;
  endReason: string;
  stats: { crewKilled: number; policeKilled: number; guardsKilled: number; hostagesTaken: number; shots: number };
  civSpawnTimer: number;
  loudReason: string;
  aiMemory: Record<string, unknown>;
  dealt: Record<Side, Record<string, number>>; // 与えた被害（対象ごと、観測のたびにリセット）
}
