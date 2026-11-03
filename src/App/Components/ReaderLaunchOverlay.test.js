import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import ReaderLaunchOverlay, { SLOW_LAUNCH_MS } from './ReaderLaunchOverlay';

let container;
let root;

const goBackButton = () => Array.from(container.querySelectorAll('button'))
  .find((button) => button.textContent === 'Go back');

beforeEach(() => {
  jest.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

test('only offers a way back once loading takes longer than usual', () => {
  const onCancel = jest.fn();
  act(() => root.render(<ReaderLaunchOverlay onCancel={onCancel} />));

  expect(container.textContent).toContain('Loading...');
  expect(goBackButton()).toBeUndefined();

  act(() => jest.advanceTimersByTime(SLOW_LAUNCH_MS - 1));
  expect(goBackButton()).toBeUndefined();

  act(() => jest.advanceTimersByTime(1));
  expect(container.textContent).toContain('This is taking longer than usual.');

  act(() => goBackButton().click());
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('each launch starts its own wait', () => {
  act(() => root.render(<ReaderLaunchOverlay onCancel={() => {}} />));
  act(() => jest.advanceTimersByTime(SLOW_LAUNCH_MS));
  expect(goBackButton()).toBeDefined();

  act(() => root.render(<div />));
  act(() => root.render(<ReaderLaunchOverlay onCancel={() => {}} />));
  expect(goBackButton()).toBeUndefined();
});
