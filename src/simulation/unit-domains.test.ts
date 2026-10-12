import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { findPath } from './pathfinding';
import { advanceCapture } from './capture';
import { resolveCombat } from './combat';
import { createMatch } from './match';
import { stepMatch } from './step';
import { advanceProduction } from './production';
import { updateFactionKnowledge } from './visibility';
import type { MatchState, UnitKind } from './types';

function started(): MatchState {
  const state = createMatch(42, { scenarioId: 'f08-unit-domains' });
  const result = applyCommand(state, 'A', { type: 'start' });
  if (!result.ok) throw new Error('match did not start');
  return result.state;
}

function issue(state: MatchState, command: unknown): MatchState {
  const result = applyCommand(state, 'A', command);
  if (!result.ok) throw new Error(`command rejected: ${result.reason}`);
  return result.state;
}

describe('F08 unit domains and roles', () => {
  it('uses direct air routes and confines water routes to connected river cells', () => {
    const state = createMatch(42);
    const flight = findPath(
      state.map,
      { x: 0, y: 0 },
      { x: 8, y: 5 },
      { domain: 'air' },
    );
    expect(flight).toHaveLength(8);
    expect(flight?.at(-1)).toEqual({ x: 8, y: 5 });
    const port = state.map.ports![0]!;
    expect(
      findPath(state.map, port.cell, port.shore, { domain: 'water' }),
    ).toBeNull();
    const otherRiver = state.map.terrain!.flatMap((kind, index) =>
      kind === 'river' && index !== port.cell.y * state.map.width + port.cell.x
        ? [
            {
              x: index % state.map.width,
              y: Math.floor(index / state.map.width),
            },
          ]
        : [],
    );
    expect(
      otherRiver.some(
        (cell) =>
          findPath(state.map, port.cell, cell, { domain: 'water' }) !== null,
      ),
    ).toBe(true);
  });

  it('requires the registered unlock research and atomically produces a patrol boat at its port', () => {
    let state = started();
    const rejected = applyCommand(state, 'A', {
      type: 'enqueue-production',
      baseId: 'PORT-A',
      unitKind: 'patrolBoat',
    });
    expect(rejected).toMatchObject({
      ok: false,
      reason: 'RESEARCH_REQUIRED',
      state,
    });
    state = issue(state, { type: 'start-research', researchId: 'naval-1' });
    expect(state.factions[0]!.completedResearchIds).toContain('naval-1');
    const before = state.factions[0]!.supplyCenti;
    state = issue(state, {
      type: 'enqueue-production',
      baseId: 'PORT-A',
      unitKind: 'patrolBoat',
    });
    expect(state.factions[0]!.supplyCenti).toBe(
      before - state.rules.units.patrolBoat.costCenti,
    );
    for (
      let tick = 0;
      tick < state.rules.units.patrolBoat.buildTicks;
      tick += 1
    )
      state = advanceProduction(state);
    const boat = state.units.find(({ kind }) => kind === 'patrolBoat');
    expect(boat?.cell).toEqual(
      state.map.ports!.find(({ id }) => id === 'PORT-A')!.cell,
    );
  });

  it('prefers an in-range helicopter over a closer land unit for anti-air fire', () => {
    let state = started();
    const units = state.units.map((unit) =>
      unit.id === 'A-01'
        ? {
            ...unit,
            kind: 'antiAir' as UnitKind,
            cell: { x: 10, y: 10 },
            hp: 90,
            maxHp: 90,
          }
        : unit.id === 'B-01'
          ? { ...unit, cell: { x: 11, y: 10 } }
          : unit.id === 'B-02'
            ? {
                ...unit,
                kind: 'helicopter' as UnitKind,
                cell: { x: 12, y: 10 },
                hp: 90,
                maxHp: 90,
              }
            : unit,
    );
    state = { ...state, units };
    state = { ...state, knowledge: updateFactionKnowledge(state) };
    const beforeGround = state.units.find(({ id }) => id === 'B-01')!.hp;
    const beforeAir = state.units.find(({ id }) => id === 'B-02')!.hp;
    const after = resolveCombat(state);
    expect(after.units.find(({ id }) => id === 'B-01')!.hp).toBe(beforeGround);
    expect(after.units.find(({ id }) => id === 'B-02')!.hp).toBeLessThan(
      beforeAir,
    );
  });

  it('does not allow aircraft or boats to capture bases and heals only at HQ on the recovery pulse', () => {
    let state = started();
    const target = state.bases.find(({ id }) => id === 'OUT-01')!;
    state = {
      ...state,
      elapsedTicks: 9,
      bases: state.bases.map((base) =>
        base.id === target.id ? { ...base, hp: 0, defender: null } : base,
      ),
      units: state.units.map((unit) =>
        unit.id === 'A-01'
          ? {
              ...unit,
              kind: 'helicopter' as UnitKind,
              cell: target.cell,
              hp: 50,
              maxHp: 100,
              path: [],
            }
          : unit.id === 'A-02'
            ? { ...unit, cell: { x: 6, y: 34 }, hp: 50, path: [] }
            : unit,
      ),
    };
    const captured = advanceCapture(state);
    expect(captured.bases.find(({ id }) => id === target.id)?.owner).toBeNull();
    const recovered = stepMatch(state);
    expect(recovered.units.find(({ id }) => id === 'A-02')?.hp).toBe(53);
    expect(recovered.units.find(({ id }) => id === 'A-01')?.hp).toBe(50);
  });
});
