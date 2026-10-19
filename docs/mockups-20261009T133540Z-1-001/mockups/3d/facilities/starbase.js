// 戦略施設トークン「スターベース」(米テキサス州ボカチカ)の詳細版モデル(試作)。
// 発射塔(格子の鋼の塔、ブースターをつかむ 2 本の腕「チョップスティック」、宇宙船へ延びる補給腕)、発射台(6 本脚の台と締め具の輪、下の鋼の排炎板)、
// スーパーヘビーとスターシップの組み(高さ 121 m)、端に推進剤のタンク、浜と海を、塔のまわり約 240 × 240 m で切り取る(組立区画は切り取りの外)。
// 象徴: 塔と機体の組み。発射施設(塔・腕・発射台・機体)は 1.3 倍で、ゲーム視点で最も高く大きい塊にする(縮尺 K を上げて切り取りを狭めた)。
// 動き(実物の帰還の手順): 「組み上げ」(機体を発射台に立て、補給腕がつながる)/「回収」(宇宙船は打ち上げ済み。補給腕が退き、腕の台車が上がって開き、降りてきたブースターを閉じた腕が受け止める)。
// 近未来化: 沖の洋上発射台(石油リグを改造した台、小さな塔とヘリパッド)。
// 省略: 車両・人・クレーン車、送電線、排気の炎(動きは腕と機体の位置だけ)、組立棟(メガベイ)と大半のタンク。
//
//   const a = DreamAssets.fac.defs.starbase.make(THREE)(制圧圏 r = 100)
// 座標(m): 塔の中心が原点、発射台は +z、海は +z の先。地面 y = 0。
(function () {
  const K = 0.4;
  const D = { x0: -120, x1: 120, z0: -95, z1: 145, base: -12, shore: 105, EX: 1.3, SEC: 14 };
  const T = { hw: 7, h: 146, olm: [0, 28], olmTop: 23, boosterH: 71, shipH: 50, r: 4.5, pivot: [6.6, 8.5], armLen: 36, open: 0.6, park: 70, catchY: 100, pin: 64 };

  function starbase(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE, { repeat: [((D.x1 - D.x0) * K) / U.WATER_TILE[0], ((D.z1 - D.shore) * K) / U.WATER_TILE[1]] });
    M.sand = M.lambert(0xe8e2d6);
    const group = new THREE.Group(); group.name = "starbase";
    const ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, beam, prism, lattice, arcLoft, closedLoft } = k;
    const lathe = (pts, n = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);

    // ── 地面: 平らな砂地、浜、海 ──
    add(prism([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.shore - 20], [D.x0, D.shore - 20]], D.base, 0), M.land, world);
    add(closedLoft([D.x0, D.x1].map((x) => [[D.shore - 20, D.base], [D.shore + 12, D.base], [D.shore + 12, -6], [D.shore - 20, 0]].map(([z, y]) => V(x, y, z)))), M.sand, world);   // 浜(海へ下る砂の斜面)
    add(box(D.x1 - D.x0, -10 - D.base, D.z1 - D.shore - 12), M.light, world, { y: (D.base - 10) / 2, z: (D.shore + 12 + D.z1) / 2, edges: false });
    world.add(k.waterShape([[D.x0, D.shore - 20], [D.x1, D.shore - 20], [D.x1, D.z1], [D.x0, D.z1]], M.sea));
    world.add(new THREE.Mesh(U.merge(THREE, [D.x0, D.x1].map((x) => [new THREE.PlaneGeometry(D.z1 - D.shore - 12, 10), { x, y: -5, z: (D.shore + 12 + D.z1) / 2, ry: Math.PI / 2 }])), M.waterCut));
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2, { z: ZC });
    for (const [x, z, w, d] of [[-80, 72, 50, 10], [55, 74, 40, 10]]) add(prism([[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2 - 6, z + d / 2], [x - w / 2 + 6, z + d / 2]], 0, 3), M.sand, world);   // 砂丘
    add(box(D.x1 - D.x0, 0.15, 10), M.mid, world, { y: 0.08, z: -85, edges: false });   // ハイウェイ 4
    add(box(80, 0.3, 90), M.light, world, { y: 0.15, z: 10 });                             // 発射区画の舗装

    // ── 発射施設(1.3 倍): 塔、発射台、機体、腕 ──
    const lc = new THREE.Group(); lc.scale.setScalar(D.EX); world.add(lc);
    const hw = T.hw, lv = 16, dh = T.h / lv;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(box(2.2, T.h, 2.2), M.light, lc, { x: sx * (hw - 0.5), y: T.h / 2, z: sz * (hw - 0.5) });
    for (let i = 0; i <= lv; i++) {
      const y = i * dh;
      for (const s of [-1, 1]) { beam(lc, V(-hw + 0.5, y, s * (hw - 0.5)), V(hw - 0.5, y, s * (hw - 0.5)), 0.9, M.light); beam(lc, V(s * (hw - 0.5), y, -hw + 0.5), V(s * (hw - 0.5), y, hw - 0.5), 0.9, M.light); }
      if (i === lv) break;
      for (const s of [-1, 1]) {   // 各面の X の斜材
        beam(lc, V(-hw + 0.5, y, s * (hw - 0.5)), V(hw - 0.5, y + dh, s * (hw - 0.5)), 0.6, M.mid); beam(lc, V(hw - 0.5, y, s * (hw - 0.5)), V(-hw + 0.5, y + dh, s * (hw - 0.5)), 0.6, M.mid);
        beam(lc, V(s * (hw - 0.5), y, -hw + 0.5), V(s * (hw - 0.5), y + dh, hw - 0.5), 0.6, M.mid); beam(lc, V(s * (hw - 0.5), y, hw - 0.5), V(s * (hw - 0.5), y + dh, -hw + 0.5), 0.6, M.mid);
      }
    }
    add(box(15, 2, 15), M.mid, lc, { y: T.h + 1 });
    add(box(10, 6, 6), M.light, lc, { y: T.h + 5, z: -2 });   // 頂部の巻上げ機室
    add(cyl(0.4, 14, 6), M.dark, lc, { y: T.h + 9, x: 5, z: 5 });
    add(box(16, 1.2, 16), M.accent, lc, { y: T.h - 1, edges: false });
    add(box(18, 8, 18), M.mid, lc, { y: 4 });   // 塔の基部の機械室
    // 発射台(6 本脚の台、締め具の輪、ブースターの補給腕)と鋼の排炎板
    const [ox, oz] = T.olm;
    add(cyl(15, 1.2, 24), M.dark, lc, { x: ox, y: 0.6, z: oz });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; add(box(3.4, T.olmTop - 4, 3.4), M.light, lc, { x: ox + 10.5 * Math.cos(a), y: (T.olmTop - 4) / 2, z: oz + 10.5 * Math.sin(a) }); }
    add(arcLoft([[5.6, T.olmTop - 4], [13, T.olmTop - 4], [13, T.olmTop], [5.6, T.olmTop]], 0, Math.PI * 2, 32), M.light, lc, { x: ox, z: oz });
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; add(box(1.0, 1.6, 1.4), M.dark, lc, { x: ox + 5.4 * Math.cos(a), y: T.olmTop + 0.8, z: oz + 5.4 * Math.sin(a), ry: -a, edges: false }); }
    add(box(3, 3, 8), M.mid, lc, { x: ox, y: T.olmTop - 2, z: oz - 15 });

    // 機体: スーパーヘビー(ステンレスの筒、上に格子翼と段間の通気輪、受け止めのピン)とスターシップ(片面が黒い耐熱タイル、前後のフラップ)
    const booster = new THREE.Group(); booster.position.set(ox, T.olmTop, oz); lc.add(booster);
    add(lathe([[0, 0], [4.2, 0], [4.5, 1.6], [4.5, 69.2], [0, 69.2]]), M.steel, booster);
    add(cyl(4.5, 1.8, 20), M.dark, booster, { y: 70.1, edges: false });   // 段間の通気輪
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; add(box(0.5, 5, 3.4), M.mid, booster, { x: 5.8 * Math.cos(a), y: 66, z: 5.8 * Math.sin(a), ry: -a }); }   // 格子翼
    for (const s of [-1, 1]) add(box(2.4, 1.2, 1.8), M.dark, booster, { x: s * 5.6, y: T.pin, z: 0 });   // 受け止めのピン(腕のレールに載る)
    add(cyl(4.55, 0.8, 20), M.accent, booster, { y: 40, edges: false });
    const ship = new THREE.Group(); ship.position.y = T.boosterH; booster.add(ship);
    add(lathe([[0, 0], [4.5, 0], [4.5, 34], [4.2, 40], [3.2, 45], [1.6, 48.5], [0, 50]]), M.steel, ship);
    add(new THREE.LatheGeometry([[4.56, 1], [4.56, 34], [4.26, 40], [3.26, 45]].map(([r, y]) => new THREE.Vector2(r, y)), 10, -Math.PI / 2, Math.PI), M.dark, ship, { edges: false });   // 耐熱タイル(+z の面)
    for (const s of [-1, 1]) {
      add(box(4.2, 9, 0.6), M.dark, ship, { x: s * 6.3, y: 6, z: 0.6 });     // 後部フラップ
      add(box(2.4, 5.5, 0.5), M.dark, ship, { x: s * 4.6, y: 40, z: 0.5, rz: s * 0.25 });   // 前部フラップ
    }

    // 腕の台車(塔を上下)とチョップスティック 2 本、宇宙船の補給腕
    const carriage = new THREE.Group(); carriage.position.y = T.park; lc.add(carriage);
    for (const [x, z, w, d] of [[0, -hw - 1.6, 2 * hw + 4.8, 1.6], [0, hw + 1.6, 2 * hw + 4.8, 1.6], [-hw - 1.6, 0, 1.6, 2 * hw + 1.6], [hw + 1.6, 0, 1.6, 2 * hw + 1.6]]) add(box(w, 6, d), M.mid, carriage, { x, y: 0, z });
    const arms = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * T.pivot[0], 0, T.pivot[1]); carriage.add(g);
      add(box(3.4, 6, 3.4), M.dark, g, { y: 0, z: 0.6 });   // 旋回の軸受け
      const L = T.armLen, a = new THREE.Group(); g.add(a);
      for (const [x, y] of [[-1.1, -1.6], [1.1, -1.6], [-1.1, 1.6], [1.1, 1.6]]) beam(a, V(x, y, 1.5), V(x, y, L), 0.7, M.light);
      for (let i = 0; i <= 8; i++) { const z = 1.5 + ((L - 1.5) * i) / 8; for (const x of [-1.1, 1.1]) { beam(a, V(x, -1.6, z), V(x, 1.6, z), 0.45, M.light); if (i < 8) beam(a, V(x, -1.6, z), V(x, 1.6, z + (L - 1.5) / 8), 0.35, M.mid); } }
      add(box(2.6, 0.5, 16), M.dark, a, { y: 1.95, z: T.olm[1] - T.pivot[1], edges: false });   // 受け止めのレール(ピンが載る)
      add(box(2.8, 1.2, 3), M.accent, a, { y: 0, z: L - 1, edges: false });
      arms.push({ g, s });
    }
    const qd = new THREE.Group(); qd.position.set(0, T.olmTop + T.boosterH + 30, hw); lc.add(qd);   // 宇宙船の補給腕(塔の +z の面から)
    const QDL = T.olm[1] - hw - T.r - 1.2;   // 補給腕の長さ(先の接続板の手前まで)
    for (const x of [-1, 1]) beam(qd, V(x, 0, 0), V(x, 0, QDL), 0.8, M.light);
    for (let i = 0; i < 5; i++) beam(qd, V(-1, 0, i * 3), V(1, 0, i * 3 + 1.5), 0.4, M.mid);
    add(box(3.4, 3.4, 1.2), M.dark, qd, { z: T.olm[1] - hw - T.r - 0.6 });

    // ── 推進剤のタンク(実寸。端の 3 基だけ)と配管 ──
    for (const [x, z, r, h] of [[-100, -55, 6, 34], [-100, -30, 6, 34], [-78, -55, 5, 28]]) {
      add(cyl(r, h, 18), M.body, world, { x, y: h / 2, z });
      add(cyl(r + 0.3, 1.2, 18), M.mid, world, { x, y: h - 2, z, edges: false });
      add(cyl(r * 0.7, 1, 12), M.light, world, { x, y: h + 0.5, z });
    }
    beam(world, V(-72, 6, -42), V(-20, 6, -42), 2.4, M.mid); beam(world, V(-20, 6, -42), V(-20, 6, -12), 2.4, M.mid);   // 配管ラック(発射台へ)
    for (let i = 0; i < 4; i++) add(box(1, 6, 1), M.dark, world, { x: -66 + i * 14, y: 3, z: -42, edges: false });

    // ── 近未来化: 沖の洋上発射台(石油リグ改造) ──
    const rig = new THREE.Group(); rig.position.set(88, 0, 128); rig.scale.setScalar(0.6); world.add(rig);
    for (const [x, z] of [[-18, -18], [18, -18], [18, 18], [-18, 18]]) add(cyl(3, 36, 12), M.mid, rig, { x, y: 8, z });
    add(box(50, 6, 50), M.light, rig, { y: 28 });
    add(box(30, 8, 14), M.body, rig, { x: -6, y: 35, z: -16 });
    lattice(rig, V(10, 31, 8), 52, 4, 4, 6, 0.5, M.light);
    add(cyl(6, 0.6, 16), M.dark, rig, { x: -12, y: 31.3, z: 12 });
    add(box(10, 1, 10), M.accent, rig, { x: 10, y: 83.5, z: 8, edges: false });

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);

    // ── 状態: t = 0(組み上げ)/ 回収(0 → 1: 補給腕が退き、台車が上がって腕を開き、ブースターが降りて腕が閉じる) ──
    const ease = (x) => x * x * (3 - 2 * x), seg = (t, a, b) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));
    const catchBase = T.catchY + 2.2 + 0.6 - T.pin;   // 受け止めたときのブースターの下端(ピンの下面が腕のレールの上面 = 台車 + 2.2)
    let state = opts.state ?? "stack", t = state === "caught" ? 1 : 0;
    function apply() {
      const stack = state === "stack";
      ship.visible = stack;
      qd.rotation.y = stack ? 0 : (Math.PI / 2) * seg(t, 0, 0.15);   // 退くと塔の面に沿う
      carriage.position.y = stack ? T.park : T.park + (T.catchY - T.park) * seg(t, 0.05, 0.3);
      const open = stack ? T.open : T.open * (1 - seg(t, 0.85, 1));
      for (const a of arms) a.g.rotation.y = a.s * open;
      booster.position.y = stack ? T.olmTop : catchBase + 160 * (1 - seg(t, 0.3, 0.88));
    }
    apply();
    function update(dt) {
      if (state === "catching") { t = Math.min(1, t + dt / D.SEC); if (t >= 1) state = "caught"; apply(); }
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "stack") { state = "stack"; t = 0; }
      else if (s === "caught") { state = "caught"; t = 1; }
      else if (s === "catching") { state = "catching"; t = 0; }
      apply();
    }
    const stage = () => state !== "catching" ? "" : t < 0.3 ? "補給腕を退け、腕の台車を受け止めの高さへ" : t < 0.85 ? "ブースターが降りてくる" : "腕を閉じて受け止める";
    // 確認値(m、1.3 倍の後): 閉じた腕とブースター、開いた腕と発射台の上のブースター、受け止めたブースターと発射台、補給腕と宇宙船、塔と発射台の輪
    function check() {
      const r1 = (v) => +(v * D.EX).toFixed(2);
      const armInner = T.pivot[0] - 1.1 - 0.35;   // 閉じた腕の内側の面(管の半分を含む)
      const openGap = (() => {   // 開いた腕の内側の線(軸 → 先端)と、発射台の上のブースターの円の最小の距離
        let m = Infinity;
        for (let i = 0; i <= 40; i++) { const l = 1.5 + ((T.armLen - 1.5) * i) / 40, x = T.pivot[0] + Math.sin(T.open) * l - Math.cos(T.open) * 1.45, z = T.pivot[1] + Math.cos(T.open) * l + Math.sin(T.open) * 1.45; m = Math.min(m, Math.hypot(x - T.olm[0], z - T.olm[1]) - T.r); }
        return m;
      })();
      return {
        closedArmToBooster_m: r1(armInner - T.r), pinOverlapOnRail_m: r1(5.6 + 1.2 - (T.pivot[0] - 1.3)),   // 閉じた腕とブースターの面、ピンが腕のレールに載る幅
        openArmToBooster_m: r1(openGap),
        caughtBoosterAboveMount_m: r1(catchBase - T.olmTop),
        shipQdToShip_m: r1(T.olm[1] - T.r - (hw + QDL + 1.2)),   // 補給腕の接続板と宇宙船の面(0 = 接続)
        towerToMountRing_m: r1(T.olm[1] - 13 - hw),
        stackTop_m: r1(T.olmTop + T.boosterH + T.shipH), towerTop_m: r1(T.h),
      };
    }

    U.bake(THREE, group, { dynamic: [booster, ship, carriage, qd, ...arms.map((a) => a.g)], live: [M.accent], also: [] });
    return {
      group, update, setState, check, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      get state() { return state; }, get progress() { return t; }, get stage() { return stage(); },
      at: (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K),
      shots: {
        tower: { label: "塔と機体", target: [0, 110, 20], pos: [160, 150, 220] },
        arms: { label: "チョップスティック", target: [0, 125, 30], pos: [70, 150, 110] },
        mount: { label: "発射台", target: [0, 25, 36], pos: [55, 40, 100] },
        rig: { label: "洋上発射台", target: [88, 20, 128], pos: [20, 60, 200] },
      },
    };
  }

  DreamAssets.fac.register("starbase", {
    section: 9, title: "スターベース", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "最大級のロケットの製造・打ち上げ拠点。格子の発射塔に 2 本の巨大な腕(チョップスティック)が付き、帰還したブースターを空中で受け止める。沖に石油リグを改造した洋上発射台を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/starbase.js"], ["大きさ", "塔のまわり 240 × 240 m を 0.4 倍 × 表示 3.0"], ["誇張", "発射施設(塔・腕・発射台・機体)1.3 倍(塔 146 → 190 m)、洋上発射台 0.6 倍"], ["省略", "車両・人・クレーン車・送電線・排気の炎、組立棟と大半のタンク"], ["動作", "組み上げ / 回収(腕の台車が上がり、降りてくるブースターを閉じた腕で受け止める、14 秒)"], ["近未来化", "沖の洋上発射台(石油リグ改造)"]],
    dist: 1050, target: 120, tokenAt: [360, 0, 300],
    make: (THREE) => starbase(THREE, { r: 100 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["組み上げ(発射前)", () => a.setState("stack"), () => a.state === "stack"], ["回収 ▶", () => a.setState("catching"), () => a.state === "catching"], ["受け止め済み", () => a.setState("caught"), () => a.state === "caught"]],
    caption: (a) => (a.stage ? "回収中 — " + a.stage : ""),
  });
})();
