import { MAP_WIDTH } from './config';
import {
  getUnitPositionX2,
  getUnitPositionY2,
  isUnitVisibleToFaction,
} from './visibility';
import type {
  BaseView,
  FactionId,
  FactionKnowledge,
  FactionView,
  MatchState,
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
  return state.bases.map((base): BaseView => {
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
        captureCandidate: base.captureCandidate,
        captureTicks: base.captureTicks,
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
        captureCandidate: base.captureCandidate,
        captureTicks: base.captureTicks,
      };
    }
    const memory = memories.get(base.id);
    if (!memory) {
      return {
        visibility: 'unknown',
        id: base.id,
        kind: base.kind,
        cell: { ...base.cell },
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
      id: unit.id,
      factionId: unit.factionId,
      kind: unit.kind,
      hp: unit.hp,
      maxHp: unit.maxHp,
      cell: { ...unit.cell },
      path: unit.path.map((cell) => ({ ...cell })),
      edgeProgress: unit.edgeProgress,
    }));
  const visibleEnemies = state.units
    .filter(
      (unit) =>
        unit.factionId !== factionId &&
        isUnitVisibleToFaction(state, unit, factionId),
    )
    .map((unit) => ({
      control: 'enemy' as const,
      id: unit.id,
      factionId: unit.factionId,
      kind: unit.kind,
      positionX2: getUnitPositionX2(unit),
      positionY2: getUnitPositionY2(unit),
      hp: unit.hp,
      maxHp: unit.maxHp,
    }));
  return {
    viewerFactionId: factionId,
    seed: state.seed,
    scenarioId: state.scenarioId,
    phase: state.phase,
    tick: state.elapsedTicks,
    map: {
      width: state.map.width,
      height: state.map.height,
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
      productionJobs: faction.productionJobs.map((job) => ({ ...job })),
      activeResearch: faction.activeResearch
        ? { ...faction.activeResearch }
        : null,
      completedResearchIds: [...faction.completedResearchIds],
    },
    ownUnits,
    visibleEnemies,
    bases: baseViews(state, factionId, knowledge),
  };
}
