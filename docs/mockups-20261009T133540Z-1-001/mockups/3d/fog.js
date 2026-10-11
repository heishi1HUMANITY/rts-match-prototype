// 霧(探索状態)の見せ方の試作。現行は高さ 2.5 の紙の平面を探索状態で透かす方式で、背の高い模型(施設は表示倍率 3)が平面を突き抜ける。
// 新方式「マスク」: 霧の判定を模型の側でする。すべての材質に共通の処理を足し、断片(ピクセル)の世界の xz で探索グリッドを引いて
//   未探索 → 描かない(高さに関係なく消える。下の紙が見える)/ 探索済み → 紙の色に寄せて色を抜く(記憶の中の姿)/ 可視 → そのまま
//   境目は破いた紙のようなぎざぎざ(ノイズでずらす)と、鉛筆の線
// 見本: 地形の盤面(9.11)に発電所・研究所・守備NPC を置き、斥候の視界(と自陣の視界)で探索が進む。現行の平面方式と切り替えて比べる。
//
// 新方式「クレヨン」: 見えない場所(未探索のセルと、盤面の周辺 2〜3 セル分)を灰色のクレヨンのなぐり描きで塗りつぶす(実際には何かがあるが見えない、という表現)。
//   目(レンズ)の一部を平面的に塗られたイメージ。模型の凹凸には左右されない: 未探索かどうかは模型のピクセルごとに判定(マスク方式と同じ判定を
//   別に 1 回描いて画面大のマスクにする)し、その上に画面全体の板 1 枚でクレヨンを塗る。塗りはマスクの外へぎざぎざにはみ出す。
//   柄は盤面の位置に固定(揺らした多角形の区画ごとに、その区画の中心が映る点・カメラの方位角・奥行きの縮尺で画面の位置を盤面の座標に直す)
//
//   const f = DreamAssets.fog(THREE);  scene.add(f.group); f.setMode("mask" | "crayon" | "plane"); f.reset(); f.update(dt)
(function () {
  const CELL = 80, COLS = 20, ROWS = 14, W = COLS * CELL, H = ROWS * CELL, LAND = 18;
  const PAPER = 0xf3f1ec;

  function paperTexture(THREE) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#f3f1ec"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(120,115,100,0.22)"; g.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) { g.beginPath(); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, 256); g.stroke(); g.beginPath(); g.moveTo(0, i + 0.5); g.lineTo(256, i + 0.5); g.stroke(); }
    g.strokeStyle = "rgba(120,115,100,0.08)"; g.lineWidth = 6;
    g.beginPath(); g.moveTo(20, 230); g.lineTo(120, 150); g.stroke();
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // クレヨンの塗りの柄(つなぎ目のない繰り返し 1 枚)。太いクレヨンの線を、ほぼ同じ向きに往復させて何層も重ねる。
  // 1 本の線は、細い線を幅の中に何本も並べ、それぞれをとぎれとぎれにして描く(ろうの筋とかすれ)。線どうしの間には紙が少し残る
  function crayonPattern(THREE, seed) {
    const N = 1024, c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d"), rnd = DreamAssets.util.rng(seed);
    g.lineCap = "round"; g.strokeStyle = "#000";
    // 1 本のクレヨンの線(折れ線)を描く。つなぎ目が出ないよう 9 か所にずらして描く
    const crayon = (pts, w, strength) => {
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        g.globalAlpha = 0.1 * strength; g.lineWidth = w * 0.75; g.setLineDash([]);
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy))); g.stroke();
      }
      const sub = 9;
      for (let k = 0; k < sub; k++) {
        const off = (k / (sub - 1) - 0.5) * w * (0.85 + rnd() * 0.2), a = (0.25 + rnd() * 0.45) * strength, dash = [30 + rnd() * 120, 3 + rnd() * 12], dOff = rnd() * 100, lw = w / sub * (1.1 + rnd() * 0.9);
        for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
          g.globalAlpha = a; g.lineWidth = lw; g.setLineDash(dash); g.lineDashOffset = dOff;
          g.beginPath();
          const i0 = Math.floor(rnd() * pts.length * 0.12), i1 = pts.length - Math.floor(rnd() * pts.length * 0.12);   // 細い線ごとに始まりと終わりをずらす(端がぎざぎざ)
          for (let i = i0; i < i1; i++) {
            const [x, y] = pts[i], [x2, y2] = pts[Math.min(i + 1, pts.length - 1)], [x0, y0] = pts[Math.max(i - 1, 0)];
            const dx = x2 - x0, dy = y2 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
            const px = x + nx * off + ox, py = y + ny * off + oy; i > i0 ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.stroke();
        }
      }
      g.setLineDash([]);
    };
    // 横向きの線を行ごとに並べる(行の間隔 > 線の幅なので、線の間に紙が残る)。長さ・始まり・傾きは行ごとにばらつかせ、
    // 1 行に 2〜3 本を重ねる。向きはシェーダーで回すので、ここでは横向き(左右・上下につなぎ目なく敷ける)
    for (const [step, w, strength, per] of [[30, 24, 1.0, 2], [30, 18, 0.7, 1]]) {
      for (let y0 = rnd() * step; y0 < N; y0 += step * (0.85 + rnd() * 0.3)) {
        for (let n = 0; n < per; n++) {
          const len = 160 + rnd() * 480, x0 = rnd() * N, tilt = (rnd() - 0.5) * 0.22, bow = (rnd() - 0.5) * 26, yy = y0 + (rnd() - 0.5) * step * 0.5;
          const ph = rnd() * 6; const pts = []; for (let t = 0; t <= 1.0001; t += 0.04) pts.push([x0 + len * t, yy + len * t * tilt + Math.sin(t * Math.PI) * bow + Math.sin(t * 9 + ph) * 2.5]);
          crayon(pts, w * (0.8 + rnd() * 0.4), strength * (0.75 + rnd() * 0.25));
        }
      }
    }
    // 紙の目: 色が乗らない細かい点
    g.globalAlpha = 1; g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.6})`; g.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 2, 1 + rnd() * 1.5); }
    return c;
  }
  // 柄 2 枚(1024 で描いたもの)を 512 に縮めて、透明度だけを R / G に詰めた 1 枚のテクスチャにする(RGBA 1024² × 2 = 8 MB → 0.5 MB)
  function crayonPatterns(THREE, seedA, seedB) {
    const N = 512, d = new Uint8Array(N * N * 2).fill(0);
    [seedA, seedB].forEach((seed, ch) => {
      const src = crayonPattern(THREE, seed), c = document.createElement("canvas"); c.width = c.height = N;
      const g = c.getContext("2d"); g.drawImage(src, 0, 0, N, N);
      const px = g.getImageData(0, 0, N, N).data;
      for (let i = 0; i < N * N; i++) d[i * 2 + ch] = px[i * 4 + 3];
    });
    const t = new THREE.DataTexture(d, N, N, THREE.RGFormat, THREE.UnsignedByteType);
    t.flipY = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
    return t;
  }
  function fog(THREE, opts = {}) {
    const U = DreamAssets.util;
    const group = new THREE.Group(); group.name = "fog";
    // ── 盤面と、その上の模型 ──
    const terrain = DreamAssets.terrain(THREE, { layout: "confluence" }); group.add(terrain.group);
    const place = (asset, x, z, s, ry = 0) => { asset.group.position.set(x, LAND, z); asset.group.scale.setScalar(s); asset.group.rotation.y = ry; group.add(asset.group); return asset; };
    const plant = place(DreamAssets.plant(THREE, { r: 75 }), -330, 80, 2.0);
    const lab = place(DreamAssets.lab(THREE, { r: 75 }), 300, 40, 2.0, -0.2);
    const g1 = place(DreamAssets.guard(THREE, { size: "M" }), -170, -10, 2.0, 0.6);
    const g2 = place(DreamAssets.guard(THREE, { size: "L" }), 150, -90, 2.0, -0.5);
    const scout = place(DreamAssets.tank(THREE), 0, 0, 1.6);
    for (const a of [plant, lab, g1, g2, scout]) a.setTeam?.(a === plant || a === scout ? 0xff6a1a : null);
    const subs = [terrain, plant, lab, g1, g2, scout];

    // ── 探索グリッド(0 = 可視、0.55 = 探索済み、1 = 未探索)。縁はなめらかに補間 ──
    const data = new Uint8Array(COLS * ROWS * 4).fill(255);
    const fogTex = new THREE.DataTexture(data, COLS, ROWS, THREE.RGBAFormat); fogTex.magFilter = fogTex.minFilter = THREE.LinearFilter; fogTex.needsUpdate = true;
    const state = new Float32Array(COLS * ROWS).fill(1);
    // 霧の処理は画面の色(sRGB)に直した後に入るので、色も sRGB の値のまま渡す(THREE.Color は内部が線形で暗くなる)
    const srgb = (hex) => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
    const uniforms = { fogTex: { value: fogTex }, fogOrigin: { value: new THREE.Vector2(-W / 2, -H / 2) }, fogSize: { value: new THREE.Vector2(W, H) }, fogPaper: { value: srgb(PAPER) }, fogOn: { value: 1 },
      fogStyle: { value: 0 } };

    // ── 新方式: すべての材質に霧の処理を足す(未探索は描かない、探索済みは紙の色へ、境目は鉛筆の線) ──
    const patched = new Set();
    function patch(mat) {
      if (!mat || patched.has(mat) || mat.isShaderMaterial) return;
      patched.add(mat);
      const prev = mat.onBeforeCompile;   // 元の処理(流れる点線の dashOffset など)は残す
      mat.onBeforeCompile = (sh) => {
        prev?.(sh);
        Object.assign(sh.uniforms, uniforms);
        sh.vertexShader = "varying vec3 vFogW;\n" + sh.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>
          vec4 fogW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fogW = instanceMatrix * fogW;
          #endif
          vFogW = (modelMatrix * fogW).xyz;`);
        sh.fragmentShader = `varying vec3 vFogW; uniform sampler2D fogTex; uniform vec2 fogOrigin; uniform vec2 fogSize; uniform vec3 fogPaper; uniform float fogOn; uniform float fogStyle;   // 色は画面の色(sRGB)の値
          float fogHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float fogNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(fogHash(i), fogHash(i + vec2(1, 0)), f.x), mix(fogHash(i + vec2(0, 1)), fogHash(i + vec2(1, 1)), f.x), f.y); }
          ` + sh.fragmentShader.replace("#include <fog_fragment>", `#include <fog_fragment>
          if (fogOn > 0.5) {
            vec2 fuv = (vFogW.xz - fogOrigin) / fogSize;
            float fv = texture2D(fogTex, vec2(fuv.x, 1.0 - fuv.y)).r;
            float n = fogNoise(vFogW.xz * 0.045) * 0.6 + fogNoise(vFogW.xz * 0.16) * 0.4;
            float cut = 0.78 + (n - 0.5) * 0.18;
            float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            if (fogStyle < 0.5) {
              if (fv > cut) discard;                                              // マスク: 未探索は描かない
              float mem = smoothstep(0.25, 0.45, fv);                             // 探索済み: 紙の色へ寄せて色を抜く
              gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(lum), fogPaper, 0.55), mem * 0.85);
              if (fv > cut - 0.035) gl_FragColor.rgb = vec3(0.45, 0.43, 0.40);   // 破れ目の鉛筆の線
            } else {
              // クレヨン: 模型はそのまま描き(未探索の場所はクレヨンの塊が上から隠す)、探索済みだけ紙の色に寄せる
              float memW = smoothstep(0.25, 0.45, fv) * (1.0 - smoothstep(0.62, 0.74, fv));
              gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(lum), fogPaper, 0.55), memW * 0.85);
            }
          }`);
      };
      mat.needsUpdate = true;
    }
    const patchAll = () => group.traverse((o) => { if (o.material && !o.userData.noFog) (Array.isArray(o.material) ? o.material : [o.material]).forEach(patch); });

    // 紙(盤面の下と周り。霧の処理はしない。消えた場所に見える)
    const paper = paperTexture(THREE); paper.repeat.set(6000 / 160, 6000 / 160);
    const paperPlane = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: paper })); paperPlane.position.y = 0.4; paperPlane.userData.noFog = true; group.add(paperPlane);

    // ── 現行方式: 盤面の上に紙の平面を 1 枚(探索グリッドで透かす)。背の高い模型は突き抜ける ──
    const paper2 = paperTexture(THREE); paper2.repeat.set(W / 160, H / 160);
    const alpha = new THREE.DataTexture(new Uint8Array(COLS * ROWS * 4).fill(255), COLS, ROWS, THREE.RGBAFormat); alpha.magFilter = alpha.minFilter = THREE.LinearFilter;
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: paper2, alphaMap: alpha, transparent: true, depthWrite: false }));
    flat.position.y = LAND + 2.5; flat.renderOrder = 5; flat.userData.noFog = true; group.add(flat);

    // ── クレヨン: 画面全体の板 1 枚。描く直前に「マスク描き」を半分の解像度の描画先に描き(未探索の模型のピクセル = 1、
    //    印なし(盤面の外の紙・背景など)→ 盤面の周辺なら 1 扱い、それより遠くと空は 0)、板の断片ごとにそのマスクをぎざぎざに広げて塗る。塗りの中は紙ごと埋め、縁は線だけ残す
    //    マスク描きは場面をもう 1 回描くのではなく、代わりの軽い場面(地形の地面と山は同じジオメトリ、模型は当たり箱)を描く(9.17 対応 5。描画呼び出しが 2 倍にならない)
    //    柄は全部の区画で共通。断片の画面の位置から地面(高さ LAND)の点を出し、揺らした多角形の区画(セルの大きさ)に割り当て、
    //    「区画の中心が映る点・カメラの方位角・中心の奥行きの縮尺」で画面の位置を盤面の座標に直して柄を引く。
    //    真上では区画どうしの継ぎ目は見えず、低く傾けると区画の境目で線がずれる(塗り重ねたクレヨンの継ぎ目)。柄の薄いところは描かない ──
    const crayonU = { pat: { value: crayonPatterns(THREE, 31, 57) }, paper: { value: srgb(PAPER) }, col: { value: srgb(0x6a7079) },
      mask: { value: null }, res: { value: new THREE.Vector2(1, 1) }, invP: { value: new THREE.Matrix4() }, camW: { value: new THREE.Matrix4() },
      land: { value: LAND }, cell: { value: CELL }, refDist: { value: 1000 }, mapHalf: { value: new THREE.Vector2(W / 2, H / 2) }, margin: { value: CELL * 2.5 } };
    const crayonMat = new THREE.ShaderMaterial({
      uniforms: crayonU, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform mat4 projectionMatrix; uniform sampler2D pat; uniform sampler2D mask; uniform vec3 col; uniform vec3 paper; uniform vec2 res; uniform mat4 invP; uniform mat4 camW; uniform float land; uniform float cell; uniform float refDist; uniform vec2 mapHalf; uniform float margin;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        // 区画の中心 c に柄を固定して、この断片の柄の濃さを引く: 中心が映る点・中心の奥行きの縮尺(近すぎ・遠すぎは基準の距離で止める)・カメラの方位角で
        // 画面の位置を盤面の座標に直す。真上では区画どうしの継ぎ目は見えず、低く傾けると継ぎ目で線がずれる
        float inkAt(vec2 c, vec2 ax) {
          vec4 cc = projectionMatrix * viewMatrix * vec4(c.x, land, c.y, 1.0);
          vec2 C = (cc.xy / max(cc.w, 1.0) * 0.5 + 0.5) * res;
          float ppu = 0.5 * res.y * projectionMatrix[1][1] / clamp(cc.w, refDist * 0.5, refDist * 1.5);
          vec2 d = (gl_FragCoord.xy - C) / ppu, ay = vec2(-ax.y, ax.x);
          vec2 p = vec2(dot(d, ax), dot(d, ay)) + vec2(c.x, -c.y);
          mat2 m1 = mat2(0.85, 0.53, -0.53, 0.85), m2 = mat2(0.36, -0.93, 0.93, 0.36);
          vec2 q1 = m1 * p, q2 = m2 * p;                                      // 主の塗り: 右上がりの線(タイル 1 枚 = 盤面の 420)/ 交差する重ね塗り(向きと大きさを変えて規則性を消す)
          // ミップの選び方は区画の境目に影響されないよう、画面 1 ピクセルあたりの柄の変化を直接渡す
          vec2 dx = vec2(ax.x, ay.x) / ppu, dy = vec2(ax.y, ay.y) / ppu;
          float a1 = textureGrad(pat, q1 / 420.0, m1 * dx / 420.0, m1 * dy / 420.0).r, b1 = textureGrad(pat, q2 / 610.0 + 0.31, m2 * dx / 610.0, m2 * dy / 610.0).g;   // 柄は R / G に 1 枚ずつ
          return 1.0 - (1.0 - a1) * (1.0 - b1 * 0.45);
        }
        // マスクの値: 印のある物はその値。印のない物(盤面の外の紙・背景)は、その先の地面が盤面の周辺(margin。縁は乱れでぎざぎざ)なら未探索、
        // それより遠くと地平線より上(空)は塗らない(どこまでも塗ると画面がうるさい)
        float um(vec2 uv) {
          vec4 s = texture2D(mask, uv); if (s.g < 0.1 && s.b > 0.9) return s.r;
          vec4 w = camW * (invP * vec4(uv * 2.0 - 1.0, 1.0, 1.0)); vec3 dir = w.xyz / w.w - cameraPosition;
          if (dir.y >= 0.0) return 0.0;
          vec2 g = cameraPosition.xz + dir.xz * ((land - cameraPosition.y) / dir.y), sd = abs(g) - mapHalf;
          return max(sd.x, sd.y) < margin * (0.5 + noise(g * 0.025)) ? 1.0 : 0.0;
        }
        void main() {
          vec2 uv = gl_FragCoord.xy / res;
          // この断片の先にある地面の点(見上げている断片は、遠くの点で代用)
          vec4 w = camW * (invP * vec4(uv * 2.0 - 1.0, 1.0, 1.0)); vec3 dir = normalize(w.xyz / w.w - cameraPosition);
          float tmax = refDist * 12.0, t = dir.y < -1e-4 ? (land - cameraPosition.y) / dir.y : tmax;
          t = clamp(t, 0.0, tmax);
          vec2 g = (cameraPosition + dir * t).xz;
          // マスクをぎざぎざに広げる(広げる幅は地面の位置で決めた乱れで、カメラを動かしても揺れない)
          float f = max(1.0, t / (refDist * 1.5));                               // 遠くほど乱れも大きく(画面上の細かさをそろえる)
          float n = noise(g * 0.045 / f) * 0.6 + noise(g * 0.16 / f) * 0.4;
          float R = res.y * 0.04 * (0.45 + n), m = um(uv) * 2.0;
          for (int k = 0; k < 8; k++) { float a = float(k) * 0.7854; m += um(uv + vec2(cos(a), sin(a)) * R / res); }
          m /= 10.0;
          if (m < 0.12) discard;
          // 区画: 揺らした格子の点のうち、地面の点に近い 2 つ(境目では 2 つの区画の柄を混ぜ、継ぎ目を塗り重ねに見せる)。
          // 遠くほど区画を大きく(基準の距離の 1.5 倍を超えるごとに 2 倍。画面上ではどこもセル 1 つ分ほどの大きさ。段の境目は乱れで崩す)
          float lv = clamp(floor(log2(max(t, 1.0) / (refDist * 1.5)) + 1.0 + (n - 0.5) * 0.8), 0.0, 2.0), cs = cell * exp2(lv);
          vec2 gc = floor(g / cs), c1 = vec2(0.0), c2 = vec2(0.0); float d1 = 1e9, d2 = 1e9;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 q = gc + vec2(float(i), float(j)), c = (q + 0.5 + (vec2(hash(q + lv * 3.1), hash(q + 7.3 + lv)) - 0.5) * 0.8) * cs;
            float dd = distance(c, g); if (dd < d1) { d2 = d1; c2 = c1; d1 = dd; c1 = c; } else if (dd < d2) { d2 = dd; c2 = c; }
          }
          float wb = smoothstep(0.0, 0.3 * cs, d2 - d1);
          vec2 ax = normalize(vec2(viewMatrix[0][0], viewMatrix[2][0]));           // カメラの右方向(水平面)= 柄の向き
          float ink = mix(inkAt(c2, ax), inkAt(c1, ax), 0.5 + 0.5 * wb);
          float need = mix(0.55, 0.0, smoothstep(0.2, 0.75, m));            // はみ出した縁は線のあるところだけ、中は紙ごと埋める
          if (ink < need) discard;
          vec3 c = mix(paper, col * 1.18, smoothstep(0.06, 0.45, ink));      // 線の間は紙
          c = mix(c, col * 0.78, smoothstep(0.55, 1.0, ink));                 // 線の重なりは濃く
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const quadGeo = new THREE.BufferGeometry();
    quadGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const crayon = new THREE.Mesh(quadGeo, crayonMat); crayon.userData.noFog = true; crayon.renderOrder = 10; crayon.frustumCulled = false; group.add(crayon);
    // マスク描きの場面: 地形の地面と山(同じジオメトリを共有)、模型ごとの当たり箱。未探索なら R=1(印として G=0 B=1)、背景は白(印なし)
    const maskMat = new THREE.ShaderMaterial({
      uniforms: { fogTex: uniforms.fogTex, fogOrigin: uniforms.fogOrigin, fogSize: uniforms.fogSize },
      vertexShader: `varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D fogTex; uniform vec2 fogOrigin; uniform vec2 fogSize; varying vec3 vW;
        float fogHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fogNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(fogHash(i), fogHash(i + vec2(1, 0)), f.x), mix(fogHash(i + vec2(0, 1)), fogHash(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          vec2 fuv = (vW.xz - fogOrigin) / fogSize;
          float fv = texture2D(fogTex, vec2(fuv.x, 1.0 - fuv.y)).r;
          float n = fogNoise(vW.xz * 0.045) * 0.6 + fogNoise(vW.xz * 0.16) * 0.4;
          gl_FragColor = vec4(fv > 0.78 + (n - 0.5) * 0.18 ? 1.0 : 0.0, 0.0, 1.0, 1.0);
        }`,
    });
    const maskScene = new THREE.Scene(); maskScene.background = new THREE.Color(0xffffff);
    for (const m of terrain.group.children) if (m.isMesh && m.material.vertexColors) maskScene.add(new THREE.Mesh(m.geometry, maskMat));   // 地面と山(配置替えはこの見本ではしない)
    const proxies = [plant, lab, g1, g2, scout].map((a) => {
      a.group.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(a.group).applyMatrix4(new THREE.Matrix4().copy(a.group.matrixWorld).invert()), size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
      const box = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), maskMat); box.matrixAutoUpdate = false; maskScene.add(box);
      return { box, local: new THREE.Matrix4().makeTranslation(center.x, center.y, center.z), group: a.group };
    });
    let maskRT = null;
    const dbs = new THREE.Vector2(), camP = new THREE.Vector3(), camD = new THREE.Vector3(), prevClear = new THREE.Color();
    crayon.onBeforeRender = (renderer, scene, camera) => {
      renderer.getDrawingBufferSize(dbs); crayonU.res.value.copy(dbs);
      const mw = Math.max(1, dbs.x >> 1), mh = Math.max(1, dbs.y >> 1);
      if (!maskRT || maskRT.width !== mw || maskRT.height !== mh) { maskRT?.dispose(); maskRT = new THREE.WebGLRenderTarget(mw, mh, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }); crayonU.mask.value = maskRT.texture; }
      // 代わりの場面をマスク描きで描く(当たり箱は模型の今の位置に合わせる)
      for (const p of proxies) p.box.matrix.multiplyMatrices(p.group.matrixWorld, p.local);
      const prevRT = renderer.getRenderTarget();
      renderer.setRenderTarget(maskRT); renderer.render(maskScene, camera); renderer.setRenderTarget(prevRT);
      crayonU.invP.value.copy(camera.projectionMatrixInverse); crayonU.camW.value.copy(camera.matrixWorld);
      // 基準の距離: 画面の中央の先の地面まで(見上げていれば高さから)
      camera.getWorldPosition(camP); camera.getWorldDirection(camD);
      crayonU.refDist.value = camD.y < -0.05 ? (LAND - camP.y) / camD.y : Math.max(300, (camP.y - LAND) * 8);
    };

    // ── 視界: 斥候(楕円の道筋を進む)と自陣の発電所 ──
    let mode = opts.mode ?? "mask", clock = 0, upd = 0, u = 0;
    const SOURCES = () => [[plant.group.position.x, plant.group.position.z, 300], [scout.group.position.x, scout.group.position.z, 240]];
    const cover = new Float32Array(COLS * ROWS).fill(1);   // クレヨン方式: 未探索の残り(1 → 0 に 0.4 秒で減らし、塗りがぎざぎざの縁から削れて消える)
    function writeFog() {
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const k = j * COLS + i, v = mode === "crayon" ? state[k] + (1 - state[k]) * cover[k] : state[k];
        const a = Math.round(v * 255), p = ((ROWS - 1 - j) * COLS + i) * 4;
        data[p] = data[p + 1] = data[p + 2] = a; data[p + 3] = 255;
        alpha.image.data[p] = alpha.image.data[p + 1] = alpha.image.data[p + 2] = state[k] === 0 ? 0 : state[k] < 1 ? 140 : 255; alpha.image.data[p + 3] = 255;
      }
      fogTex.needsUpdate = true; alpha.needsUpdate = true;
    }
    function refreshFog() {
      const src = SOURCES();
      for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
        const x = -W / 2 + (i + 0.5) * CELL, z = -H / 2 + (j + 0.5) * CELL, k = j * COLS + i;
        const vis = src.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) <= r);
        state[k] = vis ? 0 : state[k] < 1 ? 0.55 : 1;
      }
      writeFog();
    }
    function setMode(m) {
      mode = m; uniforms.fogOn.value = m === "plane" ? 0 : 1; uniforms.fogStyle.value = m === "crayon" ? 1 : 0; flat.visible = m === "plane"; crayon.visible = m === "crayon";
      writeFog();
    }
    function update(dt) {
      clock += dt;
      // 斥候: 盤面の陸を回る楕円(川は気にしない見本)。向きは道筋の接線
      u += dt * 0.07;
      const rx = 560, rz = 300, x = rx * Math.cos(u), z = -80 + rz * Math.sin(u);
      scout.group.position.set(x, LAND, z); scout.group.rotation.y = Math.atan2(-rx * Math.sin(u), rz * Math.cos(u));
      for (const s of subs) s.update(dt);
      if ((upd -= dt) <= 0) { upd = 0.15; refreshFog(); }
      // クレヨン方式: 探索されたセルの塗りは 0.4 秒かけて削れて消える
      if (mode === "crayon") { let moved = false; for (let k = 0; k < cover.length; k++) { const t = state[k] >= 1 ? 1 : 0; if (cover[k] !== t) { cover[k] += (t - cover[k]) * Math.min(1, dt * 6); if (Math.abs(cover[k] - t) < 0.02) cover[k] = t; moved = true; } } if (moved) writeFog(); }
    }   // 部品を作り直したら patchAll() を呼び直す(毎フレームは走らせない)
    refreshFog(); for (let k = 0; k < cover.length; k++) cover[k] = state[k] >= 1 ? 1 : 0; setMode(mode); patchAll();
    return {
      group, update, setTeam() {}, stats: () => U.stats(group), parts: {},
      setMode, get mode() { return mode; }, reset() { state.fill(1); cover.fill(1); refreshFog(); },
    };
  }

  (window.DreamAssets ??= {}).fog = fog;
})();
