// 戦略施設トークン「ルーデンドルフ鉄橋」(ドイツ・レマーゲン)の現在の姿の詳細版モデル(試作)。
// 橋は 1945 年に崩落し、川の中の橋脚も撤去された。残っているのは両岸の橋台に立つ石造の橋塔だけ(西岸の塔は平和博物館)。
// 東岸の橋塔のすぐ後ろには玄武岩の崖エルペラー・レイがそびえ、鉄道はトンネルで崖を抜けていた。ライン川(約 310 m)と両岸を 680 × 340 m で切り取る。
// 平面の配置は実寸の比率(K = 0.25)。歴史的施設(節 8)なので近未来化はなく、状態もない。
// 誇張: 決め手の「川を挟んで向かい合う 2 つの塔」— 塔の高さ 1.4 倍、銃眼・狭間・胸壁の凹凸を大きめに。
// 省略: 車両・人、船、街路樹、案内板。西岸の街並みは街区の塊だけ。
//
//   const a = DreamAssets.fac.defs.remagen.make(THREE)(制圧圏 r = 100)
// 旧橋の軸は x 方向(-x が西岸・レマーゲン、+x が東岸・エルペル)、川は z 方向。
(function () {
  const K = 0.25;
  const D = {
    x0: -340, x1: 340, z0: -170, z1: 170, bed: -8, base: -10,
    wetW: -160, wetE: 150, west: 8, east: 6,                // 水際、両岸の地盤の高さ
    towerW: -192, towerE: 178, rail: 16, towerH: 26 * 1.4,   // 橋塔の中心の x、軌道の高さ、塔の高さ(軌道から、誇張後)
    cliff: 222,                                               // 崖の足元の x
  };

  function remagen(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.river = U.waterMaterial(THREE);
    M.basalt = M.lambert(0x5d646c);   // 黒い玄武岩の石積み(暗すぎない灰)
    M.rock = M.lambert(0x8b9097);     // 崖の岩
    const group = new THREE.Group(); group.name = "remagen";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, prism } = k;
    const W = D.x1 - D.x0, Dz = D.z1 - D.z0, rnd = U.rng(7);

    // ── 地形: 川、両岸の護岸と地盤 ──
    F.plinth(k, M, world, W, Dz, D.base);
    add(box(D.wetE - D.wetW + 40, D.bed - D.base, Dz), M.light, world, { x: (D.wetW + D.wetE) / 2, y: (D.bed + D.base) / 2 });
    const wl = [D.wetW - 3.4, D.wetE + 3.6];   // 水面の端(護岸の斜面が水面と交わる所)
    world.add(k.waterShape([[wl[0], D.z0], [wl[1], D.z0], [wl[1], D.z1], [wl[0], D.z1]], M.river));
    world.add(new THREE.Mesh(U.merge(THREE, [D.z0, D.z1].map((z) => [new THREE.PlaneGeometry(wl[1] - wl[0], -D.bed), { x: (wl[0] + wl[1]) / 2, y: D.bed / 2, z }])), M.waterCut));
    const bankW = [[D.x0, D.base], [D.wetW + 4, D.base], [D.wetW + 4, D.bed], [D.wetW - 2, -1], [D.wetW - 14, D.west], [D.x0, D.west]];
    const bankE = [[D.wetE - 4, D.base], [D.x1, D.base], [D.x1, D.east], [D.wetE + 14, D.east], [D.wetE + 2, -1], [D.wetE - 4, D.bed]];
    for (const pts of [bankW, bankE]) add(U.loft(THREE, [{ z: D.z0, pts }, { z: D.z1, pts }]), M.land, world);
    add(box(10, 0.15, Dz), M.mid, world, { x: D.wetW - 22, y: D.west + 0.08, edges: false });   // 西岸の遊歩道・河岸道路
    add(box(10, 0.15, Dz), M.mid, world, { x: D.wetE + 22, y: D.east + 0.08, edges: false });   // 東岸の道路(B42)
    add(box(5, 0.5, Dz), M.mid, world, { x: D.wetE + 32, y: D.east + 0.25, edges: false });    // 東岸の鉄道(右岸線)の道床
    add(box(1.6, 0.3, Dz), M.dark, world, { x: D.wetE + 32, y: D.east + 0.6, edges: false });

    // ── 橋塔(両岸に 1 組ずつ): 橋台の石積み、2 本の塔、間の門(アーチの開口)、胸壁 ──
    function towers(cx, ground, facing, under) {
      const g = new THREE.Group(); g.position.set(cx, 0, 0); world.add(g);
      const r0 = D.rail, H = D.towerH, gap = 9;   // 塔の内面は z = ±gap
      // 橋台(川側に旧橋の支承の台)。河岸の道路・鉄道は橋台の下のアーチの通路をくぐる(under = [x0, x1, 高さ] 世界の x)
      const ab = new THREE.Shape([new THREE.Vector2(-17, ground - 2), new THREE.Vector2(17, ground - 2), new THREE.Vector2(17, r0), new THREE.Vector2(-17, r0)]);
      for (const [xa, xb, h] of under) {
        const a = xa - cx, b = xb - cx, rr = (b - a) / 2, hp = new THREE.Path();
        hp.moveTo(a, ground); hp.lineTo(b, ground); hp.lineTo(b, ground + h - rr); hp.absarc((a + b) / 2, ground + h - rr, rr, 0, Math.PI, false); hp.lineTo(a, ground);
        ab.holes.push(hp);
      }
      const abG = new THREE.ExtrudeGeometry(ab, { depth: 46, bevelEnabled: false, curveSegments: 8 }); abG.translate(0, 0, -23);
      add(abG, M.basalt, g);
      add(box(6, 1.6, 40), M.basalt, g, { x: facing * 19, y: r0 - 0.8 });
      for (const s of [-1, 1]) {
        const z = s * (gap + 5.5), T = new THREE.Group(); T.position.set(0, r0, z); g.add(T);
        add(box(13, 3, 13), M.basalt, T, { y: 1.5 });                                         // 塔の基部(少し張り出す)
        add(box(11, H, 11), M.basalt, T, { y: H / 2 });
        for (const y of [H * 0.33, H * 0.66]) add(box(11.6, 0.8, 11.6), M.mid, T, { y, edges: false });   // 胴蛇腹
        add(box(13, 3.2, 13), M.basalt, T, { y: H + 1.6 });                                    // 張り出した胸壁の台(持ち送り)
        for (let i = 0; i < 4; i++) for (let j = -2; j <= 2; j++) {                              // 胸壁の凸(狭間の間)
          const a = (i * Math.PI) / 2, ux = Math.cos(a), uz = Math.sin(a);
          add(box(1.8, 2.2, 1.0), M.basalt, T, { x: ux * 6.0 - uz * j * 2.6, y: H + 4.3, z: uz * 6.0 + ux * j * 2.6, ry: -a });
        }
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {                            // 角の見張り小塔
          if (sz === -s) continue;   // 門の側には付けない
          add(cyl(1.8, 6, 8), M.basalt, T, { x: sx * 5.8, y: H + 3, z: sz * 5.8 });
          add(new THREE.ConeGeometry(2.2, 3.5, 8), M.mid, T, { x: sx * 5.8, y: H + 7.75, z: sz * 5.8 });
        }
        for (const lv of [0.18, 0.48, 0.8]) for (let f = 0; f < 4; f++) {                         // 銃眼・細い窓(暗いガラス)
          const a = (f * Math.PI) / 2, ux = Math.cos(a), uz = Math.sin(a);
          if (Math.abs(uz) > 0.5 && Math.sign(uz) === -s) continue;   // 門の側の面は省く
          add(box(0.25, 3.2, 1.0), M.glass, T, { x: ux * 5.55, y: H * lv, z: uz * 5.55, ry: -a, edges: false });
        }
      }
      // 門: 塔の間の壁に半円のアーチの開口(旧軌道が通った)、上に胸壁
      const sh = new THREE.Shape([new THREE.Vector2(-gap, 0), new THREE.Vector2(gap, 0), new THREE.Vector2(gap, 21), new THREE.Vector2(-gap, 21)]);
      const hole = new THREE.Path(); hole.moveTo(-6.5, 0); hole.lineTo(6.5, 0); hole.lineTo(6.5, 9); hole.absarc(0, 9, 6.5, 0, Math.PI, false); hole.lineTo(-6.5, 0); sh.holes.push(hole);
      const gate = new THREE.ExtrudeGeometry(sh, { depth: 8, bevelEnabled: false, curveSegments: 10 }); gate.translate(0, 0, -4); gate.rotateY(Math.PI / 2);
      add(gate, M.basalt, g, { y: r0 });
      for (let j = -3; j <= 3; j++) add(box(5, 2.0, 1.6), M.basalt, g, { y: r0 + 22, z: j * 2.6, ry: Math.PI / 2 });
      add(box(9, 0.6, 2 * gap), M.mid, g, { y: r0 + 21.3, edges: false });
      // 旧軌道の道床(門をくぐって陸側の盛土へ)
      add(box(34, 0.6, 9), M.mid, g, { y: r0 + 0.3, edges: false });
      return g;
    }
    towers(D.towerW, D.west, 1, [[D.wetW - 27, D.wetW - 17, 6.5]]);
    towers(D.towerE, D.east, -1, [[D.wetE + 17, D.wetE + 27, 6.5], [D.wetE + 29, D.wetE + 35, 7.5]]);
    // 西岸: 旧線の盛土(町から橋台へ上がる)。東岸: 橋台から崖のトンネルへ
    const emb = (x, y0, h, w) => [V(x, y0 - 0.01, -(w + h * 1.5)), V(x, y0 - 0.01, w + h * 1.5), V(x, y0 + h, w), V(x, y0 + h, -w)];
    add(k.closedLoft([emb(D.x0, D.west, D.rail - D.west - 0.05, 6), emb(D.towerW - 17, D.west, D.rail - D.west - 0.05, 6)]), M.land, world);
    add(k.closedLoft([emb(D.towerE + 17, D.east, D.rail - D.east - 0.05, 6), emb(D.cliff + 4, D.east, D.rail - D.east - 0.05, 6)]), M.land, world);
    add(box(D.cliff - D.towerE - 13, 0.6, 9), M.mid, world, { x: (D.towerE + 17 + D.cliff + 4) / 2, y: D.rail + 0.25, edges: false });

    // ── エルペラー・レイ(東岸の玄武岩の崖。段ごとに外形を少しずつずらして柱状の岩肌を出す)とトンネルの坑口 ──
    const levels = [[D.east, 0], [30, 6], [55, 14], [78, 26], [96, 40], [110, 58], [118, 80]];
    const zs = Array.from({ length: 25 }, (_, i) => -170 + i * 10);
    let prevTop = D.east;
    for (const [h, inset] of levels.slice(1)) {
      const front = zs.map((z) => [D.cliff + inset + rnd() * 9 + Math.max(0, z - 40) * 0.9, z]);   // 北(+z)へ行くほど低く後退
      const pts = [...front, [D.x1, 70 + inset * 0.4], [D.x1, D.z0]];
      add(prism(pts.map(([x, z]) => [Math.min(x, D.x1 - 4), Math.min(z, D.z1)]), prevTop - 0.01, h), M.rock, world);
      prevTop = h;
    }
    {   // 坑口: 石積みの面とアーチの暗い穴
      const px = D.cliff + 1;
      add(box(4, 18, 22), M.basalt, world, { x: px, y: D.rail + 7 });
      const hole = new THREE.Shape(); hole.moveTo(-4.5, 0); hole.lineTo(4.5, 0); hole.lineTo(4.5, 6); hole.absarc(0, 6, 4.5, 0, Math.PI, false); hole.lineTo(-4.5, 0);
      const hg = new THREE.ShapeGeometry(hole, 10); hg.rotateY(-Math.PI / 2);
      add(hg, M.dark, world, { x: px - 2.05, y: D.rail + 0.6, edges: false });
    }

    // ── 西岸の町(街区の塊。窓の帯) ──
    const blocks = [[-250, -140, 30, 36, 14], [-255, -80, 26, 30, 11], [-300, -120, 36, 40, 17], [-250, 90, 30, 40, 12], [-300, 140, 40, 30, 15], [-305, 70, 30, 40, 10], [-260, 150, 26, 24, 9]];
    for (const [x, z, w, d, h] of blocks) {
      add(box(w, h, d), M.body, world, { x, y: D.west + h / 2, z });
      for (let f = 1; f * 3.2 < h - 1; f++) add(box(w + 0.2, 0.9, d + 0.2), M.glass, world, { x, y: D.west + f * 3.2 - 0.6, z, edges: false });
      const gable = [[-d / 2, D.west + h], [d / 2, D.west + h], [0, D.west + h + d * 0.35]];
      add(U.loft(THREE, [{ z: x - w / 2, pts: gable }, { z: x + w / 2, pts: gable }]).rotateY(Math.PI / 2).translate(0, 0, z), M.mid, world);
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);
    function update(dt) { M.river.map.offset.y -= dt * 0.1; ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; }
    function check() {
      return {
        towerTopFromRiver_m: +(D.rail + D.towerH + 7.75 + 1.75).toFixed(1),   // 小塔の先まで(誇張後)
        towerSpan_m: D.towerE - D.towerW,                                      // 両岸の塔の間(旧橋の長さ相当)
        gateOpening_m: [13, 15.5],                                             // 門の開口(幅・高さ)
        cliffTopFromRiver_m: levels[levels.length - 1][0],
      };
    }
    U.bake(THREE, group, { live: [M.accent] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, check, at, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      shots: {
        west: { label: "西岸の橋塔(平和博物館)", target: [-192, 30, 0], pos: [-110, 45, 90] },
        east: { label: "東岸の橋塔と崖", target: [200, 40, 0], pos: [80, 60, 120] },
        across: { label: "川越しに向かい合う塔", target: [0, 25, 0], pos: [-60, 30, 200] },
      },
    };
  }

  DreamAssets.fac.register("remagen", {
    section: 8, title: "ルーデンドルフ鉄橋", kind: "STRATEGIC FACILITY · 8 歴史的施設",
    desc: "レマーゲンでライン川を渡っていた鉄道橋。1945 年に崩落し、両岸の石造の橋塔だけが残る(西岸の塔は平和博物館)。東岸の塔の後ろに玄武岩の崖エルペラー・レイとトンネルの坑口",
    info: [["ファイル", "mockups/3d/facilities/remagen.js"], ["大きさ", "680 × 340 m を切り取り、0.25 倍 × 表示 3.0"], ["誇張", "橋塔の高さ 1.4 倍、銃眼・胸壁の凹凸を大きめに"], ["省略", "車両・人、船、街路樹"], ["状態", "なし(現在の姿)"]],
    dist: 950, target: 30, tokenAt: [380, 0, 270],
    make: (THREE) => remagen(THREE, { r: 100 }),
  });
})();
