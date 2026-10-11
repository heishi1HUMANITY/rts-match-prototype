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
      if (o.isMesh || o.isLine || o.isPoints) { draws++; mats.add(o.material); }
      if (o.isMesh) { meshes++; const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; tris += n * (o.isInstancedMesh ? o.count : 1); }
    });
    return { tris: Math.round(tris), draws, meshes, materials: mats.size };
  };

  (window.DreamAssets ??= {}).util = U;
})();
