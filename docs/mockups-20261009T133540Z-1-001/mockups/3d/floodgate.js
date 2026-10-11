// 大拠点「中央水門」の詳細版モデル(試作)。three.js のプリミティブだけで組む低ポリの建築模型。
// 方針は packages/client/src/game/models.ts と同じ: 白・明灰・暗の Lambert、チーム色はアクセントのみ、
// ジオメトリとマテリアルは共有、輪郭線(EdgesGeometry)で CAD 図面の見え方に寄せる。
// ゲームに組み込むときは THREE を import に置き換えれば models.ts にそのまま移せる形にしてある。
//
//   const gate = DreamAssets.floodgate(THREE, { r: 110 });   // r = 制圧圏の半径(config.ts の grand.radius)。ゲームでは表示倍率 1.5 をかける
//   scene.add(gate.group); gate.setTeam(0xff6a1a); gate.setState("opening"); gate.update(dt)
//
// 状態: "closed"(門扉が下りて上流が高い)→ "opening"(5秒で門扉が上がり、警告灯が点滅、水位がそろう)→ "open"(水が流れる)
(function () {
  const PALETTE = { body: 0xfbfcfd, light: 0xe9edf1, dark: 0x3b4752, neutral: 0x8f98a3, water: 0x1fd3ff, amber: 0xffb020, edge: 0x3b4752 };
  const OPEN_SEC = 5;

  // 警告縞(門扉の下端)と水面は common.js の共通のもの(川・港・NPC と同じ)
  function floodgate(THREE, opts = {}) {
    const U = DreamAssets.util;
    const r = opts.r ?? 110;  // 制圧圏(当たり判定)の半径
    const p = r * 0.74;       // 台座の半径
    const W = 36;              // 水路の幅
    const L = p * 1.9;         // 水路の長さ(流れは +z 方向)
    const deck = 6;            // 台座の上面
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const M = {
      body: lambert(PALETTE.body), light: lambert(PALETTE.light), dark: lambert(PALETTE.dark),
      accent: lambert(PALETTE.neutral),
      hazard: lambert(0xffffff, { map: U.hazardTexture(THREE, 4) }),
      water: U.waterMaterial(THREE),
      beacon: new THREE.MeshBasicMaterial({ color: PALETTE.amber }),
      beaconOff: new THREE.MeshBasicMaterial({ color: 0x6b5a2e }),
      edge: new THREE.LineBasicMaterial({ color: PALETTE.edge, transparent: true, opacity: 0.55 }),
      cable: new THREE.LineBasicMaterial({ color: PALETTE.dark }),
      ring: U.dashed(THREE, { color: PALETTE.neutral, dashSize: 14, gapSize: 10, transparent: true, opacity: 0.85 }),
      disc: new THREE.MeshBasicMaterial({ color: PALETTE.neutral, transparent: true, opacity: 0.08, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "floodgate";
    // 共通の add(輪郭線つき)を、このファイルの呼び方(x, y, z を引数で渡す)に合わせた包み
    const addU = U.adder(THREE, M.edge, 30);
    const add = (geo, mat, x, y, z, { edges = true, parent = group, name } = {}) => { const m = addU(geo, mat, parent, { x, y, z, edges }); if (name) m.name = name; return m; };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

    // ── 台座: 八角の2段 + 足元の暗い帯 ──
    add(new THREE.CylinderGeometry(p, p + 4, deck, 8), M.body, 0, deck / 2, 0);
    add(new THREE.CylinderGeometry(p + 4.6, p + 4.6, 1.2, 8), M.dark, 0, 0.6, 0, { edges: false });
    for (const sx of [-1, 1]) add(box(p * 0.5, 4, p * 0.95), M.light, sx * (W / 2 + 8 + p * 0.25), deck + 2, 0);

    // ── 水路: 床と両岸の壁 ──
    add(box(W, 2, L), M.light, 0, deck + 1, 0, { edges: false });
    const wallG = box(6, 14, L);
    for (const sx of [-1, 1]) add(wallG, M.light, sx * (W / 2 + 3), deck + 7, 0);
    // 岸の係留柱(InstancedMesh で1回の描画にまとめる)
    const bollardG = new THREE.CylinderGeometry(1.6, 1.6, 4, 6);
    const bollards = new THREE.InstancedMesh(bollardG, M.dark, 16);
    const mtx = new THREE.Matrix4(); let bi = 0;
    for (const sx of [-1, 1]) for (let i = 0; i < 8; i++) {
      const z = -L / 2 + 10 + i * ((L - 20) / 7);
      if (Math.abs(z) < 18) { mtx.makeScale(0, 0, 0); } else mtx.makeTranslation(sx * (W / 2 + 3), deck + 16, z);
      bollards.setMatrixAt(bi++, mtx);
    }
    group.add(bollards);

    // ── 水面: 上流(-z)と下流(+z)。閉じていると上流が高い ──
    const waterG = new THREE.PlaneGeometry(W, L / 2); waterG.rotateX(-Math.PI / 2);
    const up = new THREE.Mesh(waterG, M.water); up.position.set(0, 0, -L / 4); group.add(up);
    const downMat = M.water.clone(); downMat.map = M.water.map.clone(); downMat.map.needsUpdate = true;
    const down = new THREE.Mesh(waterG, downMat); down.position.set(0, 0, L / 4); group.add(down);
    const WATER = { up: deck + 12, down: deck + 4, open: deck + 8 };

    // ── 門の構造: 両側の塔、機械室、ガントリー ──
    const towerG = box(14, 46, 22), houseG = box(18, 10, 26), bandG = box(14.6, 3.2, 22.6), windowG = box(18.6, 2.2, 26.6), slotG = box(2, 40, 6);
    const accents = [];
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 + 13);
      add(towerG, M.body, x, deck + 23, 0);
      add(slotG, M.dark, sx * (W / 2 + 6.2), deck + 22, 0, { edges: false });   // 門扉の溝
      accents.push(add(bandG, M.accent, x, deck + 38, 0, { edges: false }));    // チーム色の帯
      add(houseG, M.light, x, deck + 51, 0);
      add(windowG, M.dark, x, deck + 51.5, 0, { edges: false });
    }
    const beamG = box(W + 44, 4, 5);
    for (const z of [-7, 7]) add(beamG, M.light, 0, deck + 58, z);
    add(box(W + 8, 3, 18), M.dark, 0, deck + 61, 0, { edges: false });          // 巻き上げ機の台

    // ── 門扉(上下に動く)と下端の警告縞 ──
    const leaf = new THREE.Group(); group.add(leaf);
    const LEAF_H = 24;
    add(box(W - 2, LEAF_H, 4), M.body, 0, 0, 0, { parent: leaf });
    for (const y of [-6, 0, 6]) add(box(W - 2.4, 1.2, 4.6), M.light, 0, y, 0, { parent: leaf, edges: false });  // 補強の横桁
    add(box(W - 2, 2.6, 4.8), M.hazard, 0, -LEAF_H / 2 + 1.3, 0, { parent: leaf, edges: false });
    const LEAF_Y = { closed: deck + 2 + LEAF_H / 2, open: deck + 30 + LEAF_H / 2 };
    leaf.position.y = LEAF_Y.closed;
    // 巻き上げのワイヤ(門扉の上端から巻き上げ機まで)
    const cablePts = new Float32Array(12);
    const cableG = new THREE.BufferGeometry(); cableG.setAttribute("position", new THREE.BufferAttribute(cablePts, 3));
    const cables = new THREE.LineSegments(cableG, M.cable); group.add(cables);
    const updateCables = () => {
      const top = leaf.position.y + LEAF_H / 2, hoist = deck + 59.5;
      [-W / 4, W / 4].forEach((x, i) => cablePts.set([x, top, 0, x, hoist, 0], i * 6));
      cableG.attributes.position.needsUpdate = true;
    };

    // ── 警告灯(塔の上の4隅): 開放中に点滅 ──
    const beaconG = new THREE.CylinderGeometry(1.8, 1.8, 3, 8);
    const beacons = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) beacons.push(add(beaconG, M.beaconOff, sx * (W / 2 + 13 + 6), deck + 57.5, sz * 9, { edges: false }));

    // ── 操作室(台座の上、上流側)とアンテナ ──
    const hutX = W / 2 + 8 + p * 0.25, hutZ = -p * 0.38;
    add(box(24, 13, 17), M.body, hutX, deck + 4 + 6.5, hutZ);
    add(box(24.4, 2, 17.4), M.dark, hutX, deck + 4 + 9, hutZ, { edges: false });
    accents.push(add(box(25, 1.6, 18), M.accent, hutX, deck + 4 + 13.8, hutZ, { edges: false }));
    add(new THREE.CylinderGeometry(0.7, 0.7, 20, 5), M.dark, hutX + 7, deck + 4 + 23, hutZ + 4, { edges: false });
    // 反対側: 予備の門扉を置いた架台(見た目の重心をそろえる)
    add(box(30, 3, 10), M.light, -hutX, deck + 4 + 1.5, p * 0.36);
    add(box(26, 6, 3), M.body, -hutX, deck + 4 + 6, p * 0.36);
    add(box(26, 1.6, 3.4), M.hazard, -hutX, deck + 4 + 3.6, p * 0.36, { edges: false });

    // ── 制圧圏(地面の点線リングと薄い円盤) ──
    const { ring, disc } = U.zone(THREE, group, r, M.ring, M.disc);

    // ── 状態と更新 ──
    let state = opts.state ?? "closed", t = state === "open" ? 1 : 0, clock = 0;
    const ease = (x) => x * x * (3 - 2 * x);
    function apply() {
      const k = ease(t);
      leaf.position.y = LEAF_Y.closed + (LEAF_Y.open - LEAF_Y.closed) * k;
      up.position.y = WATER.up + (WATER.open - WATER.up) * k;
      down.position.y = WATER.down + (WATER.open - WATER.down) * k;
      updateCables();
    }
    function update(dt) {
      clock += dt;
      if (state === "opening") { t = Math.min(1, t + dt / OPEN_SEC); if (t >= 1) state = "open"; }
      if (state === "closing") { t = Math.max(0, t - dt / OPEN_SEC); if (t <= 0) state = "closed"; }
      apply();
      const moving = state === "opening" || state === "closing";
      const blink = moving && Math.floor(clock * 4) % 2 === 0;
      for (const [i, b] of beacons.entries()) b.material = moving ? ((i % 2 === 0) === blink ? M.beacon : M.beaconOff) : (state === "open" ? M.beacon : M.beaconOff);
      // 水の流れ: 開いているほど速い(閉じていても上流はゆっくり揺れる)
      const speed = 0.05 + 0.55 * ease(t);
      M.water.map.offset.y -= dt * speed;
      downMat.map.offset.y -= dt * speed * 1.3;
      ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8;
    }
    function setState(s) {
      if (s === "open" || s === "closed") { state = s; t = s === "open" ? 1 : 0; apply(); }
      else if (s === "opening" || s === "closing") state = s;
    }
    function setTeam(color) {
      const c = color ?? PALETTE.neutral;
      M.accent.color.set(c); M.ring.color.set(c); M.disc.color.set(c);
    }
    const stats = () => U.stats(group);
    apply();
    U.bake(THREE, group, { dynamic: [leaf], live: [M.accent] });   // 動かない部品を焼いてまとめる(門扉は別)
    return { group, update, setState, setTeam, stats, get state() { return state; }, get progress() { return t; }, parts: { leaf, beacons, ring, disc, up, down } };
  }

  (window.DreamAssets ??= {}).floodgate = floodgate;
})();
