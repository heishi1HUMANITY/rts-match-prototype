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
  return [
    ...current.ownUnits.filter((unit) => !unit.garrisonedAtBaseId),
    ...current.visibleEnemies,
  ].map((unit) => {
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

export function baseLabel(base: BaseView, captureRequiredTicks = 200): string {
  if (base.id === 'LOCAL-HQ') {
    if (base.visibility === 'unknown') return '● 現地勢力 本拠 · 未観測';
    if (base.visibility === 'remembered')
      return `● 現地勢力 本拠 · HP${base.hp} · T${base.seenTick}の観測`;
    return `● 現地勢力 本拠 · ${base.hp === 0 ? '撃破' : `HP${base.hp}/${base.maxHp}`}`;
  }
  const kind =
    base.kind === 'hq'
      ? '首都'
      : base.kind === 'medium'
        ? '中拠点'
        : base.kind === 'large'
          ? '大拠点'
          : '小拠点';
  if (base.visibility === 'unknown') return `${kind} · 未観測`;
  const ownerName =
    base.owner === 'local'
      ? '● 現地勢力'
      : base.owner === null
        ? '中立'
        : base.owner;
  if (base.visibility === 'remembered') {
    const defender =
      base.defenderMaxHp > 0
        ? ` · 守備${base.defenderHp}/${base.defenderMaxHp}`
        : '';
    return `${kind} · ${ownerName} HP${base.hp}${defender} · T${base.seenTick}の観測${base.selfReportedLost ? '・喪失報告' : ''}`;
  }
  const capture =
    base.captureCandidate === null
      ? ''
      : ` · ${base.captureCandidate}制圧 ${Math.floor((base.captureProgressCentiTicks / (captureRequiredTicks * 100)) * 100)}%`;
  const defender =
    base.defenderMaxHp === null
      ? ''
      : ` · ${base.defenderHp === 0 ? '守備撃破' : `守備 ${base.defenderHp}/${base.defenderMaxHp}`}`;
  const level = base.level > 1 ? ` Lv${base.level}` : '';
  return `${kind} · ${ownerName}${level} HP${base.hp}/${base.maxHp}${defender}${capture}`;
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
