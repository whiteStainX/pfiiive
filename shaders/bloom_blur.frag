#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uInput;
uniform vec2 uTexelSize;
uniform vec2 uDirection;
uniform float uRadius;

const float weights[5] = float[5](
  0.22702703,
  0.19459460,
  0.12162162,
  0.05405405,
  0.01621622
);

void main() {
  vec2 stepOffset = uDirection * uTexelSize * max(uRadius, 0.001);

  vec4 acc = texture(uInput, vUV) * weights[0];

  for (int i = 1; i < 5; ++i) {
    vec2 offset = stepOffset * float(i);
    vec4 sample1 = texture(uInput, vUV + offset);
    vec4 sample2 = texture(uInput, vUV - offset);
    acc += (sample1 + sample2) * weights[i];
  }

  fragColor = acc;
}
