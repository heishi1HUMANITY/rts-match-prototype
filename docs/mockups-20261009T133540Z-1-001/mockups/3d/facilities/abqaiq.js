// 戦略施設トークン「アブカイク」(サウジアラビア東部州、世界最大の原油処理・安定化施設)の詳細版モデル(試作)。
// 平面は実寸の比率(1200 × 800 m を K 倍。施設の一部を切り取り)。整然と並ぶ球形の貯槽(スフェロイド)と安定化塔の列が決め手。
// 誇張: スフェロイド 1.6 倍(直径 25 → 40 m)、安定化塔 1.5 倍(高さ 60 → 90 m・太さ)、フレアスタック 1.2 倍、配管ラックの管を太く。タンクと平面は実寸。
// 部品: スフェロイド 24 基(4 列 × 6、柱・環状の基礎・上の踊り場・らせん階段)、安定化の系列 6(塔 2 本・踊り場・はしごの囲い・加熱炉・熱交換器)、
//       主配管ラック(2 段)、油ガス分離の横置き容器の列、原油の大型タンク 4 基と防油堤、フレアスタック 2、管制棟・変電所、出荷のパイプライン 3 本、砂漠と砂丘。
// 省略: 車両・人・ポンプや弁・小さな配管・柵。
// 近未来化: 防爆の T 字壁(スフェロイドの列の間)と、対ドローンの自動防空塔 4 基(格子の塔・箱形のレーダーの覆い・旋回する機関砲)。
// 状態: 稼働(フレアが燃える)/ 被弾(2019 年 9 月の攻撃: スフェロイド 5 基と安定化塔 2 本が焦げて燃え、黒煙)/ 近未来化。
(function () {
  const K = 0.15;
  const D = { x0: -600, x1: 600, z0: -400, z1: 400, base: -8, ground: 0 };
  const SPH = { r: 12.5 * 1.6, flat: 0.68, legH: 12, xs: [-430, -368, -306, -244, -182, -120], zs: [-230, -170, -110, -50] };
  const COL = { h: 60 * 1.5, r: 3 * 1.5, xs: [10, 76, 142, 208, 274, 340], zs: [-210, -160] };
  const TANK = { r: 35, h: 20, at: [[220, 160], [310, 160], [220, 260], [310, 260]] };
  const FLARE = [[-520, 300, 80 * 1.2], [-450, 340, 70 * 1.2]];
  const HIT = { sph: [[0, 1], [1, 2], [2, 2], [2, 4], [3, 0]], col: [[1, 0], [4, 1]] };   // 被弾したスフェロイド(列, 番号)と塔(系列, 番号)

  function abqaiq(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, polar, tube, lattice } = k;
    M.sand = M.lambert(0xe7dcc6); M.dune = M.lambert(0xdcceb2); M.road = M.lambert(0xbdb5a6); M.scorch = M.lambert(0x2b2a29);
    M.flame = M.basic(0xff8c2a, { transparent: true, opacity: 0.9, depthWrite: false });
    M.smoke = M.lambert(0x3a3f45, { transparent: true, opacity: 0.78, depthWrite: false });
    const group = new THREE.Group(); group.name = "abqaiq";
    const ZC = 0;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);

    // ── 砂漠の台座、砂丘、道路 ──
    add(box(D.x1 - D.x0, D.ground - D.base, D.z1 - D.z0), M.sand, world, { y: (D.ground + D.base) / 2 });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.001);
    const rnd = U.rng(41);
    for (const [x, z, s] of [[-560, -360, 30], [560, 360, 34], [520, -330, 26], [-560, 120, 22], [470, 40, 20], [-300, 370, 24], [100, 370, 18]]) {
      const g = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const m = add(g, M.dune, world, { x, y: D.ground - 0.5, z, edges: false }); m.scale.set(s * 1.8, s * 0.35, s); m.rotation.y = rnd() * 3;
    }
    for (const [x, z, w, d] of [[0, -275, 1060, 10], [0, 105, 1060, 10], [-470, -60, 10, 420], [-50, 0, 10, 520], [400, 0, 10, 600]]) add(box(w, 0.2, d), M.road, world, { x, y: D.ground + 0.1, z, edges: false });

    // ── スフェロイド(4 列 × 6): 環状の基礎、柱 10 本、扁平な球、上の踊り場と通気口、らせん階段の代わりの斜めの階段 ──
    const sphH = SPH.legH + SPH.r * SPH.flat;   // 球の中心の高さ
    const sphG = new THREE.SphereGeometry(SPH.r, 16, 10), legG = cyl(0.9, sphH, 6);
    const spheres = [];
    SPH.zs.forEach((z, row) => SPH.xs.forEach((x, i) => {
      add(new THREE.CylinderGeometry(SPH.r * 0.85, SPH.r * 0.9, 1.2, 20), M.light, world, { x, y: 0.6, z });
      for (let j = 0; j < 10; j++) { const a = (j / 10) * Math.PI * 2, p = polar(SPH.r * 0.82, a); add(legG, M.mid, world, { x: x + p.x, y: sphH / 2, z: z + p.z }); }
      const m = add(sphG, M.body, world, { x, y: sphH, z }); m.scale.set(1, SPH.flat, 1);
      add(cyl(SPH.r + 0.3, 1.0, 20), M.light, world, { x, y: sphH, z, edges: false });   // 赤道の環
      add(cyl(3.6, 1.2, 12), M.light, world, { x, y: sphH + SPH.r * SPH.flat + 0.3, z });   // 頂部の踊り場
      add(cyl(0.6, 2.4, 8), M.dark, world, { x, y: sphH + SPH.r * SPH.flat + 1.6, z });
      // 斜めの階段(地面 → 赤道の環)。足は東西の隣との間に置く(列の間の T 字壁・集合管に掛からない)
      const a0 = Math.PI / 2, p0 = polar(SPH.r + 9, a0), p1 = polar(SPH.r + 0.8, a0 + 0.9);
      k.beam(world, V(x + p0.x, 0.5, z + p0.z), V(x + p1.x, sphH, z + p1.z), 1.6, M.mid);
      spheres.push({ x, z, row, i });
    }));
    // 列ごとの集合管(スフェロイドの間の低い配管)
    for (const z of SPH.zs) for (const dz of [-SPH.r - 4, SPH.r + 4]) tube(world, V(SPH.xs[0] - 30, 2.5, z + dz), V(SPH.xs[5] + 40, 2.5, z + dz), 1.0, M.steel);

    // ── 安定化の系列 6: 塔 2 本(踊り場・はしごの囲い)、加熱炉と煙突、熱交換器 ──
    const colTops = [];
    COL.xs.forEach((x, t) => {
      add(box(56, 0.6, 150), M.light, world, { x: x + 10, y: 0.3, z: -150, edges: false });   // 系列の敷地
      COL.zs.forEach((z, c) => {
        const h = COL.h - c * 14;
        add(cyl(COL.r, h, 12), M.body, world, { x, y: h / 2, z });
        add(cyl(COL.r + 0.6, 2, 14), M.light, world, { x, y: 3, z });
        for (let y = 14; y < h - 4; y += 14) { add(cyl(COL.r + 2.4, 0.6, 10), M.steel, world, { x, y, z, edges: false }); }   // 踊り場
        add(box(1.6, h - 6, 1.6), M.steel, world, { x: x + COL.r + 1.6, y: (h - 6) / 2 + 3, z });   // はしごの囲い
        add(new THREE.SphereGeometry(COL.r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.body, world, { x, y: h, z, edges: false });
        add(box(1.2, 6, 1.2), M.dark, world, { x, y: h + COL.r + 2, z });   // 頂部のつり上げ用の腕
        colTops.push({ x, z, top: h + COL.r, t, c });
      });
      add(box(22, 16, 14), M.light, world, { x: x + 4, y: 8, z: -105 });   // 加熱炉
      add(cyl(2, 36, 10), M.mid, world, { x: x + 12, y: 34, z: -105 });
      for (const dz of [-80, -72]) { const g = cyl(2.4, 20, 12); g.rotateZ(Math.PI / 2); add(g, M.steel, world, { x: x + 10, y: 4, z: dz }); }   // 熱交換器
      tube(world, V(x, COL.h - 20, -210), V(x, 20, -160), 0.9, M.steel);   // 塔の間の上の配管
    });

    // ── 主配管ラック(東西、2 段): 柱と梁の繰り返し、管 ──
    for (let x = -450; x <= 500; x += 25) {
      for (const dz of [-6, 6]) add(box(1.2, 13, 1.2), M.mid, world, { x, y: 6.5, z: -10 + dz });
      for (const y of [7, 12.4]) add(box(1.2, 0.8, 13), M.mid, world, { x, y, z: -10, edges: false });
    }
    for (const [y, dzs] of [[7.9, [-4, -1.5, 1, 3.5]], [13.3, [-3, 0, 3]]]) for (const dz of dzs) tube(world, V(-450, y, -10 + dz), V(500, y, -10 + dz), 0.9, M.steel);
    // 出荷のパイプライン 3 本(東の端へ)
    for (const dz of [-20, -10, 0]) { tube(world, V(500, 1.6, -10 + dz * 0.3 + dz), V(D.x1 - 1, 1.6, -10 + dz * 0.3 + dz), 1.6, M.steel); for (let x = 510; x < D.x1; x += 20) add(box(1.2, 1, 4), M.dark, world, { x, y: 0.5, z: -10 + dz * 1.3, edges: false }); }

    // ── 油ガス分離の横置き容器の列 ──
    for (let i = 0; i < 8; i++) {
      const x = -400 + i * 48, z = 60, g = cyl(3.2, 32, 14); g.rotateZ(Math.PI / 2);
      add(g, M.body, world, { x, y: 5.2, z });
      for (const e of [-11, 11]) add(box(1.4, 3, 6), M.mid, world, { x: x + e, y: 1.5, z });
      add(box(36, 0.5, 12), M.light, world, { x, y: 0.25, z, edges: false });
    }

    // ── 原油のタンク 4 基(浮き屋根・防油堤) ──
    for (const [x, z] of TANK.at) {
      add(cyl(TANK.r, TANK.h, 32), M.body, world, { x, y: TANK.h / 2, z });
      add(cyl(TANK.r - 1.2, 1.0, 32), M.light, world, { x, y: TANK.h - 3, z, edges: false });
      add(cyl(TANK.r + 0.4, 1.0, 32), M.accent, world, { x, y: TANK.h - 1.5, z, edges: false });
      for (const [dx, dz, w, d] of [[0, -44, 90, 2], [0, 44, 90, 2], [-44, 0, 2, 90], [44, 0, 2, 90]]) add(box(w, 2.6, d), M.light, world, { x: x + dx, y: 1.3, z: z + dz });
    }

    // ── フレアスタック 2(格子の塔、頂部の炎はゆらぐ) ──
    const flames = [];
    for (const [x, z, h] of FLARE) {
      lattice(world, V(x, 0, z), h - 4, 5, 1.6, 6, 0.4, M.mid);
      add(cyl(1.6, 10, 10), M.steel, world, { x, y: h - 4, z });
      const f = new THREE.Group(); f.position.set(x, h + 1, z); world.add(f);
      f.add(new THREE.Mesh(new THREE.ConeGeometry(4, 14, 10).translate(0, 7, 0), M.flame));
      flames.push(f);
    }

    // ── 管制棟と変電所 ──
    add(box(70, 14, 30), M.body, world, { x: -250, y: 7, z: 250 });
    add(box(70.4, 3, 30.4), M.glass, world, { x: -250, y: 9, z: 250, edges: false });
    add(box(71, 1.4, 31), M.accent, world, { x: -250, y: 13.4, z: 250, edges: false });
    add(box(80, 0.5, 50), M.light, world, { x: 10, y: 0.25, z: 250, edges: false });
    for (let i = 0; i < 4; i++) { add(box(8, 7, 9), M.dark, world, { x: -20 + i * 20, y: 3.5, z: 240 }); lattice(world, V(-20 + i * 20, 0, 262), 16, 1.6, 1, 2, 0.22, M.mid); }

    // ── 被弾(2019 年 9 月): 焦げた上半分・炎・黒煙 ──
    const hit = new THREE.Group(); world.add(hit);
    const hitSrc = [];
    const capG = new THREE.SphereGeometry(SPH.r + 0.6, 16, 4, 0, Math.PI * 2, 0, Math.PI * 0.4);   // 球と同じ分割(16 × π/10)にそろえ、面が交差しないように
    for (const [row, i] of HIT.sph) {
      const x = SPH.xs[i], z = SPH.zs[row];
      const c = add(capG, M.scorch, hit, { x, y: sphH, z, edges: false }); c.scale.set(1, SPH.flat, 1);
      hitSrc.push([x, sphH + SPH.r * SPH.flat - 2, z, 1]);
    }
    for (const [t, c] of HIT.col) {
      const ct = colTops.find((o) => o.t === t && o.c === c);
      add(cyl(COL.r + 0.2, 26, 14), M.scorch, hit, { x: ct.x, y: ct.top - COL.r - 13, z: ct.z, edges: false });
      hitSrc.push([ct.x, ct.top - 6, ct.z, 0.6]);
    }
    const fire = new THREE.Group(); world.add(fire);
    const fireCones = [];
    for (const [x, y, z, s] of hitSrc) {   // 火元ごとに炎の錐 4 本を 1 つにまとめ、高さをゆらす
      const parts = [0, 1, 2, 3].map((j) => { const p = polar(j ? 6 * s : 0, j * 2.1); return [new THREE.ConeGeometry((j ? 5 : 8) * s, j ? 0.7 : 1, 10).translate(0, j ? 0.35 : 0.5, 0), { x: p.x, z: p.z }]; });
      const f = new THREE.Mesh(U.merge(THREE, parts), M.flame); f.position.set(x, y, z); fire.add(f); fireCones.push([f, s, 0]);
    }
    const PUFFS = 70, smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.smoke, PUFFS); smoke.frustumCulled = false; world.add(smoke);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();

    // ── 近未来化: 防爆の T 字壁(列の間と外周)と対ドローンの防空塔 4 基 ──
    const future = new THREE.Group(); world.add(future);
    const tw = [];
    const wallLine = (xa, za, xb, zb) => {
      const L = Math.hypot(xb - xa, zb - za), n = Math.floor(L / 6.4), ax = (xb - xa) / L, az = (zb - za) / L, ry = Math.atan2(ax, az);
      for (let j = 0; j < n; j++) {   // 2 枚 1 組(6.4 m)の壁板。継ぎ目は輪郭線
        const x = xa + ax * (j + 0.5) * 6.4, z = za + az * (j + 0.5) * 6.4;
        add(box(0.6, 6, 6.2), M.light, future, { x, y: 3.6, z, ry: ry + Math.PI / 2 - Math.PI / 2 });
      }
      add(box(2.4, 0.6, n * 6.4), M.light, future, { x: xa + ax * n * 3.2, y: 0.3, z: za + az * n * 3.2, ry: ry, edges: false });   // 足
      tw.push([xa, za, xb, zb]);
    };
    for (let r = 0; r < SPH.zs.length - 1; r++) { const z = (SPH.zs[r] + SPH.zs[r + 1]) / 2; wallLine(SPH.xs[0] - 30, z, SPH.xs[5] + 30, z); }
    for (const z of [SPH.zs[0] - 34, SPH.zs[3] + 34]) wallLine(SPH.xs[0] - 30, z, SPH.xs[5] + 30, z);
    const turrets = [];
    for (const [x, z] of [[-470, -300], [-80, -300], [-480, 30], [380, -260]]) {
      lattice(future, V(x, 0, z), 26, 3, 1.6, 3, 0.35, M.mid);
      add(box(5, 0.8, 5), M.light, future, { x, y: 26.4, z });
      add(box(3.4, 2.4, 1.6), M.body, future, { x, y: 28, z: z - 1.4 });   // 箱形のレーダーの覆い(固定)
      add(box(3.6, 0.5, 1.8), M.accent, future, { x, y: 29.4, z: z - 1.4, edges: false });
      const tg = new THREE.Group(); tg.position.set(x, 27, z + 1.2); future.add(tg);
      add(box(2.2, 1.6, 2.2), M.dark, tg, { y: 0.8 });
      tube(tg, V(0, 1.1, 0.8), V(0, 1.6, 6), 0.25, M.dark);   // 機関砲の砲身
      turrets.push(tg);
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 112, M.ring, M.disc);

    // ── 状態と動き ──
    let state = opts.state ?? "run", clock = 0;
    function apply() { const h = state === "hit"; hit.visible = fire.visible = smoke.visible = h; future.visible = state === "future"; }
    function update(dt) {
      clock += dt;
      flames.forEach((f, i) => f.scale.set(1, 0.85 + 0.2 * Math.sin(clock * (8 + i)) * Math.sin(clock * 3.1 + i), 1));
      if (state === "future") turrets.forEach((t, i) => (t.rotation.y = Math.sin(clock * 0.4 + i * 1.7) * 1.2));   // 防空の機関砲は空を走査して旋回する
      if (state === "hit") {
        fireCones.forEach(([f, s], j) => f.scale.set(1, (14 + 12 * (0.6 + 0.4 * Math.sin(clock * (5 + j) + j))) * s, 1));
        for (let i = 0; i < PUFFS; i++) {
          const src = hitSrc[i % hitSrc.length], t = (clock * 0.05 + i / PUFFS) % 1, s = (8 + (i % 5) * 2) * (0.5 + 1.8 * t) * src[3] + 4;
          ps.set(src[0] + t * 150 + Math.sin(i * 2.1) * 8, src[1] + 12 + t * 160, src[2] - t * 50 + Math.cos(i * 1.3) * 8);
          mt.compose(ps, q.identity(), sc.setScalar(s)); smoke.setMatrixAt(i, mt);
        }
        smoke.instanceMatrix.needsUpdate = true;
      }
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) { if (["run", "hit", "future"].includes(s)) { state = s; apply(); update(0); } }

    function check() {
      const r1 = (v) => +v.toFixed(1);
      let sphGap = Infinity; for (const a of spheres) for (const b of spheres) if (a !== b) sphGap = Math.min(sphGap, Math.hypot(a.x - b.x, a.z - b.z) - 2 * SPH.r);
      let wallToSph = Infinity; for (const [xa, za, xb, zb] of tw) for (const s of spheres) { const t = Math.max(0, Math.min(1, ((s.x - xa) * (xb - xa) + (s.z - za) * (zb - za)) / ((xb - xa) ** 2 + (zb - za) ** 2))); wallToSph = Math.min(wallToSph, Math.hypot(s.x - xa - (xb - xa) * t, s.z - za - (zb - za) * t) - SPH.r - 1.2); }
      const flareToSph = Math.min(...FLARE.map(([x, z]) => Math.min(...spheres.map((s) => Math.hypot(s.x - x, s.z - z) - SPH.r))));
      return {
        sphereGap_m: r1(sphGap),                       // スフェロイドどうしの最小の隙間(赤道の環の外側)
        tWallToSphere_m: r1(wallToSph),                // T 字壁(足を含む)とスフェロイドの最小の隙間
        flareToSphere_m: r1(flareToSph),               // フレアと最も近いスフェロイド
        columnTop_m: r1(Math.max(...colTops.map((c) => c.top))), sphereTop_m: r1(sphH + SPH.r * SPH.flat),
        turretToRadar_m: r1((1.2 - 1.1) - (-1.4 + 0.8)),   // 砲塔の箱(後ろの面)とレーダーの覆い(前の面)の隙間
        turretMaxYaw_rad: 1.2,                               // 旋回は ±1.2 rad(後ろのレーダーへ砲身が向かない)
      };
    }

    hit.visible = fire.visible = future.visible = true;
    U.bake(THREE, group, { dynamic: [hit, fire, future, ...flames, ...turrets], live: [M.accent] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setState, check, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        spheres: { label: "スフェロイドの列", target: [-270, 20, -140], pos: [-60, 120, 60] },
        columns: { label: "安定化塔の系列", target: [180, 40, -170], pos: [300, 120, 20] },
        flare: { label: "フレアとタンク", target: [-100, 30, 250], pos: [150, 150, 450] },
      },
    };
  }

  DreamAssets.fac.register("abqaiq", {
    section: 9, title: "アブカイク", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "サウジの原油の大半が通る世界最大の原油処理・安定化施設。整然と並ぶ球形の貯槽と安定化塔の列。2019 年 9 月のドローンと巡航ミサイルの攻撃で世界の供給の約 5% が止まった。防爆壁と対ドローン防空を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/abqaiq.js"], ["大きさ", "施設の一部 1200 × 800 m を 0.15 倍 × 表示 3.0"], ["誇張", "スフェロイド 1.6 倍、安定化塔 1.5 倍、フレア 1.2 倍、配管を太く"], ["省略", "車両・人・ポンプや弁・小さな配管・柵"], ["状態", "稼働 / 被弾(2019 年)/ 近未来化"], ["近未来化", "防爆の T 字壁、対ドローンの自動防空塔 4 基"]],
    dist: 1000, target: 30, tokenAt: [400, 0, 330],
    make: (THREE) => abqaiq(THREE, { r: 112 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["稼働", () => a.setState("run"), () => a.state === "run"], ["被弾(2019 年)", () => a.setState("hit"), () => a.state === "hit"], ["近未来化", () => a.setState("future"), () => a.state === "future"]],
    caption: (a) => (a.state === "hit" ? "2019 年 9 月の攻撃 — スフェロイドと安定化塔が燃える" : ""),
  });
})();
