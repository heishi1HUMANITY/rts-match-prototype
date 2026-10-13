import { MAP_WIDTH } from './config';
import {
  getUnitPositionX1024,
  getUnitPositionY1024,
  isCellVisibleToFaction,
  isUnitVisibleToFaction,
} from './visibility';
import type {
  BaseView,
  FacilityView,
  FactionId,
  FactionKnowledge,
  FactionView,
  MatchState,
  CrossingView,
} from './types';

function copyKnowledgeMap(knowledge: FactionKnowledge): {
  visible: boolean[];
  explored: boolean[];
} {
  return { visible: [...knowledge.visible], explored: [...knowledge.explored] };
}

function baseViews(
  state: MatchState,
  factionId: FactionId,
  knowledge: FactionKnowledge,
): BaseView[] {
  const memories = new Map(
    knowledge.baseMemory.map((memory) => [memory.baseId, memory]),
  );
  const views = state.bases.map((base): BaseView => {
    const cellIndex = base.cell.y * MAP_WIDTH + base.cell.x;
    if (base.owner === factionId) {
      return {
        visibility: 'owned',
        id: base.id,
        kind: base.kind,
        cell: { ...base.cell },
        owner: factionId,
        hp: base.hp,
        maxHp: base.maxHp,
        level: base.level,
        upgradeJob: base.upgradeJob ? { ...base.upgradeJob } : null,
        defenderHp: base.defender?.hp ?? null,
        defenderMaxHp: base.defender?.maxHp ?? null,
        captureCandidate: base.captureCandidate,
        captureProgressCentiTicks: base.captureProgressCentiTicks,
      };
    }
    if (knowledge.visible[cellIndex]) {
      return {
        visibility: 'visible',
        id: base.id,
        kind: base.kind,
        cell: { ...base.cell },
        owner: base.owner,
        hp: base.hp,
        maxHp: base.maxHp,
        level: base.level,
        defenderHp: base.defender?.hp ?? null,
        defenderMaxHp: base.defender?.maxHp ?? null,
        captureCandidate: base.captureCandidate,
        captureProgressCentiTicks: base.captureProgressCentiTicks,
      };
    }
    const memory = memories.get(base.id);
    if (!memory) {
      return {
        visibility: 'unknown',
        id: base.id,
        kind: base.kind,
        cell: { ...base.cell },
        defenderHp: null,
        defenderMaxHp: null,
      };
    }
    return {
      visibility: 'remembered',
      id: base.id,
      kind: base.kind,
      cell: { ...base.cell },
      owner: memory.owner,
      hp: memory.hp,
      seenTick: memory.seenTick,
      selfReportedLost: memory.selfReportedLost,
      defenderHp: memory.defenderHp,
      defenderMaxHp: memory.defenderMaxHp,
    };
  });
  if (
    (state.localFaction.active || state.localFaction.defeated) &&
    (state.localFaction.defeated ||
      isCellVisibleToFaction(
        state,
        state.localFaction.stronghold.cell,
        factionId,
      ))
  ) {
    const stronghold = state.localFaction.stronghold;
    views.push({
      visibility: 'visible',
      id: stronghold.id,
      kind: 'hq',
      cell: { ...stronghold.cell },
      owner: 'local',
      hp: state.localFaction.defeated ? 0 : stronghold.hp,
      maxHp: stronghold.maxHp,
      level: 1,
      defenderHp: null,
      defenderMaxHp: null,
      captureCandidate: null,
      captureProgressCentiTicks: 0,
    });
  }
  return views;
}

function crossingViews(
  state: MatchState,
  factionId: FactionId,
  knowledge: FactionKnowledge,
): CrossingView[] {
  const memories = new Map(
    knowledge.crossingMemory.map((memory) => [memory.siteId, memory]),
  );
  return (state.map.crossingSites ?? []).map((site): CrossingView => {
    const crossing = state.crossings.find(({ siteId }) => siteId === site.id);
    if (!crossing)
      return {
        visibility: 'unknown',
        site: { ...site },
        owner: null,
        hp: null,
        maxHp: null,
        job: null,
      };
    const visible = [...site.cells, site.bankA, site.bankB].some((cell) =>
      isCellVisibleToFaction(state, cell, factionId),
    );
    if (crossing.owner === factionId)
      return {
        visibility: 'owned',
        site: { ...site },
        owner: crossing.owner,
        hp: crossing.hp,
        maxHp: crossing.maxHp,
        job: crossing.job ? { ...crossing.job } : null,
      };
    if (visible)
      return {
        visibility: 'visible',
        site: { ...site },
        owner: crossing.owner,
        hp: crossing.hp,
        maxHp: crossing.maxHp,
        job: crossing.job ? { ...crossing.job } : null,
      };
    const memory = memories.get(site.id);
    if (memory)
      return {
        visibility: 'remembered',
        site: { ...site },
        owner: memory.owner,
        hp: memory.hp,
        maxHp: memory.maxHp,
        job: memory.job ? { ...memory.job } : null,
        seenTick: memory.seenTick,
      };
    return {
      visibility: 'unknown',
      site: { ...site },
      owner: null,
      hp: null,
      maxHp: null,
      job: null,
    };
  });
}

