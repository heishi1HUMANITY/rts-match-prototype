import { createMatch } from '../src/simulation/match';
import { createMap100 } from '../src/simulation/map-100';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyCommand } from '../src/simulation/commands';
import { advanceMatch } from '../src/runtime/advance';
import { getFactionView } from '../src/simulation/view';
import { selectNpcResearchRoute } from '../src/ai/strategy';
import { calculateIntervalTicketLossCenti } from '../src/simulation/tickets';
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
const northFieldPlan = process.argv.includes('--north-field-plan');
const checkpointPath = outputArgument
  ? outputArgument.slice('--output='.length)
  : join(
      tmpdir(),
      `cp12-map-fairness-${sample}-v${mapDefinitionVersion}${requestedSeeds ? '-selected' : '-audit3'}${northFieldPlan ? '-north-field-plan' : ''}.jsonl`,
    );
const resume = process.argv.includes('--resume');
const diagnoseNorth = process.argv.includes('--diagnose-north');

interface MatchAudit {
  seed: number;
  mapDefinitionId: string | undefined;
  mapDefinitionVersion: number | undefined;
  masterVersion: string;
  seatByFaction: MatchState['map']['startAssignment'];
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
  northDiagnostic?: {
    combatEvents: {
      tick: number;
      lossCenti: number;
      lostUnits: {
        id: string;
        kind: string;
        cell: { x: number; y: number };
        marchTarget: string | null;
        targetId: string | null;
      }[];
      visibleEnemies: {
        id: string;
        factionId: FactionId;
        kind: string;
        cell: { x: number; y: number };
      }[];
      out02OwnerBefore: string | null;
      out02OwnerAfter: string | null;
    }[];
    out02Transitions: {
      tick: number;
      from: string | null;
      to: string | null;
      nearbyNorthUnits: {
        id: string;
        kind: string;
        cell: { x: number; y: number };
        marchTarget: string | null;
        targetId: string | null;
      }[];
      visibleEnemies: {
        id: string;
        factionId: FactionId;
        kind: string;
        cell: { x: number; y: number };
      }[];
    }[];
  };
}

