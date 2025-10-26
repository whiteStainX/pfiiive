#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform float uThreshold;
uniform float uSoftKnee;

// Simple luminance approximation using max channel. Keeps it cheap.
float perceivedBrightness(vec3 color) {
  return max(max(color.r, color.g), color.b);
}

void main() {
  vec3 color = texture(uScene, vUV).rgb;
  float brightness = perceivedBrightness(color);

  // Soft knee to avoid harsh cutoff. Matches common bloom implementations.
  float knee = uThreshold * uSoftKnee + 1e-4;
  float soft = clamp((brightness - uThreshold + knee) / (2.0 * knee), 0.0, 1.0);
  float weight = max(brightness - uThreshold, 0.0) + soft;
  weight = clamp(weight, 0.0, 1.0);

  vec3 bloomColor = color * weight;
  fragColor = vec4(bloomColor, weight);
}
