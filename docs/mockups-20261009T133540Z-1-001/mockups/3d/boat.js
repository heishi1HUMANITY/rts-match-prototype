// 部隊トークン「哨戒艇」(試作)。装甲強襲・攻撃ヘリ・自走砲と同じ家族: 大きな平面の近未来ステルス寄り、光る線はチーム色の継ぎ目だけ、センサーは暗いガラス。
// 下敷きはヴィスビュー級・スクヨル級のステルス高速艇(v2 のもがみ型は「不格好」のユーザー指摘で v3 でこちらへ戻した)。
//   船体: 細長く低い(全長 約53、幅 約9.4、乾舷 約2.3)。喫水線の少し上の折れ目から上へ内側に倒れ、鋭く前へ傾いた船首、平らな船尾板に噴射推進の噴射口 2。
//   上部構造: 船体と 1 つの断面の連なりで作る低い楔(側面は船体と同じ面で継ぎ目がない)。後ろは甲板へ緩く下る斜面、前は急な斜面の艦橋(横長の暗いガラスの窓)。
//     屋根の上は低い菱形断面の統合マスト(角錐台に尖った頂、暗いガラスのアンテナの帯)と電子光学センサーの箱だけ。煙突・鞭型アンテナ・係留柱・飛行甲板は無し(排気は船尾、係留柱は甲板のふたの下)。
//   武装: 前甲板の多面体の小さな覆い(ステルス砲塔、幅は船幅の 1/4)に単装の中口径砲 1 門。後甲板にミサイル発射機の平らなハッチ 4(閉)。
//   動き: 停泊中はゆっくり揺れる。航行で船首が上がり船尾が沈み、船首波と航跡が出る。砲塔の旋回、射撃(閃光・煙・後座)。
//
//   const a = DreamAssets.boat(THREE);
//   scene.add(a.group); a.setTeam(0xff6a1a); a.setPaint("stealth" | "team" | "white"); a.setMoving(true); a.fire(); a.update(dt)
//
// 前方 = +z、上 = +y。ゲームの部隊表示倍率 2.0、川の水面 y = 3(一覧 8.5)を前提にした寸法。喫水線は船体の y 0。
(function () {
  const C = { graphite: 0x2c343c, graphite2: 0x3a434c, white: 0xf2f4f6, light: 0xdfe4e9, dark: 0x262e36, edge: 0x141b21 };
  const WATER_Y = 3;

  function boat(THREE, opts = {}) {
    const U = DreamAssets.util;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      hull: lambert(C.graphite), hull2: lambert(C.graphite2), deck: lambert(0x343d46),
      dark: lambert(C.dark), light: lambert(C.light), glass: lambert(0x18242e),
      strip: basic(0xff6a1a),
      navL: basic(0xff2a2a), navR: basic(0x2aff6a), navW: basic(0xffffff),   // 航海灯(左舷赤・右舷緑・マスト灯白、常灯)
      water: U.waterMaterial(THREE, { repeat: [120 / U.WATER_TILE[0], 70 / U.WATER_TILE[1]] }),
      foam: basic(0xffffff, { transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }),
      flame: basic(0xffb347, { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      flashCore: basic(0xfff3d0, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
      smoke: basic(0x8a9097, { transparent: true, opacity: 0.4, depthWrite: false }),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.55 }),
      ring: basic(0xff6a1a, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      glow: basic(0xff6a1a, { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      sign: new THREE.MeshBasicMaterial({ map: U.signTexture(THREE, "艇"), transparent: true }),
    };
    const group = new THREE.Group(); group.name = "boat";
    const float = new THREE.Group(); float.position.y = WATER_Y; group.add(float);   // 浮いている高さ(上下の揺れ)
    const hull = new THREE.Group(); float.add(hull);                                  // 縦揺れ・横揺れ
    const addU = U.adder(THREE, M.edge, 15);
    const add = (geo, mat, { parent = hull, ...o } = {}) => addU(geo, mat, parent, o);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h, n = 10) => new THREE.CylinderGeometry(r, r, h, n);
    const cylZ = (r, h, n = 12) => { const g = cyl(r, h, n); g.rotateX(Math.PI / 2); return g; };

    // ── 水面(確認用。川と同じ水)とベースプレート(水面に浮かべる) ──
    const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 70).rotateX(-Math.PI / 2).rotateY(Math.PI / 2), M.water); water.position.y = WATER_Y; group.add(water);
    const plate = new THREE.Group(); plate.position.y = WATER_Y; group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };

    // ── 船体と上部構造(ステルス高速艇): 1 つの断面の連なりで作る。上部構造の側面は船体の側面と同じ面で、継ぎ目がない ──
    // 断面の半分 = [竜骨, 喫水線の上の折れ目(チャイン), 甲板の縁, 屋根の縁]。上部構造のない所では屋根の縁 = 甲板の縁(甲板が平らに閉じる)。
    // 上部構造のある所では、屋根の縁を船体の側面(チャイン → 甲板の縁)の延長線上に置く。屋根の高さは後ろの緩い斜面 → 平ら → 前の急な斜面(艦橋)
    const lerpTab = (tab, z) => { for (let i = 0; i < tab.length - 1; i++) { const [z0, v0] = tab[i], [z1, v1] = tab[i + 1]; if (z <= z1) return v0 + (v1 - v0) * Math.max(0, (z - z0) / (z1 - z0)); } return tab[tab.length - 1][1]; };
    const BASE = [   // z, 竜骨, チャイン, 甲板の縁(乾舷は低め、幅は細め)
      [-25.0, [1.2, -1.5], [4.5, 0.3], [4.0, 2.3]],
      [-10.0, [0.8, -2.0], [4.7, 0.2], [4.2, 2.3]],
      [5.0, [0.6, -2.0], [4.6, 0.2], [4.1, 2.4]],
      [14.0, [0.4, -1.7], [4.0, 0.3], [3.6, 2.6]],
      [22.0, [0.2, -0.9], [2.3, 0.8], [2.1, 3.0]],
      [27.0, [0.05, 0.9], [0.5, 1.9], [0.45, 3.3]],
      [28.2, [0.03, 2.2], [0.12, 2.7], [0.08, 3.4]],   // 前へ傾いた船首の先
    ];
    const baseAt = (z) => [1, 2, 3].map((k) => [0, 1].map((c) => lerpTab(BASE.map((b) => [b[0], b[k][c]]), z)));
    const deckY = (z) => baseAt(z)[2][1], deckX = (z) => baseAt(z)[2][0];
    const hullSlope = (z) => { const [, ch, dk] = baseAt(z); return (ch[0] - dk[0]) / (dk[1] - ch[1]); };   // 側面の x の減り / y の増え
    const sideX = (z, y) => deckX(z) - hullSlope(z) * (y - deckY(z));                                      // 船体・上部構造の側面の x
    const sideTilt = (z) => Math.atan(hullSlope(z));
    const SUP = { z0: -14.5, z1: -9.5, z2: 2.5, z3: 4.6, roof: 5.1 };   // 後ろの斜面の足、屋根の後端、屋根の前端(艦橋の上端)、艦橋の前面の足、屋根の高さ
    const roofY = (z) => lerpTab([[SUP.z0, deckY(SUP.z0)], [SUP.z1, SUP.roof], [SUP.z2, SUP.roof], [SUP.z3, deckY(SUP.z3)]], z);
    const STATIONS = [[-25, null], [SUP.z0, null], [SUP.z1, SUP.roof], [-3, SUP.roof], [SUP.z2, SUP.roof], [SUP.z3, null], [14, null], [22, null], [27, null], [28.2, null]];
    const SECS = STATIONS.map(([z, ry]) => { const [kl, ch, dk] = baseAt(z); const rf = ry == null ? dk : [sideX(z, ry), ry]; return { z, pts: U.sym([kl, ch, dk, rf]) }; });
    add(U.loft(THREE, SECS), M.hull);
    U.edgeStrip(THREE, M.strip, SECS, 2, 0, SECS.length - 2, hull); U.edgeStrip(THREE, M.strip, SECS, 5, 0, SECS.length - 2, hull);   // 喫水線の上の折れ目(チーム色)
    U.edgeStrip(THREE, M.strip, SECS, 0, 1, 5, hull, { w: 0.12, h: 0.14 }); U.edgeStrip(THREE, M.strip, SECS, 7, 1, 5, hull, { w: 0.12, h: 0.14 });   // 上部構造の屋根の縁(斜面 → 平ら → 艦橋)
    const deckRX = (z) => { const d = 0.5; return -Math.atan((deckY(z + d) - deckY(z - d)) / (2 * d)); };
    const onDeck = (geo, mat, x, z, h, o = {}) => add(geo, mat, { x, z, y: deckY(z) + h / 2 - 0.05, rx: deckRX(z), ...o });
    // 斜面(後ろの屋根・艦橋の前面)の上に置く: 斜面の点と外向きの法線
    const slopeAt = (za, ya, zb, yb, t) => { const d = [zb - za, yb - ya], L = Math.hypot(...d), n = [-d[1] / L, d[0] / L]; return { z: za + d[0] * t, y: ya + d[1] * t, nz: n[0], ny: n[1], rx: Math.atan2(-d[0], -d[1]) }; };

    // 甲板の装備(出っ張りを減らす): 係留柱のふた(平らな暗い板)、前甲板のハッチ、錨の凹み、後甲板のミサイル発射機のハッチ 4、船尾板の噴射口 2
    const coverG = U.merge(THREE, [-23.0, 9.0, 19.0].flatMap((z) => [-1, 1].map((sx) => [box(1.0, 0.06, 1.0), { x: sx * (deckX(z) - 0.9), y: deckY(z) + 0.01, z, rx: deckRX(z) }])));
    add(coverG, M.dark, { edges: false });
    onDeck(box(2.2, 0.14, 1.8), M.hull2, 0, 9.5, 0.14);
    for (const sx of [-1, 1]) {
      const az = 23.5, ax = sideX(az, 2.6) + 0.02;
      add(box(0.12, 0.9, 1.3), M.dark, { x: sx * ax, y: 2.6, z: az, ry: sx * Math.atan((2.1 - 0.45) / 5), edges: false });   // 錨の凹み
      for (const hz of [-17.0, -20.6]) onDeck(box(2.6, 0.1, 3.0), M.dark, sx * 1.9, hz, 0.1);                                 // ミサイル発射機のハッチ(閉)
      add(box(1.8, 0.9, 0.3), M.dark, { x: sx * 2.3, y: 0.1, z: -25.1, edges: false });                                      // 噴射推進の噴射口
    }
    onDeck(box(5.4, 0.06, 0.12), M.hull2, 0, -18.8, 0.06);   // ハッチの間の継ぎ目

    // ── 上部構造の細部 ──
    // 艦橋の窓: 前の急な斜面に横長の暗いガラスの帯(上寄り)。側窓は小さく
    { const p = slopeAt(SUP.z2, SUP.roof, SUP.z3, deckY(SUP.z3), 0.22);
      add(box(2 * sideX(p.z, p.y) - 1.2, 0.7, 0.12), M.glass, { z: p.z + p.nz * 0.07, y: p.y + p.ny * 0.07, rx: p.rx, edges: false }); }
    for (const sx of [-1, 1]) {
      add(box(0.12, 0.45, 1.8), M.glass, { x: sx * (sideX(1.2, 4.6) + 0.05), y: 4.6, z: 1.2, rz: sx * sideTilt(1.2), edges: false });   // 艦橋の側窓
      add(box(0.24, 0.24, 0.4), sx < 0 ? M.navL : M.navR, { x: sx * (sideX(2.6, 4.1) + 0.12), y: 4.1, z: 2.6, edges: false });        // 舷灯
      add(box(0.06, 1.8, 0.9), M.hull2, { x: sx * (sideX(-6.0, 3.3) + 0.03), y: 3.3, z: -6.0, rz: sx * sideTilt(-6.0), edges: false });   // 扉(面からわずかに出た同系色の板)
    }
    // 統合マスト(低く鋭く): 菱形の断面(角が前後左右)の角錐台に尖った頂。暗いガラスのアンテナの帯 1
    const MAST = { z: -3.0, base: SUP.roof - 0.1, h: 2.4, r0: 1.5, r1: 0.6, cap: 1.1 };
    const mastR = (y) => MAST.r0 + (MAST.r1 - MAST.r0) * y / MAST.h;
    add(new THREE.CylinderGeometry(MAST.r1, MAST.r0, MAST.h, 4), M.hull, { y: MAST.base + MAST.h / 2, z: MAST.z });
    add(new THREE.ConeGeometry(MAST.r1, MAST.cap, 4), M.hull, { y: MAST.base + MAST.h + MAST.cap / 2, z: MAST.z });
    { const y0 = 1.2, y1 = 1.8; add(new THREE.CylinderGeometry(mastR(y1) + 0.04, mastR(y0) + 0.04, y1 - y0, 4), M.glass, { y: MAST.base + (y0 + y1) / 2, z: MAST.z, edges: false }); }
    add(box(0.2, 0.3, 0.2), M.navW, { y: MAST.base + MAST.h + MAST.cap + 0.12, z: MAST.z, edges: false });   // マスト灯
    // 電子光学センサー: 艦橋の上の低い台に暗いガラスの多面体の箱(光らない)
    const EO = { z: 0.6, w: 0.9 };
    add(box(1.1, 0.3, 1.1), M.dark, { y: SUP.roof + 0.1, z: EO.z });
    add(new THREE.CylinderGeometry(EO.w * 0.55, EO.w * 0.7, 0.7, 6), M.glass, { y: SUP.roof + 0.6, z: EO.z });
    // 後ろの斜面の排気グリル(船尾へ抜く前の低い開口。上部構造と同じ色の横線 3)
    { const L = Math.hypot(SUP.z0 - SUP.z1, deckY(SUP.z0) - SUP.roof), dz = (SUP.z0 - SUP.z1) / L, dy = (deckY(SUP.z0) - SUP.roof) / L;
      for (let k = 0; k < 3; k++) { const p = slopeAt(SUP.z1, SUP.roof, SUP.z0, deckY(SUP.z0), 0.3 + k * 0.32 / L); add(box(2.6, 0.06, 0.1), M.hull2, { z: p.z + p.nz * 0.05, y: p.y + p.ny * 0.05, rx: p.rx, edges: false }); } }

    // ── 船首の砲塔(ステルス砲塔): 前甲板の多面体の覆いに単装の中口径砲。実艦の比率(57mm 砲の覆いは船幅の 3 割弱、全長 73m に対し約 4m)に合わせて小さく。砲身は後座する ──
    const TURRET_Z = 14.0, TUR = { hw: 1.15, len: 1.5 };
    const turret = new THREE.Group(); turret.position.set(0, deckY(TURRET_Z) - 0.05, TURRET_Z); hull.add(turret);
    add(cyl(1.25, 0.2, 12), M.dark, { parent: turret, y: 0.1 });                                                        // 旋回台
    add(U.loft(THREE, [
      { z: -1.5, pts: U.sym([[1.15, 0.15], [1.0, 1.0], [0.55, 1.9]]) },
      { z: 0.4, pts: U.sym([[1.15, 0.15], [1.05, 1.1], [0.6, 2.0]]) },
      { z: 1.6, pts: U.sym([[0.7, 0.2], [0.6, 0.8], [0.35, 1.35]]) },
    ]), M.hull, { parent: turret });
    const gun = new THREE.Group(); gun.position.set(0, 1.05, 1.3); turret.add(gun);
    const slide = new THREE.Group(); gun.add(slide);
    add(cylZ(0.15, 3.8, 10), M.dark, { parent: slide, z: 1.9, edges: false });
    add(cylZ(0.26, 0.7, 10), M.hull2, { parent: slide, z: 0.35 });
    add(cylZ(0.19, 0.3, 10), M.dark, { parent: slide, z: 3.65, edges: false });
    const MUZZLE_Z = 3.9;
    const flash = U.flashAt(THREE, addU, M.flame, M.flashCore, slide, MUZZLE_Z, 0.45);
    const muzzle = new THREE.Object3D(); muzzle.position.z = MUZZLE_Z; slide.add(muzzle);

    // ── 航跡と船首波(水面に置き、船の揺れに引きずられない) ──
    const wake = new THREE.Group(); wake.position.y = WATER_Y + 0.32; group.add(wake);   // ベースプレート(+0.25)より上に置き、プレートの色に沈ませない
    const foamStrip = (w, l, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), M.foam); m.position.set(x, 0, z); m.rotation.y = ry; wake.add(m); return m; };
    foamStrip(6.5, 20, 0, -35, 0);                                 // 噴射口の後ろの白い泡(噴射推進で太く長い)
    for (const sx of [-1, 1]) { foamStrip(1.3, 28, sx * 6.5, -37, -sx * 0.2); foamStrip(1.1, 12, sx * 3.8, 18, -sx * 0.4); }   // 航跡の縁、船首波(どちらも後ろへ開く V 字)
    wake.visible = false;
    // 射撃の煙(撃った場所に残る)
    const PUFFS = 6, puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.smoke, PUFFS); puffs.visible = false; group.add(puffs);
    const puffDir = (() => { const r = U.rng(31); return Array.from({ length: PUFFS }, () => new THREE.Vector3((r() - 0.5) * 4, 1 + r() * 2, 4 + r() * 6)); })();
    const puffOrigin = new THREE.Vector3(), puffQ = new THREE.Quaternion();
    // ── 発射演出のリアル版(2026-10-16。setFxStyle("real") で切替): 57mm 級の艦砲。閃光と火球、灰白の煙、砲口の爆風が水面を叩く白い飛沫(砂塵の粒を白くして水面に置く) ──
    const realFx = U.muzzleFx(THREE, group, { ground: WATER_Y + 0.3, seed: 41,
      flash: { len: 0.07, size: [5, 13], tongue: { len: [9, 14], width: [3, 4.5], side: 0 } }, light: { len: 0.12, power: 90000, z: 3 },
      balls: { per: 8, len: 0.28, size: 4.5, speed: 50, length: 8 },
      smoke: { per: 20, len: [2.2, 3.6], speed: 22, spread: 0.6, drag: 1.5, rise: 2.5, size: [2.5, 4], grow: [12, 20], peak: 0.45, cols: [0xd9cbb6, 0xaab1b8, 0xd3d7db] },
      wisps: { per: 4, len: [1.2, 2] }, dust: { per: 16, len: [1.0, 1.8], speed: 16, drag: 2.2, size: [2.5, 4], grow: 12, peak: 0.6, ahead: 6, angle: 0.9, vy: [5, 11], color: 0xe4ecf0, thin: 0xf2f6f8 } });
    let fxStyle = opts.fxStyle ?? "stylized";

    // ── ベースプレート: 船体の最遠点を囲む ──
    const far = U.reach(THREE, group, hull);
    const inner = far + 1.5, outer = inner + 3;
    flat(new THREE.RingGeometry(inner, outer, 64), M.ring, 0.25);
    flat(new THREE.CircleGeometry(inner - 0.4, 64), M.glow, 0.2);
    flat(new THREE.PlaneGeometry(6.5, 6.5), M.sign, 0.35, outer + 3.6);

    // ── 動き ──
    let moving = false, traverse = false, clock = 0, speed = 0, yaw = 0, recoil = 0, flashT = 0, puffT = 9;
    const mt = new THREE.Matrix4(), ms = new THREE.Vector3(), mv = new THREE.Vector3(), gq = new THREE.Quaternion();
    function update(dt) {
      clock += dt;
      speed += ((moving ? 1 : 0) - speed) * Math.min(1, dt * 0.8);
      // 停泊中はゆっくり揺れ、航行中は船首が上がり船尾が沈んで(滑走)、揺れが短くなる
      float.position.y = WATER_Y - 0.1 * speed + Math.sin(clock * 1.1) * 0.12 * (1 - 0.5 * speed);
      hull.rotation.x = -0.05 * speed + Math.sin(clock * 0.9) * 0.008;
      hull.rotation.z = Math.sin(clock * 0.7) * 0.02 * (1 - 0.6 * speed);
      M.water.map.offset.y += dt * (0.03 + 0.6 * speed);   // 船に対して水が後ろへ流れる
      wake.visible = speed > 0.05; M.foam.opacity = 0.9 * speed * (0.88 + 0.12 * Math.sin(clock * 8));
      // 砲塔の旋回
      const target = traverse ? Math.sin(clock * 0.6) * 1.2 : 0;
      yaw += (target - yaw) * Math.min(1, dt * 2); turret.rotation.y = yaw;
      // 射撃: 閃光(0.08 秒)、後座、煙
      if (flashT > 0) { flashT -= dt; flash.visible = flashT > 0; }
      if (recoil > 0) { recoil = Math.max(0, recoil - dt * 3); slide.position.z = -0.4 * Math.sin(recoil * Math.PI * 0.5); }
      if (puffT < 1.4) {
        puffT += dt; puffs.visible = true; const u = puffT / 1.4; M.smoke.opacity = 0.4 * (1 - u);
        puffDir.forEach((d, i) => { mv.copy(d).multiplyScalar(puffT).applyQuaternion(puffQ).add(puffOrigin); mt.compose(mv, gq.identity(), ms.setScalar(0.5 + puffT * 1.8 + i * 0.08)); puffs.setMatrixAt(i, mt); });
        puffs.instanceMatrix.needsUpdate = true;
      } else puffs.visible = false;
      realFx.update(dt);
    }
    function fire() {
      if (recoil > 0) return;
      recoil = 1; group.updateMatrixWorld(true);
      if (fxStyle === "real") { realFx.fire(muzzle); return; }
      flashT = 0.08; flash.visible = true; puffT = 0;
      muzzle.getWorldPosition(puffOrigin); group.worldToLocal(puffOrigin);
      muzzle.getWorldQuaternion(puffQ); group.getWorldQuaternion(gq); puffQ.premultiply(gq.invert());
    }
    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "stealth";
    function applyPaint() {
      const tc = teamColor.clone();
      if (paint === "stealth") { M.hull.color.set(C.graphite); M.hull2.color.set(C.graphite2); M.deck.color.set(0x343d46); M.strip.color.copy(tc); M.edge.color.set(0x0b1015); }
      else if (paint === "team") { M.hull.color.copy(tc); M.hull2.color.copy(tc).multiplyScalar(0.78); M.deck.color.copy(tc).multiplyScalar(0.7); M.strip.color.set(0xffffff); M.edge.color.set(C.edge); }
      else { M.hull.color.set(C.white); M.hull2.color.set(C.light); M.deck.color.set(0xcfd6dd); M.strip.color.copy(tc); M.edge.color.set(0x3b4752); }
      M.ring.color.copy(tc); M.glow.color.copy(tc);
    }
    applyPaint();
    // 隙間の確認値(すべて正なら貫通なし)
    const check = () => {
      const barrelBottom = turret.position.y + 1.05 - 0.19;   // 砲口の締め具(半径 0.19)の下面
      const sweep = Math.hypot(TUR.len, TUR.hw);               // 砲塔の覆いの掃引半径
      return {
        barrelOverBowDeck: +(barrelBottom - deckY(TURRET_Z + 1.3 + MUZZLE_Z)).toFixed(2),               // 砲口の真下の甲板
        turretSweepToBridge: +((TURRET_Z - sweep) - SUP.z3).toFixed(2),                                 // 砲塔の掃引半径と艦橋の前面の足
        turretToDeckEdge: +(deckX(TURRET_Z) - TUR.hw).toFixed(2),                                       // 砲塔の覆いの幅と甲板の幅
        mastInRoof: +(sideX(MAST.z, SUP.roof) - MAST.r0).toFixed(2),                                    // マストの根元(菱形の角)と屋根の縁
        eoInRoof: +(sideX(EO.z, SUP.roof) - 0.55).toFixed(2),                                           // センサーの台と屋根の縁
        eoToBridgeTop: +(SUP.z2 - (EO.z + 0.55)).toFixed(2),                                            // センサーの台と屋根の前端(z)
        hatchToDeckEdge: +(deckX(-20.6) - (1.9 + 1.3)).toFixed(2),                                      // ミサイルのハッチと甲板の縁
        hatchToSlopeFoot: +(SUP.z0 - (-17.0 + 1.5)).toFixed(2),                                         // 前のハッチと後ろの斜面の足(z)
        superstructureHeight: +(SUP.roof - deckY(0)).toFixed(2),                                        // 甲板からの屋根の高さ(参考)
        lengthBeam: [53.2, +(2 * 4.7).toFixed(1)],                                                      // 全長・幅(参考)
        keelBelowWater: 2.0,                                                                            // 喫水(参考)
      };
    };
    U.bake(THREE, group, { dynamic: [float, hull, turret, gun, slide], live: [M.hull, M.hull2, M.deck, M.strip], also: [M.strip, M.navL, M.navR, M.navW] });
    return {
      plateRadius: outer, group, update, fire, check, setFxStyle: (st) => (fxStyle = st === "real" ? "real" : "stylized"), get fxStyle() { return fxStyle; },
      setTeam: (c) => { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }, setPaint: (p) => { paint = p; applyPaint(); },
      stats: () => U.stats(group), parts: { plate, turret, water },
      setMoving: (b) => (moving = b), setTraverse: (b) => (traverse = b),
      get moving() { return moving; }, get traverse() { return traverse; }, get paint() { return paint; },
    };
  }

  (window.DreamAssets ??= {}).boat = boat;
})();
