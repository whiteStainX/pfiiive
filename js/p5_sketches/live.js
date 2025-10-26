// Minimal p5 sketch that draws to a p5.Graphics buffer.
// We expose window.getP5Canvas() so skin.js can grab the underlying canvas.

(function () {
  let gfx = null;
  const w = 640;
  const h = 400;
  let group = [];

  // system configuration
  const bgColor = [0, 0, 0];
  const lnColor = [255, 255, 255];
  const lnWeight = 1.0;
  const shapeWidth = 400;
  const shapeHeight = 400;
  const n = 5;
  const blockLen = (Math.min(shapeHeight, shapeWidth) / n) * 0.9;

  // helper functions here
  const getRandom = (a, b) => (b - a) * Math.random() + a;

  // Block Class for repeated patterns

  class Blcok {
    constructor(p, x_offset, y_offset, len) {
      this.p5 = p;
      this.x_offset = x_offset;
      this.y_offset = y_offset;
      this.len = len;
    }

    display(gfx) {
      gfx.push();
      gfx.translate(this.x_offset, this.y_offset);
      gfx.noFill();
      gfx.strokeWeight(lnWeight);
      gfx.stroke(lnColor);
      gfx.rect(0, 0, this.len, this.len);
      gfx.pop();
    }
  }

  new p5((p) => {
    p.setup = () => {
      p.pixelDensity(1);
      gfx = p.createGraphics(w, h);
      gfx.pixelDensity(1);
      p.createCanvas(1, 1);
      p.noLoop();

      // create the group of Block here
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          group.push(
            new Blcok(p, (i * blockLen) / 0.9, (j * blockLen) / 0.9, blockLen)
          );
        }
      }
    };
    p.draw = () => {
      /* not used */
    };
  });

  // Lissajous curve animation
  function drawGfx() {
    if (!gfx) {
      requestAnimationFrame(drawGfx);
      return;
    }
    group.map((item) => item.display(gfx));

    requestAnimationFrame(drawGfx);
  }
  requestAnimationFrame(drawGfx);

  // Expose getter
  window.getP5Canvas = function () {
    return gfx ? gfx.elt : null;
  };
  window.getP5Size = function () {
    return gfx ? { w: w, h: h } : { w: 640, h: 400 };
  };
})();
