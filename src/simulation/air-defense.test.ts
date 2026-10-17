import { describe, expect, it } from 'vitest';
import { createMatch } from './match';
import {
  airDefenseDamagePercent,
  airDefenseRange,
  airDefenseRecognitionRadius,
} from './air-defense';
import { updateFactionKnowledge, isUnitVisibleToFaction } from './visibility';
import { stepMatch } from './step';
import type { MatchState, UnitState } from './types';

function controlledState(): MatchState {
  const match = createMatch(19, { mapId: 'ring-three-fronts-100' });
  const template = match.units[0]!;
  const helicopter: UnitState = {
    ...template,
    id: 'heli-A',
    factionId: 'A' as const,
    kind: 'helicopter' as const,
    cell: { x: 10, y: 10 },
    path: [],
    edgeProgress: 0,
    moveTicksPerCell: match.rules.units.helicopter.moveTicksPerCell,
  };
  const antiAir: UnitState = {
    ...template,
    id: 'aa-B',
    factionId: 'B' as const,
    kind: 'antiAir' as const,
    cell: { x: 35, y: 10 },
    path: [],
    edgeProgress: 0,
    moveTicksPerCell: match.rules.units.antiAir.moveTicksPerCell,
  };
  const scout: UnitState = {
    ...template,
    id: 'scout-B',
    factionId: 'B' as const,
    kind: 'scout' as const,
    cell: { x: 35, y: 10 },
    path: [],
    edgeProgress: 0,
  };
  return {
    ...match,
    units: [helicopter, antiAir, scout],
    bases: match.bases.map((base) => ({
      ...base,
      owner: null,
      cell: { x: 1, y: 1 },
    })),
  };
}

