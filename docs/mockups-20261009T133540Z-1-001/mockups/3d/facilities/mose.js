// 戦略施設トークン「MOSE」(イタリア・ヴェネツィア、潟の入口の可動ゲート)の詳細版モデル(試作)。
// リド水道のトレポルティ側の 1 列(ゲート 21 枚、幅 420 m)を、北の岸の肩(スパッラ)から人工島まで切り取った。平面は実寸の比率(K = 0.3)。
// 誇張: ゲートの長さ 1.5 倍(30 m)、高潮の水位差 2 倍。ゲートは実物と同じ黄色(施設リストの「モデルの決め手」)。
// 平時はゲートが海底のケーソンの溝に水を満たして横たわり、水面下に隠れる。作動時は圧縮空気で排水して蝶番まわりに起き上がり(1 枚ずつ時間差)、波で 1 枚ずつ揺れる。
// 省略: 船・作業船・人。ケーソンの中の点検通路は見えないので作らない。
//
// 状態: "rest"(平時)→ "raising"(12 秒)→ "raised"(作動。海側の水位が上がる)→ "lowering" → "rest"
// 水道は z 方向、+z がアドリア海、-z が潟。x は北の岸(-x)から人工島(+x)。
(function () {
  const K = 0.3;
  const D = {
    ground: 3, bed: -11.5, base: -18, caisson: -11, recess: -15.5,
    n: 21, pitch: 20, gw: 19.2, gl: 30, gt: 4.5,   // ゲートの数、間隔、幅、長さ(実物 約 20 m を 1.5 倍)、厚さ
    hingeZ: -10, raise: 50 * (Math.PI / 180), surge: 3,
    x0: -300, x1: 300, z0: -150, z1: 150, shore: -225, isle: 225, gate: 210,
    lock: [252, 268],   // 人工島の小型船の閘門(水路の x)
  };
  D.hingeY = D.caisson - D.gt / 2;
  const SEC = 12;
  const YELLOW = 0xf2cf3a;

  function mose(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const { add, box, cyl, V, prism, tube } = F.kit(THREE, M, K);
    M.yellow = M.lambert(YELLOW);
    M.lagoon = U.waterMaterial(THREE); M.lagoon.side = THREE.DoubleSide;
    M.sea = U.waterMaterial(THREE); M.sea.side = THREE.DoubleSide;
    const group = new THREE.Group(); group.name = "mose";
    const XC = (D.x0 + D.x1) / 2, ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, -ZC * K); group.add(world);
    const R = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    // 複数の多角形(穴あり可)を 1 枚の水面にする。uv は共通の水面と同じ線の大きさ
    const waterMesh = (polys, mat) => {
      const shapes = polys.map((p) => {
        const sh = new THREE.Shape((p.pts ?? p).map(([x, z]) => new THREE.Vector2(x, -z)));
        for (const h of p.holes ?? []) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
        return sh;
      });
      const g = new THREE.ShapeGeometry(shapes); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) * K) / U.WATER_TILE[0], (-p.getZ(i) * K) / U.WATER_TILE[1]);
      const m = new THREE.Mesh(g, mat); world.add(m); return m;
    };

    // ── 台座: 海底、ケーソン(ゲートの溝つき)、北の岸、人工島(小型船の閘門で 2 つに分かれる)、肩の構造物 ──
    F.plinth({ add, box }, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.6, { x: XC, z: ZC });
    const gx = (i) => -D.gate + D.pitch / 2 + i * D.pitch;   // ゲートの中心の x
    const RZ = [D.hingeZ - 2.5, D.hingeZ + D.gl + 0.5];        // 溝の z
    const holes = Array.from({ length: D.n }, (_, i) => R(gx(i) - D.gw / 2 - 0.2, RZ[0], gx(i) + D.gw / 2 + 0.2, RZ[1]));
    add(prism(R(-D.gate, -18, D.gate, 34), D.recess, D.caisson, holes), M.mid, world);
    add(prism(R(D.shore, D.z0, D.isle, D.z1), D.base, D.bed, [R(-D.gate, -18, D.gate, 34)]), M.light, world, { edges: false });   // 海底(ケーソンの所を抜く)
    add(box(2 * D.gate, D.recess - D.base, 52), M.dark, world, { y: (D.base + D.recess) / 2, z: 8, edges: false });                  // 溝の底
    for (let i = 0; i < D.n; i++) for (const sx of [-7, 7]) add(box(2.4, 1.2, 2.6), M.dark, world, { x: gx(i) + sx, y: D.recess + 0.6, z: D.hingeZ, edges: false });   // 蝶番の受け
    // 北の岸(トレポルティ)と人工島
    add(prism(R(D.x0, D.z0, D.shore, D.z1), D.base, D.ground), M.land, world);
    add(prism(R(D.isle, D.z0, D.lock[0], D.z1), D.base, D.ground), M.land, world);
    add(prism(R(D.lock[1], D.z0, D.x1, D.z1), D.base, D.ground), M.land, world);
    add(box(D.lock[1] - D.lock[0], -5 - D.base, D.z1 - D.z0), M.mid, world, { x: (D.lock[0] + D.lock[1]) / 2, y: (D.base - 5) / 2, z: ZC, edges: false });   // 閘門の水路の底
    // 肩(スパッラ): ゲート列の両端のコンクリートの塊。上に機械室
    for (const [xa, xb] of [[D.shore, -D.gate], [D.gate, D.isle]]) {
      add(prism([[xa, -40], [xb, -32], [xb, 36], [xa, 44]], D.base, 4.5), M.light, world);
      const xm = (xa + xb) / 2;
      add(box(12, 7, 30), M.body, world, { x: xm, y: 8, z: 2 });
      add(box(12.2, 1.2, 30.2), M.glass, world, { x: xm, y: 9.2, z: 2, edges: false });
      add(box(12.4, 0.5, 30.4), M.accent, world, { x: xm, y: 10.5, z: 2, edges: false });
      for (const z of [-8, 4, 14]) add(box(3, 1.4, 3), M.mid, world, { x: xm, y: 12.2, z });
    }
    // 北の岸の管制棟(2 階、屋上に箱形のレーダーの覆い)と護岸
    add(box(40, 10, 24), M.body, world, { x: -262, y: 8, z: -70 });
    for (const y of [6.2, 9.8]) add(box(40.2, 1.4, 24.2), M.glass, world, { x: -262, y, z: -70, edges: false });
    add(box(40.6, 0.6, 24.6), M.light, world, { x: -262, y: 13.3, z: -70 });
    add(box(4, 2, 2.4), M.body, world, { x: -250, y: 14.6, z: -66 });
    tube(world, V(-275, 13.5, -76), V(-275, 24, -76), 0.25, M.dark);
    for (const z of [-140, 60, 140]) add(box(4, 1.0, 50), M.mid, world, { x: D.shore + 2, y: D.ground + 0.5, z: z === -140 ? -115 : z === 60 ? 70 : 125, edges: false });
    // 人工島: 圧縮空気の機械棟(ゲートを起こす空気を送る)、管理棟、閘門(合掌扉 2 組、閉)
    add(box(26, 12, 64), M.body, world, { x: 284, y: 9, z: -52 });
    for (let k = 0; k < 6; k++) add(box(26.2, 0.25, 6), M.dark, world, { x: 284, y: 6 + (k % 2) * 4, z: -78 + k * 10, edges: false });   // 吸気のルーバー
    for (let k = 0; k < 5; k++) add(box(3, 2, 3), M.mid, world, { x: 280 + (k % 2) * 8, y: 16, z: -76 + k * 11 });
    add(box(26.4, 0.5, 64.4), M.accent, world, { x: 284, y: 14.6, z: -52, edges: false });
    add(box(20, 8, 26), M.body, world, { x: 238, y: 7, z: -70 });
    add(box(20.2, 1.4, 26.2), M.glass, world, { x: 238, y: 8, z: -70, edges: false });
    for (const zg of [30, 70]) for (const s of [-1, 1]) {   // 合掌扉: 2 枚が海側(高い側)へ向けて V 字に合わさる
      const len = 9.4, a = s * 0.35;
      add(box(len, 9, 1.2), M.steel, world, { x: (D.lock[0] + D.lock[1]) / 2 + (s * len * Math.cos(a)) / 2 - s * 0.05, y: -0.5, z: zg + (len * Math.sin(Math.abs(a))) / 2, ry: -a });
    }
    for (const x of D.lock) for (const zg of [30, 70]) add(cyl(1.0, 2.2, 8), M.dark, world, { x: x + (x < 260 ? -1.6 : 1.6), y: D.ground + 1.1, z: zg });   // 扉の開閉機(扉の軸の上)

    // 突堤(捨石の斜面の防波堤)。水道の両側から海へ
    for (const [xa, s] of [[D.shore, 1], [D.isle, -1]]) {
      const prof = [[xa, D.bed], [xa + s * 34, D.bed], [xa + s * 22, D.ground + 1], [xa + s * 8, D.ground + 1]].map(([x, y]) => [x, y]);
      add(U.loft(THREE, [{ z: 60, pts: s > 0 ? prof : prof.slice().reverse() }, { z: D.z1, pts: s > 0 ? prof : prof.slice().reverse() }]), M.mid, world);
      for (let z = 70; z < D.z1; z += 16) add(box(5, 2.2, 5), M.light, world, { x: xa + s * 28, y: D.bed + 0.5 + (D.ground - D.bed) * 0.25, z, ry: 0.7, edges: false });   // 消波ブロック
    }
    // ケーソンの継ぎ目(ケーソン 1 函にゲート 2 枚)と、圧縮空気の配管(機械棟 → 肩の立坑 → ケーソンの中の通路)
    for (let i = 0; i <= D.n; i += 2) add(box(0.6, 0.1, 52), M.dark, world, { x: -D.gate + i * D.pitch, y: D.caisson + 0.05, z: 8, edges: false });
    for (const dz of [-3, 0, 3]) {
      tube(world, V(271, 4.2 + dz * 0.1, -52 + dz), V(240, 4.2, -52 + dz), 0.8, M.steel);
      tube(world, V(240, 4.2, -52 + dz), V(220, 4.2, -38 + dz), 0.8, M.steel);
    }
    for (const x of [D.gate + 7, -D.gate - 7]) { add(box(8, 6, 8), M.light, world, { x, y: 7.5, z: -26 }); add(box(8.2, 0.5, 8.2), M.dark, world, { x, y: 10.6, z: -26, edges: false }); }   // 立坑の上屋
    for (const x of [D.gate + 4, D.gate + 11, -D.gate - 4, -D.gate - 11]) add(cyl(0.5, 4, 8), M.mid, world, { x, y: 6.5, z: 28 });   // 換気筒

    // ── 近未来化(施設リストの案は「平時は水面下に隠れ、作動時だけ現れる」こと自体)。潮位計の観測柱を両側の肩の先に ──
    for (const x of [-D.gate - 8, D.gate + 8]) {
      add(cyl(1.2, 22, 10), M.mid, world, { x, y: D.bed + 11, z: 46 });
      add(box(3.4, 2.4, 3.4), M.body, world, { x, y: 1.0 + 0.5 + 9, z: 46 });
      add(box(2.2, 0.8, 0.12), M.glass, world, { x, y: 10.8, z: 47.75, edges: false });
    }

    // ── 水面: 潟(-z)と海(+z)。境はゲートの蝶番の線。閘門の水路は扉で分ける ──
    const lagoon = waterMesh([R(D.shore, D.z0, D.isle, D.hingeZ), R(D.lock[0], D.z0, D.lock[1], 70)], M.lagoon);
    const sea = waterMesh([R(D.shore, D.hingeZ, D.isle, D.z1), R(D.lock[0], 70, D.lock[1], D.z1)], M.sea);
    const cutG = U.merge(THREE, [D.z0, D.z1].map((z) => [new THREE.PlaneGeometry(D.isle - D.shore, -D.bed), { x: (D.isle + D.shore) / 2, y: D.bed / 2, z }]));
    const cut = new THREE.Mesh(cutG, M.waterCut); world.add(cut);

    // ── ゲート 21 枚(InstancedMesh 1 つ)。黄色の中空の箱、喫水の下は暗い防汚塗装、蝶番の金具 ──
    const cat = (geo, color, x, y, z) => ({ geo: geo.toNonIndexed().translate(x, y, z), color: new THREE.Color(color) });
    const gateG = U.concat(THREE, [
      cat(box(D.gw, D.gt, D.gl * 0.35), P_DARK, 0, 0, D.gl * 0.175),
      cat(box(D.gw, D.gt, D.gl * 0.65), YELLOW, 0, 0, D.gl * 0.675),
      ...[-6.4, 0, 6.4].map((x) => cat(box(0.35, 0.12, D.gl * 0.62), 0x9a8020, x, D.gt / 2 + 0.06, D.gl * 0.675)),   // 上面の区画の継ぎ目
      ...[0.45, 0.7].map((f) => cat(box(D.gw - 1, 0.12, 0.35), 0x9a8020, 0, D.gt / 2 + 0.06, D.gl * f)),
      cat(box(1.4, 0.6, 1.4), 0xfbfcfd, -6.4 - 2, D.gt / 2 + 0.3, D.gl * 0.42),                                // 空気の弁の箱
      cat(box(D.gw + 0.2, D.gt + 0.2, 0.9), 0xfbfcfd, 0, 0, D.gl - 0.35),                              // 先端の縁
      ...[-7, 7].map((x) => cat(box(2.6, D.gt + 0.6, 2.4), P_DARK, x, 0, 1.2)),                         // 蝶番の金具
    ]);
    const gates = new THREE.InstancedMesh(gateG, U.vcLambert(THREE), D.n); world.add(gates); gates.frustumCulled = false;
    const mt = new THREE.Matrix4(), mr = new THREE.Matrix4();
    const angles = new Array(D.n).fill(0);
    const layGates = () => {
      for (let i = 0; i < D.n; i++) { mt.makeTranslation(gx(i), D.hingeY, D.hingeZ); mr.makeRotationX(-angles[i]); gates.setMatrixAt(i, mt.multiply(mr)); }
      gates.instanceMatrix.needsUpdate = true;
    };

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);

    // ── 状態と更新 ──
    const ease = (x) => x * x * (3 - 2 * x), clamp = (x) => Math.min(1, Math.max(0, x));
    let state = opts.state ?? "rest", t = state === "raised" ? 1 : 0, clock = 0;
    const gateP = (i, tt) => ease(clamp((tt * 1.25 - (i / (D.n - 1)) * 0.25) / 0.75));   // 0 = 横たわる、1 = 起き上がる(端から順に)
    const surgeP = (tt) => ease(clamp((tt - 0.75) / 0.25));                                // ゲートが起きてから海側が上がる
    function apply() {
      for (let i = 0; i < D.n; i++) {
        const p = gateP(i, t), sway = p * 0.026 * Math.sin(clock * 0.9 + i * 1.7);   // 起きたゲートは波で 1 枚ずつ揺れる(±1.5°)
        angles[i] = D.raise * p + sway;
      }
      layGates();
      sea.position.y = D.surge * surgeP(t);
    }
    function update(dt) {
      clock += dt;
      if (state === "raising") { t = Math.min(1, t + dt / SEC); if (t >= 1) state = "raised"; }
      if (state === "lowering") { t = Math.max(0, t - dt / SEC); if (t <= 0) state = "rest"; }
      apply();
      const flow = 0.12 * (1 - ease(t));   // ゲートが起きると潟への流れが止まる
      M.lagoon.map.offset.y += dt * flow; M.sea.map.offset.y += dt * (flow + 0.02);
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "rest" || s === "raised") { state = s; t = s === "raised" ? 1 : 0; apply(); }
      else if (s === "raising" || s === "lowering") state = s;
    }
    function check() {
      // ゲートの 8 隅を揺れを含む全角度で回し、溝の床・壁・隣のゲートとの隙間を測る
      let floor = Infinity, wallLo = Infinity, wallHi = Infinity;
      for (let a = 0; a <= D.raise + 0.03; a += 0.01) for (const y of [-D.gt / 2, D.gt / 2]) for (const z of [0, D.gl + 0.1]) {
        const yy = D.hingeY + y * Math.cos(-a) - z * Math.sin(-a), zz = D.hingeZ + y * Math.sin(-a) + z * Math.cos(-a);
        if (zz < RZ[1] && zz > RZ[0]) floor = Math.min(floor, yy - D.recess);
        if (yy < D.caisson) { wallLo = Math.min(wallLo, zz - RZ[0]); wallHi = Math.min(wallHi, RZ[1] - zz); }
      }
      const tipY = D.hingeY + D.gl * Math.sin(D.raise);
      const r1 = (v) => +v.toFixed(2);
      return {
        recessFloor_m: r1(floor), recessWallLagoon_m: r1(wallLo), recessWallSea_m: r1(wallHi),   // 溝の床・潟側・海側の壁との最小の隙間(揺れ ±1.5° を含む)
        gateSideGap_m: r1(D.pitch - D.gw), recessSideGap_m: 0.2,                               // 隣のゲート・溝の側壁との隙間
        restTopToCaisson_m: r1(D.hingeY + D.gt / 2 - D.caisson),                               // 平時の上面とケーソン上面の差(0 = 面一、水面下に隠れる)
        raisedTipAboveSea_m: r1(tipY - D.surge),                                               // 作動時の先端と高潮の水面の差
      };
    }
    apply();
    U.bake(THREE, group, { live: [M.accent] });
    const at = (x, y, z) => V((x - XC) * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; }, get progress() { return t; },
      shots: {
        gates: { label: "ゲート列(海側から)", target: [-40, 0, 5], pos: [60, 45, 150] },
        hinge: { label: "蝶番と溝(水面下)", target: [-120, -10, 0], pos: [-60, 22, -60] },
        isle: { label: "人工島(機械棟・閘門)", target: [255, 2, 0], pos: [180, 70, 120] },
      },
    };
  }
  const P_DARK = 0x3b4752;

  DreamAssets.fac.register("mose", {
    section: 2, title: "MOSE", kind: "STRATEGIC FACILITY · 2 水門・閘門・防潮堤",
    desc: "ヴェネツィアの潟の入口の可動ゲート。平時は海底のケーソンの溝に沈んで見えず、高潮のときだけ黄色いゲートが 1 枚ずつ起き上がって海を仕切る。リド水道の 1 列(21 枚)を切り取った",
    info: [["ファイル", "mockups/3d/facilities/mose.js"], ["大きさ", "実寸 600 × 300 m を 0.3 倍 × 表示 3.0"], ["誇張", "ゲートの長さ 1.5 倍(30 m)、高潮の水位差 2 倍。色は実物の黄色"], ["省略", "船・作業船・ケーソンの中の点検通路"], ["動作", "圧縮空気で排水して起き上がる(端から順に、12 秒)、波で揺れる"], ["近未来化", "平時は水面下に隠れ、作動時だけ現れる状態トークン。潮位の観測柱"]],
    dist: 950, target: 20, tokenAt: [360, 0, 240],
    make: (THREE) => mose(THREE, { r: 100 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["平時", () => a.setState("rest"), () => a.state === "rest"], ["作動 ▶", () => a.setState("raising"), () => a.state === "raising"], ["作動中", () => a.setState("raised"), () => a.state === "raised"], ["◀ 収納", () => a.setState("lowering"), () => a.state === "lowering"]],
    caption: (a) => (a.state === "raising" ? "作動中 — ゲートを排水して起こす" : a.state === "lowering" ? "収納中 — ゲートに注水して溝へ沈める" : ""),
  });
})();
