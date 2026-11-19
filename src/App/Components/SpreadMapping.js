/**
 * Maps between the 2D reader's single-leaf indices and the XR reader's
 * two-page spreads.
 *
 * The 2D reader shows one scanned leaf at a time. The XR magazine shows a
 * physical spread, so leaf 0 stands alone as the cover and the interior pairs
 * up from leaf 1:
 *
 *   spread 0 -> [cover(0), none]
 *   spread 1 -> [1, 2]
 *   spread 2 -> [3, 4]
 *
 * A trailing leaf with no partner (even page counts) yields a half-empty final
 * spread rather than being dropped.
 */

/**
 * @typedef {Object} Spread
 * @property {number} index Spread index.
 * @property {number | null} left Leaf shown on the left, or null.
 * @property {number | null} right Leaf shown on the right, or null.
 * @property {boolean} isCover True for the standalone cover spread.
 */

/**
 * Total number of spreads for a given leaf count.
 *
 * @param {number} pageCount
 * @returns {number}
 */
export function getSpreadCount(pageCount) {
  if (!Number.isFinite(pageCount) || pageCount <= 0) {
    return 0;
  }

  // Cover occupies a spread by itself; the remaining leaves pair up.
  return 1 + Math.ceil((pageCount - 1) / 2);
}

/**
 * Spread index that contains a given leaf.
 *
 * @param {number} leafIndex
 * @param {number} pageCount
 * @returns {number}
 */
export function leafToSpread(leafIndex, pageCount) {
  const clamped = clampLeaf(leafIndex, pageCount);

  if (clamped <= 0) {
    return 0;
  }

  // Leaves 1,2 -> spread 1; leaves 3,4 -> spread 2; ...
  return Math.floor((clamped - 1) / 2) + 1;
}

/**
 * Resolves a spread index to the leaves it displays.
 *
 * @param {number} spreadIndex
 * @param {number} pageCount
 * @returns {Spread}
 */
export function spreadToLeaves(spreadIndex, pageCount) {
  const spreadCount = getSpreadCount(pageCount);

  if (spreadCount === 0) {
    return { index: 0, left: null, right: null, isCover: true };
  }

  const clamped = Math.min(Math.max(Math.trunc(spreadIndex) || 0, 0), spreadCount - 1);

  if (clamped === 0) {
    return { index: 0, left: null, right: 0, isCover: true };
  }

  const left = (clamped - 1) * 2 + 1;
  const right = left + 1;

  return {
    index: clamped,
    left: left < pageCount ? left : null,
    right: right < pageCount ? right : null,
    isCover: false
  };
}

/**
 * The leaf the 2D reader should land on when leaving XR from a given spread.
 * Prefers the left page so the reader resumes at the earlier of the two.
 *
 * @param {number} spreadIndex
 * @param {number} pageCount
 * @returns {number}
 */
export function spreadToLeaf(spreadIndex, pageCount) {
  const { left, right } = spreadToLeaves(spreadIndex, pageCount);
  const leaf = left ?? right ?? 0;
  return clampLeaf(leaf, pageCount);
}

/**
 * Clamps a leaf index into the valid range for the issue.
 *
 * @param {number} leafIndex
 * @param {number} pageCount
 * @returns {number}
 */
export function clampLeaf(leafIndex, pageCount) {
  const parsed = Math.trunc(leafIndex);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  if (!Number.isFinite(pageCount) || pageCount <= 0) {
    return 0;
  }

  return Math.min(parsed, pageCount - 1);
}

/**
 * Leaves whose textures the XR view needs for a spread, including the
 * neighbours it will prefetch.
 *
 * @param {number} spreadIndex
 * @param {number} pageCount
 * @returns {number[]} Unique, in-range leaf indices.
 */
export function getSpreadNeighbourLeaves(spreadIndex, pageCount) {
  const leaves = [];

  for (let offset = -1; offset <= 1; offset += 1) {
    const { left, right } = spreadToLeaves(spreadIndex + offset, pageCount);

    if (left !== null) {
      leaves.push(left);
    }

    if (right !== null) {
      leaves.push(right);
    }
  }

  return Array.from(new Set(leaves)).filter((leaf) => leaf < pageCount);
}

/**
 * Resolves the two scans printed on the physical sheet being turned.
 * `front` is visible before the gesture; `back` becomes visible in flight.
 */
export function getTurnLeaves(spreadIndex, pageCount, direction) {
  const targetSpread = spreadIndex + direction;
  const current = spreadToLeaves(spreadIndex, pageCount);
  const target = spreadToLeaves(targetSpread, pageCount);

  return {
    targetSpread,
    front: direction > 0 ? current.right : current.left,
    back: direction > 0 ? target.left : target.right
  };
}

/**
 * Leaves that remain flat underneath the animated physical sheet.
 *
 * Forward from [1,2] to [3,4] means the moving sheet is [2,3], while the
 * exposed flat pages are [1,4]. Backward uses the same physical layering in
 * reverse. Keeping the old spread flat would reveal page 2 underneath page 2
 * and is the source of the characteristic duplicate-page glitch.
 */
export function getTurnUnderlayLeaves(spreadIndex, pageCount, direction) {
  const current = spreadToLeaves(spreadIndex, pageCount);
  const target = spreadToLeaves(spreadIndex + direction, pageCount);

  return direction > 0
    ? { left: current.left, right: target.right }
    : { left: target.left, right: current.right };
}
