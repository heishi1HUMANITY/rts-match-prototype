// 中規模拠点「研究所」の詳細版モデル(試作)。建築模型の方針(白・明灰・暗、チーム色はアクセントだけ、輪郭線)。
// 左に半分埋めた円形の加速器(光の粒がチーム色の尾を引いて回る。後ろに入射用の直線の建屋、前に検出器棟)、
// 右に巨大なパラボラの電波望遠鏡(円形のレールを走る2本の塔で鏡を挟む。稼働中は空を追い、停止すると鏡を真上へ向けて休める)、
// 奥に研究棟、左手前に変電設備。点滅する灯や透けるガラスは使わない。
//
//   const lab = DreamAssets.lab(THREE, { r: 75 });   // r = 制圧圏の半径(mid.radius)。ビューアでは表示倍率 3.0
//   scene.add(lab.group); lab.setTeam(0xff6a1a); lab.setState("run" | "stop"); lab.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3, glass: 0x5d7486 };

  function lab(THREE, opts = {}) {
    const U = DreamAssets.util;
    const r = opts.r ?? 75, D = 4;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      body: lambert(P.body), light: lambert(P.light), mid: lambert(P.mid), dark: lambert(P.dark), glass: lambert(P.glass),
      dish: lambert(P.body, { side: THREE.DoubleSide }),
      accent: lambert(P.neutral), glow: basic(P.neutral), trail: basic(P.neutral, { transparent: true, opacity: 0.5, depthWrite: false }),
      lamp: basic(0xfff3c4), lampOff: basic(0x8b8f86),
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 12, gapSize: 9, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.08, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "lab";
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
    const teamMats = [M.accent, M.glow, M.trail];
    // 2点を結ぶ角材(U.merge 用の [geo, 置き方])
    const zAxis = new THREE.Vector3(0, 0, 1), qq = new THREE.Quaternion(), ee = new THREE.Euler();
    const strut = (a, b, w) => {
      const d = new THREE.Vector3().subVectors(b, a), len = d.length();
      ee.setFromQuaternion(qq.setFromUnitVectors(zAxis, d.normalize()));
      return [box(w, w, len), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, rx: ee.x, ry: ee.y, rz: ee.z }];
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // ── 台座 ──
    const HX = 56, HZ = 46;
    add(U.slab(THREE, HX, HZ, 12, D), M.body, group);
    add(U.slab(THREE, HX + 3, HZ + 3, 13.5, 1), M.dark, group, { edges: false });

    // ── 加速器: 半分埋めた太い輪、上面にチーム色の細い線、点検口 ──
    const AX = -30, AZ = -2, AR = 20;
    const tube = new THREE.TorusGeometry(AR, 3.2, 8, 64); tube.rotateX(Math.PI / 2);
    add(tube, M.light, group, { x: AX, y: D, z: AZ, edges: false });
    const line = new THREE.TorusGeometry(AR, 0.35, 4, 96); line.rotateX(Math.PI / 2);
    add(line, M.accent, group, { x: AX, y: D + 3.1, z: AZ, edges: false });
    const hatches = [];
    for (const k of [1, 3, 4, 5, 7]) { const a = (k / 8) * Math.PI * 2; hatches.push([box(3.6, 2.2, 3.6), { x: AX + Math.cos(a) * AR, y: D + 3.4, z: AZ + Math.sin(a) * AR, ry: -a }]); }
    add(U.merge(THREE, hatches), M.body, group);
    // 光の粒と尾(チーム色)。輪の上を回る
    const NT = 10, beam = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.trail, NT); group.add(beam);
    const head = add(new THREE.SphereGeometry(1.5, 10, 8), M.glow, group, { edges: false });
    // 入射棟: 輪の奥に接する細長い建屋(直線の加速器を納める)
    add(box(30, 5, 6), M.body, group, { x: AX + 15, y: D + 2.5, z: AZ - AR });
    add(box(30.2, 0.8, 6.2), M.accent, group, { x: AX + 15, y: D + 4.2, z: AZ - AR, edges: false });
    add(box(7, 8, 9), M.light, group, { x: AX + 31, y: D + 4, z: AZ - AR });                    // 電源室
    // 検出器棟(輪の前側をまたぐ)
    const DX = AX, DZ = AZ + AR;
    add(box(17, 12, 13), M.body, group, { x: DX, y: D + 6, z: DZ });
    add(box(17.2, 1, 13.2), M.accent, group, { x: DX, y: D + 9.6, z: DZ, edges: false });
    add(box(9, 7, 0.3), M.dark, group, { x: DX, y: D + 3.5, z: DZ + 6.55, edges: false });       // 搬入口
    add(box(0.8, 0.8, 14), M.mid, group, { x: DX - 5, y: D + 12.4, z: DZ, edges: false });         // 屋上の走行クレーンのレール
    add(box(0.8, 0.8, 14), M.mid, group, { x: DX + 5, y: D + 12.4, z: DZ, edges: false });
    // 輪の中: 制御棟(円筒)
    add(cyl(8, 8, 7, 24), M.body, group, { x: AX, y: D + 3.5, z: AZ });
    add(cyl(8.1, 8.1, 1.2, 24), M.glass, group, { x: AX, y: D + 4.2, z: AZ, edges: false });
    add(new THREE.CylinderGeometry(8.3, 8.3, 0.8, 24, 1, true), M.accent, group, { x: AX, y: D + 6, z: AZ, edges: false });

    // ── 電波望遠鏡: 円形のレール、レールを走る2本の塔、塔の間で上下に回る鏡 ──
    const TX = 26, TZ = 6, RAIL = 25, H = 30, R = 21, F = 17, VO = -6;       // H = 仰角軸の高さ、R = 鏡の半径、F = 焦点距離、VO = 鏡の底の位置(軸から)
    const rail = new THREE.RingGeometry(RAIL - 2, RAIL + 2, 64); rail.rotateX(-Math.PI / 2);
    add(rail, M.mid, group, { x: TX, y: D + 0.08, z: TZ, edges: false });
    const railLine = new THREE.TorusGeometry(RAIL, 0.3, 4, 96); railLine.rotateX(Math.PI / 2);
    add(railLine, M.dark, group, { x: TX, y: D + 0.3, z: TZ, edges: false });
    add(cyl(4, 4.6, 2, 16), M.light, group, { x: TX, y: D + 1, z: TZ });                       // 中心の軸受け
    const az = new THREE.Group(); az.position.set(TX, D, TZ); group.add(az);
    // 塔: A 字の脚2本 + 筋交い、頂部の軸受け箱、レールの上の台車
    const towers = [];
    for (const s of [-1, 1]) {
      const x = s * RAIL, top = V(x, H - 2, 0);
      towers.push(strut(V(x, 1.5, -11), top, 1.6), strut(V(x, 1.5, 11), top, 1.6));
      for (const [y, w] of [[10, 7.3], [19, 4.0]]) towers.push(strut(V(x, y, -w), V(x, y, w), 1));
      towers.push(strut(V(x, 1.5, -11), V(x, 19, 4), 0.8), strut(V(x, 1.5, 11), V(x, 19, -4), 0.8));
      towers.push([box(4, 2.4, 26), { x, y: 1.2 }]);                                                  // 台車
      towers.push([box(4, 5, 5), { x, y: H }]);                                                     // 軸受け箱
    }
    towers.push([box(2 * RAIL, 2.2, 3), { y: 1.1 }]);                                                // 2本の塔をつなぐ下の桁
    add(U.merge(THREE, towers), M.light, az);
    for (const s of [-1, 1]) add(box(4.2, 0.8, 5.2), M.accent, az, { x: s * RAIL, y: H + 1.4, edges: false });
    // 鏡: 回転放物面(口が +y)、縁の輪、裏の放射状の骨と中心の筒、焦点の受信器を4本脚で支える
    const elev = new THREE.Group(); elev.position.y = H; az.add(elev);
    const prof = []; for (let i = 0; i <= 14; i++) { const x = (R * i) / 14; prof.push(new THREE.Vector2(Math.max(x, 0.01), VO + (x * x) / (4 * F))); }
    add(new THREE.LatheGeometry(prof, 48), M.dish, elev, { edges: false });
    const RIMY = VO + (R * R) / (4 * F);
    const rimG = new THREE.TorusGeometry(R, 0.45, 4, 64); rimG.rotateX(Math.PI / 2);
    add(rimG, M.mid, elev, { y: RIMY, edges: false });
    const back = [], HUB = V(0, VO - 6, 0);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      back.push(strut(HUB, V(c * (R - 0.4), RIMY - 0.6, sn * (R - 0.4)), 0.7));
      const r2 = R * 0.55, a2 = ((k + 1) / 16) * Math.PI * 2, y2 = VO + (r2 * r2) / (4 * F) - 2.2;
      back.push(strut(V(c * r2, y2, sn * r2), V(Math.cos(a2) * r2, y2, Math.sin(a2) * r2), 0.5));
    }
    back.push([cyl(1.5, 4, 6, 12), { y: VO - 3 }]);
    for (const s of [-1, 1]) back.push([cyl(1.3, 1.3, RAIL - R + 0.6, 10), { x: s * (R + RAIL) / 2, y: 0, rz: Math.PI / 2 }]);   // 仰角軸(縁から塔へ)
    for (const s of [-1, 1]) back.push(strut(V(s * R * 0.92, RIMY - 0.6, 0), V(s * R * 0.4, VO - 2, 0), 0.9));
    add(U.merge(THREE, back), M.mid, elev, { edges: false });
    const feed = [], FY = VO + F;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; feed.push(strut(V(Math.cos(a) * R * 0.97, RIMY, Math.sin(a) * R * 0.97), V(0, FY - 1.2, 0), 0.55)); }
    add(U.merge(THREE, feed), M.mid, elev, { edges: false });
    add(box(3, 3.4, 3), M.light, elev, { y: FY });
    add(box(3.1, 0.8, 3.1), M.accent, elev, { y: FY + 1, edges: false });

    // ── 研究棟(奥): 長い3階建て、窓の帯と縦の庇、屋上の空調機。右端に低い棟 ──
    const BX0 = 2, BX1 = 50, BZ = -38, BD = 12, BH = 15;
    add(box(BX1 - BX0, BH, BD), M.body, group, { x: (BX0 + BX1) / 2, y: D + BH / 2, z: BZ });
    const fac = [];
    for (let f = 0; f < 3; f++) fac.push([box(BX1 - BX0 - 2, 1.8, 0.3), { x: (BX0 + BX1) / 2, y: D + 2.6 + f * 4.6, z: BZ + BD / 2 + 0.1 }]);
    add(U.merge(THREE, fac), M.glass, group, { edges: false });
    const fins = []; for (let i = 0; i <= 16; i++) fins.push([box(0.5, BH - 1.5, 1.2), { x: BX0 + 1 + i * ((BX1 - BX0 - 2) / 16), y: D + (BH - 1.5) / 2, z: BZ + BD / 2 + 0.6 }]);
    add(U.merge(THREE, fins), M.light, group, { edges: false });
    add(box(BX1 - BX0 + 0.4, 1, BD + 0.4), M.accent, group, { x: (BX0 + BX1) / 2, y: D + BH - 0.8, z: BZ, edges: false });
    const hvac = []; for (let i = 0; i < 4; i++) hvac.push([box(5, 2.4, 4), { x: BX0 + 8 + i * 10, y: D + BH + 2.2, z: BZ - 1 }]);
    add(U.merge(THREE, hvac), M.mid, group);
    add(box(10, 8, 10), M.light, group, { x: BX0 - 6, y: D + 4, z: BZ - 1 });

    // ── 変電設備(左手前): 変圧器3基と開閉所の建屋、低い柵 ──
    const SX = -30, SZ = 36;
    for (let i = 0; i < 3; i++) {
      add(box(5, 5, 4), M.mid, group, { x: SX - 12 + i * 9, y: D + 2.5, z: SZ });
      add(box(5.6, 3.4, 0.5), M.light, group, { x: SX - 12 + i * 9, y: D + 2.5, z: SZ + 2.2, edges: false });   // 放熱板
      add(cyl(0.4, 0.4, 3, 6), M.dark, group, { x: SX - 12 + i * 9, y: D + 6.5, z: SZ - 0.8, edges: false });
    }
    add(box(10, 6, 7), M.body, group, { x: SX + 17, y: D + 3, z: SZ });
    const fence = [];
    for (const [x0, z0, x1, z1] of [[-48, 30, -10, 30], [-48, 42, -10, 42], [-48, 30, -48, 42], [-10, 30, -10, 42]]) {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 4));
      for (let i = 0; i <= n; i++) fence.push([box(0.35, 2.6, 0.35), { x: x0 + ((x1 - x0) * i) / n, y: D + 1.3, z: z0 + ((z1 - z0) * i) / n }]);
      fence.push([box(Math.abs(x1 - x0) + 0.3, 0.25, Math.abs(z1 - z0) + 0.3), { x: (x0 + x1) / 2, y: D + 2.4, z: (z0 + z1) / 2 }]);
    }
    add(U.merge(THREE, fence), M.mid, group, { edges: false });

    // ── 照明柱 ──
    const lamps = [];
    for (const [x, z] of [[-52, -36], [-2, 40], [54, -24]]) { add(cyl(0.3, 0.5, 18, 6), M.light, group, { x, y: D + 9, z, edges: false }); lamps.push(add(box(3, 0.8, 1.6), M.lampOff, group, { x, y: D + 18.4, z, edges: false })); }

    // ── 制圧圏 ──
    const { ring, disc } = U.zone(THREE, group, r, M.ring, M.disc);

    // ── 状態と更新 ──
    // 仰角 e: 鏡の向き (0, sin e, cos e)。elev.rotation.x = π/2 - e。停止中は e = π/2(真上)
    const STOW = Math.PI / 2;
    let state = opts.state ?? "run", clock = 0, rate = state === "run" ? 1 : 0, ang = 0, track = 0;
    let e = state === "run" ? 1.0 : STOW, azA = -0.5;
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    function update(dt) {
      clock += dt;
      rate += ((state === "run" ? 1 : 0) - rate) * Math.min(1, dt * 1.5);
      ang += dt * rate * 2.2;
      // 光の粒(止まると消える)
      head.visible = beam.visible = rate > 0.05;
      head.position.set(AX + Math.cos(ang) * AR, D + 3.4, AZ + Math.sin(ang) * AR);
      for (let i = 0; i < NT; i++) { const a = ang - (i + 1) * 0.06; v.set(AX + Math.cos(a) * AR, D + 3.4, AZ + Math.sin(a) * AR); mt.compose(v, q, sc.setScalar(1.3 * (1 - i / NT))); beam.setMatrixAt(i, mt); }
      beam.instanceMatrix.needsUpdate = true;
      // 望遠鏡: 稼働中はゆっくり空をなぞる。停止すると方位はそのまま、鏡を真上へ。仰角は 1 秒に 0.25 rad まで
      const run = state === "run";
      if (run) track += dt;
      const eT = run ? 0.95 + Math.sin(track * 0.09) * 0.3 : STOW;
      e += Math.max(-0.25 * dt, Math.min(0.25 * dt, (eT - e) * Math.min(1, dt * 1.2)));
      if (run && e > 0.3) azA += dt * 0.05 * Math.cos(track * 0.05);
      az.rotation.y = azA; elev.rotation.x = Math.PI / 2 - e;
      for (const l of lamps) l.material = run ? M.lamp : M.lampOff;
      M.ring.dashOffset = (M.ring.dashOffset ?? 0) - dt * 8;
    }
    function setTeam(c) { const col = c ?? P.neutral; for (const m of teamMats) m.color.set(col); M.ring.color.set(col); M.disc.color.set(col); }
    U.bake(THREE, group, { dynamic: [az, elev], live: [M.accent] });   // 動かない部品を焼いてまとめる(望遠鏡の方位部と仰角部は別)
    update(0);
    return {
      group, update, setTeam, stats: () => U.stats(group), parts: { ring, disc },
      setState(s) { state = s; }, get state() { return state; },
      // 確認用: 鏡がいちばん下がったときの床からの高さ、塔の内側までの余裕
      check: () => ({ dishLow: +(H - Math.hypot(R + 0.5, RIMY)).toFixed(2), towerGap: +(RAIL - 2 - (R + 0.5)).toFixed(2), elev: +e.toFixed(2) }),
    };
  }

  (window.DreamAssets ??= {}).lab = lab;
})();
