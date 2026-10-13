import type {
  FacilityAnchor,
  FacilityKind,
  FactionView,
} from '../simulation/types';
import { facilityCandidateCells } from '../simulation/facilities';

export const FACILITY_NAMES: Readonly<Record<FacilityKind, string>> = {
  turret: '砲座',
  antiAir: '対空陣地',
  mine: '地雷原',
  watchtower: '観測塔',
  jammer: '妨害塔',
};
export const FACILITY_GLYPHS: Readonly<Record<FacilityKind, string>> = {
  turret: '砲',
  antiAir: '空',
  mine: '雷',
  watchtower: '観',
  jammer: '妨',
};
export const FACILITY_KINDS: readonly FacilityKind[] = [
  'turret',
  'antiAir',
  'mine',
  'watchtower',
  'jammer',
];
export function ownFacilityAnchors(
  view: FactionView,
): readonly { anchor: FacilityAnchor; label: string }[] {
  return [
    ...view.bases
      .filter((base) => base.visibility === 'owned' && base.hp > 0)
      .map((base) => ({
        anchor: { kind: 'base' as const, id: base.id },
        label: `拠点 ${base.id}`,
      })),
    ...view.crossings
      .filter(
        (crossing) =>
          crossing.visibility === 'owned' &&
          crossing.hp > 0 &&
          crossing.job === null,
      )
      .map((crossing) => ({
        anchor: { kind: 'crossing' as const, id: crossing.site.id },
        label: `${crossing.site.tier.startsWith('bridge') ? '橋' : '索道'} ${crossing.site.id}`,
      })),
  ];
}
export function facilityBuildReason(
  view: FactionView,
  kind: FacilityKind,
  anchor: FacilityAnchor | null,
): string | null {
  if (view.ownFaction.eliminatedAtTick !== null) return '脱落 · 観戦中';
  if (view.phase !== 'running') return '開始・再開後に建築できます';
  if (
    !anchor ||
    !ownFacilityAnchors(view).some(
      (entry) =>
        entry.anchor.kind === anchor.kind && entry.anchor.id === anchor.id,
    )
  )
    return '所有拠点または完成した渡河設備を選んでください';
  if (
    anchor.kind === 'base' &&
    view.bases.some(
      (base) =>
        base.id === anchor.id &&
        base.visibility === 'owned' &&
        base.upgradeJob !== null,
    )
  )
    return '拠点の強化完了後に建築できます';
  if (
    !view.ownFaction.completedResearchIds.some((id) =>
      view.rules.research.definitions[id]?.effects.some(
        (effect) =>
          effect.id === 'facility-unlock' && effect.facilityKind === kind,
      ),
    )
  )
    return `${FACILITY_NAMES[kind]}の解放研究が必要です`;
  const own = view.facilities.filter(
    (facility) =>
      facility.owner === view.viewerFactionId &&
      facility.visibility === 'owned',
  );
  if (own.length >= view.rules.facilities.maxPerFaction)
    return '陣営の施設上限です（建築中も含む）';
  const anchored = own.filter(
    (facility) =>
      facility.anchor.kind === anchor.kind && facility.anchor.id === anchor.id,
  );
  if (anchored.some((facility) => facility.kind === kind))
    return 'この設置先には同じ種類が建築済み・建築中です';
  if (anchored.length >= view.rules.facilities.slotsPerAnchor)
    return '設置先の枠がすべて使用中です';
  if (
    view.ownFaction.supplyCenti <
    view.rules.facilities.definitions[kind].costCenti
  )
    return '補給が不足しています';
  const base =
    anchor.kind === 'base'
      ? view.bases.find((entry) => entry.id === anchor.id)
      : null;
  const site =
    anchor.kind === 'crossing'
      ? view.crossings.find((entry) => entry.site.id === anchor.id)?.site
      : null;
  const center =
    base?.cell ??
    (site
      ? (site.cells[Math.floor(site.cells.length / 2)] ?? site.bankA)
      : null);
  if (
    !center ||
    !facilityCandidateCells(center, site ? [site.bankA, site.bankB] : []).some(
      (cell) =>
        cell.x >= 0 &&
        cell.y >= 0 &&
        cell.x < view.map.width &&
        cell.y < view.map.height &&
        !view.map.blocked[cell.y * view.map.width + cell.x] &&
        !own.some(
          (facility) =>
            facility.cell.x === cell.x && facility.cell.y === cell.y,
        ),
    )
  )
    return '設置可能な隣接セルがありません';
  return null;
}

