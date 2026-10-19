// 戦略施設トークン「マエスラントケーリング」(オランダ・ロッテルダム、可動式防潮堤)の詳細版モデル(試作)。
// 実物の寸法(水路幅 360 m、門扉 210 × 22 m、トラスのアーム 237 m、球面継手 直径 10 m)をメートルで組み、全体を K 倍して模型にする。
// 平面の配置(旋回の仕組みを決める)は実寸のまま。象徴的な部分は誇張する: 門扉の高さ 2 倍、トラスの背(門扉の天端まで)、球面継手 1.8 倍、トラスの管を太く。
// 既存の施設と同じ建築模型の見え方(白・明灰・暗の Lambert と輪郭線、チーム色はアクセントだけ)で、部品の細かさは部隊アセット(tank.js など)に合わせた。
// 近未来化(施設リストの案): アームの付け根に予備電源(発電機コンテナ・蓄電池コンテナ・燃料タンク・変圧器)とセンサーの塔、岸の水位計。
// 動きは実物の閉鎖手順だけ: 門扉の排水で浮上 → 門扉を水路へ押し出す → 注水して敷居へ沈める。開放は逆順。
// 省略: 門扉を押す機関車・レール・駆動装置(門扉を誇張すると小さすぎて違和感が出るため。レビューで決定)。
// 簡略化: 実物は待機中のドックの水位を下げておき、閉鎖の前に注水する。ドック口の仕切りの構造が確かめられないので、ドックは常に水路と同じ水位にした。
//
//   const a = DreamAssets.fac.defs.maeslant.make(THREE)(制圧圏 r = 110)
//   scene.add(a.group); a.setTeam(0xff6a1a); a.setState("closing"); a.update(dt)
//
// 状態: "open"(門扉は両岸のドックの中)→ "closing"(16 秒)→ "closed"(水路の中央で向き合って敷居に沈む)→ "opening" → "open"
// 水路は z 方向、+z が海。右岸(+x)の支点から見た角度 b は +z が 0、+x 側が正。左岸は x を反転した同じ形。
(function () {
  const K = 0.2;   // 1 m = 0.2(ビューアの施設の表示倍率 3.0 をさらにかける)
  const D = {
    river: 180, toe: 185, toeY: -3, bank: 195, wet: 190,   // 水路の半幅(護岸の足)、護岸の折れ目と高さ、護岸の上端、水際
    ground: 3, bed: -17, base: -19, sill: -16.5, dockFloor: -6,
    px: 205, ballY: 18, ballR: 9,                // 球面継手の中心(x = ±px、z = 0)と半径(実物 5 m を 1.8 倍)
    R: 290, gt: 18, gh: 44,                      // 門扉の中心線の半径、厚さ、高さ(高さは実物 22 m を 2 倍、厚さも上から円弧が読めるよう太く)
    dock: [274, 306], dockEnd: 0.8,
    leg: 0.3, swing: 0.8,                        // トラスの脚の開き(片側)、旋回の角度
    z0: -110, z1: 370, xw: 460,
  };
  D.H = 105 / D.R;                                                              // 門扉の半角(長さ 210 m)
  D.closed = -(Math.asin((D.px - 0.75) / (D.R + D.gt / 2)) - D.H);              // 閉じたときの右岸のアームの向き(海側の面で中央の隙間 1.5 m)
  D.open = D.closed + D.swing;
  const GATE_Y = { dock: -6, float: -3, sill: D.sill };   // 門扉の下端(ドックの床 / 浮上 / 敷居)
  const SEC = 16, PH = [0.18, 0.82];                      // 閉鎖にかかる秒数、段階の区切り(浮上 | 旋回 | 沈降)
  const mouth = (r) => -Math.asin((D.px - D.bank) / r);   // ドック口(護岸の上端 x = 195)の角度
  const DF0 = D.closed + D.H + 0.012;                       // ドックの床の始まり。手前のドック口は閉じた門扉が沈むので川底の深さ

  function maeslant(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 110;
    const M = F.mats(THREE);
    M.river = U.waterMaterial(THREE, { repeat: [(2 * D.wet * K) / U.WATER_TILE[0], ((D.z1 - D.z0) * K) / U.WATER_TILE[1]] });
    M.dockWater = U.waterMaterial(THREE); M.dockWater.side = THREE.DoubleSide;
    const group = new THREE.Group(); group.name = "maeslant";
    const ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);
    const { add, box, cyl, V, polar, put, arcLoft, sector, tube } = F.kit(THREE, M, K);

    // ── 台座: 両岸の陸(ドックの切り欠きつき)、護岸、川底、足元の暗い帯 ──
    const arcXZ = (r, b0, b1, n) => Array.from({ length: n + 1 }, (_, i) => { const b = b0 + ((b1 - b0) * i) / n; return [D.px + r * Math.sin(b), r * Math.cos(b)]; });
    for (const s of [-1, 1]) {
      const pts = [[D.bank, D.z0], [D.xw, D.z0], [D.xw, D.z1], [D.bank, D.z1], ...arcXZ(D.dock[1], mouth(D.dock[1]), D.dockEnd, 40), ...arcXZ(D.dock[0], D.dockEnd, mouth(D.dock[0]), 40)];
      const land = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(s * x, -z))), { depth: D.ground - D.base, bevelEnabled: false });
      land.rotateX(-Math.PI / 2); land.translate(0, D.base, 0);
      add(land, M.land, world);   // 陸は少し暗く、白い門扉とアームを浮かせる
      // 護岸(石張りの斜面)。ドック口だけ切る
      const prof = [[D.river, D.base], [D.bank, D.base], [D.bank, D.ground], [D.toe, D.toeY], [D.river, D.bed]].map(([x, y]) => [s * x, y]);
      for (const [za, zb] of [[D.z0, 273.5], [305.5, D.z1]]) add(U.loft(THREE, [{ z: za, pts: prof }, { z: zb, pts: prof }]), M.mid, world);
      // 道路(堤防の上の管理道路)
      add(box(D.xw - D.bank, 0.15, 8), M.mid, world, { x: (s * (D.bank + D.xw)) / 2, y: D.ground + 0.075, z: -102, edges: false });
    }
    add(box(2 * D.bank, D.bed - D.base, D.z1 - D.z0), M.light, world, { y: (D.base + D.bed) / 2, z: ZC, edges: false });
    add(box(2 * D.xw + 6, 1.2, D.z1 - D.z0 + 6), M.dark, world, { y: D.base + 0.6, z: ZC, edges: false });   // 上面は川底より下
    const riverG = new THREE.PlaneGeometry(2 * D.wet, D.z1 - D.z0); riverG.rotateX(-Math.PI / 2);
    const river = new THREE.Mesh(riverG, M.river); river.position.set(0, 0, ZC); world.add(river);
    const cutG = U.merge(THREE, [D.z0, D.z1].map((z) => [new THREE.PlaneGeometry(2 * D.wet, -D.bed), { y: D.bed / 2, z }]));   // 水路の両端の水の切り口
    world.add(new THREE.Mesh(cutG, M.waterCut));
    // 航路標識(浮標): 海から入る船の左舷側(-x)が赤の円筒、右舷側(+x)が緑の円錐
    for (const z of [-85, 355]) for (const s of [-1, 1]) {
      add(cyl(1.6, 3.2, 10), s < 0 ? M.red : M.green, world, { x: s * 150, y: 0.4, z });
      add(s < 0 ? cyl(0.8, 1.4, 8) : new THREE.ConeGeometry(1.0, 1.6, 8), s < 0 ? M.red : M.green, world, { x: s * 150, y: 2.8, z });
    }

    // ── 両岸: ドック、照明塔、球面継手の基礎、アーム(門扉とトラス) ──
    const sides = [], lowSegs = [];   // lowSegs: アームの下側の部材(右岸のアーム座標)。地面との隙間を check で測る
    for (const s of [-1, 1]) {
      const pv = new THREE.Group(); pv.position.x = s * D.px; world.add(pv);
      const B = (b0, b1) => (s > 0 ? [b0, b1] : [-b1, -b0]);   // 右岸の角度範囲 → この岸
      // ドック: 床(門扉の待機位置)、縁の笠石
      add(arcLoft([[D.dock[0], D.base], [D.dock[1], D.base], [D.dock[1], D.dockFloor], [D.dock[0], D.dockFloor]], ...B(DF0, D.dockEnd), 40), M.mid, pv);
      add(arcLoft([[D.dock[0], D.base], [D.dock[1], D.base], [D.dock[1], D.bed], [D.dock[0], D.bed]], ...B(mouth(D.dock[0]), DF0), 4), M.light, pv);
      add(arcLoft([[271, 2.9], [D.dock[0], 2.9], [D.dock[0], 3.3], [271, 3.3]], ...B(mouth(271), D.dockEnd), 24), M.light, pv);
      add(arcLoft([[D.dock[1], 2.9], [309, 2.9], [309, 3.3], [D.dock[1], 3.3]], ...B(mouth(309), D.dockEnd), 24), M.light, pv);
      const dockW = new THREE.Mesh(sector(D.dock[0], D.dock[1], ...B(-Math.asin((D.px - D.wet) / D.R), D.dockEnd)), M.dockWater); pv.add(dockW);
      // 敷居(川底の石積みのしきい。閉じた門扉が沈む場所。ドック口まで続く)
      add(arcLoft([[D.R - 11, D.bed], [D.R + 11, D.bed], [D.R + 11, D.sill], [D.R - 11, D.sill]], ...B(D.closed - D.H - 0.012, DF0), 40), M.mid, pv);
      // 照明塔(ドックの外。常灯)
      for (const b of [0.1, 0.4, 0.68]) {
        const p = polar(323, s * b);
        put(box(1.6, 0.8, 1.6), M.mid, pv, p.clone().setY(D.ground + 0.4));
        put(cyl(0.4, 24, 8), M.mid, pv, p.clone().setY(D.ground + 12));
        put(box(3.4, 1.0, 1.4), M.dark, pv, polar(322.6, s * b, 27.2), { ry: s * b });
        put(box(3.0, 0.6, 0.2), M.lamp, pv, polar(321.8, s * b, 27.1), { ry: s * b, edges: false });
      }

      // 球面継手の基礎(コンクリートの塊)、受け台、鋼の球
      const found = U.slab(THREE, 22, 24, 6, 9 - D.base); found.translate(0, D.base, 0);
      add(found, M.light, pv, { x: s * 6, z: -10 });
      add(cyl(9.5, 3.5, 20), M.mid, pv, { y: 10.75 });
      add(new THREE.SphereGeometry(D.ballR, 20, 14), M.steel, pv, { y: D.ballY });
      // 基礎の上のセンサー(継手の変位・ひずみ計の箱と配線の樋)
      for (const [x, z] of [[-8, -22], [10, -24], [16, -6]]) add(box(1.4, 1.6, 0.9), M.dark, pv, { x: s * x, y: 9.8, z });
      add(box(1.0, 0.3, 18), M.mid, pv, { x: s * 12, y: 9.15, z: -15, edges: false });

      // アーム: 旋回(yaw)→ 球面継手まわりの縦の傾き(pitch)→ 部材
      const yaw = new THREE.Group(); pv.add(yaw);
      const pitch = new THREE.Group(); pitch.position.y = D.ballY; yaw.add(pitch);
      const arm = new THREE.Group(); arm.position.y = -D.ballY; pitch.add(arm);
      // 継手側: 球を抱く環、首、トラスが集まる頭
      add(cyl(D.ballR + 0.8, 5, 20), M.steel, arm, { y: D.ballY });
      add(box(8, 5, 3), M.steel, arm, { y: D.ballY, z: 10.5 });
      add(box(16, 18, 9), M.light, arm, { y: 20, z: 16.5 });
      // トラス: 2 本の脚(上弦・下弦・垂直材・斜材)と、脚の間の横つなぎ(上下の面に支柱と X の斜材)
      const GB = D.R - D.gt / 2, GF = D.R + D.gt / 2;   // 門扉の陸側(背)と海側(表)の半径
      const R0 = 20, R1 = GB - 2.5, N = 9, TOP0 = 27, TOP1 = GATE_Y.dock + D.gh - 0.5, BOT0 = 12, BOT1 = 4.8;
      const top = (b, i) => polar(R0 + ((R1 - R0) * i) / N, b, TOP0 + ((TOP1 - TOP0) * i) / N);
      const bot = (b, i) => polar(R0 + ((R1 - R0) * i) / N, b, BOT0 + ((BOT1 - BOT0) * i) / N);
      const low = (p, q) => { if (s > 0) lowSegs.push([p.clone(), q.clone()]); };
      for (const b of [-D.leg, D.leg]) {
        tube(arm, top(b, 0), top(b, N), 2.4); tube(arm, bot(b, 0), bot(b, N), 2.4); low(bot(b, 0), bot(b, N));
        for (let i = 1; i <= N; i++) tube(arm, top(b, i), bot(b, i), 1.0);
        for (let i = 0; i < N; i++) tube(arm, i % 2 ? bot(b, i) : top(b, i), i % 2 ? top(b, i + 1) : bot(b, i + 1), 1.0);
        put(box(3.6, TOP1 - BOT1 + 3, 5), M.light, arm, polar(R1 + 0.5, b, (TOP1 + BOT1) / 2), { ry: b });   // 門扉との結合部
      }
      for (let i = 2; i <= N; i++) {
        tube(arm, top(-D.leg, i), top(D.leg, i), 0.9, M.light);
        tube(arm, bot(-D.leg, i), bot(D.leg, i), 0.9, M.light); low(bot(-D.leg, i), bot(D.leg, i));
        tube(arm, top(-D.leg, i - 1), top(D.leg, i), 0.7, M.light);
        tube(arm, bot(D.leg, i - 1), bot(-D.leg, i), 0.7, M.light); low(bot(D.leg, i - 1), bot(-D.leg, i));
      }
      // 門扉: 中空の鋼の壁。海側(外)は平ら、陸側に縦の補剛材と横桁。喫水より下は暗い防汚塗装
      const g0 = GATE_Y.dock;
      add(arcLoft([[GB, g0], [GF, g0], [GF, g0 + 9], [GB, g0 + 9]], -D.H, D.H, 36), M.mid, arm);
      add(arcLoft([[GB, g0 + 9], [GF, g0 + 9], [GF, g0 + D.gh], [GB + 5, g0 + D.gh], [GB, g0 + D.gh - 3]], -D.H, D.H, 36), M.body, arm);
      for (let k = 0; k <= 12; k++) {
        const b = -D.H + 0.03 + (k * (2 * D.H - 0.06)) / 12;
        if (Math.abs(Math.abs(b) - D.leg) < 0.02) continue;   // 結合部と重なる所は省く
        put(box(0.8, D.gh - 6, 4), M.light, arm, polar(GB - 2, b, g0 + 1 + (D.gh - 6) / 2), { ry: b });
      }
      for (const y of [0.25, 0.5, 0.75].map((k) => g0 + D.gh * k)) add(arcLoft([[GB - 2.5, y], [GB, y], [GB, y + 0.8], [GB - 2.5, y + 0.8]], -D.H, D.H, 24), M.light, arm);
      for (const rr of [GF - 0.5, GB + 5.4]) add(arcLoft([[rr - 0.2, g0 + D.gh], [rr + 0.2, g0 + D.gh], [rr + 0.2, g0 + D.gh + 1.1], [rr - 0.2, g0 + D.gh + 1.1]], -D.H + 0.01, D.H - 0.01, 24), M.dark, arm, { edges: false });   // 天端の手すり
      for (let k = 0; k < 7; k++) { const b = s * (-D.H + 0.06 + k * 0.1); put(box(2.6, 0.6, 2.6), M.light, arm, polar(D.R + 2.4, b, g0 + D.gh + 0.3), { ry: b }); }   // 注排水の点検口
      put(box(1.2, D.gh - 2, D.gt - 1), M.dark, arm, polar(D.R, -s * (D.H + 0.6 / 290), g0 + D.gh / 2), { ry: -s * D.H });   // 中央側の端の防舷材

      sides.push({ s, yaw, pitch });

      // 近未来化: アームの付け根の予備電源とセンサー(支点の後ろ、陸側。アームの掃く範囲の外)
      const X = (x) => s * x;
      add(box(80, 0.2, 58), M.light, pv, { x: X(60), y: D.ground + 0.1, z: -67, edges: false });
      for (const [x0, z0, x1, z1] of [[21, -39, 99, -39], [21, -95, 99, -95], [21, -39, 21, -95], [99, -39, 99, -95]]) {   // 柵
        const len = Math.hypot(x1 - x0, z1 - z0), along = x0 === x1;
        for (const y of [4.1, 5.3]) add(box(along ? 0.12 : len, 0.12, along ? len : 0.12), M.dark, pv, { x: X((x0 + x1) / 2), y, z: (z0 + z1) / 2, edges: false });
        for (let k = 0; k <= Math.round(len / 8); k++) { const t = k / Math.round(len / 8); add(box(0.25, 2.4, 0.25), M.dark, pv, { x: X(x0 + (x1 - x0) * t), y: 4.4, z: z0 + (z1 - z0) * t, edges: false }); }
      }
      for (const z of [-60, -66]) {   // 発電機コンテナ 2 基(40 ft)。端に吸排気のルーバー、屋根に放熱器と排気筒
        add(box(12.2, 2.6, 2.44), M.light, pv, { x: X(62), y: 4.5, z });
        for (const e of [-1, 1]) add(box(0.12, 2.2, 2.1), M.dark, pv, { x: X(62 + e * 6.16), y: 4.5, z, edges: false });
        add(box(2.4, 0.7, 2.0), M.mid, pv, { x: X(58.5), y: 6.15, z });
        add(cyl(0.25, 2.4, 8), M.dark, pv, { x: X(65.5), y: 7.0, z });
      }
      add(box(12.2, 2.6, 2.44), M.body, pv, { x: X(84), y: 4.5, z: -63 });   // 蓄電池コンテナ(チーム色の帯、端に空調機)
      add(box(12.25, 0.35, 2.5), M.accent, pv, { x: X(84), y: 5.3, z: -63, edges: false });
      add(box(0.7, 1.6, 1.7), M.mid, pv, { x: X(84 + 6.45), y: 4.2, z: -63 });
      const tankG = cyl(1.6, 9, 14); tankG.rotateZ(Math.PI / 2);   // 燃料タンク(横置き、鞍、防油堤)
      add(tankG, M.body, pv, { x: X(84), y: 5.2, z: -82 });
      for (const e of [-3, 3]) add(box(0.8, 1.4, 2.6), M.dark, pv, { x: X(84 + e), y: 3.9, z: -82 });
      for (const [x, z, w, d] of [[84, -78, 14, 0.4], [84, -86, 14, 0.4], [77, -82, 0.4, 8], [91, -82, 0.4, 8]]) add(box(w, 1.0, d), M.light, pv, { x: X(x), y: 3.7, z });
      add(box(7, 0.4, 6), M.light, pv, { x: X(42), y: 3.4, z: -72 });   // 変圧器(放熱板、ブッシング)
      add(box(4, 3.2, 2.6), M.mid, pv, { x: X(42), y: 5.2, z: -72 });
      for (const e of [-2.25, -2.6, 2.25, 2.6]) add(box(0.12, 2.4, 2.2), M.dark, pv, { x: X(42 + e), y: 5.0, z: -72, edges: false });
      for (const e of [-1.2, 0, 1.2]) add(cyl(0.18, 1.4, 6), M.light, pv, { x: X(42 + e), y: 7.5, z: -72 });
      add(box(1.2, 0.12, 30), M.dark, pv, { x: X(42), y: 3.27, z: -54, edges: false });   // 基礎への配線の樋
      add(box(26, 0.12, 1.2), M.dark, pv, { x: X(29), y: 3.27, z: -39.4, edges: false });
      // センサーの塔(格子の鉄塔。上に箱形のレーダーの覆いと電子光学の窓。回るアンテナは付けない)
      const mt = V(X(30), D.ground, -50), mH = 30, legAt = (sx, sz, t) => V(mt.x + sx * (2.2 - 1.3 * t), mt.y + mH * t, mt.z + sz * (2.2 - 1.3 * t));
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [sx, sz] of corners) tube(pv, legAt(sx, sz, 0), legAt(sx, sz, 1), 0.22, M.mid);
      for (let k = 0; k < 4; k++) for (let c = 0; c < 4; c++) {
        const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4], t0 = k / 4, t1 = (k + 1) / 4;
        tube(pv, legAt(ax, az, t0), legAt(bx, bz, t1), 0.1, M.mid); tube(pv, legAt(bx, bz, t0), legAt(ax, az, t1), 0.1, M.mid);
      }
      add(box(4.2, 0.3, 4.2), M.light, pv, { x: mt.x, y: mt.y + mH + 0.15, z: mt.z });
      add(box(4.3, 0.5, 4.3), M.accent, pv, { x: mt.x, y: mt.y + mH - 0.6, z: mt.z, edges: false });
      add(box(3.4, 1.6, 1.4), M.body, pv, { x: mt.x, y: mt.y + mH + 1.1, z: mt.z + 0.6 });
      add(box(1.2, 1.0, 1.2), M.dark, pv, { x: mt.x - s * 1.0, y: mt.y + mH + 2.4, z: mt.z - 0.4 });
      add(box(0.8, 0.5, 0.1), M.glass, pv, { x: mt.x - s * 1.0, y: mt.y + mH + 2.45, z: mt.z + 0.25, edges: false });
      tube(pv, V(mt.x + s * 1.2, mt.y + mH + 0.3, mt.z - 1.2), V(mt.x + s * 1.2, mt.y + mH + 6, mt.z - 1.2), 0.08, M.dark);   // 避雷針
      // 水位計(岸から水面の上へ腕を出し、下向きの電波式センサー)
      add(cyl(0.3, 7, 8), M.mid, pv, { x: X(-8), y: D.ground + 3.5, z: -44 });
      add(box(13, 0.5, 0.5), M.mid, pv, { x: X(-14), y: 9.7, z: -44 });
      add(box(1.2, 1.2, 1.2), M.dark, pv, { x: X(-19.6), y: 8.9, z: -44 });
      add(box(1.4, 1.8, 0.8), M.light, pv, { x: X(-6), y: D.ground + 0.9, z: -45.5 });
    }

    // ── 管制棟(左岸の奥。自動制御の管制室)と駐車場 ──
    add(box(56, 8, 22), M.body, world, { x: -400, y: 7, z: -75 });
    for (const y of [5.4, 9.0]) add(box(56.2, 1.4, 22.2), M.glass, world, { x: -400, y, z: -75, edges: false });
    add(box(56.4, 0.4, 22.4), M.accent, world, { x: -400, y: 10.4, z: -75, edges: false });
    add(box(56.8, 0.6, 22.8), M.light, world, { x: -400, y: 11.3, z: -75 });
    for (const [x, z, w, d] of [[-414, -79, 8, 6], [-402, -71, 5, 5], [-390, -80, 6, 4]]) add(box(w, 2.2, d), M.mid, world, { x, y: 12.7, z });
    add(cyl(0.25, 12, 6), M.dark, world, { x: -380, y: 17.6, z: -70 });
    for (const y of [19, 21.5]) add(box(0.9, 1.4, 0.6), M.light, world, { x: -380, y, z: -69.6 });
    add(box(10, 0.4, 4), M.light, world, { x: -400, y: 6.6, z: -62 });
    add(box(32, 0.15, 16), M.mid, world, { x: -400, y: 3.08, z: -44, edges: false });

    // ── 制圧圏(地面の点線リングと薄い円盤) ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 姿勢: t = 0(開、ドック)〜 1(閉、敷居) ──
    const ease = (x) => x * x * (3 - 2 * x);
    function pose(t) {
      let yb, sw;
      if (t < PH[0]) { yb = GATE_Y.dock + (GATE_Y.float - GATE_Y.dock) * ease(t / PH[0]); sw = 0; }
      else if (t < PH[1]) { yb = GATE_Y.float; sw = ease((t - PH[0]) / (PH[1] - PH[0])); }
      else { yb = GATE_Y.float + (GATE_Y.sill - GATE_Y.float) * ease((t - PH[1]) / (1 - PH[1])); sw = 1; }
      return { yaw: D.open + (D.closed - D.open) * sw, pitch: Math.asin((GATE_Y.dock - yb) / D.R), yb };
    }
    // アーム座標の点 → 旋回・傾きのあとの支点座標(右岸)
    const tilt = (p, a) => { const dy = p.y - D.ballY; return V(p.x, D.ballY + dy * Math.cos(a) - p.z * Math.sin(a), dy * Math.sin(a) + p.z * Math.cos(a)); };
    const turn = (p, f) => V(p.x * Math.cos(f) + p.z * Math.sin(f), p.y, -p.x * Math.sin(f) + p.z * Math.cos(f));

    let state = opts.state ?? "open", t = state === "closed" ? 1 : 0;
    function apply() {
      const p = pose(t);
      for (const sd of sides) { sd.yaw.rotation.y = sd.s * p.yaw; sd.pitch.rotation.x = p.pitch; }
    }
    apply();
    function update(dt) {
      if (state === "closing") { t = Math.min(1, t + dt / SEC); if (t >= 1) state = "closed"; }
      if (state === "opening") { t = Math.max(0, t - dt / SEC); if (t <= 0) state = "open"; }
      apply();
      M.river.map.offset.y -= dt * (0.03 + 0.25 * (1 - ease(t)));   // 閉じると川の流れが止まる
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "open" || s === "closed") { state = s; t = s === "closed" ? 1 : 0; apply(); }
      else if (s === "closing" || s === "opening") state = s;
    }
    const setTeam = (color) => F.setTeam(M, color);
    function stage() {
      if (state === "closing") return t < PH[0] ? "門扉を排水して浮上" : t < PH[1] ? "門扉を水路へ押し出す" : "注水して敷居へ沈める";
      if (state === "opening") return t > PH[1] ? "門扉を排水して浮上" : t > PH[0] ? "門扉をドックへ戻す" : "注水してドックの床へ下ろす";
      return "";
    }

    // 地面の高さ(m、右岸の向きに折り返して見る)。check でアームの下の隙間を測る
    function groundY(x, z) {
      const ax = Math.abs(x), dx = ax - D.px, r = Math.hypot(dx, z), b = Math.atan2(dx, z);
      if (r >= D.dock[0] && r <= D.dock[1] && b >= -0.09 && b <= D.dockEnd) return b >= DF0 ? D.dockFloor : D.bed;
      if (r < 9.5) return 12.5;   // 受け台
      if (ax < D.river) return D.bed;
      if (ax < D.toe) return D.bed + ((ax - D.river) / (D.toe - D.river)) * (D.toeY - D.bed);
      if (ax < D.bank) return D.toeY + ((ax - D.toe) / (D.bank - D.toe)) * (D.ground - D.toeY);
      if (dx >= -16 && dx <= 28 && z >= -34 && z <= 14) return 9;   // 基礎
      if (r >= 271 && r <= 309 && b >= -0.04 && b <= D.dockEnd) return 3.3;   // 笠石
      return D.ground;
    }
    function check() {
      let armGround = Infinity, at = null;
      for (let k = 0; k <= 50; k++) {
        const tt = k / 50, p = pose(tt);
        for (const [a, b] of lowSegs) for (let i = 0; i <= 16; i++) {
          const q = turn(tilt(a.clone().lerp(b, i / 16), p.pitch), p.yaw), c = q.y - groundY(q.x + D.px, q.z);
          if (c < armGround) { armGround = c; at = { t: +tt.toFixed(2), x: +(q.x + D.px).toFixed(1), z: +q.z.toFixed(1) }; }
        }
      }
      const inner = D.px - (D.R + D.gt / 2) * Math.sin(-D.closed + D.H);   // 閉じたときの中央側の端(海側の面)の x
      const r1 = (v) => +v.toFixed(2);
      return {
        armOverGround_m: r1(armGround), armOverGroundAt: at,                       // アームの下側の部材と地面(笠石・基礎を含む)の最小の隙間
        gateGapCenter_m: r1(2 * inner),                                            // 閉じたときの中央の隙間(実物は約 1.5 m)
        dockClearInner_m: r1((D.open - D.H - mouth(D.dock[0])) * (D.R - D.gt / 2)),             // 待機中の門扉とドック口・奥の壁の隙間
        dockClearEnd_m: r1((D.dockEnd - D.open - D.H) * (D.R + D.gt / 2)),
        dockSideGap_m: Math.min(D.R - D.gt / 2 - D.dock[0], D.dock[1] - D.R - D.gt / 2),   // 門扉の背・表とドックの壁の隙間
        bankEndClosed_x: r1(D.px - D.R * Math.sin(-D.closed - D.H)),               // 閉じたときの岸側の端(ドック口の中、x < 195 なら水路側)
        gateBottom: { dock: GATE_Y.dock - D.dockFloor, sill: GATE_Y.sill - D.sill }, // 着底したときの下端と床・敷居の差(0 = 接地)
        closedBankEndToDockFloor_rad: r1(DF0 - (D.closed + D.H)),                // 閉じた門扉の岸側の端とドックの床の始まり(正 = 床に当たらない)
      };
    }

    U.bake(THREE, group, { dynamic: sides.flatMap((sd) => [sd.yaw, sd.pitch]), live: [M.accent], also: [M.lamp] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);   // m の座標 → 模型の座標(ビューアの寄りの視点で使う)
    return {
      group, update, setTeam, setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; }, get progress() { return t; }, get stage() { return stage(); },
      shots: {
        joint: { label: "付け根(継手・予備電源)", target: [222, 10, -35], pos: [345, 70, -175] },
        truss: { label: "アームのトラス", target: [290, 8, 150], pos: [470, 95, 40] },
        dock: { label: "ドックの門扉(開)", target: [380, 18, 230], pos: [300, 90, 380] },
        center: { label: "中央(閉)", target: [0, 2, 240], pos: [70, 120, 540] },
      },
    };
  }

  DreamAssets.fac.register("maeslant", {
    section: 2, title: "マエスラントケーリング", kind: "STRATEGIC FACILITY · 2 水門・閘門・防潮堤",
    desc: "ロッテルダムの可動式防潮堤。両岸のドックに横たわる長さ 210 m の門扉を、237 m のトラスのアームごと球面継手まわりに回して水路を閉じる。付け根に予備電源とセンサー群を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/maeslant.js"], ["大きさ", "実寸 920 × 480 m を 0.2 倍 × 表示 3.0"], ["誇張", "門扉の高さ 2 倍(44 m)・厚さ 1.5 倍、トラスの背を門扉の天端まで、球面継手 1.8 倍、管を太く。平面の配置は実寸"], ["省略", "門扉を押す機関車・レール・駆動装置"], ["動作", "浮上 → 押し出し → 敷居へ沈む(閉鎖 16 秒)"], ["近未来化", "発電機・蓄電池・燃料タンク・変圧器、センサーの塔、水位計"]],
    dist: 1150, target: 30, tokenAt: [430, 0, 330],
    make: (THREE) => maeslant(THREE, { r: 110 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["開", () => a.setState("open"), () => a.state === "open"], ["閉鎖 ▶", () => a.setState("closing"), () => a.state === "closing"], ["閉", () => a.setState("closed"), () => a.state === "closed"], ["◀ 開放", () => a.setState("opening"), () => a.state === "opening"]],
    caption: (a) => (a.stage ? (a.state === "closing" ? "閉鎖中 — " : "開放中 — ") + a.stage : ""),
    ringParts: (a) => [a.parts.ring, a.parts.disc],
  });
})();
