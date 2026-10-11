import type { RuntimeSnapshot } from '../runtime/controller';

export interface HudElements {
  readonly root: HTMLElement;
  readonly board: HTMLElement;
  readonly seed: HTMLInputElement;
  readonly start: HTMLButtonElement;
  readonly pause: HTMLButtonElement;
  readonly resume: HTMLButtonElement;
  readonly reset: HTMLButtonElement;
  readonly applySeed: HTMLButtonElement;
  readonly stop: HTMLButtonElement;
  readonly clear: HTMLButtonElement;
  readonly camera: HTMLButtonElement;
  readonly units: HTMLElement;
  readonly status: HTMLElement;
  readonly download: HTMLButtonElement;
}

function button(label: string, action: string): HTMLButtonElement {
  const result = document.createElement('button');
  result.type = 'button';
  result.textContent = label;
  result.dataset.action = action;
  return result;
}

export function createHud(app: HTMLElement): HudElements {
  app.className = 'game-shell';
  app.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">◆</span><div><strong>RTS MATCH</strong><small>G1 · 移動検証</small></div></div>
      <div class="faction-legend" aria-label="陣営凡例">
        <span class="legend-a"><b>◆</b> A · PLAYER</span><span class="legend-b"><b>■</b> B · NPC</span><span class="legend-c"><b>⬡</b> C · NPC</span>
      </div>
      <div class="top-actions" aria-label="試合操作"></div>
      <details class="test-settings"><summary>検査設定</summary><div class="settings-popover">
        <label>seed <input data-seed type="number" min="0" max="4294967295" step="1" value="42" inputmode="numeric" aria-label="適用する試合seed"></label>
        <button type="button" data-action="apply-seed">適用してリセット</button>
        <button type="button" data-action="download">診断JSONを保存</button>
        <p>NPCの判断・戦闘・生産は未実装です。</p>
      </div></details>
    </header>
    <main class="board-frame" aria-label="盤面"><div class="board-host"></div>
      <div class="board-hint">自軍を選択して移動先を指定 · ドラッグでカメラ移動 · ホイールでズーム</div>
    </main>
    <footer class="bottom-bar">
      <div class="selection-summary"><strong class="selection-name">部隊未選択</strong><span class="selection-instruction">盤面からA部隊を選択してください</span></div>
      <div class="unit-list" aria-label="自軍部隊"></div>
      <div class="bottom-actions"></div>
      <div class="status-stack"><span class="status" role="status" aria-live="polite"></span><span class="tick-readout"></span></div>
    </footer>`;
  const controls = app.querySelector<HTMLElement>('.top-actions')!;
  const start = button('開始', 'start');
  start.classList.add('primary');
  const pause = button('一時停止', 'pause');
  const resume = button('再開', 'resume');
  resume.classList.add('primary');
  const reset = button('リセット', 'reset');
  controls.append(start, pause, resume, reset);
  const seed = app.querySelector<HTMLInputElement>('[data-seed]')!;
  const applySeed = app.querySelector<HTMLButtonElement>(
    '[data-action="apply-seed"]',
  )!;
  const units = app.querySelector<HTMLElement>('.unit-list')!;
  const actionHost = app.querySelector<HTMLElement>('.bottom-actions')!;
  const stop = button('部隊停止', 'stop');
  const clear = button('選択解除', 'clear');
  const camera = button('カメラ', 'camera');
  actionHost.append(stop, clear, camera);
  const status = app.querySelector<HTMLElement>('.status')!;
  const download = app.querySelector<HTMLButtonElement>(
    '[data-action="download"]',
  )!;
  seed.dataset.syncedSeed = '42';
  return {
    root: app,
    board: app.querySelector<HTMLElement>('.board-host')!,
    seed,
    start,
    pause,
    resume,
    reset,
    applySeed,
    stop,
    clear,
    camera,
    units,
    status,
    download,
  };
}

const glyph = '◆';

export function updateHud(
  elements: HudElements,
  snapshot: RuntimeSnapshot,
): void {
  const { state } = snapshot;
  if (elements.seed.dataset.syncedSeed !== String(state.seed)) {
    elements.seed.value = String(state.seed);
    elements.seed.dataset.syncedSeed = String(state.seed);
  }
  elements.start.hidden = state.phase !== 'ready' || snapshot.contextLost;
  elements.pause.hidden = state.phase !== 'running';
  elements.resume.hidden = state.phase !== 'paused' || snapshot.contextLost;
  elements.stop.disabled =
    state.phase !== 'running' || snapshot.selectedUnitId === null;
  elements.clear.disabled = snapshot.selectedUnitId === null;
  elements.status.textContent = snapshot.message;
  const readout = elements.root.querySelector<HTMLElement>('.tick-readout');
  if (readout)
    readout.textContent = `TICK ${state.elapsedTicks} · ${state.phase.toUpperCase()} · DROP ${Math.round(snapshot.droppedTimeMs)}ms`;
  const selected = state.units.find(
    (unit) => unit.id === snapshot.selectedUnitId,
  );
  const name = elements.root.querySelector<HTMLElement>('.selection-name');
  const instruction = elements.root.querySelector<HTMLElement>(
    '.selection-instruction',
  );
  if (name)
    name.textContent = selected
      ? `${glyph} ${selected.id} · ${selected.path.length > 0 ? '移動中' : '待機'}`
      : '部隊未選択';
  if (instruction)
    instruction.textContent = selected
      ? '移動先を指定 · 停止で次セル中心に停止'
      : '盤面からA部隊を選択してください';
  const ids = [
    ...elements.units.querySelectorAll<HTMLElement>('[data-unit]'),
  ].map((node) => node.dataset.unit);
  const expected = state.units
    .filter((unit) => unit.factionId === 'A')
    .map((unit) => unit.id);
  if (ids.join('|') !== expected.join('|')) {
    elements.units.replaceChildren(
      ...state.units
        .filter((unit) => unit.factionId === 'A')
        .map((unit) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.dataset.unit = unit.id;
          item.className = 'unit-card';
          item.innerHTML = `<span class="unit-glyph" aria-hidden="true">◆</span><span><strong>${unit.id}</strong><small>待機</small></span>`;
          return item;
        }),
    );
  }
  for (const item of elements.units.querySelectorAll<HTMLElement>(
    '[data-unit]',
  )) {
    const unit = state.units.find((entry) => entry.id === item.dataset.unit);
    const isSelected = snapshot.selectedUnitId === unit?.id;
    item.classList.toggle('selected', isSelected);
    item.setAttribute('aria-pressed', String(isSelected));
    const label = item.querySelector('small');
    if (label && unit)
      label.textContent = unit.path.length > 0 ? '移動中' : '待機';
  }
}
