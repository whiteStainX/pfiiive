// Responsive p5 sketch that adapts its layout to the display aspect ratio.

(function () {
  let gfx = null;
  // The actual buffer size is fixed for performance.
  const bufferWidth = 640;
  const bufferHeight = 400;
  let group = [];

  // System configuration
  const bgColor = [0, 0, 0];
  const lnColor = [255, 255, 255];
  const lnWeight = 1.0;
  const n = 5; // 5x5 grid

  // Block Class for repeated patterns
  class Block {
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
      gfx = p.createGraphics(bufferWidth, bufferHeight);
      gfx.pixelDensity(1);
      p.createCanvas(1, 1);
      p.noLoop();

      // This function will be called by our draw loop to set up the responsive grid
      const setupResponsiveGrid = () => {
        group = []; // Clear the old grid
        const aspectRatio = window.getDisplayAspectRatio ? window.getDisplayAspectRatio() : 16 / 9;

        // Create a "virtual" responsive drawing area.
        // We'll fix the height and let the width adapt.
        const virtualHeight = 400;
        const virtualWidth = virtualHeight * aspectRatio;

        const blockLen = (Math.min(virtualWidth, virtualHeight) / n) * 0.9;
        const gridWidth = (n * blockLen) / 0.9;
        const gridHeight = (n * blockLen) / 0.9;

        // Center the grid in the virtual space
        const startX = (virtualWidth - gridWidth) / 2;
        const startY = (virtualHeight - gridHeight) / 2;

        // Map the virtual coordinates to our fixed buffer space
        const scale = bufferHeight / virtualHeight;

        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            const x = startX + (i * blockLen) / 0.9;
            const y = startY + (j * blockLen) / 0.9;
            group.push(new Block(p, x * scale, y * scale, blockLen * scale));
          }
        }
      }

      // Initial setup
      setupResponsiveGrid();

      // Redo the layout on window resize
      window.addEventListener('resize', setupResponsiveGrid);

      drawGfx(); // Start the animation loop
    };

    p.draw = () => {
      /* not used */
    };
  });

  function drawGfx() {
    if (!gfx) {
      requestAnimationFrame(drawGfx);
      return;
    }
    gfx.background(bgColor[0], bgColor[1], bgColor[2]);
    group.forEach((item) => item.display(gfx));

    // Since this is a static grid, we don't need to loop.
    // To make it animated, you would call requestAnimationFrame(drawGfx) here.
  }

  // Expose getter
  window.getP5Canvas = function () {
    return gfx ? gfx.elt : null;
  };
  window.getP5Size = function () {
    return gfx ? { w: bufferWidth, h: bufferHeight } : { w: 640, h: 400 };
  };
})();
