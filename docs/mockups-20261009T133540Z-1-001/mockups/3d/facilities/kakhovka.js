// 戦略施設トークン「カホフカ水力発電所ダム」(ウクライナ、ドニプロ川)の詳細版モデル(試作)。
// 平面は実寸の比率(1600 × 1000 m を K 倍)。コンクリートの区間(閘門 1 室、発電所 6 基、洪水吐き 28 門)と両側の土堰堤、上流の旧貯水池、下流の川。
// 誇張(モデルの決め手 = 決壊したダムと湖底の森): ダムまわりの高さ 1.5 倍(水位差 16 → 24 m、天端 +33 m)、湖底の森の木の高さ 2 倍(約 18 m)。
// 省略: 車両・人・送電線・小さな機器。
// 状態(施設リストの分岐トークン):
//   "ruin"(現在。2023 年 6 月の決壊: 洪水吐きの中央 270 m と発電所が崩れ、旧湖底を川が流れ、柳の森が育つ)
//   "rebuilt"(新ダム再建 + 浮体式太陽光: 洪水吐きと発電所を作り直し、貯水池に浮体式の太陽光発電と変電所)
//   "reserve"(湖底の森を保護区化: 決壊の跡は残し、森に観察塔・木道・研究所)
// 水路は z 方向、+z が下流。
(function () {
  const K = 0.11;
  const D = { x0: -800, x1: 800, z0: -500, z1: 500, base: -12, tail: 0, bedDown: -6, pool: 24, crest: 33, spill: 12, bank: 3, lakeBed: 0.5, treeH: 18 };
  const SP = { x0: -220, x1: 231, n: 28 }, BR = { x0: -150, x1: 120 }, HPP = { x0: -460, x1: -230 }, LOCK = { x: -491, w: 18 };
  const ZC = 0;

  function kakhovka(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 110;
    const M = F.mats(THREE);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, prism, waterShape, tube, lattice } = k;
    M.tail = k.water(); M.pool = k.water(); M.creek = k.water(); M.breach = k.water();
    M.panel = M.lambert(0x2b3a4a); M.sand = M.lambert(0xe6e2d6);
    const group = new THREE.Group(); group.name = "kakhovka";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);
    const rnd = U.rng(23);
    const extX = (zy, x0, x1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(zy.map(([z, y]) => new THREE.Vector2(-z, y))), { depth: x1 - x0, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(x0, 0, 0); return g; };
    const gRuin = new THREE.Group(), gIntact = new THREE.Group(), gForest = new THREE.Group(), gPool = new THREE.Group(), gReserve = new THREE.Group();
    for (const g of [gRuin, gIntact, gForest, gPool, gReserve]) world.add(g);

    // ── 台座: 上流の旧湖底、下流の両岸と川底、川、足元の帯 ──
    add(prism([[D.x0, D.z0], [D.x1, D.z0], [D.x1, -20], [D.x0, -20]], D.base, D.lakeBed), M.sand, world);
    for (const [xa, xb] of [[D.x0, -520], [240, D.x1]]) add(prism([[xa, 60], [xb, 60], [xb, D.z1], [xa, D.z1]], D.base, D.bank), M.land, world);
    add(box(760, D.bedDown - D.base, D.z1 - 30), M.light, world, { x: -140, y: (D.base + D.bedDown) / 2, z: (D.z1 + 30) / 2, edges: false });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.001);
    const tail = waterShape([[-520, 40], [240, 40], [240, D.z1], [-520, D.z1]], M.tail); world.add(tail);
    const cut = (w, h, o) => [new THREE.PlaneGeometry(w, h), o];
    world.add(new THREE.Mesh(U.merge(THREE, [cut(760, -D.bedDown, { x: -140, y: D.bedDown / 2, z: D.z1 })]), M.waterCut));

    // ── 土堰堤(両側。天端に道路) ──
    const EMB = [[-95, D.base], [95, D.base], [10, D.crest], [-10, D.crest]];
    for (const [xa, xb] of [[D.x0, -506], [231, D.x1]]) {
      add(extX(EMB, xa, xb), M.land, world);
      add(box(xb - xa, 0.3, 12), M.mid, world, { x: (xa + xb) / 2, y: D.crest + 0.15, z: 0, edges: false });
      add(extX([[-45, D.base], [-30, D.base], [-30, 10], [-45, 3]], xa, xb), M.mid, world);   // 上流の石張り
    }

    // 区間の継ぎ目の擁壁(閘門と発電所の間、発電所と洪水吐きの間)
    for (const [xa, xb] of [[-468, HPP.x0], [HPP.x1, SP.x0]]) add(box(xb - xa, D.crest + 2 - D.base, 90), M.light, world, { x: (xa + xb) / 2, y: (D.crest + 2 + D.base) / 2, z: 0 });
    // ── 閘門(1 室、両側の壁、上下の閘首と合掌式の扉、機械室) ──
    const LX0 = LOCK.x - LOCK.w / 2, LX1 = LOCK.x + LOCK.w / 2;
    for (const x of [LX0 - 7, LX1 + 7]) {
      add(box(14, D.crest - D.base, 330), M.light, world, { x, y: (D.crest + D.base) / 2, z: -40 });
      add(box(14.4, 0.6, 330.4), M.mid, world, { x, y: D.crest - 3, z: -40, edges: false });
    }
    add(box(LOCK.w, D.bedDown - 2 - D.base, 330), M.mid, world, { x: LOCK.x, y: (D.bedDown - 2 + D.base) / 2, z: -40, edges: false });
    for (const [z, h] of [[-200, D.crest - D.lakeBed], [118, D.crest - D.bedDown]]) {
      add(box(LOCK.w + 28, 10, 18), M.light, world, { x: LOCK.x, y: D.crest + 5, z });   // 閘首の門形と機械室
      add(box(LOCK.w + 28.4, 1.6, 18.4), M.glass, world, { x: LOCK.x, y: D.crest + 6, z, edges: false });
      for (const s of [-1, 1]) add(box(LOCK.w / 2 + 1, h - 6, 1.6), M.mid, world, { x: LOCK.x + s * LOCK.w / 4, y: D.crest - (h - 6) / 2 - 2, z: z + 4 + 3, ry: s * 0.35 });
    }
    // 閘室の水(下流側の水位)
    const lockW = waterShape([[LX0, -195], [LX1, -195], [LX1, 115], [LX0, 115]], M.tail); world.add(lockW);

    // ── 洪水吐き: 堤体(越流の曲面)、門柱、ゲート、天端の道路橋とクレーンの軌道。中央 270 m は決壊で崩れる ──
    const BODY = [[-20, D.base], [45, D.base], [45, D.bedDown], [28, D.bedDown], [12, D.spill - 8], [4, D.spill - 1], [-4, D.spill], [-20, D.spill]];
    const pierX = (i) => SP.x0 + (i * (SP.x1 - SP.x0)) / SP.n;
    const inBreach = (x) => x > BR.x0 && x < BR.x1;
    const spillPart = (g, xa, xb, piers) => {
      add(extX(BODY, xa, xb), M.light, g);
      for (const i of piers) {
        const x = pierX(i);
        add(box(3.6, D.crest + 3 - D.bedDown, 48), M.body, g, { x, y: (D.crest + 3 + D.bedDown) / 2, z: -1 });
        add(box(3.8, 2, 4), M.dark, g, { x, y: D.spill + 16, z: -14, edges: false });   // ゲートの戸溝
      }
      for (let i = 0; i < SP.n; i++) {
        const xm = (pierX(i) + pierX(i + 1)) / 2;
        if (xm < xa || xm > xb) continue;
        add(box(12.4, D.pool - D.spill + 2, 1.6), M.mid, g, { x: xm, y: (D.pool + 2 + D.spill) / 2, z: -14 });
        for (const y of [D.spill + 4, D.spill + 9]) add(box(12.6, 0.6, 2.0), M.dark, g, { x: xm, y, z: -14, edges: false });
      }
      add(box(xb - xa, 2, 16), M.light, g, { x: (xa + xb) / 2, y: D.crest + 2, z: -15 });   // 道路橋
      add(box(xb - xa, 1.2, 12), M.mid, g, { x: (xa + xb) / 2, y: D.crest + 2.6, z: 12 });   // クレーンの軌道桁
    };
    const piersIn = (xa, xb) => Array.from({ length: SP.n + 1 }, (_, i) => i).filter((i) => pierX(i) >= xa - 0.1 && pierX(i) <= xb + 0.1);
    spillPart(world, SP.x0, BR.x0, piersIn(SP.x0, BR.x0));
    spillPart(world, BR.x1, SP.x1, piersIn(BR.x1, SP.x1));
    spillPart(gIntact, BR.x0, BR.x1, piersIn(BR.x0 + 1, BR.x1 - 1));
    // 門形クレーン(残った区間に 1 基、再建では中央にもう 1 基)
    const gantry = (g, x) => { for (const s of [-1, 1]) add(box(2.4, 22, 3), M.light, g, { x: x + s * 7, y: D.crest + 14, z: 12 }); add(box(18, 4, 6), M.light, g, { x, y: D.crest + 26, z: 12 }); add(box(6, 3.5, 5), M.body, g, { x, y: D.crest + 29.8, z: 12 }); };
    gantry(world, 180); gantry(gIntact, -20);
    // 決壊の跡: 堤体の根元、折れた門柱、落ちた道路橋、下流へ流された塊
    add(extX([[-20, D.base], [40, D.base], [40, D.bedDown - 1], [-20, D.bedDown + 2]], BR.x0, BR.x1), M.light, gRuin);
    for (const [x, h] of [[BR.x0 + 6, 14], [BR.x1 - 6, 9], [-60, 4], [40, 5]]) add(box(3.6, h, 30), M.body, gRuin, { x, y: D.bedDown + h / 2, z: -2, rz: (rnd() - 0.5) * 0.3 });
    for (const [x, s] of [[BR.x0, 1], [BR.x1, -1]]) add(box(46, 2, 16), M.light, gRuin, { x: x + s * 21, y: D.crest - 9, z: -15, rz: -s * 0.42 });
    for (let i = 0; i < 26; i++) {
      const w = 6 + rnd() * 12;
      add(box(w, 3 + rnd() * 5, 5 + rnd() * 8), rnd() < 0.5 ? M.light : M.mid, gRuin, { x: BR.x0 + 10 + rnd() * (BR.x1 - BR.x0 - 20), y: D.bedDown + 1.5, z: 20 + rnd() * 170, ry: rnd() * 3, rz: (rnd() - 0.5) * 0.4 });
    }
    const breachW = waterShape([[BR.x0 + 4, -70], [BR.x1 - 4, -70], [BR.x1 - 4, 39], [BR.x0 + 4, 39]], M.breach); breachW.position.y = D.lakeBed + 0.4; gRuin.add(breachW);

    // ── 発電所(6 基): 取水口(除塵スクリーン)、発電機室、変圧器。決壊では殻だけ残る ──
    const HX = (HPP.x0 + HPP.x1) / 2, HW = HPP.x1 - HPP.x0;
    add(box(HW, D.crest + 3 - D.base, 34), M.light, gIntact, { x: HX, y: (D.crest + 3 + D.base) / 2, z: -18 });
    for (let i = 0; i < 12; i++) add(box(14, 14, 0.6), M.dark, gIntact, { x: HPP.x0 + 12 + i * 18.6, y: D.lakeBed + 8, z: -35.3, edges: false });
    add(box(HW, 42 - D.base, 46), M.body, gIntact, { x: HX, y: (42 + D.base) / 2, z: 22 });
    add(box(HW + 0.4, 3, 46.4), M.glass, gIntact, { x: HX, y: 34, z: 22, edges: false });
    for (let i = 0; i <= 6; i++) add(box(2, 40, 1.4), M.light, gIntact, { x: HPP.x0 + (i * HW) / 6, y: 22, z: 45.7 });
    for (let i = 0; i < 6; i++) {
      const x = HPP.x0 + ((i + 0.5) * HW) / 6;
      add(box(10, 8, 8), M.mid, gIntact, { x, y: D.crest + 7, z: -14 });   // 主変圧器(上流の床)
      add(box(16, 5, 0.6), M.dark, gIntact, { x, y: D.bedDown + 2.5, z: 45.4, edges: false });   // 吸出し管の出口
    }
    // 決壊: 発電所の壁の残り(高さがまちまち)と、落ちた屋根・がれき
    for (let i = 0; i < 9; i++) {
      const xa = HPP.x0 + (i * HW) / 9, h = 8 + rnd() * 26;
      add(box(HW / 9 - 2, h, 3), M.body, gRuin, { x: xa + HW / 18, y: D.bank + h / 2 - 6, z: 44 });
      add(box(HW / 9 - 2, 10 + rnd() * 30, 3), M.light, gRuin, { x: xa + HW / 18, y: D.bank + 2, z: -34 });
    }
    add(box(HW, D.bank + 4 - D.base, 80), M.mid, gRuin, { x: HX, y: (D.bank + 4 + D.base) / 2, z: 5 });
    for (let i = 0; i < 16; i++) add(box(10 + rnd() * 14, 2.5, 6 + rnd() * 10), rnd() < 0.5 ? M.light : M.mid, gRuin, { x: HPP.x0 + 10 + rnd() * (HW - 20), y: D.bank + 5, z: -25 + rnd() * 60, ry: rnd() * 3, rx: (rnd() - 0.5) * 0.5 });

    // ── 旧湖底(決壊・保護区): 蛇行する流れと、柳の森(2 倍の高さ)。木は InstancedMesh 1 つ ──
    const cx = (z) => { const a = Math.min(1, (-60 - z) / 160); return -15 + a * 150 * Math.sin((z - D.z0) / 120); };
    const half = (z) => 45 + Math.max(0, (z + 160) / 100) * 80;
    const ribbon = () => {
      const pos = [], uv = []; let len = 0, prev = null;
      const rows = []; for (let z = D.z0; z <= -68; z += 8) rows.push(z);
      const P = rows.map((z) => { const x = cx(z); if (prev) len += Math.hypot(x - prev[0], z - prev[1]); prev = [x, z]; return { x, z, h: half(z), v: len }; });
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1];
        const q = [[a.x - a.h, a.z, 0, a.v], [a.x + a.h, a.z, 1, a.v], [b.x + b.h, b.z, 1, b.v], [b.x - b.h, b.z, 0, b.v]];
        for (const j of [0, 2, 1, 0, 3, 2]) { pos.push(q[j][0], 0, q[j][1]); uv.push((q[j][2] * 90 * K) / U.WATER_TILE[0], (-q[j][3] * K) / U.WATER_TILE[1]); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      return g;
    };
    const creek = new THREE.Mesh(ribbon(), M.creek); creek.position.y = D.lakeBed + 0.3; gForest.add(creek);
    const crown = new THREE.IcosahedronGeometry(1, 0); crown.scale(6, 7.5, 6); crown.translate(0, D.treeH - 7, 0);
    const trunk = new THREE.CylinderGeometry(0.9, 0.9, D.treeH - 9, 5, 1, true).translate(0, (D.treeH - 9) / 2, 0);
    const treeG = U.concat(THREE, [{ geo: crown, color: new THREE.Color(0x9fb49a) }, { geo: trunk.toNonIndexed(), color: new THREE.Color(0x7d8a78) }]);
    treeG.computeVertexNormals();
    // 保護区の木道・観察塔・研究所の場所(木を植えない)
    const walk = [[-560, -120], [-330, -300], [-80, -330], [140, -260], [360, -220], [560, -130]];
    const segD = (x, z, [ax, az], [bx, bz]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
    const clearOfReserve = (x, z) => walk.every((p, i) => i === 0 || segD(x, z, walk[i - 1], p) > 11) && Math.hypot(x + 660, z + 150) > 35;
    const spots = [];
    for (let n = 0; spots.length < 520 && n < 6000; n++) {
      const x = D.x0 + 20 + rnd() * (D.x1 - D.x0 - 40), z = D.z0 + 15 + rnd() * (-110 - D.z0 - 15);
      if (Math.abs(x - cx(z)) < half(z) + 12) continue;
      if (Math.abs(x - LOCK.x) < 30 || !clearOfReserve(x, z)) continue;
      spots.push([x, z, 0.75 + rnd() * 0.5, rnd() * 6]);
    }
    const trees = new THREE.InstancedMesh(treeG, U.vcLambert(THREE), spots.length);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    spots.forEach(([x, z, s, r], i) => { mt.compose(V(x, D.lakeBed, z), q.setFromEuler(e.set(0, r, 0)), V(s, s, s)); trees.setMatrixAt(i, mt); });
    gForest.add(trees);

    // ── 再建: 貯水池の水面、浮体式の太陽光(パネルの列、浮きの枠、変換器の台、送電の浮きケーブル)、岸の新しい変電所 ──
    const pool = waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, -36], [D.x0, -36]], M.pool); pool.position.y = D.pool; gPool.add(pool);
    const PH = D.pool - D.lakeBed, PL = -36 - D.z0;
    gPool.add(new THREE.Mesh(U.merge(THREE, [cut(D.x1 - D.x0, PH, { y: (D.pool + D.lakeBed) / 2, z: D.z0 }), cut(PL, PH, { x: D.x0, y: (D.pool + D.lakeBed) / 2, z: (D.z0 - 36) / 2, ry: Math.PI / 2 }), cut(PL, PH, { x: D.x1, y: (D.pool + D.lakeBed) / 2, z: (D.z0 - 36) / 2, ry: Math.PI / 2 })]), M.waterCut));
    for (const [ax, az] of [[-560, -400], [-380, -400], [-200, -400], [140, -390], [320, -390], [500, -390], [-470, -250], [410, -250]]) {
      add(box(150, 0.8, 92), M.light, gPool, { x: ax, y: D.pool + 0.4, z: az });
      for (let r = 0; r < 14; r++) add(box(144, 0.5, 4.2), M.panel, gPool, { x: ax, y: D.pool + 1.3, z: az - 41 + r * 6.3, rx: -0.25, edges: false });
      add(box(10, 3, 8), M.body, gPool, { x: ax + 80, y: D.pool + 1.5, z: az });
      add(box(10.2, 0.6, 8.2), M.accent, gPool, { x: ax + 80, y: D.pool + 2.6, z: az, edges: false });
    }
    tube(gPool, V(-120, D.pool + 0.6, -250), V(-120, D.pool + 0.6, -60), 1.2, M.dark);
    tube(gPool, V(-120, D.pool + 0.6, -60), V(-120, D.crest + 1, -10), 1.2, M.dark);
    add(box(90, 0.6, 60), M.light, gPool, { x: 620, y: D.bank + 0.3, z: 160 });   // 新しい変電所(下流の右岸)
    for (let i = 0; i < 4; i++) { add(box(10, 7, 8), M.mid, gPool, { x: 590 + i * 20, y: D.bank + 4, z: 150 }); add(box(1.2, 14, 1.2), M.mid, gPool, { x: 590 + i * 20, y: D.bank + 7, z: 175 }); }
    add(box(84, 1.2, 1.2), M.mid, gPool, { x: 620, y: D.bank + 14, z: 175 });
    add(box(24, 8, 14), M.body, gPool, { x: 630, y: D.bank + 4, z: 120 });
    add(box(24.2, 0.8, 14.2), M.accent, gPool, { x: 630, y: D.bank + 7.6, z: 120, edges: false });

    // ── 保護区: 観察塔 2 基(格子、1.5 倍)、森の上の木道、研究所 ──
    for (const [x, z] of [[-330, -300], [360, -220]]) {
      lattice(gReserve, V(x, D.lakeBed, z), 34, 3.5, 2.2, 4, 0.35, M.mid);
      add(box(7, 4, 7), M.body, gReserve, { x, y: D.lakeBed + 36, z });
      add(box(8, 0.6, 8), M.accent, gReserve, { x, y: D.lakeBed + 38.3, z, edges: false });
    }
    for (let i = 0; i < walk.length - 1; i++) {
      const [xa, za] = walk[i], [xb, zb] = walk[i + 1], L = Math.hypot(xb - xa, zb - za);
      add(box(L, 0.6, 4), M.light, gReserve, { x: (xa + xb) / 2, y: D.lakeBed + 4, z: (za + zb) / 2, ry: -Math.atan2(zb - za, xb - xa) });
      for (let t = 0; t <= 1; t += 0.2) add(box(0.8, 3.6, 0.8), M.mid, gReserve, { x: xa + (xb - xa) * t, y: D.lakeBed + 1.8, z: za + (zb - za) * t, edges: false });
    }
    add(box(40, 9, 18), M.body, gReserve, { x: -660, y: D.lakeBed + 4.5, z: -150 });
    add(box(40.2, 1.6, 18.2), M.glass, gReserve, { x: -660, y: D.lakeBed + 6, z: -150, edges: false });
    add(box(40.4, 0.8, 18.4), M.accent, gReserve, { x: -660, y: D.lakeBed + 8.8, z: -150, edges: false });

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 状態 ──
    let state = opts.state ?? "ruin";
    function apply() {
      const ruined = state !== "rebuilt";
      gRuin.visible = ruined; gForest.visible = ruined; gIntact.visible = !ruined; gPool.visible = !ruined; gReserve.visible = state === "reserve";
    }
    function update(dt) {
      M.tail.map.offset.y -= dt * (state === "rebuilt" ? 0.12 : 0.22);
      M.breach.map.offset.y -= dt * 0.45; M.creek.map.offset.y -= dt * 0.15;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function check() {
      let near = Infinity; for (const [x, z] of spots) near = Math.min(near, Math.abs(x - cx(z)) - half(z));
      return { breachWidth_m: BR.x1 - BR.x0, head_m: D.pool - D.tail, trees: spots.length, treeToCreek_m: +near.toFixed(1), panelTopOverPool_m: 1.55 };
    }
    U.bake(THREE, group, { dynamic: [gRuin, gIntact, gForest, gPool, gReserve], live: [M.accent] });   // 全部が見えている状態で焼き、そのあと状態で切り替える
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      setTeam: (c) => F.setTeam(M, c), setState(s) { state = s; apply(); }, get state() { return state; },
      shots: {
        breach: { label: "決壊の跡", target: [-20, 5, 20], pos: [160, 110, 260] },
        hpp: { label: "発電所", target: [-345, 15, 10], pos: [-170, 90, 200] },
        forest: { label: "湖底の森", target: [0, 5, -280], pos: [260, 120, -40] },
        solar: { label: "浮体式太陽光", target: [-380, 25, -400], pos: [-200, 110, -210] },
      },
    };
  }

  DreamAssets.fac.register("kakhovka", {
    section: 2, title: "カホフカ・ダム", kind: "STRATEGIC FACILITY · 2 水門・閘門・防潮堤",
    desc: "ドニプロ川の水力発電所ダム。2023 年に決壊し、旧貯水池の底は柳の森になった。「新ダム再建 + 浮体式太陽光」と「湖底の森を保護区化」の分岐トークン",
    info: [["ファイル", "mockups/3d/facilities/kakhovka.js"], ["大きさ", "実寸 1600 × 1000 m を 0.11 倍 × 表示 3.0"], ["誇張", "ダムまわりの高さ 1.5 倍(水位差 24 m)、湖底の森の木の高さ 2 倍(約 18 m)"], ["省略", "車両・人・送電線・小さな機器"], ["状態", "決壊(現在)/ 新ダム再建 + 浮体式太陽光 / 湖底の森の保護区"]],
    dist: 1150, target: 30, tokenAt: [420, 0, 330],
    make: (THREE) => kakhovka(THREE, { r: 110 }),
    actLabel: "STATE · 状態(分岐)",
    actions: (a) => [["決壊(現在)", () => a.setState("ruin"), () => a.state === "ruin"], ["新ダム再建", () => a.setState("rebuilt"), () => a.state === "rebuilt"], ["湖底の森の保護区", () => a.setState("reserve"), () => a.state === "reserve"]],
  });
})();
