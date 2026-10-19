// 中規模拠点「工場」の詳細版モデル(試作)。建築模型の方針(白・明灰・暗、チーム色はアクセントだけ、輪郭線)。
// のこぎり屋根の生産棟(組み立ては屋内。外からは見せない)と、閉じたシャッターの搬出口2つ。出荷の動きは入れない(動くのは煙と照明だけ)。
// 右奥にボイラー棟と煙突2本(煙)、貯蔵タンク2基と配管ラック、右手前に事務棟、左手前に鋼材置き場。
//
//   const f = DreamAssets.factory(THREE, { r: 75 });   // r = 制圧圏の半径(mid.radius)。ビューアでは表示倍率 3.0
//   scene.add(f.group); f.setTeam(0xff6a1a); f.setState("run" | "stop"); f.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3, glass: 0x5d7486, hazard: 0xffc83d };

  function factory(THREE, opts = {}) {
    const U = DreamAssets.util;
    const r = opts.r ?? 75, D = 4;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      body: lambert(P.body), light: lambert(P.light), mid: lambert(P.mid), dark: lambert(P.dark), glass: lambert(P.glass), accent: lambert(P.neutral),
      hazard: lambert(P.hazard), steel: lambert(0x9aa3ad),
      smoke: lambert(0xffffff, { transparent: true, opacity: 0.5, depthWrite: false, flatShading: true }),
      lamp: basic(0xfff3c4), lampOff: basic(0x8b8f86),
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 12, gapSize: 9, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.08, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "factory";
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);

    // ── 台座 ──
    const HX = 56, HZ = 46;
    add(U.slab(THREE, HX, HZ, 12, D), M.body, group);
    add(U.slab(THREE, HX + 3, HZ + 3, 13.5, 1), M.dark, group, { edges: false });

    // ── 生産棟: 壁 + のこぎり屋根(前向きの面がガラス)、前面の帯 ──
    const X0 = -54, X1 = 18, Z0 = -42, Z1 = 2, WH = 14, W = X1 - X0;
    add(box(W, WH, Z1 - Z0), M.body, group, { x: (X0 + X1) / 2, y: D + WH / 2, z: (Z0 + Z1) / 2 });
    add(box(W + 0.4, 1.2, Z1 - Z0 + 0.4), M.accent, group, { x: (X0 + X1) / 2, y: D + WH - 1.4, z: (Z0 + Z1) / 2, edges: false });
    const TEETH = 5, TD = (Z1 - Z0) / TEETH, TH = 6;
    for (let k = 0; k < TEETH; k++) {
      const z0 = Z0 + k * TD;
      const g = new THREE.ExtrudeGeometry(new THREE.Shape([[-z0, 0], [-z0 - TD, 0], [-z0 - TD, TH]].map(([a, b]) => new THREE.Vector2(a, b))), { depth: W, bevelEnabled: false });
      g.rotateY(Math.PI / 2);                                                                        // 局所 x → 世界 -z、押し出し → 世界 x
      add(g, M.light, group, { x: X0, y: D + WH });
      add(box(W, TH - 0.6, 0.3), M.glass, group, { x: (X0 + X1) / 2, y: D + WH + TH / 2, z: z0 + TD + 0.05, edges: false });
    }
    // 側面の換気口の列
    const vents = []; for (let i = 0; i < 4; i++) vents.push([box(0.3, 2, 5), { x: X1 + 0.15, y: D + 9, z: Z0 + 7 + i * 10 }]);
    add(U.merge(THREE, vents), M.mid, group, { edges: false });

    // ── 搬出口2つ(閉じたまま): 開口の枠、両脇のガイドレール、上の巻き取り箱(警告縞)、板を重ねたシャッター ──
    const DA = -34, DB = -8, DW = 18, DH = 11, NS = 11, SH = DH / NS;
    const slats = [];
    for (const x of [DA, DB]) {
      add(box(DW, DH, 0.2), M.dark, group, { x, y: D + DH / 2, z: Z1 + 0.1, edges: false });
      for (const s of [-1, 1]) add(box(1, DH + 0.4, 1.2), M.mid, group, { x: x + s * (DW / 2 + 0.5), y: D + (DH + 0.4) / 2, z: Z1 + 0.6 });
      add(box(DW + 3, 2.6, 2.6), M.light, group, { x, y: D + DH + 1.3, z: Z1 + 1.3 });
      add(box(DW + 3.1, 0.6, 0.2), M.hazard, group, { x, y: D + DH + 0.5, z: Z1 + 2.65, edges: false });
      for (let i = 0; i < NS; i++) slats.push([box(DW, SH - 0.12, 0.3), { x, y: D + SH * (i + 0.5), z: Z1 + 0.6 }]);
    }
    add(U.merge(THREE, slats), M.mid, group, { edges: false });

    // ── 搬出口の前の舗装と、扉ごとの区画線 ──
    add(box(52, 0.12, 18), M.light, group, { x: (DA + DB) / 2, y: D + 0.06, z: Z1 + 9, edges: false });
    const marks = [];
    for (const x of [DA, DB]) for (const s of [-1, 1]) marks.push([box(0.5, 0.14, 16), { x: x + s * (DW / 2 + 1), y: D + 0.08, z: Z1 + 9 }]);
    add(U.merge(THREE, marks), M.hazard, group, { edges: false });


    // ── ボイラー棟(右奥)と煙突2本(帯がチーム色)、煙道 ──
    add(box(18, 12, 14), M.light, group, { x: 37, y: D + 6, z: -33 });
    add(box(18.2, 1, 14.2), M.accent, group, { x: 37, y: D + 10.6, z: -33, edges: false });
    const stacks = [[32, -22, 40], [42, -22, 34]];
    for (const [x, z, h] of stacks) {
      add(cyl(2.4, 3.2, h, 12), M.light, group, { x, y: D + h / 2, z });
      add(cyl(2.7, 2.7, 1.6, 12), M.accent, group, { x, y: D + h - 4, z, edges: false });
      add(cyl(2.6, 2.6, 1, 12), M.dark, group, { x, y: D + h + 0.4, z, edges: false });
      add(box(2.4, 2.4, 3), M.mid, group, { x, y: D + 8, z: z - 3.6, edges: false });
    }
    const PUFFS = 20, smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.smoke, PUFFS * 2); group.add(smoke);
    const puffs = []; for (let s = 0; s < 2; s++) for (let i = 0; i < PUFFS; i++) puffs.push({ s, life: i / PUFFS, ox: 0, oz: 0 });

    // ── 貯蔵タンク2基と配管ラック(タンク → 生産棟の側面) ──
    for (const x of [32, 45]) {
      add(cyl(5, 5, 13, 20), M.body, group, { x, y: D + 6.5, z: -2 });
      add(new THREE.SphereGeometry(5, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.body, group, { x, y: D + 13, z: -2, s: 1, edges: false });
      add(new THREE.CylinderGeometry(5.1, 5.1, 1, 20, 1, true), M.accent, group, { x, y: D + 10, z: -2, edges: false });
    }
    const rack = [], RY = 9, RKZ = -12;
    for (const x of [22, 29, 36, 43]) { rack.push([box(0.8, RY, 0.8), { x, y: D + RY / 2, z: RKZ }]); rack.push([box(0.8, 0.8, 5), { x, y: D + RY, z: RKZ }]); }
    add(U.merge(THREE, rack), M.mid, group);
    const pipes = [];
    for (const dz of [-1.6, 0, 1.6]) pipes.push([cyl(0.6, 0.6, 46 - X1, 8), { x: (X1 + 46) / 2, y: D + RY + 1, z: RKZ + dz, rz: Math.PI / 2 }]);
    for (const x of [32, 45]) pipes.push([cyl(0.6, 0.6, 5.4, 8), { x, y: D + RY + 1, z: -9.5, rx: Math.PI / 2 }]);   // タンクからラックへ
    add(U.merge(THREE, pipes), M.steel, group, { edges: false });

    // ── 事務棟(右手前): 2階建て、窓の帯、入口の庇 ──
    add(box(26, 10, 14), M.body, group, { x: 37, y: D + 5, z: 24 });
    const win = []; for (const y of [3, 7.6]) win.push([box(24, 1.8, 0.3), { x: 37, y: D + y, z: 31.1 }]);
    add(U.merge(THREE, win), M.glass, group, { edges: false });
    add(box(26.4, 0.8, 14.4), M.accent, group, { x: 37, y: D + 9.2, z: 24, edges: false });
    add(box(8, 0.6, 4), M.light, group, { x: 30, y: D + 5.2, z: 33 });

    // ── 鋼材置き場(左手前): 寝かせたコイルと板の山 ──
    const coils = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) coils.push([cyl(2.4, 2.4, 3.4, 14), { x: -51 + j * 4.2, y: D + 2.4, z: 10 + i * 6, rx: Math.PI / 2 }]);
    add(U.merge(THREE, coils), M.steel, group);
    for (let k = 0; k < 2; k++) add(box(7 - k, 1.6, 10 - k), M.steel, group, { x: -48, y: D + 0.8 + k * 1.6, z: 30 });

    // ── 照明柱 ──
    const lamps = [];
    for (const [x, z] of [[-50, 4], [-6, 40], [54, 6]]) { add(cyl(0.3, 0.5, 18, 6), M.light, group, { x, y: D + 9, z, edges: false }); lamps.push(add(box(3, 0.8, 1.6), M.lampOff, group, { x, y: D + 18.4, z, edges: false })); }

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, r, M.ring, M.disc);

    // ── 状態と更新(動くのは煙と照明だけ) ──
    let state = opts.state ?? "run", rate = state === "run" ? 1 : 0;
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    function update(dt) {
      rate += ((state === "run" ? 1 : 0) - rate) * Math.min(1, dt * 2);
      // 煙
      puffs.forEach((pf, i) => {
        const [x, z, h] = stacks[pf.s];
        pf.life += dt * 0.16 * Math.max(rate, 0.0001); if (pf.life > 1) { pf.life -= 1; pf.ox = (Math.random() - 0.5) * 3; pf.oz = (Math.random() - 0.5) * 3; }
        const L = pf.life, size = Math.min(1, rate) * (1.5 + L * 6) * (1 - Math.max(0, L - 0.75) * 3.2);
        v.set(x + pf.ox + L * 10, D + h + 1 + L * 22, z + pf.oz - L * 4);
        mt.compose(v, q.setFromEuler(e.set(i, i * 2, 0)), sc.setScalar(Math.max(0.001, size))); smoke.setMatrixAt(i, mt);
      });
      smoke.instanceMatrix.needsUpdate = true;
      for (const l of lamps) l.material = state === "run" ? M.lamp : M.lampOff;
      M.ring.dashOffset = (M.ring.dashOffset ?? 0) - dt * 8;
    }
    function setTeam(c) { const col = c ?? P.neutral; M.accent.color.set(col); M.ring.color.set(col); M.disc.color.set(col); }
    U.bake(THREE, group, { live: [M.accent] });   // 動かない部品を焼いてまとめる(動くのは煙と照明だけ)
    update(0);
    return {
      group, update, setTeam, stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; }, get state() { return state; },
    };
  }

  (window.DreamAssets ??= {}).factory = factory;
})();
