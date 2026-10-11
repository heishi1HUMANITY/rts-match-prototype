import { BASE_STATS, CAPTURE_RADIUS, CAPTURE_TICKS_REQUIRED } from './config';
import type { FactionId, MatchState } from './types';

function isWithinCaptureRadius(
  baseX: number,
  baseY: number,
  unitX: number,
  unitY: number,
): boolean {
  const dx = unitX - (2 * baseX + 1);
  const dy = unitY - (2 * baseY + 1);
  return dx * dx + dy * dy <= (2 * CAPTURE_RADIUS) ** 2;
}

function currentUnitPosition(unit: MatchState['units'][number]): {
  x2: number;
  y2: number;
} {
  const next = unit.path[0];
  return {
    x2:
      2 * unit.cell.x +
      1 +
      (next ? unit.edgeProgress * (next.x - unit.cell.x) : 0),
    y2:
      2 * unit.cell.y +
      1 +
      (next ? unit.edgeProgress * (next.y - unit.cell.y) : 0),
  };
}

/** Advances neutral outpost control after combat using surviving units only. */
export function advanceCapture(state: MatchState): MatchState {
  const bases = state.bases.map((base) => {
    if (base.kind !== 'outpost' || base.owner !== null || base.hp !== 0) {
      if (base.captureCandidate === null && base.captureTicks === 0)
        return base;
      return { ...base, captureCandidate: null, captureTicks: 0 };
    }
    const present = new Set<FactionId>();
    for (const unit of state.units) {
      if (unit.hp <= 0) continue;
      const position = currentUnitPosition(unit);
      if (
        isWithinCaptureRadius(
          base.cell.x,
          base.cell.y,
          position.x2,
          position.y2,
        )
      ) {
        present.add(unit.factionId);
      }
    }
    if (present.size !== 1) {
      return base.captureCandidate === null && base.captureTicks === 0
        ? base
        : { ...base, captureCandidate: null, captureTicks: 0 };
    }
    const candidate = [...present][0]!;
    const captureTicks =
      base.captureCandidate === candidate ? base.captureTicks + 1 : 1;
    if (captureTicks >= CAPTURE_TICKS_REQUIRED) {
      return {
        ...base,
        owner: candidate,
        hp: BASE_STATS.outpost.maxHp,
        captureCandidate: null,
        captureTicks: 0,
      };
    }
    return { ...base, captureCandidate: candidate, captureTicks };
  });
  if (bases.every((base, index) => base === state.bases[index])) return state;
  return { ...state, bases };
}
