// 部隊の移動線(試作)。ベースプレートと同じクレヨンの手描きで、部隊から目的地までの経路を地面に描く(ユーザー依頼 2026-10-16)。
// 構成: 経路に沿った帯(クレヨンの線のタイルを u 方向に繰り返す。plate.js の耐久の弧と同じ作り)、線の先端の塗りの矢じり ▶、目的地のぐるぐるの輪、不可のときの ×。
//   経路はゲームと同じ 4 方向の最短路(simulation/pathfinding.ts と同じ、上→右→下→左の順の幅優先)をセルの格子で探し、障害物に当たらない範囲で直線化してから
//   なめらかな曲線(Catmull-Rom)にし、手のゆらぎを足す。線はベースプレートの輪の外から始まり、矢じりの先が目的地の輪に触れる。
// 操作: 部隊をドラッグして目的地へ引く(引いている間はプレビュー、離すと確定して描き進める)。地面のセルをクリックすると障害物(岩)の切替。
//   マップの見本: なし / 川(渡れるのは橋のセルだけ)/ 山(通れない岩の塊)。障害物の上や、たどり着けないセルは不可(赤い線と ×)。
// 状態: プレビュー(墨色、薄い)/ 確定(チーム色。部隊側から 0.35 秒で描き進める)/ 不可(赤)。線は 3 枚の描き分けで震える(ベースプレートと同じ 0.25 秒)。
// 進む: 部隊が経路をたどり、通った分の線は消える。目的地に着くと線と輪が消える。進んでいる途中でもドラッグし直せる(今いる位置から引き直す)。
// 最適化(2026-10-16): 帯は経路を決めたときに 1 回組んで drawRange で区間を出す。履帯跡は固定長の頂点列に書き足し fade だけ更新。砂塵はビルボードの列 1 つ(描画呼び出し 1)。
// 動き(ユーザー指摘「動いているとき味気ない」、2026-10-16): 装軌車両らしく、出発前にその場で旋回して向きを合わせ、加速して走り、曲がるところで減速し、目的地の手前で減速して止まる。
//   加速で車首が上がり、旋回で外へ傾く。履帯と転輪は速さに合わせて回る(tank.setSpeed)。
//   その場旋回は超信地旋回(ユーザー指摘「リニアすぎる」): 角速度を加速 → 一定 → 減速の台形にし、左右の履帯を逆向きに回す(tank.setTrackSpeeds)。回り始めと止まりで車体が
//   傾き、回っている間は小さく揺れる。履帯が地面をこするので、旋回中も履帯跡(中心の周りの弧)と砂塵を出す。
//   通った地面にクレヨンの履帯跡(2 本の帯に履板の短い線を繰り返す。6 秒で薄れて消える)を残し、履帯の後ろから砂塵(やわらかいスプライト)を上げる。
//
//   const m = DreamAssets.moveline(THREE, { cell: 80 });
//   scene.add(m.group); m.setTeam("#ff6a1a"); m.setMap("none" | "river" | "mountain"); m.dragStart(x, z); m.dragTo(x, z); m.dragEnd(); m.clickCell(x, z); m.setMoving(true); m.update(dt)
(function () {
  const INK = 0x1f2a33, RED = 0xe0245e;
  const TILE_W = 512, TILE_H = 24, LINE_PX = 8;   // 線のタイル(px)と、その中の線の太さ
  const MARK = 256, HEAD = 96;                     // 目的地の輪と矢じりの層(px)
  const GRID = 14, LO = -6, HI = 7;                // セルの格子: ix, iz ∈ [-6, 7]
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];  // ゲームと同じ順(上→右→下→左)
  // マップの見本: セル → "water" | "rock" | "bridge"(橋は通れる)
  const MAPS = {
    none: () => new Map(),
    river: () => { const m = new Map(); for (let iz = LO; iz <= HI; iz++) m.set(`3,${iz}`, iz === 1 ? "bridge" : "water"); return m; },
    mountain: () => { const m = new Map(); for (let ix = 2; ix <= 4; ix++) for (let iz = -1; iz <= 2; iz++) m.set(`${ix},${iz}`, "rock"); return m; },
  };

  let LAYERS = null;
  function layers(THREE, U, K) {
    if (LAYERS) return LAYERS;
    const L = {};
    // 線のタイル: 横に 1 本。両端は固定して(つなぎ目で段差が出ない)、途中だけゆらす
    L.stroke = K.layer(THREE, U, TILE_W, TILE_H, 61, (g, rnd) => {
      const mid = K.jitter([[TILE_W * 0.2, TILE_H / 2], [TILE_W * 0.4, TILE_H / 2], [TILE_W * 0.6, TILE_H / 2], [TILE_W * 0.8, TILE_H / 2]], 4, rnd);
      K.crayon(g, [[-6, TILE_H / 2], ...mid, [TILE_W + 6, TILE_H / 2]], LINE_PX, rnd, 0.95);
    }, true);
    const C = MARK / 2, R = MARK * 0.36;
    // 目的地: ぐるぐるの輪(1 周と少し。外へ広がる)
    L.ring = K.layer(THREE, U, MARK, MARK, 67, (g, rnd) => K.crayon(g, K.loop(C, C, R, rnd, { span: Math.PI * 2.6, wob: 0.05, steps: 110, drift: 0.08 }), 6, rnd, 0.95));
    // 不可: 輪の中の ×
    L.cross = K.layer(THREE, U, MARK, MARK, 71, (g, rnd) => {
      const s = R * 0.55;
      K.crayon(g, K.jitter([[C - s, C - s], [C + s, C + s]], 5, rnd), 7, rnd, 0.9); K.crayon(g, K.jitter([[C + s, C - s], [C - s, C + s]], 5, rnd), 7, rnd, 0.9);
    });
    // 履帯跡のタイル: 横に並ぶ短い縦線(履板の跡)。u 方向に繰り返す
    L.tread = K.layer(THREE, U, 128, 24, 79, (g, rnd) => { for (let x = 5; x < 128; x += 9) K.crayon(g, K.jitter([[x, 4], [x + 1, 20]], 2, rnd), 3, rnd, 0.8); }, true);
    // 矢じり: +x へ向く塗りの ▶(塗りつぶしの上にクレヨンの輪郭。紙目で抜けてクレヨンの塗りになる)
    L.head = K.layer(THREE, U, HEAD, HEAD, 73, (g, rnd) => {
      const tri = K.jitter([[HEAD * 0.08, HEAD * 0.12], [HEAD * 0.96, HEAD * 0.5], [HEAD * 0.08, HEAD * 0.88]], 3, rnd);
      g.fillStyle = "#fff"; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(...tri[0]); g.lineTo(...tri[1]); g.lineTo(...tri[2]); g.closePath(); g.fill(); g.globalAlpha = 1;
      K.crayon(g, [...tri, tri[0]], 5, rnd, 0.95);
    });
    return (LAYERS = L);
  }

  function moveline(THREE, opts = {}) {
    const U = DreamAssets.util, K = DreamAssets.crayon, L = layers(THREE, U, K);
    const cell = opts.cell ?? 80, LINE_W = opts.width ?? 12;   // セルの一辺、帯の幅(ゲームの単位)。線はその中の 8/24(約 4)
    const TILE_LEN = TILE_W * LINE_W / TILE_H;                  // タイル 1 枚ぶんの経路の長さ(単位)
    const HEAD_W = LINE_W * 2.4;                                // 矢じりの板の一辺(▶ の長さは その 0.88)
    const group = new THREE.Group(); group.name = "moveline";
    // セルの格子(セルの中心が整数 × cell に来るよう半セルずらす)
    const grid = new THREE.GridHelper(cell * GRID, GRID, 0xc3cbd3, 0xdfe4e9); grid.position.set(cell / 2, 0.06, cell / 2); group.add(grid);
    // 部隊(ベースプレート + 装甲強襲)
    const tank = DreamAssets.tank(THREE), plate = DreamAssets.plate(THREE, { r: tank.plateRadius * 2, unit: tank }); group.add(plate.group);
    const plateR = tank.plateRadius * 2;
    // 板: 層を色で染めた地面の板
    const boards = new THREE.Group(); group.add(boards);
    const board = (frames, color, size, order) => {
      const mat = new THREE.MeshBasicMaterial({ color, alphaMap: frames[0], transparent: true, depthWrite: false });
      const geo = new THREE.PlaneGeometry(size, size); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat); m.position.y = 0.3 + order * 0.01; m.renderOrder = 1 + order; m.userData.frames = frames; m.visible = false; boards.add(m); return m;
    };
    const ringR = plateR * 0.8, ring = board(L.ring, INK, ringR / 0.36, 1);       // 輪の半径を ringR に(層の輪は 0.36 × 幅)
    const cross = board(L.cross, RED, ringR / 0.36, 2);
    const head = board(L.head, INK, HEAD_W, 2);
    const strokeMat = new THREE.MeshBasicMaterial({ color: INK, alphaMap: L.stroke[0], transparent: true, depthWrite: false });
    const ribbon = new THREE.Mesh(new THREE.BufferGeometry(), strokeMat); ribbon.position.y = 0.3; ribbon.renderOrder = 1; ribbon.userData.frames = L.stroke; ribbon.frustumCulled = false; boards.add(ribbon);

    // ── マップ: 障害物のセル(水・岩)と橋。見た目は水面(共通の水)、岩の台、橋の板 ──
    const terrain = new THREE.Group(); group.add(terrain);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x3b4752, transparent: true, opacity: 0.5 }), add = U.adder(THREE, edgeMat, 25);
    const waterMat = U.waterMaterial(THREE, { repeat: [cell / U.WATER_TILE[0], cell / U.WATER_TILE[1]] });
    const rockMat = new THREE.MeshLambertMaterial({ color: 0xc9d0d7 }), bridgeMat = new THREE.MeshLambertMaterial({ color: 0xe9edf1 });
    let cells = MAPS.none(), mapName = "none";
    const key = (ix, iz) => `${ix},${iz}`, inGrid = (ix, iz) => ix >= LO && ix <= HI && iz >= LO && iz <= HI;
    const blocked = (ix, iz) => { if (!inGrid(ix, iz)) return true; const k = cells.get(key(ix, iz)); return k === "water" || k === "rock"; };
    const toCell = (x, z) => [Math.round(x / cell), Math.round(z / cell)];
    function buildTerrain() {
      for (const ch of [...terrain.children]) { terrain.remove(ch); ch.traverse((o) => { o.geometry?.dispose?.(); }); }
      for (const [k, kind] of cells) {
        const [ix, iz] = k.split(",").map(Number), x = ix * cell, z = iz * cell;
        if (kind === "water" || kind === "bridge") { const w = new THREE.Mesh(new THREE.PlaneGeometry(cell, cell).rotateX(-Math.PI / 2), waterMat); w.position.set(x, 0.1, z); terrain.add(w); }
        if (kind === "bridge") add(new THREE.BoxGeometry(cell + 2, 1.6, cell * 0.42), bridgeMat, terrain, { x, y: 1.0, z });
        if (kind === "rock") add(new THREE.BoxGeometry(cell - 6, 5, cell - 6), rockMat, terrain, { x, y: 2.5, z });
      }
    }
    // ゲームと同じ 4 方向の幅優先(from を含まないセル列。たどり着けなければ null)
    function findPath(from, to) {
      if (blocked(...to)) return null;
      if (from[0] === to[0] && from[1] === to[1]) return [];
      const parent = new Map([[key(...from), null]]), queue = [from];
      while (queue.length) {
        const [x, z] = queue.shift();
        for (const [dx, dz] of DIRS) {
          const nx = x + dx, nz = z + dz, k = key(nx, nz);
          if (blocked(nx, nz) || parent.has(k)) continue;
          parent.set(k, key(x, z)); queue.push([nx, nz]);
          if (nx === to[0] && nz === to[1]) { queue.length = 0; break; }
        }
      }
      if (!parent.has(key(...to))) return null;
      const out = []; for (let k = key(...to); k !== key(...from); k = parent.get(k)) out.push(k.split(",").map(Number));
      return out.reverse();
    }
    // 直線化: 障害物に当たらない範囲で先のセルへ直接つなぐ(階段状の最短路を、手で引いた 1 本の線にする)
    // 線が障害物の角をかすめないよう、各点の前後左右 1/4 セルも空いていることを求める
    const M = cell * 0.25, clear = (ax, az, bx, bz) => {
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
      for (let i = 0; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t; for (const [dx, dz] of [[0, 0], [M, 0], [-M, 0], [0, M], [0, -M]]) if (blocked(...toCell(x + dx, z + dz))) return false; }
      return true;
    };
    function simplify(pts) {
      const out = [pts[0]]; let i = 0;
      while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !clear(pts[i][0], pts[i][1], pts[j][0], pts[j][1])) j--; out.push(pts[j]); i = j; }
      return out;
    }

    // ── 経路: 部隊の今の位置 → セル列(直線化)→ なめらかな曲線 → 手のゆらぎ ──
    let curve = null, samples = [], total = 0, target = null;   // target = 目的地のセル
    const rnd0 = U.rng(3), ph1 = rnd0() * 6, ph2 = rnd0() * 6;
    const unitPos = new THREE.Vector3(), tmp = new THREE.Vector3(), tmpT = new THREE.Vector3();
    let heading = 0;
    function plan(to) {
      target = to;
      const from = toCell(unitPos.x, unitPos.z), path = findPath(from, to);
      if (!path) { curve = null; samples = []; total = 0; return false; }
      let pts = [[unitPos.x, unitPos.z], ...path.map(([ix, iz]) => [ix * cell, iz * cell])];
      pts = simplify(pts).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 4);
      if (pts.length < 2) { curve = null; samples = []; total = 0; return true; }
      curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal", 0.5);
      total = curve.getLength();
      const n = Math.max(12, Math.round(total / 4)); samples = [];
      for (let k = 0; k <= n; k++) {
        const u = k / n, s = u * total; curve.getPointAt(u, tmp); curve.getTangentAt(u, tmpT);
        const wob = 1.4 * Math.sin(s * 0.045 + ph1) + 2.2 * Math.sin(s * 0.011 + ph2);   // 手のゆらぎ(経路に直交)
        samples.push({ s, x: tmp.x - tmpT.z * wob, z: tmp.z + tmpT.x * wob, tx: tmpT.x, tz: tmpT.z });
      }
      buildRibbon(total - ringR - HEAD_W * 0.9);   // 矢じりの根元まで
      return true;
    }
    const at = (s) => {   // 経路上の距離 s の点と向き(ゆらぎなし)
      if (!curve) return { x: unitPos.x, z: unitPos.z, tx: Math.sin(heading), tz: Math.cos(heading) };
      const u = Math.max(0, Math.min(1, s / total)), p = curve.getPointAt(u), t = curve.getTangentAt(u); return { x: p.x, z: p.z, tx: t.x, tz: t.z };
    };
    // 帯: 経路を決めたときに 1 回だけ組み(矢じりの根元 end まで)、毎フレームは drawRange で「距離 from から、進み具合 draw(0..1)まで」の区間を出す(最適化 2026-10-16)
    let ribbonPts = [];
    function buildRibbon(end) {
      ribbonPts = samples.filter((q) => q.s <= end);
      if (ribbonPts.length < 2) { ribbon.visible = false; return; }
      const N = ribbonPts.length, pos = new Float32Array(N * 6), uv = new Float32Array(N * 4), idx = [];
      ribbonPts.forEach((q, i) => {
        const nx = -q.tz, nz = q.tx, w = LINE_W / 2;
        pos.set([q.x - nx * w, 0, q.z - nz * w, q.x + nx * w, 0, q.z + nz * w], i * 6); uv.set([q.s / TILE_LEN, 0, q.s / TILE_LEN, 1], i * 4);
        if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
      });
      ribbon.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); ribbon.geometry = g;
    }
    function showRibbon(from, draw) {
      let start = 0; while (start < ribbonPts.length && ribbonPts[start].s < from) start++;
      const segs = Math.floor((ribbonPts.length - 1 - start) * draw);
      ribbon.visible = segs > 0; if (ribbon.visible) ribbon.geometry.setDrawRange(start * 6, segs * 6);
    }

    // ── 履帯跡: 通った位置の列から 2 本の帯を毎フレーム組み直す。古い点から薄れる(頂点ごとの fade を alpha に掛ける) ──
    const TRACK_X = 9.55 * 2, TRACK_W = 3.2 * 2, REAR = 30, MARK_LIFE = 6, MARK_STEP = 6;   // 履帯の位置・幅(装甲強襲 × 表示 2.0)、後端、跡の寿命(秒)と点の間隔
    const treadMat = new THREE.MeshBasicMaterial({ color: INK, alphaMap: L.tread[0], transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    treadMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float fade; varying float vFade;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvFade = fade;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vFade;").replace("#include <alphamap_fragment>", "#include <alphamap_fragment>\ndiffuseColor.a *= vFade;");
    };
    // 跡の帯は固定長の頂点列に書き足す(最適化 2026-10-16: 毎フレームの作り直しをやめ、fade だけ更新して drawRange で区間を出す)。CAP を超えたら生きている分を先頭へ詰める
    const CAP = 400, tPos = new Float32Array(CAP * 12), tUv = new Float32Array(CAP * 8), tFade = new Float32Array(CAP * 4), tIdx = new Uint16Array((CAP - 1) * 12);
    for (let i = 1; i < CAP; i++) for (const k of [0, 1]) { const a = ((i - 1) * 2 + k) * 2, b = (i * 2 + k) * 2; tIdx.set([a, a + 1, b, a + 1, b + 1, b], (i - 1) * 12 + k * 6); }
    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage)); tGeo.setAttribute("uv", new THREE.BufferAttribute(tUv, 2).setUsage(THREE.DynamicDrawUsage));
    tGeo.setAttribute("fade", new THREE.BufferAttribute(tFade, 1).setUsage(THREE.DynamicDrawUsage)); tGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
    const treads = new THREE.Mesh(tGeo, treadMat); treads.position.y = 0.28; treads.renderOrder = 0; treads.frustumCulled = false; treads.visible = false; treads.userData.frames = L.tread; boards.add(treads);
    const markT = new Float32Array(CAP); let mStart = 0, mHead = 0;   // 生きている跡の区間 [mStart, mHead)
    let markS = 0, clockT = 0;
    const writeMark = (i, x, z, nx, nz, sDist) => {
      const u = sDist / (128 * TRACK_W / 24);
      for (const k of [0, 1]) {   // 左右の履帯
        const side = k ? 1 : -1, cx = x + nx * TRACK_X * side, cz = z + nz * TRACK_X * side, o = (i * 2 + k) * 2;
        tPos.set([cx - nx * TRACK_W / 2, 0, cz - nz * TRACK_W / 2, cx + nx * TRACK_W / 2, 0, cz + nz * TRACK_W / 2], o * 3); tUv.set([u, 0, u, 1], o * 2);
      }
    };
    function pushMark(x, z, nx, nz, sDist) {
      if (mHead >= CAP) {   // 先頭へ詰める
        const n = mHead - mStart; tPos.copyWithin(0, mStart * 12, mHead * 12); tUv.copyWithin(0, mStart * 8, mHead * 8); markT.copyWithin(0, mStart, mHead); mStart = 0; mHead = n;
        tGeo.attributes.position.needsUpdate = tGeo.attributes.uv.needsUpdate = true;
      }
      writeMark(mHead, x, z, nx, nz, sDist); markT[mHead] = clockT; mHead++;
      tGeo.attributes.position.needsUpdate = tGeo.attributes.uv.needsUpdate = true;
    }
    function buildTreads() {
      while (mStart < mHead && clockT - markT[mStart] > MARK_LIFE) mStart++;
      if (mHead - mStart < 2) { treads.visible = false; return; }
      for (let i = mStart; i < mHead; i++) { const f = Math.max(0, 1 - (clockT - markT[i]) / MARK_LIFE); tFade[i * 4] = tFade[i * 4 + 1] = tFade[i * 4 + 2] = tFade[i * 4 + 3] = f; }
      tGeo.attributes.fade.needsUpdate = true; tGeo.setDrawRange(mStart * 12, (mHead - mStart - 1) * 12); treads.visible = true;
    }
    // ── 砂塵: 履帯の後ろから上がる(装甲強襲のリアル版と同じやわらかいスプライト) ──
    // 粒はビルボードの列(U.billboards)にまとめ、描画呼び出し 1(最適化 2026-10-16。以前はスプライト 24 枚 = 24)
    const puffTex = U.puffTexture(THREE), rngD = U.rng(17), rd = (a, b) => a + rngD() * (b - a), DUST_COL = new THREE.Color(0xa89b80);
    const bbDust = U.billboards(THREE, { map: puffTex, count: 24 }); group.add(bbDust.mesh);
    const puffs = Array.from({ length: 24 }, (_, i) => ({ i, t: 1, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s0: 1, spin: 0, rot: rd(0, 6.28) }));
    let dustS = 0;
    function spawnDust(x, z, bx, bz) {   // 位置と後ろ向きの単位ベクトル
      const d = puffs.find((q) => q.t >= q.max); if (!d) return;
      d.t = 0; d.max = rd(1.0, 1.7); d.s0 = rd(3, 5); d.spin = rd(-0.6, 0.6);
      d.p.set(x + rd(-2, 2), 1.5, z + rd(-2, 2)); d.v.set(bx * rd(6, 14) + rd(-3, 3), rd(4, 8), bz * rd(6, 14) + rd(-3, 3));
    }
    function updateDust(dt) {
      for (const d of puffs) {
        if (d.t >= d.max) { bbDust.hide(d.i); continue; }
        d.t += dt; const u = d.t / d.max;
        d.v.multiplyScalar(Math.exp(-1.8 * dt)); d.p.addScaledVector(d.v, dt); d.rot += d.spin * dt;
        bbDust.set(d.i, d.p.x, d.p.y, d.p.z, d.s0 + 20 * (1 - Math.exp(-d.t / 0.8)), d.rot, DUST_COL, 0.7 * Math.min(1, d.t / 0.1) * Math.pow(Math.max(0, 1 - u), 1.4));   // 白い床でも見える濃さ
      }
      bbDust.commit();
    }

    // ── 状態 ──
    let state = "idle", team = "#ff6a1a", moving = false, prog = 0, drawT = 1, frame = 0, boilT = 0, dragging = false;
    // 車両の動き: その場旋回 → 加速 → 曲がりで減速 → 手前で減速して停止
    const VMAX = 70, ACC = 45, DEC = 55, YAW_MAX = 1.1, YAW_ACC = 2.4;   // 速さ(単位/秒)、加速・減速(単位/秒²)、超信地旋回の最高角速度(rad/秒)と角加速度(rad/秒²)
    let speed = 0, accel = 0, yawRate = 0, yawAcc = 0, pitch = 0, roll = 0, phase = "turn";
    const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    function updateMotion(dt) {
      if (!moving || !curve) { speed = accel = yawRate = 0; }
      else {
        const ahead = at(Math.min(total, prog + 6)), want = Math.atan2(ahead.tx, ahead.tz), d = angDiff(want, heading);
        if (phase === "turn") {   // 超信地旋回(向きが合うまで走らない): 角速度は加速 → 一定 → 減速の台形。残りの角度で止まれる速さまで
          const dir = Math.sign(d) || 1, wT = dir * Math.min(YAW_MAX, Math.sqrt(2 * YAW_ACC * Math.abs(d)));
          const nw = yawRate + Math.max(-YAW_ACC * dt, Math.min(YAW_ACC * dt, wT - yawRate));
          yawAcc = (nw - yawRate) / dt; yawRate = nw; heading += yawRate * dt; speed = accel = 0;
          const k = Math.abs(yawRate) / YAW_MAX * 1.3;   // 左右の履帯を逆に回す(右旋回 = 左が前、右が後ろ)
          tank.setTrackSpeeds(dir * k, -dir * k);
          // 履帯が地面をこする: 中心の周りの弧の跡と砂塵(履帯の進んだ距離 = 角速度 × 履帯の位置)
          const scrub = Math.abs(yawRate) * TRACK_X * dt; markS += scrub; dustS += scrub;
          if (markS >= MARK_STEP) { markS = 0; pushMark(unitPos.x, unitPos.z, -Math.cos(heading), Math.sin(heading), prog + clockT * TRACK_X); }
          if (dustS >= 6 && Math.abs(yawRate) > 0.2) { dustS = 0; for (const side of [-1, 1]) { const fwd = side < 0 ? dir : -dir; spawnDust(unitPos.x + Math.cos(heading) * TRACK_X * side - Math.sin(heading) * fwd * 20, unitPos.z - Math.sin(heading) * TRACK_X * side - Math.cos(heading) * fwd * 20, -Math.sin(heading) * fwd, -Math.cos(heading) * fwd); } }
          if (Math.abs(d) < 0.02 && Math.abs(yawRate) < 0.06) { phase = "run"; yawRate = yawAcc = 0; tank.setSpeed(0); }
        } else {
          const vCurve = VMAX * Math.max(0.3, 1 - Math.abs(d) * 2.5), vStop = Math.sqrt(2 * DEC * Math.max(0, total - prog));   // 曲がりで減速、手前で減速
          const vT = Math.min(VMAX, vCurve, vStop), nv = Math.max(0, Math.min(vT, speed + (vT > speed ? ACC : -DEC) * dt));
          accel = (nv - speed) / dt; speed = nv; prog = Math.min(total, prog + speed * dt);
          const p = at(prog); unitPos.set(p.x, 0, p.z);
          const step = Math.sign(d) * Math.min(Math.abs(d), YAW_MAX * 1.6 * dt); heading += step; yawRate = step / dt; yawAcc = 0;   // 走りながら向きを合わせる
          // 履帯跡と砂塵(走った距離ごと)
          const bx = -Math.sin(heading), bz = -Math.cos(heading), rx = unitPos.x + bx * REAR, rz = unitPos.z + bz * REAR;
          markS += speed * dt; dustS += speed * dt;
          if (markS >= MARK_STEP) { markS = 0; pushMark(unitPos.x, unitPos.z, -Math.cos(heading), Math.sin(heading), prog + clockT * TRACK_X); }   // 跡は車体の中心の下に置く(旋回の弧とつながる)。nx, nz = 進行方向の左(帯の頂点の並びを移動線と同じにして表向きにする)
          if (dustS >= 7 && speed > 12) { dustS = 0; for (const side of [-1, 1]) spawnDust(rx + Math.cos(heading) * TRACK_X * side, rz - Math.sin(heading) * TRACK_X * side, bx, bz); }   // 左右の履帯から
          if (prog >= total - 0.5) { moving = false; state = "idle"; curve = null; samples = []; total = 0; prog = 0; speed = 0; }
        }
      }
      // 加速で車首が上がり、旋回で外へ傾く。超信地旋回では回り始め・止まりの角加速度で傾き、回っている間は小さく揺れる
      const pivot = phase === "turn" && moving ? Math.min(1, Math.abs(yawRate) / YAW_MAX) : 0;
      pitch += (-accel * 0.0015 - pivot * 0.012 - pitch) * Math.min(1, dt * 6);
      roll += (yawRate * speed * 0.0012 + yawAcc * 0.018 + pivot * 0.01 * Math.sin(clockT * 9) - roll) * Math.min(1, dt * 6);
      tank.group.rotation.x = pitch; tank.group.rotation.z = roll;
      if (phase !== "turn" || !moving) tank.setSpeed(speed / 55);
      tank.setMoving(speed > 0.5 || Math.abs(yawRate) > 0.02);
    }
    function place() {
      plate.group.position.copy(unitPos); plate.group.rotation.y = heading;
      if (target) { const ex = target[0] * cell, ez = target[1] * cell; ring.position.x = cross.position.x = ex; ring.position.z = cross.position.z = ez; }
      const tipS = total - ringR, h = at(tipS - HEAD_W / 2);   // 矢じりの先が輪に触れる
      head.position.x = h.x; head.position.z = h.z; head.rotation.y = Math.atan2(-h.tz, h.tx);
      apply();
    }
    function apply() {
      const col = state === "invalid" ? RED : state === "ordered" ? team : INK, op = state === "preview" ? 0.6 : 0.95;
      strokeMat.color.set(col); strokeMat.opacity = op; ring.material.color.set(col); ring.material.opacity = op; head.material.color.set(col); head.material.opacity = op;
      const show = state !== "idle" && !!target;
      ring.visible = show; cross.visible = show && state === "invalid"; head.visible = show && state !== "invalid" && drawT >= 1 && !!curve;
      if (show && curve) showRibbon(prog + plateR * 0.95, drawT); else ribbon.visible = false;   // 線はベースプレートの輪の外から
      plate.setState(dragging ? "selected" : "idle");
      setFrame();
    }
    const setFrame = () => { for (const m of boards.children) if (m.userData.frames) m.material.alphaMap = m.userData.frames[frame % m.userData.frames.length]; };
    function update(dt) {
      clockT += dt; plate.update(dt); waterMat.map.offset.y -= dt * 0.08;
      if ((boilT -= dt) <= 0) { boilT = 0.25; frame = (frame + 1) % K.FRAMES; setFrame(); }
      if (drawT < 1) { drawT = Math.min(1, drawT + dt / 0.35); apply(); }
      const was = moving; updateMotion(dt);
      if (was) place();
      buildTreads(); updateDust(dt);
    }
    // ── 操作(ビューアがポインタから地面の座標を渡す) ──
    const hitUnit = (x, z) => Math.hypot(x - unitPos.x, z - unitPos.z) <= plateR;
    function dragStart(x, z) { dragging = true; moving = false; prog = 0; state = "preview"; target = null; curve = null; drawT = 1; place(); }
    function dragTo(x, z) {
      const to = toCell(x, z); if (!inGrid(...to)) return;
      if (target && to[0] === target[0] && to[1] === target[1]) return;
      state = plan(to) ? "preview" : "invalid"; place();
    }
    function dragEnd() {
      dragging = false;
      if (state === "preview" && curve) { state = "ordered"; drawT = 0; } else if (state === "preview") state = "idle";
      place();
    }
    function clickCell(x, z) {   // 岩の切替(部隊のいるセルと水・橋は変えない)。経路があれば引き直す
      const c = toCell(x, z), k = key(...c); if (!inGrid(...c) || (c[0] === toCell(unitPos.x, unitPos.z)[0] && c[1] === toCell(unitPos.x, unitPos.z)[1])) return;
      const kind = cells.get(k); if (kind === "water" || kind === "bridge") return;
      if (kind === "rock") cells.delete(k); else cells.set(k, "rock");
      buildTerrain(); replan();
    }
    function replan() { if (target && state !== "idle") { const keep = prog; prog = 0; state = plan(target) ? (state === "ordered" ? "ordered" : "preview") : "invalid"; if (curve) prog = Math.min(keep, total); place(); } }
    function setMap(name) { mapName = name; cells = (MAPS[name] ?? MAPS.none)(); buildTerrain(); replan(); }
    function setMoving(b) { moving = b && !!curve && state === "ordered"; if (moving) { phase = "turn"; yawRate = yawAcc = 0; markS = MARK_STEP; } }
    function setState(s) { if (s === "ordered" && curve) { state = "ordered"; drawT = 0; } else if (s === "preview" && curve) state = "preview"; else if (s === "idle") { state = "idle"; target = null; curve = null; } place(); }
    function setTeam(c) { team = c ?? "#8f98a3"; plate.setTeam(c); apply(); }
    // 初期状態: 川のマップで、橋を回る経路を確定済み
    setMap(opts.map ?? "river"); plan([5, 0]); state = "ordered"; drawT = 1; place(); setTeam(opts.team ?? "#ff6a1a");
    return {
      group, update, setTeam, stats: () => U.stats(boards), parts: { plate: plate.parts.plate, grid, boards, terrain },
      hitUnit, dragStart, dragTo, dragEnd, clickCell, setMap, get map() { return mapName; }, setState, get state() { return state; },
      setMoving, get moving() { return moving; }, get hasRoute() { return !!curve; }, get length() { return total; },
      get speed() { return speed; },
      clearRocks() { for (const [k, v] of [...cells]) if (v === "rock" && MAPS[mapName]().get(k) !== "rock") cells.delete(k); buildTerrain(); replan(); },
    };
  }

  (window.DreamAssets ??= {}).moveline = moveline;
})();
