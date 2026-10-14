import { describe, expect, it } from 'vitest';
import { applyTicketTick } from './tickets';
import { getFactionView } from './view';
import { advanceCapture } from './capture';
import { advanceLocalFaction } from './local-faction';
import { createMatch } from './match';
import { DEFAULT_RULES } from './rules';
import { stepMatch } from './step';
import type { MatchState } from './types';

function running(state: MatchState): MatchState {
  return { ...state, phase: 'running' };
}

const ENABLED_LOCAL_RULES = {
  ...DEFAULT_RULES,
  localFaction: { ...DEFAULT_RULES.localFaction, enabled: true },
};

describe('F06 local faction', () => {
  it('appears on the configured tick and owns no ranked faction slot when enabled', () => {
    let state = running(createMatch(42, { rules: ENABLED_LOCAL_RULES }));
    for (
      let tick = 0;
      tick < ENABLED_LOCAL_RULES.localFaction.appearanceTick;
      tick += 1
    )
      state = stepMatch(state);

    expect(state.elapsedTicks).toBe(300);
    expect(state.localFaction).toMatchObject({ active: true, defeated: false });
    expect(
      state.units.filter(({ factionId }) => factionId === 'local'),
    ).toHaveLength(2);
    expect(state.bases.find(({ id }) => id === 'OUT-02')?.owner).toBe('local');
    expect(state.factions.map(({ id }) => id)).toEqual(['A', 'B', 'C']);
    expect(state.result).toBeNull();
  });

  it('does not spawn stronghold, units, or advance when disabled by default (F16-07)', () => {
    let state = running(createMatch(42));
    expect(state.rules.localFaction.enabled).toBe(false);
    expect(state.localFaction.active).toBe(false);
    expect(state.localFaction.stronghold.hp).toBe(0);
    expect(
      state.units.filter(({ factionId }) => factionId === 'local'),
    ).toHaveLength(0);

    for (let tick = 0; tick < 350; tick += 1) {
      state = stepMatch(state);
    }
    expect(state.localFaction.active).toBe(false);
    expect(state.localFaction.stronghold.hp).toBe(0);
    expect(
      state.units.filter(({ factionId }) => factionId === 'local'),
    ).toHaveLength(0);

    const f06Default = createMatch(42, { scenarioId: 'f06-local-faction' });
    expect(f06Default.localFaction.active).toBe(false);
    expect(f06Default.localFaction.stronghold.hp).toBe(0);
    expect(
      f06Default.units.filter(({ factionId }) => factionId === 'local'),
    ).toHaveLength(0);
  });

  it('charges for deterministic spawns and respects the local unit cap', () => {
    const match = createMatch(42, {
      scenarioId: 'f06-local-faction',
      rules: ENABLED_LOCAL_RULES,
    });
    const due = {
      ...match,
      localFaction: {
        ...match.localFaction,
        nextSpawnTick: match.elapsedTicks,
      },
    };
    const spawned = advanceLocalFaction(due);
    expect(
      spawned.units.filter(({ factionId }) => factionId === 'local'),
    ).toHaveLength(3);
    expect(spawned.localFaction.supplyCenti).toBe(
      due.localFaction.supplyCenti - DEFAULT_RULES.localFaction.unitCostCenti,
    );
    expect(spawned.units.find(({ id }) => id === 'L-03')?.kind).toBe('scout');

    const capped = {
      ...due,
      units: Array.from(
        { length: DEFAULT_RULES.localFaction.maxUnits },
        (_, index) => ({
          ...due.units.find(({ factionId }) => factionId === 'local')!,
          id: `L-cap-${index}`,
        }),
      ),
    };
    const held = advanceLocalFaction(capped);
    expect(held.units).toHaveLength(DEFAULT_RULES.localFaction.maxUnits);
    expect(held.localFaction.supplyCenti).toBe(capped.localFaction.supplyCenti);
  });

  it('keeps local bases out of ticket pressure and hides unseen local units', () => {
    const match = createMatch(42, {
      scenarioId: 'f06-local-faction',
      rules: ENABLED_LOCAL_RULES,
    });
    const local = match.units.find(({ factionId }) => factionId === 'local')!;
    const withHiddenUnit = {
      ...match,
      units: [
        ...match.units,
        { ...local, id: 'L-hidden', cell: { x: 1, y: 1 } },
      ],
      elapsedTicks: match.rules.tickets.updateIntervalTicks,
    };
    const tickets = applyTicketTick(withHiddenUnit);
    expect(tickets.factions.map(({ ticketsCenti }) => ticketsCenti)).toEqual(
      match.factions.map(({ ticketsCenti }) => ticketsCenti),
    );
    expect(
      getFactionView(withHiddenUnit, 'A').localFaction.visibleUnitCount,
    ).toBe(2);
    expect(JSON.parse(JSON.stringify(withHiddenUnit))).toEqual(withHiddenUnit);
  });

  it('pays a local-base reclaim reward only once after standard capture', () => {
    const match = createMatch(42, { scenarioId: 'g2-capture' });
    const base = match.bases.find(({ id }) => id === 'OUT-03')!;
    const a = match.units.find(({ id }) => id === 'A-01')!;
    let state: MatchState = {
      ...match,
      units: [{ ...a, cell: { ...base.cell }, path: [], edgeProgress: 0 }],
      bases: match.bases.map((entry) =>
        entry.id === base.id
          ? {
              ...entry,
              owner: null,
              hp: 0,
              defender: null,
              conqueredFromLocal: true,
            }
          : entry,
      ),
    };
    for (let tick = 0; tick < state.rules.capture.requiredTicks; tick += 1)
      state = advanceCapture(state);
    const supplyAfterReclaim = state.factions.find(
      ({ id }) => id === 'A',
    )!.supplyCenti;
    const researchAfterReclaim = state.factions.find(
      ({ id }) => id === 'A',
    )!.researchCenti;
    state = advanceCapture(state);
    expect(state.bases.find(({ id }) => id === base.id)).toMatchObject({
      owner: 'A',
      conqueredFromLocal: false,
    });
    expect(state.localFaction.rewardedBaseIds).toContain(base.id);
    expect(state.factions.find(({ id }) => id === 'A')?.supplyCenti).toBe(
      supplyAfterReclaim,
    );
    expect(state.factions.find(({ id }) => id === 'A')?.researchCenti).toBe(
      researchAfterReclaim,
    );
  });
});
