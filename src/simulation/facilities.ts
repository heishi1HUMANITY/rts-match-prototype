import type {
  Cell,
  FacilityAnchor,
  FacilityKind,
  FacilityState,
  FactionId,
  MatchState,
  RejectCode,
  CommandResult,
} from './types';
import { researchEffectValue } from './research';
export const FACILITY_KINDS: readonly FacilityKind[] = [
  'turret',
  'antiAir',
  'mine',
  'watchtower',
  'jammer',
];
export function facilityAnchorCell(
  state: MatchState,
  owner: FactionId,
  anchor: FacilityAnchor,
): Cell | null {
  if (anchor.kind === 'base') {
    const base = state.bases.find((b) => b.id === anchor.id);
    return base?.owner === owner && base.hp > 0 ? base.cell : null;
  }
  const crossing = state.crossings.find((c) => c.siteId === anchor.id);
  const site = state.map.crossingSites?.find((s) => s.id === anchor.id);
  return crossing?.owner === owner &&
    crossing.hp > 0 &&
    crossing.job === null &&
    site
    ? (site.cells[Math.floor(site.cells.length / 2)] ?? site.bankA)
    : null;
}
/** Fixed public terrain order; enemy occupancy never changes acceptance or placement. */
export function facilityPlacement(
  state: MatchState,
  owner: FactionId,
  anchor: FacilityAnchor,
): Cell | null {
  const center = facilityAnchorCell(state, owner, anchor);
  if (!center) return null;
  const candidates = [
    { x: center.x, y: center.y - 1 },
    { x: center.x + 1, y: center.y },
    { x: center.x, y: center.y + 1 },
    { x: center.x - 1, y: center.y },
  ];
  return (
    candidates.find(
      (c) =>
        c.x >= 0 &&
        c.y >= 0 &&
        c.x < state.map.width &&
        c.y < state.map.height &&
        !state.map.blocked[c.y * state.map.width + c.x] &&
        !state.facilities.some(
          (f) => f.owner === owner && f.cell.x === c.x && f.cell.y === c.y,
        ),
    ) ?? null
  );
}
export function validateFacilityBuild(
  state: MatchState,
  actor: FactionId,
  kind: FacilityKind,
  anchor: FacilityAnchor,
): RejectCode | null {
  if (!FACILITY_KINDS.includes(kind)) return 'INVALID_FACILITY_KIND';
  if (!facilityAnchorCell(state, actor, anchor))
    return 'FACILITY_ANCHOR_UNAVAILABLE';
  if (
    anchor.kind === 'base' &&
    state.bases.find((b) => b.id === anchor.id)?.upgradeJob
  )
    return 'BASE_UPGRADE_BUSY';
  const faction = state.factions.find((f) => f.id === actor);
  if (!faction) return 'INVALID_ACTOR';
  const unlocked = faction.completedResearchIds.some((id) =>
    state.rules.research.definitions[id]?.effects.some(
      (e) => e.id === 'facility-unlock' && e.facilityKind === kind,
    ),
  );
  if (!unlocked) return 'RESEARCH_REQUIRED';
  const own = state.facilities.filter((f) => f.owner === actor);
  if (own.length >= state.rules.facilities.maxPerFaction)
    return 'FACILITY_LIMIT';
  const anchored = own.filter(
    (f) => f.anchor.kind === anchor.kind && f.anchor.id === anchor.id,
  );
  if (anchored.some((f) => f.kind === kind)) return 'FACILITY_DUPLICATE';
  if (anchored.length >= state.rules.facilities.slotsPerAnchor)
    return 'FACILITY_SLOTS_FULL';
  if (faction.supplyCenti < state.rules.facilities.definitions[kind].costCenti)
    return 'INSUFFICIENT_SUPPLY';
  if (!facilityPlacement(state, actor, anchor)) return 'FACILITY_NO_CELL';
  return null;
}
export function beginFacilityBuild(
  state: MatchState,
  actor: FactionId,
  kind: FacilityKind,
  anchor: FacilityAnchor,
): CommandResult {
  const reason = validateFacilityBuild(state, actor, kind, anchor);
  if (reason) return { ok: false, state, reason };
  const definition = state.rules.facilities.definitions[kind];
  const own = state.facilities.filter(
    (f) =>
      f.owner === actor &&
      f.anchor.kind === anchor.kind &&
      f.anchor.id === anchor.id,
  );
  let slot = 0;
  while (own.some((f) => f.slot === slot)) slot++;
  const faction = state.factions.find((f) => f.id === actor)!;
  const speed = researchEffectValue(
    faction,
    state.rules,
    'facility-build-speed-percent',
  );
  const facility: FacilityState = {
    id: `${actor}-F-${faction.nextJobSerial}`,
    kind,
    owner: actor,
    anchor: { ...anchor },
    slot,
    cell: facilityPlacement(state, actor, anchor)!,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    remainingBuildTicks: Math.max(
      1,
      Math.ceil((definition.buildTicks * 100) / (100 + speed)),
    ),
    lastDamagedTick: -1,
    lastActivatedTick: -1,
  };
  return {
    ok: true,
    state: {
      ...state,
      facilities: [...state.facilities, facility],
      factions: state.factions.map((f) =>
        f.id === actor
          ? {
              ...f,
              supplyCenti: f.supplyCenti - definition.costCenti,
              nextJobSerial: f.nextJobSerial + 1,
            }
          : f,
      ),
    },
  };
}
export function cleanupFacilities(state: MatchState): MatchState {
  return {
    ...state,
    facilities: state.facilities.filter(
      (f) => f.hp > 0 && facilityAnchorCell(state, f.owner, f.anchor) !== null,
    ),
  };
}
export function advanceFacilities(state: MatchState): MatchState {
  const cleaned = cleanupFacilities(state);
  return {
    ...cleaned,
    facilities: cleaned.facilities.map((f) =>
      f.remainingBuildTicks > 0
        ? { ...f, remainingBuildTicks: f.remainingBuildTicks - 1 }
        : f,
    ),
  };
}
