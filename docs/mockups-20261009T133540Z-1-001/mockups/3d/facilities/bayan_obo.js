// 戦略施設トークン「白雲鄂博(バヤン・オボ)鉱山」(中国・内モンゴル、世界最大級のレアアース鉱山)の詳細版モデル(試作)。
// 主鉱体の露天掘り(楕円 960 × 640 m)と周りを切り出し、メートルで組んで K 倍する。8 段の階段状の壁、らせんの運搬路、底の排水池、
// 縁の一次破砕場とベルトコンベアの架台、鉄道の積込みサイロと線路、鉱石の山、段々の捨石の山。
// 象徴(「階段状の露天掘りの穴」)を誇張: 段の高さ 1.5 倍(15 → 22.5 m、深さ 180 m)。平面(楕円・段の幅・運搬路の幅)は実寸。
// 省略: 有人のダンプ・重機・人(小さすぎる)。
// 近未来化(施設リストの案): 無人採掘車両が稼働する自動化鉱山。運転席のない無人ダンプ 6 台(1.6 倍)が運搬路を上り下りし、
// 縁に遠隔運転センター、通信の鉄塔(固定のアンテナ)、無人ダンプの充電所。
//
// 状態: "current"(現在)/ "future"(自動化。無人ダンプが走る)
(function () {
  const K = 0.15;
  const D = {
    base: -195, xh: 650, zh: 450,
    cx: -110, cz: -20, a: 480, b: 320,      // 掘削の縁の楕円(中心と半径)
    n: 8, h: 22.5, run: 7, bench: 26,       // 段の数、段の高さ(15 m の 1.5 倍)、法面の水平長、段の幅
    th0: 0.05, dth: 0.55, road: 30,         // 運搬路: 始まりの角度、1 段下るごとの角度、幅
    trucks: 6, truckS: 1.6, lane: 7.5, speed: 22,   // 無人ダンプ: 台数、誇張の倍率、車線の中心(道の中心から)、速さ(m/s、試作)
  };
  D.d = D.run + D.bench;

  function build(THREE, opts = {}) {
    const U = DreamAssets.util, F = DreamAssets.fac;
    const M = F.mats(THREE);
    M.rock = M.lambert(0xd2cbc0); M.spoil = M.lambert(0xc6beb1); M.ore = M.lambert(0x9b938a);
    const group = new THREE.Group(); group.name = "bayan_obo";
    const world = new THREE.Group(); world.scale.setScalar(K); world.position.set(0, -D.base * K, 0); group.add(world);
    const { add, box, cyl, V, tube, beam, closedLoft, prism, waterShape, water, lattice } = F.kit(THREE, M, K);
    const lathe = (pts, n = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), n);
    const N = 96, TH = (k) => (k / N) * Math.PI * 2;
    const P = (th, e, y) => V(D.cx + (D.a - e) * Math.cos(th), y, D.cz + (D.b - e) * Math.sin(th));   // 縁から e だけ内側の楕円上の点

    // ── 台座: 楕円の穴のあいた陸 ──
    const rim = Array.from({ length: N }, (_, k) => [D.cx + D.a * Math.cos(TH(k)), D.cz + D.b * Math.sin(TH(k))]);
    const c = 30, outline = [[-D.xh + c, -D.zh], [D.xh - c, -D.zh], [D.xh, -D.zh + c], [D.xh, D.zh - c], [D.xh - c, D.zh], [-D.xh + c, D.zh], [-D.xh, D.zh - c], [-D.xh, -D.zh + c]];
    add(prism(outline, D.base, 0, [rim]), M.land, world);
    const pl = U.slab(THREE, D.xh + 3, D.zh + 3, c + 1.2, 1.2); pl.translate(0, D.base, 0); add(pl, M.dark, world, { edges: false });
    for (const [y, t, m] of [[-40, 14, M.spoil], [-95, 22, M.rock], [-150, 10, M.ore]]) {   // 台座の側面の地層の帯(断面の見え方)
      const o = outline.map(([x, z]) => [x + Math.sign(x) * 0.4, z + Math.sign(z) * 0.4]);   // 穴の外だけ(穴の中には出さない)
      add(prism(o, y - t / 2, y + t / 2, [rim]), m, world, { edges: false });
    }

    // ── 露天掘りの穴: 縁から順に「法面の上 → 法面の下 → 段の内側」の輪をつないだ面(上・内向き) ──
    const rings = [];
    for (let i = 0; i < D.n; i++) { rings.push([i * D.d, -i * D.h]); rings.push([i * D.d + D.run, -(i + 1) * D.h]); }
    const eFloor = (D.n - 1) * D.d + D.run;
    const pos = [], va = V(0, 0, 0), vb = V(0, 0, 0), vn = V(0, 0, 0);
    const orient = (out, p, q, r, cx, cz, sign) => {   // 面を上 + 中心へ(sign = 1: 穴)/ 中心から外へ(sign = -1: 山)向ける
      va.subVectors(q, p); vb.subVectors(r, p); vn.crossVectors(va, vb);
      const ref = V(sign * (cx - p.x), 0, sign * (cz - p.z)).normalize().add(V(0, 1, 0));
      if (vn.dot(ref) < 0) [q, r] = [r, q];
      out.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    };
    const tri = (p, q, r) => orient(pos, p, q, r, D.cx, D.cz, 1);
    for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < N; k++) {
      const [e0, y0] = rings[j], [e1, y1] = rings[j + 1];
      const o0 = P(TH(k), e0, y0), o1 = P(TH(k + 1), e0, y0), i0 = P(TH(k), e1, y1), i1 = P(TH(k + 1), e1, y1);
      tri(o0, o1, i1); tri(o0, i1, i0);   // j が偶数なら法面、奇数なら段の床(法面の下 → 次の法面の上)
    }
    const pitG = new THREE.BufferGeometry(); pitG.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); pitG.computeVertexNormals();
    add(pitG, M.rock, world);
    const floorPts = Array.from({ length: N }, (_, k) => { const p = P(TH(k), eFloor, 0); return [p.x, p.z]; });
    const yFloor = -D.n * D.h;
    add(prism(floorPts, yFloor - 2, yFloor), M.rock, world);   // 底
    const sump = Array.from({ length: 40 }, (_, k) => [D.cx - 120 + 60 * Math.cos((k / 40) * Math.PI * 2), D.cz + 18 * Math.sin((k / 40) * Math.PI * 2)]);
    const sw = waterShape(sump, water({ opacity: 0.5 })); sw.position.y = yFloor + 0.3; world.add(sw);   // 排水池
    add(box(4, 3, 4), M.dark, world, { x: D.cx - 182, y: yFloor + 1.5, z: D.cz });                         // 排水ポンプ

    // ── 運搬路(らせん): 段 i の床の中央から段 i+1 の床の中央へ、角度を進めながら下る。下は次の段の床まで盛土 ──
    const eMid = (i) => (i === 0 ? -D.road / 2 - 4 : (i - 1) * D.d + D.run + D.bench / 2);
    const path = [];   // 運搬路の中心線(無人ダンプの経路)
    for (let i = 0; i < D.n; i++) {
      const segRings = [], S = 12;
      for (let s = 0; s <= S; s++) {
        const t = s / S, th = D.th0 + (i + t) * D.dth, e = eMid(i) + (eMid(i + 1) - eMid(i)) * t, y = -(i + t) * D.h + 0.6;
        const yb = -(i + 1) * D.h;
        segRings.push([P(th, e - D.road / 2, y), P(th, e + D.road / 2, y), P(th, e + D.road / 2, Math.min(yb, y - 1)), P(th, e - D.road / 2, Math.min(yb, y - 1))]);
        if (!(i > 0 && s === 0)) path.push({ th, e, y });
      }
      add(closedLoft(segRings), M.light, world);
    }
    // 縁の外の取付け道路(破砕場へ)
    const pr = P(D.th0, eMid(0), 0.3);
    add(box(50, 0.6, D.road), M.light, world, { x: pr.x + 25, y: 0.3, z: pr.z });

    // ── 縁の設備: 一次破砕場、ベルトコンベアの架台、鉄道の積込みサイロ、線路、鉱石の山 ──
    add(box(46, 30, 34), M.body, world, { x: 470, y: 15, z: -20 });
    add(box(46.4, 2, 34.4), M.dark, world, { x: 470, y: 24, z: -20, edges: false });
    add(box(14, 10, 26), M.light, world, { x: 440, y: 5, z: -20 });   // ダンプの受け口(ホッパー)
    const conv = (p, q) => { beam(world, p, q, 5, M.light); const n = Math.floor(p.distanceTo(q) / 30); for (let k = 1; k < n; k++) { const m = p.clone().lerp(q, k / n); beam(world, V(m.x, 0, m.z), V(m.x, m.y - 2.5, m.z), 1.6, M.mid); } };
    conv(V(490, 26, -20), V(560, 42, -150)); conv(V(470, 12, 0), V(520, 18, 110));
    add(lathe([[14, 0], [14, 30], [10, 38], [3, 40], [0, 40]], 16), M.body, world, { x: 560, y: 14, z: -150 });   // 積込みサイロ(脚の上)
    for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) beam(world, V(560 + x, 0, -150 + z), V(560 + x, 14, -150 + z), 2, M.mid);
    for (const x of [560, 580]) for (const e of [-0.9, 0.9]) add(box(0.4, 0.4, 2 * D.zh - 50), M.dark, world, { x: x + e, y: 0.4, z: 0, edges: false });   // 線路
    for (const x of [560, 580]) add(box(4.6, 0.2, 2 * D.zh - 50), M.mid, world, { x, y: 0.1, z: 0, edges: false });
    add(lathe([[40, 0], [0, 24]], 20), M.ore, world, { x: 480, y: 0, z: 150 });   // 鉱石の山
    add(lathe([[30, 0], [0, 18]], 20), M.ore, world, { x: 430, y: 0, z: 220 });

    // ── 捨石の山(3 段の平らな頂)──
    const dump = (cx, cz, a, b, tiers) => {
      const rr = [];
      for (let t = 0; t <= tiers; t++) { const y = t * 18, sh = t * 22; rr.push([sh, y]); if (t < tiers) rr.push([sh + 14, y + 18]); }
      const ringsD = rr.map(([sh, y]) => Array.from({ length: 48 }, (_, k) => { const th = (k / 48) * Math.PI * 2; return V(cx + (a - sh) * Math.cos(th), y, cz + (b - sh) * Math.sin(th)); }));
      const posD = [];
      for (let j = 0; j < ringsD.length - 1; j++) for (let k = 0; k < 48; k++) {
        const o0 = ringsD[j][k], o1 = ringsD[j][(k + 1) % 48], i0 = ringsD[j + 1][k], i1 = ringsD[j + 1][(k + 1) % 48];
        orient(posD, o0, i1, o1, cx, cz, -1); orient(posD, o0, i0, i1, cx, cz, -1);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(posD, 3)); g.computeVertexNormals();
      add(g, M.spoil, world);
      const top = ringsD[ringsD.length - 1].map((p) => [p.x, p.z]); add(prism(top, rr[rr.length - 1][1] - 1, rr[rr.length - 1][1]), M.spoil, world);
    };
    dump(-210, 392, 300, 52, 1); dump(-570, 250, 70, 100, 2);

    // ── 近未来化: 遠隔運転センター、通信の鉄塔、充電所、無人ダンプ ──
    const future = new THREE.Group(); world.add(future);
    add(box(60, 12, 26), M.body, future, { x: 520, y: 6, z: 320 });
    add(box(60.4, 2.4, 26.4), M.glass, future, { x: 520, y: 8, z: 320, edges: false });
    add(box(61, 1, 27), M.accent, future, { x: 520, y: 12.5, z: 320, edges: false });
    for (const [x, z] of [[600, 360], [420, -300], [-300, 330], [-600, -60]]) {
      lattice(future, V(x, 0, z), 40, 3.5, 1.0, 4, 0.3, M.mid);
      for (const e of [0, 2.1, 4.2]) add(box(1.0, 4, 0.5), M.body, future, { x: x + Math.sin(e) * 1.6, y: 37, z: z + Math.cos(e) * 1.6, ry: e });   // 固定のパネルアンテナ
      add(box(3, 0.6, 3), M.accent, future, { x, y: 40.3, z, edges: false });
    }
    for (let i = 0; i < 4; i++) {   // 充電所(屋根つきの区画)
      const x = 380 + i * 34, z = 300;
      add(box(26, 0.3, 40), M.mid, future, { x, y: 0.15, z, edges: false });
      for (const e of [-1, 1]) beam(future, V(x + e * 12, 0, z - 18), V(x + e * 12, 18, z - 18), 1.4, M.light);
      add(box(28, 1.2, 12), M.light, future, { x, y: 18.6, z: z - 18 });
      add(box(4, 6, 3), M.dark, future, { x, y: 3, z: z - 20 });
    }
    // 無人ダンプ(運転席のない形。1.6 倍)。運搬路を上り下りする
    const fleet = new THREE.Group(); world.add(fleet);
    const S = D.truckS, trucks = [];
    const wheel = cyl(1.7 * S, 1.3 * S, 12); wheel.rotateZ(Math.PI / 2);
    for (let i = 0; i < D.trucks; i++) {
      const g = new THREE.Group(); fleet.add(g); trucks.push(g);
      add(box(5 * S, 1.6 * S, 11 * S), M.dark, g, { y: 2.6 * S });                       // 車台
      add(box(8 * S, 3.4 * S, 9 * S), M.body, g, { y: 5.1 * S, z: -1.2 * S });            // 荷台
      add(box(8 * S, 0.6 * S, 3 * S), M.body, g, { y: 6.5 * S, z: 4.6 * S });             // 荷台の庇
      add(box(7 * S, 2.6 * S, 2.6 * S), M.mid, g, { y: 3.6 * S, z: 4.4 * S });            // 動力部(運転席はない)
      for (const sx of [-1, 1]) add(box(0.8 * S, 0.6 * S, 0.3 * S), M.glass, g, { x: sx * 3 * S, y: 4.4 * S, z: 5.8 * S, edges: false });   // センサー
      for (const [x, z] of [[-3.2, 4], [3.2, 4], [-3.2, -4], [3.2, -4], [-1.9, -4], [1.9, -4]]) add(wheel, M.dark, g, { x: x * S, y: 1.7 * S, z: z * S, edges: false });
    }
    // 経路の長さ
    const pts = path.map(({ th, e, y }) => ({ th, e, y })), cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + P(pts[k].th, pts[k].e, pts[k].y).distanceTo(P(pts[k - 1].th, pts[k - 1].e, pts[k - 1].y)));
    const L = cum[cum.length - 1];
    const at_ = (u, lane) => {   // 経路の距離 u の位置と、進む向きの点
      let k = 1; while (k < cum.length - 1 && cum[k] < u) k++;
      const t = (u - cum[k - 1]) / (cum[k] - cum[k - 1]), A = pts[k - 1], B = pts[k];
      const th = A.th + (B.th - A.th) * t, e = A.e + (B.e - A.e) * t + lane, y = A.y + (B.y - A.y) * t;
      return P(th, e, y);
    };
    let clock = 0;
    const placeTrucks = () => {
      trucks.forEach((g, i) => {
        const ph = ((clock * D.speed) / L + i / D.trucks) % 2, down = ph < 1, u = (down ? ph : 2 - ph) * L * 0.98 + L * 0.01;
        const lane = down ? D.lane : -D.lane, p = at_(u, lane), q = at_(Math.min(L, Math.max(0, u + (down ? 4 : -4))), lane);
        const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
        g.position.copy(p); g.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, "YXZ");
      });
      baked?.sync();
    };
    let baked = null;
    placeTrucks();

    const { ring, disc } = U.zone(THREE, group, opts.r ?? 118, M.ring, M.disc);
    let state = opts.state ?? "future";
    const apply = () => { future.visible = fleet.visible = state === "future"; };
    baked = U.bake(THREE, group, { dynamic: [future, fleet], live: [M.accent], instanced: [{ groups: trucks }] });
    apply();
    const at = (x, y, z) => V(x * K, (y - D.base) * K, z * K);
    return {
      group, setTeam: (c) => F.setTeam(M, c), stats: () => U.stats(group), parts: { ring, disc }, at,
      update(dt) { if (state === "future") { clock += dt; placeTrucks(); } ring.material.dashOffset = (ring.material.dashOffset ?? 0) - dt * 8; },
      setState(s) { state = s; apply(); }, get state() { return state; },
      check: () => ({
        depth_m: D.n * D.h, floorSemiAxes_m: [D.a - eFloor, D.b - eFloor],             // 穴の深さ、底の楕円の半径
        rampWidthOnBench_m: D.bench - D.road,                                            // 段の幅 − 道幅(負 = 道の外側半分は盛土で法面にかかる)
        passingGap_m: +(2 * D.lane - 8 * S).toFixed(2),                                  // すれ違う 2 台の隙間(車線の中心間 − 車幅 8 m × 誇張)
        laneToRoadEdge_m: +(D.road / 2 - D.lane - 4 * S).toFixed(2),                     // 車体の外側と道の端
        rimToEdge_m: Math.min(D.xh - (D.cx + D.a), D.zh - (D.cz + D.b)),                 // 縁と台座の端
        pathLength_m: Math.round(L),
      }),
      shots: {
        pit: { label: "階段状の壁と運搬路", target: [-110, -120, -20], pos: [280, 120, 380] },
        crusher: { label: "破砕場・コンベア", target: [500, 20, -60], pos: [300, 140, 160] },
        fleet: { label: "無人ダンプ(近未来化)", target: [-60, -110, 40], pos: [150, 10, 260] },
      },
    };
  }

  DreamAssets.fac.register("bayan_obo", {
    section: 6, title: "バヤン・オボ鉱山", kind: "STRATEGIC FACILITY · 6 情報・通信・産業",
    desc: "世界最大級のレアアース鉱山。段々に掘り下げた巨大な露天掘りの穴と、らせんの運搬路、縁の破砕場とベルトコンベア、鉄道の積込み。無人ダンプが走る自動化鉱山の近未来版",
    info: [["ファイル", "mockups/3d/facilities/bayan_obo.js"], ["大きさ", "1300 × 900 m を 0.15 倍 × 表示 3.0"], ["誇張", "段の高さ 1.5 倍(深さ 180 m)、無人ダンプ 1.6 倍。平面は実寸"], ["省略", "有人のダンプ・重機・人"], ["近未来化", "無人ダンプ 6 台(運搬路を上り下り)、遠隔運転センター、通信の鉄塔、充電所"]],
    dist: 1200, target: 10, tokenAt: [440, 0, 360],
    make: (THREE) => build(THREE, { r: 118 }),
    actLabel: "STATE · 状態", progress: false,
    actions: (a) => [["現在", () => a.setState("current"), () => a.state === "current"], ["自動化(近未来)", () => a.setState("future"), () => a.state === "future"]],
    caption: () => "",
  });
})();
