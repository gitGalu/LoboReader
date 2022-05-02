import React, { useState, useEffect } from 'react';
import { withRouter, useHistory } from 'react-router-dom'
import { Spinner } from 'baseui/spinner';
import { Centered } from '../Components/Centered';
import PhotoSwipe from 'photoswipe';
import InternetArchive from '../Components/InternetArchive';
import db from '../Components/Db';
import 'photoswipe/style.css';

function Reader(props) {
  const [open, setOpen] = useState(false);
  const history = useHistory();

  let id = props.match.params.id;
  let prevAction = props.match.params.prevAction;
  let prevId = props.match.params.prevId;

  useEffect(() => {
    InternetArchive.BookManifestAPI.get({ identifier: id }).then(bookMetadata => {
      db.collection.get({ id: id })
        .then((item) => {
          if (item == undefined) {
            item = {
              id: bookMetadata.itemId,
              title: bookMetadata.title,
              page: 0,
              read: false,
              archived: false
            }
            db.collection.put(item, id);
          }
          let pages = getImageItems(bookMetadata);
          setOpen(true);
          initPhotoSwipe(pages, item);
        });
    });
  }, []);

  const getImageItems = (bookMetadata) => {
    let items = [];
    let pageCount = bookMetadata.numPages;
    let image_options = '_h1500';

    for (var i = 0; i < pageCount; i++) {
      items.push({
        src: `https://archive.org/download/${id}/page/leaf${i}${image_options}.jpg`,
        width: bookMetadata.pageWidths[i],
        height: bookMetadata.pageHeights[i],
        alt: ''
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
          history.push(`${process.env.PUBLIC_URL}/browse/s/${prevId}`);
        } else {
          history.push(`${process.env.PUBLIC_URL}/browse/${prevId}`);
        }
      } else if (prevAction == "c") {
        history.push(`${process.env.PUBLIC_URL}/collection`);
      } else {
        history.push(`${process.env.PUBLIC_URL}/browse`);
      }
    }, 250);
  }

  return (
    <div>
      {
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

export default withRouter(Reader);
