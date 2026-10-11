import * as THREE from 'three';
import {
  baseLabel,
  getUnitFrames,
  ownGroupPreviews,
  ownUnitIds,
  placeUnitLabel,
  type GroupMovePreview,
} from './view-model';
import { ISOLATED_CELL, MAP_HEIGHT, MAP_WIDTH } from '../simulation/config';
import { isCellBlocked } from '../simulation/map';
import type {
  Cell,
  GridMap,
  FactionView,
  UnitState,
  OwnUnitView,
  VisibleEnemyUnitView,
} from '../simulation/types';

export type BoardPick =
  | { readonly kind: 'unit'; readonly unitId: string }
  | { readonly kind: 'ground'; readonly cell: Cell }
  | { readonly kind: 'base'; readonly baseId: string };

export interface BoardView {
  readonly canvas: HTMLCanvasElement;
  readonly available: boolean;
  sync(previous: FactionView, current: FactionView, alpha: number): void;
  setSelection(unitId: string | null): void;
  setSelections(unitIds: readonly string[]): void;
  pick(clientX: number, clientY: number): BoardPick | null;
  /** Ground-only picking, even when a unit marker is under the pointer. */
  pickGround(clientX: number, clientY: number): Cell | null;
  setMovePreview(
    unitId: string,
    target: Cell,
    path: readonly Cell[] | null,
  ): void;
  setGroupMovePreview(
    previews: readonly GroupMovePreview[],
    target: Cell,
  ): void;
  clearMovePreview(): void;
  pan(
    from: { readonly x: number; readonly y: number },
    to: { readonly x: number; readonly y: number },
  ): void;
  zoomBy(factor: number): void;
  resetCamera(): void;
  resize(): void;
  dispose(): void;
}

export interface BoardViewOptions {
  readonly container: HTMLElement;
  readonly onContextLost?: () => void;
  readonly onContextRestored?: () => void;
  readonly onWebGLFailure?: (error: unknown) => void;
}

const FACTIONS = {
  A: { color: 0xe47a2f, symbol: '◆', marker: 'diamond' },
  B: { color: 0x2d9fc5, symbol: '■', marker: 'square' },
  C: { color: 0xd8ad24, symbol: '⬡', marker: 'hexagon' },
} as const;
const CAMERA_OFFSET = new THREE.Vector3(0, 32, 28);
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.5;
const MAX_ROUTE_CELLS = MAP_WIDTH * MAP_HEIGHT;

interface UnitObjects {
  readonly marker: THREE.Mesh;
  readonly route: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly destination: THREE.Mesh;
  readonly selection: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly glyph: HTMLSpanElement;
}

function createShape(
  kind: 'diamond' | 'square' | 'hexagon',
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  if (kind === 'diamond') {
    shape.moveTo(0, 0.48);
    shape.lineTo(0.36, 0);
    shape.lineTo(0, -0.48);
    shape.lineTo(-0.36, 0);
  } else if (kind === 'square') {
    shape.moveTo(-0.34, -0.34);
    shape.lineTo(0.34, -0.34);
    shape.lineTo(0.34, 0.34);
    shape.lineTo(-0.34, 0.34);
  } else {
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = Math.cos(angle) * 0.38;
      const y = Math.sin(angle) * 0.38;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function cellPosition(cell: Cell, y = 0): THREE.Vector3 {
  return new THREE.Vector3(cell.x + 0.5, y, cell.y + 0.5);
}

function discreteUnitPosition(unit: UnitState): THREE.Vector3 {
  const position = cellPosition(unit.cell, 0.17);
  const nextCell = unit.path[0];
  if (unit.edgeProgress > 0 && nextCell !== undefined) {
    position.lerp(cellPosition(nextCell, 0.17), unit.edgeProgress / 2);
  }
  return position;
}

function errorNode(error: unknown): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'rts-board-error';
  Object.assign(panel.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '2',
    display: 'grid',
    alignContent: 'center',
    justifyItems: 'center',
    gap: '0.6rem',
    padding: '1.25rem',
    boxSizing: 'border-box',
    color: '#20252b',
    background: '#f4f5f6',
    textAlign: 'center',
    font: '500 14px/1.45 system-ui, sans-serif',
  });
  const title = document.createElement('strong');
  title.textContent = '盤面を表示できません';
  const message = document.createElement('span');
  message.textContent =
    'この環境ではWebGLを初期化できませんでした。WebGL対応のブラウザーで再読み込みしてください。';
  const detail = document.createElement('small');
  detail.textContent = error instanceof Error ? error.message : String(error);
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = '再読み込み';
  Object.assign(reload.style, {
    minHeight: '44px',
    padding: '0.5rem 1rem',
    border: '1px solid #59616a',
    borderRadius: '4px',
    color: '#fff',
    background: '#252a30',
    font: 'inherit',
    cursor: 'pointer',
  });
  reload.addEventListener('click', () => window.location.reload());
  panel.append(title, message, detail, reload);
  return panel;
}

