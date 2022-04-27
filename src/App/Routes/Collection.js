import React, { useState, useEffect } from 'react';
import { useHistory } from "react-router-dom";
import ItemMetadataListItem from '../Components/ItemMetadataListItem'
import { Spinner } from 'baseui/spinner';
import { Centered } from '../Components/Centered';
import db from '../Components/Db';
import ItemDrawer from '../Components/ItemDrawer';
import { Masonry } from 'masonic';

const Collection = (props) => {
  const history = useHistory();
  const drawer = React.useRef(null);

  const [browserItems, setBrowserItems] = useState([]);
  const [initial, setInitial] = useState(true);
  const [gridView, setGridView] = useState(false);

  useEffect(() => {
    reloadDb();
  }, []);

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
    let item = (browserItems.find(obj => {
      return obj.id === identifier
    }));
    // TODO error handling
    history.push(`${process.env.PUBLIC_URL}/read/${identifier}/p/c`);
  }

  const handleEditClick = (event, item, title) => {
    event.stopPropagation();
    drawer.current.showDrawer(item, title);
  }

  const findIndex = (identifier) => {
    var ret = -1;
    browserItems.forEach((element, index) => {
      if (element.id === identifier) {
        ret = index;
      }
    })
    return ret;
  }

  const archiveItem = (identifier) => {
    db.collection.update({ id: identifier }, { archived: true })
      .then((result) => {
        drawer.current.hideDrawer();
        var index = findIndex(identifier);
        browserItems[index].disabled = true;
        setBrowserItems([]);
        setBrowserItems(browserItems);
      });
  }

  const DataItem = ({ data: { id, title, disabled } }) => (
    <ItemMetadataListItem
      key={id}
      title={title}
      identifier={id}
      mediatype="text"
      gridView={gridView}
      disabled={disabled}
      onEditClick={(event) => handleEditClick(event, id, title)}
      onSelectItem={(event) => handleItemClick(event, id)}
    />
  );

  const renderData = () => {
    return (
      <div style={{ paddingRight: '16px' }}>
        <Masonry
          items={browserItems}
          columnGutter={gridView ? 16 : 0}
          columnWidth={80}
          columnCount={gridView ? undefined : 1}
          overscanBy={4}
          render={DataItem}
        />
      </div>
    )
  }

  const renderEmpty = () => {
    return (
      <div id="go">
        {initial
          ? <Centered><Spinner /></Centered>
          : <Centered>Your Collection is empty.</Centered>
        }
      </div>
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
        ?
        renderData()
        :
        renderEmpty()
      }
    </div>
  )
}

export default Collection;