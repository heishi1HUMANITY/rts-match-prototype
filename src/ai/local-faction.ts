import { advanceMarchOrder } from '../simulation/march';
import { knownActiveCrossings } from '../simulation/crossings';
import { findPath } from '../simulation/pathfinding';
import { isUnitVisibleToFaction } from '../simulation/visibility';
import { unitCapabilities } from '../simulation/unit-capabilities';
import type {
  BaseState,
  Cell,
  MatchState,
  UnitState,
} from '../simulation/types';

function currentCell(unit: UnitState): Cell {
  return unit.edgeProgress > 0 && unit.path[0] ? unit.path[0] : unit.cell;
}

function distanceSquared(a: Cell, b: Cell): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function knownHostileBases(state: MatchState): BaseState[] {
  const knowledge = state.knowledge.find(
    ({ factionId }) => factionId === 'local',
  );
  if (!knowledge) return [];
  const memories = new Map(
    knowledge.baseMemory.map((memory) => [memory.baseId, memory.owner]),
  );
  return state.bases.filter((base) => {
    if (base.kind === 'hq') return false;
    if (knowledge.visible[base.cell.y * state.map.width + base.cell.x])
      return base.owner !== 'local';
    const rememberedOwner = memories.get(base.id);
    return rememberedOwner !== undefined && rememberedOwner !== 'local';
  });
}

function routeLength(
  state: MatchState,
  unit: UnitState,
  goal: Cell,
): number | null {
  const route = findPath(state.map, currentCell(unit), goal, {
    factionId: 'local',
    domain: unitCapabilities(unit.kind).movementDomain,
    crossings: knownActiveCrossings(state, 'local'),
    unitKind: unit.kind,
    allowBlockedStart: true,
  });
  return route?.length ?? null;
}

/** Gives local units deterministic, visibility-limited rescue and invasion orders. */
export function advanceLocalFactionOrders(state: MatchState): MatchState {
  if (!state.localFaction.active || state.localFaction.defeated) return state;
  const localUnits = state.units.filter(
    (unit) => unit.factionId === 'local' && unit.hp > 0,
  );
  if (localUnits.length === 0) return state;
  const ownedBases = state.bases.filter(
    (base) => base.owner === 'local' && base.hp > 0,
  );
  const visibleEnemies = state.units
    .filter(
      (unit) =>
        unit.factionId !== 'local' &&
        unit.hp > 0 &&
        isUnitVisibleToFaction(state, unit, 'local'),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const rescueEnemies = visibleEnemies.filter((enemy) =>
    ownedBases.some(
      (base) =>
        base.hp < base.maxHp &&
        distanceSquared(base.cell, currentCell(enemy)) <=
          state.rules.localFaction.rescueRadius ** 2,
    ),
  );
  const targets =
    rescueEnemies.length > 0
      ? rescueEnemies
      : visibleEnemies.filter((enemy) =>
          ownedBases.some(
            (base) =>
              distanceSquared(base.cell, currentCell(enemy)) <=
              state.rules.localFaction.rescueRadius ** 2,
          ),
        );
  const bases = knownHostileBases(state);
  let changed = false;
  const units = state.units.map((unit) => {
    if (unit.factionId !== 'local' || unit.hp <= 0) return unit;
    const origin = currentCell(unit);
    const enemy = targets
      .map((target) => ({
        target,
        route: routeLength(state, unit, currentCell(target)),
      }))
      .filter(
        (entry): entry is { target: UnitState; route: number } =>
          entry.route !== null,
      )
      .sort(
        (a, b) => a.route - b.route || a.target.id.localeCompare(b.target.id),
      )[0]?.target;
    const base = enemy
      ? undefined
      : bases
          .map((target) => ({
            target,
            route: routeLength(state, unit, target.cell),
          }))
          .filter(
            (entry): entry is { target: BaseState; route: number } =>
              entry.route !== null,
          )
          .sort(
            (a, b) =>
              a.route - b.route || a.target.id.localeCompare(b.target.id),
          )[0]?.target;
    const next = enemy
      ? advanceMarchOrder(state, unit, { kind: 'unit', id: enemy.id }, origin)
      : base
        ? advanceMarchOrder(
            state,
            unit,
            { kind: 'base', id: base.id },
            base.cell,
          )
        : null;
    if (!next || unit.marchOrder?.target.id === next.marchOrder?.target.id)
      return unit;
    changed = true;
    return next;
  });
  return changed ? { ...state, units } : state;
}
