// 銀行マップ（84×48タイル）。北が裏通り、南が表通り。
// 静的な地形だけを持ち、扉の施錠や設置物はゲーム状態側で扱う。

export const W = 84;
export const H = 48;

export const enum Mat {
  Roof,
  Wall,
  Glass,
  Marble,
  Carpet,
  Tile,
  Concrete,
  VaultFloor,
  Asphalt,
  Sidewalk,
  Wood,
  Restroom,
  OfficeCarpet,
  Grate, // 非常階段の鉄格子
}

export const enum Zone {
  Out,
  Public,
  Private,
  Vault,
  Blocked,
}

export type FurnitureType =
  | 'counter'
  | 'desk'
  | 'bench'
  | 'plant'
  | 'atm'
  | 'pillar'
  | 'locker'
  | 'shelf'
  | 'gold'
  | 'crate'
  | 'sofa'
  | 'vending'
  | 'monitor'
  | 'deposit'
  | 'dumpster'
  | 'kiosk'
  | 'table';

export interface Furniture {
  type: FurnitureType;
  x: number;
  y: number;
  w: number;
  h: number;
  face?: 'n' | 's'; // 机：職員が座る側
}

// 見た目だけの小物（当たり判定・視線には影響しない）
export type DecorType =
  | 'rug'
  | 'runner'
  | 'emblem'
  | 'inlay'
  | 'mat'
  | 'hazard'
  | 'lane'
  | 'oil'
  | 'puddle'
  | 'manhole'
  | 'drain'
  | 'parking'
  | 'helipad'
  | 'chair'
  | 'armchair'
  | 'stool'
  | 'stall'
  | 'sink'
  | 'bin'
  | 'papers'
  | 'extinguisher'
  | 'wetsign'
  | 'cooler'
  | 'kitchen'
  | 'coffeetable'
  | 'mop'
  | 'pallet'
  | 'palletjack'
  | 'forklift'
  | 'boxes'
  | 'trash'
  | 'ac'
  | 'lamp'
  | 'tree'
  | 'bollard'
  | 'bikerack'
  | 'busstop'
  | 'hydrant'
  | 'newsbox'
  | 'hvac'
  | 'tank'
  | 'skylight'
  | 'vent'
  | 'car'
  | 'cone';

export interface Decor {
  type: DecorType;
  x: number;
  y: number;
  w?: number;
  h?: number;
  rot?: number; // 向き（ラジアン、+x が 0）
  color?: string;
}

export type DoorKind = 'door' | 'gate' | 'shutter' | 'exit' | 'staff' | 'office';

export interface DoorSlot {
  id: string;
  name: string;
  tiles: [number, number][];
  kind: DoorKind;
  defaultLocked: boolean;
  securable: boolean;
  vertical: boolean; // 扉が縦（x方向に通る）か
}

export interface Pt {
  x: number;
  y: number;
}

export interface SniperSpot extends Pt {
  id: string;
  name: string;
  dir: number;
}

export interface RoadblockSlot {
  id: string;
  name: string;
  x: number;
  y0: number;
  y1: number;
  road: 'alley' | 'front';
}

export interface Room {
  name: string;
  en: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zone: Zone;
}

export interface Level {
  layout: number; // 支店レイアウトの番号（0 が基準配置）
  w: number;
  h: number;
  solid: Uint8Array;
  opaque: Uint8Array;
  mat: Uint8Array;
  zone: Uint8Array;
  noCamera: Uint8Array;
  doorSlots: DoorSlot[];
  doorAt: Int16Array;
  vaultDoor: [number, number][];
  vaultAt: Uint8Array;
  furniture: Furniture[];
  decor: Decor[];
  rooms: Room[];
  pois: {
    atm: Pt[];
    teller: Pt[];
    seats: Pt[];
    lobby: Pt[];
    restroom: Pt[];
    consult: Pt[];
    kiosk: Pt[];
    loan: Pt[];
  };
  staffPois: Pt[];
  tellerSpots: Pt[];
  guardPost: Pt;
  bagSpots: Pt[];
  vaultFront: Pt; // 金庫扉の前（作業位置）
  vaultCenter: Pt;
  managerSeat: Pt;
  keycardSpot: Pt;
  officeEye: { x: number; y: number; dir: number };
  vanSpot: Pt;
  helipad: Pt; // ホテル屋上のヘリポート（フルトン回収地点）
  fireEscapes: Pt[]; // 西の路地からホテル屋上へ上がる非常階段
  rooftopSpots: Pt[]; // 屋上で気球を上げやすい場所（非常階段を上がってすぐ）
  sniperSpots: SniperSpot[];
  staging: (Pt & { id: string; name: string })[];
  roadblocks: RoadblockSlot[];
  pedestrianEnds: Pt[]; // 歩道の出入り口（マップ端）
  entrance: Pt; // 正面入口の外
  publicExits: Pt[]; // 民間人の避難先
  staffExits: Pt[];
  alleyExits: { west: Pt; east: Pt };
  defaultCameras: { x: number; y: number; dir: number }[];
  cameraIdeas: { x: number; y: number; dir: number; why: string }[];
  defenseSpots: Pt[];
}

const DEG = Math.PI / 180;

export function idx(x: number, y: number): number {
  return y * W + x;
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < W && y < H;
}

// ---------------------------------------------------------------- 支店レイアウトの揺らぎ
// 試合ごとに layout 番号から、扉の位置・部屋ごとの家具配置・金塊の置き場・キーカードの在処・
// 初期カメラの向きを少しだけ変える。外壁・出入口・金庫・支店長室・道路は固定（警察と狙撃の前提を崩さない）。
// layout 0 は基準の配置。各候補の先頭が基準。

