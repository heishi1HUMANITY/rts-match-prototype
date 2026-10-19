// 拠点 4「湖畔の運河局」(マップ「運河地帯」)。湖の北岸の湖畔の町(地名は架空)。
// 象徴: 湖に面した運河局の本部(白い長い庁舎と中央の塔。外壁の縦の柱形、湖側の柱廊、北の車寄せの柱廊、屋上の設備)。
// ほかに湖畔の遊歩道と公園、ボートクラブとマリーナ、フェリー乗り場(待機の車線)、ヤシのある邸宅街、時計塔の広場、運河の資料館、
//   南西のスポーツクラブ(テニスコート・プール)、南東の研修所、北と西の邸宅・学校、街路樹と歩道(宗教建築は置かない)。
// 湖の岸は ctx.isWater から求め、陸の建物は水に置かない。制圧圏の縁は草地へなじませる。
// 縮尺 0.6 単位/m。誇張: 庁舎の高さ 2 倍・塔 2.5 倍、時計塔 2 倍、船 1.3 倍。近未来化: 庁舎の屋上の運河の航行管制(箱形のレーダーの覆いと電子光学の窓)、マリーナの電動艇の充電柱。
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
  DreamAssets.maps.site("ismailia", (THREE, ctx) => {
    const { U, M } = ctx, { add, box, cyl, V, closedLoft, tube } = ctx.k;
    const accent = M.lambert(0x8f98a3);
    const lawn = M.lambert(0xcfd8c4), paving = M.lambert(0xece6da), paveD = M.lambert(0xdcd5c7), asphalt = M.lambert(0x8d959c), line = M.lambert(0xf2f4f6);
    const kerb = M.lambert(0xdfe2e5), court = M.lambert(0xb9c7b4), deck = M.lambert(0xd8cdb8), hullW = M.lambert(0xf6f7f8);
    const group = new THREE.Group(); group.name = "site-ismailia";
    const BASE = 0.5; group.position.y = BASE;   // 地形の上面(陸は最低 0.5)に合わせる。以下の y は地面からの高さ
    const WYL = ctx.WY - BASE;                     // 水面(group の座標)
    const G = DreamAssets.maps.siteGround(THREE, ctx, group, 404);
    const R = ctx.point.r;
    const placed = [], wet = [];
    const onLand = (x, z) => { placed.push([x, z]); return !ctx.isWater(x, z); };
    const onWater = (x, z) => { wet.push([x, z]); return ctx.isWater(x, z); };
    // 湖の北岸(この x で最初に水になる z)
    const shoreZ = (x) => { for (let z = 150; z < 560; z += 1) if (ctx.isWater(x, z)) return z; return null; };
    const flat = (w, d, mat, x, z, y = 0.15, h = 0.3, ry = 0) => { onLand(x - w / 2, z - d / 2); onLand(x + w / 2, z + d / 2); return add(box(w, h, d), mat, group, { x, y, z, ry, edges: false }); };

    // 平らな帯(折れ線に沿う。上向きの面)
    const strip = (pts, w, y, mat) => {
      const pos = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az), px = (-(bz - az) / l) * (w / 2), pz = ((bx - ax) / l) * (w / 2);
        const q = [[ax + px, az + pz], [bx + px, bz + pz], [bx - px, bz - pz], [ax - px, az - pz]];
        for (const j of [0, 1, 2, 0, 2, 3]) pos.push(q[j][0], y, q[j][1]);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return add(g, mat, group, { edges: false });
    };
    // 道(路面・縁石・歩道・街路樹・街灯)。pts は折れ線、w は車道の幅
    const street = (pts, w, { trees = true, lamps = true, walk = 4 } = {}) => {
      strip(pts, w + 2 * walk + 1.2, 0.2, paving);
      strip(pts, w + 1.2, 0.32, kerb);
      strip(pts, w, 0.4, asphalt);
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / l, uz = (bz - az) / l;
        for (let t = 7; t < l - 4; t += 14) for (const s of [-1, 1]) {
          const x = ax + ux * t - s * uz * (w / 2 + walk * 0.55), z = az + uz * t + s * ux * (w / 2 + walk * 0.55);
          if (Math.hypot(x, z) > R + 15 || G.wet(x, z, 5) || !G.free(x, z, 1)) continue;
          if (trees && Math.round(t / 14) % 2 === 0) G.put((i + s) % 2 ? "shade" : "palm", x, z, 0.75 + G.rnd() * 0.2);
          else if (lamps) { add(cyl(0.3, 8, 6), M.dark, group, { x, y: 4, z, edges: false }); add(box(1.4, 0.4, 1.4), M.lamp, group, { x, y: 8.1, z, edges: false }); }
        }
      }
      G.blockLine(pts, w / 2 + walk + 1);
    };
    const palm = (x, z, s = 1) => { onLand(x, z); G.put("palm", x, z, s * 0.95); };

    // ── 湖畔の遊歩道(コルニッシュ)、岸の手すり、街灯、腰掛け(制圧圏の中の岸だけ) ──
    const shore = [];
    for (let x = -100; x <= 290; x += 10) { const z = shoreZ(x); if (z !== null && Math.hypot(x, z) < R + 30) shore.push([x, z]); }
    strip(shore.map(([x, z]) => [x, z - 12]), 16, 0.25, paving);
    strip(shore.map(([x, z]) => [x, z - 5.2]), 1.6, 0.3, paveD);
    strip(shore.map(([x, z]) => [x, z - 3.5]), 1.0, 1.4, M.dark);   // 手すり(帯を少し浮かせる)
    G.blockLine(shore.map(([x, z]) => [x, z - 12]), 10);
    for (let i = 0; i < shore.length; i++) {
      const [x, z] = shore[i]; onLand(x, z - 18);
      if (i % 3 === 0) { add(cyl(0.35, 8, 5), M.dark, group, { x, y: 4, z: z - 18, edges: false }); add(box(2.2, 0.8, 1.2), M.lamp, group, { x, y: 8.2, z: z - 18, edges: false }); }
      else if (i % 3 === 1) add(box(5, 1, 1.6), paveD, group, { x, y: 0.75, z: z - 16.5 });
    }

    // ── 運河局の本部: 長い庁舎(外壁の縦の柱形、窓の帯、湖側の柱廊、北の車寄せの柱廊)、前に張り出す両翼、中央の塔、屋上の設備と航行管制 ──
    const HQ = { x0: 86, x1: 254, z0: 216, z1: 268, h: 32 };
    const hx = (HQ.x0 + HQ.x1) / 2, hz = (HQ.z0 + HQ.z1) / 2, hw = HQ.x1 - HQ.x0, hd = HQ.z1 - HQ.z0;
    for (const [x, z] of [[HQ.x0, HQ.z0], [HQ.x1, HQ.z0], [HQ.x0, HQ.z1 + 16], [HQ.x1, HQ.z1 + 16]]) onLand(x, z);
    G.block(HQ.x0 - 8, HQ.z0 - 14, HQ.x1 + 8, HQ.z1 + 50);
    add(box(hw + 12, 1.2, hd + 40), paving, group, { x: hx, y: 0.6, z: hz + 12 });           // 基壇
    add(box(hw, HQ.h, hd), M.body, group, { x: hx, y: HQ.h / 2 + 1.2, z: hz });
    add(box(hw + 0.4, 4.4, hd + 0.4), M.glass, group, { x: hx, y: 3.6, z: hz, edges: false });   // 1 階のガラスの奥
    for (const y of [10, 17, 24]) add(box(hw + 0.3, 2.4, hd + 0.3), M.glass, group, { x: hx, y, z: hz, edges: false });       // 窓の帯
    for (let x = HQ.x0 + 2.5; x <= HQ.x1 - 2.5; x += 5) for (const z of [HQ.z0 - 0.4, HQ.z1 + 0.4]) add(box(0.8, 22, 1), M.light, group, { x, y: 18, z, edges: false });   // 縦の柱形(長い面)
    for (let z = HQ.z0 + 2.5; z <= HQ.z1 - 2.5; z += 5) for (const x of [HQ.x0 - 0.4, HQ.x1 + 0.4]) add(box(1, 22, 0.8), M.light, group, { x, y: 18, z, edges: false });   // 縦の柱形(妻面)
    add(box(hw + 3, 2, hd + 3), M.light, group, { x: hx, y: HQ.h + 2.2, z: hz });              // 軒の帯
    for (const [w, d, x, z] of [[hw + 3, 0.8, hx, HQ.z0 - 1.1], [hw + 3, 0.8, hx, HQ.z1 + 1.1], [0.8, hd + 3, HQ.x0 - 1.1, hz], [0.8, hd + 3, HQ.x1 + 1.1, hz]]) add(box(w, 1.4, d), M.light, group, { x, y: HQ.h + 3.9, z, edges: false });   // パラペット
    // 湖側の柱廊(両翼の間): 庇と柱の列
    add(box(hw - 36, 0.9, 7), M.light, group, { x: hx, y: 6.6, z: HQ.z1 + 3.5 });
    for (let x = HQ.x0 + 20; x <= HQ.x1 - 20; x += 6) add(box(1.4, 5.6, 1.4), M.body, group, { x, y: 4, z: HQ.z1 + 6.2 });
    for (const x of [HQ.x0 + 9, HQ.x1 - 9]) {   // 湖へ張り出す両翼
      add(box(18, HQ.h - 4, 18), M.body, group, { x, y: (HQ.h - 4) / 2 + 1.2, z: HQ.z1 + 8 });
      add(box(19, 1.6, 19), M.light, group, { x, y: HQ.h - 1.6, z: HQ.z1 + 8 });
      for (const y of [10, 16, 22]) add(box(18.3, 2.2, 18.3), M.glass, group, { x, y, z: HQ.z1 + 8, edges: false });
      for (let d = -7.5; d <= 7.5; d += 5) add(box(0.8, 20, 1), M.light, group, { x: x + d, y: 15, z: HQ.z1 + 17.4, edges: false });
    }
    // 北の車寄せの柱廊(塔の下の正面玄関)
    add(box(48, 1.4, 12), M.light, group, { x: hx, y: 23.4, z: HQ.z0 - 6 });
    add(box(48.4, 1.2, 12.4), accent, group, { x: hx, y: 22.1, z: HQ.z0 - 6, edges: false });
    for (let x = -21; x <= 21; x += 8.4) add(cyl(1.2, 21.6, 10), M.body, group, { x: hx + x, y: 11.6, z: HQ.z0 - 10.4 });
    add(box(30, 9, 0.4), M.glass, group, { x: hx, y: 5.6, z: HQ.z0 - 0.5, edges: false });
    // 中央の塔(運河の象徴の塔。角の柱形、上に展望・管制の部屋と張り出しの露台)
    add(box(24, 96, 24), M.body, group, { x: hx, y: 48 + 1.2, z: hz + 6 });
    for (let y = 42; y <= 90; y += 8) add(box(24.3, 3, 5), M.glass, group, { x: hx, y, z: hz + 6, edges: false });
    for (let y = 42; y <= 90; y += 8) add(box(5, 3, 24.3), M.glass, group, { x: hx, y, z: hz + 6, edges: false });
    for (const [dx, dz] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) add(box(2.6, 94, 2.6), M.light, group, { x: hx + dx, y: 49, z: hz + 6 + dz, edges: false });
    add(box(28, 3, 28), accent, group, { x: hx, y: 98.7, z: hz + 6, edges: false });
    add(box(31, 0.8, 31), M.light, group, { x: hx, y: 100.6, z: hz + 6 });   // 露台
    for (let k = -14; k <= 14; k += 3.5) for (const [x, z] of [[k, -15], [k, 15], [-15, k], [15, k]]) add(box(0.3, 1.6, 0.3), M.dark, group, { x: hx + x, y: 101.8, z: hz + 6 + z, edges: false });
    add(box(26, 9, 26), M.light, group, { x: hx, y: 105.5, z: hz + 6 });
    add(box(26.4, 4, 26.4), M.glass, group, { x: hx, y: 105.5, z: hz + 6, edges: false });
    add(new THREE.ConeGeometry(19, 12, 4), M.mid, group, { x: hx, y: 116, z: hz + 6, ry: Math.PI / 4 });
    tube(group, V(hx, 120.8, hz + 6), V(hx, 146, hz + 6), 0.6, M.dark);
    // 屋上の設備(空調の室外機の列、水槽、階段室)と近未来化の航行管制(箱形のレーダーの覆い、電子光学の窓、通信の柱)
    const RT = HQ.h + 3.2;
    for (const [x0, x1] of [[HQ.x0 + 22, HQ.x0 + 62], [HQ.x1 - 66, HQ.x1 - 46]]) for (let x = x0; x <= x1; x += 6.5) for (const z of [hz - 14, hz - 7]) add(box(4.4, 2.4, 3.6), M.mid, group, { x, y: RT + 1.2, z, edges: false });
    for (const x of [HQ.x0 + 12, HQ.x1 - 30]) { add(cyl(3, 4.4, 12), M.body, group, { x, y: RT + 2.2, z: hz + 12 }); add(cyl(3.1, 0.6, 12), M.mid, group, { x, y: RT + 4.6, z: hz + 12, edges: false }); }
    add(box(10, 5, 8), M.light, group, { x: HQ.x0 + 52, y: RT + 2.5, z: hz + 12 });
    add(box(14, 5, 5), M.body, group, { x: HQ.x1 - 18, y: RT + 2.5, z: hz - 6 });
    add(box(4, 3, 4), M.dark, group, { x: HQ.x1 - 34, y: RT + 1.5, z: hz - 4 });
    add(box(2.6, 1.6, 0.3), M.glass, group, { x: HQ.x1 - 34, y: RT + 1.7, z: hz - 1.9, edges: false });
    tube(group, V(HQ.x0 + 16, RT, hz - 8), V(HQ.x0 + 16, RT + 21, hz - 8), 0.4, M.dark);
    // 湖側の前庭(芝・ヤシの列・噴水の池・花壇)
    add(box(hw - 30, 0.4, 34), lawn, group, { x: hx, y: 0.2, z: HQ.z1 + 30, edges: false });
    for (let x = HQ.x0 + 22; x <= HQ.x1 - 22; x += 18) { palm(x, HQ.z1 + 21); palm(x + 9, HQ.z1 + 44, 0.9); }
    add(new THREE.CylinderGeometry(9, 9, 1.2, 20), paveD, group, { x: hx, y: 0.6, z: HQ.z1 + 31 });
    const water = U.waterMaterial(THREE, { opacity: 0.55 }), pools = [];
    pools.push([new THREE.CircleGeometry(8, 20).rotateX(-Math.PI / 2), { x: hx, y: 1.25, z: HQ.z1 + 31 }]);
    for (const s of [-1, 1]) G.slab("bed", hx + s * 30, HQ.z1 + 31, 22, 0.8, 5);

    // ── 北の車寄せ(輪の車道、中央の芝と噴水、旗竿)と地図の道路への取付け ──
    const LP = { x: hx, z: 169, r: 34 };
    G.blockC(LP.x, LP.z, LP.r + 4);
    add(new THREE.CylinderGeometry(LP.r, LP.r, 0.4, 36), asphalt, group, { x: LP.x, y: 0.4, z: LP.z, edges: false });
    add(new THREE.CylinderGeometry(LP.r + 1.2, LP.r + 1.2, 0.3, 36), kerb, group, { x: LP.x, y: 0.3, z: LP.z, edges: false });
    add(new THREE.CylinderGeometry(22, 22, 0.8, 32), lawn, group, { x: LP.x, y: 0.5, z: LP.z, edges: false });
    add(new THREE.CylinderGeometry(9, 9, 1.6, 20), paveD, group, { x: LP.x, y: 0.8, z: LP.z });
    pools.push([new THREE.CircleGeometry(8, 20).rotateX(-Math.PI / 2), { x: LP.x, y: 1.65, z: LP.z }]);
    add(cyl(1.4, 4, 8), paveD, group, { x: LP.x, y: 2, z: LP.z });
    for (const x of [-12, 0, 12]) { tube(group, V(LP.x + x, 0.8, LP.z - 16), V(LP.x + x, 34, LP.z - 16), 0.3, M.mid); add(new THREE.SphereGeometry(0.6, 8, 6), M.light, group, { x: LP.x + x, y: 34.4, z: LP.z - 16, edges: false }); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; G.slab("hedge", LP.x + Math.cos(a) * 19.5, LP.z + Math.sin(a) * 19.5, 2, 1.4, 9, -a, 0.9); }
    flat(12, 30, asphalt, LP.x, 120, 0.35, 0.3);   // 地図の道路から車寄せへ
    flat(16, 14, paving, LP.x, 209.5, 0.3, 0.3);   // 車寄せから玄関へ

    // ── 職員の駐車場(庁舎の西。白線、木陰の並木) ──
    flat(60, 58, asphalt, 46, 246, 0.25, 0.3);
    G.block(14, 215, 78, 277);
    for (let x = 22; x <= 70; x += 6) for (const z of [228, 262]) add(box(0.35, 0.1, 11), line, group, { x, y: 0.42, z, edges: false });
    G.row("shade", 9, 225, 9, 275, 10, 0.75); G.row("shade", 22, 281, 72, 281, 10, 0.75);
    street([[78, 186], [46, 200], [46, 216]], 8, { trees: false });

    // ── マリーナ(浮き桟橋・指の桟橋・係留した艇・防波堤・充電柱)、ボートクラブ(湖側の床、艇の置き場、斜路) ──
    const MX = -25, mz = shoreZ(MX);
    for (const z of [mz + 6, mz + 70]) onWater(MX, z);
    add(box(5, 1.2, 72), M.light, group, { x: MX, y: WYL + 1, z: mz + 36 });
    const hullG = closedLoft([-1, 1].map((s) => [[-2.6, 0], [2.6, 0], [3, 2.2], [-3, 2.2]].map(([x, y]) => V(x, y, s * 7))).concat([[[-0.3, 0.4], [0.3, 0.4], [0.5, 2.4], [-0.5, 2.4]].map(([x, y]) => V(x, y, 10.5))]));   // 船首は細く
    for (let i = 0; i < 5; i++) {
      const z = mz + 16 + i * 12;
      for (const s of [-1, 1]) {
        onWater(MX + s * 13, z);
        add(box(18, 0.9, 2), M.light, group, { x: MX + s * 11, y: WYL + 0.9, z });
        const bx = MX + s * 12, bz = z + 6;
        if ((i + (s > 0 ? 1 : 0)) % 2 === 0) {   // 艇(船体・甲板室・帆柱)
          onWater(bx, bz);
          add(hullG, hullW, group, { x: bx, y: WYL - 0.4, z: bz, ry: (s * Math.PI) / 2, edges: false });
          add(box(2.6, 1.6, 4), M.light, group, { x: bx, y: WYL + 2.6, z: bz });
          tube(group, V(bx - s * 1.5, WYL + 2, bz), V(bx - s * 1.5, WYL + 18, bz), 0.2, M.dark);
        }
        add(cyl(0.4, 3, 5), accent, group, { x: MX + s * 3.2, y: WYL + 2.6, z, edges: false });   // 電動艇の充電柱(近未来化)
      }
    }
    for (const [x, z, w, d] of [[MX - 34, mz + 40, 4, 70], [MX - 10, mz + 77, 52, 4]]) { onWater(x, z); add(box(w, 6, d), M.mid, group, { x, y: WYL + 1, z }); }   // 防波堤
    const CB = { x: -40, z: mz - 36 };   // ボートクラブ
    G.block(CB.x - 22, CB.z - 14, CB.x + 22, CB.z + 26);
    add(box(36, 9, 18), M.body, group, { x: CB.x, y: 4.5, z: CB.z });
    add(box(36.4, 2.6, 18.4), M.glass, group, { x: CB.x, y: 4.6, z: CB.z, edges: false });
    add(box(40, 1, 22), M.light, group, { x: CB.x, y: 9.5, z: CB.z });
    add(box(36, 0.8, 12), deck, group, { x: CB.x, y: 1, z: CB.z + 15 });   // 湖側の床
    for (let x = -16; x <= 16; x += 4) add(box(0.25, 1.2, 0.25), M.dark, group, { x: CB.x + x, y: 2, z: CB.z + 21, edges: false });
    add(box(0.25, 0.25, 0.25).scale(132, 1, 1), M.dark, group, { x: CB.x, y: 2.6, z: CB.z + 21, edges: false });
    for (let i = 0; i < 3; i++) {   // 艇の置き場(陸の上の台に載せた艇)
      const bx = -100 + i * 12, bz = mz - 46;
      if (!onLand(bx, bz)) continue;
      add(box(4, 1.6, 10), M.mid, group, { x: bx, y: 0.8, z: bz, edges: false });
      add(hullG, hullW, group, { x: bx, y: 1.6, z: bz, edges: false });
    }
    G.block(-108, mz - 58, -70, mz - 34);
    add(box(10, 2, 30), M.light, group, { x: MX - 46, y: WYL + 0.6, z: shoreZ(MX - 46) + 4, rx: 0.12 });   // 斜路(水へ下りる)
    onWater(MX - 46, shoreZ(MX - 46) + 14);

    // ── フェリー乗り場(斜路・待合所と屋根・券売所・待機の車線)と横付けしたフェリー ──
    const FX = 52, fz = shoreZ(FX);
    onWater(FX, fz + 10); onLand(FX + 24, fz - 34);
    add(box(16, 2, 22), M.light, group, { x: FX, y: -0.4, z: fz + 7, rx: 0.12 });   // 斜路
    add(box(20, 6, 12), M.body, group, { x: FX + 24, y: 3, z: fz - 34 });           // 待合所
    add(box(22, 1, 14), accent, group, { x: FX + 24, y: 6.5, z: fz - 34, edges: false });
    add(box(26, 0.6, 20), M.light, group, { x: FX + 24, y: 7.4, z: fz - 33 });       // 待合所の張り出した屋根
    flat(36, 56, asphalt, 44, 318, 0.25, 0.3);   // 待機の車線
    G.block(24, 288, 92, fz + 2);
    for (const x of [35, 44, 53]) for (let z = 296; z <= 340; z += 8) add(box(0.4, 0.1, 4), line, group, { x, y: 0.42, z, edges: false });
    add(box(6, 5, 5), M.body, group, { x: 32, y: 2.5, z: 290 });   // 券売所
    add(box(6.6, 0.6, 7), accent, group, { x: 32, y: 5.3, z: 290, edges: false });
    const ferry = new THREE.Group(); ferry.position.set(FX, WYL, fz + 34); group.add(ferry);
    onWater(FX, fz + 34); onWater(FX, fz + 52);
    add(box(14, 3.2, 38), M.body, ferry, { y: 1.2 });          // 船体
    add(box(14.4, 1.2, 38.4), M.dark, ferry, { y: 0, edges: false });
    add(box(12, 0.4, 34), M.mid, ferry, { y: 3, edges: false });   // 車両甲板
    for (const s of [-1, 1]) add(box(1, 4, 30), M.light, ferry, { x: s * 6.5, y: 4.8 });   // 舷側の囲い
    add(box(8, 4, 6), M.light, ferry, { x: 4, y: 8.8, z: 6 });     // 操舵室(片側に寄せる)
    add(box(8.2, 1.4, 6.2), M.glass, ferry, { x: 4, y: 9.6, z: 6, edges: false });
    for (const s of [-1, 1]) add(box(10, 0.8, 5), M.mid, ferry, { y: 2.6, z: s * 21, rx: s * 0.25 });   // 両端の跳ね板

    // ── 湖畔の公園(ボートクラブと遊歩道の間): 芝、小道、パーゴラ、売店(日よけ)、遊具の枠、ヤシ ──
    const parkZ1 = (x) => (shoreZ(x) ?? 420) - 22;
    for (let x = -96; x < 16; x += 14) { const z1 = parkZ1(x + 7), z0 = 322; if (z1 - z0 > 6) flat(14.4, z1 - z0, lawn, x + 7, (z0 + z1) / 2, 0.18, 0.3); }
    for (let x = -90; x < 14; x += 11) { const z = parkZ1(x) - 6; if (G.free(x, z, 2)) palm(x, z, 0.8 + G.rnd() * 0.3); }
    for (const [x, z] of [[-80, 336], [-6, 340]]) {   // 売店と日よけ
      add(box(8, 5, 6), M.body, group, { x, y: 2.5, z });
      add(box(10, 0.4, 9), M.lambert(0xd7c7a8), group, { x, y: 5.6, z: z + 1.5, rx: 0.12, edges: false });
      G.block(x - 6, z - 4, x + 6, z + 7);
    }
    const PG = { x: -52, z: 338 };   // パーゴラ
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) add(box(0.9, 7, 0.9), M.light, group, { x: PG.x - 12 + i * 8, y: 3.5, z: PG.z + s * 4, edges: false });
    for (let i = 0; i < 9; i++) add(box(0.6, 0.6, 11), M.light, group, { x: PG.x - 13 + i * 3.2, y: 7.3, z: PG.z, edges: false });
    G.block(PG.x - 15, PG.z - 6, PG.x + 15, PG.z + 6);
    for (const [x, z] of [[-30, 330], [-24, 336]]) { add(box(0.5, 6, 0.5), M.dark, group, { x, y: 3, z, edges: false }); }   // 遊具の枠
    add(box(0.4, 0.4, 7).rotateY(0.7), M.dark, group, { x: -27, y: 6, z: 333, edges: false });

    // ── 時計塔の広場(噴水・ベンチの縁・敷石の目地)と庁舎へ続く並木道 ──
    const SQ = { x: -170, z: 96 };
    onLand(SQ.x - 40, SQ.z - 35); onLand(SQ.x + 40, SQ.z + 35);
    G.block(SQ.x - 42, SQ.z - 36, SQ.x + 42, SQ.z + 36);
    add(box(82, 0.6, 70), paving, group, { x: SQ.x, y: 0.3, z: SQ.z, edges: false });
    for (let k = -36; k <= 36; k += 8) add(box(0.3, 0.08, 68), paveD, group, { x: SQ.x + k, y: 0.63, z: SQ.z, edges: false });
    add(box(12, 4, 12), M.light, group, { x: SQ.x, y: 2.6, z: SQ.z - 14 });
    add(box(9, 44, 9), M.body, group, { x: SQ.x, y: 26.6, z: SQ.z - 14 });
    for (const [dx, dz] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) add(box(1.2, 42, 1.2), M.light, group, { x: SQ.x + dx, y: 26, z: SQ.z - 14 + dz, edges: false });
    add(box(10.5, 10, 10.5), M.light, group, { x: SQ.x, y: 50, z: SQ.z - 14 });
    for (const [dx, dz, ry] of [[0, 5.3, 0], [0, -5.3, 0], [5.3, 0, Math.PI / 2], [-5.3, 0, Math.PI / 2]]) add(cyl(3.4, 0.4, 16).rotateX(Math.PI / 2), M.dark, group, { x: SQ.x + dx, y: 50, z: SQ.z - 14 + dz, ry, edges: false });   // 時計の文字盤
    add(new THREE.ConeGeometry(8.4, 9, 4), M.mid, group, { x: SQ.x, y: 59.5, z: SQ.z - 14, ry: Math.PI / 4 });
    add(cyl(13, 2, 20), M.light, group, { x: SQ.x, y: 1, z: SQ.z + 16 });                       // 噴水の池の縁
    pools.push([new THREE.CircleGeometry(11.5, 20).rotateX(-Math.PI / 2), { x: SQ.x, y: 2.05, z: SQ.z + 16 }]);
    add(cyl(2, 5, 8), M.light, group, { x: SQ.x, y: 2.5, z: SQ.z + 16 });
    for (const [x, z] of [[-30, -28], [30, -28], [-30, 28], [30, 28], [-30, 0], [30, 0]]) palm(SQ.x + x, SQ.z + z, 0.9);
    for (const [x, z] of [[-18, 30], [18, 30], [-18, 2], [18, 2]]) add(box(6, 1, 1.8), paveD, group, { x: SQ.x + x, y: 1.1, z: SQ.z + z });
    street([[SQ.x + 41, SQ.z + 20], [78, 186], [LP.x - LP.r, LP.z + 4]], 12);

    // ── 旧宅(運河の建設者の旧宅。ベランダのある 2 階建て)と庭園、ヤシの公園 ──
    const LX = 10, LZ = -50;
    onLand(LX - 40, LZ - 34); onLand(LX + 40, LZ + 34);
    G.block(LX - 43, LZ - 36, LX + 43, LZ + 36);
    add(box(84, 0.5, 70), lawn, group, { x: LX, y: 0.25, z: LZ, edges: false });
    add(box(36, 16, 22), M.body, group, { x: LX, y: 8, z: LZ - 6 });
    add(box(42, 1.2, 30), M.light, group, { x: LX, y: 8.4, z: LZ - 2 });                        // 2 階の床・ベランダ
    for (const x of [-18, -9, 0, 9, 18]) add(box(1.2, 16, 1.2), M.light, group, { x: LX + x, y: 8, z: LZ + 12 });   // ベランダの柱
    add(box(36.4, 2.4, 22.4), M.glass, group, { x: LX, y: 4, z: LZ - 6, edges: false });
    add(box(36.4, 2.4, 22.4), M.glass, group, { x: LX, y: 12.5, z: LZ - 6, edges: false });
    add(new THREE.ConeGeometry(30, 9, 4).rotateY(Math.PI / 4).scale(1, 1, 0.72), M.mid, group, { x: LX, y: 20.5, z: LZ - 2 });   // 寄棟の屋根
    strip([[LX, LZ + 15], [LX, LZ + 35]], 6, 0.6, paving);
    for (const [x, z] of [[-36, -28], [-36, 0], [-36, 28], [36, -28], [36, 0], [36, 28]]) palm(LX + x, LZ + z, 0.9);
    for (const s of [-1, 1]) G.slab("bed2", LX + s * 18, LZ + 24, 14, 0.8, 4);
    G.block(-48, -258, 68, -120);
    for (let x = -40; x <= 60; x += 20) for (let z = -250; z <= -130; z += 24) palm(x, z, 0.85 + ((x + z) % 3) * 0.08);
    strip([[-50, -190], [60, -190]], 5, 0.45, paving);
    flat(116, 136, lawn, 10, -189, 0.12, 0.2);

    // ── 運河の資料館(広場と湖畔の間。低い柱廊の棟)と庭 ──
    const MU = { x: -55, z: 252 };
    G.block(MU.x - 50, MU.z - 46, MU.x + 52, MU.z + 60);
    flat(100, 100, lawn, MU.x, MU.z + 6, 0.12, 0.2);
    add(box(44, 10, 24), M.body, group, { x: MU.x, y: 5, z: MU.z });
    add(box(52, 1.2, 32), M.light, group, { x: MU.x, y: 10.6, z: MU.z });
    for (let x = -22; x <= 22; x += 5.5) add(box(1.3, 10, 1.3), M.light, group, { x: MU.x + x, y: 5, z: MU.z + 14.5 });
    add(box(44.4, 3, 24.4), M.glass, group, { x: MU.x, y: 4.6, z: MU.z, edges: false });
    strip([[MU.x, MU.z + 16], [MU.x, MU.z + 54]], 6, 0.4, paving);
    strip([[MU.x - 46, MU.z + 40], [MU.x + 48, MU.z + 40]], 4, 0.38, paving);
    for (let i = 0; i < 16; i++) { const x = MU.x - 46 + G.rnd() * 94, z = MU.z - 40 + G.rnd() * 96; if (Math.abs(x - MU.x) > 28 || Math.abs(z - MU.z) > 18) G.put(i % 3 ? "palm" : "shade", x, z, 0.8 + G.rnd() * 0.25); }

    // ── 南西のスポーツクラブ(クラブハウス、プールと床、テニスコート 4 面と金網、駐車場) ──
    const SC = { x0: -282, x1: -112, z0: 196, z1: 300 };
    G.block(SC.x0, SC.z0, SC.x1, SC.z1);
    flat(SC.x1 - SC.x0, SC.z1 - SC.z0, M.lambert(0xd6dccf), (SC.x0 + SC.x1) / 2, (SC.z0 + SC.z1) / 2, 0.1, 0.16);
    add(box(40, 9, 20), M.body, group, { x: -140, y: 4.5, z: 214 });
    add(box(44, 1, 24), M.light, group, { x: -140, y: 9.5, z: 214 });
    add(box(40.4, 2.4, 20.4), M.glass, group, { x: -140, y: 4.6, z: 214, edges: false });
    add(box(40, 0.8, 30), deck, group, { x: -140, y: 0.5, z: 252 });   // プールの床
    add(box(26, 1.4, 14), M.mid, group, { x: -140, y: 0.7, z: 252 });
    pools.push([new THREE.PlaneGeometry(24, 12).rotateX(-Math.PI / 2), { x: -140, y: 1.45, z: 252 }]);
    for (const x of [-150, -144, -136, -130]) add(box(2, 0.6, 4), M.light, group, { x, y: 1.2, z: 264, edges: false });   // 寝椅子
    const fence = [];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {   // テニスコート
      const cx = -255 + i * 44, cz = 220 + j * 52;
      add(box(38, 0.3, 20), court, group, { x: cx, y: 0.3, z: cz, edges: false });
      for (const [w, d, x, z] of [[24, 0.4, 0, -5.5], [24, 0.4, 0, 5.5], [0.4, 11, -12, 0], [0.4, 11, 12, 0], [0.4, 11, 0, 0], [12, 0.4, 0, 0]]) add(box(w, 0.08, d), line, group, { x: cx + x, y: 0.49, z: cz + z, edges: false });
      add(box(0.3, 1.2, 12), M.dark, group, { x: cx, y: 0.9, z: cz, edges: false });   // 網
      for (const [w, d, x, z] of [[38, 0.2, 0, -10], [38, 0.2, 0, 10], [0.2, 20, -19, 0], [0.2, 20, 19, 0]]) fence.push([box(w, 4, d), { x: cx + x, y: 2, z: cz + z }]);   // 金網
      for (const [x, z] of [[-19, -10], [19, -10], [-19, 10], [19, 10], [0, -10], [0, 10]]) add(box(0.4, 4.4, 0.4), M.dark, group, { x: cx + x, y: 2.2, z: cz + z, edges: false });
    }
    group.add(new THREE.Mesh(U.merge(THREE, fence), M.lambert(0xb7bdc3, { transparent: true, opacity: 0.45, depthWrite: false })));
    flat(30, 30, asphalt, -178, 214, 0.25, 0.3);
    for (let i = 0; i < 18; i++) { const a = G.rnd(), x = SC.x0 + 6 + a * (SC.x1 - SC.x0 - 12), z = G.rnd() < 0.5 ? SC.z0 + 5 : SC.z1 - 5; G.put("palm", x, z, 0.8 + G.rnd() * 0.3); }
    G.hedge(SC.x0, SC.z0, SC.x1, SC.z0, 2, 1.8); G.hedge(SC.x0, SC.z1, SC.x1, SC.z1, 2, 1.8); G.hedge(SC.x0, SC.z0, SC.x0, SC.z1, 2, 1.8);

    // ── 南東の研修所(中庭のある低い棟)と庭 ──
    const TC = { x: 310, z: 172 };
    G.block(TC.x - 34, TC.z - 26, TC.x + 34, TC.z + 26);
    for (const [w, d, x, z] of [[60, 12, 0, -19], [60, 12, 0, 19], [12, 26, -24, 0], [12, 26, 24, 0]]) {
      add(box(w, 12, d), M.body, group, { x: TC.x + x, y: 6, z: TC.z + z });
      add(box(w + 0.3, 2, d + 0.3), M.glass, group, { x: TC.x + x, y: 7, z: TC.z + z, edges: false });
      add(box(w + 1, 1, d + 1), M.light, group, { x: TC.x + x, y: 12.5, z: TC.z + z });
    }
    add(box(36, 0.4, 26), lawn, group, { x: TC.x, y: 0.3, z: TC.z, edges: false });
    G.put("shade", TC.x, TC.z, 1);
    add(box(60.6, 1.2, 12.6), accent, group, { x: TC.x, y: 11.2, z: TC.z - 19, edges: false });
    flat(70, 60, lawn, 306, 248, 0.12, 0.2);
    G.block(270, 218, 342, 280);
    for (let i = 0; i < 12; i++) G.put(i % 2 ? "palm" : "shade", 276 + G.rnd() * 60, 222 + G.rnd() * 54, 0.8 + G.rnd() * 0.3);

    // ── 西の学校(校舎と運動場) ──
    const SCH = { x: -335, z: 92 };
    G.block(SCH.x - 30, SCH.z - 78, SCH.x + 30, SCH.z + 20);
    add(box(48, 12, 18), M.body, group, { x: SCH.x, y: 6, z: SCH.z });
    for (const y of [4, 9]) add(box(48.3, 2, 18.3), M.glass, group, { x: SCH.x, y, z: SCH.z, edges: false });
    add(box(50, 1, 20), M.light, group, { x: SCH.x, y: 12.5, z: SCH.z });
    add(box(50, 0.3, 46), M.lambert(0xd8d3c3), group, { x: SCH.x, y: 0.25, z: SCH.z - 46, edges: false });   // 運動場
    for (const [w, d, z] of [[40, 0.4, -64], [40, 0.4, -28], [0.4, 36, -46]]) add(box(w, 0.08, d), line, group, { x: SCH.x + (d > 1 ? 0 : 0), y: 0.44, z: SCH.z + z, edges: false });
    for (const s of [-1, 1]) add(box(0.4, 4, 8), M.dark, group, { x: SCH.x, y: 2, z: SCH.z - 46 + s * 18, ry: Math.PI / 2, edges: false });   // ゴール
    G.row("shade", SCH.x - 28, SCH.z - 74, SCH.x - 28, SCH.z + 14, 11, 0.8);

    // ── 地図の道路(拠点の中を北東から西へ抜ける。suez.js の ROADS のこの拠点の座標)を作り直して上に重ねる ──
    const MAPROAD = [[540, -350], [300, 100], [-500, 200]];
    street(MAPROAD, 22, { walk: 5 });
    for (let i = 1; i < MAPROAD.length; i++) {   // 中央の破線
      const [ax, az] = MAPROAD[i - 1], [bx, bz] = MAPROAD[i], l = Math.hypot(bx - ax, bz - az);
      for (let t = 4; t < l; t += 14) { const x = ax + ((bx - ax) * t) / l, z = az + ((bz - az) * t) / l; if (Math.hypot(x, z) < R + 30) add(box(0.6, 0.1, 7), line, group, { x, y: 0.5, z, ry: Math.atan2(bx - ax, bz - az), edges: false }); }
    }

    // ── 邸宅街と北の道、地図の道路への取付け(歩道・縁石・街路樹・街灯) ──
    street([[-60, -300], [-60, 140]], 12);
    street([[140, -300], [140, 112]], 12);
    street([[-352, -168], [-60, -168]], 10);
    street([[140, -168], [352, -168]], 10);
    street([[-276, -300], [276, -300]], 10);
    street([[-352, -60], [-60, -60]], 8, { walk: 4 });   // 区画の間の生活道路
    street([[140, -60], [352, -60]], 8, { walk: 4 });

    // ── 邸宅街(庭付きの住宅地): 通りに面した区画に分け、区画ごとに塀・門・車寄せ・庭(芝・生け垣・花壇・プール・テラス)と形の違う家を建てる ──
    // 家の形: 2 階建ての箱(屋上テラスとパーゴラ)、L 字(瓦の寄棟の 2 階の母屋 + 平屋の翼)、中庭の平屋(角に 2 階の小塔)、切妻の平屋(瓦、正面のベランダ)
    // 区画の幅 30〜46、通りからの引き(セットバック)6〜13。壁は生成りの暖色の数色、屋根は淡いテラコッタ。区画は通りと既存の建造物(G.free)を避ける
    const VR = U.rng(4402), vr = (a, b) => a + VR() * (b - a), pick = (arr) => arr[Math.floor(VR() * arr.length)];
    const WALLS = [0xf2ece2, 0xece3d4, 0xe7dccb, 0xf5f0e8, 0xe3d7c4, 0xeee6d8].map((c) => M.lambert(c));
    const TRIM = [0xe9e3d7, 0xdcd4c5].map((c) => M.lambert(c));
    const TILE = [0xc89a7e, 0xd1a68b, 0xbe8f75, 0xc7a28a].map((c) => M.lambert(c));
    const GWALL = [0xe5dbca, 0xdfd3bf, 0xebe4d6].map((c) => M.lambert(c));
    const LAWNS = [0xcbd5be, 0xc4cfb6, 0xd2dac6].map((c) => M.lambert(c)), GRAVEL = M.lambert(0xdcd3c0), WOOD = M.lambert(0xa8957c);
    const ST = 6.8;   // 1 階の高さ(誇張込み)
    const poolBasin = M.lambert(0x8fa6ae);
    const nearRoad = (x, z) => MAPROAD.some((pt, i) => i > 0 && G.seg(x, z, MAPROAD[i - 1], pt) < 26);
    const lotFree = (x0, z0, x1, z1) => {
      for (const fx of [0.02, 0.5, 0.98]) for (const fz of [0.02, 0.5, 0.98]) {
        const x = x0 + (x1 - x0) * fx, z = z0 + (z1 - z0) * fz;
        if (Math.hypot(x, z) > R - 16 || !G.free(x, z, 0.5) || nearRoad(x, z) || G.wet(x, z, 6)) return false;
      }
      return true;
    };
    // 平らな屋根の縁(パラペット)と屋上の水槽・室外機
    const flatRoof = (HG, w, d, y, tm, x = 0, z = 0) => {
      add(box(w + 0.5, 1.1, d + 0.5), tm, HG, { x, y: y + 0.55, z });
      add(box(w - 0.6, 0.3, d - 0.6), M.mid, HG, { x, y: y + 0.9, z, edges: false });
      if (VR() < 0.7) add(cyl(1.1, 1.8, 8), M.light, HG, { x: x + w / 2 - 2.2, y: y + 2, z: z + d / 2 - 2.2, edges: false });
      if (VR() < 0.6) add(box(1.6, 1.1, 1.2), M.light, HG, { x: x - w / 4, y: y + 1.6, z: z + d / 2 - 1.8, edges: false });
    };
    const glassBand = (HG, w, d, y, x = 0, z = 0) => add(box(w + 0.3, 1.7, d + 0.3), M.glass, HG, { x, y, z, edges: false });
    // 家(足元の中心が原点、正面が -z)。toW は区画の座標 → 拠点の座標、hx/hz は家の中心(区画の座標)
    function house(HG, type, w, d, toW, hx, hz) {
      const wm = pick(WALLS), tm = pick(TRIM), rm = pick(TILE);
      if (type === "box2") {
        add(box(w, 2 * ST, d), wm, HG, { y: ST });
        glassBand(HG, w, d, ST * 0.55); glassBand(HG, w, d, ST * 1.55);
        flatRoof(HG, w, d, 2 * ST, tm);
        add(box(4.4, 3.6, 4.4), wm, HG, { x: -w / 2 + 2.8, y: 2 * ST + 1.8, z: d / 2 - 2.8 });   // 屋上の階段室
        const pw = w - 7.5, pd = d / 2 - 1, pz = -d / 2 + 0.5 + pd / 2, px = 2.6;   // 屋上テラスのパーゴラ(柱 4 本・桁・すのこ)
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(box(0.4, 3, 0.4), WOOD, HG, { x: px + sx * (pw / 2 - 0.3), y: 2 * ST + 2.4, z: pz + sz * (pd / 2 - 0.3), edges: false });
        for (let k = 0; k <= Math.floor(pw / 1.4); k++) add(box(0.3, 0.25, pd), WOOD, HG, { x: px - pw / 2 + 0.3 + k * 1.4, y: 2 * ST + 4, z: pz, edges: false });
        for (let k = 0; k < 3; k++) { const [x, z] = toW(hx + px - pw / 2 + 1 + k * (pw - 2) / 2, hz + pz - pd / 2 + 0.9); G.slab(k % 2 ? "bed" : "hedge", x, z, 1.3, 1, 1.3, 0, 2 * ST + 1); }   // 鉢植え
        add(box(w * 0.55, 0.45, 2.6), tm, HG, { x: -w * 0.1, y: ST, z: -d / 2 - 1.3 });           // 正面のバルコニー
        add(box(w * 0.55, 1.1, 0.25), M.dark, HG, { x: -w * 0.1, y: ST + 0.8, z: -d / 2 - 2.5, edges: false });
      } else if (type === "L") {
        const w1 = Math.max(10, w * 0.58), w2 = w - w1, d2 = d * vr(0.55, 0.75), side = VR() < 0.5 ? -1 : 1;
        const x1 = -side * (w / 2 - w1 / 2), x2 = side * (w / 2 - w2 / 2), z2 = VR() < 0.5 ? -(d - d2) / 2 : (d - d2) / 2;
        add(box(w1, 2 * ST, d), wm, HG, { x: x1, y: ST });
        glassBand(HG, w1, d, ST * 0.55, x1); glassBand(HG, w1, d, ST * 1.55, x1);
        add(box(w1 + 1.4, 0.5, d + 1.4), tm, HG, { x: x1, y: 2 * ST + 0.25 });                      // 軒
        const rh = Math.min(w1, d) * 0.32, hip = new THREE.ConeGeometry(1, rh, 4).rotateY(Math.PI / 4).scale((w1 + 1.4) / Math.SQRT2, 1, (d + 1.4) / Math.SQRT2);
        add(hip, rm, HG, { x: x1, y: 2 * ST + 0.5 + rh / 2 });                                      // 瓦の寄棟
        add(box(w2, ST, d2), wm, HG, { x: x2, y: ST / 2, z: z2 });
        glassBand(HG, w2, d2, ST * 0.55, x2, z2);
        flatRoof(HG, w2, d2, ST, tm, x2, z2);
      } else if (type === "court") {
        const t = 5.6, h = ST * 1.05;
        for (const [ww, dd, x, z] of [[w, t, 0, -d / 2 + t / 2], [w, t, 0, d / 2 - t / 2], [t, d - 2 * t, -w / 2 + t / 2, 0], [t, d - 2 * t, w / 2 - t / 2, 0]]) {
          add(box(ww, h, dd), wm, HG, { x, y: h / 2, z });
          glassBand(HG, ww, dd, h * 0.55, x, z);
          add(box(ww + 0.4, 1, dd + 0.4), tm, HG, { x, y: h + 0.5, z });
        }
        add(box(w - 2 * t, 0.3, d - 2 * t), pick(LAWNS), HG, { y: 0.3, edges: false });             // 中庭
        const [cxw, czw] = toW(hx, hz); G.put(VR() < 0.5 ? "shade" : "palm", cxw, czw, 0.7);
        const tx = -w / 2 + t / 2 + 0.5, tz = d / 2 - t / 2 - 0.5;                                  // 角の 2 階の小塔
        add(box(t + 1, ST, t + 1), wm, HG, { x: tx, y: h + ST / 2, z: tz });
        glassBand(HG, t + 1, t + 1, h + ST * 0.55, tx, tz);
        flatRoof(HG, t + 1, t + 1, h + ST, tm, tx, tz);
      } else {   // pitch: 切妻の平屋と正面のベランダ
        const h = ST * 1.15, rh = d * 0.3;
        add(box(w, h, d), wm, HG, { y: h / 2 });
        glassBand(HG, w, d, h * 0.5);
        const gable = closedLoft([-1, 1].map((sx) => [V(sx * (w / 2 + 0.9), h, -d / 2 - 0.9), V(sx * (w / 2 + 0.9), h, d / 2 + 0.9), V(sx * (w / 2 + 0.9), h + rh, 0)]));
        add(gable, rm, HG, {});
        const vw = w * 0.7;
        add(box(vw, 0.5, 4), paveD, HG, { y: 0.3, z: -d / 2 - 2, edges: false });
        add(box(vw + 0.6, 0.45, 4.6), tm, HG, { y: h * 0.82, z: -d / 2 - 2.2 });
        for (const sx of [-1, -0.33, 0.33, 1]) add(box(0.5, h * 0.82, 0.5), tm, HG, { x: sx * (vw / 2 - 0.3), y: h * 0.41, z: -d / 2 - 4.1, edges: false });
      }
      add(box(2.4, 4.2, 0.3), M.dark, HG, { x: type === "L" ? 0 : -w * 0.15, y: 2.1, z: -d / 2 - 0.15, edges: false });   // 玄関の扉
    }
    const TYPES = ["box2", "box2", "L", "L", "court", "pitch"];
    // 区画(x0..x1 × z0..z1)。f = -1 なら北(z0)、+1 なら南(z1)の通りに門を開く
    function lot(x0, z0, x1, z1, f) {
      if (!lotFree(x0, z0, x1, z1)) return false;
      const W = x1 - x0, D = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (const [x, z] of [[x0, z0], [x1, z1], [x0, z1], [x1, z0]]) onLand(x, z);
      G.block(x0, z0, x1, z1);
      const LG = new THREE.Group(); LG.position.set(cx, 0, cz); LG.rotation.y = f < 0 ? 0 : Math.PI; group.add(LG);
      const toW = (lx, lz) => (f < 0 ? [cx + lx, cz + lz] : [cx - lx, cz - lz]);
      const hw = W / 2 - 0.4, hd = D / 2 - 0.4, wl = pick(GWALL), wh = vr(1.9, 2.6), t = 0.7;
      add(box(W - 1.2, 0.3, D - 1.2), VR() < 0.18 ? GRAVEL : pick(LAWNS), LG, { y: 0.15, edges: false });
      // 門: 車の門(幅 8)は片側、人の門(幅 2.4)は家の正面
      const gs = VR() < 0.5 ? -1 : 1, gx = gs * (hw - vr(5.5, 8)), sb = vr(6, 13);
      const hx0 = gs < 0 ? gx + 5.5 : -hw + 2.5, hx1 = gs < 0 ? hw - 2.5 : gx - 5.5;   // 家を置ける x の範囲
      const type = pick(TYPES), w = Math.min(hx1 - hx0, type === "court" ? vr(18, 22) : vr(13, 20)), d = Math.min(D - sb - 12, type === "court" ? vr(16, 20) : vr(10, 15));
      if (w < 10 || d < 8) { group.remove(LG); return false; }
      const hx = (hx0 + hx1) / 2 + vr(-1, 1) * Math.max(0, (hx1 - hx0 - w) / 2), hz = -hd + sb + d / 2;
      const px = Math.max(hx - w / 2 + 2, Math.min(hx + w / 2 - 2, hx - w * 0.15));
      const cuts = [[gx - 4, gx + 4], [px - 1.2, px + 1.2]].sort((a, b) => a[0] - b[0]);
      let sx = -hw;
      for (const [a, b] of cuts) { if (a - sx > 0.6) add(box(a - sx, wh, t), wl, LG, { x: (a + sx) / 2, y: wh / 2, z: -hd, edges: false }); sx = Math.max(sx, b); }
      if (hw - sx > 0.6) add(box(hw - sx, wh, t), wl, LG, { x: (hw + sx) / 2, y: wh / 2, z: -hd, edges: false });
      for (const s of [-1, 1]) add(box(t, wh + 0.3, D - 0.8), wl, LG, { x: s * hw, y: (wh + 0.3) / 2, edges: false });
      add(box(W - 0.8, wh + 0.3, t), wl, LG, { y: (wh + 0.3) / 2, z: hd, edges: false });
      for (const x of [gx - 4.4, gx + 4.4, px - 1.6, px + 1.6]) add(box(1.1, wh + 0.8, 1.1), wl, LG, { x, y: (wh + 0.8) / 2, z: -hd });   // 門柱
      add(box(8, wh * 0.85, 0.25), M.dark, LG, { x: gx, y: wh * 0.43, z: -hd + 0.3, edges: false });   // 車の門扉
      // 車寄せ(舗装)と、カーポートか車庫
      const dl = sb + vr(3, 8);
      add(box(6, 0.35, dl), paveD, LG, { x: gx, y: 0.35, z: -hd + dl / 2, edges: false });
      add(box(2, 0.32, sb), paving, LG, { x: px, y: 0.34, z: -hd + sb / 2, edges: false });                // 玄関へのアプローチ
      if (VR() < 0.45) {
        add(box(7.4, 0.4, 7.4), pick(TRIM), LG, { x: gx, y: 3.8, z: -hd + dl - 3.7 });
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(box(0.4, 3.6, 0.4), M.dark, LG, { x: gx + a * 3.4, y: 1.8, z: -hd + dl - 3.7 + b * 3.4, edges: false });
      } else {
        add(box(7.4, 4.6, 7), pick(WALLS), LG, { x: gx, y: 2.3, z: -hd + dl + 3.5 });
        add(box(6, 3.4, 0.25), M.mid, LG, { x: gx, y: 1.7, z: -hd + dl, edges: false });
      }
      const HG = new THREE.Group(); HG.position.set(hx, 0, hz); LG.add(HG);
      house(HG, type, w, d, toW, hx, hz);
      // 前庭: 花壇と木
      for (const [x, k] of [[px - 4.5, "bed"], [px + 4.5, "bed2"]]) if (x > -hw + 2 && x < hw - 2 && Math.abs(x - gx) > 5.5) { const [wx, wz] = toW(x, -hd + 2.2); G.slab(k, wx, wz, 5, 0.7, 1.6, Math.PI / 2); }
      { const [wx, wz] = toW(gs < 0 ? hw - 3 : -hw + 3, -hd + 3); G.put(VR() < 0.6 ? "palm" : "cypress", wx, wz, vr(0.7, 0.95)); }
      // 裏庭: プールかテラス、木、横の塀に沿う生け垣
      const zb = hz + d / 2, bd = hd - zb;
      if (bd > 15 && VR() < 0.45) {
        const pw = Math.min(w, 13), pz = zb + 2.5 + 4.5;
        add(box(pw + 3.5, 0.5, 9.5), paveD, LG, { x: hx, y: 0.35, z: pz, edges: false });
        const [wx, wz] = toW(hx, pz); pools.push([new THREE.PlaneGeometry(pw, 5.5).rotateX(-Math.PI / 2), { x: wx, y: 0.7, z: wz }]);   // 水面は槽の上
        add(box(pw + 0.6, 0.45, 6.1), poolBasin, LG, { x: hx, y: 0.4, z: pz, edges: false });                                            // 槽(水越しに見える青灰の底)
      } else if (bd > 6) add(box(w * 0.8, 0.35, 5), paving, LG, { x: hx, y: 0.32, z: zb + 2.6, edges: false });
      const nT = 2 + Math.floor(VR() * 3);
      for (let i = 0; i < nT; i++) {
        const lx = vr(-hw + 3, hw - 3), lz = vr(Math.min(hd - 3, zb + 4), hd - 3);
        if (Math.abs(lx - hx) < w / 2 + 1 && lz < zb + 9) continue;
        const [wx, wz] = toW(lx, lz); G.put(pick(["shade", "shade", "palm", "cypress"]), wx, wz, vr(0.6, 0.9));
      }
      for (const s of [-1, 1]) if (VR() < 0.6) { const [wx, wz] = toW(s * (hw - 1.4), (zb + hd) / 2); G.slab("hedge", wx, wz, 1.6, 1.5, Math.max(4, bd - 3), 0); }
      if (VR() < 0.35 && (type === "box2" || type === "court")) add(box(3.4, 0.2, 2.2), M.glass, HG, { x: w / 4, y: (type === "box2" ? 2 * ST : ST * 1.05) + 2, z: 0, rx: -0.5, edges: false });   // 屋上の太陽熱温水器
      return true;
    }
    // 通りの両側に区画を並べる(幅 30〜46。置けない所は 8 ずつ進めて詰める)
    function rowLots(xa, xb, z0, z1, f) {
      let x = xa, n = 0;
      while (x < xb - 26) {
        let w = vr(30, 46); if (xb - x - w < 26) w = Math.min(52, xb - x);
        if (lot(x, z0, x + w, z1, f)) { x += w; n++; } else x += 8;
      }
      return n;
    }
    let lots = 0;
    for (const [xa, xb] of [[-352, -74], [153, 352]]) {
      lots += rowLots(xa, xb, -289, -237, -1) + rowLots(xa, xb, -231, -179, 1) + rowLots(xa, xb, -157, -111, -1);
      lots += rowLots(xa, xb, -107, -70, 1) + rowLots(xa, xb, -50, -4, -1);
    }
    lots += rowLots(-232, 262, -352, -311, 1);

    // ── 邸宅街の地面(庭の芝の下地)と、空いた所の庭木 ──
    const yardG = M.lambert(0xd3d8c4), tiles = [];   // 区画の間の芝(縁の草地)
    for (let x = -360; x < 360; x += 24) for (let z = -360; z < 0; z += 24) if (Math.hypot(x + 12, z + 12) < R - 18) tiles.push([box(24, 0.12, 24), { x: x + 12, y: 0.06, z: z + 12 }]);
    add(U.merge(THREE, tiles), yardG, group, { edges: false });
    for (let i = 0; i < 700; i++) {   // 区画の間・通り沿いの空いた芝に庭木と生け垣
      const x = -352 + G.rnd() * 704, z = -356 + G.rnd() * 360;
      if (Math.hypot(x, z) > R - 12 || !G.free(x, z, 5)) continue;
      G.put(G.rnd() < 0.55 ? "shade" : G.rnd() < 0.6 ? "palm" : "cypress", x, z, 0.7 + G.rnd() * 0.3);
      if (G.rnd() < 0.5) G.slab("hedge", x + 6, z, 1.6, 1.2, 6 + G.rnd() * 8, G.rnd() < 0.5 ? 0 : Math.PI / 2);
      G.block(x - 7, z - 7, x + 7, z + 7);
    }

    // ── 水面(噴水・プール)をまとめて 1 つに。縁の草地 ──
    const poolMesh = new THREE.Mesh(U.merge(THREE, pools.map(([g, o]) => [g, o])), water); group.add(poolMesh);
    // 縁の草地: 密度を半分ほどにし、ノイズの塊に寄せる(一様に散らさない)。石は少なめ
    const clump = (x, z) => 0.5 + 0.3 * Math.sin(x / 41 + 1.3) * Math.sin(z / 33 - 0.7) + 0.2 * Math.sin((x - z) / 17 + 2.1);
    G.cover({ r0: 300, inner: 0.02, outer: 0.3, stones: 0.12, scrub: 0.3, avoid: (x, z) => clump(x, z) < 0.5 });
    G.finish();
    // 縁の草地の色を周りの地面(くすんだオリーブ・カーキ、暖かい灰の石)へ寄せる。共通の形は他の拠点と共有なので、この拠点のインスタンスの色だけを掛ける
    {
      const TINT = new Map([[G.GEO.tuft, [0.8, 0.8, 0.72]], [G.GEO.tuft2, [0.78, 0.78, 0.7]], [G.GEO.scrub, [0.84, 0.84, 0.78]], [G.GEO.stone, [0.8, 0.77, 0.72]], [G.GEO.stone2, [0.84, 0.8, 0.75]]]);
      const tc = new THREE.Color();
      for (const o of group.children) {
        const t = o.isInstancedMesh && TINT.get(o.geometry); if (!t) continue;
        for (let i = 0; i < o.count; i++) { const j = 0.94 + VR() * 0.08; o.setColorAt(i, tc.setRGB(t[0] * j, t[1] * j, t[2] * j)); }
        o.instanceColor.needsUpdate = true;
      }
    }

    U.bake(THREE, group, { live: [accent], also: [M.lamp] });
    return {
      group,
      setTeam: (c) => accent.color.set(c ?? 0x8f98a3),
      check: () => ({
        landPartsInWater: placed.filter(([x, z]) => ctx.isWater(x, z)).length,
        waterPartsOnLand: wet.filter(([x, z]) => !ctx.isWater(x, z)).length,
        shoreAtHQ: shoreZ(hx), hqFront: HQ.z1 + 17, marinaShore: mz, ferryShore: fz,
        groundItems: G.count(), groundItemsInWater: G.inWater(), villaLots: lots,
      }),
    };
  });
})();
