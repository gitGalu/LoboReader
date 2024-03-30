import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as BrowserRouter } from 'react-router-dom';
import { Client as Styletron } from 'styletron-engine-atomic';
import { Provider as StyletronProvider } from 'styletron-react';
import App from './App/App';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <StyletronProvider value={new Styletron()}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StyletronProvider>
);
