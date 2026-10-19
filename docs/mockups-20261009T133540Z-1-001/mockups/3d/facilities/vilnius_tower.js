// 戦略施設トークン「ヴィリニュス・テレビ塔」(リトアニア、現役の電波塔)の詳細版モデル(試作)。
// 実物の寸法(全高 326.5 m、鉄筋コンクリートの筒 約 190 m、展望階 165 m、鋼の尖塔 約 136 m)をメートルで組み、K 倍して模型にする。
// 象徴(「軸 + 円盤」のシルエット)を誇張: 展望階の円盤の直径 1.5 倍、鋼の尖塔の太さ 2 倍、追悼の石碑 2 倍。高さと敷地の平面は実寸。
// 展望階のカフェ「Paukščių takas」は回転床(実物は 45 分で 1 周)。窓の方立てを回して表す(試作の速さは 90 秒で 1 周)。
// 近未来化(施設リストの案): 次世代通信の扇形パネルアンテナの環、衛星通信のレドーム(回るアンテナは使わない)、足元の小型データセンター。
// 不確か: 足元の塔脚の形と円盤の実寸は資料で確かめきれず、ひだのある裾広がりのコンクリートの台と推定で組んだ。1991 年 1 月事件の追悼は石碑の列と十字架で表した。
//
// 状態: "current"(現在)/ "future"(近未来化の設備を表示)
(function () {
  const K = 0.25;
  const D = {
    base: -4, half: 140, chamfer: 24,
    shaftTop: 190, deck: 165, mastTop: 326.5,
    discR: 24, // 円盤の半径(推定 16 m を 1.5 倍)
  };
  const SPIN_SEC = 90;   // 回転床 1 周(試作の速さ。実物は 45 分)

  function build(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.aviation = M.basic(0xe0403a);   // 航空障害灯(常灯)
    M.snowRoof = M.light;
    const group = new THREE.Group(); group.name = "vilnius_tower";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const { add, box, cyl, V, polar, put, closedLoft, tube, lattice } = F.kit(THREE, M, K);
    const lathe = (pts, n = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);

    // ── 台座: 敷地(角を落とした四角)、広場、園路 ──
    const pad = U.slab(THREE, D.half, D.half, D.chamfer, -D.base); pad.translate(0, D.base, 0);
    add(pad, M.land, world);
    const plinth = U.slab(THREE, D.half + 3, D.half + 3, D.chamfer + 1.2, 1.2); plinth.translate(0, D.base, 0);   // 足元の暗い帯(角を落とした形)
    add(plinth, M.dark, world, { edges: false });
    add(cyl(62, 0.3, 40), M.light, world, { y: 0.15, edges: false });   // 塔のまわりの舗装
    for (const b of [0.4, 2.5, 4.6]) put(box(8, 0.25, 70), M.light, world, polar(97, b, 0.12), { ry: b, edges: false });   // 園路
    add(box(8, 0.25, 80), M.mid, world, { y: 0.13, z: 100, edges: false });   // 入口の道(+z)

    // ── 塔脚: 裾広がりのコンクリートの台と 9 枚のひだ、展示室(1991 年 1 月の博物館) ──
    add(lathe([[0, 0], [27, 0], [25, 5], [17, 20], [11, 42], [8.6, 62], [0, 62]], 36), M.body, world);
    for (let i = 0; i < 9; i++) {
      const b = (i / 9) * Math.PI * 2 + 0.17;
      const ring = (r0, r1, y, w) => { const t = V(Math.cos(b), 0, -Math.sin(b)).multiplyScalar(w / 2); const a = polar(r0, b, y), c = polar(r1, b, y); return [a.clone().sub(t), c.clone().sub(t), c.clone().add(t), a.clone().add(t)]; };
      add(closedLoft([ring(24, 30, 0.01, 1.6), ring(15.5, 20, 22, 1.4), ring(8.6, 10.2, 58, 1.0)]), M.light, world);
    }
    add(box(34, 7, 16), M.body, world, { y: 3.5, z: 33 });   // 入口の展示室
    add(box(34.4, 2.2, 16.4), M.glass, world, { y: 3.6, z: 33, edges: false });
    add(box(36, 0.6, 18), M.light, world, { y: 7.3, z: 33 });

    // ── 筒(コンクリート)と途中の機械室の帯 ──
    add(lathe([[8.6, 62], [7.6, 150], [7.2, D.shaftTop], [0, D.shaftTop]], 24), M.body, world);
    for (const y of [96, 118]) add(lathe([[8.6, y], [8.6, y + 3], [7.0, y + 3], [7.0, y]], 24), M.light, world);
    // ── 展望階の円盤: 下の円錐、窓の帯(回転床)、屋根、チーム色の帯 ──
    const R = D.discR;
    add(lathe([[7.6, D.deck - 12], [R, D.deck - 2], [R, D.deck - 1.4], [7.6, D.deck - 1.4]], 36), M.body, world);
    add(lathe([[R - 0.4, D.deck - 1.4], [R - 0.4, D.deck + 4.6], [7.6, D.deck + 4.6], [7.6, D.deck - 1.4]], 36), M.glass, world, { edges: false });
    add(lathe([[R + 0.6, D.deck - 1.4], [R + 0.6, D.deck - 0.6], [R - 0.2, D.deck - 0.6], [R - 0.2, D.deck - 1.4]], 36), M.accent, world, { edges: false });
    add(lathe([[R + 1.2, D.deck + 4.6], [R + 1.2, D.deck + 5.6], [R - 3, D.deck + 10], [7.4, D.deck + 13], [7.4, D.deck + 4.6]], 36), M.body, world);
    const spin = new THREE.Group(); world.add(spin);   // 回転床の窓の方立て(床ごと回る)
    for (let i = 0; i < 36; i++) { const b = (i / 36) * Math.PI * 2; put(box(0.5, 5.2, 0.5), M.light, spin, polar(R + 0.05, b, D.deck + 2.0), { ry: b }); }   // 帯(deck - 0.6 まで)と屋根(deck + 4.6)の間
    // 筒の上端の台と尖塔の根元
    add(lathe([[10, D.shaftTop - 2], [10, D.shaftTop], [4, D.shaftTop], [4, D.shaftTop - 2]], 24), M.light, world);
    // ── 鋼の尖塔(太さ 2 倍)、アンテナの帯、点検の足場、航空障害灯 ──
    add(lathe([[5.0, D.shaftTop], [3.6, 260], [2.0, 310], [0.6, D.mastTop], [0, D.mastTop], [0, D.shaftTop]], 12), M.steel, world);
    for (const [y, r, h] of [[205, 5.6, 10], [228, 5.0, 8], [252, 4.0, 6], [280, 3.2, 6]]) {
      add(cyl(r, h, 12), M.light, world, { y: y + h / 2 });                                      // アンテナの覆い(円筒のレドーム)
      add(lathe([[r + 1.6, y - 0.6], [r + 1.6, y], [r - 0.6, y], [r - 0.6, y - 0.6]], 12), M.dark, world, { edges: false });   // 足場
    }
    for (const y of [D.shaftTop + 0.6, 252 + 6.4, D.mastTop]) for (let i = 0; i < (y === D.mastTop ? 1 : 4); i++) {
      const p = y === D.mastTop ? V(0, y + 0.6, 0) : polar(y > 240 ? 4.4 : 10.2, (i * Math.PI) / 2, y + 0.6);
      put(box(1.0, 1.0, 1.0), M.aviation, world, p, { edges: false });
    }

    // ── 1991 年 1 月の追悼: 石碑の列(2 倍)と木の十字架 ──
    for (let i = 0; i < 14; i++) add(box(1.6, 2.4, 0.7), M.dark, world, { x: -26 + i * 4, y: 1.2, z: 78 });
    add(box(30, 0.25, 8), M.light, world, { x: 0, y: 0.13, z: 80, edges: false });
    add(box(0.8, 10, 0.8), M.mid, world, { x: 18, y: 5, z: 86 });
    add(box(5, 0.8, 0.8), M.mid, world, { x: 18, y: 7.6, z: 86 });

    // ── 近未来化: 次世代通信のパネルアンテナ、衛星通信のレドーム、足元の小型データセンター ──
    const future = new THREE.Group(); world.add(future);
    for (let i = 0; i < 12; i++) {   // 扇形パネル(固定)。筒の 140 m に腕で留める
      const b = (i / 12) * Math.PI * 2;
      put(box(1.4, 6.5, 0.6), M.body, future, polar(9.6, b, 140), { ry: b });
      put(box(0.4, 0.4, 2.2), M.dark, future, polar(8.5, b, 141.8), { ry: b, edges: false });
      put(box(0.4, 0.4, 2.2), M.dark, future, polar(8.5, b, 138.2), { ry: b, edges: false });
    }
    add(lathe([[11.2, 136.2], [11.2, 136.8], [7.4, 136.8], [7.4, 136.2]], 24), M.accent, future, { edges: false });
    const dcX = -78, dcZ = 18;   // データセンター(冷却機、発電機コンテナ、衛星通信のレドーム、柵)
    add(box(44, 9, 24), M.body, future, { x: dcX, y: 4.5, z: dcZ });
    add(box(44.4, 0.8, 24.4), M.accent, future, { x: dcX, y: 7.2, z: dcZ, edges: false });
    add(box(44.6, 0.5, 24.6), M.light, future, { x: dcX, y: 9.25, z: dcZ });
    for (let i = 0; i < 6; i++) {
      add(box(5, 2.0, 5), M.mid, future, { x: dcX - 15 + i * 6, y: 10.5, z: dcZ - 5 });
      add(cyl(1.7, 0.3, 12), M.dark, future, { x: dcX - 15 + i * 6, y: 11.6, z: dcZ - 5, edges: false });
    }
    for (const [x, z, r] of [[dcX + 8, dcZ + 6, 3.2], [dcX + 16, dcZ + 6, 2.4]]) {
      add(cyl(r * 0.8, 1.2, 12), M.light, future, { x, y: 9.5 + 0.6, z });
      add(new THREE.IcosahedronGeometry(r, 1), M.body, future, { x, y: 10.2 + r * 0.75, z });
    }
    add(box(12.2, 2.6, 2.44), M.light, future, { x: dcX, y: 1.3, z: dcZ + 18 });
    for (const e of [-1, 1]) add(box(0.12, 2.2, 2.1), M.dark, future, { x: dcX + e * 6.16, y: 1.3, z: dcZ + 18, edges: false });
    for (const [x0, z0, x1, z1] of [[-104, -2, -52, -2], [-104, 26 + 18, -52, 26 + 18], [-104, -2, -104, 44], [-52, -2, -52, 44]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), along = x0 === x1;
      add(box(along ? 0.15 : len, 0.15, along ? len : 0.15), M.dark, future, { x: (x0 + x1) / 2, y: 2.0, z: (z0 + z1) / 2, edges: false });
      for (let k = 0; k <= Math.round(len / 6); k++) { const t = k / Math.round(len / 6); add(box(0.3, 2.2, 0.3), M.dark, future, { x: x0 + (x1 - x0) * t, y: 1.1, z: z0 + (z1 - z0) * t, edges: false }); }
    }
    add(box(1.0, 0.12, 50), M.dark, future, { x: -40, y: 0.32, z: 10, edges: false, ry: 1.2 });   // 塔への光ファイバーの樋

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 55, M.ring, M.disc);

    let state = opts.state ?? "future";
    const apply = () => { future.visible = state === "future"; };
    function update(dt) {
      spin.rotation.y += (dt / SPIN_SEC) * Math.PI * 2;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    U.bake(THREE, group, { dynamic: [spin, future], live: [M.accent], also: [M.aviation] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), check: () => ({
        spinMullionToGlass_m: +((R + 0.05 - 0.25) - (R - 0.4)).toFixed(2),     // 回る方立ての内側と固定の窓ガラスの隙間(正 = 当たらない)
        spinMullionToRim_m: +((R + 0.6) - (R + 0.05 + 0.25)).toFixed(2),      // 方立ての外側と下の帯の外縁(帯の上を回る)
        panelToShaft_m: +((9.6 - 0.3) - 7.75).toFixed(2),                     // 140 m のパネルと筒の表面
      }),
      setState(s) { state = s; apply(); }, get state() { return state; },
      stats: () => U.stats(group), parts: { ring, disc }, at,
      shots: {
        disc: { label: "展望階の円盤", target: [0, 168, 0], pos: [70, 190, 85] },
        mast: { label: "尖塔", target: [0, 255, 0], pos: [60, 230, 120] },
        foot: { label: "足元(追悼・データセンター)", target: [-30, 8, 40], pos: [60, 70, 190] },
      },
    };
  }

  DreamAssets.fac.register("vilnius_tower", {
    section: 6, title: "ヴィリニュス・テレビ塔", kind: "STRATEGIC FACILITY · 6 情報・通信・産業",
    desc: "高さ 326.5 m の現役の電波塔。コンクリートの筒の 165 m に回転床の展望カフェの円盤、上に鋼の尖塔。足元に 1991 年 1 月事件の追悼。次世代通信のアンテナと小型データセンターを足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/vilnius_tower.js"], ["大きさ", "敷地 280 × 280 m・全高 326.5 m を 0.25 倍 × 表示 3.0"], ["誇張", "円盤の直径 1.5 倍、尖塔の太さ 2 倍、追悼の石碑 2 倍。高さは実寸"], ["動作", "展望階の回転床(試作は 90 秒で 1 周、実物 45 分)"], ["近未来化", "扇形パネルアンテナの環、衛星通信のレドーム、小型データセンター"]],
    dist: 820, target: 110, tokenAt: [230, 0, 150],
    make: (THREE) => build(THREE, { r: 55 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["現在", () => a.setState("current"), () => a.state === "current"], ["近未来化", () => a.setState("future"), () => a.state === "future"]],
    caption: () => "",
  });
})();
