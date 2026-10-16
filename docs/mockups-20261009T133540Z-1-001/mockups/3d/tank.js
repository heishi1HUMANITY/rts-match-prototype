// 部隊トークン「装甲強襲・装軌案」v2(試作)。レールガン戦車。
// 方向性: 姿勢を低く、ステルス艦のような面構成(側面は上へ行くほど内側に倒れる)、細部の部品は減らし、光る継ぎ目で SF らしさを出す。
// 主砲はマズルブレーキなしの角断面。v3 でレールをむき出しにせず絶縁材で包んだ密閉筐体にし(実在の試作レールガンと同じ)、側面の継ぎ目が充電中だけ光る。発射演出は現実の試射映像に寄せる(砲口のプラズマ炎・火花・弾体の光跡・煙・砂塵)。
// 履帯は1枚ずつの履板(InstancedMesh)が起動輪・誘導輪の周りを回る。
// v3: 戦車らしい装備を足した(ユーザー指摘「もう少し戦車っぽく」)。サイドスカート、泥よけ、操縦手ハッチと潜望鏡、スプラッシュガード、前照灯、
//     排気ルーバー、燃料給油口、車長ハッチと視察窓、砲手照準器、パノラマ照準器、発煙弾発射機、アンテナ、横風センサー、砲塔後部のバスケット、同軸機銃、砲身のクランプ。
//     光らないセンサーは暗いガラス(M.glass)。すべて面に沿わせ、砲塔の掃引範囲(半径約13)には車体上の部品を置かない。隙間は check() で返す。
//
//   const tank = DreamAssets.tank(THREE);
//   scene.add(tank.group); tank.setTeam(0xff6a1a); tank.setPaint("stealth" | "team" | "white"); tank.setFxStyle("stylized" | "real"); tank.fire(); tank.update(dt)
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
      glass: lambert(0x18242e),   // 光らない電子光学の窓(暗いガラス)
      strip: basic(0xff6a1a), rail: basic(C.rail, { transparent: true, opacity: 0.55 }),
      flash: basic(0xfff1d0, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),       // 砲口の閃光の芯(白熱)
      plume: basic(0xff8c2a, { transparent: true, opacity: 0.9, depthWrite: false }),                                          // 砲口から噴き出すプラズマ炎(橙)
      streak: basic(0xffe6b8, { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),       // 弾体の短い光跡
      spark: basic(0xffc060, { transparent: true, opacity: 0.95, depthWrite: false }),                                         // 飛び散る電機子の破片(火花)
      smoke: basic(0x7d838a, { transparent: true, opacity: 0.35, depthWrite: false }),                                         // 発射後の煙
      dust: basic(0xc9bda8, { transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }),                   // 砲口の爆風が巻き上げる砂塵
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
    // 最適化(2026-10-16): 履板 + 滑り止め(外側 0.25。履板の座標では -y が外向き)を 1 つのジオメトリにして頂点色で塗り分け、InstancedMesh 1 つにする(chassis.js と同じ)
    const linkG = U.concat(THREE, [{ geo: box(TRACK_W, 0.4, 0.94).toNonIndexed(), color: M.link.color }, { geo: box(TRACK_W - 0.4, 0.2, 0.34).toNonIndexed().translate(0, -0.25, 0), color: M.linkDark.color }]);
    const links = new THREE.InstancedMesh(linkG, U.vcLambert(THREE), LINKS * 2);
    body.add(links);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    let trackS = [0, 0];   // 左・右の履帯の送り(超信地旋回で左右を逆に回せる)
    const layTracks = () => {
      let k = 0;
      for (const [si, sx] of [[0, -1], [1, 1]]) for (let i = 0; i < LINKS; i++) {
        const p = pathAt(trackS[si] + (i * loopLen) / LINKS);
        q.setFromEuler(e.set(Math.atan2(-p.ty, p.tz), 0, 0));
        mt.compose(v.set(sx * TRACK_X, p.y + p.ny * 0.21, p.z + p.nz * 0.21), q, one); links.setMatrixAt(k, mt);
        k++;
      }
      links.instanceMatrix.needsUpdate = true;
    };
    layTracks();
    // 転輪・起動輪・誘導輪(履帯の内側)。転輪 12 個とハブは InstancedMesh(輪郭線なしなので回しても同じ見え方)、起動輪・誘導輪は輪郭線つきの Mesh
    const wheelG = new THREE.CylinderGeometry(1.85, 1.85, 2.4, 12); wheelG.rotateZ(Math.PI / 2);
    const endG = new THREE.CylinderGeometry(R - 0.42, R - 0.42, 2.6, 8); endG.rotateZ(Math.PI / 2);
    const hubG = new THREE.CylinderGeometry(0.9, 0.9, 3.0, 6); hubG.rotateZ(Math.PI / 2);
    // 転輪とハブは 1 つの InstancedMesh(頂点色)。起動輪・誘導輪は Group に入れて bake の instanced で 1 つにする(輪郭線は固定。回したら baked.sync())
    const roadG = U.concat(THREE, [{ geo: wheelG.toNonIndexed(), color: M.light.color }, { geo: hubG.toNonIndexed(), color: M.dark.color }]);
    const wheels = [], roadPos = [];
    const roadW = new THREE.InstancedMesh(roadG, U.vcLambert(THREE), 12); body.add(roadW);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 6; i++) roadPos.push([sx * TRACK_X, 2.25, -12.4 + i * 4.95]);
      for (const c of [B, F]) { const g = new THREE.Group(); g.position.set(sx * TRACK_X, c.y, c.x); body.add(g); add(endG, M.dark, { parent: g }); wheels.push(g); }
    }
    let baked = null;
    let wheelRot = [0, 0];   // 左・右
    const layWheels = () => {
      roadPos.forEach(([x, y, z], i) => { q.setFromEuler(e.set(wheelRot[i < 6 ? 0 : 1], 0, 0)); mt.compose(v.set(x, y, z), q, one); roadW.setMatrixAt(i, mt); });
      roadW.instanceMatrix.needsUpdate = true;
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

    // ── 車体の装備(戦車らしい細部)。面に沿わせ、砲塔の掃引範囲には置かない ──
    const cyl = (r, h, n = 10) => new THREE.CylinderGeometry(r, r, h, n);
    // 車体上面の高さと傾き(HULL の上辺): 平ら → 緩い前傾 → 車首の斜面 → 車首の先
    const topY = (z) => z <= 11 ? 7.3 : z <= 15.6 ? 7.3 - 0.4 * (z - 11) / 4.6 : z <= 19 ? 6.9 - 1.2 * (z - 15.6) / 3.4 : 5.7 - 1.0 * (z - 19) / 3.4;
    const topRX = (z) => z <= 11 ? 0 : z <= 15.6 ? Math.atan(0.4 / 4.6) : z <= 19 ? Math.atan(1.2 / 3.4) : Math.atan(1.0 / 3.4);
    const onTop = (geo, mat, x, z, h, o = {}) => add(geo, mat, { x, z, y: topY(z) + h / 2 - 0.08, rx: topRX(z), ...o });   // 面に 0.08 沈めて置く
    const SKIRT_X = 12.2, SKIRTS = [[-16.2, -10.8], [-10.4, -4.6], [-4.2, 1.6], [2.0, 7.8], [8.2, 14.6]];
    const FLAP_Z = { rear: -19.75, front: 18.4 };
    for (const sx of [-1, 1]) {
      // サイドスカート: 上部車体の下縁(y 3.9)から下がる分割装甲板。いちばん前の 1 枚は厚い。板の間は少し空ける
      SKIRTS.forEach(([z0, z1], i) => {
        const t = i === SKIRTS.length - 1 ? 0.7 : 0.4;
        add(box(t, 1.5, z1 - z0), M.hull2, { x: sx * (SKIRT_X + t / 2), y: 3.15, z: (z0 + z1) / 2 });   // 車体より少し明るい色で板の分かれ目を見せる
      });
      // 泥よけ: 履帯の前後端の外に垂れるゴム板(車体の下縁より下)
      add(box(3.6, 2.0, 0.3), M.dark, { x: sx * TRACK_X, y: 3.2, z: FLAP_Z.rear });
      add(box(3.6, 1.9, 0.3), M.dark, { x: sx * TRACK_X, y: 2.85, z: FLAP_Z.front });
      // 前照灯: 車首の斜面に沈めた箱と暗いガラス
      onTop(box(1.3, 0.55, 0.9), M.dark, sx * 4.6, 17.8, 0.55);
      onTop(box(1.0, 0.36, 0.5), M.glass, sx * 4.6, 17.8 + 0.45, 0.40, { edges: false });
      // スプラッシュガード: 車首の斜面に V 字(頂点が前)
      onTop(box(3.6, 0.35, 0.22), M.hull2, sx * 1.6, 17.15, 0.35, { ry: sx * 0.45 });
      // 後面の排気ルーバー(暗い箱と明るい羽根 2 枚)
      add(box(2.6, 0.55, 0.3), M.dark, { x: sx * 7.6, y: 4.65, z: -19.7 });
      for (const y of [4.55, 4.75]) add(box(2.4, 0.07, 0.1), M.light, { x: sx * 7.6, y, z: -19.88, edges: false });
      // 機関室の燃料給油口(砲塔バスケットの掃引範囲の下。高さは check で確かめる)
      add(cyl(0.55, 0.14, 8), M.dark, { x: sx * 4.0, y: deckTop(-10.0) + 0.07 - 0.03, z: -10.0 });
      // 機関室ハッチの縦の継ぎ目
      add(box(0.14, 0.12, 7.3), M.dark, { x: sx * 4.9, y: deckTop(-14.65) + 0.0, z: -14.65, rx: -Math.atan(0.2 / 9.6), edges: false });
    }
    add(box(9.94, 0.12, 0.14), M.dark, { y: deckTop(-11.0), z: -11.0, edges: false });   // 継ぎ目(横)
    // 操縦手: ハッチ(八角形の平板)とその前の潜望鏡 3 つ
    onTop(cyl(1.5, 0.22, 8), M.hull2, 0, 12.6, 0.22, { ry: Math.PI / 8 });
    for (const x of [-1.3, 0, 1.3]) onTop(box(1.0, 0.5, 0.5), M.glass, x, 14.6, 0.5, { edges: false });
    function deckTop(z) { return 7.9 + 0.2 * (z + 18.6) / 9.6; }   // 機関室の台の上面(z -18.6 で 7.9 → z -9.0 で 8.1)

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
    // 後部のコンデンサ(主砲の電源)。内側の縁を x 2.6 まで下げ、間に車長ハッチを置く
    for (const sx of [-1, 1]) {
      T(U.loft(THREE, [{ z: -9.2, pts: [[sx * 2.6, 3.0], [sx * 4.4, 3.0], [sx * 4.0, 3.7], [sx * 2.8, 3.7]] }, { z: -2.0, pts: [[sx * 2.6, 3.2], [sx * 4.3, 3.2], [sx * 3.9, 3.9], [sx * 2.8, 3.9]] }]), M.deck);
    }
    const capTop = (z) => 3.7 + 0.2 * (z + 9.2) / 7.2;   // コンデンサの上面
    const roofY = (z) => z <= 3.6 ? 3.0 + 0.4 * (z + 9.4) / 13 : 3.4 - 0.7 * (z - 3.6) / 6;   // 砲塔の屋根の高さ(|x| が小さい所)
    const roofRX = (z) => z <= 3.6 ? -Math.atan(0.4 / 13) : Math.atan(0.7 / 6);   // 屋根は後ろから前へ上り、前端で下る
    const onRoof = (geo, mat, x, z, h, o = {}) => T(geo, mat, { x, z, y: roofY(z) + h / 2 - 0.08, rx: roofRX(z), ...o });

    // ── 砲塔の装備 ──
    // 車長ハッチ(八角形)と、その前半分を囲む視察窓(暗いガラス)
    const HATCH = { x: 1.0, z: -6.0, r: 1.4 };
    onRoof(cyl(HATCH.r, 0.22, 8), M.hull2, HATCH.x, HATCH.z, 0.22, { ry: Math.PI / 8 });
    for (const a of [-0.9, -0.3, 0.3, 0.9]) onRoof(box(0.5, 0.35, 0.3), M.glass, HATCH.x + 1.65 * Math.sin(a), HATCH.z + 1.65 * Math.cos(a), 0.35, { ry: -a, edges: false });
    // 砲手照準器: 屋根の右前の箱。前面に暗いガラスの窓
    onRoof(box(1.6, 1.0, 1.7), M.hull2, 2.6, 1.4, 1.0);
    onRoof(box(1.1, 0.45, 0.24), M.glass, 2.6, 1.4 + 0.85 + 0.06, 0.6 + 0.45, { edges: false });
    // パノラマ照準器(車長用): 左のコンデンサの上に台と頭部。前面に暗いガラスの窓
    const PANO = { x: -3.5, z: -5.0 };
    T(box(1.5, 0.5, 1.5), M.hull2, { x: PANO.x, y: capTop(PANO.z) + 0.25 - 0.05, z: PANO.z });
    T(box(1.7, 1.2, 1.9), M.hull2, { x: PANO.x, y: capTop(PANO.z) + 0.45 + 0.6, z: PANO.z });
    T(box(1.2, 0.6, 0.24), M.glass, { x: PANO.x, y: capTop(PANO.z) + 0.45 + 0.7, z: PANO.z + 0.95 + 0.06, edges: false });
    // 発煙弾発射機: 砲塔前部の斜面に台を貼り、4 本の筒を前・外・上へ向ける
    for (const sx of [-1, 1]) {
      const t = (1.0 + 9.4) / 13;   // z = 1.0 での斜面(断面 -9.4 と 3.6 の間)
      const lo = [6.8 + 0.8 * t, 0.8 + 0.1 * t], hi = [4.6 - 0.2 * t, 3.0 + 0.4 * t];
      const d = [hi[0] - lo[0], hi[1] - lo[1]], L = Math.hypot(...d), n = [d[1] / L, -d[0] / L];   // 面の向きと外向き法線(+x 側)
      const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], ang = Math.atan2(n[1], n[0]);
      T(box(0.5, 1.6, 2.0), M.hull2, { x: sx * (mid[0] + n[0] * 0.2), y: mid[1] + n[1] * 0.2, z: 1.0, rz: sx * ang });
      const dir = new THREE.Vector3(sx * 0.55, 0.45, 0.7).normalize(), up = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < 4; k++) {
        const base = new THREE.Vector3(sx * (mid[0] + n[0] * 0.45), mid[1] + n[1] * 0.45, 0.25 + k * 0.5);
        const m = T(cyl(0.28, 1.5, 8), M.dark, { edges: false });
        m.position.copy(base).addScaledVector(dir, 0.6); m.quaternion.setFromUnitVectors(up, dir);
      }
    }
    // アンテナ(後部の両角、固定の鞭型。少し後ろへ寝かせる)と横風センサー(後部中央の細い柱)
    for (const sx of [-1, 1]) {
      const bz = -8.4, by = capTop(bz) + 0.25 - 0.03, rake = -0.15;
      T(cyl(0.35, 0.5, 8), M.dark, { x: sx * 3.6, y: by, z: bz });
      T(cyl(0.08, 4.5, 6), M.dark, { x: sx * 3.6, y: by + 0.25 + 2.25 * Math.cos(rake), z: bz + 2.25 * Math.sin(rake), rx: rake, edges: false });
    }
    T(cyl(0.1, 2.2, 6), M.dark, { y: roofY(-8.6) + 1.1 - 0.05, z: -8.6, edges: false });
    T(box(0.5, 0.3, 0.5), M.dark, { y: roofY(-8.6) + 2.2, z: -8.6, edges: false });
    // 砲塔後部のバスケット: 細い枠と網の床。中に幌の巻き物と収納箱。床は機関室の台より高くする(check)
    const RACK = { y0: 1.3, y1: 2.5, z0: -9.4, z1: -11.8, hx: 4.9, bar: 0.18 };   // 上の枠は砲塔後面の幅(y 2.5 で x ±5.1)に収める
    {
      const r = RACK, bar = (w, h, d, x, y, z) => T(box(w, h, d), M.dark, { x, y, z, edges: false });
      for (const sx of [-1, 1]) for (const y of [r.y0, r.y1]) bar(r.bar, r.bar, r.z0 - r.z1, sx * r.hx, y, (r.z0 + r.z1) / 2);
      for (const y of [r.y0, (r.y0 + r.y1) / 2, r.y1]) bar(2 * r.hx + r.bar, r.bar, r.bar, 0, y, r.z1);
      for (const sx of [-1, 1]) bar(r.bar, r.y1 - r.y0, r.bar, sx * r.hx, (r.y0 + r.y1) / 2, r.z1);
      T(box(2 * r.hx, 0.08, r.z0 - r.z1 - 0.2), M.dark, { y: r.y0, z: (r.z0 + r.z1) / 2 + 0.1, edges: false });
      T(cyl(0.7, 4.6, 10), M.light, { x: -2.4, y: r.y0 + 0.04 + 0.7, z: -10.7, rz: Math.PI / 2 });          // 幌の巻き物
      for (const x of [1.0, 3.2]) T(box(2.0, 1.2, 1.6), M.hull2, { x, y: r.y0 + 0.04 + 0.6, z: -10.7 });   // 収納箱
    }

    // ── 主砲(レールガン): 平たく縦長の角断面。上下のレールの間が光る。マズルブレーキなし ──
    const gun = new THREE.Group(); gun.position.set(0, 1.9, 8.6); turret.add(gun);
    const GL = 25, GW = 1.5, GH = 2.2;   // 砲身の長さ・幅・高さ(角断面の密閉筐体。レールは中にあり外からは見えない)
    const cylZ = (r, h, n = 10) => { const g = cyl(r, h, n); g.rotateX(Math.PI / 2); return g; };
    T(U.loft(THREE, [{ z: -1.0, pts: U.sym([[1.9, -1.7], [1.9, 1.7]]) }, { z: 2.6, pts: U.sym([[1.3, -1.5], [1.3, 1.5]]) }]), M.hull2, { parent: gun });   // 付け根(防盾)
    // 砲身: 絶縁材と拘束材で包んだ角断面の筐体(実在の試作レールガンと同じ)。砲口へ向けてわずかに細くなる
    // 筒の先端は口金の中(0.3 手前)で終える。口金の前面と同じ平面に筒の端面があると、別メッシュどうしで深度の取り合いになり先端がちらつく(ユーザー指摘 2026-10-16)
    T(U.loft(THREE, [{ z: 2.0, pts: U.sym([[GW / 2, -GH / 2], [GW / 2, GH / 2]]) }, { z: 2.0 + GL - 0.3, pts: U.sym([[GW / 2 - 0.1, -GH / 2 + 0.15], [GW / 2 - 0.1, GH / 2 - 0.15]]) }]), M.hull2, { parent: gun });
    // 側面の継ぎ目(レールの高さ)。待機中は暗く、充電中と発射直後だけ光る
    // 帯は筐体の面に 0.06 沈め 0.1 はみ出させる(面と同一面だと深度の取り合いでちらつく)。幅 0.16 × 高さ 0.24: ゲーム視点で 1 画素未満だと点滅して見えるので、以前の 0.1 × 0.16 から太くした
    T(U.merge(THREE, [-1, 1].map((sx) => [box(0.16, 0.24, GL - 1.9), { x: sx * (GW / 2 - 0.04), z: 2.0 + GL / 2 + 0.2, ry: -sx * Math.atan(0.1 / GL) }])), M.rail, { parent: gun, edges: false });
    for (let k = 0; k < 6; k++) T(box(GW + 0.34, GH + 0.34, 0.7), M.dark, { parent: gun, z: 7.0 + k * 3.6 });   // 拘束クランプ(等間隔の帯)
    T(box(GW + 0.1, GH + 0.1, 0.9), M.light, { parent: gun, z: 2.0 + GL - 0.45 });                               // 砲口の口金
    T(box(0.46, 0.9, 0.3), M.glass, { parent: gun, z: 2.0 + GL - 0.07, edges: false });                           // 長方形の砲口(レールガンの砲腔は角)。口金に埋めて面から 0.08 出す(以前は 0.23 浮いていた)
    T(box(GW + 1.0, GH + 1.0, 4.6), M.hull, { parent: gun, z: 4.6 });                                            // 尾部の筐体(給電部)
    for (const sx of [-1, 1]) T(cylZ(0.26, 4.5, 8), M.dark, { parent: gun, x: sx * (GW / 2 + 0.76), y: 0.3, z: 1.75, edges: false });   // 砲塔から尾部へ入る給電導管
    T(box(0.5, 0.3, 0.6), M.dark, { parent: gun, z: 2.0 + GL - 1.4, y: GH / 2 + 0.2, edges: false });            // 砲口の基準センサー
    const coaxG = cyl(0.22, 3.2, 8); coaxG.rotateX(Math.PI / 2);
    T(coaxG, M.dark, { x: 2.2, y: 2.2, z: 10.6, edges: false });                                                       // 同軸機銃(砲塔前面から、主砲の右)
    // ── 発射演出(現実のレールガン試射に寄せる: 砲口のプラズマ炎と火花、極超音速弾の短い光跡、煙と砂塵。長い光条や収束リングは出さない) ──
    // すべて非表示で作り、撃ったときだけ出す。焼かれず、見えている間だけ描画される
    const MZ = 2.0 + GL;   // 砲口の z(砲の座標)
    const fx = new THREE.Group(); fx.position.z = MZ; fx.visible = false; gun.add(fx);
    const sphereG = new THREE.SphereGeometry(1, 10, 8);
    const flash = new THREE.Mesh(sphereG, M.flash); fx.add(flash);                                                      // 閃光の芯
    const PLUMES = 6, plumes = new THREE.InstancedMesh(sphereG, M.plume, PLUMES); fx.add(plumes);                       // 炎の塊(前へ噴き出し、少し横へ広がる)
    const streak = new THREE.Mesh(box(0.35, 0.35, 14), M.streak); fx.add(streak);                                        // 弾体の光跡(極超音速で一瞬)
    const SPARKS = 28, sparks = new THREE.InstancedMesh(box(0.2, 0.2, 0.9), M.spark, SPARKS); fx.add(sparks);
    const rngFx = U.rng(11);
    const cone = (spread, s0, s1) => { const a = rngFx() * Math.PI * 2, t = rngFx() * spread, sp = s0 + rngFx() * (s1 - s0); return new THREE.Vector3(Math.cos(a) * t, Math.sin(a) * t, 1).normalize().multiplyScalar(sp); };
    const plumeDir = Array.from({ length: PLUMES }, () => cone(0.6, 28, 60)), sparkDir = Array.from({ length: SPARKS }, () => cone(0.45, 40, 95));
    // 煙と砂塵は車体の座標に置く(砲塔が回っても、出た場所に残る)。撃った瞬間に砲口の位置・向きを写す
    const SMOKES = 8, smokeDir = Array.from({ length: SMOKES }, () => cone(0.9, 6, 14));
    const smokeG = new THREE.Group(); smokeG.visible = false; body.add(smokeG);
    const smokes = new THREE.InstancedMesh(sphereG, M.smoke, SMOKES); smokeG.add(smokes);
    const dust = new THREE.Mesh(new THREE.RingGeometry(0.45, 1.0, 40), M.dust); dust.rotation.x = -Math.PI / 2; dust.visible = false; body.add(dust);
    const relM = new THREE.Matrix4(), sc = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1), tmpQ = new THREE.Quaternion();
    const place = (i, inst, pos, scale) => { mt.compose(pos, q.identity(), sc.setScalar(Math.max(0.001, scale))); inst.setMatrixAt(i, mt); };

    // ── 発射演出のリアル版(2026-10-16、ユーザー「限りなくリアルに寄せられるか」。上のデフォルメ版は残し、setFxStyle("real") で切り替える) ──
    // 実写の砲撃・レールガン試射映像の構成をそのまま置く: 2〜3 フレームの白熱の閃光と、その光が車体を照らす点光源 / 砲口から前へ伸びて膨らむ火球(燃える推進ガスとプラズマ。不透明で、
    // 先端ほど橙 → 煤けた暗赤) / 尾を引いて落ち、地面で跳ねる火花 / 砲口に残る細い煙 / 前へ流れて膨らみ、数秒かけて薄れる灰色の煙 / 砲口の爆風が前方の地面から巻き上げる砂塵。
    // 粒は Canvas 生成のやわらかい絵(U.puffTexture / U.glowTexture)を貼ったビルボード(U.billboards。1 列 = 1 描画呼び出し)。加算合成は閃光の芯だけ(明るい盤面では白く飛ぶ)。ゲームのカメラ(仰角 55°)から見ても形が崩れない。
    const RF = {   // 調整用の数値(秒、車体の単位 = 表示倍率 2.0 の前)
      flash: 0.08, light: 0.14, ball: 0.34, sparks: 1.1, smoke: 4.2, dust: 3.0, wisp: 2.0,                        // 各要素の長さ
      ballSpeed: 60, ballSize: 6, smokeSpeed: 30, smokeSpread: 0.5, smokeDrag: 1.6, smokeRise: 3.0, dustSpeed: 36, dustDrag: 1.6,
      sparkSpeed: [45, 100], sparkSpread: 0.5, gravity: 60, sparkDrag: 1.4, bounce: 0.3, lightPower: 120000,   // 点光源は物理単位(cd)。暗い車体なので大きい値が要る
    };
    // 粒と光は共通のエミッタ U.muzzleFx(common.js)に任せる(2026-10-16、全戦闘アセットに広げたときに共通化)。数値は RF から渡す
    const realFx = U.muzzleFx(THREE, body, { ground: 0.3, seed: 23,
      flash: { len: RF.flash, size: [8, 20], tongue: { len: [16, 26], width: [4, 6], side: 0 } }, light: { len: RF.light, power: RF.lightPower, z: 5 },   // レールガン: 長い舌(プラズマ)
      balls: { per: 8, len: RF.ball, size: RF.ballSize, speed: RF.ballSpeed, length: 10 },
      smoke: { per: 30, len: [RF.smoke * 0.6, RF.smoke], speed: RF.smokeSpeed, spread: RF.smokeSpread, drag: RF.smokeDrag, rise: RF.smokeRise, size: [2, 4], grow: [14, 24], peak: 0.4 },
      wisps: { per: 5, len: [RF.wisp * 0.7, RF.wisp] },
      dust: { per: 24, len: [RF.dust * 0.6, RF.dust], speed: RF.dustSpeed, drag: RF.dustDrag, size: [3, 4.5], grow: 22, peak: 0.65, ahead: 4, angle: 1.2 },
      sparks: { per: 56, len: RF.sparks, speed: RF.sparkSpeed, spread: RF.sparkSpread, gravity: RF.gravity, drag: RF.sparkDrag, bounce: RF.bounce } });
    const realFire = () => realFx.fire(fx);   // fx = 砲口に置いた Group(+z が撃つ向き)
    const realUpdate = (dt) => realFx.update(dt);
    let fxStyle = opts.fxStyle ?? "stylized";   // "stylized"(既定のデフォルメ版)| "real"
    function setFxStyle(s) { fxStyle = s === "real" ? "real" : "stylized"; }

    // ── 動き ──
    let moving = false, traverse = false, clock = 0, recoil = 0, charge = 0, yaw = 0, firing = false, fxT = 0, rock = 0, speedK = 1, speedL = null, speedR = null;
    const FX_LEN = 1.6, SMOKE_LEN = 1.6, FLASH_LEN = 0.16, PLUME_LEN = 0.3, STREAK_LEN = 0.22, SPARK_LEN = 0.7, DUST_LEN = 1.0;   // 演出の長さ(秒)
    const railColor = new THREE.Color(C.rail), hotColor = new THREE.Color(0xffb070);   // レールの余熱(アークで熱くなる)
    function update(dt) {
      clock += dt;
      if (moving) {
        const ks = [speedL ?? speedK, speedR ?? speedK];   // 左・右の送り(1 = 既定。負は後ろ向き)
        for (const si of [0, 1]) { trackS[si] -= dt * 4.2 * 1.85 * ks[si]; wheelRot[si] += dt * 4.2 * ks[si]; }   // 下側は車体に対して後ろへ(地面に対して止まって見える)。転輪の周速に合わせる
        layTracks(); layWheels();
        wheels.forEach((w, i) => { w.rotation.x += dt * 4.2 * ks[i < 2 ? 0 : 1]; }); baked?.sync();
        body.position.y = Math.abs(Math.sin(clock * 11)) * 0.1 * Math.min(1, Math.max(Math.abs(ks[0]), Math.abs(ks[1])));
      } else body.position.y *= 0.8;
      const target = traverse ? Math.sin(clock * 0.6) * 0.9 : 0;
      yaw += (target - yaw) * Math.min(1, dt * 3); turret.rotation.y = yaw;
      // 充電(レールの光が強まる)→ 発射(光の筋と小さな後退)
      // 充電: コンデンサに溜める間、レールの間の光がわずかに強まる(目に見える演出はこれだけ) → 発射: 砲口のプラズマ炎・火花・弾体の光跡・煙・砂塵・後退と車体の揺れ
      if (firing) {
        charge = Math.min(1, charge + dt / 0.6);
        if (charge >= 1) {
          firing = false; recoil = 1; rock = 1; fxT = FX_LEN;
          relM.copy(body.matrixWorld).invert().multiply(fx.matrixWorld); relM.decompose(smokeG.position, smokeG.quaternion, sc);   // 砲口の位置・向きを車体の座標で写す
          dust.position.set(smokeG.position.x, 0.32, smokeG.position.z);
          if (fxStyle === "real") realFire();
        }
      } else charge = Math.max(0, charge - dt * 1.5);
      const since = fxT > 0 ? FX_LEN - fxT : Infinity;   // 発射からの経過(秒)
      const heat = Math.max(0, 1 - since / 0.5);         // レールの余熱(1 → 0)
      M.rail.opacity = Math.min(1, 0.12 + 0.7 * charge + 0.55 * heat);   // 待機中は暗い継ぎ目
      M.rail.color.copy(railColor).lerp(hotColor, heat);
      const styl = fxStyle === "stylized";   // デフォルメ版の部品はリアル版のときは出さない
      fx.visible = styl && since < Math.max(PLUME_LEN, STREAK_LEN, SPARK_LEN);
      if (fx.visible) {
        // 閃光の芯: 一瞬で膨らんで消える
        const f = Math.max(0, 1 - since / FLASH_LEN); flash.visible = f > 0; M.flash.opacity = f; flash.scale.setScalar(1.2 + (1 - f) * 2.4);
        // プラズマ炎: 橙の塊が前へ噴き出しながら膨らみ、薄れる
        const pu = Math.min(1, since / PLUME_LEN); plumes.visible = pu < 1; M.plume.opacity = 0.9 * (1 - pu) * (1 - pu);
        for (let i = 0; i < PLUMES; i++) place(i, plumes, v.copy(plumeDir[i]).multiplyScalar(since).setZ(1.5 + plumeDir[i].z * since * 0.5), 0.9 + pu * 3.2 + i * 0.15);
        plumes.instanceMatrix.needsUpdate = true;
        // 弾体の光跡: 極超音速で遠ざかり、すぐ見えなくなる(実際より遅い 300/秒。本物の速さでは 1 フレームも映らない)
        const su = Math.min(1, since / STREAK_LEN); streak.visible = su < 1; M.streak.opacity = 0.9 * (1 - su); streak.position.z = 8 + since * 300; streak.scale.z = 1 + su * 2;
        // 火花: 電機子の破片。前方の円錐に飛び、重力で落ち、冷えて暗い橙になりながら縮む
        const ku = Math.min(1, since / SPARK_LEN); sparks.visible = ku < 1; M.spark.color.setHex(0xffe0a0).lerp(new THREE.Color(0xff5a1a), ku);
        for (let i = 0; i < SPARKS; i++) {
          const d = sparkDir[i]; v.set(d.x * since, d.y * since - 38 * since * since, d.z * since);
          mt.compose(v, tmpQ.setFromUnitVectors(zAxis, sc.copy(d).normalize()), sc.setScalar(Math.max(0.001, 1 - ku * 0.8))); sparks.setMatrixAt(i, mt);
        }
        sparks.instanceMatrix.needsUpdate = true;
        fxT = Math.max(0, fxT - dt);
      } else if (fxT > 0) fxT = Math.max(0, fxT - dt);
      // 煙: 炎のあとに残り、前へ流れながら膨らんで薄れる(1.6 秒)
      const mu = since / SMOKE_LEN; smokeG.visible = styl && since >= 0.08 && mu < 1;
      if (smokeG.visible) {
        M.smoke.opacity = 0.38 * (1 - mu) * (1 - 0.5 * mu);
        for (let i = 0; i < SMOKES; i++) { const d = smokeDir[i], t = since - 0.08; place(i, smokes, v.set(d.x * t, d.y * t + 2.5 * t, 2 + d.z * t), 1.2 + t * 4.5 + i * 0.1); }
        smokes.instanceMatrix.needsUpdate = true;
      }
      // 砂塵: 砲口の爆風が真下の地面から広がる(1.0 秒)
      const du = since / DUST_LEN; dust.visible = styl && du < 1;
      realUpdate(dt);   // リアル版(待機中は何もしない)
      if (dust.visible) { dust.scale.setScalar(2.5 + du * 16); M.dust.opacity = 0.4 * (1 - du) * (1 - du); }
      if (recoil > 0) { recoil = Math.max(0, recoil - dt * 2.4); gun.position.z = 8.6 - 1.8 * Math.sin(recoil * Math.PI * 0.5); }
      // 車体の揺れ: 反動で車首がわずかに上がり、減衰しながら戻る(サスペンション)
      if (rock > 0) { rock = Math.max(0, rock - dt * 1.6); body.rotation.x = -0.025 * rock * Math.sin((1 - rock) * Math.PI * 2.5) * Math.exp(-(1 - rock) * 2); }
      else body.rotation.x = 0;
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
    // 隙間の確認値(すべて正なら貫通なし)。砲塔は ±0.9rad 旋回するので、バスケットが機関室の台・給油口の上を通る
    function check() {
      const rackBottom = turret.position.y + RACK.y0 - RACK.bar / 2;
      const trackRear = B.x - R - 0.46 - 0.17, trackFront = F.x + R + 0.46 + 0.17;   // 履板の滑り止めまで含めた端
      return {
        rackOverDeck: +(rackBottom - deckTop(-9.0)).toFixed(2),
        rackOverFuelCap: +(rackBottom - (deckTop(-10.0) + 0.11)).toFixed(2),
        rearFlapToTrack: +(trackRear - (FLAP_Z.rear + 0.15)).toFixed(2),
        frontFlapToTrack: +((FLAP_Z.front - 0.15) - trackFront).toFixed(2),
        skirtToTrack: +(SKIRT_X - (TRACK_X + TRACK_W / 2)).toFixed(2),
        turretSweepToDriverHatch: +(Math.hypot(0, 12.6 - 1.5 - turret.position.z) - Math.hypot(RACK.hx, RACK.z1)).toFixed(2),
        gunOverPeriscopes: +((turret.position.y + 1.9 - GH / 2) - (topY(14.6) + 0.5 - 0.08)).toFixed(2),
      };
    }
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
    baked = U.bake(THREE, group, { dynamic: [turret, gun], live: [M.hull, M.hull2, M.deck, M.strip], also: [M.strip], instanced: [{ groups: wheels, staticEdges: true }] });   // 足回り 12 → 3 描画呼び出し
    return { plateRadius, check,
      group, update, fire, setTeam, setPaint, setFxStyle, stats, parts: { turret, gun, plate },
      setMoving: (b) => (moving = b), setTraverse: (b) => (traverse = b), setSpeed: (k) => { speedK = k; speedL = speedR = null; }, setTrackSpeeds: (l, r) => { speedL = l; speedR = r; },   // 履帯と転輪の回る速さ(移動線の試作が速度に合わせて呼ぶ)。setTrackSpeeds は左右別(超信地旋回)
      get moving() { return moving; }, get traverse() { return traverse; }, get paint() { return paint; }, get charging() { return firing; }, get fxStyle() { return fxStyle; },
    };
  }

  (window.DreamAssets ??= {}).tank = tank;
})();
