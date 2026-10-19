import type { ArtilleryBombardmentRules } from './rules';

/**
 * Manual-fire dispersion radius. It grows linearly from the near value to the
 * configured max-range value; an unobserved aim uses the wider pair.
 */
export function artilleryScatterRadius1024(
  config: ArtilleryBombardmentRules,
  distance1024: number,
  observed: boolean,
): number {
  const far = observed
    ? config.observedScatterRadius1024
    : config.unobservedScatterRadius1024;
  const near = Math.floor((far * config.nearScatterPercent) / 100);
  const range1024 = Math.max(1, config.range * 1024);
  const clamped = Math.max(0, Math.min(distance1024, range1024));
  return near + Math.floor(((far - near) * clamped) / range1024);
}

/** Shell flight time; it grows linearly with distance. */
export function artilleryImpactTicks(
  config: ArtilleryBombardmentRules,
  distance1024: number,
): number {
  return (
    config.impactBaseTicks +
    Math.floor((config.impactTicksPerCell * Math.max(0, distance1024)) / 1024)
  );
}

/** Integer distance between two 1/1024-cell points. */
export function distance1024(
  fromX1024: number,
  fromY1024: number,
  toX1024: number,
  toY1024: number,
): number {
  return Math.floor(
    Math.sqrt((fromX1024 - toX1024) ** 2 + (fromY1024 - toY1024) ** 2),
  );
}

/**
 * Chance (0-100) that a uniformly scattered shell lands within blast range of
 * the aimed cell centre. Display aid only; resolution uses the sampled point.
 */
export function artilleryCenterHitPercent(
  config: ArtilleryBombardmentRules,
  scatterRadius1024: number,
): number {
  if (scatterRadius1024 <= config.blastRadius1024) return 100;
  return Math.floor(
    (100 * config.blastRadius1024 ** 2) / scatterRadius1024 ** 2,
  );
}
