export function createP5Producer(sketchPath = '../p5_sketches/unknown_pleasures.js') {
  let gfx = null;
  let p5instance = null;
  let sketch = null;
  let running = false;
  let raf = null;
  const w = 640, h = 400;

  const host = {
    getCanvas: () => gfx ? gfx.elt : null,
    getSize: () => ({ w, h }),
    resize: () => {},
    start: () => {
      if (running) return;
      running = true;

      // Dynamically import the sketch and initialize
      import(sketchPath)
        .then(module => {
          const createSketch = Object.values(module).find(f => typeof f === 'function');
          if (createSketch) {
            sketch = createSketch();
            new p5(p => {
              p5instance = p;
              p.setup = () => {
                p.pixelDensity(1);
                gfx = p.createGraphics(w, h);
                gfx.pixelDensity(1);
                p.createCanvas(1, 1);
                p.noLoop();
                if (sketch.setup) {
                  sketch.setup(p, gfx);
                }
                // Start the animation loop ONLY after setup is complete
                raf = requestAnimationFrame(loop);
              };
            });
          } else {
            console.error(`No sketch creation function found in ${sketchPath}`);
          }
        })
        .catch(err => console.error(`Failed to load sketch from ${sketchPath}:`, err));
    },
    stop: () => { running = false; if (raf) cancelAnimationFrame(raf); },
  };

  function loop(t) {
    if (!running || !sketch || !sketch.draw) {
      raf = requestAnimationFrame(loop);
      return;
    }
    sketch.draw(p5instance, gfx, t);
    raf = requestAnimationFrame(loop);
  }

  return host;
}
