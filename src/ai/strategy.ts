import {
  PRODUCTION_QUEUE_LIMIT,
  UNIT_LIMIT,
  UNIT_STATS,
} from '../simulation/config';
import { findPath } from '../simulation/pathfinding';
import type {
  BaseView,
  Cell,
  Command,
  FactionId,
  FactionView,
  OwnedBaseView,
  OwnUnitView,
  ResearchId,
  VisibleEnemyUnitView,
} from '../simulation/types';

const FACTIONS: readonly FactionId[] = ['A', 'B', 'C'];

function distanceSquared(a: Cell, b: Cell): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function currentCell(unit: OwnUnitView): Cell {
  return unit.edgeProgress === 1 && unit.path[0] ? unit.path[0] : unit.cell;
}

function endpoint(unit: OwnUnitView): Cell | undefined {
  return unit.path[unit.path.length - 1];
}

function baseKnownOwner(base: BaseView): FactionId | null | undefined {
  return base.visibility === 'unknown' ? undefined : base.owner;
}

function isOwnBase(base: BaseView, faction: FactionId): boolean {
  if (base.visibility === 'remembered' && base.selfReportedLost) return false;
  return base.visibility === 'owned' || baseKnownOwner(base) === faction;
}

function isLiveKnownBase(base: BaseView): boolean {
  if (base.visibility === 'unknown') return true;
  return base.hp > 0;
}

function factionOrderDistance(a: FactionId, b: FactionId): number {
  return FACTIONS.indexOf(a) - FACTIONS.indexOf(b);
}

function researchCommand(view: FactionView): Command | undefined {
  const faction = view.ownFaction;
  const next: ResearchId | undefined = faction.completedResearchIds.includes(
    'firepower-1',
  )
    ? faction.completedResearchIds.includes('firepower-2')
      ? undefined
      : 'firepower-2'
    : 'firepower-1';
  if (!next || faction.activeResearch?.researchId === next) return undefined;
  return { type: 'start-research', researchId: next };
}

function productionCommand(view: FactionView): Command | undefined {
  const faction = view.ownFaction;
  const hq = view.bases.find(
    (base): base is OwnedBaseView =>
      base.kind === 'hq' && base.visibility === 'owned',
  );
  if (!hq || hq.hp <= 0) return undefined;
  const committed = view.ownUnits.length + faction.productionJobs.length;
  if (
    committed >= UNIT_LIMIT ||
    faction.productionJobs.length >= PRODUCTION_QUEUE_LIMIT
  ) {
    return undefined;
  }

  const scoutCount = view.ownUnits.filter(
    ({ kind }) => kind === 'scout',
  ).length;
  const queuedScouts = faction.productionJobs.filter(
    ({ unitKind }) => unitKind === 'scout',
  ).length;
  const desired: 'assault' | 'scout' =
    scoutCount + queuedScouts === 0 ? 'scout' : 'assault';
  if (faction.supplyCenti < UNIT_STATS[desired].costCenti) return undefined;
  return { type: 'enqueue-production', baseId: hq.id, unitKind: desired };
}

function nearestReachableGoal(
  view: FactionView,
  unit: OwnUnitView,
  candidates: readonly BaseView[],
): BaseView | undefined {
  const from = currentCell(unit);
  return candidates
    .map((base) => ({ base, route: findPath(view.map, from, base.cell) }))
    .filter(
      (entry): entry is { base: BaseView; route: readonly Cell[] } =>
        entry.route !== null,
    )
    .sort((a, b) => {
      if (a.route.length !== b.route.length)
        return a.route.length - b.route.length;
      return a.base.id < b.base.id ? -1 : a.base.id > b.base.id ? 1 : 0;
    })[0]?.base;
}

function enemyCell(enemy: VisibleEnemyUnitView): Cell {
  return {
    x: Math.max(0, Math.min(39, Math.floor(enemy.positionX2 / 2))),
    y: Math.max(0, Math.min(39, Math.floor(enemy.positionY2 / 2))),
  };
}

function isNearFriendlyPosition(
  view: FactionView,
  enemy: VisibleEnemyUnitView,
  unit: OwnUnitView,
): boolean {
  const enemyPosition = { x: enemy.positionX2 / 2, y: enemy.positionY2 / 2 };
  const friendlyPositions: Cell[] = [
    ...view.ownUnits.map(currentCell),
    ...view.bases
      .filter((base) => isOwnBase(base, view.viewerFactionId))
      .map(({ cell }) => cell),
  ];
  const attentionRadiusSquared = 10 * 10;
  return (
    friendlyPositions.some(
      (position) =>
        distanceSquared(position, enemyPosition) <= attentionRadiusSquared,
    ) ||
    distanceSquared(currentCell(unit), enemyPosition) <= attentionRadiusSquared
  );
}

