// 部隊トークン「偵察」(試作)。装甲強襲 v3・自走砲・対空車両と同じ家族の外観(大きな平面、光る継ぎ目はチーム色の細い線だけ、センサーは暗いガラス)で、
// 足回りだけ装軌をやめて 4 輪の装輪にした小さく細い偵察車。仕様書の「細い車体とセンサーポール」に合わせる。
// 下敷きは Fennek(4×4 の装輪偵察車)。低い楔形の車体、短いボンネットと小さな防弾ガラスの風防、屋根の後ろに伸縮式のセンサーマスト、
// 屋根の前に遠隔操作の銃塔(12.7mm 重機関銃)。
//   車体: 前に小さな風防 2 枚、肩の斜面に側窓、屋根に乗員ハッチ 2(潜望鏡つき)、発煙弾発射機 3 連 ×2、後ろの機関室の上に吸気グリルと排気口、
//     車輪の間に雑具箱、後ろ寄りに固定の鞭型アンテナ 2、後面に扉・燃料缶・尾灯・牽引具、前に前照灯・牽引環・ミラー。
//   センサーマスト: 3 段の伸縮柱。収納時は頭部(電子光学の窓 3 つ: 熱線・昼間カメラ・レーザー測距)が屋根の受け台に載る。
//     停車中だけ伸ばし(3 秒)、伸び切ったら頭部がゆっくり左右を走査する。下ろすときは頭部を正面へ戻してから縮める。走り出すのはマストを下ろしきってから。
//   動き: 走行(4 輪が回り、車体がわずかに揺れる)、銃塔旋回(±69°。後ろのマストへは向けない)、機関銃の連射(閃光・銃身の短い後座・薄い煙・薬莢)。
//   回るアンテナ・皿形レーダー・光る照準線は使わない(SKILL の決まり)。マストの頭部の走査は実物の観測装置の動き。
//
//   const s = DreamAssets.scout(THREE);
//   scene.add(s.group); s.setTeam(0xff6a1a); s.setPaint("stealth" | "team" | "white"); s.setMast(true); s.fireGun(); s.update(dt)
//
// 前方 = +z、上 = +y。ゲームの部隊表示倍率 2.0 を前提にした寸法(全長 約 31、幅 約 14。装甲強襲の 3/4 ほどの長さで幅は半分強)。
(function () {
  const C = { graphite: 0x2c343c, graphite2: 0x3a434c, white: 0xf2f4f6, light: 0xdfe4e9, dark: 0x262e36, mech: 0x4a535c, tire: 0x2a3036, edge: 0x141b21 };

  function scout(THREE, opts = {}) {
    const U = DreamAssets.util;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      hull: lambert(C.graphite), hull2: lambert(C.graphite2), deck: lambert(C.graphite2),
      dark: lambert(C.dark), light: lambert(C.light), mech: lambert(C.mech), tire: lambert(C.tire, { flatShading: true }), glass: lambert(0x18242e), brass: lambert(0xc8a24a),
      strip: basic(0xff6a1a),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.55 }),
      ring: basic(0xff6a1a, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      glow: basic(0xff6a1a, { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      sign: new THREE.MeshBasicMaterial({ map: U.signTexture(THREE, "偵"), transparent: true }),
      flame: basic(0xffb347, { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      flashCore: basic(0xfff3d0, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
      smoke: basic(0x7d838a, { transparent: true, opacity: 0.3, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "scout";
    const body = new THREE.Group(); group.add(body);   // 走行で揺れる上の部分(車輪と支持腕は group に残る = 懸架)
    const addU = U.adder(THREE, M.edge, 20);
    const add = (geo, mat, { parent = body, ...o } = {}) => addU(geo, mat, parent, o);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h, n = 10) => new THREE.CylinderGeometry(r, r, h, n);
    const cylZ = (r, h, n = 12) => { const g = cyl(r, h, n); g.rotateX(Math.PI / 2); return g; };
    const cylX = (r, h, n = 12) => { const g = cyl(r, h, n); g.rotateZ(Math.PI / 2); return g; };

    // ── 足元: ベースプレート(大きさは最後に fitPlate で決める) ──
    const plate = new THREE.Group(); group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };

    // ── 車輪: 4 輪の大径オフロードタイヤ(太いブロックの溝、明るいリム、ハブとナット 8)。同じ中身の Group 4 つを bake の instanced で 1 つにする ──
    const W = { r: 2.7, w: 2.0, x: 6.0, y: 2.7, axles: [8.4, -8.6], lug: 0.36 };
    const tireG = cylX(W.r, W.w, 24), rimG = cylX(1.6, W.w + 0.16, 16), hubG = cylX(0.65, W.w + 0.5, 8), stubG = cylX(0.38, 0.9, 8);
    const lugs = [], nuts = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; lugs.push([box(W.w + 0.1, W.lug, 0.8), { y: Math.cos(a) * W.r, z: Math.sin(a) * W.r, rx: a }]); }
    for (const s of [-1, 1]) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; nuts.push([cylX(0.13, 0.14, 6), { x: s * (W.w / 2 + 0.13), y: Math.cos(a) * 1.05, z: Math.sin(a) * 1.05 }]); }
    const lugG = U.merge(THREE, lugs), nutG = U.merge(THREE, nuts);
    const wheels = [];
    for (const sx of [-1, 1]) for (const z of W.axles) {
      const g = new THREE.Group(); g.position.set(sx * W.x, W.y, z); group.add(g); wheels.push(g);
      addU(tireG, M.tire, g); addU(lugG, M.tire, g, { edges: false });
      addU(rimG, M.light, g); addU(hubG, M.dark, g, { edges: false }); addU(nutG, M.dark, g, { edges: false });
      addU(stubG, M.dark, group, { x: sx * 4.75, y: W.y, z, edges: false });                 // 独立懸架の腕(下部車体からハブへ)
      if (z < 0) addU(box(2.4, 2.2, 0.22), M.dark, group, { x: sx * W.x, y: 3.9, z: z - W.r - 0.75, edges: false });   // 後輪の後ろの泥よけの垂れ(前輪の後ろは雑具箱)
    }

    // ── 車体: 車輪の間の細い下部車体 + 車輪の上へ張り出す上部車体(側面は上へ行くほど内側に倒す) ──
    add(U.loft(THREE, [
      { z: 14.6, pts: U.sym([[3.4, 3.0], [3.6, 4.5]]) },
      { z: 12.0, pts: U.sym([[4.4, 2.3], [4.4, 6.0]]) },
      { z: -11.8, pts: U.sym([[4.4, 2.3], [4.4, 6.0]]) },
      { z: -14.6, pts: U.sym([[3.8, 3.0], [3.8, 4.6]]) },
    ]), M.hull2);
    // 断面: b = 下端、t = 屋根、w = 下端の半幅、wt = 屋根の半幅。肩は下端から 42% の高さ。車輪の上(z -11.6〜11.6)は下端をタイヤの上 0.5 に置く
    const sec = (z, b, t, w, wt) => ({ z, pts: U.sym([[w, b], [w + 0.2, b + (t - b) * 0.42], [wt, t]]) });
    const HULL = [
      sec(15.6, 4.4, 5.5, 5.6, 4.0),     // 0 鼻先(バンパーの上)
      sec(12.4, 4.2, 6.1, 7.0, 5.2),     // 1 前の泥よけの端
      sec(11.6, 5.9, 6.26, 7.0, 5.3),    // 2 前輪の上
      sec(7.6, 5.9, 7.0, 7.0, 5.3),      // 3 ボンネットの後ろ(風防の下端)
      sec(4.6, 5.9, 8.4, 7.0, 5.0),      // 4 風防の上端
      sec(-9.0, 5.9, 8.4, 7.0, 5.0),     // 5 屋根の後ろ
      sec(-11.6, 5.9, 8.0, 7.0, 5.0),    // 6 後輪の上
      sec(-12.4, 4.4, 7.85, 6.9, 5.0),   // 7 後ろの泥よけの端
      sec(-15.4, 4.6, 7.4, 6.4, 4.6),    // 8 後面
    ];
    add(U.loft(THREE, HULL), M.hull);
    U.edgeStrip(THREE, M.strip, HULL, 4, 2, 6, body); U.edgeStrip(THREE, M.strip, HULL, 1, 2, 6, body);              // 肩の継ぎ目
    U.edgeStrip(THREE, M.strip, HULL, 5, 4, 5, body, { up: true }); U.edgeStrip(THREE, M.strip, HULL, 0, 4, 5, body, { up: true });   // 屋根の縁
    const ROOF = 8.4;
    const topY = (z) => z >= 7.6 ? 7.0 - (z - 7.6) * 1.5 / 8 : z >= 4.6 ? ROOF - (z - 4.6) * 1.4 / 3 : z >= -9 ? ROOF : z >= -11.6 ? ROOF - (-9 - z) * 0.4 / 2.6 : z >= -12.4 ? 8.0 - (-11.6 - z) * 0.15 / 0.8 : 7.85 - (-12.4 - z) * 0.45 / 3;
    const topRX = (z) => z >= 7.6 ? Math.atan(1.5 / 8) : z >= 4.6 ? Math.atan(1.4 / 3) : z >= -9 ? 0 : z >= -11.6 ? -Math.atan(0.4 / 2.6) : z >= -12.4 ? -Math.atan(0.15 / 0.8) : -Math.atan(0.45 / 3);
    const onTop = (geo, mat, x, z, h, o = {}) => add(geo, mat, { x, z, y: topY(z) + h / 2 - 0.08, rx: topRX(z), ...o });

    // 前: ボンネットの点検板と吊り環、風防 2 枚(中央に柱)、前照灯、牽引環、バンパーの暗い帯、ミラー
    onTop(box(6.6, 0.1, 4.4), M.hull2, 0, 11.4, 0.1, { edges: false });
    for (const sx of [-1, 1]) onTop(box(0.5, 0.35, 0.5), M.dark, sx * 3.9, 13.8, 0.35, { edges: false });
    const pane = (x0, x1) => { const p = (z) => { const y = topY(z); return { z, pts: [[x0, y - 0.12], [x1, y - 0.12], [x1, y + 0.05], [x0, y + 0.05]] }; }; add(U.loft(THREE, [p(7.25), p(4.95)]), M.glass, { edges: false }); };
    pane(-3.7, -0.3); pane(0.3, 3.7);
    for (const sx of [-1, 1]) {
      add(box(1.5, 0.55, 0.12), M.glass, { x: sx * 3.5, y: 4.95, z: 15.62, edges: false });
      add(box(1.9, 0.75, 0.1), M.dark, { x: sx * 3.5, y: 4.95, z: 15.6, edges: false });
      add(box(0.6, 0.6, 0.9), M.dark, { x: sx * 2.4, y: 3.7, z: 14.9 });                    // 牽引環
      add(box(1.4, 0.18, 0.18), M.dark, { x: sx * 7.6, y: 6.45, z: 8.6, edges: false });    // ミラーの腕(肩の斜面から)
      add(box(0.25, 1.1, 0.8), M.hull2, { x: sx * 8.35, y: 6.9, z: 8.6 });
    }
    add(box(9.0, 0.5, 0.2), M.dark, { y: 4.45, z: 15.55, edges: false });

    // 側面: 肩の斜面の側窓(乗員室)、車輪の間の雑具箱(蝶番の線と留め金)
    const S0 = [7.2, 6.95], S1 = [5.0, ROOF], sd = [S1[0] - S0[0], S1[1] - S0[1]], sL = Math.hypot(...sd), sn = [sd[1] / sL, -sd[0] / sL];   // 斜面と外向きの法線
    const sp = (p, off) => [S0[0] + sd[0] * p + sn[0] * off, S0[1] + sd[1] * p + sn[1] * off];
    { const [x1, y1] = sp(0.28, 0.04), [x2, y2] = sp(0.8, 0.04), w = (z) => ({ z, pts: [[-x1, y1], [x1, y1], [x2, y2], [-x2, y2]] }); add(U.loft(THREE, [w(4.0), w(-0.8)]), M.glass, { edges: false }); }
    for (const sx of [-1, 1]) {
      add(box(2.4, 2.48, 10.2), M.hull2, { x: sx * 5.7, y: 4.64, z: -0.1 });
      add(box(0.1, 0.14, 10.0), M.dark, { x: sx * 6.92, y: 5.55, z: -0.1, edges: false });
      for (const z of [-3.2, 3.0]) add(box(0.14, 0.5, 0.7), M.dark, { x: sx * 6.95, y: 4.4, z, edges: false });
    }

    // 屋根: 乗員ハッチ 2(潜望鏡つき)、前の角に発煙弾発射機 3 連、後ろの角にレーザー警報器
    for (const sx of [-1, 1]) {
      onTop(cyl(1.15, 0.22, 8), M.hull2, sx * 2.6, -3.0, 0.22, { ry: Math.PI / 8 });
      for (const dx of [-0.6, 0.6]) onTop(box(0.55, 0.45, 0.4), M.glass, sx * 2.6 + dx, -1.6, 0.45, { edges: false });
      const dir = new THREE.Vector3(sx * 0.5, 0.5, 0.7).normalize(), up = new THREE.Vector3(0, 1, 0);
      onTop(box(1.6, 0.5, 1.4), M.hull2, sx * 4.1, 3.4, 0.5);
      for (let k = 0; k < 3; k++) { const m = add(cylZ(0.24, 1.2, 8).rotateX(-Math.PI / 2), M.dark, { edges: false }); m.position.set(sx * 4.1 + sx * 0.25, ROOF + 0.6, 2.9 + k * 0.5).addScaledVector(dir, 0.4); m.quaternion.setFromUnitVectors(up, dir); }
      onTop(box(0.7, 0.45, 0.7), M.dark, sx * 4.2, -8.4, 0.45);
      onTop(new THREE.SphereGeometry(0.28, 8, 4), M.glass, sx * 4.2, -8.4, 0.9, { edges: false });
    }
    // 後ろ: 機関室の吸気グリル 5、排気口(右)、固定の鞭型アンテナ 2(回さない)
    for (let k = 0; k < 5; k++) onTop(box(5.6, 0.12, 0.42), M.dark, -0.4, -10.0 - k * 0.85, 0.12, { edges: false });
    onTop(box(1.6, 0.32, 1.4), M.dark, 3.9, -13.4, 0.32);
    for (const z of [-13.8, -13.4, -13.0]) onTop(box(1.2, 0.06, 0.12), M.light, 3.9, z, 0.38, { edges: false });
    const ANT = { x: 4.2, z: -12.1, len: 6.5, rx: -0.18 };
    for (const sx of [-1, 1]) {
      onTop(cyl(0.35, 0.5, 8), M.dark, sx * ANT.x, ANT.z, 0.5);
      add(cyl(0.07, ANT.len, 6), M.dark, { x: sx * ANT.x, y: topY(ANT.z) + 0.42 + (ANT.len / 2) * Math.cos(ANT.rx), z: ANT.z + (ANT.len / 2) * Math.sin(ANT.rx), rx: ANT.rx, edges: false });
    }
    // 後面: 扉(蝶番つき)、燃料缶 2(締め帯)、尾灯、牽引具
    add(box(4.4, 2.2, 0.2), M.hull2, { x: 1.2, y: 5.9, z: -15.45 });
    for (const y of [5.2, 6.6]) add(box(0.3, 0.45, 0.3), M.dark, { x: 3.5, y, z: -15.5, edges: false });
    for (const x of [-2.8, -4.4]) { add(box(1.3, 1.8, 0.7), M.hull2, { x, y: 5.6, z: -15.75 }); add(box(1.4, 0.22, 0.8), M.dark, { x, y: 5.9, z: -15.75, edges: false }); }
    for (const sx of [-1, 1]) {
      add(box(0.7, 0.5, 0.12), M.glass, { x: sx * 5.6, y: 6.2, z: -15.46, edges: false });
      add(box(0.6, 0.6, 0.9), M.dark, { x: sx * 3.0, y: 3.7, z: -14.9 });
    }

    // ── 銃塔(遠隔操作): 屋根の前寄り(旋回軸 z 0.6)。旋回台、左右の支え、12.7mm 重機関銃、後ろの弾薬箱、右の照準センサー ──
    const RWS = { z: 0.6, y: ROOF + 0.35, yawMax: 1.2 };
    add(cyl(1.7, 0.35, 12), M.dark, { y: ROOF + 0.17, z: RWS.z, edges: false });
    const rws = new THREE.Group(); rws.position.set(0, RWS.y, RWS.z); body.add(rws);
    const R = (geo, mat, o = {}) => add(geo, mat, { ...o, parent: o.parent ?? rws });
    R(box(2.8, 0.6, 2.8), M.hull2, { y: 0.3 });
    for (const sx of [-1, 1]) R(box(0.35, 1.9, 1.8), M.hull2, { x: sx * 1.05, y: 1.55, z: 0.1 });
    R(cylX(0.22, 2.6, 8), M.dark, { y: 1.9, z: 0.2, edges: false });                                 // 砲耳の軸
    R(box(1.8, 1.2, 1.4), M.hull2, { y: 1.2, z: -2.2 });                                             // 弾薬箱(揺架の後ろ)
    R(box(1.9, 1.3, 0.2), M.dark, { y: 1.2, z: -2.2, edges: false });                                // 締め帯
    R(box(1.1, 1.0, 1.6), M.hull2, { x: 1.78, y: 1.9, z: 0.4 });                                     // 照準センサー(昼間・熱線)
    R(box(0.85, 0.6, 0.1), M.glass, { x: 1.78, y: 1.95, z: 1.24, edges: false });
    const gun = new THREE.Group(); gun.position.set(0, 1.9, 0.2); rws.add(gun);
    const G = (geo, mat, o = {}) => add(geo, mat, { ...o, parent: o.parent ?? gun });
    const BORE = 0.78;   // 銃身の高さ(銃の座標)
    G(box(1.4, 0.8, 3.6), M.dark, { z: 0.3 });                                                       // 揺架
    G(box(0.8, 0.75, 2.8), M.mech, { y: BORE, z: 0.0 });                                             // 機関部
    G(cylZ(0.3, 1.3, 10), M.mech, { y: BORE, z: 2.0, edges: false });                                // 銃身の支え
    for (const sx of [-1, 1]) G(box(0.16, 0.5, 0.16), M.dark, { x: sx * 0.25, y: BORE - 0.1, z: -1.6, edges: false });   // 後ろの握り
    const slide = new THREE.Group(); gun.add(slide);                                                  // 後座する銃身
    G(cylZ(0.17, 6.2, 8), M.dark, { parent: slide, y: BORE, z: 4.5, edges: false });
    G(cylZ(0.26, 0.6, 8), M.dark, { parent: slide, y: BORE, z: 7.9, edges: false });                 // 消炎器
    const MZ = 8.3;
    const holder = new THREE.Group(); holder.position.y = BORE; gun.add(holder);
    const gunFlash = U.flashAt(THREE, addU, M.flame, M.flashCore, holder, MZ, 0.32);
    const muzzle = new THREE.Object3D(); muzzle.position.z = MZ; holder.add(muzzle);
    const eject = new THREE.Object3D(); eject.position.set(0.5, BORE, -0.2); gun.add(eject);         // 薬莢の排出口(右)

    // ── センサーマスト: 屋根の後ろ(z -7)の受け台から 3 段の伸縮柱が上がる。頭部は収納時に受け台に載る ──
    const MAST = { z: -7.0, base: ROOF + 0.9, stage: 4.0, len: 4.6, time: 3.0, head: { w: 3.4, h: 1.8, d: 2.6 } };
    add(box(3.0, 0.9, 3.0), M.hull2, { y: ROOF + 0.45, z: MAST.z });
    for (const sx of [-1, 1]) add(box(0.4, 1.5, 2.2), M.dark, { x: sx * 1.95, y: ROOF + 0.75, z: MAST.z });   // 頭部の受け(左右から挟む)
    const tubes = [0.7, 0.55, 0.42].map((r) => {
      const g = new THREE.Group(); g.position.set(0, MAST.base - 0.05, MAST.z); body.add(g);   // 縮めたときの上端は受け台の面より 0.05 下(面の重なりを避ける)
      add(cyl(r, MAST.len, 12), M.light, { parent: g, y: -MAST.len / 2 });
      add(cyl(r + 0.08, 0.3, 12), M.dark, { parent: g, y: -0.15, edges: false });                     // 段の継ぎ目の締め輪
      return g;
    });
    const head = new THREE.Group(); head.position.set(0, MAST.base, MAST.z); body.add(head);
    const H = (geo, mat, o = {}) => add(geo, mat, { ...o, parent: head });
    const HB = 0.1 + MAST.head.h / 2;   // 頭部の箱の中心の高さ
    H(cyl(0.6, 0.1, 10), M.dark, { y: 0.05, edges: false });
    H(box(MAST.head.w, MAST.head.h, MAST.head.d), M.hull2, { y: HB });
    H(box(2.9, 1.15, 0.1), M.dark, { y: HB, z: MAST.head.d / 2 + 0.05, edges: false });
    for (const [x, r] of [[-0.85, 0.44], [0.35, 0.3]]) H(cylZ(r, 0.2, 14), M.glass, { x, y: HB, z: MAST.head.d / 2 + 0.12, edges: false });   // 熱線・昼間カメラ
    H(box(0.4, 0.3, 0.16), M.glass, { x: 1.1, y: HB + 0.15, z: MAST.head.d / 2 + 0.1, edges: false });   // レーザー測距
    H(box(MAST.head.w + 0.1, 0.14, 0.9), M.hull, { y: HB + MAST.head.h / 2 + 0.07, z: MAST.head.d / 2 - 0.1 });   // 日よけ
    H(box(0.9, 0.7, 0.4), M.dark, { y: HB - 0.3, z: -MAST.head.d / 2 - 0.2, edges: false });          // 後ろの配線箱
    U.edgeStrip(THREE, M.strip, [{ z: -MAST.head.d / 2, pts: [[MAST.head.w / 2, HB + 0.6]] }, { z: MAST.head.d / 2, pts: [[MAST.head.w / 2, HB + 0.6]] }], 0, 0, 1, head);
    U.edgeStrip(THREE, M.strip, [{ z: -MAST.head.d / 2, pts: [[-MAST.head.w / 2, HB + 0.6]] }, { z: MAST.head.d / 2, pts: [[-MAST.head.w / 2, HB + 0.6]] }], 0, 0, 1, head);

    // ── 射撃の煙・薬莢(車両の座標に置き、銃塔が回っても出た場所に残る) ──
    const PUFFS = 12, puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.smoke, PUFFS); puffs.visible = false; puffs.frustumCulled = false; group.add(puffs);
    const puff = Array.from({ length: PUFFS }, () => ({ t: 9, pos: new THREE.Vector3(), vel: new THREE.Vector3() }));
    const CASES = 12, cases = new THREE.InstancedMesh(box(0.14, 0.14, 0.5), M.brass, CASES); cases.visible = false; cases.frustumCulled = false; group.add(cases);
    const casing = Array.from({ length: CASES }, () => ({ t: 9, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0 }));
    const rng = U.rng(53);
    const mt = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(), mv = new THREE.Vector3(), eul = new THREE.Euler();
    const tmp = new THREE.Vector3(), fq = new THREE.Quaternion(), gq = new THREE.Quaternion();
    const toGroup = (obj) => { group.updateMatrixWorld(true); obj.getWorldPosition(tmp); group.worldToLocal(tmp); obj.getWorldQuaternion(fq); group.getWorldQuaternion(gq); fq.premultiply(gq.invert()); };
    // ── 発射演出のリアル版(setFxStyle("real") で切替): 12.7mm 重機関銃の連射(約 10 発/秒)。1 発ごとに小さな閃光と火球、薄い煙、3 発に 1 発の曳光弾 ──
    const realFx = U.muzzleFx(THREE, group, { ground: 0.3, seed: 59,
      flash: { pool: 2, len: 0.035, size: [1.6, 3.0], tongue: { len: [3, 5], width: [1.0, 1.5], side: 0 } }, light: { len: 0.04, power: 12000, z: 2 },
      balls: { per: 2, pool: 8, len: 0.08, size: 1.1, speed: 30, length: 2.4 },
      smoke: { per: 1, pool: 24, len: [1.0, 1.8], speed: 7, spread: 0.6, drag: 1.6, rise: 2, size: [0.6, 1.0], grow: [2.5, 5], peak: 0.28, ahead: [0.5, 1.5] },
      tracers: { pool: 12, speed: 380, len: 1.2, drop: 8 } });
    let fxStyle = opts.fxStyle ?? "stylized", shotN = 0;

    // ── 動き ──
    const BURST = 0.9, SHOT_DT = 0.1, PUFF_LEN = 0.9, CASE_LEN = 0.6, WHEEL_SPEED = 4.0;
    let moving = false, wantMast = false, traverse = false, clock = 0, scan = 0, yaw = 0, headYaw = 0, ext = 0, wheelRot = 0;
    let burst = 0, nextShot = 0, flashT = 0, recoil = 0;
    let baked = null;
    const ease = (u) => u * u * (3 - 2 * u);
    function layMast() {
      const k = ease(ext);
      tubes.forEach((g, i) => (g.position.y = MAST.base - 0.05 + k * (i + 1) * MAST.stage));
      head.position.y = MAST.base + k * tubes.length * MAST.stage; head.rotation.y = headYaw;
    }
    function update(dt) {
      clock += dt;
      // マスト: 停車中だけ伸ばす。下ろすときは頭部を正面へ戻してから縮める。走り出すのは下ろしきってから
      if (wantMast && !moving) {
        ext = Math.min(1, ext + dt / MAST.time);
        if (ext >= 1) { scan += dt; headYaw += (0.9 * Math.sin(scan * 0.35) - headYaw) * Math.min(1, dt * 1.5); }
      } else {
        scan = 0;
        if (Math.abs(headYaw) > 0.005) headYaw -= Math.sign(headYaw) * Math.min(Math.abs(headYaw), dt * 0.8);
        else { headYaw = 0; ext = Math.max(0, ext - dt / MAST.time); }
      }
      layMast();
      const rolling = moving && ext === 0;
      if (rolling) { wheelRot += dt * WHEEL_SPEED; for (const w of wheels) w.rotation.x = wheelRot; baked?.sync(); }
      body.position.y = rolling ? 0.06 + 0.04 * Math.sin(clock * 13) + 0.03 * Math.sin(clock * 7.3) : body.position.y * 0.85;   // 0〜0.13(タイヤとの隙間 0.2 の内側)
      // 銃塔: 旋回は ±69°(後ろのマストへは向けない)
      const targetYaw = traverse ? Math.sin(clock * 0.5) * RWS.yawMax : 0;
      yaw += (targetYaw - yaw) * Math.min(1, dt * 2); rws.rotation.y = yaw;
      // 連射: 閃光は一瞬、銃身だけ短く下がる。薬莢は右へ
      if (burst > 0) { burst -= dt; nextShot -= dt; while (burst > 0 && nextShot <= 0) { nextShot += SHOT_DT; shoot(); } }
      if (flashT > 0) flashT -= dt; gunFlash.visible = flashT > 0;
      recoil = Math.max(0, recoil - dt / 0.08); const u = 1 - recoil;
      slide.position.z = recoil > 0 ? -0.35 * (u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7) : 0;
      body.rotation.x = (rolling ? 0.004 * Math.sin(clock * 5.1) : 0) + (burst > 0 ? 0.0015 * Math.sin(clock * 80) : 0);
      let anyP = false;
      puff.forEach((p, i) => {
        const live = p.t < PUFF_LEN;
        if (live) { p.t += dt; p.vel.multiplyScalar(Math.max(0, 1 - dt * 3)); p.vel.y += dt * 2.5; p.pos.addScaledVector(p.vel, dt); anyP = true; }
        const v = Math.min(1, p.t / PUFF_LEN), s = live ? (0.4 + v * 1.6) * (v < 0.7 ? 1 : (1 - v) / 0.3) : 0;
        mt.compose(p.pos, mq.identity(), ms.setScalar(Math.max(0.001, s))); puffs.setMatrixAt(i, mt);
      });
      puffs.visible = anyP; puffs.instanceMatrix.needsUpdate = true;
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
      if (fxStyle === "real") { realFx.fire(muzzle); if (shotN++ % 3 === 0) realFx.tracer(muzzle); return; }
      flashT = 0.04;
      const p = puff.find((x) => x.t >= PUFF_LEN); if (!p) return;
      toGroup(muzzle); p.pos.copy(tmp);
      p.vel.set(0, 0, 1).applyQuaternion(fq).multiplyScalar(7).add(mv.set((rng() - 0.5) * 2, rng(), (rng() - 0.5) * 2)); p.t = 0;
    }
    function fireGun() { if (burst <= 0) nextShot = 0; burst = BURST; }

    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "stealth";
    function applyPaint() {
      const tc = teamColor.clone();
      if (paint === "stealth") { M.hull.color.set(C.graphite); M.hull2.color.set(C.graphite2); M.deck.color.set(0x343d46); M.strip.color.copy(tc); M.edge.color.set(0x0b1015); }
      else if (paint === "team") { M.hull.color.copy(tc); M.hull2.color.copy(tc).multiplyScalar(0.78); M.deck.color.copy(tc).multiplyScalar(0.7); M.strip.color.set(0xffffff); M.edge.color.set(C.edge); }
      else { M.hull.color.set(C.white); M.hull2.color.set(C.light); M.deck.color.set(0xcfd6dd); M.strip.color.copy(tc); M.edge.color.set(0x3b4752); }
      M.ring.color.copy(tc); M.glow.color.copy(tc);
    }
    function fitPlate() {   // 原点から見た車体・銃塔のいちばん遠い点を囲む(車輪は車体の幅の内側)
      const inner = U.reach(THREE, group, body) + 1.5, outer = inner + 3;
      flat(new THREE.RingGeometry(inner, outer, 64), M.ring, 0.25);
      flat(new THREE.CircleGeometry(inner - 0.4, 64), M.glow, 0.2);
      flat(new THREE.PlaneGeometry(6.5, 6.5), M.sign, 0.35, outer + 3.6);
      return outer;
    }
    const plateRadius = fitPlate();
    applyPaint();
    // 隙間の確認値(すべて正なら貫通なし)
    const check = () => {
      const tireTop = W.y + W.r + W.lug / 2, tireReach = W.r + W.lug / 2, BOB = 0.13;
      const hd = Math.hypot(MAST.head.w / 2 + 0.05, MAST.head.d / 2 + 0.2);          // 頭部の掃引半径(日よけ・配線箱の角)
      const rwsSweep = Math.max(Math.hypot(0.95, 2.2 + 0.7), Math.hypot(1.78 + 0.55, 0.4 + 0.8), Math.hypot(1.4, 1.4));   // 締め帯・照準センサー・旋回台の角
      const mz = { x: Math.sin(RWS.yawMax) * (MZ + 0.2 + 0.3), z: RWS.z + Math.cos(RWS.yawMax) * (MZ + 0.5) };   // 最大旋回の消炎器の先
      const headRaised = MAST.base + tubes.length * MAST.stage + 0.1;
      return {
        tireToBody: +(5.9 - tireTop - BOB).toFixed(2),                                               // タイヤの溝の上端と上部車体の下面(揺れの最大で)
        tireToLowerHull: +((W.x - (W.w + 0.1) / 2) - 4.4).toFixed(2),                               // タイヤの内側と下部車体
        tireToLocker: +(Math.min(W.axles[0] - 5.0, -5.2 - W.axles[1]) - tireReach).toFixed(2),     // 前後輪と雑具箱
        stowedHeadToClamps: +((1.95 - 0.2) - MAST.head.w / 2).toFixed(2),                           // 収納時の頭部と左右の受け
        headToClampsWhenPanning: +((headRaised) - (ROOF + 1.5)).toFixed(2),                         // 走査は伸び切ってから(頭部の下端と受けの上端)
        mastTubeOverlap: +(MAST.len - MAST.stage).toFixed(2),                                        // 伸び切ったときの段の重なり
        stowedTubesInsideHousing: +(MAST.base - MAST.len - 2.3).toFixed(2),                          // 縮めた柱の下端と車体の底(車体の中に隠れる)
        headSweepToAntenna: +(Math.hypot(ANT.x, ANT.z - MAST.z) - hd - 0.35).toFixed(2),
        rwsSweepToMastHousing: +((RWS.z - (MAST.z + 1.5)) - rwsSweep).toFixed(2),
        rwsSweepToSmokeLauncher: +(Math.hypot(4.1 - 0.8, 3.4 - 0.7 - RWS.z) - rwsSweep).toFixed(2),   // 発煙弾の台のいちばん近い角
        muzzleAtMaxYawToMirror: +(Math.hypot(8.35 - mz.x, 8.6 - mz.z) - 0.6).toFixed(2),            // 最大旋回の銃口とミラー(高さも銃口の方が 3 以上高い)
        cradleToAmmoBox: +((0.2 + 0.3 - 1.8) - (-2.2 + 0.7)).toFixed(2),                            // 揺架の後端と弾薬箱
        gunAboveWindscreen: +((RWS.y + 1.9 - 0.4) - ROOF).toFixed(2),                                // 揺架の下面と風防の上端(屋根の高さ)
      };
    };
    baked = U.bake(THREE, group, { dynamic: [body, rws, slide, head, ...tubes], live: [M.hull, M.hull2, M.deck, M.strip], also: [M.strip], instanced: [{ groups: wheels, staticEdges: true }] });
    return {
      plateRadius, group, update, fireGun, check, setFxStyle: (st) => (fxStyle = st === "real" ? "real" : "stylized"), get fxStyle() { return fxStyle; },
      setTeam: (c) => { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }, setPaint: (p) => { paint = p; applyPaint(); },
      stats: () => U.stats(group), parts: { rws, head, plate },
      setMoving: (b) => (moving = b), setMast: (b) => (wantMast = b), setTraverse: (b) => (traverse = b),
      get moving() { return moving; }, get rolling() { return moving && ext === 0; }, get mast() { return wantMast; }, get mastExt() { return ext; }, get traverse() { return traverse; }, get paint() { return paint; },
      get firing() { return burst > 0; }, get observing() { return ext >= 1; },
    };
  }

  (window.DreamAssets ??= {}).scout = scout;
})();
