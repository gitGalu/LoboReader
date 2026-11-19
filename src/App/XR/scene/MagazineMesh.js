/**
 * The 3D magazine: two static pages, a spine, and the page-block slabs that
 * give the issue visual thickness.
 *
 * The vertical slice renders spreads statically. The deformable turning page
 * lands here later, which is why the node hierarchy already reserves a slot
 * for it.
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';

import { MAGAZINE_DISTANCE, MAGAZINE_HEIGHT } from './createXRScene';
import { createCoverEdgeSpineMaterial } from './CoverEdgeSpineMaterial';
import { createPageBlockEdgeMaterial } from './PageBlockEdgeMaterial';
import { createPageSurfaceMaterial } from './PageSurfaceMaterial';

/** Physical page size in metres, roughly A4. */
export const PAGE_WIDTH = 0.21;
export const PAGE_HEIGHT = 0.297;

/** Approximate thickness of a complete magazine, in metres. */
const BLOCK_DEPTH = 0.0025;

/** Air gap between a scan plane and its page block: enough for depth safety. */
const PAGE_BLOCK_GAP = 0.00008;

/** Keeps cover planes just clear of the paper block without a visible air gap. */
const COVER_DEPTH_OFFSET = BLOCK_DEPTH + PAGE_BLOCK_GAP + 0.00005;

/** Prevents the paper blocks from winning the depth test over the cover spine. */
const SPINE_DEPTH_BLEED = 0.00004;

/** Tilt of the magazine toward a seated reader, when it stands in world space. */
const MAGAZINE_PITCH = 0.35;

/**
 * Pitch used when the magazine is held on a controller.
 *
 * A right angle would lay the spread perfectly flat on the hand; backing off
 * ~20 degrees from that angles it toward the face, so the reader can look down
 * at it with a relaxed wrist instead of rolling the controller inward.
 */
const HELD_PITCH = Math.PI / 2 - 0.35;

/**
 * Creates the magazine node tree.
 *
 * @param {import('@babylonjs/core/scene').Scene} scene
 * @returns {Object}
 */
