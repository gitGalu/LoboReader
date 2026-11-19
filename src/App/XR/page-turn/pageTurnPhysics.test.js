import {
  COMMIT_THRESHOLD,
  FLICK_VELOCITY,
  createVelocityTracker,
  decideSettleTarget,
  pointerDragToProgress,
  pointerToProgress,
  stepSettle
} from './pageTurnPhysics';

describe('decideSettleTarget', () => {
  test('commits past the midpoint when released slowly', () => {
    expect(decideSettleTarget(0.7, 0)).toBe('settling-forward');
  });

  test('falls back before the midpoint when released slowly', () => {
    expect(decideSettleTarget(0.3, 0)).toBe('settling-backward');
  });

  test('commits on a fast flick even from a shallow drag', () => {
    expect(decideSettleTarget(0.1, FLICK_VELOCITY + 0.5)).toBe('settling-forward');
  });

  test('cancels on a fast pull back even from past the midpoint', () => {
    expect(decideSettleTarget(0.9, -FLICK_VELOCITY - 0.5)).toBe('settling-backward');
  });

  test('uses position when velocity is below the flick threshold', () => {
    expect(decideSettleTarget(0.6, FLICK_VELOCITY - 0.1)).toBe('settling-forward');
    expect(decideSettleTarget(0.4, FLICK_VELOCITY - 0.1)).toBe('settling-backward');
  });

  test('treats the threshold itself as a commit', () => {
    expect(decideSettleTarget(COMMIT_THRESHOLD, 0)).toBe('settling-forward');
  });
});

describe('stepSettle', () => {
  test('moves toward the target', () => {
    const next = stepSettle(0.5, 0, 1, 120, 1 / 72);
    expect(next.progress).toBeGreaterThan(0.5);
  });

  test('reaches and reports the target eventually', () => {
    let progress = 0.6;
    let velocity = 0;
    let settled = false;

    for (let i = 0; i < 600 && !settled; i += 1) {
      const step = stepSettle(progress, velocity, 1, 120, 1 / 72);
      progress = step.progress;
      velocity = step.velocity;
      settled = step.settled;
    }

    expect(settled).toBe(true);
    expect(progress).toBe(1);
  });

  test('settles without overshooting, so paper does not bounce', () => {
    let progress = 0.5;
    let velocity = 0;
    let maxProgress = progress;

    for (let i = 0; i < 400; i += 1) {
      const step = stepSettle(progress, velocity, 1, 120, 1 / 72);
      progress = step.progress;
      velocity = step.velocity;
      maxProgress = Math.max(maxProgress, progress);
    }

    // Critically damped: a small numerical overshoot is acceptable, a visible
    // bounce is not.
    expect(maxProgress).toBeLessThanOrEqual(1.02);
  });

  test('clamps a huge timestep instead of going unstable', () => {
    // Simulates a resumed tab or a long GC pause.
    const next = stepSettle(0.5, 0, 1, 120, 10);

    expect(Number.isFinite(next.progress)).toBe(true);
    expect(next.progress).toBeGreaterThanOrEqual(0);
    expect(next.progress).toBeLessThanOrEqual(1.5);
  });

  test('never produces NaN', () => {
    let progress = 0.3;
    let velocity = 0;

    for (let i = 0; i < 200; i += 1) {
      const step = stepSettle(progress, velocity, 0, 120, 1 / 72);
      progress = step.progress;
      velocity = step.velocity;
      expect(Number.isNaN(progress)).toBe(false);
      expect(Number.isNaN(velocity)).toBe(false);
    }
  });
});

describe('pointerToProgress', () => {
  test('is zero at the free edge and grows toward the spine', () => {
    const width = 0.21;

    expect(pointerToProgress(width, width, 1)).toBeCloseTo(0, 5);
    expect(pointerToProgress(0, width, 1)).toBeCloseTo(0.5, 5);
  });

  test('clamps to the 0-1 range', () => {
    const width = 0.21;

    // Dragged away from the spine, past the free edge: no turn.
    expect(pointerToProgress(width * 5, width, 1)).toBe(0);
    // Dragged well past the spine: a complete turn, not a wrapped value.
    expect(pointerToProgress(-width * 5, width, 1)).toBe(1);
  });

  test('stays within range across the whole sweep', () => {
    const width = 0.21;

    for (let x = -width * 3; x <= width * 3; x += width / 20) {
      const progress = pointerToProgress(x, width, 1);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });

  test('degrades safely on invalid input', () => {
    expect(pointerToProgress(NaN, 0.21, 1)).toBe(0);
    expect(pointerToProgress(0.1, 0, 1)).toBe(0);
  });
});

describe('pointerDragToProgress', () => {
  test('starts at zero wherever the page was grabbed', () => {
    expect(pointerDragToProgress(0.12, 0.12, 0.21, 1)).toBe(0);
    expect(pointerDragToProgress(-0.08, -0.08, 0.21, -1)).toBe(0);
  });

  test('grows while either page is dragged across the spine', () => {
    expect(pointerDragToProgress(-0.08, 0.18, 0.21, 1)).toBeGreaterThan(0.5);
    expect(pointerDragToProgress(0.08, -0.18, 0.21, -1)).toBeGreaterThan(0.5);
  });

  test('does not curl when dragged away from the spine', () => {
    expect(pointerDragToProgress(0.2, 0.1, 0.21, 1)).toBe(0);
  });
});

describe('createVelocityTracker', () => {
  test('reports positive velocity for forward motion', () => {
    const tracker = createVelocityTracker();
    tracker.reset(0, 0);

    tracker.update(0.2, 100);
    const velocity = tracker.update(0.4, 200);

    expect(velocity).toBeGreaterThan(0);
  });

  test('reports negative velocity for backward motion', () => {
    const tracker = createVelocityTracker();
    tracker.reset(1, 0);

    tracker.update(0.8, 100);
    const velocity = tracker.update(0.6, 200);

    expect(velocity).toBeLessThan(0);
  });

  test('smooths a single jittery frame rather than reading it as a flick', () => {
    const tracker = createVelocityTracker();
    tracker.reset(0.5, 0);

    tracker.update(0.5, 16);
    const spike = tracker.update(0.9, 32);

    // The raw instantaneous rate would be ~25; smoothing must damp it well
    // below that so noise cannot trigger a commit.
    expect(spike).toBeLessThan(15);
  });

  test('ignores zero-length timesteps', () => {
    const tracker = createVelocityTracker();
    tracker.reset(0.5, 100);

    const velocity = tracker.update(0.9, 100);

    expect(Number.isFinite(velocity)).toBe(true);
  });
});
