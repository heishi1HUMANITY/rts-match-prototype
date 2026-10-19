// 攻略拠点「バーレブ線の砦跡」(東岸。1973 年の戦争の遺構を保存した史跡)。縮尺は拠点の決まり(0.6 単位/m)。
// 象徴: 運河の東岸に沿う高い砂の土塁(実物 約 20 m を 3 倍に誇張して高さ 36)。1973 年に放水で崩された切れ目を 2 か所残す。
// 部品: 土塁(運河側が急な台形)、砦(マオズ)の環状の土塁と東の出入口、半ば埋まったコンクリートの掩体 3、監視所、塹壕、戦車の射撃位置へ上る斜路 3 と土嚢の輪、
//   記念の広場(オベリスク形の碑・銘板の壁・小さな展示館)と道路への小道。保存された史跡なので動きは付けない。
// 近未来化: 土塁の北の頂の監視塔(格子の鉄塔、箱形のレーダーの覆い、電子光学の窓)。省略: 展示の戦車・車両・人・有刺鉄線。
// 運河は x = -530〜-370(局所座標)、地図の道路は x = 200 を南北に通る。
// 史跡の中(2026-10-19 の改善): 見学の小道と展望の台・ベンチ、文字のない解説板、兵舎跡の崩れた低い壁と瓦礫、有刺鉄線の杭の列の残りと鉄条網の輪、
//   土嚢(頂の胸壁 3 段・射撃位置の輪・砦の銃座)、運河側の足の石張り、陸側の斜面の雨の溝、頂の巡回の道、広場の木とベンチ、縁ほど密な低木と小石
(function () {
  DreamAssets.maps.site("barlev", (THREE, ctx) => {
    const { U, F, M, k } = ctx;
    const { add, box, cyl, V, arcLoft, closedLoft, lattice } = k;
    const accent = M.lambert(F.P.neutral);
    const sand = M.lambert(0xd9d1bf), sand2 = M.lambert(0xcfc6b2);
    const group = new THREE.Group(); group.name = "site-barlev";
    const GY = 0.5;   // 台の地面の実際の高さ(suez.js の地形は陸を 0.5 以上にする)。平らな板はこれより上に出す
    const R = { x0: -368, x1: -300, c0: -342, c1: -322, h: 36 };   // 土塁の断面(運河側の足、陸側の足、頂の幅、高さ)

    // ── 土塁: 3 区間(間の 2 か所は 1973 年の切れ目で、低く崩れた砂) ──
    const prof = (h) => [[R.x0, 0], [R.x1 + (R.h - h) * 0.3, 0], [R.c1 + (R.h - h) * 0.3, h], [R.c0, h]];
    for (const [z0, z1] of [[-330, -120], [-90, 130], [160, 330]]) {
      add(U.loft(THREE, [{ z: z0, pts: prof(14) }, { z: z0 + 18, pts: prof(R.h) }, { z: z1 - 18, pts: prof(R.h) }, { z: z1, pts: prof(14) }]), sand, group);
    }
    for (const [z0, z1] of [[-120, -90], [130, 160]]) add(U.loft(THREE, [{ z: z0, pts: prof(14) }, { z: (z0 + z1) / 2, pts: prof(5) }, { z: z1, pts: prof(14) }]), sand2, group);

    // ── 戦車の射撃位置: 土塁の陸側の斜面を上る斜路と、頂の土嚢の輪 ──
    for (const z of [-250, 40, 250]) {
      const ring = (x, y, hw) => [V(x, 0, z - hw), V(x, 0, z + hw), V(x, y, z + hw), V(x, y, z - hw)];
      add(closedLoft([ring(-250, 0.5, 8), ring(-300, 14, 8), ring(-318, 30, 7)]), sand2, group);
      add(new THREE.CylinderGeometry(5.6, 5.6, 0.3, 16), M.lambert(0xc4bba6), group, { x: R.c0 + 10, y: R.h + 0.05, z, edges: false });   // 射撃位置の床(土嚢の輪は下で積む)
    }

    // ── 砦(マオズ): 環状の土塁(東に出入口)、掩体、監視所、塹壕 ──
    const fort = new THREE.Group(); fort.position.set(-225, 0, 0); group.add(fort);
    add(arcLoft([[60, 0], [76, 0], [72, 10], [64, 10]], Math.PI / 2 + 0.28, Math.PI / 2 + 2 * Math.PI - 0.28, 40), sand, fort);
    const FORT_GUNS = [0.6, 2.2, 3.6, 5.0].map((b) => [-225 + 68 * Math.sin(b), 68 * Math.cos(b)]);   // 土塁の上の銃座(土嚢の輪は下で積む)
    const bunker = (x, z, w, d, ry) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; fort.add(g);
      add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), sand2, g, { s: 1 }).scale.set(w * 0.75, 7, d * 0.75);   // 砂をかぶせた覆い
      add(box(w * 0.7, 6, 1.6), M.light, g, { y: 3, z: d * 0.62 });                        // 正面のコンクリート壁
      add(box(w * 0.45, 1.2, 0.3), M.dark, g, { y: 4, z: d * 0.62 + 0.9, edges: false });   // 銃眼
      add(box(3, 4.6, 0.3), M.dark, g, { x: w * 0.25, y: 2.3, z: d * 0.62 + 0.9, edges: false });   // 出入口
    };
    bunker(-18, -14, 34, 24, -Math.PI / 2);   // 指揮所(運河の反対へ口を向ける)
    bunker(22, 28, 22, 16, Math.PI / 2);
    bunker(-26, 34, 22, 16, Math.PI);
    add(box(9, 15, 9), M.light, fort, { x: 8, y: 7.5, z: -36 });                            // 監視所
    add(box(9.2, 1.4, 9.2), M.dark, fort, { x: 8, y: 13, z: -36, edges: false });
    add(box(11, 0.8, 11), M.mid, fort, { x: 8, y: 15.4, z: -36 });
    const trench = [[-40, 6, 30, 0.3], [-10, 20, 34, -0.6], [18, 4, 30, 0.9], [26, -18, 26, -0.2], [-4, -30, 30, 0.5]];
    add(U.merge(THREE, trench.map(([x, z, l, r]) => [box(l, 0.4, 3.4), { x, y: GY - 0.1, z, ry: r }])), M.dark, fort, { edges: false });

    // ── 記念の広場: 舗装、オベリスク形の碑(段の台座)、銘板の壁、展示館、道路への小道 ──
    add(box(96, 0.4, 64), M.light, group, { x: 40, y: GY + 0.2, edges: false });
    for (const [s, h] of [[16, 1.6], [12, 3.2], [9, 4.8]]) add(box(s, 1.6, s), M.light, group, { x: 40, y: h - 0.8 });
    const ob = (y, hw) => [V(40 - hw, y, -hw), V(40 + hw, y, -hw), V(40 + hw, y, hw), V(40 - hw, y, hw)];
    add(closedLoft([ob(4.8, 3.2), ob(40, 2)]), M.body, group);
    add(closedLoft([ob(40, 2), ob(45, 0.05)]), M.light, group);
    add(box(26, 5, 1.6), M.mid, group, { x: 6, y: 2.5, z: -12 });                              // 銘板の壁
    add(box(18, 2.4, 0.3), M.dark, group, { x: 6, y: 2.8, z: -11.1, edges: false });
    add(box(48, 9, 22), M.body, group, { x: 46, y: 4.5, z: 58 });                              // 展示館
    add(box(48.2, 1.6, 22.2), M.glass, group, { x: 46, y: 5, z: 58, edges: false });
    add(box(50, 0.8, 24), M.light, group, { x: 46, y: 9.4, z: 58 });
    add(box(104, 0.3, 8), M.road, group, { x: 137, y: GY + 0.15, edges: false });                     // 道路への小道
    add(box(150, 0.3, 6), M.lambert(0xd6d0c2), group, { x: -80, y: GY + 0.15, edges: false });                       // 砦の出入口から広場へ

    // ── 近未来化: 土塁の北の頂の監視塔 ──
    const tb = V(R.c0 + 10, R.h, -300);
    lattice(group, tb, 34, 2.6, 1.2, 4, 0.3, M.mid);
    add(box(4.4, 0.4, 4.4), M.light, group, { x: tb.x, y: tb.y + 34.2, z: tb.z });
    add(box(4.6, 0.7, 4.6), accent, group, { x: tb.x, y: tb.y + 33.2, z: tb.z, edges: false });
    add(box(1.6, 2.2, 4), M.body, group, { x: tb.x - 1.2, y: tb.y + 35.5, z: tb.z });         // 箱形のレーダーの覆い(運河へ向ける)
    add(box(1.4, 1.2, 1.4), M.dark, group, { x: tb.x + 1.4, y: tb.y + 35, z: tb.z });
    add(box(0.2, 0.7, 1), M.glass, group, { x: tb.x + 0.6, y: tb.y + 35, z: tb.z, edges: false });

    // ── 史跡の中の作り込み(2026-10-19 の改善): 見学の小道と展望の台・ベンチ、文字のない解説板、兵舎跡の低い崩れた壁、有刺鉄線の杭の列の残り、
    //    土塁の土嚢(頂の胸壁・射撃位置・砦の銃座)、運河側の足の石張り、陸側の斜面の雨の溝、頂の巡回の道、広場の植栽、制圧圏の縁ほど密な低木と小石 ──
    const rnd = U.rng(8080);
    const occ = [], occC = [];
    const occupy = (x, z, hx, hz, a = 0) => occ.push({ x, z, hx, hz, c: Math.cos(a), s: Math.sin(a) });
    const occupySeg = ([ax, az], [bx, bz], hw) => { const l = Math.hypot(bx - ax, bz - az), ex = (bx - ax) / l, ez = (bz - az) / l; occupy((ax + bx) / 2, (az + bz) / 2, l / 2, hw, Math.atan2(-ez, ex)); };
    const isFree = (x, z, pad = 0) => !occC.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + pad) && !occ.some((o) => { const dx = x - o.x, dz = z - o.z; return Math.abs(dx * o.c - dz * o.s) < o.hx + pad && Math.abs(dx * o.s + dz * o.c) < o.hz + pad; });
    occupy(-334, 0, 37, 340);                                   // 土塁(運河の岸から陸側の足まで)
    for (const z of [-250, 40, 250]) occupySeg([-248, z], [-320, z], 9);   // 射撃位置への斜路
    occC.push({ x: -225, z: 0, r: 78 });                        // 砦
    occupy(40, 0, 50, 34); occupy(46, 58, 26, 13); occupy(6, -12, 14, 2);   // 広場・展示館・銘板の壁
    occupySeg([85, 0], [189, 0], 5); occupySeg([-155, 0], [-5, 0], 4);      // 既存の小道
    occupySeg([200, -700], [200, 700], 16);                     // 地図の道路
    occupy(-332, -300, 5, 5);                                   // 監視塔
    const flagAt = (() => { const r = ctx.point.r; for (let a = 0.62; a < 0.62 + Math.PI * 2; a += 0.15) { const x = Math.cos(a) * r * 0.85, z = Math.sin(a) * r * 0.85; if (![0, 25, -25].some((d) => ctx.isWater(x + d, z) || ctx.isWater(x, z + d))) return [x, z]; } return [r * 0.72, r * 0.52]; })();
    occupy(flagAt[0] + 12, flagAt[1], 28, 12);
    const pathM = M.lambert(0xd6d0c2), stoneM = M.lambert(0xbfb8a6), gullyM = M.lambert(0xc4bba6), crestM = M.lambert(0xcbc2ac), ruinM = M.lambert(0xd9d6cc), boardM = M.lambert(0x4a5560);

    // 見学の小道(砂利): 砦のまわりの弧、北と南の切れ目の展望の台へ、広場から兵舎跡へ
    const path = (pts, w = 5) => {
      const parts = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az);
        parts.push([box(w, 0.3, l + w * 0.6), { x: (ax + bx) / 2, y: GY + 0.15, z: (az + bz) / 2, ry: Math.atan2(bx - ax, bz - az) }]);
        occupySeg(pts[i], pts[i + 1], w / 2 + 1);
      }
      add(U.merge(THREE, parts), pathM, group, { edges: false });
    };
    const arc = Array.from({ length: 21 }, (_, i) => { const b = Math.PI / 2 - 1.9 + (i * 3.8) / 20; return [-225 + 94 * Math.sin(b), 94 * Math.cos(b)]; });
    path(arc);
    path([arc[0], [-268, 105], [-284, 128], [-286, 140]]);
    path([arc[20], [-268, -100], [-284, -104]]);
    path([[10, -32], [-30, -56], [-62, -66]]); path([[10, 32], [-24, 64], [-44, 78]]);
    for (const [x, z] of [[-288, 145], [-288, -105]]) {   // 展望の台(切れ目の前)と柵・ベンチ
      add(box(16, 0.6, 14), M.light, group, { x, y: GY + 0.3, z }); occupy(x, z, 9, 8);
      for (let i = 0; i <= 4; i++) add(box(0.3, 1.6, 0.3), M.dark, group, { x: x - 8, y: GY + 1.1, z: z - 6 + i * 3, edges: false });
      add(box(0.25, 0.25, 13), M.dark, group, { x: x - 8, y: GY + 1.8, z, edges: false });
      add(box(1, 0.3, 3.4), M.mid, group, { x: x + 3, y: GY + 1.3, z, edges: false });
      for (const dz of [-1.3, 1.3]) add(box(0.8, 0.9, 0.3), M.dark, group, { x: x + 3, y: GY + 0.75, z: z + dz, edges: false });
    }
    // 文字のない解説板(2 本の柱と傾けた板)
    const sign = (x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, GY, z); g.rotation.y = ry; group.add(g);
      for (const dx of [-1.2, 1.2]) add(box(0.25, 2.4, 0.25), M.dark, g, { x: dx, y: 1.2, edges: false });
      add(box(3, 1.8, 0.16), M.light, g, { y: 2.2, rx: -0.35 });
      add(box(2.6, 1.4, 0.1), boardM, g, { y: 2.22, z: 0.08, rx: -0.35, edges: false });
    };
    for (const [x, z, ry] of [[-140, 8, Math.PI / 2], [-6, 22, Math.PI / 2], [-280, 136, -Math.PI / 2], [-280, -96, -Math.PI / 2], [-128, -60, 2.6], [-128, 60, 0.5], [-52, -72, Math.PI], [-36, 86, 0]]) { sign(x, z, ry); occupy(x, z, 2, 2); }
    // 兵舎跡の低い崩れた壁(長方形の基礎。ところどころ欠ける)と瓦礫
    const ruins = [], rubble = [];
    const ruin = (cx, cz, w, d, rows = 1) => {
      const sides = [[cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2], [cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2], [cx + w / 2, cz + d / 2, cx - w / 2, cz + d / 2], [cx - w / 2, cz + d / 2, cx - w / 2, cz - d / 2]];
      if (rows > 1) for (let i = 1; i < rows; i++) sides.push([cx - w / 2, cz - d / 2 + (d * i) / rows, cx + w / 2, cz - d / 2 + (d * i) / rows]);
      for (const [x0, z0, x1, z1] of sides) {
        const l = Math.hypot(x1 - x0, z1 - z0), n = Math.round(l / 2.4), ry = Math.atan2(x1 - x0, z1 - z0);
        for (let i = 0; i < n; i++) {
          if (rnd() < 0.28) continue;
          const t = (i + 0.5) / n, h = 0.5 + rnd() * rnd() * 2.6;
          ruins.push([box(0.9, h, l / n - 0.15), { x: x0 + (x1 - x0) * t, y: GY + h / 2 - 0.1, z: z0 + (z1 - z0) * t, ry }]);
        }
      }
      for (let i = 0; i < w * d * 0.03; i++) rubble.push([cx + (rnd() - 0.5) * (w + 6), cz + (rnd() - 0.5) * (d + 6)]);
    };
    ruin(-80, -86, 40, 22, 2); ruin(-62, 96, 34, 20); ruin(-112, 136, 24, 16); ruin(72, -118, 28, 18, 2); ruin(104, 120, 26, 18); ruin(-20, -150, 30, 16);
    add(U.merge(THREE, ruins), ruinM, group, { edges: false });

    // 有刺鉄線の杭の列の残り(砦の東の弧、北と南の直線。杭は傾き、ところどころ抜ける)と鉄条網の輪
    const wirePts = [], coils = [], posts = [];
    const pickets = (pts, gap) => {
      let prev = null;
      for (const [x, z] of pts) {
        if (gap?.(x, z) || rnd() < 0.18) { prev = null; continue; }
        const lx = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.5, top = [x + lx * 2.2, GY + 2.2, z + lz * 2.2];
        posts.push([box(0.22, 2.4, 0.22), { x: x + lx * 1.1, y: GY + 1.1, z: z + lz * 1.1, rx: lz, rz: -lx }]);
        if (prev && rnd() > 0.22) for (const k of [0.45, 0.85]) {
          const a = [prev[0], GY + prev[1] * k, prev[2]], b = [top[0], GY + 2.2 * k, top[2]], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.3, (a[2] + b[2]) / 2];
          wirePts.push(...a, ...m, ...m, ...b);
        }
        prev = [top[0], 2.2, top[2]];
      }
    };
    const arcPts = (r, b0, b1, step) => { const n = Math.round(((b1 - b0) * r) / step); return Array.from({ length: n + 1 }, (_, i) => { const b = b0 + ((b1 - b0) * i) / n; return [-225 + r * Math.sin(b), r * Math.cos(b)]; }); };
    const linePts = ([ax, az], [bx, bz], step) => { const n = Math.round(Math.hypot(bx - ax, bz - az) / step); return Array.from({ length: n + 1 }, (_, i) => [ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]); };
    pickets(arcPts(116, Math.PI / 2 - 1.3, Math.PI / 2 + 1.3, 3), (x, z) => Math.abs(z) < 6 || !isFree(x, z, 1));
    pickets(linePts([-296, -168], [-150, -168], 3), (x, z) => !isFree(x, z, 1)); pickets(linePts([-296, 172], [-150, 172], 3), (x, z) => !isFree(x, z, 1));
    for (const [x, z] of arcPts(122, Math.PI / 2 + 0.25, Math.PI / 2 + 1.1, 0.75)) { const b = Math.atan2(x + 225, z); coils.push([x, z, b]); }
    for (const [x, z] of linePts([-290, -160], [-200, -160], 0.75)) coils.push([x, z, 0]);
    add(U.merge(THREE, posts), M.lambert(0x6f675c), group, { edges: false });
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(wirePts, 3)), new THREE.LineBasicMaterial({ color: 0x5c564e })));

    // 土塁の頂の巡回の道(砂利)、運河側の足の石張り、陸側の斜面の雨の溝
    const FULL = [[-312, -138], [-72, 112], [178, 312]];   // 高さ 36 の区間
    for (const [z0, z1] of FULL) {
      add(box(14, 0.12, z1 - z0), crestM, group, { x: (R.c0 + R.c1) / 2, y: R.h + 0.06, z: (z0 + z1) / 2, edges: false });
      const fa = [R.x0, 0], fb = [R.x0 + ((R.c0 - R.x0) * 6.5) / R.h, 6.5], n = [-0.811, 0.585];
      add(U.loft(THREE, [z0, z1].map((z) => ({ z, pts: [fa, fb, [fb[0] + n[0] * 0.7, fb[1] + n[1] * 0.7], [fa[0] + n[0] * 0.7, fa[1] + n[1] * 0.7]] }))), stoneM, group);
      for (let z = z0 + 6; z < z1 - 4; z += 14 + rnd() * 16) {
        const y1 = 33 - rnd() * 6, y0 = 3 + rnd() * 14, w = 0.8 + rnd() * 1.4, P = (y) => [R.x1 - ((R.x1 - R.c1) * y) / R.h, y], nl = [0.853, 0.521];
        const ring = (zz) => [V(P(y1)[0] + nl[0] * 0.06, P(y1)[1] + nl[1] * 0.06, zz), V(P(y0)[0] + nl[0] * 0.06, P(y0)[1] + nl[1] * 0.06, zz), V(P(y0)[0] + nl[0] * 0.3, P(y0)[1] + nl[1] * 0.3, zz), V(P(y1)[0] + nl[0] * 0.3, P(y1)[1] + nl[1] * 0.3, zz)];
        add(closedLoft([ring(z - w), ring(z + w)]), gullyM, group, { edges: false });
      }
    }

    // 見学者の駐車場(線だけ。車は置かない)と案内の小屋(道路への小道の南)
    add(box(42, 0.3, 30), M.road, group, { x: 161, y: GY + 0.15, z: 28, edges: false }); occupy(161, 28, 22, 16);
    for (let i = 0; i <= 7; i++) add(box(0.4, 0.06, 9), M.light, group, { x: 143 + i * 5.2, y: GY + 0.33, z: 33, edges: false });
    add(box(7, 4.4, 5), M.body, group, { x: 128, y: GY + 2.2, z: 14 }); add(box(8.4, 0.5, 6.4), M.light, group, { x: 128, y: GY + 4.6, z: 14 }); occupy(128, 14, 5, 4);
    // 広場の植栽(低木の木)、展示館の前の舗装、旗竿 2 本、ベンチ
    add(box(34, 0.3, 14), M.light, group, { x: 46, y: GY + 0.2, z: 40, edges: false });
    for (const x of [26, 32]) { add(cyl(0.25, 14, 6), M.dark, group, { x, y: GY + 7, z: 36, edges: false }); }
    for (const [x, z] of [[-4, 30], [-4, -30], [84, 30], [84, -30], [20, 40], [72, 40]]) add(box(3.2, 0.5, 1), M.mid, group, { x, y: GY + 0.65, z, edges: false });

    // ── 土嚢・鉄条網の輪・木・低木と小石(InstancedMesh、頂点色) ──
    const col = (c) => new THREE.Color(c);
    const tint = (g, c) => ({ geo: g.index ? g.toNonIndexed() : g, color: col(c) });
    const blades = (n, h, w, c, lean, seed) => {
      const pos = [], r = U.rng(seed);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.6, ca = Math.cos(a), sa = Math.sin(a), hh = h * (0.7 + r() * 0.5), l = lean * hh; pos.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * l, hh, sa * l); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      return { geo: g, color: col(c) };
    };
    const GEO = {
      bag: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 1).scale(0.6, 0.26, 0.34), 0xcfc4a8)]),
      coil: U.concat(THREE, [tint(new THREE.TorusGeometry(0.9, 0.06, 3, 10), 0x5c564e)]),
      tuft: U.concat(THREE, [blades(6, 2.8, 0.55, 0xb8bb9c, 0.35, 3)]),
      tuft2: U.concat(THREE, [blades(5, 2.2, 0.5, 0xc6c6a8, 0.45, 7)]),
      scrub: U.concat(THREE, [tint(new THREE.OctahedronGeometry(1, 0).scale(2.6, 1.4, 2.2).translate(0, 0.9, 0), 0xa5ac94), tint(new THREE.OctahedronGeometry(1, 0).scale(1.6, 1.1, 1.5).translate(1.5, 0.8, 0.9), 0x939b84)]),
      salt: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 0).scale(2.2, 1.1, 2.0).translate(0, 0.7, 0), 0xb6b9a9), tint(new THREE.IcosahedronGeometry(1, 0).scale(1.4, 0.9, 1.3).translate(-1.4, 0.6, 0.8), 0xa6aa9a)]),
      stone: U.concat(THREE, [tint(new THREE.IcosahedronGeometry(1, 0).scale(1, 0.55, 0.8), 0xcac3b3)]),
      cas: U.concat(THREE, [tint(new THREE.CylinderGeometry(0.45, 0.75, 11, 6).translate(0, 5.5, 0), 0x8a7d6a), tint(new THREE.IcosahedronGeometry(1, 0).scale(3.6, 8, 3.6).translate(0, 14, 0), 0x8f9f84), tint(new THREE.IcosahedronGeometry(1, 0).scale(2.6, 5.4, 2.6).translate(0.5, 20, -0.3), 0x7f9076)]),
    };
    const inst = {};
    const put = (kind, x, y, z, s = 1, rot = rnd() * 6, q = null) => (inst[kind] ??= []).push([x, y, z, s, rot, q]);
    // 土嚢: 頂の胸壁(運河側の縁に 3 段、千鳥)、射撃位置の輪(3 段、陸側を空ける)、砦の銃座の輪(2 段)、掩体の口の脇
    for (const [z0, z1] of FULL) for (let c = 0; c < 3; c++) for (let z = z0 + (c % 2) * 0.55; z < z1; z += 1.1) {
      if ([-250, 40, 250].some((zr) => Math.abs(z - zr) < 9)) continue;
      put("bag", R.c0 + 1.6, R.h + 0.22 + c * 0.44, z, 1, Math.PI / 2 + (rnd() - 0.5) * 0.12);
    }
    const bagRing = (cx, cy, cz, r, courses, open) => {
      for (let c = 0; c < courses; c++) { const n = Math.round((Math.PI * 2 * r) / 1.05); for (let i = 0; i < n; i++) { const a = ((i + (c % 2) * 0.5) / n) * Math.PI * 2; if (open?.(a)) continue; put("bag", cx + Math.cos(a) * r, cy + 0.22 + c * 0.44, cz + Math.sin(a) * r, 1, -a - Math.PI / 2 + (rnd() - 0.5) * 0.1); } }
    };
    for (const z of [-250, 40, 250]) bagRing(R.c0 + 10, R.h, z, 6, 3, (a) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.45);
    for (const [x, z] of FORT_GUNS) bagRing(x, 10, z, 4.5, 2);
    // 鉄条網の輪(線の向きを軸にする)、広場と小道の木、低木と小石(縁ほど密)
    const zAxis = V(0, 0, 1);
    for (const [x, z, b] of coils) put("coil", x, GY + 0.75, z, 1, 0, new THREE.Quaternion().setFromUnitVectors(zAxis, V(Math.cos(b), 0, -Math.sin(b))));
    for (const [x, z] of [[-10, -42], [-10, 42], [92, -42], [92, 42], [12, -50], [70, -50], [120, 14], [150, -14], [-60, 14], [-110, -14]]) if (isFree(x, z, 3)) put("cas", x, GY - 0.4, z, 0.8 + rnd() * 0.3);
    for (const [x, z] of rubble) if (isFree(x, z, 0.5)) put("stone", x, GY + 0.05, z, 0.8 + rnd() * 1.6);
    for (let x = -150; x <= -10; x += 16) for (const z of [-7, 7]) if (isFree(x, z, 3)) put("cas", x + (rnd() - 0.5) * 4, GY - 0.4, z, 0.7 + rnd() * 0.3);   // 砦への小道の並木
    for (let x = -300; x <= 300; x += 4.6) for (let z = -300; z <= 300; z += 4.6) {
      const jx = x + (rnd() - 0.5) * 4, jz = z + (rnd() - 0.5) * 4, r = Math.hypot(jx, jz);
      if (r > 300 || rnd() > 0.2 + 0.36 * Math.max(0, Math.min(1, (r - 170) / 120))) continue;
      if (!isFree(jx, jz, 1.5) || ctx.isWater(jx, jz) || ctx.isWater(jx - 12, jz)) continue;
      const q = rnd();
      put(q < 0.36 ? "tuft" : q < 0.6 ? "tuft2" : q < 0.74 ? "scrub" : q < 0.86 ? "salt" : "stone", jx, GY + (q < 0.86 ? -0.15 : 0.02), jz, q < 0.86 ? 0.8 + rnd() * 0.6 : 0.6 + rnd() * 1.4);
    }
    // 砦の中(環状の土塁の内側): 掩体・監視所・塹壕を避けて疎らに
    const fortOcc = [[-18, -14, 22], [22, 28, 15], [-26, 34, 15], [8, -36, 8]];
    for (let i = 0; i < 900; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 56, fx = Math.sin(a) * d, fz = Math.cos(a) * d;
      if (fortOcc.some(([x, z, r]) => Math.hypot(fx - x, fz - z) < r) || trench.some(([x, z, l, r]) => Math.abs((fx - x) * Math.cos(r) - (fz - z) * Math.sin(r)) < l / 2 + 1 && Math.abs((fx - x) * Math.sin(r) + (fz - z) * Math.cos(r)) < 3)) continue;
      if (rnd() > 0.45) continue;
      const q = rnd();
      put(q < 0.45 ? "tuft2" : q < 0.7 ? "tuft" : q < 0.82 ? "salt" : "stone", -225 + fx, GY + (q < 0.82 ? -0.15 : 0.02), fz, q < 0.82 ? 0.7 + rnd() * 0.5 : 0.5 + rnd() * 1.2);
    }
    {
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = V(0, 1, 0), tc = new THREE.Color();
      for (const [kind, list] of Object.entries(inst)) {
        const side = kind === "tuft" || kind === "tuft2" ? THREE.DoubleSide : THREE.FrontSide;
        const im = new THREE.InstancedMesh(GEO[kind], new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side }), list.length);
        list.forEach(([x, y, z, s, r, qq], i) => { mt.compose(V(x, y, z), qq ?? q.setFromAxisAngle(up, r), sc.set(s, kind === "bag" || kind === "coil" ? s : s * (0.85 + rnd() * 0.3), s)); im.setMatrixAt(i, mt); im.setColorAt(i, tc.setScalar(kind === "bag" ? 0.86 + rnd() * 0.2 : 0.92 + rnd() * 0.12)); });
        group.add(im);
      }
    }

    function setTeam(c) { accent.color.set(c ?? F.P.neutral); }
    function check() {
      const pts = [[R.x0, 0], [R.x0, -330], [R.x0, 330], [-225 - 76, 0], [tb.x, tb.z]];
      return {
        rampartHeight: R.h,
        anyInWater: pts.some(([x, z]) => ctx.isWater(x, z)),
        rampartToCanal: R.x0 - -370,                     // 土塁の運河側の足と岸
        plazaPathToRoad: 200 - 11 - (137 + 52),          // 小道の端と地図の道路の縁
        interior: (() => {   // 史跡の中の小物: 数と、水・小道・広場の上に置いていないか
          let n = 0, wet = 0;
          for (const [kind, list] of Object.entries(inst)) for (const [x, , z] of list) { n++; if (kind !== "bag" && ctx.isWater(x, z)) wet++; }
          return { items: n, inWater: wet, sandbags: inst.bag?.length ?? 0, coils: inst.coil?.length ?? 0, ruinWalls: ruins.length, flagAt: flagAt.map((v) => +v.toFixed(1)) };
        })(),
      };
    }
    U.bake(THREE, group, { live: [accent] });
    return { group, setTeam, check };
  });
})();
