// 部隊トークン「自走砲」(試作)。装甲強襲 v3 と同じ家族: 共通の装軌車体(chassis.js)に、155mm 級 52 口径の長砲身を載せた自走榴弾砲。
// 下敷きは K9 / PzH 2000。外観は同じ近未来ステルス寄り(大きな平面、光る継ぎ目はチーム色の細い線だけ、センサーは暗いガラス)。
//   車体: 機関室は前(右前の吸気スリットと排気)、操縦手は左前。サイドスカート、泥よけ、前照灯、後面に予備履帯と牽引具。
//   砲塔: 車体後ろ寄りの大きな楔形。後面に弾薬補給ハッチ、屋根に車長・装填手ハッチ、パノラマ照準器、換気ドーム、初速測定レーダー、アンテナ、バスケット、発煙弾発射機。
//   主砲: 長い砲身、排煙器(中ほどの膨らみ)、2 室式のマズルブレーキ、砲身帯。走行時は車首の砲身固定具(トラベルロック)に載せ、展開で砲身を 40° に上げ、固定具は前へ倒れる。
//   射撃: 展開中だけ。長い後座と復座、砲口の閃光と橙の炎(マズルブレーキで横へも噴く)、灰色の煙と砲口から飛ぶ煙の輪、車両の周りに舞う砂塵、車体の揺れ。弾は見えない(実際も見えない)。
//
//   const a = DreamAssets.spg(THREE);
//   scene.add(a.group); a.setTeam(0xff6a1a); a.setPaint("stealth" | "team" | "white"); a.setDeployed(true); a.fire(); a.update(dt)
//
// 前方 = +z、上 = +y。ゲームの部隊表示倍率 2.0 を前提にした寸法(車体は装甲強襲と同じ)。
(function () {
  const C = { graphite: 0x2c343c, graphite2: 0x3a434c, white: 0xf2f4f6, light: 0xdfe4e9, dark: 0x262e36, track: 0x30383f, link: 0x4a535c, edge: 0x141b21 };

  function spg(THREE, opts = {}) {
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
      sign: new THREE.MeshBasicMaterial({ map: U.signTexture(THREE, "砲"), transparent: true }),
      flash: basic(0xfff1d0, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),   // 砲口の閃光
      plume: basic(0xff8c2a, { transparent: true, opacity: 0.9, depthWrite: false }),                                      // 発射炎(橙)
      smoke: basic(0x7d838a, { transparent: true, opacity: 0.35, depthWrite: false }),                                     // 煙
      ringSmoke: basic(0x9aa1a8, { transparent: true, opacity: 0.5, depthWrite: false }),                                  // 煙の輪
      dust: basic(0xc9bda8, { transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }),               // 砂塵
    };
    const group = new THREE.Group(); group.name = "spg";
    const body = new THREE.Group(); group.add(body);
    const addU = U.adder(THREE, M.edge, 15);
    const add = (geo, mat, { parent = body, ...o } = {}) => addU(geo, mat, parent, o);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h, n = 10) => new THREE.CylinderGeometry(r, r, h, n);
    const cylZ = (r, h, n = 12) => { const g = cyl(r, h, n); g.rotateX(Math.PI / 2); return g; };
    const edgeStrip = (secs, idx, from, to, parent) => U.edgeStrip(THREE, M.strip, secs, idx, from, to, parent);
    const Z = new THREE.Vector3(0, 0, 1);
    const bar = (a, b, w, mat, parent, edges = true) => {   // 2 点を結ぶ角材
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
      const m = new THREE.Mesh(box(w, w, L), mat); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Z, d.normalize());
      if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 15), M.edge));
      parent.add(m); return m;
    };

    // ── 足元: ベースプレート(大きさは最後に fitPlate で決める) ──
    const plate = new THREE.Group(); group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };

    // ── 足回り(共通)と上部車体 ──
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
    // 機関室(右前): 吸気スリットと排気口。操縦手(左前): ハッチと潜望鏡
    for (let k = 0; k < 4; k++) onTop(box(5.0, 0.12, 0.45), M.dark, 3.8, 11.8 + k * 1.1, 0.12, { edges: false });
    onTop(box(1.6, 0.35, 3.0), M.dark, 6.4, 13.4, 0.35);
    for (const z of [12.4, 13.4, 14.4]) onTop(box(1.2, 0.06, 0.12), M.light, 6.4, z, 0.4, { edges: false });
    onTop(cyl(1.4, 0.22, 8), M.hull2, -4.2, 13.6, 0.22, { ry: Math.PI / 8 });
    for (const x of [-5.1, -3.3]) onTop(box(1.0, 0.5, 0.5), M.glass, x, 15.4, 0.5, { edges: false });
    // 前照灯、スカート、泥よけ
    const SKIRTS = [[-16.2, -10.8], [-10.4, -4.6], [-4.2, 1.6], [2.0, 7.8], [8.2, 14.6]], FLAP_Z = { rear: -19.75, front: 18.4 };
    for (const sx of [-1, 1]) {
      onTop(box(1.3, 0.55, 0.9), M.dark, sx * 4.6, 18.3, 0.55);
      onTop(box(1.0, 0.36, 0.5), M.glass, sx * 4.6, 18.3 + 0.45, 0.40, { edges: false });
      SKIRTS.forEach(([z0, z1], i) => { const t = i === SKIRTS.length - 1 ? 0.7 : 0.4; add(box(t, 1.5, z1 - z0), M.hull2, { x: sx * (ch.skirtX + t / 2), y: 3.15, z: (z0 + z1) / 2 }); });
      add(box(3.6, 2.0, 0.3), M.dark, { x: sx * ch.trackX, y: 3.2, z: FLAP_Z.rear });
      add(box(3.6, 1.9, 0.3), M.dark, { x: sx * ch.trackX, y: 2.85, z: FLAP_Z.front });
      // 後面: 予備履帯と牽引具
      add(box(3.2, 0.94, 0.4), M.link, { x: sx * 4.0, y: 5.6, z: -19.85 });
      add(box(0.7, 0.5, 0.6), M.dark, { x: sx * 8.2, y: 4.65, z: -19.9, edges: false });
    }

    // ── 砲塔: 車体後ろ寄りの大きな楔形(高さ 5.6)。旋回軸は z -5 ──
    const turret = new THREE.Group(); turret.position.set(0, 7.3, -5.0); body.add(turret);
    const T = (geo, mat, o = {}) => add(geo, mat, { ...o, parent: o.parent ?? turret });
    const TUR = [
      { z: -11.0, pts: U.sym([[7.0, 0], [7.4, 1.2], [6.2, 5.0]]) },
      { z: -2.0, pts: U.sym([[8.2, 0], [8.6, 1.4], [6.8, 5.6]]) },
      { z: 5.0, pts: U.sym([[7.6, 0], [8.0, 1.3], [5.6, 5.2]]) },
      { z: 7.5, pts: U.sym([[5.0, 0.6], [5.4, 1.6], [3.6, 4.4]]) },
    ];
    T(U.loft(THREE, TUR), M.hull);
    edgeStrip(TUR, 4, 0, 3, turret); edgeStrip(TUR, 1, 0, 3, turret);
    const roofY = (z) => z <= -2 ? 5.0 + 0.6 * (z + 11) / 9 : z <= 5 ? 5.6 - 0.4 * (z + 2) / 7 : 5.2 - 0.8 * (z - 5) / 2.5;
    const roofRX = (z) => z <= -2 ? -Math.atan(0.6 / 9) : z <= 5 ? Math.atan(0.4 / 7) : Math.atan(0.8 / 2.5);
    const onRoof = (geo, mat, x, z, h, o = {}) => T(geo, mat, { x, z, y: roofY(z) + h / 2 - 0.08, rx: roofRX(z), ...o });
    // 後面の弾薬補給ハッチ(大きな扉と蝶番)
    T(box(5.0, 3.4, 0.2), M.dark, { y: 2.6, z: -11.08 });
    for (const y of [1.4, 3.8]) T(box(5.4, 0.3, 0.3), M.hull2, { y, z: -11.15, edges: false });
    // 屋根: 車長ハッチ(右)と装填手ハッチ(左)、視察窓、パノラマ照準器、換気ドーム、初速測定レーダー、アンテナ
    for (const sx of [-1, 1]) {
      onRoof(cyl(1.3, 0.22, 8), M.hull2, sx * 2.8, -4.5, 0.22, { ry: Math.PI / 8 });
      for (const a of [-0.8, -0.27, 0.27, 0.8]) onRoof(box(0.5, 0.35, 0.3), M.glass, sx * 2.8 + 1.55 * Math.sin(a), -4.5 + 1.55 * Math.cos(a), 0.35, { ry: -a, edges: false });
      T(cyl(0.35, 0.5, 8), M.dark, { x: sx * 5.4, y: roofY(-9.5) + 0.22, z: -9.5 });
      T(cyl(0.08, 4.5, 6), M.dark, { x: sx * 5.4, y: roofY(-9.5) + 0.47 + 2.25 * Math.cos(-0.15), z: -9.5 + 2.25 * Math.sin(-0.15), rx: -0.15, edges: false });
    }
    onRoof(box(1.5, 0.5, 1.5), M.hull2, -3.6, 1.0, 0.5);
    onRoof(box(1.7, 1.2, 1.9), M.hull2, -3.6, 1.0, 0.5 + 1.2 + 0.4);
    T(box(1.2, 0.6, 0.24), M.glass, { x: -3.6, y: roofY(1.0) + 0.5 + 0.55, z: 1.0 + 0.95 + 0.06, edges: false });
    onRoof(new THREE.SphereGeometry(0.9, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.hull2, 0, -8.0, 0.0);   // 換気ドーム
    onRoof(box(1.3, 0.9, 1.5), M.hull2, 3.4, 2.0, 0.9);                                                      // 砲手照準器
    T(box(0.9, 0.4, 0.24), M.glass, { x: 3.4, y: roofY(2.0) + 0.45, z: 2.0 + 0.75 + 0.06, edges: false });
    onRoof(box(1.2, 0.8, 1.4), M.dark, 0, 3.0, 0.8, { rx: roofRX(3.0) - 0.45 });                             // 初速測定レーダー(砲耳の覆いの後ろから砲口を見る)
    // 発煙弾発射機(両側の前の斜面)
    for (const sx of [-1, 1]) {
      const t = (3.0 + 2) / 7, lo = [8.6 + (8.0 - 8.6) * t, 1.4 + (1.3 - 1.4) * t], hi = [6.8 + (5.6 - 6.8) * t, 5.6 + (5.2 - 5.6) * t];
      const d = [hi[0] - lo[0], hi[1] - lo[1]], L = Math.hypot(...d), n = [d[1] / L, -d[0] / L], mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], ang = Math.atan2(n[1], n[0]);
      T(box(0.5, 1.6, 2.0), M.hull2, { x: sx * (mid[0] + n[0] * 0.2), y: mid[1] + n[1] * 0.2, z: 3.0, rz: sx * ang });
      const dir = new THREE.Vector3(sx * 0.55, 0.45, 0.7).normalize(), up = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < 4; k++) { const m = T(cylZ(0.28, 1.5, 8).rotateX(-Math.PI / 2), M.dark, { edges: false }); m.position.set(sx * (mid[0] + n[0] * 0.45), mid[1] + n[1] * 0.45, 2.25 + k * 0.5).addScaledVector(dir, 0.6); m.quaternion.setFromUnitVectors(up, dir); }
    }
    // 屋根後部のバスケット(枠と網床、中に幌)
    { const y0 = 5.3, y1 = 6.4, hx = 5.4, z0 = -11.0, z1 = -13.2, bw = 0.18;
      for (const sx of [-1, 1]) for (const y of [y0, y1]) T(box(bw, bw, z0 - z1), M.dark, { x: sx * hx, y, z: (z0 + z1) / 2, edges: false });
      for (const y of [y0, (y0 + y1) / 2, y1]) T(box(2 * hx + bw, bw, bw), M.dark, { y, z: z1, edges: false });
      for (const sx of [-1, 1]) T(box(bw, y1 - y0, bw), M.dark, { x: sx * hx, y: (y0 + y1) / 2, z: z1, edges: false });
      T(box(2 * hx, 0.08, z0 - z1 - 0.2), M.dark, { y: y0, z: (z0 + z1) / 2 + 0.1, edges: false });
      T(cylZ(0.6, 7.0, 10).rotateY(Math.PI / 2), M.light, { x: -1.2, y: y0 + 0.64, z: -12.1 });
      T(box(2.0, 1.0, 1.4), M.hull2, { x: 3.6, y: y0 + 0.54, z: -12.1 });
    }

    // ── 主砲: 砲耳(トラニオン)で仰角。後座は砲身だけが軸に沿って滑る(slide) ──
    const TRUNNION = { y: 3.0, z: 6.0 };   // 砲塔前面(z 7.5)のすぐ内側。仰角で防盾が屋根を突き抜けないように前へ寄せる
    const gun = new THREE.Group(); gun.position.set(0, TRUNNION.y, TRUNNION.z); turret.add(gun);
    const slide = new THREE.Group(); gun.add(slide);
    const S = (geo, mat, o = {}) => T(geo, mat, { ...o, parent: slide });
    // 砲身: 実物の比率(半径 1.15〜0.85)では太く見えたので、見た目のバランスで中間(0.85 → 0.62)にした(ユーザー指摘)
    const BARREL = { r0: 0.85, r1: 0.62, z0: 3.5, len: 29.0 };
    const rAt = (z) => BARREL.r0 + (BARREL.r1 - BARREL.r0) * Math.min(1, Math.max(0, (z - BARREL.z0) / BARREL.len));   // 砲の座標 z での半径
    BARREL.r = rAt(14.0);   // 固定具の位置(車体 z 15 = 砲の座標 z 14)での半径
    S(box(4.2, 2.8, 3.0), M.hull2, { z: 2.0 });                                     // 防盾(砲塔前面から出る部分。後ろ半分は砲塔の中)
    T(box(4.6, 1.2, 2.6), M.hull, { y: 4.9, z: 6.4 });                              // 砲耳の覆い(防盾が仰角で上がる所を囲う固定の箱)
    const barrelG = new THREE.CylinderGeometry(BARREL.r1, BARREL.r0, BARREL.len, 16); barrelG.rotateX(Math.PI / 2);   // 砲口側が細いテーパー
    S(barrelG, M.dark, { z: BARREL.z0 + BARREL.len / 2, edges: false });
    S(cylZ(rAt(13.0) + 0.36, 5.0, 16), M.hull2, { z: 13.0 });                       // 排煙器
    for (const z of [7.8, 18.5, 24.0, 29.5]) S(cylZ(rAt(z) + 0.1, 0.6, 16), M.light, { z, edges: false });   // 砲身帯
    const MZ = BARREL.z0 + BARREL.len + 3.0;   // 砲口(マズルブレーキの先端)
    S(box(2.4, 2.4, 3.2), M.hull2, { z: MZ - 1.6 });                                 // マズルブレーキ(2 室)
    for (const z of [MZ - 2.4, MZ - 0.9]) S(box(2.8, 1.3, 0.65), M.dark, { z, edges: false });
    S(cylZ(0.48, 0.3, 14), M.dark, { z: MZ + 0.1, edges: false });

    // ── 砲身固定具(トラベルロック): 車首の V 字の受け。展開すると前へ倒れる ──
    const LOCK_Z = 15.0, lockBase = topY(LOCK_Z) - 0.05;
    const PAD_Y = (7.3 + TRUNNION.y - BARREL.r - 0.03) - 0.125 - lockBase;   // 受けの上面が走行時の砲身の下面に 0.03 だけ届かない高さ
    const lock = new THREE.Group(); lock.position.set(0, lockBase, LOCK_Z); body.add(lock);
    add(box(3.8, 0.5, 1.0), M.dark, { parent: lock, y: 0.25 });
    for (const sx of [-1, 1]) bar([sx * 1.6, 0.4, 0], [sx * 0.8, PAD_Y, 0], 0.3, M.hull2, lock);
    add(box(2.0, 0.25, 0.9), M.dark, { parent: lock, y: PAD_Y });

    // ── 発射演出(砲口に置き、撃ったときだけ見せる) ──
    const fx = new THREE.Group(); fx.position.z = MZ; fx.visible = false; slide.add(fx);
    const sphereG = new THREE.SphereGeometry(1, 10, 8);
    const flash = new THREE.Mesh(sphereG, M.flash); fx.add(flash);
    const PLUMES = 8, plumes = new THREE.InstancedMesh(sphereG, M.plume, PLUMES); fx.add(plumes);
    const rngFx = U.rng(23);
    const cone = (spread, s0, s1, side = 1) => { const a = rngFx() * Math.PI * 2, t = rngFx() * spread, sp = s0 + rngFx() * (s1 - s0); return new THREE.Vector3(Math.cos(a) * t * side, Math.sin(a) * t, 1).normalize().multiplyScalar(sp); };
    const plumeDir = Array.from({ length: PLUMES }, (_, i) => cone(i < 4 ? 0.5 : 1.6, 24, 50));   // 後半はマズルブレーキから横へ
    const smokeRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.22, 8, 28), M.ringSmoke); fx.add(smokeRing);
    const SMOKES = 12, smokeDir = Array.from({ length: SMOKES }, () => cone(1.1, 5, 12));
    const smokeG = new THREE.Group(); smokeG.visible = false; body.add(smokeG);   // 煙は車体の座標に置く(砲塔が回っても出た場所に残る)
    const smokes = new THREE.InstancedMesh(sphereG, M.smoke, SMOKES); smokeG.add(smokes);
    const dust = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.0, 48), M.dust); dust.rotation.x = -Math.PI / 2; dust.position.y = 0.3; dust.visible = false; body.add(dust);
    const relM = new THREE.Matrix4(), sc = new THREE.Vector3(), mt = new THREE.Matrix4(), mq = new THREE.Quaternion(), mv = new THREE.Vector3();
    const place = (i, inst, pos, scale) => { mt.compose(pos, mq.identity(), sc.setScalar(Math.max(0.001, scale))); inst.setMatrixAt(i, mt); };
    // ── 発射演出のリアル版(2026-10-16。既定のデフォルメ版は残し setFxStyle("real") で切替): 155mm 級の実射。大きな閃光と火球、2 室式マズルブレーキから横へ噴く炎、
    //    数秒残る大きな白灰の煙、砲口の高さと爆風の強さから車両の周り全体に広がる砂塵。共通のエミッタ U.muzzleFx ──
    const realFx = U.muzzleFx(THREE, body, { ground: 0.3, seed: 29,
      flash: { len: 0.09, size: [12, 34], tongue: { len: [18, 28], width: [7, 10], side: 1.25 } }, light: { len: 0.18, power: 240000, z: 6 },   // 2 室式マズルブレーキ: 横へも舌
      balls: { per: 12, len: 0.4, size: 11, speed: 50, length: 14, side: 0.5, lifeK: 7 },   // 前と左右の 3 つの雲(実写の榴弾砲の発砲に合わせる)。冷えた雲は約 2.8 秒、煙として残る
      smoke: { per: 32, len: [4, 6.5], speed: 40, spread: 1.2, drag: 1.4, rise: 2.5, size: [3, 5], grow: [28, 40], peak: 0.24, ahead: [3, 26], delay: [0.1, 0.4], fadeIn: 0.4, cols: [0xe0d6c6, 0xcfd0cf, 0xdcdfe2] },   // 白灰。32 枚が重なるので 1 枚はかなり薄く。火球が冷えて煙になる範囲に、冷えるころから重なって引き継ぐ
      wisps: { per: 6, len: [2, 3] }, dust: { per: 36, len: [2.5, 4], speed: 34, drag: 1.5, size: [5, 7], grow: 36, peak: 0.6, ahead: 8, angle: Math.PI } });
    let fxStyle = opts.fxStyle ?? "stylized";

    // ── 動き ──
    const ELEV = -0.7, LOCK_FOLD = Math.PI / 2 * 0.95;   // 展開時の仰角(40°)、固定具の倒れ角
    let moving = false, traverse = false, deployed = false, clock = 0, yaw = 0, elev = 0, lockRot = 0, recoil = 0, fxT = 0, rock = 0;
    const FX_LEN = 2.4, FLASH_LEN = 0.14, PLUME_LEN = 0.35, RING_LEN = 1.3, DUST_LEN = 1.4;
    function update(dt) {
      clock += dt;
      ch.update(dt, moving);
      body.position.y = moving ? Math.abs(Math.sin(clock * 11)) * 0.1 : body.position.y * 0.8;
      // 展開: 砲身を上げ、固定具を倒す(走行中は展開しない)
      const targetElev = deployed && !moving ? ELEV : 0, targetLock = deployed && !moving ? LOCK_FOLD : 0;
      // 固定具を先に倒してから砲身を上げる。戻すときは砲身を下ろしてから固定具を立てる
      if (targetLock > lockRot) lockRot = Math.min(targetLock, lockRot + dt * 1.6); else if (elev >= -0.02) lockRot = Math.max(targetLock, lockRot - dt * 1.6);
      if (targetElev < elev) { if (lockRot > LOCK_FOLD - 0.05) elev = Math.max(targetElev, elev - dt * 0.5); } else elev = Math.min(targetElev, elev + dt * 0.5);
      gun.rotation.x = elev; lock.rotation.x = lockRot;
      const target = traverse && deployed ? Math.sin(clock * 0.5) * 0.6 : 0;
      yaw += (target - yaw) * Math.min(1, dt * 2); turret.rotation.y = yaw;
      // 後座(速く 2.6 下がる)と復座(ゆっくり戻る)
      if (recoil > 0) { recoil = Math.max(0, recoil - dt / 1.1); const u = 1 - recoil; slide.position.z = -2.6 * (u < 0.12 ? u / 0.12 : 1 - (u - 0.12) / 0.88); }
      else slide.position.z = 0;
      // 発射演出
      const since = fxT > 0 ? FX_LEN - fxT : Infinity;
      fx.visible = since < Math.max(PLUME_LEN, RING_LEN);
      if (fx.visible) {
        const f = Math.max(0, 1 - since / FLASH_LEN); flash.visible = f > 0; M.flash.opacity = f; flash.scale.setScalar(1.8 + (1 - f) * 3.5);
        const pu = Math.min(1, since / PLUME_LEN); plumes.visible = pu < 1; M.plume.opacity = 0.9 * (1 - pu) * (1 - pu);
        for (let i = 0; i < PLUMES; i++) place(i, plumes, mv.copy(plumeDir[i]).multiplyScalar(since).setZ(1.2 + plumeDir[i].z * since * 0.6), 1.3 + pu * 4.0 + i * 0.1);
        plumes.instanceMatrix.needsUpdate = true;
        const ru = Math.min(1, since / RING_LEN); smokeRing.visible = ru < 1; M.ringSmoke.opacity = 0.5 * (1 - ru); smokeRing.position.z = 3 + since * 16; smokeRing.scale.setScalar(1.2 + ru * 5);
      }
      if (fxT > 0) fxT = Math.max(0, fxT - dt);
      const mu = since / FX_LEN; smokeG.visible = since >= 0.1 && mu < 1;
      if (smokeG.visible) {
        M.smoke.opacity = 0.4 * (1 - mu) * (1 - 0.5 * mu);
        for (let i = 0; i < SMOKES; i++) { const d = smokeDir[i], t = since - 0.1; place(i, smokes, mv.set(d.x * t, d.y * t + 2.0 * t, 2 + d.z * t), 1.6 + t * 4.0 + i * 0.1); }
        smokes.instanceMatrix.needsUpdate = true;
      }
      const du = since / DUST_LEN; dust.visible = du < 1;
      if (dust.visible) { dust.scale.setScalar(14 + du * 20); M.dust.opacity = 0.35 * (1 - du) * (1 - du); }
      if (rock > 0) { rock = Math.max(0, rock - dt * 1.2); body.rotation.x = -0.03 * rock * Math.sin((1 - rock) * Math.PI * 2.5) * Math.exp(-(1 - rock) * 2); }
      else body.rotation.x = 0;
      realFx.update(dt);
    }
    function fire() {
      if (!deployed || moving || Math.abs(elev - ELEV) > 0.03 || recoil > 0) return;
      recoil = 1; rock = 1; group.updateMatrixWorld(true);
      if (fxStyle === "real") { realFx.fire(fx); return; }   // リアル版(デフォルメ版の fxT は動かさない)
      fxT = FX_LEN;
      relM.copy(body.matrixWorld).invert().multiply(fx.matrixWorld); relM.decompose(smokeG.position, smokeG.quaternion, sc);
    }
    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "stealth";
    function applyPaint() {
      const tc = teamColor.clone();
      if (paint === "stealth") { M.hull.color.set(C.graphite); M.hull2.color.set(C.graphite2); M.deck.color.set(0x343d46); M.strip.color.copy(tc); M.edge.color.set(0x0b1015); }
      else if (paint === "team") { M.hull.color.copy(tc); M.hull2.color.copy(tc).multiplyScalar(0.78); M.deck.color.copy(tc).multiplyScalar(0.7); M.strip.color.set(0xffffff); M.edge.color.set(C.edge); }
      else { M.hull.color.set(C.white); M.hull2.color.set(C.light); M.deck.color.set(0xcfd6dd); M.strip.color.copy(tc); M.edge.color.set(0x3b4752); }
      M.ring.color.copy(tc); M.glow.color.copy(tc);
    }
    function fitPlate() {   // 原点から見た車体・砲身(走行姿勢)のいちばん遠い点を囲む
      group.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), p = new THREE.Vector3(), m = new THREE.Matrix4();
      let far = 0;
      body.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
        m.multiplyMatrices(inv, o.matrixWorld);
        const a = o.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { p.fromBufferAttribute(a, i).applyMatrix4(m); far = Math.max(far, Math.hypot(p.x, p.z)); }
      });
      const inner = far + 1.5, outer = inner + 3;
      flat(new THREE.RingGeometry(inner, outer, 64), M.ring, 0.25);
      flat(new THREE.CircleGeometry(inner - 0.4, 64), M.glow, 0.2);
      flat(new THREE.PlaneGeometry(6.5, 6.5), M.sign, 0.35, outer + 3.6);
      return outer;
    }
    const plateRadius = fitPlate();
    applyPaint();
    // 隙間の確認値(すべて正なら貫通なし)
    const check = () => {
      const trunnionY = 7.3 + TRUNNION.y, s = Math.sin(-ELEV), c = Math.cos(-ELEV);
      // 仰角時の防盾の後ろ上の角(砲の座標 z 0.5, y 1.4)の高さと、その真上の屋根
      const cornerY = TRUNNION.y + 0.5 * s + 1.4 * c, cornerZ = TRUNNION.z + 0.5 * c - 1.4 * s;
      return {
        barrelOnLock: +((trunnionY - BARREL.r) - (lockBase + PAD_Y + 0.125)).toFixed(2),         // 走行時: 砲身の下面と固定具の受けの上面(わずかに正 = 載っている)
        mantletUnderRoof: +(roofY(cornerZ) - cornerY).toFixed(2),                                   // 仰角時: 防盾の後ろ上の角が屋根の下にある
        mantletUnderHousing: +((4.9 + 0.6) - (TRUNNION.y + 1.5 / c * s + 1.4 * c)).toFixed(2),      // 仰角時: 砲塔前面(z 7.5)での防盾の上面と砲耳の覆いの上面
        barrelOverLockFolded: +((trunnionY - BARREL.r) - (lockBase + 0.5 + (PAD_Y + 0.125) * Math.cos(LOCK_FOLD))).toFixed(2),   // 倒れた固定具の上端と走行時の砲身の下面
        turretSweepToDriverHatch: +((13.6 - 1.4 - (-5.0)) - Math.hypot(5.4, 13.2)).toFixed(2),      // 砲塔(バスケットの角)の掃引半径と操縦手ハッチ
        skirtToTrack: +(ch.skirtX - (ch.trackX + ch.trackW / 2)).toFixed(2),
      };
    };
    ch.setBaked(U.bake(THREE, group, { dynamic: [turret, gun, slide, lock], live: [M.hull, M.hull2, M.deck, M.strip], also: [M.strip], instanced: [{ groups: ch.wheels, staticEdges: true }] }));
    return {
      plateRadius, group, update, fire, check, setFxStyle: (st) => (fxStyle = st === "real" ? "real" : "stylized"), get fxStyle() { return fxStyle; }, setTeam: (c) => { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }, setPaint: (p) => { paint = p; applyPaint(); },
      stats: () => U.stats(group), parts: { turret, gun, plate, lock },
      setMoving: (b) => (moving = b), setTraverse: (b) => (traverse = b), setDeployed: (b) => (deployed = b),
      get moving() { return moving; }, get traverse() { return traverse; }, get deployed() { return deployed; }, get paint() { return paint; },
      get ready() { return deployed && !moving && Math.abs(elev - ELEV) <= 0.03; },
    };
  }

  (window.DreamAssets ??= {}).spg = spg;
})();
