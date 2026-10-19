// スエズ運河マップの拠点 5「エル・バラーの分岐」。新運河が旧運河から斜めに分かれる所(中州の北の先端)。
// 中州の先端に運河の信号所(航行管制の塔)、北東の岸に浚渫の基地(作業棟・管の置き場・土捨て場の池)、分岐の水路にカッターサクション浚渫船と浮き管、
// 旧運河の西寄りに係船ドルフィンと待機中のばら積み船。近未来化: 中州の先端に監視塔とドローンの発着場。
// 縮尺 0.6 単位/m。信号所の塔は高さ 2 倍に誇張。浚渫船は実寸の比率(全長 120 m)、ばら積み船は 200 m。
// 状態: 浚渫中(船尾の作業スパッドを軸に船体が左右へ振れ、先端のカッターが回る)/ 停止。
// 座標は拠点の中心が原点(地図の x = 150, z = -1750)。水路の位置は ctx.channels から求める。
(function () {
  function ballah(THREE, ctx) {
    const { U, M, k } = ctx;
    const { add, box, cyl, V, beam, tube } = k;
    const P = DreamAssets.fac.P;
    const accent = M.lambert(P.neutral);
    const group = new THREE.Group(); group.name = "site-ballah";

    // ── 水路の座標: 新運河の斜めの区間(中心線 A → B、半幅 hw)と旧運河 ──
    const ch = ctx.channels.find((c) => c.name === "新運河(斜め)"), old = ctx.channels.find((c) => c.name === "旧運河");
    const A = ch.a, hw = ch.hw, len = Math.hypot(ch.b[0] - A[0], ch.b[1] - A[1]);
    const ux = (ch.b[0] - A[0]) / len, uz = (ch.b[1] - A[1]) / len, nx = uz, nz = -ux;   // n = 北東(中州の反対側)向き
    const ne = (s, off) => [A[0] + s * ux + off * nx, A[1] + s * uz + off * nz];        // off: 中心線から北東へ(hw より大きいと北東の岸)
    const sw = (s, off) => [A[0] + s * ux - off * nx, A[1] + s * uz - off * nz];        // 中州の側
    const ALONG = Math.atan2(ux, uz);                                                    // 水路に沿う向き(ローカル +z を u へ)
    const oldX = old.a[0], oldW = old.hw;

    // ── 中州の先端: 運河の信号所(塔)、監視塔、ドローンの発着場 ──
    const ST = { x: -12, z: 268 };
    add(box(30, 5, 30), M.light, group, { x: ST.x, y: 2.5, z: ST.z });
    add(box(12, 46, 12), M.body, group, { x: ST.x, y: 28, z: ST.z });
    for (let i = 0; i < 4; i++) add(box(12.4, 1.2, 12.4), M.mid, group, { x: ST.x, y: 12 + i * 9, z: ST.z, edges: false });
    add(box(24, 10, 24), M.body, group, { x: ST.x, y: 56, z: ST.z });
    add(box(24.4, 4.4, 24.4), M.glass, group, { x: ST.x, y: 57, z: ST.z, edges: false });
    add(box(24.6, 1.6, 24.6), accent, group, { x: ST.x, y: 51.6, z: ST.z, edges: false });
    add(box(27, 1.2, 27), M.light, group, { x: ST.x, y: 61.6, z: ST.z });
    add(cyl(0.8, 20, 6), M.dark, group, { x: ST.x + 6, y: 72, z: ST.z - 5 });
    for (const y of [76, 70]) add(new THREE.SphereGeometry(1.6, 8, 6), M.dark, group, { x: ST.x + 6, y, z: ST.z - 5, edges: false });   // 信号の形象物
    add(box(18, 8, 12), M.light, group, { x: ST.x - 22, y: 4, z: ST.z + 16 });
    k.lattice(group, V(26, 0, 300), 42, 4, 1.6, 4, 0.45, M.mid);
    add(box(9, 3.6, 3.6), M.body, group, { x: 26, y: 44, z: 300 });
    add(box(2.6, 2.2, 2.6), M.dark, group, { x: 26, y: 47, z: 298 });
    const PAD = { x: -35, z: 222 };
    add(box(30, 0.8, 30), M.light, group, { x: PAD.x, y: 0.4, z: PAD.z });
    for (const [w, d, x] of [[2, 13, -5], [2, 13, 5], [10, 2, 0]]) add(box(w, 0.3, d), M.dark, group, { x: PAD.x + x, y: 0.95, z: PAD.z, edges: false });
    add(new THREE.TorusGeometry(11.5, 0.6, 6, 28).rotateX(Math.PI / 2), accent, group, { x: PAD.x, y: 1, z: PAD.z, edges: false });
    // 中州の先端の護岸の笠石(旧運河側)
    add(box(3, 0.6, 260), M.light, group, { x: oldX + oldW + 1.5, y: 0.3, z: 290, edges: false });
    // 信号所の細部: 外の階段塔、管制室の周りの露台と手すり、窓の方立て、信号の帆桁と揚げ索、屋上の空中線、避雷針の赤い頭
    const B1 = box(1, 1, 1);
    const thin = (p, q, w, m, parent = group) => { const d = q.clone().sub(p), len = d.length(), o = add(B1, m, parent, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2, edges: false }); o.scale.set(w, len, w); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(len)); return o; };
    {
      const sx0 = ST.x + 6.4, sx1 = ST.x + 13, sz0 = ST.z - 6, sz1 = ST.z + 6;
      for (const [x, z] of [[sx0, sz0], [sx1, sz0], [sx0, sz1], [sx1, sz1]]) thin(V(x, 5, z), V(x, 51, z), 0.5, M.light);
      for (let y = 13, i = 0; y < 51; y += 8, i++) { add(box(sx1 - sx0, 0.5, 12), M.light, group, { x: (sx0 + sx1) / 2, y, z: ST.z, edges: false }); thin(V((sx0 + sx1) / 2, y - 7.8, i % 2 ? sz0 + 1 : sz1 - 1), V((sx0 + sx1) / 2, y, i % 2 ? sz1 - 1 : sz0 + 1), 0.7, M.mid); }
      add(box(29, 0.6, 29), M.light, group, { x: ST.x, y: 51.3, z: ST.z });
      for (const s of [-1, 1]) { thin(V(ST.x - 14, 53.2, ST.z + s * 14), V(ST.x + 14, 53.2, ST.z + s * 14), 0.25, M.dark); thin(V(ST.x + s * 14, 53.2, ST.z - 14), V(ST.x + s * 14, 53.2, ST.z + 14), 0.25, M.dark); }
      for (let t = -14; t <= 14; t += 4) for (const s of [-1, 1]) { add(B1, M.dark, group, { x: ST.x + t, y: 52.5, z: ST.z + s * 14, edges: false }).scale.set(0.2, 1.4, 0.2); add(B1, M.dark, group, { x: ST.x + s * 14, y: 52.5, z: ST.z + t, edges: false }).scale.set(0.2, 1.4, 0.2); }
      for (let t = -10.5; t <= 10.5; t += 3) for (const s of [-1, 1]) { add(B1, M.light, group, { x: ST.x + t, y: 57, z: ST.z + s * 12.25, edges: false }).scale.set(0.35, 4.4, 0.2); add(B1, M.light, group, { x: ST.x + s * 12.25, y: 57, z: ST.z + t, edges: false }).scale.set(0.2, 4.4, 0.35); }
      const mx = ST.x + 6, mz = ST.z - 5;
      thin(V(mx - 7, 79, mz), V(mx + 7, 79, mz), 0.45, M.dark);
      for (const s of [-1, 1]) thin(V(mx + s * 7, 79, mz), V(mx + s * 3, 62.3, mz + 3), 0.12, M.dark);
      for (const y of [74, 68]) add(new THREE.ConeGeometry(1.5, 2.6, 8), M.dark, group, { x: mx + 5, y, z: mz, edges: false });
      for (const [x, z, h] of [[ST.x - 8, ST.z + 8, 9], [ST.x - 4, ST.z + 9, 6], [ST.x + 9, ST.z + 8, 7]]) thin(V(x, 62.2, z), V(x, 62.2 + h, z), 0.25, M.dark);
      add(box(0.9, 0.9, 0.9), M.red, group, { x: mx, y: 82.4, z: mz, edges: false });
    }

    // ── 北東の岸: 浚渫の基地(作業棟、事務所、管の置き場、係船杭)と土捨て場の池 ──
    const onNE = (s, off, geo, mat, y, o = {}) => { const [x, z] = ne(s, off); return add(geo, mat, group, { x, y, z, ry: ALONG, ...o }); };
    onNE(270, 125, box(26, 14, 50), M.light, 7);
    onNE(270, 125, box(27, 2, 51), M.mid, 15, { edges: false });
    onNE(225, 112, box(14, 8, 18), M.body, 4);
    onNE(225, 112, box(14.4, 1.4, 18.4), accent, 6, { edges: false });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) onNE(305, 108 + j * 2.8 + i * 1.4, cyl(1.3, 32, 8).rotateX(Math.PI / 2), M.mid, 1.3 + i * 2.4, { edges: false });   // 鋼管の山
    onNE(320, 120, box(16, 6, 10), M.mid, 3);
    add(box(2.4, 0.6, 150), M.light, group, { x: ne(265, hw + 1.2)[0], y: 0.3, z: ne(265, hw + 1.2)[1], ry: ALONG, edges: false });   // 岸壁の笠石
    for (const s of [215, 245, 290, 320]) { const [x, z] = ne(s, hw - 6); add(cyl(2.4, 9, 10), M.mid, group, { x, y: 1.5, z }); }   // 係船杭
    // 土捨て場: 盛り土の堤で囲った池(浚渫土を浮き管で送る)
    const [pcx, pcz] = ne(170, 200);
    add(new THREE.TorusGeometry(48, 5, 6, 40).rotateX(Math.PI / 2).scale(1.5, 1, 1).rotateY(ALONG - Math.PI / 2), M.mid, group, { x: pcx, y: 1.8, z: pcz, edges: false });
    const pondPts = Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * Math.PI * 2, lx = Math.cos(a) * 70, lz = Math.sin(a) * 45; return [pcx + lx * ux * 1 + lz * nx, pcz + lx * uz + lz * nz]; });
    const pond = k.waterShape(pondPts, k.water({ opacity: 0.5 })); pond.position.y = 2.6; group.add(pond);
    add(box(1.8, 1.8, 40), M.dark, group, { x: ne(170, 140)[0], y: 2.4, z: ne(170, 140)[1], ry: ALONG + Math.PI / 2, edges: false });   // 池へ入る管

    // ── 浮き管: 浚渫船の船尾から北東の岸へ(浮体の列)、岸の上の管 ──
    const SP = { s: 168, off: 35 };   // 作業スパッド(浚渫船の振れの軸)
    const [spx, spz] = ne(SP.s, SP.off);
    const p0 = V(spx, 0, spz), p1 = V(...[ne(150, 62)].map(([x, z]) => [x, 0, z])[0]), p2 = V(...[ne(140, hw - 4)].map(([x, z]) => [x, 0, z])[0]);
    const floatG = cyl(2, 5.2, 10); floatG.rotateZ(Math.PI / 2);
    const floatParts = [], N = 9;
    for (let i = 1; i <= N; i++) {
      const t = i / (N + 1), a = p0.clone().multiplyScalar((1 - t) ** 2).add(p1.clone().multiplyScalar(2 * t * (1 - t))).add(p2.clone().multiplyScalar(t * t));
      const t2 = (i + 0.2) / (N + 1), b = p0.clone().multiplyScalar((1 - t2) ** 2).add(p1.clone().multiplyScalar(2 * t2 * (1 - t2))).add(p2.clone().multiplyScalar(t2 * t2));
      floatParts.push([floatG, { x: a.x, y: ctx.WY + 0.6, z: a.z, ry: Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2 }]);
    }
    add(U.merge(THREE, floatParts), M.lambert(0xd88a3a), group, { edges: false });   // 浮体は橙(実物の浮き管の色)
    const [lx0, lz0] = ne(140, hw - 4), [lx1, lz1] = ne(140, hw + 8), [lx2, lz2] = ne(170, 152);
    tube(group, V(lx0, ctx.WY + 1, lz0), V(lx1, 1.4, lz1), 1.2, M.dark);
    tube(group, V(lx1, 1.4, lz1), V(lx2, 1.4, lz2), 1.2, M.dark);

    // ── カッターサクション浚渫船: 原点 = 作業スパッド、+z = 船首(先にラダーとカッター) ──
    const dredger = new THREE.Group(); dredger.position.set(spx, 0, spz); dredger.rotation.y = ALONG; group.add(dredger);
    const Lh = 72, Bh = 6.5, dk = 4;
    add(U.loft(THREE, [
      { z: -3, pts: U.sym([[Bh - 0.6, ctx.WY - 3], [Bh, dk]]) }, { z: Lh - 14, pts: U.sym([[Bh, ctx.WY - 4], [Bh, dk]]) }, { z: Lh - 4, pts: U.sym([[Bh - 1.5, ctx.WY - 2.5], [Bh - 0.5, dk]]) },
    ]), M.dark, dredger);
    add(box(2 * Bh - 1, 0.6, Lh - 8), M.light, dredger, { y: dk + 0.3, z: Lh / 2 - 6, edges: false });
    // ラダーの通る溝(船首の切れ込み)を見せる暗い板、ポンプ室、船橋
    add(box(4, 0.8, 24), M.dark, dredger, { y: dk + 0.5, z: Lh - 16, edges: false });
    add(box(10, 6, 16), M.body, dredger, { y: dk + 3, z: 26 });
    add(box(11, 5, 10), M.body, dredger, { y: dk + 3.5 + 6, z: 20 });
    add(box(11.4, 1.8, 10.4), M.glass, dredger, { y: dk + 10.8, z: 20, edges: false });
    add(box(11.6, 1.2, 10.6), accent, dredger, { y: dk + 8.4, z: 20, edges: false });
    add(cyl(1.2, 8, 8), M.dark, dredger, { y: dk + 10, z: 12 });
    // 船首の A 形の門型(ラダーを吊る)とラダー(トラスの梁)、カッター
    const LAD0 = V(0, dk + 1, Lh - 22), LAD1 = V(0, ctx.BED + 2, Lh + 22);
    for (const x of [-3.5, 3.5]) beam(dredger, V(x * 1.4, dk, Lh - 6), V(x * 0.6, dk + 20, Lh - 2), 1.2, M.light);
    beam(dredger, V(-2.6, dk + 20, Lh - 2), V(2.6, dk + 20, Lh - 2), 1.2, M.light);
    for (const x of [-1.6, 1.6]) beam(dredger, LAD0.clone().setX(x), LAD1.clone().setX(x), 1.4, M.mid);
    for (let i = 1; i < 6; i++) { const p = LAD0.clone().lerp(LAD1, i / 6); beam(dredger, p.clone().setX(-1.6), p.clone().setX(1.6), 0.6, M.mid); }
    const cutter = new THREE.Group(); cutter.position.copy(LAD1); dredger.add(cutter);
    cutter.rotation.x = Math.atan2(LAD1.y - LAD0.y, LAD1.z - LAD0.z) * -1 + Math.PI / 2;
    add(new THREE.ConeGeometry(3, 5, 6), M.dark, cutter, { y: 2.5 });
    for (let i = 0; i < 6; i++) add(box(0.5, 5, 0.9), M.mid, cutter, { x: Math.cos(i) * 2, y: 2.3, z: Math.sin(i) * 2, ry: i, edges: false });
    // スパッド: 作業スパッド(下ろす。振れの軸)と補助スパッド(上げる)
    add(cyl(1.3, dk + 26 - ctx.BED, 10), M.mid, dredger, { y: (ctx.BED + dk + 26) / 2, z: 0 });
    add(cyl(1.3, 40, 10), M.mid, dredger, { x: 3.6, y: 20, z: 5 });
    add(box(10, 3, 5), M.light, dredger, { y: dk + 1.5, z: 2.5 });
    // 浚渫船の細部: 舷側の手すり、船首寄りの振れの巻上げ機、ポンプ室から船尾への排泥管、救命の筏の箱
    for (const s of [-1, 1]) {
      for (let z = 1; z <= Lh - 10; z += 4) add(B1, M.dark, dredger, { x: s * (Bh - 0.5), y: dk + 1.1, z, edges: false }).scale.set(0.2, 1.6, 0.2);
      thin(V(s * (Bh - 0.5), dk + 1.9, 1), V(s * (Bh - 0.5), dk + 1.9, Lh - 10), 0.2, M.dark, dredger);
      add(cyl(1.4, 2.4, 10).rotateZ(Math.PI / 2), M.mid, dredger, { x: s * 3.6, y: dk + 1.8, z: Lh - 12, edges: false });
      add(box(1.8, 1.4, 1.8), M.dark, dredger, { x: s * 3.6, y: dk + 1.2, z: Lh - 15, edges: false });
      add(box(1.6, 1.2, 3), M.lambert(0xd88a3a), dredger, { x: s * 4.6, y: dk + 1.1, z: 36, edges: false });
    }
    add(cyl(1, 30, 8).rotateX(Math.PI / 2), M.dark, dredger, { x: -2.6, y: dk + 1.4, z: 12, edges: false });
    // 振れの索(船首の左右から両岸寄りの錨へ。毎フレーム更新)
    const wirePos = new Float32Array(12), wireG = new THREE.BufferGeometry(); wireG.setAttribute("position", new THREE.BufferAttribute(wirePos, 3));
    const wires = new THREE.LineSegments(wireG, new THREE.LineBasicMaterial({ color: P.dark })); group.add(wires);
    const ANCH = [ne(SP.s + Lh + 30, hw - 6), ne(SP.s + Lh + 30, -hw + 6)];
    for (const [x, z] of ANCH) add(new THREE.SphereGeometry(1.8, 8, 6), M.lambert(0xd88a3a), group, { x, y: ctx.WY + 0.5, z, edges: false });   // 錨の浮標

    // ── 旧運河の西寄り: 係船ドルフィンと待機中のばら積み船(船首は南) ──
    const SHIP = { x: oldX - 55, z: -160 }, SL = 120, SB = 9.5, sdk = 7;
    const ship = new THREE.Group(); ship.position.set(SHIP.x, 0, SHIP.z); group.add(ship);
    add(U.loft(THREE, [
      { z: -SL / 2, pts: U.sym([[SB * 0.85, ctx.WY - 3], [SB * 0.95, sdk]]) }, { z: -SL / 2 + 12, pts: U.sym([[SB, ctx.WY - 5], [SB, sdk]]) },
      { z: SL / 2 - 16, pts: U.sym([[SB, ctx.WY - 5], [SB, sdk]]) }, { z: SL / 2 - 3, pts: U.sym([[SB * 0.5, ctx.WY - 3], [SB * 0.8, sdk + 1]]) }, { z: SL / 2, pts: U.sym([[0.4, ctx.WY - 1], [SB * 0.4, sdk + 1.5]]) },
    ]), M.dark, ship);
    add(box(2 * SB + 0.2, 1.2, SL - 18), M.body, ship, { y: sdk - 0.5, z: 2, edges: false });
    for (let i = 0; i < 5; i++) add(box(2 * SB - 5, 2, 13), M.mid, ship, { y: sdk + 1, z: -30 + i * 17 });   // 艙口の蓋
    for (let i = 0; i < 4; i++) {   // 甲板クレーン(台・旋回体・ジブ)
      const z = -21.5 + i * 17;
      add(cyl(1.6, 8, 8), M.light, ship, { x: 0, y: sdk + 4, z });
      add(box(3.4, 3, 3.4), M.light, ship, { x: 0, y: sdk + 9, z });
      beam(ship, V(0, sdk + 9, z), V(SB - 1, sdk + 18, z + 6), 1, M.light);
    }
    add(box(2 * SB - 2, 18, 11), M.body, ship, { y: sdk + 9, z: -SL / 2 + 13 });
    add(box(2 * SB - 1.6, 2, 11.4), M.glass, ship, { y: sdk + 15.5, z: -SL / 2 + 13, edges: false });
    add(box(2 * SB + 3, 2.4, 5), M.body, ship, { y: sdk + 17.5, z: -SL / 2 + 15 });
    add(box(4, 8, 5), M.dark, ship, { y: sdk + 22, z: -SL / 2 + 8 });
    const DOL = SHIP.x - SB - 3.4 - 0.6;
    const moorPos = [];
    for (const dz of [-48, -16, 16, 48]) {
      add(cyl(3.4, 14, 10), M.light, group, { x: DOL, y: ctx.WY + 2, z: SHIP.z + dz });
      moorPos.push(DOL, ctx.WY + 9, SHIP.z + dz, SHIP.x - SB + 1, sdk + 0.5, SHIP.z + dz + (dz < 0 ? -6 : 6));
    }
    const moorG = new THREE.BufferGeometry(); moorG.setAttribute("position", new THREE.Float32BufferAttribute(moorPos, 3));
    group.add(new THREE.LineSegments(moorG, new THREE.LineBasicMaterial({ color: P.dark })));

    // ── 制圧圏の中の地面(北東の岸: 浚渫の基地の構内・駐車場・柵・資材・乾燥床・構内道路、中州の先端: 信号所の構内・芝、西の岸: 係船の岸) ──
    const D = DreamAssets.maps.siteDress?.(THREE, ctx, group, { seed: 505 });
    let dress = null;
    if (D) {
      const { block, slab, line, road, parking, fence, wall, lamp, shed, kiosk, transformer, container, blocks, pipes, drum, bench, canopy, tree, treeRow, kerbRect, C: DC, TOP } = D;
      const NEp = (s, off) => ne(s, off);                     // 北東の岸の点(水路に沿って s、中心線から off)
      const A9 = ALONG;                                        // 局所の u = 北東、v = 水路に沿う
      // 既存の構造物
      block.rect(ST.x, ST.z, 30, 30); block.rect(ST.x - 22, ST.z + 16, 18, 12); block.rect(ST.x + 9.7, ST.z, 7, 12, 0, 1); block.circle(26, 300, 6); block.rect(PAD.x, PAD.z, 30, 30);
      block.rect(...NEp(270, 125), 26, 50, A9); block.rect(...NEp(225, 112), 14, 18, A9); block.rect(...NEp(305, 112), 14, 34, A9); block.rect(...NEp(320, 120), 10, 16, A9);
      block.rect(pcx, pcz, 112, 160, A9, 2);                   // 土捨て場の池と堤
      block.line([NEp(140, hw - 4), NEp(140, hw + 8), NEp(170, 152)], 5);
      // 北東の岸: 基地の構内(舗装・白線)、駐車場、柵と門、浮き管の浮体と予備のカッターの置き場、コンテナ
      const [bx, bz] = NEp(262, 118);
      slab(bx, bz, 46, 136, A9); kerbRect(bx, bz, 46, 136, A9);
      for (const off of [99, 137]) { const [x, z] = NEp(262, off); line(x, z, 128, 0.45, A9); }
      for (let s9 = 200; s9 <= 236; s9 += 9) { const [x, z] = NEp(s9, 127); line(x, z, 10, 0.45, A9 + Math.PI / 2); }
      const [px9, pz9] = NEp(318, 161); parking(px9, pz9, A9 - Math.PI / 2, 5);
      const poly = [[190, 92], [342, 92], [342, 182], [255, 182], [255, 144], [190, 144], [190, 92]].map(([s9, o]) => NEp(s9, o));
      fence(poly, { gap: [...NEp(190, 118), 7] });
      for (const s9 of [205, 245, 285, 325]) lamp(...NEp(s9, 95), A9 + Math.PI, 12);
      pipes(...NEp(276, 160), A9, 4, 18, 1.9, 0xd88a3a);   // 浮き管の浮体の予備(橙)
      for (let i = 0; i < 2; i++) { const [x, z] = NEp(262 + i * 12, 176); D.part(new THREE.ConeGeometry(3, 5, 6), M.dark, x, D.G0 + 3.3, z, 1, 1, 1); D.part(D.B1, M.mid, x, D.G0 + 0.4, z, 7, 0.8, 7, A9); D.block.circle(x, z, 5); }   // 予備のカッター
      for (let t = 0; t < 2; t++) for (let i = 0; i < 2; i++) { const [x, z] = NEp(335, 132 - i * 6); container(x, z, A9, t); }
      drum(...NEp(300, 133), A9); drum(...NEp(308, 133), A9, 2.4, 2);
      kiosk(...NEp(196, 100), A9); transformer(...NEp(334, 104), A9);
      // 構内道路(門から北西へ、旧運河沿いを北へ)と街灯
      const [g1x, g1z] = NEp(184, 118), [g2x, g2z] = NEp(40, 118);
      road([[g1x, g1z], [g2x, g2z], [-40, -150], [-40, -310]], 10);
      for (const [x, z, a] of [[...NEp(150, 110), A9 + Math.PI / 2], [...NEp(100, 110), A9 + Math.PI / 2], [...NEp(60, 110), A9 + Math.PI / 2], [-48, -180, Math.PI / 2], [-48, -230, Math.PI / 2], [-48, -280, Math.PI / 2]]) lamp(x, z, a);
      fence([[-61, -300], [-61, -100]]); treeRow([-54, -295], [-54, -105], 14, "cas");
      // 浚渫土の乾燥床(低い堤で仕切った 3 区画、湿った土)
      for (let i = 0; i < 3; i++) {
        const cx = -5 + i * 44, cz = -210;
        slab(cx, cz, 40, 36, 0, 0xc9c1ad, 0.72);
        wall([[cx - 20, cz - 18], [cx + 20, cz - 18], [cx + 20, cz + 18], [cx - 20, cz + 18], [cx - 20, cz - 18]], { h: 1.6, t: 1.6, color: 0xd6cfbf });
      }
      D.part(new THREE.CylinderGeometry(1, 1, 1, 8), M.dark, 85, 1.2, -185, 1.2, 1.4, 1.2);
      shed(40, -160, 0, 14, 8, 1, DC.white2, { windows: true });
      // 中州の先端: 信号所の構内(舗装・縁石・街灯)、南の芝とヤシ、配電の箱、警備の柵
      slab(ST.x - 10, ST.z, 52, 46); kerbRect(ST.x - 10, ST.z, 52, 46);
      for (const [x, z] of [[ST.x - 34, ST.z - 21], [ST.x + 14, ST.z - 21], [ST.x - 34, ST.z + 21]]) lamp(x, z, 0, 10, true);
      for (const [x, z] of [[-56, 180], [-56, 196]]) tree(x, z, "palm", 0.8);
      kiosk(-10, 240, 0);
      fence([[-62, 160], [-62, 290]]);
      fence([sw(215, 86), sw(380, 86)]);
      // 西の岸: 係船の岸(係船柱、綱取りの小屋、渡り板、街灯、柵と並木、小さな駐車場)
      for (const dz of [-48, -16, 16, 48]) { D.part(D.C8, M.dark, -236, D.G0 + 1, SHIP.z + dz, 1.1, 2, 1.1); D.part(D.C8, M.dark, -236, D.G0 + 2.2, SHIP.z + dz, 1.5, 0.4, 1.5); D.block.circle(-236, SHIP.z + dz, 3); }
      shed(-250, -140, Math.PI / 2, 12, 8, 1, DC.white2);
      thin(V(-239, 1.4, SHIP.z + 4), V(-216, sdk + 0.6, SHIP.z + 4), 2.4, M.light);   // 船への渡り板(水の上)
      for (const dz of [-60, 0, 60]) lamp(-244, SHIP.z + dz, -Math.PI / 2, 10);
      fence([[-252, -90], [-252, 120]]);
      parking(-268, -40, Math.PI / 2, 4, { rows: 1 });
      treeRow([-270, -95], [-270, 110], 14, "cas", 0.9);
      D.edgeCover();
      dress = D.finish();
    }

    // ── 状態: 浚渫中(振れ ±12°・カッターの回転)/ 停止 ──
    let state = "dredge", clock = 0, phase = 0;
    const SWING = 0.21;
    const tmp = V(0, 0, 0);
    function placeWires() {
      dredger.updateMatrixWorld(true); group.updateMatrixWorld(true);
      const inv = group.matrixWorld.clone().invert();
      [[-Bh, ANCH[1]], [Bh, ANCH[0]]].forEach(([x, [ax, az]], i) => {
        tmp.set(x, dk + 0.5, Lh - 6).applyMatrix4(dredger.matrixWorld).applyMatrix4(inv);
        wirePos.set([tmp.x, tmp.y, tmp.z, ax, ctx.WY + 0.5, az], i * 6);
      });
      wireG.attributes.position.needsUpdate = true;
    }
    function update(dt) {
      clock += dt;
      if (state === "dredge") { phase += dt; cutter.rotation.y += dt * 2.4; }
      dredger.rotation.y = ALONG + SWING * Math.sin((phase * Math.PI * 2) / 24);
      placeWires();
    }
    update(0);
    function check() {
      const r1 = (v) => +v.toFixed(2);
      // 振れの全範囲で船体の四隅・カッターが水の中か(北東の岸・中州の岸までの余裕も)
      let inWater = true, minOff = Infinity, maxOff = -Infinity;
      for (const a of [-SWING, 0, SWING]) for (const [x, z] of [[-Bh, -3], [Bh, -3], [-Bh, Lh - 4], [Bh, Lh - 4], [0, Lh + 22]]) {
        const ry = ALONG + a, wx = spx + x * Math.cos(ry) + z * Math.sin(ry), wz = spz - x * Math.sin(ry) + z * Math.cos(ry);
        inWater = inWater && ctx.isWater(wx, wz);
        const off = (wx - A[0]) * nx + (wz - A[1]) * nz; minOff = Math.min(minOff, off); maxOff = Math.max(maxOff, off);
      }
      const shipIn = [[-SB, -SL / 2], [SB, -SL / 2], [-SB, SL / 2], [SB, SL / 2]].every(([x, z]) => ctx.isWater(SHIP.x + x, SHIP.z + z));
      const landOK = [[ST.x - 15, ST.z - 15], [ST.x + 15, ST.z + 15], ne(270, 100), ne(270, 150), ne(170, 140), ne(170, 260), [PAD.x - 15, PAD.z - 15], [PAD.x + 15, PAD.z - 15], [PAD.x + 15, PAD.z + 15], [PAD.x - 15, PAD.z + 15], [26 - 6, 300 - 6], [26 + 6, 300 + 6]].every(([x, z]) => !ctx.isWater(x, z));
      return {
        dredgerInWater: inWater, dredgerOffRange: [r1(minOff), r1(maxOff)], channelHalf: hw,   // 中心線からの位置(±hw の内側なら水路の中)
        shipInWater: shipIn, shipToDolphin: r1(SHIP.x - SB - (DOL + 3.4)), shipToBank: r1(SHIP.x - SB - (oldX - oldW)),
        landStructuresOnLand: landOK, keelToBed: ctx.WY - 5 - ctx.BED,
        dress: dress && { ...dress, ...D.check() },   // 地面の作り込み(物と草の数、水の中の数)
      };
    }

    U.bake(THREE, group, { dynamic: [dredger, cutter], live: [accent] });
    return {
      group, update, check,
      setState(s) { state = s; }, get state() { return state; },
      setTeam: (c) => accent.color.set(c ?? P.neutral),
    };
  }

  DreamAssets.maps.site("ballah", ballah);
})();
