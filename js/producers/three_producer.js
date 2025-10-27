export function createThreeProducer(sketchPath = '../three_sketches/unknown_pleasures_3d.js') {
  if (typeof THREE === 'undefined') {
    console.warn('THREE not found. Include three.min.js before using three producer.');
    return null;
  }

  let renderer, scene, camera, sketch, animId = null;
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
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.z = 3;

  function tick(t) {
    if (!running) return;
    if (sketch && sketch.update) {
      sketch.update(t);
    }
    if (scene && camera) {
      renderer.render(scene, camera);
    }
    animId = requestAnimationFrame(tick);
  }

  const host = {
    getCanvas: () => dom,
    getSize: () => ({ w, h }),
    resize(cssW, cssH, dpr) {
      w = Math.max(320, Math.floor(cssW / 2));
      h = Math.max(200, Math.floor(cssH / 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    start() {
      if (running) return;
      running = true;
      import(sketchPath)
        .then(module => {
          const createSketch = Object.values(module).find(f => typeof f === 'function');
          if (createSketch) {
            sketch = createSketch();
            if (sketch.setup) {
              scene = sketch.setup();
            }
            animId = requestAnimationFrame(tick);
          } else {
            console.error(`No sketch creation function found in ${sketchPath}`);
          }
        })
        .catch(err => console.error(`Failed to load sketch from ${sketchPath}:`, err));
    },
    stop() {
      running = false;
      if (animId) cancelAnimationFrame(animId);
    },
  };

  return host;
}
