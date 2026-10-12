import {
  BASE_CELLS,
  INITIAL_UNIT_PLACEMENTS,
  SCENARIO_IDS,
  SCHEMA_VERSION,
  SHORT_TIME_LIMIT_TICKS,
} from './config';
import { DEFAULT_RULES, cloneRules } from './rules';
import { validateRules } from './rules-validation';
import type { RulesMaster } from './rules';
import { createMap } from './map';
import { findPath } from './pathfinding';
import { createInitialKnowledge } from './visibility';
import { createInitialLocalUnits } from './local-faction';
import type {
  BaseState,
  Cell,
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
  MarchOrder,
  MarchTarget,
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
  readonly rules?: RulesMaster;
}

function freshFactions(rules: RulesMaster): FactionState[] {
  return (['A', 'B', 'C'] as const).map((id) => ({
    id,
    controller: id === 'A' ? 'human' : 'bot',
    supplyCenti: rules.match.initialSupplyCenti,
    researchCenti: rules.match.initialResearchCenti,
    researchProgressCenti: {
      ...Object.fromEntries(
        Object.keys(rules.research.definitions).map((id) => [id, 0]),
      ),
    } as FactionState['researchProgressCenti'],
    ticketsCenti: rules.match.initialTicketsCenti,
    eliminatedAtTick: null,
    eliminationReason: null,
    productionJobs: [],
    activeResearch: null,
    completedResearchIds: [],
    nextUnitSerial: 3,
    nextJobSerial: 1,
  }));
}

function buildBases(rules: RulesMaster): BaseState[] {
  return BASE_CELLS.map(({ id, kind, cell, factionId }) => {
    const owner = factionId;
    const hq = kind === 'hq';
    return {
      id,
      kind,
      cell: { ...cell },
      owner,
      hp: rules.bases[kind].maxHp,
      maxHp: rules.bases[kind].maxHp,
      captureCandidate: null,
      captureProgressCentiTicks: 0,
      defender:
        owner === null && !hq
          ? {
              hp: rules.defenses[kind].maxHp,
              maxHp: rules.defenses[kind].maxHp,
              disabledTicks: 0,
            }
          : null,
      homeFactionId: hq ? factionId : null,
    };
  });
}

function buildUnits(rules: RulesMaster): UnitState[] {
  return INITIAL_UNIT_PLACEMENTS.map(({ id, factionId, kind, cell }) => ({
    id,
    factionId,
    kind,
    hp: rules.units[kind].maxHp,
    maxHp: rules.units[kind].maxHp,
    cell: { ...cell },
    path: [],
    edgeProgress: 0,
    moveTicksPerCell: rules.units[kind].moveTicksPerCell,
    marchOrder: null,
  }));
}

