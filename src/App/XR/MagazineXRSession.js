/**
 * Owns the lifetime of one immersive session: canvas, engine, XR helper,
 * input wiring and teardown.
 *
 * This module is only ever reached through a dynamic import, so importing it
 * is what pulls Babylon.js into a lazily-loaded chunk.
 */

import { WebXRDefaultExperience } from '@babylonjs/core/XR/webXRDefaultExperience';
import { WebXRState } from '@babylonjs/core/XR/webXRTypes';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';

import { createXRScene } from './scene/createXRScene';
import { createMagazineMesh, PAGE_HEIGHT, PAGE_WIDTH } from './scene/MagazineMesh';
import { createReadingPageMesh } from './scene/ReadingPageMesh';
import { getAdjacentReadingLeaf } from './scene/readingModeLayout';
import { createPageTurnController } from './page-turn/PageTurnController';
import { prefersReducedData } from './xrSupport';
import { pointerDragToProgress } from './page-turn/pageTurnPhysics';
import {
  getSpreadCount,
  getTurnLeaves,
  getTurnUnderlayLeaves,
  leafToSpread,
  spreadToLeaf,
  spreadToLeaves
} from '../Components/SpreadMapping';

/**
 * Starts an immersive session for a publication.
 *
 * @param {Object} params
 * @param {import('./MagazineXRSourceAdapter').MagazineXRSource} params.source
 * @param {'immersive-vr' | 'immersive-ar'} [params.mode]
 * @param {(event: string, detail?: any) => void} [params.onEvent]
 * @param {(detail: {reason: string, spread: number}) => void} [params.onEnded]
 * @returns {Promise<{ end: () => Promise<void>, dispose: () => void }>}
 */
