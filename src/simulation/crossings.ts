import type { RulesMaster } from './rules';
import type {
  ActiveCrossing,
  CombatantId,
  Cell,
  CrossingSite,
  CrossingState,
  FactionId,
  MatchState,
  UnitKind,
  UnitState,
} from './types';
import type { FactionState } from './types';
import { supplyNetwork } from './supply';

export const CROSSING_ALLOWED_UNIT_KINDS: Readonly<
  Record<CrossingSite['tier'], readonly UnitKind[]>
> = {
  'bridge-1': ['assault', 'scout', 'artillery', 'antiAir'],
  'bridge-2': ['assault', 'scout', 'artillery', 'antiAir'],
  'bridge-3': ['assault', 'scout', 'artillery', 'antiAir'],
  'ropeway-1': ['scout'],
  'ropeway-2': ['scout'],
};

export function crossingResearchComplete(
  faction: Pick<FactionState, 'completedResearchIds'>,
  rules: RulesMaster,
  tier: CrossingSite['tier'],
): boolean {
  if (tier === 'bridge-1') return true;
  return faction.completedResearchIds.some((id) =>
    rules.research.definitions[id]?.effects.some(
      (effect) =>
        effect.id === 'crossing-unlock' && effect.crossingTier === tier,
    ),
  );
}

export function activeCrossings(state: MatchState): readonly ActiveCrossing[] {
  return state.crossings.flatMap((crossing) => {
    if (
      crossing.owner === null ||
      crossing.hp <= 0 ||
      crossing.job?.kind === 'build'
    )
      return [];
    const site = state.map.crossingSites?.find(
      ({ id }) => id === crossing.siteId,
    );
    if (!site) return [];
    return [
      {
        ...site,
        owner: crossing.owner,
        allowedUnitKinds: CROSSING_ALLOWED_UNIT_KINDS[site.tier],
      },
    ];
  });
}

/** Routes only through crossings the faction owns or has observed. */
export function knownActiveCrossings(
  state: MatchState,
  factionId: CombatantId,
): readonly ActiveCrossing[] {
  // Local forces are not bridge owners, but may use any completed route.
  if (factionId === 'local') return activeCrossings(state);
  const knowledge = state.knowledge.find(
    (entry) => entry.factionId === factionId,
  );
  return (knowledge?.crossingMemory ?? []).flatMap((memory) => {
    if (memory.owner === null || memory.hp <= 0 || memory.job?.kind === 'build')
      return [];
    const site = state.map.crossingSites?.find(
      ({ id }) => id === memory.siteId,
    );
    if (!site) return [];
    return [
      {
        ...site,
        owner: memory.owner,
        allowedUnitKinds: CROSSING_ALLOWED_UNIT_KINDS[site.tier],
      },
    ];
  });
}

function nearBank(unit: UnitState, site: CrossingSite): boolean {
  return [site.bankA, site.bankB].some(
    (bank) =>
      Math.abs(unit.cell.x - bank.x) + Math.abs(unit.cell.y - bank.y) <= 1,
  );
}

export function adjacentBuilder(
  state: MatchState,
  site: CrossingSite,
  factionId: FactionId,
): UnitState | undefined {
  return state.units.find(
    (unit) =>
      unit.factionId === factionId &&
      unit.kind === 'assault' &&
      unit.hp > 0 &&
      nearBank(unit, site),
  );
}

export function isAdjacentToSite(unit: UnitState, site: CrossingSite): boolean {
  return nearBank(unit, site);
}

function initialJob(
  kind: 'build' | 'dismantle',
  factionId: FactionId,
  requiredTicks: number,
  paidCostCenti: number,
) {
  return {
    kind,
    factionId,
    progressTicks: 0,
    requiredTicks,
    paidCostCenti,
  } as const;
}

export function beginCrossingBuild(
  state: MatchState,
  actor: FactionId,
  siteId: string,
  unitId: string,
):
  | { readonly ok: true; readonly state: MatchState }
  | {
      readonly ok: false;
      readonly state: MatchState;
      readonly reason: string;
    } {
  const site = state.map.crossingSites?.find(({ id }) => id === siteId);
  const crossing = state.crossings.find(({ siteId: id }) => id === siteId);
  const unit = state.units.find(({ id }) => id === unitId);
  if (!site || !crossing)
    return { ok: false, state, reason: 'CROSSING_NOT_FOUND' };
  if (!unit || unit.factionId !== actor || unit.hp <= 0)
    return { ok: false, state, reason: 'UNIT_NOT_FOUND' };
  if (unit.kind !== 'assault')
    return { ok: false, state, reason: 'CROSSING_UNIT_RESTRICTED' };
  if (!nearBank(unit, site))
    return { ok: false, state, reason: 'CROSSING_NOT_ADJACENT' };
  if (crossing.owner !== null)
    return { ok: false, state, reason: 'CROSSING_TAKEN' };
  if (crossing.job) {
    if (crossing.job.kind === 'build' && crossing.job.factionId === actor)
      return { ok: true, state };
    return { ok: false, state, reason: 'CROSSING_BUSY' };
  }
  if (
    !crossingResearchComplete(
      state.factions.find(({ id }) => id === actor)!,
      state.rules,
      site.tier,
    )
  )
    return { ok: false, state, reason: 'CROSSING_RESEARCH_REQUIRED' };
  const cost = state.rules.crossings[site.tier].costCenti;
  const faction = state.factions.find(({ id }) => id === actor)!;
  if (faction.supplyCenti < cost)
    return { ok: false, state, reason: 'INSUFFICIENT_SUPPLY' };
  return {
    ok: true,
    state: {
      ...state,
      factions: state.factions.map((entry) =>
        entry === faction
          ? { ...entry, supplyCenti: entry.supplyCenti - cost }
          : entry,
      ),
      crossings: state.crossings.map((entry) =>
        entry === crossing
          ? {
              ...entry,
              job: initialJob(
                'build',
                actor,
                state.rules.crossings[site.tier].buildTicks,
                cost,
              ),
            }
          : entry,
      ),
    },
  };
}

