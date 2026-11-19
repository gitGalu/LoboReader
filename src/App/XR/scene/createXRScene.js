/**
 * Babylon.js scene construction for the XR magazine.
 *
 * Everything in this directory is reached only through the dynamic import in
 * MagazineXRSession, so the 3D engine stays out of the 2D reader's bundle.
 *
 * Imports are deep and per-symbol rather than from '@babylonjs/core' so the
 * bundler can tree-shake the engine down to what the scene actually uses.
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';

import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Meshes/Builders/planeBuilder';
import '@babylonjs/core/Meshes/Builders/boxBuilder';

/** Comfortable seated reading distance, in metres. */
export const MAGAZINE_DISTANCE = 0.85;

/** Height of the magazine centre relative to the session origin, in metres. */
export const MAGAZINE_HEIGHT = 1.3;

/**
 * Creates the engine, scene, camera and lighting.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{ engine: Engine, scene: Scene, camera: FreeCamera, dispose: () => void }}
 */
export function createXRScene(canvas) {
  const engine = new Engine(canvas, true, {
    // Required so the WebXR compositor can read the drawing buffer.
    preserveDrawingBuffer: true,
    stencil: true,
    // Headsets composite their own antialiasing; skipping MSAA here saves fill.
    antialias: true,
    disableWebGL2Support: false
  });

  const scene = new Scene(engine);

  // Neutral near-black so page whites carry the contrast rather than competing
  // with a bright environment.
  scene.clearColor = new Color4(0.05, 0.05, 0.07, 1.0);
  scene.autoClear = true;

  // Non-XR fallback camera. The WebXR helper replaces this once a session
  // starts; it exists so the scene is renderable on desktop for testing.
  const camera = new FreeCamera('xrFallbackCamera', new Vector3(0, MAGAZINE_HEIGHT, 0), scene);
  camera.setTarget(new Vector3(0, MAGAZINE_HEIGHT, MAGAZINE_DISTANCE));
  camera.minZ = 0.1;
  camera.attachControl(canvas, true);

  const light = new HemisphericLight('xrAmbient', new Vector3(0, 1, 0), scene);
  light.intensity = 0.95;
  light.diffuse = new Color3(1, 1, 1);
  // Keep the underside lit so page text never falls into crushed shadow.
  light.groundColor = new Color3(0.55, 0.55, 0.6);
  light.specular = new Color3(0, 0, 0);

  const dispose = () => {
    scene.dispose();
    engine.dispose();
  };

  return { engine, scene, camera, dispose };
}
