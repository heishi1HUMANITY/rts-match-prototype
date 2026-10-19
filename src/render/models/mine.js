// 小拠点「鉱山」の詳細版モデル(試作)。建築模型の方針(白・明灰・暗、チーム色はアクセントだけ、輪郭線)。
// 段々に掘り下げた露天掘りの穴、立坑の櫓(頂の滑車が回り、かごが上下する)、巻上げ機の建屋、
// 立坑から選鉱場へ鉱石を運ぶ斜めのコンベヤ(鉱石が流れる)、選鉱場とサイロ、鉱石の山。
//
//   const mine = DreamAssets.mine(THREE, { r: 60 });   // r = 制圧圏の半径(small.radius)。ビューアでは表示倍率 3.0
//   scene.add(mine.group); mine.setTeam(0xff6a1a); mine.setState("run" | "stop"); mine.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3, glass: 0x5d7486, ore: 0x59636e, rock: 0xb9c1c9, hazard: 0xffc83d, amber: 0xffb020 };

  function mine(THREE, opts = {}) {
    const U = DreamAssets.util;
    const r = opts.r ?? 60, D = 9;                                                          // 台座は厚め(穴を掘り下げるため)
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      body: lambert(P.body), light: lambert(P.light), mid: lambert(P.mid), dark: lambert(P.dark), glass: lambert(P.glass), accent: lambert(P.neutral),
      ore: lambert(P.ore, { flatShading: true }), rock: lambert(P.rock, { flatShading: true }), hazard: lambert(P.hazard),
      lamp: basic(0xfff3c4), lampOff: basic(0x8b8f86), beacon: basic(P.amber), beaconOff: basic(0x6b5a35), cable: new THREE.LineBasicMaterial({ color: P.dark }),
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 12, gapSize: 9, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.08, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "mine";
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const rod = (a, b, th) => { const g = box(th, th, a.distanceTo(b)), m = new THREE.Matrix4().lookAt(a, b, V(0, 1, 0)); m.setPosition(a.clone().add(b).multiplyScalar(0.5)); g.applyMatrix4(m); return g; };

    // ── 台座(角を落とした長方形)に露天掘りの穴(八角、3段のテラス)を開ける ──
    const HX = 46, HZ = 40, PX = -18, PZ = 14;                                               // 穴の中心
    const oct = (rr, cx, cz) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector2(cx + Math.cos(i * Math.PI / 4 + Math.PI / 8) * rr, cz + Math.sin(i * Math.PI / 4 + Math.PI / 8) * rr));
    const slabWithHole = (outer, hole, h) => {
      const s = new THREE.Shape(outer); s.holes.push(new THREE.Path(hole.slice().reverse()));
      const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, h, 0); return g;
    };
    const c = 8, outer = [[-HX + c, -HZ], [HX - c, -HZ], [HX, -HZ + c], [HX, HZ - c], [HX - c, HZ], [-HX + c, HZ], [-HX, HZ - c], [-HX, -HZ + c]].map(([x, z]) => new THREE.Vector2(x, z));
    add(slabWithHole(outer, oct(22, PX, PZ), D), M.body, group);
    add(U.slab(THREE, HX + 2.5, HZ + 2.5, c + 1, 1), M.dark, group, { edges: false });
    // テラス: 段ごとに少し暗く、内側ほど低い
    [[22, 16, 6], [16, 10, 3]].forEach(([ro, ri, h], i) => add(slabWithHole(oct(ro, PX, PZ), oct(ri, PX, PZ), h), i ? M.rock : M.light, group));
    const fl = new THREE.Shape(oct(10, PX, PZ)), flG = new THREE.ExtrudeGeometry(fl, { depth: 0.6, bevelEnabled: false }); flG.rotateX(Math.PI / 2); flG.translate(0, 0.6, 0);
    add(flG, M.ore, group);
    // 縁の警告柵
    const fence = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; fence.push([box(0.6, 2.4, 0.6), { x: PX + Math.cos(a) * 24, y: D + 1.2, z: PZ + Math.sin(a) * 24 }]); }
    add(U.merge(THREE, fence), M.hazard, group, { edges: false });

    // ── 立坑の櫓: 4本脚の塔 + 後ろへ傾いた支え、頂の滑車2つ(回る)、かご(上下する) ──
    const TX = 8, TZ = 6, TH = 34;
    const tower = [];
    for (const dx of [-4, 4]) for (const dz of [-4, 4]) tower.push([rod(V(TX + dx * 1.3, D, TZ + dz * 1.3), V(TX + dx * 0.7, D + TH, TZ + dz * 0.7), 1.4), {}]);
    for (let k = 1; k <= 4; k++) { const y = D + (k / 4.4) * TH, w = 4 * (1.3 - 0.6 * k / 4.4); for (const [a, b] of [[[-w, -w], [w, -w]], [[-w, w], [w, w]], [[-w, -w], [-w, w]], [[w, -w], [w, w]]]) tower.push([rod(V(TX + a[0], y, TZ + a[1]), V(TX + b[0], y, TZ + b[1]), 0.8), {}]); }
    for (const dx of [-4.2, 4.2]) tower.push([rod(V(TX + dx, D, TZ - 20), V(TX + dx * 0.75, D + TH, TZ - 3), 1.6), {}]);   // 後ろの支え(櫓と巻上げ機の建屋のあいだに足を置く。滑車より外側)
    add(U.merge(THREE, tower), M.body, group);
    add(box(10, 2, 10), M.light, group, { x: TX, y: D + TH + 1, z: TZ });
    add(box(10.4, 1, 10.4), M.accent, group, { x: TX, y: D + TH - 0.4, z: TZ, edges: false });
    // 滑車は巻上げ機の方(-z)を向けて立てる(車輪の面は yz)。後ろの支え(x = ±3)より内側に2つ並べ、台の上に軸受けを置く
    const WY = D + TH + 6.5, WZ = TZ - 2, wheels = [];
    for (const dx of [-1.6, 1.6]) {
      const w = new THREE.Group(); w.position.set(TX + dx, WY, WZ); group.add(w); wheels.push(w);
      add(new THREE.TorusGeometry(4, 0.45, 6, 20), M.dark, w, { ry: Math.PI / 2, edges: false });
      for (let k = 0; k < 4; k++) add(box(0.4, 8, 0.4), M.dark, w, { rx: k * Math.PI / 4, edges: false });
      add(box(0.8, 4.5, 1.2), M.mid, group, { x: TX + dx * 1.6, y: D + TH + 4.3, z: WZ, edges: false });   // 軸受け
    }
    add(box(4.4, 0.6, 0.6), M.dark, group, { x: TX, y: WY, z: WZ, edges: false });                           // 軸
    const beacon = add(box(1, 1, 1), M.beaconOff, group, { x: TX + 4.4, y: D + TH + 2.5, z: TZ + 4.4, edges: false });
    add(box(8, 0.6, 8), M.dark, group, { x: TX, y: D + 0.3, z: TZ, edges: false });                       // 立坑の口
    const cage = add(box(4, 5, 4), M.light, group, { x: TX, z: WZ + 4 });                        // かご(滑車の前側の綱で吊る)
    // 巻上げ機の建屋(後ろ)と、滑車から建屋へのワイヤ
    const HP = [[TX - 9, D], [TX + 9, D], [TX + 9, D + 10], [TX, D + 13], [TX - 9, D + 10]];
    add(U.loft(THREE, [{ z: TZ - 38, pts: HP }, { z: TZ - 24, pts: HP }]), M.body, group);
    add(box(18.3, 1, 14.3), M.accent, group, { x: TX, y: D + 8, z: TZ - 31, edges: false });
    const wire = new THREE.BufferGeometry().setFromPoints([V(TX - 1.6, WY + 4, WZ), V(TX - 1.6, D + 9, TZ - 24), V(TX + 1.6, WY + 4, WZ), V(TX + 1.6, D + 8, TZ - 24)]);
    group.add(new THREE.LineSegments(wire, M.cable));
    const cageWire = new THREE.BufferGeometry(); cageWire.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    group.add(new THREE.LineSegments(cageWire, M.cable));

    // ── コンベヤ: 立坑の脇のホッパー → 斜めに上がって選鉱場の上へ。鉱石が流れる ──
    const C0 = V(TX + 8, D + 6, TZ + 4), C1 = V(32, D + 24, -22);
    add(box(7, 6, 7), M.mid, group, { x: C0.x, y: D + 3, z: C0.z });                               // ホッパー
    const dir = C1.clone().sub(C0), clen = dir.length();
    const belt = new THREE.Group(); belt.position.copy(C0); belt.lookAt(C1); group.add(belt);      // 局所 +z が上り方向
    add(box(3.4, 1.2, clen), M.light, belt, { z: clen / 2 });
    add(box(3.6, 0.4, clen + 0.2), M.accent, belt, { y: -0.8, z: clen / 2, edges: false });
    for (let k = 1; k < 4; k++) { const p = C0.clone().addScaledVector(dir, k / 4); add(box(1, p.y - D, 1), M.dark, group, { x: p.x, y: D + (p.y - D) / 2, z: p.z, edges: false }); }   // 支柱
    const NORE = 18, oreGeo = new THREE.DodecahedronGeometry(0.9, 0), ores = new THREE.InstancedMesh(oreGeo, M.ore, NORE); group.add(ores);

    // ── 選鉱場(段の屋根)とサイロ2基、鉱石の山 ──
    add(box(18, 18, 16), M.body, group, { x: 32, y: D + 9, z: -26 });
    add(box(12, 8, 12), M.light, group, { x: 32, y: D + 22, z: -26 });
    add(box(18.3, 1.2, 16.3), M.accent, group, { x: 32, y: D + 15, z: -26, edges: false });
    add(box(18.1, 2, 16.1), M.glass, group, { x: 32, y: D + 11, z: -26, edges: false });
    for (const [x, z] of [[18, -32], [18, -20]]) { add(cyl(4.5, 4.5, 20, 12), M.light, group, { x, y: D + 6 + 10, z }); add(new THREE.ConeGeometry(4.5, 5, 12), M.light, group, { x, y: D + 3.5, z, rx: Math.PI }); for (const dx of [-3, 3]) add(box(0.8, 6, 0.8), M.dark, group, { x: x + dx, y: D + 3, z, edges: false }); }
    const piles = [[30, 10, 9, 8], [38, 22, 7, 6], [22, 26, 6, 5]];
    for (const [x, z, rr, h] of piles) add(new THREE.ConeGeometry(rr, h, 7), M.ore, group, { x, y: D + h / 2, z, ry: x });
    // 照明柱
    const lamps = [];
    for (const [x, z] of [[-42, -34], [42, 34], [-42, 34]]) { add(cyl(0.3, 0.5, 18, 6), M.light, group, { x, y: D + 9, z, edges: false }); lamps.push(add(box(3, 0.8, 1.6), M.lampOff, group, { x, y: D + 18.4, z, edges: false })); }

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, r, M.ring, M.disc);

    // ── 状態と更新 ──
    let state = opts.state ?? "run", clock = 0, rate = state === "run" ? 1 : 0, phase = 0, flow = 0;
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    function update(dt) {
      clock += dt;
      rate += ((state === "run" ? 1 : 0) - rate) * Math.min(1, dt * 2);
      phase += dt * rate; flow += dt * rate * 0.12;
      // かご: 立坑を上下(口の下へ沈み、上で止まる)。滑車はかごの速さで回る
      const cyc = 12, u = (phase % cyc) / cyc, w = u < 0.4 ? u / 0.4 : u < 0.5 ? 1 : u < 0.9 ? 1 - (u - 0.5) / 0.4 : 0;
      const s = w * w * (3 - 2 * w), y = D - 4 + s * 18;
      cage.position.y = y;
      cage.visible = y > D - 2;
      for (const wh of wheels) wh.rotation.x = s * 6;
      const cp = cageWire.attributes.position; cp.setXYZ(0, TX + 1.6, WY, WZ + 4); cp.setXYZ(1, TX + 1.6, y + 2.5, WZ + 4); cp.needsUpdate = true;
      // コンベヤの鉱石
      for (let i = 0; i < NORE; i++) {
        const t = (i / NORE + flow) % 1; p.copy(C0).addScaledVector(dir, t); p.y += 1.2;
        mt.compose(p, q.setFromEuler(e.set(i, i * 2, 0)), sc.setScalar(rate > 0.05 || t < 0.98 ? 1 : 0)); ores.setMatrixAt(i, mt);
      }
      ores.instanceMatrix.needsUpdate = true;
      beacon.material = rate > 0.3 && Math.floor(clock * 2.5) % 2 ? M.beacon : M.beaconOff;
      for (const l of lamps) l.material = state === "run" ? M.lamp : M.lampOff;
      M.ring.dashOffset = (M.ring.dashOffset ?? 0) - dt * 8;
    }
    function setTeam(col) { const c2 = col ?? P.neutral; M.accent.color.set(c2); M.ring.color.set(c2); M.disc.color.set(c2); }
    U.bake(THREE, group, { dynamic: [...wheels, cage], live: [M.accent] });   // 動かない部品を焼いてまとめる(滑車とかごは別)
    update(0);
    return {
      group, update, setTeam, stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; }, get state() { return state; },
    };
  }

  (window.DreamAssets ??= {}).mine = mine;
})();
