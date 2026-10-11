// 守備NPC(中立の拠点を守る機械)の詳細版モデル(試作)。拠点の等級で武装も車両も変える(大きさ違いにはしない)。
//   S(小拠点): 軽機関銃(MINIMI 風)に四角い計算機ユニットを後付けした自動化改造の銃座。固定 = 土のうの銃座 / 移動 = ハンビーの屋根の銃塔
//   M(中規模): 固定 = CIWS(縦に長い楕円のレドームの下に回転銃身の機関砲、八角の台座)/ 移動 = 8輪の機動戦闘車に低い砲塔(レドームなし、回転銃身の機関砲)
//   L(大拠点): 対空砲塔(ゲパルト風)。角ばった砲塔の両脇に機関砲2門、正面に照準センサー、後ろに固定のレーダーパネル。固定 = 装甲の台座 / 移動 = 履帯の車体
// 外観は SF 寄り(角ばったパネルと継ぎ目)。回るアンテナやレーザーの照準線は付けない。照準は現実の兵器に寄せ、光らない電子光学センサー(熱線映像・テレビ・レーザー測距の暗いガラスの窓)とレーダーで行う。
// 中立の機械なので、チーム色は使わない(白い外装、灰色の機構、中立色の帯)。移動型は拠点のまわりを巡回し、交戦・撃破で止まる。
//
//   const g = DreamAssets.guard(THREE, { size: "S" | "M" | "L", mobile: false });
//   scene.add(g.group); g.setSize("M"); g.setMobile(true); g.setState("idle" | "engaged" | "destroyed"); g.update(dt)
//
// 前方 = +z、上 = +y。部隊と同じ表示倍率 2.0 を前提にした寸法。
(function () {
  const C = { white: 0xf2f4f6, white2: 0xe3e8ec, panel: 0xc9d0d7, mech: 0x59636d, dark: 0x262e36, gun: 0x2f363d, tire: 0x2c3238, band: 0x8f98a3, glass: 0x46525e, bag: 0xbdb6a0, ammo: 0x6f7560, lens: 0x1c252d, edge: 0x141b21 };
  const SCALE = { S: 1.6, M: 1.3, L: 1.3, Smobile: 1.15 };   // 全体の倍率(部隊と並べて見劣りしない大きさ。S の銃座は武装が軽いので大きめ、S の車両は M・L の車両より小さく)

  function guard(THREE, opts = {}) {
    const U = DreamAssets.util;
    const group = new THREE.Group(); group.name = "guard";
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      white: lambert(C.white), white2: lambert(C.white2, { flatShading: true }), panel: lambert(C.panel), mech: lambert(C.mech), dark: lambert(C.dark), gun: lambert(C.gun, { flatShading: true }),
      tire: lambert(C.tire, { flatShading: true }), band: lambert(C.band), glass: lambert(C.glass), bag: lambert(C.bag, { flatShading: true }), ammo: lambert(C.ammo, { flatShading: true }), concrete: lambert(0xd5dbe1, { flatShading: true }),
      lens: lambert(C.lens),
      flash: basic(0xffb347, { transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }), flashCore: basic(0xfff1c8), shot: basic(0xff8a1a),
      smoke: lambert(0x4a525a, { transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.5 }),
    };
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const zAxis = V(0, 0, 1);
    const RX = Math.PI / 2;
    // 電子光学センサーの窓(光らない暗いガラス): 大きい丸 = 熱線映像、横の角 = テレビ、小さい丸 = レーザー測距。前(+z)を向く
    const eoWindows = (parent, x, y, z, r) => {
      add(box(r * 4.2, r * 2.4, 0.2), M.dark, parent, { x, y, z, edges: false });
      add(cyl(r * 0.85, r * 0.85, 0.2, 14), M.lens, parent, { x: x - r * 0.9, y, z: z + 0.12, rx: RX, edges: false });
      add(box(r * 1.1, r * 0.8, 0.12), M.lens, parent, { x: x + r * 0.9, y: y + r * 0.45, z: z + 0.12, edges: false });
      add(cyl(r * 0.3, r * 0.3, 0.2, 10), M.lens, parent, { x: x + r * 0.9, y: y - r * 0.55, z: z + 0.12, rx: RX, edges: false });
    };
    // 発射炎(前へ開く円錐と白い芯)
    const flashAt = (parent, z, r) => U.flashAt(THREE, add, M.flash, M.flashCore, parent, z, r);

    // ── 武装 S: 軽機関銃 + 後付けの計算機ユニット(支柱の上の旋回サーボと揺架) ──
    function weaponS(post = 4.5) {
      const node = new THREE.Group();
      add(cyl(0.45, 0.6, post, 8), M.mech, node, { y: post / 2 });                               // 支柱
      const yawG = new THREE.Group(); yawG.position.y = post; node.add(yawG);
      add(box(1.6, 1.4, 2.2), M.dark, yawG, { y: 0.7 });                                         // 旋回サーボ
      add(box(1.7, 0.3, 2.3), M.band, yawG, { y: 1.2, edges: false });
      for (const s of [-1, 1]) add(box(0.3, 3.6, 2), M.mech, yawG, { x: s * 0.95, y: 1.8 });     // 揺架
      add(box(0.9, 0.9, 0.9), M.dark, yawG, { x: 1.55, y: 3.2, edges: false });                  // 俯仰サーボ
      const pitchG = new THREE.Group(); pitchG.position.y = 3.2; yawG.add(pitchG);
      const gun = new THREE.Group(); pitchG.add(gun);                                            // 反動で前後する
      add(box(1.3, 2.0, 7.5), M.gun, gun, { z: 0.5 });                                            // 機関部
      add(box(1.34, 0.4, 3), M.mech, gun, { y: 1.1, z: 1.4, edges: false });                     // 給弾カバー
      add(U.loft(THREE, [{ z: -7, pts: [[-0.55, -1.2], [0.55, -1.2], [0.55, 0.6], [-0.55, 0.6]] }, { z: -3.2, pts: [[-0.6, -0.8], [0.6, -0.8], [0.6, 0.8], [-0.6, 0.8]] }]), M.gun, gun);   // 銃床
      add(cyl(0.22, 0.22, 8, 8), M.dark, gun, { z: 8.2, rx: RX, edges: false });                 // 銃身
      add(cyl(0.15, 0.15, 4, 6), M.dark, gun, { y: -0.45, z: 6.4, rx: RX, edges: false });       // ガス管
      add(box(1.0, 1.0, 2.6), M.mech, gun, { z: 5.4 });                                           // 被筒
      add(cyl(0.36, 0.36, 1.1, 8), M.dark, gun, { z: 12.6, rx: RX, edges: false });              // 消炎器
      add(box(0.3, 0.5, 2.2), M.mech, gun, { y: 1.55, z: 3.4, edges: false });                   // 運搬用の取っ手
      for (const s of [-1, 1]) add(box(0.18, 0.18, 4.6), M.dark, gun, { x: s * 0.28, y: -0.62, z: 8.4, edges: false });   // たたんだ二脚
      add(box(2.0, 2.2, 2.6), M.ammo, gun, { x: -2.15, y: -0.9, z: 0.6 });                       // 弾薬箱
      add(box(0.9, 0.5, 1.6), M.ammo, gun, { x: -1.1, y: 0.1, z: 0.6, edges: false });
      // 後付けの計算機ユニット: 右の取り付け金具、四角い箱、上の放熱板、前のセンサーの窓、配線、短いアンテナ
      add(box(0.6, 0.5, 1.4), M.mech, gun, { x: 0.95, y: 0.9, z: 2.0, edges: false });
      const cu = new THREE.Group(); cu.position.set(2.5, 0.9, 0.2); gun.add(cu);
      add(box(2.6, 2.2, 3.4), M.white2, cu);
      add(box(2.64, 0.3, 3.44), M.band, cu, { y: -0.5, edges: false });
      const fins = []; for (let i = 0; i < 5; i++) fins.push([box(2.1, 0.5, 0.14), { y: 1.35, z: -1.2 + i * 0.6 }]);
      add(U.merge(THREE, fins), M.mech, cu, { edges: false });
      eoWindows(cu, 0, 0.2, 1.72, 0.5);
      add(cyl(0.07, 0.07, 2, 4), M.dark, cu, { x: 0.9, y: 2.0, z: -1.4, edges: false });
      add(box(0.25, 0.25, 2.6), M.dark, gun, { x: 1.6, y: -0.3, z: -1.2, ry: 0.4, edges: false });   // 配線
      const flash = flashAt(gun, 13.2, 0.9);
      return { node, yawG, pitchG: [pitchG], muzzles: [{ flash, rec: gun, amt: 0.35 }], rate: 0.09 };
    }

    // ── 武装 M: CIWS(旋回台、左右の支柱、楕円のレドーム、回転銃身の機関砲、弾倉) ──
    function weaponM(k = 1) {
      const node = new THREE.Group(); node.scale.setScalar(k);
      const yawG = new THREE.Group(); node.add(yawG);
      const PV = 6;
      add(cyl(3.6, 4, 1, 16), M.mech, yawG, { y: 0.5 });
      add(new THREE.CylinderGeometry(4.05, 4.05, 0.3, 16, 1, true), M.band, yawG, { y: 0.75, edges: false });
      for (const s of [-1, 1]) {
        add(U.loft(THREE, [{ z: -1.6, pts: [[-0.5, 1], [0.5, 1], [0.5, PV + 1.2], [-0.5, PV + 1.2]] }, { z: 1.6, pts: [[-0.5, 1], [0.5, 1], [0.5, PV + 0.6], [-0.5, PV + 0.6]] }]), M.white2, yawG, { x: s * 3.9 });
        add(cyl(0.9, 0.9, 0.6, 12), M.dark, yawG, { x: s * 3.35, y: PV, rz: RX, edges: false });
      }
      const pitchG = new THREE.Group(); pitchG.position.y = PV; yawG.add(pitchG);
      add(cyl(0.55, 0.55, 6.6, 10), M.dark, pitchG, { rz: RX, edges: false });
      // レドーム: 下は円筒、上は縦に長い楕円(半径 3.2、高さ 7)。なめらかな回転体
      const prof = [[0.01, 0], [2.6, 0], [3.1, 0.5], [3.2, 1.0], [3.2, 2.6]];
      for (let i = 1; i <= 20; i++) { const t = (i / 20) * RX; prof.push([Math.max(0.01, 3.2 * Math.cos(t)), 2.6 + 7 * Math.sin(t)]); }
      const radome = new THREE.Group(); radome.position.set(0, 0.7, -0.6); pitchG.add(radome);
      add(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32), M.white, radome, { edges: false });
      add(new THREE.CylinderGeometry(3.23, 3.23, 0.2, 32, 1, true), M.dark, radome, { y: 2.6, edges: false });
      // レドームの横に電子光学照準器の箱(実物の CIWS と同じく側面に付く)
      const eo = new THREE.Group(); eo.position.set(-3.6, 1.6, 0.6); radome.add(eo);
      add(box(1.6, 1.8, 2.6), M.white2, eo); add(box(0.6, 0.6, 1.0), M.mech, eo, { x: 1.0, edges: false });
      eoWindows(eo, 0, 0.1, 1.32, 0.38);
      const { spin, flash } = gatling(pitchG, 0, -1.1, 1.4);
      add(cyl(1.5, 1.5, 6, 14), M.white, pitchG, { y: -2.9, z: -2.0, rx: RX });
      add(new THREE.CylinderGeometry(1.53, 1.53, 0.3, 14, 1, true), M.band, pitchG, { y: -2.9, z: -0.2, rx: RX, edges: false });
      add(box(0.8, 0.8, 2.4), M.mech, pitchG, { y: -1.9, z: 0.5, edges: false });
      return { node, yawG, pitchG: [pitchG], muzzles: [{ flash, rec: null }], spin, rate: 0.05, droop: radome };
    }

    // 回転銃身の機関砲(機関部、6本の銃身の束と留め輪、砲口の覆い、発射炎)
    function gatling(parent, x, y, z) {
      const gun = new THREE.Group(); gun.position.set(x, y, z); parent.add(gun);
      add(cyl(1.3, 1.3, 3.2, 12), M.mech, gun, { z: 0.2, rx: RX });
      const spin = new THREE.Group(); spin.position.z = 1.8; gun.add(spin);
      const parts = [];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push([cyl(0.17, 0.17, 9.5, 6), { x: Math.cos(a) * 0.7, y: Math.sin(a) * 0.7, z: 4.75, rx: RX }]); }
      add(U.merge(THREE, parts), M.dark, spin, { edges: false });
      for (const zz of [3.8, 9.0]) add(cyl(1.05, 1.05, 0.5, 12), M.mech, spin, { z: zz, rx: RX, edges: false });
      add(cyl(1.15, 1.15, 1.4, 12), M.white2, gun, { z: 11.4, rx: RX });
      return { spin, flash: flashAt(gun, 13.2, 1.6) };
    }

    // ── 武装 M(移動型): 機動戦闘車の低い砲塔に回転銃身の機関砲。レドームの代わりに横の電子光学センサーの箱 ──
    function weaponMV() {
      const node = new THREE.Group();
      const yawG = new THREE.Group(); node.add(yawG);
      add(cyl(4.4, 4.7, 0.7, 16), M.mech, yawG, { y: 0.35 });
      const sec = (w, h, t) => [[-w / 2, 0], [w / 2, 0], [w / 2, h * 0.6], [w * t / 2, h], [-w * t / 2, h], [-w / 2, h * 0.6]];
      add(U.loft(THREE, [{ z: -5.2, pts: sec(8.2, 3.0, 0.8) }, { z: 1.5, pts: sec(8.6, 3.3, 0.82) }, { z: 4.4, pts: sec(7.0, 2.2, 0.8) }]), M.white2, yawG, { y: 0.7 });
      add(box(8.7, 0.35, 6.4), M.band, yawG, { y: 0.7 + 1.6, z: -1.6, edges: false });
      add(box(2.6, 0.4, 2.6), M.panel, yawG, { x: -1.6, y: 0.7 + 3.4, z: -2.0 });             // 天板のハッチ
      // 横の電子光学センサーの箱と、後ろの発煙弾の筒
      add(box(2.0, 1.7, 2.6), M.white, yawG, { x: 2.6, y: 0.7 + 3.3 + 0.8, z: 0.2 });
      eoWindows(yawG, 2.6, 0.7 + 3.3 + 0.8, 1.52, 0.42);
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(cyl(0.35, 0.35, 1.3, 8), M.mech, yawG, { x: s * (4.1 - i * 0.05), y: 0.7 + 2.6 + i * 0.1, z: -3.6 + i * 0.75, rz: s * 1.1, edges: false });
      // 砲塔の前の防盾から機関砲が出る
      const pitchG = new THREE.Group(); pitchG.position.set(0, 0.7 + 1.5, 4.0); yawG.add(pitchG);
      add(box(3.4, 2.4, 1.4), M.mech, pitchG, { z: 0.2 });
      const { spin, flash } = gatling(pitchG, 0, 0, 0.6);
      return { node, yawG, pitchG: [pitchG], muzzles: [{ flash, rec: null }], spin, rate: 0.05 };
    }

    // ── 武装 L: 対空砲塔(角ばった砲塔、両脇の機関砲2門、正面の照準センサー、後ろの固定レーダーパネル) ──
    function weaponL() {
      const node = new THREE.Group();
      const yawG = new THREE.Group(); node.add(yawG);
      add(cyl(5.4, 5.8, 0.8, 16), M.mech, yawG, { y: 0.4 });
      const sec = (w, h, top) => [[-w / 2, 0], [w / 2, 0], [w / 2, h * 0.7], [w * top / 2, h], [-w * top / 2, h], [-w / 2, h * 0.7]];
      add(U.loft(THREE, [{ z: -6.5, pts: sec(11, 5, 0.8) }, { z: 2.5, pts: sec(12, 5.6, 0.82) }, { z: 6.5, pts: sec(10.5, 3.2, 0.8) }]), M.white2, yawG, { y: 0.8 });
      add(box(12.1, 0.4, 9), M.band, yawG, { y: 0.8 + 3.0, z: -2, edges: false });
      add(box(3.2, 0.5, 3.2), M.panel, yawG, { x: -2.2, y: 0.8 + 5.7, z: -1.5 });               // 天板のハッチ
      add(box(2.4, 0.5, 2.4), M.panel, yawG, { x: 2.4, y: 0.8 + 5.7, z: -2.5 });
      // 後ろの固定レーダーパネル(回らない): 短い柱の上に傾けた板
      add(box(1.2, 2.2, 1.2), M.mech, yawG, { y: 0.8 + 5 + 1.1, z: -4.6, edges: false });
      add(box(7.5, 3.4, 0.5), M.panel, yawG, { y: 0.8 + 5 + 3.4, z: -5.0, rx: -0.35 });
      add(box(7.7, 0.3, 0.7), M.dark, yawG, { y: 0.8 + 5 + 1.75, z: -4.55, rx: -0.35, edges: false });
      // 俯仰する部分: 正面の追尾レーダー(円盤。中央に給電部)、両脇の機関砲
      const pitchG = [], muzzles = [];
      const sens = new THREE.Group(); sens.position.set(0, 3.0, 6.7); yawG.add(sens); pitchG.push(sens);
      add(cyl(2.1, 2.1, 0.9, 20), M.white, sens, { z: 0.3, rx: RX });
      add(new THREE.CylinderGeometry(2.13, 2.13, 0.25, 20, 1, true), M.dark, sens, { z: 0.3, rx: RX, edges: false });
      add(cyl(0.5, 0.7, 0.9, 10), M.dark, sens, { z: 1.1, rx: RX, edges: false });   // 給電部
      for (const s of [-1, 1]) {
        add(cyl(0.9, 0.9, 1.2, 12), M.dark, yawG, { x: s * 6.3, y: 3.6, z: 1.5, rz: RX, edges: false });   // 砲耳
        const p = new THREE.Group(); p.position.set(s * 7.4, 3.6, 1.5); yawG.add(p); pitchG.push(p);
        add(U.loft(THREE, [{ z: -3.5, pts: [[-1.2, -1.4], [1.2, -1.4], [1.2, 1.2], [-1.2, 1.4]] }, { z: 3.5, pts: [[-1.2, -1.2], [1.2, -1.2], [1.2, 1.0], [-1.2, 1.0]] }]), M.white2, p);
        add(box(2.44, 0.3, 7), M.band, p, { y: -0.2, edges: false });
        const bar = new THREE.Group(); p.add(bar);                                                 // 反動で前後する
        add(cyl(0.34, 0.34, 15, 8), M.dark, bar, { z: 11, rx: RX, edges: false });
        add(cyl(0.58, 0.58, 3, 10), M.gun, bar, { z: 5, rx: RX, edges: false });
        add(cyl(0.62, 0.62, 1.4, 8), M.gun, bar, { z: 18.6, rx: RX, edges: false });
        add(box(1.0, 1.0, 2.4), M.mech, p, { x: -s * 1.5, y: 0.3, z: -1, edges: false });       // 給弾路
        muzzles.push({ flash: flashAt(bar, 19.6, 1.3), rec: bar, amt: 0.9 });
      }
      return { node, yawG, pitchG, muzzles, rate: 0.14, alternate: true };
    }

    // ── 台座(固定型) ──
    function plinth(kind) {
      const g = new THREE.Group();
      if (kind === "S") {
        // 低いコンクリートの床と、2段の土のうの輪(前は低く)
        add(cyl(6.2, 6.6, 1, 6), M.concrete, g, { y: 0.5 });
        const bags = [];
        for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 12; i++) {
          const a = ((i + layer * 0.5) / 12) * Math.PI * 2;
          if (layer === 1 && Math.abs(Math.atan2(Math.sin(a - RX), Math.cos(a - RX))) < 0.6) continue;   // 前は1段(撃つ向き)
          bags.push([box(2.6, 1.05, 1.5), { x: Math.cos(a) * 5.3, y: 1 + 0.55 + layer * 1.05, z: Math.sin(a) * 5.3, ry: -a + RX, sx: 1, sy: 1, sz: 1 }]);
        }
        add(U.merge(THREE, bags), M.bag, g);
        return { g, top: 1, z: 0, wheels: [], track: null };
      }
      if (kind === "M") {
        add(cyl(7.5, 8.7, 4, 8), M.concrete, g, { y: 2 });
        add(cyl(9, 9.3, 0.8, 8), M.concrete, g, { y: 0.4 });
        add(new THREE.CylinderGeometry(7.85, 7.85, 0.5, 8, 1, true), M.band, g, { y: 3.1, edges: false });
        return { g, top: 4, z: 0, wheels: [], track: null };
      }
      // L: 斜めの壁の装甲の台座(六角)と、四隅のアンカー
      add(cyl(9.5, 12, 5, 6), M.concrete, g, { y: 2.5, ry: Math.PI / 6 });
      add(new THREE.CylinderGeometry(10.05, 10.05, 0.6, 6, 1, true), M.band, g, { y: 4.0, ry: Math.PI / 6, edges: false });
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; add(box(2.8, 2.6, 2.8), M.concrete, g, { x: Math.cos(a) * 12.6, y: 1.3, z: Math.sin(a) * 12.6, ry: -a }); }
      return { g, top: 5, z: 0, wheels: [], track: null };
    }

    // ── 車両(移動型) ──
    const wheel = (g, wheels, x, y, z, r, w, hub = 0.55) => {
      const n = new THREE.Group(); n.position.set(x, y, z); g.add(n);
      add(cyl(r, r, w, 16), M.tire, n, { rz: RX });
      add(cyl(r * hub, r * hub, w + 0.12, 8), M.mech, n, { rz: RX, edges: false });
      add(cyl(r * 0.22, r * 0.22, w + 0.3, 6), M.dark, n, { rz: RX, edges: false });
      wheels.push(n);
    };
    const quad = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];
    function vehicle(kind) {
      const g = new THREE.Group(), wheels = [];
      if (kind === "S") {
        // ハンビー(装甲型): 車輪の間の駆動部(暗)、扉の部分は下まで、前後は車輪の上だけ(輪の上に黒いフェンダー)、
        // 広く平たいボンネット(通気口)、縦の格子と前照灯、太いバンパー、ほぼ垂直の2枚の風防、厚い扉と小さな角窓、低い後部、屋根の銃塔
        const R = 2.7, X = 4.6, ZF = 6.6, ZR = -6.6, W = 10.8, Y0 = 3.5, YH = 6.7, YR = 9.7;
        add(U.loft(THREE, [{ z: -10.2, pts: quad(6.0, 2.0) }, { z: 10.0, pts: quad(6.0, 2.0) }]), M.dark, g, { y: 1.6 });                   // 駆動部
        add(box(W, YH - Y0, 7.0), M.white2, g, { y: (Y0 + YH) / 2, z: 0.1 });                                                             // 扉の部分
        add(U.loft(THREE, [{ z: 3.8, pts: quad(W, 1.0) }, { z: 9.6, pts: quad(W, 0.9) }, { z: 10.6, pts: quad(W - 0.6, 0.5) }]), M.white2, g, { y: YH - 1.0 });   // ボンネットの外板(前の車輪の上)
        add(box(6.4, 2.2, 6.6), M.white2, g, { y: Y0 + 1.1, z: 7.1 });                                                                     // エンジン部(車輪の間)
        add(U.loft(THREE, [{ z: -10.8, pts: quad(W, 0.9) }, { z: -3.4, pts: quad(W, 1.0) }]), M.white2, g, { y: YH - 1.0 });                // 後ろの車輪の上
        add(box(6.4, 2.2, 6.0), M.white2, g, { y: Y0 + 1.1, z: -7.8 });
        for (const s of [-1, 1]) for (const z of [ZF, ZR]) add(box(2.4, 0.35, 6.0), M.dark, g, { x: s * (X + 0.3), y: YH - 1.15, z, edges: false });   // 黒いフェンダー
        add(box(W + 0.1, 0.45, 7.0), M.band, g, { y: Y0 + 0.4, z: 0.1, edges: false });                                                   // 扉の下の帯
        // ボンネットの上: 通気口、前の格子(縦の溝)、前照灯、バンパーと牽引フック
        const vents = []; for (let i = 0; i < 6; i++) vents.push([box(4.2, 0.12, 0.3), { y: YH + 0.02, z: 5.2 + i * 0.6 }]);
        add(U.merge(THREE, vents), M.dark, g, { edges: false });
        add(box(5.0, 2.4, 0.3), M.dark, g, { y: YH - 1.6, z: 10.45, edges: false });
        const slots = []; for (let i = 0; i < 9; i++) slots.push([box(0.22, 2.0, 0.12), { x: -2.0 + i * 0.5, y: YH - 1.6, z: 10.62 }]);
        add(U.merge(THREE, slots), M.mech, g, { edges: false });
        for (const s of [-1, 1]) { add(box(1.6, 1.2, 0.4), M.dark, g, { x: s * 3.7, y: YH - 1.4, z: 10.5, edges: false }); add(cyl(0.42, 0.42, 0.2, 10), M.panel, g, { x: s * 3.7, y: YH - 1.4, z: 10.72, rx: RX, edges: false }); }
        add(box(W - 0.4, 1.0, 0.9), M.dark, g, { y: Y0 + 0.2, z: 10.9 });
        for (const s of [-1, 1]) add(box(0.5, 0.7, 0.7), M.mech, g, { x: s * 3.0, y: Y0 + 0.2, z: 11.5, edges: false });
        // 運転室: ほぼ垂直の風防(2枚、中柱)、平たい屋根、厚い扉と小さな角窓、扉の継ぎ目、ミラー
        add(U.loft(THREE, [{ z: -4.8, pts: quad(W - 0.4, YR - YH) }, { z: 3.0, pts: quad(W - 0.4, YR - YH) }, { z: 3.8, pts: quad(W - 0.6, YR - YH - 0.25) }]), M.white2, g, { y: YH });
        add(box(W - 1.2, YR - YH - 0.25, 0.1), M.dark, g, { y: YH + (YR - YH) / 2, z: 3.86, edges: false });
        for (const s of [-1, 1]) add(box(4.1, 1.9, 0.12), M.glass, g, { x: s * 2.25, y: YH + 1.45, z: 3.95, edges: false });
        for (const s of [-1, 1]) {
          for (const z of [1.3, -2.6]) { add(box(0.12, 1.4, 1.6), M.dark, g, { x: s * (W / 2 - 0.15), y: YH + 1.6, z, edges: false }); add(box(0.14, 1.0, 1.2), M.glass, g, { x: s * (W / 2 - 0.12), y: YH + 1.6, z, edges: false }); }
          for (const z of [3.5, -0.6, -4.6]) add(box(0.1, YR - Y0 - 0.5, 0.12), M.dark, g, { x: s * (W / 2 + 0.01), y: (Y0 + YR) / 2 - 0.2, z, edges: false });
          add(box(0.4, 0.9, 0.7), M.dark, g, { x: s * (W / 2 + 0.5), y: YH + 1.2, z: 3.4, edges: false });
        }
        // 後部: 運転室より低く、後ろへ少し下がる。後ろの角に棒のアンテナ
        add(U.loft(THREE, [{ z: -10.8, pts: quad(W - 0.4, 1.9) }, { z: -4.8, pts: quad(W - 0.4, 2.5) }]), M.white2, g, { y: YH });
        for (const s of [-1, 1]) { add(cyl(0.25, 0.3, 0.6, 6), M.dark, g, { x: s * 4.6, y: YH + 2.2, z: -10.2, edges: false }); add(cyl(0.05, 0.05, 6, 4), M.dark, g, { x: s * 4.6, y: YH + 5.2, z: -10.2, edges: false }); }
        for (const s of [-1, 1]) add(box(0.8, 0.5, 0.15), M.dark, g, { x: s * 4.2, y: YH + 1.2, z: -10.85, edges: false });
        // 屋根の銃塔リングと防弾板(前と、斜めの左右)
        add(cyl(2.4, 2.4, 0.5, 16), M.mech, g, { y: YR + 0.25, z: -1.0 });
        add(U.loft(THREE, [{ z: 1.3, pts: [[-2.7, 0], [2.7, 0], [2.4, 2.4], [-2.4, 2.4]] }, { z: 1.6, pts: [[-2.7, 0], [2.7, 0], [2.4, 2.4], [-2.4, 2.4]] }]), M.white2, g, { y: YR + 0.5 });
        for (const s of [-1, 1]) add(box(0.3, 2.0, 2.6), M.white2, g, { x: s * 2.75, y: YR + 1.5, z: 0.1, ry: s * 0.35 });
        for (const s of [-1, 1]) for (const z of [ZF, ZR]) wheel(g, wheels, s * X, R, z, R, 2.0, 0.5);
        return { g, top: YR + 0.5, z: -1.0, wheels, track: null, wr: R, post: 0.4, wk: 0.75 };   // 武装は車体に合わせて小さく
      }
      if (kind === "M") {
        // 装輪の機動戦闘車(8輪): 一つながりの車体。下は V 字の車体、上は車輪の上へ張り出す上部(下面は斜め)。同じ外装色で継ぎ目だけ暗い線。
        // 前は低い楔形の装甲、前左に操縦席のハッチと潜望鏡、前右にエンジンの格子、側面に収納箱、後ろに扉、泥よけ、前照灯の囲い
        const R = 2.3, X = 5.0, Y1 = 1.0, YS = 5.2, YT = 8.0, ZB = -14, ZF = 14;
        const low = [[-2.4, 0], [2.4, 0], [3.8, 1.6], [3.8, YS - Y1 + 0.2], [-3.8, YS - Y1 + 0.2], [-3.8, 1.6]];
        add(U.loft(THREE, [{ z: ZB, pts: low }, { z: 10.5, pts: low }, { z: ZF - 0.4, pts: low.map(([x, y]) => [x * 0.9, y * 0.45 + (YS - Y1) * 0.55]) }]), M.white2, g, { y: Y1 });
        const up = (h) => [[-3.8, 0], [3.8, 0], [5.95, 0.7], [5.95, h * 0.72], [5.1, h], [-5.1, h], [-5.95, h * 0.72], [-5.95, 0.7]];
        add(U.loft(THREE, [{ z: ZB, pts: up(YT - YS + 0.6) }, { z: 8.0, pts: up(YT - YS + 0.6) }, { z: ZF, pts: up(YT - YS + 0.6).map(([x, y]) => [x * 0.95, y * 0.3]) }]), M.white2, g, { y: YS - 0.6 });
        add(box(11.95, 0.35, 21.4), M.band, g, { y: YS + 1.2, z: -3.4, edges: false });
        // 側面の収納箱
        for (const s of [-1, 1]) for (const [z, l] of [[-9.2, 5.6], [-2.6, 5.0]]) add(box(0.7, 1.6, l), M.panel, g, { x: s * 6.3, y: YS + 0.6, z });
        // 前: 操縦席のハッチと潜望鏡、エンジンの格子、前照灯の囲い、牽引フック
        add(box(2.6, 0.35, 2.8), M.panel, g, { x: -3.0, y: YT - 0.2, z: 7.2 });
        for (let i = 0; i < 3; i++) add(box(0.5, 0.4, 0.3), M.dark, g, { x: -3.8 + i * 0.8, y: YT - 0.1, z: 8.7, edges: false });
        const grille = []; for (let i = 0; i < 7; i++) grille.push([box(3.4, 0.12, 0.3), { x: 2.8, y: YT + 0.02, z: 4.6 + i * 0.55 }]);
        add(U.merge(THREE, grille), M.dark, g, { edges: false });
        for (const s of [-1, 1]) { add(box(1.4, 1.0, 1.0), M.mech, g, { x: s * 4.4, y: YS + 0.5, z: 12.4 }); add(box(0.9, 0.5, 0.1), M.panel, g, { x: s * 4.4, y: YS + 0.5, z: 12.92, edges: false }); }
        for (const s of [-1, 1]) add(box(0.6, 0.7, 0.8), M.dark, g, { x: s * 2.0, y: Y1 + 2.4, z: ZF - 0.2, edges: false });
        // 後ろ: 扉と尾灯、角に棒のアンテナ
        add(box(4.2, 3.4, 0.15), M.dark, g, { y: YS + 0.5, z: ZB - 0.05, edges: false });
        add(box(3.9, 3.1, 0.2), M.white2, g, { y: YS + 0.5, z: ZB - 0.1, edges: false });
        for (const s of [-1, 1]) add(box(0.8, 0.5, 0.15), M.dark, g, { x: s * 4.6, y: YS + 1.6, z: ZB - 0.08, edges: false });
        for (const s of [-1, 1]) add(cyl(0.05, 0.05, 6, 4), M.dark, g, { x: s * 4.6, y: YT + 3, z: ZB + 1.0, edges: false });
        // 泥よけ(前後の車輪群の後ろ)
        for (const s of [-1, 1]) for (const z of [-13.0, 0.9]) add(box(1.8, 1.8, 0.15), M.dark, g, { x: s * X, y: YS - 1.4, z, edges: false });
        for (const s of [-1, 1]) for (const z of [-10.4, -4.6, 3.6, 9.4]) wheel(g, wheels, s * X, R, z, R, 1.8, 0.55);
        return { g, top: YT, z: -2.5, wheels, track: null, wr: R };
      }
      // L: 履帯の車体(前が斜めの装甲、側面のスカート)と、輪の上を回る履板
      const r = 2.8, Ls = 30 - 2 * r, P = 2 * Ls + 2 * Math.PI * r, N = Math.round(P / 1.3), hw = 6.5, lift = r * 0.7, H = 5.0;
      const sec = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];
      add(U.loft(THREE, [{ z: -15, pts: sec(2 * hw, H) }, { z: 8, pts: sec(2 * hw, H) }, { z: 15, pts: sec(2 * hw, H * 0.4) }]), M.white2, g, { y: lift });
      add(box(2 * hw + 0.1, 0.5, 23), M.band, g, { y: lift + H * 0.55, z: -3.5, edges: false });
      for (const s of [-1, 1]) {
        const x = s * (hw + 1.4);
        for (const z of [-Ls / 2, Ls / 2]) add(cyl(r * 0.85, r * 0.85, 2.2, 12), M.mech, g, { x, y: r, z, rz: RX });
        for (let i = 1; i < 6; i++) add(cyl(r * 0.6, r * 0.6, 2.0, 10), M.mech, g, { x, y: r * 0.62, z: -Ls / 2 + (Ls * i) / 6, rz: RX, edges: false });
        add(box(0.5, 2.4, Ls + 2), M.white2, g, { x: s * (hw + 2.8), y: r * 2 - 0.5 });             // スカート
        add(box(2.9, 0.5, Ls + 2), M.white2, g, { x: s * (hw + 1.5), y: r * 2 + 0.7 });
      }
      add(box(1.2, 0.6, 0.3), M.dark, g, { x: -3, y: lift + H * 0.3, z: 15.05, edges: false });
      const pads = new THREE.InstancedMesh(box(2.4, 0.4, 1.1), M.tire, N * 2); g.add(pads);
      return { g, top: lift + H, z: -2, wheels, track: { pads, r, Ls, P, N, x: hw + 1.4, off: 0 }, wr: r };
    }
    const padAt = (tr, s, out) => {
      const { r, Ls } = tr, A = Math.PI * r;
      s = ((s % tr.P) + tr.P) % tr.P;
      if (s < Ls) return out.set(Ls / 2 - s, 0, Math.PI);
      if (s < Ls + A) { const a = (s - Ls) / r; return out.set(-Ls / 2 - r * Math.sin(a), r - r * Math.cos(a), Math.PI + a); }
      if (s < 2 * Ls + A) return out.set(-Ls / 2 + (s - Ls - A), 2 * r, 0);
      const a = (s - 2 * Ls - A) / r; return out.set(Ls / 2 + r * Math.sin(a), r + r * Math.cos(a), a);
    };

    // ── 組み立て ──
    let size, mobile = !!opts.mobile, rig = null;
    function build() {
      if (rig) { group.remove(rig.root); rig.root.traverse((o) => o.geometry?.dispose()); add.reset(); }
      const root = new THREE.Group(); root.scale.setScalar(SCALE[size + (mobile && size === "S" ? "mobile" : "")]); group.add(root);
      const veh = new THREE.Group(); root.add(veh);
      const base = mobile ? vehicle(size) : plinth(size);
      veh.add(base.g);
      const w = size === "S" ? weaponS(base.post) : size === "M" ? (mobile ? weaponMV() : weaponM()) : weaponL();
      w.node.position.set(0, base.top, base.z); if (base.wk) w.node.scale.setScalar(base.wk); veh.add(w.node);
      const shots = w.muzzles.map(() => { const m = add(box(0.45, 0.45, 8), M.shot, root, { edges: false }); m.visible = false; return { m, t: 9, from: V(), dir: V() }; });
      const NP = 14, smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.smoke, NP); root.add(smoke);
      const puffs = Array.from({ length: NP }, (_, i) => ({ life: i / NP, ox: 0, oz: 0 }));
      // 動かない部品を焼いてまとめる(車両、旋回部、俯仰部、反動で動く部分、回る銃身、うなだれるレドームは別。車輪は InstancedMesh 1 つ)
      const baked = U.bake(THREE, root, {
        dynamic: [veh, w.yawG, ...w.pitchG, ...w.muzzles.map((m) => m.rec), w.spin, w.droop].filter(Boolean),
        instanced: base.wheels.length ? [{ groups: base.wheels, staticEdges: true }] : [],
      });
      rig = { root, veh, base, w, shots, smoke, puffs, gi: 0, baked };
      update(0);
    }

    // ── 状態と更新 ──
    let state = opts.state ?? "idle", clock = 0, dead = state === "destroyed" ? 1 : 0, aim = 0, yawNow = 0, pitchNow = 0, fireT = 0, spinV = 0, u = 0, speed = 0, heading = 0;
    const PATROL = { rx: 34, rz: 20 };
    const mt = new THREE.Matrix4(), inv = new THREE.Matrix4(), q = new THREE.Quaternion(), rq = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), v2 = new THREE.Vector3(), sc = new THREE.Vector3(), pad = new THREE.Vector3();
    const ease = (t) => t * t * (3 - 2 * t);
    function update(dt) {
      if (!rig) return;
      const R = rig, W = R.w;
      clock += dt;
      dead = Math.max(0, Math.min(1, dead + (state === "destroyed" ? dt / 1.4 : -dt / 2.5)));
      const k = ease(dead), engaged = state === "engaged" && k < 0.05;
      // 巡回(移動型): 楕円の上を進む。交戦・撃破では止まる
      if (mobile) {
        speed += ((state === "idle" ? 7 : 0) - speed) * Math.min(1, dt * 1.2);
        u += (speed * dt) / (Math.hypot(PATROL.rx * Math.sin(u), PATROL.rz * Math.cos(u)) || 1);
        R.veh.position.set(PATROL.rx * Math.cos(u), 0, PATROL.rz * Math.sin(u));
        heading = Math.atan2(-PATROL.rx * Math.sin(u), PATROL.rz * Math.cos(u));
        R.veh.rotation.set(0.04 * k, heading, -0.07 * k);
        for (const wh of R.base.wheels) wh.rotation.x += (speed * dt) / R.base.wr;
        const tr = R.base.track;
        if (tr) {
          tr.off += speed * dt;
          for (let side = 0; side < 2; side++) for (let i = 0; i < tr.N; i++) {
            padAt(tr, (i / tr.N) * tr.P + tr.off, pad);
            mt.compose(v.set((side ? 1 : -1) * tr.x, pad.y + 0.2, pad.x), q.setFromEuler(e.set(pad.z, 0, 0)), sc.set(1, 1, 1));
            tr.pads.setMatrixAt(side * tr.N + i, mt);
          }
          tr.pads.instanceMatrix.needsUpdate = true;
        }
      } else { R.veh.position.set(0, 0, 0); R.veh.rotation.set(0, 0, 0); heading = 0; }
      // 砲塔: 待機は見回す。交戦は標的(盤面に対してゆっくり回る向き)を追う。撃破は砲がうなだれて傾く
      aim += dt * 0.3;
      const yawT = engaged ? 0.5 + Math.sin(aim) * 1.0 - heading : Math.sin(clock * 0.4) * 1.0;
      const pitchT = engaged ? 0.18 + Math.sin(aim * 1.7) * 0.06 : 0.05;
      yawNow += (yawT - yawNow) * Math.min(1, dt * (engaged ? 5 : 1.6)) * (1 - k);
      pitchNow += ((k > 0.4 ? -0.22 : pitchT) - pitchNow) * Math.min(1, dt * 2.5);
      W.yawG.rotation.set(0, yawNow, 0.12 * k);
      for (const p of W.pitchG) p.rotation.x = -pitchNow;
      if (W.droop) { W.droop.rotation.z = 0.35 * k; W.droop.position.y = 0.7 - 0.5 * k; }
      // 射撃: M は銃身の束が回り始めてから。L は左右交互。反動で砲身が下がる
      if (W.spin) { spinV += ((engaged ? 30 : 0) - spinV) * Math.min(1, dt * 3); W.spin.rotation.z += spinV * dt; }
      fireT -= dt;
      const ready = engaged && (!W.spin || spinV > 20) && Math.sin(clock * 1.6) > -0.2;
      let firedIdx = -1;
      if (ready && fireT <= 0) { fireT = W.rate; firedIdx = W.alternate ? (R.gi = (R.gi + 1) % W.muzzles.length) : -2; }
      W.muzzles.forEach((mz, i) => {
        if (firedIdx === i || firedIdx === -2) { mz.t = 0; mz.fresh = true; }
        mz.t = (mz.t ?? 9) + dt;
        mz.flash.visible = mz.t < 0.045; mz.flash.rotation.z = clock * 40;
        if (mz.rec) mz.rec.position.z = -(mz.amt ?? 0) * Math.max(0, 1 - mz.t * 8);
      });
      R.baked.sync();   // 車輪の回転を InstancedMesh へ
      R.root.updateMatrixWorld(true);
      inv.copy(R.root.matrixWorld).invert(); R.root.getWorldQuaternion(rq).invert();
      W.muzzles.forEach((mz, i) => {
        const sh = R.shots[i];
        if (mz.fresh) { mz.fresh = false; mz.flash.getWorldPosition(sh.from).applyMatrix4(inv); sh.dir.set(0, 0, 1).applyQuaternion(mz.flash.getWorldQuaternion(q)).applyQuaternion(rq); sh.t = 0; }
        sh.t += dt; sh.m.visible = sh.t < 0.3 && k < 0.05;
        if (sh.m.visible) { sh.m.position.copy(sh.from).addScaledVector(sh.dir, 6 + sh.t * 300); sh.m.quaternion.setFromUnitVectors(zAxis, sh.dir); }
      });
      // 煙: 撃破のときだけ、武装のあたりから
      W.yawG.getWorldPosition(v2).applyMatrix4(inv);
      R.puffs.forEach((p, i) => {
        p.life += dt * 0.35; if (p.life > 1) { p.life -= 1; p.ox = (Math.random() - 0.5) * 4; p.oz = (Math.random() - 0.5) * 4; }
        const L = p.life, s = k * (0.6 + L * 2.6) * (1 - Math.max(0, L - 0.7) * 3.3);
        v.set(v2.x + p.ox + L * 6, v2.y + 4 + L * 26, v2.z + p.oz - L * 3);
        mt.compose(v, q.setFromEuler(e.set(i, i * 2, 0)), sc.setScalar(Math.max(0.001, s))); R.smoke.setMatrixAt(i, mt);
      });
      R.smoke.instanceMatrix.needsUpdate = true;
    }
    function setSize(s) { size = s; build(); }
    setSize(opts.size ?? "M");
    return {
      group, update, setTeam() {}, stats: () => U.stats(group), parts: {},
      setSize, get size() { return size; }, setMobile(m) { mobile = m; build(); }, get mobile() { return mobile; },
      setState(s) { state = s; }, get state() { return state; },
    };
  }

  (window.DreamAssets ??= {}).guard = guard;
})();
