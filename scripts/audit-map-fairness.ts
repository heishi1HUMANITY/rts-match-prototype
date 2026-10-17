import { createMatch } from '../src/simulation/match';
import { createMap100 } from '../src/simulation/map-100';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCommand } from '../src/simulation/commands';
import { advanceMatch } from '../src/runtime/advance';
import { getFactionView } from '../src/simulation/view';
import { selectNpcResearchRoute } from '../src/ai/strategy';
import { calculateIntervalTicketLossCenti } from '../src/simulation/tickets';
import { RULES_VERSION } from '../src/simulation/rules';
import type {
  FactionId,
  MatchState,
  StartPositionId,
} from '../src/simulation/types';

const sample = process.argv.includes('--final') ? 'final' : 'tuning';
const firstSeed = sample === 'final' ? 200 : 0;
const requestedSeeds = process.argv.find((argument) =>
  argument.startsWith('--seeds='),
);
const outputArgument = process.argv.find((argument) =>
  argument.startsWith('--output='),
);
const SEEDS = requestedSeeds
  ? requestedSeeds
      .slice('--seeds='.length)
      .split(',')
      .map(Number)
      .filter(Number.isInteger)
  : Array.from({ length: 18 }, (_, offset) => firstSeed + offset);
const TICK_LIMIT = 12_000;
const mapDefinitionVersion = createMap100(0).definitionVersion;
const checkpointPath = outputArgument
  ? outputArgument.slice('--output='.length)
  : join(
      tmpdir(),
      `cp12-map-fairness-${sample}-v${mapDefinitionVersion}${requestedSeeds ? '-selected' : ''}.jsonl`,
    );
const resume = process.argv.includes('--resume');
const jobsArgument = process.argv.find((argument) =>
  argument.startsWith('--jobs='),
);
const JOBS = jobsArgument ? Number(jobsArgument.slice('--jobs='.length)) : 1;
/** Fairness band per physical start, inclusive (Issue #84 / WORLD.md). */
const WIN_RATE_BAND = { min: 0.2, max: 0.5 } as const;
const TENDENCY = 'neutral';

