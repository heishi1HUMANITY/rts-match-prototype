import { MAP_HEIGHT, MAP_WIDTH } from './config';
import { isCellVisibleToFaction } from './visibility';
import type {
  Cell,
  CombatantId,
  FactionId,
  MatchState,
  ScheduledStrike,
  SurveyEffect,
  TacticalAbilityId,
} from './types';
import type { CommandResult, RejectCode } from './types';

export const TACTICAL_ABILITY_LABELS: Readonly<
  Record<TacticalAbilityId, string>
> = {
  artillery: '砲撃支援',
  surge: '緊急増産',
  smoke: '煙幕',
  bulwark: '鉄壁',
  survey: '広域観測',
  jam: '電波妨害',
};

function reject(state: MatchState, reason: RejectCode): CommandResult {
  return { ok: false, state, reason };
}

function sameCellDistanceSquared(a: Cell, b: Cell): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function withCooldown(
  state: MatchState,
  actor: FactionId,
  abilityId: TacticalAbilityId,
  costCenti: number,
): MatchState {
  const faction = state.factions.find(({ id }) => id === actor)!;
  const config = state.rules.tacticalAbilities[abilityId];
  const updated = {
    ...faction,
    supplyCenti: faction.supplyCenti - costCenti + config.supplyGrantCenti,
    abilityReadyAtTick: {
      ...faction.abilityReadyAtTick,
      [abilityId]: state.elapsedTicks + config.cooldownTicks,
    },
  };
  return {
    ...state,
    factions: state.factions.map((entry) =>
      entry.id === actor ? updated : entry,
    ),
  };
}

function inBounds(cell: Cell): boolean {
  return (
    cell.x >= 0 && cell.y >= 0 && cell.x < MAP_WIDTH && cell.y < MAP_HEIGHT
  );
}

export function activateTacticalAbility(
  state: MatchState,
  actor: FactionId,
  abilityId: TacticalAbilityId,
  target?: Cell | FactionId,
): CommandResult {
  const faction = state.factions.find(({ id }) => id === actor);
  if (
    !faction ||
    faction.eliminatedAtTick !== null ||
    faction.ticketsCenti <= 0
  )
    return reject(state, 'FACTION_ELIMINATED');
  const rules = state.rules.tacticalAbilities[abilityId];
  if (state.elapsedTicks < faction.abilityReadyAtTick[abilityId])
    return reject(state, 'ABILITY_NOT_READY');
  if (faction.supplyCenti < rules.costCenti)
    return reject(state, 'INSUFFICIENT_SUPPLY');

  let cellTarget: Cell | undefined;
  let factionTarget: FactionId | undefined;
  if (
    abilityId === 'artillery' ||
    abilityId === 'smoke' ||
    abilityId === 'survey'
  ) {
    if (!target || typeof target === 'string')
      return reject(state, 'ABILITY_TARGET_INVALID');
    cellTarget = target;
    if (!inBounds(cellTarget)) return reject(state, 'ABILITY_TARGET_INVALID');
    if (!isCellVisibleToFaction(state, cellTarget, actor))
      return reject(state, 'ABILITY_TARGET_NOT_VISIBLE');
  } else if (abilityId === 'jam') {
    if (!target || typeof target !== 'string' || target === actor)
      return reject(state, 'ABILITY_TARGET_INVALID');
    factionTarget = target;
    const enemy = state.factions.find(({ id }) => id === factionTarget);
    if (!enemy || enemy.eliminatedAtTick !== null)
      return reject(state, 'ABILITY_TARGET_INVALID');
  } else if (target !== undefined)
    return reject(state, 'ABILITY_TARGET_INVALID');

  let next = withCooldown(state, actor, abilityId, rules.costCenti);
  const activeUntilTick = state.elapsedTicks + rules.durationTicks;
  if (abilityId === 'artillery') {
    const strike: ScheduledStrike = {
      factionId: actor,
      cell: { ...cellTarget! },
      impactTick: activeUntilTick,
    };
    next = { ...next, scheduledStrikes: [...next.scheduledStrikes, strike] };
  } else if (abilityId === 'surge') {
    next = {
      ...next,
      factions: next.factions.map((entry) =>
        entry.id === actor
          ? { ...entry, productionBoostUntilTick: activeUntilTick }
          : entry,
      ),
    };
  } else if (abilityId === 'smoke') {
    next = {
      ...next,
      units: next.units.map((unit) =>
        unit.factionId === actor &&
        unit.hp > 0 &&
        sameCellDistanceSquared(unit.cell, cellTarget!) <= rules.radius ** 2
          ? { ...unit, smokeUntilTick: activeUntilTick }
          : unit,
      ),
    };
  } else if (abilityId === 'bulwark') {
    next = {
      ...next,
      factions: next.factions.map((entry) =>
        entry.id === actor
          ? { ...entry, bulwarkUntilTick: activeUntilTick }
          : entry,
      ),
    };
  } else if (abilityId === 'survey') {
    const effect: SurveyEffect = {
      factionId: actor,
      cell: { ...cellTarget! },
      radius: rules.radius,
      expiresAtTick: activeUntilTick,
    };
    next = { ...next, surveys: [...next.surveys, effect] };
  } else {
    next = {
      ...next,
      factions: next.factions.map((entry) =>
        entry.id === factionTarget
          ? {
              ...entry,
              jammedUntilTick: Math.max(entry.jammedUntilTick, activeUntilTick),
            }
          : entry,
      ),
    };
  }
  return { ok: true, state: next };
}

export function isBulwarkActive(
  state: Pick<MatchState, 'elapsedTicks' | 'factions'>,
  owner: CombatantId | null,
): boolean {
  return (
    owner !== null &&
    (state.factions.find(({ id }) => id === owner)?.bulwarkUntilTick ?? 0) >
      state.elapsedTicks
  );
}

export function incomingDamage(
  state: Pick<MatchState, 'elapsedTicks' | 'factions' | 'rules'>,
  owner: CombatantId | null,
  damage: number,
): number {
  if (!isBulwarkActive(state, owner)) return damage;
  const percent = state.rules.tacticalAbilities.bulwark.damageTakenPercent;
  return damage > 0 ? Math.max(1, Math.floor((damage * percent) / 100)) : 0;
}

export function advanceTacticalEffects(state: MatchState): MatchState {
  return {
    ...state,
    scheduledStrikes: state.scheduledStrikes.filter(
      (strike) => strike.impactTick > state.elapsedTicks,
    ),
    surveys: state.surveys.filter(
      (survey) => survey.expiresAtTick > state.elapsedTicks,
    ),
  };
}
