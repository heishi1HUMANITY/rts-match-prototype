import { createMatch } from './match';
import { canTraverse } from './map';
import { resolveCombat } from './combat';
import type {
  ActiveCrossing,
  BaseState,
  Cell,
  FactionId,
  FactionView,
  FacilityState,
  MatchState,
  UnitState,
} from './types';

export type CombatEstimateStatus =
  | 'favorable'
  | 'contested'
  | 'unfavorable'
  | 'unresolved'
  | 'unavailable';

export interface CombatEstimate {
  readonly status: CombatEstimateStatus;
  readonly ticks: number | null;
  readonly ownLost: number;
  readonly ownRemaining: number;
  readonly threatsRemaining: number;
  readonly threatsIncluded: number;
  readonly memoryNotes: readonly string[];
  readonly reason: string | null;
  readonly assumptions: readonly string[];
}

const idleAttack = { targetId: null, phase: 'idle' as const, phaseEndsTick: 0 };
const distanceSquared = (a: Cell, b: Cell): number =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const cellOf = (x1024: number, y1024: number): Cell => ({
  x: Math.floor(x1024 / 1024),
  y: Math.floor(y1024 / 1024),
});

function knownResearch(view: FactionView, factionId: FactionId): string[] {
  if (factionId === view.viewerFactionId)
    return [...view.ownFaction.completedResearchIds];
  return (view.researchAnnouncements ?? [])
    .filter(
      (entry) =>
        entry.factionId === factionId &&
        view.rules.research.definitions[entry.researchId]?.stage === 4,
    )
    .map(({ researchId }) => researchId);
}

function activeCrossings(view: FactionView): readonly ActiveCrossing[] {
  return view.crossings.flatMap((crossing) =>
    (crossing.visibility === 'owned' || crossing.visibility === 'visible') &&
    crossing.owner === view.viewerFactionId &&
    crossing.job === null
      ? [
          {
            ...crossing.site,
            owner: view.viewerFactionId,
            allowedUnitKinds: [],
          },
        ]
      : [],
  );
}

function translatedUnits(
  view: FactionView,
  unitIds: readonly string[],
  destination: Cell,
): { readonly units: readonly UnitState[]; readonly reason: string | null } {
  const selected = [...new Set(unitIds)]
    .map((id) => view.ownUnits.find((unit) => unit.id === id))
    .filter((unit) => unit !== undefined)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (selected.length === 0)
    return { units: [], reason: '自軍部隊を選択してください' };
  if (selected.length !== new Set(unitIds).size)
    return { units: [], reason: '選択部隊の観測情報が更新されました' };
  const origin = selected[0]!.cell;
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;
  const crossings = activeCrossings(view);
  const units = selected.map((unit) => {
    const cell = { x: unit.cell.x + dx, y: unit.cell.y + dy };
    if (
      !canTraverse(view.map, cell, {
        domain: view.rules.units[unit.kind].movementDomain,
        factionId: view.viewerFactionId,
        crossings,
        unitKind: unit.kind,
      })
    )
      return null;
    return {
      id: unit.id,
      factionId: view.viewerFactionId,
      kind: unit.kind,
      hp: unit.hp,
      maxHp: unit.maxHp,
      cell,
      path: [],
      edgeProgress: 0,
      moveTicksPerCell: view.rules.units[unit.kind].moveTicksPerCell,
      lastDamagedTick: 0,
      lastAttackTick: 0,
      stationaryTicks: 0,
      marchOrder: null,
      moveTarget: null,
      waypoints: [],
      garrisonedAtBaseId: null,
      smokeUntilTick: 0,
      bombardOrder: null,
      attack: { ...idleAttack },
    } satisfies UnitState;
  });
  if (units.some((unit) => unit === null))
    return {
      units: [],
      reason: '隊形の一部が盤外または移動できない地形に出ます',
    };
  return { units: units as UnitState[], reason: null };
}

function baseState(
  base: Extract<
    FactionView['bases'][number],
    { visibility: 'visible' | 'owned' }
  >,
): BaseState {
  const owner = base.owner;
  const defender =
    base.defenderHp !== null && base.defenderMaxHp !== null
      ? {
          hp: base.defenderHp,
          maxHp: base.defenderMaxHp,
          disabledTicks: 0,
          attack: { ...idleAttack },
        }
      : null;
  return {
    id: base.id,
    kind: base.kind,
    cell: { ...base.cell },
    owner,
    hp: base.hp,
    maxHp: base.maxHp,
    level: base.level,
    upgradeJob: null,
    lastDamagedTick: 0,
    captureCandidate: null,
    captureProgressCentiTicks: 0,
    defender,
    homeFactionId: base.kind === 'hq' && owner !== 'local' ? owner : null,
    attack: { ...idleAttack },
  };
}

