/**
 * Closed-form page curl. Each horizontal strip follows a piecewise curve made
 * of a flat section, a circular bend and another flat section. The circular
 * section travels from the free edge to the spine as progress approaches one.
 * This preserves arc length without the cost or instability of cloth physics.
 */

export const PAGE_CURL_VERTEX_SHADER = `
precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute float pageSide;

uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float progress;
uniform float direction;
uniform float curlRadius;
uniform float stiffness;
uniform vec2  grabPoint;
uniform float pageWidth;
uniform float pageHeight;
uniform float verticalBend;
uniform float edgeLag;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying float vPageSide;

const float PI = 3.141592653589793;

void main(void) {
  float sheetX = clamp(position.x, 0.0, pageWidth);
  float spineDist = sheetX / max(pageWidth, 0.0001);
  float rowDistance = abs(uv.y - grabPoint.y);

  // The grabbed row leads by a few percent. This produces the delayed outer
  // corner of magazine paper, but remains a single coherent sheet rather than
  // behaving like independently simulated cloth vertices.
  float rowProgress = clamp(progress - edgeLag * rowDistance * (0.35 + 0.65 * spineDist), 0.0, 1.0);
  float eased = rowProgress * rowProgress * (3.0 - 2.0 * rowProgress);
  float totalAngle = PI * eased;

  // The circular bend narrows to zero at both endpoints. Consequently the
  // page is exactly flat at rest on either side and only curled in flight.
  float bendLength = curlRadius * totalAngle * sin(PI * eased);
  bendLength *= mix(0.75, 1.45, stiffness);
  bendLength = clamp(bendLength, 0.0, pageWidth * 0.72);

  float bendCentre = pageWidth * (1.0 - eased);
  float bendStart = clamp(bendCentre - bendLength * 0.5, 0.0, pageWidth);
  float bendEnd = clamp(bendStart + bendLength, bendStart, pageWidth);
  float actualLength = max(bendEnd - bendStart, 0.00001);

  float curveX;
  float curveZ;
  float tangentAngle;

  if (totalAngle < 0.0001 || sheetX <= bendStart) {
    curveX = sheetX;
    curveZ = 0.0;
    tangentAngle = 0.0;
  } else {
    float radius = actualLength / max(totalAngle, 0.0001);

    if (sheetX < bendEnd) {
      float along = sheetX - bendStart;
      tangentAngle = totalAngle * along / actualLength;
      curveX = bendStart + radius * sin(tangentAngle);
      curveZ = radius * (1.0 - cos(tangentAngle));
    } else {
      tangentAngle = totalAngle;
      curveX = bendStart + radius * sin(totalAngle) +
               (sheetX - bendEnd) * cos(totalAngle);
      curveZ = radius * (1.0 - cos(totalAngle)) +
               (sheetX - bendEnd) * sin(totalAngle);
    }
  }

  // A shallow crown keeps the active sheet clear of the page block. It peaks
  // mid-turn and remains far smaller than the cylindrical lift itself.
  float crown = verticalBend * 0.018 * sin(PI * uv.y) *
                sin(PI * eased) * spineDist;

  vec3 curled = vec3(direction * curveX, position.y, position.z - curveZ - crown);

  // Approximate the surface normal with the tangent of the circular section.
  // Transform it into world space so lighting remains stable while the whole
  // magazine follows the left controller.
  vec3 localNormal = normalize(vec3(
    -direction * sin(tangentAngle),
    0.0,
    -cos(tangentAngle)
  ));
  vWorldNormal = normalize(mat3(world) * localNormal);
  vUv = uv;
  vPageSide = pageSide;

  gl_Position = worldViewProjection * vec4(curled, 1.0);
}
`;

export const PAGE_CURL_FRAGMENT_SHADER = `
precision highp float;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying float vPageSide;

uniform sampler2D frontTexture;
uniform sampler2D backTexture;
uniform vec2 frontContentScale;
uniform vec2 backContentScale;
uniform vec3 paperColor;
uniform vec3 lightDirection;
uniform float ambient;
uniform float direction;

vec3 sampleFitted(sampler2D pageTexture, vec2 sourceUv, vec2 scale) {
  vec2 margin = (vec2(1.0) - scale) * 0.5;
  vec2 maximum = margin + scale;
  bool outside = sourceUv.x < margin.x || sourceUv.y < margin.y ||
                 sourceUv.x > maximum.x || sourceUv.y > maximum.y;
  vec2 fittedUv = (sourceUv - margin) / max(scale, vec2(0.0001));
  return outside ? paperColor : texture2D(pageTexture, fittedUv).rgb;
}

void main(void) {
  // Each physical face has its own triangles and an immutable side marker.
  // A backward turn begins on the opposite geometric face, so direction only
  // swaps their semantic front/back roles; it never guesses from winding.
  bool geometricFront = vPageSide > 0.5;
  bool logicalFront = direction > 0.0 ? geometricFront : !geometricFront;
  bool flipU = logicalFront ? direction < 0.0 : direction > 0.0;
  vec2 pageUv = flipU ? vec2(1.0 - vUv.x, vUv.y) : vUv;
  vec3 scan = logicalFront
    ? sampleFitted(frontTexture, pageUv, frontContentScale)
    : sampleFitted(backTexture, pageUv, backContentScale);

  vec3 n = logicalFront ? normalize(vWorldNormal) : -normalize(vWorldNormal);
  float ndl = dot(n, normalize(-lightDirection));
  float wrapped = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  float light = ambient + (1.0 - ambient) * wrapped;

  // Diffuse-only response: paper is non-metallic and intentionally has no
  // highlight that could bleach letter strokes.
  gl_FragColor = vec4(scan * light, 1.0);
}
`;
