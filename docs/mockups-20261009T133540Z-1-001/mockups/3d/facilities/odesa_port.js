// 戦略施設トークン「オデーサ港(穀物輸出ターミナル)」の詳細版モデル(試作)。
// 決め手は「埠頭沿いの穀物サイロと積み込み設備」。港の一角(900 × 800 m)を実寸の比率で組む: 南の陸(鉄道の受け入れ棟・古いサイロ)から北へ延びる埠頭に、
// サイロの群れ(直径 12 m × 30 本)と昇降塔、岸壁の積み込み機 2 基(走行・旋回なし)、着岸したばら積み船。北に防波堤と先端のヴォロンツォフ灯台。
// 誇張: サイロと昇降塔の高さ 1.5 倍(45 → 67.5 m、塔 80 m)、灯台 1.5 倍。平面は実寸比。
// 省略: 貨車・トラック・人・小型船。無人艇そのもの(長さ 10 m 前後)は省き、待機する桟橋と屋根を置く。
// 近未来化(施設リストの案): サイロを覆う防護網(枠組みと網の格子)、護衛用の無人艇が待機する浮き桟橋(屋根付きの泊地・充電柱)。
// 状態: "loading"(積み込み中: 積み込み機が船の艙口の間を行き来する)/ "idle"(停止)。
// 座標: x が東、z が南(-z が海)。
(function () {
  const K = 0.12;
  const D = {
    x0: -450, x1: 450, z0: -400, z1: 400,
    ground: 4, bed: -14, base: -17,
    pier: [-60, 60, -300, 200],            // 埠頭(x0, x1, z0, z1)
    silo: { r: 6, h: 67.5, cols: 3, rows: 10, x0: -12, z0: 16, pitch: 12 },
    railX: [-56, -34], loaderH: 14,        // 積み込み機のレール(門型が岸壁のコンベヤをまたぐ)
    ship: { x: -78, z0: -262, z1: -72, B: 32, fb: 9 },
    hatches: [-236, -204, -172, -140, -108],
  };
  const SPEED = 6, DWELL = 3.5;   // 積み込み機の走行速度(m/秒)、艙口での停止秒数

  function odesaPort(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 85;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE); M.sea.side = THREE.DoubleSide;
    const ZC = 0;
    const group = new THREE.Group(); group.name = "odesa_port";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, prism, tube, beam } = k;
    const rnd = U.rng(77);

    // ── 陸・埠頭・防波堤・海 ──
    const [px0, px1, pz0, pz1] = D.pier;
    add(prism([[D.x0, 200], [px0, 200], [px0, pz0], [px1, pz0], [px1, 200], [D.x1, 200], [D.x1, D.z1], [D.x0, D.z1]], D.base, D.ground), M.land, world);
    for (const x of [px0, px1]) add(box(1.4, 1.2, pz1 - pz0), M.dark, world, { x: x + Math.sign(x) * 0.7, y: 1.8, z: (pz0 + pz1) / 2, edges: false });   // 岸壁の防舷材の帯
    add(box(1.4, 1.2, 2 * px1), M.dark, world, { y: 1.8, z: pz0 - 0.7, edges: false });
    add(box(650, D.ground + 3 - D.bed, 24), M.light, world, { x: -125, y: (D.ground + 3 + D.bed) / 2, z: -370 });   // 防波堤
    for (let i = 0; i < 40; i++) add(box(5, 3, 5), M.mid, world, { x: -440 + i * 16.4, y: D.ground + 3, z: -382 + (i % 2) * 3, ry: i * 0.7 });   // 消波ブロック
    world.add(k.waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], M.sea));
    add(box(D.x1 - D.x0, D.bed - D.base, D.z1 - D.z0), M.light, world, { y: (D.base + D.bed) / 2, edges: false });
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(600, -D.bed), { y: D.bed / 2, z: D.z0 }],
      [new THREE.PlaneGeometry(600, -D.bed), { x: D.x0, y: D.bed / 2, z: -100, ry: Math.PI / 2 }], [new THREE.PlaneGeometry(600, -D.bed), { x: D.x1, y: D.bed / 2, z: -100, ry: Math.PI / 2 }],
    ]), M.waterCut));
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base);
    // ヴォロンツォフ灯台(防波堤の東端。白い円筒、灯室は常灯。高さ 1.5 倍)
    const lh = V(196, D.ground + 3, -370);
    add(cyl(5, 4, 14), M.light, world, { x: lh.x, y: lh.y + 2, z: lh.z });
    add(new THREE.CylinderGeometry(2.6, 3.4, 36, 14), M.body, world, { x: lh.x, y: lh.y + 22, z: lh.z });
    add(cyl(4, 1, 14), M.mid, world, { x: lh.x, y: lh.y + 40.5, z: lh.z });
    add(cyl(2.2, 3, 12), M.lamp, world, { x: lh.x, y: lh.y + 42.5, z: lh.z, edges: false });
    add(new THREE.ConeGeometry(2.8, 2.4, 12), M.dark, world, { x: lh.x, y: lh.y + 45.2, z: lh.z });

    // ── 陸: 鉄道の側線と受け入れ棟(貨車は省略)、古いサイロ、市街の端 ──
    for (const z of [232, 242, 252]) add(box(D.x1 - D.x0, 0.4, 1.6), M.dark, world, { y: D.ground + 0.2, z, edges: false });
    add(box(70, 16, 34), M.light, world, { x: -10, y: D.ground + 8, z: 242 });
    add(box(70.4, 3, 34.4), M.mid, world, { x: -10, y: D.ground + 3.5, z: 242, edges: false });
    for (let c = 0; c < 6; c++) for (let r = 0; r < 2; r++) add(cyl(5, 42, 16), M.light, world, { x: -300 + c * 10.4, y: D.ground + 21, z: 290 + r * 10.4 });
    add(box(64, 5, 24), M.mid, world, { x: -274, y: D.ground + 44.5, z: 295 });
    for (let i = 0; i < 18; i++) {
      const w = 26 + rnd() * 30, d = 14 + rnd() * 12, h = 10 + rnd() * 14, x = D.x0 + 30 + rnd() * (D.x1 - D.x0 - 60), z = 300 + rnd() * 80;
      if (Math.abs(x + 274) < 60 && z < 340) continue;
      add(box(w, h, d), rnd() < 0.7 ? M.body : M.light, world, { x, y: D.ground + h / 2, z });
    }

    // ── 穀物エレベーター: サイロの群れ、上部の搬送ギャラリー、昇降塔(作業棟) ──
    const S = D.silo, siloX = (c) => S.x0 + c * S.pitch, siloZ = (r) => S.z0 + r * S.pitch;
    const siloG = cyl(S.r, S.h, 18);
    for (let c = 0; c < S.cols; c++) for (let r = 0; r < S.rows; r++) add(siloG, M.body, world, { x: siloX(c), y: D.ground + S.h / 2, z: siloZ(r) });
    const sz0 = siloZ(0) - S.r, sz1 = siloZ(S.rows - 1) + S.r;
    add(box(2 * S.r * 3 + 1, 2, sz1 - sz0), M.light, world, { y: D.ground + S.h + 1, z: (sz0 + sz1) / 2 });   // 上屋の床
    add(box(10, 7, sz1 - sz0), M.light, world, { y: D.ground + S.h + 5.5, z: (sz0 + sz1) / 2 });           // 上部ギャラリー
    add(box(10.2, 1.2, sz1 - sz0 + 0.2), M.glass, world, { y: D.ground + S.h + 5.5, z: (sz0 + sz1) / 2, edges: false });
    add(box(34, 80, 16), M.light, world, { y: D.ground + 40, z: sz0 - 9 });     // 昇降塔(北端)
    for (let i = 0; i < 6; i++) add(box(34.3, 1.4, 16.3), M.glass, world, { y: D.ground + 12 + i * 11, z: sz0 - 9, edges: false });
    add(box(20, 8, 12), M.light, world, { y: D.ground + 84, z: sz0 - 9 });
    add(box(34.6, 1.2, 16.6), M.accent, world, { y: D.ground + 77, z: sz0 - 9, edges: false });   // 頂部の帯(チーム色)
    beam(world, V(0, D.ground + 16, 226), V(0, D.ground + S.h + 3, sz1), 5, M.light);   // 受け入れ棟からサイロへの傾斜ギャラリー
    // 昇降塔 → 岸壁の乗継塔 → 岸壁のコンベヤ(積み込み機の門型の下を通る)
    const TT = V(-45, 0, -2);
    add(box(10, 34, 10), M.light, world, { x: TT.x, y: D.ground + 17, z: TT.z });
    add(box(28, 5, 5), M.light, world, { x: -31, y: D.ground + 32, z: TT.z });
    add(box(4, 3, -pz0 - 8), M.mid, world, { x: TT.x, y: D.ground + 1.5, z: (pz0 + 8 + TT.z - 5) / 2 });
    for (const x of D.railX) add(box(0.8, 0.5, 270), M.dark, world, { x, y: D.ground + 0.25, z: -155, edges: false });   // レール(岸壁の z -290〜-20)

    // ── 近未来化 1: サイロの防護網(周りの柱、上の格子の梁。網は細い格子で表す) ──
    const NX = [-S.r * 3 - 8, S.r * 3 + 8], NZ = [sz0 - 22, sz1 + 6], NH = D.ground + 95;   // 昇降塔の頂部より上
    for (const x of NX) for (let z = NZ[0]; z <= NZ[1] + 0.1; z += (NZ[1] - NZ[0]) / 6) add(box(1.2, NH - D.ground, 1.2), M.mid, world, { x, y: (NH + D.ground) / 2, z });
    for (const z of NZ) add(box(NX[1] - NX[0], 1.4, 1.4), M.mid, world, { y: NH, z });
    for (const x of NX) add(box(1.4, 1.4, NZ[1] - NZ[0]), M.mid, world, { x, y: NH, z: (NZ[0] + NZ[1]) / 2 });
    for (let i = 1; i < 8; i++) add(box(0.3, 0.3, NZ[1] - NZ[0]), M.dark, world, { x: NX[0] + ((NX[1] - NX[0]) * i) / 8, y: NH + 0.3, z: (NZ[0] + NZ[1]) / 2, edges: false });
    for (let i = 1; i < 24; i++) add(box(NX[1] - NX[0], 0.3, 0.3), M.dark, world, { y: NH + 0.3, z: NZ[0] + ((NZ[1] - NZ[0]) * i) / 24, edges: false });
    for (const x of NX) for (let i = 1; i < 5; i++) add(box(0.25, 0.25, NZ[1] - NZ[0]), M.dark, world, { x, y: D.ground + ((NH - D.ground) * i) / 5, z: (NZ[0] + NZ[1]) / 2, edges: false });   // 側面の網

    // ── 着岸したばら積み船(西の岸壁。船首は北) ──
    const SH = D.ship, L = SH.z1 - SH.z0, ship = new THREE.Group(); ship.position.set(SH.x, 0, (SH.z0 + SH.z1) / 2); ship.rotation.y = Math.PI; world.add(ship);
    add(U.loft(THREE, [
      { z: -L / 2, pts: U.sym([[SH.B * 0.42, -7], [SH.B * 0.5, SH.fb]]) }, { z: -L * 0.38, pts: U.sym([[SH.B * 0.5, -9], [SH.B * 0.5, SH.fb]]) },
      { z: L * 0.38, pts: U.sym([[SH.B * 0.5, -9], [SH.B * 0.5, SH.fb]]) }, { z: L * 0.48, pts: U.sym([[SH.B * 0.2, -8], [SH.B * 0.42, SH.fb + 1]]) }, { z: L / 2, pts: U.sym([[1, -4], [2, SH.fb + 2]]) },
    ]), M.dark, ship);
    add(box(SH.B - 0.6, 0.5, L * 0.8), M.mid, ship, { y: SH.fb + 0.25, edges: false });
    add(box(SH.B * 0.84, 16, 14), M.body, ship, { y: SH.fb + 8, z: -L * 0.41 });
    add(box(SH.B * 0.86, 1.4, 14.2), M.glass, ship, { y: SH.fb + 14, z: -L * 0.41, edges: false });
    add(box(4, 8, 4), M.light, ship, { y: SH.fb + 20, z: -L * 0.44 });
    for (const hz of D.hatches) add(box(SH.B * 0.62, 2, 18), M.light, ship, { y: SH.fb + 1, z: -(hz - (SH.z0 + SH.z1) / 2) });   // 艙口(開いている: 縁だけ明るく)
    for (const hz of D.hatches) add(box(SH.B * 0.5, 0.3, 15), M.dark, ship, { y: SH.fb + 2.05, z: -(hz - (SH.z0 + SH.z1) / 2), edges: false });

    // ── 積み込み機 2 基: 岸壁のコンベヤをまたぐ門型、塔、船へ張り出すブーム、伸縮する積み込み管 ──
    const loaders = [];
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group(); g.position.set(0, D.ground, 0); world.add(g);
      const [ra, rb] = D.railX, cx = (ra + rb) / 2, H = D.loaderH;
      for (const x of [ra, rb]) for (const dz of [-6, 6]) { add(box(1.6, H, 1.6), M.light, g, { x, y: H / 2, z: dz }); add(box(2.4, 1.6, 3.6), M.dark, g, { x, y: 0.8, z: dz, edges: false }); }
      add(box(rb - ra + 2, 2, 14), M.light, g, { x: cx, y: H + 1 });
      add(box(8, 20, 8), M.body, g, { x: cx - 4, y: H + 12 });            // 塔
      add(box(8.4, 1.2, 8.4), M.accent, g, { x: cx - 4, y: H + 19, edges: false });
      add(box(6, 5, 7), M.body, g, { x: cx + 6, y: H + 4.5 });           // 運転室・電気室
      add(box(6.2, 1.2, 7.2), M.glass, g, { x: cx + 6, y: H + 5.5, edges: false });
      beam(g, V(cx - 4, H + 18, 0), V(-84, H + 14, 0), 2.4, M.light);     // ブーム(先端は船の中心線の上)
      beam(g, V(cx - 4, H + 26, 0), V(-76, H + 15, 0), 0.6, M.mid);       // ブームの吊り索
      add(box(2.6, 2.6, 2.6), M.mid, g, { x: -80, y: H + 12.2 });
      const spout = add(cyl(0.9, 1, 8), M.dark, g, { x: -80 });          // 伸縮する積み込み管(艙口の上まで)
      loaders.push({ g, spout, z: D.hatches[i === 0 ? 0 : 3], target: 0, wait: 0, set: i === 0 ? [0, 1, 2] : [3, 4] });
    }
    const spoutBottom = SH.fb + 3;   // 艙口の縁の上 1 m
    const placeSpout = (ld) => { const top = D.loaderH + 11, bot = spoutBottom - D.ground; ld.spout.position.y = (top + bot) / 2; ld.spout.scale.y = top - bot; };
    loaders.forEach(placeSpout);

    // ── 近未来化 2: 護衛用の無人艇の浮き桟橋(東の岸壁。屋根付きの泊地 4 つ、充電柱、渡り橋) ──
    const pen = new THREE.Group(); pen.position.set(105, 0, -150); world.add(pen);
    add(box(20, 2.4, 110), M.light, pen, { y: 0.6 });
    for (let i = 0; i < 4; i++) {
      const z = -40 + i * 26;
      add(box(22, 1.6, 4), M.light, pen, { x: -1, y: 0.4, z: z - 11 });
      for (const sx of [-1, 1]) add(cyl(0.4, 8, 6), M.mid, pen, { x: sx * 9, y: 5, z });
      add(box(22, 0.8, 22), M.body, pen, { x: 0, y: 9.2, z, rz: 0.06 });
      add(box(1, 3, 1), M.dark, pen, { x: 10.5, y: 3.3, z: z + 6 });   // 充電柱
    }
    add(box(20.4, 0.6, 110.4), M.accent, pen, { y: 1.1, edges: false });   // 浮き桟橋の縁の帯(チーム色)
    beam(world, V(px1, D.ground, -150), V(95, 1.8, -150), 2.4, M.mid);   // 渡り橋

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 状態 ──
    let state = opts.state ?? "loading";
    const apply = () => { for (const ld of loaders) ld.g.position.z = ld.z; };
    apply();
    function update(dt) {
      if (state === "loading") for (const ld of loaders) {
        const goal = D.hatches[ld.set[ld.target]];
        if (Math.abs(goal - ld.z) < 0.01) { ld.wait += dt; if (ld.wait > DWELL) { ld.wait = 0; ld.target = (ld.target + 1) % ld.set.length; } }
        else ld.z += Math.sign(goal - ld.z) * Math.min(Math.abs(goal - ld.z), SPEED * dt);
      }
      apply();
      M.sea.map.offset.y -= dt * 0.03;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function check() {
      const r1 = (v) => +v.toFixed(2);
      const spread = D.hatches[3] - D.hatches[2];   // 2 基が最も近づくとき(艙口 3 と 4)の中心間
      return {
        loadersMinGap_m: r1(spread - 14),                                                // 門型の前後 14 m どうしの隙間
        boomOverShipDeck_m: r1(D.ground + D.loaderH + 12.2 - 1.3 - (SH.fb + 16)),       // ブームの下と船橋楼(艙口側には来ない)の比較用
        spoutAboveHatch_m: r1(spoutBottom - (SH.fb + 2)),
        boomToNetFrame_m: r1(D.hatches[0] - 7 - NZ[0] > 0 ? D.hatches[0] - NZ[0] : NZ[0] - (D.hatches[4] + 7)),
        shipToPier_m: r1(px0 - (SH.x + SH.B / 2)), shipToBreakwater_m: r1(SH.z0 - (-370 + 12)),
        penToPier_m: r1(95 - px1),
      };
    }

    U.bake(THREE, group, { dynamic: loaders.map((l) => l.g), live: [M.accent], also: [M.lamp] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState: (s) => { state = s; }, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        silo: { label: "サイロと防護網", target: [0, 40, 60], pos: [-160, 120, 220] },
        loader: { label: "積み込み機と船", target: [-70, 15, -170], pos: [-230, 60, -60] },
        pen: { label: "無人艇の浮き桟橋", target: [105, 5, -150], pos: [220, 60, -60] },
        light: { label: "防波堤と灯台", target: [180, 20, -370], pos: [300, 70, -250] },
      },
    };
  }

  DreamAssets.fac.register("odesa_port", {
    section: 5, title: "オデーサ港", kind: "STRATEGIC FACILITY · 5 水・食料",
    desc: "黒海の穀物回廊の起点。埠頭に並ぶ穀物サイロと昇降塔、岸壁の積み込み機、着岸したばら積み船。サイロの防護網と、護衛の無人艇が待機する浮き桟橋を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/odesa_port.js"], ["大きさ", "港の一角 900 × 800 m を 0.12 倍 × 表示 3.0"], ["誇張", "サイロ・昇降塔・灯台の高さ 1.5 倍。平面は実寸比"], ["省略", "貨車・トラック・人・小型船、無人艇そのもの"], ["動作", "積み込み中: 積み込み機が艙口の間を走行して止まる"], ["近未来化", "サイロの防護網、無人艇の浮き桟橋(屋根・充電柱)"]],
    dist: 760, target: 30, tokenAt: [300, 0, 250],
    make: (THREE) => odesaPort(THREE, { r: 85 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["積み込み中", () => a.setState("loading"), () => a.state === "loading"], ["停止", () => a.setState("idle"), () => a.state === "idle"]],
    caption: (a) => (a.state === "loading" ? "積み込み中 — 積み込み機が艙口を移る" : ""),
    ringParts: (a) => [a.parts.ring, a.parts.disc],
  });
})();