function syntheticState(
  view: FactionView,
  selected: readonly UnitState[],
  opponents: readonly UnitState[],
  bases: readonly BaseState[],
  facilities: readonly FacilityState[],
): MatchState {
  const template = createMatch(view.seed, {
    rules: view.rules,
    scenarioId: view.scenarioId,
  });
  const announcements = view.researchAnnouncements ?? [];
  const factions = template.factions.map((faction) => ({
    ...faction,
    eliminatedAtTick: null,
    eliminationReason: null,
    supplyCenti: 0,
    researchCenti: 0,
    researchProgressCenti: {},
    researchRequiredCenti: {},
    ticketsCenti: 30_000,
    productionJobs: [],
    activeResearch: null,
    completedResearchIds: knownResearch(view, faction.id),
    nextUnitSerial: 1,
    nextJobSerial: 1,
    productionBoostUntilTick: 0,
    productionProgressRemainder: 0,
    productionProgressPercent: 100,
    bulwarkUntilTick: 0,
    jammedUntilTick: 0,
  }));
  const visibleResearchAnnouncements = announcements.filter(
    ({ researchId }) =>
      view.rules.research.definitions[researchId]?.stage === 4,
  );
  return {
    ...template,
    rules: view.rules,
    map: view.map,
    scenarioId: view.scenarioId,
    timeLimitTicks: view.timeLimitTicks,
    elapsedTicks: 0,
    phase: 'running',
    factions,
    units: [...selected, ...opponents],
    bases,
    facilities,
    crossings: [],
    scheduledStrikes: [],
    surveys: [],
    researchAnnouncements: visibleResearchAnnouncements,
    localFaction: {
      active: false,
      defeated: true,
      appearedAtTick: null,
      nextSpawnTick: null,
      rosterIndex: 0,
      stronghold: {
        id: 'forecast-hidden-local-excluded',
        cell: { x: 0, y: 0 },
        hp: 0,
        maxHp: 0,
      },
      supplyCenti: 0,
      conqueredBaseIds: [],
      rewardedBaseIds: [],
    },
    knowledge: template.knowledge.map((knowledge) => ({
      ...knowledge,
      visible: view.map.blocked.map(() => true),
      explored: view.map.blocked.map(() => true),
      baseMemory: [],
      crossingMemory: [],
      facilityMemory: [],
      airDefenseMemory: [],
    })),
    result: null,
  };
}

function staticAttackRange(view: FactionView, kind: UnitState['kind']): number {
  return view.rules.units[kind].range;
}

function isNearby(
  candidate: Cell,
  selected: readonly UnitState[],
  range: number,
): boolean {
  return selected.some(
    (unit) => distanceSquared(unit.cell, candidate) <= range ** 2,
  );
}

/**
 * Pure, observation-limited static engagement estimate. This signature is also
 * the contract intended for NPC strategy; it deliberately accepts no MatchState.
 */
