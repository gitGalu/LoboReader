import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { READER_LAUNCH_CANCEL_EVENT, READER_LAUNCH_START_EVENT } from './Components/PwaChrome';
import { SLOW_LAUNCH_MS } from './Components/ReaderLaunchOverlay';

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

test('a reader launch that hangs can be abandoned', async () => {
  jest.useFakeTimers();
  localStorage.setItem('ack.pwa', 'true');
  await renderApp('/LoboReader/browse');

  const cancelled = jest.fn();
  window.addEventListener(READER_LAUNCH_CANCEL_EVENT, cancelled);

  act(() => {
    window.dispatchEvent(new Event(READER_LAUNCH_START_EVENT));
  });
  expect(container.querySelector('.readerLaunchOverlay')).not.toBeNull();

  act(() => jest.advanceTimersByTime(SLOW_LAUNCH_MS));
  const goBack = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Go back');

  act(() => goBack.click());
  expect(cancelled).toHaveBeenCalledTimes(1);
  expect(container.querySelector('.readerLaunchOverlay')).toBeNull();

  window.removeEventListener(READER_LAUNCH_CANCEL_EVENT, cancelled);
  jest.useRealTimers();
});
