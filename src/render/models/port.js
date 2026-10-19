// 小拠点「港」の詳細版モデル(試作)。建築模型の方針(白・明灰・暗、チーム色はアクセントだけ、輪郭線)。
// 前(+z)が水面。岸壁に係留した貨物船、岸壁を走る旋回式の荷役クレーン、突堤と灯台、倉庫・事務所・油槽・コンテナ置き場。
// 稼働中はクレーンがコンテナ置き場と船のあいだで旋回してコンテナを積み下ろし、船はゆっくり揺れ、灯台が点滅する。
//
//   const port = DreamAssets.port(THREE, { r: 60 });   // r = 制圧圏の半径(small.radius)。ビューアでは表示倍率 3.0
//   scene.add(port.group); port.setTeam(0xff6a1a); port.setState("run" | "stop"); port.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3, glass: 0x5d7486, cyan: 0x1fd3ff, hazard: 0xffc83d, amber: 0xffb020 };

  function port(THREE, opts = {}) {
    const U = DreamAssets.util;
    const r = opts.r ?? 60, D = 4, QZ = 20;                                                 // 台座の高さ、岸壁の線(z)
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      body: lambert(P.body), light: lambert(P.light), mid: lambert(P.mid), dark: lambert(P.dark), glass: lambert(P.glass), accent: lambert(P.neutral),
      hull: lambert(0x4a5866), hazard: lambert(P.hazard),
      water: U.waterMaterial(THREE, { repeat: [240 / U.WATER_TILE[0], 110 / U.WATER_TILE[1]] }),   // 中央水門・川と同じ水
      lamp: basic(0xfff3c4), lampOff: basic(0x8b8f86),
      beacon: basic(P.amber), beaconOff: basic(0x6b5a35), cable: new THREE.LineBasicMaterial({ color: P.dark }),
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 12, gapSize: 9, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.08, depthWrite: false }),
    };
    const rib = U.ribTexture(THREE);   // コンテナの側面(物流ハブと共通)
    Object.assign(M, { cWhite: lambert(0xf4f6f8, { map: rib }), cLight: lambert(0xd5dce3, { map: rib }), cSlate: lambert(0x8e9aa6, { map: rib }), cAccent: lambert(P.neutral, { map: rib }) });
    const group = new THREE.Group(); group.name = "port";
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);

    // ── 水面(確認用)と台座(陸側)、岸壁、突堤 ──
    const world = new THREE.Group(); group.add(world);
    add(box(240, 0.2, 110), M.water, world, { y: 0.6, z: QZ + 55, edges: false });
    const HX = 46, HZ = 30, CZ = QZ - HZ;                                                   // 陸側の台座(前の辺が岸壁)
    add(U.slab(THREE, HX, HZ, 8, D), M.body, group, { z: CZ });
    add(U.slab(THREE, HX + 2.5, HZ + 2.5, 9, 1), M.dark, group, { z: CZ, edges: false });
    add(box(HX * 2, 2.2, 1.2), M.dark, group, { y: D - 1.4, z: QZ + 0.6, edges: false });   // 岸壁の防舷材
    const bol = []; for (let x = -40; x <= 40; x += 10) bol.push([cyl(0.7, 0.9, 1.6, 8), { x, y: D + 0.8, z: QZ - 1.6 }]);
    add(U.merge(THREE, bol), M.dark, group, { edges: false });
    add(box(HX * 2 - 4, 0.25, 1.2), M.hazard, group, { y: D + 0.15, z: QZ - 3.4, edges: false });   // 岸壁の縁の警告線
    // 突堤(右へ出て先に灯台)
    const PX = 42;
    add(box(9, D, 40), M.light, group, { x: PX, y: D / 2, z: QZ + 20 });
    for (const z of [QZ + 8, QZ + 20, QZ + 32]) add(box(9.6, 1.4, 1.4), M.dark, group, { x: PX, y: 1, z, edges: false });
    // 灯台: 白い塔、チーム色の帯、回る光
    const LZ = QZ + 36;
    add(cyl(2.2, 3.2, 22, 10), M.body, group, { x: PX, y: D + 11, z: LZ });
    add(cyl(2.5, 2.6, 2, 10), M.accent, group, { x: PX, y: D + 8, z: LZ, edges: false });
    const lantern = add(cyl(2.5, 2.5, 3.4, 10), M.lampOff, group, { x: PX, y: D + 23.7, z: LZ, edges: false });   // 灯室(点滅する)
    add(new THREE.ConeGeometry(3, 3, 10), M.dark, group, { x: PX, y: D + 26.9, z: LZ, edges: false });

    // ── 陸側の建物: 倉庫(切妻)、事務所と信号柱、油槽2基、荷の山 ──
    const WP = [[-40, D], [-14, D], [-14, D + 11], [-27, D + 15], [-40, D + 11]];
    add(U.loft(THREE, [{ z: -34, pts: WP }, { z: -10, pts: WP }]), M.body, group);
    add(box(26.3, 1, 24.3), M.accent, group, { x: -27, y: D + 9, z: -22, edges: false });
    for (let k = 0; k < 3; k++) add(box(6, 7, 0.3), M.mid, group, { x: -35 + k * 8, y: D + 3.5, z: -9.85, edges: false });
    add(box(12, 10, 10), M.body, group, { x: 2, y: D + 5, z: -28 });
    add(box(12.1, 1.8, 10.1), M.glass, group, { x: 2, y: D + 7, z: -28, edges: false });
    add(cyl(0.4, 0.5, 14, 6), M.dark, group, { x: 6, y: D + 17, z: -30, edges: false });
    const radar = new THREE.Group(); radar.position.set(6, D + 24, -30); group.add(radar);
    add(box(6, 0.8, 1), M.body, radar);
    for (const [x, z] of [[24, -28], [36, -20]]) { add(cyl(7, 7, 12, 16), M.light, group, { x, y: D + 6, z }); add(cyl(7.2, 7.2, 1, 16), M.accent, group, { x, y: D + 10, z, edges: false }); add(cyl(6, 7, 1.6, 16), M.body, group, { x, y: D + 12.8, z }); }
    // 荷の山(岸壁の左手前)
    // コンテナ(物流ハブと同じ寸法。長い向きを x に)の置き場: 3列、真ん中の列の上がクレーンの置き場
    const CL = 11, CW = 4.4, CH = 4.2, cont = () => box(CL, CH - 0.1, CW);
    const STX = -26, STZ = 6;
    const yard = new Map([[M.cWhite, []], [M.cSlate, []], [M.cAccent, []]]);
    [[STZ - 5, [M.cSlate]], [STZ, [M.cWhite, M.cSlate]], [STZ + 5, [M.cAccent, M.cWhite]]].forEach(([z, mats]) => mats.forEach((m, k) => yard.get(m).push([cont(), { x: STX, y: D + CH * k + CH / 2, z }])));
    for (const [m, list] of yard) add(U.merge(THREE, list), m, group);

    // ── 貨物船(岸壁に横付け。ゆっくり揺れる) ──
    const SS = 1.5;                                                                          // 船体の大きさ(コンテナは標準の寸法のまま載せる)
    const ship = new THREE.Group(); ship.position.set(-10, 0, QZ + 14); group.add(ship);
    const hullG = new THREE.Group(); hullG.scale.setScalar(SS); ship.add(hullG);
    const sec = U.sym([[4.5, 0], [8, 3.5], [8.4, 7]]);
    add(U.loft(THREE, [
      { z: -30, pts: sec.map(([x, y]) => [x * 0.75, y * 0.9 + 0.7]) }, { z: -26, pts: sec }, { z: 18, pts: sec },
      { z: 30, pts: sec.map(([x, y]) => [x * 0.18, y + 0.8]) },
    ]), M.hull, hullG, { ry: Math.PI / 2 });
    add(box(56, 1, 15.6), M.body, hullG, { x: -2, y: 7.5 });                                  // 甲板
    add(box(56.4, 1.2, 16.2), M.accent, hullG, { x: -2, y: 5.6, edges: false });             // 舷の帯(チーム色)
    add(box(10, 8, 12), M.body, hullG, { x: -22, y: 12 }); add(box(10.1, 1.6, 12.1), M.glass, hullG, { x: -22, y: 14.4, edges: false });   // 船橋(後ろ)
    add(cyl(0.4, 0.4, 8, 6), M.dark, hullG, { x: -22, y: 20, edges: false });
    add(box(20, 1.2, 12), M.mid, hullG, { x: 4, y: 8.6 });                                    // 船倉のふた
    const HY = 9.2 * SS, onBoard = [[0, -6, [M.cLight, M.cAccent]], [12, -6, [M.cWhite]], [0, -1.2, [M.cSlate]], [12, -1.2, [M.cWhite, M.cSlate]], [0, 3.6, [M.cAccent]]];   // 船倉のふたの上(1か所は空けておく)
    const boardMats = new Map();
    for (const [x, z, mats] of onBoard) mats.forEach((m, k) => { if (!boardMats.has(m)) boardMats.set(m, []); boardMats.get(m).push([cont(), { x, y: HY + CH * k + CH / 2, z }]); });
    for (const [m, list] of boardMats) add(U.merge(THREE, list), m, ship);

    // ── 荷役クレーン: 岸壁のレール上の門型の台、旋回する機械室とジブ、吊り荷 ──
    const KX = -12, KZ = QZ - 6, KH = 10;
    for (const x of [-46, 46]) add(box(1, 0.4, 1), M.dark, group, { x, y: D, z: KZ, edges: false });
    const rails = []; for (const z of [KZ - 4, KZ + 4]) rails.push([box(HX * 2 - 4, 0.4, 0.8), { y: D + 0.2, z }]);
    add(U.merge(THREE, rails), M.dark, group, { edges: false });
    for (const dx of [-4, 4]) for (const dz of [-4, 4]) add(box(1.4, KH, 1.4), M.light, group, { x: KX + dx, y: D + KH / 2, z: KZ + dz });
    add(box(10, 2, 10), M.light, group, { x: KX, y: D + KH + 1, z: KZ });
    const slew = new THREE.Group(); slew.position.set(KX, D + KH + 2, KZ); group.add(slew);
    add(box(8, 6, 7), M.body, slew, { x: -2, y: 3 }); add(box(8.1, 1.4, 7.1), M.accent, slew, { x: -2, y: 4.6, edges: false });
    add(box(3, 3, 3.2), M.glass, slew, { x: 2.8, y: 2, z: 2.2, edges: false });
    const JL = 30;                                                                          // ジブの長さ(仰角は届く距離に合わせて変える)
    const jib = new THREE.Group(); jib.position.set(2, 3, 0); slew.add(jib);
    add(box(JL, 1.6, 1.6), M.body, jib, { x: JL / 2 });
    add(box(JL * 0.9, 0.5, 0.5), M.accent, jib, { x: JL / 2, y: 1, edges: false });
    const beacon = add(box(1, 1, 1), M.beaconOff, slew, { x: -2, y: 6.6, edges: false });
    const hook = add(box(CL + 0.6, 0.8, CW + 0.4), M.dark, group, { edges: false });          // 吊具
    const load = add(cont(), M.cWhite, group);
    const cableGeo = new THREE.BufferGeometry(); cableGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    group.add(new THREE.LineSegments(cableGeo, M.cable));
    const tip = () => { const a = slew.rotation.y, j = jib.rotation.z, reach = 2 + Math.cos(j) * JL; return { x: KX + Math.cos(a) * reach, z: KZ - Math.sin(a) * reach, y: D + KH + 2 + 3 + Math.sin(j) * JL }; };

    // 旋回の手順: 荷の山の上 → 吊り上げ → 船の上へ旋回 → 下ろす → 戻る(角度は台から見た向き)
    const ang = (x, z) => Math.atan2(-(z - KZ), x - KX), luff = (x, z) => Math.acos(Math.min(1, (Math.hypot(x - KX, z - KZ) - 2) / JL));
    const SHX = ship.position.x + 12, SHZ = ship.position.z + 3.6;                               // 船の上の置き場
    const A_STACK = ang(STX, STZ), J_STACK = luff(STX, STZ), A_SHIP = ang(SHX, SHZ) + Math.PI * 2, J_SHIP = luff(SHX, SHZ);   // 船へは水面側を回る
    const HIGH = 30, onStack = D + CH * 2, onShip = HY;                                          // 荷の底の高さ: 吊り上げ、荷の山の上、船の上(船の揺れを足す)
    const STEPS = [
      { d: 2.0, a: A_STACK, j: J_STACK, y: HIGH }, { d: 1.6, y: onStack }, { d: 0.5, carry: true }, { d: 1.6, y: HIGH },
      { d: 4.0, a: A_SHIP, j: J_SHIP }, { d: 1.8, y: onShip }, { d: 0.5, carry: false }, { d: 1.6, y: HIGH }, { d: 1.2 },
      { d: 1.8, y: onShip }, { d: 0.5, carry: true }, { d: 1.6, y: HIGH },
      { d: 4.0, a: A_STACK, j: J_STACK }, { d: 1.6, y: onStack }, { d: 0.5, carry: false }, { d: 1.6, y: HIGH }, { d: 1.2 },
    ];
    let st = { a: A_STACK, j: J_STACK, y: HIGH, carry: false };
    for (const s of STEPS) { s.from = st; st = { a: s.a ?? st.a, j: s.j ?? st.j, y: s.y ?? st.y, carry: s.carry ?? st.carry }; s.to = st; }
    const TOTAL = STEPS.reduce((a, s) => a + s.d, 0);

    // ── 照明柱 ──
    const lamps = [];
    for (const [x, z] of [[-42, -2], [12, 14], [42, -36]]) { add(cyl(0.3, 0.5, 18, 6), M.light, group, { x, y: D + 9, z, edges: false }); lamps.push(add(box(3, 0.8, 1.6), M.lampOff, group, { x, y: D + 18.4, z, edges: false })); }

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, r, M.ring, M.disc);

    // ── 状態と更新 ──
    let state = opts.state ?? "run", clock = 0, tl = 0, rate = state === "run" ? 1 : 0;
    const ease = (t) => t * t * (3 - 2 * t);
    const v = new THREE.Vector3(), cp = cableGeo.attributes.position;
    function update(dt) {
      M.water.map.offset.y -= dt * 0.03;                                                        // 港の水はゆっくり漂う
      clock += dt;
      rate += ((state === "run" ? 1 : 0) - rate) * Math.min(1, dt * 2);
      tl = (tl + dt * rate) % TOTAL;
      ship.position.y = Math.sin(clock * 0.9) * 0.5; ship.rotation.x = Math.sin(clock * 0.7) * 0.02;   // 船の揺れ
      let t = tl, s = STEPS[0]; for (s of STEPS) { if (t < s.d) break; t -= s.d; }
      const k = ease(Math.min(1, t / s.d));
      slew.rotation.y = s.from.a + (s.to.a - s.from.a) * k; jib.rotation.z = s.from.j + (s.to.j - s.from.j) * k;
      const idx = STEPS.indexOf(s), nearShip = idx >= 5 && idx <= 10;
      const y = s.from.y + (s.to.y - s.from.y) * k + (nearShip ? ship.position.y : 0), carry = k < 1 && s.carry !== undefined ? s.from.carry : s.to.carry;
      const p = tip();
      hook.position.set(p.x, y + CH + 0.4, p.z);
      // 吊り荷: 吊っているときはフック、置いたときは船の上か荷の山の上(どちらにあるかは最後に置いた場所)
      if (carry) load.position.set(p.x, y + CH / 2, p.z);
      else if (idx >= 6 && idx <= 10) load.position.set(SHX, ship.position.y + onShip + CH / 2, SHZ);
      else load.position.set(STX, onStack + CH / 2, STZ);
      cp.setXYZ(0, p.x, p.y, p.z); cp.setXYZ(1, p.x, y + CH + 0.8, p.z); cp.needsUpdate = true;
      // 灯台の光と、クレーンの回転灯・照明
      lantern.material = Math.floor(clock * 1.5) % 3 === 0 ? M.lamp : M.lampOff; radar.rotation.y = clock * 2;   // 灯台は点滅だけ(光の帯は描かない)
      beacon.material = rate > 0.3 && Math.floor(clock * 3) % 2 ? M.beacon : M.beaconOff;
      for (const l of lamps) l.material = state === "run" ? M.lamp : M.lampOff;
      M.ring.dashOffset = (M.ring.dashOffset ?? 0) - dt * 8;
    }
    function setTeam(c) { const col = c ?? P.neutral; M.accent.color.set(col); M.ring.color.set(col); M.disc.color.set(col); }
    // 動かない部品を焼いてまとめる(船、クレーンの旋回部とジブ、吊具、事務所の柱の上の回る部品は別)
    U.bake(THREE, group, { dynamic: [ship, slew, jib, hook, radar], live: [M.accent] });
    update(0);
    return {
      group, update, setTeam, stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; }, get state() { return state; }, seek(t) { tl = t; update(0); },
    };
  }

  (window.DreamAssets ??= {}).port = port;
})();
