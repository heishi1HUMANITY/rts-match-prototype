import { createBoardView } from './render/board';
import { createDiagnostic } from './runtime/diagnostics';
import { MatchRuntime } from './runtime/controller';
import { CanvasInput } from './ui/input';
import { createHud, updateHud } from './ui/hud';
import './ui/styles.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing application root');

const hud = createHud(app);
let runtime!: MatchRuntime;
let input!: CanvasInput;
let bootError: string | null = null;
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
    updateHud(hud, snapshot);
    board.setSelection(snapshot.selectedUnitId);
  },
  onFrame: (previous, current, alpha) => board.sync(previous, current, alpha),
});
updateHud(hud, runtime.snapshot());
if (bootError !== null) runtime.notify(bootError);
if (!board.available) hud.start.disabled = true;
input = new CanvasInput(
  {
    canvas: board.canvas,
    onTap: ({ x, y }) => {
      const picked = board.pick(x, y);
      if (picked === null) return;
      if (picked.kind === 'unit') {
        const unit = runtime
          .snapshot()
          .state.units.find((item) => item.id === picked.unitId);
        if (unit?.factionId === 'A') runtime.select(unit.id);
        else {
          runtime.select(null);
          runtime.notify(
            '敵陣営は操作できません。自軍の部隊を選択してください。',
          );
        }
        return;
      }
      const selected = runtime.snapshot().selectedUnitId;
      if (selected !== null && runtime.snapshot().state.phase === 'running') {
        runtime.dispatch({
          type: 'move',
          unitId: selected,
          target: picked.cell,
        });
      } else if (selected === null)
        runtime.notify('移動する自軍部隊を選択してください。');
    },
    onPan: (from, to) => board.pan(from, to),
    onZoom: (factor) => board.zoomBy(factor),
    onEscape: () => runtime.select(null),
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
    anchor.download = `g1-seed-${runtime.snapshot().state.seed}-tick-${runtime.snapshot().state.elapsedTicks}.json`;
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
  const unitButton = target.closest<HTMLElement>('[data-unit]');
  if (unitButton?.dataset.unit) {
    runtime.select(unitButton.dataset.unit);
    return;
  }
  const action =
    target.closest<HTMLButtonElement>('[data-action]')?.dataset.action;
  if (action === 'start') {
    input.reset();
    runtime.dispatch({ type: 'start' });
  } else if (action === 'pause') runtime.dispatch({ type: 'pause' });
  else if (action === 'resume') runtime.dispatch({ type: 'resume' });
  else if (action === 'reset') {
    input.reset();
    runtime.reset(runtime.snapshot().state.seed);
    board.resetCamera();
  } else if (action === 'apply-seed') {
    const seed = seedOrExplain();
    if (seed === null) return;
    input.reset();
    runtime.reset(seed);
    board.resetCamera();
  } else if (action === 'stop') {
    const unitId = runtime.snapshot().selectedUnitId;
    if (unitId !== null) runtime.dispatch({ type: 'stop', unitId });
  } else if (action === 'clear') runtime.select(null);
  else if (action === 'camera') board.resetCamera();
  else if (action === 'download') downloadDiagnostic();
};
hud.root.addEventListener('click', handleClick);

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
  document.removeEventListener('visibilitychange', handleVisibility);
  window.removeEventListener('pageshow', handlePageShow);
  window.removeEventListener('pagehide', handlePageHide);
  input.dispose();
  board.dispose();
};
window.addEventListener('pageshow', handlePageShow);
window.addEventListener('pagehide', handlePageHide);
