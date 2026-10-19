// 戦略施設トークン「海水淡水化プラント」(湾岸諸国の発電・淡水化の複合施設。例: ドバイのジェベル・アリ)の詳細版モデル(試作)。
// 平面は実寸の比率(1600 × 1010 m を K 倍)。海岸沿いに発電所(ガスタービン 4 基と排熱回収ボイラー・煙突)、多段フラッシュ(MSF)の蒸発器 6 列、逆浸透(RO)棟、
// 製品水の大タンク、取水口と海へ延びる取水管、放流水路。
// 誇張(モデルの決め手): 煙突の高さ 1.5 倍(約 90 m)、取水管の太さ 2 倍。近未来化の防空陣地は 2 倍の大きさ。
// 省略: 車両・人・小さな機器(カートリッジフィルター、ポンプ単体、柵)。
// 近未来化(施設リストの案): 周囲 4 か所の防空陣地(土塁・固定式の発射機・箱形の覆いのレーダー・指揮所)、沖に係留した浮体式の予備淡水化モジュール 2 隻と浮きホース。
// 状態: "normal"(平常)/ "alert"(警戒: 発射機が起立し、指揮所の回転灯が点滅)。放流水路は常に海へ流れる。
// 海岸線は z = 250 の直線、+z が海。
(function () {
  const K = 0.11;
  const D = { x0: -800, x1: 800, z0: -450, z1: 560, coast: 250, ground: 4, bed: -12, base: -14, stack: 90, pipeR: 3.5, ad: 2 };
  const ZC = (D.z0 + D.z1) / 2;
  const ELEV = (55 * Math.PI) / 180, RAISE_SEC = 4;

  function desal(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 110;
    const M = F.mats(THREE);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, prism, waterShape, tube, beam, lattice } = k;
    M.sea = k.water(); M.outfall = k.water(); M.mark = M.lambert(0xf2c84b);
    const group = new THREE.Group(); group.name = "desal";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);
    const G = D.ground;
    const extZ = (xy, z0, z1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(xy.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); return g; };

    // ── 台座: 陸(取水口と放流水路の切り欠き)、海底、海、水の切り口、足元の帯 ──
    const IN = { x0: -520, x1: -420, z0: 120 }, OUT = { x0: 380, x1: 420, z0: 150 };
    add(prism([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.coast], [OUT.x1, D.coast], [OUT.x1, OUT.z0], [OUT.x0, OUT.z0], [OUT.x0, D.coast], [IN.x1, D.coast], [IN.x1, IN.z0], [IN.x0, IN.z0], [IN.x0, D.coast], [D.x0, D.coast]], D.base, G), M.land, world);
    add(box(D.x1 - D.x0, D.bed - D.base, D.z1 - 100), M.light, world, { y: (D.base + D.bed) / 2, z: (D.z1 + 100) / 2, edges: false });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.001, { z: ZC });
    const sea = waterShape([[D.x0, D.z1], [D.x1, D.z1], [D.x1, D.coast], [OUT.x1, D.coast], [IN.x1, D.coast], [IN.x1, IN.z0], [IN.x0, IN.z0], [IN.x0, D.coast], [D.x0, D.coast]], M.sea); world.add(sea);
    const outW = waterShape([[OUT.x0, OUT.z0], [OUT.x1, OUT.z0], [OUT.x1, D.coast], [OUT.x0, D.coast]], M.outfall); outW.position.y = 0.3; world.add(outW);
    const H = -D.bed;
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(D.x1 - D.x0, H), { y: -H / 2, z: D.z1 }],
      [new THREE.PlaneGeometry(D.z1 - D.coast, H), { x: D.x0, y: -H / 2, z: (D.z1 + D.coast) / 2, ry: Math.PI / 2 }],
      [new THREE.PlaneGeometry(D.z1 - D.coast, H), { x: D.x1, y: -H / 2, z: (D.z1 + D.coast) / 2, ry: Math.PI / 2 }],
    ]), M.waterCut));
    // 岸壁の笠石と取水口の防波堤(捨て石の台形)
    for (const [xa, xb] of [[D.x0, IN.x0], [IN.x1, OUT.x0], [OUT.x1, D.x1]]) add(box(xb - xa, 0.6, 4), M.light, world, { x: (xa + xb) / 2, y: G + 0.3, z: D.coast - 2 });
    for (const x of [-548, -392]) add(extZ([[x - 12, D.bed], [x + 12, D.bed], [x + 4, 3], [x - 4, 3]], D.coast, D.coast + 95), M.mid, world);
    // 道路
    for (const [x, z, w, d] of [[0, 70, D.x1 - D.x0, 12], [0, -410, D.x1 - D.x0, 12], [-80, -170, 12, 480]]) add(box(w, 0.15, d), M.mid, world, { x, y: G + 0.075, z, edges: false });

    // ── 取水: 取水口の建屋(除塵スクリーンの溝、ポンプの電動機)、海底の取水管、沖の取水塔(上に標識の浮標) ──
    add(box(100, 18, 35), M.body, world, { x: -470, y: G + 9, z: 102.5 });
    add(box(100.4, 1.2, 35.4), M.dark, world, { x: -470, y: G + 14, z: 102.5, edges: false });
    for (let i = 0; i < 6; i++) add(box(10, 12, 0.6), M.dark, world, { x: -510 + i * 16, y: G + 2, z: 120.3, edges: false });
    for (let i = 0; i < 6; i++) add(cyl(2, 4, 10), M.mid, world, { x: -510 + i * 16, y: G + 20, z: 100 });
    for (const dx of [-30, 0, 30]) {
      const x = -470 + dx, y = D.bed + D.pipeR;
      tube(world, V(x, y, 121), V(x, y, 478), D.pipeR, M.mid);
      tube(world, V(x, y, 121), V(x, G + 2, 121), D.pipeR, M.mid);   // 建屋への立ち上がり
      add(cyl(9, 6, 16), M.light, world, { x, y: D.bed + 3, z: 480 });
      add(cyl(12, 1.5, 16), M.light, world, { x, y: D.bed + 6.75, z: 480 });   // 取水口のふた(流速を下げる)
      add(cyl(1.6, 3, 10), M.mark, world, { x, y: 0.6, z: 480 });
      add(new THREE.ConeGeometry(1.1, 1.6, 8), M.mark, world, { x, y: 2.9, z: 480 });
    }
    // ── 放流: 放流槽、水路の流れ、海底の拡散管 ──
    add(box(60, 10, 30), M.light, world, { x: 400, y: G + 5, z: 135 });
    tube(world, V(400, D.bed + 2.5, D.coast), V(400, D.bed + 2.5, 335), 2.5, M.mid);
    for (let i = 0; i < 4; i++) tube(world, V(400, D.bed + 2.5, 280 + i * 18), V(400, D.bed + 7, 280 + i * 18), 0.8, M.mid);

    // ── 発電所: ガスタービン建屋、ダクト、排熱回収ボイラー、煙突(1.5 倍)、蒸気タービン建屋、主変圧器 ──
    for (let i = 0; i < 4; i++) {
      const x = -330 + i * 100;
      add(box(40, 22, 55), M.light, world, { x, y: G + 11, z: -250 });
      add(box(18, 14, 12), M.mid, world, { x, y: G + 9, z: -216 });
      add(box(28, 38, 45), M.body, world, { x, y: G + 19, z: -187.5 });
      for (const y of [12, 24, 34]) add(box(28.4, 0.8, 45.4), M.mid, world, { x, y: G + y, z: -187.5, edges: false });
      for (let j = 0; j < 5; j++) add(box(1, 30, 1), M.mid, world, { x: x - 14.5, y: G + 17, z: -205 + j * 9, edges: false });
      add(box(6, 3, 30), M.mid, world, { x: x + 10, y: G + 39.5, z: -187.5 });   // 汽水分離の胴
      add(cyl(4.5, D.stack, 14), M.body, world, { x, y: G + D.stack / 2, z: -158 });
      add(cyl(4.7, 6, 14), M.dark, world, { x, y: G + D.stack - 3, z: -158, edges: false });
      add(cyl(6.5, 1.0, 14), M.light, world, { x, y: G + D.stack * 0.78, z: -158 });   // 測定の足場
      add(box(10, 8, 8), M.dark, world, { x, y: G + 4, z: -150 });   // 煙突の下の連絡ダクト
      add(box(10, 7, 9), M.mid, world, { x: x + 14, y: G + 3.5, z: -285 });   // 主変圧器
      for (const e of [-4.5, 4.5]) add(box(0.4, 5, 8), M.dark, world, { x: x + 14 + e, y: G + 3.5, z: -285, edges: false });
    }
    add(box(390, 30, 42), M.light, world, { x: -180, y: G + 15, z: -320 });
    add(box(380, 4, 10), M.mid, world, { x: -180, y: G + 32, z: -320 });   // 屋根の採光の棟
    add(box(390.4, 1.2, 42.4), M.accent, world, { x: -180, y: G + 27, z: -320, edges: false });
    // 開閉所(門形の鉄構の列)と送電鉄塔
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) {
      const x = -690 + a * 60, z = -300 + b * 55;
      for (const e of [-14, 14]) add(box(1.4, 18, 1.4), M.mid, world, { x: x + e, y: G + 9, z });
      add(box(30, 1.4, 1.4), M.mid, world, { x, y: G + 17.5, z });
      add(box(6, 4, 4), M.dark, world, { x, y: G + 2, z: z + 18 });
    }
    for (const x of [-680, -540]) {
      lattice(world, V(x, G, -415), 55, 6, 2.2, 5, 0.5, M.mid);
      add(box(26, 1.2, 1.6), M.mid, world, { x, y: G + 44, z: -415 });
      add(box(18, 1.2, 1.6), M.mid, world, { x, y: G + 52, z: -415 });
    }

    // ── 多段フラッシュ(MSF)の蒸発器 6 列: 段の継ぎ目、端の加熱器、上の排気凝縮器。列の間に配管架台 ──
    for (let j = 0; j < 6; j++) {
      const x = 140 + j * 75;
      add(box(28, 16, 160), M.body, world, { x, y: G + 8, z: -150 });
      for (let s = 1; s < 10; s++) add(box(28.4, 16.2, 0.6), M.mid, world, { x, y: G + 8, z: -230 + s * 16, edges: false });
      const hG = cyl(4, 28, 12); hG.rotateZ(Math.PI / 2);
      add(hG, M.light, world, { x, y: G + 6, z: -238 });
      add(box(10, 4, 14), M.light, world, { x: x + 6, y: G + 18, z: -110 });
      add(box(6, 4, 6), M.mid, world, { x: x - 7, y: G + 18, z: -190 });
      if (j < 5) {
        add(box(4, 1, 160), M.mid, world, { x: x + 37.5, y: G + 12, z: -150 });
        for (const e of [-1.2, 1.2]) tube(world, V(x + 37.5 + e, G + 13.6, -230), V(x + 37.5 + e, G + 13.6, -70), 1.1, M.light);
        for (let s = 0; s < 6; s++) add(box(1, 12, 1), M.mid, world, { x: x + 37.5, y: G + 6, z: -220 + s * 30, edges: false });
      }
    }
    // ── 逆浸透(RO)棟、前処理の槽、製品水タンク ──
    add(box(110, 14, 70), M.body, world, { x: -280, y: G + 7, z: 0 });
    add(box(110.4, 1.2, 70.4), M.dark, world, { x: -280, y: G + 10, z: 0, edges: false });
    for (let a = 0; a < 5; a++) for (let b = 0; b < 2; b++) add(box(16, 6, 22), M.light, world, { x: -440 + a * 20, y: G + 3, z: -20 + b * 30 });
    for (const z of [-40, 25]) add(cyl(18, 14, 20), M.light, world, { x: -175, y: G + 7, z });
    // 製品水の大タンク(屋根は低い円錐)と、内陸へ送る送水管
    for (const x of [130, 240, 540, 650]) {
      add(cyl(45, 16, 28), M.body, world, { x, y: G + 8, z: 150 });
      add(new THREE.ConeGeometry(45, 4, 28), M.light, world, { x, y: G + 18, z: 150 });
      add(cyl(45.3, 1, 28), M.mid, world, { x, y: G + 15.5, z: 150, edges: false });
    }
    tube(world, V(60, G + 3, 95), V(650, G + 3, 95), 1.8, M.mid);
    for (const x of [60, 76]) tube(world, V(x, G + 3, 95), V(x, G + 3, D.z0), 2.0, M.mid);
    // 管理棟(チーム色の帯)
    add(box(60, 12, 28), M.body, world, { x: -600, y: G + 6, z: -60 });
    add(box(60.4, 1.6, 28.4), M.glass, world, { x: -600, y: G + 8, z: -60, edges: false });
    add(box(60.6, 0.8, 28.6), M.accent, world, { x: -600, y: G + 11.4, z: -60, edges: false });

    // ── 近未来化: 防空陣地(土塁、固定式の発射機、箱形の覆いのレーダー、指揮所)。外向きに構える(2 倍) ──
    const s2 = D.ad, launchers = [], beacons = [];
    for (const [px, pz, face] of [[-730, -380, -2.4], [730, -380, 2.4], [-740, 200, -0.9], [740, 200, 0.9]]) {
      const b = new THREE.Group(); b.position.set(px, G, pz); b.rotation.y = face; world.add(b);   // +z が外向き
      add(box(36 * s2 / 2, 0.4, 36 * s2 / 2), M.light, b, { y: 0.2 });
      for (const [x, z, w, d] of [[-17, 0, 3, 30], [17, 0, 3, 30], [0, -16, 37, 3]]) add(extZ([[x - w / 2 - 2, 0], [x + w / 2 + 2, 0], [x + w / 2, 4], [x - w / 2, 4]], z - d / 2, z + d / 2), M.mid, b);
      add(box(5, 3, 5), M.dark, b, { y: 1.5, z: -6 });
      const pivot = new THREE.Group(); pivot.position.set(0, 3, -9); b.add(pivot);
      add(box(7, 6, 20), M.light, pivot, { y: 3, z: 10 });
      add(box(7.2, 0.6, 20.2), M.accent, pivot, { y: 4.6, z: 10, edges: false });
      for (const x of [-1.8, 1.8]) for (const y of [1.6, 4.4]) add(box(2.6, 2.2, 0.3), M.dark, pivot, { x, y, z: 20.1, edges: false });   // 発射筒のふた
      launchers.push(pivot);
      // レーダー(箱形の覆い、外向きの平らな面)と指揮所(回転灯)
      add(box(1.2, 6, 1.2), M.mid, b, { x: -24, y: 3, z: -6 });
      add(box(9, 7, 3), M.body, b, { x: -24, y: 9.5, z: -5 });
      add(box(8, 6, 0.3), M.dark, b, { x: -24, y: 9.5, z: -3.4, edges: false });
      add(box(12, 3.4, 5), M.light, b, { x: 24, y: 1.7, z: -10 });
      beacons.push(add(cyl(0.8, 1.2, 8), M.beaconOff, b, { x: 24, y: 4, z: -10, edges: false }));
    }
    // ── 近未来化: 沖の浮体式の予備淡水化モジュール(台船、RO のモジュール、居住区、係留索と浮標、岸への浮きホース) ──
    for (const bx of [-150, 150]) {
      add(box(110, 7, 32), M.light, world, { x: bx, y: -0.5, z: 440 });
      add(box(110.4, 1.0, 32.4), M.dark, world, { x: bx, y: -3.4, z: 440, edges: false });
      for (let i = 0; i < 3; i++) {
        add(box(20, 8, 22), M.body, world, { x: bx - 38 + i * 26, y: 7, z: 440 });
        add(box(20.2, 0.6, 22.2), M.mid, world, { x: bx - 38 + i * 26, y: 9, z: 440, edges: false });
      }
      add(box(14, 12, 18), M.body, world, { x: bx + 44, y: 9, z: 440 });
      add(box(14.2, 1.6, 18.2), M.glass, world, { x: bx + 44, y: 12, z: 440, edges: false });
      add(box(14.4, 0.6, 18.4), M.accent, world, { x: bx + 44, y: 6.8, z: 440, edges: false });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const a = V(bx + sx * 52, 1.5, 440 + sz * 15), m = V(bx + sx * 90, 0.4, 440 + sz * 55);
        tube(world, a, m, 0.5, M.dark);
        add(cyl(2.2, 2.4, 10), M.mark, world, { x: m.x, y: 0.4, z: m.z });
      }
      tube(world, V(bx - 30, 1, 424), V(bx - 20, 0.6, D.coast + 4), 1.2, M.dark);   // 浮きホース
      tube(world, V(bx - 20, 0.6, D.coast + 4), V(bx - 20, G + 1, D.coast - 2), 1.2, M.dark);
    }

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 状態と更新 ──
    let state = opts.state ?? "normal", t = state === "alert" ? 1 : 0, clock = 0;
    const ease = (x) => x * x * (3 - 2 * x);
    const apply = () => { for (const p of launchers) p.rotation.x = -ELEV * ease(t); };
    apply();
    function update(dt) {
      clock += dt;
      const goal = state === "alert" ? 1 : 0;
      t = goal > t ? Math.min(goal, t + dt / RAISE_SEC) : Math.max(goal, t - dt / RAISE_SEC);
      apply();
      const blink = state === "alert" && Math.floor(clock * 3) % 2 === 0;
      for (const b of beacons) b.material = blink ? M.beacon : M.beaconOff;
      M.sea.map.offset.y -= dt * 0.03; M.outfall.map.offset.y -= dt * 0.5;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function check() {
      // 起立の途中で発射機の箱が台座(高さ 3)・土塁より下へ行かないか: 箱の角の最低の高さ(回転軸から)
      let low = Infinity;
      for (let i = 0; i <= 20; i++) {
        const a = (ELEV * i) / 20;
        for (const [y, z] of [[0, 0], [6, 0], [0, 20], [6, 20]]) low = Math.min(low, y * Math.cos(a) + z * Math.sin(a));
      }
      return { launcherLowestAbovePivot_m: +low.toFixed(2), elevation_deg: 55, intakeHeadTop_m: D.bed + 7.5, seaDepthUnderBarge_m: -4 - D.bed };
    }
    U.bake(THREE, group, { dynamic: launchers, live: [M.accent] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      setTeam: (c) => F.setTeam(M, c), setState(s) { state = s; }, get state() { return state; }, get progress() { return t; },
      shots: {
        power: { label: "発電所と煙突", target: [-180, 40, -200], pos: [-10, 150, 60] },
        msf: { label: "蒸発器(MSF)", target: [330, 10, -150], pos: [560, 110, 60] },
        intake: { label: "取水口と取水管", target: [-470, -4, 300], pos: [-280, 90, 520] },
        barge: { label: "浮体式モジュール", target: [0, 4, 440], pos: [140, 70, 620] },
        battery: { label: "防空陣地", target: [740, 6, 200], pos: [640, 60, 330] },
      },
    };
  }

  DreamAssets.fac.register("desal", {
    section: 5, title: "海水淡水化プラント", kind: "STRATEGIC FACILITY · 5 水・食料",
    desc: "湾岸の発電・淡水化の複合施設(例: ジェベル・アリ)。海岸沿いの処理棟、海へ延びる取水管、隣の発電所の煙突。周囲に防空陣地、沖に浮体式の予備淡水化モジュールを係留した近未来版",
    info: [["ファイル", "mockups/3d/facilities/desal.js"], ["大きさ", "実寸 1600 × 1010 m を 0.11 倍 × 表示 3.0"], ["誇張", "煙突の高さ 1.5 倍(約 90 m)、取水管の太さ 2 倍、防空陣地 2 倍"], ["省略", "車両・人・小さな機器・柵"], ["近未来化", "防空陣地 4 か所、浮体式の予備淡水化モジュール 2 隻"], ["状態", "平常 / 警戒(発射機が起立)"]],
    dist: 1150, target: 30, tokenAt: [420, 0, 330],
    make: (THREE) => desal(THREE, { r: 110 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["平常", () => a.setState("normal"), () => a.state === "normal"], ["警戒", () => a.setState("alert"), () => a.state === "alert"]],
    caption: (a) => (a.state === "alert" ? "警戒 — 防空陣地の発射機が起立" : ""),
  });
})();
