import { findPath } from '../simulation/pathfinding';
import { unitCapabilities } from '../simulation/unit-capabilities';
import { crossingResearchComplete } from '../simulation/crossings';
import type {
  BaseView,
  ActiveCrossing,
  Cell,
  CombatantId,
  Command,
  FactionId,
  FactionView,
  FacilityKind,
  MarchTarget,
  OwnedBaseView,
  OwnUnitView,
  ResearchId,
  VisibleEnemyUnitView,
  UnitKind,
} from '../simulation/types';
import { isUnitUnlocked } from '../simulation/research';
import { baseUpgradeTier, maximumBaseLevel } from '../simulation/base-upgrades';

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

function baseKnownOwner(base: BaseView): CombatantId | null | undefined {
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

function factionOrderDistance(a: CombatantId, b: CombatantId): number {
  const order: Record<CombatantId, number> = {
    A: 0,
    B: 1,
    C: 2,
    local: 3,
  };
  return order[a] - order[b];
}

function researchCommand(view: FactionView): Command | undefined {
  const faction = view.ownFaction;
  // Selecting another topic replaces the active charge job. Let it finish.
  if (faction.activeResearch !== null) return undefined;
  const order = Object.entries(view.rules.research.definitions)
    .sort(([idA, a], [idB, b]) => {
      const priority = (definition: typeof a): number =>
        definition.effects.some((effect) => effect.id === 'damage-bonus')
          ? 0
          : definition.effects.some((effect) => effect.id === 'vision-bonus')
            ? 1
            : 2;
      return (
        a.stage - b.stage || priority(a) - priority(b) || idA.localeCompare(idB)
      );
    })
    .map(([id]) => id as ResearchId);
  const next = order.find((id) => {
    const definition = view.rules.research.definitions[id];
    if (!definition) return false;
    return (
      !faction.completedResearchIds.includes(id) &&
      faction.activeResearch?.researchId !== id &&
      definition.prerequisites.every((prerequisite) =>
        faction.completedResearchIds.includes(prerequisite),
      ) &&
      !definition.exclusiveWith.some((excluded) =>
        faction.completedResearchIds.includes(excluded),
      )
    );
  });
  return next ? { type: 'start-research', researchId: next } : undefined;
}

function baseUpgradeCommand(view: FactionView): Command | undefined {
  const maximum = maximumBaseLevel(view.ownFaction, view.rules);
  if (maximum <= 1) return undefined;
  const candidate = view.bases
    .filter((base): base is OwnedBaseView => base.visibility === 'owned')
    .filter(
      (base) =>
        base.hp > 0 &&
        base.level < maximum &&
        base.level < 3 &&
        base.upgradeJob === null &&
        (base.kind !== 'hq' || base.id === `HQ-${view.viewerFactionId}`),
    )
    .map((base) => {
      const targetLevel = (base.level + 1) as 2 | 3;
      return {
        base,
        cost: baseUpgradeTier(base.kind, targetLevel, view.rules).costCenti,
      };
    })
    .filter(({ cost }) => view.ownFaction.supplyCenti >= cost)
    .sort(
      (a, b) =>
        a.base.level - b.base.level ||
        a.cost - b.cost ||
        (a.base.id < b.base.id ? -1 : a.base.id > b.base.id ? 1 : 0),
    )[0];
  return candidate
    ? { type: 'upgrade-base', baseId: candidate.base.id }
    : undefined;
}

/** Conservative paid defenses; hidden facilities never enter this decision. */
export function facilityConstructionCommand(
  view: FactionView,
): Command | undefined {
  const own = view.facilities.filter(
    (facility) => facility.visibility === 'owned',
  );
  if (own.length >= Math.min(2, view.rules.facilities.maxPerFaction))
    return undefined;
  const bases = view.bases.filter(
    (base): base is OwnedBaseView =>
      base.visibility === 'owned' && base.hp > 0 && base.upgradeJob === null,
  );
  const candidates = bases.sort(
    (a, b) =>
      Number(b.kind === 'hq') - Number(a.kind === 'hq') ||
      a.id.localeCompare(b.id),
  );
  for (const base of candidates) {
    const attached = own.filter(
      (facility) =>
        facility.anchor.kind === 'base' && facility.anchor.id === base.id,
    );
    if (attached.length >= view.rules.facilities.slotsPerAnchor) continue;
    const nearby = view.visibleEnemies.filter(
      (enemy) =>
        distanceSquared(base.cell, {
          x: enemy.positionX1024 / 1024,
          y: enemy.positionY1024 / 1024,
        }) <= 100,
    );
    const priority: FacilityKind[] = nearby.some(
      (enemy) => view.rules.units[enemy.kind].movementDomain === 'air',
    )
      ? ['antiAir', 'turret', 'watchtower']
      : nearby.length
        ? ['turret', 'mine', 'jammer', 'watchtower']
        : ['watchtower', 'turret'];
    for (const kind of priority) {
      if (attached.some((facility) => facility.kind === kind)) continue;
      if (
        !view.ownFaction.completedResearchIds.some((id) =>
          view.rules.research.definitions[id]?.effects.some(
            (effect) =>
              effect.id === 'facility-unlock' && effect.facilityKind === kind,
          ),
        )
      )
        continue;
      // Keep a production budget instead of spending every remaining resource.
      if (
        view.ownFaction.supplyCenti <
        view.rules.facilities.definitions[kind].costCenti * 2 +
          view.rules.units.scout.costCenti
      )
        continue;
      const c = base.cell;
      if (
        ![
          { x: c.x, y: c.y - 1 },
          { x: c.x + 1, y: c.y },
          { x: c.x, y: c.y + 1 },
          { x: c.x - 1, y: c.y },
        ].some(
          (cell) =>
            cell.x >= 0 &&
            cell.y >= 0 &&
            cell.x < view.map.width &&
            cell.y < view.map.height &&
            !view.map.blocked[cell.y * view.map.width + cell.x] &&
            !own.some(
              (facility) =>
                facility.cell.x === cell.x && facility.cell.y === cell.y,
            ),
        )
      )
        continue;
      return {
        type: 'build-facility',
        kind,
        anchor: { kind: 'base', id: base.id },
      };
    }
  }
  return undefined;
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
              : (['assault', 'scout', 'artillery', 'antiAir'] as const),
          },
        ]
      : [],
  );
}

