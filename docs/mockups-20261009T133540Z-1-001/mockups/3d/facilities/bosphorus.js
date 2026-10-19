// 戦略施設トークン「ボスポラス海峡」(トルコ・イスタンブール)の詳細版モデル(試作)。
// 決め手は「海峡をまたぐ吊り橋と両岸の市街」。7 月 15 日殉教者の橋(旧ボスポラス橋。中央径間 1074 m、主塔 165 m、桁下 64 m、斜めのハンガー)の前後
// 2.1 × 1.6 km を切り取り、実寸の比率で組む。海底に鉄道の沈埋トンネルと道路のシールドトンネル(実物は少し南。同じ切り取りに寄せた)。
// 誇張: 主ケーブルの太さ 約 6 倍(0.6 → 3.6 m)、ハンガー 2 倍、桁の背 約 2 倍(3 → 6 m)。高さ・平面は実寸比。
// 省略: 車両・人・小型船。船は長さ 200 m 以上のタンカーとばら積み船だけ。
// 近未来化(施設リストの案): 北の入口の通航管制所(管制棟・箱形のレーダーの覆いの鉄塔・桟橋)と、海峡を横切る監視ブイの列(海上ドローン監視網)。
// 状態: "hold"(通航制限: タンカーは北の待機錨地で停船)→ "transit"(通航: 橋の下を南へ抜ける。約 40 秒)→ "passed"(通過済み)。
// 座標: x が東(+x がアジア側)、z が南(-z が黒海、+z がマルマラ海)。
(function () {
  const K = 0.075;
  const D = {
    x0: -1050, x1: 1050, z0: -800, z1: 800,
    ground: 4, bed: -50, base: -54,
    span: 1074, tower: 165, deck: 64, cableZ: 22, deckW: 16.5, anchor: 792, sag: 92,   // 主塔の柱・ケーブルは桁の縁(±16.5)の外
    tanker: { L: 250, B: 44, fb: 8, dr: 14, air: 42, x: 150, hold: -620, end: 620 },
  };
  D.tx = D.span / 2;
  const SEC = 40;

  function bosphorus(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const zoneR = opts.r ?? 105;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE); M.sea.side = THREE.DoubleSide;
    const XC = 0, ZC = 0;
    const group = new THREE.Group(); group.name = "bosphorus";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, prism, tube, beam } = k;
    const rnd = U.rng(41);

    // ── 両岸の陸(入り江のある岸線)と、等高線の段の丘 ──
    const shoreW = [[-560, D.z0], [-530, -560], [-610, -330], [-600, -180], [-525, -40], [-525, 40], [-580, 260], [-640, 430], [-575, 600], [-560, D.z1]];
    const shoreE = [[560, D.z0], [600, -520], [545, -300], [520, -60], [525, 40], [610, 230], [585, 460], [540, 620], [565, D.z1]];
    add(prism([[D.x0, D.z0], ...shoreW, [D.x0, D.z1]], D.base, D.ground), M.land, world);
    add(prism([[D.x1, D.z1], ...shoreE.slice().reverse(), [D.x1, D.z0]], D.base, D.ground), M.land, world);
    const LV = [[D.ground, 20], [20, 40], [40, 60], [60, 85]];
    const hills = [];   // [cx, cz, rx, rz, 段数] 中心から段ごとに縮める
    for (const s of [-1, 1]) hills.push([s * 1050, 0, 470, 640, 3], [s * 980, -560, 260, 200, 4], [s * 980, 560, 280, 220, 4]);
    const ell = (cx, cz, rx, rz, f, n = 16) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + rx * f * Math.cos(a), cz + rz * f * Math.sin(a)]; });
    const F_ = [1, 0.76, 0.54, 0.32];
    const clipX = (pts, s) => pts.map(([x, z]) => [s < 0 ? Math.max(x, D.x0) : Math.min(x, D.x1), Math.max(D.z0, Math.min(D.z1, z))]);
    for (const [cx, cz, rx, rz, n] of hills) for (let i = 0; i < n; i++) add(prism(clipX(ell(cx, cz, rx, rz, F_[i]), Math.sign(cx)), LV[i][0], LV[i][1]), M.land, world);
    const heightAt = (x, z) => {   // その点の段の上面(建物の足元)
      let h = D.ground;
      for (const [cx, cz, rx, rz, n] of hills) for (let i = 0; i < n; i++) { const dx = (x - cx) / (rx * F_[i]), dz = (z - cz) / (rz * F_[i]); if (dx * dx + dz * dz < 0.97) h = Math.max(h, LV[i][1]); }
      return h;
    };
    // 市街: 岸の帯と段の上に建物(四隅が同じ段に載るものだけ)
    const shoreXAt = (s, z) => { const sh = s < 0 ? shoreW : shoreE; for (let i = 0; i < sh.length - 1; i++) if (z >= sh[i][1] && z <= sh[i + 1][1]) { const t = (z - sh[i][1]) / (sh[i + 1][1] - sh[i][1]); return sh[i][0] + (sh[i + 1][0] - sh[i][0]) * t; } return s * 560; };
    let nb = 0;
    const KEEP = [[-760, -640, -700, -620], [660, 740, 430, 600], [-740, -660, 430, 600]];   // [x0, x1, z0, z1]
    const blocked = (x, z, r) => KEEP.some(([a, b, c, d]) => x > a - r && x < b + r && z > c - r && z < d + r);
    for (let i = 0; i < 700 && nb < 150; i++) {
      const s = rnd() < 0.5 ? -1 : 1, z = D.z0 + 30 + rnd() * (D.z1 - D.z0 - 60), x = shoreXAt(s, z) + s * (30 + rnd() * 470);
      if (Math.abs(x) > D.x1 - 30 || Math.abs(z) < 60) continue;   // 橋・アンカレイジ・トンネルの建屋・管制所の上は空ける
      const w = 22 + rnd() * 30, d = 14 + rnd() * 14, h = 9 + rnd() * 21, ry = (rnd() - 0.5) * 0.5;
      const hs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => heightAt(x + (a * w) / 2, z + (b * d) / 2));
      if (Math.max(...hs) !== Math.min(...hs) || Math.abs(shoreXAt(s, z) - x) < 25 || blocked(x, z, w)) continue;
      add(box(w, h, d), rnd() < 0.75 ? M.body : M.light, world, { x, y: hs[0] + h / 2, z, ry }); nb++;
    }
    // 海: 水面、海底、南北の水の切り口
    world.add(k.waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], M.sea));
    add(box(D.x1 - D.x0, D.bed - D.base, D.z1 - D.z0), M.light, world, { y: (D.base + D.bed) / 2, edges: false });
    world.add(new THREE.Mesh(U.merge(THREE, [D.z0, D.z1].map((z) => [new THREE.PlaneGeometry(1130, -D.bed), { y: D.bed / 2, z }])), M.waterCut));
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base);

    // ── 吊り橋 ──
    const cableY = (x) => { const u = x / D.tx; return D.tower - D.sag * (1 - u * u); };   // 主ケーブル(放物線。主塔の頂部 x = ±tx)
    // 主塔: 鋼の箱形の 2 本の柱(上ほど細い)と 3 段の横梁
    for (const s of [-1, 1]) {
      const tx = s * D.tx;
      add(box(34, 12, 70), M.light, world, { x: tx, y: D.ground - 4, z: 0 });   // 基礎
      for (const z of [-D.cableZ, D.cableZ]) {
        add(U.loft(THREE, [{ z: 0, pts: [[-5, -4.5], [5, -4.5], [5, 4.5], [-5, 4.5]] }, { z: D.tower - D.ground, pts: [[-3.5, -3], [3.5, -3], [3.5, 3], [-3.5, 3]] }]), M.body, world, { x: tx, y: D.ground, z, rx: -Math.PI / 2 });
      }
      for (const y of [D.deck - 8, 115, D.tower - 4]) add(box(6, y > 100 ? 7 : 9, 2 * D.cableZ), M.body, world, { x: tx, y, z: 0 });   // 最下段は桁の下
      add(box(10, 3, 10), M.mid, world, { x: tx, y: D.tower + 1.5, z: -D.cableZ });   // ケーブルの鞍
      add(box(10, 3, 10), M.mid, world, { x: tx, y: D.tower + 1.5, z: D.cableZ });
      // アンカレイジ(陸の段の上のコンクリートの塊)と側径間の橋脚
      const ax = s * D.anchor;
      add(box(60, D.deck + 2.9 - 30, 70), M.light, world, { x: ax + s * 18, y: (D.deck + 2.9 + 30) / 2, z: 0 });   // 上面は桁の天端とそろえる
      for (const px of [s * (D.tx + 120)]) { const g0 = heightAt(px, 0); add(box(10, D.deck - 3 - g0, 26), M.light, world, { x: px, y: (D.deck - 3 + g0) / 2, z: 0 }); }
      // アンカレイジの先の取付高架(段の上、低い橋脚)
      add(box(D.x1 - ax - 48, 3, 33), M.body, world, { x: s * (ax + 48 + (D.x1 - ax - 48) / 2), y: D.deck + 1.5 });
      for (const px of [ax + 90, ax + 160, ax + 230]) { const g0 = heightAt(s * px, 0); add(box(6, D.deck - g0, 18), M.light, world, { x: s * px, y: (D.deck + g0) / 2, z: 0 }); }
    }
    // 主ケーブルと控えケーブル(太さを誇張)、ハンガー(斜めのジグザグ)
    const CR = 1.8, N = 24;
    for (const z of [-D.cableZ, D.cableZ]) {
      for (let i = 0; i < N; i++) { const xa = -D.tx + (2 * D.tx * i) / N, xb = -D.tx + (2 * D.tx * (i + 1)) / N; tube(world, V(xa, cableY(xa), z), V(xb, cableY(xb), z), CR, M.light); }
      for (const s of [-1, 1]) tube(world, V(s * D.tx, D.tower, z), V(s * (D.anchor - 12), D.deck, z), CR, M.light);   // 控えケーブル(アンカレイジの前面へ)
      for (let i = 1; i < 2 * N; i++) {
        const xc = -D.tx + (D.tx * i) / N, xd = xc + (i % 2 ? 9 : -9);
        if (Math.abs(xd) > D.tx - 6) continue;
        tube(world, V(xc, cableY(xc) - CR, z), V(xd, D.deck + 2.6, Math.sign(z) * (D.deckW - 0.4)), 0.5, M.mid);
      }
    }
    // 桁: 扁平な箱桁(断面は台形)。主塔の間とアンカレイジまで。縁に高欄と中央分離帯
    const deckG = U.loft(THREE, [{ z: -D.anchor + 4, pts: [[-10, D.deck - 3], [10, D.deck - 3], [16.5, D.deck + 1.5], [16.5, D.deck + 3], [-16.5, D.deck + 3], [-16.5, D.deck + 1.5]] }, { z: D.anchor - 4, pts: [[-10, D.deck - 3], [10, D.deck - 3], [16.5, D.deck + 1.5], [16.5, D.deck + 3], [-16.5, D.deck + 3], [-16.5, D.deck + 1.5]] }]);
    add(deckG, M.body, world, { ry: Math.PI / 2 });
    for (const z of [-15.8, 15.8]) add(box(2 * D.anchor - 8, 1.2, 0.5), M.dark, world, { y: D.deck + 3.6, z, edges: false });
    add(box(2 * D.anchor - 8, 0.8, 1.2), M.accent, world, { y: D.deck + 3.4, edges: false });   // 中央分離帯(チーム色)

    // ── 海底トンネル: 鉄道の沈埋函(四角)と道路のシールドトンネル(丸)。両岸に換気・立坑の建屋 ──
    for (const [z, round] of [[470, false], [560, true]]) {
      const len = 1160;
      if (round) { const g = cyl(7, len, 12); g.rotateZ(Math.PI / 2); add(g, M.dark, world, { y: D.bed + 5, z }); }
      else { add(box(len, 9, 16), M.dark, world, { y: D.bed + 4.5, z }); add(box(len, 3, 30), M.mid, world, { y: D.bed + 1.5, z, edges: false }); }   // 保護の捨石
      for (const s of [-1, 1]) {
        add(box(36, 18, 26), M.light, world, { x: s * 700, y: D.ground + 9, z });
        add(box(36.4, 2, 26.4), M.glass, world, { x: s * 700, y: D.ground + 13, z, edges: false });
        for (const dx of [-10, 0, 10]) add(cyl(2.2, 10, 10), M.mid, world, { x: s * 700 + dx, y: D.ground + 23, z });
      }
    }

    // ── 近未来化 1: 北の入口の通航管制所(欧州側の岬)。管制棟、レーダーの鉄塔、桟橋 ──
    const vts = new THREE.Group(); vts.position.set(-700, D.ground, -660); world.add(vts);
    add(box(60, 14, 30), M.body, vts, { y: 7 });
    add(box(60.4, 2.4, 30.4), M.glass, vts, { y: 10, edges: false });
    add(box(30, 6, 20), M.body, vts, { x: -8, y: 17 });
    add(box(30.4, 2.6, 20.4), M.glass, vts, { x: -8, y: 18, edges: false });   // 最上階の管制室(全面の窓)
    add(box(31, 0.6, 21), M.accent, vts, { x: -8, y: 20.3, edges: false });
    k.lattice(vts, V(20, 0, 0), 46, 4, 1.6, 5, 0.5, M.mid);
    add(box(8, 3.6, 3.2), M.body, vts, { x: 20, y: 48 });   // 箱形のレーダーの覆い(回さない)
    add(box(2.4, 2.2, 2.4), M.dark, vts, { x: 20, y: 51.5 });
    add(box(1.6, 0.9, 0.2), M.glass, vts, { x: 20, y: 51.6, z: 1.3, edges: false });
    add(box(100, 3, 10), M.light, world, { x: -495, y: 1.5, z: -600 });   // 巡視の桟橋
    // ── 近未来化 2: 海峡を横切る監視ブイの列(浮体・太陽電池・センサーの頭。浮体の径は 2 倍) ──
    const buoys = [];
    for (let i = 0; i < 6; i++) {
      const x = -460 + i * 184, z = -470;
      const g = new THREE.Group(); g.position.set(x, 0, z); world.add(g);
      add(cyl(3, 4, 12), M.body, g, { y: 0.5 });
      add(cyl(3.1, 1, 12), M.accent, g, { y: 1.5, edges: false });
      add(cyl(0.4, 8, 6), M.mid, g, { y: 6.5 });
      add(box(3, 0.2, 2), M.glass, g, { y: 7, rx: -0.5, edges: false });   // 太陽電池
      add(box(1.4, 1.2, 1.4), M.dark, g, { y: 11 });
      buoys.push(g);
    }

    // ── 船: 停泊中のばら積み船(アジア側の錨地)と、通航するタンカー ──
    const ship = (parent, { L, B, fb, dr, house }) => {
      const g = new THREE.Group(); parent.add(g);
      add(U.loft(THREE, [
        { z: -L / 2, pts: U.sym([[B * 0.42, -dr + 2], [B * 0.5, fb]]) },
        { z: -L * 0.38, pts: U.sym([[B * 0.5, -dr], [B * 0.5, fb]]) },
        { z: L * 0.36, pts: U.sym([[B * 0.5, -dr], [B * 0.5, fb]]) },
        { z: L * 0.47, pts: U.sym([[B * 0.22, -dr + 1], [B * 0.42, fb + 1]]) },
        { z: L / 2, pts: U.sym([[1, -dr + 4], [2, fb + 2]]) },
      ]), M.dark, g);
      add(box(B - 0.6, 0.6, L * 0.8), M.mid, g, { y: fb + 0.3, z: L * 0.02, edges: false });
      add(box(B * 0.84, house, B * 0.4), M.body, g, { y: fb + house / 2, z: -L * 0.4 });   // 船橋楼
      add(box(B * 0.86, 1.4, B * 0.42), M.glass, g, { y: fb + house - 2, z: -L * 0.4, edges: false });
      add(box(4, 10, 4), M.light, g, { y: fb + house + 5, z: -L * 0.45 });   // 煙突
      return g;
    };
    const tanker = ship(world, { ...D.tanker, house: 24 });
    for (let i = 0; i < 5; i++) add(box(D.tanker.B * 0.7, 1.2, 3), M.light, tanker, { y: D.tanker.fb + 1.2, z: -60 + i * 35, edges: false });   // 甲板の配管の橋
    tanker.position.x = D.tanker.x;
    const bulk = ship(world, { L: 200, B: 32, fb: 7, dr: 11, house: 20 });
    bulk.position.set(380, 0, 330); bulk.rotation.y = 0.12;
    for (let i = 0; i < 5; i++) add(box(22, 2.4, 16), M.light, bulk, { y: 8.2, z: -55 + i * 32 });   // 艙口蓋
    for (let i = 0; i < 4; i++) { add(cyl(1.2, 14, 8), M.light, bulk, { x: 0, y: 14, z: -40 + i * 32 }); beam(bulk, V(0, 20, -40 + i * 32), V(9, 24, -28 + i * 32), 1, M.light); }   // 甲板クレーン

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, zoneR, M.ring, M.disc);

    // ── 状態: タンカーの位置 t(0 = 北の錨地、1 = 南へ抜けた) ──
    const ease = (x) => x * x * (3 - 2 * x);
    let state = opts.state ?? "hold", t = state === "passed" ? 1 : 0;
    const apply = () => { tanker.position.z = D.tanker.hold + (D.tanker.end - D.tanker.hold) * ease(t); };
    apply();
    function update(dt) {
      if (state === "transit") { t = Math.min(1, t + dt / SEC); if (t >= 1) state = "passed"; }
      apply();
      M.sea.map.offset.y -= dt * 0.12;   // 表層は黒海からマルマラ海へ(+z)流れる
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "hold") { state = s; t = 0; apply(); }
      else if (s === "passed") { state = s; t = 1; apply(); }
      else if (s === "transit") { if (t >= 1) t = 0; state = s; }
    }
    function check() {
      const r1 = (v) => +v.toFixed(2), T = D.tanker;
      // タンカーの最高部(煙突の頂部)と桁下、船体の幅と主塔の基礎、ブイの列と船体の横の隙間
      const keel = D.bed - -T.dr;
      return {
        airDraftToDeck_m: r1(D.deck - 3 - (T.fb + 24 + 10)),
        hullToTowerFoot_m: r1(D.tx - 17 - (T.x + T.B / 2)),
        hullToBuoys_m: r1(Math.min(...[-460, -276, -92, 92, 276, 460].map((bx) => Math.abs(bx - T.x) - T.B / 2 - 3))),
        keelToBed_m: r1(-T.dr - D.bed), keelToTunnel_m: r1(-T.dr - (D.bed + 9)),
        hullToBulkCarrier_m: r1(380 - 16 - 30 - (T.x + T.B / 2)),
        midspanCableToDeck_m: r1(cableY(0) - CR - (D.deck + 3)),
      };
    }

    U.bake(THREE, group, { dynamic: [tanker], live: [M.accent], also: [M.lamp] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, setTeam: (c) => F.setTeam(M, c), setState, check, stats: () => U.stats(group), parts: { ring, disc }, at,
      get state() { return state; }, get progress() { return t; },
      shots: {
        bridge: { label: "吊り橋(主塔・ハンガー)", target: [-300, 80, 0], pos: [-120, 140, 420] },
        tower: { label: "主塔とアンカレイジ", target: [-640, 70, 0], pos: [-380, 120, -260] },
        vts: { label: "通航管制所・監視ブイ", target: [-560, 10, -560], pos: [-260, 140, -260] },
        tunnel: { label: "海底トンネル", target: [0, -40, 510], pos: [140, 90, 760] },
      },
    };
  }

  DreamAssets.fac.register("bosphorus", {
    section: 3, title: "ボスポラス海峡", kind: "STRATEGIC FACILITY · 3 海峡・島",
    desc: "海峡をまたぐ吊り橋(7 月 15 日殉教者の橋)と両岸の市街、海底の鉄道・道路トンネル。北の入口の通航管制所と、海峡を横切る監視ブイの列を足した近未来版。交戦国の軍艦の通航制限を、タンカーの待機と通航で見せる",
    info: [["ファイル", "mockups/3d/facilities/bosphorus.js"], ["大きさ", "橋の前後 2.1 × 1.6 km を 0.075 倍 × 表示 3.0"], ["誇張", "主ケーブルの太さ 約 6 倍、ハンガー 2 倍、桁の背 約 2 倍。高さ・平面は実寸比"], ["省略", "車両・人・小型船(船は長さ 200 m 以上だけ)"], ["動作", "通航: タンカーが錨地から橋の下を南へ抜ける(40 秒)"], ["近未来化", "通航管制所(管制棟・レーダーの鉄塔・桟橋)、監視ブイの列"]],
    dist: 1000, target: 30, tokenAt: [380, 0, 280],
    make: (THREE) => bosphorus(THREE, { r: 105 }),
    actLabel: "PASSAGE · 通航", progress: true,
    actions: (a) => [["通航制限(待機)", () => a.setState("hold"), () => a.state === "hold"], ["通航 ▶", () => a.setState("transit"), () => a.state === "transit"], ["通過済み", () => a.setState("passed"), () => a.state === "passed"]],
    caption: (a) => (a.state === "transit" ? "通航中 — タンカーが橋の下を南へ" : a.state === "hold" ? "通航制限 — 北の錨地で待機" : ""),
    ringParts: (a) => [a.parts.ring, a.parts.disc],
  });
})();
