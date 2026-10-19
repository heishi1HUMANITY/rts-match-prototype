// 戦略施設トークン「キール運河(ブルンスビュッテル閘門)」(ドイツ、北海側の入口)の詳細版モデル(試作)。
// エルベ川と運河の間に並ぶ閘室: 小閘門 2 室(22 m 幅)、大閘門 2 室(42 m 幅)、その間の島で建設中の第 5 閘室(45 m 幅)。平面は実寸の比率(K = 0.26)。
// 扉は横に転がって壁の中の扉室へ収まる引き戸式のケーソン扉。各閘室が時間差で通航の 1 巡(エルベ側を開 → 運河の水位へ → 運河側を開 → エルベの水位へ)を繰り返す。
// 誇張: エルベの潮位差 2.5 倍(実物 約 3 m → 7.5 m)。閘室の水位の上げ下げが見えるようにするため。構造物の寸法は実寸。
// 省略: 船・タグボート・人・係船柱・大閘門の中間の扉(閘室を半分で使うための 3 枚目)。
// 近未来化(施設リストの案): NATO の増援ルートとして、運河側の軍用の待機岸壁(倉庫、覆土した弾薬庫、柵)と監視塔 2 基。
//
// 状態: "run"(通航)/ "stop"(通航停止。扉と水位がその場で止まる)
// 水路は z 方向、-z がエルベ川、+z が運河。x は南(-x)から北(+x)。
(function () {
  const K = 0.26;
  const D = {
    ground: 6, base: -18, elbeBed: -14, canalBed: -12, tide: 3.75, tideSec: 60,
    x0: -260, x1: 200, z0: -120, z1: 520, canal: [-210, 130],
  };
  const CH = [
    { name: "小閘門(南)", x0: -200, x1: -178, gO: 10, gI: 150, t: 6, dir: -1, end: 160, floor: -10 },
    { name: "小閘門(北)", x0: -150, x1: -128, gO: 10, gI: 150, t: 6, dir: -1, end: 160, floor: -10 },
    { name: "大閘門(南)", x0: -10, x1: 32, gO: 14, gI: 346, t: 9, dir: 1, end: 380, floor: -14 },
    { name: "大閘門(北)", x0: 80, x1: 122, gO: 14, gI: 346, t: 9, dir: 1, end: 380, floor: -14 },
  ];
  for (const c of CH) { c.w = c.x1 - c.x0; c.dp = c.w + 2.5; c.h = c.t / 2 + 1; }
  const NEW = { x0: -110, x1: -65, z0: 15, z1: 365, floor: -16, gates: [27, 353] };
  // 1 巡の段階 [秒, 扉(O: エルベ側 / I: 運河側), 水位]
  const STEPS = [[3, "Oopen", "elbe"], [6, "Ohold", "elbe"], [3, "Oclose", "elbe"], [5, "", "toCanal"], [3, "Iopen", "canal"], [6, "Ihold", "canal"], [3, "Iclose", "canal"], [5, "", "toElbe"]];
  const CYCLE = STEPS.reduce((a, s) => a + s[0], 0);
  const OFFSET = [0, 8.5, 17, 25.5];
  const STEP_TEXT = { elbe: "エルベ側の扉を開けて船を入れる", toCanal: "運河の水位へ合わせる", canal: "運河側の扉を開けて船を出す", toElbe: "エルベの水位へ合わせる" };

  function kiel(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const { add, box, cyl, V, prism, lattice } = F.kit(THREE, M, K);
    M.elbe = U.waterMaterial(THREE); M.elbe.side = THREE.DoubleSide;
    M.canal = U.waterMaterial(THREE); M.canal.side = THREE.DoubleSide;
    M.cham = U.waterMaterial(THREE); M.cham.side = THREE.DoubleSide;
    M.cutElbe = M.waterCut.clone();
    const group = new THREE.Group(); group.name = "kiel";
    const XC = (D.x0 + D.x1) / 2, ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, -ZC * K); group.add(world);
    const R = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const waterMesh = (polys, mat) => {
      const g = new THREE.ShapeGeometry(polys.map((p) => new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z))))); g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) * K) / U.WATER_TILE[0], (-p.getZ(i) * K) / U.WATER_TILE[1]);
      const m = new THREE.Mesh(g, mat); world.add(m); return m;
    };
    // 帯状の陸の平面形。n0 / n1 = x0 側 / x1 側の扉室の切り欠き { z, h(半分の長さ), d(奥行き。負なら外へ) }
    const strip = (x0, x1, z0, z1, n0 = [], n1 = []) => {
      const pts = [[x0, z0], [x1, z0]];
      for (const n of [...n1].sort((a, b) => a.z - b.z)) pts.push([x1, n.z - n.h], [x1 - n.d, n.z - n.h], [x1 - n.d, n.z + n.h], [x1, n.z + n.h]);
      pts.push([x1, z1], [x0, z1]);
      for (const n of [...n0].sort((a, b) => b.z - a.z)) pts.push([x0, n.z + n.h], [x0 + n.d, n.z + n.h], [x0 + n.d, n.z - n.h], [x0, n.z - n.h]);
      return pts;
    };
    const notches = (c) => [c.gO, c.gI].map((z) => ({ z, h: c.h, d: c.dp }));

    // ── 陸: 閘室の間の島(扉室の切り欠き)、運河の両岸 ──
    const [S1, S2, B1, B2] = CH;
    const newHole = strip(NEW.x0, NEW.x1, NEW.z0, NEW.z1, [], NEW.gates.map((z) => ({ z, h: 6, d: -47.5 })));
    for (const [pts, holes] of [
      [strip(D.x0, S1.x0, 0, 380, [], notches(S1)), []],
      [strip(S1.x1, S2.x0, 0, 160, [], notches(S2)), []],
      [strip(S2.x1, B1.x0, 0, 380), [newHole]],
      [strip(B1.x1, B2.x0, 0, 380, notches(B1)), []],
      [strip(B2.x1, D.x1, 0, 380, notches(B2)), []],
      [R(D.x0, 380, D.canal[0], D.z1), []],
      [R(D.canal[1], 380, D.x1, D.z1), []],
    ]) add(prism(pts, D.base, D.ground, holes), M.land, world);
    // 閘室・扉室・水路の底
    for (const c of CH) {
      add(box(c.w, c.floor - D.base, c.end), M.light, world, { x: (c.x0 + c.x1) / 2, y: (D.base + c.floor) / 2, z: c.end / 2, edges: false });
      for (const z of [c.gO, c.gI]) add(box(c.dp, c.floor - D.base, 2 * c.h), M.mid, world, { x: c.dir < 0 ? c.x0 - c.dp / 2 : c.x1 + c.dp / 2, y: (D.base + c.floor) / 2, z, edges: false });
      for (const z of [c.gO, c.gI]) for (const s of [-1, 1]) add(box(c.w, 1.2, 1.0), M.dark, world, { x: (c.x0 + c.x1) / 2, y: c.floor + 0.6, z: z + s * (c.t / 2 + 0.6), edges: false });   // 扉の戸当たり(敷居)
    }
    add(box(S2.x1 - S1.x0, -10 - D.base, 220), M.light, world, { x: (S1.x0 + S2.x1) / 2, y: (D.base - 10) / 2, z: 270, edges: false });
    add(box(D.canal[1] - D.canal[0], D.canalBed - D.base, D.z1 - 380), M.light, world, { x: (D.canal[0] + D.canal[1]) / 2, y: (D.base + D.canalBed) / 2, z: (380 + D.z1) / 2, edges: false });
    add(box(D.x1 - D.x0, D.elbeBed - D.base, -D.z0), M.light, world, { x: XC, y: (D.base + D.elbeBed) / 2, z: D.z0 / 2, edges: false });
    F.plinth({ add, box }, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 0.6, { x: XC, z: ZC });
    // エルベ側の導流堤(島の先から川へ)
    for (const x of [(S1.x1 + S2.x0) / 2, -69, (B1.x1 + B2.x0) / 2, 150]) {
      add(box(8, 5 - D.elbeBed, 72), M.mid, world, { x, y: (D.elbeBed + 5) / 2, z: -36 });
      add(box(8.4, 0.6, 72.4), M.light, world, { x, y: 5.2, z: -36, edges: false });
    }
    // 閘門の縁の笠石(扉室のない側)と、扉室の奥にまたがる機械室(扉の上の機械室より上)
    for (const c of CH) {
      const x = c.dir < 0 ? c.x1 + 0.8 : c.x0 - 0.8;
      add(box(1.6, 0.4, c.end - 2), M.light, world, { x, y: D.ground + 0.2, z: c.end / 2, edges: false });
      for (const z of [c.gO, c.gI]) {
        const xr = c.dir < 0 ? c.x0 - c.dp + 5 : c.x1 + c.dp - 5;
        add(box(10, 5, 2 * c.h + 6), M.body, world, { x: xr, y: 11.5, z });
        add(box(10.2, 0.9, 2 * c.h + 6.2), M.glass, world, { x: xr, y: 12.4, z, edges: false });
      }
    }

    // ── 第 5 閘室(建設中): 排水した穴、鋼矢板、打ちかけの側壁と底版、型枠、塔形クレーン 2 基 ──
    add(box(NEW.x1 - NEW.x0, NEW.floor - D.base, NEW.z1 - NEW.z0), M.mid, world, { x: (NEW.x0 + NEW.x1) / 2, y: (D.base + NEW.floor) / 2, z: (NEW.z0 + NEW.z1) / 2, edges: false });
    for (const z of NEW.gates) add(box(47.5, NEW.floor - D.base, 12), M.mid, world, { x: NEW.x1 + 23.75, y: (D.base + NEW.floor) / 2, z, edges: false });
    for (const [w, d, x, z] of [[NEW.x1 - NEW.x0, 0.8, (NEW.x0 + NEW.x1) / 2, NEW.z0 + 0.4], [NEW.x1 - NEW.x0, 0.8, (NEW.x0 + NEW.x1) / 2, NEW.z1 - 0.4], [0.8, NEW.z1 - NEW.z0, NEW.x0 + 0.4, (NEW.z0 + NEW.z1) / 2]]) add(box(w, D.ground - NEW.floor + 0.6, d), M.dark, world, { x, y: (NEW.floor + D.ground + 0.6) / 2, z });
    for (let k = 0; k < 7; k++) {
      const z = NEW.z0 + 30 + k * 46, done = [1, 1, 0.8, 0.55, 0.35, 0.15, 0][k];
      if (done > 0) for (const x of [NEW.x0 + 4, NEW.x1 - 4]) add(box(7, (D.ground - NEW.floor) * done, 40), M.light, world, { x, y: NEW.floor + ((D.ground - NEW.floor) * done) / 2, z });
      add(box(NEW.x1 - NEW.x0 - 16, k < 5 ? 2.5 : 0.6, 40), k < 5 ? M.light : M.dark, world, { x: (NEW.x0 + NEW.x1) / 2, y: NEW.floor + (k < 5 ? 1.25 : 0.3), z });
      if (done > 0 && done < 1) for (const x of [NEW.x0 + 4, NEW.x1 - 4]) add(box(8, 3, 40), M.dark, world, { x, y: NEW.floor + (D.ground - NEW.floor) * done + 1.5, z, edges: false });   // 型枠
    }
    for (const [x, z] of [[NEW.x0 + 22, 120], [NEW.x0 + 22, 280]]) {
      const cb = V(x, NEW.floor + 2.5, z);
      lattice(world, cb, 58, 1.6, 1.6, 9, 0.25, M.mid);
      add(box(4, 3, 4), M.accent, world, { x, y: cb.y + 59.5, z, edges: false });
      add(box(2.2, 2.2, 48), M.mid, world, { x, y: cb.y + 62, z: z - 18 });
      add(box(3, 3, 6), M.dark, world, { x, y: cb.y + 62, z: z + 9 });
    }

    // ── 管制棟(中の島。閘門の監視室の塔) ──
    add(box(36, 12, 70), M.body, world, { x: -40, y: D.ground + 6, z: 190 });
    for (const y of [D.ground + 4, D.ground + 8.5]) add(box(36.2, 1.4, 70.2), M.glass, world, { x: -40, y, z: 190, edges: false });
    add(box(14, 30, 14), M.body, world, { x: -40, y: D.ground + 15, z: 140 });
    add(box(16, 5, 16), M.glass, world, { x: -40, y: D.ground + 32.5, z: 140 });
    add(box(16.4, 0.8, 16.4), M.accent, world, { x: -40, y: D.ground + 35.4, z: 140, edges: false });

    // ── 近未来化: 軍用の待機岸壁(運河の北岸)と監視塔 ──
    const QX = D.canal[1];
    add(box(16, 0.2, 130), M.mid, world, { x: QX + 8, y: D.ground + 0.1, z: 450, edges: false });                 // 岸壁のエプロン
    add(box(1.2, 0.8, 130), M.dark, world, { x: QX + 0.6, y: D.ground + 0.4, z: 450, edges: false });            // 防舷材の帯
    add(box(22, 10, 66), M.body, world, { x: 182, y: D.ground + 5, z: 470 });                                   // 倉庫
    add(box(22.4, 0.6, 66.4), M.accent, world, { x: 182, y: D.ground + 8.5, z: 470, edges: false });
    for (let k = 0; k < 4; k++) add(box(0.3, 7, 10), M.dark, world, { x: 170.85, y: D.ground + 3.5, z: 446 + k * 16, edges: false });   // 搬入扉
    for (const z of [400, 422]) {   // 覆土した弾薬庫(半円筒の土盛りと正面のコンクリートの壁)
      const g = new THREE.CylinderGeometry(8, 8, 16, 12, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2);   // 軸を x に倒し、上半分を残す
      add(g, M.land, world, { x: 184, y: D.ground, z });
      add(box(1.2, 8.5, 17), M.light, world, { x: 175.4, y: D.ground + 4.2, z });
    }
    for (const [x0, z0, x1, z1] of [[152, 388, 198, 388], [152, 388, 152, 512], [152, 512, 198, 512]]) {   // 柵
      const len = Math.hypot(x1 - x0, z1 - z0), along = x0 === x1;
      add(box(along ? 0.15 : len, 0.15, along ? len : 0.15), M.dark, world, { x: (x0 + x1) / 2, y: D.ground + 2.4, z: (z0 + z1) / 2, edges: false });
      for (let k = 0; k <= Math.round(len / 8); k++) { const t = k / Math.round(len / 8); add(box(0.3, 2.6, 0.3), M.dark, world, { x: x0 + (x1 - x0) * t, y: D.ground + 1.3, z: z0 + (z1 - z0) * t, edges: false }); }
    }
    for (const [x, z] of [[190, 396], [188, 12]]) {   // 監視塔(格子の鉄塔 + 監視室。電子光学の窓は光らない暗いガラス)
      lattice(world, V(x, D.ground, z), 26, 2.4, 1.4, 4, 0.25, M.mid);
      add(box(5, 3.4, 5), M.body, world, { x, y: D.ground + 27.7, z });
      add(box(5.2, 1.2, 5.2), M.glass, world, { x, y: D.ground + 28, z, edges: false });
      add(box(5.4, 0.5, 5.4), M.accent, world, { x, y: D.ground + 29.7, z, edges: false });
      add(box(1.4, 1.2, 1.4), M.dark, world, { x, y: D.ground + 30.6, z });
    }

    // ── 扉(横に転がる鋼のケーソン)。閘室ごとにエルベ側と運河側の 2 枚 ──
    const gates = [];
    for (const c of CH) {
      const H = 5.5 - c.floor, L = c.w + 1.5;
      const mk = (z) => {
        const g = new THREE.Group(); g.position.set((c.x0 + c.x1) / 2 + c.dir * 0.75, 0, z); world.add(g);
        add(box(L, H, c.t), M.light, g, { y: (c.floor + 5.5) / 2 });
        for (const f of [0.3, 0.6, 0.85]) for (const s of [-1, 1]) add(box(L - 1, 0.8, 0.5), M.mid, g, { y: c.floor + H * f, z: s * (c.t / 2 + 0.25), edges: false });   // 横桁
        for (const x of [-L / 2 + 0.6, L / 2 - 0.6]) add(box(1.2, H, c.t + 0.6), M.mid, g, { x, y: (c.floor + 5.5) / 2 });                                          // 端の柱
        add(box(L - 1.6, 0.4, c.t - 1.5), M.dark, g, { y: 5.7, edges: false });                                                                                   // 天端の通路
        add(box(4, 2.2, c.t - 1), M.body, g, { x: c.dir * (L / 2 - 3), y: 6.6 });                                                                                  // 扉の上の機械室
        return g;
      };
      gates.push({ c, O: mk(c.gO), I: mk(c.gI) });
    }

    // ── 水面: エルベ(潮で上下)、運河、閘室 4 つ ──
    const hd = (c, z) => R(c.dir < 0 ? c.x0 - c.dp : c.x1, z - c.h, c.dir < 0 ? c.x0 : c.x1 + c.dp, z + c.h);   // 扉室
    const elbe = waterMesh([R(D.x0, D.z0, D.x1, 0), ...CH.flatMap((c) => [R(c.x0, 0, c.x1, c.gO - c.t / 2), hd(c, c.gO)])], M.elbe);
    const canal = waterMesh([R(D.canal[0], 380, D.canal[1], D.z1), R(S1.x0, 160, S2.x1, 380), ...CH.flatMap((c) => [R(c.x0, c.gI + c.t / 2, c.x1, c.end), hd(c, c.gI)])], M.canal);
    const chambers = CH.map((c) => waterMesh([R(c.x0, c.gO - c.t / 2, c.x1, c.gI + c.t / 2)], M.cham));
    const cutE = new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(D.x1 - D.x0, 1), { x: XC, y: 0.5, z: D.z0 }],
      [new THREE.PlaneGeometry(-D.z0, 1), { x: D.x0, y: 0.5, z: D.z0 / 2, ry: Math.PI / 2 }],
      [new THREE.PlaneGeometry(-D.z0, 1), { x: D.x1, y: 0.5, z: D.z0 / 2, ry: Math.PI / 2 }],
    ]), M.cutElbe); world.add(cutE);
    world.add(new THREE.Mesh(new THREE.PlaneGeometry(D.canal[1] - D.canal[0], -D.canalBed).translate((D.canal[0] + D.canal[1]) / 2, D.canalBed / 2, D.z1), M.waterCut));

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 105, M.ring, M.disc);

    // ── 状態と更新 ──
    const ease = (x) => x * x * (3 - 2 * x);
    let state = opts.state ?? "run", clock = 0, tideT = 0;
    const lane = CH.map((_, i) => OFFSET[i]);   // 閘室ごとの 1 巡の時刻
    const elbeAt = (tt) => D.tide * Math.sin((2 * Math.PI * tt) / D.tideSec);
    // 1 巡の時刻 → { O, I(扉の開き 0〜1), level(水位), step }
    function phase(lt, e) {
      let s = ((lt % CYCLE) + CYCLE) % CYCLE;
      for (const [dur, gate, lv] of STEPS) {
        if (s < dur) {
          const p = ease(s / dur);
          const O = gate === "Oopen" ? p : gate === "Ohold" ? 1 : gate === "Oclose" ? 1 - p : 0;
          const I = gate === "Iopen" ? p : gate === "Ihold" ? 1 : gate === "Iclose" ? 1 - p : 0;
          const level = lv === "elbe" ? e : lv === "canal" ? 0 : lv === "toCanal" ? e * (1 - p) : e * p;
          return { O, I, level, step: lv };
        }
        s -= dur;
      }
    }
    let last = [];
    function apply() {
      const e = elbeAt(tideT);
      elbe.position.y = e; cutE.position.y = D.elbeBed; cutE.scale.y = e - D.elbeBed;
      last = gates.map((g, i) => {
        const ph = phase(lane[i], e), c = g.c, base = (c.x0 + c.x1) / 2 + c.dir * 0.75, shift = c.dir * (c.w + 0.5);
        g.O.position.x = base + shift * ph.O; g.I.position.x = base + shift * ph.I;
        chambers[i].position.y = ph.level;
        return ph;
      });
    }
    function update(dt) {
      clock += dt;
      if (state === "run") { tideT += dt; for (let i = 0; i < lane.length; i++) lane[i] += dt; }
      apply();
      if (state === "run") { M.canal.map.offset.y -= dt * 0.02; M.elbe.map.offset.x += dt * 0.03; }
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) { if (s === "run" || s === "stop") state = s; }
    function check() {
      // 1 巡を細かく回し、扉が開くときの両側の水位差(0 であるべき)と、扉と扉室・壁・水位の隙間を測る
      let openDiff = 0, minTop = Infinity;
      for (let tt = 0; tt < D.tideSec * 2; tt += 0.25) for (let i = 0; i < CH.length; i++) {
        const e = elbeAt(tt), ph = phase(tt + OFFSET[i], e);
        if (ph.O > 0.01) openDiff = Math.max(openDiff, Math.abs(ph.level - e));
        if (ph.I > 0.01) openDiff = Math.max(openDiff, Math.abs(ph.level));
        minTop = Math.min(minTop, 5.5 - Math.max(ph.level, e, 0));
      }
      const r1 = (v) => +v.toFixed(2);
      return {
        levelDiffWhenGateOpen_m: r1(openDiff),                                     // 扉が開いている間の両側の水位差(0 = 先にそろえてから開く)
        gateTopOverWater_m: r1(minTop),                                             // 扉の天端と最も高い水位の差
        recessEndGap_m: CH.map((c) => r1(c.dp - (c.w + 0.5 + 1.5))),                // 開いた扉の端と扉室の奥の壁の隙間
        recessSideGap_m: CH.map((c) => r1(c.h - c.t / 2)),                          // 扉と扉室の両側の壁の隙間
        islandWallBehindRecess_m: [r1(S2.x0 - S2.dp - S1.x1), r1(B2.x0 - (B1.x1 + B1.dp)), r1(B1.x0 - (NEW.x1 + 47.5))],   // 扉室の奥と隣の閘室・建設中の扉室の間の壁の厚さ
        tideRange_m: [r1(-D.tide), r1(D.tide)], groundLevel: D.ground,
      };
    }
    apply();
    U.bake(THREE, group, { dynamic: gates.flatMap((g) => [g.O, g.I]), live: [M.accent] });
    const at = (x, y, z) => V((x - XC) * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      get stage() { const ph = last[2]; return ph ? `${CH[2].name}: ${STEP_TEXT[ph.step]}` : ""; },
      shots: {
        heads: { label: "エルベ側の扉(大閘門)", target: [40, 0, 10], pos: [140, 60, -110] },
        build: { label: "建設中の第 5 閘室", target: [-88, -4, 200], pos: [-200, 80, 300] },
        quay: { label: "軍用の待機岸壁", target: [170, 6, 440], pos: [80, 60, 540] },
      },
    };
  }

  DreamAssets.fac.register("kiel", {
    section: 2, title: "キール運河(ブルンスビュッテル閘門)", kind: "STRATEGIC FACILITY · 2 水門・閘門・防潮堤",
    desc: "北海とバルト海を結ぶ運河のエルベ側の入口。大小 4 つの閘室が並び、引き戸式の扉で潮の高さの違うエルベと運河の間に船を通す。島では第 5 閘室を建設中。運河側に軍用の待機岸壁と監視塔を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/kiel.js"], ["大きさ", "実寸 460 × 640 m を 0.26 倍 × 表示 3.0"], ["誇張", "エルベの潮位差 2.5 倍(約 3 m → 7.5 m)。構造物は実寸"], ["省略", "船・タグボート・人・係船柱・大閘門の中間の扉"], ["動作", "閘室ごとに時間差で 1 巡 34 秒(扉の開閉と水位合わせ)、潮の満ち引き 60 秒"], ["近未来化", "軍用の待機岸壁(倉庫・覆土した弾薬庫・柵)、監視塔 2 基"]],
    dist: 1000, target: 20, tokenAt: [360, 0, 240],
    make: (THREE) => kiel(THREE, { r: 105 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["通航", () => a.setState("run"), () => a.state === "run"], ["通航停止", () => a.setState("stop"), () => a.state === "stop"]],
    caption: (a) => (a.state === "run" ? a.stage : "通航停止 — 扉と水位をその場で止める"),
  });
})();
