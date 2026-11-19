/** Drives the single segmented sheet used for every page turn. */

import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';

import { createPageCurlMaterial } from './PageCurlMaterial';
import { COVER_PROFILE, DEFAULT_PAGE_PROFILE } from './paperProfiles';
import { createVelocityTracker, decideSettleTarget, stepSettle } from './pageTurnPhysics';
import { createSegmentedPageData } from './pageMeshGeometry';

/** Small reader-facing separation from the static page, in metres. */
const PAGE_SURFACE_OFFSET = 0.00018;

function createSegmentedPage(scene, pageWidth, pageHeight, segmentsX, segmentsY) {
  const mesh = new Mesh('TurningPage', scene);
  const data = createSegmentedPageData(
    pageWidth,
    pageHeight,
    segmentsX,
    segmentsY,
    PAGE_SURFACE_OFFSET
  );

  const vertexData = new VertexData();
  vertexData.positions = data.positions;
  vertexData.normals = data.normals;
  vertexData.uvs = data.uvs;
  vertexData.indices = data.indices;
  vertexData.applyToMesh(mesh, false);
  mesh.setVerticesData('pageSide', data.pageSides, false, 1);

  // The CPU bounding box remains flat while the shader lifts the page.
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.isPickable = false;
  mesh.setEnabled(false);
  return mesh;
}

export function createPageTurnController(
  scene,
  {
    pageWidth,
    pageHeight,
    segmentsX = 28,
    segmentsY = 16,
    onCommit,
    onSettled,
    pageProfile = DEFAULT_PAGE_PROFILE,
    coverProfile = COVER_PROFILE
  }
) {
  const curl = createPageCurlMaterial(scene, { pageWidth, pageHeight });
  const mesh = createSegmentedPage(scene, pageWidth, pageHeight, segmentsX, segmentsY);
  mesh.material = curl.material;

  /** @type {'idle'|'grabbed'|'dragging'|'settling-forward'|'settling-backward'} */
  let state = 'idle';
  let progress = 0;
  let velocity = 0;
  let direction = 1;
  let profile = pageProfile;
  let activeGrabU = 1;
  let activeGrabV = 0.5;
  const tracker = createVelocityTracker();

  curl.applyProfile(profile);

  const setProfile = (isCover) => {
    profile = isCover ? coverProfile : pageProfile;
    curl.applyProfile(profile);
  };

  const begin = (turnDirection, grabU = 1, grabV = 0.5) => {
    if (state !== 'idle' || (turnDirection !== 1 && turnDirection !== -1)) {
      return false;
    }

    direction = turnDirection;
    progress = 0;
    velocity = 0;
    activeGrabU = Math.min(Math.max(grabU, 0), 1);
    activeGrabV = Math.min(Math.max(grabV, 0), 1);
    state = 'grabbed';
    curl.setGrabPoint(activeGrabU, activeGrabV);
    curl.setProgress(0, direction);
    mesh.setEnabled(true);
    tracker.reset(0, performance.now());
    return true;
  };

  const drag = (nextProgress, nextGrabV = activeGrabV) => {
    if (state !== 'grabbed' && state !== 'dragging') {
      return;
    }

    state = 'dragging';
    progress = Math.min(Math.max(nextProgress, 0), 1);
    activeGrabV = Math.min(Math.max(nextGrabV, 0), 1);
    velocity = tracker.update(progress, performance.now());
    curl.setGrabPoint(activeGrabU, activeGrabV);
    curl.setProgress(progress, direction);
  };

  const release = () => {
    if (state !== 'grabbed' && state !== 'dragging') {
      return false;
    }

    state = decideSettleTarget(progress, velocity);
    return true;
  };

  const update = (deltaMs) => {
    if (state !== 'settling-forward' && state !== 'settling-backward') {
      return;
    }

    const target = state === 'settling-forward' ? 1 : 0;
    const durationSeconds = Math.max(profile.settleDurationMs / 1000, 0.1);
    const stiffness = Math.pow(4 / durationSeconds, 2);
    const step = stepSettle(
      progress,
      velocity,
      target,
      stiffness,
      deltaMs / 1000,
      profile.damping
    );
    progress = step.progress;
    velocity = step.velocity;
    curl.setProgress(progress, direction);

    if (!step.settled) {
      return;
    }

    const committed = state === 'settling-forward';
    const settledDirection = direction;
    mesh.setEnabled(false);
    state = 'idle';
    progress = 0;
    velocity = 0;

    if (committed) {
      onCommit?.(settledDirection);
    }
    onSettled?.(committed, settledDirection);
  };

  return {
    node: mesh,
    mesh,
    get state() {
      return state;
    },
    get progress() {
      return progress;
    },
    get isBusy() {
      return state !== 'idle';
    },
    begin,
    drag,
    release,
    update,
    setProfile,
    setTextures: curl.setTextures,
    cancel() {
      mesh.setEnabled(false);
      state = 'idle';
      progress = 0;
      velocity = 0;
    },
    dispose() {
      mesh.dispose();
      curl.dispose();
    }
  };
}
