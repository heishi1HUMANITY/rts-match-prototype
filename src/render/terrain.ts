/**
 * 3D terrain for the board, built from the map's cells in the style of the
 * `terrain` mock asset: matte white land on a dark-edged slab, rivers carved
 * by class (I/II/III) under translucent cyan water with flow lines, and
 * terraced (contour-model) mountains. 1 world unit = 1 cell; land is y = 0.
 */
import * as THREE from 'three';
import type { GridMap } from '../simulation/types';

export const WATER_Y = -0.16;
const RIVER_BED: Readonly<Record<number, number>> = {
  0: -0.32,
  1: -0.32,
  2: -0.46,
  3: -0.62,
};
const MOUNTAIN_PEAK: Readonly<Record<number, number>> = {
  0: 1.0,
  1: 1.5,
  2: 2.1,
};
const CONTOUR_STEP = 0.16;
const SAMPLES_PER_CELL = 2;
const SLAB_BOTTOM = -1.1;

export interface TerrainView {
  readonly group: THREE.Group;
  /** Ground height used to seat units and structures. */
  heightAt(x: number, z: number): number;
  update(dt: number): void;
  dispose(): void;
}

const seeded = (seed: number) => (): number => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

export function createTerrain(map: GridMap): TerrainView {
  const { width, height } = map;
  const group = new THREE.Group();
  group.name = 'terrain';
  const disposables: { dispose(): void }[] = [];
  const own = <T extends { dispose(): void }>(value: T): T => {
    disposables.push(value);
    return value;
  };
  const kindAt = (x: number, y: number) =>
    map.terrain?.[y * width + x] ??
    (map.blocked[y * width + x] ? 'mountain' : 'land');
  const levelAt = (x: number, y: number) =>
    map.terrainLevel?.[y * width + x] ?? 0;
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height;

  // Mountain heights: blur the mountain mask so peaks rise inside the massif,
  // then terrace them like a contour model.
  const mountain = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      if (kindAt(x, y) !== 'mountain') continue;
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1)
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!inside(x + dx, y + dy)) continue;
          count += 1;
          if (kindAt(x + dx, y + dy) === 'mountain') sum += 1;
        }
      const peak = MOUNTAIN_PEAK[levelAt(x, y)] ?? MOUNTAIN_PEAK[0]!;
      mountain[y * width + x] = peak * (0.45 + 0.55 * (sum / count));
    }
  const cellHeight = (x: number, y: number): number => {
    if (!inside(x, y)) return 0;
    const kind = kindAt(x, y);
    if (kind === 'river') return RIVER_BED[levelAt(x, y)] ?? RIVER_BED[1]!;
    if (kind === 'riverbank') return -0.08;
    if (kind === 'mountain') return mountain[y * width + x]!;
    return 0;
  };

  // Heightfield sampled at half cells: a sample inside a cell takes that cell's
  // height, one on an edge/corner averages its neighbours (sloped banks).
  const nx = width * SAMPLES_PER_CELL + 1;
  const nz = height * SAMPLES_PER_CELL + 1;
  const heights = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j += 1)
    for (let i = 0; i < nx; i += 1) {
      const px = i / SAMPLES_PER_CELL;
      const pz = j / SAMPLES_PER_CELL;
      const xs = Number.isInteger(px) ? [px - 1, px] : [Math.floor(px)];
      const zs = Number.isInteger(pz) ? [pz - 1, pz] : [Math.floor(pz)];
      let sum = 0;
      let count = 0;
      let minimum = Infinity;
      let mountainCount = 0;
      for (const cz of zs)
        for (const cx of xs) {
          if (!inside(cx, cz)) continue;
          const value = cellHeight(cx, cz);
          sum += value;
          count += 1;
          minimum = Math.min(minimum, value);
          if (kindAt(cx, cz) === 'mountain') mountainCount += 1;
        }
      let value = count ? sum / count : 0;
      // Mountain feet stay on the ground unless every touching cell is mountain.
      if (mountainCount > 0 && mountainCount < count)
        value = Math.max(0, minimum);
      if (value > 0) value = Math.round(value / CONTOUR_STEP) * CONTOUR_STEP;
      heights[j * nx + i] = value;
    }

  const positions = new Float32Array(nx * nz * 3);
  const colors = new Float32Array(nx * nz * 3);
  const land = new THREE.Color(0xf3f5f7);
  const shore = new THREE.Color(0xc9d0d7);
  const bed = new THREE.Color(0x9fb3bf);
  const peak = new THREE.Color(0xffffff);
  const foot = new THREE.Color(0xdde2e7);
  const scratch = new THREE.Color();
  for (let j = 0; j < nz; j += 1)
    for (let i = 0; i < nx; i += 1) {
      const index = j * nx + i;
      const value = heights[index]!;
      positions[index * 3] = i / SAMPLES_PER_CELL;
      positions[index * 3 + 1] = value;
      positions[index * 3 + 2] = j / SAMPLES_PER_CELL;
      if (value < -0.2) scratch.copy(bed);
      else if (value < -0.01) scratch.copy(shore);
      else if (value > 0.01)
        scratch.copy(foot).lerp(peak, Math.min(1, value / 2.1));
      else scratch.copy(land);
      colors[index * 3] = scratch.r;
      colors[index * 3 + 1] = scratch.g;
      colors[index * 3 + 2] = scratch.b;
    }
  const indices: number[] = [];
  for (let j = 0; j < nz - 1; j += 1)
    for (let i = 0; i < nx - 1; i += 1) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  const surfaceGeometry = own(new THREE.BufferGeometry());
  surfaceGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3),
  );
  surfaceGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  surfaceGeometry.setIndex(indices);
  surfaceGeometry.computeVertexNormals();
  const surface = new THREE.Mesh(
    surfaceGeometry,
    own(
      new THREE.MeshLambertMaterial({
        color: 0xffffff,
        vertexColors: true,
        flatShading: true,
      }),
    ),
  );
  surface.name = 'terrain-surface';
  group.add(surface);

  // Board slab: light sides with a dark skirt line, like the asset's table edge.
  const slabGeometry = own(
    new THREE.BoxGeometry(width, -SLAB_BOTTOM - 0.02, height),
  );
  slabGeometry.translate(width / 2, (SLAB_BOTTOM - 0.02) / 2, height / 2);
  const slab = new THREE.Mesh(
    slabGeometry,
    own(new THREE.MeshLambertMaterial({ color: 0xc9d0d7 })),
  );
  group.add(slab);
  const skirtGeometry = own(
    new THREE.BoxGeometry(width + 0.3, 0.18, height + 0.3),
  );
  skirtGeometry.translate(width / 2, SLAB_BOTTOM, height / 2);
  group.add(
    new THREE.Mesh(
      skirtGeometry,
      own(new THREE.MeshLambertMaterial({ color: 0x3b4752 })),
    ),
  );

  // Faint cell grid on open land only (the board's "drawing paper").
  const gridPositions: number[] = [];
  const flat = (x: number, y: number) =>
    inside(x, y) && kindAt(x, y) === 'land' && !map.blocked[y * width + x];
  for (let y = 0; y <= height; y += 1)
    for (let x = 0; x < width; x += 1)
      if (flat(x, y) || flat(x, y - 1))
        gridPositions.push(x, 0.004, y, x + 1, 0.004, y);
  for (let x = 0; x <= width; x += 1)
    for (let y = 0; y < height; y += 1)
      if (flat(x, y) || flat(x - 1, y))
        gridPositions.push(x, 0.004, y, x, 0.004, y + 1);
  const gridGeometry = own(new THREE.BufferGeometry());
  gridGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(gridPositions, 3),
  );
  const grid = new THREE.LineSegments(
    gridGeometry,
    own(
      new THREE.LineBasicMaterial({
        color: 0x0e161e,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
      }),
    ),
  );
  grid.name = 'cell-grid';
  group.add(grid);

  // Contour lines on terraces: an edge where the stepped height changes.
  const contourPositions: number[] = [];
  for (let j = 0; j < nz; j += 1)
    for (let i = 0; i < nx; i += 1) {
      const value = heights[j * nx + i]!;
      if (value <= 0.01) continue;
      for (const [di, dj] of [
        [1, 0],
        [0, 1],
      ] as const) {
        if (i + di >= nx || j + dj >= nz) continue;
        const other = heights[(j + dj) * nx + i + di]!;
        if (Math.abs(other - value) < 0.01) continue;
        const top = Math.max(value, other);
        const x0 = (i + (dj ? 0 : 0.5)) / SAMPLES_PER_CELL;
        const z0 = (j + (di ? 0 : 0.5)) / SAMPLES_PER_CELL;
        if (di)
          contourPositions.push(
            x0,
            top + 0.01,
            z0 - 0.25,
            x0,
            top + 0.01,
            z0 + 0.25,
          );
        else
          contourPositions.push(
            x0 - 0.25,
            top + 0.01,
            z0,
            x0 + 0.25,
            top + 0.01,
            z0,
          );
      }
    }
  if (contourPositions.length) {
    const contourGeometry = own(new THREE.BufferGeometry());
    contourGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(contourPositions, 3),
    );
    group.add(
      new THREE.LineSegments(
        contourGeometry,
        own(
          new THREE.LineBasicMaterial({
            color: 0x8f98a3,
            transparent: true,
            opacity: 0.55,
          }),
        ),
      ),
    );
  }

  // Water: one quad per river cell with the shared flow texture.
  const waterPositions: number[] = [];
  const waterUvs: number[] = [];
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const kind = kindAt(x, y);
      if (kind !== 'river' && kind !== 'riverbank') continue;
      const corners = [
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
      ] as const;
      for (const [cx, cz] of corners) {
        waterPositions.push(cx, WATER_Y, cz);
        waterUvs.push(cx / 0.9, cz / 1.8);
      }
    }
  const waterTexture = own(createFlowTexture());
  const waterMaterial = own(
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map: waterTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  if (waterPositions.length) {
    const waterGeometry = own(new THREE.BufferGeometry());
    waterGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(waterPositions, 3),
    );
    waterGeometry.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute(waterUvs, 2),
    );
    waterGeometry.computeVertexNormals();
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.name = 'water';
    water.renderOrder = 1;
    group.add(water);
  }

  // Blocked open land: low concrete blocks (rubble / structures) per cell.
  let blocks = 0;
  for (let index = 0; index < map.blocked.length; index += 1)
    if (map.blocked[index] && (map.terrain?.[index] ?? 'land') === 'land')
      blocks += 1;
  if (blocks > 0) {
    const blockGeometry = own(new THREE.BoxGeometry(1, 1, 1));
    blockGeometry.translate(0, 0.5, 0);
    const blockMesh = new THREE.InstancedMesh(
      blockGeometry,
      own(new THREE.MeshLambertMaterial({ color: 0xffffff })),
      blocks,
    );
    blockMesh.name = 'obstacles';
    const random = seeded(97);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    let instance = 0;
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (!map.blocked[index] || (map.terrain?.[index] ?? 'land') !== 'land')
          continue;
        const h = 0.18 + random() * 0.3;
        const w = 0.7 + random() * 0.2;
        matrix.compose(
          new THREE.Vector3(x + 0.5, 0, y + 0.5),
          new THREE.Quaternion(),
          new THREE.Vector3(w, h, w),
        );
        blockMesh.setMatrixAt(instance, matrix);
        blockMesh.setColorAt(
          instance,
          color.setHex(random() < 0.35 ? 0xa9b2ba : 0xd5dbe0),
        );
        instance += 1;
      }
    blockMesh.instanceMatrix.needsUpdate = true;
    if (blockMesh.instanceColor) blockMesh.instanceColor.needsUpdate = true;
    blockMesh.computeBoundingSphere();
    group.add(blockMesh);
    disposables.push({ dispose: () => blockMesh.dispose() });
  }

  let flow = 0;
  return {
    group,
    heightAt(x, z) {
      const i = Math.round(x * SAMPLES_PER_CELL);
      const j = Math.round(z * SAMPLES_PER_CELL);
      if (i < 0 || j < 0 || i >= nx || j >= nz) return 0;
      return heights[j * nx + i]!;
    },
    update(dt) {
      flow = (flow + dt * 0.12) % 1;
      waterTexture.offset.y = -flow;
    },
    dispose() {
      for (const item of disposables) item.dispose();
    },
  };
}

/** Same look as the asset kit's water: cyan with short white flow strokes. */
function createFlowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#1fd3ff';
    context.fillRect(0, 0, 64, 128);
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.lineWidth = 2;
    for (const [x, y, length] of [
      [10, 10, 26],
      [40, 40, 18],
      [22, 74, 30],
      [50, 100, 22],
      [6, 112, 14],
    ] as const) {
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y + length);
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
