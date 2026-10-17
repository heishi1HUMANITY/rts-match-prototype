import { findPath } from '../simulation/pathfinding';
import { terrainAt } from '../simulation/map';
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

function difficultyProfile(view: FactionView) {
  const selected =
    view.rules.npc.difficultyProfiles[view.rules.npc.selectedDifficulty];
  return view.rules.npc.selectedDifficulty === 'standard'
    ? {
        ...selected,
        decisionIntervalTicks: view.rules.npc.decisionIntervalTicks,
        maxCommandsPerDecision: view.rules.npc.maxCommandsPerDecision,
      }
    : selected;
}

function deterministicPercent(view: FactionView, salt: number): number {
  let value = (view.seed ^ Math.imul(view.tick + 1, 0x9e3779b1) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) % 100;
}

function recentPublicNotice(view: FactionView): boolean {
  const delay = difficultyProfile(view).publicReactionDelayTicks;
  return (view.researchAnnouncements ?? []).some(
    (announcement) =>
      announcement.factionId !== view.viewerFactionId &&
      announcement.tick <= view.tick &&
      view.tick - announcement.tick < delay,
  );
}

export function selectNpcResearchRoute(
  view: FactionView,
): 'crossing' | 'field' {
  const start = view.map.startAssignment?.[view.viewerFactionId] ?? 'north';
  const origin = view.map.startPoints?.[start];
  if (!origin) return 'field';
  let rivers = 0;
  let mountains = 0;
  for (
    let y = Math.max(0, origin.y - 12);
    y <= Math.min(view.map.height - 1, origin.y + 12);
    y += 1
  )
    for (
      let x = Math.max(0, origin.x - 12);
      x <= Math.min(view.map.width - 1, origin.x + 12);
      x += 1
    ) {
      const kind = terrainAt(view.map, { x, y });
      if (kind === 'river' || kind === 'riverbank') rivers += 1;
      if (kind === 'mountain') mountains += 1;
    }
  const scoring = view.rules.npc.routeScoring;
  const obstacleScore =
    rivers * scoring.riverPenalty + mountains * scoring.mountainPenalty;
  const nearestPort = (view.map.ports ?? []).reduce(
    (best, port) =>
      Math.min(
        best,
        Math.abs(origin.x - port.cell.x) + Math.abs(origin.y - port.cell.y),
      ),
    view.map.width + view.map.height,
  );
  const portBonus = nearestPort <= 12 ? scoring.portPreference : 0;
  const crossingFit = obstacleScore;
  const fieldFit = Math.max(0, 16 - obstacleScore) + portBonus;
  const gap = Math.abs(crossingFit - fieldFit);
  if (gap <= scoring.nearBestPercent) {
    const seatSalt = start === 'north' ? 0 : start === 'south-east' ? 1 : 2;
    return (Math.imul(view.seed ^ seatSalt, 0x45d9f3b) >>> 0) % 2 === 0
      ? 'crossing'
      : 'field';
  }
  return crossingFit > fieldFit ? 'crossing' : 'field';
}

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
  const start = view.map.startAssignment?.[view.viewerFactionId] ?? 'north';
  const routeOrder =
    view.rules.npc.researchRoutes[start][selectNpcResearchRoute(view)];
  const routePriority = new Map(routeOrder.map((id, index) => [id, index]));
  const order = Object.entries(view.rules.research.definitions)
    .sort(([idA, a], [idB, b]) => {
      const routeA =
        routePriority.get(idA as ResearchId) ?? Number.MAX_SAFE_INTEGER;
      const routeB =
        routePriority.get(idB as ResearchId) ?? Number.MAX_SAFE_INTEGER;
      if (routeA !== routeB) return routeA - routeB;
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
      (definition.prerequisites.length === 0 ||
        definition.prerequisites.some((prerequisite) =>
          faction.completedResearchIds.includes(prerequisite),
        )) &&
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
  const candidatesWithRoutes = candidates
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
    );
  if (candidatesWithRoutes.length === 0) return undefined;
  const scoring = view.rules.npc.routeScoring;
  const terrainScore = (route: readonly Cell[]): number => {
    let rivers = 0;
    let mountains = 0;
    for (const cell of route) {
      const kind = terrainAt(view.map, cell);
      if (kind === 'river' || kind === 'riverbank') rivers += 1;
      if (kind === 'mountain') mountains += 1;
    }
    const portDistance = (view.map.ports ?? []).reduce((best, port) => {
      const distance = Math.min(
        ...route.map(
          (cell) =>
            Math.abs(cell.x - port.cell.x) + Math.abs(cell.y - port.cell.y),
        ),
      );
      return Math.min(best, distance);
    }, view.map.width + view.map.height);
    return (
      route.length +
      rivers * scoring.riverPenalty +
      mountains * scoring.mountainPenalty -
      (portDistance <= 3 ? scoring.portPreference : 0)
    );
  };
  const ranked = candidatesWithRoutes
    .map((entry) => ({ ...entry, score: terrainScore(entry.route) }))
    .sort((a, b) => a.score - b.score || a.base.id.localeCompare(b.base.id));
  const bestScore = ranked[0]!.score;
  const eligible = ranked.filter(
    ({ score }) =>
      score <=
      bestScore +
        Math.max(1, (Math.abs(bestScore) * scoring.nearBestPercent) / 100),
  );
  // The public start seat and match seed pick a stable near-best route. No
  // hidden owner, unit, resource, or research state participates in this tie-break.
  const start = view.map.startAssignment?.[view.viewerFactionId] ?? 'north';
  const seatSalt = start === 'north' ? 0 : start === 'south-east' ? 1 : 2;
  let choice =
    (Math.imul(view.seed ^ seatSalt, 0x45d9f3b) >>> 0) % eligible.length;
  const routeChoiceRoll =
    (Math.imul(view.seed ^ seatSalt, 0x45d9f3b) >>> 0) % 100;
  if (
    eligible.length > 1 &&
    routeChoiceRoll < difficultyProfile(view).nextBestPercent
  )
    choice = (choice + 1) % eligible.length;
  return eligible[choice]!.base;
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

function enemyCell(view: FactionView, enemy: VisibleEnemyUnitView): Cell {
  return {
    x: Math.max(
      0,
      Math.min(view.map.width - 1, Math.floor(enemy.positionX1024 / 1024)),
    ),
    y: Math.max(
      0,
      Math.min(view.map.height - 1, Math.floor(enemy.positionY1024 / 1024)),
    ),
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
    .map((entry) => ({ enemy: entry, cell: enemyCell(view, entry) }))
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

export function knownAirDefenseDetour(
  view: FactionView,
  unit: OwnUnitView,
  goal: Cell,
): Cell | undefined {
  if (unit.kind !== 'helicopter' || view.airDefenseMemory.length === 0)
    return undefined;
  const from = currentCell(unit);
  const routeFor = (waypoints: readonly Cell[]) => {
    const points = [...waypoints, goal];
    const route: Cell[] = [];
    let cursor = from;
    for (const point of points) {
      const segment = findPath(view.map, cursor, point, { domain: 'air' });
      if (!segment) return null;
      route.push(...segment);
      cursor = point;
    }
    return route;
  };
  const direct = routeFor([]);
  if (!direct) return undefined;
  const conflicts = (route: readonly Cell[]) =>
    view.airDefenseMemory.filter(({ cell, range }) =>
      route.some(
        (point) =>
          (point.x - cell.x) ** 2 + (point.y - cell.y) ** 2 <= (range + 2) ** 2,
      ),
    );
  const threatened = conflicts(direct);
  if (threatened.length === 0) return undefined;
  const danger = threatened[0]!;
  const radius = Math.ceil(danger.range + 3);
  const candidates = [
    { x: danger.cell.x - radius, y: danger.cell.y },
    { x: danger.cell.x + radius, y: danger.cell.y },
    { x: danger.cell.x, y: danger.cell.y - radius },
    { x: danger.cell.x, y: danger.cell.y + radius },
    { x: danger.cell.x - radius, y: danger.cell.y - radius },
    { x: danger.cell.x + radius, y: danger.cell.y - radius },
    { x: danger.cell.x - radius, y: danger.cell.y + radius },
    { x: danger.cell.x + radius, y: danger.cell.y + radius },
  ].filter(
    ({ x, y }) => x >= 0 && y >= 0 && x < view.map.width && y < view.map.height,
  );
  const safe = candidates
    .flatMap((waypoint) => {
      const route = routeFor([waypoint]);
      return route && conflicts(route).length === 0
        ? [{ waypoint, length: route.length }]
        : [];
    })
    .sort(
      (a, b) =>
        a.length - b.length ||
        a.waypoint.y - b.waypoint.y ||
        a.waypoint.x - b.waypoint.x,
    );
  return safe[0]?.waypoint;
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
      .map((enemy) => ({ enemy, cell: enemyCell(view, enemy) }))
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
    const centerX = Math.floor(view.map.width / 2);
    const centerY = Math.floor(view.map.height / 2);
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
          Math.abs(a.x - centerX) +
          Math.abs(a.y - centerY) -
          (Math.abs(b.x - centerX) + Math.abs(b.y - centerY)),
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
  // Public faction notices are already part of every faction's view. Keep
  // current orders, but let each difficulty react to new strategic routing
  // only after its configured notice delay; visible local defense stays live.
  if (!defense && recentPublicNotice(view) && !order) return undefined;
  if (
    !defense &&
    order?.target.kind === 'base' &&
    order.target.id !== goal.target.id &&
    view.tick - order.lastSeenTick <
      difficultyProfile(view).targetSwitchGraceTicks
  )
    return undefined;
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
    currentEndpoint.y === goal.cell.y &&
    (!unit.waypoints?.length || unit.kind !== 'helicopter')
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
  const detour = knownAirDefenseDetour(view, unit, goal.cell);
  if (detour) {
    if (
      unit.moveTarget?.x === goal.cell.x &&
      unit.moveTarget.y === goal.cell.y &&
      unit.waypoints?.some(({ x, y }) => x === detour.x && y === detour.y)
    )
      return undefined;
    return {
      type: 'move',
      unitId: unit.id,
      target: goal.cell,
      waypoints: [detour],
    };
  }
  return { type: 'march', unitId: unit.id, target: goal.target };
}

function tacticalAbilityCommand(view: FactionView): Command | undefined {
  const faction = view.ownFaction;
  const ready = (id: keyof typeof faction.abilityReadyAtTick): boolean =>
    view.tick >= faction.abilityReadyAtTick[id] &&
    faction.supplyCenti >= view.rules.tacticalAbilities[id].costCenti;
  const visibleCell = (cell: { readonly x: number; readonly y: number }) =>
    cell.x >= 0 &&
    cell.y >= 0 &&
    cell.x < view.map.width &&
    cell.y < view.map.height &&
    view.visible[cell.y * view.map.width + cell.x] === true;
  const enemyCells = view.visibleEnemies
    .filter((enemy) => enemy.factionId !== 'local')
    .map((enemy) => ({
      enemy,
      cell: {
        x: Math.floor(enemy.positionX1024 / 1024),
        y: Math.floor(enemy.positionY1024 / 1024),
      },
    }));
  if (ready('artillery')) {
    const candidates = enemyCells
      .filter(
        ({ enemy, cell }) =>
          view.rules.units[enemy.kind].movementDomain !== 'air' &&
          visibleCell(cell),
      )
      .map(({ cell }) => ({
        cell,
        count: enemyCells.filter(
          ({ enemy, cell: other }) =>
            view.rules.units[enemy.kind].movementDomain !== 'air' &&
            (other.x - cell.x) ** 2 + (other.y - cell.y) ** 2 <=
              view.rules.tacticalAbilities.artillery.radius ** 2,
        ).length,
      }))
      .sort(
        (a, b) =>
          b.count - a.count || a.cell.y - b.cell.y || a.cell.x - b.cell.x,
      );
    const target = candidates[0];
    if (target && target.count >= 3)
      return {
        type: 'activate-ability',
        abilityId: 'artillery',
        cell: target.cell,
      };
  }
  if (
    ready('bulwark') &&
    faction.bulwarkUntilTick <= view.tick &&
    view.bases.some(
      (base) =>
        base.visibility === 'owned' &&
        enemyCells.some(
          ({ cell }) =>
            Math.abs(cell.x - base.cell.x) + Math.abs(cell.y - base.cell.y) <=
            view.rules.npc.defenseAttentionRadius,
        ),
    )
  )
    return { type: 'activate-ability', abilityId: 'bulwark' };
  if (
    ready('smoke') &&
    view.ownUnits.some((unit) =>
      enemyCells.some(
        ({ cell }) =>
          Math.abs(cell.x - unit.cell.x) + Math.abs(cell.y - unit.cell.y) <= 3,
      ),
    )
  ) {
    const front = view.ownUnits
      .filter((unit) => unit.attack?.phase === 'idle')
      .map((unit) => ({
        unit,
        threats: enemyCells.filter(
          ({ cell }) =>
            Math.abs(cell.x - unit.cell.x) + Math.abs(cell.y - unit.cell.y) <=
            3,
        ).length,
      }))
      .sort(
        (a, b) => b.threats - a.threats || a.unit.id.localeCompare(b.unit.id),
      )[0];
    if (front && front.threats > 0)
      return {
        type: 'activate-ability',
        abilityId: 'smoke',
        cell: front.unit.cell,
      };
  }
  const committed = view.ownUnits.length + faction.productionJobs.length;
  if (
    ready('surge') &&
    faction.productionBoostUntilTick <= view.tick &&
    faction.productionJobs.length > 0 &&
    committed < view.rules.limits.maxUnits
  )
    return { type: 'activate-ability', abilityId: 'surge' };
  const mapCenter = {
    x: Math.floor(view.map.width / 2),
    y: Math.floor(view.map.height / 2),
  };
  const surveyCell = view.visible
    .flatMap((isVisible, index) =>
      isVisible
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
        (a.x - mapCenter.x) ** 2 +
          (a.y - mapCenter.y) ** 2 -
          ((b.x - mapCenter.x) ** 2 + (b.y - mapCenter.y) ** 2) ||
        a.y - b.y ||
        a.x - b.x,
    )[0];
  if (
    ready('survey') &&
    surveyCell &&
    !visibleCell(mapCenter) &&
    deterministicPercent(view, 907) < difficultyProfile(view).scoutUsePercent
  )
    return { type: 'activate-ability', abilityId: 'survey', cell: surveyCell };
  if (ready('jam')) {
    const target = (['A', 'B', 'C'] as const)
      .filter(
        (id) =>
          id !== view.viewerFactionId &&
          view.publicEliminations[id].eliminatedAtTick === null,
      )
      .sort(
        (a, b) =>
          view.ticketsCenti[b] - view.ticketsCenti[a] || a.localeCompare(b),
      )[0];
    if (target)
      return {
        type: 'activate-ability',
        abilityId: 'jam',
        targetFactionId: target,
      };
  }
  return undefined;
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
    () => tacticalAbilityCommand(view),
    ...[...view.ownUnits]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((unit) => () => unitMoveCommand(view, unit)),
  ];
  const decision = Math.floor(
    view.tick / difficultyProfile(view).decisionIntervalTicks,
  );
  const start = decision % slots.length;
  const commands: Command[] = [];
  for (let offset = 0; offset < slots.length; offset += 1) {
    if (commands.length >= difficultyProfile(view).maxCommandsPerDecision)
      break;
    const command = slots[(start + offset) % slots.length]!();
    if (command) commands.push(command);
  }
  return commands;
}
