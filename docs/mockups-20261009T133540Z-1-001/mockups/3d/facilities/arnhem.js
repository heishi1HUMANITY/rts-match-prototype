// 戦略施設トークン「アルンヘム橋」(オランダ、ネーデルライン川。戦後に再建された「ジョン・フロスト橋」)の詳細版モデル(試作)。
// 川(約 140 m)をまたぐ鋼の中路アーチと、北岸の旧市街へ下りる高架、南岸の河川敷・堤防を渡る高架を、約 640 × 360 m で切り取る。
// 平面の配置は実寸の比率(K = 0.25)。歴史的施設(節 8)なので近未来化はなく、現在の姿だけ。状態もない。
// 誇張: 決め手の「大きな鋼製アーチ」— アーチの路面からの高さ 1.6 倍(22 → 35 m)、アーチリブの太さ 1.4 倍。
// 省略: 車両・人、照明柱、街路樹、川の船。北岸の街並みは街区の塊と、目印の聖エウセビウス教会の塔だけ。
//
//   const a = DreamAssets.fac.defs.arnhem.make(THREE)(制圧圏 r = 100)
// 橋は x 方向(-x が北岸の旧市街、+x が南岸)、川は z 方向。
(function () {
  const K = 0.25;
  const D = {
    x0: -320, x1: 320, z0: -180, z1: 180, bed: -6, base: -8,
    quay: -70, south: 70, city: 7, plain: 2, dike: [250, 262, 278, 290], dikeY: 9, polder: 3,
    w: 24, gd: 2.2, deck: 16, A: 62, spring: 6, rise: 22 * 1.6, rib: 3.6 * 1.4,
  };
  // 路面の高さ: アーチ部は 16 m、北は旧市街(+7)、南は堤防の天端(+9)へ下りる
  const deckY = (x) => x < -D.A ? Math.max(D.city + 0.3, D.deck - (-D.A - x) * 0.045) : x > D.A ? Math.max(D.dikeY + 0.3, D.deck - (x - D.A) * 0.034) : D.deck;
  const archY = (x) => D.spring + (D.deck + D.rise - D.spring) * (1 - (x / D.A) ** 2);   // アーチリブの中心線

  function arnhem(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.river = U.waterMaterial(THREE);
    M.brick = M.lambert(0xb9aea4);   // 教会・旧市街の煉瓦(色を抑えた灰褐色)
    const group = new THREE.Group(); group.name = "arnhem";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, tube, beam, prism } = k;
    const W = D.x1 - D.x0, Dz = D.z1 - D.z0;

    // ── 地形: 北岸の岸壁と旧市街の地盤、川、南岸の河川敷と堤防、水制 ──
    F.plinth(k, M, world, W, Dz, D.base);
    add(box(D.south - D.quay + 10, D.bed - D.base, Dz), M.light, world, { x: (D.quay + D.south) / 2, y: (D.bed + D.base) / 2 });
    world.add(k.waterShape([[D.quay, D.z0], [D.south + 8, D.z0], [D.south + 8, D.z1], [D.quay, D.z1]], M.river));
    world.add(new THREE.Mesh(U.merge(THREE, [D.z0, D.z1].map((z) => [new THREE.PlaneGeometry(D.south + 8 - D.quay, -D.bed), { x: (D.quay + D.south + 8) / 2, y: D.bed / 2, z }])), M.waterCut));
    add(prism([[D.x0, D.z0], [D.quay, D.z0], [D.quay, D.z1], [D.x0, D.z1]], D.base, D.city), M.land, world);
    add(box(1.5, D.city - D.bed + 0.6, Dz), M.mid, world, { x: D.quay + 0.75, y: (D.city + D.bed + 0.6) / 2 });   // 岸壁(笠石が少し高い)
    add(box(14, 0.15, Dz), M.mid, world, { x: D.quay - 10, y: D.city + 0.08, edges: false });   // 河岸通り(ライン河岸)
    // 南岸: 河川敷の法(水際 → +2)、河川敷、堤防、堤内地
    const bankS = [[D.south - 4, D.base], [D.dike[0], D.base], [D.dike[0], D.plain], [D.south + 10, D.plain], [D.south - 4, D.bed + 1]];
    add(U.loft(THREE, [{ z: D.z0, pts: bankS }, { z: D.z1, pts: bankS }]), M.land, world);
    const dike = [[D.dike[0], D.base], [D.dike[3], D.base], [D.dike[3], D.polder], [D.dike[2], D.dikeY], [D.dike[1], D.dikeY], [D.dike[0], D.plain]];   // 凸形に分ける
    const polder = [[D.dike[3], D.base], [D.x1, D.base], [D.x1, D.polder], [D.dike[3], D.polder]];
    for (const pts of [dike, polder]) add(U.loft(THREE, [{ z: D.z0, pts }, { z: D.z1, pts }]), M.land, world);
    add(box(D.dike[2] - D.dike[1], 0.15, Dz), M.mid, world, { x: (D.dike[1] + D.dike[2]) / 2, y: D.dikeY + 0.08, edges: false });   // 堤防の上の道
    for (const z of [-150, -85, 85, 150]) {   // 水制(石積みの突堤。河川敷から川へ)
      add(box(34, 2.6, 7), M.mid, world, { x: D.south - 10, y: 0.2, z });
      add(box(36, 1.0, 9), M.dark, world, { x: D.south - 10, y: -1.5, z, edges: false });
    }

    // ── 北岸の旧市街: 河岸の街区、聖エウセビウス教会(塔は高さ 93 m) ──
    const blocks = [[-110, -150, 30, 50, 18], [-110, -80, 30, 60, 22], [-110, 80, 30, 60, 16], [-110, 150, 30, 50, 24], [-160, -145, 40, 40, 14], [-160, 140, 40, 50, 20], [-215, 120, 40, 60, 15], [-280, -40, 50, 40, 18], [-285, 60, 40, 50, 12], [-280, 150, 50, 40, 22]];
    for (const [x, z, w, d, h] of blocks) {
      add(box(w, h, d), M.body, world, { x, y: D.city + h / 2, z });
      for (let f = 1; f * 3.2 < h - 1; f++) add(box(w + 0.2, 0.9, d + 0.2), M.glass, world, { x, y: D.city + f * 3.2 - 0.6, z, edges: false });
      add(prism([[x - w / 2, z - d / 2 + 2], [x + w / 2, z - d / 2 + 2], [x + w / 2, z + d / 2 - 2], [x - w / 2, z + d / 2 - 2]], D.city + h, D.city + h + 0.8), M.light, world);
    }
    {   // 教会: 身廊(切妻屋根)と、四角い塔の上に八角の頂部
      const cx = -215, cz = -95, ny = D.city;
      add(box(64, 22, 26), M.brick, world, { x: cx + 10, y: ny + 11, z: cz });
      const gable = [[-13.5, ny + 22], [13.5, ny + 22], [0, ny + 36]];   // 切妻屋根(棟は身廊の長手 = x 方向)
      const roofG = U.loft(THREE, [{ z: -33, pts: gable }, { z: 33, pts: gable }]); roofG.rotateY(Math.PI / 2);
      add(roofG, M.mid, world, { x: cx + 10, z: cz });
      const tx = cx - 32;
      add(box(16, 52, 16), M.brick, world, { x: tx, y: ny + 26, z: cz });
      add(box(13, 14, 13), M.brick, world, { x: tx, y: ny + 59, z: cz });
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(box(2.2, 8, 2.2), M.light, world, { x: tx + sx * 7, y: ny + 56, z: cz + sz * 7 });   // 角の小塔
      add(cyl(5.2, 16, 8), M.light, world, { x: tx, y: ny + 74, z: cz, ry: Math.PI / 8 });   // 八角の頂部(戦後の再建で鋼とガラス)
      add(cyl(5.6, 0.8, 8), M.dark, world, { x: tx, y: ny + 82.4, z: cz, ry: Math.PI / 8, edges: false });
      add(new THREE.ConeGeometry(2.4, 9, 8), M.mid, world, { x: tx, y: ny + 87.3, z: cz });
      for (const y of [ny + 18, ny + 34, ny + 46]) for (const s of [-1, 1]) add(box(0.3, 6, 3), M.glass, world, { x: tx + s * 8.05, y, z: cz, edges: false });   // 尖頭の窓
    }

    // ── 橋: 中路アーチ(2 本のリブ、路面より上は吊り材、下は支柱)、取付けの高架 ──
    const A = D.A, n = 24;
    const rib = (i, dz) => { const x = -A + (2 * A * i) / n; return V(x, archY(x), dz); };
    const ribZ = [-(D.w / 2 + D.rib / 2 + 0.5), D.w / 2 + D.rib / 2 + 0.5];
    for (const s of [-1, 1]) {   // アーチの支点の橋脚(水中。上流側に水切り)
      add(box(16, D.spring + 2 - D.bed, D.w + 14), M.light, world, { x: s * A, y: (D.spring + 2 + D.bed) / 2 });
      for (const dz of [-1, 1]) add(cyl(4, D.spring + 2 - D.bed, 10), M.light, world, { x: s * A, y: (D.spring + 2 + D.bed) / 2, z: dz * (D.w / 2 + 7) });
      for (const dz of ribZ) add(box(6, 3, D.rib + 1.5), M.dark, world, { x: s * (A - 2), y: D.spring + 1.5, z: dz, edges: false });   // 支承
    }
    for (const dz of ribZ) {
      for (let i = 0; i < n; i++) beam(world, rib(i, dz), rib(i + 1, dz), D.rib, M.body);
      for (let i = 1; i < n; i++) {
        const p = rib(i, dz), dy = p.y - D.deck;
        if (dy > D.rib) tube(world, p.clone().setY(p.y - D.rib / 2), V(p.x, D.deck - D.gd / 2, dz), 0.35, M.mid);           // 吊り材
        else if (dy < -D.rib) beam(world, p.clone().setY(p.y + D.rib / 2), V(p.x, D.deck - D.gd, dz), 1.2, M.light);  // 支柱
      }
    }
    for (let i = 0; i <= n; i++) {   // 横つなぎ(路面から 7 m より上だけ)と X の斜材
      const a = rib(i, ribZ[0]), c = rib(i, ribZ[1]);
      if (a.y - D.deck < 7) continue;
      beam(world, a, c, 1.6, M.light);
      if (i < n && rib(i + 1, 0).y - D.deck >= 7) { tube(world, a, rib(i + 1, ribZ[1]), 0.5, M.light); tube(world, c, rib(i + 1, ribZ[0]), 0.5, M.light); }
    }
    // 桁と路面(アーチ部の鋼の床組 + 取付けの高架の床版)。区間ごとに勾配に合わせる
    const piersN = [], piersS = [];
    for (let x = -A - 28; x > -270; x -= 28) piersN.push(x);
    for (let x = A + 28; x < D.dike[0] + 6; x += 28) piersS.push(x);
    const stops = [D.x0, -258, ...piersN.slice().reverse(), -A, A, ...piersS, D.dike[1] + 4, D.dike[2]];
    for (let i = 0; i < stops.length - 1; i++) {
      const xa = stops[i], xb = stops[i + 1], ya = deckY(xa), yb = deckY(xb), len = Math.hypot(xb - xa, yb - ya);
      const sp = new THREE.Group(); sp.position.set((xa + xb) / 2, (ya + yb) / 2, 0); sp.rotation.z = Math.atan2(yb - ya, xb - xa); world.add(sp);
      const onGround = xa === D.x0 || xa === D.dike[1] + 4;   // 旧市街の地盤・堤防の天端の上は道路だけ
      const arch = xa === -A;
      if (!onGround) {
        add(box(len, D.gd, D.w), arch ? M.light : M.body, sp, { y: -D.gd / 2 });
        for (const s of [-1, 1]) add(box(len, 0.8, 0.3), M.dark, sp, { y: -0.4, z: s * (D.w / 2 + 0.15), edges: false });
      }
      add(box(len, 0.2, 14), M.mid, sp, { y: 0.1, edges: false });                                   // 車道 4 車線
      for (const s of [-1, 1]) {
        add(box(len, 0.25, 4), M.light, sp, { y: 0.12, z: s * 9.4, edges: false });                  // 自転車道・歩道
        add(box(len, 0.3, 0.5), M.light, sp, { y: 0.25, z: s * 7.2, edges: false });                // 縁石
        add(box(len, 1.2, 0.35), M.light, sp, { y: 0.6, z: s * (D.w / 2 - 0.2) });                  // 高欄
      }
    }
    for (const x of [...piersN, ...piersS]) {   // 高架の橋脚(壁式、上に梁)
      const top = deckY(x) - D.gd, g = x < 0 ? D.city : x < D.dike[0] ? D.plain : D.dikeY;
      if (top - g < 1) continue;
      add(box(2.4, top - g - 1.2, D.w - 8), M.light, world, { x, y: g + (top - g - 1.2) / 2 });
      add(box(3.4, 1.2, D.w - 2), M.light, world, { x, y: top - 0.6 });
    }
    // 取付けの盛土(北は旧市街の地盤、南は堤防の上へ)
    const emb = (x, y0, h) => [V(x, y0 - 0.01, -(D.w / 2 + 1 + h * 1.5)), V(x, y0 - 0.01, D.w / 2 + 1 + h * 1.5), V(x, y0 + h, D.w / 2 + 1), V(x, y0 + h, -(D.w / 2 + 1))];
    add(k.closedLoft([emb(-258 + 0.5, D.city, deckY(-258) - D.city - 0.05), emb(-300, D.city, 0.25)]), M.light, world);
    add(box(D.x0 + 300, 0.2, 14), M.mid, world, { x: (D.x0 - 300) / 2, y: D.city + 0.1, edges: false });

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);
    function update(dt) { M.river.map.offset.y -= dt * 0.1; ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; }
    function check() {
      const r1 = (v) => +v.toFixed(2);
      return {
        navClearance_m: r1(D.deck - D.gd),                                      // アーチ部の桁下(水面から)
        archRiseOverDeck_m: r1(D.rise),                                         // 誇張後のアーチの高さ(路面から)
        ribToDeckEdge_m: r1(Math.abs(ribZ[0]) - D.rib / 2 - D.w / 2),          // リブと桁の縁の隙間
        bracingOverDeck_m: 7,                                                   // 横つなぎの最低の高さ(路面から)
      };
    }
    U.bake(THREE, group, { live: [M.accent] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, check, at, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      shots: {
        arch: { label: "鋼のアーチ", target: [0, 25, 0], pos: [90, 45, 150] },
        under: { label: "アーチの足元", target: [-50, 10, 0], pos: [20, 4, -110] },
        city: { label: "北岸と教会の塔", target: [-170, 30, -40], pos: [-40, 70, -200] },
      },
    };
  }

  DreamAssets.fac.register("arnhem", {
    section: 8, title: "アルンヘム橋", kind: "STRATEGIC FACILITY · 8 歴史的施設",
    desc: "ネーデルライン川をまたぐ鋼の中路アーチ橋。戦後に再建され「ジョン・フロスト橋」に改名された。北岸の旧市街へ下りる高架と、南岸の河川敷・堤防を渡る高架を含む現在の姿",
    info: [["ファイル", "mockups/3d/facilities/arnhem.js"], ["大きさ", "640 × 360 m を切り取り、0.25 倍 × 表示 3.0"], ["誇張", "アーチの高さ(路面から)1.6 倍、リブの太さ 1.4 倍"], ["省略", "車両・人、照明柱、街路樹、船"], ["状態", "なし(現在の姿)"]],
    dist: 950, target: 25, tokenAt: [360, 0, 250],
    make: (THREE) => arnhem(THREE, { r: 100 }),
  });
})();
