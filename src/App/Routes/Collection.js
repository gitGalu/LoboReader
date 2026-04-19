import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { Button, KIND, SIZE } from 'baseui/button'
import db from '../Components/Db';
import ItemDrawer from '../Components/ItemDrawer';
import ItemMetadataListItem from '../Components/ItemMetadataListItem';
import { setPwaChromeColor, showReaderLaunchOverlay } from '../Components/PwaChrome';
import Masonry from 'masonry-layout';

const FILTER_STORAGE_KEY = 'collection.statusFilter';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Not Started' },
  { value: 'started', label: 'Reading' }
];

const getStoredOption = (storageKey, options, fallback) => {
  const storedValue = localStorage.getItem(storageKey);
  return options.some((option) => option.value === storedValue) ? storedValue : fallback;
};

const getTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getReadingStatus = (item) => {
  if (item.read === true) {
    return 'completed';
  }

  return Number(item.page || 0) > 0 ? 'started' : 'unread';
};

const sortCollectionItems = (items) => {
  const sortedItems = [...items];

  sortedItems.sort((a, b) => {
    const recentDiff = getTimestamp(b.lastOpenedAt || b.addedAt) - getTimestamp(a.lastOpenedAt || a.addedAt);
    if (recentDiff !== 0) {
      return recentDiff;
    }

    const addedDiff = getTimestamp(b.addedAt || b.lastOpenedAt) - getTimestamp(a.addedAt || a.lastOpenedAt);
    if (addedDiff !== 0) {
      return addedDiff;
    }

    return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
  });

  return sortedItems;
};

const Collection = (props) => {
  const [browserItems, setBrowserItems] = useState([]);
  const [initial, setInitial] = useState(true);
  const [gridView, setGridView] = useState(
    JSON.parse(localStorage.getItem('collection.gridView')) || false
  );
  const [statusFilter, setStatusFilter] = useState(() => getStoredOption(FILTER_STORAGE_KEY, FILTER_OPTIONS, 'all'));
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
  const visibleItems = useMemo(() => {
    const filteredItems = statusFilter === 'all'
      ? browserItems
      : browserItems.filter((item) => getReadingStatus(item) === statusFilter);

    return sortCollectionItems(filteredItems);
  }, [browserItems, statusFilter]);

  const getToolbarButtonOverrides = (minWidth = '96px') => ({
    Root: {
      style: {
        backgroundColor: 'rgb(246, 246, 246)',
        borderTopLeftRadius: '0',
        borderTopRightRadius: '0',
        borderBottomRightRadius: '0',
        borderBottomLeftRadius: '0',
        minWidth,
        ':hover': {
          backgroundColor: '#e8e8e8'
        },
        ':active': {
          backgroundColor: '#dcdcdc'
        },
        ':focus': {
          backgroundColor: 'rgb(246, 246, 246)'
        },
        ':focus-visible': {
          backgroundColor: 'rgb(246, 246, 246)',
          boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.28)'
        }
      }
    }
  });

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
    if (visibleItems.length === 0) {
      masonryInstance.current?.destroy();
      masonryInstance.current = null;
      lastGridView.current = gridView;
      return;
    }
    if (!masonryContainerRef.current) {
      return;
    }

    const gridChanged = lastGridView.current !== gridView;
    const containerChanged = masonryInstance.current?.element !== masonryContainerRef.current;
    const needsNewInstance = !masonryInstance.current || containerChanged || gridChanged || prevColumnCount.current !== columnCount;
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
  }, [visibleItems, columnCount, gridView, gutter, columnWidthValue]);

  const reloadDb = () => {
    db.collection
      .filter((item) => {
        return item.archived === false;
      })
      .toArray()
      .then((items) => {
        setBrowserItems(items)
        setInitial(false)
      });
  }

  const handleItemClick = async (event, identifier) => {
    showReaderLaunchOverlay();
    setPwaChromeColor('#000000');
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
            {visibleItems.map((item) => (
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
            {visibleItems.map((item) => (
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
          browserItems.length === 0
            ? (
              <div className="statusCard" id="go">
                <div className="statusTitle">Your Collection is empty.</div>
                <div className="statusText">Save issues from Browse to build a reading list here.</div>
              </div>
            )
            : (
              <div className="statusCard" id="go">
                <div className="statusTitle">No issues match this filter.</div>
                <div className="statusText">Change the reading status filter to see more saved issues.</div>
              </div>
            )
        )
    );
  }

  const updateStatusFilter = (nextStatusFilter) => {
    setStatusFilter(nextStatusFilter);
    localStorage.setItem(FILTER_STORAGE_KEY, nextStatusFilter);
  };

  const cycleStatusFilter = () => {
    const currentIndex = FILTER_OPTIONS.findIndex((option) => option.value === statusFilter);
    const nextOption = FILTER_OPTIONS[(currentIndex + 1) % FILTER_OPTIONS.length] || FILTER_OPTIONS[0];
    updateStatusFilter(nextOption.value);
  };

  const statusFilterLabel = FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label || FILTER_OPTIONS[0].label;

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

      <div className="collectionToolbar">
        <div className="collectionToolbar__title">Your Collection</div>
        <div className="collectionToolbar__controls">
          <Button
            size={SIZE.mini}
            kind={KIND.tertiary}
            onClick={cycleStatusFilter}
            overrides={getToolbarButtonOverrides()}
          >{statusFilterLabel}</Button>
          <Button
            size={SIZE.mini}
            kind={KIND.tertiary}
            onClick={() => {
              setGridView(!gridView);
              localStorage.setItem('collection.gridView', JSON.stringify(!gridView));
            }}
            overrides={getToolbarButtonOverrides()}
          >{gridView ? "Covers" : "List View"}</Button>
        </div>
      </div>

      {(visibleItems.length > 0 && !initial)
        ?
        renderData()
        :
        renderEmpty()
      }
    </div>
  )
}

export default Collection;
