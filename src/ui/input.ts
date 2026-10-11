export type GestureMode = 'idle' | 'tap' | 'pan' | 'pinch' | 'blocked';
export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface PointerSample extends Point {
  readonly id: number;
}
export interface GestureCallbacks {
  readonly onTap: (point: Point) => void;
  readonly onPan: (from: Point, to: Point) => void;
  readonly onZoom: (factor: number, midpoint: Point) => void;
}

/** Pure pointer state machine. HUD pointers poison a gesture until every finger is up. */
export class GestureTracker {
  private readonly active = new Map<number, Point>();
  private readonly hudPointers = new Set<number>();
  private mode: GestureMode = 'idle';
  private start: Point | null = null;
  private last: Point | null = null;
  private pinchDistance = 0;
  private pinchMidpoint: Point | null = null;

  get currentMode(): GestureMode {
    return this.mode;
  }

  pointerDown(pointer: PointerSample): void {
    this.active.set(pointer.id, { x: pointer.x, y: pointer.y });
    if (this.hudPointers.size > 0 || this.mode === 'blocked') {
      this.mode = 'blocked';
      this.start = null;
      this.last = null;
      return;
    }
    if (this.active.size > 1) {
      this.mode = 'pinch';
      const points = [...this.active.values()];
      const first = points[0]!;
      const second = points[1]!;
      this.pinchDistance = Math.hypot(first.x - second.x, first.y - second.y);
      this.pinchMidpoint = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      this.start = null;
      this.last = null;
      return;
    }
    this.mode = 'tap';
    this.start = { x: pointer.x, y: pointer.y };
    this.last = this.start;
  }

  pointerMove(pointer: PointerSample, callbacks: GestureCallbacks): void {
    if (!this.active.has(pointer.id)) return;
    this.active.set(pointer.id, { x: pointer.x, y: pointer.y });
    if (this.mode === 'blocked') return;
    if (this.active.size >= 2) {
      const points = [...this.active.values()];
      const first = points[0]!;
      const second = points[1]!;
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const midpoint = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };
      if (this.mode !== 'pinch') {
        this.mode = 'pinch';
        this.pinchDistance = distance;
        this.pinchMidpoint = midpoint;
      } else if (this.pinchDistance > 0 && distance > 0) {
        callbacks.onZoom(distance / this.pinchDistance, midpoint);
        if (
          this.pinchMidpoint !== null &&
          (midpoint.x !== this.pinchMidpoint.x ||
            midpoint.y !== this.pinchMidpoint.y)
        )
          callbacks.onPan(this.pinchMidpoint, midpoint);
        this.pinchDistance = distance;
        this.pinchMidpoint = midpoint;
      }
      return;
    }
    if (this.start === null) return;
    if (Math.hypot(pointer.x - this.start.x, pointer.y - this.start.y) > 6)
      this.mode = 'pan';
    if (this.mode === 'pan' && this.last !== null)
      callbacks.onPan(this.last, { x: pointer.x, y: pointer.y });
    this.last = { x: pointer.x, y: pointer.y };
  }

  pointerUp(pointer: PointerSample): Point | null {
    if (!this.active.has(pointer.id)) {
      this.hudPointers.delete(pointer.id);
      if (this.hudPointers.size === 0 && this.active.size === 0) this.clear();
      return null;
    }
    this.active.delete(pointer.id);
    if (
      this.mode === 'tap' &&
      this.start !== null &&
      Math.hypot(pointer.x - this.start.x, pointer.y - this.start.y) > 6
    )
      this.mode = 'pan';
    const tap =
      this.mode === 'tap' &&
      this.active.size === 0 &&
      this.hudPointers.size === 0
        ? { x: pointer.x, y: pointer.y }
        : null;
    if (this.active.size === 0 && this.hudPointers.size === 0) this.clear();
    else if (this.mode === 'pinch') this.mode = 'blocked';
    return tap;
  }

  pointerCancel(pointerId: number): void {
    this.active.delete(pointerId);
    this.hudPointers.delete(pointerId);
    if (this.active.size === 0 && this.hudPointers.size === 0) this.clear();
    else this.mode = 'blocked';
  }

  hudPointerDown(pointerId: number): void {
    this.hudPointers.add(pointerId);
    this.mode = 'blocked';
    this.start = null;
    this.last = null;
  }

  cancel(): void {
    if (this.active.size === 0 && this.hudPointers.size === 0) {
      this.clear();
      return;
    }
    this.mode = 'blocked';
    this.start = null;
    this.last = null;
  }

  clear(): void {
    this.active.clear();
    this.hudPointers.clear();
    this.mode = 'idle';
    this.start = null;
    this.last = null;
    this.pinchDistance = 0;
    this.pinchMidpoint = null;
  }
}

