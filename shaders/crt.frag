  #version 300 es
  precision highp float;
  in vec2 vUV;
  out vec4 fragColor;

  uniform sampler2D uTex;        // p5 content
  uniform sampler2D uPrevTex;    // previous frame (persistence)
  uniform vec2  uResolution;     // framebuffer size in pixels
  uniform float uTime;           // seconds
  uniform float uDPR;            // devicePixelRatio
  uniform vec2  uVirtRes;        // virtual raster grid (x,y)

  // Look controls
  uniform float uCurvature;
  uniform float uRasterStrength;
  uniform float uChroma;
  uniform vec3  uTint;
  uniform float uBrightness;
  uniform float uAmbient;
  uniform float uFlicker;
  uniform float uPersistence;
  uniform int   uRasterMode;
  uniform float uHorizontalSync; // 0..1
  uniform float uGlowingLine;    // 0..0.2
  uniform float uStaticNoise;    // 0..1
  uniform float uJitter;         // 0..1

  uniform sampler2D uNoiseTex;     // Noise texture
  uniform vec2      uNoiseScale;   // Scale for tiling noise texture

  // --- Fidelity constants (from cool-retro-term)
  #define INTENSITY 0.30
  #define BRIGHTBOOST 0.30
  #define SUBPIXELS 3.0
  const float PI = 3.14159265359;

  // --- Utilities
  float rgb2grey(vec3 c){ return dot(c, vec3(0.21, 0.72, 0.04)); }

  // --- Effects
  vec2 barrel(vec2 uv, float k){
    vec2 cc = uv - 0.5;
    float d = dot(cc, cc) * k;
    return uv - cc * (1.0 + d) * d;
  }

  vec3 raster_scanline(vec2 screenUV, vec3 texel, vec2 virtRes){
    vec2 coords = fract(screenUV * virtRes) * 2.0 - 1.0;
    float mask = 1.0 - abs(coords.y);
    vec3 hi = ((1.0 + BRIGHTBOOST) - (0.2 * texel)) * texel;
    vec3 lo = ((1.0 - INTENSITY) + (0.1 * texel)) * texel;
    vec3 raster = mix(lo, hi, mask);
    return mix(texel, raster, uRasterStrength);
  }

  vec3 raster_subpixel(vec2 screenUV, vec3 texel, vec2 virtRes){
    vec2 omega = PI * 2.0 * virtRes;
    vec2 ang = screenUV * omega;
    const vec3 offsets = vec3(PI) * vec3(0.5, 0.5 - 2.0/3.0, 0.5 - 4.0/3.0);
    vec3 xfactors = (SUBPIXELS + sin(ang.x + offsets)) / (SUBPIXELS + 1.0);

    vec3 t = texel * xfactors;
    vec2 coords = fract(screenUV * virtRes) * 2.0 - 1.0;
    float mask = 1.0 - abs(coords.y);
    vec3 hi = ((1.0 + BRIGHTBOOST) - (0.2 * t)) * t;
    vec3 lo = ((1.0 - INTENSITY) + (0.1 * t)) * t;
    vec3 raster = mix(lo, hi, mask);
    return mix(texel, raster, uRasterStrength);
  }

  vec3 raster_pixel(vec2 screenUV, vec3 texel, vec2 virtRes){
    vec2 coords = fract(screenUV * virtRes) * 2.0 - 1.0;
    coords *= coords; // round cells
    float mask = clamp(1.0 - coords.x - coords.y, 0.0, 1.0);
    vec3 hi = ((1.0 + BRIGHTBOOST) - (0.2 * texel)) * texel;
    vec3 lo = ((1.0 - INTENSITY) + (0.1 * texel)) * texel;
    vec3 raster = mix(lo, hi, mask);
    return mix(texel, raster, uRasterStrength);
  }

  void main(){
    // --- Coords & Initial Setup
    vec2 fragPx = (vUV * uResolution) / uDPR;
    vec2 uv = vUV;

    // --- Effect Pipeline (order from ShaderTerminal.qml)
    // 1. Curvature
    uv = barrel(uv, uCurvature);

    // 2. Horizontal Sync
    vec2 noiseCoords = uv * uNoiseScale + vec2(fract(uTime / 51.0), fract(uTime / 237.0));
    vec4 noiseTexel = texture(uNoiseTex, noiseCoords);
    float sync = sin((uv.y + uTime * 0.001) * mix(4.0, 40.0, noiseTexel.g)) * uHorizontalSync * 0.05;
    uv.x += sync;

    // 3. Jitter
    vec2 jitterOffset = vec2(noiseTexel.b, noiseTexel.a) - 0.5;
    uv += jitterOffset * 0.007 * uJitter;

    // 4. Static Noise
    float noise = (noiseTexel.a - 0.5) * uStaticNoise;

    // 5. Glowing Line
    float glowingLine = fract(smoothstep(-120.0, 0.0, uv.y * uVirtRes.y - (uVirtRes.y + 120.0) * fract(uTime * 0.00015)));
    noise += glowingLine * uGlowingLine;

    // --- Sampling
    // Safe border (outside tube)
    if(any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))){
      fragColor = vec4(0.0,0.0,0.0,1.0); return;
    }
    vec3 col = texture(uTex, uv).rgb;

    // --- Color & Rasterization
    // 6. Chroma/Tint
    float g = rgb2grey(col);
    col = uTint * mix(vec3(g), col, uChroma);
    col += noise;

    // 7. Persistence
    vec3 prev = texture(uPrevTex, vUV).rgb;
    col = max(col, prev * (1.0 - uPersistence * 10.0)); // Decay prev frame

    // 8. Rasterization
    vec3 ras;
    if(uRasterMode == 0)      ras = raster_scanline(vUV, col, uVirtRes);
    else if(uRasterMode == 1) ras = raster_subpixel(vUV, col, uVirtRes);
    else                      ras = raster_pixel(vUV, col, uVirtRes);
    col = ras;

    // --- Final Adjustments
    // 9. Flicker
    vec2 flickerCoords = vec2(fract(uTime / 1024.0 * 2.0), fract(uTime / (1024.0 * 1024.0)));
    float f = 1.0 + (texture(uNoiseTex, flickerCoords).g - 0.5) * (uFlicker*2.0);
    col *= f;

    // 10. Ambient Glow (Vignette)
    vec2 c = uv - 0.5;
    float vign = 1.0 - dot(c,c) * 1.5;
    col += uAmbient * vign;

    // 11. Brightness
    col *= uBrightness;

    fragColor = vec4(col, 1.0);
  }
