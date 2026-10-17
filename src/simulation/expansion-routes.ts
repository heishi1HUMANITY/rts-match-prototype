import { CROSSING_ALLOWED_UNIT_KINDS } from './crossings';
import { findPath } from './pathfinding';
import type { RulesMaster } from './rules';
import type {
  ActiveCrossing,
  CrossingTierId,
  GridMap,
  ResearchId,
  StartPositionId,
} from './types';

export interface ExpansionCrossing {
  readonly siteId: string;
  readonly tier: CrossingTierId;
  readonly costCenti: number;
  readonly buildTicks: number;
  /** Research that unlocks this tier; empty for bridge-I. */
  readonly unlockResearch: readonly {
    readonly id: ResearchId;
    readonly costCenti: number;
  }[];
}

export interface ExpansionRoute {
  readonly baseId: string;
  readonly kind: string;
  readonly ticketWeight: number;
  readonly defenseHp: number;
  readonly pathCells: number;
  /** Assault travel time from the start point along the route. */
  readonly assaultTravelTicks: number;
  readonly crossings: readonly ExpansionCrossing[];
  /** A shorter route that opens once bridge-II research is complete. */
  readonly researchBypass?: {
    readonly pathCells: number;
    readonly crossings: readonly ExpansionCrossing[];
  };
}

/** Bridge tiers an assault may need, in the order a faction can unlock them. */
const ROUTE_TIERS: readonly (readonly CrossingTierId[])[] = [
  [],
  ['bridge-1'],
  ['bridge-1', 'bridge-2'],
];

/**
 * Lists every neutral base reachable by an assault from each public start,
 * using the fewest crossing tiers first, with the supply, build time and
 * research each crossing on that route needs.
 */
export function describeExpansionRoutes(
  map: GridMap,
  rules: RulesMaster,
): Record<StartPositionId, readonly ExpansionRoute[]> {
  const sites = map.crossingSites ?? [];
  const asActive = (tiers: readonly CrossingTierId[]): ActiveCrossing[] =>
    sites
      .filter((site) => tiers.includes(site.tier))
      .map((site) => ({
        ...site,
        owner: 'A',
        allowedUnitKinds: CROSSING_ALLOWED_UNIT_KINDS[site.tier],
      }));
  const unlockResearch = (tier: CrossingTierId) =>
    Object.entries(rules.research.definitions)
      .filter(([, definition]) =>
        definition.effects.some(
          (effect) =>
            effect.id === 'crossing-unlock' && effect.crossingTier === tier,
        ),
      )
      .map(([id, definition]) => ({
        id: id as ResearchId,
        costCenti: definition.costCenti,
      }));
  const neutralBases = (map.basePlacements ?? []).filter(
    (base) => base.factionId === null,
  );
  const describe = (origin: { x: number; y: number }) =>
    neutralBases
      .flatMap((base): ExpansionRoute[] => {
        const route = (tiers: readonly CrossingTierId[]) =>
          findPath(map, origin, base.cell, {
            domain: 'land',
            factionId: 'A',
            unitKind: 'assault',
            crossings: asActive(tiers),
          });
        const crossingsOn = (path: readonly { x: number; y: number }[]) =>
          sites
            .filter((site) =>
              site.cells.some((cell) =>
                path.some((step) => step.x === cell.x && step.y === cell.y),
              ),
            )
            .map((site) => ({
              siteId: site.id,
              tier: site.tier,
              costCenti: rules.crossings[site.tier].costCenti,
              buildTicks: rules.crossings[site.tier].buildTicks,
              unlockResearch:
                site.tier === 'bridge-1' ? [] : unlockResearch(site.tier),
            }));
        const widest = route(ROUTE_TIERS[ROUTE_TIERS.length - 1]!);
        for (const tiers of ROUTE_TIERS) {
          const path = route(tiers);
          if (!path) continue;
          const bypass =
            widest && widest.length < path.length ? widest : undefined;
          return [
            {
              baseId: base.id,
              kind: base.kind,
              ticketWeight: rules.bases[base.kind].ticketWeight,
              defenseHp:
                base.kind === 'hq' ? 0 : rules.defenses[base.kind].maxHp,
              pathCells: path.length,
              assaultTravelTicks:
                path.length * rules.units.assault.moveTicksPerCell,
              crossings: crossingsOn(path),
              ...(bypass
                ? {
                    researchBypass: {
                      pathCells: bypass.length,
                      crossings: crossingsOn(bypass),
                    },
                  }
                : {}),
            },
          ];
        }
        return [];
      })
      .sort(
        (a, b) => a.pathCells - b.pathCells || a.baseId.localeCompare(b.baseId),
      );
  const starts = map.startPoints;
  if (!starts) throw new Error('map has no public start points');
  return {
    north: describe(starts.north),
    'south-east': describe(starts['south-east']),
    'south-west': describe(starts['south-west']),
  };
}

export interface TransferRoutes {
  /** Land path cells between non-HQ bases before and after bridge-II research. */
  readonly bases: readonly {
    readonly from: string;
    readonly to: string;
    readonly bridgeI: number | null;
    readonly bridgeII: number | null;
  }[];
  /** Patrol-boat path cells between ports. */
  readonly ports: readonly {
    readonly from: string;
    readonly to: string;
    readonly cells: number | null;
  }[];
}

/**
 * Pairwise reinforcement, retreat and front-transfer distances between
 * non-HQ bases, plus boat routes between ports. Land routes are symmetric,
 * so each unordered pair appears once.
 */
export function describeTransferRoutes(map: GridMap): TransferRoutes {
  const sites = map.crossingSites ?? [];
  const asActive = (tiers: readonly CrossingTierId[]): ActiveCrossing[] =>
    sites
      .filter((site) => tiers.includes(site.tier))
      .map((site) => ({
        ...site,
        owner: 'A',
        allowedUnitKinds: CROSSING_ALLOWED_UNIT_KINDS[site.tier],
      }));
  const bases = (map.basePlacements ?? []).filter((base) => base.kind !== 'hq');
  const landCells = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    tiers: readonly CrossingTierId[],
  ) =>
    findPath(map, from, to, {
      domain: 'land',
      factionId: 'A',
      unitKind: 'assault',
      crossings: asActive(tiers),
    })?.length ?? null;
  const ports = map.ports ?? [];
  return {
    bases: bases.flatMap((from, index) =>
      bases.slice(index + 1).map((to) => ({
        from: from.id,
        to: to.id,
        bridgeI: landCells(from.cell, to.cell, ['bridge-1']),
        bridgeII: landCells(from.cell, to.cell, ['bridge-1', 'bridge-2']),
      })),
    ),
    ports: ports.flatMap((from, index) =>
      ports.slice(index + 1).map((to) => ({
        from: from.id,
        to: to.id,
        cells:
          findPath(map, from.cell, to.cell, {
            domain: 'water',
            unitKind: 'patrolBoat',
          })?.length ?? null,
      })),
    ),
  };
}
