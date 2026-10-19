// 装飾の層「運河地帯」(マップ「運河地帯」): 運河の両側の明るい平らな帯(-500 < x < 920。西の岸・中州・東の岸)を作り込む。
//   地面: 草の株・まばらな低木・塩生の低木(灰色)・小石の散らばり、水辺の湿った暗い斑と塩の白い斑、低い湿地の葦原、浚渫土の自然な盛土、轍
//   色は場所で変える: 西の岸はくすんだ灰緑・オリーブ、中州と東の岸は暖かい砂色・カーキ、小石は暖かい灰。帯の両端の約 250 は密度と色を隣の層(西の畑・東の砂漠)へ寄せ、
//   東の端は砂漠へ 140 だけはみ出して薄れていく(境目を硬くしない)
//   堤防の内側(水際の護岸と堤防の道の間): 保守の砂利道、測量の標柱、街灯、短い警備の柵、運河の詰所
//   堤防の外: 運河局の詰所と小屋、柵で囲った資材置き場(護岸ブロックの山・管の山)、取水のポンプ小屋(堤防を越える管)、変圧器の箱、使われなくなった船の斜路(水際)
//   中州: 上と同じものに加え、モクマオウの防風林、運河の作業員の小さな集落(低い建物)、運動場、給水塔
//   古い軍の跡: 低い土塁、土嚢の縁の射撃壕、屋根の崩れた掩蔽壕の殻(まばらに)
// 縮尺は拠点と同じ約 0.6 単位/m。小さな物は最大 2 倍まで大きくして読めるようにする。人・車両・実在の地名は置かない。
// 避けるもの: 水(水際から 6 以上離す。葦と斜路を除く)、地図の道路と鉄道、自動の橋の取付け、拠点の制圧圏・首都の台、
//   運河の層の護岸(水際から約 14)と堤防の道(水際から 55 ± 5)・待避所・斜路・資材の置き場(DreamAssets.maps.canalDikeFeatures)・送電線の鉄塔、
//   街並みの層の区域、部隊の小隊の立つ所(建物・盛土だけ)。
(function () {
  const S = 12.5;   // 地形の格子の間隔(suez.js の既定)
  const BAND = [-500, 920];
  const TOWNS = [[-740, 1450, 580, 400], [-480, -3150, 330, 400]];   // 街並みの層の区域(中心、半幅 x、半幅 z)。suez_deco_west.js と同じ値(湖畔の街は西へ広げた)
  const PYLONS = [[-200, -1200], [200, -1200], [650, -1200], [-260, 1000], [200, 1000], [700, 1060]];   // 運河の層の送電線の鉄塔
  const UNITS = [[-470, 260], [-560, 380], [-380, 110], [-700, 330], [920, 1290], [1040, 1160], [820, 1150], [900, -2660], [1060, -2580], [960, -2800]];   // ビューアの小隊
  const C = {
    tuft: 0xb8bb9c, tuft2: 0xc6c6a8, scrub: 0xa5ac94, scrubD: 0x939b84, salt: 0xb6b9a9, saltD: 0xa6aa9a, stone: 0xcac3b3, stone2: 0xb9b1a1,
    reed: 0xa9ad8a, reedD: 0x8f9474, plume: 0xc7b99c, trunk: 0x8a7d6a, crown: 0x8f9f84, crownD: 0x7f9076,
    damp: 0xd3d5ca, damp2: 0xc9cdbf, saltFlat: 0xe4e3d9, spoil: 0xdfd7c5, spoilTop: 0xe9e3d4, track: 0xd9dbd6, rut: 0xbdb7a8,
    hut: [0xfbfcfd, 0xf3f1ec, 0xeef0f2], roof: 0xd5d9dd, glass: 0x34404b, block: 0xc9ced2, pipe: 0x9aa4ad, rust: 0xa48d78,
    berm: 0xd9d2c0, sand: 0xc6b99c, bunker: 0xbfc3c4, pitch: 0xc5d0b6, line: 0xf7f8f8,
    bermW: 0xc3c2a9, bermE: 0xc9bc9e,
  };
  // 地面の小物の色(インスタンスの色。形の頂点色は灰の濃淡だけ): w = 西の岸、e = 中州と東の岸、wEdge / eEdge = 帯の端で寄せる隣の層の色
  const PAL = {
    tuft: { w: [0xa3a988, 0x9ba183, 0xaeb092, 0xa6a585], e: [0xb8ab88, 0xb0a27e, 0xbeb08e, 0xa99d7c], wEdge: 0xadb593, eEdge: 0xb3ad8f },
    scrub: { w: [0x8f977b, 0x868f74, 0x97997c], e: [0x9d9878, 0x928c6d, 0xa39d7d], wEdge: 0x9aa386, eEdge: 0x9ba188 },
    salt: { w: [0xa1a594, 0x989c8b], e: [0xaea691, 0xa49c87], wEdge: 0xa0a690, eEdge: 0xa9a68f },
    stone: { w: [0xa29b8f, 0x958e83, 0xaaa294], e: [0xab9f8b, 0x9f937f, 0xb3a792], wEdge: 0xa7a194, eEdge: 0xc2b8a4 },
  };
  PAL.tuft2 = PAL.tuft; PAL.stone2 = PAL.stone;
  const EDGE = 250, FRINGE = 140;   // 帯の端で寄せる幅、東の端から砂漠へはみ出す幅

  function make(THREE, ctx) {
    const { U, M, k, landH, isWater, nearSite, nearLine, segDist, lineDist, smooth, BED, lake, barrier, autoBridges, HALF, fbm } = ctx;
    const CH = DreamAssets.maps.suez.CHANNELS;
    const rnd = ctx.rng(90210);
    const group = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const col = (c) => new THREE.Color(c);
    const counts = {};

    // ── 水の縁までの符号付きの距離と、地形の実際の高さ(suez.js の地形の格子と同じ式と補間) ──
    function waterSD(x, z) {
      let d = Infinity;
      for (const c of CH) { if (c.name === "東の分水路" && x < c.a[0] - 10) continue; d = Math.min(d, segDist(x, z, c.a, c.b) - c.hw); }
      d = Math.min(d, (Math.hypot((x - lake.cx) / lake.rx, (z - lake.cz) / lake.rz) - 1) * lake.rz);
      return Math.min(d, lineDist(x, z, barrier.pts) - barrier.hw);
    }
    const surf = (x, z) => { const d = waterSD(x, z); return d < -14 ? BED : BED + (Math.max(0.5, landH(x, z)) - BED) * smooth(-14, 6, d); };
    const NS = (2 * HALF) / S + 1, cache = new Float32Array(NS * NS).fill(NaN);
    const gv = (i, j) => { const q = j * NS + i; let v = cache[q]; if (v !== v) v = cache[q] = surf(-HALF + i * S, -HALF + j * S); return v; };
    const H = (x, z) => {
      const fx0 = (x + HALF) / S, fz0 = (z + HALF) / S, i = Math.max(0, Math.min(NS - 2, Math.floor(fx0))), j = Math.max(0, Math.min(NS - 2, Math.floor(fz0))), fx = fx0 - i, fz = fz0 - j;
      const a = gv(i, j), b = gv(i + 1, j), c = gv(i, j + 1), d = gv(i + 1, j + 1);
      return fx + fz < 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
    };

    // ── 置いてよい所 ──
    const inTown = (x, z, pad) => TOWNS.some(([cx, cz, hx, hz]) => Math.abs(x - cx) < hx + pad && Math.abs(z - cz) < hz + pad);
    const nearBridge = (x, z, pad) => autoBridges.some((b) => segDist(x, z, b.a, b.b) < pad);
    const nearPylon = (x, z, pad) => PYLONS.some(([px, pz]) => Math.hypot(x - px, z - pz) < pad);
    const nearUnit = (x, z, pad) => UNITS.some(([ux, uz]) => Math.hypot(x - ux, z - uz) < pad);
    const inBand = (x, z, pad = 0) => x > BAND[0] + pad && x < BAND[1] - pad && Math.abs(z) < HALF - 15 - pad;
    const onDike = (sd, pad = 0) => (sd > 0 && sd < 16 + pad) || Math.abs(sd - 55) < 9 + pad;   // 運河の層の護岸(水の縁から 14 まで)と堤防の道
    // 地面の小物: 水際 6 以上、道路・鉄道・橋・拠点・街を避ける。堤防の上は可(草が生える)だが道の上は不可
    const okSmall = (x, z, pad = 0) => {
      if (!inBand(x, z, pad)) return false;
      const sd = waterSD(x, z);
      return sd > 15 + pad && Math.abs(sd - 55) > 5.5 + pad && !nearSite(x, z, 15 + pad) && !nearLine(x, z, 14 + pad) && !nearBridge(x, z, 25 + pad) && !inTown(x, z, pad) && !nearPylon(x, z, 10);
    };
    // 建物・盛土: 上に加えて護岸と堤防の道から離し、小隊の所・送電線の鉄塔も避ける
    const okBig = (x, z, pad = 0) => okSmall(x, z, pad) && !onDike(waterSD(x, z), pad) && !nearUnit(x, z, 60 + pad) && !nearPylon(x, z, 30 + pad) && !nearLine(x, z, 26 + pad);
    // 帯の端の重み(1 = 端): 西は西の畑へ、東は砂漠へ寄せる
    const edgeW = (x) => x < -80 ? smooth(BAND[0] + EDGE, BAND[0], x) : smooth(BAND[1] - EDGE, BAND[1], x);
    // 東の端の外(砂漠へはみ出す縁): 帯の外なので inBand の代わりに個別に確かめる
    const okFringe = (x, z) => x >= BAND[1] - 2 && x < BAND[1] + FRINGE && Math.abs(z) < HALF - 15 && waterSD(x, z) > 15 && !nearSite(x, z, 15) && !nearLine(x, z, 14) && !nearBridge(x, z, 25) && !inTown(x, z, 0) && !nearPylon(x, z, 10);
    // 地面の小物の色: 場所の色の列から 1 つ、帯の端では隣の層の色へ寄せ、明るさを少しばらす
    const tc0 = new THREE.Color(), tc1 = new THREE.Color();
    const toneAt = (kind, x, z) => {
      const P = PAL[kind], west = x < -80, list = west ? P.w : P.e;
      tc0.set(list[Math.floor(ctx.hash2(Math.floor(x / 23), Math.floor(z / 23)) * list.length) % list.length]);
      tc0.lerp(tc1.set(list[Math.floor(rnd() * list.length)]), 0.5);
      const w = x >= BAND[1] ? 1 : edgeW(x);
      if (w > 0) tc0.lerp(tc1.set(west ? P.wEdge : P.eEdge), w);
      return tc0.multiplyScalar(0.93 + rnd() * 0.12);
    };
    // 占有の格子(8 単位): 建物・盛土・斑の上に草や石を重ねすぎない
    const OX = BAND[0] - 20, OW = BAND[1] - BAND[0] + 40, OZ = -HALF, OD = 2 * HALF, OC = 8, NX = Math.ceil(OW / OC), occ = new Uint8Array(NX * Math.ceil(OD / OC));
    const oi = (x, z) => { const i = Math.floor((x - OX) / OC), j = Math.floor((z - OZ) / OC); return i < 0 || j < 0 || i >= NX || j >= OD / OC ? -1 : j * NX + i; };
    const occupied = (x, z) => { const q = oi(x, z); return q >= 0 && occ[q] > 0; };
    const markRect = (P, w, d, pad = 4) => { for (let a = -w / 2 - pad; a <= w / 2 + pad; a += OC / 2) for (let b = -d / 2 - pad; b <= d / 2 + pad; b += OC / 2) { const q = oi(...P(a, b)); if (q >= 0) occ[q] = 1; } };
    const markCircle = (x, z, r) => { for (let dz = -r; dz <= r; dz += OC / 2) for (let dx = -r; dx <= r; dx += OC / 2) if (dx * dx + dz * dz <= r * r) { const q = oi(x + dx, z + dz); if (q >= 0) occ[q] = 1; } };
    const freeRect = (P, w, d) => { for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) { const [x, z] = P((a * w) / 2, (b * d) / 2); if (occupied(x, z)) return false; } return true; };
    const frame = (cx, cz, a) => { const c = Math.cos(a), s = Math.sin(a); return (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c]; };
    const okRect = (P, w, d, pad = 3) => [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]].every(([a, b]) => okBig(...P((a * (w / 2 + pad)), (b * (d / 2 + pad)))));
    // 運河の層の待避所・斜路・資材の置き場を先に占有にしておく(同じ配置の関数を読む)
    const DF = DreamAssets.maps.canalDikeFeatures?.(ctx);
    if (DF) for (const r of DF.rects) markRect(frame(r.x, r.z, r.ang), r.across, r.along, 4);
    counts.dikeFeatureRects = DF ? DF.rects.length : 0;
    const inDF = (x, z, pad = 0) => (DF?.rects ?? []).some((r) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.ang), s2 = Math.sin(r.ang); return Math.abs(dx * s2 + dz * c) < r.along / 2 + pad && Math.abs(dx * c - dz * s2) < r.across / 2 + pad; });
    const footH = (P, w, d) => { const hs = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [0, 0]].map(([a, b]) => H(...P(a, b))); return [Math.min(...hs), Math.max(...hs)]; };
    // 岸に沿う向き: 最寄りの水路の向き
    const bankAngle = (x, z) => { let best = null, bd = Infinity; for (const c of CH) { const d = segDist(x, z, c.a, c.b); if (d < bd) { bd = d; best = c; } } return best ? Math.atan2(best.b[0] - best.a[0], best.b[1] - best.a[1]) : 0; };

    // ── 建物の部品(単位の箱・円柱を伸ばす。最後に焼く) ──
    const B1 = k.box(1, 1, 1), C1 = k.cyl(1, 1, 12), C8 = k.cyl(1, 1, 8);
    const mats = {
      hut: C.hut.map((c) => M.lambert(c)), roof: M.lambert(C.roof), glass: M.lambert(C.glass), block: M.lambert(C.block), pipe: M.lambert(C.pipe), rust: M.lambert(C.rust),
      berm: M.lambert(C.berm), sand: M.lambert(C.sand), bunker: M.lambert(C.bunker), dark: M.dark, mid: M.mid, light: M.light, spoil: M.lambert(C.spoil), spoilTop: M.lambert(C.spoilTop),
      pitch: M.lambert(C.pitch), line: M.lambert(C.line), red: M.red, bermW: M.lambert(C.bermW), bermE: M.lambert(C.bermE),
    };
    const part = (geo, mat, x, y, z, sx, sy, sz, ry = 0, edges = true, rx = 0) => { const m = k.add(geo, mat, group, { x, y, z, ry, rx, edges }); m.scale.set(sx, sy, sz); return m; };
    // 局所の座標で箱を足す(y0 = 底の高さ)
    const lbox = (P, a, mat, lx, lz, w, h, d, y0, edges = true, ry = 0) => { const [x, z] = P(lx, lz); return part(B1, mat, x, y0 + h / 2, z, w, h, d, a + ry, edges); };

    // 平屋根の小屋: 本体、手すり壁、窓の帯、扉、屋上の水槽(1 階 5.2 = 約 2 倍)
    function hut(cx, cz, a, w, d, floors = 1, mat = mats.hut[0]) {
      const P = frame(cx, cz, a), [lo, hi] = footH(P, w, d), y0 = lo - 1.2, top = hi + floors * 5.2, h = top - y0;
      lbox(P, a, mat, 0, 0, w, h, d, y0);
      lbox(P, a, mats.roof, 0, 0, w + 0.6, 0.9, d + 0.6, top - 0.2);
      for (let f = 0; f < floors; f++) for (const s of [-1, 1]) lbox(P, a, mats.glass, 0, s * (d / 2 + 0.05), w * 0.7, 1.2, 0.3, hi + f * 5.2 + 2.2, false);
      lbox(P, a, mats.dark, -w * 0.3, d / 2 + 0.1, 1.8, 3.2, 0.3, hi, false);
      if (rnd() < 0.6) { const [x, z] = P(w * 0.25, -d * 0.2); part(C8, mats.pipe, x, top + 1.5, z, 1.1, 2, 1.1, 0, false); }
      markRect(P, w, d, 5);
      return { P, top, y0 };
    }
    // 短い柵(柱と 2 本の横木)。点の列 pts([x, z])
    function fence(pts, postStep = 7) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), a = Math.atan2(bx - ax, bz - az), n = Math.max(1, Math.round(L / postStep));
        for (let j = 0; j <= n; j++) { const x = ax + ((bx - ax) * j) / n, z = az + ((bz - az) * j) / n; part(B1, mats.dark, x, H(x, z) + 1.6, z, 0.35, 3.4, 0.35, 0, false); }
        const mx = (ax + bx) / 2, mz = (az + bz) / 2, my = H(mx, mz);
        for (const y of [1.6, 3.0]) part(B1, mats.mid, mx, my + y, mz, 0.15, 0.15, L, a, false);
      }
    }

    // ════ 1. 堤防の内側: 保守の砂利道(水際から 30)、測量の標柱、街灯、詰所、警備の柵 ════
    const trackRuns = [];
    const drapePlate = (runs, w, lift, color, offset = 0) => {
      const pos = [];
      for (const run of runs) for (let i = 0; i < run.length - 1; i++) {
        const [ax, az] = run[i], [bx, bz] = run[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, px = (-(bz - az) / l) * (w / 2), pz = ((bx - ax) / l) * (w / 2);
        const q = [[ax + px, az + pz], [bx + px, bz + pz], [bx - px, bz - pz], [ax - px, az - pz]].map(([x, z]) => [x, H(x, z) + lift, z]);
        for (const j of [0, 1, 2, 0, 2, 3]) pos.push(...q[j]);
      }
      if (!pos.length) return null;
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      // 上向きにそろえる
      const p = g.attributes.position.array;
      for (let i = 0; i < p.length; i += 9) {
        const e1x = p[i + 3] - p[i], e1z = p[i + 5] - p[i + 2], e2x = p[i + 6] - p[i], e2z = p[i + 8] - p[i + 2];
        if (e1z * e2x - e1x * e2z < 0) { for (let c = 0; c < 3; c++) { const t = p[i + 3 + c]; p[i + 3 + c] = p[i + 6 + c]; p[i + 6 + c] = t; } }
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, M.lambert(color, { polygonOffset: true, polygonOffsetFactor: -2 - offset, polygonOffsetUnits: -2 - offset }));
      m.userData.keep = true; group.add(m); return m;
    };
    let markers = 0, lamps = 0, huts = 0, fences = 0;
    const lampHeads = [];
    for (const c of CH) for (const s of [-1, 1]) {
      const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, nx = -uz * s, nz = ux * s, o = c.hw + 30;
      let run = [];
      const flush = () => { if (run.length > 3) trackRuns.push(run); run = []; };
      for (let t = 0; t <= L; t += 10) {
        const x = c.a[0] + ux * t + nx * o, z = c.a[1] + uz * t + nz * o;
        const sd = waterSD(x, z);
        const ok = inBand(x, z, 5) && Math.abs(sd - 30) < 5 && !nearSite(x, z, 25) && !nearLine(x, z, 26) && !nearBridge(x, z, 70) && !inTown(x, z, 0) && (c.name !== "東の分水路" || x > c.a[0] + 40);
        if (ok) run.push([x, z]); else flush();
      }
      flush();
    }
    drapePlate(trackRuns, 7, 0.3, C.track, 1);
    for (const run of trackRuns) {
      run.forEach(([x, z], i) => { const q = oi(x, z); if (q >= 0) occ[q] = 1; const q2 = oi(x + 4, z), q3 = oi(x - 4, z); if (q2 >= 0) occ[q2] = 1; if (q3 >= 0) occ[q3] = 1; void i; });
      for (let i = 4; i < run.length - 4; i++) {
        const [x, z] = run[i], [x1, z1] = run[i + 1], a = Math.atan2(x1 - x, z1 - z), nx = Math.cos(a), nz = -Math.sin(a);
        const side = (waterSD(x + nx * 6, z + nz * 6) > waterSD(x, z)) ? 1 : -1;   // 堤防の側(水から遠い方)
        if (i % 12 === 0) {   // 測量の標柱(白い柱に赤い頭)
          const px = x + nx * side * 6, pz = z + nz * side * 6, y = H(px, pz);
          if (!inDF(px, pz, 2)) { part(B1, mats.light, px, y + 1.6, pz, 0.8, 3.2, 0.8, 0, false); part(B1, mats.red, px, y + 3.5, pz, 0.85, 0.7, 0.85, 0, false); markers++; }
        }
        if (i % 9 === 4) {    // 街灯(水側の路肩)
          const px = x - nx * side * 5.5, pz = z - nz * side * 5.5, y = H(px, pz);
          part(C8, mats.mid, px, y + 6, pz, 0.35, 12, 0.35, 0, false);
          part(B1, mats.mid, px + nx * side * 1.2, y + 12, pz + nz * side * 1.2, 0.5, 0.4, 0.5, a, false);
          lampHeads.push([box1(1.4, 0.3, 0.9), { x: px + nx * side * 2.2, y: y + 11.7, z: pz + nz * side * 2.2, ry: a }]); lamps++;
        }
        if (i % 61 === 30 && rnd() < 0.8) {   // 詰所(道の堤防側)と短い警備の柵
          const px = x + nx * side * 12, pz = z + nz * side * 12;
          if (okSmall(px, pz, 4) && !nearUnit(px, pz, 50) && !inDF(px, pz, 14)) {
            hut(px, pz, a, 9, 7, 1, mats.hut[1]); huts++;
            const f0 = [px - Math.sin(a) * 14 + nx * side * 2, pz - Math.cos(a) * 14 + nz * side * 2], f1 = [px - Math.sin(a) * 30, pz - Math.cos(a) * 30];
            fence([f0, f1]); fences++;
          }
        }
      }
    }
    function box1(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
    if (lampHeads.length) { const m = new THREE.Mesh(U.merge(THREE, lampHeads), M.lamp); group.add(m); }
    Object.assign(counts, { trackRuns: trackRuns.length, markers, lamps, huts });

    // ════ 2. 堤防の外: 資材置き場、ポンプ小屋、変圧器の箱、詰所、斜路 ════
    let yards = 0, pumps = 0, kiosks = 0, slips = 0, sheds = 0;
    const tryPlace = (n, sdRange, w, d, fn, tries = 4000) => {
      let made = 0;
      for (let t = 0; t < tries && made < n; t++) {
        const x = BAND[0] + 20 + rnd() * (BAND[1] - BAND[0] - 40), z = -HALF + 100 + rnd() * (2 * HALF - 200), sd = waterSD(x, z);
        if (sd < sdRange[0] || sd > sdRange[1]) continue;
        const a = bankAngle(x, z), P = frame(x, z, a);
        if (!okRect(P, w, d) || !freeRect(P, w + 10, d + 10)) continue;
        fn(x, z, a, P); made++;
      }
      return made;
    };
    // 資材置き場: 柵、護岸ブロックの山、管の山、小屋
    yards = tryPlace(16, [75, 260], 56, 38, (x, z, a, P) => {
      const [lo] = footH(P, 56, 38);
      const corners = [[-28, -19], [28, -19], [28, 19], [-28, 19], [-28, -6]].map(([u, v]) => P(u, v));
      fence(corners, 6);
      lbox(P, a, mats.mid, 0, 0, 56, 0.4, 38, lo - 0.1, false);   // 砂利の床
      for (let s = 0; s < 3; s++) {   // 護岸ブロックの山(段々)
        const bu = -18 + s * 12;
        for (let tier = 0; tier < 3 - (s % 2); tier++) for (let r = 0; r < 3 - tier; r++) lbox(P, a, mats.block, bu, -8 + r * 4.4 + tier * 2.2, 8, 3.2, 4, lo + tier * 3.2);
      }
      for (let tier = 0; tier < 3; tier++) for (let r = 0; r < 4 - tier; r++) {   // 管の山
        const [px, pz] = P(14, 6 + r * 3.4 + tier * 1.7); part(C1, mats.pipe, px, lo + 1.6 + tier * 2.9, pz, 1.6, 22, 1.6, a + Math.PI / 2, true, Math.PI / 2);
      }
      hut(...P(16, -11), a, 12, 8, 1, mats.hut[2]); sheds++;
      markRect(P, 56, 38, 6);
    });
    // 取水のポンプ小屋: 堤防の外に建屋、堤防を越えて水際へ下りる管
    pumps = tryPlace(8, [70, 95], 16, 12, (x, z, a, P) => {
      const { top } = hut(x, z, a, 16, 12, 1, mats.hut[0]);
      const sx = Math.sin(a + Math.PI / 2), sz = Math.cos(a + Math.PI / 2), dir = waterSD(x + sx * 10, z + sz * 10) < waterSD(x, z) ? 1 : -1;
      const pts = []; for (let t = 8; t < 120; t += 4) { const px = x + sx * dir * t, pz = z + sz * dir * t; pts.push([px, pz, waterSD(px, pz)]); if (waterSD(px, pz) < -4) break; }
      // 管の高さ: 地面の上 2.2。堤防の道は管の橋(道の上 約 7)で越え、保守の砂利道(水際から 30)の下は埋める(両側に頭壁と標柱)
      const onRoad = pts.filter((p) => p[2] > 42 && p[2] < 68), yb = (onRoad.length ? Math.max(...onRoad.map(([px, pz]) => H(px, pz))) : H(x, z)) + 7.4;
      const yOf = ([px, pz, sd]) => { const g = Math.max(H(px, pz), ctx.WY) + 2.2; if (sd >= 72 || sd <= 38) return g; if (sd > 66) return g + (yb - g) * smooth(72, 66, sd); if (sd > 44) return yb; return g + (yb - g) * smooth(38, 44, sd); };
      const buried = (sd) => sd > 24 && sd < 36;
      const ax2 = -sz * dir, az2 = sx * dir;   // 管に直交する向き
      const portal = ([px, pz]) => { const g = H(px, pz); for (const e of [-1, 1]) part(B1, mats.mid, px + ax2 * e * 2.6, (g + yb - 1.1) / 2 - 0.5, pz + az2 * e * 2.6, 0.8, yb - 1.1 - g + 1, 0.8, a, false); part(B1, mats.mid, px, yb - 1.4, pz, 6.4, 0.6, 0.8, a + Math.PI / 2, false); };
      let portals = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], Bp = pts[i + 1];
        markCircle(A[0], A[1], 6);
        if (buried(A[2]) && buried(Bp[2])) continue;
        if (buried(A[2]) !== buried(Bp[2])) {   // 埋まる所の頭壁と、両脇の標柱
          const E = buried(A[2]) ? Bp : A, g = H(E[0], E[1]);
          part(B1, mats.block, E[0], g + 1.4, E[1], 4, 3.4, 2, a + Math.PI / 2);
          for (const e of [-1, 1]) { part(B1, mats.light, E[0] + ax2 * e * 4, g + 1.6, E[1] + az2 * e * 4, 0.6, 3.2, 0.6, 0, false); part(B1, mats.red, E[0] + ax2 * e * 4, g + 3.4, E[1] + az2 * e * 4, 0.65, 0.6, 0.65, 0, false); }
          continue;
        }
        k.tube(group, V(A[0], yOf(A), A[1]), V(Bp[0], yOf(Bp), Bp[1]), 1.1, mats.pipe);
        if ((A[2] > 66 && Bp[2] <= 66) || (A[2] > 44 && Bp[2] <= 44)) { portal(Bp); portals++; }
        else if (i % 3 === 0 && A[2] > 2 && (A[2] >= 72 || A[2] <= 38)) part(B1, mats.light, A[0], H(A[0], A[1]) + 0.8, A[1], 2.4, 2.2, 1.2, a, false);
      }
      if (portals) counts.pipeBridges = (counts.pipeBridges ?? 0) + 1;
      if (portals) (counts.pipeAt ??= []).push([Math.round(x), Math.round(z)]);
      const [kx, kz] = frame(x, z, a)(12, 0); kioskAt(kx, kz, a); void top;
    });
    function kioskAt(x, z, a) { const P = frame(x, z, a), [lo] = footH(P, 4, 3); lbox(P, a, mats.mid, 0, 0, 4.4, 4.2, 3.2, lo - 0.6); lbox(P, a, mats.dark, 0, 1.65, 3, 2.6, 0.2, lo + 0.4, false); markRect(P, 4, 3, 3); kiosks++; }
    // 変圧器の箱(単独)と小さな小屋
    tryPlace(14, [65, 400], 6, 5, (x, z, a) => kioskAt(x, z, a));
    sheds += tryPlace(22, [70, 600], 12, 9, (x, z, a) => { hut(x, z, a, 12, 9, 1, mats.hut[Math.floor(rnd() * 3)]); });
    // 使われなくなった船の斜路: 水際から水の中へ下りるコンクリートの斜面、側壁、錆びた巻上げ小屋
    for (let t = 0; t < 6000 && slips < 6; t++) {
      const c = CH[Math.floor(rnd() * CH.length)];
      if (c.name === "東の分水路") continue;
      const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1], L = Math.hypot(dx, dz), u = rnd() * L, s = rnd() < 0.5 ? -1 : 1;
      const ux = dx / L, uz = dz / L, nx = -uz * s, nz = ux * s, x0 = c.a[0] + ux * u + nx * c.hw, z0 = c.a[1] + uz * u + nz * c.hw;
      const top = [x0 + nx * 40, z0 + nz * 40];
      if (!inBand(...top, 10) || !okSmall(top[0], top[1], 6) || nearSite(x0, z0, 60) || nearBridge(x0, z0, 140) || nearLine(x0, z0, 60) || isWater(...top)) continue;
      const a = Math.atan2(nx, nz);   // 水から陸へ向く
      const yTop = H(...top), yBot = BED + 4, len = 62, mid = [x0 + nx * 9, z0 + nz * 9];
      const pitchA = Math.atan2(yTop - yBot, len);
      part(B1, mats.light, mid[0], (yTop + yBot) / 2 - 0.6, mid[1], 26, 1.6, len, a, true, -pitchA);
      for (const e of [-1, 1]) { const ex = mid[0] + Math.cos(a) * e * 14, ez = mid[1] - Math.sin(a) * e * 14; part(B1, mats.block, ex, (yTop + yBot) / 2 + 0.6, ez, 2, 4, len, a, true, -pitchA); }
      const [hx, hz] = [top[0] + nx * 14, top[1] + nz * 14];
      if (okSmall(hx, hz, 2)) { const P = frame(hx, hz, a), [lo] = footH(P, 10, 8); lbox(P, a, mats.rust, 0, 0, 10, 6.5, 8, lo - 1); lbox(P, a, mats.dark, 0, -4.1, 4, 4, 0.3, lo, false); markRect(P, 10, 8, 4); }
      markCircle(...top, 30); slips++;
    }
    Object.assign(counts, { yards, pumps, kiosks, sheds, slips });

    // ════ 3. 中州: 作業員の集落、運動場、給水塔、防風林 ════
    let settle = 0;
    const casPos = [];
    for (const [z0, z1] of [[-1330, -560], [470, 1080]]) {
      // 防風林(堤防の道の内側に沿って)
      for (let z = z0; z < z1; z += 9) for (const x of [150, 252]) if (okSmall(x, z, 0) && !nearPylon(x, z, 28) && !nearLine(x, z, 30) && !occupied(x, z)) { casPos.push([x + (rnd() - 0.5) * 3, z + (rnd() - 0.5) * 3, 0.9 + rnd() * 0.3]); markCircle(x, z, 4); }
      // 集落: 2 列の低い家と寮、作業場
      for (let z = z0 + 30; z < z1 - 30; z += 34) for (const [x, w, d] of [[180, 14, 10], [222, 14, 10]]) {
        if (rnd() < 0.18) continue;
        const P = frame(x, z, 0);
        if (!okRect(P, w, d, 2) || !freeRect(P, w, d)) continue;
        hut(x, z, 0, w, d, rnd() < 0.25 ? 2 : 1, mats.hut[Math.floor(rnd() * 3)]); settle++;
      }
    }
    // 運動場と給水塔(北の集落の中の空き)
    {
      const [x, z] = [201, -940], P = frame(x, z, 0), w = 46, d = 70;
      if (okRect(P, w, d, 0)) {
        const [lo] = footH(P, w, d);
        lbox(P, 0, mats.pitch, 0, 0, w, 0.8, d, lo - 0.3, false);
        for (const v of [-d / 2 + 1, 0, d / 2 - 1]) lbox(P, 0, mats.line, 0, v, w - 2, 0.2, 0.6, lo + 0.55, false);
        for (const u of [-w / 2 + 1, w / 2 - 1]) lbox(P, 0, mats.line, u, 0, 0.6, 0.2, d - 2, lo + 0.55, false);
        for (const s of [-1, 1]) { lbox(P, 0, mats.light, -5, s * (d / 2 - 1.5), 0.6, 4, 0.6, lo, false); lbox(P, 0, mats.light, 5, s * (d / 2 - 1.5), 0.6, 4, 0.6, lo, false); lbox(P, 0, mats.light, 0, s * (d / 2 - 1.5), 10.6, 0.6, 0.6, lo + 4, false); }
        markRect(P, w, d, 2);
      }
      const tx = 201, tz = -1260, ty = H(tx, tz);   // 給水塔
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.tube(group, V(tx + a * 5, ty - 1, tz + b * 5), V(tx + a * 3, ty + 26, tz + b * 3), 0.6, mats.mid);
      part(C1, mats.hut[0], tx, ty + 31, tz, 7, 10, 7);
      part(C1, mats.roof, tx, ty + 36.6, tz, 7.4, 1.2, 7.4);
      markCircle(tx, tz, 10);
    }
    counts.settlement = settle;

    // ════ 4. 浚渫土の盛土: 運河に沿って細長い、低くなだらかな自然の山(高さ 3〜10)。ところどころ投棄の崖、古いものは草が生える ════
    // 1 つずつ極座標の格子(中心から縁へ 10 輪 × 28 方位)を頂点色で作り、全部を 1 メッシュにまとめる(頂点色を使うので焼かない)
    let mounds = 0;
    const mPos = [], mCol = [], moundVeg = [];
    const mc = { freshW: col(0xcfc8b2), freshE: col(0xd9ccb0), oldW: col(0xbfc0a6), oldE: col(0xc6bc9c), scarp: col(0xb6a78b), base: col(0xb9b29e) };
    for (let t = 0; t < 6000 && mounds < 20; t++) {
      const x = BAND[0] + 60 + rnd() * (BAND[1] - BAND[0] - 120), z = -HALF + 140 + rnd() * (2 * HALF - 280), sd = waterSD(x, z);
      if (sd < 95 || sd > 520) continue;
      const rAlong = 42 + rnd() * 50, rAcross = 16 + rnd() * 18, a = bankAngle(x, z) + (rnd() - 0.5) * 0.3, P = frame(x, z, a);   // 局所の z が運河に沿う向き
      if (!okRect(P, rAcross * 2.4, rAlong * 2.4, 4) || !freeRect(P, rAcross * 2.4, rAlong * 2.4) || nearUnit(x, z, 170)) continue;   // 縁のノイズ(最大 1.18 倍)の分だけ広く確かめる
      const Hm = 3 + rnd() * 7, seed = rnd() * 80, old = rnd() < 0.45, scarp = rnd() < 0.35, thS = rnd() * Math.PI * 2, west = x < -80;
      const NR = 10, NA = 28;
      const bnd = (th) => 0.78 + 0.4 * fbm(Math.cos(th) * 1.3 + seed, Math.sin(th) * 1.3 - seed, 2);   // 縁の出入り
      const at = (tr, th) => P(Math.cos(th) * rAcross * tr * bnd(th), Math.sin(th) * rAlong * tr * bnd(th));
      const hOf = (tr, th) => {   // 中心からの割合 tr(0〜1)と方位 th での高さ(地面から)
        const [lx, lz] = [Math.cos(th) * rAcross * tr, Math.sin(th) * rAlong * tr];
        let prof = Math.pow(Math.max(0, 1 - tr * tr), 1.25);
        if (scarp) { const w = smooth(0.25, 0.85, Math.cos(th - thS)); prof = prof * (1 - w) + w * Math.min(1, (1 - tr) / 0.2) * (1 - 0.3 * tr * tr); }   // 投棄の崖: 上は平ら、端で急に落ちる
        const lump = 0.82 + 0.36 * fbm(lx / 16 + seed, lz / 16 - seed, 3) + 0.12 * fbm(lx / 5 - seed, lz / 5 + seed, 2);
        return tr >= 0.999 ? -0.9 : Hm * prof * lump - 0.6 * tr * tr;
      };
      const vtx = (tr, th) => { const [px, pz] = tr === 0 ? [x, z] : at(tr, th), h = hOf(tr, th); return [px, H(px, pz) + h, pz, h, tr, th]; };
      const colOf = (v) => {   // 新しいものは明るい砂、古いものは灰緑。崖の面は暗く、裾は地面に近い色
        const [, , , h, tr, th] = v, c = (old ? (west ? mc.oldW : mc.oldE) : (west ? mc.freshW : mc.freshE)).clone();
        if (scarp && tr > 0.75) c.lerp(mc.scarp, smooth(0.25, 0.85, Math.cos(th - thS)) * 0.8);
        c.lerp(mc.base, smooth(0.6, 1, tr) * 0.5);
        return c.multiplyScalar(0.94 + 0.1 * fbm(v[0] / 9, v[2] / 9, 2) + 0.02 * h / Hm);
      };
      const tri = (A, B2, Cc) => {
        const ny = (B2[2] - A[2]) * (Cc[0] - A[0]) - (B2[0] - A[0]) * (Cc[2] - A[2]);
        const o = ny >= 0 ? [A, B2, Cc] : [A, Cc, B2];
        for (const v of o) { mPos.push(v[0], v[1], v[2]); const c = colOf(v); mCol.push(c.r, c.g, c.b); }
      };
      const ring = (i) => Array.from({ length: NA }, (_, j) => vtx(i / NR, (j / NA) * Math.PI * 2));
      let prev = ring(1); const c0 = vtx(0, 0);
      for (let j = 0; j < NA; j++) tri(c0, prev[j], prev[(j + 1) % NA]);
      for (let i = 2; i <= NR; i++) { const cur = ring(i); for (let j = 0; j < NA; j++) { const j2 = (j + 1) % NA; tri(prev[j], cur[j], cur[j2]); tri(prev[j], cur[j2], prev[j2]); } prev = cur; }
      if (old) for (let n = 0; n < 40 + rAlong * 0.6; n++) {   // 古い盛土の上の草と低木(崖の面には生やさない)
        const tr = Math.sqrt(rnd()) * 0.92, th = rnd() * Math.PI * 2;
        if (scarp && tr > 0.7 && Math.cos(th - thS) > 0.3) continue;
        const [px, pz] = at(tr, th); moundVeg.push([px, H(px, pz) + hOf(tr, th) - 0.25, pz, rnd() < 0.7 ? "tuft" : "scrub"]);
      }
      markRect(P, rAcross * 2.4, rAlong * 2.4, 6); mounds++; (counts.moundAt ??= []).push([Math.round(x), Math.round(z), Math.round(Hm * 10) / 10, old ? 1 : 0, scarp ? 1 : 0]);
    }
    if (mPos.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(mPos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(mCol, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })); m.userData.keep = true; group.add(m);
    }
    counts.mounds = mounds;

    // ════ 5. 古い軍の跡: 低い土塁、射撃壕、掩蔽壕の殻 ════
    let berms = 0, pits = 0, bunkers = 0;
    for (let t = 0; t < 6000 && berms < 26; t++) {
      const x = BAND[0] + 40 + rnd() * (BAND[1] - BAND[0] - 80), z = -HALF + 150 + rnd() * (2 * HALF - 300), sd = waterSD(x, z);
      if (sd < 100 || (x < 0 && rnd() < 0.6)) continue;   // 東の岸と中州に多め
      const L = 28 + rnd() * 40, a = bankAngle(x, z) + (rnd() - 0.5) * 0.9, P = frame(x, z, a);   // 向きは運河からばらす(縦に並んだ刃に見せない)
      if (!okRect(P, 14, L, 3) || !freeRect(P, 16, L) || nearUnit(x, z, 170)) continue;
      // 盛土: 低く幅広い(高さ 1.4〜2.6、幅 6〜11)。断面はなだらかな丸い肩、平面は両端へ長く細る。頂の高さと幅はノイズで崩し、わずかに弓なり
      const W = 6 + rnd() * 5, Hm = 1.4 + rnd() * 1.2, bend = (rnd() - 0.5) * 8, seed = rnd() * 30, N = 16, rings = [];
      for (let i = 0; i <= N; i++) {
        const t2 = i / N, s2 = Math.sin(Math.PI * t2), env = Math.pow(s2, 0.8);
        const w = Math.max(0.8, W * (0.7 + 0.5 * fbm(t2 * 3 + seed, seed, 2)) * env), h = Math.max(0.15, Hm * Math.pow(s2, 1.1) * (0.75 + 0.5 * fbm(t2 * 5 - seed, seed * 0.5, 2)));
        const lz = (t2 - 0.5) * L, lx = bend * (1 - (2 * t2 - 1) ** 2), [cx2, cz2] = P(lx, lz), yb = H(cx2, cz2) - 0.9;
        rings.push([[-1, 0], [-0.75, 0.32], [-0.42, 0.78], [0, 1], [0.42, 0.78], [0.75, 0.32], [1, 0]].map(([u, v]) => { const [px, pz] = P(lx + u * w, lz); return V(px, yb + v * (h + 0.9), pz); }));
        if (i > 1 && i < N - 1 && rnd() < 0.55) { const [px, pz] = P(lx + (rnd() - 0.5) * w * 0.8, lz); moundVeg.push([px, yb + (h + 0.9) * 0.85, pz, rnd() < 0.8 ? "tuft" : "scrub"]); }   // 盛土の上のまばらな草
      }
      k.add(k.closedLoft(rings), x < -80 ? mats.bermW : mats.bermE, group, { edges: false });
      (counts.bermAt ??= []).push([Math.round(x), Math.round(z)]);
      markRect(P, 10, L, 3); berms++;
    }
    for (let t = 0; t < 6000 && pits < 22; t++) {
      const x = BAND[0] + 30 + rnd() * (BAND[1] - BAND[0] - 60), z = -HALF + 150 + rnd() * (2 * HALF - 300);
      if (waterSD(x, z) < 90) continue;
      const a = rnd() * Math.PI * 2, P = frame(x, z, a);
      if (!okRect(P, 22, 18, 2) || !freeRect(P, 22, 18)) continue;
      const [lo] = footH(P, 22, 18);
      // U 字の土嚢の縁(前と両脇)と、中の暗い床
      for (const [u, v, w, d] of [[0, 7, 20, 3.2], [-9, 0, 3.2, 14], [9, 0, 3.2, 14]]) lbox(P, a, mats.sand, u, v, w, 2.4, d, lo - 0.4, false);
      lbox(P, a, mats.berm, 0, 0, 15, 0.3, 11, lo - 0.1, false);
      markRect(P, 22, 18, 3); pits++;
    }
    for (let t = 0; t < 6000 && bunkers < 9; t++) {
      const x = BAND[0] + 30 + rnd() * (BAND[1] - BAND[0] - 60), z = -HALF + 150 + rnd() * (2 * HALF - 300);
      if (waterSD(x, z) < 80 || x < 100) continue;
      const a = bankAngle(x, z) + Math.PI / 2 * (rnd() < 0.5 ? 1 : -1), P = frame(x, z, a);
      if (!okRect(P, 18, 14, 3) || !freeRect(P, 18, 14)) continue;
      const [lo] = footH(P, 18, 14);
      lbox(P, a, mats.berm, 0, 0, 22, 2.2, 18, lo - 0.6, false);              // 半ば埋まった土
      for (const [u, v, w, d] of [[0, -6, 16, 1.6], [-7.2, 0, 1.6, 12], [7.2, 0, 1.6, 12]]) lbox(P, a, mats.bunker, u, v, w, 6, d, lo - 0.5);   // 3 面の壁
      lbox(P, a, mats.bunker, 2.5, 6, 11, 4.2, 1.6, lo - 0.5);                   // 前の壁(銃眼の左)
      lbox(P, a, mats.dark, -4.8, 6.1, 3.6, 1.0, 1.7, lo + 2.6, false);          // 銃眼
      lbox(P, a, mats.bunker, -2, -1, 12, 1.2, 9, lo + 5.5, true, 0.12);         // 崩れかけの屋根板(傾く)
      for (let r = 0; r < 4; r++) lbox(P, a, mats.bunker, 3 + rnd() * 5, 2 + rnd() * 4, 2 + rnd() * 2, 1 + rnd(), 2 + rnd() * 2, lo, true, rnd());   // 瓦礫
      markRect(P, 20, 16, 4); bunkers++;
    }
    Object.assign(counts, { berms, pits, bunkers });

    // ════ 6. 湿った斑・塩の斑(水辺の堤防の外)と葦原 ════
    // 斑: 縁をノイズで大きく崩した細長い板(運河に沿う向き)。中心から縁へ 4 つの輪で色を地面の色へ寄せ、縁は地面とほぼ同じにする(硬い円に見せない)
    // 地面の色は suez.js の運河地帯の色(西岸 0xd8d8c0 / 0xcfd0b6、中州・東岸 0xe6decb / 0xddd3bd)に細部のテクスチャを掛けた分だけ少し暗くしたもの
    const PATCH = {
      damp: { w: col(0xc4c6ad), e: col(0xd2c7ae) }, damp2: { w: col(0xcacbb2), e: col(0xd8cdb5) }, salt: { w: col(0xdedcc9), e: col(0xece4d2) },
      rim: { w: col(0xcfd0b8), e: col(0xdfd6c1) },
    };
    const patchMesh = (list, kind, offset) => {
      const pos = [], cols = [], NA = 22, RINGS = [0, 0.42, 0.74, 1], MIX = [0, 0.08, 0.5, 0.94];
      for (const { x, z, r, seed, ang, asp } of list) {
        const west = x < -80, cIn = PATCH[kind][west ? "w" : "e"], cRim = PATCH.rim[west ? "w" : "e"], P = frame(x, z, ang);
        const rad = (th, f) => r * (0.55 + 0.75 * fbm(Math.cos(th) * 1.7 + seed, Math.sin(th) * 1.7 - seed, 3)) * (f < 1 ? 0.9 + 0.2 * fbm(Math.cos(th) * 2.6 - seed + f * 4, Math.sin(th) * 2.6 + seed, 2) : 1);
        const vtx = (f, th) => { const R = rad(th, f) * f, [px, pz] = f === 0 ? [x, z] : P(Math.cos(th) * R * asp, Math.sin(th) * R); return [px, H(px, pz) + 0.18, pz, f]; };
        const colOf = (f) => { const i = RINGS.indexOf(f), c = cIn.clone().lerp(cRim, MIX[i]); return c.multiplyScalar(0.985 + rnd() * 0.03); };
        const tri = (A, B2, Cc) => {
          const ny = (B2[2] - A[2]) * (Cc[0] - A[0]) - (B2[0] - A[0]) * (Cc[2] - A[2]), o = ny >= 0 ? [A, B2, Cc] : [A, Cc, B2];
          for (const v of o) { pos.push(v[0], v[1], v[2]); const c = colOf(v[3]); cols.push(c.r, c.g, c.b); }
        };
        const ring = (f) => Array.from({ length: NA }, (_, j) => vtx(f, (j / NA) * Math.PI * 2));
        const c0 = vtx(0, 0); let prev = ring(RINGS[1]);
        for (let j = 0; j < NA; j++) tri(c0, prev[j], prev[(j + 1) % NA]);
        for (let i = 2; i < RINGS.length; i++) { const cur = ring(RINGS[i]); for (let j = 0; j < NA; j++) { const j2 = (j + 1) % NA; tri(prev[j], cur[j], cur[j2]); tri(prev[j], cur[j2], prev[j2]); } prev = cur; }
      }
      if (!pos.length) return;
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 - offset, polygonOffsetUnits: -1 - offset })); m.userData.keep = true; group.add(m);
    };
    const damp = [], damp2 = [], saltF = [], wetSpots = [];
    for (let t = 0; t < 20000 && damp.length + damp2.length + saltF.length < 300; t++) {
      const x = BAND[0] + 10 + rnd() * (BAND[1] - BAND[0] - 20), z = -HALF + 30 + rnd() * (2 * HALF - 60), sd = waterSD(x, z);
      if (sd < 64 || sd > 360 || rnd() > 1.15 - sd / 360) continue;   // 水に近いほど多い
      const r = 12 + rnd() * 30;
      if (!okSmall(x, z, r * 0.6) || nearUnit(x, z, 30)) continue;
      const kind = rnd(), item = { x, z, r: r * 1.15, seed: rnd() * 20, ang: bankAngle(x, z) + (rnd() - 0.5) * 0.9, asp: 0.42 + rnd() * 0.36 };
      if (kind < 0.42) { damp.push(item); if (rnd() < 0.5) wetSpots.push(item); } else if (kind < 0.75) damp2.push(item); else saltF.push(item);
    }
    patchMesh(damp, "damp", 0); patchMesh(damp2, "damp2", 0); patchMesh(saltF, "salt", 1);
    counts.patches = damp.length + damp2.length + saltF.length;

    // ════ 7. 轍(砂地を横切る 2 本の暗い筋) ════
    const ruts = [];
    for (let n = 0; n < 34; n++) {
      let x = BAND[0] + 30 + rnd() * (BAND[1] - BAND[0] - 60), z = -HALF + 100 + rnd() * (2 * HALF - 200), h = rnd() * Math.PI * 2;
      const run = [];
      for (let s = 0; s < 60; s++) {
        if (!okSmall(x, z, 3) || onDike(waterSD(x, z), 2)) break;
        run.push([x, z]); h += (rnd() - 0.5) * 0.25; x += Math.sin(h) * 14; z += Math.cos(h) * 14;
      }
      if (run.length < 6) continue;
      for (const o of [-2.4, 2.4]) {
        const r2 = run.map(([px, pz], i) => { const [qx, qz] = run[Math.min(run.length - 1, i + 1)], [rx2, rz2] = run[Math.max(0, i - 1)], l = Math.hypot(qx - rx2, qz - rz2) || 1; return [px - ((qz - rz2) / l) * o, pz + ((qx - rx2) / l) * o]; });
        ruts.push(r2);
      }
    }
    drapePlate(ruts, 1.3, 0.25, C.rut, 2);
    counts.ruts = ruts.length / 2;

    // ════ 8. 地面の小物(InstancedMesh): 草の株、低木、塩生の低木、小石、葦 ════
    const tint = (g, c) => ({ geo: g.index ? g.toNonIndexed() : g, color: col(c) });
    const blades = (n, h, w, c, lean = 0.4, seed = 1) => {
      const pos = [], r = ctx.rng(seed);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.6, ca = Math.cos(a), sa = Math.sin(a), hh = h * (0.7 + r() * 0.5), l = lean * hh;
        pos.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * l, hh, sa * l);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      g.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
      return { geo: g, color: col(c) };
    };
    const GEO = {
      // 色はインスタンスの色(toneAt)で付けるので、形の頂点色は灰の濃淡だけ
      tuft: U.concat(THREE, [blades(6, 2.8, 0.55, 0xffffff, 0.35, 3)]),
      tuft2: U.concat(THREE, [blades(5, 2.2, 0.5, 0xf2f2f2, 0.45, 7)]),
      scrub: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 0).scale(2.5, 1.35, 2.1).translate(0, 0.9, 0), 0xffffff), tint(new THREE.IcosahedronGeometry(1, 0).scale(1.6, 1.1, 1.5).translate(1.5, 0.8, 0.9), 0xdcdcdc), tint(new THREE.OctahedronGeometry(1, 0).scale(1.3, 0.9, 1.2).translate(-1.3, 0.6, -0.8), 0xe8e8e8)]),   // 丸めの葉の塊(角ばった石に見せない)
      salt: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 0).scale(2.2, 1.1, 2.0).translate(0, 0.7, 0), 0xffffff), tint(new THREE.IcosahedronGeometry(1, 0).scale(1.4, 0.9, 1.3).translate(-1.4, 0.6, 0.8), 0xe3e3e3)]),
      stone: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.55, 0.8), 0xffffff)]),
      stone2: U.concat(THREE, [tint(new THREE.DodecahedronGeometry(1, 0).scale(1, 0.48, 0.78), 0xeeeeee)]),
      reed: U.concat(THREE, [blades(9, 7.5, 0.35, C.reed, 0.15, 11), blades(5, 6, 0.3, C.reedD, 0.25, 13), tint(new THREE.OctahedronGeometry(0.5, 0).scale(0.6, 1.6, 0.6).translate(0.4, 8, 0.2), C.plume)]),
      cas: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.45, 0.75, 11, 6).translate(0, 5.5, 0), C.trunk), tint(new THREE.IcosahedronGeometry(1, 0).scale(3.6, 8, 3.6).translate(0, 14, 0), C.crown), tint(new THREE.IcosahedronGeometry(1, 0).scale(2.6, 5.4, 2.6).translate(0.5, 20, -0.3), C.crownD)]),
    };
    const inst = { tuft: [], tuft2: [], scrub: [], salt: [], stone: [], stone2: [], reed: [], cas: casPos.map(([x, z, s]) => [x, H(x, z) - 0.6, z, s, rnd() * 6, 1]) };
    // 草と低木: ノイズで疎密をつける。湿った所の近くは塩生の低木、堤防の上は草だけ
    // 疎密は 2 つのノイズ(大きなまだら × 小さな群れ)。帯の端では密度を隣の層へ寄せて下げ、東の端の外へは FRINGE だけ薄れながらはみ出す
    for (let x = BAND[0] + 2; x < BAND[1] + FRINGE; x += 4.4) for (let z = -HALF + 20; z < HALF - 20; z += 4.4) {
      const jx = x + (rnd() - 0.5) * 4, jz = z + (rnd() - 0.5) * 4, dens = fbm(jx / 160 + 3, jz / 160 - 1, 3), clump = fbm(jx / 42 - 7, jz / 42 + 4, 2), sd = waterSD(jx, jz);
      const fringe = jx >= BAND[1], fade = fringe ? 0.6 * (1 - (jx - BAND[1]) / FRINGE) : 1 - 0.4 * edgeW(jx);
      const p = rnd();
      if (p > 0.85 * (0.07 + 0.42 * smooth(0.3, 0.75, dens)) * (0.4 + 1.2 * smooth(0.35, 0.72, clump)) * fade) continue;
      if (fringe ? !okFringe(jx, jz) : (!okSmall(jx, jz, 0) || occupied(jx, jz))) continue;
      const y = H(jx, jz) - 0.2, r = rnd() * 6, s = rnd() < 0.08 ? 1.5 + rnd() * 0.7 : 0.8 + rnd() * 0.75;   // 大きさは広くばらし、ときどき大きな株
      const onBank = Math.abs(sd - 55) < 12;
      const q = rnd();
      if (onBank || q < 0.6) inst[rnd() < 0.65 ? "tuft" : "tuft2"].push([jx, y, jz, s, r, 1]);
      else if (q < 0.8) inst[sd < 160 ? "salt" : "scrub"].push([jx, y, jz, s * 1.1, r, 1]);
      else if (q < 0.93) inst.scrub.push([jx, y, jz, s, r, 1]);
      else inst[rnd() < 0.5 ? "stone" : "stone2"].push([jx, y + 0.1, jz, 1.1 + rnd() * 1.5, r, 1]);
    }
    // 盛土・土塁の上の草
    for (const [x, y, z, kind] of moundVeg) if (!nearLine(x, z, 14) && !isWater(x, z)) inst[kind].push([x, y, z, 0.7 + rnd() * 0.6, rnd() * 6, 1]);
    // 小石の散らばり(群れ)
    // 群れはノイズの高い所に寄せ、数を減らす。小さすぎる石は少なく(大きさは 0.75〜2.3、平方根で大きめに寄せる)
    for (let n = 0, made = 0; n < 4000 && made < 520; n++) {
      const cx = BAND[0] + 20 + rnd() * (BAND[1] - BAND[0] - 40), cz = -HALF + 40 + rnd() * (2 * HALF - 80), R = 8 + rnd() * 24;
      if (fbm(cx / 120 + 9, cz / 120 - 3, 2) < 0.48 || !okSmall(cx, cz, 2)) continue;
      made++;
      const cnt = Math.round((6 + rnd() * 12) * (1 - 0.4 * edgeW(cx)));
      for (let i = 0; i < cnt; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (!okSmall(x, z, 0) || occupied(x, z)) continue;
        inst[rnd() < 0.5 ? "stone" : "stone2"].push([x, H(x, z) + 0.05, z, 0.75 + Math.sqrt(rnd()) * 1.55, rnd() * 6, 1]);
      }
    }
    // 葦原: 湿った斑の中、斜路のそば、湖と分水路のほとりの浅い所(護岸の無い所)
    for (const w of wetSpots) {
      const cnt = Math.round(w.r * 1.4);
      for (let i = 0; i < cnt; i++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * w.r * 0.65, x = w.x + Math.cos(a) * d, z = w.z + Math.sin(a) * d * 0.7; if (okSmall(x, z, 0) && !occupied(x, z)) inst.reed.push([x, H(x, z) - 0.3, z, 0.7 + rnd() * 0.6, rnd() * 6, 1]); }
    }
    counts.reedBeds = wetSpots.length;
    const instMat = (side = THREE.FrontSide) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side });
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = V(0, 1, 0), tc = new THREE.Color();
    for (const [kind, list] of Object.entries(inst)) {
      counts[kind] = list.length; if (!list.length) continue;
      const side = kind === "tuft" || kind === "tuft2" || kind === "reed" ? THREE.DoubleSide : THREE.FrontSide;
      const im = new THREE.InstancedMesh(GEO[kind], instMat(side), list.length);
      list.forEach(([x, y, z, s, r], i) => { mt.compose(V(x, y, z), q.setFromAxisAngle(up, r), sc.set(s, s * (0.85 + rnd() * 0.3), s)); im.setMatrixAt(i, mt); im.setColorAt(i, PAL[kind] ? toneAt(kind, x, z) : tc.setScalar(0.92 + rnd() * 0.12)); });
      group.add(im);
    }

    U.bake(THREE, group, { also: [M.lamp] });
    // 確認: 建物・小物が水の中に無いか、道路の上に無いか(焼く前の配置の点で数えた分は省き、小物の点で測る)
    const check = () => {
      let inWater = 0, onRoad = 0, n = 0;
      const at = [];
      for (const [kind, list] of Object.entries(inst)) for (const [x, , z] of list) { n++; if (isWater(x, z)) inWater++; if (nearLine(x, z, 10)) { onRoad++; if (at.length < 6) at.push([kind, Math.round(x), Math.round(z)]); } }
      return { items: n, inWater, onRoad, onRoadAt: at };
    };
    return { group, counts, check };
  }

  const maps = ((window.DreamAssets ??= {}).maps ??= { sites: {} });
  if (maps.deco) maps.deco("zone", make); else (maps.decos ??= {}).zone = make;
})();
