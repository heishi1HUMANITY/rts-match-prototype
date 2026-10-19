// 戦略施設トークン「セヴァストポリ」(クリミア半島、黒海艦隊の母港)の詳細版モデル(試作)。
// 決め手は「枝分かれした湾の地形」。本湾(幅 約 900 m)の湾口から東へ 2.6 km を切り取り、南岸に枝分かれする 3 つの小湾
// (砲兵湾・南湾・コラベリナヤ湾)を実寸の比率で組む。寸法はメートル、全体を K 倍。
// 誇張: 陸の高さ 2 倍(岸壁 +6 m、丘は等高線の段で最高 +52 m)、湾口の防材の浮体の太さ 2 倍。
// 省略: 小型艇・車両・クレーンより小さい機械。艦艇はフリゲート級(長さ 125 m)以上だけ置く。
// 現在の状態: 2023 年 9 月にミサイル攻撃を受けた艦隊司令部の建物(片側の棟が崩れている)、浮きドックの艦、桟橋の艦。
// 近未来化(施設リストの案): 湾口の防材(浮き障壁。中央の門の区画が旋回して開く)、屋根付きのシェルター型ドック 2 棟(引き戸)、無人艇専用の小桟橋群。
// 状態: "alert"(警戒: 防材の門が閉じ、シェルターの扉が閉じる)⇄ "normal"(通常: 門が開き、扉が開く)。切替 8 秒。
// 座標: x が東(湾の奥)、z が南。-x 側が外海。
(function () {
  const K = 0.06;
  const D = {
    x0: -1300, x1: 1300, z0: -900, z1: 1100,
    ground: 6, bed: -18, base: -22,
    coast: -1000,                      // 両岸の西の海岸線
    rav: [-1060, -700], ravR: 85,      // コンスタンチン砲台(湾口の北の要塞)
    boomX: -1035, boomN: -450, boomS: -50, gate: [-330, -170],   // 防材(北の防波堤の先端〜南の防波堤の先端)、門の区画(北端・南端の z。南端が軸)
    shelters: [925, 1025], shW: 40, shZ: [440, 620],         // シェルターの中心 x、内幅、z の範囲(北が水路側)
  };
  const SEC = 8, OPEN = (80 * Math.PI) / 180;

  function sevastopol(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 105;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE); M.sea.side = THREE.DoubleSide;
    const XC = 0, ZC = (D.z0 + D.z1) / 2;
    const group = new THREE.Group(); group.name = "sevastopol";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, -ZC * K); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, polar, prism, tube, beam, closedLoft, arcLoft } = k;
    const rnd = U.rng(23);

    // ── 陸: 北岸(砲台の岬を含む)と南岸(3 つの小湾) ──
    const C = D.rav, arc = [];
    for (let i = 0; i <= 14; i++) { const th = (i / 14) * (250 * Math.PI / 180); arc.push([C[0] + D.ravR * Math.cos(th), C[1] + D.ravR * Math.sin(th)]); }
    const north = [[D.coast, D.z0], [D.x1, D.z0], [D.x1, -700], [900, -690], [600, -680], [200, -720], [-300, -690], [-700, -700], [-985, -690], ...arc, [-1060, -860]];
    const south = [[D.coast, D.z1], [D.coast, 200], [-500, 210], [-470, 560], [-330, 560], [-300, 200], [80, 190], [150, 960], [450, 960], [520, 190], [850, 200], [890, 640], [1060, 640], [1100, 200], [D.x1, 210], [D.x1, D.z1]];
    for (const pts of [north, south]) add(prism(pts, D.base, D.ground), M.land, world);
    // 等高線の段の丘(実物の高さの 2 倍)
    const hill = (cx, cz, rx, rz, steps) => steps.forEach(([s, y0, y1]) => {
      const pts = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return [cx + rx * s * Math.cos(a), cz + rz * s * Math.sin(a)]; });
      add(prism(pts, y0, y1), M.land, world);
    });
    const STEPS = [[1, D.ground, 22], [0.7, 22, 38], [0.42, 38, 52]];
    hill(-120, 820, 170, 230, STEPS); hill(690, 790, 120, 250, STEPS); hill(-760, 780, 200, 260, STEPS);
    hill(350, -830, 380, 60, STEPS.slice(0, 2));
    // 防波堤と先端の灯台
    for (const [x, za, zb, tipZ] of [[-1060, -620, D.boomN, D.boomN], [-1020, 200, D.boomS, D.boomS]]) {
      add(box(24, D.ground + 2 - D.bed, Math.abs(zb - za)), M.light, world, { x, y: (D.ground + 2 + D.bed) / 2, z: (za + zb) / 2 });
      add(cyl(3.5, 14, 10), M.body, world, { x, y: D.ground + 2 + 7, z: tipZ + Math.sign(za - zb) * 6 });
      add(cyl(4.2, 2, 10), M.red, world, { x, y: D.ground + 2 + 14.5, z: tipZ + Math.sign(za - zb) * 6 });
    }
    // 海: 1 枚の水面(陸の下は陸に隠れる)、海底、外へ開いた縁の水の切り口
    world.add(k.waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], M.sea));
    add(box(D.x1 - D.x0, D.bed - D.base, D.z1 - D.z0), M.light, world, { y: (D.base + D.bed) / 2, z: ZC, edges: false });
    const cut = (len, o) => [new THREE.PlaneGeometry(len, -D.bed), { y: D.bed / 2, ...o }];
    world.add(new THREE.Mesh(U.merge(THREE, [
      cut(D.z1 - D.z0, { x: D.x0, z: ZC, ry: Math.PI / 2 }), cut(910, { x: D.x1, z: -245, ry: Math.PI / 2 }),
      cut(D.coast - D.x0, { x: (D.x0 + D.coast) / 2, z: D.z0 }), cut(D.coast - D.x0, { x: (D.x0 + D.coast) / 2, z: D.z1 }),
    ]), M.waterCut));
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base, { z: ZC });

    // ── コンスタンチン砲台: 海側を半円で囲む 2 層の砲郭(暗い窓の列) ──
    const rav = new THREE.Group(); rav.position.set(C[0], 0, C[1]); world.add(rav);
    const RB = [-0.95 * Math.PI, 0.15 * Math.PI];
    add(arcLoft([[58, D.ground], [74, D.ground], [74, D.ground + 16], [58, D.ground + 16]], ...RB, 30), M.light, rav);
    add(arcLoft([[58, D.ground + 16], [74, D.ground + 16], [74, D.ground + 17.2], [58, D.ground + 17.2]], ...RB, 30), M.mid, rav);
    for (const y of [D.ground + 4, D.ground + 10.5]) add(arcLoft([[74, y], [74.6, y], [74.6, y + 2.2], [74, y + 2.2]], RB[0] + 0.05, RB[1] - 0.05, 30), M.dark, rav, { edges: false });
    add(box(30, 10, 14), M.light, rav, { x: 20, y: D.ground + 5, z: -40 });   // 奥の兵舎

    // ── 市街: 区画ごとに板状の建物を並べる ──
    const district = (x0, x1, z0, z1, n) => {
      for (let i = 0; i < n; i++) {
        const w = 40 + rnd() * 50, d = 14 + rnd() * 10, h = 12 + rnd() * 18, ry = rnd() < 0.5 ? 0 : Math.PI / 2;
        const x = x0 + w / 2 + rnd() * (x1 - x0 - w), z = z0 + w / 2 + rnd() * (z1 - z0 - w);
        add(box(w, h, d), rnd() < 0.8 ? M.body : M.light, world, { x, y: D.ground + h / 2, z, ry });
      }
    };
    district(-260, 50, 240, 520, 16); district(560, 820, 240, 470, 12); district(-560, 900, -890, -760, 26); district(-940, -560, 250, 500, 12);

    // ── 艦隊司令部の建物(南湾の西岸。片側の棟が崩れ、屋根が抜けている) ──
    const hq = new THREE.Group(); hq.position.set(-10, 0, 330); hq.rotation.y = 0.08; world.add(hq);
    add(box(110, 22, 26), M.body, hq, { y: D.ground + 11 });
    add(box(112, 1.2, 28), M.light, hq, { y: D.ground + 22.6 });
    for (const y of [D.ground + 6, D.ground + 12, D.ground + 18]) add(box(110.4, 1.6, 26.4), M.glass, hq, { y, edges: false });
    add(box(26, 22, 50), M.body, hq, { x: -42, y: D.ground + 11, z: 38 });
    add(box(26, 9, 30), M.mid, hq, { x: 42, y: D.ground + 4.5, z: 28 });   // 崩れた棟: 低く残った壁と瓦礫
    for (let i = 0; i < 7; i++) add(box(6 + rnd() * 8, 2 + rnd() * 4, 6 + rnd() * 8), M.dark, hq, { x: 34 + rnd() * 18, y: D.ground + 9 + rnd() * 2, z: 16 + rnd() * 26, ry: rnd() * 3 });
    add(box(12, 6, 2), M.dark, hq, { x: 46, y: D.ground + 15, z: -13.2, edges: false });   // 本棟の焼けた開口
    add(box(24, 0.6, 18), M.accent, hq, { x: -42, y: D.ground + 22.3, z: 38, edges: false });   // 屋上のヘリポートの帯(チーム色)

    // ── 艦艇(フリゲート級以上): 船体は断面の連結、上部構造・砲・マスト ──
    const ship = (parent, x, z, ry, { L = 125, B = 15, fb = 7, dr = 4.5, kind = "frigate", y = 0 } = {}) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
      add(U.loft(THREE, [
        { z: -L / 2, pts: U.sym([[B * 0.32, -dr + 1], [B * 0.46, fb]]) },
        { z: -L * 0.3, pts: U.sym([[B * 0.4, -dr], [B * 0.5, fb]]) },
        { z: L * 0.18, pts: U.sym([[B * 0.4, -dr], [B * 0.5, fb]]) },
        { z: L * 0.4, pts: U.sym([[B * 0.18, -dr + 0.5], [B * 0.38, fb + 1]]) },
        { z: L / 2, pts: U.sym([[0.3, -1], [0.8, fb + 2]]) },
      ]), M.steel, g);
      add(box(B * 0.78, 0.4, L * 0.72), M.mid, g, { y: fb + 0.2, z: -L * 0.06, edges: false });
      if (kind === "frigate") {
        add(box(B * 0.7, 9, L * 0.3), M.light, g, { y: fb + 4.5, z: L * 0.02 });
        add(box(B * 0.55, 4, L * 0.12), M.light, g, { y: fb + 11, z: L * 0.1 });
        add(box(B * 0.56, 1, L * 0.02), M.glass, g, { y: fb + 11.6, z: L * 0.16, edges: false });
        add(box(3, 12, 3), M.light, g, { y: fb + 19, z: L * 0.06 });
        add(box(5, 2.4, 3.2), M.body, g, { y: fb + 25, z: L * 0.06 });   // 箱形のレーダーの覆い
        add(box(5, 6, 8), M.light, g, { y: fb + 7, z: -L * 0.17 });     // 煙突
        add(box(B * 0.6, 6, L * 0.14), M.light, g, { y: fb + 3, z: -L * 0.3 });   // 格納庫
        add(box(5, 2.2, 6), M.light, g, { y: fb + 1.1, z: L * 0.3 });    // 砲塔
        tube(g, V(0, fb + 1.6, L * 0.32), V(0, fb + 2.2, L * 0.4), 0.4, M.dark);
        add(box(6, 1.2, 8), M.dark, g, { y: fb + 0.6, z: L * 0.22, edges: false });   // 垂直発射装置のふた
      } else {   // 揚陸艦: 前寄りの低い艦橋と長い甲板
        add(box(B * 0.8, 12, L * 0.22), M.light, g, { y: fb + 6, z: -L * 0.28 });
        add(box(B * 0.6, 1, L * 0.02), M.glass, g, { y: fb + 10.5, z: -L * 0.17, edges: false });
        add(box(3, 10, 3), M.light, g, { y: fb + 17, z: -L * 0.28 });
        add(box(6, 4, 5), M.light, g, { y: fb + 14, z: -L * 0.36 });
        add(box(B * 0.4, 1.2, L * 0.3), M.dark, g, { y: fb + 0.6, z: L * 0.15, edges: false });   // 甲板の昇降口
      }
      return g;
    };
    // 南湾の東岸の桟橋と艦
    const eastShore = (z) => 520 - (70 * (z - 190)) / 770;
    for (const [z, kind] of [[330, "frigate"], [520, "landing"], [700, "frigate"]]) {
      const x1 = eastShore(z);
      add(box(110, D.ground + 1 - D.bed, 14), M.light, world, { x: x1 - 55, y: (D.ground + 1 + D.bed) / 2, z });
      for (let i = 0; i < 5; i++) add(cyl(0.9, 1.2, 8), M.dark, world, { x: x1 - 15 - i * 22, y: D.ground + 1.6, z: z + 6 });
      ship(world, x1 - 58, z + 18, Math.PI / 2, kind === "landing" ? { L: 112, B: 15, fb: 8, kind } : {});
    }
    // 浮きドック(南湾の奥。艦を載せて浮上している)
    const fd = new THREE.Group(); fd.position.set(300, 0, 805); world.add(fd);
    add(box(44, 7, 175), M.mid, fd, { y: -1.5 });
    for (const s of [-1, 1]) {
      add(box(6, 15, 175), M.light, fd, { x: s * 19, y: 9.5 });
      for (const z of [-50, 40]) {   // 側壁の上を走る旋回クレーン
        add(box(5, 8, 5), M.body, fd, { x: s * 19, y: 21, z });
        beam(fd, V(s * 19, 24, z), V(s * 4, 26, z + 14), 1.2, M.body);
      }
    }
    ship(fd, 0, 0, 0, { y: 6.5 });

    // ── 近未来化 1: 屋根付きのシェルター型ドック(コラベリナヤ湾。前面は吊り下げの引き戸) ──
    const doors = [];
    for (const cx of D.shelters) {
      const [za, zb] = D.shZ, L = zb - za, ri = D.shW / 2, ro = ri + 3.5, y0 = 10;
      for (const s of [-1, 1]) add(box(3.5, y0 - D.bed, L), M.light, world, { x: cx + s * (ri + 1.75), y: (y0 + D.bed) / 2, z: (za + zb) / 2 });
      const rings = [];
      for (let i = 0; i <= 16; i++) {
        const th = (i / 16) * Math.PI, c = Math.cos(th), s = Math.sin(th);
        rings.push([[ri, za], [ro, za], [ro, zb], [ri, zb]].map(([r, z]) => V(cx + r * c, y0 + r * s, z)));
      }
      add(closedLoft(rings), M.body, world);
      const band = (z, w, mat) => { const rr = []; for (let i = 0; i <= 16; i++) { const th = (i / 16) * Math.PI; rr.push([[ro, z], [ro + 0.8, z], [ro + 0.8, z + w], [ro, z + w]].map(([r, zz]) => V(cx + r * Math.cos(th), y0 + r * Math.sin(th), zz))); } add(closedLoft(rr), mat, world); };
      for (const z of [za + 30, za + 75, za + 120, za + 165]) band(z, 2, M.light);   // 屋根の補強の帯
      band(za + 1, 4, M.accent);   // 前面の縁の帯(チーム色)
      add(box(2 * ro, y0 + ro, 4), M.light, world, { x: cx, y: (y0 + ro) / 2, z: zb + 2 });   // 奥の壁(陸側)
      // 前面の門型(引き戸のレール)と柱
      const BW = 2 * (2 * ri + 5);   // 開いた扉が柱の内側に収まる幅
      add(box(BW, 3, 4), M.mid, world, { x: cx, y: y0 + 21, z: za - 4 });
      for (const s of [-1, 1]) add(box(3, y0 + 21 - D.bed, 3), M.mid, world, { x: cx + s * (BW / 2 - 1.5), y: (y0 + 21 + D.bed) / 2, z: za - 4 });
      for (const s of [-1, 1]) {
        const leaf = new THREE.Group(); leaf.position.set(cx + s * (ri / 2), 0, za - 3); world.add(leaf);
        add(box(ri, y0 + 17.5 + 2, 1.6), M.steel, leaf, { y: (y0 + 17.5 - 2) / 2 });
        for (const y of [4, 12, 20]) add(box(ri - 0.4, 0.6, 2.0), M.light, leaf, { y, edges: false });
        doors.push({ leaf, x0: cx + s * (ri / 2), dx: s * (ri + 1) });
      }
    }

    // ── 近未来化 2: 無人艇専用の小桟橋群(砲兵湾の奥)と管理棟・充電柱 ──
    for (let i = 0; i < 6; i++) {
      const x = -455 + i * 21;
      add(box(4, 3, 62), M.light, world, { x, y: 1.5, z: 524 });
      for (const z of [500, 540]) add(cyl(0.6, 6, 6), M.dark, world, { x: x + 2.6, y: 3, z });
    }
    add(box(140, 3, 8), M.light, world, { x: -403, y: 1.5, z: 556 });
    add(box(30, 9, 16), M.body, world, { x: -400, y: D.ground + 4.5, z: 600 });
    add(box(30.4, 1.4, 16.4), M.accent, world, { x: -400, y: D.ground + 7.6, z: 600, edges: false });
    add(box(14, 0.8, 40), M.mid, world, { x: -330, y: 0.4, z: 540, rx: -0.12 });   // 引き上げ用の斜路

    // ── 近未来化 3: 湾口の防材(浮体を連ねた浮き障壁と網の柱。中央の門の区画が南端を軸に旋回して開く) ──
    const PR = 3.0, PL = 11, pontoonG = cyl(PR, PL, 10); pontoonG.rotateX(Math.PI / 2);   // 浮体(直径 3 m を 2 倍)
    const boomRun = (parent, x, za, zb) => {
      const n = Math.round(Math.abs(zb - za) / (PL + 1)), dz = (zb - za) / n;
      for (let i = 0; i < n; i++) {
        const z = za + dz * (i + 0.5);
        add(pontoonG, i % 2 ? M.body : M.mid, parent, { x, y: 0.6, z });
        add(box(0.5, 6, 0.5), M.dark, parent, { x, y: PR + 3, z, edges: false });   // 網の柱
      }
      add(box(0.3, 0.3, Math.abs(zb - za)), M.dark, parent, { x, y: PR + 5.8, z: (za + zb) / 2, edges: false });   // 上の索
    };
    boomRun(world, D.boomX, D.boomN + 2, D.gate[0] - 2);
    boomRun(world, D.boomX, D.gate[1] + 2, D.boomS - 2);
    const gate = new THREE.Group(); gate.position.set(D.boomX, 0, D.gate[1]); world.add(gate);
    boomRun(gate, 0, -(D.gate[1] - D.gate[0]), -1);
    add(box(9, 6, 9), M.light, world, { x: D.boomX, y: 2, z: D.gate[1] + 6 });   // 門の軸の浮き台(巻き上げ機)
    const gateBeacon = add(cyl(0.9, 1.4, 8), M.beaconOff, world, { x: D.boomX, y: 5.7, z: D.gate[1] + 6, edges: false });

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 状態: t = 0(通常: 門と扉が開)〜 1(警戒: 閉) ──
    const ease = (x) => x * x * (3 - 2 * x);
    let state = opts.state ?? "alert", t = state === "normal" ? 0 : 1, clock = 0;
    function apply() {
      const e = ease(t);
      gate.rotation.y = -OPEN * (1 - e);   // 閉: 区画は軸から北(-z)へ。開: 湾の中(+x)へ振れる
      for (const d of doors) d.leaf.position.x = d.x0 + d.dx * (1 - e);
    }
    apply();
    function update(dt) {
      clock += dt;
      if (state === "closing") { t = Math.min(1, t + dt / SEC); if (t >= 1) state = "alert"; }
      if (state === "opening") { t = Math.max(0, t - dt / SEC); if (t <= 0) state = "normal"; }
      apply();
      const moving = state === "closing" || state === "opening";
      gateBeacon.material = moving && Math.floor(clock * 3) % 2 === 0 ? M.beacon : M.beaconOff;   // 門の巻き上げ機の回転灯(動作中だけ)
      M.sea.map.offset.y -= dt * 0.04;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "normal" || s === "alert") { state = s; t = s === "alert" ? 1 : 0; apply(); }
      else if (s === "closing" || s === "opening") state = s;
    }
    function check() {
      const r1 = (v) => +v.toFixed(2), L = D.gate[1] - D.gate[0];
      const tipOpen = [D.boomX + L * Math.sin(OPEN), D.gate[1] - L * Math.cos(OPEN)];
      // 開いた門の先端と南の防波堤の先端(x -1020 ± 12、z ≥ -50)、北の防波堤の距離
      const toSouthMole = Math.hypot(Math.max(0, -1008 - tipOpen[0]), tipOpen[1] - D.boomS);
      return {
        gateGapClosed_m: [2, 2],                                                      // 閉じた門の両端と固定区画の隙間
        gateTipOpen: tipOpen.map(r1), gateSweepToSouthMole_m: r1(Math.min(D.boomS - D.gate[1], toSouthMole)),   // 門の掃く範囲と南の防波堤
        doorToPost_m: 1, postsBetweenShelters_m: r1(D.shelters[1] - D.shW - 5 - (D.shelters[0] + D.shW + 5)),   // 開いた扉と門型の柱、隣のシェルターの柱どうし
        shelterToShore_m: r1(Math.min(D.shelters[0] - (D.shW / 2 + 3.5) - (850 + (40 * (D.shZ[0] - 200)) / 440), (1100 - (40 * (D.shZ[0] - 200)) / 440) - (D.shelters[1] + D.shW / 2 + 3.5))),
      };
    }

    U.bake(THREE, group, { dynamic: [gate, ...doors.map((d) => d.leaf)], live: [M.accent], also: [M.lamp] });
    const at = (x, y, z) => V((x - XC) * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; }, get progress() { return t; },
      shots: {
        mouth: { label: "湾口(砲台・防材)", target: [-1030, 0, -300], pos: [-700, 220, 50] },
        south: { label: "南湾(司令部・艦)", target: [250, 5, 500], pos: [700, 260, 1050] },
        shelter: { label: "シェルター型ドック", target: [975, 15, 520], pos: [820, 120, 260] },
        usv: { label: "無人艇の桟橋", target: [-400, 3, 540], pos: [-250, 90, 380] },
      },
    };
  }

  DreamAssets.fac.register("sevastopol", {
    section: 1, title: "セヴァストポリ", kind: "STRATEGIC FACILITY · 1 交通・兵站",
    desc: "黒海艦隊の母港。湾口から深く切れ込んだ本湾に、南岸の小湾(砲兵湾・南湾・コラベリナヤ湾)が枝分かれする。湾口の防材、屋根付きのシェルター型ドック、無人艇の小桟橋を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/sevastopol.js"], ["大きさ", "湾口から 2.6 × 2.0 km を切り取り 0.06 倍 × 表示 3.0"], ["誇張", "陸の高さ 2 倍(岸壁 +6 m、丘 最高 +52 m)、防材の浮体の太さ 2 倍。平面は実寸比"], ["省略", "小型艇・車両・小さな機械。艦艇はフリゲート級以上だけ"], ["現状", "攻撃を受けた艦隊司令部(崩れた棟)、桟橋と浮きドックの艦"], ["近未来化", "湾口の防材、シェルター型ドック 2 棟、無人艇の小桟橋群"]],
    dist: 1000, target: 20, tokenAt: [380, 0, 300],
    make: (THREE) => sevastopol(THREE, { r: 105 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["通常", () => a.setState("normal"), () => a.state === "normal"], ["警戒 ▶", () => a.setState("closing"), () => a.state === "closing"], ["警戒", () => a.setState("alert"), () => a.state === "alert"], ["◀ 解除", () => a.setState("opening"), () => a.state === "opening"]],
    caption: (a) => (a.state === "closing" ? "警戒へ — 防材の門を閉じ、シェルターの扉を閉める" : a.state === "opening" ? "警戒解除 — 防材の門を開く" : ""),
    ringParts: (a) => [a.parts.ring, a.parts.disc],
  });
})();
