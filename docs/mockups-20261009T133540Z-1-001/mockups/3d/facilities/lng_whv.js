// 戦略施設トークン「ヴィルヘルムスハーフェン LNG 基地」(ドイツ、浮体式 LNG 受入設備)の詳細版モデル(試作)。
// 決め手は「桟橋に横付けされた LNG 船とタンク」。ヤーデ湾の沖の桟橋(荷役台・係船ドルフィン・陸への架台)に、浮体式の貯蔵再ガス化船(FSRU、294 × 46 m、
// メンブレン式)が横付けし、球形タンク(モス式)の LNG 船が沖の錨地から来て横付けする。陸は堤防と、ガスの受入所・既存の大型タンク群。900 × 800 m を実寸の比率で組む。
// 誇張: 荷役アームの長さ 1.5 倍(読めるように)。船・平面・高さは実寸比。
// 省略: 曳船・作業船・車両・人。陸への架台は実物 約 1.2 km のうち手前 300 m を切り取り。
// 近未来化(施設リストの案): 浮体式なので別の港へ移動できるユニットとして扱う → 状態「移動」で荷役アームを外し、FSRU が桟橋を離れる。
// 状態: "regas"(再ガス化: FSRU が接続、LNG 船は錨地)/ "sts"(受け入れ: LNG 船が FSRU に横付け)/ "relocate"(移動: アームを外して FSRU が離桟)。
//       順序は守る: LNG 船は FSRU が桟橋にいるときだけ横付けし、FSRU は LNG 船が離れてアームを外してから動く。
// 座標: x が東(沖)、z が南。陸は西(-x)。
(function () {
  const K = 0.12;
  const D = {
    x0: -450, x1: 450, z0: -400, z1: 400,
    ground: 3, bed: -18, base: -21,
    deckY: 12, platform: [40, 80, -32, 32],
    fsru: { L: 294, B: 46, fb: 22, dr: 11, at: [109, 0], away: [250, 100] },
    lngc: { L: 290, B: 49, fb: 20, dr: 11, anchor: [360, -120], sts: [109 + 23 + 5 + 24.5, 0] },
    arms: { z: [-12, -4, 4, 12], P0: [74, 32], L1: 21, L2: 24, T: [92, 24] },   // 荷役アーム(実物 14 / 16 m を 1.5 倍)
  };
  const SPEED = 9, ARM_SEC = 4;

  function lngWhv(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 85;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE); M.sea.side = THREE.DoubleSide;
    const group = new THREE.Group(); group.name = "lng_whv";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, prism, tube, beam } = k;

    // ── 陸: 堤防(断面の連結)と背後の陸、海、海底 ──
    add(prism([[D.x0, D.z0], [-300, D.z0], [-300, D.z1], [D.x0, D.z1]], D.base, D.ground), M.land, world);
    const dike = [[-300, D.base], [-215, D.base], [-215, D.bed], [-235, -2], [-258, 8], [-272, 8], [-300, D.ground]];
    add(U.loft(THREE, [{ z: D.z0, pts: dike }, { z: D.z1, pts: dike }]), M.land, world);
    add(box(14, 0.3, D.z1 - D.z0), M.mid, world, { x: -265, y: 8.15, z: 0, edges: false });   // 堤防の上の道
    add(U.loft(THREE, [{ z: D.z0, pts: [[-235, -2.2], [-246, 2.4], [-246, 3.4], [-235, -1.2]] }, { z: D.z1, pts: [[-235, -2.2], [-246, 2.4], [-246, 3.4], [-235, -1.2]] }]), M.mid, world);   // 石張り
    world.add(k.waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], M.sea));
    add(box(D.x1 + 215, D.bed - D.base, D.z1 - D.z0), M.light, world, { x: (D.x1 - 215) / 2, y: (D.base + D.bed) / 2, edges: false });
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(D.x1 + 225, -D.bed), { x: (D.x1 - 225) / 2, y: D.bed / 2, z: D.z0 }], [new THREE.PlaneGeometry(D.x1 + 225, -D.bed), { x: (D.x1 - 225) / 2, y: D.bed / 2, z: D.z1 }],
      [new THREE.PlaneGeometry(D.z1 - D.z0, -D.bed), { x: D.x1, y: D.bed / 2, ry: Math.PI / 2 }],
    ]), M.waterCut));
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base);

    // ── 陸: 既存の大型タンク群(防油堤)、ガスの受入所(配管の架台・計量棟・管制棟) ──
    for (const [x, z] of [[-378, -300], [-378, -190], [-378, 290]]) {
      add(cyl(38, 22, 28), M.body, world, { x, y: D.ground + 11, z });
      add(new THREE.CylinderGeometry(30, 38.4, 4, 28), M.light, world, { x, y: D.ground + 24, z });   // 浮き屋根の縁
      add(cyl(38.5, 1.2, 28), M.accent, world, { x, y: D.ground + 18, z, edges: false });
      for (const [w, d, dx, dz] of [[90, 1.2, 0, -46], [90, 1.2, 0, 46], [1.2, 92, -45, 0], [1.2, 92, 45, 0]]) add(box(w, 2, d), M.light, world, { x: x + dx, y: D.ground + 1, z: z + dz });
    }
    const gs = V(-370, D.ground, 60);
    add(box(60, 0.3, 120), M.light, world, { x: gs.x, y: D.ground + 0.15, z: gs.z, edges: false });
    for (const z of [10, 30, 50, 70, 90, 110]) {   // 配管の架台(門型)と配管
      for (const x of [-394, -346]) add(box(1, 8, 1), M.mid, world, { x, y: D.ground + 4, z });
      add(box(50, 1, 1.4), M.mid, world, { x: -370, y: D.ground + 8, z });
    }
    for (const x of [-385, -370, -355]) { const p = cyl(1.2, 104, 10); p.rotateX(Math.PI / 2); add(p, M.light, world, { x, y: D.ground + 9.6, z: 60 }); }
    add(box(30, 9, 18), M.body, world, { x: -420, y: D.ground + 4.5, z: 130 });
    add(box(30.4, 1.6, 18.4), M.glass, world, { x: -420, y: D.ground + 6.5, z: 130, edges: false });
    add(box(18, 6, 12), M.light, world, { x: -330, y: D.ground + 3, z: 130 });
    for (const dz of [-4, 4]) add(cyl(1.6, 16, 10), M.mid, world, { x: -322, y: D.ground + 8, z: 130 + dz });   // 加温器の煙突

    // ── 架台(陸 → 沖の荷役台): 杭の橋脚、床版、ガス管 2 本 ──
    const [pa, pb, pc, pd] = D.platform;
    add(box(pa + 280, 2, 12), M.light, world, { x: (pa - 280) / 2, y: D.deckY - 1, z: 0 });
    add(box(8, D.deckY - 2 - D.ground, 14), M.light, world, { x: -284, y: (D.deckY - 2 + D.ground) / 2, z: 0 });   // 陸側の橋台
    for (let x = -230; x < pa; x += 30) for (const z of [-4.5, 4.5]) add(cyl(0.9, D.deckY - 2 - D.bed, 8), M.mid, world, { x, y: (D.deckY - 2 + D.bed) / 2, z });
    for (const z of [-3, 3]) { const p = cyl(0.8, pa + 300, 10); p.rotateZ(Math.PI / 2); add(p, M.body, world, { x: (pa - 300) / 2, y: D.deckY + 1, z }); }
    for (const z of [-6, 6]) add(box(pa + 280, 1.1, 0.3), M.dark, world, { x: (pa - 280) / 2, y: D.deckY + 0.6, z, edges: false });   // 手すり

    // ── 荷役台: 杭の上の床、管制室、配管、荷役アーム 4 基 ──
    add(box(pb - pa, 3, pd - pc), M.light, world, { x: (pa + pb) / 2, y: D.deckY + 1.5 - 2, z: 0 });
    for (let x = pa + 4; x < pb; x += 9) for (let z = pc + 4; z < pd; z += 9.4) add(cyl(1.0, D.deckY - 2 - D.bed, 8), M.mid, world, { x, y: (D.deckY - 2 + D.bed) / 2, z });
    add(box(14, 8, 16), M.body, world, { x: pa + 10, y: D.deckY + 5, z: -18 });
    add(box(14.4, 1.4, 16.4), M.glass, world, { x: pa + 10, y: D.deckY + 7, z: -18, edges: false });
    add(box(14.6, 0.6, 16.6), M.accent, world, { x: pa + 10, y: D.deckY + 8.6, z: -18, edges: false });
    for (const z of [-14, 14]) { const p = cyl(1.2, 30, 10); p.rotateZ(Math.PI / 2); add(p, M.body, world, { x: pa + 22, y: D.deckY + 2.3, z: z / 2 }); }
    const AR = D.arms, arms = [];
    for (const z of AR.z) {
      add(cyl(1.4, AR.P0[1] - (D.deckY + 1), 10), M.body, world, { x: AR.P0[0], y: (AR.P0[1] + D.deckY + 1) / 2, z });   // 立ち上がり管
      const inner = new THREE.Group(); inner.position.set(AR.P0[0], AR.P0[1], z); world.add(inner);
      add(box(1.6, AR.L1, 1.6), M.body, inner, { y: AR.L1 / 2 });
      add(cyl(2.2, 3, 10), M.mid, inner, { y: 0, rx: Math.PI / 2 });   // 根元の回転継手
      add(box(2.8, 2.8, 2.8), M.dark, inner, { y: -3.5, z: -3.2 });    // 釣り合いおもり(立ち上がり管の横)
      const outer = new THREE.Group(); outer.position.set(0, AR.L1, 3.0); inner.add(outer);   // 外側の腕は内側の横に並ぶ(折り畳んでも当たらない)
      add(box(1.4, AR.L2, 1.4), M.light, outer, { y: AR.L2 / 2 });
      add(cyl(1.6, 2.6, 10), M.mid, outer, { y: 0, rx: Math.PI / 2 });
      add(box(2.2, 2.2, 2.2), M.dark, outer, { y: AR.L2 });           // 先端の緊急切り離し継手
      arms.push({ inner, outer });
    }
    // 係船ドルフィン(杭の上の台と係船柱)、接舷ドルフィン(防舷材)、渡り通路
    const dolph = (x, z, fender) => {
      add(box(10, 4, 10), M.light, world, { x, y: D.deckY - 1, z });
      for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) add(cyl(0.9, D.deckY - 3 - D.bed, 8), M.mid, world, { x: x + dx, y: (D.deckY - 3 + D.bed) / 2, z: z + dz });
      if (fender) add(box(2, 8, 8), M.dark, world, { x: x + 6, y: D.deckY - 4, z });
      else add(cyl(0.8, 1.4, 8), M.dark, world, { x, y: D.deckY + 1.7, z });
      beam(world, V(pa + 20, D.deckY + 0.5, Math.sign(z) * pd), V(x, D.deckY + 0.5, z - Math.sign(z) * 5), 1.6, M.mid);
    };
    for (const z of [-75, 75]) dolph(79, z, true);
    for (const z of [-150, 150, -205, 205]) dolph(66, z, false);

    // ── 船: 断面の連結の船体(下は暗い塗装)。FSRU(メンブレン式、トランクデッキ、前部の再ガス化設備)と LNG 船(モス式の球形タンク 4 基) ──
    const hull = (g, L, B, fb, dr) => add(U.loft(THREE, [
      { z: -L / 2, pts: U.sym([[B * 0.44, -dr + 3], [B * 0.5, fb]]) }, { z: -L * 0.36, pts: U.sym([[B * 0.5, -dr], [B * 0.5, fb]]) },
      { z: L * 0.33, pts: U.sym([[B * 0.5, -dr], [B * 0.5, fb]]) }, { z: L * 0.46, pts: U.sym([[B * 0.24, -dr + 1], [B * 0.44, fb + 1]]) }, { z: L / 2, pts: U.sym([[1.5, -dr + 6], [3, fb + 2]]) },
    ]), M.dark, g);
    const house = (g, L, B, fb) => {
      add(box(B * 0.86, 26, 26), M.body, g, { y: fb + 13, z: -L * 0.42 });
      add(box(B * 0.88, 2, 26.4), M.glass, g, { y: fb + 23.5, z: -L * 0.42, edges: false });
      add(box(B + 2, 2, 6), M.body, g, { y: fb + 25, z: -L * 0.42 + 9 });   // 船橋の張り出し
      add(box(8, 12, 9), M.light, g, { y: fb + 32, z: -L * 0.46 });           // 煙突
    };
    const F_ = D.fsru, fsru = new THREE.Group(); fsru.rotation.y = Math.PI; world.add(fsru);   // 船首は北(-z)、左舷(西)を桟橋へ
    hull(fsru, F_.L, F_.B, F_.fb, F_.dr);
    add(box(F_.B - 1, 0.6, F_.L * 0.8), M.mid, fsru, { y: F_.fb + 0.3, edges: false });
    add(box(28, 4, 196), M.body, fsru, { y: F_.fb + 2, z: -8 });   // トランクデッキ(メンブレンタンクの上)
    for (let i = 0; i < 4; i++) { const z = -88 + i * 54; add(cyl(2.4, 4, 10), M.light, fsru, { y: F_.fb + 6, z }); add(box(22, 0.4, 2), M.dark, fsru, { y: F_.fb + 4.2, z: z + 26, edges: false }); }
    const RG = F_.L * 0.4;   // 前部の再ガス化設備(熱交換器の塔・配管の箱)と放出塔
    add(box(34, 10, 26), M.light, fsru, { y: F_.fb + 5, z: RG - 6 });
    for (const [x, z] of [[-10, RG - 14], [0, RG - 14], [10, RG - 14], [-10, RG + 2], [10, RG + 2]]) add(cyl(1.8, 16, 10), M.body, fsru, { x, y: F_.fb + 18, z });
    add(box(30, 1, 22), M.mid, fsru, { y: F_.fb + 10.5, z: RG - 6, edges: false });
    tube(fsru, V(0, F_.fb, F_.L * 0.47), V(0, F_.fb + 46, F_.L * 0.47), 0.9, M.light);
    add(box(10, 4, 8), M.light, fsru, { x: 17, y: F_.fb + 2, z: 0 });   // 左舷中央の荷役マニホールド
    house(fsru, F_.L, F_.B, F_.fb);
    for (const z of [-90, -30, 30, 90]) { const fg = cyl(2.25, 8, 12); fg.rotateX(Math.PI / 2); add(fg, M.dark, fsru, { x: -F_.B / 2 - 2.25, y: 1, z }); }   // 右舷の空気式防舷材(LNG 船との間)
    const lines = new THREE.Group(); world.add(lines);   // 係留索(桟橋にいるときだけ)
    for (const [x, z, sz] of [[66, -205, -1], [66, -150, -1], [66, 150, 1], [66, 205, 1]]) beam(lines, V(x, D.deckY + 2, z), V(F_.at[0] - F_.B / 2 + 2, F_.fb, sz * (F_.L / 2 - 30)), 0.35, M.dark);

    const C = D.lngc, lngc = new THREE.Group(); lngc.rotation.y = Math.PI; world.add(lngc);
    hull(lngc, C.L, C.B, C.fb, C.dr);
    add(box(C.B - 1, 0.6, C.L * 0.8), M.mid, lngc, { y: C.fb + 0.3, edges: false });
    for (const z of [102, 40, -22, -84]) {
      add(cyl(20.5, 6, 24), M.light, lngc, { y: C.fb + 3, z });                          // スカート(甲板上の覆い)
      add(new THREE.SphereGeometry(20, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.body, lngc, { y: C.fb + 6, z });   // 球形タンクの上半分
      add(cyl(3, 4, 10), M.mid, lngc, { y: C.fb + 27, z });                              // 頂部のドーム
      add(cyl(20.6, 1.2, 24), M.accent, lngc, { y: C.fb + 5.2, z, edges: false });
    }
    add(box(4, 3, C.L * 0.66), M.mid, lngc, { x: 14, y: C.fb + 1.5, z: 10 });   // 配管の通路
    house(lngc, C.L, C.B, C.fb);

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 状態: armT(0 = 収納、1 = 接続)、fsT(0 = 桟橋、1 = 離桟)、ctT(0 = 錨地、1 = 横付け) ──
    const ease = (x) => x * x * (3 - 2 * x), lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const armAngles = () => {   // 接続のときの 2 本の角度(鉛直から +x へ)。2 リンクの逆運動学(肘は上)
      const [px, py] = AR.P0, [tx, ty] = AR.T, dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy);
      const phi = Math.atan2(dx, dy), beta = Math.acos((AR.L1 * AR.L1 + d * d - AR.L2 * AR.L2) / (2 * AR.L1 * d));
      const a1 = phi - beta, ex = px + AR.L1 * Math.sin(a1), ey = py + AR.L1 * Math.cos(a1);
      return [a1, Math.atan2(tx - ex, ty - ey), [ex, ey]];
    };
    const [A1, A2, ELB] = armAngles();
    let state = opts.state ?? "regas", armT = 1, fsT = 0, ctT = 0, goal = { arm: 1, fs: 0, ct: 0 };
    const goals = { regas: { arm: 1, fs: 0, ct: 0 }, sts: { arm: 1, fs: 0, ct: 1 }, relocate: { arm: 0, fs: 1, ct: 0 } };
    function apply() {
      const a1 = A1 * ease(armT), a2 = Math.PI + (A2 - Math.PI) * ease(armT);   // 収納: 内側は鉛直、外側は折り畳んで下向き
      for (const a of arms) { a.inner.rotation.z = -a1; a.outer.rotation.z = -(a2 - a1); }
      const fp = lerp2(F_.at, F_.away, ease(fsT)), cp = lerp2(C.anchor, C.sts, ease(ctT));
      fsru.position.set(fp[0], 0, fp[1]); lngc.position.set(cp[0], 0, cp[1]);
      lines.visible = fsT === 0;
    }
    const step = (v, g, rate) => v + Math.sign(g - v) * Math.min(Math.abs(g - v), rate);
    function update(dt) {
      // 順序: LNG 船が錨地へ戻る → アームを外す → FSRU が動く。FSRU が桟橋に戻る → アームを付ける / LNG 船が横付け
      if (goal.ct === 0 || fsT === 0) ctT = step(ctT, goal.ct, (dt * SPEED) / 230);
      if (goal.arm === 1 ? fsT === 0 : ctT === 0) armT = step(armT, goal.arm, dt / ARM_SEC);
      if (armT === 0 && ctT === 0) fsT = step(fsT, goal.fs, (dt * SPEED) / 170);
      apply();
      M.sea.map.offset.y -= dt * 0.05;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) { if (goals[s]) { state = s; goal = goals[s]; } }
    function setNow(s) { setState(s); armT = goal.arm; fsT = goal.fs; ctT = goal.ct; apply(); }
    apply();
    function check() {
      const r1 = (v) => +v.toFixed(2);
      return {
        armReach_m: r1(Math.hypot(AR.T[0] - AR.P0[0], AR.T[1] - AR.P0[1])), armElbow: ELB.map(r1),
        armTipToManifold_m: 0, armStowedToHull_m: r1(F_.at[0] - F_.B / 2 - (AR.P0[0] + 1.4)),   // 収納したアーム(鉛直)と船体の左舷
        fsruToBreastingFender_m: r1(F_.at[0] - F_.B / 2 - (79 + 7)),
        fsruToLngcSts_m: r1(C.sts[0] - C.B / 2 - (F_.at[0] + F_.B / 2)), fendersBetween: "直径 4.5 m",
        relocatedFsruToAnchoredLngc_m: r1(C.anchor[0] - C.B / 2 - (F_.away[0] + F_.B / 2)),
        hullToEdge_m: r1(Math.min(D.z1 - (F_.away[1] + F_.L / 2), C.anchor[1] - C.L / 2 - D.z0, D.x1 - (C.anchor[0] + C.B / 2))),
        keelToBed_m: r1(-F_.dr - D.bed),
      };
    }

    U.bake(THREE, group, { dynamic: [fsru, lngc, lines, ...arms.flatMap((a) => [a.inner, a.outer])], live: [M.accent], also: [M.lamp] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, setNow, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; }, get busy() { return armT !== goal.arm || fsT !== goal.fs || ctT !== goal.ct; },
      shots: {
        jetty: { label: "荷役台とアーム", target: [85, 20, 0], pos: [10, 70, 110] },
        ships: { label: "FSRU と LNG 船", target: [150, 15, 0], pos: [380, 110, 300] },
        shore: { label: "堤防・架台・タンク", target: [-330, 5, 0], pos: [-120, 120, 330] },
      },
    };
  }

  DreamAssets.fac.register("lng_whv", {
    section: 4, title: "ヴィルヘルムスハーフェン LNG", kind: "STRATEGIC FACILITY · 4 エネルギー",
    desc: "ロシア産ガスの代替として 1 年足らずで稼働した浮体式 LNG 受入設備。沖の桟橋に FSRU が横付けし、球形タンクの LNG 船が来て横付けする。浮体式なので桟橋を離れて別の港へ移せる",
    info: [["ファイル", "mockups/3d/facilities/lng_whv.js"], ["大きさ", "900 × 800 m を 0.12 倍 × 表示 3.0"], ["誇張", "荷役アームの長さ 1.5 倍。船・平面・高さは実寸比"], ["省略", "曳船・作業船・車両・人。陸への架台は手前 300 m"], ["動作", "受け入れ: LNG 船が錨地から横付け。移動: アームを外して FSRU が離桟"], ["近未来化", "移動できるユニットとしての FSRU(状態「移動」)"]],
    dist: 780, target: 25, tokenAt: [300, 0, 260],
    make: (THREE) => lngWhv(THREE, { r: 85 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["再ガス化", () => a.setState("regas"), () => a.state === "regas"], ["受け入れ(LNG 船)", () => a.setState("sts"), () => a.state === "sts"], ["移動(離桟)", () => a.setState("relocate"), () => a.state === "relocate"]],
    caption: (a) => (!a.busy ? "" : a.state === "sts" ? "受け入れ — LNG 船が FSRU に横付け" : a.state === "relocate" ? "移動 — アームを外して FSRU が離桟" : "再ガス化へ — FSRU を桟橋に戻してアームを接続"),
    ringParts: (a) => [a.parts.ring, a.parts.disc],
  });
})();