export function beginCrossingDismantle(
  state: MatchState,
  actor: FactionId,
  siteId: string,
  unitId: string,
) {
  const site = state.map.crossingSites?.find(({ id }) => id === siteId);
  const crossing = state.crossings.find(({ siteId: id }) => id === siteId);
  const unit = state.units.find(({ id }) => id === unitId);
  if (!site || !crossing)
    return { ok: false as const, state, reason: 'CROSSING_NOT_FOUND' };
  if (!unit || unit.factionId !== actor || unit.hp <= 0)
    return { ok: false as const, state, reason: 'UNIT_NOT_FOUND' };
  if (crossing.owner !== actor)
    return { ok: false as const, state, reason: 'CROSSING_NOT_OWNED' };
  if (!nearBank(unit, site))
    return { ok: false as const, state, reason: 'CROSSING_NOT_ADJACENT' };
  if (crossing.job)
    return { ok: false as const, state, reason: 'CROSSING_BUSY' };
  return {
    ok: true as const,
    state: {
      ...state,
      crossings: state.crossings.map((entry) =>
        entry === crossing
          ? {
              ...entry,
              job: initialJob(
                'dismantle',
                actor,
                state.rules.crossings[site.tier].dismantleTicks,
                0,
              ),
            }
          : entry,
      ),
    },
  };
}

function isAdjacent(
  state: MatchState,
  crossing: CrossingState,
  faction: FactionId,
): boolean {
  const site = state.map.crossingSites?.find(
    ({ id }) => id === crossing.siteId,
  );
  if (!site) return false;
  if (crossing.job?.kind === 'build')
    return Boolean(adjacentBuilder(state, site, faction));
  return state.units.some(
    (unit) => unit.factionId === faction && unit.hp > 0 && nearBank(unit, site),
  );
}

export function advanceCrossings(state: MatchState): MatchState {
  let changed = false;
  const supplyByFaction = new Map(
    state.factions.map((faction) => [
      faction.id,
      supplyNetwork(state, faction.id),
    ]),
  );
  const crossings = state.crossings.map((crossing) => {
    const site = state.map.crossingSites?.find(
      ({ id }) => id === crossing.siteId,
    );
    if (!site) return crossing;
    const stats = state.rules.crossings[site.tier];
    const job = crossing.job;
    if (job && isAdjacent(state, crossing, job.factionId)) {
      const progressTicks = job.progressTicks + 1;
      changed = true;
      if (progressTicks >= job.requiredTicks) {
        if (job.kind === 'build')
          return {
            ...crossing,
            owner: job.factionId,
            hp: stats.maxHp,
            maxHp: stats.maxHp,
            job: null,
          };
        return { ...crossing, owner: null, hp: 0, maxHp: 0, job: null };
      }
      return { ...crossing, job: { ...job, progressTicks } };
    }
    if (
      crossing.owner !== null &&
      state.elapsedTicks - crossing.lastDamagedTick >= 10 &&
      crossing.hp < crossing.maxHp
    ) {
      const connected = supplyByFaction
        .get(crossing.owner)
        ?.connectedCrossingIds.includes(crossing.siteId);
      const recoveryPercent = connected
        ? 100
        : state.rules.supplyLines.disconnectedCrossingRecoveryPercent;
      const recovery = Math.floor(
        (stats.regenerationPerTick * recoveryPercent) / 100,
      );
      if (recovery <= 0) return crossing;
      changed = true;
      return {
        ...crossing,
        hp: Math.min(crossing.maxHp, crossing.hp + recovery),
      };
    }
    return crossing;
  });
  return changed ? { ...state, crossings } : state;
}

export function activeCrossingAt(
  state: MatchState,
  cell: Cell,
  factionId: FactionId,
  unitKind: UnitKind,
) {
  return activeCrossings(state).find(
    (crossing) =>
      crossing.owner === factionId &&
      crossing.allowedUnitKinds.includes(unitKind) &&
      crossing.cells.some((entry) => entry.x === cell.x && entry.y === cell.y),
  );
}

export function crossingStats(rules: RulesMaster, tier: CrossingSite['tier']) {
  return rules.crossings[tier];
}
