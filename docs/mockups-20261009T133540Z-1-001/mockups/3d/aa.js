// 部隊トークン「対空車両」(試作)。装甲強襲 v3・自走砲と同じ家族: 共通の装軌車体(chassis.js)に、4 連装機関砲の砲塔を載せた自走対空砲。
// 下敷きは ZSU-23-4 シルカ。幅の広い低い箱形の砲塔の前面いっぱいに防盾を置き、6 門(左右の揺架に 3 門ずつ、正面から見て ◀ ▶ の三角形)を集める。
// 外観は同じ近未来ステルス寄り(大きな平面、光る継ぎ目はチーム色の細い線だけ、センサーは暗いガラス、レーダーは回さない箱形の固定パネル)。
//   車体: 自走砲と同じ(機関室は前、操縦手は左前。サイドスカート、泥よけ、前照灯、後面に予備履帯と牽引具)。
//   砲塔: 前面は防盾と両端の覆い、屋根の前に追尾レーダーの箱、中ほどに車長・砲手のハッチと電子光学センサー、後ろに捜索レーダーの角錐台(回さない)とアンテナ、
//     側面に雑具箱と発煙弾発射機、後面に雑具箱。
//   動き: 走行(履帯・転輪)、砲塔旋回、対空姿勢(防盾ごと 6 門が 45° まで上がる)。
//   射撃: 6 門が左右交互に連射(砲口の閃光、砲身だけの短い後座、薄い煙、車体の細かい震え)。
//   ミサイルは外した(部品は common.js の U.missile に残してある)。
//
//   const a = DreamAssets.aa(THREE);
//   scene.add(a.group); a.setTeam(0xff6a1a); a.setPaint("stealth" | "team" | "white"); a.setEngaged(true); a.fireGun(); a.update(dt)
//
// 前方 = +z、上 = +y。ゲームの部隊表示倍率 2.0 を前提にした寸法(車体は装甲強襲・自走砲と同じ)。
(function () {
  const C = { graphite: 0x2c343c, graphite2: 0x3a434c, white: 0xf2f4f6, light: 0xdfe4e9, dark: 0x262e36, track: 0x30383f, link: 0x4a535c, edge: 0x141b21 };

  function aa(THREE, opts = {}) {
    const U = DreamAssets.util;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      hull: lambert(C.graphite), hull2: lambert(C.graphite2), deck: lambert(C.graphite2),
      dark: lambert(C.dark), light: lambert(C.light), link: lambert(C.link), linkDark: lambert(C.track), glass: lambert(0x18242e),
      strip: basic(0xff6a1a),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.55 }),
      ring: basic(0xff6a1a, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      glow: basic(0xff6a1a, { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      sign: new THREE.MeshBasicMaterial({ map: U.signTexture(THREE, "空"), transparent: true }),
      flame: basic(0xffb347, { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      flashCore: basic(0xfff3d0, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
      smoke: basic(0x7d838a, { transparent: true, opacity: 0.3, depthWrite: false }),          // 機関砲の薄い煙
    };
    const group = new THREE.Group(); group.name = "aa";
    const body = new THREE.Group(); group.add(body);
    const addU = U.adder(THREE, M.edge, 15);
    const add = (geo, mat, { parent = body, ...o } = {}) => addU(geo, mat, parent, o);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h, n = 10) => new THREE.CylinderGeometry(r, r, h, n);
    const cylZ = (r, h, n = 12) => { const g = cyl(r, h, n); g.rotateX(Math.PI / 2); return g; };
    const edgeStrip = (secs, idx, from, to, parent) => U.edgeStrip(THREE, M.strip, secs, idx, from, to, parent);

    // ── 足元: ベースプレート(大きさは最後に fitPlate で決める) ──
    const plate = new THREE.Group(); group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };

    // ── 足回り(共通)と上部車体(自走砲と同じ) ──
    const ch = DreamAssets.chassis(THREE, { U, add, box, M, body, rearZ: -16.6, frontZ: 15.3, lowerHull: [-16.4, 19.0] });
    const HULL = [
      { z: -19.6, pts: U.sym([[10.4, 4.3], [10.9, 5.0], [6.6, 6.5]]) },
      { z: -17.4, pts: U.sym([[12.2, 3.9], [12.6, 5.0], [7.8, 7.3]]) },
      { z: 11.0, pts: U.sym([[12.2, 3.9], [12.6, 5.0], [7.8, 7.3]]) },
      { z: 16.0, pts: U.sym([[12.0, 3.9], [12.4, 5.0], [7.4, 6.8]]) },
      { z: 19.5, pts: U.sym([[11.2, 3.8], [11.6, 4.7], [5.4, 5.5]]) },
      { z: 21.5, pts: U.sym([[5.0, 4.0], [5.4, 4.5], [2.2, 4.8]]) },
    ];
    add(U.loft(THREE, HULL), M.hull);
    edgeStrip(HULL, 4, 1, 4, body); edgeStrip(HULL, 1, 1, 4, body);
    const topY = (z) => z <= 11 ? 7.3 : z <= 16 ? 7.3 - 0.5 * (z - 11) / 5 : z <= 19.5 ? 6.8 - 1.3 * (z - 16) / 3.5 : 5.5 - 0.7 * (z - 19.5) / 2;
    const topRX = (z) => z <= 11 ? 0 : z <= 16 ? Math.atan(0.5 / 5) : z <= 19.5 ? Math.atan(1.3 / 3.5) : Math.atan(0.7 / 2);
    const onTop = (geo, mat, x, z, h, o = {}) => add(geo, mat, { x, z, y: topY(z) + h / 2 - 0.08, rx: topRX(z), ...o });
    for (let k = 0; k < 4; k++) onTop(box(5.0, 0.12, 0.45), M.dark, 3.8, 11.8 + k * 1.1, 0.12, { edges: false });   // 吸気スリット
    onTop(box(1.6, 0.35, 3.0), M.dark, 6.4, 13.4, 0.35);                                                             // 排気口
    for (const z of [12.4, 13.4, 14.4]) onTop(box(1.2, 0.06, 0.12), M.light, 6.4, z, 0.4, { edges: false });
    onTop(cyl(1.4, 0.22, 8), M.hull2, -4.2, 13.6, 0.22, { ry: Math.PI / 8 });                                        // 操縦手ハッチ
    for (const x of [-5.1, -3.3]) onTop(box(1.0, 0.5, 0.5), M.glass, x, 15.4, 0.5, { edges: false });               // 潜望鏡
    const SKIRTS = [[-16.2, -10.8], [-10.4, -4.6], [-4.2, 1.6], [2.0, 7.8], [8.2, 14.6]], FLAP_Z = { rear: -19.75, front: 18.4 };
    for (const sx of [-1, 1]) {
      onTop(box(1.3, 0.55, 0.9), M.dark, sx * 4.6, 18.3, 0.55);
      onTop(box(1.0, 0.36, 0.5), M.glass, sx * 4.6, 18.3 + 0.45, 0.40, { edges: false });
      SKIRTS.forEach(([z0, z1], i) => { const t = i === SKIRTS.length - 1 ? 0.7 : 0.4; add(box(t, 1.5, z1 - z0), M.hull2, { x: sx * (ch.skirtX + t / 2), y: 3.15, z: (z0 + z1) / 2 }); });
      add(box(3.6, 2.0, 0.3), M.dark, { x: sx * ch.trackX, y: 3.2, z: FLAP_Z.rear });
      add(box(3.6, 1.9, 0.3), M.dark, { x: sx * ch.trackX, y: 2.85, z: FLAP_Z.front });
      add(box(3.2, 0.94, 0.4), M.link, { x: sx * 4.0, y: 5.6, z: -19.85 });
      add(box(0.7, 0.5, 0.6), M.dark, { x: sx * 8.2, y: 4.65, z: -19.9, edges: false });
    }

    // ── 砲塔: 幅の広い低い箱形(高さ 4.4、車体の上面より外へ張り出す)。旋回軸は z -2 ──
    const TURRET_Z = -2.0;
    const turret = new THREE.Group(); turret.position.set(0, 7.3, TURRET_Z); body.add(turret);
    const T = (geo, mat, o = {}) => add(geo, mat, { ...o, parent: o.parent ?? turret });
    const TUR = [
      { z: -9.6, pts: U.sym([[7.8, 0.4], [8.2, 1.3], [7.2, 3.8]]) },
      { z: -8.6, pts: U.sym([[8.4, 0], [8.8, 1.1], [7.6, 4.4]]) },
      { z: 4.8, pts: U.sym([[8.4, 0], [8.8, 1.1], [7.6, 4.4]]) },
      { z: 6.2, pts: U.sym([[8.0, 0.2], [8.4, 1.1], [7.0, 3.9]]) },
    ];
    T(U.loft(THREE, TUR), M.hull);
    edgeStrip(TUR, 4, 0, 3, turret); edgeStrip(TUR, 1, 0, 3, turret);
    const roofY = (z) => z <= -8.6 ? 3.8 + 0.6 * (z + 9.6) : z <= 4.8 ? 4.4 : 4.4 - 0.5 * (z - 4.8) / 1.4;
    const roofRX = (z) => z <= -8.6 ? -Math.atan(0.6) : z <= 4.8 ? 0 : Math.atan(0.5 / 1.4);
    const onRoof = (geo, mat, x, z, h, o = {}) => T(geo, mat, { x, z, y: roofY(z) + h / 2 - 0.08, rx: roofRX(z), ...o });
    // 側面の上の斜面(中央の断面)に貼る。geo の x が厚み(面の法線)、y が斜面に沿う向き。t = 斜面の下端 0 〜 上端 1、off = 面から中心までの距離
    const SIDE_LO = [8.8, 1.1], SIDE_HI = [7.6, 4.4], sd = [SIDE_HI[0] - SIDE_LO[0], SIDE_HI[1] - SIDE_LO[1]], sL = Math.hypot(...sd), sn = [sd[1] / sL, -sd[0] / sL], sAng = Math.atan2(sn[1], sn[0]);
    const sidePt = (sx, t, off) => [sx * (SIDE_LO[0] + sd[0] * t + sn[0] * off), SIDE_LO[1] + sd[1] * t + sn[1] * off];
    const onSide = (geo, mat, sx, z, t, off, o = {}) => { const [x, y] = sidePt(sx, t, off); return T(geo, mat, { x, y, z, rz: sx * sAng, ...o }); };

    // 屋根の前: 追尾レーダーの箱(前に暗いガラスの固定パネル)
    onRoof(box(4.0, 1.7, 2.4), M.hull2, 0, 2.6, 1.7);
    T(box(3.4, 1.2, 0.1), M.glass, { y: 4.4 + 0.85 - 0.08, z: 2.6 + 1.2 + 0.06, edges: false });
    onRoof(box(4.2, 0.2, 2.6), M.dark, 0, 2.6, 1.7 * 2 + 0.2 - 0.08, { edges: false });   // 箱の上の縁
    // 屋根の中ほど: 車長ハッチ(左、視察窓つき)、砲手ハッチ(右)、電子光学センサー(右前)、換気ドーム
    onRoof(cyl(1.3, 0.22, 8), M.hull2, -4.4, -2.4, 0.22, { ry: Math.PI / 8 });
    for (const a of [-0.8, -0.27, 0.27, 0.8]) onRoof(box(0.5, 0.35, 0.3), M.glass, -4.4 + 1.55 * Math.sin(a), -2.4 + 1.55 * Math.cos(a), 0.35, { ry: -a, edges: false });
    onRoof(cyl(1.15, 0.22, 8), M.hull2, 4.4, -2.4, 0.22, { ry: Math.PI / 8 });
    onRoof(box(0.3, 0.3, 1.6), M.dark, 4.4 + 1.25, -2.4, 0.3, { edges: false });          // ハッチの蝶番
    onRoof(box(1.5, 0.9, 1.6), M.hull2, 4.8, 1.6, 0.9);
    T(box(1.1, 0.5, 0.12), M.glass, { x: 4.8, y: 4.4 + 0.45, z: 1.6 + 0.8 + 0.06, edges: false });
    onRoof(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.hull2, 0, -1.6, 0.0);
    // 屋根の後ろ: 捜索レーダーの角錐台(四面に暗いガラス、回さない)とアンテナ 2 本
    const RADAR = { z: -6.0, h: 2.2, r0: 2.3, r1: 1.7 };
    onRoof(new THREE.CylinderGeometry(RADAR.r1, RADAR.r0, RADAR.h, 4), M.hull, 0, RADAR.z, RADAR.h, { ry: Math.PI / 4 });
    onRoof(new THREE.CylinderGeometry(RADAR.r1 + 0.04, RADAR.r1 + 0.04 + (RADAR.r0 - RADAR.r1) * 0.5, RADAR.h * 0.5, 4, 1, true), M.glass, 0, RADAR.z, RADAR.h * 1.5, { ry: Math.PI / 4, edges: false });   // 上下のふたなし(角錐台の上面と重なってちらつくため)
    for (const sx of [-1, 1]) {
      T(cyl(0.35, 0.5, 8), M.dark, { x: sx * 6.2, y: roofY(-7.6) + 0.22, z: -7.6 });
      T(cyl(0.08, 4.0, 6), M.dark, { x: sx * 6.2, y: roofY(-7.6) + 0.47 + 2.0 * Math.cos(-0.15), z: -7.6 + 2.0 * Math.sin(-0.15), rx: -0.15, edges: false });
    }
    // 側面: 雑具箱 2 つ(留め金つき)、手すり、前寄りに発煙弾発射機(3 連)
    for (const sx of [-1, 1]) {
      for (const [z, d] of [[-5.6, 3.6], [-1.6, 2.8]]) {
        onSide(box(1.0, 2.0, d), M.hull2, sx, z, 0.42, 0.45);
        for (const k of [-1, 1]) onSide(box(0.2, 0.36, 0.5), M.dark, sx, z + k * (d / 2 - 0.7), 0.62, 1.05, { edges: false });
      }
      onSide(box(0.16, 0.16, 9.4), M.dark, sx, -3.6, 0.9, 0.3, { edges: false });
      onSide(box(0.5, 1.4, 2.2), M.hull2, sx, 3.0, 0.42, 0.25);
      const dir = new THREE.Vector3(sx * 0.55, 0.45, 0.7).normalize(), up = new THREE.Vector3(0, 1, 0), [bx, by] = sidePt(sx, 0.42, 0.5);
      for (let k = 0; k < 3; k++) { const m = T(cylZ(0.28, 1.5, 8).rotateX(-Math.PI / 2), M.dark, { edges: false }); m.position.set(bx, by, 2.3 + k * 0.7).addScaledVector(dir, 0.6); m.quaternion.setFromUnitVectors(up, dir); }
    }
    // 後面: 雑具箱 2 つ(締め帯つき)
    for (const sx of [-1, 1]) {
      T(box(4.4, 2.2, 1.3), M.hull2, { x: sx * 3.6, y: 2.0, z: -10.2 });
      for (const k of [-1, 1]) T(box(0.24, 2.3, 1.4), M.dark, { x: sx * 3.6 + k * 1.3, y: 2.0, z: -10.2, edges: false });
    }

    // ── 6 連装機関砲: 前面いっぱいの防盾を砲耳で俯仰させ、左右の揺架に 3 門ずつ。正面から見て ◀ ▶(三角形の頂点の 1 門が外側の中段、2 門が内側の上下) ──
    const TRUNNION = { y: 2.1, z: 6.9 };   // 砲塔前面(z 6.2)のすぐ前。仰角で防盾の後ろ半分は砲塔の中へ入る
    const gun = new THREE.Group(); gun.position.set(0, TRUNNION.y, TRUNNION.z); turret.add(gun);
    const G = (geo, mat, o = {}) => add(geo, mat, { ...o, parent: o.parent ?? gun });
    const MANT = [
      { z: -0.7, pts: U.sym([[5.9, -1.45], [5.9, 1.45]]) },
      { z: 0.3, pts: U.sym([[5.9, -1.45], [5.9, 1.45]]) },
      { z: 0.8, pts: U.sym([[5.5, -1.1], [5.5, 1.1]]) },
    ];
    G(U.loft(THREE, MANT), M.hull2);
    for (const sx of [-1, 1]) T(box(1.6, 3.2, 1.8), M.hull, { x: sx * 7.3, y: 1.9, z: 7.0 });   // 防盾の両端の覆い(固定)
    const TRI = { outer: 3.9, inner: 2.6, dy: 0.75 };   // 1 辺 約 1.5 の正三角形
    const BARRELS = [-1, 1].flatMap((sx) => [[sx * TRI.outer, 0], [sx * TRI.inner, TRI.dy], [sx * TRI.inner, -TRI.dy]]);   // (x, y)。左の頂点・左上・左下・右の頂点・右上・右下
    const BAR = { jacket0: 2.8, jacket1: 7.0, r: 0.2, len: 7.5, z0: 6.5 }, MZ = BAR.z0 + BAR.len + 0.4;   // 冷却筒の範囲、砲身(後座で冷却筒へ引っ込む)、砲口
    const slides = [], muzzles = [], gunFlashes = [];   // slides = 後座する砲身(同じ中身なので bake の instanced で 1 つに)、閃光と砲口の印は別の固定の Group(holder)に置く
    for (const sx of [-1, 1]) G(box(2.6, 2.9, 2.0), M.hull2, { x: sx * (TRI.outer + TRI.inner) / 2, z: 1.8 });   // 揺架の覆い
    for (const [x, y] of BARRELS) {
      G(cylZ(0.42, BAR.jacket1 - BAR.jacket0, 12), M.dark, { x, y, z: (BAR.jacket0 + BAR.jacket1) / 2, edges: false });   // 冷却筒
      for (const z of [3.6, 5.0, 6.4]) G(cylZ(0.47, 0.3, 12), M.light, { x, y, z, edges: false });
      const s = new THREE.Group(); s.position.set(x, y, 0); gun.add(s); slides.push(s);
      G(cylZ(BAR.r, BAR.len, 10), M.dark, { parent: s, z: BAR.z0 + BAR.len / 2, edges: false });
      G(cylZ(BAR.r + 0.1, 0.8, 10), M.dark, { parent: s, z: MZ - 0.4, edges: false });           // 消炎器
      const h = new THREE.Group(); h.position.set(x, y, 0); gun.add(h);
      gunFlashes.push(U.flashAt(THREE, addU, M.flame, M.flashCore, h, MZ + 0.1, 0.35));
      const mz = new THREE.Object3D(); mz.position.z = MZ; h.add(mz); muzzles.push(mz);
    }

    // 機関砲の薄い煙(車両の座標に置き、砲塔が回っても出た場所に残る)
    const PUFFS = 16, puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.smoke, PUFFS); puffs.visible = false; puffs.frustumCulled = false; group.add(puffs);
    const puff = Array.from({ length: PUFFS }, () => ({ t: 9, pos: new THREE.Vector3(), vel: new THREE.Vector3() }));
    const rng = U.rng(31);
    const mt = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(), mv = new THREE.Vector3();
    const tmp = new THREE.Vector3(), fq = new THREE.Quaternion(), gq = new THREE.Quaternion();
    const toGroup = (obj) => { group.updateMatrixWorld(true); obj.getWorldPosition(tmp); group.worldToLocal(tmp); obj.getWorldQuaternion(fq); group.getWorldQuaternion(gq); fq.premultiply(gq.invert()); };   // obj の位置・向きを車両の座標に
    // ── 発射演出のリアル版(2026-10-16。setFxStyle("real") で切替): 23mm 級 6 連装の連射。1 発ごとに小さな閃光と火球、薄い煙が積もって靄になる、2 発に 1 発の曳光弾(明るい筋がまっすぐ遠くへ) ──
    const realFx = U.muzzleFx(THREE, group, { ground: 0.3, seed: 37,
      flash: { pool: 6, len: 0.045, size: [2.4, 4.6], tongue: { len: [4, 7], width: [1.4, 2.2], side: 0 } }, light: { len: 0.05, power: 30000, z: 2 },
      balls: { per: 3, pool: 18, len: 0.12, size: 2.2, speed: 40, length: 4 },
      smoke: { per: 2, pool: 48, len: [1.4, 2.4], speed: 10, spread: 0.5, drag: 1.8, rise: 2.5, size: [1.2, 2], grow: [4, 7], peak: 0.4, ahead: [0.5, 2] },
      tracers: { pool: 24, speed: 420, len: 1.4, drop: 6 } });
    let fxStyle = opts.fxStyle ?? "stylized", tracerN = 0;

    // ── 動き ──
    const EL = -Math.PI / 4;                                    // 対空姿勢の仰角(45°)
    const BURST = 1.2, SHOT_DT = 0.05, SHOT_ORDER = [0, 3, 1, 4, 2, 5];   // 連射の長さ、発射間隔、左右交互の順(BARRELS の番号)
    const PUFF_LEN = 0.9;
    let moving = false, traverse = false, engaged = false, clock = 0, yaw = 0, elev = 0;
    let burst = 0, nextShot = 0, shot = 0;
    const flashT = gunFlashes.map(() => 0), recoil = slides.map(() => 0);
    let baked = null;   // U.bake の戻り(砲身・起動輪の instanced を sync する)
    const ready = () => engaged && Math.abs(elev - EL) <= 0.03;
    function update(dt) {
      clock += dt;
      ch.update(dt, moving);
      body.position.y = moving ? Math.abs(Math.sin(clock * 11)) * 0.1 : body.position.y * 0.8;
      // 対空姿勢: 防盾ごと 6 門を上げ下げする(走行中も取れる)
      const targetElev = engaged ? EL : 0;
      elev += Math.sign(targetElev - elev) * Math.min(Math.abs(targetElev - elev), dt * 0.9);
      gun.rotation.x = elev;
      const targetYaw = traverse ? Math.sin(clock * 0.5) * 0.6 : 0;
      yaw += (targetYaw - yaw) * Math.min(1, dt * 2); turret.rotation.y = yaw;
      // 連射: 6 門が左右交互に撃つ。閃光は一瞬、撃った砲身だけが冷却筒へ短く下がる
      if (burst > 0) { burst -= dt; nextShot -= dt; while (burst > 0 && nextShot <= 0) { nextShot += SHOT_DT; shoot(SHOT_ORDER[shot++ % SHOT_ORDER.length]); } }
      gunFlashes.forEach((f, i) => { if (flashT[i] > 0) flashT[i] -= dt; f.visible = flashT[i] > 0; });
      slides.forEach((s, i) => {
        recoil[i] = Math.max(0, recoil[i] - dt / 0.12); const u = 1 - recoil[i];
        s.position.z = recoil[i] > 0 ? -0.5 * (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75) : 0;
      });
      baked?.sync();   // 砲身(instanced)の位置を写す
      let anyP = false;
      puff.forEach((p, i) => {
        const live = p.t < PUFF_LEN;
        if (live) { p.t += dt; p.vel.multiplyScalar(Math.max(0, 1 - dt * 3)); p.vel.y += dt * 2.5; p.pos.addScaledVector(p.vel, dt); anyP = true; }
        const u = Math.min(1, p.t / PUFF_LEN), s = live ? (0.5 + u * 2.0) * (u < 0.7 ? 1 : (1 - u) / 0.3) : 0;
        mt.compose(p.pos, mq.identity(), ms.setScalar(Math.max(0.001, s))); puffs.setMatrixAt(i, mt);
      });
      puffs.visible = anyP; puffs.instanceMatrix.needsUpdate = true;
      body.rotation.x = burst > 0 ? 0.002 * Math.sin(clock * 90) : 0;   // 連射中の細かい震え
      realFx.update(dt);
    }
    function shoot(i) {
      recoil[i] = 1;
      if (fxStyle === "real") { realFx.fire(muzzles[i]); if (tracerN++ % 3 === 0) realFx.tracer(muzzles[i]); return; }   // 3 発に 1 発(発射順が左右交互なので、2 発に 1 発だと片側の砲身だけになる)
      flashT[i] = 0.04;
      const p = puff.find((x) => x.t >= PUFF_LEN); if (!p) return;
      toGroup(muzzles[i]); p.pos.copy(tmp);
      p.vel.set(0, 0, 1).applyQuaternion(fq).multiplyScalar(8).add(mv.set((rng() - 0.5) * 2, rng(), (rng() - 0.5) * 2)); p.t = 0;
    }
    function fireGun() {
      if (burst <= 0) nextShot = 0;
      burst = BURST;
    }

    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "stealth";
    function applyPaint() {
      const tc = teamColor.clone();
      if (paint === "stealth") { M.hull.color.set(C.graphite); M.hull2.color.set(C.graphite2); M.deck.color.set(0x343d46); M.strip.color.copy(tc); M.edge.color.set(0x0b1015); }
      else if (paint === "team") { M.hull.color.copy(tc); M.hull2.color.copy(tc).multiplyScalar(0.78); M.deck.color.copy(tc).multiplyScalar(0.7); M.strip.color.set(0xffffff); M.edge.color.set(C.edge); }
      else { M.hull.color.set(C.white); M.hull2.color.set(C.light); M.deck.color.set(0xcfd6dd); M.strip.color.copy(tc); M.edge.color.set(0x3b4752); }
      M.ring.color.copy(tc); M.glow.color.copy(tc);
    }
    function fitPlate() {   // 原点から見た車体・砲塔(走行姿勢)のいちばん遠い点を囲む
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
      const s = Math.sin(-EL), c = Math.cos(-EL), lowY = (y, z) => Math.min(TRUNNION.y + y, TRUNNION.y + y * c + z * s);   // 走行姿勢と対空姿勢で低い方
      const sweep = Math.max(Math.hypot(8.1, 7.9), Math.hypot(5.8, 10.85));   // 砲塔の掃引半径(防盾の覆いの前の角、後面の雑具箱の角)
      return {
        mantletAboveDeck: +Math.min(lowY(-1.45, 0.8), lowY(-1.45, -0.7), lowY(-1.45, 2.8)).toFixed(2),   // 防盾・揺架の覆いの下の角と車体上面(砲塔の座標 y 0)
        mantletToCheek: +((7.3 - 0.8) - 5.9).toFixed(2),                                                 // 防盾の端と固定の覆い
        mantletFrontOverFace: +((TRUNNION.y + 1.45 * c + 0.8 * s) <= 3.9 ? TRUNNION.z - 1.45 * s + 0.8 * c - 6.2 : -1).toFixed(2),   // 対空姿勢: 防盾の前の上の角は砲塔前面(z 6.2)より前
        lowerBarrelOverHull: +((7.3 + TRUNNION.y - TRI.dy - BAR.r - 0.1) - topY(TURRET_Z + TRUNNION.z + MZ)).toFixed(2),   // 走行姿勢: 下の砲身の消炎器と車首の上面
        turretSweepToDeckItems: +((11.8 - TURRET_Z) - sweep).toFixed(2),                                // 掃引半径と機関室の吸気スリット(いちばん近い甲板の部品)
        turretOverhangToHull: +((8.4 - 7.8) * 2.3 / 4.8).toFixed(2),                                    // 張り出した砲塔の下端(x 8.4)と車体の斜面
        skirtToTrack: +(ch.skirtX - (ch.trackX + ch.trackW / 2)).toFixed(2),
      };
    };
    baked = U.bake(THREE, group, { dynamic: [turret, gun], live: [M.hull, M.hull2, M.deck, M.strip], also: [M.strip], instanced: [{ groups: slides }, { groups: ch.wheels, staticEdges: true }] });   // 砲身 6 → 1、足回り 12 → 3
    ch.setBaked(baked);
    return {
      plateRadius, group, update, fireGun, check, setFxStyle: (st) => (fxStyle = st === "real" ? "real" : "stylized"), get fxStyle() { return fxStyle; }, setTeam: (c) => { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }, setPaint: (p) => { paint = p; applyPaint(); },
      stats: () => U.stats(group), parts: { turret, gun, plate },
      setMoving: (b) => (moving = b), setTraverse: (b) => (traverse = b), setEngaged: (b) => (engaged = b),
      get moving() { return moving; }, get traverse() { return traverse; }, get engaged() { return engaged; }, get paint() { return paint; },
      get firing() { return burst > 0; }, get ready() { return ready(); },
    };
  }

  (window.DreamAssets ??= {}).aa = aa;
})();
