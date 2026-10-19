// 戦略施設トークン「ホストメリ(アントノフ)空港」(ウクライナ・キーウ近郊)の詳細版モデル(試作)。
// 実物の滑走路(長さ 3500 m × 幅 56 m)は長すぎるので、格納庫の前の約 1000 m を切り取った区間にする。平面は実寸の比率(縮尺 K = 0.2)。
// モデルの決め手: 長大な滑走路と、その横の超大型輸送機(An-225)の残骸。残骸は 1.25 倍に誇張。破壊された大型格納庫は骨組み(門型のトラス・壁の残り)で見せる。
// 状態(施設リストの案): "ruin" 廃墟(現在。滑走路と駐機場の弾痕、瓦礫、焼けた管制塔・管理棟・燃料タンク)
//                    "rebuilt" 再建後(近未来。無人輸送機・大型ドローンの運用拠点: 太陽光パネル屋根の新ターミナル、ドローン格納コンテナ列、新しい管制塔、無人輸送機 2 機。
//                    格納庫の骨組みと残骸は瓦礫を片付けて記念碑として残す)
// 省略: 車両・人・小さな機材・滑走路灯(実寸では小さすぎる)。
// 座標: m。滑走路は x 方向(+x が北西の想定)、+z が滑走路側。
(function () {
  const K = 0.2;
  const D = { ground: 0, base: -6, xw: 500, zw: 230, rwZ: 110, rwW: 56, twZ: 40, twW: 23, wreckS: 1.25,
    hangar: { x0: -330, x1: -150, z0: -215, z1: -85, h: 30 } };

  function hostomel(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 112;
    const M = F.mats(THREE);
    M.tree = M.lambert(0xbcc8b6); M.burnt = M.lambert(0x5a5f64); M.burntDS = M.lambert(0x5a5f64, { side: THREE.DoubleSide });
    const group = new THREE.Group(); group.name = "hostomel";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const { add, box, cyl, V, prism, tube, closedLoft } = F.kit(THREE, M, K);
    const rng = U.rng(11);
    const flat = (w, d, mat, parent, x, y, z, o = {}) => add(box(w, 0.04, d), mat, parent, { x, y, z, edges: false, ...o });   // 路面の標示

    // ── 台座: 草地の陸、足元の暗い帯 ──
    const land = U.slab(THREE, D.xw, D.zw, 18, -D.base); land.translate(0, D.base, 0);
    add(land, M.land, world);
    F.plinth({ add, box }, M, world, 2 * D.xw, 2 * D.zw, D.base);

    // ── 滑走路(切り取った区間)・誘導路・駐機場 ──
    add(box(2 * D.xw - 30, 0.2, D.rwW + 16), M.light, world, { y: 0.1, z: D.rwZ, edges: false });   // 路肩
    add(box(2 * D.xw - 30, 0.4, D.rwW), M.mid, world, { y: 0.2, z: D.rwZ });
    const mk = 0.42;
    for (const s of [-1, 1]) flat(2 * D.xw - 40, 0.9, M.body, world, 0, mk, D.rwZ + s * (D.rwW / 2 - 1.5));   // 縁の線
    for (let x = -400; x <= 470; x += 50) flat(30, 0.9, M.body, world, x, mk, D.rwZ);                         // 中心線
    flat(1.8, D.rwW - 4, M.body, world, -452, mk, D.rwZ);                                                    // 末端の線(ここが滑走路の端)
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) flat(30, 1.8, M.body, world, -425, mk, D.rwZ + s * (3.4 + i * 3.6));   // 末端のしま
    for (const s of [-1, 1]) flat(45, 9, M.body, world, -140, mk, D.rwZ + s * 10.5);                       // 目標点の標示
    for (const x of [-290, 10]) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) flat(22, 1.8, M.body, world, x, mk, D.rwZ + s * (12 + i * 3.2));   // 接地帯
    add(box(2 * D.xw - 30, 0.3, D.twW), M.mid, world, { y: 0.15, z: D.twZ });
    flat(2 * D.xw - 40, 0.35, M.dark, world, 0, 0.32, D.twZ);
    for (const x of [-420, -150, 120, 380]) add(box(D.twW, 0.3, D.rwZ - D.rwW / 2 - D.twZ - D.twW / 2 + 8), M.mid, world, { x, y: 0.15, z: (D.twZ + D.twW / 2 + D.rwZ - D.rwW / 2) / 2 });
    const H = D.hangar;
    add(prism([[-430, 28.4], [330, 28.4], [330, -60], [H.x1, -60], [H.x1, H.z1], [H.x0, H.z1], [H.x0, -60], [-430, -60]], 0, 0.25), M.light, world);
    for (let x = -390; x < 330; x += 40) flat(0.25, 88, M.mid, world, x, 0.27, -16);   // 駐機場の継ぎ目

    // ── 大型格納庫の骨組み(両方の状態に残る。再建後は記念碑) ──
    const hx = (H.x0 + H.x1) / 2, hz = (H.z0 + H.z1) / 2, HW = H.x1 - H.x0, HD = H.z1 - H.z0;
    add(box(HW, 0.3, HD), M.mid, world, { x: hx, y: 0.15, z: hz });
    // 壁の残り(パネルが落ちて高さがまちまち)と柱
    const backH = [30, 22, 12, 26, 30, 18];
    backH.forEach((h, i) => add(box(HW / 6, h, 1.5), M.light, world, { x: H.x0 + HW / 12 + (i * HW) / 6, y: h / 2, z: H.z0 }));
    for (const [x, hs] of [[H.x0, [30, 30, 15, 8, 24]], [H.x1, [30, 20, 30, 30, 12]]]) hs.forEach((h, i) => add(box(1.5, h, HD / 5), M.light, world, { x, y: h / 2, z: H.z0 + HD / 10 + (i * HD) / 5 }));
    for (let i = 0; i <= 9; i++) add(box(1.6, H.h + 1, 1.6), M.steel, world, { x: H.x0 + (i * HW) / 9, y: (H.h + 1) / 2, z: H.z0 + 1.6 });
    for (const x of [H.x0, H.x1]) add(box(5, H.h + 2, 5), M.light, world, { x, y: (H.h + 2) / 2, z: H.z1 });   // 扉側の大柱
    // 扉の上の大梁(トラス)
    const truss = (parent, p0, p1, h, arch, n, rc, rw) => {
      const bot = (t) => p0.clone().lerp(p1, t), top = (t) => bot(t).add(V(0, h + arch * Math.sin(Math.PI * t), 0));
      for (let i = 0; i < n; i++) { const a = i / n, b = (i + 1) / n; tube(parent, bot(a), bot(b), rc, M.steel); tube(parent, top(a), top(b), rc, M.steel); tube(parent, i % 2 ? bot(a) : top(a), i % 2 ? top(b) : bot(b), rw, M.steel); }
      for (let i = 1; i < n; i++) tube(parent, bot(i / n), top(i / n), rw, M.steel);
      return { top, bot };
    };
    truss(world, V(H.x0, 26, H.z1), V(H.x1, 26, H.z1), 6, 0, 12, 0.9, 0.5);
    // 屋根のトラス(奥の壁から扉の大梁へ)。2 本は落ちて無く、1 本は扉側の端が床へ落ちている
    const trussX = Array.from({ length: 8 }, (_, i) => H.x0 + 10 + i * 24);
    const fallen = new THREE.Group(); world.add(fallen);
    const roofTops = [];
    trussX.forEach((x, i) => {
      if (i === 2 || i === 5) return;
      if (i === 6) {   // 落ちたトラス: 奥の端を軸に傾ける
        fallen.position.set(x, 27, H.z0); fallen.rotation.x = Math.atan2(27 - 6, HD);
        truss(fallen, V(0, 0, 0), V(0, 0, HD), 4, 3, 8, 0.7, 0.45);
        return;
      }
      const t = truss(world, V(x, 27, H.z0), V(x, 27, H.z1), 4, 3, 8, 0.7, 0.45);
      roofTops.push({ i, t });
    });
    for (let j = 0; j < roofTops.length - 1; j++) {   // 母屋(隣り合うトラスの間だけ)
      const a = roofTops[j], b = roofTops[j + 1];
      if (b.i - a.i !== 1) continue;
      for (const s of [0.25, 0.5, 0.75]) tube(world, a.t.top(s), b.t.top(s), 0.35, M.steel);
    }

    // ── An-225 の残骸(1.25 倍に誇張。胴体の中央が焼け落ち、左翼の外側が折れて落ちている) ──
    const wreck = new THREE.Group(); wreck.position.set(hx, 0, hz); wreck.scale.setScalar(D.wreckS); world.add(wreck);
    const ell = (rx, ry, cy, z) => Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) * Math.PI) / 4; return V(rx * Math.cos(a), cy + ry * Math.sin(a), z); });
    add(closedLoft([ell(3.3, 4.0, 4.0, 8), ell(3.3, 4.0, 4.0, 30), ell(3.0, 3.6, 4.3, 36), ell(2.2, 2.6, 4.6, 40), ell(1.0, 1.2, 4.8, 42.5)]), M.body, wreck);   // 前部
    add(closedLoft([ell(3.3, 4.0, 4.0, -6), ell(3.3, 4.0, 4.0, -30), ell(2.6, 3.0, 5.0, -36), ell(1.2, 1.6, 6.4, -42)]), M.body, wreck);                     // 後部(尾部は上へ反る)
    add(box(3.0, 0.8, 1.4), M.glass, wreck, { y: 7.2, z: 38.6, rx: -0.45, edges: false });                   // 操縦席の窓
    add(box(6.4, 2.6, 14), M.burnt, wreck, { y: 1.3, z: 1, ry: 0.05 });                                      // 焼け落ちた中央部
    for (const [x, z, r] of [[-2.5, -2, 0.5], [2.8, 4, -0.6], [0, 6.5, 0.3]]) add(box(4, 0.4, 5), M.burnt, wreck, { x, y: 2.8, z, rz: r, ry: r });
    const zLE = (s) => 6 - 0.364 * s, chord = (s) => 12 - (8 * s) / 44, wy = (s) => 8.3 - 0.05 * s;
    const wingRing = (side, s, dy = 0, dz = 0) => { const c = chord(s), z = zLE(s) + dz, y = wy(s) + dy, t = 1.4 - (0.9 * s) / 44; return [V(side * s, y, z), V(side * s, y + t / 2, z - 0.3 * c), V(side * s, y + 0.1, z - c), V(side * s, y - t / 2, z - 0.3 * c)]; };
    add(closedLoft([wingRing(1, 3.4), wingRing(1, 22), wingRing(1, 44)]), M.body, wreck);                    // 右翼(残る)
    add(closedLoft([wingRing(-1, 3.4), wingRing(-1, 26)]), M.body, wreck);                                   // 左翼(26 m で折れる)
    const outer = new THREE.Group(); outer.position.set(-30, 0, -6); outer.rotation.set(0, 0.25, -0.06); wreck.add(outer);   // 折れた左翼の外側(地面に落ちて後ろへずれる)
    const outerRing = (s) => { const c = chord(s), z = zLE(s) - zLE(27), t = 1.4 - (0.9 * s) / 44, x = -(s - 27), y = 1.1; return [V(x, y, z), V(x, y + t / 2, z - 0.3 * c), V(x, y + 0.1, z - c), V(x, y - t / 2, z - 0.3 * c)]; };
    add(closedLoft([outerRing(27), outerRing(44)]), M.body, outer);
    add(box(7, 1.5, 12), M.burnt, wreck, { y: 8.6, z: -1.3 });                                                // 中央翼(焼け跡)
    const nac = cyl(1.5, 7, 10); nac.rotateX(Math.PI / 2);
    for (const [side, s, mat] of [[1, 10, M.light], [1, 17.5, M.light], [1, 25, M.light], [-1, 10, M.burnt], [-1, 17.5, M.burnt]]) {   // 発動機(右 3、左は焼けた 2)
      add(nac, mat, wreck, { x: side * s, y: wy(s) - 2.3, z: zLE(s) + 0.5 });
      add(box(0.5, 1.4, 4), M.mid, wreck, { x: side * s, y: wy(s) - 0.9, z: zLE(s) - 1.5 });
    }
    // 双垂直尾翼(水平尾翼の両端)
    add(closedLoft([-16, 16].map((x) => [V(x, 9.4, -31), V(x, 9.9, -33.5), V(x, 9.4, -38), V(x, 8.9, -33.5)])), M.body, wreck);
    add(box(2, 2.2, 5), M.light, wreck, { y: 8.4, z: -35 });
    for (const x of [-16, 16]) add(closedLoft([[V(x, 9.6, -31.5), V(x + 0.4, 9.6, -35), V(x, 9.6, -40), V(x - 0.4, 9.6, -35)], [V(x, 20, -36), V(x + 0.3, 20, -38), V(x, 20, -41), V(x - 0.3, 20, -38)]]), M.body, wreck);

    // ── 管理棟の場所・管制塔の場所・燃料タンク(土台は共通) ──
    for (const [x, z] of [[390, -160], [440, -160], [390, -110], [440, -110]]) add(cyl(16, 0.6, 20), M.light, world, { x, y: 0.3, z });
    for (const [x, z, w, d] of [[415, -186, 92, 1.2], [415, -84, 92, 1.2], [369, -135, 1.2, 102], [461, -135, 1.2, 102]]) add(box(w, 2.0, d), M.light, world, { x, y: 1, z });   // 防油堤
    // 松林(切り取った区間の外側。インスタンス 1 つ)
    const pine = U.concat(THREE, [{ geo: new THREE.ConeGeometry(4.2, 13, 7).translate(0, 9.5, 0).toNonIndexed(), color: M.tree.color }, { geo: cyl(0.6, 4, 5).translate(0, 2, 0).toNonIndexed(), color: M.mid.color }]);
    const trees = [];
    for (let i = 0; i < 260; i++) trees.push([-480 + rng() * 960, 168 + rng() * 52]);
    for (let i = 0; i < 70; i++) trees.push([-480 + rng() * 40, -210 + rng() * 150]);
    const pines = new THREE.InstancedMesh(pine, U.vcLambert(THREE), trees.length);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    trees.forEach(([x, z], i) => { const s = 0.75 + rng() * 0.6; mt.compose(V(x, 0, z), q.setFromAxisAngle(V(0, 1, 0), rng() * 6), sc.set(s, s, s)); pines.setMatrixAt(i, mt); });
    world.add(pines);

    // ── 廃墟(現在) ──
    const ruinG = new THREE.Group(); world.add(ruinG);
    const crater = (x, z, r, y) => { add(cyl(r + 3, 0.8, 12), M.mid, ruinG, { x, y: y + 0.4, z }); add(cyl(r, 0.86, 12), M.burnt, ruinG, { x, y: y + 0.45, z, edges: false }); };
    const CRATERS = [[-300, D.rwZ - 8, 7], [-40, D.rwZ + 12, 8], [210, D.rwZ - 4, 6], [410, D.rwZ + 10, 7], [-60, -20, 6], [180, 5, 5], [-380, -30, 7]];
    for (const [x, z, r] of CRATERS) crater(x, z, r, z > 60 ? 0.0 : -0.15);
    add(cyl(22, 0.06, 20), M.burnt, ruinG, { x: hx, y: 0.33, z: hz, edges: false });   // 焼け跡
    for (let i = 0; i < 26; i++) {   // 瓦礫(壁ぎわと落ちたトラスの下)
      const side = i % 3, x = side === 0 ? H.x0 + 5 + rng() * 25 : side === 1 ? H.x1 - 5 - rng() * 25 : H.x0 + 10 + rng() * (HW - 20);
      const z = side === 2 ? H.z0 + 4 + rng() * 10 : H.z0 + 8 + rng() * (HD - 16), w = 2 + rng() * 7;
      add(box(w, 0.8 + rng() * 2.2, 2 + rng() * 6), rng() < 0.4 ? M.burnt : M.mid, ruinG, { x, y: 0.9, z, ry: rng() * 3, rz: (rng() - 0.5) * 0.4 });
    }
    for (const [x, z, rz] of [[H.x0 + 8, H.z0 + 30, 1.1], [H.x1 - 8, H.z0 + 60, -1.0], [hx + 60, H.z0 + 6, 0.2]]) add(box(18, 0.4, 9), M.steel, ruinG, { x, y: 9, z, rz });   // 落ちた屋根板
    // 焼けた管制塔(運用室のガラスが割れて黒く、屋根が半分落ちる。アンテナの柱が曲がる)
    add(box(8, 30, 8), M.light, ruinG, { x: 150, y: 15, z: -150 });
    add(box(8.2, 6, 8.2), M.burnt, ruinG, { x: 150, y: 24, z: -150, edges: false });
    add(box(14, 5, 14), M.burnt, ruinG, { x: 150, y: 32.5, z: -150 });
    add(box(14, 0.8, 7), M.mid, ruinG, { x: 150, y: 35.4, z: -153.5 });
    add(box(14, 0.8, 7), M.mid, ruinG, { x: 150, y: 33.5, z: -146, rx: 0.5 });
    tube(ruinG, V(153, 35.8, -153), V(158, 43, -150), 0.3, M.dark);
    // 壊れた管理棟(右側が崩れて低くなり、瓦礫が出る)
    add(box(100, 10, 65), M.light, ruinG, { x: -40, y: 5, z: -172 });
    for (const y of [3, 7.5]) add(box(100.2, 1.6, 65.2), M.glass, ruinG, { x: -40, y, z: -172, edges: false });
    add(box(30, 4, 65), M.light, ruinG, { x: 25, y: 2, z: -172, rz: 0.08 });
    add(box(20, 2.5, 50), M.burnt, ruinG, { x: 50, y: 1.25, z: -170, ry: 0.2 });
    for (let i = 0; i < 8; i++) add(box(3 + rng() * 5, 1 + rng() * 2, 3 + rng() * 5), M.mid, ruinG, { x: 15 + rng() * 45, y: 1, z: -200 + rng() * 55, ry: rng() * 3 });
    // 燃料タンク: 2 基は焦げ、1 基は潰れ、1 基は裂ける
    add(cyl(14, 15, 20), M.light, ruinG, { x: 390, y: 7.8, z: -160 });
    add(cyl(14.1, 4, 20), M.burnt, ruinG, { x: 390, y: 13, z: -160, edges: false });
    add(cyl(14, 15, 20), M.light, ruinG, { x: 440, y: 7.8, z: -110 });
    add(new THREE.CylinderGeometry(9, 14, 5, 20), M.burnt, ruinG, { x: 440, y: 3.1, z: -160 });
    add(new THREE.CylinderGeometry(14, 14, 9, 20, 1, true, 0.9, 4.6), M.burntDS, ruinG, { x: 390, y: 5.1, z: -110 });

    // ── 再建後(近未来) ──
    const rebuiltG = new THREE.Group(); world.add(rebuiltG);
    for (const [x, z, r] of CRATERS) add(box(2.6 * r, 0.06, 2.6 * r), M.light, rebuiltG, { x, y: z > 60 ? 0.42 : 0.27, z, edges: false });   // 舗装の補修
    // 記念碑: 格納庫の前の慰霊の壁と、骨組みを囲う低い柵
    add(box(70, 3.2, 2.2), M.body, rebuiltG, { x: hx, y: 1.85, z: -72 });
    add(box(70.4, 0.6, 2.6), M.dark, rebuiltG, { x: hx, y: 3.6, z: -72, edges: false });
    for (const [x, z, w, d] of [[hx, H.z0 - 8, HW + 16, 0.4], [H.x0 - 8, hz, 0.4, HD + 16], [H.x1 + 8, hz, 0.4, HD + 16]]) add(box(w, 1.2, d), M.dark, rebuiltG, { x, y: 0.9, z, edges: false });
    // 新ターミナル(太陽光パネルの屋根、ガラスの帯、正面のひさし)
    add(box(150, 12, 65), M.body, rebuiltG, { x: -15, y: 6, z: -172 });
    add(box(150.2, 4, 65.2), M.glass, rebuiltG, { x: -15, y: 6.5, z: -172, edges: false });
    add(box(150.6, 0.5, 65.6), M.accent, rebuiltG, { x: -15, y: 11.6, z: -172, edges: false });
    add(box(151, 1.0, 66), M.light, rebuiltG, { x: -15, y: 12.4, z: -172 });
    for (let z = -200; z <= -146; z += 6) add(box(140, 0.3, 4.6), M.glass, rebuiltG, { x: -15, y: 14.0, z, rx: -0.3 });
    for (let z = -200; z <= -146; z += 6) add(box(140, 1.2, 0.3), M.mid, rebuiltG, { x: -15, y: 13.3, z: z - 1.6, edges: false });
    add(box(80, 0.8, 12), M.light, rebuiltG, { x: -15, y: 8.5, z: -133.5 });
    for (const x of [-50, -15, 20]) add(cyl(0.5, 8, 8), M.mid, rebuiltG, { x, y: 4, z: -129 });
    // 新しい管制塔
    add(cyl(4.5, 34, 12), M.body, rebuiltG, { x: 150, y: 17, z: -150 });
    add(cyl(5.2, 1.4, 12), M.accent, rebuiltG, { x: 150, y: 33.6, z: -150, edges: false });
    add(new THREE.CylinderGeometry(8.5, 7, 5, 8), M.glass, rebuiltG, { x: 150, y: 36.8, z: -150 });
    add(cyl(9.2, 1.0, 8), M.light, rebuiltG, { x: 150, y: 39.8, z: -150 });
    add(box(2.4, 2.0, 1.6), M.light, rebuiltG, { x: 152, y: 41.3, z: -151 });
    tube(rebuiltG, V(147, 40.3, -149), V(147, 48, -149), 0.25, M.dark);
    // ドローン格納コンテナ列(40 ft コンテナ、滑走路側の端が開く)
    for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) {
      const x = 152 + c * 13.6, z = -116 + r * 13;
      add(box(12.2, 2.6, 2.44), M.light, rebuiltG, { x, y: 1.3, z });
      add(box(0.12, 2.2, 2.1), M.dark, rebuiltG, { x: x + 6.12, y: 1.3, z, edges: false });
    }
    for (let r = 0; r < 4; r++) add(box(13 * 13.6 + 2, 0.4, 7), M.glass, rebuiltG, { x: 152 + 6 * 13.6, y: 5.2, z: -116 + r * 13 + 0.5, rx: -0.15 });   // 列ごとの太陽光の屋根
    for (let r = 0; r < 4; r++) for (const x of [146, 152 + 12 * 13.6 + 6]) add(box(0.6, 4.6, 0.6), M.mid, rebuiltG, { x, y: 2.6, z: -116 + r * 13 + 3.2 });
    // 燃料タンク(健在)
    for (const [x, z] of [[390, -160], [440, -160], [390, -110], [440, -110]]) { add(cyl(14, 15, 20), M.body, rebuiltG, { x, y: 7.8, z }); add(cyl(14.2, 0.8, 20), M.light, rebuiltG, { x, y: 15.6, z }); }
    // 無人輸送機 2 機(胴体 40 m、翼幅 56 m の高翼、操縦席の窓なし、V 尾翼、プロペラ 2 発)
    for (const [x, z] of [[-20, -18], [175, -18]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.PI; rebuiltG.add(g);
      add(closedLoft([ell(1.0, 1.0, 3.6, -20), ell(2.4, 2.6, 3.4, -12), ell(2.6, 2.8, 3.4, 10), ell(1.6, 1.8, 3.4, 18), ell(0.6, 0.6, 3.4, 20.5)]), M.body, g);
      add(closedLoft([-28, 28].map((x) => [V(x, 6.6, 3), V(x, 7.1, 1.2), V(x, 6.7, -3), V(x, 6.2, 1.2)])), M.body, g);
      for (const s of [-1, 1]) {
        const fin = (x, y, za, zb) => [V(x, y, za), V(x + 0.3, y, (za + zb) / 2), V(x, y, zb), V(x - 0.3, y, (za + zb) / 2)];
        add(closedLoft([fin(s * 0.6, 5.8, -14.5, -20.5), fin(s * 6.5, 10.8, -18, -21.2)]), M.body, g);   // V 尾翼
        add(nac.clone().scale(0.8, 0.8, 0.9), M.light, g, { x: s * 9, y: 5.6, z: 3.2 });
        add(box(0.3, 4.2, 0.6), M.dark, g, { x: s * 9, y: 5.6, z: 6.6, edges: false });   // プロペラ(止まっている)
        add(box(1.4, 1.8, 7), M.light, g, { x: s * 2.6, y: 1.1, z: 1 });                  // 脚のフェアリング
      }
    }

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    let state = opts.state ?? "ruin";
    const apply = () => { ruinG.visible = state === "ruin"; rebuiltG.visible = state === "rebuilt"; };
    U.bake(THREE, group, { dynamic: [ruinG, rebuiltG], live: [M.accent] });
    apply();
    const check = () => {
      const r1 = (v) => +v.toFixed(2), s = D.wreckS;
      return {
        wreckWingToSideWall_m: r1(HW / 2 - 44 * s),                 // 残骸の右翼端と格納庫の側壁
        wreckFinToRoofTruss_m: r1(27 - 0.7 - 20 * s),               // 垂直尾翼の上端と屋根のトラスの下弦
        wreckNoseToDoor_m: r1(H.z1 - (hz + 42.5 * s)),              // 機首と扉の線
        wreckTailToBackWall_m: r1(hz - 42 * s - H.z0),
        fallenTrussToWing_m: r1(Math.abs(trussX[6] - hx) - 44 * s),  // 落ちたトラスと右翼端(x 方向)
        containersToTower_m: r1(-116 - 1.22 - (-150 + 9.2)),        // コンテナ列と新しい管制塔
      };
    };
    return {
      group, check, stats: () => U.stats(group), parts: { ring, disc },
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      setTeam: (c) => F.setTeam(M, c), setState(s) { state = s; apply(); }, get state() { return state; },
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        wreck: { label: "An-225 の残骸と格納庫", target: [-240, 8, -150], pos: [-120, 75, -20] },
        tower: { label: "管制塔・ターミナル", target: [60, 10, -160], pos: [190, 60, -40] },
        drones: { label: "コンテナ列・無人輸送機", target: [200, 3, -80], pos: [330, 45, 10] },
        runway: { label: "滑走路の末端", target: [-400, 0, 110], pos: [-330, 40, 210] },
      },
    };
  }

  DreamAssets.fac.register("hostomel", {
    section: 1, title: "ホストメリ空港", kind: "STRATEGIC FACILITY · 1 交通・兵站",
    desc: "キーウ近郊のアントノフ空港。長大な滑走路の切り取った区間と、破壊された大型格納庫の骨組みの中の An-225 の残骸。再建後は無人輸送機・大型ドローンの運用拠点になり、残骸は記念碑として残る",
    info: [["ファイル", "mockups/3d/facilities/hostomel.js"], ["大きさ", "滑走路の約 1000 m を切り取り、1000 × 460 m を 0.2 倍 × 表示 3.0"], ["誇張", "An-225 の残骸 1.25 倍。ほかは実寸"], ["省略", "車両・人・小さな機材・滑走路灯"], ["状態", "廃墟(現在)/ 再建後(近未来)"], ["近未来化", "太陽光屋根の新ターミナル、ドローン格納コンテナ列、無人輸送機、新しい管制塔、残骸の記念碑化"]],
    dist: 1150, target: 25, tokenAt: [430, 0, 320],
    make: (THREE) => hostomel(THREE),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["廃墟(現在)", () => a.setState("ruin"), () => a.state === "ruin"], ["再建後(近未来)", () => a.setState("rebuilt"), () => a.state === "rebuilt"]],
    caption: () => "",
  });
})();
