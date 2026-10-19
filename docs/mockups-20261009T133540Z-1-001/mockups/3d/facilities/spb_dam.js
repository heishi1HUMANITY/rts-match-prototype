// 戦略施設トークン「サンクトペテルブルク防潮堤」(ロシア、フィンランド湾)の詳細版モデル(試作)。
// 全長 25.4 km のうち、象徴的な区間を実寸の比率で切り出す(2000 × 1100 m を K 倍): クロンシュタットのあるコトリン島(海軍の港)、
// 一直線の堤防と天端の環状道路、主航路 C1(幅 200 m。浮体式のセクターゲート 2 枚、道路は航路の下をトンネルで抜ける)、放流口(ラジアルゲート 10 門)。
// 誇張(モデルの決め手 = 海上を一直線に延びる堤防と途中の島): 堤防の高さ 2 倍(天端 +16 m)、島の地盤 2 倍(+6 m)、高潮の水位差の表示 +5 m。
// 省略: 車両・人・艦艇・照明柱・小さな機器。
// 近未来化(施設リストの案 = 防潮堤・道路・海軍基地の複合。航路の開閉を占領側が制御): C1 の管制塔(箱形の覆いのレーダー)、航路の信号灯(開 = 緑 / 閉 = 赤)。
// 状態: "open" → "closing"(16 秒: 放流口のゲートが下り、C1 の門扉が浮上 → 旋回 → 敷居へ沈み、外海の高潮が上がる)→ "closed" → "opening"(逆順)。
// 堤防は x 方向、+z が外海(フィンランド湾)、-z がネヴァ湾。C1 の支点から見た角度 b は +z が 0、+x 側が正(maeslant.js と同じ仕組みを 0.56 倍)。
(function () {
  const K = 0.09;
  const D = {
    x0: -1000, x1: 1000, z0: -550, z1: 550,
    crest: 16, ground: 6, apron: 3, bed: -16, base: -18, surge: 5,
    xc: 200, W: 100, px: 114, R: 162, gt: 10, gh: 24, dockFloor: -8, sill: -16, dock: [150, 174], dockEnd: 0.83, leg: 0.3, swing: 0.8, ballY: 10, ballR: 4,
    sluice: [560, 860], isle: -430,
  };
  D.H = 60 / D.R;
  D.closed = -(Math.asin((D.px - 0.75) / (D.R + D.gt / 2)) - D.H);
  D.open = D.closed + D.swing;
  const GATE_Y = { dock: -8, float: -5, sill: D.sill };
  const SEC = 16, PH = [0.12, 0.8, 0.92];   // 浮上 | 旋回 | 沈降 | 高潮
  const mouth = (r) => -Math.asin((D.px - D.W) / r);
  const DF0 = D.closed + D.H + 0.012;
  const TR = { y: 1, z: -2, r: 20, a0: -0.524, a1: 0.2, lift: 0.95 };   // 放流口のラジアルゲート(トラニオンの位置、扉の半径と角度、開くときの回転)
  const ZC = 0;

  function spbDam(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 110;
    const M = F.mats(THREE);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, polar, put, prism, waterShape, arcLoft, closedLoft, sector, tube, beam } = k;
    M.inner = k.water(); M.outer = k.water(); M.dockW = k.water();
    M.sigOn = M.basic(0x2fd16a); M.sigRed = M.basic(0xff3b30); M.sigOff = M.basic(0x3a4650);
    const group = new THREE.Group(); group.name = "spb_dam";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);
    const extX = (zy, x0, x1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(zy.map(([z, y]) => new THREE.Vector2(-z, y))), { depth: x1 - x0, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(x0, 0, 0); return g; };
    const extZ = (xy, z0, z1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(xy.map(([x, y]) => new THREE.Vector2(x, y))), { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); return g; };
    const gable = (parent, x, z, w, d, h, rh, mat = M.body, ry = 0) => {   // 切妻屋根の建物(棟は x 方向)
      const g = new THREE.Group(); g.position.set(x, D.ground, z); g.rotation.y = ry; parent.add(g);
      add(box(w, h, d), mat, g, { y: h / 2 });
      add(extX([[-d / 2 - 1, h], [d / 2 + 1, h], [0, h + rh]], -w / 2 - 1, w / 2 + 1), M.mid, g);
    };

    // ── 海底・足元の帯 ──
    add(box(D.x1 - D.x0, D.bed - D.base, D.z1 - D.z0), M.light, world, { y: (D.base + D.bed) / 2, edges: false });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.001);

    // ── コトリン島(クロンシュタット): 外海側と湾側の港(防波堤の口)、倉庫、門形クレーン、海軍の司令部、海軍大聖堂、北岸の稜堡 ──
    const I = D.isle;
    add(prism([[D.x0, -470], [I - 30, -470], [I, -440], [I, -330], [-700, -330], [-700, -150], [I, -150], [I, 150], [-700, 150], [-700, 330], [I, 330], [I, 440], [I - 30, 470], [D.x0, 470]], D.base, D.ground), M.land, world);
    for (const s of [-1, 1]) {
      for (const [za, zb] of [[150, 225], [285, 330]]) add(box(20, D.ground - D.base, zb - za), M.light, world, { x: I - 10, y: (D.ground + D.base) / 2, z: s * (za + zb) / 2 });   // 防波堤(口は 60 m)
      for (const z of [195, 265]) add(box(130, 1.4, 14), M.light, world, { x: -635, y: D.ground - 0.7, z: s * z });   // 突堤
      for (let i = 0; i < 3; i++) gable(world, -840 + i * 0, s * (175 + i * 55), 110, 32, 12, 6, M.body);   // 倉庫(港の西側)
      for (const x of [-660, -560]) {   // 門形クレーン(岸壁の上)
        const z = s * 340, g = new THREE.Group(); g.position.set(x, D.ground, z); world.add(g);
        for (const [a, b] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) add(box(1.2, 14, 1.2), M.light, g, { x: a, y: 7, z: b });
        add(box(12, 2, 10), M.light, g, { y: 15 });
        add(box(5, 6, 7), M.body, g, { y: 19 });
        beam(g, V(0, 20, 0), V(0, 34, -s * 26), 1.4, M.light);
      }
    }
    add(box(90, 18, 34), M.body, world, { x: -880, y: D.ground + 9, z: -60 });   // 海軍の司令部(チーム色の帯)
    add(box(90.4, 1.6, 34.4), M.glass, world, { x: -880, y: D.ground + 12, z: -60, edges: false });
    add(box(90.6, 0.8, 34.6), M.accent, world, { x: -880, y: D.ground + 16.8, z: -60, edges: false });
    // 海軍大聖堂(ギリシャ十字の平面、ドラムと大ドーム、四隅の小ドーム)
    const CA = V(-840, D.ground, 70);
    add(box(60, 26, 60), M.body, world, { x: CA.x, y: CA.y + 13, z: CA.z });
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(box(dx ? 22 : 30, 20, dz ? 22 : 30), M.light, world, { x: CA.x + dx * 40, y: CA.y + 10, z: CA.z + dz * 40 });
    add(cyl(17, 14, 20), M.light, world, { x: CA.x, y: CA.y + 33, z: CA.z });
    const dome = new THREE.SphereGeometry(18, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    add(dome, M.body, world, { x: CA.x, y: CA.y + 40, z: CA.z });
    add(cyl(2.2, 8, 8), M.mid, world, { x: CA.x, y: CA.y + 61, z: CA.z });
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(new THREE.SphereGeometry(6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.body, world, { x: CA.x + dx * 22, y: CA.y + 26, z: CA.z + dz * 22 });
    // 北岸・南岸の稜堡(低い角張った石垣)
    for (const s of [-1, 1]) for (const x of [-960, -780, -600]) add(prism([[x - 40, s * 470], [x + 40, s * 470], [x + 20, s * 492], [x, s * 505], [x - 20, s * 492]].map(([a, b]) => [a, b]), D.base, D.ground + 3), M.light, world);
    add(box(570, 0.3, 24), M.mid, world, { x: -715, y: D.ground + 0.15, z: 0, edges: false });   // 島の道路
    add(extZ([[-560, D.base], [I, D.base], [I, D.crest], [-560, D.ground]], -16, 16), M.land, world);   // 島から堤防へ上る取付け盛土
    add(extZ([[-560, D.ground + 0.3], [I, D.crest + 0.3], [I, D.crest + 0.1], [-560, D.ground + 0.1]], -13, 13), M.mid, world);

    // ── 堤防(天端に環状道路と中央分離帯)。C1 の両側でトンネルへ下る切り通し ──
    const EMB = [[-40, D.base], [40, D.base], [14, D.crest], [-14, D.crest]];
    const road = (xa, xb) => { add(box(xb - xa, 0.3, 26), M.mid, world, { x: (xa + xb) / 2, y: D.crest + 0.15, z: 0, edges: false }); add(box(xb - xa, 1, 1.2), M.light, world, { x: (xa + xb) / 2, y: D.crest + 0.8, z: 0, edges: false }); };
    const embank = (xa, xb) => { add(extX(EMB, xa, xb), M.land, world); add(extX([[22, D.base], [40, D.base], [28, 0], [22, 0]], xa, xb), M.mid, world); road(xa, xb); };
    embank(I, -130); embank(530, D.sluice[0]); embank(D.sluice[1], D.x1);
    const PORTAL = { l: -70, r: 470, y: 2 };
    for (const [xa, xb, ya, yb, px] of [[-130, PORTAL.l, D.crest, PORTAL.y, PORTAL.l], [PORTAL.r, 530, PORTAL.y, D.crest, PORTAL.r]]) {
      add(extX([[11, D.base], [40, D.base], [14, D.crest], [11, D.crest]], xa, xb), M.land, world);
      add(extX([[-40, D.base], [-11, D.base], [-11, D.crest], [-14, D.crest]], xa, xb), M.land, world);
      add(extZ([[xa, D.base], [xb, D.base], [xb, yb], [xa, ya]], -11, 11), M.mid, world);
      add(box(2, 18, 30), M.light, world, { x: px, y: PORTAL.y + 9, z: 0 });   // 坑口の額縁
      add(box(2.4, 9, 22), M.dark, world, { x: px, y: PORTAL.y + 4.5, z: 0, edges: false });
    }

    // ── 放流口: 敷居、門柱、道路橋、ゲートの巻上げ室、ラジアルゲート 10 門(全部が同じトラニオンの軸で回る) ──
    const [S0, S1] = D.sluice, SN = 10, BW = (S1 - S0) / SN;
    add(box(S1 - S0, 7, 44), M.light, world, { x: (S0 + S1) / 2, y: D.bed + 3.5, z: 0 });
    for (let i = 0; i <= SN; i++) {
      const x = S0 + i * BW, w = i === 0 || i === SN ? 10 : 6;
      add(box(w, D.crest + 9, 52), M.body, world, { x, y: (D.crest - 9) / 2, z: 0 });
      add(box(w + 0.4, 5, 8), M.light, world, { x, y: D.crest + 2.5, z: 14 });   // 巻上げ室
    }
    add(box(S1 - S0, 2, 22), M.light, world, { x: (S0 + S1) / 2, y: D.crest - 1, z: -14 });
    road(S0, S1);
    const sluice = new THREE.Group(); sluice.position.set(0, TR.y, TR.z); world.add(sluice);
    for (let i = 0; i < SN; i++) {
      const xm = S0 + (i + 0.5) * BW, hw = BW / 2 - 1.2, rings = [];
      for (let j = 0; j <= 6; j++) { const a = TR.a0 + ((TR.a1 - TR.a0) * j) / 6; rings.push([[-hw, TR.r - 0.8], [hw, TR.r - 0.8], [hw, TR.r + 0.8], [-hw, TR.r + 0.8]].map(([x, r]) => V(xm + x, r * Math.sin(a), r * Math.cos(a)))); }
      add(closedLoft(rings), M.mid, sluice);
      for (const x of [-hw + 1, hw - 1]) for (const a of [TR.a0 + 0.05, TR.a1 - 0.05]) beam(sluice, V(xm + x, 0, 0), V(xm + x, (TR.r - 0.8) * Math.sin(a), (TR.r - 0.8) * Math.cos(a)), 1.0, M.light);
      add(cyl(1.4, 2, 10), M.dark, sluice, { x: xm - hw + 1, rz: Math.PI / 2 }); add(cyl(1.4, 2, 10), M.dark, sluice, { x: xm + hw - 1, rz: Math.PI / 2 });
    }

    // ── 主航路 C1: 両岸の台地(ドックの切り欠き)、敷居、ドックの床、照明、球面継手、アーム(トラス)と門扉 ──
    const arcXZ = (r, b0, b1, n) => Array.from({ length: n + 1 }, (_, i) => { const b = b0 + ((b1 - b0) * i) / n; return [D.xc + D.px + r * Math.sin(b), r * Math.cos(b)]; });
    const PL = [[D.xc + D.W, -40], [470, -40], [470, 200], [D.xc + D.W, 200], ...arcXZ(D.dock[1], mouth(D.dock[1]), D.dockEnd, 32), ...arcXZ(D.dock[0], D.dockEnd, mouth(D.dock[0]), 32)];
    add(box(2 * D.W, 2, 260), M.mid, world, { x: D.xc, y: D.bed + 1, z: 70, edges: false });
    const sides = [], lowSegs = [], dockWs = [];
    for (const s of [-1, 1]) {
      add(prism(PL.map(([x, z]) => [s > 0 ? x : 2 * D.xc - x, z]), D.base, D.apron), M.light, world);
      const pv = new THREE.Group(); pv.position.x = D.xc + s * D.px; world.add(pv);
      const B = (b0, b1) => (s > 0 ? [b0, b1] : [-b1, -b0]);
      add(arcLoft([[D.dock[0], D.base], [D.dock[1], D.base], [D.dock[1], D.dockFloor], [D.dock[0], D.dockFloor]], ...B(DF0, D.dockEnd), 32), M.mid, pv);
      add(arcLoft([[D.dock[0], D.base], [D.dock[1], D.base], [D.dock[1], D.bed + 2], [D.dock[0], D.bed + 2]], ...B(mouth(D.dock[0]), DF0), 4), M.mid, pv);
      for (const [r0, r1] of [[D.dock[0] - 3, D.dock[0]], [D.dock[1], D.dock[1] + 3]]) add(arcLoft([[r0, D.apron - 0.1], [r1, D.apron - 0.1], [r1, D.apron + 0.3], [r0, D.apron + 0.3]], ...B(mouth(r0), D.dockEnd), 24), M.body, pv);
      add(arcLoft([[D.R - 8, D.bed], [D.R + 8, D.bed], [D.R + 8, D.sill + 0.5], [D.R - 8, D.sill + 0.5]], ...B(D.closed - D.H - 0.012, DF0), 32), M.light, pv);   // 敷居
      const dw = new THREE.Mesh(sector(D.dock[0], D.dock[1], ...B(mouth(D.R) - 0.02, D.dockEnd), 32), M.dockW); pv.add(dw); dockWs.push(dw);
      // 球面継手の受け台と球
      add(cyl(6, 3, 16), M.mid, pv, { y: D.apron + 1.5 });
      add(new THREE.SphereGeometry(D.ballR, 16, 10), M.steel, pv, { y: D.ballY });
      // アーム: 旋回 → 縦の傾き → 部材
      const yaw = new THREE.Group(); pv.add(yaw);
      const pitch = new THREE.Group(); pitch.position.y = D.ballY; yaw.add(pitch);
      const arm = new THREE.Group(); arm.position.y = -D.ballY; pitch.add(arm);
      add(cyl(D.ballR + 0.6, 3, 16), M.steel, arm, { y: D.ballY });
      add(box(4, 3, 3), M.steel, arm, { y: D.ballY, z: 5.5 });
      add(box(10, 12, 6), M.light, arm, { y: 13, z: 10 });
      const GB = D.R - D.gt / 2, GF = D.R + D.gt / 2, g0 = GATE_Y.dock;
      const R0 = 12, R1 = GB - 2, N = 6, T0 = 18.5, T1 = g0 + D.gh - 0.5, B0 = 9, B1 = g0 + 20.5;
      const top = (b, i) => polar(R0 + ((R1 - R0) * i) / N, b, T0 + ((T1 - T0) * i) / N);
      const bot = (b, i) => polar(R0 + ((R1 - R0) * i) / N, b, B0 + ((B1 - B0) * i) / N);
      const low = (p, q) => { if (s > 0) lowSegs.push([p.clone(), q.clone()]); };
      for (const b of [-D.leg, D.leg]) {
        tube(arm, top(b, 0), top(b, N), 1.4); tube(arm, bot(b, 0), bot(b, N), 1.4); low(bot(b, 0), bot(b, N));
        for (let i = 1; i <= N; i++) tube(arm, top(b, i), bot(b, i), 0.6);
        for (let i = 0; i < N; i++) tube(arm, i % 2 ? bot(b, i) : top(b, i), i % 2 ? top(b, i + 1) : bot(b, i + 1), 0.6);
        put(box(2.4, T1 - B1 + 2, 3), M.light, arm, polar(R1 + 0.5, b, (T1 + B1) / 2), { ry: b });
      }
      for (let i = 2; i <= N; i++) {
        tube(arm, top(-D.leg, i), top(D.leg, i), 0.5, M.light);
        tube(arm, bot(-D.leg, i), bot(D.leg, i), 0.5, M.light); low(bot(-D.leg, i), bot(D.leg, i));
        tube(arm, top(-D.leg, i - 1), top(D.leg, i), 0.4, M.light);
      }
      add(arcLoft([[GB, g0], [GF, g0], [GF, g0 + 10], [GB, g0 + 10]], -D.H, D.H, 24), M.mid, arm);
      add(arcLoft([[GB, g0 + 10], [GF, g0 + 10], [GF, g0 + D.gh], [GB + 3, g0 + D.gh], [GB, g0 + D.gh - 2]], -D.H, D.H, 24), M.body, arm);
      for (let j = 0; j <= 8; j++) { const b = -D.H + 0.03 + (j * (2 * D.H - 0.06)) / 8; if (Math.abs(Math.abs(b) - D.leg) < 0.025) continue; put(box(0.6, D.gh - 4, 2.5), M.light, arm, polar(GB - 1.2, b, g0 + 1 + (D.gh - 4) / 2), { ry: b }); }
      add(arcLoft([[GB - 1.5, g0 + 12], [GB, g0 + 12], [GB, g0 + 12.6], [GB - 1.5, g0 + 12.6]], -D.H, D.H, 16), M.light, arm);
      add(arcLoft([[GF - 0.6, g0 + D.gh], [GF - 0.2, g0 + D.gh], [GF - 0.2, g0 + D.gh + 1], [GF - 0.6, g0 + D.gh + 1]], -D.H + 0.01, D.H - 0.01, 16), M.dark, arm, { edges: false });
      put(box(1, D.gh - 2, D.gt - 1), M.dark, arm, polar(D.R, -s * (D.H + 0.5 / D.R), g0 + D.gh / 2), { ry: -s * D.H });
      sides.push({ s, yaw, pitch });
    }
    // ── 近未来化: C1 の管制塔(左の台地、チーム色の帯、箱形の覆いのレーダー)と航路の信号灯 ──
    const TW = V(-20, D.apron, -20);
    add(box(16, 30, 16), M.body, world, { x: TW.x, y: TW.y + 15, z: TW.z });
    add(box(20, 6, 20), M.body, world, { x: TW.x, y: TW.y + 33, z: TW.z });
    add(box(20.2, 3, 20.2), M.glass, world, { x: TW.x, y: TW.y + 33, z: TW.z, edges: false });
    add(box(16.4, 1, 16.4), M.accent, world, { x: TW.x, y: TW.y + 28, z: TW.z, edges: false });
    add(box(7, 3, 2.5), M.light, world, { x: TW.x, y: TW.y + 37.5, z: TW.z + 3 });
    add(cyl(0.3, 10, 6), M.dark, world, { x: TW.x - 6, y: TW.y + 41, z: TW.z - 6 });
    const signals = [];
    for (const x of [D.xc - D.W - 6, D.xc + D.W + 6]) for (const z of [-34, 192]) {
      add(cyl(0.6, 16, 8), M.mid, world, { x, y: D.apron + 8, z });
      add(box(3, 5, 3), M.dark, world, { x, y: D.apron + 17, z });
      signals.push(add(box(2, 2, 3.2), M.sigOn, world, { x, y: D.apron + 17, z, edges: false }));
    }

    // ── 水面: 湾側(-z、水位 0)と外海側(+z、高潮で上がる)。C1 では門扉の線、放流口ではゲートの線で分ける ──
    const arcPts = [];
    for (const s of [-1, 1]) for (let j = 0; j <= 20; j++) {
      const b = D.closed - D.H + (2 * D.H * j) / 20, x = D.px + D.R * Math.sin(b), z = D.R * Math.cos(b);
      arcPts.push([D.xc + s * x, z]);
    }
    const arc = arcPts.filter(([x]) => x >= D.xc - D.W && x <= D.xc + D.W).sort((a, b) => a[0] - b[0]);
    const zAt = (x) => arc.reduce((best, p) => (Math.abs(p[0] - x) < Math.abs(best[0] - x) ? p : best))[1];
    const SZ = 18;
    const outerP = [[D.x0, 0], [D.xc - D.W, 0], [D.xc - D.W, zAt(D.xc - D.W)], ...arc, [D.xc + D.W, zAt(D.xc + D.W)], [D.xc + D.W, 0], [S0, 0], [S0, SZ], [S1, SZ], [S1, 0], [D.x1, 0], [D.x1, D.z1], [D.x0, D.z1]];
    const innerP = [[D.x0, D.z0], [D.x1, D.z0], [D.x1, 0], [S1, 0], [S1, SZ], [S0, SZ], [S0, 0], [D.xc + D.W, 0], [D.xc + D.W, zAt(D.xc + D.W)], ...arc.slice().reverse(), [D.xc - D.W, zAt(D.xc - D.W)], [D.xc - D.W, 0], [D.x0, 0]];
    world.add(waterShape(innerP, M.inner));
    const outer = waterShape(outerP, M.outer); world.add(outer);
    const plane = (w, o) => [new THREE.PlaneGeometry(w, 1).translate(0, 0.5, 0), o];
    const icut = new THREE.Mesh(U.merge(THREE, [plane(D.x1 - D.x0, { z: D.z0 }), plane(-D.z0, { x: D.x1, z: D.z0 / 2, ry: Math.PI / 2 }), plane(80, { x: D.x0, z: D.z0 + 40, ry: Math.PI / 2 })]), M.waterCut);
    icut.position.y = D.bed; icut.scale.y = -D.bed; world.add(icut);
    const ocut = new THREE.Mesh(U.merge(THREE, [plane(D.x1 - D.x0, { z: D.z1 }), plane(D.z1, { x: D.x1, z: D.z1 / 2, ry: Math.PI / 2 }), plane(80, { x: D.x0, z: D.z1 - 40, ry: Math.PI / 2 })]), M.waterCut);
    ocut.position.y = D.bed; world.add(ocut);

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 姿勢: t = 0(開)〜 1(閉、高潮) ──
    const ease = (x) => x * x * (3 - 2 * x), clamp = (x) => Math.max(0, Math.min(1, x));
    function pose(t) {
      let yb, sw;
      if (t < PH[0]) { yb = GATE_Y.dock + (GATE_Y.float - GATE_Y.dock) * ease(t / PH[0]); sw = 0; }
      else if (t < PH[1]) { yb = GATE_Y.float; sw = ease((t - PH[0]) / (PH[1] - PH[0])); }
      else { yb = GATE_Y.float + (GATE_Y.sill - GATE_Y.float) * ease(clamp((t - PH[1]) / (PH[2] - PH[1]))); sw = 1; }
      return { yaw: D.open + (D.closed - D.open) * sw, pitch: Math.asin((GATE_Y.dock - yb) / D.R), yb, sluice: ease(clamp(t / 0.5)), surge: D.surge * ease(clamp((t - PH[2]) / (1 - PH[2]))) };
    }
    const tilt = (p, a) => { const dy = p.y - D.ballY; return V(p.x, D.ballY + dy * Math.cos(a) - p.z * Math.sin(a), dy * Math.sin(a) + p.z * Math.cos(a)); };
    const turn = (p, f) => V(p.x * Math.cos(f) + p.z * Math.sin(f), p.y, -p.x * Math.sin(f) + p.z * Math.cos(f));

    let state = opts.state ?? "open", t = state === "closed" ? 1 : 0;
    function apply() {
      const p = pose(t);
      for (const sd of sides) { sd.yaw.rotation.y = sd.s * p.yaw; sd.pitch.rotation.x = p.pitch; }
      sluice.rotation.x = -TR.lift * (1 - p.sluice);
      outer.position.y = p.surge; for (const w of dockWs) w.position.y = p.surge;
      ocut.scale.y = p.surge - D.bed;
      const green = state === "open";
      signals.forEach((sg) => { sg.material = green ? M.sigOn : M.sigRed; });
    }
    function update(dt) {
      if (state === "closing") { t = Math.min(1, t + dt / SEC); if (t >= 1) state = "closed"; }
      if (state === "opening") { t = Math.max(0, t - dt / SEC); if (t <= 0) state = "open"; }
      apply();
      const flow = 1 - ease(t);
      M.inner.map.offset.y -= dt * 0.04 * flow; M.outer.map.offset.y -= dt * (0.04 * flow + 0.01);
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "open" || s === "closed") { state = s; t = s === "closed" ? 1 : 0; }
      else state = s;
      apply();
    }
    function stage() {
      if (state === "closing") return t < PH[0] ? "放流口のゲートを下ろし、C1 の門扉を浮上" : t < PH[1] ? "C1 の門扉を航路へ押し出す" : t < PH[2] ? "注水して敷居へ沈める" : "外海の高潮を止める";
      if (state === "opening") return t > PH[2] ? "高潮が引くのを待つ" : t > PH[1] ? "門扉を排水して浮上" : t > PH[0] ? "門扉をドックへ戻す" : "放流口のゲートを上げる";
      return "";
    }
    // 地面の高さ(右の支点の向きに折り返す)。アームの下の部材の隙間を測る
    function groundY(x, z) {
      const dx = Math.abs(x - D.xc) - D.px, r = Math.hypot(dx, z), b = Math.atan2(dx, z), ax = Math.abs(x - D.xc);
      if (r >= D.dock[0] && r <= D.dock[1] && b >= mouth(r) - 0.02 && b <= D.dockEnd) return b >= DF0 ? D.dockFloor : D.bed + 2;
      if (r < 6) return D.apron + 3;
      if (ax < D.W) return D.bed;
      return D.apron + 0.3;
    }
    function check() {
      let arm = Infinity, at = null;
      for (let i = 0; i <= 50; i++) {
        const p = pose(i / 50);
        for (const [a, b] of lowSegs) for (let j = 0; j <= 12; j++) {
          const q = turn(tilt(a.clone().lerp(b, j / 12), p.pitch), p.yaw), c = q.y - groundY(q.x + D.xc + D.px, q.z);
          if (c < arm) { arm = c; at = { t: i / 50, x: +(q.x + D.xc + D.px).toFixed(1), z: +q.z.toFixed(1) }; }
        }
      }
      // ラジアルゲート: 開いたときの扉の最も手前(-z)の点と道路橋(z ≤ -3)の隙間、閉じたときの扉の下端と敷居(-9)の差
      const openA = TR.a1 + TR.lift, sluiceToDeck = TR.z + (TR.r - 0.8) * Math.cos(openA) - -3;
      const r1 = (v) => +v.toFixed(2);
      return {
        armOverGround_m: r1(arm), armOverGroundAt: at,
        gateGapCenter_m: r1(2 * (D.px - (D.R + D.gt / 2) * Math.sin(-D.closed + D.H))),
        dockClearInner_m: r1((D.open - D.H - mouth(D.dock[0])) * (D.R - D.gt / 2)), dockClearEnd_m: r1((D.dockEnd - D.open - D.H) * (D.R + D.gt / 2)),
        closedBankEndToDockFloor_rad: r1(DF0 - (D.closed + D.H)),
        sluiceOpenToDeck_m: r1(sluiceToDeck), sluiceClosedBottom_m: r1(TR.y + TR.r * Math.sin(TR.a0)), sluiceSillTop_m: D.bed + 7,
        gateTopSunk_m: GATE_Y.sill + D.gh, surgeMax_m: D.surge,
      };
    }
    U.bake(THREE, group, { dynamic: [...sides.flatMap((sd) => [sd.yaw, sd.pitch]), sluice, ...signals], live: [M.accent] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setState, check, stats: () => U.stats(group), parts: { ring, disc }, at, setTeam: (c) => F.setTeam(M, c),
      get state() { return state; }, get progress() { return t; }, get stage() { return stage(); },
      shots: {
        c1: { label: "主航路 C1", target: [200, 5, 120], pos: [380, 140, 420] },
        sluice: { label: "放流口", target: [710, 5, 10], pos: [820, 70, 180] },
        isle: { label: "クロンシュタット", target: [-760, 10, 40], pos: [-500, 160, 380] },
        tunnel: { label: "トンネルの坑口", target: [-90, 8, 0], pos: [-200, 60, 120] },
      },
    };
  }

  DreamAssets.fac.register("spb_dam", {
    section: 2, title: "サンクトペテルブルク防潮堤", kind: "STRATEGIC FACILITY · 2 水門・閘門・防潮堤",
    desc: "フィンランド湾を横切る全長約 25 km の防潮堤の切り出し。一直線の堤防と天端の環状道路、クロンシュタットのコトリン島、主航路 C1 の浮体式セクターゲート(道路はトンネル)、放流口。占領側が航路の開閉を握る複合トークン",
    info: [["ファイル", "mockups/3d/facilities/spb_dam.js"], ["大きさ", "切り出し 2000 × 1100 m を 0.09 倍 × 表示 3.0"], ["誇張", "堤防の高さ 2 倍(天端 +16 m)、島の地盤 2 倍、高潮の差 +5 m"], ["省略", "車両・人・艦艇・照明柱"], ["動作", "放流口が閉じる → C1 の門扉が浮上・旋回・沈降 → 外海の高潮(16 秒)"], ["近未来化", "C1 の管制塔、航路の信号灯(開 = 緑 / 閉 = 赤)"]],
    dist: 1150, target: 25, tokenAt: [420, 0, 330],
    make: (THREE) => spbDam(THREE, { r: 110 }),
    actLabel: "STATE · 航路", progress: true,
    actions: (a) => [["開", () => a.setState("open"), () => a.state === "open"], ["閉鎖 ▶", () => a.setState("closing"), () => a.state === "closing"], ["閉", () => a.setState("closed"), () => a.state === "closed"], ["◀ 開放", () => a.setState("opening"), () => a.state === "opening"]],
    caption: (a) => (a.stage ? (a.state === "closing" ? "閉鎖中 — " : "開放中 — ") + a.stage : ""),
  });
})();
