const DEFAULT_CHROME_COLOR = '#ffffff';
export const READER_LAUNCH_START_EVENT = 'loboreader:reader-launch-start';
export const READER_READY_EVENT = 'loboreader:reader-ready';

const setSafeAreaBackdrop = (color, visible) => {
  document.documentElement.style.setProperty('--pwa-safe-area-background', color);
  document.documentElement.style.setProperty('--pwa-safe-area-opacity', visible ? '1' : '0');
  document.documentElement.classList.toggle('pwaChromeActive', visible);
  document.body.classList.toggle('pwaChromeActive', visible);

  const backdrop = document.querySelector('.pwaSafeAreaBackdrop');
  if (backdrop) {
    backdrop.style.backgroundColor = color;
    backdrop.style.opacity = visible ? '1' : '0';
  }
};

const getThemeColorMeta = () => {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  return meta;
};

export const setPwaChromeColor = (color = DEFAULT_CHROME_COLOR) => {
  getThemeColorMeta().setAttribute('content', color);
  setSafeAreaBackdrop(color, true);
};

export const resetPwaChromeColor = () => {
  getThemeColorMeta().setAttribute('content', DEFAULT_CHROME_COLOR);
  setSafeAreaBackdrop(DEFAULT_CHROME_COLOR, false);
};

export const showReaderLaunchOverlay = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(READER_LAUNCH_START_EVENT));
};

export const hideReaderLaunchOverlay = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(READER_READY_EVENT));
};
