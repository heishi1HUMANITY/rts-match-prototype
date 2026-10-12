import type {
  BaseView,
  Cell,
  FactionView,
  OwnUnitView,
  VisibleEnemyUnitView,
} from '../simulation/types';

export interface GroupMovePreview {
  readonly unitId: string;
  readonly path: readonly Cell[] | null;
}

/** Only currently owned, living units may retain selection or preview markers. */
export function ownUnitIds(
  view: FactionView,
  requested: readonly string[],
): readonly string[] {
  const own = new Set(view.ownUnits.map(({ id }) => id));
  return [...new Set(requested)].filter((id) => own.has(id));
}

/** Copies preview input and drops stale, enemy, or duplicate unit entries. */
export function ownGroupPreviews(
  view: FactionView,
  requested: readonly GroupMovePreview[],
): readonly GroupMovePreview[] {
  const own = new Set(view.ownUnits.map(({ id }) => id));
  const seen = new Set<string>();
  return requested.flatMap(({ unitId, path }) => {
    if (!own.has(unitId) || seen.has(unitId)) return [];
    seen.add(unitId);
    return [{ unitId, path: path?.map((cell) => ({ ...cell })) ?? null }];
  });
}

export interface UnitFrame {
  readonly unit: OwnUnitView | VisibleEnemyUnitView;
  readonly x: number;
  readonly z: number;
}

function position(unit: OwnUnitView | VisibleEnemyUnitView): {
  x: number;
  z: number;
} {
  if (unit.control === 'enemy')
    return { x: unit.positionX1024 / 1024, z: unit.positionY1024 / 1024 };
  const next = unit.path[0];
  const progress = unit.edgeProgress / (unit.moveTicksPerCell ?? 2);
  return {
    x:
      unit.cell.x +
      0.5 +
      (next === undefined ? 0 : (next.x - unit.cell.x) * progress),
    z:
      unit.cell.y +
      0.5 +
      (next === undefined ? 0 : (next.y - unit.cell.y) * progress),
  };
}

/** The current view alone determines membership; previous views only interpolate survivors. */
export function getUnitFrames(
  previous: FactionView,
  current: FactionView,
  alpha: number,
): readonly UnitFrame[] {
  const interpolate =
    previous.seed === current.seed &&
    previous.scenarioId === current.scenarioId &&
    previous.viewerFactionId === current.viewerFactionId &&
    current.phase === 'running' &&
    current.tick === previous.tick + 1;
  const old = new Map(
    [...previous.ownUnits, ...previous.visibleEnemies].map((unit) => [
      unit.id,
      unit,
    ]),
  );
  const fraction = Math.max(0, Math.min(1, alpha));
  return [...current.ownUnits, ...current.visibleEnemies].map((unit) => {
    const now = position(unit);
    const before = old.get(unit.id);
    if (
      !interpolate ||
      before === undefined ||
      before.control !== unit.control ||
      before.factionId !== unit.factionId
    ) {
      return { unit, ...now };
    }
    const start = position(before);
    return {
      unit,
      x: start.x + (now.x - start.x) * fraction,
      z: start.z + (now.z - start.z) * fraction,
    };
  });
}

export function baseLabel(base: BaseView, captureRequiredTicks = 30): string {
  const kind = base.kind === 'hq' ? '首都' : '拠点';
  if (base.visibility === 'unknown') return `${kind} · 未観測`;
  if (base.visibility === 'remembered') {
    return `${kind} · ${base.owner ?? '中立'} HP${base.hp} · T${base.seenTick}の観測${base.selfReportedLost ? '・喪失報告' : ''}`;
  }
  const owner = base.owner ?? '中立';
  const capture =
    base.captureCandidate === null
      ? ''
      : ` · ${base.captureCandidate}制圧 ${base.captureTicks}/${captureRequiredTicks}`;
  return `${kind} · ${owner} HP${base.hp}/${base.maxHp}${capture}`;
}

/** Keeps stacked production spawns selectable with a 44px target inside the playfield. */
export function placeUnitLabel(
  anchor: { readonly x: number; readonly y: number },
  occupied: readonly { readonly x: number; readonly y: number }[],
  width: number,
  height: number,
): { x: number; y: number } {
  const clampX = (x: number): number => Math.max(22, Math.min(width - 22, x));
  const clampY = (y: number): number => Math.max(22, Math.min(height - 22, y));
  const origin = { x: clampX(anchor.x), y: clampY(anchor.y) };
  if (
    !occupied.some(
      (point) =>
        Math.abs(point.x - origin.x) < 44 && Math.abs(point.y - origin.y) < 44,
    )
  )
    return origin;
  const candidates: { x: number; y: number; distance: number }[] = [];
  // At most 18 living units share the board. Search nearest free label slots.
  for (let dy = -6; dy <= 6; dy += 1) {
    for (let dx = -6; dx <= 6; dx += 1) {
      const x = clampX(origin.x + dx * 44);
      const y = clampY(origin.y + dy * 44);
      candidates.push({
        x,
        y,
        distance: (x - origin.x) ** 2 + (y - origin.y) ** 2,
      });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  const available = candidates.find(
    (candidate) =>
      !occupied.some(
        (point) =>
          Math.abs(point.x - candidate.x) < 44 &&
          Math.abs(point.y - candidate.y) < 44,
      ),
  );
  return available === undefined ? origin : { x: available.x, y: available.y };
}
