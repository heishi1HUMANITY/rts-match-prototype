// 部隊のベースプレート(試作)。クレヨンで地面に描いたような表現にする(SF の模型と手描きのアンバランスさを見せる)。
// チーム色の輪(手描きでゆがみ、閉じきらない)と斜線の塗り、チームのシンボル、練度の山形。部隊の種類は描かない。
// 状態: 通常 / 選択(墨色のぐるぐるの輪)/ 交戦(赤いギザギザの輪と、はじける線)/ 損傷(×の引っかき傷、輪の一部がこすれて消える、耐久の弧、クレヨンの煙)。
// 線は3枚の描き分けを順に切り替えて、手描きアニメのように線を震わせる(ラインボイル)。前方 = +z。
//
// 作り(メモ 9.17 対応 2): 絵を「変わり方」ごとの層に分け、起動時に 1 回だけ白で描いて全部隊で共有する(描き直しはしない)。
//   層 = 透明度だけの RG テクスチャ(alphaMap)。板の材質の色でチーム色・墨・赤・金に染める。震えは層ごとに 3 枚。
//   部隊ごとに持つのは板(輪 + 斜線 / 状態の輪 / シンボル / 練度)と、耐久の弧(帯の形にクレヨンの線のタイルを貼る)だけ。
//
//   const p = DreamAssets.plate(THREE, { r: 38, unit });   // r = 輪の半径(ゲームの単位)。unit を渡すとその上に載せる
//   scene.add(p.group); p.setTeam("#ff6a1a"); p.setState("idle" | "selected" | "engaged" | "damaged"); p.setRank(0..3); p.setHp(0..1); p.update(dt)
(function () {
  // チーム色 → シンボル(ゲームの symbolPoints と同じ形: 菱形 / 四角 / 六角形 / 三角形)
  const SYMBOL = { "#ff6a1a": "diamond", "#10bfe8": "square", "#f0b323": "hex", "#9b5cff": "triangle" };
  const INK = 0x1f2a33, RED = 0xe0245e, SPARK = 0xff9f1a, GOLD = 0xc9a227, HP_OK = 0xe8a317, SMOKE = "#59636e";
  const SIZE = 512, FRAMES = 3, EXT = 2.9;                                   // 板の画素、震えの枚数、描く範囲 = 輪の半径の 2.9 倍
  const R = SIZE / EXT, C = SIZE / 2, SS = R * 0.13, SY = C - R * 0.98;      // 輪の半径(px)、中心、シンボルの大きさと位置(後ろ = 画面上)
  const SUB = 128, RANK_Y = SY - SS * 2.6;                                   // 小さな層(シンボル・練度)の画素と、練度の中心
  const TILE = 256;                                                          // 耐久の弧に貼る線のタイルの長さ(px)

  // ── クレヨンの線: 点列に沿って、粒状の点を少しずつずらして重ねる(白で描く。色は材質で付ける) ──
  function crayon(g, pts, w, rnd, alpha = 1) {
    g.fillStyle = "#fff";
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.hypot(x1 - x0, y1 - y0) / 1.4);
      for (let s = 0; s < n; s++) {
        const t = s / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, ww = w * (0.75 + 0.5 * rnd());
        for (let d = 0; d < 5; d++) {
          const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * ww / 2;
          g.globalAlpha = alpha * (0.3 + 0.7 * rnd()); g.fillRect(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 1.7, 1.7);
        }
      }
    }
    g.globalAlpha = 1;
  }
  // 手描きの円(半径がゆっくりゆがみ、終わりは少し行き過ぎる)。角度は前(+z)= 画面下を 0 として時計回り
  const loop = (cx, cy, rad, rnd, { from = rnd() * 6.28, span = Math.PI * 2 + 0.25 + rnd() * 0.3, wob = 0.035, zig = 0, steps = 90, drift = 0.02 } = {}) => {
    const p1 = rnd() * 6, p2 = rnd() * 6, pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = from + span * (i / steps), z = zig ? (i % 2 ? 1 : -1) * zig : 0;
      const rr = rad * (1 + wob * (Math.sin(a * 2 + p1) * 0.6 + Math.sin(a * 3 + p2) * 0.4) + z) + (i / steps) * rad * drift;
      pts.push([cx + Math.sin(a) * rr, cy + Math.cos(a) * rr]);
    }
    return pts;
  };
  const jitter = (pts, j, rnd) => pts.map(([x, y]) => [x + (rnd() - 0.5) * j, y + (rnd() - 0.5) * j]);
  const shape = (kind, s, cx, cy) => {
    const P = kind === "diamond" ? [[0, -1], [1, 0], [0, 1], [-1, 0]] : kind === "square" ? [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]
      : kind === "triangle" ? [[0, -1], [0.95, 0.7], [-0.95, 0.7]] : kind === "hex" ? [0, 1, 2, 3, 4, 5].map((i) => [Math.cos(i * Math.PI / 3), Math.sin(i * Math.PI / 3)])
      : [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [Math.cos(i * Math.PI / 4 + Math.PI / 8), Math.sin(i * Math.PI / 4 + Math.PI / 8)]);
    return P.map(([x, y]) => [cx + x * s, cy + y * s]);
  };
  // 紙目で抜く(クレヨンのかすれ)。数は面積に比例
  const grain = (g, rnd, w, h) => {
    g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000";
    const n = Math.round(2600 * (w * h) / (SIZE * SIZE));
    for (let i = 0; i < n; i++) { g.globalAlpha = 0.25 + rnd() * 0.6; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  };
  // Canvas の透明度だけを RG のテクスチャにする(alphaMap は G を読む。RGBA の半分の大きさ)
  function alphaTexture(THREE, canvas, repeat = false) {
    const { width: w, height: h } = canvas, src = canvas.getContext("2d").getImageData(0, 0, w, h).data, d = new Uint8Array(w * h * 2);
    for (let i = 0; i < w * h; i++) { d[i * 2] = 255; d[i * 2 + 1] = src[i * 4 + 3]; }
    const t = new THREE.DataTexture(d, w, h, THREE.RGFormat, THREE.UnsignedByteType);
    t.flipY = true; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
    if (repeat) t.wrapS = THREE.RepeatWrapping;
    t.needsUpdate = true; return t;
  }
  // 1 つの層を震えの枚数ぶん描く。draw(g, rnd) は白で描く
  function layer(THREE, U, w, h, seed, draw, repeat = false) {
    const out = [];
    for (let f = 0; f < FRAMES; f++) {
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"), rnd = U.rng(seed + f * 101);
      draw(g, rnd); grain(g, rnd, w, h); out.push(alphaTexture(THREE, c, repeat));
    }
    return out;
  }

  // ── 共有の層(起動時に 1 回だけ描く) ──
  let LAYERS = null;
  function layers(THREE, U) {
    if (LAYERS) return LAYERS;
    const L = {};
    // 輪 + 斜線(+ シンボルの周りの抜き)。損傷版は輪の一部をこすって消す
    L.base = [false, true].map((dmg) => layer(THREE, U, SIZE, SIZE, dmg ? 7 : 1, (g, rnd) => {
      g.save(); g.beginPath(); g.arc(C, C, R * 0.9, 0, Math.PI * 2); g.clip();
      for (let d = -2 * R; d <= 2 * R; d += 11) crayon(g, jitter([[C + d - R, C - R], [C + d + R, C + R]], 3, rnd), 3, rnd, 0.32);
      g.restore();
      crayon(g, loop(C, C, R * 0.97, rnd), 9, rnd, 0.95);
      crayon(g, loop(C, C, R * 0.92, rnd, { wob: 0.05 }), 3.5, rnd, 0.7);
      g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(C, SY, SS * 1.5, 0, Math.PI * 2); g.fill();
      if (dmg) crayon(g, loop(C, C, R * 0.95, rnd, { from: 1.9, span: 1.1, wob: 0.02, steps: 30 }), 26, rnd, 0.9);
      g.globalCompositeOperation = "source-over";
    }));
    // 選択: 2周半のぐるぐると 4 本の短い線(墨)
    L.selected = layer(THREE, U, SIZE, SIZE, 11, (g, rnd) => {
      crayon(g, loop(C, C, R * 1.1, rnd, { span: Math.PI * 4.3, wob: 0.05, steps: 180, drift: 0.16 }), 4, rnd, 0.85);
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4 + rnd() * 0.2; crayon(g, jitter([[C + Math.sin(a) * R * 1.32, C + Math.cos(a) * R * 1.32], [C + Math.sin(a) * R * 1.42, C + Math.cos(a) * R * 1.42]], 2, rnd), 4, rnd); }
    });
    // 交戦: ギザギザの輪(赤)と、はじける線(橙)。色が違うので層を分ける
    L.engaged = layer(THREE, U, SIZE, SIZE, 13, (g, rnd) => crayon(g, loop(C, C, R * 1.1, rnd, { zig: 0.04, steps: 64, wob: 0.03 }), 4.5, rnd, 0.95));
    L.sparks = layer(THREE, U, SIZE, SIZE, 17, (g, rnd) => {
      for (let i = 0; i < 5; i++) {
        const a = rnd() * Math.PI * 2, d = R * (1.2 + rnd() * 0.06);
        for (const da of [-0.12, 0, 0.12]) crayon(g, [[C + Math.sin(a + da) * d, C + Math.cos(a + da) * d], [C + Math.sin(a + da * 1.6) * d * 1.1, C + Math.cos(a + da * 1.6) * d * 1.1]], 3.5, rnd);
      }
    });
    // 損傷: ×の引っかき傷(墨)
    L.scratch = layer(THREE, U, SIZE, SIZE, 19, (g, rnd) => {
      for (let i = 0; i < 2; i++) {
        const cx = C + (rnd() - 0.5) * R * 1.1, cy = C + (rnd() - 0.2) * R * 0.9, s = R * 0.16;
        crayon(g, jitter([[cx - s, cy - s], [cx + s, cy + s]], 3, rnd), 4, rnd, 0.8);
        crayon(g, jitter([[cx + s, cy - s], [cx - s, cy + s]], 3, rnd), 4, rnd, 0.8);
      }
    });
    // シンボル(128px、中心 = シンボルの位置): 輪郭(墨)と中のぐるぐる(チーム色)
    L.symbol = {};
    for (const [i, kind] of ["diamond", "square", "hex", "triangle", "oct"].entries()) {
      const h = SUB / 2;
      L.symbol[kind] = {
        outline: layer(THREE, U, SUB, SUB, 23 + i * 7, (g, rnd) => { const sp = shape(kind, SS, h, h); crayon(g, jitter([...sp, sp[0], sp[1]], 2.5, rnd), 4.5, rnd, 0.95); }),
        fill: layer(THREE, U, SUB, SUB, 29 + i * 7, (g, rnd) => { const pts = []; for (let k = 0; k < 9; k++) pts.push([h - SS * 0.6 + (k % 2) * SS * 1.2, h - SS * 0.6 + k * SS * 0.15]); crayon(g, jitter(pts, 3, rnd), 3.5, rnd, 0.9); }),
      };
    }
    // 練度の山形(128px、中心 = RANK_Y): 1〜3 本
    L.rank = [1, 2, 3].map((n) => layer(THREE, U, SUB, SUB, 31 + n, (g, rnd) => {
      for (let i = 0; i < n; i++) { const y = SUB / 2 + (SY - SS * 1.9 - i * SS * 0.7 - RANK_Y); crayon(g, jitter([[SUB / 2 - SS * 0.9, y - SS * 0.35], [SUB / 2, y + SS * 0.25], [SUB / 2 + SS * 0.9, y - SS * 0.35]], 2, rnd), 4, rnd); }
    }));
    // 耐久の弧に貼る線(横に 1 本。u 方向に繰り返す)
    L.stroke = layer(THREE, U, TILE, 16, 41, (g, rnd) => crayon(g, jitter([[-4, 8], [TILE / 2, 8], [TILE + 4, 8]], 1.5, rnd), 5, rnd, 0.95), true);
    // 損傷の煙: クレヨンでぐるぐる描いた雲(色つきのまま)
    L.smoke = [0, 1, 2].map((i) => {
      const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), rnd = U.rng(40 + i);
      const pts = []; for (let j = 0; j <= 80; j++) { const a = j * 0.5, rr = 22 + 16 * Math.sin(j * 0.37 + i) + rnd() * 6; pts.push([64 + Math.cos(a) * rr * (j / 80 * 0.6 + 0.4), 64 + Math.sin(a) * rr * (j / 80 * 0.6 + 0.4)]); }
      crayon(g, pts, 5, rnd, 0.85);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { tex: t, color: SMOKE };
    });
    return (LAYERS = L);
  }

  function plate(THREE, opts = {}) {
    const U = DreamAssets.util, L = layers(THREE, U);
    const r = opts.r ?? 38, E = r * EXT, k = SIZE / E;                      // 描く範囲(ゲームの単位)、1 単位あたりの画素
    const group = new THREE.Group(); group.name = "plate";
    const boards = new THREE.Group(); group.add(boards);                    // 板と弧(ビューアの表示切替で使う)
    // 板: 層の画素の範囲(中心 cx, cy、幅 w、高さ h。画素)を地面の板にする。alphaMap を色で染める
    const board = (frames, color, cx, cy, w, h, order) => {
      const mat = new THREE.MeshBasicMaterial({ color, alphaMap: frames[0], transparent: true, depthWrite: false });
      const geo = new THREE.PlaneGeometry(w / k, h / k); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat); m.position.set((cx - C) / k, 0.3 + order * 0.01, (cy - C) / k); m.renderOrder = 1 + order; m.userData.frames = frames;
      boards.add(m); return m;
    };
    const base = board(L.base[0], 0xffffff, C, C, SIZE, SIZE, 0);
    const selected = board(L.selected, INK, C, C, SIZE, SIZE, 1);
    const engaged = board(L.engaged, RED, C, C, SIZE, SIZE, 1);
    const sparks = board(L.sparks, SPARK, C, C, SIZE, SIZE, 2);
    const scratch = board(L.scratch, INK, C, C, SIZE, SIZE, 2);
    const symOutline = board(L.symbol.oct.outline, INK, C, SY, SUB, SUB, 3);
    const symFill = board(L.symbol.oct.fill, 0xffffff, C, SY, SUB, SUB, 3);
    const rankBoard = board(L.rank[0], GOLD, C, RANK_Y, SUB, SUB, 3);
    // 耐久の弧: 減ったときだけ、後ろを中心に両側へ伸びる帯(黄 → 赤)。u 方向にクレヨンの線のタイルを貼る
    const arcMat = new THREE.MeshBasicMaterial({ color: HP_OK, alphaMap: L.stroke[0], transparent: true, depthWrite: false });
    const arc = new THREE.Mesh(new THREE.BufferGeometry(), arcMat); arc.position.y = 0.32; arc.renderOrder = 3; arc.visible = false; arc.userData.frames = L.stroke; boards.add(arc);
    function buildArc(hp) {
      const rnd = U.rng(5), N = 60, from = Math.PI - Math.PI * hp, span = Math.PI * 2 * hp, p1 = rnd() * 6, p2 = rnd() * 6, w = 16 / k;   // 帯の幅 = タイルの高さ(線はその中の 5px)
      const pos = new Float32Array((N + 1) * 6), uv = new Float32Array((N + 1) * 4), idx = []; let len = 0, px = 0, pz = 0;
      for (let i = 0; i <= N; i++) {
        const a = from + span * (i / N), rr = R * 0.78 * (1 + 0.02 * (Math.sin(a * 2 + p1) * 0.6 + Math.sin(a * 3 + p2) * 0.4)) / k;
        const x = Math.sin(a) * rr, z = Math.cos(a) * rr, nx = Math.sin(a), nz = Math.cos(a);
        if (i) len += Math.hypot(x - px, z - pz) * k; px = x; pz = z;
        pos.set([x - nx * w / 2, 0, z - nz * w / 2, x + nx * w / 2, 0, z + nz * w / 2], i * 6); uv.set([len / TILE, 0, len / TILE, 1], i * 4);
        if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
      }
      arc.geometry.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); arc.geometry = g;
    }
    // 損傷の煙
    const smoke = new THREE.Group(); group.add(smoke);
    const puffs = Array.from({ length: 7 }, (_, i) => {
      const { tex, color } = L.smoke[i % 3];
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false })); smoke.add(s);
      return { s, life: i / 7, ox: 0, oz: 0 };
    });
    // 載せる部隊
    const unit = opts.unit ?? null;
    if (unit) { unit.group.scale.setScalar(opts.unitScale ?? 2); group.add(unit.group); if (unit.parts?.plate) unit.parts.plate.visible = false; }

    // ── 状態と更新(描き直しはしない。板の表示と色を切り替えるだけ) ──
    let state = "idle", rank = 0, team = "#ff6a1a", hp = 1, clock = 0, frame = 0, boilT = 0;
    const apply = () => {
      const dmg = state === "damaged";
      base.userData.frames = L.base[dmg ? 1 : 0];
      selected.visible = state === "selected"; engaged.visible = sparks.visible = state === "engaged"; scratch.visible = smoke.visible = dmg;
      const kind = SYMBOL[String(team).toLowerCase()] ?? "oct";
      symOutline.userData.frames = L.symbol[kind].outline; symFill.userData.frames = L.symbol[kind].fill;
      rankBoard.visible = rank > 0; if (rank > 0) rankBoard.userData.frames = L.rank[Math.min(3, rank) - 1];
      arc.visible = hp < 1; if (arc.visible) { buildArc(hp); arcMat.color.set(hp > 0.3 ? HP_OK : RED); }
      base.material.color.set(team); symFill.material.color.set(team);
      setFrame();
    };
    const setFrame = () => { for (const m of boards.children) m.material.alphaMap = m.userData.frames[frame % m.userData.frames.length]; };
    function update(dt) {
      clock += dt;
      unit?.update?.(dt);
      // 線の震え: 通常は 1 秒に 4 回、交戦中は速く
      if ((boilT -= dt) <= 0) { boilT = state === "engaged" ? 0.08 : 0.25; frame = (frame + 1) % FRAMES; setFrame(); }
      if (smoke.visible) puffs.forEach((pf) => {
        pf.life += dt * 0.3; if (pf.life > 1) { pf.life -= 1; pf.ox = (Math.random() - 0.5) * 12; pf.oz = (Math.random() - 0.5) * 16; }
        const Lf = pf.life, s = (8 + Lf * 22) * (1 - Math.max(0, Lf - 0.7) * 3.3);
        pf.s.position.set(pf.ox + Lf * 10, 16 + Lf * 40, pf.oz - Lf * 5); pf.s.scale.setScalar(Math.max(0.01, s)); pf.s.material.rotation = Lf * 2 + pf.ox;
      });
    }
    function setTeam(c) { team = c ?? "#8f98a3"; apply(); unit?.setTeam?.(c); }
    // 状態に応じた耐久(見本): 損傷 0.24、交戦 0.68。setHp で直接も変えられる
    function setState(s) { state = s; hp = s === "damaged" ? 0.24 : s === "engaged" ? 0.68 : 1; apply(); }
    setTeam(opts.team ?? "#ff6a1a");
    return {
      group, update, setTeam, stats: () => U.stats(boards), parts: { plate: boards },
      setState, get state() { return state; },
      setRank(n) { rank = n; apply(); }, get rank() { return rank; },
      setHp(h) { hp = Math.max(0, Math.min(1, h)); apply(); }, get hp() { return hp; }, unit,
    };
  }

  (window.DreamAssets ??= {}).plate = plate;
})();
