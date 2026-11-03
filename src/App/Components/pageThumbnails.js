// Internet Archive rounds the requested width to its own scale buckets;
// _w200 yields ~300px wide JPEGs (~20 KB), sharp enough for a 3-4 column grid
// on high-DPI phones.
export const THUMBNAIL_WIDTH = 200;

export const getPageThumbnailUrl = (identifier, pageIndex, width = THUMBNAIL_WIDTH) =>
  `https://archive.org/download/${encodeURIComponent(identifier)}/page/leaf${pageIndex}_w${width}.jpg`;
