/**
 * Typed entry point for the procedural 3D assets refined on the `3dtmp` branch
 * (mockups/3d in the docs snapshot). The asset files are kept as-is: each registers a
 * factory on `window.DreamAssets` and receives THREE as an argument.
 * Render-only code: nothing here feeds back into the simulation.
 */
import * as THREE from 'three';
import type { BaseKind, UnitKind } from '../../simulation/types';
import './common.js';
import './chassis.js';
import './tank.js';
import './scout.js';
import './spg.js';
import './aa.js';
import './heli.js';
import './boat.js';
import './guard.js';
import './raider.js';
import './boss.js';
import './plant.js';
import './hub.js';
import './port.js';
import './mine.js';
import './lab.js';
import './factory.js';
import './floodgate.js';
import './bridge.js';
import './ropeway.js';

export interface AssetModel {
  readonly group: THREE.Group;
  readonly plateRadius?: number;
  readonly parts?: Record<string, THREE.Object3D | undefined>;
  update(dt: number): void;
  setTeam(color: number | null): void;
  fire?(): void;
  fireGun?(): void;
  setFxStyle?(style: 'real' | 'stylized'): void;
  setMoving?(moving: boolean): void;
  setTraverse?(on: boolean): void;
  setDeployed?(on: boolean): void;
  setEngaged?(on: boolean): void;
  setMast?(on: boolean): void;
  setFlying?(on: boolean): void;
  setForward?(on: boolean): void;
  setGunFiring?(on: boolean): void;
  setState?(state: string): void;
  setClass?(tier: number): void;
  setLength?(length: number): void;
}

type Factory = (three: typeof THREE, options?: object) => AssetModel;
const registry = (): Record<string, Factory> =>
  (window as unknown as { DreamAssets: Record<string, Factory> }).DreamAssets;
const make = (key: string, options?: object): AssetModel => {
  const factory = registry()[key];
  if (!factory) throw new Error(`3D asset "${key}" is not registered`);
  return factory(THREE, options);
};

/** Mock assets are authored around an 80-unit cell; the board uses 1 unit per cell. */
const MOCK_CELL = 80;
/** Units read as about one cell long (the viewer shows them at 2.0 on an 80 cell). */
export const UNIT_SCALE = 1.8 / MOCK_CELL;

const UNIT_ASSETS: Readonly<Record<UnitKind, string>> = {
  assault: 'tank',
  scout: 'scout',
  artillery: 'spg',
  antiAir: 'aa',
  helicopter: 'heli',
  patrolBoat: 'boat',
};

export function createUnitModel(kind: UnitKind): AssetModel {
  const model = make(UNIT_ASSETS[kind]);
  model.setFxStyle?.('real');
  if (kind === 'helicopter') model.setFlying?.(true);
  if (kind === 'antiAir') model.setEngaged?.(true);
  model.group.scale.setScalar(UNIT_SCALE);
  return model;
}

/** Local-force units use the roaming raider convoy instead of faction vehicles. */
export function createRaiderModel(stage: 1 | 2 | 3): AssetModel {
  const model = make('raider', { stage });
  model.group.scale.setScalar(UNIT_SCALE);
  return model;
}

export function createGuardModel(size: 'S' | 'M' | 'L'): AssetModel {
  const model = make('guard', { size, mobile: false });
  model.group.scale.setScalar(UNIT_SCALE);
  return model;
}

export function createBossModel(): AssetModel {
  const model = make('boss');
  model.group.scale.setScalar(UNIT_SCALE);
  return model;
}

/** Variant chosen per base id so the same base always shows the same facility. */
export type StructureVariant =
  | 'plant'
  | 'mine'
  | 'port'
  | 'hub'
  | 'lab'
  | 'factory'
  | 'floodgate'
  | 'hq';

export function structureVariant(
  kind: BaseKind,
  index: number,
  nearWater: boolean,
): StructureVariant {
  if (kind === 'hq') return 'hq';
  if (kind === 'large') return 'floodgate';
  if (kind === 'medium')
    return (['hub', 'lab', 'factory'] as const)[index % 3]!;
  if (nearWater) return 'port';
  return index % 2 === 0 ? 'plant' : 'mine';
}

/**
 * Zone radius (mock units) each structure is authored around; the board scales
 * the structure so this radius covers its footprint in cells.
 */
export const STRUCTURE_RADIUS: Readonly<Record<StructureVariant, number>> = {
  plant: 60,
  mine: 60,
  port: 60,
  hub: 75,
  lab: 75,
  factory: 75,
  floodgate: 110,
  hq: 90,
};