function scenarioMap(seed: number, scenarioId: ScenarioId) {
  const map = createMap(seed);
  if (scenarioId !== 'f02-pursuit' && scenarioId !== 'g2-combat') return map;
  return {
    ...map,
    terrain: new Array(map.width * map.height).fill('land'),
    terrainLevel: new Array(map.width * map.height).fill(0),
    blocked: new Array(map.width * map.height).fill(false),
  };
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
    bases = bases.map((base) =>
      base.id === 'OUT-03' ? { ...base, hp: 0, defender: null } : base,
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
    bases = bases.map((base) =>
      base.owner === null && base.kind !== 'hq'
        ? { ...base, hp: 0, defender: null }
        : base,
    );
  } else if (scenarioId === 'g2-economy') {
    factions = factions.map((faction) =>
      faction.id === 'A'
        ? { ...faction, supplyCenti: 18_000, researchCenti: 15_000 }
        : faction,
    );
    bases = bases.map((base) =>
      base.id === 'OUT-03'
        ? { ...base, owner: 'A', hp: 100, defender: null }
        : base,
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
  } else if (scenarioId === 'f02-pursuit') {
    const loop = [
      { x: 22, y: 20 },
      { x: 22, y: 21 },
      { x: 22, y: 22 },
      { x: 21, y: 22 },
      { x: 20, y: 22 },
      { x: 19, y: 22 },
      { x: 19, y: 21 },
      { x: 19, y: 20 },
      { x: 19, y: 19 },
      { x: 19, y: 18 },
      { x: 20, y: 18 },
      { x: 21, y: 18 },
      { x: 22, y: 18 },
      { x: 22, y: 19 },
    ] as const;
    let cursor = { x: 21, y: 20 };
    const route: Cell[] = [];
    for (let lap = 0; lap < 4; lap += 1) {
      for (const waypoint of loop) {
        const segment = findPath(state.map, cursor, waypoint);
        if (segment === null) continue;
        route.push(...segment);
        cursor = waypoint;
      }
    }
    units = units.map((unit) => {
      if (unit.id === 'A-01') return { ...unit, cell: { x: 17, y: 20 } };
      if (unit.id === 'B-01')
        return { ...unit, cell: { x: 21, y: 20 }, path: route };
      return unit;
    });
    bases = bases.map((base) =>
      base.owner === null && base.kind !== 'hq'
        ? { ...base, hp: 0, defender: null }
        : base,
    );
  } else if (scenarioId === 'f04-crossing') {
    units = units.map((unit) =>
      unit.id === 'A-01' ? { ...unit, cell: { x: 19, y: 10 } } : unit,
    );
    factions = factions.map((faction) =>
      faction.id === 'A' ? { ...faction, supplyCenti: 18_000 } : faction,
    );
  } else if (scenarioId === 'f05-neutral-defense') {
    units = units.map((unit) =>
      unit.id === 'A-01'
        ? { ...unit, cell: { x: 19, y: 28 } }
        : unit.id === 'A-02'
          ? { ...unit, cell: { x: 20, y: 29 } }
          : unit,
    );
    factions = factions.map((faction) =>
      faction.id === 'A' ? { ...faction, supplyCenti: 18_000 } : faction,
    );
  } else if (scenarioId === 'f06-local-faction') {
    units = units.map((unit) =>
      unit.id === 'A-01'
        ? { ...unit, cell: { x: 18, y: 20 } }
        : unit.id === 'A-02'
          ? { ...unit, cell: { x: 18, y: 19 } }
          : unit,
    );
    factions = factions.map((faction) =>
      faction.id === 'A' ? { ...faction, supplyCenti: 18_000 } : faction,
    );
    bases = bases.map((base) =>
      base.id === 'OUT-02'
        ? { ...base, owner: 'local', hp: base.maxHp, defender: null }
        : base,
    );
  } else if (scenarioId === 'f08-unit-domains') {
    factions = factions.map((faction) =>
      faction.id === 'A'
        ? { ...faction, supplyCenti: 50_000, researchCenti: 20_000 }
        : faction,
    );
  }
  return { ...state, factions, units, bases };
}

/** Creates a fresh schema-versioned match using deterministic map and scenario fixtures. */
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
  const validation = validateRules(options.rules ?? DEFAULT_RULES);
  if (!validation.ok)
    throw new RangeError(
      `invalid rules: ${validation.issues.map(({ key }) => key).join(', ')}`,
    );
  const rules = cloneRules(validation.rules);
  const map = scenarioMap(seed, scenarioId);
  const initial = configuredFixture(
    {
      schemaVersion: SCHEMA_VERSION,
      rules,
      seed,
      scenarioId,
      elapsedTicks: 0,
      timeLimitTicks:
        scenarioId === 'g3-timeout' || scenarioId === 'g3-spectate'
          ? SHORT_TIME_LIMIT_TICKS
          : rules.match.timeLimitTicks,
      factions: freshFactions(rules),
      phase: 'ready',
      result: null,
      map,
      units: buildUnits(rules),
      bases: buildBases(rules),
      crossings: (map.crossingSites ?? []).map((site) => ({
        siteId: site.id,
        owner: null,
        hp: 0,
        maxHp: 0,
        lastDamagedTick: -1,
        job: null,
      })),
      localFaction: {
        active: scenarioId === 'f06-local-faction',
        defeated: false,
        appearedAtTick: scenarioId === 'f06-local-faction' ? 0 : null,
        nextSpawnTick:
          scenarioId === 'f06-local-faction'
            ? rules.localFaction.spawnIntervalTicks
            : null,
        rosterIndex:
          scenarioId === 'f06-local-faction'
            ? rules.localFaction.initialUnits
            : 0,
        stronghold: {
          id: 'LOCAL-HQ',
          cell: { x: 20, y: 23 },
          hp:
            scenarioId === 'f06-local-faction'
              ? rules.localFaction.strongholdMaxHp
              : 0,
          maxHp: rules.localFaction.strongholdMaxHp,
        },
        supplyCenti: rules.localFaction.startingSupplyCenti,
        conqueredBaseIds: [],
        rewardedBaseIds: [],
      },
    },
    scenarioId,
  );
  const withLocalUnits =
    scenarioId === 'f06-local-faction'
      ? {
          ...initial,
          units: [...initial.units, ...createInitialLocalUnits(initial)],
        }
      : initial;
  const partial = { ...withLocalUnits, knowledge: [] } as MatchState;
  return { ...partial, knowledge: createInitialKnowledge(partial) };
}
