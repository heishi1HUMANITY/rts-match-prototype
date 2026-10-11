import * as THREE from 'three';
import { ISOLATED_CELL, MAP_HEIGHT, MAP_WIDTH } from '../simulation/config';
import { isCellBlocked } from '../simulation/map';
import type { Cell, GridMap, MatchState, UnitState } from '../simulation/types';

export type BoardPick =
  | { readonly kind: 'unit'; readonly unitId: string }
  | { readonly kind: 'ground'; readonly cell: Cell };

export interface BoardView {
  readonly canvas: HTMLCanvasElement;
  readonly available: boolean;
  sync(previous: MatchState, current: MatchState, alpha: number): void;
  setSelection(unitId: string | null): void;
  pick(clientX: number, clientY: number): BoardPick | null;
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
  readonly screenOffsetY: number;
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
      pick: () => null,
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
    new THREE.MeshBasicMaterial({ color: 0x181c20, side: THREE.DoubleSide }),
  );
  const destinationMaterial = ownMaterial(
    new THREE.MeshBasicMaterial({
      color: 0x181c20,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    }),
  );
  const unitObjects = new Map<string, UnitObjects>();
  const unitRaycastTargets: THREE.Mesh[] = [];

  const labelsPerFaction: Record<keyof typeof FACTIONS, number> = {
    A: 0,
    B: 0,
    C: 0,
  };
  for (const unit of [
    { id: 'A-01', factionId: 'A' },
    { id: 'A-02', factionId: 'A' },
    { id: 'B-01', factionId: 'B' },
    { id: 'B-02', factionId: 'B' },
    { id: 'C-01', factionId: 'C' },
    { id: 'C-02', factionId: 'C' },
  ] as const) {
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
      width: '18px',
      height: '18px',
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
    glyph.setAttribute('aria-hidden', 'true');
    label.append(glyph);
    labelLayer.append(label);
    const indexWithinFaction = labelsPerFaction[faction]++;
    unitObjects.set(unit.id, {
      marker,
      route,
      destination,
      selection,
      label,
      glyph,
      screenOffsetY: indexWithinFaction === 0 ? -8 : 8,
    });
  }

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
    if (renderedMap === map) return;
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

  let selectedUnitId: string | null = null;
  let lastCurrent: MatchState | null = null;
  let lastAlpha = 0;
  let contextLost = false;
  let disposed = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const scratchVector = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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

  const sync = (
    previous: MatchState,
    current: MatchState,
    alpha: number,
  ): void => {
    if (disposed) return;
    lastCurrent = current;
    lastAlpha = Math.max(0, Math.min(1, alpha));
    installMap(current.map);
    const interpolateTick =
      current.seed === previous.seed &&
      current.phase === 'running' &&
      current.elapsedTicks === previous.elapsedTicks + 1;
    const previousUnits = new Map(
      previous.units.map((unit) => [unit.id, unit]),
    );

    for (const unit of current.units) {
      const objects = unitObjects.get(unit.id);
      if (objects === undefined) continue;
      const currentPosition = discreteUnitPosition(unit);
      const previousUnit = previousUnits.get(unit.id);
      if (interpolateTick && previousUnit !== undefined) {
        currentPosition.lerp(discreteUnitPosition(previousUnit), 1 - lastAlpha);
      }
      objects.marker.position.copy(currentPosition);
      objects.selection.position.set(
        currentPosition.x,
        0.045,
        currentPosition.z,
      );
      objects.selection.visible = selectedUnitId === unit.id;

      const positionAttribute = objects.route.geometry.getAttribute(
        'position',
      ) as THREE.BufferAttribute;
      const routeArray = positionAttribute.array as Float32Array;
      let routeCount = 0;
      if (unit.path.length > 0) {
        routeArray[routeCount * 3] = currentPosition.x;
        routeArray[routeCount * 3 + 1] = 0.075;
        routeArray[routeCount * 3 + 2] = currentPosition.z;
        routeCount += 1;
        for (const cell of unit.path) {
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

      const destinationCell = unit.path[unit.path.length - 1];
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
        currentPosition,
        objects.screenOffsetY,
      );
    }
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

  return {
    canvas,
    available: true,
    sync,
    setSelection(unitId) {
      selectedUnitId =
        unitId !== null && unitObjects.has(unitId) ? unitId : null;
      for (const [id, objects] of unitObjects) {
        objects.selection.visible = selectedUnitId === id;
      }
      if (!contextLost) renderer.render(scene, camera);
    },
    pick(clientX, clientY) {
      if (contextLost || !rayFromClient(clientX, clientY)) return null;
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
      const groundHit = raycaster.intersectObject(ground, false)[0];
      if (groundHit === undefined) return null;
      const x = Math.floor(groundHit.point.x);
      const y = Math.floor(groundHit.point.z);
      if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return null;
      return { kind: 'ground', cell: { x, y } };
    },
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
      cameraTarget.set(MAP_WIDTH / 2, 0, MAP_HEIGHT / 2);
      zoom = 1;
      resize();
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
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
      for (const geometry of resources.geometries) geometry.dispose();
      for (const material of resources.materials) material.dispose();
      scene.clear();
    },
  };
}
