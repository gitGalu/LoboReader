import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';

import { getPageImageScale } from './pageImageFit';

const SHADER_NAME = 'loboPageSurface';
let registered = false;

function registerShaders() {
  if (registered) {
    return;
  }

  Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUv;
void main(void) {
  vUv = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

  Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = `
precision highp float;
varying vec2 vUv;
uniform sampler2D pageTexture;
uniform vec2 contentScale;
uniform vec3 paperColor;
uniform float flipU;
void main(void) {
  vec2 pageUv = vec2(mix(vUv.x, 1.0 - vUv.x, flipU), vUv.y);
  vec2 margin = (vec2(1.0) - contentScale) * 0.5;
  vec2 maximum = margin + contentScale;
  bool outside = pageUv.x < margin.x || pageUv.y < margin.y ||
                 pageUv.x > maximum.x || pageUv.y > maximum.y;
  vec2 fittedUv = (pageUv - margin) / max(contentScale, vec2(0.0001));
  vec3 color = outside ? paperColor : texture2D(pageTexture, fittedUv).rgb;

  // Intentionally no metallic or specular term. Scans already contain the
  // photographed paper response; adding a highlight washes out black text.
  gl_FragColor = vec4(color, 1.0);
}`;
  registered = true;
}

/** Creates the nearly matte material used by a static page. */
export function createPageSurfaceMaterial(
  name,
  scene,
  pageWidth,
  pageHeight,
  fallbackTexture,
  { flipU = false } = {}
) {
  registerShaders();

  const material = new ShaderMaterial(name, scene, SHADER_NAME, {
    attributes: ['position', 'uv'],
    uniforms: ['worldViewProjection', 'contentScale', 'paperColor', 'flipU'],
    samplers: ['pageTexture']
  });
  const contentScale = new Vector2(1, 1);

  material.backFaceCulling = false;
  material.setColor3('paperColor', new Color3(0.78, 0.77, 0.74));
  material.setFloat('flipU', flipU ? 1 : 0);
  material.setVector2('contentScale', contentScale);
  material.setTexture('pageTexture', fallbackTexture);

  return {
    material,

    setAsset(asset) {
      const next = asset ?? { texture: fallbackTexture, width: pageWidth, height: pageHeight };
      const scale = getPageImageScale(next.width, next.height, pageWidth, pageHeight);

      contentScale.set(scale.x, scale.y);
      material.setVector2('contentScale', contentScale);
      material.setTexture('pageTexture', next.texture);
    },

    dispose() {
      material.dispose(false, false);
    }
  };
}
