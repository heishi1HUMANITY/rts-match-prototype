import { describe, expect, it, vi } from 'vitest';
import { FixedStepClock } from './clock';

describe('FixedStepClock', () => {
  it('advances equally at 60fps and 30fps over the same elapsed time', () => {
    const run = (interval: number, frames: number): number => {
      const clock = new FixedStepClock();
      const tick = vi.fn();
      for (let index = 0; index <= frames; index += 1)
        clock.advance(index * interval, true, tick, 100);
      return tick.mock.calls.length;
    };
    expect(run(1000 / 60, 60)).toBe(10);
    expect(run(1000 / 30, 30)).toBe(10);
  });

  it('caps a long frame at five ticks and counts discarded time', () => {
    const clock = new FixedStepClock();
    const tick = vi.fn();
    clock.advance(0, true, tick, 100);
    const result = clock.advance(1700, true, tick, 100);
    expect(result.ticks).toBe(5);
    expect(result.droppedMs).toBe(1200);
    expect(clock.droppedTimeMs).toBe(1200);
  });

  it('drops the partial frame across pause and starts resumed time at zero', () => {
    const clock = new FixedStepClock();
    const tick = vi.fn();
    clock.advance(0, true, tick, 100);
    clock.advance(70, true, tick, 100);
    clock.advance(9000, false, tick, 100);
    expect(clock.advance(10000, true, tick, 100).ticks).toBe(0);
    expect(clock.advance(10050, true, tick, 100).ticks).toBe(0);
    expect(clock.advance(10099, true, tick, 100).ticks).toBe(0);
    expect(clock.advance(10100, true, tick, 100).ticks).toBe(1);
  });
});
