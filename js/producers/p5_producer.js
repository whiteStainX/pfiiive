// js/producers/p5_producer.js
// Wraps a simple p5.Graphics animation as a FrameProducer.

export function createP5Producer() {
  let gfx = null;
  let w = 640, h = 400;
  let running = false, raf = null;

  // --- Unknown Pleasures sketch ---
  let group = [];
  const nPts = 80; // Number of points per line
  const nMag = 10; // Margin for peak generation
  const shapeWidth = 400;
  const lnCount = 80;
  const bottomGap = 100;
  const lnGap = 4;
  const oriMag = 5;
  const newMag = 40;
  const getRandom = (a, b) => (b - a) * Math.random() + a;

  class Block {
    constructor(p, y_offset, n_pts) {
      this.p5 = p;
      this.y_offset = y_offset;
      this.n = n_pts;
      this.counter = getRandom(0, 1000);
      this.pts = [];
      this.mag = Array(n_pts).fill(oriMag);
      this.p = shapeWidth / (n_pts - 1);
      const majors = [getRandom(nMag, n_pts - nMag), getRandom(nMag, n_pts - nMag)];
      for (let i = 0; i < n_pts; i++) {
        this.pts.push([i * this.p, 0]);
        if (i > nMag && i < n_pts - nMag) {
          this.mag[i] = newMag * (Math.abs(i - majors[0]) / (n_pts - 2 * nMag) + Math.abs(majors[1] - i) / (n_pts - 2 * nMag));
        }
      }
    }
    updatePoints() {
      this.counter++;
      for (let i = 0; i < this.n; i++) {
        this.pts[i][1] = -this.mag[i] * this.p5.noise(this.pts[i][0] * 0.05, this.counter / 100.0);
      }
    }
    display(gfx) {
      gfx.push();
      gfx.translate((w - shapeWidth) / 2, this.y_offset);
      gfx.fill(8, 10, 14);
      gfx.noStroke();
      gfx.beginShape();
      gfx.vertex(0, 0);
      gfx.vertex(shapeWidth, 0);
      for (const pt of this.pts) gfx.curveVertex(pt[0], pt[1]);
      gfx.endShape(gfx.CLOSE);
      gfx.noFill();
      gfx.stroke(255, 255, 255);
      gfx.strokeWeight(1.5);
      gfx.beginShape();
      for (const pt of this.pts) gfx.curveVertex(pt[0], pt[1]);
      gfx.endShape();
      gfx.pop();
    }
  }

  new p5((p) => {
    p.setup = () => {
      p.pixelDensity(1);
      gfx = p.createGraphics(w, h);
      gfx.pixelDensity(1);
      p.createCanvas(1,1);
      p.noLoop();
      // Create the group of lines
      for (let i = 0; i < lnCount; i++) {
        const y = h - bottomGap - (i * lnGap);
        group.push(new Block(p, y, nPts));
      }
    };
  });

  function loop() {
    if (!running || !gfx) {
      raf = requestAnimationFrame(loop);
      return;
    }
    gfx.background(8, 10, 14);
    for (const item of group) {
      item.updatePoints();
      item.display(gfx);
    }
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
