// 戦略施設トークン「ホーンシー洋上風力発電所」(英国北海)の詳細版モデル(試作)。
// 発電所全体(数百 km²)は大きすぎるので、洋上変電所を中心にした 1 区画(風車 12 基、間隔 900 m の格子)を切り取り、メートルで組んで K 倍して模型にする。
// 誇張: 風車と洋上変電所の大きさ 3 倍(施設リストの決め手「海上に格子状に並ぶ風車」。実寸では格子の間隔に対して小さすぎて読めない)。格子の間隔と水深は実寸。
// 省略: 作業船・人・風車の足元の乗船設備や手すり。
// 近未来化(施設リストの案): 洋上変電所を中枢にする(屋上にセンサーの塔と通信の箱)。海底の集電ケーブルで全風車が変電所につながり、押さえると全体が止まる。
// 状態: "run"(発電。ロータが回る)/ "stop"(洋上変電所を押さえられ全体が停止。ロータはブレーキで止まる)
(function () {
  const K = 0.05;
  const EX = 3.0;
  const D = { x0: -1800, x1: 1800, z0: -1100, z1: 1100, sea: 0, bed: -30, base: -34 };
  const WT = { hub: 113, R: 83.5, tower: [3.2, 2.2], tp: 20, overhang: 10 };   // 風車(ハブ高さ、ロータ半径、塔の下端・上端の半径、トランジションピース、ハブの張り出し)
  const TURBINES = []; for (const z of [-700, 0, 700]) for (const x of [-1350, -450, 450, 1350]) TURBINES.push([x, z]);
  const RPM = 10;

  function hornsea(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.tp = M.lambert(0xf0c43a);   // トランジションピース(実物と同じ黄色)
    M.cable = M.lambert(0x2e3a44);
    const group = new THREE.Group(); group.name = "hornsea";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, tube, prism, closedLoft, lattice } = k;
    const W = D.x1 - D.x0, H = D.z1 - D.z0;

    // ── 海底、海面、水の切り口、足元の暗い帯 ──
    add(box(W, D.bed - D.base, H), M.light, world, { y: (D.base + D.bed) / 2, edges: false });
    const sea = k.waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], k.water()); world.add(sea);
    const cut = -D.bed;
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(W, cut), { y: D.bed / 2, z: D.z0 }], [new THREE.PlaneGeometry(W, cut), { y: D.bed / 2, z: D.z1 }],
      [new THREE.PlaneGeometry(H, cut), { x: D.x0, y: D.bed / 2, ry: Math.PI / 2 }], [new THREE.PlaneGeometry(H, cut), { x: D.x1, y: D.bed / 2, ry: Math.PI / 2 }],
    ]), M.waterCut));
    F.plinth(k, M, world, W, H, D.base, { h: 3 });
    // 海底の集電ケーブル(風車 → 洋上変電所)と陸への送電ケーブル。見えるように太くした
    const cable = (ax, az, bx, bz, w = 7) => { const L = Math.hypot(bx - ax, bz - az); add(box(w, 1.2, L), M.cable, world, { x: (ax + bx) / 2, y: D.bed + 0.6, z: (az + bz) / 2, ry: Math.atan2(bx - ax, bz - az), edges: false }); };
    for (const z of [-700, 0, 700]) { cable(-1350, z, -450, z); cable(450, z, 1350, z); }
    for (const z of [-700, 700]) { cable(-450, z, 0, 0); cable(450, z, 0, 0); }
    cable(-450, 0, 0, 0); cable(450, 0, 0, 0);
    cable(0, 0, 0, D.z0, 22);

    // ── 風車 12 基(モノパイル、黄色のトランジションピースと作業床、塔、ナセル)。ロータは別に組んで 1 つの InstancedMesh にする ──
    const towerG = new THREE.CylinderGeometry(WT.tower[1], WT.tower[0], WT.hub - WT.tp - 3, 16);
    const nacG = closedLoft([[-6, 0], [9, 0]].map(([x, s]) => [V(x, -2.6, -2.8), V(x, -2.6, 2.8), V(x, 2.6, 2.8), V(x, 2.6, -2.8)]));
    const rotors = [];
    for (const [x, z] of TURBINES) {
      const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(EX); world.add(t);
      add(cyl(4, -D.bed / EX + 2, 12), M.mid, t, { y: (D.bed / EX - 2) / 2 + 0.5 });           // モノパイル(海面の下)
      add(cyl(3.6, WT.tp, 16), M.tp, t, { y: WT.tp / 2 });                                     // トランジションピース
      add(cyl(6.5, 0.6, 16), M.light, t, { y: WT.tp - 2 });                                    // 作業床
      add(box(1.2, 8, 2.2), M.dark, t, { x: 3.8, y: 4, edges: false });                         // 乗船設備(J チューブとはしご)
      add(towerG, M.body, t, { y: WT.tp + (WT.hub - WT.tp - 3) / 2 });
      add(nacG, M.body, t, { x: -1.5, y: WT.hub });                                            // ナセル(ハブは +x)
      add(box(4, 2.2, 4.4), M.light, t, { x: -6.5, y: WT.hub + 3.2 });                          // 屋根の冷却器
      add(box(3, 0.4, 0.4), M.dark, t, { x: -4, y: WT.hub + 2.9, z: 2.2, edges: false });     // 風向計の台
      const r = new THREE.Group(); r.position.set(x + WT.overhang * EX, WT.hub * EX, z); r.scale.setScalar(EX); world.add(r);
      rotors.push(r);
    }
    // ロータ(スピナーと 3 枚の翼。翼は付け根の楕円から先端の細い断面へ。弦と厚さは読めるよう 1.5 倍)
    const blade = (rot) => {
      const secs = [[2.5, 2.4, 2.4], [8, 5.2, 2.6], [30, 4.2, 1.5], [60, 2.6, 0.8], [WT.R, 1.0, 0.3]];   // [半径, 弦, 厚さ]
      const rings = secs.map(([y, c, th]) => [V(-th * 0.75, y, 0), V(0, y, c * 0.75 * 0.4), V(th * 0.75, y, 0), V(0, y, -c * 0.75)]);
      const g = closedLoft(rings); g.rotateX(rot); return g;
    };
    const proto = rotors[0];
    for (const r of rotors) {
      add(new THREE.SphereGeometry(3.2, 12, 8).scale(1.6, 1, 1), M.body, r, { x: 1.5, edges: false });
      for (let b = 0; b < 3; b++) add(blade((b * Math.PI * 2) / 3), M.body, r, { edges: false });
    }

    // ── 洋上変電所(4 本脚のジャケット、3 層の上部構造、変圧器室、クレーン、近未来化のセンサーの塔)──
    const oss = new THREE.Group(); oss.scale.setScalar(EX); world.add(oss);
    const leg = (sx, sz, y) => V(sx * (14 - y * 0.08), y, sz * (11 - y * 0.08));
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]], LV = [D.bed / EX, -8, 6, 22];
    for (const [sx, sz] of C) tube(oss, leg(sx, sz, LV[0]), leg(sx, sz, LV[3]), 1.3, M.light);
    for (let l = 0; l < LV.length - 1; l++) for (let c = 0; c < 4; c++) {
      const [ax, az] = C[c], [bx, bz] = C[(c + 1) % 4];
      tube(oss, leg(ax, az, LV[l]), leg(bx, bz, LV[l + 1]), 0.5, M.light); tube(oss, leg(bx, bz, LV[l]), leg(ax, az, LV[l + 1]), 0.5, M.light);
      tube(oss, leg(ax, az, LV[l + 1]), leg(bx, bz, LV[l + 1]), 0.5, M.light);
    }
    add(box(42, 2, 34), M.mid, oss, { y: 23 });                                               // 主甲板
    add(box(40, 9, 32), M.body, oss, { y: 28.5 });                                            // 下層(変圧器室)
    for (const dx of [-12, 0, 12]) add(box(8, 6.5, 0.4), M.dark, oss, { x: dx, y: 28, z: 16.1, edges: false });   // 変圧器室の通風口
    add(box(40.4, 1.2, 32.4), M.accent, oss, { y: 33.6, edges: false });
    add(box(36, 7, 28), M.light, oss, { y: 37.7 });                                           // 中層(開閉装置)
    for (const y of [36, 39]) add(box(36.2, 0.8, 28.2), M.glass, oss, { y, edges: false });
    add(box(24, 5, 18), M.body, oss, { x: -4, y: 43.7 });                                     // 上層(制御・居住)
    for (const [x, z] of [[8, -8], [8, 0], [8, 8]]) add(cyl(2.4, 3, 12), M.mid, oss, { x, y: 42.7, z });   // 冷却ファンの筒
    add(cyl(1.6, 8, 10), M.light, oss, { x: 16, y: 44, z: -11 }); tube(oss, V(16, 47, -11), V(2, 62, -14), 0.7, M.light);   // クレーン
    lattice(oss, V(-10, 46.2, 0), 16, 1.6, 0.6, 3, 0.18);                                     // センサーの塔
    add(box(3.2, 1.4, 1.4), M.body, oss, { x: -10, y: 63, z: 0.5 }); add(box(1.1, 0.9, 1.1), M.dark, oss, { x: -10, y: 64.3, z: -0.6 });
    add(box(0.8, 0.5, 0.1), M.glass, oss, { x: -10, y: 64.4, z: -0.02, edges: false });
    for (const [sx, sz] of C) add(cyl(1.2, 14, 8), M.dark, oss, { x: sx * 16, y: 14, z: sz * 13, edges: false });   // ケーブルの J チューブ

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 108, M.ring, M.disc);
    // ロータは全部同じ中身なので、焼き込みで 1 つの InstancedMesh にして回す
    const baked = U.bake(THREE, group, { live: [M.accent], instanced: [{ groups: rotors, staticEdges: false }] });
    void proto;

    let state = opts.state ?? "run", spin = state === "run" ? 1 : 0, angle = 0;
    function update(dt) {
      const target = state === "run" ? 1 : 0;
      spin += Math.sign(target - spin) * Math.min(Math.abs(target - spin), dt / 4);   // 起動・制動は 4 秒
      angle += dt * spin * (RPM / 60) * Math.PI * 2;
      rotors.forEach((r, i) => { r.rotation.x = angle + i * 0.7; });
      baked.sync();
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
      sea.material.map.offset.y -= dt * 0.04;
    }
    function setState(s) { if (s === "run" || s === "stop") state = s; }
    update(0);
    const r1 = (v) => +v.toFixed(1);
    function check() {
      const towerR = WT.tower[1] + (WT.tower[0] - WT.tower[1]) * (WT.R / (WT.hub - WT.tp));
      return {
        tipOverSea_m: r1((WT.hub - WT.R) * EX),                                   // 下を通る翼の先端と海面
        bladeToTower_m: r1((WT.overhang - towerR - 2.4 * 0.75) * EX),              // 翼(付け根の厚さ)と塔の隙間
        rotorGap_m: r1(900 - 2 * WT.R * EX),                                      // 隣り合うロータどうしの隙間
        rotorToOss_m: r1(450 - WT.R * EX - 21 * EX),                               // ロータと洋上変電所の上部構造の隙間
        hubHeight_m: r1(WT.hub * EX), rotorDia_m: r1(2 * WT.R * EX),
      };
    }
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        oss: { label: "洋上変電所", target: [0, 80, 0], pos: [330, 260, 430] },
        turbine: { label: "風車", target: [450, 240, -700], pos: [1050, 330, -250] },
        grid: { label: "格子(低く)", target: [0, 100, 0], pos: [-1500, 300, 1400] },
      },
    };
  }

  DreamAssets.fac.register("hornsea", {
    section: 4, title: "ホーンシー洋上風力", kind: "STRATEGIC FACILITY · 4 エネルギー",
    desc: "世界最大級の洋上風力発電群。海上に格子状に並ぶ風車と洋上変電所。変電所を中枢にし、そこを押さえると風車群全体が止まる近未来版(洋上変電所の 1 区画を切り取り)",
    info: [["ファイル", "mockups/3d/facilities/hornsea.js"], ["大きさ", "1 区画 3.6 × 2.2 km を 0.05 倍 × 表示 3.0"], ["誇張", "風車と洋上変電所 3 倍、翼の弦と厚さ 1.5 倍、海底ケーブルを太く。格子の間隔と水深は実寸"], ["省略", "作業船・人・乗船設備の手すり"], ["近未来化", "洋上変電所を中枢化(センサーの塔)。押さえると全体が停止"]],
    dist: 1150, target: 40, tokenAt: [430, 0, 330],
    make: (THREE) => hornsea(THREE, { r: 108 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["発電", () => a.setState("run"), () => a.state === "run"], ["停止(変電所を制圧)", () => a.setState("stop"), () => a.state === "stop"]],
    caption: (a) => (a.state === "stop" ? "洋上変電所を押さえられ、風車群全体が停止" : ""),
  });
})();
