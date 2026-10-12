import { findPath } from '../simulation/pathfinding';
import type {
  BaseView,
  Cell,
  Command,
  FactionId,
  FactionView,
  MarchTarget,
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
  return unit.edgeProgress > 0 && unit.path[0] ? unit.path[0] : unit.cell;
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
    committed >= view.rules.limits.unitsPerFaction ||
    faction.productionJobs.length >= view.rules.limits.productionQueue
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
  if (faction.supplyCenti < view.rules.units[desired].costCenti)
    return undefined;
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
    x: Math.max(0, Math.min(39, Math.floor(enemy.positionX1024 / 1024))),
    y: Math.max(0, Math.min(39, Math.floor(enemy.positionY1024 / 1024))),
  };
}

function isNearFriendlyPosition(
  view: FactionView,
  enemy: VisibleEnemyUnitView,
  unit: OwnUnitView,
): boolean {
  const enemyPosition = {
    x: enemy.positionX1024 / 1024,
    y: enemy.positionY1024 / 1024,
  };
  const friendlyPositions: Cell[] = [
    ...view.ownUnits.map(currentCell),
    ...view.bases
      .filter((base) => isOwnBase(base, view.viewerFactionId))
      .map(({ cell }) => cell),
  ];
  const attentionRadiusSquared = view.rules.npc.defenseAttentionRadius ** 2;
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
): { readonly target: MarchTarget; readonly cell: Cell } | null | undefined {
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
    1024 * unit.cell.x +
    512 +
    (unit.path[0]
      ? Math.round(
          (1024 * unit.edgeProgress * (unit.path[0].x - unit.cell.x)) /
            (unit.moveTicksPerCell ?? 2),
        )
      : 0);
  const ownY2 =
    1024 * unit.cell.y +
    512 +
    (unit.path[0]
      ? Math.round(
          (1024 * unit.edgeProgress * (unit.path[0].y - unit.cell.y)) /
            (unit.moveTicksPerCell ?? 2),
        )
      : 0);
  const stats = view.rules.units[unit.kind];
  const dx = ownX2 - enemy.enemy.positionX1024;
  const dy = ownY2 - enemy.enemy.positionY1024;
  if (dx * dx + dy * dy <= (1024 * stats.range) ** 2) return null;
  return { target: { kind: 'unit', id: enemy.enemy.id }, cell: enemy.cell };
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
    proposedDefense === null
      ? null
      : proposedDefense &&
          findPath(view.map, currentCell(unit), proposedDefense.cell)
        ? proposedDefense
        : undefined;
  if (defense === null) return undefined;
  const order = unit.marchOrder;
  if (
    order &&
    order.status !== 'arrived' &&
    order.status !== 'blocked' &&
    (!defense ||
      (order.target.kind === defense.target.kind &&
        order.target.id === defense.target.id))
  ) {
    // Keep a searching target until arrival, unless a new visible threat appears.
    return undefined;
  }
  if (!defense && !order && hasStrategicRoute(unit, strategicTargets))
    return undefined;
  const baseGoal =
    defense === undefined
      ? nearestReachableGoal(view, unit, strategicTargets)
      : undefined;
  const goal =
    defense ??
    (baseGoal
      ? {
          target: { kind: 'base' as const, id: baseGoal.id },
          cell: baseGoal.cell,
        }
      : undefined);
  if (!goal) return undefined;
  if (
    order &&
    order.status !== 'arrived' &&
    order.target.kind === goal.target.kind &&
    order.target.id === goal.target.id
  )
    return undefined;

  const current = currentCell(unit);
  const currentEndpoint = endpoint(unit);
  if (
    !defense &&
    currentEndpoint?.x === goal.cell.x &&
    currentEndpoint.y === goal.cell.y
  ) {
    return undefined;
  }
  if (
    current.x === goal.cell.x &&
    current.y === goal.cell.y &&
    unit.edgeProgress === 0
  ) {
    return undefined;
  }
  return { type: 'march', unitId: unit.id, target: goal.target };
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
  const maxCommands = view.rules.npc.maxCommandsPerDecision;
  const production = productionCommand(view);
  if (production && commands.length < maxCommands) commands.push(production);
  const research = researchCommand(view);
  if (research && commands.length < maxCommands) commands.push(research);
  for (const unit of view.ownUnits) {
    if (commands.length >= maxCommands) break;
    const move = unitMoveCommand(view, unit);
    if (move) commands.push(move);
  }
  return commands;
}