describe('air defense recognition and deployment', () => {
  it('keeps moving AA weak and makes its range and damage return after deployment', () => {
    const state = controlledState();
    let antiAir = state.units.find((unit) => unit.kind === 'antiAir')!;
    expect(airDefenseRange(state, antiAir)).toBe(2);
    expect(airDefenseDamagePercent(state, antiAir)).toBe(25);
    antiAir = {
      ...antiAir,
      stationaryTicks: state.rules.airDefense.deployTicks,
    };
    expect(airDefenseRange(state, antiAir)).toBe(4);
    expect(airDefenseDamagePercent(state, antiAir)).toBe(100);
  });

  it('detects only AA at an AA-specific radius and retains a last-seen memory', () => {
    const state = controlledState();
    const helicopter = state.units.find((unit) => unit.kind === 'helicopter')!;
    const antiAir = state.units.find((unit) => unit.kind === 'antiAir')!;
    const scout = state.units.find((unit) => unit.kind === 'scout')!;
    expect(
      airDefenseRecognitionRadius(state, antiAir, helicopter),
    ).toBeGreaterThan(8);
    expect(isUnitVisibleToFaction(state, antiAir, helicopter.factionId)).toBe(
      true,
    );
    expect(isUnitVisibleToFaction(state, scout, helicopter.factionId)).toBe(
      false,
    );

    const observed = {
      ...state,
      knowledge: updateFactionKnowledge(state),
    };
    const memory = observed.knowledge.find(
      ({ factionId }) => factionId === helicopter.factionId,
    )!.airDefenseMemory;
    expect(memory).toEqual([
      expect.objectContaining({ unitId: antiAir.id, cell: antiAir.cell }),
    ]);

    const movedAway = {
      ...observed,
      elapsedTicks: 1,
      units: observed.units.map((unit) =>
        unit.id === antiAir.id ? { ...unit, cell: { x: 100, y: 100 } } : unit,
      ),
    };
    expect(
      isUnitVisibleToFaction(
        movedAway,
        movedAway.units.find((unit) => unit.id === antiAir.id)!,
        helicopter.factionId,
      ),
    ).toBe(false);
    const remembered = updateFactionKnowledge(movedAway).find(
      ({ factionId }) => factionId === helicopter.factionId,
    )!.airDefenseMemory;
    expect(remembered).toEqual(memory);
  });

  it('includes vision research in the recognition boundary and honors jammed grace', () => {
    const state = controlledState();
    const helicopter = state.units.find((unit) => unit.kind === 'helicopter')!;
    const antiAir = state.units.find((unit) => unit.kind === 'antiAir')!;
    const faction = state.factions.find(
      ({ id }) => id === helicopter.factionId,
    )!;
    const researched = {
      ...state,
      factions: state.factions.map((entry) =>
        entry.id === faction.id
          ? { ...entry, completedResearchIds: ['survey-1'] }
          : entry,
      ),
    };
    expect(
      airDefenseRecognitionRadius(researched, antiAir, helicopter),
    ).toBeGreaterThan(airDefenseRecognitionRadius(state, antiAir, helicopter));
    const jammed = {
      ...state,
      factions: state.factions.map((entry) =>
        entry.id === faction.id ? { ...entry, jammedUntilTick: 10 } : entry,
      ),
    };
    expect(
      airDefenseRecognitionRadius(jammed, antiAir, helicopter),
    ).toBeLessThan(airDefenseRecognitionRadius(state, antiAir, helicopter));
  });

  it.each([
    { label: 'normal', researched: false, jammed: false, minimum: 30 },
    {
      label: 'maximum vision research',
      researched: true,
      jammed: false,
      fastest: false,
      minimum: 30,
    },
    {
      label: 'maximum movement speed',
      researched: false,
      jammed: false,
      fastest: true,
      minimum: 30,
    },
    {
      label: 'jammed',
      researched: false,
      jammed: true,
      fastest: false,
      minimum: 10,
    },
  ])(
    'gives the helicopter at least $minimum ticks from AA discovery to first damage ($label)',
    ({ researched, jammed, fastest = false, minimum }) => {
      let state = controlledState();
      const helicopter: UnitState = {
        ...state.units.find((unit) => unit.kind === 'helicopter')!,
        cell: { x: 0, y: 10 },
        path: Array.from({ length: 35 }, (_, index) => ({
          x: index + 1,
          y: 10,
        })),
        edgeProgress: 0,
        ...(fastest ? { moveTicksPerCell: 1 } : {}),
        moveTarget: { x: 35, y: 10 },
      };
      const antiAir: UnitState = {
        ...state.units.find((unit) => unit.kind === 'antiAir')!,
        cell: { x: 35, y: 10 },
        stationaryTicks: state.rules.airDefense.deployTicks,
      };
      state = {
        ...state,
        phase: 'running',
        factions: state.factions.map((faction) =>
          faction.id === 'A'
            ? {
                ...faction,
                completedResearchIds: researched
                  ? ['survey-1', 'survey-2', 'specialization-information']
                  : [],
                jammedUntilTick: jammed ? 100 : 0,
              }
            : faction,
        ),
        units: [helicopter, antiAir],
      };
      state = { ...state, knowledge: updateFactionKnowledge(state) };
      const originalHp = helicopter.hp;
      let firstSeenTick =
        state.knowledge.find(({ factionId }) => factionId === 'A')
          ?.airDefenseMemory?.[0]?.seenTick ?? null;
      let firstDamageTick: number | null = null;
      for (let tick = 0; tick < 100 && firstDamageTick === null; tick += 1) {
        state = stepMatch(state);
        const aaMemory = state.knowledge.find(
          ({ factionId }) => factionId === 'A',
        )?.airDefenseMemory;
        if (firstSeenTick === null && aaMemory?.[0])
          firstSeenTick = aaMemory[0].seenTick;
        if (
          state.units.find((unit) => unit.id === helicopter.id)!.hp < originalHp
        )
          firstDamageTick = state.elapsedTicks;
      }
      expect(firstSeenTick).not.toBeNull();
      expect(firstDamageTick).not.toBeNull();
      expect(firstDamageTick! - firstSeenTick!).toBeGreaterThanOrEqual(minimum);
    },
  );
});
