import React from 'react';
import { Helmet } from 'react-helmet';
import { Route, Switch, withRouter, NavLink } from 'react-router-dom';
import { LightTheme, BaseProvider } from 'baseui';
import { HeaderNavigation, ALIGN, StyledNavigationList, StyledNavigationItem } from 'baseui/header-navigation';
import { Button, KIND } from 'baseui/button';
import { StatefulButtonGroup, MODE } from 'baseui/button-group';
import { SnackbarProvider, PLACEMENT } from 'baseui/snackbar';
import { Layer } from 'baseui/layer';
import Browser from './Routes/Browser';
import Collection from './Routes/Collection';
import Reader from './Routes/Reader';
import About from './Components/About';
import StandaloneWarning from './Components/StandaloneWarning';
import './App.css';

const App = (props) => {
    const drawer = React.useRef(null);

    const isStandalone = () => {
        return (window.matchMedia('(display-mode: standalone)').matches);
    }

    return (
        <BaseProvider theme={LightTheme}>
            {!isStandalone()
                ?
                <StandaloneWarning />
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
                                        <div>LoboReader</div></StyledNavigationItem>
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
                                <StatefulButtonGroup
                                    mode={MODE.radio}
                                    initialState={{ selected: 0 }}>
                                    <NavLink
                                        to={`${process.env.PUBLIC_URL}/browse`}
                                        isActive={(match, location) => {
                                            if (match || ('/LoboReader' === location.pathname || '/LoboReader/' === location.pathname)) {
                                                return true;
                                            }
                                        }}
                                        activeClassName="menuActive">
                                        <Button
                                            kind={KIND.tertiary}>Browse</Button>
                                    </NavLink>
                                    <NavLink
                                        to={`${process.env.PUBLIC_URL}/collection`}
                                        isActive={(match, location) => {
                                            return match;
                                        }}
                                        activeClassName="menuActive">
                                        <Button kind={KIND.tertiary}>Collection</Button>
                                    </NavLink>
                                </StatefulButtonGroup>
                            </div>
                        </div>
                    </Layer>
                    <div className="container">
                        <Switch>
                            <Route exact path={`${process.env.PUBLIC_URL}/`} children={<Browser />} />
                            <Route exact path={`${process.env.PUBLIC_URL}/browse/s/:searchQuery`} children={<Browser />} />
                            <Route exact path={`${process.env.PUBLIC_URL}/browse/:id`} children={<Browser />} />
                            <Route path={`${process.env.PUBLIC_URL}/browse`} children={<Browser />} />
                            <Route exact path={`${process.env.PUBLIC_URL}/collection`} children={<Collection />} />
                            <Route exact path={`${process.env.PUBLIC_URL}/read/:id`} children={<Reader />} />
                            <Route exact path={`${process.env.PUBLIC_URL}/read/:id/p/:prevAction`} children={<Reader />} />
                            <Route exact path={`${process.env.PUBLIC_URL}/read/:id/p/:prevAction/:prevId`} children={<Reader />} />
                            <Route default children={<Browser />} />
                        </Switch>
                    </div>
                </SnackbarProvider>
            }
        </BaseProvider>
    );
}

export default withRouter(App)