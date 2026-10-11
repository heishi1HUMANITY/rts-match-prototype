import { BASE_STATS, MAP_HEIGHT, MAP_WIDTH, UNIT_STATS } from './config';
import type {
  BaseState,
  FactionId,
  FactionKnowledge,
  MatchState,
  UnitState,
} from './types';

function unitPositionX2(unit: UnitState): number {
  const next = unit.path[0];
  return (
    2 * unit.cell.x +
    1 +
    (next ? unit.edgeProgress * (next.x - unit.cell.x) : 0)
  );
}

function unitPositionY2(unit: UnitState): number {
  const next = unit.path[0];
  return (
    2 * unit.cell.y +
    1 +
    (next ? unit.edgeProgress * (next.y - unit.cell.y) : 0)
  );
}

interface SightSource {
  readonly x2: number;
  readonly y2: number;
  readonly radius: number;
}

function sightSources(state: MatchState, factionId: FactionId): SightSource[] {
  const sources: SightSource[] = [];
  for (const unit of state.units) {
    if (unit.factionId !== factionId || unit.hp <= 0) continue;
    sources.push({
      x2: unitPositionX2(unit),
      y2: unitPositionY2(unit),
      radius: UNIT_STATS[unit.kind].vision,
    });
  }
  for (const base of state.bases) {
    if (base.owner !== factionId || base.hp <= 0) continue;
    sources.push({
      x2: 2 * base.cell.x + 1,
      y2: 2 * base.cell.y + 1,
      radius: BASE_STATS[base.kind].vision,
    });
  }
  return sources;
}

function isPointVisible(
  sources: readonly SightSource[],
  x2: number,
  y2: number,
): boolean {
  return sources.some(({ x2: sx, y2: sy, radius }) => {
    const dx = x2 - sx;
    const dy = y2 - sy;
    return dx * dx + dy * dy <= (2 * radius) ** 2;
  });
}

/** Unit visibility uses the doubled-integer position, including half-cell edges. */
export function isUnitVisibleToFaction(
  state: MatchState,
  unit: UnitState,
  factionId: FactionId,
): boolean {
  if (unit.hp <= 0) return false;
  return isPointVisible(
    sightSources(state, factionId),
    unitPositionX2(unit),
    unitPositionY2(unit),
  );
}

/** Checks a public map cell against current sight sources without changing knowledge. */
export function isCellVisibleToFaction(
  state: MatchState,
  cell: { readonly x: number; readonly y: number },
  factionId: FactionId,
): boolean {
  return isPointVisible(
    sightSources(state, factionId),
    2 * cell.x + 1,
    2 * cell.y + 1,
  );
}

export function getUnitPositionX2(unit: UnitState): number {
  return unitPositionX2(unit);
}
export function getUnitPositionY2(unit: UnitState): number {
  return unitPositionY2(unit);
}

function memoryFromVisible(
  base: BaseState,
  tick: number,
): FactionKnowledge['baseMemory'][number] {
  return {
    baseId: base.id,
    owner: base.owner,
    hp: base.hp,
    seenTick: tick,
    selfReportedLost: false,
  };
}

function createKnowledge(
  state: MatchState,
  factionId: FactionId,
  previous?: FactionKnowledge,
): FactionKnowledge {
  const sources = sightSources(state, factionId);
  const visible = new Array<boolean>(MAP_WIDTH * MAP_HEIGHT).fill(false);
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      visible[y * MAP_WIDTH + x] = isPointVisible(
        sources,
        2 * x + 1,
        2 * y + 1,
      );
    }
  }
  const explored = visible.map(
    (isVisible, index) => isVisible || (previous?.explored[index] ?? false),
  );
  const oldMemory = new Map(
    previous?.baseMemory.map((memory) => [memory.baseId, memory]) ?? [],
  );
  const baseMemory = state.bases
    .map((base) => {
      const index = base.cell.y * MAP_WIDTH + base.cell.x;
      if (visible[index]) return memoryFromVisible(base, state.elapsedTicks);
      const old = oldMemory.get(base.id);
      if (
        old?.owner === factionId &&
        (base.owner !== factionId || base.hp <= 0)
      ) {
        return { ...old, selfReportedLost: true };
      }
      return old ?? null;
    })
    .filter((memory): memory is NonNullable<typeof memory> => memory !== null);
  return { factionId, visible, explored, baseMemory };
}

/** Recomputes every faction's current mask and durable exploration/base memory. */
export function updateFactionKnowledge(
  state: MatchState,
): readonly FactionKnowledge[] {
  return state.factions.map((faction) => {
    const previous = state.knowledge?.find(
      (entry) => entry.factionId === faction.id,
    );
    return createKnowledge(state, faction.id, previous);
  });
}

/** Builds initial tick-zero knowledge without requiring a partially built state. */
export function createInitialKnowledge(
  state: MatchState,
): readonly FactionKnowledge[] {
  return state.factions.map((faction) => createKnowledge(state, faction.id));
}
