// 戦略施設トークン「グレートベルト・リンク」(デンマーク、大ベルト海峡)の東橋の詳細版モデル(試作)。
// 主径間 1624 m・主塔の高さ 254 m の吊り橋。2 本の主塔を入れるため、主径間と両側の側径間の一部(約 2020 × 320 m)を切り取る。
// 平面の配置は実寸の比率(K = 0.09。吊り橋が大きいので他の施設より小さい縮尺)。
// 誇張: 決め手の「海上にそびえる 2 本の主塔」— 主塔の高さ 1.25 倍(254 → 318 m)、脚の太さ 2 倍。縮尺が小さいので桁の幅 1.5 倍、
// 主ケーブルの太さ 3 倍、吊り材の太さ(線として見える程度)。
// 省略: 車両、照明柱、桁の上の設備、アンカレイジ(切り取りの外)。
// 近未来化(施設リストの案): 航路の上の桁の下に、航路管制用のセンサー(箱形のレーダーの覆いと電子光学の窓)を吊るす。
//
//   const a = DreamAssets.fac.defs.great_belt.make(THREE)(制圧圏 r = 100)
// 橋は x 方向、航路(船の通る向き)は z 方向。
(function () {
  const K = 0.09;
  const D = {
    x0: -1010, x1: 1010, z0: -160, z1: 160, bed: -30, base: -33,
    pyl: 812, H: 254 * 1.25, legZ: 35, w: 31 * 1.5, gd: 4 * 1.5,   // 主塔の x、高さ、脚の z、桁の幅・高さ(誇張後)
    sag: 75, anchor: 1347, anchorY: 20,                     // 主ケーブルの最下点、アンカレイジの x と高さ(切り取りの外)
  };
  const legA = (y) => 12 - (4.5 * (y - 9)) / (D.H - 15), legB = (y) => 10 - (4 * (y - 9)) / (D.H - 15);   // 脚の半分の太さ(橋軸方向・横方向。実物の約 2 倍)
  const deckY = (x) => 71 - (x / D.x1) ** 2 * 9;   // 路面(縦断曲線。中央の桁下約 65 m)
  const cableY = (x) => {                            // 主ケーブルの高さ(主径間は放物線、側径間はアンカレイジへ下りる)
    const ax = Math.abs(x);
    if (ax <= D.pyl) return D.sag + (D.H - D.sag) * (ax / D.pyl) ** 2;
    const u = (ax - D.pyl) / (D.anchor - D.pyl);
    return D.H - (D.H - D.anchorY) * u - 15 * 4 * u * (1 - u);
  };

  function greatBelt(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE);
    M.rock = M.lambert(0x9aa0a7);
    const group = new THREE.Group(); group.name = "great_belt";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, tube, closedLoft, prism } = k;
    const W = D.x1 - D.x0, Dz = D.z1 - D.z0;

    // ── 海 ──
    add(box(W, D.bed - D.base, Dz), M.light, world, { y: (D.bed + D.base) / 2 });
    F.plinth(k, M, world, W, Dz, D.base);
    world.add(k.waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], M.sea));
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(W, -D.bed), { y: D.bed / 2, z: D.z0 }], [new THREE.PlaneGeometry(W, -D.bed), { y: D.bed / 2, z: D.z1 }],
      [new THREE.PlaneGeometry(Dz, -D.bed), { y: D.bed / 2, x: D.x0, ry: Math.PI / 2 }], [new THREE.PlaneGeometry(Dz, -D.bed), { y: D.bed / 2, x: D.x1, ry: Math.PI / 2 }],
    ]), M.waterCut));
    for (const x of [-420, 420]) for (const z of [-135, 135]) {   // 航路(主径間の中央)の浮標
      const red = x < 0;
      add(cyl(5, 10, 10), red ? M.red : M.green, world, { x, y: 1.5, z });
      add(red ? cyl(2.5, 4, 8) : new THREE.ConeGeometry(3, 5, 8), red ? M.red : M.green, world, { x, y: 9, z });
    }

    // ── 主塔: ケーソンと船の衝突よけの人工島、2 本の脚(上へ細くなる)、横梁 2 本、ケーブルのサドル ──
    for (const s of [-1, 1]) {
      const px = s * D.pyl;
      const isl = Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [px + Math.cos(a) * 52, Math.sin(a) * 86]; });
      add(prism(isl, D.bed, 1.5), M.rock, world);                                   // 石積みの人工島
      add(box(46, 10, 94), M.light, world, { x: px, y: 4 });                        // ケーソンの頂部
      for (const sz of [-1, 1]) {
        const ring = (y, a, b) => [V(px - a, y, sz * D.legZ - b), V(px + a, y, sz * D.legZ - b), V(px + a, y, sz * D.legZ + b), V(px - a, y, sz * D.legZ + b)];
        add(closedLoft([ring(9, legA(9), legB(9)), ring(D.H - 6, legA(D.H - 6), legB(D.H - 6))]), M.body, world);   // 脚(実物の約 1.5 倍の太さ)
        add(box(16, 7, 13), M.steel, world, { x: px, y: D.H - 2.5, z: sz * D.legZ });    // サドル
        add(box(16.4, 1.4, 13.4), M.accent, world, { x: px, y: D.H - 6.6, z: sz * D.legZ, edges: false });   // 頂部の帯(所有者の色)
        for (let y = 20; y < D.H - 20; y += 26) add(box(0.3, 3, 2.2), M.glass, world, { x: px - s * (legA(y) + 0.1), y, z: sz * D.legZ, edges: false });   // 点検窓(主径間の側の面)
      }
      for (const [y, h] of [[D.H * 0.5, 12], [D.H - 16, 14]]) add(box(12, h, 2 * D.legZ), M.body, world, { x: px, y });   // 横梁
      add(box(12.4, 1.0, 2 * D.legZ - 12), M.light, world, { x: px, y: D.H * 0.5 - 6.6, edges: false });
    }

    // ── 桁(流線形の箱桁)、路面、高欄、ケーブルの定着の張り出し ──
    const N = 60, xs = Array.from({ length: N + 1 }, (_, i) => D.x0 + (W * i) / N);
    const strip = (prof, mat, o = {}) => add(closedLoft(xs.map((x) => prof.map(([z, y]) => V(x, deckY(x) + y, z)))), mat, world, o);
    const hw = D.w / 2;
    strip([[-hw, 0], [hw, 0], [hw, -1.2], [hw - 7, -D.gd], [-hw + 7, -D.gd], [-hw, -1.2]], M.body);
    strip([[-hw + 4, 0], [-1.5, 0], [-1.5, 0.25], [-hw + 4, 0.25]], M.mid, { edges: false });
    strip([[1.5, 0], [hw - 4, 0], [hw - 4, 0.25], [1.5, 0.25]], M.mid, { edges: false });
    for (const s of [-1, 1]) strip([[s * hw - 0.5, 0], [s * hw, 0], [s * hw, 1.6], [s * hw - 0.5, 1.6]], M.light, { edges: false });

    // ── 主ケーブルと吊り材 ──
    const cz = D.legZ;
    for (const sz of [-1, 1]) {
      const pts = [];
      for (let x = D.x0; x <= D.x1 + 0.1; x += W / 80) pts.push(V(x, cableY(x) + 2, sz * cz));
      for (let i = 0; i < pts.length - 1; i++) tube(world, pts[i], pts[i + 1], 2.4, M.steel);
      for (let x = -D.pyl + 24; x < D.pyl - 10; x += 24) hanger(x, sz);
      for (const s of [-1, 1]) for (let x = D.pyl + 24; x < D.x1; x += 24) hanger(s * x, sz);
    }
    function hanger(x, sz) {
      const top = cableY(x), bot = deckY(x) + 0.5;
      if (top - bot < 3) return;
      tube(world, V(x, top, sz * cz), V(x, bot, sz * (hw + 2.2)), 0.9, M.mid);
      add(box(3, 1.2, 3.4), M.dark, world, { x, y: bot - 0.4, z: sz * (hw + 1.4), edges: false });   // 定着の張り出し
    }

    // ── 近未来化: 航路管制用のセンサー(桁の下に吊る。航路の向き = ±z に暗いガラスの窓) ──
    for (const x of [-180, 0, 180]) {
      const y0 = deckY(x) - D.gd;
      for (const dz of [-8, 8]) add(box(1.4, 9, 1.4), M.mid, world, { x, y: y0 - 4.5, z: dz });
      add(box(4, 1.4, 20), M.mid, world, { x, y: y0 - 9.2, z: 0 });
      add(box(16, 8, 14), M.body, world, { x, y: y0 - 14, z: 0 });
      add(box(16.2, 1.6, 14.2), M.accent, world, { x, y: y0 - 11, z: 0, edges: false });
      for (const s of [-1, 1]) {
        add(box(10, 3.2, 0.3), M.glass, world, { x, y: y0 - 14.5, z: s * 7.1, edges: false });
        add(box(6, 4, 4), M.light, world, { x, y: y0 - 19.5, z: s * 4 });   // 下向きの箱形レーダーの覆い
      }
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);
    function update(dt) { M.sea.map.offset.y -= dt * 0.02; ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; }
    function check() {
      const r1 = (v) => +v.toFixed(1);
      return {
        navClearance_m: r1(deckY(0) - D.gd),                  // 主径間の中央の桁下(実物 65 m)
        sensorClearance_m: r1(deckY(180) - D.gd - 21.5),       // 吊ったセンサーの下端と水面(船の通る高さ)
        cableOverDeckMid_m: r1(cableY(0) - deckY(0)),          // 中央の主ケーブルと路面
        legToDeckEdge_m: r1(D.legZ - legB(deckY(D.pyl)) - hw),     // 脚の内面と桁の縁(路面の高さ)
      };
    }
    U.bake(THREE, group, { live: [M.accent] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, check, at, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      shots: {
        pylon: { label: "主塔", target: [812, 170, 0], pos: [540, 130, 360] },
        sensors: { label: "桁の下のセンサー", target: [0, 48, 0], pos: [70, 38, 120] },
        span: { label: "主径間", target: [0, 90, 0], pos: [-300, 130, 600] },
      },
    };
  }

  DreamAssets.fac.register("great_belt", {
    section: 3, title: "グレートベルト・リンク", kind: "STRATEGIC FACILITY · 3 海峡・島",
    desc: "大ベルト海峡を渡る東橋。主塔の高さ 254 m・主径間 1624 m の吊り橋で、バルト海に出入りする大型船はこの下を通る。航路の上の桁の下に航路管制用のセンサーを吊るした近未来版",
    info: [["ファイル", "mockups/3d/facilities/great_belt.js"], ["大きさ", "主径間と側径間の一部 2020 × 320 m を 0.09 倍 × 表示 3.0"], ["誇張", "主塔の高さ 1.25 倍・脚の太さ 2 倍、桁の幅 1.5 倍、主ケーブル 3 倍、吊り材を太く"], ["省略", "車両、照明柱、アンカレイジ"], ["近未来化", "桁の下の航路管制センサー"]],
    dist: 1000, target: 40, tokenAt: [380, 0, 280],
    make: (THREE) => greatBelt(THREE, { r: 100 }),
  });
})();
