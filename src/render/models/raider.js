// 徘徊NPC(現地勢力)の詳細版モデル(試作)。民間の車両に大径のオフロードタイヤを履かせ(車高を上げて地形を走破)、「無理やり」武装した一団。
// 成長段階で車両の種類と数が変わる(大きさ違いにはしない):
//   段階1: 角ばったステンレスの電動ピックアップ(サイバートラック風)。荷台のカバーに重機関銃を溶接
//   段階2: 丸みのある白い電動SUV(テスラ風)。屋根のキャリアにロケットの箱を縛り付ける + ピックアップ
//   段階3: 観光バス。風防に鉄板を打ち付け、屋根に土のうの銃座と連装機関砲、後ろにロケットの箱 + SUV + ピックアップ2台の隊列
// 民間の塗装(ステンレス、白、観光バスの帯)はそのまま残し、現地勢力の灰緑のスプレーの継ぎ当て、溶接した鉄板、警告縞、防水布で寄せ集めらしさを出す。チーム色は使わない。
// 状態: 移動(隊列で巡回。悪路で車体が揺れる)/ 交戦(止まって撃つ。機関銃・機関砲は弾の筋、ロケットは煙を引いて飛ぶ)/ 撃破(傾いて沈み、煙を上げる)。
//
//   const r = DreamAssets.raider(THREE, { stage: 1 | 2 | 3 });
//   scene.add(r.group); r.setStage(2); r.setState("move" | "engaged" | "destroyed"); r.update(dt)
//
// 前方 = +z、上 = +y。部隊と同じ表示倍率 2.0 を前提にした寸法。
(function () {
  const C = { olive: 0x6b7a5e, olive2: 0x7d8a6c, rust: 0x8a5a3c, steel: 0x8d949b, steel2: 0xa3a9ae, dark: 0x262e36, mech: 0x4a5258, tire: 0x2c3238, tarp: 0x9c9478, glass: 0x26313a, edge: 0x141b21,
    stainless: 0xb9c0c6, pearl: 0xeef1f3, bus: 0xf3f2ec, livery: 0xe8743b, livery2: 0x2aa39a, bag: 0xbdb6a0 };
  const STAGES = { 1: ["cyber"], 2: ["suv", "cyber"], 3: ["bus", "suv", "cyber", "cyber"] };
  const GAP = 10;   // 隊列で前の車両との隙間(車体の長さに足す)

  function raider(THREE, opts = {}) {
    const U = DreamAssets.util;
    const group = new THREE.Group(); group.name = "raider";
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      olive: lambert(C.olive, { flatShading: true }), olive2: lambert(C.olive2, { flatShading: true }), rust: lambert(C.rust, { flatShading: true }),
      steel: lambert(C.steel, { flatShading: true }), steel2: lambert(C.steel2, { flatShading: true }), dark: lambert(C.dark), mech: lambert(C.mech), tire: lambert(C.tire, { flatShading: true }),
      tarp: lambert(C.tarp, { flatShading: true }), glass: lambert(C.glass), hazard: lambert(0xffffff, { map: U.hazardTexture(THREE, 3) }),
      stainless: lambert(C.stainless, { flatShading: true }), pearl: lambert(C.pearl), bus: lambert(C.bus, { flatShading: true }), livery: lambert(C.livery), livery2: lambert(C.livery2), bag: lambert(C.bag, { flatShading: true }), light: basic(0xf4f7fa), tail: basic(0xd9443a),
      flash: basic(0xffb347, { transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }), flashCore: basic(0xfff1c8), shot: basic(0xff8a1a), rocket: lambert(0xd8d2c0),
      smoke: lambert(0x4a525a, { transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }), trail: lambert(0xd9dde0, { transparent: true, opacity: 0.6, depthWrite: false, flatShading: true }),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.5 }),
    };
    const add = U.adder(THREE, M.edge, 25);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const RX = Math.PI / 2, zAxis = V(0, 0, 1);
    const quad = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];
    const flashAt = (parent, z, r) => U.flashAt(THREE, add, M.flash, M.flashCore, parent, z, r);

    // ── 足回り: 大径のオフロードタイヤ(太い溝、深いホイール)、車高を上げる支柱とショック、車体の下の暗い枠 ──
    function bigWheels(g, W, axles, r, bodyY) {
      const wheels = [];
      for (const s of [-1, 1]) for (const z of axles) {
        const n = new THREE.Group(); n.position.set(s * (W / 2 + 0.6), r, z); g.add(n);
        add(cyl(r, r, 2.6, 18), M.tire, n, { rz: RX });
        const lugs = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; lugs.push([box(2.7, 0.5, 0.9), { y: Math.cos(a) * r, z: Math.sin(a) * r, rx: a }]); }
        add(U.merge(THREE, lugs), M.tire, n, { edges: false });
        add(cyl(r * 0.5, r * 0.5, 2.7, 8), M.mech, n, { rz: RX, edges: false });
        add(cyl(r * 0.18, r * 0.18, 2.9, 6), M.dark, n, { rz: RX, edges: false });
        wheels.push(n);
        // 支柱(車体からハブへ)とショック
        add(box(0.6, bodyY - r + 0.4, 0.6), M.dark, g, { x: s * (W / 2 - 0.8), y: (bodyY + r) / 2, z, edges: false });
        add(cyl(0.3, 0.3, bodyY - r + 1.0, 6), M.livery, g, { x: s * (W / 2 - 1.6), y: (bodyY + r) / 2, z: z - 0.9, rx: 0.3, edges: false });
      }
      add(box(W - 3.2, 0.8, Math.abs(axles[0] - axles[axles.length - 1]) + 2), M.dark, g, { y: r, edges: false });   // 車軸の枠
      return wheels;
    }

    // ── 武装 ──
    // 重機関銃(荷台の支柱、前の防盾、受け筒、冷却の太い銃身、弾薬箱、後ろの握り)
    function hmg(parent, x, y, z) {
      const node = new THREE.Group(); node.position.set(x, y, z); parent.add(node);
      add(cyl(0.3, 0.4, 3, 6), M.mech, node, { y: 1.5 });
      const yawG = new THREE.Group(); yawG.position.y = 3; node.add(yawG);
      add(box(1.0, 0.5, 1.0), M.dark, yawG, { y: 0.25, edges: false });
      const pitchG = new THREE.Group(); pitchG.position.y = 1.0; yawG.add(pitchG);
      add(box(4.4, 2.4, 0.25), M.steel, pitchG, { y: 0.5, z: 1.6 });                            // 防盾
      add(box(1.4, 0.35, 0.3), M.dark, pitchG, { y: 0.9, z: 1.75, edges: false });              // のぞき窓
      add(box(1.1, 1.2, 4), M.dark, pitchG, { z: 0.2 });
      add(cyl(0.38, 0.38, 3.6, 8), M.mech, pitchG, { z: 3.8, rx: RX, edges: false });
      add(cyl(0.2, 0.2, 8.5, 6), M.dark, pitchG, { z: 6.2, rx: RX, edges: false });
      add(cyl(0.34, 0.34, 0.8, 6), M.dark, pitchG, { z: 10.4, rx: RX, edges: false });
      add(box(1.4, 1.2, 1.8), M.olive2, pitchG, { x: -1.3, y: -0.3, z: 0.3 });
      for (const s of [-1, 1]) add(box(0.2, 0.7, 0.2), M.dark, pitchG, { x: s * 0.4, y: -0.2, z: -2.0, edges: false });
      return { yawG, pitchG: [pitchG], muzzles: [{ flash: flashAt(pitchG, 10.9, 0.8), rate: 0.11 }], kind: "mg" };
    }
    // 連装機関砲(旋回台、座席、2本の長い砲身、両脇の弾薬箱、斜めの防盾)
    function twin(parent, x, y, z) {
      const node = new THREE.Group(); node.position.set(x, y, z); parent.add(node);
      add(cyl(2.4, 2.6, 0.8, 12), M.mech, node, { y: 0.4 });
      const yawG = new THREE.Group(); yawG.position.y = 0.8; node.add(yawG);
      add(box(3.4, 1.6, 3.6), M.olive2, yawG, { y: 0.8 });
      add(box(1.4, 1.6, 1.4), M.dark, yawG, { y: 1.8, z: -1.4, edges: false });                // 座席
      for (const s of [-1, 1]) add(box(0.3, 2.6, 3.2), M.steel, yawG, { x: s * 2.1, y: 2.4, z: 0.6, ry: s * 0.2 });
      const pitchG = new THREE.Group(); pitchG.position.set(0, 2.6, 0.8); yawG.add(pitchG);
      const muzzles = [];
      for (const s of [-1, 1]) {
        add(box(1.0, 1.1, 3.6), M.dark, pitchG, { x: s * 0.65 });
        add(cyl(0.24, 0.24, 13, 6), M.dark, pitchG, { x: s * 0.65, z: 7.5, rx: RX, edges: false });
        add(cyl(0.36, 0.36, 1.0, 6), M.mech, pitchG, { x: s * 0.65, z: 13.6, rx: RX, edges: false });
        add(box(1.0, 1.4, 1.6), M.olive, pitchG, { x: s * 1.75, y: -0.2, z: 0.2 });
        const m = new THREE.Group(); m.position.x = s * 0.65; pitchG.add(m);
        muzzles.push({ flash: flashAt(m, 14.2, 0.9), rate: 0.16 });
      }
      return { yawG, pitchG: [pitchG], muzzles, kind: "twin", alternate: true };
    }
    // 多連装ロケット(旋回台、後ろを軸に俯仰する箱、前面の発射管の穴)
    function rockets(parent, x, y, z, k = 1) {
      const node = new THREE.Group(); node.position.set(x, y, z); node.scale.setScalar(k); parent.add(node);
      add(cyl(3.0, 3.2, 1.0, 14), M.mech, node, { y: 0.5 });
      const yawG = new THREE.Group(); yawG.position.y = 1.0; node.add(yawG);
      for (const s of [-1, 1]) add(box(0.6, 2.6, 3.0), M.mech, yawG, { x: s * 3.4, y: 1.3, z: -3.2 });
      const pitchG = new THREE.Group(); pitchG.position.set(0, 2.4, -3.6); yawG.add(pitchG);
      add(box(6.4, 4.0, 10), M.olive2, pitchG, { y: 1.2, z: 4.6 });
      add(box(6.5, 0.6, 10.1), M.hazard, pitchG, { y: -0.5, z: 4.6, edges: false });
      const holes = [], tubes = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const hx = -2.4 + c * 1.2, hy = 0.0 + r * 1.2 + 0.2; holes.push([cyl(0.45, 0.45, 0.3, 10), { x: hx, y: hy, z: 9.65, rx: RX }]); tubes.push(V(hx, hy, 9.8)); }
      add(U.merge(THREE, holes), M.dark, pitchG, { edges: false });
      add(box(6.6, 0.3, 4), M.tarp, pitchG, { y: 3.35, z: 1.5, edges: false });                // 天板の防水布
      return { yawG, pitchG: [pitchG], muzzles: [], tubes, kind: "rocket", pod: pitchG };
    }

    // ── 車両 ──
    // 角ばったステンレスの電動ピックアップ: 低い鼻先から屋根の頂点へ一直線、頂点から荷台のカバーへ一直線(三角の横顔)。前に横一本の灯、
    // 斜めの窓、溶接した灰緑の鉄板とスプレーの継ぎ当て、荷台のカバーに重機関銃
    function cyber() {
      const g = new THREE.Group(), L = 22, W = 10, R = 3.6, B = 6.0;
      const wheels = bigWheels(g, W, [7.2, -7.0], R, B);
      const sec = (h) => [[-W / 2, 0], [W / 2, 0], [W / 2, h * 0.45], [W * 0.38, h], [-W * 0.38, h], [-W / 2, h * 0.45]];
      add(U.loft(THREE, [{ z: 11, pts: sec(2.2) }, { z: 9.6, pts: sec(3.0) }, { z: 0.2, pts: sec(6.2) }, { z: -11, pts: sec(3.8) }]), M.stainless, g, { y: B });
      add(box(W * 0.7, 0.25, 0.1), M.light, g, { y: B + 2.3, z: 11.02, edges: false });                 // 横一本の灯
      add(box(W * 0.7, 0.25, 0.1), M.tail, g, { y: B + 3.4, z: -11.02, edges: false });
      // 窓: 車体の断面に沿わせる(その z での車体の高さ h で断面を作り、少しだけ外へ出す)
      //   前の斜面の風防 = 頂の面の一部、横の窓 = 肩の斜面((W/2, 0.45h) → (0.38W, h))の途中
      const hAt = (z) => (z >= 0.2 ? 6.2 + (3.0 - 6.2) * (z - 0.2) / 9.4 : 6.2 + (3.8 - 6.2) * (0.2 - z) / 11.2);
      const ws = (z) => { const h = hAt(z); return { z, pts: [[-W * 0.34, h * 0.99], [W * 0.34, h * 0.99], [W * 0.32, h * 1.01], [-W * 0.32, h * 1.01]] }; };
      add(U.loft(THREE, [ws(7.4), ws(1.0)]), M.glass, g, { y: B, edges: false });
      const sp = (h, p) => [(W / 2 - p * 0.12 * W) * 1.012, (0.45 + 0.55 * p) * h * 1.004];
      const sw = (z) => { const h = hAt(z), [x1, y1] = sp(h, 0.4), [x2, y2] = sp(h, 0.82); return { z, pts: [[-x1, y1], [x1, y1], [x2, y2], [-x2, y2]] }; };
      add(U.loft(THREE, [sw(5.8), sw(0.2), sw(-4.2)]), M.glass, g, { y: B, edges: false });
      // 溶接した鉄板(灰緑)、スプレーの継ぎ当て、前の警告縞の板、荷台の燃料缶と防水布
      add(box(0.3, 2.4, 6.0), M.olive, g, { x: -W / 2 - 0.15, y: B + 1.5, z: 1.0, ry: 0.03 });
      add(box(0.3, 1.8, 4.0), M.steel, g, { x: W / 2 + 0.15, y: B + 1.3, z: -6.0 });
      add(box(4.4, 0.15, 3.2), M.olive2, g, { x: 1.6, y: B + 2.85, z: 8.0, rx: 0.08 });
      add(box(W, 1.0, 0.5), M.hazard, g, { y: B + 0.6, z: 11.3, edges: false });
      for (let i = 0; i < 2; i++) add(box(0.9, 1.3, 1.1), i ? M.rust : M.olive2, g, { x: 3.4 - i * 1.0, y: B + 4.45, z: -9.4, edges: false });
      add(box(2.6, 0.9, 1.8), M.tarp, g, { x: -2.8, y: B + 4.3, z: -9.0 });
      const weapons = [hmg(g, 0, B + 4.2, -5.6)];
      return { g, wheels, weapons, L, R };
    }
    // 丸みのある白い電動SUV: なめらかな横顔、黒いガラスの屋根、細い灯。屋根のキャリアにロケットの箱を縛り付ける。扉に灰緑の鉄板
    function suv() {
      const g = new THREE.Group(), L = 21, W = 9.6, R = 3.4, B = 5.6;
      const wheels = bigWheels(g, W, [6.8, -6.8], R, B);
      const sec = (h) => [[-W / 2, 0], [W / 2, 0], [W / 2, h * 0.5], [W * 0.46, h * 0.72], [W * 0.38, h * 0.9], [W * 0.26, h], [-W * 0.26, h], [-W * 0.38, h * 0.9], [-W * 0.46, h * 0.72], [-W / 2, h * 0.5]];
      add(U.loft(THREE, [{ z: 10.5, pts: sec(1.8) }, { z: 9.4, pts: sec(2.6) }, { z: 6.0, pts: sec(3.0) }, { z: 2.4, pts: sec(5.3) }, { z: -4.0, pts: sec(5.4) }, { z: -8.6, pts: sec(4.2) }, { z: -10.5, pts: sec(2.8) }]), M.pearl, g, { y: B });
      // 黒いガラスの屋根(風防から後ろまで)と横の窓、細い灯
      // ガラスは車体の断面に沿わせる(その z での車体の高さで断面を作り、少しだけ外へ出す)。屋根は頂の面、横の窓は肩の斜面
      const roofS = (h) => [[-W * 0.27, h * 0.985], [W * 0.27, h * 0.985], [W * 0.255, h * 1.012], [-W * 0.255, h * 1.012]];
      add(U.loft(THREE, [{ z: 4.8, pts: roofS(3.77) }, { z: 2.4, pts: roofS(5.3) }, { z: -4.0, pts: roofS(5.4) }, { z: -7.6, pts: roofS(4.46) }]), M.glass, g, { y: B, edges: false });
      const sideS = (h) => [[-W * 0.468, h * 0.74], [W * 0.468, h * 0.74], [W * 0.392, h * 0.88], [-W * 0.392, h * 0.88]];
      add(U.loft(THREE, [{ z: 3.2, pts: sideS(4.79) }, { z: 2.4, pts: sideS(5.3) }, { z: -4.0, pts: sideS(5.4) }, { z: -7.0, pts: sideS(4.62) }]), M.glass, g, { y: B, edges: false });
      add(box(W * 0.8, 0.26, 0.12), M.light, g, { y: B + 1.45, z: 10.53, edges: false });     // 前の横一文字の灯(鼻先の面)
      add(box(W * 0.8, 0.25, 0.1), M.tail, g, { y: B + 3.0, z: -10.0, edges: false });
      // 扉の鉄板、ボンネットの継ぎ当て、前のバンパーに警告縞
      for (const s of [-1, 1]) add(box(0.3, 2.2, 4.6), s < 0 ? M.olive : M.steel, g, { x: s * (W / 2 + 0.12), y: B + 1.5, z: 0.4 });
      add(box(3.6, 0.15, 2.8), M.olive2, g, { x: -1.4, y: B + 3.0, z: 7.2, rx: 0.12 });
      add(box(W - 0.6, 0.9, 0.5), M.hazard, g, { y: B + 0.5, z: 10.7, edges: false });
      // 屋根のキャリア(枠)とロケットの箱、縛り付けの帯
      const rack = []; for (const s of [-1, 1]) rack.push([box(0.3, 0.5, 9), { x: s * 2.4, y: 0, z: -1 }]);
      for (const z of [-5, -1, 3]) rack.push([box(5.1, 0.3, 0.3), { y: 0, z }]);
      add(U.merge(THREE, rack), M.dark, g, { y: B + 5.75, edges: false });
      const w = rockets(g, 0, B + 5.6, 0.6, 0.55);
      for (const s of [-1, 1]) for (const z of [-2.6, 1.6]) add(box(0.5, 0.5, 0.5), M.livery, g, { x: s * 2.4, y: B + 6.15, z, edges: false });   // キャリアに縛った留め具
      return { g, wheels, weapons: [w], L, R };
    }
    // 観光バス: 白い車体に色の帯、大きな窓の帯、前の大きな風防(鉄板を打ち付けてのぞき窓)、横の窓の一部も鉄板でふさぐ。
    // 屋根は前に土のうの銃座と連装機関砲、後ろにロケットの箱、空調の箱。3軸の大径タイヤ
    function bus() {
      const g = new THREE.Group(), L = 40, W = 12, R = 3.6, B = 6.4, H = 11;
      const wheels = bigWheels(g, W, [12.6, -7.6, -15.8], R, B);   // 後ろの2軸はタイヤの直径より離す
      const sec = (h, c) => [[-W / 2, 0], [W / 2, 0], [W / 2, h - c], [W / 2 - c, h], [-W / 2 + c, h], [-W / 2, h - c]];
      add(U.loft(THREE, [{ z: 20, pts: sec(H - 1.0, 1.2).map(([x, y]) => [x * 0.96, y]) }, { z: 19.2, pts: sec(H, 1.0) }, { z: -19.4, pts: sec(H, 1.0) }, { z: -20, pts: sec(H - 0.5, 1.2).map(([x, y]) => [x * 0.97, y]) }]), M.bus, g, { y: B });
      // 色の帯(横の下と、前から斜めに上がる帯)、窓の帯
      for (const s of [-1, 1]) {
        add(box(0.12, 1.0, 38.6), M.livery, g, { x: s * (W / 2 + 0.02), y: B + 2.2 });
        add(box(0.12, 0.6, 38.6), M.livery2, g, { x: s * (W / 2 + 0.02), y: B + 3.1, edges: false });
        add(box(0.12, 3.4, 33), M.glass, g, { x: s * (W / 2 + 0.03), y: B + 6.9, z: -1.6, edges: false });
        // 窓を鉄板でふさいだところ(灰緑・鋼・錆)
        for (const [z, m] of [[8, M.olive], [-4, M.steel], [-13, M.rust]]) add(box(0.3, 3.0, 5.0), m, g, { x: s * (W / 2 + 0.15), y: B + 6.9, z: z + s * 2 });
        for (let i = 0; i < 3; i++) add(box(0.1, 1.1, 2.6), M.dark, g, { x: s * (W / 2 + 0.06), y: B + 0.85, z: 6 - i * 7, edges: false });   // 荷物入れの扉(帯より下)
      }
      // 前: 大きな風防に打ち付けた鉄板とのぞき窓、前照灯、警告縞のバンパー
      add(box(W - 1.4, 5.0, 0.15), M.glass, g, { y: B + 6.8, z: 20.0, edges: false });
      add(box(W - 1.0, 4.0, 0.4), M.olive, g, { y: B + 6.4, z: 20.3, rx: 0.06 });
      add(box(6.0, 0.45, 0.1), M.dark, g, { y: B + 7.4, z: 20.55, edges: false });
      for (const s of [-1, 1]) add(box(1.4, 0.6, 0.1), M.light, g, { x: s * 4.2, y: B + 1.8, z: 20.05, edges: false });
      add(box(W, 1.2, 0.6), M.hazard, g, { y: B + 0.7, z: 20.4, edges: false });
      add(box(W * 0.8, 0.3, 0.1), M.tail, g, { y: B + 2.0, z: -20.02, edges: false });
      // 屋根: 空調の箱、前の土のうの輪と連装機関砲、後ろのロケットの箱、防水布
      add(box(6, 1.2, 7), M.steel2, g, { y: B + H + 0.6, z: -2 });
      const bags = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; bags.push([box(2.4, 1.0, 1.4), { x: Math.cos(a) * 4.0, y: 0.5, z: Math.sin(a) * 4.0, ry: -a + RX }]); }
      add(U.merge(THREE, bags), M.bag, g, { y: B + H, z: 11 });
      add(box(3.0, 1.0, 2.0), M.tarp, g, { x: 3.6, y: B + H + 0.5, z: -8.5 });
      const weapons = [twin(g, 0, B + H, 11), rockets(g, 0, B + H, -12, 0.75)];
      return { g, wheels, weapons, L, R };
    }
    const BUILD = { cyber, suv, bus };

    // ── 組み立て ──
    let stage = opts.stage ?? 1, rig = null;
    function build() {
      if (rig) { group.remove(rig.root); rig.root.traverse((o) => o.geometry?.dispose()); add.reset(); }
      const root = new THREE.Group(); group.add(root);
      const cars = STAGES[stage].map((kind, i) => {
        const v = BUILD[kind](); const holder = new THREE.Group(); holder.add(v.g); root.add(holder);
        return { kind, ...v, holder, seed: i * 1.7, tilt: (i % 2 ? 1 : -1) * (0.05 + 0.04 * i) };
      });
      // 隊列: 先頭からの道のりの差(前の車両の長さと間隔)
      let acc = 0; cars.forEach((c, i) => { if (i) acc += (cars[i - 1].L + c.L) / 2 + 3 + GAP; c.back = acc; });
      const shots = []; cars.forEach((c) => c.weapons.forEach((w) => w.muzzles.forEach((m) => { const s = add(box(0.4, 0.4, 7), M.shot, root, { edges: false }); s.visible = false; m.shot = { m: s, t: 9, from: V(), dir: V() }; shots.push(s); })));
      // ロケット(弾体と煙の尾)
      const RN = 12, rk = Array.from({ length: RN }, () => { const g = new THREE.Group(); add(cyl(0.35, 0.35, 3, 6), M.rocket, g, { rx: RX, edges: false }); add(box(1.2, 0.1, 0.6), M.dark, g, { z: -1.3, edges: false }); g.visible = false; root.add(g); return { g, t: 9, p: V(), v: V() }; });
      const TN = 70, trail = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.trail, TN); root.add(trail);
      const puffs = Array.from({ length: TN }, () => ({ p: V(), t: 9 }));
      const SN = 12 * cars.length, smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.smoke, SN); root.add(smoke);
      const sm = Array.from({ length: SN }, (_, i) => ({ car: i % cars.length, life: (i / SN) % 1, ox: 0, oz: 0 }));
      // 動かない部品を焼いてまとめる(車両ごと・武装の旋回部と俯仰部ごとに別々に)。車輪は車両ごとに InstancedMesh 1 つ(タイヤの縁の線は回しても同じなので静的に焼く)
      const baked = U.bake(THREE, root, {
        dynamic: cars.flatMap((c) => [c.holder, ...c.weapons.flatMap((w) => [w.yawG, ...w.pitchG])]),
        instanced: cars.map((c) => ({ groups: c.wheels, staticEdges: true })),
      });
      rig = { root, cars, rk, trail, puffs, pi: 0, smoke, sm, baked };
      update(0);
    }

    // ── 状態と更新 ──
    let state = opts.state ?? "move", clock = 0, dead = state === "destroyed" ? 1 : 0, u = 0, speed = 0, aim = 0;
    const PATH = { rx: 80, rz: 48 };                     // 巡回の道筋(楕円)
    const pos = (s, out) => { const a = s; return out.set(PATH.rx * Math.cos(a), 0, PATH.rz * Math.sin(a)); };
    const mt = new THREE.Matrix4(), inv = new THREE.Matrix4(), q = new THREE.Quaternion(), rq = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), v2 = new THREE.Vector3(), sc = new THREE.Vector3();
    const ease = (t) => t * t * (3 - 2 * t);
    // 楕円の上で、u から道のり d だけ戻った位置の角度(曲がり角でも車間が詰まらない)
    const back = (u0, d) => { let a = u0, left = d; while (left > 1e-6) { const sp = Math.hypot(PATH.rx * Math.sin(a), PATH.rz * Math.cos(a)), st = Math.min(0.02, left / sp); a -= st; left -= st * sp; } return a; };
    function update(dt) {
      if (!rig) return;
      const R = rig;
      clock += dt;
      dead = Math.max(0, Math.min(1, dead + (state === "destroyed" ? dt / 1.6 : -dt / 2.5)));
      const k = ease(dead), engaged = state === "engaged" && k < 0.05;
      speed += ((state === "move" ? 11 : 0) - speed) * Math.min(1, dt * 1.0);
      u += (speed * dt) / (Math.hypot(PATH.rx * Math.sin(u), PATH.rz * Math.cos(u)) || 1);
      aim += dt * 0.3;
      R.cars.forEach((c, i) => {
        // 隊列: 先頭の道のりから自分の差だけ後ろ。向きは道筋の接線。ホバーは少し浮いて揺れ、曲がるときに外へ傾く
        const ui = back(u, c.back);
        pos(ui, v); const head = Math.atan2(-PATH.rx * Math.sin(ui), PATH.rz * Math.cos(ui));
        // 悪路で車体が揺れる(進む速さに比例)。撃破で片側へ傾いて沈む
        const rough = (speed / 11) * (1 - k);
        c.holder.position.set(v.x, Math.sin(clock * 5.3 + c.seed) * 0.25 * rough - 0.5 * k, v.z);
        c.holder.rotation.set(Math.sin(clock * 3.7 + c.seed) * 0.03 * rough + 0.05 * k * (i % 2 ? 1 : -1), head, Math.sin(clock * 4.1 + c.seed * 2) * 0.03 * rough - 0.03 * (speed / 11) + c.tilt * k);
        for (const w of c.wheels) w.rotation.x += (speed * dt) / c.R;
        // 武装: 移動中は前を向いて見回す、交戦は標的を追う、撃破は垂れる
        c.weapons.forEach((w, j) => {
          const yawT = engaged ? 0.6 + Math.sin(aim + i * 0.4) * 0.8 - head : Math.sin(clock * 0.5 + i + j) * 0.5;
          w.yawNow = (w.yawNow ?? 0) + (yawT - (w.yawNow ?? 0)) * Math.min(1, dt * (engaged ? 3 : 1.2)) * (1 - k);
          const pitchT = k > 0.4 ? -0.15 : engaged ? (w.kind === "rocket" ? 0.5 : 0.12) : 0.02;
          w.pitchNow = (w.pitchNow ?? 0) + (pitchT - (w.pitchNow ?? 0)) * Math.min(1, dt * 1.6);
          w.yawG.rotation.y = w.yawNow; for (const p of w.pitchG) p.rotation.x = -w.pitchNow;
          // 機関銃・機関砲: 短い連射を繰り返す(機関砲は左右交互)
          w.fireT = (w.fireT ?? Math.random()) - dt;
          const burst = engaged && Math.sin(clock * 1.3 + i * 1.9 + j) > 0;
          if (burst && w.muzzles.length && w.fireT <= 0) {
            w.gi = ((w.gi ?? -1) + 1) % w.muzzles.length;
            w.fireT = w.muzzles[0].rate;
            for (const [mi, m] of w.muzzles.entries()) if (!w.alternate || mi === w.gi) { m.t = 0; m.fresh = true; }
          }
          for (const m of w.muzzles) { m.t = (m.t ?? 9) + dt; m.flash.visible = m.t < 0.045; m.flash.rotation.z = clock * 40; }
        });
      });
      R.baked.sync();   // 車輪の回転を InstancedMesh へ
      R.root.updateMatrixWorld(true);
      inv.copy(R.root.matrixWorld).invert(); R.root.getWorldQuaternion(rq).invert();
      // 弾の筋
      for (const c of R.cars) for (const w of c.weapons) for (const m of w.muzzles) {
        const sh = m.shot;
        if (m.fresh) { m.fresh = false; m.flash.getWorldPosition(sh.from).applyMatrix4(inv); sh.dir.set(0, 0, 1).applyQuaternion(m.flash.getWorldQuaternion(q)).applyQuaternion(rq); sh.t = 0; }
        sh.t += dt; sh.m.visible = sh.t < 0.28 && k < 0.05;
        if (sh.m.visible) { sh.m.position.copy(sh.from).addScaledVector(sh.dir, 5 + sh.t * 280); sh.m.quaternion.setFromUnitVectors(zAxis, sh.dir); }
      }
      // ロケット: 交戦中は4発ずつの斉射(0.35 秒おき)と装填の間。発射管から煙を引いて弧を描いて飛ぶ
      // ロケットの箱を持つ武装すべて(SUV の屋根、バスの屋根)が、それぞれの間合いで撃つ
      R.cars.forEach((c, ci) => c.weapons.forEach((pod) => {
        if (pod.kind !== "rocket") return;
        pod.rT = (pod.rT ?? 1.0 + ci * 0.7) - dt; pod.salvo ??= 0;
        if (!(engaged && pod.pitchNow > 0.35 && pod.rT <= 0)) return;
        const r = R.rk.find((x) => x.t > 2.5);
        if (r) {
          const tube = pod.tubes[(pod.salvo * 7) % pod.tubes.length];
          pod.pod.localToWorld(r.p.copy(tube)).applyMatrix4(inv);
          r.v.set(0, 0, 1).applyQuaternion(pod.pod.getWorldQuaternion(q)).applyQuaternion(rq).multiplyScalar(90);
          r.t = 0;
        }
        pod.salvo++; pod.rT = pod.salvo % 4 === 0 ? 3.0 : 0.35;
      }));
      for (const r of R.rk) {
        r.t += dt; r.g.visible = r.t < 2.5;
        if (!r.g.visible) continue;
        r.v.y -= 22 * dt; r.p.addScaledVector(r.v, dt);
        r.g.position.copy(r.p); r.g.quaternion.setFromUnitVectors(zAxis, v.copy(r.v).normalize());
        const pf = R.puffs[R.pi = (R.pi + 1) % R.puffs.length]; pf.p.copy(r.p); pf.t = 0;
      }
      R.puffs.forEach((p, i) => {
        p.t += dt; const s = p.t < 1.6 ? (0.6 + p.t * 1.6) * (1 - p.t / 1.6) : 0;
        mt.compose(v.copy(p.p).add(v2.set(0, p.t * 2, 0)), q.setFromEuler(e.set(i, i * 2, 0)), sc.setScalar(Math.max(0.001, s))); R.trail.setMatrixAt(i, mt);
      });
      R.trail.instanceMatrix.needsUpdate = true;
      // 撃破の煙: 各車両から
      R.sm.forEach((p, i) => {
        const c = R.cars[p.car];
        p.life += dt * 0.3; if (p.life > 1) { p.life -= 1; p.ox = (Math.random() - 0.5) * 5; p.oz = (Math.random() - 0.5) * 8; }
        const L = p.life, s = k * (0.8 + L * 3) * (1 - Math.max(0, L - 0.7) * 3.3);
        v.set(c.holder.position.x + p.ox + L * 6, 12 + L * 30, c.holder.position.z + p.oz - L * 3);
        mt.compose(v, q.setFromEuler(e.set(i, i * 2, 0)), sc.setScalar(Math.max(0.001, s))); R.smoke.setMatrixAt(i, mt);
      });
      R.smoke.instanceMatrix.needsUpdate = true;
    }
    build();
    return {
      group, update, setTeam() {}, stats: () => U.stats(group), parts: {},
      setStage(s) { stage = s; build(); }, get stage() { return stage; },
      setState(s) { state = s; }, get state() { return state; },
    };
  }

  (window.DreamAssets ??= {}).raider = raider;
})();
