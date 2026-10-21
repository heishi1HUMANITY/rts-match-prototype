// 調整用マスタ。ゲーム内の数値はすべてここから読む。
// 距離はタイル、時間は秒、金額はドル。

export const CONFIG = {
  tickRate: 30,

  // 両陣営の予算は金庫の金塊総額と同じ
  gold: {
    bags: 10,
    bagValue: 200_000,
    quotaBags: 4, // 逃走に必要な最低袋数
  },

  phase: {
    casingSeconds: 360, // 開店〜閉店（閉店で自動通報）
    responseSeconds: 60, // 通報〜警察到着
    blastResponse: 35, // 警察到着待ちの間に爆発があると、到着までの残りをこの秒数に縮める
    assaultSeconds: 480, // 突入開始〜包囲完了
  },
  clock: { open: 9 * 60, close: 15 * 60 }, // 偵察フェーズの表示時刻（分）

  observe: {
    duration: 5, // 長押しで観察する時間
    requiredSuspicious: 3, // そのうち不審行動が見えている必要がある秒数
    failCooldown: 6, // 誤認時に観察できない時間
    privateGrace: 2.5, // 関係者エリアで続けてこの秒数見られると即通報の対象になる
  },

  move: {
    civilianWalk: [1.9, 2.6] as [number, number],
    crewWalk: 2.3, // 偵察中・素顔のクルー（民間人と同じ歩き）
    run: 3.3,
    guardWalk: 2.2,
    guardRun: 3.0,
    swat: 3.4,
    carryMul: 0.75,
    radius: 0.3,
  },

  vision: {
    unit: 9,
    camera: { range: 11, fov: 75 },
    office: { range: 17, fov: 150 },
    sniper: { range: 30, fov: 64 },
    turret: 8,
    van: 3.5,
    sensorRadius: 3,
    sensorReveal: 3,
  },

  crew: {
    startCount: 2,
    max: 5,
    hireCost: 180_000,
    hp: 110,
    armor: 30,
    damage: 13,
    fireInterval: 0.38,
    range: 9,
    accuracy: 0.52,
  },
  heavy: { cost: 175_000, armor: 130, damageMul: 1.25, speedMul: 0.8, equipTime: 6, gasMul: 0.5 }, // 重武装はガスマスク付き
  medkit: { cost: 80_000, heal: 70, time: 2 },

  guard: {
    startCount: 1,
    max: 4,
    hireCost: 200_000,
    hp: 110,
    armor: 25,
    damage: 11,
    fireInterval: 0.47,
    range: 9,
    accuracy: 0.46,
  },

  swat: {
    hp: 120,
    armor: 80,
    damage: 13,
    fireInterval: 0.4,
    range: 9,
    accuracy: 0.6,
    maxActive: 4, // 同時展開数
    cost: 45,
    arrivalDelay: 4,
  },
  sniper: { damage: 65, fireInterval: 2.8, accuracy: 0.8, maxActive: 2, cost: 70 },
  roadblock: { cost: 45, hp: 400, gunfireMul: 0.4 },
  wallBreach: { cost: 25, plantTime: 3, fuse: 2, damage: 40, stun: 2, radius: 1.8 },
  gas: { cost: 50, radius: 2.6, duration: 8, dps: 2.5, slow: 0.5, accuracyMul: 0.6, cooldown: 25 },
  police: { cpStart: 110, cpRegen: 3, cpMax: 220 },

  // 人質解放1人につき: 交渉カード1枚（警察を一時拘束）＋突入中の購入機会1回
  negotiation: { freeze: 8, cooldown: 20 },

  breach: {
    drill: { cost: 150_000, time: 75, jamEvery: [16, 30] as [number, number], noiseEvery: 8 },
    thermal: { cost: 350_000, time: 55 },
    charge: { cost: 500_000, time: 12 }, // 設置後の起爆までの時間。爆発で自動通報
    installTime: 4,
    fixTime: 3,
    sabotageTime: 3,
    reinforceCost: 300_000,
    reinforceMul: 1.3,
    // 支店長室の扉を小型ドリルで開けると、金庫のキーカードが手に入る
    officeDrill: { cost: 60_000, time: 40, noiseEvery: 8 },
    keycardTime: 10,
  },

  escape: {
    van: { cost: 200_000, speed: 6, hp: 900, ramDps: 45, loadRadius: 2.4 },
    // フルトン：ホテル屋上でだけ使える。回収機は呼んだときだけ来る（要請から arriveTime 秒で上空を通過、通過後 callCooldown 秒は呼べない）。
    // バンより速く安全にするため、屋上と地上の間では撃ち合えない（屋上を争うには非常階段を上がる）。袋を抱えたまま自分ごと回収されてもよい
    fulton: { cost: 300_000, attachTime: 1.5, inflateTime: 3, arriveTime: 8, callCooldown: 12, warnAt: 4, balloonHp: 60 },
  },

  actions: {
    tamper: { cost: 80_000, time: 4, loop: 150 },
    intel: { cost: 100_000 }, // 警備図面：その時点のカメラとセンサーの位置がわかる
    bribe: { cost: 200_000, time: 3 },
    lockpick: { time: 8, securityTime: 24 },
    c4: { cost: 40_000, time: 2, fuse: 3 },
    hostage: { time: 1.5 },
    pickup: 0.6,
    deposit: 0.6,
    repairDoor: 4,
    maskedSpeedMul: 0.6, // 覆面中は作業が速い（取り繕う必要がない）
  },

  fort: {
    turret: { cost: 250_000, max: 2, hp: 200, damage: 8, fireInterval: 0.2, range: 8, accuracy: 0.45 },
    barricade: { cost: 60_000, max: 8, hp: 400 },
    trap: { cost: 80_000, max: 6, damage: 75, radius: 1.6, stun: 2.5 },
  },

  bank: {
    cameraCost: 80_000,
    cameraMax: 14,
    cameraHp: 20,
    startCameras: 2,
    securityDoorCost: 150_000,
    sensorCost: 100_000,
    sensorMax: 4,
  },

  civilians: { inside: 18, outside: 9, cowerChance: 0.35, bagChance: 0.3 },
  // 自動行動（迎撃・攻撃・人質・徘徊）：判断の間隔、迎撃する距離（持ち場から）、人質を取る距離、徘徊の半径と待ち時間
  auto: { think: 0.5, interceptRange: 9, hostageRange: 4, roamRadius: 5, roamWait: [2, 6] as [number, number] },
} as const;

export type BreachMethod = 'drill' | 'thermal' | 'charge';
export type EscapeMethod = 'van' | 'fulton';

export const BUDGET = CONFIG.gold.bags * CONFIG.gold.bagValue;
