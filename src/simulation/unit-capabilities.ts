import type { RulesMaster } from './rules';
import type { CombatTargetKind, MovementDomain, UnitKind } from './types';

export interface UnitCapabilities {
  readonly movementDomain: MovementDomain;
  readonly attackTargets: readonly CombatTargetKind[];
  readonly canCaptureBase: boolean;
  readonly captureEfficiencyPercent: number;
}

/** Reads shared movement, combat, and capture settings from the match snapshot. */
export function unitCapabilities(
  kind: UnitKind,
  rules: RulesMaster,
): UnitCapabilities {
  const stats = rules.units[kind];
  return {
    movementDomain: stats.movementDomain,
    attackTargets: stats.attackTargets,
    canCaptureBase: stats.canCaptureBase,
    captureEfficiencyPercent: stats.captureEfficiencyPercent,
  };
}
