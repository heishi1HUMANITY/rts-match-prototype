import { TICK_DURATION_MS } from '../simulation/config';

let tickDurationMs: number = TICK_DURATION_MS;

/** Follows the displayed match's master tick length; call once per rendered view. */
export function setDisplayTickDuration(ms: number): void {
  tickDurationMs = ms;
}

export function ticksToSeconds(ticks: number): number {
  return (ticks * tickDurationMs) / 1000;
}

export function ticksPerSecond(): number {
  return 1000 / tickDurationMs;
}

export function formatTickSeconds(ticks: number): string {
  return `${ticksToSeconds(ticks).toFixed(1)}秒`;
}
