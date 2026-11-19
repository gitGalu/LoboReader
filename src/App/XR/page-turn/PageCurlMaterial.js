/**
 * ShaderMaterial wrapper for the page curl.
 *
 * Uniform values are pushed from a plain object each frame; the vectors are
 * allocated once here rather than per frame, because a standalone headset
 * cannot afford per-frame garbage in the render loop.
 */

import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';

import { PAGE_CURL_FRAGMENT_SHADER, PAGE_CURL_VERTEX_SHADER } from './pageCurlShaders';
import { getPageImageScale } from '../scene/pageImageFit';

const SHADER_NAME = 'loboPageCurl';

let shadersRegistered = false;

/** Registers the shader source with Babylon's store exactly once. */
function registerShaders() {
  if (shadersRegistered) {
    return;
  }

  Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = PAGE_CURL_VERTEX_SHADER;
  Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = PAGE_CURL_FRAGMENT_SHADER;
  shadersRegistered = true;
}

/**
 * Creates the curl material.
 *
 * @param {import('@babylonjs/core/scene').Scene} scene
 * @param {Object} params
 * @param {number} params.pageWidth
 * @param {number} params.pageHeight
 * @returns {Object}
 */
export function createPageCurlMaterial(scene, { pageWidth, pageHeight }) {
  registerShaders();

  const material = new ShaderMaterial(
    'pageCurlMaterial',
    scene,
    SHADER_NAME,
    {
      attributes: ['position', 'normal', 'uv', 'pageSide'],
      uniforms: [
        'worldViewProjection',
        'world',
        'progress',
        'direction',
        'curlRadius',
        'stiffness',
        'grabPoint',
        'pageWidth',
        'pageHeight',
        'verticalBend',
        'edgeLag',
        'frontContentScale',
        'backContentScale',
        'paperColor',
        'lightDirection',
        'ambient'
      ],
      samplers: ['frontTexture', 'backTexture'],
      needAlphaBlending: false,
      needAlphaTesting: false
    }
  );

  // The geometry contains explicit front and back triangles. Culling ensures
  // only one of the two coplanar scans is ever rasterized.
  material.backFaceCulling = true;

  // Reused across frames so setting uniforms allocates nothing.
  const grabPoint = new Vector2(1, 0.5);
  const frontContentScale = new Vector2(1, 1);
  const backContentScale = new Vector2(1, 1);
  const lightDirection = new Vector3(0.2, -0.6, 0.8);

  material.setFloat('pageWidth', pageWidth);
  material.setFloat('pageHeight', pageHeight);
  material.setVector2('grabPoint', grabPoint);
  material.setVector3('lightDirection', lightDirection);
  material.setColor3('paperColor', new Color3(0.78, 0.77, 0.74));
  // High ambient floor: paper scatters, and letting the curl fall to black
  // would cost text legibility exactly when the page is mid-turn.
  material.setFloat('ambient', 0.72);
  material.setFloat('progress', 0);
  material.setFloat('direction', 1);

  /**
   * Applies a paper profile's constants.
   *
   * @param {import('./paperProfiles').PaperProfile} profile
   */
  const applyProfile = (profile) => {
    material.setFloat('curlRadius', profile.curlRadius);
    material.setFloat('stiffness', profile.stiffness);
    material.setFloat('verticalBend', profile.verticalBend);
    material.setFloat('edgeLag', profile.edgeLag);
    material.setFloat('ambient', profile.ambient);
  };

  return {
    material,

    applyProfile,

    /**
     * @param {number} progress 0-1
     * @param {number} direction +1 forward, -1 backward
     */
    setProgress(progress, direction) {
      material.setFloat('progress', progress);
      material.setFloat('direction', direction);
    },

    /**
     * @param {number} u
     * @param {number} v
     */
    setGrabPoint(u, v) {
      grabPoint.set(u, v);
      material.setVector2('grabPoint', grabPoint);
    },

    /**
     * @param {import('@babylonjs/core/Materials/Textures/texture').Texture | null} front
     * @param {import('@babylonjs/core/Materials/Textures/texture').Texture | null} back
     */
    setTextures(front, back) {
      if (front?.texture) {
        const scale = getPageImageScale(front.width, front.height, pageWidth, pageHeight);
        frontContentScale.set(scale.x, scale.y);
        material.setVector2('frontContentScale', frontContentScale);
        material.setTexture('frontTexture', front.texture);
      }

      if (back?.texture) {
        const scale = getPageImageScale(back.width, back.height, pageWidth, pageHeight);
        backContentScale.set(scale.x, scale.y);
        material.setVector2('backContentScale', backContentScale);
        material.setTexture('backTexture', back.texture);
      }
    },

    dispose() {
      material.dispose();
    }
  };
}
