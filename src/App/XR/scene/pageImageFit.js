/**
 * Returns the fraction of a physical page occupied by an image when the image
 * is fitted without cropping or stretching. The unused area is rendered as a
 * neutral paper margin by the page shaders.
 *
 * @param {number} imageWidth
 * @param {number} imageHeight
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @returns {{ x: number, y: number }}
 */
export function getPageImageScale(imageWidth, imageHeight, pageWidth, pageHeight) {
  if (
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    pageWidth <= 0 ||
    pageHeight <= 0
  ) {
    return { x: 1, y: 1 };
  }

  const imageAspect = imageWidth / imageHeight;
  const pageAspect = pageWidth / pageHeight;

  if (imageAspect > pageAspect) {
    return { x: 1, y: pageAspect / imageAspect };
  }

  return { x: imageAspect / pageAspect, y: 1 };
}