interface MatchAudit {
  seed: number;
  mapDefinitionId: string | undefined;
  mapDefinitionVersion: number | undefined;
  masterVersion: string;
  seatByFaction: MatchState['map']['startAssignment'];
  tendencyByFaction: Partial<Record<FactionId, string>>;
  routeByFaction: Partial<Record<FactionId, 'crossing' | 'field'>>;
  ticks: number;
  phase: string;
  reason: string;
  winners: FactionId[];
  winnerSeats: StartPositionId[];
  tied: boolean;
  neutralCaptures: {
    tick: number;
    factionId: FactionId;
    baseId: string;
    kind: string;
    ticketWeight: number;
  }[];
  baseOwnershipChanges: {
    tick: number;
    baseId: string;
    kind: string;
    from: string | null;
    to: string | null;
  }[];
  baseDestructions: {
    tick: number;
    baseId: string;
    previousOwner: string;
    previousHp: number;
    hostileUnitsNear: {
      id: string;
      factionId: string;
      kind: string;
      cell: { x: number; y: number };
      distance: number;
      range: number;
      damageVsStructure: number;
      targetId: string | null;
      marchTarget: string | null;
      pathHead: { x: number; y: number } | null;
    }[];
    ownerUnitsNear: {
      id: string;
      kind: string;
      cell: { x: number; y: number };
      targetId: string | null;
      marchTarget: string | null;
      garrisonedAtBaseId: string | null;
    }[];
    visibleHostiles: string[];
  }[];
  researchCompletions: {
    tick: number;
    factionId: FactionId;
    researchId: string;
  }[];
  ticketLossByFaction: Partial<
    Record<
      FactionId,
      {
        combatCenti: number;
        territoryPenaltyCenti: number;
        timeDecayCenti: number;
        clampedIntervals: number;
      }
    >
  >;
  firstNeutralByFaction: Partial<
    Record<
      FactionId,
      { tick: number; baseId: string; kind: string; ticketWeight: number }
    >
  >;
  firstHqDamageByFaction: Partial<Record<FactionId, number>>;
  eliminationByFaction: Partial<Record<FactionId, string>>;
  eliminationDetails: {
    tick: number;
    factionId: FactionId;
    reason: string;
    ticketsCenti: number;
    ownedBases: string[];
    baseOwnership: {
      id: string;
      kind: string;
      owner: string | null;
      ticketWeight: number;
    }[];
    hqHpBeforeOutcome: number;
    ticketLossAtElimination: {
      penalty: number;
      decayCenti: number;
      totalLoss: number;
    };
    visibleHostiles: string[];
    nearbyDefenders: {
      id: string;
      kind: string;
      cell: { x: number; y: number };
      marchTarget: string | null;
      marchStatus: string | null;
      pathHead: { x: number; y: number } | null;
      garrisonedAtBaseId: string | null;
    }[];
  }[];
  firstHqDamageDetails: {
    tick: number;
    hqId: string;
    homeFactionId: FactionId;
    hpBefore: number;
    hpAfter: number;
    visibleHostiles: string[];
    nearbyHostiles: {
      id: string;
      factionId: FactionId;
      kind: string;
      cell: { x: number; y: number };
      distance: number;
      range: number;
      canDamageStructure: number;
      targetId: string | null;
      marchTarget: string | null;
      marchStatus: string | null;
      pathHead: { x: number; y: number } | null;
    }[];
    nearbyStrikes: {
      factionId: FactionId;
      cell: { x: number; y: number };
      impactTick: number;
    }[];
    attackers: {
      id: string;
      factionId: FactionId;
      kind: string;
      cell: { x: number; y: number };
      targetId: string | null;
      marchTarget: string | null;
      marchStatus: string | null;
      pathHead: { x: number; y: number } | null;
      garrisonedAtBaseId: string | null;
    }[];
    nearbyDefenders: {
      id: string;
      kind: string;
      cell: { x: number; y: number };
      targetId: string | null;
      marchTarget: string | null;
      marchStatus: string | null;
      pathHead: { x: number; y: number } | null;
      garrisonedAtBaseId: string | null;
    }[];
  }[];
  hqAtEnd: {
    id: string;
    homeFactionId: FactionId;
    hp: number;
    maxHp: number;
  }[];
  completedCrossings: { tick: number; factionId: FactionId; siteId: string }[];
  /** Unit deaths by likely source: an enemy start targeting it, else the nearest base within 8 cells. */
  unitLossesByFaction: Partial<Record<FactionId, Record<string, number>>>;
}

