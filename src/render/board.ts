import { FACILITY_NAMES, FACILITY_GLYPHS } from '../ui/facilities';
import * as THREE from 'three';
import {
  baseLabel,
  getUnitFrames,
  ownGroupPreviews,
  ownUnitIds,
  placeUnitLabel,
  type GroupMovePreview,
} from './view-model';
import { isCellBlocked } from '../simulation/map';
import { terrainAt } from '../simulation/map';
import { FOG_SURFACE_Y } from './fog-surface';
import type {
  Cell,
  CombatantId,
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
  focusCell(cell: Cell): void;
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
  local: { color: 0x66747c, symbol: '●', marker: 'circle' },
} as const;
const CAMERA_OFFSET = new THREE.Vector3(0, 32, 28);
const BOARD_SIZE = 100;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.5;
const MAX_ROUTE_CELLS = BOARD_SIZE * BOARD_SIZE;

interface UnitObjects {
  readonly marker: THREE.Mesh;
  readonly route: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly destination: THREE.Mesh;
  readonly selection: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly glyph: HTMLSpanElement;
}

function createShape(
  kind: 'diamond' | 'square' | 'hexagon' | 'circle',
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  if (kind === 'circle') {
    shape.absarc(0, 0, 0.38, 0, Math.PI * 2, false);
  } else if (kind === 'diamond') {
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
    position.lerp(
      cellPosition(nextCell, 0.17),
      unit.edgeProgress / (unit.moveTicksPerCell ?? 2),
    );
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
      focusCell: () => undefined,
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
  canvas.setAttribute('aria-label', `${BOARD_SIZE}×${BOARD_SIZE}の盤面`);
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
    new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE),
  );
  const groundMaterial = ownMaterial(
    new THREE.MeshStandardMaterial({ color: 0xdfe5dc, roughness: 1 }),
  );
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(BOARD_SIZE / 2, 0, BOARD_SIZE / 2);
  ground.name = 'ground-pick-surface';
  scene.add(ground);

  const gridPositions: number[] = [];
  for (let i = 0; i <= BOARD_SIZE; i += 1) {
    gridPositions.push(i, 0.012, 0, i, 0.012, BOARD_SIZE);
  }
  for (let i = 0; i <= BOARD_SIZE; i += 1) {
    gridPositions.push(0, 0.012, i, BOARD_SIZE, 0.012, i);
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

  let boardWidth = BOARD_SIZE;
  let boardHeight = BOARD_SIZE;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const cameraTarget = new THREE.Vector3(boardWidth / 2, 0, boardHeight / 2);
  let zoom = 1;
  const elevation = Math.atan2(CAMERA_OFFSET.y, CAMERA_OFFSET.z);
  const resizeCamera = (width: number, height: number): void => {
    const aspect = width / height;
    const projectedBoardDepth = boardHeight * Math.sin(elevation);
    const visibleHeight =
      Math.max(projectedBoardDepth, boardWidth / aspect) * 1.25;
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
  const combatSvg = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  );
  combatSvg.classList.add('rts-combat-links');
  Object.assign(combatSvg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '2',
  });
  labelLayer.append(combatSvg);

  const markerGeometry = new Map<CombatantId, THREE.BufferGeometry>();
  const markerMaterial = new Map<CombatantId, THREE.MeshStandardMaterial>();
  const routeMaterial = new Map<CombatantId, THREE.LineBasicMaterial>();
  for (const faction of Object.keys(FACTIONS) as CombatantId[]) {
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
  const airDefenseRings = new Map<
    string,
    THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>
  >();
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

  let mapMesh: THREE.InstancedMesh | null = null;
  let mapSiteLabels: {
    readonly cell: Cell;
    readonly label: HTMLDivElement;
    readonly crossingId?: string;
    readonly crossingEndpoint?: 'A' | 'B';
  }[] = [];
  let renderedMap: GridMap | null = null;
  const installMap = (map: GridMap): void => {
    if (renderedMap === map) return;
    if (
      renderedMap !== null &&
      renderedMap.width === map.width &&
      renderedMap.height === map.height &&
      renderedMap.blocked.every(
        (value, index) => value === map.blocked[index],
      ) &&
      renderedMap.terrain?.every(
        (value, index) => value === map.terrain?.[index],
      )
    )
      return;
    boardWidth = map.width;
    boardHeight = map.height;
    ground.scale.set(boardWidth / BOARD_SIZE, 1, boardHeight / BOARD_SIZE);
    grid.scale.set(boardWidth / BOARD_SIZE, 1, boardHeight / BOARD_SIZE);
    ground.position.set(boardWidth / 2, 0, boardHeight / 2);
    cameraTarget.set(boardWidth / 2, 0, boardHeight / 2);
    canvas.setAttribute('aria-label', `${boardWidth}×${boardHeight}の盤面`);
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
    for (const entry of mapSiteLabels) entry.label.remove();
    mapSiteLabels = [];
    for (const port of map.ports ?? []) {
      const label = document.createElement('div');
      label.className = 'rts-map-site-label port-site';
      label.textContent = '⚓ 港';
      label.setAttribute('aria-label', `公開港 ${port.id}`);
      labelLayer.append(label);
      mapSiteLabels.push({ cell: port.cell, label });
    }
    for (const [index, site] of (map.crossingSites ?? []).entries()) {
      for (const [endpoint, cell] of [
        ['A', site.bankA],
        ['B', site.bankB],
      ] as const) {
        const label = document.createElement('div');
        label.className = 'rts-map-site-label crossing-site';
        label.textContent = `${index + 1}${endpoint}`;
        label.setAttribute(
          'aria-label',
          `公開${site.tier.startsWith('bridge') ? '橋' : '索道'}予定地 ${site.id} ${endpoint}端`,
        );
        label.dataset.mapCrossingEndpoint = `${site.id}:${endpoint}`;
        labelLayer.append(label);
        mapSiteLabels.push({
          cell,
          label,
          crossingId: site.id,
          crossingEndpoint: endpoint,
        });
      }
    }
    renderedMap = map;
    let count = 0;
    for (const blocked of map.blocked) if (blocked) count += 1;
    if (count === 0) return;
    const geometry = ownGeometry(new THREE.BoxGeometry(0.84, 0.42, 0.84));
    const material = ownMaterial(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    );
    mapMesh = new THREE.InstancedMesh(geometry, material, count);
    mapMesh.name = 'obstacles';
    const matrix = new THREE.Matrix4();
    let instance = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!isCellBlocked(map, { x, y })) continue;
        const kind = terrainAt(map, { x, y });
        const height =
          kind === 'mountain' ? 0.9 : kind === 'river' ? 0.1 : 0.42;
        const color =
          kind === 'river'
            ? 0x3f9bb4
            : kind === 'riverbank'
              ? 0xb49c69
              : kind === 'mountain'
                ? 0x69756c
                : 0x59615f;
        matrix.compose(
          new THREE.Vector3(x + 0.5, height / 2, y + 0.5),
          new THREE.Quaternion(),
          new THREE.Vector3(0.84, height, 0.84),
        );
        mapMesh.setMatrixAt(instance++, matrix);
        mapMesh.setColorAt(instance - 1, new THREE.Color(color));
      }
    }
    mapMesh.instanceMatrix.needsUpdate = true;
    if (mapMesh.instanceColor !== null)
      mapMesh.instanceColor.needsUpdate = true;
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
      element.hidden || scratchVector.z < -1 || scratchVector.z > 1
        ? 'none'
        : 'grid';
  };

  const placeMapSiteLabel = (
    anchor: { readonly x: number; readonly y: number },
    occupied: readonly { readonly x: number; readonly y: number }[],
    unitLabels: readonly { readonly x: number; readonly y: number }[],
    width: number,
    height: number,
  ): { x: number; y: number } => {
    const candidates = Array.from({ length: 81 }, (_, index) => {
      const dx = (index % 9) - 4;
      const dy = Math.floor(index / 9) - 4;
      return {
        x: THREE.MathUtils.clamp(anchor.x + dx * 18, 10, width - 10),
        y: THREE.MathUtils.clamp(anchor.y + dy * 18, 10, height - 10),
      };
    }).sort(
      (a, b) =>
        (a.x - anchor.x) ** 2 +
        (a.y - anchor.y) ** 2 -
        ((b.x - anchor.x) ** 2 + (b.y - anchor.y) ** 2),
    );
    return (
      candidates.find(
        (candidate) =>
          !occupied.some(
            (point) =>
              Math.abs(point.x - candidate.x) < 20 &&
              Math.abs(point.y - candidate.y) < 16,
          ) &&
          !unitLabels.some(
            (point) =>
              Math.abs(point.x - candidate.x) < 32 &&
              Math.abs(point.y - candidate.y) < 28,
          ),
      ) ?? candidates[0]!
    );
  };

  const facilityObjects = new Map<
    string,
    {
      marker: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      ring: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      label: HTMLDivElement;
    }
  >();
  const facilityGeometry = ownGeometry(
    new THREE.CylinderGeometry(0.25, 0.4, 0.5, 4),
  );
  const facilityRingGeometry = ownGeometry(new THREE.RingGeometry(0.98, 1, 64));
  const recentCombatShots = new Map<
    string,
    { targetId: string; tick: number }
  >();
  const syncFacilities = (view: FactionView): void => {
    // Defense in depth: even a malformed snapshot may not reveal enemy mines.
    const visible = view.facilities.filter(
      (facility) =>
        facility.kind !== 'mine' || facility.owner === view.viewerFactionId,
    );
    const present = new Set(visible.map((facility) => facility.id));
    for (const [id, objects] of facilityObjects) {
      if (present.has(id)) continue;
      scene.remove(objects.marker, objects.ring);
      for (const material of [objects.marker.material, objects.ring.material]) {
        material.dispose();
        resources.materials.delete(material);
      }
      objects.label.remove();
      facilityObjects.delete(id);
    }
    for (const facility of visible) {
      let objects = facilityObjects.get(facility.id);
      if (!objects) {
        const marker = new THREE.Mesh(
          facilityGeometry,
          ownMaterial(
            new THREE.MeshBasicMaterial({
              color: FACTIONS[facility.owner].color,
              transparent: true,
            }),
          ),
        );
        const ring = new THREE.Mesh(
          facilityRingGeometry,
          ownMaterial(
            new THREE.MeshBasicMaterial({
              color: FACTIONS[facility.owner].color,
              transparent: true,
              opacity: 0.65,
              side: THREE.DoubleSide,
            }),
          ),
        );
        ring.rotation.x = -Math.PI / 2;
        const label = document.createElement('div');
        label.className = 'rts-facility-label';
        label.dataset.facilityId = facility.id;
        labelLayer.append(label);
        marker.renderOrder = 3;
        ring.renderOrder = 2;
        objects = { marker, ring, label };
        facilityObjects.set(facility.id, objects);
        scene.add(marker, ring);
      }
      const remembered = facility.visibility === 'remembered';
      const building = facility.remainingBuildTicks > 0;
      objects.marker.position.copy(cellPosition(facility.cell, 0.3));
      objects.marker.scale.set(
        1,
        facility.kind === 'watchtower' || facility.kind === 'jammer'
          ? 2
          : facility.kind === 'mine'
            ? 0.15
            : 1,
        1,
      );
      objects.marker.material.color.setHex(FACTIONS[facility.owner].color);
      objects.marker.material.opacity = remembered ? 0.35 : building ? 0.55 : 1;
      const radius =
        facility.kind === 'jammer'
          ? view.rules.facilities.definitions.jammer.jamRange
          : facility.kind === 'mine'
            ? view.rules.facilities.definitions.mine.range
            : 0;
      objects.ring.visible = !remembered && !building && radius > 0;
      objects.ring.position.copy(cellPosition(facility.cell, 0.08));
      objects.ring.scale.setScalar(radius);
      objects.label.textContent = `${FACTIONS[facility.owner].symbol}${FACILITY_GLYPHS[facility.kind]} ${FACILITY_NAMES[facility.kind]} ${facility.hp}/${facility.maxHp}${remembered ? ` 最終T${facility.seenTick}` : building ? ` 建築${(facility.remainingBuildTicks / 10).toFixed(1)}秒` : ''}`;
      if (!remembered) {
        const combatMark =
          facility.attack?.phase === 'windup'
            ? ' ⚔準備'
            : facility.attack?.phase === 'cooldown'
              ? ' ↻待ち'
              : '';
        const underFire =
          facility.lastDamagedTick > 0 &&
          view.tick - facility.lastDamagedTick <= 2;
        objects.label.dataset.combat = facility.attack?.phase ?? '';
        objects.label.dataset.underFire = String(underFire);
        objects.label.textContent += `${combatMark}${underFire ? ' ✦被弾' : ''}`;
      }
      objects.label.title = objects.label.textContent;
      updateLabelPosition(objects.label, cellPosition(facility.cell, 0.8), -2);
    }
  };

  const combatSources = (
    view: FactionView,
  ): {
    key: string;
    targetId?: string;
    lastFiredTargetId?: string;
    lastFiredTick?: number;
    phase: string;
  }[] => [
    ...view.ownUnits.map((unit) => ({
      key: `unit:${unit.id}`,
      phase: unit.attack?.phase ?? 'idle',
      ...((unit.attack?.targetId ?? unit.attack?.lastFiredTargetId)
        ? { targetId: unit.attack.targetId ?? unit.attack.lastFiredTargetId! }
        : {}),
      ...(unit.attack?.lastFiredTargetId
        ? { lastFiredTargetId: unit.attack.lastFiredTargetId }
        : {}),
      ...(unit.attack?.lastFiredTick !== undefined
        ? { lastFiredTick: unit.attack.lastFiredTick }
        : {}),
    })),
    ...view.visibleEnemies.map((unit) => ({
      key: `unit:${unit.id}`,
      phase: unit.combat?.phase ?? 'idle',
      ...(unit.combat?.targetId ? { targetId: unit.combat.targetId } : {}),
      ...(unit.combat?.lastFiredTick !== undefined
        ? { lastFiredTick: unit.combat.lastFiredTick }
        : {}),
    })),
    ...view.bases
      .filter(
        (base) => base.visibility === 'visible' || base.visibility === 'owned',
      )
      .flatMap((base) => [
        { key: `base:${base.id}:turret`, ...base.turretCombat },
        { key: `base:${base.id}:defender`, ...base.defenderCombat },
      ])
      .map((source) => ({
        key: source.key,
        phase: source.phase ?? 'idle',
        ...(source.targetId ? { targetId: source.targetId } : {}),
      })),
    ...view.facilities
      .filter(
        (facility) =>
          facility.visibility === 'visible' || facility.visibility === 'owned',
      )
      .map((facility) => ({
        key: `facility:${facility.id}`,
        phase: facility.attack?.phase ?? 'idle',
        ...(facility.attack?.targetId
          ? { targetId: facility.attack.targetId }
          : {}),
      })),
  ];

  const syncCombatLinks = (
    previous: FactionView,
    current: FactionView,
  ): void => {
    const previousSources = new Map(
      combatSources(previous).map((source) => [source.key, source]),
    );
    const sources = combatSources(current);
    const visibleIds = new Set<string>();
    const bounds = labelLayer.getBoundingClientRect();
    const positions = new Map<string, { x: number; y: number }>();
    const labelCenter = (label: HTMLElement): { x: number; y: number } => {
      const rect = label.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - bounds.left,
        y: rect.top + rect.height / 2 - bounds.top,
      };
    };
    for (const unit of [...current.ownUnits, ...current.visibleEnemies]) {
      const objects = unitObjects.get(unit.id);
      if (!objects) continue;
      visibleIds.add(unit.id);
      positions.set(unit.id, labelCenter(objects.label));
    }
    for (const base of current.bases) {
      if (base.visibility !== 'visible' && base.visibility !== 'owned')
        continue;
      const objects = baseObjects.get(base.id);
      if (!objects) continue;
      visibleIds.add(base.id);
      positions.set(base.id, labelCenter(objects.label));
    }
    for (const facility of current.facilities) {
      if (facility.visibility !== 'visible' && facility.visibility !== 'owned')
        continue;
      const objects = facilityObjects.get(facility.id);
      if (!objects) continue;
      visibleIds.add(facility.id);
      positions.set(facility.id, labelCenter(objects.label));
    }
    for (const source of sources) {
      const old = previousSources.get(source.key);
      const targetId =
        source.targetId ?? source.lastFiredTargetId ?? old?.targetId;
      if (
        old &&
        source.lastFiredTick !== undefined &&
        source.lastFiredTick !== old.lastFiredTick &&
        targetId &&
        visibleIds.has(targetId)
      )
        recentCombatShots.set(source.key, {
          targetId,
          tick: current.tick,
        });
    }
    for (const [key, shot] of recentCombatShots)
      if (current.tick - shot.tick > 12 || !visibleIds.has(shot.targetId))
        recentCombatShots.delete(key);

    combatSvg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const lines: SVGLineElement[] = [];
    const appendLine = (sourceId: string, targetId: string, fired: boolean) => {
      const sourcePosition = positions.get(sourceId);
      const targetPosition = positions.get(targetId);
      if (!sourcePosition || !targetPosition) return;
      const dx = targetPosition.x - sourcePosition.x;
      const dy = targetPosition.y - sourcePosition.y;
      const length = Math.hypot(dx, dy);
      const inset = Math.min(23, Math.max(0, length / 2 - 1));
      const line = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line',
      );
      line.setAttribute('x1', String(sourcePosition.x + (dx / length) * inset));
      line.setAttribute('y1', String(sourcePosition.y + (dy / length) * inset));
      line.setAttribute('x2', String(targetPosition.x - (dx / length) * inset));
      line.setAttribute('y2', String(targetPosition.y - (dy / length) * inset));
      line.classList.add(fired ? 'rts-combat-shot' : 'rts-combat-target');
      lines.push(line);
    };
    for (const source of sources) {
      if (
        (source.phase === 'windup' || source.phase === 'cooldown') &&
        source.targetId &&
        visibleIds.has(source.targetId)
      ) {
        const id = source.key.startsWith('unit:')
          ? source.key.slice('unit:'.length)
          : source.key.startsWith('facility:')
            ? source.key.slice('facility:'.length)
            : source.key.slice('base:'.length).split(':')[0]!;
        appendLine(id, source.targetId, false);
      }
    }
    for (const [key, shot] of recentCombatShots) {
      const id = key.startsWith('unit:')
        ? key.slice('unit:'.length)
        : key.startsWith('facility:')
          ? key.slice('facility:'.length)
          : key.slice('base:'.length).split(':')[0]!;
      appendLine(id, shot.targetId, true);
    }
    combatSvg.replaceChildren(...lines);
    labelLayer.append(combatSvg);
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
      const ownerColor = owner === null ? 0x8c9296 : FACTIONS[owner].color;
      objects.marker.material.color.setHex(ownerColor);
      objects.marker.material.transparent = true;
      objects.marker.material.opacity =
        base.visibility === 'remembered'
          ? 0.5
          : base.visibility === 'unknown'
            ? 0.3
            : 1;
      objects.marker.position.copy(cellPosition(base.cell, 0.15));
      objects.marker.scale.setScalar(
        base.kind === 'hq'
          ? 1.5
          : base.kind === 'large'
            ? 1.3
            : base.kind === 'medium'
              ? 1.1
              : 0.9,
      );
      objects.label.textContent = baseLabel(
        base,
        view.rules.capture.requiredTicks,
      );
      if (base.visibility === 'visible' || base.visibility === 'owned') {
        const combatMark =
          base.turretCombat?.phase === 'windup' ||
          base.defenderCombat?.phase === 'windup'
            ? ' ⚔準備'
            : base.turretCombat?.phase === 'cooldown' ||
                base.defenderCombat?.phase === 'cooldown'
              ? ' ↻待ち'
              : '';
        const underFire =
          base.lastDamagedTick !== undefined &&
          base.lastDamagedTick > 0 &&
          view.tick - base.lastDamagedTick <= 2;
        objects.label.dataset.combat =
          base.turretCombat?.phase === 'windup' ||
          base.defenderCombat?.phase === 'windup'
            ? 'windup'
            : base.turretCombat?.phase === 'cooldown' ||
                base.defenderCombat?.phase === 'cooldown'
              ? 'cooldown'
              : '';
        objects.label.dataset.underFire = String(underFire);
        objects.label.textContent += `${combatMark}${underFire ? ' ✦被弾' : ''}`;
      }
      objects.label.style.borderColor = `#${ownerColor.toString(16).padStart(6, '0')}`;
      objects.label.style.color = owner === 'local' ? '#4d5a61' : '#20252b';
      objects.label.dataset.visibility = base.visibility;
      objects.label.style.borderStyle =
        base.visibility === 'remembered' ? 'dashed' : 'solid';
      objects.label.hidden = base.visibility === 'unknown';
      objects.label.setAttribute(
        'aria-hidden',
        String(base.visibility === 'unknown'),
      );
      objects.label.setAttribute(
        'aria-label',
        `${baseLabel(base, view.rules.capture.requiredTicks)}（拠点の種類と位置は公開）`,
      );
      updateLabelPosition(objects.label, cellPosition(base.cell, 0.3), -18);
    }
  };
  const fogCanvas = document.createElement('canvas');
  // WebGL allocates immutable texture storage on the first render. A canvas
  // defaults to 300x150; resizing it later does not resize that GPU allocation.
  fogCanvas.width = BOARD_SIZE;
  fogCanvas.height = BOARD_SIZE;
  const fogContext = fogCanvas.getContext('2d', { willReadFrequently: true });
  if (!fogContext)
    throw new Error('2D canvas is unavailable for visibility overlay');
  const createFogTexture = (): THREE.CanvasTexture => {
    const texture = new THREE.CanvasTexture(fogCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  };
  let fogTexture = createFogTexture();
  const fogGeometry = ownGeometry(
    new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE),
  );
  fogGeometry.rotateX(-Math.PI / 2);
  const fogMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      map: fogTexture,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const fogMesh = new THREE.Mesh(fogGeometry, fogMaterial);
  fogMesh.name = 'visibility-fog';
  fogMesh.renderOrder = 1;
  fogMesh.frustumCulled = false;
  scene.add(fogMesh);
  let fogSignature = '';
  let fogView: FactionView | null = null;
  const syncFog = (view: FactionView): void => {
    if (view === fogView) return;
    fogView = view;
    const signature =
      `${view.map.width}x${view.map.height}:` +
      view.visible
        .map((visible, index) =>
          visible ? '2' : view.explored[index] ? '1' : '0',
        )
        .join('');
    if (signature === fogSignature) return;
    fogSignature = signature;
    if (
      fogCanvas.width !== view.map.width ||
      fogCanvas.height !== view.map.height
    ) {
      fogTexture.dispose();
      fogCanvas.width = view.map.width;
      fogCanvas.height = view.map.height;
      fogTexture = createFogTexture();
      fogMaterial.map = fogTexture;
    }
    const image = fogContext.createImageData(view.map.width, view.map.height);
    for (let index = 0; index < view.visible.length; index += 1) {
      const pixel = index * 4;
      if (view.visible[index]) {
        image.data[pixel + 3] = 0;
      } else if (view.explored[index]) {
        image.data[pixel] = 140;
        image.data[pixel + 1] = 153;
        image.data[pixel + 2] = 162;
        image.data[pixel + 3] = 62;
      } else {
        image.data[pixel] = 23;
        image.data[pixel + 1] = 35;
        image.data[pixel + 2] = 45;
        image.data[pixel + 3] = 166;
      }
    }
    fogContext.putImageData(image, 0, 0);
    fogTexture.needsUpdate = true;
    fogMesh.scale.set(
      view.map.width / BOARD_SIZE,
      1,
      view.map.height / BOARD_SIZE,
    );
    fogMesh.position.set(
      view.map.width / 2,
      FOG_SURFACE_Y,
      view.map.height / 2,
    );
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
    const memoryIds = new Set(
      current.airDefenseMemory.map(({ unitId }) => unitId),
    );
    for (const [unitId, ring] of airDefenseRings) {
      if (memoryIds.has(unitId)) continue;
      scene.remove(ring);
      ring.geometry.dispose();
      ring.material.dispose();
      resources.geometries.delete(ring.geometry);
      resources.materials.delete(ring.material);
      airDefenseRings.delete(unitId);
    }
    for (const memory of current.airDefenseMemory) {
      let ring = airDefenseRings.get(memory.unitId);
      if (!ring) {
        const points = Array.from({ length: 64 }, (_, index) => {
          const angle = (index / 64) * Math.PI * 2;
          return new THREE.Vector3(Math.cos(angle), 0.09, Math.sin(angle));
        });
        const geometry = ownGeometry(
          new THREE.BufferGeometry().setFromPoints(points),
        );
        const material = ownMaterial(
          new THREE.LineBasicMaterial({
            color: 0xf28e45,
            transparent: true,
            opacity: 0.82,
          }),
        );
        ring = new THREE.LineLoop(geometry, material);
        ring.name = `remembered-air-defense-${memory.unitId}`;
        ring.renderOrder = 4;
        ring.frustumCulled = false;
        scene.add(ring);
        airDefenseRings.set(memory.unitId, ring);
      }
      ring.position.set(memory.cell.x + 0.5, 0, memory.cell.y + 0.5);
      ring.scale.set(memory.range, 1, memory.range);
    }
    const frames = getUnitFrames(previous, current, lastAlpha);
    const visibleTargetIds = new Set([
      ...current.ownUnits.map(({ id }) => id),
      ...current.visibleEnemies.map(({ id }) => id),
      ...current.bases
        .filter(
          ({ visibility }) =>
            visibility === 'visible' || visibility === 'owned',
        )
        .map(({ id }) => id),
      ...current.facilities
        .filter(
          ({ visibility }) =>
            visibility === 'visible' || visibility === 'owned',
        )
        .map(({ id }) => id),
    ]);
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
    const occupiedMapSiteLabels: { x: number; y: number }[] = [];
    for (const { unit, x, z } of frames) {
      const objects = unitObjects.get(unit.id) ?? createUnitObjects(unit);
      const currentPosition = new THREE.Vector3(x, 0.17, z);
      const path = unit.control === 'own' ? unit.path : [];
      const march = unit.control === 'own' ? unit.marchOrder : null;
      const localUnit = unit.factionId === 'local';
      const jammed = unit.control === 'own' && unit.jammed;
      const combat = unit.control === 'own' ? unit.attack : unit.combat;
      const targetCandidate =
        combat?.targetId ??
        (unit.control === 'own' ? unit.attack?.lastFiredTargetId : undefined);
      const visibleTargetId =
        targetCandidate && visibleTargetIds.has(targetCandidate)
          ? targetCandidate
          : null;
      const pointFireFlight =
        unit.control === 'own'
          ? current.ownFaction.pendingStrikes.find(
              ({ sourceUnitId }) => sourceUnitId === unit.id,
            )
          : undefined;
      const bombardMark =
        unit.control === 'own' && unit.bombardOrder
          ? '◎'
          : pointFireFlight
            ? '➤'
            : '';
      const underFire =
        unit.lastDamagedTick !== undefined &&
        unit.lastDamagedTick > 0 &&
        current.tick - unit.lastDamagedTick <= 2;
      const combatMark =
        combat?.phase === 'windup'
          ? '⚔'
          : combat?.phase === 'cooldown'
            ? '⚔'
            : '';
      const glyph = (
        {
          assault: '強',
          scout: '偵',
          artillery: '砲',
          antiAir: '空',
          helicopter: 'ヘ',
          patrolBoat: '艇',
        } as const
      )[unit.kind];
      objects.glyph.textContent = `${FACTIONS[unit.factionId].symbol}${localUnit ? '現' : ''}${glyph}${combatMark}${bombardMark}${underFire ? '✦' : ''}${march ? '→' : ''}${jammed ? '⚠妨' : ''}\n${unit.hp}/${unit.maxHp}`;
      objects.label.dataset.combat = combatMark ? String(combat?.phase) : '';
      objects.label.dataset.underFire = String(underFire);
      objects.label.title = `${localUnit ? '現地勢力 ' : ''}${unit.id} ${unit.kind} HP ${unit.hp}/${unit.maxHp}${combatMark ? ` · ${combat?.phase === 'windup' ? '攻撃準備' : '攻撃後の周期待ち'}${visibleTargetId ? ` → ${visibleTargetId}` : ''}` : ''}${unit.control === 'own' && unit.bombardOrder ? ` · 地点砲撃準備 ${unit.bombardOrder.cell.x},${unit.bombardOrder.cell.y}` : pointFireFlight ? ` · 地点砲撃飛翔 ${pointFireFlight.cell.x},${pointFireFlight.cell.y}` : ''}${underFire ? ' · 被弾' : ''}${march ? ` → ${march.target.id}` : ''}`;
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
    syncFacilities(current);
    syncCombatLinks(previous, current);
    const visibleCombatEntityIds = new Set([
      ...current.ownUnits.map(({ id }) => id),
      ...current.visibleEnemies.map(({ id }) => id),
      ...current.bases
        .filter(
          (base) =>
            base.visibility === 'visible' || base.visibility === 'owned',
        )
        .map(({ id }) => id),
      ...current.facilities
        .filter(
          (facility) =>
            facility.visibility === 'visible' ||
            facility.visibility === 'owned',
        )
        .map(({ id }) => id),
    ]);
    const targetedVisibleIds = new Set(
      combatSources(current)
        .map(({ targetId }) => targetId)
        .filter(
          (id): id is string =>
            id !== undefined && visibleCombatEntityIds.has(id),
        ),
    );
    for (const [id, objects] of unitObjects)
      objects.label.dataset.targeted = String(targetedVisibleIds.has(id));
    for (const [id, objects] of baseObjects)
      objects.label.dataset.targeted = String(targetedVisibleIds.has(id));
    for (const [id, objects] of facilityObjects)
      objects.label.dataset.targeted = String(targetedVisibleIds.has(id));
    for (const entry of mapSiteLabels) {
      if (entry.crossingId) {
        const crossing = current.crossings.find(
          ({ site }) => site.id === entry.crossingId,
        );
        if (crossing && crossing.visibility !== 'unknown') {
          const kindName = crossing.site.tier.startsWith('bridge')
            ? `橋${crossing.site.tier.slice(-1)}`
            : `索道${crossing.site.tier.slice(-1)}`;
          const siteNumber =
            (current.map.crossingSites ?? []).findIndex(
              ({ id }) => id === entry.crossingId,
            ) + 1;
          const endpoint = entry.crossingEndpoint ?? 'A';
          if (crossing.visibility === 'remembered') {
            entry.label.textContent = `${siteNumber}${endpoint}`;
            entry.label.title = `${kindName} ${crossing.site.id} ${endpoint}端 · 最終観測 T${crossing.seenTick}`;
          } else if (crossing.owner === null) {
            entry.label.textContent = `${siteNumber}${endpoint}`;
            entry.label.title =
              crossing.job?.kind === 'build'
                ? `${kindName} ${crossing.site.id} ${endpoint}端 · ${crossing.job.factionId}建設中`
                : `${kindName} ${crossing.site.id} ${endpoint}端 · 未建設`;
          } else {
            entry.label.textContent = `${siteNumber}${endpoint}`;
            entry.label.title = `${kindName} ${crossing.site.id} ${endpoint}端 · ${crossing.owner} HP${crossing.hp}`;
          }
        } else {
          const site = current.map.crossingSites?.find(
            ({ id }) => id === entry.crossingId,
          );
          if (site) {
            const siteNumber =
              (current.map.crossingSites ?? []).findIndex(
                ({ id }) => id === entry.crossingId,
              ) + 1;
            entry.label.title = `${site.tier.startsWith('bridge') ? '橋' : '索道'}${site.tier.slice(-1)} ${site.id} ${entry.crossingEndpoint ?? 'A'}端 · 公開予定地`;
            entry.label.textContent = `${siteNumber}${entry.crossingEndpoint ?? 'A'}`;
          }
        }
      }
      updateLabelPosition(entry.label, cellPosition(entry.cell, 0.05), -3);
      const bounds = canvas.getBoundingClientRect();
      const labelPosition = placeMapSiteLabel(
        {
          x: parseFloat(entry.label.style.left),
          y: parseFloat(entry.label.style.top),
        },
        occupiedMapSiteLabels,
        occupiedLabels,
        bounds.width,
        bounds.height,
      );
      entry.label.style.left = `${labelPosition.x}px`;
      entry.label.style.top = `${labelPosition.y}px`;
      occupiedMapSiteLabels.push(labelPosition);
    }
    syncFog(current);
    refreshMovePreview();
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
      if (x < 0 || y < 0 || x >= boardWidth || y >= boardHeight) return null;
      return { kind: 'ground', cell: { x, y } };
    },
    pickGround(clientX, clientY) {
      if (disposed || contextLost) return null;
      const point = groundPointAt(clientX, clientY);
      if (point === null) return null;
      const x = Math.floor(point.x);
      const y = Math.floor(point.z);
      if (x < 0 || y < 0 || x >= boardWidth || y >= boardHeight) return null;
      return { x, y };
    },
    setMovePreview(unitId, target, path) {
      setGroupMovePreview([{ unitId, path }], target);
    },
    setGroupMovePreview,
    clearMovePreview,
    focusCell(cell) {
      cameraTarget.set(
        THREE.MathUtils.clamp(cell.x + 0.5, 0, boardWidth),
        0,
        THREE.MathUtils.clamp(cell.y + 0.5, 0, boardHeight),
      );
      resize();
    },
    pan(from, to) {
      const fromGround = groundPointAt(from.x, from.y);
      const toGround = groundPointAt(to.x, to.y);
      if (fromGround === null || toGround === null) return;
      cameraTarget.x = THREE.MathUtils.clamp(
        cameraTarget.x + fromGround.x - toGround.x,
        0,
        boardWidth,
      );
      cameraTarget.z = THREE.MathUtils.clamp(
        cameraTarget.z + fromGround.z - toGround.z,
        0,
        boardHeight,
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
      cameraTarget.set(boardWidth / 2, 0, boardHeight / 2);
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
      fogTexture.dispose();
      for (const geometry of resources.geometries) geometry.dispose();
      for (const material of resources.materials) material.dispose();
      scene.clear();
    },
  };
}
