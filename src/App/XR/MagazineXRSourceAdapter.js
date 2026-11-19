/**
 * Adapter exposing the existing reader's publication data to the XR module.
 *
 * This deliberately owns no Internet Archive knowledge of its own: URLs come
 * from PageSource so the 2D and XR views can never disagree about what a page
 * index points at.
 */

import {
  getIiifBodyImageUrl,
  getIiifPageUrl,
  getPageUrl,
  getXRTextureUrl,
  getPageCount
} from '../Components/PageSource';
import { clampLeaf } from '../Components/SpreadMapping';

/**
 * @typedef {import('../Components/PageSource').PageImageQuality} PageImageQuality
 */

/**
 * @typedef {Object} PageImageSource
 * @property {number} index
 * @property {string} url
 * @property {number} [width]
 * @property {number} [height]
 * @property {string[]} [fallbackUrls]
 */

/**
 * @typedef {Object} MagazineXRSource
 * @property {string} publicationId
 * @property {string} title
 * @property {number} pageCount
 * @property {number} initialPageIndex
 * @property {(index: number, quality: PageImageQuality) => Promise<PageImageSource>} getPage
 * @property {(indices: number[], quality: PageImageQuality, options?: {priority?: boolean}) => Promise<void>} prefetchPages
 * @property {(index: number) => void} setCurrentPage
 * @property {(listener: (index: number) => void) => () => void} subscribeToCurrentPage
 */

/**
 * Builds a MagazineXRSource over the reader's current publication.
 *
 * @param {Object} params
 * @param {string} params.identifier Internet Archive identifier.
 * @param {string} params.title
 * @param {any} params.bookMetadata IIIF manifest already fetched by the reader.
 * @param {number} params.initialPageIndex Current leaf in the 2D reader.
 * @param {(index: number) => void} params.onPageChange Writes back to app state.
 * @returns {MagazineXRSource}
 */
