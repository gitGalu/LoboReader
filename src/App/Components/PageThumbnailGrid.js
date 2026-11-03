import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ThemeProvider } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Delete as CloseIcon, Search as SearchIcon } from 'baseui/icon';
import { Slider } from 'baseui/slider';
import InternetArchive from './InternetArchive';
import { parsePageNumbers } from './FullTextSearch';
import PageSearch from './PageSearch';
import { getPageThumbnailUrl } from './pageThumbnails';
import readerTheme from './readerTheme';

export { THUMBNAIL_WIDTH, getPageThumbnailUrl } from './pageThumbnails';

const DEFAULT_ASPECT_RATIO = '3 / 4';

// After we scroll the grid ourselves (slider scrubbing), ignore scroll events
// for a moment so the scroll→slider sync doesn't fight the slider→scroll sync.
const PROGRAMMATIC_SCROLL_GRACE_MS = 250;

// Two layouts of the overview, chosen with the corner button or by pinching:
// "comfortable" (one spread per row on a phone in portrait, headlines legible)
// and "compact" (more spreads per row). Remembered across issues.
export const DENSITY_STORAGE_KEY = 'loboReader.pageOverviewDensity';
const PINCH_IN_RATIO = 0.83;
const PINCH_OUT_RATIO = 1.2;

const readStoredDensity = () => {
  try {
    return window.localStorage.getItem(DENSITY_STORAGE_KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch (err) {
    return 'comfortable';
  }
};

const touchDistance = (touches) => Math.hypot(
  touches[0].clientX - touches[1].clientX,
  touches[0].clientY - touches[1].clientY
);

// One spread per row (switch target when compact).
const ComfortableIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
    <rect x="2" y="3" width="7.75" height="6" rx="1" />
    <rect x="10.25" y="3" width="7.75" height="6" rx="1" />
    <rect x="2" y="11" width="7.75" height="6" rx="1" />
    <rect x="10.25" y="11" width="7.75" height="6" rx="1" />
  </svg>
);

// Two spreads per row (switch target when comfortable).
const CompactIcon = () => (
  <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true">
    <rect x="1.5" y="4" width="3.4" height="4.5" rx="0.6" />
    <rect x="5.1" y="4" width="3.4" height="4.5" rx="0.6" />
    <rect x="11.5" y="4" width="3.4" height="4.5" rx="0.6" />
    <rect x="15.1" y="4" width="3.4" height="4.5" rx="0.6" />
    <rect x="1.5" y="11.5" width="3.4" height="4.5" rx="0.6" />
    <rect x="5.1" y="11.5" width="3.4" height="4.5" rx="0.6" />
    <rect x="11.5" y="11.5" width="3.4" height="4.5" rx="0.6" />
    <rect x="15.1" y="11.5" width="3.4" height="4.5" rx="0.6" />
  </svg>
);

// Visual viewport shorter than the window by more than this = keyboard is up
// (rather than just browser chrome collapsing).
const KEYBOARD_THRESHOLD_PX = 120;

const isLandscape = (page) => Number(page?.width) > Number(page?.height);

// Groups pages the way a printed magazine is laid out: the cover on its own
// (as a right-hand page), then facing pairs 2–3, 4–5, ... A landscape scan is
// already a spread, so it stands alone, as does a trailing back cover.
export const buildSpreads = (pages) => {
  const spreads = [];
  let index = 0;

  while (index < pages.length) {
    const next = index + 1;
    const pairable = index > 0
      && next < pages.length
      && !isLandscape(pages[index])
      && !isLandscape(pages[next]);

    if (pairable) {
      spreads.push([index, next]);
      index += 2;
    } else {
      spreads.push([index]);
      index += 1;
    }
  }

  return spreads;
};

const getSpreadClassName = (spread, pages) => {
  if (spread.length === 2) {
    return 'readerSpread';
  }

  if (isLandscape(pages[spread[0]])) {
    return 'readerSpread readerSpread--wide';
  }

  return spread[0] === 0 ? 'readerSpread readerSpread--recto' : 'readerSpread readerSpread--verso';
};

const hideBrokenImage = (event) => {
  event.currentTarget.style.visibility = 'hidden';
};

// Loads, once per issue, what's needed for search and printed page numbers.
// Both are optional: issues without OCR simply don't get them.
const useBookText = (identifier, pageCount) => {
  const [bookText, setBookText] = useState({ source: null, pageNumbers: null });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const source = await InternetArchive.FullTextAPI.source(identifier);
        if (cancelled || !source) {
          return;
        }

        setBookText({ source, pageNumbers: null });
        const json = await InternetArchive.FullTextAPI.pageNumbers({ identifier, source });
        if (!cancelled) {
          setBookText({ source, pageNumbers: parsePageNumbers(json, pageCount) });
        }
      } catch (err) {
        // Search and printed numbers are extras; the overview works without them.
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [identifier, pageCount]);

  return bookText;
};

