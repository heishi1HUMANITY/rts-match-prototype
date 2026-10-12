import { cancelAllProductionForDestroyedHq } from './production';
import { firepowerBonus } from './research';
import { visibleMarchCombatTarget } from './march';
import { activeCrossings } from './crossings';
import {
  getUnitPositionX1024,
  getUnitPositionY1024,
  isCellVisibleToFaction,
  isUnitVisibleToFaction,
} from './visibility';
import type { BaseState, FactionId, MatchState, UnitState } from './types';

interface Target {
  readonly kind: 'unit' | 'base' | 'crossing';
  readonly id: string;
  readonly distanceSquared: number;
}

function distanceSquared(
  ax2: number,
  ay2: number,
  bx2: number,
  by2: number,
): number {
  const dx = ax2 - bx2;
  const dy = ay2 - by2;
  return dx * dx + dy * dy;
}

function compareTarget(a: Target, b: Target): number {
  if (a.distanceSquared !== b.distanceSquared) {
    return a.distanceSquared - b.distanceSquared;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function baseIsVisible(
  state: MatchState,
  base: BaseState,
  factionId: FactionId,
): boolean {
  return isCellVisibleToFaction(state, base.cell, factionId);
}

function selectTarget(state: MatchState, attacker: UnitState): Target | null {
  const x2 = getUnitPositionX1024(attacker);
  const y2 = getUnitPositionY1024(attacker);
  const range = state.rules.units[attacker.kind].range;
  const rangeSquared = (1024 * range) ** 2;
  const preferred = visibleMarchCombatTarget(state, attacker);
  if (preferred?.kind === 'unit') {
    const target = state.units.find(({ id }) => id === preferred.id);
    if (target !== undefined) {
      return {
        kind: 'unit',
        id: target.id,
        distanceSquared: distanceSquared(
          x2,
          y2,
          getUnitPositionX1024(target),
          getUnitPositionY1024(target),
        ),
      };
    }
  } else if (preferred?.kind === 'base') {
    const base = state.bases.find(({ id }) => id === preferred.id);
    if (base !== undefined) {
      return {
        kind: 'base',
        id: base.id,
        distanceSquared: distanceSquared(
          x2,
          y2,
          1024 * base.cell.x + 512,
          1024 * base.cell.y + 512,
        ),
      };
    }
  }
  const units = state.units
    .filter(
      (target) => target.factionId !== attacker.factionId && target.hp > 0,
    )
    .filter((target) =>
      isUnitVisibleToFaction(state, target, attacker.factionId),
    )
    .map(
      (target): Target => ({
        kind: 'unit',
        id: target.id,
        distanceSquared: distanceSquared(
          x2,
          y2,
          getUnitPositionX1024(target),
          getUnitPositionY1024(target),
        ),
      }),
    )
    .filter(({ distanceSquared: distance }) => distance <= rangeSquared)
    .sort(compareTarget);
  if (units[0]) return units[0];
  const bases = state.bases
    .filter(
      (base) =>
        base.owner !== null && base.owner !== attacker.factionId && base.hp > 0,
    )
    .filter((base) => baseIsVisible(state, base, attacker.factionId))
    .map(
      (base): Target => ({
        kind: 'base',
        id: base.id,
        distanceSquared: distanceSquared(
          x2,
          y2,
          1024 * base.cell.x + 512,
          1024 * base.cell.y + 512,
        ),
      }),
    )
    .filter(({ distanceSquared: distance }) => distance <= rangeSquared)
    .sort(compareTarget);
  if (bases[0]) return bases[0];

  return (
    activeCrossings(state)
      .filter((crossing) => crossing.owner !== attacker.factionId)
      .filter((crossing) =>
        crossing.cells.some((cell) =>
          isCellVisibleToFaction(state, cell, attacker.factionId),
        ),
      )
      .map((crossing): Target => {
        const center =
          crossing.cells[Math.floor(crossing.cells.length / 2)] ??
          crossing.bankA;
        return {
          kind: 'crossing',
          id: crossing.id,
          distanceSquared: distanceSquared(
            x2,
            y2,
            1024 * center.x + 512,
            1024 * center.y + 512,
          ),
        };
      })
      .filter(({ distanceSquared: distance }) => distance <= rangeSquared)
      .sort(compareTarget)[0] ?? null
  );
}

/** Applies one simultaneous damage snapshot, then finalizes deaths and losses. */
export function resolveCombat(state: MatchState): MatchState {
  const snapshot = state;
  const unitDamage = new Map<string, number>();
  const baseDamage = new Map<string, number>();
  const crossingDamage = new Map<string, Map<FactionId, number>>();
  for (const attacker of snapshot.units) {
    if (attacker.hp <= 0) continue;
    const target = selectTarget(snapshot, attacker);
    if (!target) continue;
    const faction = snapshot.factions.find(
      ({ id }) => id === attacker.factionId,
    );
    const damage =
      snapshot.rules.units[attacker.kind].baseDamage +
      (faction ? firepowerBonus(faction, snapshot.rules) : 0);
    if (target.kind === 'unit') {
      unitDamage.set(target.id, (unitDamage.get(target.id) ?? 0) + damage);
    } else if (target.kind === 'base') {
      baseDamage.set(target.id, (baseDamage.get(target.id) ?? 0) + damage);
    } else {
      const byFaction =
        crossingDamage.get(target.id) ?? new Map<FactionId, number>();
      byFaction.set(
        attacker.factionId,
        (byFaction.get(attacker.factionId) ?? 0) + damage,
      );
      crossingDamage.set(target.id, byFaction);
    }
  }

  let unitLosses = new Map<FactionId, number>();
  const units = snapshot.units
    .map((unit) => {
      const damage = unitDamage.get(unit.id) ?? 0;
      if (damage <= 0) return unit;
      const hp = Math.max(0, unit.hp - damage);
      if (hp === 0)
        unitLosses.set(
          unit.factionId,
          (unitLosses.get(unit.factionId) ?? 0) + 1,
        );
      return { ...unit, hp };
    })
    .filter(({ hp }) => hp > 0);

  const destroyedHqs = new Set<FactionId>();
  const bases = snapshot.bases.map((base) => {
    const damage = baseDamage.get(base.id) ?? 0;
    if (damage <= 0 || base.hp <= 0) return base;
    const hp = Math.max(0, base.hp - damage);
    if (hp > 0) return { ...base, hp };
    if (base.kind === 'hq') {
      if (base.homeFactionId) destroyedHqs.add(base.homeFactionId);
      return { ...base, hp: 0, captureCandidate: null, captureTicks: 0 };
    }
    return {
      ...base,
      owner: null,
      hp: 0,
      captureCandidate: null,
      captureTicks: 0,
    };
  });

  const crossings = snapshot.crossings.map((crossing) => {
    const byFaction = crossingDamage.get(crossing.siteId);
    if (!byFaction || crossing.hp <= 0 || crossing.owner === null)
      return crossing;
    const damage = [...byFaction.values()].reduce(
      (sum, value) => sum + value,
      0,
    );
    const hp = Math.max(0, crossing.hp - damage);
    if (hp > 0)
      return { ...crossing, hp, lastDamagedTick: snapshot.elapsedTicks };
    const ranked = [...byFaction.entries()].sort((a, b) => b[1] - a[1]);
    const winner = ranked[0];
    const tied = winner !== undefined && ranked[1]?.[1] === winner[1];
    if (!winner || tied)
      return {
        ...crossing,
        owner: null,
        hp: 0,
        maxHp: 0,
        job: null,
        lastDamagedTick: snapshot.elapsedTicks,
      };
    const site = snapshot.map.crossingSites?.find(
      ({ id }) => id === crossing.siteId,
    );
    const maxHp = site
      ? snapshot.rules.crossings[site.tier].maxHp
      : crossing.maxHp;
    return {
      ...crossing,
      owner: winner[0],
      hp: Math.max(1, Math.floor(maxHp * 0.3)),
      maxHp,
      job: null,
      lastDamagedTick: snapshot.elapsedTicks,
    };
  });

  let next: MatchState = {
    ...snapshot,
    units,
    bases,
    crossings,
    factions: snapshot.factions.map((faction) => {
      const losses = unitLosses.get(faction.id) ?? 0;
      const hqLoss = destroyedHqs.has(faction.id)
        ? snapshot.rules.match.hqLossTicketsCenti
        : 0;
      return losses === 0 && hqLoss === 0
        ? faction
        : {
            ...faction,
            ticketsCenti: Math.max(
              0,
              faction.ticketsCenti -
                losses * snapshot.rules.match.unitLossTicketsCenti -
                hqLoss,
            ),
          };
    }),
  };
  for (const factionId of destroyedHqs)
    next = cancelAllProductionForDestroyedHq(next, factionId);
  return next;
}
