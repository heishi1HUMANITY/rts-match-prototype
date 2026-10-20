import { describe, expect, it } from 'vitest';
import { resolveCombat } from './combat';
import { applyCommand, createMatch, stepMatch } from './match';
import { applyEconomyTick } from './economy';
import { advanceProduction } from './production';
import { advanceResearch } from './research';
import { advanceBaseUpgrades } from './base-upgrades';
import { DEFAULT_RULES } from './rules';
import { calculateIntervalTicketLossCenti } from './tickets';
import { CAPTURE_TICKS_REQUIRED } from './config';
import type { Cell, MatchState, UnitState } from './types';

interface SiegeResult {
  readonly attackerCount: number;
  readonly defenderCount: number;
  readonly attackerSurvivors: number;
  readonly defenderSurvivors: number;
  readonly hqHp: number;
  readonly ticks: number;
  readonly hqRange: number;
  readonly artilleryRange: number;
  readonly attackerComposition: string;
  readonly researched: boolean;
  readonly endReason: 'attackers-eliminated' | 'hq-destroyed' | '1200-tick-cap';
}

interface SiegeOptions {
  readonly composition?: 'mixed' | 'artillery' | 'air' | 'assault';
  readonly researched?: boolean;
}

function hqSiege(
  baseUnits: number,
  maxUnits: number,
  hqLevel: 1 | 3 = 3,
  turretDamage = DEFAULT_RULES.baseUpgrades.kinds.hq.level3.turretDamage,
  { composition = 'mixed', researched = true }: SiegeOptions = {},
): SiegeResult {
  const start = createMatch(42, {
    rules: {
      ...DEFAULT_RULES,
      limits: { ...DEFAULT_RULES.limits, baseUnits, maxUnits },
      bases: {
        ...DEFAULT_RULES.bases,
        hq: { ...DEFAULT_RULES.bases.hq, garrisonCapacity: baseUnits },
      },
      baseUpgrades: {
        ...DEFAULT_RULES.baseUpgrades,
        kinds: {
          ...DEFAULT_RULES.baseUpgrades.kinds,
          hq: {
            ...DEFAULT_RULES.baseUpgrades.kinds.hq,
            level3: {
              ...DEFAULT_RULES.baseUpgrades.kinds.hq.level3,
              turretDamage,
            },
          },
        },
      },
      match: { ...DEFAULT_RULES.match, hqProtectionTicks: 0 },
    },
  });
  const hq = start.bases.find(({ id }) => id === 'HQ-A')!;
  const template = start.units[0]!;
  const defenderKinds: UnitState['kind'][] = Array.from(
    { length: baseUnits },
    () => 'assault',
  );
  const attackerMix: UnitState['kind'][] =
    composition === 'assault'
      ? Array.from({ length: maxUnits }, () => 'assault')
      : composition === 'artillery'
        ? Array.from({ length: maxUnits }, (_, index) =>
            index < 2 ? 'assault' : 'artillery',
          )
        : composition === 'air'
          ? Array.from({ length: maxUnits }, (_, index) =>
              index < 2 ? 'assault' : 'helicopter',
            )
          : maxUnits === 7
            ? [
                'assault',
                'assault',
                'assault',
                'assault',
                'artillery',
                'helicopter',
                'antiAir',
              ]
            : [
                'assault',
                'assault',
                'assault',
                'assault',
                'assault',
                'artillery',
                'artillery',
                'helicopter',
                'antiAir',
              ];
  const attackerKinds = attackerMix.slice(0, maxUnits);
  const makeUnit = (
    factionId: 'A' | 'B',
    kind: UnitState['kind'],
    index: number,
  ): UnitState => ({
    ...template,
    id: `${factionId}-${String(index + 1).padStart(2, '0')}`,
    factionId,
    kind,
    maxHp: start.rules.units[kind].maxHp,
    hp: start.rules.units[kind].maxHp,
    cell: {
      x:
        hq.cell.x +
        (factionId === 'A'
          ? 0
          : kind === 'artillery'
            ? 5
            : kind === 'helicopter'
              ? 3
              : 1),
      y: hq.cell.y,
    },
    path: [],
    edgeProgress: 0,
    garrisonedAtBaseId: factionId === 'A' ? hq.id : null,
    marchOrder:
      factionId === 'B'
        ? {
            target: { kind: 'base', id: hq.id },
            lastKnownCell: hq.cell,
            lastSeenTick: 1_300,
            status: 'tracking',
          }
        : null,
    attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
  });
  let state: MatchState = {
    ...start,
    elapsedTicks: 1_300,
    phase: 'running',
    bases: start.bases.map((base) =>
      base.id === hq.id && hqLevel === 3
        ? {
            ...base,
            level: 3,
            hp: Math.ceil(base.maxHp * 1.6),
            maxHp: Math.ceil(base.maxHp * 1.6),
          }
        : ['OUT-01', 'OUT-02', 'OUT-03'].includes(base.id)
          ? { ...base, owner: 'B', hp: base.maxHp, defender: null }
          : base,
    ),
    units: [
      ...defenderKinds.map((kind, i) => makeUnit('A', kind, i)),
      ...attackerKinds.map((kind, i) => makeUnit('B', kind, i)),
    ],
    map: {
      ...start.map,
      blocked: start.map.blocked.map(() => false),
      terrain: start.map.blocked.map(() => 'land' as const),
    },
    factions: start.factions.map((faction) =>
      faction.id === 'A' || faction.id === 'B'
        ? {
            ...faction,
            completedResearchIds: researched
              ? [
                  'firepower-1',
                  'firepower-2',
                  'firepower-3',
                  'artillery-1',
                  'aircraft-1',
                  'air-defense-1',
                  'base-development-1',
                  'base-development-2',
                ]
              : [],
          }
        : faction,
    ),
  };
  const initialTickets = new Map(
    state.factions.map(({ id, ticketsCenti }) => [id, ticketsCenti]),
  );
  let ticks = 0;
  for (; ticks < 1_200; ticks += 1) {
    state = resolveCombat(state);
    if (state.units.every(({ factionId, hp }) => factionId !== 'B' || hp <= 0))
      break;
    if (state.bases.find(({ id }) => id === hq.id)!.hp <= 0) break;
    state = { ...state, elapsedTicks: state.elapsedTicks + 1 };
  }
  const alive = (id: 'A' | 'B'): number =>
    state.units.filter((unit) => unit.factionId === id && unit.hp > 0).length;
  expect(
    state.factions.find(({ id }) => id === 'B')!.ticketsCenti,
  ).toBeLessThanOrEqual(initialTickets.get('B')!);
  return {
    attackerCount: maxUnits,
    defenderCount: baseUnits,
    attackerSurvivors: alive('B'),
    defenderSurvivors: alive('A'),
    hqHp: state.bases.find(({ id }) => id === hq.id)!.hp,
    ticks,
    hqRange: state.rules.baseUpgrades.kinds.hq.level3.turretRange,
    artilleryRange: state.rules.units.artillery.range,
    attackerComposition: composition,
    researched,
    endReason:
      alive('B') === 0
        ? 'attackers-eliminated'
        : state.bases.find(({ id }) => id === hq.id)!.hp <= 0
          ? 'hq-destroyed'
          : '1200-tick-cap',
  };
}

