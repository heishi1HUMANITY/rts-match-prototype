// 装飾の層「西の平野」(マップ「運河地帯」)。部隊の 3D モデルを置いても地面が寂しく見えないように、平野を作り込む。
//   畑: 地形に沿った区画の板に畝(山と谷の折れ面。光の当たり方で筋が出る)。作物の色・耕した畑・果樹園。区画の間に畦道
//   用水路: 区画の列ごとに東西に走る細い水路(土の縁と共通の水面)。障壁の用水路・西の細い用水路の方から引く
//   木: 用水路と道路に沿った防風林(モクマオウ・ユーカリ風の細長い木)、村と屋敷のまわりのナツメヤシの林(葉を広げた形)、果樹園の柑橘の列、丘の低木
//   建物: 村(平屋根の家、屋上の手すり壁・水槽・階段室、窓、中庭の塀)、農家の屋敷(塀で囲った母屋・納屋・給水塔)、温室の列、鶏舎の列
//   送電線: 首都 A からの幹線道路に沿った格子の鉄塔と電線
// 改善(2 回目): 作物の種類(若い緑・実った緑・刈り跡と俵・耕した土・野菜の畝・水を張った田・休耕地)、区画の畦(土の盛り上がり)、
//   用水路の端の揚水小屋と途中の水門、俵と干し草の山、畑の角と畦道の木(枝の広い木)、丘の低木を丸い葉の茂みに作り直し、
//   村の家の壁の色・屋上の日よけ棚・衛星放送のアンテナ・太陽熱温水器、村の地面(踏み固めた土)
// 縮尺は拠点の建造物と同じ 0.6 単位/m を基準に、家と木は約 2 倍に誇張(ゲーム視点で読めるように)。宗教施設・人・車両は置かない。
// 置く範囲: x < -500(運河地帯の外)。水・道路・鉄道・障壁の用水路・拠点の制圧圏・首都の台・街並みの層の区域は避ける。高さは地形の格子と同じ補間で合わせる。
(function () {
  const C = {
    // 畑の色(3 回目): 彩度を 25〜35% 下げ、少し暗くした農地の色。若い緑はセージ、実った緑はオリーブ、刈り跡は麦わら、耕した土は暖かい茶
    young: [0xb0b996, 0xa7b18e, 0xb8bd9c, 0xadb48f], mature: [0x969f7b, 0x8e9874, 0x9fa581, 0x949a74], stubble: [0xd3c59f, 0xcdbe96, 0xd8cca9, 0xc9bc94],
    plow: [0xbea78a, 0xb49c80, 0xc5ae92, 0xab967d], veg: [0x9ea886, 0xa9ae8f, 0x98a183], paddy: 0x8a8a72, fallow: [0xcbc2aa, 0xc4baa0, 0xcfc8b2], orchardGround: 0xc5bba3,
    earth: 0xc9c0ad, bund: 0xbdb39d, path: 0xe0dbcd, vground: 0xdfd9ca, trunk: 0x857867, crown: 0x95a186, crownD: 0x849079, leaf: 0x909b80, citrus: 0x77866a,
    farm: [0x8f9a7e, 0x87937a, 0x9aa285, 0x8c9578], shrub: [0x9ea78a, 0x909c7e, 0xa7ae91, 0x98a083], straw: 0xd3c294, hay: 0xcab686,
    house: [0xfbfcfd, 0xf4f2ed, 0xeef0f2, 0xf6f3ea, 0xf1e6cf, 0xf0e0d6, 0xe3eaee, 0xf5eedb, 0xead6c4], glass: 0x34404b, tank: 0x9aa4ad, wire: 0x4a545e,
    solar: 0x3d4f66, dish: 0xe9ecef, pergola: 0xb9a68a,
  };
  const TOWNS = [[-740, 1450, 580, 400], [-480, -3150, 330, 300], [-2250, 2000, 360, 210]];   // 街並みの層の区域(中心、半幅 x、半幅 z)。湖畔の街は西の用水路沿いの遊歩道まで
  const S = 12.5;   // 地形の格子の間隔(suez.js の既定)

  function make(THREE, ctx) {
    const { U, M, k, landH, isWater, nearSite, nearLine, lineDist, barrier, lake, fbm, smooth, HALF } = ctx;
    const rnd = ctx.rng(4242);
    const group = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const col = (c) => new THREE.Color(c);

    // ── 地形の高さ: 地形の格子と同じ三角形の補間(格子の値は必要な所だけ計算して覚える) ──
    const NS = (2 * HALF) / S + 1, cache = new Float32Array(NS * NS).fill(NaN);
    const gv = (i, j) => { const q = j * NS + i; let v = cache[q]; if (v !== v) { v = cache[q] = Math.max(0.5, landH(-HALF + i * S, -HALF + j * S)); } return v; };
    const H = (x, z) => {
      const fx0 = (x + HALF) / S, fz0 = (z + HALF) / S, i = Math.max(0, Math.min(NS - 2, Math.floor(fx0))), j = Math.max(0, Math.min(NS - 2, Math.floor(fz0))), fx = fx0 - i, fz = fz0 - j;
      const a = gv(i, j), b = gv(i + 1, j), c = gv(i, j + 1), d = gv(i + 1, j + 1);
      return fx + fz < 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
    };

    // ── 置ける場所か ──
    const inTown = (x, z, pad) => TOWNS.some(([cx, cz, hx, hz]) => Math.abs(x - cx) < hx + pad && Math.abs(z - cz) < hz + pad);
    const valid = (x, z, pad = 0) => x < -500 && x > -HALF + 15 && Math.abs(z) < HALF - 15 && !isWater(x, z) && !nearSite(x, z, pad + 20) && !nearLine(x, z, 14 + pad)
      && lineDist(x, z, barrier.pts) > barrier.hw + 14 + pad && !inTown(x, z, pad) && Math.hypot((x - lake.cx) / lake.rx, (z - lake.cz) / lake.rz) > 1.1;
    // 占有の格子(10 単位): 畑・建物・林を置いた所に木や低木を重ねない
    const OX = -HALF, OW = 3600, OZ = -HALF, OD = 2 * HALF, OC = 10, occ = new Uint8Array((OW / OC) * (OD / OC));
    const oi = (x, z) => { const i = Math.floor((x - OX) / OC), j = Math.floor((z - OZ) / OC); return i < 0 || j < 0 || i >= OW / OC || j >= OD / OC ? -1 : j * (OW / OC) + i; };
    const occupied = (x, z) => { const q = oi(x, z); return q >= 0 && occ[q] > 0; };
    const markCircle = (x, z, r) => { for (let dz = -r; dz <= r; dz += OC) for (let dx = -r; dx <= r; dx += OC) if (dx * dx + dz * dz <= r * r) { const q = oi(x + dx, z + dz); if (q >= 0) occ[q] = 1; } };
    const obstacles = [];   // 村・屋敷・温室・林の円(畑を置かない)
    const blocked = (x, z, pad = 0) => obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad);

    // ── 木の形(頂点色の 1 つの形を InstancedMesh で並べる) ──
    const tint = (g, c) => ({ geo: g.index ? g.toNonIndexed() : g, color: col(c) });   // U.concat は添字なしの形を受け取る
    const WIND = U.concat(THREE, [
      tint(new THREE.CylinderGeometry(0.5, 0.8, 12, 6).translate(0, 6, 0), C.trunk),
      tint(new THREE.IcosahedronGeometry(1, 1).scale(4.4, 8.5, 4.4).translate(0, 15, 0), C.crown),
      tint(new THREE.IcosahedronGeometry(1, 1).scale(3.2, 6, 3.2).translate(0.6, 21.5, -0.4), C.crownD),
      tint(new THREE.IcosahedronGeometry(1, 1).scale(2.6, 3.8, 2.6).translate(-1.2, 11.5, 1.0), C.crownD),
    ]);
    const palmParts = [tint(new THREE.CylinderGeometry(0.55, 0.95, 17, 6, 2).translate(0, 8.5, 0), C.trunk), tint(new THREE.IcosahedronGeometry(1.4, 0).translate(0, 17, 0), C.crownD)];
    for (let f = 0; f < 9; f++) {   // 葉: 頂から外へ伸びて垂れる 3 枚の三角形
      const a = (f / 9) * Math.PI * 2 + (f % 2) * 0.2, ca = Math.cos(a), sa = Math.sin(a), side = (r, w) => [-sa * w, ca * w];
      const P = (r, y, w) => { const [px, pz] = side(r, w); return [ca * r + px, y, sa * r + pz]; };
      const pts = [P(0.4, 17.4, 0), P(4.5, 18.6, 1.3), P(4.5, 18.6, -1.3), P(9.5, 15.2, 0)];
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([...pts[0], ...pts[1], ...pts[2], ...pts[1], ...pts[3], ...pts[2]], 3)); g.computeVertexNormals();
      g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
      palmParts.push({ geo: g, color: col(C.leaf) });
    }
    const PALM = U.concat(THREE, palmParts).scale(1.4, 1.4, 1.4);   // 家に合わせて大きく
    const CITRUS = U.concat(THREE, [tint(new THREE.CylinderGeometry(0.35, 0.45, 2.4, 5).translate(0, 1.2, 0), C.trunk), tint(new THREE.IcosahedronGeometry(1, 1).scale(3.6, 3.1, 3.6).translate(0, 4.6, 0), C.citrus)]);
    // 茂み: 短い幹の上に丸い葉の塊(細かい多面体)を 3〜5 個。形を 3 種類作り、色は 1 本ずつ変える
    const shrubGeo = (seed, n) => {
      const r = ctx.rng(seed), ps = [tint(new THREE.CylinderGeometry(0.22, 0.34, 1.4, 5).translate(0, 0.7, 0), C.trunk)];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.8, d = i === 0 ? 0 : 0.9 + r() * 0.9, sz = (i === 0 ? 1.55 : 1.0 + r() * 0.5);
        ps.push(tint(new THREE.IcosahedronGeometry(1, 1).scale(sz * 1.15, sz * 0.9, sz * 1.05).translate(Math.cos(a) * d, 1.15 + sz * 0.75 + (i === 0 ? 0.35 : r() * 0.3), Math.sin(a) * d), [0xffffff, 0xe9ede4, 0xf4f6ef][i % 3]));
      }
      return U.concat(THREE, ps);
    };
    const SHRUBS = [shrubGeo(11, 4), shrubGeo(23, 5), shrubGeo(37, 3)];
    // 枝の広い木(畑の角・畦道): 幹と、横に広がる 4 つの葉の塊
    const farmGeo = (() => {
      const ps = [tint(new THREE.CylinderGeometry(0.55, 0.9, 9, 6).translate(0, 4.5, 0), C.trunk)];
      for (const [x, y, z, sx] of [[0, 11, 0, 5.8], [3.6, 9.6, 1.2, 4.2], [-3.2, 9.8, -1.6, 4.4], [0.6, 10.2, -3.6, 3.8], [-1.2, 13.4, 1.4, 3.6]]) ps.push(tint(new THREE.IcosahedronGeometry(1, 1).scale(sx, sx * 0.62, sx), 0xffffff));
      ps.slice(1).forEach((g, i) => g.geo.translate(...[[0, 11, 0], [3.6, 9.6, 1.2], [-3.2, 9.8, -1.6], [0.6, 10.2, -3.6], [-1.2, 13.4, 1.4]][i]));
      return U.concat(THREE, ps);
    })();
    // 俵(刈り跡の畑に転がる丸い俵)と干し草の山(屋敷・村のそば)
    const BALE = U.concat(THREE, [tint(new THREE.CylinderGeometry(1.5, 1.5, 1.8, 10).rotateZ(Math.PI / 2).translate(0, 1.45, 0), C.straw)]);
    const HAY = U.concat(THREE, [tint(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(4.6, 6.2, 4.6), C.hay), tint(new THREE.CylinderGeometry(4.7, 4.9, 1.2, 10).translate(0, 0.2, 0), C.hay)]);
    // 草むら(畑の外の空き地): 細い葉の束(三角錐を 4 本、外へ傾ける)
    const TUFT = (() => { const ps = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + (i % 3) * 0.3, hh = 1.6 + ((i * 7) % 5) * 0.28, g = new THREE.ConeGeometry(0.26, hh, 3, 1, true).translate(0, hh / 2, 0).rotateZ(0.28 + (i % 2) * 0.22).rotateY(a).translate(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35); ps.push(tint(g, i % 2 ? 0xffffff : 0xe3e8da)); } return U.concat(THREE, ps); })();
    const trees = { wind: [], palm: [], citrus: [], scrub0: [], scrub1: [], scrub2: [], farm: [], bale: [], hay: [], tuft: [] };
    const tree = (kind, x, z, s = 1) => { if (kind === "scrub") kind = "scrub" + Math.floor(rnd() * 3); trees[kind].push([x, H(x, z) - (kind === "bale" || kind === "hay" ? 0.3 : 0.6), z, s * (0.85 + rnd() * 0.3), rnd() * Math.PI * 2]); };

    // ── 建物の部品: 単位の箱・円柱を伸ばす(輪郭線も共有)。最後に焼いて 1 つにまとめる ──
    const B1 = k.box(1, 1, 1), C1 = k.cyl(1, 1, 10);
    const mats = {
      house: C.house.map((c) => M.lambert(c)), glass: M.lambert(C.glass), tank: M.lambert(C.tank), wall: M.light, dark: M.dark, mid: M.mid,
      green: M.lambert(0xf2f5f6, { side: THREE.DoubleSide }), roof: M.lambert(0xd9dde1),
      solar: M.lambert(C.solar), dish: M.lambert(C.dish, { side: THREE.DoubleSide }), pergola: M.lambert(C.pergola), conc: M.lambert(0xd6d9db), gate: M.lambert(0x5e6873),
      plant: M.lambert(0x93a383),
    };
    const D1 = new THREE.CylinderGeometry(1, 1, 0.25, 12);   // 衛星放送のアンテナの皿
    const part = (geo, mat, x, y, z, sx, sy, sz, ry = 0, edges = true) => { const m = k.add(geo, mat, group, { x, y, z, ry, edges }); m.scale.set(sx, sy, sz); return m; };
    // 局所の座標(中心 cx, cz、向き a)→ 地図の座標
    const frame = (cx, cz, a) => { const c = Math.cos(a), s = Math.sin(a); return (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c]; };
    const footH = (P, w, d) => { const hs = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [0, 0]].map(([a, b]) => H(...P(a, b))); return [Math.min(...hs), Math.max(...hs)]; };
    // 平屋根の家: 本体、屋上の手すり壁、水槽、階段室、窓、扉、中庭の塀
    function house(cx, cz, a, w, d, floors, mat) {
      const FH = 6.5, P = frame(cx, cz, a), [lo, hi] = footH(P, w, d), y0 = lo - 1.5, top = hi + floors * FH, h = top - y0;   // 1 階 6.5(約 2 倍に誇張)
      const at = (lx, lz) => P(lx, lz);
      part(B1, mat, ...[cx, y0 + h / 2, cz].map((v, i) => v), w, h, d, a);
      for (const [lx, lz, sx, sz] of [[0, -d / 2 + 0.3, w, 0.6], [0, d / 2 - 0.3, w, 0.6], [-w / 2 + 0.3, 0, 0.6, d], [w / 2 - 0.3, 0, 0.6, d]]) { const [x, z] = at(lx, lz); part(B1, mats.wall, x, top + 1, z, sx, 2, sz, a, false); }
      { const [x, z] = at(w * 0.25, -d * 0.2); part(C1, mats.tank, x, top + 2.2, z, 2.4, 4, 2.4, 0, false); }
      if (floors >= 2) { const [x, z] = at(-w / 2 + 2.6, d / 2 - 2.6); part(B1, mat, x, top + 2.6, z, 6.5, 5.2, 6.5, a); }
      for (let f = 0; f < floors; f++) for (const side of [-1, 1]) {   // 窓: 長い面に 1 階ごと
        const n = Math.max(1, Math.round(w / 9));
        for (let i = 0; i < n; i++) { const lx = -w / 2 + (w / n) * (i + 0.5), [x, z] = at(lx, side * (d / 2 + 0.12)); part(B1, mats.glass, x, hi + 3.4 + f * FH, z, 2.6, 2.6, 0.3, a, false); }
      }
      { const [x, z] = at(w * 0.3, d / 2 + 0.15); part(B1, mats.dark, x, hi + 2.2, z, 2.8, 4.4, 0.3, a, false); }
      // 屋上: 日よけ棚(柱と横木)、衛星放送のアンテナ、太陽熱温水器(傾いた集熱板と横置きの水槽)、植木鉢
      const roofy = top;
      if (rnd() < 0.35) {
        const pw = Math.min(10, w * 0.45), pd = Math.min(8, d * 0.5), pl = -w * 0.18, pz = d * 0.12;
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [x, z] = at(pl + (sx * pw) / 2, pz + (sz * pd) / 2); part(B1, mats.pergola, x, roofy + 2.2, z, 0.45, 4.4, 0.45, a, false); }
        for (let i = 0; i < 5; i++) { const [x, z] = at(pl - pw / 2 + (pw * i) / 4, pz); part(B1, mats.pergola, x, roofy + 4.5, z, 0.35, 0.3, pd + 1.2, a, false); }
        for (const sz of [-1, 1]) { const [x, z] = at(pl, pz + (sz * pd) / 2); part(B1, mats.pergola, x, roofy + 4.25, z, pw + 0.8, 0.35, 0.4, a, false); }
        for (let i = 0; i < 3; i++) { const [x, z] = at(pl - pw / 2 + 1 + i * 2.2, pz + pd / 2 + 1.4); part(B1, mats.plant, x, roofy + 0.9, z, 1.2, 1.4, 1.2, a, false); }
      }
      if (rnd() < 0.45) {   // アンテナの皿(柱の上に斜めに)
        const [x, z] = at(w / 2 - 2.2, -d / 2 + 2.2); part(B1, mats.mid, x, roofy + 1.2, z, 0.25, 2.4, 0.25, 0, false);
        const m = k.add(D1, mats.dish, group, { x, y: roofy + 2.5, z, rx: 0.9, ry: a + rnd() * 0.6, edges: false }); m.scale.set(1.3, 1, 1.3);
      }
      if (rnd() < 0.3) {   // 太陽熱温水器
        const [x, z] = at(w * 0.05, d * 0.3); const m = part(B1, mats.solar, x, roofy + 1.3, z, 4.2, 0.2, 2.6, a, false); m.rotation.set(0.55, a, 0, "YXZ");
        const [tx, tz] = at(w * 0.05, d * 0.3 - 1.8); const t = k.add(C1, mats.tank, group, { x: tx, y: roofy + 2.3, z: tz, rz: Math.PI / 2, edges: false }); t.scale.set(0.7, 4.2, 0.7); t.rotation.set(0, a, Math.PI / 2, "YXZ");
      }
      if (rnd() < 0.5) {   // 中庭の塀(家の後ろに U 字)
        const yd = 14 + rnd() * 10, wy = (lx, lz, sx, sz) => { const [x, z] = at(lx, lz); part(B1, mats.wall, x, H(x, z) + 1.2, z, sx, 4.4, sz, a); };
        wy(-w / 2 - 0.4, -d / 2 - yd / 2, 0.8, yd); wy(w / 2 + 0.4, -d / 2 - yd / 2, 0.8, yd); wy(-w / 4 - 1.5, -d / 2 - yd, w / 2 - 3, 0.8); wy(w / 4 + 1.5, -d / 2 - yd, w / 2 - 3, 0.8);
        const [tx, tz] = at(0, -d / 2 - yd / 2); if (rnd() < 0.6) tree("palm", tx, tz, 0.9);
      }
      markCircle(cx, cz, Math.max(w, d) * 0.75 + 10);
    }
    // 切妻の屋根(長さ L、幅 w、高さ rh)
    const gable = (w, rh, L) => { const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh)]); const g = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }); g.translate(0, 0, -L / 2); return g; };

    // ── 村: 西の道路沿い(道から少し離れた所)と、道から外れた所 ──
    const villages = [];
    for (const road of ctx.roads) for (const [x0, z0] of ctx.drape(road, 380)) {
      if (villages.length >= 14) break;
      const s = rnd() < 0.5 ? -1 : 1, off = 110 + rnd() * 90;
      const i = road.findIndex((p, n) => n > 0 && lineDist(x0, z0, [road[n - 1], p]) < 1), [ax, az] = road[Math.max(0, i - 1)], [bx, bz] = road[Math.max(1, i)];
      const l = Math.hypot(bx - ax, bz - az) || 1, x = x0 + (-(bz - az) / l) * off * s, z = z0 + ((bx - ax) / l) * off * s;
      if (x > -650 || !valid(x, z, 70) || villages.some((v) => Math.hypot(x - v.x, z - v.z) < 650)) continue;
      villages.push({ x, z, R: 110 + rnd() * 70, a: Math.atan2(bx - ax, bz - az) + (rnd() - 0.5) * 0.2 });
    }
    for (let t = 0; t < 400 && villages.length < 20; t++) {
      const x = -3800 + rnd() * 3200, z = -3700 + rnd() * 7400;
      if (!valid(x, z, 70) || villages.some((v) => Math.hypot(x - v.x, z - v.z) < 750)) continue;
      villages.push({ x, z, R: 90 + rnd() * 60, a: rnd() * Math.PI });
    }
    let houses = 0;
    for (const v of villages) {
      const P = frame(v.x, v.z, v.a);
      for (let gz = -v.R; gz <= v.R; gz += 46) for (let gx = -v.R; gx <= v.R; gx += 46) {
        if (gx * gx + gz * gz > v.R * v.R || rnd() < 0.3) continue;
        const [x, z] = P(gx + (rnd() - 0.5) * 6, gz + (rnd() - 0.5) * 6);
        if (!valid(x, z, 8) || occupied(x, z)) continue;
        house(x, z, v.a + (rnd() < 0.2 ? Math.PI / 2 : 0), 22 + rnd() * 12, 16 + rnd() * 9, 1 + Math.floor(rnd() * 2.6), mats.house[Math.floor(rnd() * mats.house.length)]);
        houses++;
      }
      obstacles.push({ x: v.x, z: v.z, r: v.R + 20 });
      // 村の外れの干し草の山
      for (let n = 0; n < 4; n++) { const ha = rnd() * Math.PI * 2, x = v.x + Math.cos(ha) * (v.R + 8), z = v.z + Math.sin(ha) * (v.R + 8); if (valid(x, z, 0) && !occupied(x, z)) tree("hay", x, z, 0.8 + rnd() * 0.3); }
      // 村のまわりのナツメヤシの林
      for (let g = 0; g < 2; g++) {
        const ga = rnd() * Math.PI * 2, gr = v.R + 40 + rnd() * 30, gx = v.x + Math.cos(ga) * gr, gz = v.z + Math.sin(ga) * gr, R = 40 + rnd() * 35;
        if (!valid(gx, gz, 10)) continue;
        for (let n = 0; n < R * 0.9; n++) { const r = Math.sqrt(rnd()) * R, b = rnd() * Math.PI * 2, x = gx + Math.cos(b) * r, z = gz + Math.sin(b) * r; if (valid(x, z, 0) && !occupied(x, z)) tree("palm", x, z); }
        obstacles.push({ x: gx, z: gz, r: R + 10 }); markCircle(gx, gz, R);
      }
    }
    // 農家の屋敷: 塀で囲った母屋・納屋・物置・給水塔、中のナツメヤシ
    const steads = [];
    for (let t = 0; t < 600 && steads.length < 12; t++) {
      const x = -3700 + rnd() * 3100, z = -3700 + rnd() * 7400;
      if (!valid(x, z, 80) || blocked(x, z, 140) || steads.some((s) => Math.hypot(x - s.x, z - s.z) < 450)) continue;
      steads.push({ x, z, a: rnd() * Math.PI });
    }
    for (const s of steads) {
      const P = frame(s.x, s.z, s.a), W = 96, D = 68;
      const wl = (lx, lz, sx, sz) => { const [x, z] = P(lx, lz); part(B1, mats.wall, x, H(x, z) + 1, z, sx, 3.6, sz, s.a); };
      wl(0, -D / 2, W, 0.9); wl(-W / 2, 0, 0.9, D); wl(W / 2, 0, 0.9, D); wl(-W / 4 - 4, D / 2, W / 2 - 8, 0.9); wl(W / 4 + 4, D / 2, W / 2 - 8, 0.9);
      { const [x, z] = P(-18, -12); house(x, z, s.a, 30, 20, 2, mats.house[0]); }
      { const [x, z] = P(24, -14), [lo, hi] = footH(frame(x, z, s.a), 36, 21), y0 = lo - 1.5; part(B1, mats.house[2], x, (y0 + hi + 13) / 2, z, 36, hi + 13 - y0, 21, s.a); k.add(gable(22, 7, 37), mats.roof, group, { x, y: hi + 13, z, ry: s.a + Math.PI / 2 }); }
      { const [x, z] = P(28, 20), hy = H(x, z); for (const [dx, dz] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) { const [px, pz] = P(28 + dx, 20 + dz); part(B1, mats.mid, px, hy + 8, pz, 0.9, 16, 0.9, s.a, false); } part(C1, mats.tank, x, hy + 19, z, 4.8, 7, 4.8, 0); }
      for (let n = 0; n < 8; n++) { const [x, z] = P(-40 + rnd() * 50, 10 + rnd() * 22); if (!occupied(x, z)) tree("palm", x, z); }
      // 干し草の山と積んだ俵(塀の外、納屋の側)
      for (let n = 0; n < 3 + Math.floor(rnd() * 3); n++) { const [x, z] = P(W / 2 + 12 + (n % 2) * 12, -20 + n * 11); if (valid(x, z, 0)) tree("hay", x, z, 0.9 + rnd() * 0.3); }
      for (let n = 0; n < 6; n++) { const [x, z] = P(W / 2 + 30, -22 + n * 4.2); if (valid(x, z, 0)) tree("bale", x, z, 1); }
      markCircle(s.x, s.z, 60); obstacles.push({ x: s.x, z: s.z, r: 70 });
    }
    // 温室の列(村の近く)と鶏舎の列(屋敷の近く)
    const tunnelG = new THREE.CylinderGeometry(6.5, 6.5, 54, 12, 1, false, 0, Math.PI); tunnelG.rotateZ(Math.PI / 2);
    let greenhouses = 0, sheds = 0;
    for (const v of villages) {
      if (rnd() < 0.35) continue;
      const ga = rnd() * Math.PI * 2, gx = v.x + Math.cos(ga) * (v.R + 110), gz = v.z + Math.sin(ga) * (v.R + 110), a = v.a, P = frame(gx, gz, a);
      if (!valid(gx, gz, 50) || blocked(gx, gz, 10)) continue;
      const n = 4 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) { const [x, z] = P(0, (i - n / 2) * 15), y = Math.min(...[-27, 27].map((lx) => H(...P(lx, (i - n / 2) * 15)))) - 0.4; k.add(tunnelG, mats.green, group, { x, y, z, ry: a, edges: false }); greenhouses++; }
      obstacles.push({ x: gx, z: gz, r: 30 + n * 8 }); markCircle(gx, gz, 30 + n * 8);
    }
    for (const s of steads) {
      if (rnd() < 0.4) continue;
      const ga = rnd() * Math.PI * 2, gx = s.x + Math.cos(ga) * 95, gz = s.z + Math.sin(ga) * 95, a = s.a, P = frame(gx, gz, a);
      if (!valid(gx, gz, 40) || blocked(gx, gz, 0)) continue;
      for (let i = 0; i < 3; i++) {
        const [x, z] = P((i - 1) * 18, 0), [lo, hi] = footH(frame(x, z, a), 11, 70), y0 = lo - 1;
        part(B1, mats.house[1], x, (y0 + hi + 4.2) / 2, z, 11, hi + 4.2 - y0, 70, a);
        k.add(gable(12, 2.6, 71), mats.roof, group, { x, y: hi + 4.2, z, ry: a });
        sheds++;
      }
      obstacles.push({ x: gx, z: gz, r: 60 }); markCircle(gx, gz, 55);
    }

    // ── 畑: 少し回した格子の区画。区画の列ごとに北の縁に用水路、区画の間に畦道 ──
    const ang = 0.08, ca = Math.cos(ang), sa = Math.sin(ang);
    const W = (u, v) => [u * ca - v * sa, u * sa + v * ca];   // u: ほぼ東西、v: ほぼ南北
    const BU = 320, BV = 210;
    const fpos = [], fcol = [], tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    const pushTri = (a, b, c, ca_, cb, cc) => {   // 上向きの面にそろえる
      tmpA.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); tmpB.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      const ny = tmpA.z * tmpB.x - tmpA.x * tmpB.z;
      if (ny >= 0) { fpos.push(...a, ...b, ...c); fcol.push(...ca_, ...cb, ...cc); } else { fpos.push(...a, ...c, ...b); fcol.push(...ca_, ...cc, ...cb); }
    };
    // 畝の板: 区画 (u0..u1, v0..v1) を畝の向き(alongU)に、間隔 sp・谷 lo・山 hi の折れ面で覆う
    // 色は頂点ごとに: 区画を横切る明暗の傾き(±5%)、畝ごとの濃淡(±3%)、雑音の斑(±4%)、用水路の側(v0)の暗い縁(-9%)
    function corrugate(u0, u1, v0, v1, alongU, sp, lo, hi, c, { ditch = false, peak = 0.88 } = {}) {
      const [a0, a1, b0, b1] = alongU ? [v0, v1, u0, u1] : [u0, u1, v0, v1];   // a = 畝を横切る向き、b = 畝の向き
      const n = Math.max(2, Math.round((a1 - a0) / sp)), m = Math.max(1, Math.ceil((b1 - b0) / 26));
      const ch = col(0xffffff).lerp(c, peak), ga = rnd() * Math.PI * 2, gx = Math.cos(ga), gz = Math.sin(ga), seed = rnd() * 50;
      const rowJ = Array.from({ length: n }, () => (rnd() - 0.5) * 0.06);
      const shade = (u, v, i) => {
        let f = 1 + 0.1 * (((u - u0) / (u1 - u0) - 0.5) * gx + ((v - v0) / (v1 - v0) - 0.5) * gz) + rowJ[i];
        const [x, z] = W(u, v); f += 0.08 * (fbm(x / 70 + seed, z / 70 - seed, 2) - 0.5);
        if (ditch) f -= 0.09 * (1 - smooth(0, 18, v - v0));
        return f;
      };
      const pt = (a, b, h, i, base) => { const [u, v] = alongU ? [b, a] : [a, b], [x, z] = W(u, v), f = shade(u, v, i); return { p: [x, H(x, z) + h, z], c: [base.r * f, base.g * f, base.b * f] }; };
      for (let i = 0; i < n; i++) {
        const ta = a0 + ((a1 - a0) * i) / n, tb = a0 + ((a1 - a0) * (i + 1)) / n, tm = (ta + tb) / 2;
        for (let j = 0; j < m; j++) {
          const sb = b0 + ((b1 - b0) * j) / m, se = b0 + ((b1 - b0) * (j + 1)) / m;
          const p1 = pt(ta, sb, lo, i, c), p2 = pt(tm, sb, hi, i, ch), p3 = pt(tm, se, hi, i, ch), p4 = pt(ta, se, lo, i, c), p5 = pt(tb, sb, lo, i, c), p6 = pt(tb, se, lo, i, c);
          const T = (a, b, d) => pushTri(a.p, b.p, d.p, a.c, b.c, d.c);
          T(p1, p2, p3); T(p1, p3, p4); T(p2, p5, p6); T(p2, p6, p3);
        }
      }
    }
    // 畦: 区画の縁に沿った土の盛り上がり(断面は三角形。幅 w、高さ h)
    const bundCol = col(C.bund), bc = [bundCol.r, bundCol.g, bundCol.b], bcl = (() => { const c2 = bundCol.clone().offsetHSL(0, 0, 0.05); return [c2.r, c2.g, c2.b]; })();
    function bund(u0, u1, v0, v1, w = 2.6, h = 0.95) {
      const ring = [[u0, v0], [u1, v0], [u1, v1], [u0, v1], [u0, v0]];
      for (let e = 0; e < 4; e++) {
        const [au, av] = ring[e], [bu_, bv_] = ring[e + 1], L = Math.hypot(bu_ - au, bv_ - av), n = Math.max(1, Math.ceil(L / 20)), du = (bu_ - au) / L, dv = (bv_ - av) / L, nu = -dv, nv = du;
        const pt = (u, v, o, y) => { const [x, z] = W(u + nu * o, v + nv * o); return [x, H(x, z) + y, z]; };
        for (let i = 0; i < n; i++) {
          const ua = au + ((bu_ - au) * i) / n, va = av + ((bv_ - av) * i) / n, ub = au + ((bu_ - au) * (i + 1)) / n, vb = av + ((bv_ - av) * (i + 1)) / n;
          const l0 = pt(ua, va, -w / 2, 0.15), c0 = pt(ua, va, 0, h), r0 = pt(ua, va, w / 2, 0.15), l1 = pt(ub, vb, -w / 2, 0.15), c1 = pt(ub, vb, 0, h), r1 = pt(ub, vb, w / 2, 0.15);
          pushTri(l0, c0, c1, bc, bcl, bcl); pushTri(l0, c1, l1, bc, bcl, bc); pushTri(c0, r0, r1, bcl, bc, bc); pushTri(c0, r1, c1, bcl, bc, bcl);
        }
      }
    }
    // 水を張った田の水面(区画を覆う格子。共通の水面の材質)
    const paddyGeos = [];
    function waterPlate(u0, u1, v0, v1, lift) {
      const n = Math.max(1, Math.ceil((u1 - u0) / 24)), m = Math.max(1, Math.ceil((v1 - v0) / 24)), pos = [], uv = [];
      const P = (i, j) => { const u = u0 + ((u1 - u0) * i) / n, v = v0 + ((v1 - v0) * j) / m, [x, z] = W(u, v); return [x, H(x, z) + lift, z, (x * 1) / U.WATER_TILE[0], (z * 1) / U.WATER_TILE[1]]; };
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
        for (const t of [0, 2, 1, 0, 3, 2]) { pos.push(q[t][0], q[t][1], q[t][2]); uv.push(q[t][3], q[t][4]); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      paddyGeos.push(g);
    }
    const pickc = (arr) => col(arr[Math.floor(rnd() * arr.length)]).offsetHSL((rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.04);
    const kinds = { young: 0, mature: 0, stubble: 0, plow: 0, veg: 0, paddy: 0, fallow: 0, orchard: 0 };
    // 区画 1 枚を作物の種類で埋める
    function fillParcel(u0, u1, v0, v1, nearDitch) {
      const r = rnd(), alongU = rnd() < 0.5, wet = nearDitch && fbm(u0 / 700 + 3, v0 / 700 - 7, 2) > 0.62;   // 所々の一部は水を張った田
      let kind;
      if (wet && r < 0.16) kind = "paddy";
      else if (r < 0.1) kind = "orchard"; else if (r < 0.28) kind = "plow"; else if (r < 0.42) kind = "stubble"; else if (r < 0.52) kind = "veg"; else if (r < 0.58) kind = "fallow"; else if (r < 0.78) kind = "young"; else kind = "mature";
      kinds[kind]++;
      if (kind === "orchard") {
        corrugate(u0, u1, v0, v1, alongU, 30, 0.35, 0.45, col(C.orchardGround));
        for (let v = v0 + 7; v < v1 - 4; v += 13) for (let u = u0 + 7; u < u1 - 4; u += 13) { const [x, z] = W(u, v); tree("citrus", x, z); }
      } else if (kind === "plow") corrugate(u0, u1, v0, v1, alongU, 4.2, 0.25, 0.8, pickc(C.plow), { ditch: nearDitch });
      else if (kind === "stubble") {
        corrugate(u0, u1, v0, v1, alongU, 2.8, 0.25, 0.42, pickc(C.stubble), { ditch: nearDitch });
        if (rnd() < 0.7) for (let v = v0 + 14; v < v1 - 8; v += 30) for (let u = u0 + 10 + rnd() * 8; u < u1 - 8; u += 16 + rnd() * 10) { const [x, z] = W(u, v + (rnd() - 0.5) * 4); tree("bale", x, z, 1); }   // 丸い俵の列
      } else if (kind === "veg") corrugate(u0, u1, v0, v1, alongU, 9, 0.25, 1.2, pickc(C.veg), { ditch: nearDitch });
      else if (kind === "paddy") { corrugate(u0, u1, v0, v1, alongU, 2.6, 0.1, 1.0, col(C.paddy).offsetHSL(0, 0, (rnd() - 0.5) * 0.03), { peak: 0.62 }); waterPlate(u0, u1, v0, v1, 0.5); }   // 苗の列(山)を細かく高めにして水面から出す。山の色は床に近いオリーブ
      else if (kind === "fallow") corrugate(u0, u1, v0, v1, alongU, 14, 0.3, 0.55, pickc(C.fallow), { ditch: nearDitch });
      else if (kind === "young") corrugate(u0, u1, v0, v1, alongU, 5, 0.25, 0.7, pickc(C.young), { ditch: nearDitch });
      else corrugate(u0, u1, v0, v1, alongU, 6.5, 0.3, 1.45, pickc(C.mature), { ditch: nearDitch });
      if (kind !== "orchard") bund(u0, u1, v0, v1);
      // 畑の角の枝の広い木(所々)
      if (rnd() < 0.16) { const [cu, cv] = [rnd() < 0.5 ? u0 + 2 : u1 - 2, rnd() < 0.5 ? v0 + 2 : v1 - 2], [x, z] = W(cu, cv); if (valid(x, z, 0)) tree("farm", x, z, 0.9 + rnd() * 0.4); }
    }
    const ditchRows = [];
    let parcels = 0, orchards = 0;
    const paths = [];
    const parcelOk = (u0, u1, v0, v1) => {
      const probe = [[u0, v0], [u1, v0], [u1, v1], [u0, v1], [(u0 + u1) / 2, (v0 + v1) / 2], [(u0 + u1) / 2, v0], [(u0 + u1) / 2, v1], [u0, (v0 + v1) / 2], [u1, (v0 + v1) / 2]].map(([u, v]) => W(u, v));
      if (probe.some(([x, z]) => !valid(x, z, 4) || blocked(x, z, 6))) return false;
      // 道路・鉄道・水が区画の中を横切らないか(20 単位ごとの格子で確かめる)
      for (let v = v0; v <= v1 + 0.1; v += Math.max(1, (v1 - v0) / Math.ceil((v1 - v0) / 20))) for (let u = u0; u <= u1 + 0.1; u += Math.max(1, (u1 - u0) / Math.ceil((u1 - u0) / 20))) {
        const [x, z] = W(u, v); if (nearLine(x, z, 16) || isWater(x, z)) return false;
      }
      const hs = probe.map(([x, z]) => H(x, z));
      return !(Math.max(...hs) > 12 || Math.max(...hs) - Math.min(...hs) > 6);   // 丘は畑にしない
    };
    // 区画を置く。置けなければ半分に分けて試す(道路・村の近くの隙間を埋める)
    function placeParcel(u0, u1, v0, v1, nearDitch, depth = 0) {
      if (u1 - u0 < 34) return false;
      if (parcelOk(u0, u1, v0, v1)) {
        fillParcel(u0, u1, v0, v1, nearDitch);
        for (let v = v0; v <= v1; v += 10) for (let u = u0; u <= u1; u += 10) { const q = oi(...W(u, v)); if (q >= 0) occ[q] = 1; }
        parcels++; return true;
      }
      if (depth > 3) return false;
      // 長い向きで半分に分けて試す(東西に走る鉄道・道路の帯は南北に分けると避けられる)
      if (v1 - v0 > 70 && (depth % 2 === 1 || u1 - u0 < 80)) {
        const m = (v0 + v1) / 2;
        const a = placeParcel(u0, u1, v0, m - 2.5, nearDitch, depth + 1), b = placeParcel(u0, u1, m + 2.5, v1, false, depth + 1);
        if (a && b) paths.push([W(u0 - 2, m), W(u1 + 2, m)]);
        return a || b;
      }
      const m = (u0 + u1) / 2;
      const a = placeParcel(u0, m - 2.5, v0, v1, nearDitch, depth + 1), b = placeParcel(m + 2.5, u1, v0, v1, nearDitch, depth + 1);
      if (a && b) paths.push([W(m, v0 - 2), W(m, v1 + 2)]);
      return a || b;
    }
    for (let bv = -HALF - 400; bv < HALF + 200; bv += BV) {
      ditchRows.push(bv);
      for (let bu = -HALF - 400; bu < -300; bu += BU) {
        // 区画の分け方: 2〜4 枚、幅はばらばら
        const n = 2 + Math.floor(rnd() * 3), cuts = [0]; for (let i = 1; i < n; i++) cuts.push(i / n + (rnd() - 0.5) * 0.12); cuts.push(1);
        for (let i = 0; i < n; i++) {
          const u0 = bu + 3 + cuts[i] * (BU - 6) + (i ? 3 : 0), u1 = bu + 3 + cuts[i + 1] * (BU - 6) - (i < n - 1 ? 3 : 0), v0 = bv + 14, v1 = bv + BV - 12;
          // 南北に 2 枚に分ける区画もある(北の 1 枚が用水路に接する)
          const split = rnd() < 0.35, vm = v0 + (v1 - v0) * (0.4 + rnd() * 0.2);
          const ok = split ? [placeParcel(u0, u1, v0, vm - 2.5, true), placeParcel(u0, u1, vm + 2.5, v1, false)].some(Boolean) : placeParcel(u0, u1, v0, v1, true);
          if (ok && split) paths.push([W(u0 - 2, vm), W(u1 + 2, vm)]);
          if (ok && i < n - 1) paths.push([W(u1 + 3, v0 - 2), W(u1 + 3, v1 + 2)]);   // 畦道(区画の間)
        }
      }
    }
    orchards = kinds.orchard;
    // 村の地面(踏み固めた明るい土。輪郭は雑音でゆがめた円、中心から輪を重ねて地形に沿わせる)
    const vgc = col(C.vground), vg = [vgc.r, vgc.g, vgc.b];
    for (const v of villages) {
      const R = v.R + 16, NA = 56, NR = 8;
      const rim = Array.from({ length: NA }, (_, i) => R * (0.82 + 0.3 * fbm(Math.cos((i / NA) * 6.283) * 1.3 + v.x * 0.01, Math.sin((i / NA) * 6.283) * 1.3 + v.z * 0.01, 2)));
      const P = (k, i) => { const a = (i / NA) * Math.PI * 2, r = (rim[i % NA] * k) / NR, x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r; return [x, H(x, z) + 0.12, z]; };
      for (let kk = 0; kk < NR; kk++) for (let i = 0; i < NA; i++) {
        const a0 = P(kk, i), a1 = P(kk, i + 1), b0 = P(kk + 1, i), b1 = P(kk + 1, i + 1);
        if ([b0, b1].some(([x, , z]) => isWater(x, z) || nearLine(x, z, 10))) continue;
        pushTri(a0, b0, b1, vg, vg, vg);
        if (kk > 0) pushTri(a0, b1, a1, vg, vg, vg);
      }
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fpos, 3)); fg.setAttribute("color", new THREE.Float32BufferAttribute(fcol, 3)); fg.computeVertexNormals();
    const fields = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); fields.userData.keep = true; group.add(fields);

    // ── 用水路(区画の列の北の縁を東西に): 土の縁と水面。水の帯は流れの線の向きに uv を付ける ──
    const ditchWater = U.waterMaterial(THREE, { opacity: 0.55 }); ditchWater.side = THREE.DoubleSide;
    // 水を張った田: 共通の水面を濃いめに(暗い濡れた地面の上で水と読める)
    if (paddyGeos.length) { const pw = U.waterMaterial(THREE, { opacity: 0.22 });   /* 水田の水面は薄く(ゲーム視点で青緑の板にならないように) */ pw.side = THREE.DoubleSide; group.add(new THREE.Mesh(U.concat(THREE, paddyGeos.map((g) => ({ geo: g }))), pw)); }
    // 揚水小屋(用水路の端、障壁の用水路・西の細い用水路の近く): 小屋、平屋根、管、架台の水槽。途中の水門(コンクリートの箱と鋼の扉)
    let pumps = 0, sluices = 0;
    const pumpShed = (x, z, a) => {
      const P = frame(x, z, a), hy = H(x, z);
      part(B1, mats.house[Math.floor(rnd() * 4)], x, hy + 2.6, z, 7, 6.2, 5.5, a);
      part(B1, mats.roof, x, hy + 6.0, z, 8, 0.5, 6.5, a);
      { const [px, pz] = P(0, 4.6); part(C1, mats.dark, px, hy + 1.1, pz, 0.6, 2.2, 0.6, 0, false); }
      { const [px, pz] = P(0, 3.4); const m = part(C1, mats.dark, px, hy + 2.0, pz, 0.45, 2.6, 0.45, a, false); m.rotation.set(Math.PI / 2, a, 0, "YXZ"); }
      { const [px, pz] = P(-5.2, -1); for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [qx, qz] = P(-5.2 + dx * 1.2, -1 + dz * 1.2); part(B1, mats.mid, qx, hy + 2.2, qz, 0.3, 4.4, 0.3, a, false); } part(C1, mats.tank, px, hy + 5.4, pz, 1.8, 2.4, 1.8, 0, false); }
      markCircle(x, z, 10); pumps++;
    };
    const sluice = (x, z, a) => { const hy = H(x, z); part(B1, mats.conc, x, hy + 0.9, z, 3.2, 2.4, 11, a); part(B1, mats.gate, x, hy + 1.6, z, 0.4, 2.4, 6, a, false); sluices++; };
    const waterStrip = (pts, w, lift) => {
      const pos = [], uv = []; let L = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, px = (-(bz - az) / l) * (w / 2), pz = ((bx - ax) / l) * (w / 2);
        const ya = H(ax, az) + lift, yb = H(bx, bz) + lift, va = L / U.WATER_TILE[1], vb = (L + l) / U.WATER_TILE[1], uw = w / U.WATER_TILE[0];
        const q = [[ax + px, ya, az + pz, 0, va], [bx + px, yb, bz + pz, 0, vb], [bx - px, yb, bz - pz, uw, vb], [ax - px, ya, az - pz, uw, va]];
        for (const j of [0, 1, 2, 0, 2, 3]) { pos.push(q[j][0], q[j][1], q[j][2]); uv.push(q[j][3], q[j][4]); }
        L += l;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      return g;
    };
    const earthParts = [], waterParts = [], pathParts = [];
    let ditchLen = 0;
    ditchRows.forEach((bv, row) => {
      let cur = [];
      const flush = () => {
        if (cur.length > 4) {
          const draped = cur.map(([x, z]) => [x, z]);
          earthParts.push(ctx.strip(draped, 10, 0.18, H)); waterParts.push(waterStrip(draped, 4.2, 0.32)); ditchLen += (cur.length - 1) * 15;
          // 端が障壁の用水路・西の細い用水路の近くなら揚水小屋、途中に水門
          for (const [ex, ez, s] of [[...cur[0], 1], [...cur[cur.length - 1], -1]]) {
            if (lineDist(ex, ez, barrier.pts) < barrier.hw + 70 || lineDist(ex, ez, ctx.fresh.pts) < 70) {
              const [u, v] = [ex * ca + ez * sa, -ex * sa + ez * ca], [px, pz] = W(u + s * 8, v - 10);
              if (valid(px, pz, 0) && !occupied(px, pz)) pumpShed(px, pz, ang);
            }
          }
          for (let i = 18; i < cur.length - 6; i += 22) sluice(cur[i][0], cur[i][1], ang);
          if (row % 2 === 0) for (let i = 0; i < cur.length; i++) {   // 防風林: 用水路の南の縁(所々切れる)
            const [x, z] = cur[i], [u, v] = [x * ca + z * sa, -x * sa + z * ca], [tx, tz] = W(u + (rnd() - 0.5) * 3, v + 8);
            if (fbm(x / 260, z / 260, 2) > 0.42 && i % 1 === 0 && valid(tx, tz, 0)) tree("wind", tx, tz, 1);
          }
        }
        cur = [];
      };
      for (let u = -HALF - 400; u < -300; u += 15) {
        const [x, z] = W(u, bv);
        if (valid(x, z, 2) && !blocked(x, z, 0)) cur.push([x, z]); else flush();
      }
      flush();
    });
    for (const [a, b] of paths) {
      if ([0, 0.2, 0.4, 0.6, 0.8, 1].some((t) => { const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; return isWater(x, z) || nearLine(x, z, 12) || blocked(x, z, 0); })) continue;   // 水・道路・村にかかる畦道は描かない
      pathParts.push(ctx.strip([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b], 4.5, 0.3, H));
      if (rnd() < 0.3) { const t = 0.2 + rnd() * 0.6, x = a[0] + (b[0] - a[0]) * t + 4, z = a[1] + (b[1] - a[1]) * t; if (valid(x, z, 0)) tree("farm", x, z, 0.8 + rnd() * 0.4); }   // 畦道の木
    }
    const mergeGeos = (geos) => { const items = geos.map((g) => ({ geo: g })); return items.length ? U.concat(THREE, items) : null; };
    const eg = mergeGeos(earthParts); if (eg) { const m = new THREE.Mesh(eg, M.lambert(C.earth)); m.userData.keep = true; group.add(m); }
    const wg = mergeGeos(waterParts); if (wg) group.add(new THREE.Mesh(wg, ditchWater));
    const pg = mergeGeos(pathParts); if (pg) { const m = new THREE.Mesh(pg, M.lambert(C.path)); m.userData.keep = true; group.add(m); }

    // ── 道路沿いの並木(ユーカリ)と、西の細い用水路沿いのナツメヤシ ──
    for (const road of ctx.roads) {
      const pts = ctx.drape(road, 17);
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l, nz = (bx - ax) / l;
        if (fbm(ax / 300 + 5, az / 300, 2) < 0.45) continue;
        for (const s of [-1, 1]) { const x = ax + nx * 21 * s, z = az + nz * 21 * s; if (valid(x, z, 0) && !occupied(x, z)) tree("wind", x, z, 1.1); }
      }
    }
    for (const [x0, z0] of ctx.drape(ctx.fresh.pts, 14)) for (const s of [-1, 1]) {
      const x = x0 + (rnd() - 0.5) * 6, z = z0 + s * (30 + rnd() * 14);
      if (rnd() < 0.7 && valid(x, z, -10) && !occupied(x, z)) tree("palm", x, z);
    }

    // ── 丘の低木(高い所ほど多い)と、畑の外の空き地の低木 ──
    for (let t = 0; t < 26000; t++) {
      const x = -3980 + rnd() * 3480, z = -3980 + rnd() * 7960, h = H(x, z);
      if (rnd() > (h > 9 ? 0.85 : 0.05) || occupied(x, z) || !valid(x, z, 0)) continue;
      tree("scrub", x, z, h > 9 ? 1 + rnd() * 0.5 : 0.8);
    }

    // ── 草むら: 畑・村・林の外の空き地(雑音で疎密)、用水路の縁は多め ──
    for (let t = 0; t < 600000; t++) {
      const x = -3990 + rnd() * 3490, z = -3990 + rnd() * 7980;
      const dens = 0.15 + 0.85 * Math.max(0, fbm(x / 160 + 9, z / 160 - 4, 2) - 0.35) * 2.2;
      if (rnd() > dens || occupied(x, z) || !valid(x, z, -6)) continue;
      tree("tuft", x, z, 1.2 + rnd() * 0.8);
    }

    // ── 送電線: 首都 A からの幹線道路に沿って(道路の北側 45)、格子の鉄塔と電線 ──
    const wires = [];
    let pylons = 0;
    for (const ri of [1, 2]) {
      const road = ctx.roads[ri], pts = ctx.drape(road, 230), towers = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, z0] = pts[i], [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(bx - ax, bz - az) || 1;
        const nx = -(bz - az) / l, nz = (bx - ax) / l, x = x0 + nx * 45, z = z0 + nz * 45;
        if (!valid(x, z, 4) || occupied(x, z)) { towers.push(null); continue; }
        const y = H(x, z), a = Math.atan2(bx - ax, bz - az);
        k.lattice(group, V(x, y - 1, z), 62, 4.4, 1.4, 4, 0.36, M.mid);
        const arms = [];
        for (const [hy, half] of [[48, 11], [57, 8]]) {
          const ux = Math.cos(a), uz = -Math.sin(a);   // 線に直角の向き
          k.beam(group, V(x - ux * half, y + hy, z - uz * half), V(x + ux * half, y + hy, z + uz * half), 0.9, M.mid);
          for (const s of [-1, 1]) { const px = x + ux * half * s, pz = z + uz * half * s; part(C1, mats.dark, px, y + hy - 1.6, pz, 0.35, 3.2, 0.35, 0, false); arms.push([px, y + hy - 3.2, pz]); }
        }
        markCircle(x, z, 8); towers.push(arms); pylons++;
      }
      for (let i = 1; i < towers.length; i++) if (towers[i] && towers[i - 1]) for (let c = 0; c < 4; c++) {   // 電線(たるみ 8)
        const a = towers[i - 1][c], b = towers[i][c];
        for (let s = 0; s < 12; s++) { const t0 = s / 12, t1 = (s + 1) / 12, sag = (t) => -8 * 4 * t * (1 - t); wires.push(a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 + sag(t0), a[2] + (b[2] - a[2]) * t0, a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 + sag(t1), a[2] + (b[2] - a[2]) * t1); }
      }
    }
    if (wires.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3)); group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: C.wire, transparent: true, opacity: 0.7 }))); }

    // ── 木を InstancedMesh に(種類ごとに 1 つ。少し色をばらす) ──
    const instMat = (side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side });
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = V(0, 1, 0), tc = new THREE.Color();
    const counts = {};
    // 色: 茂みと枝の広い木は葉の色の組から 1 本ずつ(頂点色は明るさの差だけ)、ほかは明るさを少しばらす
    const tintOf = { scrub0: C.shrub, scrub1: C.shrub, scrub2: C.shrub, farm: C.farm, tuft: [0xafb797, 0xa4ad8c, 0xbcbfa1, 0xb6b18e, 0xa9aa88] };
    for (const [kind, geo, side] of [["wind", WIND], ["palm", PALM, THREE.DoubleSide], ["citrus", CITRUS], ["scrub0", SHRUBS[0]], ["scrub1", SHRUBS[1]], ["scrub2", SHRUBS[2]], ["farm", farmGeo], ["bale", BALE], ["hay", HAY], ["tuft", TUFT]]) {
      const list = trees[kind]; counts[kind] = list.length; if (!list.length) continue;
      const im = new THREE.InstancedMesh(geo, instMat(side), list.length);
      list.forEach(([x, y, z, s, r], i) => {
        const flat = kind === "bale" || kind === "hay";
        mt.compose(V(x, y, z), q.setFromAxisAngle(up, r), sc.set(s, flat ? s : s * (0.9 + rnd() * 0.25), s)); im.setMatrixAt(i, mt);
        if (tintOf[kind]) im.setColorAt(i, tc.set(tintOf[kind][Math.floor(rnd() * tintOf[kind].length)]).multiplyScalar(0.94 + rnd() * 0.12));
        else if (flat) im.setColorAt(i, tc.setScalar(0.92 + rnd() * 0.12));
        else { const b = 0.9 + rnd() * 0.12; im.setColorAt(i, tc.setRGB(b * (0.97 + rnd() * 0.06), b * (0.97 + rnd() * 0.05), b * (0.95 + rnd() * 0.05))); }   // 防風林・ヤシ・柑橘: 1 本ずつ色相も少し変える
      });
      group.add(im);
    }

    U.bake(THREE, group, {});
    const info = { villages: villages.length, houses, steads: steads.length, greenhouses, sheds, parcels, kinds, pumps, sluices, ditchLen: Math.round(ditchLen), pylons, trees: counts };
    return { group, info };
  }

  const maps = ((window.DreamAssets ??= {}).maps ??= { sites: {} });
  if (maps.deco) maps.deco("west", make); else (maps.decos ??= {}).west = make;
})();