function run(seed: number): MatchAudit {
  let state = createMatch(seed, {
    mapId: 'ring-three-fronts-100',
    controllers: { A: 'bot', B: 'bot', C: 'bot' },
  });
  const seatByFaction = state.map.startAssignment;
  const routeByFaction: MatchAudit['routeByFaction'] = {};
  const neutralCaptures: MatchAudit['neutralCaptures'] = [];
  const baseOwnershipChanges: MatchAudit['baseOwnershipChanges'] = [];
  const baseDestructions: MatchAudit['baseDestructions'] = [];
  const researchCompletions: MatchAudit['researchCompletions'] = [];
  const ticketLossByFaction: MatchAudit['ticketLossByFaction'] = {
    A: {
      combatCenti: 0,
      territoryPenaltyCenti: 0,
      timeDecayCenti: 0,
      clampedIntervals: 0,
    },
    B: {
      combatCenti: 0,
      territoryPenaltyCenti: 0,
      timeDecayCenti: 0,
      clampedIntervals: 0,
    },
    C: {
      combatCenti: 0,
      territoryPenaltyCenti: 0,
      timeDecayCenti: 0,
      clampedIntervals: 0,
    },
  };
  const firstNeutralByFaction: MatchAudit['firstNeutralByFaction'] = {};
  const firstHqDamageByFaction: MatchAudit['firstHqDamageByFaction'] = {};
  const firstHqDamageDetails: MatchAudit['firstHqDamageDetails'] = [];
  const eliminationDetails: MatchAudit['eliminationDetails'] = [];
  const completedCrossings: MatchAudit['completedCrossings'] = [];
  const unitLossesByFaction: MatchAudit['unitLossesByFaction'] = {
    A: {},
    B: {},
    C: {},
  };
  const sourceLabel = (owner: string | null): string =>
    owner === null ? 'neutral' : (seatByFaction?.[owner as FactionId] ?? owner);
  for (const factionId of ['A', 'B', 'C'] as const)
    routeByFaction[factionId] = selectNpcResearchRoute(
      getFactionView(state, factionId),
    );
  state = applyCommand(state, 'A', { type: 'start' }).state;
  while (state.phase === 'running' && state.elapsedTicks < TICK_LIMIT) {
    const previous = state;
    state = advanceMatch(state);
    const interval = state.rules.tickets.updateIntervalTicks;
    const survivingUnitIds = new Set(state.units.map(({ id }) => id));
    for (const unit of previous.units) {
      if (survivingUnitIds.has(unit.id) || unit.factionId === 'local') continue;
      const owner = state.factions.find(({ id }) => id === unit.factionId);
      if (owner?.eliminatedAtTick === state.elapsedTicks) continue;
      const attacker = previous.units
        .filter(
          (other) =>
            other.factionId !== unit.factionId &&
            other.attack?.targetId === unit.id,
        )
        .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
      const nearestBase = previous.bases
        .map((base) => ({
          base,
          distance: Math.hypot(
            base.cell.x - unit.cell.x,
            base.cell.y - unit.cell.y,
          ),
        }))
        .filter(({ distance }) => distance <= 8)
        .sort((a, b) => a.distance - b.distance)[0]?.base;
      const source = attacker
        ? `unit:${sourceLabel(attacker.factionId)}`
        : nearestBase
          ? `base:${nearestBase.owner === unit.factionId ? 'own' : sourceLabel(nearestBase.owner)}`
          : 'other';
      const losses = unitLossesByFaction[unit.factionId as FactionId]!;
      losses[source] = (losses[source] ?? 0) + 1;
    }
    for (const factionId of ['A', 'B', 'C'] as const) {
      const before = previous.factions.find(({ id }) => id === factionId);
      const after = state.factions.find(({ id }) => id === factionId);
      const totals = ticketLossByFaction[factionId]!;
      if (!before || !after || before.eliminatedAtTick !== null) continue;
      const observedLoss = Math.max(
        0,
        before.ticketsCenti - after.ticketsCenti,
      );
      let formulaLoss = 0;
      if (state.elapsedTicks % interval === 0) {
        const estimate = calculateIntervalTicketLossCenti(
          { ...previous, elapsedTicks: state.elapsedTicks },
          factionId,
        );
        formulaLoss = estimate.totalLoss;
        const appliedFormulaLoss = Math.min(observedLoss, formulaLoss);
        const appliedPenalty =
          formulaLoss > 0
            ? Math.round((appliedFormulaLoss * estimate.penalty) / formulaLoss)
            : 0;
        totals.territoryPenaltyCenti += appliedPenalty;
        totals.timeDecayCenti += appliedFormulaLoss - appliedPenalty;
        if (observedLoss < formulaLoss) totals.clampedIntervals += 1;
        formulaLoss = appliedFormulaLoss;
      }
      const combatLoss = Math.max(0, observedLoss - formulaLoss);
      totals.combatCenti += combatLoss;
    }
    for (const base of state.bases) {
      const before = previous.bases.find(({ id }) => id === base.id);
      if (before && before.owner !== base.owner) {
        const ownerEliminated = state.factions.some(
          (faction) =>
            faction.id === before.owner &&
            faction.eliminatedAtTick === state.elapsedTicks,
        );
        if (!(ownerEliminated && base.owner === null))
          baseOwnershipChanges.push({
            tick: state.elapsedTicks,
            baseId: base.id,
            kind: base.kind,
            from: before.owner,
            to: base.owner,
          });
        if (
          before.owner !== null &&
          base.owner === null &&
          before.kind !== 'hq'
        ) {
          const homeFactionId = before.owner as FactionId;
          const distanceSquared = (cell: { x: number; y: number }) =>
            (cell.x - before.cell.x) ** 2 + (cell.y - before.cell.y) ** 2;
          const view = getFactionView(previous, homeFactionId);
          baseDestructions.push({
            tick: state.elapsedTicks,
            baseId: base.id,
            previousOwner: before.owner,
            previousHp: before.hp,
            hostileUnitsNear: previous.units
              .filter(
                (unit) =>
                  unit.factionId !== homeFactionId &&
                  distanceSquared(unit.cell) <= 20 ** 2,
              )
              .map((unit) => ({
                id: unit.id,
                factionId: unit.factionId,
                kind: unit.kind,
                cell: unit.cell,
                distance: Math.sqrt(distanceSquared(unit.cell)),
                range: previous.rules.units[unit.kind].range,
                damageVsStructure:
                  previous.rules.units[unit.kind].damageVsStructure,
                targetId: unit.attack?.targetId ?? null,
                marchTarget: unit.marchOrder
                  ? `${unit.marchOrder.target.kind}:${unit.marchOrder.target.id}`
                  : null,
                pathHead: unit.path[0] ?? null,
              }))
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 8),
            ownerUnitsNear: previous.units
              .filter(
                (unit) =>
                  unit.factionId === homeFactionId &&
                  distanceSquared(unit.cell) <= 20 ** 2,
              )
              .map((unit) => ({
                id: unit.id,
                kind: unit.kind,
                cell: unit.cell,
                targetId: unit.attack?.targetId ?? null,
                marchTarget: unit.marchOrder
                  ? `${unit.marchOrder.target.kind}:${unit.marchOrder.target.id}`
                  : null,
                garrisonedAtBaseId: unit.garrisonedAtBaseId ?? null,
              })),
            visibleHostiles: view.visibleEnemies.map(({ id }) => id),
          });
        }
      }
      if (before?.owner !== null || base.owner === null) continue;
      const factionId = base.owner as FactionId;
      const capture = {
        tick: state.elapsedTicks,
        factionId,
        baseId: base.id,
        kind: base.kind,
        ticketWeight: state.rules.bases[base.kind].ticketWeight,
      };
      neutralCaptures.push(capture);
      firstNeutralByFaction[factionId] ??= {
        tick: capture.tick,
        baseId: capture.baseId,
        kind: capture.kind,
        ticketWeight: capture.ticketWeight,
      };
    }
    for (const base of state.bases) {
      if (base.kind !== 'hq' || firstHqDamageByFaction[base.homeFactionId!])
        continue;
      const before = previous.bases.find(({ id }) => id === base.id);
      const outcome = state.factions.find(
        ({ id }) => id === base.homeFactionId,
      );
      if (
        before &&
        base.hp < before.hp &&
        outcome?.eliminationReason !== 'tickets'
      ) {
        firstHqDamageByFaction[base.homeFactionId!] = state.elapsedTicks;
        const homeFactionId = base.homeFactionId!;
        const position = (unit: MatchState['units'][number]) => unit.cell;
        const brief = (unit: MatchState['units'][number]) => ({
          id: unit.id,
          factionId: unit.factionId,
          kind: unit.kind,
          cell: position(unit),
          targetId: unit.attack?.targetId ?? null,
          marchTarget: unit.marchOrder
            ? `${unit.marchOrder.target.kind}:${unit.marchOrder.target.id}`
            : null,
          marchStatus: unit.marchOrder?.status ?? null,
          pathHead: unit.path[0] ?? null,
          garrisonedAtBaseId: unit.garrisonedAtBaseId ?? null,
        });
        const distanceSquared = (cell: { x: number; y: number }) =>
          (cell.x - base.cell.x) ** 2 + (cell.y - base.cell.y) ** 2;
        const homeView = getFactionView(previous, homeFactionId);
        const visibleHostiles = homeView.visibleEnemies.map(({ id }) => id);
        const nearbyHostiles = previous.units
          .filter(
            (unit) =>
              unit.factionId !== homeFactionId &&
              distanceSquared(unit.cell) <= 50 ** 2,
          )
          .map((unit) => ({
            id: unit.id,
            factionId: unit.factionId as FactionId,
            kind: unit.kind,
            cell: position(unit),
            distance: Math.sqrt(distanceSquared(unit.cell)),
            range: previous.rules.units[unit.kind].range,
            canDamageStructure:
              previous.rules.units[unit.kind].damageVsStructure,
            targetId: unit.attack?.targetId ?? null,
            marchTarget: unit.marchOrder
              ? `${unit.marchOrder.target.kind}:${unit.marchOrder.target.id}`
              : null,
            marchStatus: unit.marchOrder?.status ?? null,
            pathHead: unit.path[0] ?? null,
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 12);
        const nearbyStrikes = previous.scheduledStrikes
          .filter(
            (strike) =>
              distanceSquared(strike.cell) <= 50 ** 2 &&
              strike.impactTick <= state.elapsedTicks,
          )
          .map(({ factionId, cell, impactTick }) => ({
            factionId: factionId as FactionId,
            cell,
            impactTick,
          }));
        const attackers = previous.units
          .filter(
            (unit) =>
              unit.factionId !== homeFactionId &&
              (unit.attack?.targetId === base.id ||
                (unit.marchOrder?.target.kind === 'base' &&
                  unit.marchOrder.target.id === base.id)),
          )
          .map(brief);
        const nearbyDefenders = previous.units
          .filter(
            (unit) =>
              unit.factionId === homeFactionId &&
              distanceSquared(unit.cell) <= 30 ** 2,
          )
          .map(brief);
        firstHqDamageDetails.push({
          tick: state.elapsedTicks,
          hqId: base.id,
          homeFactionId,
          hpBefore: before.hp,
          hpAfter: base.hp,
          visibleHostiles,
          nearbyHostiles,
          nearbyStrikes,
          attackers,
          nearbyDefenders,
        });
      }
    }
    for (const faction of state.factions) {
      const priorFaction = previous.factions.find(
        ({ id }) => id === faction.id,
      );
      for (const researchId of faction.completedResearchIds) {
        if (!priorFaction?.completedResearchIds.includes(researchId))
          researchCompletions.push({
            tick: state.elapsedTicks,
            factionId: faction.id,
            researchId,
          });
      }
      if (faction.eliminatedAtTick !== state.elapsedTicks) continue;
      const previousFaction = previous.factions.find(
        ({ id }) => id === faction.id,
      );
      if (!previousFaction) continue;
      const hq = previous.bases.find(
        (base) => base.kind === 'hq' && base.homeFactionId === faction.id,
      );
      const view = getFactionView(previous, faction.id);
      eliminationDetails.push({
        tick: state.elapsedTicks,
        factionId: faction.id,
        reason: faction.eliminationReason ?? 'unknown',
        ticketsCenti: previousFaction.ticketsCenti,
        ownedBases: previous.bases
          .filter((base) => base.owner === faction.id)
          .map(({ id }) => id),
        baseOwnership: previous.bases.map((base) => ({
          id: base.id,
          kind: base.kind,
          owner: base.owner,
          ticketWeight: state.rules.bases[base.kind].ticketWeight,
        })),
        hqHpBeforeOutcome: hq?.hp ?? 0,
        ticketLossAtElimination: calculateIntervalTicketLossCenti(
          previous,
          faction.id,
        ),
        visibleHostiles: view.visibleEnemies.map(({ id }) => id),
        nearbyDefenders: previous.units
          .filter(
            (unit) =>
              unit.factionId === faction.id &&
              hq !== undefined &&
              (unit.cell.x - hq.cell.x) ** 2 + (unit.cell.y - hq.cell.y) ** 2 <=
                30 ** 2,
          )
          .map((unit) => ({
            id: unit.id,
            kind: unit.kind,
            cell: unit.cell,
            marchTarget: unit.marchOrder
              ? `${unit.marchOrder.target.kind}:${unit.marchOrder.target.id}`
              : null,
            marchStatus: unit.marchOrder?.status ?? null,
            pathHead: unit.path[0] ?? null,
            garrisonedAtBaseId: unit.garrisonedAtBaseId ?? null,
          })),
      });
    }
    for (const crossing of state.crossings) {
      const before = previous.crossings.find(
        ({ siteId }) => siteId === crossing.siteId,
      );
      if (before?.owner === null && crossing.owner !== null)
        completedCrossings.push({
          tick: state.elapsedTicks,
          factionId: crossing.owner,
          siteId: crossing.siteId,
        });
    }
  }

  const winners = (state.result?.standings ?? [])
    .filter(({ rank }) => rank === 1)
    .map(({ factionId }) => factionId);
  const winnerSeats = winners
    .map((factionId) => seatByFaction?.[factionId])
    .filter((seat): seat is StartPositionId => seat !== undefined);
  return {
    seed,
    mapDefinitionId: state.map.definitionId,
    mapDefinitionVersion: state.map.definitionVersion,
    masterVersion: `${RULES_VERSION}#${createHash('sha256').update(JSON.stringify(state.rules)).digest('hex').slice(0, 12)}`,
    seatByFaction,
    tendencyByFaction: { A: TENDENCY, B: TENDENCY, C: TENDENCY },
    routeByFaction,
    ticks: state.elapsedTicks,
    phase: state.phase,
    reason: state.result?.reason ?? 'unresolved-at-tick-limit',
    winners,
    winnerSeats,
    tied: winners.length > 1,
    neutralCaptures,
    baseOwnershipChanges,
    baseDestructions,
    researchCompletions,
    ticketLossByFaction,
    firstNeutralByFaction,
    firstHqDamageByFaction,
    firstHqDamageDetails,
    eliminationByFaction: Object.fromEntries(
      state.factions
        .filter(({ eliminationReason }) => eliminationReason !== null)
        .map(({ id, eliminationReason }) => [id, eliminationReason!]),
    ),
    eliminationDetails,
    hqAtEnd: state.bases
      .filter((base) => base.kind === 'hq')
      .map((base) => ({
        id: base.id,
        homeFactionId: base.homeFactionId!,
        hp: base.hp,
        maxHp: base.maxHp,
      })),
    completedCrossings,
    unitLossesByFaction,
  };
}

const saved = new Map<number, MatchAudit>();
if (resume && existsSync(checkpointPath))
  for (const line of readFileSync(checkpointPath, 'utf8').split(/\r?\n/)) {
    if (!line) continue;
    const match = JSON.parse(line) as MatchAudit;
    saved.set(match.seed, match);
  }
if (!resume) writeFileSync(checkpointPath, '', 'utf8');
if (JOBS > 1) {
  // Each worker runs the same source on one seed; results merge into the checkpoint by seed.
  const pending = SEEDS.filter((seed) => !saved.has(seed));
  const script = fileURLToPath(import.meta.url);
  const runSeed = (seed: number) =>
    new Promise<void>((resolve, reject) => {
      const part = `${checkpointPath}.seed-${seed}`;
      const child = spawn(
        process.execPath,
        [
          ...process.execArgv,
          script,
          `--seeds=${seed}`,
          `--output=${part}`,
          ...(sample === 'final' ? ['--final'] : []),
        ],
        { stdio: ['ignore', 'ignore', 'inherit'] },
      );
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code !== 0) return reject(new Error(`seed ${seed} exited ${code}`));
        const match = JSON.parse(readFileSync(part, 'utf8')) as MatchAudit;
        unlinkSync(part);
        saved.set(seed, match);
        appendFileSync(checkpointPath, `${JSON.stringify(match)}\n`, 'utf8');
        resolve();
      });
    });
  const queue = [...pending];
  await Promise.all(
    Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
      for (let seed = queue.shift(); seed !== undefined; seed = queue.shift())
        await runSeed(seed);
    }),
  );
}
for (const [index, seed] of SEEDS.entries()) {
  if (saved.has(seed)) continue;
  const match = run(seed);
  saved.set(seed, match);
  appendFileSync(checkpointPath, `${JSON.stringify(match)}\n`, 'utf8');
  console.error(
    `Completed ${sample} seed ${seed} (${index + 1}/${SEEDS.length}): ${match.reason} at ${match.ticks} ticks`,
  );
}
const matches = SEEDS.map((seed) => saved.get(seed)!);
const STARTS: readonly StartPositionId[] = [
  'north',
  'south-east',
  'south-west',
];
const perStart = <T>(make: () => T): Record<StartPositionId, T> => ({
  north: make(),
  'south-east': make(),
  'south-west': make(),
});
const counts = perStart(() => ({ wins: 0, games: 0 }));
const winsByFactionId: Record<FactionId, number> = { A: 0, B: 0, C: 0 };
const routesByStart = perStart(() => ({ crossing: 0, field: 0 }));
const factionASeatCounts = perStart(() => 0);
const eliminationsByStart = perStart<Record<string, number>>(() => ({}));
const ticketLossByStart = perStart(() => ({
  combatCenti: 0,
  territoryPenaltyCenti: 0,
  timeDecayCenti: 0,
  clampedIntervals: 0,
}));
/** Games in which a start completed each crossing or captured each non-home base. */
const crossingsByStart = perStart<Record<string, number>>(() => ({}));
const capturesByStart = perStart<Record<string, number>>(() => ({}));
const unitLossesByStart = perStart<Record<string, number>>(() => ({}));
const bump = (record: Record<string, number>, key: string, amount = 1) => {
  record[key] = (record[key] ?? 0) + amount;
};
for (const match of matches) {
  const startOf = (factionId: string) =>
    match.seatByFaction?.[factionId as FactionId];
  if (match.seatByFaction?.A) factionASeatCounts[match.seatByFaction.A] += 1;
  for (const [factionId, route] of Object.entries(match.routeByFaction)) {
    const start = startOf(factionId);
    if (start && route) routesByStart[start][route] += 1;
  }
  for (const seat of Object.values(match.seatByFaction ?? {}))
    counts[seat].games += 1;
  for (const [factionId, reason] of Object.entries(
    match.eliminationByFaction ?? {},
  )) {
    const start = startOf(factionId);
    if (start) bump(eliminationsByStart[start], reason);
  }
  for (const [factionId, loss] of Object.entries(
    match.ticketLossByFaction ?? {},
  )) {
    const start = startOf(factionId);
    if (!start || !loss) continue;
    ticketLossByStart[start].combatCenti += loss.combatCenti;
    ticketLossByStart[start].territoryPenaltyCenti +=
      loss.territoryPenaltyCenti;
    ticketLossByStart[start].timeDecayCenti += loss.timeDecayCenti;
    ticketLossByStart[start].clampedIntervals += loss.clampedIntervals;
  }
  for (const [factionId, losses] of Object.entries(
    match.unitLossesByFaction ?? {},
  )) {
    const start = startOf(factionId);
    if (start && losses)
      for (const [source, count] of Object.entries(losses))
        bump(unitLossesByStart[start], source, count);
  }
  const seenCrossings = new Set<string>();
  for (const { factionId, siteId } of match.completedCrossings) {
    const start = startOf(factionId);
    if (!start || seenCrossings.has(`${start}:${siteId}`)) continue;
    seenCrossings.add(`${start}:${siteId}`);
    bump(crossingsByStart[start], siteId);
  }
  const seenCaptures = new Set<string>();
  for (const { baseId, to } of match.baseOwnershipChanges) {
    const start = to === null ? undefined : startOf(to);
    if (!start || seenCaptures.has(`${start}:${baseId}`)) continue;
    seenCaptures.add(`${start}:${baseId}`);
    bump(capturesByStart[start], baseId);
  }
  if (match.winners.length === 1) {
    winsByFactionId[match.winners[0]!] += 1;
    const seat = match.winnerSeats[0];
    if (seat) counts[seat].wins += 1;
  }
}

