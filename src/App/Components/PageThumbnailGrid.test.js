import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import PageThumbnailGrid, { DENSITY_STORAGE_KEY, buildSpreads, getPageThumbnailUrl } from './PageThumbnailGrid';
import InternetArchive from './InternetArchive';

jest.mock('./InternetArchive', () => ({
  __esModule: true,
  default: {
    FullTextAPI: {
      source: jest.fn(),
      pageNumbers: jest.fn(),
      search: jest.fn()
    }
  }
}));

const { FullTextAPI } = InternetArchive;
const textSource = { server: 'ia800800.us.archive.org', path: '/8/items/x', doc: 'x', pageNumbersFile: 'x_page_numbers.json' };

let container;
let root;

const pages = [
  { width: 1000, height: 1300 },
  { width: 1000, height: 1300 },
  { width: 2000, height: 1300 },
  {}
];

const renderGrid = (props = {}) => {
  const handlers = { onSelect: jest.fn(), onClose: jest.fn() };

  act(() => {
    root.render(
      <PageThumbnailGrid
        identifier="byte-magazine-1975-09"
        pages={pages}
        currentPage={2}
        {...handlers}
        {...props}
      />
    );
  });

  return handlers;
};

const thumbs = () => Array.from(container.querySelectorAll('.readerThumb'));
const slider = () => container.querySelector('[role="slider"]');
const findButton = (text) => Array.from(container.querySelectorAll('button'))
  .find((button) => (text instanceof RegExp ? text.test(button.textContent) : button.textContent === text));

