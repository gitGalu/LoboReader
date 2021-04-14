import React, { useState, useEffect } from 'react';
import { withRouter, useHistory } from 'react-router-dom'
import { StyledSpinnerNext } from 'baseui/spinner';
import { PhotoSwipe } from 'react-pswp';
import 'react-pswp/dist/index.css';
import InternetArchive from '../Components/InternetArchive';
import { Centered } from '../Components/Centered';
import db from '../Components/Db';

function Reader(props) {
  const [browserItems, setBrowserItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const history = useHistory();
  const [currentItem, setCurrentItem] = useState(null);

  let id = props.match.params.id;
  let prevAction = props.match.params.prevAction;
  let prevId = props.match.params.prevId;

  useEffect(() => {
    InternetArchive.BookManifestAPI.get({ identifier: id }).then(bookMetadata => {
      db.collection.get({ id: id })
        .then((item) => {
          if (item != undefined) {
            setCurrentItem(item);
            setIndex(item.page);
          } else {
            item = {
              id: bookMetadata.itemId,
              title: bookMetadata.title,
              page: 0,
              read: false,
              archived: false
            }
            setCurrentItem(item);
            setIndex(0);
            db.collection.put(currentItem, id);
          }
          let pages = getImageItems(bookMetadata);
          setBrowserItems(pages);
          setOpen(true);
        });
    });
  }, []);

  const getImageItems = (bookMetadata) => {
    let items = [];
    let pageCount = bookMetadata.numPages;
    let image_options = '_h1000';

    for (var i = 0; i < pageCount; i++) {
      let minWidthToScale = (bookMetadata.pageWidths[i] > 3000);

      items.push({
        src: `https://archive.org/download/${id}/page/leaf${i}${image_options}.jpg`,
        w: minWidthToScale ? (bookMetadata.pageWidths[i] / 2) : bookMetadata.pageWidths[i],
        h: minWidthToScale ? (bookMetadata.pageHeights[i] / 2) : bookMetadata.pageHeights[i]
      })
    }
    return items;
  }

  const updateIndex = async (pagenum) => {
    currentItem.page = pagenum;
    db.collection.put(currentItem, id);
  }

  let options = {
    index: 0,
    showAnimationDuration: 0,
    hideAnimationDuration: 0,
    fullscreenEl: false,
    allowPanToNext: true,
    bgOpacity: 1,
    pinchToClose: false,
    closeOnScroll: false,
    closeOnVerticalDrag: false,
    maxSpreadZoom: 3,
    barsSize: { top: 16, bottom: 'auto' },
    timeToIdle: 3000,
    timeToIdleOutside: 1000,
    captionEl: false,
    arrowEl: true,
    zoomEl: false,
    tapToClose: false,
    tapToToggleControls: true,
    clickToCloseNonZoomable: false,
    getDoubleTapZoom: function (isMouseClick, item) {
      return item.initialZoomLevel * 3;
    },
    history: false,
    preload: [1, 2],
    modal: false,
  };
  
  const setOpened = (state) => {
    if (!state) {
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
    }
  }

  return (
    <div>
      {!open
        ?
        (<div>
          <div className="page"><br /><Centered><StyledSpinnerNext /></Centered></div>
        </div>)
        :
        (<PhotoSwipe
          container={browserItems}
          onIndexChange={updateIndex}
          onOpenChange={setOpened.bind(this)}
          index={index}
          open={open}
          options={options}
          theme={{
            foreground: '#ffffff',
            background: '#000000',
          }}
        />)

      }
    </div>
  )
}

export default withRouter(Reader);
