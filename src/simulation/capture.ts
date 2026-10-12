import type { FactionId, MatchState } from './types';

function isWithinCaptureRadius(
  baseX: number,
  baseY: number,
  unitX: number,
  unitY: number,
  radius: number,
): boolean {
  const dx = unitX - (1024 * baseX + 512);
  const dy = unitY - (1024 * baseY + 512);
  return dx * dx + dy * dy <= (1024 * radius) ** 2;
}

function currentUnitPosition(unit: MatchState['units'][number]): {
  x2: number;
  y2: number;
} {
  const next = unit.path[0];
  return {
    x2:
      1024 * unit.cell.x +
      512 +
      (next
        ? Math.round(
            (1024 * unit.edgeProgress * (next.x - unit.cell.x)) /
              (unit.moveTicksPerCell ?? 2),
          )
        : 0),
    y2:
      1024 * unit.cell.y +
      512 +
      (next
        ? Math.round(
            (1024 * unit.edgeProgress * (next.y - unit.cell.y)) /
              (unit.moveTicksPerCell ?? 2),
          )
        : 0),
  };
}

/** Advances neutral outpost control after combat using surviving units only. */
export function advanceCapture(state: MatchState): MatchState {
  const bases = state.bases.map((base) => {
    if (base.kind === 'hq' || base.owner !== null || base.hp !== 0) {
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
          state.rules.capture.radius,
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
    if (captureTicks >= state.rules.capture.requiredTicks) {
      return {
        ...base,
        owner: candidate,
        hp: state.rules.bases[base.kind].maxHp,
        captureCandidate: null,
        captureTicks: 0,
      };
    }
    return { ...base, captureCandidate: candidate, captureTicks };
  });
  if (bases.every((base, index) => base === state.bases[index])) return state;
  return { ...state, bases };
}
