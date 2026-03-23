#define TOTAL_BUBBLES 110
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uBubblePos[TOTAL_BUBBLES];
uniform float uBubbleR2[TOTAL_BUBBLES];
uniform float uThreshold;

varying vec2 vPx;

void main() {
  float sum = 0.0;
  for (int i = 0; i < TOTAL_BUBBLES; i++) {
    if (uBubbleR2[i] <= 0.0) continue;
    vec2 d = vPx - uBubblePos[i];
    float distSq = dot(d, d);
    if (distSq > 0.0) {
      float ratio = sqrt(uBubbleR2[i] / distSq);
      sum += ratio * ratio * ratio * ratio;
    }
    if (sum >= uThreshold) break;
  }
  if (sum < uThreshold) discard;
  // Cover mapping for square texture
  float drawSize = max(uResolution.x, uResolution.y);
  vec2 uv = (vPx + (vec2(drawSize) - uResolution) * 0.5) / drawSize;
  gl_FragColor = texture2D(uTexture, uv);
}
