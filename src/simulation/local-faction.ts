import type { RulesMaster } from './rules';
import type {
  LocalFactionState,
  MatchState,
  UnitKind,
  UnitState,
} from './types';

export const LOCAL_STRONGHOLD_ID = 'LOCAL-HQ';
export const LOCAL_STRONGHOLD_CELL = { x: 20, y: 23 } as const;
export const LOCAL_START_BASE_ID = 'OUT-02';

const ROSTER: readonly UnitKind[] = [
  'assault',
  'assault',
  'scout',
  'assault',
  'scout',
];

export function createLocalFactionState(
  rules: RulesMaster,
  active: boolean,
  appearedAtTick: number | null,
): LocalFactionState {
  return {
    active,
    defeated: false,
    appearedAtTick,
    nextSpawnTick: active
      ? (appearedAtTick ?? 0) + rules.localFaction.spawnIntervalTicks
      : null,
    rosterIndex: active ? rules.localFaction.initialUnits : 0,
    stronghold: {
      id: LOCAL_STRONGHOLD_ID,
      cell: { ...LOCAL_STRONGHOLD_CELL },
      hp: active ? rules.localFaction.strongholdMaxHp : 0,
      maxHp: rules.localFaction.strongholdMaxHp,
    },
    supplyCenti: rules.localFaction.startingSupplyCenti,
    conqueredBaseIds: [],
    rewardedBaseIds: [],
  };
}

type LocalUnitContext = Pick<
  MatchState,
  'localFaction' | 'rules' | 'elapsedTicks'
>;

function growthCenti(state: LocalUnitContext): number {
  const appeared = state.localFaction.appearedAtTick ?? state.elapsedTicks;
  const minutes = Math.floor(Math.max(0, state.elapsedTicks - appeared) / 600);
  return (
    10_000 + minutes * state.rules.localFaction.growthPercentPerMinute * 100
  );
}

function makeLocalUnit(
  state: LocalUnitContext,
  serial: number,
  kind: UnitKind,
  cell: { readonly x: number; readonly y: number },
): UnitState {
  const growth = growthCenti(state);
  const maxHp = Math.max(
    1,
    Math.round((state.rules.units[kind].maxHp * growth) / 10_000),
  );
  return {
    id: `L-${String(serial).padStart(2, '0')}`,
    factionId: 'local',
    kind,
    hp: maxHp,
    maxHp,
    growthCenti: growth,
    cell: { ...cell },
    path: [],
    edgeProgress: 0,
    moveTicksPerCell: state.rules.units[kind].moveTicksPerCell,
    marchOrder: null,
  };
}

export function createInitialLocalUnits(
  state: Pick<MatchState, 'localFaction' | 'rules' | 'elapsedTicks'>,
): UnitState[] {
  if (!state.localFaction.active || state.localFaction.defeated) return [];
  return Array.from(
    { length: state.rules.localFaction.initialUnits },
    (_, index) =>
      makeLocalUnit(state, index + 1, ROSTER[index % ROSTER.length]!, {
        x: LOCAL_STRONGHOLD_CELL.x + (index % 2 === 0 ? -1 : 1),
        y: LOCAL_STRONGHOLD_CELL.y,
      }),
  );
}

function activate(state: MatchState): MatchState {
  const base = state.bases.find(({ id }) => id === LOCAL_START_BASE_ID);
  if (!base)
    throw new Error(
      `missing local-faction starting base ${LOCAL_START_BASE_ID}`,
    );
  const activeState: MatchState = {
    ...state,
    localFaction: {
      ...state.localFaction,
      active: true,
      appearedAtTick: state.elapsedTicks,
      nextSpawnTick:
        state.elapsedTicks + state.rules.localFaction.spawnIntervalTicks,
      rosterIndex: 2,
      stronghold: {
        ...state.localFaction.stronghold,
        hp: state.rules.localFaction.strongholdMaxHp,
        maxHp: state.rules.localFaction.strongholdMaxHp,
      },
    },
    bases: state.bases.map((entry) =>
      entry.id === LOCAL_START_BASE_ID
        ? { ...entry, owner: 'local', hp: entry.maxHp, defender: null }
        : entry,
    ),
  };
  return {
    ...activeState,
    units: [...activeState.units, ...createInitialLocalUnits(activeState)],
  };
}

/** Applies the local faction's scheduled arrival and deterministic recruitment. */
export function advanceLocalFaction(state: MatchState): MatchState {
  if (
    state.scenarioId !== 'standard' &&
    state.scenarioId !== 'f06-local-faction'
  )
    return state;
  if (!state.localFaction.active) {
    return state.elapsedTicks >= state.rules.localFaction.appearanceTick
      ? activate(state)
      : state;
  }
  if (
    state.localFaction.defeated ||
    state.localFaction.nextSpawnTick === null ||
    state.elapsedTicks < state.localFaction.nextSpawnTick
  )
    return state;

  const localUnits = state.units.filter(
    (unit) => unit.factionId === 'local' && unit.hp > 0,
  );
  const rules = state.rules.localFaction;
  const nextSpawnTick = state.elapsedTicks + rules.spawnIntervalTicks;
  if (
    localUnits.length >= rules.maxUnits ||
    state.localFaction.supplyCenti < rules.unitCostCenti
  )
    return {
      ...state,
      localFaction: { ...state.localFaction, nextSpawnTick },
    };

  const serial = state.localFaction.rosterIndex + 1;
  const kind = ROSTER[state.localFaction.rosterIndex % ROSTER.length]!;
  const cell =
    localUnits.length % 2 === 0
      ? { x: LOCAL_STRONGHOLD_CELL.x - 1, y: LOCAL_STRONGHOLD_CELL.y }
      : { x: LOCAL_STRONGHOLD_CELL.x + 1, y: LOCAL_STRONGHOLD_CELL.y };
  return {
    ...state,
    units: [...state.units, makeLocalUnit(state, serial, kind, cell)],
    localFaction: {
      ...state.localFaction,
      nextSpawnTick,
      rosterIndex: serial,
      supplyCenti: state.localFaction.supplyCenti - rules.unitCostCenti,
    },
  };
}
