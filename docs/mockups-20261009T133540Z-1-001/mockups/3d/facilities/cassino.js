// 戦略施設トークン「モンテ・カッシーノ」(イタリア)の詳細版モデル(試作)。施設リスト 8 章(歴史的施設の現在の姿)なので近未来化はしない。
// 山頂部(1,100 × 900 m を標高 400 m で切った地形の塊、山頂 516 m)に、戦後に再建された修道院(約 200 × 110 m)を実寸の比率で置く。
// 修道院: 斜面から立ち上がる石積みの基壇(下すぼまりの擁壁)、外周の 4 翼と中の仕切りの翼(窓の列・切妻の屋根)、入口の回廊・中央の回廊(大階段)・聖堂の両脇の回廊、
//   聖堂(身廊と切妻、交差部のドームと頂塔)。九十九折りの登り道と入口前の駐車場、北西の尾根のポーランド人戦没者墓地(段状の墓域と中央の碑)、斜面の林。
// 誇張: 修道院の建物の高さ 1.5 倍(平面は実寸)。林は樹冠の塊で表す。
// 省略: 像・説明板・墓標の 1 基ずつ、人・車両。
(function () {
  const K = 0.15;
  const D = { x0: -550, x1: 550, z0: -450, z1: 450, base: -12, Y: 116, baseY: 96, HX: 1.5 };

  function cassino(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.contour = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.16 });
    M.tree = M.lambert(0xb2beaf); M.roof = M.lambert(0xd5d9de);
    const group = new THREE.Group(); group.name = "cassino";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, closedLoft } = k;
    const rnd = U.rng(529);

    // ── 地形: 東西に延びる尾根。南(町の側)が急。北西に支尾根(墓地)。修道院の下は基壇の底まで下げる ──
    const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const raw = (x, z) => {
      let h = 118 * Math.exp(-((x / 430) ** 2) - ((z / (z > 0 ? 190 : 270)) ** 2));
      h += 34 * Math.exp(-(((x + 290) / 160) ** 2 + ((z + 255) / 140) ** 2));
      h += 5 * Math.sin(x / 41 + z / 57) + 3 * Math.cos(x / 23 - z / 31);
      return Math.max(5, h);
    };
    const ell = (x, z, rx, rz) => Math.hypot(x / rx, z / rz);
    const FLATS = [[-150, 4, 28, 104], [-285, -255, 58, null]].map(([x, z, r, y]) => [x, z, r, y ?? raw(x, z)]);
    const hAt = (x, z) => {
      let h = raw(x, z);
      const e = ell(x, z, 104, 59); h = Math.min(h, D.baseY + 2 + (h - D.baseY - 2) * smooth(1, 1.25, e));   // 修道院の基壇の下
      for (const [fx, fz, r, y] of FLATS) { const t = smooth(r, r * 1.8, Math.hypot(x - fx, z - fz)); h = y * (1 - t) + h * t; }
      return h;
    };
    const T = terrain(THREE, k, M, world, { x0: D.x0, x1: D.x1, z0: D.z0, z1: D.z1, nx: 60, nz: 50, h: hAt, base: D.base, top: M.land, contour: 10, contourMat: M.contour });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2);
    const { pad, pads } = padder(k, M, world, hAt);

    // ── 修道院 ──
    const ab = new THREE.Group(); ab.position.y = D.Y; world.add(ab);
    // 基壇: 下すぼまりの石積みの擁壁(斜面から立ち上がる)
    const rect = (hx, hz, y) => [V(-hx, y, -hz), V(hx, y, -hz), V(hx, y, hz), V(-hx, y, hz)];
    add(closedLoft([rect(108, 63, D.baseY - D.Y), rect(102, 57, 0)]), M.light, ab);
    for (const z of [-57.4, 57.4]) for (let i = 0; i < 9; i++) add(box(1.4, 14, 0.8), M.mid, ab, { x: -88 + i * 22, y: -8, z, rx: z > 0 ? -0.12 : 0.12, edges: false });   // 擁壁の控え
    const H = 18 * D.HX;   // 外周の翼の壁の高さ(4 階 18 m の 1.5 倍)
    const gable = (len, w, h, alongX) => {   // 切妻の屋根(len 方向に延びる)
      const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
      const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
      if (alongX) g.rotateY(Math.PI / 2);
      return g;
    };
    const wing = (x, z, lx, lz, h, windows = true) => {   // 翼: 壁、窓の列(外の面)、軒、切妻
      const alongX = lx >= lz, w = alongX ? lz : lx, len = alongX ? lx : lz;
      add(box(lx, h, lz), M.body, ab, { x, y: h / 2, z });
      add(box(lx + 0.8, 0.8, lz + 0.8), M.light, ab, { x, y: h - 0.4, z });
      add(gable(len, w + 1.6, w * 0.42, alongX), M.roof, ab, { x, y: h, z });
      if (!windows) return;
      const n = Math.floor(h / (4.5 * D.HX));
      for (let f = 0; f < n; f++) for (const s of [-1, 1]) {
        const y = 3.4 * D.HX + f * 4.5 * D.HX;
        for (let i = 0, m = Math.floor((len - 8) / 6); i < m; i++) {   // 1 つずつの縦長の窓(6 m おき)
          const t = -((m - 1) * 6) / 2 + i * 6;
          if (alongX) add(box(2.0, 2.4 * D.HX, 0.4), M.glass, ab, { x: x + t, y, z: z + s * (w / 2 + 0.05), edges: false });
          else add(box(0.4, 2.4 * D.HX, 2.0), M.glass, ab, { x: x + s * (w / 2 + 0.05), y, z: z + t, edges: false });
        }
      }
    };
    wing(0, 48, 200, 14, H); wing(0, -48, 200, 14, H); wing(-93, 0, 14, 82, H); wing(93, 0, 14, 82, H);   // 外周
    wing(-52, 0, 10, 82, H * 0.8, false); wing(13, 0, 10, 82, H * 0.9, false);                            // 回廊の仕切り
    wing(52, -28, 68, 12, H * 0.8, false); wing(52, 28, 68, 12, H * 0.8, false);                           // 聖堂の両脇の回廊の内側の翼
    // 入口(西の面の門)と入口の回廊・中央の回廊の舗装とアーケード
    add(box(1.2, 9, 8), M.dark, ab, { x: -100.4, y: 4.5, edges: false });
    for (const [x0, x1] of [[-86, -57], [-47, 8]]) {
      add(box(x1 - x0, 0.5, 82), M.light, ab, { x: (x0 + x1) / 2, y: 0.25, edges: false });
      for (const s of [-1, 1]) {   // 回廊のアーケード(低い片流れの棟と暗いアーチの列)
        add(box(x1 - x0, 7 * D.HX, 4), M.body, ab, { x: (x0 + x1) / 2, y: 3.5 * D.HX, z: s * 39 });
        for (let i = 0; i < Math.floor((x1 - x0) / 6); i++) add(box(3, 5 * D.HX, 0.4), M.glass, ab, { x: x0 + 3 + i * 6, y: 2.5 * D.HX, z: s * 36.9, edges: false });
      }
    }
    for (let i = 0; i < 6; i++) add(box(12, 1.2 * (i + 1), 30), M.light, ab, { x: -6 + i * 2.2 + 1.1, y: 0.6 * (i + 1), z: 0 });   // 大階段(中央の回廊から聖堂の前庭へ)
    // 聖堂: 身廊(切妻)、交差部の鼓胴とドームと頂塔
    const NH = 22 * D.HX;
    add(box(58, NH, 26), M.body, ab, { x: 50, y: NH / 2 });
    add(box(58.8, 0.9, 26.8), M.light, ab, { x: 50, y: NH - 0.45 });
    add(gable(58, 28, 11, true), M.roof, ab, { x: 50, y: NH });
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) add(box(3.2, 7 * D.HX, 0.4), M.glass, ab, { x: 28 + i * 10, y: NH - 6 * D.HX, z: s * 13.1, edges: false });
    add(box(2.0, NH + 6, 28), M.light, ab, { x: 21, y: (NH + 6) / 2 });   // 正面の破風
    add(cyl(11, 9, 20), M.body, ab, { x: 72, y: NH + 4.5 });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; add(box(0.4, 4, 2.4), M.glass, ab, { x: 72 + Math.cos(a) * 11, y: NH + 4.8, z: Math.sin(a) * 11, ry: -a, edges: false }); }
    add(new THREE.SphereGeometry(11, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.roof, ab, { x: 72, y: NH + 9 });
    add(cyl(2.2, 6, 10), M.body, ab, { x: 72, y: NH + 9 + 11 + 3 });
    add(new THREE.ConeGeometry(2.6, 3, 10), M.roof, ab, { x: 72, y: NH + 9 + 11 + 7.5 });

    // ── 九十九折りの登り道、入口前の駐車場と階段 ──
    add(ribbon(THREE, [[548, 395], [400, 330], [270, 360], [320, 268], [190, 250], [255, 185], [130, 165], [185, 115], [60, 112], [-40, 108], [-120, 70], [-170, 40], [-155, 12]], 8, hAt, 0.6), M.mid, world, { edges: false });
    add(cyl(27, 0.4, 28), M.mid, world, { x: -150, y: 104.2, z: 4, edges: false });
    for (let i = 0; i < 6; i++) add(box(3.2, 1.6 * (i + 1) + 2, 12), M.light, world, { x: -123 + i * 3.2 - 0.2, y: 104 - 1 + (1.6 * (i + 1) + 2) / 2, z: 0 });   // 門への階段

    // ── 北西の尾根: ポーランド人戦没者墓地(段状の墓域と中央の碑) ──
    {
      const [cx, cz] = [-285, -255], y = FLATS[1][3];
      const tops = [];
      for (let i = 0; i < 4; i++) tops.push(pad(cx, cz + 21 - i * 14, 84 - i * 14, 14, 0, M.light) + i * 1.4);   // 段(下の段から奥へ上がる)
      for (let i = 0; i < 4; i++) add(box(84 - i * 14, 1.4 * i + 0.01, 14), M.light, world, { x: cx, y: tops[i] - 0.7 * i, z: cz + 21 - i * 14, edges: i > 0 });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 9 - i * 1.5; j++) add(box(1.2, 1.1, 0.4), M.mid, world, { x: cx - 34 + i * 7 + j * 8.5, y: tops[i] + 0.55, z: cz + 21 - i * 14 });   // 墓標の列(1 基ずつではなく列の目印)
      const my = pad(cx, cz - 30, 14, 14, 0, M.light);
      add(box(4, 16, 4), M.body, world, { x: cx, y: my + 8, z: cz - 30 });
      add(box(10, 3, 1.6), M.body, world, { x: cx, y: my + 11.5, z: cz - 30 });
    }

    // ── 斜面の林(樹冠の塊)。修道院・道・駐車場・墓地は避ける ──
    const road = [[548, 395], [400, 330], [270, 360], [320, 268], [190, 250], [255, 185], [130, 165], [185, 115], [60, 112], [-40, 108], [-120, 70], [-170, 40], [-155, 12]];
    const near = (x, z) => road.some(([px, pz], i) => i < road.length - 1 && segDist(x, z, px, pz, road[i + 1][0], road[i + 1][1]) < 14);
    const trees = [], centers = [];
    for (let i = 0; i < 50; i++) centers.push([D.x0 + 40 + rnd() * (D.x1 - D.x0 - 80), D.z0 + 40 + rnd() * (D.z1 - D.z0 - 80), 40 + rnd() * 70]);
    for (let n = 0; trees.length < 900 && n < 20000; n++) {
      const [cx, cz, cr] = centers[n % centers.length], a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * cr, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (x < D.x0 + 12 || x > D.x1 - 12 || z < D.z0 + 12 || z > D.z1 - 12) continue;
      if (ell(x, z, 135, 90) < 1 || Math.hypot(x + 150, z - 4) < 45 || Math.hypot(x + 285, z + 255) < 80 || near(x, z)) continue;
      trees.push([x, z, 6 + rnd() * 4, 4 + rnd() * 2.5]);
    }
    const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.tree, trees.length), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler();
    trees.forEach(([x, z, r, h], i) => { mt.compose(V(x, hAt(x, z) + h * 0.55, z), q.setFromEuler(eu.set(0, rnd() * 6, 0)), V(r, h, r)); inst.setMatrixAt(i, mt); });
    world.add(inst);

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 106, M.ring, M.disc);
    U.bake(THREE, group, { live: [M.accent] });
    // 確認: 修道院の基壇の外周で、地形が基壇の上面を超えていないか(埋もれ)と、基壇の底より下がっていないか(浮き)
    const rim = () => { let over = -Infinity, under = -Infinity; for (let i = 0; i < 200; i++) { const t = (i / 200) * Math.PI * 2, x = Math.cos(t) * 108, z = Math.sin(t) * 63, h = hAt(x * Math.min(1, 108 / Math.abs(x || 1)), z); over = Math.max(over, h - D.Y); under = Math.max(under, D.baseY - h); } return { terrainAboveDeck_m: +over.toFixed(1), baseBelowTerrain_m: +(-under).toFixed(1) }; };
    return {
      group, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      check: () => ({ ...rim(), padMax_m: +pads.max.toFixed(1), trees: trees.length, terrainTris: T.tris }),
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        abbey: { label: "修道院", target: [0, 125, 0], pos: [170, 230, 240] },
        cloister: { label: "回廊と聖堂", target: [10, 125, 0], pos: [-60, 200, 70] },
        walls: { label: "南の擁壁と九十九折り", target: [40, 100, 60], pos: [260, 120, 420] },
        cemetery: { label: "ポーランド人墓地", target: [-285, 95, -255], pos: [-200, 160, -120] },
      },
    };
  }
  const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };

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

  DreamAssets.fac.register("cassino", {
    section: 8, title: "モンテ・カッシーノ", kind: "STRATEGIC FACILITY · 8 歴史的施設",
    desc: "山頂の大きな修道院。戦後に再建された姿。石積みの基壇の上に回廊を囲む翼と、ドームのある聖堂。九十九折りの登り道と北西の尾根の墓地まで含めた(近未来化なし)",
    info: [["ファイル", "mockups/3d/facilities/cassino.js"], ["大きさ", "1,100 × 900 m(標高 400 m で切る)を 0.15 倍 × 表示 3.0"], ["誇張", "修道院の建物の高さ 1.5 倍(平面は実寸)。林は樹冠の塊"], ["省略", "像・説明板・墓標の 1 基ずつ、人・車両"], ["構成", "地形の塊(等高線)+ 断面の連結(基壇)+ 押し出し(切妻)+ Box"]],
    dist: 1050, target: 70, tokenAt: [400, 0, 330],
    make: (THREE) => cassino(THREE, { r: 106 }),
  });
})();
