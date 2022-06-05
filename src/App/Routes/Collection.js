import React, { useState, useEffect } from 'react';
import { useHistory } from "react-router-dom";
import { Spinner } from 'baseui/spinner';
import { Button, KIND, SIZE } from 'baseui/button'
import { Centered } from '../Components/Centered';
import db from '../Components/Db';
import ItemDrawer from '../Components/ItemDrawer';
import ItemMetadataListItem from '../Components/ItemMetadataListItem';
import { Masonry } from 'masonic';

const Collection = (props) => {
  const history = useHistory();
  const drawer = React.useRef(null);

  const [browserItems, setBrowserItems] = useState([]);
  const [initial, setInitial] = useState(true);
  const [gridView, setGridView] = useState(
    JSON.parse(localStorage.getItem('collection.gridView')) || false
  );

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
    let ret = -1;
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
        let index = findIndex(identifier);
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
      <div style={{ paddingTop: gridView ? '12px' : '0px', paddingRight: '16px' }}>
        <Masonry
          items={browserItems}
          columnGutter={gridView ? 16 : 0}
          columnWidth={100}
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

      <div style={{ fontSize: '85%', paddingTop: '0px', paddingBottom: '32px', color: '#cbcbcb' }}>
        <div style={{ float: 'left', paddingTop: '6px' }}>Your Collection</div>
        <span style={{ float: 'right', paddingRight: '16px' }}>
          <Button
            size={SIZE.mini}
            kind={KIND.tertiary}
            onClick={() => {
              setGridView(!gridView);
              localStorage.setItem('collection.gridView',  JSON.stringify(!gridView));
            }}
            overrides={{
              Root: {
                style: ({ $theme }) => ({
                  backgroundColor:'rgb(246, 246, 246)',
                  width:'96px'
                })
              }
            }}
          >{gridView ? "Grid View" : "List View"}</Button>
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