export function createStructureModel(variant: StructureVariant): AssetModel {
  if (variant === 'hq') return createHeadquarters(STRUCTURE_RADIUS.hq);
  return make(variant, { r: STRUCTURE_RADIUS[variant] });
}

export function createCrossingModel(tier: string, length: number): AssetModel {
  const cls = Number(tier.slice(-1)) || 1;
  const model = tier.startsWith('bridge')
    ? make('bridge', { cls, len: length, size: 2 })
    : make('ropeway', { cls: Math.min(2, cls) });
  // The asset carries a demo river/mountain ("world"); the board draws its own terrain.
  const hideWorld = (): void => {
    const world = model.group.getObjectByName('world');
    if (world) world.visible = false;
  };
  hideWorld();
  return {
    ...model,
    group: model.group,
    update(dt) {
      model.update(dt);
      hideWorld();
    },
    setTeam: (color) => model.setTeam(color),
    setState: (state) => model.setState?.(state),
  };
}

/**
 * Provisional capital (the mock keeps per-organisation capitals on hold): a
 * stepped command block on a chamfered slab with the team symbol and capture ring.
 */
function createHeadquarters(radius: number): AssetModel {
  const U = (
    window as unknown as {
      DreamAssets: {
        util: {
          slab(
            three: typeof THREE,
            hx: number,
            hz: number,
            c: number,
            h: number,
          ): THREE.BufferGeometry;
          signTexture(three: typeof THREE, ch: string): THREE.Texture;
        };
      };
    }
  ).DreamAssets.util;
  const group = new THREE.Group();
  group.name = 'hq';
  const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
  const white = lambert(0xf2f4f6);
  const light = lambert(0xdfe4e9);
  const dark = lambert(0x3b4752);
  const team = new THREE.MeshBasicMaterial({ color: 0x8f98a3 });
  const edge = new THREE.LineBasicMaterial({
    color: 0x141b21,
    transparent: true,
    opacity: 0.5,
  });
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.add(
      new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), edge),
    );
    group.add(mesh);
    return mesh;
  };
  add(U.slab(THREE, 62, 52, 12, 4), dark);
  add(U.slab(THREE, 58, 48, 10, 2), white, 0, 4, 0);
  add(new THREE.BoxGeometry(56, 16, 34), light, -6, 14, -4);
  add(new THREE.BoxGeometry(34, 14, 26), white, -10, 29, -6);
  add(new THREE.BoxGeometry(14, 30, 14), white, 26, 21, 14);
  add(new THREE.CylinderGeometry(1, 1, 22, 6), dark, 26, 47, 14);
  add(new THREE.BoxGeometry(60, 1.6, 2), team, -6, 22.2, 13.2);
  add(new THREE.BoxGeometry(36, 1.4, 1.6), team, -10, 36.4, 7.2);
  const signGeometry = new THREE.PlaneGeometry(12, 12);
  signGeometry.rotateX(-Math.PI / 2);
  const sign = new THREE.Mesh(
    signGeometry,
    new THREE.MeshBasicMaterial({
      map: U.signTexture(THREE, '都'),
      transparent: true,
    }),
  );
  sign.position.set(-10, 36.2, -6);
  group.add(sign);
  const ringPoints = Array.from({ length: 65 }, (_, i) => {
    const angle = (i / 64) * Math.PI * 2;
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      0.3,
      Math.sin(angle) * radius,
    );
  });
  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0x8f98a3,
    transparent: true,
    opacity: 0.8,
  });
  group.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ringPoints),
      ringMaterial,
    ),
  );
  const discGeometry = new THREE.CircleGeometry(radius, 48);
  discGeometry.rotateX(-Math.PI / 2);
  const discMaterial = new THREE.MeshBasicMaterial({
    color: 0x8f98a3,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(discGeometry, discMaterial);
  disc.position.y = 0.2;
  group.add(disc);
  let beacon = 0;
  return {
    group,
    update(dt) {
      beacon = (beacon + dt) % 2;
      team.opacity = 1;
      ringMaterial.opacity = 0.65 + 0.2 * Math.sin(beacon * Math.PI);
    },
    setTeam(color) {
      const value = color ?? 0x8f98a3;
      team.color.setHex(value);
      ringMaterial.color.setHex(value);
      discMaterial.color.setHex(value);
    },
    setState() {},
  };
}
