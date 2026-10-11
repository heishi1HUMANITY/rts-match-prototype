// 部隊トークン「装甲強襲・装軌案」v2(試作)。レールガン戦車。
// 方向性: 姿勢を低く、ステルス艦のような面構成(側面は上へ行くほど内側に倒れる)、細部の部品は減らし、光る継ぎ目で SF らしさを出す。
// 主砲はマズルブレーキなしの角断面(平たく縦長)。上下2本のレールの間が光り、撃つ前に充電して光が強まる。
// 履帯は1枚ずつの履板(InstancedMesh)が起動輪・誘導輪の周りを回る。
//
//   const tank = DreamAssets.tank(THREE);
//   scene.add(tank.group); tank.setTeam(0xff6a1a); tank.setPaint("stealth" | "team" | "white"); tank.fire(); tank.update(dt)
//
// 前方 = +z、上 = +y。ゲームの部隊表示倍率 2.0 を前提にした寸法。
(function () {
  const C = { graphite: 0x2c343c, graphite2: 0x3a434c, white: 0xf2f4f6, light: 0xdfe4e9, dark: 0x262e36, track: 0x30383f, link: 0x4a535c, edge: 0x141b21, rail: 0x1fd3ff };

  function tank(THREE, opts = {}) {
    const U = DreamAssets.util;   // 断面の連結(loft / sym)、記号板、光る線、add、stats は common.js のもの
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      hull: lambert(C.graphite), hull2: lambert(C.graphite2), deck: lambert(C.graphite2),
      dark: lambert(C.dark), light: lambert(C.light), link: lambert(C.link), linkDark: lambert(C.track),
      strip: basic(0xff6a1a), rail: basic(C.rail, { transparent: true, opacity: 0.55 }),
      beam: basic(0xbff4ff, { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.55 }),
      ring: basic(0xff6a1a, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      glow: basic(0xff6a1a, { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      sign: new THREE.MeshBasicMaterial({ map: U.signTexture(THREE, "強"), transparent: true }),
    };
    const group = new THREE.Group(); group.name = "tank";
    const body = new THREE.Group(); group.add(body);
    // 共通の add(輪郭線つき)を、このファイルの呼び方(parent を options で渡す)に合わせた包み
    const addU = U.adder(THREE, M.edge, 15);
    const add = (geo, mat, { parent = body, ...o } = {}) => addU(geo, mat, parent, o);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const edgeStrip = (secs, idx, from, to, parent) => U.edgeStrip(THREE, M.strip, secs, idx, from, to, parent);   // 光る線(チーム色)

    // ── 足元: ベースプレートと種類の記号板(ゲームと同じ) ──
    const plate = new THREE.Group(); group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };
    // リングの大きさは車体と砲身が収まるように最後に決める(fitPlate)

    // ── 履帯: 起動輪(後)と誘導輪(前)を結ぶ輪の上に履板を並べる ──
    const R = 2.15, B = new THREE.Vector2(-16.6, 2.55), F = new THREE.Vector2(15.3, 2.55);   // (z, y)
    const run = F.x - B.x, loopLen = 2 * run + 2 * Math.PI * R;
    const pathAt = (s) => {   // 下の直線 → 前の半円 → 上の直線 → 後ろの半円(z-y 平面)。t = 進む向き、n = 外向き
      s = ((s % loopLen) + loopLen) % loopLen;
      if (s < run) return { z: B.x + s, y: B.y - R, tz: 1, ty: 0, nz: 0, ny: -1 };
      s -= run;
      if (s < Math.PI * R) { const a = -Math.PI / 2 + s / R; return { z: F.x + Math.cos(a) * R, y: F.y + Math.sin(a) * R, tz: -Math.sin(a), ty: Math.cos(a), nz: Math.cos(a), ny: Math.sin(a) }; }
      s -= Math.PI * R;
      if (s < run) return { z: F.x - s, y: F.y + R, tz: -1, ty: 0, nz: 0, ny: 1 };
      s -= run;
      const a = Math.PI / 2 + s / R; return { z: B.x + Math.cos(a) * R, y: B.y + Math.sin(a) * R, tz: -Math.sin(a), ty: Math.cos(a), nz: Math.cos(a), ny: Math.sin(a) };
    };
    const LINKS = Math.round(loopLen / 1.1), TRACK_X = 9.55, TRACK_W = 3.2;
    const linkG = box(TRACK_W, 0.4, 0.94), grouserG = box(TRACK_W - 0.4, 0.2, 0.34);
    const links = new THREE.InstancedMesh(linkG, M.link, LINKS * 2);
    const grousers = new THREE.InstancedMesh(grouserG, M.linkDark, LINKS * 2);
    body.add(links, grousers);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    let trackS = 0;
    const layTracks = () => {
      let k = 0;
      for (const sx of [-1, 1]) for (let i = 0; i < LINKS; i++) {
        const p = pathAt(trackS + (i * loopLen) / LINKS);
        q.setFromEuler(e.set(Math.atan2(-p.ty, p.tz), 0, 0));
        mt.compose(v.set(sx * TRACK_X, p.y + p.ny * 0.21, p.z + p.nz * 0.21), q, one); links.setMatrixAt(k, mt);
        mt.compose(v.set(sx * TRACK_X, p.y + p.ny * 0.46, p.z + p.nz * 0.46), q, one); grousers.setMatrixAt(k, mt);
        k++;
      }
      links.instanceMatrix.needsUpdate = grousers.instanceMatrix.needsUpdate = true;
    };
    layTracks();
    // 転輪・起動輪・誘導輪(履帯の内側)。転輪 12 個とハブは InstancedMesh(輪郭線なしなので回しても同じ見え方)、起動輪・誘導輪は輪郭線つきの Mesh
    const wheelG = new THREE.CylinderGeometry(1.85, 1.85, 2.4, 12); wheelG.rotateZ(Math.PI / 2);
    const endG = new THREE.CylinderGeometry(R - 0.42, R - 0.42, 2.6, 8); endG.rotateZ(Math.PI / 2);
    const hubG = new THREE.CylinderGeometry(0.9, 0.9, 3.0, 6); hubG.rotateZ(Math.PI / 2);
    const wheels = [], roadPos = [];
    const roadW = new THREE.InstancedMesh(wheelG, M.light, 12), roadH = new THREE.InstancedMesh(hubG, M.dark, 12); body.add(roadW, roadH);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) roadPos.push([sx * TRACK_X, 2.25, -12.4 + i * 4.95]);
      for (const c of [B, F]) wheels.push(add(endG, M.dark, { x: sx * TRACK_X, y: c.y, z: c.x }));
    }
    let wheelRot = 0;
    const layWheels = () => {
      q.setFromEuler(e.set(wheelRot, 0, 0));
      roadPos.forEach(([x, y, z], i) => { mt.compose(v.set(x, y, z), q, one); roadW.setMatrixAt(i, mt); roadH.setMatrixAt(i, mt); });
      roadW.instanceMatrix.needsUpdate = roadH.instanceMatrix.needsUpdate = true;
    };
    layWheels();

    // ── 車体: 履帯の間の下部車体 + 履帯を覆う低い上部(ステルス艦の面構成) ──
    add(U.loft(THREE, [
      { z: -16.4, pts: U.sym([[7.9, 1.5], [7.9, 4.4]]) },
      { z: 15.2, pts: U.sym([[7.9, 1.5], [7.9, 4.4]]) },
      { z: 19.0, pts: U.sym([[6.4, 3.4], [7.4, 4.6]]) },
    ]), M.hull2);
    const HULL = [
      { z: -19.6, pts: U.sym([[10.4, 4.3], [10.9, 5.0], [6.6, 6.5]]) },
      { z: -17.4, pts: U.sym([[12.2, 3.9], [12.6, 5.0], [7.8, 7.3]]) },
      { z: 11.0, pts: U.sym([[12.2, 3.9], [12.6, 5.0], [7.8, 7.3]]) },
      { z: 15.6, pts: U.sym([[12.0, 3.9], [12.4, 5.0], [7.0, 6.9]]) },
      { z: 19.0, pts: U.sym([[11.4, 3.8], [11.7, 4.7], [4.6, 5.7]]) },
      { z: 22.4, pts: U.sym([[3.4, 4.0], [3.6, 4.4], [0.9, 4.7]]) },
    ];
    add(U.loft(THREE, HULL), M.hull);
    // 後部の機関室の低い台(吸気は面一のスリット)
    add(U.loft(THREE, [
      { z: -18.6, pts: U.sym([[6.2, 7.0], [5.2, 7.9]]) },
      { z: -9.0, pts: U.sym([[6.6, 7.2], [5.6, 8.1]]) },
    ]), M.deck);
    for (let k = 0; k < 4; k++) add(box(9.0, 0.12, 0.45), M.dark, { y: 8.12, z: -17.2 + k * 1.6, edges: false });
    // 光る継ぎ目(チーム色): 側面の折れ線に沿って細く、車首の面に沿って斜めに
    // 断面の同じ番号の頂点を順に結んだ折れ線に沿わせるので、車体の折れ目から外れない
    edgeStrip(HULL, 4, 1, 4, body); edgeStrip(HULL, 1, 1, 4, body);

    // ── 砲塔: 低い楔(高さ 3.4)。旋回の軸は車体中央やや後ろ ──
    const turret = new THREE.Group(); turret.position.set(0, 7.3, -3.2); body.add(turret);
    const T = (geo, mat, o = {}) => add(geo, mat, { ...o, parent: o.parent ?? turret });
    const TUR = [
      { z: -9.4, pts: U.sym([[6.4, 0], [6.8, 0.8], [4.6, 3.0]]) },
      { z: 3.6, pts: U.sym([[7.2, 0], [7.6, 0.9], [4.4, 3.4]]) },
      { z: 9.6, pts: U.sym([[4.4, 0.3], [4.6, 1.0], [2.6, 2.7]]) },
    ];
    T(U.loft(THREE, TUR), M.hull);
    edgeStrip(TUR, 4, 0, 2, turret); edgeStrip(TUR, 1, 0, 2, turret);
    // 後部のコンデンサ(主砲の電源)と側面の光る線
    for (const sx of [-1, 1]) {
      T(U.loft(THREE, [{ z: -9.2, pts: [[sx * 2.0, 3.0], [sx * 4.4, 3.0], [sx * 4.0, 3.7], [sx * 2.2, 3.7]] }, { z: -2.0, pts: [[sx * 2.0, 3.2], [sx * 4.3, 3.2], [sx * 3.9, 3.9], [sx * 2.2, 3.9]] }]), M.deck);
    }
    // センサー: 低い台とレンズ
    T(U.loft(THREE, [{ z: -6.4, pts: [[-4.2, 3.2], [-1.8, 3.2], [-2.4, 4.5], [-3.6, 4.5]] }, { z: -3.6, pts: [[-4.2, 3.3], [-1.8, 3.3], [-2.4, 4.6], [-3.6, 4.6]] }]), M.hull2);
    const lensG = new THREE.CylinderGeometry(0.45, 0.45, 0.2, 10); lensG.rotateX(Math.PI / 2);
    T(lensG, M.rail, { x: -3.0, y: 3.95, z: -3.5, edges: false });

    // ── 主砲(レールガン): 平たく縦長の角断面。上下のレールの間が光る。マズルブレーキなし ──
    const gun = new THREE.Group(); gun.position.set(0, 1.9, 8.6); turret.add(gun);
    const GL = 25, GW = 1.1, GH = 2.6, RH = 0.85;   // 砲身の長さ・幅・高さ、レール1本の高さ
    T(U.loft(THREE, [{ z: -1.0, pts: U.sym([[1.5, -1.5], [1.5, 1.5]]) }, { z: 2.6, pts: U.sym([[0.95, -1.45], [0.95, 1.45]]) }]), M.hull2, { parent: gun });   // 付け根(防盾)
    const railG = U.loft(THREE, [
      { z: 2.0, pts: U.sym([[GW / 2, 0], [GW / 2, RH]]) },
      { z: 2.0 + GL - 1.2, pts: U.sym([[GW / 2, 0], [GW / 2, RH]]) },
      { z: 2.0 + GL, pts: U.sym([[GW / 2 - 0.2, 0.12], [GW / 2 - 0.2, RH - 0.2]]) },
    ]);
    T(railG, M.light, { parent: gun, y: GH / 2 - RH });
    T(railG, M.light, { parent: gun, y: -GH / 2 });
    T(box(GW * 0.55, GH - 2 * RH, GL - 0.6), M.rail, { parent: gun, z: 2.0 + (GL - 0.6) / 2, edges: false });   // レールの間の光
    T(box(GW + 0.25, GH + 0.15, 4.6), M.hull, { parent: gun, z: 4.6 });                                         // 付け根側の覆い
    for (let k = 0; k < 3; k++) T(box(GW + 0.15, 0.14, 0.5), M.strip, { parent: gun, z: 11.5 + k * 4.2, y: GH / 2 + 0.05, edges: false });
    const beam = new THREE.Mesh(box(0.5, 0.5, 60), M.beam); beam.position.z = 2.0 + GL + 30; beam.visible = false; gun.add(beam);

    // ── 動き ──
    let moving = false, traverse = false, clock = 0, recoil = 0, charge = 0, beamT = 0, yaw = 0, firing = false;
    function update(dt) {
      clock += dt;
      if (moving) {
        trackS -= dt * 4.2 * 1.85;   // 下側は車体に対して後ろへ(地面に対して止まって見える)。転輪の周速に合わせる
        layTracks();
        wheelRot += dt * 4.2; layWheels();
        for (const w of wheels) w.rotation.x += dt * 4.2;
        body.position.y = Math.abs(Math.sin(clock * 11)) * 0.1;
      } else body.position.y *= 0.8;
      const target = traverse ? Math.sin(clock * 0.6) * 0.9 : 0;
      yaw += (target - yaw) * Math.min(1, dt * 3); turret.rotation.y = yaw;
      // 充電(レールの光が強まる)→ 発射(光の筋と小さな後退)
      if (firing) { charge = Math.min(1, charge + dt / 0.6); if (charge >= 1) { firing = false; recoil = 1; beamT = 0.18; } }
      else charge = Math.max(0, charge - dt * 1.5);
      M.rail.opacity = Math.min(1, 0.45 + 0.55 * charge + 0.08 * Math.sin(clock * 6));
      if (recoil > 0) { recoil = Math.max(0, recoil - dt * 3); gun.position.z = 8.6 - 1.2 * Math.sin(recoil * Math.PI * 0.5); }
      if (beamT > 0) { beamT -= dt; beam.visible = beamT > 0; M.beam.opacity = Math.max(0, beamT / 0.18); beam.scale.x = beam.scale.y = 1 + (0.18 - beamT) * 6; }
    }
    function fire() { if (!firing && charge < 0.05) firing = true; }
    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "stealth";
    function applyPaint() {
      const tc = teamColor.clone();
      if (paint === "stealth") { M.hull.color.set(C.graphite); M.hull2.color.set(C.graphite2); M.deck.color.set(0x343d46); M.strip.color.copy(tc); M.edge.color.set(0x0b1015); }
      else if (paint === "team") { M.hull.color.copy(tc); M.hull2.color.copy(tc).multiplyScalar(0.78); M.deck.color.copy(tc).multiplyScalar(0.7); M.strip.color.set(0xffffff); M.edge.color.set(C.edge); }
      else { M.hull.color.set(C.white); M.hull2.color.set(C.light); M.deck.color.set(0xcfd6dd); M.strip.color.copy(tc); M.edge.color.set(0x3b4752); }
      M.ring.color.copy(tc); M.glow.color.copy(tc);
    }
    function setTeam(c) { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }
    function setPaint(p) { paint = p; applyPaint(); }
    const stats = () => U.stats(group);
    // ベースプレート: 原点(部隊の位置)から見た車体・砲身のいちばん遠い点を囲む半径にする
    function fitPlate() {
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
    // 動かない部品を焼いてまとめる(砲塔・砲・起動輪は別々に。塗りで色が変わる hull / hull2 / deck / strip はマテリアルごと)
    U.bake(THREE, group, { dynamic: [turret, gun, ...wheels], live: [M.hull, M.hull2, M.deck, M.strip], also: [M.strip] });
    return { plateRadius,
      group, update, fire, setTeam, setPaint, stats, parts: { turret, gun, plate },
      setMoving: (b) => (moving = b), setTraverse: (b) => (traverse = b),
      get moving() { return moving; }, get traverse() { return traverse; }, get paint() { return paint; }, get charging() { return firing; },
    };
  }

  (window.DreamAssets ??= {}).tank = tank;
})();
