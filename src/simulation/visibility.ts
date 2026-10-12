import { MAP_HEIGHT, MAP_WIDTH } from './config';
import type {
  BaseState,
  FactionId,
  FactionKnowledge,
  MatchState,
  UnitState,
} from './types';

const POSITION_SCALE = 1024;

function unitPositionX1024(unit: UnitState): number {
  const next = unit.path[0];
  return (
    POSITION_SCALE * unit.cell.x +
    POSITION_SCALE / 2 +
    (next
      ? Math.round(
          (POSITION_SCALE * unit.edgeProgress * (next.x - unit.cell.x)) /
            (unit.moveTicksPerCell ?? 2),
        )
      : 0)
  );
}

function unitPositionY1024(unit: UnitState): number {
  const next = unit.path[0];
  return (
    POSITION_SCALE * unit.cell.y +
    POSITION_SCALE / 2 +
    (next
      ? Math.round(
          (POSITION_SCALE * unit.edgeProgress * (next.y - unit.cell.y)) /
            (unit.moveTicksPerCell ?? 2),
        )
      : 0)
  );
}

interface SightSource {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

function sightSources(state: MatchState, factionId: FactionId): SightSource[] {
  if (
    state.factions.find(({ id }) => id === factionId)?.eliminatedAtTick !== null
  ) {
    return [];
  }
  const sources: SightSource[] = [];
  for (const unit of state.units) {
    if (unit.factionId !== factionId || unit.hp <= 0) continue;
    sources.push({
      x: unitPositionX1024(unit),
      y: unitPositionY1024(unit),
      radius: state.rules.units[unit.kind].vision,
    });
  }
  for (const base of state.bases) {
    if (base.owner !== factionId || base.hp <= 0) continue;
    sources.push({
      x: POSITION_SCALE * base.cell.x + POSITION_SCALE / 2,
      y: POSITION_SCALE * base.cell.y + POSITION_SCALE / 2,
      radius: state.rules.bases[base.kind].vision,
    });
  }
  for (const crossing of state.crossings) {
    if (crossing.owner !== factionId || crossing.hp <= 0) continue;
    const site = state.map.crossingSites?.find(
      ({ id }) => id === crossing.siteId,
    );
    if (!site) continue;
    const center = site.cells[Math.floor(site.cells.length / 2)] ?? site.bankA;
    sources.push({
      x: POSITION_SCALE * center.x + POSITION_SCALE / 2,
      y: POSITION_SCALE * center.y + POSITION_SCALE / 2,
      radius: state.rules.crossings[site.tier].vision,
    });
  }
  return sources;
}

function isPointVisible(
  sources: readonly SightSource[],
  x: number,
  y: number,
): boolean {
  return sources.some(({ x: sx, y: sy, radius }) => {
    const dx = x - sx;
    const dy = y - sy;
    return dx * dx + dy * dy <= (POSITION_SCALE * radius) ** 2;
  });
}

/** Unit visibility uses fixed 1/1024-cell coordinates for every movement speed. */
export function isUnitVisibleToFaction(
  state: MatchState,
  unit: UnitState,
  factionId: FactionId,
): boolean {
  if (unit.hp <= 0) return false;
  return isPointVisible(
    sightSources(state, factionId),
    unitPositionX1024(unit),
    unitPositionY1024(unit),
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
    POSITION_SCALE * cell.x + POSITION_SCALE / 2,
    POSITION_SCALE * cell.y + POSITION_SCALE / 2,
  );
}

export function getUnitPositionX1024(unit: UnitState): number {
  return unitPositionX1024(unit);
}
export function getUnitPositionY1024(unit: UnitState): number {
  return unitPositionY1024(unit);
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
    defenderHp: base.defender?.hp ?? 0,
    defenderMaxHp: base.defender?.maxHp ?? 0,
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
        POSITION_SCALE * x + POSITION_SCALE / 2,
        POSITION_SCALE * y + POSITION_SCALE / 2,
      );
    }
  }
  const explored = visible.map(
    (isVisible, index) => isVisible || (previous?.explored[index] ?? false),
  );
  const oldMemory = new Map(
    previous?.baseMemory.map((memory) => [memory.baseId, memory]) ?? [],
  );
  const oldCrossingMemory = new Map(
    previous?.crossingMemory.map((memory) => [memory.siteId, memory]) ?? [],
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
  const crossingMemory = state.crossings
    .map((crossing) => {
      const site = state.map.crossingSites?.find(
        ({ id }) => id === crossing.siteId,
      );
      if (!site) return null;
      const isVisible =
        site.cells.some((cell) => visible[cell.y * MAP_WIDTH + cell.x]) ||
        visible[site.bankA.y * MAP_WIDTH + site.bankA.x] ||
        visible[site.bankB.y * MAP_WIDTH + site.bankB.x];
      if (crossing.owner === factionId || isVisible)
        return { ...crossing, seenTick: state.elapsedTicks };
      return oldCrossingMemory.get(crossing.siteId) ?? null;
    })
    .filter((memory): memory is NonNullable<typeof memory> => memory !== null);
  return { factionId, visible, explored, baseMemory, crossingMemory };
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
