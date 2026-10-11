// 拠点「発電所(原子力)」の詳細版モデル(試作)。中央水門と同じ建築模型の方針(白・明灰・暗、チーム色はアクセントだけ、輪郭線)。
// 双曲線の冷却塔2基(大小)、格納容器(円筒 + ドーム)、タービン建屋、排気筒、変電設備と送電鉄塔。
// 冷却塔から湯気が上がり、格納容器の足元が青く光る(チェレンコフ光の見立て)。
//
//   const plant = DreamAssets.plant(THREE, { r: 75 });   // r = 制圧圏の半径。ゲームでは表示倍率 1.5 をかける
//   scene.add(plant.group); plant.setTeam(0xff6a1a); plant.setState("run" | "stop" | "alarm"); plant.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3, cyan: 0x1fd3ff, red: 0xe2334f, amber: 0xffb020 };

  // 放射能の標識(三つ葉)を Canvas で描く
  function trefoil(THREE) {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    g.fillStyle = "#ffc83d"; g.fillRect(0, 0, 64, 64);
    g.fillStyle = "#1f2a33"; g.beginPath(); g.arc(32, 32, 5, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k * Math.PI * 2) / 3; g.beginPath(); g.moveTo(32, 32); g.arc(32, 32, 24, a - Math.PI / 6, a + Math.PI / 6); g.closePath(); g.fill(); }
    g.fillStyle = "#ffc83d"; g.beginPath(); g.arc(32, 32, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1f2a33"; g.beginPath(); g.arc(32, 32, 5, 0, Math.PI * 2); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  function plant(THREE, opts = {}) {
    const U = DreamAssets.util;
    const r = opts.r ?? 75, p = r * 0.74, deck = 4;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      body: lambert(P.body), light: lambert(P.light), mid: lambert(P.mid), dark: lambert(P.dark),
      tower: lambert(P.body, { side: THREE.DoubleSide, flatShading: true }), lid: lambert(0xd9dfe4),
      dome: lambert(P.body, { flatShading: true }),
      accent: lambert(P.neutral), glow: basic(P.cyan, { transparent: true, opacity: 0.8 }),
      steam: lambert(0xffffff, { transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }),
      beacon: basic(P.red), beaconOff: basic(0x5a2a33), sign: lambert(0xffffff, { map: trefoil(THREE) }),
      wire: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.7 }),
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 12, gapSize: 9, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.08, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "plant";
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const accents = [];

    // ── 台座: 八角 + 足元の暗い帯 ──
    add(new THREE.CylinderGeometry(p, p + 3, deck, 8), M.body, group, { y: deck / 2 });
    add(new THREE.CylinderGeometry(p + 3.6, p + 3.6, 1, 8), M.dark, group, { y: 0.5, edges: false });
    // 構内の舗装(一段低い明灰の区画)
    add(box(p * 0.9, 0.6, p * 0.45), M.light, group, { x: -p * 0.3, y: deck + 0.3, z: -p * 0.3, edges: false });

    // ── 冷却塔(双曲線を回転させた筒、16分割で面を見せる)。中は少し暗く ──
    const towerProfile = (s) => [[17, 0], [14.6, 8], [12.0, 18], [11.0, 25], [11.4, 31], [12.2, 35]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
    const towers = [];
    for (const [x, z, s] of [[18, 12, 1], [26, -17, 0.78]]) {
      const pts = towerProfile(s);
      const g = new THREE.LatheGeometry(pts, 16);
      const t = add(g, M.tower, group, { x, y: deck, z, edges: false });
      const lid = new THREE.CircleGeometry(12.0 * s, 16); lid.rotateX(-Math.PI / 2);
      add(lid, M.lid, group, { x, y: deck + 33.6 * s, z, edges: false });   // 中は見せない(縁の少し下のふた)
      // 上端の縁(チーム色)と足元の支柱の帯
      accents.push(add(new THREE.CylinderGeometry(12.3 * s, 12.3 * s, 1.2 * s, 16, 1, true), M.accent, group, { x, y: deck + 34.2 * s, z, edges: false }));
      add(new THREE.CylinderGeometry(17.2 * s, 17.4 * s, 2.2 * s, 16, 1, true), M.dark, group, { x, y: deck + 1.1 * s, z, edges: false });
      towers.push({ x, z, top: deck + 35 * s, rad: 11 * s, s });
    }

    // ── 格納容器: 円筒 + ドーム(多面体)、足元の青い光、標識 ──
    const CX = -16, CZ = 12;
    add(new THREE.CylinderGeometry(11, 11.6, 17, 16), M.body, group, { x: CX, y: deck + 8.5, z: CZ });
    add(new THREE.SphereGeometry(11, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.dome, group, { x: CX, y: deck + 17, z: CZ });
    accents.push(add(new THREE.CylinderGeometry(11.15, 11.15, 1.4, 16, 1, true), M.accent, group, { x: CX, y: deck + 15.2, z: CZ, edges: false }));
    const glowRing = add(new THREE.CylinderGeometry(11.7, 11.7, 0.9, 16, 1, true), M.glow, group, { x: CX, y: deck + 1.3, z: CZ, edges: false });
    const signG = new THREE.PlaneGeometry(4, 4);
    const sa = Math.PI / 4, sd = 11.75;                                                    // 壁(半径 11〜11.6)より外
    const mount = add(box(4.8, 4.8, 0.3), M.dark, group, { x: CX + Math.sin(sa) * (sd - 0.2), y: deck + 9, z: CZ + Math.cos(sa) * (sd - 0.2), ry: sa, edges: false });
    add(signG, M.sign, group, { x: CX + Math.sin(sa) * sd, y: deck + 9, z: CZ + Math.cos(sa) * sd, ry: sa, edges: false });
    // 付属建屋(燃料・制御)
    add(box(10, 9, 12), M.light, group, { x: CX - 13, y: deck + 4.5, z: CZ - 4 });
    add(box(10.4, 1.2, 12.4), M.dark, group, { x: CX - 13, y: deck + 7, z: CZ - 4, edges: false });

    // ── タービン建屋: 長い箱に片流れの屋根、格納容器と配管でつなぐ ──
    const TX = -12, TZ = -17;
    add(U.loft(THREE, [
      { z: TZ - 6, pts: [[TX - 14, deck], [TX + 14, deck], [TX + 14, deck + 9], [TX - 14, deck + 12]] },
      { z: TZ + 6, pts: [[TX - 14, deck], [TX + 14, deck], [TX + 14, deck + 9], [TX - 14, deck + 12]] },
    ]), M.body, group);
    accents.push(add(box(28.4, 1.2, 12.4), M.accent, group, { x: TX, y: deck + 6.5, z: TZ, edges: false }));
    for (let k = 0; k < 5; k++) add(box(3.4, 3.2, 0.3), M.dark, group, { x: TX - 10 + k * 5, y: deck + 3, z: TZ - 6.1, edges: false });   // 搬入口
    const z0 = TZ + 5.5, z1 = CZ - 6;                                                     // 建屋の壁の内側 → 格納容器の中
    const pipeG = new THREE.CylinderGeometry(1.1, 1.1, z1 - z0, 8); pipeG.rotateX(Math.PI / 2);
    const flangeG = new THREE.CylinderGeometry(1.6, 1.6, 0.8, 8); flangeG.rotateX(Math.PI / 2);
    for (const dx of [-2.5, 2.5]) {
      const x = CX + 3 + dx, zc = CZ - Math.sqrt(11.4 ** 2 - (x - CX) ** 2);         // 格納容器の壁の位置
      add(pipeG, M.mid, group, { x, y: deck + 5, z: (z0 + z1) / 2 });
      add(flangeG, M.dark, group, { x, y: deck + 5, z: zc - 0.3, edges: false });
      add(flangeG, M.dark, group, { x, y: deck + 5, z: TZ + 6.3, edges: false });
      add(box(1.4, 5, 1.4), M.mid, group, { x, y: deck + 2.5, z: (TZ + 6 + zc) / 2, edges: false });   // 配管の支柱
    }

    // ── 排気筒: 細く高い塔と帯、頂部の警告灯 ──
    const SX = 4, SZ = -27;
    add(new THREE.CylinderGeometry(1.4, 2.0, 40, 8), M.body, group, { x: SX, y: deck + 20, z: SZ });
    for (const y of [12, 24, 36]) add(new THREE.CylinderGeometry(1.75 - y * 0.008, 1.75 - y * 0.008, 1.4, 8), y === 36 ? M.dark : M.mid, group, { x: SX, y: deck + y, z: SZ, edges: false });
    const beaconG = new THREE.CylinderGeometry(0.7, 0.7, 1.2, 8);
    const beacons = [add(beaconG, M.beaconOff, group, { x: SX, y: deck + 40.6, z: SZ, edges: false })];
    for (const t of towers) beacons.push(add(beaconG, M.beaconOff, group, { x: t.x + t.rad + 0.6, y: t.top + 0.4, z: t.z, edges: false }));

    // ── 変電設備と送電鉄塔(電線は細い線) ──
    // 変電設備: 冷却塔・格納容器と重ならない手前の区画(+z)
    const YX = 8, YZ = 33;
    add(box(20, 0.6, 9), M.light, group, { x: YX, y: deck + 0.3, z: YZ, edges: false });
    const trans = [];
    for (let k = 0; k < 3; k++) {
      const x = YX - 6 + k * 6;
      add(box(3.6, 4, 3.2), M.mid, group, { x, y: deck + 2, z: YZ });
      add(box(1.2, 1.6, 1.2), M.dark, group, { x, y: deck + 4.8, z: YZ, edges: false });
      trans.push(new THREE.Vector3(x, deck + 5.6, YZ));
    }
    const pylon = (x, z, h, base = deck) => {
      const g = new THREE.Group(); g.position.set(x, base, z); group.add(g);
      add(U.loft(THREE, [{ z: -1.4, pts: [[-1.8, 0], [1.8, 0], [0.5, h], [-0.5, h]] }, { z: 1.4, pts: [[-1.8, 0], [1.8, 0], [0.5, h], [-0.5, h]] }]), M.light, g);
      add(box(7, 0.6, 0.6), M.dark, g, { y: h - 1.5, edges: false }); add(box(5, 0.6, 0.6), M.dark, g, { y: h - 4.5, edges: false });
      return g;
    };
    const ph = 22, P1 = [YX, 44], P2 = [YX + 10, 64];
    pylon(P1[0], P1[1], ph); pylon(P2[0], P2[1], ph + deck, 0);   // 2基目は台座の外の地面に立つ(上端の高さはそろえる)
    const arms = [[-3.3, -1.5], [3.3, -1.5], [-2.3, -4.5], [2.3, -4.5]];
    const wires = [];
    const sag = (a, b, d) => { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * d, 0))); } return pts.slice(0, -1).flatMap((q, i) => [q, pts[i + 1]]); };
    for (const [dx, dy] of arms) wires.push(...sag(new THREE.Vector3(P1[0] + dx, deck + ph + dy, P1[1]), new THREE.Vector3(P2[0] + dx, deck + ph + dy, P2[1]), 1.6));
    // 変電設備の3台 → 鉄塔の腕(上段の左右と下段の左)
    trans.forEach((t, i) => { const [dx, dy] = arms[[0, 2, 1][i]]; wires.push(...sag(t, new THREE.Vector3(P1[0] + dx, deck + ph + dy, P1[1]), 0.6)); });
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wires), M.wire));

    // ── 制圧圏 ──
    const ringPts = []; for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * r, 0.3, Math.sin(a) * r)); }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), M.ring); ring.computeLineDistances(); group.add(ring);
    const discG = new THREE.CircleGeometry(r, 48); discG.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(discG, M.disc); disc.position.y = 0.2; group.add(disc);

    // ── 湯気: 低ポリの球を冷却塔の口から上げ、膨らませて消す(InstancedMesh 1つ) ──
    const PUFFS = 26;
    const puffG = new THREE.IcosahedronGeometry(1, 0);
    const steam = new THREE.InstancedMesh(puffG, M.steam, PUFFS * towers.length); group.add(steam);
    const puffs = [];
    for (const [ti, t] of towers.entries()) for (let i = 0; i < PUFFS; i++) puffs.push({ t, life: i / PUFFS, seed: Math.random() * 10 + ti, ox: (Math.random() - 0.5) * t.rad, oz: (Math.random() - 0.5) * t.rad });
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), eu = new THREE.Euler();

    // ── 状態と更新 ──
    let state = opts.state ?? "run", clock = 0, power = state === "stop" ? 0 : 1;
    function update(dt) {
      clock += dt;
      const target = state === "stop" ? 0 : state === "alarm" ? 1.5 : 1;
      power += (target - power) * Math.min(1, dt * 0.8);
      // 湯気(風で少し流れる)
      puffs.forEach((pf, i) => {
        pf.life += dt * (0.12 + 0.05 * power);
        if (pf.life > 1) { pf.life -= 1; pf.ox = (Math.random() - 0.5) * pf.t.rad; pf.oz = (Math.random() - 0.5) * pf.t.rad; }
        const L = pf.life, s = pf.t.s;
        const size = Math.min(1, power) * (3 + L * 9) * s * (1 - Math.max(0, L - 0.75) * 3.2) * (state === "alarm" ? 1.3 : 1);
        v.set(pf.t.x + pf.ox * (0.6 + L) + L * 14 * s, pf.t.top + L * 30 * s, pf.t.z + pf.oz * (0.6 + L) - L * 6 * s);
        q.setFromEuler(eu.set(pf.seed + L, pf.seed * 2 + L, 0));
        mt.compose(v, q, sc.setScalar(Math.max(0.001, size))); steam.setMatrixAt(i, mt);
      });
      steam.instanceMatrix.needsUpdate = true;
      M.steam.opacity = 0.5 * Math.min(1, power);
      // 足元の青い光(稼働で脈打つ、停止で消える)
      M.glow.opacity = Math.min(1, power) * (0.55 + 0.3 * Math.sin(clock * 2.4));
      glowRing.visible = power > 0.05;
      // 灯: 稼働中は常灯(航空障害灯。警告ではないので点滅させない)、警報は速く点滅、停止は消灯
      const on = state === "alarm" ? Math.floor(clock * 5) % 2 === 0 : state === "run";
      for (const b of beacons) b.material = on ? M.beacon : M.beaconOff;
      M.ring.dashOffset = (M.ring.dashOffset ?? 0) - dt * 8;
    }
    function setTeam(c) { const col = c ?? P.neutral; M.accent.color.set(col); M.ring.color.set(col); M.disc.color.set(col); }
    U.bake(THREE, group, { live: [M.accent] });   // 動かない部品を焼いてまとめる(動くのは湯気・灯・光だけ)
    return {
      group, update, setTeam, stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; }, get state() { return state; },
    };
  }

  (window.DreamAssets ??= {}).plant = plant;
})();