export function updateFacilitiesPanel(
  root: HTMLElement,
  view: FactionView,
  contextLost: boolean,
): void {
  const select = root.querySelector<HTMLSelectElement>(
    '[data-facility-anchor]',
  )!;
  const anchors = ownFacilityAnchors(view);
  const selected = select.value;
  const key = anchors
    .map(({ anchor }) => `${anchor.kind}:${anchor.id}`)
    .join('|');
  if (select.dataset.options !== key) {
    select.dataset.options = key;
    select.replaceChildren(
      ...anchors.map(
        ({ anchor, label }) => new Option(label, `${anchor.kind}:${anchor.id}`),
      ),
    );
    if (
      anchors.some(({ anchor }) => `${anchor.kind}:${anchor.id}` === selected)
    )
      select.value = selected;
  }
  const candidate =
    anchors.find(({ anchor }) => `${anchor.kind}:${anchor.id}` === select.value)
      ?.anchor ?? null;
  const own = view.facilities.filter(
    (facility) => facility.visibility === 'owned',
  );
  const attached = candidate
    ? own.filter(
        (facility) =>
          facility.anchor.kind === candidate.kind &&
          facility.anchor.id === candidate.id,
      )
    : [];
  root.querySelector<HTMLElement>('[data-facility-slots]')!.textContent =
    `設置先 ${attached.length}/${view.rules.facilities.slotsPerAnchor}枠 · 陣営全体 ${own.length}/${view.rules.facilities.maxPerFaction}基（建築中含む）`;
  const host = root.querySelector<HTMLElement>('.facility-options')!;
  if (!host.childElementCount)
    for (const kind of FACILITY_KINDS) {
      const card = document.createElement('div');
      card.className = 'facility-card';
      const button = document.createElement('button');
      button.dataset.facilityBuild = kind;
      button.textContent = `${FACILITY_GLYPHS[kind]} ${FACILITY_NAMES[kind]}`;
      const detail = document.createElement('small');
      detail.dataset.facilityDetail = kind;
      const reason = document.createElement('small');
      reason.dataset.facilityReason = kind;
      card.append(button, detail, reason);
      host.append(card);
    }
  for (const kind of FACILITY_KINDS) {
    const stats = view.rules.facilities.definitions[kind];
    const speed = view.ownFaction.completedResearchIds.reduce(
      (sum, id) =>
        sum +
        (view.rules.research.definitions[id]?.effects
          .filter((effect) => effect.id === 'facility-build-speed-percent')
          .reduce((value, effect) => value + effect.value, 0) ?? 0),
      0,
    );
    const reason = contextLost
      ? '画面復帰後に再開してください'
      : facilityBuildReason(view, kind, candidate);
    root.querySelector<HTMLButtonElement>(
      `[data-facility-build="${kind}"]`,
    )!.disabled = reason !== null;
    root.querySelector<HTMLElement>(
      `[data-facility-detail="${kind}"]`,
    )!.textContent =
      `補給 ${stats.costCenti / 100} · ${(Math.max(1, Math.ceil((stats.buildTicks * 100) / (100 + speed))) / 10).toFixed(1)}秒 · HP${stats.maxHp} · ${kind === 'watchtower' ? `視界${stats.vision}` : kind === 'jammer' ? `妨害半径${stats.jamRange}` : `射程${stats.range} · 陸${stats.damageVsLand}/空${stats.damageVsAir}/水${stats.damageVsWater}${kind === 'mine' ? '（一撃・一回）' : `/射撃・${((stats.intervalTicks ?? stats.attackIntervalTicks ?? 10) / 10).toFixed(1)}秒間隔`}`}`;
    root.querySelector<HTMLElement>(
      `[data-facility-reason="${kind}"]`,
    )!.textContent = reason ?? '建築できます（位置は自動）';
  }
  const status = root.querySelector<HTMLElement>('[data-facility-status]')!;
  status.textContent =
    attached
      .map(
        (facility) =>
          `${FACILITY_GLYPHS[facility.kind]} ${FACILITY_NAMES[facility.kind]} HP${facility.hp}/${facility.maxHp} · ${facility.remainingBuildTicks > 0 ? `建築中 ${(facility.remainingBuildTicks / 10).toFixed(1)}秒` : '完成'}`,
      )
      .join('\n') || 'この設置先には施設がありません';
}
