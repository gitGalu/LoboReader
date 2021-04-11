import React from 'react';
import { Helmet } from 'react-helmet';
import { Route, Switch, withRouter, Link, NavLink } from 'react-router-dom';
import { HeaderNavigation, ALIGN, StyledNavigationList, StyledNavigationItem } from 'baseui/header-navigation';
import { Button, KIND } from 'baseui/button';
import { StatefulButtonGroup, MODE } from 'baseui/button-group';
import { SnackbarProvider, PLACEMENT } from 'baseui/snackbar';
import Browser from './Routes/Browser';
import Collection from './Routes/Collection';
import Reader from './Routes/Reader';
import About from './Components/About';
import StandaloneWarning from './Components/StandaloneWarning';
import './App.css';

const App = (props) => {
    const [isOpen, setOpen] = React.useState(false);

    const isStandalone = () => {
        return (window.matchMedia('(display-mode: standalone)').matches);
    }

    return (
        isStandalone()
            ?
            <StandaloneWarning />
            :
            <SnackbarProvider placement={PLACEMENT.top}>
                <Helmet>
                    <meta charSet="utf-8" />
                    <title>LoboReader</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"></meta>
                    <meta name="robots" content="noindex" />
                </Helmet>
                <About isOpen={isOpen} onClose={() => setOpen(false)}></About>
                <div className="anchored-top">
                    <HeaderNavigation
                        overrides={{
                            Root: {
                                style: {
                                    height: '48px',
                                    width: '100%',
                                }
                            }
                        }}>
                        <StyledNavigationList
                            $align={ALIGN.left}>
                            <StyledNavigationItem className="header">
                                <div>LoboReader</div></StyledNavigationItem>
                        </StyledNavigationList>
                        <StyledNavigationList $align={ALIGN.center} />
                        <StyledNavigationList $align={ALIGN.right}>
                            <StyledNavigationItem>
                                <Link to="#">
                                    <div
                                        className="header"
                                        style={{
                                            float: 'right',
                                            marginRight: '16px',
                                            marginTop: '-4px',
                                            fontSize: '75%'
                                        }}
                                        onClick={() => setOpen(s => !s)}>
                                        About
                                </div>
                                </Link>
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
                                    if (match || '/' === location.pathname) {
                                        return true;
                                    }
                                }}
                                activeClassName="menuActive">
                                <Button kind={KIND.tertiary}>Browse</Button>
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

                <div className="container">
                    <Switch>
                        <Route exact path={`${process.env.PUBLIC_URL}/`} component={Browser} />
                        <Route exact path={`${process.env.PUBLIC_URL}/browse/s/:searchQuery`} component={Browser} />
                        <Route exact path={`${process.env.PUBLIC_URL}/browse/:id`} component={Browser} />
                        <Route path={`${process.env.PUBLIC_URL}/browse`} component={Browser} />
                        <Route exact path={`${process.env.PUBLIC_URL}/collection`} component={Collection} />
                        <Route exact path={`${process.env.PUBLIC_URL}/read/:id`} component={Reader} />
                        <Route exact path={`${process.env.PUBLIC_URL}/read/:id/p/:prevAction`} component={Reader} />
                        <Route exact path={`${process.env.PUBLIC_URL}/read/:id/p/:prevAction/:prevId`} component={Reader} />
                        <Route default component={Browser} />
                    </Switch>
                </div>
            </SnackbarProvider>
    );
}

export default withRouter(App)