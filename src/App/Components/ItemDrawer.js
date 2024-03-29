import React, { useState, forwardRef, useImperativeHandle } from 'react';
import 'react-lazy-load-image-component/src/effects/opacity.css';
import { Button, SIZE } from 'baseui/button';
import { Drawer, ANCHOR } from "baseui/drawer";

const ItemDrawer = forwardRef((props, ref) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [title, setTitle] = useState(undefined);
  const [additionalProps, setAdditionalProps] = useState(undefined);

  useImperativeHandle(ref, () => {
    return {
      showDrawer: showDrawer,
      hideDrawer: hideDrawer,
      getAdditionalProps: getAdditionalProps
    }
  });

  const getAdditionalProps = () => {
    return additionalProps;
  }

  const showDrawer = (identifier, title, additionalProps) => {
    setIdentifier(identifier);
    setTitle(title);
    setAdditionalProps(additionalProps);
    setDrawerOpen(true);
  };

  const hideDrawer = () => {
    setDrawerOpen(false);
  };

  const renderButtons = () => {
    let buttons = [];
    for (let i = 0; i < props.buttonCount; i++) {
      buttons.push(
        <div style={{ 'marginBottom': '16px' }}>
          <Button
            disabled={(props.buttonDisabled == undefined) ? false : props.buttonDisabled(i, identifier, title)}
            onClick={() => props.buttonAction(i, identifier, title)}>
            {props.buttonLabel(i, identifier, title)}
          </Button>
        </div>
      );
    }
    return buttons;
  }

  const getTitle = () => {
    return (title != undefined ? title : '');
  }

  const getImgUrl = () => {
    return (identifier != undefined ? 'https://archive.org/services/img/' + identifier : '');
  }

  return (
    <Drawer
      isOpen={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      anchor={ANCHOR.bottom}
      size={SIZE.auto}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '130%', fontWeight: '550' }}>{getTitle()}</div>
        <br />
        <div style={{ 'paddingTop': '4px' }}>
          <div className='drawerImgOverlay'
          style={{
            maxHeight: '175px'
          }}>
            <img
              src={getImgUrl()}
              style={{
                maxHeight: '175px',
                borderRadius: '5px',
                objectFit: 'cover'
              }}
              className='drawerImg'
            />
          </div>
        </div>
        <div style={{ 'marginTop': '215px' }}>
          {renderButtons()}
        </div>
      </div>
    </Drawer>
  )
});

export default ItemDrawer;
