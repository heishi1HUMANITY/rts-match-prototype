// 床タイルのセット(試作)。盤面の陸に貼る幾何学のタイルを Canvas で描いた 1 枚のテクスチャにする(盤面全体で描画呼び出し 1 回)。
// ゲームのセル(80 四方)にそろえ、白・明灰・スレートを基本に、案件のテーマで柄を変える:
//   港湾: 大判のコンクリート板(目地)、黄色の通路線、排水溝の格子、係留の金具、コンテナを置く区画(スレートの面と白い角の印)
//   都市: 四角の舗石(色むら)、スレートの道路の帯(白い破線、交差点の横断歩道)、マンホール、円形の広場
//   鉱区: 三角形の敷き板(白・明灰・スレート)、砂利の面(点描)、縞鋼板の区画と警告縞の縁、運搬路のわだち
//
//   const f = DreamAssets.floor(THREE, { theme: "port" | "city" | "mine" });
//   scene.add(f.group); f.setTheme("city")
(function () {
  const CELL = 80, COLS = 16, ROWS = 12, PX = 128;                       // 1 セル = 128 px
  const W = COLS * CELL, H = ROWS * CELL;
  const PAL = { white: "#f3f5f7", light: "#e6eaee", light2: "#dde2e7", mid: "#c9d0d7", joint: "#bcc4cc", slate: "#8f9aa5", slate2: "#7d8893", dark: "#3b4752", yellow: "#e8b93a", hazardY: "#ffc83d" };

  function floor(THREE, opts = {}) {
    const U = DreamAssets.util;
    const group = new THREE.Group(); group.name = "floor";
    const canvas = document.createElement("canvas"); canvas.width = COLS * PX; canvas.height = ROWS * PX;
    const g = canvas.getContext("2d");
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const plane = new THREE.PlaneGeometry(W, H); plane.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(plane, new THREE.MeshLambertMaterial({ map: tex })); mesh.position.y = 3; group.add(mesh);
    // 盤面の厚み(模型の台)
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, 2.8, H), new THREE.MeshLambertMaterial({ color: 0xc9d0d7 })); base.position.y = 1.4; group.add(base);   // 上面はタイルの板(y=3)より下
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 1.5, H + 8), new THREE.MeshLambertMaterial({ color: 0x3b4752 })); skirt.position.y = 0.2; group.add(skirt);
    // セルの境界線(ゲームの格子の確認用。切り替えられる)
    const gl = []; for (let i = 0; i <= COLS; i++) gl.push(-W / 2 + i * CELL, 3.05, -H / 2, -W / 2 + i * CELL, 3.05, H / 2); for (let j = 0; j <= ROWS; j++) gl.push(-W / 2, 3.05, -H / 2 + j * CELL, W / 2, 3.05, -H / 2 + j * CELL);
    const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(gl, 3));
    const grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x3b4752, transparent: true, opacity: 0.18 })); grid.visible = false; group.add(grid);

    const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const line = (x0, y0, x1, y1, c, w = 1) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
    const hazard = (x, y, w, h) => {
      g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); rect(x, y, w, h, PAL.dark);
      g.fillStyle = PAL.hazardY; for (let k = -h; k < w + h; k += 12) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + 6, y + h); g.lineTo(x + k + 6 + h, y); g.lineTo(x + k + h, y); g.fill(); }
      g.restore();
    };

    // ── 港湾 ──
    function port(rnd) {
      // 大判のコンクリート板: 1 セルを 2 × 4 枚(20 × 40 相当)。色むらと目地
      for (let j = 0; j < ROWS * 4; j++) for (let i = 0; i < COLS * 2; i++) {
        const x = i * PX / 2, y = j * PX / 4;
        rect(x, y, PX / 2, PX / 4, pick(rnd, [PAL.light, PAL.light, PAL.light2, PAL.white]));
        g.strokeStyle = PAL.joint; g.lineWidth = 1.5; g.strokeRect(x + 0.75, y + 0.75, PX / 2 - 1.5, PX / 4 - 1.5);
      }
      // コンテナを置く区画: スレートの面に白い角の印
      for (const [ci, cj, cw, ch] of [[2, 2, 3, 2], [10, 1, 4, 2], [3, 8, 4, 2], [11, 7, 3, 3]]) {
        rect(ci * PX + 6, cj * PX + 6, cw * PX - 12, ch * PX - 12, PAL.slate);
        for (let a = 0; a < cw * 2; a++) for (let b = 0; b < ch; b++) {
          const x = ci * PX + 10 + a * (PX / 2 - 2), y = cj * PX + 10 + b * (PX - 4), w = PX / 2 - 12, h = PX - 24;
          g.strokeStyle = PAL.white; g.lineWidth = 2;
          for (const [px, py, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { g.beginPath(); g.moveTo(px + dx * 10, py); g.lineTo(px, py); g.lineTo(px, py + dy * 10); g.stroke(); }
        }
      }
      // 黄色の通路線(横 2 本、縦 1 本)と、交わるところの止まれの線
      for (const j of [5.5, 10.5]) { rect(0, j * PX - 3, COLS * PX, 6, PAL.yellow); for (let i = 0; i < COLS * 2; i++) if (i % 2) rect(i * PX / 2 + 10, j * PX - 18, PX / 2 - 20, 3, PAL.yellow); }
      rect(8 * PX - 3, 0, 6, ROWS * PX, PAL.yellow);
      // 排水溝の格子(通路線に沿って)と係留の金具(点)
      for (let i = 1; i < COLS; i += 3) { const x = i * PX + 30, y = 5.5 * PX + 10; rect(x, y, 30, 10, PAL.dark); for (let k = 0; k < 6; k++) rect(x + 2 + k * 5, y + 2, 2, 6, PAL.mid); }
      for (let j = 0; j < ROWS; j += 2) for (let i = 0; i < COLS; i += 2) { g.fillStyle = PAL.slate2; g.beginPath(); g.arc(i * PX + PX / 2, j * PX + PX / 2, 3, 0, Math.PI * 2); g.fill(); }
    }

    // ── 都市 ──
    function city(rnd) {
      // 四角の舗石: 1 セルを 4 × 4 枚。色むら、目地
      for (let j = 0; j < ROWS * 4; j++) for (let i = 0; i < COLS * 4; i++) {
        const x = i * PX / 4, y = j * PX / 4;
        rect(x, y, PX / 4, PX / 4, pick(rnd, [PAL.white, PAL.light, PAL.light, PAL.light2]));
        g.strokeStyle = PAL.joint; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, PX / 4 - 1, PX / 4 - 1);
      }
      // 円形の広場(同心円の舗石)
      for (const [cx, cy, r] of [[4.5, 3.5, 1.3], [12, 8.5, 1.6]]) {
        for (let k = 6; k >= 1; k--) { g.fillStyle = k % 2 ? PAL.light2 : PAL.white; g.beginPath(); g.arc(cx * PX, cy * PX, (r * PX * k) / 6, 0, Math.PI * 2); g.fill(); }
        g.strokeStyle = PAL.mid; g.lineWidth = 2; g.beginPath(); g.arc(cx * PX, cy * PX, r * PX, 0, Math.PI * 2); g.stroke();
        for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; line(cx * PX + Math.cos(t) * r * PX * 0.18, cy * PX + Math.sin(t) * r * PX * 0.18, cx * PX + Math.cos(t) * r * PX, cy * PX + Math.sin(t) * r * PX, PAL.mid, 1); }
      }
      // スレートの道路の帯(4 セルごと)、白い破線、交差点の横断歩道、歩道の縁石
      const roadsX = [7.5], roadsY = [6];
      for (const j of roadsY) { rect(0, j * PX - 24, COLS * PX, 48, PAL.slate); rect(0, j * PX - 26, COLS * PX, 2, PAL.mid); rect(0, j * PX + 24, COLS * PX, 2, PAL.mid); for (let x = 0; x < COLS * PX; x += 40) rect(x, j * PX - 1.5, 20, 3, PAL.white); }
      for (const i of roadsX) { rect(i * PX - 24, 0, 48, ROWS * PX, PAL.slate); rect(i * PX - 26, 0, 2, ROWS * PX, PAL.mid); rect(i * PX + 24, 0, 2, ROWS * PX, PAL.mid); for (let y = 0; y < ROWS * PX; y += 40) rect(i * PX - 1.5, y, 3, 20, PAL.white); }
      for (const i of roadsX) for (const j of roadsY) {
        rect(i * PX - 24, j * PX - 24, 48, 48, PAL.slate);
        for (let k = 0; k < 6; k++) { rect(i * PX - 22 + k * 8, j * PX - 40, 5, 14, PAL.white); rect(i * PX - 22 + k * 8, j * PX + 26, 5, 14, PAL.white); rect(i * PX - 40, j * PX - 22 + k * 8, 14, 5, PAL.white); rect(i * PX + 26, j * PX - 22 + k * 8, 14, 5, PAL.white); }
      }
      // マンホール
      for (let k = 0; k < 14; k++) { const x = (rnd() * COLS) * PX, y = (rnd() * ROWS) * PX; g.fillStyle = PAL.slate2; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.strokeStyle = PAL.mid; g.lineWidth = 1; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.stroke(); }
    }

    // ── 鉱区 ──
    function mine(rnd) {
      // 三角形の敷き板: 1 セルに 2 列。白・明灰・スレート
      const T = PX / 2, Hh = (T * Math.sqrt(3)) / 2;
      for (let row = -1; row < (ROWS * PX) / Hh + 1; row++) for (let i = -1; i < COLS * 2 + 1; i++) for (const up of [0, 1]) {
        const x0 = i * T + (row % 2 ? T / 2 : 0), y0 = row * Hh;
        g.fillStyle = pick(rnd, [PAL.white, PAL.light, PAL.light, PAL.light2, PAL.mid, PAL.slate]);
        g.beginPath();
        if (up) { g.moveTo(x0, y0 + Hh); g.lineTo(x0 + T / 2, y0); g.lineTo(x0 + T, y0 + Hh); } else { g.moveTo(x0 + T / 2, y0); g.lineTo(x0 + T * 1.5, y0); g.lineTo(x0 + T, y0 + Hh); }
        g.closePath(); g.fill(); g.strokeStyle = PAL.joint; g.lineWidth = 1; g.stroke();
      }
      // 砂利の面(点描)
      for (const [cx, cy, r] of [[3, 3, 2.2], [12.5, 9, 2.6], [13, 2.5, 1.6]]) {
        g.fillStyle = PAL.light2; g.beginPath(); g.ellipse(cx * PX, cy * PX, r * PX, r * PX * 0.7, 0.3, 0, Math.PI * 2); g.fill();
        for (let k = 0; k < 900 * r; k++) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()); g.fillStyle = pick(rnd, [PAL.slate, PAL.mid, PAL.slate2, PAL.white]); g.fillRect(cx * PX + Math.cos(a) * d * r * PX, cy * PX + Math.sin(a) * d * r * PX * 0.7, 2, 2); }
      }
      // 縞鋼板の区画と警告縞の縁
      for (const [ci, cj, cw, ch] of [[6, 4, 4, 3], [1, 8, 3, 2]]) {
        const x = ci * PX, y = cj * PX, w = cw * PX, h = ch * PX;
        hazard(x - 8, y - 8, w + 16, 8); hazard(x - 8, y + h, w + 16, 8); hazard(x - 8, y, 8, h); hazard(x + w, y, 8, h);
        rect(x, y, w, h, PAL.mid);
        g.fillStyle = PAL.joint;
        for (let yy = 4; yy < h; yy += 10) for (let xx = 4 + ((yy / 10) % 2) * 5; xx < w; xx += 10) { g.save(); g.translate(x + xx, y + yy); g.rotate(((yy / 10) % 2 ? 1 : -1) * 0.8); g.fillRect(-3, -1, 6, 2); g.restore(); }
        for (let k = 1; k < cw; k++) line(x + k * PX, y, x + k * PX, y + h, PAL.slate, 1.5);
      }
      // 運搬路のわだち(ゆるい弧を 2 本ずつ)
      g.strokeStyle = PAL.slate; g.lineWidth = 3; g.setLineDash([14, 6]);
      for (const off of [-10, 10]) { g.beginPath(); g.moveTo(0, 6.5 * PX + off); g.bezierCurveTo(5 * PX, 5 * PX + off, 10 * PX, 9 * PX + off, COLS * PX, 7.5 * PX + off); g.stroke(); }
      g.setLineDash([]);
    }

    const THEMES = { port, city, mine };
    let theme;
    function setTheme(t) {
      theme = t; g.clearRect(0, 0, canvas.width, canvas.height);
      THEMES[t](U.rng(t === "port" ? 11 : t === "city" ? 23 : 37));
      tex.needsUpdate = true;
    }
    setTheme(opts.theme ?? "port");
    return {
      group, update() {}, setTeam() {}, stats: () => U.stats(group), parts: { grid },
      setTheme, get theme() { return theme; }, setGrid(v) { grid.visible = v; }, get gridOn() { return grid.visible; },
    };
  }

  (window.DreamAssets ??= {}).floor = floor;
})();