type P2 = [number, number];
type FurnSpec = [FurnitureType, number, number, number, number, ('n' | 's')?];

interface RoomVariant {
  furn: FurnSpec[];
  pois?: P2[];
}

const LOBBY: (RoomVariant & { seats: P2[]; kiosk: P2[] })[] = [
  {
    furn: [
      ['bench', 36, 30, 3, 1],
      ['bench', 45, 30, 3, 1],
      ['bench', 36, 34, 3, 1],
      ['bench', 45, 34, 3, 1],
      ['kiosk', 41, 26, 2, 1],
    ],
    seats: [[37, 31], [38, 31], [46, 31], [47, 31], [37, 33], [46, 33], [36, 35], [47, 35]],
    kiosk: [[41, 27], [42, 27], [40, 26]],
  },
  {
    furn: [
      ['bench', 35, 29, 3, 1],
      ['bench', 46, 29, 3, 1],
      ['bench', 35, 35, 3, 1],
      ['bench', 46, 35, 3, 1],
      ['kiosk', 37, 26, 2, 1],
    ],
    seats: [[36, 30], [37, 30], [47, 30], [48, 30], [36, 34], [47, 34], [35, 36], [48, 36]],
    kiosk: [[37, 27], [38, 27], [39, 26]],
  },
  {
    furn: [
      ['bench', 34, 30, 1, 3],
      ['bench', 49, 30, 1, 3],
      ['bench', 36, 36, 3, 1],
      ['bench', 45, 36, 3, 1],
      ['kiosk', 45, 26, 2, 1],
    ],
    seats: [[35, 30], [35, 31], [35, 32], [48, 30], [48, 31], [48, 32], [37, 35], [46, 35]],
    kiosk: [[45, 27], [46, 27], [44, 26]],
  },
];

const WEST_HALL: RoomVariant[] = [
  { furn: [['desk', 17, 32, 3, 1, 'n'], ['desk', 17, 36, 3, 1, 's']], pois: [[18, 33], [18, 35], [15, 30], [20, 37]] },
  { furn: [['desk', 17, 30, 3, 1, 'n'], ['desk', 17, 34, 3, 1, 's']], pois: [[18, 31], [18, 33], [15, 36], [20, 37]] },
  { furn: [['desk', 14, 33, 3, 1, 'n'], ['desk', 19, 33, 3, 1, 'n']], pois: [[15, 34], [20, 34], [17, 30], [18, 37]] },
];

const EAST_HALL: RoomVariant[] = [
  { furn: [['desk', 64, 31, 3, 1, 'n'], ['desk', 64, 35, 3, 1, 's']], pois: [[65, 32], [65, 34], [68, 37], [62, 30], [69, 33]] },
  { furn: [['desk', 63, 30, 3, 1, 'n'], ['desk', 63, 34, 3, 1, 's']], pois: [[64, 31], [64, 33], [68, 37], [67, 29], [69, 34]] },
  { furn: [['desk', 62, 33, 3, 1, 'n'], ['desk', 66, 33, 3, 1, 'n']], pois: [[63, 34], [67, 34], [69, 37], [62, 30], [66, 30]] },
];

// 営業室：職員の立ち寄り先も配置に合わせる
const BACK_OFFICE: RoomVariant[] = [
  {
    furn: [
      ['desk', 28, 18, 3, 1, 's'],
      ['desk', 33, 19, 3, 1, 's'],
      ['desk', 39, 18, 3, 1, 's'],
      ['shelf', 44, 17, 2, 1],
      ['desk', 47, 18, 3, 1, 'n'],
      ['desk', 48, 20, 3, 1, 's'],
    ],
    pois: [[29, 17], [34, 18], [40, 19], [27, 20], [44, 20], [51, 19]],
  },
  {
    furn: [
      ['desk', 26, 18, 3, 1, 's'],
      ['desk', 31, 19, 3, 1, 's'],
      ['desk', 36, 18, 3, 1, 's'],
      ['desk', 41, 19, 3, 1, 's'],
      ['desk', 47, 18, 3, 1, 's'],
      ['shelf', 51, 17, 2, 1],
    ],
    pois: [[27, 17], [32, 18], [37, 17], [42, 18], [44, 20], [49, 20]],
  },
  {
    furn: [
      ['desk', 28, 18, 3, 1, 'n'],
      ['desk', 28, 19, 3, 1, 's'],
      ['desk', 40, 18, 3, 1, 'n'],
      ['desk', 40, 19, 3, 1, 's'],
      ['shelf', 44, 17, 2, 1],
      ['desk', 47, 19, 3, 1, 's'],
    ],
    pois: [[33, 18], [37, 19], [31, 20], [43, 20], [46, 18], [51, 19]],
  },
];

const BREAK_ROOM: (RoomVariant & { kitchen: number; sofaX: number })[] = [
  { furn: [['table', 50, 9, 3, 2], ['vending', 59, 8, 1, 2], ['sofa', 56, 11, 3, 1]], pois: [[49, 10], [55, 9]], kitchen: 53.8, sofaX: 56 },
  { furn: [['table', 55, 9, 3, 2], ['vending', 47, 8, 1, 2], ['sofa', 48, 11, 3, 1]], pois: [[54, 11], [51, 9]], kitchen: 50.2, sofaX: 48 },
];

const LOADING: RoomVariant[] = [
  { furn: [['crate', 62, 10, 2, 2], ['crate', 68, 17, 2, 2], ['crate', 62, 19, 1, 1]] },
  { furn: [['crate', 66, 10, 2, 2], ['crate', 62, 16, 2, 2], ['crate', 69, 20, 1, 1]] },
  { furn: [['crate', 62, 9, 1, 1], ['crate', 67, 13, 2, 2], ['crate', 63, 18, 2, 2]] },
];