export async function startMagazineXRSession({
  source,
  onEvent,
  onEnded,
  mode = 'immersive-vr'
}) {
  const emit = (event, detail) => {
    try {
      onEvent?.(event, detail);
    } catch (err) {
      // Telemetry must never break a live session.
    }
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'xrCanvas';
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '2147483000';
  canvas.style.touchAction = 'none';
  canvas.style.outline = 'none';
  document.body.appendChild(canvas);

  const { engine, scene, dispose: disposeScene } = createXRScene(canvas);
  const magazine = createMagazineMesh(scene, {
    onTextureError: (side, url, message) => {
      emit('xr_texture_load_failed', { side, url, message });
      // Surfaced in the console because there is no way to read a toast from
      // inside a headset.
      console.error(`[XR] page texture failed (${side}): ${url}`, message);
    }
  });

  // The animated sheet lives under the magazine root so it inherits the held
  // pose without any per-frame transform work.
  const pageTurn = createPageTurnController(scene, {
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    onCommit: (turnDirection) => {
      commitTurn(turnDirection);
    },
    onSettled: (committed) => {
      if (!committed) {
        window.clearTimeout(turnWatchdog);
        restorePreparedTurn();
        preparedTurn = null;
        turning = false;
        pointerTurn = null;
      }
    }
  });
  pageTurn.node.parent = magazine.root;
  const readingPage = createReadingPageMesh(scene, magazine.fallbackAsset);

  const spreadCount = getSpreadCount(source.pageCount);
  let currentSpread = leafToSpread(source.initialPageIndex, source.pageCount);
  let disposed = false;
  let exitRequested = false;
  let sessionEndedNotified = false;
  let sessionHasStarted = false;
  let secondaryHold = null;
  const buttonStates = new Map();

  /** Guards against a turn being issued while textures are still swapping. */
  let turning = false;

  /** Fallback timer so a stalled animation cannot wedge the guard forever. */
  let turnWatchdog = 0;
  const TURN_TIMEOUT_MS = 2000;

  /** Active right-controller drag, including an asynchronous texture prepare. */
  let pointerTurn = null;

  /** Active isolated reading page, or null while browsing the spread. */
  let readingMode = null;
  let readingGeneration = 0;
  let readingManipulation = null;
  let readingNavigation = null;
  let readingStickLatched = false;

  /** Set when the magazine still needs placing against a real head pose. */
  let pendingRecenter = false;

  /** True while the magazine is parented to the left controller. */
  let heldInHand = true;

  /** How long to wait for a left controller before placing in world space. */
  const CONTROLLER_WAIT_MS = 3000;
  let sessionStartedAt = Date.now();

  /**
   * Parents the magazine to the left controller's grip, if one is present.
   *
   * @returns {boolean} Whether a left grip was found.
   */
  /** Logged once so a missing controller is visible without spamming frames. */
  let loggedControllers = false;

  const attachMagazineToLeftHand = () => {
    const controllers = xrExperience.input.controllers;

    if (!loggedControllers && controllers.length > 0) {
      loggedControllers = true;
      console.info(
        `[XR] controllers: ${controllers
          .map((c) => `${c.inputSource?.handedness ?? '?'}(grip=${!!c.grip})`)
          .join(', ')}`
      );
    }

    for (const controller of controllers) {
      if (controller.inputSource?.handedness !== 'left') {
        continue;
      }

      // grip is absent until the controller reports a pose; caller retries.
      if (magazine.attachToGrip(controller.grip ?? controller.pointer)) {
        return true;
      }
    }

    return false;
  };

  const loadLeafAsset = async (side, leaf, quality) => {
    if (leaf === null) {
      return null;
    }

    try {
      const page = await source.getPage(leaf, quality);
      return disposed ? null : await magazine.loadPageAsset(page);
    } catch (err) {
      if (!disposed) {
        emit('xr_texture_load_failed', { side, leaf, quality, reason: String(err) });
      }
      return null;
    }
  };

  const loadSpreadAssets = async (spreadIndex, quality = 'magazine') => {
    const { left, right, isCover } = spreadToLeaves(spreadIndex, source.pageCount);
    const [leftAsset, rightAsset] = await Promise.all([
      loadLeafAsset('left', left, quality),
      loadLeafAsset('right', right, quality)
    ]);

    return {
      left: leftAsset,
      right: rightAsset,
      hasLeft: left !== null,
      hasRight: right !== null,
      isCover
    };
  };

  const leavesForSpreads = (spreadIndices) => Array.from(
    new Set(
      spreadIndices.flatMap((index) => {
        const { left, right } = spreadToLeaves(index, source.pageCount);
        return [left, right].filter((leaf) => leaf !== null);
      })
    )
  );

  /** Keeps the two immediately reachable spreads decoded in the rolling GPU window. */
  const warmNeighbourSpreads = (spreadIndex) => {
    const neighbours = [spreadIndex - 1, spreadIndex + 1].filter(
      (index) => index >= 0 && index < spreadCount
    );

    source.prefetchPages?.(
      leavesForSpreads(neighbours),
      'magazine',
      { priority: true }
    ).catch(() => undefined);

    return Promise.all(
      neighbours.map((index) => loadSpreadAssets(index, 'magazine').catch(() => null))
    );
  };

  /**
   * Orders spreads outwards from the current one for background download: the
   * whole issue normally, only a small window when the user asked to save data
   * or the connection is slow (page turns still warm their neighbours).
   */
  const REDUCED_DATA_PREFETCH_DISTANCE = 2;
  const getBackgroundPrefetchOrder = (centreSpread) => {
    const orderedSpreads = [];
    const maxDistance = prefersReducedData()
      ? Math.min(REDUCED_DATA_PREFETCH_DISTANCE + 1, spreadCount)
      : spreadCount;
    for (let distance = 0; distance < maxDistance; distance += 1) {
      const forward = centreSpread + distance;
      const backward = centreSpread - distance;
      if (forward >= 0 && forward < spreadCount) orderedSpreads.push(forward);
      if (distance > 0 && backward >= 0) orderedSpreads.push(backward);
    }
    return leavesForSpreads(orderedSpreads);
  };

  let renderGeneration = 0;
  const renderSpread = async (spreadIndex, { showPreview = true } = {}) => {
    const generation = ++renderGeneration;
    const spread = spreadToLeaves(spreadIndex, source.pageCount);

    // Cover/open geometry is publication state, not texture state. Apply it
    // immediately so a slow or missing scan can never show the wrong shape.
    magazine.setClosed(spread.isCover);
    if (showPreview) {
      const previewAssets = await loadSpreadAssets(spreadIndex, 'preview');

      if (disposed || generation !== renderGeneration) return;

      // Show a small scan quickly. The high-resolution replacement below is a
      // second atomic swap and never blocks entering XR or grabbing a page.
      magazine.setPageAssets(previewAssets);
    }

    // Decode only the two reachable spreads. The remainder is downloaded to
    // the browser cache without occupying GPU memory.
    warmNeighbourSpreads(spreadIndex).catch(() => undefined);
    const magazineAssets = await loadSpreadAssets(spreadIndex, 'magazine');

    if (disposed || generation !== renderGeneration) {
      return;
    }

    magazine.setPageAssets(magazineAssets);
    magazine.setClosed(magazineAssets.isCover);

    // Network prefetch and GPU warming are separate: the source retains only
    // compressed HTTP responses, while this rolling window owns decoded scans.
  };

  /** Loads one outside cover without waiting for the opposite cover. */
  const renderOutsideCover = async (side, leaf, setAsset) => {
    const preview = await loadLeafAsset(side, leaf, 'preview');
    if (disposed) return;
    setAsset(preview);

    const detailed = await loadLeafAsset(side, leaf, 'magazine');
    if (disposed) return;
    setAsset(detailed ?? preview);
  };

  /** Keeps both physical covers independent from the changing spread. */
  const renderOutsideCovers = () => {
    if (source.pageCount <= 0) {
      magazine.setFrontCoverAsset(null);
      magazine.setBackCoverAsset(null);
      return Promise.resolve();
    }

    // Do not couple these promises: a slow/missing final scan must never
    // prevent the already available front cover from becoming persistent.
    return Promise.allSettled([
      renderOutsideCover('front-cover', 0, magazine.setFrontCoverAsset),
      renderOutsideCover(
        'back-cover',
        source.pageCount - 1,
        magazine.setBackCoverAsset
      )
    ]);
  };

  /** Target spread staged in GPU memory for the active turn transaction. */
  let preparedTurn = null;

  /** Restores the exact spread that was visible before a cancelled gesture. */
  const restorePreparedTurn = () => {
    if (!preparedTurn?.previousAssets) {
      return;
    }

    magazine.setPageAssets(preparedTurn.previousAssets);
    magazine.setClosed(preparedTurn.previousAssets.isCover);
    magazine.clearPinnedPageAssets();
    // Keep the restored scan visible while refreshing it; never downgrade it
    // to a preview merely because a gesture was cancelled.
    renderSpread(currentSpread, { showPreview: false }).catch(() => undefined);
  };

  /** Swaps the spread under the sheet once an animated turn has landed. */
  const commitTurn = async (turnDirection) => {
    window.clearTimeout(turnWatchdog);

    const clamped = Math.min(
      Math.max(currentSpread + turnDirection, 0),
      Math.max(spreadCount - 1, 0)
    );

    if (clamped === currentSpread) {
      magazine.clearPinnedPageAssets();
      turning = false;
      pointerTurn = null;
      return;
    }

    currentSpread = clamped;

    try {
      if (preparedTurn?.spreadIndex === currentSpread) {
        // Invalidate any older background render before this atomic commit.
        renderGeneration += 1;
        magazine.setPageAssets(preparedTurn.assets);
        magazine.setClosed(preparedTurn.assets.isCover);
        magazine.clearPinnedPageAssets();
        renderSpread(currentSpread, {
          showPreview: preparedTurn.quality !== 'magazine'
        }).catch(() => undefined);
      } else {
        await renderSpread(currentSpread);
      }
      // Commit exactly once, after the spread is actually on screen.
      source.setCurrentPage(spreadToLeaf(currentSpread, source.pageCount));
      emit('xr_page_turned', { spread: currentSpread });
    } finally {
      magazine.clearPinnedPageAssets();
      preparedTurn = null;
      turning = false;
      pointerTurn = null;
    }
  };

  /**
   * Starts an animated turn, if one is not already running and the issue has
   * somewhere to go in that direction.
   *
   * @param {number} turnDirection +1 forward, -1 backward
   */
  const armTurnWatchdog = () => {
    window.clearTimeout(turnWatchdog);
    turnWatchdog = window.setTimeout(() => {
      if (!turning || !pageTurn.isBusy) {
        return;
      }

      const commit = pageTurn.state === 'settling-forward';
      const direction = pointerTurn?.direction ?? 1;
      console.warn(`[XR] turn watchdog fired; ${commit ? 'committing' : 'cancelling'}`);
      pageTurn.cancel();

      if (commit) {
        commitTurn(direction);
      } else {
        restorePreparedTurn();
        preparedTurn = null;
        turning = false;
        pointerTurn = null;
      }
    }, TURN_TIMEOUT_MS);
  };

  const startTurn = (turnDirection, grab) => {
    if (disposed) {
      return false;
    }

    if (turning || pageTurn.isBusy) {
      console.info(
        `[XR] turn ignored: turning=${turning}, sheetState=${pageTurn.state}`
      );
      return false;
    }

    const target = currentSpread + turnDirection;
    if (target < 0 || target > spreadCount - 1) {
      console.info(`[XR] at issue boundary, spread ${currentSpread}/${spreadCount - 1}`);
      return false;
    }

    turning = true;
    // Freeze background preview/high-resolution swaps for the duration of the
    // physical transaction. Otherwise a late network response can replace the
    // underlay while the sheet is in flight.
    renderGeneration += 1;
    const current = spreadToLeaves(currentSpread, source.pageCount);
    const currentVisible = magazine.getPageAssets();
    const previousAssets = {
      left: current.left === null ? null : currentVisible.left ?? magazine.fallbackAsset,
      right: current.right === null ? null : currentVisible.right ?? magazine.fallbackAsset,
      hasLeft: current.left !== null,
      hasRight: current.right !== null,
      isCover: current.isCover
    };
    const targetDefinition = spreadToLeaves(target, source.pageCount);
    const fallbackTargetAssets = {
      left: targetDefinition.left === null ? null : magazine.fallbackAsset,
      right: targetDefinition.right === null ? null : magazine.fallbackAsset,
      hasLeft: targetDefinition.left !== null,
      hasRight: targetDefinition.right !== null,
      isCover: targetDefinition.isCover
    };
    const turnLeaves = getTurnLeaves(currentSpread, source.pageCount, turnDirection);
    const underlayLeaves = getTurnUnderlayLeaves(
      currentSpread,
      source.pageCount,
      turnDirection
    );
    const targetLeaves = spreadToLeaves(target, source.pageCount);
    const frontAsset = turnLeaves.front === current.left
      ? previousAssets.left
      : previousAssets.right;
    const transaction = {
      spreadIndex: target,
      assets: fallbackTargetAssets,
      previousAssets,
      underlayAssets: null,
      quality: 'fallback'
    };
    preparedTurn = transaction;

    const qualityRank = { fallback: 0, preview: 1, magazine: 2 };

    /** Atomically updates the moving back face and the flat sheet underneath. */
    const applyTargetAssets = (targetAssets, quality = 'fallback') => {
      if (disposed || preparedTurn !== transaction) {
        return;
      }
      if (qualityRank[quality] < qualityRank[transaction.quality]) return;

      const backAsset = turnLeaves.back === targetLeaves.left
        ? targetAssets.left
        : targetAssets.right;
      const underlayAssets = {
        left: underlayLeaves.left === current.left
          ? previousAssets.left
          : targetAssets.left,
        right: underlayLeaves.right === current.right
          ? previousAssets.right
          : targetAssets.right,
        hasLeft: underlayLeaves.left !== null,
        hasRight: underlayLeaves.right !== null,
        // A cover transition must remain physically open until the moving
        // cover lands; closing now would hide half the underlay in flight.
        isCover: false
      };

      transaction.assets = targetAssets;
      transaction.underlayAssets = underlayAssets;
      transaction.quality = quality;
      pageTurn.setTextures(
        frontAsset ?? magazine.fallbackAsset,
        backAsset ?? magazine.fallbackAsset
      );
      magazine.pinPageAssets(
        frontAsset ?? magazine.fallbackAsset,
        backAsset ?? magazine.fallbackAsset
      );
      magazine.setPageAssets(underlayAssets);
      magazine.setClosed(false);
    };

    pageTurn.setProfile(current.isCover || targetDefinition.isCover);
    // Grabbing must deform on the same frame as the trigger press. Start with
    // neutral paper if the prefetched reverse scan has not arrived yet, then
    // replace it in-place without resetting progress or velocity.
    applyTargetAssets(fallbackTargetAssets, 'fallback');

    const started = pageTurn.begin(turnDirection, grab.u, grab.v);

    if (!started) {
      restorePreparedTurn();
      preparedTurn = null;
      turning = false;
      return false;
    }

    const targetLeafIndices = leavesForSpreads([target]);
    source.prefetchPages?.(targetLeafIndices, 'magazine', { priority: true })
      .catch(() => undefined);

    // Preview wins over neutral paper if it arrives first, but can never
    // overwrite a magazine-quality target that was already warmed.
    loadSpreadAssets(target, 'preview')
      .then((assets) => applyTargetAssets(assets, 'preview'))
      .catch(() => undefined);
    loadSpreadAssets(target, 'magazine')
      .then((assets) => applyTargetAssets(assets, 'magazine'))
      .catch(() => undefined);

    return true;
  };

  // Never wait for network or GPU texture upload before requesting the XR
  // session. WebXR only allows requestSession during a short-lived user
  // activation. The neutral paper placeholders render until this finishes.
  renderSpread(currentSpread).catch((err) => {
    if (!disposed) {
      emit('xr_texture_load_failed', { reason: String(err) });
      console.error('[XR] initial spread failed to render', err);
    }
  });
  let backgroundPrefetchStarted = false;
  const startBackgroundPrefetch = () => {
    if (disposed || backgroundPrefetchStarted) return;
    backgroundPrefetchStarted = true;

    const nearbySpreads = [currentSpread, currentSpread + 1, currentSpread - 1]
      .filter((index) => index >= 0 && index < spreadCount);
    const currentLeaves = leavesForSpreads([currentSpread]);
    // Fill the immediately reachable magazine window first, then prepare fine
    // print for the current spread before continuing through the whole issue.
    source.prefetchPages?.(
      leavesForSpreads(nearbySpreads),
      'magazine',
      { priority: true }
    ).catch(() => undefined);
    source.prefetchPages?.(currentLeaves, 'reading', { priority: true })
      .catch(() => undefined);
    source.prefetchPages?.(getBackgroundPrefetchOrder(currentSpread), 'magazine')
      .then(() => emit('xr_magazine_prefetch_complete'))
      .catch(() => undefined);
  };
  renderOutsideCovers().catch((err) => {
    if (!disposed) {
      emit('xr_texture_load_failed', { side: 'outside-covers', reason: String(err) });
    }
  });

  const observers = [];
  let nativeXrSession = null;
  let onNativeSelectStart = null;
  let onNativeSelectEnd = null;
  let onNativeSqueezeStart = null;
  let onNativeSqueezeEnd = null;
  let stateObserver = null;
  let xrExperience;
  try {
    xrExperience = await WebXRDefaultExperience.CreateAsync(scene, {
      disableTeleportation: true,
      disableDefaultUI: true,
      // Both default features download NodeMaterial JSON from Babylon's
      // servers at session start (near interaction: a snippet from
      // snippet.babylonjs.com; hand tracking: assets.babylonjs.com hand
      // shader). The reader drives input itself from the controllers list and
      // native select/squeeze events, so neither is used, and a failed or
      // incompatible download threw an uncaught error on session start.
      disableNearInteraction: true,
      disableHandTracking: true,
      // Babylon's laser-pointer selection is not used either (page turns are
      // hit-tested against our own rays). In 9.x the default experience imports
      // the feature's side-effect-free module, so it is never registered and
      // CreateAsync logged "feature not found" and skipped the rest of its setup,
      // including the render target.
      disablePointerSelection: true,
      optionalFeatures: false,
      inputOptions: {
        // Controller models are cosmetic here and would otherwise be fetched
        // from controllers.babylonjs.com on every session start, which needs a
        // glTF loader plugin and puts a third-party CDN on the path into VR.
        // Pose and button tracking are unaffected.
        doNotLoadControllerMeshes: true,
        disableOnlineControllerRepository: true
      }
    });
  } catch (err) {
    cleanup();
    throw err;
  }

  if (!xrExperience.baseExperience) {
    cleanup();
    throw new Error('WebXR is unavailable in this browser');
  }

  // Input is polled straight off XRInputSource.gamepad rather than going
  // through Babylon's WebXRMotionController, because motion controllers depend
  // on the online profile repository that we deliberately disabled. The
  // xr-standard mapping: upper trigger=0, lower squeeze/grip=1, A/X=4, B/Y=5.
  // In Reading Mode the upper trigger combines zoom with pan, while the lower
  // squeeze/grip remains a dedicated pan-only gesture.
  const BUTTON_TRIGGER = 0;
  const BUTTON_SQUEEZE = 1;
  const BUTTON_PRIMARY = 4;
  const BUTTON_SECONDARY = 5;

  /** Holding B is deliberate enough to avoid accidentally leaving XR. */
  const SECONDARY_EXIT_HOLD_MS = 1000;

  /** Pulling the controller this many metres closer multiplies zoom by e. */
  const READING_ZOOM_EXPONENT_PER_METRE = 7;

  /** Above this zoom the original scan can improve fine-print legibility. */
  const READING_FULL_ZOOM_THRESHOLD = 3;
  const READING_TEXTURE_TARGET_HEIGHT = 4096;

  /** Makes short hand movements cover a useful part of a zoomed page. */
  const READING_PAN_GAIN = 4.5;

  /** Suppresses normal hand/controller tracking noise while the view is held. */
  const READING_MOTION_DEADZONE = 0.0025;

  const afterReadingDeadzone = (value) => {
    const magnitude = Math.abs(value);
    return magnitude <= READING_MOTION_DEADZONE
      ? 0
      : Math.sign(value) * (magnitude - READING_MOTION_DEADZONE);
  };

  /** Ignore small stick noise so the magazine does not drift while untouched. */
  const STICK_DEADZONE = 0.15;
  const READING_STICK_ACTIVATION = 0.7;
  const READING_STICK_RELEASE = 0.35;

  /** Radians per second of tilt trim at full stick deflection. */
  const PITCH_TRIM_RATE = 1.2;

  const getButtonEdge = (key, index, pressed) => {
    const state = buttonStates.get(key) ?? {};
    const previous = state[index] ?? false;
    state[index] = pressed;
    buttonStates.set(key, state);
    return {
      pressed,
      rose: pressed && !previous,
      fell: !pressed && previous
    };
  };

  const requestImmersiveExit = (reason) => {
    if (disposed || exitRequested) {
      return false;
    }

    exitRequested = true;
    emit('xr_session_exit_requested', { reason, spread: currentSpread });
    xrExperience.baseExperience.exitXRAsync()
      .then(() => finishSession(reason))
      .catch((err) => {
        exitRequested = false;
        emit('xr_session_exit_failed', { reason, message: String(err) });
        console.error('[XR] failed to exit immersive session', err);
      });
    return true;
  };

  const pointerRay = new Ray(Vector3.Zero(), Vector3.Forward(), 3);
  const magazineInverse = Matrix.Identity();
  const localOrigin = Vector3.Zero();
  const localRayEnd = Vector3.Zero();
  const worldRayEnd = Vector3.Zero();
  const localHit = Vector3.Zero();
  const readingDelta = Vector3.Zero();

  const updatePointerRay = (controller) => {
    controller.getWorldPointerRayToRef(pointerRay, false);
    magazine.root.computeWorldMatrix(true).invertToRef(magazineInverse);
    Vector3.TransformCoordinatesToRef(pointerRay.origin, magazineInverse, localOrigin);
    pointerRay.origin.addToRef(pointerRay.direction, worldRayEnd);
    Vector3.TransformCoordinatesToRef(worldRayEnd, magazineInverse, localRayEnd);
  };

  const pickMagazinePage = (controller) => {
    updatePointerRay(controller);
    const pick = scene.pickWithRay(
      pointerRay,
      (mesh) => mesh === magazine.leftPage || mesh === magazine.rightPage,
      false
    );

    if (!pick?.hit || !pick.pickedMesh || !pick.pickedPoint) {
      return null;
    }

    const side = pick.pickedMesh === magazine.leftPage ? 'left' : 'right';
    const spread = spreadToLeaves(currentSpread, source.pageCount);
    const leaf = spread[side];

    return leaf === null ? null : { side, leaf, pick };
  };

  const resetReadingView = ({ emitEvent = true } = {}) => {
    if (!readingMode) return false;

    readingManipulation = null;
    const view = readingPage.setView({ zoom: 1, panX: 0, panY: 0 });
    if (emitEvent) {
      emit('xr_reading_view_reset', { leaf: readingMode.leaf, ...view });
    }
    return true;
  };

  const exitReadingMode = () => {
    if (!readingMode) return false;

    readingGeneration += 1;
    readingManipulation = null;
    readingNavigation = null;
    readingStickLatched = false;
    readingMode = null;
    readingPage.hide();
    magazine.root.setEnabled(true);
    magazine.clearPinnedPageAssets();
    emit('xr_reading_mode_closed', { spread: currentSpread });
    return true;
  };

  const getControllerPosition = (controller) => {
    const node = controller?.grip ?? controller?.pointer;
    if (!node) return null;

    node.computeWorldMatrix(true);
    return node.getAbsolutePosition();
  };

  const beginReadingManipulation = (controller, operation) => {
    if (!readingMode || readingManipulation || readingNavigation) return false;
    if (operation !== 'zoom' && operation !== 'pan') return false;

    const position = getControllerPosition(controller);
    if (!position) return false;

    let zoomAnchor = null;
    if (operation === 'zoom') {
      controller.getWorldPointerRayToRef(pointerRay, false);
      zoomAnchor = readingPage.createZoomAnchor(pointerRay);
      if (zoomAnchor) zoomAnchor.startWorldPoint = zoomAnchor.worldPoint.clone();
    }

    readingManipulation = {
      controller,
      operation,
      startPosition: position.clone(),
      startView: readingPage.getView(),
      axes: readingPage.getInteractionAxes(),
      zoomAnchor
    };
    return true;
  };

  const maybeUpgradeReadingTexture = (view = readingPage.getView()) => {
    const activeReading = readingMode;
    if (
      !activeReading ||
      activeReading.fullRequested ||
      activeReading.fullEligible !== true ||
      view.zoom < READING_FULL_ZOOM_THRESHOLD
    ) {
      return;
    }

    activeReading.fullRequested = true;
    loadLeafAsset('reading-full', activeReading.leaf, 'full')
      .then((asset) => {
        if (!asset || disposed || readingMode !== activeReading) return;

        activeReading.quality = 'full';
        magazine.pinPageAssets(asset);
        readingPage.setAsset(asset);
        emit('xr_reading_quality_changed', {
          leaf: activeReading.leaf,
          quality: 'full',
          zoom: readingPage.getView().zoom
        });
      })
      .catch(() => undefined);
  };

  const updateReadingManipulation = () => {
    if (!readingManipulation || !readingMode) return;

    const current = getControllerPosition(readingManipulation.controller);
    if (!current) return;

    current.subtractToRef(readingManipulation.startPosition, readingDelta);
    const { axes, operation, startView } = readingManipulation;
    const depth = afterReadingDeadzone(Vector3.Dot(readingDelta, axes.forward));
    const horizontal = afterReadingDeadzone(
      Vector3.Dot(readingDelta, axes.right)
    ) * READING_PAN_GAIN;
    const vertical = afterReadingDeadzone(
      Vector3.Dot(readingDelta, axes.up)
    ) * READING_PAN_GAIN;
    const zoom = operation === 'zoom'
      ? startView.zoom * Math.exp(-depth * READING_ZOOM_EXPONENT_PER_METRE)
      : startView.zoom;
    const pans = operation === 'zoom' || operation === 'pan';
    const zoomAnchor = operation === 'zoom' ? readingManipulation.zoomAnchor : null;
    if (zoomAnchor) {
      zoomAnchor.worldPoint.copyFrom(zoomAnchor.startWorldPoint);
      axes.right.scaleAndAddToRef(horizontal, zoomAnchor.worldPoint);
      axes.up.scaleAndAddToRef(vertical, zoomAnchor.worldPoint);
    }

    const view = readingPage.setView({
      zoom,
      panX: pans ? startView.panX + horizontal : startView.panX,
      panY: pans ? startView.panY + vertical : startView.panY
    }, zoomAnchor);
    maybeUpgradeReadingTexture(view);
  };

  const endReadingManipulation = (controller, operation) => {
    if (!readingManipulation || (
      controller && readingManipulation.controller !== controller
    ) || (
      operation && readingManipulation.operation !== operation
    )) {
      return false;
    }

    const completedOperation = readingManipulation.operation;
    readingManipulation = null;
    emit('xr_reading_view_changed', {
      operation: completedOperation,
      ...readingPage.getView()
    });
    return true;
  };

  const startReadingQualityUpgrade = (activeReading) => {
    // The magazine-resolution scan remains visible until the detailed texture
    // is fully decoded and uploaded; a failed upgrade never blanks the page.
    loadLeafAsset('reading', activeReading.leaf, 'reading')
      .then((asset) => {
        if (!asset || disposed || readingMode !== activeReading) return;

        activeReading.fullEligible = Number.isFinite(asset.height)
          ? asset.height > READING_TEXTURE_TARGET_HEIGHT
          : true;
        // A fast original-scan request must not be overwritten by the earlier
        // reading-quality request if their completion order is reversed.
        if (activeReading.quality !== 'full') {
          activeReading.quality = 'reading';
          magazine.pinPageAssets(asset);
          readingPage.setAsset(asset);
          emit('xr_reading_quality_changed', {
            leaf: activeReading.leaf,
            quality: 'reading',
            zoom: readingPage.getView().zoom
          });
        }
        maybeUpgradeReadingTexture();
      })
      .catch(() => undefined);
  };

  const createReadingState = (leaf, side, asset) => {
    const declaredHeight = asset === magazine.fallbackAsset ? null : asset?.height;
    return {
      generation: ++readingGeneration,
      leaf,
      side,
      quality: asset === magazine.fallbackAsset ? 'preview' : 'magazine',
      fullRequested: false,
      fullEligible: Number.isFinite(declaredHeight)
        ? declaredHeight > READING_TEXTURE_TARGET_HEIGHT
        : null
    };
  };

  const enterReadingMode = (controller) => {
    if (readingMode || turning || pageTurn.isBusy) {
      return false;
    }

    const target = pickMagazinePage(controller);
    if (!target) return false;

    const camera = xrExperience.baseExperience.camera;
    if (!camera) return false;

    const placeholder = magazine.getPageAsset(target.side);
    readingMode = createReadingState(target.leaf, target.side, placeholder);
    const activeReading = readingMode;
    readingNavigation = null;
    readingStickLatched = true;
    magazine.pinPageAssets(placeholder);
    readingPage.show(placeholder, camera);
    magazine.root.setEnabled(false);
    emit('xr_reading_mode_opened', {
      spread: currentSpread,
      leaf: target.leaf,
      side: target.side
    });

    startReadingQualityUpgrade(activeReading);

    return true;
  };

  const navigateReadingPage = (direction) => {
    if (
      !readingMode ||
      readingNavigation ||
      readingManipulation ||
      (direction !== -1 && direction !== 1)
    ) {
      return false;
    }

    const targetLeaf = getAdjacentReadingLeaf(
      readingMode.leaf,
      direction,
      source.pageCount
    );
    if (targetLeaf === null) return false;

    const targetSpread = leafToSpread(targetLeaf, source.pageCount);
    const targetLeaves = spreadToLeaves(targetSpread, source.pageCount);
    const targetSide = targetLeaves.left === targetLeaf ? 'left' : 'right';
    const navigation = { targetLeaf, targetSpread, targetSide };
    readingNavigation = navigation;
    emit('xr_reading_page_change_started', {
      from: readingMode.leaf,
      to: targetLeaf
    });

    // Keep the old page completely intact until the whole destination spread
    // is decoded. This also guarantees that exiting immediately after the swap
    // reveals the correct spread rather than a stale background.
    loadSpreadAssets(targetSpread, 'magazine')
      .then((assets) => {
        if (
          disposed ||
          readingNavigation !== navigation ||
          !readingMode
        ) {
          return;
        }

        const targetAsset = assets[targetSide] ?? magazine.fallbackAsset;
        const activeReading = createReadingState(targetLeaf, targetSide, targetAsset);
        readingMode = activeReading;
        readingNavigation = null;
        currentSpread = targetSpread;

        renderGeneration += 1;
        magazine.setPageAssets(assets);
        magazine.setClosed(assets.isCover);
        magazine.pinPageAssets(targetAsset);
        readingPage.setAsset(targetAsset);
        resetReadingView({ emitEvent: false });

        source.setCurrentPage(targetLeaf);
        emit('xr_reading_page_changed', {
          leaf: targetLeaf,
          spread: targetSpread,
          side: targetSide
        });

        // Refresh the rolling GPU window without ever replacing the new page
        // with a lower-resolution preview.
        renderSpread(targetSpread, { showPreview: false }).catch(() => undefined);
        startReadingQualityUpgrade(activeReading);
      })
      .catch(() => {
        if (readingNavigation === navigation) readingNavigation = null;
      });

    return true;
  };

  const getPointerPlaneHit = (controller) => {
    updatePointerRay(controller);
    const directionZ = localRayEnd.z - localOrigin.z;

    if (Math.abs(directionZ) < 1e-5) {
      return null;
    }

    const distance = -localOrigin.z / directionZ;
    if (distance < 0) {
      return null;
    }

    localHit.set(
      localOrigin.x + (localRayEnd.x - localOrigin.x) * distance,
      localOrigin.y + (localRayEnd.y - localOrigin.y) * distance,
      0
    );
    return localHit;
  };

  const beginPointerTurn = (controller) => {
    if (readingMode || turning || pointerTurn) {
      return false;
    }

    const target = pickMagazinePage(controller);
    const pick = target?.pick;
    if (!target || !pick) {
      return false;
    }

    Vector3.TransformCoordinatesToRef(pick.pickedPoint, magazineInverse, localHit);
    const direction = pick.pickedMesh === magazine.rightPage ? 1 : -1;
    const grab = {
      u: Math.min(Math.max(Math.abs(localHit.x) / PAGE_WIDTH, 0), 1),
      v: Math.min(Math.max(localHit.y / PAGE_HEIGHT + 0.5, 0), 1)
    };
    const interaction = {
      controller,
      direction,
      grabX: localHit.x,
      held: true,
      started: false
    };
    pointerTurn = interaction;
    interaction.started = startTurn(direction, grab);

    if (!interaction.started) {
      pointerTurn = null;
      return false;
    }

    return true;
  };

  const dragPointerTurn = () => {
    if (!pointerTurn?.held || !pointerTurn.started || !pageTurn.isBusy) {
      return;
    }

    const hit = getPointerPlaneHit(pointerTurn.controller);
    if (hit) {
      const grabV = Math.min(Math.max(hit.y / PAGE_HEIGHT + 0.5, 0), 1);
      pageTurn.drag(
        pointerDragToProgress(
          hit.x,
          pointerTurn.grabX,
          PAGE_WIDTH,
          pointerTurn.direction
        ),
        grabV
      );
    }
  };

  const releasePointerTurn = () => {
    if (!pointerTurn) {
      return;
    }

    pointerTurn.held = false;
    if (pointerTurn.started && pageTurn.release()) {
      armTurnWatchdog();
    }
  };

  const pollControllers = () => {
    let activePointerControllerSeen = false;
    let activeReadingControllerSeen = false;

    for (const controller of xrExperience.input.controllers) {
      const gamepad = controller.inputSource?.gamepad;

      if (!gamepad) {
        continue;
      }

      const handedness = controller.inputSource.handedness;
      if (pointerTurn?.controller === controller) {
        activePointerControllerSeen = true;
      }
      if (readingManipulation?.controller === controller) {
        activeReadingControllerSeen = true;
      }
      const key = handedness || controller.uniqueId;
      const buttons = gamepad.buttons ?? [];

      const trigger = getButtonEdge(
        key,
        BUTTON_TRIGGER,
        buttons[BUTTON_TRIGGER]?.pressed ?? false
      );
      const squeeze = getButtonEdge(
        key,
        BUTTON_SQUEEZE,
        buttons[BUTTON_SQUEEZE]?.pressed ?? false
      );
      const primary = getButtonEdge(
        key,
        BUTTON_PRIMARY,
        buttons[BUTTON_PRIMARY]?.pressed ?? false
      );
      const secondary = getButtonEdge(
        key,
        BUTTON_SECONDARY,
        buttons[BUTTON_SECONDARY]?.pressed ?? false
      );

      // In Reading Mode the upper trigger zooms with depth and simultaneously
      // pans in the page plane. The lower squeeze/grip is pan-only.
      if (handedness === 'right') {
        if (secondary.rose) {
          secondaryHold = {
            key,
            startedAt: Date.now(),
            readingAtPress: Boolean(readingMode),
            triggered: false
          };
        }

        if (
          secondary.pressed &&
          secondaryHold?.key === key &&
          !secondaryHold.triggered &&
          Date.now() - secondaryHold.startedAt >= SECONDARY_EXIT_HOLD_MS
        ) {
          secondaryHold.triggered = true;
          requestImmersiveExit('secondary_button_hold');
        }

        if (secondary.fell && secondaryHold?.key === key) {
          const closeReadingMode =
            !secondaryHold.triggered &&
            secondaryHold.readingAtPress &&
            Boolean(readingMode);
          secondaryHold = null;
          if (closeReadingMode) exitReadingMode();
        }

        if (primary.rose) {
          if (readingMode) resetReadingView();
          else enterReadingMode(controller);
        }

        if (trigger.rose) {
          if (readingMode) beginReadingManipulation(controller, 'zoom');
          else beginPointerTurn(controller);
        }

        if (trigger.fell) {
          if (
            readingManipulation?.controller === controller &&
            readingManipulation.operation === 'zoom'
          ) {
            endReadingManipulation(controller, 'zoom');
          } else if (pointerTurn?.controller === controller) {
            releasePointerTurn();
          }
        }

        if (squeeze.rose && readingMode) {
          beginReadingManipulation(controller, 'pan');
        }

        if (
          squeeze.fell &&
          readingManipulation?.controller === controller &&
          readingManipulation.operation === 'pan'
        ) {
          endReadingManipulation(controller, 'pan');
        }

      }

      if (handedness === 'right' && readingMode) {
        const stickX = gamepad.axes?.[2] ?? 0;
        const stickY = gamepad.axes?.[3] ?? 0;
        const absX = Math.abs(stickX);
        const absY = Math.abs(stickY);

        if (absX < READING_STICK_RELEASE) {
          readingStickLatched = false;
        } else if (
          !readingStickLatched &&
          !readingManipulation &&
          !readingNavigation
        ) {
          if (absX >= READING_STICK_ACTIVATION && absX >= absY) {
            readingStickLatched = true;
            navigateReadingPage(stickX > 0 ? 1 : -1);
          }
        }
      }

      // Right stick pushed up/down trims the held tilt, so the reader can find
      // a comfortable wrist angle without leaving the session.
      if (handedness === 'right' && heldInHand && !readingMode) {
        const stickY = gamepad.axes?.[3] ?? 0;

        if (Math.abs(stickY) > STICK_DEADZONE) {
          // Scaled by frame time so the trim rate does not depend on FPS.
          const delta = stickY * PITCH_TRIM_RATE * (engine.getDeltaTime() / 1000);
          magazine.adjustHeldPitch(delta);
        }
      }

      // A trigger edge can create an interaction during this very poll. Mark
      // it after handling buttons so tracking-loss logic does not release it
      // immediately on its first frame.
      if (pointerTurn?.controller === controller) {
        activePointerControllerSeen = true;
      }
      if (readingManipulation?.controller === controller) {
        activeReadingControllerSeen = true;
      }

    }

    // Tracking loss is equivalent to releasing the sheet. Otherwise a
    // disconnected right controller could leave the transaction grabbed.
    if (pointerTurn?.held && !activePointerControllerSeen) {
      releasePointerTurn();
    }
    if (readingManipulation && !activeReadingControllerSeen) {
      endReadingManipulation();
    }

    updateReadingManipulation();
    dragPointerTurn();
  };

  stateObserver = xrExperience.baseExperience.onStateChangedObservable.add((state) => {
    if (state === WebXRState.NOT_IN_XR && sessionHasStarted) {
      // Let Babylon finish notifying its observers before its XR helper and
      // scene are disposed. The guard makes this safe if end() resolves first.
      Promise.resolve().then(() => {
        finishSession(exitRequested ? 'requested' : 'system');
      });
    }
  });

  engine.runRenderLoop(() => {
    if (pendingRecenter) {
      // Preferred: ride the left hand. Controllers are reported a second or so
      // after the session starts, well after the camera has a pose, so the
      // world-space fallback must not win the race by default.
      if (heldInHand && attachMagazineToLeftHand()) {
        pendingRecenter = false;
        console.info('[XR] magazine attached to left controller');
      } else if (Date.now() - sessionStartedAt > CONTROLLER_WAIT_MS) {
        const camera = xrExperience.baseExperience.camera;
        const head = camera?.globalPosition;

        // A pose of exactly zero means tracking has not produced a frame yet,
        // and placing against it would drop the magazine at the origin.
        if (head && head.lengthSquared() > 1e-6) {
          magazine.recenter(camera);
          pendingRecenter = false;
          heldInHand = false;
          console.info(
            `[XR] no left controller after ${CONTROLLER_WAIT_MS}ms; placed in world at head y=${head.y.toFixed(2)}`
          );
        }
      }
    }

    pollControllers();
    // Time-based, so the settle takes the same wall-clock time at 72Hz as at 90.
    pageTurn.update(engine.getDeltaTime());
    scene.render();
  });

  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);

  try {
    if (mode === 'immersive-ar') {
      // Let the camera feed show through instead of painting a background.
      scene.clearColor = new Color4(0, 0, 0, 0);
      scene.autoClear = true;
    }

    try {
      await xrExperience.baseExperience.enterXRAsync(
        mode,
        'local-floor',
        xrExperience.renderTarget
      );
    } catch (floorErr) {
      // Devices without a configured boundary refuse 'local-floor'. 'local'
      // puts the origin at head height instead, which recenter() handles.
      await xrExperience.baseExperience.enterXRAsync(mode, 'local', xrExperience.renderTarget);
    }
    sessionHasStarted = true;

    // `selectstart/selectend` are the WebXR-standard primary-action events.
    // They work even when a device exposes no useful gamepad button indices.
    nativeXrSession = xrExperience.baseExperience.sessionManager.session;
    onNativeSelectStart = (event) => {
      if (event.inputSource?.handedness !== 'right') return;
      const controller = xrExperience.input.controllers.find(
        (candidate) => candidate.inputSource === event.inputSource
      );

      if (controller) {
        if (readingMode) beginReadingManipulation(controller, 'zoom');
        else beginPointerTurn(controller);
      }
    };
    onNativeSelectEnd = (event) => {
      if (event.inputSource?.handedness !== 'right') return;
      const controller = xrExperience.input.controllers.find(
        (candidate) => candidate.inputSource === event.inputSource
      );

      if (
        controller &&
        readingManipulation?.controller === controller &&
        readingManipulation.operation === 'zoom'
      ) {
        endReadingManipulation(controller, 'zoom');
      } else if (controller && pointerTurn?.controller === controller) {
        releasePointerTurn();
      }
    };
    onNativeSqueezeStart = (event) => {
      if (event.inputSource?.handedness !== 'right' || !readingMode) return;
      const controller = xrExperience.input.controllers.find(
        (candidate) => candidate.inputSource === event.inputSource
      );

      if (controller) beginReadingManipulation(controller, 'pan');
    };
    onNativeSqueezeEnd = (event) => {
      if (event.inputSource?.handedness !== 'right') return;
      const controller = xrExperience.input.controllers.find(
        (candidate) => candidate.inputSource === event.inputSource
      );

      if (
        controller &&
        readingManipulation?.controller === controller &&
        readingManipulation.operation === 'pan'
      ) {
        endReadingManipulation(controller, 'pan');
      }
    };
    nativeXrSession.addEventListener('selectstart', onNativeSelectStart);
    nativeXrSession.addEventListener('selectend', onNativeSelectEnd);
    nativeXrSession.addEventListener('squeezestart', onNativeSqueezeStart);
    nativeXrSession.addEventListener('squeezeend', onNativeSqueezeEnd);

    // The XR camera does not report a usable pose until the device has
    // delivered a tracked frame, so defer placement to the render loop rather
    // than reading a zeroed transform here.
    pendingRecenter = true;
    sessionStartedAt = Date.now();

    // Which mode actually started decides whether passthrough is visible -
    // keep it in the log for remote debugging via chrome://inspect.
    console.info(`[XR] session started: ${mode}, spread ${currentSpread}`);
    emit('xr_session_started', { spread: currentSpread, mode });
    startBackgroundPrefetch();
  } catch (err) {
    cleanup();
    emit('xr_session_failed', { reason: String(err) });
    throw err;
  }

  function cleanup() {
    if (disposed) {
      return;
    }
    disposed = true;

    window.clearTimeout(turnWatchdog);
    window.removeEventListener('resize', onResize);

    for (const { observable, observer } of observers) {
      observable.remove(observer);
    }
    observers.length = 0;

    buttonStates.clear();
    secondaryHold = null;
    if (nativeXrSession) {
      nativeXrSession.removeEventListener('selectstart', onNativeSelectStart);
      nativeXrSession.removeEventListener('selectend', onNativeSelectEnd);
      nativeXrSession.removeEventListener('squeezestart', onNativeSqueezeStart);
      nativeXrSession.removeEventListener('squeezeend', onNativeSqueezeEnd);
    }
    if (stateObserver) {
      xrExperience?.baseExperience?.onStateChangedObservable.remove(stateObserver);
      stateObserver = null;
    }

    engine.stopRenderLoop();

    // Unparent first: the controller meshes are disposed with the experience,
    // and a dangling parent reference would outlive them.
    magazine.detachFromGrip();
    readingPage.dispose();
    pageTurn.dispose();
    magazine.dispose();
    xrExperience?.dispose();
    disposeScene();

    canvas.remove();
  }

  function finishSession(reason) {
    if (sessionEndedNotified) {
      return;
    }

    sessionEndedNotified = true;
    const detail = { reason, spread: currentSpread };
    emit('xr_session_ended', detail);
    cleanup();

    try {
      onEnded?.(detail);
    } catch (err) {
      // Consumer state synchronization must not interfere with teardown.
    }
  }

  return {
    getCurrentLeaf() {
      return spreadToLeaf(currentSpread, source.pageCount);
    },

    async end() {
      if (disposed) {
        return;
      }

      exitRequested = true;
      try {
        await xrExperience?.baseExperience?.exitXRAsync();
      } catch (err) {
        // Session may already be gone; teardown still has to run.
      }
      finishSession('application');
    },

    dispose: cleanup
  };
}
