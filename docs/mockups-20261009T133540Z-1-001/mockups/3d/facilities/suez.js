// 戦略施設トークン「スエズ運河(エル・フェルダン鉄道旋回橋)」の詳細版モデル(試作)。
// 運河をまたぐ世界最長級の旋回橋(全長 約 340 m)を中心に、運河の 700 × 520 m を切り取る。平面の配置は実寸の比率(K = 0.25)。
// 両岸の支点に載った 2 本の腕(トラス)が、普段は運河と平行に岸に沿って開き(船が通る)、列車のときだけ 90° 回って中央で突き合わせる。
// 誇張: 決め手の旋回橋のトラスの背 2 倍(支点の上 60 m)、幅 1.6 倍(22 m)、部材の太さ 2 倍。弦材は鋼の灰色で砂地から浮かせる。運河の幅・腕の長さは実寸。
// 省略: 列車・車両・人、架線、小さな機器。運河の向こうの新運河(2015 年)は切り取りの外。
// 近未来化: 旋回の管制塔(箱形のレーダーの覆い)と、両岸の運河監視のセンサーの塔 4 基(電子光学の窓)。
// 動き: 開(船が通航)→ 閉鎖(20 秒で腕が 90° 回る)→ 閉(鉄道がつながる)→ 開放。動いている間だけ腕の回転灯が点滅。開のときはタンカーが運河を南へ通る。
//
//   const a = DreamAssets.fac.defs.suez.make(THREE)(制圧圏 r = 112)
// 運河は z 方向(+z が南、紅海側)、鉄道は x 方向。左岸(-x)はアフリカ側、右岸(+x)はシナイ側。
(function () {
  const K = 0.25;
  const D = {
    x0: -350, x1: 350, z0: -260, z1: 260,
    ground: 4, bed: -20, base: -22, wet: 152, toe: 154, toeY: -2, bank: 165,
    px: 185, L: 184.5, T: 50,          // 支点の x、腕の長さ(支点から先端。中央の隙間 1 m)、尾(釣合い重り側)の長さ
    deck: 12, w: 22, emb: 239,         // 線路の高さ、トラスの幅(実物 約 14 m を 1.6 倍)、取付け盛土の始まり
  };
  const TOP0 = 60, TOP1 = 16, TOPT = 26;   // トラスの上弦の高さ(路面から): 支点の上(30 m を 2 倍)・先端・尾の端
  const topAt = (u) => (u >= 0 ? D.deck + TOP1 + (TOP0 - TOP1) * Math.pow(1 - u / D.L, 1.5) : D.deck + TOPT + (TOP0 - TOPT) * (1 + u / D.T));
  const SEC = 20;

  function suez(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.canal = U.waterMaterial(THREE);
    const group = new THREE.Group(); group.name = "suez";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, beam, prism, lattice } = k;
    const W = D.x1 - D.x0, Dz = D.z1 - D.z0;

    // ── 台座: 両岸の砂地、護岸、運河の底と水面 ──
    F.plinth(k, M, world, W, Dz, D.base);
    add(box(2 * D.bank, D.bed - D.base, Dz), M.light, world, { y: (D.bed + D.base) / 2, edges: false });
    for (const s of [-1, 1]) {
      add(prism([[s * D.bank, D.z0], [s * D.x1, D.z0], [s * D.x1, D.z1], [s * D.bank, D.z1]], D.base, D.ground), M.land, world);
      const prof = [[140, D.base], [D.bank, D.base], [D.bank, D.ground], [D.toe, D.toeY], [140, D.bed]].map(([x, y]) => [s * x, y]);
      add(U.loft(THREE, [{ z: D.z0, pts: prof }, { z: D.z1, pts: prof }]), M.mid, world);
      add(box(4, 0.3, Dz), M.light, world, { x: s * (D.bank + 2), y: D.ground + 0.15, z: 0, edges: false });   // 岸の縁の舗装
      add(box(10, 0.15, Dz), M.mid, world, { x: s * (D.bank + 40), y: D.ground + 0.08, z: 0, edges: false });  // 運河沿いの管理道路
    }
    world.add(k.waterShape([[-D.wet, D.z0], [D.wet, D.z0], [D.wet, D.z1], [-D.wet, D.z1]], M.canal));
    world.add(new THREE.Mesh(U.merge(THREE, [D.z0, D.z1].map((z) => [new THREE.PlaneGeometry(2 * D.wet, -D.bed), { y: D.bed / 2, z }])), M.waterCut));
    // 航路標識(運河の両側の小さな灯柱の代わりに、浮標を少しだけ)
    for (const z of [-240, 240]) for (const s of [-1, 1]) add(cyl(1.6, 3.2, 10), s < 0 ? M.red : M.green, world, { x: s * 120, y: 0.4, z });

    // ── 取付けの盛土と線路(支点の後ろから台座の端まで、路面の高さから地面へ下がる) ──
    for (const s of [-1, 1]) {
      const sec = (x, h) => [V(x, D.ground - 0.01, -(6 + h * 1.5)), V(x, D.ground - 0.01, 6 + h * 1.5), V(x, D.ground + h, 6), V(x, D.ground + h, -6)];
      add(k.closedLoft([sec(s * D.emb, D.deck - D.ground - 0.6), sec(s * D.x1, 2)]), M.light, world);
      add(box(8, D.deck - D.ground + 2, 18), M.mid, world, { x: s * (D.emb + 3), y: D.ground + (D.deck - D.ground + 2) / 2 - 1, z: 0 });   // 橋台(盛土の端の壁)
      const ang = Math.atan2(D.deck - 0.6 - (D.ground + 2), D.x1 - D.emb);
      for (const zr of [-0.75, 0.75]) add(box(D.x1 - D.emb, 0.25, 0.3), M.dark, world, { x: (s * (D.emb + D.x1)) / 2, y: (D.deck - 0.6 + D.ground + 2) / 2 + 0.2, z: zr, rz: -s * ang, edges: false });
    }

    // ── 旋回橋: 両岸の支点の橋脚と、回る腕(トラス・床・機械室・釣合い重り) ──
    const arms = [], beacons = [];
    const nodeY = { bot: D.deck - 1.5 };
    for (const s of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.x = s * D.px; world.add(pv);
      // 支点の橋脚(円柱)と旋回輪(暗い輪)、まわりの基礎
      add(cyl(15, D.deck - 6 - D.base, 24), M.light, pv, { y: (D.deck - 6 + D.base) / 2 });
      add(cyl(16.5, 1.2, 24), M.mid, pv, { y: D.ground + 0.6 });
      add(cyl(12, 1.0, 24), M.dark, pv, { y: D.deck - 5.5, edges: false });
      // 腕。局所の +x が長い腕(運河の中央へ)、-x が尾。左岸は 0 で閉、右岸は π で閉
      const yaw = new THREE.Group(); pv.add(yaw);
      const arm = new THREE.Group(); yaw.add(arm);
      add(cyl(11, 4, 24), M.steel, arm, { y: D.deck - 3.5 });   // 旋回の胴(腕と一緒に回る)
      const PAN = 12, PT = 4, xs = [];
      for (let i = -PT; i <= PAN; i++) xs.push(i < 0 ? (i / PT) * D.T : (i / PAN) * D.L);
      const P = (x, side, top) => V(x, top ? topAt(x) : nodeY.bot, (side * D.w) / 2);
      for (const side of [-1, 1]) {
        for (let i = 0; i < xs.length - 1; i++) {
          beam(arm, P(xs[i], side, true), P(xs[i + 1], side, true), 2.4, M.steel);   // 上弦
          beam(arm, P(xs[i], side, false), P(xs[i + 1], side, false), 2.4, M.steel); // 下弦
          const toPivot = Math.abs(xs[i]) > Math.abs(xs[i + 1]);   // 斜材は支点へ向けて下る(プラット形)
          beam(arm, toPivot ? P(xs[i], side, true) : P(xs[i + 1], side, true), toPivot ? P(xs[i + 1], side, false) : P(xs[i], side, false), 1.0, M.light);
        }
        for (const x of xs) beam(arm, P(x, side, false), P(x, side, true), 1.2, M.light);   // 垂直材
      }
      for (let i = 0; i < xs.length; i++) {   // 上の横つなぎと X の斜材、床の横桁
        beam(arm, P(xs[i], -1, true), P(xs[i], 1, true), 0.9, M.light);
        if (i < xs.length - 1) beam(arm, P(xs[i], -1, true), P(xs[i + 1], 1, true), 0.6, M.light);
      }
      // 床(床版・枕木の帯・レール 2 本)
      add(box(D.L + D.T, 1.4, D.w - 1), M.mid, arm, { x: (D.L - D.T) / 2, y: nodeY.bot - 0.2 });
      add(box(D.L + D.T, 0.3, 3.2), M.light, arm, { x: (D.L - D.T) / 2, y: nodeY.bot + 0.65, edges: false });
      for (const zr of [-0.75, 0.75]) add(box(D.L + D.T, 0.25, 0.3), M.dark, arm, { x: (D.L - D.T) / 2, y: nodeY.bot + 0.9, z: zr, edges: false });
      // 先端の締結装置、尾の釣合い重り、支点の上の操作室(チーム色の帯と回転灯)
      add(box(3, 4, D.w + 1), M.dark, arm, { x: D.L - 1.5, y: nodeY.bot + 1 });
      add(box(14, 12, D.w + 2), M.light, arm, { x: -D.T + 7, y: nodeY.bot - 6 });
      add(box(10, 6, 9), M.body, arm, { y: topAt(0) + 3 });
      add(box(10.2, 1.2, 9.2), M.glass, arm, { y: topAt(0) + 4, edges: false });
      add(box(10.4, 0.6, 9.4), M.accent, arm, { y: topAt(0) + 1.2, edges: false });
      beacons.push(add(cyl(0.6, 1.0, 8), M.beaconOff, arm, { y: topAt(0) + 6.5, edges: false }));
      arms.push({ s, yaw });
    }

    // ── 近未来化: 旋回の管制塔(左岸)と、運河監視のセンサーの塔 4 基 ──
    add(box(26, 18, 18), M.body, world, { x: -300, y: D.ground + 9, z: -150 });
    for (const y of [9, 15]) add(box(26.2, 2, 18.2), M.glass, world, { x: -300, y: D.ground + y, z: -150, edges: false });
    add(box(26.6, 0.8, 18.6), M.accent, world, { x: -300, y: D.ground + 18.4, z: -150, edges: false });
    add(box(8, 8, 8), M.light, world, { x: -300, y: D.ground + 22, z: -150 });
    add(box(7, 3, 3), M.body, world, { x: -300, y: D.ground + 27.5, z: -149 });   // 箱形のレーダーの覆い
    for (const [x, z] of [[-300, 215], [300, -215], [-310, -225], [310, 225]]) {
      lattice(world, V(x, D.ground, z), 34, 2.6, 1.0, 4, 0.3, M.mid);
      add(box(3.2, 0.3, 3.2), M.light, world, { x, y: D.ground + 34.2, z });
      add(box(2.2, 1.6, 2.2), M.dark, world, { x, y: D.ground + 35.2, z });
      add(box(1.4, 0.6, 0.1), M.glass, world, { x, y: D.ground + 35.3, z: z + 1.15 * Math.sign(-z), edges: false });
      add(box(3.4, 0.5, 3.4), M.accent, world, { x, y: D.ground + 33.2, z, edges: false });
    }
    // 岸の倉庫・信号所(運河の管理施設)
    for (const [x, z, w, d, h] of [[-300, 110, 36, 22, 9], [-250, 230, 22, 16, 7], [300, -110, 34, 20, 8], [255, -230, 18, 14, 6]]) {
      add(box(w, h, d), M.light, world, { x, y: D.ground + h / 2, z });
      add(box(w + 0.6, 0.6, d + 0.6), M.mid, world, { x, y: D.ground + h + 0.3, z });
    }

    // ── タンカー(スエズマックス 275 × 48 m。開のときだけ運河を南へ通る) ──
    const ship = new THREE.Group(); world.add(ship);
    const hull = (z, w, d) => ({ z, pts: [[-w * 0.7, -d], [w * 0.7, -d], [w, 0], [w, 9], [-w, 9], [-w, 0]] });
    add(U.loft(THREE, [hull(-137, 18, 8), hull(-125, 24, 12), hull(100, 24, 12), hull(125, 15, 10), hull(137.5, 2, 6)]), M.mid, ship);
    add(box(46, 0.5, 220), M.light, ship, { y: 9.25, z: 0 });
    add(box(46.2, 2.6, 250), M.dark, ship, { y: -0.9, z: -5, edges: false });   // 喫水線より下の暗い帯(水面の下に透ける)
    add(box(36, 14, 18), M.body, ship, { y: 16, z: -118 });                     // 船橋
    add(box(38, 2.4, 3), M.glass, ship, { y: 21.5, z: -109, edges: false });
    add(box(7, 9, 7), M.mid, ship, { y: 27.5, z: -124 });                       // 煙突
    add(box(1.6, 3, 200), M.mid, ship, { y: 11, z: 5 });                        // 甲板の配管の通路
    for (const z of [-60, 0, 60]) add(box(30, 2, 3), M.steel, ship, { y: 10.5, z });   // 荷役の配管の台
    let shipT = 0;

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 112, M.ring, M.disc);

    // ── 状態: t = 0(開: 腕は岸に沿う)〜 1(閉: 腕が運河の中央で突き合う) ──
    const ease = (x) => x * x * (3 - 2 * x);
    let state = opts.state ?? "open", t = state === "closed" ? 1 : 0, clock = 0;
    const yawOf = (s, tt) => (s < 0 ? -Math.PI / 2 * (1 - ease(tt)) : Math.PI - (Math.PI / 2) * (1 - ease(tt)));
    function apply() {
      for (const a of arms) a.yaw.rotation.y = yawOf(a.s, t);
      ship.visible = state === "open";
      ship.position.set(0, 0, -120 + 240 * shipT);
    }
    function update(dt) {
      clock += dt;
      if (state === "closing") { t = Math.min(1, t + dt / SEC); if (t >= 1) state = "closed"; }
      if (state === "opening") { t = Math.max(0, t - dt / SEC); if (t <= 0) state = "open"; }
      if (state === "open") shipT = (shipT + dt / 26) % 1;
      apply();
      const moving = state === "closing" || state === "opening", blink = moving && Math.floor(clock * 3) % 2 === 0;
      for (const b of beacons) b.material = blink ? M.beacon : M.beaconOff;
      M.canal.map.offset.y -= dt * 0.06;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "open" || s === "closed") { state = s; t = s === "closed" ? 1 : 0; }
      else if (s === "closing" || s === "opening") state = s;
      apply();
    }
    function check() {
      const r1 = (v) => +v.toFixed(2);
      // 尾(釣合い重りの角まで)の回転半径と、盛土の端の壁(x = emb)
      const tailR = Math.hypot(D.T, (D.w + 2) / 2);
      // 開いた腕(岸に沿う)とタンカーの舷側
      const armInner = D.px - (D.w + 2.4) / 2;
      return {
        tipGapClosed_m: r1(2 * (D.px - D.L)),                          // 閉じたときの中央の隙間
        tailToAbutment_m: r1(D.emb - D.px - tailR),                     // 回る尾と橋台の壁の隙間
        trussOverGround_m: r1(nodeY.bot - 0.9 - D.ground),              // 開いた腕(岸の上)の床の下面と地面
        pierToCanalTop_m: r1(D.px - 16.5 - D.bank),                     // 支点の基礎と岸の上端
        shipToOpenArm_m: r1(armInner - 24),                             // 開いたときの腕の内側とタンカーの舷側
        shipToWaterEdge_m: r1(D.wet - 24),
        trussHeight_m: { pivot: TOP0, tip: TOP1, tail: TOPT },
      };
    }

    U.bake(THREE, group, { dynamic: [...arms.map((a) => a.yaw), ship], live: [M.accent] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, check, at, setState, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      get state() { return state; }, get progress() { return t; },
      get stage() { return state === "closing" ? "旋回橋が回って鉄道をつなぐ" : state === "opening" ? "旋回橋が岸へ戻り航路を開ける" : ""; },
      shots: {
        pivot: { label: "支点とトラス", target: [185, 30, 40], pos: [330, 90, 220] },
        center: { label: "中央(閉)", target: [0, 25, 0], pos: [60, 70, 210] },
        ship: { label: "通航(開)", target: [0, 15, 60], pos: [-200, 90, 330] },
        sensor: { label: "管制塔とセンサー", target: [-300, 20, -170], pos: [-200, 70, -60] },
      },
    };
  }

  DreamAssets.fac.register("suez", {
    section: 9, title: "スエズ運河(エル・フェルダン旋回橋)", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "世界の海運の約 1 割が通るスエズ運河を、世界最長級の鉄道旋回橋がまたぐ。普段は両岸に沿って開いて船を通し、列車のときだけ 90° 回って運河を渡す",
    info: [["ファイル", "mockups/3d/facilities/suez.js"], ["大きさ", "運河の 700 × 520 m を 0.25 倍 × 表示 3.0"], ["誇張", "旋回橋のトラスの背 2 倍(支点の上 60 m)・幅 1.6 倍(22 m)、部材の太さ 2 倍。運河の幅・腕の長さは実寸"], ["省略", "列車・車両・人、架線、新運河(切り取りの外)"], ["動作", "開(タンカーが通航)→ 閉鎖(20 秒で腕が 90° 回る)→ 閉"], ["近未来化", "旋回の管制塔、運河監視のセンサーの塔 4 基"]],
    dist: 980, target: 30, tokenAt: [370, 0, 290],
    make: (THREE) => suez(THREE, { r: 112 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["開", () => a.setState("open"), () => a.state === "open"], ["閉鎖 ▶", () => a.setState("closing"), () => a.state === "closing"], ["閉", () => a.setState("closed"), () => a.state === "closed"], ["◀ 開放", () => a.setState("opening"), () => a.state === "opening"]],
    caption: (a) => (a.stage ? (a.state === "closing" ? "閉鎖中 — " : "開放中 — ") + a.stage : ""),
  });
})();
