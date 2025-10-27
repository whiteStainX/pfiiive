# 04: Producer & Sketch Architecture

To make the PFiiive skin truly reusable, the source of the visual content is abstracted away into a "Producer" interface. This allows us to treat different rendering libraries (like p5.js and three.js) as interchangeable sources.

This document explains how this architecture works and how to create new content for it.

---

## The Producer/Sketch Pattern

The system is composed of two main parts:

1.  **The Producer**: A generic host responsible for the lifecycle of a rendering environment. Its job is to load a sketch, run its animation loop, and provide its output canvas as a texture. We have two producers: `p5_producer.js` and `three_producer.js`.

2.  **The Sketch**: A self-contained file that contains the actual artistic code (the drawing, animation, or 3D scene logic). Sketches live in the `js/p5_sketches/` and `js/three_sketches/` directories.

This pattern decouples the "engine" (the producer) from the "art" (the sketch).

---

## The Producer Interface

All producers expose the same simple interface, which is what the main `skin.js` file interacts with:

```javascript
{
  getCanvas(): HTMLCanvasElement, // Returns the canvas element to be used as a texture
  start(): void,                  // Starts the producer's internal animation loop
  stop(): void,                   // Stops the animation loop
  resize(cssW, cssH, dpr): void   // Informs the producer of window size changes
}
```

---

## Creating a New p5.js Sketch

To create a new p5.js sketch that can be loaded by the `p5_producer`:

1.  Create a new file in `js/p5_sketches/`.
2.  In that file, create a single exported function with a unique name (e.g., `export function createMyP5Sketch()`).
3.  This function must return an object with two methods: `setup(p, gfx)` and `draw(p, gfx, t)`.

**Interface:**

-   `setup(p, gfx)`: Called once when the sketch is initialized. Use this to do your initial drawing setup. `p` is the p5 instance, and `gfx` is the offscreen `p5.Graphics` buffer you should draw to.
-   `draw(p, gfx, t)`: Called on every frame of the animation loop. `t` is the high-resolution time from `performance.now()`.

**Example (`my_sketch.js`):**

```javascript
export function createMyP5Sketch() {
  let x = 0;

  const setup = (p, gfx) => {
    // One-time setup
    x = gfx.width / 2;
  };

  const draw = (p, gfx, t) => {
    gfx.background(0);
    gfx.fill(255);
    gfx.circle(x, gfx.height / 2, 50);
    x = (x + 1) % gfx.width;
  };

  return { setup, draw };
}
```

**To use it**, simply change the default path in `p5_producer.js`:

```javascript
// in p5_producer.js
export function createP5Producer(sketchPath = '../p5_sketches/my_sketch.js') {
  // ...
}
```

---

## Creating a New three.js Sketch

The process is very similar for three.js.

1.  Create a new file in `js/three_sketches/`.
2.  Export a function (e.g., `export function createMyThreeSketch(THREE, renderer, camera)`).
3.  This function must return an object with two methods: `setup()` and `update(t)`.
   The producer passes in its existing camera so your sketch can retune it without re-instantiating a new one.

**Interface:**

-   `setup()`: Called once. This function is responsible for creating and configuring all your three.js objects (geometries, materials, meshes) and must return either a `THREE.Scene` object **or** an object shaped like `{ scene, camera }` if you need to swap in a custom camera.
-   `update(t)`: Called on every frame. Use this to animate your objects. `t` is the high-resolution time.

**Example (`my_3d_sketch.js`):**

```javascript
export function createMyThreeSketch(THREE, renderer, camera) {
  let mesh;

  const setup = () => {
    const scene = new THREE.Scene();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshNormalMaterial();
    mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    return { scene, camera };
  };

  const update = (t) => {
    mesh.rotation.y = t * 0.001;
  };

  return { setup, update };
}
```

**To use it**, change the default path in `three_producer.js`:

```javascript
// in three_producer.js
export function createThreeProducer(sketchPath = '../three_sketches/my_3d_sketch.js') {
  // ...
}
```
