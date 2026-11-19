import {
  getIiifBodyImageUrl,
  getIiifPageUrl,
  getIiifServiceBase,
  getPageUrl,
  getXRTextureUrl,
  getImageItems
} from './PageSource';

const SERVICE_ID = 'https://iiif.archive.org/image/iiif/3/test%2Fpage_0000.jp2';

/** Shape mirrors a real IIIF v3 book manifest canvas. */
const manifestWithService = () => ({
  items: [
    {
      width: 2475,
      height: 3461,
      items: [
        {
          items: [
            {
              body: {
                id: 'https://iiif.archive.org/image/iiif/3/test-page/full/max/0/default.jpg',
                service: [{ id: SERVICE_ID, type: 'ImageService3' }]
              }
            }
          ]
        }
      ]
    }
  ]
});

describe('getPageUrl', () => {
  test('builds the download URL used by the 2D reader', () => {
    expect(getPageUrl('mag-1', 4, 'magazine')).toBe(
      'https://archive.org/download/mag-1/page/leaf4_h2400.jpg'
    );
  });

  test('omits the suffix for the original scan', () => {
    expect(getPageUrl('mag-1', 0, 'full')).toBe(
      'https://archive.org/download/mag-1/page/leaf0.jpg'
    );
  });

  test('falls back to the default quality for an unknown value', () => {
    expect(getPageUrl('mag-1', 0, 'bogus')).toBe(getPageUrl('mag-1', 0, 'magazine'));
  });
});

describe('getXRTextureUrl', () => {
  test('wraps an Archive page in the default CORS texture proxy', () => {
    const source = getPageUrl('mag-1', 4, 'magazine');

    expect(getXRTextureUrl(source, 'magazine')).toBe(
      `https://wsrv.nl/?url=${encodeURIComponent(source)}&h=2400&we=1&output=jpg&q=95`
    );
  });

  test('uses a lighter but still readable preview encoding', () => {
    const source = getPageUrl('mag-1', 0, 'preview');

    expect(getXRTextureUrl(source, 'preview')).toContain('&h=800&we=1&output=jpg&q=88');
  });

  test('does not resize a full scan', () => {
    const source = getPageUrl('mag-1', 0, 'full');

    expect(getXRTextureUrl(source, 'full')).not.toContain('&h=');
  });
});

describe('getIiifServiceBase', () => {
  test('reads the image service id out of a canvas', () => {
    expect(getIiifServiceBase(manifestWithService(), 0)).toBe(SERVICE_ID);
  });

  test('returns null when the manifest has no service', () => {
    expect(getIiifServiceBase({ items: [{ width: 1, height: 1 }] }, 0)).toBeNull();
  });

  test('returns null for an out-of-range leaf', () => {
    expect(getIiifServiceBase(manifestWithService(), 99)).toBeNull();
  });

  test('returns null for a malformed manifest', () => {
    expect(getIiifServiceBase(null, 0)).toBeNull();
    expect(getIiifServiceBase({}, 0)).toBeNull();
  });
});

describe('getIiifPageUrl', () => {
  test('appends the IIIF size parameter for each quality', () => {
    const manifest = manifestWithService();

    expect(getIiifPageUrl(manifest, 0, 'preview')).toBe(`${SERVICE_ID}/full/800,/0/default.jpg`);
    expect(getIiifPageUrl(manifest, 0, 'magazine')).toBe(`${SERVICE_ID}/full/1600,/0/default.jpg`);
    expect(getIiifPageUrl(manifest, 0, 'reading')).toBe(`${SERVICE_ID}/full/2400,/0/default.jpg`);
    expect(getIiifPageUrl(manifest, 0, 'full')).toBe(`${SERVICE_ID}/full/max/0/default.jpg`);
  });

  test('returns null when no service is available, so callers can fall back', () => {
    expect(getIiifPageUrl({ items: [{ width: 1, height: 1 }] }, 0)).toBeNull();
  });
});

describe('getIiifBodyImageUrl', () => {
  test('reads the direct image fallback from the canvas body', () => {
    expect(getIiifBodyImageUrl(manifestWithService(), 0)).toContain('test-page');
  });

  test('returns null when the canvas has no image body', () => {
    expect(getIiifBodyImageUrl({ items: [{}] }, 0)).toBeNull();
  });
});

describe('getImageItems', () => {
  test('keeps the declared page dimensions from the manifest', () => {
    const [page] = getImageItems('mag-1', manifestWithService());

    expect(page).toMatchObject({ index: 0, width: 2475, height: 3461 });
  });

  test('returns nothing for an empty manifest', () => {
    expect(getImageItems('mag-1', { items: [] })).toEqual([]);
  });
});
