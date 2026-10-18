import { describe, expect, it } from 'vitest';
import { createMatch } from './match';
import type { FactionView, MatchState } from './types';
import { estimateCombat } from './combat-estimate';
import { getFactionView } from './view';
import { resolveCombat } from './combat';

function estimateFixture(): FactionView {
  const state = createMatch(71);
  const base = getFactionView(state, 'A');
  const own = base.ownUnits.find((unit) => unit.kind === 'assault')!;
  const enemyCell = { x: own.cell.x + 1, y: own.cell.y };
  return {
    ...base,
    visibleEnemies: [
      {
        control: 'enemy',
        id: 'visible-enemy',
        factionId: 'B',
        kind: 'assault',
        positionX1024: enemyCell.x * 1024 + 512,
        positionY1024: enemyCell.y * 1024 + 512,
        hp: 60,
        maxHp: 200,
      },
    ],
  };
}

describe('observation-limited combat estimate', () => {
  it('matches a directly stepped, static real match when the stated assumptions hold', () => {
    const state = createMatch(77, { scenarioId: 'f88-combat-estimate' });
    const view = getFactionView(state, 'A');
    const own = view.ownUnits.find(({ id }) => id === 'A-01')!;
    const destination = { x: own.cell.x + 4, y: own.cell.y };
    const estimate = estimateCombat(view, [own.id], destination);
    let actual: MatchState = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: destination } : unit,
      ),
    };
    let ticks = 0;
    const ended = () =>
      !actual.units.some((unit) => unit.id === 'A-01' && unit.hp > 0) ||
      !actual.units.some((unit) => unit.id === 'B-01' && unit.hp > 0);
    while (!ended() && ticks < view.rules.combatEstimate.maxTicks) {
      actual = resolveCombat({ ...actual, elapsedTicks: ticks });
      ticks += 1;
    }
    expect(estimate.ticks).toBe(ticks);
    expect(estimate.ownLost).toBe(
      200 - Math.max(0, actual.units.find(({ id }) => id === 'A-01')?.hp ?? 0),
    );
    expect(estimate.status).toBe('favorable');
  });

  it('shows the measurable damage error caused by an enemy private research assumption', () => {
    const state = createMatch(79, { scenarioId: 'f88-combat-estimate' });
    const hiddenResearchState = {
      ...state,
      factions: state.factions.map((faction) =>
        faction.id === 'B'
          ? { ...faction, completedResearchIds: ['firepower-1'] }
          : faction,
      ),
    };
    const view = getFactionView(hiddenResearchState, 'A');
    const own = view.ownUnits.find(({ id }) => id === 'A-01')!;
    const destination = { x: own.cell.x + 4, y: own.cell.y };
    const estimate = estimateCombat(view, [own.id], destination);
    let actual: MatchState = {
      ...hiddenResearchState,
      units: hiddenResearchState.units.map((unit) =>
        unit.id === 'A-01' ? { ...unit, cell: destination } : unit,
      ),
    };
    let ticks = 0;
    while (
      actual.units.every((unit) => unit.id !== 'A-01' || unit.hp > 0) &&
      actual.units.every((unit) => unit.id !== 'B-01' || unit.hp > 0) &&
      ticks < view.rules.combatEstimate.maxTicks
    ) {
      actual = resolveCombat({ ...actual, elapsedTicks: ticks });
      ticks += 1;
    }
    const actualOwnHp = Math.max(
      0,
      actual.units.find(({ id }) => id === 'A-01')?.hp ?? 0,
    );
    expect(estimate.status).toBe('favorable');
    expect(estimate.ownLost).toBe(120);
    expect(200 - actualOwnHp).toBe(126);
  });

  it('is deterministic, bounded, and leaves the input view unchanged', () => {
    const view = estimateFixture();
    const before = JSON.stringify(view);
    const unit = view.ownUnits.find(({ kind }) => kind === 'assault')!;
    const first = estimateCombat(view, [unit.id], unit.cell);
    const second = estimateCombat(view, [unit.id], unit.cell);

    expect(first).toEqual(second);
    expect(first.status).not.toBe('unavailable');
    expect(first.threatsIncluded).toBe(1);
    expect(first.ticks).toBeGreaterThan(0);
    expect(first.ticks).toBeLessThanOrEqual(view.rules.combatEstimate.maxTicks);
    expect(JSON.stringify(view)).toBe(before);
  });

  it('rejects a formation that would leave the map instead of clamping it', () => {
    const view = estimateFixture();
    const unit = view.ownUnits.find(({ kind }) => kind === 'assault')!;
    const result = estimateCombat(view, [unit.id], { x: -1, y: unit.cell.y });
    expect(result.status).toBe('unavailable');
    expect(result.reason).toContain('盤外');
  });

  it('includes visible base defenders and facilities while only noting remembered facilities', () => {
    const original = estimateFixture();
    const unit = original.ownUnits.find(({ kind }) => kind === 'assault')!;
    const nearbyCell = { x: unit.cell.x + 2, y: unit.cell.y };
    const view: FactionView = {
      ...original,
      tick: 100,
      bases: [
        {
          visibility: 'visible',
          id: 'visible-base',
          kind: 'outpost',
          cell: nearbyCell,
          owner: 'B',
          hp: 100,
          maxHp: 200,
          level: 1,
          captureCandidate: null,
          captureProgressCentiTicks: 0,
          defenderHp: 40,
          defenderMaxHp: 40,
        },
      ],
      facilities: [
        {
          visibility: 'visible',
          id: 'visible-turret',
          kind: 'turret',
          owner: 'B',
          anchor: { kind: 'base', id: 'visible-base' },
          slot: 0,
          cell: { x: nearbyCell.x + 1, y: nearbyCell.y },
          hp: 100,
          maxHp: 100,
          remainingBuildTicks: 0,
          lastDamagedTick: 0,
          lastActivatedTick: 0,
        },
        {
          visibility: 'remembered',
          seenTick: 10,
          id: 'remembered-turret',
          kind: 'turret',
          owner: 'B',
          anchor: { kind: 'base', id: 'visible-base' },
          slot: 1,
          cell: { x: nearbyCell.x, y: nearbyCell.y + 1 },
          hp: 100,
          maxHp: 100,
          remainingBuildTicks: 0,
          lastDamagedTick: 0,
          lastActivatedTick: 0,
        },
      ],
    };
    const estimate = estimateCombat(view, [unit.id], unit.cell);
    expect(estimate.threatsIncluded).toBe(4);
    expect(estimate.memoryNotes).toContain(
      `施設 turret · 90tick前の記憶（予測対象外）`,
    );
  });

  it('uses the real anti-air damage matrix against a selected helicopter', () => {
    const original = estimateFixture();
    const baseUnit = original.ownUnits[0]!;
    const helicopter = {
      ...baseUnit,
      id: 'A-helicopter',
      kind: 'helicopter' as const,
      hp: 180,
      maxHp: 180,
      cell: { ...baseUnit.cell },
    };
    const view: FactionView = {
      ...original,
      ownUnits: [helicopter],
      visibleEnemies: [
        {
          control: 'enemy',
          id: 'visible-aa',
          factionId: 'B',
          kind: 'antiAir',
          positionX1024: (helicopter.cell.x + 2) * 1024 + 512,
          positionY1024: helicopter.cell.y * 1024 + 512,
          hp: 180,
          maxHp: 180,
        },
      ],
    };
    const estimate = estimateCombat(view, [helicopter.id], helicopter.cell);
    expect(estimate.status).toBe('favorable');
    expect(estimate.ownLost).toBeGreaterThan(0);
    expect(estimate.threatsRemaining).toBe(0);
  });

  it('resolves simultaneous lethal damage without granting an order advantage', () => {
    const original = estimateFixture();
    const assault = original.ownUnits.find(({ kind }) => kind === 'assault')!;
    const view: FactionView = {
      ...original,
      ownUnits: [{ ...assault, hp: 20 }],
      visibleEnemies: [
        {
          ...original.visibleEnemies[0]!,
          hp: 20,
        },
      ],
    };
    const estimate = estimateCombat(view, [assault.id], assault.cell);
    expect(estimate.ticks).toBe(1);
    expect(estimate.ownLost).toBe(20);
    expect(estimate.ownRemaining).toBe(0);
    expect(estimate.threatsRemaining).toBe(0);
    expect(estimate.status).toBe('unfavorable');
  });

  it('stops at the configured finite horizon', () => {
    const original = estimateFixture();
    const assault = original.ownUnits.find(({ kind }) => kind === 'assault')!;
    const view: FactionView = {
      ...original,
      rules: {
        ...original.rules,
        combatEstimate: { maxTicks: 10 },
      },
      visibleEnemies: [
        {
          ...original.visibleEnemies[0]!,
          hp: 100_000,
          maxHp: 100_000,
        },
      ],
    };
    const estimate = estimateCombat(view, [assault.id], assault.cell);
    expect(estimate.status).toBe('unresolved');
    expect(estimate.ticks).toBeNull();
    expect(estimate.reason).toContain('上限');
  });

  it('does not incorporate hidden enemy units or private research', () => {
    const state = createMatch(73);
    const view = getFactionView(state, 'A');
    const changedHiddenState = {
      ...state,
      units: state.units.map((unit) =>
        unit.factionId === 'B' && unit.kind === 'assault'
          ? { ...unit, hp: unit.hp - 1, cell: { x: 38, y: 38 } }
          : unit,
      ),
      factions: state.factions.map((faction) =>
        faction.id === 'B'
          ? { ...faction, completedResearchIds: ['firepower-1'] }
          : faction,
      ),
    };
    const changedView = getFactionView(changedHiddenState, 'A');
    expect(changedView.visibleEnemies).toEqual(view.visibleEnemies);
    const unit = view.ownUnits[0]!;
    expect(estimateCombat(view, [unit.id], unit.cell)).toEqual(
      estimateCombat(changedView, [unit.id], unit.cell),
    );
  });
});
