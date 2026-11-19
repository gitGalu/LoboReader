import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';

import { PAGE_HEIGHT, PAGE_WIDTH } from './MagazineMesh';
import { createPageSurfaceMaterial } from './PageSurfaceMaterial';
import {
  READING_DISTANCE,
  clampReadingView,
  getReadingPageHeight
} from './readingModeLayout';

/** A stable, world-anchored page used for reading fine print. */
export function createReadingPageMesh(scene, fallbackAsset) {
  const mesh = MeshBuilder.CreatePlane(
    'ReadingPageMesh',
    { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    scene
  );
  const surface = createPageSurfaceMaterial(
    'ReadingPageMaterial',
    scene,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    fallbackAsset.texture
  );
  const forward = Vector3.Forward();
  const right = Vector3.Right();
  const up = Vector3.Up();
  const anchorPosition = Vector3.Zero();
  const inverseWorld = Matrix.Identity();
  const anchoredWorldPoint = Vector3.Zero();
  const anchorCorrection = Vector3.Zero();
  let fitScale = 1;
  let view = { zoom: 1, panX: 0, panY: 0 };

  mesh.material = surface.material;
  mesh.isPickable = false;
  mesh.renderingGroupId = 2;
  mesh.setEnabled(false);

  const placeInFrontOf = (camera) => {
    const head = camera.globalPosition ?? camera.position;
    camera.getDirectionToRef(Vector3.Forward(), forward);
    forward.normalize();
    Vector3.CrossToRef(Vector3.Up(), forward, right);
    if (right.lengthSquared() < 1e-6) right.copyFrom(Vector3.Right());
    right.normalize();
    Vector3.CrossToRef(forward, right, up);
    up.normalize();

    mesh.position.copyFrom(head).addInPlace(forward.scale(READING_DISTANCE));
    anchorPosition.copyFrom(mesh.position);
    // Local +Z points away from the reader, making the plane's reader-facing
    // -Z side perpendicular to the view direction. The pose is captured only
    // on entry, so controller and head micro-motion cannot make the page shake.
    mesh.rotationQuaternion = Quaternion.FromLookDirectionLH(
      forward.negate(),
      Vector3.Up()
    );

    const height = getReadingPageHeight(camera.fov, READING_DISTANCE);
    fitScale = height / PAGE_HEIGHT;
    view = { zoom: 1, panX: 0, panY: 0 };
    mesh.scaling.set(fitScale, fitScale, fitScale);
  };

  const applyViewTransform = () => {
    const scale = fitScale * view.zoom;
    mesh.scaling.set(scale, scale, scale);
    mesh.position.copyFrom(anchorPosition);
    right.scaleAndAddToRef(view.panX, mesh.position);
    up.scaleAndAddToRef(view.panY, mesh.position);
  };

  const setView = (nextView, zoomAnchor = null) => {
    view = clampReadingView(
      nextView,
      PAGE_WIDTH * fitScale,
      PAGE_HEIGHT * fitScale
    );
    applyViewTransform();

    if (zoomAnchor?.localPoint && zoomAnchor?.worldPoint) {
      // Scaling occurs around the mesh centre. Offset that centre by exactly
      // the amount required to keep the selected page point stationary.
      mesh.computeWorldMatrix(true);
      Vector3.TransformCoordinatesToRef(
        zoomAnchor.localPoint,
        mesh.getWorldMatrix(),
        anchoredWorldPoint
      );
      zoomAnchor.worldPoint.subtractToRef(anchoredWorldPoint, anchorCorrection);
      view = clampReadingView(
        {
          ...view,
          panX: view.panX + Vector3.Dot(anchorCorrection, right),
          panY: view.panY + Vector3.Dot(anchorCorrection, up)
        },
        PAGE_WIDTH * fitScale,
        PAGE_HEIGHT * fitScale
      );
      applyViewTransform();
    }

    return { ...view };
  };

  return {
    mesh,
    show(asset, camera) {
      surface.setAsset(asset ?? fallbackAsset);
      placeInFrontOf(camera);
      mesh.setEnabled(true);
    },
    setAsset(asset) {
      surface.setAsset(asset ?? fallbackAsset);
    },
    setView,
    createZoomAnchor(ray) {
      if (!ray || !mesh.isEnabled()) return null;

      mesh.computeWorldMatrix(true);
      const pick = ray.intersectsMesh(mesh, false);
      if (!pick?.hit || !pick.pickedPoint) return null;

      mesh.getWorldMatrix().invertToRef(inverseWorld);
      return {
        localPoint: Vector3.TransformCoordinates(pick.pickedPoint, inverseWorld),
        worldPoint: pick.pickedPoint.clone()
      };
    },
    getView() {
      return { ...view };
    },
    getInteractionAxes() {
      return {
        forward: forward.clone(),
        right: right.clone(),
        up: up.clone()
      };
    },
    hide() {
      mesh.setEnabled(false);
    },
    dispose() {
      surface.dispose();
      mesh.dispose();
    }
  };
}
