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
import {
  cameraDistanceBounds,
  CAMERA_FOV_DEGREES,
  cameraPosition,
  groundFootprint,
  type GroundPoint,
} from './camera-rig';
import { createHazePass } from './haze';
import { createTerrain, WATER_Y, type TerrainView } from './terrain';
import {
  createBossModel,
  createCrossingModel,
  createGuardModel,
  createRaiderModel,
  createStructureModel,
  createUnitModel,
  STRUCTURE_RADIUS,
  structureVariant,
  type AssetModel,
} from './models';
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
  /** Client coordinates of a cell centre, or null when it is off screen. */
  projectCell(cell: Cell): { x: number; y: number } | null;
  /** Ground quadrilateral currently in view (for the minimap). */
  viewFootprint(): readonly GroundPoint[] | null;
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
  A: { color: 0xff6a1a, symbol: '◆', marker: 'diamond' },
  B: { color: 0x10bfe8, symbol: '■', marker: 'square' },
  C: { color: 0xf0b323, symbol: '⬡', marker: 'hexagon' },
  local: { color: 0x6b7a5e, symbol: '●', marker: 'circle' },
} as const;
const BOARD_SIZE = 100;
const MAX_ROUTE_CELLS = BOARD_SIZE * BOARD_SIZE;
/** Structure footprint radius in cells (the capture zone is the 3x3 around it). */
const STRUCTURE_FOOTPRINT: Readonly<Record<string, number>> = {
  hq: 2.0,
  large: 2.4,
  medium: 1.8,
  outpost: 1.55,
};
const UNIT_LIFT = 0.02;
/** Extra lift for helicopters on top of the asset's own 20-unit hover. */
const HELI_ALTITUDE = 0.8;
const UNIT_GLYPHS = {
  assault: '強',
  scout: '偵',
  artillery: '砲',
  antiAir: '空',
  helicopter: 'ヘ',
  patrolBoat: '艇',
} as const;

interface UnitObjects {
  /** Invisible pick proxy; the visible body is `model.group`. */
  readonly marker: THREE.Mesh;
  model: AssetModel;
  modelKey: string;
  heading: number;
  lastX: number;
  lastZ: number;
  lastFiredTick: number | undefined;
  readonly route: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  readonly destination: THREE.Mesh;
  readonly selection: THREE.Mesh;
  readonly label: HTMLDivElement;
  readonly glyph: HTMLSpanElement;
}

type AnyUnitView = OwnUnitView | VisibleEnemyUnitView;
const unitModelKey = (unit: AnyUnitView): string =>
  unit.factionId === 'local' ? 'raider' : unit.kind;
