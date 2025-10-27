// js/producers/three_producer.js
// Offscreen three.js renderer as a FrameProducer.
// Requires THREE to be available globally (via CDN) or adjust to ESM import.

export function createThreeProducer() {
  if (typeof THREE === 'undefined') {
    console.warn('THREE not found. Include three.min.js before using three producer.');
  }
  let renderer, scene, camera, animId = null;
  let w = 640, h = 400;
  let running = false;

  const dom = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({
    canvas: dom,
    antialias: true,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(1);     // DPR handled by skin
  renderer.setSize(w, h, false); // logical size; no CSS

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.z = 3;

  // --- Unknown Pleasures scene ---
  const lines = [];
  const numLines = 80;
  const lineLength = 2.5;
  const segmentCount = 128;

  for (let i = 0; i < numLines; i++) {
    const y = -1.5 + (i / numLines) * 3;
    const points = [];
    for (let j = 0; j < segmentCount; j++) {
      const x = -lineLength / 2 + (j / (segmentCount - 1)) * lineLength;
      points.push(new THREE.Vector3(x, y, 0));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff });
    const line = new THREE.Line(geo, mat);
    line.originalY = y;
    lines.push(line);
    scene.add(line);
  }

  function tick(t) {
    if (!running) return;

    const time = t * 0.0001;
    lines.forEach((line, i) => {
      const positions = line.geometry.attributes.position.array;
      const envelope = Math.exp(-0.05 * Math.pow(i - numLines / 2, 2));

      for (let j = 0; j < segmentCount; j++) {
        const x = positions[j * 3];
        const noise = new THREE.Vector3(); // Using built-in noise might not exist, let's use Math.random for now
        const displacement = Math.random() > 0.9 ? Math.random() * envelope * 0.5 : 0;
        positions[j * 3 + 1] = line.originalY - displacement;
      }
      line.geometry.attributes.position.needsUpdate = true;
    });

    renderer.render(scene, camera);
    animId = requestAnimationFrame(tick);
  }

  return {
    getCanvas() { return dom; },
    getSize() { return { w, h }; },
    resize(cssW, cssH, dpr) {
      // choose a practical render size (half CSS is often plenty)
      w = Math.max(320, Math.floor(cssW / 2));
      h = Math.max(200, Math.floor(cssH / 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    start() {
      if (running) return;
      running = true;
      animId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (animId) cancelAnimationFrame(animId);
    },
  };
}
