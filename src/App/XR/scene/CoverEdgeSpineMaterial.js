import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';

const SHADER_NAME = 'loboCoverEdgeSpine';
let registered = false;

function registerShaders() {
  if (registered) return;

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
uniform sampler2D frontCoverTexture;
uniform sampler2D backCoverTexture;
uniform float edgeMode;

vec3 averagedEdge(sampler2D scan, float edge, float direction) {
  vec3 first = texture2D(scan, vec2(edge, vUv.y)).rgb;
  vec3 second = texture2D(scan, vec2(edge + direction * 0.008, vUv.y)).rgb;
  vec3 third = texture2D(scan, vec2(edge + direction * 0.016, vUv.y)).rgb;
  return (first + second + third) / 3.0;
}

void main(void) {
  vec3 frontEdge = averagedEdge(frontCoverTexture, 0.004, 1.0);
  vec3 backEdge = averagedEdge(backCoverTexture, 0.996, -1.0);
  vec3 splitEdge = vUv.x < 0.5 ? frontEdge : backEdge;
  vec3 color = edgeMode < 0.5
    ? splitEdge
    : (edgeMode < 1.5 ? frontEdge : backEdge);
  gl_FragColor = vec4(color, 1.0);
}`;
  registered = true;
}

/** Uses real cover edges instead of artificial grey binding surfaces. */
export function createCoverEdgeMaterial(
  name,
  scene,
  fallbackTexture,
  edge = 'split'
) {
  registerShaders();

  const material = new ShaderMaterial(name, scene, SHADER_NAME, {
    attributes: ['position', 'uv'],
    uniforms: ['worldViewProjection', 'edgeMode'],
    samplers: ['frontCoverTexture', 'backCoverTexture']
  });
  material.backFaceCulling = false;
  material.setFloat('edgeMode', edge === 'front' ? 1 : edge === 'back' ? 2 : 0);
  material.setTexture('frontCoverTexture', fallbackTexture);
  material.setTexture('backCoverTexture', fallbackTexture);

  return {
    material,
    setFrontAsset(asset) {
      material.setTexture('frontCoverTexture', asset?.texture ?? fallbackTexture);
    },
    setBackAsset(asset) {
      material.setTexture('backCoverTexture', asset?.texture ?? fallbackTexture);
    },
    dispose() {
      material.dispose(false, false);
    }
  };
}

export function createCoverEdgeSpineMaterial(scene, fallbackTexture) {
  return createCoverEdgeMaterial('SpineMaterial', scene, fallbackTexture, 'split');
}
