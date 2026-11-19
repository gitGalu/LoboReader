/**
 * WebXR capability detection.
 *
 * Imports nothing from Babylon.js on purpose: this runs in the 2D reader to
 * decide whether the VR button is shown, and must not drag the 3D engine into
 * the main bundle.
 */

/**
 * Headset browsers. Checked before the handheld tokens because some of them
 * (older Quest and Pico builds) still report "Android" in their user agent.
 */
const HEADSET_UA = /OculusBrowser|\bQuest\b|Pico|Wolvic|VR Safari|XR Safari|Android XR/i;

/** Phones and tablets. iPhone/iPad have no WebXR today; listed for safety. */
const HANDHELD_UA = /Android|iPhone|iPad|iPod|Mobile/i;

/**
 * Reports whether this looks like a phone or tablet rather than a headset or
 * a desktop driving a PC VR headset.
 *
 * Chrome on ARCore phones answers `isSessionSupported('immersive-ar') === true`
 * (and some builds do the same for Cardboard `immersive-vr`), but the XR reader
 * is driven by tracked controllers or hands: on a phone, screen taps arrive as
 * input sources without handedness, nothing responds, and the only way out is
 * the system back gesture. Those devices keep the 2D reader only.
 *
 * Desktop-class iPadOS UAs ("Macintosh") are deliberately not treated as
 * handheld: Safari on iPad has no WebXR, while Safari on visionOS uses the same
 * UA and is a real headset.
 *
 * @param {Navigator} [nav]
 * @returns {boolean}
 */
export function isHandheldDevice(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  const ua = nav?.userAgent ?? '';

  if (HEADSET_UA.test(ua)) {
    return false;
  }

  if (nav?.userAgentData?.mobile === true) {
    return true;
  }

  return HANDHELD_UA.test(ua);
}

/**
 * Reports whether background downloads should stay small: the user enabled
 * a data saver, or the connection is cellular or slow.
 *
 * @param {Navigator} [nav]
 * @param {Window} [win]
 * @returns {boolean}
 */
export function prefersReducedData(
  nav = typeof navigator === 'undefined' ? undefined : navigator,
  win = typeof window === 'undefined' ? undefined : window
) {
  try {
    const connection = nav?.connection;

    if (connection?.saveData === true || connection?.type === 'cellular') {
      return true;
    }

    if (['slow-2g', '2g', '3g'].includes(connection?.effectiveType)) {
      return true;
    }

    return Boolean(win?.matchMedia?.('(prefers-reduced-data: reduce)')?.matches);
  } catch (err) {
    return false;
  }
}

/**
 * @param {'immersive-vr' | 'immersive-ar'} mode
 * @param {Navigator} [nav]
 * @returns {Promise<boolean>}
 */
async function probe(mode, nav) {
  try {
    const xr = nav?.xr;

    if (!xr || typeof xr.isSessionSupported !== 'function') {
      return false;
    }

    return await xr.isSessionSupported(mode);
  } catch (err) {
    // Permissions policy rejections surface here on some browsers.
    return false;
  }
}

/**
 * Reports whether this browser can start an immersive VR session.
 *
 * Never throws. A browser without WebXR, a blocked permissions policy, or a
 * device that simply has no headset all resolve to false.
 *
 * @param {Navigator} [nav]
 * @returns {Promise<boolean>}
 */
export async function isImmersiveVrSupported(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  return probe('immersive-vr', nav);
}

/**
 * Reports whether passthrough (immersive-ar) is available.
 *
 * @param {Navigator} [nav]
 * @returns {Promise<boolean>}
 */
export async function isImmersiveArSupported(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  return probe('immersive-ar', nav);
}

/**
 * Resolves the best available immersive mode, preferring passthrough so the
 * reader stays aware of their surroundings.
 *
 * Always null on phones and tablets (see isHandheldDevice), so the 2D reader
 * there never shows the VR button and never downloads the 3D engine.
 *
 * @param {Navigator} [nav]
 * @returns {Promise<'immersive-ar' | 'immersive-vr' | null>}
 */
export async function getPreferredImmersiveMode(nav = typeof navigator === 'undefined' ? undefined : navigator) {
  if (isHandheldDevice(nav)) {
    return null;
  }

  const [ar, vr] = await Promise.all([probe('immersive-ar', nav), probe('immersive-vr', nav)]);

  if (ar) {
    return 'immersive-ar';
  }

  return vr ? 'immersive-vr' : null;
}