/** Produces a detached, information-limited snapshot for one faction. */
export function getFactionView(
  state: MatchState,
  factionId: FactionId,
): FactionView {
  const faction = state.factions.find((entry) => entry.id === factionId);
  const knowledge = state.knowledge.find(
    (entry) => entry.factionId === factionId,
  );
  if (!faction || !knowledge) throw new RangeError('unknown factionId');
  const masks = copyKnowledgeMap(knowledge);
  const ownUnits = state.units
    .filter((unit) => unit.factionId === factionId && unit.hp > 0)
    .map((unit) => ({
      control: 'own' as const,
      jammed: state.facilities.some(
        (f) =>
          f.kind === 'jammer' &&
          f.owner !== factionId &&
          f.hp > 0 &&
          f.remainingBuildTicks === 0 &&
          (getUnitPositionX1024(unit) - (f.cell.x * 1024 + 512)) ** 2 +
            (getUnitPositionY1024(unit) - (f.cell.y * 1024 + 512)) ** 2 <=
            (state.rules.facilities.definitions.jammer.jamRange * 1024) ** 2,
      ),
      id: unit.id,
      factionId: unit.factionId,
      kind: unit.kind,
      hp: unit.hp,
      maxHp: unit.maxHp,
      cell: { ...unit.cell },
      path: unit.path.map((cell) => ({ ...cell })),
      edgeProgress: unit.edgeProgress,
      moveTicksPerCell:
        unit.moveTicksPerCell ?? state.rules.units[unit.kind].moveTicksPerCell,
      marchOrder: unit.marchOrder
        ? {
            ...unit.marchOrder,
            target: { ...unit.marchOrder.target },
            lastKnownCell: { ...unit.marchOrder.lastKnownCell },
          }
        : null,
      moveTarget: unit.moveTarget ? { ...unit.moveTarget } : null,
      garrisonedAtBaseId: unit.garrisonedAtBaseId ?? null,
    }));
  const visibleEnemies = state.units
    .filter(
      (unit) =>
        unit.factionId !== factionId &&
        !unit.garrisonedAtBaseId &&
        isUnitVisibleToFaction(state, unit, factionId),
    )
    .map((unit) => ({
      control: 'enemy' as const,
      id: unit.id,
      factionId: unit.factionId,
      kind: unit.kind,
      positionX1024: getUnitPositionX1024(unit),
      positionY1024: getUnitPositionY1024(unit),
      hp: unit.hp,
      maxHp: unit.maxHp,
    }));
  return {
    viewerFactionId: factionId,
    seed: state.seed,
    scenarioId: state.scenarioId,
    phase: state.phase,
    tick: state.elapsedTicks,
    timeLimitTicks: state.timeLimitTicks,
    rules: JSON.parse(JSON.stringify(state.rules)) as MatchState['rules'],
    result:
      state.result === null
        ? null
        : {
            reason: state.result.reason,
            endedAtTick: state.result.endedAtTick,
            standings: state.result.standings.map((standing) => ({
              factionId: standing.factionId,
              rank: standing.rank,
              ticketsCenti: standing.ticketsCenti,
              eliminatedAtTick: standing.eliminatedAtTick,
              eliminationReason: standing.eliminationReason,
            })),
          },
    publicEliminations: {
      A: {
        eliminatedAtTick:
          state.factions.find(({ id }) => id === 'A')?.eliminatedAtTick ?? null,
        eliminationReason:
          state.factions.find(({ id }) => id === 'A')?.eliminationReason ??
          null,
      },
      B: {
        eliminatedAtTick:
          state.factions.find(({ id }) => id === 'B')?.eliminatedAtTick ?? null,
        eliminationReason:
          state.factions.find(({ id }) => id === 'B')?.eliminationReason ??
          null,
      },
      C: {
        eliminatedAtTick:
          state.factions.find(({ id }) => id === 'C')?.eliminatedAtTick ?? null,
        eliminationReason:
          state.factions.find(({ id }) => id === 'C')?.eliminationReason ??
          null,
      },
    },
    map: {
      width: state.map.width,
      height: state.map.height,
      ...(state.map.terrain ? { terrain: [...state.map.terrain] } : {}),
      ...(state.map.terrainLevel
        ? { terrainLevel: [...state.map.terrainLevel] }
        : {}),
      ...(state.map.crossingSites
        ? {
            crossingSites: state.map.crossingSites.map((site) => ({
              ...site,
              bankA: { ...site.bankA },
              bankB: { ...site.bankB },
              cells: site.cells.map((cell) => ({ ...cell })),
            })),
          }
        : {}),
      ...(state.map.ports
        ? {
            ports: state.map.ports.map((port) => ({
              ...port,
              cell: { ...port.cell },
              shore: { ...port.shore },
            })),
          }
        : {}),
      blocked: [...state.map.blocked],
    },
    ticketsCenti: Object.fromEntries(
      state.factions.map((entry) => [entry.id, entry.ticketsCenti]),
    ) as Record<FactionId, number>,
    visible: masks.visible,
    explored: masks.explored,
    ownFaction: {
      id: faction.id,
      controller: faction.controller,
      supplyCenti: faction.supplyCenti,
      researchCenti: faction.researchCenti,
      researchProgressCenti: { ...faction.researchProgressCenti },
      ticketsCenti: faction.ticketsCenti,
      eliminatedAtTick: faction.eliminatedAtTick,
      eliminationReason: faction.eliminationReason,
      productionJobs: faction.productionJobs.map((job) => ({ ...job })),
      activeResearch: faction.activeResearch
        ? { ...faction.activeResearch }
        : null,
      completedResearchIds: [...faction.completedResearchIds],
    },
    ownUnits,
    visibleEnemies,
    localFaction: {
      active: state.localFaction.active,
      defeated: state.localFaction.defeated,
      stronghold: {
        visibility: state.localFaction.defeated
          ? 'destroyed'
          : !state.localFaction.active ||
              !isCellVisibleToFaction(
                state,
                state.localFaction.stronghold.cell,
                factionId,
              )
            ? 'hidden'
            : 'visible',
        id: state.localFaction.stronghold.id,
        cell:
          state.localFaction.defeated ||
          isCellVisibleToFaction(
            state,
            state.localFaction.stronghold.cell,
            factionId,
          )
            ? { ...state.localFaction.stronghold.cell }
            : null,
        hp:
          state.localFaction.active &&
          isCellVisibleToFaction(
            state,
            state.localFaction.stronghold.cell,
            factionId,
          )
            ? state.localFaction.stronghold.hp
            : state.localFaction.defeated
              ? 0
              : null,
        maxHp:
          state.localFaction.active &&
          isCellVisibleToFaction(
            state,
            state.localFaction.stronghold.cell,
            factionId,
          )
            ? state.localFaction.stronghold.maxHp
            : state.localFaction.defeated
              ? state.localFaction.stronghold.maxHp
              : null,
      },
      visibleUnitCount: visibleEnemies.filter(
        (unit) => unit.factionId === 'local',
      ).length,
      publicBaseCount: state.bases.filter(
        (base) => base.owner === 'local' && base.kind !== 'hq',
      ).length,
    },
    bases: baseViews(state, factionId, knowledge),
    crossings: crossingViews(state, factionId, knowledge),
    facilities: [
      ...knowledge.facilityMemory.filter((f) => f.owner !== factionId),
      ...state.facilities
        .filter((f) => f.owner === factionId)
        .map((f) => ({ ...f, seenTick: state.elapsedTicks })),
    ].flatMap<FacilityView>((memory) => {
      const current = state.facilities.find((f) => f.id === memory.id);
      if (current?.owner === factionId)
        return [
          {
            ...current,
            anchor: { ...current.anchor },
            cell: { ...current.cell },
            visibility: 'owned' as const,
          },
        ];
      if (memory.owner === factionId) return [];
      const visible = isCellVisibleToFaction(state, memory.cell, factionId);
      if (visible && (!current || current.kind === 'mine')) return [];
      return [
        {
          ...memory,
          anchor: { ...memory.anchor },
          cell: { ...memory.cell },
          visibility: visible ? ('visible' as const) : ('remembered' as const),
        },
      ];
    }),
  };
}