function run(seed: number): MatchAudit {
  let state = createMatch(seed, {
    mapId: 'ring-three-fronts-100',
    controllers: { A: 'bot', B: 'bot', C: 'bot' },
  });
  if (northFieldPlan) {
    state = {
      ...state,
      rules: {
        ...state.rules,
        npc: {
          ...state.rules.npc,
          researchRoutes: {
            ...state.rules.npc.researchRoutes,
            north: {
              ...state.rules.npc.researchRoutes.north,
              crossing: state.rules.npc.researchRoutes.north.field,
            },
          },
        },
      },
    };
  }
  const seatByFaction = state.map.startAssignment;
  const northFaction = (Object.entries(seatByFaction ?? {}).find(
    ([, seat]) => seat === 'north',
  )?.[0] ?? undefined) as FactionId | undefined;
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
  const northDiagnostic: NonNullable<MatchAudit['northDiagnostic']> = {
    combatEvents: [],
    out02Transitions: [],
  };
  for (const factionId of ['A', 'B', 'C'] as const)
    routeByFaction[factionId] = selectNpcResearchRoute(
      getFactionView(state, factionId),
    );
  state = applyCommand(state, 'A', { type: 'start' }).state;
  while (state.phase === 'running' && state.elapsedTicks < TICK_LIMIT) {
    const previous = state;
    state = advanceMatch(state);
    const interval = state.rules.tickets.updateIntervalTicks;
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
      if (diagnoseNorth && factionId === northFaction && combatLoss > 0) {
        const view = getFactionView(previous, factionId);
        const previousIds = new Set(state.units.map(({ id }) => id));
        const lostUnits = previous.units
          .filter(
            (unit) => unit.factionId === factionId && !previousIds.has(unit.id),
          )
          .map((unit) => ({
            id: unit.id,
            kind: unit.kind,
            cell: unit.cell,
            marchTarget: unit.marchOrder
              ? `${unit.marchOrder.target.kind}:${unit.marchOrder.target.id}`
              : null,
            targetId: unit.attack?.targetId ?? null,
          }));
        const nearbyCells = lostUnits.map(({ cell }) => cell);
        const visibleEnemies = view.visibleEnemies
          .filter((enemy) =>
            nearbyCells.some(
              (cell) =>
                Math.hypot(
                  Math.floor(enemy.positionX1024 / 1024) - cell.x,
                  Math.floor(enemy.positionY1024 / 1024) - cell.y,
                ) <= 12,
            ),
          )
          .map((enemy) => ({
            id: enemy.id,
            factionId: enemy.factionId as FactionId,
            kind: enemy.kind,
            cell: {
              x: Math.floor(enemy.positionX1024 / 1024),
              y: Math.floor(enemy.positionY1024 / 1024),
            },
          }));
        const out02Before = previous.bases.find(({ id }) => id === 'OUT-02');
        const out02After = state.bases.find(({ id }) => id === 'OUT-02');
        northDiagnostic.combatEvents.push({
          tick: state.elapsedTicks,
          lossCenti: combatLoss,
          lostUnits,
          visibleEnemies,
          out02OwnerBefore: out02Before?.owner ?? null,
          out02OwnerAfter: out02After?.owner ?? null,
        });
      }
    }
    for (const base of state.bases) {
      const before = previous.bases.find(({ id }) => id === base.id);
      if (before && before.owner !== base.owner) {
        if (diagnoseNorth && base.id === 'OUT-02' && northFaction) {
          const out02Cell = before.cell;
          const view = getFactionView(previous, northFaction);
          northDiagnostic.out02Transitions.push({
            tick: state.elapsedTicks,
            from: before.owner,
            to: base.owner,
            nearbyNorthUnits: previous.units
              .filter(
                (unit) =>
                  unit.factionId === northFaction &&
                  Math.hypot(
                    unit.cell.x - out02Cell.x,
                    unit.cell.y - out02Cell.y,
                  ) <= 12,
              )
              .map((unit) => ({
                id: unit.id,
                kind: unit.kind,
                cell: unit.cell,
                marchTarget: unit.marchOrder
                  ? `${unit.marchOrder.target.kind}:${unit.marchOrder.target.id}`
                  : null,
                targetId: unit.attack?.targetId ?? null,
              })),
            visibleEnemies: view.visibleEnemies
              .filter(
                (enemy) =>
                  Math.hypot(
                    Math.floor(enemy.positionX1024 / 1024) - out02Cell.x,
                    Math.floor(enemy.positionY1024 / 1024) - out02Cell.y,
                  ) <= 12,
              )
              .map((enemy) => ({
                id: enemy.id,
                factionId: enemy.factionId as FactionId,
                kind: enemy.kind,
                cell: {
                  x: Math.floor(enemy.positionX1024 / 1024),
                  y: Math.floor(enemy.positionY1024 / 1024),
                },
              })),
          });
        }
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
    masterVersion: state.rules.version,
    seatByFaction,
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
    ...(diagnoseNorth ? { northDiagnostic } : {}),
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
for (const [index, seed] of SEEDS.entries()) {
  if (saved.has(seed)) continue;
  const match = run(seed);
  saved.set(seed, match);
  appendFileSync(checkpointPath, `${JSON.stringify(match)}\n`, 'utf8');
  console.log(
    `Completed ${sample} seed ${seed} (${index + 1}/${SEEDS.length}): ${match.reason} at ${match.ticks} ticks`,
  );
}
const matches = SEEDS.map((seed) => saved.get(seed)!);
const counts = new Map<StartPositionId, { wins: number; games: number }>([
  ['north', { wins: 0, games: 0 }],
  ['south-east', { wins: 0, games: 0 }],
  ['south-west', { wins: 0, games: 0 }],
]);
const routesByStart: Record<
  StartPositionId,
  Record<'crossing' | 'field', number>
> = {
  north: { crossing: 0, field: 0 },
  'south-east': { crossing: 0, field: 0 },
  'south-west': { crossing: 0, field: 0 },
};
const factionASeatCounts: Record<StartPositionId, number> = {
  north: 0,
  'south-east': 0,
  'south-west': 0,
};
const eliminationsByStart: Record<StartPositionId, Record<string, number>> = {
  north: {},
  'south-east': {},
  'south-west': {},
};
const ticketLossByStart: Record<
  StartPositionId,
  {
    combatCenti: number;
    territoryPenaltyCenti: number;
    timeDecayCenti: number;
    clampedIntervals: number;
  }
> = {
  north: {
    combatCenti: 0,
    territoryPenaltyCenti: 0,
    timeDecayCenti: 0,
    clampedIntervals: 0,
  },
  'south-east': {
    combatCenti: 0,
    territoryPenaltyCenti: 0,
    timeDecayCenti: 0,
    clampedIntervals: 0,
  },
  'south-west': {
    combatCenti: 0,
    territoryPenaltyCenti: 0,
    timeDecayCenti: 0,
    clampedIntervals: 0,
  },
};
for (const match of matches) {
  if (match.seatByFaction?.A) factionASeatCounts[match.seatByFaction.A] += 1;
  for (const [factionId, route] of Object.entries(match.routeByFaction)) {
    const start = match.seatByFaction?.[factionId as FactionId];
    if (start && route) routesByStart[start][route] += 1;
  }
  for (const seat of Object.values(match.seatByFaction ?? {})) {
    const result = counts.get(seat);
    if (result) result.games += 1;
  }
  for (const [factionId, reason] of Object.entries(
    match.eliminationByFaction ?? {},
  )) {
    const start = match.seatByFaction?.[factionId as FactionId];
    if (!start) continue;
    eliminationsByStart[start][reason] =
      (eliminationsByStart[start][reason] ?? 0) + 1;
  }
  for (const [factionId, loss] of Object.entries(
    match.ticketLossByFaction ?? {},
  )) {
    const start = match.seatByFaction?.[factionId as FactionId];
    if (!start || !loss) continue;
    ticketLossByStart[start].combatCenti += loss.combatCenti;
    ticketLossByStart[start].territoryPenaltyCenti +=
      loss.territoryPenaltyCenti;
    ticketLossByStart[start].timeDecayCenti += loss.timeDecayCenti;
    ticketLossByStart[start].clampedIntervals += loss.clampedIntervals;
  }
  if (match.winners.length === 1) {
    const seat = match.winnerSeats[0];
    if (seat) {
      const result = counts.get(seat);
      if (result) result.wins += 1;
    }
  }
}

console.log(
  JSON.stringify(
    {
      sample,
      northFieldPlan,
      mapDefinitionVersion,
      checkpointPath,
      seedPolicy: requestedSeeds
        ? `selected diagnostic seeds ${SEEDS.join(',')}`
        : `fixed preregistered ${sample} seeds ${firstSeed}..${firstSeed + SEEDS.length - 1}; six A-seat assignments per physical start`,
      denominatorPolicy: `${matches.length} complete 3-start games; each physical start is a participant in all ${matches.length}. A-seat balance is reported separately. Tied rank-1, mutual-elimination, and unresolved-at-12000 games are non-wins in the primary win rate and reported separately.`,
      tickLimit: TICK_LIMIT,
      outcomes: Object.fromEntries(
        [...counts].map(([seat, result]) => [
          seat,
          { ...result, winRate: result.wins / result.games },
        ]),
      ),
      factionASeatCounts,
      eliminationsByStart,
      ticketLossByStart,
      routesByStart,
      unresolved: matches.filter((match) => match.phase === 'running').length,
      tied: matches.filter((match) => match.tied).length,
      matches,
    },
    null,
    2,
  ),
);
