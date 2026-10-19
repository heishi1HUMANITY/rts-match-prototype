// マップ「運河地帯」(100 × 100 セル)の試作。BF のコンクエストのように、1 つのモチーフ(大運河)の地形の上に攻略拠点を散らす。
// 下敷きはスエズ運河の中部だが、地名はすべて架空(機能の名前)にし、地形はゲームとして妥当な形にした:
//   中央の中州は大運河と新運河と湖に囲まれ、橋かトンネルでしか入れない。
//   中央へ行く前にも行軍の制限がある: 西(A)は南北の用水路(橋 4 か所)、東(B・C)は南北の崖の尾根(峠 4 か所、B と C に 2 か所ずつ)。
//   B と C は東の分水路で分かれる(渡れるのは揚水場の橋だけ)。
//   地形は起伏あり: 西は緩やかな平野と所々の丘、東は砂丘と崖の尾根。運河の両岸と拠点・首都の台は平らにならす。
// 陣営: A = 西、B = 南東、C = 北東。首都は保留中なので仮の展開地点だけ置く。
// 拠点の建造物は施設トークンと同じ 0.6 単位/m で、拠点ごとのファイル suez_<id>.js が DreamAssets.maps.site で登録する(拠点の台の上 y = 0 に建てる)。
// 座標: 1 セル = 80 単位、地図は x, z とも -4000〜4000。+x が東、+z が南(カメラ側)。
//
//   const m = DreamAssets.maps.suez.build(THREE); scene.add(m.group); m.setOwner("ferdan", "A"); m.update(dt); m.analyze()
(function () {
  const CELL = 80, HALF = 4000, N = 100;
  const G = 0, WY = -3, BED = -14, BASE = -30;   // 拠点の台の高さ、水面、水路の底、台座の底
  const K_SITE = 0.6;                              // 拠点の建造物の縮尺(単位/m)
  // 水路(地図の座標)
  const OLD = { hw: 80 };                                                  // 大運河: x = 0 を南北に通る
  const NEW = { a: [0, -1800], b: [400, -1400], x: 400, hw: 80 };          // 新運河: 北で大運河から斜めに分かれ、x = 400 を南へ湖まで
  const LAKE = { cx: -250, cz: 2450, rx: 800, rz: 290 };                    // 湖
  const BRANCH = { a: [480, 500], b: [HALF, -200], hw: 40 };               // 東の分水路(B と C の境。中州の東の橋は C、トンネルは B の側に着く)
  const W0 = LAKE.cx - LAKE.rx;                                            // 湖の西端
  const BARRIER = { pts: [[-900, -HALF], [-900, 900], [-1350, 1450], [-1300, 2250], [W0 + 15, LAKE.cz]], hw: 45 };   // 西の用水路(A の前の障壁。北の端から湖まで)
  const FRESH_W = { pts: [[-HALF, 2300], [-1700, 2262], [-1300, 2250]], hw: 16 };                                     // 西の細い用水路(飾り、通れる)
  const RIDGE = { x: 2150, amp: 140, w: 170, passes: [[-3100, 150], [-2050, 150], [400, 170], [2680, 150]] };          // 東の崖の尾根と峠(z の中心、半幅)
  // 東の涸れ川(崖から運河地帯へ下る浅い谷。地形を掘るだけで水はない)
  const WADIS = [[[1950, -2650], [1600, -2420], [1250, -2330], [850, -2180]], [[1950, -1250], [1550, -1080], [1150, -1010], [760, -1120]], [[1950, 1750], [1600, 1880], [1250, 1840], [900, 1760]]];
  const lakeZ = (x, sgn) => { const t = (x - LAKE.cx) / LAKE.rx; return Math.abs(t) > 1 ? null : LAKE.cz + sgn * LAKE.rz * Math.sqrt(1 - t * t); };

  // 攻略拠点(x, z は地図の座標、r は制圧圏の半径)。id はファイル名の key
  const POINTS = [
    { id: "ferdan", no: 1, name: "中州の旋回橋", kind: "large", x: 200, z: 0, r: 380 },
    { id: "peace", no: 2, name: "北の大橋", kind: "large", x: 0, z: -3050, r: 380 },
    { id: "tunnel", no: 3, name: "運河トンネル", kind: "medium", x: 200, z: 1450, r: 300 },
    { id: "ismailia", no: 4, name: "湖畔の運河局", kind: "medium", x: -800, z: 1850, r: 410 },   // 湖岸(中心から約 390)まで制圧圏に入れる
    { id: "ballah", no: 5, name: "北の分岐", kind: "medium", x: 150, z: -1750, r: 300 },
    { id: "salam", no: 6, name: "東の揚水場", kind: "medium", x: 1000, z: 655, r: 300 },   // 分水路の南岸(拠点の建造物は中心の北 約 260 に水路がある前提)
    { id: "memorial", no: 7, name: "南東の記念塔", kind: "medium", x: 1250, z: 2550, r: 300 },
    { id: "barlev", no: 8, name: "旧防衛線の砦", kind: "small", x: 450, z: -2500, r: 260 },
    { id: "airbase", no: 9, name: "西の空軍基地", kind: "large", x: -2650, z: 2350, r: 420 },
    { id: "qantara", no: 10, name: "北東の駅", kind: "small", x: 1500, z: -3150, r: 280 },
  ];
  // 拠点の状態(ビューアの STATE のボタン。[ラベル, setState の値])
  const STATES = {
    ferdan: [["閉(鉄道)", "closed"], ["開放 ▶", "opening"], ["開(船が通る)", "open"], ["◀ 閉鎖", "closing"]],
    ballah: [["浚渫", "dredge"], ["停止", "stop"]],
    salam: [["揚水", "pumping"], ["停止", "stopped"]],
    airbase: [["平時", "normal"], ["警戒", "alert"]],
  };
  const HQS = [
    { f: "A", x: -3350, z: -900, name: "首都 A(仮)" },
    { f: "B", x: 3250, z: 2900, name: "首都 B(仮)" },
    { f: "C", x: 3250, z: -3100, name: "首都 C(仮)" },
  ];
  const TEAM = { A: 0xff6a1a, B: 0x10bfe8, C: 0xf0b323 };
  // 平らにならす台(拠点・首都。大橋は取付けの道まで)。a〜b の線分から r 以内は高さ 0、外へ 200 で元の地形へ戻す
  const PADS = [
    ...POINTS.map((p) => ({ a: [p.x, p.z], b: [p.x, p.z], r: p.r + 40 })),
    ...HQS.map((h) => ({ a: [h.x, h.z], b: [h.x, h.z], r: 420 })),
    { a: [-720, -3050], b: [720, -3050], r: 120 },
  ];
  // 拠点の建造物が受け持つ渡河(橋・トンネル)。通行のセルの計算で水の上を通れるようにする
  const SITE_CROSSINGS = [
    { name: "中州の旋回橋(大運河)", a: [-110, 0], b: [110, 0] }, { name: "中州の旋回橋(新運河)", a: [290, 0], b: [510, 0] },
    { name: "北の大橋", a: [-120, -3050], b: [120, -3050] },
    { name: "運河トンネル(大運河)", a: [-110, 1450], b: [110, 1450] }, { name: "運河トンネル(新運河)", a: [290, 1450], b: [510, 1450] },
    { name: "揚水場の橋", a: [650, 390], b: [650, 550] },
  ];

  const segDist = (px, pz, [ax, az], [bx, bz]) => {
    const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(px - ax - t * dx, pz - az - t * dz);
  };
  const lineDist = (x, z, pts) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, z, pts[i - 1], pts[i])); return d; };
  function isWater(x, z) {
    if (Math.abs(x) < OLD.hw) return true;
    if (segDist(x, z, NEW.a, NEW.b) < NEW.hw) return true;
    const lt = lakeZ(NEW.x, -1);
    if (Math.abs(x - NEW.x) < NEW.hw && z > NEW.b[1] && z < (lt ?? 0) + 40) return true;
    if (((x - LAKE.cx) / LAKE.rx) ** 2 + ((z - LAKE.cz) / LAKE.rz) ** 2 < 1) return true;
    if (x > BRANCH.a[0] - 10 && segDist(x, z, BRANCH.a, BRANCH.b) < BRANCH.hw) return true;
    if (lineDist(x, z, BARRIER.pts) < BARRIER.hw) return true;
    return false;
  }
  // 拠点のファイルが使う水路の一覧(地図の座標の線分と半幅)
  const CHANNELS = [
    { name: "旧運河", a: [0, -HALF], b: [0, HALF], hw: OLD.hw },
    { name: "新運河(斜め)", a: NEW.a, b: NEW.b, hw: NEW.hw },
    { name: "新運河", a: NEW.b, b: [NEW.x, lakeZ(NEW.x, -1)], hw: NEW.hw },
    { name: "東の分水路", a: BRANCH.a, b: BRANCH.b, hw: BRANCH.hw },
  ];

  // ── 起伏: 決まった値のノイズ(乱数の種を固定) ──
  const hash2 = (i, j) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vnoise = (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
  const fbm = (x, z, o = 4) => { let s = 0, a = 0.5, f = 1, n = 0; for (let k = 0; k < o; k++) { s += a * vnoise(x * f + k * 17.3, z * f - k * 9.1); n += a; a *= 0.5; f *= 2; } return s / n; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ridgeX = (z) => RIDGE.x + 220 * (fbm(z / 1400 + 3.1, 0.7, 2) - 0.5);
  const ridgeBand = (x, z) => { const d = x - ridgeX(z), w = d < 0 ? RIDGE.w * 0.7 : RIDGE.w * 1.6; return Math.exp(-((d / w) ** 2)); };   // 西(運河側)が急な崖、東はなだらか
  const passOpen = (z) => { let p = 1; for (const [pz, hw] of RIDGE.passes) p *= 1 - Math.exp(-(((z - pz) / hw) ** 2)); return p; };   // 0 = 峠の中心
  // 陸の高さ(水路の掘り込みの前)
  function landH(x, z) {
    const n = fbm(x / 1100 + 11, z / 1100 - 5, 4);
    const westH = 3 + 22 * (n - 0.45) + 40 * Math.max(0, fbm(x / 700 - 3, z / 700 + 8, 3) - 0.6);    // 平野と所々の丘
    const d = fbm(x / 230 + 4, z / 600 - 2, 3);
    const cr = 1 - Math.abs(2 * fbm((x * 0.94 - z * 0.34) / 170 + 2, (z * 0.94 + x * 0.34) / 520 - 6, 3) - 1);   // 砂丘の稜線(北北西へ延びる)
    const eastH = 6 + 34 * (n - 0.4) + 12 * (d - 0.5) + 16 * cr * cr * cr;                          // 砂丘
    let h = westH + (eastH - westH) * smooth(-100, 300, x);
    const rv = ridgeBand(x, z) * (RIDGE.amp * (0.75 + 0.5 * fbm(z / 900 + 7, 1.3, 2)) * passOpen(z) + 24 * (fbm(x / 110, z / 110, 3) - 0.5));
    const st = 9, fr = rv / st - Math.floor(rv / st);
    h += Math.floor(rv / st) * st + st * smooth(0.55, 0.95, fr);                                    // 崖の尾根(地層の段。高さは場所で変わり、峠で切れる)
    for (const w of WADIS) { const dw = lineDist(x, z, w); if (dw < 120) h -= 9 * (1 - smooth(25, 120, dw)) * smooth(-100, 400, x); }   // 涸れ川の谷
    h = 1.5 + (h - 1.5) * smooth(450, 1100, Math.abs(x - 200));                                    // 運河地帯は低く平ら
    const cd = canalDist(x, z); if (cd > 0 && cd < 160) h += 5 * Math.exp(-(((cd - 55) / 24) ** 2));  // 運河の堤防(岸から少し離れた盛土)
    for (const p of PADS) { const w = 1 - smooth(p.r, p.r + 200, segDist(x, z, p.a, p.b)); if (w > 0) h *= 1 - w; }   // 拠点・首都の台
    return Math.max(0, h);
  }
  // 大運河・新運河・湖の縁までの距離(堤防の盛土に使う)
  function canalDist(x, z) {
    let d = Math.abs(x) - OLD.hw;
    d = Math.min(d, segDist(x, z, NEW.a, NEW.b) - NEW.hw);
    const lt = lakeZ(NEW.x, -1) ?? 0; if (z > NEW.b[1] && z < lt + 40) d = Math.min(d, Math.abs(x - NEW.x) - NEW.hw);
    d = Math.min(d, (Math.hypot((x - LAKE.cx) / LAKE.rx, (z - LAKE.cz) / LAKE.rz) - 1) * LAKE.rz);
    return d;
  }
  // 水の縁までの符号付きの距離(負 = 水の中)。地形の岸を滑らかな斜面にする
  function waterSD(x, z) {
    let d = Math.abs(x) - OLD.hw;
    d = Math.min(d, segDist(x, z, NEW.a, NEW.b) - NEW.hw, segDist(x, z, NEW.b, [NEW.x, (lakeZ(NEW.x, -1) ?? 0) + 40]) - NEW.hw);
    d = Math.min(d, (Math.hypot((x - LAKE.cx) / LAKE.rx, (z - LAKE.cz) / LAKE.rz) - 1) * LAKE.rz);
    if (x > BRANCH.a[0] - 10) d = Math.min(d, segDist(x, z, BRANCH.a, BRANCH.b) - BRANCH.hw);
    return Math.min(d, lineDist(x, z, BARRIER.pts) - BARRIER.hw);
  }
  // 見える陸の高さ(地形の格子は陸を 0.5 より下げない)。装飾・道路・橋・部隊はこれに置く。通行の判定は landH のまま
  const topH = (x, z) => Math.max(0.5, landH(x, z));
  const groundY = (x, z) => (isWater(x, z) ? BED : topH(x, z));

  // ── 道路・鉄道(地図の座標の折れ線) ──
  const ROADS = [
    [[-260, -HALF], [-260, 1500], [-500, 1950], [-1300, 2050], [-HALF, 1900]],                  // 西岸の運河沿い → 湖畔の街 → 西へ
    [[-260, 600], [-1500, 300], [-2600, -600], [-3350, -900]],                                   // 首都 A へ
    [[-3350, -900], [-2400, -2000], [-1200, -2750], [-260, -2950]],                              // 首都 A → 北の大橋の西
    [[-2650, 2350], [-2000, 2150], [-1300, 2050]],                                              // 空軍基地
    [[650, -HALF], [650, -1500], [600, -700], [640, 600], [700, 1450], [900, 2150], [1250, 2550], [2200, 2700], [3250, 2900]],   // 東岸の運河沿い → 首都 B
    [[650, -3050], [1500, -3150], [2500, -3100], [3250, -3100]],                                 // 北の大橋 → 北東の駅 → 首都 C
    [[650, -1500], [1800, -1900], [2600, -2400], [3250, -3100]],                                 // 首都 C → 北の峠
    [[700, 1450], [1500, 1100], [2050, 470], [2600, 560], [HALF, 700]],                           // トンネル → 東の峠
  ];
  const RAIL = [[-HALF, -300], [-1800, -250], [-700, -60], [-160, 0], [560, 0], [1400, 120], [2600, 500], [HALF, 600]];

  // ── 地面の細部のテクスチャ(Canvas で生成、継ぎ目なく繰り返す。1 枚 = 地図の 200 単位)──
  //   map: R = むらと粒(全体)、G = 小石と所々の割れ目(砂漠・運河地帯・台に多く)、B = 岩の節理(崖)。値は平均で割って掛ける
  //   bump: 小石の盛り上がりと割れ目の凹み(寄ったときの陰影)
  let detailCache = null;
  function detailTextures(THREE) {
    if (detailCache) return detailCache;
    const N = 1024, R = new Float32Array(N * N), Gc = new Float32Array(N * N), Bc = new Float32Array(N * N), Hb = new Float32Array(N * N);
    const hashP = (i, j, s) => hash2(i * 7919 + s, j * 104729 - s);
    const tnoise = (x, y, P, s) => {   // 周期 P の格子の値ノイズ(x, y は 0〜1)
      const u = x * P, v = y * P, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const w = (a) => ((a % P) + P) % P;
      const a = hashP(w(i), w(j), s), b = hashP(w(i + 1), w(j), s), c = hashP(w(i), w(j + 1), s), d = hashP(w(i + 1), w(j + 1), s);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
    // 継ぎ目なしのボロノイ(F1, F2 の距離、画素単位)と所属セル
    const voronoi = (P, s, warp = 0) => {   // warp: 境界を揺らす量(画素)
      const cs = N / P, pts = [];
      for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) pts.push([(i + 0.15 + 0.7 * hashP(i, j, s)) * cs, (j + 0.15 + 0.7 * hashP(i, j, s + 1)) * cs]);
      const f1 = new Float32Array(N * N), f2 = new Float32Array(N * N), id = new Int32Array(N * N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const wx = x + warp * (tnoise(x / N, y / N, 16, s + 5) - 0.5) * 2, wy = y + warp * (tnoise(x / N, y / N, 16, s + 6) - 0.5) * 2;
        const ci = Math.floor(wx / cs), cj = Math.floor(wy / cs); let d1 = 1e9, d2 = 1e9, k1 = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = ci + di, jj = cj + dj, wi = ((ii % P) + P) % P, wj = ((jj % P) + P) % P, p = pts[wj * P + wi];
          const px = p[0] + (ii - wi) * cs, py = p[1] + (jj - wj) * cs, dd = Math.hypot(wx - px, wy - py);
          if (dd < d1) { d2 = d1; d1 = dd; k1 = wj * P + wi; } else if (dd < d2) d2 = dd;
        }
        const q = y * N + x; f1[q] = d1; f2[q] = d2; id[q] = k1;
      }
      return { f1, f2, id };
    };
    const rnd = (() => { let s = 99991; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
    // R: むら(大きな斑から細かい斑まで)と粒
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N, v = y / N, q = y * N + x;
      const m = 0.45 * tnoise(u, v, 4, 11) + 0.25 * tnoise(u, v, 9, 12) + 0.17 * tnoise(u, v, 20, 13) + 0.13 * tnoise(u, v, 48, 14);
      R[q] = 0.8 + 0.17 * m + 0.05 * (rnd() - 0.5);
      Gc[q] = 0.92 + 0.04 * (rnd() - 0.5); Bc[q] = 0.93 + 0.03 * (rnd() - 0.5); Hb[q] = 0.5 + 0.1 * (rnd() - 0.5) + 0.15 * tnoise(u, v, 32, 21);
    }
    // G: 所々の割れ目(乾いた泥・塩の多角形。斑の所だけ)と小石
    const vc = voronoi(16, 31, 14);
    for (let q = 0; q < N * N; q++) {
      const x = q % N, y = (q / N) | 0, mask = smooth(0.55, 0.7, tnoise(x / N, y / N, 5, 41)) * smooth(0.3, 0.6, tnoise(x / N, y / N, 40, 42)), e = vc.f2[q] - vc.f1[q];
      const w = 1.2 + 2.2 * tnoise(x / N, y / N, 24, 43);
      if (e < w && mask > 0) { const k = (1 - e / w) * mask; Gc[q] *= 1 - 0.3 * k; Hb[q] -= 0.3 * k; }
    }
    const stamp = (cx, cy, r, f) => { for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) { const dd = Math.hypot(dx, dy) / r; if (dd > 1) continue; const q = (((cy + dy) % N + N) % N) * N + (((cx + dx) % N + N) % N); f(q, dd, dx / r, dy / r); } };
    for (let n = 0; n < 5200; n++) {
      const cx = Math.floor(rnd() * N), cy = Math.floor(rnd() * N), r = 1.2 + rnd() * rnd() * 4.5, dark = rnd() < 0.55;
      stamp(cx, cy, r, (q, dd, ox, oy) => {
        const k = 1 - dd * dd;
        Gc[q] = dark ? Gc[q] * (1 - 0.3 * k) : Math.min(1, Gc[q] + 0.08 * k);
        Gc[q] *= 1 - 0.12 * Math.max(0, ox + oy) * k;   // 南東側の陰
        Hb[q] += 0.45 * k;
      });
    }
    // B: 岩の節理(大きな多角形の割れ目、面ごとの濃淡、細かな筋)
    const vr = voronoi(9, 51, 22);
    for (let q = 0; q < N * N; q++) {
      const x = q % N, y = (q / N) | 0, e = vr.f2[q] - vr.f1[q], part = smooth(0.35, 0.6, tnoise(x / N, y / N, 18, 52));
      Bc[q] *= 0.86 + 0.14 * hash2(vr.id[q], 7);
      if (e < 3.5) Bc[q] *= 1 - 0.3 * (1 - e / 3.5) * part;
      Bc[q] *= 0.96 + 0.04 * Math.sin((x * 0.6 + y * 0.15) * 0.35 + 6 * tnoise(x / N, y / N, 8, 61));
    }
    const toCanvas = (fill) => {
      const c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d"), img = g.createImageData(N, N);
      for (let q = 0; q < N * N; q++) fill(img.data, q * 4, q);
      g.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace;
      return t;
    };
    const b8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
    let sr = 0, sg = 0, sb = 0;
    for (let q = 0; q < N * N; q++) { sr += b8(R[q]) / 255; sg += b8(Gc[q]) / 255; sb += b8(Bc[q]) / 255; }
    const map = toCanvas((d, o, q) => { d[o] = b8(R[q]); d[o + 1] = b8(Gc[q]); d[o + 2] = b8(Bc[q]); d[o + 3] = 255; });
    const bump = toCanvas((d, o, q) => { const v = b8(Hb[q]); d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255; });
    detailCache = { map, bump, mean: new THREE.Vector3(sr / (N * N), sg / (N * N), sb / (N * N)) };
    return detailCache;
  }

  function build(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.road = M.lambert(0xb9c0c7); M.rail = M.lambert(0x5b6570);
    M.water = U.waterMaterial(THREE, { repeat: [(2 * HALF) / U.WATER_TILE[0], (2 * HALF) / U.WATER_TILE[1]] });
    const k = F.kit(THREE, M, 1);
    const { add, box, cyl, V } = k;
    const group = new THREE.Group(); group.name = "map-canal";
    const terrain = new THREE.Group(); group.add(terrain);
    const rnd = U.rng(20261019);

    // ── 地形: 12.5 単位ごとの高さの格子(頂点色 + 細部のテクスチャ + 焼き込みの陰)、等高線、地層の見える側面 ──
    const S = opts.res ?? 12.5, NS = (2 * HALF) / S + 1;
    const H = new Float32Array(NS * NS), Wt = new Uint8Array(NS * NS), WD = new Float32Array(NS * NS);
    for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) {
      const x = -HALF + i * S, z = -HALF + j * S, d = waterSD(x, z), q = j * NS + i;
      Wt[q] = d < -2 ? 1 : 0; WD[q] = d;
      H[q] = d < -14 ? BED : BED + (Math.max(0.5, landH(x, z)) - BED) * smooth(-14, 6, d);   // 岸は斜面(水面と交わる線が水の縁とほぼ一致)
    }
    // 焼き込みの陰(AO): 高さからぼかした高さを引いた量で、窪み(崖の足、谷、堤防の足)を暗く、尾根をわずかに明るく。水は陸の高さ 0.5 として扱う
    const blurField = (src, r) => {
      const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
      for (let j = 0; j < NS; j++) { let s = 0; const row = j * NS; for (let i = -r; i <= r; i++) s += src[row + Math.min(NS - 1, Math.max(0, i))]; for (let i = 0; i < NS; i++) { tmp[row + i] = s / (2 * r + 1); s += src[row + Math.min(NS - 1, i + r + 1)] - src[row + Math.max(0, i - r)]; } }
      for (let i = 0; i < NS; i++) { let s = 0; for (let j = -r; j <= r; j++) s += tmp[Math.min(NS - 1, Math.max(0, j)) * NS + i]; for (let j = 0; j < NS; j++) { out[j * NS + i] = s / (2 * r + 1); s += tmp[Math.min(NS - 1, j + r + 1) * NS + i] - tmp[Math.max(0, j - r) * NS + i]; } }
      return out;
    };
    const HL = H.map((h) => Math.max(h, 0.5)), B1 = blurField(HL, 3), B2 = blurField(HL, 10), B3 = blurField(HL, 40);   // B3: 約 500 単位の広い窪み(低い所を少し暗く)
    // 崖の尾根の行ごとの頂(z が同じ行の、尾根の中心から 350 以内の最高点)。頂の段を明るい帽岩にする
    const rowTop = new Float32Array(NS);
    for (let j = 0; j < NS; j++) { const z = -HALF + j * S, rx = ridgeX(z); let m = 0; for (let i = 0; i < NS; i++) { const x = -HALF + i * S; if (Math.abs(x - rx) < 350) m = Math.max(m, H[j * NS + i]); } rowTop[j] = m; }
    const C3 = (hex) => new THREE.Color(hex);
    const col = new THREE.Color(), tmpC = new THREE.Color(), CL = {
      plain: C3(0xdbe1d5), plain2: C3(0xd2d9cb), hill: C3(0xd4d8ca), canal: C3(0xe2e5e1), dike: C3(0xeceeec),
      zoneW: C3(0xd8d8c0), zoneW2: C3(0xcfd0b6), zoneE: C3(0xe6decb), zoneE2: C3(0xddd3bd), dikeW: C3(0xe4e2d1), dikeE: C3(0xeee8da),   // 運河地帯: 西岸は砂ぼこりのオリーブ・カーキ、中州と東岸は明るい暖かい砂
      sand: C3(0xe9e2d2), trough: C3(0xdbd1bc), wadi: C3(0xcdc2ab), cliff: C3(0x9b8e77), riser: C3(0x8a7a63), cap: C3(0xe6dfcf), rockBase: C3(0xc8b9a0), rockAlt: C3(0xbdb3a3),
      damp: C3(0xb3bcb9), shallow: C3(0xddd5c1), mid: C3(0xa7b5b6), deep: C3(0x6c8798),
    };
    const STRATA = [C3(0xd9c19a), C3(0xb6b8b5), C3(0xcfb08f), C3(0x9f9a93)];   // 地層(18 ごと。暖・寒を交互に、シェーダーの縞と同じ並び)
    const strataAt = (y) => STRATA[((Math.floor(y / 18) % STRATA.length) + STRATA.length) % STRATA.length];
    const lum = (c) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    const pos = new Float32Array(NS * NS * 3), cols = new Float32Array(NS * NS * 3), uvs = new Float32Array(NS * NS * 2), dets = new Float32Array(NS * NS * 3);
    const T_DETAIL = 200;   // 細部のテクスチャ 1 枚 = 200 単位
    for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) {
      const q = j * NS + i, x = -HALF + i * S, z = -HALF + j * S, h = H[q], d = WD[q];
      pos.set([x, h, z], q * 3); uvs.set([x / T_DETAIL, z / T_DETAIL], q * 2);
      let pebble = 0.5, rockW = 0, rockR = 0;
      if (h < WY + 0.2) {   // 水の中: 深さで浅瀬の砂色から深みの青灰色へ
        const depth = WY - h;
        col.copy(CL.shallow).lerp(CL.mid, smooth(0, 4, depth)).lerp(CL.deep, smooth(4, 11, depth));
        pebble = 0.15;
      } else {
        const hx = H[j * NS + Math.min(NS - 1, i + 1)] - H[j * NS + Math.max(0, i - 1)], hz = H[Math.min(NS - 1, j + 1) * NS + i] - H[Math.max(0, j - 1) * NS + i];
        const slope = Math.hypot(hx, hz) / (2 * S), band = ridgeBand(x, z);
        const wz = 1 - smooth(560, 760, Math.abs(x - 200));   // 運河地帯の重み(縁で両側の地色へなめらかに移る)
        if (x < -150) { col.copy(CL.plain).lerp(CL.plain2, fbm(x / 300, z / 300, 2)).lerp(CL.hill, smooth(10, 22, h)); pebble = 0.35; }   // 西の平野と丘(畑は装飾の層)
        else {
          const cr = 1 - Math.abs(2 * fbm((x * 0.94 - z * 0.34) / 170 + 2, (z * 0.94 + x * 0.34) / 520 - 6, 3) - 1);
          col.copy(CL.trough).lerp(CL.sand, smooth(0.35, 0.9, cr));                                                           // 砂丘(稜線は明るく、窪みは暗く)
          if (WADIS.some((w) => lineDist(x, z, w) < 45)) col.lerp(CL.wadi, 0.45);
          pebble = 0.85;
          // 崖の尾根: 岩の地色。平らな段の上は砂をかぶって明るく、立ち上がりは暗く、頂の段は明るい帽岩。地層の縞はシェーダーで高さから描く(頂点の間隔に左右されない)
          const wRock = smooth(0.15, 0.35, band) * smooth(12, 22, h);
          if (wRock > 0) {
            tmpC.copy(CL.rockBase).lerp(CL.rockAlt, fbm(x / 80, z / 80, 2));
            const riser = smooth(0.25, 0.7, slope);
            tmpC.lerp(CL.sand, 0.38 * (1 - riser)).lerp(CL.riser, 0.62 * riser);
            if (h > rowTop[j] - 10 && slope < 0.5) tmpC.lerp(CL.cap, 0.75 * (1 - smooth(0.3, 0.5, slope)));
            col.lerp(tmpC, wRock); rockW = wRock * (0.25 + 0.5 * riser); rockR = wRock * (h > rowTop[j] - 10 && slope < 0.5 ? 0.3 : 1); pebble *= 1 - 0.5 * wRock;
          }
        }
        if (wz > 0) {   // 運河地帯と堤防(塩の割れ目)。西岸はカーキ、中州・東岸は暖かい砂。むらは 260 単位の柔らかいノイズ
          const west = x < 0, nz = fbm(x / 260 + 5, z / 260 - 9, 2);
          tmpC.copy(west ? CL.zoneW : CL.zoneE).lerp(west ? CL.zoneW2 : CL.zoneE2, smooth(0.3, 0.75, nz));
          const cd = canalDist(x, z); if (cd > 25 && cd < 90) tmpC.lerp(west ? CL.dikeW : CL.dikeE, 0.7 * Math.exp(-(((cd - 55) / 26) ** 2)) + 0.1);   // 堤防の頂はやや明るく
          col.lerp(tmpC, wz); pebble = pebble + (0.6 - pebble) * wz;
        }
        if (slope > 0.35 && !(band > 0.25 && h > 14)) col.lerp(CL.cliff, Math.min(0.6, (slope - 0.35) * 1.5));   // 尾根の外の急な斜面(丘・谷の縁)
        // 拠点・首都の台: 縁を崩した整地面(やや明るく彩度を落とし、砂利を多く)、その外に掘り返した土の暗い輪
        let pw = 0, rim = 0;
        for (const p of PADS) {
          const dn = segDist(x, z, p.a, p.b) + 70 * (fbm(x / 110 + 3, z / 110 - 7, 2) - 0.5);
          pw = Math.max(pw, 1 - smooth(p.r - 90, p.r + 50, dn)); rim = Math.max(rim, Math.exp(-(((dn - p.r - 95) / 45) ** 2)));
        }
        if (pw > 0) { const L = lum(col); tmpC.setRGB(L, L, L).lerp(col, 0.45).multiplyScalar(1.04); col.lerp(tmpC, 0.55 * pw); pebble = pebble + (0.95 - pebble) * pw; }
        if (rim > 0) col.multiplyScalar(1 - 0.07 * rim * (1 - pw));
        // 岸の湿った帯(水の縁から 34 まで、水際ほど濃い)
        if (d < 44) { const wet = 1 - smooth(0, 44, d); col.lerp(CL.damp, 0.5 * wet).multiplyScalar(1 - 0.24 * wet - 0.16 * (1 - smooth(-2, 7, d))); }   // 水際の濡れた線はさらに暗く
      }
      // 陰の焼き込み
      const rockRegion = ridgeBand(x, z) > 0.2 && h > 12, dunes = x > 900 && !rockRegion, inZone = Math.abs(x - 200) < 700;
      let ao = (HL[q] - B1[q]) * (dunes ? 0.025 : 0.035) + (HL[q] - B2[q]) * (rockRegion ? 0.012 : dunes ? 0.004 : 0.008);
      if (inZone) ao *= 0.6;
      if (h >= WY) {
        const cd = canalDist(x, z); if (cd > 0 && cd < 160) ao -= 0.06 * (Math.exp(-(((cd - 22) / 14) ** 2)) + Math.exp(-(((cd - 90) / 18) ** 2)));   // 堤防の両側の足
        if (x > -100) for (const w of WADIS) { const dw = lineDist(x, z, w); if (dw < 70) ao -= 0.035 * (1 - smooth(10, 70, dw)); }                 // 涸れ川の底
      }
      col.multiplyScalar(1 + Math.max(-0.24, Math.min(0.07, ao)));
      // 広い明暗: 約 1500 単位の柔らかいノイズ(±6%)と、約 500 単位の窪みを少し暗く(色相は変えない)
      const broad = 1 + 0.12 * (fbm(x / 1500 + 13.7, z / 1500 - 4.2, 2) - 0.5);
      const lowD = h >= WY ? Math.max(-0.07, Math.min(0.03, (HL[q] - B3[q]) * 0.0045)) : 0;
      col.multiplyScalar(broad * (1 + lowD));
      cols.set([col.r, col.g, col.b], q * 3); dets.set([pebble, rockW, rockR], q * 3);
    }
    const idx = [];
    for (let j = 0; j < NS - 1; j++) for (let i = 0; i < NS - 1; i++) { const a = j * NS + i, b = a + 1, c = a + NS, d = c + 1; idx.push(a, c, b, b, c, d); }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); tg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    tg.setAttribute("uv", new THREE.BufferAttribute(uvs, 2)); tg.setAttribute("detail", new THREE.BufferAttribute(dets, 3));
    tg.setIndex(idx); tg.computeVertexNormals();
    const DT = detailTextures(THREE);
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: DT.map, bumpMap: DT.bump, bumpScale: 1.6 });
    // 細部: 1 枚目(R = むら・粒)を 2 つの縮尺で重ねて繰り返しを消し、G(小石・割れ目)と B(岩の節理)を頂点ごとの重みで掛ける。平均が 1 になるように割る
    groundMat.onBeforeCompile = (sh) => {
      sh.uniforms.uMean = { value: DT.mean };
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 detail;\nvarying vec3 vDetail;\nvarying float vWY;").replace("#include <uv_vertex>", "#include <uv_vertex>\nvDetail = detail;\nvWY = position.y;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uMean;\nvarying vec3 vDetail;\nvarying float vWY;").replace("#include <map_fragment>", `
        vec4 d1 = texture2D(map, vMapUv);
        vec4 d2 = texture2D(map, mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.2317 + vec2(0.37, 0.61));
        float gd = (d1.r / uMean.r) * mix(1.0, d2.r / uMean.r, 0.65);
        gd *= mix(1.0, d1.g / uMean.g, vDetail.x);
        gd *= mix(1.0, d1.b / uMean.b, vDetail.y);
        diffuseColor.rgb *= gd;
        // 崖の地層: 高さ 9 ごとの水平な縞(暖・寒を交互)。立ち上がり(面が上を向いていない所)は暗く、縞の境に細い暗い線
        if (vDetail.z > 0.001) {
          float wy = vWY + 2.2 * sin(vWY * 0.41) + 1.3 * sin(vWY * 1.13 + 1.7);   // 縞の幅を不ぞろいに
          float bi = floor(wy / 9.0), fr = wy / 9.0 - bi, kk = mod(floor(wy / 18.0), 4.0);
          vec3 tint = kk < 1.0 ? vec3(1.12, 1.03, 0.86) : kk < 2.0 ? vec3(0.88, 0.93, 1.02) : kk < 3.0 ? vec3(1.08, 0.97, 0.86) : vec3(0.8, 0.81, 0.85);
          tint *= mod(floor(wy / 36.0), 2.0) < 1.0 ? 1.06 : 0.91;   // 36 ごとの大きな明暗(遠くからも縞が残る)
          vec3 nv = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
          vec3 upv = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float riser = 1.0 - smoothstep(0.5, 0.85, abs(dot(nv, upv)));
          float seam = (1.0 - smoothstep(0.0, 0.1, fr)) * riser;
          vec3 mm = mix(vec3(1.0), tint, 0.55 + 0.45 * riser) * (1.0 - 0.33 * riser) * (1.0 - 0.4 * seam);
          diffuseColor.rgb *= mix(vec3(1.0), mm, vDetail.z);
        }`);
    };
    groundMat.customProgramCacheKey = () => "map-terrain-detail";
    const ground = new THREE.Mesh(tg, groundMat); ground.userData.keep = true; terrain.add(ground);
    // 等高線(6 単位ごと、陸だけ)。図面の線と同じ切替で隠す
    const cpos = [], STEP = 6;
    const edgeP = (i0, j0, i1, j1, L) => { const a = H[j0 * NS + i0], b = H[j1 * NS + i1], t = (L - a) / (b - a); return [-HALF + (i0 + (i1 - i0) * t) * S, L + 0.6, -HALF + (j0 + (j1 - j0) * t) * S]; };
    for (let j = 0; j < NS - 1; j++) for (let i = 0; i < NS - 1; i++) {
      const q = [j * NS + i, j * NS + i + 1, (j + 1) * NS + i + 1, (j + 1) * NS + i];
      if (q.some((v) => Wt[v])) continue;
      const hs = q.map((v) => H[v]), lo = Math.min(...hs), hi = Math.max(...hs);
      for (let L = Math.ceil(lo / STEP) * STEP; L < hi; L += STEP) {
        if (L <= 0) continue;
        const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
        for (let e = 0; e < 4; e++) { const [ai, aj] = corners[e], [bi, bj] = corners[(e + 1) % 4], ha = H[aj * NS + ai], hb = H[bj * NS + bi]; if ((ha < L) !== (hb < L)) pts.push(edgeP(ai, aj, bi, bj, L)); }
        if (pts.length >= 2) cpos.push(...pts[0], ...pts[1]);
        if (pts.length === 4) cpos.push(...pts[2], ...pts[3]);
      }
    }
    const cg = new THREE.BufferGeometry(); cg.setAttribute("position", new THREE.Float32BufferAttribute(cpos, 3));
    const contours = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x8c96a0, transparent: true, opacity: 0.35 })); contours.userData.edges = true; terrain.add(contours);
    // 側面: 地形の模型を切った断面。表土 → 地域の堆積層(尾根は地表と同じ 9 単位の地層)→ 水平な深い地層 → 岩盤。水の所は川底の泥の層。水の切り口は川底の形に沿う
    const DEEP = [[-6, C3(0xcfc3a7)], [-10, C3(0xb9ab8f)], [-14, C3(0x938e85)], [-17.5, C3(0xc3b394)], [-21, C3(0x9c9181)], [-25, C3(0x7a7268)], [BASE, C3(0x625c55)]];   // [下端, 色](上から)
    const fillAt = (y, x, z) => {
      if (ridgeBand(x, z) > 0.18 && y > 0) return strataAt(y);
      const base = Math.abs(x - 200) < 700 ? C3(0xcac4b5) : x < -150 ? C3(0xbfb5a0) : C3(0xd8ccb1);
      return Math.floor(y / 6) % 2 ? base : base.clone().multiplyScalar(0.94);
    };
    const soilAt = (x, z, h) => (h < WY ? C3(0x98a19e) : Math.abs(x - 200) < 700 ? C3(0xb4b2a5) : x < -150 ? C3(0x8f8973) : C3(0xc6b592));
    const sidePos = [], sideCol = [], cut = [];
    const quad = (x0, z0, a0, b0, x1, z1, a1, b1, c0, c1) => {   // 縦の帯(端 0 の上 a0・下 b0、端 1 の上 a1・下 b1)
      if (a0 - b0 < 0.01 && a1 - b1 < 0.01) return;
      sidePos.push(x0, a0, z0, x1, a1, z1, x1, b1, z1, x0, a0, z0, x1, b1, z1, x0, b0, z0);
      for (const c of [c0, c1, c1, c0, c1, c0]) sideCol.push(c.r, c.g, c.b);
    };
    const edgeLines = [(t) => [t, 0], (t) => [t, NS - 1], (t) => [0, t], (t) => [NS - 1, t]];
    for (const f of edgeLines) for (let t = 0; t < NS - 1; t++) {
      const [i0, j0] = f(t), [i1, j1] = f(t + 1), q0 = j0 * NS + i0, q1 = j1 * NS + i1;
      const x0 = -HALF + i0 * S, z0 = -HALF + j0 * S, x1 = -HALF + i1 * S, z1 = -HALF + j1 * S, h0 = H[q0], h1 = H[q1];
      const n0 = 0.95 + 0.1 * fbm((x0 + z0) / 45, 0.3, 2), n1 = 0.95 + 0.1 * fbm((x1 + z1) / 45, 0.3, 2);   // 断面の色のむら
      const tint = (c, n) => c.clone().multiplyScalar(n);
      const s0 = h0 - (h0 < WY ? 1.5 : 2.5), s1 = h1 - (h1 < WY ? 1.5 : 2.5);   // 表土・泥の層の下端
      quad(x0, z0, h0, s0, x1, z1, h1, s1, tint(soilAt(x0, z0, h0), n0), tint(soilAt(x1, z1, h1), n1));
      // 地域の堆積層: -6 から 9 単位ごと(0, 9, 18, …)に表土の下端まで
      const top = Math.max(s0, s1);
      for (let y = -6; y < top; y = y < 0 ? 0 : y + 9) {
        const yt = y < 0 ? 0 : y + 9;
        const a0 = Math.min(yt, s0), b0 = Math.min(y, s0), a1 = Math.min(yt, s1), b1 = Math.min(y, s1), ym = (y + yt) / 2;
        quad(x0, z0, a0, b0, x1, z1, a1, b1, tint(fillAt(ym, x0, z0), n0), tint(fillAt(ym, x1, z1), n1));
      }
      // 水平な深い地層
      let up = -6;
      for (const [lo, c] of DEEP.slice(1)) {
        quad(x0, z0, Math.min(up, s0), Math.min(lo, s0), x1, z1, Math.min(up, s1), Math.min(lo, s1), tint(c, n0), tint(c, n1));
        up = lo;
      }
      if (h0 < WY || h1 < WY) cut.push(x0, WY, z0, x1, WY, z1, x1, Math.min(h1, WY), z1, x0, WY, z0, x1, Math.min(h1, WY), z1, x0, Math.min(h0, WY), z0);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sidePos, 3)); sg.setAttribute("color", new THREE.Float32BufferAttribute(sideCol, 3)); sg.computeVertexNormals();
    const skirt = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); skirt.userData.keep = true; terrain.add(skirt);
    const ctg = new THREE.BufferGeometry(); ctg.setAttribute("position", new THREE.Float32BufferAttribute(cut, 3));
    terrain.add(new THREE.Mesh(ctg, M.waterCut));
    add(box(2 * HALF + 24, 4, 2 * HALF + 24), M.dark, terrain, { y: BASE + 2, edges: false });
    const waterG = new THREE.PlaneGeometry(2 * HALF, 2 * HALF); waterG.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterG, M.water); water.position.y = WY; terrain.add(water);

    // ── 拠点・首都の近くか(装飾を置かない範囲) ──
    const nearSite = (x, z, pad = 0) => POINTS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad) || HQS.some((h) => Math.hypot(x - h.x, z - h.z) < 420 + pad);

    // ── 帯(道路・線路・用水路): 地形に沿わせる ──
    const drape = (pts, step = 20) => {
      const out = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
        for (let s = i === 0 ? 0 : 1; s <= n; s++) out.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]);
      }
      return out;
    };
    const strip = (pts, w, lift, yOf = topH) => {
      const P = pts.map(([x, z, y]) => [x, z, y ?? yOf(x, z) + lift]), pos2 = [];
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, az, ay] = P[i], [bx, bz, by] = P[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, px = (-(bz - az) / l) * (w / 2), pz = ((bx - ax) / l) * (w / 2);
        const q = [[ax + px, ay, az + pz], [bx + px, by, bz + pz], [bx - px, by, bz - pz], [ax - px, ay, az - pz]];
        for (const j of [0, 1, 2, 0, 2, 3]) pos2.push(...q[j]);   // 上向きの面
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos2, 3)); g.computeVertexNormals();
      return g;
    };
    // 折れ線を陸の上の区間に分ける(間の水の上は橋)
    const landPieces = (pl) => {
      const out = []; let cur = [];
      for (const [x, z] of drape(pl, 8)) { if (isWater(x, z)) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push([x, z]); }
      if (cur.length > 1) out.push(cur);
      return out;
    };
    // 西の細い用水路(飾り)
    for (const pc of landPieces(FRESH_W.pts)) {
      add(strip(drape(pc), FRESH_W.hw * 2 + 10, 0.15), M.mid, terrain, { edges: false });
      terrain.add(new THREE.Mesh(strip(drape(pc), FRESH_W.hw * 2, 0.3), M.water));
    }
    // 道路と鉄道。陸の区間は地形に沿う帯、水の上は自動の橋(拠点が受け持つ渡河は除く)
    // 制圧圏の中の道路は台(0.5)のすぐ上(0.75)に描く。拠点が自分で描き直す道路・舗装(0.85 以上)の下になり、台ともちらつかない
    const inZone = (x, z) => POINTS.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 40);
    const roadY = (x, z) => topH(x, z) - (inZone(x, z) ? 0.25 : 0);
    const autoBridges = [];
    const bridgeParts = [];
    const lines = [...ROADS.map((pl) => ({ pl, w: 22, mat: M.road, lift: 0.5 })), { pl: RAIL, w: 14, mat: M.rail, lift: 0.7, rail: true }];
    for (const { pl, w, mat, lift, rail } of lines) {
      const pcs = landPieces(pl);
      for (const pc of pcs) add(strip(drape(pc), w, lift, roadY), mat, terrain, { edges: false });
      for (let i = 0; i < pcs.length - 1; i++) {
        const A = pcs[i][pcs[i].length - 1], B = pcs[i + 1][0], mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], len = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (len > 400 || POINTS.some((p) => Math.hypot(mid[0] - p.x, mid[1] - p.z) < p.r + 100)) continue;
        // 橋: 両岸の少し外から渡す桁、橋脚、欄干、橋台
        const ux = (B[0] - A[0]) / len, uz = (B[1] - A[1]) / len, a = [A[0] - ux * 20, A[1] - uz * 20], b = [B[0] + ux * 20, B[1] + uz * 20];
        const y = Math.max(topH(...a), topH(...b)) + 5, L = len + 40, ang = Math.atan2(ux, uz), c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        bridgeParts.push([box(w + 8, 3, L), { x: c[0], y: y - 1, z: c[1], ry: ang }]);
        for (const s of [-1, 1]) bridgeParts.push([box(1.2, 2.4, L), { x: c[0] + s * (w / 2 + 3.4) * uz, y: y + 1.6, z: c[1] - s * (w / 2 + 3.4) * ux, ry: ang }]);
        for (const e of [a, b]) bridgeParts.push([box(w + 12, y - topH(...e) + 6, 10), { x: e[0], y: (y + topH(...e)) / 2 - 3, z: e[1], ry: ang }]);
        for (let t = 40; t < L - 20; t += 45) { const x = a[0] + ux * t, z = a[1] + uz * t; if (isWater(x, z)) bridgeParts.push([box(w, y - BED, 4), { x, y: (y + BED) / 2 - 2, z, ry: ang }]); }
        autoBridges.push({ name: rail ? "鉄道橋" : "道路橋", a, b, y, rail });
        add(strip([[...a, y + 0.6], [...b, y + 0.6]], w, 0), mat, terrain, { edges: false });
      }
    }
    if (bridgeParts.length) add(U.merge(THREE, bridgeParts), M.light, terrain);
    const nearLine = (x, z, pad) => [...ROADS, RAIL, FRESH_W.pts].some((pl) => lineDist(x, z, pl) < pad);

    // ── 装飾の層(suez_deco_<id>.js が DreamAssets.maps.deco で登録する。畑・木・村・砂漠・運河の設備・街並みなど) ──
    const decoCtx = { THREE, U, F, M, k, K: K_SITE, HALF, CELL, G, WY, BED, landH: topH, rawLandH: landH, isWater, canalDist, ridgeBand, ridgeX, passOpen, fbm, hash2, smooth, segDist, lineDist,
      passes: RIDGE.passes, wadis: WADIS, roads: ROADS, rail: RAIL, fresh: FRESH_W, barrier: BARRIER, lake: LAKE, autoBridges, points: POINTS, hqs: HQS, pads: PADS,
      nearSite, nearLine, drape, strip, rng: U.rng };
    const decos = [];
    for (const [id, make] of Object.entries(DreamAssets.maps.decos ?? {})) { const d = make(THREE, decoCtx); d.group.name = "deco-" + id; group.add(d.group); decos.push(d); }

    // ── 首都(保留中の仮の展開地点) ──
    const hqs = HQS.map((h) => {
      const g = new THREE.Group(); g.position.set(h.x, G, h.z); group.add(g);
      add(new THREE.CylinderGeometry(260, 280, 6, 6), M.light, g, { y: 3 });
      const mat = M.lambert(TEAM[h.f]);
      add(new THREE.CylinderGeometry(282, 282, 2.4, 6), mat, g, { y: 1.2, edges: false });
      add(box(90, 40, 60), M.body, g, { y: 26 });
      add(box(92, 6, 62), mat, g, { y: 34, edges: false });
      add(cyl(2, 70, 6), M.dark, g, { x: 30, y: 76, z: -10 });
      return { ...h, group: g, mat };
    });

    // ── 攻略拠点: 制圧圏(点線と円盤)、旗、建造物(拠点ごとのファイル。無ければ仮の印) ──
    const sites = POINTS.map((p) => {
      const g = new THREE.Group(); g.position.set(p.x, G, p.z); group.add(g);
      const ringMat = U.dashed(THREE, { color: F.P.neutral, dashSize: 26, gapSize: 18, transparent: true, opacity: 0.9 });
      const discMat = M.basic(F.P.neutral, { transparent: true, opacity: 0.1, depthWrite: false });
      const zone = U.zone(THREE, g, p.r, ringMat, discMat);
      zone.ring.position.y = 1.2; zone.disc.position.y = 0.6;
      const flagMat = M.basic(F.P.neutral, { side: THREE.DoubleSide });
      let fx = p.r * 0.72, fz = p.r * 0.52;   // 旗竿は陸の上(制圧圏の縁の近くで水でない場所を探す)
      for (let a = 0.62; a < 0.62 + Math.PI * 2; a += 0.15) { const x = Math.cos(a) * p.r * 0.85, z = Math.sin(a) * p.r * 0.85; if (![0, 25, -25].some((d) => isWater(p.x + x + d, p.z + z) || isWater(p.x + x, p.z + z + d))) { fx = x; fz = z; break; } }
      add(cyl(1.6, 70, 6), M.dark, g, { x: fx, y: 35, z: fz });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(40, 24, 6, 1), flagMat); flag.position.set(fx + 21, 58, fz); g.add(flag);
      const ctx = { THREE, U, F, M, k: F.kit(THREE, M, K_SITE), K: K_SITE, G, WY, BED,
        isWater: (lx, lz) => isWater(p.x + lx, p.z + lz),
        channels: CHANNELS.map((c) => ({ ...c, a: [c.a[0] - p.x, c.a[1] - p.z], b: [c.b[0] - p.x, c.b[1] - p.z] })),
        point: p };
      const make = DreamAssets.maps.sites[p.id];
      let site = null;
      if (make) { site = make(THREE, ctx); g.add(site.group); }
      else add(box(60, 30, 60), M.light, g, { y: 15 });   // 未作成の拠点の仮の印
      return { ...p, group: g, zone, ringMat, discMat, flag, flagMat, site, owner: null, states: STATES[p.id] ?? [] };
    });

    // ── 通行のセル(100 × 100): 水と崖の尾根は通れない。橋・トンネルの所は通れる ──
    const crossings = [...SITE_CROSSINGS, ...autoBridges.map((b) => ({ name: b.name, a: b.a, b: b.b }))];
    const cellXZ = (i, j) => [-HALF + (i + 0.5) * CELL, -HALF + (j + 0.5) * CELL];
    const blocked = new Uint8Array(N * N), crossCell = new Int16Array(N * N).fill(-1);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const [x, z] = cellXZ(i, j), q = j * N + i;
      blocked[q] = isWater(x, z) ? 1 : landH(x, z) > 55 ? 2 : 0;   // 1 = 水、2 = 崖
      crossings.forEach((c, ci) => { if (blocked[q] && segDist(x, z, c.a, c.b) < CELL * 0.6) crossCell[q] = ci; });
    }
    const cellOf = (x, z) => [Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)];
    // useCross: 橋・トンネルを通れる。noAuto: 地図の自動の橋(用水路・分水路)は通れない。noPass: 崖の尾根の帯(峠を含む)は通れない
    function bfs(from, useCross, { noAuto = false, noPass = false } = {}) {
      const prev = new Int32Array(N * N).fill(-2), queue = new Int32Array(N * N); let h = 0, t = 0;
      const [i0, j0] = cellOf(...from), s = j0 * N + i0; prev[s] = -1; queue[t++] = s;
      while (h < t) {
        const q = queue[h++], i = q % N, j = (q / N) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
          const nq = nj * N + ni; if (prev[nq] !== -2) continue;
          if (blocked[nq] && !(useCross && crossCell[nq] >= 0 && !(noAuto && crossCell[nq] >= SITE_CROSSINGS.length))) continue;
          if (noPass) { const [x, z] = cellXZ(ni, nj); if (ridgeBand(x, z) > 0.3) continue; }
          prev[nq] = q; queue[t++] = nq;
        }
      }
      return prev;
    }
    // 首都ごと: 中央へ行けるか、渡河を使わずに行けるか、最短の経路で通る渡河と峠
    function analyze() {
      const center = cellOf(200, 0), cq = center[1] * N + center[0], rows = [];
      for (const h of HQS) {
        const prev = bfs([h.x, h.z], true), ok = prev[cq] !== -2, free = bfs([h.x, h.z], false)[cq] !== -2;
        const used = new Set(); let steps = 0, passes = new Set();
        if (ok) for (let q = cq; q >= 0; q = prev[q]) {
          steps++; if (crossCell[q] >= 0) used.add(crossings[crossCell[q]].name);
          const [x, z] = cellXZ(q % N, (q / N) | 0); if (ridgeBand(x, z) > 0.4) RIDGE.passes.forEach(([pz], pi) => { if (Math.abs(z - pz) < 260) passes.add(`峠 ${pi + 1}`); });
        }
        // 外側の障壁を通らずに運河地帯へ行けるか(A は用水路の橋なし、B・C は峠なし)。行けないのが正しい
        const zone = { A: [-300, 0], B: [700, 1000], C: [700, -200] }[h.f], zq = cellOf(...zone);
        const bypass = bfs([h.x, h.z], true, h.f === "A" ? { noAuto: true } : { noPass: true })[zq[1] * N + zq[0]] !== -2;
        rows.push({ f: h.f, reach: ok, withoutCrossing: free, outerBypass: bypass, cells: steps, crossings: [...used], passes: [...passes] });
      }
      return { blockedCells: blocked.reduce((s, v) => s + (v ? 1 : 0), 0), crossings: crossings.map((c) => c.name), hq: rows };
    }
    // 通れないセルの重ね表示(水 = 青、崖 = 茶、渡河 = 黄)
    const gridOverlay = new THREE.Group(); gridOverlay.visible = false; group.add(gridOverlay);
    const mt = new THREE.Matrix4();
    {
      const cells = { water: [], cliff: [], cross: [] };
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const q = j * N + i; if (!blocked[q]) continue;
        const [x, z] = cellXZ(i, j), key = crossCell[q] >= 0 ? "cross" : blocked[q] === 1 ? "water" : "cliff";
        cells[key].push([x, z, Math.max(WY, landH(x, z)) + 3]);
      }
      const cg2 = new THREE.PlaneGeometry(CELL - 6, CELL - 6); cg2.rotateX(-Math.PI / 2);
      for (const [key, color, op] of [["water", 0x2b6f9e, 0.28], ["cliff", 0x7a5a3a, 0.45], ["cross", 0xffb020, 0.75]]) {
        const im = new THREE.InstancedMesh(cg2, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }), Math.max(1, cells[key].length));
        cells[key].forEach(([x, z, y], n) => { mt.makeTranslation(x, y, z); im.setMatrixAt(n, mt); });
        im.count = cells[key].length; gridOverlay.add(im);
      }
    }

    function setOwner(id, f) {
      const s = sites.find((x) => x.id === id); if (!s) return;
      s.owner = f; const c = f ? TEAM[f] : F.P.neutral;
      s.ringMat.color.set(c); s.discMat.color.set(c); s.flagMat.color.set(c);
      s.site?.setTeam?.(f ? TEAM[f] : null);
    }
    let clock = 0;
    function update(dt) {
      clock += dt;
      M.water.map.offset.y -= dt * 0.04;
      for (const s of sites) {
        s.ringMat.dashOffset = (s.ringMat.dashOffset ?? 0) - dt * 10;
        const pa = s.flag.geometry.attributes.position;   // 旗のはためき
        for (let i = 0; i < pa.count; i++) { const x0 = (i % 7) / 6; pa.setZ(i, Math.sin(clock * 3 + x0 * 4 + s.no) * 3 * x0); }
        pa.needsUpdate = true;
        s.site?.update?.(dt);
      }
      for (const d of decos) d.update?.(dt);
    }

    U.bake(THREE, terrain, {});
    for (const h of hqs) U.bake(THREE, h.group, { live: [h.mat] });
    const labels = [
      ...sites.map((s) => ({ x: s.x, y: 90, z: s.z, text: `${s.no}  ${s.name}`, cls: s.kind })),
      ...hqs.map((h) => ({ x: h.x, y: 110, z: h.z, text: h.name, cls: "hq", f: h.f })),
      { x: -40, y: 20, z: -2300, text: "大運河", cls: "geo" }, { x: 480, y: 20, z: 700, text: "新運河", cls: "geo" },
      { x: -250, y: 20, z: 2480, text: "湖", cls: "geo" }, { x: 2900, y: 20, z: 70, text: "東の分水路", cls: "geo" },
      { x: -900, y: 20, z: -1800, text: "西の用水路(橋 4)", cls: "geo" }, { x: RIDGE.x, y: 160, z: -900, text: "東の崖(峠 4)", cls: "geo" },
      { x: -2400, y: 20, z: 800, text: "西の平野", cls: "geo" }, { x: 3000, y: 20, z: 1400, text: "東の砂丘", cls: "geo" },
      ...RIDGE.passes.map(([pz], i) => ({ x: ridgeX(pz), y: 60, z: pz, text: `峠 ${i + 1}`, cls: "geo" })),
    ];
    return { group, update, setOwner, sites, hqs, labels, isWater, groundY, landH: topH, rawLandH: landH, analyze, gridOverlay, crossings, decos, stats: () => U.stats(group), CELL, HALF, TEAM };
  }

  const maps = ((window.DreamAssets ??= {}).maps ??= { sites: {} });
  maps.sites ??= {};
  maps.site = (id, make) => { maps.sites[id] = make; };   // 拠点のファイルが自分を登録する
  maps.decos ??= {};
  maps.deco = (id, make) => { maps.decos[id] = make; };   // 装飾の層のファイルが自分を登録する
  const DECOS = ["west", "east", "canal", "towns", "zone"];
  maps.suez = { title: "運河地帯(仮)", cells: N, POINTS, HQS, CHANNELS, DECOS, K_SITE, G, WY, BED, isWater, landH, build };
})();
