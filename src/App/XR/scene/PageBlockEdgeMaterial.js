import { Effect } from '@babylonjs/core/Materials/effect';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector2 } from '@babylonjs/core/Maths/math.vector';

const SHADER_NAME = 'loboPageBlockEdge';
let registered = false;

function registerShaders() {
  if (registered) return;

  Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldViewProjection;
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
void main(void) {
  vLocalPosition = position;
  vLocalNormal = normal;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;

  Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = `
precision highp float;
varying vec3 vLocalPosition;
varying vec3 vLocalNormal;
uniform sampler2D pageTexture;
uniform sampler2D frontCoverTexture;
uniform sampler2D backCoverTexture;
uniform vec3 paperColor;
uniform vec2 pageSize;
uniform float blockDepth;
uniform float sideSign;
uniform float hasPage;

vec3 averageVerticalEdge(sampler2D scan, float edge, float direction, float pageV) {
  vec3 first = texture2D(scan, vec2(edge, pageV)).rgb;
  vec3 second = texture2D(scan, vec2(edge + direction * 0.008, pageV)).rgb;
  vec3 third = texture2D(scan, vec2(edge + direction * 0.016, pageV)).rgb;
  return (first + second + third) / 3.0;
}

vec3 averageHorizontalEdge(float pageU, float edge, float direction) {
  vec3 first = texture2D(pageTexture, vec2(pageU, edge)).rgb;
  vec3 second = texture2D(pageTexture, vec2(pageU, edge + direction * 0.008)).rgb;
  vec3 third = texture2D(pageTexture, vec2(pageU, edge + direction * 0.016)).rgb;
  return (first + second + third) / 3.0;
}

void main(void) {
  vec3 normal = normalize(vLocalNormal);
  float pageU = clamp(vLocalPosition.x / pageSize.x + 0.5, 0.004, 0.996);
  float pageV = clamp(vLocalPosition.y / pageSize.y + 0.5, 0.004, 0.996);
  float depth = clamp(vLocalPosition.z / max(blockDepth, 0.00001) + 0.5, 0.0, 1.0);

  // The face pointing towards x=0 is the bound edge. It joins the covers even
  // when the issue is closed and the left page block is hidden.
  bool isBoundEdge = abs(normal.x) > 0.5 && normal.x * sideSign < 0.0;
  if (isBoundEdge) {
    vec3 frontEdge = averageVerticalEdge(frontCoverTexture, 0.004, 1.0, pageV);
    vec3 backEdge = averageVerticalEdge(backCoverTexture, 0.996, -1.0, pageV);
    float coverMix = smoothstep(0.46, 0.54, depth);
    gl_FragColor = vec4(mix(frontEdge, backEdge, coverMix), 1.0);
    return;
  }

  vec3 scanEdge = paperColor;
  float scanInfluence = 0.0;

  // The outside vertical edge follows the left/right edge of the corresponding
  // visible page. Top and bottom cuts use that page's horizontal edges.
  if (abs(normal.x) > 0.5) {
    float edge = sideSign < 0.0 ? 0.004 : 0.996;
    float direction = sideSign < 0.0 ? 1.0 : -1.0;
    scanEdge = averageVerticalEdge(pageTexture, edge, direction, pageV);
    scanInfluence = 0.18;
  } else if (normal.y > 0.5) {
    scanEdge = averageHorizontalEdge(pageU, 0.996, -1.0);
    scanInfluence = 0.14;
  } else if (normal.y < -0.5) {
    scanEdge = averageHorizontalEdge(pageU, 0.004, 1.0);
    scanInfluence = 0.14;
  }

  vec3 color = mix(paperColor, scanEdge, scanInfluence * hasPage);

  // Fine bands across the block depth suggest compressed sheets without
  // turning the edge into corrugated cardboard or a cloth simulation.
  float phase = fract(depth * 24.0);
  float boundary = 1.0 - smoothstep(0.0, 0.10, min(phase, 1.0 - phase));
  float fibre = sin(pageU * 91.0 + pageV * 57.0) * 0.006;
  color = color * (1.0 - boundary * 0.035) + vec3(fibre);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;
  registered = true;
}

/** Matte paper-cut material for every edge except the bound spine. */
export function createPageBlockEdgeMaterial(
  name,
  scene,
  fallbackTexture,
  pageWidth,
  pageHeight,
  blockDepth,
  side
) {
  registerShaders();

  const material = new ShaderMaterial(name, scene, SHADER_NAME, {
    attributes: ['position', 'normal'],
    uniforms: [
      'worldViewProjection',
      'paperColor',
      'pageSize',
      'blockDepth',
      'sideSign',
      'hasPage'
    ],
    samplers: ['pageTexture', 'frontCoverTexture', 'backCoverTexture']
  });
  material.backFaceCulling = false;
  material.setColor3('paperColor', new Color3(0.82, 0.81, 0.77));
  material.setVector2('pageSize', new Vector2(pageWidth, pageHeight));
  material.setFloat('blockDepth', blockDepth);
  material.setFloat('sideSign', side === 'left' ? -1 : 1);
  material.setFloat('hasPage', 0);
  material.setTexture('pageTexture', fallbackTexture);
  material.setTexture('frontCoverTexture', fallbackTexture);
  material.setTexture('backCoverTexture', fallbackTexture);

  return {
    material,
    setAsset(asset) {
      material.setTexture('pageTexture', asset?.texture ?? fallbackTexture);
      material.setFloat('hasPage', asset ? 1 : 0);
    },
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
