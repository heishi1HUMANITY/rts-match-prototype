// 戦略施設トークン「ザポリージャ原子力発電所」(ウクライナ)の詳細版モデル(試作)。
// 実物の配置(同型の VVER-1000 6 基を 150 m 間隔で一列、前に冷却池、裏に冷却塔 2 基・噴霧池・開閉所)をメートルで組み、K 倍して模型にする。
// 誇張: 格納容器の高さ 1.6 倍(一列に並ぶ同型建屋の決め手)、排気筒 1.3 倍。冷却塔は実寸。
// 省略: 車両・人・小さな機器(弁、配管、ディーゼル発電機の建屋など)。
// 近未来化(施設リストの案): 停止中の 6 基の脇に SMR(小型モジュール炉)2 基の建屋、炉の列の上空を覆う対ドローンネット(マストと網)、国際監視団の観測ステーション。
// 状態: "stop"(冷温停止。現状)/ "run"(再稼働: 冷却塔の湯気と噴霧池の噴霧)
//
// 炉の列は x 方向、+z が冷却池。
(function () {
  const K = 0.165;
  const D = { xw: 560, z0: -340, z1: 350, base: -12, ground: 0, pondY: -2, pondBed: -8, dike: [150, 172], ex: 1.6, stackEx: 1.3 };
  const UNIT_X = Array.from({ length: 6 }, (_, i) => (i - 2.5) * 150);
  const CT = [[200, -245], [380, -245]], CT_H = 150;   // 冷却塔の中心と高さ
  const ctR = (y) => 36 * Math.sqrt(1 + ((y - 115) / 78.75) ** 2);   // 双曲面(のど 115 m で半径 36 m、下端 y 10 で 60 m)
  const CONT = { r: 22.5, h: 52 * D.ex, dome: 0.55 }, NET_Y = 105;

  function zaporizhzhia(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.tower = M.lambert(F.P.body, { side: THREE.DoubleSide });
    M.pond = U.waterMaterial(THREE, { repeat: [(1120 * K) / U.WATER_TILE[0], (195 * K) / U.WATER_TILE[1]] });
    M.pool = U.waterMaterial(THREE, { repeat: [(200 * K) / U.WATER_TILE[0], (60 * K) / U.WATER_TILE[1]] });
    M.net = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.32 });
    M.steam = M.lambert(0xffffff, { transparent: true, opacity: 0.82, depthWrite: false });
    M.spray = M.basic(0xffffff, { transparent: true, opacity: 0.55, depthWrite: false });
    const group = new THREE.Group(); group.name = "zaporizhzhia";
    const ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, polar, tube, lattice, prism, closedLoft } = k;

    // ── 台座: 陸、冷却池の堤防の斜面、池の底と水面、足元の暗い帯 ──
    add(prism([[-D.xw, D.z0], [D.xw, D.z0], [D.xw, D.dike[0]], [-D.xw, D.dike[0]]], D.base, D.ground), M.land, world);
    add(closedLoft([-D.xw, D.xw].map((x) => [V(x, D.base, D.dike[0]), V(x, D.ground, D.dike[0]), V(x, D.pondBed, D.dike[1]), V(x, D.base, D.dike[1])])), M.mid, world);
    add(box(2 * D.xw, D.pondBed - D.base, D.z1 - D.dike[1]), M.light, world, { y: (D.base + D.pondBed) / 2, z: (D.dike[1] + D.z1) / 2, edges: false });
    const wz0 = D.dike[0] + ((D.ground - D.pondY) / (D.ground - D.pondBed)) * (D.dike[1] - D.dike[0]);
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(2 * D.xw, D.z1 - wz0).rotateX(-Math.PI / 2), M.pond); pond.position.set(0, D.pondY, (wz0 + D.z1) / 2); world.add(pond);
    const cutH = D.pondY - D.pondBed;
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(2 * D.xw, cutH), { y: (D.pondY + D.pondBed) / 2, z: D.z1 }],
      ...[-1, 1].map((s) => [new THREE.PlaneGeometry(D.z1 - wz0, cutH), { x: s * D.xw, y: (D.pondY + D.pondBed) / 2, z: (wz0 + D.z1) / 2, ry: Math.PI / 2 }]),
    ]), M.waterCut));
    F.plinth(k, M, world, 2 * D.xw, D.z1 - D.z0, D.base, { z: ZC });
    // 構内道路(炉の前と裏)
    for (const [z, w] of [[110, 10], [-125, 10]]) add(box(2 * D.xw - 20, 0.2, w), M.mid, world, { y: 0.1, z, edges: false });

    // ── 発電ユニット 6 基(VVER-1000): 原子炉建屋(格納容器 + 原子炉区画)、補助建屋、脱気器棟、タービン建屋、主変圧器 ──
    const domeG = new THREE.SphereGeometry(CONT.r, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const ux of UNIT_X) {
      add(box(66, 30, 66), M.light, world, { x: ux, y: 15, z: -30 });                       // 原子炉区画
      add(box(66, 22, 30), M.body, world, { x: ux, y: 11, z: -78 });                        // 補助建屋
      add(box(40, 4, 14), M.mid, world, { x: ux, y: 24, z: -78 });                          // 屋上の換気設備
      add(cyl(CONT.r, CONT.h, 32), M.body, world, { x: ux, y: CONT.h / 2, z: -30 });        // 格納容器
      const dome = add(domeG, M.body, world, { x: ux, y: CONT.h, z: -30 }); dome.scale.y = CONT.dome;
      add(cyl(CONT.r + 0.8, 1.6, 32), M.light, world, { x: ux, y: CONT.h - 3, z: -30 });   // 頂部の帯(緊張材の定着部)
      for (const a of [0.35, 0.35 + (2 * Math.PI) / 3, 0.35 + (4 * Math.PI) / 3]) {            // 控え壁 3 本
        const p = polar(CONT.r + 1.2, a);
        add(box(5, CONT.h - 30, 2.6), M.light, world, { x: ux + p.x, y: 30 + (CONT.h - 30) / 2, z: -30 + p.z, ry: a });
      }
      add(box(140, 46, 16), M.light, world, { x: ux, y: 23, z: 12 });                       // 脱気器棟
      add(box(140, 38, 55), M.body, world, { x: ux, y: 19, z: 47.5 });                      // タービン建屋
      add(box(140, 3, 12), M.light, world, { x: ux, y: 39.5, z: 47.5 });                     // 屋根の越屋根
      for (const y of [12, 27]) add(box(136, 3.2, 0.5), M.glass, world, { x: ux, y, z: 75.1, edges: false });   // 窓の帯
      for (let i = 0; i <= 10; i++) add(box(1.6, 38, 1.2), M.light, world, { x: ux - 69 + i * 13.8, y: 19, z: 75.4 });   // 柱形
      for (const dx of [-40, -20]) {                                                          // 主変圧器(本体、放熱器、ブッシング)
        add(box(14, 9, 8), M.mid, world, { x: ux + dx, y: 4.5, z: 88 });
        add(box(14.4, 6, 1.2), M.dark, world, { x: ux + dx, y: 4.5, z: 92.4, edges: false });
        for (const e of [-4, 0, 4]) add(cyl(0.5, 4, 6), M.light, world, { x: ux + dx + e, y: 11, z: 87 });
      }
    }
    // 排気筒(格子の鉄塔に支えられた鋼管。2 基に 1 本)
    const STACK_H = 100 * D.stackEx;
    for (const x of [-300, 0, 300]) {
      lattice(world, V(x, 0, -108), STACK_H, 7, 2.6, 5, 0.6, M.mid);
      add(cyl(2.4, STACK_H + 6, 12), M.light, world, { x, y: (STACK_H + 6) / 2, z: -108 });
      for (const y of [STACK_H * 0.5, STACK_H * 0.85]) add(box(7, 0.8, 7), M.mid, world, { x, y, z: -108 });   // 点検の踊り場
    }

    // ── 冷却塔 2 基(双曲面の殻、下端の X 字の柱、水槽)──
    const prof = []; for (let i = 0; i <= 20; i++) { const y = 10 + ((CT_H - 10) * i) / 20; prof.push(new THREE.Vector2(ctR(y), y)); }
    const shellG = new THREE.LatheGeometry(prof, 40);
    for (const [cx, cz] of CT) {
      add(shellG, M.tower, world, { x: cx, z: cz });
      add(cyl(ctR(CT_H) + 0.8, 1.6, 40), M.light, world, { x: cx, y: CT_H - 0.6, z: cz });   // 頂部の縁
      add(cyl(64, 2, 40), M.light, world, { x: cx, y: 1, z: cz });                             // 水槽の縁
      add(cyl(61, 0.4, 40), M.mid, world, { x: cx, y: 1.8, z: cz, edges: false });
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2, b = a + Math.PI / 30;
        const g = (aa) => polar(61.5, aa, 1.5).add(V(cx, 0, cz)), t = (aa) => polar(ctR(10) - 0.5, aa, 10.3).add(V(cx, 0, cz));
        tube(world, g(a), t(b), 0.7, M.light); tube(world, g(b), t(a), 0.7, M.light);
      }
    }
    // 噴霧池 2 面(コンクリートの槽と水面、噴霧ノズルの管)
    const POOLS = [[-20, -290], [-20, -195]];
    for (const [px, pz] of POOLS) {
      add(prism([[px - 104, pz - 34], [px + 104, pz - 34], [px + 104, pz + 34], [px - 104, pz + 34]], 0, 1.8, [[[px - 100, pz - 30], [px + 100, pz - 30], [px + 100, pz + 30], [px - 100, pz + 30]]]), M.light, world);
      add(box(200, 0.4, 60), M.mid, world, { x: px, y: -2.8, z: pz, edges: false });
      const w = new THREE.Mesh(new THREE.PlaneGeometry(200, 60).rotateX(-Math.PI / 2), M.pool); w.position.set(px, 0.6, pz); world.add(w);
      for (const dz of [-15, 0, 15]) add(box(190, 0.8, 0.8), M.dark, world, { x: px, y: 1.0, z: pz + dz, edges: false });
    }
    // 開閉所(750 kV): 門型の鉄構と母線、送電鉄塔
    for (let i = 0; i < 5; i++) {
      const x = -520 + i * 60;
      for (const z of [-320, -260, -200]) { for (const dz of [-10, 10]) add(box(2.2, 30, 2.2), M.mid, world, { x, y: 15, z: z + dz }); add(box(3, 2, 22), M.mid, world, { x, y: 30, z }); }   // 門型の鉄構(柱は箱で代用)
      for (const z of [-320, -260, -200]) if (i < 4) add(box(60, 0.5, 0.5), M.dark, world, { x: x + 30, y: 26, z, edges: false });
      if (i < 4) for (const z of [-290, -230]) for (const dx of [-8, 8]) add(box(3, 7, 3), M.mid, world, { x: x + 30 + dx, y: 3.5, z });   // 遮断器
    }
    for (const x of [-500, -400, -300]) { lattice(world, V(x, 0, -150), 55, 5, 1.6, 5, 0.45); add(box(20, 1.2, 2), M.mid, world, { x, y: 50, z: -150 }); }

    // ── 近未来化: SMR 2 基、対ドローンネット、国際監視団の観測ステーション ──
    add(box(90, 18, 70), M.body, world, { x: -505, y: 9, z: -10 });                           // SMR の建屋(炉室)
    add(box(90.4, 1.4, 70.4), M.accent, world, { x: -505, y: 15.5, z: -10, edges: false });
    for (const dx of [-22, 22]) {
      add(cyl(9, 16, 24), M.light, world, { x: -505 + dx, y: 26, z: -25 });
      const d = add(new THREE.SphereGeometry(9, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.light, world, { x: -505 + dx, y: 34, z: -25 }); d.scale.y = 0.5;
    }
    add(box(70, 14, 26), M.light, world, { x: -505, y: 7, z: 45 });                            // SMR のタービン建屋
    const MASTS = [];
    for (const z of [-118, 92]) for (const x of [-450, -150, 150, 450]) MASTS.push([x, z]);
    for (const [x, z] of MASTS) {
      add(box(4, 1.5, 4), M.mid, world, { x, y: 0.75, z });
      add(cyl(1.0, NET_Y + 5, 8), M.mid, world, { x, y: (NET_Y + 5) / 2, z });
      add(box(2.6, 2, 2.6), M.accent, world, { x, y: NET_Y + 4, z, edges: false });
    }
    const netPts = [], NX = [-450, 450], NZ = [-118, 92];
    for (let x = NX[0]; x <= NX[1] + 0.1; x += 25) netPts.push(x, NET_Y, NZ[0], x, NET_Y, NZ[1]);
    for (let z = NZ[0]; z <= NZ[1] + 0.1; z += 21) netPts.push(NX[0], NET_Y, z, NX[1], NET_Y, z);
    const netG = new THREE.BufferGeometry(); netG.setAttribute("position", new THREE.Float32BufferAttribute(netPts, 3));
    world.add(new THREE.LineSegments(netG, M.net));
    // 観測ステーション(2 階建てのユニット建屋、計測の塔、放射線の監視柱)
    add(box(28, 7, 12), M.body, world, { x: -190, y: 3.5, z: -295 });
    add(box(28.2, 0.8, 12.2), M.accent, world, { x: -190, y: 6.2, z: -295, edges: false });
    add(box(14, 3.4, 12), M.light, world, { x: -197, y: 8.7, z: -295 });
    for (const y of [2.4, 5.0]) add(box(28.2, 1.0, 12.2), M.glass, world, { x: -190, y, z: -295, edges: false });
    lattice(world, V(-160, 0, -300), 32, 2.0, 0.8, 4, 0.25);
    add(box(3, 1.6, 1.4), M.body, world, { x: -160, y: 33, z: -299.4 });
    add(box(1.2, 1.0, 1.2), M.dark, world, { x: -160, y: 34.4, z: -300.5 });
    for (const [x, z] of [[-215, -270], [-165, -268]]) { add(cyl(0.4, 5, 8), M.mid, world, { x, y: 2.5, z }); add(box(1.4, 1.4, 1.4), M.light, world, { x, y: 5.5, z }); }

    // ── 稼働の演出: 冷却塔の湯気(粒)、噴霧池の噴霧 ──
    const PUFFS = 36, steam = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.steam, PUFFS * CT.length); steam.frustumCulled = false; world.add(steam);
    const SPRAY_N = 3 * 12, spray = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 1, 8, 1, true), M.spray, SPRAY_N * POOLS.length); spray.frustumCulled = false; world.add(spray);
    const sprayAt = []; for (const [px, pz] of POOLS) for (const dz of [-15, 0, 15]) for (let i = 0; i < 12; i++) sprayAt.push([px - 88 + i * 16, pz + dz]);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const { ring, disc } = U.zone(THREE, group, opts.r ?? 112, M.ring, M.disc);

    let state = opts.state ?? "stop", clock = 0;
    function fx(dt) {
      clock += dt;
      const on = state === "run";
      steam.visible = spray.visible = on;
      if (!on) return;
      let n = 0;
      for (const [cx, cz] of CT) for (let i = 0; i < PUFFS; i++) {
        const t = ((clock * 0.06 + i / PUFFS) % 1), j = (i * 37) % 11;
        ps.set(cx + t * 70 + Math.sin(i * 2.3) * 14, CT_H + 4 + t * 120, cz + Math.cos(i * 1.7) * 14 - t * 20);
        const s = (20 + j * 1.6) * (0.6 + t) * (t > 0.85 ? (1 - t) / 0.15 : 1);
        mt.compose(ps, q.identity(), sc.set(s, s * 0.8, s)); steam.setMatrixAt(n++, mt);
      }
      steam.instanceMatrix.needsUpdate = true;
      sprayAt.forEach(([x, z], i) => { const h = 6 + 1.5 * Math.sin(clock * 3 + i); mt.compose(ps.set(x, 1.2 + h / 2, z), q.identity(), sc.set(1, h, 1)); spray.setMatrixAt(i, mt); });
      spray.instanceMatrix.needsUpdate = true;
    }
    function update(dt) { fx(dt); ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; }
    function setState(s) { if (s === "stop" || s === "run") state = s; fx(0); }
    fx(0);
    const r1 = (v) => +v.toFixed(1);
    function check() {
      const contTop = CONT.h + CONT.r * CONT.dome;
      return {
        netOverContainment_m: r1(NET_Y - contTop),                         // ネットと格納容器の頂部の隙間
        netOverTurbineHall_m: r1(NET_Y - 41),
        stackThroughNet_m: r1(STACK_H + 6 - NET_Y),                         // 排気筒はネットを突き抜ける(網に開口がある前提)
        coolingTowerGap_m: r1(Math.abs(CT[1][0] - CT[0][0]) - 2 * 64),     // 冷却塔の水槽どうしの隙間
        towerToPool_m: r1(CT[0][0] - 64 - (POOLS[0][0] + 104)),
        smrToUnit1_m: r1(UNIT_X[0] - 70 - (-505 + 45)),                    // SMR の建屋と 1 号機のタービン建屋の隙間
        contTop_m: r1(contTop), stackTop_m: r1(STACK_H + 6), towerTop_m: CT_H,
      };
    }
    U.bake(THREE, group, { live: [M.accent] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        row: { label: "炉の列(格納容器 6 基)", target: [-80, 35, -10], pos: [160, 170, 380] },
        tower: { label: "冷却塔", target: [290, 70, -245], pos: [40, 150, 80] },
        smr: { label: "SMR とネット", target: [-470, 30, -20], pos: [-700, 140, 170] },
        station: { label: "監視ステーション・開閉所", target: [-260, 10, -260], pos: [-120, 90, -130] },
      },
    };
  }

  DreamAssets.fac.register("zaporizhzhia", {
    section: 4, title: "ザポリージャ原子力発電所", kind: "STRATEGIC FACILITY · 4 エネルギー",
    desc: "同型の VVER-1000 の原子炉建屋 6 棟が一列に並び、裏に冷却塔 2 基、前に広い冷却池。6 基は冷温停止中。脇に SMR を増設し、上空を対ドローンネットで覆い、国際監視団の観測ステーションを置いた近未来版",
    info: [["ファイル", "mockups/3d/facilities/zaporizhzhia.js"], ["大きさ", "実寸 1120 × 690 m を 0.165 倍 × 表示 3.0"], ["誇張", "格納容器の高さ 1.6 倍、排気筒 1.3 倍。冷却塔と平面の配置は実寸"], ["省略", "車両・人・弁や配管・小さな付属建屋"], ["近未来化", "SMR 2 基、対ドローンネット、国際監視団の観測ステーション"]],
    dist: 1150, target: 40, tokenAt: [430, 0, 330],
    make: (THREE) => zaporizhzhia(THREE, { r: 112 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["冷温停止", () => a.setState("stop"), () => a.state === "stop"], ["再稼働", () => a.setState("run"), () => a.state === "run"]],
    caption: (a) => (a.state === "run" ? "再稼働 — 冷却塔から湯気、噴霧池で噴霧" : ""),
  });
})();
