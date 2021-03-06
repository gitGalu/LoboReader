import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import { Client as Styletron } from 'styletron-engine-atomic';
import { Provider as StyletronProvider } from 'styletron-react';
import App from './App/App';

ReactDOM.render(
  <StyletronProvider value={new Styletron()}>
    <BrowserRouter>
        <App />
    </BrowserRouter>
  </StyletronProvider>
  ,
  document.getElementById('root')
);