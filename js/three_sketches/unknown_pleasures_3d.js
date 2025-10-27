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
        float t = (p.x / uWidth) * 2.0;
        float w1 = sin((t*3.14159*1.0) + uTime*uWaveSpeed1);
        float w2 = 0.6 * sin((t*3.14159*2.0) - uTime*uWaveSpeed2);
        float w3 = 0.35 * sin((t*3.14159*4.0) + uTime*uWaveSpeed3);
        float base = abs(w1 + w2 + w3);
        float center = pow(1.0 - min(1.0, abs(t)), max(0.0001, uWaveExpandPower));
        float amp = uWaveExpandAmplitude * center;
        float rowPhase = 0.18 * uRowIndex;
        float bandNoise = (noise(vec2(t * 5.7 + uRowIndex * 0.17, uTime * 0.18 + uRowIndex * 0.11)) - 0.5);
        float fineRipple = sin(t * 28.0 + rowPhase + uTime * 1.25) * 0.5;
        float edgeNoise = (1.0 - center) * (0.06 + 0.04 * sin(t*36.0 + uRowIndex * 1.7 + uTime * 0.6));
        p.y += amp * base;
        p.y += uRoughness * (bandNoise + fineRipple);
        p.y += edgeNoise;
        p.y += 0.02 * center;
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
        float alpha = smoothstep(0.0, 0.35, vCenterWeight);
        gl_FragColor = vec4(uColor, alpha);
      }
    `;

  const sampleRow = (row) => {
    if (!analyser) return 0;
    if (!bins) return 0;
    const binCount = bins.length;
    if (binCount === 0) return 0;
    const span = Math.max(2, Math.floor(binCount / ROWS));
    const start = Math.min(
      binCount - 1,
      Math.floor((row / Math.max(1.0, ROWS - 1)) * binCount)
    );
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
        uRoughness: { value: roughness },
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
          uColor: { value: backgroundColor.clone() },
        },
        vertexShader: vertSrc,
        fragmentShader: fragOccluderSrc,
        transparent: false,
        depthWrite: true,
        depthTest: true,
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

      const sample = sampleRow(r);
      const diff = sample - rowLevels[r];
      const rate = diff > 0 ? rowAttack : rowRelease;
      rowLevels[r] += diff * rate;
      rowLevels[r] = Math.max(0, rowLevels[r]);

      const rowNorm = ROWS > 1 ? r / (ROWS - 1) : 0;
      const centerWeight = 1.0 - Math.abs(rowNorm * 2.0 - 1.0);
      const poweredCenter = Math.pow(centerWeight, 2.15);
      const staticAmp = 0.1 + 0.52 * poweredCenter;
      const audioAmp = rowLevels[r] * (0.34 + 1.05 * poweredCenter);
      const noiseAmp =
        (1.0 - centerWeight) * 0.03 * (1.0 + Math.sin(now * 1.7 + r * 0.9));

      const targetAmp = THREE.MathUtils.lerp(
        0.02,
        staticAmp + audioAmp + noiseAmp,
        introEase
      );
      uniforms.uWaveExpandAmplitude.value +=
        (targetAmp - uniforms.uWaveExpandAmplitude.value) * 0.24;
    }
  };

  return { setup, update };
}
