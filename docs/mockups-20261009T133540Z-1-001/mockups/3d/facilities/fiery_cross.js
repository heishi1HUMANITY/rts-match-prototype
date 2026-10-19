// 戦略施設トークン「ファイアリー・クロス礁(永暑礁)」(南シナ海の埋め立て人工島)の詳細版モデル(試作)。
// 島全体(長さ約 3.3 km、滑走路 約 3100 m)を平面は実寸の比率で入れる(縮尺 K = 0.065)。
// モデルの決め手: 島いっぱいに延びる滑走路。島と滑走路は実寸の比率のまま、建物(格納庫・庁舎・レドーム・灯台など)の高さを 2 倍、滑走路の標示の幅を 3 倍に誇張。
// 近未来化(施設リストの案): 浮体式の拡張モジュールで島を増築していく姿。状態 "current"(現在)→ "expanding"(5 基のモジュールが沖から順に寄って接岸)→ "expanded"。
// 島の外形・建物の配置は公開の衛星写真の印象からの概略(実測ではない)。
// 省略: 艦船・航空機・車両・人・クレーンなどの小さな機械(実寸では小さすぎる)。モジュールを曳く船も省略。
// 座標: m。滑走路は x 方向、+z が北。
(function () {
  const K = 0.065, EXH = 2;
  const D = { base: -40, bed: -38, land: 4, xw: 1750, zw: 650, rwZ: -180, rwW: 60, twZ: -90, twW: 25, modZ: [318, 488], modW: 300, approach: 150, SEC: 12 };
  const OUTLINE = [[-1650, -230], [1650, -230], [1700, -150], [1620, -40], [1350, 80], [1250, 450], [1030, 480], [1030, 400], [1150, 360], [1150, 120], [800, 120], [800, 380], [930, 420], [930, 495], [700, 520], [400, 300], [-1250, 300], [-1600, 120], [-1700, -100]];
  const REEF = [[-1740, -420], [1740, -420], [1740, 40], [1520, 280], [1420, 580], [1000, 610], [600, 600], [420, 300], [-1270, 300], [-1700, 210], [-1740, 0]];
  const MOD_X = [-1100, -780, -460, -140, 180];

  function fieryCross(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 122;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE, { repeat: [1, 1] }); M.sea.side = THREE.DoubleSide;
    const group = new THREE.Group(); group.name = "fiery_cross";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const { add, box, cyl, V, prism, tube, lattice, closedLoft, waterShape } = F.kit(THREE, M, K);
    const L = D.land, flat = (w, d, mat, parent, x, y, z, o = {}) => add(box(w, 0.06, d), mat, parent, { x, y, z, edges: false, ...o });
    // かまぼこ形の屋根の格納庫(幅 w、奥行 d、壁の高さ hw、屋根の高さ ha。高さは EXH 倍済みで渡す)。扉は -z 側
    const hangar = (parent, x, z, w, d, hw, ha, y0 = L) => {
      add(box(w, hw, d), M.light, parent, { x, y: y0 + hw / 2, z });
      const arch = (zz) => Array.from({ length: 9 }, (_, i) => { const a = (Math.PI * i) / 8; return V(x - (w / 2) * Math.cos(a), y0 + hw + ha * Math.sin(a), zz); });
      add(closedLoft([arch(z - d / 2), arch(z + d / 2)]), M.body, parent);
      add(box(w * 0.82, hw + ha * 0.55, 0.6), M.dark, parent, { x, y: y0 + (hw + ha * 0.55) / 2, z: z - d / 2 - 0.3, edges: false });
    };

    // ── 海: 深い海底、礁原(浅瀬)、水面、水の切り口、足元の暗い帯 ──
    add(box(2 * D.xw, D.bed - D.base, 2 * D.zw), M.mid, world, { y: (D.base + D.bed) / 2, edges: false });
    add(prism(REEF, D.bed, -3), M.light, world);
    const seaRect = [[-D.xw, -D.zw], [D.xw, -D.zw], [D.xw, D.zw], [-D.xw, D.zw]];
    world.add(waterShape(seaRect, M.sea));
    world.add(new THREE.Mesh(U.merge(THREE, [[new THREE.PlaneGeometry(2 * D.xw, -D.bed), { y: D.bed / 2, z: -D.zw }], [new THREE.PlaneGeometry(2 * D.xw, -D.bed), { y: D.bed / 2, z: D.zw }], [new THREE.PlaneGeometry(2 * D.zw, -D.bed), { x: -D.xw, y: D.bed / 2, ry: Math.PI / 2 }], [new THREE.PlaneGeometry(2 * D.zw, -D.bed), { x: D.xw, y: D.bed / 2, ry: Math.PI / 2 }]]), M.waterCut));
    F.plinth({ add, box }, M, world, 2 * D.xw, 2 * D.zw, D.base);

    // ── 島: 埋め立ての地盤と外周の護岸 ──
    add(prism(OUTLINE, D.bed, L), M.land, world);
    const area = OUTLINE.reduce((a, [x0, z0], i) => { const [x1, z1] = OUTLINE[(i + 1) % OUTLINE.length]; return a + x0 * z1 - x1 * z0; }, 0), sg = Math.sign(area);
    OUTLINE.forEach(([x0, z0], i) => {
      const [x1, z1] = OUTLINE[(i + 1) % OUTLINE.length], len = Math.hypot(x1 - x0, z1 - z0), ry = -Math.atan2(z1 - z0, x1 - x0);
      const nx = (sg * (z1 - z0)) / len, nz = (-sg * (x1 - x0)) / len;   // 外向きの法線
      add(box(len + 5, 2.5, 6), M.light, world, { x: (x0 + x1) / 2, y: L + 1.25, z: (z0 + z1) / 2, ry });
      if (len > 60) add(box(len - 10, 5, 14), M.mid, world, { x: (x0 + x1) / 2 + nx * 9, y: -1.5, z: (z0 + z1) / 2 + nz * 9, ry });   // 波消しブロックの帯(水際)
    });

    // ── 滑走路(島いっぱい)・誘導路・駐機場(標示の幅は 3 倍) ──
    add(box(3150, 0.2, D.rwW + 16), M.light, world, { y: L + 0.1, z: D.rwZ, edges: false });
    add(box(3120, 0.4, D.rwW), M.mid, world, { y: L + 0.2, z: D.rwZ });
    const mk = L + 0.43;
    for (const s of [-1, 1]) flat(3100, 2.4, M.body, world, 0, mk, D.rwZ + s * (D.rwW / 2 - 2.5));
    for (let x = -1400; x <= 1400; x += 80) flat(45, 2.7, M.body, world, x, mk, D.rwZ);
    for (const e of [-1, 1]) {
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) flat(45, 4.5, M.body, world, e * 1505, mk, D.rwZ + s * (5 + i * 6.5));
      for (const s of [-1, 1]) flat(60, 11, M.body, world, e * 1150, mk, D.rwZ + s * 12);
    }
    for (const e of [-1, 1]) add(box(40, 0.3, D.rwW + 10), M.light, world, { x: e * 1585, y: L + 0.15, z: D.rwZ, edges: false });   // 過走帯
    for (const e of [-1, 1]) for (let i = 0; i < 6; i++) add(box(4, 0.5, 40 - i * 4), M.body, world, { x: e * (1573 - i * 8) , y: L + 0.35, z: D.rwZ, edges: false, ry: 0 });
    add(box(2950, 0.3, D.twW), M.mid, world, { y: L + 0.15, z: D.twZ });
    for (const x of [-1450, -800, -100, 600, 1300]) add(box(D.twW, 0.3, D.twZ - D.rwZ - D.rwW / 2 - D.twW / 2 + 10), M.mid, world, { x, y: L + 0.15, z: (D.twZ - D.twW / 2 + D.rwZ + D.rwW / 2) / 2 });
    add(box(1300, 0.25, 62), M.light, world, { x: -90, y: L + 0.12, z: -46 });

    // ── 格納庫: 戦闘機用 10 棟と大型 4 棟(高さ 2 倍) ──
    for (let i = 0; i < 10; i++) hangar(world, -690 + i * 68, -46, 28, 45, 4 * EXH, 7 * EXH);
    for (let i = 0; i < 4; i++) hangar(world, 80 + i * 110, -44, 80, 56, 6 * EXH, 12 * EXH);

    // ── 庁舎・宿舎の区画(高さ 2 倍)、道路 ──
    for (const [x, z, w, d] of [[-1050, 150, 520, 10], [-1050, 20, 520, 10], [-1050, 140, 10, 250], [-300, 120, 1300, 12], [600, 100, 12, 380]]) add(box(w, 0.12, d), M.mid, world, { x, y: L + 0.06, z, edges: false });
    const BLD = [[-1220, 70, 90, 25, 14], [-1080, 70, 90, 25, 14], [-940, 70, 90, 25, 14], [-1220, 210, 70, 40, 18], [-1060, 220, 120, 30, 22, true], [-900, 200, 60, 60, 10], [-1250, -10, 60, 30, 10], [-860, -10, 80, 30, 10]];
    for (const [x, z, w, d, h, hq] of BLD) {
      const H = h * EXH;
      add(box(w, H, d), M.body, world, { x, y: L + H / 2, z });
      for (let f = 1; f < h / 3.5; f++) add(box(w + 0.3, 1.4 * EXH * 0.5, d + 0.3), M.glass, world, { x, y: L + (f * 3.5 - 1.6) * EXH, z, edges: false });
      add(box(w * 0.3, 2.4 * EXH, d * 0.4), M.mid, world, { x: x - w * 0.2, y: L + H + 1.2 * EXH, z });
      if (hq) { add(box(w + 0.8, 1.2, d + 0.8), M.accent, world, { x, y: L + H - 1, z, edges: false }); tube(world, V(x + w * 0.3, L + H, z), V(x + w * 0.3, L + H + 30 * EXH, z), 0.8, M.dark); }
    }
    for (let i = 0; i < 6; i++) for (const z of [60, 120]) {   // 宿舎(長屋、高さ 2 倍)
      const x = -760 + i * 70;
      add(box(52, 10 * EXH, 16), M.light, world, { x, y: L + 5 * EXH, z });
      add(closedLoft([[V(x - 27, L + 10 * EXH, z - 9), V(x - 27, L + 10 * EXH + 6, z), V(x - 27, L + 10 * EXH, z + 9)], [V(x + 27, L + 10 * EXH, z - 9), V(x + 27, L + 10 * EXH + 6, z), V(x + 27, L + 10 * EXH, z + 9)]]), M.mid, world);
      for (const y of [3, 7, 11, 15]) add(box(52.3, 1.4, 16.3), M.glass, world, { x, y: L + y, z, edges: false });
    }
    // 植樹(道路と宿舎のまわり。インスタンス 1 つ、高さ 2 倍)
    {
      const rng = U.rng(5), at = [];
      for (let x = -1290; x <= 560; x += 26) at.push([x, 104 + (rng() - 0.5) * 6], [x, 136 + (rng() - 0.5) * 6]);
      for (let z = 30; z <= 270; z += 24) at.push([-1040 + (rng() - 0.5) * 6, z], [-1060 + (rng() - 0.5) * 6, z]);
      for (let i = 0; i < 60; i++) at.push([-1300 + rng() * 300, 260 + rng() * 25]);
      const tg = U.concat(THREE, [{ geo: new THREE.IcosahedronGeometry(6, 0).scale(1, EXH * 0.8, 1).translate(0, 9 * EXH, 0), color: new THREE.Color(0xb8c6b0) }, { geo: cyl(0.8, 6 * EXH, 4).translate(0, 3 * EXH, 0).toNonIndexed(), color: M.mid.color }]);
      const im = new THREE.InstancedMesh(tg, U.vcLambert(THREE), at.length), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(1, 1, 1);
      at.forEach(([x, z], i) => { const k = 0.8 + rng() * 0.4; mt.compose(V(x, L, z), q, sc.set(k, k, k)); im.setMatrixAt(i, mt); });
      world.add(im);
    }
    // ── レーダー: レドーム 3 基、箱形の大型レーダー、格子の通信塔 ──
    for (const x of [-560, -440, -320]) {
      add(cyl(9, 6 * EXH, 14), M.light, world, { x, y: L + 3 * EXH, z: 200 });
      add(new THREE.SphereGeometry(10 * EXH, 16, 12), M.body, world, { x, y: L + 6 * EXH + 8 * EXH, z: 200 });
    }
    add(box(40, 25 * EXH, 14), M.light, world, { x: -160, y: L + 12.5 * EXH, z: 220 });
    add(box(34, 20 * EXH, 0.8), M.dark, world, { x: -160, y: L + 12.5 * EXH, z: 212.6, edges: false });
    lattice(world, V(40, L, 240), 70 * EXH, 7, 1.6, 6, 1.0);
    lattice(world, V(-1500, L, 40), 50 * EXH, 6, 1.4, 5, 0.9);
    // ── 燃料・水のタンク、太陽光発電 ──
    for (const [x, z] of [[320, 160], [380, 160], [440, 160], [320, 230], [380, 230], [440, 230]]) { add(cyl(22, 14 * EXH, 16), M.body, world, { x, y: L + 7 * EXH, z }); add(cyl(22.4, 1.2, 16), M.light, world, { x, y: L + 14 * EXH + 0.4, z }); }
    for (let i = 0; i < 9; i++) add(box(330, 0.5, 7), M.glass, world, { x: 1170, y: L + 2, z: -50 + i * 12, rx: -0.35 });
    // ── 港(島の内側の泊地。北の水路から出入り)と桟橋 ──
    for (const x of [900, 1060]) add(box(18, 3, 150), M.light, world, { x, y: L - 1.5, z: 200 });
    // ── 灯台(港口の東。高さ 2 倍。灯台は点滅してよい) ──
    const ltX = 1210, ltZ = 390, ltH = 50 * EXH;
    const oct = (r, y) => Array.from({ length: 8 }, (_, i) => V(ltX + r * Math.cos((i * Math.PI) / 4), y, ltZ + r * Math.sin((i * Math.PI) / 4)));
    add(closedLoft([oct(8, L), oct(4.5, L + ltH)]), M.body, world);
    add(cyl(5.5, 2, 8), M.accent, world, { x: ltX, y: L + ltH + 1, z: ltZ, edges: false });
    add(cyl(4, 8, 8), M.glass, world, { x: ltX, y: L + ltH + 6, z: ltZ });
    add(new THREE.ConeGeometry(5, 4, 8), M.dark, world, { x: ltX, y: L + ltH + 12, z: ltZ });
    const beam = add(new THREE.SphereGeometry(4.6, 8, 6), M.beaconOff, world, { x: ltX, y: L + ltH + 6, z: ltZ, edges: false });

    // ── 近未来化: 浮体式の拡張モジュール 5 基(北側に接岸。300 × 170 m、甲板は島と同じ高さ) ──
    const mods = MOD_X.map((xc, i) => {
      const g = new THREE.Group(); g.position.set(xc, 0, (D.modZ[0] + D.modZ[1]) / 2); world.add(g);
      const w = D.modW, d = D.modZ[1] - D.modZ[0];
      add(box(w, 12, d), M.light, g, { y: -2 });
      add(box(w + 0.6, 1.8, d + 0.6), M.dark, g, { y: 0.4, edges: false });
      add(box(w + 0.8, 0.8, d + 0.8), M.accent, g, { y: 3.2, edges: false });
      add(box(w - 4, 0.3, d - 4), M.mid, g, { y: 4.15 });
      for (const x of [-90, 90]) add(box(36, 1, 16), M.dark, g, { x, y: 3.5, z: -d / 2 - 8 });   // 島との連絡橋
      if (i === 0) { hangar(g, -70, 10, 28, 45, 4 * EXH, 7 * EXH, 4.3); hangar(g, 0, 10, 28, 45, 4 * EXH, 7 * EXH, 4.3); hangar(g, 70, 10, 28, 45, 4 * EXH, 7 * EXH, 4.3); }
      if (i === 1) for (let r = 0; r < 10; r++) add(box(270, 0.5, 7), M.glass, g, { y: 6, z: -70 + r * 15, rx: -0.35 });
      if (i === 2) {
        for (const x of [-90, 0, 90]) { add(cyl(26, 0.4, 20), M.light, g, { x, y: 4.5, z: -10 }); add(box(22, 0.1, 3), M.body, g, { x, y: 4.75, z: -10, edges: false }); for (const s of [-1, 1]) add(box(3, 0.1, 22), M.body, g, { x: x + s * 9, y: 4.75, z: -10, edges: false }); }
        add(box(80, 6 * EXH, 30), M.body, g, { x: 60, y: 4.3 + 3 * EXH, z: 60 });
      }
      if (i === 3) {
        add(cyl(9, 6 * EXH, 14), M.light, g, { x: -60, y: 4.3 + 3 * EXH, z: 20 });
        add(new THREE.SphereGeometry(10 * EXH, 16, 12), M.body, g, { x: -60, y: 4.3 + 14 * EXH, z: 20 });
        lattice(g, V(70, 4.3, 0), 45 * EXH, 6, 1.4, 4, 0.9);
        add(box(10, 6, 4), M.light, g, { x: 70, y: 4.3 + 45 * EXH + 3, z: 0 });
      }
      if (i === 4) {
        for (const x of [-100, -40, 20]) add(cyl(22, 12 * EXH, 16), M.body, g, { x, y: 4.3 + 6 * EXH, z: -20 });
        add(box(90, 8 * EXH, 40), M.light, g, { x: 90, y: 4.3 + 4 * EXH, z: 30 });
        for (const y of [10, 14]) add(box(160, 2.5, 2.5), M.mid, g, { x: 10, y: 4.3 + y, z: 50 });
      }
      return g;
    });

    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    let state = opts.state ?? "current", t = state === "expanded" ? 1 : 0, clock = 0;
    const ease = (x) => x * x * (3 - 2 * x);
    const prog = (i, tt) => Math.max(0, Math.min(1, (tt - i * 0.16) / 0.36));   // モジュール i の寄り具合(順に重なって寄る)
    function apply() {
      mods.forEach((g, i) => { const p = prog(i, t); g.visible = p > 0; g.position.z = (D.modZ[0] + D.modZ[1]) / 2 + (1 - ease(p)) * D.approach; });
    }
    U.bake(THREE, group, { dynamic: mods, live: [M.accent] });
    apply();
    function update(dt) {
      clock += dt;
      if (state === "expanding") { t = Math.min(1, t + dt / D.SEC); if (t >= 1) state = "expanded"; apply(); }
      beam.material = Math.floor(clock * 1.25) % 3 === 0 ? M.beacon : M.beaconOff;   // 灯台の閃光
      M.sea.map.offset.y -= dt * 0.03;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "current") { state = s; t = 0; } else if (s === "expanded") { state = s; t = 1; } else if (s === "expanding") { if (t >= 1) t = 0; state = s; }
      apply();
    }
    const check = () => ({
      moduleDockGap_m: D.modZ[0] - 303,                                  // 接岸したモジュールと護岸の外面(連絡橋で渡す)
      moduleApproachToBaseEdge_m: D.zw - (D.modZ[1] + D.approach),       // 沖から寄るときの最も遠い位置と台座の端
      moduleSpacing_m: MOD_X[1] - MOD_X[0] - D.modW,                     // モジュールどうしの隙間
      moduleHullBottom_m: -8, reefTopUnderModules: "なし(礁原はモジュールの範囲の外)",   // 船体の底(礁原 -3 m の上には来ない)
      runwayLength_m: 3120,
    });
    return {
      group, update, setState, check, stats: () => U.stats(group), parts: { ring, disc },
      setTeam: (c) => F.setTeam(M, c), get state() { return state; }, get progress() { return t; },
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        hangars: { label: "格納庫と滑走路", target: [-200, 10, -60], pos: [100, 250, -600] },
        harbor: { label: "港と灯台", target: [1050, 20, 300], pos: [1450, 220, 650] },
        radar: { label: "庁舎とレドーム", target: [-700, 20, 150], pos: [-300, 260, 520] },
        modules: { label: "拡張モジュール", target: [-460, 10, 400], pos: [-100, 320, 900] },
      },
    };
  }

  DreamAssets.fac.register("fiery_cross", {
    section: 3, title: "ファイアリー・クロス礁", kind: "STRATEGIC FACILITY · 3 海峡・島",
    desc: "南シナ海の埋め立て人工島(永暑礁)。島いっぱいに延びる約 3000 m の滑走路、格納庫の列、港、レドーム。近未来版は北側に浮体式の拡張モジュールを接岸して島を増築していく",
    info: [["ファイル", "mockups/3d/facilities/fiery_cross.js"], ["大きさ", "島の全体 約 3.4 × 0.75 km を含む 3.5 × 1.3 km を 0.065 倍 × 表示 3.0"], ["誇張", "建物・格納庫・レドーム・灯台の高さ 2 倍、滑走路の標示の幅 3 倍。島と滑走路の平面は実寸"], ["省略", "艦船・航空機・車両・人・クレーン、モジュールを曳く船"], ["状態", "現在 / 増築中(モジュールが順に接岸、12 秒)/ 増築後"], ["注意", "島の外形と建物の配置は衛星写真からの概略"]],
    dist: 1250, target: 15, tokenAt: [440, 0, 330],
    make: (THREE) => fieryCross(THREE),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["現在", () => a.setState("current"), () => a.state === "current"], ["増築 ▶", () => a.setState("expanding"), () => a.state === "expanding"], ["増築後(近未来)", () => a.setState("expanded"), () => a.state === "expanded"]],
    caption: (a) => (a.state === "expanding" ? "増築中 — 浮体式モジュールが沖から寄って接岸" : ""),
  });
})();
