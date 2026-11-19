/** Builds double-sided segmented page data anchored at x=0 (the spine). */
export function createSegmentedPageData(
  pageWidth,
  pageHeight,
  segmentsX,
  segmentsY,
  surfaceOffset = 0.00018
) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const pageSides = [];
  const indices = [];
  const verticesPerSide = (segmentsX + 1) * (segmentsY + 1);

  // Duplicate the grid for the two physical faces. A semantic side attribute
  // is more reliable than gl_FrontFacing after the vertex shader has folded
  // and mirrored the page. Reversed back indices let normal back-face culling
  // draw exactly one scan at every point on the sheet.
  for (let side = 0; side < 2; side += 1) {
    const isFront = side === 0;

    for (let row = 0; row <= segmentsY; row += 1) {
      const v = row / segmentsY;

      for (let column = 0; column <= segmentsX; column += 1) {
        const u = column / segmentsX;
        positions.push(pageWidth * u, pageHeight * (v - 0.5), -surfaceOffset);
        normals.push(0, 0, isFront ? -1 : 1);
        uvs.push(u, v);
        pageSides.push(isFront ? 1 : 0);
      }
    }
  }

  const stride = segmentsX + 1;
  for (let side = 0; side < 2; side += 1) {
    const offset = side * verticesPerSide;
    const isFront = side === 0;

    for (let row = 0; row < segmentsY; row += 1) {
      for (let column = 0; column < segmentsX; column += 1) {
        const lowerLeft = offset + row * stride + column;
        const lowerRight = lowerLeft + 1;
        const upperLeft = lowerLeft + stride;
        const upperRight = upperLeft + 1;

        if (isFront) {
          // Match Babylon's CreatePlane winding for the reader-facing side.
          indices.push(lowerLeft, lowerRight, upperRight, lowerLeft, upperRight, upperLeft);
        } else {
          indices.push(lowerLeft, upperRight, lowerRight, lowerLeft, upperLeft, upperRight);
        }
      }
    }
  }

  return { positions, normals, uvs, pageSides, indices };
}
