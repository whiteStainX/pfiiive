export function createUnknownPleasuresSketch() {
  let group = [];

  // System parameters
  const nPts = 80;
  const nMag = 10;
  const shapeWidth = 400;
  const lnCount = 80;
  const bottomGap = 100;
  const lnGap = 4;
  const oriMag = 5;
  const newMag = 40;
  const getRandom = (a, b) => (b - a) * Math.random() + a;

  class Block {
    constructor(p, y_offset, n_pts, w) {
      this.p5 = p;
      this.y_offset = y_offset;
      this.n = n_pts;
      this.counter = getRandom(0, 1000);
      this.pts = [];
      this.mag = Array(n_pts).fill(oriMag);
      this.p = shapeWidth / (n_pts - 1);
      this.w = w;
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
      gfx.translate((this.w - shapeWidth) / 2, this.y_offset);
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

  return {
    setup: (p, gfx) => {
      for (let i = 0; i < lnCount; i++) {
        const y = gfx.height - bottomGap - (i * lnGap);
        group.push(new Block(p, y, nPts, gfx.width));
      }
    },
    draw: (p, gfx, t) => {
      gfx.background(8, 10, 14);
      for (const item of group) {
        item.updatePoints();
        item.display(gfx);
      }
    }
  };
}