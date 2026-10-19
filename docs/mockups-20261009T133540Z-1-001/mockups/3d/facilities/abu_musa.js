// 戦略施設トークン「アブー・ムーサー島・大小トンブ島」(ホルムズ海峡)の詳細版モデル(試作)。
// 3 島のうち滑走路と港と駐屯地のあるアブー・ムーサー島(約 3.7 km)を代表として入れる(大小トンブ島は数十 km 離れていて同じ台座に入らないので省略)。平面は実寸の比率(縮尺 K = 0.04)。
// モデルの決め手: 小さな島に不釣り合いな滑走路と、周囲を通るタンカー。滑走路の幅 3 倍(色も濃く)、タンカー 1.5 倍、建物の高さ 2 倍、ハルヴァ山の高さ 1.5 倍に誇張。
// ゲーム視点(北から見下ろす)で航路が手前に来るよう、全体を 180° 回して置く(座標は北が +z のまま書く)。
// 近未来化(施設リストの案): 無人艇の格納庫とスロープ、レーダー塔を増設した「無人機の島」。有人の建物は駐屯地だけにした。
// 動き: 分離通航帯を東西に行き交うタンカー 2 隻(実物の 8 倍ほどの速さ。台座の端で反対側へ戻る)。
// 簡略化: 航路までの距離を縮めた(実物は 10 km 以上)。島の外形と滑走路の長さ・向きは概略。省略: 町の家・車両・人・無人艇そのもの(実寸では小さすぎる)。
// 座標: m。+z が北。島の中心は (0, 300)。台座は半径 2750 m の円い海。
(function () {
  const K = 0.04, EXH = 2, TK = 1.5;
  const D = { base: -32, bed: -30, shelf: -6, sand: 2, land: 5, R0: 2750, cz: 300, lanes: [-2050, -2380], range: 1040, speed: 70 };
  const RADII = [1900, 1750, 1650, 1800, 2000, 1850, 1700, 1600, 1750, 1900, 2050, 1950];
  const islandR = (a) => { const f = ((((a / (2 * Math.PI)) % 1) + 1) % 1) * 12, i = Math.floor(f), t = f - i, w = (1 - Math.cos(Math.PI * t)) / 2; return RADII[i % 12] * (1 - w) + RADII[(i + 1) % 12] * w; };
  const outline = (s = 1) => Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * 2 * Math.PI, r = islandR(a) * s; return [r * Math.sin(a), D.cz + r * Math.cos(a)]; });
  const HALVA = { x: -300, z: -500, r: 620, h: 110 * 1.5 };
  const RW = { x: 250, z: 450, ry: 0.55, len: 2300, w: 45 * 3 };

  function abuMusa(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 114;
    const M = F.mats(THREE);
    M.asphalt = M.lambert(0x9aa3ab); M.sand = M.lambert(0xe6dfcf); M.rock = M.lambert(0xd2cabb, { flatShading: true });
    M.sea = U.waterMaterial(THREE); M.sea.side = THREE.DoubleSide;
    const group = new THREE.Group(); group.name = "abu_musa";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); world.rotation.y = Math.PI; group.add(world);
    const { add, box, cyl, V, prism, tube, lattice, closedLoft, waterShape } = F.kit(THREE, M, K);
    const rng = U.rng(31);
    const flat = (w, d, mat, parent, x, y, z, o = {}) => add(box(w, 0.08, d), mat, parent, { x, y, z, edges: false, ...o });

    // ── 円い海: 海底、島の周りの浅瀬、水面、水の切り口、足元の暗い帯 ──
    add(cyl(D.R0, D.bed - D.base, 72), M.mid, world, { y: (D.base + D.bed) / 2, edges: false });
    add(cyl(D.R0 + 30, 1.2, 72), M.dark, world, { y: D.base + 0.6 - 0.01, edges: false });
    add(prism(outline(1.18), D.bed, D.shelf), M.light, world);
    world.add(waterShape(Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * 2 * Math.PI; return [D.R0 * Math.sin(a), D.R0 * Math.cos(a)]; }), M.sea));
    world.add(new THREE.Mesh(new THREE.CylinderGeometry(D.R0, D.R0, -D.bed, 72, 1, true).translate(0, D.bed / 2, 0), M.waterCut));

    // ── 島: 砂浜の縁と平らな陸、ハルヴァ山(高さ 2 倍) ──
    add(prism(outline(1), D.bed, D.sand), M.sand, world);
    const inner = outline(0.94).map(([x, z]) => [x, D.cz + (z - D.cz)]);
    add(prism(inner, D.sand - 0.5, D.land), M.land, world);
    const hg = new THREE.CylinderGeometry(70, HALVA.r, HALVA.h, 14, 3).toNonIndexed();
    { const p = hg.attributes.position; const jit = new Map(); for (let i = 0; i < p.count; i++) { const key = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`; if (!jit.has(key)) jit.set(key, p.getY(i) > -HALVA.h / 2 + 1 ? [(rng() - 0.5) * 70, (rng() - 0.5) * 25, (rng() - 0.5) * 70] : [0, 0, 0]); const [jx, jy, jz] = jit.get(key); p.setXYZ(i, p.getX(i) + jx, p.getY(i) + jy, p.getZ(i) + jz); } hg.computeVertexNormals(); }
    add(hg, M.rock, world, { x: HALVA.x, y: D.land + HALVA.h / 2 - 2, z: HALVA.z, edges: false });   // 岩肌の凹凸に線を引くと乱れるので輪郭線なし

    // ── 滑走路(幅 2 倍)・誘導路・小さな駐機場と管理棟 ──
    const rw = new THREE.Group(); rw.position.set(RW.x, D.land, RW.z); rw.rotation.y = RW.ry; world.add(rw);
    add(box(RW.len + 40, 0.3, RW.w + 30), M.light, rw, { y: 0.15, edges: false });
    add(box(RW.len, 0.6, RW.w), M.asphalt, rw, { y: 0.3 });
    for (let x = -RW.len / 2 + 200; x <= RW.len / 2 - 200; x += 100) flat(60, 4.5, M.body, rw, x, 0.62, 0);
    for (const s of [-1, 1]) flat(RW.len - 20, 4.5, M.body, rw, 0, 0.62, s * (RW.w / 2 - 5));
    for (const e of [-1, 1]) for (const s of [-1, 1]) for (let i = 0; i < 5; i++) flat(50, 7, M.body, rw, e * (RW.len / 2 - 50), 0.62, s * (10 + i * 12));
    add(box(900, 0.4, 40), M.mid, rw, { x: 200, y: 0.2, z: -170 });
    for (const x of [-200, 600]) add(box(40, 0.4, 110), M.mid, rw, { x, y: 0.2, z: -110 });
    add(box(260, 0.4, 140), M.light, rw, { x: 300, y: 0.2, z: -260 });
    add(box(90, 9 * EXH, 30), M.body, rw, { x: 300, y: 4.5 * EXH, z: -350 });
    add(box(90.4, 2, 30.4), M.glass, rw, { x: 300, y: 5 * EXH, z: -350, edges: false });
    add(box(8, 22 * EXH, 8), M.light, rw, { x: 380, y: 11 * EXH, z: -355 });
    add(new THREE.CylinderGeometry(9, 7, 6 * EXH, 8), M.glass, rw, { x: 380, y: 22 * EXH + 3 * EXH, z: -355 });

    // 島の道路(港・駐屯地・空港・格納庫を結ぶ)
    const road = (pts) => pts.slice(1).forEach(([x1, z1], i) => { const [x0, z0] = pts[i], len = Math.hypot(x1 - x0, z1 - z0); add(box(len + 16, 0.3, 16), M.mid, world, { x: (x0 + x1) / 2, y: D.land + 0.15, z: (z0 + z1) / 2, ry: -Math.atan2(z1 - z0, x1 - x0), edges: false }); });
    road([[300, 2080], [200, 1600], [-340, 1150]]);
    road([[200, 1600], [900, 900], [1350, 100], [1350, -250], [600, -300], [360, -900], [180, -1180]]);   // 滑走路の北東端を回る
    road([[600, -300], [430, -110]]);
    road([[-660, 1150], [-1250, 650]]);
    // ── 駐屯地(有人の建物は最小限。塀・宿舎・本部・ヘリパッド、高さ 2 倍) ──
    const gx = -500, gz = 1150, gw = 320;
    for (const [x, z, w, d] of [[0, -gw / 2, gw, 4], [0, gw / 2, gw, 4], [-gw / 2, 0, 4, gw], [gw / 2, 0, 4, gw]]) add(box(w, 4 * EXH, d), M.light, world, { x: gx + x, y: D.land + 2 * EXH, z: gz + z });
    for (let i = 0; i < 6; i++) add(box(70, 6 * EXH, 18), M.body, world, { x: gx - 80 + (i % 2) * 120, y: D.land + 3 * EXH, z: gz - 110 + Math.floor(i / 2) * 60 });
    add(box(80, 10 * EXH, 40), M.body, world, { x: gx + 60, y: D.land + 5 * EXH, z: gz + 110 });
    add(box(80.4, 1.6, 40.4), M.accent, world, { x: gx + 60, y: D.land + 10 * EXH - 1, z: gz + 110, edges: false });
    add(cyl(30, 0.6, 20), M.light, world, { x: gx - 60, y: D.land + 0.3, z: gz + 100 });
    flat(30, 4, M.dark, world, gx - 60, D.land + 0.65, gz + 100); flat(4, 30, M.dark, world, gx - 60, D.land + 0.65, gz + 100);
    tube(world, V(gx + 60, D.land + 10 * EXH, gz + 110), V(gx + 60, D.land + 10 * EXH + 40, gz + 110), 1.5, M.dark);

    // ── 港(北岸の防波堤と岸壁) ──
    add(box(30, 9, 360), M.light, world, { x: 460, y: 0.5, z: 2280 });
    add(box(320, 9, 30), M.light, world, { x: 315, y: 0.5, z: 2445 });
    add(box(260, 7, 50), M.light, world, { x: 300, y: 1.5, z: 2120 });

    // ── 近未来化: 無人艇の格納庫 3 棟とスロープ(南岸、航路に面する)、太陽光、レーダー塔 ──
    for (const x of [0, 180, 360]) {
      add(box(120, 10 * EXH, 80), M.body, world, { x, y: D.land + 5 * EXH, z: -1230 });
      add(box(121, 1.6, 81), M.accent, world, { x, y: D.land + 10 * EXH - 2, z: -1230, edges: false });
      add(box(90, 7 * EXH, 0.8), M.dark, world, { x, y: D.land + 3.5 * EXH, z: -1270.5, edges: false });
      const a = Math.atan2(D.land + 4.5, 240);
      add(box(46, 2, 242), M.mid, world, { x, y: (D.land - 4.5) / 2 - 1, z: -1270 - 120, rx: -a });   // 水へ下りるスロープ
    }
    for (let i = 0; i < 8; i++) add(box(300, 1, 10), M.glass, world, { x: 700, y: D.land + 2.5, z: -950 + i * 18, rx: -0.35 });
    for (let i = 0; i < 4; i++) add(box(12.2, 2.6 * EXH, 2.44 * 2), M.light, world, { x: 560 + i * 16, y: D.land + 2.6, z: -1080 });
    const radar = (x, y, z, h) => { lattice(world, V(x, y, z), h, 9, 2.4, 6, 1.4); add(box(16, 10, 8), M.body, world, { x, y: y + h + 5, z }); add(box(6, 5, 6), M.dark, world, { x: x + 6, y: y + h + 12.5, z }); };
    radar(HALVA.x, D.land + HALVA.h - 14, HALVA.z, 60 * EXH);
    radar(1200, D.land, 900, 50 * EXH);
    radar(-1300, D.land, 600, 50 * EXH);

    // ── タンカー(VLCC 330 × 60 m を 1.5 倍)2 隻: 分離通航帯の東行き・西行き ──
    const tanker = () => {
      const g = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(TK); g.add(body);
      const B = { "-165": 25, "-150": 29, "120": 30, "150": 22, "165": 6 }, Z = [-165, -150, 120, 150, 165];
      add(U.loft(THREE, Z.map((z) => ({ z, pts: U.sym([[B[z] * 0.78, -8], [B[z], 1]]) }))), M.dark, body);
      add(U.loft(THREE, Z.map((z) => ({ z, pts: U.sym([[B[z], 1], [B[z], z > 140 ? 12.5 : 10]]) }))), M.light, body);
      add(box(40, 3, 30), M.light, body, { y: 11.5, z: 138 });
      add(box(3, 1.5, 250), M.mid, body, { y: 10.75, z: 0 });
      add(box(1.6, 0.4, 250), M.dark, body, { x: 6, y: 12.6, z: 0, edges: false });
      add(box(52, 2, 4), M.mid, body, { y: 11, z: 0 });
      for (const s of [-1, 1]) tube(body, V(s * 14, 10, 4), V(s * 14, 22, 4), 0.6, M.mid);
      add(box(46, 20, 22), M.body, body, { y: 20, z: -138 });
      for (const y of [14, 18, 22, 26]) add(box(46.3, 1.2, 22.3), M.glass, body, { y, z: -138, edges: false });
      add(box(58, 3.5, 10), M.body, body, { y: 31.6, z: -132 });
      add(box(58.3, 1.4, 10.3), M.glass, body, { y: 32, z: -132, edges: false });
      add(box(10, 16, 12), M.body, body, { y: 38, z: -152 });
      add(box(10.3, 2, 12.3), M.dark, body, { y: 45, z: -152, edges: false });
      tube(body, V(0, 33, -134), V(0, 46, -134), 0.4, M.dark);
      world.add(g); return g;
    };
    const ships = D.lanes.map((z, i) => { const g = tanker(); g.position.set(i ? -600 : 500, 0, z); g.rotation.y = i ? Math.PI / 2 : -Math.PI / 2; return { g, dir: i ? 1 : -1 }; });

    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);
    U.bake(THREE, group, { dynamic: ships.map((s) => s.g), live: [M.accent] });

    let traffic = true;
    function update(dt) {
      if (traffic) for (const s of ships) { let x = s.g.position.x + s.dir * D.speed * dt; if (x > D.range) x -= 2 * D.range; if (x < -D.range) x += 2 * D.range; s.g.position.x = x; }
      M.sea.map.offset.y -= dt * 0.02;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    const check = () => {
      const r1 = (v) => +v.toFixed(1), half = 165 * TK, beam = 30 * TK;
      const islandSouth = Math.min(...outline(1.18).map(([, z]) => z));
      const inBase = Math.min(...D.lanes.map((z) => Math.sqrt(D.R0 ** 2 - (z - beam) ** 2) - (D.range + half)));
      const hx = Math.min(...[0, 180, 360].map((x) => Math.hypot(x - HALVA.x, -1190 - HALVA.z) - HALVA.r));
      return {
        tankerToShelf_m: r1(islandSouth - (D.lanes[0] + beam)),       // 北側の航路のタンカーの舷側と島の浅瀬の端
        tankerCornerInsideBase_m: r1(inBase),                          // 航路の端でも船体の角が台座の円の内側に残る余裕
        laneSeparation_m: D.lanes[0] - D.lanes[1] - 2 * beam,          // 2 隻の舷側の間
        slipwayEndOverShelf_m: -4.5 - D.shelf,                         // スロープの先端(水面下)と浅瀬の上面
        hangarToHalvaFoot_m: r1(hx),                                   // 格納庫とハルヴァ山の裾
        runwayWidth_m: RW.w, halvaHeight_m: HALVA.h,
      };
    };
    return {
      group, update, check, stats: () => U.stats(group), parts: { ring, disc },
      setTeam: (c) => F.setTeam(M, c), setTraffic(v) { traffic = v; }, get traffic() { return traffic; }, setState() {}, get state() { return "now"; },
      at: (x, y, z) => V(-x * K, (y - D.base) * K, -z * K),   // 全体を 180° 回しているので x, z を反転
      shots: {
        runway: { label: "滑走路と島", target: [200, 0, 400], pos: [1800, 1300, -900] },
        usv: { label: "無人艇の格納庫とスロープ", target: [180, 10, -1300], pos: [700, 320, -2000] },
        tanker: { label: "タンカー", target: [0, 20, -2200], pos: [700, 260, -1500] },
        halva: { label: "ハルヴァ山のレーダー塔", target: [-300, 150, -500], pos: [500, 400, -1300] },
      },
    };
  }

  DreamAssets.fac.register("abu_musa", {
    section: 3, title: "アブー・ムーサー島", kind: "STRATEGIC FACILITY · 3 海峡・島",
    desc: "ホルムズ海峡の小島(大小トンブ島と並ぶ 3 島の代表)。小さな島に不釣り合いな滑走路と、沖の分離通航帯を行き交うタンカー。近未来版は無人艇の格納庫とスロープ、レーダー塔を足した「無人機の島」",
    info: [["ファイル", "mockups/3d/facilities/abu_musa.js"], ["大きさ", "直径 5.5 km の海を 0.04 倍 × 表示 3.0"], ["誇張", "滑走路の幅 3 倍、タンカー 1.5 倍、建物の高さ 2 倍、ハルヴァ山の高さ 1.5 倍"], ["簡略化", "航路までの距離を縮めた。大小トンブ島は省略。外形と滑走路は概略"], ["省略", "町の家・車両・人・無人艇"], ["動作", "タンカー 2 隻が東西に通航(約 8 倍速)"]],
    dist: 1150, target: 20, tokenAt: [420, 0, 330],
    make: (THREE) => abuMusa(THREE),
    actLabel: "ACTION · 動作", progress: false,
    actions: (a) => [["タンカー通航", () => a.setTraffic(!a.traffic), () => a.traffic]],
    caption: () => "",
  });
})();