beforeEach(() => {
  window.localStorage.removeItem(DENSITY_STORAGE_KEY);
  FullTextAPI.source.mockReset().mockResolvedValue(null);
  FullTextAPI.pageNumbers.mockReset().mockResolvedValue(null);
  FullTextAPI.search.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('builds Internet Archive thumbnail URLs', () => {
  expect(getPageThumbnailUrl('byte-magazine-1975-09', 7)).toBe(
    'https://archive.org/download/byte-magazine-1975-09/page/leaf7_w200.jpg'
  );
  expect(getPageThumbnailUrl('abc', 0, 100)).toBe('https://archive.org/download/abc/page/leaf0_w100.jpg');
});

test('renders one lazy thumbnail per page and marks the current page', () => {
  renderGrid();

  expect(container.querySelector('.readerThumbsScrubLabel').textContent).toBe('3 of 4');

  expect(thumbs()).toHaveLength(4);
  expect(thumbs()[2].getAttribute('aria-current')).toBe('page');
  expect(container.querySelectorAll('[aria-current]')).toHaveLength(1);

  const images = container.querySelectorAll('.readerThumb img');
  expect(images[1].getAttribute('src')).toBe(getPageThumbnailUrl('byte-magazine-1975-09', 1));
  expect(images[1].getAttribute('loading')).toBe('lazy');
});

test('reserves space using page aspect ratios, with a fallback', () => {
  renderGrid();

  const frames = container.querySelectorAll('.readerThumbFrame');
  expect(frames[2].style.aspectRatio).toBe('2000 / 1300');
  expect(frames[3].style.aspectRatio).toBe('3 / 4');
});

test('selecting a thumbnail reports its index', () => {
  const { onSelect } = renderGrid();

  act(() => thumbs()[1].click());

  expect(onSelect).toHaveBeenCalledWith(1);
});

test('Escape closes the overview and does not reach document listeners', () => {
  const { onClose } = renderGrid();
  const documentListener = jest.fn();
  document.addEventListener('keydown', documentListener);

  act(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  expect(onClose).toHaveBeenCalledTimes(1);
  expect(documentListener).not.toHaveBeenCalled();
  document.removeEventListener('keydown', documentListener);
});

test('slider starts at the current page and scrubs the grid without jumping', () => {
  const { onSelect } = renderGrid();
  expect(slider().getAttribute('aria-valuenow')).toBe('3');

  const scrollIntoView = jest.fn();
  thumbs()[1].scrollIntoView = scrollIntoView;

  act(() => {
    slider().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  });

  expect(slider().getAttribute('aria-valuenow')).toBe('2');
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  expect(thumbs()[1].className).toContain('readerThumb--scrub');
  expect(container.querySelector('.readerThumbsScrubLabel').textContent).toBe('2 of 4');
  // The page being read stays marked on the track (index 2 of 0..3).
  expect(Number(container.querySelector('.readerThumbsCurrentTick').style.getPropertyValue('--reader-tick-position')))
    .toBeCloseTo(2 / 3);
  expect(onSelect).not.toHaveBeenCalled();
});

test('offers a way back to the page before the last jump', () => {
  const { onSelect } = renderGrid({ returnPage: 0 });

  const back = findButton('Back to 1');
  expect(back).toBeTruthy();

  act(() => back.click());
  expect(onSelect).toHaveBeenCalledWith(0);
});

test('hides the way back when there is nowhere to return to', () => {
  renderGrid({ returnPage: 2 });
  expect(findButton(/^Back to/)).toBeUndefined();

  renderGrid({ returnPage: null });
  expect(findButton(/^Back to/)).toBeUndefined();
});

test('close button closes the overview', () => {
  const { onClose } = renderGrid();

  act(() => container.querySelector('button[aria-label="Close pages"]').click());

  expect(onClose).toHaveBeenCalledTimes(1);
});

test('hiding keeps loaded thumbnails in the DOM and reopening re-centres on the current page', () => {
  renderGrid({ currentPage: 1 });
  const firstImage = container.querySelector('.readerThumb img');

  const { onClose } = renderGrid({ currentPage: 1, open: false });
  const view = container.querySelector('.readerThumbs');
  expect(view.hidden).toBe(true);
  expect(container.querySelector('.readerThumb img')).toBe(firstImage);

  // Escape is ignored while hidden, so it reaches PhotoSwipe as usual.
  act(() => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(onClose).not.toHaveBeenCalled();

  const scrollIntoView = jest.fn();
  thumbs()[3].scrollIntoView = scrollIntoView;
  renderGrid({ currentPage: 3, open: true });

  expect(view.hidden).toBe(false);
  expect(container.querySelector('.readerThumb img')).toBe(firstImage);
  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  expect(slider().getAttribute('aria-valuenow')).toBe('4');
});

describe('buildSpreads', () => {
  const portrait = { width: 1000, height: 1300 };
  const landscape = { width: 2000, height: 1300 };

  test('puts the cover alone, then facing pairs', () => {
    expect(buildSpreads(Array(6).fill(portrait))).toEqual([[0], [1, 2], [3, 4], [5]]);
    expect(buildSpreads(Array(5).fill(portrait))).toEqual([[0], [1, 2], [3, 4]]);
  });

  test('keeps landscape scans (already spreads) on their own', () => {
    expect(buildSpreads([portrait, portrait, landscape, portrait, portrait]))
      .toEqual([[0], [1], [2], [3, 4]]);
  });

  test('handles tiny and empty issues', () => {
    expect(buildSpreads([])).toEqual([]);
    expect(buildSpreads([portrait])).toEqual([[0]]);
    expect(buildSpreads([portrait, portrait])).toEqual([[0], [1]]);
  });

  test('pairs pages with unknown dimensions', () => {
    expect(buildSpreads([{}, {}, {}])).toEqual([[0], [1, 2]]);
  });
});

test('renders the cover as a right-hand page and pairs the rest', () => {
  renderGrid();

  const spreads = Array.from(container.querySelectorAll('.readerSpread'));
  // fixture: 0 portrait, 1 portrait, 2 landscape, 3 unknown
  expect(spreads.map((spread) => spread.className)).toEqual([
    'readerSpread readerSpread--recto',
    'readerSpread readerSpread--verso',
    'readerSpread readerSpread--wide',
    'readerSpread readerSpread--verso'
  ]);
});

test('hides thumbnails that fail to load instead of showing a broken image', () => {
  renderGrid();
  const image = container.querySelector('.readerThumb img');

  act(() => {
    image.dispatchEvent(new Event('error'));
  });

  expect(image.style.visibility).toBe('hidden');
});

test('re-centres on the scrubbed page when the grid width changes', () => {
  const observers = [];
  window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    unobserve() {}
    disconnect() {}
  };

  renderGrid();
  const scroll = container.querySelector('.readerThumbsScroll');
  const scrollIntoView = jest.fn();
  thumbs()[2].scrollIntoView = scrollIntoView;

  Object.defineProperty(scroll, 'clientWidth', { configurable: true, value: 800 });
  act(() => observers
    .filter((observer) => observer.targets.includes(scroll))
    .forEach((observer) => observer.callback([])));

  expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  delete window.ResizeObserver;
});

const flush = () => act(async () => {
  await Promise.resolve();
  await Promise.resolve();
});

const typeInto = (input, value) => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('with OCR text available', () => {
  beforeEach(() => {
    FullTextAPI.source.mockResolvedValue(textSource);
    FullTextAPI.pageNumbers.mockResolvedValue({
      confidence: 90,
      pages: [{ leafNum: 1, pageNumber: '2' }, { leafNum: 2, pageNumber: '3' }]
    });
  });

  test('labels thumbnails with printed page numbers', async () => {
    renderGrid();
    await flush();

    const labels = Array.from(container.querySelectorAll('.readerThumbLabel')).map((label) => label.textContent);
    expect(labels).toEqual(['\u00a0', '2', '3', '\u00a0']);
    expect(container.querySelector('.readerThumbsFolio').textContent).toBe('p. 3');
  });

  test('searches the issue and jumps to a result', async () => {
    FullTextAPI.search.mockResolvedValue({
      indexed: true,
      matches: [{ text: 'the <IA_FTS_MATCH>Altair</IA_FTS_MATCH> Computer', par: [{ page: 1 }] }]
    });
    const { onSelect } = renderGrid();
    await flush();

    act(() => container.querySelector('button[aria-label="Search this issue"]').click());
    expect(container.querySelector('.readerSearch').hidden).toBe(false);
    expect(container.querySelector('.readerThumbsScroll').hidden).toBe(true);
    // Cancel takes the close button's place while searching.
    expect(container.querySelector('.readerThumbsClose').hidden).toBe(true);

    const input = container.querySelector('input[aria-label="Search this issue"]');
    expect(document.activeElement).toBe(input);
    // type="search" would make Safari add its own clear button next to Base Web's.
    expect(input.type).toBe('text');
    expect(input.getAttribute('enterkeyhint')).toBe('search');
    expect(container.querySelector('.readerSearchStatus')).toBeNull();
    typeInto(input, 'altair');
    await act(async () => {
      input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(FullTextAPI.search).toHaveBeenCalledWith({ identifier: 'byte-magazine-1975-09', source: textSource, q: 'altair' });
    expect(container.querySelector('.readerSearchStatus').textContent).toBe('1 match on 1 page');
    const result = container.querySelector('.readerSearchList button');
    expect(result.getAttribute('aria-label')).toBe('p. 2, 1 match');
    expect(result.textContent).toMatch(/^p\. 2/);
    expect(result.querySelector('.readerSearchSnippet b').textContent).toBe('Altair');

    act(() => result.click());
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  test('typing reaches the search field but not PhotoSwipe, and Escape leaves search first', async () => {
    const { onClose } = renderGrid();
    await flush();
    act(() => container.querySelector('button[aria-label="Search this issue"]').click());

    const input = container.querySelector('input[aria-label="Search this issue"]');
    const inputListener = jest.fn();
    const documentListener = jest.fn();
    input.addEventListener('keydown', inputListener);
    document.addEventListener('keydown', documentListener);

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(inputListener).toHaveBeenCalled();
    expect(documentListener).not.toHaveBeenCalled();

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('.readerSearch').hidden).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    document.removeEventListener('keydown', documentListener);
  });

  test('reports search failures', async () => {
    FullTextAPI.search.mockRejectedValue(new Error('offline'));
    renderGrid();
    await flush();
    act(() => container.querySelector('button[aria-label="Search this issue"]').click());

    const input = container.querySelector('input[aria-label="Search this issue"]');
    typeInto(input, 'altair');
    await act(async () => {
      input.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(container.querySelector('.readerSearchStatus').textContent).toMatch(/Search failed/);
  });
});

test('hides search when the issue has no OCR text', async () => {
  renderGrid();
  await flush();

  expect(container.querySelector('button[aria-label="Search this issue"]')).toBeNull();
  expect(container.querySelector('.readerThumbLabel').textContent).toBe('1');
});

test('fits the view above the on-screen keyboard (visualViewport)', () => {
  const viewport = new EventTarget();
  viewport.height = window.innerHeight;
  viewport.offsetTop = 0;
  window.visualViewport = viewport;

  renderGrid();
  const root = container.querySelector('.readerThumbs');
  expect(root.classList.contains('readerThumbs--keyboard')).toBe(false);

  act(() => {
    viewport.height = window.innerHeight - 300;
    viewport.offsetTop = 40;
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(root.classList.contains('readerThumbs--keyboard')).toBe(true);
  expect(root.style.height).toBe(`${window.innerHeight - 300}px`);
  expect(root.style.transform).toBe('translateY(40px)');

  act(() => {
    viewport.height = window.innerHeight;
    viewport.offsetTop = 0;
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(root.classList.contains('readerThumbs--keyboard')).toBe(false);
  expect(root.style.height).toBe('');

  delete window.visualViewport;
});

describe('layout density', () => {
  const grid = () => container.querySelector('.readerThumbsGrid');
  const densityButton = () => container.querySelector('.readerThumbsDensity button');

  const touch = (type, points) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperty(event, 'touches', { value: points.map(([clientX, clientY]) => ({ clientX, clientY })) });
    act(() => {
      container.querySelector('.readerThumbsScroll').dispatchEvent(event);
    });
  };

  test('defaults to larger pages and toggles, remembering the choice', () => {
    renderGrid();
    expect(grid().classList.contains('readerThumbsGrid--compact')).toBe(false);
    expect(densityButton().getAttribute('aria-label')).toBe('Show more pages per row');

    act(() => densityButton().click());
    expect(grid().classList.contains('readerThumbsGrid--compact')).toBe(true);
    expect(densityButton().getAttribute('aria-label')).toBe('Show larger pages');
    expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact');

    act(() => root.unmount());
    root = createRoot(container);
    renderGrid();
    expect(grid().classList.contains('readerThumbsGrid--compact')).toBe(true);
  });

  test('pinching in packs more per row, pinching out makes pages larger', () => {
    renderGrid();

    touch('touchstart', [[100, 100], [200, 100]]);
    touch('touchmove', [[120, 100], [180, 100]]);
    touch('touchend', []);
    expect(grid().classList.contains('readerThumbsGrid--compact')).toBe(true);

    touch('touchstart', [[120, 100], [180, 100]]);
    touch('touchmove', [[90, 100], [210, 100]]);
    touch('touchend', []);
    expect(grid().classList.contains('readerThumbsGrid--compact')).toBe(false);
  });

  test('a small two-finger wobble or a one-finger scroll does not switch', () => {
    renderGrid();

    touch('touchstart', [[100, 100], [200, 100]]);
    touch('touchmove', [[105, 100], [198, 100]]);
    touch('touchend', []);
    touch('touchstart', [[100, 100]]);
    touch('touchmove', [[100, 300]]);
    touch('touchend', []);

    expect(grid().classList.contains('readerThumbsGrid--compact')).toBe(false);
  });

  test('the switch steps aside while searching', async () => {
    FullTextAPI.source.mockResolvedValue(textSource);
    renderGrid();
    await flush();

    act(() => container.querySelector('button[aria-label="Search this issue"]').click());
    expect(container.querySelector('.readerThumbsDensity').closest('[hidden]')).not.toBeNull();
  });
});
