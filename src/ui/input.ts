export type GestureMode = 'idle' | 'tap' | 'pan' | 'pinch' | 'move' | 'blocked';
export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface PointerSample extends Point {
  readonly id: number;
}
export type GestureOrigin =
  | {
      readonly kind: 'unit';
      readonly unitId: string;
      readonly movable: boolean;
    }
  | { readonly kind: 'enemy' }
  | { readonly kind: 'ground' }
  | { readonly kind: 'none' };
export type GestureResult =
  | { readonly kind: 'tap'; readonly point: Point }
  | { readonly kind: 'move'; readonly unitId: string; readonly point: Point }
  | null;
export interface GestureCallbacks {
  readonly onPointerDown: (point: Point) => GestureOrigin;
  readonly onTap: (point: Point) => void;
  readonly onPan: (from: Point, to: Point) => void;
  readonly onZoom: (factor: number, midpoint: Point) => void;
  readonly onMovePreview: (unitId: string, point: Point) => void;
  readonly onMoveDrop: (unitId: string, point: Point) => void;
  readonly onGestureCancel: () => void;
}

/** Pure pointer state machine. Gesture type is fixed by the initial hit target. */
export class GestureTracker {
  private readonly active = new Map<number, Point>();
  private readonly hudPointers = new Set<number>();
  private mode: GestureMode = 'idle';
  private start: Point | null = null;
  private last: Point | null = null;
  private origin: GestureOrigin | null = null;
  private moveUnitId: string | null = null;
  private pinchDistance = 0;
  private pinchMidpoint: Point | null = null;

  get currentMode(): GestureMode {
    return this.mode;
  }

  pointerDown(pointer: PointerSample, callbacks: GestureCallbacks): void {
    this.active.set(pointer.id, { x: pointer.x, y: pointer.y });
    if (this.active.size > 1) {
      if (this.mode === 'move') callbacks.onGestureCancel();
      if (this.hudPointers.size > 0 || this.mode === 'blocked') {
        this.mode = 'blocked';
        this.clearMove();
        return;
      }
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
      this.origin = null;
      this.moveUnitId = null;
      return;
    }
    if (this.hudPointers.size > 0 || this.mode === 'blocked') {
      this.mode = 'blocked';
      this.start = null;
      this.last = null;
      return;
    }
    this.mode = 'tap';
    this.start = { x: pointer.x, y: pointer.y };
    this.last = this.start;
    this.origin = callbacks.onPointerDown(this.start);
    this.moveUnitId = null;
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
    if (this.mode === 'tap' && distanceFrom(pointer, this.start) > 6) {
      const origin = this.origin;
      if (origin?.kind === 'ground') this.mode = 'pan';
      else if (origin?.kind === 'unit' && origin.movable) {
        this.mode = 'move';
        this.moveUnitId = origin.unitId;
      } else this.mode = 'blocked';
    }
    if (this.mode === 'pan' && this.last !== null)
      callbacks.onPan(this.last, { x: pointer.x, y: pointer.y });
    else if (this.mode === 'move' && this.moveUnitId !== null)
      callbacks.onMovePreview(this.moveUnitId, { x: pointer.x, y: pointer.y });
    this.last = { x: pointer.x, y: pointer.y };
  }

  pointerUp(
    pointer: PointerSample,
    callbacks: GestureCallbacks,
  ): GestureResult {
    if (!this.active.has(pointer.id)) {
      this.hudPointers.delete(pointer.id);
      if (this.hudPointers.size === 0 && this.active.size === 0) this.clear();
      return null;
    }
    if (
      this.active.size === 1 &&
      this.mode === 'tap' &&
      this.start !== null &&
      distanceFrom(pointer, this.start) > 6
    ) {
      const origin = this.origin;
      if (origin?.kind === 'unit' && origin.movable) {
        this.mode = 'move';
        this.moveUnitId = origin.unitId;
        callbacks.onMovePreview(origin.unitId, { x: pointer.x, y: pointer.y });
      } else if (origin?.kind === 'ground') this.mode = 'pan';
      else this.mode = 'blocked';
    }
    const result: GestureResult =
      this.mode === 'move' && this.moveUnitId !== null
        ? {
            kind: 'move',
            unitId: this.moveUnitId,
            point: { x: pointer.x, y: pointer.y },
          }
        : this.mode === 'tap' &&
            this.active.size === 1 &&
            this.hudPointers.size === 0 &&
            this.origin?.kind === 'ground'
          ? { kind: 'tap', point: { x: pointer.x, y: pointer.y } }
          : null;
    this.active.delete(pointer.id);
    if (this.active.size === 0 && this.hudPointers.size === 0) this.clear();
    else if (this.mode === 'pinch' || this.mode === 'move') {
      if (this.mode === 'move') callbacks.onGestureCancel();
      this.mode = 'blocked';
      this.clearMove();
    }
    return result;
  }

