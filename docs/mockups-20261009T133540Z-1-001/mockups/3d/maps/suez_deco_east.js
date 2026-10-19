// マップ「運河地帯」の装飾の層「東」: 東の砂漠と崖の尾根(x > 約 900、運河地帯の外)。
// 崖: 地層の段(9 単位ごと)に沿う岩の棚、尾根の上と麓の岩塊、西の急な面の麓の崖錐(がれ)、尾根の東に散るメサ状の岩山。
// 砂丘: 斜面に沿う風紋の帯(半透明の陰と明るい縁を地形に重ねる)、滑落面の稜線、まばらな低木(タマリスク)とアカシア(涸れ川に多い)。
// 目印: 風で削られたヤルダン(流線形の土の丘)の群れ、干上がった塩の窪地(ひび割れの網目)、壁に囲まれた使われていない前哨基地。
// 峠: 道路・線路の切り通しの擁壁、石積み、ケルンと標柱。
// 砂漠の痕跡: 轍の道、古い土塁と塹壕の線、石造りの廃墟、高い所の格子の通信塔(固定のパネルアンテナ)。人・車両は置かない。地名は付けない。
// 縮尺は拠点と同じ約 0.6 単位/m。岩・低木・岩塊は読めるよう最大 2 倍に誇張。すべて地形の高さ(ctx.landH)に置き、斜面では根元を沈める。
//
//   DreamAssets.maps.deco("east", (THREE, ctx) => ({ group }))   // suez.js の decoCtx を受け取る
(function () {
  function east(THREE, ctx) {
    const { U, M, k, landH, isWater, ridgeBand, ridgeX, passOpen, passes, wadis, nearSite, nearLine, fbm, hash2, lineDist, segDist, smooth, drape, strip, roads, rail, HALF, BED, lake, barrier } = ctx;
    const group = new THREE.Group(); group.name = "deco-east";
    const rnd = ctx.rng(4242);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
    const MAT = {
      rock: lam(0xbdb19b, { flatShading: true }), rock2: lam(0xa39782, { flatShading: true }), rock3: lam(0xcabda5, { flatShading: true }),
      sandHi: lam(0xf3ede0), sandLo: lam(0xddd3bd), crest: lam(0xefe8d8, { flatShading: true }),
      shrub: lam(0xa3a98f, { flatShading: true }), shrub2: lam(0x939a80, { flatShading: true }),
      stone: lam(0xd8cebb), wall: lam(0xcfc6b4), track: lam(0xd4c9af), trench: lam(0x8e846f), berm: lam(0xddd3bf), mast: lam(0x8f98a3), hut: lam(0xe9edf1),
    };
    const { add, box, cyl } = k;

    // ── 置ける場所: 東の砂漠、地図の内側、拠点・首都・道路・線路・水の外 ──
    const wet = (x, z, r) => isWater(x, z) || isWater(x + r, z) || isWater(x - r, z) || isWater(x, z + r) || isWater(x, z - r);
    const ok0 = (x, z, pad = 0) => x > 920 + pad && Math.abs(x) < HALF - 15 - pad && Math.abs(z) < HALF - 15 - pad && !nearSite(x, z, pad + 20) && !nearLine(x, z, pad + 16) && !wet(x, z, pad + 14);
    const grad = (x, z) => [(landH(x + 4, z) - landH(x - 4, z)) / 8, (landH(x, z + 4) - landH(x, z - 4)) / 8];
    const wadiDist = (x, z) => Math.min(...wadis.map((w) => lineDist(x, z, w)));
    // 地形の格子の実際の高さ(suez.js の地形と同じ式と三角形の補間)。地面に貼る板・帯はこれに合わせる(landH は格子の間で少しずれる)
    const CH = DreamAssets.maps.suez.CHANNELS, GS = 12.5;
    const waterSD = (x, z) => {
      let d = Infinity;
      for (const c of CH) { if (c.name === "東の分水路" && x < c.a[0] - 10) continue; d = Math.min(d, segDist(x, z, c.a, c.b) - c.hw); }
      d = Math.min(d, (Math.hypot((x - lake.cx) / lake.rx, (z - lake.cz) / lake.rz) - 1) * lake.rz);
      return Math.min(d, lineDist(x, z, barrier.pts) - barrier.hw);
    };
    const surf = (x, z) => { const d = waterSD(x, z); return d < -14 ? BED : BED + (Math.max(0.5, landH(x, z)) - BED) * smooth(-14, 6, d); };
    const GN = (2 * HALF) / GS + 1, hcache = new Float32Array(GN * GN).fill(NaN);
    const gv = (i, j) => { const q = j * GN + i; let v = hcache[q]; if (v !== v) v = hcache[q] = surf(-HALF + i * GS, -HALF + j * GS); return v; };
    const H = (x, z) => {
      const fx0 = (x + HALF) / GS, fz0 = (z + HALF) / GS, i = Math.max(0, Math.min(GN - 2, Math.floor(fx0))), j = Math.max(0, Math.min(GN - 2, Math.floor(fz0))), fx = fx0 - i, fz = fz0 - j;
      const a = gv(i, j), b = gv(i + 1, j), c = gv(i, j + 1), d = gv(i + 1, j + 1);
      return fx + fz < 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
    };
    // 地面に貼る面の三角形を上向きにそろえる(pos は 9 個ずつの平らな配列)
    const faceUp = (pos, stride = 3) => {
      for (let i = 0; i < pos.length; i += 3 * stride) {
        const e1x = pos[i + stride] - pos[i], e1z = pos[i + stride + 2] - pos[i + 2], e2x = pos[i + 2 * stride] - pos[i], e2z = pos[i + 2 * stride + 2] - pos[i + 2];
        if (e1z * e2x - e1x * e2z < 0) for (let c = 0; c < stride; c++) { const t = pos[i + stride + c]; pos[i + stride + c] = pos[i + 2 * stride + c]; pos[i + 2 * stride + c] = t; }
      }
    };

    // ── 目印の場所(塩の窪地・ヤルダンの群れ・前哨基地)を先に決め、ほかの装飾はその範囲を避ける ──
    const RES = [];   // [x, z, r]
    const inRes = (x, z, pad) => RES.some(([rx, rz, r]) => Math.hypot(x - rx, z - rz) < r + pad);
    const flatAt = (x, z, r, maxG) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r * 0.7, r * 0.7], [-r * 0.7, -r * 0.7], [r * 0.7, -r * 0.7], [-r * 0.7, r * 0.7]].every(([dx, dz]) => { const [gx, gz] = grad(x + dx, z + dz); return Math.hypot(gx, gz) < maxG; });
    const findSpot = (gen, r, maxG, tries = 4000) => { for (let t = 0; t < tries; t++) { const [x, z] = gen(); if (ok0(x, z, r) && ridgeBand(x, z) < 0.05 && !inRes(x, z, r) && flatAt(x, z, r * 0.7, maxG)) return [x, z]; } return null; };
    let PAN = null;
    for (const mg of [0.045, 0.06, 0.08, 0.1]) { PAN = findSpot(() => [1000 + rnd() * 2850, -3500 + rnd() * 7000], 150, mg, 2500); if (PAN) break; }   // できるだけ平らな所
    if (PAN) RES.push([PAN[0], PAN[1], 215]);   // 縁の湿った帯(最大で長径の約 1.45 倍)まで
    const YARD = [];
    for (let f = 0; f < 3; f++) { const sp = findSpot(() => [2600 + rnd() * 1250, -3600 + rnd() * 7200], 175, 0.09); if (sp) { YARD.push(sp); RES.push([sp[0], sp[1], 175]); } }
    const OUT = findSpot(() => { const pz = passes[1 + Math.floor(rnd() * 2)][0], z = pz + (rnd() - 0.5) * 520; return [ridgeX(z) + 300 + rnd() * 300, z]; }, 72, 0.08);
    if (OUT) RES.push([OUT[0], OUT[1], 72]);
    const ok = (x, z, pad = 0) => ok0(x, z, pad) && !inRes(x, z, pad);

    // ── InstancedMesh(位置・大きさ・向き)。向きは YXZ(方位 → 傾き) ──
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, "YXZ"), sv = V(1, 1, 1), pv = V(0, 0, 0);
    const instanced = (geo, mat, list) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      const col = new THREE.Color();
      list.forEach((it, i) => { e.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0, "YXZ"); q.setFromEuler(e); m4.compose(pv.set(it.x, it.y, it.z), q, sv.set(it.sx, it.sy ?? it.sx, it.sz ?? it.sx)); im.setMatrixAt(i, m4); if (it.c !== undefined) im.setColorAt(i, col.set(it.c)); });
      im.computeBoundingSphere(); group.add(im); return im;
    };
    // 岩の形(二十面体を頂点の向きで決まる量だけ膨らませる。重なる頂点は同じ量なので割れない)
    const rockGeo = (seed, flat) => {
      const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, v = V(0, 0, 0);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).normalize();
        const n = 0.72 + 0.5 * hash2(Math.round(v.x * 997) + seed * 31, Math.round(v.y * 991 + v.z * 983) - seed * 17);
        p.setXYZ(i, v.x * n, v.y * n * flat, v.z * n);
      }
      g.computeVertexNormals(); return g;
    };
    const ROCKS = [rockGeo(1, 0.75), rockGeo(2, 0.6), rockGeo(3, 0.9)];
    const rockLists = [[], [], []], rockMat = [MAT.rock, MAT.rock2, MAT.rock3];
    const pushRock = (x, z, r, flatSink = 0.35) => { const v = Math.floor(rnd() * 3); rockLists[v].push({ x, y: landH(x, z) - r * flatSink, z, sx: r * (0.8 + rnd() * 0.5), sy: r, sz: r * (0.8 + rnd() * 0.5), ry: rnd() * 6.28, rx: (rnd() - 0.5) * 0.4 }); };

    // ── 崖: 地層の段に沿う不ぞろいな岩塊(崩れた箱。上面がわずかに張り出し、縦の面は暗い)、隙間、落ちた岩塊 ──
    // 岩塊の形: 分割した箱の頂点を決まった量だけずらし、上の縁を前(+z)へ張り出させる。面ごとの頂点色で縦の面を暗く
    const blockGeo = (seed, strong = false) => {
      const g = new THREE.BoxGeometry(1, 1, 1, 3, 2, 2).toNonIndexed(), p = g.attributes.position, v = V(0, 0, 0);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const kx = Math.round(v.x * 6), ky = Math.round(v.y * 4), kz = Math.round(v.z * 4), j = (a) => hash2(kx * 13 + ky * 7 + kz * 3 + seed * 101, a) - 0.5;
        const over = v.y > 0.2 ? 0.14 : 0;                                       // 上の縁の張り出し
        p.setXYZ(i, v.x + j(1) * 0.22, v.y + j(2) * 0.2, v.z + j(3) * 0.24 + over * (v.z > 0 ? 1 : 0));
      }
      g.computeVertexNormals();
      const n = g.attributes.normal, c = new Float32Array(p.count * 3), a = V(0, 0, 0), b = V(0, 0, 0), cc = V(0, 0, 0);
      for (let i = 0; i < p.count; i += 3) {   // 面の法線で塗り分け(上面は明るく、縦の面は暗く)
        a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1).sub(a); cc.fromBufferAttribute(p, i + 2).sub(a); b.cross(cc).normalize();
        const t = strong ? (b.y > 0.55 ? 1.26 : b.y < -0.3 ? 0.32 : b.y > 0.2 ? 0.9 : 0.44)    // 大きな岩塊: 上面と縦の面の差を強く(ゲーム視点で段の縞が読める)
          : (b.y > 0.55 ? 1.14 : b.y < -0.3 ? 0.4 : b.y > 0.2 ? 0.86 : 0.54);   // 上面は明るく、縦の面は影で暗く(遠目にも崖の段が縞で読める)
        for (let k2 = 0; k2 < 3; k2++) { c.set([t, t * 0.975, t * 0.93], (i + k2) * 3); b.toArray(n.array, (i + k2) * 3); }
      }
      g.setAttribute("color", new THREE.BufferAttribute(c, 3));
      return g;
    };
    const BLOCKS = [blockGeo(1), blockGeo(2), blockGeo(3), blockGeo(4)];
    const blockLists = [[], [], [], []];
    const BLOCKS_BIG = [blockGeo(5, true), blockGeo(6, true), blockGeo(7, true)], bigLists = [[], [], []];   // 大きな岩塊(長さ 14 以上・崖の麓の巨岩)
    const STRATA_BIG = [0xdccfb3, 0x9c8e74, 0xd0c1a3, 0x928469];
    const blockMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const STRATA = [0xd3c6ab, 0xa89a7f, 0xc8b99c, 0x9d8f75];   // 地層ごとの色(インスタンスの色 × 頂点色)。明暗を交互にして段の縞を強める
    for (let x = 1300; x < 3500; x += 11) for (let z = -3990; z < 3990; z += 11) {
      const jx = x + (rnd() - 0.5) * 9, jz = z + (rnd() - 0.5) * 9, band = ridgeBand(jx, jz);
      if (band < 0.12 || !ok(jx, jz, 4)) continue;
      const [gx, gz] = grad(jx, jz), slope = Math.hypot(gx, gz), h = landH(jx, jz);
      if (slope > 0.4 && rnd() < 0.62) {   // 急な面: 段の縁に沿って並ぶ岩塊(長さ・奥行きはまちまち、隙間あり)
        const L = 5 + rnd() * rnd() * 22, hh = 2.5 + rnd() * 4.5, d = 3 + rnd() * 6, face = Math.atan2(-gx, -gz);
        const big = L > 14;
        (big ? bigLists[Math.floor(rnd() * 3)] : blockLists[Math.floor(rnd() * 4)]).push({ x: jx, y: h - hh * 0.45, z: jz, sx: L, sy: hh, sz: d, ry: face + (rnd() - 0.5) * 0.25, rx: (rnd() - 0.5) * 0.12, rz: (rnd() - 0.5) * 0.1, c: (big ? STRATA_BIG : STRATA)[Math.floor(h / 9) % 4] });
        if (rnd() < 0.12) {   // 落ちた岩塊: 斜面の下へ転がって傾いている
          const dist = 15 + rnd() * 45, fx = jx - (gx / slope) * dist, fz = jz - (gz / slope) * dist;
          if (ok(fx, fz, 2)) { const s2 = 0.5 + rnd() * 0.6; blockLists[Math.floor(rnd() * 4)].push({ x: fx, y: landH(fx, fz) - hh * s2 * 0.3, z: fz, sx: L * s2 * 0.6, sy: hh * s2, sz: d * s2, ry: rnd() * 6.28, rx: (rnd() - 0.5) * 0.8, rz: (rnd() - 0.5) * 0.8, c: STRATA[Math.floor(rnd() * 4)] }); }
        }
      } else if (rnd() < 0.3 * band) pushRock(jx, jz, (2.5 + rnd() * 4) * 1.6);
    }
    // ── 崖錐: 西の急な面の麓に扇形のがれ(峠を除く) ──
    for (let z = -3950; z < 3950; z += 55) {
      if (passOpen(z) < 0.6) continue;
      const rx = ridgeX(z) - 135 - rnd() * 40;
      for (let i = 0; i < 26; i++) {
        const t = Math.pow(rnd(), 1.6), x = rx - t * 150 + (rnd() - 0.5) * 20, zz = z + (rnd() - 0.5) * (40 + t * 90);
        if (!ok(x, zz, 2)) continue;
        pushRock(x, zz, (1.2 + rnd() * 2.6 * (1 - t * 0.6)) * 1.5, 0.45);
      }
    }

    // 崖の麓の巨岩: 崩れ落ちた大きな岩塊(角ばった塊と丸い岩)。西の急な面の麓に多く、東の麓に少し
    let bigBoulders = 0;
    for (let z = -3950; z < 3950; z += 20) {
      if (passOpen(z) < 0.5) continue;
      for (const side of [-1, 1]) {
        if (rnd() > (side < 0 ? 0.8 : 0.3)) continue;
        for (let i = 0, n = 1 + Math.floor(rnd() * 3); i < n; i++) {
          const zz = z + (rnd() - 0.5) * 26, x = ridgeX(zz) + (side < 0 ? -(148 + rnd() * 70) : 240 + rnd() * 160);
          if (!ok(x, zz, 10) || ridgeBand(x, zz) > 0.45) continue;
          if (rnd() < 0.55) {   // 角ばった岩塊(地層の色、傾いて半ば埋まる)
            const L = 10 + rnd() * 14, hh = 6 + rnd() * 7, d = 8 + rnd() * 9;
            bigLists[Math.floor(rnd() * 3)].push({ x, y: landH(x, zz) - hh * 0.35, z: zz, sx: L, sy: hh, sz: d, ry: rnd() * 6.28, rx: (rnd() - 0.5) * 0.7, rz: (rnd() - 0.5) * 0.7, c: STRATA_BIG[Math.floor(rnd() * 4)] });
          } else pushRock(x, zz, 6 + rnd() * rnd() * 9, 0.4);
          bigBoulders++;
        }
      }
    }

    // ── メサ・ビュート(尾根の東): 切り立った崖の壁(地層ごとの棚)、明るく平らな頂の岩(縁がわずかに張り出す)、麓の崖錐と落ちた岩塊 ──
    // 頂は明るく、壁は暗く、張り出しの下は影の色(ゲーム視点で盛り上がった地形として読める明暗)。全部で 1 つの頂点色メッシュ(面ごとの色)
    // 大きさ: 大きなメサ 2(幅が高さより大きい)、中 5、細いビュート 11(高さが幅より大きい)。風の向きに少し伸びた不ぞろいな輪郭
    const mesaPos = [], mesaCol = [];
    const MC = { top: 0xf1e9d6, cap: 0xd2c5a8, under: 0x5f5442, ledge: 0xc8ba9b, talusIn: 0x9e8f74, talusMid: 0xbcae92, talusOut: 0xddd3bf };
    const WALLS = [0x857660, 0x9b8b70, 0x786a55, 0xa59579];   // 地層ごとの壁の色(暗い。頂との明暗を大きく)
    const mrnd = ctx.rng(9191), mWX = 0.94, mWZ = -0.34;   // 風の向き(下の WIND と同じ)
    const mA = V(0, 0, 0), mB = V(0, 0, 0), mN = V(0, 0, 0), mR = V(0, 0, 0), mc = new THREE.Color();
    const mtri = (a2, b2, c2, ref, hex, tint) => {   // ref の向きへ面を向ける
      mA.subVectors(b2, a2); mB.subVectors(c2, a2); mN.crossVectors(mA, mB);
      if (mN.lengthSq() < 1e-10) return;
      const [p1, p2] = mN.dot(ref) < 0 ? [c2, b2] : [b2, c2];
      mc.setHex(hex).multiplyScalar(tint);
      for (const q2 of [a2, p1, p2]) { mesaPos.push(q2.x, q2.y, q2.z); mesaCol.push(mc.r, mc.g, mc.b); }
    };
    let buttes = 0; const MESAS = [];
    for (let tries = 0; tries < 1200 && buttes < 18; tries++) {
      const kind = buttes < 2 ? 0 : buttes < 7 ? 1 : 2;   // 0 = メサ、1 = 中、2 = ビュート
      const R = [70 + mrnd() * 22, 34 + mrnd() * 16, 10 + mrnd() * 7][kind], Ht = [38 + mrnd() * 7, 30 + mrnd() * 10, 30 + mrnd() * 15][kind];
      const elong = kind === 2 ? 1.0 + mrnd() * 0.3 : 1.15 + mrnd() * 0.5, zc = -3800 + mrnd() * 7600, xc = ridgeX(zc) + 380 + mrnd() * Math.max(0, 3850 - ridgeX(zc) - 380), reach = R * elong * 1.65;
      if (!ok(xc, zc, reach + 30) || ridgeBand(xc, zc) > 0.05) continue;
      buttes++;
      RES.push([xc, zc, reach + 12]); MESAS.push([Math.round(xc), Math.round(zc), Math.round(R), Math.round(Ht)]);   // ほかの装飾はメサの足元を避ける
      const NS = 30, ph = [mrnd() * 6.28, mrnd() * 6.28, mrnd() * 6.28], am = [0.12 + mrnd() * 0.08, 0.07 + mrnd() * 0.05, 0.035 + mrnd() * 0.03];
      const rf = (th) => 1 + am[0] * Math.sin(2 * th + ph[0]) + am[1] * Math.sin(3 * th + ph[1]) + am[2] * Math.sin(5 * th + ph[2]);   // 角度でなめらかに変わる輪郭(とげにしない)
      const GUL = Array.from({ length: kind === 2 ? 1 : 2 + Math.floor(mrnd() * 3) }, () => [mrnd() * 6.28, 0.16 + mrnd() * 0.18, 0.1 + mrnd() * 0.08]);   // 侵食の切れ込み(角度、幅、深さ)
      const gully = (th, ri) => { if (ri < 3) return 0; let g = 0; for (const [ga, gw, gd] of GUL) { const d = Math.atan2(Math.sin(th - ga), Math.cos(th - ga)); g = Math.max(g, gd * Math.exp(-((d / gw) ** 2))); } return g; };
      const at2 = (i, f, ri) => {
        const th = (i / NS) * Math.PI * 2, jj = 1 + (hash2(i * 7 + buttes * 31, ri * 13 + 5) - 0.5) * (ri < 3 ? 0.14 : 0.06), rr = R * f * rf(th) * jj * (1 - gully(th, ri));
        const u = Math.cos(th) * rr * elong, v = Math.sin(th) * rr / Math.sqrt(elong);
        return [xc + u * mWX - v * mWZ, zc + u * mWZ + v * mWX];
      };
      let gmin = Infinity; for (let i = 0; i < NS; i++) { const [gx, gz] = at2(i, 1.15, 0); gmin = Math.min(gmin, H(gx, gz)); }
      const base = gmin - 1.5, tint = 0.95 + mrnd() * 0.08;
      // 輪(下から上へ): f = 輪郭の倍率、y = 高さ(null は地形に沿う)、seg = 下の輪からの面の種類、col = 色
      const RG = [];
      RG.push({ f: 1.62, y: null });
      RG.push({ f: 1.34, y: base + 0.1 * Ht, seg: "talus", col: MC.talusOut });
      RG.push({ f: 1.12, y: base + 0.27 * Ht, seg: "talus", col: MC.talusMid });
      const y0 = base + 0.27 * Ht, yTop = base + 0.86 * Ht;
      const BH = []; { let yy = y0 + 0.6; while (yy < yTop - 2) { const h2 = Math.min(yTop - yy, 3.5 + mrnd() * 6.5); BH.push(h2); yy += h2; } }   // 地層の厚さは不ぞろい
      let fcur = 1.07, yb = y0 + 0.6;
      RG.push({ f: fcur, y: yb, seg: "talus", col: MC.talusIn });   // 崖錐が壁にかかる所
      BH.forEach((h2, kk) => {
        const ytp = Math.min(yTop, yb + h2);
        RG.push({ f: fcur - 0.012, y: ytp, seg: "side", col: WALLS[Math.floor(mrnd() * 4)] });   // 切り立った壁(地層 1 枚)
        if (kk < BH.length - 1) { const step = mrnd() < 0.35 ? 0.004 : 0.02 + mrnd() * 0.03; fcur -= 0.012 + step; RG.push({ f: fcur, y: ytp, seg: "up", col: MC.ledge }); }   // 地層の棚(幅は不ぞろい、ほとんど無い所も)
        yb = ytp;
      });
      const fc = fcur + 0.05;
      RG.push({ f: fc, y: yTop + 0.7, seg: "down", col: MC.under });     // 頂の岩の張り出しの下(影)
      RG.push({ f: fc, y: base + Ht, seg: "side", col: MC.cap });        // 頂の岩の縁の面
      RG.push({ f: fc - 0.035, y: base + Ht + 0.45, seg: "up", col: MC.top });   // 頂の縁の面取り
      const rings = RG.map((g, ri) => Array.from({ length: NS }, (_, i) => { const [px, pz] = at2(i, g.f, ri); return V(px, g.y === null ? H(px, pz) - 0.6 : Math.max(g.y, ri <= 2 ? H(px, pz) + 0.3 : -1e9), pz); }));
      const UPV = V(0, 1, 0), DNV = V(0, -1, 0);
      for (let ri = 1; ri < RG.length; ri++) {
        const A = rings[ri - 1], B = rings[ri], seg = RG[ri].seg, hex = RG[ri].col;
        for (let i = 0; i < NS; i++) {
          const a2 = A[i], b2 = A[(i + 1) % NS], c2 = B[(i + 1) % NS], d2 = B[i];
          const ref = seg === "up" ? UPV : seg === "down" ? DNV : mR.set((a2.x + b2.x + c2.x) / 3 - xc, seg === "talus" ? Math.max(1, R * 0.6) : 0, (a2.z + b2.z + c2.z) / 3 - zc).clone();
          mtri(a2, b2, c2, ref, hex, tint); mtri(a2, c2, d2, ref, hex, tint);
        }
      }
      const topRing = rings[rings.length - 1], cTop = V(xc, base + Ht + 0.7, zc);
      for (let i = 0; i < NS; i++) mtri(topRing[i], topRing[(i + 1) % NS], cTop, UPV, MC.top, tint);
      // 落ちた岩塊(崖錐の上と麓)と小石
      const nFall = Math.round(12 + R * 0.45);
      for (let i = 0; i < nFall; i++) {
        const th = mrnd() * 6.28, f = 1.12 + mrnd() * 0.55, [bx, bz] = at2(Math.round((th / 6.28) * NS) % NS, f, 0);
        const L = 3 + mrnd() * (R / 7 + 4), hh = L * (0.45 + mrnd() * 0.35);
        bigLists[Math.floor(mrnd() * 3)].push({ x: bx, y: H(bx, bz) - hh * 0.3, z: bz, sx: L, sy: hh, sz: L * (0.6 + mrnd() * 0.4), ry: mrnd() * 6.28, rx: (mrnd() - 0.5) * 0.6, rz: (mrnd() - 0.5) * 0.6, c: STRATA_BIG[Math.floor(mrnd() * 4)] });
      }
      for (let i = 0; i < 16; i++) { const th = mrnd() * 6.28, [bx, bz] = at2(Math.round((th / 6.28) * NS) % NS, 1.5 + mrnd() * 0.45, 0); pushRock(bx, bz, (1.4 + mrnd() * 2.6) * 1.5); }
    }
    {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(mesaPos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(mesaCol, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); m.userData.keep = true; m.name = "mesas"; group.add(m);
    }

    // ── 礫の斑(セリール)の場所を先に決める(風紋は斑の上に描かない)。小さい斑が多く、大きい斑は少ない。風の向きに伸びた楕円 ──
    const PATCHES = [];
    {
      const wa = Math.atan2(0.94, -0.34);   // 風の向き(下の WIND と同じ)の角度
      for (let n = 0; n < 1400 && PATCHES.length < 620; n++) {
        const cx = 960 + rnd() * 3000, cz = -3950 + rnd() * 7900, r = 10 + 115 * Math.pow(rnd(), 2.6);
        const a = r * (1.3 + rnd() * 0.9), b = r * (0.45 + rnd() * 0.3), ang = wa + (rnd() - 0.5) * 0.7;
        if (ridgeBand(cx, cz) > 0.25 || !ok(cx, cz, a)) continue;
        PATCHES.push({ cx, cz, a, b, ca: Math.cos(ang), sa: Math.sin(ang), seed: n, tone: Math.floor(rnd() * 3), al: 0.34 + rnd() * 0.2 });
      }
    }
    for (const [fx, fz] of YARD) PATCHES.push({ cx: fx, cz: fz, a: 190, b: 128, ca: 0.94, sa: -0.34, seed: 900 + PATCHES.length, tone: 1, al: 0.6 });   // ヤルダンの群れの下の暗い砂(丘の間の通り道が暗く見える)
    const patchD = (p, x, z) => { const dx = x - p.cx, dz = z - p.cz, u = dx * p.ca + dz * p.sa, v = -dx * p.sa + dz * p.ca; return Math.hypot(u / p.a, v / p.b); };   // 1 = 楕円の縁
    const onPatch = (x, z) => PATCHES.some((p) => Math.abs(x - p.cx) < p.a * 1.1 && Math.abs(z - p.cz) < p.a * 1.1 && patchD(p, x, z) < 1.05);

    // ── 砂丘: 斜面に沿う風紋の帯と、滑落面の稜線 ──
    const crestOf = (x, z) => 1 - Math.abs(2 * fbm((x * 0.94 - z * 0.34) / 170 + 2, (z * 0.94 + x * 0.34) / 520 - 6, 3) - 1);
    const DIR = V(0.34, 0, 0.94).normalize();   // 稜線の向き(地形の砂丘のノイズの等値線)
    const WIND = V(0.94, 0, -0.34);              // 風の向き(稜線に直交、西から東へ)
    const tilt = (x, z, L) => { const hA = H(x - DIR.x * L / 2, z - DIR.z * L / 2), hB = H(x + DIR.x * L / 2, z + DIR.z * L / 2); return { y: (hA + hB) / 2, rx: -Math.atan2(hB - hA, L), ry: Math.atan2(DIR.x, DIR.z) }; };
    // 滑落面の稜線: 低く幅の広い峰(地面より少しだけ明るい)
    const crests = [];
    for (let x = 950; x < 3990; x += 16) for (let z = -3990; z < 3990; z += 16) {
      const jx = x + (rnd() - 0.5) * 12, jz = z + (rnd() - 0.5) * 12;
      if (ridgeBand(jx, jz) > 0.12 || crestOf(jx, jz) <= 0.93 || rnd() > 0.45 || !ok(jx, jz, 6)) continue;
      const L = 18 + rnd() * 20, t = tilt(jx, jz, L);
      crests.push({ x: jx, y: t.y - 0.35, z: jz, sx: 8 + rnd() * 3, sy: 0.7 + rnd() * 0.4, sz: L, rx: t.rx, ry: t.ry });
    }
    const wedgeG = new THREE.BufferGeometry();   // 断面が三角の角柱(幅 1、高さ 1、長さ 1、底は y = 0)
    {
      const P = [[-0.5, 0], [0.5, 0], [0.15, 1]], pos = [];
      const v = (i, zz) => [P[i][0], P[i][1], zz];
      for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; pos.push(...v(i, -0.5), ...v(j, -0.5), ...v(j, 0.5), ...v(i, -0.5), ...v(j, 0.5), ...v(i, 0.5)); }
      pos.push(...v(0, -0.5), ...v(2, -0.5), ...v(1, -0.5), ...v(0, 0.5), ...v(1, 0.5), ...v(2, 0.5));
      wedgeG.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); wedgeG.computeVertexNormals();
    }
    const crestMat = lam(0xebe4d4, { flatShading: true, side: THREE.DoubleSide });
    instanced(wedgeG, crestMat, crests);
    // 風紋の帯: 稜線と平行な波線を斜面の斑の中に数本ずつ。1 本は 4 列の帯(風上の縁が明るく、その風下の谷が暗い)で、
    // 半透明の明暗だけを地形に重ねる(地面の色が場所で変わっても浮かない)。線の両端は薄れて消える
    const rp = [], rc = [];
    const LIGHT = [0.99, 0.96, 0.89], SHADE = [0.56, 0.5, 0.39];   // 明るい縁は砂色寄り(白い筋に見せない)
    const ROWS = [[-1.3, LIGHT, 0], [-0.25, LIGHT, 0.2], [0.2, SHADE, 0.27], [1.6, SHADE, 0]];
    const rippleLine = (pts, amp) => {
      const n = pts.length;
      const rows = pts.map(([x, z], i) => { const f = Math.sqrt(Math.sin((Math.PI * i) / (n - 1))) * amp; return ROWS.map(([o, c, al]) => { const px = x + WIND.x * o, pz = z + WIND.z * o; return [px, H(px, pz) + 0.14, pz, c, al * f]; }); });
      for (let i = 0; i < n - 1; i++) for (let r = 0; r < ROWS.length - 1; r++) {
        const A = rows[i][r], B = rows[i][r + 1], C2 = rows[i + 1][r + 1], D = rows[i + 1][r];
        for (const tri of [[A, B, C2], [A, C2, D]]) {
          let [p0, p1, p2] = tri;
          if ((p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]) < 0) [p1, p2] = [p2, p1];   // 上向き
          for (const p of [p0, p1, p2]) { rp.push(p[0], p[1], p[2]); rc.push(p[3][0], p[3][1], p[3][2], p[4]); }
        }
      }
    };
    let ripplePatches = 0, rippleLines = 0;
    for (let x = 960; x < 3990; x += 46) for (let z = -3990; z < 3990; z += 46) {
      const cx = x + (rnd() - 0.5) * 40, cz = z + (rnd() - 0.5) * 40;
      if (ridgeBand(cx, cz) > 0.12 || !ok(cx, cz, 10)) continue;
      const cr = crestOf(cx, cz);
      if (cr < 0.15 || cr > 0.9) continue;
      const [gx, gz] = grad(cx, cz), windward = gx * WIND.x + gz * WIND.z > 0.01, dens = 0.3 + 0.6 * fbm(cx / 260 + 9, cz / 260 - 4, 2);
      if (rnd() > dens * (windward ? 1 : 0.55)) continue;
      ripplePatches++;
      const len = 40 + rnd() * 50, half = 14 + rnd() * 16, sp = windward ? 3.6 + rnd() * 0.8 : 2.8 + rnd() * 0.6, amp = windward ? 1 : 0.7, ph = rnd() * 6;
      for (let o = -half; o <= half; o += sp) {
        const L = len * Math.sqrt(Math.max(0, 1 - (o / half) ** 2));
        if (L < 10) continue;
        let run = [];
        const flush = () => { if (run.length > 2) { rippleLine(run, amp); rippleLines++; } run = []; };
        for (let st = -L / 2; st <= L / 2; st += 5) {
          const w = o + 0.9 * Math.sin(st / 6.5 + ph + o * 0.4), px = cx + DIR.x * st + WIND.x * w, pz = cz + DIR.z * st + WIND.z * w;
          if (ok(px, pz, 2) && ridgeBand(px, pz) < 0.15 && !onPatch(px, pz)) run.push([px, pz]); else flush();
        }
        flush();
      }
    }
    if (rp.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(rc, 4)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 }));
      m.userData.keep = true; m.renderOrder = 1; group.add(m);
    }

    // ── 低木(タマリスク)とアカシア: まばら、涸れ川に多い ──
    const shrubG = U.merge(THREE, [[new THREE.IcosahedronGeometry(1, 0), { y: 0.45, sy: 0.55 }], [new THREE.IcosahedronGeometry(0.7, 0), { x: 0.7, y: 0.35, z: 0.2, sy: 0.6 }], [new THREE.IcosahedronGeometry(0.6, 0), { x: -0.5, y: 0.3, z: -0.5, sy: 0.6 }]]);
    const acaciaG = U.concat(THREE, [
      { geo: new THREE.CylinderGeometry(0.035, 0.06, 0.62, 5).translate(0, 0.31, 0).toNonIndexed(), color: new THREE.Color(0x7d7262) },
      { geo: new THREE.CylinderGeometry(0.025, 0.035, 0.32, 4).rotateZ(0.7).translate(0.12, 0.6, 0).toNonIndexed(), color: new THREE.Color(0x7d7262) },
      { geo: new THREE.CylinderGeometry(0.025, 0.035, 0.32, 4).rotateZ(-0.7).translate(-0.12, 0.58, 0.04).toNonIndexed(), color: new THREE.Color(0x7d7262) },
      { geo: new THREE.CylinderGeometry(0.5, 0.56, 0.09, 9).translate(0.04, 0.74, 0).toNonIndexed(), color: new THREE.Color(0x9aa184) },
      { geo: new THREE.CylinderGeometry(0.34, 0.42, 0.08, 8).translate(-0.12, 0.82, 0.06).toNonIndexed(), color: new THREE.Color(0xa9af93) },
    ]);
    const shrubs = [[], []], acacias = [];
    for (let i = 0; i < 16000; i++) {
      const x = 920 + rnd() * (HALF - 940), z = -HALF + 20 + rnd() * (2 * HALF - 40);
      if (ridgeBand(x, z) > 0.35 || !ok(x, z, 6)) continue;
      const dw = wadiDist(x, z), inWadi = dw < 85, p = 0.06 + (inWadi ? 0.75 : 0) + 0.18 * Math.max(0, fbm(x / 400, z / 400, 2) - 0.45);
      if (rnd() > p) continue;
      const y = landH(x, z);
      if (rnd() < (inWadi ? 0.22 : 0.05)) { const s = 22 + rnd() * 9; acacias.push({ x, y: y - 0.4, z, sx: s, sy: s * (0.9 + rnd() * 0.2), sz: s, ry: rnd() * 6.28 }); }
      else { const s = (2.2 + rnd() * 2.2) * 1.8; shrubs[rnd() < 0.5 ? 0 : 1].push({ x, y: y - 0.5, z, sx: s, sy: s * (0.8 + rnd() * 0.4), sz: s, ry: rnd() * 6.28 }); }
    }
    instanced(shrubG, MAT.shrub, shrubs[0]); instanced(shrubG, MAT.shrub2, shrubs[1]);
    instanced(acaciaG, U.vcLambert(THREE), acacias);

    // ── 地表の覆い(戦車の横で 2〜10 px の肌理が途切れないように): 草の株、小さな低木、石の散らばり、礫の原、低い岩の棚 ──
    // 密度はノイズで斑にする(cover = 0〜1)。尾根の帯と運河地帯・拠点・道は除く
    const cover = (x, z) => Math.max(0, Math.min(1, 1.6 * fbm(x / 520 + 3, z / 520 - 7, 3) - 0.35 + (wadiDist(x, z) < 110 ? 0.35 : 0)));
    const tuftG = (() => {   // 草の株: 放射状に開いた細い葉 7 枚(三角形 1 枚ずつ。両面)
      const pos = [], r = ctx.rng(31);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + r() * 0.5, ca = Math.cos(a), sa = Math.sin(a), hh = 0.75 + r() * 0.45, l = 0.4 * hh, w = 0.13;
        pos.push(-sa * w, 0, ca * w, sa * w, 0, -ca * w, ca * l, hh, sa * l);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
    })();
    const smallShrubG = U.merge(THREE, [[new THREE.IcosahedronGeometry(1, 0), { y: 0.4, sy: 0.6 }], [new THREE.IcosahedronGeometry(0.6, 0), { x: 0.6, y: 0.3, sy: 0.7 }]]);
    const pebbleG = new THREE.OctahedronGeometry(1, 0);   // 小石は 8 面で足りる(遠目には形の差が出ない)
    const tufts = [], smalls = [], pebbles = [];
    const TUFT = [0xb4b79b, 0xa7ab8d, 0xc3c2a5], SH = [0x9ea58a, 0x8f977c, 0xa9ad93], PEB = [0xb9ad96, 0xa69a83, 0xcabfa9, 0x968a74];
    for (let x = 930; x < 3990; x += 9) for (let z = -3990; z < 3990; z += 9) {
      const jx = x + (rnd() - 0.5) * 8, jz = z + (rnd() - 0.5) * 8, cv = cover(jx, jz);
      if (rnd() > 0.15 + 0.85 * cv || ridgeBand(jx, jz) > 0.45) continue;
      const r = rnd();
      if (r < 0.55) { if (!ok(jx, jz, 2)) continue; const s2 = 2.2 + rnd() * 2.6; tufts.push({ x: jx, y: landH(jx, jz) - 0.3, z: jz, sx: s2, sy: s2 * (0.8 + rnd() * 0.6), sz: s2, ry: rnd() * 6.28, c: TUFT[Math.floor(rnd() * 3)] }); }
      else if (r < 0.7) { if (!ok(jx, jz, 3)) continue; const s2 = 2.2 + rnd() * 2.4; smalls.push({ x: jx, y: landH(jx, jz) - 0.4, z: jz, sx: s2, sy: s2 * (0.7 + rnd() * 0.5), sz: s2, ry: rnd() * 6.28, c: SH[Math.floor(rnd() * 3)] }); }
      else if (r < 0.78) {   // 石の散らばり(小さな石が数個)
        for (let i = 0; i < 4 + rnd() * 6; i++) { const px = jx + (rnd() - 0.5) * 14, pz = jz + (rnd() - 0.5) * 14; if (!ok(px, pz, 1)) continue; const s2 = 0.5 + rnd() * 1.3; pebbles.push({ x: px, y: landH(px, pz) - s2 * 0.4, z: pz, sx: s2 * (1 + rnd() * 0.6), sy: s2 * 0.6, sz: s2, ry: rnd() * 6.28, rx: rnd(), c: PEB[Math.floor(rnd() * 4)] }); }
      }
    }
    // 小石の原(密な小石の斑)
    for (let n = 0; n < 900; n++) {
      const cx = 950 + rnd() * 3000, cz = -3950 + rnd() * 7900, R = 12 + rnd() * 30;
      if (ridgeBand(cx, cz) > 0.4 || !ok(cx, cz, R)) continue;
      for (let i = 0; i < R * 1.6; i++) { const a = rnd() * 6.28, d = Math.sqrt(rnd()) * R, px = cx + Math.cos(a) * d, pz = cz + Math.sin(a) * d, s2 = 0.35 + rnd() * 0.8; pebbles.push({ x: px, y: landH(px, pz) - s2 * 0.4, z: pz, sx: s2 * 1.3, sy: s2 * 0.55, sz: s2, ry: rnd() * 6.28, c: PEB[Math.floor(rnd() * 4)] }); }
    }
    const pastel = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    const tuftMat = pastel.clone(); tuftMat.side = THREE.DoubleSide;
    instanced(tuftG, tuftMat, tufts); instanced(smallShrubG, pastel.clone(), smalls);   // 小石は礫の斑の中の分も足してから(下)

    // 礫の原(セリール): 地形に沿わせた半透明の層。輪郭は角度ごとのノイズで不ぞろい、縁へ向けて薄れて砂に溶ける(縁の硬い染みにしない)
    // 輪(中心 → 縁)ごとの濃さ 1, 0.95, 0.75, 0.4, 0。色は 3 種の礫の色。中には礫(小石)を散らす
    const gp = [], gc = [], GT = [[0.46, 0.39, 0.29], [0.41, 0.35, 0.26], [0.5, 0.43, 0.33]], RINGS = [0, 0.3, 0.55, 0.78, 1], RA = [1, 0.92, 0.7, 0.35, 0];   // 色は暗め(地形の肌理で暗くなった砂の上でも読める)、濃さは低め
    for (const pt of PATCHES) {
      const NA = 26, ring = [], lobe = rnd() * 6.28, lobeK = 0.25 + rnd() * 0.3;
      for (let ri = 0; ri < RINGS.length; ri++) {
        const row = [];
        for (let i = 0; i < NA; i++) {
          const th = (i / NA) * Math.PI * 2, wob = (0.5 + 0.95 * fbm(Math.cos(th) * 2.2 + pt.seed * 0.37, Math.sin(th) * 2.2 - pt.seed * 0.21, 3)) * (1 + lobeK * Math.cos(2 * (th - lobe)) * (ri / 4));   // 不ぞろいな縁(張り出しと入り込み)
          const rr = RINGS[ri] * wob, u = Math.cos(th) * pt.a * rr, v = Math.sin(th) * pt.b * rr, x = pt.cx + u * pt.ca - v * pt.sa, z = pt.cz + u * pt.sa + v * pt.ca;
          const al = Math.min(0.6, pt.al * RA[ri] * (0.45 + 1.1 * fbm(x / 19 + 5, z / 19 - 3, 3)));   // 中の濃淡(斑の中もまだらに)
          row.push([x, H(x, z) + 0.12, z, al]);
        }
        ring.push(row);
      }
      const col = GT[pt.tone];
      const put = (P) => { gp.push(P[0], P[1], P[2]); gc.push(col[0], col[1], col[2], P[3]); };
      for (let ri = 0; ri < RINGS.length - 1; ri++) for (let i = 0; i < NA; i++) {
        const A = ring[ri][i], B = ring[ri][(i + 1) % NA], C2 = ring[ri + 1][(i + 1) % NA], D = ring[ri + 1][i];
        for (const tri of ri === 0 ? [[A, C2, D]] : [[A, B, C2], [A, C2, D]]) {
          let [p0, p1, p2] = tri;
          if ((p1[2] - p0[2]) * (p2[0] - p0[0]) - (p1[0] - p0[0]) * (p2[2] - p0[2]) < 0) [p1, p2] = [p2, p1];   // 上向き
          put(p0); put(p1); put(p2);
        }
      }
      // 斑の中の礫(大きな斑ほど多く、中心に寄せる)
      for (let i = 0, n = Math.min(220, Math.round(pt.a * pt.b * 0.035)); i < n; i++) {
        const t = Math.sqrt(rnd()) * 0.85, th = rnd() * 6.28, u = Math.cos(th) * pt.a * t, v = Math.sin(th) * pt.b * t, px = pt.cx + u * pt.ca - v * pt.sa, pz = pt.cz + u * pt.sa + v * pt.ca;
        if (!ok(px, pz, 1)) continue;
        const s2 = 0.4 + rnd() * 0.9; pebbles.push({ x: px, y: landH(px, pz) - s2 * 0.4, z: pz, sx: s2 * 1.3, sy: s2 * 0.55, sz: s2, ry: rnd() * 6.28, c: PEB[1 + Math.floor(rnd() * 3)] });
      }
    }
    if (gp.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(gp, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(gc, 4)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
      m.userData.keep = true; m.renderOrder = 0.5; group.add(m);   // 風紋(renderOrder 1)より先に描く
    }

    instanced(pebbleG, pastel.clone(), pebbles);

    // 低い岩の棚・露頭の群れ(平らな砂漠に時々)
    let outcrops = 0;
    for (let n = 0; n < 500 && outcrops < 170; n++) {
      const cx = 1000 + rnd() * 2950, cz = -3900 + rnd() * 7800;
      if (ridgeBand(cx, cz) > 0.1 || !ok(cx, cz, 40) || rnd() > 0.3 + cover(cx, cz) * 0.5) continue;
      outcrops++;
      const ang = rnd() * 6.28;
      for (let i = 0; i < 3 + rnd() * 5; i++) {
        const t = (rnd() - 0.5) * 50, px = cx + Math.cos(ang) * t + (rnd() - 0.5) * 10, pz = cz + Math.sin(ang) * t + (rnd() - 0.5) * 10;
        if (!ok(px, pz, 3)) continue;
        const L = 6 + rnd() * 14, hh = 1.5 + rnd() * 3;
        blockLists[Math.floor(rnd() * 4)].push({ x: px, y: landH(px, pz) - hh * 0.55, z: pz, sx: L, sy: hh, sz: 3 + rnd() * 5, ry: ang + Math.PI / 2 + (rnd() - 0.5) * 0.4, rx: (rnd() - 0.5) * 0.15, c: STRATA[Math.floor(rnd() * 4)] });
      }
      for (let i = 0; i < 6; i++) { const a = rnd() * 6.28, d = 10 + rnd() * 30; pushRock(cx + Math.cos(a) * d, cz + Math.sin(a) * d, 1 + rnd() * 2.2); }
    }

    // ── 峠: 道路・線路の切り通しの擁壁、石積み、ケルンと標柱 ──
    const wallParts = [], cairnParts = [], postParts = [], postBand = [];
    for (const [pl, half] of [...roads.map((r) => [r, 11]), [rail, 7]]) {
      const pts = drape(pl, 10);
      let run = [];
      const flush = () => {
        if (run.length > 2) for (const end of [run[0], run[run.length - 1]]) {   // 峠の入口にケルンと標柱
          const [x, z] = end, i = pts.indexOf(end), [nx, nz] = pts[Math.min(pts.length - 1, i + 1)], dx = nx - x, dz = nz - z, l = Math.hypot(dx, dz) || 1, ox = -dz / l, oz = dx / l;
          const cx = x + ox * (half + 14), cz = z + oz * (half + 14), cy = landH(cx, cz);
          for (let s = 0; s < 3; s++) cairnParts.push([new THREE.DodecahedronGeometry(2.6 - s * 0.7, 0), { x: cx, y: cy + 1.6 + s * 2.6, z: cz, ry: s }]);
          const px = x - ox * (half + 10), pz = z - oz * (half + 10), py = landH(px, pz);
          postParts.push([cyl(0.6, 9, 6), { x: px, y: py + 4.5, z: pz }]); postBand.push([cyl(0.7, 1.6, 6), { x: px, y: py + 8, z: pz }]);
        }
        run = [];
      };
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        if (ridgeBand(mx, mz) < 0.08 || isWater(mx, mz) || nearSite(mx, mz, 10)) { flush(); continue; }
        run.push(pts[i]);
        const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz), ox = -dz / l, oz = dx / l, yr = landH(mx, mz) + 0.5;
        for (const s of [-1, 1]) {
          const o = half + 3, wx = mx + ox * s * o, wz = mz + oz * s * o, ht = landH(mx + ox * s * (o + 22), mz + oz * s * (o + 22));
          if (ht - yr < 3) continue;
          const hw = Math.min(14, ht - yr + 1.5);
          wallParts.push([box(2.4, hw + 2, l + 0.6), { x: wx, y: yr + hw / 2 - 1, z: wz, ry: Math.atan2(dx, dz) }]);
          wallParts.push([box(3.2, 0.8, l + 0.6), { x: wx, y: yr + hw + 0.4, z: wz, ry: Math.atan2(dx, dz) }]);   // 天端の笠石
        }
      }
      flush();
    }
    // 峠の斜面の石積み(等高線に沿う低い石垣)
    const dryParts = [];
    for (const [pz] of passes) for (const off of [-95, -60, 60, 95]) {
      const z = pz + off + (rnd() - 0.5) * 10, x0 = ridgeX(z) - 110;
      for (let x = x0; x < x0 + 240; x += 12) {
        const zz = z + Math.sin(x / 40) * 6;
        if (!ok(x, zz, 2) || rnd() < 0.15) continue;
        const y = landH(x, zz), y2 = landH(x + 12, zz + Math.sin((x + 12) / 40) * 6) - y;
        dryParts.push([box(12.4, 2 + rnd() * 0.8, 1.8), { x: x + 6, y: y + 0.6 + y2 / 2, z: zz, rz: Math.atan2(y2, 12) }]);
      }
    }
    if (wallParts.length) add(U.merge(THREE, wallParts), MAT.wall, group);
    if (dryParts.length) add(U.merge(THREE, dryParts), MAT.stone, group, { edges: false });
    if (cairnParts.length) add(U.merge(THREE, cairnParts), MAT.rock3, group);
    if (postParts.length) { add(U.merge(THREE, postParts), MAT.hut, group); add(U.merge(THREE, postBand), M.dark, group, { edges: false }); }

    // ── 轍の道(道路から砂漠へ曲がりくねって延びる) ──
    const eastRoadPts = roads.flatMap((r) => drape(r, 60)).filter(([x, z]) => x > 1000 && ok(x + 40, z + 40, 0));
    const trackGeos = [];
    const offsetLine = (pts, d) => pts.map(([x, z], i) => { const [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(bx - ax, bz - az) || 1; return [x - ((bz - az) / l) * d, z + ((bx - ax) / l) * d]; });
    const rutGeos = [];
    for (let n = 0; n < 46 && eastRoadPts.length; n++) {
      let [x, z] = eastRoadPts[Math.floor(rnd() * eastRoadPts.length)], a = rnd() * 6.28;
      const pts = [], len = 600 + rnd() * 1000;
      for (let s = 0; s < len; s += 25) {
        a += (fbm(x / 300 + n * 5, z / 300, 2) - 0.5) * 0.6;
        const nx = x + Math.cos(a) * 25, nz = z + Math.sin(a) * 25;
        if (nx < 960 || Math.abs(nx) > HALF - 30 || Math.abs(nz) > HALF - 30 || nearSite(nx, nz, 20) || wet(nx, nz, 10) || ridgeBand(nx, nz) > 0.3 || inRes(nx, nz, 12)) break;
        pts.push([nx, nz]); x = nx; z = nz;
      }
      if (pts.length > 6) {   // 轍: 明るい路面と、両側の暗い車輪の跡 2 本
        const dp = drape(pts, 6);
        trackGeos.push([strip(dp, 7, 0.28), {}]);
        for (const o of [-2.2, 2.2]) rutGeos.push([strip(offsetLine(dp, o), 0.9, 0.36), {}]);
      }
    }
    if (trackGeos.length) add(U.merge(THREE, trackGeos), MAT.track, group, { edges: false });
    if (rutGeos.length) add(U.merge(THREE, rutGeos), MAT.trench, group, { edges: false });

    // ── 古い土塁と塹壕の線(運河に面した南北のジグザグ) ──
    const bermParts = [], trenchGeos = [];
    const LINES = [[1050, -3500, 900], [1150, -1900, 700], [1000, -400, 600], [1100, 1100, 700], [1300, 2000, 900], [1500, -800, 500], [2700, -2700, 500]];
    for (const [x0, z0, L] of LINES) {
      const zig = []; for (let s = 0; s <= L; s += 30) zig.push([x0 + ((s / 30) % 2 ? 14 : -14) + Math.sin(s / 200) * 30, z0 + s]);
      let seg = [];
      const out = () => { if (seg.length > 2) trenchGeos.push([strip(drape(seg, 8), 4, 0.25), {}]); seg = []; };
      for (let i = 0; i < zig.length; i++) {
        const [x, z] = zig[i];
        if (!ok(x, z, 6) || ridgeBand(x, z) > 0.2) { out(); continue; }
        seg.push([x, z]);
        if (i > 0 && seg.length > 1) {   // 塹壕の西(運河側)に平行な土塁
          const [ax, az] = zig[i - 1], bx = x - 14, bz = z, cx = ax - 14, l = Math.hypot(bx - cx, bz - az);
          const mx = (bx + cx) / 2, mz = (bz + az) / 2;
          bermParts.push([box(8, 4, l + 2), { x: mx, y: landH(mx, mz) + 0.6, z: mz, ry: Math.atan2(bx - cx, bz - az) }]);
        }
      }
      out();
    }
    if (bermParts.length) add(U.merge(THREE, bermParts), MAT.berm, group, { edges: false });
    if (trenchGeos.length) add(U.merge(THREE, trenchGeos), MAT.trench, group, { edges: false });

    // ── 石造りの廃墟(崩れた壁の矩形、間仕切り、散らばった石) ──
    const ruinParts = [];
    let ruins = 0;
    for (let tries = 0; tries < 600 && ruins < 9; tries++) {
      const x = 1000 + rnd() * 2900, z = -3800 + rnd() * 7600, W = 30 + rnd() * 22, D = 20 + rnd() * 16;
      if (!ok(x, z, Math.max(W, D)) || ridgeBand(x, z) > 0.08) continue;
      const [gx, gz] = grad(x, z); if (Math.hypot(gx, gz) > 0.12) continue;
      ruins++;
      const y0 = landH(x, z) - 1.5, ry = rnd() * 3;
      const c = Math.cos(ry), s = Math.sin(ry), at = (u, v) => [x + u * c + v * s, z - u * s + v * c];
      const walls = [[-W / 2, -D / 2, W / 2, -D / 2], [W / 2, -D / 2, W / 2, D / 2], [W / 2, D / 2, -W / 2, D / 2], [-W / 2, D / 2, -W / 2, -D / 2], [0, -D / 2, 0, D * 0.15]];
      for (const [u0, v0, u1, v1] of walls) {
        const L = Math.hypot(u1 - u0, v1 - v0), n = Math.max(1, Math.round(L / 6));
        for (let i = 0; i < n; i++) {
          if (rnd() < 0.3) continue;   // 崩れて途切れた所
          const t = (i + 0.5) / n, [wx, wz] = at(u0 + (u1 - u0) * t, v0 + (v1 - v0) * t), h = 2 + rnd() * 5;
          ruinParts.push([box(L / n + 0.2, h + 1.5, 2), { x: wx, y: y0 + (h + 1.5) / 2, z: wz, ry: ry + Math.atan2(u1 - u0, v1 - v0) + Math.PI / 2 }]);
        }
      }
      for (let i = 0; i < 10; i++) { const [bx, bz] = at((rnd() - 0.5) * W * 1.4, (rnd() - 0.5) * D * 1.4); ruinParts.push([box(1.6 + rnd() * 2, 1.2, 1.4 + rnd() * 2), { x: bx, y: landH(bx, bz) + 0.2, z: bz, ry: rnd() * 3 }]); }
    }
    if (ruinParts.length) add(U.merge(THREE, ruinParts), MAT.stone, group);

    // ── 格子の通信塔(尾根の高い所。固定のパネルアンテナと機器小屋) ──
    let masts = 0;
    for (const zc of [-1500, 1500, -3500]) {
      let best = null;
      for (let z = zc - 300; z <= zc + 300; z += 25) for (let dx = -40; dx <= 80; dx += 20) {
        const x = ridgeX(z) + dx;
        if (!ok(x, z, 20) || passOpen(z) < 0.8) continue;
        const [gx, gz] = grad(x, z), h = landH(x, z);
        if (Math.hypot(gx, gz) < 0.15 && (!best || h > best.h)) best = { x, z, h };
      }
      if (!best) continue;
      masts++;
      const base = V(best.x, best.h - 0.5, best.z);
      k.lattice(group, base, 72, 3.6, 1.2, 7, 0.45, MAT.mast);
      for (const a of [0, 2.1, 4.2]) add(box(1.6, 7, 0.6), MAT.hut, group, { x: base.x + Math.sin(a) * 2.4, y: base.y + 64, z: base.z + Math.cos(a) * 2.4, ry: a });
      add(box(9, 5, 6), MAT.hut, group, { x: base.x + 9, y: landH(base.x + 9, base.z) + 2, z: base.z });
      add(box(9.4, 0.6, 6.4), M.dark, group, { x: base.x + 9, y: landH(base.x + 9, base.z) + 4.7, z: base.z, edges: false });
    }

    // ── 目印 ──
    // 頂点色つきの面をまとめて 1 つのメッシュにする(焼かない。色は面ごと)
    const vcMesh = (pos, colArr, mat) => { if (!pos.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(colArr, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.userData.keep = true; group.add(m); return m; };
    const tmpC = new THREE.Color();
    // 地面に貼る四角(2D の点 [x, z] 4 つ)を上向きの三角形 2 枚で pos に足す
    const dquad = (arr, a, b, c, d, lift) => {
      for (let [q0, q1, q2] of [[a, b, c], [a, c, d]]) {
        if ((q1[1] - q0[1]) * (q2[0] - q0[0]) - (q1[0] - q0[0]) * (q2[1] - q0[1]) < 0) [q1, q2] = [q2, q1];
        for (const q of [q0, q1, q2]) arr.push(q[0], H(q[0], q[1]) + lift, q[1]);
      }
    };
    const plateMesh = (pos, color, off = 2) => { if (!pos.length) return; const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, lam(color, { polygonOffset: true, polygonOffsetFactor: -off, polygonOffsetUnits: -off * 2 - 1 })); m.userData.keep = true; group.add(m); };

    // ヤルダン: 風で削られた流線形の土の丘の群れ。風上(西)の頭が切り立って丸く、風下へ細く尾を引く。脇は急で裾がえぐれる。
    // 色は高さで決める水平の地層の縞(2.4 ごと)、上を向いた面は明るい頂、裾のえぐれは暗い影。群れの下には暗い砂を敷く(丘の間の通り道)
    let yardangs = 0;
    const yPos = [], yCol = [];
    const YBAND = [new THREE.Color(0xe6dbc1), new THREE.Color(0x938266), new THREE.Color(0xb1a083), new THREE.Color(0xc9bda2)];   // 頂、暗い縞、明るい縞、裾の砂
    for (const [fx, fz] of YARD) {
      const across = V(-WIND.z, 0, WIND.x), rows = 3 + Math.floor(rnd() * 2);
      for (let r = 0; r < rows; r++) for (let c2 = 0; c2 < 4; c2++) {
        if (rnd() < 0.2) continue;
        const L = 60 + rnd() * 90, W = 6 + rnd() * 7, Hh = 6 + rnd() * 9;
        const off = (c2 - 1.5) * (34 + rnd() * 14), alng = (r - (rows - 1) / 2) * 120 + (rnd() - 0.5) * 50 + (c2 % 2) * 40;
        const cx = fx + across.x * off + WIND.x * alng, cz = fz + across.z * off + WIND.z * alng;
        const head = [cx - WIND.x * L / 2, cz - WIND.z * L / 2], tail = [cx + WIND.x * L / 2, cz + WIND.z * L / 2];
        if (!ok0(...head, 6) || !ok0(...tail, 6) || !ok0(cx, cz, W)) continue;
        // 形: 水平の地層を積んだ流線形(平面は涙形: 風上の頭が丸く太く、風下へ細る)。層ごとに少し細く短くなり、頭は切り立ち、尾は低く消える
        let base = Infinity; for (let i = 0; i <= 8; i++) { const t = i / 8; base = Math.min(base, H(head[0] + (tail[0] - head[0]) * t, head[1] + (tail[1] - head[1]) * t)); }
        base -= 1.2;
        const bend = (rnd() - 0.5) * 0.3, NO = 28;
        const wOf = (t) => (t < 0.1 ? Math.sqrt(t / 0.1) : Math.pow(1 - (t - 0.1) / 0.9, 0.85));   // 涙形の半幅(0〜1)
        const outline = (Lk, Wk, u0) => {   // 層の輪郭: 上側 頭→尾、下側 尾→頭
          const pts = [];
          for (let i = 0; i <= NO / 2; i++) { const t = Math.pow(i / (NO / 2), 1.5); pts.push([u0 + t * Lk, Wk * wOf(t)]); }
          for (let i = NO / 2 - 1; i >= 1; i--) { const t = Math.pow(i / (NO / 2), 1.5); pts.push([u0 + t * Lk, -Wk * wOf(t)]); }
          return pts;
        };
        const toW = ([u, v], y) => { const t = u / L, cxw = head[0] + WIND.x * u + across.x * (v + bend * L * t * t), czw = head[1] + WIND.z * u + across.z * (v + bend * L * t * t); return V(cxw, y, czw); };
        const nL = Math.max(2, Math.round(Hh / 3.2)), lh = Hh / nL, LAY = [];
        for (let kk = 0; kk <= nL; kk++) { const f = kk / nL; LAY.push({ L: L * (1 - 0.42 * f), W: W * (1 - 0.3 * f), u0: L * 0.035 * f }); }
        const RG2 = [{ pts: outline(L * 1.04, W * 1.25, -L * 0.02), y: null, seg: "talus" }];
        for (let kk = 0; kk < nL; kk++) {
          RG2.push({ pts: outline(LAY[kk].L, LAY[kk].W, LAY[kk].u0), y: base + kk * lh + (kk === 0 ? 1.0 : 0), seg: kk === 0 ? "talus" : "up" });
          RG2.push({ pts: outline(LAY[kk].L, LAY[kk].W, LAY[kk].u0), y: base + (kk + 1) * lh, seg: "side", band: kk });
        }
        const rings2 = RG2.map((g) => g.pts.map((pp) => { const w = toW(pp, 0); w.y = g.y === null ? H(w.x, w.z) - 0.5 : Math.max(g.y, H(w.x, w.z) - 0.4); return w; }));
        const cen = toW([L * 0.35, 0], 0);
        const e1 = V(0, 0, 0), e2 = V(0, 0, 0), mm = V(0, 0, 0);
        const ytri = (a2, b2, c2, ref, col) => {
          e1.subVectors(b2, a2); e2.subVectors(c2, a2); mm.crossVectors(e1, e2);
          if (mm.lengthSq() < 1e-10) return;
          const [q1, q2] = mm.dot(ref) < 0 ? [c2, b2] : [b2, c2];
          for (const q of [a2, q1, q2]) { yPos.push(q.x, q.y, q.z); yCol.push(col.r, col.g, col.b); }
        };
        const UPV2 = V(0, 1, 0), refO = V(0, 0, 0);
        for (let ri = 1; ri < rings2.length; ri++) {
          const A2 = rings2[ri - 1], B2 = rings2[ri], g = RG2[ri], n2 = A2.length;
          for (let i = 0; i < n2; i++) {
            const a2 = A2[i], b2 = A2[(i + 1) % n2], c2 = B2[(i + 1) % n2], d2 = B2[i];
            refO.set((a2.x + b2.x) / 2 - cen.x, g.seg === "talus" ? 4 : 0, (a2.z + b2.z) / 2 - cen.z);
            const front = i < 3 || i > n2 - 3;   // 風上の頭の面
            const col = tmpC.copy(g.seg === "side" ? YBAND[g.band % 2 ? 1 : 2] : g.seg === "up" ? YBAND[0] : YBAND[3]);
            if (g.seg === "side" && front) col.multiplyScalar(0.85);
            if (g.seg === "up") col.lerp(YBAND[2], 0.25);
            ytri(a2, b2, c2, g.seg === "up" ? UPV2 : refO, col); ytri(a2, c2, d2, g.seg === "up" ? UPV2 : refO, col);
          }
        }
        const topR = rings2[rings2.length - 1], ctop = toW([LAY[nL - 1].u0 + LAY[nL - 1].L * 0.3, 0], base + Hh + 0.3);
        for (let i = 0; i < topR.length; i++) ytri(topR[i], topR[(i + 1) % topR.length], ctop, UPV2, tmpC.copy(YBAND[0]));
        yardangs++;
        for (let i = 0; i < 4; i++) { const t = 0.3 + rnd() * 0.7, bx = head[0] + (tail[0] - head[0]) * t + across.x * (W + 3 + rnd() * 6) * (rnd() < 0.5 ? -1 : 1), bz = head[1] + (tail[1] - head[1]) * t + across.z * (W + 3) * (rnd() < 0.5 ? -1 : 1); if (ok0(bx, bz, 2)) pushRock(bx, bz, 1.5 + rnd() * 2.5); }
      }
    }
    vcMesh(yPos, yCol, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));

    // 干上がった塩の窪地: 平らな白い塩の面、縁の湿った暗い砂の帯、ひび割れの網目、縁に吹き寄せた塩の小山
    let saltPan = 0;
    if (PAN) {
      saltPan = 1;
      const [px, pz] = PAN, ang = rnd() * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang), RX = 140, RZ = 88, seed = rnd() * 40;
      const rimR = (t) => 0.74 + 0.36 * fbm(Math.cos(t) * 1.6 + seed, Math.sin(t) * 1.6 - seed, 2);
      const P = (t, f) => { const r = rimR(t) * f, lx = Math.cos(t) * RX * r, lz = Math.sin(t) * RZ * r; return [px + lx * ca + lz * sa, pz - lx * sa + lz * ca]; };
      const NA = 56, core = [], crust = [], rim = [];
      for (let i = 0; i < NA; i++) {
        const t0 = (i / NA) * Math.PI * 2, t1 = ((i + 1) / NA) * Math.PI * 2;
        for (const [f0, f1, arr] of [[0, 0.3, core], [0.3, 0.55, core], [0.55, 0.78, core], [0.78, 0.92, crust], [0.92, 1.0, crust]]) dquad(arr, P(t0, f0), P(t0, f1), P(t1, f1), P(t1, f0), 0.7);   // 地面から 0.7 浮かせる(遠目でも地形とちらつかない)
        const rw0 = 1.1 + 0.22 * fbm(t0 * 1.7 + seed * 2, 3.1, 2), rw1 = 1.1 + 0.22 * fbm(t1 * 1.7 + seed * 2, 3.1, 2);   // 縁の湿った帯の幅は場所でばらつく
        dquad(rim, P(t0, 1.0), P(t0, rw0), P(t1, rw1), P(t1, 1.0), 0.5);
      }
      plateMesh(core, 0xf1f0ea, 0.6); plateMesh(crust, 0xe4dfd1, 0.6); plateMesh(rim, 0xd6cbb2, 0.4);   // 弱い polygonOffset(強いとひびの線が隠れる)
      // ひび割れ: 窪地の局所の格子を揺らした点を隣どうし結ぶ(多角形の網目)
      const cr = [], CELLS = 16, node = new Map();
      const nodeAt = (i, j) => { const key = i * 1000 + j; if (!node.has(key)) { const lx = i * CELLS + (hash2(i + 77, j) - 0.5) * 8, lz = j * CELLS + (hash2(i, j + 91) - 0.5) * 8; node.set(key, [lx, lz]); } return node.get(key); };
      const inPan = ([lx, lz], fmax) => { const t = Math.atan2(lz / RZ, lx / RX); return Math.hypot(lx / RX, lz / RZ) < rimR(t) * fmax; };
      const W2 = ([lx, lz]) => { const x = px + lx * ca + lz * sa, z = pz - lx * sa + lz * ca; return [x, H(x, z) + 1.25, z]; };   // 塩の面(+0.7)より上
      for (let i = -11; i <= 11; i++) for (let j = -8; j <= 8; j++) {
        const a = nodeAt(i, j);
        if (!inPan(a, 0.9)) continue;
        for (const [di, dj] of [[1, 0], [0, 1]]) { const b = nodeAt(i + di, j + dj); if (inPan(b, 0.9) && hash2(i * 3 + di, j * 5 + dj) > 0.08) cr.push(...W2(a), ...W2(b)); }
      }
      const cg = new THREE.BufferGeometry(); cg.setAttribute("position", new THREE.Float32BufferAttribute(cr, 3));
      group.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x8f8775, transparent: true, opacity: 0.95 })));
      // 網目の境の塩の盛り上がり(ひびの縁に沿う細い白い畝)。遠目にも多角形の模様が読める
      const crestP = [];
      for (let q = 0; q < cr.length; q += 6) { const ax = cr[q], az = cr[q + 2], bx = cr[q + 3], bz = cr[q + 5], L = Math.hypot(bx - ax, bz - az); if (hash2(q, 5) < 0.5) crestP.push([box(1.3, 0.9, L * 0.9), { x: (ax + bx) / 2, y: (cr[q + 1] + cr[q + 4]) / 2 - 0.5, z: (az + bz) / 2, ry: Math.atan2(bx - ax, bz - az) }]); }
      if (crestP.length) add(U.merge(THREE, crestP), lam(0xfafaf6), group, { edges: false });
      // 縁の塩の小山と、縁の外の葦に似た乾いた草
      const saltMounds = [];
      for (let i = 0; i < 70; i++) { const t = rnd() * Math.PI * 2, [x, z] = P(t, 0.88 + rnd() * 0.12); const s2 = 1.2 + rnd() * 2.4; saltMounds.push({ x, y: H(x, z) - s2 * 0.25, z, sx: s2 * 1.6, sy: s2 * 0.5, sz: s2, ry: rnd() * 6.28, c: 0xf6f5f0 }); }
      instanced(new THREE.OctahedronGeometry(1, 0), pastel.clone(), saltMounds);
    }

    // 使われていない前哨基地: 土塁の環、コンクリートの壁(崩れた所あり)、門、角の見張り塔(1 基は傾いて崩れかけ)、兵舎(屋根の一部が落ちた)、
    // 指揮所、脚の上の給水槽、旗の無い旗竿、門の外の土嚢の陣地と蛇籠の列、散らばった瓦礫
    let outpost = 0;
    if (OUT) {
      outpost = 1;
      const [ox, oz] = OUT, a = Math.atan2(WIND.x, WIND.z) + 0.35, ca = Math.cos(a), sa = Math.sin(a);
      const P = (u, v) => [ox + u * ca + v * sa, oz - u * sa + v * ca];
      const W = 72, D = 58;
      const hs = []; for (let u = -W / 2 - 14; u <= W / 2 + 14; u += 7) for (let v = -D / 2 - 14; v <= D / 2 + 14; v += 7) hs.push(H(...P(u, v)));
      const y0 = Math.min(...hs) - 0.8, yHi = Math.max(...hs);
      const MO = { conc: lam(0xdfe1de), conc2: lam(0xd0d3d0), dark: M.dark, roof: M.mid, berm: lam(0xd7ccb4), sand: lam(0xc9bc9f), gab: lam(0xb8ad97), steel: M.steel };
      const L = { conc: [], conc2: [], dark: [], roof: [], sand: [], gab: [], steel: [] };
      const pb = (list, u, v, w, h, d, yb, o = {}) => { const [x, z] = P(u, v); list.push([box(w, h, d), { x, y: yb + h / 2, z, ry: a + (o.ry ?? 0), rx: o.rx ?? 0, rz: o.rz ?? 0 }]); };
      // 敷地の砂利の床
      const yard = []; for (let u = -W / 2; u < W / 2; u += 8) for (let v = -D / 2; v < D / 2; v += 8) dquad(yard, P(u, v), P(u + 8, v), P(u + 8, v + 8), P(u, v + 8), 0.3);
      plateMesh(yard, 0xd3c9b3, 2);
      // 土塁の環(各辺は台形の断面の盛土。門の辺は門の前を空ける)
      const bermSeg = (A, B, w, h) => {
        const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz), nx = -dz / l, nz = dx / l, rings = [];
        for (let i = 0; i <= 6; i++) { const t = i / 6, x = A[0] + dx * t, z = A[1] + dz * t, yb = H(x, z) - 1.6, tp = Math.min(1, Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.0)) * 3 + 0.25); rings.push([[-w, 0], [-w * 0.35, h], [w * 0.35, h], [w, 0]].map(([s2, y]) => V(x + nx * s2, yb + y * Math.min(1, tp), z + nz * s2))); }
        k.add(k.closedLoft(rings), MO.berm, group, { edges: false });
      };
      const BW = W / 2 + 11, BD = D / 2 + 11;
      bermSeg(P(-BW, -BD), P(BW, -BD), 6, 3.6); bermSeg(P(BW, -BD), P(BW, BD), 6, 3.6); bermSeg(P(-BW, BD), P(-BW, -BD), 6, 3.6);
      bermSeg(P(BW, BD), P(9, BD), 6, 3.6); bermSeg(P(-9, BD), P(-BW, BD), 6, 3.6);
      // 壁(長さ 5 の板の列。15% は倒れて横たわる)
      const wallLine = (u0, v0, u1, v1, gap) => {
        const l = Math.hypot(u1 - u0, v1 - v0), n = Math.round(l / 5.2), ry = Math.atan2(u1 - u0, v1 - v0) + Math.PI / 2;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, u = u0 + (u1 - u0) * t, v = v0 + (v1 - v0) * t;
          if (gap && Math.abs(u) < 8 && Math.abs(v - D / 2) < 1) continue;
          if (rnd() < 0.15) { const [x, z] = P(u, v); L.conc2.push([box(5, 1, 5.2), { x: x + (rnd() - 0.5) * 3, y: H(x, z) + 0.3, z: z + (rnd() - 0.5) * 3, ry: a + ry + (rnd() - 0.5) * 0.6, rz: (rnd() - 0.5) * 0.2 }]); continue; }
          pb(i % 2 ? L.conc : L.conc2, u, v, 5.1, 5.6 + rnd() * 0.5, 1.1, y0, { ry });
          pb(L.conc2, u, v, 5.1, 0.9, 2.6, y0, { ry });   // 足元の広い台
        }
      };
      wallLine(-W / 2, -D / 2, W / 2, -D / 2); wallLine(W / 2, -D / 2, W / 2, D / 2); wallLine(W / 2, D / 2, -W / 2, D / 2, true); wallLine(-W / 2, D / 2, -W / 2, -D / 2);
      pb(L.conc, -8.6, D / 2, 1.8, 8, 1.8, y0); pb(L.conc, 8.6, D / 2, 1.8, 8, 1.8, y0);   // 門柱
      { const [x, z] = P(4, D / 2 + 6); L.steel.push([box(9, 0.5, 4.6), { x, y: H(x, z) + 0.6, z, ry: a + 0.5, rz: 0.1 }]); }   // 外れて倒れた門扉
      // 角の見張り塔(脚の台、床、小屋、窓の帯、屋根)。1 基は小屋が傾いて崩れかけ
      const broken = Math.floor(rnd() * 4);
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([su, sv], i) => {
        const u = su * (W / 2 - 1), v = sv * (D / 2 - 1), tilt = i === broken;
        pb(L.conc, u, v, 5.4, 11 + yHi - y0, 5.4, y0);
        const yt = yHi + 11, o = tilt ? { rz: 0.32, ry: 0.2 } : {};
        const du = tilt ? su * 1.6 : 0;
        pb(L.conc2, u + du, v, 8, 0.8, 8, yt, o);
        pb(L.conc, u + du, v, 7, 3.6, 7, yt + 0.8, o);
        pb(L.dark, u + du, v, 7.2, 1.1, 7.2, yt + 2.3, o);
        pb(L.roof, u + du, v, 8.2, 0.6, 8.2, yt + 4.4, o);
      });
      // 兵舎 2 棟(屋根の板。1 棟は 3 割の板が落ちて中が見える)と指揮所
      const barrack = (u, v, w, d, holes) => {
        const [lo, hi] = [y0, Math.max(...[[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([du, dv]) => H(...P(u + du, v + dv))))];
        for (const s2 of [-1, 1]) { pb(L.conc, u, v + s2 * (d / 2 - 0.4), w, hi - lo + 5.2, 0.8, lo); pb(L.dark, u, v + s2 * (d / 2 - 0.35), w * 0.82, 1.1, 0.9, hi + 2.6); }
        for (const s2 of [-1, 1]) pb(L.conc, u + s2 * (w / 2 - 0.4), v, 0.8, hi - lo + 5.2, d, lo);
        pb(L.dark, u - w * 0.3, v + d / 2, 2.2, 3.4, 0.4, hi);
        for (let x2 = -w / 2; x2 < w / 2 - 0.1; x2 += 4) {
          if (holes && rnd() < 0.3) { if (rnd() < 0.6) pb(L.roof, u + x2 + 2, v + (rnd() - 0.5) * 3, 3.8, 0.5, d * 0.8, hi + 0.4, { rx: (rnd() - 0.5) * 0.5, rz: (rnd() - 0.5) * 0.6 }); continue; }
          pb(L.roof, u + x2 + 2, v, 4.1, 0.6, d + 1, hi + 5.2);
        }
      };
      barrack(-14, -12, 32, 10, true); barrack(-14, 6, 32, 10, false);
      { const u = 20, v = -8, w = 15, d = 14; pb(L.conc, u, v, w, yHi - y0 + 7.5, d, y0); pb(L.dark, u, v, w + 0.2, 1.2, d + 0.2, yHi + 4.4); pb(L.roof, u, v, w + 1, 0.7, d + 1, yHi + 7.5); pb(L.steel, u + 3, v + 2, 0.4, 9, 0.4, yHi + 8); }
      // 給水槽(4 本脚)と旗竿
      { const [tx, tz] = P(22, 14), ty = H(tx, tz); for (const [du, dv] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) k.tube(group, V(tx + du, ty - 0.5, tz + dv), V(tx + du * 0.7, ty + 12, tz + dv * 0.7), 0.35, MO.steel); add(cyl(4, 5.5, 12), MO.conc2, group, { x: tx, y: ty + 14.6, z: tz }); add(cyl(4.3, 0.5, 12), MO.roof, group, { x: tx, y: ty + 17.6, z: tz }); }
      { const [mx, mz] = P(0, 4); add(cyl(0.35, 24, 6), MO.steel, group, { x: mx, y: H(mx, mz) + 12, z: mz, edges: false }); }
      // 門の外の土嚢の陣地(U 字)と蛇籠の列、瓦礫
      for (const su of [-1, 1]) { const u = su * 22, v = D / 2 + 20; for (const [du, dv, w, d] of [[0, 4, 12, 2.6], [-5, 0, 2.6, 8], [5, 0, 2.6, 8]]) pb(L.sand, u + du, v + dv, w, 2.4, d, H(...P(u, v)) - 0.5); }
      for (let i = 0; i < 9; i++) { const u = -16 + i * 4, v = D / 2 + 9; if (Math.abs(u) < 9) continue; pb(L.gab, u, v, 3.6, 3.2, 3.2, H(...P(u, v)) - 0.4); }
      for (let i = 0; i < 26; i++) { const u = (rnd() - 0.5) * W * 1.1, v = (rnd() - 0.5) * D * 1.1, [x, z] = P(u, v); L.conc2.push([box(1 + rnd() * 2.5, 0.6 + rnd() * 1.2, 1 + rnd() * 2), { x, y: H(x, z) + 0.2, z, ry: rnd() * 6, rx: (rnd() - 0.5) * 0.5 }]); }
      for (const [key, list] of Object.entries(L)) if (list.length) add(U.merge(THREE, list), MO[key], group, { edges: key !== "sand" && key !== "gab" });
    }

    BLOCKS.forEach((g, i) => instanced(g, blockMat, blockLists[i]));
    BLOCKS_BIG.forEach((g, i) => instanced(g, blockMat, bigLists[i]));
    rockLists.forEach((l, i) => instanced(ROCKS[i], rockMat[i], l));
    U.bake(THREE, group, {});
    const count = { blocks: blockLists.reduce((s2, l) => s2 + l.length, 0), bigBlocks: bigLists.reduce((s2, l) => s2 + l.length, 0), rippleLines, ripplePatches, tufts: tufts.length, smallShrubs: smalls.length, pebbles: pebbles.length, gravel: PATCHES.length, outcrops, rocks: rockLists.reduce((s, l) => s + l.length, 0), buttes, crests: crests.length, shrubs: shrubs[0].length + shrubs[1].length, acacias: acacias.length, walls: wallParts.length, tracks: trackGeos.length, ruins, masts, bigBoulders, yardangs, saltPan, outpost };
    return { group, count, landmarks: { saltPan: PAN, yardangs: YARD, outpost: OUT, mesas: MESAS } };   // 目印の中心(撮影・確認用)
  }

  ((window.DreamAssets ??= {}).maps ??= { sites: {} }).decos ??= {};
  DreamAssets.maps.decos.east = east;
})();
