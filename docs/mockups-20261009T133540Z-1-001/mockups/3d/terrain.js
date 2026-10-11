// 地形(川・山)の詳細版モデル(試作)。地形は「データ」で渡す: 盤面のセル数と、川(等級つきの折れ線)・山(等級つきの稜線)を何本でも。
// データ → ゲームと同じ 80 四方のセル(陸 / 川 / 山)→ 見た目、の順に作るので、セルはそのまま通行判定に使える。
// 川: 等級ごとに幅・深さ・岸のつくりを変える(I 小川: 細く浅い、土の岸 / II 川: 2セル、コンクリートの護岸 / III 大河: 3セル、深く、両岸に堤防)。
//     水面は中央水門・港と共通の水(半透明のシアンに白い流れの線)。線は川ごとの折れ線に沿って、下流(折れ線の向き)へ流れる。
// 山: 稜線のまわりのセルをぼかした値を高さの元にし、等高線ごとに一定の厚みの板を積む(等高線模型)。標高等級で高さが変わる(I 約80 / II 約140)。
//
//   const t = DreamAssets.terrain(THREE, { layout: "confluence" });      // 見本: "confluence" | "compare"、またはデータそのもの
//   t.setLayout({ cols: 20, rows: 14, rivers: [{ cls: 2, path: [[x, z], ...] }], mountains: [{ cls: 1, path: [[x, z], ...], width: 130 }] });
//   t.randomize(seed); scene.add(t.group); t.update(dt)
(function () {
  const CELL = 80, S = 10, STEP = 6;                                             // セル、標本の間隔、等高線の間隔
  const LAND = 18, WATER = LAND - 2.5;                                           // 陸の高さ(盤面の底 = 0)、水面
  // 川の等級: 半幅(セル何列ぶんか)、深さ、岸の斜面(川の値のどこからどこまでで下がるか)、堤防の高さ、岸の色
  const RIVER = {
    1: { half: 40, depth: 4, bank: [0.42, 0.72], levee: 0, bankColor: 0xdfe3df },
    2: { half: 80, depth: 8, bank: [0.3, 0.5], levee: 0, bankColor: 0xb9c2ca },
    3: { half: 120, depth: 13, bank: [0.28, 0.45], levee: 7, bankColor: 0xb9c2ca },
  };
  const PEAK = { 1: 95, 2: 165 };                                                // ノイズで少し下がり、頂はおよそ I 80 / II 140
  // 見本の配置
  const PRESETS = {
    // 合流: 大河(III)が手前を流れ、奥から川(II)が合流、その川に小川(I)が合流。左奥に山塊(I)、右奥に山脈(II)
    confluence: {
      cols: 20, rows: 14,
      rivers: [
        { cls: 3, path: [[-840, 300], [-500, 250], [-150, 330], [200, 280], [500, 360], [840, 320]] },
        { cls: 2, path: [[150, -600], [120, -350], [20, -150], [60, 50], [0, 300]] },
        { cls: 1, path: [[-430, -600], [-380, -400], [-250, -250], [-80, -180], [40, -150]] },
      ],
      mountains: [
        { cls: 1, path: [[-660, -330], [-600, -60]], width: 130 },
        { cls: 2, path: [[320, -430], [520, -320], [640, -120]], width: 115 },
      ],
    },
    // 比較: 3等級の川を同じ向きに並べる
    compare: {
      cols: 20, rows: 14,
      rivers: [
        { cls: 1, path: [[-840, -420], [-400, -380], [0, -440], [400, -390], [840, -430]] },
        { cls: 2, path: [[-840, -80], [-400, -40], [0, -100], [400, -50], [840, -90]] },
        { cls: 3, path: [[-840, 330], [-400, 370], [0, 310], [400, 360], [840, 320]] },
      ],
      mountains: [],
    },
  };

  function terrain(THREE, opts = {}) {
    const U = DreamAssets.util;
    const group = new THREE.Group(); group.name = "terrain";
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const M = {
      land: lambert(0xffffff, { flatShading: true, vertexColors: true }), skirt: lambert(0x3b4752), side: lambert(0xc9d0d7, { side: THREE.DoubleSide }),
      mtn: lambert(0xffffff, { vertexColors: true }), mtnEdge: new THREE.LineBasicMaterial({ color: 0x8f98a3, transparent: true, opacity: 0.55 }),
      shore: new THREE.LineBasicMaterial({ color: 0x3b4752, transparent: true, opacity: 0.45 }),
      cut: new THREE.MeshBasicMaterial({ color: 0x1fb4e0, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }),
    };
    const water = U.waterMaterial(THREE), TILE = U.WATER_TILE.map((v) => v * 3);   // 施設(表示倍率 3)と線の大きさを合わせる

    // ── 盤面の大きさ(配置ごとに変わる)と、標本の格子 ──
    let COLS, ROWS, W, H, NX, NZ, X0, Z0;
    const gx = (i) => X0 + i * S, gz = (j) => Z0 + j * S;
    const cx = (a) => X0 + (a + 0.5) * CELL, cz = (b) => Z0 + (b + 0.5) * CELL;
    // セルの値をぼかして標本の格子へ。盤面の外は端のセルを延長する
    function blur(cellVal, sigma) {
      const out = new Float32Array(NX * NZ), R = Math.ceil((sigma * 3) / CELL) + 1;
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const x = gx(i), z = gz(j), ci = Math.floor((x - X0) / CELL), cj = Math.floor((z - Z0) / CELL);
        let sum = 0, wsum = 0;
        for (let b = cj - R; b <= cj + R; b++) for (let a = ci - R; a <= ci + R; a++) {
          const w = Math.exp(-((x - cx(a)) ** 2 + (z - cz(b)) ** 2) / (2 * sigma * sigma));
          sum += w * cellVal[Math.min(ROWS - 1, Math.max(0, b)) * COLS + Math.min(COLS - 1, Math.max(0, a))]; wsum += w;
        }
        out[j * NX + i] = sum / wsum;
      }
      return out;
    }
    // 折れ線までの距離、折れ線に沿った距離と横の距離(符号つき)
    const along = (px, pz, line) => {
      let best = Infinity, out = [Infinity, 0, 0], acc = 0;
      for (let k = 0; k < line.length - 1; k++) {
        const [ax, az] = line[k], [bx, bz] = line[k + 1], dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (len * len)));
        const d = Math.hypot(px - ax - dx * t, pz - az - dz * t);
        if (d < best) { best = d; out = [d, acc + t * len, ((px - ax) * dz - (pz - az) * dx) / len]; }
        acc += len;
      }
      return out;
    };
    // 決まった値のノイズ
    const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vnoise = (x, z, f) => {
      const X = x / f, Z = z / f, a = Math.floor(X), b = Math.floor(Z), u = X - a, v = Z - b, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      return (hash(a, b) * (1 - su) + hash(a + 1, b) * su) * (1 - sv) + (hash(a, b + 1) * (1 - su) + hash(a + 1, b + 1) * su) * sv;
    };
    const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

    // ── 等高線(マーチング・スクエア)。閉じた輪を返す。盤面の外側は低い値で囲む ──
    function contours(field, level) {
      const val = (i, j) => (i < 0 || j < 0 || i >= NX || j >= NZ ? -1e9 : field[j * NX + i]);
      const P = new Map(), next = new Map();
      const pt = (key, x, z) => { if (!P.has(key)) P.set(key, [x, z]); return key; };
      const ex = (i, j) => { const a = val(i, j), b = val(i + 1, j), t = (level - a) / (b - a); return pt(`h${i},${j}`, gx(i) + S * t, gz(j)); };      // 横の辺
      const ez = (i, j) => { const a = val(i, j), b = val(i, j + 1), t = (level - a) / (b - a); return pt(`v${i},${j}`, gx(i), gz(j) + S * t); };      // 縦の辺
      for (let j = -1; j < NZ; j++) for (let i = -1; i < NX; i++) {
        const a = val(i, j) >= level, b = val(i + 1, j) >= level, c = val(i + 1, j + 1) >= level, d = val(i, j + 1) >= level;
        const k = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
        if (k === 0 || k === 15) continue;
        const T = () => ex(i, j), R = () => ez(i + 1, j), B = () => ex(i, j + 1), L = () => ez(i, j);
        // 高い側を左に見て進む向きでつなぐ(輪の向きがそろう)
        const mid = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 >= level;
        const segs = {
          1: [[L, T]], 2: [[T, R]], 3: [[L, R]], 4: [[R, B]], 6: [[T, B]], 7: [[L, B]], 8: [[B, L]], 9: [[B, T]], 11: [[B, R]], 12: [[R, L]], 13: [[R, T]], 14: [[T, L]],
          5: mid ? [[L, B], [R, T]] : [[L, T], [R, B]], 10: mid ? [[T, L], [B, R]] : [[T, R], [B, L]],
        }[k];
        for (const [f, g] of segs) next.set(f(), g());
      }
      const loops = [], seen = new Set();
      for (const start of next.keys()) {
        if (seen.has(start)) continue;
        const loop = []; let k = start;
        while (k !== undefined && !seen.has(k)) { seen.add(k); loop.push(P.get(k)); k = next.get(k); }
        if (loop.length > 2) loops.push(loop);
      }
      return loops;
    }
    const area = (l) => { let s = 0; for (let k = 0; k < l.length; k++) { const [ax, az] = l[k], [bx, bz] = l[(k + 1) % l.length]; s += ax * bz - bx * az; } return s / 2; };
    const inside = ([px, pz], l) => { let c = false; for (let k = 0, m = l.length - 1; k < l.length; m = k++) { const [ax, az] = l[k], [bx, bz] = l[m]; if (az > pz !== bz > pz && px < ((bx - ax) * (pz - az)) / (bz - az) + ax) c = !c; } return c; };
    // 輪 → 穴つきの Shape(shape の y = 世界の z)
    function shapes(loops) {
      const outer = loops.filter((l) => Math.abs(area(l)) > S * S), list = [];
      for (const l of outer) if (outer.filter((o) => o !== l && inside(l[0], o)).length % 2 === 0) list.push({ l, holes: [] });
      for (const l of outer) {
        const cont = list.filter((o) => o.l !== l && inside(l[0], o.l));
        if (!cont.length || list.some((o) => o.l === l)) continue;
        cont.sort((p, q) => Math.abs(area(p.l)) - Math.abs(area(q.l)))[0].holes.push(l);
      }
      return list.map(({ l, holes }) => {
        const sh = new THREE.Shape(l.map(([x, z]) => new THREE.Vector2(x, z)));
        for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
        return sh;
      });
    }
    const lineGeo = (loops, y, skip) => {
      const p = [];
      for (const l of loops) for (let k = 0; k < l.length; k++) { const a = l[k], b = l[(k + 1) % l.length]; if (skip(a) && skip(b)) continue; p.push(a[0], y, a[1], b[0], y, b[1]); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); return g;
    };

    // ── 組み立て ──
    let layout, layoutName = "", built = [], info = {};
    const keep = (o) => { group.add(o); built.push(o); return o; };
    function build() {
      for (const o of built) { group.remove(o); o.traverse((c) => c.geometry?.dispose()); }
      built = [];
      COLS = layout.cols; ROWS = layout.rows; W = COLS * CELL; H = ROWS * CELL; NX = W / S + 1; NZ = H / S + 1; X0 = -W / 2; Z0 = -H / 2;
      const rivers = layout.rivers ?? [], mountains = layout.mountains ?? [];

      // セル: 川(どれかの川の中心線から半幅以内。重なれば等級の大きい方)、山(稜線から幅以内で、川でないところ)
      const cells = new Array(COLS * ROWS).fill(0), rcls = new Array(COLS * ROWS).fill(0), mcls = new Array(COLS * ROWS).fill(0);
      for (let b = 0; b < ROWS; b++) for (let a = 0; a < COLS; a++) {
        const k = b * COLS + a;
        for (const r of rivers) if (along(cx(a), cz(b), r.path)[0] <= RIVER[r.cls].half) { cells[k] = 1; rcls[k] = Math.max(rcls[k], r.cls); }
        if (cells[k]) continue;
        for (const m of mountains) if (along(cx(a), cz(b), m.path)[0] <= (m.width ?? 120)) { cells[k] = 2; mcls[k] = Math.max(mcls[k], m.cls); }
      }
      // 中心線が通るセルも川にする(細い小川がセルの間をすり抜けて途切れないように)
      for (const r of rivers) for (let k = 0; k < r.path.length - 1; k++) {
        const [ax, az] = r.path[k], [bx, bz] = r.path[k + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 8);
        for (let i = 0; i <= n; i++) {
          const a = Math.floor((ax + ((bx - ax) * i) / n - X0) / CELL), b = Math.floor((az + ((bz - az) * i) / n - Z0) / CELL);
          if (a < 0 || b < 0 || a >= COLS || b >= ROWS) continue;
          const q = b * COLS + a; cells[q] = 1; rcls[q] = Math.max(rcls[q], r.cls); mcls[q] = 0;
        }
      }
      info = { cols: COLS, rows: ROWS, river: [1, 2, 3].map((c) => rcls.filter((v) => v === c).length), mountain: [1, 2].map((c) => mcls.filter((v) => v === c).length) };

      // 川: 等級ごとにセルをぼかし、その等級の岸の形と深さで地面を下げる。III は岸の外に堤防を盛る
      const cutMax = new Float32Array(NX * NZ), levMax = new Float32Array(NX * NZ), owner = new Uint8Array(NX * NZ), any = new Float32Array(NX * NZ);
      for (const c of [1, 2, 3]) {
        if (!rcls.includes(c)) continue;
        const R = RIVER[c], rv = blur(rcls.map((v) => (v === c ? 1 : 0)), 34);
        for (let k = 0; k < rv.length; k++) {
          cutMax[k] = Math.max(cutMax[k], R.depth * sstep(R.bank[0], R.bank[1], rv[k]));
          if (rv[k] < R.bank[0]) levMax[k] = Math.max(levMax[k], R.levee * sstep(0.03, 0.13, rv[k]));   // 堤防: 外側はなだらかに上がり、頂は平ら、内側は岸の斜面
          if (rv[k] > any[k]) { any[k] = rv[k]; owner[k] = c; }
        }
      }
      const hgt = new Float32Array(NX * NZ);
      for (let k = 0; k < hgt.length; k++) hgt[k] = cutMax[k] > 0.05 ? LAND - cutMax[k] : LAND + levMax[k];   // 川が掘る深さを優先し、掘らないところに堤防を盛る
      // 地面: 格子の高さ面。色は陸 / 岸(等級ごと: 土・護岸)/ 川底(深いほど青みの灰)/ 堤防(白)
      const ground = new THREE.PlaneGeometry(W, H, NX - 1, NZ - 1); ground.rotateX(-Math.PI / 2);
      const gp = ground.attributes.position, gc = new Float32Array(gp.count * 3);
      const cLand = new THREE.Color(0xe4e9ee), cLevee = new THREE.Color(0xf6f8fa), cShallow = new THREE.Color(0xdce4ea), cDeep = new THREE.Color(0xa9bccb), c = new THREE.Color();
      const idxOf = (k) => Math.round((gp.getZ(k) - Z0) / S) * NX + Math.round((gp.getX(k) - X0) / S);
      for (let k = 0; k < gp.count; k++) {
        const q = idxOf(k), y = hgt[q]; gp.setY(k, y);
        if (y > LAND + 0.3) c.copy(cLevee);
        else if (y >= LAND - 0.3) c.copy(cLand);
        else if (y >= WATER) c.set(RIVER[owner[q] || 1].bankColor);
        else c.lerpColors(cShallow, cDeep, Math.min(1, (WATER - y) / 10.5));          // 大河の底(水面から 10.5)でいちばん濃く
        gc[k * 3] = c.r; gc[k * 3 + 1] = c.g; gc[k * 3 + 2] = c.b;
      }
      ground.setAttribute("color", new THREE.BufferAttribute(gc, 3)); ground.computeVertexNormals();
      keep(new THREE.Mesh(ground, M.land));
      // 盤面の側面(断面)。川の断面には水の色の板
      const skirt = [], cut = [];
      for (const [i0, j0, di, dj, n] of [[0, 0, 1, 0, NX], [0, NZ - 1, 1, 0, NX], [0, 0, 0, 1, NZ], [NX - 1, 0, 0, 1, NZ]]) for (let k = 0; k < n - 1; k++) {
        const i = i0 + di * k, j = j0 + dj * k, i2 = i + di, j2 = j + dj, x1 = gx(i), z1 = gz(j), x2 = gx(i2), z2 = gz(j2), h1 = hgt[j * NX + i], h2 = hgt[j2 * NX + i2];
        skirt.push(x1, 0, z1, x2, 0, z2, x2, h2, z2, x1, 0, z1, x2, h2, z2, x1, h1, z1);
        if (h1 < WATER || h2 < WATER) { const w1 = Math.max(h1, WATER), w2 = Math.max(h2, WATER); cut.push(x1, h1, z1, x2, h2, z2, x2, w2, z2, x1, h1, z1, x2, w2, z2, x1, w1, z1); }
      }
      const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(skirt, 3)); sg.computeVertexNormals();
      keep(new THREE.Mesh(sg, M.side)).add(new THREE.LineSegments(new THREE.EdgesGeometry(sg, 30), M.shore));
      if (cut.length) { const cg = new THREE.BufferGeometry(); cg.setAttribute("position", new THREE.Float32BufferAttribute(cut, 3)); keep(new THREE.Mesh(cg, M.cut)).renderOrder = 5; }
      keep(new THREE.Mesh(new THREE.BoxGeometry(W + 8, 3, H + 8), M.skirt)).position.y = -1.5;
      // 岸の上端の線(と堤防の頂の線)
      const onEdge = ([x, z]) => Math.abs(x) > W / 2 - 1 || Math.abs(z) > H / 2 - 1;
      keep(new THREE.LineSegments(lineGeo(contours(hgt.map((v) => -v), -(LAND - 0.4)), LAND + 0.3, onEdge), M.shore));
      keep(new THREE.LineSegments(lineGeo(contours(hgt, LAND + 6.5), LAND + 7.3, onEdge), M.shore));
      // 水面: 格子のうち地面を掘ったマス(四隅のどれかが陸より低い)だけの板。uv = (いちばん近い川の中心線からの横の距離, 中心線に沿った距離) / 線のテクスチャ
      if (rivers.length) {
        const vid = new Int32Array(NX * NZ).fill(-1), pos = [], uvs = [], ind = [];
        const vert = (i, j) => {
          const k = j * NX + i;
          if (vid[k] < 0) {
            vid[k] = pos.length / 3; const x = gx(i), z = gz(j); pos.push(x, 0, z);
            let best = Infinity, u = 0, v = 0;
            for (const r of rivers) { const [d, sA, nA] = along(x, z, r.path), e = d - RIVER[r.cls].half; if (e < best) { best = e; u = nA / TILE[0] + 0.5; v = sA / TILE[1]; } }
            uvs.push(u, v);
          }
          return vid[k];
        };
        for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
          if (Math.min(hgt[j * NX + i], hgt[j * NX + i + 1], hgt[(j + 1) * NX + i], hgt[(j + 1) * NX + i + 1]) >= LAND - 0.3) continue;
          const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1); ind.push(a, c, b, b, c, d);
        }
        if (ind.length) {
          const wg = new THREE.BufferGeometry(); wg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); wg.setIndex(ind);
          const wm = keep(new THREE.Mesh(wg, water)); wm.position.y = WATER; wm.renderOrder = 6;
        }
      }

      // 山: 等級ごとに山セルをぼかし(裾はなだらか、中ほどが高い)、峰の高さを低い周波数のノイズで変える。重なれば高い方。川の近くは削る
      const mf = new Float32Array(NX * NZ).fill(-1);
      let peakAll = 0;
      for (const mc of [1, 2]) {
        if (!mcls.includes(mc)) continue;
        const peak = PEAK[mc]; peakAll = Math.max(peakAll, peak);
        const m0 = blur(mcls.map((v) => (v === mc ? 1 : 0)), 64);
        let mmax = 0; for (const v of m0) mmax = Math.max(mmax, v);
        for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
          const k = j * NX + i, x = gx(i), z = gz(j), t = Math.min(1, Math.max(0, (m0[k] / mmax - 0.22) / 0.78));
          if (t <= 0 || any[k] > 0.12) continue;
          const shape = t * t * (3 - 2 * t);
          mf[k] = Math.max(mf[k], peak * shape * (0.68 + 0.32 * vnoise(x + 500 * mc, z, 190)) + (vnoise(x, z + 300 * mc, 55) - 0.5) * peak * 0.08 * shape);
        }
      }
      const layers = []; let top = 0;
      for (let lv = 1; peakAll && lv * STEP <= peakAll * 1.3; lv++) {
        const sh = shapes(contours(mf, (lv - 0.5) * STEP));
        if (!sh.length) break;
        const g = new THREE.ExtrudeGeometry(sh, { depth: STEP, bevelEnabled: false, curveSegments: 1 }); g.rotateX(Math.PI / 2); g.translate(0, LAND + lv * STEP, 0);
        layers.push([g, {}]); top = lv * STEP;
      }
      if (layers.length) {
        const mg = U.merge(THREE, layers);
        // 色: 板の上面は高いほど明るく(段彩)、側面(等高線の崖)はやや暗い
        const np = mg.attributes.position, nn = mg.attributes.normal, col = new Float32Array(np.count * 3), lo = new THREE.Color(0xc3ccd5), hi = new THREE.Color(0xf7f9fb), wall = new THREE.Color(0xb4bec8), cc = new THREE.Color();
        for (let k = 0; k < np.count; k++) {
          if (nn.getY(k) > 0.5) cc.lerpColors(lo, hi, Math.min(1, (np.getY(k) - LAND) / top)); else cc.copy(wall);
          col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b;
        }
        mg.setAttribute("color", new THREE.BufferAttribute(col, 3));
        keep(new THREE.Mesh(mg, M.mtn)).add(new THREE.LineSegments(new THREE.EdgesGeometry(mg, 40), M.mtnEdge));
      }
      info.peak = top; info.layers = layers.length;
    }

    // ── ランダムな配置: 川 1〜3本(端から端へ、ゆるく蛇行)、山 1〜2(川から離す) ──
    function random(seed) {
      const rnd = U.rng(seed), cols = 20, rows = 14, w = cols * CELL, h = rows * CELL, rivers = [], mountains = [];
      const nR = 1 + Math.floor(rnd() * 3);
      for (let n = 0; n < nR; n++) {
        const horiz = rnd() < 0.5, cls = 1 + Math.floor(rnd() * 3), a = (rnd() - 0.5) * 0.7, b = (rnd() - 0.5) * 0.7, path = [];
        for (let k = 0; k <= 6; k++) {
          const t = k / 6, wig = Math.sin(t * Math.PI * (1.5 + rnd())) * 90 + (rnd() - 0.5) * 60, along = (t - 0.5) * (horiz ? w : h) * 1.06, across = ((1 - t) * a + t * b) * (horiz ? h : w) + wig;
          path.push(horiz ? [along, across] : [across, along]);
        }
        rivers.push({ cls, path });
      }
      const nM = 1 + Math.floor(rnd() * 2);
      for (let n = 0, tries = 0; n < nM && tries < 60; tries++) {
        // 稜線は3点で、途中で曲げる(まっすぐな棒状にしない)。盤面の端で切れないよう内側に置く
        const cls = 1 + Math.floor(rnd() * 2), x = (rnd() - 0.5) * (w - 760), z = (rnd() - 0.5) * (h - 680), ang = rnd() * Math.PI, bend = (rnd() - 0.5) * 1.4, len = cls === 1 ? 120 : 220, width = cls === 1 ? 130 : 115;
        const path = [[x - Math.cos(ang) * len, z - Math.sin(ang) * len], [x, z], [x + Math.cos(ang + bend) * len, z + Math.sin(ang + bend) * len]];
        const clear = rivers.every((r) => path.every(([px, pz]) => along(px, pz, r.path)[0] > RIVER[r.cls].half + width + 60)) && mountains.every((m) => Math.hypot(m.path[0][0] - path[0][0], m.path[0][1] - path[0][1]) > 450);
        if (clear) { mountains.push({ cls, path, width }); n++; }
      }
      return { cols, rows, rivers, mountains };
    }

    function setLayout(l) { layoutName = typeof l === "string" ? l : "custom"; layout = typeof l === "string" ? PRESETS[l] : l; build(); }
    setLayout(opts.layout ?? "confluence");
    let seed = opts.seed ?? 7;
    return {
      group, update(dt) { water.map.offset.y -= dt * 0.25; }, setTeam() {}, stats: () => U.stats(group), parts: {},
      setLayout, randomize(s) { seed = s ?? seed + 1; setLayout(random(seed)); layoutName = "random"; },
      get layoutName() { return layoutName; }, get layout() { return layout; }, info: () => ({ ...info }),
    };
  }

  (window.DreamAssets ??= {}).terrain = terrain;
})();
