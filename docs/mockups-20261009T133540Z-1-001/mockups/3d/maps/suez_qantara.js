// 攻略拠点「北東の駅」(運河の東の新市街と鉄道駅)。縮尺は拠点の決まり(0.6 単位/m)。
// 象徴: 広場の給水塔(コンクリートの柱にきのこ形の水槽。3 倍に誇張して高さ約 100)。副: 駅舎の時計塔(1.5 倍)。
// 部品: 駅舎(長い平屋とアーチの入口・時計塔)、駅前広場(舗装・植え込み・街灯・待合の上屋・駐車場)、ホーム 2 面と上屋・跨線橋、線路 4 本(砕石・枕木・レール)と信号、
//   貨物の倉庫と構内(積み下ろしの台・コンテナ)、南の新市街(5〜6 階建ての集合住宅の街区: 階段室・バルコニー・屋上の機器、1 階の店と日よけ。街路・歩道・街路樹)、給水塔の公園。
// 近未来化: 貨物倉庫の屋上のドローン発着場(3 か所)。動きなし。省略: 列車・貨車・車両・人。
// 制圧圏の中の地形の高さは 0.5。面はそれより上に置く(舗装 0.85 など。地面の作り込みの共通部品は suez_ferdan.js の DreamAssets.maps.siteDress)。
// 道路(地図の側)は拠点の中心を東西に通る(西は z が少し南へ、東は少し南へ)。建物は道路から離す。
(function () {
  DreamAssets.maps.site("qantara", (THREE, ctx) => {
    const { U, F, M, k } = ctx;
    const { add, box, cyl, V } = k;
    const accent = M.lambert(F.P.neutral);
    const group = new THREE.Group(); group.name = "site-qantara";
    const roadZ = (x) => (x < 0 ? (-x * 100) / 850 : x * 0.05);   // 地図の道路の z(局所)
    const rnd = U.rng(31);
    const DS = DreamAssets.maps.siteDress?.(THREE, ctx, group, { seed: 1031 });
    const B1 = box(1, 1, 1);
    const thin = (p, q, w, m) => { const d = q.clone().sub(p), len = d.length(), o = add(B1, m, group, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2, edges: false }); o.scale.set(w, len, w); o.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(len)); return o; };
    const redLamp = [];

    // ── 駅舎: 長い平屋、アーチの入口、時計塔、屋根の帯 ──
    add(box(150, 10, 26), M.body, group, { y: 5, z: -78 });
    add(box(151, 2, 27), accent, group, { y: 9, z: -78, edges: false });
    add(box(152, 1.2, 28), M.light, group, { y: 10.6, z: -78 });
    for (let i = -6; i <= 6; i++) add(box(6, 4, 0.4), M.glass, group, { x: i * 10.5, y: 5, z: -64.8, edges: false });   // 窓
    for (let i = -6; i <= 6; i++) add(box(6, 4, 0.4), M.glass, group, { x: i * 10.5, y: 5, z: -91.2, edges: false });   // ホーム側の窓
    // 入口のアーチ(3 連)
    for (const x of [-12, 0, 12]) { add(box(9, 12, 4), M.light, group, { x, y: 6, z: -63 }); add(box(6, 8, 0.3), M.dark, group, { x, y: 4, z: -60.9, edges: false }); add(cyl(4.5, 4, 12), M.light, group, { x, y: 12, z: -63, rx: Math.PI / 2 }); }
    // 時計塔(1.5 倍): 本体、軒の帯、鐘楼の鎧戸、文字盤、四角錐の屋根と頂の飾り
    add(box(11, 42, 11), M.body, group, { x: -62, y: 21, z: -70 });
    for (const y of [14, 27]) add(box(11.8, 0.8, 11.8), M.light, group, { x: -62, y, z: -70, edges: false });
    add(box(12.4, 7, 12.4), M.light, group, { x: -62, y: 38, z: -70 });
    for (const [dx, dz, ry] of [[0, 6.3, 0], [0, -6.3, 0], [6.3, 0, Math.PI / 2], [-6.3, 0, Math.PI / 2]]) add(cyl(2.6, 0.3, 16), M.dark, group, ry ? { x: -62 + dx, y: 38, z: -70 + dz, rz: Math.PI / 2, edges: false } : { x: -62 + dx, y: 38, z: -70 + dz, rx: Math.PI / 2, edges: false });   // 時計の文字盤
    for (const [dx, dz, w, d] of [[0, 5.65, 7, 0.3], [0, -5.65, 7, 0.3], [5.65, 0, 0.3, 7], [-5.65, 0, 0.3, 7]]) for (let i = 0; i < 4; i++) add(box(w, 0.4, d), M.dark, group, { x: -62 + dx, y: 31 + i * 1.2, z: -70 + dz, edges: false });   // 鐘楼の鎧戸
    add(new THREE.ConeGeometry(8.5, 9, 4), M.mid, group, { x: -62, y: 46, z: -70, ry: Math.PI / 4 });
    thin(V(-62, 50.5, -70), V(-62, 56, -70), 0.4, M.dark);

    // ── ホーム 2 面と上屋、線路 4 本(砕石・枕木・レール)、車止め、信号 ──
    const TRACKS = [-104, -118, -140, -154], X0 = -250, X1 = 320;
    const sleepers = [];
    for (const z of TRACKS) {
      add(box(X1 - X0, 0.8, 7), M.mid, group, { x: (X0 + X1) / 2, y: 0.4, z, edges: false });   // 砕石(上端 0.8)
      for (const dz of [-1.5, 1.5]) add(box(X1 - X0, 0.5, 0.5), M.rail, group, { x: (X0 + X1) / 2, y: 1.15, z: z + dz, edges: false });
      for (let x = X0 + 1.5; x < X1; x += 2.6) sleepers.push([B1, { x, y: 0.88, z, sx: 1.1, sy: 0.18, sz: 5 }]);
      add(box(3, 3, 6), M.dark, group, { x: X0 + 1.5, y: 1.5, z });
      for (const [x, s] of [[X0 + 14, 1], [X1 - 14, -1]]) { thin(V(x, 0.8, z + 4.2), V(x, 9, z + 4.2), 0.35, M.dark); add(box(1.4, 2.6, 1.4), M.dark, group, { x, y: 9.6, z: z + 4.2, edges: false }); add(box(0.8, 0.8, 0.2), s > 0 ? M.green : M.red, group, { x, y: 10, z: z + 4.95, edges: false }); }
    }
    add(U.merge(THREE, sleepers), M.lambert(0x6f6a62), group, { edges: false });
    for (const z of [-111, -147]) {
      add(box(200, 1.4, 8), M.light, group, { x: 0, y: 0.7, z });
      for (const s of [-1, 1]) add(box(200, 0.1, 0.5), M.lambert(0xf7f8f8), group, { x: 0, y: 1.45, z: z + s * 3.6, edges: false });   // ホームの縁の白線
      for (let x = -90; x <= 90; x += 20) add(cyl(0.6, 7, 6), M.mid, group, { x, y: 4.9, z });
      add(box(196, 0.8, 10), M.body, group, { x: 0, y: 8.8, z });
      for (let x = -80; x <= 80; x += 32) { add(box(4, 0.4, 1.1), M.lambert(0xa48d78), group, { x: x + 10, y: 2.4, z, edges: false }); }   // ベンチ
    }
    add(box(4, 1.4, 26), M.light, group, { x: 104, y: 0.7, z: -129 });   // ホームをつなぐ構内踏切の踏み板
    // 跨線橋: 駅舎の裏・2 面のホームの階段塔と、窓の帯のある渡り廊下(高さ 12)
    for (const z of [-96, -111, -147]) { add(box(7, 15, 6), M.body, group, { x: 40, y: 7.5 + (z === -96 ? 0 : 1.4), z }); add(box(7.2, 1.6, 6.2), M.glass, group, { x: 40, y: 11 + (z === -96 ? 0 : 1.4), z, edges: false }); }
    add(box(6, 4.4, 54), M.body, group, { x: 40, y: 15.6, z: -121.5 });
    add(box(6.2, 1.6, 52), M.glass, group, { x: 40, y: 15.8, z: -121.5, edges: false });
    add(box(6.6, 0.5, 55), M.light, group, { x: 40, y: 18, z: -121.5 });

    // ── 貨物の倉庫(屋上にドローン発着場)、積み下ろしの台、構内の舗装、コンテナ ──
    add(box(90, 14, 32), M.light, group, { x: 200, y: 7, z: -195 });
    add(box(91, 1, 33), M.mid, group, { x: 200, y: 14.5, z: -195 });
    for (const x of [170, 200, 230]) {
      add(cyl(9, 0.5, 20), M.dark, group, { x, y: 15.25, z: -195, edges: false });
      add(cyl(7.5, 0.6, 20), accent, group, { x, y: 15.3, z: -195, edges: false });
      add(box(1.2, 0.7, 7), M.body, group, { x: x - 2.2, y: 15.4, z: -195, edges: false }); add(box(1.2, 0.7, 7), M.body, group, { x: x + 2.2, y: 15.4, z: -195, edges: false }); add(box(3.2, 0.7, 1.2), M.body, group, { x, y: 15.4, z: -195, edges: false });
    }
    for (let i = 0; i < 4; i++) add(box(10, 9, 1), M.dark, group, { x: 170 + i * 20, y: 4.5, z: -178.6, edges: false });   // 搬入口
    add(box(84, 1.6, 4), M.mid, group, { x: 200, y: 0.8, z: -176.6 });   // 積み下ろしの台

    // ── 給水塔(象徴): 太い柱(縦の溝)、きのこ形の水槽、チーム色の帯、上の露台と手すり、柱の梯子の籠、頂の航空障害灯 ──
    const WT = V(150, 0, 105);
    add(cyl(9, 4, 16), M.light, group, { x: WT.x, y: 2, z: WT.z });
    add(new THREE.CylinderGeometry(5, 7, 66, 16), M.body, group, { x: WT.x, y: 37, z: WT.z });
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; thin(V(WT.x + Math.cos(a) * 7.05, 4, WT.z + Math.sin(a) * 7.05), V(WT.x + Math.cos(a) * 5.05, 70, WT.z + Math.sin(a) * 5.05), 0.6, M.light); }
    const bowl = new THREE.LatheGeometry([[5, 0], [14, 7], [24, 16], [25, 24], [24.4, 27], [0.1, 27]].map(([r, y]) => new THREE.Vector2(r, y)), 24);
    add(bowl, M.body, group, { x: WT.x, y: 68, z: WT.z });
    add(new THREE.CylinderGeometry(25.3, 25.3, 3, 24), accent, group, { x: WT.x, y: 88, z: WT.z, edges: false });
    add(new THREE.CylinderGeometry(9, 9, 4, 12), M.light, group, { x: WT.x, y: 97, z: WT.z });
    add(cyl(0.4, 10, 5), M.dark, group, { x: WT.x, y: 104, z: WT.z });
    add(new THREE.TorusGeometry(23.6, 0.25, 4, 48).rotateX(Math.PI / 2), M.dark, group, { x: WT.x, y: 96.6, z: WT.z, edges: false });   // 上の手すり
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; add(box(0.25, 1.6, 0.25), M.dark, group, { x: WT.x + Math.cos(a) * 23.6, y: 95.8, z: WT.z + Math.sin(a) * 23.6, edges: false }); }
    { const lx = WT.x + 7.6; thin(V(lx, 4, WT.z - 0.9), V(lx - 2, 68, WT.z - 0.9), 0.25, M.dark); thin(V(lx, 4, WT.z + 0.9), V(lx - 2, 68, WT.z + 0.9), 0.25, M.dark); for (let y = 10; y < 66; y += 4) add(new THREE.TorusGeometry(1.4, 0.12, 4, 10).rotateX(Math.PI / 2), M.dark, group, { x: lx - 2 * ((y - 4) / 64) + 0.9, y, z: WT.z, edges: false }); }
    redLamp.push([B1, { x: WT.x, y: 109.4, z: WT.z, sx: 1.1, sy: 1.1, sz: 1.1 }]);

    // ── 新市街: 街路の格子と 5〜6 階建ての集合住宅(窓の帯・屋上の水槽) ──
    const STREETS_Z = [70, 160, 240], STREETS_X = [-180, -60, 60];
    const blocks = [], bands = [], tanks = [], extras = [], balcs = [], shops = [], awnings = [];
    for (let bx = -230; bx <= 230; bx += 40) for (let bz = 40; bz <= 270; bz += 34) {
      if (Math.hypot(bx - WT.x, bz - WT.z) < 48) continue;
      if (STREETS_Z.some((z) => Math.abs(bz - z) < 14) || STREETS_X.some((x) => Math.abs(bx - x) < 22)) continue;
      if (Math.hypot(bx, bz) > 300 || Math.abs(bz - roadZ(bx)) < 30) continue;
      if (Math.hypot(bx - ctx.point.r * 0.72, bz - ctx.point.r * 0.52) < 30) continue;   // 地図の旗竿の場所はあける
      const h = 15 + Math.floor(rnd() * 3) * 3, w = 28, d = 18;
      blocks.push([box(w, h, d), { x: bx, y: h / 2, z: bz }]);
      for (let f = 1; f * 3 < h - 1; f++) bands.push([box(w + 0.2, 0.9, d + 0.2), { x: bx, y: f * 3 + 0.6, z: bz }]);
      tanks.push([box(4, 2.4, 4), { x: bx + (rnd() - 0.5) * 16, y: h + 1.2, z: bz + (rnd() - 0.5) * 8 }]);
      extras.push([box(5, 3.4, 5), { x: bx - 9, y: h + 1.7, z: bz - 4 }]);                                // 屋上の階段室
      for (let n = 0; n < 3; n++) extras.push([box(1.8, 1.2, 1.4), { x: bx + 2 + n * 3, y: h + 0.6, z: bz + 5 }]);   // 空調の室外機
      for (let f = 1; f * 3 < h - 2; f++) for (const x of [-9, 0, 9]) balcs.push([box(5, 0.4, 1.6), { x: bx + x, y: f * 3 + 0.2, z: bz + d / 2 + 0.8 }]);   // 南面のバルコニー
      if (Math.abs(bz - 40) < 1 || STREETS_Z.some((z) => Math.abs(bz - z) < 20)) {   // 街路に面した 1 階の店(暗い帯と日よけ)
        const fz = STREETS_Z.some((z) => bz < z && z - bz < 20) ? 1 : -1;
        shops.push([box(w + 0.3, 2.6, 0.3), { x: bx, y: 1.8, z: bz + fz * (d / 2 + 0.05) }]);
        awnings.push([box(w - 2, 0.3, 2.2), { x: bx, y: 3.4, z: bz + fz * (d / 2 + 1.1) }]);
      }
      DS?.block.rect(bx, bz, w, d, 0, 2);
    }
    add(U.merge(THREE, blocks), M.body, group);
    add(U.merge(THREE, bands), M.glass, group, { edges: false });
    add(U.merge(THREE, tanks), M.mid, group, { edges: false });
    add(U.merge(THREE, extras), M.light, group, { edges: false });
    add(U.merge(THREE, balcs), M.light, group, { edges: false });
    if (shops.length) { add(U.merge(THREE, shops), M.dark, group, { edges: false }); add(U.merge(THREE, awnings), M.lambert(0xcdbba2), group, { edges: false }); }

    // ── 地面の作り込み(街路・歩道・街路樹、駅前広場、給水塔の公園、貨物の構内、縁の草と石) ──
    let dress = null;
    if (DS) {
      const { block, slab, line, road, parking, fence, wall, lamp, shed, kiosk, transformer, container, bench, canopy, tree, treeRow, hedge, kerbRect, C: DC, TOP } = DS;
      block.rect(0, -78, 152, 28); block.rect(-62, -70, 12, 12); block.rect(35, -128, (X1 - X0), 64, 0, 0); block.rect(200, -195, 92, 34);
      block.rect(40, -121.5, 8, 56, 0, 1); block.circle(WT.x, WT.z, 12);
      block.line([[-850, 100], [0, 0], [1000, 50]], 28);   // 地図の道路
      DS.mapRoad([[-850, 100], [0, 0], [1000, 50]]);
      // 街路(アスファルト・縁石)、歩道、街路樹、街灯
      const inCity = (x, z) => Math.hypot(x, z) < 292 && z > 36;
      for (const z of STREETS_Z) { const L = 2 * Math.sqrt(Math.max(0, 285 ** 2 - z * z)); if (L < 40) continue; road([[-L / 2, z], [L / 2, z]], 10, { drain: false }); for (const s of [-1, 1]) slab(0, z + s * 8, L, 5, 0, DC.pavers, 0.8); for (let x = -L / 2 + 12; x < L / 2 - 8; x += 18) { if (STREETS_X.some((sx) => Math.abs(x - sx) < 10)) continue; tree(x, z + 8.5, "round", 0.6); tree(x + 9, z - 8.5, "round", 0.6); } for (let x = -L / 2 + 20; x < L / 2 - 10; x += 36) lamp(x, z - 9.5, 0, 9); }
      for (const x of STREETS_X) { const zs = [50, Math.min(262, Math.sqrt(Math.max(0, 285 ** 2 - x * x)))]; if (zs[1] - zs[0] < 30) continue; road([[x, zs[0]], [x, zs[1]]], 10, { drain: false }); for (const s of [-1, 1]) slab(x + s * 8, (zs[0] + zs[1]) / 2, 5, zs[1] - zs[0], 0, DC.pavers, 0.8); for (let z = zs[0] + 10; z < zs[1] - 6; z += 17) { if (STREETS_Z.some((sz) => Math.abs(z - sz) < 10)) continue; tree(x + 8.5, z, "round", 0.6); } }
      // 街区の足元(舗装の庭)
      for (const [, o] of blocks) slab(o.x, o.z, 34, 25, 0, 0xd8dcd6, 0.66);
      // 給水塔の公園: 円い広場(舗装)、芝の輪、木の輪、ベンチ、街灯
      DS.part(DS.C12, DS.MC(0xd9d5cc), WT.x, 0.42, WT.z, 34, 0.84, 34); DS.part(new THREE.CylinderGeometry(46, 46, 0.7, 32), DS.MC(DC.lawn), WT.x, 0.35, WT.z, 1, 1, 1);
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; tree(WT.x + Math.cos(a) * 40, WT.z + Math.sin(a) * 40, i % 3 ? "round" : "palm", 0.75, { force: true }); }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; bench(WT.x + Math.cos(a) * 30, WT.z + Math.sin(a) * 30, -a); }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.8; lamp(WT.x + Math.cos(a) * 33, WT.z + Math.sin(a) * 33, -a + Math.PI / 2, 8, true); }
      // 駅前広場: 舗装(目地の線)、植え込みの木、街灯、待合の上屋、駐車場、タクシーの乗り場の白線
      slab(-30, -40, 240, 46, 0, DC.pavers); kerbRect(-30, -40, 240, 46);
      for (let x = -140; x <= 80; x += 12) line(x, -40, 44, 0.3, 0, TOP.line, 0xeceae4);
      for (let x = -130; x <= 70; x += 24) { DS.part(DS.B1, DS.MC(DC.kerb), x, 1.3, -32, 4, 0.9, 4); tree(x, -32, "round", 0.7, { force: true }); }
      for (let x = -140; x <= 80; x += 40) lamp(x, -52, 0, 10, true);
      canopy(-100, -22, 0, 12, 5, 4.5); canopy(40, -22, 0, 12, 5, 4.5); bench(-100, -22, 0); bench(40, -22, 0);
      for (let i = 0; i < 5; i++) line(-60 + i * 7, -21, 6, 0.4, 0);
      parking(122, -40, 0, 7);
      // 貨物の構内: 舗装、白線、コンテナの山、柵
      slab(200, -168, 100, 16, 0, DC.concrete); kerbRect(200, -168, 100, 16);
      for (let i = 0; i < 6; i++) line(160 + i * 16, -168, 12, 0.4, 0);
      for (let t = 0; t < 3; t++) container(140, -195, 0, t); for (let t = 0; t < 2; t++) container(132, -195, 0, t); container(140, -212, Math.PI / 2, 0);
      fence([[126, -218], [126, -224], [228, -224]]);
      kiosk(250, -170, 0); transformer(110, -170, 0);
      // 駅の西: 線路の脇の継電器の小屋、ケーブルの樋
      shed(-200, -92, 0, 14, 8, 1, DC.white2); kiosk(-180, -93, 0);
      DS.part(DS.B1, M.mid, 35, 0.9, -99.4, X1 - X0, 0.6, 1.2);
      DS.edgeCover({ keep: (x, z) => !(z < -96 && z > -162 && x > X0 - 6 && x < X1 + 6) });
      dress = DS.finish();
    }
    group.add(new THREE.Mesh(U.merge(THREE, redLamp), M.basic(0xd8473a)));

    function setTeam(c) { accent.color.set(c ?? F.P.neutral); }
    function check() {
      return {
        waterTowerTop: 106,
        blocksOffRoad: blocks.every(([, o]) => Math.abs(o.z - roadZ(o.x)) >= 30),
        anyInWater: [[0, 0], [WT.x, WT.z], [X0, -129], [X1, -129], [200, -195]].some(([x, z]) => ctx.isWater(x, z)),
        dress: dress && { ...dress, ...DS.check() },   // 地面の作り込み(物と草の数、水の中の数)
      };
    }
    U.bake(THREE, group, { live: [accent] });
    return { group, setTeam, check };
  });
})();
