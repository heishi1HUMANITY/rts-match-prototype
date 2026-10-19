// 戦略施設トークン「パナマ運河(アグア・クララ新閘門)」の詳細版モデル(試作)。
// 3 段の閘室(各 427 × 55 m)が階段状に並び、各閘室の横に 3 段の節水槽(計 9 槽)が棚田のように並ぶ。扉は横へ転がって壁の中の扉室へ収まる引き戸式(各頭部に 2 枚)。
// 平面は実寸の比率(K = 0.11)。誇張: 高さ方向を 3 倍(水位・壁・扉・地面の段差。施設リストの「モデルの決め手」の階段状の閘室を読ませるため)。
// 動きは実物の閘門の 1 巡: 船を上げる(閘室に注水。まず低い節水槽から順に、残りを上の閘室から)→ 船を下ろす(排水は高い節水槽から順に)。扉は水位がそろってから開く。
// 近未来化(施設リストの案): 水位計の柱、ガトゥン湖への揚水ポンプ場と送水管。渇水の状態トークン(湖の水位が下がり、最上段の閘室が湖の水位までしか上がらず、通航の間隔が延びる)。
// 省略: 船・タグボート・人・車両。
//
// 状態: "normal"(通常)/ "drought"(渇水)。どちらでも閘門は 1 巡を繰り返す
// 水路は z 方向、-z がカリブ海側(低い)、+z がガトゥン湖(高い)。東(+x)に節水槽、西(-x)に扉室。
(function () {
  const K = 0.11, VZ = 3;
  const W = 55, HW = W / 2, DEPTH = 18.3, LAKE = 26, DROUGHT = 23;
  const LOW = [0, 26 / 3, 52 / 3], HIGH = [26 / 3, 52 / 3, 26], STEP = 26 / 3;
  const ZH = [130, 617, 1104, 1591];                 // 頭部(扉 2 枚)の中心の z
  const GATE = { len: 57.6, t: 10, sep: 11, niche: 66, closedX: -1.3, shift: -59.6 };
  const BW = 72, B0 = 47.5;                           // 節水槽の帯の幅と始まり
  const D = { base: -21, x0: -130, x1: 310, z0: 0, z1: 1721, app: 60, lowGround: 5, highGround: 31 };
  const T = [HIGH[0] + 3, HIGH[1] + 3, HIGH[2] + 3, D.highGround];   // 閘室・頭部の地面の高さ
  const floorOf = (h) => (h < 3 ? LOW[h] : LAKE) - DEPTH;              // 頭部 h と閘室 h の床
  const SEG = [
    { k: "app", z0: 0, z1: 100, top: D.lowGround, floor: -DEPTH, half: D.app },
    ...[0, 1, 2].flatMap((i) => [
      { k: "head", h: i, z0: ZH[i] - 30, z1: ZH[i] + 30, top: T[i], floor: floorOf(i), half: HW },
      { k: "ch", i, z0: ZH[i] + 30, z1: ZH[i + 1] - 30, top: T[i], floor: floorOf(i), half: HW },
    ]),
    { k: "head", h: 3, z0: ZH[3] - 30, z1: ZH[3] + 30, top: T[3], floor: floorOf(3), half: HW },
    { k: "app", z0: ZH[3] + 30, z1: D.z1, top: D.highGround, floor: floorOf(3), half: D.app },
  ];
  const GATE_OP = 4, FILL = 5;

  function panama(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const { add, box, cyl, V, prism, tube } = F.kit(THREE, M, K);
    M.w = U.waterMaterial(THREE); M.w.side = THREE.DoubleSide;
    M.cutHigh = M.waterCut.clone();
    const group = new THREE.Group(); group.name = "panama";
    const XC = (D.x0 + D.x1) / 2, ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.set(K, K * VZ, K); world.position.set(-XC * K, -D.base * K * VZ, -ZC * K); group.add(world);
    const flat = new THREE.Group(); flat.scale.setScalar(K); flat.position.copy(world.position); group.add(flat);   // 建物・管など高さを誇張しない部品(地面の高さだけ 3 倍の座標に合わせる)
    const R = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const waterMesh = (polys) => {
      const g = new THREE.ShapeGeometry(polys.map((p) => new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z))))); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) * K) / U.WATER_TILE[0], (-p.getZ(i) * K) / U.WATER_TILE[1]);
      const m = new THREE.Mesh(g, M.w); world.add(m); return m;
    };
    const gz = (h) => [ZH[h] - GATE.sep, ZH[h] + GATE.sep];
    const nicheR = (z) => R(-HW - GATE.niche, z - GATE.t / 2 - 1, -HW, z + GATE.t / 2 + 1);
    // 節水槽 j(0 = 閘室に近い・低い)の水位: 空 = 閘室の下の水位 + 段差 × (j+1)/4、満 = (j+2)/4。床は空の水位の 1.5 m 下
    const basinLv = (i, j, full) => LOW[i] + (STEP * (j + 1 + full)) / 4;
    const basinTop = (i, j) => basinLv(i, j, 1) + 2.5;
    const basinRect = (i, j) => { const s = SEG.find((g) => g.k === "ch" && g.i === i); return R(B0 + j * BW + 6, s.z0 + 20, B0 + (j + 1) * BW - 6, s.z1 - 20); };

    // ── 地面: 区間ごとに段になった陸。西は扉室の切り欠き、東は閘室の壁・節水槽の 3 段の棚・送水管の帯 ──
    for (const s of SEG) {
      const notches = s.k === "head" ? gz(s.h).map((z) => [z - GATE.t / 2 - 1, z + GATE.t / 2 + 1]) : [];
      const west = [[D.x0, s.z0], [-s.half, s.z0]];
      for (const [a, b] of notches) west.push([-s.half, a], [-s.half - GATE.niche, a], [-s.half - GATE.niche, b], [-s.half, b]);
      west.push([-s.half, s.z1], [D.x0, s.z1]);
      add(prism(west, D.base, s.top), M.land, world);
      if (s.k === "ch") {
        add(prism(R(s.half, s.z0, B0, s.z1), D.base, s.top), M.land, world);
        for (let j = 0; j < 3; j++) add(prism(R(B0 + j * BW, s.z0, B0 + (j + 1) * BW, s.z1), D.base, basinTop(s.i, j), [basinRect(s.i, j)]), M.land, world);
        add(prism(R(B0 + 3 * BW, s.z0, D.x1, s.z1), D.base, s.top), M.land, world);
        for (let j = 0; j < 3; j++) { const [[xa, za], , [xb, zb]] = basinRect(s.i, j), fl = basinLv(s.i, j, 0) - 1.5; add(box(xb - xa, fl - D.base, zb - za), M.mid, world, { x: (xa + xb) / 2, y: (D.base + fl) / 2, z: (za + zb) / 2, edges: false }); }
      } else add(prism(R(s.half, s.z0, D.x1, s.z1), D.base, s.top), M.land, world);
      // 水路の床と扉室の床
      add(box(2 * s.half, s.floor - D.base, s.z1 - s.z0), M.light, world, { y: (D.base + s.floor) / 2, z: (s.z0 + s.z1) / 2, edges: false });
      for (const [a, b] of notches) add(box(GATE.niche, s.floor - D.base, b - a), M.mid, world, { x: -s.half - GATE.niche / 2, y: (D.base + s.floor) / 2, z: (a + b) / 2, edges: false });
    }
    F.plinth({ add, box }, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1, { x: XC, z: ZC, h: 0.8 });
    // 閘室の壁の細部: 床の高さの注排水口の列、壁の上の弁室(節水槽ごと)と配管の溝
    for (let i = 0; i < 3; i++) {
      const s = SEG.find((g) => g.k === "ch" && g.i === i);
      for (let z = s.z0 + 15; z < s.z1 - 10; z += 24) for (const x of [-HW + 0.2, HW - 0.2]) add(box(0.4, 2.4, 6), M.dark, world, { x, y: s.floor + 2, z, edges: false });
      for (let j = 0; j < 3; j++) {
        const [[xa, za], , [xb, zb]] = basinRect(i, j), zm = (za + zb) / 2;
        add(box(12, 3, 18), M.body, flat, { x: HW + 10, y: s.top * VZ + 1.5, z: zm - 120 + j * 120 });
        add(box(12.2, 0.6, 18.2), M.dark, flat, { x: HW + 10, y: s.top * VZ + 2.4, z: zm - 120 + j * 120, edges: false });
        add(box(6, 0.15, 8), M.dark, world, { x: xa - 3, y: basinTop(i, j) + 0.08, z: zm, edges: false });   // 節水槽の取水口
      }
      for (const x of [-HW - 1, HW + 1]) {   // 壁の上の手すりと照明柱
        add(box(0.3, 1.1, s.z1 - s.z0 - 4), M.dark, flat, { x, y: s.top * VZ + 0.55, z: (s.z0 + s.z1) / 2, edges: false });
        for (let z = s.z0 + 30; z < s.z1 - 20; z += 70) { add(cyl(0.35, 16, 6), M.mid, flat, { x: x + Math.sign(x) * 2, y: s.top * VZ + 8, z }); add(box(1.2, 0.5, 3), M.dark, flat, { x: x + Math.sign(x) * 1, y: s.top * VZ + 16, z, edges: false }); }
      }
      // 水位計(近未来化): 西の壁から閘室の上へ腕を出す
      const zm = (s.z0 + s.z1) / 2;
      add(cyl(0.6, 6, 8), M.mid, flat, { x: -HW - 6, y: s.top * VZ + 3, z: zm });
      add(box(10, 0.6, 0.8), M.mid, flat, { x: -HW - 1.5, y: s.top * VZ + 5.8, z: zm });
      add(box(1.6, 0.8, 1.6), M.dark, flat, { x: -HW + 2.5, y: s.top * VZ + 5.2, z: zm });
    }
    // 頭部の天端(扉室の上を渡る通路)と管制塔
    for (let h = 0; h < 4; h++) {
      const top = SEG.find((g) => g.k === "head" && g.h === h).top;
      add(box(16, 5, 34), M.body, flat, { x: HW + 14, y: top * VZ + 2.5, z: ZH[h] });
      add(box(16.2, 1.0, 34.2), M.glass, flat, { x: HW + 14, y: top * VZ + 3.4, z: ZH[h], edges: false });
    }
    add(box(36, 14, 56), M.body, flat, { x: -105, y: T[1] * VZ + 7, z: 840 });
    for (const y of [T[1] * VZ + 4, T[1] * VZ + 9]) add(box(36.2, 1.6, 56.2), M.glass, flat, { x: -105, y, z: 840, edges: false });
    add(box(36.4, 0.8, 56.4), M.accent, flat, { x: -105, y: T[1] * VZ + 13.4, z: 840, edges: false });
    add(box(10, 14, 10), M.light, flat, { x: -112, y: T[1] * VZ + 21, z: 820 });
    add(box(12, 3, 12), M.glass, flat, { x: -112, y: T[1] * VZ + 29.5, z: 820 });

    // ── 近未来化: 渇水対策の揚水ポンプ場と送水管(下の水路から湖へ。地面の段に沿って上る)、湖の水位標 ──
    const PX = 286;
    const pts = []; for (const s of SEG) { pts.push(V(PX, s.top + 3, s.z0 + 2), V(PX, s.top + 3, s.z1 - 2)); }
    const flatP = (p, dx) => V(p.x + dx, p.y * VZ, p.z);
    for (const dx of [-5, 5]) for (let k = 0; k < pts.length - 1; k++) tube(flat, flatP(pts[k], dx), flatP(pts[k + 1], dx), 2.2, M.steel);
    for (let k = 0; k < pts.length; k += 1) add(box(16, 2.6, 3), M.mid, flat, { x: PX, y: pts[k].y * VZ - 1.6, z: pts[k].z });   // 管の台
    add(box(40, 12, 36), M.body, flat, { x: 250, y: D.lowGround * VZ + 6, z: 40 });   // 取水ポンプ場(下の水路の岸)
    add(box(40.4, 0.8, 36.4), M.accent, flat, { x: 250, y: D.lowGround * VZ + 10.5, z: 40, edges: false });
    for (const x of [236, 250, 264]) add(cyl(2.4, 4, 12), M.mid, flat, { x, y: D.lowGround * VZ + 14, z: 40 });
    add(box(30, 9, 30), M.body, flat, { x: 280, y: D.highGround * VZ + 4.5, z: 1690 });   // 湖側の吐出し槽
    add(box(30.4, 0.8, 30.4), M.accent, flat, { x: 280, y: D.highGround * VZ + 8, z: 1690, edges: false });
    for (let k = 0; k < 9; k++) add(box(1.2, 1, 3), k % 2 ? M.dark : M.body, world, { x: -D.app + 0.6, y: LAKE - 8 + k + 0.5, z: 1660, edges: false });   // 湖の水位標(目盛り)
    for (const x of [-D.app + 0.15, D.app - 0.15]) add(box(0.3, LAKE - DROUGHT, D.z1 - ZH[3] - 30), M.mid, world, { x, y: (LAKE + DROUGHT) / 2 - 0.05, z: (ZH[3] + 30 + D.z1) / 2, edges: false });   // 渇水で現れる壁の水跡

    // ── 扉: 頭部ごとに 2 枚(同時に動く)。鋼の箱に横桁、端の柱、天端の台車 ──
    const heads = [];
    for (let h = 0; h < 4; h++) {
      const g = new THREE.Group(); g.position.x = GATE.closedX; world.add(g);
      const sill = floorOf(h), top = (h < 3 ? HIGH[h] : LAKE) + 1, H = top - sill;
      for (const z of gz(h)) {
        add(box(GATE.len, H, GATE.t), M.light, g, { y: (sill + top) / 2, z });
        for (const f of [0.2, 0.45, 0.7, 0.9]) for (const s of [-1, 1]) add(box(GATE.len - 2, 0.9, 0.6), M.mid, g, { y: sill + H * f, z: z + s * (GATE.t / 2 + 0.3), edges: false });
        for (const x of [-GATE.len / 2 + 0.8, GATE.len / 2 - 0.8]) add(box(1.6, H, GATE.t + 0.8), M.mid, g, { x, y: (sill + top) / 2, z });
        add(box(8, 3, GATE.t + 1), M.body, g, { x: -GATE.len / 2 + 5, y: top + 1.5, z });   // 台車
        add(box(GATE.len - 10, 0.4, GATE.t - 3), M.dark, g, { x: 4, y: top + 0.2, z, edges: false });
      }
      heads.push(g);
    }

    // ── 水面: 下の水路、閘室 3 つ、上の水路(湖)、節水槽 9 ──
    const lowW = waterMesh([R(-D.app, 0, D.app, gz(0)[0] - 5), nicheR(gz(0)[0])]);
    const chW = [0, 1, 2].map((i) => waterMesh([R(-HW, gz(i)[0] + 5, HW, gz(i + 1)[0] - 5), nicheR(gz(i)[1]), nicheR(gz(i + 1)[0])]));
    const lakeW = waterMesh([R(-HW, gz(3)[0] + 5, HW, ZH[3] + 30), R(-D.app, ZH[3] + 30, D.app, D.z1), nicheR(gz(3)[1])]);
    const basinW = [0, 1, 2].map((i) => [0, 1, 2].map((j) => waterMesh([basinRect(i, j)])));
    world.add(new THREE.Mesh(new THREE.PlaneGeometry(2 * D.app, DEPTH).translate(0, -DEPTH / 2, 0.01), M.waterCut));
    const cutHigh = new THREE.Mesh(new THREE.PlaneGeometry(2 * D.app, 1).translate(0, 0.5, D.z1), M.cutHigh); world.add(cutHigh);

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 110, M.ring, M.disc);

    // ── 1 巡の段階: 上り(扉 0 → 閘室 0 に注水 → 扉 1 → … → 扉 3)、下り(扉 3 → 閘室 2 を排水 → … → 扉 0)、待ち ──
    const PLAN = [];
    for (let h = 0; h < 4; h++) { PLAN.push({ dur: GATE_OP, gate: h }); if (h < 3) PLAN.push({ dur: FILL, ch: h, to: 1 }); }
    for (let h = 3; h >= 0; h--) { PLAN.push({ dur: GATE_OP, gate: h }); if (h > 0) PLAN.push({ dur: FILL, ch: h - 1, to: 0 }); }
    const ease = (x) => x * x * (3 - 2 * x), clamp = (x) => Math.min(1, Math.max(0, x));
    const idle = (dry) => (dry ? 24 : 4);   // 渇水では通航の間隔が延びる
    function at(tau, dry) {
      const total = PLAN.reduce((a, p) => a + p.dur, 0) + idle(dry);
      let s = ((tau % total) + total) % total;
      const f = [0, 0, 0], g = [0, 0, 0, 0]; let what = { idle: true };
      for (const p of PLAN) {
        const q = Math.min(1, s / p.dur);
        if (p.ch !== undefined) { f[p.ch] = p.to ? ease(q) : 1 - ease(q); if (s < p.dur) what = p; }
        else if (s < p.dur) { g[p.gate] = q < 0.375 ? ease(q / 0.375) : q < 0.625 ? 1 : 1 - ease((q - 0.625) / 0.375); what = p; }
        if (s < p.dur) return { f, g, what };
        s -= p.dur;
      }
      return { f, g, what };
    }
    let state = opts.state ?? "normal", tau = 0, lake = state === "drought" ? DROUGHT : LAKE, cur = at(0, false);
    const chLevel = (i, f) => LOW[i] + ((i < 2 ? HIGH[i] : lake) - LOW[i]) * f;
    function apply() {
      cur = at(tau, state === "drought");
      heads.forEach((g, h) => (g.position.x = GATE.closedX + GATE.shift * cur.g[h]));
      chW.forEach((m, i) => (m.position.y = chLevel(i, cur.f[i])));
      basinW.forEach((row, i) => row.forEach((m, j) => (m.position.y = basinLv(i, j, 1 - clamp((cur.f[i] - j / 4) * 4)))));
      lakeW.position.y = lake;
      cutHigh.position.y = floorOf(3); cutHigh.scale.y = lake - floorOf(3);
    }
    function update(dt) {
      tau += dt;
      const target = state === "drought" ? DROUGHT : LAKE;
      lake += Math.sign(target - lake) * Math.min(Math.abs(target - lake), dt * 0.5);   // 湖の水位はゆっくり変わる
      apply();
      M.w.map.offset.y -= dt * 0.02;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) { if (s === "normal" || s === "drought") state = s; }
    function stage() {
      const w = cur.what;
      if (w.gate !== undefined) return `第 ${w.gate + 1} 頭部の扉を開閉`;
      if (w.ch !== undefined) return `第 ${w.ch + 1} 閘室を${w.to ? "注水(節水槽の低い方から)" : "排水(節水槽の高い方から)"}`;
      return state === "drought" ? "渇水 — 通航の間隔を延ばして待機" : "次の船を待つ";
    }
    function check() {
      // 1 巡を細かく回し、扉が開いている間の両側の水位差・水面と壁の天端・節水槽の水面と床を測る(通常・渇水)
      let diff = 0, wall = Infinity, basinFloor = Infinity, basinWall = Infinity;
      for (const dry of [false, true]) {
        const lk = dry ? DROUGHT : LAKE, lvl = (i, f) => LOW[i] + ((i < 2 ? HIGH[i] : lk) - LOW[i]) * f;
        for (let tt = 0; tt < 120; tt += 0.1) {
          const c = at(tt, dry);
          for (let h = 0; h < 4; h++) if (c.g[h] > 0.001) {
            const down = h === 0 ? 0 : lvl(h - 1, c.f[h - 1]), up = h === 3 ? lk : lvl(h, c.f[h]);
            diff = Math.max(diff, Math.abs(up - down));
          }
          for (let i = 0; i < 3; i++) {
            wall = Math.min(wall, T[i] - lvl(i, c.f[i]));
            for (let j = 0; j < 3; j++) { const b = basinLv(i, j, 1 - clamp((c.f[i] - j / 4) * 4)); basinFloor = Math.min(basinFloor, b - (basinLv(i, j, 0) - 1.5)); basinWall = Math.min(basinWall, basinTop(i, j) - b); }
          }
        }
      }
      const r1 = (v) => +v.toFixed(2);
      const open = [GATE.closedX + GATE.shift - GATE.len / 2, GATE.closedX + GATE.shift + GATE.len / 2];
      return {
        levelDiffWhenGateOpen_m: r1(diff),                                            // 扉が開いている間の両側の水位差(0 = そろえてから開く)
        chamberFreeboard_m: r1(wall), basinOverFloor_m: r1(basinFloor), basinFreeboard_m: r1(basinWall),
        gateOpenInNiche_m: [r1(open[0] - (-HW - GATE.niche)), r1(-HW - open[1])],     // 開いた扉と扉室の奥・口の隙間
        gateClosedSeal_m: r1(GATE.closedX + GATE.len / 2 - HW),                        // 閉じた扉の東端と壁(0 = 戸当たりに接する)
        nicheSideGap_m: 1, lift_m: LAKE, droughtLake_m: DROUGHT, verticalExaggeration: VZ,
      };
    }
    apply();
    U.bake(THREE, group, { dynamic: heads, live: [M.accent] });
    const toModel = (x, y, z) => V((x - XC) * K, (y - D.base) * K * VZ, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at: toModel,
      get state() { return state; }, get stage() { return stage(); },
      shots: {
        steps: { label: "階段の閘室(下流から)", target: [40, 10, 700], pos: [-260, 120, -150] },
        basins: { label: "節水槽の棚", target: [140, 10, 900], pos: [380, 80, 620] },
        gate: { label: "扉と扉室", target: [-40, 10, 617], pos: [-180, 70, 480] },
        pump: { label: "送水管とポンプ場", target: [270, 20, 120], pos: [380, 60, -60] },
        lake: { label: "湖側(水位標・水跡)", target: [-30, 22, 1660], pos: [110, 75, 1840] },
      },
    };
  }

  DreamAssets.fac.register("panama", {
    section: 2, title: "パナマ運河(アグア・クララ新閘門)", kind: "STRATEGIC FACILITY · 2 水門・閘門・防潮堤",
    desc: "大西洋側の新閘門。3 段の閘室が階段状に並び、横の 3 段の節水槽が閘室の水を受け渡して淡水を節約する。揚水ポンプ場と送水管、水位計を足した近未来版。渇水で湖の水位が下がり通航の間隔が延びる状態トークン",
    info: [["ファイル", "mockups/3d/facilities/panama.js"], ["大きさ", "実寸 440 × 1720 m を 0.11 倍 × 表示 3.0"], ["誇張", "高さ方向 3 倍(水位・壁・扉・段差)。平面は実寸"], ["省略", "船・タグボート・人・車両"], ["動作", "上り・下りの 1 巡(扉の開閉、節水槽を使った注排水)を繰り返す"], ["近未来化", "揚水ポンプ場と送水管、水位計、渇水の状態(湖 -3 m)"]],
    dist: 1100, target: 30, tokenAt: [260, 0, -280],
    make: (THREE) => panama(THREE, { r: 110 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["通常", () => a.setState("normal"), () => a.state === "normal"], ["渇水", () => a.setState("drought"), () => a.state === "drought"]],
    caption: (a) => a.stage,
  });
})();
