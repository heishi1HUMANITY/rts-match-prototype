// 戦略施設トークン「クリミア橋」(ケルチ海峡)の詳細版モデル(試作)。全長約 19 km のうち、航路部分(道路橋と鉄道橋が並走し、
// それぞれに径間 227 m の鋼のアーチが架かる)を中心に約 900 m を切り取る。平面の配置は実寸の比率(K = 0.2)。
// 誇張: アームの決め手の「並走する 2 本の橋 + 中央のアーチ」— アーチの高さ 1.5 倍(45 → 68 m)、アーチの部材の太さ 1.5 倍。
// 省略: 車両・列車、架線(柱だけ残す)、照明柱、レール 1 本ずつ(線路は道床の帯で表す)。
// 近未来化(施設リストの案): 橋脚まわりの防護用の浮き障壁(浮体の列)と水中防護柵、道路橋の路面を覆う対ドローンネット、東端の自動検問ゲート。
// 状態: "intact"(通常)/ "damaged"(2022 年の攻撃のように道路橋の径間が 1 つ落ちて片側が海に沈む)。動きはない。
//
//   const a = DreamAssets.fac.defs.crimea_bridge.make(THREE)(制圧圏 r = 100)
// 橋は x 方向(+x が東・クリミア側)、海峡の流れは z 方向。鉄道橋が北(-z)、道路橋が南(+z)。
(function () {
  const K = 0.2;
  const D = {
    x0: -450, x1: 450, z0: -200, z1: 200, bed: -12, base: -14,
    arch: 113.5, rise: 45 * 1.5, deck: 42,             // アーチの半径間、アーチの高さ(誇張後)、アーチ部の路面の高さ(航路の桁下 35 m)
    piers: [180.8, 248.1, 315.4, 382.7],               // 取付け部の橋脚(東側。西は符号を反転)
    dmg: [180.8, 248.1],                                // 損傷の状態で落ちる道路橋の径間(東側)
  };
  const BR = {
    rail: { z: -24, w: 13, gd: 4.5, rib: 4.5 },
    road: { z: 22, w: 26, gd: 4.0, rib: 5.2 },
  };
  const deckY = (x) => D.deck - Math.max(0, Math.abs(x) - D.arch) * 0.02;   // 路面の高さ(取付け部はゆるい下り勾配)

  function crimea(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.sea = U.waterMaterial(THREE);
    M.netUnder = M.basic(0x3b4752, { transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    M.net = M.basic(0x3b4752, { map: netTexture(THREE), transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
    const group = new THREE.Group(); group.name = "crimea_bridge";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K);
    const { add, box, cyl, V, tube, beam } = k;
    const W = D.x1 - D.x0, Dz = D.z1 - D.z0;

    // ── 海: 海底、水面、台座の端の水の切り口、足元の帯、航路標識 ──
    add(box(W, D.bed - D.base, Dz), M.light, world, { y: (D.bed + D.base) / 2 });
    F.plinth(k, M, world, W, Dz, D.base);
    const sea = k.waterShape([[D.x0, D.z0], [D.x1, D.z0], [D.x1, D.z1], [D.x0, D.z1]], M.sea); world.add(sea);
    world.add(new THREE.Mesh(U.merge(THREE, [
      [new THREE.PlaneGeometry(W, -D.bed), { y: D.bed / 2, z: D.z0 }], [new THREE.PlaneGeometry(W, -D.bed), { y: D.bed / 2, z: D.z1 }],
      [new THREE.PlaneGeometry(Dz, -D.bed), { y: D.bed / 2, x: D.x0, ry: Math.PI / 2 }], [new THREE.PlaneGeometry(Dz, -D.bed), { y: D.bed / 2, x: D.x1, ry: Math.PI / 2 }],
    ]), M.waterCut));
    for (const z of [-150, 150]) for (const s of [-1, 1]) {   // 航路(アームの下、x = ±95)の両側の浮標
      add(cyl(1.6, 3.2, 10), s < 0 ? M.red : M.green, world, { x: s * 95, y: 0.4, z });
      add(s < 0 ? cyl(0.8, 1.4, 8) : new THREE.ConeGeometry(1.0, 1.6, 8), s < 0 ? M.red : M.green, world, { x: s * 95, y: 2.8, z });
    }

    // ── 橋: 鉄道橋と道路橋。航路部はアーチ(タイドアーチ)、取付け部は桁と橋脚 ──
    const netParts = [], netParts2 = [];   // 対ドローンネット(動かない分は 1 つにまとめる)、水中防護柵の網
    let dmgGroup = null, dmgNet = null;
    const supports = [-D.x1, ...[...D.piers].reverse().map((x) => -x), -D.arch, D.arch, ...D.piers, D.x1];
    for (const [name, b] of Object.entries(BR)) {
      const zEdge = [b.z - b.w / 2, b.z + b.w / 2];
      // 航路部の主橋脚(アーチの支点): 大きなコンクリートの塊、水面の基礎、船の衝突よけの円柱
      for (const s of [-1, 1]) {
        const x = s * D.arch, top = deckY(0) - b.gd;
        add(box(16, top - D.bed, b.w + 8), M.light, world, { x, y: (top + D.bed) / 2, z: b.z });
        add(box(24, 4, b.w + 14), M.mid, world, { x, y: 0.5, z: b.z });
        for (const dz of [-1, 1]) add(cyl(2.4, 6, 12), M.mid, world, { x: x + s * 11, y: 0.5, z: b.z + dz * (b.w / 2 + 5) });
        add(box(4, 2, b.w + 2), M.dark, world, { x, y: top - 1, z: b.z, edges: false });   // 支承
      }
      // 取付け部の橋脚
      for (const s of [-1, 1]) for (const px of D.piers) {
        const x = s * px, top = deckY(x) - b.gd;
        add(box(9, 3, b.w + 2), M.mid, world, { x, y: 0.5, z: b.z });   // 水面のフーチング
        if (name === "road") {
          for (const dz of [-7, 7]) add(cyl(1.9, top - 2.5 - 2, 12), M.light, world, { x, y: 2 + (top - 2.5 - 2) / 2, z: b.z + dz });
          add(box(4.4, 2.5, b.w - 2), M.light, world, { x, y: top - 1.25, z: b.z });
        } else {
          add(box(3.6, top - 2, 9), M.light, world, { x, y: 2 + (top - 2) / 2, z: b.z });
          for (const dz of [-4.5, 4.5]) add(cyl(1.8, top - 2, 10), M.light, world, { x, y: 2 + (top - 2) / 2, z: b.z + dz });
        }
      }
      // 取付け部の桁(径間ごとに勾配に合わせた箱桁)。損傷の状態で落ちる径間は別のグループ
      for (let i = 0; i < supports.length - 1; i++) {
        const xa = supports[i], xb = supports[i + 1];
        if (xa === -D.arch) continue;   // 航路部はアーチで別に組む
        const isDmg = name === "road" && xa === D.dmg[0];
        const ya = deckY(xa), yb = deckY(xb), len = Math.hypot(xb - xa, yb - ya), ang = Math.atan2(yb - ya, xb - xa);
        const sp = new THREE.Group();
        if (isDmg) { sp.position.set(xa, ya, b.z); dmgGroup = sp; } else { sp.position.set((xa + xb) / 2, (ya + yb) / 2, b.z); }
        sp.rotation.z = ang; world.add(sp);
        const cx = isDmg ? len / 2 : 0;   // 損傷する径間は西端を軸にする
        deckSpan(sp, name, b, cx, len);
        // 対ドローンネット(道路橋だけ)
        if (name === "road") {
          const hoopN = Math.max(2, Math.round(len / 22));
          for (let h = 0; h <= hoopN; h++) hoop(sp, cx - len / 2 + (len * h) / hoopN, b);
          const ng = netGeo(len, b);
          if (isDmg) { dmgNet = new THREE.Mesh(ng.translate(cx, 0, 0), M.net); sp.add(dmgNet); }
          else { ng.applyMatrix4(new THREE.Matrix4().compose(sp.position, new THREE.Quaternion().setFromEuler(sp.rotation), new THREE.Vector3(1, 1, 1))); netParts.push(ng); }
        }
      }
      // 航路部のタイドアーチ: 2 本のアーチリブ、吊り材、上の横つなぎ、桁(タイ)
      const top = deckY(0), A = D.arch, n = 20;
      const sp = new THREE.Group(); sp.position.set(0, top, b.z); world.add(sp);
      deckSpan(sp, name, b, 0, 2 * A, true);
      const node = (i, dz) => { const x = -A + (2 * A * i) / n; return V(x, D.rise * (1 - (x / A) ** 2) + b.rib / 2, dz); };
      const ribZ = [-(b.w / 2 + b.rib / 2), b.w / 2 + b.rib / 2];
      for (const dz of ribZ) {
        for (let i = 0; i < n; i++) beam(sp, node(i, dz), node(i + 1, dz), b.rib, M.body);
        for (let i = 1; i < n; i++) tube(sp, node(i, dz).setY(node(i, dz).y - b.rib / 2), V(node(i, dz).x, 0, dz), 0.45, M.mid);   // 吊り材
        add(box(3, b.gd + 1.5, b.rib), M.light, sp, { x: -A + 1.5, y: -b.gd / 2 + 0.3, z: dz });   // 端の支点の塊
        add(box(3, b.gd + 1.5, b.rib), M.light, sp, { x: A - 1.5, y: -b.gd / 2 + 0.3, z: dz });
      }
      for (let i = 0; i <= n; i++) {   // 横つなぎ(車両・列車の上の空き 12 m より高い所だけ)と X の斜材
        const a = node(i, ribZ[0]), c = node(i, ribZ[1]);
        if (a.y < 14) continue;
        beam(sp, a, c, 1.8, M.light);
        if (i < n && node(i + 1, 0).y >= 14) { tube(sp, a, node(i + 1, ribZ[1]), 0.6, M.light); tube(sp, c, node(i + 1, ribZ[0]), 0.6, M.light); }
      }
    }
    world.add(new THREE.Mesh(U.merge(THREE, netParts.map((g) => [g, {}])), M.net));

    // 桁 1 径間(sp の座標: x が橋軸、y = 0 が路面)。arch = アーチ部の鋼の桁
    function deckSpan(sp, name, b, cx, len, arch = false) {
      add(box(len, b.gd, b.w), arch ? M.light : M.body, sp, { x: cx, y: -b.gd / 2, z: 0 });
      add(box(len, b.gd * 0.6, b.w * 0.55), M.mid, sp, { x: cx, y: -b.gd - b.gd * 0.3 + 0.01, z: 0, edges: !arch });   // 箱桁の下の絞り
      if (name === "road") {
        add(box(len, 0.2, b.w - 3), M.mid, sp, { x: cx, y: 0.1, z: 0, edges: false });
        add(box(len, 0.3, 1.2), M.light, sp, { x: cx, y: 0.3, z: 0, edges: false });   // 中央分離帯
        for (const s of [-1, 1]) add(box(len, 1.3, 0.6), M.light, sp, { x: cx, y: 0.65, z: s * (b.w / 2 - 0.3) });   // 高欄
      } else {
        for (const s of [-1, 1]) {
          add(box(len, 0.5, 4.2), M.mid, sp, { x: cx, y: 0.25, z: s * 2.6, edges: false });   // 道床
          add(box(len, 0.25, 1.7), M.dark, sp, { x: cx, y: 0.6, z: s * 2.6, edges: false });  // 線路(レール 2 本の幅)
          add(box(len, 1.1, 0.5), M.light, sp, { x: cx, y: 0.55, z: s * (b.w / 2 - 0.25) });
        }
        if (!arch) for (const s of [-1, 1]) {   // 架線柱(径間の中央)
          add(box(0.5, 9, 0.5), M.mid, sp, { x: cx, y: 4.5, z: s * (b.w / 2 - 0.8) });
          add(box(0.4, 0.4, 5.2), M.mid, sp, { x: cx, y: 8.2, z: s * (b.w / 2 - 3.2), edges: false });
        }
      }
    }
    // 対ドローンネットの骨(道路の両端の柱と半円の梁)
    function hoop(sp, x, b) {
      const R = b.w / 2 - 0.6, H = 6;
      const pts = [];
      for (let i = 0; i <= 6; i++) { const a = (Math.PI * i) / 6; pts.push(V(x, H + Math.sin(a) * 5, Math.cos(a) * R)); }
      for (const s of [-1, 1]) tube(sp, V(x, 0.2, s * R), V(x, H, s * R), 0.3, M.mid);
      for (let i = 0; i < 6; i++) tube(sp, pts[i], pts[i + 1], 0.25, M.mid);
    }
    function netGeo(len, b) {
      const R = b.w / 2 - 0.6;
      const g = new THREE.CylinderGeometry(1, 1, len, 16, 1, true, 0, Math.PI);   // 半円の筒(軸は x)
      g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2);
      g.scale(1, 5, R); g.translate(0, 6, 0);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * len / 6);
      // 柱の間の縦の網(両側)
      const sides = [-1, 1].map((s) => { const p = new THREE.PlaneGeometry(len, 6); p.translate(0, 3, s * R); const u = p.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * len / 6, u.getY(i)); return p; });
      return U.merge(THREE, [[g, {}], ...sides.map((p) => [p, {}])]);
    }

    // ── 近未来化: 浮き障壁と水中防護柵(取付け部の橋脚を囲む。航路 |x| < 120 は開けておく) ──
    const floatG = box(6, 1.6, 3);
    for (const s of [-1, 1]) for (const z of [-75, 70]) {
      const xa = s * 124, xb = s * 446, len = Math.abs(xb - xa), cx = (xa + xb) / 2;
      for (let x = 0; x <= len; x += 9) add(floatG, M.body, world, { x: xa + s * x, y: 0.3, z });
      add(box(len, 0.25, 0.25), M.dark, world, { x: cx, y: 0.6, z, edges: false });   // 浮体をつなぐ鎖
      for (let x = 0; x <= len; x += 23) add(cyl(0.45, -D.bed + 1.6, 6), M.dark, world, { x: xa + s * x, y: D.bed / 2 + 0.8, z, edges: false });   // 防護柵の杭
      const net = new THREE.PlaneGeometry(len, -D.bed); net.translate(cx, D.bed / 2, z); netParts2.push(net);
      // 航路の側の端は主橋脚の基礎へ折り返す
      const zc = z < 0 ? BR.rail.z - BR.rail.w / 2 - 8 : BR.road.z + BR.road.w / 2 + 8, lz = Math.abs(zc - z);
      for (let t = 0; t <= lz; t += 9) add(floatG, M.body, world, { x: xa, y: 0.3, z: z + Math.sign(zc - z) * t, ry: Math.PI / 2 });
    }
    world.add(new THREE.Mesh(U.merge(THREE, netParts2.map((g) => [g, {}])), M.netUnder));

    // ── 近未来化: 東端の自動検問ゲート(道路はセンサーの門型、鉄道は貨物の透過検査の門) ──
    {
      const x = 416, b = BR.road, y = deckY(x);   // ネットの骨(405 m・427 m)の間
      for (const s of [-1, 1]) add(box(1.6, 13.5, 1.6), M.light, world, { x, y: y + 6.75, z: b.z + s * (b.w / 2 + 1.2) });
      add(box(2.2, 2.0, b.w + 4), M.light, world, { x, y: y + 13.5, z: b.z });
      add(box(2.3, 0.5, b.w + 4.1), M.accent, world, { x, y: y + 14.3, z: b.z, edges: false });
      for (let l = 0; l < 4; l++) {
        const z = b.z - 9.75 + l * 6.5;
        add(box(1.8, 1.2, 1.8), M.dark, world, { x: x - 0.4, y: y + 11.9, z });
        add(box(0.1, 0.6, 1.2), M.glass, world, { x: x - 1.35, y: y + 11.9, z, edges: false });
      }
      const r = BR.rail, xr = 436, yr = deckY(xr);   // 架線柱(416 m)を避ける
      for (const s of [-1, 1]) add(box(5, 9, 1.4), M.body, world, { x: xr, y: yr + 4.5, z: r.z + s * (r.w / 2 + 0.7) });
      add(box(5, 1.8, r.w + 2.8), M.body, world, { x: xr, y: yr + 9.9, z: r.z });
      add(box(5.1, 0.5, r.w + 2.9), M.accent, world, { x: xr, y: yr + 9.0, z: r.z, edges: false });
    }

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, opts.r ?? 100, M.ring, M.disc);

    // ── 状態: 損傷した径間は西端を軸に東端が海へ落ちる ──
    const DMG = { len: Math.hypot(D.dmg[1] - D.dmg[0], deckY(D.dmg[1]) - deckY(D.dmg[0])), ang0: Math.atan2(deckY(D.dmg[1]) - deckY(D.dmg[0]), D.dmg[1] - D.dmg[0]) };
    DMG.drop = -Math.asin((deckY(D.dmg[0]) + 1.5) / DMG.len);   // 東端の路面が水面下 1.5 m まで落ちる角度
    let state = opts.state ?? "intact";
    function apply() {
      dmgGroup.rotation.z = state === "damaged" ? DMG.drop : DMG.ang0;
      dmgNet.visible = state !== "damaged";   // 落ちた径間のネットは外れた扱い
    }
    apply();
    function update(dt) {
      M.sea.map.offset.y -= dt * 0.04;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function check() {
      const r1 = (v) => +v.toFixed(2);
      // 落ちた径間の東端の桁の下の角(西端を軸に回したあと)と海底、東の橋脚の面との隙間
      const c = Math.cos(DMG.drop), s = Math.sin(DMG.drop), L = DMG.len, gd = BR.road.gd + BR.road.gd * 0.6;
      const tipX = D.dmg[0] + L * c + gd * s, tipY = deckY(D.dmg[0]) + L * s - gd * c;
      return {
        navClearance_m: r1(deckY(0) - BR.road.gd - BR.road.gd * 0.6),       // 航路部の桁下(水面から。実物は 35 m)
        archRiseOverDeck_m: r1(D.rise),                                       // 誇張後のアーチの高さ
        bracingOverDeck_m: 14,                                                 // 横つなぎの最低の高さ(路面から。車両・列車と架線の上)
        gateBeamOverNet_m: 13.5 - 1 - 11,                                      // 検問ゲートの梁の下とネットの頂部                                            // 横つなぎ(14 m 以上)と車両・列車の上の空き 12 m の差
        dmgTipOverBed_m: r1(tipY - D.bed),                                     // 落ちた径間の先と海底
        dmgTipToPier_m: r1(D.dmg[1] - 4.5 - tipX),                             // 落ちた径間の先と東の橋脚の柱の面
        boomToChannel_m: 124 - 95,                                             // 浮き障壁の端と航路の浮標
      };
    }
    U.bake(THREE, group, { dynamic: [dmgGroup], live: [M.accent], also: [M.lamp] });
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, update, check, at, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; apply(); }, get state() { return state; },
      shots: {
        arch: { label: "航路部のアーチ", target: [0, 40, 0], pos: [150, 70, 230] },
        damaged: { label: "道路橋の径間", target: [215, 20, 22], pos: [250, 45, 160] },
        gate: { label: "検問ゲート・ネット", target: [410, 42, 0], pos: [330, 60, 90] },
        boom: { label: "浮き障壁", target: [250, 0, -75], pos: [300, 40, -170] },
      },
    };
  }
  // 網の目のテクスチャ(白い線。色はマテリアルで乗せる)
  function netTexture(THREE) {
    const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(32, 32); g.moveTo(32, 0); g.lineTo(0, 32); g.stroke();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }

  DreamAssets.fac.register("crimea_bridge", {
    section: 1, title: "クリミア橋", kind: "STRATEGIC FACILITY · 1 交通・兵站",
    desc: "ケルチ海峡を渡る全長約 19 km の道路橋と鉄道橋。航路部分だけ径間 227 m のアーチが 2 本並ぶ。橋脚を守る浮き障壁と水中防護柵、路面の対ドローンネット、自動検問ゲートを足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/crimea_bridge.js"], ["大きさ", "航路部を中心に 900 × 400 m を切り取り、0.2 倍 × 表示 3.0"], ["誇張", "アーチの高さ 1.5 倍(68 m)、アーチの部材 1.5 倍の太さ"], ["省略", "車両・列車、架線、照明柱"], ["状態", "通常 / 損傷(道路橋の径間が 1 つ落ちる)"], ["近未来化", "浮き障壁・水中防護柵、対ドローンネット、自動検問ゲート"]],
    dist: 1000, target: 30, tokenAt: [380, 0, 260],
    make: (THREE) => crimea(THREE, { r: 100 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["通常", () => a.setState("intact"), () => a.state === "intact"], ["損傷(径間の落下)", () => a.setState("damaged"), () => a.state === "damaged"]],
    caption: (a) => (a.state === "damaged" ? "損傷 — 道路橋の径間が 1 つ海へ落ちている" : ""),
  });
})();
