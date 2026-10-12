import { findPath } from '../simulation/pathfinding';
import { crossingResearchComplete } from '../simulation/crossings';
import type {
  BaseView,
  ActiveCrossing,
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
  const order: readonly ResearchId[] = [
    'firepower-1',
    'bridge-2',
    'ropeway-1',
    'firepower-2',
    'bridge-3',
    'ropeway-2',
  ];
  const next = order.find((id) => {
    const definition = view.rules.research.definitions[id];
    return (
      !faction.completedResearchIds.includes(id) &&
      faction.activeResearch?.researchId !== id &&
      (definition.prerequisite === null ||
        faction.completedResearchIds.includes(definition.prerequisite))
    );
  });
  return next ? { type: 'start-research', researchId: next } : undefined;
}

function knownActiveCrossings(view: FactionView): readonly ActiveCrossing[] {
  return view.crossings.flatMap((crossing) =>
    (crossing.visibility === 'owned' || crossing.visibility === 'visible') &&
    crossing.owner === view.viewerFactionId &&
    crossing.hp > 0 &&
    crossing.job?.kind !== 'build'
      ? [
          {
            ...crossing.site,
            owner: crossing.owner,
            allowedUnitKinds: crossing.site.tier.startsWith('ropeway')
              ? (['scout'] as const)
              : (['assault', 'scout'] as const),
          },
        ]
      : [],
  );
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
    .map((base) => ({
      base,
      route: findPath(view.map, from, base.cell, {
        factionId: unit.factionId,
        domain: 'land',
        crossings: knownActiveCrossings(view),
        unitKind: unit.kind,
      }),
    }))
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

function crossingConstructionCommand(
  view: FactionView,
  unit: OwnUnitView,
): Command | undefined {
  if (unit.kind !== 'assault') return undefined;
  const known = view.crossings.filter(
    (crossing) =>
      crossing.visibility === 'visible' || crossing.visibility === 'owned',
  );
  const options = known
    .flatMap((crossing) => {
      const { site } = crossing;
      const stats = view.rules.crossings[site.tier];
      if (!crossingResearchComplete(view.ownFaction, view.rules, site.tier))
        return [];
      const resumesOwnBuild =
        crossing.job?.kind === 'build' &&
        crossing.job.factionId === view.ownFaction.id;
      if (crossing.owner !== null) return [];
      if (crossing.job !== null && !resumesOwnBuild) return [];
      if (!resumesOwnBuild && view.ownFaction.supplyCenti < stats.costCenti)
        return [];
      const paths = [site.bankA, site.bankB].map((bank) => ({
        bank,
        route: findPath(view.map, currentCell(unit), bank, {
          factionId: unit.factionId,
          domain: 'land',
          crossings: knownActiveCrossings(view),
          unitKind: unit.kind,
          allowBlockedStart: true,
        }),
      }));
      const best = paths
        .filter((entry) => entry.route !== null)
        .sort((a, b) => a.route!.length - b.route!.length)[0];
      if (!best) return [];
      return [
        {
          siteId: site.id,
          bank: best.bank,
          route: best.route!,
          adjacent:
            isNear(unit.cell, site.bankA) || isNear(unit.cell, site.bankB),
        },
      ];
    })
    .sort(
      (a, b) =>
        a.route.length - b.route.length || (a.siteId < b.siteId ? -1 : 1),
    )[0];
  if (!options) return undefined;
  if (options.adjacent)
    return { type: 'build-crossing', siteId: options.siteId, unitId: unit.id };
  const destination = endpoint(unit);
  if (destination?.x === options.bank.x && destination.y === options.bank.y)
    return undefined;
  return { type: 'move', unitId: unit.id, target: options.bank };
}

function isNear(cell: Cell, bank: Cell): boolean {
  return Math.abs(cell.x - bank.x) + Math.abs(cell.y - bank.y) <= 1;
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
    (base) => base.kind !== 'hq' && !isOwnBase(base, factionId),
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
          findPath(view.map, currentCell(unit), proposedDefense.cell, {
            factionId: unit.factionId,
            domain: 'land',
            crossings: knownActiveCrossings(view),
            unitKind: unit.kind,
          })
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
  if (!goal) return crossingConstructionCommand(view, unit);
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
