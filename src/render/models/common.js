// 3D アセット試作の共通部品(ヘリ・発電所などで使う)。tank.js は先に作ったので同じ処理を中に持っている。
(function () {
  const U = {};

  // 断面の列(z ごとに同じ頂点数の多角形 [x, y])をつないだ多面体。両端はふたを閉じる。凸形を前提に面を外向きにそろえる
  U.loft = function (THREE, sections) {
    const P = sections.map(({ z, pts }) => pts.map(([x, y]) => new THREE.Vector3(x, y, z)));
    const all = P.flat(), center = all.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / all.length);
    const pos = [];
    const tri = (a, b, c) => {
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      if (n.lengthSq() < 1e-10) return;
      const m = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3).sub(center);
      if (n.dot(m) < 0) pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z); else pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    };
    const N = P[0].length;
    for (let i = 0; i < P.length - 1; i++) for (let j = 0; j < N; j++) {
      const a = P[i][j], b = P[i][(j + 1) % N], c = P[i + 1][(j + 1) % N], d = P[i + 1][j];
      tri(a, b, c); tri(a, c, d);
    }
    for (const ring of [P[0], P[P.length - 1]]) for (let j = 1; j < N - 1; j++) tri(ring[0], ring[j], ring[j + 1]);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  };
  // 左右対称の断面を、右半分の点(下から上へ)から作る。並びは [左上 … 左下, 右下 … 右上]
  U.sym = (half) => [...half.map(([x, y]) => [-x, y]).reverse(), ...half];

  // 光る線: 断面列 secs の idx 番目の頂点を from〜to の区間で結び、外側へわずかに浮かせた細い角材を並べる(up: 上へ浮かせる)
  U.edgeStrip = function (THREE, mat, secs, idx, from, to, parent, { w = 0.16, h = 0.2, lift = 0.06, up = false } = {}) {
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (let i = from; i < to; i++) {
      const pt = (sec) => typeof idx === "function" ? idx(sec) : sec.pts[idx];   // idx は頂点番号か、断面から点を返す関数
      const [x1, y1] = pt(secs[i]), [x2, y2] = pt(secs[i + 1]);
      const a = new THREE.Vector3(x1, y1, secs[i].z), b = new THREE.Vector3(x2, y2, secs[i + 1].z);
      const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len + 0.1), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5).add(up ? new THREE.Vector3(0, lift, 0) : new THREE.Vector3(Math.sign(x1 || 1) * lift, 0, 0));
      m.quaternion.setFromUnitVectors(zAxis, dir);
      parent.add(m);
    }
  };

  // 変わらないテクスチャは 1 枚を全インスタンスで共有する(水の流れ線は offset を動かすので共有しない)
  const texCache = new Map();
  const cached = (key, make) => { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); };

  // 種類の記号板(ゲームと同じ切り欠きの黒地に白文字)
  U.signTexture = (THREE, ch) => cached("sign:" + ch, () => {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    g.fillStyle = "#1f2a33"; g.beginPath(); g.moveTo(10, 0); g.lineTo(64, 0); g.lineTo(64, 54); g.lineTo(54, 64); g.lineTo(0, 64); g.lineTo(0, 10); g.fill();
    g.fillStyle = "#fff"; g.font = "700 40px 'Noto Sans JP', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, 32, 35);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });

  // 部品を足す関数を作る(輪郭線つき。同じジオメトリの輪郭線は共有)。作り直すときは add.reset() で輪郭線のキャッシュを捨てる
  U.adder = function (THREE, edgeMat, threshold = 20) {
    const cache = new Map();
    const add = (geo, mat, parent, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, edges = true, s } = {}) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); if (s) m.scale.setScalar(s);
      if (edges) { if (!cache.has(geo)) cache.set(geo, new THREE.EdgesGeometry(geo, threshold)); m.add(new THREE.LineSegments(cache.get(geo), edgeMat)); }
      parent.add(m); return m;
    };
    add.reset = () => { for (const e of cache.values()) e.dispose(); cache.clear(); };
    return add;
  };

  // 警告縞(黒地に黄の斜め縞)。repeat = 横の繰り返し
  U.hazardTexture = (THREE, repeat = 4) => cached("hazard:" + repeat, () => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 16;
    const g = c.getContext("2d");
    g.fillStyle = "#1f2a33"; g.fillRect(0, 0, 64, 16);
    g.fillStyle = "#ffc83d";
    for (let x = -16; x < 80; x += 16) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 8, 16); g.lineTo(x + 16, 0); g.lineTo(x + 8, 0); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(repeat, 1); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  // コンテナの側面: 縦の波板と枠(白地。色はマテリアルで乗せる)
  U.ribTexture = (THREE) => cached("rib", () => {
    const c = document.createElement("canvas"); c.width = 128; c.height = 32; const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, 128, 32);
    g.fillStyle = "rgba(40,55,70,.16)"; for (let x = 6; x < 124; x += 5) g.fillRect(x, 3, 1.6, 26);
    g.strokeStyle = "rgba(40,55,70,.35)"; g.lineWidth = 2; g.strokeRect(1, 1, 126, 30);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  });
  // 発射炎(前 +z へ開く円錐と白い芯)。非表示で作り、撃つ瞬間だけ visible にする
  U.flashAt = function (THREE, add, flashMat, coreMat, parent, z, r) {
    const f = new THREE.Group(); f.position.z = z; parent.add(f); f.visible = false;
    const cone = new THREE.ConeGeometry(r, r * 2.6, 6, 1, true); cone.rotateX(-Math.PI / 2); cone.translate(0, 0, r * 1.3);
    add(cone, flashMat, f, { edges: false }); add(new THREE.SphereGeometry(r * 0.6, 8, 6), coreMat, f, { edges: false });
    return f;
  };
  // 筒から撃つミサイル(本体・X 字の尾翼・モーターの炎・白い煙の尾・発射炎)。対空車両の試作から切り出した部品(いまはどのアセットも使っていない)。
  //   const ms = U.missile(THREE, add, root, { body, fin, flame, trail, flash });   // add は U.adder の戻り値、root は車両の座標(トークンの group)
  //   ms.launch(mouth, quat); ms.update(dt)                                        // mouth = 筒口(root の座標)、quat = 筒の向き(+z が前)
  // 機首を筒口に合わせて置き、押し出しのあとモーターで加速する。尾は筒口から機体の後ろまで伸び、飛び去ったあとは太りながら薄れる。
  // trail と flash のマテリアルは不透明度を書き換えるので、ミサイルごとに別のものを渡す。r は胴の半径(筒の半径より小さく)
  U.missile = function (THREE, add, root, mats, { r = 0.42, len = 5.2, flyLen = 1.2, trailLen = 2.8, flashLen = 0.15 } = {}) {
    const cylZ = (rr, h, n) => new THREE.CylinderGeometry(rr, rr, h, n).rotateX(Math.PI / 2);
    const nose = len / 2 + r * 3.3, tail = len / 2;
    const m = new THREE.Group(); m.visible = false; root.add(m);
    add(cylZ(r, len, 10), mats.body, m, { edges: false });
    add(new THREE.ConeGeometry(r, nose - tail, 10).rotateX(Math.PI / 2), mats.body, m, { z: (nose + tail) / 2, edges: false });
    for (const a of [0, 1]) add(new THREE.BoxGeometry(0.08, r * 3.1, 1.2), mats.fin, m, { z: -tail + 0.6, rz: Math.PI / 4 + a * Math.PI / 2, edges: false });
    add(new THREE.ConeGeometry(r * 0.7, 1.6, 6).rotateX(-Math.PI / 2), mats.flame, m, { z: -tail - 0.8, edges: false });
    const trailG = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); trailG.rotateX(Math.PI / 2); trailG.translate(0, 0, 0.5);
    const trail = new THREE.Mesh(trailG, mats.trail); trail.visible = false; root.add(trail);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mats.flash); flash.visible = false; root.add(flash);
    const mouth = new THREE.Vector3(), dir = new THREE.Vector3();
    let t = 9, tl = 0.01;
    return {
      group: m, trail, flash,
      get flying() { return t < flyLen; },
      launch(p, q) {
        mouth.copy(p); dir.set(0, 0, 1).applyQuaternion(q);
        m.quaternion.copy(q); m.position.copy(mouth).addScaledVector(dir, -nose);
        trail.quaternion.copy(q); trail.position.copy(mouth); flash.position.copy(mouth);
        t = 0; tl = 0.01;
      },
      update(dt) {
        if (t >= trailLen) { m.visible = trail.visible = flash.visible = false; return; }
        t += dt;
        const s = 30 * t + 110 * t * t;   // 押し出し 30、加速 220
        m.visible = t < flyLen;
        if (m.visible) { m.position.copy(mouth).addScaledVector(dir, s - nose); tl = Math.max(0.01, s - nose - tail - 0.8); }
        trail.visible = t < trailLen && tl > 0.05;
        const w = 0.3 + t * 0.45; trail.scale.set(w, w, tl);
        mats.trail.opacity = 0.6 * (t < flyLen ? 1 : Math.max(0, 1 - (t - flyLen) / (trailLen - flyLen)));
        const fu = t / flashLen; flash.visible = fu < 1;
        if (flash.visible) { flash.scale.setScalar(1.2 + fu * 2.4); mats.flash.opacity = 0.9 * (1 - fu); }
      },
    };
  };

  // 変換済み(非インデックス)のジオメトリの列を 1 つにつなぐ。items = [{ geo, color? }]。color を渡すと頂点色(color 属性)も作る。
  // typed array に直接詰める(push(...array) はおよそ 12 万要素で止まる)
  U.concat = function (THREE, items) {
    let n = 0; for (const it of items) n += it.geo.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const col = items.some((it) => it.color) ? new Float32Array(n * 3) : null;
    let o = 0;
    for (const { geo: g, color } of items) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
      if (col) { const { r, g: gg, b } = color ?? { r: 1, g: 1, b: 1 }; for (let i = o; i < o + c; i++) { col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b; } }
      o += c;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    if (col) out.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return out;
  };
  // 同じマテリアルの部品を1つのジオメトリにまとめる(描画呼び出しを減らす)。parts = [[geo, {x, y, z, rx, ry, rz, sx, sy, sz}], ...]
  U.merge = function (THREE, parts) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    return U.concat(THREE, parts.map(([geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}]) => {
      const g = (geo.index ? geo.toNonIndexed() : geo.clone());
      m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
      g.applyMatrix4(m); return { geo: g };
    }));
  };

  // ── 焼き込み: 動かない部品をまとめて描画呼び出しを減らす(見た目は変えない) ──
  // root の下の Mesh のうち「Lambert で、テクスチャなし・不透明」の部品を、所有者(いちばん近い dynamic の先祖。なければ root)ごとにまとめる:
  //   色が固定のもの → 頂点色つき Lambert 1 つ(U.vcLambert)の 1 メッシュ。flatShading の部品は面ごとの法線を焼いて同じ見え方にする
  //   live のマテリアル(チーム色・塗りで色が変わるもの)→ マテリアルごとに 1 メッシュ(マテリアルはそのまま使うので色の変更は効く)
  //   輪郭線(add() が付けた LineSegments)→ 所有者と線のマテリアルごとに 1 本(userData.edges = true)
  // そのまま残すもの: 非表示の部分(発射炎・弾など、あとで表示するもの)、InstancedMesh、Basic(灯・光。also に入れたものは除く)、透明、テクスチャ付き、
  //   dynamic に入れた Mesh、userData.keep の Mesh。焼いた Mesh の下にある残す部品は所有者へ付け替える。
  // instanced: [{ groups: [同じ中身のグループ…], staticEdges }] → 1 つの InstancedMesh(頂点色)にし、グループは空のまま残す。
  //   グループの回転・位置を変えたら update で sync() を呼ぶ。staticEdges は回しても見た目が変わらない輪郭線(タイヤの縁)を所有者の線に焼く。
  U.vcLambert = (THREE) => (U._vc ??= new THREE.MeshLambertMaterial({ vertexColors: true }));
  U.bake = function (THREE, root, { dynamic = [], live = [], also = [], instanced = [] } = {}) {
    if (U.noBake) return { sync() {}, sets: [] };   // 比較用: 焼かずにそのまま(ビューアの切替)
    root.updateMatrixWorld(true);
    const dyn = new Set(dynamic), liveSet = new Set(live), alsoSet = new Set(also), instGroups = new Set(instanced.flatMap((s) => s.groups));
    const vcMat = U.vcLambert(THREE);
    const rel = new THREE.Matrix4(), inv = new THREE.Matrix4(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const flatten = (g) => {   // 面ごとの法線(flatShading と同じ見え方)
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i += 9) {
        a.fromArray(p, i); b.fromArray(p, i + 3).sub(a); c.fromArray(p, i + 6).sub(a); b.cross(c).normalize();
        for (let k = 0; k < 3; k++) b.toArray(n, i + k * 3);
      }
    };
    const prep = (mesh, m) => { const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(); g.applyMatrix4(m); if (mesh.material.flatShading) flatten(g); return g; };
    const bakeable = (m) => m.isMesh && !m.isInstancedMesh && m.visible && !dyn.has(m) && !m.userData.keep && m.material && !Array.isArray(m.material) && !m.material.map && !m.material.transparent && (m.material.isMeshLambertMaterial || alsoSet.has(m.material));
    const vcOk = (mat) => mat.isMeshLambertMaterial && !liveSet.has(mat) && mat.side === THREE.FrontSide && mat.opacity === 1 && mat.emissive.getHex() === 0 && !mat.wireframe;
    const ownerOf = (o) => { let p = o.parent; while (p && p !== root) { if (dyn.has(p)) return p; p = p.parent; } return root; };
    const owners = new Map();
    const ownerRec = (o) => owners.get(o) ?? owners.set(o, { buckets: new Map(), edges: new Map() }).get(o);
    const pushEdge = (rec, lineMat, geo) => (rec.edges.get(lineMat) ?? rec.edges.set(lineMat, []).get(lineMat)).push(geo);
    const edgeChildren = (mesh) => mesh.children.filter((ch) => ch.isLineSegments && ch.visible);
    // 1. 焼く部品を集める(非表示の部分と instanced のグループの下は見ない)
    const list = [];
    const walk = (o) => { if (!o.visible || o.isInstancedMesh || instGroups.has(o)) return; if (bakeable(o)) list.push(o); for (const ch of o.children) walk(ch); };
    for (const ch of root.children) walk(ch);
    const baked = new Set(list);
    for (const mesh of list) {
      const owner = ownerOf(mesh), rec = ownerRec(owner);
      inv.copy(owner.matrixWorld).invert(); rel.multiplyMatrices(inv, mesh.matrixWorld);
      const mat = mesh.material, key = vcOk(mat) ? "vc" : mat;
      const bk = rec.buckets.get(key) ?? rec.buckets.set(key, { mat: key === "vc" ? vcMat : mat, items: [] }).get(key);
      bk.items.push({ geo: prep(mesh, rel), color: key === "vc" ? mat.color : null });
      for (const ch of edgeChildren(mesh)) { const g = ch.geometry.clone(); g.applyMatrix4(rel); pushEdge(rec, ch.material, g); }
    }
    // 2. 同じ中身のグループ → InstancedMesh
    const sets = [];
    for (const { groups, staticEdges = false } of instanced) {
      const g0 = groups[0], parent = g0.parent, items = [], edges = [];
      inv.copy(g0.matrixWorld).invert();
      g0.traverse((m) => {
        if (m === g0 || !m.isMesh || m.isInstancedMesh || !m.visible) return;
        rel.multiplyMatrices(inv, m.matrixWorld); items.push({ geo: prep(m, rel), color: m.material.color });
        for (const ch of edgeChildren(m)) { const g = ch.geometry.clone(); g.applyMatrix4(rel); edges.push([ch.material, g]); }
      });
      const inst = new THREE.InstancedMesh(U.concat(THREE, items), vcMat, groups.length); inst.frustumCulled = false; parent.add(inst);
      if (staticEdges && edges.length) {
        const owner = dyn.has(parent) ? parent : ownerOf(parent), rec = ownerRec(owner); inv.copy(owner.matrixWorld).invert();
        for (const g of groups) { rel.multiplyMatrices(inv, g.matrixWorld); for (const [lm, eg] of edges) { const e2 = eg.clone(); e2.applyMatrix4(rel); pushEdge(rec, lm, e2); } }
      }
      for (const g of groups) for (const ch of [...g.children]) { g.remove(ch); ch.traverse((o) => o.geometry?.dispose?.()); }
      sets.push({ inst, groups });
    }
    // 3. まとめたメッシュと輪郭線を所有者に足す
    for (const [owner, rec] of owners) {
      for (const bk of rec.buckets.values()) { const m = new THREE.Mesh(U.concat(THREE, bk.items), bk.mat); m.userData.baked = true; owner.add(m); }
      for (const [lineMat, geos] of rec.edges) {
        let n = 0; for (const g of geos) n += g.attributes.position.count;
        const pos = new Float32Array(n * 3); let o = 0; for (const g of geos) { pos.set(g.attributes.position.array, o * 3); o += g.attributes.position.count; }
        const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const ls = new THREE.LineSegments(lg, lineMat); ls.userData.edges = true; owner.add(ls);
      }
    }
    // 4. 元の部品を外す(残す子は所有者へ付け替える)
    for (const mesh of list) {
      const owner = ownerOf(mesh); inv.copy(owner.matrixWorld).invert();
      for (const ch of [...mesh.children]) {
        if (ch.isLineSegments) { mesh.remove(ch); ch.geometry.dispose(); continue; }
        if (baked.has(ch)) continue;
        rel.multiplyMatrices(inv, ch.matrixWorld); owner.add(ch); rel.decompose(ch.position, ch.quaternion, ch.scale);
      }
      mesh.parent?.remove(mesh); mesh.geometry.dispose();
    }
    const sync = () => { for (const { inst, groups } of sets) { groups.forEach((g, i) => { g.updateMatrix(); inst.setMatrixAt(i, g.matrix); }); inst.instanceMatrix.needsUpdate = true; } };
    sync();
    return { sync, sets };
  };

  // 水面(中央水門・川・港で共通): 半透明のシアンに白い流れの線。線のテクスチャ1枚 = 幅 36 × 長さ 72(表示倍率 1 のとき)
  // 流れは map.offset.y を減らして下流(+v)へ送る。川のように曲がる水面は uv を (横断, 流下) の座標にする
  U.WATER_TILE = [36, 72];
  U.flowTexture = function (THREE) {
    const c = document.createElement("canvas"); c.width = 64; c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#1fd3ff"; g.fillRect(0, 0, 64, 128);
    g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 2;
    for (const [x, y, l] of [[10, 10, 26], [40, 40, 18], [22, 74, 30], [50, 100, 22], [6, 112, 14]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + l); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  U.waterMaterial = (THREE, { opacity = 0.42, repeat = [1, 1] } = {}) => {
    const map = U.flowTexture(THREE); map.repeat.set(...repeat);
    return new THREE.MeshBasicMaterial({ color: 0xffffff, map, transparent: true, opacity, depthWrite: false });
  };

  // 決まった列の乱数(配置を毎回同じにする)
  U.rng = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // 流れる点線: LineDashedMaterial に dashOffset を足す(three r0.170 の LineDashedMaterial には無い)。mat.dashOffset を変えると点線が動く
  U.dashed = function (THREE, params) {
    const mat = new THREE.LineDashedMaterial(params), u = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.dashOffset = u;
      sh.vertexShader = sh.vertexShader.replace("uniform float scale;", "uniform float scale;\nuniform float dashOffset;").replace("vLineDistance = scale * lineDistance;", "vLineDistance = scale * lineDistance + dashOffset;");
    };
    Object.defineProperty(mat, "dashOffset", { get: () => u.value, set: (v) => { u.value = v; } });
    return mat;
  };
  // 制圧圏の点線リングと薄い円盤
  U.zone = function (THREE, group, r, ringMat, discMat) {
    const pts = []; for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0.3, Math.sin(a) * r)); }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat); ring.computeLineDistances(); group.add(ring);
    const dg = new THREE.CircleGeometry(r, 48); dg.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(dg, discMat); disc.position.y = 0.2; group.add(disc);
    return { ring, disc };
  };

  // 角を落とした長方形の板(上面が y = h)。hx, hz = 半分の幅、c = 角の切り欠き
  U.slab = function (THREE, hx, hz, c, h) {
    const s = new THREE.Shape([[-hx + c, -hz], [hx - c, -hz], [hx, -hz + c], [hx, hz - c], [hx - c, hz], [-hx + c, hz], [-hx, hz - c], [-hx, -hz + c]].map(([x, z]) => new THREE.Vector2(x, z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, h, 0);
    return g;
  };

  // 原点から見た水平方向のいちばん遠い頂点までの距離(root 内の見えているメッシュ)
  U.reach = function (THREE, group, root) {
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), p = new THREE.Vector3(), m = new THREE.Matrix4();
    let far = 0;
    root.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
      m.multiplyMatrices(inv, o.matrixWorld);
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { p.fromBufferAttribute(a, i).applyMatrix4(m); far = Math.max(far, Math.hypot(p.x, p.z)); }
    });
    return far;
  };

  U.stats = function (group) {
    let tris = 0, draws = 0, meshes = 0; const mats = new Set();
    group.traverseVisible((o) => {   // 非表示の親の下は数えない
      if (o.isMesh || o.isLine || o.isPoints || o.isSprite) { draws++; mats.add(o.material); }   // スプライト(発射演出のリアル版)も 1 回ずつ数える
      if (o.isMesh) { meshes++; const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; tris += n * (o.isInstancedMesh ? o.count : 1); }
    });
    return { tris: Math.round(tris), draws, meshes, materials: mats.size };
  };

  // 粒子の絵(発射演出のリアル版で共用。2026-10-16): やわらかく不ぞろいな煙の塊と、中心が白熱した光の玉。どちらも白で描き、色はマテリアルで乗せる。
  // スプライトに貼ると板の角が見えず、重ねても境目が出ない。Canvas 生成なので画像ファイルは使わない
  // n = 塊の数、a = 塊 1 つの濃さ(煙は薄く 18 × 0.34、火球は濃く 28 × 0.6)、seed = 配置の乱数
  U.puffTexture = (THREE, { n = 18, a = 0.34, seed = 5 } = {}) => cached(`puff:${n}:${a}:${seed}`, () => {
    const S = 128, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), rnd = U.rng(seed);
    for (let i = 0; i < n; i++) {   // 小さな丸い塊を中心の周りに重ねて、輪郭を不ぞろいにする
      const t = rnd() * Math.PI * 2, d = rnd() * 0.26 * S, x = S / 2 + Math.cos(t) * d, y = S / 2 + Math.sin(t) * d, r = (0.14 + rnd() * 0.2) * S;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, S, S);
    }
    g.globalCompositeOperation = "destination-in";   // 外側へ向けて消す
    const mask = g.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S * 0.5); mask.addColorStop(0, "rgba(0,0,0,1)"); mask.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = mask; g.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  // 砲口の閃光の絵(2026-10-16): 白熱の芯と、長さ不ぞろいの放射状の光条(実写の発砲炎の、砲口を正面から見た形)。seed で光条の並びを変える
  U.flashTexture = (THREE, seed = 3) => cached("flash:" + seed, () => {
    const S = 128, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), rnd = U.rng(seed), C = S / 2;
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < 14; i++) {   // 光条: 細い三角形。根元は白、先は透明
      const a = (i / 14) * Math.PI * 2 + rnd() * 0.3, L = (0.28 + rnd() * 0.22) * S, w = (0.03 + rnd() * 0.04) * S;
      const gr = g.createLinearGradient(C, C, C + Math.cos(a) * L, C + Math.sin(a) * L); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.5, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(C + Math.cos(a + Math.PI / 2) * w, C + Math.sin(a + Math.PI / 2) * w); g.lineTo(C + Math.cos(a) * L, C + Math.sin(a) * L); g.lineTo(C + Math.cos(a - Math.PI / 2) * w, C + Math.sin(a - Math.PI / 2) * w); g.closePath(); g.fill();
    }
    const core = g.createRadialGradient(C, C, 0, C, C, S * 0.22); core.addColorStop(0, "rgba(255,255,255,1)"); core.addColorStop(0.4, "rgba(255,255,255,0.8)"); core.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = core; g.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  // 炎の舌(砲身の軸に沿って伸びる発砲炎。+x が先)。根元は太く明るく、先へ向けて細く薄く。輪郭はゆらぐ
  U.tongueTexture = (THREE, seed = 4) => cached("tongue:" + seed, () => {
    const W = 128, H = 64, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), rnd = U.rng(seed);
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {   // 3 本の舌を重ねて不ぞろいにする
      const L = W * (0.75 + rnd() * 0.25), h0 = H * (0.22 + rnd() * 0.12), y0 = H / 2 + (rnd() - 0.5) * H * 0.2;
      const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.35, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, y0 - h0); g.quadraticCurveTo(L * 0.45, y0 - h0 * 1.3, L, y0 + (rnd() - 0.5) * 6); g.quadraticCurveTo(L * 0.45, y0 + h0 * 1.3, 0, y0 + h0); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = "destination-in";   // 上下の縁をやわらかく
    const m = g.createLinearGradient(0, 0, 0, H); m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(0.2, "rgba(0,0,0,1)"); m.addColorStop(0.8, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = m; g.fillRect(0, 0, W, H);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });
  // 発砲炎の雲の絵(2026-10-16、ユーザー「フラッシュ感 = 雲の密度と輪郭。光る塊として不透明で、輪郭が不ぞろいにはっきり。色は金色のまま」):
  // 3 段のノイズで輪郭を荒らし、内側はほぼ不透明。色は縁の金色 → 黄 → 淡黄 → 白の芯(画素ごとに焼く)。2 × 2 の 4 コマ(ノイズ違い。粒ごとに選ぶ)。jet = 軸に沿って伸びる形(+x が先)
  // (同日に一度、煤の縁 → 暗赤 → 橙 → 白黄の階調で作って「明るすぎてチープ」と取り下げた。色の階調を変えて作り直したもの)
  // (同日 5 回目、ユーザー「貼り付けた絵っぽい、自然な炎感が薄い」): 決まった絵を拡大・薄めるだけだと模様が動かず、消え方も一様で絵に見える。
  // 絵をやめ、粒ごとの年齢でシェーダーが雲を描く(U.axialBillboards の fire)。ここはその元になる繰り返しのノイズ(灰色、色は持たない)
  U.noiseTexture = (THREE, seed = 11) => cached("noise:" + seed, () => {
    const S = 128, N = 8, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), img = g.createImageData(S, S), d = img.data, rnd = U.rng(seed);
    const a = Float32Array.from({ length: N * N }, rnd), at = (i, j) => a[(j % N) * N + (i % N)], sm = (t) => t * t * (3 - 2 * t);   // 端でつながる格子(RepeatWrapping で継ぎ目なし)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x / S) * N, v = (y / S) * N, X = Math.floor(u), Y = Math.floor(v), fx = sm(u - X), fy = sm(v - Y);
      const n = (at(X, Y) * (1 - fx) + at(X + 1, Y) * fx) * (1 - fy) + (at(X, Y + 1) * (1 - fx) + at(X + 1, Y + 1) * fx) * fy, i = (y * S + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = n * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;   // 色空間なし(データとして読む)
  });
  U.glowTexture = (THREE) => cached("glow", () => {
    const S = 64, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d");
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.22, "rgba(255,255,255,0.9)"); gr.addColorStop(0.55, "rgba(255,255,255,0.28)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  });

  // ビルボードの粒の列(発射演出・砂塵。2026-10-16 最適化): 1 つのメッシュで count 枚の板を描く(InstancedBufferGeometry)。板はシェーダーでカメラに正対し、
  // 粒ごとに位置・大きさ・回転・色・不透明度を持つ。スプライト 1 枚 = 1 描画呼び出しだったものを 1 回にする。大きさは親の scale を掛けた単位(Sprite と同じ)
  //   const b = U.billboards(THREE, { map, count: 32, blending: THREE.NormalBlending }); parent.add(b.mesh)
  //   b.set(i, x, y, z, size, rot, color, alpha); b.hide(i); b.commit()   // 毎フレーム set / hide のあとに commit
  U.billboards = function (THREE, { map, count, blending = THREE.NormalBlending } = {}) {
    const plane = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index; geo.setAttribute("position", plane.attributes.position); geo.setAttribute("uv", plane.attributes.uv); geo.instanceCount = count;
    const pos = new Float32Array(count * 3), size = new Float32Array(count), rot = new Float32Array(count), col = new Float32Array(count * 3), alpha = new Float32Array(count);
    const attrs = { iPos: [pos, 3], iSize: [size, 1], iRot: [rot, 1], iColor: [col, 3], iAlpha: [alpha, 1] };
    for (const [k, [arr, n]] of Object.entries(attrs)) geo.setAttribute(k, new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map } }, transparent: true, depthWrite: false, blending,
      vertexShader: `attribute vec3 iPos; attribute float iSize; attribute float iRot; attribute vec3 iColor; attribute float iAlpha;
        varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
        void main() {
          vUv = uv; vColor = iColor; vAlpha = iAlpha;
          float c = cos(iRot), s = sin(iRot), sc = length(modelViewMatrix[0].xyz);   // sc = 親の scale
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          mv.xy += vec2(position.x * c - position.y * s, position.x * s + position.y * c) * iSize * sc;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform sampler2D map; varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
          if (gl_FragColor.a < 0.003) discard;
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
    const set = (i, x, y, z, sz, r, c, a) => { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; size[i] = sz; rot[i] = r; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; alpha[i] = a; };
    const hide = (i) => { size[i] = 0; alpha[i] = 0; };
    const commit = () => { for (const k of Object.keys(attrs)) geo.attributes[k].needsUpdate = true; };
    for (let i = 0; i < count; i++) hide(i);
    return { mesh, set, hide, commit, count };
  };

  // 軸つきビルボード(2026-10-16): 粒ごとの軸(砲身の向き)に沿って伸び、軸の周りだけカメラへ向く板。発砲炎の舌に使う。絵の +x が軸の先
  //   const b = U.axialBillboards(THREE, { map, count }); b.set(i, x, y, z, ax, ay, az, len, width, color, alpha); b.hide(i); b.commit()
  //   fire: { jet } のとき map はノイズ(U.noiseTexture)で、絵の代わりにシェーダーが炎の雲を描く。b.set(..., seed, age) の age(0..1)で
  //   輪郭は外へ広がり続け(だんだん遅く)、模様の薄い所から穴があき、縁からやわらかく透けて拡散する(縮まない)。色は金色の縁 → 黄 → 淡黄 → 白の芯(fire.stops)。jet = 軸に沿って伸びる形
  U.axialBillboards = function (THREE, { map, count, blending = THREE.AdditiveBlending, fire = null } = {}) {
    const plane = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0), geo = new THREE.InstancedBufferGeometry();   // x: 0..1(根元 → 先)、y: ±0.5
    geo.index = plane.index; geo.setAttribute("position", plane.attributes.position); geo.setAttribute("uv", plane.attributes.uv); geo.instanceCount = count;
    const pos = new Float32Array(count * 3), axis = new Float32Array(count * 3), len = new Float32Array(count), wid = new Float32Array(count), col = new Float32Array(count * 3), alpha = new Float32Array(count), seed = new Float32Array(count), age = new Float32Array(count), heat = new Float32Array(count);
    const attrs = { iPos: [pos, 3], iAxis: [axis, 3], iLen: [len, 1], iWid: [wid, 1], iColor: [col, 3], iAlpha: [alpha, 1], iSeed: [seed, 1], iAge: [age, 1], iHeat: [heat, 1] };
    for (const [k, [arr, n]] of Object.entries(attrs)) geo.setAttribute(k, new THREE.InstancedBufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage));
    const stops = (fire?.stops ?? [0xffba38, 0xffde6e, 0xfff2be, 0xfffdf0]).map((c) => new THREE.Color(c));   // 縁(金) → 黄 → 淡黄 → 芯(白)。前の絵の階調と同じ
    const fireFrag = fire && `uniform sampler2D map; uniform vec3 uRamp[4]; uniform vec3 uSmoke; varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vSeed; varying float vAge; varying float vHeat;
        float N(vec2 p) { return texture2D(map, p).r; }
        void main() {
          vec2 o = fract(vec2(vSeed * 0.618, vSeed * 0.382)), c = vUv - ${fire.jet ? "vec2(0.3, 0.5)" : "vec2(0.5)"};
          float r = ${fire.jet ? "length(vec2(c.x / (c.x > 0.0 ? 0.7 : 0.3), c.y / 0.34))" : "length(c) * 2.0"} * mix(1.3, 1.0, sqrt(vAge));   // 輪郭は外へ広がり続ける(初めが速く、だんだん遅く。縮まない)
          vec2 p = vUv * 0.6 + o - c * vAge * 0.55;                                                     // 模様は年齢とともに中心から外へ押し出される(膨らむ雲のうねり)
          vec2 w = vec2(N(p * 0.7 + vAge * 0.21), N(p * 0.7 + 0.47 - vAge * 0.17)) - 0.5;              // 模様をゆがませて渦にする
          vec2 q = p + w * (0.35 + vAge * 0.3);
          float n = 0.5 * N(q) + 0.3 * N(q * 2.03 + 0.37) + 0.2 * N(q * 4.07 + 0.71);
          float d = 1.25 - r * 1.2 + (n - 0.5) * (1.2 + vAge * 0.8);                                    // 密度: 芯で高く縁は荒れる
          d -= vAge * (1.0 - n) * 0.6;                                                                  // 拡散: 模様の薄い所から抜けて穴があく(輪郭は引っこめない)
          d -= smoothstep(0.7, 1.0, r) * 0.8;                                                           // 板の縁で必ず消す(まっすぐ切れた輪郭を出さない)
          float a = smoothstep(0.05, 0.24 + vAge * 0.4, d);                                            // 初めは輪郭がはっきり、年齢で縁からやわらかく透けて空気に溶ける
          // 熱(vHeat = 光っている時間に対する経過): 冷えるほど下がり、雲の濃い所ほど遅くまで光る。光の消えた所から煙の色に置き換わる
          // (光る雲が消えるのではなく、同じ雲が冷えて煙になる。芯の光る塊が煙の中へ縮んでいく)
          float hh = d * 1.05 - vHeat * 0.95, glow = smoothstep(0.0, 0.3, hh), h = clamp(hh, 0.0, 1.0) * 3.0;
          vec3 fc = h < 1.0 ? mix(uRamp[0], uRamp[1], h) : h < 2.0 ? mix(uRamp[1], uRamp[2], h - 1.0) : mix(uRamp[2], uRamp[3], h - 2.0);
          fc *= vColor * (0.8 + 0.4 * smoothstep(0.25, 0.75, n));                                      // 内側のうねりの陰影(平たい塗りにしない)
          vec3 sc = uSmoke * (0.78 + 0.4 * n);                                                          // 煙の陰影
          vec3 col = mix(sc, fc, glow);
          a *= mix(0.6, 1.0, glow);                                                                     // 煙になった所は透ける(周りの煙の濃さに合わせる)
          gl_FragColor = vec4(col, a * vAlpha); if (gl_FragColor.a < 0.003) discard;
          #include <colorspace_fragment>
        }`;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uRamp: { value: stops }, uSmoke: { value: new THREE.Color(fire?.smoke ?? 0xd9d4cc) } }, transparent: true, depthWrite: false, blending, side: THREE.DoubleSide,   // 軸の向きで巻き順が裏返るので両面
      vertexShader: `attribute vec3 iPos; attribute vec3 iAxis; attribute float iLen; attribute float iWid; attribute vec3 iColor; attribute float iAlpha; attribute float iSeed; attribute float iAge; attribute float iHeat;
        varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vSeed; varying float vAge; varying float vHeat;
        void main() {
          vUv = uv; vColor = iColor; vAlpha = iAlpha; vSeed = iSeed; vAge = iAge; vHeat = iHeat;
          float sc = length(modelViewMatrix[0].xyz);
          vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
          vec3 ax = normalize((modelViewMatrix * vec4(iAxis, 0.0)).xyz);
          vec3 side = cross(ax, vec3(0.0, 0.0, 1.0)); side = length(side) < 0.05 ? vec3(0.0, 1.0, 0.0) : normalize(side);   // 軸の周りでカメラへ向く
          mv.xyz += ax * position.x * iLen * sc + side * position.y * iWid * sc;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: fireFrag || `uniform sampler2D map; varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
        void main() { vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha); if (gl_FragColor.a < 0.003) discard;
          #include <colorspace_fragment>
        }`,
    });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
    const set = (i, x, y, z, ax, ay, az, l, w, c, a, sd = 0, ag = 0, ht = ag) => { pos.set([x, y, z], i * 3); axis.set([ax, ay, az], i * 3); len[i] = l; wid[i] = w; col.set([c.r, c.g, c.b], i * 3); alpha[i] = a; seed[i] = sd; age[i] = ag; heat[i] = ht; };
    const hide = (i) => { len[i] = 0; wid[i] = 0; alpha[i] = 0; };
    const commit = () => { for (const k of Object.keys(attrs)) geo.attributes[k].needsUpdate = true; };
    for (let i = 0; i < count; i++) hide(i);
    return { mesh, set, hide, commit, count };
  };

  // 発射演出のリアル版(2026-10-16): 実写の砲撃の構成(閃光と点光源 / 火球 / 煙と残り煙 / 地面の砂塵 / 火花 / 曳光弾)を、砲ごとの数値だけ変えて全戦闘アセットで使い回す。
  // 粒はすべて親(車体やトークンの group)の座標に置くので、砲塔が回っても出た場所に残り、連射で砲口が変わっても古い粒は動かない。煙の浮力と砂塵の地面は親の +y / y = ground。
  // 描画呼び出しは 閃光 1 + 火球 1 + 煙・残り煙・砂塵 1 + 火花 2 + 曳光弾 2(使う種類だけ)。加算合成は閃光と曳光弾の頭だけ(明るい盤面で白く飛ばない)
  //   const fx = U.muzzleFx(THREE, parent, { ground: 0.3, seed, flash, light, balls, smoke, wisps, dust, sparks, tracers });   // 使わない種類は省く
  //   fx.fire(muzzleObject)                  // 砲口の Object3D(+z が撃つ向き)。連射は撃つたびに呼ぶ(各種類は per 個ずつ出し、pool の空きを使い回す)
  //   fx.tracer(muzzleObject)                // 曳光弾を 1 発
  //   fx.spawn(kind, pos, quat, n)           // 任意の場所に粒を出す(ミサイルの煙の尾など。pos, quat は親の座標)
  //   fx.update(dt); fx.active
  U.muzzleFx = function (THREE, parent, cfg) {
    const rng = U.rng(cfg.seed ?? 23), rr = (a, b) => a + rng() * (b - a), pick = (v) => (Array.isArray(v) ? rr(v[0], v[1]) : v), col = (c) => new THREE.Color(c);
    const tex = { puff: U.puffTexture(THREE), noise: U.noiseTexture(THREE), glow: U.glowTexture(THREE), flash: U.flashTexture(THREE) };   // 火球と舌はノイズからシェーダーが描く雲
    const root = new THREE.Group(); root.visible = false; parent.add(root);
    const ground = cfg.ground ?? 0, UP = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3(), v2 = new THREE.Vector3(), q0 = new THREE.Quaternion(), c0 = new THREE.Color(), relM = new THREE.Matrix4(), sc = new THREE.Vector3(), pos0 = new THREE.Vector3();
    const curve = (t, max, fadeIn, pow) => (t < 0 ? 0 : Math.min(1, t / fadeIn) * Math.pow(Math.max(0, 1 - t / max), pow));
    const pool = (n, make) => Array.from({ length: n }, (_, i) => ({ i, t: 9, max: 1, ...make(i) }));
    const free = (list, n) => { const out = []; for (const e of list) { if (e.t >= e.max) out.push(e); if (out.length >= n) break; } return out; };
    const sets = {}, kinds = {};
    // ── 閃光(加算の光の玉)と点光源 ──
    // 閃光 = 砲口の放射状の芯(カメラ正対。1〜2 フレームで最大、すぐ消える)+ 砲身の軸に沿って伸びる炎の舌(根元は白、先は橙。マズルブレーキつきは横へも)。tongue: null で芯だけ(ミサイルの炎など)
    const F = cfg.flash && { len: 0.08, size: [8, 22], color: 0xfff0c8, pool: 1, z: [2, 6], tongue: { len: [10, 18], width: [4, 7], side: 0, color: 0xffe890 }, ...cfg.flash };
    if (F) {
      sets.glow = U.billboards(THREE, { map: F.tongue ? tex.flash : tex.glow, count: F.pool, blending: THREE.AdditiveBlending }); root.add(sets.glow.mesh); F.col = col(F.color);
      // 白飛びのハロー(加算のやわらかい光。発射の瞬間に最大で、閃光より少し長く残る)。F.halo: { size, len, color }。halo: null で出さない
      F.halo = F.halo ? { size: F.size[1] * 1.8, len: F.len * 1.6, color: 0xfff2c0, ...F.halo } : null;   // 既定は出さない(ユーザー「丸いハローではない」)
      if (F.halo) { F.halo.col = col(F.halo.color); sets.halo = U.billboards(THREE, { map: tex.glow, count: F.pool, blending: THREE.AdditiveBlending }); root.add(sets.halo.mesh); }
      kinds.flash = pool(F.pool, () => ({ o: new THREE.Vector3(), q: new THREE.Quaternion(), rot: 0, l: 1, w: 1, sd: 0 }));
      if (F.tongue) { F.tongue.col = col(F.tongue.color ?? 0xffffff); F.nT = F.tongue.side ? 3 : 1; sets.tongue = U.axialBillboards(THREE, { map: tex.noise, count: F.pool * F.nT, fire: { jet: true }, blending: THREE.NormalBlending }); root.add(sets.tongue.mesh); }   // 舌も炎の雲(色はシェーダーの階調)
    }
    const L = cfg.light && { len: 0.14, power: 120000, color: 0xffb673, z: 5, ...cfg.light };
    let light = null, lightT = 9;
    if (L) { light = new THREE.PointLight(L.color, 0, 0, 2); root.add(light); }
    // ── 火球: 砲口から前へ伸びる塊の列。砲口側は白熱、先端ほど橙。膨らみながら進み、冷えて煤けた暗赤になる。side = マズルブレーキから横へ出る割合 ──
    // 火球: やわらかい絵を砲身の軸に沿って少し伸ばした板(通常合成)。実写(榴弾砲の発砲)に合わせ、白 → 黄 → 金色に光るガス雲。煤や赤みは出さず、消えぎわに少し橙(soot)へ寄せるだけ
    // 絵が色(金色 → 白の芯)を持つので、粒の色は白(砲口側)→ わずかに金(先端・消えぎわ)を掛けるだけ
    const B = cfg.balls && { per: 8, len: 0.3, size: 6, speed: 60, length: 10, side: 0, aspect: 1.4, cols: [0xffffff, 0xffffff, 0xfffaf0, 0xfff6e0, 0xfff2d0, 0xffedc0, 0xffe8b0, 0xffe0a0], soot: 0xffc060, sootK: 0.5, lifeK: 3.5, rise: 4, grow: 1.2, smoke: cfg.smoke?.cols?.[0] ?? 0xd7c3a8, ...cfg.balls };
    // 火球は光っている時間(len)のあと、同じ雲が冷えて煙の色になり、膨らみ・浮きながら life(= len × lifeK)まで残って薄れる(ユーザー「炎が不自然に消える。霧散して煙に置き換わるように」)
    if (B) { B.life = B.len * B.lifeK; B.pool = cfg.balls.pool ? cfg.balls.pool * Math.ceil(B.lifeK) : B.per;   // 連射は残る時間の分だけ枠を増やす
      sets.fire = U.axialBillboards(THREE, { map: tex.noise, count: B.pool, fire: { smoke: B.smoke }, blending: THREE.NormalBlending }); root.add(sets.fire.mesh);
      sets.fire.mesh.renderOrder = 1;   // 煙の粒より後に描く(光る芯は煙の手前。冷えた雲はそのまま煙に重なってつながる)
      B.cols = B.cols.map(col); B.soot = col(B.soot); kinds.balls = pool(B.pool, () => ({ o: new THREE.Vector3(), q: new THREE.Quaternion(), c: new THREE.Color(), k: 0, dx: 0, dy: 0, side: 0, fr: 0 })); }
    // ── 煙・残り煙・砂塵(1 つのビルボードの列) ──
    const S = cfg.smoke && { per: 30, len: [2.5, 4.2], speed: 30, spread: 0.5, drag: 1.6, rise: 3, size: [2, 4], grow: [14, 24], peak: 0.4, fadeIn: 0.06, delay: [0, 0.12], ahead: [1, 10], cols: [0xd7c3a8, 0xa3aab1, 0xcdd1d5], ...cfg.smoke };
    const W = cfg.wisps && { per: 5, len: [1.4, 2.0], speed: [1.5, 3], rise: 0.6, drag: 0.6, size: [0.6, 1.0], grow: 4, peak: 0.38, fadeIn: 0.25, delay0: 0.3, step: 0.14, cols: [0xa3aab1, 0xa3aab1, 0xcdd1d5], ...cfg.wisps };
    const D = cfg.dust && { per: 24, len: [1.8, 3.0], speed: 36, drag: 1.6, size: [3, 4.5], grow: 22, peak: 0.65, fadeIn: 0.08, ahead: 4, angle: 1.2, vy: [2, 6], color: 0xcbbfa6, thin: 0xd8cfbc, ...cfg.dust };
    for (const K of [S, W, D]) if (K) { K.pool = K.pool ?? K.per; K.cols = (K.cols ?? [K.color, K.color, K.thin]).map(col); }
    const nPuff = (S?.pool ?? 0) + (W?.pool ?? 0) + (D?.pool ?? 0);
    if (nPuff) {
      sets.puff = U.billboards(THREE, { map: tex.puff, count: nPuff }); root.add(sets.puff.mesh);
      let off = 0; const mk = (K) => { const list = pool(K.pool, (i) => ({ bi: off + i, p: new THREE.Vector3(), v: new THREE.Vector3(), s0: 1, grow: 0, spin: 0, rot: rr(0, Math.PI * 2), tone: 0 })); off += K.pool; return list; };
      if (S) kinds.smoke = mk(S); if (W) kinds.wisps = mk(W); if (D) kinds.dust = mk(D);
    }
    // ── 火花(頭は点、尾は直前の位置への線)と曳光弾(同じ作り。重力なし、まっすぐ速く) ──
    const P = cfg.sparks && { per: 56, len: 1.1, speed: [45, 100], spread: 0.5, gravity: 60, drag: 1.4, bounce: 0.3, size: 3, cols: [0xfff2c8, 0xff8a2e, 0x6e2410], ...cfg.sparks };
    const T = cfg.tracers && { pool: 24, speed: 420, len: 1.4, drop: 6, size: 5, tail: 0.045, cols: [0xfff0c0, 0xffa040, 0xff6a2a], blending: THREE.NormalBlending, ...cfg.tracers };   // 曳光弾は橙(明るい盤面でも見えるよう通常合成)
    const lineSet = (K, blending) => {
      const n = K.pool, pos = new Float32Array(n * 3), colA = new Float32Array(n * 3), tp = new Float32Array(n * 6), tc = new Float32Array(n * 6);
      const g1 = new THREE.BufferGeometry(); g1.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g1.setAttribute("color", new THREE.BufferAttribute(colA, 3).setUsage(THREE.DynamicDrawUsage));
      const g2 = new THREE.BufferGeometry(); g2.setAttribute("position", new THREE.BufferAttribute(tp, 3).setUsage(THREE.DynamicDrawUsage)); g2.setAttribute("color", new THREE.BufferAttribute(tc, 3).setUsage(THREE.DynamicDrawUsage));
      const pts = new THREE.Points(g1, new THREE.PointsMaterial({ map: tex.glow, size: K.size, vertexColors: true, transparent: true, depthWrite: false, blending })); pts.frustumCulled = false; root.add(pts);
      const lines = new THREE.LineSegments(g2, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending })); lines.frustumCulled = false; root.add(lines);
      for (let i = 0; i < n; i++) { pos[i * 3 + 1] = tp[i * 6 + 1] = tp[i * 6 + 4] = -1e4; }
      return { pts, lines, pos, colA, tp, tc, g1, g2, cols: K.cols.map(col) };
    };
    if (P) { P.pool = P.pool ?? P.per; sets.sparks = lineSet(P, THREE.NormalBlending); kinds.sparks = pool(P.pool, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3() })); }
    if (T) { sets.tracers = lineSet(T, T.blending); kinds.tracers = pool(T.pool, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3() })); }

    // ── 出す ──
    const pose = (obj, outP, outQ) => { parent.updateMatrixWorld(true); relM.copy(parent.matrixWorld).invert().multiply(obj.matrixWorld); relM.decompose(outP, outQ, sc); };
    const cone = (out, spread, s0, s1) => { const a = rr(0, Math.PI * 2), t = rr(0, spread); return out.set(Math.cos(a) * t, Math.sin(a) * t, 1).normalize().multiplyScalar(rr(s0, s1)); };
    function spawn(kind, o, q, n) {
      const list = kinds[kind]; if (!list) return;
      if (kind === "flash") { for (const e of free(list, n ?? 1)) { e.t = 0; e.max = F.len; e.o.copy(o); e.q.copy(q); e.rot = rr(0, Math.PI * 2); e.l = pick(F.tongue?.len ?? 1); e.w = pick(F.tongue?.width ?? 1); e.sd = rr(0, 100); } return; }
      if (kind === "balls") {
        const es = free(list, n ?? B.per);
        const nSide = Math.round(es.length * B.side), nFwd = es.length - nSide;   // 前の雲と、マズルブレーキの左右の雲(それぞれ別に 0..1 の階調を持つ)
        es.forEach((e, j) => {
          e.t = 0; e.max = B.life; e.o.copy(o); e.q.copy(q); e.dx = rr(-1, 1); e.dy = rr(-0.7, 0.7); e.fr = rr(0, 100);   // fr = 模様の種
          if (j < nSide) { e.side = j % 2 ? 1 : -1; const m = Math.floor(j / 2), nm = Math.ceil(nSide / 2); e.k = nm > 1 ? m / (nm - 1) : 0; }
          else { e.side = 0; const m = j - nSide; e.k = nFwd > 1 ? m / (nFwd - 1) : 0; }
        });
        return;
      }
      if (kind === "smoke") for (const e of free(list, n ?? S.per)) {   // 砲口の少し前から出て前へ流れ、浮力で上がる
        const a = rr(0, Math.PI * 2), sp = rr(0.15, 1) * S.spread;
        e.v.set(Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp * 0.8 + 0.1, 1).normalize().multiplyScalar(rr(0.3, 1) * S.speed).applyQuaternion(q);
        e.p.set(rr(-1.5, 1.5), rr(-1, 1), pick(S.ahead)).applyQuaternion(q).add(o); e.t = -pick(S.delay); e.max = pick(S.len); e.s0 = pick(S.size); e.grow = pick(S.grow); e.spin = rr(-0.5, 0.5); e.tone = rr(-0.08, 0.08);
      }
      if (kind === "wisps") free(list, n ?? W.per).forEach((e, j) => {   // 砲口から細く立ちのぼる残り煙
        e.v.set(rr(-0.4, 0.4), rr(1.2, 2.2), pick(W.speed)).applyQuaternion(q); e.p.set(rr(-0.3, 0.3), rr(-0.3, 0.3), rr(0.2, 1.4)).applyQuaternion(q).add(o);
        e.t = -(W.delay0 + j * W.step); e.max = pick(W.len); e.s0 = pick(W.size); e.grow = W.grow; e.spin = rr(-0.6, 0.6); e.tone = rr(-0.05, 0.05);
      });
      if (kind === "dust") {   // 砲口の真下より少し前の地面から、撃つ向きを中心に ±angle へ放射状に広がる
        v.set(0, 0, 1).applyQuaternion(q); const yaw = Math.atan2(v.x, v.z), cx = o.x + Math.sin(yaw) * D.ahead, cz = o.z + Math.cos(yaw) * D.ahead;
        for (const e of free(list, n ?? D.per)) {
          const a = yaw + rr(-D.angle, D.angle), sp = rr(0.4, 1) * D.speed;
          e.v.set(Math.sin(a) * sp, pick(D.vy), Math.cos(a) * sp); e.p.set(cx + Math.sin(a) * 2, ground + 0.6, cz + Math.cos(a) * 2); e.t = -rr(0, 0.08); e.max = pick(D.len); e.s0 = pick(D.size); e.grow = D.grow; e.spin = rr(-0.3, 0.3); e.tone = rr(-0.06, 0.06);
        }
      }
      if (kind === "sparks") for (const e of free(list, n ?? P.per)) {   // 前方の円錐へ。速いものほど遠くへ飛んで地面で跳ねる
        cone(e.v, P.spread, P.speed[0], P.speed[1]).applyQuaternion(q); e.p.set(rr(-0.4, 0.4), rr(-0.4, 0.4), 1.5).applyQuaternion(q).add(o); e.t = 0; e.max = rr(0.45, P.len);
      }
      if (kind === "tracers") for (const e of free(list, n ?? 1)) { e.v.set(rr(-0.01, 0.01), rr(-0.01, 0.01), 1).normalize().multiplyScalar(T.speed).applyQuaternion(q); e.p.set(0, 0, 2).applyQuaternion(q).add(o); e.t = 0; e.max = T.len; }
    }
    function fireAt(o, q) {
      for (const k of ["flash", "balls", "smoke", "wisps", "dust", "sparks"]) if (kinds[k]) spawn(k, o, q);
      if (light) { lightT = 0; light.position.copy(v.set(0, 0, L.z).applyQuaternion(q).add(o)); }
      root.visible = true;
    }
    const fire = (obj) => { pose(obj, pos0, q0); fireAt(pos0, q0); };
    const tracer = (obj) => { pose(obj, pos0, q0); spawn("tracers", pos0, q0, 1); root.visible = true; };
    // ── 進める ──
    const stepPuff = (K, e, dt, floor) => {
      e.t += dt; if (e.t < 0 || e.t >= e.max) { sets.puff.hide(e.bi); return false; }
      e.v.multiplyScalar(Math.exp(-K.drag * dt)); e.v.y += (K.riseFn ? K.riseFn(e.t) : K.rise) * dt; e.p.addScaledVector(e.v, dt);
      if (floor !== undefined && e.p.y < floor) { e.p.y = floor; e.v.y = Math.max(0, e.v.y); }
      e.rot += e.spin * dt; const u = e.t / e.max;
      c0.copy(K.cols[0]).lerp(K.cols[1], Math.min(1, e.t / 0.3)).lerp(K.cols[2], u * u); c0.offsetHSL(0, 0, e.tone);
      sets.puff.set(e.bi, e.p.x, e.p.y, e.p.z, e.s0 + e.grow * (1 - Math.exp(-e.t / (K.growT ?? 1.1))), e.rot, c0, K.peak * curve(e.t, e.max, K.fadeIn, K.pow ?? 1.3));
      return true;
    };
    const stepLines = (K, set, list, dt, gravity, bounce) => {
      let any = false;
      list.forEach((e, i) => {
        if (e.t >= e.max) { set.pos[i * 3 + 1] = -1e4; set.tp[i * 6 + 1] = set.tp[i * 6 + 4] = -1e4; return; }
        e.t += dt; any = true;
        if (gravity) { e.v.y -= gravity * dt; e.v.multiplyScalar(Math.exp(-K.drag * dt)); } else e.v.y -= K.drop * dt;
        e.p.addScaledVector(e.v, dt);
        if (bounce && e.p.y < ground + 0.2) { e.p.y = ground + 0.2; e.v.y = -e.v.y * K.bounce; e.v.x *= 0.55; e.v.z *= 0.55; }
        const u = e.t / e.max; c0.copy(set.cols[0]).lerp(set.cols[1], Math.min(1, u * 2.5)).lerp(set.cols[2], Math.max(0, u - 0.4) / 0.6);
        e.p.toArray(set.pos, i * 3); c0.toArray(set.colA, i * 3); e.p.toArray(set.tp, i * 6); v.copy(e.p).addScaledVector(e.v, -(K.tail ?? 0.035)).toArray(set.tp, i * 6 + 3);
        c0.toArray(set.tc, i * 6); c0.multiplyScalar(0.35).toArray(set.tc, i * 6 + 3);
      });
      set.g1.attributes.position.needsUpdate = set.g1.attributes.color.needsUpdate = set.g2.attributes.position.needsUpdate = set.g2.attributes.color.needsUpdate = true;
      set.pts.visible = set.lines.visible = any; return any;
    };
    let active = false;
    function update(dt) {
      if (!root.visible) return;
      let any = false;
      if (F) for (const e of kinds.flash) {
        e.t += dt;
        if (sets.halo) {   // ハロー: 1 フレーム目が最大、二乗で消える
          const hu = e.t / F.halo.len;
          if (hu < 1) { v.set(0, 0, F.z[0] + 1).applyQuaternion(e.q).add(e.o); sets.halo.set(e.i, v.x, v.y, v.z, F.halo.size * (0.9 + 0.3 * hu), 0, F.halo.col, Math.pow(1 - hu, 2) * 0.95); any = true; } else sets.halo.hide(e.i);
        }
        if (e.t >= e.max) { sets.glow.hide(e.i); if (sets.tongue) for (let k = 0; k < F.nT; k++) sets.tongue.hide(e.i * F.nT + k); continue; }
        any = true; const u = e.t / e.max, a = Math.pow(1 - u, 0.6);
        v.set(0, 0, F.z[0] + u * (F.z[1] - F.z[0])).applyQuaternion(e.q).add(e.o);
        sets.glow.set(e.i, v.x, v.y, v.z, (F.size[0] + u * (F.size[1] - F.size[0])) * 0.8, e.rot, F.col, Math.pow(1 - u, 1.5) * 0.7);   // 芯: 一瞬で膨らんで消える(炎の絵が主役。芯は最初の 1〜2 フレームだけ強い)
        if (sets.tongue) {   // 舌: 砲口から軸に沿って。最初の 1/3 で伸び切り、そのあと細く薄れる
          const grow = Math.min(1, u * 3), L = e.l * (0.4 + 0.6 * grow), Wd = e.w * (0.6 + 0.4 * grow) * (1 + 0.3 * u);   // 細らせず、少し太りながら薄れる
          v2.set(0, 0, 1).applyQuaternion(e.q); v.set(0, 0, 0.5).applyQuaternion(e.q).add(e.o);
          sets.tongue.set(e.i * F.nT, v.x, v.y, v.z, v2.x, v2.y, v2.z, L, Wd, F.tongue.col, a, e.sd, u);
          if (F.nT === 3) for (const [k, sg] of [[1, -1], [2, 1]]) {   // マズルブレーキ: 横へ斜め後ろ気味に
            v2.set(Math.sin(F.tongue.side) * sg, 0, Math.cos(F.tongue.side)).applyQuaternion(e.q); v.set(sg * 1.2, 0, -0.5).applyQuaternion(e.q).add(e.o);
            sets.tongue.set(e.i * F.nT + k, v.x, v.y, v.z, v2.x, v2.y, v2.z, L * 0.85, Wd * 0.9, F.tongue.col, a, e.sd + k * 17.3, u);
          }
        }
      }
      if (light) { lightT += dt; const lu = lightT / L.len; light.intensity = lu < 1 ? L.power * (1 - lu) * (1 - lu) : 0; }
      if (B) for (const e of kinds.balls) {
        e.t += dt; if (e.t >= e.max) { sets.fire.hide(e.i); continue; } any = true;
        const u = e.t / e.max, ht = e.t / B.len, hu = Math.min(1, ht), k = e.k;   // u = 残る時間全体、ht = 光っている時間に対する経過(1 を超えると煙)
        const adv = B.speed * B.len * 0.6 * (1 - Math.exp(-2 * ht)) * (0.35 + 0.65 * k) + B.speed * 0.03 * e.t;   // 爆風で飛び出してすぐ減速し、あとはゆっくり流れる
        const spread = 0.6 + hu + u * 0.8;
        if (e.side) { v.set(e.side * (4 + k * B.length * 0.9 + adv * 0.8), e.dy * (1 + k * 2) * spread, -1 + k * 2 + adv * 0.15); v2.set(e.side, 0, 0.2); }   // マズルブレーキの横の雲: 横へ離して、前の雲と分かれる
        else { v.set(e.dx * (1 + k * 3) * spread, e.dy * (1 + k * 2) * spread, 2 + k * B.length + adv); v2.set(e.dx * 0.15, e.dy * 0.15, 1); }
        v2.normalize().applyQuaternion(e.q);   // 板の軸(撃つ向き。少し散らす)
        const sz = B.size * (1 + k) * (1.1 + 1.2 * (1 - Math.exp(-2.5 * hu)) + B.grow * u), asp = B.aspect - (B.aspect - 1.1) * hu, L = sz * asp, Wd = sz;   // 1 フレーム目からほぼ最大。煙になっても膨らみ続ける
        v.applyQuaternion(e.q).add(e.o).addScaledVector(v2, -L / 2);   // 板は軸の根元から伸びるので中心をずらす
        v.y += B.rise * e.t * e.t * 0.5 / (0.3 + e.t);   // 冷えた雲は浮力でゆっくり上がる
        e.c.copy(B.cols[Math.min(B.cols.length - 1, Math.round(k * (B.cols.length - 1)))]).lerp(B.soot, Math.pow(hu, 1.2) * B.sootK * (0.5 + 0.5 * k));   // 冷えぎわに少し橙へ
        sets.fire.set(e.i, v.x, v.y, v.z, v2.x, v2.y, v2.z, L, Wd, e.c, (1 - u) * (1 - 0.2 * k), e.fr, u, ht * (1 + 0.4 * k));   // 先端の雲ほど早く冷える
      }
      if (S) { S.riseFn = S.riseFn ?? ((t) => S.rise * Math.exp(-t / 1.6)); for (const e of kinds.smoke) any = stepPuff(S, e, dt) || any; }
      if (W) for (const e of kinds.wisps) any = stepPuff(W, e, dt) || any;
      if (D) { D.riseFn = D.riseFn ?? (() => -4); D.growT = 0.9; D.pow = 1.5; for (const e of kinds.dust) any = stepPuff(D, e, dt, ground + 0.4) || any; }
      if (P) any = stepLines(P, sets.sparks, kinds.sparks, dt, P.gravity, true) || any;
      if (T) any = stepLines(T, sets.tracers, kinds.tracers, dt, 0, false) || any;
      for (const k of ["glow", "halo", "tongue", "fire", "puff"]) sets[k]?.commit();
      active = any || lightT < (L?.len ?? 0);
      if (!active) { root.visible = false; if (light) light.intensity = 0; }
    }
    return { root, fire, fireAt, tracer, spawn, update, get active() { return active; } };
  };

  // ── 写実版の共通部品(2026-10-17。偵察・装甲強襲の写実版で共用。PC 表示向け) ──
  // 物理ベースの材質(MeshStandardMaterial)に、塗装(3 色迷彩 / 単色)と「下ほど濃い砂ぼこり」・塗りのむらをシェーダーで足す。画像ファイルは使わない。
  //   const K = U.realKit(THREE, { sign: "偵" }); K.parent = body;   // rod / pipe / grab / seam の既定の親
  //   K.M.paint ...(材質)、K.cbox / rod / pipe / grab / bolt / boltRow / seam(部品)、K.setLook({ paint, dirt, team })、K.finish(group)(ボルトと影)、K.tick(group)(毎フレーム)
  // 汚れの高さは group の表示倍率で割った模型の単位で測る(tick が group の拡大率を読む)。迷彩の柄は部品の所有者(焼いたあとの車体・砲塔など)の座標で作る
  U.REAL_PAINTS = {
    camo: { camo: 1, c: [0x48553a, 0x5c4a36, 0x24261f] },     // NATO 3 色迷彩(緑・茶・黒)
    olive: { camo: 0, c: [0x4d5237, 0x4d5237, 0x4d5237] },
    desert: { camo: 0, c: [0xa88f68, 0xa88f68, 0xa88f68] },
    stealth: { camo: 0, c: [0x30373d, 0x30373d, 0x30373d] },  // ゲームの「ステルス」と同じ黒鉛色
  };
  const REAL_GLSL = `
    varying vec3 vCP; varying float vCH; varying vec3 vWN;
    uniform vec3 uC1, uC2, uC3, uDust; uniform float uCamo, uTint, uDustAmt, uDustK, uDustH, uScale, uBump;
    float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float vn(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
                 mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
    float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
  `;
  U.realKit = function (THREE, { sign = "", dustH = 5.0 } = {}) {
    const K = {};
    const UNIT = { value: 2 }, DUSTK = { value: 0.6 }, DUSTH = { value: dustH }, DUST = { value: new THREE.Color(0x9a8a6c) };
    const paintU = { c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() }, c3: { value: new THREE.Color() }, camo: { value: 1 } };
    const std = (c, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness, metalness, ...extra });
    // painted: 迷彩の色を使う(塗装面)。dust: 汚れの付きやすさ。tint: 塗装の明るさ(付属品は少し暗い)。頂点色は塗装面以外で掛かる
    // bump: 表面の細かい凹凸の強さ(塗装の肌・鋳物の肌・ゴムの肌。法線をシェーダーで揺らす)
    const patch = (mat, { painted = false, dust = 0.8, tint = 1, bump = 0.03 } = {}) => {
      const u = { uC1: paintU.c1, uC2: paintU.c2, uC3: paintU.c3, uCamo: painted ? paintU.camo : { value: -1 }, uTint: { value: tint }, uDust: DUST, uDustAmt: { value: dust }, uDustK: DUSTK, uDustH: DUSTH, uScale: { value: 0.11 }, uBump: { value: bump }, uUnit: UNIT };
      mat.userData.u = u;
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, u);
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vCP; varying float vCH; varying vec3 vWN; uniform float uUnit;")
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            vec4 cpos = vec4(transformed, 1.0);
            vec3 cnrm = objectNormal;
            #ifdef USE_INSTANCING
              cpos = instanceMatrix * cpos; cnrm = mat3(instanceMatrix) * cnrm;
            #endif
            vCP = cpos.xyz; vCH = (modelMatrix * cpos).y / uUnit; vWN = normalize(mat3(modelMatrix) * cnrm);`);
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + REAL_GLSL)
          .replace("#include <color_fragment>", `#include <color_fragment>
            float camoDust = 0.0;
            {
              vec3 col = diffuseColor.rgb;
              if (uCamo > -0.5) {   // 塗装面: 迷彩(または単色)
                col = uC1;
                if (uCamo > 0.5) { vec3 p = vCP * uScale; col = mix(col, uC2, smoothstep(0.50, 0.53, fbm(p))); col = mix(col, uC3, smoothstep(0.585, 0.615, fbm(p * 1.13 + vec3(7.3, 1.7, 3.1)))); }
                col *= uTint;
              }
              col *= 0.86 + 0.28 * fbm(vCP * 0.85 + 11.0);   // 塗りと汚れのむら
              float up = smoothstep(0.55, 0.95, vWN.y);
              col *= 1.0 - 0.2 * smoothstep(0.55, 0.78, fbm(vec3(vCP.x * 1.7, vCP.y * 0.12, vCP.z * 1.7) + 5.0)) * (1.0 - up);   // 縦の汚れの筋(雨だれ)
              float h = clamp((uDustH - vCH) / uDustH, 0.0, 1.0);
              camoDust = clamp(h * h * 1.7 * (0.5 + fbm(vCP * 0.45 + 3.0)) - 0.12, 0.0, 1.0);
              camoDust = max(camoDust, up * smoothstep(0.35, 0.75, fbm(vCP * 0.7 + 9.0)) * 0.45);   // 上を向いた面に積もるほこり
              camoDust *= uDustAmt * uDustK;
              col = mix(col, uDust, camoDust);
              diffuseColor.rgb = col;
            }`)
          .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.82 + 0.36 * fbm(vCP * 2.3 + 17.0)), 0.04, 1.0); roughnessFactor = mix(roughnessFactor, 0.97, camoDust); metalnessFactor = mix(metalnessFactor, 0.0, camoDust);")
          .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
            if (uBump > 0.0) {   // 表面の細かい凹凸: 高さの場の微分で法線を傾ける(three の bumpMap と同じ式。画像なし)
              float hb = fbm(vCP * 3.1) * 0.6 + fbm(vCP * 12.0 + 3.7) * 0.4 + camoDust * fbm(vCP * 6.0) * 0.8;
              vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
              vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
              float det = dot(dpx, r1);
              vec3 grad = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
              normal = normalize(abs(det) * normal - grad * uBump * faceDirection);
            }`);
      };
      return mat;
    };
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      paint: patch(std(0x48553a, 0.68, 0.05), { painted: true, dust: 1, bump: 0.04 }),
      trim: patch(std(0x48553a, 0.62, 0.08), { painted: true, dust: 0.9, tint: 0.86 }),
      rim: patch(std(0x48553a, 0.6, 0.1), { painted: true, dust: 1.1, tint: 0.9 }),
      metal: patch(std(0x33373a, 0.48, 0.7), { dust: 0.6 }),
      steel: patch(std(0x80858a, 0.32, 0.9), { dust: 0.4 }),
      black: patch(std(0x1a1c1e, 0.62, 0.15), { dust: 0.5 }),
      rubber: patch(std(0x1d1e1f, 0.92, 0), { dust: 1.2, bump: 0.12 }),
      seam: std(0x0b0d0e, 0.9, 0),
      glass: std(0x0b1512, 0.04, 0.35, { envMapIntensity: 2.4 }),
      lens: std(0x0d1418, 0.06, 0.7, { envMapIntensity: 2 }),
      lensIR: std(0x2c2b33, 0.12, 0.95, { envMapIntensity: 2 }),
      lamp: std(0xe6ecef, 0.03, 0.1, { transparent: true, opacity: 0.35, envMapIntensity: 2 }),
      chrome: std(0xdde1e4, 0.1, 1.0),
      amber: std(0xd88a1c, 0.15, 0, { emissive: 0x2a1500 }),
      red: std(0x9c1d15, 0.15, 0, { emissive: 0x200402 }),
      brass: std(0xb8913f, 0.32, 0.9),
      canvas: patch(std(0x53573d, 0.96, 0), { dust: 0.7, bump: 0.15 }),
      strap: patch(std(0x393c2b, 0.9, 0), { dust: 0.5 }),
      mast: patch(std(0x70746a, 0.38, 0.65), { dust: 0.15 }),
      team: std(0xff6a1a, 0.85, 0),
      teamPaint: patch(std(0xff6a1a, 0.55, 0.05), { dust: 0.7 }),
      ring: basic(0xff6a1a, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      glow: basic(0xff6a1a, { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      sign: new THREE.MeshBasicMaterial({ map: U.signTexture(THREE, sign), transparent: true }),
    };
    const STATIC = [M.paint, M.trim, M.rim, M.metal, M.steel, M.black, M.rubber, M.seam, M.glass, M.lens, M.lensIR, M.chrome, M.amber, M.red, M.canvas, M.strap, M.mast, M.team, M.teamPaint];
    // 部品
    const V = (x, y, z) => new THREE.Vector3(x, y, z), UP = V(0, 1, 0);
    const add = (geo, mat, parent, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (r, h, n = 16, r2 = r) => new THREE.CylinderGeometry(r, r2, h, n);
    const cylX = (r, h, n = 16, r2 = r) => cyl(r, h, n, r2).rotateZ(Math.PI / 2);
    const cylZ = (r, h, n = 16, r2 = r) => cyl(r, h, n, r2).rotateX(Math.PI / 2);
    const rect = (hw, hh, c) => [[-hw + c, -hh], [hw - c, -hh], [hw, -hh + c], [hw, hh - c], [hw - c, hh], [-hw + c, hh], [-hw, hh - c], [-hw, -hh + c]];
    const cboxCache = new Map();
    const cbox = (w, h, d, c = 0.08) => {   // 面取りした箱(c = 面取りの幅)
      const k = [w, h, d, c].join(); if (cboxCache.has(k)) return cboxCache.get(k);
      c = Math.min(c, w / 3, h / 3, d / 3);
      const g = U.loft(THREE, [{ z: -d / 2, pts: rect(w / 2 - c, h / 2 - c, c * 0.6) }, { z: -d / 2 + c, pts: rect(w / 2, h / 2, c) }, { z: d / 2 - c, pts: rect(w / 2, h / 2, c) }, { z: d / 2, pts: rect(w / 2 - c, h / 2 - c, c * 0.6) }]);
      cboxCache.set(k, g); return g;
    };
    // 2 点を結ぶ棒、点列を通る管、取っ手(面から浮かせたコの字)、継ぎ目(暗い細い棒)
    const rod = (a, b, r, mat, parent = K.parent, n = 8) => { const d = b.clone().sub(a), m = new THREE.Mesh(cyl(r, d.length(), n), mat); m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); parent.add(m); return m; };
    const pipe = (pts, r, mat, parent = K.parent, seg = 24, n = 8, closed = false) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, "catmullrom", 0.1), seg, r, n, closed), mat, parent);
    const grab = (a, b, nrm, s = 0.4, r = 0.06, mat = M.steel, parent = K.parent) => pipe([a, a.clone().addScaledVector(nrm, s), b.clone().addScaledVector(nrm, s), b], r, mat, parent, 16, 6);
    const seam = (a, b, parent = K.parent) => rod(a, b, 0.035, M.seam, parent, 4);
    // ボルト(六角、所有者ごとに 1 つの InstancedMesh にまとめる。finish で作る)。pos = 面の上の点、nrm = 面の外向き
    const bolts = new Map();
    const bolt = (owner, pos, nrm, s = 1) => { const q = new THREE.Quaternion().setFromUnitVectors(UP, nrm.clone().normalize()); (bolts.get(owner) ?? bolts.set(owner, []).get(owner)).push(new THREE.Matrix4().compose(pos, q, V(s, s, s))); };
    const boltRow = (owner, a, b, n, nrm, s = 1) => { for (let i = 0; i < n; i++) bolt(owner, a.clone().lerp(b, n === 1 ? 0.5 : i / (n - 1)), nrm, s); };
    // 焼いたあとに呼ぶ: ボルトを所有者ごとに InstancedMesh にし、不透明な部品に影を付ける
    function finish(group) {
      const boltG = cyl(0.11, 0.09, 6).translate(0, 0.045, 0);
      for (const [owner, list] of bolts) { const im = new THREE.InstancedMesh(boltG, M.trim, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); owner.add(im); }
      group.traverse((o) => {
        if ((o.isMesh || o.isInstancedMesh) && !o.material.transparent && !o.material.isMeshBasicMaterial && !o.material.isShaderMaterial) { o.castShadow = true; o.receiveShadow = true; }
        else if (o.isMesh || o.isPoints || o.isLine) o.layers.set(1);   // 半透明の粒・光・ベースプレートは層 1(ビューアの環境遮蔽の計算から外す)
      });
    }
    function setLook({ paint, dirt, team }) {
      const P = U.REAL_PAINTS[paint] ?? U.REAL_PAINTS.camo;
      paintU.camo.value = P.camo; paintU.c1.value.set(P.c[0]); paintU.c2.value.set(P.c[1]); paintU.c3.value.set(P.c[2]);
      M.team.color.copy(team); M.teamPaint.color.copy(team).multiplyScalar(0.85); M.ring.color.copy(team); M.glow.color.copy(team);
      DUSTK.value = [0, 0.6, 1][dirt];
      DUST.value.set(paint === "desert" ? 0xc8b48e : 0x9a8a6c);
    }
    const gs = new THREE.Vector3();
    const tick = (group) => { group.getWorldScale(gs); UNIT.value = gs.y || 1; };
    return Object.assign(K, { M, STATIC, std, patch, basic, V, UP, add, box, cyl, cylX, cylZ, cbox, rod, pipe, grab, seam, bolt, boltRow, finish, setLook, tick, parent: null });
  };

  (window.DreamAssets ??= {}).util = U;
})();
