import { createBoardView } from './render/board';
import { createDiagnostic } from './runtime/diagnostics';
import { MatchRuntime } from './runtime/controller';
import { SCENARIO_IDS } from './simulation/config';
import type { ScenarioId } from './simulation/types';
import type { GestureOrigin, Point } from './ui/input';
import { CanvasInput } from './ui/input';
import { createHud, setHudPanel, updateHud } from './ui/hud';
import './ui/styles.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing application root');

const hud = createHud(app);
let runtime!: MatchRuntime;
let input!: CanvasInput;
let activeMovePreview: {
  readonly unitIds: readonly string[];
  readonly point: Point;
} | null = null;
let activeDragUnitId: string | null = null;
let activeDragUnitIds: string[] | null = null;
let dragCancelled = false;
let bootError: string | null = null;
let lifecycleKey = 'ready:false';
let board = createBoardView({
  container: hud.board,
  onContextLost: () => {
    input?.reset();
    runtime.onContextLost();
  },
  onContextRestored: () => runtime.onContextRestored(),
  onWebGLFailure: (error) => {
    bootError = `WebGLを利用できません: ${error instanceof Error ? error.message : String(error)}`;
  },
});

runtime = new MatchRuntime({
  onChange: (snapshot) => {
    const nextLifecycleKey = `${snapshot.view.phase}:${snapshot.view.ownFaction.eliminatedAtTick !== null}`;
    if (
      nextLifecycleKey !== lifecycleKey &&
      (snapshot.view.phase === 'finished' ||
        snapshot.view.phase === 'ready' ||
        snapshot.view.ownFaction.eliminatedAtTick !== null)
    ) {
      input?.reset();
      hud.multiSelect = false;
      activeMovePreview = null;
      activeDragUnitId = null;
      activeDragUnitIds = null;
      board.clearMovePreview();
    }
    lifecycleKey = nextLifecycleKey;
    updateHud(hud, snapshot);
    board.setSelections(snapshot.selectedUnitIds);
    refreshActiveMovePreview();
  },
  onFrame: (previous, current, alpha) => board.sync(previous, current, alpha),
});
updateHud(hud, runtime.playerSnapshot());
if (bootError !== null) runtime.notify(bootError);
if (!board.available) hud.start.disabled = true;

function isBoardPoint(point: Point): boolean {
  const rect = board.canvas.getBoundingClientRect();
  if (
    point.x < rect.left ||
    point.x >= rect.right ||
    point.y < rect.top ||
    point.y >= rect.bottom
  )
    return false;
  return document.elementFromPoint(point.x, point.y) === board.canvas;
}

function updateMovePreview(unitIds: readonly string[], point: Point): void {
  if (dragCancelled) {
    board.clearMovePreview();
    return;
  }
  if (!isBoardPoint(point)) {
    activeMovePreview = null;
    board.clearMovePreview();
    return;
  }
  const target = board.pickGround(point.x, point.y);
  const snapshot = runtime.playerSnapshot();
  if (
    target === null ||
    snapshot.view.phase !== 'running' ||
    snapshot.contextLost
  ) {
    activeMovePreview = null;
    board.clearMovePreview();
    return;
  }
  board.setGroupMovePreview(runtime.previewGroupMove(unitIds, target), target);
}

function refreshActiveMovePreview(): void {
  const active = activeMovePreview;
  if (active !== null) updateMovePreview(active.unitIds, active.point);
}

function clearActiveDrag(): void {
  activeMovePreview = null;
  activeDragUnitId = null;
  activeDragUnitIds = null;
  board.clearMovePreview();
}

