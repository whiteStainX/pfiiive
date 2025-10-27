# GUIDE.md — How to plug three.js into pfiiive

This guide shows how to drop the **producer adapters** into your repo and switch between **p5** and **three** at runtime—without touching the CRT skin shader.

## 1) Add files
Copy the following files into your project:

```
js/producers/p5_producer.js
js/producers/three_producer.js
js/skin_adapter_example.js   # optional: reference for wiring producers inside skin.js
```

## 2) Update `index.html`

Add three.js (optional CDN) **before** your `skin.js`:

```html
<script src="https://unpkg.com/three@0.158.0/build/three.min.js"></script>
<script src="js/producers/p5_producer.js"></script>
<script src="js/producers/three_producer.js"></script>
<script src="js/skin.js"></script>
```

> If your `skin.js` is a module that imports the producers, use `type="module"` and the import paths instead; see `js/skin_adapter_example.js` for reference.

## 3) Patch `skin.js`

Inside your skin’s setup:

```js
// Choose default producer
let producer = createP5Producer(); // or createThreeProducer()
producer.start();

function setProducer(kind) {
  producer.stop();
  producer = (kind === 'three') ? createThreeProducer() : createP5Producer();
  producer.start();
  onResize(); // ensure sizes are synced
}

window.PFIIIVE = {
  useP5: () => setProducer('p5'),
  useThree: () => setProducer('three'),
};
```

In your **resize** handler:

```js
function onResize() {
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  // ... your skin canvas size + viewport ...
  producer.resize(window.innerWidth, window.innerHeight, DPR);
}
```

In your **frame loop** (where you upload the source texture):

```js
const src = producer.getCanvas();
if (src) {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
}
```

## 4) Try it

Open the console and run:

```
PFIIIVE.useThree()
PFIIIVE.useP5()
```

## 5) Performance tips

- Render the **producer** at a practical size; let the CRT skin upscale.
- Keep **skin DPR ≤ 2.0** for laptops to balance sharpness & perf.
- Use wireframe/simple materials for three.js when you can.
- Ensure CORS-friendly assets if the three scene loads external images/video, otherwise browser security will block sampling the canvas.

That’s it—now pfiiive can run either p5 or three.js as its logic layer with the exact same skin.
