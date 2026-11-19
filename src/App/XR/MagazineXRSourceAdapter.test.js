import { createMagazineXRSource } from './MagazineXRSourceAdapter';

const manifest = (pageCount) => ({
  items: Array.from({ length: pageCount }, (_, i) => ({
    width: 1200,
    height: 1600,
    label: `leaf${i}`
  }))
});

const makeSource = (overrides = {}) =>
  createMagazineXRSource({
    identifier: 'test-magazine',
    title: 'Test Magazine',
    bookMetadata: manifest(10),
    initialPageIndex: 0,
    onPageChange: () => {},
    ...overrides
  });

describe('publication mapping', () => {
  test('maps manifest and identity onto the source contract', () => {
    const source = makeSource();

    expect(source.publicationId).toBe('test-magazine');
    expect(source.title).toBe('Test Magazine');
    expect(source.pageCount).toBe(10);
  });

  test('clamps an out-of-range starting page into the issue', () => {
    expect(makeSource({ initialPageIndex: 999 }).initialPageIndex).toBe(9);
    expect(makeSource({ initialPageIndex: -4 }).initialPageIndex).toBe(0);
  });

  test('survives an empty manifest', () => {
    const source = makeSource({ bookMetadata: { items: [] } });

    expect(source.pageCount).toBe(0);
    expect(source.initialPageIndex).toBe(0);
  });
});

describe('getPage', () => {
  test('returns declared dimensions without preloading the image in the DOM', async () => {
    const page = await makeSource().getPage(2, 'magazine');

    expect(page).toMatchObject({
      index: 2,
      width: 1200,
      height: 1600,
      url:
        'https://wsrv.nl/?url=https%3A%2F%2Farchive.org%2Fdownload%2Ftest-magazine%2Fpage%2Fleaf2_h2400.jpg&h=2400&we=1&output=jpg&q=95'
    });
  });

  test('provides download and body URLs as fallbacks for an IIIF service', async () => {
    const bookMetadata = manifest(2);
    bookMetadata.items[0].items = [
      {
        items: [
          {
            body: {
              id: 'https://example.test/original.jpg',
              service: [{ id: 'https://example.test/iiif' }]
            }
          }
        ]
      }
    ];

    const page = await makeSource({ bookMetadata }).getPage(0, 'magazine');

    expect(page.url).toBe(
      'https://wsrv.nl/?url=https%3A%2F%2Farchive.org%2Fdownload%2Ftest-magazine%2Fpage%2Fleaf0_h2400.jpg&h=2400&we=1&output=jpg&q=95'
    );
    expect(page.fallbackUrls).toEqual([
      'https://example.test/iiif/full/1600,/0/default.jpg',
      'https://archive.org/download/test-magazine/page/leaf0_h2400.jpg',
      'https://example.test/original.jpg'
    ]);
  });
});

describe('prefetchPages', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('downloads pages with at most two concurrent transfers', async () => {
    let active = 0;
    let maximumActive = 0;
    global.fetch = jest.fn(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      return {
        ok: true,
        async blob() {
          await Promise.resolve();
          active -= 1;
          return {};
        }
      };
    });
    const source = makeSource();

    await source.prefetchPages([0, 1, 2, 3, 4], 'magazine');

    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(maximumActive).toBe(2);
    source.dispose();
  });

  test('retains caller order when a batch is promoted ahead of the queue', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, blob: async () => ({}) }));
    const source = makeSource();

    await source.prefetchPages([4, 2, 3], 'magazine', { priority: true });

    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      expect.stringContaining('leaf4_h2400'),
      expect.stringContaining('leaf2_h2400'),
      expect.stringContaining('leaf3_h2400')
    ]);
    source.dispose();
  });

  test('remembers a working fallback so texture loading skips a failed primary', async () => {
    const bookMetadata = manifest(1);
    bookMetadata.items[0].items = [{
      items: [{
        body: {
          id: 'https://example.test/original.jpg',
          service: [{ id: 'https://example.test/iiif' }]
        }
      }]
    }];
    global.fetch = jest.fn(async (url) => ({
      ok: url.startsWith('https://example.test/iiif'),
      blob: async () => ({})
    }));
    const source = makeSource({ bookMetadata });

    await expect(source.prefetchPages([0], 'reading')).resolves.toBeUndefined();
    const page = await source.getPage(0, 'reading');

    expect(page.url).toBe('https://example.test/iiif/full/2400,/0/default.jpg');
    source.dispose();
  });

  test('isolates a missing page instead of rejecting the queue', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    });
    const source = makeSource();

    await expect(source.prefetchPages([0, 1], 'magazine')).resolves.toBeUndefined();
    source.dispose();
  });
});

describe('setCurrentPage', () => {
  test('writes back to app state on change', () => {
    const onPageChange = jest.fn();
    const source = makeSource({ onPageChange });

    source.setCurrentPage(4);

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  test('does not write again for the same page', () => {
    const onPageChange = jest.fn();
    const source = makeSource({ onPageChange });

    source.setCurrentPage(4);
    source.setCurrentPage(4);
    source.setCurrentPage(4);

    expect(onPageChange).toHaveBeenCalledTimes(1);
  });

  test('clamps writes to the issue boundaries', () => {
    const onPageChange = jest.fn();
    const source = makeSource({ onPageChange });

    source.setCurrentPage(500);

    expect(onPageChange).toHaveBeenCalledWith(9);
    expect(source.getCurrentPage()).toBe(9);
  });
});

describe('subscribeToCurrentPage', () => {
  test('notifies subscribers of page changes', () => {
    const source = makeSource();
    const listener = jest.fn();

    source.subscribeToCurrentPage(listener);
    source.setCurrentPage(3);

    expect(listener).toHaveBeenCalledWith(3);
  });

  test('stops notifying after unsubscribe', () => {
    const source = makeSource();
    const listener = jest.fn();

    const unsubscribe = source.subscribeToCurrentPage(listener);
    unsubscribe();
    source.setCurrentPage(3);

    expect(listener).not.toHaveBeenCalled();
  });

  test('dispose drops all subscribers', () => {
    const source = makeSource();
    const listener = jest.fn();

    source.subscribeToCurrentPage(listener);
    source.dispose();
    source.setCurrentPage(5);

    expect(listener).not.toHaveBeenCalled();
  });
});
