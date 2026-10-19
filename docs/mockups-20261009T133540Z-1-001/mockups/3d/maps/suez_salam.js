// スエズ運河マップの拠点 6「エル・サラーム揚水場」。ナイルの水がスエズ運河の下をサイフォンでくぐり、シナイ側に出てくる所。
// 運河の口(新運河の東岸)にサイフォンの出口の頭首工(4 本の管の出口、門型クレーン、操作室)、その東に道路橋、拠点の中心の北に運河をまたぐ揚水機場
// (取水口の 5 門のゲート、背の高いポンプ棟、運河の上をまたいで下流へ下りる吐出管 5 本)、南岸の拠点の中心に地上式の沈砂池 2 槽(かき寄せ機)、変電設備、管理棟、近未来化としてポンプの電源の太陽光発電。
// 建造物は 0.6 単位/m。誇張: ポンプ棟 約 2.5 倍(高さ 50)(2 倍に広げた運河をまたぐため)、吐出管 1.5 倍、頭首工の高さ 1.5 倍。
// 状態: 揚水(ゲートが上がり、吐出口が泡立ち、下流が流れ、かき寄せ機が往復)/ 停止(ゲートが下り、止まる)。切替は 6 秒
// 制圧圏の中(2026-10-19 の改善): 正門と構内の道路・駐車場、弁の置き場(吸込み管 4 本・仕切り弁)、変電設備の細部(防火壁・遮断器・母線)、
//   保守の作業場(工作棟・資材置き場・門型クレーン)、非常用の発電機棟と燃料タンク、職員の住宅 8 戸と運動場、外周の柵、防風林・並木・ヤシ、
//   縁ほど密な地面の小物。ポンプ棟の外壁の割付け(柱形・2 段の窓・ガラリ)、屋根の換気塔、巻上げ台の門型クレーン、東の壁の吊りレール
//
//   ctx は suez.js が渡す(座標は拠点の中心が原点、y = 0 が陸の上面)。site.setState("pumping" | "stopped")
(function () {
  DreamAssets.maps.site("salam", (THREE, ctx) => {
    const { U, F, M, k, WY, BED, point } = ctx;
    const { add, box, cyl, V, tube, beam, closedLoft } = k;
    const accent = M.lambert(F.P.neutral);
    const conc = M.lambert(0xdfe2e4);
    const group = new THREE.Group(); group.name = "site-salam";
    const GY = 0.5;   // 台の地面の実際の高さ(suez.js の地形は水際の斜面を作るとき陸を 0.5 以上にする)。平らな板はこれより上に出す

    // ── エル・サラーム運河の向き。運河に沿った座標系 cg(+x = 下流の東、+z = 南岸、原点 = 拠点の中心の真北の運河の中心線)──
    const ch = ctx.channels.find((c) => c.name === "東の分水路");
    const ux0 = ch.b[0] - ch.a[0], uz0 = ch.b[1] - ch.a[1], ul = Math.hypot(ux0, uz0), ux = ux0 / ul, uz = uz0 / ul;
    const HW = ch.hw;                                   // 運河の半幅
    const zc0 = ch.a[1] + ((0 - ch.a[0]) / ux) * uz;     // x = 0 での中心線の z
    const TH = Math.atan2(-uz, ux);                     // cg の回転(+x を運河の向きへ)
    const cg = new THREE.Group(); cg.position.set(0, 0, zc0); cg.rotation.y = TH; group.add(cg);
    const toLocal = (xp, zp) => [xp * Math.cos(TH) + zp * Math.sin(TH), -xp * Math.sin(TH) + zp * Math.cos(TH) + zc0];   // cg → 拠点の座標
    const mouthX = (ch.a[0] - 0) * ux + (ch.a[1] - zc0) * uz;   // 運河の口(新運河の東岸)の cg の x

    // ── 揚水機場: 運河をまたぐ下部構造、取水口の門柱とゲート、ポンプ棟 ──
    const SUB = { x0: -60, x1: 40, z: 72 };
    add(box(SUB.x1 - SUB.x0, 6 - BED, SUB.z * 2), conc, cg, { x: (SUB.x0 + SUB.x1) / 2, y: (6 + BED) / 2 });
    const BAY = 13, PIER = 2, piersZ = Array.from({ length: 6 }, (_, i) => -37.5 + i * 15);
    for (const z of piersZ) {
      add(box(20, 6 - BED, PIER), conc, cg, { x: -70, y: (6 + BED) / 2, z });       // 門柱(上流へ突き出す)
      add(box(4, 15.4, PIER), conc, cg, { x: -70, y: 6 + 7.7, z });                  // 巻上げ台を支える柱
    }
    add(box(12, 1.2, 80), M.light, cg, { x: -72, y: 22 });                            // 巻上げ台
    for (const z of piersZ.slice(0, 5).map((p) => p + 7.5)) add(box(4, 3, 7), M.mid, cg, { x: -73, y: 24.1, z });   // 巻上げ機
    for (const s of [-1, 1]) add(box(20, 6, 30), conc, cg, { x: -70, y: 3, z: s * 55 });   // 岸側の袖
    // ゲート(5 門。揚水中は上げる)
    const gates = new THREE.Group(); cg.add(gates);
    const GATE_H = 15, GATE_Y = { closed: BED + GATE_H / 2, open: BED + GATE_H / 2 + 18 };
    for (let i = 0; i < 5; i++) {
      const z = -30 + i * 15;
      add(box(1.2, GATE_H, BAY - 0.6), M.steel, gates, { x: -76, z });
      for (const y of [-4, 0, 4]) add(box(1.6, 0.6, BAY - 0.8), M.dark, gates, { x: -76.2, y, z, edges: false });   // 補剛の横桁
    }
    // ポンプ棟(背の高い棟、窓の帯、柱形、屋根の明かり取り、チーム色の帯)
    const HALL = { x0: -58, x1: 30, z: 60, y0: 6, y1: 56 };
    const hx = (HALL.x0 + HALL.x1) / 2, hw = HALL.x1 - HALL.x0;
    add(box(hw, HALL.y1 - HALL.y0, HALL.z * 2), M.body, cg, { x: hx, y: (HALL.y0 + HALL.y1) / 2 });
    // 外壁の割付け: 柱形(長辺 9 本・妻側 11 本)、上下 2 段の窓の帯、柱の間の換気ガラリ(1 つおき)、足元の暗い腰壁
    const louvre = M.lambert(0x7d8790), plinthM = M.lambert(0xc8ced3);
    for (const s of [-1, 1]) {
      const zf = s * (HALL.z + 0.3);
      add(box(hw - 6, 7, 0.6), M.glass, cg, { x: hx, y: 42, z: zf, edges: false });
      add(box(hw - 6, 4, 0.6), M.glass, cg, { x: hx, y: 24, z: zf, edges: false });
      add(box(hw + 0.8, 3, 1.4), plinthM, cg, { x: hx, y: HALL.y0 + 1.5, z: s * (HALL.z + 0.4), edges: false });
      for (let i = 0; i <= 8; i++) {
        const x = HALL.x0 + 2 + (i * (hw - 4)) / 8;
        add(box(2, HALL.y1 - HALL.y0 - 4, 1.2), M.light, cg, { x, y: (HALL.y0 + HALL.y1) / 2 - 2, z: s * (HALL.z + 0.6), edges: false });
        if (i < 8 && i % 2 === 0) for (const y of [31, 32.6, 34.2]) add(box((hw - 4) / 8 - 3, 0.5, 0.9), louvre, cg, { x: x + (hw - 4) / 16, y, z: s * (HALL.z + 0.5), edges: false });
      }
    }
    for (const x of [HALL.x0 - 0.3, HALL.x1 + 0.3]) {   // 妻側(西 = 取水口、東 = 吐出管)
      add(box(0.6, 7, HALL.z * 2 - 6), M.glass, cg, { x, y: 42, edges: false });
      for (let i = 0; i <= 10; i++) add(box(1.2, HALL.y1 - HALL.y0 - 4, 2), M.light, cg, { x: x + Math.sign(x - hx) * 0.3, y: (HALL.y0 + HALL.y1) / 2 - 2, z: -HALL.z + 2 + (i * (HALL.z * 2 - 4)) / 10, edges: false });
    }
    for (const [x, z] of [[HALL.x0, -HALL.z], [HALL.x0, HALL.z], [HALL.x1, -HALL.z], [HALL.x1, HALL.z]]) add(box(0.9, HALL.y1 - HALL.y0, 0.9), M.dark, cg, { x: x + Math.sign(x - hx) * 1.2, y: (HALL.y0 + HALL.y1) / 2, z: z + Math.sign(z) * 1.2, edges: false });   // 隅の竪樋
    for (let i = 0; i < 5; i++) add(cyl(3.9, 1.2, 14).rotateZ(Math.PI / 2), M.light, cg, { x: HALL.x1 + 0.6, y: 14, z: -30 + i * 15 });   // 吐出管の壁の貫通の襟
    add(box(hw + 0.6, 1.8, HALL.z * 2 + 0.6), accent, cg, { x: hx, y: 50, edges: false });
    add(box(hw + 1.2, 1.2, HALL.z * 2 + 1.2), M.light, cg, { x: hx, y: HALL.y1 + 0.6 });
    add(closedLoft([-48, 20].map((x) => [V(x, HALL.y1 + 1.2, -12), V(x, HALL.y1 + 1.2, 12), V(x, HALL.y1 + 6, 6), V(x, HALL.y1 + 6, -6)])), M.light, cg);   // 屋根の明かり取り
    for (const s of [-1, 1]) add(box(68, 2.6, 0.3), M.glass, cg, { x: -14, y: HALL.y1 + 3.6, z: s * 9.1, rx: s * 0.84, edges: false });   // 明かり取りのガラス
    for (let x = -52; x <= 24; x += 12) for (const z of [-42, 42]) {   // 屋根の換気塔
      add(box(3, 2.4, 3), M.mid, cg, { x, y: HALL.y1 + 2.4, z, edges: false });
      add(box(3.8, 0.5, 3.8), M.light, cg, { x, y: HALL.y1 + 3.85, z, edges: false });
    }
    for (const z of [-22, -16, 16, 22]) add(box(6, 2.6, 4), M.light, cg, { x: 22, y: HALL.y1 + 2.5, z });   // 屋上の空調機
    add(box(8, 12, 14), M.light, cg, { x: hx, y: 12, z: HALL.z + 7 });                // 南の入口
    add(box(15, 17, 0.5), M.dark, cg, { x: 12, y: HALL.y0 + 8.5, z: HALL.z + 0.4, edges: false });   // 搬入の巻上げ扉(ポンプの出し入れ)
    add(box(17, 1.4, 4), M.light, cg, { x: 12, y: HALL.y0 + 17.6, z: HALL.z + 2 });                  // 扉の上の庇
    // 取水口の巻上げ台の上のレールと門型クレーン(ゲートと巻上げ機の点検用)
    for (const x of [-76.6, -67.4]) add(box(0.8, 0.6, 80), M.dark, cg, { x, y: 22.9, edges: false });
    for (const z of [-14, -6]) {
      for (const x of [-76.6, -67.4]) add(box(1, 9, 1), M.steel, cg, { x, y: 27.7, z, edges: false });
      add(box(15, 1.6, 1.4), M.steel, cg, { x: -72, y: 32.8, z });
    }
    add(box(3, 2, 9), M.mid, cg, { x: -72, y: 31, z: -10, edges: false });
    add(box(0.3, 3.4, 0.3), M.dark, cg, { x: -72, y: 28.3, z: -10, edges: false });
    // 東の壁の吊りレール(吐出管の弁の点検用。腕木で壁から出す)
    add(box(1, 1.4, 108), M.steel, cg, { x: HALL.x1 + 7, y: 31, edges: false });
    for (let z = -50; z <= 50; z += 20) add(box(7, 1, 1), M.steel, cg, { x: HALL.x1 + 3.5, y: 31.8, z, edges: false });
    add(box(2.4, 2.2, 3), M.mid, cg, { x: HALL.x1 + 7, y: 29.2, z: 15, edges: false });
    // 吐出管(5 本): 棟の東の壁から出て、運河の上で山越しになり、下流の水へ下りる
    const PIPE_R = 3;
    for (let i = 0; i < 5; i++) {
      const z = -30 + i * 15;
      const pts = [V(HALL.x1, 14, z), V(42, 14, z), V(52, 23, z), V(64, 23, z), V(76, 2, z), V(80, WY - 4, z)];
      for (let j = 0; j < pts.length - 1; j++) tube(cg, pts[j], pts[j + 1], PIPE_R, M.steel);
      add(box(4, 3, 8), M.mid, cg, { x: 76, y: 2, z, edges: false });   // 吐出口の継手(水面の上)
    }
    // 吐出管を支える門型(脚は岸の上)
    for (const s of [-1, 1]) add(box(4, 20, 4), conc, cg, { x: 58, y: 10, z: s * 46 });
    add(box(6, 2, 96), conc, cg, { x: 58, y: 18.5, z: 0 });
    // 吐出口の泡(揚水中だけ。透明で焼き込みの外)
    const foamMat = M.basic(0xffffff, { transparent: true, opacity: 0, depthWrite: false });
    const foamParts = [];
    for (let i = 0; i < 5; i++) foamParts.push([new THREE.CircleGeometry(9, 14).rotateX(-Math.PI / 2), { x: 84, y: WY + 0.15, z: -30 + i * 15 }]);
    const foam = new THREE.Mesh(U.merge(THREE, foamParts), foamMat); cg.add(foam);
    // 下流の流れの線(揚水中だけ速く流れる)
    const flowMat = U.waterMaterial(THREE, { opacity: 0.0, repeat: [(2 * HW) / 36 / 1, 220 / 72] });
    const flowG = new THREE.PlaneGeometry(2 * HW - 2, 220); flowG.rotateX(-Math.PI / 2); flowG.rotateY(Math.PI / 2);
    const flow = new THREE.Mesh(flowG, flowMat); flow.position.set(195, WY + 0.08, 0); cg.add(flow);

    // ── サイフォンの出口の頭首工(運河の口): 管 4 本の出口、袖壁、門型クレーン、操作室 ──
    const HX0 = mouthX + 4, HX1 = mouthX + 36;
    add(box(HX1 - HX0, 10 - BED, 140), conc, cg, { x: (HX0 + HX1) / 2, y: (10 + BED) / 2 });
    for (const z of [-27, -9, 9, 27]) {
      add(box(0.8, 12, 14), M.dark, cg, { x: HX1 + 0.3, y: -4, z, edges: false });                         // 管の出口(半分沈む)
      add(box(1.6, 2, 16), M.light, cg, { x: HX1 + 0.5, y: 3, z });                                          // 出口の上の梁
    }
    for (const s of [-1, 1]) add(closedLoft([[HX1, 10], [HX1 + 30, 1]].map(([x, y]) => [V(x, BED, s * 41), V(x, BED, s * 70), V(x, y, s * 70), V(x, y, s * 41)])), conc, cg);   // 袖壁(岸)
    for (const s of [-1, 1]) add(box(3, 24, 3), M.light, cg, { x: (HX0 + HX1) / 2, y: 10 + 12, z: s * 46 });    // 門型クレーン
    add(box(6, 3, 98), M.light, cg, { x: (HX0 + HX1) / 2, y: 35.5 });
    add(box(6, 3, 8), M.mid, cg, { x: (HX0 + HX1) / 2, y: 32.5, z: -12 });
    add(box(18, 10, 16), M.body, cg, { x: (HX0 + HX1) / 2, y: 15, z: 56 });                             // 操作室
    add(box(18.4, 2.2, 16.4), M.glass, cg, { x: (HX0 + HX1) / 2, y: 16, z: 56, edges: false });
    add(box(18.6, 1, 16.6), accent, cg, { x: (HX0 + HX1) / 2, y: 19.6, z: 56, edges: false });
    for (const z of [-60, -36, 36]) add(box(1, 2, 3), M.dark, cg, { x: HX0 - 0.5, y: 6, z, edges: false });  // 新運河側の防舷材

    // ── 道路橋: 地図の道路(南北)が運河を渡る所 ──
    const rd = { a: [600 - point.x, -700 - point.z], b: [640 - point.x, 600 - point.z] };   // 地図の東岸の道路(suez.js の ROADS)のうち分水路を渡る区間
    const rdx = rd.b[0] - rd.a[0], rdz = rd.b[1] - rd.a[1];
    // 道路と運河の中心線の交点
    const den = rdx * uz - rdz * ux, tr = ((ch.a[0] - rd.a[0]) * uz - (ch.a[1] - rd.a[1]) * ux) / den;
    const BX = rd.a[0] + tr * rdx, BZ = rd.a[1] + tr * rdz;
    const bg = new THREE.Group(); bg.position.set(BX, 0, BZ); bg.rotation.y = Math.atan2(rdx, rdz); group.add(bg);
    const DECK = { half: 62, w: 26 };
    add(box(DECK.w, 2, DECK.half * 2), M.light, bg, { y: 1.6 });
    for (const s of [-1, 1]) {
      add(box(0.6, 1.4, DECK.half * 2), M.dark, bg, { x: s * (DECK.w / 2 - 0.3), y: 3.3, edges: false });   // 欄干
      add(box(DECK.w, 1.4, 18), M.mid, bg, { y: 0.9, z: s * (DECK.half + 8), rx: s * 0.1 });                 // 取付けの斜路
      add(box(DECK.w + 4, 6, 6), conc, bg, { y: -2.4, z: s * (DECK.half - 3) });                              // 橋台
    }
    for (const z of [-22, 22]) add(box(18, 0.6 - BED, 3), conc, bg, { y: (0.6 + BED) / 2, z });             // 橋脚(水中)

    // ── 南岸: 地上式の沈砂池 2 槽(壁・水・越流壁)とかき寄せ機、管理棟、変電設備 ──
    const basinMat = U.waterMaterial(THREE, { opacity: 0.42, repeat: [1, 1] }); basinMat.side = THREE.DoubleSide;
    const scrapers = new THREE.Group(); cg.add(scrapers);
    const BASINS = [{ z0: 150, z1: 210 }, { z0: 222, z1: 282 }], BX0 = -200, BX1 = 40;
    for (const b of BASINS) {
      const zc = (b.z0 + b.z1) / 2, w = b.z1 - b.z0;
      add(box(BX1 - BX0, 5, 2), conc, cg, { x: (BX0 + BX1) / 2, y: 2.5, z: b.z0 });
      add(box(BX1 - BX0, 5, 2), conc, cg, { x: (BX0 + BX1) / 2, y: 2.5, z: b.z1 });
      add(box(2, 5, w + 2), conc, cg, { x: BX0, y: 2.5, z: zc });
      add(box(2, 5, w + 2), conc, cg, { x: BX1, y: 2.5, z: zc });
      add(box(BX1 - BX0 - 2, 0.3, w - 2), M.mid, cg, { x: (BX0 + BX1) / 2, y: 0.15, z: zc, edges: false });
      const wp = new THREE.Mesh(new THREE.PlaneGeometry(BX1 - BX0 - 2, w - 2).rotateX(-Math.PI / 2), basinMat); wp.position.set((BX0 + BX1) / 2, 4, zc); cg.add(wp);
      add(box(1.2, 1, w - 2), M.light, cg, { x: BX1 - 12, y: 4.2, z: zc, edges: false });          // 越流壁
      // かき寄せ機(槽をまたぐ橋。両端の車輪の台と手すり)
      const sg = new THREE.Group(); sg.position.set(BX0 + 20, 0, zc); scrapers.add(sg);
      add(box(4, 1.2, w + 4), M.light, sg, { y: 6.4 });
      for (const s of [-1, 1]) add(box(5, 2, 3), M.mid, sg, { y: 6.1, z: s * (w / 2 + 1) });
      add(box(0.3, 1.2, w + 4), M.dark, sg, { x: 1.8, y: 7.6, edges: false });
      add(box(3, 2.4, 3), M.mid, sg, { y: 8.2, z: -w / 2 + 2 });
    }
    tube(cg, V(-180, 2, 40), V(-180, 2, 149), 2.2, M.steel);                                        // 運河から沈砂池への取水管
    tube(cg, V(-40, 1.5, 149), V(-40, 1.5, 74), 2.2, M.steel);                                       // 沈砂池からポンプ棟へ
    // 変電設備(柵、変圧器 3、門型の鉄構、制御室)
    const YD = { x0: 50, x1: 135, z0: 82, z1: 150 };
    add(box(YD.x1 - YD.x0, 0.4, YD.z1 - YD.z0), M.light, cg, { x: (YD.x0 + YD.x1) / 2, y: GY + 0.1, z: (YD.z0 + YD.z1) / 2, edges: false });
    for (let i = 0; i < 3; i++) {
      const x = 62 + i * 18, z = 104;
      add(box(10, 9, 7), M.mid, cg, { x, y: 4.9, z });
      for (const s of [-1, 1]) add(box(0.4, 7, 6), M.dark, cg, { x: x + s * 5.6, y: 4.6, z, edges: false });
      for (const e of [-3, 0, 3]) add(cyl(0.5, 3.4, 6), M.light, cg, { x: x + e, y: 11, z });
    }
    for (const x of [58, 102, 128]) { add(box(1.2, 18, 1.2), M.mid, cg, { x, y: 9, z: 126 }); add(box(1.2, 18, 1.2), M.mid, cg, { x, y: 9, z: 140 }); }
    add(box(72, 1.2, 1.2), M.mid, cg, { x: 93, y: 18, z: 126 }); add(box(72, 1.2, 1.2), M.mid, cg, { x: 93, y: 18, z: 140 });
    add(box(24, 9, 14), M.body, cg, { x: 120, y: 4.5, z: 100 });
    for (const [x0, z0, x1, z1] of [[YD.x0, YD.z0, YD.x1, YD.z0], [YD.x0, YD.z1, YD.x1, YD.z1], [YD.x0, YD.z0, YD.x0, YD.z1], [YD.x1, YD.z0, YD.x1, YD.z1]])
      add(box(Math.max(0.3, Math.abs(x1 - x0)), 2.4, Math.max(0.3, Math.abs(z1 - z0))), M.dark, cg, { x: (x0 + x1) / 2, y: 1.2, z: (z0 + z1) / 2, edges: false });
    // 管理棟(拠点の中心のそば)と貯水槽の塔
    const [ax, az] = [130, 70];
    add(box(56, 14, 26), M.body, group, { x: ax, y: 7, z: az });
    add(box(56.4, 2, 26.4), M.glass, group, { x: ax, y: 9, z: az, edges: false });
    add(box(56.8, 1.2, 26.8), accent, group, { x: ax, y: 13, z: az, edges: false });
    add(box(30, 0.3, 24), M.mid, group, { x: ax + 50, y: GY + 0.15, z: az + 6, edges: false });
    add(cyl(1.2, 26, 8), M.mid, group, { x: ax - 46, y: 13, z: az - 4 });
    add(new THREE.CylinderGeometry(8, 6, 8, 12), M.light, group, { x: ax - 46, y: 30, z: az - 4 });

    // ── 近未来化: ポンプの電源の太陽光発電(拠点の南西。傾けたパネルの列)──
    const pv = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 3; c++) {
      const x = -215 + c * 60, z = 95 + r * 18;
      pv.push([box(52, 0.6, 9), { x, y: 3.2, z, rx: -0.45 }]);
      for (const e of [-20, 0, 20]) pv.push([box(0.8, 3, 0.8), { x: x + e, y: 1.5, z: z + 2 }]);
    }
    add(U.merge(THREE, pv), M.dark, group, { edges: false });
    add(box(14, 4, 8), M.body, group, { x: -60, y: 2, z: 180 });   // 変換器の小屋

    // ── 制圧圏の中の作り込み: 弁の置き場、変電設備の細部、保守の作業場、職員の住宅、門と構内の道路、柵、植栽、地面の小物 ──
    // 置く場所は占有の箱(拠点の座標の中心・半幅・回転)で確かめ、水路・道路・既存の建造物を避ける。地面は高さ 0 の台(水際から 12 以上離す)
    const rnd = U.rng(6060);
    const occ = [];
    const occupy = (x, z, hx, hz, a = 0) => occ.push({ x, z, hx, hz, c: Math.cos(a), s: Math.sin(a) });
    const occupyCg = (x0, x1, z0, z1) => { const [lx, lz] = toLocal((x0 + x1) / 2, (z0 + z1) / 2); occupy(lx, lz, (x1 - x0) / 2, (z1 - z0) / 2, TH); };
    const occupySeg = ([ax, az], [bx, bz], hw) => { const l = Math.hypot(bx - ax, bz - az), ex = (bx - ax) / l, ez = (bz - az) / l; occupy((ax + bx) / 2, (az + bz) / 2, l / 2, hw, Math.atan2(-ez, ex)); };
    const isFree = (x, z, pad = 0) => !occ.some((o) => { const dx = x - o.x, dz = z - o.z; return Math.abs(dx * o.c - dz * o.s) < o.hx + pad && Math.abs(dx * o.s + dz * o.c) < o.hz + pad; });
    const dry = (x, z, m = 12) => ![[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]].some(([a, b]) => ctx.isWater(x + a, z + b));
    occupyCg(-84, 88, -78, 78); occupyCg(-203, 43, 146, 286); occupyCg(-184, -176, 36, 152); occupyCg(-44, -36, 72, 152); occupyCg(48, 137, 80, 152);   // 既存: ポンプ棟・沈砂池・管・変電設備
    occupy(130, 70, 31, 16); occupy(180, 76, 17, 14); occupy(84, 66, 10, 10); occupy(-156, 158, 92, 72); occupy(-60, 180, 9, 6);                         // 既存: 管理棟・駐車場・塔・太陽光・小屋
    // 地図の旗竿(suez.js と同じ探し方)と、拠点の西を通る地図の道路
    const flagAt = (() => { const r = point.r; for (let a = 0.62; a < 0.62 + Math.PI * 2; a += 0.15) { const x = Math.cos(a) * r * 0.85, z = Math.sin(a) * r * 0.85; if (![0, 25, -25].some((d) => ctx.isWater(x + d, z) || ctx.isWater(x, z + d))) return [x, z]; } return [r * 0.72, r * 0.52]; })();
    occupy(flagAt[0] + 12, flagAt[1], 28, 12);
    for (const [a, b] of [[[600, -700], [640, 600]], [[640, 600], [700, 1450]]]) occupySeg([a[0] - point.x, a[1] - point.z], [b[0] - point.x, b[1] - point.z], 16);
    const kerbM = M.lambert(0xe9ecee), gravel = M.lambert(0xd3d5d0), lineM = M.lambert(0xf7f8f8), courtM = M.lambert(0xc5d0b6), bundM = M.lambert(0xd8dadb);
    const HUT = [0xfbfcfd, 0xf3f1ec, 0xeef0f2].map((c) => M.lambert(c));
    // 構内の道路(舗装・縁石。曲がり角は円で埋める)
    const road = (pts, w, mat = M.road ?? M.mid) => {
      const parts = [], kerbs = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
        parts.push([box(w, 0.3, l), { x: (ax + bx) / 2, y: GY + 0.15, z: (az + bz) / 2, ry }]);
        for (const s of [-1, 1]) kerbs.push([box(1, 0.6, l), { x: (ax + bx) / 2 + Math.cos(ry) * s * (w / 2 + 0.5), y: GY + 0.3, z: (az + bz) / 2 - Math.sin(ry) * s * (w / 2 + 0.5), ry }]);
        occupySeg(pts[i], pts[i + 1], w / 2 + 2);
      }
      for (const [x, z] of pts.slice(1, -1)) parts.push([new THREE.CylinderGeometry(w / 2, w / 2, 0.3, 16), { x, y: GY + 0.15, z }]);
      add(U.merge(THREE, parts), mat, group, { edges: false });
      add(U.merge(THREE, kerbs), kerbM, group, { edges: false });
    };
    road([[-372, -12], [-205, -12], [-168, 82], [60, 82]], 14);   // 正門から管理棟の前へ
    road([[72, 40], [175, 40], [230, 40], [230, -34]], 12);       // 作業場へ
    road([[175, 40], [175, -160], [160, -163]], 10);              // 変電設備へ
    road([[100, 89], [100, 112]], 8);                             // 住宅の門へ
    add(box(30, 0.3, 42), M.road ?? M.mid, group, { x: 57, y: GY + 0.15, z: 53, edges: false }); occupy(57, 53, 16, 22);   // 管理棟の前庭
    for (let x = -168; x < 56; x += 18) add(box(6, 0.06, 0.6), lineM, group, { x, y: GY + 0.33, z: 82, edges: false });     // 中心線
    // 正門: 守衛所と遮断機
    add(box(10, 6, 8), M.body, group, { x: -298, y: 3, z: 7 });
    add(box(10.6, 1.6, 8.6), M.glass, group, { x: -298, y: 3.6, z: 7, edges: false });
    add(box(11, 0.6, 9), accent, group, { x: -298, y: 6.3, z: 7, edges: false });
    add(box(0.8, 3, 0.8), M.dark, group, { x: -288, y: 1.5, z: -3, edges: false });
    add(box(0.5, 0.5, 15), lineM, group, { x: -288, y: 2.8, z: -11, edges: false });
    occupy(-298, 7, 7, 6);
    // 来客の駐車場(線だけ。車は置かない)
    add(box(50, 0.3, 40), M.road ?? M.mid, group, { x: -257, y: GY + 0.15, z: 38, edges: false }); occupy(-257, 38, 27, 22);
    for (let i = 0; i <= 8; i++) for (const z of [26, 50]) add(box(0.4, 0.06, 10), lineM, group, { x: -281 + i * 6, y: GY + 0.33, z, edges: false });

    // 弁の置き場(沈砂池 → ポンプ棟): 出口の升、吸込み管 4 本(仕切り弁・フランジ・受け台)、制御の小屋
    occupyCg(-72, 42, 74, 146);
    add(box(110, 0.3, 66), bundM, cg, { x: -15, y: GY + 0.15, z: 109, edges: false });
    add(box(86, 6, 9), conc, cg, { x: -23, y: 3, z: 143.5 });
    for (let x = -60; x <= 14; x += 12) add(box(5, 0.2, 4), M.dark, cg, { x, y: 6.1, z: 143.5, edges: false });   // 升のふた
    for (const x of [-56, -49, 2, 9]) {
      tube(cg, V(x, 2.2, 139), V(x, 2.2, 60.6), 1.5, M.steel);
      for (const z of [128, 90, 66]) add(cyl(2.1, 0.6, 12).rotateX(Math.PI / 2), M.steel, cg, { x, y: 2.2, z, edges: false });
      add(cyl(2.6, 4.4, 12).rotateX(Math.PI / 2), M.mid, cg, { x, y: 2.2, z: 108 });
      add(box(1.4, 3.2, 1.4), M.steel, cg, { x, y: 5.4, z: 108, edges: false });
      add(cyl(1.6, 0.3, 12), M.dark, cg, { x, y: 7.2, z: 108, edges: false });                                      // 弁の手回し車
      for (const z of [120, 96, 78]) add(box(3.6, 1.2, 2), conc, cg, { x, y: 0.9, z, edges: false });
    }
    add(box(8, 6, 7), M.body, cg, { x: 30, y: 3, z: 120 });
    add(box(8.4, 0.6, 7.4), accent, cg, { x: 30, y: 6.3, z: 120, edges: false });
    // 変電設備の細部: 砂利敷き、変圧器の間の防火壁、遮断器、碍子、照明柱、ケーブルの溝、母線(線)
    add(box(YD.x1 - YD.x0 - 4, 0.12, YD.z1 - YD.z0 - 4), gravel, cg, { x: (YD.x0 + YD.x1) / 2, y: GY + 0.3, z: (YD.z0 + YD.z1) / 2, edges: false });
    for (const x of [71, 89]) add(box(0.8, 11, 10), conc, cg, { x, y: 5.5, z: 104 });
    for (const x of [62, 80, 98]) {
      add(box(4, 3, 3), M.steel, cg, { x, y: 1.9, z: 118, edges: false });
      for (const e of [-1.2, 0, 1.2]) add(cyl(0.45, 4.5, 8), M.light, cg, { x: x + e, y: 5.6, z: 118, edges: false });
    }
    for (const x of [66, 76, 86, 96, 112, 122]) for (const z of [126, 140]) add(cyl(0.3, 2.2, 6), M.light, cg, { x, y: 16.4, z, edges: false });
    for (const [x, z] of [[54, 86], [131, 146]]) { add(cyl(0.4, 16, 8), M.mid, cg, { x, y: 8, z, edges: false }); add(box(2.4, 1, 1.4), M.light, cg, { x, y: 16.4, z, edges: false }); }
    add(box(48, 0.2, 2), M.dark, cg, { x: 84, y: GY + 0.3, z: 112, edges: false });
    for (let x = 62; x <= 106; x += 4) add(box(3.4, 0.25, 2.4), M.light, cg, { x, y: GY + 0.45, z: 112, edges: false });
    const busPts = [];
    for (const x of [62, 80, 98]) for (const e of [-3, 0, 3]) busPts.push(x + e, 12.7, 104, x + e, 17.2, 126, x + e, 17.2, 126, x + e, 17.2, 140);
    for (const z of [126, 140]) for (const y of [16.2, 17.2]) busPts.push(57, y, z, 129, y, z);
    const bus = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(busPts, 3)), new THREE.LineBasicMaterial({ color: F.P.dark }));
    cg.add(bus);
    tube(cg, V(50, 1.2, 96), V(28, 1.2, 66), 0.8, M.dark);   // 制御室からポンプ棟への配線の管

    // 保守の作業場: 切妻の工作棟(巻上げ扉 2)、柵の資材置き場(管の山・予備のポンプの胴・護岸ブロック・コンテナ)と天井走行の門型クレーン
    const WS = { x: 219, z: -132, w: 48, d: 22, h: 10 };
    add(box(WS.w, WS.h, WS.d), M.body, group, { x: WS.x, y: WS.h / 2, z: WS.z });
    add(closedLoft([WS.x - WS.w / 2 - 0.6, WS.x + WS.w / 2 + 0.6].map((x) => [V(x, WS.h, WS.z - WS.d / 2 - 0.8), V(x, WS.h, WS.z + WS.d / 2 + 0.8), V(x, WS.h + 5, WS.z)])), M.light, group);
    for (const x of [207, 229]) { add(box(9, 8, 0.4), M.dark, group, { x, y: 4, z: WS.z + WS.d / 2 + 0.2, edges: false }); add(box(10, 0.8, 1), M.mid, group, { x, y: 8.4, z: WS.z + WS.d / 2 + 0.5, edges: false }); }
    add(box(40, 1.6, 0.4), M.glass, group, { x: WS.x, y: 6.4, z: WS.z - WS.d / 2 - 0.2, edges: false });
    for (const x of [205, 219, 233]) add(box(2.4, 1.6, 2.4), M.mid, group, { x, y: WS.h + 4.4, z: WS.z, edges: false });
    occupy(WS.x, WS.z, 26, 13);
    const YDX = [188, 262], YDZ = [-112, -38];
    add(box(YDX[1] - YDX[0], 0.25, YDZ[1] - YDZ[0]), gravel, group, { x: 225, y: GY + 0.13, z: -75, edges: false });
    occupy(225, -75, 39, 39);
    const pipeStack = [];
    for (const [row, n] of [[0, 3], [1, 2], [2, 1]]) for (let i = 0; i < n; i++) pipeStack.push([cyl(1.8, 30, 12).rotateZ(Math.PI / 2), { x: 214, y: 1.9 + row * 3.2, z: -100 + i * 3.8 + row * 1.9 }]);
    add(U.merge(THREE, pipeStack), M.steel, group);
    for (const z of [-102, -90]) add(box(30, 0.6, 1.2), M.dark, group, { x: 214, y: 0.4, z, edges: false });   // 管の下の枕木
    for (const z of [-100, -86, -72]) {   // 予備のポンプの胴(スキッドの上に立てる)
      add(box(9, 1.2, 9), M.dark, group, { x: 248, y: 0.6, z, edges: false });
      add(cyl(3.5, 7, 16), M.mid, group, { x: 248, y: 4.7, z });
      add(cyl(4.2, 0.6, 16), M.steel, group, { x: 248, y: 8.4, z, edges: false });
    }
    const blocks = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) for (let h = 0; h < 2 - (i + j) % 2; h++) blocks.push([box(3, 2, 3), { x: 200 + i * 3.4, y: 1 + h * 2, z: -56 + j * 3.4 }]);
    add(U.merge(THREE, blocks), M.lambert(0xc9ced2), group);
    for (const [x, z] of [[224, -50], [236, -50]]) { add(box(9, 4, 5), M.lambert(0xa48d78), group, { x, y: 2, z }); add(box(8, 0.2, 4), M.dark, group, { x, y: 4.05, z, edges: false }); }
    for (const x of [200, 250]) for (const z of [-104, -60]) add(box(1.2, 11, 1.2), M.steel, group, { x, y: 5.5, z, edges: false });   // 門型クレーンの柱
    for (const z of [-104, -60]) add(box(52, 1.4, 1.4), M.steel, group, { x: 225, y: 11.4, z, edges: false });                          // 走行のレール
    add(box(2.4, 1.8, 46), M.light, group, { x: 214, y: 13, z: -82 });                                                                  // 橋桁
    add(box(3, 2, 3), M.mid, group, { x: 214, y: 11.3, z: -88, edges: false });
    // 柵(資材置き場。南の門は空ける)
    const yardFence = [];
    const fenceRun = (x0, z0, x1, z1, gap) => {
      const l = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(l / 6)), ry = Math.atan2(x1 - x0, z1 - z0);
      for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (gap?.(x, z)) continue; yardFence.push([box(0.4, 3.6, 0.4), { x, y: 1.8, z }]); }
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (gap?.(x, z)) continue; for (const y of [1.2, 3.4]) yardFence.push([box(0.2, 0.2, l / n), { x, y, z, ry }]); }
    };
    fenceRun(YDX[0], YDZ[0], YDX[1], YDZ[0]); fenceRun(YDX[1], YDZ[0], YDX[1], YDZ[1]); fenceRun(YDX[0], YDZ[0], YDX[0], YDZ[1]);
    fenceRun(YDX[0], YDZ[1], YDX[1], YDZ[1], (x) => Math.abs(x - 230) < 8);

    // 非常用の発電機棟(排気筒・放熱器)と燃料タンク(防油堤)
    add(box(30, 10, 16), M.body, group, { x: -245, y: 5, z: -100 });
    add(box(30.4, 2.4, 16.4), louvre, group, { x: -245, y: 6, z: -100, edges: false });
    for (const x of [-252, -238]) add(cyl(1, 8, 10), M.dark, group, { x, y: 14, z: -104, edges: false });
    add(box(6, 4, 8), M.mid, group, { x: -226, y: 2, z: -100 });
    occupy(-243, -100, 19, 10);
    add(cyl(3.2, 14, 16).rotateZ(Math.PI / 2), M.light, group, { x: -205, y: 4.2, z: -128 });
    for (const x of [-210, -200]) add(box(1, 1.6, 6), M.dark, group, { x, y: 0.8, z: -128, edges: false });
    for (const [x, z, w, d] of [[-205, -135, 22, 0.8], [-205, -121, 22, 0.8], [-216, -128, 0.8, 14], [-194, -128, 0.8, 14]]) add(box(w, 1.4, d), bundM, group, { x, y: 0.7, z });
    occupy(-205, -128, 12, 8);

    // 職員の住宅: 塀で囲った敷地に 2 階建ての家 8 戸(屋上の水槽・階段の出口)、ヤシ
    const HC = { x0: 30, x1: 170, z0: 112, z1: 226 };
    const wall = [];
    for (const [x0, z0, x1, z1] of [[HC.x0, HC.z1, HC.x1, HC.z1], [HC.x0, HC.z0, HC.x0, HC.z1], [HC.x1, HC.z0, HC.x1, HC.z1], [HC.x0, HC.z0, 94, HC.z0], [106, HC.z0, HC.x1, HC.z0]])
      wall.push([box(Math.max(0.8, Math.abs(x1 - x0)), 2.4, Math.max(0.8, Math.abs(z1 - z0))), { x: (x0 + x1) / 2, y: 1.2, z: (z0 + z1) / 2 }]);
    add(U.merge(THREE, wall), HUT[1], group);
    occupy((HC.x0 + HC.x1) / 2, (HC.z0 + HC.z1) / 2, (HC.x1 - HC.x0) / 2 + 1, (HC.z1 - HC.z0) / 2 + 1);
    let hn = 0;
    for (const z of [145, 196]) for (const x of [52, 84, 116, 148]) {
      const m = HUT[hn++ % 3], f = z < 170 ? 1 : -1;   // 玄関は敷地の中の通路側
      add(box(14, 4, 10), m, group, { x, y: 2, z });
      add(box(12.4, 4, 8.6), m, group, { x: x - 0.6, y: 6, z: z - f * 0.4 });
      add(box(12.8, 0.8, 9), M.light, group, { x: x - 0.6, y: 8.4, z: z - f * 0.4, edges: false });
      for (const y of [2.6, 6.6]) add(box(9, 1.2, 0.3), M.glass, group, { x, y, z: z + f * (y < 4 ? 5.05 : 4.75), edges: false });
      add(box(2.6, 2.4, 2.6), m, group, { x: x + 3.5, y: 9.6, z: z - f * 1.6 });
      add(cyl(1.1, 1.6, 10), M.light, group, { x: x - 3.5, y: 9.6, z: z - f * 1, edges: false });
      add(box(3, 3, 0.3), M.dark, group, { x: x - 2, y: 1.5, z: z + f * 5.05, edges: false });
    }
    add(box(130, 0.2, 10), gravel, group, { x: 100, y: GY + 0.1, z: 170.5, edges: false });   // 敷地の中の通路
    // 運動場(職員の住宅の西)
    add(box(40, 0.2, 24), courtM, group, { x: -15, y: GY + 0.1, z: 140, edges: false });
    for (const [w, d, x, z] of [[40, 0.4, -15, 128.2], [40, 0.4, -15, 151.8], [0.4, 24, -34.8, 140], [0.4, 24, 4.8, 140], [0.4, 24, -15, 140]]) add(box(w, 0.06, d), lineM, group, { x, y: GY + 0.23, z, edges: false });
    for (const x of [-34, 4]) add(box(0.4, 2.4, 6), M.light, group, { x, y: 1.2, z: 140, edges: false });
    occupy(-15, 140, 23, 15);

    // 外周の柵: 半径 296(太陽光の所だけ外へふくらませる)。道路の所と水際は空ける
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const fenceR = (b) => 296 + 54 * clamp01((b + 1.1) / 0.12) * clamp01((-0.53 - b) / 0.12);
    const fence = [];
    let prev = null;
    for (let b = -Math.PI; b < Math.PI; b += 0.026) {
      const R = fenceR(b), x = R * Math.sin(b), z = R * Math.cos(b), ok = dry(x, z, 10) && isFree(x, z, 1);
      if (ok) fence.push([box(0.5, 4, 0.5), { x, y: 2, z }]);
      if (ok && prev) { const l = Math.hypot(x - prev[0], z - prev[1]), ry = Math.atan2(x - prev[0], z - prev[1]); for (const y of [1.3, 2.6, 3.8]) fence.push([box(0.2, 0.2, l), { x: (x + prev[0]) / 2, y, z: (z + prev[1]) / 2, ry }]); }
      prev = ok ? [x, z] : null;
    }
    add(U.merge(THREE, [...fence, ...yardFence]), M.dark, group, { edges: false });

    // ── 植栽と地面の小物の形(運河地帯の層 suez_deco_zone.js と同じ形と色)。InstancedMesh(頂点色)で置く ──
    const col = (c) => new THREE.Color(c);
    const tint = (g, c) => ({ geo: g.index ? g.toNonIndexed() : g, color: col(c) });
    const blades = (n, h, w, c, lean, seed) => {
      const pos = [], r = U.rng(seed);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.6, ca = Math.cos(a), sa = Math.sin(a), hh = h * (0.7 + r() * 0.5), l = lean * hh; pos.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * l, hh, sa * l); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return { geo: g, color: col(c) };
    };
    const fronds = (n, len, w, h, c, seed) => {   // ヤシの葉: 頂部から外へ垂れる細長い葉
      const pos = [], r = U.rng(seed);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r() * 0.4, ca = Math.cos(a), sa = Math.sin(a), L = len * (0.8 + r() * 0.4), px = -sa * w, pz = ca * w;
        const m = [ca * L * 0.5, h + 0.8, sa * L * 0.5], t = [ca * L, h - 2.4 - r() * 1.4, sa * L];
        pos.push(0, h, 0, m[0] + px, m[1], m[2] + pz, m[0] - px, m[1], m[2] - pz, m[0] + px, m[1], m[2] + pz, t[0], t[1], t[2], m[0] - px, m[1], m[2] - pz);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return { geo: g, color: col(c) };
    };
    const GEO = {
      tuft: U.concat(THREE, [blades(6, 2.8, 0.55, 0xb8bb9c, 0.35, 3)]),
      tuft2: U.concat(THREE, [blades(5, 2.2, 0.5, 0xc6c6a8, 0.45, 7)]),
      scrub: U.concat(THREE, [tint(new THREE.OctahedronGeometry(1, 0).scale(2.6, 1.4, 2.2).translate(0, 0.9, 0), 0xa5ac94), tint(new THREE.OctahedronGeometry(1, 0).scale(1.6, 1.1, 1.5).translate(1.5, 0.8, 0.9), 0x939b84)]),
      stone: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.55, 0.8), 0xcac3b3)]),
      cas: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.45, 0.75, 11, 6).translate(0, 5.5, 0), 0x8a7d6a), tint(new THREE.IcosahedronGeometry(1, 0).scale(3.6, 8, 3.6).translate(0, 14, 0), 0x8f9f84), tint(new THREE.IcosahedronGeometry(1, 0).scale(2.6, 5.4, 2.6).translate(0.5, 20, -0.3), 0x7f9076)]),
      palm: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.45, 0.7, 13, 6).translate(0, 6.5, 0), 0x8a7d6a), fronds(9, 6.5, 0.9, 13, 0x98a888, 5), tint(new THREE.IcosahedronGeometry(0.9, 0).translate(0, 13, 0), 0x7f8a70)]),
    };
    const inst = {};
    const plant = (kind, x, y, z, s = 1) => (inst[kind] ??= []).push([x, y, z, s, rnd() * 6]);
    // 木: 外周の柵の内側の防風林、道路沿いの並木、管理棟と住宅のまわり
    for (let b = -Math.PI; b < Math.PI; b += 0.034) { const R = fenceR(b) - 11, x = R * Math.sin(b), z = R * Math.cos(b); if (dry(x, z, 14) && isFree(x, z, 5)) plant("cas", x, -0.4, z, 0.85 + rnd() * 0.35); }
    for (const [a, b, off] of [[[-150, 82], [44, 82], -13], [[84, 40], [222, 40], 13], [[175, 30], [175, -150], 12]]) {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l;
      for (let t = 0; t <= l; t += 13) { const x = a[0] + ((b[0] - a[0]) * t) / l + nx * off, z = a[1] + ((b[1] - a[1]) * t) / l + nz * off; if (isFree(x, z, 4)) plant("cas", x, -0.4, z, 0.8 + rnd() * 0.25); }
    }
    for (const [x, z] of [[68, 170], [100, 186], [132, 170], [36, 128], [164, 128], [36, 214], [164, 214], [100, 128], [-40, 112], [10, 112], [-40, 168], [10, 168]]) plant("palm", x, -0.3, z, 0.9 + rnd() * 0.3);
    for (let i = 0; i < 9; i++) { const x = 110 + rnd() * 80, z = 92 + rnd() * 14; if (isFree(x, z, 2)) plant("palm", x, -0.3, z, 0.8 + rnd() * 0.3); }
    // 地面の小物: 中は疎ら、制圧圏の縁(半径 200〜330)ほど密にして外の地面につなげる
    for (let x = -330; x <= 330; x += 5) for (let z = -330; z <= 330; z += 5) {
      const jx = x + (rnd() - 0.5) * 4.5, jz = z + (rnd() - 0.5) * 4.5, r = Math.hypot(jx, jz);
      if (r > 332 || rnd() > 0.15 + 0.4 * Math.max(0, Math.min(1, (r - 190) / 130))) continue;
      if (!isFree(jx, jz, 2) || !dry(jx, jz, 12)) continue;
      const q = rnd();
      plant(q < 0.4 ? "tuft" : q < 0.66 ? "tuft2" : q < 0.86 ? "scrub" : "stone", jx, GY + (q < 0.86 ? -0.15 : 0.02), jz, q < 0.86 ? 0.8 + rnd() * 0.6 : 0.6 + rnd() * 1.4);
    }
    {
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = V(0, 1, 0), tc = new THREE.Color();
      for (const [kind, list] of Object.entries(inst)) {
        const side = kind === "tuft" || kind === "tuft2" || kind === "palm" ? THREE.DoubleSide : THREE.FrontSide;
        const im = new THREE.InstancedMesh(GEO[kind], new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side }), list.length);
        list.forEach(([x, y, z, s, r], i) => { mt.compose(V(x, y, z), q.setFromAxisAngle(up, r), sc.set(s, s * (0.85 + rnd() * 0.3), s)); im.setMatrixAt(i, mt); im.setColorAt(i, tc.setScalar(0.92 + rnd() * 0.12)); });
        group.add(im);
      }
    }

    // ── 状態と動き ──
    let state = "pumping", t = 1, clock = 0;   // t = 揚水の度合い(ゲートの開き)
    const SEC = 6;
    const ease = (x) => x * x * (3 - 2 * x);
    const scraperPhase = [0, 0.5];
    function apply() {
      const e = ease(t);
      gates.position.y = (GATE_Y.open - GATE_Y.closed) * e;
      foamMat.opacity = 0.75 * e * (0.8 + 0.2 * Math.sin(clock * 5));
      flowMat.opacity = 0.32 * e;
    }
    function update(dt) {
      clock += dt;
      if (state === "pumping") t = Math.min(1, t + dt / SEC); else t = Math.max(0, t - dt / SEC);
      apply();
      flowMat.map.offset.y -= dt * 0.9 * ease(t);
      if (t > 0.99) scrapers.children.forEach((sg, i) => { scraperPhase[i] += dt / 50; const p = (1 - Math.cos(scraperPhase[i] * Math.PI * 2)) / 2; sg.position.x = BX0 + 20 + p * (BX1 - BX0 - 52); });
    }
    function setState(s) { if (s === "pumping" || s === "stopped") state = s; }
    function setTeam(c) { accent.color.set(c ?? F.P.neutral); }
    // 確認値: 陸の建造物が水に入っていないか、橋の桁下、ゲートと巻上げ台の隙間、かき寄せ機の行程
    function check() {
      const onLand = [];
      const landCg = [[-62, 76], [-200, 150], [40, 282], [-200, 282], [50, 82], [135, 150], [58, 46], [58, -46], [HX0 + 15, 56]];
      for (const [x, z] of landCg) { const [lx, lz] = toLocal(x, z); onLand.push(!ctx.isWater(lx, lz)); }
      const gateTopOpen = GATE_Y.open + GATE_H / 2;
      return {
        landStructuresDry: onLand.every(Boolean), landSamples: onLand.length,
        bridgeUnderside_m: +((0.6 - WY) / ctx.K).toFixed(1),
        gateToHoistDeck: +(21.4 - gateTopOpen).toFixed(2), gateClosedBottomToBed: +(GATE_Y.closed - GATE_H / 2 - BED).toFixed(2),
        gateToPier: +((15 - PIER) / 2 - (BAY - 0.6) / 2).toFixed(2),
        pipeOverGantryBeam: +(23 - PIPE_R - 19.5).toFixed(2),
        scraperTravel: [BX0 + 20, BX0 + 20 + (BX1 - BX0 - 52)], basinInner: [BX0 + 1, BX1 - 13],
        mouthX: +mouthX.toFixed(1), bridgeAt: [+BX.toFixed(1), +BZ.toFixed(1)],
        interior: (() => {   // 制圧圏の中の小物と木: 水の中・水際 12 以内・道路や建造物の上に無いか
          let n = 0, wet = 0;
          for (const list of Object.values(inst)) for (const [x, , z] of list) { n++; if (!dry(x, z, 10)) wet++; }
          return { plants: n, nearWater: wet, occupiedBoxes: occ.length, flagAt: flagAt.map((v) => +v.toFixed(1)) };
        })(),
      };
    }
    apply();
    U.bake(THREE, group, { dynamic: [gates, ...scrapers.children], live: [accent] });
    return { group, update, setState, setTeam, check, get state() { return state; } };
  });
})();
