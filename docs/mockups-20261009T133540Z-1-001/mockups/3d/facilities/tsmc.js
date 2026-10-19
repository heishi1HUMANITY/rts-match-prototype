// 戦略施設トークン「TSMC 南部科学園区」(台湾・台南、最先端半導体の工場群)の詳細版モデル(試作)。
// 工場群の一部(800 × 500 m)を切り出し、メートルで組んで K 倍する。窓の少ない巨大なクリーンルーム棟 2 棟(各 320 × 170 m)、
// 屋上の外調機と排気筒の列、中央の用役棟(屋上に冷却塔)、渡り廊下、事務棟、ガス置き場(空気分離装置の塔・貯槽)、排水処理の沈殿池、変電所。
// 象徴(「窓の少ない大型クリーンルーム棟」)を誇張: 工場棟の高さ 1.3 倍(40 → 52 m)、屋上の排気筒を太く。平面は実寸。
// 省略: 車両・人。
// 近未来化(施設リストの案): 防空設備 2 か所(土塁の円、発射機は 2 倍、箱形のレーダー。回るアンテナは使わない)、
// 重要工程を地下へ移した区画(盛土の下の工場、坑口、換気塔)。
//
// 状態: "current"(現在)/ "future"(防空設備と地下工場を表示)
(function () {
  const K = 0.22;
  const D = { base: -3, x0: -400, x1: 400, z0: -250, z1: 250, fabW: 320, fabD: 170, fabH: 52 };

  function build(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.earth = M.lambert(0xc4cbc0);   // 盛土・土塁(草をかぶった土を灰緑の明るい色で)
    const group = new THREE.Group(); group.name = "tsmc";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const { add, box, cyl, V, tube, beam, closedLoft, waterShape, water, lattice } = F.kit(THREE, M, K);
    const lathe = (pts, n = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
    const band = (x, y, z, w, d, h = 0.8, mat = M.dark) => add(box(w + 0.5, h, d + 0.5), mat, world, { x, y, z, edges: false });

    // ── 台座と道路 ──
    const W = D.x1 - D.x0, Dz = D.z1 - D.z0;
    const pad = U.slab(THREE, W / 2, Dz / 2, 16, -D.base); pad.translate(0, D.base, 0); add(pad, M.land, world);
    const pl = U.slab(THREE, W / 2 + 3, Dz / 2 + 3, 17.2, 1.2); pl.translate(0, D.base, 0); add(pl, M.dark, world, { edges: false });
    const road = (x, z, w, d) => add(box(w, 0.2, d), M.mid, world, { x, y: 0.1, z, edges: false });
    road(0, -25, 790, 10); road(0, 62, 790, 10); road(0, -120, 14, 180); road(-215, 120, 10, 110); road(185, 130, 10, 130);

    // ── クリーンルーム棟 2 棟: 窓のない箱、横の帯、屋上の外調機・排気筒・ダクト、端の階段塔 ──
    const fab = (x, z) => {
      const { fabW: w, fabD: d, fabH: h } = D;
      add(box(w, h, d), M.body, world, { x, y: h / 2, z });
      band(x, 13, z, w, d); band(x, 37, z, w, d);                                     // 階の境の帯(下の階が配管の階、上が外調機の階)
      band(x, h - 3.2, z, w, d, 1.6, M.accent);                                        // チーム色の帯
      for (const sz of [-1, 1]) add(box(w, 1.6, 0.8), M.light, world, { x, y: h + 0.8, z: z + sz * (d / 2 - 0.4) });
      for (const sx of [-1, 1]) add(box(0.8, 1.6, d), M.light, world, { x: x + sx * (w / 2 - 0.4), y: h + 0.8, z });
      for (let i = 0; i < 6; i++) add(box(8, 6, 0.5), M.dark, world, { x: x - 125 + i * 50, y: 3, z: z + d / 2 + 0.25, edges: false });   // 搬入口
      const sx = Math.sign(x); add(box(14, h + 8, 18), M.light, world, { x: x + sx * (w / 2 + 7), y: (h + 8) / 2, z: z - 40 });          // 階段・昇降機の塔(外側の端)
      // 屋上: 外周の外調機(大型の箱)、中央の排気筒(スクラバー)の列、ダクト
      for (const sz of [-1, 1]) for (let i = 0; i < 10; i++) {
        add(box(22, 7, 12), M.mid, world, { x: x - 135 + i * 30, y: h + 3.5, z: z + sz * 64 });
        add(box(18, 0.6, 9), M.dark, world, { x: x - 135 + i * 30, y: h + 7.3, z: z + sz * 64, edges: false });
      }
      for (const rz of [-26, 0, 26]) for (let i = 0; i < 12; i++) {
        const sx = x - 132 + i * 24;
        add(lathe([[1.8, 0], [1.8, 15], [2.2, 15], [2.2, 16], [0, 16]], 10), M.light, world, { x: sx, y: h, z: z + rz });
      }
      for (const rz of [-38, 38]) add(box(w - 40, 3, 4), M.light, world, { x, y: h + 1.5, z: z + rz });   // 屋上のダクト
    };
    fab(-170, -125); fab(170, -125);

    // ── 中央の用役棟(冷水・純水・電力)。屋上に冷却塔のセルの列。工場棟への渡り廊下 ──
    add(box(360, 26, 56), M.body, world, { x: -120, y: 13, z: 20 });
    band(-120, 9, 20, 360, 56);
    for (const rz of [-13, 13]) for (let i = 0; i < 16; i++) {
      const cx = -290 + i * 22.6;
      add(box(21, 9, 22), M.mid, world, { x: cx, y: 30.5, z: 20 + rz });
      add(lathe([[7, 0], [7.6, 4], [8.1, 4], [7.5, 0]], 14), M.light, world, { x: cx, y: 35, z: 20 + rz });
      add(cyl(7, 0.3, 14), M.dark, world, { x: cx, y: 36.2, z: 20 + rz, edges: false });
    }
    for (const x of [-250, -90, 30, 130]) add(box(10, 7, 36), M.light, world, { x, y: 30, z: -22 });   // 渡り廊下(用役棟・事務棟 → 工場棟)
    for (const x of [-250, -90, 30]) for (const y of [24.5, 26]) add(box(3, 0.8, 36), M.dark, world, { x: x + 4, y, z: -22, edges: false });   // 配管
    add(box(60, 48, 40), M.light, world, { x: 130, y: 24, z: 15 });   // 事務棟
    for (let i = 0; i < 8; i++) band(130, 4 + i * 5.6, 15, 60, 40, 2.2, M.glass);

    // ── ガス置き場: 空気分離装置の塔、縦置き貯槽、横置き貯槽 ──
    for (const x of [230, 252]) { add(box(9, 56, 9), M.body, world, { x, y: 28, z: 20 }); add(box(9.4, 1, 9.4), M.dark, world, { x, y: 50, z: 20, edges: false }); }
    for (let i = 0; i < 8; i++) {
      const x = 285 + (i % 4) * 22, z = 0 + Math.floor(i / 4) * 30;
      add(lathe([[4.2, 0], [4.2, 22], [3, 24.5], [0, 25]], 14), M.body, world, { x, y: 0, z });
      add(cyl(4.6, 1.2, 14), M.mid, world, { x, y: 0.6, z });
    }
    for (let i = 0; i < 4; i++) { const tg = cyl(2.6, 22, 12); tg.rotateZ(Math.PI / 2); add(tg, M.light, world, { x: 320, y: 4.5, z: 82 + i * 8 }); for (const e of [-8, 8]) add(box(1, 2, 4), M.dark, world, { x: 320 + e, y: 1, z: 82 + i * 8 }); }
    for (let i = 0; i < 3; i++) tube(world, V(268 + i * 1.6, 8, 45), V(268 + i * 1.6, 8, -15), 0.6, M.mid);   // 配管橋
    for (const z of [-12, 15, 42]) { beam(world, V(266, 0, z), V(266, 7.4, z), 1.0, M.mid); beam(world, V(273, 0, z), V(273, 7.4, z), 1.0, M.mid); beam(world, V(265.5, 7.4, z), V(273.5, 7.4, z), 1.0, M.mid); }

    // ── 排水処理(円形の沈殿池)と変電所 ──
    const circle = (r, n = 32) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r]);
    const wm = water({ opacity: 0.5 });
    for (const [x, z] of [[-350, 110], [-300, 150]]) {
      add(lathe([[22, 0], [22, 3.5], [21, 3.5], [21, 0.6], [0, 0.6]], 32), M.light, world, { x, y: 0, z });
      add(box(42, 0.8, 1.6), M.dark, world, { x, y: 4.0, z, edges: false });   // かき寄せ機の橋(止めたまま)
      const w = waterShape(circle(21), wm); w.position.set(x, 3.0, z); world.add(w);
    }
    add(box(36, 10, 22), M.body, world, { x: -270, y: 5, z: 205 });
    add(box(110, 0.25, 70), M.light, world, { x: 300, y: 0.12, z: 180, edges: false });
    for (let i = 0; i < 4; i++) { const tx = 260 + i * 26; add(box(10, 7, 6), M.mid, world, { x: tx, y: 3.5, z: 165 }); for (const e of [-1, 1]) add(box(10, 5, 0.4), M.dark, world, { x: tx, y: 3, z: 165 + e * 3.4, edges: false }); for (const e of [-3, 0, 3]) add(cyl(0.3, 3, 6), M.light, world, { x: tx + e, y: 8.5, z: 165 }); }
    for (let i = 0; i < 4; i++) { const gx = 260 + i * 26; for (const e of [-1, 1]) beam(world, V(gx + e * 7, 0, 195), V(gx + e * 7, 16, 195), 0.9, M.mid); beam(world, V(gx - 7.5, 16, 195), V(gx + 7.5, 16, 195), 0.9, M.mid); }

    // ── 近未来化: 地下工場(盛土・坑口・換気塔)と防空設備 2 か所 ──
    const future = new THREE.Group(); world.add(future);
    const rect = (cx, cz, hw, hd, y) => [V(cx - hw, y, cz - hd), V(cx + hw, y, cz - hd), V(cx + hw, y, cz + hd), V(cx - hw, y, cz + hd)];
    add(closedLoft([rect(-60, 165, 120, 72, 0.02), rect(-60, 165, 104, 58, 14), rect(-60, 165, 96, 50, 16)]), M.earth, future);
    for (const x of [-110, -10]) {   // 坑口(搬入の斜路の門)
      add(box(26, 14, 10), M.light, future, { x, y: 7, z: 90 });
      add(box(18, 10, 10.4), M.dark, future, { x, y: 5, z: 90, edges: false });
      add(box(18, 0.25, 26), M.mid, future, { x, y: 0.14, z: 72, edges: false });
    }
    for (let i = 0; i < 8; i++) {   // 換気塔
      const x = -140 + (i % 4) * 54, z = 140 + Math.floor(i / 4) * 44;
      add(lathe([[3.4, 0], [3.4, 9], [4.2, 9], [4.2, 10.5], [0, 10.5]], 12), M.light, future, { x, y: 16, z });
    }
    add(box(206, 0.6, 1.2), M.accent, future, { x: -60, y: 16.3, z: 165 - 49, edges: false });
    const ad = (cx, cz, face) => {   // 防空陣地: 土塁の円、発射機 2 両(2 倍)、箱形のレーダー、指揮所
      add(lathe([[34, 0], [30, 5], [26, 5], [24, 0]], 32), M.earth, future, { x: cx, y: 0, z: cz });
      add(box(14, 0.25, 12), M.mid, future, { x: cx + 30, y: 0.14, z: cz, edges: false, ry: 0 });   // 土塁の切れ目の進入路
      for (const e of [-1, 1]) {
        const g = new THREE.Group(); g.position.set(cx + e * 9, 0, cz + 6); g.rotation.y = face; future.add(g);
        add(box(7, 3, 22), M.mid, g, { y: 1.5 });                                   // 車台
        add(box(7.4, 0.6, 22.4), M.accent, g, { y: 3.1, edges: false });
        add(box(6, 6, 18), M.light, g, { y: 6.2, z: -1, rx: -0.6 });                // 発射筒(上へ向ける)
        add(box(5.2, 5.2, 0.4), M.dark, g, { y: 6.2 + Math.sin(0.6) * 9.1, z: -1 - Math.cos(0.6) * 9.1 - 0.1, rx: -0.6, edges: false });
        for (const z of [-8, 0, 8]) for (const sx of [-1, 1]) add(cyl(1.4, 1.2, 10).rotateZ(Math.PI / 2), M.dark, g, { x: sx * 3.6, y: 1.4, z, edges: false });
      }
      add(box(12, 2.4, 6), M.mid, future, { x: cx, y: 1.2, z: cz - 12 });             // レーダーの台車
      add(box(10, 9, 1.8), M.body, future, { x: cx, y: 7.0, z: cz - 12.5, rx: 0.35 }); // 箱形のレーダー(固定の平面)
      add(box(8.4, 7.4, 0.3), M.dark, future, { x: cx, y: 7.0 - 0.3 * Math.sin(0.35) * 0, z: cz - 12.5 - 0.95, rx: 0.35, edges: false });
      add(box(10, 4, 6), M.light, future, { x: cx - 14, y: 2, z: cz - 6 });          // 指揮所
    };
    ad(115, 190, 0.4); ad(-330, 215, -0.4);

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 110, M.ring, M.disc);
    let state = opts.state ?? "future";
    const apply = () => { future.visible = state === "future"; };
    U.bake(THREE, group, { dynamic: [future], live: [M.accent] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc }, at,
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      setState(s) { state = s; apply(); }, get state() { return state; },
      check: () => ({
        roofUnitToParapet_m: +(D.fabD / 2 - 0.8 - (64 + 6)).toFixed(2),   // 屋上の外調機と縁の隙間
        fabToUtility_m: +((20 - 28) - (-125 + D.fabD / 2)).toFixed(2),    // 工場棟と用役棟の隙間(渡り廊下でつなぐ)
        moundToFab_m: +((165 - 72) - (20 + 28)).toFixed(2),                // 盛土の裾と用役棟
      }),
      shots: {
        roof: { label: "工場棟の屋上", target: [-170, 52, -125], pos: [-40, 150, 20] },
        util: { label: "用役棟・ガス置き場", target: [150, 25, 20], pos: [330, 120, -120] },
        future: { label: "地下工場・防空(近未来化)", target: [120, 8, 180], pos: [330, 120, 380] },
      },
    };
  }

  DreamAssets.fac.register("tsmc", {
    section: 6, title: "TSMC南部科学園区", kind: "STRATEGIC FACILITY · 6 情報・通信・産業",
    desc: "最先端半導体の主力工場群。窓の少ない巨大なクリーンルーム棟が並び、屋上に外調機と排気筒、用役棟に冷却塔、ガス置き場と排水処理。防空設備と地下化した重要工程を持つ近未来版",
    info: [["ファイル", "mockups/3d/facilities/tsmc.js"], ["大きさ", "工場群の一部 800 × 500 m を 0.22 倍 × 表示 3.0"], ["誇張", "工場棟の高さ 1.3 倍(52 m)、防空の発射機 2 倍。平面は実寸"], ["省略", "車両・人"], ["近未来化", "防空陣地 2 か所(土塁・発射機・箱形レーダー)、地下工場(盛土・坑口・換気塔)"]],
    dist: 1150, target: 25, tokenAt: [420, 0, 330],
    make: (THREE) => build(THREE, { r: 110 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["現在", () => a.setState("current"), () => a.state === "current"], ["近未来化", () => a.setState("future"), () => a.state === "future"]],
    caption: () => "",
  });
})();
