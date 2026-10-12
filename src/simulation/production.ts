import { PRODUCTION_QUEUE_LIMIT, UNIT_LIMIT, UNIT_STATS } from './config';
import type {
  CommandResult,
  FactionId,
  MatchState,
  ProductionJob,
  UnitKind,
  UnitState,
} from './types';

function isUnitKind(value: string): value is UnitKind {
  return Object.prototype.hasOwnProperty.call(UNIT_STATS, value);
}

function numberedId(factionId: FactionId, serial: number): string {
  return `${factionId}-${String(serial).padStart(2, '0')}`;
}

function jobId(factionId: FactionId, serial: number): string {
  return `${factionId}-J${String(serial).padStart(2, '0')}`;
}

/** Reserves supply, queue space, and an irrevocable unit ID in one state change. */
export function enqueueProduction(
  state: MatchState,
  actor: FactionId,
  baseId: string,
  requestedKind: string,
): CommandResult {
  const base = state.bases.find(({ id }) => id === baseId);
  if (base === undefined) {
    return { ok: false, state, reason: 'BASE_NOT_FOUND' };
  }
  if (base.owner !== actor) {
    return { ok: false, state, reason: 'NOT_OWNER' };
  }
  if (base.kind !== 'hq' || base.hp <= 0) {
    return { ok: false, state, reason: 'HQ_UNAVAILABLE' };
  }
  if (!isUnitKind(requestedKind)) {
    return { ok: false, state, reason: 'INVALID_UNIT_KIND' };
  }
  const faction = state.factions.find(({ id }) => id === actor);
  if (faction === undefined) {
    return { ok: false, state, reason: 'INVALID_ACTOR' };
  }
  const liveCount = state.units.filter(
    (unit) => unit.factionId === actor && unit.hp > 0,
  ).length;
  if (liveCount + faction.productionJobs.length >= UNIT_LIMIT) {
    return { ok: false, state, reason: 'UNIT_LIMIT' };
  }
  if (faction.productionJobs.length >= PRODUCTION_QUEUE_LIMIT) {
    return { ok: false, state, reason: 'QUEUE_FULL' };
  }
  const stats = UNIT_STATS[requestedKind];
  if (faction.supplyCenti < stats.costCenti) {
    return { ok: false, state, reason: 'INSUFFICIENT_SUPPLY' };
  }
  const job: ProductionJob = {
    id: jobId(actor, faction.nextJobSerial),
    baseId,
    unitId: numberedId(actor, faction.nextUnitSerial),
    unitKind: requestedKind,
    costCenti: stats.costCenti,
    status: faction.productionJobs.length === 0 ? 'active' : 'queued',
    remainingTicks: stats.buildTicks,
  };
  return {
    ok: true,
    state: {
      ...state,
      factions: state.factions.map((entry) =>
        entry === faction
          ? {
              ...entry,
              supplyCenti: entry.supplyCenti - stats.costCenti,
              nextUnitSerial: entry.nextUnitSerial + 1,
              nextJobSerial: entry.nextJobSerial + 1,
              productionJobs: [...entry.productionJobs, job],
            }
          : entry,
      ),
    },
  };
}

/** Cancels one own active or queued job and returns its original paid amount. */
export function cancelProduction(
  state: MatchState,
  actor: FactionId,
  requestedJobId: string,
): CommandResult {
  const faction = state.factions.find(({ id }) => id === actor);
  const index = faction?.productionJobs.findIndex(
    ({ id }) => id === requestedJobId,
  );
  if (faction === undefined || index === undefined || index < 0) {
    return { ok: false, state, reason: 'JOB_NOT_FOUND' };
  }
  const job = faction.productionJobs[index];
  if (job === undefined) {
    return { ok: false, state, reason: 'JOB_NOT_FOUND' };
  }
  const jobs = faction.productionJobs.filter(({ id }) => id !== requestedJobId);
  const nextJobs = jobs.map((entry, jobIndex) =>
    jobIndex === 0 && entry.status === 'queued'
      ? { ...entry, status: 'active' as const }
      : entry,
  );
  return {
    ok: true,
    state: {
      ...state,
      factions: state.factions.map((entry) =>
        entry === faction
          ? {
              ...entry,
              supplyCenti: entry.supplyCenti + job.costCenti,
              productionJobs: nextJobs,
            }
          : entry,
      ),
    },
  };
}

/** Refunds every job of a destroyed HQ once. Safe to call again. */
export function cancelAllProductionForDestroyedHq(
  state: MatchState,
  factionId: FactionId,
): MatchState {
  const hq = state.bases.find(
    (base) => base.kind === 'hq' && base.homeFactionId === factionId,
  );
  if (hq === undefined || hq.hp > 0) return state;
  const faction = state.factions.find(({ id }) => id === factionId);
  if (faction === undefined || faction.productionJobs.length === 0) {
    return state;
  }
  const refund = faction.productionJobs.reduce(
    (sum, job) => sum + job.costCenti,
    0,
  );
  return {
    ...state,
    factions: state.factions.map((entry) =>
      entry === faction
        ? {
            ...entry,
            supplyCenti: entry.supplyCenti + refund,
            productionJobs: [],
          }
        : entry,
    ),
  };
}

/** Decrements only jobs active at this tick's start; spawns at their HQ on zero. */
export function advanceProduction(state: MatchState): MatchState {
  let next = state;
  for (const faction of state.factions) {
    next = cancelAllProductionForDestroyedHq(next, faction.id);
  }
  const spawned: UnitState[] = [];
  const factions = next.factions.map((faction) => {
    if (faction.eliminatedAtTick !== null) return faction;
    const [active, ...waiting] = faction.productionJobs;
    if (active === undefined) return faction;
    if (active.remainingTicks > 1) {
      return {
        ...faction,
        productionJobs: [
          { ...active, remainingTicks: active.remainingTicks - 1 },
          ...waiting,
        ],
      };
    }
    const base = next.bases.find(({ id }) => id === active.baseId);
    if (base === undefined || base.hp <= 0 || base.owner !== faction.id) {
      throw new Error('active production job has no working owned HQ');
    }
    spawned.push({
      id: active.unitId,
      factionId: faction.id,
      kind: active.unitKind,
      hp: UNIT_STATS[active.unitKind].maxHp,
      maxHp: UNIT_STATS[active.unitKind].maxHp,
      cell: { x: base.cell.x, y: base.cell.y },
      path: [],
      edgeProgress: 0,
      marchOrder: null,
    });
    return {
      ...faction,
      productionJobs: waiting.map((job, index) =>
        index === 0 ? { ...job, status: 'active' as const } : job,
      ),
    };
  });
  return {
    ...next,
    factions,
    units: spawned.length === 0 ? next.units : [...next.units, ...spawned],
  };
}
