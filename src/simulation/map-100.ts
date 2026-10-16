import { createMapSnapshot } from './map-snapshot';
import type { GridMap } from './types';

const assignedMaps = new Map<number, GridMap>();

/** Creates the fixed 100-cell definition with only the faction-to-seat map randomized. */
export function createMap100(seed: number): GridMap {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff)
    throw new RangeError('seed must be an unsigned 32-bit integer');
  const assignmentIndex = seed % 3;
  const cached = assignedMaps.get(assignmentIndex);
  if (cached) return cached;
  const map = createMapSnapshot('ring100', seed, true);
  assignedMaps.set(assignmentIndex, map);
  return map;
}
