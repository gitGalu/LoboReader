/**
 * Entry point into the XR reader.
 *
 * The dynamic import below is the bundle-split boundary: this module itself is
 * tiny, and Babylon.js arrives only with MagazineXRSession. The reader calls
 * preloadMagazineXRSession() as soon as it detects a headset, because the
 * immersive session must be requested within a few seconds of the tap, too
 * soon to download and evaluate the 3D engine on a slow connection.
 */

import { createMagazineXRSource } from './MagazineXRSourceAdapter';

let sessionModulePromise = null;

/**
 * Downloads and evaluates the Babylon.js session chunk. Idempotent; a failed
 * download is forgotten so a later call can retry.
 *
 * @returns {Promise<typeof import('./MagazineXRSession')>}
 */
export function preloadMagazineXRSession() {
  if (!sessionModulePromise) {
    const modulePromise = import(
      /* webpackChunkName: "magazine-xr" */ './MagazineXRSession'
    );
    sessionModulePromise = modulePromise;
    modulePromise.catch(() => {
      if (sessionModulePromise === modulePromise) {
        sessionModulePromise = null;
      }
    });
  }

  return sessionModulePromise;
}

/**
 * Launches the immersive reader for the publication currently open in 2D.
 *
 * @param {Object} params
 * @param {string} params.identifier
 * @param {string} params.title
 * @param {any} params.bookMetadata
 * @param {number} params.initialPageIndex
 * @param {'immersive-vr' | 'immersive-ar'} params.mode
 * @param {(index: number) => void} params.onPageChange
 * @param {(event: string, detail?: any) => void} [params.onEvent]
 * @param {(detail: {reason: string, spread: number}) => void} [params.onEnded]
 * @returns {Promise<{ end: () => Promise<void> }>}
 */
export async function launchMagazineXR({
  identifier,
  title,
  bookMetadata,
  initialPageIndex,
  mode,
  onPageChange,
  onEvent,
  onEnded
}) {
  const source = createMagazineXRSource({
    identifier,
    title,
    bookMetadata,
    initialPageIndex,
    onPageChange
  });

  // Normally already resolved by the reader's preload.
  const { startMagazineXRSession } = await preloadMagazineXRSession();

  let session;
  let sourceDisposed = false;
  const disposeSource = () => {
    if (sourceDisposed) return;
    sourceDisposed = true;
    source.dispose();
  };

  try {
    session = await startMagazineXRSession({
      source,
      onEvent,
      onEnded: (detail) => {
        disposeSource();
        onEnded?.(detail);
      },
      mode
    });
  } catch (err) {
    disposeSource();
    throw err;
  }

  return {
    ...session,
    async end() {
      try {
        await session.end();
      } finally {
        disposeSource();
      }
    },
    dispose() {
      try {
        session.dispose();
      } finally {
        disposeSource();
      }
    }
  };
}
