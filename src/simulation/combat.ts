import { cancelAllProductionForDestroyedHq } from './production';
import { firepowerBonus } from './research';
import { visibleMarchCombatTarget } from './march';
import {
  getUnitPositionX1024,
  getUnitPositionY1024,
  isCellVisibleToFaction,
  isUnitVisibleToFaction,
} from './visibility';
import type { BaseState, FactionId, MatchState, UnitState } from './types';

interface Target {
  readonly kind: 'unit' | 'base';
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

  return (
    state.bases
      .filter(
        (base) =>
          base.owner !== null &&
          base.owner !== attacker.factionId &&
          base.hp > 0,
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
      .sort(compareTarget)[0] ?? null
  );
}

/** Applies one simultaneous damage snapshot, then finalizes deaths and losses. */
export function resolveCombat(state: MatchState): MatchState {
  const snapshot = state;
  const unitDamage = new Map<string, number>();
  const baseDamage = new Map<string, number>();
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
    const damageMap = target.kind === 'unit' ? unitDamage : baseDamage;
    damageMap.set(target.id, (damageMap.get(target.id) ?? 0) + damage);
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

  let next: MatchState = {
    ...snapshot,
    units,
    bases,
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
