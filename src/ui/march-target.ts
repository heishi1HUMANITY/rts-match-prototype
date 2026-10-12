import type {
  Cell,
  FactionView,
  MarchTarget,
  OwnUnitView,
} from '../simulation/types';

type PickTarget =
  | { readonly kind: 'unit'; readonly unitId: string }
  | { readonly kind: 'base'; readonly baseId: string }
  | { readonly kind: 'ground'; readonly cell: Cell }
  | null;

/** Resolve only the faction-limited objects currently offered by the board. */
export function resolveMarchTarget(
  view: Pick<FactionView, 'visibleEnemies' | 'bases'>,
  picked: PickTarget,
): {
  readonly target: MarchTarget;
  readonly cell: Cell;
  readonly label: string;
} | null {
  if (picked?.kind === 'unit') {
    const enemy = view.visibleEnemies.find((unit) => unit.id === picked.unitId);
    return enemy
      ? {
          target: { kind: 'unit', id: enemy.id },
          cell: {
            x: Math.floor(enemy.positionX1024 / 1024),
            y: Math.floor(enemy.positionY1024 / 1024),
          },
          label: `追跡先: ${enemy.id}`,
        }
      : null;
  }
  if (picked?.kind === 'base') {
    const base = view.bases.find((entry) => entry.id === picked.baseId);
    return base
      ? {
          target: { kind: 'base', id: base.id },
          cell: { ...base.cell },
          label: `進軍先: ${base.id}`,
        }
      : null;
  }
  return null;
}

/** Own order information is safe to show even while its target is out of sight. */
export function marchOrderLabel(unit: OwnUnitView): string {
  const order = unit.marchOrder;
  if (!order) return '';
  const state =
    order.status === 'searching'
      ? '最終確認位置へ・追跡保留'
      : order.status === 'blocked'
        ? '経路なし・保留'
        : order.status === 'arrived'
          ? order.target.kind === 'unit'
            ? '射程内・交戦待機'
            : '到着・拠点対応中'
          : order.target.kind === 'unit'
            ? '追跡中'
            : '進軍中';
  return `${order.target.id} · ${state}`;
}
