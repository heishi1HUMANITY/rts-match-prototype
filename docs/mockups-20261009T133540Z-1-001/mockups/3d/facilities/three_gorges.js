// 戦略施設トークン「三峡ダム」(中国・長江)の詳細版モデル(試作)。
// 平面は実寸の比率(3000 × 2000 m を K 倍)。全長 2.3 km の重力式の堤体(中央の洪水吐き、左右の発電所と水圧管)、左岸の昇船機、
// 左岸の山を切り込んだ 5 段 2 列の閘門(上流の貯水池から下流まで水位差 110 m を 5 段で下る)。
// 誇張(モデルの決め手 = 長大なダム堤体と 5 段の閘門): 閘室の幅 1.5 倍(34 → 50 m)、閘門の山を段ごとに下げて階段に見せる。高さは実寸(堤体 145 m を K 倍)。
// 省略: 船・車両・人・送電線・小さな機器。
// 近未来化(施設リストの案 = 発電・水運・洪水制御を一手に握る多機能トークン): 3 つの機能の中枢(発電所の屋上・昇船機の機械室・右岸の統合管制センター)をチーム色の帯でそろえた。
// 状態: "normal"(発電・通航: 昇船機が上下し、放水路が流れる)/ "flood"(洪水放流: 洪水吐きのゲートが上がり、水が流れ落ちる)。
// 水路は z 方向、+z が下流。下流の水位 0、貯水池 +110。
(function () {
  const K = 0.06;
  const D = { x0: -1600, x1: 1400, z0: -750, z1: 1250, base: -25, bed: -20, pool: 110, poolBed: 20, crest: 120, step: 22 };
  const LOCK = { a: [-1490, -1440], isle: [-1440, -1380], b: [-1380, -1330], heads: [-220, 65, 350, 635, 920, 1205] };
  const LIFT = { x0: -1270, x1: -1160, z0: -20, z1: 120, ch: [-1238, -1192], len: 132, low: -4, high: 106, sec: 10, wait: 3 };
  const SP = { x0: -250, x1: 240, n: 22 };
  const XC = -100, ZC = 250;

  function threeGorges(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 110;
    const M = F.mats(THREE);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, prism, waterShape, tube, beam } = k;
    M.pool = k.water(); M.river = k.water(); M.lock = k.water(); M.liftW = k.water(); M.spill = k.water({ opacity: 0.7 });
    const group = new THREE.Group(); group.name = "three_gorges";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, -ZC * K); group.add(world);
    const extX = (zy, x0, x1) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape(zy.map(([z, y]) => new THREE.Vector2(-z, y))), { depth: x1 - x0, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(x0, 0, 0); return g; };
    const slab = (x0, x1, z0, z1, y0, y1, mat, parent = world, o = {}) => add(box(x1 - x0, y1 - y0, z1 - z0), mat, parent, { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, ...o });
    // 水平な水面の板をまとめる(uv は x, z から。共通の水面と同じ線の大きさ)
    const flatWater = (rects, mat) => {
      const g = U.merge(THREE, rects.map(([x0, x1, z0, z1, y]) => [new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), { x: (x0 + x1) / 2, y, z: (z0 + z1) / 2 }]));
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) * K) / U.WATER_TILE[0], (-p.getZ(i) * K) / U.WATER_TILE[1]);
      return new THREE.Mesh(g, mat);
    };

    // ── 台座: 貯水池の底、下流の川底、右岸の山、足元の帯 ──
    slab(-1490, 1150, D.z0, 0, D.base, D.poolBed, M.mid, world, { edges: false });
    slab(-1490, 1150, 0, D.z1, D.base, D.bed, M.light, world, { edges: false });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.001, { x: XC, z: ZC });
    add(prism([[1150, D.z0], [D.x1, D.z0], [D.x1, D.z1], [1150, D.z1], [1150, 400], [1170, 300], [1170, 120], [1150, 120]], D.base, 150), M.land, world);
    slab(1150, D.x1, 400, D.z1, D.base, 90, M.land);

    // ── 左岸の山と 5 段 2 列の閘門(山を切り込んだ閘室。段ごとに山の上面も下げる) ──
    const H = LOCK.heads, top = (i) => 160 - 26 * (i + 1), lvl = (i) => D.pool - D.step * (i + 1), floor = (i) => lvl(i) - 8;
    const segs = [[D.z0, H[0], 165], ...H.slice(0, 5).map((z, i) => [z, H[i + 1], top(i)]), [H[5], D.z1, 20]];
    for (const [za, zb, t] of segs) {
      slab(D.x0, LOCK.a[0], za, zb, D.base, t, M.land);
      slab(LOCK.b[1], LIFT.x0, za, zb, D.base, t, M.land);
      slab(LOCK.isle[0], LOCK.isle[1], za, zb, D.base, t - 14, M.light);
    }
    for (let i = 0; i < 5; i++) for (const ln of [LOCK.a, LOCK.b]) slab(ln[0], ln[1], H[i], H[i + 1], D.base, floor(i), M.mid, world, { edges: false });
    for (const ln of [LOCK.a, LOCK.b]) { slab(ln[0], ln[1], D.z0, H[0], D.base, D.poolBed, M.mid, world, { edges: false }); slab(ln[0], ln[1], H[5], D.z1, D.base, D.bed, M.mid, world, { edges: false }); }
    // 閘首: 合掌式の扉(上流へ向けた V)、壁の上の巻上げ室
    for (let h = 0; h < 6; h++) {
      const z = H[h], upper = h === 0 ? D.pool : lvl(h - 1), fl = h === 5 ? D.bed : floor(h), ht = upper + 4 - fl;
      for (const ln of [LOCK.a, LOCK.b]) {
        const cx = (ln[0] + ln[1]) / 2, w = ln[1] - ln[0];
        for (const s of [-1, 1]) add(box(w / 2 / Math.cos(0.33) + 1, ht, 3), M.mid, world, { x: cx + (s * w) / 4, y: fl + ht / 2, z: z - 4, ry: s * 0.33 });
        for (const s of [-1, 1]) slab(cx + s * (w / 2 + 2) - 8, cx + s * (w / 2 + 2) + 8, z - 10, z + 10, top(Math.max(0, h - 1)) - 1, top(Math.max(0, h - 1)) + 9, M.body, world);
      }
    }
    // 閘室の水: 南の列は各段の下の水位、北の列は上の水位(上下の船の入れ替えの途中)
    const lockRects = [];
    for (let i = 0; i < 5; i++) { lockRects.push([...LOCK.a, H[i] + 4, H[i + 1] - 4, lvl(i)]); lockRects.push([...LOCK.b, H[i] + 4, H[i + 1] - 4, lvl(i) + D.step]); }
    for (const ln of [LOCK.a, LOCK.b]) lockRects.push([...ln, H[5], D.z1, 0]);
    world.add(flatWater(lockRects, M.lock));

    // ── 昇船機: 両側の塔(縦の溝)、上の機械室(チーム色の帯)、上下の閘首、上下する船の箱(中に水) ──
    const [C0, C1] = LIFT.ch;
    for (const [xa, xb] of [[LIFT.x0, C0], [C1, LIFT.x1]]) {
      slab(xa, xb, LIFT.z0, LIFT.z1, D.base, 136, M.body);
      for (let j = 0; j < 5; j++) slab(xa - 0.4, xb + 0.4, LIFT.z0 + 12 + j * 26, LIFT.z0 + 16 + j * 26, 4, 130, M.mid, world, { edges: false });
    }
    slab(LIFT.x0 - 2, LIFT.x1 + 2, LIFT.z0 - 4, LIFT.z1 + 4, 136, 152, M.light);
    slab(LIFT.x0 - 2.3, LIFT.x1 + 2.3, LIFT.z0 - 4.3, LIFT.z1 + 4.3, 140, 143, M.glass, world, { edges: false });
    slab(LIFT.x0 - 2.5, LIFT.x1 + 2.5, LIFT.z0 - 4.5, LIFT.z1 + 4.5, 150, 151.5, M.accent, world, { edges: false });
    slab(C0, C1, LIFT.z0 - 40, LIFT.z1 + 20, D.base, -10, M.mid, world, { edges: false });
    slab(LIFT.x1, -1150, -30, 118, D.base, D.crest, M.light);   // 昇船機とダムの間の壁
    slab(C0 - 4, C1 + 4, -32, -26, 96, D.crest, M.light); slab(C0, C1, -31, -27, 112, D.pool + 4, M.mid);   // 上の閘首(貯水池側の扉)
    slab(C0 - 4, C1 + 4, 128, 134, -10, 30, M.light);
    const car = new THREE.Group(); world.add(car);
    const CL = LIFT.len, CW = C1 - C0 - 8, CZ = (LIFT.z0 + LIFT.z1) / 2;
    slab(-CW / 2, CW / 2, -CL / 2, CL / 2, 0, 3, M.mid, car);
    for (const s of [-1, 1]) slab(s * CW / 2 - 1.5, s * CW / 2 + 1.5, -CL / 2, CL / 2, 0, 10, M.light, car);
    for (const s of [-1, 1]) slab(-CW / 2, CW / 2, s * CL / 2 - 1.5, s * CL / 2 + 1.5, 0, 10, M.mid, car);
    for (let j = 0; j < 6; j++) slab(-CW / 2 - 1.8, CW / 2 + 1.8, -CL / 2 + 10 + j * 22, -CL / 2 + 13 + j * 22, 0, 11, M.light, car, { edges: false });
    const carW = flatWater([[-CW / 2 + 1.5, CW / 2 - 1.5, -CL / 2 + 1.5, CL / 2 - 1.5, 7]], M.liftW); car.add(carW);
    car.position.set((C0 + C1) / 2, LIFT.low, CZ);
    const liftW = flatWater([[C0, C1, LIFT.z0 - 30, LIFT.z0 - 2, D.pool]], M.pool); world.add(liftW);

    // ── 堤体: 左の非越流部、左の発電所部、中央の洪水吐き、右の発電所部、右の非越流部 ──
    const DAM = [[0, D.base], [118, D.base], [15, D.crest], [0, D.crest]];
    for (const [xa, xb] of [[-1150, SP.x0], [SP.x1, 1150]]) add(extX(DAM, xa, xb), M.light, world);
    slab(-1150, 1150, 0, 15, D.crest, D.crest + 1, M.mid, world, { edges: false });   // 天端の道路
    slab(-1150, 1150, 14, 15.5, D.crest + 1, D.crest + 2.4, M.body, world, { edges: false });
    // 洪水吐き: 越流の曲面、門柱と導流壁、表面のゲート、天端の道路橋、下流の静水池
    const SPILL = [[0, D.base], [140, D.base], [140, -12], [110, -12], [40, 70], [22, 96], [10, 100], [0, 100]];
    add(extX(SPILL, SP.x0, SP.x1), M.light, world);
    const BW = (SP.x1 - SP.x0) / SP.n, gates = new THREE.Group(); world.add(gates);
    const chute = [];
    for (let i = 0; i <= SP.n; i++) {
      const x = SP.x0 + i * BW;
      slab(x - 3, x + 3, -4, 34, 96, D.crest + 3, M.body);
      beam(world, V(x, 72, 34), V(x, -6, 112), 6, M.body);
    }
    for (let i = 0; i < SP.n; i++) {
      const xm = SP.x0 + (i + 0.5) * BW;
      slab(xm - BW / 2 + 3.4, xm + BW / 2 - 3.4, 11, 13.5, 100, 113, M.mid, gates);
      for (const y of [104, 109]) slab(xm - BW / 2 + 3.4, xm + BW / 2 - 3.4, 13.5, 14.3, y, y + 0.8, M.dark, gates, { edges: false });
      slab(xm - 5, xm + 5, 60, 64, 40, 46, M.dark, world, { rx: -0.6, edges: false });   // 深い放流孔の出口
      chute.push([xm, BW - 7]);
    }
    slab(SP.x0, SP.x1, -6, 10, D.crest, D.crest + 3, M.light);
    slab(SP.x0, SP.x1, 140, 260, D.bed, -14, M.mid, world, { edges: false });
    slab(SP.x0, SP.x1, 255, 262, -14, -4, M.light);
    for (const x of [SP.x0 - 6, SP.x1 + 6]) slab(x - 4, x + 4, 110, 420, D.bed, 12, M.light);   // 洪水吐きと放水路を分ける導流壁
    // 洪水の水(越流面を流れ落ちる帯。洪水放流のときだけ見せる)
    const prof = [[10, 101], [22, 97], [40, 71], [110, -11], [140, -11]];
    const flood = new THREE.Group(); world.add(flood);
    const pos = [], uv = [];
    for (const [x, w] of chute) {
      let L = 0;
      for (let j = 0; j < prof.length - 1; j++) {
        const [za, ya] = prof[j], [zb, yb] = prof[j + 1], l = Math.hypot(zb - za, yb - ya);
        const q = [[x - w / 2, ya + 1, za, 0, L], [x + w / 2, ya + 1, za, 1, L], [x + w / 2, yb + 1, zb, 1, L + l], [x - w / 2, yb + 1, zb, 0, L + l]];
        for (const n of [0, 2, 1, 0, 3, 2]) { pos.push(q[n][0], q[n][1], q[n][2]); uv.push((q[n][3] * w * K) / U.WATER_TILE[0], (-q[n][4] * K) / U.WATER_TILE[1]); }
        L += l;
      }
    }
    const chuteG = new THREE.BufferGeometry(); chuteG.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); chuteG.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); chuteG.computeVertexNormals();
    flood.add(new THREE.Mesh(chuteG, M.spill));
    // 発電所(左 14 基、右 12 基): 堤体の水圧管、堤体のすそ野の建屋、主変圧器、放水口
    for (const [xa, xb, n] of [[-830, -262, 14], [252, 820, 12]]) {
      const w = (xb - xa) / n;
      for (let i = 0; i < n; i++) {
        const x = xa + (i + 0.5) * w;
        tube(world, V(x, 112, 21), V(x, 6, 96), 6.2, M.body);
        slab(x - 6, x + 6, 112, 124, 50, 60, M.mid);   // 主変圧器
        slab(x - 8, x + 8, 214.4, 215, -15, -4, M.dark, world, { edges: false });
        slab(x - 1, x + 1, 118, 185.6, 4, 48, M.light, world, { edges: false });   // 柱の割り付け
      }
      slab(xa, xb, 118, 185, D.base, 50, M.body);
      slab(xa - 0.3, xb + 0.3, 140, 185.4, 34, 40, M.glass, world, { edges: false });
      slab(xa - 0.5, xb + 0.5, 117.5, 185.5, 46, 48, M.accent, world, { edges: false });
      slab(xa, xb, 185, 215, D.base, 14, M.light);   // 下流の吸出し管の床
      slab(xa, xb, 190, 196, 14, 16, M.mid, world, { edges: false });
    }
    // 天端の門形クレーン(洪水吐きに 2 基、取水口に左右 1 基ずつ)
    for (const x of [-140, 120, -560, 540]) {
      for (const [a, b] of [[-12, -4], [12, -4], [-12, 12], [12, 12]]) slab(x + a - 1.5, x + a + 1.5, b - 1.5, b + 1.5, D.crest + 3, D.crest + 40, M.light);
      slab(x - 16, x + 16, -8, 16, D.crest + 40, D.crest + 46, M.light);
      slab(x - 6, x + 6, -2, 10, D.crest + 46, D.crest + 54, M.body);
    }
    // 近未来化: 右岸の統合管制センター(チーム色の帯、箱形の覆いのレーダー)
    slab(1180, 1290, 160, 230, 150, 172, M.body);
    slab(1179.6, 1290.4, 159.6, 230.4, 162, 166, M.glass, world, { edges: false });
    slab(1179.4, 1290.6, 159.4, 230.6, 170, 171.5, M.accent, world, { edges: false });
    slab(1220, 1240, 185, 195, 172, 182, M.light);
    add(cyl(0.8, 30, 8), M.dark, world, { x: 1270, y: 187, z: 210 });

    // ── 水面: 貯水池、下流の川、水の切り口 ──
    const pool = waterShape([[-1490, D.z0], [1150, D.z0], [1150, 0], [LOCK.b[1], 0], [LOCK.b[1], H[0]], [-1490, H[0]]], M.pool); pool.position.y = D.pool; world.add(pool);
    const river = waterShape([[LIFT.x0, 112], [1150, 112], [1150, D.z1], [LIFT.x0, D.z1]], M.river); world.add(river);
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(1150 + 1490, D.pool - D.poolBed), { x: (1150 - 1490) / 2, y: (D.pool + D.poolBed) / 2, z: D.z0 }],
      [new THREE.PlaneGeometry(1150 - LIFT.x0, -D.bed), { x: (1150 + LIFT.x0) / 2, y: D.bed / 2, z: D.z1 }],
    ]), M.waterCut));

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 状態と更新: 昇船機は常に上下(上がる → 待つ → 下がる → 待つ)、洪水放流でゲートが上がる ──
    let state = opts.state ?? "normal", g = state === "flood" ? 1 : 0, clock = 0;
    const ease = (x) => x * x * (3 - 2 * x), CYC = 2 * (LIFT.sec + LIFT.wait);
    const liftAt = (tm) => { const c = tm % CYC; return c < LIFT.sec ? ease(c / LIFT.sec) : c < LIFT.sec + LIFT.wait ? 1 : c < 2 * LIFT.sec + LIFT.wait ? 1 - ease((c - LIFT.sec - LIFT.wait) / LIFT.sec) : 0; };
    function apply() {
      car.position.y = LIFT.low + (LIFT.high - LIFT.low) * liftAt(clock);
      gates.position.y = 18 * ease(g);
      flood.visible = g > 0.6;
    }
    function update(dt) {
      clock += dt;
      g = state === "flood" ? Math.min(1, g + dt / 4) : Math.max(0, g - dt / 4);
      apply();
      M.river.map.offset.y -= dt * (0.08 + 0.3 * g); M.spill.map.offset.y -= dt * 1.2; M.liftW.map.offset.y -= dt * 0.02;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function check() {
      const r1 = (v) => +v.toFixed(2);
      return {
        liftTopToMachineRoom_m: r1(136 - (LIFT.high + 11)), liftBottomToPit_m: r1(LIFT.low - -10), liftSideGap_m: r1((C1 - C0 - CW) / 2 - 1.8),
        liftCarWaterAt: { low: LIFT.low + 7, high: LIFT.high + 7 }, waterLevels: { tail: 0, pool: D.pool },
        lockSteps_m: Array.from({ length: 5 }, (_, i) => D.step), lockWidth_m: LOCK.a[1] - LOCK.a[0],
        spillGateRaisedTop_m: 113 + 18, spillDeckTop_m: D.crest + 3,
      };
    }
    U.bake(THREE, group, { dynamic: [car, gates, flood], live: [M.accent] });
    apply();
    const at = (x, y, z) => V((x - XC) * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, check, stats: () => U.stats(group), parts: { ring, disc }, at, setTeam: (c) => F.setTeam(M, c),
      setState(s) { state = s; }, get state() { return state; }, get progress() { return g; },
      shots: {
        locks: { label: "5 段の閘門", target: [-1410, 60, 500], pos: [-1000, 420, 1100] },
        lift: { label: "昇船機", target: [-1215, 70, 60], pos: [-950, 200, 380] },
        spill: { label: "洪水吐き", target: [0, 60, 80], pos: [200, 230, 620] },
        power: { label: "発電所", target: [540, 40, 150], pos: [760, 180, 520] },
      },
    };
  }

  DreamAssets.fac.register("three_gorges", {
    section: 2, title: "三峡ダム", kind: "STRATEGIC FACILITY · 2 水門・閘門・防潮堤",
    desc: "長江の世界最大の水力発電所。全長 2.3 km の堤体と、左岸の 5 段 2 列の閘門、船を丸ごと持ち上げる昇船機。発電・水運・洪水制御を一手に握る多機能トークン",
    info: [["ファイル", "mockups/3d/facilities/three_gorges.js"], ["大きさ", "実寸 3000 × 2000 m を 0.06 倍 × 表示 3.0"], ["誇張", "閘室の幅 1.5 倍(50 m)、閘門の山を段ごとに下げる。高さは実寸"], ["省略", "船・車両・人・送電線"], ["動作", "昇船機が 110 m を上下(常時)。洪水放流でゲートが上がり越流面を水が流れる"], ["近未来化", "3 つの機能の中枢(発電所・昇船機・統合管制センター)をチーム色で表示"]],
    dist: 1150, target: 40, tokenAt: [420, 0, 330],
    make: (THREE) => threeGorges(THREE, { r: 110 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["発電・通航", () => a.setState("normal"), () => a.state === "normal"], ["洪水放流", () => a.setState("flood"), () => a.state === "flood"]],
    caption: (a) => (a.state === "flood" ? "洪水放流 — 洪水吐きのゲートが上がっています" : ""),
  });
})();
