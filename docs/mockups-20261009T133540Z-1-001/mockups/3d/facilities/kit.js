// 戦略施設トークン(mockups/3d/facilities/)の共通部品。common.js の DreamAssets.util の上に、施設に多い形と登録の仕組みを足す。
//
// 決まりごと(maeslant.js のレビューで決まったこと。全施設で守る):
//  - 平面の配置は実寸の比率で組む(1 施設の中では一様の縮尺 K。寸法はメートルで書き、world グループを K 倍する)
//  - 象徴的な部分(施設リストの「モデルの決め手」)は高さ・太さ・大きさを誇張してよい。何を何倍にしたかを info とメモに書く
//  - 実寸にすると違和感があるほど小さくなる物(車両・人・小さな機械・機関車など)は省略する
//  - 細かさは部隊アセット(tank.js など)並み。既存の拠点(plant.js など)のような抽象化はしない
//  - 見え方は建築模型: 白・明灰・暗の Lambert と輪郭線。陸は少し暗い灰(land)にして白い構造物を浮かせる。チーム色(accent)はアクセントだけ
//  - 水は U.waterMaterial(共通の水面)。動きは実在の設備の動作として説明できるものだけ。灯の点滅は動作中の回転灯・警告灯だけ、常時の灯は常灯
//  - 近未来化の案(施設リストの列)を入れる。状態の案(2 状態トークンなど)があれば setState で切り替える
//  - 状態で表示を切り替える Group は bake の dynamic に入れ、bake の前に一度表示して焼き、焼いたあとで隠す(隠したまま焼くと焼き込みから外れ、描画呼び出しが増える)
//
//   const F = DreamAssets.fac, M = F.mats(THREE), k = F.kit(THREE, M, K);
//   k.add(geo, mat, parent, { x, y, z, rx, ry, rz, edges })、k.tube(parent, p, q, r, mat)、k.arcLoft([[r, y], ...], b0, b1, n) など
//   F.register("<key>", { section, title, kind, desc, info, dist, target, tokenAt, make: (THREE) => asset, actLabel, progress, actions, caption, ringParts })
(function () {
  const F = { defs: {} };
  F.P = { land: 0xdde2e7, body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, steel: 0xaeb7c0, dark: 0x3b4752, neutral: 0x8f98a3, amber: 0xffb020, glass: 0x18242e, lamp: 0xfff1c8, red: 0xd8473a, green: 0x2f9a5c, water: 0x1fd3ff };

  // 標準のマテリアル一式。accent はチーム色(setTeam で色を変える。bake の live に入れる)
  F.mats = function (THREE) {
    const U = DreamAssets.util, P = F.P;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    return {
      lambert, basic,
      land: lambert(P.land), body: lambert(P.body), light: lambert(P.light), mid: lambert(P.mid), steel: lambert(P.steel), dark: lambert(P.dark),
      glass: lambert(P.glass), red: lambert(P.red), green: lambert(P.green), accent: lambert(P.neutral),
      lamp: basic(P.lamp), beacon: basic(P.amber), beaconOff: basic(0x6b5a2e),
      waterCut: basic(P.water, { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),   // 水の切り口(台座の端の断面)
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 14, gapSize: 10, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.08, depthWrite: false }),
    };
  };
  // チーム色を変える(accent・制圧圏)。中立は null
  F.setTeam = (M, color) => { const c = color ?? F.P.neutral; M.accent.color.set(c); M.ring.color.set(c); M.disc.color.set(c); };

  // 部品を組む関数一式。K = 縮尺(水面の線の大きさを合わせるのに使う)
  F.kit = function (THREE, M, K = 1) {
    const U = DreamAssets.util;
    const add = U.adder(THREE, M.edge, 25);
    const addT = U.adder(THREE, M.edge, 50);   // 管(8 角柱): 側面の折れ目に線を引かず、端の輪だけ
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h, n = 10) => new THREE.CylinderGeometry(r, r, h, n);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const polar = (r, b, y = 0) => V(r * Math.sin(b), y, r * Math.cos(b));   // 角度 b は +z が 0、+x 側が正
    const put = (geo, mat, parent, p, o = {}) => add(geo, mat, parent, { x: p.x, y: p.y, z: p.z, ...o });

    // 原点を中心に、断面 [半径, 高さ](凸形)を角度 b0〜b1 へ回した多面体(円弧の壁・扇形の床・曲がったレール)
    const arcLoft = (prof, b0, b1, n = 24) => {
      const rings = [];
      for (let i = 0; i <= n; i++) { const b = b0 + ((b1 - b0) * i) / n; rings.push(prof.map(([r, y]) => polar(r, b, y))); }
      return closedLoft(rings);
    };
    // 断面の列(同じ頂点数の凸多角形の Vector3 の列)をつないで両端を閉じた多面体。面は区間ごとの中心から外向きにそろえる(曲がった形でもよい)
    const closedLoft = (rings) => {
      const pos = [], N = rings[0].length, n = rings.length - 1, e1 = V(0, 0, 0), e2 = V(0, 0, 0), m = V(0, 0, 0);
      const mean = (pts) => pts.reduce((a, p) => a.add(p), V(0, 0, 0)).multiplyScalar(1 / pts.length);
      const tri = (a, b, c, ctr) => {
        e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
        if (e1.lengthSq() < 1e-12) return;
        m.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(ctr);
        const [p, q] = e1.dot(m) < 0 ? [c, b] : [b, c];
        pos.push(a.x, a.y, a.z, p.x, p.y, p.z, q.x, q.y, q.z);
      };
      for (let i = 0; i < n; i++) {
        const ctr = mean([...rings[i], ...rings[i + 1]]);
        for (let j = 0; j < N; j++) { const a = rings[i][j], b = rings[i][(j + 1) % N], c = rings[i + 1][(j + 1) % N], d = rings[i + 1][j]; tri(a, b, c, ctr); tri(a, c, d, ctr); }
      }
      for (const [ring, nb] of [[rings[0], rings[1]], [rings[n], rings[n - 1]]]) { const ctr = mean(nb); for (let j = 1; j < N - 1; j++) tri(ring[0], ring[j], ring[j + 1], ctr); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return g;
    };
    // 平面の多角形 [[x, z], ...](凹形・穴あり可)を y0〜y1 に押し出した塊(陸・岸壁・建物の平面形)。holes = 多角形の列
    const prism = (pts, y0, y1, holes = []) => {
      // ExtrudeGeometry は外形が時計回りのとき穴の向きを直さないので、外形を反時計回り・穴を時計回りにそろえて渡す(穴の壁が内向きになるのを防ぐ)
      const ring = (p, cw) => { const v = p.map(([x, z]) => new THREE.Vector2(x, -z)); return THREE.ShapeUtils.isClockWise(v) === cw ? v : v.reverse(); };
      const sh = new THREE.Shape(ring(pts, false));
      for (const h of holes) sh.holes.push(new THREE.Path(ring(h, true)));
      const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false });
      g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
      return g;
    };
    // 水面: 多角形 [[x, z], ...] の平らな面(y = 0)。uv は x, z をそのまま使い、共通の水面と同じ線の大きさにする(流れは +z へ)
    const waterShape = (pts, mat) => {
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
      g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) * K) / U.WATER_TILE[0], (-p.getZ(i) * K) / U.WATER_TILE[1]);
      return new THREE.Mesh(g, mat);
    };
    const water = (opts = {}) => { const m = U.waterMaterial(THREE, opts); m.side = THREE.DoubleSide; return m; };
    // 扇形の水面(uv は横断 × 流下)
    const sector = (r0, r1, b0, b1, n = 40) => {
      const pos = [], uv = [], rm = (r0 + r1) / 2;
      for (let i = 0; i < n; i++) {
        const q = [[r0, b0 + ((b1 - b0) * i) / n], [r1, b0 + ((b1 - b0) * i) / n], [r1, b0 + ((b1 - b0) * (i + 1)) / n], [r0, b0 + ((b1 - b0) * (i + 1)) / n]];
        for (const k of [0, 1, 2, 0, 2, 3]) { const [r, b] = q[k], p = polar(r, b); pos.push(p.x, 0, p.z); uv.push(((r - r0) * K) / U.WATER_TILE[0], ((b - b0) * rm * K) / U.WATER_TILE[1]); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      return g;
    };
    // 2 点を結ぶ管(トラス・鉄塔の部材)と角材(梁)。単位長さのジオメトリを伸ばすので輪郭線も共有
    const tubeGeo = new Map(), beamGeo = new Map(), UP = V(0, 1, 0);
    const span = (geo, adder, parent, p, q, mat) => {
      const d = q.clone().sub(p), len = d.length();
      const o = adder(geo, mat, parent, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 });
      o.scale.set(1, len, 1); o.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
      return o;
    };
    const tube = (parent, p, q, r, mat = M.body) => span(tubeGeo.get(r) ?? tubeGeo.set(r, cyl(r, 1, 8)).get(r), addT, parent, p, q, mat);
    const beam = (parent, p, q, w, mat = M.light) => span(beamGeo.get(w) ?? beamGeo.set(w, box(w, 1, w)).get(w), add, parent, p, q, mat);
    // 格子の鉄塔(4 本脚、X の斜材)。下の中心 base、高さ h、下と上の半幅 w0, w1、段数 n
    const lattice = (parent, base, h, w0, w1, n = 4, r = 0.2, mat = M.mid) => {
      const at = (sx, sz, t) => V(base.x + sx * (w0 + (w1 - w0) * t), base.y + h * t, base.z + sz * (w0 + (w1 - w0) * t));
      const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [sx, sz] of C) tube(parent, at(sx, sz, 0), at(sx, sz, 1), r, mat);
      for (let k = 0; k < n; k++) for (let c = 0; c < 4; c++) {
        const [ax, az] = C[c], [bx, bz] = C[(c + 1) % 4], t0 = k / n, t1 = (k + 1) / n;
        tube(parent, at(ax, az, t0), at(bx, bz, t1), r * 0.5, mat); tube(parent, at(bx, bz, t0), at(ax, az, t1), r * 0.5, mat);
      }
    };
    return { add, addT, box, cyl, V, polar, put, arcLoft, closedLoft, prism, waterShape, water, sector, tube, beam, lattice };
  };

  // 台座の足元の暗い帯(上面は台座の最も低い面より下にする)
  F.plinth = (k, M, parent, w, d, yBase, { x = 0, z = 0, h = 1.2 } = {}) => k.add(k.box(w + 6, h, d + 6), M.dark, parent, { x, y: yBase + h / 2, z, edges: false });

  // ビューアへの登録(viewer.html が施設リストの key ごとに <key>.js を読み、登録されたものだけ選べる)
  F.register = (key, def) => { F.defs[key] = { key, ...def }; };

  (window.DreamAssets ??= {}).fac = F;
})();
