import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { Button, KIND } from 'baseui/button';
import { TriangleDown } from 'baseui/icon';
import { Block } from 'baseui/block';
import { RadioGroup, Radio, ALIGN } from "baseui/radio";
import { StatefulPopover, PLACEMENT } from "baseui/popover";
import ia from "../Components/InternetArchive";
import db from '../Components/Db';
import SearchBox from '../Components/SearchBox';
import ItemMetadataListItem from '../Components/ItemMetadataListItem'
import ItemDrawer from '../Components/ItemDrawer';
import Masonry from 'masonry-layout';
import { isMobile, isIPad13, isTablet } from 'react-device-detect';

const BROWSER_PAGE_SIZE = 24;
const AUTO_PAGING_IMAGE_THRESHOLD = 4;

const Browser = (props) => {
  const [browserItems, setBrowserItems] = useState([]);
  const [initial, setInitial] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoPagingReady, setAutoPagingReady] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [loadedCoverCount, setLoadedCoverCount] = useState(0);
  const [isSearch, setIsSearch] = useState(false);
  const [parentIdentifier, setParentIdentifier] = useState(undefined);
  const gridView = true;
  const [pending, setPending] = useState(false);
  const pageRef = React.useRef(1);
  const pendingRef = React.useRef(false);
  const [totalItems, setTotalItems] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const masonryContainerRef = React.useRef(null);
  const masonryInstance = React.useRef(null);
  const prevColumnCount = React.useRef(null);
  const sentinelRef = React.useRef(null);
  const searchbox = React.useRef(null);
  const drawer = React.useRef()
  const navigate = useNavigate();
  const location = useLocation();
  const resizeTimeout = React.useRef(null);
  const browserItemsRef = React.useRef([]);
  const [searchMode, setSearchMode] = useState(
    JSON.parse(localStorage.getItem('browser.searchMode')) || "1"
  );
  const [searchScope, setSearchScope] = useState(
    JSON.parse(localStorage.getItem('browser.searchScope')) || "1"
  );

  let { id, searchQuery } = useParams();

  useEffect(() => {
    browserItemsRef.current = browserItems;
  }, [browserItems]);

  const prepareQuery = useCallback(() => {
    if (parentIdentifier === undefined) {
      return null;
    }

    if (isSearch) {
      let q = '';
      if (searchMode === "2") {
        q += 'title:';
      }
      q += `("${parentIdentifier}")`;
      if (searchScope === "1") {
        q += ' AND collection:("magazine_rack")';
        q += ' AND mediatype:(collection OR texts)';
      } else if (searchScope === "2") {
        q += ' AND -collection:(inlibrary) AND mediatype:(texts)';
      }
      return q;
    }

    return `collection:("${parentIdentifier}") AND mediatype:(collection OR texts)`;
  }, [isSearch, parentIdentifier, searchMode, searchScope]);

  const fetchData = useCallback(async ({ pageToFetch, replace = false } = {}) => {
    const query = prepareQuery();
    const targetPage = pageToFetch ?? pageRef.current;

    if (!query || pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setAutoPagingReady(false);
    setLoadedCoverCount(0);
    if (replace) {
      setRefreshing(true);
      setUserHasScrolled(false);
    }

    try {
      const results = await ia.SearchAPI.get({
        q: query,
        fields: ['identifier', 'title', 'mediatype', 'type', 'metadata'],
        rows: BROWSER_PAGE_SIZE,
        page: targetPage,
        sort: ['mediatype asc', 'identifier asc']
      });

      const docs = [...results.response.docs].sort((a, b) => {
        const mediaTypeCompare = (a.mediatype || '').localeCompare(b.mediatype || '');
        if (mediaTypeCompare !== 0) {
          return mediaTypeCompare;
        }

        return (a.title || a.identifier || '').localeCompare(b.title || b.identifier || '');
      });

      setBrowserItems((prev) => replace ? docs : prev.concat(docs));
      setTotalItems(results.response.numFound);
      setInitial(false);
      pageRef.current = targetPage + 1;
      setError(false);
    } catch (err) {
      if (replace && browserItemsRef.current.length === 0) {
        setBrowserItems([]);
        setTotalItems(0);
      }
      setInitial(false);
      setError(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
      if (replace) {
        setRefreshing(false);
      }
    }
  }, [prepareQuery]);

  useEffect(() => {
    setBrowserItems([]);
    pageRef.current = 1;
    setTotalItems(0);
    setError(false);
    setInitial(true);
    setAutoPagingReady(false);
    setUserHasScrolled(false);
    setLoadedCoverCount(0);
    masonryInstance.current?.destroy();
    masonryInstance.current = null;

    if (searchQuery !== undefined) {
      setIsSearch(true);
      setParentIdentifier(searchQuery);
    } else {
      setIsSearch(false);
      setParentIdentifier((id && id !== "s") ? id : "magazine_rack");
    }
  }, [id, location.pathname, searchQuery]);

  useEffect(() => {
    if (parentIdentifier === undefined) {
      return;
    }

    if (browserItemsRef.current.length === 0) {
      setInitial(true);
    }
    pageRef.current = 1;
    setError(false);
    fetchData({ pageToFetch: 1, replace: true });
  }, [fetchData, parentIdentifier]);

  useEffect(() => {
    return () => {
      masonryInstance.current?.destroy();
      masonryInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (userHasScrolled) {
      return;
    }

    const markUserScroll = () => {
      if ((window.scrollY || window.pageYOffset || 0) > 32) {
        setUserHasScrolled(true);
      }
    };

    window.addEventListener('scroll', markUserScroll, { passive: true });
    window.addEventListener('wheel', markUserScroll, { passive: true });
    window.addEventListener('touchmove', markUserScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', markUserScroll);
      window.removeEventListener('wheel', markUserScroll);
      window.removeEventListener('touchmove', markUserScroll);
    };
  }, [userHasScrolled]);

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
    if (!masonryContainerRef.current || browserItems.length === 0) {
      return;
    }

    const needsNewInstance = !masonryInstance.current || prevColumnCount.current !== columnCount;
    if (needsNewInstance) {
      masonryInstance.current?.destroy();
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
  }, [browserItems, columnCount, columnWidthValue]);

  useEffect(() => {
    if (!sentinelRef.current || browserItems.length === 0 || pending || !autoPagingReady || !userHasScrolled || browserItems.length >= totalItems) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        fetchData();
      }
    }, { rootMargin: '120px' });

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [autoPagingReady, browserItems.length, fetchData, pending, totalItems, userHasScrolled]);

  useEffect(() => {
    if (browserItems.length === 0 || initial || autoPagingReady) {
      return;
    }

    const requiredLoadedCovers = Math.min(AUTO_PAGING_IMAGE_THRESHOLD, browserItems.length);
    if (loadedCoverCount >= requiredLoadedCovers) {
      setAutoPagingReady(true);
    }
  }, [autoPagingReady, browserItems.length, initial, loadedCoverCount]);

  const handleItemClick = async (event, identifier, title) => {
    ia.BookManifestAPI.prefetch({ identifier });
    db.collection.get({ id: identifier })
      .then((dbItem) => {
        const existing = dbItem !== undefined;
        const archived = dbItem !== undefined ? dbItem.archived : false;
        drawer.current.showDrawer(identifier, title, { existing, archived });
      });
  }

  const handleImageLoad = () => {
    setLoadedCoverCount((count) => count + 1);
    requestAnimationFrame(() => masonryInstance.current?.layout());
  }

  const startReading = (identifier, title) => {
    addToCollection(identifier, title);
    drawer.current?.hideDrawer();
    navigate(getLink(identifier), { state: { backgroundLocation: location } });
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
        archived: false,
        lastOpenedAt: new Date().toISOString()
      }, identifier);
    } else {
      dbItem.archived = false;
      dbItem.lastOpenedAt = new Date().toISOString();
      db.collection.put(dbItem);
    }
  }

  const handleSearch = (input) => {
    const normalizedInput = input.trim();
    document.getElementById('search')?.blur();

    if (!normalizedInput) {
      navigate(`${process.env.PUBLIC_URL}/browse`);
      return;
    }

    navigate(`${process.env.PUBLIC_URL}/browse/s/${normalizedInput}/`);
  }

  const getLink = (identifier) => {
    if (isSearch) {
      return `${process.env.PUBLIC_URL}/read/${identifier}/p/s/${parentIdentifier}`;
    }

    return `${process.env.PUBLIC_URL}/read/${identifier}/p/b/${parentIdentifier}`;
  }

  const fillSearchBox = () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(searchbox.current, parentIdentifier);
    searchbox.current.dispatchEvent(new Event('input', { bubbles: true }));
    searchbox.current && searchbox.current.focus();
  }

  const getHeader = () => {
    if (isSearch) {
      return <span>Searching for <span className='dotted' onClick={fillSearchBox}>{parentIdentifier}</span></span>;
    }

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

  const reloadCurrentQuery = () => {
    setBrowserItems([]);
    setTotalItems(0);
    pageRef.current = 1;
    setInitial(true);
    setError(false);
    setAutoPagingReady(false);
    setUserHasScrolled(false);
    setLoadedCoverCount(0);
    fetchData({ pageToFetch: 1, replace: true });
  }

  const renderData = () => {
    const gridStateClassName = refreshing ? 'cover-gridState cover-gridState--refreshing' : 'cover-gridState';

    return (
      <>
        <div className={gridStateClassName}>
          {refreshing && <div className="loading loadingInline loadingInline--top">Loading updated results...</div>}
          {error && <div className="statusCard statusCard--inline">Couldn&apos;t refresh results. Showing the previous set.</div>}
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
                onSelectItem={(e, selectedIdentifier, titleText) => handleItemClick(e, selectedIdentifier, titleText)}
                onImageLoad={handleImageLoad}
              />
            </div>
          )}
          </div>
        </div>
        <div ref={sentinelRef} className="masonry-sentinel" />
        {pending && !refreshing && (
          <div className="loadingState loadingState--floating">
            <span className="loadingSpinner" aria-hidden="true" />
            <span>Loading...</span>
          </div>
        )}
      </>
    )
  }

  const renderError = () => {
    return (
      <div className="statusCard">
        <div className="statusTitle">Couldn&apos;t load data from the Internet Archive.</div>
        <div className="statusText">Check your connection and try again.</div>
        <div className="statusActions">
          <Button onClick={reloadCurrentQuery}>Try again</Button>
        </div>
      </div>
    );
  }

  const renderEmpty = () => {
    return (
      initial
        ? (
          <div className="loadingState">
            <span className="loadingSpinner" aria-hidden="true" />
            <span>Loading...</span>
          </div>
        )
        : (
          <div className="statusCard">
            <div className="statusTitle">No results found.</div>
            <div className="statusText">Try a broader search or switch the search scope.</div>
          </div>
        )
    );
  }

  return (
    <div className="page">
      <div className="routeControls">
        <div className="browseSearchRow">
          <SearchBox
            id="search"
            ref={searchbox}
            placeholder={searchScope === "1" ? 'Search the Magazine Rack' : 'Search the Internet Archive'}
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
        <div className="routeSubhead">
          <div>
            {getHeader()}
          </div>
        </div>
      </div>
      <div>
        <ItemDrawer
          ref={drawer}
          buttonCount={2}
          buttonLabel={(index) => {
            switch (index) {
              case 0:
                return drawer.current?.getAdditionalProps()?.existing ? 'Continue reading' : 'Start reading';
              case 1:
                return (!drawer.current?.getAdditionalProps()?.archived) ? 'Read later' : 'Unarchive';
              default:
                return '';
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
              default:
                break;
            }
          }}
          buttonDisabled={(index) => {
            switch (index) {
              case 0:
                return false;
              default:
                return (drawer.current?.getAdditionalProps()?.existing && !drawer.current?.getAdditionalProps()?.archived);
            }
          }}
        />
      </div>
      <div className="routeResults">
        {
          (browserItems.length > 0 && !initial)
              ?
              renderData()
              :
              (error ? renderError() : renderEmpty())
        }
      </div>
    </div>
  );
}

export default Browser;
