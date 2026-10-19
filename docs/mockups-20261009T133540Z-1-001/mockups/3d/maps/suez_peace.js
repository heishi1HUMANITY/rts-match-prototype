// 攻略拠点「平和橋(エル・カンタラ)」。スエズ運河橋(2001 年、斜張橋。主径間 404 m、主塔 154 m、桁下 70 m)。
// 縮尺は拠点の決まり(0.6 単位/m)。誇張: 主塔の高さ 1.8 倍(頂部 168 = 実物 154 m なら 0.6 倍で 92)、桁下 1.5 倍(桁の上面 62)、桁の幅 1.5 倍。主径間(主塔の間 260)は実寸の比率。
// 主塔は古代エジプトのオベリスクを模した H 形(2 本の脚の先がピラミディオン)。斜材は扇形(片面 10 本 × 前後)。取付けの高架は両岸へ下り、端は盛土。
// 動き: コンテナ船が運河を通航する(実在の通航。橋の下を抜ける)。近未来化: 東の取付けの自動検問ゲート(センサーの門型)。
// 運河は x = ±80(局所座標)。主塔・橋脚は陸の上だけ。
(function () {
  DreamAssets.maps.site("peace", (THREE, ctx) => {
    const { U, F, M, k, WY, BED } = ctx;
    const { add, box, cyl, V, closedLoft, tube } = k;
    const accent = M.lambert(F.P.neutral);
    const group = new THREE.Group(); group.name = "site-peace";
    const D = { px: 130, deckY: 62, hw: 10, flat: 210, end: 440, top: 150, legZ: 15 };
    const yAt = (x) => { const a = Math.abs(x); if (a <= D.flat) return D.deckY; const t = Math.min(1, (a - D.flat) / (D.end - D.flat)); return 1 + (D.deckY - 1) * (1 - t * t * (3 - 2 * t)); };   // 主径間は平ら、取付けは S 字の縦断曲線で下る

    // ── 桁(箱桁)、路面、高欄、中央分離帯 ──
    const xs = []; for (let x = -D.end; x <= D.end + 0.1; x += 10) xs.push(x);
    const sec = (pts) => xs.map((x) => pts.map(([z, dy]) => V(x, yAt(x) + dy, z)));
    add(closedLoft(sec([[-D.hw, 0], [D.hw, 0], [D.hw - 1, -2.5], [D.hw - 3, -4], [-D.hw + 3, -4], [-D.hw + 1, -2.5]])), M.light, group);
    add(closedLoft(sec([[-D.hw + 0.8, 0], [D.hw - 0.8, 0], [D.hw - 0.8, 0.15], [-D.hw + 0.8, 0.15]])), M.mid, group, { edges: false });
    for (const s of [-1, 1]) add(closedLoft(sec([[s * D.hw - s * 0.6, 0], [s * D.hw, 0], [s * D.hw, 1.4], [s * D.hw - s * 0.6, 1.4]])), M.body, group, { edges: false });
    add(closedLoft(sec([[-0.5, 0.15], [0.5, 0.15], [0.5, 1.0], [-0.5, 1.0]])), M.body, group, { edges: false });
    // 取付けの端の盛土(桁の下を埋める台形)と地上の道路のつなぎ
    for (const s of [-1, 1]) {
      const ex = xs.filter((x) => s * x >= 390).sort((a, b) => s * a - s * b);
      add(closedLoft(ex.map((x) => [V(x, 0, -D.hw - 8), V(x, 0, D.hw + 8), V(x, yAt(x) - 4, D.hw), V(x, yAt(x) - 4, -D.hw)])), M.lambert(0xd9d1bf), group);
    }
    // 取付けの端から地図の道路へつなぐ地上の道(地形の高さに沿わせる。台の外は地形が上がるので高さを拾う)
    const LH = DreamAssets.maps.suez.landH, P0 = ctx.point, gy = (x, z) => Math.max(0.5, LH(P0.x + x, P0.z + z)) + 0.45;
    for (const [x0, x1] of [[388, 660], [-530, -388]]) for (let x = x0; x < x1; x += 10) {
      const y = Math.max(gy(x, 0), gy(x + 10, 0));
      add(box(10.2, y, 18), M.road, group, { x: x + 5, y: y / 2, edges: false });
      if (Math.floor(x / 10) % 2 === 0) add(box(4, 0.1, 0.45), M.lambert(0xf7f8f8), group, { x: x + 5, y: y + 0.05, edges: false });
    }

    // ── 取付けの橋脚(2 本柱と梁)。運河・主塔・西岸の道路(x = -260)は避ける ──
    for (let a = 160; a <= D.end - 40; a += 36) for (const s of [-1, 1]) {
      const x = s * a;
      if (Math.abs(a - D.px) < 18 || Math.abs(x + 260) < 16) continue;
      const h = yAt(x) - 4;
      if (h < 6) continue;
      for (const z of [-6, 6]) add(cyl(2.2, h - 2, 8), M.light, group, { x, y: (h - 2) / 2, z });
      add(box(5, 2, 17), M.light, group, { x, y: h - 1, z: 0 });
    }

    // ── 主塔: オベリスクの H 形。脚は先細りの角柱、先端はピラミディオン。梁は桁の下・上部・頂部 ──
    for (const s of [-1, 1]) {
      const x = s * D.px;
      add(box(34, 5, 52), M.mid, group, { x, y: 2.5 });   // 基礎のフーチング
      for (const zs of [-1, 1]) {
        const z = zs * D.legZ, ring = (y, hx, hz) => [V(x - hx, y, z - hz), V(x + hx, y, z - hz), V(x + hx, y, z + hz), V(x - hx, y, z + hz)];
        add(closedLoft([ring(5, 6.5, 5), ring(D.top, 4.2, 3.2)]), M.body, group);
        add(closedLoft([ring(D.top, 4.2, 3.2), ring(D.top + 18, 0.05, 0.05)]), M.light, group);   // ピラミディオン
        add(box(9.6, 2.2, 7.6), M.mid, group, { x, y: D.top - 1, z, edges: false });              // 頂部の帯
      }
      add(box(9, 7, 2 * D.legZ), M.body, group, { x, y: D.deckY - 9 });          // 桁を受ける梁
      add(box(8, 6, 2 * D.legZ), M.body, group, { x, y: 118 });
      add(box(8.4, 2.4, 2 * D.legZ + 0.4), accent, group, { x, y: 118, edges: false });   // チーム色の帯
      add(box(7, 4, 2 * D.legZ), M.body, group, { x, y: D.top - 8 });
    }

    // ── 斜材: 主塔の上部から桁の縁へ扇形(主塔ごとに 2 面 × 前後 10 本)。線 1 本で描く ──
    const stayPts = [];
    for (const s of [-1, 1]) for (const zs of [-1, 1]) for (let i = 0; i < 10; i++) {
      const ay = 100 + i * 4.6, top = V(s * D.px, ay, zs * (D.legZ - 2));
      for (const dir of [-1, 1]) {
        const dx = s * D.px + dir * (16 + i * 11.5);
        stayPts.push(top, V(dx, yAt(dx) + 0.8, zs * (D.hw - 0.3)));
      }
    }
    const stays = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(stayPts), new THREE.LineBasicMaterial({ color: 0x5f6b77 }));
    group.add(stays);

    // ── 細部: 斜材を太い管でも描き(遠目で読める)、桁の端の定着具、桁の上の街灯と車線の破線、伸縮継手、主塔の溝・点検の昇降路・踊り場・航空障害灯 ──
    const B1 = box(1, 1, 1), stayMat = M.lambert(0x6f7b87), anchorMat = M.mid, lineMat = M.lambert(0xf7f8f8), redLamp = [], lampHeads = [];
    const thin = (p, q, w, m) => { const d = q.clone().sub(p), len = d.length(), o = add(B1, m, group, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2, edges: false }); o.scale.set(w, len, w); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(len)); return o; };
    for (let i = 0; i < stayPts.length; i += 2) {
      thin(stayPts[i], stayPts[i + 1], 0.75, stayMat);
      const b = stayPts[i + 1]; add(box(2.2, 1.4, 1.6), anchorMat, group, { x: b.x, y: b.y + 0.2, z: b.z - Math.sign(b.z) * 0.6, edges: false });
    }
    for (let x = -D.end + 25; x <= D.end - 20; x += 30) for (const zs of [-1, 1]) {   // 街灯(両側の高欄)
      const y = yAt(x) + 1.4;
      thin(V(x, y, zs * (D.hw - 0.3)), V(x, y + 9, zs * (D.hw - 0.3)), 0.32, M.mid);
      thin(V(x, y + 9, zs * (D.hw - 0.3)), V(x, y + 9, zs * (D.hw - 2.6)), 0.25, M.mid);
      lampHeads.push([B1, { x, y: y + 8.7, z: zs * (D.hw - 3.2), sx: 1.6, sy: 0.3, sz: 1.1 }]);
    }
    for (let x = -D.end + 6; x < D.end - 6; x += 9) for (const z of [-4.6, 4.6]) {   // 車線の破線(縦断の勾配に合わせて傾ける)
      const y0 = yAt(x), y1 = yAt(x + 4), o = add(B1, lineMat, group, { x: x + 2, y: (y0 + y1) / 2 + 0.2, z, rz: Math.atan2(y1 - y0, 4), edges: false }); o.scale.set(4, 0.1, 0.4);
    }
    for (const x of [-D.px, D.px, -D.end + 2, D.end - 2]) add(box(0.8, 0.12, 2 * D.hw - 1.6), M.dark, group, { x, y: yAt(x) + 0.2, edges: false });   // 伸縮継手
    for (const s of [-1, 1]) {
      const x = s * D.px;
      for (const zs of [-1, 1]) {
        const z = zs * D.legZ, hx = (y) => 6.5 + (4.2 - 6.5) * (y - 5) / (D.top - 5), hz = (y) => 5 + (3.2 - 5) * (y - 5) / (D.top - 5);
        for (const f of [-1, 1]) for (const t of [-0.4, 0.4]) {   // 脚の面の縦の溝(オベリスクの刻み)
          thin(V(x + f * (hx(8) + 0.05), 8, z + t * hz(8) * 2), V(x + f * (hx(D.top - 4) + 0.05), D.top - 4, z + t * hz(D.top - 4) * 2), 0.5, M.mid);
          thin(V(x + t * hx(8) * 2, 8, z + f * (hz(8) + 0.05)), V(x + t * hx(D.top - 4) * 2, D.top - 4, z + f * (hz(D.top - 4) + 0.05)), 0.5, M.mid);
        }
        for (const y of [100, 132]) {   // 斜材の定着の踊り場(脚を囲む枠)
          const ex = hx(y) + 1.2, ez = hz(y) + 1.2;
          for (const [px, pz, w, d] of [[0, ez, 2 * ex, 1], [0, -ez, 2 * ex, 1], [ex, 0, 1, 2 * ez], [-ex, 0, 1, 2 * ez]]) add(box(w, 0.6, d), M.light, group, { x: x + px, y, z: z + pz, edges: false });
        }
        redLamp.push([B1, { x, y: D.top + 18.3, z, sx: 1.2, sy: 1.2, sz: 1.2 }]);
      }
      add(box(2.6, 115 - D.deckY - 0.2, 2.6), M.light, group, { x: x + s * 2, y: (D.deckY + 0.2 + 115) / 2, z: -8.6 });   // 点検の昇降路(北の脚の内側、桁の上から上部の梁まで)
      for (const zs of [-1, 1]) redLamp.push([B1, { x, y: 121.6, z: zs * 12, sx: 1, sy: 1, sz: 1 }]);
      for (let k2 = 0; k2 < 3; k2++) add(box(46 - k2 * 4, 1.2, 64 - k2 * 4), M.lambert(0xd9d5cc), group, { x, y: 0.6 + k2 * 1.2, edges: false });   // 基礎の段
    }
    group.add(new THREE.Mesh(U.merge(THREE, redLamp), M.basic(0xd8473a)));
    const deckLamps = new THREE.Mesh(U.merge(THREE, lampHeads), M.lamp); group.add(deckLamps);

    // ── 近未来化: 東の取付けの自動検問ゲート(地上の道路にまたがるセンサーの門型) ──
    for (const z of [-12, 12]) add(box(2.4, 14, 2.4), M.light, group, { x: 600, y: 7, z });
    add(box(3, 3, 27), M.light, group, { x: 600, y: 15.5 });
    add(box(3.1, 1, 27.2), accent, group, { x: 600, y: 13.6, edges: false });
    for (const z of [-7, 0, 7]) { add(box(2.2, 1.6, 2.2), M.dark, group, { x: 599, y: 13, z }); add(box(0.2, 0.9, 1.6), M.glass, group, { x: 597.8, y: 13, z, edges: false }); }
    add(box(10, 6, 8), M.body, group, { x: 612, y: 3, z: -22 });   // 管制の小屋

    // ── 制圧圏の中の地面(西: 展望の公園・保守の基地・駐車場・道の街灯、東: 管理棟・駐車場・変電・資材置き場、両岸: 桁の下の保守の砂利道・水際の並木と柵) ──
    const DS = DreamAssets.maps.siteDress?.(THREE, ctx, group, { seed: 202 });
    let dress = null;
    if (DS) {
      const { block, slab, line, road, parking, fence, wall, lamp, shed, kiosk, transformer, container, blocks, pipes, drum, bench, canopy, tree, treeRow, hedge, kerbRect, C: DC, TOP } = DS;
      for (const sx of [-1, 1]) block.rect(sx * D.px, 0, 46, 64, 0, 2);          // 主塔の基礎
      block.line([[-D.end, 0], [D.end, 0]], 28);                                 // 取付けの高架の下(橋脚)
      block.line([[-260, -500], [-260, 500]], 28); block.line([[-260, 100], [-1200, 300]], 28);   // 地図の道路
      DS.mapRoad([[-260, -500], [-260, 500]]); DS.mapRoad([[-260, 100], [-1200, 300]]);
      block.rect(612, -22, 10, 8);
      // 両岸: 桁の下の保守の砂利道
      for (const [x0, x1] of [[-388, -273], [-247, -94], [94, 388]]) slab((x0 + x1) / 2, 0, x1 - x0, 7, 0, DC.gravel, TOP.gravel);
      // 西: 展望の公園(芝・小径・ヤシ・ベンチ・段の展望台・街灯)
      slab(-196, 95, 76, 106, 0, DC.lawn, TOP.lawn); kerbRect(-196, 95, 76, 106);
      for (const [x, z, w, d] of [[-196, 95, 4, 104], [-196, 70, 74, 4], [-196, 122, 74, 4]]) slab(x, z, w, d, 0, DC.pavers, 0.8);
      for (let i = 0; i < 3; i++) DS.part(DS.B1, DS.MC(DC.concrete), -172, 1.2 + i * 1.4, 56, 24 - i * 5, 1.4, 18 - i * 4, 0, true);   // 段の展望台
      for (const [x, z, w, d] of [[-172, 51, 14, 0.2], [-172, 61, 14, 0.2], [-165, 56, 0.2, 10], [-179, 56, 0.2, 10]]) DS.part(DS.B1, M.dark, x, 5.9, z, w, 0.2, d);
      for (const [x, z] of [[-179, 51], [-165, 51], [-179, 61], [-165, 61]]) DS.part(DS.B1, M.dark, x, 5.3, z, 0.25, 1.4, 0.25);
      for (const [x, z] of [[-222, 52], [-208, 50], [-224, 84], [-206, 104], [-224, 140], [-206, 142], [-178, 140], [-160, 140], [-176, 104], [-160, 88]]) tree(x, z, z > 120 ? "round" : "palm", 0.9, { force: true });
      for (const [x, z, a] of [[-199, 82, Math.PI / 2], [-187, 102, Math.PI / 2], [-210, 116, 0], [-176, 128, 0]]) bench(x, z, a);
      for (const [x, z] of [[-196, 44], [-196, 70], [-196, 122], [-196, 146], [-232, 95], [-160, 95]]) lamp(x, z, 0, 8, true);
      // 西: 保守の基地(砂利の構内、柵と門、作業棟・倉庫、ケーブルのドラム、資材の上屋、柵のブロック、コンテナ)
      slab(-192, -95, 80, 100, 0, DC.gravel, TOP.gravel);
      fence([[-232, -45], [-152, -45], [-152, -145], [-232, -145], [-232, -45]], { gap: [-232, -95, 7] });
      slab(-240, -95, 16, 12, 0, DC.asphalt2);
      shed(-205, -125, 0, 26, 14, 2, DC.white, { tank: true }); shed(-170, -128, 0, 16, 10, 1, DC.white2);
      for (let i = 0; i < 3; i++) drum(-215 + i * 9, -62, 0, 3.4, 2.6);
      canopy(-170, -78, 0, 28, 14, 6); pipes(-174, -78, Math.PI / 2, 4, 22, 0.8, 0x9aa4ad);
      blocks(-200, -95, 0, 4, 1, 2, { w: 6, h: 1.8, d: 2.4, color: DC.white2 });
      container(-224, -72, Math.PI / 2, 0); container(-224, -72, Math.PI / 2, 1);
      lamp(-228, -50, 0, 10); lamp(-156, -140, 0, 10);
      // 西: 道の西の駐車場、待合の上屋、道沿いの街灯
      parking(-318, -62, Math.PI / 2, 6); parking(-318, 62, Math.PI / 2, 6);
      canopy(-280, 26, 0, 10, 5, 4.5); bench(-280, 26, 0);
      for (let z = -242; z <= 250; z += 44) { if (Math.abs(z) < 30 || (z > 88 && z < 136)) continue; lamp(-245, z, -Math.PI / 2); lamp(-275, z, Math.PI / 2); }
      // 東: 管理棟(2 階、前庭、屋上の空中線)、駐車場、芝と木
      slab(230, 116, 56, 44, 0, DC.pavers); kerbRect(230, 116, 56, 44);
      const hb = shed(230, 124, 0, 42, 20, 2, DC.white);
      DS.part(DS.B1, accent, 230, hb - 1.6, 124, 42.4, 0.9, 20.4, 0);
      DS.part(DS.C8, M.dark, 245, hb + 7, 120, 0.4, 14, 0.4); DS.part(DS.B1, M.dark, 245, hb + 12, 120, 5, 0.3, 0.3);
      parking(300, 150, 0, 6);
      slab(180, 230, 70, 60, 0, DC.lawn, TOP.lawn); kerbRect(180, 230, 70, 60);
      for (let i = 0; i < 9; i++) tree(160 + (i % 3) * 20 + (DS.rnd() - 0.5) * 6, 212 + Math.floor(i / 3) * 18 + (DS.rnd() - 0.5) * 6, "round", 0.9, { force: true });
      lamp(205, 92, 0, 10, true); lamp(255, 92, 0, 10, true);
      road([[230, 92], [230, 30]], 9, { dash: false });
      // 東: 変電の囲い、資材置き場(柵のブロック・標識・コンテナ)
      slab(225, -110, 44, 34, 0, DC.gravel, TOP.gravel);
      fence([[203, -93], [247, -93], [247, -127], [203, -127], [203, -93]], { gap: [225, -93, 5] });
      transformer(214, -112, 0); transformer(236, -112, 0); kiosk(225, -122, 0);
      slab(300, -125, 48, 46, 0, DC.gravel, TOP.gravel);
      blocks(292, -135, 0, 4, 2, 2, { w: 6, h: 1.8, d: 2.4, color: DC.white2 });
      for (let i = 0; i < 3; i++) container(314, -142 + i * 0.01, Math.PI / 2, i);
      shed(300, -108, 0, 16, 8, 1, DC.white2, { windows: false });
      // 東の南: 橋の点検のドローンの基地(近未来化。発着場・格納庫・格子の鉄塔)
      slab(160, -225, 34, 34, 0, DC.concrete); kerbRect(160, -225, 34, 34);
      DS.part(new THREE.TorusGeometry(12, 0.6, 6, 32), accent, 160, 0.95, -225, 1, 1, 1, 0, false, Math.PI / 2);
      for (const [w, d, dx] of [[2, 12, -4.5], [2, 12, 4.5], [9, 2, 0]]) DS.part(DS.B1, M.dark, 160 + dx, 0.92, -225, w, 0.12, d);
      shed(160, -256, 0, 22, 14, 1, DC.white, { windows: false });
      DS.part(DS.B1, M.dark, 160, 2.6, -248.9, 18, 4.2, 0.2);
      ctx.k.lattice(group, V(190, 0.5, -248), 30, 3.2, 1.2, 4, 0.4, M.mid); DS.block.circle(190, -248, 5);
      DS.part(DS.B1, M.body, 190, 31.5, -248, 6, 2.4, 2.4, 0, true);
      // 西の北: 配水の施設(地上の円い配水池・ポンプ小屋・柵)
      slab(-190, -232, 70, 56, 0, DC.gravel, TOP.gravel);
      fence([[-225, -204], [-155, -204], [-155, -260], [-225, -260], [-225, -204]], { gap: [-190, -204, 6] });
      DS.part(DS.C12, DS.MC(DC.white), -205, 5, -235, 16, 9, 16, 0, true); DS.part(new THREE.ConeGeometry(16.5, 3.4, 24), DS.MC(DC.roof), -205, 11.2, -235, 1, 1, 1);
      DS.block.circle(-205, -235, 18);
      shed(-170, -238, 0, 14, 10, 1, DC.white2); pipes(-184, -222, 0, 1, 18, 0.9);
      // 両岸: 水際の並木と警備の柵(主塔の基礎はあける)
      for (const sx of [-1, 1]) for (const [z0, z1] of [[-360, -40], [40, 360]]) { treeRow([sx * 96, z0], [sx * 96, z1], 14, "cas", 0.95); fence([[sx * 89, z0], [sx * 89, z1]]); }
      DS.edgeCover({ keep: (x, z) => !(Math.abs(z) < 16 && Math.abs(x) < 450) });
      dress = DS.finish();
    }

    // ── コンテナ船(通航): 船体、甲板のコンテナの列、船橋、煙突 ──
    const ship = new THREE.Group(); group.add(ship);
    const L = 220, Bm = 17, hull = [];
    for (const [z, w, bottom] of [[-L / 2, 0.82, 0.2], [-L / 2 + 14, 1, 0], [L / 2 - 46, 1, 0], [L / 2 - 14, 0.55, 0.4], [L / 2, 0.08, 0.9]]) {
      const hb = Bm * w;
      hull.push([V(-hb, WY - 8 + bottom * 6, z), V(hb, WY - 8 + bottom * 6, z), V(hb, WY + 9, z), V(-hb, WY + 9, z)]);
    }
    add(closedLoft(hull), M.dark, ship);
    add(closedLoft(hull.map((r) => r.map((p) => V(p.x * 0.98, p.y < WY + 2 ? WY + 6 : WY + 9.6, p.z)))), M.body, ship, { edges: false });   // 舷側の上の白い帯
    const boxColors = [0xc9d0d7, 0x9aa5b1, 0x7b8794, 0xb7a99a].map((c) => M.lambert(c));
    const stacks = [[], [], [], []], cr = U.rng(7);
    for (let b = 0; b < 15; b++) {
      const z = -L / 2 + 40 + b * 10.4, rows = 3 + Math.floor(cr() * 4);
      for (let lane = -3; lane <= 3; lane++) {
        const h = rows - (Math.abs(lane) === 3 ? 1 : 0);
        stacks[(b + lane + 7) % 4].push([box(4.4, h * 1.6, 9.6), { x: lane * 4.6, y: WY + 9.6 + (h * 1.6) / 2, z }]);
      }
    }
    stacks.forEach((p, i) => add(U.merge(THREE, p), boxColors[i], ship));
    add(box(28, 16, 9), M.body, ship, { y: WY + 17.6, z: -L / 2 + 22 });   // 船橋
    add(box(30, 2, 10), M.light, ship, { y: WY + 26.6, z: -L / 2 + 22 });
    add(box(28.2, 1.4, 9.2), M.glass, ship, { y: WY + 22, z: -L / 2 + 22, edges: false });
    add(box(6, 9, 6), M.dark, ship, { y: WY + 14, z: -L / 2 + 9 });          // 煙突
    const SHIP = { z0: -1400, z1: 1400, speed: 14 };
    let sz = -300;
    ship.position.z = sz;

    function update(dt) { sz += dt * SHIP.speed; if (sz > SHIP.z1) sz = SHIP.z0; ship.position.z = sz; }
    function setTeam(c) { accent.color.set(c ?? F.P.neutral); }
    function check() {
      return {
        clearance: +(D.deckY - 4 - WY).toFixed(1),                          // 桁下と水面(実物 70 m → 0.6 倍で 42)
        shipTopBelowDeck: +(D.deckY - 4 - (WY + 27.6)).toFixed(1),          // 船橋の屋根と桁の下面
        pylonToCanal: D.px - 6.5 - 80,                                     // 主塔の脚と運河の岸
        pylonsOnLand: [-D.px, D.px].every((x) => !ctx.isWater(x, 0)),
        shipInCanal: Bm < 80,
        dress: dress && { ...dress, ...DS.check() },   // 地面の作り込み(物と草の数、水の中の数)
      };
    }
    U.bake(THREE, group, { dynamic: [ship], live: [accent] });
    return { group, update, setTeam, check };
  });
})();
