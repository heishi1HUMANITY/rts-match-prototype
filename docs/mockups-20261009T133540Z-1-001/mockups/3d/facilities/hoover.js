// 戦略施設トークン「フーバーダム」(米国アリゾナ州・ネバダ州境、コロラド川のブラックキャニオン)の詳細版モデル(試作)。
// 平面と高さは実寸の比率(1000 × 850 m を K 倍)。米南西部の水と電力を握るアーチ式重力ダムと、それをまたぐアーチ橋が決め手。
// 誇張: 取水塔の太さ 1.3 倍、迂回路の橋のアーチのリブ 1.5 倍・柱 1.3 倍。ダムと峡谷は実寸(堤高 221 m、天端の長さ 約 380 m、底の厚さ 200 m)。
// 部品: 下流へ中心を置いた円弧のダム(上流面は鉛直、下流面は下ほど厚い)、天端の道路と胸壁と塔、上流の取水塔 4 基と天端への渡り橋、
//       両岸の側水路式の洪水吐き(ドラムゲートの列・水路・トンネルの口)、下流の発電所の両翼(窓の帯・屋上の変圧器)、
//       マイク・オカラハン=パット・ティルマン記念橋(2 本のコンクリートのリブ、鋼の柱、桁)、ネバダ側のビジターセンター、ミード湖、コロラド川。
// 省略: 車両・人・送電線・弁室・小さな機器・取水塔の時計。
// 近未来化: 揚水発電(下流の川岸のポンプ場と、峡谷の縁を通って湖へ戻す 2 本の導水管、サージタンク)。状態の「近未来化」で表示。
// 状態: 渇水(現在。湖が下がり、峡谷の壁に白い「バスタブの輪」が出る)/ 満水。湖の水位が動く。
// 水は z 方向、+z が下流(南)。
(function () {
  const K = 0.13;
  const D = { x0: -500, x1: 500, z0: -420, z1: 430, base: -20, bed: 0, chanBed: -6, tail: -1, crest: 221, rim: 290, deck: 271 };
  const LAKE = { full: 212, drought: 154 };
  const ARC = { zDam: -150, Rc: 280 };   // 天端中央の上流面の z と、上流面の半径(中心は下流側)
  const BR = { z: 310, spring: 185, crown: 258, half: 161 };   // 迂回路の橋(アーチの起点と頂点の高さ、半径間)
  const cxz = (z) => 50 * Math.sin((z + 50) / 300);   // 峡谷の中心線(ゆるく曲がる)
  const SPW = { dx: 190, z0: -370, z1: -190, top: D.crest - 8 };   // 側水路式の洪水吐き(峡谷の縁を切り込んだ場所)
  // 峡谷の壁の高さ(中心線からの距離)
  const wall = (dx) => dx < 85 ? 0 : dx < 175 ? 221 * Math.pow((dx - 85) / 90, 0.9) : dx < 230 ? 221 + ((dx - 175) / 55) * 69 : 290;
  function terrainY(x, z) {
    const dx = Math.abs(x - cxz(z));
    let y = wall(dx);
    if (dx >= 230) y += 18 * Math.sin(x / 90) * Math.cos(z / 110) * Math.min(1, (dx - 230) / 60);
    if (dx < 38 && z > 40) y = D.chanBed;   // 下流の川筋
    if (Math.abs(dx - SPW.dx) < 24 && z > SPW.z0 - 10 && z < SPW.z1 + 10) y = Math.min(y, SPW.top - 3);   // 洪水吐きの切り込み
    if (Math.abs(z - BR.z) < 16 && dx > 200) y = Math.min(y, D.deck - 1);   // 橋の取付け道路の切り通し
    return y;
  }

  function hoover(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, waterShape, tube, closedLoft, arcLoft } = k;
    M.rock = M.lambert(0xcdbfae); M.ringBand = M.lambert(0xf3f1ec); M.lake = k.water(); M.river = k.water();
    M.concrete = M.lambert(0xe6e3dc);
    const group = new THREE.Group(); group.name = "hoover";
    const ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);

    // ── ダムの形(先に決める。地形の輪の色分けに上流面の位置を使う) ──
    const xc = cxz(ARC.zDam), zA = ARC.zDam + ARC.Rc;
    const thick = (y) => 14 + 186 * Math.pow(Math.max(0, (D.crest - y) / D.crest), 0.85);
    const at3 = (r, b, y) => V(xc + r * Math.sin(b), y, zA - r * Math.cos(b));
    // 断面の底: 上流面の岩の高さから始め、その高さでの厚さの範囲(上流面〜下流面)で最も低い岩に合わせる(2 回くり返す)
    const ybAt = (b) => {
      const tY = (r) => { const p = at3(r, b, 0); return terrainY(p.x, p.z); };
      let y = tY(ARC.Rc);
      for (let it = 0; it < 2; it++) { let m = y; for (let f = 0; f <= 1; f += 0.125) m = Math.min(m, tY(ARC.Rc - thick(y) * f)); y = m; }
      return y - 3;
    };
    const faceY = (b) => { const p = at3(ARC.Rc, b, 0); return terrainY(p.x, p.z); };
    let bR = 0, bL = 0; while (bR < 1.2 && faceY(bR + 0.01) < D.crest + 2) bR += 0.01; while (bL < 1.2 && faceY(-bL - 0.01) < D.crest + 2) bL += 0.01;   // 両端は岩に 2 m 入るまで(峡谷が曲がるので左右で違う)
    const upstreamZ = (x) => { const s = (x - xc) / ARC.Rc; return Math.abs(s) < 1 ? zA - Math.sqrt(1 - s * s) * ARC.Rc : D.z1; };

    // ── 峡谷(地形の塊。上流の壁の水位の帯は白い「輪」) ──
    {
      const nx = 120, nz = 96, pos = [], posR = [], sk = [];
      const P = (i, j) => { const x = D.x0 + ((D.x1 - D.x0) * i) / nx, z = D.z0 + ((D.z1 - D.z0) * j) / nz; return [x, terrainY(x, z), z]; };
      const tri = (a, b, c) => {
        const ym = (a[1] + b[1] + c[1]) / 3, xm = (a[0] + b[0] + c[0]) / 3, zm = (a[2] + b[2] + c[2]) / 3;
        const arr = ym > LAKE.drought + 1 && ym < LAKE.full + 2 && zm < upstreamZ(xm) - 4 ? posR : pos;
        const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        if (ny < 0) arr.push(...a, ...c, ...b); else arr.push(...a, ...b, ...c);
      };
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1); tri(a, b, d); tri(a, d, c); }
      const cxm = 0, czm = ZC;
      const out = (p, q, r) => { const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2]; const nx_ = uy * vz - uz * vy, nz_ = ux * vy - uy * vx; sk.push(...p, ...(nx_ * ((p[0] + q[0] + r[0]) / 3 - cxm) + nz_ * ((p[2] + q[2] + r[2]) / 3 - czm) < 0 ? [...r, ...q] : [...q, ...r])); };
      const edges = [[...Array(nx + 1)].map((_, i) => P(i, 0)), [...Array(nz + 1)].map((_, j) => P(nx, j)), [...Array(nx + 1)].map((_, i) => P(nx - i, nz)), [...Array(nz + 1)].map((_, j) => P(0, nz - j))];
      for (const e of edges) for (let i = 0; i < e.length - 1; i++) { const a = e[i], b = e[i + 1], a0 = [a[0], D.base, a[2]], b0 = [b[0], D.base, b[2]]; out(a0, b0, b); out(a0, b, a); }
      const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
      add(geo(pos), M.rock, world, { edges: false });
      add(geo(posR), M.ringBand, world, { edges: false });
      add(geo(sk), M.mid, world);
      F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.001, { z: ZC });
    }
    // 起伏のある地面に置く敷地(最も高い所 + 0.5 が上面、最も低い所の 2 m 下まで塊)
    const pad = (parent, x, z, w, d, mat = M.light) => {
      const ys = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => terrainY(x + (a * w) / 2, z + (b * d) / 2));
      const top = Math.max(...ys) + 0.5, bot = Math.min(...ys) - 2;
      add(box(w, top - bot, d), mat, parent, { x, y: (top + bot) / 2, z }); return top;
    };

    // ── ダム本体: 角度ごとの断面(上流面は鉛直、下流面は下ほど厚い凸の曲線)を円弧に沿ってつなぐ ──
    {
      const n = 44, m = 12, rings = [];
      for (let i = 0; i <= n; i++) {
        const b = -bL + ((bL + bR) * i) / n, yb = ybAt(b), pts = [[ARC.Rc, yb], [ARC.Rc, D.crest], [ARC.Rc - 14, D.crest]];
        for (let j = 1; j <= m; j++) { const y = D.crest - ((D.crest - yb) * j) / m; pts.push([ARC.Rc - thick(y), y]); }
        rings.push(pts.map(([r, y]) => at3(r, b, y)));
      }
      add(closedLoft(rings), M.concrete, world);
      // 天端: 道路・胸壁(上流と下流)・塔(下流側へ張り出した 4 基)
      const cg = new THREE.Group(); cg.position.set(xc, 0, zA); cg.rotation.y = Math.PI; world.add(cg);   // arcLoft の角度(+z が 0)を、中心から上流へ向ける
      add(arcLoft([[ARC.Rc - 14, D.crest], [ARC.Rc, D.crest], [ARC.Rc, D.crest + 0.8], [ARC.Rc - 14, D.crest + 0.8]], -bR, bL, 40), M.mid, cg, { edges: false });
      for (const r of [ARC.Rc - 0.6, ARC.Rc - 13.4]) add(arcLoft([[r - 0.6, D.crest + 0.8], [r + 0.6, D.crest + 0.8], [r + 0.6, D.crest + 2.4], [r - 0.6, D.crest + 2.4]], -bR + 0.02, bL - 0.02, 40), M.body, cg);
      for (const b of [-0.42, -0.2, 0.2, 0.42]) {
        const p = k.polar(ARC.Rc - 18, b);
        add(box(10, 26, 10), M.body, cg, { x: p.x, y: D.crest - 9, z: p.z, ry: b });
        add(box(10.4, 1.2, 10.4), M.accent, cg, { x: p.x, y: D.crest + 2.6, z: p.z, ry: b, edges: false });
        for (const dy of [-6, -1, 4]) add(box(3, 3, 10.3), M.glass, cg, { x: p.x, y: D.crest + dy - 2, z: p.z, ry: b, edges: false });
      }
    }

    // ── 取水塔 4 基(湖の中、両岸に 2 基ずつ)と天端への渡り橋 ──
    const towers = [];
    for (const s of [-1, 1]) for (const zt of [ARC.zDam - 40, ARC.zDam - 95]) {
      const dx = 120, x = cxz(zt) + s * dx, yb = terrainY(x, zt) - 3, top = D.crest + 8, R = 9.5 * 1.3;
      const g = new THREE.Group(); g.position.set(x, 0, zt); world.add(g);
      add(cyl(R, top - yb, 20), M.concrete, g, { y: (top + yb) / 2 });
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(box(1.6, top - yb - 14, 2.4), M.light, g, { x: Math.cos(a) * (R + 0.8), y: (top - 14 + yb) / 2 + 2, z: Math.sin(a) * (R + 0.8), ry: -a }); }   // 縦のひだ(アールデコ)
      add(cyl(R + 2.2, 7, 20), M.body, g, { y: top - 4 });
      add(cyl(R - 2, 5, 20), M.light, g, { y: top + 2 });
      add(new THREE.ConeGeometry(R - 3, 6, 20), M.steel, g, { y: top + 7.5 });
      add(cyl(R + 2.4, 1.2, 20), M.accent, g, { y: top - 8, edges: false });
      // 渡り橋(塔の上から峡谷の壁へ)
      let wx = dx; while (wx < 260 && wall(wx) < top - 1) wx += 2;
      const bx0 = s * (R + 1), bx1 = s * (wx - dx + 4);
      add(box(Math.abs(bx1 - bx0), 3, 7), M.light, g, { x: (bx0 + bx1) / 2, y: top - 1.5, z: 0 });
      towers.push({ x, z: zt, yb, top });
    }

    // ── 側水路式の洪水吐き(両岸。湖側の縁にドラムゲートの列、水路、下流の端にトンネルの口) ──
    for (const s of [-1, 1]) {
      const L = SPW.z1 - SPW.z0, zm = (SPW.z0 + SPW.z1) / 2, x = cxz(zm) + s * SPW.dx, yb = SPW.top - 3;
      add(box(40, SPW.top - yb + 30, L), M.concrete, world, { x, y: SPW.top - (SPW.top - yb + 30) / 2, z: zm });
      add(box(20, 2, L - 8), M.dark, world, { x: x + s * 3, y: SPW.top + 0.01 - 0.98, z: zm, edges: false });   // 水路の底(暗く)
      add(box(3, 6, L), M.light, world, { x: x + s * 14, y: SPW.top + 3, z: zm });   // 陸側の壁
      for (let i = 0; i < 4; i++) add(box(3, 4, L / 4 - 3), M.steel, world, { x: x - s * 14, y: SPW.top + 2, z: SPW.z0 + (L * (i + 0.5)) / 4 });   // ドラムゲート
      add(box(16, 12, 6), M.dark, world, { x: x + s * 3, y: SPW.top - 3, z: SPW.z1 + 2, edges: false });   // トンネルの口
    }

    // ── 発電所の両翼(下流のつま先、川の両側。窓の帯・屋上の変圧器と門形クレーン) ──
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
      const z = 66 + i * 40, x = cxz(z) + s * 64, h = 58;
      add(box(42, h - D.chanBed, 40), M.body, world, { x, y: (h + D.chanBed) / 2, z });
      for (const y of [16, 30, 44]) add(box(42.4, 3.2, 40.4), M.glass, world, { x, y, z, edges: false });
      add(box(42.6, 1.6, 40.6), M.accent, world, { x, y: h - 2, z, edges: false });
      for (const dz of [-10, 10]) add(box(8, 7, 8), M.dark, world, { x: x + s * 8, y: h + 3.5, z: z + dz });
      if (i % 2 === 0) { add(box(30, 2, 3), M.steel, world, { x, y: h + 14, z }); for (const e of [-13, 13]) add(box(2, 14, 2), M.steel, world, { x: x + e, y: h + 7, z }); }
    }

    // ── 迂回路の橋(マイク・オカラハン=パット・ティルマン記念橋): 2 本のリブ・横つなぎ・柱・桁 ──
    {
      const bx = cxz(BR.z), rise = BR.crown - BR.spring, archY = (x) => BR.spring + rise * (1 - (x / BR.half) ** 2);
      const RW = 7 * 1.5, RD = 6 * 1.5, ribZ = [-9.5, 9.5], n = 24;
      for (const dz of ribZ) {
        const rings = [];
        for (let i = 0; i <= n; i++) {
          const x = -BR.half - 6 + ((2 * BR.half + 12) * i) / n, xx = Math.max(-BR.half, Math.min(BR.half, x)), y = archY(xx), slope = (-2 * rise * xx) / BR.half ** 2, dv = RD * Math.sqrt(1 + slope * slope);
          rings.push([[-RW / 2, 0], [RW / 2, 0], [RW / 2, dv], [-RW / 2, dv]].map(([zz, yy]) => V(bx + x, y - dv / 2 + yy - (Math.abs(x) > BR.half ? (Math.abs(x) - BR.half) * Math.abs(slope) : 0), BR.z + dz + zz)));
        }
        add(closedLoft(rings), M.concrete, world);
      }
      const deckBot = D.deck - 4;
      let deckEnd = BR.half; while (deckEnd < 300 && wall(deckEnd) < D.deck + 2) deckEnd += 2;
      add(box(2 * deckEnd, 4, 27), M.light, world, { x: bx, y: D.deck - 2, z: BR.z });
      for (const dz of [-13, 13]) add(box(2 * deckEnd, 1.4, 0.8), M.body, world, { x: bx, y: D.deck + 0.7, z: BR.z + dz });
      for (let x = 18; x < deckEnd; x += 36) for (const sx of [-1, 1]) {
        const xx = sx * x, onArch = Math.abs(xx) < BR.half, yb = onArch ? archY(xx) + RD / 2 : wall(Math.abs(xx)) - 2;
        if (deckBot - yb < 3) continue;
        for (const dz of ribZ) add(box(2.6 * 1.3, deckBot - yb, 2.6 * 1.3), M.steel, world, { x: bx + xx, y: (deckBot + yb) / 2, z: BR.z + dz });
        if (onArch) add(box(2.2, 2.2, 19), M.steel, world, { x: bx + xx, y: yb + 1.1, z: BR.z });   // リブの横つなぎ
      }
      // 縁の取付け道路
      for (const s of [-1, 1]) { const x0 = bx + s * deckEnd, x1 = s > 0 ? D.x1 : D.x0; add(box(Math.abs(x1 - x0), 1.2, 22), M.mid, world, { x: (x0 + x1) / 2, y: D.deck - 0.4, z: BR.z, edges: false }); }
    }

    // ── ネバダ側(-x)のビジターセンター(円い建物と展望台)と立体駐車場 ──
    {
      const z = -110, x = cxz(z) - 280, top = pad(world, x, z, 60, 50);
      add(cyl(20, 16, 24), M.body, world, { x, y: top + 8, z });
      add(cyl(20.4, 2.4, 24), M.glass, world, { x, y: top + 11, z, edges: false });
      add(cyl(22, 1.2, 24), M.accent, world, { x, y: top + 16.6, z, edges: false });
      const t2 = pad(world, x - 10, z - 70, 70, 40, M.mid);
      for (const dy of [4, 8]) add(box(66, 0.8, 36), M.light, world, { x: x - 10, y: t2 + dy, z: z - 70 });
    }

    // ── 近未来化: 揚水発電(川岸のポンプ場、縁を上る 2 本の導水管、サージタンク、湖の取水口) ──
    const future = new THREE.Group(); world.add(future);
    {
      const zp = 380, xp = cxz(zp) + 64;
      add(box(44, 40 - D.chanBed, 60), M.body, future, { x: xp, y: (40 + D.chanBed) / 2, z: zp });
      add(box(44.4, 1.6, 60.4), M.accent, future, { x: xp, y: 37, z: zp, edges: false });
      for (const dz of [-14, 14]) add(cyl(4, 12, 12), M.steel, future, { x: xp + 8, y: 46, z: zp + dz });
      // 導水管: ポンプ場 → 東の壁を上る → 縁の上を上流へ → 湖へ下りる
      const pts = [], lift = (z) => (Math.abs(z - BR.z) < 30 ? 9 : 3);   // 橋の取付け道路の上は持ち上げて跨ぐ
      for (let t = 0; t <= 8; t++) { const dx = 64 + (t / 8) * 260, x = cxz(zp) + dx; pts.push([x, Math.max(terrainY(x, zp), 0) + 3, zp]); }
      for (let z = zp - 40; z >= -380; z -= 40) { const x = cxz(z) + 324; pts.push([x, terrainY(x, z) + lift(z), z]); }
      for (let t = 1; t <= 6; t++) { const z = -400, dx = 324 - (t / 6) * 190, x = cxz(z) + dx; pts.push([x, Math.max(terrainY(x, z) + 3, LAKE.drought - 8), z]); }
      const end = pts[pts.length - 1]; add(box(12, 10, 12), M.light, future, { x: end[0], y: end[1], z: end[2] });   // 湖の取水口
      for (const off of [-4, 4]) for (let i = 0; i < pts.length - 1; i++) tube(future, V(pts[i][0], pts[i][1], pts[i][2] + off), V(pts[i + 1][0], pts[i + 1][1], pts[i + 1][2] + off), 2.4, M.steel);
      for (let i = 2; i < pts.length - 1; i += 2) add(box(6, 2, 14), M.mid, future, { x: pts[i][0], y: pts[i][1] - 2.5, z: pts[i][2] });   // 管の受け台
      const st = pts[10]; add(cyl(10, 30, 16), M.light, future, { x: st[0] + 20, y: st[1] + 15, z: st[2] });   // サージタンク
      add(cyl(10.4, 1.4, 16), M.accent, future, { x: st[0] + 20, y: st[1] + 27, z: st[2], edges: false });
    }

    // ── 水: ミード湖(上流、円弧の上流面まで)、コロラド川(下流) ──
    const lakePts = [[D.x0, D.z0], [D.x1, D.z0], [D.x1, -60]];
    for (let i = 0; i <= 30; i++) { const b = bR - ((bL + bR) * i) / 30, p = at3(ARC.Rc + 0.5, b, 0); lakePts.push([p.x, p.z]); }
    lakePts.push([D.x0, -60]);
    const lake = waterShape(lakePts, M.lake); world.add(lake);
    const lakeCut = new THREE.Mesh(new THREE.PlaneGeometry(420, 1).translate(0, 0.5, 0), M.waterCut); lakeCut.position.set(cxz(D.z0), 0, D.z0 + 0.5); world.add(lakeCut);
    const rv = []; for (let z = 40; z <= D.z1; z += 30) rv.push([cxz(z) - 37, z]); for (let z = D.z1 - (D.z1 - 40) % 30; z >= 40; z -= 30) rv.push([cxz(z) + 37, z]);
    world.add(waterShape(rv, M.river).translateY(D.tail));
    world.add(new THREE.Mesh(new THREE.PlaneGeometry(74, D.tail - D.chanBed).translate(cxz(D.z1), (D.tail + D.chanBed) / 2, D.z1 - 0.5), M.waterCut));

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 90, M.ring, M.disc);

    // ── 状態: 湖の水位と近未来化の表示 ──
    let state = opts.state ?? "drought", fut = false, level = LAKE[state];
    const apply = () => { lake.position.y = level; lakeCut.scale.y = level; future.visible = fut; };
    function update(dt) {
      const target = LAKE[state];
      level += Math.sign(target - level) * Math.min(Math.abs(target - level), dt * 10);
      apply();
      M.river.map.offset.y -= dt * 0.3; M.lake.map.offset.y -= dt * 0.02;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) { if (s in LAKE) state = s; }

    function check() {
      const r1 = (v) => +v.toFixed(1), bx = cxz(BR.z);
      const eL = at3(ARC.Rc, -bL, 0), eR = at3(ARC.Rc, bR, 0);
      return {
        damArc_rad: [r1(-bL), r1(bR)], crestLength_m: r1((bL + bR) * ARC.Rc),                  // 天端の長さ(実物 約 379 m)
        crestEndsInRock_m: [r1(terrainY(eL.x, eL.z) - D.crest), r1(terrainY(eR.x, eR.z) - D.crest)],   // 両端の上流面で岩が天端より高い(埋まる)
        baseThickness_m: r1(thick(0)),
        towerTopOverCrest_m: r1(towers[0].top - D.crest), towerBaseUnderDrought_m: r1(LAKE.drought - Math.max(...towers.map((t) => t.yb))),   // 渇水でも塔の根元は水の中
        spillGateTopOverFull_m: r1(SPW.top + 4 - LAKE.full),                                   // ドラムゲートの上端と満水位
        archSpringInRock_m: r1(wall(BR.half) - BR.spring),                                     // アームの起点が岩に入る深さ
        deckOverCrest_m: r1(D.deck - D.crest), bridgeToDam_m: r1(BR.z - ARC.zDam),
      };
    }

    future.visible = true;
    U.bake(THREE, group, { dynamic: [future], live: [M.accent] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setState, check, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc }, at,
      setFuture(v) { fut = v; apply(); }, get future() { return fut; },
      get state() { return state; },
      shots: {
        dam: { label: "ダムと発電所", target: [0, 120, -60], pos: [160, 300, 260] },
        towers: { label: "取水塔と天端", target: [-80, 170, -230], pos: [160, 330, -40] },
        ring: { label: "湖の白い輪", target: [100, 170, -260], pos: [-120, 330, -415] },
        bridge: { label: "迂回路の橋", target: [40, 230, 310], pos: [300, 330, 520] },
        future: { label: "揚水発電(近未来化)", target: [200, 200, 300], pos: [420, 420, 560] },
      },
    };
  }

  DreamAssets.fac.register("hoover", {
    section: 9, title: "フーバーダム", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "ブラックキャニオンをせき止めるアーチ式重力ダム(堤高 221 m)と、下流をまたぐコンクリートのアーチ橋。米南西部の水と電力を握る。渇水で下がったミード湖の白い輪、揚水発電を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/hoover.js"], ["大きさ", "実寸 1000 × 850 m を 0.13 倍 × 表示 3.0(高さも実寸)"], ["誇張", "取水塔の太さ 1.3 倍、橋のリブ 1.5 倍・柱 1.3 倍"], ["省略", "車両・人・送電線・弁室・取水塔の時計"], ["状態", "渇水(現在、白い輪)/ 満水。湖の水位が動く"], ["近未来化", "揚水発電(ポンプ場・導水管・サージタンク)"]],
    dist: 1050, target: 70, tokenAt: [400, 0, 320],
    make: (THREE) => hoover(THREE, { r: 90 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["渇水(現在)", () => a.setState("drought"), () => a.state === "drought"], ["満水", () => a.setState("full"), () => a.state === "full"], ["近未来化: " + (a.future ? "あり" : "なし"), () => a.setFuture(!a.future), () => a.future]],
  });
})();
