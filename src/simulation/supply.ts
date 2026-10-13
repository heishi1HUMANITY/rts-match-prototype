import { activeCrossings } from './crossings';
import type {
  ActiveCrossing,
  Cell,
  FactionId,
  GridMap,
  MatchState,
} from './types';

export interface SupplyNetwork {
  readonly reachableCells: ReadonlySet<string>;
  readonly connectedBaseIds: readonly string[];
  readonly connectedCrossingIds: readonly string[];
  readonly disconnectedBaseReasons: Readonly<Record<string, string>>;
}

const cellKey = (x: number, y: number): string => `${x},${y}`;
const networkCache = new WeakMap<MatchState, Map<FactionId, SupplyNetwork>>();
const reachabilityCache = new WeakMap<
  GridMap,
  Map<string, ReadonlySet<string>>
>();

export function supplyReachableCells(
  map: GridMap,
  origin: Cell,
  factionId: FactionId,
  crossings: readonly ActiveCrossing[],
): ReadonlySet<string> {
  const crossingCells = new Set(
    crossings
      .filter((crossing) => crossing.owner === factionId)
      .flatMap((crossing) => crossing.cells.map(({ x, y }) => cellKey(x, y))),
  );
  const canSupplyTraverse = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const index = y * map.width + x;
    if (index >= map.blocked.length) return false;
    if (crossingCells.has(cellKey(x, y))) return true;
    const terrain =
      map.terrain?.[index] ?? (map.blocked[index] ? 'mountain' : 'land');
    return (
      (terrain === 'land' || terrain === 'riverbank') && !map.blocked[index]
    );
  };
  const seen = new Set<string>([cellKey(origin.x, origin.y)]);
  const queue = [origin];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head]!;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      const key = cellKey(x, y);
      if (seen.has(key) || !canSupplyTraverse(x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

/** Computes land supply reachability from the surviving home capital. */
export function supplyNetwork(
  state: MatchState,
  factionId: FactionId,
): SupplyNetwork {
  const existing = networkCache.get(state)?.get(factionId);
  if (existing) return existing;
  const hq = state.bases.find(
    (base) =>
      base.kind === 'hq' &&
      base.homeFactionId === factionId &&
      base.owner === factionId &&
      base.hp > 0,
  );
  if (!hq) {
    const empty: SupplyNetwork = {
      reachableCells: new Set(),
      connectedBaseIds: [],
      connectedCrossingIds: [],
      disconnectedBaseReasons: Object.fromEntries(
        state.bases
          .filter((base) => base.owner === factionId && base.hp > 0)
          .map(({ id }) => [id, '首都喪失により補給線がありません']),
      ),
    };
    const byFaction = networkCache.get(state) ?? new Map();
    byFaction.set(factionId, empty);
    networkCache.set(state, byFaction);
    return empty;
  }

  const crossings = activeCrossings(state);
  const activeForFaction = crossings
    .filter(({ owner }) => owner === factionId)
    .sort((a, b) => a.id.localeCompare(b.id));
  const topologyKey = `${factionId}:${hq.cell.x},${hq.cell.y}:${activeForFaction.map(({ id }) => id).join(',')}`;
  const byTopology = reachabilityCache.get(state.map) ?? new Map();
  let seen = byTopology.get(topologyKey);
  if (!seen) {
    seen = supplyReachableCells(
      state.map,
      hq.cell,
      factionId,
      activeForFaction,
    );
    byTopology.set(topologyKey, seen);
    reachabilityCache.set(state.map, byTopology);
  }
  const connected = (x: number, y: number): boolean => seen.has(cellKey(x, y));
  const disconnectedBaseReasons = Object.fromEntries(
    state.bases
      .filter(
        (base) =>
          base.owner === factionId &&
          base.hp > 0 &&
          !connected(base.cell.x, base.cell.y),
      )
      .map((base) => {
        const frontier = (state.map.crossingSites ?? [])
          .flatMap((site) => {
            const aReachable = connected(site.bankA.x, site.bankA.y);
            const bReachable = connected(site.bankB.x, site.bankB.y);
            if (aReachable === bReachable) return [];
            const farBank = aReachable ? site.bankB : site.bankA;
            return [
              {
                id: site.id,
                distance:
                  Math.abs(base.cell.x - farBank.x) +
                  Math.abs(base.cell.y - farBank.y),
              },
            ];
          })
          .sort(
            (a, b) => a.distance - b.distance || a.id.localeCompare(b.id),
          )[0];
        return [
          base.id,
          frontier
            ? `接続候補 ${frontier.id} を確保してください`
            : '首都から到達できる陸路/自軍渡河点がありません',
        ];
      }),
  );
  const network: SupplyNetwork = {
    reachableCells: seen,
    connectedBaseIds: state.bases
      .filter(
        (base) =>
          base.owner === factionId &&
          base.hp > 0 &&
          connected(base.cell.x, base.cell.y),
      )
      .map(({ id }) => id),
    connectedCrossingIds: crossings
      .filter((crossing) => {
        if (crossing.owner !== factionId) return false;
        const site = state.map.crossingSites?.find(
          ({ id }) => id === crossing.id,
        );
        return (
          site !== undefined &&
          [site.bankA, site.bankB, ...site.cells].some(({ x, y }) =>
            connected(x, y),
          )
        );
      })
      .map(({ id }) => id),
    disconnectedBaseReasons,
  };
  const byFaction = networkCache.get(state) ?? new Map();
  byFaction.set(factionId, network);
  networkCache.set(state, byFaction);
  return network;
}

export function isBaseConnected(
  network: SupplyNetwork,
  baseId: string,
): boolean {
  return network.connectedBaseIds.includes(baseId);
}
