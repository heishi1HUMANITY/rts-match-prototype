// 大拠点の守備(ボス)の詳細版モデル(試作)。中央水門を守る、艦の兵器を陸に据えた要塞砲塔。東側の艦載兵器を下敷きにした SF 寄りの形:
//   主砲: 角ばった連装砲塔(AK-130 風)。長い砲身2本、防盾、側面の照準器の箱。左右交互に撃ち、砲身が後座する
//   近接防御: 後ろの左右の張り出しに 6 本銃身の機関砲を上下 2 門並べた低い角ばった砲塔(AK-630M-2 風)を 2 基。銃身の束が回って連射する
//   ミサイル: 後ろの甲板の垂直発射区画(2 列 × 4)。蓋が横へ開いて真上へ打ち上げ、向きを変えて標的へ飛ぶ(煙の尾、列の間の排気口から煙)
//   射撃管制: 後ろの柱の上の箱。平たい箱形の覆いのレーダーと、側面の電子光学照準器(暗いガラスの窓。光らない)。回り続けない(標的の方向を向くだけ)
// 中立の機械なので、チーム色は使わない(白い外装、灰色の機構、中立色の帯)。
// 状態: 待機(砲塔が見回す)/ 交戦(主砲・機関砲・ミサイルで撃つ)/ 損傷(片側の機関砲が止まり、煙が上がる)/ 撃破(砲身が垂れ、砲塔が傾き、レーダーがうなだれ、黒い煙)。
//
//   const b = DreamAssets.boss(THREE);
//   scene.add(b.group); b.setState("idle" | "engaged" | "damaged" | "destroyed"); b.update(dt)
//
// 前方 = +z、上 = +y。ボスらしく、表示倍率 3.2(部隊の 1.6 倍)で見せる前提の寸法。
(function () {
  const C = { white: 0xf2f4f6, white2: 0xe3e8ec, panel: 0xc9d0d7, mech: 0x59636d, dark: 0x262e36, gun: 0x2f363d, band: 0x8f98a3, concrete: 0xd5dbe1, edge: 0x141b21 };

  function boss(THREE, opts = {}) {
    const U = DreamAssets.util;
    const group = new THREE.Group(); group.name = "boss";
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      white: lambert(C.white), white2: lambert(C.white2, { flatShading: true }), panel: lambert(C.panel, { flatShading: true }), mech: lambert(C.mech), dark: lambert(C.dark), gun: lambert(C.gun, { flatShading: true }),
      band: lambert(C.band), concrete: lambert(C.concrete, { flatShading: true }), glass: lambert(0x1c252d), hazard: lambert(0xffffff, { map: U.hazardTexture(THREE, 8) }),
      flash: basic(0xffb347, { transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }), flashCore: basic(0xfff1c8), shot: basic(0xff8a1a), missile: lambert(0xe9ecef),
      smoke: lambert(0x4a525a, { transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }), trail: lambert(0xd9dde0, { transparent: true, opacity: 0.6, depthWrite: false, flatShading: true }),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.5 }),
    };
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const RX = Math.PI / 2, zAxis = V(0, 0, 1);
    const flashAt = (parent, z, r) => U.flashAt(THREE, add, M.flash, M.flashCore, parent, z, r);

    // ── 台座: 八角の装甲の台座(斜めの壁、帯)、上の甲板、後ろの左右の張り出し、前の段 ──
    const DECK = 7;
    add(new THREE.CylinderGeometry(25, 28, DECK, 8), M.concrete, group, { y: DECK / 2, ry: Math.PI / 8 });
    add(new THREE.CylinderGeometry(28.6, 29.2, 1.0, 8), M.concrete, group, { y: 0.5, ry: Math.PI / 8 });
    add(new THREE.CylinderGeometry(25.5, 25.5, 0.8, 8, 1, true), M.band, group, { y: DECK - 1.6, ry: Math.PI / 8, edges: false });
    add(box(30, 0.6, 34), M.panel, group, { y: DECK + 0.3, z: -1 });                              // 甲板の板
    for (const s of [-1, 1]) add(U.loft(THREE, [{ z: -20, pts: [[-5, 0], [5, 0], [4, 3], [-4, 3]] }, { z: -8, pts: [[-5, 0], [5, 0], [4, 3], [-4, 3]] }]), M.white2, group, { x: s * 15, y: DECK });   // 機関砲の張り出し
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; add(box(3.4, 3.2, 3.4), M.concrete, group, { x: Math.cos(a) * 29, y: 1.6, z: Math.sin(a) * 29, ry: -a }); }

    // ── 主砲: 角ばった連装砲塔(前が斜め、側面の照準器の箱、後ろの張り出し)、防盾から長い砲身 2 本 ──
    const main = new THREE.Group(); main.position.set(0, DECK + 0.6, 10); group.add(main);   // 旋回しても後ろのミサイル区画に届かない位置(後ろの角の回る半径 約13)
    add(cyl(8.5, 9, 1.0, 16), M.mech, main, { y: 0.5 });
    const tsec = (w, h, t) => [[-w / 2, 0], [w / 2, 0], [w / 2, h * 0.75], [w * t / 2, h], [-w * t / 2, h], [-w / 2, h * 0.75]];
    add(U.loft(THREE, [{ z: -11, pts: tsec(15, 7.4, 0.84) }, { z: 4, pts: tsec(16, 7.6, 0.84) }, { z: 9, pts: tsec(13, 4.2, 0.8) }]), M.white2, main, { y: 1.0 });
    add(box(16.1, 0.5, 15), M.band, main, { y: 1.0 + 3.4, z: -3.5, edges: false });
    for (const s of [-1, 1]) add(box(1.6, 2.2, 3.6), M.panel, main, { x: s * 8.4, y: 1.0 + 5.4, z: 1.0 });   // 照準器の箱
    add(box(4, 0.5, 4), M.panel, main, { x: -3.4, y: 1.0 + 7.8, z: -4 });                                 // 天板のハッチ
    const mainP = new THREE.Group(); mainP.position.set(0, 1.0 + 3.0, 8.0); main.add(mainP);
    add(box(9.5, 3.6, 1.6), M.mech, mainP, { z: 0.4 });                                                     // 防盾
    const mainM = [];
    for (const s of [-1, 1]) {
      const bar = new THREE.Group(); bar.position.x = s * 2.6; mainP.add(bar);
      add(cyl(1.2, 1.2, 3, 12), M.dark, bar, { z: 2.4, rx: RX, edges: false });
      add(cyl(0.75, 0.9, 26, 12), M.gun, bar, { z: 16, rx: RX, edges: false });
      add(cyl(1.0, 1.0, 1.4, 12), M.gun, bar, { z: 28.8, rx: RX, edges: false });
      mainM.push({ flash: flashAt(bar, 29.6, 2.4), rec: bar, amt: 2.6 });
    }

    // ── 近接防御(AK-630M-2 風): 低い角ばった砲塔、上下 2 門の 6 本銃身の機関砲、上の照準器 ──
    function duet(x, z) {
      const node = new THREE.Group(); node.position.set(x, DECK + 3, z); group.add(node);
      add(cyl(3.0, 3.3, 0.8, 12), M.mech, node, { y: 0.4 });
      const yawG = new THREE.Group(); yawG.position.y = 0.8; node.add(yawG);
      const sec = [[-3.2, 0], [3.2, 0], [3.4, 2.2], [2.4, 4.0], [-2.4, 4.0], [-3.4, 2.2]];
      add(U.loft(THREE, [{ z: -4.4, pts: sec.map(([a, b]) => [a * 0.9, b * 0.85]) }, { z: 1.8, pts: sec }, { z: 3.6, pts: sec.map(([a, b]) => [a * 0.8, b * 0.9]) }]), M.white2, yawG);
      add(box(1.4, 1.0, 1.6), M.panel, yawG, { x: 1.6, y: 4.4, z: -0.6 });                                 // 照準器
      const pitchG = new THREE.Group(); pitchG.position.set(0, 2.0, 3.2); yawG.add(pitchG);
      add(box(3.0, 3.6, 1.0), M.mech, pitchG, { z: 0.2 });
      const spins = [], muzzles = [];
      for (const y of [-0.85, 0.85]) {
        const sp = new THREE.Group(); sp.position.set(0, y, 0.6); pitchG.add(sp);
        const parts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push([cyl(0.12, 0.12, 7.5, 5), { x: Math.cos(a) * 0.45, y: Math.sin(a) * 0.45, z: 3.75, rx: RX }]); }
        add(U.merge(THREE, parts), M.dark, sp, { edges: false });
        add(cyl(0.7, 0.7, 0.4, 10), M.mech, sp, { z: 3.0, rx: RX, edges: false });
        add(cyl(0.72, 0.72, 1.0, 10), M.white2, sp, { z: 7.2, rx: RX });                                  // 砲口の覆い
        spins.push(sp); muzzles.push({ flash: flashAt(sp, 7.8, 1.0) });
      }
      return { yawG, pitchG, spins, muzzles, spinV: 0, fireT: 0 };
    }
    const duets = [duet(-15, -14), duet(15, -14)];

    // ── 垂直発射区画(2 列 × 4、主砲の砲塔が旋回しても届かない後ろ側)。甲板より一段高い縁、升目の枠、列の間の排気口(格子)、縁の警告縞。
    //    蓋はそれぞれ外側の辺の蝶番で横へ開いて立つ(隣の升目や後ろの列をふさがない)。蓋には縁と補強の筋 2 本 ──
    const hatches = [], cells = [], VZ = [-8.6, -13.4], VX = [-6.6, -2.2, 2.2, 6.6], VY = DECK + 1.3;
    add(box(19.6, 0.7, 11.4), M.mech, group, { y: DECK + 0.95, z: -11 });                       // 台(甲板より一段高い)
    const rim = [];
    for (const s of [-1, 1]) { rim.push([box(19.6, 0.5, 0.5), { z: -11 + s * 5.45 }]); rim.push([box(0.5, 0.5, 11.4), { x: s * 9.55 }]); }
    for (const x of [-4.4, 0, 4.4]) for (const z of VZ) rim.push([box(0.3, 0.35, 3.8), { x, z }]);
    add(U.merge(THREE, rim), M.white2, group, { y: VY + 0.05, z: 0 });
    for (const s of [-1, 1]) add(box(19.0, 0.06, 0.6), M.hazard, group, { y: VY + 0.32, z: -11 + s * 5.0, edges: false });
    // 列の間の排気口: 細い蓋と格子
    add(box(18.4, 0.1, 1.2), M.dark, group, { y: VY + 0.02, z: -11, edges: false });
    const grille = []; for (let i = 0; i < 16; i++) grille.push([box(0.18, 0.12, 1.1), { x: -8.4 + i * 1.12 }]);
    add(U.merge(THREE, grille), M.mech, group, { y: VY + 0.1, z: -11, edges: false });
    for (const z of VZ) for (const x of VX) {
      add(box(3.8, 0.1, 3.6), M.dark, group, { x, y: VY + 0.02, z, edges: false });              // 升目の穴(蓋が開くと見える)
      const out = x < 0 ? -1 : 1;
      const h = new THREE.Group(); h.position.set(x + out * 1.9, VY + 0.1, z); group.add(h);    // 蝶番は外側の辺
      add(box(3.7, 0.22, 3.5), M.white2, h, { x: -out * 1.85, y: 0.11 });
      const ribs = []; for (const dz of [-0.8, 0.8]) ribs.push([box(3.1, 0.14, 0.3), { x: -out * 1.85, y: 0.29, z: dz }]);
      ribs.push([box(0.3, 0.14, 3.2), { x: -out * 3.4, y: 0.29 }]);
      add(U.merge(THREE, ribs), M.panel, h, { edges: false });
      add(cyl(0.22, 0.22, 3.3, 8), M.mech, h, { y: 0.15, rx: RX, edges: false });                // 蝶番
      hatches.push({ h, out, open: 0, t: 9 }); cells.push(V(x, VY, z));
    }

    // ── 射撃管制: 後ろの柱の上の旋回する箱。上に平たい箱形の覆いに入ったレーダー(回り続けない。標的の方向を向くだけ)、
    //    側面に電子光学照準器(熱線映像・テレビ・レーザー測距の暗いガラスの窓。光らない) ──
    add(cyl(1.0, 1.4, 8, 10), M.mech, group, { y: DECK + 4, z: -20 });
    const dir = new THREE.Group(); dir.position.set(0, DECK + 8.5, -20); group.add(dir);
    add(U.loft(THREE, [{ z: -2.2, pts: [[-2.2, 0], [2.2, 0], [2.0, 2.6], [-2.0, 2.6]] }, { z: 2.2, pts: [[-2.2, 0], [2.2, 0], [2.0, 2.2], [-2.0, 2.2]] }]), M.white2, dir);
    const ant = new THREE.Group(); ant.position.set(0, 3.0, 0.2); dir.add(ant);                 // レーダー: 俯仰する平たい箱
    add(box(5.6, 3.4, 1.0), M.panel, ant, { y: 1.7 });
    add(box(5.7, 0.4, 1.05), M.band, ant, { y: 0.5, edges: false });
    add(box(1.2, 0.6, 1.4), M.mech, ant, { y: 0.0, edges: false });
    const eo = new THREE.Group(); eo.position.set(2.9, 1.3, 0.6); dir.add(eo);                  // 電子光学照準器
    add(box(1.6, 2.0, 3.0), M.white2, eo);
    add(cyl(0.45, 0.45, 0.2, 14), M.glass, eo, { y: 0.45, z: 1.55, rx: RX, edges: false });    // 熱線映像の窓
    add(box(0.7, 0.5, 0.12), M.glass, eo, { x: -0.25, y: -0.35, z: 1.55, edges: false });      // テレビの窓
    add(cyl(0.18, 0.18, 0.2, 10), M.glass, eo, { x: 0.45, y: -0.35, z: 1.55, rx: RX, edges: false });   // レーザー測距の窓

    // ── 弾・ミサイル・煙 ──
    const allM = [...mainM, ...duets.flatMap((d) => d.muzzles)];
    for (const m of allM) { const s = add(box(m.amt ? 1.0 : 0.4, m.amt ? 1.0 : 0.4, m.amt ? 12 : 7), M.shot, group, { edges: false }); s.visible = false; m.shot = { m: s, t: 9, from: V(), dir: V() }; }
    const MN = 6, mis = Array.from({ length: MN }, () => { const g = new THREE.Group(); add(cyl(0.6, 0.6, 5, 8), M.missile, g, { rx: RX }); add(new THREE.ConeGeometry(0.6, 1.4, 8), M.missile, g, { z: 3.2, rx: RX, edges: false }); add(box(2.2, 0.15, 1.0), M.dark, g, { z: -2.0, edges: false }); g.visible = false; group.add(g); return { g, t: 9, p: V(), v: V() }; });
    const TN = 90, trail = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.trail, TN); group.add(trail);
    const puffs = Array.from({ length: TN }, () => ({ p: V(), t: 9 })); let pi = 0;
    const SN = 26, smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.smoke, SN); group.add(smoke);
    const sm = Array.from({ length: SN }, (_, i) => ({ life: i / SN, ox: 0, oz: 0, src: i % 3 }));

    // ── 状態と更新 ──
    let state = opts.state ?? "idle", clock = 0, dmg = 0, dead = 0, aim = 0, mainYaw = 0, mainPitch = 0, mainT = 1.5, mainI = 0, misT = 3, misI = 0;
    const mt = new THREE.Matrix4(), inv = new THREE.Matrix4(), q = new THREE.Quaternion(), gq = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), v2 = new THREE.Vector3(), sc = new THREE.Vector3(), tgt = new THREE.Vector3();
    const ease = (t) => t * t * (3 - 2 * t);
    const fire = (m) => { m.t = 0; m.fresh = true; };
    // 動かない部品を焼いてまとめる(主砲塔・俯仰部・砲身、近接防御の旋回部・俯仰部・銃身の束、ミサイルの蓋、射撃管制の箱・レーダー・照準器は別)
    U.bake(THREE, group, { dynamic: [main, mainP, ...mainM.map((m) => m.rec), ...duets.flatMap((d) => [d.yawG, d.pitchG, ...d.spins]), ...hatches.map((h) => h.h), dir, ant, eo] });
    function update(dt) {
      clock += dt;
      dmg = Math.max(0, Math.min(1, dmg + (state === "damaged" || state === "destroyed" ? dt / 1.5 : -dt / 2)));
      dead = Math.max(0, Math.min(1, dead + (state === "destroyed" ? dt / 1.6 : -dt / 2.5)));
      const kd = ease(dead), active = (state === "engaged" || state === "damaged") && kd < 0.05;
      // 標的の向き(盤面に対してゆっくり回る)。待機は見回す
      aim += dt * 0.25;
      const yawT = active ? 0.5 + Math.sin(aim) * 0.9 : Math.sin(clock * 0.3) * 0.7;
      mainYaw += (yawT - mainYaw) * Math.min(1, dt * (active ? 1.2 : 0.6)) * (1 - kd);
      mainPitch += ((kd > 0.4 ? -0.12 : active ? 0.14 : 0.03) - mainPitch) * Math.min(1, dt * 1.2);
      main.rotation.set(0, mainYaw, 0.06 * kd); mainP.rotation.x = -mainPitch;
      dir.rotation.set(0, mainYaw * 1.05, 0.12 * kd);
      ant.rotation.x = -(active ? 0.15 : 0.02) + 0.35 * kd; eo.rotation.x = -(active ? mainPitch : 0);
      // 主砲: 3 秒ごとに左右 1 発ずつ。砲身が後座して戻る
      mainT -= dt;
      if (active && mainT <= 0) { fire(mainM[mainI++ % 2]); mainT = mainI % 2 ? 0.5 : 2.6; }
      // 近接防御: 銃身の束が回り始めてから連射。損傷で左の 1 基が止まる
      duets.forEach((d, i) => {
        const on = active && !(i === 0 && dmg > 0.5);
        // 射界: 内側(主砲塔のある方)へは向かない。左は [-2.6, 0.25]、右は [-0.25, 2.6]
        const want = (on ? (i ? 1 : -1) * (0.9 + Math.sin(aim * 1.3 + i) * 0.8) : (i ? 1 : -1) * (1.2 + Math.sin(clock * 0.4 + i * 2) * 0.8)) * (1 - kd);
        const yw = i ? Math.min(2.6, Math.max(-0.25, want)) : Math.min(0.25, Math.max(-2.6, want));
        d.yawG.rotation.set(0, yw - (i === 0 ? 0.5 * dmg : 0), 0.15 * kd);
        d.pitchG.rotation.x = -(kd > 0.4 ? -0.2 : on ? 0.25 + Math.sin(aim * 2 + i) * 0.1 : 0.05);
        d.spinV += ((on ? 32 : 0) - d.spinV) * Math.min(1, dt * 3);
        for (const s of d.spins) s.rotation.z += d.spinV * dt;
        d.fireT -= dt;
        if (on && d.spinV > 22 && Math.sin(clock * 1.5 + i * 2) > -0.3 && d.fireT <= 0) { d.fireT = 0.06; d.muzzles.forEach(fire); }
      });
      for (const m of allM) {
        m.t = (m.t ?? 9) + dt; m.flash.visible = m.t < (m.amt ? 0.09 : 0.045); m.flash.rotation.z = clock * 40;
        if (m.rec) m.rec.position.z = -m.amt * Math.max(0, 1 - m.t * 1.6);
      }
      group.updateMatrixWorld(true);
      inv.copy(group.matrixWorld).invert(); group.getWorldQuaternion(gq).invert();
      for (const m of allM) {
        const sh = m.shot;
        if (m.fresh) { m.fresh = false; m.flash.getWorldPosition(sh.from).applyMatrix4(inv); sh.dir.set(0, 0, 1).applyQuaternion(m.flash.getWorldQuaternion(q)).applyQuaternion(gq); sh.t = 0; }
        sh.t += dt; sh.m.visible = sh.t < (m.amt ? 0.5 : 0.28) && kd < 0.05;
        if (sh.m.visible) { sh.m.position.copy(sh.from).addScaledVector(sh.dir, 6 + sh.t * (m.amt ? 320 : 300)); sh.m.quaternion.setFromUnitVectors(zAxis, sh.dir); }
      }
      // ミサイル: 蓋が開き、真上へ打ち上げてから標的の方向へ曲がる(煙の尾)。5 秒ごと
      misT -= dt;
      if (active && misT <= 0) {
        const k = misI++ % cells.length, h = hatches[k], m = mis.find((x) => x.t > 3.5);
        h.t = 0;
        if (m) { m.p.copy(cells[k]); m.v.set(0, 40, 0); m.t = -0.35; }   // 蓋が開いてから出る
        misT = 5;
      }
      for (const h of hatches) { h.t += dt; h.open += ((h.t < 2.0 ? 1 : 0) - h.open) * Math.min(1, dt * 5); h.h.rotation.z = -h.out * h.open * 1.62; }   // 横へ開いて立つ(約 93°)
      tgt.set(Math.sin(mainYaw) * 400, 60, Math.cos(mainYaw) * 400);
      for (const m of mis) {
        const was = m.t; m.t += dt; m.g.visible = m.t >= 0 && m.t < 3.5;
        if (was < 0 && m.t >= 0) for (let n = 0; n < 5; n++) { const pf = puffs[pi = (pi + 1) % TN]; pf.p.set((Math.random() - 0.5) * 16, VY + 0.5, -11); pf.t = 0; }   // 排気口から煙
        if (!m.g.visible) continue;
        if (m.t > 0.5) { v.copy(tgt).sub(m.p).normalize().multiplyScalar(140); m.v.lerp(v, Math.min(1, dt * 2.2)); }
        m.p.addScaledVector(m.v, dt);
        m.g.position.copy(m.p); m.g.quaternion.setFromUnitVectors(zAxis, v2.copy(m.v).normalize());
        const pf = puffs[pi = (pi + 1) % TN]; pf.p.copy(m.p).addScaledVector(v2, -3); pf.t = 0;
      }
      puffs.forEach((p, i) => {
        p.t += dt; const s = p.t < 1.8 ? (0.8 + p.t * 2) * (1 - p.t / 1.8) : 0;
        mt.compose(v.copy(p.p).add(v2.set(0, p.t * 2, 0)), q.setFromEuler(e.set(i, i * 2, 0)), sc.setScalar(Math.max(0.001, s))); trail.setMatrixAt(i, mt);
      });
      trail.instanceMatrix.needsUpdate = true;
      // 煙: 損傷で左の機関砲から細く、撃破で主砲と甲板から太く
      const SRC = [[-15, DECK + 6, -14], [0, DECK + 9, 6], [6, DECK + 3, -11]];
      sm.forEach((p, i) => {
        p.life += dt * 0.3; if (p.life > 1) { p.life -= 1; p.ox = (Math.random() - 0.5) * 4; p.oz = (Math.random() - 0.5) * 4; }
        const amount = p.src === 0 ? Math.max(dmg, kd) : kd;
        const L = p.life, s = amount * (1.0 + L * 4) * (1 - Math.max(0, L - 0.7) * 3.3);
        const [x, y, z] = SRC[p.src];
        v.set(x + p.ox + L * 8, y + L * 36, z + p.oz - L * 4);
        mt.compose(v, q.setFromEuler(e.set(i, i * 2, 0)), sc.setScalar(Math.max(0.001, s))); smoke.setMatrixAt(i, mt);
      });
      smoke.instanceMatrix.needsUpdate = true;
    }
    update(0);
    return {
      group, update, setTeam() {}, stats: () => U.stats(group), parts: {},
      setState(s) { state = s; }, get state() { return state; },
    };
  }

  (window.DreamAssets ??= {}).boss = boss;
})();