const LOCKERS: RoomVariant[] = [
  { furn: [['bench', 15, 11, 3, 1]], pois: [[20, 10]] },
  { furn: [['bench', 18, 10, 3, 1]], pois: [[16, 11]] },
];

const SECURITY: (RoomVariant & { chairs: P2[] })[] = [
  { furn: [['monitor', 14, 19, 5, 1]], chairs: [[15.6, 20.35], [17.2, 20.35]] },
  { furn: [['monitor', 16, 18, 5, 1]], chairs: [[17.6, 19.35], [19.2, 19.35]] },
];

const DOOR_X = {
  locker: [17, 15, 20],
  storage: [28, 25, 31],
  break: [53, 49, 57],
  security: [17, 15, 19],
  office: [35, 31, 43],
};

const KEYCARD: Pt[] = [
  { x: 58.4, y: 19.5 },
  { x: 54.6, y: 17.6 },
  { x: 58.5, y: 21.3 },
  { x: 54.6, y: 21.2 },
];

const SECOND_CAMERA = [
  { x: 24.5, y: 23.5, dir: 40 * DEG },
  { x: 58.5, y: 23.5, dir: 140 * DEG },
];

const BASE_BAGS: P2[] = [
  [35, 9],
  [37, 9],
  [39, 9],
  [41, 9],
  [43, 9],
  [36, 11],
  [38, 11],
  [40, 11],
  [42, 11],
  [44, 11],
];

