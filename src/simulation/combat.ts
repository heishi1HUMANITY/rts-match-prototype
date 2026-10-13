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
  BaseState,
  CombatantId,
  FactionId,
  MatchState,
  UnitState,
} from './types';
import { LOCAL_STRONGHOLD_ID } from './local-faction';
import { unitCapabilities } from './unit-capabilities';
import { baseTurretDamage, resetBaseToLevelOne } from './base-upgrades';
import { supplyNetwork } from './supply';

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
      if (base.defender && base.defender.hp > 0) {
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
  const supplyByFaction = new Map(
    snapshot.factions.map((faction) => [
      faction.id,
      supplyNetwork(snapshot, faction.id),
    ]),
  );
  const unitDamage = new Map<string, number>();
  const facilityDamage = new Map<string, number>();
  const activatedFacilities = new Set<string>();
  const defenderDamage = new Map<string, number>();
  const baseDamage = new Map<string, number>();
  const crossingDamage = new Map<string, Map<FactionId, number>>();
  const strongholdDamage = new Map<FactionId, number>();
  for (const attacker of snapshot.units) {
    if (attacker.hp <= 0) continue;
    const target = selectTarget(snapshot, attacker);
    if (!target) continue;
    const faction = snapshot.factions.find(
      ({ id }) => id === attacker.factionId,
    );
    const rawDamage =
      damageAgainst(snapshot, attacker, target) +
      (faction ? firepowerBonus(faction, snapshot.rules) : 0);
    const damage = Math.max(
      1,
      Math.floor((rawDamage * (attacker.growthCenti ?? 10_000)) / 10_000),
    );
    if (target.kind === 'unit') {
      unitDamage.set(target.id, (unitDamage.get(target.id) ?? 0) + damage);
    } else if (target.kind === 'facility') {
      facilityDamage.set(
        target.id,
        (facilityDamage.get(target.id) ?? 0) + damage,
      );
    } else if (target.kind === 'defender') {
      defenderDamage.set(
        target.id,
        (defenderDamage.get(target.id) ?? 0) + damage,
      );
    } else if (target.kind === 'base') {
      baseDamage.set(target.id, (baseDamage.get(target.id) ?? 0) + damage);
    } else if (target.kind === 'stronghold') {
      if (attacker.factionId !== 'local')
        strongholdDamage.set(
          attacker.factionId,
          (strongholdDamage.get(attacker.factionId) ?? 0) + damage,
        );
    } else {
      if (attacker.factionId === 'local') continue;
      const byFaction =
        crossingDamage.get(target.id) ?? new Map<FactionId, number>();
      byFaction.set(
        attacker.factionId,
        (byFaction.get(attacker.factionId) ?? 0) + damage,
      );
      crossingDamage.set(target.id, byFaction);
    }
  }

  for (const f of snapshot.facilities) {
    if (f.hp <= 0 || f.remainingBuildTicks > 0) continue;
    const d = snapshot.rules.facilities.definitions[f.kind];
    const network = supplyByFaction.get(f.owner);
    const anchorConnected =
      f.anchor.kind === 'base'
        ? network?.connectedBaseIds.includes(f.anchor.id)
        : network?.connectedCrossingIds.includes(f.anchor.id);
    const damagePercent = anchorConnected
      ? 100
      : snapshot.rules.supplyLines.disconnectedFacilityDamagePercent;
    if (snapshot.elapsedTicks - f.lastActivatedTick < d.attackIntervalTicks)
      continue;
    const target = snapshot.units
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
          (f.kind === 'mine' || isUnitVisibleToFaction(snapshot, t.u, f.owner)),
      )
      .sort((a, b) => a.distance - b.distance || (a.u.id < b.u.id ? -1 : 1))[0];
    if (!target) continue;
    const rawDamage =
      target.domain === 'air'
        ? d.damageVsAir
        : target.domain === 'water'
          ? d.damageVsWater
          : d.damageVsLand;
    const damage = Math.floor((rawDamage * damagePercent) / 100);
    if (damage <= 0) continue;
    unitDamage.set(target.u.id, (unitDamage.get(target.u.id) ?? 0) + damage);
    activatedFacilities.add(f.id);
    if (f.kind === 'mine') facilityDamage.set(f.id, f.hp);
  }
  // Garrison attacks use the same pre-damage snapshot as faction units.
  for (const base of snapshot.bases) {
    if (
      base.kind === 'hq' ||
      base.owner !== null ||
      !base.defender ||
      base.defender.hp <= 0
    )
      continue;
    const defense = snapshot.rules.defenses[base.kind];
    const target = snapshot.units
      .filter((unit) => unit.hp > 0)
      .map((unit) => ({
        unit,
        distanceSquared: distanceSquared(
          1024 * base.cell.x + 512,
          1024 * base.cell.y + 512,
          getUnitPositionX1024(unit),
          getUnitPositionY1024(unit),
        ),
      }))
      .filter(
        ({ distanceSquared: distance }) =>
          distance <= (1024 * defense.range) ** 2,
      )
      .sort((a, b) => {
        if (a.distanceSquared !== b.distanceSquared)
          return a.distanceSquared - b.distanceSquared;
        return a.unit.id < b.unit.id ? -1 : a.unit.id > b.unit.id ? 1 : 0;
      })[0]?.unit;
    if (target)
      unitDamage.set(
        target.id,
        (unitDamage.get(target.id) ?? 0) + defense.baseDamage,
      );
  }

  // Upgraded base turrets fire on fixed interval boundaries and join the same
  // pre-damage snapshot as units and neutral garrisons.
  for (const base of snapshot.bases) {
    if (base.owner === null || base.hp <= 0) continue;
    const turret = baseTurretDamage(base, snapshot.rules);
    if (!turret || snapshot.elapsedTicks % turret.interval !== 0) continue;
    const connected =
      base.owner === 'local' ||
      supplyByFaction.get(base.owner)?.connectedBaseIds.includes(base.id) ===
        true;
    const turretDamage = connected
      ? turret.damage
      : Math.floor(
          (turret.damage *
            snapshot.rules.supplyLines.disconnectedBaseTurretDamagePercent) /
            100,
        );
    if (turretDamage <= 0) continue;
    const target = snapshot.units
      .filter((unit) => unit.hp > 0 && unit.factionId !== base.owner)
      .map((unit) => ({
        unit,
        distanceSquared: distanceSquared(
          1024 * base.cell.x + 512,
          1024 * base.cell.y + 512,
          getUnitPositionX1024(unit),
          getUnitPositionY1024(unit),
        ),
      }))
      .filter(
        ({ distanceSquared: distance }) =>
          distance <= (1024 * turret.range) ** 2,
      )
      .sort(
        (a, b) =>
          a.distanceSquared - b.distanceSquared ||
          (a.unit.id < b.unit.id ? -1 : a.unit.id > b.unit.id ? 1 : 0),
      )[0]?.unit;
    if (target) {
      const air = snapshot.rules.units[target.kind].movementDomain === 'air';
      const damage = air ? Math.ceil(turretDamage / 2) : turretDamage;
      unitDamage.set(target.id, (unitDamage.get(target.id) ?? 0) + damage);
    }
  }

  let unitLosses = new Map<FactionId, number>();
  let units = snapshot.units
    .map((unit) => {
      const damage = unitDamage.get(unit.id) ?? 0;
      if (damage <= 0) return unit;
      const hp = Math.max(0, unit.hp - damage);
      if (hp === 0 && unit.factionId !== 'local')
        unitLosses.set(
          unit.factionId,
          (unitLosses.get(unit.factionId) ?? 0) +
            snapshot.rules.units[unit.kind].lossTicketsCenti,
        );
      return { ...unit, hp };
    })
    .filter(({ hp }) => hp > 0);

  const destroyedHqs = new Set<FactionId>();
  let bases = snapshot.bases.map((base) => {
    const defenderHit = defenderDamage.get(base.id) ?? 0;
    const defender =
      base.defender && defenderHit > 0
        ? { ...base.defender, hp: Math.max(0, base.defender.hp - defenderHit) }
        : base.defender;
    const damage = baseDamage.get(base.id) ?? 0;
    if (damage <= 0 || base.hp <= 0)
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
    facilities: snapshot.facilities
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
      const hqLoss = destroyedHqs.has(faction.id)
        ? snapshot.rules.match.hqLossTicketsCenti
        : 0;
      return losses === 0 && hqLoss === 0 && !killReward
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
            ticketsCenti: Math.max(0, faction.ticketsCenti - losses - hqLoss),
          };
    }),
  };
  for (const factionId of destroyedHqs)
    next = cancelAllProductionForDestroyedHq(next, factionId);
  return cleanupFacilities(next);
}
