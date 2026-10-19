// 戦略施設トークン「大エチオピア・ルネサンスダム」(GERD、エチオピア・青ナイル)の詳細版モデル(試作)。
// 平面は実寸の比率(2000 × 1100 m を K 倍)。ナイルの水を握る巨大な RCC(転圧コンクリート)の重力式ダムが決め手。
// 誇張: 高さ方向 1.6 倍(堤高 145 → 232 m、地形も同じ倍率なので谷とダムの関係は保つ)。ダムの下流面は段々(RCC の階段状の越流面)。
// 部品: 本堤(コンクリートのブロックの列と継ぎ目)、中央の越流部(天端を下げた区間。満水を超えると段の上を水が流れ落ちる)、
//       ゲート付きの洪水吐き(ラジアルゲート 6 門・門柱・巻上げ室・急流路・跳ね上げの端)、左岸 10 基・右岸 6 基の発電所と放水路、上流面の取水口、
//       天端の道路と門形クレーン、両岸の開閉所、谷を埋める貯水池、下流の青ナイル。
// 省略: 約 5 km 離れた鞍部ダム(切り取りの外)、車両・人・送電線の細部。
// 近未来化: 右岸の台地にスーダン・エジプトへの電力輸出の HVDC 変換所(バルブホール・変換用変圧器・直流の開閉所)と送電鉄塔の列。
// 状態: "low"(初期の湛水。貯水池が低い)/ "full"(満水。中央の越流部のすぐ下)/ "release"(放流: ゲートが開き、中央の越流部も段を越えて流れる)。
// 水路は z 方向、+z が下流(北のスーダンへ)。
(function () {
  const K = 0.1, V = 1.6;   // 縮尺と高さ方向の誇張
  const D = {
    x0: -1000, x1: 1000, z0: -500, z1: 600, base: -30,
    crest: 145 * V, center: 138 * V, sill: 125 * V, plateau: 160 * V,
    floor: 380, rise: 760,                 // 谷底の半幅と、台地に上がりきる半幅
    chan: 230, chanBed: -10, tail: -2,     // 下流の川の半幅・川底・水位
    toe: (h) => 12 + 0.75 * (h / V),       // 高さ h のブロックの下流の端(勾配は実寸の 0.75 : 1)
  };
  const POOL = { low: 105 * V, full: 137 * V, release: 141 * V };
  const LPH = [-370, -230], RPH = [250, 350], GS = [-220, -96], CEN = [-90, 90];   // 左右の発電所、ゲート付き洪水吐き、中央の越流部(x の範囲)
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const cx = (z) => (z > 130 ? 40 * Math.sin((z - 130) / 230) : 0);   // 下流の川の中心(ゆるく曲がる)
  // 地形の高さ(m)
  function terrainY(x, z) {
    const ax = Math.abs(x - cx(z));
    let y = D.plateau * smooth(D.floor, D.rise, ax) + 10 * Math.sin(x / 170) * Math.cos(z / 130) * smooth(D.rise - 80, D.rise, ax);
    if (z > 122) y = Math.min(y, D.chanBed + 10 * smooth(D.chan - 20, D.chan + 10, ax));   // 下流の川筋
    if (z > 170 && z < 266 && ((x > -376 && x < -224) || (x > 232 && x < 356))) y = Math.min(y, D.chanBed);   // 発電所の放水路
    return y;
  }

  function gerd(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V: V3, waterShape, tube, lattice } = k;
    M.pool = k.water({ repeat: [1, 1] }); M.tail = k.water(); M.sheet = k.water({ opacity: 0.55 }); M.chute = k.water({ opacity: 0.55 });
    M.concrete = M.lambert(0xe2e5e8);
    const group = new THREE.Group(); group.name = "gerd";
    const ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);
    // 断面 [[z, y], ...] を x0〜x1 に押し出す(凹形でよい)
    const extX = (zy, x0, x1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(zy.map(([z, y]) => new THREE.Vector2(-z, y))), { depth: x1 - x0, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(x0, 0, 0); return g; };

    // ── 地形の塊(上面は面ごとの陰影、四方の切り口) ──
    {
      const nx = 80, nz = 44, pos = [], sk = [];
      const P = (i, j) => { const x = D.x0 + ((D.x1 - D.x0) * i) / nx, z = D.z0 + ((D.z1 - D.z0) * j) / nz; return [x, terrainY(x, z), z]; };
      const tri = (arr, a, b, c) => { const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); if (ny < 0) arr.push(...a, ...c, ...b); else arr.push(...a, ...b, ...c); };
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = P(i, j), b = P(i + 1, j), c = P(i, j + 1), d = P(i + 1, j + 1); tri(pos, a, b, d); tri(pos, a, d, c); }
      const cxm = (D.x0 + D.x1) / 2, czm = ZC;
      const out = (p, q, r) => { const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2]; const nx_ = uy * vz - uz * vy, nz_ = ux * vy - uy * vx; sk.push(...p, ...(nx_ * ((p[0] + q[0] + r[0]) / 3 - cxm) + nz_ * ((p[2] + q[2] + r[2]) / 3 - czm) < 0 ? [...r, ...q] : [...q, ...r])); };
      const edges = [[...Array(nx + 1)].map((_, i) => P(i, 0)), [...Array(nz + 1)].map((_, j) => P(nx, j)), [...Array(nx + 1)].map((_, i) => P(nx - i, nz)), [...Array(nz + 1)].map((_, j) => P(0, nz - j))];
      for (const e of edges) for (let i = 0; i < e.length - 1; i++) { const a = e[i], b = e[i + 1], a0 = [a[0], D.base, a[2]], b0 = [b[0], D.base, b[2]]; out(a0, b0, b); out(a0, b, a); }
      const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
      add(geo(pos), M.land, world, { edges: false });
      add(geo(sk), M.mid, world);
      F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.001, { z: ZC });
    }

    // ── 本堤: 幅 60 m 前後のコンクリートのブロック(継ぎ目に輪郭線)。下流面は段々 ──
    const stepped = (yb, top, smoothFace = false) => {
      const h = top - yb, w = D.toe(D.crest - yb) - 12, pts = [[0, yb], [0, top], [12, top]];
      if (smoothFace) {   // 洪水吐きの急流路: 越流の頂部の丸み → 一様な斜面 → 下端の跳ね上げ
        pts.push([16, top - 2], [20, top - 7]);
        pts.push([12 + w - 6, yb + 8], [12 + w + 4, yb + 6], [12 + w + 8, yb + 10], [12 + w + 10, yb]);
        return pts;
      }
      const n = Math.max(1, Math.round(h / 14)), dw = w / n, dh = h / n;   // 蹴上げ(縦)と踏み面(横)を交互に
      for (let i = 0; i < n; i++) pts.push([12 + dw * i, top - dh * (i + 1)], [12 + dw * (i + 1), top - dh * (i + 1)]);
      return pts;
    };
    const blocks = [];
    {
      const cuts = [-760, -700, -640, -580, -520, -460, -410, LPH[0], -300, LPH[1], GS[0], GS[1], CEN[0], -30, 30, CEN[1], 150, 200, RPH[0], 300, RPH[1], 420, 480, 540, 600, 660, 720, 760];
      for (let i = 0; i < cuts.length - 1; i++) {
        const xa = cuts[i], xb = cuts[i + 1], xm = (xa + xb) / 2;
        const inGS = xm > GS[0] && xm < GS[1], inC = xm > CEN[0] && xm < CEN[1];
        const top = inGS ? D.sill : inC ? D.center : D.crest;
        let yb = Infinity; for (let s = 0; s <= 4; s++) for (const z of [0, 40, 90]) yb = Math.min(yb, terrainY(xa + ((xb - xa) * s) / 4, z));
        yb -= 3;
        if (top - yb < 6) continue;
        add(extX(stepped(yb, top, inGS), xa + 0.4, xb - 0.4), inGS ? M.concrete : M.light, world);
        blocks.push({ xa, xb, top, yb });
      }
    }
    // 天端の道路と胸壁(洪水吐きは門柱の上の橋で越える)、門形クレーン
    for (const [xa, xb] of [[-740, GS[0]], [GS[1], CEN[0]], [CEN[1], 740]]) {
      add(box(xb - xa, 0.6, 12), M.mid, world, { x: (xa + xb) / 2, y: D.crest + 0.3, z: 6, edges: false });
      for (const z of [0.6, 11.4]) add(box(xb - xa, 1.4, 1.2), M.body, world, { x: (xa + xb) / 2, y: D.crest + 1.3, z });
    }
    add(box(CEN[1] - CEN[0] + 4, 2.6, 12), M.light, world, { x: 0, y: D.crest - 0.7, z: 6 });   // 中央の越流部を跨ぐ天端の道路橋(水は橋脚の間を越える)
    for (const z of [0.6, 11.4]) add(box(CEN[1] - CEN[0] + 4, 1.4, 1.2), M.body, world, { x: 0, y: D.crest + 1.3, z });
    for (let x = CEN[0] + 30; x < CEN[1] - 1; x += 30) add(box(3, D.crest - 2 - D.center, 12), M.body, world, { x, y: (D.crest - 2 + D.center) / 2, z: 6 });
    for (const xg of [(LPH[0] + LPH[1]) / 2, (RPH[0] + RPH[1]) / 2]) {   // 取水口の上の門形クレーン
      const g = new THREE.Group(); g.position.set(xg, D.crest + 0.6, 6); world.add(g);
      for (const s of [-1, 1]) for (const zz of [-5, 5]) tube(g, V3(s * 8, 0, zz), V3(s * 8, 22, zz), 0.9, M.steel);
      add(box(20, 3, 13), M.steel, g, { y: 23.5 }); add(box(8, 4, 6), M.dark, g, { y: 27 });
    }

    // ── ゲート付きの洪水吐き: 門柱 7・ラジアルゲート 6(門柱の間を回る)・門柱の上の巻上げ室・急流路の側壁 ──
    const NB = 6, PIER = 4, BAY = (GS[1] - GS[0] - (NB + 1) * PIER) / NB, TR = V3(0, D.sill + 14, 24), GR = 24.4;
    const gates = [];
    for (let i = 0; i <= NB; i++) {
      const x = GS[0] + PIER / 2 + i * (PIER + BAY);
      add(box(PIER, D.crest + 8 - D.sill, 48), M.body, world, { x, y: (D.crest + 8 + D.sill) / 2, z: 18 });
      add(box(PIER + 2, 6, 10), M.light, world, { x, y: D.crest + 11, z: 4 });
      add(box(PIER + 2.2, 1.4, 10.2), M.accent, world, { x, y: D.crest + 9.6, z: 4, edges: false });
      add(cyl(1.6, PIER + 1, 10), M.dark, world, { x, y: TR.y, z: TR.z, rz: Math.PI / 2, edges: false });   // 軸受け
    }
    add(box(GS[1] - GS[0], 2.4, 8), M.light, world, { x: (GS[0] + GS[1]) / 2, y: D.crest + 1.2, z: 38 });   // 下流側の道路橋
    // 扉(扇形の帯を押し出し、軸のまわりに回す)
    const leafShape = (() => { const pts = [], a0 = -0.611, a1 = 0.563, n = 10; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push(new THREE.Vector2(GR * Math.cos(a), GR * Math.sin(a))); } for (let i = n; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / n; pts.push(new THREE.Vector2((GR - 1.2) * Math.cos(a), (GR - 1.2) * Math.sin(a))); } return new THREE.Shape(pts); })();
    for (let i = 0; i < NB; i++) {
      const x0 = GS[0] + PIER + i * (PIER + BAY);
      const g = new THREE.Group(); g.position.set(x0 + BAY / 2, TR.y, TR.z); world.add(g);
      const lg = new THREE.ExtrudeGeometry(leafShape, { depth: BAY - 0.8, bevelEnabled: false }); lg.translate(0, 0, -(BAY - 0.8) / 2);
      lg.rotateY(Math.PI / 2);   // 断面の x を GR cos a で作ると、回したあと z = -GR cos a(軸より上流)、押し出しは x 方向
      add(lg, M.steel, g);
      for (const s of [-1, 1]) for (const a of [-0.45, 0.4]) tube(g, V3(s * (BAY / 2 - 1.2), 0, 0), V3(s * (BAY / 2 - 1.2), (GR - 1.2) * Math.sin(a), -(GR - 1.2) * Math.cos(a)), 0.55, M.dark);
      gates.push(g);
    }
    // 急流路の側壁と導流壁
    for (const x of [GS[0] - 1, GS[1] + 1]) {
      const yb = Math.min(terrainY(x, 60), 0) - 3;
      add(extX([[30, D.sill + 6], [12 + D.toe(D.crest - yb) - 12 + 10, yb + 14], [12 + D.toe(D.crest - yb) - 12 + 10, yb], [30, D.sill - 30]], x - 1.5, x + 1.5), M.body, world);
    }

    // ── 発電所(左 10 基・右 6 基): 建屋・屋根の段・窓の帯・変圧器の列・放水路。上流面に取水口 ──
    for (const [xa, xb, n] of [[...LPH, 10], [...RPH, 6]]) {
      const w = xb - xa, zt = D.toe(D.crest) + 0.5, d = 54, h = 40 * V;
      add(box(w, h - D.chanBed, d), M.body, world, { x: (xa + xb) / 2, y: (h + D.chanBed) / 2, z: zt + d / 2 });
      add(box(w + 0.4, 5, d + 0.4), M.glass, world, { x: (xa + xb) / 2, y: h - 12, z: zt + d / 2, edges: false });
      add(box(w + 0.6, 1.6, d + 0.6), M.accent, world, { x: (xa + xb) / 2, y: h - 3, z: zt + d / 2, edges: false });
      for (let i = 0; i < n; i++) {
        const x = xa + (w * (i + 0.5)) / n;
        add(box(w / n - 3, 6, 18), M.light, world, { x, y: h + 3, z: zt + 14 });                 // 屋根の発電機の上屋
        add(box(w / n - 5, 7, 7), M.dark, world, { x, y: h + 3.5, z: zt + 40 });                  // 主変圧器(屋上の下流側)
        add(box(w / n - 4, 10, 6), M.dark, world, { x, y: 5, z: zt + d + 3, edges: false });      // 放水口
        add(box(w / n - 6, 26, 14), M.light, world, { x, y: 150 + 13, z: -7 });                  // 取水口(上流面。半ば水の中)
        add(box(w / n - 8, 18, 0.6), M.dark, world, { x, y: 150 + 11, z: -14.3, edges: false });  // じんかい除けの格子
      }
      // 放水路の水(発電所の下流の掘り込みから川へ)
      const zt2 = zt + d, x0 = xa < 0 ? xa - 4 : 232, x1 = xa < 0 ? -224 : xb + 4;
      world.add(waterShape([[x0, zt2], [x1, zt2], [x1, 264], [x0, 264]], M.tail).translateY(D.tail));
      for (const xw of [x0, x1]) if (Math.abs(xw) > 240) add(box(3, 12, 264 - zt2), M.light, world, { x: xw, y: D.chanBed + 6, z: (zt2 + 264) / 2 });   // 放水路の側壁
    }

    // 起伏のある台地に置く敷地: 四隅と中心の最も高い所 + 0.5 を上面にし、最も低い所の 2 m 下まで塊にする(浮かない)
    const pad = (parent, x, z, w, d, mat = M.light) => {
      const ys = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => terrainY(x + (a * w) / 2, z + (b * d) / 2));
      const top = Math.max(...ys) + 0.5, bot = Math.min(...ys) - 2;
      add(box(w, top - bot, d), mat, parent, { x, y: (top + bot) / 2, z }); return top;
    };
    // ── 開閉所(左右の台地)と管制棟(右岸) ──
    for (const [x, z] of [[-860, 180], [850, 40]]) {
      const y = pad(world, x, z, 120, 80);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) lattice(world, V3(x - 45 + i * 30, y, z - 20 + j * 40), 22, 2.2, 1.4, 2, 0.25, M.mid);
      for (let i = 0; i < 6; i++) add(box(6, 6, 8), M.dark, world, { x: x - 50 + i * 20, y: y + 3, z });
    }
    {
      const x = 840, z = -100, y = pad(world, x, z, 70, 34);
      add(box(60, 18, 26), M.body, world, { x, y: y + 9, z });
      add(box(60.4, 3, 26.4), M.glass, world, { x, y: y + 12, z, edges: false });
      add(box(61, 1.4, 27), M.accent, world, { x, y: y + 17.4, z, edges: false });
    }

    // ── 近未来化: HVDC 変換所(右岸の台地)と送電鉄塔の列 ──
    const hv = new THREE.Group(); world.add(hv);
    {
      const x = 880, z = 260, y = pad(hv, x, z, 150, 230);
      for (const dz of [-50, 50]) {   // バルブホール 2 棟
        add(box(70, 28, 40), M.body, hv, { x: x - 30, y: y + 14, z: z + dz });
        add(box(70.4, 1.6, 40.4), M.accent, hv, { x: x - 30, y: y + 24, z: z + dz, edges: false });
        for (let i = 0; i < 3; i++) add(box(12, 12, 10), M.dark, hv, { x: x + 15, y: y + 6, z: z + dz - 13 + i * 13 });   // 変換用変圧器
      }
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) lattice(hv, V3(x + 45 + j * 20, y, z - 70 + i * 70), 30, 2.2, 1.2, 3, 0.25, M.mid);   // 直流の開閉所
      for (let i = 0; i < 4; i++) {   // 送電鉄塔(台座の奥へ延びる線)
        const pz = -440 + i * 110, p = V3(930, terrainY(930, pz) - 1, pz);
        lattice(hv, p, 48, 5, 1.6, 4, 0.35, M.mid);
        add(box(18, 1.2, 1.2), M.mid, hv, { x: p.x, y: p.y + 44, z: p.z });
      }
    }

    // ── 水: 貯水池(上流)、下流の川、中央の越流部と急流路を流れ落ちる水 ──
    const pool = waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, -0.5], [D.x0, -0.5]], M.pool); world.add(pool);
    M.pool.map.repeat.set(1, 1);
    const cutG = new THREE.PlaneGeometry(2 * D.rise, 1); cutG.translate(0, 0.5, 0);
    const poolCut = new THREE.Mesh(cutG, M.waterCut); poolCut.position.set(0, 0, D.z0 + 0.5); world.add(poolCut);
    const chanPts = []; for (let z = 122; z <= D.z1; z += 40) chanPts.push([cx(z) - D.chan + 6, z]); for (let z = D.z1; z >= 122; z -= 40) chanPts.push([cx(z) + D.chan - 6, z]);
    world.add(waterShape(chanPts, M.tail).translateY(D.tail));
    world.add(new THREE.Mesh(new THREE.PlaneGeometry(2 * D.chan - 12, D.tail - D.chanBed).translate(cx(D.z1), (D.tail + D.chanBed) / 2, D.z1 - 0.5), M.waterCut));
    // 流れ落ちる水の帯(段の角に沿う斜面。uv の v が下る向き)
    const slopeSheet = (xa, xb, zTop, yTop, zBot, yBot, mat, lift) => {
      const L = Math.hypot(zBot - zTop, yTop - yBot), g = new THREE.BufferGeometry();
      const p = [[xa, yTop + lift, zTop], [xb, yTop + lift, zTop], [xb, yBot + lift, zBot], [xa, yBot + lift, zBot]];
      const uv = [[0, 0], [((xb - xa) * K) / U.WATER_TILE[0], 0], [((xb - xa) * K) / U.WATER_TILE[0], (L * K) / U.WATER_TILE[1] * 3], [0, (L * K) / U.WATER_TILE[1] * 3]];
      const idx = [0, 2, 1, 0, 3, 2];
      g.setAttribute("position", new THREE.Float32BufferAttribute(idx.flatMap((i) => p[i]), 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(idx.flatMap((i) => uv[i]), 2)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); world.add(m); return m;
    };
    const sheetC = slopeSheet(CEN[0] + 1, CEN[1] - 1, 12, D.center, D.toe(D.crest), 0, M.sheet, 2.0);
    const sheetG = slopeSheet(GS[0] + 1, GS[1] - 1, 20, D.sill - 7, D.toe(D.crest) - 6, 8, M.chute, 1.5);

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, opts.r ?? 116, M.ring, M.disc);

    // ── 状態と動き ──
    let state = opts.state ?? "full", level = POOL[state === "low" ? "low" : "full"], gateA = 0;
    const GATE_OPEN = 0.9;
    function apply() {
      pool.position.y = level; poolCut.scale.y = level; poolCut.position.y = 0;
      for (const g of gates) g.rotation.x = gateA;
      sheetC.visible = level > D.center + 0.5;
      sheetG.visible = gateA > 0.1;
    }
    function update(dt) {
      const target = POOL[state], gTarget = state === "release" ? GATE_OPEN : 0;
      level += Math.sign(target - level) * Math.min(Math.abs(target - level), dt * 12);
      gateA += Math.sign(gTarget - gateA) * Math.min(Math.abs(gTarget - gateA), dt * 0.15);
      apply();
      const flowing = state === "release";
      M.sheet.map.offset.y -= dt * 0.8; M.chute.map.offset.y -= dt * 1.2 * (gateA / GATE_OPEN);
      M.tail.map.offset.y -= dt * (flowing ? 0.5 : 0.12);
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) { if (s in POOL) state = s; }
    apply();

    // 確認値: 扉の回転の範囲で、門柱の上の道路橋・軸より下流へ出ないか、閉じたときの下端と敷居
    function check() {
      const pt = (a, ang) => { const z = -GR * Math.cos(a), y = GR * Math.sin(a); return { z: TR.z + y * Math.sin(ang) + z * Math.cos(ang), y: TR.y + y * Math.cos(ang) - z * Math.sin(ang) }; };   // rotation.x = ang と同じ回し方
      let maxZ = -Infinity, maxY = -Infinity;
      for (let s = 0; s <= 10; s++) { const ang = (GATE_OPEN * s) / 10; for (const a of [-0.611, 0, 0.563]) { const p = pt(a, ang); maxZ = Math.max(maxZ, p.z); maxY = Math.max(maxY, p.y); } }
      const shut = pt(-0.611, 0), r1 = (v) => +v.toFixed(2);
      return {
        gateToRoadBridge_m: r1(38 - 4 - maxZ),            // 扉の最も下流の点と道路橋の上流の面
        gateTopOpen_y: r1(maxY), crest_y: D.crest,        // 開いた扉の最も高い点(天端の上でも門柱の間)
        gateShutBottomToSill_m: r1(shut.y - D.sill),      // 閉じた扉の下端と敷居
        poolBelowCrest_m: r1(D.crest - POOL.release),     // 放流時の貯水位と天端の余裕
        overflowDepth_m: r1(POOL.release - D.center),     // 中央の越流部を越える水深
        damLength_m: r1(blocks[blocks.length - 1].xb - blocks[0].xa), blocks: blocks.length,
      };
    }

    U.bake(THREE, group, { dynamic: gates, live: [M.accent] });
    const at = (x, y, z) => V3(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setState, check, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        dam: { label: "本堤と越流部", target: [0, 120, 60], pos: [380, 330, 620] },
        spill: { label: "ゲートの洪水吐き", target: [-160, 200, 20], pos: [-40, 290, 260] },
        power: { label: "左岸の発電所", target: [-300, 40, 150], pos: [-120, 160, 420] },
        hvdc: { label: "HVDC 変換所", target: [870, 260, 240], pos: [640, 380, 520] },
      },
    };
  }

  DreamAssets.fac.register("gerd", {
    section: 9, title: "大エチオピア・ルネサンスダム", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "青ナイルをせき止める全長約 1.8 km の転圧コンクリートの重力式ダム。ナイルの水を握り、下流のエジプト・スーダンとの係争の中心。電力輸出の HVDC 変換所を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/gerd.js"], ["大きさ", "実寸 2000 × 1100 m を 0.1 倍 × 表示 3.0"], ["誇張", "高さ方向 1.6 倍(堤高 145 → 232 m。地形も同じ倍率)"], ["省略", "約 5 km 先の鞍部ダム、車両・人"], ["動作", "湛水 / 満水 / 放流(ゲートが開き、中央の越流部の段を水が流れ落ちる)"], ["近未来化", "HVDC 変換所と送電鉄塔の列(スーダン・エジプトへの輸出)"]],
    dist: 1200, target: 60, tokenAt: [440, 0, 340],
    make: (THREE) => gerd(THREE, { r: 116 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["湛水(低水位)", () => a.setState("low"), () => a.state === "low"], ["満水", () => a.setState("full"), () => a.state === "full"], ["放流", () => a.setState("release"), () => a.state === "release"]],
    caption: (a) => (a.state === "release" ? "放流中 — ゲートが開き、中央の越流部の段を水が流れ落ちる" : ""),
  });
})();
