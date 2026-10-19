// 戦略施設トークン「チェルノブイリ新安全閉じ込め構造物(NSC)」(ウクライナ)の詳細版モデル(試作)。
// 実物の寸法(アーチの高さ 108 m・幅 257 m・長さ 162 m、トラスの厚さ 12 m)をメートルで組み、K 倍して模型にする。
// アーチは 4 号機を覆い、西の端は 3 号機の建屋に接する。北側にタービン建屋(1〜4 号機で共通の長い建屋。切り取り)。
// 誇張: アーチの外装の継ぎ目(縦のリブ・横の継ぎ目)を太く。アーチ本体と平面の配置は実寸(もともと巨大なので誇張しない)。
// 省略: 車両・人・遠隔操作ロボット(実寸では小さすぎる)。旧排気筒は 2013 年に撤去済みなので置かない。
// 近未来化(施設リストの案): 損傷部の色違い補修パネル、作業足場、周辺の太陽光発電所。
// 状態: "damaged"(2025 年 2 月のドローン攻撃で屋根に穴。現状)/ "repairing"(足場と仮覆い)/ "repaired"(色違いの補修パネル)
//
// アーチの軸は z 方向、+x が北(タービン建屋)、-x が南(太陽光発電所)。
(function () {
  const K = 0.28;
  const D = { x0: -260, x1: 300, z0: -240, z1: 180, base: -8, ground: 0 };
  const A = { span: 257, h: 108, len: 162, t: 12, foot: 6 };
  A.R = (A.h ** 2 + (A.span / 2) ** 2) / (2 * A.h);   // 外面の円の半径(弦 257、矢高 108)
  A.yc = A.foot + A.h - A.R;                           // 円の中心の高さ
  A.a0 = Math.asin(A.span / 2 / A.R);                  // 脚元の角度
  const HOLE = { a: 0.22, z: 18, w: 16 };              // 損傷部(外面の角度、軸方向の位置、大きさ)

  function chernobylNsc(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.silver = M.lambert(0xd5dce3);
    M.patch = M.lambert(0xcbbfa8);   // 補修パネル(色違い)
    M.scorch = M.lambert(0x5b6168);
    const group = new THREE.Group(); group.name = "chernobyl_nsc";
    const XC = (D.x0 + D.x1) / 2, ZC = (D.z0 + D.z1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, -ZC * K); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, prism, closedLoft, beam } = k;

    // ── 台座 ──
    add(prism([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], D.base, D.ground), M.land, world);
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base, { x: XC, z: ZC });
    add(box(380, 0.2, 260), M.light, world, { x: 20, y: 0.1, z: -20, edges: false });   // 構内の舗装

    // ── NSC: アーチの殻(厚さ 12 m のトラスを外装で包んだもの)、脚元の基礎梁、両端の妻壁 ──
    const onArc = (r, a, z) => V(r * Math.sin(a), A.yc + r * Math.cos(a), z);
    const archLoft = (rIn, rOut, a0, a1, z0, z1, n = 40) => closedLoft(Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [onArc(rIn, a, z0), onArc(rOut, a, z0), onArc(rOut, a, z1), onArc(rIn, a, z1)];
    }));
    const nsc = new THREE.Group(); world.add(nsc);
    add(archLoft(A.R - A.t, A.R, -A.a0, A.a0, -A.len / 2, A.len / 2, 48), M.silver, nsc);
    for (const s of [-1, 1]) add(box(16, A.foot, 230), M.light, nsc, { x: s * (A.span / 2 - 5), y: A.foot / 2, z: 20 });   // 基礎梁(据え付けで滑らせた軌道)
    // 外装の縦のリブ(13.5 m ごと)と横の継ぎ目
    for (let i = 0; i <= 12; i++) { const z = -A.len / 2 + (i * A.len) / 12; add(archLoft(A.R - 0.2, A.R + 1.4, -A.a0, A.a0, z - 0.8, z + 0.8, 48), M.steel, nsc); }
    for (const a of [-1.15, -0.8, -0.45, -0.15, 0.15, 0.45, 0.8, 1.15]) {
      const p = onArc(A.R + 0.5, a, 0);
      add(box(1.2, 1.0, A.len), M.steel, nsc, { x: p.x, y: p.y, rz: -a, edges: false });
    }
    // 妻壁(アーチの内側を塞ぐ壁。縦の外装と柱形)
    const inner = Array.from({ length: 41 }, (_, i) => { const a = -A.a0 + (2 * A.a0 * i) / 40; return onArc(A.R - A.t, a, 0); });
    const endShape = new THREE.Shape([new THREE.Vector2(inner[0].x, A.foot), ...inner.map((p) => new THREE.Vector2(p.x, Math.max(A.foot, p.y))), new THREE.Vector2(inner[40].x, A.foot)]);
    const endG = new THREE.ExtrudeGeometry(endShape, { depth: 3, bevelEnabled: false });
    for (const s of [-1, 1]) {
      add(endG, M.light, nsc, { z: s > 0 ? A.len / 2 - 4 : -A.len / 2 + 1 });
      for (let i = -4; i <= 4; i++) {
        const x = i * 26, top = A.yc + Math.sqrt((A.R - A.t) ** 2 - x * x) - A.foot;
        add(box(2.2, top, 1.6), M.mid, nsc, { x, y: A.foot + top / 2, z: s * (A.len / 2 - 0.2) });
      }
      add(box(A.span - 40, 3, 1.6), M.mid, nsc, { y: 40, z: s * (A.len / 2 - 0.2) });
    }

    // ── 損傷部と補修(状態で切り替え) ──
    const hp = onArc(A.R + 0.2, HOLE.a, HOLE.z);
    const dmg = new THREE.Group(), rep = new THREE.Group(), fixed = new THREE.Group(); nsc.add(dmg, rep, fixed);
    const da = (m) => m / A.R;   // 外面に沿った長さ → 角度
    const skin = (r0, r1, w, z0, z1, aOff = 0) => archLoft(A.R + r0, A.R + r1, HOLE.a + aOff - da(w / 2), HOLE.a + aOff + da(w / 2), z0, z1, 6);   // 外面に沿った曲面の板
    add(skin(0.1, 0.5, HOLE.w * 2.2, HOLE.z - HOLE.w, HOLE.z + HOLE.w), M.scorch, dmg, { edges: false });   // 焦げ跡
    add(skin(0.2, 0.9, HOLE.w, HOLE.z - HOLE.w * 0.4, HOLE.z + HOLE.w * 0.4), M.dark, dmg);                 // 穴
    for (const [off, z, a] of [[-6, 4, 0.4], [5, -3, -0.7], [2, 6, 1.2]]) { const p = onArc(A.R + 1.2, HOLE.a + da(off), HOLE.z + z); add(box(5, 0.4, 1.2), M.steel, dmg, { x: p.x, y: p.y, z: p.z, rz: -(HOLE.a + da(off)), ry: a }); }   // めくれた外装
    // 作業足場(穴の上の門型の足場と仮覆い。屋根の接平面に置き、脚は外面まで下ろす)
    const scaf = new THREE.Group(); scaf.position.copy(hp); scaf.rotation.z = -HOLE.a; rep.add(scaf);
    const SC = { w: HOLE.w * 1.6, d: HOLE.w * 1.4, h: 10 };
    for (const x of [-SC.w / 2, 0, SC.w / 2]) for (const z of [-SC.d / 2, SC.d / 2]) beam(scaf, V(x, -(x * x) / (2 * A.R) - 0.3, z), V(x, SC.h, z), 0.8, M.mid);
    for (const z of [-SC.d / 2, SC.d / 2]) beam(scaf, V(-SC.w / 2, SC.h, z), V(SC.w / 2, SC.h, z), 0.8, M.mid);
    for (const x of [-SC.w / 2, SC.w / 2]) { beam(scaf, V(x, SC.h, -SC.d / 2), V(x, SC.h, SC.d / 2), 0.8, M.mid); beam(scaf, V(x, 0, -SC.d / 2), V(x, SC.h, SC.d / 2), 0.4, M.mid); }
    add(box(SC.w + 2, 0.6, SC.d + 2), M.body, scaf, { y: SC.h + 0.7 });                              // 仮覆い
    add(box(SC.w + 2.2, 0.4, SC.d + 2.2), M.accent, scaf, { y: SC.h + 0.2, edges: false });
    add(skin(0.2, 0.9, HOLE.w, HOLE.z - HOLE.w * 0.4, HOLE.z + HOLE.w * 0.4), M.dark, rep);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {                                          // 色違いの補修パネル(3 × 3)
      const w = HOLE.w * 0.62, z = HOLE.z + (j - 1) * HOLE.w * 0.6;
      add(skin(0.2, 0.7, w, z - HOLE.w * 0.28, z + HOLE.w * 0.28, da((i - 1) * HOLE.w * 0.66)), (i + j) % 2 ? M.patch : M.mid, fixed);
    }

    // ── 3 号機の建屋(アーチの西端に接する)、タービン建屋(北。切り取り)、付属棟 ──
    add(box(110, 50, 90), M.body, world, { x: -10, y: 25, z: -127 });
    add(box(64, 22, 60), M.light, world, { x: -10, y: 61, z: -130 });                                  // 中央ホール
    add(box(50, 6, 30), M.mid, world, { x: -10, y: 75, z: -130 });
    add(box(85, 44, 90), M.light, world, { x: 92.5, y: 22, z: -127 });                                 // 脱気器棟
    for (const y of [15, 30]) add(box(85.4, 2.4, 90.4), M.glass, world, { x: 92.5, y, z: -127, edges: false });
    add(box(52, 30, 420), M.body, world, { x: 166, y: 15, z: -30 });                                  // タービン建屋
    add(box(52, 3, 420), M.light, world, { x: 166, y: 31.5, z: -30 });
    for (let i = 0; i < 15; i++) add(box(1.2, 30, 1.2), M.light, world, { x: 192.6, y: 15, z: -235 + i * 29.3 });
    add(box(0.5, 3, 416), M.glass, world, { x: 192.4, y: 21, z: -30, edges: false });
    add(box(60, 24, 40), M.body, world, { x: 10, y: 12, z: 112 });                                    // 付属棟(東)
    for (const y of [7, 15]) add(box(60.4, 2.2, 40.4), M.glass, world, { x: 10, y, z: 112, edges: false });
    add(box(60.6, 0.8, 40.6), M.accent, world, { x: 10, y: 21.5, z: 112, edges: false });

    // ── 近未来化: 太陽光発電所(南。南向きに傾けたパネルの列、パワーコンディショナと変電設備)──
    for (let i = 0; i < 12; i++) {
      const x = -250 + i * 8.6;
      add(box(4.6, 0.25, 360), M.glass, world, { x, y: 2.2, z: -40, rz: 0.5 });
      for (const z of [-200, -40, 120]) add(box(0.3, 2.2, 0.3), M.mid, world, { x: x + 1.2, y: 1.1, z, edges: false });
    }
    for (const z of [-200, -40, 120]) add(box(6, 3, 3), M.light, world, { x: -144, y: 1.5, z });
    add(box(14, 0.4, 10), M.light, world, { x: -144, y: 0.2, z: 160 }); add(box(6, 5, 4), M.mid, world, { x: -144, y: 2.7, z: 160 });

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 108, M.ring, M.disc);
    let state = opts.state ?? "damaged";
    const apply = () => { dmg.visible = state === "damaged"; rep.visible = state === "repairing"; fixed.visible = state === "repaired"; };
    function setState(s) { if (["damaged", "repairing", "repaired"].includes(s)) state = s; apply(); }
    function update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; }
    const r1 = (v) => +v.toFixed(1);
    function check() {
      return {
        archTop_m: r1(A.yc + A.R), archSpanAtFoot_m: r1(2 * A.R * Math.sin(A.a0)),
        westEndToUnit3_m: r1(-A.len / 2 - (-127 + 45)),          // 西の妻壁と 3 号機の建屋の隙間(負 = 接して食い込む)
        archFootToTurbineHall_m: r1(166 - 26 - (A.span / 2 + 3)),     // アームの脚元の基礎梁とタービン建屋の隙間
        archFootToSolar_m: r1(-(A.span / 2 + 3) - (-250 + 8.6 * 11 + 2.3)),
        roofPatchLift_m: [0.1, 0.2],                                  // 焦げ跡・補修パネルの外面からの高さ(曲面に沿わせる。リブ 1.4 m は上に出る)
      };
    }
    // 状態ごとに組んだ部品は、焼く前に全部表示しておき(焼き込みは表示中の部品だけ対象)、焼いたあとに状態を当てる
    dmg.visible = rep.visible = fixed.visible = true;
    U.bake(THREE, group, { dynamic: [dmg, rep, fixed], live: [M.accent] });
    apply();
    const at = (x, y, z) => V((x - XC) * K, (y - D.base) * K, (z - ZC) * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        arch: { label: "アーチ(斜め)", target: [0, 50, 0], pos: [-230, 170, 300] },
        roof: { label: "屋根の損傷部", target: [hp.x, hp.y, HOLE.z], pos: [hp.x - 70, hp.y + 60, HOLE.z + 80] },
        west: { label: "3 号機と西の妻壁", target: [20, 40, -110], pos: [-150, 90, -330] },
        solar: { label: "太陽光発電所", target: [-200, 0, -40], pos: [-330, 70, 140] },
      },
    };
  }

  DreamAssets.fac.register("chernobyl_nsc", {
    section: 4, title: "チェルノブイリ NSC", kind: "STRATEGIC FACILITY · 4 エネルギー",
    desc: "4 号機を覆う高さ 108 m・幅 257 m・長さ 162 m の銀色のアーチ。2025 年のドローン攻撃で屋根に穴が開いた。損傷部の色違い補修パネルと作業足場、周辺の太陽光発電所を足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/chernobyl_nsc.js"], ["大きさ", "実寸 560 × 420 m を 0.28 倍 × 表示 3.0"], ["誇張", "外装のリブと継ぎ目を太く。アーチ本体と平面は実寸"], ["省略", "遠隔操作ロボット・車両・人。旧排気筒は撤去済み"], ["近未来化", "色違い補修パネル、作業足場、太陽光発電所"]],
    dist: 1100, target: 50, tokenAt: [420, 0, 320],
    make: (THREE) => chernobylNsc(THREE, { r: 108 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["損傷", () => a.setState("damaged"), () => a.state === "damaged"], ["補修中", () => a.setState("repairing"), () => a.state === "repairing"], ["補修済", () => a.setState("repaired"), () => a.state === "repaired"]],
    caption: (a) => (a.state === "damaged" ? "屋根に穴(2025 年 2 月のドローン攻撃)" : a.state === "repairing" ? "補修中 — 足場と仮覆い" : ""),
  });
})();
