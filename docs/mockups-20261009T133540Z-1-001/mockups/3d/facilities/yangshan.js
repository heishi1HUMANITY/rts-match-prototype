// 戦略施設トークン「洋山深水港」(中国・上海、世界最大のコンテナ港の自動化ターミナル)の詳細版モデル(試作)。
// 第 4 期の自動化ターミナルの岸壁 約 1.4 km を中心に 1600 × 1020 m を切り取る。平面の配置は実寸の比率(K = 0.11)。
// 決め手は岸壁に並ぶ巨大な岸壁クレーン(STS)の列: 門型の脚、A 形の頂部、海へ張り出すブーム。荷役中はブームを船の上へ倒し、空いているときは跳ね上げる。
// 誇張: 岸壁クレーンの高さ 1.3 倍(ブームの高さ 62 m、頂部 97 m)、部材の太さ 1.5 倍、自動の門型クレーン(ARMG)の高さ 1.2 倍、無人の係船装置と陸上電力の設備 2 倍。
// 省略: 無人搬送車(AGV)・トラック・人・タグボート、照明柱。東海大橋は島へ渡る端の取付け高架だけ(全長 32.5 km のうち手前 約 250 m)。
// 近未来化: 自律運航船を迎える岸壁の無人係船装置(吸着式)と陸上電力の接続設備、遠隔操作センター(チーム色の帯)。
// 動き: 荷役中(船が着岸、ブームが下り、ヤードの ARMG が行き来する)⇄ 空き(ブームを跳ね上げ、船が離れる)。ブームの起伏 8 秒。
//
//   const a = DreamAssets.fac.defs.yangshan.make(THREE)(制圧圏 r = 108)
// 岸壁は x 方向、海は +z。陸(ターミナル)は -z。西(-x)の端に島へ渡る東海大橋。
(function () {
  const K = 0.11;
  const D = {
    x0: -800, x1: 800, z0: -500, z1: 520, quay: 200, land: 5, bed: -20, base: -22, west: -560,
    railW: 197, railL: 162, girder: 62, apex: 97, back: 137, boomL: 70,
    cranes: 12, blocks: 19, yard: [-360, 100],
  };
  const SEC = 8;

  function yangshan(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE);
    M.asphalt = M.lambert(0x9aa3ab);
    M.hill = M.lambert(0xa9b39c);
    const BOX = [0xc9d0d7, 0xaeb7c0, 0xe9edf1, 0x8f98a3, 0xa9826b, 0x5d6b78, 0x7f9488].map((c) => M.lambert(c));   // コンテナ(チーム色と紛れない落ち着いた色)
    const group = new THREE.Group(); group.name = "yangshan";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -((D.z0 + D.z1) / 2) * K); group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, beam, prism, lattice } = k;
    const rng = U.rng(11);
    const ZC = (D.z0 + D.z1) / 2, W = D.x1 - D.x0, Dz = D.z1 - D.z0;

    // ── 台座: 埋立地のターミナル、岸壁、海、島の丘 ──
    F.plinth(k, M, world, W, Dz, D.base, { z: ZC });
    add(box(W, D.bed - D.base, Dz), M.light, world, { y: (D.bed + D.base) / 2, z: ZC, edges: false });
    add(prism([[D.west, D.z0], [D.x1, D.z0], [D.x1, D.quay], [D.west, D.quay]], D.base, D.land), M.land, world);
    add(box(D.x1 - D.west, D.land - D.bed + 1, 6), M.mid, world, { x: (D.west + D.x1) / 2, y: (D.land + D.bed) / 2, z: D.quay - 3 });   // 岸壁の前面
    for (let x = D.west + 20; x < D.x1; x += 30) add(box(3, 5, 2), M.dark, world, { x, y: D.land - 3, z: D.quay + 1, edges: false });   // 防舷材
    const sea = k.waterShape([[D.x0, D.quay], [D.x1, D.quay], [D.x1, D.z1], [D.x0, D.z1], [D.x0, D.z0], [D.west, D.z0], [D.west, D.quay]], M.sea); world.add(sea);
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(W, -D.bed), { y: D.bed / 2, z: D.z1 }],
      [new THREE.PlaneGeometry(D.west - D.x0, -D.bed), { x: (D.x0 + D.west) / 2, y: D.bed / 2, z: D.z0 }],
      [new THREE.PlaneGeometry(D.z1 - D.quay, -D.bed), { x: D.x1, y: D.bed / 2, z: (D.quay + D.z1) / 2, ry: Math.PI / 2 }],
      [new THREE.PlaneGeometry(Dz, -D.bed), { x: D.x0, y: D.bed / 2, z: ZC, ry: Math.PI / 2 }],
    ]), M.waterCut));
    // 島の丘(小洋山の残り)。等高線の段 4 つ
    for (let q = 0; q < 4; q++) {
      const rx = 280 - q * 55, rz = 130 - q * 26, cx = -320, cz = -500, pts = [];
      for (let i = 0; i <= 24; i++) { const a = Math.PI * (i / 24); pts.push([cx + Math.cos(a) * rx, Math.max(D.z0, cz + Math.sin(a) * rz)]); }
      add(prism(pts, D.land, D.land + 16 * (q + 1)), M.hill, world);
    }
    lattice(world, V(-320, D.land + 64, -470), 30, 2.2, 0.9, 3, 0.35, M.mid);   // 丘の上の通信塔

    // ── 岸壁のエプロンとクレーンのレール、ヤードとの境の道 ──
    add(box(D.x1 - D.west, 0.3, D.quay - 120), M.asphalt, world, { x: (D.west + D.x1) / 2, y: D.land + 0.15, z: (D.quay + 120) / 2, edges: false });
    for (const z of [D.railW, D.railL]) add(box(D.x1 - D.west, 0.4, 1.2), M.dark, world, { x: (D.west + D.x1) / 2, y: D.land + 0.4, z, edges: false });

    // ── 岸壁クレーン(STS)の列: 本体は焼き込み、ブームは同じ形の列を InstancedMesh 1 つに ──
    const booms = [], stays = [];
    const cx0 = D.west + 90, cdx = (D.x1 - 60 - cx0) / (D.cranes - 1);
    for (let c = 0; c < D.cranes; c++) {
      const x = cx0 + c * cdx, y0 = D.land;
      for (const sx of [-1, 1]) for (const z of [D.railW, D.railL]) {   // 脚(下が太い)と走行の台車
        beam(world, V(x + sx * 9, y0 + 3, z), V(x + sx * 9, y0 + D.girder - 3, z), 2.6, M.body);
        add(box(6, 3, 3.6), M.dark, world, { x: x + sx * 9, y: y0 + 1.5, z, edges: false });
      }
      for (const z of [D.railW, D.railL]) beam(world, V(x - 10, y0 + D.girder - 4, z), V(x + 10, y0 + D.girder - 4, z), 3.0, M.body);   // 門の梁
      for (const sx of [-1, 1]) {
        beam(world, V(x + sx * 9, y0 + 14, D.railL), V(x + sx * 9, y0 + 14, D.railW), 1.8, M.body);                    // 脚のつなぎ
        beam(world, V(x + sx * 9, y0 + D.girder - 4, D.railL), V(x + sx * 9, y0 + 30, D.railW), 1.2, M.light);          // 斜材
        beam(world, V(x + sx * 7, y0 + D.girder, D.back), V(x + sx * 7, y0 + D.girder, D.railW), 2.6, M.steel);        // 後ろの桁(背 = 後方の張り出し)
        beam(world, V(x + sx * 7, y0 + D.girder, D.railL + 3), V(x + sx * 7, y0 + D.apex, D.railW - 10), 2.2, M.body);  // A 形の頂部
        beam(world, V(x + sx * 7, y0 + D.girder, D.railW), V(x + sx * 7, y0 + D.apex, D.railW - 10), 2.2, M.body);
        beam(world, V(x + sx * 7, y0 + D.apex, D.railW - 10), V(x + sx * 7, y0 + D.girder + 2, D.back), 1.0, M.light);  // 後ろの控え
      }
      beam(world, V(x - 8, y0 + D.apex, D.railW - 10), V(x + 8, y0 + D.apex, D.railW - 10), 1.8, M.body);
      add(box(18, 9, 18), M.body, world, { x, y: y0 + D.girder + 5, z: D.back + 10 });                   // 機械室
      add(box(18.4, 1.2, 18.4), M.accent, world, { x, y: y0 + D.girder + 1.4, z: D.back + 10, edges: false });
      add(box(6, 3.5, 7), M.light, world, { x, y: y0 + D.girder - 3.5, z: D.railW - 6 });               // 横行の台車と運転室
      add(box(6.2, 1.2, 7.2), M.glass, world, { x, y: y0 + D.girder - 4.2, z: D.railW - 6, edges: false });
      // ブーム(海側の脚の上の蝶番から +z へ 70 m。起こすと頂部の前へ立つ)
      const b = new THREE.Group(); b.position.set(x, y0 + D.girder, D.railW); world.add(b);
      for (const sx of [-1, 1]) add(box(2.4, 4.2, D.boomL), M.steel, b, { x: sx * 7, z: D.boomL / 2 });
      for (let q = 1; q <= 6; q++) add(box(14, 1.2, 1.2), M.steel, b, { y: -1.2, z: (q * D.boomL) / 7 });
      add(box(16, 4, 4), M.dark, b, { z: D.boomL - 2 });
      booms.push(b);
      for (const sx of [-1, 1]) stays.push({ apex: V(x + sx * 7, y0 + D.apex, D.railW - 10), b, local: V(sx * 7, 2, 46) });
    }
    const stayPos = new Float32Array(stays.length * 6);
    const stayG = new THREE.BufferGeometry(); stayG.setAttribute("position", new THREE.BufferAttribute(stayPos, 3));
    world.add(new THREE.LineSegments(stayG, new THREE.LineBasicMaterial({ color: 0x3b4752 })));

    // ── コンテナヤード: 岸壁と直角のブロック 20、段積み、ブロックごとの自動門型クレーン(ARMG) ──
    const Y0 = -380, pitch = (D.x1 - 40 - Y0) / D.blocks, gantries = [];   // 西の端は橋の取付け道路のため空ける
    for (let i = 0; i < D.blocks; i++) {
      const x = Y0 + pitch * (i + 0.5);
      for (const sx of [-1, 1]) add(box(0.8, 0.3, D.yard[1] - D.yard[0] + 30), M.dark, world, { x: x + sx * 20, y: D.land + 0.3, z: (D.yard[0] + D.yard[1]) / 2, edges: false });   // ARMG のレール
      for (let z = D.yard[0] + 8; z < D.yard[1] - 6; z += 13.2) {
        const tiers = 1 + Math.floor(rng() * 5);
        if (rng() < 0.08) continue;
        add(box(24, tiers * 2.6, 12.2), BOX[Math.floor(rng() * BOX.length)], world, { x, y: D.land + (tiers * 2.6) / 2, z });
      }
      const g = new THREE.Group(); g.position.set(x, D.land, (D.yard[0] + D.yard[1]) / 2); world.add(g);
      const GH = 28 * 1.2;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(g, V(sx * 20, 0, sz * 8), V(sx * 20, GH, sz * 8), 1.4, M.light);
      for (const sz of [-1, 1]) beam(g, V(-22, GH, sz * 8), V(22, GH, sz * 8), 2.0, M.body);
      for (const sx of [-1, 1]) beam(g, V(sx * 20, GH - 1, -8), V(sx * 20, GH - 1, 8), 1.2, M.light);
      add(box(7, 3, 10), M.mid, g, { y: GH - 2.5 });
      gantries.push({ g, home: g.position.z, phase: rng() * Math.PI * 2, speed: 0.15 + rng() * 0.1 });
    }

    // ── 東海大橋の取付け高架(西の端。2 本の箱桁が島の盛土へ下りる) ──
    const deckY = (x) => (x < D.west ? 30 - (x - D.x0) * 0.04 : 30 - (D.west - D.x0) * 0.04 - (x - D.west) * 0.2);
    for (const dz of [-9, 9]) {
      const a = D.x0, b = D.west + 90, ya = deckY(a), yb = Math.max(D.land, deckY(b)), yAt = (x) => ya + ((yb - ya) * (x - a)) / (b - a);
      for (let x = D.x0 + 10; x < D.west - 10; x += 60) add(box(5, yAt(x) - 2.6 - D.bed, 6), M.light, world, { x, y: (yAt(x) - 2.6 + D.bed) / 2, z: -250 + dz });
      add(box(Math.hypot(b - a, yb - ya), 2.6, 15), M.body, world, { x: (a + b) / 2, y: (ya + yb) / 2 - 1.3, z: -250 + dz, rz: Math.atan2(yb - ya, b - a) });
      add(box(Math.hypot(b - a, yb - ya), 1.2, 0.6), M.mid, world, { x: (a + b) / 2, y: (ya + yb) / 2 + 0.6, z: -250 + dz + 7.2, rz: Math.atan2(yb - ya, b - a), edges: false });   // 高欄
    }
    add(box(80, 0.3, 30), M.asphalt, world, { x: D.west + 130, y: D.land + 0.15, z: -250, edges: false });
    add(box(30, 0.3, 165), M.asphalt, world, { x: -405, y: D.land + 0.15, z: -322, edges: false });
    add(box(D.x1 - D.west - 200, 0.3, 26), M.asphalt, world, { x: (D.west + 200 + D.x1) / 2, y: D.land + 0.15, z: -400, edges: false });   // ヤードの後ろの道路

    // ── ゲートと管理棟、近未来化の遠隔操作センター ──
    for (let q = 0; q < 8; q++) add(box(3, 7, 3), M.mid, world, { x: 560 + q * 12, y: D.land + 3.5, z: -440 });
    add(box(100, 2, 22), M.light, world, { x: 602, y: D.land + 8, z: -440 });
    add(box(70, 24, 34), M.body, world, { x: 380, y: D.land + 12, z: -455 });
    for (const y of [6, 12, 18]) add(box(70.2, 2, 34.2), M.glass, world, { x: 380, y: D.land + y, z: -455, edges: false });
    add(box(70.6, 1.4, 34.6), M.accent, world, { x: 380, y: D.land + 23, z: -455, edges: false });
    add(box(22, 10, 22), M.light, world, { x: 380, y: D.land + 29, z: -455 });
    add(box(8, 4, 3), M.body, world, { x: 380, y: D.land + 36, z: -455 });

    // ── 近未来化: 岸壁の無人係船装置(吸着式、2 倍)と陸上電力の接続設備 ──
    const moor = [];
    for (const x of [-250, -120, 0, 90]) {
      add(box(10, 6, 4), M.light, world, { x, y: D.land - 3, z: D.quay - 2 });            // 岸壁の前面に埋めた本体(上面は岸壁と面一)
      add(box(10.4, 1, 0.4), M.accent, world, { x, y: D.land - 1, z: D.quay + 0.2, edges: false });
      const arm = new THREE.Group(); arm.position.set(x, D.land - 2, D.quay); world.add(arm);
      add(box(4, 3, 2), M.mid, arm, { z: 1 });
      add(box(8, 6, 1), M.dark, arm, { z: 2.5 });     // 吸着パッド(伸ばすと船体の側面に当たる)
      moor.push(arm);
    }
    for (const x of [-180, 40]) { add(box(12, 10, 10), M.body, world, { x, y: D.land + 5, z: D.railL - 16 }); add(cyl(4, 6, 12), M.dark, world, { x: x + 10, y: D.land + 4.5, z: D.railL - 16, rz: Math.PI / 2 }); }   // 陸上電力の変換盤とケーブルの巻取り(陸側のレールの後ろ)

    // ── コンテナ船(超大型 400 × 61 m)。岸壁に横付けし、甲板にコンテナを積む ──
    const ship = new THREE.Group(); ship.position.set(-100, 0, D.quay + 3 + 30.5); world.add(ship);
    const sec = (x, w, d) => ({ z: x, pts: [[-w * 0.6, -d], [w * 0.6, -d], [w, -2], [w, 16], [-w, 16], [-w, -2]] });
    const hullG = U.loft(THREE, [sec(-200, 22, 10), sec(-185, 30.5, 15), sec(160, 30.5, 15), sec(188, 18, 12), sec(200, 3, 8)]);
    add(hullG, M.mid, ship, { ry: Math.PI / 2 });
    add(box(380, 0.6, 58), M.light, ship, { x: -5, y: 16.3 });
    for (let x = -175; x < 170; x += 14) {
      if (x > 60 && x < 85) continue;   // 船橋
      const tiers = 5 + Math.floor(rng() * 4);
      add(box(12.2, tiers * 2.6, 56), BOX[Math.floor(rng() * BOX.length)], ship, { x, y: 16.6 + (tiers * 2.6) / 2 });
    }
    add(box(16, 42, 50), M.body, ship, { x: 72, y: 16 + 21 });                 // 船橋(前寄り)
    add(box(16.4, 3, 60), M.glass, ship, { x: 72, y: 16 + 39 });
    add(box(14, 24, 18), M.light, ship, { x: -168, y: 16 + 12 });              // 機関室の煙突
    let tb = 1;   // ブーム: 1 = 下(荷役)、0 = 上

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 108, M.ring, M.disc);

    // ── 状態 ──
    let state = opts.state ?? "work", clock = 0;
    const RAISE = -1.4;   // 跳ね上げたブームの角度(約 80°)
    const v = V(0, 0, 0);
    function apply() {
      for (const b of booms) b.rotation.x = RAISE * (1 - tb);
      ship.visible = state === "work" || tb > 0.02;
      for (const m of moor) m.position.z = D.quay + (ship.visible && tb > 0.98 ? 0 : -3);
      stays.forEach((s, i) => { v.copy(s.local).applyEuler(s.b.rotation).add(s.b.position); stayPos.set([s.apex.x, s.apex.y, s.apex.z, v.x, v.y, v.z], i * 6); });
      stayG.attributes.position.needsUpdate = true;
    }
    let baked;
    function update(dt) {
      clock += dt;
      const target = state === "work" ? 1 : 0;
      tb += Math.sign(target - tb) * Math.min(Math.abs(target - tb), dt / SEC);
      if (state === "work") for (const gt of gantries) gt.g.position.z = gt.home + Math.sin(clock * gt.speed + gt.phase) * 200;
      apply();
      baked?.sync();
      M.sea.map.offset.y -= dt * 0.03;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function check() {
      const r1 = (v) => +v.toFixed(2);
      const stackTop = 16.6 + 8 * 2.6, shipFar = D.quay + 3 + 61;
      return {
        boomUnderOverStacks_m: r1(D.land + D.girder - 3.3 - stackTop),         // 下りたブームの下面と船のコンテナの最上段
        boomTipBeyondShip_m: r1(D.railW + D.boomL - shipFar),                   // ブームの先と船の沖側の舷
        raisedBoomTip_m: r1(D.land + D.girder + D.boomL * Math.sin(-RAISE)),    // 跳ね上げたブームの先の高さ
        raisedBoomToApex_m: r1(D.boomL * Math.cos(-RAISE) - 0),                 // 跳ね上げたブームの先の水平の張り出し(頂部は蝶番の 10 m 陸側)
        shipToQuay_m: 3, mooringPadToHull_m: 0,                                  // 伸ばした吸着パッドの面と船体(接触)
        craneGap_m: r1(cdx - 2 * (9 + 1.3)),                                    // 隣り合うクレーンの脚どうし
        armgLegToStack_m: r1(20 - 0.7 - 12),                                    // ARMG の脚とコンテナの段
        armgTravelEnd_m: r1((D.yard[1] - D.yard[0]) / 2 + 15 - 200 - 8),       // 行き来の端とレールの端
        stackTopVsArmg_m: r1(28 * 1.2 - 2 - 5 * 2.6 - 3),                       // ARMG の桁の下(つり具を除く)と 5 段積み
      };
    }
    baked = U.bake(THREE, group, { dynamic: [ship, ...moor], live: [M.accent], instanced: [{ groups: booms }, { groups: gantries.map((g) => g.g) }] });
    apply(); baked.sync();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, check, at, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; }, get state() { return state; },
      shots: {
        cranes: { label: "岸壁クレーンの列", target: [0, 50, 200], pos: [260, 140, 520] },
        boom: { label: "ブームと船", target: [-150, 50, 220], pos: [-40, 110, 420] },
        yard: { label: "ヤードと ARMG", target: [200, 10, -150], pos: [380, 120, 60] },
        bridge: { label: "東海大橋と丘", target: [-560, 20, -300], pos: [-380, 110, -80] },
      },
    };
  }

  DreamAssets.fac.register("yangshan", {
    section: 9, title: "洋山深水港", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "世界最大のコンテナ港。沖の島を埋め立てた自動化ターミナルに巨大な岸壁クレーンが並び、32.5 km の東海大橋で本土とつながる。物流の要",
    info: [["ファイル", "mockups/3d/facilities/yangshan.js"], ["大きさ", "1600 × 1020 m を 0.11 倍 × 表示 3.0"], ["誇張", "岸壁クレーンの高さ 1.3 倍・部材 1.5 倍、ARMG の高さ 1.2 倍、係船装置・陸上電力 2 倍"], ["省略", "無人搬送車・トラック・人・タグボート、橋の大半"], ["状態", "荷役中(ブームが下り、ARMG が動く)/ 空き(ブームを跳ね上げ、船が離れる)"], ["近未来化", "無人係船装置(吸着式)、陸上電力、遠隔操作センター"]],
    dist: 1050, target: 40, tokenAt: [380, 0, 280],
    make: (THREE) => yangshan(THREE, { r: 108 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["荷役中", () => a.setState("work"), () => a.state === "work"], ["空き", () => a.setState("idle"), () => a.state === "idle"]],
    caption: (a) => (a.state === "idle" ? "空き — ブームを跳ね上げて船を待つ" : ""),
  });
})();
