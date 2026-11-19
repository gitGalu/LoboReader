import { createSegmentedPageData } from './pageMeshGeometry';

describe('createSegmentedPageData', () => {
  test('creates a 28 by 16 grid with complete UVs and triangles', () => {
    const data = createSegmentedPageData(0.21, 0.297, 28, 16);
    const vertexCount = (28 + 1) * (16 + 1) * 2;

    expect(data.positions).toHaveLength(vertexCount * 3);
    expect(data.normals).toHaveLength(vertexCount * 3);
    expect(data.uvs).toHaveLength(vertexCount * 2);
    expect(data.pageSides).toHaveLength(vertexCount);
    expect(data.indices).toHaveLength(28 * 16 * 6 * 2);
  });

  test('anchors the first column at the spine and the last at page width', () => {
    const data = createSegmentedPageData(0.21, 0.297, 2, 1);

    expect(data.positions[0]).toBe(0);
    expect(data.positions[6]).toBeCloseTo(0.21);
    expect(Math.min(...data.uvs)).toBe(0);
    expect(Math.max(...data.uvs)).toBe(1);
  });

  test('marks separate front and back grids with opposite winding', () => {
    const data = createSegmentedPageData(0.21, 0.297, 1, 1);

    expect(data.pageSides).toEqual([1, 1, 1, 1, 0, 0, 0, 0]);
    expect(data.indices.slice(0, 3)).toEqual([0, 1, 3]);
    expect(data.indices.slice(6, 9)).toEqual([4, 7, 5]);
  });

  test('places the flat sheet slightly above the static pages', () => {
    const data = createSegmentedPageData(0.21, 0.297, 1, 1, 0.0008);
    const zCoordinates = data.positions.filter((_, index) => index % 3 === 2);

    expect(new Set(zCoordinates)).toEqual(new Set([-0.0008]));
  });
});
