// 拠点 7「南東の記念塔」(マップ「運河地帯」)。湖の東、東岸の戦争の記念碑(地名は架空)。
// 銃剣をかたどった高い塔(刃・鍔・台座)を 3 段の基壇に据え、南北の儀礼の軸で構成した:
//   南の到着の広場 → 糸杉の並木と水盤の参道 → 地図の道路を横断歩道で渡る → 前庭(石柱の列) → 基壇の大階段 → 塔 → 北の旗の広場(旗竿の半円)。
//   軸の両側に芝と花壇の庭、西に記念館、東に整形庭園と駐車場(太陽光の屋根)。境内の北は木の帯で囲み、縁は砂漠の草地へなじませる。
// 慰霊の場所なので塔と基壇には動きもチーム色も付けない。チーム色は東の通用口の管理所の帯だけ。
// 縮尺 0.6 単位/m。誇張: 塔の高さ(地上 約 175 単位 ≒ 290 m 相当)、基壇の段。近未来化: 駐車場の太陽光の屋根と充電柱。
(function () {
  // ── 制圧圏の中の地面の小物(草・低木・小石・木・生け垣・花壇)。運河トンネル・湖畔の運河局・南東の記念塔の 3 つの拠点ファイルに同じ定義を置く(読み込み順に依らないよう ??=) ──
  // 小物は種類ごとに InstancedMesh 1 つ。block / blockC / blockLine で自分の建造物・道を登録し、cover で縁ほど密に地面を埋める
  ((window.DreamAssets ??= {}).maps ??= { sites: {} }).siteGround ??= function (THREE, ctx, group, seed = 1) {
    const { U } = ctx, P = ctx.point, MAP = DreamAssets.maps.suez;
    const rnd = U.rng(seed);
    const col = (c) => new THREE.Color(c);
    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const tint = (g, c) => ({ geo: g.index ? g.toNonIndexed() : g, color: col(c) });
    const blades = (n, h, w, c, lean, sd) => {   // 草の株(細い三角の葉を放射状に)
      const pos = [], r = U.rng(sd);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.6, ca = Math.cos(a), sa = Math.sin(a), hh = h * (0.7 + r() * 0.5), l = lean * hh;
        pos.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * l, hh, sa * l);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
      return { geo: g, color: col(c) };
    };
    const ico = (s) => new THREE.IcosahedronGeometry(1, 0).scale(...s), oct = (s) => new THREE.OctahedronGeometry(1, 0).scale(...s);
    const palm = [tint(new THREE.CylinderGeometry(0.5, 0.95, 15, 6).translate(0, 7.5, 0), 0x8a7d6a), tint(ico([1.3, 1.1, 1.3]).translate(0, 15, 0), 0x8f9f84)];
    for (let i = 0; i < 9; i++) palm.push(tint(new THREE.BoxGeometry(1.4, 0.25, 8.5).translate(0, 0, 4.2).rotateX(0.45 + (i % 3) * 0.22).rotateY((i / 9) * Math.PI * 2).translate(0, 15.2, 0), i % 2 ? 0x8f9f84 : 0x9fae92));
    const GEO = {
      tuft: U.concat(THREE, [blades(6, 2.8, 0.55, 0xb8bb9c, 0.35, 3)]),
      tuft2: U.concat(THREE, [blades(5, 2.2, 0.5, 0xc6c6a8, 0.45, 7)]),
      scrub: U.concat(THREE, [tint(oct([2.6, 1.4, 2.2]).translate(0, 0.9, 0), 0xa5ac94), tint(oct([1.6, 1.1, 1.5]).translate(1.5, 0.8, 0.9), 0x939b84)]),
      stone: U.concat(THREE, [tint(ico([1, 0.55, 0.8]), 0xcac3b3)]),
      stone2: U.concat(THREE, [tint(oct([1, 0.5, 0.75]), 0xb9b1a1)]),
      cas: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.45, 0.75, 11, 6).translate(0, 5.5, 0), 0x8a7d6a), tint(ico([3.6, 8, 3.6]).translate(0, 14, 0), 0x8f9f84), tint(ico([2.6, 5.4, 2.6]).translate(0.5, 20, -0.3), 0x7f9076)]),
      shade: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.6, 0.9, 7, 6).translate(0, 3.5, 0), 0x8a7d6a), tint(ico([5.4, 4.2, 5.4]).translate(0, 9.5, 0), 0x8f9f84), tint(ico([3.8, 3.2, 3.8]).translate(2.6, 11.2, 1.2), 0x9fae92), tint(ico([3.4, 2.8, 3.4]).translate(-2.4, 10.6, -1.6), 0x7f9076)]),
      cypress: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.4, 0.6, 3, 5).translate(0, 1.5, 0), 0x8a7d6a), tint(oct([2.3, 9.5, 2.3]).translate(0, 11, 0), 0x7f9076), tint(oct([1.6, 5, 1.6]).translate(0.3, 15.5, 0.2), 0x8f9f84)]),
      palm: U.concat(THREE, palm),
      hedge: U.concat(THREE, [tint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 0x8c9c80)]),
      bed: U.concat(THREE, [tint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 0xc4a39c)]),   // 花壇(くすんだ薔薇色)
      bed2: U.concat(THREE, [tint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 0xe3dcc2)]),  // 花壇(生成り)
    };
    const H = (x, z) => Math.max(0.5, MAP.landH(P.x + x, P.z + z)) - group.position.y;   // 地形の上面(陸は最低 0.5。suez.js の地形と同じ)を group の座標で
    const NB = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    const wet = (x, z, m = 9) => NB.some(([a, b]) => ctx.isWater(x + a * m, z + b * m));   // 水か水際の斜面
    const seg = (px, pz, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
    const rects = [], circles = [], lines = [];
    const block = (x0, z0, x1, z1) => rects.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
    const blockC = (x, z, r) => circles.push([x, z, r]);
    const blockLine = (pts, hw) => lines.push([pts, hw]);
    const free = (x, z, pad = 0) => !rects.some(([a, b, c, d]) => x > a - pad && x < c + pad && z > b - pad && z < d + pad) && !circles.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r + pad) && !lines.some(([pts, hw]) => pts.some((p, i) => i > 0 && seg(x, z, pts[i - 1], p) < hw + pad));
    const L = Object.fromEntries(Object.keys(GEO).map((k) => [k, []]));
    // 1 つ置く(s = 大きさ、ry = 向き)。y を省くと地面の高さ
    const put = (kind, x, z, s = 1, ry = rnd() * 6.283, sy = s * (0.85 + rnd() * 0.3), y) => L[kind].push([x, y ?? H(x, z) - 0.15, z, s, sy, s, ry]);
    // 箱形の小物(生け垣・花壇)。sx = 幅、sy = 高さ、sz = 長さ(ry の向き)
    const slab = (kind, x, z, sx, sy, sz, ry = 0, y) => L[kind].push([x, y ?? H(x, z) - 0.1, z, sx, sy, sz, ry]);
    const hedge = (x0, z0, x1, z1, w = 2.4, h = 2.4, kind = "hedge", y) => slab(kind, (x0 + x1) / 2, (z0 + z1) / 2, w, h, Math.hypot(x1 - x0, z1 - z0), Math.atan2(x1 - x0, z1 - z0), y);
    const row = (kind, x0, z0, x1, z1, step, s = 1, test = () => true) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
      for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n; if (test(x, z)) put(kind, x, z, s * (0.9 + rnd() * 0.2)); }
    };
    // 地面の草地: 中心から r0 までは inner の密度、制圧圏の縁へ向けて outer まで上げ、縁の外 r1 まで。登録した範囲・水際・avoid を避ける
    const cover = ({ r0 = 0, r1 = P.r + 22, step = 4.4, inner = 0.05, outer = 0.55, pad = 1.5, avoid = () => false, stones = 0.22, scrub = 0.25 } = {}) => {
      const ph = seed * 0.37;
      for (let x = -r1; x <= r1; x += step) for (let z = -r1; z <= r1; z += step) {
        const jx = x + (rnd() - 0.5) * step, jz = z + (rnd() - 0.5) * step, d = Math.hypot(jx, jz);
        if (d > r1) continue;
        const n = 0.5 + 0.25 * (Math.sin(jx / 37 + ph) + Math.sin(jz / 29 - ph * 1.7)) + 0.15 * Math.sin((jx + jz) / 13 + ph);
        const p = (inner + (outer - inner) * smooth(r0, P.r, d)) * (0.45 + 0.9 * n);
        if (rnd() > p || !free(jx, jz, pad) || wet(jx, jz) || avoid(jx, jz)) continue;
        const q = rnd();
        if (q < 1 - stones - scrub) put(rnd() < 0.6 ? "tuft" : "tuft2", jx, jz, 0.8 + rnd() * 0.6);
        else if (q < 1 - stones) put("scrub", jx, jz, 0.7 + rnd() * 0.6);
        else put(rnd() < 0.5 ? "stone" : "stone2", jx, jz, 0.6 + rnd() * 1.3, rnd() * 6.283, undefined, H(jx, jz) + 0.05);
      }
    };
    const finish = () => {
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3(), tc = new THREE.Color();
      for (const [kind, list] of Object.entries(L)) {
        if (!list.length) continue;
        const side = kind.startsWith("tuft") ? THREE.DoubleSide : THREE.FrontSide;
        const im = new THREE.InstancedMesh(GEO[kind], new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side }), list.length);
        list.forEach(([x, y, z, sx, sy, sz, ry], i) => { mt.compose(v.set(x, y, z), q.setFromAxisAngle(up, ry), sc.set(sx, sy, sz)); im.setMatrixAt(i, mt); im.setColorAt(i, tc.setScalar(0.92 + rnd() * 0.12)); });
        group.add(im);
      }
    };
    const count = () => Object.values(L).reduce((s, l) => s + l.length, 0);
    const inWater = () => Object.values(L).reduce((s, l) => s + l.filter(([x, , z]) => ctx.isWater(x, z)).length, 0);
    return { GEO, L, H, wet, seg, smooth, block, blockC, blockLine, free, put, slab, hedge, row, cover, finish, count, inWater, rnd };
  };
  DreamAssets.maps.site("memorial", (THREE, ctx) => {
    const { U, M } = ctx, { add, box, cyl, V, closedLoft, tube } = ctx.k;
    const accent = M.lambert(0x8f98a3);
    const stone = M.lambert(0xf3f1ec), stone2 = M.lambert(0xe6e1d6), paving = M.lambert(0xe7e1d4), paveD = M.lambert(0xd6cfbf), asphalt = M.lambert(0x8d959c);
    const lawn = M.lambert(0xc9d4bc), gravel = M.lambert(0xddd6c6), bronze = M.lambert(0x6f6a5e), line = M.lambert(0xf2f4f6);
    const group = new THREE.Group(); group.name = "site-memorial";
    const BASE = 0.5; group.position.y = BASE;   // 地形の上面(陸は最低 0.5)に合わせる。以下の y は地面からの高さ
    const G = DreamAssets.maps.siteGround(THREE, ctx, group, 707);
    const placed = [];
    const onLand = (x, z) => { placed.push([x, z]); return !ctx.isWater(x, z); };
    const MX = 90, MZ = -130;   // 塔の位置(道路の北)
    const flat = (w, d, mat, x, z, y = 0.15, h = 0.3) => { onLand(x - w / 2, z - d / 2); onLand(x + w / 2, z + d / 2); return add(box(w, h, d), mat, group, { x, y, z, edges: false }); };

    // ── 地図の道路(拠点の中心を北西から東へ抜ける。suez.js の ROADS のこの拠点の座標)。上に横断歩道、両側に街灯 ──
    const ROAD = [[-350, -400], [0, 0], [950, 150]];
    const roadZ = (x) => (x >= 0 ? (x * 150) / 950 : (x * 400) / 350);
    G.blockLine(ROAD, 15);
    const RY = 0;   // 道路の帯の上面(地形の上面と同じ高さ)
    const along = Math.atan2(950, 150);   // 道路(東の区間)の向き
    for (let x = 74; x <= 106; x += 5.3) add(box(18, 0.12, 2.6), line, group, { x, y: RY + 0.08, z: roadZ(x), ry: along, edges: false });   // 横断歩道の白線

    // ── 基壇(3 段): 砂利の縁、笠石、目地、4 面の大階段 ──
    const TIERS = [[150, 0, 2.5, paving], [112, 2.5, 2.5, stone], [72, 5, 3, stone]];
    flat(176, 176, gravel, MX, MZ, 0.12, 0.24);
    G.block(MX - 90, MZ - 90, MX + 90, MZ + 90);
    for (const [s, y0, h, mat] of TIERS) {
      add(box(s, h, s), mat, group, { x: MX, y: y0 + h / 2, z: MZ });
      onLand(MX - s / 2, MZ - s / 2); onLand(MX + s / 2, MZ + s / 2);
      for (const [dx, dz, w, d] of [[0, -1, s + 0.6, 1.4], [0, 1, s + 0.6, 1.4], [-1, 0, 1.4, s + 0.6], [1, 0, 1.4, s + 0.6]]) add(box(w, 0.45, d), stone2, group, { x: MX + (dx * (s - 1.4)) / 2, y: y0 + h + 0.1, z: MZ + (dz * (s - 1.4)) / 2, edges: false });   // 笠石
      for (let k = -s / 2 + 12; k < s / 2 - 6; k += 12) {   // 目地
        add(box(0.3, 0.1, s - 4), paveD, group, { x: MX + k, y: y0 + h + 0.03, z: MZ, edges: false });
        add(box(s - 4, 0.1, 0.3), paveD, group, { x: MX, y: y0 + h + 0.03, z: MZ + k, edges: false });
      }
    }
    // 踏み段: 面の中心 (cx, cz)、外向き (nx, nz)、幅 w、下の高さ y0、高さ h、段数 n(下の段ほど外へ張り出す)
    const stairs = (cx, cz, nx, nz, w, y0, h, n, t = 1.7) => {
      for (let i = 0; i < n; i++) {
        const d = (n - i) * t, ya = y0 + (h * i) / n, yb = y0 + (h * (i + 1)) / n;
        add(nx !== 0 ? box(d, yb - ya, w) : box(w, yb - ya, d), stone, group, { x: cx + (nx * d) / 2, y: (ya + yb) / 2, z: cz + (nz * d) / 2 });
      }
      for (const s of [-1, 1]) {   // 段の両脇の袖壁
        const L = n * t + 0.6, wx = nx !== 0 ? cx + (nx * L) / 2 : cx + s * (w / 2 + 0.8), wz = nz !== 0 ? cz + (nz * L) / 2 : cz + s * (w / 2 + 0.8);
        add(nx !== 0 ? box(L, h + 0.8, 1.6) : box(1.6, h + 0.8, L), stone2, group, { x: wx + (nx !== 0 ? 0 : 0), y: y0 + (h + 0.8) / 2, z: nx !== 0 ? cz + s * (w / 2 + 0.8) : wz });
      }
    };
    TIERS.forEach(([s, y0, h], i) => {
      const half = s / 2, w = i === 0 ? 34 : i === 1 ? 28 : 22;
      stairs(MX, MZ + half, 0, 1, w, y0, h, i === 2 ? 4 : 3);          // 南(正面)
      stairs(MX, MZ - half, 0, -1, w * 0.6, y0, h, i === 2 ? 4 : 3);   // 北(旗の広場へ)
      for (const s2 of [-1, 1]) stairs(MX + s2 * half, MZ, s2, 0, w * 0.6, y0, h, i === 2 ? 4 : 3);
    });
    // 投光器(基壇の最上段の 4 隅。常灯)と花壇
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(box(1.8, 0.9, 1.8), M.dark, group, { x: MX + sx * 31, y: 8.45, z: MZ + sz * 31, edges: false });
      add(box(1.3, 0.2, 1.3), M.lamp, group, { x: MX + sx * 31, y: 9, z: MZ + sz * 31, edges: false });
      G.slab(sx * sz > 0 ? "bed" : "bed2", MX + sx * 23, MZ + sz * 23, 7, 0.9, 7, 0, 8.05);
    }

    // ── 台座: 腰石、銘板 4 面、軒の帯、正面の青銅の花輪 ──
    add(box(30, 1.4, 30), stone2, group, { x: MX, y: 8.7, z: MZ });
    add(box(26, 8, 26), stone, group, { x: MX, y: 12, z: MZ });
    for (const y of [10, 14]) add(box(26.4, 1, 26.4), M.mid, group, { x: MX, y, z: MZ, edges: false });
    add(box(28.4, 1.2, 28.4), stone2, group, { x: MX, y: 16.1, z: MZ });
    for (const [dx, dz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) add(box(14, 4, 0.4), bronze, group, { x: MX + dx * 13.2, y: 12, z: MZ + dz * 13.2, ry, edges: false });   // 銘板
    add(new THREE.TorusGeometry(3.4, 0.75, 6, 20), bronze, group, { x: MX, y: 12, z: MZ + 13.8, edges: false });   // 花輪

    // ── 銃剣形の塔: 鍔(面取り・端の膨らみ・座金)と、断面がレンズ形の刃(先へ細る。石の継ぎ目の帯、両面の溝) ──
    add(box(46, 6, 12), stone, group, { x: MX, y: 19.7, z: MZ });
    add(box(40, 1.2, 9), stone2, group, { x: MX, y: 23.3, z: MZ });
    for (const s of [-1, 1]) { add(box(6, 9, 13), stone, group, { x: MX + s * 21, y: 21.2, z: MZ }); add(box(6.6, 1, 13.6), stone2, group, { x: MX + s * 21, y: 25.9, z: MZ, edges: false }); }
    const PROF = [[22, 18, 7], [120, 16, 6.2], [150, 13, 5], [166, 6, 2.6], [176, 0.6, 0.4]];
    const wt = (y) => { for (let i = 0; i < PROF.length - 1; i++) { const [ya, wa, ta] = PROF[i], [yb, wb, tb] = PROF[i + 1]; if (y <= yb) { const t = (y - ya) / (yb - ya); return [wa + (wb - wa) * t, ta + (tb - ta) * t]; } } return [0.6, 0.4]; };
    const lens = (y, w, t) => [[w / 2, 0], [w / 4, t / 2], [-w / 4, t / 2], [-w / 2, 0], [-w / 4, -t / 2], [w / 4, -t / 2]].map(([x, z]) => V(MX + x, y, MZ + z));
    add(closedLoft(PROF.map(([y, w, t]) => lens(y, w, t))), stone, group);
    add(closedLoft([lens(23.8, 20.5, 8.6), lens(28, 19.4, 8)]), stone2, group);   // 刃の付け根の座金
    for (let y = 36; y <= 156; y += 12) { const [w, t] = wt(y), [w2, t2] = wt(y + 0.9); add(closedLoft([lens(y, w + 0.5, t + 0.45), lens(y + 0.9, w2 + 0.5, t2 + 0.45)]), stone2, group, { edges: false }); }   // 石の継ぎ目
    for (const s of [-1, 1]) add(box(2.6, 80, 0.5), M.light, group, { x: MX, y: 70, z: MZ + s * 3.3, edges: false });   // 刃の溝(両面)

    // ── 北の旗の広場: 半円の敷石、旗竿 9 本(旗は付けない)、石のベンチの縁、糸杉 ──
    const FZ = MZ - 75;   // 基壇の北の縁
    const half = new THREE.CylinderGeometry(54, 54, 0.4, 28, 1, false, Math.PI / 2, Math.PI);
    add(half, paving, group, { x: MX, y: 0.2, z: FZ, edges: false });
    G.blockC(MX, FZ - 20, 46);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + 0.22 + (i / 8) * (Math.PI - 0.44), x = MX + 44 * Math.sin(a), z = FZ + 44 * Math.cos(a);
      onLand(x, z);
      add(box(2.4, 1, 2.4), stone2, group, { x, y: 0.9, z, edges: false });
      tube(group, V(x, 1.4, z), V(x, 44, z), 0.35, M.mid);
      add(new THREE.SphereGeometry(0.8, 8, 6), M.light, group, { x, y: 44.6, z, edges: false });
    }
    for (let i = 0; i < 7; i++) { const a = Math.PI / 2 + 0.3 + (i / 6) * (Math.PI - 0.6), a2 = a + 0.2; add(box(1.6, 1.2, 50 * 0.21), stone2, group, { x: MX + 51 * Math.sin((a + a2) / 2), y: 0.8, z: FZ + 51 * Math.cos((a + a2) / 2), ry: (a + a2) / 2 + Math.PI / 2 }); }   // 半円の縁の腰掛け
    for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + 0.12 + (i / 12) * (Math.PI - 0.24); G.put("cypress", MX + 62 * Math.sin(a), FZ + 62 * Math.cos(a), 0.95); }

    // ── 記念館(西。低い棟、柱廊、深い庇、天窓、南の階段)と塔への小道 ──
    const RX = MX - 110, RZ = MZ;
    onLand(RX - 26, RZ - 18); onLand(RX + 26, RZ + 18);
    G.block(RX - 34, RZ - 26, RX + 34, RZ + 30);
    add(box(56, 1.2, 40), stone2, group, { x: RX, y: 0.6, z: RZ });
    add(box(52, 9, 36), M.body, group, { x: RX, y: 5.7, z: RZ });
    add(box(52.4, 3, 36.4), M.glass, group, { x: RX, y: 5.2, z: RZ, edges: false });
    add(box(60, 1.4, 44), M.light, group, { x: RX, y: 10.9, z: RZ });
    add(box(30, 1.2, 4), M.glass, group, { x: RX, y: 12.2, z: RZ - 6, edges: false });   // 天窓
    for (let x = -27; x <= 27; x += 6) add(box(1.2, 9.6, 1.2), M.light, group, { x: RX + x, y: 6, z: RZ + 21 });
    stairs(RX, RZ + 20, 0, 1, 20, 0, 1.2, 2, 1.6);
    flat(36, 14, paving, RX + 46, RZ + 6, 0.2);
    for (const [x, z] of [[-30, 32], [-12, 34], [12, 34], [30, 32]]) G.put("shade", RX + x, RZ + z, 0.95);

    // ── 前庭(基壇の南、道路の北): 敷石の帯、石柱の列、花壇、低い石垣(道路沿い、参道の所だけ開ける) ──
    flat(80, 40, paving, MX, -30, 0.2);
    G.block(MX - 42, -52, MX + 42, -8);
    for (let k = -36; k <= 36; k += 9) add(box(0.4, 0.1, 38), paveD, group, { x: MX + k, y: 0.36, z: -30, edges: false });
    for (let z = -16; z >= -44; z -= 9.5) for (const s of [-1, 1]) add(box(3, 9, 3), stone, group, { x: MX + s * 19, y: 4.5, z });
    for (const s of [-1, 1]) { G.slab("bed", MX + s * 32, -38, 10, 0.9, 8); G.slab("bed2", MX + s * 32, -22, 10, 0.9, 8); }
    const wallAlong = (x0, x1, off, h = 1.4) => { const z0 = roadZ(x0) + off, z1 = roadZ(x1) + off, l = Math.hypot(x1 - x0, z1 - z0); add(box(1.4, h, l), stone2, group, { x: (x0 + x1) / 2, y: h / 2, z: (z0 + z1) / 2, ry: Math.atan2(x1 - x0, z1 - z0) }); };
    wallAlong(20, 48, -17); wallAlong(132, 180, -17);   // 北側(通用口の手前まで)
    wallAlong(10, 62, 18); wallAlong(118, 180, 18);     // 南側

    // ── 南の参道: 到着の広場 → 糸杉の並木と水盤 → 横断歩道。両側の芝、街灯、腰掛け ──
    const AZ0 = 34, AZ1 = 250;
    flat(48, AZ1 - AZ0, paving, MX, (AZ0 + AZ1) / 2, 0.2);
    G.block(MX - 26, AZ0 - 4, MX + 26, AZ1 + 4);
    add(box(20, 1.1, 172), stone2, group, { x: MX, y: 0.55, z: 141 });   // 水盤の縁
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(18, 170).rotateX(-Math.PI / 2), U.waterMaterial(THREE, { opacity: 0.5 }));
    pool.position.set(MX, 1.2, 141); group.add(pool);
    for (let z = 66; z <= 216; z += 50) add(box(4, 1.6, 4), stone, group, { x: MX, y: 1.6, z });   // 水盤の中の台
    for (const s of [-1, 1]) {
      flat(30, AZ1 - AZ0, lawn, MX + s * 39, (AZ0 + AZ1) / 2, 0.18);
      G.block(MX + s * 39 - 15, AZ0 - 2, MX + s * 39 + 15, AZ1 + 2);
      G.row("cypress", MX + s * 30, AZ0 + 8, MX + s * 30, AZ1 - 4, 12, 1.0);
      G.row("cypress", MX + s * 48, AZ0 + 14, MX + s * 48, AZ1 - 10, 16, 0.85);
      add(box(0.6, 0.15, AZ1 - AZ0), M.dark, group, { x: MX + s * 24.3, y: 0.36, z: (AZ0 + AZ1) / 2, edges: false });   // 側溝
      for (let z = AZ0 + 16; z <= AZ1 - 10; z += 24) {
        add(cyl(0.3, 7, 6), M.dark, group, { x: MX + s * 21, y: 3.5, z, edges: false });
        add(box(1.2, 0.5, 1.2), M.lamp, group, { x: MX + s * 21, y: 7.2, z, edges: false });
        add(box(2, 1, 6), stone2, group, { x: MX + s * 14.5, y: 0.7, z: z + 12 });   // 腰掛け
      }
    }
    flat(84, 26, paving, MX, AZ1 + 13, 0.2);   // 到着の広場
    G.block(MX - 44, AZ1, MX + 44, AZ1 + 28);
    add(box(84, 1.4, 1.4), stone2, group, { x: MX, y: 0.7, z: AZ1 + 26 });
    for (const s of [-1, 1]) { add(box(1.4, 1.4, 26), stone2, group, { x: MX + s * 42, y: 0.7, z: AZ1 + 13 }); add(box(6, 6, 6), stone, group, { x: MX + s * 34, y: 3, z: AZ1 + 20 }); }

    // ── 南西の追悼の庭(芝、小道、木立、腰掛け)と南東の芝 ──
    const lawnRect = (x0, z0, x1, z1) => { flat(x1 - x0, z1 - z0, lawn, (x0 + x1) / 2, (z0 + z1) / 2, 0.18); G.block(x0, z0, x1, z1); };
    lawnRect(-150, 52, 22, 226);
    const path = (pts, w) => { for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.hypot(bx - ax, bz - az); add(box(w, 0.2, l + w), gravel, group, { x: (ax + bx) / 2, y: 0.42, z: (az + bz) / 2, ry: Math.atan2(bx - ax, bz - az), edges: false }); } };
    path([[22, 140], [-20, 120], [-60, 150], [-100, 120], [-140, 140]], 5);
    path([[-60, 150], [-50, 210]], 4); path([[-100, 120], [-110, 64]], 4);
    for (const [cx, cz, n] of [[-120, 80, 7], [-30, 80, 6], [-80, 196, 7], [0, 200, 5], [-130, 196, 4]]) for (let i = 0; i < n; i++) { const a = G.rnd() * 6.28, d = 6 + G.rnd() * 16; G.put("shade", cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.8 + G.rnd() * 0.4); }
    for (const [x, z, ry] of [[-20, 128, 0.4], [-60, 158, 0], [-100, 128, -0.4], [-50, 205, 1.57]]) add(box(6, 1, 2), stone2, group, { x, y: 0.9, z, ry });
    lawnRect(160, 60, 236, 168);
    for (let i = 0; i < 9; i++) G.put("shade", 166 + G.rnd() * 64, 66 + G.rnd() * 96, 0.8 + G.rnd() * 0.35);

    // ── 東の整形庭園(芝の区画、生け垣の縁、花壇、中央の小さな水盤) ──
    const GX = [176, 212, 218, 252], GZ = [-176, -142, -134, -100];
    for (const [x0, x1] of [[GX[0], GX[1]], [GX[2], GX[3]]]) for (const [z0, z1] of [[GZ[0], GZ[1]], [GZ[2], GZ[3]]]) {
      lawnRect(x0, z0, x1, z1);
      G.hedge(x0, z0, x1, z0, 1.8, 1.6); G.hedge(x0, z1, x1, z1, 1.8, 1.6); G.hedge(x0, z0, x0, z1, 1.8, 1.6); G.hedge(x1, z0, x1, z1, 1.8, 1.6);
      G.slab("bed", (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 - 12, 0.9, 6);
    }
    flat(84, 84, gravel, 214, -138, 0.1, 0.2);
    add(cyl(4.6, 1.2, 16), stone2, group, { x: 215, y: 0.6, z: -138 });
    const pool2 = new THREE.Mesh(new THREE.CircleGeometry(3.8, 16).rotateX(-Math.PI / 2), pool.material); pool2.position.set(215, 1.3, -138); group.add(pool2);

    // ── 東の通用口: 管理所(チーム色の帯)と遮断機、通用路、駐車場と太陽光の屋根・充電柱(近未来化) ──
    const SX = 218;
    flat(16, 58, asphalt, SX, -6, 0.2);   // 通用路(道路から駐車場へ)
    G.block(SX - 9, -36, SX + 9, 24);
    onLand(SX - 22, 0);
    add(box(16, 7, 10), M.body, group, { x: SX - 22, y: 3.5, z: 0 });
    add(box(16.4, 1.4, 10.4), accent, group, { x: SX - 22, y: 6.2, z: 0, edges: false });
    add(box(16.6, 1.6, 7), M.glass, group, { x: SX - 22, y: 4, z: 0, edges: false });
    G.block(SX - 31, -6, SX - 13, 6);
    add(box(1.2, 3, 1.2), M.mid, group, { x: SX - 9, y: 1.5, z: 8 });
    add(box(16, 0.6, 0.6), M.dark, group, { x: SX - 1, y: 3, z: 8, edges: false });
    const PX = 236, PZ = -60;
    flat(72, 52, asphalt, PX, PZ, 0.25, 0.5);
    G.block(PX - 37, PZ - 27, PX + 37, PZ + 27);
    for (let x = PX - 32; x <= PX + 32; x += 8) for (const z of [PZ - 18, PZ + 4]) add(box(0.35, 0.1, 9), line, group, { x, y: 0.55, z, edges: false });   // 駐車の白線
    for (const z of [PZ - 16, PZ + 16]) {
      for (const x of [PX - 28, PX, PX + 28]) add(box(1.2, 6, 1.2), M.mid, group, { x, y: 3, z });
      add(box(64, 0.8, 14), M.glass, group, { x: PX, y: 7, z, rx: 0.15 });
      add(box(64, 0.4, 1), M.light, group, { x: PX, y: 6.2, z: z + 6.6, edges: false });
      for (const x of [PX - 24, PX - 4, PX + 16]) add(box(1.2, 2.4, 0.8), accent, group, { x, y: 1.2, z: z + 8, edges: false });   // 充電柱
    }
    G.row("shade", PX - 34, PZ + 32, PX + 30, PZ + 32, 13, 0.8, (x, z) => G.free(x, z, 3));

    // ── 境内の北の木の帯(半径 262 の弧)、道路沿いの並木 ──
    for (let a = -2.7; a <= -0.35; a += 0.055) { const x = 262 * Math.cos(a) + (G.rnd() - 0.5) * 6, z = 262 * Math.sin(a) + (G.rnd() - 0.5) * 6; if (G.free(x, z, 4) && !ctx.isWater(x, z)) G.put(G.rnd() < 0.7 ? "shade" : "cypress", x, z, 0.85 + G.rnd() * 0.3); }
    for (const s of [-1, 1]) for (let x = 0; x <= 280; x += 15) { if (Math.abs(x - 90) < 34 || Math.abs(x - SX) < 16) continue; const z = roadZ(x) + s * 23; if (G.free(x, z, 3)) G.put("shade", x, z, 0.8); }

    // ── 道路沿いの街灯(中心から 21 外、40 ごと。横断歩道と通用口の所は省く) ──
    for (let i = 1; i < ROAD.length; i++) {
      const [ax, az] = ROAD[i - 1], [bx, bz] = ROAD[i], l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l;
      for (let t = 20; t < l; t += 40) for (const s of [-1, 1]) {
        const x = ax + ux * t - s * uz * 21, z = az + uz * t + s * ux * 21;
        if (Math.hypot(x, z) > ctx.point.r + 10 || Math.abs(x - MX) < 30 || Math.abs(x - SX) < 16 || !G.free(x, z, 1)) continue;
        onLand(x, z);
        add(cyl(0.35, 10, 6), M.dark, group, { x, y: 5, z, edges: false });
        add(box(0.9, 0.5, 3.2), M.dark, group, { x: x + s * uz * 1.2, y: 10, z: z - s * ux * 1.2, ry: Math.atan2(ux, uz) + Math.PI / 2, edges: false });
        add(box(0.7, 0.25, 2.4), M.lamp, group, { x: x + s * uz * 1.4, y: 9.7, z: z - s * ux * 1.4, ry: Math.atan2(ux, uz) + Math.PI / 2, edges: false });
      }
    }

    // ── 縁の草地(砂漠へなじませる。境内の中はまばら) ──
    G.cover({ r0: 200, inner: 0.04, outer: 0.6 });
    G.finish();

    U.bake(THREE, group, { live: [accent], also: [M.lamp] });
    return {
      group,
      setTeam: (c) => accent.color.set(c ?? 0x8f98a3),
      check: () => ({ landPartsInWater: placed.filter(([x, z]) => ctx.isWater(x, z)).length, towerTop: 176, plazaTop: 8, groundItems: G.count(), groundItemsInWater: G.inWater() }),
    };
  });
})();
