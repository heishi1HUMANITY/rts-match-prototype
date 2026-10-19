// 戦略施設トークン「アントニウカ橋」(ウクライナ・ヘルソン、ドニプロ川の道路橋)の詳細版モデル(試作)。
// 全長約 1.4 km のうち、右岸(ヘルソン側)の取付けから航路径間を含む約 900 m を切り取る。平面の配置は実寸の比率(K = 0.2)。
// 誇張: 決め手の「途中で途切れた橋」が読めるよう、桁の高さ(水面から)1.5 倍、橋脚の太さ 1.3 倍。
// 省略: 車両・人、照明柱、街灯。右岸の街並みは大きな建物の塊だけ。
// 状態: "intact"(健在)/ "collapsed"(2022 年 11 月の撤退時のように径間が落ちて途切れる)。崩落の状態では、近未来化の案の
// 「隣に架けた仮設の浮橋」が下流側に出る(浮体の列と車道、両岸の取付けの斜路、流されないための錨索)。
//
//   const a = DreamAssets.fac.defs.antonivka.make(THREE)(制圧圏 r = 100)
// 橋は x 方向(-x が右岸・ヘルソン、+x が左岸側で切り取り)、川は z 方向(+z が下流)。
(function () {
  const K = 0.2;
  const D = {
    x0: -450, x1: 450, z0: -220, z1: 220, bed: -10, base: -12, bank: -330, ground: 5,
    w: 22, gd: 3.5, navA: 48, navB: 174,                    // 車道の幅、桁の高さ、航路径間(126 m)
    piers: [-267, -204, -141, -78, -15, 48, 174, 237, 300, 363, 426],
    fallen: [[-78, -15], [237, 300], [300, 363]],           // 崩落の状態で落ちる径間
    pz: 80,                                                  // 浮橋の位置(下流側)
  };
  const deckY = (x) => 33 - (x - 111) ** 2 * 9.26e-5;        // 路面の高さ(実物の約 1.5 倍。航路径間の中央が頂点)

  function antonivka(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.river = U.waterMaterial(THREE);
    const group = new THREE.Group(); group.name = "antonivka";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, tube, prism } = k;
    const W = D.x1 - D.x0, Dz = D.z1 - D.z0;

    // ── 川と右岸: 川底、水面、護岸、堤の上の道路、街区の塊 ──
    add(box(W, D.bed - D.base, Dz), M.light, world, { y: (D.bed + D.base) / 2 });
    F.plinth(k, M, world, W, Dz, D.base);
    const wet = D.bank + 8;    // 水際(護岸の斜面が水面と交わる所)
    world.add(k.waterShape([[wet, D.z0], [D.x1, D.z0], [D.x1, D.z1], [wet, D.z1]], M.river));
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(D.x1 - wet, -D.bed), { x: (wet + D.x1) / 2, y: D.bed / 2, z: D.z0 }], [new THREE.PlaneGeometry(D.x1 - wet, -D.bed), { x: (wet + D.x1) / 2, y: D.bed / 2, z: D.z1 }],
      [new THREE.PlaneGeometry(Dz, -D.bed), { y: D.bed / 2, x: D.x1, ry: Math.PI / 2 }],
    ]), M.waterCut));
    add(prism([[D.x0, D.z0], [D.bank, D.z0], [D.bank, D.z1], [D.x0, D.z1]], D.base, D.ground), M.land, world);
    const slope = [[D.bank, D.base], [D.bank + 22, D.base], [D.bank + 22, D.bed], [D.bank + 10, -1], [D.bank, D.ground]];   // 凸形
    add(U.loft(THREE, [{ z: D.z0, pts: slope }, { z: D.z1, pts: slope }]), M.mid, world);
    add(box(16, 0.2, Dz), M.mid, world, { x: D.bank - 14, y: D.ground + 0.1, z: 0, edges: false });   // 川沿いの道路
    const blocks = [[-420, -170, 40, 50, 18], [-380, -175, 26, 40, 30], [-425, -95, 44, 36, 24], [-385, -100, 22, 30, 15], [-420, 120, 40, 60, 27], [-380, 130, 26, 44, 18], [-425, 190, 44, 24, 12]];
    for (const [x, z, w, d, h] of blocks) {   // 右岸の街区(集合住宅の塊。窓の帯と屋上の機械室)
      add(box(w, h, d), M.body, world, { x, y: D.ground + h / 2, z });
      for (let f = 1; f * 3 < h - 1; f += 2) add(box(w + 0.2, 1.0, d + 0.2), M.glass, world, { x, y: D.ground + f * 3, z, edges: false });
      add(box(w * 0.3, 2.4, d * 0.25), M.mid, world, { x: x + w * 0.2, y: D.ground + h + 1.2, z });
    }

    // ── 橋: 橋脚(2 本柱 + 梁、航路径間の両脇は大きな壁式)、径間ごとの箱桁、路面 ──
    const supports = [D.bank, ...D.piers, D.x1];
    for (const x of D.piers) {
      const top = deckY(x) - D.gd - (x === D.navA || x === D.navB ? 4 : 0);
      add(box(14, 3, D.w + 6), M.mid, world, { x, y: 0, z: 0 });   // 水面のフーチング
      if (x === D.navA || x === D.navB) {
        add(box(8 * 1.3, top - 1.5, D.w - 2), M.light, world, { x, y: 1.5 + (top - 1.5) / 2, z: 0 });
        for (const s of [-1, 1]) add(cyl(4 * 1.3, top - 1.5, 12), M.light, world, { x, y: 1.5 + (top - 1.5) / 2, z: s * (D.w / 2 - 1) });
      } else {
        for (const s of [-1, 1]) add(cyl(1.6 * 1.3, top - 2.5 - 1.5, 12), M.light, world, { x, y: 1.5 + (top - 4) / 2, z: s * 6 });
        add(box(3.6, 2.5, D.w - 1), M.light, world, { x, y: top - 1.25 - 0.6, z: 0 });
        for (const dx of [-1, 1]) for (const dz of [-6, 0, 6]) add(box(1.0, 0.6, 1.4), M.dark, world, { x: x + dx * 1.0, y: top - 0.3, z: dz, edges: false });   // 支承
      }
    }
    add(box(10, deckY(D.bank) - D.gd - D.ground + 2, D.w + 4), M.light, world, { x: D.bank - 5, y: (deckY(D.bank) - D.gd + D.ground - 2) / 2, z: 0 });   // 右岸の橋台(護岸の肩の手前)
    // 堤の上へ上がる取付けの盛土(法面つきの台形の断面を橋軸に沿ってつなぐ)
    const emb = (x, h) => [V(x, D.ground - 0.01, -(D.w / 2 + 2 + h * 1.5)), V(x, D.ground - 0.01, D.w / 2 + 2 + h * 1.5), V(x, D.ground + h, D.w / 2 + 2), V(x, D.ground + h, -(D.w / 2 + 2))];
    add(k.closedLoft([emb(D.x0, 0.3), emb(D.bank - 7, deckY(D.bank) - D.ground - 0.1)]), M.light, world);
    add(box(D.bank - 7 - D.x0, 0.2, D.w - 5), M.mid, world, { x: (D.x0 + D.bank - 7) / 2, y: (D.ground + deckY(D.bank)) / 2 + 0.05, z: 0, rz: Math.atan2(deckY(D.bank) - D.ground - 0.4, D.bank - 7 - D.x0), edges: false });

    const spans = [];
    for (let i = 0; i < supports.length - 1; i++) {
      const xa = supports[i], xb = supports[i + 1], nav = xa === D.navA;
      const ya = deckY(xa), yb = deckY(xb), len = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa);
      const sp = new THREE.Group(); sp.position.set((xa + xb) / 2, (ya + yb) / 2, 0); sp.rotation.z = ang; world.add(sp);
      // 箱桁(航路径間は支点で深いハンチ)
      if (nav) {
        const sec = (x, d) => ({ z: x, pts: [[-D.w / 2, 0], [-D.w / 2, -1.2], [-D.w / 2 + 4, -d], [D.w / 2 - 4, -d], [D.w / 2, -1.2], [D.w / 2, 0]] });
        const secs = [];
        for (let t = 0; t <= 8; t++) { const x = -len / 2 + (len * t) / 8, u = (2 * x) / len; secs.push(sec(x, D.gd + 4 * u * u)); }
        const g = U.loft(THREE, secs); g.rotateY(Math.PI / 2);   // 断面の列は z 方向 → 橋軸(x)へ
        add(g, M.body, sp);
      } else {
        add(box(len, 1.2, D.w), M.body, sp, { y: -0.6 });
        add(box(len, D.gd - 1.2, D.w - 8), M.body, sp, { y: -1.2 - (D.gd - 1.2) / 2 });
      }
      for (const s2 of [-1, 1]) add(box(len, 0.9, 0.3), M.dark, sp, { y: -0.45, z: s2 * (D.w / 2 + 0.15), edges: false });   // 桁の縁の化粧板
      for (const e of [-1, 1]) add(box(0.25, 0.25, D.w - 1), M.dark, sp, { x: e * (len / 2 - 0.15), y: 0.1, edges: false });   // 伸縮継手
      add(box(len, 0.2, D.w - 5), M.mid, sp, { y: 0.1, edges: false });
      add(box(len, 0.3, 0.8), M.light, sp, { y: 0.15, edges: false });
      for (const s of [-1, 1]) { add(box(len, 0.35, 2.2), M.light, sp, { y: 0.17, z: s * (D.w / 2 - 1.6), edges: false }); add(box(len, 1.2, 0.4), M.light, sp, { y: 0.6, z: s * (D.w / 2 - 0.2) }); }
      spans.push({ g: sp, xa, xb, ya, yb, len, ang, home: sp.position.clone() });
    }

    // ── 近未来化: 仮設の浮橋(崩落の状態だけ)。浮体の列、車道、両端の斜路、錨索 ──
    const pontoon = new THREE.Group(); world.add(pontoon);
    const pW = 9, pL = 15.6;
    for (let x = wet + 8; x < D.x1 - 2; x += pL) {
      add(box(pL - 0.6, 2.4, pW), M.body, pontoon, { x: x + pL / 2, y: 0.4, z: D.pz });
      add(box(pL - 0.6, 0.5, pW + 1), M.accent, pontoon, { x: x + pL / 2, y: -0.4, z: D.pz, edges: false });   // 喫水の帯(所有者の色)
      add(box(pL, 0.25, pW - 2), M.mid, pontoon, { x: x + pL / 2, y: 1.72, z: D.pz, edges: false });
      for (const s of [-1, 1]) add(box(pL, 0.8, 0.3), M.dark, pontoon, { x: x + pL / 2, y: 2.0, z: D.pz + s * (pW / 2 - 0.3), edges: false });
    }
    add(U.loft(THREE, [{ z: D.pz - pW / 2, pts: [[D.bank - 20, D.ground], [wet + 8, 1.6], [wet + 8, 0], [D.bank - 20, D.ground - 0.2]] }, { z: D.pz + pW / 2, pts: [[D.bank - 20, D.ground], [wet + 8, 1.6], [wet + 8, 0], [D.bank - 20, D.ground - 0.2]] }]), M.light, pontoon);   // 右岸の斜路
    for (let x = wet + 40; x < D.x1; x += 62) for (const s of [-1, 1]) tube(pontoon, V(x, 0.6, D.pz + s * pW / 2), V(x + s * 0, -2, D.pz + s * 34), 0.25, M.dark);   // 錨索(上流・下流へ)

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);

    // ── 状態: 崩落した径間の姿勢(実際の映像のように、片側が橋脚に残って斜めに落ちるもの、水面へ平らに落ちるもの) ──
    const POSE = {
      "-78": { side: "b", drop: 0.5 },      // 東側が落ちて西の橋脚に残る
      "237": { side: "flat", tilt: 0.06 },  // 平らに川へ(流れで下流へずれ、橋脚の横に沈む)
      "300": { side: "a", drop: 0.5 },      // 西側が落ちる
    };
    let state = opts.state ?? "intact";
    function apply() {
      for (const s of spans) {
        s.g.position.copy(s.home); s.g.rotation.set(0, 0, s.ang);
        const pz = state === "collapsed" ? POSE[String(s.xa)] : null;
        if (!pz) continue;
        if (pz.side === "flat") { s.g.position.y = 0.8; s.g.position.z = 30; s.g.rotation.set(0.05, 0.07, pz.tilt); continue; }
        // 片側の支点を軸に回す(軸 = 残る側の路面の端)
        const keepA = pz.side === "b", px = keepA ? s.xa : s.xb, py = keepA ? s.ya : s.yb, sgn = keepA ? -1 : 1;
        const a = s.ang + sgn * pz.drop, half = s.len / 2;
        s.g.rotation.z = a;
        s.g.position.set(px + (keepA ? 1 : -1) * Math.cos(a) * half, py + (keepA ? 1 : -1) * Math.sin(a) * half, 0);
      }
      pontoon.visible = state === "collapsed";
    }
    function update(dt) { M.river.map.offset.y -= dt * 0.08; ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; }
    function check() {
      const r1 = (v) => +v.toFixed(2);
      group.updateMatrixWorld(true);
      const lows = {}, inv = world.matrixWorld.clone().invert();
      for (const s of spans) {   // 落ちた径間の桁のいちばん低い点と川底(world の座標 = m)
        if (state !== "collapsed" || !POSE[String(s.xa)]) continue;
        const bb = new THREE.Box3().setFromObject(s.g).applyMatrix4(inv);
        lows[s.xa] = { overBed: r1(bb.min.y - D.bed), x: [r1(bb.min.x), r1(bb.max.x)], z: [r1(bb.min.z), r1(bb.max.z)] };
      }
      return {
        navClearance_m: r1(deckY(111) - D.gd),                  // 航路径間の中央の桁下(水面から、誇張後)
        fallen: lows,                                            // 崩落の状態で、落ちた径間の最も低い点と川底の差(正 = 川底より上)と広がり(橋脚の柱の面と比べる)
        pontoonToBridge_m: D.pz - 4.5 - D.w / 2 - 3,            // 浮橋と橋のフーチングの隙間
        pontoonDeckOverWater_m: 1.85,
      };
    }
    U.bake(THREE, group, { dynamic: [...spans.map((s) => s.g), pontoon], live: [M.accent] });
    apply();   // 浮橋を表示したまま焼いてから状態を当てる
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, check, at, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; apply(); }, get state() { return state; },
      shots: {
        nav: { label: "航路径間", target: [110, 20, 0], pos: [160, 60, 170] },
        gap: { label: "崩落した径間", target: [270, 10, 20], pos: [210, 55, 190] },
        pontoon: { label: "浮橋", target: [-250, 2, 80], pos: [-200, 45, 200] },
        bank: { label: "右岸の取付け", target: [-320, 15, 0], pos: [-250, 60, -150] },
      },
    };
  }

  DreamAssets.fac.register("antonivka", {
    section: 1, title: "アントニウカ橋", kind: "STRATEGIC FACILITY · 1 交通・兵站",
    desc: "ヘルソンでドニプロ川を渡る道路橋。2022 年 11 月の撤退時に複数の径間が落とされ、途切れたまま。崩落の状態では隣に仮設の浮橋を架けた近未来版になる",
    info: [["ファイル", "mockups/3d/facilities/antonivka.js"], ["大きさ", "右岸の取付けから約 900 × 440 m を切り取り、0.2 倍 × 表示 3.0"], ["誇張", "桁の高さ(水面から)1.5 倍、橋脚の太さ 1.3 倍"], ["省略", "車両・人、照明柱"], ["状態", "健在 / 崩落(径間 3 つが落ちる + 仮設の浮橋)"], ["近未来化", "下流側の浮橋(浮体・車道・斜路・錨索)"]],
    dist: 1000, target: 25, tokenAt: [380, 0, 270],
    make: (THREE) => antonivka(THREE, { r: 100 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["健在", () => a.setState("intact"), () => a.state === "intact"], ["崩落 + 浮橋", () => a.setState("collapsed"), () => a.state === "collapsed"]],
    caption: (a) => (a.state === "collapsed" ? "崩落 — 径間が落ちて途切れ、下流に仮設の浮橋" : ""),
  });
})();
