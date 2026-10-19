import { describe, expect, it } from 'vitest';
import {
  MAX_VIEW_AREA_SHARE,
  cameraDistanceBounds,
  groundFootprint,
  polygonArea,
} from './camera-rig';

describe('oblique board camera', () => {
  for (const [label, aspect] of [
    ['landscape 900x420', 900 / 420],
    ['desktop 1440x900', 1440 / 900],
    ['narrow 600x500', 600 / 500],
  ] as const) {
    it(`never shows more than 1/9 of a 100x100 map (${label})`, () => {
      const bounds = cameraDistanceBounds(100, 100, aspect);
      const widest = groundFootprint({ x: 50, z: 50 }, bounds.max, aspect);
      expect(widest).not.toBeNull();
      expect(polygonArea(widest!)).toBeLessThanOrEqual(
        100 * 100 * MAX_VIEW_AREA_SHARE + 1e-6,
      );
      expect(polygonArea(widest!)).toBeGreaterThan(
        100 * 100 * MAX_VIEW_AREA_SHARE * 0.99,
      );
      expect(bounds.min).toBeLessThan(bounds.initial);
      expect(bounds.initial).toBeLessThanOrEqual(bounds.max);
    });
  }

  it('keeps the far edge of the view farther away than the near edge', () => {
    const footprint = groundFootprint({ x: 0, z: 0 }, 30, 2)!;
    const near = footprint[0]!;
    const far = footprint[3]!;
    expect(far.z).toBeLessThan(near.z);
    expect(Math.abs(footprint[2]!.x - footprint[3]!.x)).toBeGreaterThan(
      Math.abs(footprint[1]!.x - footprint[0]!.x),
    );
  });
});
