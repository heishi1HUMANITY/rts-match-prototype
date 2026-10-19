// 戦略施設トークン「要塞化変電所」(ウクライナの 330/110 kV 変電所の代表。特定の 1 か所ではない)の詳細版モデル(試作)。
// 典型的な配置(北に 330 kV の開閉所、中央に単巻変圧器 3 台、南に 110 kV の開閉所と制御棟)をメートルで組み、K 倍して模型にする。
// 誇張: 変圧器の大きさ 1.3 倍と防護壁の高さ(施設リストの決め手「防護壁に囲まれた変圧器群」)。開閉所の機器と平面の配置は実寸の比率。
// 省略: 車両・人・ケーブルの細部・碍子の笠の一枚一枚(数段の輪で代表させる)。
// 近未来化(施設リストの案): 防護シェルターの屋根まで付けた要塞化。
// 状態: "walls"(コンクリート壁と蛇籠で囲った現状)/ "shelter"(壁を上へ延ばし屋根を架けたシェルター。上部の南北は電線の通る開口)
(function () {
  const K = 0.5;
  const D = { x0: -150, x1: 150, z0: -100, z1: 100, base: -4, ground: 0, ex: 1.3 };
  const T = { L: 12 * D.ex, W: 6 * D.ex, H: 7 * D.ex, xs: [-60, 0, 60], z: 8 };   // 変圧器(長さ・幅・高さ、位置)
  const WALL = { gap: 4, t: 1.2, h: 12, top: 21, roof: 1.6 };                       // 防護壁(変圧器との隙間、厚さ、高さ)とシェルター(壁の上端、屋根の厚さ)
  const HV_TOP = T.H + 1.2 + 8.5;                                                  // 330 kV のブッシングの先端の高さ

  function substation(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.gabion = M.lambert(0xc7c1ad);
    M.wire = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.7 });
    const group = new THREE.Group(); group.name = "substation";
    const XC = (D.x0 + D.x1) / 2, ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, -ZC * K); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, lattice, prism, beam } = k;
    const wires = [];   // 電線(線分の組)。最後に 1 本の LineSegments にまとめる
    const wire = (a, b, sag = 0) => { const n = sag ? 6 : 1; for (let i = 0; i < n; i++) { const p = (t) => a.clone().lerp(b, t).add(V(0, -sag * 4 * t * (1 - t), 0)); const p0 = p(i / n), p1 = p((i + 1) / n); wires.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z); } };

    // ── 台座、砕石の敷地、外周の柵 ──
    add(prism([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], D.base, D.ground), M.land, world);
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base, { x: XC, z: ZC });
    add(box(280, 0.15, 184), M.light, world, { y: 0.08, edges: false });
    for (const [ax, az, bx, bz] of [[-142, -94, 142, -94], [-142, 94, 142, 94], [-142, -94, -142, 94], [142, -94, 142, 94]]) {
      const L = Math.hypot(bx - ax, bz - az), along = ax === bx;
      add(box(along ? 0.15 : L, 0.15, along ? L : 0.15), M.dark, world, { x: (ax + bx) / 2, y: 2.4, z: (az + bz) / 2, edges: false });
      for (let i = 0, n = Math.round(L / 6); i <= n; i++) add(box(0.2, 2.6, 0.2), M.dark, world, { x: ax + ((bx - ax) * i) / n, y: 1.3, z: az + ((bz - az) * i) / n, edges: false });
    }
    add(box(10, 0.2, 186), M.mid, world, { x: 136, y: 0.1, edges: false });   // 構内道路(東)

    // ── 碍子(磁器の筒と笠の輪)と開閉所の機器 ──
    const insulator = (x, y, z, h, r = 0.35) => {
      add(cyl(r, h, 8), M.body, world, { x, y: y + h / 2, z });
      for (let i = 1; i < 4; i++) add(cyl(r * 2.1, 0.25, 10), M.body, world, { x, y: y + (h * i) / 4, z, edges: false });
      add(cyl(r * 1.4, 0.5, 8), M.mid, world, { x, y: y + h + 0.25, z });
      return y + h + 0.5;
    };
    const post = (x, z, h, ins) => { add(box(0.6, h, 0.6), M.mid, world, { x, y: h / 2, z }); return insulator(x, h, z, ins); };
    const breaker = (x, z) => {   // ガス遮断器(3 相。横置きのタンクと 2 本のブッシング)
      for (const dx of [-3, 0, 3]) {
        add(box(0.6, 3, 0.6), M.mid, world, { x: x + dx, y: 1.5, z: z - 1.4 }); add(box(0.6, 3, 0.6), M.mid, world, { x: x + dx, y: 1.5, z: z + 1.4 });
        const tg = cyl(0.8, 4.2, 12); tg.rotateX(Math.PI / 2); add(tg, M.light, world, { x: x + dx, y: 3.8, z });
        for (const dz of [-1.6, 1.6]) insulator(x + dx, 4.4, z + dz, 3.6, 0.28);
      }
      add(box(2, 2.2, 1.2), M.mid, world, { x: x + 5, y: 1.1, z });   // 操作箱
    };
    // 門型の鉄構(格子の柱 2 本 + 格子の梁)
    const gantry = (x, z, w, h) => {
      for (const s of [-1, 1]) lattice(world, V(x + (s * w) / 2, 0, z), h, 1.3, 0.8, 3, 0.25);
      for (const dz of [-0.8, 0.8]) for (const y of [h - 1.6, h]) beam(world, V(x - w / 2, y, z + dz), V(x + w / 2, y, z + dz), 0.35, M.mid);
      for (let i = 0; i < 6; i++) beam(world, V(x - w / 2 + (w * i) / 6, h - 1.6, z - 0.8), V(x - w / 2 + (w * (i + 1)) / 6, h, z + 0.8), 0.25, M.mid);
    };

    // ── 330 kV 開閉所(北): 引込みの鉄構、母線 2 回線、線路と変圧器の回線(遮断器・断路器・計器用変成器) ──
    const BAYS = [-120, -60, 0, 60, 120];
    gantry(0, -88, 256, 26);
    gantry(0, -30, 256, 20);
    for (const zb of [-66, -58]) {
      for (const x of BAYS.flatMap((b) => [b - 6, b + 6])) post(x, zb, 6, 4);
      for (const dx of [-3, 0, 3]) wire(V(-126, 10.6, zb + dx * 0.5), V(126, 10.6, zb + dx * 0.5));
    }
    for (const bx of BAYS) {
      breaker(bx, -76);
      for (const dx of [-3, 0, 3]) {
        const ct = post(bx + dx, -46, 3, 3.6);                                  // 計器用変流器
        wire(V(bx + dx, 26, -88), V(bx + dx, 8, -76), 1);                         // 引込み線 → 遮断器
        wire(V(bx + dx, 8, -76), V(bx + dx, 10.6, -62));                          // 遮断器 → 母線
        wire(V(bx + dx, 10.6, -62), V(bx + dx, ct, -46));
        wire(V(bx + dx, ct, -46), V(bx + dx, 20, -30));
      }
    }
    // ── 単巻変圧器 3 台(タンク、放熱器、コンサベータ、ブッシング)と防護壁 ──
    const shelter = new THREE.Group(); world.add(shelter);
    for (const tx of T.xs) {
      const z = T.z;
      add(box(T.L + 6, 0.6, T.W + 8), M.light, world, { x: tx, y: 0.3, z });               // 基礎と油受けの縁
      add(box(T.L + 6.2, 0.9, 0.4), M.dark, world, { x: tx, y: 0.45, z: z - (T.W + 8) / 2, edges: false });
      add(box(T.L, T.H, T.W), M.mid, world, { x: tx, y: 0.6 + T.H / 2, z });               // タンク
      add(box(T.L + 0.4, 0.5, T.W + 0.4), M.steel, world, { x: tx, y: 0.6 + T.H, z });
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) add(box(1.6, T.H * 0.8, 0.35), M.steel, world, { x: tx - T.L / 2 + 1.8 + i * ((T.L - 3.6) / 5), y: 0.6 + T.H * 0.45, z: z + s * (T.W / 2 + 1.2) });   // 放熱器
      for (const s of [-1, 1]) add(box(T.L - 2, 0.6, 0.8), M.steel, world, { x: tx, y: 0.6 + T.H * 0.85, z: z + s * (T.W / 2 + 0.5), edges: false });
      const cg = cyl(1.4, 9, 14); cg.rotateZ(Math.PI / 2); add(cg, M.light, world, { x: tx + 1, y: T.H + 4.2, z: z + T.W / 2 - 1.2 });   // コンサベータ
      for (const dx of [-3, 4]) add(box(0.5, 2.8, 0.5), M.mid, world, { x: tx + dx, y: T.H + 2.2, z: z + T.W / 2 - 1.2 });
      add(box(1.6, 2.4, 1.0), M.light, world, { x: tx + T.L / 2 + 0.9, y: 2, z });          // 端子箱
      for (const dx of [-3.5, 0, 3.5]) {
        const top = insulator(tx + dx, T.H + 1.1, z - T.W / 2 + 1.2, 8, 0.45);          // 330 kV
        wire(V(tx + dx, top, z - T.W / 2 + 1.2), V(tx + dx, 20, -30), 1.2);
        const lo = insulator(tx + dx, T.H + 1.1, z + T.W / 2 - 2.8, 4.5, 0.35);        // 110 kV
        wire(V(tx + dx, lo, z + T.W / 2 - 2.8), V(tx + dx, 14, 52), 1.2);
      }
      // 防護壁(コンクリートの壁板を並べた 4 面。南北の面は変圧器から離して電線を上に通す)
      const hx = T.L / 2 + 1.6 + WALL.gap, hz = T.W / 2 + 1.6 + WALL.gap;
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) add(box(WALL.t, WALL.h, (2 * hz + 2 * WALL.t) / 6 - 0.2), M.light, world, { x: tx + s * (hx + WALL.t / 2), y: WALL.h / 2, z: z - hz - WALL.t + ((2 * hz + 2 * WALL.t) * (i + 0.5)) / 6 });
        for (let i = 0; i < 8; i++) add(box((2 * hx) / 8 - 0.2, WALL.h * 0.8, WALL.t), M.light, world, { x: tx - hx + ((2 * hx) * (i + 0.5)) / 8, y: (WALL.h * 0.8) / 2, z: z + s * (hz + WALL.t / 2) });
        add(box(WALL.t + 0.6, 0.8, 2 * hz + 2 * WALL.t + 0.6), M.mid, world, { x: tx + s * (hx + WALL.t / 2), y: WALL.h + 0.4, z, edges: false });
      }
      // シェルター: 東西の壁を上へ延ばし、屋根を架ける(南北の上部は開口)
      for (const s of [-1, 1]) add(box(WALL.t, WALL.top - WALL.h - 0.8, 2 * hz + 2 * WALL.t), M.light, shelter, { x: tx + s * (hx + WALL.t / 2), y: WALL.h + 0.8 + (WALL.top - WALL.h - 0.8) / 2, z });
      for (const s of [-1, 1]) for (const zz of [-1, 1]) add(box(2.4, WALL.top - WALL.h * 0.8, 1.6), M.light, shelter, { x: tx + s * (hx - 1.2), y: WALL.h * 0.8 + (WALL.top - WALL.h * 0.8) / 2, z: z + zz * (hz + WALL.t / 2) });
      add(box(2 * hx + 2 * WALL.t + 2, WALL.roof, 2 * hz + 2 * WALL.t + 2), M.body, shelter, { x: tx, y: WALL.top + WALL.roof / 2, z });
      add(box(2 * hx + 2 * WALL.t + 2.2, 0.6, 2 * hz + 2 * WALL.t + 2.2), M.accent, shelter, { x: tx, y: WALL.top + 0.3, z, edges: false });
      for (let i = -2; i <= 2; i++) add(box(1.2, 1.0, 2 * hz), M.mid, shelter, { x: tx + i * (hx / 2.5), y: WALL.top + WALL.roof + 0.5, z, edges: false });   // 屋根の梁
    }
    // 蛇籠(蛇籠を 2 段に積んだ防護。遮断器の列の北と制御棟の周り)
    const gabions = (x0, z0, x1, z1, rows = 2) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / 1.6), along = x0 === x1;
      for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) add(box(along ? 1.5 : 1.55, 1.5, along ? 1.55 : 1.5), M.gabion, world, { x: x0 + ((x1 - x0) * (i + 0.5)) / n, y: 0.75 + r * 1.5, z: z0 + ((z1 - z0) * (i + 0.5)) / n });
    };
    for (const bx of BAYS) gabions(bx - 7, -82, bx + 7, -82);

    // ── 110 kV 開閉所(南)と制御棟 ──
    gantry(-10, 52, 200, 15); gantry(-10, 86, 200, 15);
    for (const bx of [-90, -50, -10, 30, 70]) {
      for (const dx of [-2, 0, 2]) {
        const top = post(bx + dx, 64, 3.5, 2.6);
        wire(V(bx + dx, 14, 52), V(bx + dx, top, 64)); wire(V(bx + dx, top, 64), V(bx + dx, 14, 86));
        wire(V(bx + dx, 15, 86), V(bx + dx, 12, 99.5), 1);   // 線路へ(台座の端で切る)
      }
      add(box(4.5, 1.6, 1.8), M.light, world, { x: bx, y: 3.8, z: 74 }); add(box(0.6, 3, 0.6), M.mid, world, { x: bx, y: 1.5, z: 74 });   // 遮断器(110 kV、ライブタンク形の台)
    }
    add(box(26, 7, 14), M.body, world, { x: 110, y: 3.5, z: 52 });                         // 制御棟
    add(box(26.4, 1.4, 14.4), M.glass, world, { x: 110, y: 4.2, z: 52, edges: false });
    add(box(26.6, 0.6, 14.6), M.accent, world, { x: 110, y: 6.4, z: 52, edges: false });
    for (const [x, z] of [[103, 52], [117, 52]]) add(box(3, 1.6, 3), M.mid, world, { x, y: 7.8, z });
    gabions(94, 42, 126, 42); gabions(94, 62, 126, 62); gabions(94, 42, 94, 62); gabions(126, 42, 126, 52);

    const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3));
    world.add(new THREE.LineSegments(wg, M.wire));
    const { ring, disc } = U.zone(THREE, group, opts.r ?? 95, M.ring, M.disc);

    let state = opts.state ?? "walls";
    function setState(s) { if (s === "walls" || s === "shelter") state = s; shelter.visible = state === "shelter"; }
    function update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; }
    const r1 = (v) => +v.toFixed(1);
    function check() {
      return {
        wallToTransformer_m: WALL.gap,                                   // 防護壁と変圧器(放熱器の外側)の隙間
        bushingOverWall_m: r1(HV_TOP - WALL.h),                          // 330 kV のブッシングの先端と壁の上端(正 = 壁より上で電線を受ける)
        roofOverBushing_m: r1(WALL.top - HV_TOP),                        // シェルターの屋根の下面とブッシングの先端の隙間
        wallToWall_m: r1(60 - 2 * (T.L / 2 + 1.6 + WALL.gap + WALL.t)),  // 隣り合う変圧器の壁どうしの隙間
        gantryToWall_m: r1(T.z - (T.W / 2 + 1.6 + WALL.gap + WALL.t) - (-30 + 1.3)),
      };
    }
    U.bake(THREE, group, { dynamic: [shelter], live: [M.accent] });
    setState(state);
    const at = (x, y, z) => V((x - XC) * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        transformer: { label: "防護壁の変圧器", target: [0, 8, 8], pos: [35, 40, 70] },
        hv: { label: "330 kV 開閉所", target: [-40, 10, -60], pos: [10, 45, -10] },
        control: { label: "制御棟と蛇籠", target: [105, 3, 52], pos: [140, 30, 95] },
      },
    };
  }

  DreamAssets.fac.register("substation", {
    section: 4, title: "要塞化変電所", kind: "STRATEGIC FACILITY · 4 エネルギー",
    desc: "ウクライナの変電所。変圧器をコンクリートの壁と蛇籠で囲う対策が進められている。防護シェルターの屋根まで付けた要塞化変電所の近未来版",
    info: [["ファイル", "mockups/3d/facilities/substation.js"], ["大きさ", "実寸 300 × 200 m を 0.5 倍 × 表示 3.0"], ["誇張", "変圧器 1.3 倍、防護壁の高さ"], ["省略", "車両・人・ケーブルの細部"], ["近未来化", "屋根付きの防護シェルター"]],
    dist: 950, target: 15, tokenAt: [380, 0, 280],
    make: (THREE) => substation(THREE, { r: 95 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["防護壁", () => a.setState("walls"), () => a.state === "walls"], ["シェルター", () => a.setState("shelter"), () => a.state === "shelter"]],
    caption: (a) => (a.state === "shelter" ? "要塞化 — 変圧器に屋根付きの防護シェルター" : ""),
  });
})();
