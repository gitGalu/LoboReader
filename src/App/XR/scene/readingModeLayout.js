/** Comfortable world-space distance of the isolated reading page. */
export const READING_DISTANCE = 0.8;

/** Fraction of the vertical field of view occupied by the page. */
export const READING_VIEW_FILL = 0.68;

/** Enough to bring a typical three-column magazine layout to column width. */
export const MAX_READING_ZOOM = 5;

/** Returns a valid neighbouring leaf or null at either publication boundary. */
export function getAdjacentReadingLeaf(currentLeaf, direction, pageCount) {
  if (
    !Number.isInteger(currentLeaf) ||
    (direction !== -1 && direction !== 1) ||
    !Number.isInteger(pageCount) ||
    pageCount <= 0
  ) {
    return null;
  }

  const target = currentLeaf + direction;
  return target >= 0 && target < pageCount ? target : null;
}

/**
 * Converts camera field of view into a comfortable physical page height.
 * Clamping protects unusual headset projections from producing a tiny page
 * or an oversized panel that extends beyond comfortable eye rotation.
 */
export function getReadingPageHeight(
  verticalFov,
  distance = READING_DISTANCE,
  fill = READING_VIEW_FILL
) {
  const safeFov = Number.isFinite(verticalFov) && verticalFov > 0
    ? verticalFov
    : 0.8;
  const safeDistance = Number.isFinite(distance) && distance > 0
    ? distance
    : READING_DISTANCE;
  const safeFill = Number.isFinite(fill) ? Math.min(Math.max(fill, 0.5), 0.8) : READING_VIEW_FILL;
  const visibleHeight = 2 * safeDistance * Math.tan(safeFov / 2);

  return Math.min(Math.max(visibleHeight * safeFill, 0.42), 0.68);
}

/** Keeps a zoomed page reachable instead of allowing it to be panned away. */
export function clampReadingView(
  { zoom, panX, panY },
  baseWidth,
  baseHeight,
  maxZoom = MAX_READING_ZOOM
) {
  const safeMaxZoom = Number.isFinite(maxZoom) ? Math.max(maxZoom, 1) : MAX_READING_ZOOM;
  const safeZoom = Math.min(Math.max(Number.isFinite(zoom) ? zoom : 1, 1), safeMaxZoom);
  const width = Number.isFinite(baseWidth) && baseWidth > 0 ? baseWidth : 0;
  const height = Number.isFinite(baseHeight) && baseHeight > 0 ? baseHeight : 0;
  const maxPanX = width * (safeZoom - 1) * 0.5;
  const maxPanY = height * (safeZoom - 1) * 0.5;
  const clampPan = (value, maximum) => maximum === 0
    ? 0
    : Math.min(Math.max(Number.isFinite(value) ? value : 0, -maximum), maximum);

  return {
    zoom: safeZoom,
    panX: clampPan(panX, maxPanX),
    panY: clampPan(panY, maxPanY)
  };
}
