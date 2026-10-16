// 部隊トークン「攻撃ヘリ」v2(試作)。装甲強襲 v3 と同じ方向性: 低く鋭い面構成のステルス機に、実在の攻撃ヘリ(AH-64 / RAH-66)にある装備を足す。
// v2(ユーザー指摘「ディテールを増して現実的な兵器的に」「攻撃はミサイルと機関砲の 2 パターン」):
//   機首下の 3 砲身回転機関砲の砲塔、暗いガラスの照準・暗視センサー、ワイヤーカッター、両脇のエンジンナセル(吸気口と上向きの排気の赤外線抑制器)、
//   ローターのハブ(ブレードグリップ・ピッチリンク・スワッシュプレート)、固定脚(主脚 2 + 尾輪)、板状のパイロンにヘルファイア型ミサイルの 4 連ラック(細い枠) ×2 とロケット弾ポッド ×2、
//   風防の枠(光らない)、ピトー管、ブレードアンテナ、翼端の航法灯(常灯)。センサーのレンズは光らせない。
//   攻撃は 2 種: ミサイル(ラックから 1 発ずつ。撃った弾はラックから消え、数秒で装填し直す)と機関砲(砲身が回り、閃光・曳光弾・薬莢)。
//   レールガンのガトリングは作らない(機関砲は火薬式の回転砲身。理由は検討メモ 9.2)。
//
//   const heli = DreamAssets.heli(THREE);
//   scene.add(heli.group); heli.setTeam(0xff6a1a); heli.setPaint("stealth" | "team" | "white"); heli.fire(); heli.setGunFiring(true); heli.update(dt)
//
// 前方 = +z、上 = +y。ゲームの部隊表示倍率 2.0、浮かぶ高度 20(表示で 40)を前提にした寸法。
(function () {
  const C = { graphite: 0x2c343c, graphite2: 0x3a434c, white: 0xf2f4f6, light: 0xdfe4e9, dark: 0x1e252c, edge: 0x0b1015 };
  const ALT = 20, GROUND = 5.3;   // 飛行高度と、脚が接地する高さ(車輪の下端が y -5.05)

  function heli(THREE, opts = {}) {
    const U = DreamAssets.util;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const basic = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, ...extra });
    const M = {
      hull: lambert(C.graphite), hull2: lambert(C.graphite2), dark: lambert(C.dark), light: lambert(C.light),
      glass: lambert(0x0f2a36, { emissive: 0x06303d }), sensor: lambert(0x18242e), brass: lambert(0xb08d4a), tire: lambert(0x22272c),
      strip: basic(0xff6a1a),
      navL: basic(0xff2a2a), navR: basic(0x2aff6a),   // 航法灯(左赤・右緑、常灯)
      blade: lambert(0x262d34), disc: basic(0xffffff, { transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }),
      flame: basic(0xffb347, { transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
      flashCore: basic(0xfff3d0, { transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
      tracer: basic(0xffb547, { transparent: true, opacity: 0.95, depthWrite: false }),
      trail: basic(0xd3d8dc, { transparent: true, opacity: 0.55, depthWrite: false }),
      edge: new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.55 }),
      ring: basic(0xff6a1a, { transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
      glow: basic(0xff6a1a, { transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
      shadow: basic(0x1f2a33, { transparent: true, opacity: 0.16, depthWrite: false }),
      sign: new THREE.MeshBasicMaterial({ map: U.signTexture(THREE, "ヘ"), transparent: true }),
    };
    const group = new THREE.Group(); group.name = "heli";
    const air = new THREE.Group(); air.position.y = ALT; group.add(air);        // 浮かんでいる部分
    const tilt = new THREE.Group(); air.add(tilt);                              // 前進時の前傾・旋回のバンク
    const add = U.adder(THREE, M.edge, 18);
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const cylZ = (r, h, n = 10) => { const g = new THREE.CylinderGeometry(r, r, h, n); g.rotateX(Math.PI / 2); return g; };   // z 方向の円柱
    const cylX = (r, h, n = 12) => { const g = new THREE.CylinderGeometry(r, r, h, n); g.rotateZ(Math.PI / 2); return g; };   // x 方向の円柱(車輪)
    const Z = new THREE.Vector3(0, 0, 1);
    // 2 点を結ぶ角材(脚の支柱、ピッチリンク、風防の枠)
    const bar = (a, b, w, mat, parent, edges = false) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
      const m = new THREE.Mesh(box(w, w, L), mat); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(Z, d.normalize());
      if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 18), M.edge));
      parent.add(m); return m;
    };

    // ── 機体: 多面体の胴体(側面は上へ行くほど内側へ)→ 尾部ブーム ──
    const BODY = [
      { z: -6.0, pts: U.sym([[1.5, -1.0], [2.0, 0.3], [1.0, 1.5]]) },
      { z: -1.0, pts: U.sym([[2.6, -2.4], [3.3, 0.0], [2.0, 2.6]]) },
      { z: 7.0, pts: U.sym([[2.6, -2.5], [3.1, -0.3], [1.6, 2.4]]) },
      { z: 13.0, pts: U.sym([[1.6, -2.1], [1.9, -0.7], [0.9, 0.9]]) },
      { z: 17.0, pts: U.sym([[0.4, -1.3], [0.5, -0.9], [0.2, -0.5]]) },
    ];
    add(U.loft(THREE, BODY), M.hull, tilt);
    const BOOM = [
      { z: -5.8, pts: U.sym([[1.5, -1.0], [2.0, 0.3], [1.0, 1.5]]) },
      { z: -21.0, pts: U.sym([[0.6, -0.3], [0.8, 0.4], [0.45, 1.0]]) },
    ];
    add(U.loft(THREE, BOOM), M.hull2, tilt);
    // 縦列複座の風防(暗いガラス)と、その後ろの機関の背
    const CANOPY = [
      { z: 3.6, pts: U.sym([[1.7, 2.1], [1.35, 3.3], [0.5, 3.75]]) },
      { z: 8.8, pts: U.sym([[1.75, 2.0], [1.3, 3.2], [0.5, 3.6]]) },
      { z: 12.8, pts: U.sym([[1.0, 1.0], [0.75, 1.5], [0.25, 1.7]]) },
    ];
    add(U.loft(THREE, CANOPY), M.glass, tilt);
    // 風防の枠(光らない): 天面の中心線と、前席・後席の間の横枠
    U.edgeStrip(THREE, M.dark, CANOPY, (sec) => [0, sec.pts[sec.pts.length - 1][1]], 0, 2, tilt, { w: 0.16, h: 0.12, lift: 0.04, up: true });
    { const sec = CANOPY[1]; for (let i = 0; i < sec.pts.length - 1; i++) { const [x1, y1] = sec.pts[i], [x2, y2] = sec.pts[i + 1]; const o = (x) => Math.sign(x || 1) * 0.05; bar([x1 + o(x1), y1 + 0.04, sec.z], [x2 + o(x2), y2 + 0.04, sec.z], 0.14, M.dark, tilt); } }
    add(U.loft(THREE, [
      { z: -5.0, pts: U.sym([[1.6, 1.4], [2.0, 2.6], [1.1, 3.4]]) },
      { z: 0.5, pts: U.sym([[2.0, 2.2], [2.3, 3.4], [1.3, 4.3]]) },
      { z: 3.8, pts: U.sym([[1.6, 2.2], [1.8, 3.2], [0.9, 3.8]]) },
    ]), M.hull2, tilt);
    // 光る線(チーム色): 胴体の側面の折れ目と尾部ブーム
    U.edgeStrip(THREE, M.strip, BODY, 4, 0, 3, tilt); U.edgeStrip(THREE, M.strip, BODY, 1, 0, 3, tilt);
    U.edgeStrip(THREE, M.strip, BOOM, 4, 0, 1, tilt, { w: 0.12, h: 0.16 }); U.edgeStrip(THREE, M.strip, BOOM, 1, 0, 1, tilt, { w: 0.12, h: 0.16 });

    // ── エンジンナセル(両脇): 前に吸気口、後ろに上向きの排気(赤外線抑制器) ──
    for (const sx of [-1, 1]) {
      const P = (pts) => pts.map(([x, y]) => [sx * x, y]);
      add(U.loft(THREE, [
        { z: -5.2, pts: P([[2.2, 1.6], [3.2, 1.6], [3.5, 2.4], [2.9, 3.1], [2.0, 3.1]]) },
        { z: -2.0, pts: P([[2.3, 1.4], [3.9, 1.4], [4.2, 2.5], [3.4, 3.6], [2.0, 3.6]]) },
        { z: 2.4, pts: P([[2.3, 1.4], [3.9, 1.4], [4.2, 2.5], [3.4, 3.6], [2.0, 3.6]]) },
        { z: 4.2, pts: P([[2.0, 1.8], [3.0, 1.8], [3.2, 2.4], [2.7, 3.0], [2.0, 3.0]]) },
      ]), M.hull2, tilt);
      add(box(1.0, 1.0, 0.3), M.dark, tilt, { x: sx * 2.6, y: 2.4, z: 4.3 });                    // 吸気口
      add(box(1.0, 0.9, 2.0), M.dark, tilt, { x: sx * 3.0, y: 2.9, z: -6.0, rx: -0.5 });          // 排気の赤外線抑制器(後ろ上がり)
      add(box(0.7, 0.5, 0.2), M.sensor, tilt, { x: sx * 3.0, y: 2.9 + Math.sin(0.5) * 1.0, z: -6.0 - Math.cos(0.5) * 1.0, rx: -0.5, edges: false });   // 排気口
      add(box(1.2, 0.08, 0.14), M.dark, tilt, { x: sx * 3.1, y: 3.62, z: 0.2, edges: false });   // 点検パネルの継ぎ目
    }

    // ── 機首: 照準・暗視センサー(暗いガラスの窓)、ワイヤーカッター、ピトー管、アンテナ ──
    add(box(1.7, 1.3, 1.5), M.hull2, tilt, { y: -2.0, z: 14.6 });
    for (const sx of [-1, 1]) add(box(0.5, 0.45, 0.12), M.sensor, tilt, { x: sx * 0.4, y: -2.0, z: 14.6 + 0.75 + 0.04, edges: false });
    add(box(0.12, 1.4, 0.9), M.dark, tilt, { y: 4.3, z: 3.5, rx: -0.5 });      // 上のワイヤーカッター(風防の前上)
    add(box(0.12, 1.2, 0.8), M.dark, tilt, { y: -3.1, z: 7.4, rx: 0.5 });      // 下のワイヤーカッター(機関砲の前)
    add(cylZ(0.07, 2.4, 6), M.dark, tilt, { y: -0.9, z: 18.1, edges: false });  // ピトー管
    add(box(0.1, 0.9, 1.3), M.dark, tilt, { y: 1.3 + 0.4, z: -12.0, edges: false });   // ブレードアンテナ(ブーム上)
    add(box(0.1, 0.7, 1.1), M.dark, tilt, { y: -2.47 - 0.3, z: 5.0, edges: false });    // ブレードアンテナ(腹)

    // ── 機関砲塔(機首下): 旋回する砲塔に 3 砲身の回転機関砲(火薬式、20mm 級)。砲身は撃つときだけ回る ──
    const chin = new THREE.Group(); chin.position.set(0, -2.4, 10.6); tilt.add(chin);
    add(new THREE.CylinderGeometry(1.1, 1.1, 1.3, 10), M.hull2, chin, { y: -0.45 });               // 砲塔の筐体(胴体に少し沈める)
    add(box(1.4, 0.9, 1.8), M.dark, chin, { y: -1.3, z: 0.6 });                                    // 砲の受け(揺架)
    const barrels = new THREE.Group(); barrels.position.set(0, -1.3, 1.5); chin.add(barrels);
    const BARREL_L = 5.2;
    for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k * Math.PI * 2) / 3; add(cylZ(0.14, BARREL_L, 8), M.dark, barrels, { x: Math.cos(a) * 0.3, y: Math.sin(a) * 0.3, z: BARREL_L / 2, edges: false }); }
    add(cylZ(0.5, 0.4, 8), M.light, barrels, { z: 1.0, edges: false }); add(cylZ(0.5, 0.4, 8), M.light, barrels, { z: BARREL_L - 0.6, edges: false });   // 砲身の締め具
    const MUZZLE_Z = 1.5 + BARREL_L;
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, -1.3, MUZZLE_Z); chin.add(muzzle);
    const flash = U.flashAt(THREE, add, M.flame, M.flashCore, chin, MUZZLE_Z, 0.7); flash.position.y = -1.3;

    // ── 尾部: 後退した垂直尾翼に内蔵のファン、小さな水平尾翼、尾輪 ──
    add(U.loft(THREE, [
      { z: -19.4, pts: [[-0.55, -0.4], [0.55, -0.4], [0.55, 2.4], [-0.55, 2.4]] },
      { z: -24.6, pts: [[-0.55, -0.6], [0.55, -0.6], [0.55, 6.4], [-0.55, 6.4]] },
      { z: -26.6, pts: [[-0.4, 0.4], [0.4, 0.4], [0.4, 6.8], [-0.4, 6.8]] },
    ]), M.hull2, tilt);
    add(cylX(1.7, 1.25, 12), M.dark, tilt, { y: 1.7, z: -23.2 });
    const fan = new THREE.Group(); fan.position.set(0, 1.7, -23.2); tilt.add(fan);
    for (let k = 0; k < 4; k++) add(box(0.2, 2.9, 0.35), M.light, fan, { rx: (k * Math.PI) / 4, edges: false });
    add(box(7.2, 0.25, 2.0), M.hull2, tilt, { y: 0.2, z: -19.6 });
    for (const sx of [-1, 1]) add(box(0.25, 1.4, 1.8), M.hull2, tilt, { x: sx * 3.6, y: 0.75, z: -19.7 });
    bar([0, -0.3, -20.5], [0, -4.1, -20.5], 0.22, M.dark, tilt, true);                    // 尾輪の支柱
    add(cylX(0.55, 0.4, 10), M.tire, tilt, { y: -4.5, z: -20.5 });                          // 尾輪(下端 -5.05)

    // ── 主脚(固定、左右): 胴体の下隅から外へ開く支柱と、後ろへの斜めの支え、車輪 ──
    for (const sx of [-1, 1]) {
      bar([sx * 2.3, -2.3, 6.0], [sx * 3.0, -4.3, 6.0], 0.24, M.dark, tilt, true);
      bar([sx * 3.0, -4.3, 6.0], [sx * 2.3, -2.3, 3.6], 0.16, M.dark, tilt);
      add(cylX(0.75, 0.5, 12), M.tire, tilt, { x: sx * 3.35, y: -4.3, z: 6.0 });           // 車輪(下端 -5.05)
      add(cylX(0.3, 0.56, 8), M.light, tilt, { x: sx * 3.35, y: -4.3, z: 6.0, edges: false });   // ホイール
    }

    // ── 短い翼と翼下のパイロン: 内側にロケット弾ポッド、外側に対戦車ミサイルの 4 連ラック。翼端に航法灯 ──
    add(U.loft(THREE, [
      { z: -0.6, pts: [[-8.4, -1.2], [8.4, -1.2], [8.4, -0.85], [-8.4, -0.85]] },
      { z: 2.8, pts: [[-7.6, -1.3], [7.6, -1.3], [7.6, -0.95], [-7.6, -0.95]] },
    ]), M.hull2, tilt);
    // ミサイル 1 発(AGM-114 ヘルファイアに寄せる): 丸い暗色のシーカードーム、黄(実弾頭)・茶(実モーター)の識別帯、
    // ドームの後ろの小さな 4 枚フィン、後端のクリップドデルタの 4 枚フィン(X 配置)、ラックへ掛ける吊り金具 2 つ。色は頂点色で 1 ジオメトリに
    const col = (h) => new THREE.Color(h);
    const part = (geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}, color) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
      return { geo: g, color: col(color) };
    };
    const MR = 0.25, GREY = 0xdfe4e9, X4 = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);
    const finG = U.loft(THREE, [   // クリップドデルタ(根元 0.7、先端 0.2、高さ 0.5。前縁が後退)
      { z: -2.0, pts: [[-0.025, 0], [0.025, 0], [0.025, 0.5], [-0.025, 0.5]] },
      { z: -1.3, pts: [[-0.025, 0], [0.025, 0], [0.025, 0.15], [-0.025, 0.15]] },
    ]);
    const domeG = new THREE.SphereGeometry(MR, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2); domeG.rotateX(Math.PI / 2);
    const missileG = U.concat(THREE, [
      part(cylZ(MR, 3.9, 12), { z: -0.05 }, GREY),                                   // 胴(z -2.0 〜 1.9)
      part(domeG, { z: 1.9 }, 0x18242e),                                              // シーカードーム(暗いガラス)
      part(cylZ(MR + 0.01, 0.1, 12), { z: 1.82 }, 0x2c343c),                          // ドームの継ぎ目
      part(cylZ(MR + 0.012, 0.14, 12), { z: 1.25 }, 0xd9b400),                        // 黄帯(実弾頭)
      part(cylZ(MR + 0.012, 0.14, 12), { z: -0.9 }, 0x6b4a2b),                        // 茶帯(実モーター)
      ...X4.map((a) => part(box(0.04, 0.28, 0.42), { z: 1.45, rz: a - Math.PI / 2, x: Math.cos(a) * (MR + 0.14), y: Math.sin(a) * (MR + 0.14) }, GREY)),   // 前方の小フィン
      ...X4.map((a) => part(finG, { rz: a - Math.PI / 2, x: Math.cos(a) * MR, y: Math.sin(a) * MR }, GREY)),                                  // 後端のフィン(根元を胴の面に)
      part(box(0.1, 0.14, 0.3), { y: MR + 0.06, z: 0.8 }, 0x8f98a3), part(box(0.1, 0.14, 0.3), { y: MR + 0.06, z: -0.6 }, 0x8f98a3),      // 吊り金具(+y 側。ラックでは枠の方へ向ける)
    ]);
    const M_vc = U.vcLambert(THREE);
    // パイロン: 板状(前後を尖らせた翼型の断面)。翼の下面から吊り下げ、下端で武装につなぐ
    const pylonG = (h0, h1) => U.loft(THREE, [
      { z: -0.5, pts: [[-0.05, h0], [0.05, h0], [0.05, h1], [-0.05, h1]] },
      { z: -0.1, pts: [[-0.17, h0], [0.17, h0], [0.17, h1], [-0.17, h1]] },
      { z: 1.5, pts: [[-0.17, h0], [0.17, h0], [0.17, h1], [-0.17, h1]] },
      { z: 2.5, pts: [[-0.05, h0], [0.05, h0], [0.05, h1], [-0.05, h1]] },
    ]);
    const rackPos = [];   // ラックに載っているミサイルの位置(tilt の座標)と吊り金具の向き
    for (const sx of [-1, 1]) {
      // 内側: ロケット弾ポッド(7 連の筒の口が見える)
      add(pylonG(-2.15, -1.25), M.hull2, tilt, { x: sx * 4.9 });
      add(cylZ(0.85, 5.6, 12), M.light, tilt, { x: sx * 4.9, y: -2.9, z: 0.9 });
      add(cylZ(0.2, 0.16, 6), M.dark, tilt, { x: sx * 4.9, y: -2.9, z: 3.76, edges: false });
      for (let k = 0; k < 6; k++) add(cylZ(0.2, 0.16, 6), M.dark, tilt, { x: sx * 4.9 + Math.cos((k * Math.PI) / 3) * 0.5, y: -2.9 + Math.sin((k * Math.PI) / 3) * 0.5, z: 3.76, edges: false });
      add(cylZ(0.7, 0.12, 12), M.dark, tilt, { x: sx * 4.9, y: -2.9, z: -1.94, edges: false });
      // 外側: ミサイルの 4 連ラック(M299 のような細い縦長の枠。四隅のレールにミサイルが掛かる)
      add(pylonG(-2.15, -1.25), M.hull2, tilt, { x: sx * 7.0 });
      add(box(0.5, 1.7, 3.0), M.light, tilt, { x: sx * 7.0, y: -2.95, z: 1.0 });
      for (const y of [-2.55, -3.45]) for (const dx of [-0.6, 0.6]) {
        add(box(0.14, 0.16, 2.4), M.dark, tilt, { x: sx * 7.0 + dx * 0.5, y, z: 1.0, edges: false });   // レール(枠の側面)
        rackPos.push({ x: sx * 7.0 + dx, y, z: 1.0, rz: dx > 0 ? Math.PI / 2 : -Math.PI / 2, reload: 0 });   // 吊り金具(+y)を枠の方(内側)へ
      }
      // 航法灯(左赤・右緑、常灯)
      add(box(0.3, 0.25, 0.6), sx < 0 ? M.navL : M.navR, tilt, { x: sx * 8.35, y: -1.07, z: 1.1, edges: false });
    }
    const rack = new THREE.InstancedMesh(missileG, M_vc, rackPos.length); tilt.add(rack);
    const mt = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(), mv = new THREE.Vector3(), eul = new THREE.Euler();
    const layRack = () => { rackPos.forEach((p, i) => { mt.compose(mv.set(p.x, p.y, p.z), mq.setFromEuler(eul.set(0, 0, p.rz)), ms.setScalar(p.reload > 0 ? 0.001 : 1)); rack.setMatrixAt(i, mt); }); rack.instanceMatrix.needsUpdate = true; };
    layRack();

    // ── 主ローター: マスト、スワッシュプレート、ハブにブレードグリップとピッチリンク、4枚のブレード。回ると薄い円盤が見える ──
    add(new THREE.CylinderGeometry(0.5, 0.65, 1.6, 6), M.dark, tilt, { y: 4.9, z: 0.5, edges: false });
    add(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 10), M.dark, tilt, { y: 4.55, z: 0.5, edges: false });   // 固定側のスワッシュプレート
    const rotor = new THREE.Group(); rotor.position.set(0, 5.9, 0.5); tilt.add(rotor);
    add(new THREE.CylinderGeometry(1.5, 1.7, 0.9, 8), M.hull2, rotor);
    add(new THREE.CylinderGeometry(1.2, 1.2, 0.25, 10), M.dark, rotor, { y: -1.0, edges: false });          // 回転側のスワッシュプレート
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 8), M.dark, rotor, { y: 0.65, edges: false });            // ハブのキャップ
    const bladeG = U.loft(THREE, [
      { z: 1.2, pts: [[-0.75, -0.08], [0.75, -0.08], [0.75, 0.08], [-0.75, 0.08]] },
      { z: 25.0, pts: [[-0.75, -0.08], [0.75, -0.08], [0.75, 0.08], [-0.75, 0.08]] },
      { z: 26.4, pts: [[-0.3, -0.06], [0.75, -0.06], [0.75, 0.06], [-0.3, 0.06]] },
    ]);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, g = new THREE.Group(); g.rotation.y = a; rotor.add(g);
      add(bladeG, M.blade, g, { edges: false });
      add(box(0.9, 0.5, 2.0), M.dark, g, { z: 2.2, edges: false });                                      // ブレードグリップ
      bar([0.55, -0.9, 1.1], [0.55, 0.0, 1.9], 0.1, M.light, g);                                           // ピッチリンク(スワッシュプレートからグリップへ)
    }
    const discG = new THREE.RingGeometry(1.8, 26.4, 48); discG.rotateX(-Math.PI / 2);
    const disc = add(discG, M.disc, tilt, { y: 5.95, z: 0.5, edges: false });

    // ── 地面: 影とベースプレート(ローターの円まで囲む)と記号板 ──
    const plate = new THREE.Group(); group.add(plate);
    const flat = (g, m, y, z = 0) => { g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, m); o.position.set(0, y, z); plate.add(o); return o; };
    const shadow = flat(new THREE.CircleGeometry(9, 24), M.shadow, 0.15); shadow.scale.set(0.7, 1, 1.9);
    const far = U.reach(THREE, group, air);
    const inner = far + 1.5, outer = inner + 3;
    flat(new THREE.RingGeometry(inner, outer, 64), M.ring, 0.25);
    flat(new THREE.CircleGeometry(inner - 0.4, 64), M.glow, 0.2);
    flat(new THREE.PlaneGeometry(6.5, 6.5), M.sign, 0.35, outer + 3.6);

    // ── 飛ぶミサイル(ラックから撃つ)。先に 8 発ぶん作って使い回す ──
    const flameG = new THREE.ConeGeometry(0.3, 1.6, 6); flameG.rotateX(-Math.PI / 2);
    const trailG = new THREE.BoxGeometry(0.4, 0.4, 1); trailG.translate(0, 0, -0.5);
    const missiles = Array.from({ length: 8 }, () => {
      const mesh = new THREE.Mesh(missileG, M_vc); mesh.visible = false; group.add(mesh);
      const fl = new THREE.Mesh(flameG, M.flame); fl.position.z = -2.8; mesh.add(fl);
      const trail = new THREE.Mesh(trailG, M.trail.clone()); trail.position.z = -3.2; mesh.add(trail);
      return { mesh, trail, t: 9, dir: new THREE.Vector3() };
    });
    // ── 機関砲の曳光弾と薬莢(トークンの座標に置き、機体の揺れに引きずられない) ──
    const TRACERS = 10, tracers = new THREE.InstancedMesh(box(0.14, 0.14, 2.6), M.tracer, TRACERS); tracers.visible = false; group.add(tracers);
    const tracer = Array.from({ length: TRACERS }, () => ({ t: 9, pos: new THREE.Vector3(), vel: new THREE.Vector3() }));
    const CASES = 16, cases = new THREE.InstancedMesh(box(0.1, 0.1, 0.32), M.brass, CASES); cases.visible = false; group.add(cases);
    const casing = Array.from({ length: CASES }, () => ({ t: 9, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0 }));
    const rng = U.rng(5);
    // ── 発射演出のリアル版(2026-10-16。setFxStyle("real") で切替)。機関砲: 30mm 級 約 10 発/秒。1 発ごとに小さな閃光と火球、薄い煙、2 発に 1 発の曳光弾(重力で少し落ちる)。
    //    ミサイル: 発射の閃光とブースターの白煙、飛んでいる間はモーターの炎(光の玉の明滅)と、数秒残る白い煙の尾(進んだ距離ごとに粒を置く) ──
    const gunFx = U.muzzleFx(THREE, group, { ground: GROUND, seed: 43,
      flash: { pool: 2, len: 0.035, size: [2.2, 4.2], tongue: { len: [4, 6.5], width: [1.4, 2.0], side: 0 } }, light: { len: 0.04, power: 20000, z: 2 },
      balls: { per: 2, pool: 8, len: 0.1, size: 1.5, speed: 35, length: 3 },
      smoke: { per: 1, pool: 30, len: [1.2, 2.0], speed: 8, spread: 0.6, drag: 1.5, rise: 2, size: [0.7, 1.2], grow: [3, 6], peak: 0.3, ahead: [0.5, 2] },
      tracers: { pool: 16, speed: 330, len: 1.3, drop: 25 } });
    const msFx = U.muzzleFx(THREE, group, { ground: GROUND, seed: 47,
      flash: { pool: 4, len: 0.02, size: [2.8, 3.2], color: 0xfff0c8, z: [0, 0], tongue: null }, light: { len: 0.15, power: 50000, z: 1 },   // 炎は光の玉を 1 フレームずつ置き直す(尾部に 1 つだけ見える)
      smoke: { per: 6, pool: 160, len: [3.5, 5.5], speed: 5, spread: 1.2, drag: 1.2, rise: 1.0, size: [1.2, 2.0], grow: [6, 11], peak: 0.5, fadeIn: 0.15, delay: [0, 0], ahead: [-1, 1], cols: [0xf2f4f6, 0xd8dde2, 0xe6e9ec] } });
    const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), bq = new THREE.Quaternion(), bp = new THREE.Vector3();
    let fxStyle = opts.fxStyle ?? "stylized", nextShot = 0, shotN = 0;

    // ── 動き ──
    let flying = true, forward = false, clock = 0, alt = ALT, rotorSpeed = 1, slot = 0, gunFiring = false, spin = 0, nextTracer = 0, nextCase = 0, shake = 0;
    const tmp = new THREE.Vector3(), fq = new THREE.Quaternion(), gq = new THREE.Quaternion();
    const toGroup = (obj) => { group.updateMatrixWorld(true); obj.getWorldPosition(tmp); group.worldToLocal(tmp); obj.getWorldQuaternion(fq); group.getWorldQuaternion(gq); fq.premultiply(gq.invert()); };   // obj の位置・向きをトークンの座標に
    function update(dt) {
      clock += dt;
      const targetAlt = flying ? ALT : GROUND;
      alt += (targetAlt - alt) * Math.min(1, dt * 1.2);
      const targetRotor = flying ? 1 : 0.35;
      rotorSpeed += (targetRotor - rotorSpeed) * Math.min(1, dt * 0.8);
      air.position.y = alt + (flying ? Math.sin(clock * 1.6) * 0.35 : 0);
      rotor.rotation.y -= dt * 22 * rotorSpeed;
      fan.rotation.x += dt * 30 * rotorSpeed;
      M.disc.opacity = 0.1 * rotorSpeed;
      // 機関砲: 砲身の回転が立ち上がってから撃ち始める。閃光は発射ごとに明滅、曳光弾は数発に 1 発、薬莢は右へ排出
      spin += ((gunFiring && flying ? 1 : 0) - spin) * Math.min(1, dt * 3);
      barrels.rotation.z += dt * 40 * spin;
      const shooting = gunFiring && flying && spin > 0.75;
      flash.visible = shooting && fxStyle === "stylized" && Math.floor(clock * 50) % 2 === 0;
      shake = shooting ? 0.003 * Math.sin(clock * 70) : 0;
      if (shooting) {
        if (fxStyle === "real") { nextShot -= dt; if (nextShot <= 0) { nextShot += 0.1; gunFx.fire(muzzle); if (shotN++ % 2 === 0) gunFx.tracer(muzzle); } }
        else { nextTracer -= dt; if (nextTracer <= 0) { nextTracer += 0.1; spawnTracer(); } }
        nextCase -= dt; if (nextCase <= 0) { nextCase += 0.045; spawnCase(); }
      }
      const pitch = (forward && flying ? 0.16 : 0) + shake, bank = forward && flying ? Math.sin(clock * 0.5) * 0.12 : 0;
      tilt.rotation.x += (pitch - tilt.rotation.x) * Math.min(1, dt * 2);
      tilt.rotation.z += (bank - tilt.rotation.z) * Math.min(1, dt * 2);
      // 影は高度に応じて濃さと大きさが変わる
      const h = (alt - GROUND) / (ALT - GROUND);
      M.shadow.opacity = 0.26 - 0.12 * h; shadow.scale.set(0.7 + 0.25 * h, 1, 1.9 + 0.3 * h);
      // ラックの装填(撃った場所に数秒で戻る。ビューアで繰り返し撃てるようにする便宜)
      let relay = false;
      for (const p of rackPos) if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) relay = true; }
      if (relay) layRack();
      // 飛ぶミサイル: 発射直後は遅く、モーターで加速。白い煙の航跡が伸びて薄れる
      for (const m of missiles) {
        if (!m.mesh.visible) continue;
        m.t += dt;
        const v = Math.min(160, 30 + m.t * 220);
        m.mesh.position.addScaledVector(m.dir, v * dt);
        const styl = fxStyle === "stylized"; m.mesh.children.forEach((ch) => (ch.visible = styl));   // デフォルメ版の炎と尾
        if (styl) { m.trail.scale.z = Math.min(14, m.t * 30); m.trail.material.opacity = Math.max(0, 0.55 - m.t * 0.4); }
        else {   // リアル版: モーターの炎(尾部の光の玉)と、進んだ 2.5 ごとに置く白い煙の尾
          bq.copy(m.mesh.quaternion).multiply(FLIP); bp.copy(m.mesh.position).addScaledVector(m.dir, -2.8);
          msFx.spawn("flash", bp, bq, 1);
          m.dist = (m.dist ?? 0) + v * dt; while (m.dist >= 2.5) { m.dist -= 2.5; msFx.spawn("smoke", bp, bq, 1); }
        }
        if (m.t > 1.4) m.mesh.visible = false;
      }
      // 曳光弾(0.6 秒で消える)と薬莢(0.7 秒、重力で落ちながら回る)
      let anyT = false;
      tracer.forEach((tr, i) => {
        if (tr.t < 0.6) { tr.t += dt; tr.vel.y -= 25 * dt; tr.pos.addScaledVector(tr.vel, dt); anyT = true; }
        mt.compose(tr.pos, tr.t < 0.6 ? mq.setFromUnitVectors(Z, mv.copy(tr.vel).normalize()) : mq.identity(), ms.setScalar(tr.t < 0.6 ? 1 : 0.001)); tracers.setMatrixAt(i, mt);
      });
      tracers.visible = anyT; tracers.instanceMatrix.needsUpdate = true;
      let anyC = false;
      casing.forEach((c, i) => {
        if (c.t < 0.7) { c.t += dt; c.vel.y -= 45 * dt; c.pos.addScaledVector(c.vel, dt); anyC = true; }
        mt.compose(c.pos, mq.setFromEuler(eul.set(c.t * 9 * c.spin, c.t * 7, 0)), ms.setScalar(c.t < 0.7 ? 1 : 0.001)); cases.setMatrixAt(i, mt);
      });
      cases.visible = anyC; cases.instanceMatrix.needsUpdate = true;
      gunFx.update(dt); msFx.update(dt);
    }
    function spawnTracer() {
      const tr = tracer.find((x) => x.t >= 0.6); if (!tr) return;
      toGroup(muzzle); tr.pos.copy(tmp); tr.vel.set(0, 0, 1).applyQuaternion(fq).multiplyScalar(330); tr.t = 0;
    }
    function spawnCase() {
      const c = casing.find((x) => x.t >= 0.7); if (!c) return;
      toGroup(chin); c.pos.copy(tmp).add(mv.set(1.0, -0.6, 0.2).applyQuaternion(fq));
      c.vel.set(5 + rng() * 3, 1 + rng() * 2, -2 + rng()).applyQuaternion(fq); c.spin = 0.5 + rng(); c.t = 0;
    }
    function fire() {
      if (!flying) return;
      let p = null; for (let k = 0; k < rackPos.length; k++) { const cand = rackPos[(slot + k) % rackPos.length]; if (cand.reload <= 0) { p = cand; slot = (slot + k + 1) % rackPos.length; break; } }
      const m = missiles.find((x) => !x.mesh.visible); if (!p || !m) return;
      group.updateMatrixWorld(true);
      tmp.set(p.x, p.y, p.z); tilt.localToWorld(tmp); m.mesh.position.copy(group.worldToLocal(tmp));
      tilt.getWorldQuaternion(fq); group.getWorldQuaternion(gq); fq.premultiply(gq.invert());
      m.mesh.quaternion.copy(fq);
      m.dir.set(0, 0, 1).applyQuaternion(fq).add(tmp.set(0, -0.12, 0)).normalize();
      m.t = 0; m.dist = 0; m.trail.scale.z = 0.01; m.trail.material.opacity = 0.55; m.mesh.visible = true;
      if (fxStyle === "real") { msFx.fireAt(m.mesh.position, bq.copy(fq).multiply(FLIP)); msFx.spawn("flash", m.mesh.position, fq, 2); }   // 発射の閃光と、後ろへ噴くブースターの白煙
      p.reload = 6; layRack();
    }
    let teamColor = new THREE.Color(0xff6a1a), paint = opts.paint ?? "stealth";
    function applyPaint() {
      const tc = teamColor.clone();
      if (paint === "stealth") { M.hull.color.set(C.graphite); M.hull2.color.set(C.graphite2); M.blade.color.set(0x262d34); M.strip.color.copy(tc); M.edge.color.set(0x0b1015); }
      else if (paint === "team") { M.hull.color.copy(tc); M.hull2.color.copy(tc).multiplyScalar(0.78); M.blade.color.set(0x3b4752); M.strip.color.set(0xffffff); M.edge.color.set(0x141b21); }
      else { M.hull.color.set(C.white); M.hull2.color.set(C.light); M.blade.color.set(0x8f98a3); M.strip.color.copy(tc); M.edge.color.set(0x3b4752); }
      M.ring.color.copy(tc); M.glow.color.copy(tc);
    }
    applyPaint();
    // 隙間の確認値(すべて正なら貫通・接地割れなし)
    const check = () => ({
      barrelsToSensor: +((-2.0 - 0.65) - (-2.4 - 1.3 + 0.3 + 0.14)).toFixed(2),   // 砲身の上端とセンサーの箱の下端
      wheelsAboveGround: +(GROUND - 5.05).toFixed(2),                              // 接地時の車輪の下端(主脚・尾輪とも -5.05)
      rackAboveGround: +(GROUND - 3.8).toFixed(2),                                 // 接地時のラックの枠の下端
      gunAboveGround: +(GROUND - (2.4 + 1.3 + 0.45)).toFixed(2),                   // 接地時の砲の受けの下端
      rotorToExhaust: +((5.9 - 0.08) - (2.9 + Math.sin(0.5) * 1.0 + 0.45)).toFixed(2),   // ブレードと排気口の上端
    });
    // 動かない部品を焼いてまとめる(浮く部分・前傾・ローター・尾部ファン・砲塔・砲身は別。塗りで変わる hull / hull2 / blade / strip はマテリアルごと)
    U.bake(THREE, group, { dynamic: [air, tilt, rotor, fan, chin, barrels], live: [M.hull, M.hull2, M.blade, M.strip], also: [M.strip, M.navL, M.navR] });
    return {
      group, update, fire, check, stats: () => U.stats(group), parts: { plate, rotor, air, chin }, plateRadius: outer, setFxStyle: (st) => (fxStyle = st === "real" ? "real" : "stylized"), get fxStyle() { return fxStyle; },
      setTeam(c) { teamColor = new THREE.Color(c ?? 0x8f98a3); applyPaint(); }, setPaint(p) { paint = p; applyPaint(); },
      setFlying: (b) => (flying = b), setForward: (b) => (forward = b), setGunFiring: (b) => (gunFiring = b),
      get flying() { return flying; }, get forward() { return forward; }, get paint() { return paint; }, get gunFiring() { return gunFiring; },
    };
  }

  (window.DreamAssets ??= {}).heli = heli;
})();
