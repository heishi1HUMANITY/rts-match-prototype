/**
 * Visibility as mist: unexplored ground disappears into an almost opaque pale
 * haze, explored-but-unseen ground stays faintly readable, and visible cells are
 * clear. Applied as a full-screen pass that reconstructs each pixel's world
 * position from depth, so terrain, structures and every 3D asset are covered
 * uniformly without patching their materials. Background pixels use the ray's
 * ground intersection; outside the map counts as unexplored.
 */
import * as THREE from 'three';
import type { FactionView } from '../simulation/types';

/** Haze opacity for explored-but-not-visible and unexplored cells. */
export const HAZE_EXPLORED = 0.5;
export const HAZE_UNKNOWN = 0.94;
export const HAZE_COLOR = 0xd3d9df;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tFog;
uniform mat4 projectionInverse;
uniform mat4 viewInverse;
uniform vec2 mapSize;
uniform vec3 hazeColor;
uniform float time;
uniform float exploredHaze;
uniform float unknownHaze;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}
vec3 worldAt(vec2 uv, float depth) {
  vec4 view = projectionInverse * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  view /= view.w;
  return (viewInverse * view).xyz;
}

void main() {
  vec4 base = texture2D(tColor, vUv);
  float depth = texture2D(tDepth, vUv).x;
  vec3 world;
  if (depth >= 0.99999) {
    vec3 eye = viewInverse[3].xyz;
    vec3 far = worldAt(vUv, 1.0);
    vec3 direction = normalize(far - eye);
    float t = direction.y < -0.0001 ? -eye.y / direction.y : 1e5;
    world = eye + direction * t;
  } else {
    world = worldAt(vUv, depth);
  }
  vec2 cell = world.xz / mapSize;
  float fog = 1.0;
  if (cell.x >= 0.0 && cell.y >= 0.0 && cell.x <= 1.0 && cell.y <= 1.0)
    fog = texture2D(tFog, cell).r;
#ifdef HAZE_DRIFT
  float drift = fbm(world.xz * 0.16 + vec2(time * 0.035, time * 0.021));
#else
  float drift = 0.5;
#endif
  float haze = fog < 0.5
    ? mix(0.0, exploredHaze, fog * 2.0)
    : mix(exploredHaze, unknownHaze, (fog - 0.5) * 2.0);
  haze = clamp(haze * (0.74 + 0.52 * drift), 0.0, unknownHaze);
  float luma = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 color = mix(base.rgb, vec3(luma), min(1.0, fog * 1.4) * 0.55);
  color = mix(color, hazeColor, haze);
  gl_FragColor = linearToOutputTexel(vec4(color, 1.0));
}`;

export interface HazePass {
  setSize(width: number, height: number, pixelRatio: number): void;
  setVisibility(view: FactionView): void;
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    dt: number,
  ): void;
  dispose(): void;
}

/**
 * `low` is for software WebGL (CI, machines without a GPU): no MSAA, 8-bit
 * colour and no animated drift noise, which dominate the per-pixel cost there.
 */
export function createHazePass(quality: 'high' | 'low' = 'high'): HazePass {
  const createTarget = (width: number, height: number) => {
    const target = new THREE.WebGLRenderTarget(width, height, {
      type: quality === 'high' ? THREE.HalfFloatType : THREE.UnsignedByteType,
      samples: quality === 'high' ? 4 : 0,
      depthBuffer: true,
    });
    target.depthTexture = new THREE.DepthTexture(width, height);
    target.depthTexture.type = THREE.UnsignedIntType;
    return target;
  };
  let target = createTarget(1, 1);
  let fogData = new Uint8Array(4);
  let fogTexture = new THREE.DataTexture(fogData, 1, 1, THREE.RGBAFormat);
  const configureFog = (texture: THREE.DataTexture) => {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
  };
  fogData.fill(255);
  configureFog(fogTexture);
  const material = new THREE.ShaderMaterial({
    defines: quality === 'high' ? { HAZE_DRIFT: '' } : {},
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      tFog: { value: fogTexture },
      projectionInverse: { value: new THREE.Matrix4() },
      viewInverse: { value: new THREE.Matrix4() },
      mapSize: { value: new THREE.Vector2(100, 100) },
      hazeColor: { value: new THREE.Color(HAZE_COLOR) },
      time: { value: 0 },
      exploredHaze: { value: HAZE_EXPLORED },
      unknownHaze: { value: HAZE_UNKNOWN },
    },
  });
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeometry, material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let signature = '';
  let lastView: FactionView | null = null;
  let time = 0;

  return {
    setSize(width, height, pixelRatio) {
      const w = Math.max(1, Math.floor(width * pixelRatio));
      const h = Math.max(1, Math.floor(height * pixelRatio));
      if (target.width === w && target.height === h) return;
      target.depthTexture?.dispose();
      target.dispose();
      target = createTarget(w, h);
      material.uniforms.tColor!.value = target.texture;
      material.uniforms.tDepth!.value = target.depthTexture;
    },
    setVisibility(view) {
      if (view === lastView) return;
      lastView = view;
      const next =
        `${view.map.width}x${view.map.height}:` +
        view.visible
          .map((visible, index) =>
            visible ? '0' : view.explored[index] ? '1' : '2',
          )
          .join('');
      if (next === signature) return;
      signature = next;
      const { width, height } = view.map;
      if (
        fogTexture.image.width !== width ||
        fogTexture.image.height !== height
      ) {
        fogTexture.dispose();
        fogData = new Uint8Array(width * height * 4);
        fogTexture = new THREE.DataTexture(
          fogData,
          width,
          height,
          THREE.RGBAFormat,
        );
        configureFog(fogTexture);
        material.uniforms.tFog!.value = fogTexture;
        (material.uniforms.mapSize!.value as THREE.Vector2).set(width, height);
      }
      for (let index = 0; index < view.visible.length; index += 1) {
        const value = view.visible[index]
          ? 0
          : view.explored[index]
            ? 128
            : 255;
        fogData[index * 4] = value;
        fogData[index * 4 + 3] = 255;
      }
      fogTexture.needsUpdate = true;
    },
    render(renderer, scene, camera, dt) {
      time += dt;
      material.uniforms.time!.value = time;
      (material.uniforms.projectionInverse!.value as THREE.Matrix4).copy(
        camera.projectionMatrixInverse,
      );
      (material.uniforms.viewInverse!.value as THREE.Matrix4).copy(
        camera.matrixWorld,
      );
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(quadScene, quadCamera);
    },
    dispose() {
      target.depthTexture?.dispose();
      target.dispose();
      fogTexture.dispose();
      quadGeometry.dispose();
      material.dispose();
    },
  };
}