function enemyDefenseGoal(
  view: FactionView,
  unit: OwnUnitView,
): Cell | null | undefined {
  const enemy = view.visibleEnemies
    .filter((entry) => entry.factionId !== view.viewerFactionId)
    .filter((entry) => isNearFriendlyPosition(view, entry, unit))
    .map((entry) => ({ enemy: entry, cell: enemyCell(entry) }))
    .sort((a, b) => {
      const da = distanceSquared(currentCell(unit), a.cell);
      const db = distanceSquared(currentCell(unit), b.cell);
      return (
        da - db ||
        factionOrderDistance(a.enemy.factionId, b.enemy.factionId) ||
        (a.enemy.id < b.enemy.id ? -1 : a.enemy.id > b.enemy.id ? 1 : 0)
      );
    })[0];
  if (!enemy) return undefined;
  const ownX2 =
    2 * unit.cell.x +
    1 +
    (unit.path[0] ? unit.edgeProgress * (unit.path[0].x - unit.cell.x) : 0);
  const ownY2 =
    2 * unit.cell.y +
    1 +
    (unit.path[0] ? unit.edgeProgress * (unit.path[0].y - unit.cell.y) : 0);
  const stats = UNIT_STATS[unit.kind];
  const dx = ownX2 - enemy.enemy.positionX2;
  const dy = ownY2 - enemy.enemy.positionY2;
  if (dx * dx + dy * dy <= (2 * stats.range) ** 2) return null;
  return enemy.cell;
}

function hasStrategicRoute(
  unit: OwnUnitView,
  targets: readonly BaseView[],
): boolean {
  const destination = endpoint(unit);
  return Boolean(
    destination &&
    targets.some(
      ({ cell }) => cell.x === destination.x && cell.y === destination.y,
    ),
  );
}

function unitMoveCommand(
  view: FactionView,
  unit: OwnUnitView,
): Command | undefined {
  const factionId = view.viewerFactionId;
  const outposts = view.bases.filter(
    (base) => base.kind === 'outpost' && !isOwnBase(base, factionId),
  );
  const hqs = view.bases.filter(
    (base) =>
      base.kind === 'hq' &&
      base.id !== `HQ-${factionId}` &&
      isLiveKnownBase(base),
  );
  const strategicTargets = outposts.length > 0 ? outposts : hqs;

  const proposedDefense = enemyDefenseGoal(view, unit);
  const defense =
    proposedDefense && findPath(view.map, currentCell(unit), proposedDefense)
      ? proposedDefense
      : undefined;
  if (defense === null) return undefined;
  // A nearby visible threat takes priority, otherwise retain an already-issued
  // strategic order until it completes to avoid repeatedly replacing a route.
  if (!defense && hasStrategicRoute(unit, strategicTargets)) return undefined;
  const goal =
    defense ?? nearestReachableGoal(view, unit, strategicTargets)?.cell;
  if (!goal) return undefined;

  const current = currentCell(unit);
  const currentEndpoint = endpoint(unit);
  if (currentEndpoint?.x === goal.x && currentEndpoint.y === goal.y) {
    return undefined;
  }
  if (current.x === goal.x && current.y === goal.y && unit.edgeProgress === 0) {
    return undefined;
  }
  return { type: 'move', unitId: unit.id, target: goal };
}

/**
 * Stateless NPC policy. Its sole input is the faction-limited snapshot; all
 * resulting actions still pass through the shared command validator.
 */
export function decideBotCommands(view: FactionView): readonly Command[] {
  if (
    view.phase !== 'running' ||
    view.ownFaction.eliminatedAtTick !== null ||
    view.ownFaction.ticketsCenti <= 0
  ) {
    return [];
  }

  const commands: Command[] = [];
  const production = productionCommand(view);
  if (production) commands.push(production);
  const research = researchCommand(view);
  if (research) commands.push(research);
  for (const unit of view.ownUnits) {
    const move = unitMoveCommand(view, unit);
    if (move) commands.push(move);
    if (commands.length >= 8) break;
  }
  return commands;
}
