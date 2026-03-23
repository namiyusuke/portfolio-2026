precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uResolution;

attribute vec3 position;
attribute vec2 uv;

varying vec2 vPx;

void main() {
  vPx = uv * uResolution;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
