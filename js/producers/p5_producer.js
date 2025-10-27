// js/producers/p5_producer.js
// Wraps a simple p5.Graphics animation as a FrameProducer.

export function createP5Producer() {
  let gfx = null;
  let w = 640, h = 400;
  let running = false, raf = null;

  // Bootstrap a minimal p5 instance
  new p5((p) => {
    p.setup = () => {
      p.pixelDensity(1);
      gfx = p.createGraphics(w, h);
      gfx.pixelDensity(1);
      p.createCanvas(1,1);
      p.noLoop();
    };
  });

  function loop() {
    if (!running || !gfx) {
      raf = requestAnimationFrame(loop);
      return;
    }
    const t = performance.now() * 0.001;
    gfx.clear();
    gfx.background(8, 10, 14);
    gfx.noStroke();
    gfx.fill(240, 250, 255);
    const r = 60 + Math.sin(t*2.0) * 6.0;
    gfx.circle(gfx.width/2, gfx.height/2, r);
    raf = requestAnimationFrame(loop);
  }

  return {
    getCanvas() { return gfx ? gfx.elt : null; },
    getSize() { return { w, h }; },
    resize(cssW, cssH, dpr) {
      // keep logical size fixed or change if desired
    },
    start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } },
    stop()  { running = false; if (raf) cancelAnimationFrame(raf); },
  };
}
