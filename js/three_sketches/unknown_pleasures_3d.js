// js/three_sketches/unknown_pleasures_3d.js

export function createUnknownPleasures3DSketch() {
  const lines = [];
  const numLines = 80;
  const lineLength = 2.5;
  const segmentCount = 128;
  let scene;

  const setup = () => {
    scene = new THREE.Scene();
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(1, 1, 1);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    for (let i = 0; i < numLines; i++) {
      const y = -1.5 + (i / numLines) * 3;
      const points = [];
      for (let j = 0; j < segmentCount; j++) {
        const x = -lineLength / 2 + (j / (segmentCount - 1)) * lineLength;
        points.push(new THREE.Vector3(x, y, 0));
      }

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff });
      const line = new THREE.Line(geo, mat);
      line.originalY = y;
      lines.push(line);
      scene.add(line);
    }
    return scene;
  };

  const update = (t) => {
    const time = t * 0.0001;
    lines.forEach((line, i) => {
      const positions = line.geometry.attributes.position.array;
      const envelope = Math.exp(-0.05 * Math.pow(i - numLines / 2, 2));

      for (let j = 0; j < segmentCount; j++) {
        const x = positions[j * 3];
        const displacement = Math.random() > 0.9 ? Math.random() * envelope * 0.5 : 0;
        positions[j * 3 + 1] = line.originalY - displacement;
      }
      line.geometry.attributes.position.needsUpdate = true;
    });
  };

  return {
    setup,
    update,
  };
}