export function estimateCombat(
  view: FactionView,
  selectedUnitIds: readonly string[],
  destination: Cell,
): CombatEstimate {
  const assumptions = [
    '交戦開始からの静止戦。行軍・増援・占領・経済・作戦指令は含みません。',
    '現在の可視戦力だけを対象にし、局所交戦に入る第三陣営も含めます。遠方部隊は除外します。',
    '全対象が互いを捕捉でき、開始時は攻撃準備完了と仮定。敵の非公開研究は標準値、公開専攻のみ反映します。',
    '限定静止戦は実combatと一致しますが、非公開firepower Iの強襲2機例では損耗を6HP少なく見積もりました。これは誤差上限ではありません。',
    `最大${view.rules.combatEstimate.maxTicks}tickで停止。予測は結果保証ではありません。`,
  ];
  const translated = translatedUnits(view, selectedUnitIds, destination);
  if (translated.reason !== null)
    return {
      status: 'unavailable',
      ticks: null,
      ownLost: 0,
      ownRemaining: 0,
      threatsRemaining: 0,
      threatsIncluded: 0,
      memoryNotes: [],
      reason: translated.reason,
      assumptions,
    };
  const selected = translated.units;
  const maxOwnRange = Math.max(
    0,
    ...selected.map((unit) => staticAttackRange(view, unit.kind)),
  );
  const visibleUnits: UnitState[] = view.visibleEnemies.map((enemy) => ({
    id: enemy.id,
    factionId: enemy.factionId,
    kind: enemy.kind,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    cell: cellOf(enemy.positionX1024, enemy.positionY1024),
    path: [],
    edgeProgress: 0,
    moveTicksPerCell: view.rules.units[enemy.kind].moveTicksPerCell,
    lastDamagedTick: 0,
    lastAttackTick: 0,
    stationaryTicks: 0,
    marchOrder: null,
    moveTarget: null,
    waypoints: [],
    garrisonedAtBaseId: null,
    smokeUntilTick: 0,
    bombardOrder: null,
    attack: { ...idleAttack },
  }));
  const opponents = visibleUnits.filter((unit) =>
    isNearby(
      unit.cell,
      selected,
      Math.max(maxOwnRange, view.rules.units[unit.kind].range),
    ),
  );
  const nearbyBases = view.bases
    .filter(
      (
        base,
      ): base is Extract<
        FactionView['bases'][number],
        { visibility: 'visible' | 'owned' }
      > => base.visibility === 'visible' || base.visibility === 'owned',
    )
    .filter((base) => isNearby(base.cell, selected, Math.max(maxOwnRange, 6)))
    .map(baseState);
  const nearbyFacilities: FacilityState[] = view.facilities
    .filter(
      (facility) =>
        (facility.visibility === 'owned' ||
          facility.visibility === 'visible') &&
        facility.remainingBuildTicks === 0 &&
        isNearby(facility.cell, selected, Math.max(maxOwnRange, 8)),
    )
    .map((facility) => ({
      id: facility.id,
      kind: facility.kind,
      owner: facility.owner,
      anchor: facility.anchor,
      slot: facility.slot,
      cell: facility.cell,
      hp: facility.hp,
      maxHp: facility.maxHp,
      remainingBuildTicks: 0,
      lastDamagedTick: 0,
      lastActivatedTick: 0,
      attack: { ...idleAttack },
    }));
  const state = syntheticState(
    view,
    selected,
    opponents,
    nearbyBases,
    nearbyFacilities,
  );
  const initialOwnHp = selected.reduce((sum, unit) => sum + unit.hp, 0);
  const initialThreats =
    opponents.length +
    nearbyBases.reduce(
      (sum, base) =>
        sum +
        Number(base.owner !== view.viewerFactionId && base.hp > 0) +
        Number((base.defender?.hp ?? 0) > 0),
      0,
    ) +
    nearbyFacilities.filter(
      (facility) => facility.owner !== view.viewerFactionId,
    ).length;
  if (initialThreats === 0)
    return {
      status: 'unavailable',
      ticks: null,
      ownLost: 0,
      ownRemaining: selected.length,
      threatsRemaining: 0,
      threatsIncluded: 0,
      memoryNotes: rememberedNotes(view, destination),
      reason: '地点の近くに予測できる可視脅威がありません',
      assumptions,
    };
  let current = state;
  let ticks = 0;
  const done = (snapshot: MatchState): boolean => {
    const ownAlive = snapshot.units.some(
      (unit) => unit.factionId === view.viewerFactionId && unit.hp > 0,
    );
    const threatAlive =
      snapshot.units.some(
        (unit) => unit.factionId !== view.viewerFactionId && unit.hp > 0,
      ) ||
      snapshot.bases.some(
        (base) =>
          base.owner !== view.viewerFactionId &&
          (base.hp > 0 || (base.defender?.hp ?? 0) > 0),
      ) ||
      snapshot.facilities.some(
        (facility) =>
          facility.owner !== view.viewerFactionId && facility.hp > 0,
      );
    return !ownAlive || !threatAlive;
  };
  while (ticks < view.rules.combatEstimate.maxTicks && !done(current)) {
    current = resolveCombat({ ...current, elapsedTicks: ticks });
    ticks += 1;
  }
  const ownAfter = current.units.filter(
    (unit) => unit.factionId === view.viewerFactionId && unit.hp > 0,
  );
  const ownAfterHp = ownAfter.reduce((sum, unit) => sum + unit.hp, 0);
  const threatsRemaining =
    current.units.filter(
      (unit) => unit.factionId !== view.viewerFactionId && unit.hp > 0,
    ).length +
    current.bases.reduce(
      (sum, base) =>
        sum +
        Number(base.owner !== view.viewerFactionId && base.hp > 0) +
        Number((base.defender?.hp ?? 0) > 0),
      0,
    ) +
    current.facilities.filter(
      (facility) => facility.owner !== view.viewerFactionId && facility.hp > 0,
    ).length;
  const completed = done(current);
  const ownSurvives = ownAfter.length > 0;
  return {
    status: !completed
      ? 'unresolved'
      : !ownSurvives
        ? 'unfavorable'
        : threatsRemaining === 0
          ? 'favorable'
          : 'contested',
    ticks: completed ? ticks : null,
    ownLost: Math.max(0, initialOwnHp - ownAfterHp),
    ownRemaining: ownAfter.length,
    threatsRemaining,
    threatsIncluded: initialThreats,
    memoryNotes: rememberedNotes(view, destination),
    reason: completed ? null : '上限時間内に決着しません',
    assumptions,
  };
}

function rememberedNotes(view: FactionView, destination: Cell): string[] {
  const notes: string[] = [];
  for (const base of view.bases) {
    if (base.visibility !== 'remembered') continue;
    if (distanceSquared(base.cell, destination) > 8 ** 2) continue;
    notes.push(
      `拠点 ${base.id} · ${Math.max(0, view.tick - base.seenTick)}tick前の記憶（予測対象外）`,
    );
  }
  for (const facility of view.facilities) {
    if (facility.visibility !== 'remembered') continue;
    if (distanceSquared(facility.cell, destination) > 8 ** 2) continue;
    notes.push(
      `施設 ${facility.kind} · ${Math.max(0, view.tick - (facility.seenTick ?? 0))}tick前の記憶（予測対象外）`,
    );
  }
  for (const memory of view.airDefenseMemory) {
    if (distanceSquared(memory.cell, destination) > 8 ** 2) continue;
    notes.push(
      `対空位置 · ${Math.max(0, view.tick - memory.seenTick)}tick前の記憶（予測対象外）`,
    );
  }
  return notes.sort();
}