export interface CanvasInputOptions {
  readonly canvas: HTMLCanvasElement;
  readonly onTap: (point: Point) => void;
  readonly onPan: (from: Point, to: Point) => void;
  readonly onZoom: (factor: number, midpoint: Point) => void;
  readonly onEscape: () => void;
}

/** Browser adapter: the tracker remains deterministic and independently testable. */
export class CanvasInput {
  readonly tracker = new GestureTracker();
  private disposed = false;
  private readonly onDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.options.canvas.setPointerCapture(event.pointerId);
    this.tracker.pointerDown({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
  };
  private readonly onMove = (event: PointerEvent): void => {
    this.tracker.pointerMove(
      { id: event.pointerId, x: event.clientX, y: event.clientY },
      this.options,
    );
  };
  private readonly onUp = (event: PointerEvent): void => {
    const tap = this.tracker.pointerUp({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
    const rect = this.options.canvas.getBoundingClientRect();
    const endedInside =
      event.clientX >= rect.left &&
      event.clientX < rect.right &&
      event.clientY >= rect.top &&
      event.clientY < rect.bottom;
    if (tap !== null && endedInside) this.options.onTap(tap);
    if (this.options.canvas.hasPointerCapture(event.pointerId))
      this.options.canvas.releasePointerCapture(event.pointerId);
  };
  private readonly onCancel = (event: PointerEvent): void => {
    this.tracker.pointerCancel(event.pointerId);
  };
  private readonly onLostCapture = (event: PointerEvent): void => {
    this.tracker.pointerCancel(event.pointerId);
  };
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? this.options.canvas.clientHeight
          : 1;
    this.options.onZoom(Math.exp(-event.deltaY * unit * 0.0015), {
      x: event.clientX,
      y: event.clientY,
    });
  };
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    this.options.onEscape();
  };
  private readonly onBlur = (): void => {
    this.tracker.clear();
  };
  private readonly onVisibility = (): void => {
    if (document.hidden) this.tracker.clear();
  };
  private readonly onHudDown = (event: PointerEvent): void => {
    if (
      event.target instanceof Node &&
      this.options.canvas.contains(event.target)
    )
      return;
    this.cancelGesture();
    this.tracker.hudPointerDown(event.pointerId);
  };
  private readonly onAnyUp = (event: PointerEvent): void => {
    this.tracker.pointerUp({
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
  };
  private readonly onAnyCancel = (event: PointerEvent): void => {
    this.tracker.pointerCancel(event.pointerId);
  };

  constructor(
    private readonly options: CanvasInputOptions,
    private readonly hud: HTMLElement,
  ) {
    const { canvas } = options;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('lostpointercapture', this.onLostCapture);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    hud.addEventListener('pointerdown', this.onHudDown);
    window.addEventListener('pointerup', this.onAnyUp);
    window.addEventListener('pointercancel', this.onAnyCancel);
  }

  cancelGesture(): void {
    this.tracker.cancel();
  }
  reset(): void {
    this.tracker.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const { canvas } = this.options;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointermove', this.onMove);
    canvas.removeEventListener('pointerup', this.onUp);
    canvas.removeEventListener('pointercancel', this.onCancel);
    canvas.removeEventListener('lostpointercapture', this.onLostCapture);
    canvas.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.hud.removeEventListener('pointerdown', this.onHudDown);
    window.removeEventListener('pointerup', this.onAnyUp);
    window.removeEventListener('pointercancel', this.onAnyCancel);
    this.tracker.clear();
  }
}
