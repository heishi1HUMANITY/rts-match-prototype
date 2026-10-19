// 中規模拠点「物流ハブ」の詳細版モデル(試作)。建築模型の方針(白・明灰・暗、チーム色はアクセントだけ、輪郭線)。
// 台座の大半をコンテナヤードにし、門型クレーン(レール走行の RTG)2基がそれぞれのブロックでコンテナを積み替え続ける。
// 右の帯に空コンテナの置き場と管制棟、四隅に照明塔。トラックと道路は置かない。
//
//   const hub = DreamAssets.hub(THREE, { r: 75 });   // r = 制圧圏の半径。ビューアでは表示倍率 3.0(施設は現行の倍)
//   scene.add(hub.group); hub.setTeam(0xff6a1a); hub.setState("run" | "stop"); hub.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3, amber: 0xffb020, glass: 0x5d7486 };

  function hub(THREE, opts = {}) {
    const U = DreamAssets.util;
    const r = opts.r ?? 75, deck = 4;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const rib = U.ribTexture(THREE);   // コンテナの側面(港と共通)
    const M = {
      body: lambert(P.body), light: lambert(P.light), mid: lambert(P.mid), dark: lambert(P.dark), glass: lambert(P.glass),
      accent: lambert(P.neutral),
      cWhite: lambert(0xf4f6f8, { map: rib }), cLight: lambert(0xd5dce3, { map: rib }), cSlate: lambert(0x8e9aa6, { map: rib }), cAccent: lambert(P.neutral, { map: rib }),
      lamp: basic(0xfff3c4), lampOff: basic(0x8b8f86), beacon: basic(P.amber), beaconOff: basic(0x6b5a35),
      cable: new THREE.LineBasicMaterial({ color: P.dark }),
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 12, gapSize: 9, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.08, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "hub";
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const accentMats = [M.accent, M.cAccent];

    // ── 台座: 角を落とした長方形 + 足元の暗い帯、ヤードの舗装 ──
    const HX = 56, HZ = 46;
    add(U.slab(THREE, HX, HZ, 12, deck), M.body, group);
    add(U.slab(THREE, HX + 3, HZ + 3, 13.5, 1), M.dark, group, { edges: false });
    add(U.slab(THREE, 44, 41, 10, 0.4), M.light, group, { x: -11, y: deck, edges: false });

    // ── コンテナ: 2ブロック × 6列 × 6ベイ(0〜3段)+ 右の帯の空コンテナ置き場(2〜4段)。色ごとに1つへまとめる ──
    const CL = 11, CW = 4.4, CH = 4.2;
    const BAYS = [-31, -18.6, -6.2, 6.2, 18.6, 31];
    const BLOCKS = [{ railL: -52, railR: -14 }, { railL: -8, railR: 30 }].map((b) => ({ ...b, rows: [0, 1, 2, 3, 4, 5].map((i) => b.railL + 4.5 + i * 5.6) }));
    // クレーンが積み替える4か所(列, ベイ, 下の段数)。中のベイだけを使う(クレーンの台車が台座の角から出ないように)
    BLOCKS[0].slots = [[1, 1, 1], [4, 2, 2], [2, 3, 0], [5, 4, 1]];
    BLOCKS[1].slots = [[0, 4, 2], [3, 1, 1], [5, 3, 0], [2, 2, 1]];
    const rnd = U.rng(7), byMat = new Map([[M.cWhite, []], [M.cLight, []], [M.cSlate, []], [M.cAccent, []]]);
    const pickMat = () => { const v = rnd(); return v < 0.42 ? M.cWhite : v < 0.68 ? M.cLight : v < 0.84 ? M.cSlate : M.cAccent; };
    const stack = (x, z, n) => { for (let k = 0; k < n; k++) byMat.get(pickMat()).push([box(CW, CH - 0.1, CL), { x, y: deck + 0.4 + CH * k + CH / 2, z }]); };
    for (const b of BLOCKS) b.rows.forEach((x, ri) => BAYS.forEach((z, bi) => {
      const slot = b.slots.find(([sr, sb]) => sr === ri && sb === bi);
      stack(x, z, slot ? slot[2] : Math.min(3, Math.floor(rnd() * 3.6) + (ri % 3 === 0 ? 1 : 0)));
    }));
    for (const x of [38.5, 43.5, 48.5]) for (const z of [6.2, 18.6, 31]) stack(x, z, 2 + Math.floor(rnd() * 3));   // 空コンテナ置き場
    for (const [mat, parts] of byMat) if (parts.length) add(U.merge(THREE, parts), mat, group);
    // レール
    const rails = []; for (const b of BLOCKS) for (const x of [b.railL, b.railR]) rails.push([box(1.2, 0.5, 74), { x, y: deck + 0.25 }]);
    add(U.merge(THREE, rails), M.dark, group, { edges: false });

    // ── 門型クレーン(RTG): 脚4本、下の梁と台車、上の桁2本、横行するトロリーと運転室、吊具とワイヤ ──
    const GH = 23;
    function makeCrane(b) {
      const crane = new THREE.Group(); crane.position.y = deck; group.add(crane);
      const SPAN = b.railR - b.railL, CXc = (b.railL + b.railR) / 2;
      for (const x of [b.railL, b.railR]) {
        for (const z of [-7, 7]) add(U.loft(THREE, [{ z: -1.3, pts: [[x - 1.5, 2], [x + 1.5, 2], [x + 1.1, GH], [x - 1.1, GH]] }, { z: 1.3, pts: [[x - 1.5, 2], [x + 1.5, 2], [x + 1.1, GH], [x - 1.1, GH]] }]), M.body, crane, { z });
        add(box(3, 2, 19), M.light, crane, { x, y: 2 });                                          // 下の梁
        for (const z of [-9, 9]) add(box(3.4, 1.6, 4), M.dark, crane, { x, y: 0.8, z, edges: false });   // 台車
        add(box(2.4, 2.4, 16), M.light, crane, { x, y: GH + 1.2 });                               // 上の横つなぎ
      }
      for (const z of [-5.5, 5.5]) {
        add(box(SPAN + 5, 2.6, 1.8), M.body, crane, { x: CXc, y: GH + 1.3, z });                  // 桁
        add(box(SPAN + 5.1, 0.9, 0.3), M.accent, crane, { x: CXc, y: GH + 1.6, z: z + Math.sign(z), edges: false });   // 桁の外側の帯(チーム色)
      }
      const beacons = [-1, 1].map((s) => add(box(0.8, 0.8, 0.8), M.beaconOff, crane, { x: s < 0 ? b.railL : b.railR, y: GH + 2.9, z: s * 7, edges: false }));
      const trolley = new THREE.Group(); trolley.position.y = GH + 2.6; crane.add(trolley);
      add(box(6, 2.2, 13), M.light, trolley, { y: 1.1 });
      add(box(4.4, 1.2, 4), M.dark, trolley, { y: 2.8, edges: false });                         // 巻上げ機
      add(box(3, 3, 3.2), M.body, trolley, { y: -4.2, z: 8.2 });                                 // 運転室(桁の外に吊る)
      add(box(3.05, 1.2, 3.25), M.glass, trolley, { y: -3.8, z: 8.2, edges: false });
      add(box(0.6, 3, 0.6), M.dark, trolley, { y: -1.6, z: 7.6, edges: false });
      const spreader = new THREE.Group(); crane.add(spreader);
      add(box(CW + 0.4, 0.8, CL + 0.6), M.dark, spreader, { y: 0.4 });
      add(box(1.6, 0.8, 2.2), M.mid, spreader, { y: 1.2, edges: false });
      const cableGeo = new THREE.BufferGeometry(); cableGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(8 * 3), 3));
      crane.add(new THREE.LineSegments(cableGeo, M.cable));
      return { crane, trolley, spreader, cableGeo, beacons };
    }

    // ── 積み替えの動き: 4か所のうち1か所が空いていて、その隣からコンテナを1つ運んで空きを埋める(3つのコンテナが順に回る) ──
    const HT = 4 * CH + 2.2;
    const movers = [M.cAccent, M.cWhite, M.cSlate, M.cLight, M.cAccent, M.cWhite];
    const cranes = BLOCKS.map((b, bi) => {
      const parts = makeCrane(b);
      const slots = b.slots.map(([ri, bay, base]) => ({ x: b.rows[ri], z: BAYS[bay], base }));
      const boxes = [0, 1, 2].map((i) => add(box(CW, CH - 0.1, CL), movers[bi * 3 + i], group));
      return { ...parts, slots, boxes, occ: [0, 1, 2, -1], carry: -1, gz: slots[0].z, tx: slots[0].x, hy: HT, steps: [], si: 0, t: 0, wait: bi * 7 };
    });
    const ease = (t) => t * t * (3 - 2 * t);
    function planMove(c) {
      const dst = c.occ.indexOf(-1), src = (dst + 1) % 4, a = c.slots[src], b = c.slots[dst];
      const gy = (s) => 0.4 + CH * (s.base + 1);                                                 // 吊具を下ろす高さ(コンテナの上面)
      c.steps = [
        { d: 1.4 + Math.hypot(a.z - c.gz, a.x - c.tx) / 14, gz: a.z, tx: a.x }, { d: 1.5, hy: gy(a) }, { d: 0.4, act: () => { c.carry = c.occ[src]; c.occ[src] = -1; } }, { d: 1.5, hy: HT },
        { d: 1.4 + Math.hypot(b.z - a.z, b.x - a.x) / 14, gz: b.z, tx: b.x }, { d: 1.5, hy: gy(b) }, { d: 0.4, act: () => { c.occ[dst] = c.carry; c.carry = -1; } }, { d: 1.5, hy: HT }, { d: 1.2 },
      ];
      c.si = 0; c.t = 0; c.from = { gz: c.gz, tx: c.tx, hy: c.hy };
    }
    function stepCrane(c, dt) {
      if (c.wait > 0) { c.wait -= dt; return false; }
      if (c.si >= c.steps.length) planMove(c);
      const s = c.steps[c.si];
      c.t += dt;
      const k = ease(Math.min(1, c.t / s.d));
      for (const key of ["gz", "tx", "hy"]) if (s[key] !== undefined) c[key] = c.from[key] + (s[key] - c.from[key]) * k;
      if (c.t >= s.d) { s.act?.(); c.si++; c.t = 0; c.from = { gz: c.gz, tx: c.tx, hy: c.hy }; }
      return s.gz !== undefined || s.hy !== undefined;
    }
    function placeCrane(c) {
      c.crane.position.z = c.gz; c.trolley.position.x = c.tx; c.spreader.position.set(c.tx, c.hy, 0);
      c.boxes.forEach((m, i) => {
        if (c.carry === i) m.position.set(c.tx, deck + c.hy - CH / 2, c.gz);
        else { const s = c.slots[c.occ.indexOf(i)]; m.position.set(s.x, deck + 0.4 + CH * s.base + CH / 2, s.z); }
      });
      const cp = c.cableGeo.attributes.position; let i = 0;
      for (const [dx, dz] of [[-1.5, -4], [1.5, -4], [-1.5, 4], [1.5, 4]]) { cp.setXYZ(i++, c.tx + dx, GH + 2.6, dz); cp.setXYZ(i++, c.tx + dx * 1.2, c.hy + 0.8, dz * 1.1); }
      cp.needsUpdate = true;
    }

    // ── 管制棟(2階建て + 塔)、照明塔 ──
    const BX = 44;
    add(box(14, 8, 14), M.body, group, { x: BX, y: deck + 4, z: -22 });
    add(box(14.1, 1.6, 14.1), M.glass, group, { x: BX, y: deck + 5.6, z: -22, edges: false });
    add(box(14.4, 0.8, 14.4), M.accent, group, { x: BX, y: deck + 8.2, z: -22, edges: false });
    add(box(6, 16, 6), M.light, group, { x: BX + 2, y: deck + 8, z: -25 });
    add(U.loft(THREE, [{ z: -4, pts: [[-4, 0], [4, 0], [4.6, 3.6], [-4.6, 3.6]] }, { z: 4, pts: [[-4, 0], [4, 0], [4.6, 3.6], [-4.6, 3.6]] }]), M.glass, group, { x: BX + 2, y: deck + 16, z: -25 });   // 張り出した管制室
    add(box(9.6, 0.8, 8.6), M.body, group, { x: BX + 2, y: deck + 20, z: -25 });
    add(new THREE.CylinderGeometry(0.25, 0.25, 7, 6), M.dark, group, { x: BX + 4.5, y: deck + 23.9, z: -27, edges: false });
    const lamps = [];
    for (const [x, z] of [[-53, -35], [-53, 35], [52, 36], [52, -5]]) {
      const ry = Math.atan2(-x, -z), d = Math.hypot(x, z);                                     // 灯具は構内の中心へ向ける
      add(new THREE.CylinderGeometry(0.35, 0.6, 24, 6), M.light, group, { x, y: deck + 12, z, edges: false });
      add(box(4, 1.6, 1.2), M.dark, group, { x, y: deck + 24.4, z, ry, edges: false });
      lamps.push(add(box(3.6, 1.1, 0.3), M.lampOff, group, { x: x - (x / d) * 0.65, y: deck + 24.4, z: z - (z / d) * 0.65, ry, edges: false }));
    }

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, r, M.ring, M.disc);

    // ── 状態と更新 ──
    let state = opts.state ?? "run", clock = 0, rate = state === "run" ? 1 : 0;
    function update(dt) {
      clock += dt;
      rate += ((state === "run" ? 1 : 0) - rate) * Math.min(1, dt * 2);
      for (const c of cranes) {
        const moving = stepCrane(c, dt * rate) && rate > 0.3;
        placeCrane(c);
        const on = moving && Math.floor(clock * 3) % 2 === 0;                                    // 動いているあいだは黄色の回転灯
        for (const b of c.beacons) b.material = on ? M.beacon : M.beaconOff;
      }
      for (const l of lamps) l.material = state === "run" ? M.lamp : M.lampOff;
      M.ring.dashOffset = (M.ring.dashOffset ?? 0) - dt * 8;
    }
    function setTeam(c) { const col = c ?? P.neutral; for (const m of accentMats) m.color.set(col); M.ring.color.set(col); M.disc.color.set(col); }
    // 動かない部品を焼いてまとめる(クレーンの本体・トロリー・吊具は別々に。チーム色の accent はマテリアルごと)
    U.bake(THREE, group, { dynamic: cranes.flatMap((c) => [c.crane, c.trolley, c.spreader]), live: [M.accent] });
    update(0);
    return {
      group, update, setTeam, stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; }, get state() { return state; }, seek(t) { for (let i = 0; i < t * 10; i++) update(0.1); },
    };
  }

  (window.DreamAssets ??= {}).hub = hub;
})();
