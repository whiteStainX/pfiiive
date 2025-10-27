// shaders/unknown_lines.vert
// Displace Y using layered sines + audio envelope.
// Attributes: position (x along the strip), z is per-row offset.
// Uniforms are chosen to mirror the original's semantics without copying.

uniform float uTime;
uniform float uWaveExpandAmplitude;   // drives overall amplitude from audio
uniform float uWaveExpandPower;       // non-linear envelope shaping
uniform float uWaveSpeed1;
uniform float uWaveSpeed2;
uniform float uWaveSpeed3;

uniform float uRowIndex;              // 0..ROWS-1
uniform float uRows;                  // total rows
uniform float uCols;                  // points per row
uniform float uWidth;                 // line span in world units

// For a touch of organic motion; simple hash-noise
float hash(float n){ return fract(sin(n)*43758.5453); }

void main(){
  vec3 p = position;

  // Normalize x in [-1,1] across the strip width
  float t = (p.x / uWidth) * 2.0;  // assumes geometry x in [-uWidth/2, +uWidth/2]
  // Layered waves moving across x with time
  float w1 = sin( (t*3.14159*1.0) + uTime*uWaveSpeed1 );
  float w2 = 0.6 * sin( (t*3.14159*2.0) - uTime*uWaveSpeed2 );
  float w3 = 0.35 * sin( (t*3.14159*4.0) + uTime*uWaveSpeed3 );

  float base = (w1 + w2 + w3);

  // Envelope: emphasize center using (1 - |t|) ^ power
  float center = pow(1.0 - min(1.0, abs(t)), max(0.0001, uWaveExpandPower));
  float amp = uWaveExpandAmplitude * center;

  // Subtle row phase offset so rows don't move identically
  float rowPhase = 0.25 * uRowIndex;

  // Displacement
  p.y += amp * base + 0.04 * sin(t*12.0 + rowPhase + uTime*0.7);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
