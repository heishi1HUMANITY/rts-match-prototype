// 戦略施設トークン「ピトゥフィク宇宙基地」(グリーンランド、旧チューレ空軍基地)の詳細版モデル(試作)。
// 北極越えのミサイル早期警戒レーダー(固定の 2 面のフェーズドアレイ。各面は後ろへ 20° 傾き、2 面は 120° に開く)の建物を主役に、台地の上を約 400 × 340 m で切り取る。
// 台地の下の端に飛行場の滑走路の一部だけを帯で残す(実物の飛行場・港・町はレーダーから十数 km 離れているので切り取りの外)。
// 象徴: レーダーの建物 4 倍(高さ 32 → 128 m、面の幅 31 → 124 m)。ゲーム視点で最も高く大きい塊にするため、縮尺 K を上げて切り取りを狭めた。+z を北にして、アレイの面がゲーム視点に向くように置いた。
// アレイは固定(回るアンテナは無い)。状態: 現在 / 近未来化(3 面目のアレイ棟と衛星地上局のレドーム)。
// 省略: 航空機・車両・人、港・燃料タンク・町(切り取りの外)、送電線。
//
//   const a = DreamAssets.fac.defs.pituffik.make(THREE)(制圧圏 r = 100)
// 座標(m): 中心が原点、+z が北(レーダーの面の向き)、-z が南(滑走路の帯)。台地の下の地面 y = 0、台地の上 y = 30。
(function () {
  const K = 0.25;
  const D = { x0: -200, x1: 200, z0: -170, z1: 170, base: -14, plateau: 30, edge: [-125, -95], EX: 4, R: [0, 50] };
  const RAD = { W: 31, H: 32, tilt: (20 * Math.PI) / 180, prow: 18, back: -14, ar: 12.5, annex: 16 };   // レーダーの建物(実寸)

  function pituffik(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.tundra = M.lambert(0xd3cfc7);   // 夏のツンドラの砂利(白いレーダーを浮かせる)
    const group = new THREE.Group(); group.name = "pituffik";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, prism, lattice, closedLoft } = k;

    // ── 地面: 下の地面、台地(南の縁は斜面)、滑走路の帯、雪の吹きだまり、台地へ上る道 ──
    add(prism([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], D.base, 0), M.tundra, world);
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2);
    const [eb, et] = D.edge;
    add(closedLoft([[[D.x0, eb], [D.x1, eb], [D.x1, D.z1], [D.x0, D.z1]].map(([x, z]) => V(x, 0, z)), [[D.x0, et], [D.x1, et], [D.x1, D.z1], [D.x0, D.z1]].map(([x, z]) => V(x, D.plateau, z))]), M.tundra, world);
    add(box(D.x1 - D.x0, 0.3, 40), M.mid, world, { y: 0.15, z: -148, edges: false });
    for (let i = 0; i < 5; i++) add(box(30, 0.1, 1.2), M.body, world, { x: -170 + i * 85, y: 0.35, z: -148, edges: false });   // 中心線
    for (const z of [-166, -130]) add(box(D.x1 - D.x0, 0.1, 1), M.body, world, { y: 0.35, z, edges: false });
    for (const [x, z, w] of [[-120, -127, 50], [90, -126, 70]]) add(prism([[x - w / 2, z - 2], [x + w / 2, z - 2], [x + w / 2 - 8, z + 3], [x - w / 2 + 8, z + 3]], 0, 2.4), M.body, world);   // 雪の吹きだまり
    add(closedLoft([[40, -131, 0.4], [190, -101, D.plateau + 0.4]].map(([x, z, y]) => [V(x, 0, z), V(x, 0, z + 10), V(x, y, z + 10), V(x, y, z)])), M.mid, world);   // 斜面を上る道

    // ── 早期警戒レーダーの建物(4 倍)。+z へ向く 2 面、後ろの付属棟、屋上の冷却機 ──
    const rad = new THREE.Group(); rad.position.set(D.R[0], D.plateau, D.R[1]); rad.scale.setScalar(D.EX); world.add(rad);
    const cw = RAD.W * Math.cos(Math.PI / 6), cz = RAD.prow - RAD.W * Math.sin(Math.PI / 6), sh = (RAD.H * Math.tan(RAD.tilt)) / Math.cos(Math.PI / 6);
    const bot = [[0, RAD.prow], [-cw, cz], [-cw, RAD.back], [cw, RAD.back], [cw, cz]], top = bot.map(([x, z], i) => [x, i === 2 || i === 3 ? z : z - sh]);
    add(closedLoft([bot.map(([x, z]) => V(x, 0, z)), top.map(([x, z]) => V(x, RAD.H, z))]), M.body, rad);
    add(closedLoft([top.map(([x, z]) => V(x * 0.97, RAD.H, z - 0.3)), top.map(([x, z]) => V(x * 0.97, RAD.H + 1.2, z - 0.3))]), M.light, rad);   // 屋上の縁
    for (const y of [8, 16, 24]) for (const s of [-1, 1]) add(box(0.2, 0.25, RAD.back * -1 + cz - 0.4 - (y * Math.tan(RAD.tilt)) / Math.cos(Math.PI / 6)), M.mid, rad, { x: s * (cw + 0.1), y, z: (RAD.back + cz - (y * Math.tan(RAD.tilt)) / Math.cos(Math.PI / 6)) / 2, edges: false });   // 側面の階の継ぎ目
    add(box(2 * cw + 4, 14, RAD.annex), M.light, rad, { y: 7, z: RAD.back - RAD.annex / 2 });
    add(box(2 * cw + 4.2, 1.2, RAD.annex + 0.2), M.accent, rad, { y: 12.4, z: RAD.back - RAD.annex / 2, edges: false });
    add(box(2 * cw + 4.2, 1.4, RAD.annex + 0.2), M.glass, rad, { y: 8, z: RAD.back - RAD.annex / 2, edges: false });
    for (const x of [-16, -6, 4, 14]) add(box(6, 2.6, 8), M.mid, rad, { x, y: RAD.H + 2.5, z: RAD.back + 8 });
    for (const x of [-cw * 0.55, cw * 0.55]) add(box(3, 4, 0.4), M.dark, rad, { x, y: 2, z: RAD.back - RAD.annex - 0.2, edges: false });
    // アレイの面: 暗い円盤(素子の点の模様)と明るい縁。面の中心へ、面の傾きに合わせて貼る
    const dots = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
      g.fillStyle = "#26323d"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#5d6f7e";
      for (let y = 4; y < 256; y += 9) for (let x = (y / 9) % 2 ? 8 : 3.5; x < 256; x += 9) { g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    M.array = M.lambert(0xffffff, { map: dots });
    const UP = V(0, 1, 0);
    const face = (parent, mid, dir) => {   // mid = 面の下辺の中点 [x, z]、dir = 外向きの水平方向の角度
      const n = V(Math.sin(dir) * Math.cos(RAD.tilt), Math.sin(RAD.tilt), Math.cos(dir) * Math.cos(RAD.tilt)), h = RAD.H / 2 + 1;
      const c = V(mid[0] - Math.sin(dir) * h * Math.tan(RAD.tilt), h, mid[1] - Math.cos(dir) * h * Math.tan(RAD.tilt));
      const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
      const rim = add(cyl(RAD.ar + 1.2, 0.5, 32), M.light, parent, { x: c.x + n.x * 0.2, y: c.y + n.y * 0.2, z: c.z + n.z * 0.2 }); rim.quaternion.copy(q);
      const disc = add(cyl(RAD.ar, 0.5, 32), M.array, parent, { x: c.x + n.x * 0.45, y: c.y + n.y * 0.45, z: c.z + n.z * 0.45, edges: false }); disc.quaternion.copy(q);
      return c;
    };
    const fc = [face(rad, [cw / 2, (RAD.prow + cz) / 2], Math.PI / 6), face(rad, [-cw / 2, (RAD.prow + cz) / 2], -Math.PI / 6)];
    // 台地の上: 柵、管制棟、通信の鉄塔(固定のパネル)
    for (const [x0, z0, x1, z1] of [[-185, -85, 185, -85], [-185, -85, -185, 165], [185, -85, 185, 165]]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      add(box(x0 === x1 ? 0.3 : len, 2.4, x0 === x1 ? len : 0.3), M.dark, world, { x: (x0 + x1) / 2, y: D.plateau + 1.2, z: (z0 + z1) / 2, edges: false });
    }
    add(box(36, 9, 18), M.body, world, { x: 150, y: D.plateau + 4.5, z: -55 });
    add(box(36.2, 1.4, 18.2), M.glass, world, { x: 150, y: D.plateau + 6, z: -55, edges: false });
    for (const [x, z] of [[-160, 145], [160, -20]]) { lattice(world, V(x, D.plateau, z), 40, 2.2, 0.8, 5, 0.35, M.mid); add(box(4, 3, 1.2), M.light, world, { x, y: D.plateau + 36, z: z + 1.4 }); }

    // ── 近未来化: 3 面目のアレイ棟(西向き)と衛星地上局のレドーム ──
    const future = new THREE.Group(); world.add(future);
    const f3 = new THREE.Group(); f3.position.set(-160, D.plateau, 60); f3.rotation.y = -Math.PI / 2; f3.scale.setScalar(1.8); future.add(f3);
    const fb = [[-16, 10], [-16, -10], [16, -10], [16, 10]], ft = fb.map(([x, z]) => [x, z > 0 ? z - RAD.H * 0.7 * Math.tan(RAD.tilt) : z]);
    add(closedLoft([fb.map(([x, z]) => V(x, 0, z)), ft.map(([x, z]) => V(x, RAD.H * 0.7, z))]), M.body, f3);
    {
      const n = V(0, Math.sin(RAD.tilt), Math.cos(RAD.tilt)), h = RAD.H * 0.35, c = V(0, h, 10 - h * Math.tan(RAD.tilt)), q = new THREE.Quaternion().setFromUnitVectors(UP, n);
      const rim = add(cyl(10.5, 0.5, 32), M.light, f3, { x: c.x, y: c.y + n.y * 0.2, z: c.z + n.z * 0.2 }); rim.quaternion.copy(q);
      const disc = add(cyl(9.5, 0.5, 32), M.array, f3, { x: c.x, y: c.y + n.y * 0.45, z: c.z + n.z * 0.45, edges: false }); disc.quaternion.copy(q);
    }
    for (const [x, z] of [[150, 110], [165, 145], [135, 145]]) {
      add(cyl(8, 6, 16), M.light, future, { x, y: D.plateau + 3, z });
      add(cyl(8.3, 0.8, 16), M.accent, future, { x, y: D.plateau + 6.2, z, edges: false });
      add(new THREE.IcosahedronGeometry(11, 2), M.body, future, { x, y: D.plateau + 6 + 9, z });
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);
    let state = "current";
    function setState(s) { state = s; future.visible = s === "future"; }
    // 確認値(m): レーダーの高さと面、アレイの円盤が面に収まるか、建物が台地の上面に収まるか、3 面目の棟・レドームと建物の隙間
    function check() {
      const faceH = RAD.H / Math.cos(RAD.tilt), r1 = (v) => +v.toFixed(2);
      const bx = cw * D.EX, zFront = D.R[1] + RAD.prow * D.EX, zBack = D.R[1] + (RAD.back - RAD.annex) * D.EX;
      return {
        radarHeight_m: r1(RAD.H * D.EX), faceWidth_m: r1(RAD.W * D.EX), faceTilt_deg: 20, faceAngle_deg: 120,
        arrayToFaceEdge_m: r1((Math.min(RAD.W / 2, faceH / 2) - (RAD.ar + 1.2)) * D.EX),
        buildingToPlateauEdge_m: r1(Math.min(D.x1 - (bx + 2 * D.EX), D.z1 - zFront, zBack - et)),
        thirdFaceToBuilding_m: r1(-(bx + 2 * D.EX) - (-160 + 10 * 1.8)), radomeToBuilding_m: r1(135 - 11 - (bx + 2 * D.EX)),
        arrayCenter_m: fc.map((c) => [r1(c.x * D.EX + D.R[0]), r1(c.y * D.EX + D.plateau), r1(c.z * D.EX + D.R[1])]),
      };
    }
    future.visible = true;   // 隠れる部分も焼き込むため、焼くときは表示する
    U.bake(THREE, group, { dynamic: [future], live: [M.accent], also: [] });
    setState("current");
    return {
      group, setState, check, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      get state() { return state; },
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        radar: { label: "早期警戒レーダー", target: [0, 90, 50], pos: [170, 210, 360] },
        faces: { label: "アレイの面", target: [0, 100, 90], pos: [40, 110, 260] },
        rear: { label: "付属棟と滑走路の帯", target: [0, 20, -60], pos: [60, 130, -300] },
      },
    };
  }

  DreamAssets.fac.register("pituffik", {
    section: 9, title: "ピトゥフィク宇宙基地", kind: "STRATEGIC FACILITY · 9 象徴的な建造物",
    desc: "北極越えのミサイルを見張る早期警戒の拠点。台地の上に、後ろへ傾いた 2 面のフェーズドアレイを持つ巨大なレーダーの建物が立つ。近未来版は 3 面目のアレイ棟と衛星地上局を足す",
    info: [["ファイル", "mockups/3d/facilities/pituffik.js"], ["大きさ", "レーダーのまわり 400 × 340 m を 0.25 倍 × 表示 3.0"], ["誇張", "レーダーの建物 4 倍(高さ 128 m、面の幅 124 m)"], ["省略", "飛行場の大半・港・燃料タンク・町(切り取りの外)、航空機・車両・人"], ["状態", "現在 / 近未来化"], ["近未来化", "3 面目のアレイ棟(西向き)、衛星地上局のレドーム 3"]],
    dist: 1050, target: 60, tokenAt: [380, 0, 300],
    make: (THREE) => pituffik(THREE, { r: 100 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["現在", () => a.setState("current"), () => a.state === "current"], ["近未来化", () => a.setState("future"), () => a.state === "future"]],
  });
})();