const outcomes = Object.fromEntries(
  STARTS.map((seat) => {
    const { wins, games } = counts[seat];
    const winRate = games > 0 ? wins / games : 0;
    return [
      seat,
      {
        wins,
        games,
        winRate,
        withinBand:
          winRate >= WIN_RATE_BAND.min && winRate <= WIN_RATE_BAND.max,
      },
    ];
  }),
);
const failures = [
  ...STARTS.filter((seat) => !outcomes[seat]!.withinBand).map(
    (seat) =>
      `${seat} win rate ${counts[seat].wins}/${counts[seat].games} is outside ${WIN_RATE_BAND.min * 100}-${WIN_RATE_BAND.max * 100}%`,
  ),
  ...(new Set(matches.map((match) => match.mapDefinitionVersion)).size > 1
    ? ['mixed map definition versions in the checkpoint']
    : []),
  ...(new Set(matches.map((match) => match.masterVersion)).size > 1
    ? ['mixed master versions in the checkpoint']
    : []),
  ...STARTS.filter((seat) => counts[seat].games !== matches.length).map(
    (seat) => `${seat} did not take part in every game`,
  ),
];

console.log(
  JSON.stringify(
    {
      sample,
      verdict: requestedSeeds
        ? 'diagnostic-only'
        : failures.length === 0
          ? 'pass'
          : 'fail',
      failures,
      mapDefinitionVersion,
      masterVersions: [...new Set(matches.map((match) => match.masterVersion))],
      tendency: TENDENCY,
      checkpointPath,
      seedPolicy: requestedSeeds
        ? `selected diagnostic seeds ${SEEDS.join(',')}`
        : `fixed preregistered ${sample} seeds ${firstSeed}..${firstSeed + SEEDS.length - 1}; six A-seat assignments per physical start`,
      denominatorPolicy: `${matches.length} complete 3-start games; each physical start is a participant in all ${matches.length}. A-seat balance is reported separately. Tied rank-1, mutual-elimination, and unresolved-at-12000 games are non-wins in the primary win rate and reported separately.`,
      winRateBand: WIN_RATE_BAND,
      tickLimit: TICK_LIMIT,
      outcomes,
      winsByFactionId,
      factionASeatCounts,
      routesByStart,
      crossingsByStart,
      capturesByStart,
      eliminationsByStart,
      ticketLossByStart,
      unitLossesByStart,
      unresolved: matches.filter((match) => match.phase === 'running').length,
      tied: matches.filter((match) => match.tied).length,
      games: matches.map((match) => ({
        seed: match.seed,
        seatByFaction: match.seatByFaction,
        routeByFaction: match.routeByFaction,
        reason: match.reason,
        ticks: match.ticks,
        winnerSeats: match.winnerSeats,
        eliminationByFaction: match.eliminationByFaction,
      })),
    },
    null,
    2,
  ),
);
