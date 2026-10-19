// 戦略施設トークン「ポクロウシク」(ウクライナ・ドネツク州)の詳細版モデル(試作)。鉄道の操車場と幹線道路が交わる町の 1,200 × 1,000 m の切り取り。
// 今の姿: 操車場(本線 2 + 側線 8、両端の分岐)、駅舎とホーム、貨物の倉庫、操車場を越える幹線道路の跨線橋と盛土、北東の炭鉱(立坑櫓 2 基・巻上げ機室・
//   選炭への傾斜コンベヤと積込みの貯炭槽・引込線・事務棟)、南東のボタ山(円錐形の捨石の山、高さ 75 m)、西の 5 階建て・9 階建ての集合住宅(ほぼすべて損傷:
//   屋根の穴、上の階の崩れ、全壊して瓦礫の山)、畑の砲弾の穴。
// 近未来化(施設リストの案): 幹線道路と本線を覆う対ドローンネットのトンネル(アーチの骨組み + 網)、自動運転トラック・無人地上車両の中継ステーション
//   (充電の屋根と太陽電池、蓄電池・制御コンテナ、通信と監視の塔)。
// 誇張: 立坑櫓 1.4 倍(約 43 → 60 m)。ボタ山・道路・線路・建物の平面は実寸。
// 省略: 車両(自動運転トラック・無人車両・貨車)、平屋の個人住宅、人、架線。
(function () {
  const K = 0.14;
  const D = { x0: -600, x1: 600, z0: -500, z1: 500, base: -8, HW: 40, deck: 9 };

  function pokrovsk(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.ballast = M.lambert(0xc4cad0); M.spoil = M.lambert(0x8f969d); M.roof = M.lambert(0xd5d9de);
    const group = new THREE.Group(); group.name = "pokrovsk";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.y = -D.base * K; group.add(world);
    const k = F.kit(THREE, M, K), { add, box, cyl, V, tube, beam, lattice, closedLoft } = k;
    const rnd = U.rng(2026);

    // ── 地面: ほぼ平らなステップ ──
    const hAt = (x, z) => 2 + 0.8 * Math.sin(x / 140) * Math.cos(z / 170);
    terrain(THREE, k, M, world, { x0: D.x0, x1: D.x1, z0: D.z0, z1: D.z1, nx: 24, nz: 20, h: hAt, base: D.base, top: M.land });
    F.plinth(k, M, world, D.x1 - D.x0, D.z1 - D.z0, D.base - 1.2);
    const { pad, pads } = padder(k, M, world, hAt);

    // ── 鉄道: 本線 2 本(z 44 / 56)、操車場の側線 8 本(z 20〜90)、両端の分岐 ──
    const track = (pts) => { add(ribbon(THREE, pts, 4.6, hAt, 0.3), M.ballast, world, { edges: false }); add(ribbon(THREE, pts, 1.7, hAt, 0.6), M.dark, world, { edges: false }); };
    for (const z of [44, 56]) track([[D.x0 + 2, z], [D.x1 - 2, z]]);
    const YARD = [2, 12, 22, 32, 66, 76, 86, 96];   // 本線の外側の側線
    for (const z of YARD) {
      track([[-330, z], [330, z]]);
      const m = z < 50 ? 44 : 56;
      track([[-330, z], [-470, m]]); track([[330, z], [470, m]]);
    }
    {   // 駅舎(2 階、損傷: 屋根の穴と東の端の崩れ)とホーム
      const y = pad(-150, 128, 92, 20, 0, M.light);
      add(box(70, 12, 18), M.body, world, { x: -160, y: y + 6, z: 128 });
      add(box(22, 6, 18), M.body, world, { x: -114, y: y + 3, z: 128 });
      add(closedLoft([[V(-103, y + 6, 119), V(-103, y + 6, 137), V(-125, y + 6, 137), V(-125, y + 6, 119)], [V(-103, y + 7, 119), V(-103, y + 9.5, 137), V(-125, y + 6.2, 137), V(-125, y + 8, 119)]]), M.mid, world);   // 崩れた上の階の残り
      for (const f of [0, 1]) add(box(70.2, 1.4, 18.2), M.glass, world, { x: -160, y: y + 3 + f * 5, z: 128, edges: false });
      add(box(72, 0.6, 20), M.light, world, { x: -160, y: y + 12.3, z: 128 });
      add(box(10, 0.8, 7), M.dark, world, { x: -170, y: y + 12.4, z: 126, edges: false });   // 屋根の穴
      add(box(170, 1.1, 8), M.light, world, { x: -150, y: hAt(-150, 108) + 0.55, z: 108 });
      for (let i = 0; i < 8; i++) add(box(0.5, 4.5, 0.5), M.mid, world, { x: -220 + i * 20, y: hAt(0, 108) + 3.3, z: 108 });
      add(box(160, 0.5, 6), M.light, world, { x: -150, y: hAt(0, 108) + 5.8, z: 108 });
    }
    // 貨物の倉庫(屋根の一部が落ちている)
    {
      const y = pad(180, 128, 124, 26, 0, M.light);
      add(box(120, 8, 24), M.body, world, { x: 180, y: y + 4, z: 128 });
      for (let i = 0; i < 4; i++) if (i !== 2) add(box(29, 1, 25), M.roof, world, { x: 135 + i * 30, y: y + 8.5, z: 128 });
      for (let i = 0; i < 6; i++) add(box(6, 5, 0.4), M.dark, world, { x: 130 + i * 20, y: y + 2.6, z: 115.8, edges: false });
    }

    // ── 幹線道路(南北 x = 40)と操車場を越える跨線橋。盛土で上がる ──
    const roadY = (z) => { const r0 = -200, a = -40, b = 150, r1 = 310; const g = (t) => t * t * (3 - 2 * t); return 2.2 + (z < r0 || z > r1 ? 0 : z < a ? D.deck * g((z - r0) / (a - r0)) : z <= b ? D.deck : D.deck * g((r1 - z) / (r1 - b))); };
    const HX = D.HW;
    // 盛土(台形の断面を z に沿ってつなぐ)
    for (const [za, zb] of [[-200, -40], [150, 310]]) {
      const rings = []; for (let i = 0; i <= 12; i++) { const z = za + ((zb - za) * i) / 12, y = roadY(z); rings.push([V(HX - 14 - (y - 2), 1.5, z), V(HX + 14 + (y - 2), 1.5, z), V(HX + 14, y, z), V(HX - 14, y, z)]); }
      add(closedLoft(rings), M.land, world);
    }
    add(ribbon(THREE, [[HX, D.z0 + 2], [HX, D.z1 - 2]], 26, (x, z) => roadY(z), 0.35, 6), M.mid, world, { edges: false });
    add(ribbon(THREE, [[HX, D.z0 + 2], [HX, D.z1 - 2]], 2.5, (x, z) => roadY(z), 0.5, 6), M.light, world, { edges: false });   // 中央分離帯
    // 跨線橋: 床版、橋脚(柱 3 本と梁)、高欄
    add(box(28, 1.8, 190), M.light, world, { x: HX, y: D.deck + 2.2 - 0.9 + 0.3, z: 55 });
    for (const z of [7, 61, 108]) { for (const s of [-1, 0, 1]) add(cyl(1.1, D.deck - 1.6, 10), M.light, world, { x: HX + s * 9, y: 2 + (D.deck - 1.6) / 2, z }); add(box(26, 1.6, 2.6), M.light, world, { x: HX, y: D.deck + 2.2 - 2.4, z }); }
    for (const s of [-1, 1]) add(box(0.6, 1.2, 190), M.mid, world, { x: HX + s * 13.6, y: D.deck + 2.2 + 1.1, z: 55 });

    // ── 北東の炭鉱: 立坑櫓 2 基(1.4 倍)、坑口の建屋、巻上げ機室、ロープ、コンベヤ、貯炭槽、引込線、事務棟 ──
    const ropes = [];
    const headframe = (x, z) => {
      const y = pad(x, z, 30, 30, 0, M.light), H = 60;
      add(box(26, 14, 26), M.body, world, { x, y: y + 7, z });
      add(box(26.6, 0.8, 26.6), M.light, world, { x, y: y + 14.4, z });
      lattice(world, V(x, y, z), H, 5, 3, 6, 0.55, M.mid);
      for (const s of [-1, 1]) tube(world, V(x + 3, y + H - 4, z + s * 3), V(x + 42, y, z + s * 9), 0.9, M.mid);   // 斜めの控え(巻上げ機室の側)
      for (let i = 1; i < 4; i++) { const t = i / 4; tube(world, V(x + 3 + 39 * t, y + (H - 4) * (1 - t), z - 3 - 6 * t), V(x + 3 + 39 * t, y + (H - 4) * (1 - t), z + 3 + 6 * t), 0.4, M.mid); }
      add(box(9, 4, 9), M.light, world, { x, y: y + H + 2, z });   // 頂部の台
      for (const s of [-1, 1]) {   // 滑車(輪・ハブ・スポーク)
        const g = new THREE.Group(); g.position.set(x + 1, y + H + 6.5, z + s * 2.6); world.add(g);
        add(new THREE.TorusGeometry(4.6, 0.45, 6, 24), M.dark, g, { edges: false });
        add(cyl(0.7, 1.2, 8), M.dark, g, { rx: Math.PI / 2, edges: false });
        for (let i = 0; i < 4; i++) add(box(0.3, 9, 0.3), M.dark, g, { rz: (i * Math.PI) / 4, edges: false });
        ropes.push([x + 5.6, y + H + 6.5, z + s * 2.6, x + 60, y + 14, z + s * 2.6]);
      }
      add(box(26, 16, 20), M.body, world, { x: x + 72, y: pad(x + 72, z, 28, 22, 0, M.light) + 8, z });   // 巻上げ機室
      add(box(26.8, 1, 20.8), M.light, world, { x: x + 72, y: y + 16.5, z });
      for (let i = 0; i < 4; i++) add(box(2.4, 6, 0.4), M.glass, world, { x: x + 62 + i * 6.6, y: y + 9, z: z + 10.1, edges: false });
      return y;
    };
    const hy = headframe(260, -340); headframe(250, -210);
    {
      const rl = new THREE.BufferGeometry(); rl.setAttribute("position", new THREE.Float32BufferAttribute(ropes.flat(), 3));
      const ls = new THREE.LineSegments(rl, new THREE.LineBasicMaterial({ color: F.P.dark })); world.add(ls);
    }
    // 傾斜コンベヤ(坑口の建屋 → 貯炭槽)と貯炭槽(脚つき)、引込線
    const bun = [150, -280], by = pad(bun[0], bun[1], 22, 22, 0, M.light);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(box(1.4, 14, 1.4), M.mid, world, { x: bun[0] + sx * 8, y: by + 7, z: bun[1] + sz * 8 });
    add(closedLoft([[V(bun[0] - 10, by + 14, bun[1] - 10), V(bun[0] + 10, by + 14, bun[1] - 10), V(bun[0] + 10, by + 14, bun[1] + 10), V(bun[0] - 10, by + 14, bun[1] + 10)], [V(bun[0] - 10, by + 30, bun[1] - 10), V(bun[0] + 10, by + 30, bun[1] - 10), V(bun[0] + 10, by + 30, bun[1] + 10), V(bun[0] - 10, by + 30, bun[1] + 10)]]), M.body, world);
    {
      const a = V(247, hy + 12, -330), b = V(bun[0] + 10, by + 28, bun[1] - 4);
      beam(world, a, b, 3.6, M.light);   // 傾斜コンベヤの覆い
      for (let i = 1; i < 4; i++) { const p = a.clone().lerp(b, i / 4); add(box(1.2, p.y - 2, 1.2), M.mid, world, { x: p.x, y: p.y / 2 + 1, z: p.z }); }
    }
    track([[bun[0], -310], [bun[0], -150], [130, -40], [100, 30], [70, 44]]);
    {   // 事務棟・浴場(損傷: 屋根の穴)
      const y = pad(400, -430, 74, 22, 0, M.light);
      add(box(70, 14, 20), M.body, world, { x: 400, y: y + 7, z: -430 });
      for (let f = 0; f < 3; f++) add(box(70.2, 1.3, 20.2), M.glass, world, { x: 400, y: y + 3 + f * 4, z: -430, edges: false });
      add(box(70.6, 0.6, 20.6), M.light, world, { x: 400, y: y + 14.3, z: -430 });
      add(box(14, 0.8, 9), M.dark, world, { x: 386, y: y + 14.4, z: -432, edges: false });
    }

    // ── 南東のボタ山: 捨石の円錐(高さ 75 m、底の半径 155 m)。尾根筋のでこぼこを半径に乗せる ──
    {
      const [tx, tz] = [400, 310], rings = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, y = 2 + 75 * t, r = 155 * (1 - t) ** 1.15 + 14 * t;
        rings.push(Array.from({ length: 28 }, (_, j) => { const a = (j / 28) * Math.PI * 2, w = 1 + 0.07 * Math.sin(a * 5 + i) * (1 - t * 0.6); return V(tx + Math.cos(a) * r * w, y, tz + Math.sin(a) * r * w); }));
      }
      add(closedLoft(rings), M.spoil, world);
    }

    // ── 西の集合住宅(5 階 15 m と 9 階 27 m の板状の棟)。損傷: 屋根の穴、上の階の崩れ、全壊して瓦礫の山 ──
    let blocks = 0, collapsed = 0;
    const block = (x, z, ry, floors) => {
      const g = new THREE.Group(); g.position.set(x, pad(x, z, 62, 14, ry, M.light), z); g.rotation.y = ry; world.add(g); blocks++;
      for (let i = 0; i < 4; i++) {
        const sx = -22.5 + i * 15, r = rnd(), full = floors * 3;
        if (r < 0.15) {   // 全壊: 瓦礫の山
          collapsed++;
          add(closedLoft([[V(sx - 8, 0, -8), V(sx + 8, 0, -8), V(sx + 8, 0, 8), V(sx - 8, 0, 8)], [V(sx - 3, 4 + rnd() * 3, -2), V(sx + 2, 3 + rnd() * 3, -3), V(sx + 3, 4, 3), V(sx - 2, 2.5, 2)]]), M.mid, g);
          continue;
        }
        const h = r < 0.45 ? full - 3 * (1 + Math.floor(rnd() * Math.min(4, floors - 2))) : full;   // 上の階の崩れ
        add(box(15, h, 12), M.body, g, { x: sx, y: h / 2 });
        if (h < full) add(closedLoft([[V(sx - 7.5, h, -6), V(sx + 7.5, h, -6), V(sx + 7.5, h, 6), V(sx - 7.5, h, 6)], [V(sx - 7.5, h + 1, -6), V(sx + 7.5, h + 3.5, -6), V(sx + 7.5, h + 0.5, 6), V(sx - 7.5, h + 2.5, 6)]]), M.mid, g);   // 崩れた上端
        else { add(box(15.2, 0.5, 12.2), M.light, g, { x: sx, y: h + 0.25 }); if (rnd() < 0.6) add(box(4 + rnd() * 4, 0.6, 3 + rnd() * 3), M.dark, g, { x: sx + (rnd() - 0.5) * 6, y: h + 0.3, edges: false }); }   // 屋根と穴
        for (let f = 0; f < Math.floor(h / 3) - (h < full ? 0 : 0); f++) for (const s of [-1, 1]) add(box(13, 1.1, 0.3), M.glass, g, { x: sx, y: 1.8 + f * 3, z: s * 6.05, edges: false });
      }
    };
    for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) block(-500 + c * 120 + (r % 2) * 20, -420 + r * 95, r % 2 ? 0.08 : -0.04, c === 1 && r === 2 ? 9 : 5);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) block(-490 + c * 120, 220 + r * 95, (c + r) % 2 ? Math.PI / 2 - 0.05 : 0.05, c === 0 && r === 1 ? 9 : 5);
    // 畑・空き地の砲弾の穴
    for (let i = 0, n = 0; i < 34 && n < 400; n++) {
      const x = D.x0 + 30 + rnd() * (D.x1 - D.x0 - 60), z = D.z0 + 30 + rnd() * (D.z1 - D.z0 - 60);
      if (Math.abs(x - HX) < 40 || (z > 0 && z < 150) || Math.hypot(x - 400, z - 310) < 170 || (x < -150 && Math.abs(z) > 50) || (x > 120 && z < -150)) continue;
      const r = 3 + rnd() * 5; add(cyl(r, 0.3, 10), M.mid, world, { x, y: hAt(x, z) + 0.1, z, edges: false }); add(cyl(r * 0.6, 0.32, 10), M.dark, world, { x, y: hAt(x, z) + 0.12, z, edges: false }); i++;
    }

    // ── 近未来化: 対ドローンネットのトンネル(幹線道路と本線) ──
    const netPos = [], netUv = [], arches = [];
    const tunnel = (path, W, Hn, yFn, step) => {   // path = 中心線の点の列、W = 幅、Hn = 高さ、yFn = 足元の高さ
      const P = []; for (let i = 0; i < path.length - 1; i++) { const [ax, az] = path[i], [bx, bz] = path[i + 1], n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step)); for (let s = 0; s < n; s++) P.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]); }
      P.push(path[path.length - 1]);
      const NA = 10, frames = P.map(([x, z], i) => {
        const [px, pz] = P[Math.max(0, i - 1)], [qx, qz] = P[Math.min(P.length - 1, i + 1)], dl = Math.hypot(qx - px, qz - pz) || 1, nx = -(qz - pz) / dl, nz = (qx - px) / dl, y0 = yFn(x, z);
        return Array.from({ length: NA + 1 }, (_, j) => { const a = Math.PI * (j / NA), u = Math.cos(a) * W / 2; return V(x + nx * u, y0 + Math.sin(a) * Hn, z + nz * u); });
      });
      frames.forEach((f) => { for (let j = 0; j < NA; j++) tube(world, f[j], f[j + 1], 0.35, M.mid); arches.push(f); });
      let dist = 0;
      for (let i = 0; i < frames.length - 1; i++) {
        const d = frames[i][0].distanceTo(frames[i + 1][0]);
        for (let j = 0; j < NA; j++) {
          const q = [frames[i][j], frames[i][j + 1], frames[i + 1][j + 1], frames[i + 1][j]], uv = [[j, dist], [j + 1, dist], [j + 1, dist + d], [j, dist + d]].map(([a, b]) => [(a * (Math.PI * W) / 2 / NA) / 5, b / 5]);
          for (const t of [0, 1, 2, 0, 2, 3]) { netPos.push(q[t].x, q[t].y, q[t].z); netUv.push(...uv[t]); }
        }
        dist += d;
      }
    };
    tunnel([[HX, D.z0 + 4], [HX, D.z1 - 4]], 28, 11, (x, z) => roadY(z) + 0.2, 40);
    for (const [xa, xb] of [[D.x0 + 4, -480], [480, D.x1 - 4]]) tunnel([[xa, 50], [xb, 50]], 24, 9, (x, z) => hAt(x, z) + 0.3, 40);
    {
      const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d");
      g.strokeStyle = "rgba(59,71,82,0.9)"; g.lineWidth = 2; g.strokeRect(1, 1, 30, 30);
      const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
      const ng = new THREE.BufferGeometry(); ng.setAttribute("position", new THREE.Float32BufferAttribute(netPos, 3)); ng.setAttribute("uv", new THREE.Float32BufferAttribute(netUv, 2)); ng.computeVertexNormals();
      world.add(new THREE.Mesh(ng, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })));
    }
    // ── 近未来化: 自動運転トラック・無人地上車両の中継ステーション(幹線道路の東) ──
    {
      const [sx, sz] = [112, -385], y = pad(sx, sz, 82, 56, 0, M.light);
      add(ribbon(THREE, [[HX + 13, sz], [sx - 40, sz]], 10, (x, z) => y - 0.2, 0.3), M.mid, world, { edges: false });
      for (const px of [-18, 0, 18]) for (const pz of [-7, 7]) add(box(0.8, 7, 0.8), M.mid, world, { x: sx - 8 + px, y: y + 3.5, z: sz - 12 + pz });
      add(box(42, 0.8, 18), M.light, world, { x: sx - 8, y: y + 7.4, z: sz - 12 });
      add(box(42.4, 0.4, 18.4), M.accent, world, { x: sx - 8, y: y + 7.0, z: sz - 12, edges: false });
      for (let i = 0; i < 6; i++) add(box(6.2, 0.25, 16), M.glass, world, { x: sx - 26 + i * 7, y: y + 7.95, z: sz - 12, rz: 0.12, edges: false });   // 太陽電池の板
      for (const [cx2, cz2, acc] of [[sx - 12, sz + 14, true], [sx + 6, sz + 14, false]]) {
        add(box(12.2, 2.6, 2.44), M.body, world, { x: cx2, y: y + 1.3, z: cz2 });
        if (acc) add(box(12.25, 0.4, 2.5), M.accent, world, { x: cx2, y: y + 2.1, z: cz2, edges: false });
        add(box(0.7, 1.6, 1.8), M.mid, world, { x: cx2 + 6.45, y: y + 1.0, z: cz2 });
      }
      lattice(world, V(sx + 28, y, sz + 10), 30, 2, 0.8, 4, 0.25, M.mid);
      add(box(2.4, 1.8, 2.4), M.dark, world, { x: sx + 28, y: y + 31, z: sz + 10 });
      add(box(1.6, 0.6, 0.2), M.glass, world, { x: sx + 28, y: y + 31.1, z: sz + 11.3, edges: false });
      for (const s of [-1, 1]) add(box(0.4, 3.2, 1.2), M.light, world, { x: sx + 28 + s * 1.4, y: y + 27, z: sz + 10 });
      add(box(8, 3.2, 5), M.body, world, { x: sx + 22, y: y + 1.6, z: sz - 14 });
    }

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 108, M.ring, M.disc);
    U.bake(THREE, group, { live: [M.accent] });
    const deckBottom = D.deck + 2.2 - 0.9 + 0.3 - 0.9;
    return {
      group, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc },
      update(dt) { ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      check: () => ({
        deckOverRail_m: +(deckBottom - (hAt(HX, 50) + 0.6)).toFixed(1),        // 跨線橋の床版の下と線路の上面
        netArchOverDeck_m: 11, padMax_m: +pads.max.toFixed(1), blocks, collapsedSections: collapsed, arches: arches.length,
        spoilToRail_m: Math.round(Math.hypot(0, 310 - 56) - 155),                 // ボタ山の裾と本線の間
      }),
      at: (x, y, z) => V(x * K, (y - D.base) * K, z * K),
      shots: {
        mine: { label: "立坑櫓と炭鉱", target: [270, 40, -290], pos: [80, 120, -120] },
        bridge: { label: "跨線橋とネットのトンネル", target: [40, 10, 60], pos: [200, 60, 220] },
        housing: { label: "損傷した集合住宅", target: [-380, 10, -250], pos: [-200, 90, -60] },
        relay: { label: "中継ステーション", target: [112, 8, -385], pos: [210, 55, -300] },
      },
    };
  }

  // ── このファイルの部品(地形の塊・帯・基礎) ──
  // 地形の塊: 高さ h(x, z) の上面(面ごとの陰影)、四方の切り口、等高線。snowAt(三角形の平均の高さ) が真の面は snowMat のメッシュへ
  function terrain(THREE, k, M, parent, { x0, x1, z0, z1, nx, nz, h, base, top, snowAt = null, snowMat = null, contour = 0, contourMat = null }) {
    const pos = [], posS = [], seg = [];
    const P = (i, j) => { const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz; return [x, h(x, z), z]; };
    const tri = (a, b, c) => {
      const arr = snowAt && snowAt((a[1] + b[1] + c[1]) / 3) ? posS : pos;
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (ny < 0) arr.push(...a, ...c, ...b); else arr.push(...a, ...b, ...c);
      if (!contour) return;
      const lo = Math.min(a[1], b[1], c[1]), hi = Math.max(a[1], b[1], c[1]);
      for (let L = Math.ceil(lo / contour) * contour + 0.001; L < hi; L += contour) {
        const pts = [];
        for (const [p, q] of [[a, b], [b, c], [c, a]]) if ((p[1] - L) * (q[1] - L) < 0) { const t = (L - p[1]) / (q[1] - p[1]); pts.push(p[0] + (q[0] - p[0]) * t, L + 0.4, p[2] + (q[2] - p[2]) * t); }
        if (pts.length === 6) seg.push(...pts);
      }
    };
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);
      if ((i + j) % 2) { tri(p00, p10, p11); tri(p00, p11, p01); } else { tri(p00, p10, p01); tri(p10, p11, p01); }
    }
    const geo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
    k.add(geo(pos), top, parent, { edges: false });
    if (posS.length) k.add(geo(posS), snowMat, parent, { edges: false });
    // 切り口(四方の側面)。外向きにそろえる
    const sk = [], cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const edgePts = [[...Array(nx + 1)].map((_, i) => P(i, 0)), [...Array(nz + 1)].map((_, j) => P(nx, j)), [...Array(nx + 1)].map((_, i) => P(nx - i, nz)), [...Array(nz + 1)].map((_, j) => P(0, nz - j))];
    const outTri = (p, q, r) => {   // 水平方向で台座の中心から外向きにそろえる
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      const nx_ = uy * vz - uz * vy, nz_ = ux * vy - uy * vx, mx = (p[0] + q[0] + r[0]) / 3 - cx, mz = (p[2] + q[2] + r[2]) / 3 - cz;
      sk.push(...p, ...(nx_ * mx + nz_ * mz < 0 ? [...r, ...q] : [...q, ...r]));
    };
    for (const pts of edgePts) for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], a0 = [a[0], base, a[2]], b0 = [b[0], base, b[2]];
      outTri(a0, b0, b); outTri(a0, b, a);
    }
    k.add(geo(sk), M.mid, parent);
    if (contour && seg.length) {
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
      const ls = new THREE.LineSegments(lg, contourMat); ls.userData.edges = true; parent.add(ls);
    }
    return { tris: (pos.length + posS.length) / 9, segs: seg.length / 6 };
  }
  // 地形に沿う帯(道路)。pts = [[x, z], ...]、幅 w、地形の高さ + lift
  function ribbon(THREE, pts, w, h, lift = 0.5, step = 8) {
    const P = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
      for (let s = 0; s < n; s++) P.push([ax + ((bx - ax) * s) / n, az + ((bz - az) * s) / n]);
    }
    P.push(pts[pts.length - 1]);
    const L = [], R = [];
    for (let i = 0; i < P.length; i++) {
      const [px, pz] = P[Math.max(0, i - 1)], [qx, qz] = P[Math.min(P.length - 1, i + 1)], dl = Math.hypot(qx - px, qz - pz) || 1;
      const nx = -(qz - pz) / dl, nz = (qx - px) / dl, [x, z] = P[i];
      L.push([x + (nx * w) / 2, 0, z + (nz * w) / 2]); R.push([x - (nx * w) / 2, 0, z - (nz * w) / 2]);
      L[i][1] = h(L[i][0], L[i][2]) + lift; R[i][1] = h(R[i][0], R[i][2]) + lift;
    }
    const pos = [];
    const up = (a, b, c) => { const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]); if (ny < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c); };
    for (let i = 0; i < P.length - 1; i++) { up(L[i], R[i], R[i + 1]); up(L[i], R[i + 1], L[i + 1]); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  // 斜面に置く物の基礎: 四隅と中心の地形の高さを測り、最も高い所を上面にした基礎の塊を置く(浮かない)。返り値 = 上面の高さ
  function padder(k, M, parent, h) {
    const pads = { max: 0 };
    const pad = (x, z, w, d, ry = 0, mat = M.light) => {
      const c = Math.cos(ry), s = Math.sin(ry), ys = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].map(([a, b]) => h(x + (a * w * c) / 2 + (b * d * s) / 2, z - (a * w * s) / 2 + (b * d * c) / 2));
      const top = Math.max(...ys) + 0.3, bot = Math.min(...ys) - 1.5;
      k.add(k.box(w, top - bot, d), mat, parent, { x, y: (top + bot) / 2, z, ry });
      pads.max = Math.max(pads.max, top - Math.min(...ys)); (pads.list ??= []).push([Math.round(x), Math.round(z), +(top - Math.min(...ys)).toFixed(1)]);
      return top;
    };
    return { pad, pads };
  }

  DreamAssets.fac.register("pokrovsk", {
    section: 1, title: "ポクロウシク", kind: "STRATEGIC FACILITY · 1 交通・兵站",
    desc: "鉄道の操車場と幹線道路が交わる炭鉱の町。立坑櫓とボタ山、損傷した集合住宅。道路と本線を対ドローンネットのトンネルで覆い、無人車両の中継ステーションを足した近未来版",
    info: [["ファイル", "mockups/3d/facilities/pokrovsk.js"], ["大きさ", "1,200 × 1,000 m を 0.14 倍 × 表示 3.0"], ["誇張", "立坑櫓 1.4 倍(約 43 → 60 m)。ほかは実寸"], ["省略", "車両(無人トラック・貨車)、平屋の個人住宅、人、架線"], ["近未来化", "道路と本線の対ドローンネットのトンネル、無人車両の中継ステーション"]],
    dist: 1050, target: 20, tokenAt: [420, 0, 340],
    make: (THREE) => pokrovsk(THREE, { r: 108 }),
  });
})();
