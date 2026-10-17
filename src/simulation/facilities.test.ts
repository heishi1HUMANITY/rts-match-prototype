import { describe, expect, it } from 'vitest';
import { createMatch } from './match';
import { applyCommand } from './commands';
import {
  advanceFacilities,
  beginFacilityBuild,
  cleanupFacilities,
  validateFacilityBuild,
} from './facilities';
import { resolveCombat } from './combat';
import { getFactionView } from './view';
import {
  isCellVisibleToFaction,
  isUnitVisibleToFaction,
  updateFactionKnowledge,
} from './visibility';
import { stepMatch } from './step';
import { validateEnvelope } from './rules-validation';
import { DEFAULT_RULES } from './rules';
import { resolveMatchOutcome } from './outcome';
import type {
  FacilityKind,
  FacilityState,
  MatchState,
  UnitState,
} from './types';
function fixture(): MatchState {
  const s = createMatch(42, { scenarioId: 'f11-facilities' });
  return {
    ...s,
    phase: 'running',
    units: [],
    map: {
      ...s.map,
      blocked: s.map.blocked.map(() => false),
      terrain: s.map.blocked.map(() => 'land' as const),
    },
  };
}
function facility(
  kind: FacilityKind,
  owner: 'A' | 'B' = 'A',
  x = 10,
  y = 10,
): FacilityState {
  return {
    id: `${kind}-${owner}`,
    kind,
    owner,
    anchor: { kind: 'base', id: `HQ-${owner}` },
    slot: 0,
    cell: { x, y },
    hp: 300,
    maxHp: 300,
    remainingBuildTicks: 0,
    lastActivatedTick: -10,
    lastDamagedTick: -1,
  };
}
function enemy(kind: UnitState['kind'], x = 11, y = 10): UnitState {
  return {
    id: 'enemy',
    factionId: 'B',
    kind,
    hp: 500,
    maxHp: 500,
    cell: { x, y },
    path: [],
    edgeProgress: 0,
  };
}
function visible(s: MatchState): MatchState {
  return { ...s, knowledge: updateFactionKnowledge(s) };
}
describe('F11 facilities', () => {
  it('keeps both crossing slots through dismantling and removes them on elimination', () => {
    let state = createMatch(42, { scenarioId: 'f11-facilities' });
    const site = state.map.crossingSites!.find(
      (entry) => entry.id === 'CROSS-RING-N',
    )!;
    state = {
      ...state,
      phase: 'running',
      crossings: state.crossings.map((crossing) =>
        crossing.siteId === site.id
          ? { ...crossing, owner: 'A', hp: 100, job: null }
          : crossing,
      ),
    };
    const anchor = { kind: 'crossing' as const, id: site.id };
    for (const kind of ['turret', 'mine'] as const) {
      const result = beginFacilityBuild(state, 'A', kind, anchor);
      expect(result.ok).toBe(true);
      state = result.state;
    }
    expect(
      new Set(
        state.facilities.map((entry) => `${entry.cell.x},${entry.cell.y}`),
      ).size,
    ).toBe(2);
    const dismantling: MatchState = {
      ...state,
      crossings: state.crossings.map((crossing) =>
        crossing.siteId === site.id
          ? {
              ...crossing,
              job: {
                kind: 'dismantle',
                builderUnitId: 'A-01',
                factionId: 'A',
                requiredTicks: 10,
                paidCostCenti: 0,
                progressTicks: 0,
              },
            }
          : crossing,
      ),
    };
    expect(cleanupFacilities(dismantling).facilities).toHaveLength(2);
    expect(
      beginFacilityBuild(dismantling, 'A', 'jammer', anchor),
    ).toMatchObject({ ok: false, state: dismantling });
    const eliminated = resolveMatchOutcome({
      ...state,
      factions: state.factions.map((faction) =>
        faction.id === 'A' ? { ...faction, ticketsCenti: 0 } : faction,
      ),
    });
    expect(
      eliminated.factions.find((entry) => entry.id === 'A')!.eliminatedAtTick,
    ).not.toBeNull();
    expect(eliminated.facilities).toEqual([]);
    const stale = { ...eliminated, facilities: state.facilities };
    expect(cleanupFacilities(stale).facilities).toEqual([]);
  });
  it('rejects locked research, duplicates, resource deficits and invalid anchors without mutation; charges once', () => {
    let s = fixture();
    const base = s.bases.find((b) => b.owner === 'A')!;
    const a = { kind: 'base' as const, id: base.id };
    const locked = {
      ...s,
      factions: s.factions.map((f) => ({ ...f, completedResearchIds: [] })),
    };
    const before = JSON.stringify(locked);
    expect(beginFacilityBuild(locked, 'A', 'turret', a)).toMatchObject({
      ok: false,
      reason: 'RESEARCH_REQUIRED',
    });
    expect(JSON.stringify(locked)).toBe(before);
    expect(
      validateFacilityBuild(s, 'A', 'turret', { kind: 'base', id: 'missing' }),
    ).toBe('FACILITY_ANCHOR_UNAVAILABLE');
    expect(
      beginFacilityBuild(
        { ...s, factions: s.factions.map((f) => ({ ...f, supplyCenti: 0 })) },
        'A',
        'turret',
        a,
      ),
    ).toMatchObject({ ok: false, reason: 'INSUFFICIENT_SUPPLY' });
    const r = applyCommand(s, 'A', {
      type: 'build-facility',
      kind: 'turret',
      anchor: a,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    expect(s.factions[0]!.supplyCenti).toBe(
      1000000 - s.rules.facilities.definitions.turret.costCenti,
    );
    expect(beginFacilityBuild(s, 'A', 'turret', a)).toMatchObject({
      ok: false,
      reason: 'FACILITY_DUPLICATE',
    });
    const t = s.rules.facilities.definitions.turret.buildTicks;
    for (let i = 0; i < t - 1; i++) s = advanceFacilities(s);
    expect(s.facilities[0]!.remainingBuildTicks).toBe(1);
    s = advanceFacilities(s);
    expect(s.facilities[0]!.remainingBuildTicks).toBe(0);
  });
  it('enforces slots and cap, and hidden enemy occupancy does not alter placement acceptance', () => {
    let s = fixture();
    const a = {
      kind: 'base' as const,
      id: s.bases.find((b) => b.owner === 'A')!.id,
    };
    let r = beginFacilityBuild(s, 'A', 'turret', a);
    if (!r.ok) throw Error(r.reason);
    s = r.state;
    r = beginFacilityBuild(s, 'A', 'antiAir', a);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    expect(validateFacilityBuild(s, 'A', 'mine', a)).toBe(
      'FACILITY_SLOTS_FULL',
    );
    expect(
      validateFacilityBuild(
        {
          ...s,
          rules: {
            ...s.rules,
            facilities: { ...s.rules.facilities, maxPerFaction: 2 },
          },
        },
        'A',
        'mine',
        a,
      ),
    ).toBe('FACILITY_LIMIT');
    const empty = fixture();
    const clean = beginFacilityBuild(empty, 'A', 'turret', a);
    expect(clean.ok).toBe(true);
    if (!clean.ok) return;
    const hidden = facility(
      'mine',
      'B',
      clean.state.facilities[0]!.cell.x,
      clean.state.facilities[0]!.cell.y,
    );
    const other = beginFacilityBuild(
      { ...empty, facilities: [hidden] },
      'A',
      'turret',
      a,
    );
    expect(other.ok).toBe(true);
    if (other.ok)
      expect(other.state.facilities.at(-1)!.cell).toEqual(
        clean.state.facilities[0]!.cell,
      );
  });
  it.each([
    ['turret', 'assault', 25],
    ['turret', 'patrolBoat', 20],
    ['antiAir', 'helicopter', 50],
  ] as const)(
    '%s deals domain-specific damage to %s',
    (kind, unitKind, damage) => {
      const s = visible({
        ...fixture(),
        elapsedTicks: 10,
        facilities: [facility(kind)],
        units: [enemy(unitKind)],
        bases: fixture().bases.map((b) => ({ ...b, cell: { x: 35, y: 35 } })),
      });
      const out = resolveCombat(s);
      expect(out.units[0]!.hp).toBe(500 - damage);
    },
  );
  it('unfinished facilities do not fire, nearby enemies detect completed mines and mines trigger only once', () => {
    const start = {
      ...fixture(),
      elapsedTicks: 10,
      facilities: [{ ...facility('mine'), remainingBuildTicks: 1 }],
      units: [enemy('assault')],
    };
    expect(resolveCombat(start).units[0]!.hp).toBe(500);
    const armed = visible({ ...start, facilities: [facility('mine')] });
    expect(getFactionView(armed, 'B').facilities.map(({ id }) => id)).toEqual([
      'mine-A',
    ]);
    const out = resolveCombat(armed);
    expect(out.units[0]!.hp).toBe(380);
    expect(out.facilities).toEqual([]);
    expect(resolveCombat(out).units[0]!.hp).toBe(380);
  });
  it('facilities take simultaneous structure damage while firing; local units do not target them', () => {
    const target = { ...facility('turret'), hp: 1 };
    const u = { ...enemy('assault'), cell: { x: 10, y: 10 } };
    const s = visible({
      ...fixture(),
      elapsedTicks: 10,
      units: [u],
      facilities: [target],
      bases: fixture().bases.map((b) => ({ ...b, cell: { x: 35, y: 35 } })),
    });
    const out = resolveCombat(s);
    expect(out.facilities).toHaveLength(0);
    expect(out.units[0]!.hp).toBe(475);
    expect(
      resolveCombat({ ...s, units: [{ ...u, factionId: 'local' }] })
        .facilities[0]!.hp,
    ).toBe(1);
  });
  it('removes facilities after anchor loss and pauses progress outside running phase', () => {
    const s = fixture();
    const a = {
      kind: 'base' as const,
      id: s.bases.find((b) => b.owner === 'A')!.id,
    };
    const r = beginFacilityBuild(s, 'A', 'watchtower', a);
    if (!r.ok) throw Error(r.reason);
    expect(stepMatch({ ...r.state, phase: 'paused' })).toEqual({
      ...r.state,
      phase: 'paused',
    });
    expect(
      cleanupFacilities({
        ...r.state,
        bases: r.state.bases.map((b) =>
          b.id === a.id ? { ...b, owner: 'B' as const } : b,
        ),
      }).facilities,
    ).toHaveLength(0);
  });
  it('watchtower expands vision; enemy jammer disables watchtower and stacks source radius reductions', () => {
    const initial = {
      ...fixture(),
      bases: [],
      units: [],
      facilities: [facility('watchtower')],
    };
    expect(isCellVisibleToFaction(initial, { x: 20, y: 10 }, 'A')).toBe(true);
    const jammed = {
      ...initial,
      facilities: [...initial.facilities, facility('jammer', 'B')],
    };
    expect(isCellVisibleToFaction(jammed, { x: 11, y: 10 }, 'A')).toBe(false);
    const viewer = { ...enemy('scout', 10, 10), factionId: 'A' as const };
    const target = enemy('assault', 13, 10);
    const unitState = {
      ...fixture(),
      bases: [],
      units: [viewer, target],
      facilities: [facility('jammer', 'B', 13, 10)],
    };
    expect(isUnitVisibleToFaction(unitState, target, 'A')).toBe(false);
  });
  it('hidden facility mutations do not alter faction view, and seen structures retain detached memory', () => {
    const s = visible({
      ...fixture(),
      facilities: [facility('turret', 'B', 20, 20)],
    });
    const before = getFactionView(s, 'A');
    const changed = visible({
      ...s,
      facilities: [{ ...s.facilities[0]!, hp: 1, cell: { x: 21, y: 21 } }],
    });
    expect(getFactionView(changed, 'A')).toEqual(before);
    const scout = { ...enemy('scout', 20, 20), factionId: 'A' as const };
    const seen = visible({ ...s, units: [scout] });
    expect(getFactionView(seen, 'A').facilities[0]!.visibility).toBe('visible');
    const hidden = visible({
      ...seen,
      units: [],
      facilities: [{ ...seen.facilities[0]!, hp: 1 }],
    });
    const memory = getFactionView(hidden, 'A').facilities[0]!;
    expect(memory.visibility).toBe('remembered');
    expect(memory.hp).toBe(300);
  });
  it('JSON state yields deterministic subsequent ticks', () => {
    const s = fixture();
    const a = {
      kind: 'base' as const,
      id: s.bases.find((b) => b.owner === 'A')!.id,
    };
    const r = beginFacilityBuild(s, 'A', 'turret', a);
    if (!r.ok) throw Error(r.reason);
    expect(
      stepMatch(JSON.parse(JSON.stringify(r.state)) as MatchState),
    ).toEqual(stepMatch(r.state));
  });
  it('preserves schema 12 saved research and capture settings while adding facilities', () => {
    const old = JSON.parse(JSON.stringify(DEFAULT_RULES)) as Record<
      string,
      unknown
    >;
    delete old.facilities;
    const research = old.research as {
      definitions: Record<string, { costCenti: number }>;
    };
    for (const id of Object.keys(research.definitions))
      if (id.startsWith('facility-')) delete research.definitions[id];
    research.definitions['firepower-1']!.costCenti = 12345;
    (old.capture as { restoredHpPercent: number }).restoredHpPercent = 65;
    const result = validateEnvelope({
      masterSchemaVersion: 12,
      revision: 9,
      rules: old,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      result.envelope.rules.research.definitions['firepower-1']!.costCenti,
    ).toBe(12345);
    expect(result.envelope.rules.capture.restoredHpPercent).toBe(65);
    expect(result.envelope.rules.facilities).toEqual(DEFAULT_RULES.facilities);
    expect(
      result.envelope.rules.research.definitions['facility-jammer'],
    ).toBeDefined();
  });
  it('build speed research halves time and upgraded anchors reject before charging', () => {
    const s = fixture();
    const a = {
      kind: 'base' as const,
      id: s.bases.find((b) => b.owner === 'A')!.id,
    };
    const improved = {
      ...s,
      factions: s.factions.map((f) => ({
        ...f,
        completedResearchIds: [
          ...f.completedResearchIds,
          'facility-engineering',
        ],
      })),
    };
    const result = beginFacilityBuild(improved, 'A', 'turret', a);
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.state.facilities[0]!.remainingBuildTicks).toBe(150);
    const busy = {
      ...s,
      bases: s.bases.map((b) =>
        b.id === a.id
          ? {
              ...b,
              upgradeJob: {
                targetLevel: 2 as const,
                costCenti: 100,
                remainingTicks: 10,
              },
            }
          : b,
      ),
    };
    expect(beginFacilityBuild(busy, 'A', 'turret', a)).toMatchObject({
      ok: false,
      state: busy,
      reason: 'BASE_UPGRADE_BUSY',
    });
  });
  it('two overlapping enemy jammer sources multiply radius and own warnings omit source positions', () => {
    const scout = { ...enemy('scout', 10, 10), factionId: 'A' as const };
    const jam = facility('jammer', 'B', 10, 10);
    const one = { ...fixture(), bases: [], units: [scout], facilities: [jam] };
    expect(isCellVisibleToFaction(one, { x: 13, y: 10 }, 'A')).toBe(true);
    const two = {
      ...one,
      facilities: [jam, { ...jam, id: 'second', cell: { x: 10, y: 11 } }],
    };
    expect(isCellVisibleToFaction(two, { x: 13, y: 10 }, 'A')).toBe(false);
    expect(getFactionView(visible(two), 'A').ownUnits[0]!.jammed).toBe(true);
  });
});
