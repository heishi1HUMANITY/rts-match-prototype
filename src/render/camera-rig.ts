/**
 * Fixed-azimuth oblique camera for the 3D board. The camera always looks north
 * (-z) from the south at CAMERA_PITCH, and its distance is bounded so the ground
 * it shows never exceeds MAX_VIEW_AREA_SHARE of the map (CP12 design input).
 * Pure math: no renderer, usable from Node tests.
 */
export const CAMERA_FOV_DEGREES = 30;
export const CAMERA_PITCH_DEGREES = 52;
/** Largest visible ground area as a share of the whole map. */
export const MAX_VIEW_AREA_SHARE = 1 / 9;
/** Smallest visible ground area (cells²) so units remain readable when zoomed in. */
export const MIN_VIEW_AREA = 120;
/** Default zoom: a little under half of the widest allowed view. */
export const DEFAULT_VIEW_AREA_SHARE = 0.045;

export interface GroundPoint {
  readonly x: number;
  readonly z: number;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Camera position for a ground target at the given eye distance. */
export function cameraPosition(
  target: GroundPoint,
  distance: number,
  pitchDegrees = CAMERA_PITCH_DEGREES,
): { x: number; y: number; z: number } {
  const pitch = toRadians(pitchDegrees);
  return {
    x: target.x,
    y: distance * Math.sin(pitch),
    z: target.z + distance * Math.cos(pitch),
  };
}

/** Ground (y=0) points under the four viewport corners, or null if a ray misses. */
export function groundFootprint(
  target: GroundPoint,
  distance: number,
  aspect: number,
  fovDegrees = CAMERA_FOV_DEGREES,
  pitchDegrees = CAMERA_PITCH_DEGREES,
): readonly GroundPoint[] | null {
  const pitch = toRadians(pitchDegrees);
  const tanHalf = Math.tan(toRadians(fovDegrees) / 2);
  const position = cameraPosition(target, distance, pitchDegrees);
  const forward = { x: 0, y: -Math.sin(pitch), z: -Math.cos(pitch) };
  const up = { x: 0, y: Math.cos(pitch), z: -Math.sin(pitch) };
  const corners: GroundPoint[] = [];
  for (const [nx, ny] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const dx = nx * tanHalf * aspect;
    const dy = forward.y + up.y * ny * tanHalf;
    const dz = forward.z + up.z * ny * tanHalf;
    if (dy >= -1e-6) return null;
    const t = -position.y / dy;
    corners.push({ x: position.x + dx * t, z: position.z + dz * t });
  }
  return corners;
}

export function polygonArea(points: readonly GroundPoint[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index]!;
    const b = points[(index + 1) % points.length]!;
    sum += a.x * b.z - b.x * a.z;
  }
  return Math.abs(sum) / 2;
}

/** Visible ground area grows with distance², so bisection on distance is monotone. */
export function distanceForArea(
  area: number,
  aspect: number,
  fovDegrees = CAMERA_FOV_DEGREES,
  pitchDegrees = CAMERA_PITCH_DEGREES,
): number {
  let low = 0.01;
  let high = 1000;
  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2;
    const footprint = groundFootprint(
      { x: 0, z: 0 },
      middle,
      aspect,
      fovDegrees,
      pitchDegrees,
    );
    if (footprint !== null && polygonArea(footprint) <= area) low = middle;
    else high = middle;
  }
  return low;
}

export interface DistanceBounds {
  readonly min: number;
  readonly max: number;
  readonly initial: number;
}

export function cameraDistanceBounds(
  mapWidth: number,
  mapHeight: number,
  aspect: number,
): DistanceBounds {
  const mapArea = mapWidth * mapHeight;
  const max = distanceForArea(mapArea * MAX_VIEW_AREA_SHARE, aspect);
  const min = Math.min(max, distanceForArea(MIN_VIEW_AREA, aspect));
  const initial = Math.min(
    max,
    Math.max(min, distanceForArea(mapArea * DEFAULT_VIEW_AREA_SHARE, aspect)),
  );
  return { min, max, initial };
}
