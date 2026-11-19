import {
  clampLeaf,
  getSpreadCount,
  getSpreadNeighbourLeaves,
  leafToSpread,
  spreadToLeaf,
  spreadToLeaves,
  getTurnLeaves,
  getTurnUnderlayLeaves
} from './SpreadMapping';

describe('getSpreadCount', () => {
  test('counts the cover as its own spread', () => {
    expect(getSpreadCount(1)).toBe(1);
    expect(getSpreadCount(3)).toBe(2);
    expect(getSpreadCount(5)).toBe(3);
  });

  test('gives a trailing unpaired leaf its own spread', () => {
    expect(getSpreadCount(2)).toBe(2);
    expect(getSpreadCount(4)).toBe(3);
  });

  test('handles empty and invalid issues', () => {
    expect(getSpreadCount(0)).toBe(0);
    expect(getSpreadCount(-1)).toBe(0);
    expect(getSpreadCount(NaN)).toBe(0);
  });
});

describe('spreadToLeaves', () => {
  test('shows the cover alone on the right', () => {
    expect(spreadToLeaves(0, 10)).toEqual({
      index: 0,
      left: null,
      right: 0,
      isCover: true
    });
  });

  test('pairs interior leaves from index 1', () => {
    expect(spreadToLeaves(1, 10)).toMatchObject({ left: 1, right: 2 });
    expect(spreadToLeaves(2, 10)).toMatchObject({ left: 3, right: 4 });
    expect(spreadToLeaves(3, 10)).toMatchObject({ left: 5, right: 6 });
  });

  test('leaves the right slot empty when the last leaf is unpaired', () => {
    // 6 leaves: cover(0), [1,2], [3,4], [5,-]
    expect(spreadToLeaves(3, 6)).toMatchObject({ left: 5, right: null });
  });

  test('clamps out-of-range spreads into the issue', () => {
    expect(spreadToLeaves(999, 10).index).toBe(getSpreadCount(10) - 1);
    expect(spreadToLeaves(-5, 10).index).toBe(0);
  });

  test('degrades safely for an empty issue', () => {
    expect(spreadToLeaves(0, 0)).toMatchObject({ left: null, right: null });
  });
});

describe('leafToSpread', () => {
  test('puts the cover on spread 0', () => {
    expect(leafToSpread(0, 10)).toBe(0);
  });

  test('maps both halves of a spread to the same index', () => {
    expect(leafToSpread(1, 10)).toBe(1);
    expect(leafToSpread(2, 10)).toBe(1);
    expect(leafToSpread(3, 10)).toBe(2);
    expect(leafToSpread(4, 10)).toBe(2);
  });

  test('clamps leaves past the end of the issue', () => {
    expect(leafToSpread(500, 10)).toBe(leafToSpread(9, 10));
  });

  test('treats negative leaves as the cover', () => {
    expect(leafToSpread(-3, 10)).toBe(0);
  });
});

describe('round-tripping between leaf and spread', () => {
  test('every leaf lands on a spread that contains it', () => {
    const pageCount = 13;

    for (let leaf = 0; leaf < pageCount; leaf += 1) {
      const spread = leafToSpread(leaf, pageCount);
      const { left, right } = spreadToLeaves(spread, pageCount);

      expect([left, right]).toContain(leaf);
    }
  });

  test('holds for even page counts too', () => {
    const pageCount = 12;

    for (let leaf = 0; leaf < pageCount; leaf += 1) {
      const spread = leafToSpread(leaf, pageCount);
      const { left, right } = spreadToLeaves(spread, pageCount);

      expect([left, right]).toContain(leaf);
    }
  });

  test('spreadToLeaf returns a leaf inside the same spread', () => {
    const pageCount = 9;

    for (let spread = 0; spread < getSpreadCount(pageCount); spread += 1) {
      const leaf = spreadToLeaf(spread, pageCount);

      expect(leafToSpread(leaf, pageCount)).toBe(spread);
      expect(leaf).toBeLessThan(pageCount);
    }
  });
});

describe('clampLeaf', () => {
  test('keeps in-range leaves untouched', () => {
    expect(clampLeaf(4, 10)).toBe(4);
  });

  test('clamps to the last leaf', () => {
    expect(clampLeaf(99, 10)).toBe(9);
  });

  test('floors negatives and invalid input at zero', () => {
    expect(clampLeaf(-2, 10)).toBe(0);
    expect(clampLeaf(NaN, 10)).toBe(0);
    expect(clampLeaf(3, 0)).toBe(0);
  });
});

describe('getSpreadNeighbourLeaves', () => {
  test('covers the current spread plus its neighbours', () => {
    const leaves = getSpreadNeighbourLeaves(2, 20);

    // spread 1 -> [1,2], spread 2 -> [3,4], spread 3 -> [5,6]
    expect(leaves).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]));
  });

  test('never returns leaves past the end of the issue', () => {
    const pageCount = 7;
    const lastSpread = getSpreadCount(pageCount) - 1;

    for (const leaf of getSpreadNeighbourLeaves(lastSpread, pageCount)) {
      expect(leaf).toBeLessThan(pageCount);
      expect(leaf).toBeGreaterThanOrEqual(0);
    }
  });

  test('does not repeat leaves at the issue boundary', () => {
    const leaves = getSpreadNeighbourLeaves(0, 10);
    expect(new Set(leaves).size).toBe(leaves.length);
  });
});

describe('getTurnLeaves', () => {
  test('uses current right and target left when turning forward', () => {
    expect(getTurnLeaves(1, 10, 1)).toEqual({
      targetSpread: 2,
      front: 2,
      back: 3
    });
  });

  test('uses current left and target right when turning backward', () => {
    expect(getTurnLeaves(2, 10, -1)).toEqual({
      targetSpread: 1,
      front: 3,
      back: 2
    });
  });

  test('maps both sides of the cover sheet', () => {
    expect(getTurnLeaves(0, 10, 1)).toMatchObject({ front: 0, back: 1 });
    expect(getTurnLeaves(1, 10, -1)).toMatchObject({ front: 1, back: 0 });
  });
});

describe('getTurnUnderlayLeaves', () => {
  test('reveals the next right page under a forward turn', () => {
    // [1,2] -> moving [2,3] over flat [1,4] -> [3,4]
    expect(getTurnUnderlayLeaves(1, 10, 1)).toEqual({ left: 1, right: 4 });
  });

  test('reveals the previous left page under a backward turn', () => {
    // [3,4] -> moving [3,2] over flat [1,4] -> [1,2]
    expect(getTurnUnderlayLeaves(2, 10, -1)).toEqual({ left: 1, right: 4 });
  });

  test('keeps only page 2 under the cover while opening or closing', () => {
    expect(getTurnUnderlayLeaves(0, 10, 1)).toEqual({ left: null, right: 2 });
    expect(getTurnUnderlayLeaves(1, 10, -1)).toEqual({ left: null, right: 2 });
  });
});