  pointerCancel(pointerId: number, callbacks: GestureCallbacks): void {
    this.active.delete(pointerId);
    this.hudPointers.delete(pointerId);
    callbacks.onGestureCancel();
    if (this.active.size === 0 && this.hudPointers.size === 0) this.clear();
    else {
      this.mode = 'blocked';
      this.clearMove();
    }
  }

  hudPointerDown(pointerId: number, callbacks: GestureCallbacks): void {
    callbacks.onGestureCancel();
    this.hudPointers.add(pointerId);
    this.mode = 'blocked';
    this.start = null;
    this.last = null;
    this.clearMove();
  }

  cancel(callbacks: GestureCallbacks): void {
    callbacks.onGestureCancel();
    if (this.active.size === 0 && this.hudPointers.size === 0) {
      this.clear();
      return;
    }
    this.mode = 'blocked';
    this.start = null;
    this.last = null;
    this.clearMove();
  }

  clear(): void {
    this.active.clear();
    this.hudPointers.clear();
    this.mode = 'idle';
    this.start = null;
    this.last = null;
    this.origin = null;
    this.moveUnitId = null;
    this.pinchDistance = 0;
    this.pinchMidpoint = null;
  }

  private clearMove(): void {
    this.moveUnitId = null;
    if (this.origin?.kind === 'unit') this.origin = null;
  }
}

function distanceFrom(point: Point, origin: Point): number {
  return Math.hypot(point.x - origin.x, point.y - origin.y);
}

export interface CanvasInputOptions extends GestureCallbacks {
  readonly canvas: HTMLCanvasElement;
  readonly onEscape: () => void;
}

/** Browser adapter: the tracker remains deterministic and independently testable. */
export class CanvasInput {
  readonly tracker = new GestureTracker();
  private disposed = false;
  private readonly isCanvasHit = (point: Point): boolean => {
    const rect = this.options.canvas.getBoundingClientRect();
    if (!pointInside(point, rect)) return false;
    const hit = document.elementFromPoint(point.x, point.y);
    return hit === this.options.canvas;
  };
  private readonly onDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.tracker.pointerDown(
      { id: event.pointerId, x: event.clientX, y: event.clientY },
      this.options,
    );
    try {
      this.options.canvas.setPointerCapture(event.pointerId);
    } catch {
      this.cancelGesture();
    }
  };
  private readonly onMove = (event: PointerEvent): void => {
    if (
      this.tracker.currentMode === 'move' &&
      !this.isCanvasHit({ x: event.clientX, y: event.clientY })
    ) {
      this.options.onGestureCancel();
      return;
    }
    this.tracker.pointerMove(
      { id: event.pointerId, x: event.clientX, y: event.clientY },
      this.options,
    );
  };
  private readonly onUp = (event: PointerEvent): void => {
    const result = this.tracker.pointerUp(
      { id: event.pointerId, x: event.clientX, y: event.clientY },
      this.options,
    );
    const endedInside = this.isCanvasHit(event);
    if (result?.kind === 'tap' && endedInside) this.options.onTap(result.point);
    else if (result?.kind === 'move' && endedInside)
      this.options.onMoveDrop(result.unitId, result.point);
    else if (result !== null || !endedInside) this.options.onGestureCancel();
    if (this.options.canvas.hasPointerCapture(event.pointerId))
      this.options.canvas.releasePointerCapture(event.pointerId);
  };
  private readonly onCancel = (event: PointerEvent): void => {
    this.tracker.pointerCancel(event.pointerId, this.options);
  };
  private readonly onLostCapture = (event: PointerEvent): void => {
    this.tracker.pointerCancel(event.pointerId, this.options);
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
    this.cancelGesture();
    this.options.onEscape();
  };
  private readonly onBlur = (): void => this.reset();
  private readonly onVisibility = (): void => {
    if (document.hidden) this.reset();
  };
  private readonly onHudDown = (event: PointerEvent): void => {
    if (
      event.target instanceof Node &&
      this.options.canvas.contains(event.target)
    )
      return;
    this.tracker.hudPointerDown(event.pointerId, this.options);
  };
  private readonly onAnyUp = (event: PointerEvent): void => {
    this.tracker.pointerUp(
      { id: event.pointerId, x: event.clientX, y: event.clientY },
      this.options,
    );
  };
  private readonly onAnyCancel = (event: PointerEvent): void => {
    this.tracker.pointerCancel(event.pointerId, this.options);
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
    this.tracker.cancel(this.options);
  }

  reset(): void {
    this.cancelGesture();
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
    this.reset();
  }
}

function pointInside(
  point: Point,
  rect: Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>,
): boolean {
  return (
    point.x >= rect.left &&
    point.x < rect.right &&
    point.y >= rect.top &&
    point.y < rect.bottom
  );
}
