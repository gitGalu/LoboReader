import { getPageImageScale } from './pageImageFit';

describe('getPageImageScale', () => {
  test('fills a page with the same aspect ratio', () => {
    expect(getPageImageScale(2100, 2970, 0.21, 0.297)).toEqual({ x: 1, y: 1 });
  });

  test('adds side margins to a narrow scan', () => {
    const scale = getPageImageScale(1000, 2000, 0.21, 0.297);

    expect(scale.x).toBeLessThan(1);
    expect(scale.y).toBe(1);
  });

  test('adds top and bottom margins to a wide scan', () => {
    const scale = getPageImageScale(2000, 1000, 0.21, 0.297);

    expect(scale.x).toBe(1);
    expect(scale.y).toBeLessThan(1);
  });

  test('degrades safely when dimensions are unavailable', () => {
    expect(getPageImageScale(undefined, undefined, 0.21, 0.297)).toEqual({ x: 1, y: 1 });
  });
});