export function createMagazineXRSource({
  identifier,
  title,
  bookMetadata,
  initialPageIndex,
  onPageChange
}) {
  const pageCount = getPageCount(bookMetadata);
  const listeners = new Set();
  const preferredUrls = new Map();
  const completedPrefetches = new Set();
  const pendingPrefetches = new Map();
  const prefetchQueue = [];
  const prefetchAbortController = new AbortController();
  const PREFETCH_CONCURRENCY = 2;
  let activePrefetches = 0;
  let disposed = false;

  let currentPage = clampLeaf(initialPageIndex, pageCount);

  const getDeclaredSize = (index) => {
    const item = bookMetadata?.items?.[index];
    return item ? { width: item.width, height: item.height } : {};
  };

  /** Resolves the ordered candidate URLs for one leaf and quality level. */
  const getPage = async (index, quality = 'magazine', signal) => {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const leaf = clampLeaf(index, pageCount);
    const declared = getDeclaredSize(leaf);
    const archivePageUrl = getPageUrl(identifier, leaf, quality);
    const candidates = Array.from(
      new Set(
        [
          // The generated Archive page is the most reliable source for this
          // publication. Route it through a CORS-enabled image proxy first so
          // it can be uploaded to WebGL instead of merely displayed in <img>.
          getXRTextureUrl(archivePageUrl, quality),
          getIiifPageUrl(bookMetadata, leaf, quality),
          archivePageUrl,
          getIiifBodyImageUrl(bookMetadata, leaf)
        ].filter(Boolean)
      )
    );
    const key = `${leaf}:${quality}`;
    const preferredUrl = preferredUrls.get(key);
    const urls = preferredUrl && candidates.includes(preferredUrl)
      ? [preferredUrl, ...candidates.filter((url) => url !== preferredUrl)]
      : candidates;

    return {
      index: leaf,
      url: urls[0],
      fallbackUrls: urls.slice(1),
      width: declared.width,
      height: declared.height
    };
  };

  /** Downloads one image completely so a later Babylon texture load can use
   * the browser HTTP cache without retaining the decoded bitmap in JS memory. */
  const fetchPageIntoBrowserCache = async (index, quality) => {
    const page = await getPage(index, quality, prefetchAbortController.signal);
    const candidates = [page.url, ...(page.fallbackUrls ?? [])].filter(Boolean);

    for (const url of candidates) {
      try {
        const response = await fetch(url, {
          cache: 'force-cache',
          mode: 'cors',
          signal: prefetchAbortController.signal
        });
        if (!response.ok) continue;

        // Reading the body to completion is required before the HTTP cache can
        // reliably satisfy a later image/texture request.
        await response.blob();
        preferredUrls.set(`${page.index}:${quality}`, url);
        return true;
      } catch (err) {
        if (prefetchAbortController.signal.aborted) return false;
      }
    }

    return false;
  };

  const runPrefetchTask = (task) => {
    activePrefetches += 1;
    task.started = true;

    fetchPageIntoBrowserCache(task.index, task.quality)
      .then((loaded) => {
        if (loaded) completedPrefetches.add(task.key);
        task.resolve(loaded);
      })
      .catch(() => task.resolve(false))
      .finally(() => {
        activePrefetches -= 1;
        pendingPrefetches.delete(task.key);
        pumpPrefetchQueue();
      });
  };

  const pumpPrefetchQueue = () => {
    while (!disposed && activePrefetches < PREFETCH_CONCURRENCY && prefetchQueue.length) {
      runPrefetchTask(prefetchQueue.shift());
    }
  };

  const enqueuePrefetch = (index, quality, priority, deferPump = false) => {
    if (disposed) return Promise.resolve(false);

    const leaf = clampLeaf(index, pageCount);
    const key = `${leaf}:${quality}`;
    if (completedPrefetches.has(key)) return Promise.resolve(true);

    const existing = pendingPrefetches.get(key);
    if (existing) {
      if (priority && !existing.task.started) {
        const queueIndex = prefetchQueue.indexOf(existing.task);
        if (queueIndex >= 0) {
          prefetchQueue.splice(queueIndex, 1);
          prefetchQueue.unshift(existing.task);
        }
      }
      return existing.promise;
    }

    let resolveTask;
    const promise = new Promise((resolve) => {
      resolveTask = resolve;
    });
    const task = { key, index: leaf, quality, resolve: resolveTask, started: false };
    pendingPrefetches.set(key, { promise, task });
    if (priority) prefetchQueue.unshift(task);
    else prefetchQueue.push(task);
    if (!deferPump) pumpPrefetchQueue();
    return promise;
  };

  return {
    publicationId: identifier,
    title,
    pageCount,
    initialPageIndex: currentPage,

    getPage,

    /**
     * Warms the browser cache for upcoming leaves. Individual failures are
     * swallowed: a prefetch miss must never surface as a session error.
     */
    async prefetchPages(indices, quality = 'magazine', { priority = false } = {}) {
      const validIndices = indices.filter((index) => index >= 0 && index < pageCount);
      // Priority insertion uses unshift, so reverse first to retain caller order.
      const scheduledIndices = priority ? [...validIndices].reverse() : validIndices;
      const promises = scheduledIndices.map(
        (index) => enqueuePrefetch(index, quality, priority, true)
      );
      pumpPrefetchQueue();
      await Promise.all(promises);
    },

    setCurrentPage(index) {
      const next = clampLeaf(index, pageCount);

      if (next === currentPage) {
        return;
      }

      currentPage = next;
      onPageChange?.(next);

      for (const listener of listeners) {
        listener(next);
      }
    },

    getCurrentPage() {
      return currentPage;
    },

    subscribeToCurrentPage(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      disposed = true;
      prefetchAbortController.abort();
      for (const task of prefetchQueue) task.resolve(false);
      prefetchQueue.length = 0;
      pendingPrefetches.clear();
      completedPrefetches.clear();
      preferredUrls.clear();
      listeners.clear();
    }
  };
}
