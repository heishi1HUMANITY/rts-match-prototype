import { researchEffectValue } from './research';
import type { CombatantId, MatchState, UnitState } from './types';

const POSITION_SCALE = 1024;

export function isAirDefenseDeployed(
  state: MatchState,
  unit: UnitState,
): boolean {
  return (
    unit.kind === 'antiAir' &&
    unit.path.length === 0 &&
    unit.edgeProgress === 0 &&
    (unit.stationaryTicks ?? 0) >= state.rules.airDefense.deployTicks
  );
}

export function airDefenseRange(state: MatchState, unit: UnitState): number {
  const range = state.rules.units.antiAir.range;
  return isAirDefenseDeployed(state, unit)
    ? range
    : Math.floor((range * state.rules.airDefense.movingRangePercent) / 100);
}

export function airDefenseDamagePercent(
  state: MatchState,
  unit: UnitState,
): number {
  return isAirDefenseDeployed(state, unit)
    ? 100
    : state.rules.airDefense.movingDamagePercent;
}

export function airDefenseRecognitionGraceTicks(
  state: MatchState,
  factionId: CombatantId,
  antiAir: UnitState,
): number {
  const faction = state.factions.find(({ id }) => id === factionId);
  const jammerRangeSquared =
    (state.rules.facilities.definitions.jammer.jamRange * POSITION_SCALE) ** 2;
  const jammedByFacility = state.facilities.some(
    (facility) =>
      facility.kind === 'jammer' &&
      facility.owner !== antiAir.factionId &&
      facility.hp > 0 &&
      facility.remainingBuildTicks === 0 &&
      (antiAir.cell.x * POSITION_SCALE +
        POSITION_SCALE / 2 -
        (facility.cell.x * POSITION_SCALE + POSITION_SCALE / 2)) **
        2 +
        (antiAir.cell.y * POSITION_SCALE +
          POSITION_SCALE / 2 -
          (facility.cell.y * POSITION_SCALE + POSITION_SCALE / 2)) **
          2 <=
        jammerRangeSquared,
  );
  return (faction?.jammedUntilTick ?? 0) > state.elapsedTicks ||
    jammedByFacility
    ? state.rules.airDefense.jammedRecognitionGraceTicks
    : state.rules.airDefense.recognitionGraceTicks;
}

function distanceSquared(a: UnitState, b: UnitState): number {
  const dx =
    a.cell.x * POSITION_SCALE +
    POSITION_SCALE / 2 -
    (b.cell.x * POSITION_SCALE + POSITION_SCALE / 2);
  const dy =
    a.cell.y * POSITION_SCALE +
    POSITION_SCALE / 2 -
    (b.cell.y * POSITION_SCALE + POSITION_SCALE / 2);
  return dx * dx + dy * dy;
}

function sensorMultiplier(state: MatchState, observer: UnitState): number {
  const faction = state.factions.find(({ id }) => id === observer.factionId);
  if (!faction) return 1;
  let multiplier =
    faction.jammedUntilTick > state.elapsedTicks
      ? state.rules.tacticalAbilities.jam.visionPercent / 100
      : 1;
  const jammerRangeSquared =
    (state.rules.facilities.definitions.jammer.jamRange * POSITION_SCALE) ** 2;
  const jammerCount = state.facilities.filter(
    (facility) =>
      facility.kind === 'jammer' &&
      facility.owner !== observer.factionId &&
      facility.hp > 0 &&
      facility.remainingBuildTicks === 0 &&
      (observer.cell.x * POSITION_SCALE +
        POSITION_SCALE / 2 -
        (facility.cell.x * POSITION_SCALE + POSITION_SCALE / 2)) **
        2 +
        (observer.cell.y * POSITION_SCALE +
          POSITION_SCALE / 2 -
          (facility.cell.y * POSITION_SCALE + POSITION_SCALE / 2)) **
          2 <=
        jammerRangeSquared,
  ).length;
  multiplier *= 0.5 ** jammerCount;
  return multiplier;
}

/** Returns the AA-only identification radius; it never reveals nearby non-AA entities. */
export function airDefenseRecognitionRadius(
  state: MatchState,
  antiAir: UnitState,
  helicopter: UnitState,
): number {
  const rules = state.rules;
  const observerFaction = state.factions.find(
    ({ id }) => id === helicopter.factionId,
  );
  const visionBonus = observerFaction
    ? researchEffectValue(observerFaction, rules, 'vision-bonus')
    : 0;
  const normalTicks = rules.airDefense.recognitionGraceTicks;
  const jammedTicks = rules.airDefense.jammedRecognitionGraceTicks;
  const helicopterMoveTicks =
    helicopter.moveTicksPerCell ?? rules.units.helicopter.moveTicksPerCell;
  const antiAirMoveTicks =
    antiAir.moveTicksPerCell ?? rules.units.antiAir.moveTicksPerCell;
  const closingRate =
    1 / helicopterMoveTicks +
    (antiAir.path.length > 0 ? 1 / antiAirMoveTicks : 0);
  const minimumRadius =
    airDefenseRange(state, antiAir) + (jammedTicks / closingRate) * Math.SQRT2;
  const normalRadius =
    airDefenseRange(state, antiAir) +
    (normalTicks / closingRate) * Math.SQRT2 +
    visionBonus;
  return Math.max(
    normalRadius * sensorMultiplier(state, helicopter),
    minimumRadius,
  );
}

export function isAirDefenseRecognized(
  state: MatchState,
  antiAir: UnitState,
  factionId: CombatantId,
): boolean {
  const observers = state.units.filter(
    (unit) =>
      unit.factionId === factionId &&
      unit.kind === 'helicopter' &&
      unit.hp > 0 &&
      !unit.garrisonedAtBaseId,
  );
  return observers.some((helicopter) => {
    const radius =
      airDefenseRecognitionRadius(state, antiAir, helicopter) * POSITION_SCALE;
    return distanceSquared(antiAir, helicopter) <= radius * radius;
  });
}
