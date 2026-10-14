import { cleanupFacilities } from './facilities';
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
import type {
  AttackProfile,
  AttackState,
  BaseState,
  Cell,
  CombatantId,
  FacilityState,
  FactionId,
  MatchState,
  UnitState,
} from './types';
import { LOCAL_STRONGHOLD_ID } from './local-faction';
import { unitCapabilities } from './unit-capabilities';
import {
  baseTurretDamage,
  baseUpgradeTier,
  resetBaseToLevelOne,
} from './base-upgrades';

interface Target {
  readonly kind:
    | 'unit'
    | 'defender'
    | 'base'
    | 'crossing'
    | 'stronghold'
    | 'facility';
  readonly id: string;
  readonly distanceSquared: number;
}

export type CombatHitTarget =
  | { readonly kind: 'target'; readonly target: Target }
  | { readonly kind: 'cell'; readonly cell: Cell };

export interface HitReservation {
  readonly tick: number;
  readonly target: CombatHitTarget;
  readonly damage: number;
  readonly attackerFactionId: CombatantId;
  readonly attackerUnitId?: string;
  readonly facilityId?: string;
}

export function attackerStateModifierPercent(
  _state: MatchState,
  _attacker: unknown,
): number {
  return 100;
}

export function isHqProtected(
  state: {
    readonly elapsedTicks: number;
    readonly rules: { readonly match: { readonly hqProtectionTicks?: number } };
  },
  base: { readonly kind: string },
): boolean {
  if (base.kind !== 'hq') return false;
  const protectionTicks = state.rules.match.hqProtectionTicks ?? 1200;
  return state.elapsedTicks < protectionTicks;
}

interface AttackActorContext {
  readonly profile: AttackProfile;
  readonly attack: AttackState;
  readonly isMoving: boolean;
  findTargetById(targetId: string): Target | null;
  selectTarget(): Target | null;
  calculateDamage(target: Target): number;
}

function stepAttackActor(
  ctx: AttackActorContext,
  tick: number,
): {
  readonly nextAttack: AttackState;
  readonly hit: { readonly target: Target; readonly damage: number } | null;
} {
  const { profile, isMoving } = ctx;
  let current = ctx.attack;

  if (current.phase === 'cooldown' && tick >= current.phaseEndsTick) {
    current = { targetId: null, phase: 'idle', phaseEndsTick: 0 };
  }

  if (isMoving && !profile.canAttackWhileMoving && current.phase === 'windup') {
    current = { targetId: null, phase: 'idle', phaseEndsTick: 0 };
  }

  if (current.phase === 'windup') {
    if (isMoving && !profile.canAttackWhileMoving) {
      return {
        nextAttack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
        hit: null,
      };
    }
    const target = current.targetId
      ? ctx.findTargetById(current.targetId)
      : null;
    if (!target) {
      return {
        nextAttack: { targetId: null, phase: 'idle', phaseEndsTick: 0 },
        hit: null,
      };
    } else if (tick >= current.phaseEndsTick) {
      const damage = ctx.calculateDamage(target);
      return {
        nextAttack: {
          targetId: null,
          phase: 'cooldown',
          phaseEndsTick: tick + profile.intervalTicks,
        },
        hit: { target, damage },
      };
    } else {
      return { nextAttack: current, hit: null };
    }
  }

  if (current.phase === 'idle') {
    if (isMoving && !profile.canAttackWhileMoving) {
      return { nextAttack: current, hit: null };
    }
    const target = ctx.selectTarget();
    if (!target) {
      return { nextAttack: current, hit: null };
    }
    if (profile.windupTicks === 0) {
      const damage = ctx.calculateDamage(target);
      return {
        nextAttack: {
          targetId: null,
          phase: 'cooldown',
          phaseEndsTick: tick + profile.intervalTicks,
        },
        hit: { target, damage },
      };
    } else {
      return {
        nextAttack: {
          targetId: target.id,
          phase: 'windup',
          phaseEndsTick: tick + profile.windupTicks,
        },
        hit: null,
      };
    }
  }

  return { nextAttack: current, hit: null };
}

function damageAgainst(
  state: MatchState,
  attacker: UnitState,
  target: Target,
): number {
  const stats = state.rules.units[attacker.kind];
  if (target.kind !== 'unit') return stats.damageVsStructure;
  const unit = state.units.find(({ id }) => id === target.id);
  if (!unit) return 0;
  const domain = state.rules.units[unit.kind].movementDomain;
  return domain === 'air'
    ? stats.damageVsAir
    : domain === 'water'
      ? stats.damageVsWater
      : stats.damageVsLand;
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
  factionId: CombatantId,
): boolean {
  return isCellVisibleToFaction(state, base.cell, factionId);
}

