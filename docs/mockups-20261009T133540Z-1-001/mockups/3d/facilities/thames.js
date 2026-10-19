// 戦略施設トークン「テムズ・バリア」(英国・ロンドン、テムズ川の可動堰)の詳細版モデル(試作)。
// 川幅 520 m を横切る 10 門(幅 61 m の主ゲート 4、31.5 m の副ゲート 2、31.5 m の落下式ラジアルゲート 4)と、9 本の橋脚の上の銀色の貝殻屋根。平面は実寸の比率(K = 0.26)。
// 誇張: 貝殻屋根の高さ 1.5 倍・幅 1.3 倍(施設リストの「モデルの決め手」)。高潮の水位差は実物どおり約 5 m。
// 主・副ゲートは回転セクターゲート: 平時は川底の凹んだ敷居に横たわり、両端の円盤ごと 90° 回って起き上がる。端の 4 門は上に吊ったラジアルゲートを下ろす。
// 近未来化(施設リストの案): 下流に新しい大型バリアを建設中の姿(締切りの鋼矢板と排水した中の橋脚の基礎、塔形クレーン)。
// 省略: 船・作業船・人・橋脚の信号灯。
//
// 状態: "open"(平時)→ "closing"(14 秒)→ "closed"(下流の高潮を止める)→ "opening" → "open"
// 川は z 方向、+z が下流(海)。x は北岸(-x)から南岸(+x)。
(function () {
  const K = 0.26;
  const D = {
    ground: 7, bed: -8, pit: -11, base: -14, pierTop: 9,
    bank: 262, x0: -330, x1: 330, z0: -150, z1: 330,
    spans: [31.5, 31.5, 31.5, 61, 61, 61, 61, 31.5, 31.5, 31.5], pw: 10,
    radial: [0, 1, 8, 9],                      // 落下式ラジアルゲートの径間(ほかは回転セクターゲート)
    sec: { y: 2, z: 0, r: 12, half: 0.985 },   // セクターゲートの軸と半径、扉の半角(弦 20 m)
    rad: { y: 2, z: 26, r: 14, half: Math.asin((2 - (-8 + 0.6)) / 14), open: 1.31 },   // 閉じた下端が敷居(川底 + 0.6)に乗る
    surge: 5, build: { z: 235, xs: [-150, 0, 150] },
  };
  const SEC = 14;

  function thames(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const { add, box, cyl, V, prism, closedLoft, arcLoft, tube, lattice } = F.kit(THREE, M, K);
    M.up = U.waterMaterial(THREE); M.up.side = THREE.DoubleSide;
    M.down = U.waterMaterial(THREE); M.down.side = THREE.DoubleSide;
    M.cutDown = M.waterCut.clone();
    M.silver = M.lambert(0xdfe4e8);   // 貝殻屋根のステンレス
    const group = new THREE.Group(); group.name = "thames";
    const ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, -ZC * K); group.add(world);
    const R = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const waterMesh = (polys, mat) => {
      const shapes = polys.map((p) => {
        const sh = new THREE.Shape((p.pts ?? p).map(([x, z]) => new THREE.Vector2(x, -z)));
        for (const h of p.holes ?? []) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
        return sh;
      });
      const g = new THREE.ShapeGeometry(shapes); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) * K) / U.WATER_TILE[0], (-p.getZ(i) * K) / U.WATER_TILE[1]);
      const m = new THREE.Mesh(g, mat); world.add(m); return m;
    };
    // 径間の位置
    const SP = []; { let x = -D.bank; D.spans.forEach((w, i) => { SP.push({ i, x0: x, x1: x + w, radial: D.radial.includes(i) }); x += w + (i < D.spans.length - 1 ? D.pw : 0); }); }
    const piers = SP.slice(0, -1).map((s) => s.x1 + D.pw / 2);

    // ── 台座: 川底(セクターゲートの径間は凹んだ敷居)、両岸の堤防、道路 ──
    const pitHoles = SP.filter((s) => !s.radial).map((s) => R(s.x0, -14, s.x1, 14));
    add(prism(R(-D.bank, D.z0, D.bank, D.z1), D.base, D.bed, pitHoles), M.light, world, { edges: false });
    for (const s of SP.filter((s) => !s.radial)) {
      add(box(s.x1 - s.x0, D.pit - D.base, 28), M.mid, world, { x: (s.x0 + s.x1) / 2, y: (D.base + D.pit) / 2, z: 0, edges: false });
      for (const z of [-13, 13]) add(box(s.x1 - s.x0, 0.6, 1.2), M.dark, world, { x: (s.x0 + s.x1) / 2, y: D.bed - 0.3, z, edges: false });   // 敷居の縁の鋼材
    }
    for (const s of SP.filter((s) => s.radial)) add(box(s.x1 - s.x0, 0.6, 3), M.mid, world, { x: (s.x0 + s.x1) / 2, y: D.bed + 0.3, z: 12, edges: false });   // ラジアルゲートの敷居
    F.plinth({ add, box }, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.6, { z: ZC });
    for (const s of [-1, 1]) {
      add(prism(R(s < 0 ? D.x0 : D.bank, D.z0, s < 0 ? -D.bank : D.x1, D.z1), D.base, D.ground), M.land, world);
      add(box(D.x1 - D.bank - 16, 0.15, 10), M.mid, world, { x: s * (D.bank + (D.x1 - D.bank) / 2 + 4), y: D.ground + 0.08, z: -110, edges: false });
      add(box(1.2, 1.4, D.z1 - D.z0), M.light, world, { x: s * (D.bank + 0.6), y: D.ground + 0.7, z: ZC });   // 堤防の胸壁
    }

    // ── 橋脚と貝殻屋根(ステンレスの殻 3 枚が下流へ向けて段々に高くなる。開いた口は暗い) ──
    const shell = (parent, x, zs, ze, H, W) => {
      const rings = [];
      for (let k = 0; k <= 8; k++) {
        const u = Math.max(0.04, k / 8), z = zs + (ze - zs) * (k / 8), w = W * (0.7 + 0.3 * u), h = H * Math.sqrt(u);
        rings.push(Array.from({ length: 11 }, (_, j) => { const a = (Math.PI * j) / 10; return V(x + w * Math.cos(a), D.pierTop + h * Math.sin(a), z); }));
      }
      add(closedLoft(rings), M.silver, parent);
      const mouth = new THREE.ShapeGeometry(new THREE.Shape(Array.from({ length: 11 }, (_, j) => { const a = (Math.PI * j) / 10; return new THREE.Vector2(W * 0.78 * Math.cos(a), H * 0.82 * Math.sin(a)); })));
      add(mouth, M.dark, parent, { x, y: D.pierTop + 0.3, z: ze + 0.15, edges: false });
    };
    for (const x of piers) {
      add(prism([[x - D.pw / 2, -32], [x, -40], [x + D.pw / 2, -32], [x + D.pw / 2, 32], [x, 40], [x - D.pw / 2, 32]], D.base, D.pierTop), M.light, world);
      add(box(D.pw + 0.4, 0.6, 64.4), M.mid, world, { x, y: D.pierTop - 0.3, edges: false });
      const W = 8 * 1.3;
      shell(world, x, -36, -10, 9 * 1.5, W * 0.85);
      shell(world, x, -22, 6, 15 * 1.5, W);
      shell(world, x, -8, 22, 21 * 1.5, W * 1.1);
      add(box(6, 4, 8), M.light, world, { x, y: D.pierTop + 2, z: 30 });   // 下流側の階段塔
      add(box(6.2, 0.8, 8.2), M.dark, world, { x, y: D.pierTop + 3.2, z: 30, edges: false });
    }

    // ── ゲート ──
    const gates = [];
    const leafRot = (g) => { g.rotation.z = -Math.PI / 2; return g; };   // arcLoft の y 軸(幅)を x へ倒す
    for (const s of SP) {
      const pivot = new THREE.Group(); world.add(pivot);
      if (!s.radial) {
        const G = D.sec; pivot.position.set(0, G.y, G.z);
        const xa = s.x0 + 3.4, xb = s.x1 - 3.4, b0 = Math.PI / 2 - G.half, b1 = Math.PI / 2 + G.half;
        leafRot(add(arcLoft([[G.r - 1, xa], [G.r, xa], [G.r, xb], [G.r - 1, xb]], b0, b1, 14), M.light, pivot));
        for (let x = xa + 6; x < xb - 3; x += 8) leafRot(add(arcLoft([[G.r - 2.6, x - 0.3], [G.r - 1, x - 0.3], [G.r - 1, x + 0.3], [G.r - 2.6, x + 0.3]], b0, b1, 8), M.mid, pivot));   // 扉の裏の補剛材
        for (const b of [Math.PI / 2 - 0.5, Math.PI / 2 + 0.5]) add(box(xb - xa, 1.4, 1.4), M.mid, pivot, { x: (xa + xb) / 2, y: -(G.r - 2) * Math.sin(b), z: (G.r - 2) * Math.cos(b) });
        const discG = cyl(G.r + 0.3, 2.5, 28); discG.rotateZ(Math.PI / 2);
        const bandG = cyl(G.r + 0.45, 1.4, 28); bandG.rotateZ(Math.PI / 2);
        const hubG = cyl(2.2, 3.4, 12); hubG.rotateZ(Math.PI / 2);
        for (const x of [s.x0 + 2.05, s.x1 - 2.05]) {   // 両端の円盤(回転の腕)
          add(discG, M.mid, pivot, { x }); add(bandG, M.dark, pivot, { x, edges: false }); add(hubG, M.dark, pivot, { x });
        }
      } else {
        const G = D.rad; pivot.position.set(0, G.y, G.z);
        const xa = s.x0 + 1.5, xb = s.x1 - 1.5, b0 = Math.PI - G.half, b1 = Math.PI + G.half;
        leafRot(add(arcLoft([[G.r - 0.8, xa], [G.r, xa], [G.r, xb], [G.r - 0.8, xb]], b0, b1, 12), M.light, pivot));
        for (const b of [Math.PI / 2 - 0.4, Math.PI / 2 + 0.4].map((v) => v + Math.PI / 2)) add(box(xb - xa, 1.0, 1.0), M.mid, pivot, { x: (xa + xb) / 2, y: -(G.r - 1.4) * Math.sin(b), z: (G.r - 1.4) * Math.cos(b) });
        for (const x of [xa + 0.6, xb - 0.6]) for (const b of [b0 + 0.05, b1 - 0.05]) tube(pivot, V(x, 0, 0), V(x, -(G.r - 0.8) * Math.sin(b), (G.r - 0.8) * Math.cos(b)), 0.6, M.mid);   // 腕
        const hubG = cyl(1.3, 1.2, 10); hubG.rotateZ(Math.PI / 2);
        for (const x of [xa + 0.6, xb - 0.6]) add(hubG, M.dark, pivot, { x });
        for (const x of [s.x0 + 0.1, s.x1 - 0.1]) add(box(0.1, 3, 3), M.dark, world, { x, y: G.y, z: G.z, edges: false });   // 橋脚の側面の軸受け
      }
      gates.push({ pivot, radial: s.radial });
    }

    // ── 近未来化: 下流の新しいバリアの建設(鋼矢板の締切り、中を排水して橋脚の基礎、塔形クレーン) ──
    const B = D.build, coffer = (x) => R(x - 18, B.z - 34, x + 18, B.z + 34);
    for (const [i, x] of B.xs.entries()) {
      const [[xa, za], , [xb, zb]] = coffer(x);
      for (const [w, d, cx, cz] of [[xb - xa, 1.2, x, za], [xb - xa, 1.2, x, zb], [1.2, zb - za, xa, B.z], [1.2, zb - za, xb, B.z]]) add(box(w, 16, d), M.dark, world, { x: cx, y: D.bed + 8, z: cz });
      for (let z = za + 8; z < zb; z += 10) for (const xx of [xa, xb]) add(box(2, 1, 1), M.mid, world, { x: xx + (xx < x ? 1.6 : -1.6), y: D.bed + 14, z, edges: false });   // 腹起し
      const hgt = [7, 3, 11][i];   // 3 本の基礎の進み具合
      add(prism([[x - 7, B.z - 24], [x, B.z - 30], [x + 7, B.z - 24], [x + 7, B.z + 24], [x, B.z + 30], [x - 7, B.z + 24]], D.bed, D.bed + hgt), M.light, world);
      for (let k = 0; k < 10; k++) tube(world, V(x - 5 + (k % 2) * 10, D.bed + hgt, B.z - 20 + Math.floor(k / 2) * 10), V(x - 5 + (k % 2) * 10, D.bed + hgt + 3, B.z - 20 + Math.floor(k / 2) * 10), 0.35, M.dark);   // 差し筋
      if (i !== 1) {   // 塔形クレーン
        const cb = V(x + 11, D.bed, B.z + 26);
        lattice(world, cb, 52, 1.6, 1.6, 8, 0.25, M.mid);
        add(box(4, 3, 4), M.accent, world, { x: cb.x, y: cb.y + 53.5, z: cb.z, edges: false });
        add(box(2.2, 2.2, 40), M.mid, world, { x: cb.x, y: cb.y + 56, z: cb.z - 14 });
        add(box(3, 3, 5), M.dark, world, { x: cb.x, y: cb.y + 56, z: cb.z + 8 });
      }
    }

    // ── 管制棟(南岸)と見学棟(北岸) ──
    add(box(40, 24, 26), M.body, world, { x: 300, y: D.ground + 12, z: -60 });
    for (let k = 0; k < 4; k++) add(box(40.2, 1.6, 26.2), M.glass, world, { x: 300, y: D.ground + 4 + k * 5.4, z: -60, edges: false });
    add(box(40.4, 0.7, 26.4), M.accent, world, { x: 300, y: D.ground + 24.2, z: -60, edges: false });
    add(box(14, 6, 14), M.light, world, { x: 292, y: D.ground + 27.4, z: -60 });
    tube(world, V(306, D.ground + 24.5, -66), V(306, D.ground + 38, -66), 0.35, M.dark);
    add(box(30, 6, 18), M.body, world, { x: -300, y: D.ground + 3, z: -40 });
    add(box(30.2, 1.4, 18.2), M.glass, world, { x: -300, y: D.ground + 3.6, z: -40, edges: false });

    // ── 水面: 上流と下流(ゲートの線で分ける)。下流は建設中の締切りを抜く ──
    const up = waterMesh([R(-D.bank, D.z0, D.bank, 12)], M.up);
    const down = waterMesh([{ pts: R(-D.bank, 12, D.bank, D.z1), holes: D.build.xs.map(coffer) }], M.down);
    const cutUp = new THREE.Mesh(new THREE.PlaneGeometry(2 * D.bank, -D.bed).translate(0, D.bed / 2, D.z0), M.waterCut); world.add(cutUp);
    const cutDown = new THREE.Mesh(new THREE.PlaneGeometry(2 * D.bank, 1).translate(0, 0.5, D.z1), M.cutDown); world.add(cutDown);

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 108, M.ring, M.disc);

    // ── 状態と更新 ──
    const ease = (x) => x * x * (3 - 2 * x), clamp = (x) => Math.min(1, Math.max(0, x));
    let state = opts.state ?? "open", t = state === "closed" ? 1 : 0;
    const gateP = (tt) => ease(clamp(tt / 0.75)), surgeP = (tt) => ease(clamp((tt - 0.75) / 0.25));
    function apply() {
      const g = gateP(t);
      for (const gt of gates) gt.pivot.rotation.x = gt.radial ? D.rad.open * (1 - g) : -Math.PI / 2 * g;
      const lv = D.surge * surgeP(t);
      down.position.y = lv;
      cutDown.position.y = D.bed; cutDown.scale.y = lv - D.bed;
    }
    function update(dt) {
      if (state === "closing") { t = Math.min(1, t + dt / SEC); if (t >= 1) state = "closed"; }
      if (state === "opening") { t = Math.max(0, t - dt / SEC); if (t <= 0) state = "open"; }
      apply();
      const flow = 0.18 * (1 - ease(t));
      M.up.map.offset.y -= dt * flow; M.down.map.offset.y -= dt * (flow + 0.02);
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "open" || s === "closed") { state = s; t = s === "closed" ? 1 : 0; apply(); }
      else if (s === "closing" || s === "opening") state = s;
    }
    function check() {
      // 扉の外縁(内外の半径 × 両端の角度)を全回転で回し、川底・敷居・凹みとの最小の隙間を測る
      const G = D.sec, rot = (y, z, a) => [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
      let secLow = Infinity, secDisc = G.y - (G.r + 0.45) - D.pit, radLowOpen = Infinity, radClosedBottom = Infinity, radLowSweep = Infinity;
      for (let a = 0; a >= -Math.PI / 2; a -= 0.02) for (const r of [G.r - 2.6, G.r]) for (const b of [Math.PI / 2 - G.half, Math.PI / 2, Math.PI / 2 + G.half]) {
        const [y, z] = rot(-r * Math.sin(b), r * Math.cos(b), a), yy = G.y + y, zz = G.z + z;
        secLow = Math.min(secLow, yy - (Math.abs(zz) <= 14 ? D.pit : D.bed));
      }
      const Rd = D.rad;
      for (let a = 0; a <= Rd.open; a += 0.02) for (const b of [Math.PI - Rd.half, Math.PI + Rd.half]) {
        const [y, z] = rot(-Rd.r * Math.sin(b), Rd.r * Math.cos(b), a), yy = Rd.y + y;
        radLowSweep = Math.min(radLowSweep, yy - D.bed);
        if (Math.abs(a - Rd.open) < 0.011) radLowOpen = Math.min(radLowOpen, yy - D.surge);
        if (a === 0) radClosedBottom = Math.min(radClosedBottom, yy - (D.bed + 0.6));
      }
      const r1 = (v) => +v.toFixed(2);
      return {
        sectorLeafOverBed_m: r1(secLow), sectorDiscOverPit_m: r1(secDisc), discToPier_m: 0.8,   // セクターゲートの扉・円盤と川底の凹みの最小の隙間、円盤と橋脚の隙間
        radialOverBedSweep_m: r1(radLowSweep), radialOpenAboveSurge_m: r1(radLowOpen),         // ラジアルゲートの全回転での川底との隙間、開いたときの下端と高潮の水面の差
        radialClosedToSill_m: r1(radClosedBottom),                                              // 閉じたときの下端と敷居(0 = 接地)
        sectorClosedTop_m: r1(G.y + G.r * Math.sin(G.half)), surge_m: D.surge,                  // 閉じた主ゲートの天端の高さ、高潮
      };
    }
    apply();
    U.bake(THREE, group, { dynamic: gates.map((g) => g.pivot), live: [M.accent] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; }, get progress() { return t; },
      shots: {
        roofs: { label: "貝殻屋根(上流から)", target: [-40, 18, 0], pos: [-10, 60, -170] },
        gate: { label: "主ゲートと円盤", target: [-20, 0, 6], pos: [40, 30, 90] },
        build: { label: "下流の建設現場", target: [0, 5, 235], pos: [120, 80, 330] },
      },
    };
  }

  DreamAssets.fac.register("thames", {
    section: 2, title: "テムズ・バリア", kind: "STRATEGIC FACILITY · 2 水門・閘門・防潮堤",
    desc: "ロンドンのテムズ川を横切る可動堰。銀色の貝殻屋根をかぶった 9 本の橋脚の間で、川底に横たわる回転セクターゲートが起き上がって高潮を止める。下流に新しい大型バリアを建設中の近未来版",
    info: [["ファイル", "mockups/3d/facilities/thames.js"], ["大きさ", "実寸 660 × 480 m を 0.26 倍 × 表示 3.0"], ["誇張", "貝殻屋根の高さ 1.5 倍・幅 1.3 倍。平面の配置・ゲートは実寸"], ["省略", "船・作業船・人・信号灯"], ["動作", "セクターゲートが 90° 回って起き上がり、端の 4 門は下ろす(閉鎖 14 秒)→ 下流の水位が上がる"], ["近未来化", "下流の新バリアの締切り・基礎・塔形クレーン"]],
    dist: 1050, target: 25, tokenAt: [380, 0, 260],
    make: (THREE) => thames(THREE, { r: 108 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["開", () => a.setState("open"), () => a.state === "open"], ["閉鎖 ▶", () => a.setState("closing"), () => a.state === "closing"], ["閉", () => a.setState("closed"), () => a.state === "closed"], ["◀ 開放", () => a.setState("opening"), () => a.state === "opening"]],
    caption: (a) => (a.state === "closing" ? "閉鎖中 — ゲートを起こして高潮を止める" : a.state === "opening" ? "開放中 — ゲートを川底の敷居へ戻す" : ""),
  });
})();
