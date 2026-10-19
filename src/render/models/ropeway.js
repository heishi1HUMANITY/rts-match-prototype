// 渡河点「索道」の詳細版モデル(試作)。山塊をまたいで部隊を運ぶ重量物用の索道(攻城部隊は通れない)。
//   I = 単線: 大型の搬器1台が駅と駅のあいだを行き来する。山頂に門型の支柱1基
//   II = 複線: 線を2本並べ、搬器2台が上りと下りですれ違う。高い頂2つに支柱2基
// 搬器は 2 本の支持索に載る台車 + 吊り材 + 荷台(部隊1体が載る大きさ。載せているのは仮の部隊)。
// 駅を出た搬器は、屋根に当たらないよう駅の前の受け台までは水平に進み、そこから山へ上がる。
// 支柱の高さは、搬器が山肌に当たらないように山の形から決める(脚は斜面まで伸ばす)。
// 状態: 完成 / 建設中(支柱が伸び、ケーブルを張ってから搬器が付く)/ 破壊(支柱が折れ、ケーブルが垂れて搬器が斜面に落ちる)。
// 前方 = +x(len = 駅の中心どうしの距離)。表示倍率 1。山(低ポリの四角錐)は確認用。
//
//   const rw = DreamAssets.ropeway(THREE, { cls: 1 });
//   scene.add(rw.group); rw.setTeam(0xff6a1a); rw.setClass(1 | 2); rw.setState("built" | "building" | "destroyed"); rw.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3, glass: 0x5d7486, mountain: 0xcfd6dd, hazard: 0xffc83d };
  const LEN = { 1: 520, 2: 600 };

  function ropeway(THREE, opts = {}) {
    const U = DreamAssets.util;
    const GAUGE = 64, HANG = 30, FLOOR = 5, H0 = FLOOR + 3 + HANG + 4;                     // 支持索2本の間隔、吊り材の長さ、駅の床、駅でのケーブルの高さ
    const SL = 130, APRON = 58, DECK_L = 104, DECK_W = 60, BELOW = HANG + 3.4;               // 駅の長さ、駅の前の水平区間、荷台、ケーブルから荷台の底まで
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      body: lambert(P.body), light: lambert(P.light), mid: lambert(P.mid), dark: lambert(P.dark), glass: lambert(P.glass), accent: lambert(P.neutral),
      mountain: lambert(P.mountain, { flatShading: true }), cable: lambert(0x2b3640), hazard: lambert(P.hazard), cargo: lambert(0x6b7684),
      ghost: U.dashed(THREE, { color: 0x4f6b78, dashSize: 6, gapSize: 4 }),
      edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }),
      mEdge: new THREE.LineBasicMaterial({ color: 0x8f98a3, transparent: true, opacity: 0.35 }),
      ring: U.dashed(THREE, { color: P.neutral, dashSize: 12, gapSize: 9, transparent: true, opacity: 0.85 }),
      disc: basic(P.neutral, { transparent: true, opacity: 0.07, depthWrite: false }),
    };
    const group = new THREE.Group(); group.name = "ropeway";
    const add = U.adder(THREE, M.edge, 25), addM = U.adder(THREE, M.mEdge, 10);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    // 2点を結ぶ角材(位置と向きを焼き込んだジオメトリ)
    const rod = (a, b, th, tw = th) => {
      const g = box(th, tw, a.distanceTo(b)), m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
      m.setPosition(a.clone().add(b).multiplyScalar(0.5)); g.applyMatrix4(m); return g;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    let cls = opts.cls ?? 1, len = LEN[cls], state = opts.state ?? "built", progress = state === "building" ? 0 : 1, clock = 0, phase = 0;
    let built = null, world = null, ring = null, disc = null;
    let towers = [], cables = null, ghostLines = null, carriers = [], broken = null, supports = [], lines = [], cones = [];

    // ── 山の高さ: 四角錐(4分割の円錐)を回して置いたものの最大 ──
    const terrain = (x, z) => {
      let h = 0;
      for (const c of cones) {
        const dx = x - c.x, dz = z - c.z, lx = dx * Math.cos(c.ry) - dz * Math.sin(c.ry), lz = dx * Math.sin(c.ry) + dz * Math.cos(c.ry);
        h = Math.max(h, c.h * (1 - (Math.abs(lx) + Math.abs(lz)) / c.r));
      }
      return h;
    };
    // 支点を結ぶケーブルの高さ。taut の区間(駅の中と駅の前)はぴんと張り、山側の径間は少したわむ
    const cableY = (x) => {
      let i = 0; while (i < supports.length - 2 && x > supports[i + 1].x) i++;
      const a = supports[i], b = supports[i + 1], t = Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
      const sag = a.taut ? 0 : Math.hypot(b.x - a.x, b.y - a.y) * 0.03;
      return a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t);
    };

    // 仮の部隊(低い車体 + 砲塔 + 砲身)
    function cargoUnit(parent) {
      const g = new THREE.Group(); parent.add(g);
      const hull = U.sym([[20, 0], [22, 4], [17, 9]]);
      add(U.loft(THREE, [{ z: -38, pts: hull.map(([x, y]) => [x * 0.9, y]) }, { z: 30, pts: hull }, { z: 40, pts: hull.map(([x, y]) => [x * 0.8, y * 0.6]) }]), M.cargo, g, { ry: Math.PI / 2 });
      add(box(26, 6, 20), M.dark, g, { x: -4, y: 12 });
      add(box(40, 3, 4), M.dark, g, { x: 26, y: 12 });
      return g;
    }

    // 搬器: 台車(支持索に載る車輪の列)×2 と、揺れる吊り部分(吊り材 + 荷台)。原点 = 支持索の高さ
    function makeCarrier() {
      const c = new THREE.Group(), hang = new THREE.Group(); c.add(hang); c.userData.hang = hang;
      for (const s of [-1, 1]) {
        const z = s * GAUGE / 2;
        add(box(34, 4, 4), M.light, c, { y: 1.5, z });                                        // 台車
        for (const x of [-12, -4, 4, 12]) add(new THREE.CylinderGeometry(1.8, 1.8, 2.4, 10), M.dark, c, { x, y: 0.4, z, rx: Math.PI / 2, edges: false });
        for (const x of [-14, 14]) add(rod(V(x, 0, z - s * 3), V(x * 1.6, -HANG, s * 29), 2.2), M.body, hang);   // 吊り材(台車の内側から下で広がる)
      }
      for (const x of [-14, 14]) add(box(4, 3, GAUGE - 8), M.light, hang, { x, y: -4 });        // 吊り材どうしの横つなぎ
      const deck = new THREE.Group(); deck.position.y = -HANG - 3; hang.add(deck);
      add(box(DECK_L, 3, DECK_W), M.body, deck, { y: 1.5 });                                  // 荷台
      add(box(DECK_L + 0.4, 1.2, DECK_W + 0.4), M.dark, deck, { y: -0.4, edges: false });
      for (const s of [-1, 1]) {
        add(box(DECK_L, 4, 1.6), M.accent, deck, { y: 5, z: s * 29.2 });                     // 側面の手すり(チーム色)
        for (const x of [-48, -24, 0, 24, 48]) add(box(1.4, 4, 1.4), M.dark, deck, { x, y: 5, z: s * 29.2, edges: false });
        add(box(1.6, 12, 56), M.mid, deck, { x: s * 52.6, y: 7.6, rz: -s * 0.25 });          // 跳ね上げた渡り板
        add(box(1.7, 2, 56.2), M.hazard, deck, { x: s * 53.2, y: 2.6, rz: -s * 0.25, edges: false });
      }
      cargoUnit(deck).position.y = 3;
      return c;
    }

    // 門型の支柱。脚は地面(山肌)から頂の梁まで。legsZ = 脚の z、top = 梁の下面の高さ(世界座標)
    function makeTower(x, legsZ, top, parent) {
      const tw = new THREE.Group(); tw.position.x = x; parent.add(tw);
      const shaft = new THREE.Group(), head = new THREE.Group(); tw.add(shaft, head);
      const lp = [];
      for (const z of legsZ) {
        const g0 = terrain(x, z) - 2, h = top - g0;
        lp.push([box(7, h, 7), { y: g0 + h / 2, z }]);
        const n = Math.max(2, Math.round(h / 18));
        for (let k = 0; k < n; k++) { const y0 = g0 + (k / n) * h, y1 = g0 + ((k + 1) / n) * h; lp.push([rod(V(-3, y0, z), V(3, y1, z), 1.4), {}], [rod(V(3, y0, z), V(-3, y1, z), 1.4), {}]); }
        lp.push([box(10, 2, 10), { y: g0 + 1, z }]);                                           // 基礎
      }
      add(U.merge(THREE, lp), M.body, shaft);
      const wide = legsZ[legsZ.length - 1] - legsZ[0];
      add(box(9, 6, wide + 9), M.light, head, { y: top + 3 });                                   // 上の梁
      add(box(9.4, 2, wide + 9.4), M.accent, head, { y: top + 0.4, edges: false });
      for (const z of lines) for (const k of [-1, 1]) {
        const cz = z + k * GAUGE / 2, oz = legsZ.reduce((a, b) => (Math.abs(b - cz) < Math.abs(a - cz) ? b : a)), dir = Math.sign(oz - cz);
        // 腕木は脚から支持索の外側まで(搬器の吊り材は内側を通る)
        add(box(5, 3, Math.abs(oz - cz) - 1), M.mid, head, { y: top - 22, z: (oz + cz + dir * 1) / 2 + dir * 0.5 });
        add(box(14, 2.4, 3.4), M.dark, head, { y: top - 19.4, z: cz, edges: false });           // 鞍
      }
      return { g: tw, shaft, head, x, top };
    }

    function build() {
      for (const g of [built, world]) if (g) { group.remove(g); g.traverse((o) => o.geometry?.dispose?.()); }
      add.reset(); addM.reset();
      built = new THREE.Group(); world = new THREE.Group(); world.name = "world"; group.add(built, world);
      towers = []; carriers = []; cones = [];
      len = LEN[cls];
      lines = cls === 1 ? [0] : [-46, 46];                                                    // 線の中心(z)。II は2線
      const half = lines.length === 1 ? GAUGE / 2 : 46 + GAUGE / 2;                           // 一番外の支持索
      const mouth = len / 2 - SL / 2, apron = mouth - APRON;                                  // 駅の口、駅の前の受け台(中心からの距離)
      const legsZ = cls === 1 ? [-half - 10, half + 10] : [-half - 10, 0, half + 10];

      // 山: 尾根に沿って四角錐を並べる。受け台にいる搬器の前端より内側に収める(搬器が水平に出てくる区間に山をかけない)
      const peaks = cls === 1 ? [{ x: 0, h: 54, r: 100 }] : [{ x: -55, h: 66, r: 80 }, { x: 55, h: 66, r: 80 }];
      const rnd = U.rng(11 + cls), limit = apron - DECK_L / 2 - 10;   // 受け台にいる搬器の前端より内側
      const place = (x, z, h, r, ry) => {
        const ext = Math.max(Math.abs(Math.cos(ry)), Math.abs(Math.sin(ry)));                 // 中心から x 方向の端まで(r あたり)
        r = Math.min(r, (limit - Math.abs(x)) / ext);
        cones.push({ x, z, h, r, ry });
        addM(new THREE.ConeGeometry(r, h, 4), M.mountain, world, { x, y: h / 2, z, ry });
      };
      for (const p of peaks) place(p.x, 0, p.h, p.r, Math.PI / 4);
      for (let z = -260; z <= 260; z += 70) for (const p of peaks) {
        if (Math.abs(z) < 60) continue;
        place(p.x + (rnd() - 0.5) * 30, z, p.h * (0.55 + rnd() * 0.45), p.r * (0.75 + rnd() * 0.3), Math.PI / 4 + (rnd() - 0.5) * 0.4);
      }

      // 駅(両端): 床、門型の骨組み4つ、屋根(縁がチーム色)、外側の坂、ケーブルの定着台
      const SW = half * 2 + 30, RH = H0 + 14;
      for (const s of [-1, 1]) {
        const st = new THREE.Group(); st.position.x = s * len / 2; built.add(st);
        add(box(SL, FLOOR, SW), M.light, st, { y: FLOOR / 2 });
        const ramp = [[s * SL / 2, 0], [s * (SL / 2 + 40), 0], [s * SL / 2, FLOOR]];
        add(U.loft(THREE, [{ z: -SW / 2 + 10, pts: ramp }, { z: SW / 2 - 10, pts: ramp }]), M.light, st);
        const frame = [];
        for (const x of [-SL / 2 + 6, -SL / 6, SL / 6, SL / 2 - 6]) for (const z of [-SW / 2 + 3, SW / 2 - 3]) frame.push([box(4, RH - FLOOR, 4), { x, y: FLOOR + (RH - FLOOR) / 2, z }]);
        add(U.merge(THREE, frame), M.body, st);
        add(box(SL + 6, 3, SW + 6), M.body, st, { y: RH + 1.5 });
        add(box(SL + 6.4, 1.6, SW + 6.4), M.accent, st, { y: RH - 0.4, edges: false });
        add(box(SL - 20, 1.2, SW - 20), M.light, st, { y: RH + 3.6, edges: false });
        for (const z of lines) for (const k of [-1, 1]) add(box(10, H0 - FLOOR + 4, 8), M.mid, st, { x: s * (SL / 2 - 4), y: FLOOR + (H0 - FLOOR + 4) / 2, z: z + k * GAUGE / 2 });   // 定着台
        add(box(SL - 12, 0.3, 3), M.hazard, st, { y: FLOOR + 0.2, edges: false });
      }

      // 支点と支柱の高さ: 搬器の荷台の底が山肌から 5 以上離れるまで、山の支柱を上げていく
      let top = Math.max(...peaks.map((p) => p.h)) + BELOW + 22;
      const setSupports = () => {
        supports = [{ x: -len / 2 - SL / 2 + 4, y: H0, taut: true }, { x: -mouth, y: H0, taut: true }, { x: -apron, y: H0 }];
        for (const p of peaks) supports.push({ x: p.x, y: top - 18 });
        supports.push({ x: apron, y: H0, taut: true }, { x: mouth, y: H0, taut: true }, { x: len / 2 + SL / 2 - 4, y: H0 });
      };
      const clearance = () => {
        let worst = Infinity;
        for (let xc = -len / 2; xc <= len / 2; xc += 6) {
          const bottom = cableY(xc) - BELOW;
          for (let dx = -DECK_L / 2; dx <= DECK_L / 2; dx += 13) for (const z0 of lines) for (let dz = -DECK_W / 2; dz <= DECK_W / 2; dz += 15) worst = Math.min(worst, bottom - terrain(xc + dx, z0 + dz));
        }
        return worst;
      };
      // 4 ずつ上げて余裕が 5 以上になる最初の高さ(上限 40 段)。余裕は高さに対して単調なので二分探索で同じ答えを得る(前は 1 段ずつ試して 100 ms かかっていた)
      const top0 = top, okAt = (k) => { top = top0 + 4 * k; setSupports(); return clearance() >= 5; };
      let lo = 0, hi = 40;
      if (!okAt(0)) { while (lo < hi) { const mid = (lo + hi) >> 1; if (okAt(mid)) hi = mid; else lo = mid + 1; } }
      okAt(lo);
      for (const p of peaks) towers.push(makeTower(p.x, legsZ, top, built));
      // 駅の前の受け台(低い門型)
      for (const s of [-1, 1]) {
        const ap = new THREE.Group(); ap.position.x = s * apron; built.add(ap);
        for (const z of legsZ) add(box(6, H0 + 8, 6), M.body, ap, { y: (H0 + 8) / 2, z });
        add(box(8, 4, legsZ[legsZ.length - 1] - legsZ[0] + 8), M.light, ap, { y: H0 + 10 });   // 梁は台車より上
        for (const z of lines) for (const k of [-1, 1]) add(box(5, 2.6, Math.abs(legsZ.reduce((a, b) => (Math.abs(b - z - k * GAUGE / 2) < Math.abs(a - z - k * GAUGE / 2) ? b : a)) - z - k * GAUGE / 2) + 2), M.mid, ap, { y: H0 - 3.6, z: (legsZ.reduce((a, b) => (Math.abs(b - z - k * GAUGE / 2) < Math.abs(a - z - k * GAUGE / 2) ? b : a)) + z + k * GAUGE / 2) / 2, edges: false });   // 鞍を支える腕
        for (const z of lines) for (const k of [-1, 1]) add(box(12, 2, 3.4), M.dark, ap, { y: H0 - 1.4, z: z + k * GAUGE / 2, edges: false });
      }

      // 支持索: 線ごとに2本(細い角材をつないで1つに)
      const parts = [], gp = [];
      for (const z0 of lines) for (const k of [-1, 1]) {
        const z = z0 + k * GAUGE / 2, x0 = supports[0].x, x1 = supports[supports.length - 1].x;
        let prev = null;
        for (let i = 0; i <= 48; i++) { const x = x0 + (x1 - x0) * (i / 48), q = V(x, cableY(x), z); if (prev) { parts.push([rod(prev, q, 1.1), {}]); gp.push(prev.x, prev.y, z, q.x, q.y, z); } prev = q; }   // 48 分割(120 から減らした。1 区間 約 12)
      }
      cables = add(U.merge(THREE, parts), M.cable, built, { edges: false });
      const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3));
      ghostLines = new THREE.LineSegments(gg, M.ghost); ghostLines.computeLineDistances(); built.add(ghostLines);

      // 搬器(線ごとに1台)
      for (const [i, z] of lines.entries()) { const c = makeCarrier(); built.add(c); carriers.push({ g: c, i, z, x: 0, v: 0, swing: 0, sv: 0 }); }

      // 破壊の姿: 折れた支柱の頭、駅から垂れたケーブル、斜面に落ちた搬器
      broken = new THREE.Group(); built.add(broken);
      for (const t of towers) {
        const base = terrain(t.x, 0), y = base + (t.top - base) * 0.45;
        const tp = new THREE.Group(); tp.position.set(t.x, y, 0); tp.rotation.set(0.15, 0, -1.9); broken.add(tp);
        for (const z of [legsZ[0], legsZ[legsZ.length - 1]]) add(box(7, 40, 7), M.body, tp, { y: 20, z });
        add(box(9, 6, legsZ[legsZ.length - 1] - legsZ[0] + 9), M.light, tp, { y: 40 });
      }
      const dp = [];
      for (const s of [-1, 1]) for (const z0 of lines) for (const k of [-1, 1]) {
        const z = z0 + k * GAUGE / 2; let prev = V(s * apron, H0, z);
        for (let i = 1; i <= 12; i++) { const t = i / 12, x = s * (apron - t * 70), q = V(x, Math.max(terrain(x, z) + 1, H0 * (1 - t) ** 2 + 1), z * (1 + t * 0.2)); dp.push([rod(prev, q, 1.1), {}]); prev = q; }
      }
      add(U.merge(THREE, dp), M.cable, broken, { edges: false });
      const fallen = makeCarrier(); fallen.position.set(-apron + 20, BELOW + 6, lines[0] + 8); fallen.rotation.set(0.1, 0.5, 0.3); broken.add(fallen);

      if (ring) { group.remove(ring, disc); ring.geometry.dispose(); disc.geometry.dispose(); }
      ({ ring, disc } = U.zone(THREE, group, (45 + cls * 5) * 2, M.ring, M.disc));
      // 動かない部品を焼いてまとめる(支柱の脚と頭、搬器とその吊り部分、支持索、破壊の姿は別。チーム色の accent はマテリアルごと)
      const dyn = [...towers.flatMap((t) => [t.g, t.head]), ...carriers.flatMap((c) => [c.g, c.g.userData.hang]), cables, broken];
      U.bake(THREE, built, { dynamic: dyn, live: [M.accent] }); U.bake(THREE, world);   // group ではなく作り直す built / world を焼く
      apply();
    }

    // ── 状態の反映 ──
    function apply() {
      const b = state === "building", d = state === "destroyed";
      for (const t of towers) {
        // 建設中は脚が下から伸びる(梁の高さを下げる代わりに縦に縮める)、破壊は途中で折れる
        t.g.scale.y = b ? Math.max(0.02, Math.min(1, progress / 0.55)) : d ? 0.45 : 1; t.head.visible = !d;
      }
      cables.visible = (!b && !d) || (b && progress > 0.8);
      ghostLines.visible = b && progress <= 0.8;
      for (const c of carriers) c.g.visible = state === "built" || (b && progress > 0.95);
      broken.visible = d;
    }
    // 搬器の動き: 駅で 6 秒止まる → ゆっくり動き出し、山を越え、ゆっくり止まる(片道 15 秒)。II の2台は逆向きにすれ違う
    const DWELL = 6, TRAVEL = 15, CYCLE = (DWELL + TRAVEL) * 2;
    const smoother = (k) => k * k * k * (k * (k * 6 - 15) + 10);
    const posAt = (t) => {
      const u = ((t % CYCLE) + CYCLE) % CYCLE;
      if (u < DWELL) return 0;
      if (u < DWELL + TRAVEL) return smoother((u - DWELL) / TRAVEL);
      if (u < DWELL * 2 + TRAVEL) return 1;
      return 1 - smoother((u - DWELL * 2 - TRAVEL) / TRAVEL);
    };
    const placeCarriers = (dt) => {
      for (const c of carriers) {
        const t = posAt(phase + c.i * (DWELL + TRAVEL)), x = -len / 2 + len * t;
        // 荷台の揺れ: 加速の向きと逆へ振れ、止まってからしばらく揺れが残る(減衰するばね)
        if (dt > 0) { const v = (x - c.x) / dt, a = (v - c.v) / dt; c.v = v; c.sv += (-c.swing * 9 - c.sv * 1.6 + a * 0.004) * dt; c.swing += c.sv * dt; }
        c.x = x;
        c.g.position.set(x, cableY(x), c.z);
        c.g.userData.hang.rotation.z = Math.max(-0.12, Math.min(0.12, c.swing));
      }
    };

    function update(dt) {
      clock += dt;
      if (state === "building") { progress = Math.min(1, progress + dt / 10); apply(); if (progress >= 1) { state = "built"; apply(); } }
      if (state === "built") phase += dt;
      placeCarriers(dt);
      M.ring.dashOffset = (M.ring.dashOffset ?? 0) - dt * 8;
      M.ghost.dashOffset = -clock * 6;
    }
    function setTeam(c) { const col = c ?? P.neutral; M.accent.color.set(col); M.ring.color.set(col); M.disc.color.set(col); }
    build(); placeCarriers(0);
    return {
      group, update, setTeam, stats: () => U.stats(built),
      get parts() { return { ring, disc }; },
      setClass(c) { cls = c; build(); placeCarriers(0); }, get cls() { return cls; },
      setState(s) { state = s; progress = s === "building" ? 0 : 1; apply(); }, get state() { return state; },
      get progress() { return state === "building" ? progress : state === "built" ? 1 : 0; },
      seek(t) { phase = t; for (const c of carriers) c.x = -len / 2 + len * posAt(t + c.i * (DWELL + TRAVEL)); placeCarriers(0); },
      check: () => { let w = Infinity; for (let i = 0; i <= 200; i++) { const x = -len / 2 + len * i / 200; for (const z0 of lines) for (let dz = -DECK_W / 2; dz <= DECK_W / 2; dz += 5) for (let dx = -DECK_L / 2; dx <= DECK_L / 2; dx += 4) w = Math.min(w, cableY(x) - BELOW - terrain(x + dx, z0 + dz)); } return Math.round(w * 10) / 10; },
    };
  }

  (window.DreamAssets ??= {}).ropeway = ropeway;
})();
