// 戦略施設トークン「大規模 AI データセンター」(例: 米テキサス州アビリーン)の詳細版モデル(試作)。
// 敷地の一部(800 × 520 m)を切り出し、メートルで組んで K 倍する。平たい巨大な建屋 4 棟(各 280 × 95 × 18 m)、屋上の冷却機の列、
// 建屋の脇の非常用発電機の列、専用の変電所と送電鉄塔、ガスタービン発電所、水槽、管理棟。
// 象徴(「平たい巨大建屋と冷却設備」)を誇張: 屋上の冷却機を 1.5 倍の大きさにして列を太くした。建屋の高さ(平たさ)と平面は実寸。
// 省略: 車両・人。冷却機のファンは小さすぎて回しても読めないので止めたまま。
// 近未来化(施設リストの案): 小型モジュール炉(SMR)2 基を併設した電力自給型。格納容器・原子炉補助建屋・タービン建屋・機械通風の冷却塔・二重の柵。
//
// 状態: "current"(現在: ガスタービンと送電線)/ "future"(SMR を併設)
(function () {
  const K = 0.22;
  const D = { base: -3, x0: -400, x1: 400, z0: -260, z1: 260, hallW: 280, hallD: 95, hallH: 18, cool: 1.5 };

  function build(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const group = new THREE.Group(); group.name = "ai_dc";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const { add, box, cyl, V, tube, beam, lattice, prism } = F.kit(THREE, M, K);
    const lathe = (pts, n = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
    const fanG = cyl(1.6 * D.cool, 0.3, 8);

    // ── 台座: 平らな敷地、道路 ──
    const W = D.x1 - D.x0, Dz = D.z1 - D.z0;
    const pad = U.slab(THREE, W / 2, Dz / 2, 16, -D.base); pad.translate(0, D.base, 0); add(pad, M.land, world);
    const pl = U.slab(THREE, W / 2 + 3, Dz / 2 + 3, 17.2, 1.2); pl.translate(0, D.base, 0); add(pl, M.dark, world, { edges: false });
    const road = (x, z, w, d) => add(box(w, 0.2, d), M.mid, world, { x, y: 0.1, z, edges: false });
    road(0, 62, 790, 10); road(240, 0, 10, 500); road(-80, -78, 560, 8); road(-385, -20, 8, 300);

    // ── データホール(平たい建屋)。屋上に冷却機の列、片側に搬入口、反対側に非常用発電機の列 ──
    const hall = (x, z, gensSide) => {
      const { hallW: w, hallD: d, hallH: h } = D;
      add(box(w, h, d), M.body, world, { x, y: h / 2, z });
      add(box(w + 0.6, 1.2, d + 0.6), M.accent, world, { x, y: h - 2.2, z, edges: false });
      for (const sz of [-1, 1]) add(box(w, 1.2, 0.6), M.light, world, { x, y: h + 0.6, z: z + sz * (d / 2 - 0.3) });   // パラペット
      for (const sx of [-1, 1]) add(box(0.6, 1.2, d), M.light, world, { x: x + sx * (w / 2 - 0.3), y: h + 0.6, z });
      for (const sz of [-1, 1]) add(box(w - 24, 3.2, 0.4), M.dark, world, { x, y: h - 6, z: z + sz * (d / 2 + 0.2), edges: false });   // 吸排気のルーバー
      for (let i = 0; i < 9; i++) add(box(7, 5.5, 0.5), M.dark, world, { x: x - 120 + i * 30, y: 2.75, z: z - gensSide * (d / 2 + 0.2), edges: false });   // 搬入口
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(box(9, h + 4, 9), M.light, world, { x: x + sx * (w / 2 + 4.5), y: (h + 4) / 2, z: z + sz * 26 });   // 階段・設備の塔
      // 屋上の冷却機(乾式冷却器。1.5 倍): 2 列 × 11 台、1 台に 2 つのファン
      for (const rz of [-22, 22]) for (let i = 0; i < 11; i++) {
        const cx = x - 125 + i * 25, cz = z + rz;
        add(box(12 * D.cool, 2.4 * D.cool, 4.4 * D.cool), M.mid, world, { x: cx, y: h + 1.2 * D.cool, z: cz });
        for (const e of [-1, 1]) add(fanG, M.dark, world, { x: cx + e * 3 * D.cool, y: h + 2.4 * D.cool + 0.15, z: cz, edges: false });
      }
      add(box(w - 40, 0.8, 3), M.dark, world, { x, y: h + 0.4, z, edges: false });   // 屋上の配管の樋
      // 非常用発電機(コンテナ型、排気筒)と燃料タンクの列
      const gz = z + gensSide * (d / 2 + 9);
      for (let i = 0; i < 12; i++) {
        const gx = x - 132 + i * 24;
        add(box(13, 3.4, 3.2), M.light, world, { x: gx, y: 1.7, z: gz });
        add(cyl(0.45, 3.5, 8), M.dark, world, { x: gx + 4.5, y: 5.1, z: gz });
        add(box(13, 0.9, 3.4), M.mid, world, { x: gx, y: 0.45, z: gz + gensSide * 3.6 });   // 下置きの燃料タンク(小)
      }
    };
    hall(-230, -150, 1); hall(70, -150, 1); hall(-230, -20, 1); hall(70, -20, 1);
    for (const z of [-150, -20]) add(box(20, 8, 14), M.light, world, { x: -80, y: 4, z });   // 建屋をつなぐ廊下
    add(box(14, 0.6, 46), M.dark, world, { x: -80, y: 0.3, z: -85, edges: false });          // 地下の配管の上の帯

    // ── 変電所(専用)と送電鉄塔 ──
    add(box(120, 0.25, 120), M.light, world, { x: 330, y: 0.12, z: -140, edges: false });
    for (let i = 0; i < 4; i++) {   // 主変圧器(放熱板、コンサベータ、ブッシング)
      const tx = 290 + i * 26, tz = -165;
      add(box(10, 7, 6), M.mid, world, { x: tx, y: 3.5, z: tz });
      for (const e of [-1, 1]) add(box(10, 5, 0.4), M.dark, world, { x: tx, y: 3, z: tz + e * 3.5, edges: false });
      const ct = cyl(1.1, 7, 10); ct.rotateZ(Math.PI / 2); add(ct, M.light, world, { x: tx, y: 8.5, z: tz - 1.5 });
      for (const e of [-3, 0, 3]) add(cyl(0.3, 3, 6), M.light, world, { x: tx + e, y: 8.5, z: tz + 1.5 });
    }
    for (let i = 0; i < 4; i++) {   // 母線の門型
      const gx = 290 + i * 26;
      for (const e of [-1, 1]) beam(world, V(gx + e * 7, 0, -125), V(gx + e * 7, 18, -125), 0.9, M.mid);
      beam(world, V(gx - 7.5, 18, -125), V(gx + 7.5, 18, -125), 0.9, M.mid);
    }
    add(box(46, 8, 14), M.body, world, { x: 330, y: 4, z: -95 });   // 開閉所の建屋
    add(box(46.4, 1.4, 14.4), M.dark, world, { x: 330, y: 5.4, z: -95, edges: false });
    for (const [x, z] of [[372, -232], [300, -238]]) {   // 送電鉄塔(格子)と腕
      lattice(world, V(x, 0, z), 46, 4.5, 1.2, 5, 0.35, M.mid);
      beam(world, V(x - 9, 40, z), V(x + 9, 40, z), 0.8, M.mid); beam(world, V(x - 7, 33, z), V(x + 7, 33, z), 0.8, M.mid);
    }
    for (const e of [-9, 9]) tube(world, V(372 + e, 39.5, -232), V(290 + 26 * 1.5 + e * 0.5, 18, -125), 0.12, M.dark);   // 引込線
    for (const e of [-9, 9]) tube(world, V(300 + e, 39.5, -238), V(372 + e, 39.5, -232), 0.12, M.dark);

    // ── ガスタービン発電所(4 基): 外装、吸気フィルター、排気筒 ──
    for (let i = 0; i < 4; i++) {
      const gz = -40 + i * 28;
      add(box(32, 10, 9), M.light, world, { x: 318, y: 5, z: gz });
      add(box(8, 8, 11), M.body, world, { x: 298, y: 14, z: gz });
      add(box(8.2, 0.8, 11.2), M.dark, world, { x: 298, y: 12.5, z: gz, edges: false });
      add(lathe([[3.2, 0], [3.2, 30], [3.5, 30], [3.5, 31.5], [0, 31.5]], 16), M.mid, world, { x: 342, y: 0, z: gz });
      add(box(10, 7, 7), M.mid, world, { x: 340, y: 3.5, z: gz });   // 排熱の煙道
    }
    for (const [x, z] of [[330, 120], [362, 150]]) add(lathe([[11, 0], [11, 12], [9, 14.5], [0, 15.5]], 24), M.body, world, { x, y: 0, z });   // 水槽
    add(box(42, 9, 20), M.body, world, { x: 310, y: 4.5, z: 205 });   // 管理棟
    add(box(42.4, 2, 20.4), M.glass, world, { x: 310, y: 5, z: 205, edges: false });
    add(box(12, 4, 8), M.light, world, { x: 255, y: 2, z: 230 });     // 守衛所

    // ── 近未来化: SMR 2 基(格納容器、補助建屋、タービン建屋、機械通風の冷却塔、二重の柵) ──
    const future = new THREE.Group(); world.add(future);
    add(box(330, 0.25, 170), M.light, future, { x: -220, y: 0.12, z: 165, edges: false });
    for (const x of [-330, -270]) {
      add(lathe([[17, 0], [17, 34], [14, 41], [7, 45.5], [0, 46.5]], 28), M.body, future, { x, y: 0, z: 140 });
      add(lathe([[17.4, 28], [17.4, 30], [16.9, 30], [16.9, 28]], 28), M.accent, future, { x, y: 0, z: 140, edges: false });
      add(box(6, 9, 4), M.light, future, { x, y: 4.5, z: 140 - 18 });   // 搬入口
    }
    add(box(110, 22, 34), M.light, future, { x: -300, y: 11, z: 195 });   // 原子炉補助建屋
    add(box(110.4, 1.4, 34.4), M.dark, future, { x: -300, y: 18, z: 195, edges: false });
    add(box(84, 24, 34), M.body, future, { x: -185, y: 12, z: 150 });   // タービン建屋
    add(box(84.4, 3, 34.4), M.dark, future, { x: -185, y: 19, z: 150, edges: false });
    for (let i = 0; i < 6; i++) {   // 機械通風の冷却塔(6 セル)
      const cx = -230 + i * 15;
      add(box(14.4, 13, 16), M.mid, future, { x: cx, y: 6.5, z: 218 });
      add(lathe([[5.4, 0], [5.8, 3.4], [6.2, 3.4], [5.8, 0]], 16), M.light, future, { x: cx, y: 13, z: 218 });
      add(cyl(5.0, 0.3, 12), M.dark, future, { x: cx, y: 14.2, z: 218, edges: false });
    }
    for (let i = 0; i < 2; i++) { const tx = -140 + i * 18; add(box(9, 6.5, 6), M.mid, future, { x: tx, y: 3.25, z: 105 }); for (const e of [-1, 1]) add(box(9, 4.6, 0.4), M.dark, future, { x: tx, y: 2.8, z: 105 + e * 3.4, edges: false }); }
    for (const inset of [0, 5]) {   // 二重の柵
      const x0 = -388 + inset, x1 = -52 - inset, z0 = 78 + inset, z1 = 252 - inset;
      for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) {
        const len = Math.hypot(bx - ax, bz - az), along = ax === bx;
        add(box(along ? 0.2 : len, 0.2, along ? len : 0.2), M.dark, future, { x: (ax + bx) / 2, y: 2.6, z: (az + bz) / 2, edges: false });
        for (let k = 0; k <= Math.round(len / 10); k++) { const t = k / Math.round(len / 10); add(box(0.35, 2.8, 0.35), M.dark, future, { x: ax + (bx - ax) * t, y: 1.4, z: az + (bz - az) * t, edges: false }); }
      }
    }
    tube(future, V(-120, 0.5, 105), V(230, 0.5, 62), 0.6, M.dark);   // 構内の送電ケーブルの樋

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
        coolerRowToParapet_m: +(D.hallD / 2 - 0.6 - (22 + 2.2 * D.cool)).toFixed(2),   // 屋上の冷却機の列とパラペットの隙間
        coolerEndToParapet_m: +(D.hallW / 2 - 0.6 - (125 + 6 * D.cool)).toFixed(2),
        hallRowGap_m: +((-20 - D.hallD / 2) - (-150 + D.hallD / 2 + 9 + 1.6 + 3.6 + 1.7)).toFixed(2),   // 1 列目の発電機・タンクと 2 列目の建屋の隙間
        smrFenceToHall_m: +((78) - (-20 + D.hallD / 2 + 9 + 1.6 + 3.6 + 1.7)).toFixed(2),
      }),
      shots: {
        roof: { label: "屋上の冷却機", target: [70, 18, -20], pos: [190, 90, 70] },
        power: { label: "変電所・ガスタービン", target: [320, 10, -80], pos: [200, 110, 60] },
        smr: { label: "SMR(近未来化)", target: [-250, 15, 170], pos: [-90, 110, 300] },
      },
    };
  }

  DreamAssets.fac.register("ai_dc", {
    section: 6, title: "大規模AIデータセンター", kind: "STRATEGIC FACILITY · 6 情報・通信・産業",
    desc: "平たい巨大な倉庫型の建屋が並び、屋上に冷却機の列、脇に非常用発電機。専用の変電所とガスタービン発電所を持つ。小型モジュール炉(SMR)を併設して電力を自給する近未来版",
    info: [["ファイル", "mockups/3d/facilities/ai_dc.js"], ["大きさ", "敷地の一部 800 × 520 m を 0.22 倍 × 表示 3.0"], ["誇張", "屋上の冷却機 1.5 倍。建屋の高さ・平面は実寸"], ["省略", "車両・人、冷却機のファンの回転"], ["近未来化", "SMR 2 基(格納容器・補助建屋・タービン建屋・冷却塔・二重の柵)"]],
    dist: 1150, target: 20, tokenAt: [420, 0, 330],
    make: (THREE) => build(THREE, { r: 110 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["現在", () => a.setState("current"), () => a.state === "current"], ["SMR 併設(近未来)", () => a.setState("future"), () => a.state === "future"]],
    caption: () => "",
  });
})();
