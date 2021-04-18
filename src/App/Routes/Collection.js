import React, { useState, useEffect } from 'react';
import { useHistory } from "react-router-dom";
import ItemMetadataListItem from '../Components/ItemMetadataListItem'
import { StyledSpinnerNext } from 'baseui/spinner';
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
    history.push(`${process.env.PUBLIC_URL}/read/${identifier}/p/c`);
  }

  const handleEditClick = (event, item, title) => {
    event.stopPropagation();
    drawer.current.showDrawer(item, title);
  }

  const archiveItem = (identifier) => {
    db.collection.update({ id: identifier }, { archived: true })
      .then((result) => {
        drawer.current.hideDrawer();
        window.location.reload();
      });
  }

  const DataItem = ({ data: { id, title } }) => (
    <ItemMetadataListItem
      key={id}
      title={title}
      identifier={id}
      mediatype="text"
      gridView={gridView}
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
          overscanBy={3}
          render={DataItem}
        />
      </div>
    )
  }

  const renderEmpty = () => {
    return (
    <div id="go">
      {initial
        ? <Centered><StyledSpinnerNext /></Centered>
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