/** Creates the Three.js board adapter. The runtime owns RAF and input listeners. */
export function createBoardView(options: BoardViewOptions): BoardView {
  const { container } = options;
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }
  container.style.overflow = 'hidden';

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    options.onWebGLFailure?.(error);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', '盤面のWebGL表示');
    const panel = errorNode(error);
    container.append(canvas, panel);
    let disposed = false;
    return {
      canvas,
      available: false,
      sync: () => undefined,
      setSelection: () => undefined,
      setSelections: () => undefined,
      pick: () => null,
      pickGround: () => null,
      setMovePreview: () => undefined,
      setGroupMovePreview: () => undefined,
      clearMovePreview: () => undefined,
      pan: () => undefined,
      zoomBy: () => undefined,
      resetCamera: () => undefined,
      resize: () => undefined,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        panel.remove();
        canvas.remove();
      },
    };
  }

  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '40×40の盤面');
  Object.assign(canvas.style, {
    display: 'block',
    width: '100%',
    height: '100%',
    touchAction: 'none',
    outline: 'none',
  });
  container.append(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1f3f4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x77766e, 2.0));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(18, 38, 14);
  scene.add(keyLight);

  const resources = {
    geometries: new Set<THREE.BufferGeometry>(),
    materials: new Set<THREE.Material>(),
  };
  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
    resources.geometries.add(geometry);
    return geometry;
  };
  const ownMaterial = <T extends THREE.Material>(material: T): T => {
    resources.materials.add(material);
    return material;
  };

  const groundGeometry = ownGeometry(
    new THREE.PlaneGeometry(MAP_WIDTH, MAP_HEIGHT),
  );
  const groundMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({ color: 0xdfe5dc, roughness: 1 }),
  );
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(MAP_WIDTH / 2, 0, MAP_HEIGHT / 2);
  ground.name = 'ground-pick-surface';
  scene.add(ground);

  const gridPositions: number[] = [];
  for (let i = 0; i <= MAP_WIDTH; i += 1) {
    gridPositions.push(i, 0.012, 0, i, 0.012, MAP_HEIGHT);
  }
  for (let i = 0; i <= MAP_HEIGHT; i += 1) {
    gridPositions.push(0, 0.012, i, MAP_WIDTH, 0.012, i);
  }
  const gridGeometry = ownGeometry(new THREE.BufferGeometry());
  gridGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(gridPositions, 3),
  );
  const grid = new THREE.LineSegments(
    gridGeometry,
    ownMaterial(
      new THREE.LineBasicMaterial({
        color: 0x738078,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    ),
  );
  grid.name = 'cell-grid';
  scene.add(grid);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const cameraTarget = new THREE.Vector3(MAP_WIDTH / 2, 0, MAP_HEIGHT / 2);
  let zoom = 1;
  const elevation = Math.atan2(CAMERA_OFFSET.y, CAMERA_OFFSET.z);
  const resizeCamera = (width: number, height: number): void => {
    const aspect = width / height;
    const projectedBoardDepth = MAP_HEIGHT * Math.sin(elevation);
    const visibleHeight =
      Math.max(projectedBoardDepth, MAP_WIDTH / aspect) * 1.25;
    const frustumHeight = visibleHeight / zoom;
    const frustumWidth = frustumHeight * aspect;
    camera.left = -frustumWidth / 2;
    camera.right = frustumWidth / 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;
    camera.position.copy(cameraTarget).add(CAMERA_OFFSET);
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();
  };

  const labelLayer = document.createElement('div');
  labelLayer.className = 'rts-board-labels';
  Object.assign(labelLayer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '1',
  });
  container.append(labelLayer);

  const markerGeometry = new Map<keyof typeof FACTIONS, THREE.BufferGeometry>();
  const markerMaterial = new Map<
    keyof typeof FACTIONS,
    THREE.MeshStandardMaterial
  >();
  const routeMaterial = new Map<
    keyof typeof FACTIONS,
    THREE.LineBasicMaterial
  >();
  for (const faction of Object.keys(FACTIONS) as (keyof typeof FACTIONS)[]) {
    markerGeometry.set(
      faction,
      ownGeometry(createShape(FACTIONS[faction].marker)),
    );
    markerMaterial.set(
      faction,
      ownMaterial(
        new THREE.MeshStandardMaterial({
          color: FACTIONS[faction].color,
          roughness: 0.65,
          transparent: true,
          side: THREE.DoubleSide,
        }),
      ),
    );
    routeMaterial.set(
      faction,
      ownMaterial(
        new THREE.LineBasicMaterial({
          color: FACTIONS[faction].color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      ),
    );
  }

  const ringGeometry = ownGeometry(new THREE.TorusGeometry(0.43, 0.035, 8, 40));
  const selectionMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      color: 0x181c20,
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  const destinationMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      color: 0x181c20,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    }),
  );
  const movePreviewMaterial = ownMaterial(
    new THREE.LineBasicMaterial({
      color: 0x167a9a,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    }),
  );
  const movePreviewValidMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      color: 0x167a9a,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  const movePreviewInvalidMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xb42318,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  const movePreviewMixedMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xb87520,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  const unitObjects = new Map<string, UnitObjects>();
  const unitRaycastTargets: THREE.Mesh[] = [];
  const movePreviewLines = new Map<
    string,
    THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>
  >();
  const movePreviewCapacity = new Map<string, number>();
  const movePreviewTarget = new THREE.Mesh(
    ringGeometry,
    movePreviewValidMaterial,
  );
  movePreviewTarget.renderOrder = 4;
  movePreviewTarget.name = 'move-preview-target';
  movePreviewTarget.rotation.x = -Math.PI / 2;
  movePreviewTarget.position.y = 0.085;
  movePreviewTarget.visible = false;
  scene.add(movePreviewTarget);

  const createUnitObjects = (
    unit: OwnUnitView | VisibleEnemyUnitView,
  ): UnitObjects => {
    const faction = unit.factionId;
    const marker = new THREE.Mesh(
      markerGeometry.get(faction)!,
      markerMaterial.get(faction)!,
    );
    marker.position.y = 0.17;
    marker.name = unit.id;
    marker.userData.unitId = unit.id;
    scene.add(marker);
    unitRaycastTargets.push(marker);

    const routeGeometry = ownGeometry(new THREE.BufferGeometry());
    const routePositions = new Float32Array((MAX_ROUTE_CELLS + 1) * 3);
    routeGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(routePositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    routeGeometry.setDrawRange(0, 0);
    const route = new THREE.Line(routeGeometry, routeMaterial.get(faction)!);
    route.frustumCulled = false;
    route.visible = false;
    route.name = `${unit.id}-path`;
    scene.add(route);

    const selection = new THREE.Mesh(ringGeometry, selectionMaterial);
    selection.rotation.x = -Math.PI / 2;
    selection.position.y = 0.045;
    selection.visible = false;
    selection.name = `${unit.id}-selection`;
    scene.add(selection);

    const destination = new THREE.Mesh(ringGeometry, destinationMaterial);
    destination.rotation.x = -Math.PI / 2;
    destination.position.y = 0.055;
    destination.visible = false;
    destination.name = `${unit.id}-destination`;
    scene.add(destination);

    const label = document.createElement('div');
    label.className = `rts-unit-label rts-unit-label-${faction.toLowerCase()}`;
    label.dataset.unitId = unit.id;
    Object.assign(label.style, {
      position: 'absolute',
      width: '44px',
      height: '44px',
      display: 'grid',
      placeItems: 'center',
      boxSizing: 'border-box',
      border: `1px solid #${FACTIONS[faction].color.toString(16).padStart(6, '0')}`,
      borderRadius: '50%',
      color: '#20252b',
      background: 'rgba(255,255,255,0.96)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
      font: '700 11px/1 system-ui, sans-serif',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    });
    const glyph = document.createElement('span');
    glyph.textContent = FACTIONS[faction].symbol;
    glyph.style.whiteSpace = 'pre-line';
    glyph.style.textAlign = 'center';
    glyph.style.font = '700 10px/1.3 system-ui,sans-serif';
    glyph.setAttribute('aria-hidden', 'true');
    label.append(glyph);
    labelLayer.append(label);
    const objects: UnitObjects = {
      marker,
      route,
      destination,
      selection,
      label,
      glyph,
    };
    for (const object of [marker, route, selection, destination])
      object.renderOrder = 3;
    unitObjects.set(unit.id, objects);
    return objects;
  };

  const inspectionLabel = document.createElement('div');
  inspectionLabel.className = 'rts-inspection-label';
  inspectionLabel.textContent = '検査用孤立セル (30, 10)';
  Object.assign(inspectionLabel.style, {
    position: 'absolute',
    padding: '2px 5px',
    border: '1px solid #525a60',
    borderRadius: '3px',
    color: '#24282b',
    background: 'rgba(255,255,255,0.94)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
    font: '600 11px/1.2 system-ui, sans-serif',
    whiteSpace: 'nowrap',
    transform: 'translate(-50%, -100%)',
  });
  inspectionLabel.setAttribute('aria-label', '検査用孤立セル 30, 10');
  labelLayer.append(inspectionLabel);

  let mapMesh: THREE.InstancedMesh | null = null;
  let renderedMap: GridMap | null = null;
  const installMap = (map: GridMap): void => {
    if (
      renderedMap !== null &&
      renderedMap.width === map.width &&
      renderedMap.height === map.height &&
      renderedMap.blocked.every((value, index) => value === map.blocked[index])
    )
      return;
    if (mapMesh !== null) {
      scene.remove(mapMesh);
      mapMesh.geometry.dispose();
      if (Array.isArray(mapMesh.material)) {
        mapMesh.material.forEach((material) => material.dispose());
      } else {
        mapMesh.material.dispose();
      }
      resources.geometries.delete(mapMesh.geometry);
      mapMesh.dispose();
      if (Array.isArray(mapMesh.material)) {
        mapMesh.material.forEach((material) =>
          resources.materials.delete(material),
        );
      } else {
        resources.materials.delete(mapMesh.material);
      }
    }
    mapMesh = null;
    renderedMap = map;
    let count = 0;
    for (const blocked of map.blocked) if (blocked) count += 1;
    if (count === 0) return;
    const geometry = ownGeometry(new THREE.BoxGeometry(0.84, 0.42, 0.84));
    const material = ownMaterial(
      new THREE.MeshStandardMaterial({ color: 0x696f6a, roughness: 1 }),
    );
    mapMesh = new THREE.InstancedMesh(geometry, material, count);
    mapMesh.name = 'obstacles';
    const matrix = new THREE.Matrix4();
    let instance = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!isCellBlocked(map, { x, y })) continue;
        matrix.makeTranslation(x + 0.5, 0.22, y + 0.5);
        mapMesh.setMatrixAt(instance++, matrix);
      }
    }
    mapMesh.instanceMatrix.needsUpdate = true;
    mapMesh.computeBoundingSphere();
    scene.add(mapMesh);
  };

  let selectedUnitIds: readonly string[] = [];
  let lastCurrent: FactionView | null = null;
  let lastAlpha = 0;
  let contextLost = false;
  let disposed = false;
  let movePreviewRequest: {
    readonly previews: readonly GroupMovePreview[];
    readonly target: Cell;
  } | null = null;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const scratchVector = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const releasePreviewLine = (unitId: string): void => {
    const line = movePreviewLines.get(unitId);
    if (line === undefined) return;
    scene.remove(line);
    line.geometry.dispose();
    resources.geometries.delete(line.geometry);
    movePreviewLines.delete(unitId);
    movePreviewCapacity.delete(unitId);
  };
  const clearPreviewObjects = (): void => {
    for (const unitId of [...movePreviewLines.keys()])
      releasePreviewLine(unitId);
    movePreviewTarget.visible = false;
    for (const objects of unitObjects.values()) {
      objects.selection.material = selectionMaterial;
      objects.label.dataset.previewRejected = 'false';
      objects.label.style.outline = '';
    }
  };
  const previewLineFor = (
    unitId: string,
    vertexCount: number,
  ): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> => {
    let line = movePreviewLines.get(unitId);
    const capacity = movePreviewCapacity.get(unitId) ?? 0;
    if (line === undefined) {
      const geometry = ownGeometry(new THREE.BufferGeometry());
      line = new THREE.Line(geometry, movePreviewMaterial);
      line.renderOrder = 4;
      line.name = `${unitId}-move-preview-route`;
      line.frustumCulled = false;
      scene.add(line);
      movePreviewLines.set(unitId, line);
    }
    if (vertexCount > capacity) {
      const nextCapacity = Math.max(2, capacity * 2, vertexCount);
      const oldGeometry = line.geometry;
      const geometry = ownGeometry(new THREE.BufferGeometry());
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array(nextCapacity * 3),
          3,
        ).setUsage(THREE.DynamicDrawUsage),
      );
      line.geometry = geometry;
      oldGeometry.dispose();
      resources.geometries.delete(oldGeometry);
      movePreviewCapacity.set(unitId, nextCapacity);
    }
    return line;
  };
  const refreshMovePreview = (): void => {
    const request = movePreviewRequest;
    if (
      contextLost ||
      disposed ||
      lastCurrent === null ||
      lastCurrent.phase !== 'running' ||
      request === null
    ) {
      clearPreviewObjects();
      return;
    }
    const previews = ownGroupPreviews(lastCurrent, request.previews);
    if (previews.length === 0) {
      clearPreviewObjects();
      return;
    }
    const ownUnits = new Map(
      lastCurrent.ownUnits.map((unit) => [unit.id, unit]),
    );
    const previewIds = new Set(previews.map(({ unitId }) => unitId));
    for (const unitId of [...movePreviewLines.keys()]) {
      if (!previewIds.has(unitId)) releasePreviewLine(unitId);
    }
    const invalidIds = new Set(
      previews.filter(({ path }) => path === null).map(({ unitId }) => unitId),
    );
    for (const [unitId, objects] of unitObjects) {
      const invalid = invalidIds.has(unitId);
      objects.selection.material = invalid
        ? movePreviewInvalidMaterial
        : selectionMaterial;
      objects.label.dataset.previewRejected = String(invalid);
      objects.label.style.outline = invalid ? '2px solid #b42318' : '';
    }
    movePreviewTarget.position.copy(cellPosition(request.target, 0.085));
    movePreviewTarget.material =
      invalidIds.size === previews.length
        ? movePreviewInvalidMaterial
        : invalidIds.size > 0
          ? movePreviewMixedMaterial
          : movePreviewValidMaterial;
    movePreviewTarget.visible = true;
    for (const { unitId, path } of previews) {
      if (path === null) {
        releasePreviewLine(unitId);
        continue;
      }
      const unit = ownUnits.get(unitId)!;
      const count = path.length + 1;
      const line = previewLineFor(unitId, count);
      const attribute = line.geometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      const positions = attribute.array as Float32Array;
      const startPosition = discreteUnitPosition(unit);
      positions[0] = startPosition.x;
      positions[1] = 0.095;
      positions[2] = startPosition.z;
      for (let index = 0; index < path.length; index += 1) {
        const cell = path[index]!;
        positions[(index + 1) * 3] = cell.x + 0.5;
        positions[(index + 1) * 3 + 1] = 0.095;
        positions[(index + 1) * 3 + 2] = cell.y + 0.5;
      }
      attribute.needsUpdate = true;
      line.geometry.setDrawRange(0, count);
      line.geometry.computeBoundingSphere();
      line.visible = count > 1;
    }
  };

  const resize = (): void => {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    resizeCamera(width, height);
    if (!contextLost) renderer.render(scene, camera);
  };

  const updateLabelPosition = (
    element: HTMLElement,
    position: THREE.Vector3,
    offsetY = 0,
  ): void => {
    scratchVector.copy(position).project(camera);
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const x =
      canvasRect.left -
      containerRect.left +
      (scratchVector.x + 1) * canvasRect.width * 0.5;
    const y =
      canvasRect.top -
      containerRect.top +
      (-scratchVector.y + 1) * canvasRect.height * 0.5 +
      offsetY;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.display =
      scratchVector.z < -1 || scratchVector.z > 1 ? 'none' : 'grid';
  };

  const baseObjects = new Map<
    string,
    {
      marker: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      label: HTMLDivElement;
    }
  >();
  const baseGeometry = ownGeometry(
    new THREE.CylinderGeometry(0.7, 0.7, 0.25, 6),
  );
  const syncBases = (view: FactionView): void => {
    const ids = new Set(view.bases.map((base) => base.id));
    for (const [id, objects] of baseObjects) {
      if (ids.has(id)) continue;
      scene.remove(objects.marker);
      objects.marker.material.dispose();
      resources.materials.delete(objects.marker.material);
      objects.label.remove();
      baseObjects.delete(id);
    }
    for (const base of view.bases) {
      let objects = baseObjects.get(base.id);
      if (objects === undefined) {
        const material = ownMaterial(
          new THREE.MeshBasicMaterial({ color: 0x8c9296 }),
        );
        const marker = new THREE.Mesh(baseGeometry, material);
        marker.userData.baseId = base.id;
        marker.renderOrder = 2;
        const label = document.createElement('div');
        label.className = 'rts-base-label';
        Object.assign(label.style, {
          position: 'absolute',
          padding: '3px 5px',
          border: '1px solid #535e66',
          borderRadius: '3px',
          color: '#20252b',
          background: 'rgba(255,255,255,.94)',
          font: '600 10px/1.3 system-ui,sans-serif',
          whiteSpace: 'nowrap',
          transform: 'translate(-50%, -100%)',
          pointerEvents: 'none',
        });
        labelLayer.append(label);
        scene.add(marker);
        objects = { marker, label };
        baseObjects.set(base.id, objects);
      }
      const owner = base.visibility === 'unknown' ? null : base.owner;
      objects.marker.material.color.setHex(
        owner === null ? 0x8c9296 : FACTIONS[owner].color,
      );
      objects.marker.material.transparent = true;
      objects.marker.material.opacity =
        base.visibility === 'remembered'
          ? 0.5
          : base.visibility === 'unknown'
            ? 0.3
            : 1;
      objects.marker.position.copy(cellPosition(base.cell, 0.15));
      objects.marker.scale.setScalar(base.kind === 'hq' ? 1.3 : 1);
      objects.label.textContent = baseLabel(base);
      objects.label.dataset.visibility = base.visibility;
      objects.label.style.borderStyle =
        base.visibility === 'remembered' ? 'dashed' : 'solid';
      updateLabelPosition(objects.label, cellPosition(base.cell, 0.3), -18);
    }
  };
  const fogGeometry = ownGeometry(new THREE.PlaneGeometry(1, 1));
  fogGeometry.rotateX(-Math.PI / 2);
  const fogMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.76,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const fogMesh = new THREE.InstancedMesh(
    fogGeometry,
    fogMaterial,
    MAX_ROUTE_CELLS,
  );
  fogMesh.name = 'visibility-fog';
  fogMesh.renderOrder = 1;
  fogMesh.frustumCulled = false;
  scene.add(fogMesh);
  let fogSignature = '';
  const syncFog = (view: FactionView): void => {
    const signature = view.visible
      .map((visible, index) =>
        visible ? '2' : view.explored[index] ? '1' : '0',
      )
      .join('');
    if (signature === fogSignature) return;
    fogSignature = signature;
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let index = 0; index < MAX_ROUTE_CELLS; index += 1) {
      matrix.makeScale(
        view.visible[index] ? 0 : 1,
        1,
        view.visible[index] ? 0 : 1,
      );
      matrix.setPosition(
        (index % MAP_WIDTH) + 0.5,
        0.6,
        Math.floor(index / MAP_WIDTH) + 0.5,
      );
      fogMesh.setMatrixAt(index, matrix);
      fogMesh.setColorAt(
        index,
        color.setHex(view.explored[index] ? 0x8c99a2 : 0x17232d),
      );
    }
    fogMesh.instanceMatrix.needsUpdate = true;
    if (fogMesh.instanceColor !== null)
      fogMesh.instanceColor.needsUpdate = true;
  };

  const sync = (
    previous: FactionView,
    current: FactionView,
    alpha: number,
  ): void => {
    if (disposed) return;
    if (
      lastCurrent !== null &&
      (current.seed !== lastCurrent.seed ||
        current.scenarioId !== lastCurrent.scenarioId ||
        current.tick < lastCurrent.tick ||
        (current.phase === 'ready' && lastCurrent.phase !== 'ready'))
    ) {
      selectedUnitIds = [];
      movePreviewRequest = null;
      clearPreviewObjects();
    }
    lastCurrent = current;
    if (current.phase !== 'running') movePreviewRequest = null;
    selectedUnitIds = ownUnitIds(current, selectedUnitIds);
    lastAlpha = Math.max(0, Math.min(1, alpha));
    installMap(current.map);
    const frames = getUnitFrames(previous, current, lastAlpha);
    const present = new Set(frames.map(({ unit }) => unit.id));
    for (const [id, objects] of unitObjects) {
      if (present.has(id)) continue;
      scene.remove(
        objects.marker,
        objects.route,
        objects.selection,
        objects.destination,
      );
      objects.route.geometry.dispose();
      resources.geometries.delete(objects.route.geometry);
      objects.label.remove();
      unitRaycastTargets.splice(unitRaycastTargets.indexOf(objects.marker), 1);
      unitObjects.delete(id);
    }
    const occupiedLabels: { x: number; y: number }[] = [];
    for (const { unit, x, z } of frames) {
      const objects = unitObjects.get(unit.id) ?? createUnitObjects(unit);
      const currentPosition = new THREE.Vector3(x, 0.17, z);
      const path = unit.control === 'own' ? unit.path : [];
      const march = unit.control === 'own' ? unit.marchOrder : null;
      objects.glyph.textContent = `${FACTIONS[unit.factionId].symbol}${unit.kind === 'scout' ? '偵' : '突'}${march ? '→' : ''}\n${unit.hp}/${unit.maxHp}`;
      objects.label.title = `${unit.id} ${unit.kind} HP ${unit.hp}/${unit.maxHp}${march ? ` → ${march.target.id}` : ''}`;
      objects.marker.position.copy(currentPosition);
      objects.selection.position.set(
        currentPosition.x,
        0.045,
        currentPosition.z,
      );
      objects.selection.visible =
        unit.control === 'own' && selectedUnitIds.includes(unit.id);
      objects.label.classList.toggle('selected', objects.selection.visible);
      objects.label.dataset.selected = String(objects.selection.visible);

      const positionAttribute = objects.route.geometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      const routeArray = positionAttribute.array as Float32Array;
      let routeCount = 0;
      if (path.length > 0) {
        routeArray[routeCount * 3] = currentPosition.x;
        routeArray[routeCount * 3 + 1] = 0.075;
        routeArray[routeCount * 3 + 2] = currentPosition.z;
        routeCount += 1;
        for (const cell of path) {
          if (routeCount >= routeArray.length / 3) break;
          routeArray[routeCount * 3] = cell.x + 0.5;
          routeArray[routeCount * 3 + 1] = 0.075;
          routeArray[routeCount * 3 + 2] = cell.y + 0.5;
          routeCount += 1;
        }
      }
      positionAttribute.needsUpdate = true;
      objects.route.geometry.setDrawRange(0, routeCount);
      objects.route.geometry.computeBoundingSphere();
      objects.route.visible = routeCount > 1;

      const destinationCell = path[path.length - 1];
      objects.destination.visible = destinationCell !== undefined;
      if (destinationCell !== undefined) {
        objects.destination.position.set(
          destinationCell.x + 0.5,
          0.06,
          destinationCell.y + 0.5,
        );
      }
      updateLabelPosition(objects.label, currentPosition);
      const bounds = canvas.getBoundingClientRect();
      const anchorX = parseFloat(objects.label.style.left);
      const anchorY = parseFloat(objects.label.style.top);
      if (
        anchorX < 0 ||
        anchorX > bounds.width ||
        anchorY < 0 ||
        anchorY > bounds.height
      ) {
        objects.label.style.display = 'none';
        continue;
      }
      const label = placeUnitLabel(
        {
          x: parseFloat(objects.label.style.left),
          y: parseFloat(objects.label.style.top),
        },
        occupiedLabels,
        bounds.width,
        bounds.height,
      );
      objects.label.style.left = `${label.x}px`;
      objects.label.style.top = `${label.y}px`;
      occupiedLabels.push(label);
    }
    syncBases(current);
    syncFog(current);
    refreshMovePreview();
    updateLabelPosition(inspectionLabel, cellPosition(ISOLATED_CELL, 0.03), -3);
    if (!contextLost) renderer.render(scene, camera);
  };

  const rayFromClient = (clientX: number, clientY: number): boolean => {
    const rect = canvas.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      clientX < rect.left ||
      clientX >= rect.right ||
      clientY < rect.top ||
      clientY >= rect.bottom
    ) {
      return false;
    }
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return true;
  };

  const groundPointAt = (
    clientX: number,
    clientY: number,
  ): THREE.Vector3 | null => {
    if (!rayFromClient(clientX, clientY)) return null;
    return raycaster.ray.intersectPlane(groundPlane, new THREE.Vector3());
  };

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
    movePreviewRequest = null;
    clearPreviewObjects();
    options.onContextLost?.();
  };
  const onContextRestored = (): void => {
    contextLost = false;
    resize();
    if (lastCurrent !== null) {
      const latest = lastCurrent;
      sync(latest, latest, 0);
    }
    options.onContextRestored?.();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const setSelections = (unitIds: readonly string[]): void => {
    if (disposed) return;
    selectedUnitIds = lastCurrent
      ? ownUnitIds(lastCurrent, unitIds)
      : [...new Set(unitIds)];
    const selected = new Set(selectedUnitIds);
    for (const [id, objects] of unitObjects) {
      const active = selected.has(id);
      objects.selection.visible = active;
      objects.label.classList.toggle('selected', active);
      objects.label.dataset.selected = String(active);
    }
    if (!contextLost) renderer.render(scene, camera);
  };
  const setGroupMovePreview = (
    previews: readonly GroupMovePreview[],
    target: Cell,
  ): void => {
    if (disposed) return;
    movePreviewRequest = {
      previews: previews.map(({ unitId, path }) => ({
        unitId,
        path: path?.map((cell) => ({ ...cell })) ?? null,
      })),
      target: { ...target },
    };
    refreshMovePreview();
    if (!contextLost) renderer.render(scene, camera);
  };
  const clearMovePreview = (): void => {
    movePreviewRequest = null;
    clearPreviewObjects();
    if (!contextLost && !disposed) renderer.render(scene, camera);
  };

  return {
    canvas,
    available: true,
    sync,
    setSelection(unitId) {
      setSelections(unitId === null ? [] : [unitId]);
    },
    setSelections,
    pick(clientX, clientY) {
      if (disposed || contextLost || !rayFromClient(clientX, clientY))
        return null;
      const rect = canvas.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      let labelHit: {
        readonly unitId: string;
        readonly distance: number;
      } | null = null;
      for (const [unitId, objects] of unitObjects) {
        const labelRect = objects.label.getBoundingClientRect();
        if (
          labelRect.width > 0 &&
          localX + rect.left >= labelRect.left &&
          localX + rect.left <= labelRect.right &&
          localY + rect.top >= labelRect.top &&
          localY + rect.top <= labelRect.bottom
        ) {
          const dx =
            localX + rect.left - (labelRect.left + labelRect.right) / 2;
          const dy = localY + rect.top - (labelRect.top + labelRect.bottom) / 2;
          const distance = dx * dx + dy * dy;
          if (labelHit === null || distance < labelHit.distance) {
            labelHit = { unitId, distance };
          }
        }
      }
      if (labelHit !== null) return { kind: 'unit', unitId: labelHit.unitId };
      const unitHit = raycaster.intersectObjects(unitRaycastTargets, false)[0];
      if (unitHit !== undefined) {
        const unitId = unitHit.object.userData.unitId;
        if (typeof unitId === 'string') return { kind: 'unit', unitId };
      }
      for (const [baseId, objects] of baseObjects) {
        const bounds = objects.label.getBoundingClientRect();
        if (
          bounds.width > 0 &&
          clientX >= bounds.left &&
          clientX <= bounds.right &&
          clientY >= bounds.top &&
          clientY <= bounds.bottom
        )
          return { kind: 'base', baseId };
      }
      const baseHit = raycaster.intersectObjects(
        [...baseObjects.values()].map((objects) => objects.marker),
        false,
      )[0];
      if (baseHit !== undefined)
        return {
          kind: 'base',
          baseId: baseHit.object.userData.baseId as string,
        };
      const groundHit = raycaster.intersectObject(ground, false)[0];
      if (groundHit === undefined) return null;
      const x = Math.floor(groundHit.point.x);
      const y = Math.floor(groundHit.point.z);
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
      return { kind: 'ground', cell: { x, y } };
    },
    pickGround(clientX, clientY) {
      if (disposed || contextLost) return null;
      const point = groundPointAt(clientX, clientY);
      if (point === null) return null;
      const x = Math.floor(point.x);
      const y = Math.floor(point.z);
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
      return { x, y };
    },
    setMovePreview(unitId, target, path) {
      setGroupMovePreview([{ unitId, path }], target);
    },
    setGroupMovePreview,
    clearMovePreview,
    pan(from, to) {
      const fromGround = groundPointAt(from.x, from.y);
      const toGround = groundPointAt(to.x, to.y);
      if (fromGround === null || toGround === null) return;
      cameraTarget.x = THREE.MathUtils.clamp(
        cameraTarget.x + fromGround.x - toGround.x,
        0,
        MAP_WIDTH,
      );
      cameraTarget.z = THREE.MathUtils.clamp(
        cameraTarget.z + fromGround.z - toGround.z,
        0,
        MAP_HEIGHT,
      );
      resize();
    },
    zoomBy(factor) {
      if (!Number.isFinite(factor) || factor <= 0) return;
      zoom = THREE.MathUtils.clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
      resize();
    },
    resetCamera() {
      clearMovePreview();
      cameraTarget.set(MAP_WIDTH / 2, 0, MAP_HEIGHT / 2);
      zoom = 1;
      resize();
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      selectedUnitIds = [];
      movePreviewRequest = null;
      clearPreviewObjects();
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
      if (mapMesh !== null) {
        scene.remove(mapMesh);
        mapMesh.dispose();
      }
      fogMesh.dispose();
      for (const geometry of resources.geometries) geometry.dispose();
      for (const material of resources.materials) material.dispose();
      scene.clear();
    },
  };
}
