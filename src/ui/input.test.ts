import { describe, expect, it, vi } from 'vitest';
import { GestureTracker } from './input';

const callbacks = () => ({ onTap: vi.fn(), onPan: vi.fn(), onZoom: vi.fn() });

describe('GestureTracker', () => {
  it('treats exactly 6px as a tap and more than 6px as a pan', () => {
    const tap = new GestureTracker();
    const tapCallbacks = callbacks();
    tap.pointerDown({ id: 1, x: 10, y: 10 });
    tap.pointerMove({ id: 1, x: 16, y: 10 }, tapCallbacks);
    expect(tap.pointerUp({ id: 1, x: 16, y: 10 })).toEqual({ x: 16, y: 10 });
    const pan = new GestureTracker();
    const panCallbacks = callbacks();
    pan.pointerDown({ id: 2, x: 10, y: 10 });
    pan.pointerMove({ id: 2, x: 17, y: 10 }, panCallbacks);
    expect(pan.pointerUp({ id: 2, x: 17, y: 10 })).toBeNull();
    expect(panCallbacks.onPan).toHaveBeenCalled();
  });

  it('zooms a two-pointer gesture and blocks the remaining pointer after one lifts', () => {
    const tracker = new GestureTracker();
    const cb = callbacks();
    tracker.pointerDown({ id: 1, x: 0, y: 0 });
    tracker.pointerDown({ id: 2, x: 20, y: 0 });
    tracker.pointerMove({ id: 2, x: 30, y: 0 }, cb);
    expect(cb.onZoom).toHaveBeenCalledWith(1.5, { x: 15, y: 0 });
    expect(cb.onPan).toHaveBeenCalledWith({ x: 10, y: 0 }, { x: 15, y: 0 });
    tracker.pointerUp({ id: 2, x: 30, y: 0 });
    tracker.pointerMove({ id: 1, x: 50, y: 0 }, cb);
    expect(tracker.currentMode).toBe('blocked');
    expect(cb.onTap).not.toHaveBeenCalled();
    expect(tracker.pointerUp({ id: 1, x: 50, y: 0 })).toBeNull();
    expect(tracker.currentMode).toBe('idle');
  });

  it('blocks canvas actions when a HUD pointer touches before or during a gesture', () => {
    const tracker = new GestureTracker();
    const cb = callbacks();
    tracker.hudPointerDown(7);
    tracker.pointerDown({ id: 1, x: 20, y: 20 });
    tracker.pointerMove({ id: 1, x: 80, y: 20 }, cb);
    expect(tracker.pointerUp({ id: 1, x: 80, y: 20 })).toBeNull();
    tracker.pointerUp({ id: 7, x: 0, y: 0 });
    expect(cb.onPan).not.toHaveBeenCalled();
    expect(tracker.currentMode).toBe('idle');
  });

  it('recovers from HUD pointercancel and keeps cancel idle when no pointer is held', () => {
    const tracker = new GestureTracker();
    tracker.hudPointerDown(9);
    tracker.pointerCancel(9);
    expect(tracker.currentMode).toBe('idle');
    tracker.cancel();
    expect(tracker.currentMode).toBe('idle');
    tracker.pointerDown({ id: 10, x: 1, y: 1 });
    expect(tracker.pointerUp({ id: 10, x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });

  it('treats a pointerup beyond the threshold as a pan even when no move event arrived', () => {
    const tracker = new GestureTracker();
    tracker.pointerDown({ id: 1, x: 0, y: 0 });
    expect(tracker.pointerUp({ id: 1, x: 7, y: 0 })).toBeNull();
  });
});
