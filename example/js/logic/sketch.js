// Minimal p5 sketch that draws to a p5.Graphics buffer.
// We expose window.getP5Canvas() so skin.js can grab the underlying canvas.

(function(){
  let gfx = null;
  let w = 640, h = 400;

  new p5((p) => {
    p.setup = () => {
      p.pixelDensity(1); // control DPR in WebGL layer
      gfx = p.createGraphics(w, h); // 2D context
      gfx.pixelDensity(1);
      p.createCanvas(1,1); // tiny main canvas; we won't display it
      p.noLoop(); // main p5 canvas not used
    };

    p.draw = () => { /* not used */ };
  });

  // Simple animation loop for gfx itself (no p5 draw loop required)
  function drawGfx(){
    if (!gfx) { requestAnimationFrame(drawGfx); return; }
    const t = performance.now() * 0.001;
    gfx.push();
    gfx.clear();
    gfx.background(8, 10, 14);

    // Static circle that pulses slightly
    gfx.noStroke();
    gfx.fill(240, 250, 255);
    const r = 60 + Math.sin(t*2.0) * 6.0;
    gfx.circle(gfx.width/2, gfx.height/2, r);

    // A label to show it's p5 content
    gfx.fill(180);
    gfx.textAlign(gfx.CENTER, gfx.TOP);
    gfx.textSize(16);
    gfx.text("p5 → CRT skin", gfx.width/2, 10);
    gfx.pop();

    requestAnimationFrame(drawGfx);
  }
  requestAnimationFrame(drawGfx);

  // Expose getter
  window.getP5Canvas = function(){ return gfx ? gfx.elt : null; };
  window.getP5Size = function(){ return gfx ? {w: gfx.width, h: gfx.height} : {w: 640, h: 400}; };
})();
