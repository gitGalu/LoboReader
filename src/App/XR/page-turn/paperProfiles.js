/**
 * Material profiles describing how a sheet behaves while it turns.
 *
 * These are tuning constants for the curl shader and the settle spring, not a
 * physical model: they were chosen to look right at magazine scale rather than
 * derived from paper stiffness in any real unit.
 */

/**
 * @typedef {Object} PaperProfile
 * @property {number} stiffness How much of the sheet resists bending, 0-1.
 * @property {number} curlRadius Cylinder radius in metres.
 * @property {number} verticalBend Sag along the free edge.
 * @property {number} edgeLag How far the far edge trails the grabbed corner.
 * @property {number} damping Damping ratio; 1 is critical, above 1 avoids bounce.
 * @property {number} settleDurationMs Nominal time to fall flat.
 * @property {number} ambient Diffuse lighting floor used to protect text blacks.
 */

/** @type {Record<string, PaperProfile>} */
export const PAPER_PROFILES = {
  thinMagazine: {
    stiffness: 0.28,
    curlRadius: 0.035,
    verticalBend: 0.16,
    edgeLag: 0.12,
    damping: 1.04,
    settleDurationMs: 340,
    ambient: 0.78
  },
  glossyMagazine: {
    stiffness: 0.42,
    curlRadius: 0.045,
    verticalBend: 0.12,
    edgeLag: 0.08,
    damping: 1.06,
    settleDurationMs: 300,
    ambient: 0.76
  },
  cardstock: {
    stiffness: 0.78,
    curlRadius: 0.09,
    verticalBend: 0.04,
    edgeLag: 0.02,
    damping: 1.1,
    settleDurationMs: 260,
    ambient: 0.74
  }
};

/** Interior pages of a magazine. */
export const DEFAULT_PAGE_PROFILE = PAPER_PROFILES.glossyMagazine;

/** Covers are heavier stock and bend noticeably less. */
export const COVER_PROFILE = PAPER_PROFILES.cardstock;
