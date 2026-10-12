import { findPath } from './pathfinding';
import { unitCapabilities } from './unit-capabilities';
import { knownActiveCrossings } from './crossings';
import {
  getUnitPositionX1024,
  getUnitPositionY1024,
  isCellVisibleToFaction,
  isUnitVisibleToFaction,
} from './visibility';
import type {
  Cell,
  MarchOrder,
  MarchTarget,
  MatchState,
  UnitState,
} from './types';

function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

function currentEdge(unit: UnitState): Cell | undefined {
  return unit.edgeProgress > 0 ? unit.path[0] : undefined;
}

function holdAtNextCenter(unit: UnitState): readonly Cell[] {
  const edge = currentEdge(unit);
  return edge === undefined ? [] : [edge];
}

function distanceSquared(
  ax2: number,
  ay2: number,
  bx2: number,
  by2: number,
): number {
  const dx = ax2 - bx2;
  const dy = ay2 - by2;
  return dx * dx + dy * dy;
}

function inUnitRange(
  state: MatchState,
  unit: UnitState,
  target: UnitState,
): boolean {
  const range = state.rules.units[unit.kind].range * 1024;
  return (
    distanceSquared(
      getUnitPositionX1024(unit),
      getUnitPositionY1024(unit),
      getUnitPositionX1024(target),
      getUnitPositionY1024(target),
    ) <=
    range * range
  );
}

function inBaseRange(state: MatchState, unit: UnitState, cell: Cell): boolean {
  const range = state.rules.units[unit.kind].range * 1024;
  return (
    distanceSquared(
      getUnitPositionX1024(unit),
      getUnitPositionY1024(unit),
      1024 * cell.x + 512,
      1024 * cell.y + 512,
    ) <=
    range * range
  );
}

function routeTo(
  state: MatchState,
  unit: UnitState,
  destination: Cell,
): readonly Cell[] | null {
  const edge = currentEdge(unit);
  const origin = edge ?? unit.cell;
  const route = findPath(state.map, origin, destination, {
    factionId: unit.factionId,
    domain: unitCapabilities(unit.kind, state.rules).movementDomain,
    crossings: knownActiveCrossings(state, unit.factionId),
    unitKind: unit.kind,
    allowBlockedStart: true,
  });
  if (route === null) return null;
  return edge === undefined ? route : [edge, ...route];
}

/** Creates a validated initial path and order for a command. */
export function advanceMarchOrder(
  state: MatchState,
  unit: UnitState,
  target: MarchTarget,
  lastKnownCell: Cell,
  lastSeenTick = state.elapsedTicks,
  status: MarchOrder['status'] = 'tracking',
): UnitState | null {
  const path = routeTo(state, unit, lastKnownCell);
  if (path === null) return null;
  return {
    ...unit,
    path,
    moveTarget: null,
    marchOrder: {
      target,
      lastKnownCell: { ...lastKnownCell },
      lastSeenTick,
      status,
    },
  };
}

