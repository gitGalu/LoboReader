import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { Button, KIND, SIZE } from 'baseui/button'
import db from '../Components/Db';
import ItemDrawer from '../Components/ItemDrawer';
import ItemMetadataListItem from '../Components/ItemMetadataListItem';
import Masonry from 'masonry-layout';

const Collection = (props) => {
  const [browserItems, setBrowserItems] = useState([]);
  const [initial, setInitial] = useState(true);
  const [gridView, setGridView] = useState(
    JSON.parse(localStorage.getItem('collection.gridView')) || false
  );
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const navigate = useNavigate();
  const location = useLocation();
  const drawer = React.useRef(null);
  const masonryContainerRef = React.useRef(null);
  const masonryInstance = React.useRef(null);
  const prevColumnCount = React.useRef(null);
  const lastGridView = React.useRef(gridView);
  const resizeTimeout = React.useRef(null);

  const gutter = gridView ? 16 : 0;
  const getColumnCount = () => {
    if (!gridView) return 1;
    const width = viewportWidth;
    if (width >= 1440) return 8;
    if (width >= 1280) return 7;
    if (width >= 1120) return 6;
    if (width >= 960) return 5;
    if (width >= 760) return 4;
    return 3;
  };
  const columnCount = getColumnCount();
  const columnWidthValue = gridView
    ? `calc((100% - ${(columnCount - 1) * gutter}px)/${columnCount})`
    : '100%';

  useEffect(() => {
    reloadDb();
  }, []);

  useEffect(() => {
    return () => {
      masonryInstance.current?.destroy();
      masonryInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const handleDebounced = () => {
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current);
      }
      resizeTimeout.current = setTimeout(() => {
        setViewportWidth(window.innerWidth || 1200);
        masonryInstance.current?.reloadItems();
        masonryInstance.current?.layout();
      }, 120);
    };
    window.addEventListener('resize', handleDebounced);
    window.addEventListener('orientationchange', handleDebounced);
    return () => {
      window.removeEventListener('resize', handleDebounced);
      window.removeEventListener('orientationchange', handleDebounced);
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!gridView) {
      masonryInstance.current?.destroy();
      masonryInstance.current = null;
      lastGridView.current = gridView;
      return;
    }
    if (!masonryContainerRef.current || browserItems.length === 0) {
      return;
    }

    const gridChanged = lastGridView.current !== gridView;
    const needsNewInstance = !masonryInstance.current || gridChanged || prevColumnCount.current !== columnCount;
    if (needsNewInstance) {
      masonryInstance.current?.destroy();
      masonryInstance.current = new Masonry(masonryContainerRef.current, {
        itemSelector: '.masonry-item',
        columnWidth: '.masonry-sizer',
        gutter,
        percentPosition: true,
        transitionDuration: '0.2s'
      });
    } else {
      masonryInstance.current.options.gutter = gutter;
    }

    lastGridView.current = gridView;
    prevColumnCount.current = columnCount;

    const masonry = masonryInstance.current;
    masonry.reloadItems();
    requestAnimationFrame(() => masonry.layout());
  }, [browserItems, columnCount, gridView, gutter, columnWidthValue]);

  const reloadDb = () => {
    db.collection
      .filter((item) => {
        return item.archived === false;
      })
      .toArray()
      .then((items) => {
        items.sort((a, b) => {
          const lastOpenedDiff = new Date(b.lastOpenedAt || 0) - new Date(a.lastOpenedAt || 0);
          if (lastOpenedDiff !== 0) {
            return lastOpenedDiff;
          }

          return (a.title || '').localeCompare(b.title || '');
        });
        setBrowserItems(items)
        setInitial(false)
      });
  }

  const handleItemClick = async (event, identifier) => {
    navigate(`${process.env.PUBLIC_URL}/read/${identifier}/p/c`, { state: { backgroundLocation: location } });
  }

  const handleEditClick = (event, item, title) => {
    event.stopPropagation();
    drawer.current.showDrawer(item, title);
  }

  const archiveItem = (identifier) => {
    db.collection.update({ id: identifier }, { archived: true })
      .then(() => {
        drawer.current.hideDrawer();
        setBrowserItems((prev) => prev.filter((item) => item.id !== identifier));
      });
  }

  const handleImageLoad = () => {
    requestAnimationFrame(() => masonryInstance.current?.layout());
  }

  const renderDataItem = ({ id, title, disabled }) => (
    <ItemMetadataListItem
      title={title}
      identifier={id}
      mediatype="text"
      gridView={gridView}
      disabled={disabled}
      onEditClick={(event) => handleEditClick(event, id, title)}
      onSelectItem={(event) => handleItemClick(event, id)}
      onImageLoad={handleImageLoad}
      showGridTitle={false}
    />
  );

  const renderData = () => {
    return (
      <div style={{ paddingTop: gridView ? '12px' : '0px', paddingRight: '16px' }}>
        {gridView ? (
          <div className="masonry-container" ref={masonryContainerRef} key="grid">
            <div className="masonry-sizer" style={{ width: columnWidthValue }} aria-hidden />
            {browserItems.map((item) => (
              <div
                className="masonry-item"
                key={item.id}
                style={{ width: columnWidthValue, marginBottom: `${gutter}px` }}
              >
                {renderDataItem(item)}
              </div>
            ))}
          </div>
        ) : (
          <div className="cover-grid cover-grid--list">
            {browserItems.map((item) => (
              <div className="cover-grid__item" key={item.id}>
                {renderDataItem(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderEmpty = () => {
    return (
      initial
        ? (
          <div className="loadingState" id="go">
            <span className="loadingSpinner" aria-hidden="true" />
            <span>Loading...</span>
          </div>
        )
        : (
          <div className="statusCard" id="go">
            <div className="statusTitle">Your Collection is empty.</div>
            <div className="statusText">Save issues from Browse to build a reading list here.</div>
          </div>
        )
    );
  }

  return (
    <div className="page">
      <ItemDrawer
        ref={drawer}
        buttonCount={1}
        buttonLabel={(index, identifier, title) => {
          switch (index) {
            case 0:
              return 'Remove item'
            default:
              return ''
          }
        }}
        buttonAction={(index, identifier, title) => {
          switch (index) {
            case 0:
              archiveItem(identifier);
              break;
            default:
              break;
          }
        }}
      />

      <div style={{ fontSize: '85%', paddingTop: '0px', paddingBottom: '24px', color: '#cbcbcb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingRight: '16px' }}>
        <div style={{ paddingTop: '6px' }}>Your Collection</div>
        <span>
          <Button
            size={SIZE.mini}
            kind={KIND.tertiary}
            onClick={() => {
              setGridView(!gridView);
              localStorage.setItem('collection.gridView', JSON.stringify(!gridView));
            }}
            overrides={{
              Root: {
                style: ({ $theme }) => ({
                  backgroundColor: 'rgb(246, 246, 246)',
                  width: '96px'
                })
              }
            }}
          >{gridView ? "List View" : "Grid View"}</Button>
        </span>
      </div>

      {(browserItems.length > 0 && !initial)
        ?
        renderData()
        :
        renderEmpty()
      }
    </div>
  )
}

export default Collection;
