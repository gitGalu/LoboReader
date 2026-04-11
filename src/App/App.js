import React from 'react';
import { Helmet } from 'react-helmet';
import { Route, Routes, NavLink, useLocation } from 'react-router-dom';
import { LightTheme, BaseProvider } from 'baseui';
import { HeaderNavigation, ALIGN, StyledNavigationList, StyledNavigationItem } from 'baseui/header-navigation';
import { Button, KIND } from 'baseui/button';
import { SnackbarProvider, PLACEMENT } from 'baseui/snackbar';
import { Layer } from 'baseui/layer';
import Browser from './Routes/Browser';
import Collection from './Routes/Collection';
import Reader from './Routes/Reader';
import About from './Components/About';
import StandaloneWarning from './Components/StandaloneWarning';
import './App.css';

const App = (props) => {
  const [ackPwa, setAckPwa] = React.useState(localStorage.getItem('ack.pwa'));
  const drawer = React.useRef(null);
  const location = useLocation();
  const backgroundLocation = location.state?.backgroundLocation;
  const navigationLocation = backgroundLocation || location;

  const browseBase = `${process.env.PUBLIC_URL}/browse`;
  const collectionBase = `${process.env.PUBLIC_URL}/collection`;
  const browseActive = navigationLocation.pathname === `${process.env.PUBLIC_URL}` ||
    navigationLocation.pathname === `${process.env.PUBLIC_URL}/` ||
    navigationLocation.pathname.startsWith(browseBase);
  const collectionActive = navigationLocation.pathname.startsWith(collectionBase);

  const isStandalone = () => {
    const matchMediaResult = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null;
    const standaloneMatch = Boolean(matchMediaResult && matchMediaResult.matches);

    return standaloneMatch || ackPwa;
  }

  const acknowledgeStandaloneWarning = () => {
    localStorage.setItem('ack.pwa', true);
    setAckPwa(true);
  }

  return (
    <BaseProvider theme={LightTheme}>
      {!isStandalone()
        ?
        <StandaloneWarning onDismiss={() => acknowledgeStandaloneWarning()} />
        :
        <SnackbarProvider placement={PLACEMENT.top}>
          <Helmet>
            <title>LoboReader</title>
            <meta charSet="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"></meta>
            <meta name="robots" content="noindex" />
          </Helmet>
          <About ref={drawer}></About>
          <Layer>
            <div className="anchored-top">
              <HeaderNavigation
                overrides={{
                  Root: {
                    style: {
                      height: '48px',
                    }
                  }
                }}>
                <StyledNavigationList>
                  <StyledNavigationItem className="header">
                    LoboReader
                  </StyledNavigationItem>
                </StyledNavigationList>
                <StyledNavigationList $align={ALIGN.center} />
                <StyledNavigationList $align={ALIGN.right}>
                  <StyledNavigationItem>
                    <div to="#">
                      <div
                        className="header"
                        style={{
                          float: 'right',
                          marginRight: '16px',
                          marginTop: '-4px',
                          fontSize: '75%'
                        }}
                        onClick={() => {
                          drawer.current.showDrawer();
                        }}
                      >
                        About
                      </div>
                    </div>
                  </StyledNavigationItem>
                </StyledNavigationList>
              </HeaderNavigation>
              <div className="menuBar">
                <div style={{ display: 'flex' }}>
                  <NavLink
                    to={browseBase}
                    className={browseActive ? 'menuActive' : undefined}>
                    <Button
                      kind={browseActive ? KIND.secondary : KIND.tertiary}>Browse</Button>
                  </NavLink>
                  <NavLink
                    to={collectionBase}
                    className={collectionActive ? 'menuActive' : undefined}>
                    <Button kind={collectionActive ? KIND.secondary : KIND.tertiary}>Collection</Button>
                  </NavLink>
                </div>
              </div>
            </div>
          </Layer>
          <div className="container">
            <Routes location={backgroundLocation || location}>
              <Route path={`${process.env.PUBLIC_URL}/`} element={<Browser />} />
              <Route path={`${process.env.PUBLIC_URL}/browse/s/:searchQuery`} element={<Browser />} />
              <Route path={`${process.env.PUBLIC_URL}/browse/:id`} element={<Browser />} />
              <Route path={`${process.env.PUBLIC_URL}/browse`} element={<Browser />} />
              <Route path={`${process.env.PUBLIC_URL}/collection`} element={<Collection />} />
              <Route path={`${process.env.PUBLIC_URL}/read/:id`} element={<Reader />} />
              <Route path={`${process.env.PUBLIC_URL}/read/:id/p/:prevAction`} element={<Reader />} />
              <Route path={`${process.env.PUBLIC_URL}/read/:id/p/:prevAction/:prevId`} element={<Reader />} />
              <Route path="*" element={<Browser />} />
            </Routes>
            {backgroundLocation && (
              <Routes>
                <Route path={`${process.env.PUBLIC_URL}/read/:id`} element={<Reader />} />
                <Route path={`${process.env.PUBLIC_URL}/read/:id/p/:prevAction`} element={<Reader />} />
                <Route path={`${process.env.PUBLIC_URL}/read/:id/p/:prevAction/:prevId`} element={<Reader />} />
              </Routes>
            )}
          </div>
        </SnackbarProvider>
      }
    </BaseProvider>
  );
}

export default App
