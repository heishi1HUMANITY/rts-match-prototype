// 戦略施設トークン「バストーニュ」(ベルギー)の詳細版モデル(試作)。施設リスト 8 章(歴史的施設の現在の姿)なので近未来化はしない。
// 町の中心(マカリフ広場)から 7 本の道路が放射状に出る交通の要所と、東の丘(マルダソン)の星形の記念碑を、2,300 × 1,240 m の切り取りに実寸の比率で置く。
// 町: 道路に沿った家並み(連なった棟のまとまり)、中心の広場、聖ピエール教会(塔と尖塔)。丘: 五芒星の平面の記念碑(外周の壁と柱型、中の吹き抜け、屋上の縁)、
//   まわりの円い広場、隣の戦争博物館(現代の建物)と駐車場。なだらかなアルデンヌの台地(起伏 20 m 程度)。
// 誇張: 記念碑 3 倍(平面・高さとも。実物 幅 約 40 m・高さ 12 m → 120 m・36 m)、教会の塔 1.5 倍。家は 1 軒ずつではなく棟の連なりで表す。
// 省略: 広場の戦車・記念の像・旗竿、町の中の木、人・車両。森は樹冠の塊で表す。
(function () {
  const K = 0.083;
  const D = { x0: -1150, x1: 1150, z0: -620, z1: 620, base: -12, C: [-540, 140], Mm: [780, -210] };

  function bastogne(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.contour = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.14 });
    M.roof = M.lambert(0xd5d9de);
    const group = new THREE.Group(); group.name = "bastogne";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, prism } = k;
    const rnd = U.rng(1944);

    // ── 地形: なだらかな台地と東の丘。町の中心と記念碑のまわりは平らに ──
    const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const raw = (x, z) => 10 + 6 * Math.sin(x / 260 + 0.6) * Math.cos(z / 210) + 4 * Math.sin(x / 120 - z / 170) + 16 * Math.exp(-(((x - D.Mm[0]) / 300) ** 2 + ((z - D.Mm[1]) / 260) ** 2));
    const FLATS = [[D.C[0], D.C[1], 120], [D.Mm[0], D.Mm[1], 120], [D.Mm[0] - 230, D.Mm[1] + 150, 70]].map(([x, z, r]) => [x, z, r, raw(x, z)]);
    const hAt = (x, z) => { let h = raw(x, z); for (const [fx, fz, r, y] of FLATS) { const t = smooth(r, r * 1.8, Math.hypot(x - fx, z - fz)); h = y * (1 - t) + h * t; } return h; };
    const T = terrain(THREE, k, M, world, { x0: D.x0, x1: D.x1, z0: D.z0, z1: D.z1, nx: 92, nz: 50, h: hAt, base: D.base, top: M.land, contour: 4, contourMat: M.contour });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2);
    const { pad, pads } = padder(k, M, world, hAt);

    // ── 放射状の道路(方位: 北 = -z。町の中心から 7 本、台座の縁まで) ──
    const [cx, cz] = D.C;
    const BEAR = [[0, "N30 ウッファリーズ"], [42, "ノヴィル"], [78, "N84 ヴィルツ"], [140, "N4 アルロン"], [195, "N85"], [245, "N4 マルシュ"], [310, "シャン"]];
    const toEdge = (deg) => {   // 中心から方位 deg に進んで台座の縁に当たる点
      const dx = Math.sin((deg * Math.PI) / 180), dz = -Math.cos((deg * Math.PI) / 180);
      const t = Math.min(dx > 0 ? (D.x1 - 4 - cx) / dx : dx < 0 ? (D.x0 + 4 - cx) / dx : Infinity, dz > 0 ? (D.z1 - 4 - cz) / dz : dz < 0 ? (D.z0 + 4 - cz) / dz : Infinity);
      return [cx + dx * t, cz + dz * t, dx, dz, t];
    };
    const roads = BEAR.map(([deg]) => toEdge(deg));
    for (const [ex, ez, dx, dz] of roads) {   // 少し曲げて(実物の道は真っ直ぐではない)地形に沿わせる
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8, wob = Math.sin(t * Math.PI) * 30 * (rnd() - 0.5); pts.push([cx + (ex - cx) * t - dz * wob, cz + (ez - cz) * t + dx * wob]); }
      add(ribbon(THREE, pts, 11, hAt, 0.5), M.mid, world, { edges: false });
    }
    // 記念碑への取り付け道路(ヴィルツの道から分かれて丘を上る)
    const br = [cx + roads[2][2] * 1050, cz + roads[2][3] * 1050];
    add(ribbon(THREE, [br, [D.Mm[0] - 160, D.Mm[1] + 40], [D.Mm[0] - 110, D.Mm[1]]], 8, hAt, 0.5), M.mid, world, { edges: false });

    // ── 町: 道路沿いの家並み(棟の連なり)、中心の広場、教会 ──
    const cy = FLATS[0][3];
    add(box(90, 0.5, 64), M.light, world, { x: cx, y: cy + 0.3, z: cz, ry: 0.2, edges: false });   // マカリフ広場
    const row = (x, z, ry, len, dep, h) => { const y = pad(x, z, len, dep, ry, M.light); add(box(len, h, dep), M.body, world, { x, y: y + h / 2, z, ry }); add(gableG(len, dep, dep * 0.45), M.roof, world, { x, y: y + h, z, ry }); };
    const gableG = (len, w, h) => { const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]); const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); g.rotateY(Math.PI / 2); return g; };
    let rows = 0;
    const KEEP = [[cx, cz, 60], [cx + 70, cz - 95, 42]];   // 広場と教会のまわりは空ける
    const placed = [];   // 置いた棟の軸 [x1, z1, x2, z2, 奥行き]
    const segD = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
    const clear = (x, z, ry, len, dep) => {   // 棟の軸の上の点が、ほかの道路の中心線・置いた棟・広場から離れているか
      const ex = Math.cos(ry) * len / 2, ez = -Math.sin(ry) * len / 2;
      const P = [-1, -0.5, 0, 0.5, 1].map((t) => [x + ex * t, z + ez * t]);
      if (!P.every(([px, pz]) => placed.every(([ax, az, bx, bz, d]) => segD(px, pz, ax, az, bx, bz) > (d + dep) / 2 + 3))) return false;
      const ok = P.every(([px, pz]) => roads.every(([, , dx, dz, t]) => { const u = Math.max(0, Math.min(t, (px - cx) * dx + (pz - cz) * dz)); return Math.hypot(px - cx - dx * u, pz - cz - dz * u) > dep / 2 + 8; }) && KEEP.every(([kx, kz, kr]) => Math.hypot(px - kx, pz - kz) > kr));
      if (ok) placed.push([x + ex, z + ez, x - ex, z - ez, dep]);
      return ok;
    };
    for (const [, , dx, dz] of roads) {
      const ry = Math.atan2(-dz, dx);   // 棟の長手を道路の向きに
      for (let r = 70; r < 520; r += 0) {
        const len = 30 + rnd() * 36, gap = 4 + rnd() * 8, mid = r + len / 2;
        if (mid > 500) break;
        for (const s of [-1, 1]) {
          if (rnd() < 0.12) continue;   // 空き地
          const off = 14 + rnd() * 4, x = cx + dx * mid - dz * s * off, z = cz + dz * mid + dx * s * off;
          const dep = 11 + rnd() * 3;
          if (clear(x, z, ry, len, dep)) { row(x, z, ry, len, dep, 8 + rnd() * 5); rows++; }
          for (let b = 1; b <= (mid < 260 ? 2 : 1); b++) if (mid < 380 && rnd() < 0.85) {   // 裏の通りの棟
            const off2 = off + b * (30 + rnd() * 8), x2 = cx + dx * mid - dz * s * off2, z2 = cz + dz * mid + dx * s * off2;
            if (clear(x2, z2, ry, len * 0.8, 12)) { row(x2, z2, ry, len * 0.8, 12, 7 + rnd() * 4); rows++; }
          }
        }
        r += len + gap;
      }
    }
    {   // 聖ピエール教会(身廊、塔、尖塔)。塔は 1.5 倍
      const x = cx + 70, z = cz - 95, y = pad(x, z, 56, 22, 0.4, M.light);
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = 0.4; world.add(g);
      add(box(50, 16, 20), M.body, g, { x: 6, y: 8 });
      add(gableG(50, 21, 9), M.roof, g, { x: 6, y: 16 });
      add(box(11, 45, 11), M.body, g, { x: -24, y: 22.5 });
      for (const s of [-1, 1]) add(box(0.4, 6, 2.6), M.glass, g, { x: -24, y: 36, z: s * 5.7, edges: false });
      add(new THREE.ConeGeometry(7.6, 22, 4), M.roof, g, { x: -24, y: 56, ry: Math.PI / 4 });
    }

    // ── マルダソンの記念碑(五芒星、3 倍)と広場、戦争博物館 ──
    const [mx, mz] = D.Mm, my = FLATS[1][3], S = 3;
    add(cyl(110, 0.5, 48), M.light, world, { x: mx, y: my + 0.25, z: mz, edges: false });   // 円い広場
    const star = (ro, ri, a0 = 0) => Array.from({ length: 10 }, (_, i) => { const a = a0 + (i * Math.PI) / 5, r = i % 2 ? ri : ro; return [Math.sin(a) * r, -Math.cos(a) * r]; });
    const ro = 20 * S, ri = 9.5 * S, H = 12 * S;
    const mon = new THREE.Group(); mon.position.set(mx, my + 0.5, mz); mon.rotation.y = -0.35; world.add(mon);
    add(prism(star(ro, ri), 0, H, [star(ro * 0.72, ri * 0.72)]), M.body, mon);                 // 外周の壁(中は吹き抜け)
    add(prism(star(ro + 1.2, ri + 0.6), H, H + 2.4, [star(ro * 0.72 - 1, ri * 0.72 - 0.5)]), M.light, mon);   // 屋上の縁(歩廊)
    add(prism(star(ro + 3, ri + 1.5), -0.5, 1.2, [star(ro * 0.72 - 1, ri * 0.72 - 0.5)]), M.light, mon);   // 基壇
    const SP = star(ro, ri);
    for (let i = 0; i < 10; i++) {   // 外の面の柱型(各辺 3 本)
      const [ax, az] = SP[i], [bx, bz] = SP[(i + 1) % 10], ang = Math.atan2(bz - az, bx - ax), nx = Math.sin(ang), nz = -Math.cos(ang);
      for (const t of [0.25, 0.5, 0.75]) add(box(2.2, H - 2, 1.4), M.light, mon, { x: ax + (bx - ax) * t - nx * 0.6, y: (H - 2) / 2 + 1.2, z: az + (bz - az) * t - nz * 0.6, ry: -ang });
    }
    add(cyl(7, 2.5, 5), M.mid, mon, { y: 1.25 });   // 吹き抜けの中央(地下の礼拝室への入口の台)
    add(box(6, 4, 0.8), M.dark, mon, { y: 2, z: 5.2, edges: false });
    for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5; add(box(3, 1.2, 9), M.light, mon, { x: Math.sin(a) * (ro + 6), y: 0.6, z: -Math.cos(a) * (ro + 6), ry: -a }); }   // 先端の前の踏み段
    {   // 戦争博物館(現代の平屋。角ばった平面)と駐車場
      const bx = mx - 230, bz = mz + 150, by = FLATS[2][3];
      add(prism([[-50, -22], [40, -34], [60, 6], [24, 30], [-44, 24]], by, by + 11), M.body, world, { x: bx, z: bz });
      add(prism([[-51, -23], [41, -35], [61, 6], [25, 31], [-45, 25]], by + 3, by + 6), M.glass, world, { x: bx, z: bz, edges: false });
      add(prism([[-52, -24], [42, -36], [62, 6], [25, 32], [-46, 26]], by + 11, by + 12), M.light, world, { x: bx, z: bz });
      add(box(70, 0.4, 36), M.mid, world, { x: bx - 10, y: by + 0.2, z: bz + 60, edges: false });
    }

    // ── 森(東のジャックの森など、町の外のまとまった林。樹冠の塊、InstancedMesh 1 つ) ──
    M.tree = M.lambert(0xb2beaf);
    const nearRoad = (x, z) => roads.some(([ex, ez]) => segD(x, z, cx, cz, ex, ez) < 22) || segD(x, z, br[0], br[1], D.Mm[0] - 110, D.Mm[1]) < 22;
    const trees = [], woods = [[300, 200, 170], [520, 330, 140], [-150, -420, 160], [100, -470, 120], [950, 350, 150], [-950, -350, 140], [-900, 420, 120], [420, -470, 130]];
    for (let n = 0; trees.length < 1400 && n < 30000; n++) {
      const [wx, wz, wr] = woods[n % woods.length], a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * wr, x = wx + Math.cos(a) * d, z = wz + Math.sin(a) * d * 0.7;
      if (x < D.x0 + 10 || x > D.x1 - 10 || z < D.z0 + 10 || z > D.z1 - 10 || nearRoad(x, z) || Math.hypot(x - cx, z - cz) < 560 || Math.hypot(x - D.Mm[0], z - D.Mm[1]) < 330) continue;
      trees.push([x, z, 6 + rnd() * 3, 6 + rnd() * 3]);
    }
    const inst = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.tree, trees.length), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), eu = new THREE.Euler();
    trees.forEach(([x, z, r, h], i) => { mt.compose(V(x, hAt(x, z) + h * 0.55, z), q.setFromEuler(eu.set(0, rnd() * 6, 0)), V(r, h, r)); inst.setMatrixAt(i, mt); });
    world.add(inst);

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 108, M.ring, M.disc);
    U.bake(THREE, group, { live: [M.accent] });
    return {
      group, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      check: () => ({ padMax_m: +pads.max.toFixed(1), townRows: rows, trees: trees.length, roads: roads.length, memorialSpan_m: 2 * ro, centerToMemorial_m: Math.round(Math.hypot(mx - cx, mz - cz)) }),
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        memorial: { label: "マルダソンの記念碑", target: [780, 30, -210], pos: [950, 190, 40] },
        town: { label: "町の中心と放射状の道路", target: [-540, 20, 140], pos: [-220, 380, 560] },
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

  DreamAssets.fac.register("bastogne", {
    section: 8, title: "バストーニュ", kind: "STRATEGIC FACILITY · 8 歴史的施設",
    desc: "7 本の道路が放射状に集まる町と、郊外の丘に立つ星形のマルダソン記念碑。現在の姿をそのまま模型にした(近未来化なし)",
    info: [["ファイル", "mockups/3d/facilities/bastogne.js"], ["大きさ", "2,300 × 1,240 m を 0.083 倍 × 表示 3.0"], ["誇張", "記念碑 3 倍(平面・高さとも)、教会の塔 1.5 倍。家は棟の連なり"], ["省略", "広場の戦車・像・旗竿、町の中の木、人・車両。森は樹冠の塊"], ["構成", "地形の塊(等高線)+ 押し出し(星形・博物館)+ Box"]],
    dist: 1100, target: 20, tokenAt: [420, 0, 340],
    make: (THREE) => bastogne(THREE, { r: 108 }),
  });
})();
