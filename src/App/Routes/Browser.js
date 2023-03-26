import React, { useState, useEffect } from 'react';
import { withRouter, useHistory } from "react-router-dom";
import { useSnackbar } from 'baseui/snackbar';
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
import { MasonryInfiniteGrid } from "@egjs/react-infinitegrid";

const Browser = (props) => {
  const [browserItems, setBrowserItems] = useState([]);
  const [page, setPage] = useState(1);
  const [initial, setInitial] = useState(true);
  const [error, setError] = useState(false);
  const [isSearch, setIsSearch] = useState(false);
  const [parentIdentifier, setParentIdentifier] = useState(undefined);
  const [gridView, setGridView] = useState(true);
  const [pending, setPending] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const drawer = React.useRef()
  const history = useHistory();
  const [searchMode, setSearchMode] = useState(
    JSON.parse(localStorage.getItem('browser.searchMode')) || "1"
  );
  const [searchScope, setSearchScope] = useState(
    JSON.parse(localStorage.getItem('browser.searchScope')) || "1"
  );
  // const { enqueue } = useSnackbar();

  useEffect(() => {
    setBrowserItems([]);
    setPage(1);
    setError(false);
    setInitial(true);

    if (props.match.params.searchQuery !== undefined) {
      setIsSearch(true);
      setParentIdentifier(props.match.params.searchQuery);
    } else {
      setIsSearch(false);
      (props.match.params.id && props.match.params.id !== "s") ? setParentIdentifier(props.match.params.id) : setParentIdentifier("magazine_rack");
    }
  }, [props.location.pathname]);

  useEffect(() => {
    setBrowserItems([]);
    reloadQuery();
  }, [parentIdentifier]);

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

  const startReading = (identifier, title) => {
    addToCollection(identifier, title);
    history.push(getLink(identifier, title));
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
          showNotification();
        });
    } else {
      dbItem.archived = false;
      db.collection.put(dbItem);
    }
  }

  const showNotification = () => {
    // enqueue({
    //   message: 'Item was added.',
    //   startEnhancer: ({ size }) => <Check size={size} />
    // })
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
      return 'collection:("' + parentIdentifier + '" AND mediatype:(collection OR texts))';
    }
  }

  const fetchData = (event) => {
    if (pending) {
      return;
    }
    setPending(true);
    if (event) event.wait();
    ia.SearchAPI.get({
      q: prepareQuery(), fields: ['identifier', 'title', 'mediatype', 'type', 'metadata'],
      rows: 10,
      page: page,
      sort: ['mediatype asc', 'identifier asc']
    }).then(results => {
      let dox = results.response.docs;
      dox.sort((a, b) => (a.title > b.title) ? 1 : ((b.title > a.title) ? -1 : 0))
      dox.sort((a, b) => (a.mediaType > b.mediaType) ? 1 : ((b.mediaType > a.mediaType) ? -1 : 0))
      dox = browserItems.concat(dox);
      setBrowserItems(dox);
      setTotalItems(results.response.numFound);
      setInitial(false);
      setPage(page + 1);
      setPending(false);
      if (event) event.ready();
    }).catch(err => {
      setPending(false);
      setError(true);
      if (event) event.ready();
    });
  };

  const handleSearch = (input) => {
    document.getElementById('search').blur();
    // history.push(`${process.env.PUBLIC_URL}/browse/s/${input}`);
    history.push(`${process.env.PUBLIC_URL}/browse/s/${input}/`);

  }

  const getLink = (identifier) => {
    if (isSearch != "") {
      return `${process.env.PUBLIC_URL}/read/${identifier}/p/s/${parentIdentifier}`;
    } else {
      return `${process.env.PUBLIC_URL}/read/${identifier}/p/b/${parentIdentifier}`;
    }
  }

  const getHeader = () => {
    if (isSearch) {
      return "Searching for: " + parentIdentifier;
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
      <MasonryInfiniteGrid
        className="masonry-container"
        gap={10}
        column={3}
        align={'stretch'}
        useResizeObserver={true}
        observeChildren={true}
        loading={<div className="loading"><Spinner /></div>}
        onRequestAppend={(e) => {
          if (browserItems.length < totalItems) {
            fetchData(e);
          }
        }}
      >
        {browserItems.map((item) =>
          <div className="masonry-item">
            <ItemMetadataListItem
              key={item.identifier}
              title={item.title}
              identifier={item.identifier}
              mediatype={item.mediatype}
              gridView={gridView}
              onSelectItem={(e, identifier, title) => handleItemClick(e, identifier, title)}
            />
          </div>
        )
        }
      </MasonryInfiniteGrid>
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
              renderData()
              :
              renderEmpty()
        }
      </div>
    </div>
  );
}

export default withRouter(Browser);