input = new CanvasInput(
  {
    canvas: board.canvas,
    onPointerDown: ({ x, y }): GestureOrigin => {
      dragCancelled = false;
      activeMovePreview = null;
      activeDragUnitId = null;
      activeDragUnitIds = null;
      board.clearMovePreview();
      const picked = board.pick(x, y);
      if (picked?.kind === 'unit') {
        const unit = runtime
          .playerSnapshot()
          .view.ownUnits.find((item) => item.id === picked.unitId);
        if (unit?.factionId === 'A') {
          let snapshot = runtime.playerSnapshot();
          if (hud.multiSelect) {
            activeDragUnitIds = snapshot.selectedUnitIds.includes(unit.id)
              ? [...snapshot.selectedUnitIds]
              : [unit.id];
          } else {
            if (!snapshot.selectedUnitIds.includes(unit.id)) {
              runtime.select(unit.id);
              snapshot = runtime.playerSnapshot();
            }
            activeDragUnitIds = snapshot.selectedUnitIds.includes(unit.id)
              ? [...snapshot.selectedUnitIds]
              : [unit.id];
          }
          activeDragUnitId = unit.id;
          return {
            kind: 'unit',
            unitId: unit.id,
            movable: snapshot.view.phase === 'running' && !snapshot.contextLost,
          };
        }
        if (
          runtime
            .playerSnapshot()
            .view.visibleEnemies.some((enemy) => enemy.id === picked.unitId)
        ) {
          runtime.select(null);
          runtime.notify(
            '敵陣営は操作できません。自軍の部隊を選択してください。',
          );
          return { kind: 'enemy' };
        }
      }
      if (picked?.kind === 'base') {
        setHudPanel(hud, 'base', picked.baseId);
        updateHud(hud, runtime.playerSnapshot());
        return { kind: 'none' };
      }
      return board.pickGround(x, y) === null
        ? { kind: 'none' }
        : { kind: 'ground' };
    },
    onTap: ({ x, y }) => {
      if (dragCancelled) return;
      const cell = board.pickGround(x, y);
      if (cell === null) return;
      const snapshot = runtime.playerSnapshot();
      if (
        snapshot.selectedUnitIds.length > 0 &&
        snapshot.view.phase === 'running' &&
        !snapshot.contextLost
      ) {
        runtime.groupMove(cell);
      } else if (snapshot.selectedUnitIds.length === 0)
        runtime.notify('移動する自軍部隊を選択してください。');
    },
    onUnitTap: (unitId) => {
      if (dragCancelled) return;
      if (hud.multiSelect) runtime.toggleSelection(unitId);
      activeDragUnitId = null;
      activeDragUnitIds = null;
    },
    onPan: (from, to) => {
      board.pan(from, to);
      refreshActiveMovePreview();
    },
    onZoom: (factor) => {
      board.zoomBy(factor);
      refreshActiveMovePreview();
    },
    onMovePreview: (unitId, point) => {
      if (dragCancelled || activeDragUnitId !== unitId) return;
      const snapshot = runtime.playerSnapshot();
      if (
        !snapshot.selectedUnitIds.includes(unitId) &&
        snapshot.view.ownUnits.some((unit) => unit.id === unitId)
      )
        runtime.select(unitId);
      const unitIds = activeDragUnitIds ?? [unitId];
      activeMovePreview = { unitIds: [...unitIds], point };
      updateMovePreview(unitIds, point);
    },
    onMoveDrop: (unitId, point) => {
      if (dragCancelled || activeDragUnitId !== unitId) return;
      const unitIds = [...(activeDragUnitIds ?? [unitId])];
      activeMovePreview = null;
      activeDragUnitId = null;
      activeDragUnitIds = null;
      board.clearMovePreview();
      if (!isBoardPoint(point)) return;
      const target = board.pickGround(point.x, point.y);
      const snapshot = runtime.playerSnapshot();
      if (
        target === null ||
        snapshot.view.phase !== 'running' ||
        snapshot.contextLost
      )
        return;
      runtime.groupMove(target, unitIds);
    },
    onGestureCancel: () => {
      dragCancelled = true;
      activeMovePreview = null;
      activeDragUnitId = null;
      activeDragUnitIds = null;
      board.clearMovePreview();
    },
    onEscape: () => {
      setHudPanel(hud, null);
      runtime.select(null);
    },
  },
  hud.root,
);

function readSeed(): number | null {
  const value = hud.seed.value.trim();
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 0xffff_ffff
    ? parsed
    : null;
}

function seedOrExplain(): number | null {
  const seed = readSeed();
  if (seed === null) {
    hud.seed.setAttribute('aria-invalid', 'true');
    runtime.notify('seedは0〜4294967295の整数で入力してください。');
    hud.seed.focus();
    return null;
  }
  hud.seed.removeAttribute('aria-invalid');
  return seed;
}