describe('CP12 territory and HQ defense model', () => {
  it.each([
    [4, 7],
    [5, 9],
  ])(
    'runs the actual combat rules for base %i against cap %i',
    (baseUnits, maxUnits) => {
      const result = hqSiege(baseUnits, maxUnits);
      if (baseUnits === 5) {
        expect(result).toMatchObject({
          attackerSurvivors: 0,
          defenderSurvivors: 1,
          hqHp: 1_920,
          ticks: 140,
          endReason: 'attackers-eliminated',
          hqRange: 6,
          artilleryRange: 5,
        });
      } else {
        expect(result).toMatchObject({
          attackerSurvivors: 0,
          defenderSurvivors: 0,
          hqHp: 1_907,
          ticks: 120,
          endReason: 'attackers-eliminated',
          hqRange: 6,
          artilleryRange: 5,
        });
      }
    },
  );

  it('allows a max-cap attack to destroy an undefended, unupgraded HQ', () => {
    const result = hqSiege(5, 9, 1);
    expect(result).toMatchObject({
      attackerSurvivors: 6,
      defenderSurvivors: 0,
      hqHp: 0,
      endReason: 'hq-destroyed',
      hqRange: 6,
      artilleryRange: 5,
      ticks: 180,
    });
  });

  it.each([
    [120, 1_907, 0],
    [140, 1_920, 1],
    [160, 1_920, 1],
  ])(
    'measures the HQ turret threshold for the 4/7 option at damage %i',
    (turretDamage, expectedHqHp, expectedDefendersRemaining) => {
      const result = hqSiege(4, 7, 3, turretDamage);
      expect(result).toMatchObject({
        attackerSurvivors: 0,
        hqHp: expectedHqHp,
        defenderSurvivors: expectedDefendersRemaining,
        endReason: 'attackers-eliminated',
      });
      expect(result.artilleryRange).toBeLessThan(result.hqRange);
    },
  );

  it.each([
    ['artillery', true],
    ['air', true],
    ['assault', false],
  ] as const)(
    'checks a %s attack with researched=%s against the 5/9 defense',
    (composition, researched) => {
      const result = hqSiege(5, 9, 3, 120, { composition, researched });
      expect(result.hqRange).toBe(6);
      expect(result.ticks).toBeLessThan(1_200);
      expect(result.attackerSurvivors).toBe(0);
      expect(result.hqHp).toBeGreaterThan(0);
      if (composition === 'air') {
        expect(result).toMatchObject({
          defenderSurvivors: 0,
          hqHp: 1_101,
          ticks: 220,
          endReason: 'attackers-eliminated',
        });
      } else if (composition === 'artillery') {
        expect(result).toMatchObject({
          defenderSurvivors: 1,
          hqHp: 1_920,
          ticks: 150,
          endReason: 'attackers-eliminated',
        });
      } else {
        expect(result).toMatchObject({
          defenderSurvivors: 1,
          hqHp: 1_920,
          ticks: composition === 'assault' ? 130 : 140,
          endReason: 'attackers-eliminated',
        });
      }
    },
  );

  it('compares two-front reserves and serial replacement under the same flat economy', () => {
    const rules = DEFAULT_RULES;
    const loss = (roster: readonly UnitState['kind'][]): number =>
      roster.reduce(
        (sum, kind) => sum + rules.units[kind].upkeepCentiPerTick,
        0,
      );
    const fourAssaults = Array.from({ length: 4 }, () => 'assault' as const);
    const threeAssaults = Array.from({ length: 3 }, () => 'assault' as const);
    const nineRoster: UnitState['kind'][] = [
      'assault',
      'assault',
      'assault',
      'assault',
      'assault',
      'artillery',
      'artillery',
      'helicopter',
      'antiAir',
    ];
    const sevenRoster: UnitState['kind'][] = [
      'assault',
      'assault',
      'assault',
      'assault',
      'assault',
      'artillery',
      'helicopter',
    ];
    expect(nineRoster).toHaveLength(9);
    expect(sevenRoster).toHaveLength(7);
    expect(loss(nineRoster)).toBe(104);
    expect(loss(sevenRoster)).toBe(80);
    expect(rules.economy.flatSupplyIncomeCentiPerTick).toBe(120);

    // After one front is lost, the other front and one reserve remain.
    // With no stored stockpile, 4/7 replace cost is slower than its 600-tick
    // queue and 5/9 replacement is slower than its 800-tick queue.
    const fourLossNet = 120 - loss([...fourAssaults, 'assault']);
    const threeLossNet = 120 - loss([...threeAssaults, 'assault']);
    const fourReplacementSupplyTicks = Math.ceil(
      (fourAssaults.length * rules.units.assault.costCenti) / fourLossNet,
    );
    const threeReplacementSupplyTicks = Math.ceil(
      (threeAssaults.length * rules.units.assault.costCenti) / threeLossNet,
    );
    expect(fourReplacementSupplyTicks).toBe(686);
    expect(threeReplacementSupplyTicks).toBe(450);
    expect(fourAssaults.length * rules.units.assault.buildTicks).toBe(800);
    expect(threeAssaults.length * rules.units.assault.buildTicks).toBe(600);
    expect(Math.max(fourReplacementSupplyTicks, 800)).toBe(800);
    expect(Math.max(threeReplacementSupplyTicks, 600)).toBe(600);
  });

  it.each([
    [5, 9, 5, 4, 972],
    [4, 7, 4, 3, 750],
  ])(
    'replenishes the lost front through commands and simulation for %i/%i',
    (baseUnits, maxUnits, survivors, replacements, expectedElapsed) => {
      const initial = createMatch(42, {
        controllers: { A: 'human', B: 'human', C: 'human' },
        rules: {
          ...DEFAULT_RULES,
          limits: { ...DEFAULT_RULES.limits, baseUnits, maxUnits },
          bases: {
            ...DEFAULT_RULES.bases,
            hq: { ...DEFAULT_RULES.bases.hq, garrisonCapacity: baseUnits },
          },
        },
      });
      const hq = initial.bases.find(({ id }) => id === 'HQ-A')!;
      const template = initial.units.find(
        ({ factionId }) => factionId === 'A',
      )!;
      const survivingUnits = Array.from(
        { length: survivors },
        (_, index): UnitState => ({
          ...template,
          id: `A-R${index + 1}`,
          kind: 'assault',
          maxHp: DEFAULT_RULES.units.assault.maxHp,
          hp: DEFAULT_RULES.units.assault.maxHp,
          cell: hq.cell,
          garrisonedAtBaseId: null,
          marchOrder: null,
          path: [],
          edgeProgress: 0,
          attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
        }),
      );
      let state: MatchState = {
        ...initial,
        phase: 'running',
        units: survivingUnits,
        bases: initial.bases.map((base) =>
          base.kind === 'hq' ? base : { ...base, owner: 'A', hp: base.maxHp },
        ),
        factions: initial.factions.map((faction) =>
          faction.id === 'A'
            ? {
                ...faction,
                supplyCenti: 0,
                productionJobs: [],
                eliminatedAtTick: null,
              }
            : { ...faction, eliminatedAtTick: null },
        ),
      };
      const before = state.elapsedTicks;
      let requested = 0;
      for (
        let guard = 0;
        guard < 4_000 &&
        state.units.filter(({ factionId, hp }) => factionId === 'A' && hp > 0)
          .length <
          survivors + replacements;
        guard += 1
      ) {
        if (requested < replacements) {
          const result = applyCommand(state, 'A', {
            type: 'enqueue-production',
            baseId: 'HQ-A',
            unitKind: 'assault',
          });
          if (result.ok) {
            state = result.state;
            requested += 1;
          } else if (
            result.reason !== 'INSUFFICIENT_SUPPLY' &&
            result.reason !== 'QUEUE_FULL'
          ) {
            throw new Error(`Unexpected production failure: ${result.reason}`);
          }
        }
        state = stepMatch(state);
      }
      const elapsed = state.elapsedTicks - before;
      expect(
        state.units.filter(({ factionId, hp }) => factionId === 'A' && hp > 0),
      ).toHaveLength(survivors + replacements);
      expect(requested).toBe(replacements);
      expect(elapsed).toBe(expectedElapsed);
      expect(elapsed).toBeGreaterThan(
        replacements * DEFAULT_RULES.units.assault.buildTicks,
      );
    },
  );

  it('reaches the 5/9 mixed roster, nine shared-techs and HQ-Lv3 after securing four outposts within the time limit', () => {
    const initial = createMatch(42, {
      mapId: 'legacy-40',
      controllers: { A: 'human', B: 'human', C: 'human' },
    });
    let grantedOutposts = 0;
    let state: MatchState = {
      ...initial,
      phase: 'running',
      bases: initial.bases.map((base) => {
        if (base.kind === 'hq' || grantedOutposts >= 4) return base;
        grantedOutposts += 1;
        return { ...base, owner: 'A', hp: base.maxHp };
      }),
    };
    expect(grantedOutposts).toBe(4);
    expect(
      state.bases.filter((base) => base.kind !== 'hq' && base.owner === 'A'),
    ).toHaveLength(4);
    const researchPlan = [
      'base-development-1',
      'artillery-1',
      'air-defense-1',
      'survey-1',
      'aircraft-1',
      'base-development-2',
      'firepower-1',
      'firepower-2',
      'firepower-3',
    ];
    const productionPlan: UnitState['kind'][] = [
      'assault',
      'assault',
      'assault',
      'artillery',
      'artillery',
      'helicopter',
      'antiAir',
    ];
    let requestedResearch = 0;
    let requestedProduction = 0;
    let level2Requested = false;
    let level3Requested = false;
    const complete = (): boolean => {
      const faction = state.factions.find(({ id }) => id === 'A')!;
      const hq = state.bases.find(({ id }) => id === 'HQ-A')!;
      return (
        researchPlan.every((id) => faction.completedResearchIds.includes(id)) &&
        hq.level === 3 &&
        hq.upgradeJob === null &&
        requestedProduction === productionPlan.length &&
        faction.productionJobs.length === 0 &&
        state.units.filter(({ factionId, hp }) => factionId === 'A' && hp > 0)
          .length === 9
      );
    };
    for (let guard = 0; guard < 12_000 && !complete(); guard += 1) {
      const faction = state.factions.find(({ id }) => id === 'A')!;
      if (
        faction.activeResearch === null &&
        requestedResearch < researchPlan.length
      ) {
        const researchId = researchPlan[requestedResearch]!;
        const result = applyCommand(state, 'A', {
          type: 'start-research',
          researchId,
        });
        if (!result.ok)
          throw new Error(
            `Research ${researchId} was not reachable: ${result.reason}`,
          );
        state = result.state;
        requestedResearch += 1;
      }

      const hq = state.bases.find(({ id }) => id === 'HQ-A')!;
      const upgradeLevel = hq.level === 1 ? 2 : hq.level === 2 ? 3 : null;
      const researchForLevel =
        upgradeLevel === 2 ? 'base-development-1' : 'base-development-2';
      if (
        upgradeLevel !== null &&
        !hq.upgradeJob &&
        !faction.completedResearchIds.includes(researchForLevel)
      ) {
        // Research may be in flight; do not send an upgrade until it finishes.
      } else if (
        upgradeLevel === 2
          ? !level2Requested
          : upgradeLevel === 3
            ? !level3Requested
            : false
      ) {
        const result = applyCommand(state, 'A', {
          type: 'upgrade-base',
          baseId: 'HQ-A',
        });
        if (result.ok) {
          state = result.state;
          if (upgradeLevel === 2) level2Requested = true;
          else level3Requested = true;
        } else if (
          result.reason !== 'INSUFFICIENT_SUPPLY' &&
          result.reason !== 'BASE_UPGRADE_BUSY'
        ) {
          throw new Error(`HQ upgrade was not reachable: ${result.reason}`);
        }
      }

      if (requestedProduction < productionPlan.length) {
        const unitKind = productionPlan[requestedProduction]!;
        const result = applyCommand(state, 'A', {
          type: 'enqueue-production',
          baseId: 'HQ-A',
          unitKind,
        });
        if (result.ok) {
          state = result.state;
          requestedProduction += 1;
        } else if (
          ![
            'INSUFFICIENT_SUPPLY',
            'QUEUE_FULL',
            'UNIT_LIMIT',
            'RESEARCH_REQUIRED',
          ].includes(result.reason)
        ) {
          throw new Error(
            `Unit ${unitKind} was not producible: ${result.reason}`,
          );
        }
      }

      state = { ...state, elapsedTicks: state.elapsedTicks + 1 };
      state = advanceBaseUpgrades(state);
      state = applyEconomyTick(state);
      state = advanceResearch(state);
      state = advanceProduction(state);
    }
    expect(complete()).toBe(true);
    expect(state.elapsedTicks).toBeLessThanOrEqual(12_000);
    expect(requestedResearch).toBe(researchPlan.length);
    expect(requestedProduction).toBe(productionPlan.length);
    // Supply per tick is unchanged by the 200ms tick, so the full roster is a late-match goal.
    expect(state.elapsedTicks).toBe(7_647);
    expect(
      state.factions.find(({ id }) => id === 'A')!.completedResearchIds,
    ).toEqual(researchPlan);
  });

  it('shows the one-outpost ticket lifetime exceeds uncontested capture time', () => {
    const state = createMatch(42, {
      rules: {
        ...DEFAULT_RULES,
        tickets: {
          ...DEFAULT_RULES.tickets,
          decay: {
            ...DEFAULT_RULES.tickets.decay,
            startCentiPerTick: 15,
            endCentiPerTick: 15,
          },
        },
      },
    });
    const late = {
      ...state,
      elapsedTicks: 6_000,
      bases: state.bases.map((base) => {
        if (base.kind === 'hq') return base;
        if (base.id === 'HOME-A') return { ...base, owner: null, hp: 0 };
        return {
          ...base,
          owner: base.id.endsWith('-B') ? ('B' as const) : ('C' as const),
          hp: base.maxHp,
        };
      }),
    };
    const lossPerInterval = calculateIntervalTicketLossCenti(
      late,
      'A',
    ).totalLoss;
    const ticketLifeTicks = Math.floor(
      (late.rules.match.initialTicketsCenti / lossPerInterval) *
        late.rules.tickets.updateIntervalTicks,
    );
    expect(lossPerInterval).toBe(360);
    expect(CAPTURE_TICKS_REQUIRED).toBe(200);
    expect(ticketLifeTicks).toBe(833);
    expect(ticketLifeTicks).toBeGreaterThan(CAPTURE_TICKS_REQUIRED * 4);
  });

  it('recaptures a nearby enemy-held last outpost before the actual ticket deadline', () => {
    const initial = createMatch(0, {
      mapId: 'ring-three-fronts-100',
      controllers: { A: 'human', B: 'human', C: 'human' },
    });
    const hq = initial.bases.find(({ id }) => id === 'HQ-A')!;
    const target = initial.bases.find(({ id }) => id === 'HOME-A')!;
    expect(hq.cell).toEqual({ x: 13, y: 50 });
    expect(target.cell).toEqual({ x: 25, y: 50 });
    const template = initial.units.find(({ factionId }) => factionId === 'A')!;
    const createUnit = (
      factionId: 'A' | 'B',
      id: string,
      cell: Cell,
      garrisonedAtBaseId: string | null,
    ): UnitState => ({
      ...template,
      id,
      factionId,
      kind: 'assault',
      maxHp: DEFAULT_RULES.units.assault.maxHp,
      hp: DEFAULT_RULES.units.assault.maxHp,
      cell,
      path: [],
      edgeProgress: 0,
      garrisonedAtBaseId,
      marchOrder: null,
      attack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
    });
    let state: MatchState = {
      ...initial,
      phase: 'running',
      elapsedTicks: 3_000,
      bases: initial.bases.map((base) => {
        if (base.kind === 'hq') return base;
        if (base.id === target.id)
          return { ...base, owner: 'B', hp: base.maxHp };
        return {
          ...base,
          owner: base.id.endsWith('-B') ? ('B' as const) : ('C' as const),
          hp: base.maxHp,
        };
      }),
      units: [
        ...Array.from({ length: 5 }, (_, index) =>
          createUnit('A', `A-R${index + 1}`, hq.cell, 'HQ-A'),
        ),
        createUnit('B', 'B-G1', target.cell, target.id),
      ],
      factions: initial.factions.map((faction) =>
        faction.id === 'A'
          ? { ...faction, ticketsCenti: 30_000 }
          : { ...faction, ticketsCenti: 30_000 },
      ),
    };
    expect(state.bases.find(({ id }) => id === target.id)!.maxHp).toBe(300);
    expect(
      state.units.filter(({ factionId }) => factionId === 'A'),
    ).toHaveLength(5);
    expect(
      state.units
        .filter(({ factionId }) => factionId === 'A')
        .every(({ garrisonedAtBaseId }) => garrisonedAtBaseId === 'HQ-A'),
    ).toBe(true);
    const noRecaptureStart = state;
    let noRecapture = noRecaptureStart;
    while (
      noRecapture.phase !== 'finished' &&
      noRecapture.factions.find(({ id }) => id === 'A')!.eliminatedAtTick ===
        null &&
      noRecapture.elapsedTicks - noRecaptureStart.elapsedTicks < 12_000
    )
      noRecapture = stepMatch(noRecapture);
    const ticketDeadlineTicks =
      noRecapture.elapsedTicks - noRecaptureStart.elapsedTicks;
    expect(ticketDeadlineTicks).toBe(1_620);
    expect(
      noRecapture.factions.find(({ id }) => id === 'A')!.eliminatedAtTick,
    ).not.toBeNull();
    for (const unit of state.units.filter(
      ({ factionId }) => factionId === 'A',
    )) {
      const command = applyCommand(state, 'A', {
        type: 'march',
        unitId: unit.id,
        target: { kind: 'base', id: target.id },
      });
      if (!command.ok)
        throw new Error(`Could not order outpost recapture: ${command.reason}`);
      state = command.state;
    }

    const startingTick = state.elapsedTicks;

    for (
      let ticks = 0;
      ticks < 12_000 &&
      state.bases.find(({ id }) => id === target.id)!.owner !== 'A';
      ticks += 1
    ) {
      state = stepMatch(state);
      if (
        state.factions.find(({ id }) => id === 'A')!.eliminatedAtTick !== null
      )
        break;
    }
    const elapsedTicks = state.elapsedTicks - startingTick;
    expect(state.bases.find(({ id }) => id === target.id)!.owner).toBe('A');
    expect(
      state.factions.find(({ id }) => id === 'A')!.ticketsCenti,
    ).toBeGreaterThan(0);
    expect(elapsedTicks).toBeLessThan(ticketDeadlineTicks);
    expect(elapsedTicks).toBe(159);
    expect(noRecapture.phase).toBe('finished');
  });
});
