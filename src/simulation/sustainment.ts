import { knownActiveCrossings } from './crossings';
import { canTraverse } from './map';
import { findPath } from './pathfinding';
import type { RulesMaster } from './rules';
import type { BaseState, Cell, MatchState, UnitState } from './types';
import { unitCapabilities } from './unit-capabilities';
import { getUnitPositionX1024, getUnitPositionY1024 } from './visibility';

/** Shots per full load; 0 means the unit kind never runs out. */
export function ammoCapacity(rules: RulesMaster, unit: UnitState): number {
  if (unit.factionId === 'local') return 0;
  return rules.units[unit.kind]?.ammo ?? 0;
}

export function currentAmmo(rules: RulesMaster, unit: UnitState): number {
  const capacity = ammoCapacity(rules, unit);
  return Math.min(capacity, unit.ammo ?? capacity);
}

export function ammoDamagePercent(rules: RulesMaster, unit: UnitState): number {
  return ammoCapacity(rules, unit) > 0 && currentAmmo(rules, unit) === 0
    ? rules.sustainment.depletedDamagePercent
    : 100;
}

/** Spends one shot; a unit with no shots left keeps firing at reduced damage. */
export function spendShot(rules: RulesMaster, unit: UnitState): UnitState {
  if (ammoCapacity(rules, unit) === 0) return unit;
  const ammo = currentAmmo(rules, unit);
  return ammo > 0 ? { ...unit, ammo: ammo - 1 } : unit;
}

export function autoReturnAmmo(rules: RulesMaster, unit: UnitState): number {
  return Math.ceil(
    (ammoCapacity(rules, unit) * rules.sustainment.autoReturnThresholdPercent) /
      100,
  );
}

function resupplyBases(state: MatchState, unit: UnitState): BaseState[] {
  return state.bases.filter(
    (base) => base.owner === unit.factionId && base.hp > 0,
  );
}

const manhattan = (a: Cell, b: Cell): number =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function inResupplyRange(state: MatchState, unit: UnitState): boolean {
  return resupplyBases(state, unit).some(
    (base) =>
      manhattan(unit.cell, base.cell) <= state.rules.sustainment.resupplyRadius,
  );
}

/** Route to the nearest reachable cell within resupply range of an owned base. */
function routeToResupply(
  state: MatchState,
  unit: UnitState,
): { readonly path: readonly Cell[]; readonly destination: Cell } | null {
  const radius = state.rules.sustainment.resupplyRadius;
  const options = {
    factionId: unit.factionId,
    domain: unitCapabilities(unit.kind, state.rules).movementDomain,
    crossings: knownActiveCrossings(state, unit.factionId),
    unitKind: unit.kind,
  };
  const currentEdge = unit.edgeProgress > 0 ? unit.path[0] : undefined;
  const origin = currentEdge ?? unit.cell;
  const bases = resupplyBases(state, unit)
    .map((base) => ({ base, distance: manhattan(origin, base.cell) }))
    .sort((a, b) => a.distance - b.distance || (a.base.id < b.base.id ? -1 : 1))
    .slice(0, 3);
  for (const { base } of bases) {
    const cells: Cell[] = [];
    for (let dy = -radius; dy <= radius; dy += 1)
      for (let dx = -radius; dx <= radius; dx += 1) {
        const cell = { x: base.cell.x + dx, y: base.cell.y + dy };
        if (
          Math.abs(dx) + Math.abs(dy) > radius ||
          (dx === 0 && dy === 0) ||
          cell.x < 0 ||
          cell.y < 0 ||
          cell.x >= state.map.width ||
          cell.y >= state.map.height ||
          !canTraverse(state.map, cell, options)
        )
          continue;
        cells.push(cell);
      }
    cells.sort(
      (a, b) =>
        manhattan(origin, a) - manhattan(origin, b) || a.y - b.y || a.x - b.x,
    );
    for (const destination of cells.slice(0, 8)) {
      const route = findPath(state.map, origin, destination, {
        ...options,
        allowBlockedStart: true,
      });
      if (route === null) continue;
      return {
        path: currentEdge === undefined ? route : [currentEdge, ...route],
        destination,
      };
    }
  }
  return null;
}

/** A capture needs no ammunition, so a unit holding one stays on the base. */
function holdsCapture(state: MatchState, unit: UnitState): boolean {
  if (!unitCapabilities(unit.kind, state.rules).canCaptureBase) return false;
  const x = getUnitPositionX1024(unit);
  const y = getUnitPositionY1024(unit);
  const radius = 1024 * state.rules.capture.radius;
  return state.bases.some(
    (base) =>
      base.kind !== 'hq' &&
      base.owner === null &&
      base.hp === 0 &&
      (base.defender === null || base.defender.hp === 0) &&
      (x - (1024 * base.cell.x + 512)) ** 2 +
        (y - (1024 * base.cell.y + 512)) ** 2 <=
        radius ** 2,
  );
}

/**
 * Sends units home when a shot this tick took them to the return threshold or
 * to zero. Manual orders between those two moments are not overridden, and a
 * unit holding a capture keeps it.
 */
export function triggerResupplyReturns(
  before: MatchState,
  after: MatchState,
): MatchState {
  let changed = false;
  const units = after.units.map((unit) => {
    if (unit.autoResupply === false || unit.garrisonedAtBaseId) return unit;
    const previous = before.units.find(({ id }) => id === unit.id);
    if (!previous) return unit;
    const was = currentAmmo(after.rules, previous);
    const now = currentAmmo(after.rules, unit);
    if (now >= was) return unit;
    const threshold = autoReturnAmmo(after.rules, unit);
    if (!(was > threshold && now <= threshold) && !(was > 0 && now === 0))
      return unit;
    if (inResupplyRange(after, unit) || holdsCapture(after, unit)) return unit;
    const route = routeToResupply(after, unit);
    if (!route) return unit;
    changed = true;
    return {
      ...unit,
      path: route.path,
      moveTarget: route.destination,
      waypoints: [],
      marchOrder: null,
      bombardOrder: null,
      resupplyReturn: true,
    };
  });
  return changed ? { ...after, units } : after;
}

/** Restores one shot per interval to units near an owned, intact base. */
export function advanceResupply(state: MatchState): MatchState {
  const interval = state.rules.sustainment.resupplyIntervalTicks;
  if (state.elapsedTicks % interval !== 0) return state;
  let changed = false;
  const units = state.units.map((unit) => {
    const capacity = ammoCapacity(state.rules, unit);
    if (capacity === 0 || unit.hp <= 0) return unit;
    const ammo = currentAmmo(state.rules, unit);
    if (ammo >= capacity || !inResupplyRange(state, unit)) return unit;
    changed = true;
    const next = ammo + 1;
    return {
      ...unit,
      ammo: next,
      ...(next >= capacity && unit.resupplyReturn
        ? { resupplyReturn: false }
        : {}),
    };
  });
  return changed ? { ...state, units } : state;
}
