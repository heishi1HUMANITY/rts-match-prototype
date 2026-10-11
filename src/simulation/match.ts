import {
  BASE_CELLS,
  BASE_STATS,
  INITIAL_RESEARCH_CENTI,
  INITIAL_SUPPLY_CENTI,
  INITIAL_TICKETS_CENTI,
  INITIAL_UNIT_PLACEMENTS,
  SCENARIO_IDS,
  SCHEMA_VERSION,
  SHORT_TIME_LIMIT_TICKS,
  STANDARD_TIME_LIMIT_TICKS,
  UNIT_STATS,
} from './config';
import { createMap } from './map';
import { createInitialKnowledge } from './visibility';
import type {
  BaseState,
  FactionState,
  MatchState,
  ScenarioId,
  UnitState,
} from './types';

export type { Faction, FactionId } from './types';
export type {
  ActiveResearch,
  BaseState,
  BaseView,
  Cell,
  Command,
  CommandResult,
  FactionKnowledge,
  FactionState,
  FactionView,
  GridMap,
  MatchResult,
  MatchStanding,
  EliminationReason,
  EliminationStatus,
  MatchState,
  Phase,
  ProductionJob,
  RejectCode,
  ScenarioId,
  UnitKind,
  UnitState,
} from './types';

export { applyCommand } from './commands';
export { findPath } from './pathfinding';
export { stepMatch } from './step';
export { getFactionView } from './view';
export {
  isCellVisibleToFaction,
  isUnitVisibleToFaction,
  updateFactionKnowledge,
} from './visibility';

export interface CreateMatchOptions {
  readonly scenarioId?: ScenarioId;
}

function freshFactions(): FactionState[] {
  return (['A', 'B', 'C'] as const).map((id) => ({
    id,
    controller: id === 'A' ? 'human' : 'bot',
    supplyCenti: INITIAL_SUPPLY_CENTI,
    researchCenti: INITIAL_RESEARCH_CENTI,
    researchProgressCenti: {
      'firepower-1': 0,
      'firepower-2': 0,
    },
    ticketsCenti: INITIAL_TICKETS_CENTI,
    eliminatedAtTick: null,
    eliminationReason: null,
    productionJobs: [],
    activeResearch: null,
    completedResearchIds: [],
    nextUnitSerial: 3,
    nextJobSerial: 1,
  }));
}

function buildBases(): BaseState[] {
  return BASE_CELLS.map(({ id, kind, cell, factionId }) => {
    const owner = factionId;
    const hq = kind === 'hq';
    return {
      id,
      kind,
      cell: { ...cell },
      owner,
      hp: owner === null ? 0 : BASE_STATS[kind].maxHp,
      maxHp: BASE_STATS[kind].maxHp,
      captureCandidate: null,
      captureTicks: 0,
      homeFactionId: hq ? factionId : null,
    };
  });
}

function buildUnits(): UnitState[] {
  return INITIAL_UNIT_PLACEMENTS.map(({ id, factionId, kind, cell }) => ({
    id,
    factionId,
    kind,
    hp: UNIT_STATS[kind].maxHp,
    maxHp: UNIT_STATS[kind].maxHp,
    cell: { ...cell },
    path: [],
    edgeProgress: 0,
  }));
}

function configuredFixture(
  state: Omit<MatchState, 'knowledge'>,
  scenarioId: ScenarioId,
): Omit<MatchState, 'knowledge'> {
  let factions = state.factions.map((faction) => ({ ...faction }));
  let units = state.units.map((unit) => ({ ...unit, cell: { ...unit.cell } }));
  let bases = state.bases.map((base) => ({ ...base, cell: { ...base.cell } }));
  if (scenarioId === 'g2-capture') {
    units = units.map((unit) =>
      unit.id === 'A-01'
        ? { ...unit, cell: { x: 20, y: 28 } }
        : unit.id === 'A-02'
          ? { ...unit, cell: { x: 20, y: 29 } }
          : unit,
    );
  } else if (scenarioId === 'g2-combat') {
    units = units.map((unit) => {
      if (unit.id === 'A-01')
        return { ...unit, cell: { x: 20, y: 20 }, hp: 4, maxHp: 100 };
      if (unit.id === 'B-01')
        return { ...unit, cell: { x: 22, y: 20 }, hp: 4, maxHp: 100 };
      if (unit.id === 'A-02') return { ...unit, cell: { x: 10, y: 20 } };
      if (unit.id === 'B-02') return { ...unit, cell: { x: 30, y: 20 } };
      return unit;
    });
  } else if (scenarioId === 'g2-economy') {
    factions = factions.map((faction) =>
      faction.id === 'A'
        ? { ...faction, supplyCenti: 18_000, researchCenti: 15_000 }
        : faction,
    );
    bases = bases.map((base) =>
      base.id === 'OUT-03' ? { ...base, owner: 'A', hp: 100 } : base,
    );
  } else if (scenarioId === 'g3-elimination') {
    factions = factions.map((faction) =>
      faction.id === 'A' ? faction : { ...faction, ticketsCenti: 0 },
    );
  } else if (scenarioId === 'g3-mutual') {
    factions = factions.map((faction) => ({ ...faction, ticketsCenti: 0 }));
  } else if (scenarioId === 'g3-spectate') {
    factions = factions.map((faction) =>
      faction.id === 'A' ? { ...faction, ticketsCenti: 0 } : faction,
    );
  }
  return { ...state, factions, units, bases };
}

/** Creates a fresh schema-v5 match using deterministic map and scenario fixtures. */
export function createMatch(
  seed: number,
  options: CreateMatchOptions = {},
): MatchState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }
  const scenarioId = options.scenarioId ?? 'standard';
  if (!SCENARIO_IDS.includes(scenarioId))
    throw new RangeError('unknown scenarioId');
  const initial = configuredFixture(
    {
      schemaVersion: SCHEMA_VERSION,
      seed,
      scenarioId,
      elapsedTicks: 0,
      timeLimitTicks:
        scenarioId === 'g3-timeout' || scenarioId === 'g3-spectate'
          ? SHORT_TIME_LIMIT_TICKS
          : STANDARD_TIME_LIMIT_TICKS,
      factions: freshFactions(),
      phase: 'ready',
      result: null,
      map: createMap(seed),
      units: buildUnits(),
      bases: buildBases(),
    },
    scenarioId,
  );
  const partial = { ...initial, knowledge: [] } as MatchState;
  return { ...partial, knowledge: createInitialKnowledge(partial) };
}