function layoutRng(layout: number) {
  let s = Math.imul(layout | 0, 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLevel(layout = 0): Level {
  const rng = layoutRng(layout);
  const choose = <T>(opts: readonly T[]): T => {
    const r = rng();
    return layout === 0 ? opts[0]! : opts[Math.floor(r * opts.length)]!;
  };
  const v = {
    lobby: choose(LOBBY),
    west: choose(WEST_HALL),
    east: choose(EAST_HALL),
    office: choose(BACK_OFFICE),
    breakRoom: choose(BREAK_ROOM),
    loading: choose(LOADING),
    lockers: choose(LOCKERS),
    security: choose(SECURITY),
    door: {
      locker: choose(DOOR_X.locker),
      storage: choose(DOOR_X.storage),
      break: choose(DOOR_X.break),
      security: choose(DOOR_X.security),
      office: choose(DOOR_X.office),
    },
    keycard: choose(KEYCARD),
    camera: choose(SECOND_CAMERA),
  };

  const n = W * H;
  const solid = new Uint8Array(n).fill(1);
  const opaque = new Uint8Array(n).fill(1);
  const mat = new Uint8Array(n).fill(Mat.Roof);
  const zone = new Uint8Array(n).fill(Zone.Blocked);
  const noCamera = new Uint8Array(n);
  const doorAt = new Int16Array(n).fill(-1);
  const vaultAt = new Uint8Array(n);
  const furniture: Furniture[] = [];

  const rect = (x0: number, y0: number, x1: number, y1: number, f: (x: number, y: number) => void) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(x, y);
  };
  const floor = (x0: number, y0: number, x1: number, y1: number, m: Mat, z: Zone) =>
    rect(x0, y0, x1, y1, (x, y) => {
      const i = idx(x, y);
      solid[i] = 0;
      opaque[i] = 0;
      mat[i] = m;
      zone[i] = z;
    });
  const wall = (x0: number, y0: number, x1: number, y1: number) =>
    rect(x0, y0, x1, y1, (x, y) => {
      const i = idx(x, y);
      solid[i] = 1;
      opaque[i] = 1;
      mat[i] = Mat.Wall;
      zone[i] = Zone.Blocked;
    });
  const glass = (x0: number, y0: number, x1: number, y1: number) =>
    rect(x0, y0, x1, y1, (x, y) => {
      const i = idx(x, y);
      solid[i] = 1;
      opaque[i] = 0;
      mat[i] = Mat.Glass;
      zone[i] = Zone.Blocked;
    });
  // 家具は通れないが視線は通す
  const furn = (type: FurnitureType, x: number, y: number, w = 1, h = 1, blocksSight = false, face?: 'n' | 's') => {
    furniture.push({ type, x, y, w, h, face });
    rect(x, y, x + w - 1, y + h - 1, (fx, fy) => {
      const i = idx(fx, fy);
      solid[i] = 1;
      if (blocksSight) opaque[i] = 1;
    });
  };
  const furnAll = (list: FurnSpec[]) => {
    for (const [type, x, y, w, h, face] of list) furn(type, x, y, w, h, false, face);
  };

  // --- 屋外 ---
  floor(0, 2, W - 1, 5, Mat.Asphalt, Zone.Out); // 裏通り
  floor(0, 6, W - 1, 6, Mat.Sidewalk, Zone.Out);
  floor(10, 7, 11, 39, Mat.Sidewalk, Zone.Out); // 西の路地
  floor(72, 7, 73, 39, Mat.Sidewalk, Zone.Out); // 東の路地
  floor(0, 40, W - 1, 41, Mat.Sidewalk, Zone.Out); // 表の歩道
  floor(0, 42, W - 1, 44, Mat.Asphalt, Zone.Out); // 表通り

  // ホテル屋上の北側（フルトン回収はここでだけできる）。西の路地から2か所の非常階段で上がる。
  // 南側は左の操作パネルの下になるので使わない
  floor(1, 8, 8, 16, Mat.Roof, Zone.Out);
  floor(9, 9, 9, 10, Mat.Grate, Zone.Out);
  floor(9, 14, 9, 15, Mat.Grate, Zone.Out);

  // --- 銀行の外壁 ---
  wall(12, 7, 71, 39);

  // 北ブロック（関係者以外立入禁止）
  floor(13, 8, 22, 12, Mat.Tile, Zone.Private); // ロッカー
  floor(13, 14, 59, 15, Mat.Tile, Zone.Private); // 廊下
  floor(13, 17, 22, 21, Mat.OfficeCarpet, Zone.Private); // 警備室
  floor(24, 8, 32, 12, Mat.Tile, Zone.Private); // 貸金庫室
  floor(34, 8, 45, 12, Mat.VaultFloor, Zone.Vault); // 金庫
  floor(47, 8, 59, 12, Mat.Wood, Zone.Private); // 休憩室
  floor(24, 17, 52, 21, Mat.OfficeCarpet, Zone.Private); // 営業室
  floor(54, 17, 59, 21, Mat.Carpet, Zone.Private); // 支店長室（こぢんまり）
  floor(61, 8, 70, 21, Mat.Concrete, Zone.Private); // 搬入口

  // 南ブロック（一般客エリア）
  floor(13, 23, 22, 38, Mat.Marble, Zone.Public); // 西ホール
  floor(24, 23, 59, 38, Mat.Marble, Zone.Public); // ロビー
  floor(61, 28, 70, 38, Mat.Marble, Zone.Public); // 東ホール
  floor(61, 23, 70, 26, Mat.Restroom, Zone.Public); // 化粧室
  rect(61, 23, 70, 26, (x, y) => (noCamera[idx(x, y)] = 1));
  floor(23, 29, 23, 31, Mat.Marble, Zone.Public); // 西ホール⇔ロビー
  floor(60, 29, 60, 31, Mat.Marble, Zone.Public); // ロビー⇔東ホール
  floor(65, 27, 65, 27, Mat.Restroom, Zone.Public);

  // 仕切り（営業カウンターと支店長室の窓）
  floor(26, 22, 44, 22, Mat.Wood, Zone.Public);
  furn('counter', 26, 22, 19, 1);
  glass(55, 22, 58, 22);

  // 正面のガラス張りと入口
  glass(14, 39, 37, 39);
  glass(46, 39, 69, 39);
  floor(39, 39, 44, 39, Mat.Marble, Zone.Public);
  // 側面の窓
  glass(12, 24, 12, 28);
  glass(12, 31, 12, 33);
  glass(71, 29, 71, 33);

  // 金庫扉（突破されるまで通れない）
  const vaultDoor: [number, number][] = [
    [39, 13],
    [40, 13],
  ];
  for (const [x, y] of vaultDoor) {
    const i = idx(x, y);
    solid[i] = 1;
    opaque[i] = 1;
    mat[i] = Mat.VaultFloor;
    zone[i] = Zone.Vault;
    vaultAt[i] = 1;
  }

  // --- 扉スロット ---
  const doorSlots: DoorSlot[] = [];
  const door = (
    id: string,
    name: string,
    tiles: [number, number][],
    kind: DoorKind,
    defaultLocked: boolean,
    securable: boolean,
    z: Zone,
    vertical: boolean,
  ) => {
    const k = doorSlots.length;
    doorSlots.push({ id, name, tiles, kind, defaultLocked, securable, vertical });
    for (const [x, y] of tiles) {
      const i = idx(x, y);
      solid[i] = 0;
      opaque[i] = 0;
      mat[i] = z === Zone.Out ? Mat.Sidewalk : Mat.Tile;
      zone[i] = z;
      doorAt[i] = k;
    }
  };
  door('gate', 'スタッフゲート', [[24, 22], [25, 22]], 'gate', false, true, Zone.Private, false);
  door('office', '営業室扉', [[v.door.office, 16]], 'door', false, true, Zone.Private, false);
  door('locker', 'ロッカー室扉', [[v.door.locker, 13]], 'door', false, true, Zone.Private, false);
  door('security', '警備室扉', [[v.door.security, 16]], 'door', false, true, Zone.Private, false);
  door('storage', '貸金庫室扉', [[v.door.storage, 13]], 'door', false, true, Zone.Private, false);
  door('break', '休憩室扉', [[v.door.break, 13]], 'door', false, false, Zone.Private, false);
  door('manager', '支店長室扉', [[56, 16]], 'office', true, false, Zone.Private, false);
  door('dock', '搬入口扉', [[60, 14], [60, 15]], 'door', false, true, Zone.Private, true);
  door('staffdoor', '通用口', [[17, 7], [18, 7]], 'staff', true, true, Zone.Private, false);
  door('shutter', '搬入シャッター', [[64, 7], [65, 7], [66, 7], [67, 7]], 'shutter', true, true, Zone.Private, false);
  door('exitw', '西非常口', [[12, 35], [12, 36]], 'exit', false, true, Zone.Public, true);
  door('exite', '東非常口', [[71, 35], [71, 36]], 'exit', false, true, Zone.Public, true);

  // --- 家具 ---
  // ロビー（柱は視線を遮るので固定）
  furn('pillar', 31, 27, 1, 1, true);
  furn('pillar', 31, 34, 1, 1, true);
  furn('pillar', 52, 27, 1, 1, true);
  furn('pillar', 52, 34, 1, 1, true);
  furnAll(v.lobby.furn);
  furn('plant', 24, 38);
  furn('plant', 59, 38);
  furn('plant', 24, 23);
  furn('plant', 59, 23);
  // 西ホール
  for (let y = 24; y <= 27; y++) furn('atm', 13, y);
  furnAll(v.west.furn);
  furn('plant', 22, 23);
  // 東ホール
  furnAll(v.east.furn);
  furn('sofa', 70, 29, 1, 3);
  furn('plant', 61, 38);
  // 営業室
  furnAll(v.office.furn);
  // 支店長室
  furn('desk', 55, 18, 3, 1, false, 's');
  furn('shelf', 59, 17, 1, 2);
  // 警備室
  furnAll(v.security.furn);
  furn('locker', 21, 17, 2, 1);
  // ロッカー室
  furn('locker', 13, 8, 4, 1);
  furn('locker', 20, 8, 3, 1);
  furnAll(v.lockers.furn);
  // 貸金庫室
  furn('deposit', 24, 8, 9, 1);
  furn('deposit', 24, 9, 1, 3);
  furn('deposit', 32, 9, 1, 3);
  // 金庫（棚）
  furn('shelf', 34, 8, 12, 1);
  // 休憩室
  furnAll(v.breakRoom.furn);
  // 搬入口
  furnAll(v.loading.furn);
  // 裏通り
  furn('dumpster', 40, 6, 2, 1);
  furn('dumpster', 22, 6, 2, 1);

  const rooms: Room[] = [
    { name: 'ロッカー室', en: 'LOCKERS', x: 13, y: 8, w: 10, h: 5, zone: Zone.Private },
    { name: '警備室', en: 'SECURITY', x: 13, y: 17, w: 10, h: 5, zone: Zone.Private },
    { name: '貸金庫室', en: 'DEPOSIT', x: 24, y: 8, w: 9, h: 5, zone: Zone.Private },
    { name: '大金庫', en: 'VAULT', x: 34, y: 8, w: 12, h: 5, zone: Zone.Vault },
    { name: '休憩室', en: 'BREAK RM', x: 47, y: 8, w: 13, h: 5, zone: Zone.Private },
    { name: '営業室', en: 'BACK OFFICE', x: 24, y: 17, w: 29, h: 5, zone: Zone.Private },
    { name: '支店長室', en: 'MANAGER', x: 54, y: 17, w: 6, h: 5, zone: Zone.Private },
    { name: '搬入口', en: 'LOADING', x: 61, y: 8, w: 10, h: 14, zone: Zone.Private },
    { name: '西ホール', en: 'ATM HALL', x: 13, y: 23, w: 10, h: 16, zone: Zone.Public },
    { name: 'ロビー', en: 'MAIN LOBBY', x: 24, y: 23, w: 36, h: 16, zone: Zone.Public },
    { name: '東ホール', en: 'LOANS', x: 61, y: 28, w: 10, h: 11, zone: Zone.Public },
    { name: '化粧室', en: 'RESTROOM', x: 61, y: 23, w: 10, h: 4, zone: Zone.Public },
  ];

  const pts = (a: P2[]) => a.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));

  // 金庫の金塊：基準配置か、金庫内のタイルから毎回選び直す
  let bagTiles = BASE_BAGS;
  if (layout !== 0) {
    const cand: P2[] = [];
    for (let y = 9; y <= 11; y++) for (let x = 35; x <= 44; x++) cand.push([x, y]);
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cand[i], cand[j]] = [cand[j]!, cand[i]!];
    }
    bagTiles = cand.slice(0, BASE_BAGS.length).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }
  const bagSpots = pts(bagTiles);
  const office = v.door.office;

  const lvl: Level = {
    layout,
    w: W,
    h: H,
    solid,
    opaque,
    mat,
    zone,
    noCamera,
    doorSlots,
    doorAt,
    vaultDoor,
    vaultAt,
    furniture,
    decor: [],
    rooms,
    pois: {
      atm: pts([[14, 24], [14, 25], [14, 26], [14, 27]]),
      teller: pts([[28, 23], [32, 23], [36, 23], [40, 23], [44, 23]]),
      seats: pts(v.lobby.seats),
      lobby: pts([[27, 26], [34, 29], [49, 28], [56, 25], [27, 36], [42, 37], [56, 36], [42, 29], [33, 37], [50, 37]]),
      restroom: pts([[62, 24], [64, 24], [67, 25], [69, 24]]),
      consult: pts(v.west.pois!),
      kiosk: pts(v.lobby.kiosk),
      loan: pts(v.east.pois!),
    },
    staffPois: pts([...v.office.pois!, ...v.breakRoom.pois!, [30, 10], ...v.lockers.pois!, [57, 14], [26, 14]]),
    tellerSpots: pts([[28, 21], [32, 21], [36, 21], [40, 21], [44, 21]]),
    guardPost: { x: 18.5, y: 20.5 },
    bagSpots,
    vaultFront: { x: 40, y: 14.6 },
    vaultCenter: { x: 40, y: 10.5 },
    managerSeat: { x: 56.5, y: 19.6 },
    keycardSpot: { ...v.keycard },
    officeEye: { x: 56.5, y: 21.3, dir: 100 * DEG },
    vanSpot: { x: 65.8, y: 3.6 },
    helipad: { x: 5, y: 12.4 },
    fireEscapes: [
      { x: 9.5, y: 10 },
      { x: 9.5, y: 15 },
    ],
    rooftopSpots: [
      { x: 7.4, y: 10.8 },
      { x: 6.6, y: 12.6 },
      { x: 7.4, y: 14.4 },
      { x: 4.6, y: 12.4 },
    ],
    sniperSpots: [
      { id: 'sw', name: '西ビル屋上（裏通り）', x: 9.5, y: 7.5, dir: -40 * DEG },
      { id: 'se', name: '東ビル屋上（裏通り）', x: 74.5, y: 7.5, dir: -140 * DEG },
      { id: 'w', name: '西ビル屋上（西ホール）', x: 9.5, y: 29.5, dir: 0 },
      { id: 'e', name: '東ビル屋上（東ホール）', x: 74.5, y: 31.5, dir: 180 * DEG },
      { id: 'fw', name: '向かいのビル（西）', x: 22.5, y: 45.2, dir: -90 * DEG },
      { id: 'fc', name: '向かいのビル（正面）', x: 41.5, y: 45.2, dir: -90 * DEG },
      { id: 'fe', name: '向かいのビル（東）', x: 61.5, y: 45.2, dir: -90 * DEG },
    ],
    staging: [
      { id: 'fw', name: '表通り 西', x: 1.5, y: 43.5 },
      { id: 'fc', name: '正面玄関前', x: 41.5, y: 43.5 },
      { id: 'fe', name: '表通り 東', x: 82.5, y: 43.5 },
      { id: 'aw', name: '裏通り 西', x: 1.5, y: 3.5 },
      { id: 'ae', name: '裏通り 東', x: 82.5, y: 3.5 },
    ],
    roadblocks: [
      { id: 'aw', name: '裏通り 西封鎖', x: 6, y0: 2, y1: 5, road: 'alley' },
      { id: 'ae', name: '裏通り 東封鎖', x: 77, y0: 2, y1: 5, road: 'alley' },
      { id: 'fw', name: '表通り 西封鎖', x: 6, y0: 42, y1: 44, road: 'front' },
      { id: 'fe', name: '表通り 東封鎖', x: 77, y0: 42, y1: 44, road: 'front' },
    ],
    pedestrianEnds: pts([[0, 40], [0, 41], [83, 40], [83, 41], [0, 6], [83, 6]]),
    entrance: { x: 41.5, y: 40.5 },
    publicExits: pts([[41, 39], [12, 35], [71, 35]]),
    staffExits: pts([[17, 7], [65, 7]]),
    alleyExits: { west: { x: -2, y: 3.6 }, east: { x: W + 2, y: 3.6 } },
    defaultCameras: [
      { x: 41.5, y: 37.6, dir: -90 * DEG }, // 正面入口からロビー全体
      { ...v.camera }, // ロビーの隅（左右どちらか）
    ],
    cameraIdeas: [
      { x: 45.4, y: 14.4, dir: 180 * DEG, why: '金庫前の廊下' },
      { x: 13.6, y: 23.5, dir: 50 * DEG, why: '西ホール' },
      { x: 70.4, y: 37.5, dir: -130 * DEG, why: '東ホール' },
      { x: 61.6, y: 8.6, dir: 50 * DEG, why: '搬入口' },
      { x: 13.6, y: 14.4, dir: 0, why: '西廊下' },
      { x: 43.4, y: 17.4, dir: 165 * DEG, why: '営業室' },
      { x: 34.6, y: 9.4, dir: 20 * DEG, why: '金庫内' },
      { x: 58.4, y: 15.4, dir: 180 * DEG, why: '東廊下' },
      { x: 22.4, y: 9.4, dir: 150 * DEG, why: 'ロッカー室' },
    ],
    defenseSpots: pts([[40, 15], [36, 14], [44, 15], [30, 15], [50, 14], [60, 14], [24, 21], [office, 17]]),
  };
  lvl.decor = buildDecor(lvl, v.breakRoom, v.security.chairs);
  return lvl;
}

