// 戦略施設トークン「海底ケーブル陸揚げ局(バルト海)」の詳細版モデル(試作)。
// 決め手は「海岸の小さな建物と海へ延びるケーブル」。フィンランド湾の岩の多い海岸 700 × 600 m を実寸の比率で組む: 松林の奥の目立たない局舎(柵の中に変圧器・発電機)、
// 入り江の砂浜の陸揚げマンホール、そこから沖へ延びる 3 本のケーブル(通信 2・送電 1)が海底を這い、沖では捨石の保護で覆われる。
// 誇張: ケーブルの太さ 約 20 倍(直径 0.1〜0.15 m → 2.4〜3.6 m)、局舎 1.3 倍、監視ブイの浮体 2 倍。平面は実寸比。
// 省略: 車両・人・小型船。2024 年末の損傷を状態「損傷」で表す(送電ケーブルの切断、錨を引きずった跡、修理船、近くのブイの警報灯)。
// 近未来化(施設リストの案): 沖合に無人の水中監視ブイを並べる(浮体・灯・水中へ吊ったソナーの筒)。
// 状態: "normal"(通常)/ "damaged"(損傷)。
// 座標: x が東、z が南(+z が沖)。
(function () {
  const K = 0.15;
  const D = {
    x0: -350, x1: 350, z0: -300, z1: 300,
    ground: 5, beach: 1.5, base: -35, bedNear: -2, bedFar: -32, zNear: -120,
    cut: [186, 216],   // 送電ケーブルの切れた区間(z)
  };
  const bedY = (z) => D.bedNear + ((D.bedFar - D.bedNear) * (z - D.zNear)) / (D.z1 - D.zNear);

  function cableStation(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 75;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE); M.sea.side = THREE.DoubleSide;
    const group = new THREE.Group(); group.name = "cable_station";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, prism, tube, beam } = k;
    const rnd = U.rng(5);

    // ── 陸: 岩の海岸(入り江の砂浜は低い)、内陸の小さな丘、沖の岩礁 ──
    const shore = [[-350, -30], [-260, -10], [-180, -40], [-90, -35], [-45, -70], [-55, -115], [80, -115], [70, -60], [140, -35], [230, -20], [350, -45]];
    const land = [...shore, [D.x1, D.z0], [D.x0, D.z0]];
    add(prism(land, D.base, D.ground), M.land, world);
    const beachPts = [[-45, -70], [20, -85], [70, -60], [80, -115], [-55, -115]];
    add(prism(beachPts, D.base, D.beach), M.light, world);
    for (const [cx, cz, rx, rz, h] of [[220, -220, 110, 60, 14], [220, -225, 70, 36, 24], [-250, -230, 90, 50, 12]]) {
      add(prism(Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return [cx + rx * Math.cos(a), cz + rz * Math.sin(a)]; }), D.ground, D.ground + h), M.land, world);
    }
    for (let i = 0; i < 26; i++) {   // 波打ち際の花崗岩
      const j = 1 + Math.floor(rnd() * (shore.length - 2)), [ax, az] = shore[j - 1], [bx, bz] = shore[j], t = rnd();
      if (j >= 5 && j <= 7) continue;   // 砂浜の入り江は避ける
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t + 4 + rnd() * 6, s = 5 + rnd() * 9;
      add(box(s, 2 + rnd() * 4, s * (0.6 + rnd() * 0.6)), M.mid, world, { x, y: 0.5, z, ry: rnd() * 3 });
    }
    // 松林(局舎・道・砂浜・岸の近くは空ける)。木は高さ 18〜26 m の円錐
    const inside = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; };
    const coneG = new THREE.ConeGeometry(6, 1, 8), trunkG = cyl(0.8, 1, 5);
    for (let i = 0, n = 0; i < 600 && n < 110; i++) {
      const x = D.x0 + 12 + rnd() * (D.x1 - D.x0 - 24), z = D.z0 + 12 + rnd() * 260;
      if (![[0, 0], [10, 0], [-10, 0], [0, 12]].every(([dx, dz]) => inside(x + dx, z + dz, land)) || inside(x, z, beachPts)) continue;
      if (x > -50 && x < 90 && z > -250 && z < -100) continue;   // 局舎の柵・道・管路
      if (Math.hypot((x - 220) / 120, (z + 222) / 70) < 1 || Math.hypot((x + 250) / 100, (z + 230) / 60) < 1) continue;   // 丘の上は省く(足元の高さが違う)
      const h = 18 + rnd() * 8, m = add(coneG, M.mid, world, { x, y: D.ground + 4 + h / 2, z }); m.scale.set(0.8 + rnd() * 0.4, h, 0.8 + rnd() * 0.4);
      add(trunkG, M.dark, world, { x, y: D.ground + 2, z, edges: false }).scale.set(1, 4, 1); n++;
    }
    const islet = [[-215, 130], [-180, 115], [-150, 135], [-160, 170], [-200, 178], [-225, 158]];
    add(prism(islet, D.base, 6), M.mid, world);
    // 海底(沖へ下る斜面)、水面、水の切り口
    const seabed = [[D.x0, D.base], [D.x1, D.base], [D.x1, 0], [D.x0, 0]];
    add(U.loft(THREE, [{ z: D.zNear, pts: seabed.map(([x, y], i) => [x, i < 2 ? y : bedY(D.zNear)]) }, { z: D.z1, pts: seabed.map(([x, y], i) => [x, i < 2 ? y : bedY(D.z1)]) }]), M.light, world);
    world.add(k.waterShape([[D.x0, -80], [D.x1, -80], [D.x1, D.z1], [D.x0, D.z1]], M.sea));
    const sideCut = (x, z0) => { const g = new THREE.BufferGeometry(); const z1 = D.z1; g.setAttribute("position", new THREE.Float32BufferAttribute([x, 0, z0, x, 0, z1, x, bedY(z1), z1, x, 0, z0, x, bedY(z1), z1, x, bedY(z0), z0], 3)); g.computeVertexNormals(); return g; };
    world.add(new THREE.Mesh(U.merge(THREE, [[new THREE.PlaneGeometry(D.x1 - D.x0, -D.bedFar), { y: D.bedFar / 2, z: D.z1 }], [sideCut(D.x0, -30)], [sideCut(D.x1, -45)]]), M.waterCut));
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base);

    // ── 陸揚げ局: 窓の少ない局舎(1.3 倍)、柵、変圧器、非常用発電機、燃料タンク、小さなアンテナ柱 ──
    const st = V(20, D.ground, -205);
    add(box(47, 10.4, 23), M.body, world, { x: st.x, y: st.y + 5.2, z: st.z });
    add(box(48, 0.8, 24), M.light, world, { x: st.x, y: st.y + 10.8, z: st.z });
    add(box(47.4, 0.6, 23.4), M.accent, world, { x: st.x, y: st.y + 9.6, z: st.z, edges: false });
    for (const dx of [-14, 0, 14]) add(box(5, 1.6, 4), M.mid, world, { x: st.x + dx, y: st.y + 12, z: st.z });   // 屋上の空調機
    add(box(4, 5, 0.4), M.dark, world, { x: st.x - 16, y: st.y + 2.5, z: st.z + 11.7, edges: false });          // 扉
    for (const dx of [2, 10]) add(box(5, 1.2, 0.3), M.glass, world, { x: st.x + dx, y: st.y + 6, z: st.z + 11.6, edges: false });
    add(box(12, 3.6, 4), M.light, world, { x: st.x + 34, y: st.y + 1.8, z: st.z - 4 });   // 発電機
    add(cyl(0.3, 3, 6), M.dark, world, { x: st.x + 38, y: st.y + 5, z: st.z - 4 });
    const tk = cyl(1.8, 8, 12); tk.rotateZ(Math.PI / 2); add(tk, M.body, world, { x: st.x + 34, y: st.y + 2, z: st.z + 8 });
    add(box(6, 4.4, 4), M.mid, world, { x: st.x - 34, y: st.y + 2.2, z: st.z + 2 });   // 変圧器
    for (const dx of [-36.5, -31.5]) add(box(0.2, 3.4, 3.6), M.dark, world, { x: st.x + dx, y: st.y + 2, z: st.z + 2, edges: false });
    k.lattice(world, V(st.x - 20, st.y, st.z - 18), 26, 1.4, 0.6, 4, 0.18, M.mid);
    add(box(1.2, 1.6, 1.2), M.dark, world, { x: st.x - 20, y: st.y + 27, z: st.z - 18 });
    const FX = [st.x - 46, st.x + 46], FZ = [st.z - 30, st.z + 28];
    for (const [x0, z0, x1, z1] of [[FX[0], FZ[0], FX[1], FZ[0]], [FX[0], FZ[1], FX[1], FZ[1]], [FX[0], FZ[0], FX[0], FZ[1]], [FX[1], FZ[0], FX[1], FZ[1]]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), along = x0 === x1;
      add(box(along ? 0.15 : len, 0.15, along ? len : 0.15), M.dark, world, { x: (x0 + x1) / 2, y: st.y + 2.4, z: (z0 + z1) / 2, edges: false });
      for (let i = 0; i <= Math.round(len / 6); i++) { const t = i / Math.round(len / 6); add(box(0.25, 2.6, 0.25), M.dark, world, { x: x0 + (x1 - x0) * t, y: st.y + 1.3, z: z0 + (z1 - z0) * t, edges: false }); }
    }
    add(box(6, 0.15, 60), M.mid, world, { x: st.x - 30, y: st.y + 0.08, z: st.z - 60, edges: false });   // 取付道路
    // 陸揚げマンホール(砂浜)と局舎までの管路の溝
    add(box(8, 2.4, 5), M.light, world, { x: 10, y: D.beach + 0.6, z: -98 });
    add(box(3, 0.3, 3), M.dark, world, { x: 10, y: D.beach + 1.9, z: -98, edges: false });
    add(box(3, 0.2, 85), M.mid, world, { x: 13, y: D.ground + 0.1, z: -156, edges: false });

    // ── ケーブル: マンホールから沖へ。海底に沿わせ、沖では捨石の保護(明るい土手)をかぶる ──
    const routes = {
      telA: { pts: [[4, -92], [-10, -20], [-45, 90], [-80, 200], [-95, D.z1]], r: 1.2 },
      power: { pts: [[10, -92], [14, -10], [22, 100], [32, 200], [40, D.z1]], r: 1.8 },
      telB: { pts: [[16, -92], [40, -20], [90, 80], [150, 190], [190, D.z1]], r: 1.2 },
    };
    const sample = (pts, n) => {
      const out = [];
      for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < n; j++) { const t = j / n, [ax, az] = pts[i], [bx, bz] = pts[i + 1]; out.push([ax + (bx - ax) * t, az + (bz - az) * t]); }
      out.push(pts[pts.length - 1]); return out;
    };
    const lay = (parent, pts, r, mat, keep = () => true, shift = () => 0) => {
      const s = sample(pts, 6);
      for (let i = 0; i < s.length - 1; i++) {
        const [ax, az] = s[i], [bx, bz] = s[i + 1];
        if (!keep(az, bz)) continue;
        tube(parent, V(ax + shift(az), Math.max(bedY(az), D.bedNear) + r, az), V(bx + shift(bz), Math.max(bedY(bz), D.bedNear) + r, bz), r, mat);
      }
    };
    const cableIntact = new THREE.Group(), cableBroken = new THREE.Group(); world.add(cableIntact, cableBroken);
    lay(world, routes.telA.pts, routes.telA.r, M.dark); lay(world, routes.telB.pts, routes.telB.r, M.dark);
    lay(cableIntact, routes.power.pts, routes.power.r, M.dark);
    const [ca, cb] = D.cut;   // 切れた送電ケーブル: 切り口の手前と先が錨に引かれて横へずれる
    lay(cableBroken, routes.power.pts, routes.power.r, M.dark, (az, bz) => bz <= ca || az >= cb, (z) => (z > ca - 40 && z <= ca ? -12 * (1 - (ca - z) / 40) : z >= cb && z < cb + 40 ? 12 * (1 - (z - cb) / 40) : 0));
    for (const [z0, z1] of [[60, 110], [230, 290]]) for (const r of Object.values(routes)) {   // 捨石の保護(区間ごと)
      const s = sample(r.pts, 6).filter(([, z]) => z >= z0 && z <= z1);
      for (let i = 0; i < s.length - 1; i++) beam(world, V(s[i][0], bedY(s[i][1]) + 0.6, s[i][1]), V(s[i + 1][0], bedY(s[i + 1][1]) + 0.6, s[i + 1][1]), 7, M.mid);
    }

    // ── 近未来化: 沖の無人の水中監視ブイ(浮体 2 倍、灯、水中へ吊ったソナーの筒と頭) ──
    const buoys = [];
    for (const [x, z] of [[-40, 120], [70, 160], [140, 250], [-60, 260]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
      add(cyl(2.6, 3, 12), M.body, g, { y: 0.4 });
      add(cyl(2.7, 0.8, 12), M.accent, g, { y: 1.4, edges: false });
      add(cyl(0.3, 6, 6), M.mid, g, { y: 4.5 });
      add(box(2.4, 0.2, 1.6), M.glass, g, { y: 5.5, rx: -0.5, edges: false });
      tube(g, V(0, -1, 0), V(0, bedY(z) + 6, 0), 0.4, M.mid);
      add(cyl(1.2, 3, 10), M.dark, g, { y: bedY(z) + 4.5 });
      buoys.push(add(cyl(0.6, 1, 8), M.beaconOff, g, { y: 8, edges: false }));
    }

    // ── 損傷: 錨を引きずった跡(海底の暗い溝)と、切れた所の上に止まる修理船 ──
    const damage = new THREE.Group(); world.add(damage);
    const scar = [[-330, 150], [-150, 175], [30, 202], [200, 228], [330, 248]];
    for (let i = 0; i < scar.length - 1; i++) { const [ax, az] = scar[i], [bx, bz] = scar[i + 1]; beam(damage, V(ax, bedY(az) + 0.2, az), V(bx, bedY(bz) + 0.2, bz), 4, M.dark); }
    const rs = new THREE.Group(); rs.position.set(70, 0, 205); rs.rotation.y = Math.PI / 2 - 0.15; damage.add(rs);
    const L = 120, B = 20;
    add(U.loft(THREE, [
      { z: -L / 2, pts: U.sym([[B * 0.45, -4], [B * 0.5, 7]]) }, { z: -L * 0.3, pts: U.sym([[B * 0.5, -6], [B * 0.5, 7]]) },
      { z: L * 0.3, pts: U.sym([[B * 0.5, -6], [B * 0.5, 7]]) }, { z: L / 2, pts: U.sym([[1, -2], [2, 9]]) },
    ]), M.dark, rs);
    add(box(B * 0.8, 12, 30), M.body, rs, { y: 13, z: L * 0.22 });
    add(box(B * 0.82, 1.4, 30.4), M.glass, rs, { y: 17, z: L * 0.22, edges: false });
    add(box(B - 1, 0.5, L * 0.5), M.mid, rs, { y: 7.25, z: -L * 0.2, edges: false });
    add(cyl(5, 3, 14), M.light, rs, { y: 8.5, z: -L * 0.12 });          // ケーブルを巻くタンク
    add(new THREE.TorusGeometry(3.4, 0.7, 6, 12, Math.PI), M.light, rs, { y: 9, z: -L / 2 - 1 });   // 船尾のシーブ
    beam(rs, V(-4, 7.5, -L * 0.4), V(-4, 22, -L * 0.48), 1, M.light);   // 船尾の A フレーム
    beam(rs, V(4, 7.5, -L * 0.4), V(4, 22, -L * 0.48), 1, M.light);
    add(box(9, 1, 1), M.light, rs, { y: 22, z: -L * 0.48 });

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    let state = opts.state ?? "normal", clock = 0;
    const apply = () => { const d = state === "damaged"; cableIntact.visible = !d; cableBroken.visible = d; damage.visible = d; };
    apply();
    function update(dt) {
      clock += dt;
      const alarm = state === "damaged" && Math.floor(clock * 2.5) % 2 === 0;   // 損傷に近いブイの警報灯だけ点滅
      buoys.forEach((b, i) => { b.material = alarm && i === 1 ? M.beacon : M.beaconOff; });
      M.sea.map.offset.y -= dt * 0.02;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function check() {
      const r1 = (v) => +v.toFixed(2), keel = -6;
      return {
        repairKeelToBed_m: r1(keel - bedY(205)),                 // 修理船の船底と海底
        buoyToCables_m: r1(Math.min(...[[-40, 120], [70, 160], [140, 250], [-60, 260]].flatMap(([x, z]) => Object.values(routes).map((r) => {   // ブイのソナーの筒とケーブルの水平距離
          const s = sample(r.pts, 12); return Math.min(...s.map(([cx, cz]) => Math.hypot(cx - x, cz - z))) - r.r - 1.2;
        })))),
        cableShallowestY_m: r1(D.bedNear), cutGap_m: D.cut[1] - D.cut[0],
      };
    }

    cableIntact.visible = cableBroken.visible = damage.visible = true;   // 隠れた部分も焼くため、焼くときは全部見せる
    U.bake(THREE, group, { dynamic: [cableIntact, cableBroken, damage], live: [M.accent], also: [M.lamp] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState: (s) => { state = s; apply(); }, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; },
      shots: {
        station: { label: "局舎と柵", target: [20, 8, -200], pos: [120, 70, -100] },
        landing: { label: "砂浜とマンホール", target: [15, 0, -60], pos: [100, 50, 40] },
        sea: { label: "海底のケーブルとブイ", target: [40, -15, 180], pos: [200, 60, 330] },
      },
    };
  }

  DreamAssets.fac.register("cable_station", {
    section: 6, title: "海底ケーブル陸揚げ局", kind: "STRATEGIC FACILITY · 6 情報・通信・産業",
    desc: "バルト海の海岸の目立たない局舎と、入り江から沖へ延びる通信・送電の海底ケーブル。2024 年末の損傷(錨の引きずり)を状態で見せ、沖に無人の水中監視ブイを並べた近未来版",
    info: [["ファイル", "mockups/3d/facilities/cable_station.js"], ["大きさ", "700 × 600 m を 0.15 倍 × 表示 3.0"], ["誇張", "ケーブルの太さ 約 20 倍、局舎 1.3 倍、監視ブイの浮体 2 倍。平面は実寸比"], ["省略", "車両・人・小型船"], ["状態", "通常 / 損傷(送電ケーブルの切断、錨の跡、修理船、警報灯)"], ["近未来化", "沖の無人の水中監視ブイ 4 基"]],
    dist: 700, target: 10, tokenAt: [250, 0, 230],
    make: (THREE) => cableStation(THREE, { r: 75 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["通常", () => a.setState("normal"), () => a.state === "normal"], ["損傷", () => a.setState("damaged"), () => a.state === "damaged"]],
    caption: (a) => (a.state === "damaged" ? "損傷 — 送電ケーブルが錨に引かれて切断、修理船が待機" : ""),
    ringParts: (a) => [a.parts.ring, a.parts.disc],
  });
})();
