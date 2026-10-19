// 戦略施設トークン「ジブラルタルの岩」(英領ジブラルタル、地中海の出入口)の詳細版モデル(試作)。
// 岩山の北半分と、地峡を東西に横切る滑走路を入れた 2000 × 2600 m を切り取る。平面の配置は実寸の比率(K = 0.04)。
// 決め手は一枚岩: 北面は地峡から切り立つ崖、東面は海へ落ちる急斜面、西面はなだらかで市街が這い上がる。
// 誇張: 岩山の高さ 1.3 倍(最高 約 550 m)、滑走路と道路の幅 2 倍、ムーア人の城 2 倍、砲台の砲 3 倍、坑道の口 2 倍、ロープウェイの駅 1.5 倍、遮断機 3 倍。
// 省略: 航空機・車両・人・船、街路樹、小さな建物(市街は街区の塊)。南半分(ヨーロッパ岬)は切り取りの外。
// 近未来化: 北面の崖の足元に掘り込んだ無人機の格納庫(坑道の伝統を継ぐ)と誘導路、山頂の海峡監視ステーション(箱形のレーダーの覆い、電子光学の窓)。
// 動き: 滑走路を横切るウィンストン・チャーチル通りの遮断機(実物と同じ。航空機の離着陸の間だけ道路を止める)。
//
//   const a = DreamAssets.fac.defs.gibraltar.make(THREE)(制圧圏 r = 80)
// 北(スペイン側)が +z、西(湾)が +x。ゲーム視点は北から岩の北面を見る向き。
(function () {
  const K = 0.04, EX = 1.3;
  const D = { x0: -900, x1: 1100, z0: -1300, z1: 1300, base: -30, sea: -18, flat: 3, cell: 25, rwZ: 800, rwW: 90, road: 150 };
  const XC = (D.x0 + D.x1) / 2;
  const crestX = (z) => -180 + 0.05 * z;
  const HC = [[480, 412], [380, 412], [200, 390], [0, 380], [-300, 395], [-700, 426], [-1000, 410], [-1300, 395]];   // 稜線の高さ(実寸)
  const crestH = (z) => {
    for (let i = 0; i < HC.length - 1; i++) { const [za, ha] = HC[i], [zb, hb] = HC[i + 1]; if (z <= za && z >= zb) return ha + ((hb - ha) * (za - z)) / (za - zb); }
    return HC[HC.length - 1][1];
  };
  // 岩山の高さ(誇張後)。東は海へ落ちる急斜面(崖は下ほど急)、西はなだらか、北面は地峡から切り立つ崖
  function rock(x, z) {
    const u = x - crestX(z);
    let fx = 0;
    if (u < 0) { const t = -u / 270; fx = t < 1 ? Math.sqrt(1 - t) : 0; } else { const t = u / 720; fx = t < 1 ? Math.pow(1 - t, 1.7) : 0; }
    const fz = z <= 380 ? 1 : z < 480 ? Math.pow((480 - z) / 100, 0.3) : 0;
    let h = crestH(z) * EX * fx * fz;
    if (h > 25) h += 7 * Math.sin(x / 37) * Math.sin(z / 53) + 4 * Math.sin(x / 13 + z / 29);   // 石灰岩の凹凸
    return h;
  }
  function isLand(x, z) {
    if (z > 480) return (x > -620 && x < 720) || (z > 740 && z < 860 && x < D.x1 - 5);   // 地峡(滑走路は湾へ埋め立て)
    return x > crestX(z) - 270 && (x < 680 || (x < 800 && z > -650 && z < 320));          // 岩の足元と西の港の埋立地
  }
  const height = (x, z) => (isLand(x, z) ? Math.max(D.flat, rock(x, z)) : D.sea);

  function gibraltar(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE);
    M.asphalt = M.lambert(0x8a939c);
    M.terrain = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const group = new THREE.Group(); group.name = "gibraltar";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, 0); group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, tube, lattice } = k;
    const rng = U.rng(7);

    // ── 地形: 格子の高さ場(頂点色で石灰岩・崖・低木・平地・海底を塗り分け)と台座の側面 ──
    const NX = Math.round((D.x1 - D.x0) / D.cell), NZ = Math.round((D.z1 - D.z0) / D.cell);
    const H = [];
    for (let j = 0; j <= NZ; j++) { H.push([]); for (let i = 0; i <= NX; i++) H[j].push(height(D.x0 + i * D.cell, D.z0 + j * D.cell)); }
    const pos = [], col = [], c = new THREE.Color(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3();
    const tint = { sea: 0xe9edf1, flat: 0xdde2e7, rock: 0xd9d5ca, cliff: 0xb9b4a9, scrub: 0xa9b39c };
    const tri = (a, b, cc) => {
      A.copy(a); B.copy(b); C.copy(cc); n.subVectors(B, A).cross(C.clone().sub(A)).normalize();
      if (n.y < 0) { const tmp = b; b = cc; cc = tmp; n.negate(); }
      const hy = (a.y + b.y + cc.y) / 3, xm = (a.x + b.x + cc.x) / 3, zm = (a.z + b.z + cc.z) / 3;
      const t = hy < 0 ? tint.sea : hy < 8 ? tint.flat : n.y < 0.55 ? tint.cliff : hy > 40 && xm > crestX(zm) + 40 && hy < 420 ? tint.scrub : tint.rock;
      c.set(t);
      for (const p of [a, b, cc]) { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); }
    };
    const P = (i, j) => V(D.x0 + i * D.cell, H[j][i], D.z0 + j * D.cell);
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1); tri(a, cc, b); tri(a, d, cc); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, M.terrain); terrain.userData.keep = true; world.add(terrain);
    // 台座の側面(地形の断面)と、海の部分の水の切り口
    const side = [], cut = [];
    const edge = (pts) => { for (let q = 0; q < pts.length - 1; q++) { const [a, b] = [pts[q], pts[q + 1]]; side.push(a.x, D.base, a.z, b.x, D.base, b.z, b.x, b.y, b.z, a.x, D.base, a.z, b.x, b.y, b.z, a.x, a.y, a.z); if (a.y < 0 && b.y < 0) cut.push(a.x, a.y, a.z, b.x, b.y, b.z, b.x, 0, b.z, a.x, a.y, a.z, b.x, 0, b.z, a.x, 0, a.z); } };
    edge(Array.from({ length: NX + 1 }, (_, i) => P(i, 0))); edge(Array.from({ length: NX + 1 }, (_, i) => P(i, NZ)));
    edge(Array.from({ length: NZ + 1 }, (_, j) => P(0, j))); edge(Array.from({ length: NZ + 1 }, (_, j) => P(NX, j)));
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(side, 3)); sg.computeVertexNormals();
    M.side = M.lambert(0xc9c4b8, { side: THREE.DoubleSide });
    const sideMesh = new THREE.Mesh(sg, M.side); sideMesh.userData.keep = true; world.add(sideMesh);
    const cg = new THREE.BufferGeometry(); cg.setAttribute("position", new THREE.Float32BufferAttribute(cut, 3));
    world.add(new THREE.Mesh(cg, M.waterCut));
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base, { x: XC });
    const sea = k.waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], M.sea); sea.position.y = 0.05; world.add(sea);

    // 地形の上に置く: 足元の最も低い所から生やす(浮かない)
    const groundMin = (x, z, w, d) => Math.min(height(x - w / 2, z - d / 2), height(x + w / 2, z - d / 2), height(x - w / 2, z + d / 2), height(x + w / 2, z + d / 2), height(x, z));
    const groundMax = (x, z, w, d) => Math.max(height(x - w / 2, z - d / 2), height(x + w / 2, z - d / 2), height(x - w / 2, z + d / 2), height(x + w / 2, z + d / 2), height(x, z));
    const onGround = (geoW, geoD, h, mat, x, z, o = {}) => { const y0 = groundMin(x, z, geoW, geoD) - 2, y1 = groundMax(x, z, geoW, geoD) + h; return add(box(geoW, y1 - y0, geoD), mat, world, { x, y: (y0 + y1) / 2, z, ...o }); };

    // ── 滑走路(地峡を東西に横切り、西は湾へ埋め立て)、標示、誘導路、ターミナル ──
    const rw0 = -590, rw1 = D.x1 - 15, rwL = rw1 - rw0, rwC = (rw0 + rw1) / 2;
    add(box(rwL + 10, D.flat - D.base, 130), M.light, world, { x: rwC, y: (D.flat + D.base) / 2 - 0.05, z: D.rwZ, edges: false });   // 埋立地の護岸(海の上の部分)
    add(box(rwL, 0.4, D.rwW), M.asphalt, world, { x: rwC, y: D.flat + 0.2, z: D.rwZ });
    for (let x = rw0 + 120; x < rw1 - 120; x += 70) add(box(36, 0.12, 2.4), M.body, world, { x, y: D.flat + 0.45, z: D.rwZ, edges: false });   // 中心線
    for (const xe of [rw0 + 30, rw1 - 30]) for (let q = -4; q <= 4; q++) if (q) add(box(40, 0.12, 5), M.body, world, { x: xe, y: D.flat + 0.45, z: D.rwZ + q * 9, edges: false });   // 末端のしま
    add(box(rwL - 200, 0.3, 30), M.mid, world, { x: rwC + 40, y: D.flat + 0.15, z: D.rwZ + 95, edges: false });    // 誘導路
    add(box(260, 0.3, 70), M.mid, world, { x: 330, y: D.flat + 0.15, z: 930, edges: false });                         // 駐機場
    // ターミナル(2012 年の新ターミナル。弓なりの屋根)
    add(box(150, 12, 45), M.body, world, { x: 340, y: D.flat + 6, z: 1000 });
    add(box(150.4, 3, 45.4), M.glass, world, { x: 340, y: D.flat + 6, z: 1000, edges: false });
    const roof = U.loft(THREE, [-75, 75].map((x) => ({ z: x, pts: [[-26, 0], [26, 0], [20, 5], [0, 7], [-20, 5]] })));
    add(roof, M.light, world, { x: 340, y: D.flat + 12, z: 1000, ry: Math.PI / 2 });
    add(box(152, 1.2, 47), M.accent, world, { x: 340, y: D.flat + 10.6, z: 1000, edges: false });
    add(box(14, 30, 14), M.light, world, { x: 230, y: D.flat + 15, z: 960 });   // 管制塔
    add(box(18, 5, 18), M.glass, world, { x: 230, y: D.flat + 32, z: 960, edges: false });
    add(box(19, 1.2, 19), M.mid, world, { x: 230, y: D.flat + 35, z: 960 });
    // 国境(地峡の北の端)の柵と検問所
    add(box(1300, 4, 3), M.mid, world, { x: 50, y: D.flat + 2, z: 1250, edges: false });
    add(box(60, 8, 30), M.light, world, { x: D.road, y: D.flat + 4, z: 1230 });

    // ── ウィンストン・チャーチル通り(滑走路を平面で横切る)と遮断機 ──
    add(box(28, 0.35, D.z1 - 480), M.asphalt, world, { x: D.road, y: D.flat + 0.17, z: (D.z1 + 480) / 2, edges: false });
    const booms = [];
    for (const sz of [-1, 1]) {
      const zb = D.rwZ + sz * (D.rwW / 2 + 22);
      add(box(16, 12, 10), M.body, world, { x: D.road + 31, y: D.flat + 6, z: zb });          // 遮断機の操作小屋
      add(box(16.4, 2, 10.4), M.glass, world, { x: D.road + 31, y: D.flat + 8, z: zb, edges: false });
      for (const sx of [-1, 1]) {   // 片側ずつの遮断機(支柱は道路の外、竿は道路の半分を覆う)
        const px = D.road + sx * 17;
        add(box(3, 6, 3), M.dark, world, { x: px, y: D.flat + 3, z: zb });
        const piv = new THREE.Group(); piv.position.set(px, D.flat + 5, zb); world.add(piv);
        add(box(16, 1.2, 1.2), M.red, piv, { x: -sx * 8 });
        booms.push({ piv, sx });
      }
    }

    // ── 西の港: 埋立地の岸壁、北防波堤と離れ防波堤、上屋 ──
    for (const [x, z, w, d] of [[900, 270, 220, 24], [1000, 170, 24, 220], [1010, -350, 24, 520]]) add(box(w, 4 - D.sea + 4, d), M.light, world, { x, y: (4 + D.sea - 4) / 2, z });
    for (const [x, z, w, d] of [[740, 150, 60, 110], [740, -150, 60, 140], [740, -480, 60, 120]]) add(box(w, 14, d), M.light, world, { x, y: D.flat + 7, z });

    // ── 市街(西の低い斜面に街区の塊) ──
    for (let z = -1250; z < 440; z += 42) for (let x = 330; x < 670; x += 48) {
      const xx = x + (rng() - 0.5) * 12, zz = z + (rng() - 0.5) * 10, w = 24 + rng() * 12, d = 20 + rng() * 12;
      if (!isLand(xx - w / 2, zz) || !isLand(xx + w / 2, zz) || rock(xx, zz) > 70) continue;
      if (Math.hypot(xx - 330, zz - 300) < 70) continue;                       // 城
      if (Math.hypot(xx - 520, zz + 350) < 40) continue;                       // ロープウェイの駅
      onGround(w, d, 8 + rng() * 14, rng() < 0.75 ? M.body : M.light, xx, zz);
    }

    // ── 要塞: ムーア人の城(オマージュの塔と城壁)、北面の大包囲戦の坑道の口、稜線の砲台 ──
    const castle = V(330, 0, 300);
    onGround(40, 40, 46, M.light, castle.x, castle.z);                              // オマージュの塔(2 倍)
    const ct = groundMax(castle.x, castle.z, 40, 40) + 46;
    for (const [dx, dz] of [[-17, -17], [17, -17], [17, 17], [-17, 17], [0, -17], [0, 17], [-17, 0], [17, 0]]) add(box(5, 4, 5), M.light, world, { x: castle.x + dx, y: ct + 2, z: castle.z + dz });   // 胸壁
    for (const [x0, z0, x1, z1] of [[310, 280, 230, 390], [350, 280, 470, 330], [470, 330, 520, 440]]) {   // 斜面を下る城壁
      const N = 6;
      for (let q = 0; q < N; q++) { const t = (q + 0.5) / N, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, len = Math.hypot(x1 - x0, z1 - z0) / N; onGround(len + 2, 6, 14, M.light, x, z, { ry: -Math.atan2(z1 - z0, x1 - x0) }); }
    }
    // 坑道の口: 北面の崖の高い所に並ぶ砲眼(崖の面に沿わせて少し埋める)
    const faceZ = (x, y) => { let z = 380; while (z < 480 && rock(x, z) > y) z += 1; return z; };
    for (const [x, y] of [[-130, 300], [-100, 285], [-70, 300], [-40, 270], [-10, 290], [20, 265], [50, 280], [-60, 220], [0, 210]]) add(box(12, 10, 8), M.dark, world, { x, y, z: faceZ(x, y) - 2, edges: false });
    // 砲台: 円い砲座と砲(3 倍)
    for (const [x, z, a] of [[crestX(370) + 10, 365, 0.2], [crestX(-700) + 15, -700, -0.6], [crestX(-200) + 20, -200, 1.2]]) {
      const y = rock(x, z) - 1;
      add(cyl(14, 4, 16), M.light, world, { x, y: y + 2, z });
      add(cyl(9, 4.5, 16), M.mid, world, { x, y: y + 2.4, z });
      tube(world, V(x, y + 6, z), V(x + Math.sin(a) * 36, y + 9, z + Math.cos(a) * 36), 1.6, M.dark);
    }

    // ── ロープウェイ(街の下の駅 → 稜線の上の駅)。籠は小さいので省略、索と支柱と駅だけ ──
    const st0 = V(520, height(520, -350), -350), st1x = crestX(-560) + 30, st1 = V(st1x, rock(st1x, -560), -560);
    onGround(30, 20, 15, M.body, st0.x, st0.z);
    add(box(36, 18, 22), M.body, world, { x: st1.x, y: st1.y + 7, z: st1.z });
    add(box(36.4, 3, 22.4), M.glass, world, { x: st1.x, y: st1.y + 11, z: st1.z, edges: false });
    const mid = V((st0.x + st1.x) / 2, 0, (st0.z + st1.z) / 2); mid.y = height(mid.x, mid.z);
    lattice(world, V(mid.x, mid.y - 2, mid.z), 40, 3, 1.4, 4, 0.5, M.mid);
    const cable = [];
    for (const dz of [-4, 4]) { const a = V(st0.x, st0.y + 14, st0.z + dz), m = V(mid.x, mid.y + 38, mid.z + dz), b = V(st1.x, st1.y + 12, st1.z + dz); cable.push(a, m, m, b); }
    world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cable), new THREE.LineBasicMaterial({ color: 0x3b4752 })));

    // ── 近未来化 1: 山頂の海峡監視ステーション(箱形のレーダーの覆い 2、格子の塔、チーム色の帯) ──
    const sx0 = crestX(-120) + 10, sz0 = -120, sy0 = rock(sx0, sz0) - 2;
    add(box(60, 14, 34), M.body, world, { x: sx0, y: sy0 + 7, z: sz0 });
    add(box(60.4, 1.2, 34.4), M.accent, world, { x: sx0, y: sy0 + 12, z: sz0, edges: false });
    for (const dx of [-18, 18]) { add(box(14, 10, 10), M.light, world, { x: sx0 + dx, y: sy0 + 19, z: sz0 }); add(box(12, 6, 7), M.body, world, { x: sx0 + dx, y: sy0 + 27, z: sz0 }); }
    lattice(world, V(sx0, sy0 + 14, sz0 - 12), 30, 2.4, 1, 3, 0.4, M.mid);
    add(box(4, 3, 4), M.dark, world, { x: sx0, y: sy0 + 46, z: sz0 - 12 });
    add(box(3, 1.4, 0.3), M.glass, world, { x: sx0, y: sy0 + 46, z: sz0 - 9.9, edges: false });

    // ── 近未来化 2: 北面の崖の足元に掘り込んだ無人機の格納庫(坑口 3)とエプロン・誘導路 ──
    for (const x of [-210, -120, -30]) {
      const z = faceZ(x, 20) - 6;
      add(box(46, 30, 20), M.light, world, { x, y: D.flat + 15, z });            // 坑口の枠
      add(box(36, 22, 21), M.dark, world, { x, y: D.flat + 11, z, edges: false });  // 扉
      add(box(46.4, 2, 20.4), M.accent, world, { x, y: D.flat + 31, z, edges: false });
    }
    add(box(300, 0.3, 120), M.mid, world, { x: -120, y: D.flat + 0.15, z: 560, edges: false });
    add(box(30, 0.3, D.rwZ - D.rwW / 2 - 620), M.mid, world, { x: -120, y: D.flat + 0.15, z: (620 + D.rwZ - D.rwW / 2) / 2, edges: false });

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 80, M.ring, M.disc);

    // ── 状態: 道路の通行 / 滑走路の使用(遮断機が下りる) ──
    let state = opts.state ?? "road", tb = state === "runway" ? 1 : 0;
    const UP = 1.45;   // 上げたときの竿の角度(rad)
    function apply() { for (const b of booms) b.piv.rotation.z = b.sx * UP * (1 - tb) * -1; }
    function update(dt) {
      const target = state === "runway" ? 1 : 0;
      tb += Math.sign(target - tb) * Math.min(Math.abs(target - tb), dt / 4);
      apply();
      M.sea.map.offset.y -= dt * 0.02;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function check() {
      const r1 = (v) => +v.toFixed(2);
      return {
        boomDownGap_m: r1(D.flat + 5 - 0.6 - (D.flat + 0.35)),       // 下りた竿と路面
        boomTipToCenterline_m: r1(17 - 16),                         // 下りた竿の先と道路の中心線(片側ずつの竿が車線を覆う)
        boomUpTipHeight_m: r1(5 + 16 * Math.sin(UP)),                // 上げた竿の先の高さ(地面から)
        barrierToRunway_m: 22 - 5,                                   // 遮断機と滑走路の縁
        summit_m: r1(Math.max(...H.flat())),                         // 最高点(誇張後)
        northFaceDrop_m: r1(rock(crestX(400), 400) - D.flat),        // 北面の崖の高さ
      };
    }
    U.bake(THREE, group, { dynamic: booms.map((b) => b.piv), live: [M.accent] });
    apply();
    const at = (x, y, z) => V((x - XC) * K, (y - D.base) * K, z * K);
    return {
      group, update, check, at, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; }, get state() { return state; },
      shots: {
        face: { label: "北面の崖と坑道", target: [-60, 200, 380], pos: [150, 260, 1150] },
        crossing: { label: "滑走路と遮断機", target: [150, 5, 800], pos: [330, 90, 950] },
        castle: { label: "ムーア人の城と市街", target: [380, 60, 250], pos: [800, 230, 600] },
        summit: { label: "山頂の監視ステーション", target: [-180, 520, -120], pos: [150, 650, 150] },
      },
    };
  }

  DreamAssets.fac.register("gibraltar", {
    section: 9, title: "ジブラルタルの岩", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "地中海の出入口に突き出た一枚岩。北面は地峡から切り立つ崖で、地峡を横切る滑走路を街の幹線道路が平面で横切る。岩の中には坑道の要塞",
    info: [["ファイル", "mockups/3d/facilities/gibraltar.js"], ["大きさ", "岩の北半分と地峡 2000 × 2600 m を 0.04 倍 × 表示 3.0"], ["誇張", "岩山の高さ 1.3 倍、滑走路・道路の幅 2 倍、城 2 倍、砲 3 倍、坑道の口 2 倍、遮断機 3 倍"], ["省略", "航空機・車両・人・船、南半分(ヨーロッパ岬)"], ["状態", "道路の通行 / 滑走路の使用(遮断機が下りる)"], ["近未来化", "北面の足元の無人機の格納庫、山頂の海峡監視ステーション"]],
    dist: 760, target: 60, tokenAt: [250, 0, 250],
    make: (THREE) => gibraltar(THREE, { r: 80 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["道路の通行", () => a.setState("road"), () => a.state === "road"], ["滑走路の使用", () => a.setState("runway"), () => a.state === "runway"]],
    caption: (a) => (a.state === "runway" ? "滑走路の使用中 — 遮断機が下りて道路を止める" : ""),
  });
})();
