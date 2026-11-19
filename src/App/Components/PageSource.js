/**
 * Shared Internet Archive page-image logic.
 *
 * Both the 2D reader and the XR reader build leaf URLs from here so the two
 * views never disagree about what a page index points at.
 */

/**
 * @typedef {'preview' | 'magazine' | 'reading' | 'full'} PageImageQuality
 */

/**
 * @typedef {Object} PageImageSource
 * @property {number} index
 * @property {string} src
 * @property {string} alt
 * @property {number} [width]
 * @property {number} [height]
 */

/**
 * Height suffixes understood by archive.org's page endpoint. `full` omits the
 * suffix entirely, which serves the original scan.
 *
 * @type {Record<PageImageQuality, string>}
 */
export const QUALITY_SUFFIX = {
  preview: '_h800',
  magazine: '_h2400',
  reading: '_h4096',
  full: ''
};

/** Quality used by the existing 2D reader. Kept as the default so extracting
 * this logic out of Reader.js changes no behaviour. */
export const DEFAULT_QUALITY = 'magazine';

/**
 * IIIF Image API size parameters, mirroring QUALITY_SUFFIX.
 *
 * @type {Record<PageImageQuality, string>}
 */
const IIIF_SIZE = {
  // Archive's ImageService implementation reliably supports width-constrained
  // requests. For typical portrait scans these produce the requested height
  // bands while preserving aspect ratio.
  preview: 'full/800,',
  magazine: 'full/1600,',
  reading: 'full/2400,',
  full: 'full/max'
};

/**
 * Public image proxy used by the browser-only XR build when Archive's page
 * endpoint redirects to a host without CORS. It can be replaced by a
 * deployment-owned endpoint. A custom value may either contain a `{url}`
 * placeholder or accept the source URL in a `url` query parameter.
 */
const DEFAULT_XR_IMAGE_PROXY = 'https://wsrv.nl/';

const PROXY_JPEG_QUALITY = {
  preview: 88,
  magazine: 95,
  reading: 95,
  full: 95
};

const PROXY_MAX_HEIGHT = {
  preview: 800,
  magazine: 2400,
  reading: 4096,
  full: null
};

/** Returns the direct image body declared by a IIIF Presentation canvas. */
export function getIiifBodyImageUrl(bookMetadata, index) {
  const id = bookMetadata?.items?.[index]?.items?.[0]?.items?.[0]?.body?.id;
  return typeof id === 'string' ? id : null;
}

/**
 * Reads the IIIF image service base URL for a leaf out of a book manifest.
 *
 * Unlike archive.org/download, iiif.archive.org answers with
 * `access-control-allow-origin: *`, which is what makes these images usable as
 * WebGL textures. A texture built from a non-CORS image is "tainted" and
 * texImage2D rejects it outright, so the XR reader must use this path.
 *
 * @param {any} bookMetadata
 * @param {number} index
 * @returns {string | null} Service base URL, or null when the manifest has no
 *   image service for this leaf.
 */
export function getIiifServiceBase(bookMetadata, index) {
  const canvas = bookMetadata?.items?.[index];
  const service = canvas?.items?.[0]?.items?.[0]?.body?.service?.[0];
  const id = service?.id;

  return typeof id === 'string' ? id : null;
}

/**
 * Builds a CORS-enabled page URL via the IIIF Image API.
 *
 * @param {any} bookMetadata
 * @param {number} index
 * @param {PageImageQuality} [quality]
 * @returns {string | null} Null when the manifest exposes no image service.
 */
export function getIiifPageUrl(bookMetadata, index, quality = DEFAULT_QUALITY) {
  const base = getIiifServiceBase(bookMetadata, index);

  if (!base) {
    return null;
  }

  const size = IIIF_SIZE[quality] ?? IIIF_SIZE[DEFAULT_QUALITY];
  return `${base}/${size}/0/default.jpg`;
}

/**
 * Builds the archive.org download URL for a single leaf.
 *
 * @param {string} identifier
 * @param {number} index Zero-based leaf index.
 * @param {PageImageQuality} [quality]
 * @returns {string}
 */
export function getPageUrl(identifier, index, quality = DEFAULT_QUALITY) {
  const suffix = QUALITY_SUFFIX[quality] ?? QUALITY_SUFFIX[DEFAULT_QUALITY];
  return `https://archive.org/download/${identifier}/page/leaf${index}${suffix}.jpg`;
}

/**
 * Makes an Archive page safe to upload to WebGL as a texture.
 *
 * Archive's generated BookReader images are intentionally kept as the source
 * of truth, but their final `ia*.us.archive.org` response currently lacks an
 * Access-Control-Allow-Origin header. Regular `<img>` elements tolerate that;
 * WebGL texture uploads do not. The proxy response supplies CORS without
 * changing the page mapping.
 *
 * @param {string} sourceUrl An app-generated Archive page URL.
 * @param {PageImageQuality} [quality]
 * @returns {string}
 */
export function getXRTextureUrl(sourceUrl, quality = DEFAULT_QUALITY) {
  const configuredProxy = process.env.REACT_APP_XR_IMAGE_PROXY_URL?.trim();
  const proxy = configuredProxy || DEFAULT_XR_IMAGE_PROXY;
  const encodedSource = encodeURIComponent(sourceUrl);

  if (proxy.includes('{url}')) {
    return proxy.replace('{url}', encodedSource);
  }

  const separator = proxy.includes('?') ? '&' : '?';
  const baseUrl = `${proxy}${separator}url=${encodedSource}`;

  // These options belong to the default wsrv.nl fallback. A custom proxy only
  // receives `url`, so deployments are free to expose a simpler contract.
  if (configuredProxy) {
    return baseUrl;
  }

  const jpegQuality = PROXY_JPEG_QUALITY[quality] ?? PROXY_JPEG_QUALITY[DEFAULT_QUALITY];
  const maxHeight = Object.prototype.hasOwnProperty.call(PROXY_MAX_HEIGHT, quality)
    ? PROXY_MAX_HEIGHT[quality]
    : PROXY_MAX_HEIGHT[DEFAULT_QUALITY];
  const resize = maxHeight ? `&h=${maxHeight}&we=1` : '';
  return `${baseUrl}${resize}&output=jpg&q=${jpegQuality}`;
}

/**
 * Reads the page count out of a IIIF book manifest.
 *
 * @param {any} bookMetadata
 * @returns {number}
 */
export function getPageCount(bookMetadata) {
  return bookMetadata?.items?.length ?? 0;
}

/**
 * Maps a IIIF book manifest to the page list consumed by PhotoSwipe.
 *
 * @param {string} identifier
 * @param {any} bookMetadata
 * @param {PageImageQuality} [quality]
 * @returns {PageImageSource[]}
 */
export function getImageItems(identifier, bookMetadata, quality = DEFAULT_QUALITY) {
  const pageCount = getPageCount(bookMetadata);

  return Array.from({ length: pageCount }, (_, index) => ({
    index,
    src: getPageUrl(identifier, index, quality),
    alt: '',
    width: bookMetadata.items[index].width,
    height: bookMetadata.items[index].height
  }));
}
