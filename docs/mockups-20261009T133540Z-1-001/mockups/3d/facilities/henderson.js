// 戦略施設トークン「ヘンダーソン飛行場」(ソロモン諸島・ガダルカナル島、現在のホニアラ国際空港)の詳細版モデル(試作)。歴史的施設の現在の姿。
// 滑走路(長さ 2200 m × 幅 45 m)の約 1000 m を切り取った区間。平面は実寸の比率(縮尺 K = 0.2)。
// モデルの決め手: 熱帯の島の滑走路。北に海と砂浜、南に密林の丘。ヤシ 1.5 倍、丘の高さ 1.5 倍、記念碑 1.5 倍に誇張。
// 簡略化: 実物は滑走路から海岸まで約 1.5 km あるが、約 200 m に縮めて同じ台座に入れた。
// 省略: 駐機中の旅客機・車両・人・小さな記念品(高射砲の展示など)。近未来化の案はリストに無いので現在の姿だけ(状態なし)。
// 座標: m。滑走路は x 方向、+z が北(海)、-z が南(丘)。
(function () {
  const K = 0.2;
  const D = { base: -5, xw: 500, zw: 240, rwZ: 0, rwW: 45, twZ: 62, twW: 23, coast: 178, palmS: 1.5, hillS: 1.5 };

  function henderson(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 112;
    const M = F.mats(THREE);
    M.sand = M.lambert(0xe9e3d3); M.hill = M.lambert(0xccd4c4); M.frond = M.lambert(0xa9bba2); M.crown = M.lambert(0xb8c6b0); M.trunk = M.lambert(0xb3aa9a); M.roof = M.lambert(0xb7bec6);
    M.sea = U.waterMaterial(THREE, { repeat: [(2 * D.xw * K) / U.WATER_TILE[0], ((D.zw - D.coast) * K) / U.WATER_TILE[1]] });
    const group = new THREE.Group(); group.name = "henderson";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const { add, box, cyl, V, prism, tube, closedLoft } = F.kit(THREE, M, K);
    const rng = U.rng(23);
    const flat = (w, d, mat, parent, x, y, z, o = {}) => add(box(w, 0.04, d), mat, parent, { x, y, z, edges: false, ...o });

    // ── 台座: 陸(海岸まで)、砂浜の斜面、海底、海、足元の暗い帯 ──
    add(prism([[-D.xw + 15, -D.zw], [D.xw - 15, -D.zw], [D.xw, -D.zw + 15], [D.xw, D.coast], [-D.xw, D.coast], [-D.xw, -D.zw + 15]], D.base, 0), M.land, world);
    const beachProf = (x) => [V(x, D.base, D.coast), V(x, 0, D.coast), V(x, -2.6, D.coast + 30), V(x, D.base, D.coast + 30)];
    add(closedLoft([beachProf(-D.xw), beachProf(D.xw)]), M.sand, world);
    add(box(2 * D.xw, 1, D.zw - D.coast - 30), M.sand, world, { y: D.base + 0.5, z: (D.coast + 30 + D.zw) / 2, edges: false });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2 * D.xw, D.zw - D.coast - 8).rotateX(-Math.PI / 2), M.sea); sea.position.set(0, -0.8, (D.coast + 8 + D.zw) / 2); world.add(sea);
    const cut = U.merge(THREE, [[new THREE.PlaneGeometry(D.zw - D.coast - 8, -0.8 - D.base - 1), { x: -D.xw, y: (-0.8 + D.base + 1) / 2, z: (D.coast + 8 + D.zw) / 2, ry: Math.PI / 2 }], [new THREE.PlaneGeometry(D.zw - D.coast - 8, -0.8 - D.base - 1), { x: D.xw, y: (-0.8 + D.base + 1) / 2, z: (D.coast + 8 + D.zw) / 2, ry: Math.PI / 2 }], [new THREE.PlaneGeometry(2 * D.xw, -0.8 - D.base - 1), { y: (-0.8 + D.base + 1) / 2, z: D.zw }]]);
    world.add(new THREE.Mesh(cut, M.waterCut));
    F.plinth({ add, box }, M, world, 2 * D.xw, 2 * D.zw, D.base);

    // ── 密林の丘(南。高さ 1.5 倍) ──
    const xs = Array.from({ length: 9 }, (_, i) => -D.xw + 15 + (i * (2 * D.xw - 30)) / 8);   // 丘の断面の位置(面は断面の間を直線でつなぐ)
    const hillH = (x) => (42 + 22 * Math.sin(x / 140 + 0.8) + 10 * Math.sin(x / 47)) * D.hillS;
    const hillY = (x, z) => { const i = Math.max(0, Math.min(xs.length - 2, Math.floor(((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * (xs.length - 1)))), f = (x - xs[i]) / (xs[i + 1] - xs[i]), h = hillH(xs[i]) * (1 - f) + hillH(xs[i + 1]) * f, t = (z + D.zw) / (D.zw - 110); return z > -110 ? 0 : t < 0.3 ? h * (1 - 0.1 * (t / 0.3)) : t < 0.7 ? h * (0.9 - 1.25 * (t - 0.3)) : h * 0.4 * (1 - (t - 0.7) / 0.3); };
    const ridgeRing = (x) => { const h = hillH(x); return [V(x, D.base, -D.zw), V(x, D.base, -110), V(x, 0.2, -110), V(x, 0.4 * h, -150), V(x, 0.9 * h, -200), V(x, h, -D.zw)]; };
    for (let i = 0; i < xs.length - 1; i++) add(closedLoft([ridgeRing(xs[i]), ridgeRing(xs[i + 1])]), M.hill, world);

    // ── 滑走路(切り取った区間)・誘導路・駐機場 ──
    add(box(2 * D.xw - 30, 0.2, D.rwW + 14), M.light, world, { y: 0.1, z: D.rwZ, edges: false });
    add(box(2 * D.xw - 30, 0.4, D.rwW), M.mid, world, { y: 0.2, z: D.rwZ });
    const mk = 0.42;
    for (const s of [-1, 1]) flat(2 * D.xw - 40, 0.9, M.body, world, 0, mk, D.rwZ + s * (D.rwW / 2 - 1.5));
    for (let x = -460; x <= 400; x += 50) flat(30, 0.9, M.body, world, x, mk, D.rwZ);
    flat(1.8, D.rwW - 4, M.body, world, 452, mk, D.rwZ);
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) flat(30, 1.8, M.body, world, 425, mk, D.rwZ + s * (3.4 + i * 3.6));
    for (const s of [-1, 1]) flat(45, 8, M.body, world, 150, mk, D.rwZ + s * 9);
    add(box(2 * D.xw - 30, 0.3, D.twW), M.mid, world, { y: 0.15, z: D.twZ });
    for (const x of [-380, -120, 160, 400]) add(box(D.twW, 0.3, D.twZ - D.rwW / 2 - D.twW / 2 + 8), M.mid, world, { x, y: 0.15, z: (D.twZ - D.twW / 2 + D.rwW / 2) / 2 });
    add(box(380, 0.25, 50), M.light, world, { x: -60, y: 0.12, z: 98.5 });
    for (let x = -220; x <= 100; x += 60) flat(0.4, 40, M.mid, world, x, 0.27, 98);   // 駐機位置の線

    // ── ターミナル(勾配屋根を連ねた低い建物、正面のひさし)・管制塔・消防署・貨物上屋 ──
    add(box(120, 7, 26), M.body, world, { x: -150, y: 3.5, z: 140 });
    add(box(120.2, 2.2, 26.2), M.glass, world, { x: -150, y: 3.2, z: 140, edges: false });
    add(box(120.6, 0.5, 26.6), M.accent, world, { x: -150, y: 6.9, z: 140, edges: false });
    for (let i = 0; i < 4; i++) {
      const x0 = -210 + i * 30;
      add(closedLoft([126, 154].map((z) => [V(x0 - 1, 7, z), V(x0 + 15, 14.5, z), V(x0 + 31, 7, z)])), M.roof, world);
    }
    add(box(70, 0.6, 9), M.light, world, { x: -150, y: 6.2, z: 122.5 });
    for (const x of [-180, -150, -120]) add(cyl(0.4, 6, 8), M.mid, world, { x, y: 3, z: 119 });
    add(box(5, 18, 5), M.light, world, { x: -40, y: 9, z: 142 });
    add(new THREE.CylinderGeometry(5.6, 4.6, 4, 8), M.glass, world, { x: -40, y: 20, z: 142 });
    add(cyl(6.2, 0.8, 8), M.light, world, { x: -40, y: 22.4, z: 142 });
    tube(world, V(-38, 22.8, 143), V(-38, 29, 143), 0.2, M.dark);
    add(box(32, 7, 18), M.light, world, { x: 30, y: 3.5, z: 140 });
    for (let i = 0; i < 3; i++) add(box(7, 5, 0.3), M.dark, world, { x: 19 + i * 11, y: 2.5, z: 130.9, edges: false });
    add(box(56, 9, 28), M.body, world, { x: 120, y: 4.5, z: 138 });
    add(closedLoft([[V(91, 9, 124), V(120, 12, 124), V(149, 9, 124)], [V(91, 9, 152), V(120, 12, 152), V(149, 9, 152)]]), M.roof, world);
    add(box(18, 6, 0.3), M.dark, world, { x: 120, y: 3, z: 123.9, edges: false });
    add(box(2 * D.xw - 10, 0.15, 9), M.mid, world, { y: 0.08, z: 165, edges: false });   // 海岸の道路

    // ── 記念碑(ガダルカナルの戦いの慰霊。1.5 倍) ──
    const mem = new THREE.Group(); mem.position.set(-300, 0, 138); mem.scale.setScalar(1.5); world.add(mem);
    add(cyl(14, 0.4, 24), M.light, mem, { y: 0.2 });
    add(closedLoft([[V(-1.6, 0.4, -1.6), V(1.6, 0.4, -1.6), V(1.6, 0.4, 1.6), V(-1.6, 0.4, 1.6)], [V(-0.8, 13, -0.8), V(0.8, 13, -0.8), V(0.8, 13, 0.8), V(-0.8, 13, 0.8)]]), M.body, mem);
    add(new THREE.ConeGeometry(1.15, 1.6, 4), M.body, mem, { y: 13.8, ry: Math.PI / 4 });
    add(box(12, 2.4, 1), M.mid, mem, { y: 1.6, z: -7 });
    for (const x of [-4, 0, 4]) tube(mem, V(x, 0.4, 7), V(x, 15, 7), 0.12, M.dark);

    // ── ヤシ(1.5 倍)と密林の木(インスタンス) ──
    const parts = [], piece = (g, color) => parts.push({ geo: g.index ? g.toNonIndexed() : g, color });
    let top = V(0, 0, 0);
    [[0.08, 8], [0.15, 7.5], [0.24, 7]].forEach(([rz, h]) => { const g = cyl(0.42, h, 6); g.translate(0, h / 2, 0); g.rotateZ(-rz); g.translate(top.x, top.y, 0); piece(g, M.trunk.color); top = V(top.x + Math.sin(rz) * h, top.y + Math.cos(rz) * h, 0); });
    for (let i = 0; i < 8; i++) { const g = box(6.5, 0.22, 1.5); g.translate(3.2, 0, 0); g.rotateZ(-0.5 - (i % 2) * 0.15); g.rotateY((i * Math.PI) / 4); g.translate(top.x, top.y, 0); piece(g, M.frond.color); }
    { const g = box(1.4, 1.2, 1.4); g.translate(top.x, top.y - 0.8, 0); piece(g, M.trunk.color); }
    const palmG = U.concat(THREE, parts);
    const treeG = U.concat(THREE, [{ geo: new THREE.IcosahedronGeometry(7, 0).translate(0, 11, 0), color: M.crown.color }, { geo: cyl(0.7, 8, 4).translate(0, 4, 0).toNonIndexed(), color: M.trunk.color }]);
    const palmsAt = [], treesAt = [];
    for (let x = -480; x <= 480; x += 22) palmsAt.push([x + (rng() - 0.5) * 10, D.coast - 6 + rng() * 10, D.palmS * (0.8 + rng() * 0.4)]);
    for (let x = -470; x <= 470; x += 34) palmsAt.push([x + (rng() - 0.5) * 8, 156 + rng() * 4, D.palmS * (0.8 + rng() * 0.3)]);
    for (const [x, z] of [[-250, 118], [-230, 160], [-70, 118], [60, 118], [200, 120], [250, 150], [-330, 115], [-350, 160]]) palmsAt.push([x, z, D.palmS]);
    for (let i = 0; i < 420; i++) { const x = -485 + rng() * 970, z = -232 + rng() * 132; treesAt.push([x, z, 0.85 + rng() * 0.6]); }   // 密林(丘の上は密に)
    for (let i = 0; i < 40; i++) treesAt.push([-485 + rng() * 970, -88 + rng() * 26, 0.7 + rng() * 0.4]);
    const inst = (geo, list, yOf) => {
      const m = new THREE.InstancedMesh(geo, U.vcLambert(THREE), list.length), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(1, 1, 1);
      list.forEach(([x, z, s], i) => { mt.compose(V(x, yOf(x, z) - 0.5, z), q.setFromAxisAngle(V(0, 1, 0), rng() * 6.3), sc.set(s, s, s)); m.setMatrixAt(i, mt); });
      world.add(m); return m;
    };
    inst(palmG, palmsAt, () => 0);
    inst(treeG, treesAt, hillY);

    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);
    U.bake(THREE, group, { live: [M.accent] });
    return {
      group, stats: () => U.stats(group), parts: { ring, disc },
      update(dt) { M.sea.map.offset.y -= dt * 0.04; ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      setTeam: (c) => F.setTeam(M, c), setState() {}, get state() { return "now"; },
      check: () => ({
        palmTopOverGround_m: +(top.y * D.palmS).toFixed(1),                           // ヤシの高さ(誇張後)
        hillMaxHeight_m: +Math.max(...xs.map(hillH)).toFixed(1),                       // 丘の最高点(誇張後)
        terminalToCoastRoad_m: 165 - 4.5 - (140 + 13),                                // ターミナルの裏と海岸の道路
        canopyOverApron_m: +(6.2 - 0.3 - 0.25).toFixed(1),                              // 駐機場の上に張り出すひさしの下端の高さ
      }),
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        terminal: { label: "ターミナルと管制塔", target: [-110, 6, 135], pos: [-30, 55, 260] },
        beach: { label: "砂浜とヤシ", target: [100, 6, 175], pos: [180, 25, 260] },
        memorial: { label: "記念碑", target: [-300, 8, 138], pos: [-250, 30, 200] },
        hills: { label: "滑走路と南の丘", target: [0, 20, -150], pos: [250, 60, 80] },
      },
    };
  }

  DreamAssets.fac.register("henderson", {
    section: 8, title: "ヘンダーソン飛行場", kind: "STRATEGIC FACILITY · 8 歴史的施設",
    desc: "ガダルカナル島の飛行場の現在の姿(ホニアラ国際空港)。熱帯の島の滑走路の切り取った区間と、勾配屋根のターミナル、慰霊碑、海岸のヤシ並木、南の密林の丘",
    info: [["ファイル", "mockups/3d/facilities/henderson.js"], ["大きさ", "滑走路の約 1000 m を切り取り、1000 × 480 m を 0.2 倍 × 表示 3.0"], ["誇張", "ヤシ 1.5 倍、丘の高さ 1.5 倍、記念碑 1.5 倍"], ["簡略化", "海岸までの距離を約 1.5 km → 200 m に縮めた"], ["省略", "旅客機・車両・人・小さな展示物"]],
    dist: 1150, target: 25, tokenAt: [430, 0, 330],
    make: (THREE) => henderson(THREE),
    actions: () => [], caption: () => "",
  });
})();
