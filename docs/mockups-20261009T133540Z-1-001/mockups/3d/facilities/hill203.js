// 戦略施設トークン「二〇三高地」(中国・旅順)の詳細版モデル(試作)。施設リスト 8 章(歴史的施設の現在の姿)なので近未来化はしない。
// 丘(900 × 700 m を標高 60 m で切った地形の塊、起伏 約 143 m)を実寸の比率で組む。西の頂(203 m)と東の頂、間の鞍部。今は斜面が林に覆われている。
// 西の頂: 砲弾形の記念塔(爾霊山の碑)と石段の台座、頂の広場、展望台。登り道と石段、麓の駐車場と休憩所、北斜面に残る塹壕の跡。
// 誇張: 記念塔と台座 5.5 倍(実物 約 10 m → 約 55 m)。林は 1 本ずつではなく樹冠の塊(直径 14〜24 m)で表す。地形と平面の配置は実寸。
// 省略: 頂に展示された砲・説明板・手すり、人・車両。慰霊の場所なので、演出や動きは付けない。
(function () {
  const K = 0.19;
  const D = { x0: -450, x1: 450, z0: -350, z1: 350, base: -12, W: [-80, -20], plazaY: 143 };

  function hill203(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.contour = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.16 });
    M.tree = M.lambert(0xb2beaf);
    const group = new THREE.Group(); group.name = "hill203";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V } = k;
    const rnd = U.rng(203);

    // ── 地形: 西の頂(203 m)と東の頂、鞍部。頂の広場と麓の駐車場は平らに均す ──
    const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const raw = (x, z) => {
      const w = 143 * Math.exp(-(((x + 80) / 175) ** 2 + ((z + 20) / 150) ** 2));
      const e = 122 * Math.exp(-(((x - 120) / 150) ** 2 + ((z - 35) / 135) ** 2));
      const ridge = 70 * Math.exp(-((z / 230) ** 2)) * Math.exp(-((x / 420) ** 4));
      const m = Math.max(w, e, ridge) + 0.12 * Math.min(w, e);
      return Math.max(4, m + 4 * Math.sin(x / 37 + z / 53) * Math.min(1, m / 60));
    };
    const FLATS = [[D.W[0], D.W[1], 32, D.plazaY], [-55, -62, 10, null], [300, 255, 40, null]].map(([x, z, r, y]) => [x, z, r, y ?? raw(x, z)]);
    const hAt = (x, z) => { let h = raw(x, z); for (const [fx, fz, r, y] of FLATS) { const t = smooth(r, r * 1.8, Math.hypot(x - fx, z - fz)); h = y * (1 - t) + h * t; } return h; };
    const T = terrain(THREE, k, M, world, { x0: D.x0, x1: D.x1, z0: D.z0, z1: D.z1, nx: 54, nz: 42, h: hAt, base: D.base, top: M.land, contour: 10, contourMat: M.contour });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2);
    const { pad, pads } = padder(k, M, world, hAt);

    // ── 西の頂: 広場、石段の台座、砲弾形の記念塔(4 倍) ──
    const [wx, wz] = D.W, Y = D.plazaY;
    add(cyl(31, 0.6, 36), M.light, world, { x: wx, y: Y + 0.3, z: wz });
    const mon = new THREE.Group(); mon.position.set(wx, Y + 0.6, wz); mon.rotation.y = 0.3; mon.scale.setScalar(1.375); world.add(mon);   // 4 倍で組んだ寸法をさらに 1.375 倍(計 5.5 倍)
    for (const [w, h, y] of [[17, 2.4, 1.2], [12.8, 2.4, 3.6], [8.6, 4.0, 6.8]]) add(box(w, h, w), M.light, mon, { y });
    for (let i = 0; i < 3; i++) add(box(5, 0.8 * (i + 1), 1.2), M.mid, mon, { y: 0.4 * (i + 1), z: 8.5 + 1.2 * (2 - i) + 0.6 });   // 正面の石段
    // 塔: 薬莢の縁(帯)→ 胴 → 尖頭(砲弾の形)。旋盤の断面
    const prof = [[0, 0], [3.9, 0], [3.9, 1.6], [3.3, 1.6], [3.3, 22], [3.1, 24.5], [2.7, 26.6], [2.0, 28.5], [1.1, 30.1], [0.3, 31.0], [0, 31.2]].map(([r, y]) => new THREE.Vector2(r, y));
    add(new THREE.LatheGeometry(prof, 20), M.body, mon, { y: 8.8 });
    add(box(4.6, 7, 0.5), M.dark, mon, { y: 15, z: 3.3, edges: false });   // 正面の銘板(爾霊山)
    // 展望台(頂の東南、石の床と低い壁)
    {
      const y = pad(-55, -62, 18, 12, 0.5, M.light);
      for (const [x, z, w, d] of [[0, -6, 18, 0.6], [-9, 0, 0.6, 12], [9, 0, 0.6, 12]]) add(box(w, 1.2, d), M.mid, world, { x: -55 + x, y: y + 0.6, z: -62 + z, ry: 0.5 });
    }
    // ── 登り道と石段、麓の駐車場と休憩所 ──
    const path = [[440, 300], [330, 262], [250, 230], [180, 205], [120, 150], [150, 95], [95, 62], [30, 75], [-20, 40], [-45, 18], [wx + 16, wz + 18]];
    add(ribbon(THREE, path, 5, hAt, 0.5), M.mid, world, { edges: false });
    {
      const y = pad(300, 255, 70, 34, -0.2, M.mid);
      add(box(30, 6, 12), M.body, world, { x: 312, y: y + 3, z: 232, ry: -0.2 });
      add(box(30.4, 1.2, 12.4), M.glass, world, { x: 312, y: y + 3.4, z: 232, ry: -0.2, edges: false });
      add(box(32, 0.6, 14), M.light, world, { x: 312, y: y + 6.3, z: 232, ry: -0.2 });
    }
    // 北斜面の塹壕の跡(ジグザグの暗い溝)
    add(ribbon(THREE, [[-190, -95], [-160, -120], [-130, -100], [-100, -128], [-70, -108], [-40, -134], [-10, -112], [20, -132]], 3, hAt, 0.15), M.dark, world, { edges: false });

    // ── 林: 樹冠の塊(InstancedMesh 1 つ)。頂の広場・道・駐車場は避ける ──
    const near = (x, z) => path.some(([px, pz], i) => i < path.length - 1 && segDist(x, z, px, pz, path[i + 1][0], path[i + 1][1]) < 14);
    const trees = [], centers = [];
    for (let i = 0; i < 46; i++) centers.push([D.x0 + 40 + rnd() * (D.x1 - D.x0 - 80), D.z0 + 40 + rnd() * (D.z1 - D.z0 - 80), 40 + rnd() * 70]);
    for (let n = 0; trees.length < 900 && n < 20000; n++) {   // 林の塊の中心のまわりに密に置く
      const [cx, cz, cr] = centers[n % centers.length], a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * cr, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (x < D.x0 + 12 || x > D.x1 - 12 || z < D.z0 + 12 || z > D.z1 - 12) continue;
      if (Math.hypot(x - wx, z - wz) < 52 || Math.hypot(x - 300, z - 255) < 70 || Math.hypot(x + 55, z + 62) < 25 || near(x, z)) continue;
      if (z < -85 && z > -145 && x > -200 && x < 30) continue;   // 塹壕の跡のまわり
      trees.push([x, z, 6 + rnd() * 4, 4 + rnd() * 2.5]);
    }
    const treeG = new THREE.IcosahedronGeometry(1, 0), inst = new THREE.InstancedMesh(treeG, M.tree, trees.length), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    trees.forEach(([x, z, r, h], i) => { mt.compose(V(x, hAt(x, z) + h * 0.55, z), q.setFromEuler(e.set(0, rnd() * 6, 0)), V(r, h, r)); inst.setMatrixAt(i, mt); });
    world.add(inst);

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 105, M.ring, M.disc);
    U.bake(THREE, group, { live: [M.accent] });
    return {
      group, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      check: () => ({ padMax_m: +pads.max.toFixed(1), pads: pads.list, trees: trees.length, terrainTris: T.tris, monumentTop_m: +(Y + 0.6 + (8.8 + 31.2) * 1.375).toFixed(1) }),
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        monument: { label: "記念塔", target: [-80, 170, -20], pos: [10, 215, 80] },
        summit: { label: "西の頂と展望台", target: [-70, 145, -30], pos: [120, 230, -200] },
        foot: { label: "麓から見上げる", target: [-40, 120, 0], pos: [380, 60, 330] },
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

  DreamAssets.fac.register("hill203", {
    section: 8, title: "二〇三高地", kind: "STRATEGIC FACILITY · 8 歴史的施設",
    desc: "旅順の丘。林に覆われた西の頂に砲弾形の記念塔(爾霊山の碑)が立つ。現在の姿をそのまま模型にした(近未来化なし)",
    info: [["ファイル", "mockups/3d/facilities/hill203.js"], ["大きさ", "900 × 700 m(標高 60 m で切る)を 0.19 倍 × 表示 3.0"], ["誇張", "記念塔と台座 5.5 倍(約 10 → 55 m)。林は樹冠の塊。地形は実寸"], ["省略", "展示の砲・説明板・手すり、人・車両"], ["構成", "地形の塊(等高線)+ 旋盤の塔 + Box"]],
    dist: 1000, target: 60, tokenAt: [380, 0, 320],
    make: (THREE) => hill203(THREE, { r: 105 }),
  });
})();
