// スエズ運河マップの拠点 9「アブ・スウェイル空軍基地」(西岸)。象徴はアーチ形の掩体(コンクリートの機体格納シェルター)の列。
// 敷地は土塁の輪(半径 約 400)で囲み、イスマイリア運河(淡水、細い溝)が敷地の中を東西に横切る。北に滑走路と誘導路、運河の北にドローン格納庫の列
// (近未来化)、運河を暗渠の誘導路 2 本で渡って南に掩体 6 基・整備格納庫 2 棟・管制塔・管理棟・土塁で囲った燃料タンク。
// 縮尺: 配置は 約 0.33 単位/m(滑走路 640 = 約 1.9 km の切り取り)、建造物は 0.6 単位/m。誇張: 掩体 1.8 倍、管制塔の高さ 約 2.9 倍、滑走路の幅 1.5 倍。
// 航空機は小さすぎるので置かない。状態: 平常(扉が閉)/ 警戒(掩体の引き戸が両側へ開き、ドローン格納庫の巻き上げ扉が上がる。4 秒)
// 敷地の中(2026-10-19 の改善): 用水路の護岸と水面、誘導路の黄の標示と停止線、土の囲いの分散駐機場 3、土をかぶせた弾薬庫 3(柵・土の壁)、
//   爆風よけの T 形の壁、整備の駐機場(係留の金具・地上機材の小屋・洗機場・コンパスの台)、外周の砂利道と柵、芝の板と草の株・低木。
//   掩体の細部: 扉の補剛材と台車、案内のレール、前面の壁の笠木と柱形、前へ開く翼壁、屋根の換気口、後ろの排気の偏向壁
//
//   ctx は suez.js が渡す(座標は拠点の中心が原点、y = 0 が陸の上面)。site.setState("normal" | "alert")
(function () {
  DreamAssets.maps.site("airbase", (THREE, ctx) => {
    const { U, F, M, k } = ctx;
    const { add, box, cyl, V, closedLoft, prism, arcLoft } = k;
    const accent = M.lambert(F.P.neutral);
    const conc = M.lambert(0xdfe2e4), pave = M.lambert(0xb4bcc3), ground = M.lambert(0xe2e5e1), earth = M.lambert(0xcfc8b8);
    const group = new THREE.Group(); group.name = "site-airbase";
    const SLAB = 0.55, PV = SLAB + 0.2;   // 敷地の地面の上面、舗装の上面

    // イスマイリア運河(地図の装飾の溝)の位置: z = zf(x)。敷地の地面はこの帯を空けて南北 2 枚に分ける
    const zf = (x) => -50 - (40 * (x + 1350)) / 2300;
    const CANAL_KEEP = 26;
    const R_IN = 394, R_OUT = 410;   // 地図の街区(拠点の半径 + 10 の外)に掛からない大きさ
    // 円を半平面で切る(Sutherland–Hodgman、1 本の直線)
    const clip = (poly, f) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(...a), fb = f(...b);
        if (fa >= 0) out.push(a);
        if (fa >= 0 !== fb >= 0) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      return out;
    };
    const circle = Array.from({ length: 96 }, (_, i) => { const b = (i / 96) * Math.PI * 2; return [R_OUT * Math.sin(b), R_OUT * Math.cos(b)]; });
    add(prism(clip(circle, (x, z) => zf(x) - CANAL_KEEP - z), 0, SLAB), ground, group);   // 北
    add(prism(clip(circle, (x, z) => z - zf(x) - CANAL_KEEP), 0, SLAB), ground, group);   // 南

    // ── 土塁の輪(運河と道路の所は切る) ──
    const angleOnCircle = (side) => {   // r = 471 の円と運河の線の交点の角度(polar: 0 = +z、+x 側が正)
      let lo = side > 0 ? 0 : -Math.PI, hi = side > 0 ? Math.PI : 0;
      const RM = (R_IN + R_OUT) / 2, g = (b) => RM * Math.cos(b) - zf(RM * Math.sin(b));
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if ((g(lo) > 0) === (g(m) > 0)) lo = m; else hi = m; }
      return (lo + hi) / 2;
    };
    const ROAD_END = [650, -200];   // 地図の道路(拠点の中心 → 東)
    const bRoad = Math.atan2(ROAD_END[0], ROAD_END[1]);
    const gaps = [[angleOnCircle(1), 0.08], [angleOnCircle(-1) + Math.PI * 2, 0.08], [bRoad, 0.07]].map(([b, w]) => [((b % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), w]).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < gaps.length; i++) {
      const b0 = gaps[i][0] + gaps[i][1], b1 = (i + 1 < gaps.length ? gaps[i + 1][0] : gaps[0][0] + Math.PI * 2) - (i + 1 < gaps.length ? gaps[i + 1][1] : gaps[0][1]);
      if (b1 - b0 > 0.02) add(arcLoft([[R_IN, 0.3], [R_OUT, 0.3], [R_OUT - 6, 7], [R_IN + 6, 7]], b0, b1, Math.max(4, Math.round((b1 - b0) * 30))), earth, group);
    }

    // ── 舗装の帯(x0..x1, z0..z1 の長方形) ──
    const pad = (x0, x1, z0, z1, mat = pave) => add(box(x1 - x0, PV - SLAB, z1 - z0), mat, group, { x: (x0 + x1) / 2, y: (SLAB + PV) / 2, z: (z0 + z1) / 2, edges: false });
    const mark = (x, z, w, d) => add(box(w, 0.06, d), M.body, group, { x, y: PV + 0.03, z, edges: false });
    // 滑走路(東西)と標示
    const RW = { x: 320, z0: -220, z1: -180 };
    pad(-RW.x, RW.x, RW.z0, RW.z1);
    const rzc = (RW.z0 + RW.z1) / 2;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 8; i++) mark(s * (RW.x - 18), RW.z0 + 4 + i * 4.6, 24, 2.4);                   // 末端の縞
      mark(s * (RW.x - 70), rzc - 8, 30, 4); mark(s * (RW.x - 70), rzc + 8, 30, 4);                   // 接地点の標示
    }
    for (let x = -RW.x + 50; x <= RW.x - 50; x += 36) mark(x, rzc, 16, 1.2);                           // 中心線
    for (const z of [RW.z0 + 1, RW.z1 - 1]) mark(0, z, RW.x * 2 - 6, 0.8);                              // 縁の線
    // 誘導路と取付け、運河を渡る誘導路(暗渠)
    pad(-330, 330, -146, -124);
    for (const x of [-300, -100, 100, 300]) pad(x - 11, x + 11, -180, -146);
    const CUL = [{ x0: -241, x1: -219 }, { x0: 214, x1: 272 }];   // 東は道路の渡りと一緒
    for (const c of CUL) {
      pad(c.x0, c.x1, -124, -10);
      for (const [x, s] of [[c.x0, -1], [c.x1, 1]]) {   // 暗渠の頭壁(誘導路の両脇の欄干)と、溝の口
        const zc = zf(x);
        add(box(1.6, 1.2 + PV, 50), conc, group, { x: x + s * 0.8, y: (1.2 + PV) / 2, z: zc });
        add(box(0.4, 1.2, 30), M.dark, group, { x: x + s * 1.8, y: 0.6, z: zc, edges: false });
      }
    }
    pad(-241, 241, 239, 261);                                                                           // 南の誘導路
    for (const x of [-230, 230]) pad(x - 11, x + 11, -10, 239);
    // 道路(門から中心へ)
    const rl = Math.hypot(...ROAD_END), rux = ROAD_END[0] / rl, ruz = ROAD_END[1] / rl, rLen = R_OUT - 2;
    add(box(22, 0.16, rLen), M.road ?? pave, group, { x: (rux * rLen) / 2, y: SLAB + 0.08, z: (ruz * rLen) / 2, ry: Math.atan2(rux, ruz), edges: false });
    add(box(10, 5, 8), M.body, group, { x: rux * (R_IN - 30) + 18, y: 2.5 + SLAB, z: ruz * (R_IN - 30) + 14 });         // 門衛所
    add(box(14, 0.6, 0.6), M.dark, group, { x: rux * (R_IN - 14), y: 3 + SLAB, z: ruz * (R_IN - 14), ry: Math.atan2(rux, ruz) + Math.PI / 2, edges: false });   // 遮断機

    // ── 掩体(アーチ形のコンクリートのシェルター)6 基。扉は北(誘導路)向きの 2 枚の引き戸 ──
    const HAS = { w: 16, h: 13, len: 43, z: 300 };
    const hasL = new THREE.Group(), hasR = new THREE.Group(); group.add(hasL, hasR);
    const arch = (r, h, z0, z1) => closedLoft([z0, z1].map((z) => Array.from({ length: 11 }, (_, i) => { const t = (i / 10) * Math.PI; return V(r * Math.cos(t), SLAB + h * Math.sin(t), z); })));
    const HAS_X = [-200, -120, -40, 40, 120, 200];
    for (const x of HAS_X) {
      const g = new THREE.Group(); g.position.x = x; group.add(g);
      const zf0 = HAS.z - HAS.len / 2;   // 扉側の端
      add(arch(HAS.w, HAS.h, zf0, zf0 + HAS.len), conc, g);
      for (const dz of [10, 21.5, 33]) add(arch(HAS.w + 0.5, HAS.h + 0.4, zf0 + dz - 0.6, zf0 + dz + 0.6), M.light, g);   // 継ぎ目の帯
      add(box(52, 15, 3), conc, g, { y: SLAB + 7.5, z: zf0 - 1.5 });                                                     // 扉の枠(前面の壁)
      add(box(24, 9.5, 0.4), M.dark, g, { y: SLAB + 4.75, z: zf0 - 3.2, edges: false });                                // 開口
      add(box(52, 0.4, 1.2), M.dark, g, { y: SLAB + 0.2, z: zf0 - 3.8, edges: false });                                 // 扉のレール
      add(box(10, 5, 3), M.mid, g, { y: SLAB + 6, z: zf0 + HAS.len + 1.5 });                                             // 後ろの排気口
      add(box(26, PV - SLAB, zf0 - 3 - 261), pave, group, { x, y: (SLAB + PV) / 2, z: (261 + zf0 - 3) / 2, edges: false });     // 扉前の舗装(誘導路まで)
      for (const [grp, s] of [[hasL, -1], [hasR, 1]]) {
        add(box(12.6, 10, 1), M.steel, grp, { x: x + s * 6.3, y: SLAB + 5.2, z: zf0 - 3.6 - 0.5 });
        add(box(0.4, 9, 1.2), M.dark, grp, { x: x + s * 0.6, y: SLAB + 5.2, z: zf0 - 4.15, edges: false });
        for (const dx of [2.4, 6.3, 10.2]) add(box(0.5, 9.4, 0.5), M.mid, grp, { x: x + s * dx, y: SLAB + 5.2, z: zf0 - 4.85, edges: false });   // 扉の縦の補剛材
        add(box(12.6, 0.6, 0.6), M.mid, grp, { x: x + s * 6.3, y: SLAB + 7.4, z: zf0 - 4.85, edges: false });                                       // 横の補剛材
        for (const dx of [3, 9.6]) add(box(2, 1, 1.8), M.dark, grp, { x: x + s * dx, y: SLAB + 0.5, z: zf0 - 4.1, edges: false });                // 扉の台車
      }
      // 扉の上の案内のレール、前面の壁の笠木と柱形、両袖の斜めの翼壁、番号の板(文字なし)、屋根の換気口、後ろの排気の偏向壁
      add(box(52, 0.8, 1.4), M.dark, g, { y: SLAB + 10.6, z: zf0 - 3.7, edges: false });
      add(box(53, 1, 3.8), M.light, g, { y: SLAB + 15.4, z: zf0 - 1.5 });
      for (const sx of [-1, 1]) {
        add(box(3, 15, 1), M.light, g, { x: sx * 13.5, y: SLAB + 7.5, z: zf0 - 3.4, edges: false });
        add(box(2, 11, 14), conc, g, { x: sx * 30.5, y: SLAB + 5.5, z: zf0 - 7, ry: -sx * 0.45 });   // 前へ開く
      }
      add(box(4, 2.6, 0.3), M.dark, g, { x: -19, y: SLAB + 12.2, z: zf0 - 3.2, edges: false });
      for (const dz of [16, 28]) add(box(3, 1.4, 3), M.mid, g, { y: SLAB + HAS.h + 0.4, z: zf0 + dz, edges: false });
      add(box(18, 7, 1.2), conc, g, { y: SLAB + 3.2, z: zf0 + HAS.len + 8, rx: -0.55 });
      add(box(18, 1, 4), conc, g, { y: SLAB + 0.5, z: zf0 + HAS.len + 9.6, edges: false });
    }

    // ── 近未来化: ドローン格納庫の列(滑走路の北、巻き上げ扉は南向き)──
    const droneDoors = new THREE.Group(); droneDoors.position.y = SLAB + 8; group.add(droneDoors);
    const DR_X = [-240, -160, -80, 0, 80, 160, 240], DR_Z = -270;
    for (const x of DR_X) {
      add(box(30, 10, 22), M.body, group, { x, y: SLAB + 5, z: DR_Z });
      add(box(30.4, 1.2, 22.4), accent, group, { x, y: SLAB + 9, z: DR_Z, edges: false });
      add(box(22, 1.6, 2), M.mid, group, { x, y: SLAB + 8.8, z: DR_Z + 12 });                                            // 扉の巻き上げの箱
      add(box(20, 8, 0.6), M.dark, group, { x, y: SLAB + 4, z: DR_Z + 11.2, edges: false });                            // 開口
      add(box(20, 8, 0.4), M.light, droneDoors, { x, y: -4, z: DR_Z + 11.7 });                               // 巻き上げ扉(上端を軸に縮む)
      pad(x - 10, x + 10, DR_Z + 11, RW.z0);
      add(box(18, 0.4, 10), M.dark, group, { x, y: SLAB + 10.2, z: DR_Z - 2, edges: false });                          // 屋根の太陽電池
    }

    // ── 運河の南: 駐機場、整備格納庫 2 棟、管制塔、管理棟、燃料タンク ──
    pad(-200, 40, 0, 40);
    for (const hx of [-150, -60]) {
      const prof = [[-35, 0], [35, 0], [35, 10], [30, 16], [18, 20.5], [0, 22], [-18, 20.5], [-30, 16], [-35, 10]];
      add(closedLoft([50, 110].map((z) => prof.map(([x, y]) => V(hx + x, SLAB + y, z)))), M.body, group);
      add(box(56, 14, 0.6), M.dark, group, { x: hx, y: SLAB + 7, z: 49.6, edges: false });
      add(box(70.4, 1.4, 60.4), accent, group, { x: hx, y: SLAB + 9.2, z: 80, edges: false });
    }
    // 管制塔(誇張: 高さ 約 2.9 倍)
    const TW = { x: 95, z: 62 };
    add(box(40, 10, 24), M.body, group, { x: TW.x, y: SLAB + 5, z: TW.z });
    add(box(8, 40, 8), M.light, group, { x: TW.x + 8, y: SLAB + 30, z: TW.z });
    add(new THREE.CylinderGeometry(10, 8, 7, 8), M.glass, group, { x: TW.x + 8, y: SLAB + 53.5, z: TW.z, edges: false });
    add(new THREE.CylinderGeometry(11, 11, 1.4, 8), M.light, group, { x: TW.x + 8, y: SLAB + 57.7, z: TW.z });
    add(new THREE.CylinderGeometry(10.4, 10.4, 1, 8), accent, group, { x: TW.x + 8, y: SLAB + 49.5, z: TW.z, edges: false });
    add(cyl(0.4, 10, 6), M.dark, group, { x: TW.x + 8, y: SLAB + 63.4, z: TW.z });
    // 管理棟
    add(box(60, 10, 24), M.body, group, { x: 165, y: SLAB + 5, z: 125 });
    add(box(60.4, 2, 24.4), M.glass, group, { x: 165, y: SLAB + 6, z: 125, edges: false });
    add(box(40, 8, 20), M.body, group, { x: 160, y: SLAB + 4, z: 175 });
    // 燃料タンク 4 基(それぞれ土塁で囲う)と配管
    for (const [x, z] of [[-295, 145], [-260, 145], [-295, 185], [-260, 185]]) {
      add(cyl(9, 10, 16), M.light, group, { x, y: SLAB + 5, z });
      for (const [dx, dz, w, d] of [[0, -14, 30, 3], [0, 14, 30, 3], [-14, 0, 3, 30], [14, 0, 3, 30]]) add(box(w, 4, d), earth, group, { x: x + dx, y: SLAB + 2, z: z + dz });
    }

    // ── 敷地の中の作り込み(2026-10-19 の改善): 用水路の護岸と水面、誘導路の標示、土の囲いの分散駐機場、土をかぶせた弾薬庫、爆風よけの T 形の壁、
    //    整備の駐機場の標示・地上機材の小屋・洗機場・コンパスの台、外周の道路と柵、舗装の間の草、土塁の外の地面の小物。燃料の給油車などは小さすぎるので置かない ──
    const GY = 0.5;   // 土塁の外と用水路の帯の地面の実際の高さ(suez.js の地形は陸を 0.5 以上にする)
    const rnd = U.rng(9090);
    const occ = [];
    const occupy = (x, z, hx, hz, a = 0) => occ.push({ x, z, hx, hz, c: Math.cos(a), s: Math.sin(a) });
    const occupySeg = ([ax, az], [bx, bz], hw) => { const l = Math.hypot(bx - ax, bz - az), ex = (bx - ax) / l, ez = (bz - az) / l; occupy((ax + bx) / 2, (az + bz) / 2, l / 2, hw, Math.atan2(-ez, ex)); };
    const isFree = (x, z, pad = 0) => !occ.some((o) => { const dx = x - o.x, dz = z - o.z; return Math.abs(dx * o.c - dz * o.s) < o.hx + pad && Math.abs(dx * o.s + dz * o.c) < o.hz + pad; });
    // 既存の舗装と建物
    occupy(0, -200, 322, 22); occupy(0, -135, 332, 13);
    for (const x of [-300, -100, 100, 300]) occupy(x, -163, 13, 19);
    occupy(-230, -67, 13, 59); occupy(243, -67, 31, 59); occupy(0, 250, 243, 13);
    for (const x of [-230, 230]) occupy(x, 114.5, 13, 126.5);
    for (const x of HAS_X) { occupy(x, 300, 18, 24); occupy(x, 270, 35, 9); occupy(x, 330, 11, 5); occupy(x, 268, 13, 9); }   // 掩体・前の翼壁・後ろの偏向壁・前の舗装
    for (const x of DR_X) { occupy(x, -270, 16, 12); occupy(x, -240, 11, 20); }
    occupy(-80, 20, 121, 21); for (const hx of [-150, -60]) occupy(hx, 80, 36, 31);
    occupy(95, 62, 21, 13); occupy(165, 125, 31, 13); occupy(160, 175, 21, 11); occupy(-277.5, 165, 34, 34);
    occupySeg([0, 0], [rux * rLen, ruz * rLen], 13); occupy(rux * (R_IN - 30) + 18, ruz * (R_IN - 30) + 14, 7, 6);
    const flagAt = (() => { const r = ctx.point.r; for (let a = 0.62; a < 0.62 + Math.PI * 2; a += 0.15) { const x = Math.cos(a) * r * 0.85, z = Math.sin(a) * r * 0.85; if (![0, 25, -25].some((d) => ctx.isWater(x + d, z) || ctx.isWater(x, z + d))) return [x, z]; } return [r * 0.72, r * 0.52]; })();
    occupy(flagAt[0] + 12, flagAt[1], 28, 12);
    const yellow = M.lambert(0xe2c66a), grassM = M.lambert(0xd2dacb), twM = M.lambert(0xd6d9dc), gravel = M.lambert(0xd0d3cf), bedM = M.lambert(0x93b4c3);
    const ymark = (x, z, w, d, ry = 0) => add(box(w, 0.06, d), yellow, group, { x, y: PV + 0.03, z, ry, edges: false });

    // 用水路: 両岸のコンクリートの護岸、底(水の色)、水面。暗渠の誘導路の下は護岸を切る(水面は舗装の下に隠れる)
    const CH_HW = 16, slope = -40 / 2300, chRy = Math.atan2(1, slope), cosS = 1 / Math.hypot(1, slope);
    const xEnd = 446;   // 平らな台の中(半径 455)まで
    let runs = [[-xEnd, xEnd]];
    for (const c of CUL) runs = runs.flatMap(([s, e]) => (c.x1 + 3 <= s || c.x0 - 3 >= e ? [[s, e]] : [[s, c.x0 - 3], [c.x1 + 3, e]].filter(([u, v]) => v - u > 2)));
    const lining = [];
    for (const [s, e] of runs) for (const side of [-1, 1]) {
      const xm = (s + e) / 2, zm = zf(xm) + side * (CH_HW + 0.6) / cosS;
      lining.push([box(1.2, 1.5, (e - s) / cosS), { x: xm, y: GY + 0.45, z: zm, ry: chRy }]);
      lining.push([box(2.2, 0.3, (e - s) / cosS), { x: xm, y: GY + 1.25, z: zm + side * 0.4, ry: chRy }]);
    }
    add(U.merge(THREE, lining), conc, group, { edges: false });
    add(box(2 * CH_HW, 0.06, (2 * xEnd) / cosS), bedM, group, { y: GY + 0.03, z: zf(0), ry: chRy, edges: false });
    const chWater = U.waterMaterial(THREE, { opacity: 0.5, repeat: [(2 * CH_HW) / U.WATER_TILE[0], (2 * xEnd) / U.WATER_TILE[1]] });
    const chG = new THREE.PlaneGeometry(2 * CH_HW, (2 * xEnd) / cosS); chG.rotateX(-Math.PI / 2);
    const chMesh = new THREE.Mesh(chG, chWater); chMesh.position.set(0, GY + 0.12, zf(0)); chMesh.rotation.y = chRy; group.add(chMesh);
    occupySeg([-xEnd - 20, zf(-xEnd - 20)], [xEnd + 20, zf(xEnd + 20)], CH_HW + 3);

    // 誘導路の中心線(黄)、滑走路の手前の停止線、掩体とドローン格納庫への導入線
    ymark(0, -135, 660, 0.7);
    for (const x of [-300, -100, 100, 300]) {
      ymark(x, -163, 0.7, 34);
      for (const z of [-170.6, -171.8]) ymark(x, z, 20, 0.45);
      for (let i = 0; i < 5; i++) for (const z of [-173.4, -174.6]) ymark(x - 8 + i * 4, z, 2, 0.45);
    }
    ymark(-230, -67, 0.7, 114); ymark(225, -67, 0.7, 114);
    for (const x of [-230, 230]) ymark(x, 114.5, 0.7, 249);
    ymark(0, 250, 482, 0.7);
    for (const x of HAS_X) ymark(x, 268, 0.7, 14);
    for (const x of DR_X) ymark(x, -240, 0.7, 36);

    // 土の囲いの分散駐機場(西、3 か所。東の誘導路へ開く)
    const bermSeg = ([ax, az], [bx, bz], h = 5, wb = 4.5, wt = 1.2) => {
      const l = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / l, nz = (bx - ax) / l;
      const ring = (x, z) => [V(x - nx * wb, SLAB - 0.1, z - nz * wb), V(x + nx * wb, SLAB - 0.1, z + nz * wb), V(x + nx * wt, SLAB + h, z + nz * wt), V(x - nx * wt, SLAB + h, z - nz * wt)];
      add(closedLoft([ring(ax, az), ring(bx, bz)]), earth, group);
      occupySeg([ax, az], [bx, bz], wb + 1);
    };
    for (const [x, z] of [[-300, -12], [-300, 48], [-300, 108]]) {
      pad(x - 15, x + 15, z - 15, z + 15); pad(x + 15, -241, z - 6, z + 6);
      occupy(x, z, 16, 16); occupy((x + 15 - 241) / 2, z, (-241 - x - 15) / 2 + 1, 7);
      ymark((x - 241) / 2, z, -241 - x, 0.7);
      for (const [a, b] of [[[x - 20, z - 20], [x + 14, z - 20]], [[x - 20, z + 20], [x + 14, z + 20]], [[x - 20, z - 20], [x - 20, z + 20]]]) bermSeg(a, b);
    }

    // 土をかぶせた弾薬庫(東、3 基。西向きの前面の壁と鋼の扉、袖の壁、前の舗装、間の土の壁)と柵、取付けの道
    const service = M.road ?? pave;
    add(box(35, 0.16, 12), service, group, { x: 258.5, y: SLAB + 0.08, z: 70, edges: false }); occupy(258.5, 70, 18, 7);
    add(box(12, 0.16, 136), service, group, { x: 276, y: SLAB + 0.08, z: 70, edges: false }); occupy(276, 70, 7, 69);
    const IG = [[306, 18], [306, 70], [306, 122]];
    for (const [x, z] of IG) {
      add(new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), earth, group, { x: x + 3, y: SLAB - 0.2, z, edges: false }).scale.set(17, 8.5, 11);
      add(box(1.6, 8, 18), conc, group, { x: x - 13, y: SLAB + 4, z });
      add(box(0.3, 5.4, 7), M.dark, group, { x: x - 13.9, y: SLAB + 2.7, z, edges: false });
      add(box(0.4, 0.5, 7.6), M.steel, group, { x: x - 14, y: SLAB + 5.7, z, edges: false });
      for (const s of [-1, 1]) add(box(6, 6, 1.2), conc, group, { x: x - 16, y: SLAB + 3, z: z + s * 9.4 });
      add(box(10, PV - SLAB, 18), pave, group, { x: x - 19, y: (SLAB + PV) / 2, z, edges: false });
      add(box(2, 3, 1.4), M.light, group, { x: x + 10, y: SLAB + 7.6, z: z + 3, edges: false });   // 換気口
      occupy(x + 1, z, 22, 12);
    }
    for (const z of [44, 96]) bermSeg([292, z], [326, z], 6, 5, 1.4);
    const ammoFence = [];
    const run = (x0, z0, x1, z1, gap) => {
      const l = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(l / 7)), ry = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (!gap?.(x, z)) ammoFence.push([box(0.4, 4, 0.4), { x, y: SLAB + 2, z }]); }
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (!gap?.(x, z)) for (const y of [1.3, 2.6, 3.9]) ammoFence.push([box(0.2, 0.2, l / n), { x, y: SLAB + y, z, ry }]); }
    };
    run(264, -8, 350, -8); run(350, -8, 350, 148); run(264, 148, 350, 148); run(264, -8, 264, 148, (x, z) => Math.abs(z - 70) < 8);
    occupy(307, 70, 45, 80);

    // 爆風よけの T 形の壁(ドローン格納庫の間、掩体の間、整備の駐機場の北)
    const tw = [];
    const tWall = (x0, z0, x1, z1) => {
      const l = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(l / 3.2)), ry = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; tw.push([box(0.7, 6, 2.9), { x, y: SLAB + 3, z, ry }], [box(2.6, 0.8, 2.9), { x, y: SLAB + 0.4, z, ry }]); }
      occupySeg([x0, z0], [x1, z1], 2.5);
    };
    for (const x of [-200, -120, -40, 40, 120, 200]) tWall(x, -284, x, -258);
    for (const x of [-160, -80, 0, 80, 160]) tWall(x, 263, x, 316);
    tWall(-200, -7, -100, -7);
    add(U.merge(THREE, tw), twM, group, { edges: false });

    // 整備の駐機場: 格納庫への導入線、係留の金具の列、地上機材の小屋 3 棟、洗機場、コンパスの台(東の誘導路へつなぐ)
    for (const hx of [-150, -60]) ymark(hx, 25, 0.6, 50);
    for (let x = -190; x <= 30; x += 12) for (const z of [8, 20, 32]) add(box(0.8, 0.08, 0.8), M.dark, group, { x, y: PV + 0.04, z, edges: false });
    pad(0, 54, 54, 92); occupy(27, 73, 28, 20);
    for (const x of [9, 27, 45]) {
      for (const [dx, dz] of [[-6, -5], [6, -5], [-6, 5], [6, 5]]) add(box(0.6, 6, 0.6), M.steel, group, { x: x + dx, y: PV + 3, z: 73 + dz, edges: false });
      add(box(15, 0.6, 12), M.light, group, { x, y: PV + 6.3, z: 73 });
      add(box(14, 0.4, 0.4), accent, group, { x, y: PV + 5.9, z: 79, edges: false });
    }
    pad(-60, -20, 155, 195); occupy(-40, 175, 21, 21);
    for (let x = -56; x <= -24; x += 4) add(box(0.4, 0.06, 36), M.dark, group, { x, y: PV + 0.03, z: 175, edges: false });
    for (const [x, z, w, d] of [[-40, 155.6, 40, 1.2], [-59.4, 175, 1.2, 40]]) add(box(w, 1.6, d), conc, group, { x, y: PV + 0.8, z });
    add(new THREE.CylinderGeometry(22, 22, PV - SLAB, 40), pave, group, { x: -110, y: (SLAB + PV) / 2, z: 175, edges: false });
    pad(-219, -132, 169, 181); occupy(-110, 175, 24, 24); occupy(-175, 175, 44, 7);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ymark(-110 + Math.sin(a) * 12, 175 + Math.cos(a) * 12, 0.5, i % 3 ? 10 : 18, a); }
    add(new THREE.RingGeometry(19.4, 20.2, 40).rotateX(-Math.PI / 2), yellow, group, { x: -110, y: PV + 0.04, z: 175, edges: false });

    // 外周の道路(半径 378、砂利)と柵(半径 389)。舗装・建物・用水路・正門の道の所は空ける
    const perim = [], fence = [];
    let pr = null, pf = null;
    for (let b = 0; b <= Math.PI * 2 + 1e-6; b += 0.021) {
      const xr = 378 * Math.sin(b), zr = 378 * Math.cos(b), okR = isFree(xr, zr, 4);
      if (okR && pr) perim.push([box(8, 0.18, Math.hypot(xr - pr[0], zr - pr[1]) + 0.6), { x: (xr + pr[0]) / 2, y: SLAB + 0.09, z: (zr + pr[1]) / 2, ry: Math.atan2(xr - pr[0], zr - pr[1]) }]);
      pr = okR ? [xr, zr] : null;
      const xf = 389 * Math.sin(b), zf2 = 389 * Math.cos(b), okF = isFree(xf, zf2, 1);
      if (okF) fence.push([box(0.5, 4, 0.5), { x: xf, y: SLAB + 2, z: zf2 }]);
      if (okF && pf) for (const y of [1.3, 2.6, 3.9]) fence.push([box(0.2, 0.2, Math.hypot(xf - pf[0], zf2 - pf[1])), { x: (xf + pf[0]) / 2, y: SLAB + y, z: (zf2 + pf[1]) / 2, ry: Math.atan2(xf - pf[0], zf2 - pf[1]) }]);
      pf = okF ? [xf, zf2] : null;
    }
    add(U.merge(THREE, perim), gravel, group, { edges: false });
    add(U.merge(THREE, [...fence, ...ammoFence]), M.dark, group, { edges: false });

    // 舗装の間の草: 滑走路と誘導路の間、ドローン格納庫の前の間の芝の板。残りの空き地は草の株と低木(下の地面の小物)
    for (const [x0, x1] of [[-287, -113], [-87, 87], [113, 287]]) add(box(x1 - x0, 0.06, 28), grassM, group, { x: (x0 + x1) / 2, y: SLAB + 0.03, z: -163, edges: false });
    for (const [x0, x1] of [[-228, -172], [-148, -92], [-68, -12], [12, 68], [92, 148], [172, 228]]) add(box(x1 - x0, 0.06, 34), grassM, group, { x: (x0 + x1) / 2, y: SLAB + 0.03, z: -239, edges: false });

    // ── 草の株・低木・小石(運河地帯の層 suez_deco_zone.js と同じ形と色)。敷地の空き地と、土塁の外(半径 412〜458) ──
    const col = (c) => new THREE.Color(c);
    const tint = (g, c) => ({ geo: g.index ? g.toNonIndexed() : g, color: col(c) });
    const blades = (n, h, w, c, lean, seed) => {
      const pos = [], r = U.rng(seed);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.6, ca = Math.cos(a), sa = Math.sin(a), hh = h * (0.7 + r() * 0.5), l = lean * hh; pos.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * l, hh, sa * l); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return { geo: g, color: col(c) };
    };
    const GEO = {
      tuft: U.concat(THREE, [blades(6, 2.8, 0.55, 0xb8bb9c, 0.35, 3)]),
      tuft2: U.concat(THREE, [blades(5, 2.2, 0.5, 0xc6c6a8, 0.45, 7)]),
      scrub: U.concat(THREE, [tint(new THREE.OctahedronGeometry(1, 0).scale(2.6, 1.4, 2.2).translate(0, 0.9, 0), 0xa5ac94), tint(new THREE.OctahedronGeometry(1, 0).scale(1.6, 1.1, 1.5).translate(1.5, 0.8, 0.9), 0x939b84)]),
      stone: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.55, 0.8), 0xcac3b3)]),
    };
    const inst = {};
    const plant = (kind, x, y, z, s) => (inst[kind] ??= []).push([x, y, z, s, rnd() * 6]);
    const inBand = (x, z) => Math.abs(z - zf(x)) < CANAL_KEEP;
    for (let x = -458; x <= 458; x += 4.5) for (let z = -458; z <= 458; z += 4.5) {
      const jx = x + (rnd() - 0.5) * 4, jz = z + (rnd() - 0.5) * 4, r = Math.hypot(jx, jz);
      const inside = r < 390, outside = r > 412 && r < 458;
      if (!inside && !outside) continue;
      if (rnd() > (inside ? 0.38 : 0.5)) continue;
      if (!isFree(jx, jz, 1.5)) continue;
      if (outside && (Math.abs(jx * ruz - jz * rux) < 16 && jx * rux + jz * ruz > 0)) continue;   // 正門の道
      const y = (inside && !inBand(jx, jz) ? SLAB : GY) - 0.1, q = rnd();
      plant(q < 0.45 ? "tuft" : q < 0.75 ? "tuft2" : q < 0.92 ? "scrub" : "stone", jx, q < 0.92 ? y : y + 0.12, jz, q < 0.92 ? 0.75 + rnd() * 0.55 : 0.6 + rnd() * 1.2);
    }
    {
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = V(0, 1, 0), tc = new THREE.Color();
      for (const [kind, list] of Object.entries(inst)) {
        const side = kind === "tuft" || kind === "tuft2" ? THREE.DoubleSide : THREE.FrontSide;
        const im = new THREE.InstancedMesh(GEO[kind], new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side }), list.length);
        list.forEach(([x, y, z, s, r], i) => { mt.compose(V(x, y, z), q.setFromAxisAngle(up, r), sc.set(s, s * (0.85 + rnd() * 0.3), s)); im.setMatrixAt(i, mt); im.setColorAt(i, tc.setScalar(0.92 + rnd() * 0.12)); });
        group.add(im);
      }
    }

    // ── 状態: 平常(扉が閉)/ 警戒(開) ──
    let state = "normal", t = 0;
    const SEC = 4, ease = (x) => x * x * (3 - 2 * x);
    function apply() {
      const e = ease(t);
      hasL.position.x = -13 * e; hasR.position.x = 13 * e;
      droneDoors.scale.y = 1 - 0.92 * e;
    }
    function update(dt) { t = state === "alert" ? Math.min(1, t + dt / SEC) : Math.max(0, t - dt / SEC); apply(); }
    function setState(s) { if (s === "normal" || s === "alert") state = s; }
    function setTeam(c) { accent.color.set(c ?? F.P.neutral); }
    function check() {
      const r = (x, z) => Math.hypot(x, z);
      const inBand = (x, z, half) => Math.abs(z - zf(x)) < CANAL_KEEP + half;
      const buildings = [[-150, 80, 30], [-60, 80, 30], [TW.x, TW.z, 12], [165, 125, 12], [160, 175, 10], ...HAS_X.map((x) => [x, HAS.z, 22]), ...DR_X.map((x) => [x, DR_Z, 11]), [-277, 165, 30]];
      return {
        buildingsClearOfCanal: buildings.every(([x, z, h]) => !inBand(x, z, h)),
        runwayCornerR: +r(RW.x, RW.z0).toFixed(1), bermInner: R_IN,
        hasOuterCornerR: +r(HAS_X[5] + 16, HAS.z + HAS.len / 2).toFixed(1), fuelOuterCornerR: +r(-310.5, 200.5).toFixed(1),
        droneOuterCornerR: +r(DR_X[6] + 15, DR_Z - 11).toFixed(1), taxiwayCornerR: +r(330, -146).toFixed(1),
        doorLeafOpenSpan: [-6.3 - 13 - 6.3, 6.3 + 13 + 6.3], portalHalfWidth: 26,
        leafToPortalFace: +((-3) - (-4.1 + 0.5)).toFixed(2),
        bermGaps: gaps.map(([b, w]) => [+b.toFixed(3), w]),
        interior: (() => {   // 地面の小物が用水路・舗装・建物の上に無いか(焼く前の占有の箱で測る)
          let n = 0, onChannel = 0;
          for (const list of Object.values(inst)) for (const [x, , z] of list) { n++; if (Math.abs(z - zf(x)) < CH_HW + 1) onChannel++; }
          return { plants: n, onChannel, occupiedBoxes: occ.length, flagAt: flagAt.map((v) => +v.toFixed(1)), igloos: IG.length };
        })(),
      };
    }
    apply();
    U.bake(THREE, group, { dynamic: [hasL, hasR, droneDoors], live: [accent] });
    return { group, update, setState, setTeam, check, get state() { return state; } };
  });
})();
