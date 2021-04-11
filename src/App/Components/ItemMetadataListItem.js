import React from "react";
import { Link, withRouter } from "react-router-dom";
import { ListItem } from 'baseui/list';
import { LazyLoadImage } from 'react-lazy-load-image-component'
import 'react-lazy-load-image-component/src/effects/opacity.css';
import { ChevronRight } from "baseui/icon";
import { Button, KIND, SIZE } from 'baseui/button';

const ItemMetadataListItem = (props) => {
  const renderItem = (mediaType) => {
    switch (mediaType) {
      case 'collection':
        return (
          <Link to={`${process.env.PUBLIC_URL}/browse/` + props.identifier}>
            <div className="rowItem">
              {renderRow()}
            </div>
          </Link>
        );
      default:
        return (
          <div className="rowItem" onClick={(event) => props.onSelectItem(event, props.identifier, props.title)}>
            { renderRow()}
          </div>
        );
    }
  }

  const renderEndEnhancer = (mediaType) => {
    switch (mediaType) {
      case 'collection':
        return (<ChevronRight />);
      default:
        if (props.onEditClick) {
          return (<Button onClick={(event) => props.onEditClick(event, props.identifier, props.title)}
            kind={KIND.secondary}
            size={SIZE.mini}>
            Edit
          </Button>);
        }
    }
    return (<div />);
  }

  const renderRow = (route) => {
    return (
      <ListItem
        key="{props.identifier}"
        endEnhancer={() => renderEndEnhancer(props.mediatype, props.editable)}
        overrides={{
          Content: {
            style: {
              'padding-left': '0px',
              'margin-left': '0px',
              'width': '100%'
            }
          }
        }}>

        <LazyLoadImage
          className="listImg"
          style={{
            borderRadius: '5px',
            verticalAlign: 'middle',
            objectPosition: '0% 0%',
            width: '64px',
            height: '36px',
            minWidth: '64px',
            minHeight: '36px',
            objectFit: 'cover',
          }}
          effect="opacity"
          key={"https://archive.org/services/img/" + props.identifier}
          src={"https://archive.org/services/img/" + props.identifier}
          width={'64px'}
        />
        <div className="description">
          {props.title}
        </div>
      </ListItem>
    )
  }

  return (
    renderItem(props.mediatype)
  )
}

export default withRouter(ItemMetadataListItem);