function findTargetForUnit(
  state: MatchState,
  attacker: UnitState,
  targetId: string,
): Target | null {
  const x2 = getUnitPositionX1024(attacker);
  const y2 = getUnitPositionY1024(attacker);
  const range = state.rules.units[attacker.kind].range;
  const rangeSquared = (1024 * range) ** 2;

  if (
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes('unit')
  ) {
    const unit = state.units.find(
      (u) =>
        u.id === targetId &&
        u.hp > 0 &&
        u.factionId !== attacker.factionId &&
        isUnitVisibleToFaction(state, u, attacker.factionId),
    );
    if (unit) {
      const d = distanceSquared(
        x2,
        y2,
        getUnitPositionX1024(unit),
        getUnitPositionY1024(unit),
      );
      if (
        d <= rangeSquared &&
        damageAgainst(state, attacker, {
          kind: 'unit',
          id: unit.id,
          distanceSquared: d,
        }) > 0
      ) {
        return { kind: 'unit', id: unit.id, distanceSquared: d };
      }
    }
  }

  if (
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
      'defender',
    ) &&
    state.rules.units[attacker.kind].damageVsStructure > 0
  ) {
    const base = state.bases.find(
      (b) =>
        b.id === targetId &&
        b.defender &&
        b.defender.hp > 0 &&
        b.owner === null &&
        b.kind !== 'hq' &&
        baseIsVisible(state, b, attacker.factionId),
    );
    if (base) {
      const d = distanceSquared(
        x2,
        y2,
        1024 * base.cell.x + 512,
        1024 * base.cell.y + 512,
      );
      if (d <= rangeSquared) {
        return { kind: 'defender', id: base.id, distanceSquared: d };
      }
    }
  }

  if (
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
      'base',
    ) &&
    state.rules.units[attacker.kind].damageVsStructure > 0
  ) {
    const base = state.bases.find(
      (b) =>
        b.id === targetId &&
        b.hp > 0 &&
        b.owner !== null &&
        b.owner !== attacker.factionId &&
        baseIsVisible(state, b, attacker.factionId),
    );
    if (base) {
      const d = distanceSquared(
        x2,
        y2,
        1024 * base.cell.x + 512,
        1024 * base.cell.y + 512,
      );
      if (d <= rangeSquared) {
        return { kind: 'base', id: base.id, distanceSquared: d };
      }
    }
  }

  if (
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
      'facility',
    ) &&
    state.rules.units[attacker.kind].damageVsStructure > 0
  ) {
    const facility = state.facilities.find(
      (f) =>
        f.id === targetId &&
        f.hp > 0 &&
        f.owner !== attacker.factionId &&
        isCellVisibleToFaction(state, f.cell, attacker.factionId),
    );
    if (facility) {
      const d = distanceSquared(
        x2,
        y2,
        1024 * facility.cell.x + 512,
        1024 * facility.cell.y + 512,
      );
      if (d <= rangeSquared) {
        return { kind: 'facility', id: facility.id, distanceSquared: d };
      }
    }
  }

  if (
    targetId === LOCAL_STRONGHOLD_ID &&
    attacker.factionId !== 'local' &&
    state.localFaction.active &&
    !state.localFaction.defeated &&
    state.localFaction.stronghold.hp > 0 &&
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
      'stronghold',
    ) &&
    state.rules.units[attacker.kind].damageVsStructure > 0
  ) {
    const stronghold = state.localFaction.stronghold;
    const d = distanceSquared(
      x2,
      y2,
      1024 * stronghold.cell.x + 512,
      1024 * stronghold.cell.y + 512,
    );
    if (
      d <= rangeSquared &&
      isCellVisibleToFaction(state, stronghold.cell, attacker.factionId)
    ) {
      return {
        kind: 'stronghold',
        id: LOCAL_STRONGHOLD_ID,
        distanceSquared: d,
      };
    }
  }

  if (
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
      'crossing',
    ) &&
    state.rules.units[attacker.kind].damageVsStructure > 0 &&
    attacker.factionId !== 'local'
  ) {
    const crossing = activeCrossings(state).find(
      (c) =>
        c.id === targetId &&
        c.owner !== attacker.factionId &&
        c.cells.some((cell) =>
          isCellVisibleToFaction(state, cell, attacker.factionId),
        ),
    );
    if (crossing) {
      const center =
        crossing.cells[Math.floor(crossing.cells.length / 2)] ?? crossing.bankA;
      const d = distanceSquared(
        x2,
        y2,
        1024 * center.x + 512,
        1024 * center.y + 512,
      );
      if (d <= rangeSquared) {
        return { kind: 'crossing', id: crossing.id, distanceSquared: d };
      }
    }
  }

  return null;
}

