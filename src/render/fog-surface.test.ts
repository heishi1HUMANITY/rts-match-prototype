import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FOG_SURFACE_Y } from './fog-surface';

const CAMERA_OFFSET = new THREE.Vector3(0, 32, 28);

describe('fog surface projection', () => {
  it.each([40, 100])(
    'keeps the fog within five percent of a projected cell at map size %i',
    (size) => {
      const target = new THREE.Vector3(size / 2, 0, size / 2);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
      camera.position.copy(target).add(CAMERA_OFFSET);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      const project = (point: THREE.Vector3): THREE.Vector3 =>
        point.clone().project(camera);
      const ground = project(target);
      const fog = project(new THREE.Vector3(target.x, FOG_SURFACE_Y, target.z));
      const nextCell = project(new THREE.Vector3(target.x, 0, target.z + 1));
      const offsetRatio =
        Math.abs(fog.y - ground.y) / Math.abs(nextCell.y - ground.y);

      expect(offsetRatio).toBeLessThan(0.05);
    },
  );
});
