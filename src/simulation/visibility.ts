import { researchEffectValue } from './research';
import type {
  BaseState,
  CombatantId,
  FactionKnowledge,
  MatchState,
  UnitState,
} from './types';

const POSITION_SCALE = 1024;

function unitPositionX1024(unit: UnitState): number {
  const next = unit.path[0];
  return (
    POSITION_SCALE * unit.cell.x +
    POSITION_SCALE / 2 +
    (next
      ? Math.round(
          (POSITION_SCALE * unit.edgeProgress * (next.x - unit.cell.x)) /
            (unit.moveTicksPerCell ?? 2),
        )
      : 0)
  );
}

function unitPositionY1024(unit: UnitState): number {
  const next = unit.path[0];
  return (
    POSITION_SCALE * unit.cell.y +
    POSITION_SCALE / 2 +
    (next
      ? Math.round(
          (POSITION_SCALE * unit.edgeProgress * (next.y - unit.cell.y)) /
            (unit.moveTicksPerCell ?? 2),
        )
      : 0)
  );
}

interface SightSource {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

function sightSources(
  state: MatchState,
  factionId: CombatantId,
): SightSource[] {
  if (
    (factionId === 'local' &&
      (!state.localFaction.active || state.localFaction.defeated)) ||
    (factionId !== 'local' &&
      state.factions.find(({ id }) => id === factionId)?.eliminatedAtTick !==
        null)
  ) {
    return [];
  }
  const sources: SightSource[] = [];
  const ownerFaction =
    factionId === 'local'
      ? undefined
      : state.factions.find(({ id }) => id === factionId);
  const visionBonus = ownerFaction
    ? researchEffectValue(ownerFaction, state.rules, 'vision-bonus')
    : 0;
  const abilityJamPercent =
    ownerFaction && ownerFaction.jammedUntilTick > state.elapsedTicks
      ? state.rules.tacticalAbilities.jam.visionPercent
      : 100;
  for (const unit of state.units) {
    if (unit.factionId !== factionId || unit.hp <= 0) continue;
    sources.push({
      x: unitPositionX1024(unit),
      y: unitPositionY1024(unit),
      radius: state.rules.units[unit.kind].vision + visionBonus,
    });
  }
  for (const base of state.bases) {
    if (base.owner !== factionId || base.hp <= 0) continue;
    sources.push({
      x: POSITION_SCALE * base.cell.x + POSITION_SCALE / 2,
      y: POSITION_SCALE * base.cell.y + POSITION_SCALE / 2,
      radius: state.rules.bases[base.kind].vision + visionBonus,
    });
  }
  for (const crossing of state.crossings) {
    if (crossing.owner !== factionId || crossing.hp <= 0) continue;
    const site = state.map.crossingSites?.find(
      ({ id }) => id === crossing.siteId,
    );
    if (!site) continue;
    const center = site.cells[Math.floor(site.cells.length / 2)] ?? site.bankA;
    sources.push({
      x: POSITION_SCALE * center.x + POSITION_SCALE / 2,
      y: POSITION_SCALE * center.y + POSITION_SCALE / 2,
      radius: state.rules.crossings[site.tier].vision + visionBonus,
    });
  }
  const jammers = state.facilities.filter(
    (f) => f.kind === 'jammer' && f.hp > 0 && f.remainingBuildTicks === 0,
  );
  const jamCount = (x: number, y: number) =>
    jammers.filter(
      (f) =>
        f.owner !== factionId &&
        (x - (f.cell.x * 1024 + 512)) ** 2 +
          (y - (f.cell.y * 1024 + 512)) ** 2 <=
          (state.rules.facilities.definitions.jammer.jamRange * 1024) ** 2,
    ).length;
  for (const f of state.facilities)
    if (
      f.owner === factionId &&
      state.rules.facilities.definitions[f.kind].vision > 0 &&
      f.hp > 0 &&
      f.remainingBuildTicks === 0 &&
      (f.kind !== 'watchtower' ||
        jamCount(f.cell.x * 1024 + 512, f.cell.y * 1024 + 512) === 0)
    )
      sources.push({
        x: f.cell.x * 1024 + 512,
        y: f.cell.y * 1024 + 512,
        radius: state.rules.facilities.definitions[f.kind].vision + visionBonus,
      });
  const activeSurveys = state.surveys
    .filter(
      (survey) =>
        survey.factionId === factionId &&
        survey.expiresAtTick > state.elapsedTicks,
    )
    .map((survey) => ({
      x: survey.cell.x * POSITION_SCALE + 512,
      y: survey.cell.y * POSITION_SCALE + 512,
      radius: survey.radius,
    }));
  return [
    ...sources.map((source) => ({
      ...source,
      radius:
        source.radius *
        0.5 ** jamCount(source.x, source.y) *
        (abilityJamPercent / 100),
    })),
    ...activeSurveys,
  ];
}

function isPointVisible(
  sources: readonly SightSource[],
  x: number,
  y: number,
): boolean {
  return sources.some(({ x: sx, y: sy, radius }) => {
    const dx = x - sx;
    const dy = y - sy;
    return dx * dx + dy * dy <= (POSITION_SCALE * radius) ** 2;
  });
}

/** Unit visibility uses fixed 1/1024-cell coordinates for every movement speed. */
export function isUnitVisibleToFaction(
  state: MatchState,
  unit: UnitState,
  factionId: CombatantId,
): boolean {
  if (unit.hp <= 0) return false;
  if (
    factionId !== unit.factionId &&
    (unit.smokeUntilTick ?? 0) > state.elapsedTicks &&
    (unit.attack?.phase ?? 'idle') === 'idle'
  )
    return false;
  const concealed = state.facilities.some(
    (f) =>
      f.kind === 'jammer' &&
      f.owner === unit.factionId &&
      f.hp > 0 &&
      f.remainingBuildTicks === 0 &&
      (unitPositionX1024(unit) - (f.cell.x * 1024 + 512)) ** 2 +
        (unitPositionY1024(unit) - (f.cell.y * 1024 + 512)) ** 2 <=
        (state.rules.facilities.definitions.jammer.jamRange * 1024) ** 2,
  );
  return isPointVisible(
    sightSources(state, factionId).map((source) => ({
      ...source,
      radius:
        source.radius * (concealed && unit.factionId !== factionId ? 0.5 : 1),
    })),
    unitPositionX1024(unit),
    unitPositionY1024(unit),
  );
}

/** Checks a public map cell against current sight sources without changing knowledge. */
export function isCellVisibleToFaction(
  state: MatchState,
  cell: { readonly x: number; readonly y: number },
  factionId: CombatantId,
): boolean {
  return isPointVisible(
    sightSources(state, factionId),
    POSITION_SCALE * cell.x + POSITION_SCALE / 2,
    POSITION_SCALE * cell.y + POSITION_SCALE / 2,
  );
}

export function getUnitPositionX1024(unit: UnitState): number {
  return unitPositionX1024(unit);
}
export function getUnitPositionY1024(unit: UnitState): number {
  return unitPositionY1024(unit);
}

function memoryFromVisible(
  base: BaseState,
  tick: number,
): FactionKnowledge['baseMemory'][number] {
  return {
    baseId: base.id,
    owner: base.owner,
    hp: base.hp,
    seenTick: tick,
    selfReportedLost: false,
    defenderHp: base.defender?.hp ?? 0,
    defenderMaxHp: base.defender?.maxHp ?? 0,
  };
}

function createKnowledge(
  state: MatchState,
  factionId: CombatantId,
  previous?: FactionKnowledge,
): FactionKnowledge {
  const sources = sightSources(state, factionId);
  const visible = new Array<boolean>(state.map.width * state.map.height).fill(
    false,
  );
  for (const source of sources) {
    const centerX = source.x / POSITION_SCALE;
    const centerY = source.y / POSITION_SCALE;
    const radius = source.radius + 1;
    const minX = Math.max(0, Math.floor(centerX - radius));
    const maxX = Math.min(state.map.width - 1, Math.ceil(centerX + radius));
    const minY = Math.max(0, Math.floor(centerY - radius));
    const maxY = Math.min(state.map.height - 1, Math.ceil(centerY + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const index = y * state.map.width + x;
        if (
          !visible[index] &&
          isPointVisible(
            sources,
            POSITION_SCALE * x + POSITION_SCALE / 2,
            POSITION_SCALE * y + POSITION_SCALE / 2,
          )
        )
          visible[index] = true;
      }
    }
  }
  const explored = visible.map(
    (isVisible, index) => isVisible || (previous?.explored[index] ?? false),
  );
  const oldMemory = new Map(
    previous?.baseMemory.map((memory) => [memory.baseId, memory]) ?? [],
  );
  const oldCrossingMemory = new Map(
    previous?.crossingMemory.map((memory) => [memory.siteId, memory]) ?? [],
  );
  const baseMemory = state.bases
    .map((base) => {
      const index = base.cell.y * state.map.width + base.cell.x;
      if (visible[index]) return memoryFromVisible(base, state.elapsedTicks);
      const old = oldMemory.get(base.id);
      if (
        old?.owner === factionId &&
        (base.owner !== factionId || base.hp <= 0)
      ) {
        return { ...old, selfReportedLost: true };
      }
      return old ?? null;
    })
    .filter((memory): memory is NonNullable<typeof memory> => memory !== null);
  const crossingMemory = state.crossings
    .map((crossing) => {
      const site = state.map.crossingSites?.find(
        ({ id }) => id === crossing.siteId,
      );
      if (!site) return null;
      const isVisible =
        site.cells.some((cell) => visible[cell.y * state.map.width + cell.x]) ||
        visible[site.bankA.y * state.map.width + site.bankA.x] ||
        visible[site.bankB.y * state.map.width + site.bankB.x];
      if (crossing.owner === factionId || isVisible)
        return { ...crossing, seenTick: state.elapsedTicks };
      return oldCrossingMemory.get(crossing.siteId) ?? null;
    })
    .filter((memory): memory is NonNullable<typeof memory> => memory !== null);
  const memories = new Map(
    (previous?.facilityMemory ?? []).map((f) => [f.id, f]),
  );
  for (const [id, f] of memories)
    if (visible[f.cell.y * state.map.width + f.cell.x]) memories.delete(id);
  for (const f of state.facilities)
    if (
      f.owner === factionId ||
      (f.kind !== 'mine' && visible[f.cell.y * state.map.width + f.cell.x])
    )
      memories.set(f.id, {
        ...f,
        anchor: { ...f.anchor },
        cell: { ...f.cell },
        seenTick: state.elapsedTicks,
      });
  const facilityMemory = [...memories.values()];
  return {
    factionId,
    visible,
    explored,
    baseMemory,
    crossingMemory,
    facilityMemory,
  };
}

/** Recomputes every faction's current mask and durable exploration/base memory. */
export function updateFactionKnowledge(
  state: MatchState,
): readonly FactionKnowledge[] {
  const factions = state.factions.map((faction) => {
    const previous = state.knowledge?.find(
      (entry) => entry.factionId === faction.id,
    );
    return createKnowledge(state, faction.id, previous);
  });
  const localPrevious = state.knowledge?.find(
    (entry) => entry.factionId === 'local',
  );
  return [...factions, createKnowledge(state, 'local', localPrevious)];
}

/** Builds initial tick-zero knowledge without requiring a partially built state. */
export function createInitialKnowledge(
  state: MatchState,
): readonly FactionKnowledge[] {
  return [
    ...state.factions.map((faction) => createKnowledge(state, faction.id)),
    createKnowledge(state, 'local'),
  ];
}
