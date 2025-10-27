// js/three_sketches/unknown_pleasures_3d.js
// Vanilla Three.js scene that matches the "first stage" stacked lines.
// Returns a frame(t) function that should be called from your three_producer tick.

export function createUnknownPleasuresScene(THREE, renderer, opts = {}) {
  const ROWS = opts.rows ?? 69;
  const COLS = opts.cols ?? 256;
  const WIDTH = opts.width ?? 6.0;
  const GAP_Z = opts.gapZ ?? 0.075;
  const speeds = {
    s1: opts.speed1 ?? 0.28,
    s2: opts.speed2 ?? 0.52,
    s3: opts.speed3 ?? 0.95,
  };
  const wavePower = opts.wavePower ?? 1.35;
  const audioUrl = opts.audioUrl ?? "assets/track.mp3";
  const fftSize = opts.fftSize ?? 512;
  const smoothing = opts.smoothing ?? 0.82;

  // Scene + camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 2.2, 6.0);
  const target = new THREE.Vector3(0, 0, 0);

  // Resize hook provided by producer (outside) should set renderer size;
  // we keep camera aspect as 1 here and expect producer.resize to update it.

  // --- Audio ---
  const listener = new THREE.AudioListener();
  // Attach to a temporary Object3D so GC doesn't eat it
  const audioObj = new THREE.Object3D();
  audioObj.add(listener);
  scene.add(audioObj);

  const audio = new THREE.Audio(listener);
  const loader = new THREE.AudioLoader();
  const analyser = new THREE.AudioAnalyser(audio, fftSize);
  analyser.analyser.smoothingTimeConstant = smoothing;

  loader.load(audioUrl, (buffer) => {
    audio.setBuffer(buffer);
    audio.setLoop(true);
    audio.setVolume(0.8);

    // Don't play immediately. Wait for user interaction.
    const startAudio = () => {
      if (!audio.isPlaying) {
        audio.play();
      }
      window.removeEventListener('click', startAudio);
    };
    window.addEventListener('click', startAudio, { once: true });
  });

  // --- Shaders ---
  const vertSrc = `// shaders/unknown_lines.vert
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
`;
  const fragSrc = `// shaders/unknown_lines.frag
precision highp float;
out vec4 fragColor;

void main(){
  fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

  // --- Geometry: one line (strip) per row ---
  // We'll create COLS points along X in [-WIDTH/2, +WIDTH/2], y=0, z set per row.
  function makeStripGeom() {
    const positions = new Float32Array(COLS * 3);
    for (let i = 0; i < COLS; i++) {
      const t = i / (COLS - 1);
      positions[3 * i + 0] = (t - 0.5) * WIDTH; // x
      positions[3 * i + 1] = 0; // y
      positions[3 * i + 2] = 0; // z (we offset per mesh)
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }

  const strips = [];
  const baseGeom = makeStripGeom();
  for (let r = 0; r < ROWS; r++) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uWaveExpandAmplitude: { value: 0 },
        uWaveExpandPower: { value: wavePower },
        uWaveSpeed1: { value: speeds.s1 },
        uWaveSpeed2: { value: speeds.s2 },
        uWaveSpeed3: { value: speeds.s3 },
        uRowIndex: { value: r },
        uRows: { value: ROWS },
        uCols: { value: COLS },
        uWidth: { value: WIDTH },
      },
      vertexShader: vertSrc,
      fragmentShader: fragSrc,
      blending: THREE.NormalBlending,
      transparent: false,
      depthWrite: true,
    });

    const line = new THREE.Line(baseGeom, mat);
    line.position.z = -r * GAP_Z;
    scene.add(line);
    strips.push(line);
  }

  // Camera tilt/dolly (intro)
  let introT = 0;
  function animateCamera(dt) {
    // ease-in small dolly forward and pitch down
    introT = Math.min(1, introT + dt * 0.15); // ~6.6s to full
    const z = 6.0 - 0.8 * introT;
    const y = 2.2 - 0.4 * introT;
    camera.position.set(0, y, z);
    camera.lookAt(target);
  }

  // Map analyser bins to rows
  // We downsample bins (fftSize/2) to ROWS using simple stride mapping
  function rowAmplitudeFromBins(bins, row) {
    const N = bins.length;
    const idx = Math.floor((row / Math.max(1, ROWS - 1)) * (N - 1));
    return bins[idx] / 255; // 0..1
  }

  // Frame function (call inside producer's RAF before renderer.render)
  const bins = new Uint8Array(fftSize / 2);
  let lastTime = performance.now();
  return function frame(nowMs) {
    const dt = Math.max(0, (nowMs - lastTime) * 0.001);
    lastTime = nowMs;

    analyser.getFrequencyData(bins);

    for (let r = 0; r < ROWS; r++) {
      const line = strips[r];
      const u = line.material.uniforms;
      u.uTime.value = nowMs * 0.001;

      // Smooth amplitude per row (simple low-pass)
      const ampRaw = rowAmplitudeFromBins(bins, r);
      const prev = u.uWaveExpandAmplitude.value;
      const target = ampRaw * 0.32; // scale to taste
      u.uWaveExpandAmplitude.value = prev + (target - prev) * 0.18;
    }

    animateCamera(dt);
    // renderer.render(scene, camera); // producer should do this
  };
}
