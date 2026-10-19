// 戦略施設トークン「ヘルモン山」(イスラエル・シリア国境、標高約 2,800 m)の詳細版モデル(試作)。
// 山頂部(最高点 2,814 m のまわり 1,100 × 840 m)を切り取った地形の塊。標高 2,600 m で切り、高さは誇張しない(起伏 約 214 m)。
// 山頂の観測拠点: 土の堤の囲い(出入口つき)、レーダードーム 3 基(ジオデシックの覆い)、観測棟、格子のアンテナ塔、ヘリパッド、山頂の古代神殿跡(カスル・アンタル)、取り付け道路。
// 近未来化(施設リストの案「機械が見張る高地」): レーダードームを尾根に 3 基増設(台座にチーム色の帯)、山腹の無人監視ポスト 5 基(格子塔・電子光学の頭・太陽電池板)、尾根に沿ったセンサー柱の列。
// 誇張: レーダードーム直径 3 倍(約 11 → 33 m)、無人監視ポストの塔 2 倍、センサー柱 3 倍。地形と平面の配置は実寸。
// 省略: 山腹のスキー場(実物は数 km 下のイスラエル側の斜面で、この切り取りの外)、車両・人・柵。
// 状態: "winter"(冠雪、既定)/ "summer"(雪なし)。雪は別のマテリアルの色だけを替える。
(function () {
  const K = 0.15;
  const D = { x0: -550, x1: 550, z0: -420, z1: 420, base: -15, top: 214, S: [20, -10], flatY: 212, snowLine: 40 };

  function hermon(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.snow = M.lambert(0xf6f8fa); M.slope = M.lambert(0xe6eaee);   // 雪の上面(高い所)と低い斜面。季節で色を替える
    M.contour = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.16 });
    const group = new THREE.Group(); group.name = "hermon";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, tube, lattice, arcLoft } = k;
    const addR = U.adder(THREE, M.edge, 8);   // ジオデシックの覆い(面の継ぎ目を線で見せる)

    // ── 地形: 北東-南西に延びる山塊、尾根のうねり、副峰。山頂の拠点のまわりは平らに均す ──
    const A = 0.52, ca = Math.cos(A), sa = Math.sin(A);
    const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const raw = (x, z) => {
      const u = x * ca + z * sa, v = -x * sa + z * ca;
      let h = D.top * Math.exp(-1.3 * ((u / 520) ** 2 + (v / 330) ** 2));
      h += 16 * Math.sin(u / 85 + 1.3) * Math.cos(v / 105) * (h / D.top);
      h += 9 * Math.sin(x / 47 + z / 61) * (h / D.top);
      h += 38 * Math.exp(-(((x + 300) / 130) ** 2 + ((z - 170) / 120) ** 2));
      return Math.max(6, h);
    };
    const h0 = (x, z) => { const d = Math.hypot(x - D.S[0], z - D.S[1]), t = smooth(85, 150, d); return D.flatY * (1 - t) + raw(x, z) * t; };
    // 構造物の下の造成面(実物と同じく斜面を平らに切り盛りして据える): [x, z, 半径]
    const FLATS = [[-208, -119, 22], [226, 129, 22], [-300, 170, 22], [-85, 35, 26], [-400, -60, 8], [-260, 330, 8], [330, 180, 8], [410, -260, 8], [120, -340, 8]].map(([x, z, r]) => [x, z, r, h0(x, z)]);
    const hAt = (x, z) => { let h = h0(x, z); for (const [fx, fz, r, y] of FLATS) { const t = smooth(r, r * 1.9, Math.hypot(x - fx, z - fz)); h = y * (1 - t) + h * t; } return h; };
    const T = terrain(THREE, k, M, world, { x0: D.x0, x1: D.x1, z0: D.z0, z1: D.z1, nx: 55, nz: 42, h: hAt, base: D.base, top: M.slope, snowAt: (y) => y > D.snowLine, snowMat: M.snow, contour: 20, contourMat: M.contour });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2);
    const { pad, pads } = padder(k, M, world, hAt);

    // ── 山頂の観測拠点 ──
    const [sx, sz] = D.S, Y = D.flatY;
    add(arcLoft([[66, Y - 2], [82, Y - 2], [77, Y + 7], [71, Y + 7]], 0.16, Math.PI * 2 - 0.02, 40), M.land, world, { x: sx, z: sz });   // 土の堤(出入口の切れ目つき)
    add(cyl(68, 0.4, 40), M.light, world, { x: sx, y: Y + 0.2, z: sz, edges: false });   // 均した広場
    const radome = (x, y, z, accent) => {   // 台座の円筒、継ぎ目の帯、ジオデシックの覆い(実物の 3 倍)
      add(cyl(11, 9, 20), M.light, world, { x, y: y + 4.5, z });
      add(cyl(11.4, 1.2, 20), accent ? M.accent : M.dark, world, { x, y: y + 8.4, z, edges: false });
      addR(new THREE.IcosahedronGeometry(16.5, 2), M.body, world, { x, y: y + 9 + 12.3, z });
    };
    for (const [x, z] of [[-28, -26], [30, -8], [0, 30]]) radome(sx + x, Y, sz + z, false);
    const hall = (x, z, w, d, h, ry = 0) => {   // 観測棟(コンクリート、細い窓の帯、屋上の手すり壁と機器)
      const g = new THREE.Group(); g.position.set(x, Y, z); g.rotation.y = ry; world.add(g);
      add(box(w, h, d), M.body, g, { y: h / 2 });
      add(box(w + 0.2, 1.0, d + 0.2), M.glass, g, { y: h - 2.6, edges: false });
      add(box(w + 0.6, 0.8, d + 0.6), M.light, g, { y: h + 0.4 });
      add(box(4, 2, 3), M.mid, g, { x: w / 4, y: h + 1.8, z: 0 });
      add(box(2.4, 2.6, 0.4), M.dark, g, { x: -w / 4, y: 1.3, z: d / 2 + 0.2, edges: false });
    };
    hall(sx - 40, sz + 18, 22, 12, 8, 0.1); hall(sx + 20, sz - 48, 24, 10, 7, -0.05); hall(sx + 42, sz + 32, 18, 10, 6, 0.3);
    lattice(world, V(sx + 45, Y, sz - 40), 45, 3, 1, 5, 0.35, M.mid);
    lattice(world, V(sx - 50, Y, sz - 8), 38, 2.6, 0.9, 4, 0.3, M.mid);
    for (const [x, z, y] of [[45, -40, 46], [-50, -8, 39]]) add(box(3.2, 2.6, 1.6), M.light, world, { x: sx + x, y: Y + y, z: sz + z });
    add(cyl(10, 0.5, 24), M.mid, world, { x: sx - 32, y: Y + 0.5, z: sz + 40 });   // ヘリパッド
    add(new THREE.RingGeometry(6.5, 8, 24).rotateX(-Math.PI / 2), M.dark, world, { x: sx - 32, y: Y + 0.8, z: sz + 40, edges: false });
    // 山頂の古代神殿跡(低い石壁と柱の基部)
    {
      const tx = sx - 105, tz = sz + 45, ty = pad(tx, tz, 36, 22, 0.35, M.mid);
      const g = new THREE.Group(); g.position.set(tx, ty, tz); g.rotation.y = 0.35; world.add(g);
      for (const [x, z, w, d] of [[0, -10, 32, 1.6], [0, 10, 32, 1.6], [-16, 0, 1.6, 21.6], [16, 0, 1.6, 21.6], [-6, 0, 1.4, 18]]) add(box(w, 2.6, d), M.light, g, { x, y: 1.3, z });
      for (let i = 0; i < 5; i++) add(cyl(0.9, 1.6 + (i % 2), 8), M.light, g, { x: -12 + i * 6, y: 1, z: -14 });
    }
    // 取り付け道路(九十九折りで堤の出入口へ)
    add(ribbon(THREE, [[-545, 300], [-430, 250], [-300, 285], [-205, 205], [-265, 150], [-150, 112], [-70, 128], [5, 98], [sx + 6, sz + 76]], 7, hAt, 0.8), M.mid, world, { edges: false });

    // ── 近未来化: 増設のレーダードーム、無人監視ポスト、センサー柱 ──
    for (const [x, z] of [[-208, -119], [226, 129], [-300, 170]]) radome(x, pad(x, z, 26, 26, 0, M.light), z, true);
    const post = (x, z) => {   // 格子塔(実物 14 m を 2 倍)、電子光学の頭、太陽電池板、蓄電池箱
      const y = pad(x, z, 9, 9, 0, M.light);
      lattice(world, V(x, y, z), 28, 1.8, 0.7, 4, 0.22, M.mid);
      add(box(3.2, 2.4, 3.2), M.dark, world, { x, y: y + 29.2, z });
      add(box(2.2, 1.0, 0.2), M.glass, world, { x, y: y + 29.4, z: z + 1.7, edges: false });
      add(box(6, 0.3, 3.6), M.dark, world, { x: x + 3.8, y: y + 2.4, z, rz: 0.5 });
      add(box(2, 1.6, 1.4), M.light, world, { x: x - 2.6, y: y + 0.8, z });
    };
    for (const [x, z] of [[-400, -60], [-260, 330], [330, 180], [410, -260], [120, -340]]) post(x, z);
    for (let i = 0; i < 13; i++) {   // 尾根に沿ったセンサー柱(実物 4 m を 3 倍)
      const u = -450 + i * 75, v = (i % 2 ? 24 : -24) + 10 * Math.sin(i);
      const x = u * ca - v * sa, z = u * sa + v * ca;
      if (Math.hypot(x - sx, z - sz) < 95) continue;   // 拠点の中は省く
      const y = hAt(x, z) - 1;
      add(cyl(0.8, 13, 8), M.mid, world, { x, y: y + 6.5, z });
      add(box(1.8, 1.4, 1.8), M.dark, world, { x, y: y + 13.5, z });
      add(box(2.6, 0.2, 1.6), M.light, world, { x, y: y + 14.4, z, rz: 0.4 });
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 105, M.ring, M.disc);
    let state = "winter";
    const SEASON = { winter: [0xf6f8fa, 0xe6eaee], summer: [0xd3cec5, 0xd3cec5] };   // 夏は岩肌の灰褐色
    function setState(s) { state = s; M.snow.color.set(SEASON[s][0]); M.slope.color.set(SEASON[s][1]); }
    U.bake(THREE, group, { live: [M.accent, M.snow, M.slope], also: [] });
    return {
      group, setState, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      get state() { return state; },
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      check: () => ({ padMax_m: +pads.max.toFixed(1), pads: pads.list, terrainTris: T.tris, contourSegs: T.segs, summitFlatY: D.flatY }),   // 斜面に置いた物の基礎の最大の高さ(浮きは基礎で埋める)
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        summit: { label: "山頂の拠点", target: [20, 215, -10], pos: [200, 330, 230] },
        dome: { label: "レーダードーム", target: [0, 225, 0], pos: [70, 250, 110] },
        post: { label: "無人監視ポスト", target: [330, 120, 180], pos: [420, 190, 300] },
      },
    };
  }

  // ── このファイルの部品(地形の塊・帯・基礎) ──
  // 地形の塊: 高さ h(x, z) の上面(面ごとの陰影)、四方の切り口、等高線。snowAt(三角形の平均の高さ) が真の面は snowMat のメッシュへ
  function terrain(THREE, k, M, parent, { x0, x1, z0, z1, nx, nz, h, base, top, snowAt = null, snowMat = null, contour = 0, contourMat = null }) {
    const pos = [], posS = [], seg = [];
    const P = (i, j) => { const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz; return [x, h(x, z), z]; };
    const tri = (a, b, c) => {
      const arr = snowAt && snowAt((a[1] + b[1] + c[1]) / 3) ? posS : pos;
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (ny < 0) arr.push(...a, ...c, ...b); else arr.push(...a, ...b, ...c);
      if (!contour) return;
      const lo = Math.min(a[1], b[1], c[1]), hi = Math.max(a[1], b[1], c[1]);
      for (let L = Math.ceil(lo / contour) * contour + 0.001; L < hi; L += contour) {
        const pts = [];
        for (const [p, q] of [[a, b], [b, c], [c, a]]) if ((p[1] - L) * (q[1] - L) < 0) { const t = (L - p[1]) / (q[1] - p[1]); pts.push(p[0] + (q[0] - p[0]) * t, L + 0.4, p[2] + (q[2] - p[2]) * t); }
        if (pts.length === 6) seg.push(...pts);
      }
    };
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);
      if ((i + j) % 2) { tri(p00, p10, p11); tri(p00, p11, p01); } else { tri(p00, p10, p01); tri(p10, p11, p01); }
    }
    const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
    k.add(geo(pos), top, parent, { edges: false });
    if (posS.length) k.add(geo(posS), snowMat, parent, { edges: false });
    // 切り口(四方の側面)。外向きにそろえる
    const sk = [], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const edgePts = [[...Array(nx + 1)].map((_, i) => P(i, 0)), [...Array(nz + 1)].map((_, j) => P(nx, j)), [...Array(nx + 1)].map((_, i) => P(nx - i, nz)), [...Array(nz + 1)].map((_, j) => P(0, nz - j))];
    const outTri = (p, q, r) => {   // 水平方向で台座の中心から外向きにそろえる
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      const nx_ = uy * vz - uz * vy, nz_ = ux * vy - uy * vx, mx = (p[0] + q[0] + r[0]) / 3 - cx, mz = (p[2] + q[2] + r[2]) / 3 - cz;
      sk.push(...p, ...(nx_ * mx + nz_ * mz < 0 ? [...r, ...q] : [...q, ...r]));
    };
    for (const pts of edgePts) for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], a0 = [a[0], base, a[2]], b0 = [b[0], base, b[2]];
      outTri(a0, b0, b); outTri(a0, b, a);
    }
    k.add(geo(sk), M.mid, parent);
    if (contour && seg.length) {
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
      const ls = new THREE.LineSegments(lg, contourMat); ls.userData.edges = true; parent.add(ls);
    }
    return { tris: (pos.length + posS.length) / 9, segs: seg.length / 6 };
  }
  // 地形に沿う帯(道路)。pts = [[x, z], ...]、幅 w、地形の高さ + lift
  function ribbon(THREE, pts, w, h, lift = 0.5, step = 8) {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
      for (let s = 0; s < n; s++) P.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]);
    }
    P.push(pts[pts.length - 1]);
    const L = [], R = [];
    for (let i = 0; i < P.length; i++) {
      const [px, pz] = P[Math.max(0, i - 1)], [qx, qz] = P[Math.min(P.length - 1, i + 1)], dl = Math.hypot(qx - px, qz - pz) || 1;
      const nx = -(qz - pz) / dl, nz = (qx - px) / dl, [x, z] = P[i];
      L.push([x + (nx * w) / 2, 0, z + (nz * w) / 2]); R.push([x - (nx * w) / 2, 0, z - (nz * w) / 2]);
      L[i][1] = h(L[i][0], L[i][2]) + lift; R[i][1] = h(R[i][0], R[i][2]) + lift;
    }
    const pos = [];
    const up = (a, b, c) => { const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); if (ny < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c); };
    for (let i = 0; i < P.length - 1; i++) { up(L[i], R[i], R[i + 1]); up(L[i], R[i + 1], L[i + 1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  // 斜面に置く物の基礎: 四隅と中心の地形の高さを測り、最も高い所を上面にした基礎の塊を置く(浮かない)。返り値 = 上面の高さ
  function padder(k, M, parent, h) {
    const pads = { max: 0 };
    const pad = (x, z, w, d, ry = 0, mat = M.light) => {
      const c = Math.cos(ry), s = Math.sin(ry), ys = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].map(([a, b]) => h(x + (a * w * c) / 2 + (b * d * s) / 2, z - (a * w * s) / 2 + (b * d * c) / 2));
      const top = Math.max(...ys) + 0.3, bot = Math.min(...ys) - 1.5;
      k.add(k.box(w, top - bot, d), mat, parent, { x, y: (top + bot) / 2, z, ry });
      pads.max = Math.max(pads.max, top - Math.min(...ys)); (pads.list ??= []).push([Math.round(x), Math.round(z), +(top - Math.min(...ys)).toFixed(1)]);
      return top;
    };
    return { pad, pads };
  }

  DreamAssets.fac.register("hermon", {
    section: 7, title: "ヘルモン山", kind: "STRATEGIC FACILITY · 7 高地",
    desc: "標高約 2,800 m の国境の山。冠雪した山頂にレーダードームと観測拠点。尾根にドームを増設し、山腹に無人監視ポストとセンサー柱を並べた「機械が見張る高地」の近未来版",
    info: [["ファイル", "mockups/3d/facilities/hermon.js"], ["大きさ", "山頂部 1,100 × 840 m(標高 2,600 m で切る)を 0.15 倍 × 表示 3.0"], ["誇張", "レーダードーム直径 3 倍、無人監視ポスト 2 倍、センサー柱 3 倍。地形は実寸"], ["省略", "スキー場(切り取りの外)、車両・人・柵"], ["状態", "冬(冠雪)/ 夏"], ["近未来化", "ドーム 3 基増設、無人監視ポスト 5、センサー柱の列"]],
    dist: 1050, target: 40, tokenAt: [400, 0, 330],
    make: (THREE) => hermon(THREE, { r: 105 }),
    actLabel: "SEASON · 季節", progress: false,
    actions: (a) => [["冬(冠雪)", () => a.setState("winter"), () => a.state === "winter"], ["夏", () => a.setState("summer"), () => a.state === "summer"]],
    caption: () => "",
    ringParts: (a) => [a.parts.ring, a.parts.disc],
  });
})();
