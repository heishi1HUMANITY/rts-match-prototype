// スエズ運河マップの拠点 1「フェルダン旋回橋」(マップの中心のモチーフ)。旧運河と新運河にはさまれた中州の上。
// 旧運河にエル・フェルダン鉄道旋回橋(左右 2 本の旋回トラスが運河の中央で突き合わせる)、新運河に新しい旋回橋。どちらも中州と両岸の旋回軸の上で 90° 回る。
// 縮尺 0.6 単位/m を基本に、トラスの背(旋回軸の上で 85 単位、実物の約 2.5 倍)と幅(床 26 単位)を誇張してゲーム視点の主役にした。腕の長さは運河の幅(2 倍に誇張済み)に合わせた。
// 状態: 閉(線路がつながる。船は手前で待つ)⇄ 開(腕が運河と平行になり、旧運河を南へコンテナ船、新運河を北へタンカーが通る)。閉鎖は船が橋の範囲を抜けるまで待つ。
// 座標は拠点の中心が原点(地図の x = 200, z = 0)。旧運河 x ∈ [-280, -120]、新運河 x ∈ [120, 280]、線路は z = 0 を西から東へ。
(function () {
  // ── 拠点の地面の作り込みの共通部品(北・中央の拠点 ferdan / ballah / peace / qantara で使う。DreamAssets.maps.siteDress) ──
  // 制圧圏の中の舗装・芝・駐車場・道・柵・低い壁・街灯・小屋・資材の山・植えた木と、縁の草・低木・石(外の装飾の層となじませる)。
  // 制圧圏の中の地形は高さ 0.5(suez.js の台)。面の上端: 砂利 0.62、芝 0.7、舗装 0.85、白線 0.93、縁石 1.25(面どうしが重ならない)。
  // solid(建物・柵・既存の構造物・地図の道路・旋回の範囲)と surf(舗装・芝)の占有の格子で、物どうしと草が重ならないようにする。
  // 草・木・石は頂点色の 1 メッシュ(描画 1)、街灯の灯は 1 メッシュ(描画 1)。ほかは Lambert の箱で、拠点の焼き込みで 1 つにまとまる。
  function siteDress(THREE, ctx, group, opts = {}) {
    const { U, M, k } = ctx, r = ctx.point.r, G0 = 0.5, rnd = U.rng(opts.seed ?? 11);
    const C = {
      asphalt: 0xb4bcc3, asphalt2: 0xaab2ba, concrete: 0xe2e5e7, pavers: 0xd9d5cc, gravel: 0xd2ccbe, lawn: 0xc4cfb7, lawn2: 0xbac7ab,
      line: 0xf7f8f8, kerb: 0xeceeee, drain: 0x9aa3ab, white: 0xf6f7f8, white2: 0xeef0f2, roof: 0xd5d9dd, wood: 0xa48d78, block: 0xc9ced2, pipe: 0x9aa4ad,
      tuft: 0xb8bb9c, tuft2: 0xc6c6a8, scrub: 0xa5ac94, scrubD: 0x939b84, stone: 0xcac3b3, stone2: 0xb9b1a1, trunk: 0x8a7d6a, crown: 0x8f9f84, crownD: 0x7f9076, leaf: 0x94a586, round: 0x8fa287,
    };
    const TOP = { gravel: 0.62, lawn: 0.7, pave: 0.85, line: 0.93, kerb: 1.25 };
    const mats = new Map(), MC = (c) => mats.get(c) ?? mats.set(c, M.lambert(c)).get(c);
    const B1 = k.box(1, 1, 1), C8 = k.cyl(1, 1, 8), C12 = k.cyl(1, 1, 12);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const part = (geo, m, x, y, z, sx, sy, sz, ry = 0, edges = false, rx = 0, rz = 0) => { const o = k.add(geo, m, group, { x, y, z, rx, ry, rz, edges }); o.scale.set(sx, sy, sz); return o; };
    const frame = (cx, cz, a = 0) => { const c = Math.cos(a), s = Math.sin(a); return (u, v) => [cx + u * c + v * s, cz - u * s + v * c]; };
    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    // ── 占有の格子 ──
    const OC = 3, RR = r + 80, NG = Math.ceil((2 * RR) / OC), solid = new Uint8Array(NG * NG), surf = new Uint8Array(NG * NG);
    const gi = (x, z) => { const i = Math.floor((x + RR) / OC), j = Math.floor((z + RR) / OC); return i < 0 || j < 0 || i >= NG || j >= NG ? -1 : j * NG + i; };
    const mark = (g, x, z) => { const q = gi(x, z); if (q >= 0) g[q] = 1; };
    const at = (g, x, z) => { const q = gi(x, z); return q >= 0 && g[q] > 0; };
    const markRect = (g, cx, cz, w, d, a = 0, pad = 0) => { const P = frame(cx, cz, a); for (let u = -w / 2 - pad; u <= w / 2 + pad + 0.01; u += OC / 2) for (let v = -d / 2 - pad; v <= d / 2 + pad + 0.01; v += OC / 2) mark(g, ...P(u, v)); };
    const markCircle = (g, cx, cz, rad) => { for (let dz = -rad; dz <= rad; dz += OC / 2) for (let dx = -rad; dx <= rad; dx += OC / 2) if (dx * dx + dz * dz <= rad * rad) mark(g, cx + dx, cz + dz); };
    const segs = (pts, fn) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L > 0.01) fn((ax + bx) / 2, (az + bz) / 2, L, Math.atan2(bx - ax, bz - az), ax, az, bx, bz); } };
    const markLine = (g, pts, w) => segs(pts, (mx, mz, L, a) => markRect(g, mx, mz, w, L, a));
    const wet = (x, z, m = 8) => ctx.isWater(x, z) || ctx.isWater(x + m, z) || ctx.isWater(x - m, z) || ctx.isWater(x, z + m) || ctx.isWater(x, z - m);
    const placed = [];   // 置いた物の点(check で水の中を数える)
    const rectFree = (cx, cz, w, d, a = 0, pad = 2) => { const P = frame(cx, cz, a); for (let u = -w / 2 - pad; u <= w / 2 + pad + 0.01; u += OC) for (let v = -d / 2 - pad; v <= d / 2 + pad + 0.01; v += OC) { const [x, z] = P(u, v); if (wet(x, z, 3) || at(solid, x, z)) return false; } return true; };
    // 既存の構造物・通れない所を登録する
    const block = {
      rect: (cx, cz, w, d, a = 0, pad = 3) => markRect(solid, cx, cz, w, d, a, pad),
      circle: (cx, cz, rad) => markCircle(solid, cx, cz, rad),
      line: (pts, w) => markLine(solid, pts, w),
    };
    // 地図の旗竿の場所(suez.js と同じ探し方)
    {
      let fx = r * 0.72, fz = r * 0.52;
      for (let a = 0.62; a < 0.62 + Math.PI * 2; a += 0.15) { const x = Math.cos(a) * r * 0.85, z = Math.sin(a) * r * 0.85; if (![0, 25, -25].some((d) => ctx.isWater(x + d, z) || ctx.isWater(x, z + d))) { fx = x; fz = z; break; } }
      block.circle(fx, fz, 12);
    }
    // ── 面: 板(下端 0、上端 top)。舗装・芝・砂利 ──
    function slab(cx, cz, w, d, a = 0, color = C.concrete, top = TOP.pave) { part(B1, MC(color), cx, top / 2, cz, w, top, d, a); markRect(surf, cx, cz, w, d, a); }
    function line(cx, cz, len, w = 0.45, a = 0, top = TOP.line, color = C.line) { part(B1, MC(color), cx, top - 0.05, cz, w, 0.1, len, a); }
    function kerbRect(cx, cz, w, d, a = 0, t = 0.8, color = C.kerb) {
      const P = frame(cx, cz, a);
      for (const [u, v, ww, dd] of [[0, -d / 2, w + t, t], [0, d / 2, w + t, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]]) { const [x, z] = P(u, v); part(B1, MC(color), x, TOP.kerb / 2, z, ww, TOP.kerb, dd, a); }
    }
    const lampHeads = [], redLights = [];
    function lamp(x, z, a = 0, h = 12, two = false) {
      if (wet(x, z, 2)) return;
      part(C8, M.mid, x, G0 + h / 2, z, 0.32, h, 0.32);
      for (const s of two ? [-1, 1] : [1]) {
        const dx = Math.sin(a) * s, dz = Math.cos(a) * s;
        part(B1, M.mid, x + dx * 1.3, G0 + h - 0.1, z + dz * 1.3, 0.28, 0.28, 2.6, a);
        lampHeads.push([B1, { x: x + dx * 2.8, y: G0 + h - 0.45, z: z + dz * 2.8, ry: a, sx: 1.1, sy: 0.3, sz: 1.6 }]);
      }
      mark(solid, x, z); placed.push([x, z]);
    }
    // 舗装の道(折れ線)。中央の破線、両側の縁石、側溝
    function road(pts, w = 10, { dash = true, kerb = true, drain = true, edge = false, color = C.asphalt } = {}) {
      segs(pts, (mx, mz, L, a) => {
        slab(mx, mz, w, L + (kerb ? 0 : 0.5), a, color);
        const P = frame(mx, mz, a);
        if (dash) for (let t = -L / 2 + 3; t < L / 2 - 2; t += 9) { const [x, z] = P(0, t + 2); line(x, z, 4, 0.45, a); }
        if (edge) for (const s of [-1, 1]) { const [x, z] = P(s * (w / 2 - 1), 0); line(x, z, L, 0.4, a); }
        for (const s of [-1, 1]) {
          if (kerb) { const [x, z] = P(s * (w / 2 + 0.4), 0); part(B1, MC(C.kerb), x, TOP.kerb / 2, z, 0.8, TOP.kerb, L, a); }
          if (drain) { const [x, z] = P(s * (w / 2 + 1.6), 0); part(B1, MC(C.drain), x, 0.66 / 2, z, 1.4, 0.66, L, a); }
        }
      });
      markLine(surf, pts, w + 4);
    }
    // 地図の道路を台の上で描き直す(suez.js の道路は台の上で地形と同じ高さになり、ちらつくため)。制圧圏 + 36 の中だけ
    function mapRoad(pts, w = 22) {
      const R2 = r + 36;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(L / 2));
        let t0 = null;
        for (let j = 0; j <= n; j++) {
          const t = j / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, inside = Math.hypot(x, z) < R2;
          if (inside && t0 === null) t0 = t;
          if ((!inside || j === n) && t0 !== null) {
            const t1 = inside ? t : (j - 1) / n, ux = (bx - ax) / L, uz = (bz - az) / L, e0 = i > 0 && t0 === 0 ? 11 : 0, e1 = i < pts.length - 2 && t1 === 1 ? 11 : 0;   // 折れ目は両側へ半幅だけ延ばして継ぎ目の欠けをふさぐ
            if ((t1 - t0) * L > 4) road([[ax + (bx - ax) * t0 - ux * e0, az + (bz - az) * t0 - uz * e0], [ax + (bx - ax) * t1 + ux * e1, az + (bz - az) * t1 + uz * e1]], w, { kerb: false, drain: false, edge: true, color: 0xb9c0c7 });
            t0 = null;
          }
        }
      }
    }
    // 駐車場: n 台 × rows 列(枠の白線、縁石)
    function parking(cx, cz, a, n, { bay = 5.6, depth = 10, rows = 2, aisle = 12 } = {}) {
      const W = n * bay, D = rows * depth + (rows > 1 ? aisle : 0), P = frame(cx, cz, a);
      slab(cx, cz, W + 4, D + 4, a, C.asphalt2);
      kerbRect(cx, cz, W + 4, D + 4, a);
      for (let row = 0; row < rows; row++) {
        const v0 = row === 0 ? -D / 2 : D / 2 - depth;
        for (let i = 0; i <= n; i++) { const [x, z] = P(-W / 2 + i * bay, v0 + depth / 2); line(x, z, depth, 0.4, a); }
        const [x, z] = P(0, row === 0 ? v0 + depth : v0); line(x, z, W, 0.4, a + Math.PI / 2);
      }
      markRect(solid, cx, cz, W + 4, D + 4, a, 1);
    }
    // 柵(柱と 3 本の横木)と低い壁(笠石つき)
    function fence(pts, { h = 3.6, step = 6, gap = null } = {}) {
      segs(pts, (mx, mz, L, a, ax, az, bx, bz) => {
        const n = Math.max(1, Math.round(L / step));
        for (let j = 0; j <= n; j++) { const x = ax + ((bx - ax) * j) / n, z = az + ((bz - az) * j) / n; if (gap && Math.hypot(x - gap[0], z - gap[1]) < gap[2]) continue; if (!wet(x, z, 1)) part(B1, M.dark, x, G0 + h / 2, z, 0.35, h, 0.35); }
        for (const y of [0.9, h * 0.55, h - 0.25]) {
          if (gap) {   // 門の所で横木を切る
            const t0 = Math.max(0, ((gap[0] - ax) * (bx - ax) + (gap[1] - az) * (bz - az)) / (L * L)), cx = ax + (bx - ax) * t0, cz = az + (bz - az) * t0;
            if (Math.hypot(cx - gap[0], cz - gap[1]) < 1 && t0 > 0 && t0 < 1) {
              for (const [p0, p1] of [[[ax, az], [cx - ((bx - ax) / L) * gap[2], cz - ((bz - az) / L) * gap[2]]], [[cx + ((bx - ax) / L) * gap[2], cz + ((bz - az) / L) * gap[2]], [bx, bz]]]) {
                const l2 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); if (l2 > 0.5) part(B1, M.mid, (p0[0] + p1[0]) / 2, G0 + y, (p0[1] + p1[1]) / 2, 0.16, 0.16, l2, a);
              }
              continue;
            }
          }
          part(B1, M.mid, mx, G0 + y, mz, 0.16, 0.16, L, a);
        }
      });
      markLine(solid, pts, 2);
    }
    function wall(pts, { h = 2.2, t = 1.1, color = C.white2 } = {}) {
      segs(pts, (mx, mz, L, a) => { part(B1, MC(color), mx, h / 2, mz, t, h, L + t, a, true); part(B1, MC(C.kerb), mx, h + 0.2, mz, t + 0.5, 0.4, L + t + 0.5, a); });
      markLine(solid, pts, t + 2);
    }
    // 小屋・事務所(平屋根、手すり壁、窓の帯、扉)。floors 階(1 階 4.6)
    function shed(cx, cz, a, w, d, floors = 1, color = C.white, { windows = true, edges = true, tank = false } = {}) {
      const P = frame(cx, cz, a), h = G0 + floors * 4.6;
      part(B1, MC(color), cx, h / 2, cz, w, h, d, a, edges);
      part(B1, MC(C.roof), cx, h + 0.35, cz, w + 0.7, 0.7, d + 0.7, a, edges);
      if (windows) for (let f = 0; f < floors; f++) for (const s of [-1, 1]) { const [x, z] = P(0, s * (d / 2 + 0.06)); part(B1, M.glass, x, G0 + f * 4.6 + 2.6, z, w * 0.72, 1.2, 0.2, a); }
      const [dx, dz] = P(-w * 0.28, d / 2 + 0.12); part(B1, M.dark, dx, G0 + 1.6, dz, Math.min(2.2, w * 0.25), 3.2, 0.2, a);
      if (tank) { const [x, z] = P(w * 0.25, -d * 0.2); part(C8, MC(C.pipe), x, h + 1.8, z, 1.2, 2.2, 1.2); }
      markRect(solid, cx, cz, w, d, a, 1.5); placed.push([cx, cz]);
      return h;
    }
    function kiosk(x, z, a = 0, color = C.white2) {   // 変圧器・配電の箱
      const P = frame(x, z, a);
      part(B1, MC(color), x, G0 + 1.6, z, 3.2, 3.2, 2.2, a, true);
      part(B1, MC(C.roof), x, G0 + 3.35, z, 3.6, 0.3, 2.6, a);
      const [dx, dz] = P(0, 1.15); part(B1, M.dark, dx, G0 + 1.5, dz, 2.2, 2.4, 0.1, a);
      markRect(solid, x, z, 3.2, 2.2, a, 1.2); placed.push([x, z]);
    }
    function transformer(x, z, a = 0) {   // 変圧器(本体、放熱板、ブッシング)
      const P = frame(x, z, a);
      part(B1, MC(C.block), x, G0 + 0.4, z, 9, 0.8, 7, a);
      part(B1, MC(C.pipe), x, G0 + 3, z, 5, 4.4, 3.6, a, true);
      for (const s of [-1, 1]) for (const t of [-1, 0, 1]) { const [fx, fz] = P(s * 3.1, t * 1.2); part(B1, M.dark, fx, G0 + 2.8, fz, 1.2, 3.6, 0.25, a); }
      for (const t of [-1.2, 0, 1.2]) { const [bx, bz] = P(t, 0); part(C8, MC(C.white), bx, G0 + 6.2, bz, 0.35, 2.2, 0.35); }
      markRect(solid, x, z, 9, 7, a, 1); placed.push([x, z]);
    }
    const CONT = [0xc9d0d7, 0x9aa5b1, 0xb7a99a, 0x9fb3c0, 0xc4b8a6, 0xd2cbbd];
    function container(cx, cz, a = 0, tier = 0, color) {   // 12 × 3 × 5(約 1.7 倍)
      const P = frame(cx, cz, a), c = color ?? CONT[Math.floor(rnd() * CONT.length)];
      part(B1, MC(c), cx, G0 + 1.5 + tier * 3, cz, 5, 2.92, 12, a, true);
      const [ex, ez] = P(0, 6.04); part(B1, M.dark, ex, G0 + 1.5 + tier * 3, ez, 4.2, 2.4, 0.1, a);
      if (tier === 0) { markRect(solid, cx, cz, 5, 12, a, 1.5); placed.push([cx, cz]); }
    }
    function blocks(cx, cz, a, nu, nv, tiers = 2, { w = 5, h = 2.4, d = 3.4, color = C.block } = {}) {   // 護岸ブロック・資材の山(段々)
      const P = frame(cx, cz, a);
      for (let t = 0; t < tiers; t++) for (let i = 0; i < nu - t; i++) for (let j = 0; j < nv; j++) { const [x, z] = P((i - (nu - 1 - t) / 2) * (w + 0.4), (j - (nv - 1) / 2) * (d + 0.4)); part(B1, MC(color), x, G0 + h / 2 + t * h, z, w, h, d, a, true); }
      markRect(solid, cx, cz, nu * (w + 0.4), nv * (d + 0.4), a, 1.5); placed.push([cx, cz]);
    }
    function pipes(cx, cz, a, n = 4, len = 20, rad = 1.3, color = C.pipe) {   // 管の山(俵積み)
      const P = frame(cx, cz, a);
      for (let t = 0; t < n; t++) for (let i = 0; i < n - t; i++) { const [x, z] = P((i - (n - 1 - t) / 2) * rad * 2.1, 0); part(C12, MC(color), x, G0 + rad + t * rad * 1.8, z, rad, len, rad, a + Math.PI / 2, false, 0, Math.PI / 2); }   // 軸を局所の v(長さの向き)へ
      markRect(solid, cx, cz, n * rad * 2.2, len, a, 1.5); placed.push([cx, cz]);
    }
    function drum(x, z, a = 0, R = 3, w = 2.4, color = C.wood) {   // ケーブルのドラム(軸は水平)
      part(C12, MC(color), x, G0 + R, z, R, w, R, a, false, 0, Math.PI / 2);
      part(C12, M.dark, x, G0 + R, z, R * 0.55, w + 0.2, R * 0.55, a, false, 0, Math.PI / 2);
      markCircle(solid, x, z, R + 1); placed.push([x, z]);
    }
    function canopy(cx, cz, a, w, d, h = 6, color = C.roof) {   // 柱と屋根だけの上屋
      const P = frame(cx, cz, a), nu = Math.max(1, Math.round(w / 8));
      for (let i = 0; i <= nu; i++) for (const s of [-1, 1]) { const [x, z] = P(-w / 2 + (w * i) / nu, s * (d / 2 - 0.5)); part(B1, M.mid, x, G0 + h / 2, z, 0.5, h, 0.5); }
      part(B1, MC(color), cx, G0 + h + 0.3, cz, w + 1, 0.6, d + 1, a, true);
      markRect(solid, cx, cz, w, d, a, 1.5); placed.push([cx, cz]);
    }
    function tankH(x, z, a = 0, len = 10, rad = 1.8, color = C.white) {   // 横置きのタンク(鞍つき)
      const P = frame(x, z, a);
      part(C12, MC(color), x, G0 + rad + 0.9, z, rad, len, rad, a + Math.PI / 2, true, 0, Math.PI / 2);
      for (const s of [-1, 1]) { const [sx, sz] = P(0, s * len * 0.3); part(B1, M.mid, sx, G0 + 0.8, sz, rad * 1.6, 1.6, 0.8, a); }
      markRect(solid, x, z, rad * 2, len, a, 1.5); placed.push([x, z]);
    }
    function waterTank(x, z, h = 12, rad = 3.2) {   // 脚つきの高架水槽
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) part(B1, M.mid, x + dx * rad * 0.6, G0 + h / 2, z + dz * rad * 0.6, 0.45, h, 0.45);
      part(C12, MC(C.white), x, G0 + h + 2, z, rad, 4, rad, 0, true);
      part(C12, MC(C.roof), x, G0 + h + 4.3, z, rad + 0.3, 0.6, rad + 0.3);
      markCircle(solid, x, z, rad + 1.5); placed.push([x, z]);
    }
    function bench(x, z, a = 0) { part(B1, MC(C.wood), x, G0 + 1.05, z, 4, 0.35, 1.1, a); for (const s of [-1, 1]) { const [lx, lz] = frame(x, z, a)(s * 1.6, 0); part(B1, M.mid, lx, G0 + 0.45, lz, 0.3, 0.9, 1, a); } mark(solid, x, z); }
    // ── 草・低木・石・木(頂点色の 1 メッシュにまとめる) ──
    const col = (c) => new THREE.Color(c);
    const tint = (g, c) => ({ geo: g.index ? g.toNonIndexed() : g, color: col(c) });
    const blades = (n, h, w, c, lean, seed) => {
      const pos = [], rr = U.rng(seed);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rr() * 0.6, ca = Math.cos(a), sa = Math.sin(a), hh = h * (0.7 + rr() * 0.5), l = lean * hh; pos.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * l, hh, sa * l); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
      return { geo: g, color: col(c) };
    };
    const TPL = {
      tuft: U.concat(THREE, [blades(6, 2.8, 0.55, C.tuft, 0.35, 3)]),
      tuft2: U.concat(THREE, [blades(5, 2.2, 0.5, C.tuft2, 0.45, 7)]),
      scrub: U.concat(THREE, [tint(new THREE.OctahedronGeometry(1, 0).scale(2.6, 1.4, 2.2).translate(0, 0.9, 0), C.scrub), tint(new THREE.OctahedronGeometry(1, 0).scale(1.6, 1.1, 1.5).translate(1.5, 0.8, 0.9), C.scrubD)]),
      stone: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.55, 0.8), C.stone)]),
      stone2: U.concat(THREE, [tint(new THREE.OctahedronGeometry(1, 0).scale(1, 0.5, 0.75), C.stone2)]),
      cas: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.45, 0.75, 11, 6).translate(0, 5.5, 0), C.trunk), tint(new THREE.IcosahedronGeometry(1, 0).scale(3.6, 8, 3.6).translate(0, 14, 0), C.crown), tint(new THREE.IcosahedronGeometry(1, 0).scale(2.6, 5.4, 2.6).translate(0.5, 20, -0.3), C.crownD)]),
      round: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.4, 0.6, 5, 6).translate(0, 2.5, 0), C.trunk), tint(new THREE.IcosahedronGeometry(1, 1).scale(4.4, 3.8, 4.4).translate(0, 7.6, 0), C.round)]),
      hedge: U.concat(THREE, [tint(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), C.crownD)]),
    };
    {
      const palmParts = [tint(new THREE.CylinderGeometry(0.55, 0.95, 17, 6, 2).translate(0, 8.5, 0), C.trunk), tint(new THREE.IcosahedronGeometry(1.4, 0).translate(0, 17, 0), C.crownD)];
      for (let f = 0; f < 9; f++) {
        const a = (f / 9) * Math.PI * 2 + (f % 2) * 0.2, ca = Math.cos(a), sa = Math.sin(a), Pp = (rr, y, w) => [ca * rr - sa * w, y, sa * rr + ca * w];
        const pts = [Pp(0.4, 17.4, 0), Pp(4.5, 18.6, 1.3), Pp(4.5, 18.6, -1.3), Pp(9.5, 15.2, 0)];
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([...pts[0], ...pts[1], ...pts[2], ...pts[1], ...pts[3], ...pts[2]], 3)); g.computeVertexNormals();
        g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
        palmParts.push({ geo: g, color: col(C.leaf) });
      }
      TPL.palm = U.concat(THREE, palmParts).scale(1.2, 1.2, 1.2);
    }
    const cover = [];   // [kind, x, y, z, s, ry, sx?, sy?, sz?]
    function tree(x, z, kind = "round", s = 1, { force = false } = {}) {
      if (wet(x, z, 5) || (!force && at(solid, x, z))) return false;
      cover.push([kind, x, G0 - 0.4, z, s * (0.85 + rnd() * 0.3), rnd() * 6.28]); markCircle(solid, x, z, 2.5); placed.push([x, z]); return true;
    }
    function treeRow(a, b, step, kind = "cas", s = 1) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.floor(L / step)); for (let i = 0; i <= n; i++) tree(a[0] + ((b[0] - a[0]) * i) / n + (rnd() - 0.5) * 1.5, a[1] + ((b[1] - a[1]) * i) / n + (rnd() - 0.5) * 1.5, kind, s); }
    function hedge(pts, h = 2.2, w = 2.2) { segs(pts, (mx, mz, L, a) => cover.push(["hedge", mx, G0 - 0.1, mz, 1, a, w, h, L])); markLine(solid, pts, w + 1); }
    // 縁の草と石: 制圧圏の縁ほど濃く(外の装飾の層となじむ)、中は薄く。舗装・芝・物の上には置かない
    function edgeCover({ from = 0.55, out = 18, base = 0.14, max = 0.56, keep = () => true } = {}) {
      const nz = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.031 + Math.sin(z * 0.023) * 2.1) * Math.cos(z * 0.027 - x * 0.013);
      for (let x = -r - out; x <= r + out; x += 4.2) for (let z = -r - out; z <= r + out; z += 4.2) {
        const jx = x + (rnd() - 0.5) * 4, jz = z + (rnd() - 0.5) * 4, d = Math.hypot(jx, jz);
        if (d > r + out) continue;
        const p = (base + (max - base) * smooth(r * from, r * 0.98, d)) * (0.55 + 0.9 * nz(jx, jz));
        if (rnd() > p || wet(jx, jz, 7) || at(solid, jx, jz) || at(surf, jx, jz) || !keep(jx, jz)) continue;
        const q = rnd(), s = 0.8 + rnd() * 0.6, ry = rnd() * 6.28;
        if (q < 0.62) cover.push([rnd() < 0.6 ? "tuft" : "tuft2", jx, G0 - 0.2, jz, s, ry]);
        else if (q < 0.86) cover.push(["scrub", jx, G0 - 0.2, jz, s, ry]);
        else cover.push([rnd() < 0.5 ? "stone" : "stone2", jx, G0 - 0.1, jz, 0.8 + rnd() * 1.4, ry]);
      }
      for (let n = 0; n < r * 0.35; n++) {   // 小石の散らばり(群れ。縁寄り)
        const a = rnd() * 6.28, dd = r * (0.6 + rnd() * 0.42), cx = Math.cos(a) * dd, cz = Math.sin(a) * dd, R = 6 + rnd() * 14;
        for (let i = 0; i < 10 + rnd() * 16; i++) {
          const b = rnd() * 6.28, e = Math.sqrt(rnd()) * R, x = cx + Math.cos(b) * e, z = cz + Math.sin(b) * e;
          if (wet(x, z, 6) || at(solid, x, z) || at(surf, x, z) || !keep(x, z)) continue;
          cover.push([rnd() < 0.5 ? "stone" : "stone2", x, G0 - 0.05, z, 0.5 + rnd() * 1.1, rnd() * 6.28]);
        }
      }
    }
    // 頂点色を写しながらまとめる(U.concat は色を 1 色にするので使わない)
    function mergeColored(list) {
      let n = 0; for (const [kind] of list) n += TPL[kind].attributes.position.count;
      const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
      let o = 0;
      for (const [kind, x, y, z, s, ry, sx, sy, sz] of list) {
        const g = TPL[kind], p = g.attributes.position, c = g.attributes.color, t = 0.92 + rnd() * 0.14;
        m.compose(v.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), sx ? sc.set(sx, sy, sz) : sc.set(s, s * (0.85 + rnd() * 0.3), s));
        for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); pos[(o + i) * 3] = v.x; pos[(o + i) * 3 + 1] = v.y; pos[(o + i) * 3 + 2] = v.z; cl[(o + i) * 3] = c.getX(i) * t; cl[(o + i) * 3 + 1] = c.getY(i) * t; cl[(o + i) * 3 + 2] = c.getZ(i) * t; }
        o += p.count;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(cl, 3)); g.computeVertexNormals();
      return g;
    }
    function finish() {
      if (cover.length) {
        const mesh = new THREE.Mesh(mergeColored(cover), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
        mesh.userData.keep = true; group.add(mesh);   // 焼くと頂点色が消えるので焼かない
      }
      if (lampHeads.length) group.add(new THREE.Mesh(U.merge(THREE, lampHeads), M.lamp));
      if (redLights.length) group.add(new THREE.Mesh(U.merge(THREE, redLights), M.basic(0xd8473a)));
      const kinds = {}; for (const [kind] of cover) kinds[kind] = (kinds[kind] ?? 0) + 1;
      return { cover: cover.length, kinds, lamps: lampHeads.length };
    }
    const check = () => {
      let inWater = 0;
      for (const [x, z] of placed) if (ctx.isWater(x, z)) inWater++;
      for (const [kind, x, , z] of cover) if (ctx.isWater(x, z)) inWater++;
      return { items: placed.length + cover.length, inWater };
    };
    return { C, TOP, G0, MC, B1, C8, C12, V, part, frame, smooth, rnd, block, at, solid, surf, wet, rectFree, slab, line, kerbRect, lamp, road, mapRoad, parking, fence, wall, shed, kiosk, transformer, container, blocks, pipes, drum, bench, canopy, tankH, waterTank, tree, treeRow, hedge, edgeCover, finish, check, redLights, lampHeads };
  }
  (window.DreamAssets ??= {}).maps ??= { sites: {} };
  DreamAssets.maps.siteDress = siteDress;

  const DECK = 8;                 // 線路の高さ(陸の上面 0 から)
  const SEC = 10;                 // 旋回にかかる秒数
  const W = 12;                   // トラスの面の半幅(床とともに幅を誇張)
  const ZONE = 205;               // 船がこれより橋に近いと閉じない(船の中心の |z|)

  function ferdan(THREE, ctx) {
    const { U, M, k } = ctx;
    const { add, box, cyl, V, beam } = k;
    const P = DreamAssets.fac.P;
    const accent = M.lambert(P.neutral);
    const red = M.basic(0xd8473a), green = M.basic(0x2fbf6a), off = M.basic(0x3b4752);
    const beaconOn = M.basic(P.amber), beaconOff = M.basic(0x6b5a2e);
    const group = new THREE.Group(); group.name = "site-ferdan";

    // ── 旋回トラスの腕: 旋回軸が原点、腕は +x(長さ L)、尾は -x(長さ T)。軸の上で背が高い(らくだのこぶ形の上弦) ──
    function arm(px, base, { L = 99.25, T = 40, Hp = 85, Ht = 18, warren = false, mat = M.light, beacon = false } = {}) {
      const g = new THREE.Group(); g.position.set(px, 0, 0); g.rotation.y = base; group.add(g);
      const h = (x) => (x >= 0 ? Ht + (Hp - Ht) * (1 - (x / L) ** 2) : Ht + (Hp - Ht) * (1 - (x / T) ** 2));
      const xs = [];
      for (let i = 0; i <= 3; i++) xs.push(-T + (T * i) / 3);
      for (let i = 1; i <= 8; i++) xs.push((L * i) / 8);
      const top = (x, z) => V(x, DECK + h(x), z), bot = (x, z) => V(x, DECK, z);
      for (const z of [-W, W]) {
        beam(g, bot(-T, z), bot(L, z), 4, mat);
        for (let i = 0; i < xs.length - 1; i++) {
          const a = xs[i], b = xs[i + 1];
          beam(g, top(a, z), top(b, z), 4, mat);
          if (warren) beam(g, i % 2 ? bot(a, z) : top(a, z), i % 2 ? top(b, z) : bot(b, z), 2.2, mat);
          else { const near = Math.abs(a) < Math.abs(b) ? a : b, far = near === a ? b : a; beam(g, top(near, z), bot(far, z), 2.2, mat); }   // プラット: 斜材は軸の側の上から先の下へ
        }
        for (const x of xs) if (!warren || x === xs[0] || x === xs[xs.length - 1] || Math.abs(x) < 1) beam(g, bot(x, z), top(x, z), x === 0 ? 4 : 2.2, mat);
      }
      // 上の横つなぎ(支柱と X)、両端の門構え
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        beam(g, top(x, -W), top(x, W), 1.6, mat);
        if (i < xs.length - 1) { beam(g, top(x, -W), top(xs[i + 1], W), 1.1, mat); beam(g, top(x, W), top(xs[i + 1], -W), 1.1, mat); }
      }
      for (const x of [xs[0], xs[xs.length - 1]]) beam(g, V(x, DECK + h(x) * 0.6, -W), V(x, DECK + h(x) * 0.6, W), 1.4, mat);
      // 床版、線路、歩廊
      add(box(L + T, 2.5, 2 * W + 2), M.mid, g, { x: (L - T) / 2, y: DECK - 1.25 });
      for (const z of [-2.4, 2.4]) add(box(L + T, 0.6, 0.6), M.dark, g, { x: (L - T) / 2, y: DECK + 0.3, z, edges: false });
      add(box(L + T, 0.3, 2.2), M.dark, g, { x: (L - T) / 2, y: DECK + 0.15, z: W - 2, edges: false });
      // 旋回の太鼓(軸受け)と尾の釣合い重り(床の上、トラスの間)
      add(cyl(10, 2.5, 16), M.dark, g, { y: DECK - 3.75, edges: false });
      add(box(14, 10, 2 * W - 3), M.mid, g, { x: -T + 7.5, y: DECK + 5 });
      // 旋回の操作室(軸の上、トラスの頂部)
      add(box(16, 7, 2 * W + 3), M.body, g, { y: DECK + Hp + 3.5 });
      add(box(16.4, 1.6, 2 * W + 3.4), accent, g, { y: DECK + Hp + 1.2, edges: false });
      add(box(16.3, 2.4, 2 * W + 3.3), M.glass, g, { y: DECK + Hp + 4.6, edges: false });
      add(box(18, 1, 2 * W + 5), M.light, g, { y: DECK + Hp + 7.5 });
      // ── 細部: 節点の添え板(面の内外)、弦材の鋲の列、歩廊の手すり、門構えの銘板(文字なし)、操作室への階段塔、屋上の手すりと空中線 ──
      const B1 = box(1, 1, 1);
      const thin = (p, q, w, m) => { const d = q.clone().sub(p), len = d.length(), o = add(B1, m, g, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2, edges: false }); o.scale.set(w, len, w); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(len)); return o; };
      const plateG = box(5.4, 5.4, 0.4);
      for (const z of [-W, W]) for (const x of xs) for (const p of [top(x, z), bot(x, z)]) for (const s of [-1, 1]) add(plateG, M.mid, g, { x: p.x, y: p.y, z: z + s * 2.2, edges: false });
      for (const z of [-W, W]) for (const sz of [-1, 1]) {
        const off = (y) => V(0, y, z + sz * 2.12);
        for (let i = 0; i < xs.length - 1; i++) for (const dy of [-1.15, 1.15]) thin(top(xs[i], 0).add(off(dy)), top(xs[i + 1], 0).add(off(dy)), 0.32, M.dark);
        for (const dy of [-1.15, 1.15]) thin(bot(-T, 0).add(off(dy)), bot(L, 0).add(off(dy)), 0.32, M.dark);
      }
      for (let x = -T + 2; x <= L - 2; x += 5) add(B1, M.dark, g, { x, y: DECK + 1.2, z: W - 3.6, edges: false }).scale.set(0.3, 2.4, 0.3);
      thin(V(-T + 2, DECK + 2.3, W - 3.6), V(L - 2, DECK + 2.3, W - 3.6), 0.28, M.dark);
      thin(V(-T + 2, DECK + 1.3, W - 3.6), V(L - 2, DECK + 1.3, W - 3.6), 0.22, M.dark);
      for (const [x, s] of [[xs[0], -1], [xs[xs.length - 1], 1]]) {
        const y = DECK + h(x) * 0.6 - 3.2;
        add(box(0.3, 4.6, 2 * W - 6), M.dark, g, { x: x + s * 0.9, y, edges: false });
        add(box(0.4, 3.8, 2 * W - 7), M.body, g, { x: x + s * 1.1, y, edges: false });
        add(box(0.45, 0.5, 2 * W - 9), accent, g, { x: x + s * 1.15, y: y - 0.9, edges: false });
      }
      // 階段塔(軸の脇、-z の外側に張り出す。踊り場 8.5 ごと)
      const SZ = -(W + 5.6);
      add(box(9, 1, 8), M.mid, g, { x: 4.5, y: DECK - 0.5, z: SZ });
      for (const [px, pz] of [[1.5, SZ + 2.6], [7.5, SZ + 2.6], [1.5, SZ - 2.6], [7.5, SZ - 2.6]]) thin(V(px, DECK, pz), V(px, DECK + Hp, pz), 0.55, M.light);
      for (let y = DECK + 8.5, i = 0; y < DECK + Hp; y += 8.5, i++) {
        add(box(7, 0.5, 6), M.light, g, { x: 4.5, y, z: SZ, edges: false });
        thin(V(i % 2 ? 2.1 : 6.9, y - 8.3, SZ), V(i % 2 ? 6.9 : 2.1, y, SZ), 0.7, M.mid);
      }
      add(box(7, 0.6, 7), M.light, g, { x: 4.5, y: DECK + Hp + 0.3, z: SZ });
      thin(V(4.5, DECK + Hp + 0.6, SZ + 3.5), V(4.5, DECK + Hp + 0.6, -(W + 1.5)), 2.2, M.light);   // 操作室への渡り
      // 操作室の屋上の手すり、空中線、赤い頭の避雷針
      for (const s of [-1, 1]) { thin(V(-9, DECK + Hp + 9.3, s * (W + 2.5)), V(9, DECK + Hp + 9.3, s * (W + 2.5)), 0.25, M.dark); thin(V(s * 9, DECK + Hp + 9.3, -(W + 2.5)), V(s * 9, DECK + Hp + 9.3, W + 2.5), 0.25, M.dark); }
      for (const [x, z] of [[-9, -(W + 2.5)], [9, -(W + 2.5)], [-9, W + 2.5], [9, W + 2.5]]) thin(V(x, DECK + Hp + 8, z), V(x, DECK + Hp + 9.4, z), 0.25, M.dark);
      thin(V(-5, DECK + Hp + 8, -4), V(-5, DECK + Hp + 22, -4), 0.35, M.dark);
      add(box(0.9, 0.9, 0.9), M.red, g, { x: -5, y: DECK + Hp + 22.3, z: -4, edges: false });
      for (const y of [DECK + Hp + 14, DECK + Hp + 18]) thin(V(-5, y, -6.5), V(-5, y, -1.5), 0.2, M.dark);
      // 釣合い重りの板の継ぎ目
      for (let i = -1; i <= 1; i++) add(box(14.2, 0.3, 2 * W - 2.6), M.dark, g, { x: -T + 7.5, y: DECK + 5 + i * 3, edges: false });
      let lamp = null;
      if (beacon) lamp = add(cyl(1.6, 2.6, 8), beaconOff, g, { y: DECK + Hp + 9.3, edges: false });
      return { g, base, lamp, L, T };
    }
    // 旧運河: 西岸(x = -300)と中州(x = -100)の 2 本。新運河: 中州(x = 100)と東岸(x = 300)の 2 本(ワーレン形、背は低め)
    const arms = [
      arm(-300, 0, { beacon: true }), arm(-100, Math.PI),
      arm(100, 0, { Hp: 64, Ht: 15, warren: true, mat: M.body }), arm(300, Math.PI, { Hp: 64, Ht: 15, warren: true, mat: M.body, beacon: true }),
    ];
    // 旋回軸の橋脚(陸の上)
    for (const x of [-300, -100, 100, 300]) { add(cyl(14, 5, 20), M.light, group, { x, y: 2.5 }); add(cyl(15, 1, 20), M.mid, group, { x, y: 0.5, edges: false }); }
    // 橋脚の上の旋回の歯車の輪と転輪、点検の梯子、基礎の石張りの縁
    const RING = new THREE.TorusGeometry(12, 0.55, 6, 40).rotateX(Math.PI / 2), ROLL = box(1.6, 1.1, 2.4);
    for (const x of [-300, -100, 100, 300]) {
      add(RING, M.dark, group, { x, y: 5.3, edges: false });
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; add(ROLL, M.mid, group, { x: x + Math.cos(a) * 10.6, y: 5.5, z: Math.sin(a) * 10.6, ry: -a, edges: false }); }
      const lz = x < 0 === (Math.abs(x) > 200) ? 14.3 : -14.3;
      for (const dx of [-1.2, 1.2]) add(box(0.3, 5, 0.3), M.dark, group, { x: x + dx, y: 2.5, z: lz, edges: false });
      for (let y = 0.8; y < 5; y += 0.9) add(box(2.4, 0.2, 0.25), M.dark, group, { x, y, z: lz, edges: false });
      add(new THREE.CylinderGeometry(17, 18, 1.2, 24), M.lambert(0xd5d2c8), group, { x, y: 0.6, edges: false });
    }

    // ── 線路の盛土: 中州(両端は尾の回る範囲を空ける)と両岸の取付け ──
    const embank = (x0, x1, h0, h1) => {
      const len = x1 - x0, g = U.loft(THREE, [{ z: -len / 2, pts: U.sym([[7 + h0, 0], [7, h0]]) }, { z: len / 2, pts: U.sym([[7 + h1, 0], [7, h1]]) }]);
      g.rotateY(Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0);
      return g;
    };
    for (const [x0, x1, h0, h1] of [[-55, 55, 7.5, 7.5], [-380, -349, 0.5, 7.5], [349, 380, 7.5, 0.5]]) {
      const geo = embank(x0, x1, h0, h1); if (x0 > 0) { geo.rotateY(Math.PI); geo.translate(x0 + x1, 0, 0); }   // 東は向きを返す
      add(geo, M.mid, group);
    }
    for (const [x0, x1] of [[-55, 55], [-366, -349], [349, 366]]) for (const z of [-2.4, 2.4]) add(box(x1 - x0, 0.6, 0.6), M.dark, group, { x: (x0 + x1) / 2, y: 7.8, z, edges: false });
    for (const x of [-53, 53, -347, 347]) add(box(4, 8, 18), M.light, group, { x, y: 4 });   // 橋台(面は旋回軸から 45)

    // ── 鉄道の信号(閉 = 緑、それ以外 = 赤。常灯) ──
    const lamps = [];
    for (const [x, z] of [[-372, -20], [-40, 20], [40, -20], [372, 20]]) {
      add(cyl(0.8, 22, 6), M.dark, group, { x, y: 11, z });
      add(box(3.4, 7, 3.4), M.dark, group, { x, y: 23, z });
      lamps.push(add(new THREE.SphereGeometry(1.8, 10, 8), red, group, { x: x + (x < 0 ? 1.9 : -1.9), y: 24, z, edges: false }));
    }
    // 両岸の信号所(尾と腕の回る範囲の外)
    for (const [x, z] of [[-344, -62], [344, 62]]) {
      add(box(24, 10, 16), M.body, group, { x, y: 5, z });
      add(box(24.4, 1.6, 16.4), M.glass, group, { x, y: 6.5, z, edges: false });
      add(box(26, 1, 18), M.light, group, { x, y: 10.5, z });
    }

    // ── 中州: 運河の管制塔、護岸の笠石、倉庫、近未来化(監視塔とドローンの発着場) ──
    for (const x of [-119, 119]) add(box(3, 0.6, 760), M.light, group, { x, y: 0.3, edges: false });
    const T0 = { x: 0, z: -230 };
    add(box(34, 6, 34), M.light, group, { x: T0.x, y: 3, z: T0.z });
    add(box(14, 44, 14), M.body, group, { x: T0.x, y: 28, z: T0.z });
    for (let i = 0; i < 4; i++) add(box(14.4, 1.2, 14.4), M.mid, group, { x: T0.x, y: 12 + i * 9, z: T0.z, edges: false });
    add(box(28, 12, 28), M.body, group, { x: T0.x, y: 56, z: T0.z });
    add(box(28.4, 5, 28.4), M.glass, group, { x: T0.x, y: 57, z: T0.z, edges: false });
    add(box(28.6, 1.8, 28.6), accent, group, { x: T0.x, y: 50.9, z: T0.z, edges: false });
    add(box(31, 1.4, 31), M.light, group, { x: T0.x, y: 62.7, z: T0.z });
    add(cyl(0.9, 22, 6), M.dark, group, { x: T0.x + 8, y: 74, z: T0.z - 6 });
    add(box(5, 3, 3), M.light, group, { x: T0.x - 7, y: 65, z: T0.z + 7 });
    // 倉庫と作業場(中州の南)
    add(box(44, 12, 24), M.light, group, { x: 55, y: 6, z: 175 });
    add(U.loft(THREE, [{ z: 163, pts: U.sym([[22, 12], [0, 18]]) }, { z: 187, pts: U.sym([[22, 12], [0, 18]]) }]).translate(55, 0, 0), M.mid, group);
    add(box(26, 8, 18), M.body, group, { x: -60, y: 4, z: 160 });
    // 近未来化: 監視塔(格子の鉄塔、箱形のレーダーの覆い、電子光学の窓)とドローンの発着場・格納庫
    k.lattice(group, V(50, 0, 280), 48, 4.5, 1.8, 5, 0.5, M.mid);
    add(box(10, 4, 4), M.body, group, { x: 50, y: 50, z: 280 });
    add(box(3, 2.4, 3), M.dark, group, { x: 50, y: 53.2, z: 278 });
    add(box(2.2, 1.2, 0.2), M.glass, group, { x: 50, y: 53.4, z: 279.6, edges: false });
    add(box(40, 1, 40), M.light, group, { x: -45, y: 0.5, z: 265 });
    for (const [w, d, x, z] of [[2.4, 16, -51, 265], [2.4, 16, -39, 265], [12, 2.4, -45, 265]]) add(box(w, 0.4, d), M.dark, group, { x, y: 1.2, z, edges: false });
    add(new THREE.TorusGeometry(15, 0.8, 6, 32).rotateX(Math.PI / 2), accent, group, { x: -45, y: 1.2, z: 265, edges: false });
    add(box(24, 10, 18), M.body, group, { x: -45, y: 5, z: 310 });
    add(box(20, 8.4, 0.4), M.dark, group, { x: -45, y: 4.4, z: 300.8, edges: false });

    // ── 制圧圏の中の地面(中州の北: 管制塔の構内・駐車場・資材置き場・変電、南: 倉庫の構内・発着場・鉄塔、両岸: 信号所の構内・鉄道の資材) ──
    const D = siteDress(THREE, ctx, group, { seed: 401 });
    const { block, slab, line, road, parking, fence, wall, lamp, shed, kiosk, transformer, container, blocks, pipes, drum, bench, canopy, tankH, waterTank, tree, treeRow, hedge, kerbRect, C: DC, TOP } = D;
    for (const px of [-300, -100, 100, 300]) block.circle(px, 0, 48);                                      // 旋回の範囲(尾と軸)
    for (const [px, pz] of [[-300, -52], [-100, 52], [100, -52], [300, 52]]) block.rect(px, pz, 30, 106, 0, 2);   // 開いた腕が陸の上に横たわる所
    block.line([[-420, 0], [420, 0]], 40);                                                                 // 線路の盛土
    for (const [x, z] of [[-372, -20], [-40, 20], [40, -20], [372, 20]]) block.circle(x, z, 4);
    for (const [x, z] of [[-344, -62], [344, 62]]) block.rect(x, z, 24, 16);
    block.rect(T0.x, T0.z, 34, 34); block.rect(55, 175, 44, 24); block.rect(-60, 160, 26, 18); block.circle(50, 280, 7); block.rect(-45, 265, 40, 40); block.rect(-45, 310, 24, 18);
    block.line([[400, -700], [440, 600]], 30);                                                             // 地図の東岸の道路
    D.mapRoad([[400, -700], [440, 600]]);
    for (const x of [-110, 110]) block.line([[x, -400], [x, 400]], 6);                                    // 護岸の笠石の内側
    // 中州の北: 管制塔の構内(舗装と縁石)、西の駐車場、東の構内道路と並木、北の資材置き場、変電の囲い、線路の脇の継電器の小屋
    slab(0, -232, 60, 64); kerbRect(0, -232, 60, 64);
    for (const x of [-22, 22]) line(x, -232, 50, 0.45, 0); line(0, -204, 36, 0.45, Math.PI / 2);   // 構内の白線
    parking(-62, -236, Math.PI / 2, 7);
    slab(-38, -236, 12, 14, 0, DC.asphalt2);
    road([[46, -30], [46, -372]], 10);
    slab(36, -232, 12, 12, 0, DC.asphalt2);
    for (let z = -60; z >= -360; z -= 32) lamp(38.5, z, Math.PI / 2);
    for (const [x, z] of [[-30, -200], [30, -200], [-30, -264], [30, -264]]) lamp(x, z, 0, 10, true);
    slab(80, -243, 44, 250, 0, DC.lawn, TOP.lawn); kerbRect(80, -243, 44, 250, 0, 0.6);
    treeRow([66, -120], [66, -366], 13, "cas"); treeRow([94, -112], [94, -366], 15, "cas", 1.1);
    for (let z = -140; z > -360; z += 0) { z -= 26 + D.rnd() * 18; D.tree(80 + (D.rnd() - 0.5) * 8, z, "round", 0.9); }
    slab(-95, -240, 18, 80, 0, DC.lawn2, TOP.lawn);
    for (let z = -206; z >= -276; z -= 14) tree(-95, z, "round", 0.8);
    hedge([[-86, -200], [-86, -280]]);
    // 資材置き場(護岸ブロック・予備の浮標・管・小屋)
    slab(-48, -330, 74, 62, 0, DC.gravel, TOP.gravel);
    fence([[-85, -299], [-11, -299], [-11, -361], [-85, -361], [-85, -299]], { gap: [-11, -330, 7] });
    blocks(-68, -345, 0, 4, 2, 3); blocks(-68, -316, 0, 3, 2, 2);
    for (let i = 0; i < 5; i++) { const x = -40 + i * 7; for (let j = 0; j < 2; j++) { const z = -350 + j * 9; D.part(D.C12, i % 2 ? M.red : M.green, x, 0.5 + 3.4, z, 2.6, 6.8, 2.6); D.part(D.C8, i % 2 ? M.red : M.green, x, 0.5 + 8.6, z, 1.2, 3.6, 1.2); } }   // 予備の航路標識の浮標
    D.block.rect(-26, -345, 38, 20, 0, 1);
    pipes(-30, -314, Math.PI / 2, 4, 24, 1.3); shed(-22, -305 + 0.01, 0, 14, 8, 1, DC.white2, { windows: false });
    // 変電の囲い
    slab(-62, -150, 34, 26, 0, DC.gravel, TOP.gravel);
    fence([[-79, -137], [-45, -137], [-45, -163], [-79, -163], [-79, -137]], { gap: [-45, -150, 5] });
    transformer(-70, -150, 0); transformer(-55, -150, 0); kiosk(-30, -150, Math.PI / 2);
    // 線路の脇: 継電器の小屋、ケーブルの樋、信号の箱
    shed(-18, -32, 0, 12, 7, 1, DC.white2); kiosk(14, -30, 0); kiosk(-14, 30, Math.PI);
    for (const s of [-1, 1]) D.part(D.B1, M.mid, 0, 0.9, s * 23, 104, 0.8, 1.6);
    shed(18, 34, Math.PI, 12, 7, 1, DC.white2);
    // 中州の北の追加: 保守の事務所(2 階)と前庭、高架水槽、資材の上屋、空き地の砂利の置き場
    slab(-5, -150, 52, 40, 0, DC.pavers); kerbRect(-5, -150, 52, 40);
    shed(-5, -162, 0, 34, 13, 2, DC.white, { tank: true });
    for (const x of [-22, -5, 12]) tree(x, -136, "round", 0.8, { force: true });
    bench(-14, -140, 0); bench(4, -140, 0);
    slab(31, -150, 20, 8, 0, DC.asphalt2);
    waterTank(-88, -175);
    slab(15, -330, 40, 50, 0, DC.gravel, TOP.gravel);
    canopy(15, -342, 0, 30, 14, 6);
    for (let i = 0; i < 3; i++) blocks(5 + i * 10, -342, 0, 1, 2, 2, { w: 4, h: 1.4, d: 4, color: DC.wood });
    container(26, -312, Math.PI / 2, 0); container(26, -312, Math.PI / 2, 1);
    // 中州の南の追加: 燃料の小さな置き場(防油堤と横置きのタンク)、資材の上屋、芝と木、変電の箱
    wall([[-84, 336], [-58, 336], [-58, 356], [-84, 356], [-84, 336]], { h: 1.2, t: 0.8 });
    tankH(-71, 341, Math.PI / 2, 14, 2); tankH(-71, 351, Math.PI / 2, 14, 2);
    slab(-24, 348, 36, 22, 0, DC.gravel, TOP.gravel); canopy(-24, 348, 0, 28, 14, 6);
    for (let i = 0; i < 3; i++) blocks(-34 + i * 10, 348, 0, 1, 2, 2, { w: 4, h: 1.4, d: 4, color: DC.wood });
    slab(-24, 135, 34, 40, 0, DC.lawn, TOP.lawn); kerbRect(-24, 135, 34, 40, 0, 0.6);
    for (const [x, z] of [[-34, 124], [-20, 128], [-30, 146], [-14, 146]]) tree(x, z, "round", 0.85, { force: true });
    kiosk(26, 128, 0); transformer(26, 146, 0);
    // 中州の南: 倉庫の構内(舗装・積み下ろしの白線・コンテナの山)、構内道路、発着場の囲い、鉄塔の囲いと機器の小屋、芝と木
    road([[10, 30], [10, 372]], 10);
    for (let z = 60; z <= 360; z += 32) lamp(17.5, z, -Math.PI / 2);
    slab(55, 213, 58, 48); kerbRect(55, 213, 58, 48);
    for (let i = 0; i < 5; i++) line(34 + i * 10, 200, 14, 0.45, 0);
    line(55, 228, 54, 0.45, Math.PI / 2);
    for (let i = 0; i < 4; i++) for (let t = 0; t < (i % 2 ? 2 : 3); t++) container(97, 168 + i * 14, 0, t);
    for (let t = 0; t < 2; t++) container(97, 226, 0, t);
    blocks(75, 236, 0, 2, 1, 1, { w: 4, h: 1.6, d: 4, color: DC.wood });
    wall([[-22, 241], [-68, 241], [-68, 289]], { h: 1.6 });
    for (const [x, z] of [[-64, 245], [-26, 245], [-64, 285], [-26, 285]]) { D.part(D.B1, M.mid, x, 1.4, z, 0.4, 1.8, 0.4); D.lampHeads.push([D.B1, { x, y: 2.5, z, sx: 1, sy: 0.4, sz: 1 }]); }
    slab(-45, 295, 30, 11, 0, DC.concrete);   // 発着場と格納庫の間のエプロン
    fence([[41, 271], [59, 271], [59, 289], [41, 289], [41, 271]]);
    shed(68, 281, Math.PI / 2, 9, 7, 1, DC.white2);
    slab(-60, 208, 44, 40, 0, DC.lawn, TOP.lawn); kerbRect(-60, 208, 44, 40, 0, 0.6);
    for (const [x, z] of [[-74, 196], [-60, 199], [-46, 194], [-70, 218], [-52, 220]]) tree(x, z, "round", 0.9, { force: true });
    bench(-60, 225, 0); bench(-44, 210, Math.PI / 2);
    slab(-60, 175, 34, 12, 0, DC.gravel, TOP.gravel);
    treeRow([-100, 120], [-100, 360], 13, "cas"); treeRow([104, 64], [104, 150], 13, "cas"); treeRow([104, 250], [104, 356], 13, "cas");
    // 中州の両岸の警備の柵(北と南)
    for (const x of [-107, 107]) { fence([[x, -372], [x, -112]]); fence([[x, 112], [x, 372]]); }
    // 西岸と東岸: 信号所の構内(舗装・囲い・街灯)、駐車場、鉄道の資材置き場(枕木・レール・ケーブルのドラム)、取付けの道
    for (const s of [-1, 1]) {
      const bx = s * 344, bz = s * 62;
      slab(bx, bz, 42, 30); kerbRect(bx, bz, 42, 30);
      fence([[bx - 26, bz - 19], [bx + 26, bz - 19], [bx + 26, bz + 19], [bx - 26, bz + 19], [bx - 26, bz - 19]], { gap: [bx + s * 26, bz, 5] });
      lamp(bx - 22, bz + s * 15, 0, 10); lamp(bx + 22, bz - s * 15, 0, 10);
      road([[bx + s * 26, bz], [s > 0 ? 412 : -398, bz]], 8, { dash: false });
      parking(s * 332, s * 118, 0, 4, { rows: 1 });
      kiosk(s * 360, s * 95, 0);
      slab(s * 332, -s * 150, 44, 50, 0, DC.gravel, TOP.gravel);
      for (let i = 0; i < 3; i++) blocks(s * 318 + i * 9 * s, -s * 165, Math.PI / 2, 4, 1, 3, { w: 2.2, h: 1.2, d: 9, color: 0x6f6a62 });   // 枕木の山
      for (let i = 0; i < 2; i++) pipes(s * (340 + i * 8), -s * 145, 0, 3, 26, 0.5, 0x7d858e);   // レールの束
      drum(s * 348, -s * 176, 0); drum(s * 356, -s * 176, 0, 2.6, 2);
      shed(s * 318, -s * 132, 0, 12, 7, 1, DC.white2, { windows: false });
    }
    // 両岸の水際の並木と警備の柵(開いた腕が横たわる所はあける)
    for (const s of [-1, 1]) for (const [z0, z1] of s < 0 ? [[-112, -232], [52, 230]] : [[112, 230], [-52, -230]]) {
      treeRow([s * 297, z0], [s * 297, z1], 13, "cas", 0.95); fence([[s * 289, z0], [s * 289, z1]]);
    }
    D.edgeCover({ keep: (x, z) => !(Math.abs(z) < 26 && Math.abs(x) < 420) });
    const dress = D.finish();

    // ── 船: 旧運河を南へコンテナ船、新運河を北へタンカー(閉の間は手前で待つ) ──
    function ship(x, dir, kind) {
      const g = new THREE.Group(); g.position.set(x, 0, -dir * 330); g.rotation.y = dir > 0 ? 0 : Math.PI; group.add(g);   // 船首 = +z(南へ)
      const Lh = kind === "box" ? 180 : 160, Bh = kind === "box" ? 12 : 13, dk = kind === "box" ? 8 : 6;
      const hull = [
        { z: -Lh / 2, pts: U.sym([[Bh * 0.8, ctx.WY - 4], [Bh * 0.95, dk]]) },
        { z: -Lh / 2 + 18, pts: U.sym([[Bh, ctx.WY - 6], [Bh, dk]]) },
        { z: Lh / 2 - 28, pts: U.sym([[Bh, ctx.WY - 6], [Bh, dk]]) },
        { z: Lh / 2 - 6, pts: U.sym([[Bh * 0.45, ctx.WY - 4], [Bh * 0.75, dk + 1]]) },
        { z: Lh / 2, pts: U.sym([[0.5, ctx.WY - 1], [Bh * 0.35, dk + 2]]) },
      ];
      add(U.loft(THREE, hull), M.dark, g);
      add(box(2 * Bh + 0.2, 1.4, Lh - 24), M.body, g, { y: dk - 0.6, z: -4, edges: false });   // 舷側の白い帯
      const sx = -Lh / 2 + 16;   // 船橋(船尾寄り)
      if (kind === "box") {
        const cols = [0xc9d0d7, 0x8f98a3, 0xb7a99a, 0x9fb3c0], parts = [[], [], [], []];
        for (let b = 0; b < 9; b++) for (let r = 0; r < 4; r++) {
          const z = sx + 22 + b * 15, n = 2 + ((b * 7 + r * 3) % 3);
          parts[(b + r) % 4].push([box(5.4, n * 2.6, 13.2), { x: -8.1 + r * 5.4, y: dk + (n * 2.6) / 2, z }]);
        }
        parts.forEach((p, i) => add(U.merge(THREE, p), M.lambert(cols[i]), g));
      } else {
        add(box(2 * Bh - 6, 2, Lh - 50), M.mid, g, { y: dk + 1, z: 6 });
        for (let i = 0; i < 3; i++) add(cyl(0.8, Lh - 60, 6).rotateX(Math.PI / 2), M.light, g, { x: -3 + i * 3, y: dk + 3, z: 6, edges: false });
        add(box(10, 5, 8), M.light, g, { y: dk + 2.5, z: 6 });
      }
      add(box(2 * Bh - 2, 22, 12), M.body, g, { y: dk + 11, z: sx });
      add(box(2 * Bh + 2, 3, 6), M.body, g, { y: dk + 20, z: sx + 2 });
      add(box(2 * Bh - 1.6, 2.2, 12.4), M.glass, g, { y: dk + 18, z: sx, edges: false });
      add(box(5, 10, 6), M.dark, g, { y: dk + 27, z: sx - 4 });
      return { g, dir, z: g.position.z, hold: -dir * 330, Lh };
    }
    const ships = [ship(-200, 1, "box"), ship(200, -1, "tank")];

    // ── 状態: t = 0(閉)〜 1(開) ──
    let state = "closed", t = 0, clock = 0, waiting = false;
    const ease = (x) => x * x * (3 - 2 * x);
    const clearOf = (s) => s.dir * s.z > ZONE || s.dir * s.z <= s.dir * s.hold;   // 橋を抜けたか、待機点より手前(待機点と橋の間にいる船は通り抜けるまで閉じない)
    function apply() {
      for (const a of arms) a.g.rotation.y = a.base + (ease(t) * Math.PI) / 2;
      for (const l of lamps) l.material = t === 0 ? green : red;
    }
    apply();
    function update(dt) {
      clock += dt;
      if (state === "opening") { t = Math.min(1, t + dt / SEC); if (t >= 1) state = "open"; }
      waiting = state === "closing" && !ships.every(clearOf);
      if (state === "closing" && !waiting) { t = Math.max(0, t - dt / SEC); if (t <= 0) state = "closed"; }
      const free = state === "open";
      for (const s of ships) {
        const v = 30 * dt;
        if (free || !clearOf(s) || s.dir * s.z > ZONE) s.z += s.dir * v;                   // 開いている間・通り抜け中・抜けたあとは進む
        else s.z = s.dir > 0 ? Math.min(s.z + v, s.hold) : Math.max(s.z - v, s.hold);    // それ以外は待機点まで進んで止まる
        if (s.dir * s.z > 560) s.z = -s.dir * 560;
        s.g.position.z = s.z; s.g.visible = Math.abs(s.z) < 520;
      }
      apply();
      const moving = t > 0 && t < 1;
      for (const a of arms) if (a.lamp) a.lamp.material = moving && Math.floor(clock * 3) % 2 === 0 ? beaconOn : beaconOff;   // 回転灯は旋回中だけ
    }
    function setState(s) {
      if (s === "open" || s === "closed") { state = s; t = s === "open" ? 1 : 0; apply(); }
      else if (s === "opening" || s === "closing") state = s;
    }
    function check() {
      const r1 = (v) => +v.toFixed(2), half = W + 1;
      const tailR = Math.hypot(40, half);   // 尾の角(床版の端)の回る半径
      return {
        tipGapClosed: r1(2 * (100 - arms[0].L)),                                           // 突き合わせの隙間
        tailToAbutment: r1(45 - tailR),                                                     // 橋台・盛土の端(軸から 45)と尾の回る半径
        deckOverWater: DECK - ctx.WY,                                                       // 閉じたときの桁と水面
        openArmToShip: r1(Math.min((300 - half) - (200 + 12), (200 - 12) - (100 + half))),  // 開いた腕(岸・中州の上)と通る船の舷側
        openArmOnLand: [[-300, -60], [-100, 60], [100, -60], [300, 60]].every(([x, z]) => !ctx.isWater(x - half, z) && !ctx.isWater(x + half, z)),
        piersOnLand: [-300, -100, 100, 300].every((x) => !ctx.isWater(x - 15, 0) && !ctx.isWater(x + 15, 0)),
        shipKeelToBed: ctx.WY - 6 - ctx.BED, shipToBank: r1(80 - 12),
        towerOnLand: !ctx.isWater(T0.x - 17, T0.z) && !ctx.isWater(T0.x + 17, T0.z),
        dress: { ...dress, ...D.check() },   // 地面の作り込み(物と草の数、水の中の数)
      };
    }

    U.bake(THREE, group, { dynamic: [...arms.map((a) => a.g), ...ships.map((s) => s.g)], live: [accent] });
    return {
      group, update, setState, check,
      setTeam: (c) => accent.color.set(c ?? P.neutral),
      get state() { return state; }, get progress() { return t; },
      get stage() { return waiting ? "船の通過待ち" : state === "opening" ? "旋回して開く" : state === "closing" ? "旋回して閉じる" : ""; },
    };
  }

  DreamAssets.maps.site("ferdan", ferdan);
})();
