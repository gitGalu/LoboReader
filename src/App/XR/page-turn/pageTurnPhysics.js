/**
 * Release behaviour for a turning page.
 *
 * Pure functions, deliberately free of Babylon types so the decision logic can
 * be tested without a WebGL context.
 */

/** Progress past which a released page falls forward on its own. */
export const COMMIT_THRESHOLD = 0.5;

/**
 * Flick speed, in progress units per second, that commits a turn regardless of
 * how far the page actually travelled. A quick flick from near the spine
 * should still turn the page.
 */
export const FLICK_VELOCITY = 1.6;

/**
 * Decides where a released page should end up.
 *
 * Velocity wins over position: a fast flick commits even from a shallow drag,
 * and a fast pull back cancels even from past the midpoint. Only when the page
 * is released slowly does raw progress decide.
 *
 * @param {number} progress Current curl progress, 0-1.
 * @param {number} velocity Progress units per second, signed.
 * @returns {'settling-forward' | 'settling-backward'}
 */
export function decideSettleTarget(progress, velocity) {
  if (velocity > FLICK_VELOCITY) {
    return 'settling-forward';
  }

  if (velocity < -FLICK_VELOCITY) {
    return 'settling-backward';
  }

  return progress >= COMMIT_THRESHOLD ? 'settling-forward' : 'settling-backward';
}

/**
 * Advances a critically damped spring toward its target.
 *
 * Critically damped so the page settles without oscillating: paper does not
 * bounce when it falls shut.
 *
 * @param {number} current Current progress.
 * @param {number} velocity Current velocity, progress units per second.
 * @param {number} target Target progress, 0 or 1.
 * @param {number} stiffness Spring constant.
 * @param {number} dt Seconds since the last step.
 * @returns {{ progress: number, velocity: number, settled: boolean }}
 */
export function stepSettle(current, velocity, target, stiffness, dt, dampingRatio = 1) {
  // Clamp dt so a dropped frame or a resumed tab cannot fling the page: with a
  // large step an explicit integrator goes unstable.
  const step = Math.min(dt, 0.05);

  const damping = 2 * Math.sqrt(stiffness) * Math.max(dampingRatio, 1);
  const accel = (target - current) * stiffness - velocity * damping;

  const nextVelocity = velocity + accel * step;
  const nextProgress = Math.min(Math.max(current + nextVelocity * step, 0), 1);

  const settled = Math.abs(nextProgress - target) < 0.001 && Math.abs(nextVelocity) < 0.01;

  return {
    progress: settled ? target : nextProgress,
    velocity: settled ? 0 : nextVelocity,
    settled
  };
}

/**
 * Maps a pointer position to curl progress.
 *
 * @param {number} pointerX Pointer X in page-local space, metres.
 * @param {number} pageWidth Page width in metres.
 * @param {number} direction +1 forward, -1 backward.
 * @returns {number} Progress clamped to 0-1.
 */
export function pointerToProgress(pointerX, pageWidth, direction) {
  if (!Number.isFinite(pointerX) || pageWidth <= 0) {
    return 0;
  }

  // Dragging the free edge toward the spine and past it is a full turn.
  const travelled = direction > 0 ? pageWidth - pointerX : pointerX + pageWidth;

  return Math.min(Math.max(travelled / (pageWidth * 2), 0), 1);
}

/** Maps displacement since the initial grab to curl progress. */
export function pointerDragToProgress(pointerX, grabX, pageWidth, direction) {
  if (!Number.isFinite(pointerX) || !Number.isFinite(grabX) || pageWidth <= 0) {
    return 0;
  }

  const travelledTowardOtherSide = direction * (grabX - pointerX);
  return Math.min(Math.max(travelledTowardOtherSide / (pageWidth * 1.5), 0), 1);
}

/**
 * Tracks pointer velocity across frames without allocating.
 */
export function createVelocityTracker() {
  let lastProgress = 0;
  let lastTime = 0;
  let velocity = 0;

  return {
    reset(progress, now) {
      lastProgress = progress;
      lastTime = now;
      velocity = 0;
    },

    update(progress, now) {
      const dt = (now - lastTime) / 1000;

      if (dt > 1e-4) {
        // Smoothed so a single jittery tracking frame cannot register as a
        // flick; hand tracking in particular is noisy.
        const instant = (progress - lastProgress) / dt;
        velocity = velocity * 0.6 + instant * 0.4;
        lastProgress = progress;
        lastTime = now;
      }

      return velocity;
    },

    get value() {
      return velocity;
    }
  };
}
