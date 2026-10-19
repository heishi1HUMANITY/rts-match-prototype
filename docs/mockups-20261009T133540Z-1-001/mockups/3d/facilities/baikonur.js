// 戦略施設トークン「バイコヌール宇宙基地」(カザフスタン。第 1 発射場「ガガーリンの発射台」)の詳細版モデル(試作)。
// 発射台(巨大な排炎の掘割の縁に張り出した発射台、ロケットを抱く 4 本の支持腕、左右から起き上がる整備塔 2 基とケーブル塔 2 基)と、
// 組立試験棟(MIK)から来る線路とロケットを横倒しで運ぶ起立架を、発射台のまわり約 390 × 280 m で切り取る(MIK と掘割の先は切り取りの外)。
// 象徴: ソユーズ(R-7 系、4 本の円錐の補助ロケット)と整備塔。発射台まわり(ロケット・整備塔・支持腕・起立架・輪)は 4.4 倍。ゲーム視点で最も高く大きい塊にするため、縮尺 K を上げて切り取りを狭めた。
// 動き(実物の打ち上げ準備の手順): 横倒しで発射台に着く → 起立架がロケットを起こす → 支持腕が閉じて抱く → 起立架が倒れて戻る → 整備塔とケーブル塔が起き上がる。逆順で戻す。
// 簡略化: 待機中の整備塔とケーブル塔は外へ 25° 傾くまで(実物は水平まで倒れる。切り取りに収めるため)。横倒しのロケットは発射台の脇の線路に着いた所から始める。
// 近未来化: 再使用の 1 段目の着陸パッド(防爆の壁、照明塔)。
// 省略: 車両・人・小さな機材、地下の管制室(入口の盛土だけ)、送電線。
//
//   const a = DreamAssets.fac.defs.baikonur.make(THREE)(制圧圏 r = 95)
// 座標(m): 発射台の中心が原点、掘割は +x、線路と MIK は -x。地面 y = 0。
(function () {
  const K = 0.26;
  const D = { x0: -265, x1: 125, z0: -140, z1: 140, base: -50, pit: -40, EX: 2, PS: 2.2, P: [-14, 3], off0: 0, SEC: 20, open: 0.436 };
  // 発射台まわり(輪・支持腕・整備塔・起立架・ロケット)は pad グループで PS 倍。中の寸法はロケット 2 倍の座標(合わせて実物の 4.4 倍)
  // open = 待機中の整備塔とケーブル塔の外への傾き(25°。実物は水平まで倒れるが、切り取りに収めるため)
  const PH = [0.08, 0.45, 0.57, 0.77];   // 準備 | 起立 | 支持腕 | 起立架を戻す | 整備塔が起きる
  const ARM = { r: 12, closed: 0.168, open: -0.35, len: 31 };
  const BOOST = [[1.34, 0], [1.34, 2], [0.95, 9], [0.22, 19.6], [0, 20.2]];   // 補助ロケットの断面 [半径, 高さ](実寸)

  function baikonur(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    const group = new THREE.Group(); group.name = "baikonur";
    const XC = (D.x0 + D.x1) / 2;
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(-XC * K, -D.base * K, 0); group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, tube, beam, prism, lattice, arcLoft, closedLoft } = k;
    const lathe = (pts, n = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);

    // ── 地面: 草原の陸(掘割の穴あき)、掘割の底と排炎の斜面、発射台のまわりのコンクリート ──
    const PIT = [[-25, -32], [60, -32], [100, -55], [D.x1, -55], [D.x1, 55], [100, 55], [60, 32], [-25, 32]];
    add(prism([[D.x0, D.z0], [-25, D.z0], [-25, D.z1], [D.x0, D.z1]], D.base, 0), M.land, world);
    for (const s of [-1, 1]) add(prism([[-25, s * 32], [60, s * 32], [100, s * 55], [D.x1, s * 55], [D.x1, s * D.z1], [-25, s * D.z1]], D.base, 0), M.land, world);   // 掘割の両側(穴あきの押し出しは壁の向きが崩れるので分ける)
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2, { x: XC });
    add(prism(PIT, D.base, D.pit), M.mid, world);
    add(closedLoft([-30, 30].map((z) => [V(-25, D.pit, z), V(55, D.pit, z), V(-25, -10, z)])), M.dark, world);   // 排炎の斜面(炎を +x の掘割へ逃がす)
    for (let i = 0; i < 2; i++) add(box(3, 1.2, 106), M.light, world, { x: 110 + i * 25, y: D.pit + 0.6, z: 0, edges: false });   // 掘割の底の横つなぎ
    for (const [x0, x1, z0, z1] of [[-110, -25, -105, 105], [-25, 60, 32, 105], [-25, 60, -105, -32]]) add(box(x1 - x0, 0.4, z1 - z0), M.light, world, { x: (x0 + x1) / 2, y: 0.2, z: (z0 + z1) / 2 });
    const pad = new THREE.Group(); pad.scale.setScalar(D.PS); world.add(pad);
    add(arcLoft([[8, 0], [14, 0], [14, 2], [8, 2]], 0, Math.PI * 2, 32), M.mid, pad);   // 発射台の輪(ロケットの下に穴)
    add(box(225, 0.25, 12), M.mid, world, { x: -152, y: 0.12, z: 0, edges: false });          // 線路の道床
    for (const z of [-0.76 * D.PS, 0.76 * D.PS]) add(box(225, 0.3, 0.3), M.dark, world, { x: -152, y: 0.4, z, edges: false });
    // 地下の管制室の入口(盛土と出入口)、推進剤のタンク(横置き)
    add(prism([[-230, 100], [-180, 100], [-170, 128], [-240, 128]], 0, 6), M.land, world);
    add(box(10, 5, 4), M.light, world, { x: -205, y: 2.5, z: 98 });
    add(box(4, 3.4, 0.4), M.dark, world, { x: -205, y: 1.7, z: 95.9, edges: false });
    const tankG = cyl(3, 22, 14); tankG.rotateZ(Math.PI / 2);
    for (let i = 0; i < 4; i++) { add(tankG, M.body, world, { x: 88, y: 4.2, z: 78 + i * 9 }); for (const e of [-7, 7]) add(box(1.2, 1.6, 6.5), M.dark, world, { x: 88 + e, y: 0.8, z: 78 + i * 9 }); }

    // ── 近未来化: 再使用の 1 段目の着陸パッド ──
    add(cyl(22, 0.8, 32), M.light, world, { x: 92, y: 0.4, z: -100 });
    add(new THREE.RingGeometry(12, 15, 32).rotateX(-Math.PI / 2), M.accent, world, { x: 92, y: 0.85, z: -100, edges: false });
    for (const r of [-0.6, 0.6]) add(box(18, 1.2, 3, ), M.dark, world, { x: 92, y: 0.9, z: -100, ry: r + Math.PI / 4, edges: false });
    add(arcLoft([[25, 0], [27.5, 0], [27.5, 7], [25, 7]], Math.PI * 0.9, Math.PI * 1.6, 16), M.mid, world, { x: 92, z: -100 });   // 防爆の壁(発射台の側)
    for (const [x, z] of [[62, -128], [118, -124]]) { lattice(world, V(x, 0, z), 34, 1.6, 0.8, 4, 0.25, M.mid); add(box(3, 1, 1.4), M.lamp, world, { x, y: 35, z, edges: false }); }

    // ── 支持腕(4 本。補助ロケットの肩を抱く。下に釣合い重り) ──
    const arms = [];
    for (let q = 0; q < 4; q++) {
      const phi = Math.PI / 4 + (q * Math.PI) / 2, outer = new THREE.Group();
      outer.position.set(ARM.r * Math.cos(phi), 2, ARM.r * Math.sin(phi)); outer.rotation.y = -phi; pad.add(outer);
      const arm = new THREE.Group(); outer.add(arm);
      add(box(1.4, 31, 1.8), M.light, arm, { y: 15.5 });
      for (let i = 1; i < 6; i++) add(box(1.6, 0.4, 2.0), M.dark, arm, { y: i * 5, edges: false });
      add(box(2.4, 1.6, 2.6), M.dark, arm, { x: -0.6, y: 30.6 });   // 抱く爪
      add(box(2.6, 3.4, 2.6), M.mid, arm, { y: -1.2 });               // 釣合い重り
      arms.push(arm);
    }

    // ── ロケット(ソユーズ。実寸の 2 倍)。起立架の回転軸 P のまわりで横倒し ⇄ 起立 ──
    const carriage = new THREE.Group(); pad.add(carriage);   // 線路を走る(x のずれ)
    const rPivot = new THREE.Group(); rPivot.position.set(D.P[0], D.P[1], 0); carriage.add(rPivot);
    const rocket = new THREE.Group(); rocket.position.set(-D.P[0], 2 - D.P[1], 0); rocket.scale.setScalar(D.EX); rPivot.add(rocket);
    add(lathe([[0, 0], [0.9, 0], [1.07, 1], [1.33, 12], [1.47, 19], [1.47, 27.8], [1.3, 28.3], [0, 28.3]]), M.light, rocket);   // 中央ブロック
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; tube(rocket, V(1.25 * Math.cos(a), 28.3, 1.25 * Math.sin(a)), V(1.25 * Math.cos(a + 0.4), 30.5, 1.25 * Math.sin(a + 0.4)), 0.07, M.dark); }   // 段間のトラス
    add(lathe([[0, 30.5], [1.33, 30.5], [1.33, 37.2], [0, 37.2]]), M.light, rocket);   // 3 段目
    add(lathe([[0, 37.2], [1.5, 37.2], [1.5, 42], [1.1, 45.3], [0.45, 47], [0, 47]]), M.body, rocket);   // フェアリング
    add(cyl(1.52, 0.6, 16), M.accent, rocket, { y: 40, edges: false });
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; add(box(0.08, 1.6, 1.2), M.light, rocket, { x: 1.9 * Math.cos(a), y: 38.6, z: 1.9 * Math.sin(a), ry: -a }); }   // 格子翼
    add(cyl(0.22, 3.6, 8), M.light, rocket, { y: 48.8 });   // 緊急脱出塔
    add(new THREE.ConeGeometry(0.35, 1.0, 8), M.dark, rocket, { y: 51.1 });
    const nozzle = new THREE.ConeGeometry(0.32, 0.9, 8); nozzle.rotateX(Math.PI);
    for (const [x, z] of [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]]) add(nozzle, M.dark, rocket, { x, y: -0.45, z, edges: false });
    for (let q = 0; q < 4; q++) {   // 補助ロケット 4 本(円錐の先が中央ブロックに寄る)
      const phi = Math.PI / 4 + (q * Math.PI) / 2, g = new THREE.Group();
      g.position.set(2.6 * Math.cos(phi), 0, 2.6 * Math.sin(phi)); g.rotation.y = -phi; rocket.add(g);
      const b = new THREE.Group(); b.rotation.z = 0.05; g.add(b);
      add(lathe([[0, 0], ...BOOST]), M.light, b);
      add(box(0.1, 2.2, 1.6), M.light, b, { x: 1.6, y: 1.4 });   // 空気舵
      for (const [x, z] of [[0.4, 0.4], [-0.4, 0.4], [0.4, -0.4], [-0.4, -0.4]]) add(nozzle, M.dark, b, { x, y: -0.45, z, edges: false });
    }

    // ── 起立架(横倒しのロケットを支える長い梁。ロケットと同じ軸 P で回る)と運搬台車 ──
    const ePivot = new THREE.Group(); ePivot.position.set(D.P[0], D.P[1], 0); carriage.add(ePivot);
    for (const z of [-4.5, 4.5]) beam(ePivot, V(2, 0, z), V(2, 92, z), 2.0, M.mid);
    for (let i = 0; i <= 9; i++) { const y = 2 + i * 10; beam(ePivot, V(2, y, -4.5), V(2, y, 4.5), 1.0, M.mid); if (i < 9) beam(ePivot, V(2, y, -4.5), V(2, y + 10, 4.5), 0.7, M.mid); }
    for (const y of [18, 46, 74]) beam(ePivot, V(2, y, 0), V(5.6, y, 0), 1.4, M.dark);   // 受け台
    add(box(96, 3, 8), M.light, carriage, { x: D.P[0] - 52, y: 2.6, z: 0 });   // 台車と起立架の軸受け
    for (let i = 0; i < 6; i++) add(box(6, 1.6, 9), M.dark, carriage, { x: D.P[0] - 10 - i * 17, y: 0.9, z: 0, edges: false });
    for (const z of [-5.6, 5.6]) add(box(3, 3, 1.2), M.dark, carriage, { x: D.P[0] - 2, y: D.P[1], z });

    // ── 整備塔 2 基(±z の側へ外に傾いて待ち、起き上がって囲む)とケーブル塔 2 基 ──
    const towers = [];
    for (const s of [-1, 1]) {
      add(box(10, 4, 8), M.mid, pad, { y: 2, z: s * 18 });
      const g = new THREE.Group(); g.position.set(0, 4, s * 18); pad.add(g);
      lattice(g, V(0, 0, 0), 92, 3, 3, 9, 0.5, M.light);
      for (const y of [48, 58, 68, 78, 88]) add(box(8, 0.6, 9), M.light, g, { y, z: -s * 7.5 });
      for (const y of [48, 68, 88]) add(box(8.2, 0.3, 9.2), M.accent, g, { y: y - 0.45, z: -s * 7.5, edges: false });
      towers.push({ g, s, lie: s * D.open });
      add(box(6, 2.6, 6), M.mid, pad, { x: 16, y: 1.3, z: s * 16 });
      const m = new THREE.Group(); m.position.set(16, 2.6, s * 16); pad.add(m);
      lattice(m, V(0, 0, 0), 70, 1.6, 1.6, 7, 0.35, M.mid);
      add(box(2, 1.2, 6), M.dark, m, { y: 56, z: -s * 3 });
      towers.push({ g: m, s, lie: s * D.open });
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 95, M.ring, M.disc);

    // ── 姿勢: t = 0(線路の上で横倒し)〜 1(起立して整備塔に囲まれる) ──
    const ease = (x) => x * x * (3 - 2 * x), seg = (t, a, b) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));
    const pose = (t) => ({ off: D.off0 * (1 - seg(t, 0, PH[0])), rocket: (Math.PI / 2) * (1 - seg(t, PH[0], PH[1])), arm: ARM.open + (ARM.closed - ARM.open) * seg(t, PH[1], PH[2]), erector: (Math.PI / 2) * (t < PH[2] ? 1 - seg(t, PH[0], PH[1]) : seg(t, PH[2], PH[3])), tower: 1 - seg(t, PH[3], 1) });
    let state = opts.state ?? "rollout", t = state === "ready" ? 1 : 0;
    function apply() {
      const p = pose(t);
      carriage.position.x = p.off; rPivot.rotation.z = p.rocket; ePivot.rotation.z = p.erector;
      for (const a of arms) a.rotation.z = p.arm;
      for (const w of towers) w.g.rotation.x = w.lie * p.tower;
    }
    apply();
    function update(dt) {
      if (state === "erecting") { t = Math.min(1, t + dt / D.SEC); if (t >= 1) state = "ready"; }
      if (state === "stowing") { t = Math.max(0, t - dt / D.SEC); if (t <= 0) state = "rollout"; }
      apply();
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "rollout" || s === "ready") { state = s; t = s === "ready" ? 1 : 0; apply(); }
      else if (s === "erecting" || s === "stowing") state = s;
    }
    const stage = () => {
      if (state !== "erecting" && state !== "stowing") return "";
      return t < PH[0] ? "起立架を発射台の軸受けにつなぐ" : t < PH[1] ? "起立架がロケットを起こす" : t < PH[2] ? "支持腕が閉じて抱く" : t < PH[3] ? "起立架を倒して戻す" : "整備塔が起き上がる";
    };
    // 確認値: 閉じた支持腕と補助ロケット、整備塔の踊り場とロケット、横倒しのロケットと起立架・地面、切り取りの端
    const boostR = (yl) => { for (let i = 0; i < BOOST.length - 1; i++) { const [r0, y0] = BOOST[i], [r1, y1] = BOOST[i + 1]; if (yl <= y1) return r0 + ((r1 - r0) * (yl - y0)) / (y1 - y0); } return 0; };
    function check() {
      let armGap = Infinity;
      for (let h = 3; h <= 2 + ARM.len * Math.cos(ARM.closed); h += 0.5) {   // 腕の内側の縁(先の爪は 1.8 m 内へ出る)と補助ロケットの外面(同じ方位)
        const c = ARM.r - (h - 2) * Math.tan(ARM.closed), inner = c - (h > ARM.len * Math.cos(ARM.closed) - 0.6 ? 1.8 : 0.7);
        const yl = (h - 2) / D.EX, outer = (2.6 - Math.sin(0.05) * yl + boostR(yl)) * D.EX;
        armGap = Math.min(armGap, inner - outer);
      }
      const ext = (2.6 * Math.SQRT1_2 + 1.34) * D.EX, lowest = D.P[1] + (-D.P[0] - ext), noseDy = 2 + 51.6 * D.EX - D.P[1];
      const r1 = (v) => +(v * D.PS).toFixed(2);   // pad の座標 → m
      return {
        armToBooster_m: r1(armGap),                                   // 閉じた支持腕(爪を含む)と補助ロケットの面の最小の隙間
        platformToFairing_m: r1(18 - 7.5 - 4.5 - 1.5 * D.EX),          // 整備塔の踊り場の先とフェアリング(半径 1.5 m × 2)
        lyingRocketToGround_m: r1(lowest),                             // 横倒しのロケットの最も低い所と地面
        lyingRocketToErector_m: r1(lowest - (D.P[1] + 5.6)),           // 同、起立架の受け台の上面
        noseToCutEdge_m: +((D.off0 + D.P[0] - noseDy) * D.PS - D.x0).toFixed(2),   // 搬入位置のロケットの先端と切り取りの端(MIK は外)
        openTowersToRocketPath_m: r1(18 - 3 * Math.cos(D.open) - ext),           // 外へ傾いた整備塔の内側の面とロケットの通り道(z 方向、根元)
        openTowerBottomAboveGround_m: r1(4 - 3 * Math.sin(D.open)),              // 傾いた整備塔の外側の下の角と地面
        openTowersReach_m: r1(18 + 3 + 96 * Math.sin(D.open)),                   // 傾いた整備塔の先の z(切り取りの端 140 m に収まる)
      };
    }

    U.bake(THREE, group, { dynamic: [carriage, rPivot, ePivot, ...arms, ...towers.map((w) => w.g)], live: [M.accent], also: [M.lamp] });
    return {
      group, update, setState, check, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      get state() { return state; }, get progress() { return t; }, get stage() { return stage(); },
      at: (x, y, z) => V((x - XC) * K, (y - D.base) * K, z * K),
      shots: {
        pad: { label: "発射台(起立)", target: [0, 100, 0], pos: [280, 180, 300] },
        pit: { label: "排炎の掘割", target: [80, -10, 0], pos: [280, 110, 190] },
        rail: { label: "線路と起立架(搬入)", target: [-120, 25, 0], pos: [40, 130, 230] },
      },
    };
  }

  DreamAssets.fac.register("baikonur", {
    section: 9, title: "バイコヌール宇宙基地", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "ガガーリンが飛び立った第 1 発射場。巨大な排炎の掘割に張り出した発射台で、4 本の支持腕がソユーズを抱き、整備塔が左右から起き上がって囲む。組立試験棟から線路で横倒しのまま運び、発射台で起こす",
    info: [["ファイル", "mockups/3d/facilities/baikonur.js"], ["大きさ", "発射台のまわり 390 × 280 m を 0.26 倍 × 表示 3.0"], ["誇張", "発射台まわり(ロケット・整備塔・支持腕・起立架・輪)4.4 倍(ロケット 50 → 227 m、整備塔 211 m)、掘割の発射台側を広げた"], ["簡略化", "待機中の整備塔は外へ 25° 傾くまで(実物は水平)"], ["省略", "MIK(切り取りの外)、車両・人・小さな機材、地下の管制室、送電線"], ["動作", "横倒しで到着 → 起立 → 支持腕 → 起立架を戻す → 整備塔(20 秒)"], ["近未来化", "再使用の 1 段目の着陸パッド"]],
    dist: 1100, target: 120, tokenAt: [360, 0, 300],
    make: (THREE) => baikonur(THREE, { r: 95 }),
    actLabel: "STATE · 状態", progress: true,
    actions: (a) => [["搬入(横倒し)", () => a.setState("rollout"), () => a.state === "rollout"], ["起立 ▶", () => a.setState("erecting"), () => a.state === "erecting"], ["発射準備完了", () => a.setState("ready"), () => a.state === "ready"], ["◀ 戻す", () => a.setState("stowing"), () => a.state === "stowing"]],
    caption: (a) => (a.stage ? (a.state === "erecting" ? "起立中 — " : "格納中 — ") + a.stage : ""),
  });
})();
