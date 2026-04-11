import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom'
import { Spinner } from 'baseui/spinner';
import { Centered } from '../Components/Centered';
import PhotoSwipe from 'photoswipe';
import InternetArchive from '../Components/InternetArchive';
import db from '../Components/Db';
import 'photoswipe/style.css';

function Reader(props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  const pswpRef = useRef(null);

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
    setTimeout(() => {
      if (prevAction !== undefined && prevId !== undefined) {
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
  }, [navigate, prevAction, prevId]);

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

  const initPhotoSwipe = useCallback((pages, item) => {
    const currentItem = {
      ...item,
      pageCount: pages.length
    };
    const options = {
      mainClass: 'pswp--styles',
      arrowPrev: false,
      arrowNext: false,
      zoom: false,
      close: true,
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
      index: currentItem.page,
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
      updateIndex(pswp.currIndex, currentItem);
    });

    pswp.on('close', () => {
      close();
    });

    pswp.init();
  }, [close, updateIndex]);

  useEffect(() => {
    let cancelled = false;

    const loadReader = async () => {
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
            </div>)
      }
    </div>
  )
}

export default Reader;
