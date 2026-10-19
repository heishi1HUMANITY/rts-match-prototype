// 戦略施設トークン「製油所」(ロシアの製油所群の代表。特定の 1 か所ではない)の詳細版モデル(試作)。
// 典型的な配置(西に常圧・減圧蒸留と流動接触分解の装置、中央を東西に貫く配管ラック、東に浮き屋根式の原油タンク群と LPG の球形タンク、北東の隅にフレアスタック)をメートルで組み、K 倍して模型にする。
// 誇張: 蒸留塔の高さ 1.5 倍、タンクの高さ 1.3 倍、フレアスタック 1.2 倍(施設リストの決め手「蒸留塔、配管の森、円筒タンク群」)。配管は太く。平面の配置は実寸の比率。
// 省略: 車両・人・ポンプや弁などの小さな機器、タンクの階段の手すり。
// 近未来化(施設リストの案): 蒸留塔とタンクにケージ状の防護構造、プロセス区画の上空に防空ネット(マストと網)。
// 状態: "run"(稼働。フレアが燃える)/ "hit"(被弾。原油タンク 1 基が炎上し黒煙)
(function () {
  const K = 0.2;
  const D = { x0: -450, x1: 450, z0: -300, z1: 300, base: -8, ground: 0, colEx: 1.5, tankEx: 1.3, flareEx: 1.2, net: 100 };
  const TANKS = []; for (const x of [165, 247, 329, 411]) for (const z of [-230, -148, -66, 16]) TANKS.push([x, z]);
  const TANK = { r: 31, h: 20 * D.tankEx };
  const COLS = [[-330, -140, 4.5, 55], [-300, -140, 6.5, 40], [-330, -95, 3.5, 32], [-300, -95, 3.8, 36], [-170, -150, 4.2, 42], [-145, -150, 3.4, 30]];   // [x, z, 半径, 実寸の高さ]
  const SPHERES = [[220, 130], [270, 130], [320, 130], [370, 130]];
  const FLARE = [410, 230], HIT = 6;   // 炎上するタンクの番号

  function refinery(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.roof = M.lambert(0xb9c1c9);
    M.tankShell = M.lambert(F.P.body, { side: THREE.DoubleSide });
    M.flame = M.basic(0xff8c2a, { transparent: true, opacity: 0.9, depthWrite: false });
    M.core = M.basic(0xfff1c8, { transparent: true, opacity: 0.95, depthWrite: false });
    M.smoke = M.lambert(0x3a3f45, { transparent: true, opacity: 0.8, depthWrite: false });
    M.net = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.3 });
    const group = new THREE.Group(); group.name = "refinery";
    const XC = (D.x0 + D.x1) / 2, ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, -ZC * K); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, polar, tube, beam, lattice, prism } = k;

    // ── 台座と構内道路 ──
    add(prism([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], D.base, D.ground), M.land, world);
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base, { x: XC, z: ZC });
    for (const [x, z, w, d] of [[0, 75, 880, 10], [0, -285, 880, 10], [85, -105, 10, 360]]) add(box(w, 0.2, d), M.mid, world, { x, y: 0.1, z, edges: false });
    add(box(310, 0.15, 470), M.light, world, { x: -265, y: 0.08, z: -55, edges: false });   // プロセス区画の舗装

    // ── 原油タンク 16 基(浮き屋根、上端の補強リング、らせん階段、屋根の移動はしご)と防油堤 ──
    const shellG = new THREE.CylinderGeometry(TANK.r, TANK.r, TANK.h, 32, 1, true), roofG = cyl(TANK.r - 0.8, 0.8, 32), girderG = cyl(TANK.r + 1.2, 0.6, 32);   // 側板は上が開いた筒(浮き屋根が見える)
    TANKS.forEach(([x, z], i) => {
      add(shellG, M.tankShell, world, { x, y: TANK.h / 2, z });
      add(roofG, M.roof, world, { x, y: TANK.h - 4, z });                                       // 浮き屋根(縁より下)
      add(girderG, M.light, world, { x, y: TANK.h - 1.6, z, edges: false });
      const a0 = (i * 1.3) % (Math.PI * 2);
      for (let s = 0; s < 6; s++) {                                                          // らせん階段(側面に沿って上る)
        const a = a0 + s * 0.12, b = a0 + (s + 1) * 0.12;
        beam(world, polar(TANK.r + 1.2, a, (TANK.h * s) / 6).add(V(x, 0, z)), polar(TANK.r + 1.2, b, (TANK.h * (s + 1)) / 6).add(V(x, 0, z)), 1.0, M.mid);
      }
      beam(world, polar(TANK.r - 1, a0 + 0.72, TANK.h).add(V(x, 0, z)), V(x, TANK.h - 3.6, z), 0.8, M.mid);   // 屋根の移動はしご
    });
    for (const [x0, x1, z0, z1] of [[124, 452, -272, -107], [124, 452, -107, 58]]) {          // 防油堤(2 区画)
      for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]]) add(box(Math.max(1.5, bx - ax), 3, Math.max(1.5, bz - az)), M.light, world, { x: (ax + bx) / 2, y: 1.5, z: (az + bz) / 2 });
    }
    // LPG の球形タンク(8 本脚と斜材)
    for (const [x, z] of SPHERES) {
      add(new THREE.SphereGeometry(10, 20, 14), M.body, world, { x, y: 17, z });
      for (let j = 0; j < 8; j++) { const a = (j / 8) * Math.PI * 2, p = polar(9.2, a).add(V(x, 0, z)); add(cyl(0.7, 17, 8), M.mid, world, { x: p.x, y: 8.5, z: p.z }); const q = polar(9.2, a + Math.PI / 4).add(V(x, 0, z)); tube(world, V(p.x, 1, p.z), V(q.x, 12, q.z), 0.25, M.mid); }
    }
    // フレアスタック(格子の支持塔 + 筒 + 先端の炎)
    const FH = 100 * D.flareEx;
    lattice(world, V(FLARE[0], 0, FLARE[1]), FH - 4, 8, 2.2, 7, 0.6, M.mid);
    add(cyl(1.6, FH, 12), M.light, world, { x: FLARE[0], y: FH / 2, z: FLARE[1] });
    add(cyl(2.4, 3, 12), M.dark, world, { x: FLARE[0], y: FH + 1, z: FLARE[1] });
    const flare = new THREE.Group(); flare.position.set(FLARE[0], FH + 2.5, FLARE[1]); world.add(flare);
    flare.add(new THREE.Mesh(new THREE.ConeGeometry(4, 16, 10).translate(0, 8, 0), M.flame));
    flare.add(new THREE.Mesh(new THREE.ConeGeometry(2, 8, 10).translate(0, 4, 0), M.core));

    // ── プロセス区画: 蒸留塔 6 本(踊り場の輪、はしごの囲い)、加熱炉と煙突、流動接触分解(FCC)、鉄骨の架構 ──
    const colTop = [];
    for (const [x, z, r, h0] of COLS) {
      const h = h0 * D.colEx;
      add(cyl(r + 1.6, 4, 16), M.light, world, { x, y: 2, z });                                // 基礎のスカート
      add(cyl(r, h, 16), M.body, world, { x, y: 4 + h / 2, z });
      const cap = add(new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.body, world, { x, y: 4 + h, z }); cap.scale.y = 0.45;
      for (let y = 14; y < h; y += 12) add(cyl(r + 1.6, 0.5, 16), M.mid, world, { x, y: 4 + y, z, edges: false });   // 踊り場
      add(box(1.4, h - 6, 1.4), M.mid, world, { x: x + r + 1.0, y: 4 + (h - 6) / 2, z, edges: false });   // はしごの囲い
      add(cyl(0.9, 10, 8), M.light, world, { x: x - r + 0.6, y: 4 + h + 3, z });               // 塔頂の配管
      colTop.push(4 + h + r * 0.45);
    }
    for (const [x, z] of [[-390, -120], [-390, -60]]) {                                         // 加熱炉(箱形の炉と対流部、煙突)
      add(box(34, 22, 20), M.light, world, { x, y: 11, z });
      add(box(18, 10, 12), M.mid, world, { x, y: 27, z });
      add(cyl(2.2, 60, 12), M.body, world, { x, y: 32 + 30, z });
      add(cyl(2.8, 2, 12), M.dark, world, { x, y: 92, z, edges: false });
    }
    // FCC: 再生塔(大径)と反応塔、ライザー、架構
    add(box(40, 22, 30), M.light, world, { x: -170, y: 11, z: -60 });
    add(cyl(10, 30, 20), M.body, world, { x: -180, y: 37, z: -60 });
    add(cyl(5, 26, 16), M.body, world, { x: -158, y: 48, z: -60 });
    tube(world, V(-158, 22, -66), V(-158, 35, -66), 1.6, M.light); tube(world, V(-180, 52, -60), V(-158, 61, -60), 1.4, M.light);
    for (const [x0, z0, nx, nz, lv] of [[-360, -175, 4, 3, 3], [-200, -185, 3, 2, 3], [-210, -85, 6, 4, 2]]) {   // 鉄骨の架構(柱・梁・床の格子)
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) add(box(1.2, lv * 8, 1.2), M.mid, world, { x: x0 + i * 10, y: lv * 4, z: z0 + j * 10 });
      for (let l = 1; l <= lv; l++) {
        for (let j = 0; j <= nz; j++) add(box(nx * 10, 0.9, 0.9), M.mid, world, { x: x0 + nx * 5, y: l * 8, z: z0 + j * 10, edges: false });
        for (let i = 0; i <= nx; i++) add(box(0.9, 0.9, nz * 10), M.mid, world, { x: x0 + i * 10, y: l * 8, z: z0 + nz * 5, edges: false });
      }
    }
    // 冷却塔(強制通風の 6 セル、上に送風機の筒)
    for (let i = 0; i < 6; i++) { add(box(15, 12, 15), M.light, world, { x: -400 + i * 16, y: 6, z: 200 }); add(cyl(5, 4, 16), M.mid, world, { x: -400 + i * 16, y: 14, z: 200 }); }
    // 管理棟
    add(box(40, 12, 22), M.body, world, { x: -360, y: 6, z: 120 });
    add(box(40.4, 1.6, 22.4), M.glass, world, { x: -360, y: 8, z: 120, edges: false });
    add(box(40.6, 0.8, 22.6), M.accent, world, { x: -360, y: 11, z: 120, edges: false });

    // ── 配管ラック(配管の森): 柱と 2 段の梁、梁の上に配管を並べる ──
    const rack = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 10), dx = (bx - ax) / L, dz = (bz - az) / L, nx = -dz, nz = dx;
      for (let i = 0; i <= n; i++) {
        const cx = ax + dx * L * (i / n), cz = az + dz * L * (i / n);
        for (const s of [-1, 1]) add(box(1.0, 15, 1.0), M.mid, world, { x: cx + nx * s * 6, y: 7.5, z: cz + nz * s * 6, edges: false });
        for (const y of [8, 14]) beam(world, V(cx - nx * 6.5, y, cz - nz * 6.5), V(cx + nx * 6.5, y, cz + nz * 6.5), 0.8, M.mid);
      }
      for (const [y, offs] of [[8.9, [-4.5, -2.5, -0.6, 1.4, 3.4, 5]], [14.9, [-4, -1.5, 1, 3.5]]]) offs.forEach((o, j) => {
        const r = j % 3 === 0 ? 1.0 : 0.65, mat = j % 2 ? M.light : M.steel;
        tube(world, V(ax + nx * o, y + r - 0.4, az + nz * o), V(bx + nx * o, y + r - 0.4, bz + nz * o), r, mat);
      });
    };
    rack(-430, 20, 110, 20); rack(-250, 20, -250, -230); rack(-100, 20, -100, -230); rack(110, 20, 110, -260);

    // ── 近未来化: 防護ケージ(蒸留塔ごと、原油タンク 4 基)、防空ネット ──
    const cage = (x, z, r, h, n = 8, levels = 4) => {
      for (let j = 0; j < n; j++) { const p = polar(r, (j / n) * Math.PI * 2).add(V(x, 0, z)); tube(world, V(p.x, 0, p.z), V(p.x, h, p.z), 0.45, M.steel); }
      for (let l = 1; l <= levels; l++) for (let j = 0; j < n; j++) {
        const a = polar(r, (j / n) * Math.PI * 2).add(V(x, (h * l) / levels, z)), b = polar(r, ((j + 1) / n) * Math.PI * 2).add(V(x, (h * l) / levels, z));
        tube(world, a, b, 0.35, M.steel);
      }
      for (let j = 0; j < n / 2; j++) tube(world, polar(r, (j / n) * Math.PI * 2).add(V(x, h, z)), polar(r, (j / n) * Math.PI * 2 + Math.PI).add(V(x, h, z)), 0.3, M.steel);
    };
    COLS.forEach(([x, z, r, h0], i) => { if (i % 2 === 0 || h0 > 38) cage(x, z, r + 6, 4 + h0 * D.colEx + r * 0.45 + 6); });
    for (const i of [0, 1, 4, 5]) cage(TANKS[i][0], TANKS[i][1], TANK.r + 3, TANK.h + 8, 12, 2);
    const MAST = []; for (const x of [-430, -290, -150, -10]) for (const z of [-200, 0, 180]) MAST.push([x, z]);
    for (const [x, z] of MAST) { add(cyl(0.9, D.net + 4, 8), M.mid, world, { x, y: (D.net + 4) / 2, z }); add(box(2.4, 1.8, 2.4), M.accent, world, { x, y: D.net + 3, z, edges: false }); }
    const netPts = [];
    for (let x = -430; x <= -10 + 0.1; x += 20) netPts.push(x, D.net, -200, x, D.net, 180);
    for (let z = -200; z <= 180 + 0.1; z += 20) netPts.push(-430, D.net, z, -10, D.net, z);
    const netG = new THREE.BufferGeometry(); netG.setAttribute("position", new THREE.Float32BufferAttribute(netPts, 3));
    world.add(new THREE.LineSegments(netG, M.net));

    // ── 被弾: タンク火災(炎の錐と黒煙の粒) ──
    const [hx, hz] = TANKS[HIT];
    const fire = new THREE.Group(); fire.position.set(hx, TANK.h - 4, hz); world.add(fire);
    const flames = [];
    for (let j = 0; j < 7; j++) { const p = polar(j ? 16 : 0, j * 1.05); const f = new THREE.Mesh(new THREE.ConeGeometry(j ? 7 : 11, 1, 10).translate(0, 0.5, 0), M.flame); f.position.set(p.x, 0, p.z); fire.add(f); flames.push(f); }
    const PUFFS = 40, smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.smoke, PUFFS); smoke.frustumCulled = false; world.add(smoke);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const { ring, disc } = U.zone(THREE, group, opts.r ?? 110, M.ring, M.disc);

    let state = opts.state ?? "run", clock = 0;
    function fx(dt) {
      clock += dt;
      flare.scale.set(1, 0.85 + 0.15 * Math.sin(clock * 9) * Math.sin(clock * 3.1), 1);
      const hit = state === "hit";
      fire.visible = smoke.visible = hit;
      if (!hit) return;
      flames.forEach((f, j) => { f.scale.set(1, 18 + (j ? 8 : 16) * (0.6 + 0.4 * Math.sin(clock * (5 + j) + j)), 1); });
      for (let i = 0; i < PUFFS; i++) {
        const t = (clock * 0.05 + i / PUFFS) % 1, s = (12 + (i % 7) * 2) * (0.5 + 1.6 * t);
        ps.set(hx + t * 160 + Math.sin(i * 2.1) * 10, TANK.h + 20 + t * 170, hz - t * 60 + Math.cos(i * 1.3) * 10);
        mt.compose(ps, q.identity(), sc.setScalar(s)); smoke.setMatrixAt(i, mt);
      }
      smoke.instanceMatrix.needsUpdate = true;
    }
    function update(dt) { fx(dt); ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; }
    function setState(s) { if (s === "run" || s === "hit") state = s; fx(0); }
    fx(0);
    const r1 = (v) => +v.toFixed(1);
    function check() {
      let tankGap = Infinity; for (let i = 0; i < TANKS.length; i++) for (let j = i + 1; j < TANKS.length; j++) tankGap = Math.min(tankGap, Math.hypot(TANKS[i][0] - TANKS[j][0], TANKS[i][1] - TANKS[j][1]) - 2 * (TANK.r + 3));
      return {
        netOverTallestColumn_m: r1(D.net - Math.max(...colTop)),            // 防空ネットと最も高い塔の頂部の隙間
        netOverCage_m: r1(D.net - Math.max(...colTop) - 6), netOverHeaterStack_m: r1(D.net - 93),
        cageOverColumn_m: 6,                                                 // ケージの上端は塔頂より 6 m 上
        tankCageGap_m: r1(tankGap),                                          // ケージどうしの最小の隙間(タンク間)
        flareTop_m: r1(FH + 3), flareToSphere_m: r1(Math.hypot(FLARE[0] - SPHERES[3][0], FLARE[1] - SPHERES[3][1]) - 10 - 8),
        rackClear_m: r1(8 - 0.45),                                           // 下段の梁の下の高さ(道路を跨ぐ)
      };
    }
    U.bake(THREE, group, { dynamic: [flare, fire], live: [M.accent] });
    const at = (x, y, z) => V((x - XC) * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        columns: { label: "蒸留塔とケージ", target: [-280, 40, -120], pos: [-120, 110, 40] },
        rack: { label: "配管ラック", target: [-180, 10, 20], pos: [-60, 45, 90] },
        tanks: { label: "タンク群", target: [290, 15, -110], pos: [120, 120, 140] },
        flare: { label: "フレア・球形タンク", target: [330, 60, 170], pos: [180, 90, 320] },
      },
    };
  }

  DreamAssets.fac.register("refinery", {
    section: 4, title: "製油所", kind: "STRATEGIC FACILITY · 4 エネルギー",
    desc: "蒸留塔、配管の森、円筒タンク群。2024 年以降、長距離ドローンの攻撃が繰り返されているロシアの製油所群の代表。塔とタンクにケージ状の防護構造、上空に防空ネットを張った近未来版",
    info: [["ファイル", "mockups/3d/facilities/refinery.js"], ["大きさ", "実寸 900 × 600 m を 0.2 倍 × 表示 3.0"], ["誇張", "蒸留塔の高さ 1.5 倍、タンク 1.3 倍、フレア 1.2 倍、配管を太く"], ["省略", "車両・人・ポンプや弁"], ["近未来化", "防護ケージ(塔 4 本・タンク 4 基)、防空ネット"]],
    dist: 1150, target: 40, tokenAt: [430, 0, 330],
    make: (THREE) => refinery(THREE, { r: 110 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["稼働", () => a.setState("run"), () => a.state === "run"], ["被弾", () => a.setState("hit"), () => a.state === "hit"]],
    caption: (a) => (a.state === "hit" ? "被弾 — 原油タンクが炎上" : ""),
  });
})();
