import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Spinner } from 'baseui/spinner';
import { Button, KIND } from 'baseui/button';
import { TriangleDown } from 'baseui/icon';
import { Block } from 'baseui/block';
import { RadioGroup, Radio, ALIGN } from "baseui/radio";
import { StatefulPopover, PLACEMENT } from "baseui/popover";
import ia from "../Components/InternetArchive";
import db from '../Components/Db';
import { Centered } from '../Components/Centered';
import SearchBox from '../Components/SearchBox';
import ItemMetadataListItem from '../Components/ItemMetadataListItem'
import ItemDrawer from '../Components/ItemDrawer';
import Masonry from 'masonry-layout';
import { isMobile, isIPad13, isTablet } from 'react-device-detect';

const Browser = (props) => {
  const [browserItems, setBrowserItems] = useState([]);
  const [page, setPage] = useState(1);
  const [initial, setInitial] = useState(true);
  const [error, setError] = useState(false);
  const [isSearch, setIsSearch] = useState(false);
  const [parentIdentifier, setParentIdentifier] = useState(undefined);
  const [gridView] = useState(true);
  const [pending, setPending] = useState(false);
  const pendingRef = React.useRef(false);
  const [totalItems, setTotalItems] = useState(0);
  const [renderReady, setRenderReady] = useState(false);
  const [loadedImages, setLoadedImages] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const masonryContainerRef = React.useRef(null);
  const masonryInstance = React.useRef(null);
  const prevColumnCount = React.useRef(null);
  const sentinelRef = React.useRef(null);
  const searchbox = React.useRef(null);
  const drawer = React.useRef()
  const navigate = useNavigate();
  const resizeTimeout = React.useRef(null);
  const [searchMode, setSearchMode] = useState(
    JSON.parse(localStorage.getItem('browser.searchMode')) || "1"
  );
  const [searchScope, setSearchScope] = useState(
    JSON.parse(localStorage.getItem('browser.searchScope')) || "1"
  );

  let { id, searchQuery } = useParams();

  useEffect(() => {
    setBrowserItems([]);
    setPage(1);
    setError(false);
    setInitial(true);
    setRenderReady(false);
    setLoadedImages(0);
    masonryInstance.current?.destroy();
    masonryInstance.current = null;

    if (searchQuery !== undefined) {
      setIsSearch(true);
      setParentIdentifier(searchQuery);
    } else {
      setIsSearch(false);
      (id && id !== "s") ? setParentIdentifier(id) : setParentIdentifier("magazine_rack");
    }
  }, [useLocation()]);

  useEffect(() => {
    setBrowserItems([]);
    setRenderReady(false);
    setLoadedImages(0);
    reloadQuery();
  }, [parentIdentifier]);

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


  useEffect(() => {
    const minImages = Math.min(20, browserItems.length);
    if (!initial && browserItems.length > 0 && loadedImages >= minImages) {
      setRenderReady(true);
    }
  }, [initial, browserItems.length, loadedImages]);

  const gutter = 10;

  const getColumnCount = () => {
    if (!gridView) return 1;
    const width = viewportWidth;

    if (isMobile && !isTablet && !isIPad13) {
      if (width >= 900) return 5;
      if (width >= 640) return 4;
      return 3;
    }
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
    if (!masonryContainerRef.current) {
      return;
    }
    const needsNewInstance = !masonryInstance.current || prevColumnCount.current !== columnCount;
    if (needsNewInstance) {
      masonryInstance.current = new Masonry(masonryContainerRef.current, {
        itemSelector: '.masonry-item',
        columnWidth: '.masonry-sizer',
        gutter,
        percentPosition: true,
        transitionDuration: '0.15s'
      });
    } else {
      masonryInstance.current.options.gutter = gutter;
    }

    const masonry = masonryInstance.current;
    masonry.reloadItems();
    requestAnimationFrame(() => masonry.layout());
    prevColumnCount.current = columnCount;
  }, [browserItems, gridView, gutter, columnWidthValue, renderReady, columnCount]);

  useEffect(() => {
    if (!sentinelRef.current || browserItems.length === 0 || !renderReady || loadedImages < Math.min(5, browserItems.length)) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && !pending && browserItems.length < totalItems) {
        fetchData();
      }
    }, { rootMargin: '400px' });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [pending, browserItems.length, totalItems, renderReady]);

  const reloadQuery = () => {
    setPage(1);
    setInitial(true);
    setError(false);
    query();
  }

  const handleItemClick = async (event, identifier, title) => {
    db.collection.get({ id: identifier })
      .then((dbItem) => {
        var existing = dbItem !== undefined;
        var archived = (dbItem !== undefined) ? dbItem.archived : false;
        drawer.current.showDrawer(identifier, title, { existing: existing, archived: archived });
      });
  }

  const handleImageLoad = () => {
    setLoadedImages(prev => prev + 1);
    requestAnimationFrame(() => masonryInstance.current?.layout());
  }

  const startReading = (identifier, title) => {
    addToCollection(identifier, title);
    navigate(getLink(identifier, title));
  }

  const readLater = (identifier, title) => {
    addToCollection(identifier, title);
    drawer.current.hideDrawer();
  }

  const addToCollection = async (identifier, title) => {
    const dbItem = await db.collection.get({ id: identifier });
    if (dbItem === undefined) {
      db.collection.add({
        id: identifier,
        title: title,
        page: 0,
        read: false,
        archived: false
      }, identifier)
        .then(function (id) {
        });
    } else {
      dbItem.archived = false;
      db.collection.put(dbItem);
    }
  }

  const query = () => {
    if (parentIdentifier == undefined) {
      return;
    }
    fetchData();
  }

  const prepareQuery = () => {
    if (isSearch) {
      let q = '';
      if (searchMode == "2") {
        q += 'title:';
      }
      q += '("' + parentIdentifier + '")';
      if (searchScope == "1") {
        q += ' AND collection:("magazine_rack") ';
        q += ' AND mediatype:(collection OR texts)';
      } else if (searchScope == "2") {
        q += 'AND -collection:(inlibrary) AND mediatype:(texts)';
      }
      return q;
    } else {
      return 'collection:("' + parentIdentifier + '") AND mediatype:(collection OR texts)';
    }
  }

  const fetchData = () => {
    if (pendingRef.current || pending) {
      return;
    }
    pendingRef.current = true;
    setPending(true);
    ia.SearchAPI.get({
      q: prepareQuery(), fields: ['identifier', 'title', 'mediatype', 'type', 'metadata'],
      rows: 40,
      page: page,
      sort: ['mediatype asc', 'identifier asc']
    }).then(results => {
      let dox = results.response.docs;
      dox.sort((a, b) => (a.title > b.title) ? 1 : ((b.title > a.title) ? -1 : 0))
      dox.sort((a, b) => (a.mediaType > b.mediaType) ? 1 : ((b.mediaType > a.mediaType) ? -1 : 0))
      setBrowserItems(prev => prev.concat(dox));
      setTotalItems(results.response.numFound);
      setInitial(false);
      setPage(prev => prev + 1);
      setPending(false);
      pendingRef.current = false;
    }).catch(err => {
      pendingRef.current = false;
      setPending(false);
      setError(true);
    });
  };

  const handleSearch = (input) => {
    document.getElementById('search').blur();
    navigate(`${process.env.PUBLIC_URL}/browse/s/${input}/`);
  }

  const getLink = (identifier) => {
    if (isSearch != "") {
      return `${process.env.PUBLIC_URL}/read/${identifier}/p/s/${parentIdentifier}`;
    } else {
      return `${process.env.PUBLIC_URL}/read/${identifier}/p/b/${parentIdentifier}`;
    }
  }

  const fillSearchBox = () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(searchbox.current, parentIdentifier);
    searchbox.current.dispatchEvent(new Event('input', { bubbles: true }));
    searchbox.current && searchbox.current.focus();
  }

  const getHeader = () => {
    if (isSearch) {
      return <span>Searching for <span className='dotted' onClick={ fillSearchBox }>{parentIdentifier}</span></span>;
    } else {
      switch (parentIdentifier) {
        case "magazine_rack":
          return "Browsing the Magazine Rack";
        case null:
          return <br />
        case undefined:
          return <br />
        default:
          return "Browsing '" + parentIdentifier + "'";
      }
    }
  }

  const renderData = () => {
    return (
      <>
        <div className="masonry-container" ref={masonryContainerRef}>
          <div className="masonry-sizer" style={{ width: columnWidthValue }} aria-hidden />
          {browserItems.map((item) =>
            <div
              className="masonry-item"
              key={item.identifier}
              style={{ width: columnWidthValue, marginBottom: `${gutter}px` }}
            >
              <ItemMetadataListItem
                title={item.title}
                identifier={item.identifier}
                mediatype={item.mediatype}
                gridView={gridView}
                onSelectItem={(e, identifier, title) => handleItemClick(e, identifier, title)}
                onImageLoad={handleImageLoad}
              />
            </div>
          )}
        </div>
        <div ref={sentinelRef} className="masonry-sentinel" />
        {pending && <div className="loading"><Spinner /></div>}
      </>
    )
  }

  const renderError = () => {
    return (
      <div>
        {
          <Centered>Error loading data from the Internet Archive.</Centered>
        }
      </div>
    );
  }

  const renderEmpty = () => {
    return (
      <div>
        {initial
          ? <Centered><Spinner /></Centered>
          : <Centered>No results found.</Centered>
        }
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ marginTop: '4px', marginRight: '14px', display: 'flex' }}>
        <SearchBox
          id="search"
          ref={searchbox}
          placeholder={(searchScope == "1") ? 'Search the Magazine Rack' : 'Search the Internet Archive'}
          searchAction={(input) => {
            handleSearch(input);
          }}
        />
        <StatefulPopover
          showArrow
          popoverMargin={4}
          returnFocus
          autoFocus
          placement={PLACEMENT.bottom}
          overrides={{
            Body: {
              style: {
                marginRight: '8px',
                backgroundColor: '#ffffff88',
                backdropFilter: 'blur(6px)'
              }
            },
            Inner: {
              style: {
                backgroundColor: '#ffffff88'
              }
            },
          }}
          content={() => (
            <Block padding={"16px"}>
              <div style={{ paddingBottom: '4px ' }}>
                Search mode:
              </div>
              <div style={{ paddingBottom: '4px ' }}>
                <RadioGroup
                  value={searchMode}
                  onChange={e => {
                    setSearchMode(e.currentTarget.value);
                    localStorage.setItem('browser.searchMode', JSON.stringify(e.currentTarget.value));
                  }}
                  name="searchMode"
                  align={ALIGN.vertical}>
                  <Radio value="1" description="Default">Search titles and metadata</Radio>
                  <Radio value="2">Search titles only</Radio>
                </RadioGroup>
              </div>
              <div style={{ paddingBottom: '4px', paddingTop: '12px' }}>
                Search scope:
              </div>
              <div style={{ paddingBottom: '4px ' }}>
                <RadioGroup
                  value={searchScope}
                  onChange={e => {
                    setSearchScope(e.currentTarget.value);
                    localStorage.setItem('browser.searchScope', JSON.stringify(e.currentTarget.value));
                  }}
                  name="searchScope"
                  align={ALIGN.vertical}>
                  <Radio value="1" description="Default">Magazine Rack</Radio>
                  <Radio value="2">All Internet Archive texts</Radio>
                </RadioGroup>
              </div>
            </Block>
          )}>
          <div style={{ marginLeft: '8px' }}>
            <Button
              kind={KIND.secondary}>
              <TriangleDown size={24} />
            </Button>
          </div>
        </StatefulPopover>
      </div>
      <div style={{ fontSize: '85%', paddingTop: '14px', color: '#cbcbcb' }}>
        <span style={{ float: 'left' }}>
          {getHeader()}
        </span>
      </div>
      <div>
        <ItemDrawer
          ref={drawer}
          buttonCount={2}
          buttonLabel={(index, identifier, title) => {
            switch (index) {
              case 0:
                return drawer.current?.getAdditionalProps()?.existing ? 'Continue reading' : 'Start reading';
              case 1:
                return (!drawer.current?.getAdditionalProps()?.archived) ? 'Read later' : 'Unarchive';
            }
          }}
          buttonAction={(index, identifier, title) => {
            switch (index) {
              case 0:
                startReading(identifier, title);
                break;
              case 1:
                readLater(identifier, title);
                break;
            }
          }}
          buttonDisabled={(index, identifier, title) => {
            switch (index) {
              case 0:
                return false;
              default:
                return (drawer.current?.getAdditionalProps()?.existing && !drawer.current?.getAdditionalProps()?.archived);
            }
          }}
        />
      </div>
      <div style={{ paddingRight: '16px', paddingTop: '32px' }}>
        {
          error ? renderError() :
            (browserItems.length > 0 && !initial)
              ?
              <>
                {!renderReady && <Centered><Spinner /></Centered>}
                <div style={{ opacity: renderReady ? 1 : 0, pointerEvents: renderReady ? 'auto' : 'none' }}>
                  {renderData()}
                </div>
              </>
              :
              renderEmpty()
        }
      </div>
    </div>
  );
}

export default Browser;
