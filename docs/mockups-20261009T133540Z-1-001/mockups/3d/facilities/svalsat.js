// 戦略施設トークン「スヴァールバル衛星局(SvalSat)」(ノルウェー、北極圏の山上の極軌道衛星の地上局)の詳細版モデル(試作)。
// プラトー山(Platåberget)の頂の雪原(640 × 420 m)と崖の斜面を切り出し、メートルで組んで K 倍する。雪原に白いレドームが並び、
// 管制棟、発電・変電、通信の鉄塔、本土へ向かう海底ケーブルの管路、斜面をつづら折りで上る道路。
// 象徴(「雪原に並ぶ白い球体」)を誇張: レドームの直径 1.5 倍(実物 約 10〜20 m → 15〜30 m)。平面の配置と台地の高さ(70 m の崖)は実寸の比率。
// レドームは中のアンテナを見せない(回るアンテナは使わない)。省略: 車両・人・雪上車。
// 近未来化(施設リストの案): アンテナの数でトークンの性能を表す。等級 I(8 基)/ II(18 基)/ III(30 基)で増設する。
//
// 状態: "t1" / "t2" / "t3"(アンテナの数)
(function () {
  const K = 0.2;
  const D = { base: -70, top: [320, 210, 40], foot: [400, 290, 60], domeS: 1.5 };
  const TIERS = [8, 18, 30];

  function build(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.snow = M.lambert(0xe3e9ef); M.rock = M.lambert(0xa9aeb2); M.dome = M.lambert(0xffffff);
    const group = new THREE.Group(); group.name = "svalsat";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const { add, box, cyl, V, tube, beam, closedLoft, prism, lattice } = F.kit(THREE, M, K);
    const rr = ([hx, hz, c], y) => [V(-hx + c, y, -hz), V(hx - c, y, -hz), V(hx, y, -hz + c), V(hx, y, hz - c), V(hx - c, y, hz), V(-hx + c, y, hz), V(-hx, y, hz - c), V(-hx, y, -hz + c)];

    // ── 台地: 崖の斜面(岩)と頂の雪原 ──
    add(closedLoft([rr(D.foot, D.base), rr(D.top, -0.4)]), M.rock, world);
    add(prism(rr(D.top, 0).map((p) => [p.x, p.z]), -0.4, 0.4), M.snow, world);
    const pl = U.slab(THREE, D.foot[0] + 3, D.foot[1] + 3, D.foot[2] + 1.2, 1.2); pl.translate(0, D.base, 0); add(pl, M.dark, world, { edges: false });
    // ── 道路: 頂の幹線と枝道、南の斜面のつづら折り ──
    const road = (x, z, w, d) => add(box(w, 0.25, d), M.mid, world, { x, y: 0.5, z, edges: false });
    road(0, 0, 600, 10); for (const x of [-200, 0, 200]) road(x, 0, 10, 380);
    const faceY = (z) => D.base * ((-D.top[1] - z) / (D.foot[1] - D.top[1]));   // 南(-z)の斜面の高さ
    const ramp = (x0, z0, x1, z1) => {
      const seg = (x, z, dz) => [V(x, faceY(z) + 0.8, z + dz), V(x, faceY(z) - 2, z + dz)];
      const a = [...seg(x0, z0, -5), ...seg(x0, z0, 5)], b = [...seg(x1, z1, -5), ...seg(x1, z1, 5)];
      add(closedLoft([[a[0], a[2], a[3], a[1]], [b[0], b[2], b[3], b[1]]]), M.mid, world, { edges: false });
    };
    ramp(-200, -212, 60, -238); ramp(60, -238, -160, -262); ramp(-160, -262, 120, -287);

    // ── 管制棟、発電・変電、通信の鉄塔、海底ケーブルの管路 ──
    add(box(80, 10, 22), M.body, world, { x: -60, y: 5.4, z: 175 });
    add(box(80.4, 2.4, 22.4), M.glass, world, { x: -60, y: 6.4, z: 175, edges: false });
    add(box(80.6, 0.8, 22.6), M.accent, world, { x: -60, y: 9.4, z: 175, edges: false });
    add(box(30, 7, 18), M.light, world, { x: 60, y: 3.9, z: 175 });   // 発電機棟(非常用)
    for (const e of [-8, 0, 8]) add(cyl(0.6, 6, 8), M.dark, world, { x: 60 + e, y: 10, z: 175 });
    for (let i = 0; i < 2; i++) { add(box(8, 6, 5), M.mid, world, { x: 105 + i * 14, y: 3.4, z: 178 }); for (const e of [-1, 1]) add(box(8, 4, 0.4), M.dark, world, { x: 105 + i * 14, y: 3, z: 178 + e * 2.9, edges: false }); }
    for (const [x, z] of [[-280, 180], [280, -170]]) { lattice(world, V(x, 0.4, z), 36, 3, 0.9, 4, 0.25, M.mid); for (const e of [0, 2.1, 4.2]) add(box(0.9, 3.5, 0.4), M.body, world, { x: x + Math.sin(e) * 1.4, y: 34, z: z + Math.cos(e) * 1.4, ry: e }); }
    for (const e of [-3, 3]) {   // 海底ケーブルの管路(管制棟から北の崖を下る)
      add(box(1.6, 0.6, 30), M.dark, world, { x: -20 + e, y: 0.7, z: 195, edges: false });
      const zt = D.top[1], zb = D.foot[1];
      add(closedLoft([[V(-21.5 + e, 0.3, zt), V(-18.5 + e, 0.3, zt), V(-18.5 + e, -0.6, zt), V(-21.5 + e, -0.6, zt)], [V(-21.5 + e, D.base + 0.6, zb), V(-18.5 + e, D.base + 0.6, zb), V(-18.5 + e, D.base - 0.3, zb), V(-21.5 + e, D.base - 0.3, zb)]]), M.dark, world, { edges: false });
    }

    // ── レドーム: 等級ごとの組。並びは道の両側。大きさは決まった乱数 ──
    const rnd = U.rng(7), slots = [];
    for (const z of [-45, 45, -128, 128]) for (const x of [-262, -160, -100, -40, 40, 100, 160, 262]) slots.push([x, z]);   // 枝道(x = 0, ±200)と幹線(z = 0)を避けた区画
    slots.sort((p, q) => Math.hypot(p[0], p[1] * 1.6) - Math.hypot(q[0], q[1] * 1.6));   // 中央から外へ順に増設
    const tiers = [new THREE.Group(), new THREE.Group(), new THREE.Group()]; for (const g of tiers) world.add(g);
    const domes = [];
    for (let k = 0; k < TIERS[2]; k++) {
      const [x, z] = slots[k], t = k < TIERS[0] ? 0 : k < TIERS[1] ? 1 : 2, g = tiers[t];
      const r = (5 + rnd() * 5) * D.domeS, base = 4 + rnd() * 3;   // 半径(実物 5〜10 m を 1.5 倍)、台の高さ
      const jx = x + (rnd() - 0.5) * 10, jz = z + (rnd() - 0.5) * 8;
      add(cyl(0.84 * r, base, 20), M.light, g, { x: jx, y: 0.4 + base / 2, z: jz });
      add(cyl(0.84 * r + 0.6, 0.8, 20), M.mid, g, { x: jx, y: 0.4 + base - 0.4, z: jz, edges: false });
      add(new THREE.IcosahedronGeometry(r, 2), M.dome, g, { x: jx, y: 0.4 + base + 0.55 * r, z: jz });
      add(box(6, 3.2, 4), M.light, g, { x: jx + 0.84 * r + 3.5, y: 2.0, z: jz });   // 機器の小屋
      domes.push({ x: jx, z: jz, r: 0.84 * r + 0.6 + 6.5 });   // 小屋まで含めた占有の半径
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 105, M.ring, M.disc);
    let state = opts.state ?? "t3";
    const apply = () => { const n = { t1: 1, t2: 2, t3: 3 }[state]; tiers.forEach((g, i) => { g.visible = i < n; }); };
    U.bake(THREE, group, { dynamic: tiers, live: [M.accent] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc }, at,
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      setState(s) { state = s; apply(); }, get state() { return state; },
      get count() { return TIERS[{ t1: 0, t2: 1, t3: 2 }[state]]; },
      check: () => {
        let gap = Infinity, road = Infinity, edge = Infinity;
        for (let i = 0; i < domes.length; i++) {
          const d = domes[i];
          for (let j = i + 1; j < domes.length; j++) gap = Math.min(gap, Math.hypot(d.x - domes[j].x, d.z - domes[j].z) - d.r - domes[j].r);
          road = Math.min(road, Math.abs(d.z) - 5 - d.r, ...[-200, 0, 200].map((x) => Math.abs(d.x - x) - 5 - d.r));
          edge = Math.min(edge, D.top[0] - Math.abs(d.x) - d.r, D.top[1] - Math.abs(d.z) - d.r);
        }
        return { domeGap_m: +gap.toFixed(1), domeToRoad_m: +road.toFixed(1), domeToCliff_m: +edge.toFixed(1) };   // レドーム(小屋を含む)どうし・道・崖の縁との最小の隙間
      },
      shots: {
        domes: { label: "雪原のレドーム", target: [0, 10, 0], pos: [160, 110, 260] },
        ops: { label: "管制棟・ケーブル", target: [-30, 0, 190], pos: [110, 60, 360] },
        road: { label: "崖とつづら折り", target: [0, -35, -250], pos: [220, 20, -460] },
      },
    };
  }

  DreamAssets.fac.register("svalsat", {
    section: 6, title: "SvalSat", kind: "STRATEGIC FACILITY · 6 情報・通信・産業",
    desc: "北極圏の山上の雪原に、白いレドームのアンテナが多数並ぶ極軌道衛星の地上局。2022 年 1 月に本土と結ぶ海底ケーブルの 1 本が損傷した。アンテナの数(等級 I〜III)でトークンの性能を表す近未来版",
    info: [["ファイル", "mockups/3d/facilities/svalsat.js"], ["大きさ", "台地 800 × 580 m(頂 640 × 420 m)を 0.2 倍 × 表示 3.0"], ["誇張", "レドームの直径 1.5 倍。台地の高さと平面は実寸の比率"], ["省略", "車両・人、レドームの中のアンテナ"], ["近未来化", "アンテナ数の等級 I 8 基 / II 18 基 / III 30 基"]],
    dist: 1050, target: 25, tokenAt: [380, 0, 300],
    make: (THREE) => build(THREE, { r: 105 }),
    actLabel: "TIER · アンテナ数", progress: false,
    actions: (a) => [["I(8 基)", () => a.setState("t1"), () => a.state === "t1"], ["II(18 基)", () => a.setState("t2"), () => a.state === "t2"], ["III(30 基)", () => a.setState("t3"), () => a.state === "t3"]],
    caption: () => "",
  });
})();