function updateOrder(state: MatchState, unit: UnitState): UnitState {
  const order = unit.marchOrder;
  if (order == null) return unit;

  let destination = order.lastKnownCell;
  let status: MarchOrder['status'] = order.status;
  let lastKnownCell = order.lastKnownCell;
  let lastSeenTick = order.lastSeenTick;
  let targetVisible = false;
  let liveEnemy: UnitState | undefined;
  let visibleEnemyBase = false;
  let actionableBase = false;

  if (order.target.kind === 'unit') {
    const target = state.units.find(({ id }) => id === order.target.id);
    if (
      target !== undefined &&
      target.factionId !== unit.factionId &&
      target.hp > 0
    ) {
      targetVisible = isUnitVisibleToFaction(state, target, unit.factionId);
      if (targetVisible) {
        liveEnemy = target;
        lastKnownCell = {
          x: Math.floor(getUnitPositionX1024(target) / 1024),
          y: Math.floor(getUnitPositionY1024(target) / 1024),
        };
        destination = lastKnownCell;
        lastSeenTick = state.elapsedTicks;
      }
    }
  } else {
    const base = state.bases.find(({ id }) => id === order.target.id);
    const stronghold =
      order.target.id === state.localFaction.stronghold.id &&
      state.localFaction.active &&
      !state.localFaction.defeated
        ? state.localFaction.stronghold
        : undefined;
    const targetCell = base?.cell ?? stronghold?.cell;
    if (targetCell !== undefined) {
      destination = targetCell;
      lastKnownCell = targetCell;
      targetVisible = isCellVisibleToFaction(state, targetCell, unit.factionId);
      if (targetVisible) {
        lastSeenTick = state.elapsedTicks;
        visibleEnemyBase =
          stronghold !== undefined ||
          (base !== undefined &&
            base.owner !== null &&
            base.owner !== unit.factionId &&
            base.hp > 0);
        actionableBase =
          stronghold === undefined &&
          base !== undefined &&
          (base.owner === unit.factionId ||
            base.owner === null ||
            base.hp === 0);
      }
    }
  }

  if (!targetVisible) {
    status = 'searching';
    const route = routeTo(state, unit, order.lastKnownCell);
    if (route === null) {
      status = 'blocked';
      return {
        ...unit,
        path: holdAtNextCenter(unit),
        moveTarget: null,
        marchOrder: { ...order, status },
      };
    }
    if (route.length === 0) {
      return {
        ...unit,
        path: [],
        moveTarget: null,
        marchOrder: { ...order, status: 'searching' },
      };
    }
    return {
      ...unit,
      path: route,
      moveTarget: null,
      marchOrder: { ...order, status, lastKnownCell, lastSeenTick },
    };
  }

  if (liveEnemy !== undefined && inUnitRange(state, unit, liveEnemy)) {
    return {
      ...unit,
      path: holdAtNextCenter(unit),
      moveTarget: null,
      marchOrder: {
        ...order,
        lastKnownCell,
        lastSeenTick,
        status: 'arrived',
      },
    };
  }
  if (visibleEnemyBase) {
    if (inBaseRange(state, unit, destination)) {
      return {
        ...unit,
        path: holdAtNextCenter(unit),
        marchOrder: {
          ...order,
          lastKnownCell,
          lastSeenTick,
          status: 'arrived',
        },
      };
    }
  }

  const route = routeTo(state, unit, destination);
  if (route === null) {
    return {
      ...unit,
      path: holdAtNextCenter(unit),
      moveTarget: null,
      marchOrder: { ...order, lastKnownCell, lastSeenTick, status: 'blocked' },
    };
  }
  const arrivedAtCell = route.length === 0 && sameCell(unit.cell, destination);
  status = arrivedAtCell && actionableBase ? 'arrived' : 'tracking';
  return {
    ...unit,
    path: route,
    moveTarget: null,
    marchOrder: { ...order, lastKnownCell, lastSeenTick, status },
  };
}

/** Refreshes pursuit routes from the same pre-movement visibility snapshot. */
export function advanceMarchOrders(state: MatchState): MatchState {
  let changed = false;
  const units = state.units.map((unit) => {
    const next = updateOrder(state, unit);
    if (next !== unit) changed = true;
    return next;
  });
  return changed ? { ...state, units } : state;
}

/** Clears a pursuit only when a target death was visible in the combat snapshot. */
export function clearObservedDeadMarchTargets(
  beforeCombat: MatchState,
  afterCombat: MatchState,
): MatchState {
  const survivingIds = new Set(afterCombat.units.map(({ id }) => id));
  let changed = false;
  const units = afterCombat.units.map((unit) => {
    const order = unit.marchOrder;
    if (order?.target.kind !== 'unit') return unit;
    const target = beforeCombat.units.find(({ id }) => id === order.target.id);
    if (
      target === undefined ||
      survivingIds.has(target.id) ||
      !isUnitVisibleToFaction(beforeCombat, target, unit.factionId)
    ) {
      return unit;
    }
    changed = true;
    return {
      ...unit,
      path: holdAtNextCenter(unit),
      marchOrder: null,
    };
  });
  return changed ? { ...afterCombat, units } : afterCombat;
}

/** The current order's target when it is visible, hostile, alive, and in range. */
export function visibleMarchCombatTarget(
  state: MatchState,
  attacker: UnitState,
): { readonly kind: 'unit' | 'base'; readonly id: string } | null {
  const order = attacker.marchOrder;
  if (order == null) return null;
  if (order.target.kind === 'unit') {
    const target = state.units.find(({ id }) => id === order.target.id);
    return target !== undefined &&
      target.factionId !== attacker.factionId &&
      target.hp > 0 &&
      isUnitVisibleToFaction(state, target, attacker.factionId) &&
      inUnitRange(state, attacker, target)
      ? order.target
      : null;
  }
  const base = state.bases.find(({ id }) => id === order.target.id);
  const stronghold =
    order.target.id === state.localFaction.stronghold.id &&
    state.localFaction.active &&
    !state.localFaction.defeated
      ? state.localFaction.stronghold
      : undefined;
  if (
    stronghold &&
    attacker.factionId !== 'local' &&
    stronghold.hp > 0 &&
    isCellVisibleToFaction(state, stronghold.cell, attacker.factionId) &&
    inBaseRange(state, attacker, stronghold.cell)
  )
    return order.target;
  return base !== undefined &&
    base.owner !== null &&
    base.owner !== attacker.factionId &&
    base !== undefined &&
    base.hp > 0 &&
    isCellVisibleToFaction(state, base.cell, attacker.factionId) &&
    inBaseRange(state, attacker, base.cell)
    ? order.target
    : null;
}
