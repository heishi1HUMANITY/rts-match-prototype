// 拠点 3「運河トンネル」(マップ「運河地帯」)。大運河と新運河の下をくぐる道路トンネル(2 本の管。地名は架空)。
// 中州の中央に料金所と換気・管制棟、中州の両端に坑口(開口は中州の中央を向き、管は外へ運河の下をくぐる)、両岸にも坑口。
// 坑口は地上の構造(額壁・日よけのルーバー・U 字の擁壁と翼壁)で見せる(地図の陸は掘れないので、掘割は擁壁と暗い路面で表す)。
// 運河の下の管はシールドの継ぎ目の輪を付け、川底に半分埋めて水越しに見せる(実物はもっと深い。見せるための嘘)。
// 中州の制圧圏の中: 道路の路肩・縁石・照明柱・標識の門型・緩衝材、救助の詰所(車庫)、職員の駐車場、変電所の柵、保守の道、
//   中州の縁のモクマオウの防風林と警備の柵、芝の法面と排水の溝、縁は草地へなじませる。
// 縮尺 0.6 単位/m。誇張: 管の直径 2.5 倍(約 16 単位)、坑口の額壁と換気塔 2 倍。近未来化: 料金所の手前のセンサーの門型(止まらずに課金)、管制棟の屋上の箱形レーダー。
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
  DreamAssets.maps.site("tunnel", (THREE, ctx) => {
    const { U, M } = ctx, { add, box, cyl, V, tube } = ctx.k;
    const accent = M.lambert(0x8f98a3);
    const asphalt = M.lambert(0x6b737b), lane = M.lambert(0xf2f4f6), kerb = M.lambert(0xd9dde1), grass = M.lambert(0xd3dbc8), gravel = M.lambert(0xdcdcd4), sign = M.lambert(0x3e6b58), cushion = M.lambert(0xe2c25a);
    const group = new THREE.Group(); group.name = "site-tunnel";
    const BASE = 0.5; group.position.y = BASE;   // 地形の上面(陸は最低 0.5)に合わせる。以下の y は地面からの高さ
    const G = DreamAssets.maps.siteGround(THREE, ctx, group, 303);
    const TZ = [-17, 17], TR = 8;          // 2 本の管の z と半径
    const ISL = 120, BANK = 280;            // 中州の半幅(旧運河 x < -120、新運河 x > 120)、対岸の岸(|x| > 280)
    const IE = ISL - 12;                    // 中州の陸の使える半幅(水際の斜面を避ける)
    const placed = [];                       // 確認用: 陸に置いた部品の足元
    const onLand = (x, z) => { placed.push([x, z]); return !ctx.isWater(x, z); };
    const flat = (w, d, mat, x, z, y = 0.15, h = 0.3) => { onLand(x - w / 2, z - d / 2); onLand(x + w / 2, z + d / 2); return add(box(w, h, d), mat, group, { x, y, z, edges: false }); };

    // ── 路面(中州を東西に横切る 4 車線 × 2)、区画線、縁石と路肩、中央分離帯 ──
    add(box(2 * ISL - 6, 0.3, 64), asphalt, group, { y: 0.15, edges: false });
    G.block(-ISL, -40, ISL, 40);
    for (const z of [-24.5, -17, -9.5, 9.5, 17, 24.5]) for (let x = -105; x <= 105; x += 18) add(box(9, 0.1, 0.6), lane, group, { x, y: 0.35, z, edges: false });   // 車線の破線
    for (const z of [-30.5, -2.6, 2.6, 30.5]) add(box(2 * ISL - 10, 0.1, 0.5), lane, group, { y: 0.35, z, edges: false });                           // 車道の縁の実線
    add(box(2 * ISL - 6, 0.35, 2.2), M.light, group, { y: 0.4, edges: false });   // 中央分離帯
    add(box(108, 1.6, 0.9), M.light, group, { y: 1.2, z: 0, edges: false });     // 分離帯の防護柵(坑口の間)
    for (const s of [-1, 1]) {
      add(box(2 * ISL - 6, 0.5, 1.2), kerb, group, { y: 0.5, z: s * 32.6, edges: false });   // 縁石
      flat(2 * ISL - 20, 6, gravel, 0, s * 36.2, 0.12, 0.24);                                  // 路肩
    }
    for (const x of [-47, 47]) for (const s of [-1, 1]) {   // 坑口の手前の分離帯の先の緩衝材
      add(box(5, 1.6, 2), cushion, group, { x: x + Math.sign(x) * 6, y: 1, z: 0, edges: false });
      for (const d of [-1.4, 0, 1.4]) add(box(0.4, 1.7, 2.1), M.dark, group, { x: x + Math.sign(x) * 6 + d, y: 1, z: 0, edges: false });
      void s;
    }

    // ── 坑口: 額壁(2 つの開口、パネルの目地、非常口、車線の信号)、細かいルーバーの日よけ、U 字の擁壁と翼壁 ──
    // dir = 開口が向く方向(+1 = +x)。x0 = 額壁の位置
    const archG = new THREE.CylinderGeometry(7.5, 7.5, 6.4, 16, 1, false, 0, Math.PI); archG.rotateZ(Math.PI / 2);   // 軸を x に、半円を上に
    const portal = (x0, dir, len) => {
      const g = new THREE.Group(); g.position.x = x0; group.add(g);
      const H = 22, W = 72;
      add(box(6, H, W), M.light, g, { x: -dir * 3, y: H / 2 });                    // 額壁
      add(box(7, 2.4, W + 2), M.mid, g, { x: -dir * 3, y: H + 1.2 });              // 笠木
      for (let z = -W / 2 + 6; z <= W / 2 - 6; z += 6) add(box(0.3, H - 3, 0.3), M.mid, g, { x: dir * 0.1, y: (H - 3) / 2, z, edges: false });   // パネルの目地
      for (const z of TZ) {   // 開口(暗い奥): 下は四角、上は半円のアーチ。上に車線の信号
        add(box(6.4, 10, 15), M.dark, g, { x: -dir * 3 + dir * 0.4, y: 5, z, edges: false });
        add(archG, M.dark, g, { x: -dir * 3 + dir * 0.4, y: 10, z, edges: false });
        add(box(1.6, 1.4, 16.4), M.mid, g, { x: dir * 0.8, y: 0.7, z, edges: false });   // 開口の足元の縁
        for (const dz of [-4, 0, 4]) { add(box(1.2, 1.8, 2.4), M.dark, g, { x: dir * 0.7, y: 19, z: z + dz, edges: false }); add(box(0.2, 1.1, 1.6), dz === 0 ? M.lamp : M.light, g, { x: dir * 1.35, y: 19, z: z + dz, edges: false }); }
      }
      add(box(0.4, 4.2, 2.8), M.dark, g, { x: dir * 0.2, y: 2.1, z: 0, edges: false });   // 非常口(分離帯の所)
      add(box(7, 3, W + 4), accent, g, { x: -dir * 3, y: H - 6.5, edges: false });    // チーム色の帯
      // 日よけ: 細いルーバーの羽根を並べた屋根(坑口の明るさを和らげる実在の設備)。2 本の受け梁と柱
      for (let i = 0; i < 26; i++) add(box(0.6, 2.2, W - 6), M.body, g, { x: dir * (3.4 + i * 1.3), y: 15, z: 0, edges: false });
      for (const z of [-W / 2 + 4, W / 2 - 4]) add(box(len * 0.55, 1.6, 1.6), M.light, g, { x: dir * (len * 0.275 + 2), y: 16.6, z });
      for (const z of [-W / 2 + 4, W / 2 - 4]) for (const x of [12, 24, 36]) add(box(1.6, 15, 1.6), M.light, g, { x: dir * x, y: 7.5, z });
      // U 字の擁壁(掘割の両側の壁)、笠木、目地、足元の排水の溝、先の翼壁
      for (const s of [-1, 1]) {
        const z = s * (W / 2 - 1);
        add(box(len, 4.5, 2.6), M.mid, g, { x: (dir * len) / 2, y: 2.25, z });
        add(box(len, 0.5, 3.2), M.light, g, { x: (dir * len) / 2, y: 4.7, z, edges: false });
        for (let x = 8; x < len; x += 8) add(box(0.25, 4.4, 2.7), M.light, g, { x: dir * x, y: 2.2, z, edges: false });
        add(box(len, 0.2, 1.2), M.dark, g, { x: (dir * len) / 2, y: 0.36, z: z - s * 2.2, edges: false });
        add(box(16, 3.2, 2.2), M.mid, g, { x: dir * (len + 6.5), y: 1.6, z: z + s * 3, ry: s * dir * 0.45 });   // 翼壁
      }
      return g;
    };
    portal(-ISL + 14, 1, 52);          // 中州の西の坑口(開口は東 = 中州の中央を向く。管は旧運河の下へ)
    portal(ISL - 14, -1, 52);          // 中州の東の坑口(管は新運河の下へ)
    portal(-BANK - 18, -1, 70);        // 西岸の坑口(開口は西の取付け道路を向く)
    portal(BANK + 18, 1, 70);          // 東岸の坑口
    // 両岸の取付け道路(地図の道路へつなぐ)。区画線、縁石、照明柱
    for (const s of [-1, 1]) {
      const x0 = s * (BANK + 18), x1 = s * 500, cx = (x0 + x1) / 2, w = Math.abs(x1 - x0);
      add(box(w, 0.3, 64), asphalt, group, { x: cx, y: 0.15, edges: false });
      for (const z of [-17, 17]) for (let x = Math.min(x0, x1) + 6; x < Math.max(x0, x1) - 6; x += 18) add(box(9, 0.1, 0.6), lane, group, { x, y: 0.35, z, edges: false });
      add(box(w, 0.35, 2.2), M.light, group, { x: cx, y: 0.4, edges: false });
      for (const zz of [-32.6, 32.6]) add(box(w, 0.5, 1.2), kerb, group, { x: cx, y: 0.5, z: zz, edges: false });
      onLand(x0 + s * 30, 0); onLand(x1, 0);
      G.block(Math.min(x0, x1) - 4, -40, Math.max(x0, x1) + 4, 40);
      G.block(Math.min(x0, x0 + s * 90), -42, Math.max(x0, x0 + s * 90), 42);
    }

    // ── 料金所(中州の中央): 屋根(縁の帯・リブ)、柱、ブースの島(縁石・防護柱・車線の信号)、近未来化のセンサーの門型 ──
    add(box(30, 1.6, 80), M.body, group, { y: 14 });
    add(box(30.4, 1.4, 80.4), accent, group, { y: 12.6, edges: false });
    for (let z = -36; z <= 36; z += 6) add(box(30.6, 0.6, 0.6), M.light, group, { y: 15, z, edges: false });   // 屋根の上のリブ
    for (const z of [-34, 34]) for (const x of [-12, 12]) add(box(1.8, 12, 1.8), M.light, group, { x, y: 6, z });
    for (const zc of [-24.5, -17, -9.5, 9.5, 17, 24.5]) {   // ブースの島は車線の境に
      add(box(16, 0.6, 3.4), kerb, group, { y: 0.6, z: zc, edges: false });                // 島の縁石
      add(box(4, 5, 2.8), M.light, group, { y: 3.1, z: zc });
      add(box(4.2, 1.2, 3), M.glass, group, { y: 4.4, z: zc, edges: false });
      for (const x of [-7, 7]) add(cyl(0.5, 1.8, 6), cushion, group, { x, y: 1.6, z: zc, edges: false });   // 防護柱
      add(box(0.6, 0.6, 0.6), M.lamp, group, { x: -2.6, y: 11.8, z: zc, edges: false });   // 車線の信号(常灯)
    }
    for (const x of [-30, 30]) {   // センサーの門型(止まらずに課金。箱形のカメラの覆い)
      for (const z of [-34, 34]) add(box(1.6, 13, 1.6), M.mid, group, { x, y: 6.5, z });
      add(box(2, 2, 70), M.light, group, { x, y: 13, z: 0 });
      for (const z of [-22, -11, 11, 22]) add(box(2.2, 1.6, 2.2), M.dark, group, { x, y: 11.4, z, edges: false });
    }
    // 標識の門型(坑口の手前。車線ごとの案内板と信号。文字は入れない)
    for (const x of [-50, 50]) {
      for (const z of [-35, 35]) add(box(1.4, 15, 1.4), M.mid, group, { x, y: 7.5, z });
      add(box(1.6, 1.6, 72), M.light, group, { x, y: 14.4, z: 0 });
      for (const z of [-21, 21]) add(box(0.6, 5, 16), sign, group, { x: x - Math.sign(x) * 1.2, y: 16.4, z, edges: false });
      for (const z of [-24.5, -17, -9.5, 9.5, 17, 24.5]) add(box(0.6, 1.2, 1.2), M.lamp, group, { x: x - Math.sign(x) * 1.2, y: 12.6, z, edges: false });
    }
    // 道路の照明柱(両側。二又の腕)
    for (const s of [-1, 1]) for (let x = -84; x <= 84; x += 24) {
      if (Math.abs(x) < 20) continue;
      const z = s * 39;
      add(cyl(0.45, 16, 6), M.dark, group, { x, y: 8, z, edges: false });
      add(box(0.6, 0.5, 9), M.dark, group, { x, y: 16, z: z - s * 4, edges: false });
      add(box(1.4, 0.4, 2.4), M.lamp, group, { x, y: 15.7, z: z - s * 8, edges: false });
    }

    // ── 換気・管制棟(道路の北)。ルーバーの帯、屋上の送風機、パラペット、入口、階段塔。換気塔 2 本(羽根板の排気口)と屋上の箱形レーダー ──
    onLand(0, -90); onLand(-45, -110); onLand(45, -70);
    G.block(-48, -122, 48, -66);
    add(box(84, 18, 40), M.body, group, { y: 9, z: -92 });
    add(box(84.4, 2.4, 40.4), M.glass, group, { y: 11, z: -92, edges: false });
    for (let x = -38; x <= 38; x += 4) add(box(2.4, 5, 0.4), M.mid, group, { x, y: 4.2, z: -71.8, edges: false });   // 1 階の給気のルーバー
    add(box(86, 2, 42), M.light, group, { y: 19, z: -92 });
    add(box(84.6, 1.6, 40.6), accent, group, { y: 16.6, z: -92, edges: false });
    for (const [w, d, x, z] of [[86, 0.8, 0, -71.4], [86, 0.8, 0, -112.6], [0.8, 42, -42.6, -92], [0.8, 42, 42.6, -92]]) add(box(w, 1.6, d), M.light, group, { x, y: 20.8, z, edges: false });   // パラペット
    for (const x of [-10, 4, 12]) { add(cyl(2.6, 2.4, 12), M.mid, group, { x, y: 21.2, z: -80 }); add(cyl(2.2, 0.3, 12), M.dark, group, { x, y: 22.5, z: -80, edges: false }); }   // 屋上の送風機
    add(box(12, 1, 6), M.light, group, { x: -14, y: 6.5, z: -69 });   // 入口のひさし
    add(box(5, 5.6, 0.4), M.glass, group, { x: -14, y: 2.8, z: -71.8, edges: false });
    add(box(8, 24, 8), M.light, group, { x: 40, y: 12, z: -110 });     // 階段塔
    for (const x of [-26, 26]) {
      add(box(14, 46, 14), M.light, group, { x, y: 23, z: -100 });
      add(box(13, 10, 13), M.dark, group, { x, y: 42, z: -100, edges: false });   // 排気口の奥
      for (const y of [37.6, 39.8, 42, 44.2]) add(box(15.2, 0.7, 15.2), M.light, group, { x, y, z: -100, edges: false });   // 羽根板
      add(box(16, 1.6, 16), M.mid, group, { x, y: 46.8, z: -100 });
      for (const [dx, dz] of [[-6.3, -6.3], [6.3, -6.3], [-6.3, 6.3], [6.3, 6.3]]) add(box(1.4, 36, 1.4), M.body, group, { x: x + dx, y: 18, z: -100 + dz, edges: false });   // 角の柱形
    }
    add(box(10, 5, 5), M.body, group, { x: 0, y: 22.5, z: -86 });
    add(box(4, 3, 0.4), M.glass, group, { x: 0, y: 23, z: -83.4, edges: false });
    tube(group, V(8, 20, -100), V(8, 34, -100), 0.4, M.dark);
    // 換気・管制棟と坑口をつなぐ路面と職員の駐車場(白線)
    flat(60, 30, asphalt, 0, -54, 0.15, 0.3);
    G.block(-32, -70, 32, -38);
    for (let x = -26; x <= 26; x += 6.5) add(box(0.35, 0.1, 9), lane, group, { x, y: 0.35, z: -60, edges: false });

    // ── 変電設備(道路の南)。砂利の敷地、変圧器(放熱器)、碍子、柵 4 辺 ──
    onLand(0, 80); onLand(-40, 95); onLand(40, 95);
    G.block(-38, 70, 38, 114);
    add(box(70, 0.3, 40), M.mid, group, { y: 0.15, z: 92, edges: false });
    for (const x of [-20, 0, 20]) {
      add(box(8, 7, 6), M.mid, group, { x, y: 3.5, z: 92 });
      for (const s of [-1, 1]) for (let k = -2; k <= 2; k++) add(box(0.3, 5, 1.4), M.light, group, { x: x + k * 1.6, y: 3.4, z: 92 + s * 3.6, edges: false });   // 放熱器
      for (const d of [-2.4, 0, 2.4]) add(cyl(0.4, 4, 6), M.light, group, { x: x + d, y: 9, z: 92 });
    }
    for (const z of [72, 112]) add(box(74, 2.4, 0.4), M.dark, group, { y: 1.2, z, edges: false });
    for (const x of [-37, 37]) add(box(0.4, 2.4, 40), M.dark, group, { x, y: 1.2, z: 92, edges: false });

    // ── 救助の詰所(道路の南西。車庫 3 つの暗い扉、前の舗装、屋上の通信の柱)と保管庫(北西) ──
    G.block(-104, 44, -50, 98);
    add(box(44, 12, 26), M.body, group, { x: -78, y: 6, z: 82 });
    for (const x of [-92, -78, -64]) add(box(10, 8, 0.4), M.dark, group, { x, y: 4, z: 68.8, edges: false });
    add(box(44.4, 1.4, 26.4), accent, group, { x: -78, y: 11, z: 82, edges: false });
    add(box(46, 1, 28), M.light, group, { x: -78, y: 12.5, z: 82 });
    tube(group, V(-62, 13, 90), V(-62, 26, 90), 0.3, M.dark);
    flat(44, 18, asphalt, -78, 61, 0.15, 0.3);
    G.block(-104, -102, -64, -72);
    add(box(30, 7, 22), M.light, group, { x: -84, y: 3.5, z: -87 });
    add(new THREE.CylinderGeometry(11, 11, 30, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.45, 1), M.mid, group, { x: -84, y: 7, z: -87 });   // かまぼこ屋根

    // ── 中州の地面: 道路沿いの芝の法面、排水の溝、保守の砂利道、縁の警備の柵とモクマオウの防風林 ──
    for (const s of [-1, 1]) {
      flat(2 * IE - 10, 10, grass, 0, s * 45.5, 0.08, 0.16);
      add(box(2 * IE - 10, 0.15, 1.2), M.dark, group, { y: 0.36, z: s * 51, edges: false });   // 排水の溝
      G.block(-IE, s > 0 ? 39 : -53, IE, s > 0 ? 53 : -39);
    }
    for (const s of [-1, 1]) {   // 中州の東西の縁に沿う保守の道と柵(制圧圏の中)
      const x = s * (IE - 14);
      for (const [z0, z1] of [[54, 280], [-280, -54]]) {
        const lz = z1 - z0, cz = (z0 + z1) / 2;
        flat(7, lz, gravel, x, cz, 0.12, 0.24);
        G.block(x - 4, z0, x + 4, z1);
        const fx = s * (IE - 2);
        add(box(0.25, 0.25, lz), M.dark, group, { x: fx, y: 2.2, z: cz, edges: false });
        add(box(0.25, 0.25, lz), M.dark, group, { x: fx, y: 1.1, z: cz, edges: false });
        for (let z = z0; z <= z1; z += 8) add(box(0.35, 2.6, 0.35), M.dark, group, { x: fx, y: 1.3, z, edges: false });
        for (let z = z0 + 4; z <= z1; z += 7) { const tx = s * (IE - 7) + (G.rnd() - 0.5) * 2; if (G.free(tx, z, 1) && Math.hypot(tx, z) < 300) G.put("cas", tx, z, 0.9 + G.rnd() * 0.25); }
      }
    }
    // ── 北: 保守の基地(柵の中の作業棟・資材の山・燃料タンク・給水塔)。南: 排水の調整池(石積みの縁)と排水ポンプ棟 ──
    const yard = { x0: -70, x1: 70, z0: -232, z1: -146 };
    flat(yard.x1 - yard.x0, yard.z1 - yard.z0, gravel, 0, (yard.z0 + yard.z1) / 2, 0.12, 0.24);
    G.block(yard.x0 - 3, yard.z0 - 3, yard.x1 + 3, yard.z1 + 3);
    for (const [w, d, x, z] of [[yard.x1 - yard.x0, 0.3, 0, yard.z0], [yard.x1 - yard.x0, 0.3, 0, yard.z1], [0.3, yard.z1 - yard.z0, yard.x0, (yard.z0 + yard.z1) / 2], [0.3, yard.z1 - yard.z0, yard.x1, (yard.z0 + yard.z1) / 2]]) {
      add(box(w, 0.25, d), M.dark, group, { x, y: 2.4, z, edges: false });
      const n = Math.round(Math.max(w, d) / 8); for (let i = 0; i <= n; i++) add(box(0.35, 2.6, 0.35), M.dark, group, { x: w > d ? x - w / 2 + (w * i) / n : x, y: 1.3, z: w > d ? z : z - d / 2 + (d * i) / n, edges: false });
    }
    add(box(44, 12, 22), M.light, group, { x: -28, y: 6, z: -212 });                                   // 作業棟(切妻)
    add(new THREE.CylinderGeometry(12.5, 12.5, 44, 3, 1).rotateZ(Math.PI / 2).rotateX(Math.PI / 6).scale(1, 0.42, 0.95), M.mid, group, { x: -28, y: 14.6, z: -212 });
    for (const x of [-42, -28, -14]) add(box(9, 8, 0.4), M.dark, group, { x, y: 4, z: -200.8, edges: false });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (let k = 0; k <= (i + j) % 3; k++) add(box(5, 2.4, 5), M.mid, group, { x: 14 + i * 7, y: 1.2 + k * 2.5, z: -222 + j * 7, edges: false });   // 護岸ブロックの山
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4 - k; i++) add(cyl(1.6, 16, 10).rotateZ(Math.PI / 2), M.steel, group, { x: 30, y: 1.6 + k * 2.8, z: -186 + i * 3.4 + k * 1.7, edges: false });   // 管の山
    add(new THREE.CylinderGeometry(5, 5, 7, 14).rotateZ(Math.PI / 2), M.body, group, { x: 52, y: 5, z: -168 });   // 燃料タンク(横置き)
    for (const d of [-2.4, 2.4]) add(box(1, 2.6, 9), M.dark, group, { x: 52 + d, y: 1.3, z: -168, edges: false });
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) add(box(0.8, 22, 0.8), M.mid, group, { x: -58 + dx, y: 11, z: -160 + dz, edges: false });   // 給水塔
    add(cyl(5.6, 7, 12), M.body, group, { x: -58, y: 25.5, z: -160 });
    add(new THREE.ConeGeometry(6, 2.6, 12), M.mid, group, { x: -58, y: 30.3, z: -160 });
    flat(16, 40, asphalt, 0, -126, 0.15, 0.3);   // 基地と管制棟の間の道
    G.block(-9, -146, 9, -106);
    const pond = { x: 0, z: 196, w: 100, d: 54 };
    G.block(pond.x - pond.w / 2 - 6, pond.z - pond.d / 2 - 6, pond.x + pond.w / 2 + 6, pond.z + pond.d / 2 + 6);
    for (const [w, d, x, z] of [[pond.w + 6, 3, 0, -pond.d / 2 - 1.5], [pond.w + 6, 3, 0, pond.d / 2 + 1.5], [3, pond.d, -pond.w / 2 - 1.5, 0], [3, pond.d, pond.w / 2 + 1.5, 0]]) add(box(w, 2.2, d), M.mid, group, { x: pond.x + x, y: 0.5, z: pond.z + z });   // 石積みの縁
    add(box(pond.w, 0.4, pond.d), M.dark, group, { x: pond.x, y: -0.8, z: pond.z, edges: false });   // 池の底
    const pondW = new THREE.Mesh(new THREE.PlaneGeometry(pond.w, pond.d).rotateX(-Math.PI / 2), U.waterMaterial(THREE, { opacity: 0.55 }));
    pondW.position.set(pond.x, 0.9, pond.z); group.add(pondW);
    add(box(26, 9, 16), M.body, group, { x: 36, y: 4.5, z: 150 });   // 排水ポンプ棟
    add(box(26.4, 1.4, 16.4), accent, group, { x: 36, y: 7.6, z: 150, edges: false });
    for (const x of [28, 36, 44]) add(cyl(0.9, 14, 8).rotateX(Math.PI / 2), M.steel, group, { x, y: 1.4, z: 163, edges: false });   // 池への吐出管
    G.block(20, 140, 52, 172);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, x = pond.x + Math.cos(a) * (pond.w / 2 + 16), z = pond.z + Math.sin(a) * (pond.d / 2 + 14); if (G.free(x, z, 2)) G.put(i % 3 ? "shade" : "cas", x, z, 0.85 + G.rnd() * 0.3); }
    for (const [x, z] of [[-30, 120], [-60, 140], [0, 260], [-50, 270], [50, 268], [-20, -250], [30, -262], [-55, -268], [60, -255], [80, -130], [-80, -132]]) if (G.free(x, z, 3)) G.put("shade", x, z, 0.85 + G.rnd() * 0.3);
    // 両岸の坑口の後ろの草地(制圧圏の縁の中)
    G.cover({ r0: 140, inner: 0.16, outer: 0.7, avoid: (x, z) => Math.abs(x) < IE && Math.abs(z) < 60 });
    G.finish();

    // ── 運河の下の管(シールドの継ぎ目の輪)。川底に半分埋めて水越しに見せる ──
    const tunG = cyl(TR, 1, 18); tunG.rotateZ(Math.PI / 2);
    const ringG = cyl(TR + 0.6, 1.4, 18); ringG.rotateZ(Math.PI / 2);
    const tubeY = ctx.BED - 1.5 - BASE;   // 管の中心(group の座標。絶対の高さは川底の 1.5 下)
    for (const [xa, xb] of [[-BANK - 10, -ISL + 10], [ISL - 10, BANK + 10]]) for (const z of TZ) {
      const m = add(tunG, M.light, group, { x: (xa + xb) / 2, y: tubeY, z, edges: false }); m.scale.x = xb - xa;
      for (let x = xa + 8; x < xb - 4; x += 12) add(ringG, M.mid, group, { x, y: tubeY, z, edges: false });
    }

    U.bake(THREE, group, { live: [accent], also: [M.lamp] });
    return {
      group,
      setTeam: (c) => accent.color.set(c ?? 0x8f98a3),
      check: () => ({
        landPartsInWater: placed.filter(([x, z]) => ctx.isWater(x, z)).length,
        tubeTopBelowWater: +(ctx.WY - (tubeY + BASE + TR + 0.6)).toFixed(2),   // 管の上面と水面の差(正 = 水面下)
        tubeTopAboveBed: +(tubeY + BASE + TR - ctx.BED).toFixed(2),
        islandHalfWidth: ISL, portalInnerEdge: ISL - 14 - 6,
        groundItems: G.count(), groundItemsInWater: G.inWater(),
      }),
    };
  });
})();
