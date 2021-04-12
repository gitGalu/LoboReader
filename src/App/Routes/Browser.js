import React, { useState, useEffect } from 'react';
import { withRouter, useHistory } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";
import { Search as SearchIcon } from 'baseui/icon';
import Check from 'baseui/icon/check';
import { SIZE } from "baseui/input";
import { StatefulInput } from 'baseui/input';
import { useSnackbar } from 'baseui/snackbar';
import { StyledSpinnerNext } from 'baseui/spinner';
import ia from "../Components/InternetArchive";
import db from '../Components/Db';
import { Centered } from '../Components/Centered';
import ItemMetadataListItem from '../Components/ItemMetadataListItem'
import ItemDrawer from '../Components/ItemDrawer';

const Browser = (props) => {
  const [browserItems, setBrowserItems] = useState([]);
  const [page, setPage] = useState(1);
  const [initial, setInitial] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isSearch, setIsSearch] = useState(false);
  const [parentIdentifier, setParentIdentifier] = useState(undefined);
  const [currentExisting, setCurrentExisting] = useState(false);
  const [currentArchived, setCurrentArchived] = useState(false);

  const history = useHistory();
  const drawer = React.useRef(null);
  const { enqueue } = useSnackbar();

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

  const handleItemClick = async (event, item) => {
    db.collection.get({ id: item.identifier })
      .then((dbItem) => {
        setCurrentExisting(dbItem !== undefined);
        setCurrentArchived((dbItem !== undefined) ? dbItem.archived : false);
        drawer.current.showDrawer(item.identifier, item.title);
      });
  }

  const itemMetadataToListItem = (item) => {
    return <ItemMetadataListItem
      key={item.identifier}
      title={item.title}
      identifier={item.identifier}
      mediatype={item.mediatype}
      onSelectItem={(event) => handleItemClick(event, item)} />;
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
    enqueue({
      message: 'Item was added.',
      startEnhancer: ({ size }) => <Check size={size} />
    })
  }

  const query = () => {
    if (parentIdentifier == undefined) {
      return;
    }

    ia.SearchAPI.get({
      q: isSearch ? '("' + parentIdentifier + '") (collection:("magazine_rack") AND mediatype:(collection OR texts))' : 'collection:("' + parentIdentifier + '" AND mediatype:(collection OR texts))',
      fields: ['identifier', 'title', 'mediatype', 'type', 'metadata'],
      rows: 50,
      page: page,
      sort: ['mediatype asc', 'identifier asc']
    }).then(results => {
      let dox = results.response.docs;
      dox.sort((a, b) => (a.title > b.title) ? 1 : ((b.title > a.title) ? -1 : 0))
      dox.sort((a, b) => (a.mediaType > b.mediaType) ? 1 : ((b.mediaType > a.mediaType) ? -1 : 0))
      dox = browserItems.concat(dox);
      setBrowserItems(dox);
      setHasMore(results.response.numFound > dox.length);
      setInitial(false);
      setPage(page + 1);
    }).catch(err => {
      //TODO error handling
    });
  }

  const fetchData = () => {
    query();
  }

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    let input = document.getElementById('search').value;
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


  return (
    <div className="page">
      <div style={{ marginTop: '4px', marginRight: '14px' }}>
        <form action="" onSubmit={
          (event) => handleSearch(event)}>
          <StatefulInput
            value={isSearch ? parentIdentifier : ""}
            id="search"
            type="search"
            placeholder="Search the Internet Archive"
            size={SIZE.compact}
            autoComplete="false"
            overrides={{
              StartEnhancer: {
                style: {
                  marginLeft: '0px',
                  marginRight: '0px',
                  paddingLeft: '0px',
                  paddingRight: '0px',
                  color: '#888888'
                }
              }
            }}
            startEnhancer={<SearchIcon size="22px" />}
          />
        </form>

      </div>

      <div style={{ fontSize: '85%', paddingTop: '14px', color: '#cbcbcb' }}>
        {getHeader()}
      </div>

      <ItemDrawer
        ref={drawer}
        buttonCount={2}
        buttonLabel={(index, identifier, title) => {
          switch (index) {
            case 0:
              return currentExisting ? 'Continue reading' : 'Start reading';
            case 1:
              return (!currentArchived) ? 'Read later' : 'Unarchive';
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
              return (currentExisting && !currentArchived);
            // return true;
          }
        }}
      />

      {(browserItems.length > 0 && !initial)
        ? <div>
          <ul>
            {browserItems.map(itemMetadataToListItem)}
          </ul>
          <InfiniteScroll
            dataLength={browserItems.length}
            pullDownToRefresh={false}
            next={fetchData}
            hasMore={hasMore}
            loader={<Centered><StyledSpinnerNext /></Centered>} />
        </div>
        : <div>
          {initial
            ? <Centered><StyledSpinnerNext /></Centered>
            : <Centered>No results found.</Centered>
          }
        </div>
      }

    </div>
  );
}

export default withRouter(Browser);