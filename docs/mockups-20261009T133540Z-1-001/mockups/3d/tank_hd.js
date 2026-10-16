// 部隊「装甲強襲」の高詳細・写実版(試作。PC 表示向け)。tank.js(盤面の模型の画風、レールガン戦車 v3)と同じ車両・同じ寸法・同じ動きを、
// 模型の約束(白・灰の Lambert、輪郭線、光る継ぎ目)を外して実車に寄せて作り込んだもの。偵察の写実版(scout_hd.js)と同じ方式で、材質・塗装・汚れは U.realKit(common.js)。
//   車体: 面取りした装甲板。履帯の上の張り出しは実車と同じく上部転輪の上まで上げ(tank.js は履帯の上半分が車体に埋まる作り)、重いサイドスカートで転輪の上半分を覆う。
//     操縦手ハッチと潜望鏡、V 字のスプラッシュガード、防護の格子つきの前照灯、牽引フックとシャックル、泥よけ、機関室の吸気グリル(羽板)と点検ハッチ・吊り手・給油口、
//     後面の排気ルーバー・尾灯・牽引索・牽引フック・車内通話器、肩の継ぎ目とボルト。
//   足回り: 1 枚ずつの履板(連結具・中央のガイド・ゴムパッド)、ダブルの転輪 6 対(ゴムのタイヤ、ハブとボルト)、歯の付いた起動輪、誘導輪、上部転輪 3、
//     トーションバーの腕とダンパー。走行で履帯が回り、各輪がそれぞれの半径に合った速さで回る。車体だけが懸架の上で揺れる。
//   砲塔: 面取りした楔形、追加装甲の板とボルト、側面の雑具箱、後部のコンデンサ(放熱フィン)、車長ハッチと潜望鏡、砲手照準器(装甲扉)、
//     パノラマ照準器、発煙弾発射機 4 連 ×2、ばね台座のアンテナ、横風センサー、吊り環、手すり、後部のバスケット(網の床、幌・箱・燃料缶)。
//   主砲(レールガン): 角断面の密閉筐体(実在の試作レールガンと同じくレールは外から見えない)、拘束クランプ 6 とボルト、尾部の給電部と導管、
//     防盾と布の防塵カバー、角形の砲口と口金、砲口の基準センサー、同軸機銃。光る継ぎ目はやめ、撃ったあとに砲口の口金だけが熱で赤く光る。
//   射撃: 充電(0.6 秒)→ 発射。リアル版の演出(U.muzzleFx。閃光と点光源・火球が冷えて煙へ・火花・砂塵)、砲身の後座、車体の揺れ。
//
//   const t = DreamAssets.tankHD(THREE);
//   scene.add(t.group); t.setTeam(0xff6a1a); t.setPaint("camo" | "olive" | "desert" | "stealth"); t.setDirt(0 | 1 | 2); t.fire(); t.update(dt)
//
// 前方 = +z、上 = +y。寸法は tank.js と同じ(全長 約 42、幅 約 25。表示倍率 2.0 前提)。
(function () {
  function tankHD(THREE, opts = {}) {
    const U = DreamAssets.util;
    const K = U.realKit(THREE, { sign: "強", dustH: 5.5 });
    const { M, STATIC, std, patch, V, UP, add, box, cyl, cylX, cylZ, cbox, rod, pipe, grab, seam, bolt, boltRow } = K;
    M.heat = patch(std(0x8a8f94, 0.3, 0.85, { emissive: 0x000000 }), { dust: 0.2 });          // 砲口の口金(撃ったあと熱で光る)
    M.link = patch(std(0xffffff, 0.86, 0.3, { vertexColors: true }), { dust: 1.0, bump: 0.08 });            // 履板(頂点色で鋼とゴムを塗り分け)
    STATIC.push(M.heat);

    const group = new THREE.Group(); group.name = "tankHD";
    const root = new THREE.Group(); root.position.y = 0.04; group.add(root);   // 履板のパッドの下面を地面に合わせる
    const gear = new THREE.Group(); root.add(gear);                            // 足回り(揺れない)
    const body = new THREE.Group(); root.add(body);                            // 車体(懸架の上で揺れる)
    K.parent = body;
    const B = (geo, mat, o = {}) => add(geo, mat, o.parent ?? body, o);
    const Gr = (geo, mat, o = {}) => add(geo, mat, o.parent ?? gear, o);

    // ── ベースプレート(ゲームと同じ。ビューアの切替で消せる) ──
    const plate = new THREE.Group(); group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };

    // ── 履帯: tank.js と同じ輪(起動輪 = 後、誘導輪 = 前)。履板は 鋼の板 + 両端の連結具 + 内側の中央ガイド + 外側のゴムパッド 2 ──
    const R = 2.15, BK = new THREE.Vector2(-16.6, 2.55), FR = new THREE.Vector2(15.3, 2.55);   // (z, y)
    const run = FR.x - BK.x, loopLen = 2 * run + 2 * Math.PI * R;
    const pathAt = (s) => {
      s = ((s % loopLen) + loopLen) % loopLen;
      if (s < run) return { z: BK.x + s, y: BK.y - R, tz: 1, ty: 0, nz: 0, ny: -1 };
      s -= run;
      if (s < Math.PI * R) { const a = -Math.PI / 2 + s / R; return { z: FR.x + Math.cos(a) * R, y: FR.y + Math.sin(a) * R, tz: -Math.sin(a), ty: Math.cos(a), nz: Math.cos(a), ny: Math.sin(a) }; }
      s -= Math.PI * R;
      if (s < run) return { z: FR.x - s, y: FR.y + R, tz: -1, ty: 0, nz: 0, ny: 1 };
      s -= run;
      const a = Math.PI / 2 + s / R; return { z: BK.x + Math.cos(a) * R, y: BK.y + Math.sin(a) * R, tz: -Math.sin(a), ty: Math.cos(a), nz: Math.cos(a), ny: Math.sin(a) };
    };
    const TRACK_X = 9.55, TRACK_W = 3.2, LINK_OFF = 0.15, LINKS = Math.round(loopLen / 1.1);   // LINK_OFF = 履板の中心を輪から外へずらす量(内面が輪の上に来る)
    const C3 = (h) => new THREE.Color(h);
    // 履板の座標: x = 幅、y = 内向き(+) / 外向き(-)、z = 進む向き
    const linkG = U.concat(THREE, [
      { geo: cbox(TRACK_W - 0.2, 0.3, 0.84, 0.05).clone(), color: C3(0x45474a) },
      ...[-1, 1].map((s) => ({ geo: cbox(0.34, 0.42, 0.52, 0.06).clone().translate(s * (TRACK_W / 2 - 0.05), 0, 0.4), color: C3(0x55585b) })),
      { geo: cbox(0.3, 0.62, 0.44, 0.06).clone().translate(0, 0.43, 0), color: C3(0x4c4f52) },
      ...[-1, 1].map((s) => ({ geo: cbox(1.15, 0.14, 0.62, 0.04).clone().translate(s * 0.82, -0.21, 0), color: C3(0x1d1e1f) })),
    ]);
    const links = new THREE.InstancedMesh(linkG, M.link, LINKS * 2); links.frustumCulled = false; gear.add(links);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    let trackS = 0;
    const layTracks = () => {
      let k = 0;
      for (const sx of [-1, 1]) for (let i = 0; i < LINKS; i++) {
        const p = pathAt(trackS + (i * loopLen) / LINKS);
        q.setFromEuler(e.set(Math.atan2(-p.ty, p.tz), 0, 0));
        mt.compose(v.set(sx * TRACK_X, p.y + p.ny * LINK_OFF, p.z + p.nz * LINK_OFF), q, one); links.setMatrixAt(k++, mt);
      }
      links.instanceMatrix.needsUpdate = true;
    };
    layTracks();
    // 回る輪: 同じ形をまとめて InstancedMesh にし、走行で回転を写す。gap = 中央のガイドが通る隙間
    const wheelSets = [];
    const wheelSet = (parts, positions, speed) => {   // parts = [[geo, mat]]
      const meshes = parts.map(([g, m]) => { const im = new THREE.InstancedMesh(g, m, positions.length); im.frustumCulled = false; gear.add(im); return im; });
      const s = { meshes, positions, speed, rot: 0 }; wheelSets.push(s); return s;
    };
    const layWheels = () => {
      for (const s of wheelSets) { q.setFromEuler(e.set(s.rot, 0, 0)); s.positions.forEach(([x, y, z], i) => { mt.compose(v.set(x, y, z), q, one); for (const im of s.meshes) im.setMatrixAt(i, mt); }); for (const im of s.meshes) im.instanceMatrix.needsUpdate = true; }
    };
    const dual = (fn) => U.merge(THREE, [-1, 1].flatMap((s) => fn(s)));
    // 転輪(ダブル、半径 1.85): ゴムのタイヤ、鋼の円盤(皿形)、ハブ、ボルト 8
    const ROAD = { r: 1.85, y: 2.25, z0: -12.4, dz: 4.95, half: 0.75, w: 1.0 };
    const roadPos = []; for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) roadPos.push([sx * TRACK_X, ROAD.y, ROAD.z0 + i * ROAD.dz]);
    const boltsOn = (x, r, n, s = 0.1) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cylX(s, 0.12, 6), { x, y: Math.cos(a) * r, z: Math.sin(a) * r }]; });
    const roadRubber = dual((s) => [[cylX(ROAD.r, ROAD.w, 32), { x: s * ROAD.half }]]);
    const roadMetal = dual((s) => [
      [cylX(1.45, ROAD.w + 0.04, 28), { x: s * ROAD.half }], [cylX(0.95, ROAD.w + 0.16, 20), { x: s * ROAD.half }], [cylX(0.5, ROAD.w + 0.34, 12), { x: s * ROAD.half }],
      ...boltsOn(s * (ROAD.half + ROAD.w / 2 + 0.12), 0.72, 8), ...boltsOn(s * (ROAD.half - ROAD.w / 2 - 0.12), 0.72, 8),
    ]);
    const roadSet = wheelSet([[roadRubber, M.rubber], [roadMetal, M.rim]], roadPos, 1 / ROAD.r);
    // 起動輪(後、歯 12 枚 × 2)と誘導輪(前)
    const sprPos = [-1, 1].map((sx) => [sx * TRACK_X, BK.y, BK.x]), idlPos = [-1, 1].map((sx) => [sx * TRACK_X, FR.y, FR.x]);
    const teeth = dual((s) => Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [cbox(0.34, 0.5, 0.42, 0.06), { x: s * 0.8, y: Math.cos(a) * 2.05, z: Math.sin(a) * 2.05, rx: a }]; }));
    const sprMetal = U.merge(THREE, [[cylX(1.9, 0.34, 32), { x: 0.8 }], [cylX(1.9, 0.34, 32), { x: -0.8 }], [cylX(1.25, 1.9, 24), {}], [cylX(0.6, 2.4, 12), {}], ...boltsOn(1.22, 0.9, 10), ...boltsOn(-1.22, 0.9, 10)]);
    const sprSet = wheelSet([[sprMetal, M.rim], [teeth, M.steel]], sprPos, 1 / R);
    const idlRubberless = U.merge(THREE, [[cylX(2.0, 0.9, 32), { x: 0.85 }], [cylX(2.0, 0.9, 32), { x: -0.85 }], [cylX(1.1, 2.6, 20), {}], [cylX(0.5, 3.0, 12), {}], ...boltsOn(1.35, 0.8, 8), ...boltsOn(-1.35, 0.8, 8)]);
    const idlSet = wheelSet([[idlRubberless, M.rim]], idlPos, 1 / (R - 0.15));
    // 上部転輪(履帯の上側を支える。ダブル、半径 0.5)
    const RET = { r: 0.5, zs: [-8.5, -0.6, 7.3] }, retY = FR.y + R - RET.r;
    const retPos = []; for (const sx of [-1, 1]) for (const z of RET.zs) retPos.push([sx * TRACK_X, retY, z]);
    const retSet = wheelSet([[dual((s) => [[cylX(RET.r, 0.55, 18), { x: s * 0.62 }]]), M.rubber], [dual((s) => [[cylX(0.32, 0.6, 12), { x: s * 0.62 }]]), M.metal]], retPos, 1 / RET.r);
    layWheels();
    // トーションバーの腕(車体から各転輪のハブへ、後ろ下がり)、ダンパー(1・2・6 番)、上部転輪の支え
    for (const sx of [-1, 1]) {
      roadPos.filter((p) => Math.sign(p[0]) === sx).forEach(([x, y, z], i) => {
        const pivot = V(sx * 7.55, 2.95, z + 1.7), hub = V(sx * (TRACK_X - 1.4), y, z);
        rod(pivot, hub, 0.32, M.metal, gear, 8); Gr(cylX(0.45, 0.5, 12), M.metal, { x: pivot.x, y: pivot.y, z: pivot.z });
        if (i < 2 || i === 5) rod(V(sx * 7.7, 4.9, z + 0.8), pivot.clone().lerp(hub, 0.6).add(V(0, 0.2, 0)), 0.2, M.black, gear, 8);
      });
      for (const z of RET.zs) rod(V(sx * 7.6, retY, z), V(sx * (TRACK_X - 0.55), retY, z), 0.16, M.metal, gear, 8);   // 内側の輪まで(中央のガイドの通り道には出さない)
      rod(V(sx * 7.6, BK.y, BK.x), V(sx * (TRACK_X - 1.4), BK.y, BK.x), 0.5, M.metal, gear, 12);   // 終減速機
      rod(V(sx * 7.6, FR.y, FR.x), V(sx * (TRACK_X - 1.5), FR.y, FR.x), 0.35, M.metal, gear, 10);   // 誘導輪の腕
    }

    // ── 車体: 履帯の間の下部車体(後面は履帯の後端まで)+ 履帯の上に張り出す上部車体(側面は上へ行くほど内側に倒す) ──
    B(U.loft(THREE, [
      { z: -19.4, pts: U.sym([[7.6, 2.3], [7.6, 5.5]]) },
      { z: 15.2, pts: U.sym([[7.6, 1.6], [7.6, 5.5]]) },
      { z: 19.0, pts: U.sym([[6.4, 3.4], [7.4, 4.6]]) },
    ]), M.paint);
    // 面取りつきの断面: (w, b) = 下端、(shx, shy) = 肩、(wt, t) = 上面の端。上面の面取りは肩から上面への斜面より浅くする(凸のまま)
    const hs = (z, w, b, shx, shy, wt, t) => {
      const c = Math.min(0.25, (shy - b) * 0.5, (shx - w) + 0.2), m = (t - shy) / Math.max(0.01, shx - wt);
      return { z, pts: U.sym([[w - c, b], [w, b + c], [shx, shy], [wt + 0.25, t - 0.25 * m * 0.45], [wt, t]]) };
    };
    const HULL = [hs(-19.6, 10.4, 5.45, 10.9, 6.0, 6.6, 6.5), hs(-17.4, 12.2, 5.45, 12.6, 6.25, 7.8, 7.3), hs(11.0, 12.2, 5.45, 12.6, 6.25, 7.8, 7.3), hs(15.6, 12.0, 5.45, 12.4, 6.2, 7.0, 6.9),
      hs(17.6, 11.7, 4.9, 12.05, 5.65, 5.9, 6.19), hs(19.0, 11.4, 3.8, 11.7, 4.7, 4.6, 5.7), hs(22.4, 3.4, 4.0, 3.6, 4.4, 0.9, 4.7)];
    B(U.loft(THREE, HULL), M.paint);
    const topY = (z) => z <= 11 ? 7.3 : z <= 15.6 ? 7.3 - 0.4 * (z - 11) / 4.6 : z <= 19 ? 6.9 - 1.2 * (z - 15.6) / 3.4 : 5.7 - 1.0 * (z - 19) / 3.4;
    const topRX = (z) => z <= 11 ? 0 : z <= 15.6 ? Math.atan(0.4 / 4.6) : z <= 19 ? Math.atan(1.2 / 3.4) : Math.atan(1.0 / 3.4);
    const topN = (z) => V(0, Math.cos(topRX(z)), Math.sin(topRX(z)));
    const onTop = (geo, mat, x, z, h, o = {}) => B(geo, mat, { x, z, y: topY(z) + h / 2 - 0.06, rx: topRX(z), ...o });
    const topPt = (x, z, off = 0.02) => V(x, topY(z) + off, z);
    // 肩の斜面(z -17.4〜11 は断面が同じ): p = 下端 0 〜 上端 1
    const S0 = [12.6, 6.25], S1 = [7.8, 7.3], sd = [S1[0] - S0[0], S1[1] - S0[1]], sL = Math.hypot(...sd), sn = [sd[1] / sL, -sd[0] / sL];
    const slope = (sx, p, z, off = 0) => V(sx * (S0[0] + sd[0] * p + sn[0] * off), S0[1] + sd[1] * p + sn[1] * off, z);
    const slopeN = (sx) => V(sx * sn[0], sn[1], 0);
    for (const sx of [-1, 1]) {
      seam(slope(sx, 0.99, 10.6, 0.02), slope(sx, 0.99, -17.0, 0.02));
      boltRow(body, slope(sx, 0.95, 10.4, 0), slope(sx, 0.95, -16.8, 0), 18, slopeN(sx), 0.9);
      boltRow(body, slope(sx, 0.08, 10.4, 0), slope(sx, 0.08, -16.8, 0), 18, slopeN(sx), 0.9);
    }
    // 機関室の台(後ろ)
    B(U.loft(THREE, [{ z: -18.6, pts: U.sym([[6.2, 7.0], [6.0, 7.6], [5.2, 7.9]]) }, { z: -9.0, pts: U.sym([[6.6, 7.2], [6.4, 7.8], [5.6, 8.1]]) }]), M.trim);
    const deckTop = (z) => 7.9 + 0.2 * (z + 18.6) / 9.6;
    const deckRX = -Math.atan(0.2 / 9.6);

    // ── 車体の前: 操縦手ハッチと潜望鏡、スプラッシュガード、前照灯、牽引フック、泥よけ、吊り環 ──
    onTop(cyl(1.75, 0.12, 8), M.metal, 0, 12.6, 0.12, { ry: Math.PI / 8 });
    onTop(cyl(1.5, 0.26, 8), M.trim, 0, 12.6, 0.34, { ry: Math.PI / 8 });
    onTop(cbox(0.5, 0.3, 1.1, 0.05), M.metal, -1.6, 12.6, 0.3);
    grab(topPt(-0.5, 12.1, 0.3), topPt(0.5, 12.1, 0.3), topN(12.1), 0.2, 0.05);
    for (const x of [-1.3, 0, 1.3]) { onTop(cbox(1.1, 0.6, 0.62, 0.06), M.trim, x, 14.6, 0.6); B(box(0.8, 0.28, 0.05), M.glass, { x, y: topY(14.6) + 0.32, z: 14.93, rx: topRX(14.6) }); }
    for (const sx of [-1, 1]) {
      onTop(cbox(3.6, 0.4, 0.24, 0.05), M.trim, sx * 1.6, 17.15, 0.4, { ry: sx * 0.45 });
      // 前照灯の箱(反射鏡と透明レンズ、方向指示器)と防護の格子
      onTop(cbox(1.6, 0.7, 1.0, 0.08), M.trim, sx * 4.6, 17.8, 0.7);
      const lz = 17.8 + 0.55, ly = topY(17.8) + 0.5;
      for (const [dx, r] of [[-0.3, 0.24], [0.35, 0.16]]) { B(cylZ(r * 0.95, 0.05, 16), M.chrome, { x: sx * 4.6 + dx, y: ly, z: lz - 0.02 }); B(cylZ(r, 0.08, 16), M.lamp, { x: sx * 4.6 + dx, y: ly, z: lz + 0.02 }); }
      B(cbox(0.3, 0.18, 0.08, 0.02), M.amber, { x: sx * 5.2, y: ly + 0.22, z: lz });
      for (const dx of [-0.6, -0.1, 0.4]) rod(V(sx * 4.6 + dx, ly - 0.35, lz + 0.35), V(sx * 4.6 + dx, ly + 0.4, lz + 0.1), 0.035, M.black, body, 5);
      // 牽引フックとシャックル(下部車体の前)
      B(cbox(0.9, 0.8, 0.7, 0.06), M.metal, { x: sx * 5.2, y: 3.8, z: 18.85 });
      B(new THREE.TorusGeometry(0.36, 0.11, 8, 16, Math.PI * 1.4), M.steel, { x: sx * 5.2, y: 3.55, z: 19.35, ry: Math.PI / 2, rx: -0.3 });
      // 泥よけ(履帯の前後、ゴム)
      B(box(3.4, 1.6, 0.12), M.rubber, { x: sx * TRACK_X, y: 3.5, z: 18.4 });
      B(box(3.6, 2.4, 0.12), M.rubber, { x: sx * TRACK_X, y: 4.3, z: -19.75 });
      // 吊り環(車体の四隅)
      for (const z of [10.0, -16.0]) { onTop(cbox(0.5, 0.2, 0.6, 0.04), M.metal, sx * 7.0, z, 0.2); B(new THREE.TorusGeometry(0.28, 0.08, 6, 14), M.steel, { x: sx * 7.0, y: topY(z) + 0.3, z, ry: Math.PI / 2 }); }
    }
    // ── サイドスカート: 5 枚(前の 1 枚は厚い)。上縁のボルト、吊り手、下縁のゴム ──
    const SKIRT_X = 12.2, SKIRTS = [[-16.2, -10.8], [-10.4, -4.6], [-4.2, 1.6], [2.0, 7.8], [8.2, 14.6]], SK = { y0: 2.9, y1: 6.0 }   // 上縁は張り出しの下の面取りに少し入れる;
    for (const sx of [-1, 1]) SKIRTS.forEach(([z0, z1], i) => {
      const t = i === SKIRTS.length - 1 ? 0.7 : 0.4, x = sx * (SKIRT_X + t / 2), fx = sx * (SKIRT_X + t + 0.01);
      B(cbox(t, SK.y1 - SK.y0, z1 - z0, 0.08), M.paint, { x, y: (SK.y0 + SK.y1) / 2, z: (z0 + z1) / 2 });
      B(box(t * 0.6, 0.45, z1 - z0 - 0.1), M.rubber, { x, y: SK.y0 - 0.2, z: (z0 + z1) / 2 });
      boltRow(body, V(fx, SK.y1 - 0.3, z0 + 0.3), V(fx, SK.y1 - 0.3, z1 - 0.3), Math.round((z1 - z0) / 0.9), V(sx, 0, 0), 0.9);
      grab(V(fx, 4.4, (z0 + z1) / 2 - 0.6), V(fx, 4.4, (z0 + z1) / 2 + 0.6), V(sx, 0, 0), 0.22, 0.05, M.metal);
    });
    // ── 機関室: 吸気グリル 2(枠・羽板)、点検ハッチと吊り手、給油口 2、対空識別板(チーム色の布) ──
    const onDeck = (geo, mat, x, z, h, o = {}) => B(geo, mat, { x, z, y: deckTop(z) + h / 2 - 0.04, rx: deckRX, ...o });
    for (const sx of [-1, 1]) {
      const gx = sx * 3.4, gz = -14.6;
      onDeck(box(3.0, 0.04, 5.6), M.seam, gx, gz, 0.1);
      for (const [a, b] of [[[gx - 1.6, gz - 2.9], [gx + 1.6, gz - 2.9]], [[gx - 1.6, gz + 2.9], [gx + 1.6, gz + 2.9]], [[gx - 1.6, gz - 2.9], [gx - 1.6, gz + 2.9]], [[gx + 1.6, gz - 2.9], [gx + 1.6, gz + 2.9]]]) rod(V(a[0], deckTop(a[1]) + 0.1, a[1]), V(b[0], deckTop(b[1]) + 0.1, b[1]), 0.1, M.trim, body, 6);
      for (let k = 0; k < 20; k++) { const z = gz - 2.7 + k * 0.285; onDeck(box(3.0, 0.04, 0.24), M.metal, gx, z, 0.2, { rx: deckRX - 0.6 }); }
      boltRow(body, V(gx - 1.75, deckTop(gz - 3.05) + 0.02, gz - 3.05), V(gx + 1.75, deckTop(gz - 3.05) + 0.02, gz - 3.05), 6, UP, 0.8);
      onDeck(cyl(0.45, 0.12, 16), M.trim, sx * 4.0, -10.0, 0.16); onDeck(cbox(0.5, 0.08, 0.14, 0.02), M.metal, sx * 4.0, -10.0, 0.26);
      grab(V(sx * 5.4, deckTop(-11.4) + 0.02, -11.0), V(sx * 5.4, deckTop(-11.8) + 0.02, -11.8), UP, 0.18, 0.05);
    }
    for (const [a, b] of [[[-1.5, -9.6], [1.5, -9.6]], [[-1.5, -17.8], [1.5, -17.8]], [[-1.5, -9.6], [-1.5, -17.8]], [[1.5, -9.6], [1.5, -17.8]]]) seam(V(a[0], deckTop(a[1]) + 0.02, a[1]), V(b[0], deckTop(b[1]) + 0.02, b[1]));
    onDeck(box(2.8, 0.05, 3.6), M.team, 0, -14.4, 0.14);
    for (const dz of [-1.7, 1.7]) for (const sx of [-1, 1]) onDeck(box(0.14, 0.08, 0.4), M.strap, sx * 1.42, -14.4 + dz, 0.2);
    // ── 後面: 排気ルーバー 2、尾灯、牽引索 2(輪にして掛ける)、牽引フック、車内通話器、山形の識別標識 ──
    const RZ = -19.42;
    for (const sx of [-1, 1]) {
      B(cbox(3.4, 1.0, 0.3, 0.06), M.black, { x: sx * 4.4, y: 4.75, z: RZ - 0.1 });
      for (let k = 0; k < 4; k++) B(box(3.1, 0.06, 0.22), M.metal, { x: sx * 4.4, y: 4.4 + k * 0.23, z: RZ - 0.24, rx: 0.5 });
      B(cbox(1.1, 0.7, 0.2, 0.05), M.black, { x: sx * 8.6, y: 6.0, z: -19.68 });
      [[0.18, M.red], [-0.12, M.amber]].forEach(([dy, m]) => B(box(0.8, 0.2, 0.06), m, { x: sx * 8.6, y: 6.0 + dy, z: -19.8 }));
      // 牽引索: 下部車体の後面に横長の輪で掛け、端の環を留め具に通す
      const y0 = 3.0 + (sx > 0 ? 0 : 0.55);
      pipe([V(-6.2, y0, RZ - 0.14), V(0, y0 - 0.05, RZ - 0.16), V(6.2, y0, RZ - 0.14), V(6.7, y0 + 0.2, RZ - 0.14), V(6.2, y0 + 0.4, RZ - 0.14), V(0, y0 + 0.45, RZ - 0.16), V(-6.2, y0 + 0.4, RZ - 0.14), V(-6.7, y0 + 0.2, RZ - 0.14)], 0.11, M.steel, body, 80, 6, true);
      for (const x of [-4.0, 4.0]) B(cbox(0.3, 1.4, 0.2, 0.04), M.metal, { x, y: 3.25, z: RZ - 0.08 });
      // 山形の識別標識(後面の上)
      for (const a of [-1, 1]) B(box(1.1, 0.16, 0.04), M.teamPaint, { x: sx * 3.6 + a * 0.38, y: 6.05 - 0.15, z: -19.62, rz: a * 0.6 });
    }
    B(cbox(1.3, 1.0, 0.8, 0.08), M.metal, { y: 2.6, z: RZ - 0.3 });
    B(new THREE.TorusGeometry(0.38, 0.13, 8, 16, Math.PI * 1.4), M.steel, { y: 2.4, z: RZ - 0.85, ry: Math.PI / 2, rx: 0.4 });
    B(cbox(0.8, 0.9, 0.35, 0.05), M.trim, { x: 7.0, y: 4.9, z: RZ - 0.15 }); B(box(0.5, 0.06, 0.06), M.black, { x: 7.0, y: 5.15, z: RZ - 0.34 });   // 車内通話器

    // ── 砲塔: 面取りした楔形(旋回軸は車体中央やや後ろ)。±0.9 rad で振る ──
    const turret = new THREE.Group(); turret.position.set(0, 7.3, -3.2); body.add(turret);
    const T = (geo, mat, o = {}) => add(geo, mat, o.parent ?? turret, o);
    const TUR = [hs(-9.4, 6.4, 0, 6.8, 0.8, 4.6, 3.0), hs(3.6, 7.2, 0, 7.6, 0.9, 4.4, 3.4), hs(9.6, 4.4, 0.3, 4.6, 1.0, 2.6, 2.7)];
    T(U.loft(THREE, TUR), M.paint);
    const roofY = (z) => z <= 3.6 ? 3.0 + 0.4 * (z + 9.4) / 13 : 3.4 - 0.7 * (z - 3.6) / 6;
    const roofRX = (z) => z <= 3.6 ? -Math.atan(0.4 / 13) : Math.atan(0.7 / 6);
    const onRoof = (geo, mat, x, z, h, o = {}) => T(geo, mat, { x, z, y: roofY(z) + h / 2 - 0.06, rx: roofRX(z), ...o });
    // 砲塔の側面の斜面(断面 -9.4 と 3.6 の間)。p = 下端 0 〜 上端 1、off = 外へ。子の +x が外向き、+y が斜面の上向きになる Group を返す
    const turLo = (z) => { const t = (z + 9.4) / 13; return [6.8 + 0.8 * t, 0.8 + 0.1 * t]; }, turHi = (z) => { const t = (z + 9.4) / 13; return [4.6 - 0.2 * t, 3.0 + 0.4 * t]; };
    const onTurSide = (sx, z, p, off) => {
      const lo = turLo(z), hi = turHi(z), d = [hi[0] - lo[0], hi[1] - lo[1]], L = Math.hypot(...d), n = [d[1] / L, -d[0] / L];
      const g = new THREE.Group(); g.position.set(sx * (lo[0] + d[0] * p + n[0] * off), lo[1] + d[1] * p + n[1] * off, z); g.rotation.z = sx > 0 ? Math.atan2(n[1], n[0]) : Math.PI - Math.atan2(n[1], n[0]); turret.add(g); return g;
    };
    const turSideN = (sx, z) => { const lo = turLo(z), hi = turHi(z), d = [hi[0] - lo[0], hi[1] - lo[1]], L = Math.hypot(...d); return V(sx * d[1] / L, -d[0] / L, 0); };
    const turSidePt = (sx, z, p, off = 0) => { const lo = turLo(z), hi = turHi(z), n = turSideN(1, z); return V(sx * (lo[0] + (hi[0] - lo[0]) * p + n.x * off), lo[1] + (hi[1] - lo[1]) * p + n.y * off, z); };
    for (const sx of [-1, 1]) {
      // 追加装甲の板(前寄り)とボルト、雑具箱(後ろ寄り)、手すり、山形の識別標識
      const ap = onTurSide(sx, -2.0, 0.45, 0.1); add(cbox(0.2, 2.0, 3.6, 0.06), M.trim, ap);
      for (const y of [-0.85, 0.85]) for (let k = 0; k < 5; k++) bolt(ap, V(0.1, y, -1.5 + k * 0.75), V(1, 0, 0), 0.8);
      for (const a of [-1, 1]) add(box(0.04, 0.26, 1.3), M.teamPaint, ap, { x: 0.12, y: a * 0.27, z: 0.6, rx: a * 0.55 });   // 山形の識別標識
      const sb = onTurSide(sx, -6.6, 0.42, 0.55); add(cbox(1.0, 1.9, 4.2, 0.08), M.trim, sb);
      for (const z of [-1.3, 1.3]) add(box(0.06, 0.3, 0.4), M.metal, sb, { x: 0.52, y: 0.55, z });
      add(box(0.04, 0.08, 4.0), M.seam, sb, { x: 0.51, y: 0.75 });
      grab(turSidePt(sx, -0.6, 0.97, 0.05), turSidePt(sx, -3.4, 0.97, 0.05), turSideN(sx, -2), 0.25, 0.05, M.steel, turret);
      // 吊り環(屋根の四隅)
      for (const z of [2.0, -8.2]) { const x = sx * (z > 0 ? 3.9 : 4.2); onRoof(cbox(0.5, 0.18, 0.5, 0.04), M.metal, x, z, 0.18); T(new THREE.TorusGeometry(0.26, 0.08, 6, 14), M.steel, { x, y: roofY(z) + 0.28, z, ry: Math.PI / 2 }); }
    }
    // 後部のコンデンサ(主砲の電源): 左右の装甲箱と上面の放熱フィン、側面の警告の帯、ボルト
    for (const sx of [-1, 1]) {
      T(U.loft(THREE, [{ z: -9.2, pts: [[sx * 2.6, 3.0], [sx * 4.4, 3.0], [sx * 4.0, 3.7], [sx * 2.8, 3.7]] }, { z: -2.0, pts: [[sx * 2.6, 3.2], [sx * 4.3, 3.2], [sx * 3.9, 3.9], [sx * 2.8, 3.9]] }]), M.trim);
      for (let k = 0; k < 11; k++) { const z = -7.6 + k * 0.5, y = 3.7 + 0.2 * (z + 9.2) / 7.2; if (sx < 0 && z > -6.0 && z < -4.0) continue; T(box(1.0, 0.28, 0.07), M.metal, { x: sx * 3.4, y: y + 0.12, z }); }   // 放熱フィン(パノラマ照準器・アンテナの台座の所は空ける)
      boltRow(turret, V(sx * 2.65, 3.45, -8.9), V(sx * 2.65, 3.6, -2.4), 7, V(-sx, 0, 0), 0.6);
      T(box(0.05, 0.14, 6.6), M.amber, { x: sx * 4.33, y: 3.35, z: -5.6, rz: sx * 0.3 });
    }
    const capTop = (z) => 3.7 + 0.2 * (z + 9.2) / 7.2;
    // 車長ハッチ(円、縁・蝶番・取っ手)と、前半分を囲む潜望鏡 6
    const HATCH = { x: 1.0, z: -6.0, r: 1.35 };
    onRoof(cyl(HATCH.r + 0.15, 0.14, 24), M.metal, HATCH.x, HATCH.z, 0.14);
    onRoof(cyl(HATCH.r, 0.24, 24), M.trim, HATCH.x, HATCH.z, 0.34);
    onRoof(cbox(0.5, 0.3, 1.1, 0.05), M.metal, HATCH.x - 1.45, HATCH.z, 0.3);
    grab(V(HATCH.x - 0.4, roofY(HATCH.z) + 0.3, HATCH.z + 0.3), V(HATCH.x + 0.4, roofY(HATCH.z) + 0.3, HATCH.z + 0.3), UP, 0.2, 0.05, M.steel, turret);
    for (const a of [-0.85, -0.51, -0.17, 0.17, 0.51, 0.85]) {   // 右のコンデンサ(x 2.6〜)に掛からない範囲
      const x = HATCH.x + 1.65 * Math.sin(a), z = HATCH.z + 1.65 * Math.cos(a);
      onRoof(cbox(0.55, 0.45, 0.42, 0.05), M.trim, x, z, 0.45, { ry: a });
      T(box(0.4, 0.22, 0.04), M.glass, { x: x + Math.sin(a) * 0.22, y: roofY(z) + 0.26, z: z + Math.cos(a) * 0.22, ry: a });
    }
    // 砲手照準器: 屋根の右前の装甲箱。前面の窓と左右に開いた装甲扉
    onRoof(cbox(1.6, 1.0, 1.7, 0.1), M.trim, 2.6, 1.4, 1.0);
    T(box(1.1, 0.45, 0.06), M.glass, { x: 2.6, y: roofY(1.4) + 0.62, z: 2.27 });
    for (const sx of [-1, 1]) T(box(0.56, 0.5, 0.06), M.trim, { x: 2.6 + sx * 0.95, y: roofY(1.4) + 0.62, z: 2.35, ry: sx * 1.0 });
    // パノラマ照準器(左のコンデンサの上): 台と、回る円筒の頭部(窓 1)
    const PANO = { x: -3.5, z: -5.0 };
    T(cbox(1.5, 0.5, 1.5, 0.08), M.trim, { x: PANO.x, y: capTop(PANO.z) + 0.22, z: PANO.z });
    const pano = new THREE.Group(); pano.position.set(PANO.x, capTop(PANO.z) + 0.47, PANO.z); turret.add(pano);
    add(cyl(0.85, 1.1, 24), M.trim, pano, { y: 0.55 }); add(cyl(0.9, 0.12, 24), M.metal, pano, { y: 1.12 });
    add(box(0.9, 0.5, 0.1), M.glass, pano, { y: 0.6, z: 0.8 }); add(cbox(1.1, 0.12, 0.5, 0.03), M.trim, pano, { y: 0.95, z: 0.75 });
    // 発煙弾発射機: 砲塔前部の斜面の台に 4 本の筒(前・外・上向き)とふた
    for (const sx of [-1, 1]) {
      const g = onTurSide(sx, 1.0, 0.5, 0.25); add(cbox(0.5, 1.6, 2.2, 0.08), M.trim, g);
      const dir = V(sx * 0.55, 0.45, 0.7).normalize(), base0 = turSidePt(sx, 1.0, 0.5, 0.45);
      for (let k = 0; k < 4; k++) {
        const base = base0.clone().setZ(0.25 + k * 0.5), qd = new THREE.Quaternion().setFromUnitVectors(UP, dir);
        const t = new THREE.Mesh(cyl(0.27, 1.5, 14), M.metal); t.position.copy(base).addScaledVector(dir, 0.6); t.quaternion.copy(qd); turret.add(t);
        const c = new THREE.Mesh(cyl(0.3, 0.12, 14), M.black); c.position.copy(base).addScaledVector(dir, 1.37); c.quaternion.copy(qd); turret.add(c);
      }
    }
    // アンテナ(後部の両角、ばね台座)と横風センサー
    for (const sx of [-1, 1]) {
      const bz = -8.4, by = capTop(bz) + 0.03, rake = -0.15, len = 5.2;
      T(cbox(0.7, 0.35, 0.7, 0.05), M.trim, { x: sx * 3.6, y: by + 0.17, z: bz });
      for (let k = 0; k < 5; k++) T(new THREE.TorusGeometry(0.18, 0.035, 5, 10), M.steel, { x: sx * 3.6, y: by + 0.45 + k * 0.11, z: bz, rx: Math.PI / 2 });
      const a = V(sx * 3.6, by + 0.95, bz), b = a.clone().add(V(0, len * Math.cos(rake), len * Math.sin(rake)));
      const w = new THREE.Mesh(cyl(0.03, len, 6, 0.08), M.black); w.position.copy(a).add(b).multiplyScalar(0.5); w.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize()); turret.add(w);
      T(new THREE.SphereGeometry(0.07, 8, 6), M.black, { x: b.x, y: b.y, z: b.z });
    }
    T(cyl(0.08, 2.2, 8), M.black, { y: roofY(-8.6) + 1.05, z: -8.6 });
    T(cbox(0.5, 0.3, 0.5, 0.04), M.trim, { y: roofY(-8.6) + 2.2, z: -8.6 }); T(cyl(0.05, 0.6, 6), M.black, { y: roofY(-8.6) + 2.65, z: -8.6 });
    // 砲塔後部のバスケット: 管の枠、網の床、中に幌の巻き物・収納箱 2・燃料缶 2、締め帯
    const RACK = { y0: 1.3, y1: 2.5, z0: -9.4, z1: -11.8, hx: 4.9, bar: 0.09 };
    {
      const r = RACK, P = (x, y, z) => V(x, y, z);
      for (const y of [r.y0, r.y1]) pipe([P(-r.hx, y, r.z0), P(-r.hx, y, r.z1), P(r.hx, y, r.z1), P(r.hx, y, r.z0)], r.bar, M.metal, turret, 24, 6);
      for (const x of [-r.hx, -r.hx / 3, r.hx / 3, r.hx]) rod(P(x, r.y0, r.z1), P(x, r.y1, r.z1), r.bar, M.metal, turret, 6);
      for (const sx of [-1, 1]) rod(P(sx * r.hx, r.y0, r.z0 + 0.6), P(sx * r.hx, r.y1, r.z0 + 0.6), r.bar, M.metal, turret, 6);
      const mesh = []; for (let i = 0; i <= 12; i++) mesh.push([box(0.04, 0.04, r.z0 - r.z1), { x: -r.hx + i * (2 * r.hx / 12), y: r.y0, z: (r.z0 + r.z1) / 2 }]);
      for (let i = 0; i <= 4; i++) mesh.push([box(2 * r.hx, 0.04, 0.04), { y: r.y0, z: r.z0 - i * (r.z0 - r.z1) / 4 }]);
      T(U.merge(THREE, mesh), M.metal);
      T(cylX(0.65, 4.4, 18), M.canvas, { x: -2.5, y: r.y0 + 0.69, z: -10.6 });
      for (const x of [-4.0, -1.0]) T(new THREE.TorusGeometry(0.68, 0.05, 6, 18), M.strap, { x, y: r.y0 + 0.69, z: -10.6, ry: Math.PI / 2 });
      T(cbox(1.8, 1.0, 1.6, 0.08), M.trim, { x: 1.0, y: r.y0 + 0.52, z: -10.7 }); T(cbox(1.4, 0.8, 1.5, 0.08), M.canvas, { x: 1.0, y: r.y0 + 1.42, z: -10.7 });
      for (const x of [2.85, 4.05]) { T(cbox(1.0, 1.55, 0.6, 0.05), M.trim, { x, y: r.y0 + 0.8, z: -10.3 }); for (const a of [-1, 1]) T(box(0.1, 1.5, 0.04), M.trim, { x, y: r.y0 + 0.8, z: -10.62, rz: a * 0.55 }); T(cyl(0.12, 0.16, 10), M.black, { x: x + 0.3, y: r.y0 + 1.62, z: -10.2 }); }
      T(box(2 * r.hx, 0.06, 0.14), M.strap, { y: r.y0 + 1.1, z: -11.0 });
    }

    // ── 主砲(レールガン): 防盾と布の防塵カバー、尾部の給電部、角断面の密閉筐体、拘束クランプ 6、砲口の口金と角形の砲口、基準センサー ──
    const gun = new THREE.Group(); gun.position.set(0, 1.9, 8.6); turret.add(gun);
    const G = (geo, mat, o = {}) => add(geo, mat, o.parent ?? gun, o);
    const GL = 25, GW = 1.5, GH = 2.2, MZ = 2.0 + GL;
    const crect = (hw, hh, c) => [[-hw + c, -hh], [hw - c, -hh], [hw, -hh + c], [hw, hh - c], [hw - c, hh], [-hw + c, hh], [-hw, hh - c], [-hw, -hh + c]];
    G(U.loft(THREE, [{ z: -1.0, pts: crect(1.9, 1.7, 0.25) }, { z: 2.0, pts: crect(1.55, 1.55, 0.25) }, { z: 2.6, pts: crect(1.3, 1.45, 0.2) }]), M.paint);   // 防盾
    for (const y of [-1.35, 1.35]) boltRow(gun, V(-1.2, y, 2.25), V(1.2, y, 2.25), 6, V(0, 0, 1), 0.7);
    G(U.loft(THREE, [{ z: 0.4, pts: crect(2.15, 1.95, 0.3) }, { z: 0.65, pts: crect(2.0, 1.82, 0.3) }, { z: 0.9, pts: crect(2.15, 1.95, 0.3) }, { z: 1.15, pts: crect(2.0, 1.82, 0.3) }]), M.canvas);   // 布の防塵カバー(蛇腹)
    G(cbox(GW + 1.0, GH + 1.0, 4.6, 0.15), M.trim, { z: 4.6 });                                                    // 尾部の給電部
    for (const sx of [-1, 1]) { boltRow(gun, V(sx * (GW / 2 + 0.52), -1.1, 2.7), V(sx * (GW / 2 + 0.52), -1.1, 6.5), 5, V(sx, 0, 0), 0.7); boltRow(gun, V(sx * (GW / 2 + 0.52), 1.1, 2.7), V(sx * (GW / 2 + 0.52), 1.1, 6.5), 5, V(sx, 0, 0), 0.7); }
    for (const sx of [-1, 1]) pipe([V(sx * 1.6, 0.3, -0.6), V(sx * 1.75, 0.3, 1.6), V(sx * 1.4, 0.4, 3.4), V(sx * 1.28, 0.4, 4.0)], 0.24, M.black, gun, 20, 10);   // 給電導管
    pipe([V(0.5, 1.6, 3.0), V(0.6, 1.75, 4.6), V(0.4, 1.62, 6.6)], 0.09, M.metal, gun, 12, 6);                     // 冷却の配管
    G(U.loft(THREE, [{ z: 6.8, pts: crect(GW / 2, GH / 2, 0.14) }, { z: MZ - 0.3, pts: crect(GW / 2 - 0.1, GH / 2 - 0.15, 0.12) }]), M.paint);   // 密閉筐体(砲口へわずかに細く)
    for (const sx of [-1, 1]) seam(V(sx * (GW / 2 + 0.005), 0, 7.0), V(sx * (GW / 2 - 0.095), 0, MZ - 0.6), gun);   // 側面の継ぎ目(レールの高さ)
    for (let k = 0; k < 6; k++) {
      const z = 7.6 + k * 3.6, s = 1 - 0.1 * (z - 6.8) / GL;
      G(cbox(GW * s + 0.34, GH * s + 0.34, 0.7, 0.08), M.metal, { z });
      for (const x of [-0.45, 0.45]) { bolt(gun, V(x * s, (GH * s) / 2 + 0.17, z), UP, 0.7); bolt(gun, V(x * s, -(GH * s) / 2 - 0.17, z), V(0, -1, 0), 0.7); }
    }
    G(cbox(GW + 0.1, GH + 0.1, 0.9, 0.08), M.heat, { z: MZ - 0.45 });                                              // 砲口の口金
    G(box(0.46, 0.9, 0.3), M.seam, { z: MZ - 0.1 });                                                               // 角形の砲口(口金の前面より 0.05 出す)
    G(cbox(0.55, 0.32, 0.65, 0.04), M.trim, { y: GH / 2 + 0.2, z: MZ - 1.4 }); G(box(0.32, 0.16, 0.04), M.glass, { y: GH / 2 + 0.22, z: MZ - 1.07 });   // 基準センサー
    T(cylZ(0.2, 2.2, 10), M.black, { x: 2.8, y: 2.15, z: 10.2 }); T(cbox(0.6, 0.6, 0.5, 0.05), M.trim, { x: 2.8, y: 2.15, z: 9.45 });   // 同軸機銃と銃眼
    const muzzle = new THREE.Object3D(); muzzle.position.z = MZ; gun.add(muzzle);

    // ── 射撃: リアル版の演出(tank.js の RF と同じ数値。親は group なので車体が揺れても煙は残る) ──
    const realFx = U.muzzleFx(THREE, group, { ground: 0.3, seed: 29,
      flash: { len: 0.08, size: [8, 20], tongue: { len: [16, 26], width: [4, 6], side: 0 } }, light: { len: 0.14, power: 120000, z: 5 },
      balls: { per: 8, len: 0.34, size: 6, speed: 60, length: 10 },
      smoke: { per: 30, len: [2.5, 4.2], speed: 30, spread: 0.5, drag: 1.6, rise: 3.0, size: [2, 4], grow: [14, 24], peak: 0.4 },
      wisps: { per: 5, len: [1.4, 2.0] },
      dust: { per: 24, len: [1.8, 3.0], speed: 36, drag: 1.6, size: [3, 4.5], grow: 22, peak: 0.65, ahead: 4, angle: 1.2 },
      sparks: { per: 56, len: 1.1, speed: [45, 100], spread: 0.5, gravity: 60, drag: 1.4, bounce: 0.3 } });

    // ── 動き ──
    const SPEED = 4.2 * 1.85;   // 履帯の送り(tank.js と同じ)
    let moving = false, traverse = false, clock = 0, yaw = 0, charging = false, charge = 0, recoil = 0, rock = 0, heat = 0, panoYaw = 0, baked = null;
    function update(dt) {
      clock += dt; K.tick(group);
      if (moving) {
        trackS -= dt * SPEED; layTracks();
        for (const s of wheelSets) s.rot += dt * SPEED * s.speed;
        layWheels();
      }
      body.position.y = moving ? 0.04 + 0.03 * Math.sin(clock * 9) + 0.02 * Math.sin(clock * 5.3) : body.position.y * 0.85;
      const target = traverse ? Math.sin(clock * 0.6) * 0.9 : 0;
      yaw += (target - yaw) * Math.min(1, dt * 3); turret.rotation.y = yaw;
      panoYaw += ((traverse ? Math.sin(clock * 0.37) * 1.4 : 0) - panoYaw) * Math.min(1, dt * 1.5); pano.rotation.y = panoYaw;   // パノラマ照準器は砲塔と別に周りを見る
      if (charging) {
        charge = Math.min(1, charge + dt / 0.6);
        if (charge >= 1) { charging = false; charge = 0; recoil = 1; rock = 1; heat = 1; realFx.fire(muzzle); }
      }
      if (recoil > 0) { recoil = Math.max(0, recoil - dt * 2.4); gun.position.z = 8.6 - 1.8 * Math.sin(recoil * Math.PI * 0.5); }
      let pitch = moving ? 0.003 * Math.sin(clock * 3.1) : 0;
      if (rock > 0) { rock = Math.max(0, rock - dt * 1.6); pitch += -0.025 * rock * Math.sin((1 - rock) * Math.PI * 2.5) * Math.exp(-(1 - rock) * 2); }
      body.rotation.x = pitch;
      heat = Math.max(0, heat - dt / 3.5); M.heat.emissive.setRGB(1.0, 0.32, 0.08).multiplyScalar(heat * heat * 1.6);   // 撃ったあと口金が熱で赤く光り、冷める
      realFx.update(dt);
    }
    function fire() { if (!charging && recoil <= 0.05) charging = true; }

    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "camo", dirt = 1;
    const applyPaint = () => K.setLook({ paint, dirt, team: teamColor });
    function fitPlate() {
      const inner = U.reach(THREE, group, body) + 1.5, outer = inner + 3;
      flat(new THREE.RingGeometry(inner, outer, 96), M.ring, 0.25);
      flat(new THREE.CircleGeometry(inner - 0.4, 96), M.glow, 0.2);
      flat(new THREE.PlaneGeometry(6.5, 6.5), M.sign, 0.35, outer + 3.6);
      return outer;
    }
    const plateRadius = fitPlate();
    applyPaint();
    // 隙間の確認値(すべて正なら貫通なし)
    const check = () => {
      const linkOut = LINK_OFF + 0.28, SAG = 0.1;   // 履板のパッドの外面(輪から)、車体の揺れで張り出しが下がる分
      const rackBottom = turret.position.y + RACK.y0 - RACK.bar;
      return {
        trackTopToHull: +(5.45 - (FR.y + R + linkOut) - SAG).toFixed(2),
        trackToSkirt: +(SKIRT_X - (TRACK_X + TRACK_W / 2)).toFixed(2),
        cradleToCoax: +((2.8 - 0.3) - 2.15).toFixed(2),
        trackToLowerHull: +((TRACK_X - TRACK_W / 2) - 7.6).toFixed(2),
        guideHornGap: +((ROAD.half - ROAD.w / 2) - 0.15).toFixed(2),
        frontFlapToTrack: +((18.4 - 0.06) - (FR.x + R + linkOut)).toFixed(2),
        rearFlapToTrack: +((BK.x - R - linkOut) - (-19.75 + 0.06)).toFixed(2),
        rackOverDeck: +(rackBottom - deckTop(-9.0)).toFixed(2),
        rackOverDeckItems: +(rackBottom - (deckTop(-10.0) + 0.3)).toFixed(2),
        gunOverPeriscopes: +((turret.position.y + 1.9 - GH / 2 - 0.17) - (topY(14.6) + 0.6)).toFixed(2),
        turretSweepToDriverHatch: +((12.6 - 1.75) - turret.position.z - Math.hypot(RACK.hx, RACK.z1)).toFixed(2),
      };
    };
    baked = U.bake(THREE, group, { dynamic: [body, turret, gun, pano], also: STATIC });
    K.finish(group);
    return {
      plateRadius, group, update, fire, check, realistic: true,
      setTeam: (c) => { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }, setPaint: (p) => { paint = U.REAL_PAINTS[p] ? p : "camo"; applyPaint(); },
      setDirt: (d) => { dirt = d; applyPaint(); }, get dirt() { return dirt; },
      stats: () => U.stats(group), parts: { turret, gun, plate },
      setMoving: (b) => (moving = b), setTraverse: (b) => (traverse = b),
      get moving() { return moving; }, get traverse() { return traverse; }, get paint() { return paint; }, get charging() { return charging; },
    };
  }

  (window.DreamAssets ??= {}).tankHD = tankHD;
})();