const sliderOverrides = {
  Root: { style: { paddingTop: 0, paddingBottom: 0 } },
  // Default track padding indents the slider well past the footer text below;
  // keep just enough room for the thumb to stay inside the footer.
  Track: { style: { paddingLeft: '10px', paddingRight: '10px' } },
  // The position is shown in the footer row (with the printed page number),
  // so the slider's own min/max labels and value bubble would only repeat it.
  TickBar: { style: { display: 'none' } },
  ThumbValue: { style: { display: 'none' } }
};

const getAspectRatio = (page) => {
  const width = Number(page?.width);
  const height = Number(page?.height);

  if (width > 0 && height > 0) {
    return `${width} / ${height}`;
  }

  return DEFAULT_ASPECT_RATIO;
};

// Stays mounted (just hidden) after the first open, for as long as the same
// magazine is open: thumbnails that have loaded stay in the DOM, so reopening
// the view never re-requests them. archive.org's thumbnail redirects aren't
// cacheable and alternate between mirrors, so the HTTP cache can't be relied on.
function PageThumbnailGrid({ identifier, pages, currentPage, returnPage = null, open = true, onSelect, onClose }) {
  const pageCount = pages.length;
  const scrollRef = useRef(null);
  const thumbRefs = useRef([]);
  const scrubbingRef = useRef(false);
  const ignoreScrollUntilRef = useRef(0);
  const scrollFrameRef = useRef(null);
  const [scrubIndex, setScrubIndex] = useState(currentPage);
  const spreads = useMemo(() => buildSpreads(pages), [pages]);
  const scrubIndexRef = useRef(scrubIndex);
  scrubIndexRef.current = scrubIndex;
  const rootRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMounted, setSearchMounted] = useState(false);
  const { source: textSource, pageNumbers } = useBookText(identifier, pageCount);
  const [density, setDensity] = useState(readStoredDensity);
  const pinchRef = useRef(null);

  const changeDensity = useCallback((next) => {
    setDensity(next);
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch (err) {
      // Private mode etc.: the choice just isn't remembered.
    }
  }, []);

  const openSearch = () => {
    setSearchMounted(true);
    setSearchOpen(true);
  };

  const handleEscape = useCallback(() => {
    if (searchOpen) {
      setSearchOpen(false);
    } else {
      onClose();
    }
  }, [onClose, searchOpen]);

  const scrollToThumb = useCallback((index) => {
    ignoreScrollUntilRef.current = performance.now() + PROGRAMMATIC_SCROLL_GRACE_MS;
    thumbRefs.current[index]?.scrollIntoView?.({ block: 'center' });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    setScrubIndex(currentPage);
    scrollToThumb(currentPage);
    // Only when the view opens: the page can't change while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    // Capture phase on window runs before PhotoSwipe's document listener,
    // so Escape/arrow keys don't close the reader or turn pages underneath.
    // Keys typed inside the view (e.g. in the search field) must reach their
    // target, so those are stopped on the way back up instead (handleRootKeyDown).
    const handleKeyDown = (event) => {
      if (rootRef.current?.contains(event.target)) {
        return;
      }

      event.stopPropagation();

      if (event.key === 'Escape') {
        event.preventDefault();
        handleEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleEscape, open]);

  const handleRootKeyDown = (event) => {
    event.stopPropagation();

    if (event.key === 'Escape') {
      event.preventDefault();
      handleEscape();
    }
  };

  useEffect(() => () => cancelAnimationFrame(scrollFrameRef.current), []);

  // A new layout moves everything; stay on the page the slider points at.
  useLayoutEffect(() => {
    if (open) {
      scrollToThumb(scrubIndexRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density]);

  // Pinch out = bigger pages, pinch in = more per row; one switch per gesture.
  const handleTouchStart = (event) => {
    pinchRef.current = event.touches.length === 2
      ? { startDistance: touchDistance(event.touches), switched: false }
      : null;
  };

  const handleTouchMove = (event) => {
    const pinch = pinchRef.current;
    if (!pinch || pinch.switched || event.touches.length !== 2 || pinch.startDistance === 0) {
      return;
    }

    const ratio = touchDistance(event.touches) / pinch.startDistance;
    if (ratio >= PINCH_OUT_RATIO) {
      pinch.switched = true;
      changeDensity('comfortable');
    } else if (ratio <= PINCH_IN_RATIO) {
      pinch.switched = true;
      changeDensity('compact');
    }
  };

  const handleTouchEnd = (event) => {
    if (event.touches.length < 2) {
      pinchRef.current = null;
    }
  };

  // iOS doesn't shrink the layout when the on-screen keyboard opens, so a
  // bottom-anchored search bar would end up underneath it. Fit the view to the
  // visual viewport (the part above the keyboard) while the keyboard is up.
  useEffect(() => {
    const root = rootRef.current;
    const viewport = window.visualViewport;
    if (!open || !root || !viewport) {
      return undefined;
    }

    const update = () => {
      const keyboardOpen = window.innerHeight - viewport.height > KEYBOARD_THRESHOLD_PX;
      root.classList.toggle('readerThumbs--keyboard', keyboardOpen);
      root.style.height = keyboardOpen ? `${viewport.height}px` : '';
      root.style.bottom = keyboardOpen ? 'auto' : '';
      root.style.transform = keyboardOpen ? `translateY(${viewport.offsetTop}px)` : '';
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.classList.remove('readerThumbs--keyboard');
      root.style.height = '';
      root.style.bottom = '';
      root.style.transform = '';
    };
  }, [open]);

  // Rotating the phone (or resizing a window) changes the column count, which
  // leaves the scroll offset pointing at unrelated pages: re-centre instead.
  useEffect(() => {
    const container = scrollRef.current;
    if (!open || !container || typeof ResizeObserver !== 'function') {
      return undefined;
    }

    let lastWidth = container.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = container.clientWidth;
      if (width > 0 && width !== lastWidth) {
        lastWidth = width;
        scrollToThumb(scrubIndexRef.current);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [open, scrollToThumb]);

  const handleScroll = () => {
    if (scrubbingRef.current || performance.now() < ignoreScrollUntilRef.current) {
      return;
    }

    cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      const container = scrollRef.current;
      if (!container || typeof document.elementFromPoint !== 'function') {
        return;
      }

      const rect = container.getBoundingClientRect();
      const element = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const thumb = element?.closest?.('.readerThumb');
      const index = Number(thumb?.dataset.index);

      if (Number.isInteger(index)) {
        setScrubIndex(index);
      }
    });
  };

  const handleSliderChange = ({ value }) => {
    const index = Math.min(Math.max(Number(value?.[0]) - 1, 0), pageCount - 1);
    scrubbingRef.current = true;
    setScrubIndex(index);
    scrollToThumb(index);
  };

  const stopScrubbing = () => {
    scrubbingRef.current = false;
    ignoreScrollUntilRef.current = performance.now() + PROGRAMMATIC_SCROLL_GRACE_MS;
  };

  const canReturn = Number.isInteger(returnPage) && returnPage !== currentPage
    && returnPage >= 0 && returnPage < pageCount;

  const scrubPrinted = pageNumbers?.[scrubIndex];

  return (
    <ThemeProvider theme={readerTheme}>
      <div
        ref={rootRef}
        className={open ? 'readerThumbs' : 'readerThumbs readerThumbs--hidden'}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Pages"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={handleRootKeyDown}
        // PhotoSwipe traps focus inside its own element; without this it would
        // steal focus back from the search field.
        onFocus={(event) => event.stopPropagation()}>
        {searchMounted && (
          <PageSearch
            identifier={identifier}
            source={textSource}
            pageCount={pageCount}
            currentPage={currentPage}
            printedPageNumbers={pageNumbers}
            active={searchOpen}
            onSelect={onSelect}
            onExit={() => setSearchOpen(false)}
          />
        )}
        {/* Top right, where the reader's own × is; kept away from the search
            button in the footer so the two can't be mistaken for each other. */}
        <div className="readerThumbsClose" hidden={searchOpen}>
          <Button
            type="button"
            kind={KIND.secondary}
            shape={SHAPE.circle}
            size={SIZE.compact}
            aria-label="Close pages"
            onClick={onClose}>
            <CloseIcon size={24} />
          </Button>
        </div>
        <div
          className="readerThumbsScroll"
          ref={scrollRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          hidden={searchOpen}>
          <div className={density === 'compact' ? 'readerThumbsGrid readerThumbsGrid--compact' : 'readerThumbsGrid'}>
            {spreads.map((spread) => (
              <div key={spread[0]} className={getSpreadClassName(spread, pages)}>
                {spread.map((index) => {
                  const isCurrent = index === currentPage;
                  const className = [
                    'readerThumb',
                    isCurrent && 'readerThumb--current',
                    index === scrubIndex && !isCurrent && 'readerThumb--scrub'
                  ].filter(Boolean).join(' ');

                  return (
                    <button
                      key={index}
                      ref={(element) => { thumbRefs.current[index] = element; }}
                      type="button"
                      data-index={index}
                      className={className}
                      aria-current={isCurrent ? 'page' : undefined}
                      aria-label={`Page ${index + 1}`}
                      onClick={() => onSelect(index)}>
                      <span className="readerThumbFrame" style={{ aspectRatio: getAspectRatio(pages[index]) }}>
                        <img
                          src={getPageThumbnailUrl(identifier, index)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          draggable={false}
                          onError={hideBrokenImage}
                        />
                      </span>
                      <span className="readerThumbLabel">
                        {pageNumbers ? (pageNumbers[index] || '\u00a0') : index + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="readerThumbsFooter" hidden={searchOpen}>
          <div className="readerThumbsSliderWrap">
            <Slider
              value={[scrubIndex + 1]}
              min={1}
              max={Math.max(pageCount, 1)}
              step={1}
              onChange={handleSliderChange}
              onFinalChange={stopScrubbing}
              valueToLabel={(value) => `Page ${value} of ${pageCount}`}
              overrides={sliderOverrides}
            />
            {/* Where you're reading, marked on the track; the thumb covers it
                when the two meet. */}
            <span
              className="readerThumbsCurrentTick"
              aria-hidden="true"
              style={{ '--reader-tick-position': pageCount > 1 ? currentPage / (pageCount - 1) : 0 }}
            />
          </div>
          <div className="readerThumbsFooterRow">
            {/* Bottom left: a view control like the rest of the footer, within
                thumb reach, at the opposite end from search. */}
            <span className="readerThumbsDensity">
              <Button
                type="button"
                kind={KIND.secondary}
                shape={SHAPE.circle}
                size={SIZE.compact}
                aria-label={density === 'compact' ? 'Show larger pages' : 'Show more pages per row'}
                onClick={() => changeDensity(density === 'compact' ? 'comfortable' : 'compact')}>
                {density === 'compact' ? <ComfortableIcon /> : <CompactIcon />}
              </Button>
            </span>
            <span className="readerThumbsPosition">
              {scrubPrinted && <span className="readerThumbsFolio">p. {scrubPrinted}</span>}
              <span className={scrubPrinted ? 'readerThumbsScrubLabel' : 'readerThumbsScrubLabel readerThumbsFolio'}>
                {scrubIndex + 1} of {pageCount}
              </span>
            </span>
            <span className="readerThumbsActions">
              {canReturn && (
                <Button
                  type="button"
                  kind={KIND.secondary}
                  shape={SHAPE.pill}
                  size={SIZE.compact}
                  onClick={() => onSelect(returnPage)}>
                  Back to {pageNumbers?.[returnPage] ? `p. ${pageNumbers[returnPage]}` : returnPage + 1}
                </Button>
              )}
              {textSource && (
                <Button
                  type="button"
                  kind={KIND.secondary}
                  shape={SHAPE.circle}
                  size={SIZE.compact}
                  aria-label="Search this issue"
                  onClick={openSearch}>
                  <SearchIcon size={20} />
                </Button>
              )}
            </span>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default PageThumbnailGrid;
