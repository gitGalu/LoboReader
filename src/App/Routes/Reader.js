import React, { useState, useEffect } from 'react';
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

  let { id, prevAction, prevId } = useParams();

  useEffect(() => {
    setError(false);
    InternetArchive.BookManifestAPI.get({ identifier: id })
      .then(bookMetadata => {
        db.collection.get({ id: id })
          .then((item) => {
            if (item == undefined) {
              item = {
                id: id,
                title: item.label,
                page: 0,
                read: false,
                archived: false
              }
              db.collection.put(item, id);
            }
            let pages = getImageItems(bookMetadata);
            setOpen(true);
            initPhotoSwipe(pages, item);
          })
      }).catch(err => {
        setError(true);
      });
  }, []);

  const getImageItems = (bookMetadata) => {
    let items = [];
    let pageCount = bookMetadata.items.length;
    let image_options = '_h2000';

    for (var i = 0; i < pageCount; i++) {
      items.push({
        src: `https://archive.org/download/${id}/page/leaf${i}${image_options}.jpg`,
        alt: '',
        width: bookMetadata.items[i].width,
        height: bookMetadata.items[i].height
      })
    }
    return items;
  }

  const initPhotoSwipe = (pages, item) => {
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
      index: item.page,
      doubleTapAction: (a, e) => {
        let clickX = a.x;
        let pageX = pswp.currSlide.panAreaSize.x;
        let centerX = pageX / 2;
        let fix = (clickX - centerX) / 2;
        clickX = clickX + fix;

        if (pswp.currSlide.currZoomLevel == pswp.currSlide.zoomLevels.initial) {
          pswp.currSlide.zoomTo(pswp.currSlide.zoomLevels.fit * 2.75, { x: clickX, y: a.y }, 0, true);
        } else {
          pswp.currSlide.currentResolution = 0;
          pswp.currSlide.zoomAndPanToInitial();
          pswp.currSlide.applyCurrentZoomPan();
          pswp.currSlide.updateContentSize();
        }
      }
    };

    let pswp = new PhotoSwipe(options);

    pswp.on('change', () => {
      updateIndex(pswp.currIndex, item);
    });

    pswp.on('close', () => {
      close();
    })

    pswp.init();
  }

  const updateIndex = async (pagenum, currentItem) => {
    currentItem.page = pagenum;
    db.collection.put(currentItem, id);
  }

  const close = () => {
    setTimeout(() => {
      if (prevAction != undefined && prevId != undefined) {
        if (prevAction == "s") {
          navigate(`${process.env.PUBLIC_URL}/browse/s/${prevId}`);
        } else {
          navigate(`${process.env.PUBLIC_URL}/browse/${prevId}`);
        }
      } else if (prevAction == "c") {
        navigate(`${process.env.PUBLIC_URL}/collection`);
      } else {
        navigate(`${process.env.PUBLIC_URL}/browse`);
      }
    }, 250);
  }

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