function findTargetForFacility(
  state: MatchState,
  f: FacilityState,
  targetId: string,
): Target | null {
  const d = state.rules.facilities.definitions[f.kind];
  if (d.range <= 0) return null;
  const unit = state.units.find(
    (u) =>
      u.id === targetId &&
      u.hp > 0 &&
      u.factionId !== f.owner &&
      (f.kind === 'mine' || isUnitVisibleToFaction(state, u, f.owner)),
  );
  if (!unit) return null;
  const domain = state.rules.units[unit.kind].movementDomain;
  const damage =
    domain === 'air'
      ? d.damageVsAir
      : domain === 'water'
        ? d.damageVsWater
        : d.damageVsLand;
  if (damage <= 0) return null;
  const dist = distanceSquared(
    f.cell.x * 1024 + 512,
    f.cell.y * 1024 + 512,
    getUnitPositionX1024(unit),
    getUnitPositionY1024(unit),
  );
  if (dist <= (d.range * 1024) ** 2) {
    return { kind: 'unit', id: unit.id, distanceSquared: dist };
  }
  return null;
}

function findTargetForDefender(
  state: MatchState,
  base: BaseState,
  targetId: string,
): Target | null {
  if (base.kind === 'hq') return null;
  const defense = state.rules.defenses[base.kind];
  const unit = state.units.find((u) => u.id === targetId && u.hp > 0);
  if (!unit) return null;
  const dist = distanceSquared(
    1024 * base.cell.x + 512,
    1024 * base.cell.y + 512,
    getUnitPositionX1024(unit),
    getUnitPositionY1024(unit),
  );
  if (dist <= (1024 * defense.range) ** 2) {
    return { kind: 'unit', id: unit.id, distanceSquared: dist };
  }
  return null;
}

function findTargetForTurret(
  state: MatchState,
  base: BaseState,
  targetId: string,
): Target | null {
  const turret = baseTurretDamage(base, state.rules);
  if (!turret) return null;
  const unit = state.units.find(
    (u) => u.id === targetId && u.hp > 0 && u.factionId !== base.owner,
  );
  if (!unit) return null;
  const dist = distanceSquared(
    1024 * base.cell.x + 512,
    1024 * base.cell.y + 512,
    getUnitPositionX1024(unit),
    getUnitPositionY1024(unit),
  );
  if (dist <= (1024 * turret.range) ** 2) {
    return { kind: 'unit', id: unit.id, distanceSquared: dist };
  }
  return null;
}