// 基準配置で駐車している区画
const BASE_CARS = new Set(['0,0', '2,0', '3,1', '5,0', '6,1', '1,1', '8,0']);

// 試合ごとに切り替える。各モジュールは LEVEL を参照し続ければよい（ライブバインディング）
export let LEVEL = buildLevel(0);
const built = new Map<number, Level>([[0, LEVEL]]);

export function useLayout(layout: number): Level {
  let l = built.get(layout);
  if (!l) {
    l = buildLevel(layout);
    built.set(layout, l);
  }
  LEVEL = l;
  return l;
}

// 見た目だけの小物。通行・視線・カメラには一切影響しない。
// 家具に合わせて椅子やラグを置き、家具と重なる小物は置かない。
function buildDecor(lv: Level, breakRoom: { kitchen: number; sofaX: number }, securityChairs: P2[]): Decor[] {
  const N = -Math.PI / 2;
  const S = Math.PI / 2;
  const E = 0;
  const Wd = Math.PI;
  const d: Decor[] = [];
  const furnAt = new Uint8Array(W * H);
  for (const f of lv.furniture) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) furnAt[idx(x, y)] = 1;
  const blocked = (x: number, y: number) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (!inBounds(tx, ty)) return true;
    return furnAt[idx(tx, ty)] === 1 || lv.mat[idx(tx, ty)] === Mat.Wall;
  };
  const add = (type: DecorType, x: number, y: number, o: Omit<Decor, 'type' | 'x' | 'y'> = {}) => d.push({ type, x, y, ...o });
  // 置けるときだけ置く（中心と四隅が家具・壁にかからない）
  const tryAdd = (type: DecorType, x: number, y: number, o: Omit<Decor, 'type' | 'x' | 'y'> = {}, r = 0.2) => {
    if ([[0, 0], [-r, -r], [r, -r], [-r, r], [r, r]].some(([dx, dy]) => blocked(x + dx!, y + dy!))) return false;
    add(type, x, y, o);
    return true;
  };

  // --- 床の模様 ---
  add('inlay', 25.2, 24.2, { w: 33.6, h: 13.6 }); // ロビーの縁取り
  add('inlay', 13.6, 23.6, { w: 8.8, h: 14.8 });
  add('inlay', 61.6, 28.6, { w: 8.8, h: 9.8 });
  add('runner', 40.4, 34.4, { w: 3.2, h: 4.6, color: '#8a2a33' });
  add('emblem', 42, 32.5, { w: 1.55 });
  add('mat', 39.2, 37.7, { w: 5.6, h: 1.25 });
  // 相談窓口のラグは机の並びに合わせる
  const deskRug = (x0: number, x1: number, y0: number, y1: number, color: string) => {
    const ds = lv.furniture.filter((f) => f.type === 'desk' && f.x >= x0 && f.x <= x1 && f.y >= y0 && f.y <= y1);
    if (!ds.length) return;
    const ax = Math.min(...ds.map((f) => f.x)) - 0.8;
    const ay = Math.min(...ds.map((f) => f.y)) - 0.8;
    const bx = Math.max(...ds.map((f) => f.x + f.w)) + 0.8;
    const by = Math.max(...ds.map((f) => f.y + f.h)) + 0.8;
    add('rug', ax, ay, { w: bx - ax, h: by - ay, color });
  };
  deskRug(13, 22, 24, 38, '#46566b');
  deskRug(61, 70, 29, 38, '#5d4a3c');
  add('rug', 54.4, 19.9, { w: 4.6, h: 1.9, color: '#7b3b3f' });
  add('rug', breakRoom.sofaX - 0.6, 9.4, { w: 4.2, h: 2.5, color: '#3f5a5a' });
  add('rug', 25.4, 9.3, { w: 6.2, h: 2.4, color: '#2f3238' });
  add('lane', 15.7, 23.8, { h: 4.4 }); // ATMの待機線
  add('hazard', 37.6, 12.25, { w: 4.8, h: 0.7 }); // 金庫扉の内側
  add('hazard', 63.6, 8.05, { w: 4.8, h: 0.5 }); // 搬入シャッター
  add('hazard', 37.8, 14.1, { w: 4.4, h: 0.35 });
  add('lane', 63.3, 8.6, { h: 12.8, color: '#d8b24a' });
  add('lane', 68.7, 8.6, { h: 8.0, color: '#d8b24a' });
  add('oil', 65.3, 12.8, { w: 1.3 });
  add('oil', 66.8, 4.0, { w: 1.1 });
  add('oil', 30.4, 43.4, { w: 0.9 });
  add('puddle', 29.6, 4.3, { w: 1.6 });
  add('puddle', 55.2, 3.2, { w: 1.1 });
  add('puddle', 10.9, 20.4, { w: 0.9 });
  add('puddle', 72.7, 33.2, { w: 1.0 });
  add('puddle', 17.4, 43.6, { w: 1.3 });
  add('manhole', 16.5, 3.6);
  add('manhole', 50.5, 4.1);
  add('manhole', 21.5, 43.2);
  add('manhole', 61.5, 43.0);
  for (const x of [8, 28, 48, 70]) add('drain', x, 41.92);
  for (const x of [12, 36, 58, 78]) add('drain', x, 5.92);

  // --- 机の椅子：職員側に1脚、客の来る机は反対側に2脚 ---
  for (const f of lv.furniture) {
    if (f.type !== 'desk') continue;
    const cx = f.x + f.w / 2;
    const manager = f.x >= 54 && f.x < 60 && f.y >= 17 && f.y < 22;
    if (manager) continue;
    const staffSide = f.face === 'n' ? f.y - 0.6 : f.y + f.h + 0.4;
    tryAdd('chair', cx, staffSide, { rot: f.face === 'n' ? S : N }, 0.15);
    const pub = lv.zone[idx(f.x, f.y + (f.face === 'n' ? 1 : -1))] === Zone.Public;
    if (pub) {
      const cy = f.face === 'n' ? f.y + f.h + 0.25 : f.y - 0.25;
      for (const dx of [-0.8, 0.8]) tryAdd('chair', cx + dx, cy, { rot: f.face === 'n' ? N : S }, 0.15);
    } else tryAdd('bin', f.x + f.w + 0.45, f.y + 0.4, {}, 0.12);
  }
  // 支店長室
  add('chair', 56.5, 19.75, { rot: N });
  add('chair', 55.4, 17.45, { rot: S });
  add('chair', 57.6, 17.45, { rot: S });
  for (const [x, y] of securityChairs) add('chair', x, y, { rot: N });

  // --- ロビー・ホール ---
  tryAdd('wetsign', 58.6, 28.6);
  tryAdd('bin', 24.5, 36.6);
  tryAdd('bin', 58.5, 36.6);
  tryAdd('bin', 13.45, 28.45);
  tryAdd('cooler', 62.45, 37.35);
  tryAdd('stool', 70.2, 33.3);

  // --- 化粧室 ---
  for (const x of [61, 62.5, 64]) add('stall', x, 23, { w: 1.5, h: 1.45 });
  for (const x of [66.9, 68.2, 69.5]) add('sink', x, 23.25);
  add('bin', 70.55, 26.5);

  // --- 営業室・警備室 ---
  for (const x of [28.5, 32.5, 36.5, 40.5, 44.5]) add('stool', x, 21.45);
  tryAdd('papers', 26.2, 17.6);
  tryAdd('papers', 43.2, 20.8);
  tryAdd('papers', 21.0, 20.6);
  tryAdd('cooler', 52.45, 17.4);
  tryAdd('bin', 54.45, 18.4);

  // --- 北ブロック ---
  add('kitchen', breakRoom.kitchen, 8.0, { w: 4.8, h: 0.62 });
  const table = lv.furniture.find((f) => f.type === 'table')!;
  const sofa = lv.furniture.find((f) => f.type === 'sofa' && f.y < 13)!;
  add('coffeetable', sofa.x + 0.6, 10.0, { w: 1.8, h: 0.55 });
  for (const [x, y, r] of [
    [table.x - 0.4, table.y + 0.5, E],
    [table.x - 0.4, table.y + 1.5, E],
    [table.x + table.w + 0.4, table.y + 0.5, Wd],
    [table.x + table.w + 0.4, table.y + 1.5, Wd],
    [table.x + table.w / 2, table.y - 0.45, S],
    [table.x + table.w / 2, table.y + table.h + 0.45, N],
  ] as const)
    tryAdd('chair', x, y, { rot: r }, 0.12);
  tryAdd('bin', 47.45, 12.5);
  add('extinguisher', 23.45, 14.2);
  add('extinguisher', 46.55, 14.2);
  add('extinguisher', 60.75, 18.2);
  add('mop', 58.9, 15.55);
  tryAdd('papers', 31.2, 11.4);
  tryAdd('boxes', 13.6, 12.2, { w: 0.9 });

  // --- 搬入口：空いている場所に置く ---
  let pallets = 0;
  for (const [x, y] of [
    [69, 9.2],
    [69, 10.6],
    [62.6, 20.5],
    [69.2, 20.5],
    [65.5, 16.8],
  ] as const)
    if (pallets < 2 && tryAdd('pallet', x, y, { rot: 0 }, 0.55)) pallets++;
  for (const [x, y] of [
    [65.6, 19.8],
    [67.6, 12.4],
  ] as const)
    if (tryAdd('palletjack', x, y, { rot: N }, 0.45)) break;
  for (const [x, y] of [
    [69.2, 14.2],
    [63.4, 12.8],
    [69.2, 17.8],
  ] as const)
    if (tryAdd('forklift', x, y, { rot: N }, 0.75)) break;
  for (const [x, y] of [
    [62.4, 12.6],
    [69.3, 17.2],
    [62.4, 17.6],
  ] as const)
    if (tryAdd('boxes', x + 0.5, y + 0.4, { w: 1.1 }, 0.4)) {
      d[d.length - 1]!.x -= 0.5;
      d[d.length - 1]!.y -= 0.4;
      break;
    }
  add('cone', 61.5, 8.5);
  tryAdd('cone', 70.4, 21.4);

  // --- 裏通り・路地 ---
  add('trash', 24.4, 6.45);
  add('trash', 42.4, 6.5);
  add('trash', 10.35, 14.6);
  add('trash', 73.5, 11.8);
  add('boxes', 45.6, 6.35, { w: 0.8 });
  for (const x of [30.5, 49.5, 57.5]) add('ac', x, 6.05);
  add('bin', 11.55, 26.4);
  add('bin', 72.45, 24.5);

  // --- 表の歩道 ---
  for (const x of [17, 31, 52, 67]) add('lamp', x, 41.75, { rot: S });
  for (const x of [23, 35, 48, 60]) add('tree', x, 41.5);
  for (const x of [39.4, 40.8, 42.2, 43.6]) add('bollard', x, 41.78);
  add('busstop', 25.6, 41.25, { w: 3.0 });
  add('bikerack', 55.5, 41.55, { w: 2.4 });
  add('hydrant', 33.4, 41.8);
  add('newsbox', 46.4, 41.6);
  add('bin', 64.4, 41.75);

  // --- 屋上 ---
  add('helipad', 5, 12.4, { w: 3.0 });
  add('hvac', 1.2, 30.2, { w: 2.6, h: 1.6 });
  add('hvac', 5.2, 30.2, { w: 2.6, h: 1.6 });
  add('tank', 3.3, 35.5, { w: 1.5 });
  add('skylight', 2.0, 19.6, { w: 6, h: 2.2 });
  add('vent', 7.6, 34.2);
  add('vent', 1.6, 25.8);
  add('vent', 22, 0.9);
  add('vent', 56, 0.9);
  add('hvac', 31, 0.25, { w: 3, h: 1.5 });
  add('hvac', 66, 0.25, { w: 3, h: 1.5 });
  add('skylight', 4, 0.35, { w: 8, h: 1.2 });
  add('skylight', 44, 0.35, { w: 8, h: 1.2 });
  for (let k = 0; k < 9; k++) {
    add('parking', 74.6, 9 + k * 2.6, { w: 3.0, h: 2.6 });
    add('parking', 80.4, 9 + k * 2.6, { w: 3.0, h: 2.6 });
  }
  // 駐車場の車も毎回少し違う
  const cars = ['#b8bec6', '#3c5a8a', '#8a2f2f', '#2a2d33', '#e6e6e6', '#6b7a52', '#c9a34a'];
  const carRng = layoutRng(lv.layout + 7);
  for (let i = 0; i < 9; i++)
    for (const side of [0, 1]) {
      const r = carRng();
      if (lv.layout === 0 ? !BASE_CARS.has(`${i},${side}`) : r > 0.45) continue;
      add('car', side ? 81.9 : 76.1, 10.3 + i * 2.6, { rot: side ? Wd : E, color: cars[(i * 3 + side + (lv.layout === 0 ? 0 : Math.floor(r * 70))) % cars.length] });
    }
  add('hvac', 12, 45.9, { w: 2.2, h: 1.3 });
  add('hvac', 50, 46.0, { w: 2.2, h: 1.3 });
  add('vent', 33, 46.6);
  add('vent', 74, 46.4);
  return d;
}