function createUnitAsset(unit: AnyUnitView): AssetModel {
  const model =
    unit.factionId === 'local'
      ? createRaiderModel(1)
      : createUnitModel(unit.kind);
  model.setTeam(FACTIONS[unit.factionId].color);
  return model;
}
function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (Array.isArray(material)) for (const entry of material) entry.dispose();
    else material?.dispose();
  });
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
      projectCell: () => null,
      viewFootprint: () => null,
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
  scene.background = new THREE.Color(0xe6eaee);
  // Lighting from the 3D asset viewer: white hemisphere + one sun, no shadows.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c2cc, 1.6));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(-30, 60, 20);
  scene.add(keyLight);
  // Software WebGL (CI, no GPU) gets a cheaper haze and a capped frame rate so
  // input and DOM updates are not starved by rendering.
  const debugInfo = renderer
    .getContext()
    .getExtension('WEBGL_debug_renderer_info');
  const softwareRenderer =
    debugInfo !== null &&
    /swiftshader|llvmpipe|software|basic render/i.test(
      String(
        renderer.getContext().getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
      ),
    );
  const haze = createHazePass(softwareRenderer ? 'low' : 'high');
  const minFrameMs = softwareRenderer ? 120 : 0;

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

  let boardWidth = BOARD_SIZE;
  let boardHeight = BOARD_SIZE;
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, 1, 0.5, 400);
  const cameraTarget = new THREE.Vector3(boardWidth / 2, 0, boardHeight / 2);
  let aspect = 1;
  let distanceBounds = cameraDistanceBounds(boardWidth, boardHeight, aspect);
  /** null = use the default distance for the current viewport. */
  let cameraDistance: number | null = null;
  const currentDistance = (): number =>
    THREE.MathUtils.clamp(
      cameraDistance ?? distanceBounds.initial,
      distanceBounds.min,
      distanceBounds.max,
    );
  const resizeCamera = (width: number, height: number): void => {
    aspect = width / height;
    distanceBounds = cameraDistanceBounds(boardWidth, boardHeight, aspect);
    cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, 0, boardWidth);
    cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, 0, boardHeight);
    const position = cameraPosition(
      { x: cameraTarget.x, z: cameraTarget.z },
      currentDistance(),
    );
    camera.aspect = aspect;
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
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

  // Pick proxies stay invisible: hits come from a simple cylinder per unit
  // rather than the detailed asset meshes.
  const proxyGeometry = ownGeometry(
    new THREE.CylinderGeometry(0.62, 0.62, 1.2, 10),
  );
  proxyGeometry.translate(0, 0.6, 0);
  const proxyMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  const routeMaterial = new Map<CombatantId, THREE.LineBasicMaterial>();
  for (const faction of Object.keys(FACTIONS) as CombatantId[]) {
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

  const ringGeometry = ownGeometry(new THREE.TorusGeometry(0.72, 0.045, 8, 48));
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
    const marker = new THREE.Mesh(proxyGeometry, proxyMaterial);
    marker.name = unit.id;
    marker.userData.unitId = unit.id;
    scene.add(marker);
    unitRaycastTargets.push(marker);
    const modelKey = unitModelKey(unit);
    const model = createUnitAsset(unit);
    scene.add(model.group);

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
    const teamHex = `#${FACTIONS[faction].color.toString(16).padStart(6, '0')}`;
    Object.assign(label.style, {
      position: 'absolute',
      minWidth: '30px',
      height: '18px',
      display: 'grid',
      placeItems: 'center',
      boxSizing: 'border-box',
      padding: '0 4px',
      borderLeft: `3px solid ${teamHex}`,
      color: '#0e161e',
      background: 'rgba(255,255,255,0.92)',
      boxShadow: '0 4px 10px -6px rgba(14,22,30,0.6)',
      font: '700 9px/1 system-ui, sans-serif',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    });
    const glyph = document.createElement('span');
    glyph.textContent = FACTIONS[faction].symbol;
    glyph.style.whiteSpace = 'nowrap';
    glyph.style.font = '700 9px/1 system-ui,sans-serif';
    glyph.setAttribute('aria-hidden', 'true');
    label.append(glyph);
    labelLayer.append(label);
    const objects: UnitObjects = {
      marker,
      model,
      modelKey,
      heading: Math.PI,
      lastX: Number.NaN,
      lastZ: Number.NaN,
      lastFiredTick: undefined,
      route,
      destination,
      selection,
      label,
      glyph,
    };
    for (const object of [route, selection, destination])
      object.renderOrder = 3;
    unitObjects.set(unit.id, objects);
    return objects;
  };

  let terrain: TerrainView | null = null;
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
    canvas.setAttribute('aria-label', `${boardWidth}×${boardHeight}の盤面`);
    if (terrain !== null) {
      scene.remove(terrain.group);
      terrain.dispose();
    }
    terrain = createTerrain(map);
    scene.add(terrain.group);
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
    resize();
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

  let lastFrameTime = performance.now();
  const renderFrame = (force = true): void => {
    if (contextLost || disposed) return;
    const now = performance.now();
    if (!force && now - lastFrameTime < minFrameMs) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000));
    lastFrameTime = now;
    terrain?.update(dt);
    for (const objects of unitObjects.values()) objects.model.update(dt);
    for (const objects of baseObjects.values()) {
      objects.model.update(dt);
      objects.guard?.model.update(dt);
    }
    for (const objects of crossingObjects.values()) objects.model.update(dt);
    haze.render(renderer, scene, camera, dt);
  };
  const resize = (): void => {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const pixelRatio = softwareRenderer
      ? 1
      : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    haze.setSize(width, height, pixelRatio);
    resizeCamera(width, height);
    renderFrame();
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
        ...(source.lastFiredTick !== undefined
          ? { lastFiredTick: source.lastFiredTick }
          : {}),
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
        ...(facility.attack?.lastFiredTick !== undefined
          ? { lastFiredTick: facility.attack.lastFiredTick }
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
      model: AssetModel;
      guard: { model: AssetModel; key: string } | null;
      state: string;
    }
  >();
  const baseGeometry = ownGeometry(new THREE.CylinderGeometry(1, 1, 1.4, 12));
  baseGeometry.translate(0, 0.7, 0);
  const nearWater = (map: GridMap, cell: Cell): boolean => {
    for (let dy = -3; dy <= 3; dy += 1)
      for (let dx = -3; dx <= 3; dx += 1) {
        const x = cell.x + dx;
        const y = cell.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (map.terrain?.[y * map.width + x] === 'river') return true;
      }
    return false;
  };
  /** Neutral defenders: guard emplacements (S/M) or the large base's boss. */
  const syncGuard = (
    objects: {
      guard: { model: AssetModel; key: string } | null;
    },
    base: FactionView['bases'][number],
  ): void => {
    const seen =
      base.visibility === 'visible' || base.visibility === 'remembered';
    const alive =
      seen &&
      base.owner === null &&
      base.kind !== 'hq' &&
      (base.defenderMaxHp ?? 0) > 0 &&
      (base.defenderHp ?? 0) > 0;
    const key =
      base.kind === 'large' ? 'boss' : base.kind === 'medium' ? 'M' : 'S';
    if (!alive || objects.guard?.key !== key) {
      if (objects.guard) {
        scene.remove(objects.guard.model.group);
        disposeObject(objects.guard.model.group);
        objects.guard = null;
      }
      if (!alive) return;
      const model =
        key === 'boss'
          ? createBossModel()
          : createGuardModel(key === 'M' ? 'M' : 'S');
      const offset = (STRUCTURE_FOOTPRINT[base.kind] ?? 1.6) + 0.7;
      model.group.position
        .copy(cellPosition(base.cell, 0))
        .add(new THREE.Vector3(offset * 0.7, 0, offset * 0.7));
      model.group.rotation.y = Math.PI * 0.75;
      scene.add(model.group);
      objects.guard = { model, key };
    }
    const engaged =
      base.visibility === 'visible' &&
      (base.defenderCombat?.phase === 'windup' ||
        base.defenderCombat?.phase === 'cooldown');
    objects.guard.model.setState?.(
      engaged
        ? 'engaged'
        : key === 'boss' &&
            (base.defenderHp ?? 0) < (base.defenderMaxHp ?? 0) * 0.5
          ? 'damaged'
          : 'idle',
    );
  };
  const syncBases = (view: FactionView): void => {
    const ids = new Set(view.bases.map((base) => base.id));
    for (const [id, objects] of baseObjects) {
      if (ids.has(id)) continue;
      scene.remove(objects.marker, objects.model.group);
      disposeObject(objects.model.group);
      if (objects.guard) {
        scene.remove(objects.guard.model.group);
        disposeObject(objects.guard.model.group);
      }
      objects.label.remove();
      baseObjects.delete(id);
    }
    for (const [index, base] of view.bases.entries()) {
      let objects = baseObjects.get(base.id);
      if (objects === undefined) {
        const marker = new THREE.Mesh(baseGeometry, proxyMaterial);
        marker.userData.baseId = base.id;
        const variant = structureVariant(
          base.kind,
          index,
          base.kind === 'outpost' && nearWater(view.map, base.cell),
        );
        const model = createStructureModel(variant);
        const footprint = STRUCTURE_FOOTPRINT[base.kind] ?? 1.6;
        model.group.scale.setScalar(footprint / STRUCTURE_RADIUS[variant]);
        model.group.position.copy(cellPosition(base.cell, 0));
        marker.scale.set(footprint * 0.8, 1, footprint * 0.8);
        scene.add(model.group);
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
        objects = { marker, label, model, guard: null, state: '' };
        baseObjects.set(base.id, objects);
      }
      const owner = base.visibility === 'unknown' ? null : base.owner;
      const ownerColor = owner === null ? 0x8c9296 : FACTIONS[owner].color;
      objects.model.setTeam(owner === null ? null : ownerColor);
      const active =
        (base.visibility === 'visible' || base.visibility === 'owned') &&
        base.hp > 0;
      const state =
        base.kind === 'large'
          ? active && owner !== null
            ? 'opening'
            : 'closing'
          : active
            ? 'run'
            : 'stop';
      if (state !== objects.state) {
        objects.model.setState?.(state);
        objects.state = state;
      }
      objects.marker.position.copy(cellPosition(base.cell, 0));
      syncGuard(objects, base);
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
      updateLabelPosition(
        objects.label,
        cellPosition(base.cell, 1.4),
        -(STRUCTURE_FOOTPRINT[base.kind] ?? 1.6) * 6,
      );
    }
  };
  const crossingObjects = new Map<
    string,
    { model: AssetModel; key: string; state: string }
  >();
  /** Bridges and ropeways the viewer knows about (built, being built or remembered). */
  const syncCrossings = (view: FactionView): void => {
    const present = new Set<string>();
    for (const crossing of view.crossings) {
      if (crossing.visibility === 'unknown') continue;
      const building = crossing.job?.kind === 'build';
      if (crossing.owner === null && !building) continue;
      const { site } = crossing;
      present.add(site.id);
      const ax = site.bankA.x + 0.5;
      const az = site.bankA.y + 0.5;
      const bx = site.bankB.x + 0.5;
      const bz = site.bankB.y + 0.5;
      const length = Math.hypot(bx - ax, bz - az) + 1;
      const key = `${site.tier}:${length.toFixed(2)}`;
      let objects = crossingObjects.get(site.id);
      if (!objects || objects.key !== key) {
        if (objects) {
          scene.remove(objects.model.group);
          disposeObject(objects.model.group);
        }
        const bridge = site.tier.startsWith('bridge');
        const scale = bridge ? 1 / 80 : length / 560;
        const model = createCrossingModel(
          site.tier,
          bridge ? length / scale : 520,
        );
        model.group.scale.setScalar(scale);
        model.group.position.set(
          (ax + bx) / 2,
          bridge ? -0.3 : 0,
          (az + bz) / 2,
        );
        model.group.rotation.y = -Math.atan2(bz - az, bx - ax);
        scene.add(model.group);
        objects = { model, key, state: '' };
        crossingObjects.set(site.id, objects);
      }
      objects.model.setTeam(
        crossing.owner === null ? null : FACTIONS[crossing.owner].color,
      );
      const state =
        crossing.owner === null
          ? 'building'
          : crossing.hp <= 0
            ? 'destroyed'
            : 'built';
      if (state !== objects.state) {
        objects.model.setState?.(state);
        objects.state = state;
      }
    }
    for (const [id, objects] of crossingObjects) {
      if (present.has(id)) continue;
      scene.remove(objects.model.group);
      disposeObject(objects.model.group);
      crossingObjects.delete(id);
    }
  };

  const entityPosition = (
    view: FactionView,
    id: string,
  ): { x: number; z: number } | null => {
    const own = view.ownUnits.find((unit) => unit.id === id);
    if (own) return { x: own.cell.x + 0.5, z: own.cell.y + 0.5 };
    const enemy = view.visibleEnemies.find((unit) => unit.id === id);
    if (enemy)
      return { x: enemy.positionX1024 / 1024, z: enemy.positionY1024 / 1024 };
    const cell =
      view.bases.find((base) => base.id === id)?.cell ??
      view.facilities.find((facility) => facility.id === id)?.cell;
    return cell ? { x: cell.x + 0.5, z: cell.y + 0.5 } : null;
  };
  const wrapAngle = (angle: number): number =>
    Math.atan2(Math.sin(angle), Math.cos(angle));
  const syncUnitModel = (
    objects: UnitObjects,
    unit: AnyUnitView,
    x: number,
    z: number,
    view: FactionView,
  ): void => {
    const key = unitModelKey(unit);
    if (objects.modelKey !== key) {
      scene.remove(objects.model.group);
      disposeObject(objects.model.group);
      objects.model = createUnitAsset(unit);
      objects.modelKey = key;
      scene.add(objects.model.group);
    }
    const model = objects.model;
    const dx = x - objects.lastX;
    const dz = z - objects.lastZ;
    const moved = Number.isFinite(dx) && Math.hypot(dx, dz) > 1e-4;
    objects.lastX = x;
    objects.lastZ = z;
    const combat = unit.control === 'own' ? unit.attack : unit.combat;
    const engaged = combat?.phase === 'windup' || combat?.phase === 'cooldown';
    let desired = objects.heading;
    if (moved) desired = Math.atan2(dx, dz);
    else if (engaged && combat?.targetId) {
      const target = entityPosition(view, combat.targetId);
      if (target) desired = Math.atan2(target.x - x, target.z - z);
    }
    objects.heading = wrapAngle(
      objects.heading + wrapAngle(desired - objects.heading) * 0.22,
    );
    const y =
      unit.kind === 'patrolBoat'
        ? WATER_Y
        : unit.kind === 'helicopter'
          ? HELI_ALTITUDE
          : (terrain?.heightAt(x, z) ?? 0) + UNIT_LIFT;
    model.group.position.set(x, y, z);
    model.group.rotation.y = objects.heading;
    model.group.visible = !(unit.control === 'own' && unit.garrisonedAtBaseId);
    const moving = moved && view.phase === 'running';
    model.setMoving?.(moving);
    model.setForward?.(moving);
    model.setDeployed?.(!moving);
    model.setMast?.(!moving && unit.kind === 'scout');
    if (unit.factionId === 'local')
      model.setState?.(engaged ? 'engaged' : moving ? 'move' : 'idle');
    const firedTick = combat?.lastFiredTick;
    if (
      firedTick !== undefined &&
      objects.lastFiredTick !== undefined &&
      firedTick !== objects.lastFiredTick
    ) {
      if (model.fireGun) model.fireGun();
      else model.fire?.();
    }
    objects.lastFiredTick = firedTick;
  };
  /** Home view: centre of the own units, else the own capital, else the map. */
  const focusHome = (): void => {
    const view = lastCurrent;
    const units =
      view?.ownUnits.filter((unit) => !unit.garrisonedAtBaseId) ?? [];
    const capital = view?.bases.find(
      (base) => base.id === `HQ-${view.viewerFactionId}`,
    );
    if (units.length > 0) {
      cameraTarget.set(
        units.reduce((sum, unit) => sum + unit.cell.x + 0.5, 0) / units.length,
        0,
        units.reduce((sum, unit) => sum + unit.cell.y + 0.5, 0) / units.length,
      );
    } else if (capital) {
      cameraTarget.set(capital.cell.x + 0.5, 0, capital.cell.y + 0.5);
    } else cameraTarget.set(boardWidth / 2, 0, boardHeight / 2);
  };
  let needsHomeFocus = true;
  let lastRenderedTick = -1;
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
      recentCombatShots.clear();
      selectedUnitIds = [];
      movePreviewRequest = null;
      clearPreviewObjects();
      needsHomeFocus = true;
    }
    lastCurrent = current;
    if (needsHomeFocus) {
      needsHomeFocus = false;
      installMap(current.map);
      cameraDistance = null;
      focusHome();
      resize();
    }
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
        objects.model.group,
        objects.route,
        objects.selection,
        objects.destination,
      );
      disposeObject(objects.model.group);
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
      syncUnitModel(objects, unit, x, z, current);
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
      const glyph = UNIT_GLYPHS[unit.kind];
      objects.glyph.textContent = `${FACTIONS[unit.factionId].symbol}${localUnit ? '現' : ''}${glyph}${combatMark}${bombardMark}${underFire ? '✦' : ''}${march ? '→' : ''}${jammed ? '⚠妨' : ''} ${unit.hp}`;
      objects.label.dataset.combat = combatMark ? String(combat?.phase) : '';
      objects.label.dataset.underFire = String(underFire);
      objects.label.title = `${localUnit ? '現地勢力 ' : ''}${unit.id} ${unit.kind} HP ${unit.hp}/${unit.maxHp}${combatMark ? ` · ${combat?.phase === 'windup' ? '攻撃準備' : '攻撃後の周期待ち'}${visibleTargetId ? ` → ${visibleTargetId}` : ''}` : ''}${unit.control === 'own' && unit.bombardOrder ? ` · 地点砲撃準備 ${unit.bombardOrder.cell.x},${unit.bombardOrder.cell.y}` : pointFireFlight ? ` · 地点砲撃飛翔 ${pointFireFlight.cell.x},${pointFireFlight.cell.y}` : ''}${underFire ? ' · 被弾' : ''}${march ? ` → ${march.target.id}` : ''}`;
      objects.marker.position.set(currentPosition.x, 0, currentPosition.z);
      objects.selection.position.set(
        currentPosition.x,
        unit.kind === 'patrolBoat' ? WATER_Y + 0.05 : 0.045,
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
      updateLabelPosition(
        objects.label,
        new THREE.Vector3(
          currentPosition.x,
          unit.kind === 'helicopter' ? HELI_ALTITUDE + 1.4 : 1.05,
          currentPosition.z,
        ),
      );
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
      const anchorX = parseFloat(entry.label.style.left);
      const anchorY = parseFloat(entry.label.style.top);
      if (
        entry.label.style.display === 'none' ||
        anchorX < 0 ||
        anchorY < 0 ||
        anchorX > bounds.width ||
        anchorY > bounds.height
      ) {
        entry.label.style.display = 'none';
        continue;
      }
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
    syncCrossings(current);
    haze.setVisibility(current);
    refreshMovePreview();
    renderFrame(current.tick !== lastRenderedTick);
    lastRenderedTick = current.tick;
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
    renderFrame();
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
    renderFrame();
  };
  const clearMovePreview = (): void => {
    movePreviewRequest = null;
    clearPreviewObjects();
    renderFrame();
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
      const groundHit = raycaster.ray.intersectPlane(
        groundPlane,
        scratchVector,
      );
      if (groundHit === null) return null;
      const x = Math.floor(groundHit.x);
      const y = Math.floor(groundHit.z);
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
      cameraDistance = THREE.MathUtils.clamp(
        currentDistance() / factor,
        distanceBounds.min,
        distanceBounds.max,
      );
      resize();
    },
    resetCamera() {
      clearMovePreview();
      cameraDistance = null;
      focusHome();
      resize();
    },
    projectCell(cell) {
      if (disposed) return null;
      scratchVector
        .set(
          cell.x + 0.5,
          terrain?.heightAt(cell.x + 0.5, cell.y + 0.5) ?? 0,
          cell.y + 0.5,
        )
        .project(camera);
      if (
        scratchVector.z > 1 ||
        Math.abs(scratchVector.x) > 1 ||
        Math.abs(scratchVector.y) > 1
      )
        return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + ((scratchVector.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - scratchVector.y) / 2) * rect.height,
      };
    },
    viewFootprint() {
      return groundFootprint(
        { x: cameraTarget.x, z: cameraTarget.z },
        currentDistance(),
        aspect,
      );
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
      terrain?.dispose();
      haze.dispose();
      for (const objects of unitObjects.values())
        disposeObject(objects.model.group);
      for (const objects of baseObjects.values()) {
        disposeObject(objects.model.group);
        if (objects.guard) disposeObject(objects.guard.model.group);
      }
      for (const objects of crossingObjects.values())
        disposeObject(objects.model.group);
      for (const geometry of resources.geometries) geometry.dispose();
      for (const material of resources.materials) material.dispose();
      scene.clear();
    },
  };
}
