#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomIntensity;
uniform float uBloomAlphaScale;

void main() {
  vec3 baseColor = texture(uScene, vUV).rgb;
  vec4 bloomSample = texture(uBloom, vUV);
  vec3 bloomColor = bloomSample.rgb;
  float bloomMask = bloomSample.a * uBloomAlphaScale;

  vec3 finalColor = baseColor + bloomColor * uBloomIntensity * bloomMask;
  fragColor = vec4(finalColor, 1.0);
}
