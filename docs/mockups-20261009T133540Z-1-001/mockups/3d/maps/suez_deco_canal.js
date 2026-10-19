// 装飾の層「運河」: 水際と線の設備を地図全体に足す(攻略拠点の制圧圏の中は拠点の建造物に任せて置かない)。
//   運河の岸: 大運河・新運河・湖・東の分水路の石張りの護岸(段ごとに互い違いの石のブロック、暗い目地、水際の濡れた段、天端の笠石)、
//     堤防の上の管理道路(補修の跡、縁の白線、視線誘導の柱、待避所、水際の作業道へ下りる斜路、資材の置き場)、キロポストと 100 m ごとの標、航路の灯の柱、信号の鉄塔、係船柱、水路の浮標
//   西の用水路(障壁)と細い用水路: コンクリートの護岸と天端、岸の葦
//   道路: 中央の破線・外側線、路肩、水辺と橋の取付けのガードレール、並木、交差点の標識・門型の標識、鉄道との踏切(遮断機の柱と腕、警標)
//   鉄道: 道床(台形)、枕木、2 本のレール、信号機。架線は無い
//   自動の橋(ctx.autoBridges): 道路橋は側桁と照明柱、鉄道橋は上路の鈑桁と補剛材、枕木とレール
//   送電線: 運河地帯を東西に渡る 2 系統(格子の鉄塔、腕金、がいし、たるんだ電線)
// 縮尺は拠点と同じ約 0.6 単位/m。小さな物は最大 2 倍まで大きくして読めるようにする。人と車両は置かない。
(function () {
  // 堤防の道の待避所・斜路・資材の置き場の配置(決まった乱数で毎回同じ)。運河地帯の層(zone)も同じ配置を読んで、そこに物を置かない
  function dikeFeatures(ctx) {
    const { segDist, lineDist, isWater, nearSite, lake, barrier, autoBridges } = ctx;
    const CH = DreamAssets.maps.suez.CHANNELS, rnd = ctx.rng(5150);
    const waterSD = (x, z) => {
      let d = Infinity;
      for (const c of CH) { if (c.name === "東の分水路" && x < c.a[0] - 10) continue; d = Math.min(d, segDist(x, z, c.a, c.b) - c.hw); }
      d = Math.min(d, (Math.hypot((x - lake.cx) / lake.rx, (z - lake.cz) / lake.rz) - 1) * lake.rz);
      return Math.min(d, lineDist(x, z, barrier.pts) - barrier.hw);
    };
    const CROSS = [...autoBridges.map((b) => [b.a, b.b]), [[-110, 0], [510, 0]], [[-120, -3050], [120, -3050]], [[-110, 1450], [510, 1450]]];
    const nearCross = (x, z, pad) => CROSS.some(([a, b]) => segDist(x, z, a, b) < pad);
    const laybys = [], ramps = [], stands = [];
    for (const c of CH) {
      if (c.name === "東の分水路") continue;
      const L = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]), ux = (c.b[0] - c.a[0]) / L, uz = (c.b[1] - c.a[1]) / L;
      for (const side of [-1, 1]) {
        const nx = -uz * side, nz = ux * side, at = (t, d) => [c.a[0] + ux * t + nx * (c.hw + d), c.a[1] + uz * t + nz * (c.hw + d)];
        const okAt = (t, d, pad) => { const [x, z] = at(t, d); return !isWater(x, z) && !nearSite(x, z, 30 + pad) && waterSD(x, z) > d - 8 && !nearCross(x, z, 40 + pad) && ctx.nearLine && !ctx.nearLine(x, z, 20 + pad) && Math.abs(z) < 3960; };
        const ang = Math.atan2(ux, uz);
        for (let t = 150 + rnd() * 300; t < L - 100; t += 560 + rnd() * 260) {   // 待避所(水側に膨らむ)
          if (![-40, 0, 40].every((o) => okAt(t + o, 55, 10) && okAt(t + o, 44, 6))) continue;
          laybys.push({ t, len: 80, c, side, ux, uz, nx, nz, ang });
        }
        for (let t = 300 + rnd() * 300; t < L - 100; t += 470 + rnd() * 240) {   // 斜路(堤防の道から水際の作業道へ斜めに下りる)
          if (laybys.some((l) => l.c === c && l.side === side && Math.abs(l.t - t) < 90)) continue;
          if (![0, 15, 30].every((o) => okAt(t + o, 50 - o * 0.56, 4))) continue;
          ramps.push({ a: at(t, 50.5), b: at(t + 30, 33), c, side, ang });
        }
        for (let t = 400 + rnd() * 400; t < L - 100; t += 820 + rnd() * 380) {   // 資材の置き場(堤防の陸側)
          if (![-14, 0, 14].every((o) => okAt(t + o, 72, 12))) continue;
          const [x, z] = at(t, 72);
          stands.push({ x, z, ang, w: 28, d: 15, nx, nz });
        }
      }
    }
    // 占有の四角(中心、角度、長さ(岸に沿う)、幅)。zone はここに建物・小物を置かない
    const rects = [
      ...laybys.map((l) => { const [x, z] = [l.c.a[0] + l.ux * l.t + l.nx * (l.c.hw + 45), l.c.a[1] + l.uz * l.t + l.nz * (l.c.hw + 45)]; return { x, z, ang: l.ang, along: l.len + 10, across: 14 }; }),
      ...ramps.map((r) => ({ x: (r.a[0] + r.b[0]) / 2, z: (r.a[1] + r.b[1]) / 2, ang: Math.atan2(r.b[0] - r.a[0], r.b[1] - r.a[1]), along: Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]) + 6, across: 12 })),
      ...stands.map((s) => ({ x: s.x, z: s.z, ang: s.ang, along: s.w + 8, across: s.d + 8 })),
    ];
    return { laybys, ramps, stands, rects };
  }
  DreamAssets.maps.canalDikeFeatures = dikeFeatures;

  DreamAssets.maps.deco("canal", (THREE, ctx) => {
    const { U, M, k, landH, isWater, nearSite, segDist, lineDist, smooth, WY, BED, roads, rail, barrier, fresh, lake, autoBridges } = ctx;
    const CH = DreamAssets.maps.suez.CHANNELS;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h, n = 8) => new THREE.CylinderGeometry(r, r, h, n);
    const lam = (c, extra = {}) => M.lambert(c, extra);
    const NI = (g) => (g.index ? g.toNonIndexed() : g);
    const MAT = {
      stone: lam(0xc4c9cc), wet: lam(0xa4acb2), coping: lam(0xeef0f1), concrete: lam(0xdde1e3), dike: lam(0xd3d8db), grout: lam(0x66707a), patchD: lam(0xc4cace), patchL: lam(0xe0e3e5), gravel: lam(0xd5d7d2), kerb: lam(0xbfc5c9),
      drum: lam(0x8c7b66), gab: lam(0xb7ad99), gen: lam(0xe3e6e8), cont: lam(0x9fb0bd),
      paint: lam(0xf7f8f8), shoulder: lam(0xd7dbde), rail: lam(0x4b555e), ballast: lam(0xb9b4aa), sleeper: lam(0x8a8378), steel: lam(0xaeb7c0), dark: lam(0x3b4752),
      red: lam(0xd8473a), green: lam(0x2f9a5c), sign: lam(0x46606e), lamp: M.lamp, sigG: M.basic(0x46d07a), sigR: M.basic(0x5a2f2f),
      wire: new THREE.LineBasicMaterial({ color: 0x5b6570, transparent: true, opacity: 0.8 }), joint: new THREE.LineBasicMaterial({ color: 0x8e979e, transparent: true, opacity: 0.6 }),
    };
    const group = new THREE.Group();
    const rnd = ctx.rng(77123);
    const stats = { revetRows: 0, dikeRoad: 0, kmPosts: 0, beacons: 0, masts: 0, bollards: 0, buoys: 0, reeds: 0, dashes: 0, guardPosts: 0, trees: 0, signs: 0, gantries: 0, levelX: 0, sleepers: 0, signals: 0, bridgeLamps: 0, pylons: 0 };

    // ── 地形の実際の高さ(suez.js の地形の格子と同じ式。岸の斜面を含む) ──
    function waterSD(x, z) {
      let d = Infinity;
      for (const c of CH) { if (c.name === "東の分水路" && x < c.a[0] - 10) continue; d = Math.min(d, segDist(x, z, c.a, c.b) - c.hw); }
      d = Math.min(d, (Math.hypot((x - lake.cx) / lake.rx, (z - lake.cz) / lake.rz) - 1) * lake.rz);
      return Math.min(d, lineDist(x, z, barrier.pts) - barrier.hw);
    }
    const surf = (x, z) => { const d = waterSD(x, z); return d < -14 ? BED : BED + (Math.max(0.5, landH(x, z)) - BED) * smooth(-14, 6, d); };

    // ── 面の帯(行 = 横断の点の列)。三角形は上向きにそろえる ──
    function ribbon(runs, mat) {
      const pos = [], a = V(0, 0, 0), b = V(0, 0, 0), c = V(0, 0, 0), e1 = V(0, 0, 0), e2 = V(0, 0, 0);
      const tri = (p, q, r) => { a.set(...p); b.set(...q); c.set(...r); e1.subVectors(b, a); e2.subVectors(c, a); const ny = e1.z * e2.x - e1.x * e2.z; if (ny >= 0) pos.push(...p, ...q, ...r); else pos.push(...p, ...r, ...q); };
      for (const run of runs) for (let i = 0; i < run.length - 1; i++) {
        const A = run[i], B = run[i + 1];
        for (let j = 0; j < A.length - 1; j++) { tri(A[j], A[j + 1], B[j + 1]); tri(A[j], B[j + 1], B[j]); }
      }
      if (!pos.length) return null;
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); group.add(m); return m;
    }
    // 折れ線を step ごとに分けた点(位置と単位の接線)
    function sample(pl, step) {
      const out = [];
      for (let i = 0; i < pl.length - 1; i++) {
        const [ax, az] = pl[i], [bx, bz] = pl[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step)), tx = (bx - ax) / L, tz = (bz - az) / L;
        for (let s = i === 0 ? 0 : 1; s <= n; s++) out.push({ x: ax + ((bx - ax) * s) / n, z: az + ((bz - az) * s) / n, tx, tz });
      }
      return out;
    }
    // 条件を満たす点の連続した区間に分ける
    const runsOf = (pts, ok) => { const out = []; let cur = []; for (const p of pts) { if (ok(p)) cur.push(p); else { if (cur.length > 1) out.push(cur); cur = []; } } if (cur.length > 1) out.push(cur); return out; };
    const merged = (parts, mat) => { if (!parts.length) return null; const m = new THREE.Mesh(U.merge(THREE, parts), mat); group.add(m); return m; };
    const inst = (geo, mat, list) => {   // list = [{x, y, z, ry, s, sy}]
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length), mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V(1, 1, 1), up = V(0, 1, 0);
      list.forEach((o, i) => { mt.compose(V(o.x, o.y, o.z), q.setFromAxisAngle(up, o.ry ?? 0), sc.set(o.s ?? 1, o.sy ?? o.s ?? 1, o.s ?? 1)); im.setMatrixAt(i, mt); });
      group.add(im); return im;
    };
    const lineSegs = (arr, mat) => { if (!arr.length) return; const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); group.add(new THREE.LineSegments(g, mat)); };

    // 渡河(橋・トンネル)の近く。浮標や係船柱を置かない
    const CROSS = [...autoBridges.map((b) => [b.a, b.b]), [[-110, 0], [510, 0]], [[-120, -3050], [120, -3050]], [[-110, 1450], [510, 1450]]];
    const nearCross = (x, z, pad) => CROSS.some(([a, b]) => segDist(x, z, a, b) < pad);

    // ════ 1. 運河の岸: 石張りの護岸 ════
    // 水際の下から堤防の手前まで(水の縁から -3〜11)を、段ごとに互い違いの石のブロック(1 個ずつ明暗をばらつかせる)で張る。
    // ブロックの間は少し空け、下に敷いた暗い目地の帯が線として見える(ゲーム視点でも水際の濃い帯と石の帯が読める)。下の 2 段は濡れて暗い。天端は明るい笠石
    // 岸の線: 水路の中心線から side 側へ hw + d(d は水の縁からの距離。負 = 水の中)
    const banks = [];   // { pts: [{x, z, nx, nz}], kind }
    for (const c of CH) for (const side of [-1, 1]) {
      const pts = sample([c.a, c.b], 2).map((p) => ({ x: p.x, z: p.z, nx: -p.tz * side, nz: p.tx * side, hw: c.hw }));
      banks.push({ pts, kind: c.name === "東の分水路" ? "branch" : "canal" });
    }
    {   // 湖: 楕円の外向きの法線(d は楕円を拡大した距離。suez.js の式と同じ)
      const pts = [], NP = 1600;
      for (let i = 0; i <= NP; i++) { const t = (i / NP) * Math.PI * 2, ex = Math.cos(t), ez = Math.sin(t), nl = Math.hypot(ex / lake.rx, ez / lake.rz); pts.push({ t, ex, ez, nl }); }
      banks.push({ lake: true, pts, kind: "lake" });
    }
    const bankPt = (b, p, d) => b.lake ? [lake.cx + lake.rx * (1 + d / lake.rz) * p.ex, lake.cz + lake.rz * (1 + d / lake.rz) * p.ez] : [p.x + p.nx * (p.hw + d), p.z + p.nz * (p.hw + d)];
    const COURSES = [-3, -1.2, 1.2, 3.6, 6, 8.5, 11];   // 段の境(水の縁からの距離)
    const STONE = [0xb2b9be, 0xbec4c8, 0xa6adb3, 0xc8cdd0, 0xb8bec2, 0x9fa7ad], WETS = [0x6f7a82, 0x7c868d, 0x68727a];
    const groutRuns = [], cope = [], bPos = [], bCol = [], tc = new THREE.Color();
    const hashI = (a, b2) => { let h = Math.imul(a, 374761393) ^ Math.imul(b2, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    banks.forEach((b, bi) => {
      const ok = (p) => { const [wx, wz] = bankPt(b, p, -7), [lx, lz] = bankPt(b, p, 15), [mx, mz] = bankPt(b, p, 0); return isWater(wx, wz) && !isWater(lx, lz) && !nearSite(mx, mz, 10) && !nearCross(mx, mz, 30); };
      for (const run of runsOf(b.pts, ok)) {
        const row = (p, ds, lift) => ds.map((d) => { const [x, z] = bankPt(b, p, d); return [x, surf(x, z) + lift, z]; });
        groutRuns.push(run.map((p) => row(p, COURSES, 0.32)));
        cope.push(run.map((p) => row(p, [11, 12.6, 14.2], 0.95)));
        stats.revetRows += run.length;
        // 石のブロック: 段ごとに長さ 2〜3 点(4〜6 単位)、奇数段は半分ずらす
        for (let c = 0; c < COURSES.length - 1; c++) {
          let i = c % 2 ? 1 : 0;
          while (i < run.length - 1) {
            const n = 2 + Math.floor(hashI(bi * 7919 + c, i) * 2), j = Math.min(run.length - 1, i + n);
            const d0 = COURSES[c], d1 = COURSES[c + 1];
            const A = bankPt(b, run[i], d0), B = bankPt(b, run[i], d1), Cc = bankPt(b, run[j], d1), D = bankPt(b, run[j], d0);
            const alx = D[0] - A[0], alz = D[1] - A[1], al = Math.hypot(alx, alz) || 1, acx = B[0] - A[0], acz = B[1] - A[1], ac = Math.hypot(acx, acz) || 1;
            const ga = 0.32 / al, gc = 0.2 / ac;   // 目地の幅(沿う向き・横断の向き)
            const ins = (P, sa, sc) => [P[0] + alx * ga * sa + acx * gc * sc, P[1] + alz * ga * sa + acz * gc * sc];
            const q = [ins(A, 1, 1), ins(B, 1, -1), ins(Cc, -1, -1), ins(D, -1, 1)].map(([x, z]) => [x, surf(x, z) + 0.55 + (c >= 2 ? 0.12 : 0), z]);
            const r = hashI(i * 31 + c, bi * 131 + 7);
            tc.set(c < 2 ? WETS[Math.floor(r * WETS.length)] : STONE[Math.floor(r * STONE.length)]).multiplyScalar(0.94 + hashI(i, c * 17 + bi) * 0.1);
            for (let [p0, p1, p2] of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
              if ((p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]) < 0) [p1, p2] = [p2, p1];
              for (const p of [p0, p1, p2]) { bPos.push(...p); bCol.push(tc.r, tc.g, tc.b); }
            }
            i = j;
          }
        }
      }
    });
    ribbon(groutRuns, MAT.grout); ribbon(cope, MAT.coping);
    if (bPos.length) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(bPos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(bCol, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.userData.keep = true; group.add(m); stats.revetBlocks = bPos.length / 18; }

    // ════ 2. 堤防の上の管理道路(補修の跡・縁の白線・視線誘導の柱)、キロポストと 100 m ごとの標、航路の灯の柱、係船柱、浮標 ════
    const DF = dikeFeatures(ctx);
    const inLayby = (x, z, pad) => DF.laybys.some((l) => { const cx = l.c.a[0] + l.ux * l.t + l.nx * (l.c.hw + 46), cz = l.c.a[1] + l.uz * l.t + l.nz * (l.c.hw + 46); return Math.hypot(x - cx, z - cz) < l.len / 2 + pad; });
    const dikeRuns = [], dikeEdges = [], patchD = [], patchL = [], kmParts = [], kmBoards = [], kmFaces = [], hmParts = [], hmTops = [], delin = [], delinBand = [], beaconParts = [], beaconLamps = [], bollards = [];
    for (const b of banks) {
      if (b.kind !== "canal") continue;
      const dpts = b.pts.filter((_, i) => i % 4 === 0);   // 8 単位ごと
      const ok = (p) => { const [x, z] = bankPt(b, p, 55); return !isWater(x, z) && !nearSite(x, z, 30) && waterSD(x, z) > 30 && !nearCross(x, z, 40); };
      let acc = 0;
      for (const run of runsOf(dpts, ok)) {
        const at = (p, o, lift) => { const [x, z] = bankPt(b, p, 55 + o); return [x, landH(x, z) + lift, z]; };
        dikeRuns.push(run.map((p) => [at(p, -4.5, 0.35), at(p, 4.5, 0.35)]));
        for (const s2 of [-1, 1]) dikeEdges.push(run.map((p) => [at(p, s2 * 3.6, 0.47), at(p, s2 * 4.2, 0.47)]));
        // 補修の跡(暗い舗装の継ぎと明るい打ち替え。長さ 24〜64)
        for (let i = 0; i < run.length - 4; i += 6 + Math.floor(rnd() * 14)) {
          const n = 3 + Math.floor(rnd() * 6), seg = run.slice(i, i + n), o0 = -3 + rnd() * 2, o1 = o0 + 2.2 + rnd() * 3;
          (rnd() < 0.6 ? patchD : patchL).push(seg.map((p) => [at(p, o0, 0.42), at(p, o1, 0.42)]));
        }
        stats.dikeRoad += run.length * 8;
        const away = (p) => { const [x1, z1] = bankPt(b, p, 60), [x0, z0] = bankPt(b, p, 50); return Math.atan2(x1 - x0, z1 - z0); };
        run.forEach((p, i) => {
          acc += 8;
          if (acc % 400 < 8) {   // キロポスト: 台、白い柱、黒い頭、運河へ向けた番号の板
            const [x, z] = bankPt(b, p, 62), y = landH(x, z), ry = away(p);
            kmParts.push([box(2.6, 0.7, 2.6), { x, y: y + 0.2, z }], [box(1.4, 4.6, 1.4), { x, y: y + 2.6, z }], [box(1.6, 1.3, 1.6), { x, y: y + 5.4, z }]);
            const [bx, bz] = bankPt(b, p, 60.9);
            kmBoards.push([box(3.4, 2.2, 0.3), { x: bx, y: y + 3.3, z: bz, ry }]); kmFaces.push([box(2.6, 0.5, 0.1), { x: bx - Math.sin(ry) * 0.2, y: y + 3.5, z: bz - Math.cos(ry) * 0.2, ry }]);
            stats.kmPosts++;
          } else if (acc % 100 < 8) {   // 100 m ごとの小さな標
            const [x, z] = bankPt(b, p, 61.5), y = landH(x, z);
            hmParts.push([box(0.8, 2.6, 0.8), { x, y: y + 1.3, z }]); hmTops.push([box(0.9, 0.5, 0.9), { x, y: y + 2.7, z }]);
          }
          if (acc % 48 < 8) {    // 視線誘導の柱(水側の路肩。待避所と斜路の口は除く)
            const [x, z] = bankPt(b, p, 49.6), y = landH(x, z);
            if (inLayby(x, z, 6) || DF.ramps.some((r) => Math.hypot(x - r.a[0], z - r.a[1]) < 12)) return;
            delin.push([box(0.5, 2.8, 0.5), { x, y: y + 1.4, z }]); delinBand.push([box(0.56, 0.45, 0.56), { x, y: y + 2.3, z }]);
          }
          if ((acc + (b.pts[0].nx > 0 ? 220 : 0)) % 450 < 8) {   // 航路の灯の柱(両岸で互い違い。護岸の上の台)
            const [x, z] = bankPt(b, p, 7), y = surf(x, z) + 0.7;
            beaconParts.push([box(3.2, 1.2, 3.2), { x, y: y + 0.4, z }], [cyl(0.55, 14), { x, y: y + 7.5, z }], [box(2.2, 0.4, 2.2), { x, y: y + 14.2, z }]);
            beaconLamps.push([box(1.4, 1.6, 1.4), { x, y: y + 15.3, z }]); stats.beacons++;
          }
        });
      }
    }
    ribbon(dikeRuns, MAT.dike); ribbon(dikeEdges, MAT.paint); ribbon(patchD, MAT.patchD); ribbon(patchL, MAT.patchL);
    merged(kmParts, MAT.paint); merged(kmBoards, MAT.sign); merged(kmFaces, MAT.paint); merged(hmParts, MAT.paint); merged(hmTops, MAT.dark); merged(delin, MAT.paint); merged(delinBand, MAT.dark);
    merged(beaconParts, MAT.steel); merged(beaconLamps, MAT.lamp);
    // 係船柱の列(待避所。決めた区間だけ)
    for (const [cx, z0, z1, side] of [[0, -2650, -2250, -1], [0, 2900, 3450, 1], [400, -950, -520, 1], [0, -3700, -3350, 1]]) {
      for (let z = z0; z <= z1; z += 24) {
        const x = cx + side * (80 + 4.5), y = surf(x, z);
        if (isWater(x, z) || nearSite(x, z, 0)) continue;
        bollards.push({ x, y: y + 0.2, z }); stats.bollards++;
      }
    }
    const bollardG = U.concat(THREE, [{ geo: NI(cyl(1.0, 2.4, 10).translate(0, 1.2, 0)), color: new THREE.Color(0x3b4752) }, { geo: NI(cyl(1.5, 0.5, 10).translate(0, 2.5, 0)), color: new THREE.Color(0x3b4752) }]);
    inst(bollardG, U.vcLambert(THREE), bollards);
    // 浮標(運河の両側の水の中、互い違い。赤の円筒と緑の円錐)
    const buoyR = [], buoyG = [];
    for (const c of CH.slice(0, 3)) {
      const L = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]), ux = (c.b[0] - c.a[0]) / L, uz = (c.b[1] - c.a[1]) / L;
      for (let t = 200, i = 0; t < L - 100; t += 330, i++) {
        const side = i % 2 ? 1 : -1, x = c.a[0] + ux * t - uz * side * (c.hw - 16), z = c.a[1] + uz * t + ux * side * (c.hw - 16);
        if (!isWater(x, z) || nearSite(x, z, 40) || nearCross(x, z, 120)) continue;
        (side < 0 ? buoyR : buoyG).push({ x, y: WY, z }); stats.buoys++;
      }
    }
    const buoyCan = U.concat(THREE, [{ geo: NI(cyl(2.4, 5, 10).translate(0, 1.2, 0)), color: new THREE.Color(0xd8473a) }, { geo: NI(cyl(0.4, 3, 6).translate(0, 5, 0)), color: new THREE.Color(0x3b4752) }, { geo: NI(cyl(1.3, 1.6, 8).translate(0, 7.2, 0)), color: new THREE.Color(0xd8473a) }]);
    const buoyCone = U.concat(THREE, [{ geo: NI(cyl(2.4, 5, 10).translate(0, 1.2, 0)), color: new THREE.Color(0x2f9a5c) }, { geo: NI(cyl(0.4, 3, 6).translate(0, 5, 0)), color: new THREE.Color(0x3b4752) }, { geo: NI(new THREE.ConeGeometry(1.6, 2.4, 8).translate(0, 7.6, 0)), color: new THREE.Color(0x2f9a5c) }]);
    inst(buoyCan, U.vcLambert(THREE), buoyR); inst(buoyCone, U.vcLambert(THREE), buoyG);

    // ── 堤防の道の待避所・斜路・資材の置き場(配置は dikeFeatures。zone の層も同じ配置を避ける) ──
    {
      const lay = [], layEdge = [], layPosts = [], layBoards = [], rampRuns = [], rampKerb = [], rampPosts = [], rampBands = [];
      for (const l of DF.laybys) {
        const pts = [];
        for (let t = -l.len / 2; t <= l.len / 2 + 0.1; t += 4) {
          const u = Math.abs(t) / (l.len / 2), wid = 9 * (1 - smooth(0.62, 1.0, u));
          const P = (d) => { const x = l.c.a[0] + l.ux * (l.t + t) + l.nx * (l.c.hw + d), z = l.c.a[1] + l.uz * (l.t + t) + l.nz * (l.c.hw + d); return [x, landH(x, z) + 0.34, z]; };
          pts.push({ P, wid });
        }
        lay.push(pts.map(({ P, wid }) => [P(50.5 - wid - 0.01), P(50.6)]));
        layEdge.push(pts.filter((q) => q.wid > 2).map(({ P, wid }) => [P(50.5 - wid + 0.4), P(50.5 - wid + 1.0)]).map((r) => r.map(([x, y, z]) => [x, y + 0.12, z])));
        for (const e of [-1, 1]) {   // 待避所の両端の標識(青い板)
          const t = e * (l.len / 2 + 4), x = l.c.a[0] + l.ux * (l.t + t) + l.nx * (l.c.hw + 48.6), z = l.c.a[1] + l.uz * (l.t + t) + l.nz * (l.c.hw + 48.6), y = landH(x, z);
          layPosts.push([cyl(0.3, 7.5), { x, y: y + 3.75, z }]); layBoards.push([box(3, 3, 0.25), { x, y: y + 6.6, z, ry: l.ang }]);
        }
        stats.laybys = (stats.laybys ?? 0) + 1;
      }
      for (const r of DF.ramps) {
        const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1], L = Math.hypot(dx, dz), tx = dx / L, tz = dz / L, nx = -tz, nz = tx, pts = [];
        for (let t = -2; t <= L + 4; t += 3) pts.push([r.a[0] + tx * t, r.a[1] + tz * t]);
        const off = ([x, z], o, lift) => { const px = x + nx * o, pz = z + nz * o; return [px, landH(px, pz) + lift, pz]; };
        rampRuns.push(pts.map((p) => [off(p, -3.6, 0.4), off(p, 3.6, 0.4)]));
        for (const s2 of [-1, 1]) rampKerb.push(pts.slice(2).map((p) => [off(p, s2 * 3.6, 0.85), off(p, s2 * 4.4, 0.85)]));
        for (const s2 of [-1, 1]) { const [x, y, z] = off([r.a[0] + tx * 6, r.a[1] + tz * 6], s2 * 5.5, 0); rampPosts.push([box(0.6, 3, 0.6), { x, y: y + 1.5, z }]); rampBands.push([box(0.66, 0.6, 0.66), { x, y: y + 2.4, z }], [box(0.66, 0.6, 0.66), { x, y: y + 1.2, z }]); }
        stats.ramps = (stats.ramps ?? 0) + 1;
      }
      ribbon(lay, MAT.dike); ribbon(layEdge, MAT.paint); ribbon(rampRuns, MAT.gravel); ribbon(rampKerb, MAT.kerb);
      merged(layPosts, MAT.steel); merged(layBoards, MAT.sign); merged(rampPosts, MAT.paint); merged(rampBands, MAT.red);
      // 資材の置き場: コンクリートの台、3 方の柵、ケーブルのドラム、予備の浮標、蛇籠の箱、発電機、照明の柱、時々コンテナ。車両は置かない
      const pad = [], fenceP = [], fenceR = [], drums = [], gab = [], gen = [], genDark = [], masts = [], lampsS = [], cont = [], standBuoyR = [], standBuoyG = [];
      for (const st of DF.stands) {
        const ux = Math.sin(st.ang), uz = Math.cos(st.ang), P = (u, v) => [st.x + ux * u + st.nx * v, st.z + uz * u + st.nz * v];
        const ys = [[-st.w / 2, -st.d / 2], [st.w / 2, -st.d / 2], [st.w / 2, st.d / 2], [-st.w / 2, st.d / 2], [0, 0]].map(([u, v]) => landH(...P(u, v))), y0 = Math.min(...ys), top = Math.max(...ys) + 0.5;
        pad.push([box(st.w, top - y0 + 0.8, st.d), { x: st.x, y: (top + y0 - 0.8) / 2, z: st.z, ry: st.ang }]);
        const B = (list, u, v, w, h, d, yb, ry = 0, rx = 0) => { const [x, z] = P(u, v); list.push([box(w, h, d), { x, y: yb + h / 2, z, ry: st.ang + ry, rx }]); };
        for (const [u0, v0, u1, v1] of [[-st.w / 2, st.d / 2, st.w / 2, st.d / 2], [-st.w / 2, -st.d / 2 + 3, -st.w / 2, st.d / 2], [st.w / 2, -st.d / 2 + 3, st.w / 2, st.d / 2]]) {
          const l = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(l / 4.6)), ry = u0 === u1 ? 0 : Math.PI / 2;
          for (let i = 0; i <= n; i++) { const t = i / n; B(fenceP, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, 0.35, 3.4, 0.35, top); }
          for (const h of [1.4, 3.0]) { const [x, z] = P((u0 + u1) / 2, (v0 + v1) / 2); fenceR.push([box(0.15, 0.15, l), { x, y: top + h, z, ry: st.ang + ry }]); }
        }
        for (let i = 0; i < 2 + Math.floor(rnd() * 2); i++) { const [x, z] = P(-10 + i * 4.6, -1.5); drums.push([cyl(2.3, 1.8, 14), { x, y: top + 2.3, z, ry: st.ang, rz: Math.PI / 2 }]); }
        for (let i = 0; i < 3; i++) { const [x, z] = P(-1 + i * 3.2, 3.5); standBuoyR.push({ x, y: top + 1.3, z }); }
        { const [x, z] = P(-2, -3.5); standBuoyG.push({ x, y: top + 1.3, z }); }
        for (let tier = 0; tier < 2; tier++) for (let i = 0; i < 3 - tier; i++) B(gab, 6 + i * 3.1 + tier * 1.5, 3.8, 3, 2.4, 2.6, top + tier * 2.4);
        B(gen, 8, -3.8, 6, 3.2, 3, top); B(genDark, 8, -3.8 - 1.55, 4, 1.4, 0.15, top + 1.0);
        { const [x, z] = P(st.w / 2 - 2, st.d / 2 - 2); masts.push([cyl(0.35, 15), { x, y: top + 7.5, z }]); lampsS.push([box(2.4, 0.6, 1.2), { x, y: top + 15.2, z, ry: st.ang }]); }
        if (rnd() < 0.5) B(cont, -6, 5.6, 12.2, 2.6, 2.44, top);
        stats.stands = (stats.stands ?? 0) + 1;
      }
      merged(pad, MAT.concrete); merged(fenceP, MAT.steel); merged(fenceR, MAT.steel); merged(drums, MAT.drum); merged(gab, MAT.gab); merged(gen, MAT.gen); merged(genDark, MAT.dark); merged(masts, MAT.steel); merged(lampsS, MAT.lamp); merged(cont, MAT.cont);
      inst(buoyCan, U.vcLambert(THREE), standBuoyR); inst(buoyCone, U.vcLambert(THREE), standBuoyG);
    }
    // 信号の鉄塔(運河の分岐・湖の出入口の近く)
    for (const [x, z] of [[-150, -1350], [150, -2150], [-150, 950], [560, -1000], [560, 1100], [150, 3150], [-150, -3600]]) {
      if (isWater(x, z) || nearSite(x, z, 20)) continue;
      const y = landH(x, z);
      k.lattice(group, V(x, y, z), 34, 2.4, 1.0, 4, 0.3, MAT.steel);
      merged([[box(5, 0.5, 5), { x, y: y + 34.3, z }], [box(7, 4.5, 0.8), { x, y: y + 30, z: z + 1.6 }]], MAT.dark);
      merged([[box(1.4, 1.4, 1.4), { x: x - 2, y: y + 31, z: z + 2.3 }], [box(1.4, 1.4, 1.4), { x: x + 2, y: y + 31, z: z + 2.3 }]], MAT.lamp);
      stats.masts++;
    }

    // ════ 3. 西の用水路(障壁)と細い用水路: コンクリートの護岸と天端、葦 ════
    const bRuns = [], bCope = [], bJoints = [], reeds = [];
    {
      const pts = sample(barrier.pts, 10);
      for (const side of [-1, 1]) {
        const P = pts.map((p) => ({ x: p.x, z: p.z, nx: -p.tz * side, nz: p.tx * side }));
        const at = (p, d) => [p.x + p.nx * (barrier.hw + d), p.z + p.nz * (barrier.hw + d)];
        const ok = (p) => { const [x, z] = at(p, 0); return !nearSite(x, z, 10) && !nearCross(x, z, 28) && !isWater(...at(p, 7)) && Math.abs(p.z) < 3990; };
        for (const run of runsOf(P, ok)) {
          bRuns.push(run.map((p) => [-9, -3, 3].map((d) => { const [x, z] = at(p, d); return [x, surf(x, z) + 0.35, z]; })));
          bCope.push(run.map((p) => [3, 6.5].map((d) => { const [x, z] = at(p, d); return [x, surf(x, z) + 0.9, z]; })));
          run.forEach((p, i) => { if (i % 2) return; const [x0, z0] = at(p, -8), [x1, z1] = at(p, 3); bJoints.push(x0, surf(x0, z0) + 0.5, z0, x1, surf(x1, z1) + 0.5, z1); });
          for (const p of run) if (rnd() < 0.55) { const d = 9 + rnd() * 9, [x, z] = at(p, d); if (!isWater(x, z) && !ctx.nearLine(x, z, 16)) { reeds.push({ x, y: surf(x, z) - 0.3, z, ry: rnd() * 6, s: 0.8 + rnd() * 0.7 }); } }
        }
      }
    }
    ribbon(bRuns, MAT.concrete); ribbon(bCope, MAT.coping); lineSegs(bJoints, MAT.joint);
    {   // 細い用水路(地図は地面の上に水の帯を描く。両縁にコンクリートの縁石と葦)
      const pts = sample(fresh.pts, 10), fRuns = [];
      for (const side of [-1, 1]) {
        const at = (p, d) => [p.x - p.tz * side * d, p.z + p.tx * side * d];
        for (const run of runsOf(pts, (p) => !isWater(...at(p, 20)) && !nearSite(...at(p, 20), 0))) {
          fRuns.push(run.map((p) => [15.5, 19.5].map((d) => { const [x, z] = at(p, d); return [x, landH(x, z) + 0.55, z]; })));
          for (const p of run) if (rnd() < 0.45) { const [x, z] = at(p, 23 + rnd() * 6); if (!isWater(x, z) && !nearSite(x, z, 0) && !ctx.nearLine(x, z, 12)) reeds.push({ x, y: landH(x, z) - 0.2, z, ry: rnd() * 6, s: 0.6 + rnd() * 0.5 }); }
        }
      }
      ribbon(fRuns, MAT.concrete);
    }
    // 湖の西岸の葦(浅い入り江)
    for (let i = 0; i < 260; i++) {
      const t = Math.PI * (0.62 + rnd() * 0.76), d = 2 + rnd() * 12, x = lake.cx + lake.rx * (1 + d / lake.rz) * Math.cos(t), z = lake.cz + lake.rz * (1 + d / lake.rz) * Math.sin(t);
      if (isWater(x, z) || nearSite(x, z, 0) || ctx.nearLine(x, z, 14)) continue;
      reeds.push({ x, y: surf(x, z) - 0.3, z, ry: rnd() * 6, s: 0.7 + rnd() * 0.6 });
    }
    const reedG = U.concat(THREE, Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2, r = 1.2 + (i % 2) * 0.8; return { geo: NI(new THREE.ConeGeometry(0.45, 5 + (i % 3) * 1.6, 4).translate(Math.cos(a) * r, 2.6 + (i % 3) * 0.8, Math.sin(a) * r)), color: new THREE.Color(i % 2 ? 0xb3bf9e : 0xa7b292) }; }));
    inst(reedG, U.vcLambert(THREE), reeds); stats.reeds = reeds.length;

    // ════ 4. 道路: 破線・外側線、路肩、ガードレール、並木、標識、踏切 ════
    const roadOk = (p) => !isWater(p.x, p.z) && !nearSite(p.x, p.z, 0);
    const dashes = [], edges = [], shoulders = [], guardRails = [], guardPosts = [], trees = [];
    const nearBridgeEnd = (x, z, pad) => autoBridges.some((b) => Math.hypot(x - b.a[0], z - b.a[1]) < pad || Math.hypot(x - b.b[0], z - b.b[1]) < pad);
    for (const pl of roads) {
      const pts = sample(pl, 6);
      for (const run of runsOf(pts, roadOk)) {
        const off = (p, o, lift) => [p.x - p.tz * o, landH(p.x - p.tz * o, p.z + p.tx * o) + lift, p.z + p.tx * o];
        // 中央の破線(8 描いて 10 空ける)と外側線
        let acc = 0, on = [];
        for (let i = 0; i < run.length; i++) {
          acc += 6; const draw = acc % 18 < 9;
          if (draw) on.push(run[i]); else { if (on.length > 1) dashes.push(on.map((p) => [off(p, -0.6, 0.62), off(p, 0.6, 0.62)])); on = []; }
        }
        if (on.length > 1) dashes.push(on.map((p) => [off(p, -0.6, 0.62), off(p, 0.6, 0.62)]));
        stats.dashes += Math.round(run.length / 3);
        for (const s of [-1, 1]) {
          edges.push(run.map((p) => [off(p, s * 9.2, 0.62), off(p, s * 10, 0.62)]));
          shoulders.push(run.map((p) => [off(p, s * 11, 0.45), off(p, s * 14, 0.3)]));
        }
        // ガードレール: 水辺(運河地帯)と橋の取付け
        for (const s of [-1, 1]) {
          const gr = runsOf(run, (p) => { const [x, , z] = off(p, s * 13.5, 0); return (waterSD(x, z) < 70 || nearBridgeEnd(p.x, p.z, 110)) && !isWater(x, z); });
          for (const g of gr) {
            guardRails.push(g.map((p) => [off(p, s * 13.3, 1.7), off(p, s * 13.9, 1.7)]));
            g.forEach((p, i) => { if (i % 1 === 0) { const [x, y, z] = off(p, s * 13.6, 0); guardPosts.push({ x, y, z, ry: Math.atan2(p.tx, p.tz) }); } });
          }
        }
        // 並木(両側、間隔 26 前後。崖・水・拠点・線路・ほかの道路の近くを避ける)
        let nextT = rnd() * 20;
        for (let i = 0; i < run.length; i++) {
          if ((i * 6) < nextT) continue; nextT = i * 6 + 22 + rnd() * 10;
          for (const s of [-1, 1]) {
            if (rnd() < 0.18) continue;
            const o = s * (22 + rnd() * 5), [x, y, z] = off(run[i], o, 0);
            if (isWater(x, z) || waterSD(x, z) < 14 || nearSite(x, z, 12) || y > 26 || lineDist(x, z, rail) < 22 || roads.some((r) => r !== pl && lineDist(x, z, r) < 20) || nearBridgeEnd(x, z, 60)) continue;
            trees.push({ x, y: y - 0.4, z, ry: rnd() * 6, s: 0.85 + rnd() * 0.4, kind: rnd() < 0.55 ? 0 : 1 });
          }
        }
      }
    }
    ribbon(dashes, MAT.paint); ribbon(edges, MAT.paint); ribbon(shoulders, MAT.shoulder); ribbon(guardRails, MAT.steel);
    inst(box(0.5, 2.2, 0.5).translate(0, 1.1, 0), MAT.steel, guardPosts); stats.guardPosts = guardPosts.length;
    // 並木の木: 2 種(細長いモクマオウと丸いユーカリ)。高さは実寸 15 m 前後を 2 倍
    const treeA = U.concat(THREE, [{ geo: NI(cyl(0.6, 8, 5).translate(0, 4, 0)), color: new THREE.Color(0x8d8373) }, { geo: NI(new THREE.ConeGeometry(3.6, 9, 7).translate(0, 10.5, 0)), color: new THREE.Color(0x9fae92) }, { geo: NI(new THREE.ConeGeometry(2.6, 7, 7).translate(0, 15.5, 0)), color: new THREE.Color(0xa7b59a) }]);
    const treeB = U.concat(THREE, [{ geo: NI(cyl(0.75, 8, 5).translate(0, 4, 0)), color: new THREE.Color(0x968b7b) }, { geo: NI(new THREE.IcosahedronGeometry(5.2, 0).scale(1, 0.85, 1).translate(0, 11.5, 0)), color: new THREE.Color(0xa6b398) }, { geo: NI(new THREE.IcosahedronGeometry(3.6, 0).translate(2.4, 14.5, 1.2)), color: new THREE.Color(0xb0bca3) }]);
    inst(treeA, U.vcLambert(THREE), trees.filter((t) => t.kind === 0)); inst(treeB, U.vcLambert(THREE), trees.filter((t) => t.kind === 1)); stats.trees = trees.length;
    // 交差点: 道路の端が別の道路に接する所に標識の柱(青い板)
    const signParts = [], signBoards = [];
    for (const pl of roads) for (const end of [pl[0], pl[pl.length - 1]]) {
      if (!roads.some((r) => r !== pl && lineDist(end[0], end[1], r) < 14)) continue;
      const nb = end === pl[0] ? pl[1] : pl[pl.length - 2], L = Math.hypot(nb[0] - end[0], nb[1] - end[1]), ux = (nb[0] - end[0]) / L, uz = (nb[1] - end[1]) / L;
      const x = end[0] + ux * 34 + uz * 15, z = end[1] + uz * 34 - ux * 15;
      if (isWater(x, z) || nearSite(x, z, 0)) continue;
      const y = landH(x, z), ry = Math.atan2(ux, uz);
      signParts.push([cyl(0.35, 9), { x, y: y + 4.5, z }]); signBoards.push([box(6, 3.2, 0.3), { x, y: y + 8.4, z, ry }]); stats.signs++;
    }
    // 門型の標識(橋の取付けの手前、道路橋だけ)
    for (const b of autoBridges) {
      if (b.rail) continue;
      for (const [e, o] of [[b.a, b.b], [b.b, b.a]]) {
        const L = Math.hypot(o[0] - e[0], o[1] - e[1]), ux = (e[0] - o[0]) / L, uz = (e[1] - o[1]) / L, cx = e[0] + ux * 70, cz = e[1] + uz * 70;
        if (isWater(cx, cz) || nearSite(cx, cz, 0)) continue;
        const ry = Math.atan2(ux, uz), y = landH(cx, cz);
        for (const s of [-1, 1]) signParts.push([box(1.2, 16, 1.2), { x: cx + s * 16 * uz, y: y + 8, z: cz - s * 16 * ux, ry }]);
        signParts.push([box(34, 1.6, 1.6), { x: cx, y: y + 15.5, z: cz, ry: ry + Math.PI / 2 }]);
        for (const s of [-1, 1]) signBoards.push([box(12, 5, 0.4), { x: cx + s * 7 * uz, y: y + 12.4, z: cz - s * 7 * ux, ry: ry + Math.PI / 2 }]);
        stats.gantries++;
      }
    }
    merged(signParts, MAT.steel); merged(signBoards, MAT.sign);
    // 踏切: 道路と線路の線分の交点
    const lxParts = [], lxArms = [], lxPlank = [];
    const isect = (a, b, c, d) => { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t, r, s] : null; };
    for (const pl of roads) for (let i = 1; i < pl.length; i++) for (let j = 1; j < rail.length; j++) {
      const hit = isect(pl[i - 1], pl[i], rail[j - 1], rail[j]); if (!hit) continue;
      const [x, z, r, s] = hit; if (isWater(x, z) || nearSite(x, z, 0)) continue;
      const rl = Math.hypot(...r), sl = Math.hypot(...s), ru = [r[0] / rl, r[1] / rl], su = [s[0] / sl, s[1] / sl], y = landH(x, z);
      lxPlank.push([box(24, 0.6, 16), { x, y: y + 1.4, z, ry: Math.atan2(su[0], su[1]) }]);
      for (const a of [-1, 1]) for (const b2 of [-1, 1]) {   // 線路の両側、道路の両端に遮断機の柱と上げた腕
        const px = x + ru[0] * a * 16 + -ru[1] * b2 * 12.5, pz = z + ru[1] * a * 16 + ru[0] * b2 * 12.5, py = landH(px, pz);
        lxParts.push([box(1.2, 5, 1.2), { x: px, y: py + 2.5, z: pz }], [box(3, 0.4, 0.4), { x: px, y: py + 4.5, z: pz, ry: Math.atan2(su[0], su[1]) }]);
        lxArms.push([box(0.6, 12, 0.6), { x: px, y: py + 10.5, z: pz }]);
        lxParts.push([box(0.4, 7, 0.4), { x: px + ru[0] * a * 3, y: py + 3.5, z: pz + ru[1] * a * 3 }], [box(4.5, 0.6, 0.2), { x: px + ru[0] * a * 3, y: py + 7, z: pz + ru[1] * a * 3, ry: 0.78 }], [box(4.5, 0.6, 0.2), { x: px + ru[0] * a * 3, y: py + 7, z: pz + ru[1] * a * 3, ry: -0.78 }]);
      }
      stats.levelX++;
    }
    merged(lxParts, MAT.paint); merged(lxArms, MAT.red); merged(lxPlank, MAT.sleeper);

    // ════ 5. 鉄道: 道床、枕木、レール、信号機 ════
    {
      const pts = sample(rail, 4), sleepers = [], railRuns = [], ballast = [], sigParts = [], sigLamps = [];
      for (const run of runsOf(pts, roadOk)) {
        const off = (p, o, lift) => [p.x - p.tz * o, landH(p.x - p.tz * o, p.z + p.tx * o) + lift, p.z + p.tx * o];
        ballast.push(run.map((p) => [off(p, -10, 0.55), off(p, -6.5, 1.3), off(p, 6.5, 1.3), off(p, 10, 0.55)]));
        for (const s of [-1, 1]) railRuns.push(run.map((p) => [off(p, s * 3.6 - 0.4, 2.05), off(p, s * 3.6 + 0.4, 2.05)]));
        run.forEach((p, i) => { if (i % 1 === 0) sleepers.push({ x: p.x, y: landH(p.x, p.z) + 1.55, z: p.z, ry: Math.atan2(p.tx, p.tz) }); });
      }
      // 鉄道橋の上も枕木とレール
      for (const b of autoBridges) {
        if (!b.rail) continue;
        const bp = sample([b.a, b.b], 4);
        for (const s of [-1, 1]) railRuns.push([bp.map((p) => [[p.x - p.tz * (s * 3.6 - 0.4), b.y + 2.0, p.z + p.tx * (s * 3.6 - 0.4)], [p.x - p.tz * (s * 3.6 + 0.4), b.y + 2.0, p.z + p.tx * (s * 3.6 + 0.4)]])][0]);
        for (const p of bp) sleepers.push({ x: p.x, y: b.y + 1.4, z: p.z, ry: Math.atan2(p.tx, p.tz) });
      }
      ribbon(ballast, MAT.ballast); ribbon(railRuns.map((r) => r), MAT.rail);
      inst(box(13, 0.6, 1.8), MAT.sleeper, sleepers); stats.sleepers = sleepers.length;
      // 信号機: 線路沿い 800 ごとと、橋・踏切の手前
      let acc = 0;
      for (const p of pts) {
        acc += 4;
        const near = autoBridges.some((b) => b.rail && (Math.abs(Math.hypot(p.x - b.a[0], p.z - b.a[1]) - 70) < 2 || Math.abs(Math.hypot(p.x - b.b[0], p.z - b.b[1]) - 70) < 2));
        if (!(acc % 800 < 4 || near) || !roadOk(p)) continue;
        const x = p.x - p.tz * 12, z = p.z + p.tx * 12; if (isWater(x, z) || nearSite(x, z, 0)) continue;
        const y = landH(x, z), ry = Math.atan2(p.tx, p.tz);
        sigParts.push([cyl(0.45, 12), { x, y: y + 6, z }], [box(2.4, 5, 1.6), { x, y: y + 12.5, z, ry }], [box(4, 0.4, 0.4), { x, y: y + 9.5, z, ry: ry + Math.PI / 2 }]);
        sigLamps.push([new THREE.SphereGeometry(0.7, 8, 6), { x: x + Math.sin(ry) * 0.9, y: y + 13.6, z: z + Math.cos(ry) * 0.9 }]);
        stats.signals++;
      }
      merged(sigParts, MAT.dark); merged(sigLamps, MAT.sigG);
    }

    // ════ 6. 自動の橋の細部: 道路橋は側桁・照明柱、鉄道橋は上路の鈑桁と補剛材 ════
    {
      const parts = [], lamps = [], gird = [];
      for (const b of autoBridges) {
        const L = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1]), ux = (b.b[0] - b.a[0]) / L, uz = (b.b[1] - b.a[1]) / L, ang = Math.atan2(ux, uz), c = [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2];
        const w = b.rail ? 14 : 22, half = w / 2 + 3.4;
        for (const s of [-1, 1]) {
          const sx = s * uz, sz = -s * ux;
          parts.push([box(1.6, 5, L - 6), { x: c[0] + sx * (half - 1.5), y: b.y - 5, z: c[1] + sz * (half - 1.5), ry: ang }]);   // 側桁(床版の下)
          if (b.rail) {
            gird.push([box(1.0, 5.5, L - 10), { x: c[0] + sx * (w / 2 + 1.4), y: b.y + 3.2, z: c[1] + sz * (w / 2 + 1.4), ry: ang }]);
            for (let t = 8; t < L - 8; t += 7) gird.push([box(1.6, 5.5, 0.5), { x: b.a[0] + ux * t + sx * (w / 2 + 1.9), y: b.y + 3.2, z: b.a[1] + uz * t + sz * (w / 2 + 1.9), ry: ang }]);
          } else {
            for (let t = 15; t < L - 10; t += 32) {
              const x = b.a[0] + ux * t + sx * (half + 0.4), z = b.a[1] + uz * t + sz * (half + 0.4);
              parts.push([cyl(0.35, 11), { x, y: b.y + 6.5, z }], [box(0.4, 0.4, 3.6), { x: x - sx * 1.6, y: b.y + 12, z: z - sz * 1.6, ry: ang + Math.PI / 2 }]);
              lamps.push([box(1.6, 0.5, 1.0), { x: x - sx * 3.2, y: b.y + 11.7, z: z - sz * 3.2, ry: ang }]); stats.bridgeLamps++;
            }
          }
        }
      }
      merged(parts, MAT.steel); merged(gird, MAT.steel); merged(lamps, MAT.lamp);
    }

    // ════ 7. 送電線: 運河地帯を東西に渡る 2 系統 ════
    const wires = [];
    const LINES = [
      [[-1500, -1200], [-1150, -1200], [-560, -1200], [-200, -1200], [200, -1200], [650, -1200], [1100, -1250], [1550, -1300]],
      [[-1600, 1060], [-1150, 1040], [-640, 1010], [-260, 1000], [200, 1000], [700, 1060], [1250, 1160], [1700, 1220]],
    ];
    for (const L of LINES) {
      const towers = [];
      for (let i = 0; i < L.length; i++) {
        let [x, z] = L[i];
        if (isWater(x, z) || nearSite(x, z, 20) || ctx.nearLine(x, z, 24)) { // 少しずらして置ける所を探す
          const alt = [[0, 40], [0, -40], [40, 0], [-40, 0], [0, 80], [0, -80]].map(([dx, dz]) => [x + dx, z + dz]).find(([a, b]) => !isWater(a, b) && !nearSite(a, b, 20) && !ctx.nearLine(a, b, 24));
          if (!alt) continue; [x, z] = alt;
        }
        towers.push([x, z, landH(x, z)]);
      }
      const arms = [[-14, 50], [14, 50], [-11, 60], [11, 60], [0, 72]];   // 腕金の先とてっぺん(x 方向のずれ, 高さ)
      towers.forEach(([x, z, y], i) => {
        const nx = towers[Math.min(i + 1, towers.length - 1)], pv = towers[Math.max(i - 1, 0)], dx = nx[0] - pv[0], dz = nx[1] - pv[1], dl = Math.hypot(dx, dz) || 1, ry = Math.atan2(dx, dz);
        k.lattice(group, V(x, y, z), 66, 6, 1.6, 6, 0.45, MAT.steel);
        const across = [dz / dl, -dx / dl];   // 電線に直交する向き
        merged([[box(32, 1.4, 1.4), { x, y: y + 50, z, ry }], [box(25, 1.4, 1.4), { x, y: y + 60, z, ry }], [box(1.2, 6, 1.2), { x, y: y + 69, z }]], MAT.steel);   // 腕金(電線に直交)と頂部
        stats.pylons++;
        towers[i].pts = arms.map(([o, h]) => [x + across[0] * o, y + h - (h < 70 ? 4 : 0), z + across[1] * o]);   // がいしの下端
        merged(arms.slice(0, 4).map(([o, h]) => [cyl(0.6, 4, 6), { x: x + across[0] * o, y: y + h - 2, z: z + across[1] * o }]), MAT.dark);
      });
      for (let i = 0; i < towers.length - 1; i++) {
        const A = towers[i].pts, B = towers[i + 1].pts;
        for (let w = 0; w < A.length; w++) {
          const span = Math.hypot(B[w][0] - A[w][0], B[w][2] - A[w][2]), sag = span * 0.035;
          for (let s = 0; s < 16; s++) {
            const t0 = s / 16, t1 = (s + 1) / 16, P = (t) => [A[w][0] + (B[w][0] - A[w][0]) * t, A[w][1] + (B[w][1] - A[w][1]) * t - 4 * sag * t * (1 - t), A[w][2] + (B[w][2] - A[w][2]) * t];
            wires.push(...P(t0), ...P(t1));
          }
        }
      }
    }
    lineSegs(wires, MAT.wire);

    U.bake(THREE, group, { also: [MAT.lamp, MAT.sigG] });
    const check = () => {
      // 水の中に置いた陸の物が無いか(浮標と護岸を除く代表点)
      const land = [...trees, ...guardPosts, ...reeds.slice(0, 400)].filter((o) => isWater(o.x, o.z)).length;
      const onRoad = trees.filter((t) => ctx.nearLine(t.x, t.z, 12)).length;
      return { ...stats, landItemsInWater: land, treesOnRoad: onRoad };
    };
    return { group, check, stats, features: { laybys: DF.laybys.map((l) => [Math.round(l.c.a[0] + l.ux * l.t + l.nx * (l.c.hw + 46)), Math.round(l.c.a[1] + l.uz * l.t + l.nz * (l.c.hw + 46))]), ramps: DF.ramps.map((r) => r.a.map(Math.round)), stands: DF.stands.map((st) => [Math.round(st.x), Math.round(st.z)]) } };   // 撮影・確認用の位置
  });
})();
