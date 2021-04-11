import React, { useState, useEffect } from 'react';
import { useHistory } from "react-router-dom";
import InfiniteScroll from "react-infinite-scroll-component";
import ItemMetadataListItem from '../Components/ItemMetadataListItem'
import { StyledSpinnerNext } from 'baseui/spinner';
import { Centered } from '../Components/Centered';
import db from '../Components/Db';
import ItemDrawer from '../Components/ItemDrawer';

const Collection = (props) => {
  const history = useHistory();
  const drawer = React.useRef(null);

  const [browserItems, setBrowserItems] = useState([]);
  const [initial, setInitial] = useState(true);

  useEffect(() => {
    reloadDb();
  }, []);

  const reloadDb = () => {
    db.collection
      .filter(function (item) {
        return item.archived === false;
      })
      .toArray()
      .then((items) => {
        setBrowserItems(items)
        setInitial(false)
      });
  }

  const handleItemClick = async (event, identifier) => {
    let item = (browserItems.find(obj => {
      return obj.id === identifier
    }));
    // TODO error handling
    history.push("/read/" + identifier + "/p/c");
  }

  const handleEditClick = (event, item, title) => {
    event.stopPropagation();
    drawer.current.showDrawer(item, title);
  }

  const archiveItem = (identifier) => {
    db.collection.update({ id: identifier }, { archived: true })
    .then((result) => {
      drawer.current.hideDrawer();
      reloadDb();
    });
  }

  const itemMetadataToListItem = (item) => {
    return <ItemMetadataListItem
      key={item.id}
      title={item.title}
      identifier={item.id}
      mediatype="text"
      onEditClick={(event) => handleEditClick(event, item.id, item.title)}
      onSelectItem={(event) => handleItemClick(event, item.id)} />;
  }

  return (
    <div className="page">

      <ItemDrawer
        ref={drawer}
        buttonCount={1}
        buttonLabel={(index, identifier, title) => {
          switch (index) {
            case 0:
              return 'Archive (hide item)'
          }
        }}
        buttonAction={(index, identifier, title) => {
          switch (index) {
            case 0:
              archiveItem(identifier);
              break;
          }
        }}
      />

      <div style={{ marginTop: '4px', marginRight: '14px', fontSize: '85%', color: '#cbcbcb' }}>
        Your Collection
        </div>

      {(browserItems.length > 0 && !initial)
        ? <div id="go">
          <ul>
            {browserItems.map(itemMetadataToListItem)}
          </ul>
          <InfiniteScroll
            dataLength={browserItems.length}
            loader={<Centered><StyledSpinnerNext /></Centered>}>
          </InfiniteScroll>
        </div>
        : <div id="go">
          {initial
            ? <Centered><StyledSpinnerNext /></Centered>
            : <Centered>Your Collection is empty.</Centered>
          }
        </div>
      }
    </div>
  )
}

export default Collection;