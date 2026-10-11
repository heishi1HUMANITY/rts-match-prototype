import { TICK_DURATION_MS } from '../simulation/config';

export interface ClockAdvance {
  readonly ticks: number;
  readonly alpha: number;
  readonly droppedMs: number;
}

/** Pure fixed-step accumulator. A frame can never produce more than five ticks. */
export class FixedStepClock {
  private lastTimestamp: number | null = null;
  private accumulator = 0;
  private dropped = 0;

  reset(clearDropped = true): void {
    this.lastTimestamp = null;
    this.accumulator = 0;
    if (clearDropped) this.dropped = 0;
  }

  get droppedTimeMs(): number {
    return this.dropped;
  }

  advance(timestamp: number, running: boolean, tick: () => void): ClockAdvance {
    if (!running || !Number.isFinite(timestamp)) {
      this.reset(false);
      return { ticks: 0, alpha: 0, droppedMs: 0 };
    }
    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return {
        ticks: 0,
        alpha: this.accumulator / TICK_DURATION_MS,
        droppedMs: 0,
      };
    }
    const rawDelta = Math.max(0, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    const boundedDelta = Math.min(rawDelta, 500);
    let droppedMs = rawDelta - boundedDelta;
    this.accumulator += boundedDelta;
    let ticks = 0;
    while (this.accumulator >= TICK_DURATION_MS && ticks < 5) {
      this.accumulator -= TICK_DURATION_MS;
      tick();
      ticks += 1;
    }
    if (this.accumulator >= TICK_DURATION_MS) {
      const discard = this.accumulator - (this.accumulator % TICK_DURATION_MS);
      droppedMs += discard;
      this.accumulator -= discard;
    }
    this.dropped += droppedMs;
    return {
      ticks,
      alpha: this.accumulator / TICK_DURATION_MS,
      droppedMs,
    };
  }
}