export function createMagazineMesh(scene, { onTextureError } = {}) {
  let disposed = false;
  const root = new TransformNode('MagazineRoot', scene);
  // Placeholder pose only. The real placement happens in recenter() once the
  // XR camera reports an actual head position, because whether y=0 means the
  // floor or eye level depends on which reference space the device granted.
  root.position = new Vector3(0, MAGAZINE_HEIGHT, MAGAZINE_DISTANCE);
  root.rotation = new Vector3(MAGAZINE_PITCH, 0, 0);

  const leftPage = MeshBuilder.CreatePlane(
    'LeftStaticPage',
    { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    scene
  );
  leftPage.parent = root;
  leftPage.position = new Vector3(-PAGE_WIDTH / 2, 0, 0);

  const rightPage = MeshBuilder.CreatePlane(
    'RightStaticPage',
    { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    scene
  );
  rightPage.parent = root;
  rightPage.position = new Vector3(PAGE_WIDTH / 2, 0, 0);

  // Both outside covers are independent from the currently displayed spread.
  // Otherwise advancing past the first spread replaces the cover texture and
  // leaves the physical outside of the issue as an anonymous grey page block.
  const frontCoverPage = MeshBuilder.CreatePlane(
    'FrontCoverPage',
    { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    scene
  );
  frontCoverPage.parent = root;
  frontCoverPage.position = new Vector3(PAGE_WIDTH / 2, 0, -0.00005);
  frontCoverPage.isPickable = false;
  frontCoverPage.setEnabled(false);

  const backCoverPage = MeshBuilder.CreatePlane(
    'BackCoverPage',
    { width: PAGE_WIDTH, height: PAGE_HEIGHT },
    scene
  );
  backCoverPage.parent = root;
  backCoverPage.position = new Vector3(
    PAGE_WIDTH / 2,
    0,
    COVER_DEPTH_OFFSET
  );
  backCoverPage.rotation.y = Math.PI;
  backCoverPage.isPickable = false;
  backCoverPage.setEnabled(false);

  const fallbackTexture = RawTexture.CreateRGBATexture(
    new Uint8Array([199, 196, 189, 255]),
    1,
    1,
    scene,
    false,
    false,
    Texture.NEAREST_SAMPLINGMODE
  );
  const fallbackAsset = {
    url: '__paper__',
    texture: fallbackTexture,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT
  };
  const leftSurface = createPageSurfaceMaterial(
    'LeftPageMaterial',
    scene,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    fallbackTexture
  );
  const rightSurface = createPageSurfaceMaterial(
    'RightPageMaterial',
    scene,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    fallbackTexture
  );
  const frontCoverSurface = createPageSurfaceMaterial(
    'FrontCoverMaterial',
    scene,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    fallbackTexture
  );
  const backCoverSurface = createPageSurfaceMaterial(
    'BackCoverMaterial',
    scene,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    fallbackTexture
  );
  leftPage.material = leftSurface.material;
  rightPage.material = rightSurface.material;
  frontCoverPage.material = frontCoverSurface.material;
  backCoverPage.material = backCoverSurface.material;
  // Cover planes show only their physical outside. Their reverse side must
  // not bleed through the page block while the issue is open.
  frontCoverSurface.material.backFaceCulling = true;
  backCoverSurface.material.backFaceCulling = true;

  const leftBlockSurface = createPageBlockEdgeMaterial(
    'LeftPageBlockMaterial',
    scene,
    fallbackTexture,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    BLOCK_DEPTH,
    'left'
  );
  const rightBlockSurface = createPageBlockEdgeMaterial(
    'RightPageBlockMaterial',
    scene,
    fallbackTexture,
    PAGE_WIDTH,
    PAGE_HEIGHT,
    BLOCK_DEPTH,
    'right'
  );

  // Slabs behind each half suggest the bulk of the remaining pages.
  const createBlock = (name, sign, material) => {
    // Slightly inset so the slab can never fringe past the page it backs.
    const block = MeshBuilder.CreateBox(
      name,
      { width: PAGE_WIDTH * 0.9995, height: PAGE_HEIGHT * 0.999, depth: BLOCK_DEPTH },
      scene
    );
    block.parent = root;
    // Almost touching the scan plane. The sub-tenth-millimetre clearance is
    // enough for depth safety while keeping the sheets visually compressed.
    block.position = new Vector3(
      (sign * PAGE_WIDTH) / 2,
      0,
      BLOCK_DEPTH / 2 + PAGE_BLOCK_GAP
    );

    block.material = material;

    return block;
  };

  const leftBlock = createBlock('LeftPageBlock', -1, leftBlockSurface.material);
  const rightBlock = createBlock('RightPageBlock', 1, rightBlockSurface.material);


  const spine = MeshBuilder.CreateBox(
    'Spine',
    {
      width: 0.00025,
      height: PAGE_HEIGHT * 0.999,
      depth: BLOCK_DEPTH + SPINE_DEPTH_BLEED * 2
    },
    scene
  );
  spine.parent = root;
  spine.position = new Vector3(0, 0, BLOCK_DEPTH / 2 + PAGE_BLOCK_GAP);

  const spineSurface = createCoverEdgeSpineMaterial(scene, fallbackTexture);
  spine.material = spineSurface.material;

  /** Rolling GPU window: current spread, two neighbours, covers and turn faces. */
  const textureCache = new Map();
  const activeAssets = new Map();
  const pinnedAssets = new Set();
  const MAX_TEXTURES = 10;
  // A cold image-proxy request may need Archive to generate the requested
  // BookReader leaf before it can be cached. Measurements on real issues are
  // commonly above the old blanket 8s limit, so the primary CORS candidate
  // gets enough time to finish. Later candidates remain fail-fast because
  // they are fallbacks, and page-turn animation never awaits this timer.
  const PRIMARY_TEXTURE_TIMEOUT_MS = 45000;
  const FALLBACK_TEXTURE_TIMEOUT_MS = 8000;

  /** Current held pitch, adjustable in-session so it can be tuned on-device. */
  let heldPitch = HELD_PITCH;
  let closedState = false;
  let leftSlotVisible = true;
  let rightSlotVisible = true;
  let frontCoverReady = false;

  const applyPageVisibility = () => {
    leftPage.setEnabled(!closedState && leftSlotVisible);
    rightPage.setEnabled(rightSlotVisible);
    leftBlock.setEnabled(!closedState && leftSlotVisible);
    rightBlock.setEnabled(rightSlotVisible);
    spine.setEnabled(!closedState && (leftSlotVisible || rightSlotVisible));
    frontCoverPage.setEnabled(frontCoverReady);
  };

  /** Evicts least-recently-used assets that are not visible. */
  const evictUnusedTextures = () => {
    if (textureCache.size <= MAX_TEXTURES) {
      return;
    }

    const protectedAssets = new Set([...activeAssets.values(), ...pinnedAssets]);
    for (const [url, entry] of textureCache) {
      if (textureCache.size <= MAX_TEXTURES) {
        break;
      }
      if (!protectedAssets.has(entry.asset) && entry.asset) {
        entry.asset.texture.dispose();
        textureCache.delete(url);
      }
    }
  };

  /** Loads a page into the small session-local GPU cache. */
  const loadPageAsset = (page) => {
    if (!page?.url) {
      return Promise.resolve(fallbackAsset);
    }

    const candidates = Array.from(
      new Set([page.url, ...(page.fallbackUrls ?? [])].filter(Boolean))
    );
    // Candidate preference can change after network prefetch discovers a
    // working fallback. Sorting keeps that from creating a duplicate texture.
    const cacheKey = [...candidates].sort().join('|');
    const cached = textureCache.get(cacheKey);
    if (cached) {
      // Reinsertion makes Map order an inexpensive LRU approximation.
      textureCache.delete(cacheKey);
      textureCache.set(cacheKey, cached);
      return cached.promise;
    }

    const entry = { asset: null, promise: null };
    const tryCandidate = (candidateIndex) =>
      new Promise((resolve, reject) => {
        const url = candidates[candidateIndex];
        let completed = false;
        let texture;

        const fail = (message) => {
          if (completed) return;
          completed = true;
          window.clearTimeout(timeout);
          texture?.dispose();

          if (candidateIndex + 1 < candidates.length && !disposed) {
            tryCandidate(candidateIndex + 1).then(resolve, reject);
          } else {
            reject(new Error(message || `Failed to create texture: ${url}`));
          }
        };

        const timeoutMs = candidateIndex === 0
          ? PRIMARY_TEXTURE_TIMEOUT_MS
          : FALLBACK_TEXTURE_TIMEOUT_MS;
        const timeout = window.setTimeout(
          () => fail(`Timed out after ${timeoutMs}ms while loading page texture: ${url}`),
          timeoutMs
        );

        texture = new Texture(
          url,
          scene,
          false,
          true,
          Texture.TRILINEAR_SAMPLINGMODE,
          () => {
            if (completed) {
              texture.dispose();
              return;
            }
            if (disposed) {
              fail('Magazine mesh was disposed while loading a texture');
              return;
            }

            completed = true;
            window.clearTimeout(timeout);
            texture.wrapU = Texture.CLAMP_ADDRESSMODE;
            texture.wrapV = Texture.CLAMP_ADDRESSMODE;
            texture.anisotropicFilteringLevel = 4;
            console.info(`[XR] page texture loaded: ${url}`);
            resolve({
              url,
              texture,
              width: page.width,
              height: page.height
            });
          },
          (message) => fail(message)
        );
      });

    entry.promise = tryCandidate(0)
      .then((asset) => {
        entry.asset = asset;
        evictUnusedTextures();
        return asset;
      })
      .catch((err) => {
        if (textureCache.get(cacheKey) === entry) {
          textureCache.delete(cacheKey);
        }
        onTextureError?.(null, candidates.join(' -> '), String(err));
        throw err;
      });
    textureCache.set(cacheKey, entry);
    return entry.promise;
  };

  /** Atomically replaces both visible pages after every new asset is ready. */
  const setPageAssets = ({
    left,
    right,
    hasLeft = !!left,
    hasRight = !!right,
    isCover = false
  }) => {
    leftSurface.setAsset(left ?? fallbackAsset);
    rightSurface.setAsset(right ?? fallbackAsset);
    // A closed cover still encloses a neutral paper block. Interior spreads
    // contribute only a subtle tint from their corresponding cut edge.
    leftBlockSurface.setAsset(!isCover && hasLeft ? left : null);
    rightBlockSurface.setAsset(!isCover && hasRight ? right : null);
    leftSlotVisible = hasLeft;
    rightSlotVisible = hasRight;

    if (left) activeAssets.set('left', left);
    else activeAssets.delete('left');
    if (right) activeAssets.set('right', right);
    else activeAssets.delete('right');

    applyPageVisibility();
    evictUnusedTextures();
  };

  const setBackCoverAsset = (asset) => {
    if (!asset) {
      activeAssets.delete('backCover');
      spineSurface.setBackAsset(null);
      leftBlockSurface.setBackAsset(null);
      rightBlockSurface.setBackAsset(null);
      backCoverPage.setEnabled(false);
      return;
    }

    backCoverSurface.setAsset(asset);
    spineSurface.setBackAsset(asset);
    leftBlockSurface.setBackAsset(asset);
    rightBlockSurface.setBackAsset(asset);
    activeAssets.set('backCover', asset);
    backCoverPage.setEnabled(true);
    evictUnusedTextures();
  };

  const setFrontCoverAsset = (asset) => {
    frontCoverReady = !!asset;
    if (!asset) {
      activeAssets.delete('frontCover');
      spineSurface.setFrontAsset(null);
      leftBlockSurface.setFrontAsset(null);
      rightBlockSurface.setFrontAsset(null);
      applyPageVisibility();
      return;
    }

    frontCoverSurface.setAsset(asset);
    spineSurface.setFrontAsset(asset);
    leftBlockSurface.setFrontAsset(asset);
    rightBlockSurface.setFrontAsset(asset);
    activeAssets.set('frontCover', asset);
    applyPageVisibility();
    evictUnusedTextures();
  };

  /**
   * Switches between a closed magazine (cover only) and an open
   * spread. A closed issue shows one page on the spine's axis rather than a
   * spread with a blank half, which is what a magazine on a table looks like.
   *
   * @param {boolean} closed
   */
  const setClosed = (closed) => {
    // The cover occupies the right half so it shares the same spine pivot as
    // the active turning mesh.
    closedState = closed;
    rightPage.position.x = PAGE_WIDTH / 2;

    // Closed: front outside lies on top of the right-hand stack. Open: it is
    // folded under the left-hand stack, where it remains visible when the
    // whole magazine is turned over, regardless of the current spread.
    frontCoverPage.position.set(
      closed ? PAGE_WIDTH / 2 : -PAGE_WIDTH / 2,
      0,
      closed ? -0.00005 : COVER_DEPTH_OFFSET
    );
    frontCoverPage.rotation.y = closed ? 0 : Math.PI;

    // The closed issue reads as a single stack rather than two facing halves.
    rightBlock.position.x = PAGE_WIDTH / 2;
    applyPageVisibility();
  };

  /**
   * Places the magazine an arm's length in front of wherever the reader is
   * actually looking.
   *
   * Anchoring to the live camera pose rather than to fixed world coordinates
   * keeps the placement correct whether the device granted 'local-floor'
   * (origin on the floor) or fell back to 'local' (origin at head height).
   *
   * Yaw is taken from the camera but pitch and roll are discarded, so the
   * magazine stays upright even if the reader tilts their head.
   *
   * @param {import('@babylonjs/core/Cameras/camera').Camera} camera
   */
  const recenter = (camera) => {
    if (!camera) {
      return;
    }

    const head = camera.globalPosition ?? camera.position;
    const forward = camera.getDirection(Vector3.Forward());

    // Flatten to the horizontal plane so looking up or down does not push the
    // magazine into the floor or the ceiling.
    const flat = new Vector3(forward.x, 0, forward.z);

    if (flat.lengthSquared() < 1e-6) {
      // Looking straight up or down; keep whatever facing we already had.
      flat.set(0, 0, 1);
    }

    flat.normalize();

    root.position.set(
      head.x + flat.x * MAGAZINE_DISTANCE,
      // Slightly below eye level: a magazine is held down, not at the horizon.
      head.y - 0.18,
      head.z + flat.z * MAGAZINE_DISTANCE
    );

    root.rotation.set(MAGAZINE_PITCH, Math.atan2(flat.x, flat.z), 0);
  };

  /**
   * Rigidly attaches the magazine to a controller's grip, so it moves with the
   * reader's hand like a physical issue being held.
   *
   * Parenting to the grip transform means Babylon applies the controller pose
   * for us every frame; there is no per-frame work here.
   *
   * @param {import('@babylonjs/core/Meshes/abstractMesh').AbstractMesh | null} grip
   */
  const attachToGrip = (grip) => {
    if (!grip) {
      return false;
    }

    root.parent = grip;
    // Sit above and slightly forward of the fist, roughly where a held
    // magazine ends up.
    root.position.set(0, 0.06, 0.16);
    // The grip's +Z runs forward along the controller handle, which would
    // leave the pages standing upright against the forearm and force the
    // wrist to roll inward to read them. Laying them back by a little under a
    // right angle puts the spread face-up on the hand, the way a magazine
    // actually rests, tilted just enough to face the reader.
    root.rotation.set(heldPitch, 0, 0);
    return true;
  };

  /**
   * Nudges the held tilt. Positive lays the magazine flatter, negative stands
   * it up toward the reader.
   *
   * @param {number} deltaRadians
   * @returns {number} The applied pitch.
   */
  const adjustHeldPitch = (deltaRadians) => {
    // Clamped short of flat and short of vertical: past either the pages face
    // away from the reader entirely.
    heldPitch = Math.min(Math.max(heldPitch + deltaRadians, 0.2), Math.PI / 2);

    if (root.parent) {
      root.rotation.set(heldPitch, 0, 0);
    }

    return heldPitch;
  };

  /** Releases the magazine back into world space at its current pose. */
  const detachFromGrip = () => {
    if (root.parent) {
      // Preserve the on-screen pose rather than snapping back to the origin.
      const world = root.getWorldMatrix().clone();
      root.parent = null;
      root.setPreTransformMatrix?.(world);
    }
  };

  const dispose = () => {
    disposed = true;
    for (const entry of textureCache.values()) {
      entry.asset?.texture.dispose();
    }
    textureCache.clear();
    activeAssets.clear();
    pinnedAssets.clear();

    leftSurface.dispose();
    rightSurface.dispose();
    frontCoverSurface.dispose();
    backCoverSurface.dispose();
    leftBlockSurface.dispose();
    rightBlockSurface.dispose();
    fallbackTexture.dispose();
    spineSurface.dispose();
    leftPage.dispose();
    rightPage.dispose();
    frontCoverPage.dispose();
    backCoverPage.dispose();
    leftBlock.dispose();
    rightBlock.dispose();
    spine.dispose();
    root.dispose();
  };

  return {
    root,
    leftPage,
    rightPage,
    frontCoverPage,
    backCoverPage,
    leftBlock,
    rightBlock,
    spine,
    loadPageAsset,
    setPageAssets,
    setFrontCoverAsset,
    setBackCoverAsset,
    fallbackAsset,

    /**
     * The texture currently bound to a side, so the turning sheet can borrow
     * it as its front or back face instead of loading a second copy.
     *
     * @param {'left' | 'right'} side
     */
    getPageAsset(side) {
      return activeAssets.get(side) ?? fallbackAsset;
    },

    /** Assets bound to the flat spread, preserving an actually empty side. */
    getPageAssets() {
      return {
        left: activeAssets.get('left') ?? null,
        right: activeAssets.get('right') ?? null
      };
    },

    /** Prevents the two faces of an in-flight sheet from being LRU-evicted. */
    pinPageAssets(...assets) {
      pinnedAssets.clear();
      for (const asset of assets) {
        if (asset) pinnedAssets.add(asset);
      }
    },

    clearPinnedPageAssets() {
      pinnedAssets.clear();
      evictUnusedTextures();
    },


    setClosed,
    recenter,
    attachToGrip,
    detachFromGrip,
    adjustHeldPitch,
    dispose
  };
}
