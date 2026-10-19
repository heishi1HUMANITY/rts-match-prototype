// 運河地帯マップの装飾の層「街並み」。湖畔の街、北の大橋の西の街、西の空軍基地の東の小さな街、首都 C の近くの村。
// 街路の格子(車道・歩道・中央線)、中層の集合住宅(窓・バルコニー・階段室・屋上の水槽と空調機)、低層の住宅(パラペット・中庭の塀)、
// 商店の並び(日よけ)、学校(校庭・運動場)、公共の建物(柱廊)、公園(園路・噴水・木)、給水塔(街ごとに 1 基)、街の外れの倉庫、街路樹。
// 改善(2 回目): 区画の大きさを不ぞろいに、大通り(並木の中央分離帯)沿いは背の高い中層、区画の中は低い住宅。壁と屋根の色をばらし、
//   窓は 1 つずつの板、屋上のテラス(日よけ棚・植木)と太陽熱温水器、集合住宅の中庭の庭。中央の広場(敷石・噴水・並木)と時計塔の役場、
//   市場の建物、文化会館。湖畔の街は西の用水路沿いに遊歩道(街灯・ベンチ・手すり・並木・売店)
// 改善(4 回目): ゲーム視点で灰白の塊に見えたので、区画ごとに色の系統(砂・黄土・薄い赤土・暖かい白・灰青・くすんだ桃)を決め、建物ごとに少しずらす。
//   屋根は壁と明度を変える(見下ろしで読めるのは屋根)。中心部は暖色、外の中層は明るく冷たく。地区ごとに階数の段差、大通りに数本の高い棟、
//   区画の中の地面を少し暗く(中庭の陰)、街路を少し暗く。大通りの並木を密に、湖畔の街の東の縁と北の街に公園の帯。
// 縮尺は拠点の建造物と同じ約 0.6 単位/m、高さは 1.5 倍(1 階 = 2.7 単位)。宗教施設・人・車両・実在の地名は置かない。
// 拠点の制圧圏・首都の台・水・地図の道路と鉄道の上には置かない(街の中の道は自前)。建物の底は敷地の最も低い所より少し下に沈める。
(function () {
  const FL = 2.7;   // 1 階の高さ(0.6 単位/m × 3 m × 1.5)

  function towns(THREE, ctx) {
    const { U, M, k, landH, isWater, nearSite, nearLine, drape, strip } = ctx;
    const group = new THREE.Group(); group.name = "deco-towns";
    const { add, box, cyl } = k;
    const L = (c, o) => M.lambert(c, o);
    const MAT = {
      body: M.body, light: M.light, mid: M.mid, glass: M.glass, dark: M.dark,
      roof: L(0xe2e5e8), awn1: L(0xcdbba2), awn2: L(0xb7c4ca), awn3: L(0xc9c2b4), awn4: L(0xd3b3a4), awn5: L(0xb9c9b0),
      park: L(0xc4cfb7), lawn: L(0xbccaa9), path: L(0xe9ebe6), street: L(0x9fa7af), avenue: L(0x959da6), walk: L(0xd2d5d4), yard: L(0xd8dcd6), court: L(0xc9d1c9),
      shed: L(0xd5d9dd), pool: L(0x9fd6e8), win: L(0x57646f), winD: L(0x45515c), plaza: L(0xece9e1), plaza2: L(0xdedad0), pergola: L(0xb9a68a), plant: L(0x94a586),
      solar: L(0x3d4f66), tankW: L(0xf0f2f3), clock: L(0x3b4752), clockF: L(0xf6f4ee), rail: L(0x6b7580), kiosk: L(0xe7d8bf),
    };
    // 壁と屋根の色の組(明るい暖色・寒色)
    const BODIES = [0xfbfcfd, 0xf4efe5, 0xeef1f3, 0xf2e8d9, 0xe7edf0, 0xf6f0e3, 0xede4d6, 0xf3e6df, 0xe4e9e3].map((c) => L(c));
    const ROOFS = [0xe4e1d9, 0xdce3e7, 0xe9e2d2, 0xd5dbe0, 0xece6db, 0xd9d4c8, 0xdfe5df].map((c) => L(c));
    // 色の系統(区画ごとに 1 つ)。壁と屋根の組。くすませて白い模型の見え方の中に収める。屋根は壁より暗くして見下ろしで区画の色が読めるように
    const FAM = {
      sand: { wall: 0xebdfc8, roof: 0xd3c3a3 }, ochre: { wall: 0xe9d6ae, roof: 0xd0b98c }, terra: { wall: 0xecd3c2, roof: 0xcfa58e },
      white: { wall: 0xf6f2ea, roof: 0xdfd9cd }, blue: { wall: 0xe2e7eb, roof: 0xc4ccd3 }, pink: { wall: 0xefdcd6, roof: 0xd4b8b0 },
    };
    const INNER = ["sand", "ochre", "terra", "pink", "sand", "terra", "ochre"], AVE = ["white", "blue", "white", "sand", "blue"], OUTER = ["sand", "white", "ochre", "pink", "blue", "terra"];
    const GROUND = { inner: 0xc5bba6, outer: 0xcac9bb };   // 区画の中の地面(中庭の陰で少し暗い)
    const matCache = new Map(), roofMats = new Set(), tone = new THREE.Color();
    const C = (hex) => matCache.get(hex) ?? matCache.set(hex, L(hex)).get(hex);
    const q4 = (h) => ((h >> 18) << 18) | (((h >> 10) & 63) << 10) | (((h >> 2) & 63) << 2);   // sRGB の各成分を 4 刻みに(材質の数を抑える)
    // 系統の色を建物ごとにずらす(sRGB の 16 進で返す。tone.r などは線形の値なので getHex で sRGB に戻す)
    const hsl = {};
    const jit = (hex, dl, ds) => { tone.setHex(hex).getHSL(hsl); tone.setHSL(hsl.h + (rnd() - 0.5) * 0.02, Math.max(0, hsl.s + (rnd() - 0.5) * ds), hsl.l + (rnd() - 0.5) * dl); return q4(tone.getHex()); };
    let famNow = null;   // 今の区画の色の系統(null = 系統なし。公共の建物など)
    const wallMat = () => (famNow ? C(jit(famNow.wall, 0.06, 0.05)) : pick(BODIES));
    const roofMat = () => { if (!famNow) return pick(ROOFS); const m = C(jit(famNow.roof, 0.08, 0.06)); roofMats.add(m); return m; };
    const parts = new Map();
    const push = (mat, geo, o) => (parts.get(mat) ?? parts.set(mat, []).get(mat)).push([geo, o]);
    const treePos = [];   // [x, y, z, s, kind]
    const treeXZ = ([x, z, y, sc, kind]) => treePos.push([x, y, z, sc, kind]);   // rot() は [x, z] を返すので、[...rot(), y, s, kind] の並びを [x, y, z, s, kind] に直して足す
    const rnd = ctx.rng(31337);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const WIN = new THREE.PlaneGeometry(1.8, 1.45), WIN_S = new THREE.PlaneGeometry(1.3, 1.45);

    // 局所の座標(u = 街路の向き、v = 直交)→ 地図の座標
    const frame = (cx, cz, th) => {
      const c = Math.cos(th), s = Math.sin(th);
      return { th, w: (u, v) => [cx + u * c + v * s, cz - u * s + v * c] };
    };
    // 建物を置いてよい点か(水・拠点・首都の台・地図の道路と鉄道・大橋の取付けの帯・急な所を避ける)
    const corridor = (x, z) => Math.abs(z + 3050) < 80 && x > -820 && x < 0;
    const okPt = (x, z, roadPad = 16) => !isWater(x, z) && !nearSite(x, z, 25) && !nearLine(x, z, roadPad) && !corridor(x, z) && landH(x, z) < 30;
    // 建物の外形(中心 x, z、向き th、幅 w × 奥行き d)の 4 隅と中心と辺の中点が全部よいか。よければ底の高さ(最も低い所 - 1.2)を返す
    const footprint = (x, z, th, w, d, pad = 3) => {
      const c = Math.cos(th), s = Math.sin(th), pts = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const lu = a * (w / 2 + pad), lv = b * (d / 2 + pad);
        pts.push([x + lu * c + lv * s, z - lu * s + lv * c]);
      }
      if (!pts.every(([px, pz]) => okPt(px, pz))) return null;
      const hs = pts.map(([px, pz]) => landH(px, pz));
      if (Math.max(...hs) - Math.min(...hs) > 6) return null;   // 急な斜面には建てない
      return Math.min(...hs) - 1.2;
    };
    // 建物の部品を置く(建物の中心からの局所の座標 lu, ly, lv)
    const part = (mat, geo, x, z, th, base, lu, ly, lv, extra = {}) => {
      const c = Math.cos(th), s = Math.sin(th);
      push(mat, geo, { x: x + lu * c + lv * s, y: base + ly, z: z - lu * s + lv * c, ry: th + (extra.ry ?? 0), rx: extra.rx ?? 0, rz: extra.rz ?? 0 });
    };
    const rot = (x, z, th, lu, lv) => { const c = Math.cos(th), s = Math.sin(th); return [x + lu * c + lv * s, z - lu * s + lv * c]; };
    // 屋上の縁(パラペット)と屋根の面(色)
    const parapet = (x, z, th, base, top, w, d, mat = MAT.light) => {
      for (const s of [-1, 1]) {
        part(mat, box(w + 0.4, 0.9, 0.45), x, z, th, base, 0, top + 0.45, s * (d / 2));
        part(mat, box(0.45, 0.9, d + 0.4), x, z, th, base, s * (w / 2), top + 0.45, 0);
      }
    };
    const roofSkin = (x, z, th, base, top, w, d, rmat = pick(ROOFS)) => part(rmat, box(w - 0.5, 0.2, d - 0.5), x, z, th, base, 0, top + 0.1, 0);
    const roofKit = (x, z, th, base, top, w, d, nTank = 2, nAC = 3) => {
      for (let i = 0; i < nTank; i++) part(MAT.mid, cyl(0.9, 1.6, 8), x, z, th, base, (rnd() - 0.5) * (w - 4), top + 0.8, (rnd() - 0.5) * (d - 4));
      for (let i = 0; i < nAC; i++) part(MAT.light, box(1.2, 0.8, 1), x, z, th, base, (rnd() - 0.5) * (w - 3), top + 0.4, (rnd() - 0.5) * (d - 3));
    };
    // 屋上のテラス: 日よけ棚(柱と横木)と植木鉢、または太陽熱温水器の列
    const terrace = (x, z, th, base, top, w, d) => {
      const r = rnd();
      if (r < 0.32 && w > 10 && d > 8) {
        const pw = Math.min(9, w * 0.45), pd = Math.min(6, d * 0.45), pu = (rnd() - 0.5) * (w - pw - 2), pv = (rnd() - 0.5) * (d - pd - 2);
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) part(MAT.pergola, box(0.3, 2.3, 0.3), x, z, th, base, pu + (a * pw) / 2, top + 1.15, pv + (b * pd) / 2);
        for (let i = 0; i <= 4; i++) part(MAT.pergola, box(0.22, 0.2, pd + 0.8), x, z, th, base, pu - pw / 2 + (pw * i) / 4, top + 2.4, pv);
        for (let i = 0; i < 4; i++) part(MAT.plant, box(0.9, 0.9, 0.9), x, z, th, base, pu - pw / 2 + 1 + i * (pw / 3.2), top + 0.45, pv + pd / 2 + 0.9);
        part(MAT.court, box(pw, 0.12, pd), x, z, th, base, pu, top + 0.26, pv);
      } else if (r < 0.62) {
        const n = 1 + Math.floor(rnd() * 3), su = (rnd() - 0.5) * (w - 8), sv = (rnd() - 0.5) * (d - 6);
        for (let i = 0; i < n; i++) {
          part(MAT.solar, box(2.2, 0.15, 1.4), x, z, th, base, su + i * 2.6, top + 0.9, sv, { rx: 0.55 });
          part(MAT.tankW, cyl(0.45, 2.2, 8), x, z, th, base, su + i * 2.6, top + 1.4, sv - 1.0, { rz: Math.PI / 2 });
        }
      }
    };
    // 窓: 1 つずつの板(長い面は 1 階ごとに等間隔、短い面は少なめ)
    const windows = (x, z, th, base, w, d, floors, y0 = 1.2, skipFront = false) => {
      for (let f = 0; f < floors; f++) {
        const y = y0 + f * FL + 1.4, wm = f === 0 ? MAT.winD : MAT.win;
        const nu = Math.max(1, Math.floor((w - 2) / 4.2)), nv = Math.max(1, Math.floor((d - 2) / 5));
        for (let i = 0; i < nu; i++) {
          const lu = -w / 2 + (w / nu) * (i + 0.5);
          if (!skipFront) part(wm, WIN, x, z, th, base, lu, y, d / 2 + 0.06);
          part(wm, WIN, x, z, th, base, lu, y, -d / 2 - 0.06, { ry: Math.PI });
        }
        for (let i = 0; i < nv; i++) {
          const lv = -d / 2 + (d / nv) * (i + 0.5);
          part(wm, WIN_S, x, z, th, base, w / 2 + 0.06, y, lv, { ry: Math.PI / 2 });
          part(wm, WIN_S, x, z, th, base, -w / 2 - 0.06, y, lv, { ry: -Math.PI / 2 });
        }
      }
    };

    // ── 建物の種類 ──
    // 中層の集合住宅(3〜10 階): 窓、表のバルコニー、階段室、玄関のひさし、屋上(水槽・空調機・テラス・温水器)。L 字にすることもある
    function apartment(x, z, th, w, d, floors, opts = {}) {
      const base = footprint(x, z, th, w, d); if (base === null) return false;
      const H = floors * FL + 1.2, body = opts.body ?? wallMat(), roof = roofMat();
      part(body, box(w, H, d), x, z, th, base, 0, H / 2, 0);
      part(MAT.light, box(w + 0.3, 1.2, d + 0.3), x, z, th, base, 0, 0.6 + 0.8, 0);   // 1 階の腰の帯
      windows(x, z, th, base, w, d, floors);
      for (let f = 1; f < floors; f++) for (let u = -w / 2 + 3.5; u < w / 2 - 2.5; u += 5.5) {
        if (rnd() < 0.25) continue;
        part(MAT.light, box(3.4, 0.25, 1.5), x, z, th, base, u, 1.2 + f * FL + 0.15, d / 2 + 0.75);
        part(body, box(3.4, 0.9, 0.15), x, z, th, base, u, 1.2 + f * FL + 0.7, d / 2 + 1.45);
      }
      part(MAT.light, box(4.2, H + 2.6, 3.6), x, z, th, base, -w / 2 + 6, (H + 2.6) / 2, -d / 2 + 1.6);   // 階段室(屋上へ突き出る)
      part(MAT.light, box(5, 0.3, 2.2), x, z, th, base, w / 6, 3.4, d / 2 + 1.1);                        // 玄関のひさし
      parapet(x, z, th, base, H, w, d, famNow ? body : MAT.light);
      roofSkin(x, z, th, base, H, w, d, roof);
      roofKit(x, z, th, base, H, w, d, 1 + Math.floor(rnd() * 3), 2 + Math.floor(rnd() * 4));
      terrace(x, z, th, base, H, w, d);
      // L 字の袖(背の高い棟の裏に低い袖)
      if (opts.wing && w > 26) {
        const wd = 10 + rnd() * 6, wf = Math.max(2, floors - 2 - Math.floor(rnd() * 2)), WH = wf * FL + 1.2, wu = (rnd() < 0.5 ? -1 : 1) * (w / 2 - 5.5), wv = -d / 2 - wd / 2;
        const c = Math.cos(th), s = Math.sin(th), wx = x + wu * c + wv * s, wz = z - wu * s + wv * c;
        if (footprint(wx, wz, th, 11, wd, 1) !== null) {
          part(body, box(11, WH, wd), x, z, th, base, wu, WH / 2, wv);
          windows(wx, wz, th, base, 11, wd, wf, 1.2, true);
          parapet(wx, wz, th, base, WH, 11, wd, famNow ? body : MAT.light); roofSkin(wx, wz, th, base, WH, 11, wd, roof);
        }
      }
      return true;
    }
    // 低層の住宅(1〜3 階): パラペット、窓、屋上の水槽、半分ほどに階段小屋、表に塀で囲った中庭
    function house(x, z, th, w, d) {
      const base = footprint(x, z, th, w, d + 7); if (base === null) return false;
      const floors = rnd() < 0.2 ? 3 : rnd() < 0.6 ? 2 : 1, H = floors * FL + 1.2, dz = -3.5, body = wallMat(), roof = roofMat();
      part(body, box(w, H, d), x, z, th, base, 0, H / 2, dz);
      for (let f = 0; f < floors; f++) for (const lu of [-w / 4, w / 4]) {
        part(MAT.win, WIN, x, z, th, base, lu, 1.2 + f * FL + 1.4, dz + d / 2 + 0.06);
        part(MAT.win, WIN, x, z, th, base, lu, 1.2 + f * FL + 1.4, dz - d / 2 - 0.06, { ry: Math.PI });
      }
      parapet(x, z, th, base, H, w, d, famNow ? body : MAT.light);
      roofSkin(x, z, th, base, H, w, d, roof);
      part(MAT.mid, cyl(0.8, 1.4, 8), x, z, th, base, w / 4, H + 0.7, dz - d / 4);
      if (rnd() < 0.5) part(MAT.light, box(3, 2.2, 3), x, z, th, base, -w / 4, H + 1.1, dz);
      if (rnd() < 0.35) terrace(...rot(x, z, th, 0, dz), th, base, H, w, d);
      // 中庭の塀(表側、門の切れ目)
      const yd = 6.5, yz = dz + d / 2 + yd / 2;
      part(MAT.light, box(0.4, 2, yd), x, z, th, base, -w / 2 + 0.2, 1, yz);
      part(MAT.light, box(0.4, 2, yd), x, z, th, base, w / 2 - 0.2, 1, yz);
      part(MAT.light, box(w / 2 - 1.5, 2, 0.4), x, z, th, base, -w / 4 - 0.75, 1, yz + yd / 2);
      part(MAT.light, box(w / 2 - 1.5, 2, 0.4), x, z, th, base, w / 4 + 0.75, 1, yz + yd / 2);
      part(MAT.court, box(w - 0.8, 0.2, yd - 0.4), x, z, th, base, 0, 1.38, yz);   // 区画の地面(上面 底 + 1.32)より上
      if (rnd() < 0.5) treeXZ([...rot(x, z, th, w / 4, yz), base + 1.2, 0.6, 0]);
      return true;
    }
    // 商店の並び(2〜3 階建ての連続した棟): 1 階の店先のガラス、色の違う日よけ、上の階の窓、看板の箱
    function shopRow(x, z, th, len, d, floors = 2) {
      const base = footprint(x, z, th, len, d); if (base === null) return false;
      const H = floors * FL + 1.2, body = wallMat(), roof = roofMat();
      part(body, box(len, H, d), x, z, th, base, 0, H / 2, 0);
      part(MAT.glass, box(len - 0.6, 1.6, 0.3), x, z, th, base, 0, 2.2, d / 2 + 0.05);
      windows(x, z, th, base, len, d, floors - 1, 1.2 + FL);
      for (let u = -len / 2 + 2.5; u < len / 2 - 1; u += 5) {
        part(pick([MAT.awn1, MAT.awn2, MAT.awn3, MAT.awn4, MAT.awn5]), box(4.4, 0.22, 2.6), x, z, th, base, u, 3.6, d / 2 + 1.2, { rx: 0.32 });
        if (rnd() < 0.6) part(MAT.light, box(3, 0.9, 0.3), x, z, th, base, u, 4.6, d / 2 + 0.2);   // 看板
      }
      parapet(x, z, th, base, H, len, d, famNow ? body : MAT.light);
      roofSkin(x, z, th, base, H, len, d, roof);
      roofKit(x, z, th, base, H, len, d, 1, 4);
      terrace(x, z, th, base, H, len, d);
      return true;
    }
    // 学校: 校庭と運動場の線、L 字の 3 階建て、塀の柱、校庭の木
    function school(x, z, th) {
      const W = 64, D = 46, base = footprint(x, z, th, W, D); if (base === null) return false;
      part(MAT.yard, box(W, 0.4, D), x, z, th, base, 0, 1.4, 0);
      const body = BODIES[3];
      for (const [lu, lv, w, d] of [[-14, -16, 34, 11], [-27, 2, 9, 26]]) {
        const H = 3 * FL + 1.2, [bx, bz] = rot(x, z, th, lu, lv);
        part(body, box(w, H, d), x, z, th, base, lu, H / 2, lv);
        windows(bx, bz, th, base, w, d, 3);
        parapet(bx, bz, th, base, H, w, d); roofSkin(bx, bz, th, base, H, w, d, ROOFS[1]);
      }
      // 運動場(白線の楕円の代わりに長方形の枠とセンターライン)
      for (const s of [-1, 1]) { part(MAT.path, box(30, 0.15, 0.6), x, z, th, base, 12, 1.65, 4 + s * 9); part(MAT.path, box(0.6, 0.15, 18), x, z, th, base, 12 + s * 15, 1.65, 4); }
      part(MAT.path, box(0.5, 0.15, 18), x, z, th, base, 12, 1.65, 4);
      for (let u = -W / 2; u <= W / 2; u += 4) for (const s of [-1, 1]) part(MAT.dark, box(0.3, 2.2, 0.3), x, z, th, base, u, 2.5, s * D / 2);
      for (let v = -D / 2; v <= D / 2; v += 4) for (const s of [-1, 1]) part(MAT.dark, box(0.3, 2.2, 0.3), x, z, th, base, s * W / 2, 2.5, v);
      for (let i = 0; i < 5; i++) treeXZ([...rot(x, z, th, -10 + i * 9, D / 2 - 4), base + 1.6, 0.7, 0]);
      return true;
    }
    // 公共の建物: 2 階建てに表の柱廊と石段、前庭
    function civic(x, z, th) {
      const W = 40, D = 24, base = footprint(x, z, th, W, D + 14); if (base === null) return false;
      const H = 2 * FL + 2.2;
      part(BODIES[5], box(W, H, D), x, z, th, base, 0, H / 2, -5);
      windows(...rot(x, z, th, 0, -5), th, base, W, D, 2, 1.2, true);
      part(MAT.roof, box(W + 2, 1, D + 6), x, z, th, base, 0, H + 0.5, -2);   // 柱廊の上まで張り出す屋根
      for (let u = -W / 2 + 3; u <= W / 2 - 3; u += 4.25) part(MAT.light, cyl(0.6, H, 10), x, z, th, base, u, H / 2, D / 2 - 5 + 2.4);
      for (let i = 0; i < 3; i++) part(MAT.light, box(W - 6 - i * 2, 0.5, 2), x, z, th, base, 0, 1.45 + i * 0.5, D / 2 - 5 + 4 + (2 - i) * 1.4);
      part(MAT.path, box(W, 0.3, 10), x, z, th, base, 0, 1.35, D / 2 + 6);
      return true;
    }
    // 役場(時計塔つき): 3 階建ての本館、中央の時計塔(四面の文字盤、四角錐の屋根)、正面の石段と旗竿。広場に面して建てる(front = 広場の向き)
    function townHall(x, z, th) {
      const W = 50, D = 24, base = footprint(x, z, th, W, D + 8); if (base === null) return false;
      const H = 3 * FL + 2, body = BODIES[6];
      part(body, box(W, H, D), x, z, th, base, 0, H / 2, -3);
      windows(...rot(x, z, th, 0, -3), th, base, W, D, 3);
      for (let u = -W / 2 + 3; u <= W / 2 - 3; u += 5.5) part(MAT.light, box(0.9, H, 0.9), x, z, th, base, u, H / 2, D / 2 - 3 + 0.5);   // 柱形
      part(MAT.light, box(W + 1.2, 1.1, D + 1.2), x, z, th, base, 0, H + 0.55, -3);
      roofSkin(x, z, th, base, H + 1.1, W, D);
      const TH = H + 24, T = 9;   // 時計塔
      part(body, box(T, TH, T), x, z, th, base, 0, TH / 2, -3);
      part(MAT.light, box(T + 1, 1, T + 1), x, z, th, base, 0, TH - 7, -3);
      part(MAT.light, box(T + 1.4, 1.2, T + 1.4), x, z, th, base, 0, TH + 0.6, -3);
      part(MAT.roof, new THREE.ConeGeometry(T * 0.78, 7, 4).rotateY(Math.PI / 4), x, z, th, base, 0, TH + 4.7, -3);
      for (const [lu, lv, ry] of [[0, T / 2 + 0.08, 0], [0, -T / 2 - 0.08, Math.PI], [T / 2 + 0.08, 0, Math.PI / 2], [-T / 2 - 0.08, 0, -Math.PI / 2]]) {
        part(MAT.clockF, new THREE.CircleGeometry(3, 20), x, z, th, base, lu, TH - 3.5, lv - 3, { ry });
        part(MAT.clock, new THREE.RingGeometry(2.7, 3.1, 20), x, z, th, base, lu * 1.01, TH - 3.5, lv * 1.01 - 3, { ry });
      }
      for (let i = 0; i < 4; i++) part(MAT.light, box(W * 0.5 - i * 2, 0.5, 2), x, z, th, base, 0, 1.45 + i * 0.5, D / 2 - 3 + 2 + (3 - i) * 1.4);
      for (const s of [-1, 1]) { part(MAT.mid, cyl(0.25, 16, 6), x, z, th, base, s * 14, 8.4, D / 2 + 5); part(MAT.light, box(3.6, 0.9, 3.6), x, z, th, base, s * 14, 0.9, D / 2 + 5); }
      return true;
    }
    // 市場の建物: 長い棟、切妻屋根と高窓、両側の柱の並ぶ軒下
    function marketHall(x, z, th, len = 62) {
      const D = 26, base = footprint(x, z, th, len, D + 6); if (base === null) return false;
      const H = 2 * FL + 1;
      part(BODIES[1], box(len, H, D), x, z, th, base, 0, H / 2, 0);
      windows(x, z, th, base, len, D, 1, 1.2 + FL);
      const sh = new THREE.Shape([new THREE.Vector2(-D / 2 - 3.2, 0), new THREE.Vector2(D / 2 + 3.2, 0), new THREE.Vector2(0, 7)]);
      const roofG = new THREE.ExtrudeGeometry(sh, { depth: len + 2, bevelEnabled: false }); roofG.translate(0, 0, -(len + 2) / 2); roofG.rotateY(Math.PI / 2);
      part(ROOFS[2], roofG, x, z, th, base, 0, H, 0);
      part(MAT.light, box(len - 6, 2.6, 5), x, z, th, base, 0, H + 6.2, 0);   // 高窓の棟
      part(MAT.win, box(len - 6.4, 1.4, 5.3), x, z, th, base, 0, H + 6.2, 0);
      for (let u = -len / 2 + 2; u <= len / 2 - 2; u += 5) for (const sg of [-1, 1]) part(MAT.light, cyl(0.45, H, 8), x, z, th, base, u, H / 2, sg * (D / 2 + 2.6));
      for (let u = -len / 2 + 4; u < len / 2 - 3; u += 7) part(pick([MAT.awn1, MAT.awn2, MAT.awn4, MAT.awn5]), box(5, 0.2, 2.2), x, z, th, base, u, 3.4, D / 2 + 1.1);
      return true;
    }
    // 文化会館: 2 階建ての箱と、細い柱で支える大きな平たい屋根(張り出し)、1 階のガラス
    function cultureCentre(x, z, th) {
      const W = 46, D = 30, base = footprint(x, z, th, W + 8, D + 8); if (base === null) return false;
      const H = 2 * FL + 2;
      part(BODIES[2], box(W, H, D), x, z, th, base, 0, H / 2, 0);
      part(MAT.glass, box(W - 6, 2.4, 0.3), x, z, th, base, 0, 2.6, D / 2 + 0.05);
      windows(x, z, th, base, W, D, 1, 1.2 + FL, true);
      part(MAT.light, box(W + 12, 1.2, D + 12), x, z, th, base, 0, H + 3.4, 0);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [0, -1]]) part(MAT.light, cyl(0.4, H + 2.8, 8), x, z, th, base, a * (W / 2 + 4.5), (H + 2.8) / 2, b * (D / 2 + 4.5));
      part(MAT.plaza2, box(W + 14, 0.3, 12), x, z, th, base, 0, 1.35, D / 2 + 9);
      return true;
    }
    // 中央の広場: 敷石の市松模様、大きな噴水、外周の並木とベンチ、街灯
    function plaza(x, z, th, w, d) {
      const base = footprint(x, z, th, w, d, 0); if (base === null) return false;
      part(MAT.plaza, box(w, 0.4, d), x, z, th, base, 0, 1.4, 0);
      for (let lu = -w / 2 + 4; lu < w / 2 - 3; lu += 8) for (let lv = -d / 2 + 4; lv < d / 2 - 3; lv += 8) if ((Math.round(lu / 8) + Math.round(lv / 8)) % 2 === 0) part(MAT.plaza2, box(7.6, 0.1, 7.6), x, z, th, base, lu, 1.65, lv);
      part(MAT.light, cyl(8, 1, 20), x, z, th, base, 0, 2.0, 0);
      part(MAT.pool, cyl(7, 0.3, 20), x, z, th, base, 0, 2.55, 0);
      part(MAT.light, cyl(1, 4, 10), x, z, th, base, 0, 4, 0);
      part(MAT.light, cyl(3, 0.6, 14), x, z, th, base, 0, 5.8, 0);
      part(MAT.pool, cyl(2.5, 0.3, 14), x, z, th, base, 0, 6.15, 0);
      for (let lu = -w / 2 + 5; lu <= w / 2 - 5; lu += 11) for (const sg of [-1, 1]) {
        treeXZ([...rot(x, z, th, lu, sg * (d / 2 - 4)), base + 1.6, 0.75, 0]);
        part(MAT.pergola, box(3.2, 0.5, 1), x, z, th, base, lu + 5.5, 2.1, sg * (d / 2 - 6.5));   // ベンチ
      }
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { part(MAT.mid, cyl(0.2, 7, 6), x, z, th, base, a * (w / 2 - 9), 5.1, b * (d / 2 - 9)); part(MAT.tankW, box(1, 0.6, 1), x, z, th, base, a * (w / 2 - 9), 8.8, b * (d / 2 - 9)); }
      return true;
    }
    // 公園: 芝の地、十字の園路、中央の噴水、木
    function park(x, z, th, w, d, dense = 1) {
      const base = footprint(x, z, th, w, d, 0); if (base === null) return false;
      part(MAT.park, box(w, 0.4, d), x, z, th, base, 0, 1.4, 0);
      part(MAT.path, box(w, 0.2, 2.6), x, z, th, base, 0, 1.7, 0);
      part(MAT.path, box(2.6, 0.2, d), x, z, th, base, 0, 1.7, 0);
      part(MAT.light, cyl(4, 0.8, 16), x, z, th, base, 0, 1.9, 0);
      part(MAT.pool, cyl(3.2, 0.3, 16), x, z, th, base, 0, 2.3, 0);   // 噴水の水盤
      const n = Math.floor(((w * d) / 120) * dense);
      for (let i = 0; i < n; i++) {
        const lu = (rnd() - 0.5) * (w - 4), lv = (rnd() - 0.5) * (d - 4);
        if (Math.abs(lu) < 3 || Math.abs(lv) < 3) continue;
        treeXZ([...rot(x, z, th, lu, lv), base + 1.6, (0.7 + rnd() * 0.5) * (dense > 1 ? 1.25 : 1), rnd() < 0.3 ? 1 : 0]);
      }
      return true;
    }
    // 集合住宅の中庭の庭: 芝、園路、遊具の枠、木
    function courtGarden(x, z, th, w, d) {
      if (w < 14 || d < 10) return;
      const base = footprint(x, z, th, w, d, 0); if (base === null) return;
      part(MAT.lawn, box(w, 0.3, d), x, z, th, base, 0, 1.35, 0);
      part(MAT.path, box(w, 0.15, 1.8), x, z, th, base, 0, 1.6, 0);
      if (rnd() < 0.5) { part(MAT.yard, box(6, 0.15, 5), x, z, th, base, w / 4, 1.62, 0); part(MAT.mid, box(4, 2.4, 0.25), x, z, th, base, w / 4, 2.8, -1.2); }
      for (let i = 0; i < Math.max(2, Math.floor(w / 9)); i++) treeXZ([...rot(x, z, th, -w / 2 + 4 + i * 9 + rnd() * 3, (rnd() < 0.5 ? -1 : 1) * (d / 4)), base + 1.5, 0.55 + rnd() * 0.3, rnd() < 0.2 ? 1 : 0]);
    }
    // 給水塔(街ごとに 1 基): 柱、きのこ形の水槽、点検の踊り場
    function waterTower(x, z) {
      const base = footprint(x, z, 0, 18, 18, 1); if (base === null) return false;
      push(MAT.light, cyl(2.4, 34, 12), { x, y: base + 17, z });
      push(MAT.light, new THREE.ConeGeometry(8.5, 5, 16).rotateX(Math.PI), { x, y: base + 36.5, z });
      push(MAT.body, cyl(8.5, 6, 16), { x, y: base + 42, z });
      push(MAT.light, new THREE.ConeGeometry(8.7, 3, 16), { x, y: base + 46.5, z });
      push(MAT.dark, cyl(9.2, 0.4, 16), { x, y: base + 39.2, z });   // 踊り場の縁
      push(MAT.light, cyl(4.5, 1.4, 12), { x, y: base + 0.7 + 1.2, z });
      return true;
    }
    // 倉庫・作業場(街の外れ): 切妻屋根の長い棟、搬入口、前の作業場
    function warehouse(x, z, th, w, d) {
      const base = footprint(x, z, th, w, d + 10); if (base === null) return false;
      const H = 8;
      part(MAT.shed, box(w, H, d), x, z, th, base, 0, H / 2, -5);
      const roofSh = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.6, 0), new THREE.Vector2(d / 2 + 0.6, 0), new THREE.Vector2(0, 3.2)]);
      const roofG = new THREE.ExtrudeGeometry(roofSh, { depth: w + 1, bevelEnabled: false }); roofG.translate(0, 0, -(w + 1) / 2); roofG.rotateY(Math.PI / 2);
      part(roofMat(), roofG, x, z, th, base, 0, H, -5);
      for (let u = -w / 2 + 6; u < w / 2 - 3; u += 10) part(MAT.dark, box(5, 5, 0.3), x, z, th, base, u, 3.2, d / 2 - 5 + 0.15);
      part(MAT.yard, box(w, 0.3, 10), x, z, th, base, 0, 1.35, d / 2);
      return true;
    }

    // ── 街の格子: 区画の大きさは不ぞろい。大通り(中心に近い u・v の 1 本ずつ)は幅広で中央分離帯に並木 ──
    const streetPieces = [], avenuePieces = [], dashParts = [], medianParts = [];
    const cuts = (a0, a1, b) => { const out = [a0]; let p = a0; while (p < a1 - b * 0.7) { p += b * (0.78 + rnd() * 0.5); out.push(Math.min(p, a1)); } if (out[out.length - 1] < a1 - 1) out.push(a1); return out; };
    function town({ cx, cz, th, U0, U1, V0, V1, bu, bv, coreR, towerAt, extras = [], landmarks = [], belts = [], towers = 0 }) {
      const F2 = frame(cx, cz, th);
      const okStreet = (x, z) => !isWater(x, z) && !nearSite(x, z, 30) && !corridor(x, z) && landH(x, z) < 30;
      const us = cuts(U0, U1, bu), vs = cuts(V0, V1, bv);
      const nearest = (arr) => arr.reduce((b, x) => (Math.abs(x) < Math.abs(b) ? x : b), arr[0]);
      const AU = nearest(us), AV = nearest(vs);   // 大通りの線
      // 街路: u 方向と v 方向の直線を、置けない所で切る
      const lines = [];
      for (const v of vs) lines.push([[U0, v], [U1, v], v === AV]);
      for (const u of us) lines.push([[u, V0], [u, V1], u === AU]);
      for (const [[a0, a1], [b0, b1], av] of lines) {
        let cur = [];
        const n = Math.ceil(Math.hypot(b0 - a0, b1 - a1) / 6);
        for (let i = 0; i <= n; i++) {
          const [x, z] = F2.w(a0 + ((b0 - a0) * i) / n, a1 + ((b1 - a1) * i) / n);
          if (okStreet(x, z)) cur.push([x, z]); else { if (cur.length > 7) (av ? avenuePieces : streetPieces).push(cur); cur = []; }   // 短い切れ端は描かない
        }
        if (cur.length > 7) (av ? avenuePieces : streetPieces).push(cur);
      }
      // 区画
      let built = 0, made = { tower: false, towers: 0 };
      const used = new Set();
      for (let iu = 0; iu < us.length - 1; iu++) for (let iv = 0; iv < vs.length - 1; iv++) {
        const u = us[iu], u2 = us[iu + 1], v = vs[iv], v2 = vs[iv + 1];
        const onAU0 = u === AU, onAU1 = u2 === AU, onAV0 = v === AV, onAV1 = v2 === AV;   // 大通りに接する辺
        const iU0 = onAU0 ? 16 : 10, iU1 = onAU1 ? 16 : 10, iV0 = onAV0 ? 16 : 10, iV1 = onAV1 ? 16 : 10;
        const uu0 = u + iU0, uu1 = u2 - iU1, vv0 = v + iV0, vv1 = v2 - iV1, bw = uu1 - uu0, bd = vv1 - vv0;
        if (bw < 18 || bd < 18) continue;
        const mu = (uu0 + uu1) / 2, mv = (vv0 + vv1) / 2, r = Math.hypot(mu, mv) / coreR, onAve = onAU0 || onAU1 || onAV0 || onAV1;
        const [bx, bz] = F2.w(mu, mv);
        if (!okPt(bx, bz, 10)) continue;
        famNow = null;
        // 公園の帯(大通りと同じく区画の並びで決める)
        if (belts.some((b) => (b.u !== undefined ? Math.abs(b.u - mu) < (u2 - u) / 2 : Math.abs(b.v - mv) < (v2 - v) / 2))) { built += park(bx, bz, th, bw, bd, 2.2) ? 1 : 0; continue; }
        // 大通りの交差点の角の区画: 広場と役場
        const lm = landmarks.find((e) => !used.has(e) && (e.su > 0 ? onAU0 : onAU1) && (e.sv > 0 ? onAV0 : onAV1));   // 大通りの交差点の四隅(su, sv = 象限)
        if (lm) {
          used.add(lm);
          const fr = lm.front ?? 0;   // 広場の向き(建物の正面の回転)
          if (lm.kind === "plaza") built += plaza(bx, bz, th, bw, bd) ? 1 : 0;
          if (lm.kind === "hall") built += townHall(bx, bz, th + fr) ? 1 : 0;
          if (lm.kind === "market") built += marketHall(bx, bz, th + fr, Math.min(70, bw - 4)) ? 1 : 0;
          if (lm.kind === "culture") built += cultureCentre(bx, bz, th + fr) ? 1 : 0;
          if (lm.kind !== "plaza") { const [px, pz] = F2.w(mu, vv1 - 5); courtGarden(px, pz, th, bw - 6, 6); }
          continue;
        }
        const ex = extras.find((e) => Math.abs(e.u - mu) < (u2 - u) / 2 && Math.abs(e.v - mv) < (v2 - v) / 2);
        if (ex) {
          if (ex.kind === "school") built += school(bx, bz, th) ? 1 : 0;
          if (ex.kind === "civic") built += civic(bx, bz, th) ? 1 : 0;
          if (ex.kind === "park") built += park(bx, bz, th, bw, bd) ? 1 : 0;
          continue;
        }
        if (!made.tower && towerAt && Math.abs(towerAt[0] - mu) < (u2 - u) / 2 && Math.abs(towerAt[1] - mv) < (v2 - v) / 2) {
          if (waterTower(bx, bz)) { made.tower = true; park(...F2.w(mu, mv + bd / 2 - 8), th, bw, 10); continue; }
        }
        const roll = rnd();
        // 区画の色の系統と、区画の中の地面(中庭の陰)。中心部は暖色、大通りの中層は明るく冷たく、周辺は混ぜる
        famNow = FAM[pick(onAve && r < 1.0 ? AVE : r < 0.55 ? INNER : OUTER)];
        const isAve = onAve && r < 1.0, isPark = !isAve && r < 0.55 && roll <= 0.1, isWare = !isAve && r >= 0.55 && !(r < 0.95 || roll < 0.65);
        if (!isPark && !isWare) {   // 公園・倉庫の区画には敷かない
          const pb = footprint(bx, bz, th, bw, bd, 0);
          if (pb !== null) part(C(r < 0.55 ? GROUND.inner : GROUND.outer), box(bw, 0.3, bd), bx, bz, th, pb, 0, 1.17, 0);   // 上面 = 最も低い所 + 0.12
        }
        if (onAve && r < 1.0) {
          // 大通り沿い: 通りに面して背の高い中層(6〜10 階)と 1 階の店、裏に低い棟と中庭
          const frontV = onAV1 ? vv1 - 8 : onAV0 ? vv0 + 8 : null, frontU = onAU1 ? uu1 - 8 : onAU0 ? uu0 + 8 : null;
          if (frontV !== null) {
            let lu = uu0; const flip = onAV0 ? Math.PI : 0;
            while (lu < uu1 - 16) {
              const tw = made.towers < towers && r < 0.6 && rnd() < 0.2, w = tw ? 18 + rnd() * 4 : Math.min(uu1 - lu, 20 + rnd() * 18);
              const fl = tw ? 13 + Math.floor(rnd() * 5) : r < 0.5 ? 8 + Math.floor(rnd() * 4) : 6 + Math.floor(rnd() * 3);   // 中心の大通りほど高い。数本は高い棟
              if (apartment(...F2.w(lu + w / 2, frontV), th + flip, w - 2.5, tw ? 16 : 14 + rnd() * 3, fl, { wing: !tw && rnd() < 0.4 })) { built++; if (tw) made.towers++; }
              lu += w;
            }
            const backV = onAV1 ? vv0 + 7 : vv1 - 7, back = bd > 44;
            if (back) { let lu2 = uu0; while (lu2 < uu1 - 16) { const w = Math.min(uu1 - lu2, 18 + rnd() * 12); built += apartment(...F2.w(lu2 + w / 2, backV), th + (onAV1 ? Math.PI : 0), w - 3, 11, 3 + Math.floor(rnd() * 2)) ? 1 : 0; lu2 += w; } }
            // 中庭: 表の棟の裏から、裏の棟の手前(なければ区画の端)まで
            const g0 = onAV1 ? (back ? vv0 + 13.5 : vv0 + 1) : vv0 + 17, g1 = onAV1 ? vv1 - 17 : (back ? vv1 - 13.5 : vv1 - 1);
            const [gx, gz] = F2.w(mu, (g0 + g1) / 2); courtGarden(gx, gz, th, bw - 6, g1 - g0);
          } else {
            let lv = vv0; const flip = onAU0 ? -Math.PI / 2 : Math.PI / 2;
            while (lv < vv1 - 16) {
              const tw = made.towers < towers && r < 0.6 && rnd() < 0.2, w = tw ? 18 + rnd() * 4 : Math.min(vv1 - lv, 20 + rnd() * 18);
              const fl = tw ? 13 + Math.floor(rnd() * 5) : r < 0.5 ? 8 + Math.floor(rnd() * 4) : 6 + Math.floor(rnd() * 3);
              if (apartment(...F2.w(frontU, lv + w / 2), th + flip, w - 2.5, tw ? 16 : 14 + rnd() * 3, fl, { wing: !tw && rnd() < 0.4 })) { built++; if (tw) made.towers++; }
              lv += w;
            }
            const backU = onAU1 ? uu0 + 7 : uu1 - 7, back = bw > 44;
            if (back) { let lv2 = vv0; while (lv2 < vv1 - 16) { const w = Math.min(vv1 - lv2, 18 + rnd() * 12); built += apartment(...F2.w(backU, lv2 + w / 2), th - flip, w - 3, 11, 3 + Math.floor(rnd() * 2)) ? 1 : 0; lv2 += w; } }
            const g0 = onAU1 ? (back ? uu0 + 13.5 : uu0 + 1) : uu0 + 17, g1 = onAU1 ? uu1 - 17 : (back ? uu1 - 13.5 : uu1 - 1);
            const [gx, gz] = F2.w((g0 + g1) / 2, mv); courtGarden(gx, gz, th + Math.PI / 2, bd - 6, g1 - g0);
          }
        } else if (r < 0.55 && roll > 0.1) {
          // 中心部: 表通り沿いに商店の並び、または区画の両側に集合住宅の棟(3〜5 階)を 2 列、間に中庭
          if (roll < 0.38) {
            built += shopRow(...F2.w(mu, vv1 - 6), th, bw - 2, 11, rnd() < 0.5 ? 3 : 2) ? 1 : 0;
            built += apartment(...F2.w(mu, vv0 + 8), th + Math.PI, bw - 4, 13, 3 + Math.floor(rnd() * 3)) ? 1 : 0;
            const [gx, gz] = F2.w(mu, mv + 1); courtGarden(gx, gz, th, bw - 6, bd - 32);
          } else {
            for (const [lv, flip] of [[vv0 + 8, Math.PI], [vv1 - 8, 0]]) {
              let lu = uu0; while (lu < uu1 - 16) { const w = Math.min(uu1 - lu, 18 + rnd() * 18); built += apartment(...F2.w(lu + w / 2, lv), th + flip, w - 3, 12 + rnd() * 3, 3 + Math.floor(rnd() * 3)) ? 1 : 0; lu += w; }
            }
            const [gx, gz] = F2.w(mu, mv); courtGarden(gx, gz, th, bw - 6, bd - 34);
          }
        } else if (r < 0.55) built += park(bx, bz, th, bw, bd) ? 1 : 0;
        else if (r < 0.95 || roll < 0.65) {
          // 周辺: 低層の住宅の宅地(大きさの違う区割り)
          for (const [lv, flip] of [[vv0 + 9, Math.PI], [vv1 - 9, 0]]) { let lu = uu0 + 2; while (lu < uu1 - 9) { const w = 9 + rnd() * 5; built += house(...F2.w(lu + w / 2, lv), th + flip, w, 9 + rnd() * 3) ? 1 : 0; lu += w + 1.5 + rnd() * 3; } }
          if (bd > 42) { const [gx, gz] = F2.w(mu, mv); for (let i = 0; i < 3; i++) treePos.push([gx + (rnd() - 0.5) * bw * 0.6, landH(gx, gz), gz + (rnd() - 0.5) * 6, 0.6 + rnd() * 0.3, 0]); }
        } else built += warehouse(bx, bz, th + (rnd() < 0.5 ? 0 : Math.PI), bw - 4, Math.min(bd - 2, 28)) ? 1 : 0;   // 外れ: 倉庫
      }
      famNow = null;
      return built;
    }

    const counts = {};
    // 大通りの交差点(0, 0 に近い u・v の線)の四隅に広場・役場・市場・文化会館を置く(区画の中心がその象限にあるもの)
    // 北東(su +1, sv -1)に広場、北西は広場へ向けて東向き、南東・南西は北向き(建物の正面は局所の +v。front は正面の回転)
    const quad = (kindNE, kindNW, kindSE, kindSW) => [{ su: 1, sv: -1, kind: kindNE }, { su: -1, sv: -1, kind: kindNW, front: Math.PI / 2 }, { su: 1, sv: 1, kind: kindSE, front: Math.PI }, { su: -1, sv: 1, kind: kindSW, front: Math.PI }].filter((e) => e.kind);
    counts.lakeside = town({ cx: -720, cz: 1400, th: 0, U0: -580, U1: 450, V0: -350, V1: 350, bu: 74, bv: 64, coreR: 420, towerAt: [-200, 0],
      extras: [{ u: -150, v: -110, kind: "school" }, { u: 160, v: 120, kind: "civic" }, { u: 60, v: -170, kind: "park" }],
      landmarks: quad("plaza", "hall", "market", "culture"), belts: [{ u: 360 }], towers: 4 });
    counts.north = town({ cx: -480, cz: -3150, th: 0, U0: -320, U1: 260, V0: -360, V1: 400, bu: 68, bv: 60, coreR: 320, towerAt: [-180, -220],
      extras: [{ u: -100, v: 170, kind: "school" }, { u: 30, v: -270, kind: "park" }], landmarks: quad("plaza", "hall", null, "market"), belts: [{ u: 200 }], towers: 3 });
    counts.small = town({ cx: -2250, cz: 2000, th: -0.0556, U0: -320, U1: 320, V0: -150, V1: 150, bu: 66, bv: 54, coreR: 220, towerAt: [-200, -100],
      extras: [{ u: 50, v: -75, kind: "civic" }], landmarks: quad("plaza", "market", null, null), towers: 1 });
    counts.village = town({ cx: 2795, cz: -2610, th: Math.atan2(0.733, 0.68), U0: -200, U1: 200, V0: -110, V1: 110, bu: 60, bv: 55, coreR: 120, towerAt: [-150, -80] });

    // ── 湖畔の街の水辺の遊歩道: 西の用水路の両岸(街の範囲の中)。敷石の帯、手すり、街灯、ベンチ、並木、売店 ──
    let promenade = 0;
    {
      const B = ctx.barrier, off = B.hw + 9, pts = drape(B.pts, 6);
      for (const sgn of [-1, 1]) {
        let cur = [];
        const flush = () => { if (cur.length > 4) { const d = cur.map(([x, z]) => [x, z]); add(strip(d, 10, 0.45), MAT.plaza, group, { edges: false }); promenade += cur.length * 6; } cur = []; };
        for (let i = 1; i < pts.length - 1; i++) {
          const [ax, az] = pts[i - 1], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, nx = (-(bz - az) / l) * sgn, nz = ((bx - ax) / l) * sgn;
          const [px, pz] = pts[i], x = px + nx * off, z = pz + nz * off;
          const inTown = x > -1360 && x < -160 && z > 1060 && z < 1840;
          if (!inTown || isWater(x, z) || nearSite(x, z, 20) || nearLine(x, z, 14) || landH(x, z) > 30) { flush(); continue; }
          cur.push([x, z]);
          const y = landH(x, z), ry = Math.atan2(bx - ax, bz - az);
          if (i % 1 === 0) push(MAT.rail, box(0.25, 1.4, 0.25), { x: x - nx * 4.6, y: y + 1.1, z: z - nz * 4.6 });                       // 手すりの柱
          push(MAT.rail, box(0.15, 0.15, 6.2), { x: x - nx * 4.6, y: y + 1.75, z: z - nz * 4.6, ry });                                   // 手すり
          if (i % 3 === 0) { push(MAT.mid, cyl(0.2, 6.5, 6), { x: x + nx * 3.8, y: y + 3.6, z: z + nz * 3.8 }); push(MAT.tankW, box(1.2, 0.5, 1.2), { x: x + nx * 3.8, y: y + 7, z: z + nz * 3.8 }); }   // 街灯
          if (i % 4 === 2) push(MAT.pergola, box(3.2, 0.5, 1), { x: x - nx * 2.6, y: y + 1.0, z: z - nz * 2.6, ry: ry + Math.PI / 2 });   // ベンチ
          if (i % 2 === 0) { const tx = x + nx * 8.5, tz = z + nz * 8.5; if (okPt(tx, tz, 10)) treePos.push([tx, landH(tx, tz), tz, 0.7 + rnd() * 0.3, i % 6 === 0 ? 1 : 0]); }
          if (i % 40 === 20) {   // 売店と日よけの傘
            const kx = x + nx * 9, kz = z + nz * 9, ky = landH(kx, kz);
            if (okPt(kx, kz, 10)) {
              push(MAT.kiosk, box(6, 3.4, 4.5), { x: kx, y: ky + 1.7, z: kz, ry }); push(MAT.awn4, box(7.4, 0.3, 6), { x: kx, y: ky + 3.6, z: kz, ry });
              for (let j = -1; j <= 1; j++) { const ux = kx - nx * 6 + Math.sin(ry) * j * 5, uz = kz - nz * 6 + Math.cos(ry) * j * 5; push(MAT.mid, cyl(0.12, 2.6, 5), { x: ux, y: ky + 1.3, z: uz }); push(pick([MAT.awn1, MAT.awn2, MAT.awn5]), new THREE.ConeGeometry(1.8, 0.7, 8), { x: ux, y: ky + 2.8, z: uz }); }
            }
          }
        }
        flush();
      }
    }

    // 街路: 歩道(明るい帯)の上に車道、車道の中央に破線。大通りは幅広で、中央分離帯(芝)に並木
    const drawStreets = (pieces, walkW, roadW, avenue) => {
      for (const pc of pieces) {
        const d = drape(pc, 8);
        add(strip(d, walkW, 0.35), MAT.walk, group, { edges: false });
        add(strip(d, roadW, 0.5), avenue ? MAT.avenue : MAT.street, group, { edges: false });
        if (avenue) add(strip(d, 3.6, 0.62), MAT.lawn, group, { edges: false });
        for (let i = 2; i < d.length - 1; i += 2) {
          const [ax, az] = d[i - 1], [bx, bz] = d[i], ry = Math.atan2(bx - ax, bz - az), l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l, nz = (bx - ax) / l;
          if (avenue) for (const s of [-1, 1]) dashParts.push([box(0.4, 0.1, 3.2), { x: (ax + bx) / 2 + s * nx * 5.2, y: landH((ax + bx) / 2, (az + bz) / 2) + 0.62, z: (az + bz) / 2 + s * nz * 5.2, ry }]);
          else dashParts.push([box(0.5, 0.1, 3.2), { x: (ax + bx) / 2, y: landH((ax + bx) / 2, (az + bz) / 2) + 0.62, z: (az + bz) / 2, ry }]);
        }
        // 街路樹(両側の歩道、大通りは中央分離帯にも)
        for (let i = 1; i < d.length - 1; i += avenue ? 1 : 2) {
          if (rnd() < (avenue ? 0.05 : 0.35)) continue;
          const [ax, az] = d[i - 1], [bx, bz] = d[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / l, nz = (bx - ax) / l, [x, z] = d[i];
          for (const s of [-1, 1]) { const o = walkW / 2 - 1.8, tx = x + s * nx * o, tz = z + s * nz * o; if (okPt(tx, tz, 12)) treePos.push([tx, landH(tx, tz), tz, (avenue ? 0.66 : 0.45) + rnd() * 0.2, 0]); }
          if (avenue && i % 2 === 1) treePos.push([x, landH(x, z) + 0.6, z, 0.55 + rnd() * 0.15, 1]);   // 中央分離帯は細い木
        }
      }
    };
    drawStreets(streetPieces, 13, 7.5, false);
    drawStreets(avenuePieces, 24, 15, true);
    if (dashParts.length) add(U.merge(THREE, dashParts), MAT.path, group, { edges: false });

    // 建物の部品を材質ごとにまとめる(輪郭線は建物の面だけ)
    const noEdge = new Set([MAT.glass, MAT.yard, MAT.park, MAT.lawn, MAT.path, MAT.court, MAT.pool, MAT.win, MAT.winD, MAT.plaza2, MAT.plant, MAT.solar, MAT.tankW, MAT.rail, MAT.clockF, MAT.clock, MAT.pergola, ...ROOFS, ...roofMats, C(GROUND.inner), C(GROUND.outer)]);
    let nParts = 0;
    for (const [mat, list] of parts) { nParts += list.length; add(U.merge(THREE, list), mat, group, { edges: !noEdge.has(mat) }); }

    // 木(InstancedMesh 2 種): 丸い樹冠(2 段の多面体)と細い樹(円錐)。1 本ずつ色を少し変える
    const trunk = cyl(0.35, 4, 5).translate(0, 2, 0).toNonIndexed();
    const roundG = U.concat(THREE, [{ geo: trunk, color: new THREE.Color(0x8b7d6b) },
      { geo: new THREE.IcosahedronGeometry(3.2, 1).translate(0, 5.6, 0), color: new THREE.Color(0x8fa486) },
      { geo: new THREE.IcosahedronGeometry(2.3, 1).translate(0.8, 7.6, 0.4), color: new THREE.Color(0x9db191) }]);
    const slimG = U.concat(THREE, [{ geo: trunk, color: new THREE.Color(0x8b7d6b) },
      { geo: new THREE.ConeGeometry(2.2, 9, 7).translate(0, 7.5, 0).toNonIndexed(), color: new THREE.Color(0x86997c) }]);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), tc = new THREE.Color();
    const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const [g, kind] of [[roundG, 0], [slimG, 1]]) {
      const list = treePos.filter((t) => t[4] === kind);
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(g, treeMat, list.length);
      list.forEach(([x, y, z, s], i) => { mt.compose(p.set(x, y, z), q.setFromAxisAngle(up, rnd() * 6.28), sc.set(s * 2, s * 2 * (0.9 + rnd() * 0.2), s * 2)); im.setMatrixAt(i, mt); im.setColorAt(i, tc.setRGB(0.9 + rnd() * 0.12, 0.92 + rnd() * 0.12, 0.88 + rnd() * 0.12)); });
      group.add(im);
    }

    U.bake(THREE, group, {});
    return { group, counts: { ...counts, families: matCache.size, parts: nParts, streets: streetPieces.length, avenues: avenuePieces.length, promenade: Math.round(promenade), trees: treePos.length } };
  }

  DreamAssets.maps.deco("towns", towns);
})();
