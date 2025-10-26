// Minimal p5 sketch that draws to a p5.Graphics buffer.
// We expose window.getP5Canvas() so skin.js can grab the underlying canvas.

(function(){
  let gfx = null;
  let w = 640, h = 400;

  new p5((p) => {
    p.setup = () => {
      p.pixelDensity(1);
      gfx = p.createGraphics(w, h);
      gfx.pixelDensity(1);
      p.createCanvas(1,1);
      p.noLoop();
    };
    p.draw = () => { /* not used */ };
  });

  // Lissajous curve animation
  function drawGfx(){
    if (!gfx) { requestAnimationFrame(drawGfx); return; }
    const t = performance.now() * 0.0002;

    gfx.push();
    gfx.clear();
    gfx.background(8, 10, 14);

    gfx.translate(w / 2, h / 2);
    gfx.stroke(255, 200, 150); // Amber-like color
    gfx.strokeWeight(1.5);
    gfx.noFill();

    const a = (w / 2) - 50;
    const b = (h / 2) - 50;
    const freqX = 3;
    const freqY = 4;
    const phi = t * Math.PI;

    gfx.beginShape();
    for (let i = 0; i < 200; i++) {
      const angle = (i / 199) * Math.PI * 2;
      const x = a * Math.sin(angle * freqX + phi);
      const y = b * Math.sin(angle * freqY);
      gfx.vertex(x, y);
    }
    gfx.endShape();

    gfx.pop();

    requestAnimationFrame(drawGfx);
  }
  requestAnimationFrame(drawGfx);

  // Expose getter
  window.getP5Canvas = function(){ return gfx ? gfx.elt : null; };
  window.getP5Size = function(){ return gfx ? {w: w, h: h} : {w: 640, h: 400}; };
})();
