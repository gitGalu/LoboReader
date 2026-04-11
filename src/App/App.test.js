import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

jest.mock('./Routes/Browser', () => () => <div>Browser Route</div>);
jest.mock('./Routes/Collection', () => () => <div>Collection Route</div>);
jest.mock('./Routes/Reader', () => () => <div>Reader Route</div>);

let container;
let root;

const renderApp = async (route = '/LoboReader/browse') => {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    );
  });
};

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

test('renders the standalone warning until the app is acknowledged', async () => {
  await renderApp();
  expect(container.textContent).toMatch(/standalone pwa mode/i);
});

test('renders the main app shell after acknowledgement', async () => {
  localStorage.setItem('ack.pwa', 'true');
  await renderApp('/LoboReader/collection');

  expect(container.textContent).toContain('Browse');
  expect(container.textContent).toContain('Collection');
  expect(container.textContent).toContain('About');
});
