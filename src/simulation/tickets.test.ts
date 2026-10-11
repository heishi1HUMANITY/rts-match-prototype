import { describe, expect, it } from 'vitest';
import { applyTicketTick } from './tickets';
import { createMatch } from './match';

describe('periodic ticket pressure', () => {
  it('charges factions by the other two factions weighted outpost count', () => {
    const state = createMatch(42);
    const ownership = { 'OUT-03': 'A' as const };
    const running = {
      ...state,
      elapsedTicks: 10,
      bases: state.bases.map((base) =>
        base.id in ownership
          ? {
              ...base,
              owner: ownership[base.id as keyof typeof ownership],
              hp: 100,
            }
          : base,
      ),
    };
    const next = applyTicketTick(running);
    expect(
      next.factions.map(({ id, ticketsCenti }) => [id, ticketsCenti]),
    ).toEqual([
      ['A', 100_000],
      ['B', 99_990],
      ['C', 99_990],
    ]);
  });

  it('does not reduce tickets for equal holdings or off-boundary ticks', () => {
    let state = createMatch(42);
    state = { ...state, elapsedTicks: 9 };
    expect(applyTicketTick(state)).toBe(state);
    state = { ...state, elapsedTicks: 10 };
    const equal = {
      ...state,
      bases: state.bases.map((base) =>
        base.kind === 'outpost'
          ? {
              ...base,
              owner:
                base.id === 'OUT-01'
                  ? ('A' as const)
                  : base.id === 'OUT-02'
                    ? ('B' as const)
                    : ('C' as const),
              hp: 100,
            }
          : base,
      ),
    };
    expect(
      applyTicketTick(equal).factions.map(({ ticketsCenti }) => ticketsCenti),
    ).toEqual([100_000, 100_000, 100_000]);
  });

  it('clamps tickets at zero without a victory or phase transition', () => {
    let state = createMatch(42);
    state = { ...state, elapsedTicks: 10, phase: 'running' };
    state = {
      ...state,
      bases: state.bases.map((base) =>
        base.id.startsWith('OUT-') ? { ...base, owner: 'A', hp: 100 } : base,
      ),
      factions: state.factions.map((faction) =>
        faction.id === 'C' ? { ...faction, ticketsCenti: 5 } : faction,
      ),
    };
    const next = applyTicketTick(state);
    expect(next.factions.find(({ id }) => id === 'C')?.ticketsCenti).toBe(0);
    expect(next.phase).toBe('running');
  });
});
