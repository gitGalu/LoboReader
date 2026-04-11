import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, KIND, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Slider } from 'baseui/slider';
import { Spinner } from 'baseui/spinner';
import { Centered } from '../Components/Centered';
import PhotoSwipe from 'photoswipe';
import InternetArchive from '../Components/InternetArchive';
import db from '../Components/Db';
import 'photoswipe/style.css';

function Reader(props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [readerState, setReaderState] = useState({ page: 0, pageCount: 0 });
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("1");
  const [jumpStartPage, setJumpStartPage] = useState(0);
  const [readerControlsVisible, setReaderControlsVisible] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const pswpRef = useRef(null);
  const lastPreviewedPageRef = useRef(null);
  const closeHandledRef = useRef(false);

  let { id, prevAction, prevId } = useParams();

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
    const imageOptions = '_h2000';

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
      if (location.state?.backgroundLocation) {
        navigate(-1);
      } else if (prevAction !== undefined && prevId !== undefined) {
        if (prevAction === "s") {
          navigate(`${process.env.PUBLIC_URL}/browse/s/${prevId}`);
        } else {
          navigate(`${process.env.PUBLIC_URL}/browse/${prevId}`);
        }
      } else if (prevAction === "c") {
        navigate(`${process.env.PUBLIC_URL}/collection`);
      } else {
        navigate(`${process.env.PUBLIC_URL}/browse`);
      }
    }, 250);
  }, [location.state, navigate, prevAction, prevId]);

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

  const clampPageNumber = useCallback((pageNumber, pageCount) => {
    const parsedPage = Number.parseInt(pageNumber, 10);
    if (!Number.isFinite(parsedPage)) {
      return 1;
    }

    return Math.min(Math.max(parsedPage, 1), pageCount || 1);
  }, []);

  const openJumpPanel = useCallback(() => {
    setJumpStartPage(readerState.page);
    setJumpValue(String(readerState.page + 1));
    setReaderControlsVisible(true);
    setJumpOpen(true);
  }, [readerState.page]);

  const previewPage = useCallback((pageNumber) => {
    const pageCount = readerState.pageCount;
    if (!pageCount) {
      return;
    }

    const normalizedPage = clampPageNumber(pageNumber, pageCount);
    const pageIndex = normalizedPage - 1;
    if (lastPreviewedPageRef.current === pageIndex) {
      return;
    }

    lastPreviewedPageRef.current = pageIndex;
    pswpRef.current?.goTo(pageIndex);
    setReaderState((state) => ({ ...state, page: pageIndex }));
  }, [clampPageNumber, readerState.pageCount]);

  const initPhotoSwipe = useCallback((pages, item) => {
    const startingPage = Math.min(Math.max(Number(item.page) || 0, 0), pages.length - 1);
    const currentItem = {
      ...item,
      page: startingPage,
      pageCount: pages.length
    };

    setReaderState({ page: startingPage, pageCount: pages.length });
    setJumpValue(String(startingPage + 1));
    lastPreviewedPageRef.current = startingPage;

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
      lastPreviewedPageRef.current = pswp.currIndex;
      setReaderState({ page: pswp.currIndex, pageCount: pages.length });
      setJumpValue(String(pswp.currIndex + 1));
      updateIndex(pswp.currIndex, currentItem);
    });

    pswp.on('tapAction', () => {
      setReaderControlsVisible((visible) => !visible);
    });

    pswp.on('close', () => {
      close();
    });

    pswp.init();
  }, [close, updateIndex]);

  const renderJumpControls = () => {
    if (!open || readerState.pageCount <= 0) {
      return null;
    }

    const pageNumber = readerState.page + 1;
    const selectedPage = clampPageNumber(jumpValue, readerState.pageCount);
    const canReturnToStartPage = jumpStartPage !== readerState.page;
    const controlsClassName = readerControlsVisible || jumpOpen
      ? 'readerControls'
      : 'readerControls readerControls--hidden';

    const controls = (
      <div className={controlsClassName}>
        <button
          type="button"
          className="readerCloseButton"
          aria-label="Close reader"
          onClick={(event) => {
            event.stopPropagation();
            pswpRef.current?.close();
          }}
          onPointerDown={(event) => event.stopPropagation()}>
          ×
        </button>
        <button
          type="button"
          className="readerPageChip"
          onClick={(event) => {
            event.stopPropagation();
            openJumpPanel();
          }}
          onPointerDown={(event) => event.stopPropagation()}>
          {pageNumber} / {readerState.pageCount}
        </button>
        {jumpOpen && (
          <div
            className="readerJumpOverlay"
            onClick={() => setJumpOpen(false)}
            onPointerDown={(event) => event.stopPropagation()}>
            <form
              className="readerJumpPanel"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                previewPage(jumpValue);
              }}>
              <div className="readerJumpTitle">Jump to page</div>
              <div className="readerJumpMeta">Selected {selectedPage} / {readerState.pageCount}</div>
              <div className="readerJumpRange">
                <Slider
                  value={[selectedPage]}
                  min={1}
                  max={readerState.pageCount}
                  step={1}
                  onChange={({ value }) => setJumpValue(String(value[0]))}
                  onFinalChange={({ value }) => {
                    setJumpValue(String(value[0]));
                    previewPage(value[0]);
                  }}
                />
              </div>
              <div className="readerJumpActions">
                <Button
                  disabled={!canReturnToStartPage}
                  kind={KIND.secondary}
                  size={BUTTON_SIZE.compact}
                  type="button"
                  onClick={() => {
                    const startPageNumber = jumpStartPage + 1;
                    setJumpValue(String(startPageNumber));
                    previewPage(startPageNumber);
                  }}>
                  Back to {jumpStartPage + 1}
                </Button>
                <Button
                  size={BUTTON_SIZE.compact}
                  type="button"
                  onClick={() => setJumpOpen(false)}>
                  Close
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    );

    return createPortal(controls, document.body);
  }

  useEffect(() => {
    let cancelled = false;

    const loadReader = async () => {
      closeHandledRef.current = false;
      setOpen(false);
      setError(false);

      try {
        const bookMetadata = await InternetArchive.BookManifestAPI.get({ identifier: id });
        if (cancelled) {
          return;
        }

        let item = await db.collection.get({ id });
        const fallbackTitle = getManifestTitle(bookMetadata);

        if (item === undefined) {
          item = {
            id,
            title: fallbackTitle,
            page: 0,
            read: false,
            archived: false,
            lastOpenedAt: new Date().toISOString()
          };
        } else {
          item = {
            ...item,
            title: item.title || fallbackTitle,
            archived: false,
            lastOpenedAt: new Date().toISOString()
          };
        }

        await db.collection.put(item, id);
        if (cancelled) {
          return;
        }

        const pages = getImageItems(bookMetadata);
        if (pages.length === 0) {
          throw new Error('No readable pages found');
        }

        setOpen(true);
        initPhotoSwipe(pages, item);
      } catch (err) {
        if (!cancelled) {
          setError(true);
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
  }, [getImageItems, getManifestTitle, id, initPhotoSwipe]);

  return (
    <div>
      {
        error ? (<div className="page"><Centered>Error loading data from the Internet Archive.</Centered></div>) :
          !open
            ?
            (<div>
              <div className="page"><br /><Centered><Spinner /></Centered></div>
            </div>)
            :
            (<div>
              {renderJumpControls()}
            </div>)
      }
    </div>
  )
}

export default Reader;