function productionCommand(view: FactionView): Command | undefined {
  const faction = view.ownFaction;
  const committed = view.ownUnits.length + faction.productionJobs.length;
  const ownedBases = view.bases.filter(
    (base) => base.visibility === 'owned' && base.kind !== 'hq' && base.hp > 0,
  ).length;
  const { baseUnits, unitsPerOwnedBase, maxUnits, productionQueue } =
    view.rules.limits;
  const limit = Math.min(maxUnits, baseUnits + ownedBases * unitsPerOwnedBase);
  if (committed >= limit || faction.productionJobs.length >= productionQueue) {
    return undefined;
  }

  const hq = view.bases.find(
    (base): base is OwnedBaseView =>
      base.kind === 'hq' && base.visibility === 'owned' && base.hp > 0,
  );
  const ports = (view.map.ports ?? []).filter(
    ({ factionId }) => factionId === view.viewerFactionId,
  );
  const kinds: readonly UnitKind[] = [
    'antiAir',
    'patrolBoat',
    'artillery',
    'helicopter',
    'assault',
    'scout',
  ];
  const candidates = kinds
    .flatMap((kind) => {
      const stats = view.rules.units[kind];
      if (
        !isUnitUnlocked(faction, view.rules, kind) ||
        faction.supplyCenti < stats.costCenti
      )
        return [];
      const siteId = stats.movementDomain === 'water' ? ports[0]?.id : hq?.id;
      if (!siteId) return [];
      const count =
        view.ownUnits.filter(({ kind: ownedKind }) => ownedKind === kind)
          .length +
        faction.productionJobs.filter(({ unitKind }) => unitKind === kind)
          .length;
      return [{ kind, siteId, count }];
    })
    .sort(
      (a, b) =>
        a.count - b.count || kinds.indexOf(a.kind) - kinds.indexOf(b.kind),
    );
  const desired = candidates[0];
  return desired
    ? {
        type: 'enqueue-production',
        baseId: desired.siteId,
        unitKind: desired.kind,
      }
    : undefined;
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
        factionId: view.viewerFactionId,
        domain: unitCapabilities(unit.kind, view.rules).movementDomain,
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
          factionId: view.viewerFactionId,
          domain: unitCapabilities(unit.kind, view.rules).movementDomain,
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
  if (unitCapabilities(unit.kind, view.rules).movementDomain === 'water') {
    const from = currentCell(unit);
    const enemyGoal = view.visibleEnemies
      .filter((enemy) => enemy.factionId !== factionId)
      .filter(
        (enemy) => view.rules.units[enemy.kind].movementDomain === 'water',
      )
      .map((enemy) => ({ enemy, cell: enemyCell(enemy) }))
      .map((entry) => ({
        ...entry,
        route: findPath(view.map, from, entry.cell, { domain: 'water' }),
      }))
      .filter((entry) => entry.route !== null)
      .sort(
        (a, b) =>
          a.route!.length - b.route!.length ||
          a.enemy.id.localeCompare(b.enemy.id),
      )[0];
    if (enemyGoal) {
      if (
        unit.marchOrder?.target.kind === 'unit' &&
        unit.marchOrder.target.id === enemyGoal.enemy.id
      )
        return undefined;
      return {
        type: 'march',
        unitId: unit.id,
        target: { kind: 'unit', id: enemyGoal.enemy.id },
      };
    }
    const riverCells = (view.map.terrain ?? [])
      .flatMap((kind, index) =>
        kind === 'river'
          ? [
              {
                x: index % view.map.width,
                y: Math.floor(index / view.map.width),
              },
            ]
          : [],
      )
      .sort(
        (a, b) =>
          Math.abs(a.x - 20) +
          Math.abs(a.y - 20) -
          (Math.abs(b.x - 20) + Math.abs(b.y - 20)),
      );
    for (const target of riverCells) {
      const route = findPath(view.map, from, target, { domain: 'water' });
      if (route === null || route.length === 0) continue;
      const destination = endpoint(unit);
      if (destination?.x === target.x && destination.y === target.y)
        return undefined;
      return { type: 'move', unitId: unit.id, target };
    }
    return undefined;
  }
  const outposts = view.bases.filter(
    (base) => base.kind !== 'hq' && !isOwnBase(base, factionId),
  );
  const isHqProtected =
    view.tick < (view.rules.match.hqProtectionTicks ?? 1200);
  const hqs = isHqProtected
    ? []
    : view.bases.filter(
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
            factionId: view.viewerFactionId,
            domain: unitCapabilities(unit.kind, view.rules).movementDomain,
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

  // Rotate fixed action slots rather than only the available commands: an
  // always-available economic action must not starve later units at low limits.
  const slots: (() => Command | undefined)[] = [
    () => productionCommand(view),
    () => researchCommand(view),
    () => baseUpgradeCommand(view) ?? facilityConstructionCommand(view),
    ...[...view.ownUnits]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((unit) => () => unitMoveCommand(view, unit)),
  ];
  const decision = Math.floor(view.tick / view.rules.npc.decisionIntervalTicks);
  const start = decision % slots.length;
  const commands: Command[] = [];
  for (let offset = 0; offset < slots.length; offset += 1) {
    if (commands.length >= view.rules.npc.maxCommandsPerDecision) break;
    const command = slots[(start + offset) % slots.length]!();
    if (command) commands.push(command);
  }
  return commands;
}
