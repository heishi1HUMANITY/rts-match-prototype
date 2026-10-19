// 渡河点「橋」の詳細版モデル(試作)。等級が上がるほど広い川を渡れる(長さを伸ばせる)。外観も等級で変える:
//   I = 桁橋(短い径間を橋脚でつなぐ)、II = トラス橋(長い径間)、III = 斜張橋(主塔とケーブル。長いときは主塔2本)。
// 状態: 完成 / 建設中(両岸から床版が伸び、未完成の区間は図面のような半透明 + 足場)/ 破壊(中央が落ち、両側が垂れ下がる)。
// 前方 = +x(長さ len の方向)。断面(幅・高さ)は size 倍(施設は部隊より大きく見せる。既定 2)。川と両岸は確認用。
//
//   const b = DreamAssets.bridge(THREE, { cls: 1, len, size: 2 });   // len を省くと等級ごとの標準の長さ
//   scene.add(b.group); b.setTeam(0xff6a1a); b.setClass(1 | 2 | 3); b.setLength(len); b.setState("built" | "building" | "destroyed"); b.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, road: 0xd8dee4, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3, cyan: 0x1fd3ff };
  // 等級ごとの標準: 渡れる川の幅(地形の帯の幅に合わせる)と、橋脚の間隔の上限
  const CLASS = { 1: { river: 90, span: 60 }, 2: { river: 170, span: 110 }, 3: { river: 250, span: 0 } };
  const defaultLen = (cls) => CLASS[cls].river + 70;

  function bridge(THREE, opts = {}) {
    const U = DreamAssets.util;
    const S = opts.size ?? 2;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      body: lambert(P.body), light: lambert(P.light), road: lambert(P.road), mid: lambert(P.mid), dark: lambert(P.dark), accent: lambert(P.neutral),
      mark: basic(0xffffff), ghost: basic(0x6f8fa3, { transparent: true, opacity: 0.16, depthWrite: false }),
      ghostEdge: U.dashed(THREE, { color: 0x4f6b78, dashSize: 3 * S, gapSize: 2.4 * S }),
      scaffold: new THREE.LineBasicMaterial({ color: 0x8a6d3b }), cable: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.8 }),
      water: U.waterMaterial(THREE),   // 中央水門・地形の川と同じ水
      bankEdge: lambert(0xc3ccd6),
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 10, gapSize: 8, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.07, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "bridge";
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

    let cls = opts.cls ?? 1, len = opts.len ?? defaultLen(cls), state = opts.state ?? "built", progress = state === "building" ? 0 : 1, clock = 0;
    let built = null, world = null, ring = null, disc = null, segs = [], pylons = [], stays = null, debris = null, N = 14, DH = 0, segL = 0;

    // ── 組み立て(等級・長さが変わるたびに作り直す) ──
    function build() {
      for (const g of [built, world]) if (g) { group.remove(g); g.traverse((o) => o.geometry?.dispose?.()); }
      add.reset();
      built = new THREE.Group(); world = new THREE.Group(); world.name = "world"; group.add(built, world);
      const W = (30 + cls * 8) * S;                                                         // 幅(現行の式 × size)
      DH = (12 + cls * 2) * S;                                                               // 床版の高さ
      N = Math.max(8, Math.round(len / (9 * S) / 2) * 2);                                    // 区間の数(偶数。長さに比例)
      segL = len / N; segs = []; pylons = []; stays = null;

      // 確認用の川(橋の長さより少し狭い)と両岸
      const RIVER = len - 70;
      M.water.map.repeat.set(RIVER / (U.WATER_TILE[0] * 3), 700 / (U.WATER_TILE[1] * 3));   // 線の大きさは地形の川と同じ
      add(box(RIVER, 0.2, 700), M.water, world, { y: 0.5, edges: false });
      for (const s of [-1, 1]) add(box(2.4, 1.6, 700), M.bankEdge, world, { x: s * (RIVER / 2 + 1.2), y: 0.8, edges: false });

      // 橋台(両岸)と取り付けの坂
      for (const s of [-1, 1]) {
        const x0 = s * len / 2, q = [[x0 - s * 3 * S, 0], [x0 + s * 12 * S, 0], [x0 + s * 12 * S, DH - 1.2 * S], [x0 - s * 3 * S, DH - 1.2 * S]];
        add(U.loft(THREE, [{ z: -W / 2 - 3 * S, pts: q }, { z: W / 2 + 3 * S, pts: q }]), M.light, built);
        const ramp = [[x0 + s * 12 * S, 0.2], [x0 + s * 40 * S, 0.2], [x0 + s * 12 * S, DH - 1.2 * S]];
        add(U.loft(THREE, [{ z: -W / 2, pts: ramp }, { z: W / 2, pts: ramp }]), M.body, built);
      }

      // 橋脚: 区間の継ぎ目のうち、間隔が上限を超えないように置く(III は主塔の下だけ)
      const piers = [];
      if (cls === 3) {
        for (const x of len > 300 ? [-len * 0.2, len * 0.2] : [0]) piers.push({ x: Math.round(x / segL) * segL, big: true });
      } else {
        const k = Math.max(1, Math.floor(CLASS[cls].span / segL));
        for (let j = -N; j <= N; j++) { const x = j * k * segL; if (Math.abs(x) < len / 2 - segL * 1.5) piers.push({ x, big: false }); }
      }
      for (const { x: px, big } of piers) {
        const pw = (big ? 9 : 6) * S, pd = W * (big ? 1.3 : 0.9), q = [[px - pw / 2 - S, 0], [px + pw / 2 + S, 0], [px + pw / 2, DH - 2.6 * S], [px - pw / 2, DH - 2.6 * S]];
        add(U.loft(THREE, [{ z: -pd / 2, pts: q }, { z: pd / 2, pts: q }]), M.light, built);
        add(box(pw + 4 * S, 1.2 * S, pd + 4 * S), M.dark, built, { x: px, y: 0.6 * S, edges: false });   // 水切り
      }

      // 床版の区間(床 + 桁 + 欄干 [+ トラス])。マテリアルごとに1つへまとめ、区間ごとに建設と破壊の表示を切り替える
      const postG = box(0.7 * S, 2.6 * S, 0.7 * S), railG = box(segL, 0.7 * S, 0.6 * S), slabG = box(segL, 2.4 * S, W), girderG = box(segL, 3.2 * S, 1.6 * S), dashG = box(segL * 0.45, 0.1, 0.6 * S);
      const TH = 16 * S;                                                                      // トラスの高さ
      for (let i = 0; i < N; i++) {
        const x = -len / 2 + segL * (i + 0.5), g = new THREE.Group(); g.position.set(x, DH, 0); built.add(g);
        const real = new THREE.Group(); g.add(real);
        const parts = new Map(), put = (mat, geo, o) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push([geo, o]); };
        put(M.body, slabG, { y: -1.2 * S });
        put(M.mark, dashG, { y: 0.05 });
        for (const s of [-1, 1]) {
          put(M.mid, girderG, { y: -3.6 * S, z: s * (W / 2 - 3 * S) });
          put(M.accent, railG, { y: 2.4 * S, z: s * (W / 2 - 0.6 * S) });
          for (const dx of [-segL / 4, segL / 4]) put(M.dark, postG, { x: dx, y: 1.3 * S, z: s * (W / 2 - 0.6 * S) });
          if (cls === 2) {
            // ワーレントラス: 縦材、斜材(区間ごとに向きを交互)、上弦材(チーム色)
            const z = s * (W / 2 + 0.8 * S), dir = i % 2 ? 1 : -1, dl = Math.hypot(segL, TH);
            put(M.body, box(1.4 * S, TH, 1.4 * S), { x: -segL / 2, y: TH / 2, z });
            put(M.body, box(dl, 1.2 * S, 1.2 * S), { y: TH / 2, z, rz: dir * Math.atan2(TH, segL) });
            put(M.accent, box(segL + 1.4 * S, 1.6 * S, 1.8 * S), { y: TH, z });
            if (i === N - 1) put(M.body, box(1.4 * S, TH, 1.4 * S), { x: segL / 2, y: TH / 2, z });
          }
        }
        if (cls === 2 && i % 2 === 0) put(M.light, box(1.4 * S, S, W + 1.6 * S), { x: -segL / 2, y: TH });   // 上の横つなぎ(1区間おき)
        for (const [mat, list] of parts) add(U.merge(THREE, list), mat, real, { edges: mat === M.body || mat === M.accent });
        // 建設前の姿: 半透明の床版 + 点線の輪郭 + 足場
        const ghost = new THREE.Group(); g.add(ghost);
        const gm = new THREE.Mesh(slabG, M.ghost); gm.position.y = -1.2 * S; ghost.add(gm);
        const gl = new THREE.LineSegments(new THREE.EdgesGeometry(slabG), M.ghostEdge); gl.position.y = -1.2 * S; gl.computeLineDistances(); ghost.add(gl);
        const sc = [], h = DH - 2.4 * S, y1 = -2.4 * S;
        for (const dx of [-segL / 2 + 0.6, segL / 2 - 0.6]) for (const dz of [-W / 2 + 2, 0, W / 2 - 2]) sc.push(dx, y1, dz, dx, y1 - h, dz);
        for (const dz of [-W / 2 + 2, W / 2 - 2]) sc.push(-segL / 2, y1 - h / 2, dz, segL / 2, y1 - h / 2, dz, -segL / 2, y1, dz, segL / 2, y1 - h, dz);
        const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(sc, 3));
        ghost.add(new THREE.LineSegments(sg, M.scaffold));
        segs.push({ g, real, ghost, x, i });
      }

      // III: 主塔(逆Y字: 床版の外を立ち上がり、上で寄せて1本の柱に)と扇形のケーブル
      if (cls === 3) {
        const PH = 70 + 20 * S, out = W / 2 + 3 * S, knee = DH + 4 * S, apex = PH * 0.62, cp = [];
        for (const p of piers) {
          const pylon = new THREE.Group(); pylon.position.x = p.x; built.add(pylon); pylons.push(pylon);
          for (const s of [-1, 1]) {
            add(box(4.4 * S, knee, 3.6 * S), M.body, pylon, { y: knee / 2, z: s * out });
            const rise = apex - knee, legL = Math.hypot(out, rise);
            add(box(4 * S, legL, 3.4 * S), M.body, pylon, { y: (knee + apex) / 2, z: s * out / 2, rx: -s * Math.atan2(out, rise) });
          }
          add(box(3.8 * S, PH - apex, 3.4 * S), M.body, pylon, { y: (apex + PH) / 2 });
          add(box(4 * S, 4 * S, 3.6 * S), M.accent, pylon, { y: PH * 0.9, edges: false });
          add(box(3 * S, 2.2 * S, W + 6 * S), M.light, pylon, { y: DH - 4.4 * S });
          // 主塔から両側へ: 隣の主塔との中間、または橋台の手前まで
          const reach = piers.length > 1 ? Math.abs(piers[0].x - piers[1].x) / 2 - segL * 0.5 : len / 2 - segL * 1.5;
          const n = Math.max(3, Math.min(8, Math.floor(reach / segL)));
          for (const s of [-1, 1]) for (let k = 1; k <= n; k++) {
            const x = p.x + s * Math.min(reach, s < 0 ? p.x + len / 2 - segL : len / 2 - segL - p.x) * (k / n), ty = PH * (0.7 + (k / n) * 0.22);
            cp.push(p.x, ty, 0, x, DH + 0.6 * S, -W / 2 + 1.2 * S, p.x, ty, 0, x, DH + 0.6 * S, W / 2 - 1.2 * S);
          }
        }
        const cg = new THREE.BufferGeometry(); cg.setAttribute("position", new THREE.Float32BufferAttribute(cp, 3));
        stays = new THREE.LineSegments(cg, M.cable); built.add(stays);
      }

      // 破壊時のがれき(川の中)
      debris = new THREE.Group(); built.add(debris);
      const rnd = U.rng(3 + cls);
      for (let k = 0; k < 8; k++) add(box((4 + rnd() * 9) * S, (2 + rnd() * 2.4) * S, (4 + rnd() * 10) * S), k % 3 ? M.light : M.mid, debris, { x: (rnd() - 0.5) * segL * 2.4, y: 1.2 * S, z: (rnd() - 0.5) * W, ry: rnd() * 3, rz: (rnd() - 0.5) * 0.5 });

      // 制圧圏(橋 I/II/III = 50/55/60 × size)
      if (ring) { group.remove(ring, disc); ring.geometry.dispose(); disc.geometry.dispose(); }
      ({ ring, disc } = U.zone(THREE, group, (45 + cls * 5) * S, M.ring, M.disc));
      // 動かない部品を焼いてまとめる(区間ごとに本体と建設前の姿、主塔、がれきは別。チーム色の accent はマテリアルごと)
      const dyn = [...segs.flatMap((s) => [s.g, s.real, s.ghost]), ...pylons, debris];
      U.bake(THREE, built, { dynamic: dyn, live: [M.accent] }); U.bake(THREE, world);   // group ではなく作り直す built / world を焼く
      apply();
    }

    // ── 状態の反映 ──
    function apply() {
      const mid = (N - 1) / 2, front = progress * (N / 2);
      for (const s of segs) {
        const fromEnd = Math.min(s.i, N - 1 - s.i);
        let showReal = true, drop = 0;
        if (state === "building") { const k = front - fromEnd; showReal = k > 0; drop = showReal ? Math.max(0, 1 - k * 3) * 6 * S : 0; }
        s.real.visible = showReal; s.ghost.visible = !showReal;
        s.g.rotation.z = 0; s.g.position.set(s.x, DH + drop, 0); s.g.visible = true;
        if (state === "destroyed") {
          const d = s.i - mid;
          if (Math.abs(d) < 1) s.g.visible = false;                                            // 中央の2区間は落ちた
          else if (Math.abs(d) < 2) {                                                            // その隣は外側の端を支点に垂れ下がる
            const side = Math.sign(d), a = 0.32, px = s.x + side * segL / 2;
            s.g.rotation.z = side * a; s.g.position.set(px - side * Math.cos(a) * segL / 2, DH - Math.sin(a) * segL / 2, 0);
          }
        }
      }
      for (const p of pylons) p.scale.y = state === "building" ? Math.max(0.05, Math.min(1, progress * 1.6)) : 1;
      if (stays) stays.visible = state === "built" || (state === "building" && progress > 0.98);
      debris.visible = state === "destroyed";
    }

    function update(dt) {
      M.water.map.offset.y -= dt * 0.25;
      clock += dt;
      if (state === "building") { progress = Math.min(1, progress + dt / 10); apply(); if (progress >= 1) { state = "built"; apply(); } }
      M.ring.dashOffset = (M.ring.dashOffset ?? 0) - dt * 8;
      M.ghostEdge.dashOffset = -clock * 3 * S;
    }
    function setTeam(c) { const col = c ?? P.neutral; M.accent.color.set(col); M.ring.color.set(col); M.disc.color.set(col); }
    build();
    return {
      group, update, setTeam, stats: () => U.stats(built),
      get parts() { return { ring, disc }; },
      setClass(c) { cls = c; len = defaultLen(c); build(); }, get cls() { return cls; },
      setLength(l) { len = Math.max(140, Math.min(defaultLen(cls), l)); build(); }, get len() { return len; }, get maxLen() { return defaultLen(cls); },
      setState(s) { state = s; progress = s === "building" ? 0 : 1; apply(); }, get state() { return state; },
      get progress() { return state === "building" ? progress : state === "built" ? 1 : 0; },
    };
  }

  (window.DreamAssets ??= {}).bridge = bridge;
})();
