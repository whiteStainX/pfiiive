export function createUnknownPleasures3DSketch(THREE, renderer, opts = {}) {
  const ROWS = opts.rows ?? 69;
  // CHANGE: Reduced column count. Since we are using a BoxGeometry with its own
  // vertex subdivisions, we don't need to manually define this many points for a line.
  // The original project used 128 subdivisions in its BoxGeometry.
  const COLS = opts.cols ?? 128;
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

  let scene, camera, analyser, lines, target; // CHANGE: Renamed 'strips' to 'lines' for clarity
  const bins = new Uint8Array(fftSize / 2);
  let introT = 0;

  const setup = () => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 2.2, 6.0);
    target = new THREE.Vector3(0, 0, 0);

    const listener = new THREE.AudioListener();
    const audioObj = new THREE.Object3D();
    audioObj.add(listener);
    scene.add(audioObj);
    const audio = new THREE.Audio(listener);
    const loader = new THREE.AudioLoader();
    analyser = new THREE.AudioAnalyser(audio, fftSize);
    analyser.analyser.smoothingTimeConstant = smoothing;

    loader.load(audioUrl, (buffer) => {
      audio.setBuffer(buffer);
      audio.setLoop(true);
      audio.setVolume(0.8);
      const startAudio = () => {
        if (!audio.isPlaying) audio.play();
        window.removeEventListener("click", startAudio);
      };
      window.addEventListener("click", startAudio, { once: true });
    });

    const vertSrc = `
      uniform float uTime;
      uniform float uWaveExpandAmplitude;
      uniform float uWaveExpandPower;
      uniform float uWaveSpeed1, uWaveSpeed2, uWaveSpeed3;
      uniform float uRowIndex, uRows, uCols, uWidth;
      void main(){
        vec3 p = position;
        float t = (p.x / uWidth) * 2.0;
        float w1 = sin((t*3.14159*1.0) + uTime*uWaveSpeed1);
        float w2 = 0.6 * sin((t*3.14159*2.0) - uTime*uWaveSpeed2);
        float w3 = 0.35 * sin((t*3.14159*4.0) + uTime*uWaveSpeed3);
        float base = (w1 + w2 + w3);
        float center = pow(1.0 - min(1.0, abs(t)), max(0.0001, uWaveExpandPower));
        float amp = uWaveExpandAmplitude * center;
        float rowPhase = 0.25 * uRowIndex;
        p.y += amp * base + 0.04 * sin(t*12.0 + rowPhase + uTime*0.7);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `;
    const fragSrc = `
      void main(){
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
    `;

    // CHANGE: The geometry is now a BoxGeometry to give the lines thickness,
    // matching the original project's technique. This is the key to achieving the
    // ribbon-like visual style. We create one geometry and reuse it for all lines
    // for better performance.
    const lineGeometry = new THREE.BoxGeometry(WIDTH, 0.03, 0.02, COLS, 1, 1);

    lines = [];
    // CHANGE: The group of lines needs to be centered so the camera looks at the
    // middle of the stack, not the very first line. This prevents perspective
    // from collapsing all the lines into what looks like a single one.
    const totalDepth = (ROWS - 1) * GAP_Z;
    const centerOffsetZ = totalDepth / 2;

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
      });

      // CHANGE: Switched from THREE.Line to THREE.Mesh to use the BoxGeometry.
      // This allows the line to have a visible surface that can be displaced.
      const mesh = new THREE.Mesh(lineGeometry, mat);

      // CHANGE: Apply the centering offset to each line's Z position.
      mesh.position.z = -r * GAP_Z + centerOffsetZ;

      scene.add(mesh);
      lines.push(mesh);
    }
    return scene;
  };

  let lastTime = performance.now();
  const update = (nowMs) => {
    const dt = Math.max(0, (nowMs - lastTime) * 0.001);
    lastTime = nowMs;

    if (analyser) analyser.getFrequencyData(bins);

    for (let r = 0; r < ROWS; r++) {
      const line = lines[r];
      const u = line.material.uniforms;
      u.uTime.value = nowMs * 0.001;
      const ampRaw =
        bins[Math.floor((r / Math.max(1, ROWS - 1)) * (bins.length - 1))] / 255;
      const prev = u.uWaveExpandAmplitude.value;

      // CHANGE: Increased the amplitude multiplier. The original value (0.32)
      // was too small, making the wave displacement from the audio nearly
      // invisible. This new value makes the response to the music much stronger
      // and more apparent.
      const target = ampRaw * 0.8;

      u.uWaveExpandAmplitude.value = prev + (target - prev) * 0.18;
    }

    // CHANGE: Modified the camera animation for a smoother, more noticeable
    // introduction. We now slowly pull the camera back and up, which gives a
    // better sense of scale and feels less static than the original animation.
    introT = Math.min(1, introT + dt * 0.1); // Animation progress (0 to 1)
    const y = 2.2 + 1.8 * introT; // Animate Y from 2.2 to 4.0
    const z = 6.0 + 4.0 * introT; // Animate Z from 6.0 to 10.0
    camera.position.set(0, y, z);
    camera.lookAt(target);
  };

  return { setup, update };
}
