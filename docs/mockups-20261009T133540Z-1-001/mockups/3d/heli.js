// 部隊トークン「攻撃ヘリ」(試作)。装甲強襲 v2 と同じ方向性: 低く鋭い面構成のステルス機、細部は減らし、光る線で SF らしさを出す。
// 縦列複座の多面体の機体、内蔵式の尾部ファン(フェネストロン)、短い翼と武装ポッド、4枚ローター。
// ゲームと同じく高度に浮かび、地面のベースプレートが影の役をする。
//
//   const heli = DreamAssets.heli(THREE);
//   scene.add(heli.group); heli.setTeam(0xff6a1a); heli.setPaint("stealth" | "team" | "white"); heli.fire(); heli.update(dt)
//
// 前方 = +z、上 = +y。ゲームの部隊表示倍率 2.0、浮かぶ高度 20(表示で 40)を前提にした寸法。
(function () {
  const C = { graphite: 0x2c343c, graphite2: 0x3a434c, white: 0xf2f4f6, light: 0xdfe4e9, dark: 0x1e252c, edge: 0x0b1015, cyan: 0x1fd3ff };
  const ALT = 20;

  function heli(THREE, opts = {}) {
    const U = DreamAssets.util;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      hull: lambert(C.graphite), hull2: lambert(C.graphite2), dark: lambert(C.dark), light: lambert(C.light),
      glass: lambert(0x0f2a36, { emissive: 0x06303d }),
      strip: basic(0xff6a1a), cyan: basic(C.cyan),
      blade: lambert(0x262d34), disc: basic(0xffffff, { transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }),
      flame: basic(0xffd84a, { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      trail: basic(0xffffff, { transparent: true, opacity: 0.5, depthWrite: false }),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.55 }),
      ring: basic(0xff6a1a, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      glow: basic(0xff6a1a, { transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
      shadow: basic(0x1f2a33, { transparent: true, opacity: 0.16, depthWrite: false }),
      sign: new THREE.MeshBasicMaterial({ map: U.signTexture(THREE, "ヘ"), transparent: true }),
    };
    const group = new THREE.Group(); group.name = "heli";
    const air = new THREE.Group(); air.position.y = ALT; group.add(air);        // 浮かんでいる部分
    const tilt = new THREE.Group(); air.add(tilt);                              // 前進時の前傾・旋回のバンク
    const add = U.adder(THREE, M.edge, 18);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

    // ── 機体: 多面体の胴体(側面は上へ行くほど内側へ)→ 尾部ブーム ──
    const BODY = [
      { z: -6.0, pts: U.sym([[1.5, -1.0], [2.0, 0.3], [1.0, 1.5]]) },
      { z: -1.0, pts: U.sym([[2.6, -2.4], [3.3, 0.0], [2.0, 2.6]]) },
      { z: 7.0, pts: U.sym([[2.6, -2.5], [3.1, -0.3], [1.6, 2.4]]) },
      { z: 13.0, pts: U.sym([[1.6, -2.1], [1.9, -0.7], [0.9, 0.9]]) },
      { z: 17.0, pts: U.sym([[0.4, -1.3], [0.5, -0.9], [0.2, -0.5]]) },
    ];
    add(U.loft(THREE, BODY), M.hull, tilt);
    const BOOM = [
      { z: -5.8, pts: U.sym([[1.5, -1.0], [2.0, 0.3], [1.0, 1.5]]) },
      { z: -21.0, pts: U.sym([[0.6, -0.3], [0.8, 0.4], [0.45, 1.0]]) },
    ];
    add(U.loft(THREE, BOOM), M.hull2, tilt);
    // 縦列複座の風防(暗いガラス)と、その後ろの機関の背
    const CANOPY = [
      { z: 3.6, pts: U.sym([[1.7, 2.1], [1.35, 3.3], [0.5, 3.75]]) },
      { z: 8.8, pts: U.sym([[1.75, 2.0], [1.3, 3.2], [0.5, 3.6]]) },
      { z: 12.8, pts: U.sym([[1.0, 1.0], [0.75, 1.5], [0.25, 1.7]]) },
    ];
    add(U.loft(THREE, CANOPY), M.glass, tilt);
    // 風防の中央の桟(光る): 天面の中心線(左右の頂点の中点)に沿わせる
    U.edgeStrip(THREE, M.cyan, CANOPY, (sec) => [0, sec.pts[sec.pts.length - 1][1]], 0, 2, tilt, { w: 0.14, h: 0.1, lift: 0.04, up: true });
    add(U.loft(THREE, [
      { z: -5.0, pts: U.sym([[1.6, 1.4], [2.0, 2.6], [1.1, 3.4]]) },
      { z: 0.5, pts: U.sym([[2.0, 2.2], [2.3, 3.4], [1.3, 4.3]]) },
      { z: 3.8, pts: U.sym([[1.6, 2.2], [1.8, 3.2], [0.9, 3.8]]) },
    ]), M.hull2, tilt);
    // 光る線: 胴体の側面の折れ目と尾部ブーム
    U.edgeStrip(THREE, M.strip, BODY, 4, 0, 3, tilt); U.edgeStrip(THREE, M.strip, BODY, 1, 0, 3, tilt);
    U.edgeStrip(THREE, M.strip, BOOM, 4, 0, 1, tilt, { w: 0.12, h: 0.16 }); U.edgeStrip(THREE, M.strip, BOOM, 1, 0, 1, tilt, { w: 0.12, h: 0.16 });

    // ── 尾部: 後退した垂直尾翼に内蔵のファン、小さな水平尾翼 ──
    add(U.loft(THREE, [
      { z: -19.4, pts: [[-0.55, -0.4], [0.55, -0.4], [0.55, 2.4], [-0.55, 2.4]] },
      { z: -24.6, pts: [[-0.55, -0.6], [0.55, -0.6], [0.55, 6.4], [-0.55, 6.4]] },
      { z: -26.6, pts: [[-0.4, 0.4], [0.4, 0.4], [0.4, 6.8], [-0.4, 6.8]] },
    ]), M.hull2, tilt);
    const ductG = new THREE.CylinderGeometry(1.7, 1.7, 1.25, 12); ductG.rotateZ(Math.PI / 2);
    add(ductG, M.dark, tilt, { y: 1.7, z: -23.2 });
    const fan = new THREE.Group(); fan.position.set(0, 1.7, -23.2); tilt.add(fan);
    for (let k = 0; k < 4; k++) add(box(0.2, 2.9, 0.35), M.light, fan, { rx: (k * Math.PI) / 4, edges: false });
    add(box(7.2, 0.25, 2.0), M.hull2, tilt, { y: 0.2, z: -19.6 });
    for (const sx of [-1, 1]) add(box(0.25, 1.4, 1.8), M.hull2, tilt, { x: sx * 3.6, y: 0.75, z: -19.7 });

    // ── 短い翼と武装ポッド ──
    add(U.loft(THREE, [
      { z: -0.6, pts: [[-8.4, -1.2], [8.4, -1.2], [8.4, -0.85], [-8.4, -0.85]] },
      { z: 2.8, pts: [[-7.6, -1.3], [7.6, -1.3], [7.6, -0.95], [-7.6, -0.95]] },
    ]), M.hull2, tilt);
    const podG = U.loft(THREE, [
      { z: -1.6, pts: U.sym([[0.6, -0.6], [0.6, 0.6]]) },
      { z: 3.4, pts: U.sym([[0.6, -0.6], [0.6, 0.6]]) },
      { z: 4.6, pts: U.sym([[0.3, -0.3], [0.3, 0.3]]) },
    ]);
    const pods = [];
    for (const sx of [-1, 1]) for (const x of [4.9, 7.0]) pods.push(add(podG, M.light, tilt, { x: sx * x, y: -1.95, z: 0.4 }));
    // 機首下の観測装置(光るレンズ)と機関砲
    add(new THREE.CylinderGeometry(0.95, 0.95, 1.3, 8), M.dark, tilt, { y: -2.5, z: 12.0 });
    const lensG = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 10); lensG.rotateX(Math.PI / 2);
    add(lensG, M.cyan, tilt, { y: -2.5, z: 12.95, edges: false });
    add(box(0.35, 0.35, 3.0), M.dark, tilt, { y: -2.35, z: 7.4, edges: false });

    // ── 主ローター: 低い多角形のハブ、4枚のブレード。回ると薄い円盤が見える ──
    add(new THREE.CylinderGeometry(0.5, 0.65, 1.6, 6), M.dark, tilt, { y: 4.9, z: 0.5, edges: false });
    const rotor = new THREE.Group(); rotor.position.set(0, 5.9, 0.5); tilt.add(rotor);
    add(new THREE.CylinderGeometry(1.5, 1.7, 0.9, 8), M.hull2, rotor);
    const bladeG = U.loft(THREE, [
      { z: 1.2, pts: [[-0.75, -0.08], [0.75, -0.08], [0.75, 0.08], [-0.75, 0.08]] },
      { z: 25.0, pts: [[-0.75, -0.08], [0.75, -0.08], [0.75, 0.08], [-0.75, 0.08]] },
      { z: 26.4, pts: [[-0.3, -0.06], [0.75, -0.06], [0.75, 0.06], [-0.3, 0.06]] },
    ]);
    for (let k = 0; k < 4; k++) add(bladeG, M.blade, rotor, { ry: (k * Math.PI) / 2, edges: false });
    const discG = new THREE.RingGeometry(1.8, 26.4, 48); discG.rotateX(-Math.PI / 2);
    const disc = add(discG, M.disc, tilt, { y: 5.95, z: 0.5, edges: false });

    // ── 地面: 影とベースプレート(ローターの円まで囲む)と記号板 ──
    const plate = new THREE.Group(); group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };
    const shadow = flat(new THREE.CircleGeometry(9, 24), M.shadow, 0.15); shadow.scale.set(0.7, 1, 1.9);
    const far = U.reach(THREE, group, air);
    const inner = far + 1.5, outer = inner + 3;
    flat(new THREE.RingGeometry(inner, outer, 64), M.ring, 0.25);
    flat(new THREE.CircleGeometry(inner - 0.4, 64), M.glow, 0.2);
    flat(new THREE.PlaneGeometry(6.5, 6.5), M.sign, 0.35, outer + 3.6);

    // ── ミサイル(撃つと武装ポッドから飛ぶ)。先に 8 発ぶん作って使い回す(撃つたびに作らない) ──
    const missileG = U.loft(THREE, [{ z: -1.2, pts: U.sym([[0.22, -0.22], [0.22, 0.22]]) }, { z: 1.0, pts: U.sym([[0.22, -0.22], [0.22, 0.22]]) }, { z: 1.6, pts: U.sym([[0.02, -0.02], [0.02, 0.02]]) }]);
    const flameG = new THREE.ConeGeometry(0.3, 1.6, 6); flameG.rotateX(-Math.PI / 2);
    const trailG = new THREE.BoxGeometry(0.35, 0.35, 1); trailG.translate(0, 0, -0.5);
    const missiles = Array.from({ length: 8 }, () => {
      const mesh = new THREE.Mesh(missileG, M.light); mesh.visible = false; group.add(mesh);
      const flame = new THREE.Mesh(flameG, M.flame); flame.position.z = -2.0; mesh.add(flame);
      const trail = new THREE.Mesh(trailG, M.trail.clone()); trail.position.z = -2.4; mesh.add(trail);
      return { mesh, trail, t: 9, dir: new THREE.Vector3() };
    });

    // ── 動き ──
    let flying = true, forward = false, clock = 0, alt = ALT, rotorSpeed = 1, podIdx = 0;
    const tmp = new THREE.Vector3();
    function update(dt) {
      clock += dt;
      const targetAlt = flying ? ALT : 3.3;
      alt += (targetAlt - alt) * Math.min(1, dt * 1.2);
      const targetRotor = flying ? 1 : 0.35;
      rotorSpeed += (targetRotor - rotorSpeed) * Math.min(1, dt * 0.8);
      air.position.y = alt + (flying ? Math.sin(clock * 1.6) * 0.35 : 0);
      rotor.rotation.y -= dt * 22 * rotorSpeed;
      fan.rotation.x += dt * 30 * rotorSpeed;
      M.disc.opacity = 0.1 * rotorSpeed;
      const pitch = forward && flying ? 0.16 : 0, bank = forward && flying ? Math.sin(clock * 0.5) * 0.12 : 0;
      tilt.rotation.x += (pitch - tilt.rotation.x) * Math.min(1, dt * 2);
      tilt.rotation.z += (bank - tilt.rotation.z) * Math.min(1, dt * 2);
      // 影は高度に応じて濃さと大きさが変わる
      const h = (alt - 3.3) / (ALT - 3.3);
      M.shadow.opacity = 0.26 - 0.12 * h; shadow.scale.set(0.7 + 0.25 * h, 1, 1.9 + 0.3 * h);
      for (const m of missiles) {
        if (!m.mesh.visible) continue;
        m.t += dt;
        const v = Math.min(160, 30 + m.t * 220);
        m.mesh.position.addScaledVector(m.dir, v * dt);
        m.trail.scale.z = Math.min(12, m.t * 30); m.trail.material.opacity = Math.max(0, 0.5 - m.t * 0.4);
        if (m.t > 1.4) m.mesh.visible = false;
      }
    }
    const fq = new THREE.Quaternion(), gq = new THREE.Quaternion();
    function fire() {
      if (!flying) return;
      const m = missiles.find((x) => !x.mesh.visible); if (!m) return;
      const pod = pods[podIdx++ % pods.length];
      group.updateMatrixWorld(true);
      pod.getWorldPosition(tmp); m.mesh.position.copy(group.worldToLocal(tmp));
      pod.getWorldQuaternion(fq); group.getWorldQuaternion(gq); fq.premultiply(gq.invert());
      m.mesh.quaternion.copy(fq);
      m.dir.set(0, 0, 1).applyQuaternion(fq).add(tmp.set(0, -0.12, 0)).normalize();
      m.t = 0; m.trail.scale.z = 0.01; m.trail.material.opacity = 0.5; m.mesh.visible = true;
    }
    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "stealth";
    function applyPaint() {
      const tc = teamColor.clone();
      if (paint === "stealth") { M.hull.color.set(C.graphite); M.hull2.color.set(C.graphite2); M.blade.color.set(0x262d34); M.strip.color.copy(tc); M.edge.color.set(0x0b1015); }
      else if (paint === "team") { M.hull.color.copy(tc); M.hull2.color.copy(tc).multiplyScalar(0.78); M.blade.color.set(0x3b4752); M.strip.color.set(0xffffff); M.edge.color.set(0x141b21); }
      else { M.hull.color.set(C.white); M.hull2.color.set(C.light); M.blade.color.set(0x8f98a3); M.strip.color.copy(tc); M.edge.color.set(0x3b4752); }
      M.ring.color.copy(tc); M.glow.color.copy(tc);
    }
    applyPaint();
    // 動かない部品を焼いてまとめる(浮く部分・前傾・ローター・尾部ファンは別。武装ポッドは発射位置に使うので残す。塗りで変わる hull / hull2 / blade / strip はマテリアルごと)
    U.bake(THREE, group, { dynamic: [air, tilt, rotor, fan, ...pods], live: [M.hull, M.hull2, M.blade, M.strip], also: [M.strip] });
    return {
      group, update, fire, stats: () => U.stats(group), parts: { plate, rotor, air }, plateRadius: outer,
      setTeam(c) { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }, setPaint(p) { paint = p; applyPaint(); },
      setFlying: (b) => (flying = b), setForward: (b) => (forward = b),
      get flying() { return flying; }, get forward() { return forward; }, get paint() { return paint; },
    };
  }

  (window.DreamAssets ??= {}).heli = heli;
})();
