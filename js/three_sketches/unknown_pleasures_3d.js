export function createUnknownPleasures3DSketch(
  THREE,
  renderer,
  maybeCamera,
  opts = {}
) {
  let camera = null;
  let options = opts;

  if (maybeCamera && maybeCamera.isCamera) {
    camera = maybeCamera;
  } else if (maybeCamera && typeof maybeCamera === "object") {
    options = maybeCamera;
  }

  if (!camera) {
    camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  }

  const ROWS = options.rows ?? 69;
  const COLS = options.cols ?? 256;
  const WIDTH = options.width ?? 6.0;
  const LINE_THICKNESS = options.lineThickness ?? 0.05;
  const GAP_Z = options.gapZ ?? 0.075;
  const speeds = {
    s1: options.speed1 ?? 0.28,
    s2: options.speed2 ?? 0.52,
    s3: options.speed3 ?? 0.95,
  };
  const wavePower = options.wavePower ?? 1.35;
  const audioUrl = options.audioUrl ?? "assets/track.mp3";
  const fftSize = options.fftSize ?? 512;
  const smoothing = options.smoothing ?? 0.82;
  const introSpeed = options.introSpeed ?? 0.1;

  let scene;
  let analyser;
  let audio;
  const lines = [];
  const rowLevels = new Float32Array(ROWS);
  let bins = null;
  let lastTime = performance.now();
  let introT = 0;
  const target = new THREE.Vector3(0, options.targetY ?? -0.35, 0);
  const lineGroup = new THREE.Group();

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
      precision highp float;
      void main(){
        gl_FragColor = vec4(1.0);
      }
    `;

  const sampleRow = (row) => {
    if (!analyser) return 0;
    if (!bins) return 0;
    const binCount = bins.length;
    if (binCount === 0) return 0;
    const span = Math.max(2, Math.floor(binCount / ROWS));
    const start = Math.min(binCount - 1, Math.floor((row / Math.max(1.0, ROWS - 1)) * binCount));
    let sum = 0;
    let count = 0;
    for (let i = 0; i < span; i++) {
      const idx = Math.min(binCount - 1, start + i);
      sum += bins[idx];
      count++;
    }
    return count > 0 ? sum / (count * 255) : 0;
  };

  const setup = () => {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, 8, 22);

    renderer.setClearColor(0x000000, 1);

    camera.fov = 48;
    camera.near = 0.1;
    camera.far = 40;
    camera.position.set(0, 2.2, 9.0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();

    const listener = new THREE.AudioListener();
    camera.add(listener);
    audio = new THREE.Audio(listener);
    const loader = new THREE.AudioLoader();
    analyser = new THREE.AudioAnalyser(audio, fftSize);
    analyser.analyser.smoothingTimeConstant = smoothing;
    bins = analyser.data;

    loader.load(audioUrl, (buffer) => {
      audio.setBuffer(buffer);
      audio.setLoop(true);
      audio.setVolume(options.volume ?? 0.85);
      const startAudio = () => {
        if (!audio.isPlaying) {
          audio.play();
        }
      };
      window.addEventListener("pointerdown", startAudio, { once: true });
      window.addEventListener("keydown", startAudio, { once: true });
    });

    const geometry = new THREE.PlaneGeometry(WIDTH, LINE_THICKNESS, COLS - 1, 1);
    geometry.translate(0, 0, 0);

    const totalDepth = (ROWS - 1) * GAP_Z;
    const centerOffsetZ = totalDepth * 0.5;

    for (let r = 0; r < ROWS; r++) {
      const material = new THREE.ShaderMaterial({
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
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -r * GAP_Z + centerOffsetZ;
      mesh.renderOrder = r;
      lineGroup.add(mesh);
      lines.push({ mesh, uniforms: material.uniforms });
    }

    lineGroup.position.y = -0.6;
    lineGroup.rotation.x = -0.12;
    scene.add(lineGroup);

    return { scene, camera };
  };

  const update = (nowMs) => {
    const dt = Math.min(0.1, Math.max(0, (nowMs - lastTime) * 0.001));
    lastTime = nowMs;

    const now = nowMs * 0.001;
    if (analyser) {
      const freqData = analyser.getFrequencyData();
      if (freqData && freqData !== bins) {
        bins = freqData;
      }
    }

    introT = Math.min(1, introT + dt * introSpeed);
    const introEase = introT * introT * (3 - 2 * introT);

    const camY = THREE.MathUtils.lerp(2.2, 4.2, introEase);
    const camZ = THREE.MathUtils.lerp(9.0, 11.0, introEase);
    camera.position.set(0, camY, camZ);
    camera.lookAt(target);

    const tilt = THREE.MathUtils.lerp(-0.12, -0.32, introEase);
    lineGroup.rotation.x = tilt;

    for (let r = 0; r < ROWS; r++) {
      const { uniforms } = lines[r];
      uniforms.uTime.value = now;

      const sample = sampleRow(r);
      rowLevels[r] += (sample - rowLevels[r]) * 0.25;

      const rowNorm = ROWS > 1 ? r / (ROWS - 1) : 0;
      const centerWeight = 1.0 - Math.abs(rowNorm * 2.0 - 1.0);
      const staticAmp = 0.12 + 0.45 * Math.pow(centerWeight, 1.75);
      const audioAmp = rowLevels[r] * (0.3 + 0.8 * centerWeight);

      const targetAmp = THREE.MathUtils.lerp(0.02, staticAmp + audioAmp, introEase);
      uniforms.uWaveExpandAmplitude.value +=
        (targetAmp - uniforms.uWaveExpandAmplitude.value) * 0.2;
    }
  };

  return { setup, update };
}