function selectTarget(state: MatchState, attacker: UnitState): Target | null {
  const x2 = getUnitPositionX1024(attacker);
  const y2 = getUnitPositionY1024(attacker);
  const range = state.rules.units[attacker.kind].range;
  const rangeSquared = (1024 * range) ** 2;
  const preferred = visibleMarchCombatTarget(state, attacker);
  if (
    preferred?.kind === 'unit' &&
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes('unit')
  ) {
    const target = state.units.find(({ id }) => id === preferred.id);
    if (
      target !== undefined &&
      damageAgainst(state, attacker, {
        kind: 'unit',
        id: target.id,
        distanceSquared: 0,
      }) > 0
    ) {
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
      const garrison = state.units
        .filter(
          (unit) =>
            state.rules.units[unit.kind].canGarrison &&
            unit.garrisonedAtBaseId === base.id &&
            unit.factionId !== attacker.factionId &&
            unit.hp > 0 &&
            unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
              'unit',
            ) &&
            damageAgainst(state, attacker, {
              kind: 'unit',
              id: unit.id,
              distanceSquared: 0,
            }) > 0 &&
            isUnitVisibleToFaction(state, unit, attacker.factionId),
        )
        .map((unit) => ({
          unit,
          distanceSquared: distanceSquared(
            x2,
            y2,
            getUnitPositionX1024(unit),
            getUnitPositionY1024(unit),
          ),
        }))
        .filter(({ distanceSquared: distance }) => distance <= rangeSquared)
        .sort(
          (a, b) =>
            a.distanceSquared - b.distanceSquared ||
            (a.unit.id < b.unit.id ? -1 : a.unit.id > b.unit.id ? 1 : 0),
        )[0];
      if (garrison)
        return {
          kind: 'unit',
          id: garrison.unit.id,
          distanceSquared: garrison.distanceSquared,
        };
      if (
        base.defender &&
        base.defender.hp > 0 &&
        !isHqProtected(state, base)
      ) {
        if (
          unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
            'defender',
          ) &&
          state.rules.units[attacker.kind].damageVsStructure > 0
        )
          return {
            kind: 'defender',
            id: base.id,
            distanceSquared: distanceSquared(
              x2,
              y2,
              1024 * base.cell.x + 512,
              1024 * base.cell.y + 512,
            ),
          };
      } else if (
        !isHqProtected(state, base) &&
        unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
          'base',
        ) &&
        state.rules.units[attacker.kind].damageVsStructure > 0
      ) {
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
  }
  const units = state.units
    .filter(() =>
      unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
        'unit',
      ),
    )
    .filter(
      (target) => target.factionId !== attacker.factionId && target.hp > 0,
    )
    .filter(
      (target) =>
        damageAgainst(state, attacker, {
          kind: 'unit',
          id: target.id,
          distanceSquared: 0,
        }) > 0,
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
    .sort((a, b) => {
      if (attacker.kind === 'antiAir') {
        const aAir =
          state.units.find(({ id }) => id === a.id)?.kind === 'helicopter';
        const bAir =
          state.units.find(({ id }) => id === b.id)?.kind === 'helicopter';
        if (aAir !== bAir) return aAir ? -1 : 1;
      }
      return compareTarget(a, b);
    });
  if (units[0]) return units[0];
  const defenders = state.bases
    .filter((base) => base.owner === null && (base.defender?.hp ?? 0) > 0)
    .filter((base) => baseIsVisible(state, base, attacker.factionId))
    .map(
      (base): Target => ({
        kind: 'defender',
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
  if (
    defenders[0] &&
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
      'defender',
    ) &&
    state.rules.units[attacker.kind].damageVsStructure > 0
  )
    return defenders[0];
  if (
    attacker.factionId !== 'local' &&
    state.rules.units[attacker.kind].attackTargets.includes('facility') &&
    state.rules.units[attacker.kind].damageVsStructure > 0
  ) {
    const target = state.facilities
      .filter(
        (f) =>
          f.owner !== attacker.factionId &&
          f.kind !== 'mine' &&
          f.hp > 0 &&
          isCellVisibleToFaction(state, f.cell, attacker.factionId),
      )
      .map((f) => ({
        kind: 'facility' as const,
        id: f.id,
        distanceSquared: distanceSquared(
          x2,
          y2,
          f.cell.x * 1024 + 512,
          f.cell.y * 1024 + 512,
        ),
      }))
      .filter((t) => t.distanceSquared <= rangeSquared)
      .sort(compareTarget)[0];
    if (target) return target;
  }
  const bases = state.bases
    .filter(() =>
      unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
        'base',
      ),
    )
    .filter(
      (base) =>
        !isHqProtected(state, base) &&
        ((base.owner !== null && base.owner !== attacker.factionId) ||
          (base.owner === null && base.defender?.hp === 0)) &&
        base.hp > 0,
    )
    .filter(() => state.rules.units[attacker.kind].damageVsStructure > 0)
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

  const stronghold = state.localFaction.stronghold;
  const strongholdDistance = distanceSquared(
    x2,
    y2,
    1024 * stronghold.cell.x + 512,
    1024 * stronghold.cell.y + 512,
  );
  if (
    attacker.factionId !== 'local' &&
    state.localFaction.active &&
    !state.localFaction.defeated &&
    stronghold.hp > 0 &&
    unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
      'stronghold',
    ) &&
    state.rules.units[attacker.kind].damageVsStructure > 0 &&
    strongholdDistance <= rangeSquared &&
    isCellVisibleToFaction(state, stronghold.cell, attacker.factionId)
  )
    return {
      kind: 'stronghold',
      id: LOCAL_STRONGHOLD_ID,
      distanceSquared: strongholdDistance,
    };

  return (
    (unitCapabilities(attacker.kind, state.rules).attackTargets.includes(
      'crossing',
    ) && state.rules.units[attacker.kind].damageVsStructure > 0
      ? activeCrossings(state)
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
          .sort(compareTarget)[0]
      : undefined) ?? null
  );
}