function downloadDiagnostic(): void {
  try {
    const data = createDiagnostic(runtime.snapshot(), __G1_BUILD_INFO__);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `g3-${runtime.playerSnapshot().view.scenarioId}-seed-${runtime.playerSnapshot().view.seed}-tick-${runtime.playerSnapshot().view.tick}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    runtime.notify(
      `診断JSONを作成できません: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const handleClick = (event: MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const clickedButton = target.closest<HTMLButtonElement>('button');
  if (clickedButton?.disabled) return;
  const produce = clickedButton?.dataset.produce;
  const research = clickedButton?.dataset.research;
  const cancelJob = clickedButton?.dataset.cancelJob;
  if (produce !== undefined) {
    runtime.dispatch({
      type: 'enqueue-production',
      baseId: `HQ-${runtime.playerSnapshot().view.viewerFactionId}`,
      unitKind: produce,
    });
    return;
  }
  if (research !== undefined) {
    runtime.dispatch({ type: 'start-research', researchId: research });
    return;
  }
  if (cancelJob !== undefined) {
    runtime.dispatch({ type: 'cancel-production', jobId: cancelJob });
    return;
  }
  const unitButton = target.closest<HTMLElement>('[data-unit]');
  if (unitButton?.dataset.unit) {
    if (hud.multiSelect || event.shiftKey)
      runtime.toggleSelection(unitButton.dataset.unit);
    else runtime.select(unitButton.dataset.unit);
    return;
  }
  const action =
    target.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
  if (action === 'start') {
    input.reset();
    runtime.dispatch({ type: 'start' });
  } else if (action === 'pause') runtime.dispatch({ type: 'pause' });
  else if (action === 'resume') runtime.dispatch({ type: 'resume' });
  else if (action === 'replay') {
    input.reset();
    hud.multiSelect = false;
    activeMovePreview = null;
    activeDragUnitId = null;
    activeDragUnitIds = null;
    board.clearMovePreview();
    setHudPanel(hud, null);
    hud.selectedBaseId = 'HQ-A';
    runtime.reset(runtime.playerSnapshot().view.seed);
    board.resetCamera();
    if (board.available) runtime.dispatch({ type: 'start' });
  } else if (action === 'reset') {
    input.reset();
    hud.multiSelect = false;
    clearActiveDrag();
    setHudPanel(hud, null);
    runtime.reset(runtime.playerSnapshot().view.seed);
    board.resetCamera();
  } else if (action === 'apply-seed') {
    const seed = seedOrExplain();
    if (seed === null) return;
    input.reset();
    hud.multiSelect = false;
    clearActiveDrag();
    const scenario = hud.scenario.value;
    if (!SCENARIO_IDS.includes(scenario as ScenarioId)) return;
    setHudPanel(hud, null);
    runtime.reset(seed, scenario as ScenarioId);
    board.resetCamera();
  } else if (action === 'stop' || action === 'group-stop') {
    runtime.groupStop();
  } else if (action === 'clear') runtime.select(null);
  else if (action === 'multi-select') {
    input.cancelGesture();
    hud.multiSelect = !hud.multiSelect;
    updateHud(hud, runtime.playerSnapshot());
  } else if (action === 'select-all') {
    input.cancelGesture();
    runtime.selectAll();
  } else if (action === 'camera') board.resetCamera();
  else if (action === 'download') downloadDiagnostic();
  else if (action === 'bank-research')
    runtime.dispatch({ type: 'start-research', researchId: null });
  else if (action === 'close-panel') setHudPanel(hud, null);
  else if (
    action === 'production' ||
    action === 'research' ||
    action === 'bases'
  ) {
    input.cancelGesture();
    const panel = action === 'bases' ? 'base' : action;
    setHudPanel(hud, hud.panel === panel ? null : panel);
    updateHud(hud, runtime.playerSnapshot());
  }
};
hud.root.addEventListener('click', handleClick);
const resultDialog =
  hud.root.querySelector<HTMLDialogElement>('.result-dialog')!;
const keepResultOpen = (event: Event): void => event.preventDefault();
resultDialog.addEventListener('cancel', keepResultOpen);
const handleBaseChange = (event: Event): void => {
  if (
    event.target instanceof HTMLSelectElement &&
    event.target.matches('[data-base-select]')
  ) {
    hud.selectedBaseId = event.target.value;
    updateHud(hud, runtime.playerSnapshot());
  }
};
hud.root.addEventListener('change', handleBaseChange);

const handleVisibility = (): void => {
  if (document.hidden) {
    input.reset();
    runtime.onHidden();
  }
};
document.addEventListener('visibilitychange', handleVisibility);

runtime.startLoop();
const handlePageShow = (event: PageTransitionEvent): void => {
  if (event.persisted) runtime.startLoop();
};
const handlePageHide = (event: PageTransitionEvent): void => {
  input.reset();
  runtime.onHidden();
  runtime.stopLoop();
  if (event.persisted) return;
  hud.root.removeEventListener('click', handleClick);
  resultDialog.removeEventListener('cancel', keepResultOpen);
  hud.root.removeEventListener('change', handleBaseChange);
  document.removeEventListener('visibilitychange', handleVisibility);
  window.removeEventListener('pageshow', handlePageShow);
  window.removeEventListener('pagehide', handlePageHide);
  input.dispose();
  board.dispose();
};
window.addEventListener('pageshow', handlePageShow);
window.addEventListener('pagehide', handlePageHide);
