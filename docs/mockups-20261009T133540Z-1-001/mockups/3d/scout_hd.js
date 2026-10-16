// 部隊「偵察」の高詳細・写実版(試作。PC 表示向け)。scout.js(盤面の模型の画風)と同じ車両・同じ寸法・同じ動きを、模型の約束(白・灰の Lambert、輪郭線、光る継ぎ目)を外して
// 実車に寄せて作り込んだもの。下敷きは Fennek(4×4 の装輪偵察車)。ゲームの盤面用ではなく、PC のビューアで寄って見る用。
//   材質: 物理ベース(MeshStandardMaterial)。塗装は 3 色迷彩 / オリーブ / 砂漠 / ステルス(ゲーム色)をシェーダーで塗り分け、
//     下ほど濃くなる砂ぼこりと汚れのむらを重ねる(画像ファイルは使わない)。ガラスは環境を映す暗い防弾ガラス、灯火は透明レンズの奥に反射鏡。
//   足回り: 断面を回したタイヤ(肩の丸み、方向性のブロック)、ビードロックのリムとナット、空気圧調整の回転継手とホース。
//     ダブルウィッシュボーンの腕・ダンパーとコイルばね・駆動軸・タイロッドは毎フレーム車体と車輪の間に張り直す(車体の揺れ・前輪の操舵に追従)。
//   車体: 面取りした装甲板、継ぎ目とボルト、防弾ガラスの枠とワイパー、前照灯・方向指示器・尾灯・反射板、ミラー、牽引環とシャックル、
//     雑具箱の扉と蝶番・取っ手、スコップ・つるはし・牽引索、ハッチと潜望鏡、発煙弾発射機、レーザー警報器、吸気ルーバー、消音器、
//     アンテナ(ばねの台座)、偽装網の巻き物、燃料缶(X の補強)、後面の扉、牽引フック。チーム色は布の対空識別板と山形の識別標識だけ。
//   銃塔: 12.7mm 重機関銃(機関部・放熱孔つきの銃身支え・消炎器・握り・装填ハンドル)、外付けの弾薬箱と給弾ベルトの樋、照準センサー、配線。
//   マスト: 3 段の伸縮柱と巻きばね状の配線、電子光学の頭部(熱線のゲルマニウム窓・昼間カメラ・レーザー測距、日よけ、取っ手)。
//
//   const s = DreamAssets.scoutHD(THREE);
//   scene.add(s.group); s.setTeam(0xff6a1a); s.setPaint("camo" | "olive" | "desert" | "stealth"); s.setMast(true); s.fireGun(); s.update(dt)
//
// 前方 = +z、上 = +y。寸法は scout.js と同じ(全長 約 31、幅 約 14。表示倍率 2.0 前提)。PC 向けなので描画呼び出し・三角形の目安は盤面用より大きい。
(function () {
  function scoutHD(THREE, opts = {}) {
    const U = DreamAssets.util;
    const K = U.realKit(THREE, { sign: "偵" });
    const { M, STATIC, std, patch, V, UP, add, box, cyl, cylX, cylZ, cbox, rod, pipe, grab, seam, bolt, boltRow } = K;
    const group = new THREE.Group(); group.name = "scoutHD";
    const body = new THREE.Group(); group.add(body);   // 揺れる上の部分(車輪は group に残る = 懸架)
    K.parent = body;
    const B = (geo, mat, o = {}) => add(geo, mat, o.parent ?? body, o);

    // ── ベースプレート(ゲームと同じ。ビューアの切替で消せる) ──
    const plate = new THREE.Group(); group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };

    // ── 車体(scout.js と同じ断面に面取りを足す) ──
    B(U.loft(THREE, [
      { z: 14.6, pts: U.sym([[3.0, 3.0], [3.2, 4.5]]) },
      { z: 12.0, pts: U.sym([[3.4, 2.3], [3.4, 6.0]]) },
      { z: -11.8, pts: U.sym([[3.4, 2.3], [3.4, 6.0]]) },
      { z: -14.6, pts: U.sym([[3.2, 3.0], [3.2, 4.6]]) },
    ]), M.metal);
    const sec = (z, b, t, w, wt) => {
      const sh = b + (t - b) * 0.42, c = Math.min(0.25, (sh - b) * 0.5), ct = Math.min(0.1, (t - sh) * 0.4);
      return { z, pts: U.sym([[w - c, b], [w, b + c], [w + 0.2, sh], [wt + ct * 2.2, t - ct], [wt, t]]) };
    };
    const HULL = [sec(15.6, 4.4, 5.5, 5.6, 4.0), sec(12.4, 4.2, 6.1, 7.0, 5.2), sec(11.6, 5.9, 6.26, 7.0, 5.3), sec(7.6, 5.9, 7.0, 7.0, 5.3), sec(4.6, 5.9, 8.4, 7.0, 5.0),
      sec(-9.0, 5.9, 8.4, 7.0, 5.0), sec(-11.6, 5.9, 8.0, 7.0, 5.0), sec(-12.4, 4.4, 7.85, 6.9, 5.0), sec(-15.4, 4.6, 7.4, 6.4, 4.6)];
    B(U.loft(THREE, HULL), M.paint);
    const ROOF = 8.4;
    const topY = (z) => z >= 7.6 ? 7.0 - (z - 7.6) * 1.5 / 8 : z >= 4.6 ? ROOF - (z - 4.6) * 1.4 / 3 : z >= -9 ? ROOF : z >= -11.6 ? ROOF - (-9 - z) * 0.4 / 2.6 : z >= -12.4 ? 8.0 - (-11.6 - z) * 0.15 / 0.8 : 7.85 - (-12.4 - z) * 0.45 / 3;
    const topRX = (z) => z >= 7.6 ? Math.atan(1.5 / 8) : z >= 4.6 ? Math.atan(1.4 / 3) : z >= -9 ? 0 : z >= -11.6 ? -Math.atan(0.4 / 2.6) : z >= -12.4 ? -Math.atan(0.15 / 0.8) : -Math.atan(0.45 / 3);
    const topN = (z) => V(0, Math.cos(topRX(z)), Math.sin(topRX(z)));          // 上面の外向き
    const onTop = (geo, mat, x, z, h, o = {}) => B(geo, mat, { x, z, y: topY(z) + h / 2 - 0.06, rx: topRX(z), ...o });
    const topPt = (x, z, off = 0.02) => V(x, topY(z) + off, z);
    // 肩の斜面(z 4.6〜-9 は断面が同じ)。p = 斜面の下端 0 〜 上端 1、off = 面から外へ
    const S0 = [7.2, 6.95], S1 = [5.0, ROOF], sd = [S1[0] - S0[0], S1[1] - S0[1]], sL = Math.hypot(...sd), sn = [sd[1] / sL, -sd[0] / sL], sAng = Math.atan2(sn[1], sn[0]);
    const slope = (sx, p, z, off = 0) => V(sx * (S0[0] + sd[0] * p + sn[0] * off), S0[1] + sd[1] * p + sn[1] * off, z);
    const slopeN = (sx) => V(sx * sn[0], sn[1], 0);
    const onSlope = (sx, p, z, off) => { const g = new THREE.Group(); g.position.copy(slope(sx, p, z, off)); g.rotation.z = sx > 0 ? sAng : Math.PI - sAng; body.add(g); return g; };   // 子の +x が面の外向き、+y が斜面の上向き
    // 車体の継ぎ目: 屋根と斜面の境、ボンネットの後ろ
    for (const sx of [-1, 1]) seam(slope(sx, 0.995, 4.4, 0.02), slope(sx, 0.995, -8.8, 0.02));
    seam(topPt(-5.0, 7.5), topPt(5.0, 7.5));
    for (const sx of [-1, 1]) boltRow(body, slope(sx, 0.97, 4.0, 0.0), slope(sx, 0.97, -8.4, 0.0), 14, slopeN(sx), 0.9);

    // ── 前: ボンネット(点検板の継ぎ目・蝶番・留め金・吊り環)、対空識別板(チーム色の布)、風防 ──
    for (const [a, b] of [[[-3.3, 9.0], [3.3, 9.0]], [[3.3, 9.0], [3.3, 14.6]], [[3.3, 14.6], [-3.3, 14.6]], [[-3.3, 14.6], [-3.3, 9.0]]]) seam(topPt(a[0], a[1]), topPt(b[0], b[1]));
    rod(topPt(-2.6, 9.2, 0.12), topPt(2.6, 9.2, 0.12), 0.1, M.metal, body, 10);
    for (const sx of [-1, 1]) {
      onTop(cbox(0.6, 0.2, 0.45, 0.05), M.metal, sx * 2.0, 14.35, 0.2);
      const eye = B(new THREE.TorusGeometry(0.26, 0.08, 6, 14), M.steel, { x: sx * 4.1, y: topY(13.8) + 0.24, z: 13.8, ry: Math.PI / 2 });
      onTop(cbox(0.5, 0.18, 0.6, 0.04), M.metal, sx * 4.1, 13.8, 0.18); eye.rotation.x = topRX(13.8);
      grab(topPt(sx * 4.6, 11.0), topPt(sx * 4.6, 9.6), topN(10.3), 0.32);
    }
    // 対空識別板: ボンネットに張った布。四隅の締め紐、折り目
    onTop(box(5.2, 0.05, 2.5), M.team, 0, 12.6, 0.17);
    for (const t of [-0.3, 0.3]) onTop(box(5.2, 0.03, 0.08), M.team, 0, 12.6 + t * 2.5, 0.2);
    for (const sx of [-1, 1]) for (const dz of [-1.15, 1.15]) onTop(box(0.14, 0.08, 0.5), M.strap, sx * 2.62, 12.6 + dz, 0.22);
    // 風防: 厚い防弾ガラス 2 枚(面から 0.18 浮く)、ゴムの縁、金属の枠とボルト、ワイパー
    const pane = (x0, x1) => {
      const p = (z) => { const y = topY(z); return { z, pts: [[x0, y - 0.12], [x1, y - 0.12], [x1, y + 0.18], [x0, y + 0.18]] }; };
      B(U.loft(THREE, [p(7.2), p(5.0)]), M.glass);
      const c = [[x0 - 0.1, 7.32], [x1 + 0.1, 7.32], [x1 + 0.1, 4.88], [x0 - 0.1, 4.88]].map(([x, z]) => topPt(x, z, 0.12));
      for (let i = 0; i < 4; i++) rod(c[i], c[(i + 1) % 4], 0.11, M.trim, body, 6);
      boltRow(body, topPt(x0, 7.32, 0.2), topPt(x1, 7.32, 0.2), 5, topN(7.3), 0.8); boltRow(body, topPt(x0, 4.88, 0.2), topPt(x1, 4.88, 0.2), 5, topN(4.9), 0.8);
      const piv = topPt((x0 + x1) / 2 + 1.0, 7.18, 0.25), tip = topPt((x0 + x1) / 2 - 0.4, 5.6, 0.25);
      rod(piv, tip, 0.04, M.black, body, 6); rod(tip.clone().add(V(-0.9, 0.0, 0.2)), tip.clone().add(V(0.9, 0, -0.2)), 0.05, M.black, body, 6);
      B(cyl(0.1, 0.12, 8), M.black, { x: piv.x, y: piv.y, z: piv.z, rx: topRX(7.18) });
    };
    pane(-3.7, -0.3); pane(0.3, 3.7);
    rod(topPt(0, 7.3, 0.14), topPt(0, 4.9, 0.14), 0.13, M.trim, body, 6);

    // 前面: 前照灯(反射鏡と透明レンズ、防護の格子)、方向指示器、車幅灯、バンパー、牽引環とシャックル、鼻の下の防護板、ミラー
    for (const sx of [-1, 1]) {
      B(cbox(2.1, 0.95, 0.5, 0.08), M.trim, { x: sx * 3.45, y: 4.95, z: 15.5 });
      for (const [dx, r] of [[-0.45, 0.32], [0.35, 0.26]]) {
        B(cylZ(r * 0.95, 0.06, 18), M.chrome, { x: sx * (3.45 + dx), y: 4.95, z: 15.74 });
        B(cylZ(r, 0.1, 18), M.lamp, { x: sx * (3.45 + dx), y: 4.95, z: 15.78 });
        B(new THREE.TorusGeometry(r, 0.05, 6, 18), M.black, { x: sx * (3.45 + dx), y: 4.95, z: 15.8 });
      }
      B(cbox(0.38, 0.26, 0.12, 0.03), M.amber, { x: sx * 4.35, y: 4.95, z: 15.76 });
      for (const dx of [-0.8, -0.25, 0.3]) rod(V(sx * (3.45 + dx), 4.5, 15.95), V(sx * (3.45 + dx), 5.4, 15.95), 0.035, M.black, body, 5);
      rod(V(sx * 2.4, 4.48, 15.95), V(sx * 4.5, 4.48, 15.95), 0.04, M.black, body, 5); rod(V(sx * 2.4, 5.42, 15.95), V(sx * 4.5, 5.42, 15.95), 0.04, M.black, body, 5);
      for (const dx of [2.4, 4.5]) for (const y of [4.48, 5.42]) rod(V(sx * dx, y, 15.95), V(sx * dx, y, 15.6), 0.04, M.black, body, 5);
      // 牽引環とシャックル
      B(cbox(0.9, 0.7, 0.8, 0.06), M.metal, { x: sx * 2.4, y: 3.7, z: 14.95 });
      B(new THREE.TorusGeometry(0.34, 0.1, 8, 16), M.steel, { x: sx * 2.4, y: 3.7, z: 15.55, ry: Math.PI / 2 });
      B(new THREE.TorusGeometry(0.28, 0.07, 6, 14, Math.PI), M.steel, { x: sx * 2.4, y: 3.42, z: 15.75, rz: Math.PI, ry: Math.PI / 2 });
      rod(V(sx * 2.4 - 0.3, 3.42, 15.75), V(sx * 2.4 + 0.3, 3.42, 15.75), 0.06, M.steel, body, 6);
      // ミラー(腕、箱、後ろ向きの鏡)
      pipe([V(sx * 6.75, 6.35, 8.9), V(sx * 7.4, 6.5, 8.85), V(sx * 8.05, 6.75, 8.65)], 0.07, M.black, body, 10, 6);
      B(cbox(0.32, 1.15, 0.85, 0.07), M.trim, { x: sx * 8.35, y: 6.9, z: 8.6 });
      B(box(0.24, 0.98, 0.04), M.chrome, { x: sx * 8.35, y: 6.9, z: 8.16 });
    }
    B(cbox(9.8, 0.62, 0.55, 0.08), M.metal, { y: 4.45, z: 15.62 });
    boltRow(body, V(-4.4, 4.45, 15.9), V(4.4, 4.45, 15.9), 9, V(0, 0, 1), 0.9);
    B(cbox(1.0, 0.3, 0.12, 0.03), M.amber, { y: 4.45, z: 15.92 });                                       // 車列灯
    B(box(6.4, 0.15, 2.4), M.metal, { y: 2.85, z: 14.2, rx: -0.45 });                                   // 鼻の下の防護板

    // ── 側面: 側窓(枠とボルト)、雑具箱(扉・蝶番・取っ手)、工具、牽引索、山形の識別標識、給油口 ──
    { const [x1, y1] = [S0[0] + sd[0] * 0.28 + sn[0] * 0.12, S0[1] + sd[1] * 0.28 + sn[1] * 0.12], [x2, y2] = [S0[0] + sd[0] * 0.8 + sn[0] * 0.12, S0[1] + sd[1] * 0.8 + sn[1] * 0.12];
      const w = (z) => ({ z, pts: [[-x1, y1], [x1, y1], [x2, y2], [-x2, y2]] }); B(U.loft(THREE, [w(4.0), w(-0.8)]), M.glass); }
    for (const sx of [-1, 1]) {
      const c = [[0.23, 4.1], [0.85, 4.1], [0.85, -0.9], [0.23, -0.9]].map(([p, z]) => slope(sx, p, z, 0.1));
      for (let i = 0; i < 4; i++) rod(c[i], c[(i + 1) % 4], 0.1, M.trim, body, 6);
      boltRow(body, slope(sx, 0.2, 3.8, 0.02), slope(sx, 0.2, -0.6, 0.02), 6, slopeN(sx), 0.8);
      boltRow(body, slope(sx, 0.88, 3.8, 0.02), slope(sx, 0.88, -0.6, 0.02), 6, slopeN(sx), 0.8);
      // 山形の識別標識(チーム色の塗装)
      const ch = onSlope(sx, 0.5, -5.2, 0.02);
      for (const a of [-0.55, 0.55]) add(box(0.04, 0.32, 1.8), M.teamPaint, ch, { y: a * 0.75, z: 0, rx: a });
      // 給油口(右の後ろ)
      if (sx > 0) { const g = onSlope(sx, 0.4, -7.6, 0); add(cylX(0.42, 0.12, 16), M.trim, g, { x: 0.06 }); add(cylX(0.3, 0.12, 12), M.black, g, { x: 0.14 }); }
      // 雑具箱(車輪の間)。扉 2 枚、上の蝶番、T 字の取っ手、ボルト
      B(cbox(3.5, 2.48, 10.2, 0.1), M.trim, { x: sx * 5.15, y: 4.64, z: -0.1 });
      const fx = sx * 6.91;
      seam(V(fx, 3.5, -0.1), V(fx, 5.75, -0.1)); seam(V(fx, 3.55, -5.0), V(fx, 3.55, 4.8));
      for (const [z0, z1] of [[-4.9, -0.3], [0.1, 4.7]]) {
        rod(V(fx, 5.65, z0), V(fx, 5.65, z1), 0.09, M.metal, body, 8);
        const zm = (z0 + z1) / 2; B(box(0.12, 0.5, 0.16), M.metal, { x: fx + sx * 0.06, y: 4.05, z: zm }); rod(V(fx + sx * 0.14, 4.05, zm - 0.35), V(fx + sx * 0.14, 4.05, zm + 0.35), 0.05, M.steel, body, 6);
      }
      boltRow(body, V(fx, 5.85, -4.8), V(fx, 5.85, 4.6), 12, V(sx, 0, 0), 0.8);
      if (sx < 0) {   // 左: スコップとつるはし(留め金つき)
        const ox = fx - 0.16;
        rod(V(ox, 4.95, -4.6), V(ox, 4.95, -0.9), 0.1, M.canvas, body, 8);
        B(cbox(0.08, 1.0, 1.25, 0.03), M.black, { x: ox, y: 4.95, z: -0.3 });
        rod(V(ox, 4.25, 0.5), V(ox, 4.25, 4.0), 0.11, M.canvas, body, 8);
        B(cbox(0.12, 1.6, 0.28, 0.04), M.black, { x: ox, y: 4.25, z: 4.15 });
        for (const z of [-3.6, -1.6, 1.2, 3.2]) B(cbox(0.2, 0.5, 0.22, 0.04), M.metal, { x: fx - 0.05, y: z < 0 ? 4.95 : 4.25, z });
      } else {        // 右: 牽引索の輪(端の環、留め具)
        const ox = fx + 0.14;
        pipe([V(ox, 5.2, -4.3), V(ox, 5.25, 0), V(ox, 5.2, 4.3), V(ox, 4.6, 4.75), V(ox, 4.0, 4.3), V(ox, 3.95, 0), V(ox, 4.0, -4.3), V(ox, 4.55, -4.75)], 0.12, M.steel, body, 64, 8, true);
        for (const z of [-2.5, 2.5]) B(cbox(0.14, 1.5, 0.2, 0.04), M.metal, { x: fx + 0.05, y: 4.6, z });
      }
    }

    // ── 屋根: ハッチ 2(縁・蝶番・取っ手・潜望鏡)、発煙弾発射機 4 連 ×2、レーザー警報器、取っ手 ──
    for (const sx of [-1, 1]) {
      const hx = sx * 2.6, hz = -3.0;
      onTop(cyl(1.3, 0.1, 24), M.metal, hx, hz, 0.1);
      onTop(cyl(1.12, 0.2, 24), M.trim, hx, hz, 0.28);
      B(new THREE.TorusGeometry(1.12, 0.06, 6, 24), M.black, { x: hx, y: ROOF + 0.17, z: hz, rx: Math.PI / 2 });
      onTop(cbox(0.5, 0.35, 1.2, 0.06), M.metal, hx + sx * 1.2, hz, 0.35);                              // 蝶番
      grab(V(hx - 0.4, ROOF + 0.3, hz - 0.4), V(hx + 0.4, ROOF + 0.3, hz - 0.4), UP, 0.22, 0.05);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; bolt(body, V(hx + Math.cos(a) * 1.22, ROOF + 0.03, hz + Math.sin(a) * 1.22), UP, 0.7); }
      for (const dx of [-0.75, 0, 0.75]) {   // 潜望鏡(覆いと前面のガラス)
        const z = hz + 1.55 - Math.abs(dx) * 0.3;
        onTop(cbox(0.62, 0.5, 0.48, 0.05), M.trim, hx + dx, z, 0.5, { ry: -dx * 0.4 });
        B(box(0.46, 0.26, 0.04), M.glass, { x: hx + dx + Math.sin(-dx * 0.4) * 0.25, y: ROOF + 0.3, z: z + Math.cos(dx * 0.4) * 0.25, ry: -dx * 0.4 });
      }
      // 発煙弾発射機: 台座、2 × 2 の筒(端にふた)、配線
      const dir = V(sx * 0.5, 0.5, 0.7).normalize();
      onTop(cbox(1.7, 0.45, 1.5, 0.08), M.trim, sx * 4.1, 3.4, 0.45);
      for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
        const base = V(sx * 4.1 + a * 1.3, ROOF + 0.55, 3.4 + b * 1.6), q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
        const t = new THREE.Mesh(cyl(0.21, 1.1, 14), M.metal); t.position.copy(base).addScaledVector(dir, 0.55); t.quaternion.copy(q); body.add(t);
        const cap = new THREE.Mesh(cyl(0.24, 0.12, 14), M.black); cap.position.copy(base).addScaledVector(dir, 1.12); cap.quaternion.copy(q); body.add(cap);
      }
      pipe([V(sx * 3.3, ROOF + 0.4, 2.7), V(sx * 3.0, ROOF + 0.12, 2.2), V(sx * 2.4, ROOF + 0.08, 1.6)], 0.05, M.black, body, 10, 5);
      // レーザー警報器(台座と半球の窓)
      onTop(cyl(0.38, 0.35, 12), M.trim, sx * 4.2, -8.4, 0.35);
      B(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.lens, { x: sx * 4.2, y: ROOF + 0.32, z: -8.4 });
      // 屋根の縁の取っ手
      grab(V(sx * 4.75, ROOF + 0.02, -5.0), V(sx * 4.75, ROOF + 0.02, -6.6), UP, 0.3);
    }

    // ── 後ろ: 機関室の吸気ルーバー(枠・羽板・奥の暗がり)、消音器(遮熱板と排気口)、アンテナ 2、偽装網の巻き物 ──
    for (const [z, d] of [[-10.7, 1.8], [-12.0, 0.8], [-13.0, 1.2]]) onTop(box(5.8, 0.03, d), M.seam, -0.4, z, 0.13);
    for (const [a, b] of [[[-3.3, -9.8], [2.5, -9.8]], [[-3.3, -13.6], [2.5, -13.6]], [[-3.3, -9.8], [-3.3, -13.6]], [[2.5, -9.8], [2.5, -13.6]]]) rod(topPt(a[0], a[1], 0.12), topPt(b[0], b[1], 0.12), 0.1, M.trim, body, 6);
    for (let k = 0; k < 13; k++) { const z = -10.05 - k * 0.27; onTop(box(5.7, 0.05, 0.24), M.metal, -0.4, z, 0.2, { rx: topRX(z) - 0.5 }); }
    boltRow(body, topPt(-3.3, -9.65, 0.08), topPt(2.5, -9.65, 0.08), 8, topN(-9.65), 0.8);
    B(cylZ(0.48, 1.6, 18), M.black, { x: 3.95, y: topY(-13.4) + 0.6, z: -13.4, rx: topRX(-13.4) });     // 消音器(アンテナの台座の後ろ)
    B(new THREE.CylinderGeometry(0.62, 0.62, 1.4, 18, 1, true, -Math.PI * 0.15, Math.PI * 1.3).rotateX(Math.PI / 2).rotateZ(Math.PI * 0.35), M.metal, { x: 3.95, y: topY(-13.4) + 0.6, z: -13.4, rx: topRX(-13.4) });
    for (const z of [-12.85, -13.95]) rod(V(3.95, topY(z) + 0.0, z), V(3.95, topY(z) + 0.3, z), 0.12, M.metal, body, 6);
    pipe([V(3.95, topY(-14.2) + 0.6, -14.2), V(4.2, topY(-14.65) + 0.75, -14.65), V(4.5, topY(-14.95) + 1.0, -14.95)], 0.18, M.black, body, 10, 10);
    const ANT = { x: 4.2, z: -12.1, len: 6.5, rx: -0.18 };
    for (const sx of [-1, 1]) {
      const by = topY(ANT.z) + 0.25;
      onTop(cbox(0.8, 0.4, 0.8, 0.06), M.trim, sx * ANT.x, ANT.z, 0.4);
      B(cyl(0.18, 0.7, 10), M.black, { x: sx * ANT.x, y: by + 0.5, z: ANT.z });                          // ばねの台座
      for (let k = 0; k < 6; k++) B(new THREE.TorusGeometry(0.2, 0.035, 5, 10), M.steel, { x: sx * ANT.x, y: by + 0.2 + k * 0.12, z: ANT.z, rx: Math.PI / 2 });
      const a = V(sx * ANT.x, by + 0.85, ANT.z), b = a.clone().add(V(0, ANT.len * Math.cos(ANT.rx), ANT.len * Math.sin(ANT.rx)));
      const w = new THREE.Mesh(cyl(0.03, ANT.len, 6, 0.08), M.black); w.position.copy(a).add(b).multiplyScalar(0.5); w.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); body.add(w);
      B(new THREE.SphereGeometry(0.07, 8, 6), M.black, { x: b.x, y: b.y, z: b.z });
    }
    // 偽装網の巻き物(締め帯 2)
    B(cylX(0.55, 4.8, 18), M.canvas, { x: -1.7, y: topY(-14.5) + 0.5, z: -14.5, rx: 0 });
    for (const x of [-3.4, 0.0]) B(new THREE.TorusGeometry(0.58, 0.06, 6, 18), M.strap, { x, y: topY(-14.5) + 0.5, z: -14.5, ry: Math.PI / 2 });
    for (const x of [-3.6, -2.5, -1.2, 0.3]) B(new THREE.TorusGeometry(0.56, 0.03, 4, 18), M.canvas, { x, y: topY(-14.5) + 0.5, z: -14.5, ry: Math.PI / 2 });

    // ── 後面: 扉(蝶番・取っ手・のぞき窓)、燃料缶 2(X の補強・取っ手・ふた、架台と締め帯)、尾灯(3 灯)と反射板、牽引フック、ソケット、泥よけ ──
    B(cbox(4.4, 2.2, 0.22, 0.06), M.trim, { x: 1.2, y: 5.9, z: -15.48 });
    for (const y of [5.15, 6.65]) B(cyl(0.12, 0.5, 10), M.metal, { x: 3.48, y, z: -15.58 });                   // 蝶番
    B(box(0.18, 0.6, 0.14), M.metal, { x: -0.6, y: 5.9, z: -15.66 }); rod(V(-0.6, 5.9, -15.75), V(-0.1, 5.9, -15.75), 0.05, M.steel, body, 6);
    B(box(1.0, 0.36, 0.06), M.glass, { x: 1.4, y: 6.55, z: -15.61 });
    boltRow(body, V(-0.85, 6.88, -15.6), V(3.25, 6.88, -15.6), 7, V(0, 0, -1), 0.7);
    for (const x of [-2.8, -4.4]) {
      B(cbox(1.3, 1.85, 0.72, 0.07), M.trim, { x, y: 5.62, z: -15.78 });
      for (const a of [-1, 1]) B(box(0.12, 1.9, 0.04), M.trim, { x, y: 5.6, z: -16.15, rz: a * 0.6 });
      for (const dx of [-0.35, 0, 0.35]) rod(V(x + dx, 6.55, -15.62), V(x + dx, 6.55, -15.95), 0.05, M.trim, body, 5);
      B(cyl(0.16, 0.18, 10), M.black, { x: x + 0.45, y: 6.6, z: -15.65 });
      rod(V(x - 0.72, 4.65, -15.45), V(x + 0.72, 4.65, -15.45), 0.06, M.metal, body, 6);
      B(box(1.44, 0.2, 0.84), M.strap, { x, y: 5.95, z: -15.78 }); B(box(0.3, 0.28, 0.1), M.steel, { x, y: 5.95, z: -16.22 });
    }
    for (const sx of [-1, 1]) {
      B(cbox(0.9, 0.95, 0.2, 0.05), M.black, { x: sx * 5.6, y: 6.2, z: -15.47 });
      [[0.25, M.red], [0, M.amber], [-0.25, M.red]].forEach(([dy, m]) => B(box(0.65, 0.18, 0.06), m, { x: sx * 5.6, y: 6.2 + dy, z: -15.6 }));
      B(cylZ(0.17, 0.05, 14), M.red, { x: sx * 5.7, y: 5.2, z: -15.47 });
      B(cbox(0.7, 0.7, 0.9, 0.06), M.metal, { x: sx * 3.0, y: 3.7, z: -14.95 });
      B(new THREE.TorusGeometry(0.3, 0.09, 8, 14), M.steel, { x: sx * 3.0, y: 3.7, z: -15.45, ry: Math.PI / 2 });
    }
    B(cbox(1.2, 0.9, 0.7, 0.06), M.metal, { y: 3.6, z: -14.95 });                                       // 牽引フック
    B(new THREE.TorusGeometry(0.32, 0.12, 8, 16, Math.PI * 1.4), M.steel, { y: 3.45, z: -15.6, ry: Math.PI / 2, rx: 0.4 });
    B(cylZ(0.22, 0.3, 12), M.black, { x: 1.6, y: 4.0, z: -15.0 });                                     // 連結ソケット

    // ── 足回り: 4 輪(タイヤ・リム・ハブ・ナット・空気圧調整のホース)。knuckle = 操舵、spin = 回転 ──
    const W = { r: 2.7, w: 2.0, x: 6.0, y: 2.7, axles: [8.4, -8.6], lug: 0.24 };
    const tireG = new THREE.LatheGeometry([[1.76, -0.96], [2.05, -1.02], [2.35, -1.03], [2.55, -0.98], [2.66, -0.86], [2.70, -0.65], [2.70, 0.65], [2.66, 0.86], [2.55, 0.98], [2.35, 1.03], [2.05, 1.02], [1.76, 0.96], [1.76, -0.96]].map(([r, y]) => new THREE.Vector2(r, y)), 56).rotateZ(Math.PI / 2);
    const rimG = new THREE.LatheGeometry([[1.6, -0.99], [1.92, -0.99], [1.92, -0.9], [1.74, -0.86], [1.74, 0.86], [1.92, 0.9], [1.92, 0.99], [1.6, 0.99], [1.6, -0.99]].map(([r, y]) => new THREE.Vector2(r, y)), 40).rotateZ(Math.PI / 2);
    const tread = [];
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2, a2 = a + Math.PI / 34;
      for (const s of [-1, 1]) tread.push([box(0.82, W.lug, 0.42), { x: s * 0.42, y: Math.cos(a) * (W.r + W.lug / 2 - 0.03), z: Math.sin(a) * (W.r + W.lug / 2 - 0.03), rx: a, ry: s * 0.42 }]);
      for (const s of [-1, 1]) tread.push([box(0.32, W.lug * 0.8, 0.5), { x: s * 0.9, y: Math.cos(a2) * (W.r + W.lug * 0.3 - 0.08), z: Math.sin(a2) * (W.r + W.lug * 0.3 - 0.08), rx: a2 }]);
    }
    const treadG = U.merge(THREE, tread);
    const wheelFace = (sx) => {   // 外側(sx 側)の面: 皿形の円盤、通気孔、ハブ、ナット 10、ビードロックの輪とボルト 16、回転継手とホース
      const P = [], N = [], H = [], R = [];
      P.push([cylX(1.62, 0.14, 32), { x: sx * 0.42 }]);
      P.push([cylX(0.78, 0.36, 24), { x: sx * 0.62 }]);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; H.push([cylX(0.2, 0.02, 12), { x: sx * 0.5, y: Math.cos(a) * 1.22, z: Math.sin(a) * 1.22 }]); }
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; N.push([cylX(0.09, 0.14, 6), { x: sx * 0.86, y: Math.cos(a) * 0.56, z: Math.sin(a) * 0.56 }]); }
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; N.push([cylX(0.07, 0.1, 6), { x: sx * 1.04, y: Math.cos(a) * 1.82, z: Math.sin(a) * 1.82 }]); }
      R.push([new THREE.TorusGeometry(1.82, 0.08, 6, 40).rotateY(Math.PI / 2), { x: sx * 1.0 }]);
      N.push([cylX(0.28, 0.4, 14), { x: sx * 0.98 }]); N.push([cylX(0.2, 0.12, 14), { x: sx * 1.22 }]);
      return { disc: U.merge(THREE, P), holes: U.merge(THREE, H), nuts: U.merge(THREE, N), ring: U.merge(THREE, R) };
    };
    const faces = { [-1]: wheelFace(-1), [1]: wheelFace(1) };
    const wheels = [], knuckles = [], spins = [];
    for (const sx of [-1, 1]) for (const z of W.axles) {
      const k = new THREE.Group(); k.position.set(sx * W.x, W.y, z); group.add(k);
      const s = new THREE.Group(); k.add(s);
      add(tireG, M.rubber, s); add(treadG, M.rubber, s); add(rimG, M.rim, s);
      const f = faces[sx]; add(f.disc, M.rim, s); add(f.holes, M.seam, s); add(f.nuts, M.steel, s); add(f.ring, M.rim, s);
      pipe([V(sx * 1.2, 0.18, 0.05), V(sx * 1.1, 0.7, 0.3), V(sx * 0.62, 1.35, 0.25)], 0.04, M.black, s, 10, 5);   // 空気圧調整のホース
      add(cylX(0.7, 0.6, 16), M.metal, k, { x: -sx * 0.75 });                                             // ナックル(リムの内側)
      knuckles.push({ k, sx, z, front: z > 0 }); spins.push(s); wheels.push(k);
    }
    for (const sx of [-1, 1]) {   // 後輪の後ろの泥よけ(ゴム)
      const z = W.axles[1] - W.r - 0.75;
      add(box(2.5, 2.3, 0.1), M.rubber, group, { x: sx * W.x, y: 3.9, z });
      add(box(2.6, 0.2, 0.3), M.metal, group, { x: sx * W.x, y: 5.0, z });
    }
    // 懸架: ウィッシュボーンの腕・ダンパー・駆動軸・タイロッド(1 つの InstancedMesh の棒)と、コイルばね(1 つの InstancedMesh)
    const LINKS = [];   // { a: 車体の点, b: (knuckle, ナックルの点), r }
    const SPRINGS = [];
    for (const kn of knuckles) {
      const { sx, z, front } = kn, iX = sx * 3.38;
      const lowB = V(-sx * 0.75, -0.72, 0), upB = V(-sx * 0.78, 0.85, 0);
      LINKS.push({ a: V(iX, 2.45, z + 1.15), kn, b: lowB, r: 0.12 }, { a: V(iX, 2.45, z - 1.15), kn, b: lowB, r: 0.12 });
      LINKS.push({ a: V(iX, 4.35, z + 0.95), kn, b: upB, r: 0.1 }, { a: V(iX, 4.35, z - 0.95), kn, b: upB, r: 0.1 });
      LINKS.push({ a: V(sx * 2.2, W.y, z), kn, b: V(-sx * 0.8, 0, 0), r: 0.16 });                        // 駆動軸
      const damp = { a: V(sx * 4.0, 5.85, z - 0.35), kn, b: V(-sx * 1.7, -0.5, -0.35), r: 0.14, frac: 1 };   // ダンパー(下は下の腕の中ほど)
      LINKS.push(damp); SPRINGS.push(damp);
      if (front) LINKS.push({ a: V(sx * 2.6, 3.05, z + 1.0), kn, b: V(-sx * 0.55, 0.3, 0.95), r: 0.07 });   // タイロッド
    }
    const linkMesh = new THREE.InstancedMesh(cyl(1, 1, 10), M.metal, LINKS.length); linkMesh.frustumCulled = false; body.add(linkMesh);
    const coilPts = []; for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * Math.PI * 2 * 7; coilPts.push(V(Math.cos(a) * 0.38, t, Math.sin(a) * 0.38)); }
    const coilG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 320, 0.06, 6);
    const springMesh = new THREE.InstancedMesh(coilG, patch(std(0x2b3a24, 0.5, 0.3), { dust: 0.7 }), SPRINGS.length); springMesh.frustumCulled = false; body.add(springMesh);
    const lm = new THREE.Matrix4(), lq = new THREE.Quaternion(), lv = new THREE.Vector3(), ls = new THREE.Vector3(), la = new THREE.Vector3(), lb = new THREE.Vector3(), ld = new THREE.Vector3(), bodyInv = new THREE.Matrix4();
    function layLinks() {
      body.updateMatrix(); bodyInv.copy(body.matrix).invert();
      for (const kn of knuckles) kn.k.updateMatrix();
      LINKS.forEach((L, i) => {
        la.copy(L.a); lb.copy(L.b).applyMatrix4(L.kn.k.matrix).applyMatrix4(bodyInv);   // ナックルの点 → group → 車体の座標
        ld.subVectors(lb, la); const len = ld.length(); ld.normalize();
        lm.compose(lv.copy(la).add(lb).multiplyScalar(0.5), lq.setFromUnitVectors(UP, ld), ls.set(L.r, len, L.r));
        linkMesh.setMatrixAt(i, lm);
        if (L.frac) {   // ばね: ダンパーの下端の少し上から上へ 7 割
          lv.copy(lb).addScaledVector(ld, -len * 0.08); lq.setFromUnitVectors(UP, ld.negate());
          lm.compose(lv, lq, ls.set(1, len * 0.7, 1)); springMesh.setMatrixAt(SPRINGS.indexOf(L), lm);
        }
      });
      linkMesh.instanceMatrix.needsUpdate = true; springMesh.instanceMatrix.needsUpdate = true;
    }

    // ── 銃塔(遠隔操作): 旋回台、左右の支え、12.7mm 重機関銃、外付けの弾薬箱と給弾の樋、照準センサー、配線 ──
    const RWS = { z: 0.6, y: ROOF + 0.35, yawMax: 1.2 };
    B(cyl(1.75, 0.35, 32), M.metal, { y: ROOF + 0.17, z: RWS.z });
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; bolt(body, V(Math.cos(a) * 1.6, ROOF + 0.35, RWS.z + Math.sin(a) * 1.6), UP, 0.7); }
    const rws = new THREE.Group(); rws.position.set(0, RWS.y, RWS.z); body.add(rws);
    const R = (geo, mat, o = {}) => add(geo, mat, o.parent ?? rws, o);
    R(cbox(2.8, 0.6, 2.8, 0.12), M.trim, { y: 0.3 });
    for (const sx of [-1, 1]) {
      R(cbox(0.35, 1.9, 1.8, 0.06), M.trim, { x: sx * 1.05, y: 1.55, z: 0.1 });
      R(cylX(0.32, 0.12, 16), M.metal, { x: sx * 1.28, y: 1.9, z: 0.2 });
      boltRow(rws, V(sx * 1.23, 0.95, -0.6), V(sx * 1.23, 0.95, 0.8), 4, V(sx, 0, 0), 0.6);
    }
    R(cylX(0.18, 2.4, 10), M.steel, { y: 1.9, z: 0.2 });
    // 弾薬箱(左の外。ふたの縁・取っ手・留め金)と給弾の樋
    R(cbox(1.0, 1.3, 1.8, 0.05), M.trim, { x: -1.95, y: 1.45, z: 0.2 });
    R(box(1.06, 0.14, 1.86), M.trim, { x: -1.95, y: 2.02, z: 0.2 });
    grab(V(-1.95, 2.1, -0.3), V(-1.95, 2.1, 0.7), UP, 0.18, 0.04, M.black, rws);
    R(box(0.06, 0.3, 0.2), M.metal, { x: -2.47, y: 1.85, z: 0.2 });
    pipe([V(-1.75, 2.1, 0.45), V(-1.6, 2.8, 0.45), V(-1.1, 3.15, 0.4), V(-0.45, 2.95, 0.3)], 0.2, M.black, rws, 16, 8);
    // 照準センサー(右。昼間カメラ・熱線・測距の窓、日よけ)
    R(cbox(1.1, 1.0, 1.6, 0.08), M.trim, { x: 1.78, y: 1.9, z: 0.4 });
    R(box(0.95, 0.8, 0.06), M.black, { x: 1.78, y: 1.9, z: 1.21 });
    R(cylZ(0.24, 0.1, 16), M.lensIR, { x: 1.6, y: 1.95, z: 1.25 }); R(cylZ(0.15, 0.1, 16), M.lens, { x: 2.0, y: 2.05, z: 1.25 }); R(cylZ(0.08, 0.1, 10), M.lens, { x: 2.0, y: 1.72, z: 1.25 });
    R(box(1.15, 0.06, 0.4), M.trim, { x: 1.78, y: 2.42, z: 1.2 });
    pipe([V(1.78, 1.4, -0.3), V(1.6, 0.9, -0.8), V(0.9, 0.62, -1.1)], 0.07, M.black, rws, 10, 5);
    pipe([V(-1.6, 0.8, -0.5), V(-1.2, 0.62, -1.0), V(-0.5, 0.62, -1.2)], 0.07, M.black, rws, 10, 5);
    const gun = new THREE.Group(); gun.position.set(0, 1.9, 0.2); rws.add(gun);
    const G = (geo, mat, o = {}) => add(geo, mat, o.parent ?? gun, o);
    const BORE = 0.78;
    G(cbox(1.4, 0.8, 3.6, 0.08), M.metal, { z: 0.3 });                                                // 揺架
    G(cbox(0.8, 0.75, 2.8, 0.05), M.black, { y: BORE, z: 0.0 });                                       // 機関部
    for (const sx of [-1, 1]) { G(box(0.04, 0.6, 2.4), M.black, { x: sx * 0.42, y: BORE, z: 0.05 }); boltRow(gun, V(sx * 0.44, BORE + 0.22, -1.0), V(sx * 0.44, BORE + 0.22, 1.1), 6, V(sx, 0, 0), 0.4); boltRow(gun, V(sx * 0.44, BORE - 0.22, -1.0), V(sx * 0.44, BORE - 0.22, 1.1), 6, V(sx, 0, 0), 0.4); }
    G(box(0.82, 0.08, 1.6), M.black, { y: BORE + 0.42, z: -0.3 });                                     // 給弾口のふた
    G(cylX(0.06, 0.82, 8), M.metal, { y: BORE + 0.42, z: -1.1 });
    G(box(0.06, 0.12, 0.6), M.metal, { x: 0.46, y: BORE + 0.1, z: 0.6 }); G(box(0.25, 0.18, 0.08), M.metal, { x: 0.58, y: BORE + 0.1, z: 0.3 });   // 装填ハンドル
    G(box(0.8, 0.7, 0.12), M.black, { y: BORE, z: -1.46 });                                            // 後ろの板と握り
    for (const sx of [-1, 1]) pipe([V(sx * 0.2, BORE, -1.5), V(sx * 0.3, BORE - 0.05, -1.75), V(sx * 0.32, BORE - 0.25, -1.95)], 0.07, M.black, gun, 8, 6);
    G(cbox(0.7, 0.6, 0.7, 0.05), M.black, { y: BORE, z: 1.65 });                                       // 銃身の付け根
    G(cylZ(0.3, 1.3, 20), M.black, { y: BORE, z: 2.6 });                                               // 放熱孔つきの銃身支え
    { const holes = []; for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + r * 0.4; holes.push([cylZ(0.07, 0.04, 8).rotateX(Math.PI / 2).rotateZ(-a), { x: Math.sin(a) * 0.29, y: BORE + Math.cos(a) * 0.29, z: 2.1 + r * 0.33 }]); }
      G(U.merge(THREE, holes), M.seam); }
    const slide = new THREE.Group(); gun.add(slide);
    G(cylZ(0.15, 5.6, 14, 0.17), M.black, { parent: slide, y: BORE, z: 5.05 });
    G(cylZ(0.24, 0.65, 14, 0.18), M.black, { parent: slide, y: BORE, z: 8.1 });                       // 消炎器
    G(cylZ(0.21, 0.08, 14), M.seam, { parent: slide, y: BORE, z: 8.44 });
    pipe([V(0, BORE + 0.15, 3.6), V(0, BORE + 0.55, 3.75), V(0, BORE + 0.55, 4.25), V(0, BORE + 0.15, 4.4)], 0.05, M.black, slide, 12, 6);   // 銃身の運搬ハンドル
    const MZ = 8.45;
    const holder = new THREE.Group(); holder.position.y = BORE; gun.add(holder);
    const muzzle = new THREE.Object3D(); muzzle.position.z = MZ; holder.add(muzzle);
    const eject = new THREE.Object3D(); eject.position.set(0.5, BORE - 0.1, -0.2); gun.add(eject);

    // ── センサーマスト: 受け台(ボルト・留め具)、3 段の伸縮柱(締め輪)、巻きばね状の配線、電子光学の頭部 ──
    const MAST = { z: -7.0, base: ROOF + 0.9, stage: 4.0, len: 4.6, time: 3.0, head: { w: 3.4, h: 1.8, d: 2.6 } };
    B(cbox(3.0, 0.9, 3.0, 0.12), M.trim, { y: ROOF + 0.45, z: MAST.z });
    boltRow(body, V(-1.3, MAST.base, MAST.z - 1.3), V(1.3, MAST.base, MAST.z - 1.3), 5, UP, 0.7); boltRow(body, V(-1.3, MAST.base, MAST.z + 1.3), V(1.3, MAST.base, MAST.z + 1.3), 5, UP, 0.7);
    for (const sx of [-1, 1]) { B(cbox(0.4, 1.5, 2.2, 0.06), M.metal, { x: sx * 1.95, y: ROOF + 0.75, z: MAST.z }); B(new THREE.SphereGeometry(0.12, 8, 6), M.black, { x: sx * 2.17, y: ROOF + 1.2, z: MAST.z }); }
    const tubes = [0.7, 0.55, 0.42].map((r) => {
      const g = new THREE.Group(); g.position.set(0, MAST.base - 0.05, MAST.z); body.add(g);
      add(cyl(r, MAST.len, 24), M.mast, g, { y: -MAST.len / 2 });
      add(cyl(r + 0.09, 0.32, 24), M.black, g, { y: -0.16 });
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; add(box(0.08, 0.2, 0.08), M.metal, g, { x: Math.cos(a) * (r + 0.1), y: -0.16, z: Math.sin(a) * (r + 0.1) }); }
      return g;
    });
    // 巻きばね状の配線: 螺旋に沿った短い棒の列(伸び縮みで巻きの間隔だけが変わり、太さは変わらない)
    const COIL = { turns: 8, per: 20, r: 0.92 }, coilN = COIL.turns * COIL.per;
    const cable = new THREE.InstancedMesh(cyl(0.045, 1, 5), M.black, coilN); cable.position.set(0, MAST.base, MAST.z); cable.visible = false; cable.frustumCulled = false; body.add(cable);
    const cA = new THREE.Vector3(), cB = new THREE.Vector3(), cM = new THREE.Matrix4(), cQ = new THREE.Quaternion(), cS = new THREE.Vector3();
    const coilAt = (out, i, h) => { const t = i / coilN, a = t * Math.PI * 2 * COIL.turns; return out.set(Math.cos(a) * COIL.r, t * h, Math.sin(a) * COIL.r); };
    let coilH = -1;
    const layCoil = (h) => {
      if (Math.abs(h - coilH) < 1e-3) return; coilH = h;
      for (let i = 0; i < coilN; i++) { coilAt(cA, i, h); coilAt(cB, i + 1, h); const d = cB.clone().sub(cA), len = d.length(); cM.compose(cA.add(cB).multiplyScalar(0.5), cQ.setFromUnitVectors(UP, d.normalize()), cS.set(1, len * 1.05, 1)); cable.setMatrixAt(i, cM); }
      cable.instanceMatrix.needsUpdate = true;
    };
    const head = new THREE.Group(); head.position.set(0, MAST.base, MAST.z); body.add(head);
    const H = (geo, mat, o = {}) => add(geo, mat, head, o);
    const HB = 0.1 + MAST.head.h / 2, HF = MAST.head.d / 2;
    H(cyl(0.6, 0.1, 16), M.metal, { y: 0.05 });
    H(cbox(MAST.head.w, MAST.head.h, MAST.head.d, 0.14), M.trim, { y: HB });
    H(cbox(2.95, 1.2, 0.12, 0.05), M.black, { y: HB, z: HF + 0.04 });
    H(cylZ(0.46, 0.12, 24), M.lensIR, { x: -0.8, y: HB, z: HF + 0.12 }); H(new THREE.TorusGeometry(0.47, 0.06, 6, 24), M.metal, { x: -0.8, y: HB, z: HF + 0.17 });
    H(cylZ(0.3, 0.12, 24), M.lens, { x: 0.35, y: HB, z: HF + 0.12 }); H(new THREE.TorusGeometry(0.31, 0.05, 6, 20), M.metal, { x: 0.35, y: HB, z: HF + 0.17 });
    for (const dy of [0.2, -0.2]) H(cylZ(0.1, 0.12, 12), M.lens, { x: 1.1, y: HB + dy, z: HF + 0.12 });
    H(cbox(MAST.head.w + 0.1, 0.12, 1.0, 0.04), M.trim, { y: HB + MAST.head.h / 2 + 0.06, z: HF - 0.15 });   // 日よけ
    H(cbox(0.9, 0.7, 0.4, 0.05), M.metal, { y: HB - 0.3, z: -HF - 0.2 });                               // 後ろの接続箱
    H(cylZ(0.14, 0.3, 10), M.black, { x: 0.25, y: HB - 0.3, z: -HF - 0.5 });
    H(cyl(0.25, 0.14, 14), M.black, { y: HB + MAST.head.h / 2 + 0.07, z: -0.6 });                      // 測位のアンテナ
    for (const sx of [-1, 1]) grab(V(sx * 1.7, HB + 0.25, -0.7), V(sx * 1.7, HB + 0.25, 0.7), V(sx, 0, 0), 0.14, 0.04, M.black, head);
    for (const [x0, x1, y] of [[-1.4, 1.4, HB + 0.56], [-1.4, 1.4, HB - 0.56]]) boltRow(head, V(x0, y, HF + 0.1), V(x1, y, HF + 0.1), 6, V(0, 0, 1), 0.5);

    // ── 射撃(リアル版の演出 U.muzzleFx)と薬莢 ──
    const CASES = 14, cases = new THREE.InstancedMesh(cylZ(0.07, 0.5, 8), M.brass, CASES); cases.visible = false; cases.frustumCulled = false; group.add(cases);
    const casing = Array.from({ length: CASES }, () => ({ t: 9, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0 }));
    const rng = U.rng(61);
    const mt = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(), eul = new THREE.Euler();
    const tmp = new THREE.Vector3(), fq = new THREE.Quaternion(), gq = new THREE.Quaternion();
    const toGroup = (obj) => { group.updateMatrixWorld(true); obj.getWorldPosition(tmp); group.worldToLocal(tmp); obj.getWorldQuaternion(fq); group.getWorldQuaternion(gq); fq.premultiply(gq.invert()); };
    const realFx = U.muzzleFx(THREE, group, { ground: 0.3, seed: 67,
      flash: { pool: 2, len: 0.035, size: [1.6, 3.0], tongue: { len: [3, 5], width: [1.0, 1.5], side: 0 } }, light: { len: 0.05, power: 16000, z: 2 },
      balls: { per: 2, pool: 8, len: 0.08, size: 1.1, speed: 30, length: 2.4 },
      smoke: { per: 1, pool: 24, len: [1.0, 1.8], speed: 7, spread: 0.6, drag: 1.6, rise: 2, size: [0.6, 1.0], grow: [2.5, 5], peak: 0.28, ahead: [0.5, 1.5] },
      tracers: { pool: 12, speed: 380, len: 1.2, drop: 8 } });

    // ── 動き ──
    const BURST = 0.9, SHOT_DT = 0.1, CASE_LEN = 0.6, WHEEL_SPEED = 4.0, STEER = 0.35;
    let moving = false, wantMast = false, traverse = false, steering = false, clock = 0, scan = 0, yaw = 0, headYaw = 0, ext = 0, wheelRot = 0, steer = 0;
    let burst = 0, nextShot = 0, recoil = 0, shotN = 0, baked = null;
    const ease = (u) => u * u * (3 - 2 * u);
    function update(dt) {
      clock += dt;
      K.tick(group);
      if (wantMast && !moving) {
        ext = Math.min(1, ext + dt / MAST.time);
        if (ext >= 1) { scan += dt; headYaw += (0.9 * Math.sin(scan * 0.35) - headYaw) * Math.min(1, dt * 1.5); }
      } else {
        scan = 0;
        if (Math.abs(headYaw) > 0.005) headYaw -= Math.sign(headYaw) * Math.min(Math.abs(headYaw), dt * 0.8);
        else { headYaw = 0; ext = Math.max(0, ext - dt / MAST.time); }
      }
      const k = ease(ext);
      tubes.forEach((g, i) => (g.position.y = MAST.base - 0.05 + k * (i + 1) * MAST.stage));
      head.position.y = MAST.base + k * tubes.length * MAST.stage; head.rotation.y = headYaw;
      cable.visible = ext > 0.04; if (cable.visible) layCoil(head.position.y - MAST.base + 0.05);
      const rolling = moving && ext === 0;
      if (rolling) wheelRot += dt * WHEEL_SPEED;
      steer += ((steering ? STEER * Math.sin(clock * 0.6) : 0) - steer) * Math.min(1, dt * 3);
      for (const kn of knuckles) kn.k.rotation.y = kn.front ? steer : 0;
      for (const s of spins) s.rotation.x = wheelRot;
      // 車体: 懸架の上で上下・前後・左右にわずかに揺れる(車輪は地面に付いたまま)
      body.position.y = rolling ? 0.05 + 0.03 * Math.sin(clock * 13) + 0.02 * Math.sin(clock * 7.3) : body.position.y * 0.85;
      body.rotation.x = (rolling ? 0.004 * Math.sin(clock * 5.1) : 0) + (burst > 0 ? 0.0015 * Math.sin(clock * 80) : 0);
      body.rotation.z = rolling ? 0.003 * Math.sin(clock * 3.7) : body.rotation.z * 0.85;
      layLinks();
      const targetYaw = traverse ? Math.sin(clock * 0.5) * RWS.yawMax : 0;
      yaw += (targetYaw - yaw) * Math.min(1, dt * 2); rws.rotation.y = yaw;
      if (burst > 0) { burst -= dt; nextShot -= dt; while (burst > 0 && nextShot <= 0) { nextShot += SHOT_DT; shoot(); } }
      recoil = Math.max(0, recoil - dt / 0.08); const u = 1 - recoil;
      slide.position.z = recoil > 0 ? -0.35 * (u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7) : 0;
      let anyC = false;
      casing.forEach((c, i) => {
        if (c.t < CASE_LEN) { c.t += dt; c.vel.y -= 45 * dt; c.pos.addScaledVector(c.vel, dt); if (c.pos.y < 0.3) { c.pos.y = 0.3; c.vel.set(c.vel.x * 0.4, Math.abs(c.vel.y) * 0.3, c.vel.z * 0.4); } anyC = true; }
        mt.compose(c.pos, mq.setFromEuler(eul.set(c.t * 9 * c.spin, c.t * 7, 0)), ms.setScalar(c.t < CASE_LEN ? 1 : 0.001)); cases.setMatrixAt(i, mt);
      });
      cases.visible = anyC; cases.instanceMatrix.needsUpdate = true;
      realFx.update(dt);
    }
    function shoot() {
      recoil = 1;
      const c = casing.find((x) => x.t >= CASE_LEN);
      if (c) { toGroup(eject); c.pos.copy(tmp); c.vel.set(6 + rng() * 3, 3 + rng() * 2, -1 + rng() * 2).applyQuaternion(fq); c.spin = 0.5 + rng(); c.t = 0; }
      realFx.fire(muzzle); if (shotN++ % 3 === 0) realFx.tracer(muzzle);
    }
    function fireGun() { if (burst <= 0) nextShot = 0; burst = BURST; }

    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "camo", dirt = 1;
    const applyPaint = () => K.setLook({ paint, dirt, team: teamColor });
    function fitPlate() {
      const inner = U.reach(THREE, group, body) + 1.5, outer = inner + 3;
      flat(new THREE.RingGeometry(inner, outer, 96), M.ring, 0.25);
      flat(new THREE.CircleGeometry(inner - 0.4, 96), M.glow, 0.2);
      flat(new THREE.PlaneGeometry(6.5, 6.5), M.sign, 0.35, outer + 3.6);
      return outer;
    }
    layLinks();
    const plateRadius = fitPlate();
    applyPaint();
    // 隙間の確認値(すべて正なら貫通なし)
    const check = () => {
      const tireReach = W.r + W.lug - 0.03, SAG = 0.06;   // 車体は上へしか揺れない。左右・前後の傾きで端が下がる分だけ引く
      const corner = (th) => { const dx = -(W.w / 2 + 0.05), dz = -tireReach; return { x: W.x + dx * Math.cos(th) + dz * Math.sin(th), z: W.axles[0] + dz * Math.cos(th) - dx * Math.sin(th) }; };   // 操舵したタイヤの内側の後ろの角(地面より上の最遠点の近似)
      const c1 = corner(STEER), c2 = corner(-STEER);
      const rwsSweep = Math.max(Math.hypot(2.45, 0.2 + 0.93), Math.hypot(1.78 + 0.58, 0.4 + 0.85), Math.hypot(1.45, 1.45));
      return {
        tireToBody: +(5.9 - (W.y + tireReach) - SAG).toFixed(2),
        steeredTireToFrame: +(Math.min(c1.x, c2.x) - 3.4).toFixed(2),
        steeredTireToLocker: +(Math.min(c1.z, c2.z) - 5.0).toFixed(2),
        springToTire: +((W.x - W.w / 2 - 0.05) - ((W.x - 1.7) + 0.44)).toFixed(2),   // ばねの下端の外側とタイヤの内面(ばねの下端はナックルに付くので操舵でも変わらない)
        ammoBoxToArm: +((1.95 - 0.5) - (1.05 + 0.175)).toFixed(2),
        chuteAboveArm: +((3.15 - 0.2) - 2.5).toFixed(2),
        rwsSweepToSmokeLauncher: +(Math.hypot(4.1 - 0.85, 3.4 - 0.75 - RWS.z) - rwsSweep).toFixed(2),
        rwsSweepToMastHousing: +((RWS.z - (MAST.z + 1.5)) - rwsSweep).toFixed(2),
        stowedHeadToClamps: +((1.95 - 0.2) - MAST.head.w / 2).toFixed(2),
        headHandlesAboveClamps: +((MAST.base + HB + 0.25 - 0.18) - (ROOF + 1.5)).toFixed(2),
        mastTubeOverlap: +(MAST.len - MAST.stage).toFixed(2),
      };
    };
    baked = U.bake(THREE, group, { dynamic: [body, rws, slide, head, ...tubes, ...spins, ...wheels], also: STATIC });
    K.finish(group);
    return {
      plateRadius, group, update, fireGun, check, realistic: true,
      setTeam: (c) => { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }, setPaint: (p) => { paint = U.REAL_PAINTS[p] ? p : "camo"; applyPaint(); },
      setDirt: (d) => { dirt = d; applyPaint(); }, get dirt() { return dirt; },
      stats: () => U.stats(group), parts: { rws, head, plate },
      setMoving: (b) => (moving = b), setMast: (b) => (wantMast = b), setTraverse: (b) => (traverse = b), setSteering: (b) => (steering = b),
      get moving() { return moving; }, get mast() { return wantMast; }, get mastExt() { return ext; }, get traverse() { return traverse; }, get steering() { return steering; }, get paint() { return paint; },
      get firing() { return burst > 0; }, get observing() { return ext >= 1; },
    };
  }

  (window.DreamAssets ??= {}).scoutHD = scoutHD;
})();