/** Applies one simultaneous damage snapshot, then finalizes deaths and losses. */
export function resolveCombat(state: MatchState): MatchState {
  const snapshot = state;
  const tick = snapshot.elapsedTicks;

  const hitReservations: HitReservation[] = [];
  const updatedUnits: UnitState[] = [];
  const updatedFacilities: FacilityState[] = [];
  const activatedFacilities = new Set<string>();
  const updatedBases: BaseState[] = [];

  // 1. 部隊
  for (const attacker of snapshot.units) {
    if (attacker.hp <= 0) {
      updatedUnits.push(attacker);
      continue;
    }
    const stats = snapshot.rules.units[attacker.kind];
    const profile: AttackProfile = {
      windupTicks: stats.windupTicks ?? 0,
      intervalTicks: stats.intervalTicks ?? 1,
      canAttackWhileMoving: stats.canAttackWhileMoving ?? true,
    };
    const attack = attacker.attack ?? {
      targetId: null,
      phase: 'idle',
      phaseEndsTick: 0,
    };
    const isMoving = attacker.path.length > 0 || attacker.edgeProgress > 0;

    const { nextAttack, hit } = stepAttackActor(
      {
        profile,
        attack,
        isMoving,
        findTargetById: (id) => findTargetForUnit(snapshot, attacker, id),
        selectTarget: () => selectTarget(snapshot, attacker),
        calculateDamage: (target) => {
          const faction = snapshot.factions.find(
            ({ id }) => id === attacker.factionId,
          );
          const rawDamage =
            damageAgainst(snapshot, attacker, target) +
            (faction ? firepowerBonus(faction, snapshot.rules) : 0);
          const modifier = attackerStateModifierPercent(snapshot, attacker);
          const stance = attacker.stance ?? 'aggressive';
          const stanceModifier =
            snapshot.rules.unitBehavior.stanceProfiles[stance].damagePercent;
          const rankModifier =
            100 +
            (attacker.rank ?? 0) *
              snapshot.rules.unitBehavior.rankDamagePercent;
          return Math.max(
            1,
            Math.floor(
              (rawDamage *
                (attacker.growthCenti ?? 10_000) *
                modifier *
                stanceModifier *
                rankModifier) /
                (10_000 * 100 * 100 * 100),
            ),
          );
        },
      },
      tick,
    );

    updatedUnits.push({ ...attacker, attack: nextAttack });
    if (hit) {
      hitReservations.push({
        tick,
        target: { kind: 'target', target: hit.target },
        damage: hit.damage,
        attackerFactionId: attacker.factionId,
        attackerUnitId: attacker.id,
      });
    }
  }

  // 2. 施設
  for (const f of snapshot.facilities) {
    if (f.hp <= 0 || f.remainingBuildTicks > 0) {
      updatedFacilities.push(f);
      continue;
    }
    const d = snapshot.rules.facilities.definitions[f.kind];
    const profile: AttackProfile = {
      windupTicks: d.windupTicks ?? 0,
      intervalTicks: d.intervalTicks ?? d.attackIntervalTicks ?? 10,
      canAttackWhileMoving: d.canAttackWhileMoving ?? true,
    };
    const attack = f.attack ?? {
      targetId: null,
      phase: 'idle',
      phaseEndsTick: 0,
    };

    const { nextAttack, hit } = stepAttackActor(
      {
        profile,
        attack,
        isMoving: false,
        findTargetById: (id) => findTargetForFacility(snapshot, f, id),
        selectTarget: () => {
          if (d.range <= 0) return null;
          const targets = snapshot.units
            .filter((u) => u.hp > 0 && u.factionId !== f.owner)
            .map((u) => ({
              u,
              domain: snapshot.rules.units[u.kind].movementDomain,
              distance: distanceSquared(
                f.cell.x * 1024 + 512,
                f.cell.y * 1024 + 512,
                getUnitPositionX1024(u),
                getUnitPositionY1024(u),
              ),
            }))
            .filter(
              (t) =>
                t.distance <= (d.range * 1024) ** 2 &&
                (t.domain === 'air'
                  ? d.damageVsAir
                  : t.domain === 'water'
                    ? d.damageVsWater
                    : d.damageVsLand) > 0 &&
                (f.kind === 'mine' ||
                  isUnitVisibleToFaction(snapshot, t.u, f.owner)),
            )
            .sort(
              (a, b) => a.distance - b.distance || (a.u.id < b.u.id ? -1 : 1),
            );
          const first = targets[0];
          return first
            ? {
                kind: 'unit',
                id: first.u.id,
                distanceSquared: first.distance,
              }
            : null;
        },
        calculateDamage: (target) => {
          const targetUnit = snapshot.units.find((u) => u.id === target.id);
          const domain = targetUnit
            ? snapshot.rules.units[targetUnit.kind].movementDomain
            : 'land';
          const rawDamage =
            domain === 'air'
              ? d.damageVsAir
              : domain === 'water'
                ? d.damageVsWater
                : d.damageVsLand;
          const modifier = attackerStateModifierPercent(snapshot, f);
          return Math.max(1, Math.floor((rawDamage * modifier) / 100));
        },
      },
      tick,
    );

    updatedFacilities.push({ ...f, attack: nextAttack });
    if (hit) {
      activatedFacilities.add(f.id);
      hitReservations.push({
        tick,
        target: { kind: 'target', target: hit.target },
        damage: hit.damage,
        attackerFactionId: f.owner,
        facilityId: f.id,
      });
    }
  }

  // 3. 拠点砲座 & 中立守備
  for (const base of snapshot.bases) {
    let baseAttack = base.attack ?? {
      targetId: null,
      phase: 'idle',
      phaseEndsTick: 0,
    };
    let defender = base.defender;

    // 中立守備
    if (
      base.kind !== 'hq' &&
      base.owner === null &&
      defender &&
      defender.hp > 0
    ) {
      const def = snapshot.rules.defenses[base.kind];
      const profile: AttackProfile = {
        windupTicks: def.windupTicks ?? 0,
        intervalTicks: def.intervalTicks ?? 1,
        canAttackWhileMoving: def.canAttackWhileMoving ?? true,
      };
      const defAttack = defender.attack ?? {
        targetId: null,
        phase: 'idle',
        phaseEndsTick: 0,
      };

      const { nextAttack, hit } = stepAttackActor(
        {
          profile,
          attack: defAttack,
          isMoving: false,
          findTargetById: (id) => findTargetForDefender(snapshot, base, id),
          selectTarget: () => {
            const targets = snapshot.units
              .filter((u) => u.hp > 0)
              .map((u) => ({
                u,
                distanceSquared: distanceSquared(
                  1024 * base.cell.x + 512,
                  1024 * base.cell.y + 512,
                  getUnitPositionX1024(u),
                  getUnitPositionY1024(u),
                ),
              }))
              .filter(({ distanceSquared: d }) => d <= (1024 * def.range) ** 2)
              .sort(
                (a, b) =>
                  a.distanceSquared - b.distanceSquared ||
                  (a.u.id < b.u.id ? -1 : 1),
              );
            const first = targets[0];
            return first
              ? {
                  kind: 'unit',
                  id: first.u.id,
                  distanceSquared: first.distanceSquared,
                }
              : null;
          },
          calculateDamage: () => {
            const modifier = attackerStateModifierPercent(snapshot, defender);
            return Math.max(1, Math.floor((def.baseDamage * modifier) / 100));
          },
        },
        tick,
      );

      defender = { ...defender, attack: nextAttack };
      if (hit) {
        hitReservations.push({
          tick,
          target: { kind: 'target', target: hit.target },
          damage: hit.damage,
          attackerFactionId: 'local',
        });
      }
    }

    // 拠点砲座
    if (base.owner !== null && base.hp > 0) {
      const turret = baseTurretDamage(base, snapshot.rules);
      if (turret) {
        const tier = baseUpgradeTier(
          base.kind,
          base.level as 2 | 3,
          snapshot.rules,
        );
        const profile: AttackProfile = {
          windupTicks: tier.windupTicks ?? 0,
          intervalTicks: tier.intervalTicks ?? tier.turretIntervalTicks ?? 10,
          canAttackWhileMoving: tier.canAttackWhileMoving ?? true,
        };

        const { nextAttack, hit } = stepAttackActor(
          {
            profile,
            attack: baseAttack,
            isMoving: false,
            findTargetById: (id) => findTargetForTurret(snapshot, base, id),
            selectTarget: () => {
              const targets = snapshot.units
                .filter((u) => u.hp > 0 && u.factionId !== base.owner)
                .map((u) => ({
                  u,
                  distanceSquared: distanceSquared(
                    1024 * base.cell.x + 512,
                    1024 * base.cell.y + 512,
                    getUnitPositionX1024(u),
                    getUnitPositionY1024(u),
                  ),
                }))
                .filter(
                  ({ distanceSquared: d }) => d <= (1024 * turret.range) ** 2,
                )
                .sort(
                  (a, b) =>
                    a.distanceSquared - b.distanceSquared ||
                    (a.u.id < b.u.id ? -1 : 1),
                );
              const first = targets[0];
              return first
                ? {
                    kind: 'unit',
                    id: first.u.id,
                    distanceSquared: first.distanceSquared,
                  }
                : null;
            },
            calculateDamage: (target) => {
              const targetUnit = snapshot.units.find((u) => u.id === target.id);
              const air =
                targetUnit &&
                snapshot.rules.units[targetUnit.kind]?.movementDomain === 'air';
              const rawDamage = air
                ? Math.ceil(turret.damage / 2)
                : turret.damage;
              const modifier = attackerStateModifierPercent(snapshot, base);
              return Math.max(1, Math.floor((rawDamage * modifier) / 100));
            },
          },
          tick,
        );

        baseAttack = nextAttack;
        if (hit) {
          hitReservations.push({
            tick,
            target: { kind: 'target', target: hit.target },
            damage: hit.damage,
            attackerFactionId: base.owner,
          });
        }
      }
    }

    updatedBases.push({
      ...base,
      defender,
      attack: baseAttack,
    });
  }

  // --- ダメージ集計 ---
  const unitDamage = new Map<string, number>();
  const experienceGain = new Map<string, number>();
  const facilityDamage = new Map<string, number>();
  const defenderDamage = new Map<string, number>();
  const baseDamage = new Map<string, number>();
  const crossingDamage = new Map<string, Map<FactionId, number>>();
  const strongholdDamage = new Map<FactionId, number>();

  for (const res of hitReservations) {
    if (res.target.kind === 'target') {
      const t = res.target.target;
      if (t.kind === 'unit') {
        unitDamage.set(t.id, (unitDamage.get(t.id) ?? 0) + res.damage);
      } else if (t.kind === 'facility') {
        facilityDamage.set(t.id, (facilityDamage.get(t.id) ?? 0) + res.damage);
      } else if (t.kind === 'defender') {
        defenderDamage.set(t.id, (defenderDamage.get(t.id) ?? 0) + res.damage);
      } else if (t.kind === 'base') {
        baseDamage.set(t.id, (baseDamage.get(t.id) ?? 0) + res.damage);
      } else if (t.kind === 'stronghold') {
        if (res.attackerFactionId !== 'local') {
          strongholdDamage.set(
            res.attackerFactionId as FactionId,
            (strongholdDamage.get(res.attackerFactionId as FactionId) ?? 0) +
              res.damage,
          );
        }
      } else if (t.kind === 'crossing') {
        if (res.attackerFactionId !== 'local') {
          const byFaction =
            crossingDamage.get(t.id) ?? new Map<FactionId, number>();
          byFaction.set(
            res.attackerFactionId as FactionId,
            (byFaction.get(res.attackerFactionId as FactionId) ?? 0) +
              res.damage,
          );
          crossingDamage.set(t.id, byFaction);
        }
      }
    }
    if (res.facilityId) {
      const fac = snapshot.facilities.find((f) => f.id === res.facilityId);
      if (fac && fac.kind === 'mine') {
        facilityDamage.set(fac.id, fac.hp);
      }
    }
  }

  for (const [targetId, totalDamage] of unitDamage) {
    const target = snapshot.units.find((unit) => unit.id === targetId);
    if (!target || totalDamage <= 0) continue;
    const effectiveDamage = Math.min(target.hp, totalDamage);
    const hits = hitReservations.filter(
      (res) =>
        res.target.kind === 'target' &&
        res.target.target.kind === 'unit' &&
        res.target.target.id === targetId &&
        res.attackerUnitId,
    );
    const total = hits.reduce((sum, res) => sum + res.damage, 0);
    for (const res of hits) {
      const attackerId = res.attackerUnitId!;
      const share = Math.floor(
        (effectiveDamage * res.damage) / Math.max(1, total),
      );
      experienceGain.set(
        attackerId,
        (experienceGain.get(attackerId) ?? 0) +
          share * snapshot.rules.unitBehavior.experiencePerDamageCenti,
      );
    }
  }

  let unitLosses = new Map<FactionId, number>();
  let units = updatedUnits
    .map((unit) => {
      const damage = unitDamage.get(unit.id) ?? 0;
      const hp = damage <= 0 ? unit.hp : Math.max(0, unit.hp - damage);
      if (hp === 0 && unit.factionId !== 'local')
        unitLosses.set(
          unit.factionId,
          (unitLosses.get(unit.factionId) ?? 0) +
            snapshot.rules.units[unit.kind].lossTicketsCenti,
        );
      const maxExperience =
        snapshot.rules.unitBehavior.rankThresholdsCenti.at(-1) ?? 0;
      const experienceCenti = Math.min(
        maxExperience,
        (unit.experienceCenti ?? 0) + (experienceGain.get(unit.id) ?? 0),
      );
      const rank = snapshot.rules.unitBehavior.rankThresholdsCenti.filter(
        (threshold) => experienceCenti >= threshold,
      ).length;
      return { ...unit, hp, experienceCenti, rank };
    })
    .filter(({ hp }) => hp > 0);

  const destroyedHqs = new Set<FactionId>();
  let bases = updatedBases.map((base) => {
    const defenderHit = defenderDamage.get(base.id) ?? 0;
    const defender =
      base.defender && defenderHit > 0
        ? { ...base.defender, hp: Math.max(0, base.defender.hp - defenderHit) }
        : base.defender;
    const damage = baseDamage.get(base.id) ?? 0;
    if (isHqProtected(snapshot, base) || damage <= 0 || base.hp <= 0)
      return defender === base.defender ? base : { ...base, defender };
    const hp = Math.max(0, base.hp - damage);
    const damaged = {
      ...base,
      hp,
      defender,
      lastDamagedTick: snapshot.elapsedTicks,
    };
    if (hp > 0) return damaged;
    if (base.kind === 'hq') {
      if (base.homeFactionId) destroyedHqs.add(base.homeFactionId);
      return resetBaseToLevelOne(
        {
          ...damaged,
          captureCandidate: null,
          captureProgressCentiTicks: 0,
        },
        snapshot.rules,
        snapshot.elapsedTicks,
        0,
      );
    }
    return resetBaseToLevelOne(
      {
        ...damaged,
        owner: null,
        hp: base.owner !== null ? base.maxHp : hp,
        defender:
          base.owner !== null && snapshot.rules.defenses.respawnEnabled
            ? {
                hp: snapshot.rules.defenses[base.kind].maxHp,
                maxHp: snapshot.rules.defenses[base.kind].maxHp,
                disabledTicks: 0,
              }
            : base.owner !== null
              ? null
              : defender,
        conqueredFromLocal:
          base.owner === 'local' || base.conqueredFromLocal === true,
        captureCandidate: null,
        captureProgressCentiTicks: 0,
      },
      snapshot.rules,
      snapshot.elapsedTicks,
      base.owner !== null ? 1 : 0,
    );
  });
  units = units.map((unit) => {
    if (!unit.garrisonedAtBaseId) return unit;
    const oldBase = snapshot.bases.find(
      ({ id }) => id === unit.garrisonedAtBaseId,
    );
    const newBase = bases.find(({ id }) => id === unit.garrisonedAtBaseId);
    return oldBase &&
      newBase &&
      (newBase.owner !== oldBase.owner || newBase.hp === 0)
      ? { ...unit, garrisonedAtBaseId: null }
      : unit;
  });

  let localFaction = snapshot.localFaction;
  const strongholdHit = [...strongholdDamage.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  let strongholdWinner: FactionId | null = null;
  if (
    strongholdHit > 0 &&
    snapshot.localFaction.active &&
    !snapshot.localFaction.defeated
  ) {
    const hp = Math.max(0, snapshot.localFaction.stronghold.hp - strongholdHit);
    if (hp === 0) {
      const ranked = [...strongholdDamage.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      const first = ranked[0];
      const tied = first !== undefined && ranked[1]?.[1] === first[1];
      if (first && !tied) strongholdWinner = first[0];
      localFaction = {
        ...snapshot.localFaction,
        active: false,
        defeated: true,
        nextSpawnTick: null,
        stronghold: { ...snapshot.localFaction.stronghold, hp: 0 },
      };
      units = units.filter((unit) => unit.factionId !== 'local');
      bases = bases.map((base) =>
        base.owner === 'local' && base.kind !== 'hq'
          ? resetBaseToLevelOne(
              {
                ...base,
                owner: null,
                defender: snapshot.rules.defenses.respawnEnabled
                  ? {
                      hp: snapshot.rules.defenses[base.kind].maxHp,
                      maxHp: snapshot.rules.defenses[base.kind].maxHp,
                      disabledTicks: 0,
                    }
                  : null,
                captureCandidate: null,
                captureProgressCentiTicks: 0,
                conqueredFromLocal: true,
              },
              snapshot.rules,
              snapshot.elapsedTicks,
              1,
            )
          : base,
      );
    } else {
      localFaction = {
        ...snapshot.localFaction,
        stronghold: { ...snapshot.localFaction.stronghold, hp },
      };
    }
  }

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
    facilities: updatedFacilities
      .map((f) => ({
        ...f,
        hp: Math.max(0, f.hp - (facilityDamage.get(f.id) ?? 0)),
        lastDamagedTick: facilityDamage.has(f.id)
          ? snapshot.elapsedTicks
          : f.lastDamagedTick,
        lastActivatedTick: activatedFacilities.has(f.id)
          ? snapshot.elapsedTicks
          : f.lastActivatedTick,
      }))
      .filter((f) => f.hp > 0),
    bases,
    crossings,
    localFaction,
    factions: snapshot.factions.map((faction) => {
      const killReward = faction.id === strongholdWinner;
      const losses = unitLosses.get(faction.id) ?? 0;
      return losses === 0 && !killReward
        ? faction
        : {
            ...faction,
            supplyCenti:
              faction.supplyCenti +
              (killReward
                ? snapshot.rules.localFaction.strongholdRewardSupplyCenti
                : 0),
            researchCenti:
              faction.researchCenti +
              (killReward
                ? snapshot.rules.localFaction.strongholdRewardResearchCenti
                : 0),
            ticketsCenti: Math.max(0, faction.ticketsCenti - losses),
          };
    }),
  };
  for (const factionId of destroyedHqs)
    next = cancelAllProductionForDestroyedHq(next, factionId);
  return cleanupFacilities(next);
}
