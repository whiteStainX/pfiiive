// p5 sketch to generate an animated, Unknown Pleasures-style visualization.
// Adapted from the user's reference code.

(function(){
  let gfx = null;
  const w = 640, h = 400;
  let group = [];

  // System parameters adapted from user reference
  const bgColor = [8, 10, 14];
  const lnColor = [255, 255, 255];
  const lnWeight = 1.5;
  const nPts = 80; // Number of points per line
  const nMag = 10; // Margin for peak generation
  const shapeWidth = 400;
  const lnCount = 80;
  const bottomGap = 100;
  const lnGap = 4;
  const oriMag = 5;
  const newMag = 40;

  // Helper to get a random number in a range
  const getRandom = (a, b) => (b - a) * Math.random() + a;

  // The Block class, adapted to draw on the gfx buffer
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
      
      // Occlusion shape
      gfx.fill(bgColor[0], bgColor[1], bgColor[2]);
      gfx.noStroke();
      gfx.beginShape();
      gfx.vertex(0, 0);
      gfx.vertex(shapeWidth, 0);
      for (const pt of this.pts) {
        gfx.curveVertex(pt[0], pt[1]);
      }
      gfx.endShape(gfx.CLOSE);

      // The line itself
      gfx.noFill();
      gfx.stroke(lnColor[0], lnColor[1], lnColor[2]);
      gfx.strokeWeight(lnWeight);
      gfx.beginShape();
      for (const pt of this.pts) {
        gfx.curveVertex(pt[0], pt[1]);
      }
      gfx.endShape();

      gfx.pop();
    }
  }

  // p5 setup
  new p5((p) => {
    p.setup = () => {
      p.pixelDensity(1);
      gfx = p.createGraphics(w, h);
      gfx.pixelDensity(1);
      p.createCanvas(1, 1);
      p.noLoop();

      // Create the group of lines
      for (let i = 0; i < lnCount; i++) {
        const y = h - bottomGap - (i * lnGap);
        group.push(new Block(p, y, nPts));
      }

      drawGfx(); // Start the animation loop
    };

    p.draw = () => { /* not used */ };
  });

  // Animation loop
  function drawGfx() {
    if (!gfx) { requestAnimationFrame(drawGfx); return; }

    gfx.background(bgColor[0], bgColor[1], bgColor[2]);

    for (const item of group) {
      item.updatePoints();
      item.display(gfx);
    }

    requestAnimationFrame(drawGfx);
  }

  // Expose getter
  window.getP5Canvas = function() { return gfx ? gfx.elt : null; };
  window.getP5Size = function() { return gfx ? { w: w, h: h } : { w: 640, h: 400 }; };
})();