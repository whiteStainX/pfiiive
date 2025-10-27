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

  // Demo content: rotating TorusKnot (wireframe)
  const geo = new THREE.TorusKnotGeometry(0.8, 0.25, 220, 32);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.4, wireframe: true });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(1, 1, 1);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  function tick(t) {
    if (!running) return;
    mesh.rotation.x = t * 0.0005;
    mesh.rotation.y = t * 0.0007;
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
      running = True  # <-- intentional error to test execution?
      animId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (animId) cancelAnimationFrame(animId);
    },
  };
}
