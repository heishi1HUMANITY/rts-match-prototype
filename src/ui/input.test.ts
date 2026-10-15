import { describe, expect, it, vi } from 'vitest';
import {
  GestureTracker,
  type GestureCallbacks,
  type GestureOrigin,
} from './input';

const setup = (origin: GestureOrigin = { kind: 'ground' }) => {
  const callbacks: GestureCallbacks = {
    onPointerDown: vi.fn(() => origin),
    onTap: vi.fn(),
    onPan: vi.fn(),
    onZoom: vi.fn(),
    onMovePreview: vi.fn(),
    onMoveDrop: vi.fn(),
    onGestureCancel: vi.fn(),
  };
  return { callbacks, tracker: new GestureTracker() };
};

describe('GestureTracker', () => {
  it('keeps exactly 6px as tap threshold and pans only for a ground drag', () => {
    const tap = setup();
    tap.tracker.pointerDown({ id: 1, x: 10, y: 10 }, tap.callbacks);
    tap.tracker.pointerMove({ id: 1, x: 16, y: 10 }, tap.callbacks);
    expect(
      tap.tracker.pointerUp({ id: 1, x: 16, y: 10 }, tap.callbacks),
    ).toEqual({ kind: 'tap', point: { x: 16, y: 10 } });

    const pan = setup();
    pan.tracker.pointerDown({ id: 2, x: 10, y: 10 }, pan.callbacks);
    pan.tracker.pointerMove({ id: 2, x: 17, y: 10 }, pan.callbacks);
    expect(
      pan.tracker.pointerUp({ id: 2, x: 17, y: 10 }, pan.callbacks),
    ).toBeNull();
    expect(pan.callbacks.onPan).toHaveBeenCalled();
    expect(pan.callbacks.onMovePreview).not.toHaveBeenCalled();
  });

  it('delivers tap-only origins without allowing camera pans or unit moves', () => {
    const { tracker, callbacks } = setup({ kind: 'tap-only' });
    tracker.pointerDown({ id: 4, x: 10, y: 10 }, callbacks);
    tracker.pointerMove({ id: 4, x: 18, y: 10 }, callbacks);
    expect(tracker.pointerUp({ id: 4, x: 18, y: 10 }, callbacks)).toEqual({
      kind: 'tap',
      point: { x: 18, y: 10 },
    });
    expect(callbacks.onPan).not.toHaveBeenCalled();
    expect(callbacks.onMovePreview).not.toHaveBeenCalled();
  });

  it('selects a movable unit on press, previews after threshold, and drops once', () => {
    const { tracker, callbacks } = setup({
      kind: 'unit',
      unitId: 'A-01',
      movable: true,
    });
    tracker.pointerDown({ id: 1, x: 30, y: 40 }, callbacks);
    expect(callbacks.onPointerDown).toHaveBeenCalledWith({ x: 30, y: 40 });
    tracker.pointerMove({ id: 1, x: 35, y: 40 }, callbacks);
    expect(callbacks.onMovePreview).not.toHaveBeenCalled();
    tracker.pointerMove({ id: 1, x: 37, y: 40 }, callbacks);
    expect(callbacks.onMovePreview).toHaveBeenCalledWith('A-01', {
      x: 37,
      y: 40,
    });
    const result = tracker.pointerUp({ id: 1, x: 50, y: 60 }, callbacks);
    expect(result).toEqual({
      kind: 'move',
      unitId: 'A-01',
      point: { x: 50, y: 60 },
    });
    expect(callbacks.onTap).not.toHaveBeenCalled();
    expect(tracker.pointerUp({ id: 1, x: 50, y: 60 }, callbacks)).toBeNull();
  });

  it('keeps short unit and enemy taps bound to their pointerdown origin', () => {
    const own = setup({ kind: 'unit', unitId: 'A-01', movable: true });
    own.tracker.pointerDown({ id: 1, x: 5, y: 5 }, own.callbacks);
    expect(own.tracker.pointerUp({ id: 1, x: 6, y: 5 }, own.callbacks)).toEqual(
      { kind: 'unit-tap', unitId: 'A-01', point: { x: 6, y: 5 } },
    );

    const enemy = setup({ kind: 'enemy' });
    enemy.tracker.pointerDown({ id: 2, x: 5, y: 5 }, enemy.callbacks);
    expect(
      enemy.tracker.pointerUp({ id: 2, x: 6, y: 5 }, enemy.callbacks),
    ).toBeNull();
  });

  it('recognizes a unit drag from pointerup even when no move event arrived', () => {
    const { tracker, callbacks } = setup({
      kind: 'unit',
      unitId: 'A-02',
      movable: true,
    });
    tracker.pointerDown({ id: 1, x: 0, y: 0 }, callbacks);
    expect(tracker.pointerUp({ id: 1, x: 7, y: 0 }, callbacks)).toEqual({
      kind: 'move',
      unitId: 'A-02',
      point: { x: 7, y: 0 },
    });
    expect(callbacks.onMovePreview).toHaveBeenCalledTimes(1);
  });

  it('does not pan or move when an enemy is the drag origin', () => {
    const { tracker, callbacks } = setup({ kind: 'enemy' });
    tracker.pointerDown({ id: 1, x: 0, y: 0 }, callbacks);
    tracker.pointerMove({ id: 1, x: 30, y: 10 }, callbacks);
    expect(tracker.pointerUp({ id: 1, x: 30, y: 10 }, callbacks)).toBeNull();
    expect(callbacks.onPan).not.toHaveBeenCalled();
    expect(callbacks.onMovePreview).not.toHaveBeenCalled();
  });

  it('does not move units while not in the running phase', () => {
    const { tracker, callbacks } = setup({
      kind: 'unit',
      unitId: 'A-01',
      movable: false,
    });
    tracker.pointerDown({ id: 1, x: 0, y: 0 }, callbacks);
    tracker.pointerMove({ id: 1, x: 20, y: 0 }, callbacks);
    expect(tracker.pointerUp({ id: 1, x: 20, y: 0 }, callbacks)).toBeNull();
    expect(callbacks.onPan).not.toHaveBeenCalled();
    expect(callbacks.onMovePreview).not.toHaveBeenCalled();
  });

  it('cancels a unit drag when a second pointer joins and blocks the remaining finger', () => {
    const { tracker, callbacks } = setup({
      kind: 'unit',
      unitId: 'A-01',
      movable: true,
    });
    tracker.pointerDown({ id: 1, x: 0, y: 0 }, callbacks);
    tracker.pointerMove({ id: 1, x: 8, y: 0 }, callbacks);
    tracker.pointerDown({ id: 2, x: 20, y: 0 }, callbacks);
    expect(callbacks.onGestureCancel).toHaveBeenCalledTimes(1);
    tracker.pointerMove({ id: 2, x: 30, y: 0 }, callbacks);
    expect(callbacks.onZoom).toHaveBeenCalledWith(22 / 12, { x: 19, y: 0 });
    expect(callbacks.onPan).toHaveBeenCalled();
    tracker.pointerUp({ id: 2, x: 30, y: 0 }, callbacks);
    expect(tracker.currentMode).toBe('blocked');
    expect(tracker.pointerUp({ id: 1, x: 8, y: 0 }, callbacks)).toBeNull();
    expect(callbacks.onMoveDrop).not.toHaveBeenCalled();
  });

  it('cancels on HUD pointer, pointercancel, and reset, then allows a new gesture', () => {
    const { tracker, callbacks } = setup({
      kind: 'unit',
      unitId: 'A-01',
      movable: true,
    });
    tracker.pointerDown({ id: 1, x: 0, y: 0 }, callbacks);
    tracker.pointerMove({ id: 1, x: 8, y: 0 }, callbacks);
    tracker.hudPointerDown(2, callbacks);
    expect(tracker.pointerUp({ id: 1, x: 20, y: 0 }, callbacks)).toBeNull();
    tracker.pointerUp({ id: 2, x: 0, y: 0 }, callbacks);
    expect(tracker.currentMode).toBe('idle');

    tracker.pointerDown({ id: 3, x: 0, y: 0 }, callbacks);
    tracker.pointerMove({ id: 3, x: 8, y: 0 }, callbacks);
    tracker.pointerCancel(3, callbacks);
    expect(tracker.currentMode).toBe('idle');
    expect(callbacks.onMoveDrop).not.toHaveBeenCalled();
    tracker.pointerDown({ id: 4, x: 1, y: 1 }, callbacks);
    expect(tracker.pointerUp({ id: 4, x: 1, y: 1 }, callbacks)).toMatchObject({
      kind: 'unit-tap',
      unitId: 'A-01',
    });
    expect(tracker.currentMode).toBe('idle');

    tracker.pointerDown({ id: 5, x: 0, y: 0 }, callbacks);
    tracker.pointerMove({ id: 5, x: 8, y: 0 }, callbacks);
    tracker.cancel(callbacks);
    expect(tracker.pointerUp({ id: 5, x: 20, y: 0 }, callbacks)).toBeNull();
    expect(callbacks.onMoveDrop).not.toHaveBeenCalled();
  });

  it('zooms and pans a two-pointer ground gesture without turning the remaining up into a tap', () => {
    const { tracker, callbacks } = setup();
    tracker.pointerDown({ id: 1, x: 0, y: 0 }, callbacks);
    tracker.pointerDown({ id: 2, x: 20, y: 0 }, callbacks);
    tracker.pointerMove({ id: 2, x: 30, y: 0 }, callbacks);
    expect(callbacks.onZoom).toHaveBeenCalledWith(1.5, { x: 15, y: 0 });
    expect(callbacks.onPan).toHaveBeenCalledWith(
      { x: 10, y: 0 },
      { x: 15, y: 0 },
    );
    tracker.pointerUp({ id: 2, x: 30, y: 0 }, callbacks);
    tracker.pointerMove({ id: 1, x: 50, y: 0 }, callbacks);
    expect(tracker.currentMode).toBe('blocked');
    expect(tracker.pointerUp({ id: 1, x: 50, y: 0 }, callbacks)).toBeNull();
  });
});
