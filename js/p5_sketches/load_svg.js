// p5 sketch to load and display a static SVG image in a robust, isolated instance mode.

(function(){
  let gfx = null;
  const w = 640, h = 400;

  const sketch = (p) => {
    let profileImage;

    p.preload = () => {
      profileImage = p.loadImage('assets/arts/profiles.svg');
    };

    p.setup = () => {
      p.noCanvas(); // Don't create a default canvas
      p.noLoop();   // Don't run p5's own draw loop

      // Create the offscreen graphics buffer
      gfx = p.createGraphics(w, h);
      gfx.pixelDensity(1);

      // Helper to calculate dimensions to fit image in canvas while preserving aspect ratio
      const getCoverDimensions = (imgWidth, imgHeight, canvasWidth, canvasHeight) => {
        const imgRatio = imgWidth / imgHeight;
        const canvasRatio = canvasWidth / canvasHeight;
        if (imgRatio > canvasRatio) {
          // Image is wider than canvas
          return { w: canvasWidth, h: canvasWidth / imgRatio };
        } else {
          // Image is taller than or same ratio as canvas
          return { w: canvasHeight * imgRatio, h: canvasHeight };
        }
      };

      // Draw the loaded image to the buffer once
      if (gfx && profileImage) {
        const dims = getCoverDimensions(profileImage.width, profileImage.height, w, h);
        const displayWidth = dims.w * 0.8; // Add 10% padding
        const displayHeight = dims.h * 0.8;

        gfx.push();
        gfx.background(8, 10, 14);
        gfx.imageMode(gfx.CENTER);
        gfx.image(profileImage, w / 2, h / 2, displayWidth, displayHeight);
        gfx.pop();
      }
    };
  };

  new p5(sketch);

  // Expose getter - it will be ready once setup() has run
  window.getP5Canvas = function(){ return gfx ? gfx.elt : null; };
  window.getP5Size = function(){ return gfx ? {w: w, h: h} : {w: 640, h: 400}; };
})();
