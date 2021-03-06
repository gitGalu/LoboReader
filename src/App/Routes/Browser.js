import React, { useState, useEffect } from 'react';
import { withRouter, useHistory } from "react-router-dom";
import { useSnackbar } from 'baseui/snackbar';
import { Spinner } from 'baseui/spinner';
import ia from "../Components/InternetArchive";
import db from '../Components/Db';
import { Centered } from '../Components/Centered';
import SearchBox from '../Components/SearchBox';
import ItemMetadataListItem from '../Components/ItemMetadataListItem'
import ItemDrawer from '../Components/ItemDrawer';
import { Masonry, useInfiniteLoader } from 'masonic';


const Browser = (props) => {
  const [browserItems, setBrowserItems] = useState([]);
  const [page, setPage] = useState(1);
  const [initial, setInitial] = useState(true);
  const [isSearch, setIsSearch] = useState(false);
  const [parentIdentifier, setParentIdentifier] = useState(undefined);
  const [gridView, setGridView] = useState(true);
  const [pending, setPending] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const drawer = React.useRef()
  const history = useHistory();
  // const { enqueue } = useSnackbar();

  useEffect(() => {
    setBrowserItems([]);
    setPage(1);
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

  const fetchData = () => {
    if (pending) {
      return;
    }
    setPending(true);
    ia.SearchAPI.get({
      q: isSearch ? '("' + parentIdentifier + '") (collection:("magazine_rack") AND mediatype:(collection OR texts))' : 'collection:("' + parentIdentifier + '" AND mediatype:(collection OR texts))',
      fields: ['identifier', 'title', 'mediatype', 'type', 'metadata'],
      rows: 100,
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
    }).catch(err => {
      setPending(false);
    });
  };

  const handleSearch = (input) => {
    document.getElementById('search').blur();
    history.push(`${process.env.PUBLIC_URL}/browse/s/${input}`);
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

  const DataItem = ({ data: { identifier, title, mediatype } }) => (
    <ItemMetadataListItem
      key={identifier}
      title={title}
      identifier={identifier}
      mediatype={mediatype}
      gridView={gridView}
      onSelectItem={(event, identifier, title) => handleItemClick(event, identifier, title)}
    />
  );

  const fetchMoreItems = ((startIndex, stopIndex) => {
    if (stopIndex > (totalItems - 1)) {
      stopIndex = totalItems - 1;
      if (startIndex > (totalItems - 1)) {
        return;
      }
    }
    fetchData();
  });

  const maybeLoadMore = useInfiniteLoader(fetchMoreItems);

  const getKey = () => {
    return Date.now();
  }

  const renderData = () => {
    return (
      <div>
        <Masonry
          key={getKey()}
          items={browserItems}
          columnGutter={gridView ? 16 : 0}
          columnWidth={80}
          columnCount={gridView ? undefined : 1}
          overscanBy={2}
          itemHeightEstimate={100}
          render={DataItem}
          onRender={maybeLoadMore}
        />
      </div>
    )
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
      <div style={{ marginTop: '4px', marginRight: '14px' }}>
        <SearchBox
          id="search"
          placeholder="Search the Internet Archive"
          searchAction={(input) => {
            handleSearch(input);
          }}
        />
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
        {(browserItems.length > 0 && !initial)
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