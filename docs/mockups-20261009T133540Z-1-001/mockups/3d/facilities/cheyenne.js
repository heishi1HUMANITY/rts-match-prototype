// 戦略施設トークン「シャイアン・マウンテン」(米コロラド州。山の中の北米防空司令部の予備の指揮所)の詳細版モデル(試作)。
// 主役はふもとの北の坑口: 山腹を切った平場、擁壁から突き出したアーチのトンネル口、すぐ内側の防爆扉。坑口のまわりの山の面を約 340 × 320 m で切り取る。
// 奥へせり上がる花崗岩の斜面の上に、山頂の放送・通信の鉄塔を脇役として置く(実物の山頂は坑口から約 2 km・標高差約 700 m。距離と高さを縮めた)。
// 象徴: 坑口と防爆扉。トンネル口と擁壁 約 5.7 倍(開口 7 → 40 m、擁壁 210 m)、防爆扉を坑口のすぐ内側に置いた(実物は数百 m 奥。外から見えるように寄せた)。
// ゲーム視点で坑口が最も大きく読める塊になるよう、縮尺 K を上げて切り取りを狭め、山の起伏は低く抑えた。
// 動き: 防爆扉の開閉(蝶番で 90° 回り、トンネルの側壁に沿う。8 秒)。公開されている外観だけで、内部は作らない(坑口の奥は暗い面)。
// 近未来化: 坑口の東の平場の衛星通信のレドーム 3 基(指揮所の通信の冗長化)。
// 省略: 車両・人・柵の大半・送電線。
//
//   const a = DreamAssets.fac.defs.cheyenne.make(THREE)(制圧圏 r = 100)
// 座標(m): 坑口の中心が x = 0、+z が北(坑口の前、ゲーム視点の手前)、-z が山。平場 y = 10。
(function () {
  const K = 0.28;
  const D = { x0: -170, x1: 170, z0: -175, z1: 145, base: -12, by: 10, wall: -30, tw: 40, th: 34, len: 66, door: -10, cut: 105, top: 100, SEC: 8 };

  function cheyenne(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.rock = M.lambert(0xd6d1ca);   // 花崗岩の山肌(白い構造物を浮かせる)
    M.contour = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.14 });
    M.guy = new THREE.LineBasicMaterial({ color: F.P.dark, transparent: true, opacity: 0.4 });
    const group = new THREE.Group(); group.name = "cheyenne";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, lattice, closedLoft } = k;

    // ── 地形: 坑口の後ろからせり上がる山の面、坑口の両脇の切り通しの肩、前の平場 ──
    const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const by = D.by, zW = D.wall, W = D.tw, H = D.th, WH = H + W / 2 + 18;   // 擁壁の高さ
    const hAt = (x, z) => {
      const rise = Math.min(D.top, Math.max(0, zW + 52 - z) * 1.3);   // 坑口の後ろへ上る斜面(擁壁の天端をわずかに越えて頭打ち)
      const n = (8 * Math.sin(x / 41 + z / 57) + 5 * Math.sin(x / 23 - z / 31)) * smooth(0, 40, rise);
      let h = by + rise + n - 6 * Math.cos(x / 90) * smooth(0, 60, rise);
      const cut = 1 - smooth(D.cut, D.cut + 25, Math.abs(x)) * 1;   // 坑口の前の切り通し(|x| < cut は平場)
      const front = smooth(zW - 4, zW + 2, z);                          // 擁壁の前
      h = h * (1 - cut * front) + by * cut * front;
      return Math.max(by - 2, h);
    };
    const T = terrain(THREE, k, M, world, { x0: D.x0, x1: D.x1, z0: D.z0, z1: D.z1, nx: 56, nz: 52, h: hAt, base: D.base, top: M.rock, contour: 20, contourMat: M.contour });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2, { z: (D.z0 + D.z1) / 2 });
    const { pad, pads } = padder(k, M, world, hAt);
    add(ribbon(THREE, [[-168, 140], [-110, 120], [-60, 95], [-20, 60], [0, D.wall + D.len + 6]], 12, hAt, 0.6), M.mid, world, { edges: false });

    // ── 北の坑口(約 5.7 倍): 擁壁、突き出したアーチのトンネル口、奥の暗い面、防爆扉 ──
    const zF = zW + D.len, WW = 2 * D.cut + 20;
    add(box(WW, WH + 8, 16), M.light, world, { x: 0, y: by + WH / 2 - 4, z: zW - 8 });   // 擁壁(下は地中へ 8 m)
    for (let i = 0; i < 9; i++) add(box(1.6, WH - 3, 1.2), M.mid, world, { x: -96 + i * 24, y: by + WH / 2, z: zW + 0.1, edges: false });   // 擁壁の目地
    add(box(WW + 2, 2.4, 17), M.mid, world, { x: 0, y: by + WH + 1.2, z: zW - 8 });
    for (const s of [-1, 1]) add(closedLoft([s * (D.cut - 6), s * (D.cut + 6)].map((x) => [V(x, by - 4, zW), V(x, by - 4, zW + 45), V(x, by + 6, zW + 45), V(x, by + WH, zW)])), M.light, world);   // 両脇の袖壁(斜めに下がる)
    add(box(5, H, D.len), M.light, world, { x: -W / 2 - 2.5, y: by + H / 2, z: zW + D.len / 2 });
    add(box(5, H, D.len), M.light, world, { x: W / 2 + 2.5, y: by + H / 2, z: zW + D.len / 2 });
    const roof = new THREE.CylinderGeometry(W / 2 + 5, W / 2 + 5, D.len, 24, 1, true, Math.PI / 2, Math.PI); roof.rotateX(Math.PI / 2);   // アーチの屋根(上半分)
    add(roof, M.light, world, { x: 0, y: by + H, z: zW + D.len / 2 });
    add(closedLoft([zW + 0.5, zF].map((z) => Array.from({ length: 11 }, (_, i) => { const a = (i / 10) * Math.PI; return V(Math.cos(a) * (W / 2), by + H + Math.sin(a) * (W / 2 - 0.5), z); }))), M.dark, world, { edges: false });   // アーチの内側の天井(暗い)
    for (let i = 1; i < 5; i++) add(new THREE.TorusGeometry(W / 2 + 5.2, 0.6, 4, 24, Math.PI), M.mid, world, { x: 0, y: by + H, z: zW + (D.len * i) / 5, edges: false });   // 屋根の補強のリブ
    add(box(W, H + W / 2, 1), M.dark, world, { x: 0, y: by + (H + W / 2) / 2, z: zW + 1, edges: false });   // 坑道の奥(暗い面)
    add(box(W + 10, 3.2, 1.4), M.accent, world, { x: 0, y: by + H + 1.6, z: zF + 0.7, edges: false });   // 坑口の銘板の帯(開口の上)
    add(box(W + 12, 1.6, 3), M.mid, world, { x: 0, y: by + 0.8, z: zF + 1.5 });
    const HX = -W / 2 + 3, DT = 5, DW = W / 2 - 0.3 - HX - 0.3;   // 蝶番の x、扉の厚さ・幅
    add(box(3, H, DT + 0.8), M.light, world, { x: -W / 2 + 1.5, y: by + H / 2, z: D.door });   // 西の戸当たり(蝶番を付ける柱)
    const door = new THREE.Group(); door.position.set(HX, by, D.door); world.add(door);
    add(box(DW, H - 1, DT), M.steel, door, { x: DW / 2 + 0.3, y: (H - 1) / 2 + 0.2, z: 0 });
    for (const y of [4, H / 2, H - 5]) add(box(DW - 4, 1, 0.8), M.mid, door, { x: DW / 2 + 0.3, y, z: DT / 2 + 0.4 });
    for (const y of [5, H - 6]) add(cyl(1.6, 3, 10), M.dark, door, { x: 0.6, y, z: 0, edges: false });   // 蝶番
    add(box(2, 4, 1.4), M.dark, door, { x: DW - 2, y: H / 2, z: DT / 2 + 0.7, edges: false });   // 閂の受け

    // ── 坑口の前の平場: 入口の管理棟、守衛所と遮断機、駐車場、通信の鉄塔 ──
    add(box(40, 10, 18), M.body, world, { x: -80, y: by + 5, z: 70 });
    add(box(40.2, 1.6, 18.2), M.glass, world, { x: -80, y: by + 6, z: 70, edges: false });
    add(box(9, 4.5, 7), M.light, world, { x: 30, y: by + 2.25, z: 75 });
    add(box(18, 0.8, 0.8), M.accent, world, { x: 14, y: by + 1.6, z: 78, edges: false });
    add(box(50, 0.2, 34), M.mid, world, { x: 70, y: by + 0.1, z: 110, edges: false });
    for (let i = 0; i < 6; i++) add(box(0.4, 0.05, 10), M.body, world, { x: 50 + i * 8, y: by + 0.25, z: 106, edges: false });
    lattice(world, V(-75, by, 20), 40, 2, 0.8, 4, 0.35, M.mid);

    // ── 斜面の上の放送・通信の鉄塔(脇役。実寸) ──
    const guys = [];
    for (const [x, z, h] of [[-110, -150, 70], [-60, -160, 55], [10, -155, 62]]) {
      const y = pad(x, z, 8, 8, 0, M.light);
      lattice(world, V(x, y, z), h, 1.4, 1.0, Math.round(h / 12), 0.28, M.light);
      add(box(2.4, 1.6, 2.4), M.accent, world, { x, y: y + h - 5, z, edges: false });
      for (let q = 0; q < 3; q++) { const a = (q / 3) * Math.PI * 2 + x, rr = h * 0.4; guys.push(x, y + h * 0.8, z, x + Math.cos(a) * rr, hAt(x + Math.cos(a) * rr, z + Math.sin(a) * rr) + 0.5, z + Math.sin(a) * rr); }
      add(box(7, 3.5, 4), M.body, world, { x: x + 7, y: y + 1.75, z: z + 5 });
    }
    { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(guys, 3)); const ls = new THREE.LineSegments(g, M.guy); ls.userData.edges = true; world.add(ls); }

    // ── 近未来化: 坑口の東の平場の衛星通信レドーム 3 基 ──
    for (const [x, z] of [[105, 30], [140, 55], [120, 85]]) {
      add(cyl(8, 6, 16), M.light, world, { x, y: by + 3, z });
      add(cyl(8.3, 0.8, 16), M.accent, world, { x, y: by + 6.2, z, edges: false });
      add(new THREE.IcosahedronGeometry(11, 2), M.body, world, { x, y: by + 6 + 9, z });
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);

    // ── 防爆扉: t = 0(開、側壁に沿う)〜 1(閉) ──
    const ease = (x) => x * x * (3 - 2 * x), OPEN = -Math.PI / 2;
    let state = opts.state ?? "open", t = state === "closed" ? 1 : 0;
    const apply = () => { door.rotation.y = OPEN * (1 - ease(t)); };   // -90° で扉の先が +z(坑口の外)へ向き、西の側壁に沿う
    apply();
    function update(dt) {
      if (state === "closing") { t = Math.min(1, t + dt / D.SEC); if (t >= 1) state = "closed"; }
      if (state === "opening") { t = Math.max(0, t - dt / D.SEC); if (t <= 0) state = "open"; }
      apply();
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) { if (s === "open" || s === "closed") { state = s; t = s === "closed" ? 1 : 0; apply(); } else state = s; }
    // 確認値(m): 扉が回る範囲と側壁・天井・床、閉じた扉と東の側壁、開いた扉の先と坑口の外の縁、擁壁の裏の地形、レドームと切り通しの肩
    function check() {
      const r1 = (v) => +v.toFixed(2);
      const archAtEdge = Math.sqrt(Math.max(0, (W / 2) ** 2 - (W / 2 - 0.3) ** 2));
      return {
        doorToWestWallOpen_m: r1(HX - DT / 2 + W / 2),
        doorTipToPortalFaceOpen_m: r1(zF - (D.door + DW + 0.3)),
        doorSwingToDarkBack_m: r1(D.door - DT / 2 - (zW + 1.5)),
        closedDoorToEastWall_m: r1(W / 2 - (HX + 0.3 + DW)),
        doorTopToArch_m: r1(H + archAtEdge - (H - 1 + 0.2)),
        doorBottomAboveFloor_m: 0.2, swingRadius_m: r1(Math.hypot(DW + 0.3, DT / 2)),
        terrainBehindWall_m: r1(hAt(0, zW - 20) - (by + WH)),
        portalOpening_m: [W, r1(H + W / 2)], headwall_m: [WW, r1(WH)],
        padMax_m: +pads.max.toFixed(1), terrainTris: T.tris,
      };
    }

    U.bake(THREE, group, { dynamic: [door], live: [M.accent], also: [] });
    return {
      group, update, setState, check, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      get state() { return state; }, get progress() { return t; },
      at: (x, y, z) => V(x * K, (y - D.base) * K, (z - (D.z0 + D.z1) / 2) * K),
      shots: {
        portal: { label: "北の坑口と防爆扉", target: [0, 40, 10], pos: [110, 110, 230] },
        door: { label: "防爆扉(寄り)", target: [0, 30, 5], pos: [25, 40, 95] },
        towers: { label: "斜面の上の鉄塔", target: [-60, 120, -150], pos: [80, 200, -10] },
        radome: { label: "東の平場のレドーム(近未来)", target: [120, 15, 55], pos: [200, 80, 170] },
      },
    };
  }

  // ── このファイルの部品(hermon.js と同じ地形の塊・帯・基礎) ──
  function terrain(THREE, k, M, parent, { x0, x1, z0, z1, nx, nz, h, base, top, contour = 0, contourMat = null }) {
    const pos = [], seg = [];
    const P = (i, j) => { const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz; return [x, h(x, z), z]; };
    const tri = (a, b, c) => {
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (ny < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c);
      if (!contour) return;
      const lo = Math.min(a[1], b[1], c[1]), hi = Math.max(a[1], b[1], c[1]);
      for (let L = Math.ceil(lo / contour) * contour + 0.001; L < hi; L += contour) {
        const pts = [];
        for (const [p, q] of [[a, b], [b, c], [c, a]]) if ((p[1] - L) * (q[1] - L) < 0) { const t = (L - p[1]) / (q[1] - p[1]); pts.push(p[0] + (q[0] - p[0]) * t, L + 0.5, p[2] + (q[2] - p[2]) * t); }
        if (pts.length === 6) seg.push(...pts);
      }
    };
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);
      if ((i + j) % 2) { tri(p00, p10, p11); tri(p00, p11, p01); } else { tri(p00, p10, p01); tri(p10, p11, p01); }
    }
    const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
    k.add(geo(pos), top, parent, { edges: false });
    const sk = [], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const edgePts = [[...Array(nx + 1)].map((_, i) => P(i, 0)), [...Array(nz + 1)].map((_, j) => P(nx, j)), [...Array(nx + 1)].map((_, i) => P(nx - i, nz)), [...Array(nz + 1)].map((_, j) => P(0, nz - j))];
    const outTri = (p, q, r) => {
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      const nx_ = uy * vz - uz * vy, nz_ = ux * vy - uy * vx, mx = (p[0] + q[0] + r[0]) / 3 - cx, mz = (p[2] + q[2] + r[2]) / 3 - cz;
      sk.push(...p, ...(nx_ * mx + nz_ * mz < 0 ? [...r, ...q] : [...q, ...r]));
    };
    for (const pts of edgePts) for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], a0 = [a[0], base, a[2]], b0 = [b[0], base, b[2]]; outTri(a0, b0, b); outTri(a0, b, a); }
    k.add(geo(sk), M.mid, parent);
    if (contour && seg.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3)); const ls = new THREE.LineSegments(lg, contourMat); ls.userData.edges = true; parent.add(ls); }
    return { tris: pos.length / 9, segs: seg.length / 6 };
  }
  function ribbon(THREE, pts, w, h, lift = 0.5, step = 8) {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step)); for (let s = 0; s < n; s++) P.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]); }
    P.push(pts[pts.length - 1]);
    const L = [], R = [];
    for (let i = 0; i < P.length; i++) {
      const [px, pz] = P[Math.max(0, i - 1)], [qx, qz] = P[Math.min(P.length - 1, i + 1)], dl = Math.hypot(qx - px, qz - pz) || 1, nx = -(qz - pz) / dl, nz = (qx - px) / dl, [x, z] = P[i];
      L.push([x + (nx * w) / 2, 0, z + (nz * w) / 2]); R.push([x - (nx * w) / 2, 0, z - (nz * w) / 2]);
      L[i][1] = h(L[i][0], L[i][2]) + lift; R[i][1] = h(R[i][0], R[i][2]) + lift;
    }
    const pos = [], up = (a, b, c) => { const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); if (ny < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c); };
    for (let i = 0; i < P.length - 1; i++) { up(L[i], R[i], R[i + 1]); up(L[i], R[i + 1], L[i + 1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  function padder(k, M, parent, h) {
    const pads = { max: 0 };
    const pad = (x, z, w, d, ry = 0, mat = M.light) => {
      const c = Math.cos(ry), s = Math.sin(ry), ys = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].map(([a, b]) => h(x + (a * w * c) / 2 + (b * d * s) / 2, z - (a * w * s) / 2 + (b * d * c) / 2));
      const top = Math.max(...ys) + 0.3, bot = Math.min(...ys) - 1.5;
      k.add(k.box(w, top - bot, d), mat, parent, { x, y: (top + bot) / 2, z, ry });
      pads.max = Math.max(pads.max, top - Math.min(...ys));
      return top;
    };
    return { pad, pads };
  }

  DreamAssets.fac.register("cheyenne", {
    section: 9, title: "シャイアン・マウンテン", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "花崗岩の山の中に北米防空司令部の予備の指揮所がある。ふもとの北の坑口は擁壁から突き出したアーチのトンネル口で、すぐ内側に巨大な防爆扉。奥の斜面に放送・通信の鉄塔。坑口の脇に衛星通信のレドームを足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/cheyenne.js"], ["大きさ", "坑口のまわりの山の面 340 × 320 m を 0.28 倍 × 表示 3.0(山頂までの距離と高さは縮めた)"], ["誇張", "トンネル口と擁壁 約 5.7 倍(開口 40 m、擁壁 210 × 72 m)、防爆扉を坑口のすぐ内側へ寄せた。鉄塔は実寸の脇役"], ["省略", "車両・人・柵の大半・送電線、内部"], ["動作", "防爆扉の開閉(8 秒)"], ["近未来化", "坑口の東の平場の衛星通信レドーム 3 基"]],
    dist: 1050, target: 70, tokenAt: [380, 0, 300],
    make: (THREE) => cheyenne(THREE, { r: 100 }),
    actLabel: "BLAST DOOR · 防爆扉", progress: true,
    actions: (a) => [["開", () => a.setState("open"), () => a.state === "open"], ["閉鎖 ▶", () => a.setState("closing"), () => a.state === "closing"], ["閉", () => a.setState("closed"), () => a.state === "closed"], ["◀ 開放", () => a.setState("opening"), () => a.state === "opening"]],
    caption: (a) => (a.state === "closing" ? "防爆扉 閉鎖中" : a.state === "opening" ? "防爆扉 開放中" : ""),
  });
})();
