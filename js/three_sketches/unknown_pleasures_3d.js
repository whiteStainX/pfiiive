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
  const audioUrl = options.audioUrl ?? "assets/live.mp3";
  const fftSize = options.fftSize ?? 512;
  const smoothing = options.smoothing ?? 0.68;
  const introSpeed = options.introSpeed ?? 0.1;
  const rowAttack = options.rowAttack ?? 0.72;
  const rowRelease = options.rowRelease ?? 0.22;
  const roughness = options.roughness ?? 0.065;
  const autoOrbitSpeed = options.autoOrbitSpeed ?? 0.045;
  const backgroundColor = new THREE.Color(options.backgroundColor ?? 0x000000);
  const lineColor = new THREE.Color(options.lineColor ?? 0xffffff);

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
  const rowSeeds = new Float32Array(ROWS);
  const rowPhaseOffsets = new Float32Array(ROWS);
  const rowPhaseRates = new Float32Array(ROWS);
  const rowSampleOffsets = new Float32Array(ROWS);
  const rowWarpStrengths = new Float32Array(ROWS);
  const rowBaseRoughness = new Float32Array(ROWS);
  const rowHighLevels = new Float32Array(ROWS);
  const rowLowLevels = new Float32Array(ROWS);
  for (let r = 0; r < ROWS; r++) {
    const norm = ROWS > 1 ? r / (ROWS - 1) : 0;
    const centerWeight = 1.0 - Math.abs(norm * 2.0 - 1.0);
    rowSeeds[r] = Math.random() * 1000 + r * 13.371;
    rowPhaseOffsets[r] = (Math.random() * 2.0 - 1.0) * Math.PI * 0.9;
    rowPhaseRates[r] = 0.08 + Math.random() * 0.22;
    rowSampleOffsets[r] = (Math.random() * 2.0 - 1.0) * (0.45 + (1.0 - centerWeight) * 0.35);
    rowWarpStrengths[r] = 0.65 + Math.random() * 0.95 + (1.0 - centerWeight) * 0.35;
    rowBaseRoughness[r] =
      roughness * (0.65 + Math.random() * 1.25 + (1.0 - centerWeight) * 0.45);
  }
  const cameraState = {
    baseRadiusStart: options.cameraRadiusStart ?? 9.2,
    baseRadiusEnd: options.cameraRadiusEnd ?? 12.6,
    basePolarStart: options.cameraPolarStart ?? 0.68,
    basePolarEnd: options.cameraPolarEnd ?? 0.52,
    baseAzimuthOffset: options.cameraAzimuth ?? 0.18,
    userAzimuth: 0,
    userPolar: 0,
    userRadius: 0,
    targetAzimuth: 0,
    targetPolar: 0,
    targetRadius: 0,
    dragging: false,
  };

  const vertSrc = `
      uniform float uTime;
      uniform float uWaveExpandAmplitude;
      uniform float uWaveExpandPower;
      uniform float uWaveSpeed1, uWaveSpeed2, uWaveSpeed3;
      uniform float uRowIndex, uRows, uCols, uWidth;
      uniform float uRoughness;
      uniform float uRowSeed;
      uniform float uRowWarpStrength;
      uniform float uRowPhaseShift;
      varying float vCenterWeight;
      float hash(float n){ return fract(sin(n) * 43758.5453123); }
      float noise(vec2 x){
        vec2 i = floor(x);
        vec2 f = fract(x);
        float a = hash(i.x + i.y * 57.0);
        float b = hash(i.x + 1.0 + i.y * 57.0);
        float c = hash(i.x + (i.y + 1.0) * 57.0);
        float d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      void main(){
        vec3 p = position;
        float baseT = (p.x / uWidth) * 2.0;
        float lateralFocus = pow(max(0.0, 1.0 - abs(baseT)), 1.8);
        float ridgeFocus = pow(max(0.0, 1.0 - abs(baseT * 1.1)), 2.4);
        float edgeEase = 1.0 - lateralFocus;
        float rowHash = hash(uRowSeed * 1.213 + uRowIndex * 23.47);
        float rowHash2 = hash(uRowSeed * 2.731 + uRowIndex * 11.79);
        float rowHash3 = hash(uRowSeed * 4.913 + uRowIndex * 7.27);
        float localTime = uTime + uRowSeed * 0.015;
        float warp1 = sin(baseT * (1.6 + rowHash * 0.9) + localTime * (0.12 + rowHash2 * 0.4) + uRowPhaseShift) * 0.32;
        float warp2 = noise(vec2(baseT * (3.8 + rowHash2 * 1.7) + uRowSeed * 0.31, localTime * (0.22 + rowHash3 * 0.5)));
        float warp3 = sin(baseT * (11.0 + rowHash3 * 6.5) + localTime * (1.3 + rowHash2) + uRowSeed);
        float warpT = baseT;
        warpT += warp1 * 0.16 * uRowWarpStrength * mix(0.45, 1.0, ridgeFocus);
        warpT += warp2 * 0.12 * mix(0.3, 1.0, ridgeFocus) * (1.0 - abs(baseT));
        warpT += warp3 * 0.016 * ridgeFocus;
        float baseFreq = mix(0.9 + rowHash * 0.25, 1.45 + rowHash * 0.35, ridgeFocus);
        float midFreq = mix(1.6 + rowHash2 * 0.4, 2.6 + rowHash2 * 0.35, ridgeFocus);
        float fineFreq = mix(2.6 + rowHash3 * 0.5, 3.4 + rowHash3 * 0.45, ridgeFocus);
        float w1 = sin((warpT * 3.14159 * baseFreq) + localTime*uWaveSpeed1 + uRowPhaseShift);
        float w2 = (0.45 + 0.28 * rowHash2) * sin((warpT * 3.14159 * midFreq) - localTime*uWaveSpeed2 + uRowPhaseShift * 0.7);
        float w3 = (0.2 + 0.18 * rowHash3) * sin((warpT * 3.14159 * fineFreq) + localTime*uWaveSpeed3 + rowHash2 * 6.2831);
        float base = abs(w1 + w2 * ridgeFocus + w3 * ridgeFocus * 0.75);
        float center = pow(1.0 - min(1.0, abs(warpT)), max(0.0001, uWaveExpandPower));
        float amp = uWaveExpandAmplitude * center * mix(0.18, 1.0, ridgeFocus);
        float bandNoise = (noise(vec2(warpT * 4.7 + uRowSeed * 0.17, localTime * 0.38 + uRowIndex * 0.21)) - 0.5) * lateralFocus;
        float fineRipple = sin(warpT * (18.0 + rowHash3 * 7.0) + rowHash2 * 6.2831 + localTime * (1.2 + rowHash * 0.5)) * (0.32 + 0.18 * rowHash) * ridgeFocus;
        float serration = sin(warpT * (36.0 + rowHash * 18.0) + localTime * (2.4 + rowHash2 * 1.8)) * (1.0 - center) * ridgeFocus;
        float grain = (noise(vec2(warpT * 19.0 + localTime * 0.7, localTime * 1.7 + uRowSeed * 0.5)) - 0.5) * ridgeFocus;
        float edgeNoise = edgeEase * 0.012 * sin(warpT * 9.0 + uRowIndex * 0.7 + localTime * 0.4);
        p.y += amp * base;
        p.y += uRoughness * ((bandNoise * (0.6 + 0.4 * rowHash) * ridgeFocus) + (fineRipple * (0.45 + 0.35 * rowHash2)));
        p.y += uRoughness * (0.34 * grain + 0.16 * serration);
        p.y += edgeNoise;
        p.y += 0.012 * center * ridgeFocus;
        p.y = max(p.y, 0.0);
        vCenterWeight = center;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `;

  const fragLineSrc = `
      precision highp float;
      uniform vec3 uColor;
      varying float vCenterWeight;
      void main(){
        float alpha = smoothstep(0.0, 0.4, vCenterWeight);
        gl_FragColor = vec4(uColor, alpha);
      }
    `;

  const fragOccluderSrc = `
      precision highp float;
      uniform vec3 uColor;
      varying float vCenterWeight;
      void main(){
        float alpha = smoothstep(0.0, 0.25, vCenterWeight);
        gl_FragColor = vec4(uColor, alpha);
      }
    `;

  const sampleRow = (row) => {
    if (!analyser) return { energy: 0, low: 0, high: 0 };
    if (!bins) return { energy: 0, low: 0, high: 0 };
    const binCount = bins.length;
    if (binCount === 0) return { energy: 0, low: 0, high: 0 };
    const baseSpan = Math.max(4, Math.floor(binCount / (ROWS * 0.85)));
    const norm = ROWS > 1 ? row / (ROWS - 1) : 0;
    const centerIndex = norm * (binCount - 1);
    const offset = rowSampleOffsets[row] * baseSpan;
    let start = Math.floor(centerIndex - baseSpan * 0.5 + offset);
    start = Math.max(0, Math.min(binCount - baseSpan, start));
    let sum = 0;
    let weightSum = 0;
    let low = 0;
    let mid = 0;
    let high = 0;
    let lowCount = 0;
    let midCount = 0;
    let highCount = 0;
    for (let i = 0; i < baseSpan; i++) {
      const idx = Math.min(binCount - 1, start + i);
      const magnitude = bins[idx] / 255;
      const rel = baseSpan > 1 ? i / (baseSpan - 1) : 0;
      const weight = 0.6 + 0.4 * Math.cos(rel * Math.PI);
      sum += magnitude * weight;
      weightSum += weight;
      if (rel < 0.34) {
        low += magnitude;
        lowCount++;
      } else if (rel < 0.67) {
        mid += magnitude;
        midCount++;
      } else {
        high += magnitude;
        highCount++;
      }
    }
    return {
      energy: weightSum > 0 ? sum / weightSum : 0,
      low: lowCount > 0 ? low / lowCount : 0,
      high: highCount > 0 ? high / highCount : 0,
    };
  };

  const setup = () => {
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(backgroundColor.getHex(), 8, 22);

    renderer.setClearColor(backgroundColor, 1);

    camera.fov = 30;
    camera.near = 0.1;
    camera.far = 40;
    camera.position.set(0, 3.0, 10.5);
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

    const geometry = new THREE.PlaneGeometry(
      WIDTH,
      LINE_THICKNESS,
      COLS - 1,
      1
    );
    geometry.translate(0, 0, 0);

    const totalDepth = (ROWS - 1) * GAP_Z;
    const centerOffsetZ = totalDepth * 0.5;

    const canvas = renderer.domElement;
    if (canvas) {
      canvas.style.cursor = "grab";
      canvas.style.touchAction = "none";
      const pointerState = {
        pointerId: null,
        startX: 0,
        startY: 0,
        startAzimuth: 0,
        startPolar: 0,
      };

      const onPointerDown = (ev) => {
        if (pointerState.pointerId !== null) return;
        pointerState.pointerId = ev.pointerId;
        pointerState.startX = ev.clientX;
        pointerState.startY = ev.clientY;
        pointerState.startAzimuth = cameraState.targetAzimuth;
        pointerState.startPolar = cameraState.targetPolar;
        cameraState.dragging = true;
        canvas.style.cursor = "grabbing";
        canvas.setPointerCapture(ev.pointerId);
      };

      const onPointerMove = (ev) => {
        if (pointerState.pointerId !== ev.pointerId) return;
        const rect = canvas.getBoundingClientRect();
        const dx = (ev.clientX - pointerState.startX) / rect.width;
        const dy = (ev.clientY - pointerState.startY) / rect.height;
        cameraState.targetAzimuth =
          pointerState.startAzimuth - dx * Math.PI * 1.2;
        cameraState.targetPolar = THREE.MathUtils.clamp(
          pointerState.startPolar - dy * Math.PI * 0.7,
          -0.75,
          0.75
        );
      };

      const releasePointer = (ev) => {
        if (pointerState.pointerId !== ev.pointerId) return;
        cameraState.dragging = false;
        pointerState.pointerId = null;
        canvas.style.cursor = "grab";
        if (
          typeof canvas.hasPointerCapture === "function" &&
          canvas.hasPointerCapture(ev.pointerId)
        ) {
          canvas.releasePointerCapture(ev.pointerId);
        }
      };

      const onPointerUp = (ev) => {
        releasePointer(ev);
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", releasePointer);
      canvas.addEventListener("lostpointercapture", () => {
        pointerState.pointerId = null;
        cameraState.dragging = false;
        canvas.style.cursor = "grab";
      });

      canvas.addEventListener(
        "wheel",
        (ev) => {
          ev.preventDefault();
          cameraState.targetRadius = THREE.MathUtils.clamp(
            cameraState.targetRadius + ev.deltaY * 0.0024,
            options.minCameraRadiusOffset ?? -4.0,
            options.maxCameraRadiusOffset ?? 3.5
          );
        },
        { passive: false }
      );
    }

    for (let r = 0; r < ROWS; r++) {
      const dynamicUniforms = {
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
        uRoughness: { value: rowBaseRoughness[r] },
        uRowSeed: { value: rowSeeds[r] },
        uRowWarpStrength: { value: rowWarpStrengths[r] },
        uRowPhaseShift: { value: rowPhaseOffsets[r] },
      };

      const material = new THREE.ShaderMaterial({
        uniforms: {
          ...dynamicUniforms,
          uColor: { value: lineColor.clone() },
        },
        vertexShader: vertSrc,
        fragmentShader: fragLineSrc,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        alphaTest: 0.03,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });

      const occluderMaterial = new THREE.ShaderMaterial({
        uniforms: {
          ...dynamicUniforms,
          uColor: { value: lineColor.clone() },
        },
        vertexShader: vertSrc,
        fragmentShader: fragOccluderSrc,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        alphaTest: 0.02,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });

      const occluder = new THREE.Mesh(geometry, occluderMaterial);
      occluder.position.z = -r * GAP_Z + centerOffsetZ;
      occluder.position.y = -0.0025;
      occluder.renderOrder = r * 2;
      occluder.frustumCulled = false;
      lineGroup.add(occluder);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = -r * GAP_Z + centerOffsetZ;
      mesh.renderOrder = r * 2 + 1;
      mesh.frustumCulled = false;
      lineGroup.add(mesh);
      lines.push({ mesh, occluder, uniforms: material.uniforms });
    }

    lineGroup.position.y = -0.68;
    lineGroup.rotation.x = -0.18;
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

    const baseRadius = THREE.MathUtils.lerp(
      cameraState.baseRadiusStart,
      cameraState.baseRadiusEnd,
      introEase
    );
    const basePolar = THREE.MathUtils.lerp(
      cameraState.basePolarStart,
      cameraState.basePolarEnd,
      introEase
    );
    const autoAzimuth =
      (cameraState.dragging ? 0.0 : 1.0) *
      0.08 *
      Math.sin(now * autoOrbitSpeed);

    cameraState.userAzimuth +=
      (cameraState.targetAzimuth - cameraState.userAzimuth) * 0.18;
    cameraState.userPolar +=
      (cameraState.targetPolar - cameraState.userPolar) * 0.18;
    cameraState.userRadius +=
      (cameraState.targetRadius - cameraState.userRadius) * 0.14;

    const polar = THREE.MathUtils.clamp(
      basePolar + cameraState.userPolar,
      0.28,
      1.18
    );
    const azimuth =
      cameraState.baseAzimuthOffset + autoAzimuth + cameraState.userAzimuth;
    const radius = THREE.MathUtils.clamp(
      baseRadius + cameraState.userRadius,
      6.0,
      16.0
    );

    const sinPolar = Math.sin(polar);
    const cosPolar = Math.cos(polar);
    const sinAzimuth = Math.sin(azimuth);
    const cosAzimuth = Math.cos(azimuth);

    const camX = radius * sinPolar * sinAzimuth;
    const camY = target.y + radius * cosPolar;
    const camZ = target.z + radius * sinPolar * cosAzimuth;

    camera.position.set(target.x + camX, camY, camZ);
    camera.lookAt(target);

    const tilt = THREE.MathUtils.lerp(-0.22, -0.4, introEase);
    lineGroup.rotation.x = tilt;

    for (let r = 0; r < ROWS; r++) {
      const { uniforms } = lines[r];
      uniforms.uTime.value = now;

      const { energy, high, low } = sampleRow(r);
      const diff = energy - rowLevels[r];
      const rate = diff > 0 ? rowAttack : rowRelease;
      rowLevels[r] += diff * rate;
      rowLevels[r] = Math.max(0, rowLevels[r]);
      const highDiff = high - rowHighLevels[r];
      rowHighLevels[r] += highDiff * 0.35;
      rowHighLevels[r] = Math.max(0, rowHighLevels[r]);
      const lowDiff = low - rowLowLevels[r];
      rowLowLevels[r] += lowDiff * 0.22;
      rowLowLevels[r] = Math.max(0, rowLowLevels[r]);

      const rowNorm = ROWS > 1 ? r / (ROWS - 1) : 0;
      const centerWeight = 1.0 - Math.abs(rowNorm * 2.0 - 1.0);
      const amplitudeFocus = 0.88 + 0.12 * Math.pow(centerWeight, 1.45);
      const nuanceFocus = Math.pow(centerWeight, 1.75);
      const fringeEase = Math.pow(1.0 - centerWeight, 2.0);
      const staticAmp = (0.16 + 0.22 * amplitudeFocus) * amplitudeFocus;
      const audioAmp = rowLevels[r] * (0.18 + 0.46 * amplitudeFocus);
      const detailBump = rowHighLevels[r] * 0.05 * amplitudeFocus;
      const shimmer =
        0.01 * amplitudeFocus * (0.6 + 0.4 * Math.sin(now * 1.6 + r * 0.8));
      const bassLift = THREE.MathUtils.lerp(
        0.9,
        1.18,
        Math.min(1, rowLowLevels[r] * (0.3 + nuanceFocus * 0.5))
      );

      const baseTarget = (staticAmp + audioAmp + detailBump + shimmer) * bassLift;
      const targetAmp = THREE.MathUtils.lerp(
        0.014 + 0.018 * amplitudeFocus,
        baseTarget,
        introEase
      );
      uniforms.uWaveExpandAmplitude.value +=
        (targetAmp - uniforms.uWaveExpandAmplitude.value) * 0.24;
      const warpTarget =
        rowWarpStrengths[r] * (0.74 + nuanceFocus * 0.38) +
        rowHighLevels[r] * 0.58 * nuanceFocus +
        rowLowLevels[r] * 0.32 * nuanceFocus;
      uniforms.uRowWarpStrength.value +=
        (warpTarget - uniforms.uRowWarpStrength.value) * 0.18;
      const phase =
        rowPhaseOffsets[r] +
        now * rowPhaseRates[r] * (0.55 + rowHighLevels[r] * 0.45 * nuanceFocus) +
        rowLevels[r] * 1.6 * nuanceFocus;
      uniforms.uRowPhaseShift.value = phase;
      const roughTarget =
        rowBaseRoughness[r] *
        (0.9 +
          nuanceFocus *
            (0.58 +
              rowHighLevels[r] * 0.65 +
              rowLevels[r] * 0.48 +
              rowLowLevels[r] * 0.22) +
          fringeEase * 0.14);
      uniforms.uRoughness.value +=
        (roughTarget - uniforms.uRoughness.value) * 0.2;
    }
  };

  return { setup, update };
}
