import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ThemeProvider } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { ArrowLeft, Delete as CloseIcon } from 'baseui/icon';
import { Centered } from '../Components/Centered';
import PhotoSwipe from 'photoswipe';
import InternetArchive from '../Components/InternetArchive';
import PageThumbnailGrid from '../Components/PageThumbnailGrid';
import readerTheme from '../Components/readerTheme';
import db from '../Components/Db';
import {
  READER_LAUNCH_CANCEL_EVENT,
  hideReaderLaunchOverlay,
  resetPwaChromeColor,
  setPwaChromeColor,
  showReaderLaunchOverlay
} from '../Components/PwaChrome';
import 'photoswipe/style.css';

// Base Web has no grid icon; this one sits in the page chip's startEnhancer.
const PagesIcon = () => (
  <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true">
    <rect x="2" y="2" width="6.5" height="6.5" rx="1.5" />
    <rect x="11.5" y="2" width="6.5" height="6.5" rx="1.5" />
    <rect x="2" y="11.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="11.5" y="11.5" width="6.5" height="6.5" rx="1.5" />
  </svg>
);

// Keeps taps on reader controls from reaching PhotoSwipe (which would toggle
// the controls or start a swipe).
const stopPropagation = (event) => event.stopPropagation();

function Reader(props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [readerState, setReaderState] = useState({ page: 0, pageCount: 0 });
  const [readerControlsVisible, setReaderControlsVisible] = useState(true);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [thumbnailsMounted, setThumbnailsMounted] = useState(false);
  const [returnPage, setReturnPage] = useState(null);
  const [pageItems, setPageItems] = useState([]);
  const [returnPillVisible, setReturnPillVisible] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const pswpRef = useRef(null);
  const closeHandledRef = useRef(false);
  const backgroundLocationRef = useRef(location.state?.backgroundLocation);
  const pagesHistoryTokenRef = useRef(null);
  const returnPillTimerRef = useRef(null);

  // Read through a ref so `close` (and with it PhotoSwipe) doesn't get
  // re-created when the router hands us a fresh location.state object,
  // e.g. after popping the page overview's history entry.
  backgroundLocationRef.current = location.state?.backgroundLocation;

  let { id, prevAction, prevId } = useParams();

  const setReaderViewportActive = useCallback((active) => {
    document.documentElement.classList.toggle('readerActive', active);
    document.body.classList.toggle('readerActive', active);
  }, []);

  useLayoutEffect(() => {
    showReaderLaunchOverlay();
    setReaderViewportActive(true);
    setPwaChromeColor('#000000');
    return () => {
      setReaderViewportActive(false);
      hideReaderLaunchOverlay();
      resetPwaChromeColor();
    };
  }, [setReaderViewportActive]);

  const notifyReaderReady = useCallback(() => {
    hideReaderLaunchOverlay();
  }, []);

  const getManifestTitle = useCallback((bookMetadata) => {
    const label = bookMetadata?.label;

    if (typeof label === 'string') {
      return label;
    }

    if (label?.none?.length) {
      return label.none[0];
    }

    return id;
  }, [id]);

  const getImageItems = useCallback((bookMetadata) => {
    const pageCount = bookMetadata?.items?.length ?? 0;
    const imageOptions = '_h2400';

    return Array.from({ length: pageCount }, (_, index) => ({
      src: `https://archive.org/download/${id}/page/leaf${index}${imageOptions}.jpg`,
      alt: '',
      width: bookMetadata.items[index].width,
      height: bookMetadata.items[index].height
    }));
  }, [id]);

  const close = useCallback(() => {
    if (closeHandledRef.current) {
      return;
    }

    closeHandledRef.current = true;
    setTimeout(() => {
      if (backgroundLocationRef.current) {
        navigate(-1);
      } else if (prevAction !== undefined && prevId !== undefined) {
        if (prevAction === "s") {
          // useParams hands the search text back decoded: encode it again.
          navigate(`${process.env.PUBLIC_URL}/browse/s/${encodeURIComponent(prevId)}`);
        } else {
          navigate(`${process.env.PUBLIC_URL}/browse/${encodeURIComponent(prevId)}`);
        }
      } else if (prevAction === "c") {
        navigate(`${process.env.PUBLIC_URL}/collection`);
      } else {
        navigate(`${process.env.PUBLIC_URL}/browse`);
      }
    }, 250);
  }, [navigate, prevAction, prevId]);

  // "Go back" on a launch that's taking too long: leave the way × would.
  // close() also marks the launch as handled, so a manifest that arrives late
  // doesn't open the reader after all (see loadReader).
  useEffect(() => {
    const handleCancel = () => close();
    window.addEventListener(READER_LAUNCH_CANCEL_EVENT, handleCancel);
    return () => window.removeEventListener(READER_LAUNCH_CANCEL_EVENT, handleCancel);
  }, [close]);

  const updateIndex = useCallback(async (pageNum, currentItem) => {
    if (!currentItem) {
      return;
    }

    const updatedItem = {
      ...currentItem,
      page: pageNum,
      lastOpenedAt: new Date().toISOString(),
      read: pageNum >= 1 && pageNum === currentItem.pageCount - 1
    };

    await db.collection.put(updatedItem, id);
  }, [id]);

  // The page overview gets its own history entry (same URL), so the Android
  // back button / back gesture closes the overview instead of the reader.
  const openThumbnails = useCallback(() => {
    setReaderControlsVisible(true);
    setReturnPillVisible(false);
    setThumbnailsMounted(true);
    setThumbnailsOpen(true);

    const token = `pages-${Date.now()}`;
    pagesHistoryTokenRef.current = token;
    window.history.pushState({ ...window.history.state, loboReaderPages: token }, '');
  }, []);

  const closeThumbnails = useCallback(() => {
    setThumbnailsOpen(false);

    const token = pagesHistoryTokenRef.current;
    pagesHistoryTokenRef.current = null;
    if (token && window.history.state?.loboReaderPages === token) {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    if (!thumbnailsOpen) {
      return undefined;
    }

    const handlePopState = () => {
      if (window.history.state?.loboReaderPages !== pagesHistoryTokenRef.current) {
        pagesHistoryTokenRef.current = null;
        setThumbnailsOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [thumbnailsOpen]);

  const showReturnPill = useCallback(() => {
    clearTimeout(returnPillTimerRef.current);
    setReturnPillVisible(true);
    returnPillTimerRef.current = setTimeout(() => setReturnPillVisible(false), 6000);
  }, []);

  useEffect(() => () => clearTimeout(returnPillTimerRef.current), []);

  const selectPage = useCallback((pageIndex) => {
    closeThumbnails();

    if (pageIndex !== readerState.page) {
      setReturnPage(readerState.page);
      pswpRef.current?.goTo(pageIndex);
      showReturnPill();
    }
  }, [closeThumbnails, readerState.page, showReturnPill]);

  const initPhotoSwipe = useCallback((pages, item) => {
    const startingPage = Math.min(Math.max(Number(item.page) || 0, 0), pages.length - 1);
    const currentItem = {
      ...item,
      page: startingPage,
      pageCount: pages.length
    };

    setReaderState({ page: startingPage, pageCount: pages.length });

    const options = {
      mainClass: 'pswp--styles',
      arrowPrev: false,
      arrowNext: false,
      zoom: false,
      close: false,
      counter: false,
      bgOpacity: 1.0,
      showHideAnimationType: 'zoom',
      zoomAnimationDuration: false,
      spacing: 0,
      allowPanToNext: true,
      loop: false,
      preload: [1, 2],
      preloaderDelay: 0,
      errorMsg: 'The page cannot be loaded',
      dataSource: pages,
      index: startingPage,
      doubleTapAction: (point) => {
        const pswp = pswpRef.current;

        if (!pswp?.currSlide) {
          return;
        }

        let clickX = point.x;
        const pageX = pswp.currSlide.panAreaSize.x;
        const centerX = pageX / 2;
        const fix = (clickX - centerX) / 2;
        clickX = clickX + fix;

        if (pswp.currSlide.currZoomLevel === pswp.currSlide.zoomLevels.initial) {
          pswp.currSlide.zoomTo(pswp.currSlide.zoomLevels.fit * 2.75, { x: clickX, y: point.y }, 0, true);
        } else {
          pswp.currSlide.currentResolution = 0;
          pswp.currSlide.zoomAndPanToInitial();
          pswp.currSlide.applyCurrentZoomPan();
          pswp.currSlide.updateContentSize();
        }
      }
    };

    const pswp = new PhotoSwipe(options);
    pswpRef.current = pswp;

    pswp.on('change', () => {
      currentItem.page = pswp.currIndex;
      setReaderState({ page: pswp.currIndex, pageCount: pages.length });
      updateIndex(pswp.currIndex, currentItem);
    });

    pswp.on('tapAction', () => {
      setReaderControlsVisible((visible) => !visible);
    });

    pswp.on('close', () => {
      setReaderViewportActive(false);
      close();
    });

    pswp.on('openingAnimationEnd', () => {
      notifyReaderReady();
    });

    pswp.init();
    window.setTimeout(notifyReaderReady, 1000);
  }, [close, notifyReaderReady, setReaderViewportActive, updateIndex]);

  const renderReaderControls = () => {
    if (!open || readerState.pageCount <= 0) {
      return null;
    }

    const pageNumber = readerState.page + 1;
    const controlsClassName = readerControlsVisible || thumbnailsOpen
      ? 'readerControls'
      : 'readerControls readerControls--hidden';

    const controls = (
      <ThemeProvider theme={readerTheme}>
        <div className={controlsClassName}>
          <div className="readerCloseButton" onClick={stopPropagation} onPointerDown={stopPropagation}>
            <Button
              type="button"
              kind={KIND.secondary}
              shape={SHAPE.circle}
              size={SIZE.compact}
              aria-label="Close reader"
              onClick={() => pswpRef.current?.close()}>
              <CloseIcon size={24} />
            </Button>
          </div>
          <div className="readerPageChip" onClick={stopPropagation} onPointerDown={stopPropagation}>
            <Button
              type="button"
              kind={KIND.secondary}
              shape={SHAPE.pill}
              size={SIZE.compact}
              aria-label={`Page ${pageNumber} of ${readerState.pageCount}. Show pages`}
              startEnhancer={PagesIcon}
              onClick={openThumbnails}>
              {pageNumber} / {readerState.pageCount}
            </Button>
          </div>
          {returnPillVisible && returnPage !== null && returnPage !== readerState.page && (
            <div className="readerReturnPill" onClick={stopPropagation} onPointerDown={stopPropagation}>
              <Button
                type="button"
                kind={KIND.primary}
                shape={SHAPE.pill}
                size={SIZE.compact}
                aria-label={`Back to page ${returnPage + 1}`}
                startEnhancer={() => <ArrowLeft size={18} />}
                onClick={() => selectPage(returnPage)}>
                {returnPage + 1}
              </Button>
            </div>
          )}
          {thumbnailsMounted && (
            <PageThumbnailGrid
              key={id}
              open={thumbnailsOpen}
              identifier={id}
              pages={pageItems}
              currentPage={readerState.page}
              returnPage={returnPage}
              onSelect={selectPage}
              onClose={closeThumbnails}
            />
          )}
        </div>
      </ThemeProvider>
    );

    return createPortal(controls, document.body);
  }

  useEffect(() => {
    let cancelled = false;

    const loadReader = async () => {
      closeHandledRef.current = false;
      setOpen(false);
      setError(false);
      setThumbnailsOpen(false);
      setThumbnailsMounted(false);
      setPageItems([]);
      setReturnPage(null);
      setReturnPillVisible(false);

      try {
        const bookMetadata = await InternetArchive.BookManifestAPI.get({ identifier: id });
        if (cancelled || closeHandledRef.current) {
          return;
        }

        let item = await db.collection.get({ id });
        const fallbackTitle = getManifestTitle(bookMetadata);
        const now = new Date().toISOString();

        if (item === undefined) {
          item = {
            id,
            title: fallbackTitle,
            page: 0,
            read: false,
            archived: false,
            addedAt: now,
            lastOpenedAt: now
          };
        } else {
          item = {
            ...item,
            title: item.title || fallbackTitle,
            archived: false,
            addedAt: item.addedAt || now,
            lastOpenedAt: now
          };
        }

        await db.collection.put(item, id);
        if (cancelled || closeHandledRef.current) {
          return;
        }

        const pages = getImageItems(bookMetadata);
        if (pages.length === 0) {
          throw new Error('No readable pages found');
        }

        setPageItems(pages);
        setOpen(true);
        initPhotoSwipe(pages, item);
      } catch (err) {
        if (!cancelled && !closeHandledRef.current) {
          setError(true);
          notifyReaderReady();
        }
      }
    };

    loadReader();

    return () => {
      cancelled = true;
      if (pswpRef.current) {
        closeHandledRef.current = true;
        pswpRef.current.destroy();
        pswpRef.current = null;
      }
    };
  }, [getImageItems, getManifestTitle, id, initPhotoSwipe, notifyReaderReady]);

  return (
    <div>
      {
        error ? (<div className="page"><Centered>Error loading data from the Internet Archive.</Centered></div>) :
          !open
            ?
            null
            :
            (<div>
              {renderReaderControls()}
            </div>)
      }
    </div>
  )
}

export default Reader;
