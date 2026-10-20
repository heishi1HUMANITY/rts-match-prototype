import { describe, expect, it } from 'vitest';
import { applyTicketTick } from './tickets';
import { createMatch } from './match';
import { DEFAULT_RULES } from './rules';

// These cases pin the decay mechanism on the original 300-ticket, 3000-6000 tick curve.
const CURVE_RULES = {
  ...DEFAULT_RULES,
  match: { ...DEFAULT_RULES.match, initialTicketsCenti: 30_000 },
  tickets: {
    ...DEFAULT_RULES.tickets,
    decay: { ...DEFAULT_RULES.tickets.decay, startTick: 3000, endTick: 6000 },
  },
};

describe('periodic ticket pressure', () => {
  it('charges factions by the other two factions weighted outpost count', () => {
    const state = createMatch(42, { rules: CURVE_RULES });
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
      ['A', 30_000],
      ['B', 29_990],
      ['C', 29_990],
    ]);
  });

  it('does not reduce tickets for equal holdings or off-boundary ticks', () => {
    let state = createMatch(42, { rules: CURVE_RULES });
    state = { ...state, elapsedTicks: 9 };
    expect(applyTicketTick(state)).toBe(state);
    state = { ...state, elapsedTicks: 10 };
    const equal = {
      ...state,
      bases: state.bases.map((base) =>
        base.id.startsWith('HOME-')
          ? { ...base, owner: base.id.slice(-1) as 'A' | 'B' | 'C', hp: 100 }
          : { ...base, owner: null, hp: 0 },
      ),
    };
    expect(
      applyTicketTick(equal).factions.map(({ ticketsCenti }) => ticketsCenti),
    ).toEqual([30_000, 30_000, 30_000]);
  });

  it('clamps tickets at zero without a victory or phase transition', () => {
    let state = createMatch(42, { rules: CURVE_RULES });
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

  describe('F16 decay curve and territory multiplier', () => {
    it('applies zero base decay before 5 minutes (3000 ticks)', () => {
      let state = createMatch(42, { rules: CURVE_RULES });
      state = { ...state, elapsedTicks: 2990, phase: 'running' };
      const next = applyTicketTick(state);
      expect(next.factions.map(({ ticketsCenti }) => ticketsCenti)).toEqual([
        30_000, 30_000, 30_000,
      ]);
    });

    it('applies intermediate decay at 7.5 minutes (4500 ticks)', () => {
      let state = createMatch(42, { rules: CURVE_RULES });
      state = { ...state, elapsedTicks: 4500, phase: 'running' };
      // at 4500 ticks: base decay is 3 + (15 - 3) * (4500 - 3000) / 3000 = 9 centi/tick
      // for 10 ticks: 9 * 10 = 90 centi
      const next = applyTicketTick(state);
      expect(next.factions.map(({ ticketsCenti }) => ticketsCenti)).toEqual([
        29_910, 29_910, 29_910,
      ]);
    });

    it('caps decay at 15 centi/tick at and after 10 minutes (6000 ticks)', () => {
      let state = createMatch(42, { rules: CURVE_RULES });
      state = { ...state, elapsedTicks: 6000, phase: 'running' };
      // at 6000 ticks: base decay is 15 centi/tick -> 15 * 10 = 150 centi
      const next = applyTicketTick(state);
      expect(next.factions.map(({ ticketsCenti }) => ticketsCenti)).toEqual([
        29_850, 29_850, 29_850,
      ]);

      // later tick (7000 ticks) still decays at 15 centi/tick
      const state7000 = { ...state, elapsedTicks: 7000 };
      const next7000 = applyTicketTick(state7000);
      expect(next7000.factions.map(({ ticketsCenti }) => ticketsCenti)).toEqual(
        [29_850, 29_850, 29_850],
      );
    });

    it('clamps territory multiplier between 50% and 200%', () => {
      let state = createMatch(42, { rules: CURVE_RULES });
      state = {
        ...state,
        elapsedTicks: 6000,
        phase: 'running',
        bases: state.bases.map((base) => {
          if (base.kind === 'hq') return base;
          // give almost all outposts to A
          return { ...base, owner: 'A' as const, hp: 100 };
        }),
      };
      // A has huge territory -> multiplier clamped to 50%
      // B and C have 0 outposts -> multiplier clamped to 200%
      // base decay is 15 centi/tick -> for 10 ticks, base is 150 centi
      // A decay: 150 * 50% = 75 centi
      // B/C decay: 150 * 200% = 300 centi + penalty for outpost diff (A has extra weight)
      const next = applyTicketTick(state);
      const factionA = next.factions.find((f) => f.id === 'A')!;
      expect(30_000 - factionA.ticketsCenti).toBe(75);
    });

    it('ensures all factions decay towards zero even in full equilibrium', () => {
      let state = createMatch(42, { rules: CURVE_RULES });
      state = {
        ...state,
        elapsedTicks: 3000,
        phase: 'running',
      };
      // Advance by 10-tick steps from 3000 to 6000 (300 steps)
      for (let t = 3010; t <= 6000; t += 10) {
        state = { ...state, elapsedTicks: t };
        state = applyTicketTick(state);
      }
      // All factions should have strictly decreased and remain equal
      const [a, b, c] = state.factions.map((f) => f.ticketsCenti);
      expect(a).toBe(b);
      expect(b).toBe(c);
      expect(a).toBeLessThan(30_000);
      expect(a).toBeGreaterThan(0);
    });
  });

  it('waits for the territory grace period before charging territory pressure', () => {
    const graced = (elapsedTicks: number) => {
      const state = createMatch(42, {
        rules: {
          ...CURVE_RULES,
          tickets: { ...CURVE_RULES.tickets, territoryGraceTicks: 600 },
        },
      });
      const running = {
        ...state,
        elapsedTicks,
        bases: state.bases.map((base) =>
          base.id === 'OUT-03'
            ? { ...base, owner: 'A' as const, hp: 100 }
            : base,
        ),
      };
      return applyTicketTick(running).factions.map(
        ({ ticketsCenti }) => ticketsCenti,
      );
    };
    expect(graced(590)).toEqual([30_000, 30_000, 30_000]);
    expect(graced(600)).toEqual([30_000, 29_990, 29_990]);
  });
});
