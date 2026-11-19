import { getPreferredImmersiveMode, isHandheldDevice, prefersReducedData } from './xrSupport';

const UA = {
  iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  // iPadOS Safari requests desktop sites by default.
  iPad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidPhone: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  quest: 'Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.0.0 Chrome/130.0.0.0 VR Safari/537.36',
  questLegacy: 'Mozilla/5.0 (Linux; Android 10; Quest 2) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/23.0.0.6.40 SamsungBrowser/4.0 Chrome/104.0.0.0 VR Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
};

/** A navigator whose WebXR answers `supported` for the listed modes. */
const makeNavigator = (userAgent, supported = [], extra = {}) => ({
  userAgent,
  xr: {
    isSessionSupported: jest.fn(async (mode) => supported.includes(mode))
  },
  ...extra
});

describe('isHandheldDevice', () => {
  it.each([
    ['iPhone', UA.iPhone],
    ['Android phone', UA.androidPhone],
    ['Android tablet', UA.androidTablet]
  ])('treats %s as handheld', (_, userAgent) => {
    expect(isHandheldDevice({ userAgent })).toBe(true);
  });

  it.each([
    ['Quest', UA.quest],
    ['legacy Quest with an Android UA', UA.questLegacy],
    ['desktop Chrome', UA.desktop]
  ])('does not treat %s as handheld', (_, userAgent) => {
    expect(isHandheldDevice({ userAgent })).toBe(false);
  });

  it('trusts userAgentData.mobile', () => {
    expect(isHandheldDevice({ userAgent: UA.desktop, userAgentData: { mobile: true } })).toBe(true);
  });
});

describe('getPreferredImmersiveMode', () => {
  it('hides XR on an ARCore Android phone even though WebXR AR is supported', async () => {
    const nav = makeNavigator(UA.androidPhone, ['immersive-ar', 'immersive-vr']);

    await expect(getPreferredImmersiveMode(nav)).resolves.toBeNull();
    expect(nav.xr.isSessionSupported).not.toHaveBeenCalled();
  });

  it('returns null when the browser has no WebXR (iPhone, iPad)', async () => {
    await expect(getPreferredImmersiveMode({ userAgent: UA.iPhone })).resolves.toBeNull();
    await expect(
      getPreferredImmersiveMode({ userAgent: UA.iPad, maxTouchPoints: 5 })
    ).resolves.toBeNull();
  });

  it('prefers passthrough on a headset', async () => {
    const nav = makeNavigator(UA.quest, ['immersive-ar', 'immersive-vr']);
    await expect(getPreferredImmersiveMode(nav)).resolves.toBe('immersive-ar');
  });

  it('falls back to VR on a headset without passthrough', async () => {
    const nav = makeNavigator(UA.questLegacy, ['immersive-vr']);
    await expect(getPreferredImmersiveMode(nav)).resolves.toBe('immersive-vr');
  });

  it('returns null on a desktop without a headset', async () => {
    await expect(getPreferredImmersiveMode(makeNavigator(UA.desktop, []))).resolves.toBeNull();
  });

  it('treats a rejected support probe as unsupported', async () => {
    const nav = {
      userAgent: UA.quest,
      xr: { isSessionSupported: jest.fn().mockRejectedValue(new Error('SecurityError')) }
    };
    await expect(getPreferredImmersiveMode(nav)).resolves.toBeNull();
  });
});

describe('prefersReducedData', () => {
  const noMedia = { matchMedia: () => ({ matches: false }) };

  it('is false on an unconstrained connection', () => {
    expect(prefersReducedData({ connection: { effectiveType: '4g', type: 'wifi' } }, noMedia)).toBe(false);
    expect(prefersReducedData({}, noMedia)).toBe(false);
  });

  it.each([
    ['data saver', { saveData: true }],
    ['cellular', { type: 'cellular' }],
    ['slow connection', { effectiveType: '3g' }]
  ])('is true with %s', (_, connection) => {
    expect(prefersReducedData({ connection }, noMedia)).toBe(true);
  });

  it('honours prefers-reduced-data', () => {
    expect(prefersReducedData({}, { matchMedia: () => ({ matches: true }) })).toBe(true);
  });
});
