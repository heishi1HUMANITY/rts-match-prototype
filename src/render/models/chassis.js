// 装軌車両の共通の足回り(試作)。装甲強襲 v3(tank.js)の履帯・転輪・下部車体を、自走砲・対空車両で使い回せるように切り出したもの。
// 1 枚ずつの履板(InstancedMesh)が起動輪(後)と誘導輪(前)の周りを回り、転輪は走行で回る。tank.js 自体は了承済みの実装をそのまま残している。
//
//   const ch = DreamAssets.chassis(THREE, { U, add, box, M, body, rearZ: -16.6, frontZ: 15.3, lowerHull: [-16.4, 19.0] });
//   ch.setBaked(U.bake(..., { dynamic: [...], instanced: [{ groups: ch.wheels, staticEdges: true }] })); ch.update(dt, moving)
// 最適化(2026-10-16): 履板と滑り止めは 1 つの InstancedMesh(頂点色)、転輪とハブも 1 つ、起起動輪・誘導輪は bake の instanced(輪郭線は固定)。足回りの描画呼び出し 12 → 3
//
// M には link / linkDark / light / dark / hull2 を持たせる。前方 = +z、上 = +y。
(function () {
  function chassis(THREE, { U, add, box, M, body, R = 2.15, rearZ, frontZ, wheelY = 2.55, trackX = 9.55, trackW = 3.2, linkPitch = 1.1, roadCount = 6, roadZ0 = -12.4, roadDz = 4.95, roadR = 1.85, roadY = 2.25, lowerHull = null }) {
    const B = new THREE.Vector2(rearZ, wheelY), F = new THREE.Vector2(frontZ, wheelY);   // (z, y)
    const run = F.x - B.x, loopLen = 2 * run + 2 * Math.PI * R;
    const pathAt = (s) => {   // 下の直線 → 前の半円 → 上の直線 → 後ろの半円(z-y 平面)。t = 進む向き、n = 外向き
      s = ((s % loopLen) + loopLen) % loopLen;
      if (s < run) return { z: B.x + s, y: B.y - R, tz: 1, ty: 0, nz: 0, ny: -1 };
      s -= run;
      if (s < Math.PI * R) { const a = -Math.PI / 2 + s / R; return { z: F.x + Math.cos(a) * R, y: F.y + Math.sin(a) * R, tz: -Math.sin(a), ty: Math.cos(a), nz: Math.cos(a), ny: Math.sin(a) }; }
      s -= Math.PI * R;
      if (s < run) return { z: F.x - s, y: F.y + R, tz: -1, ty: 0, nz: 0, ny: 1 };
      s -= run;
      const a = Math.PI / 2 + s / R; return { z: B.x + Math.cos(a) * R, y: B.y + Math.sin(a) * R, tz: -Math.sin(a), ty: Math.cos(a), nz: Math.cos(a), ny: Math.sin(a) };
    };
    const LINKS = Math.round(loopLen / linkPitch);
    // 履板 + 滑り止め(履板の外側 0.25。履板の座標では -y が外向き)を 1 つのジオメトリにして頂点色で塗り分ける
    const linkG = U.concat(THREE, [{ geo: box(trackW, 0.4, 0.94).toNonIndexed(), color: M.link.color }, { geo: box(trackW - 0.4, 0.2, 0.34).toNonIndexed().translate(0, -0.25, 0), color: M.linkDark.color }]);
    const links = new THREE.InstancedMesh(linkG, U.vcLambert(THREE), LINKS * 2);
    body.add(links);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    let trackS = 0;
    const layTracks = () => {
      let k = 0;
      for (const sx of [-1, 1]) for (let i = 0; i < LINKS; i++) {
        const p = pathAt(trackS + (i * loopLen) / LINKS);
        q.setFromEuler(e.set(Math.atan2(-p.ty, p.tz), 0, 0));
        mt.compose(v.set(sx * trackX, p.y + p.ny * 0.21, p.z + p.nz * 0.21), q, one); links.setMatrixAt(k, mt);
        k++;
      }
      links.instanceMatrix.needsUpdate = true;
    };
    layTracks();
    // 転輪とハブは 1 つの InstancedMesh(頂点色)。起動輪・誘導輪は輪郭線つきの Mesh を Group に入れ、bake の instanced で 1 つにする(回したら sync)
    const wheelG = new THREE.CylinderGeometry(roadR, roadR, 2.4, 12); wheelG.rotateZ(Math.PI / 2);
    const endG = new THREE.CylinderGeometry(R - 0.42, R - 0.42, 2.6, 8); endG.rotateZ(Math.PI / 2);
    const hubG = new THREE.CylinderGeometry(0.9, 0.9, 3.0, 6); hubG.rotateZ(Math.PI / 2);
    const roadG = U.concat(THREE, [{ geo: wheelG.toNonIndexed(), color: M.light.color }, { geo: hubG.toNonIndexed(), color: M.dark.color }]);
    const wheels = [], roadPos = [];
    const roadW = new THREE.InstancedMesh(roadG, U.vcLambert(THREE), roadCount * 2); body.add(roadW);
    for (const sx of [-1, 1]) {
      for (let i = 0; i < roadCount; i++) roadPos.push([sx * trackX, roadY, roadZ0 + i * roadDz]);
      for (const c of [B, F]) { const g = new THREE.Group(); g.position.set(sx * trackX, c.y, c.x); body.add(g); add(endG, M.dark, { parent: g }); wheels.push(g); }
    }
    let wheelRot = 0, baked = null;
    const layWheels = () => {
      q.setFromEuler(e.set(wheelRot, 0, 0));
      roadPos.forEach(([x, y, z], i) => { mt.compose(v.set(x, y, z), q, one); roadW.setMatrixAt(i, mt); });
      roadW.instanceMatrix.needsUpdate = true;
    };
    layWheels();
    // 履帯の間の下部車体
    if (lowerHull) {
      const [z0, z1] = lowerHull;
      add(U.loft(THREE, [
        { z: z0, pts: U.sym([[7.9, 1.5], [7.9, 4.4]]) },
        { z: z1 - 3.8, pts: U.sym([[7.9, 1.5], [7.9, 4.4]]) },
        { z: z1, pts: U.sym([[6.4, 3.4], [7.4, 4.6]]) },
      ]), M.hull2);
    }
    const SPEED = 4.2;   // 転輪の角速度。履帯の送りは転輪の周速に合わせる
    function update(dt, moving) {
      if (!moving) return;
      trackS -= dt * SPEED * roadR;   // 下側は車体に対して後ろへ(地面に対して止まって見える)
      layTracks();
      wheelRot += dt * SPEED; layWheels();
      for (const w of wheels) w.rotation.x += dt * SPEED;
      baked?.sync();
    }
    return {
      wheels, update, R, B, F, trackX, trackW, setBaked: (b) => (baked = b),
      trackRear: B.x - R - 0.46 - 0.17, trackFront: F.x + R + 0.46 + 0.17,   // 履板の滑り止めまで含めた端
      skirtX: 12.2,
    };
  }
  (window.DreamAssets ??= {}).chassis = chassis;
})();
