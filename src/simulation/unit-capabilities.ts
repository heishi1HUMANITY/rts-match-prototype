import type { MovementDomain, UnitKind } from './types';

export type CombatTargetKind = 'unit' | 'defender' | 'base' | 'crossing';

export interface UnitCapabilities {
  readonly movementDomain: MovementDomain;
  readonly attackTargets: readonly CombatTargetKind[];
  readonly canCaptureBase: boolean;
}

/** Shared contract for movement, combat target eligibility, and capture control. */
const CAPABILITIES: Readonly<Record<UnitKind, UnitCapabilities>> = {
  assault: {
    movementDomain: 'land',
    attackTargets: ['unit', 'defender', 'base', 'crossing'],
    canCaptureBase: true,
  },
  scout: {
    movementDomain: 'land',
    attackTargets: ['unit', 'defender', 'base', 'crossing'],
    canCaptureBase: true,
  },
};

/** F08 extends this profile table with its six unit definitions. */
export function unitCapabilities(kind: UnitKind): UnitCapabilities {
  return CAPABILITIES[kind];
}
