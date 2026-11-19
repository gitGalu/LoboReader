import {
  READING_DISTANCE,
  READING_VIEW_FILL,
  clampReadingView,
  getAdjacentReadingLeaf,
  getReadingPageHeight
} from './readingModeLayout';

describe('getReadingPageHeight', () => {
  test('uses about two thirds of the visible height at reading distance', () => {
    const fov = 0.8;
    const expected = 2 * READING_DISTANCE * Math.tan(fov / 2) * READING_VIEW_FILL;

    expect(getReadingPageHeight(fov)).toBeCloseTo(expected);
  });

  test('clamps unusual projections to a comfortable physical range', () => {
    expect(getReadingPageHeight(0.1)).toBe(0.42);
    expect(getReadingPageHeight(2.5)).toBe(0.68);
  });

  test('falls back safely for invalid camera values', () => {
    expect(getReadingPageHeight(NaN)).toBeGreaterThanOrEqual(0.42);
    expect(getReadingPageHeight(undefined, -1)).toBeLessThanOrEqual(0.68);
  });
});

describe('clampReadingView', () => {
  test('keeps a full page centred at zoom one', () => {
    expect(clampReadingView({ zoom: 1, panX: 2, panY: -2 }, 0.3, 0.45)).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0
    });
  });

  test('unlocks only the overflow introduced by zoom', () => {
    expect(clampReadingView({ zoom: 3, panX: 1, panY: -1 }, 0.3, 0.45)).toEqual({
      zoom: 3,
      panX: 0.3,
      panY: -0.45
    });
  });

  test('clamps invalid and excessive zoom values', () => {
    expect(clampReadingView({ zoom: 20, panX: 0, panY: 0 }, 0.3, 0.45).zoom).toBe(5);
    expect(clampReadingView({ zoom: NaN, panX: NaN, panY: NaN }, 0.3, 0.45)).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0
    });
  });
});

describe('getAdjacentReadingLeaf', () => {
  test('moves one leaf in either direction', () => {
    expect(getAdjacentReadingLeaf(4, 1, 10)).toBe(5);
    expect(getAdjacentReadingLeaf(4, -1, 10)).toBe(3);
  });

  test('stops at the front and back covers', () => {
    expect(getAdjacentReadingLeaf(0, -1, 10)).toBeNull();
    expect(getAdjacentReadingLeaf(9, 1, 10)).toBeNull();
  });

  test('rejects invalid navigation state', () => {
    expect(getAdjacentReadingLeaf(1, 0, 10)).toBeNull();
    expect(getAdjacentReadingLeaf(1, 1, 0)).toBeNull();
  });
});
