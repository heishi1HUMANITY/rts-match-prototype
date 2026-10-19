import {
  artilleryCenterHitPercent,
  artilleryImpactTicks,
  artilleryScatterRadius1024,
  distance1024,
} from '../simulation/artillery-aim';
import type { Cell, FactionView } from '../simulation/types';

export type ArtilleryAimStatus = 'observed' | 'unobserved' | 'invalid';

export interface ArtilleryAimPreview {
  readonly origin: Cell;
  /** Cells. */
  readonly range: number;
  readonly target: Cell | null;
  /** Cells; zero when there is no target. */
  readonly scatterRadius: number;
  readonly blastRadius: number;
  readonly status: ArtilleryAimStatus;
  readonly hitPercent: number;
  readonly hint: string;
}

/**
 * Viewer-side preview of a manual artillery shot. Uses only the player's view
 * and the same dispersion formula the resolver applies at the firing tick.
 */
export function artilleryAimPreview(
  view: FactionView,
  unitId: string,
  target: Cell | null,
): ArtilleryAimPreview | null {
  const unit = view.ownUnits.find(
    ({ id, kind }) => id === unitId && kind === 'artillery',
  );
  if (!unit || unit.hp <= 0) return null;
  const config = view.rules.artilleryBombardment;
  const base = {
    origin: { ...unit.cell },
    range: config.range,
    blastRadius: config.blastRadius1024 / 1024,
  };
  if (unit.path.length > 0 || unit.edgeProgress > 0 || unit.garrisonedAtBaseId)
    return {
      ...base,
      target: null,
      scatterRadius: 0,
      status: 'invalid',
      hitPercent: 0,
      hint: '✕ 移動中・駐留中は手動砲撃できません',
    };
  if (target === null)
    return {
      ...base,
      target: null,
      scatterRadius: 0,
      status: 'invalid',
      hitPercent: 0,
      hint: `手動砲撃 · 射程${config.range}マス内の地面に照準`,
    };
  const distance = distance1024(
    unit.cell.x * 1024 + 512,
    unit.cell.y * 1024 + 512,
    target.x * 1024 + 512,
    target.y * 1024 + 512,
  );
  const cells = (distance / 1024).toFixed(1);
  if (distance > config.range * 1024)
    return {
      ...base,
      target: { ...target },
      scatterRadius: 0,
      status: 'invalid',
      hitPercent: 0,
      hint: `✕ 射程外 · 距離${cells}/${config.range}マス`,
    };
  const observed = view.visible[target.y * view.map.width + target.x] === true;
  const scatter = artilleryScatterRadius1024(config, distance, observed);
  const hitPercent = artilleryCenterHitPercent(config, scatter);
  return {
    ...base,
    target: { ...target },
    scatterRadius: scatter / 1024,
    status: observed ? 'observed' : 'unobserved',
    hitPercent,
    hint: `${observed ? '◎ 観測' : '△ 未観測'} · 距離${cells} · 散布${(scatter / 1024).toFixed(1)}マス · 中心命中${hitPercent}% · 着弾${(artilleryImpactTicks(config, distance) / 10).toFixed(1)}秒 · 同じ地点で発射`,
  };
}
