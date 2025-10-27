# THREE_PLAN.md — Adding three.js as a pluggable Logic Layer (Producer)

This plan extends your existing 3-layer architecture so **three.js** can be swapped in for **p5.js** cleanly, without changing the CRT skin.

```
Current (p5)                               With pluggable producers
-------------------------                  -------------------------------------
[p5.js sketch]                             [Producer: p5]   [Producer: three.js]  (choose one)
        │                                              \        /
        ▼                                               \      /
[HTML glue: size/DPR, skin wiring]  ────────────────────  [Producer Adapter API]
        │                                                             │
        ▼                                                             ▼
[WebGL2 CRT skin (crt.frag/vert + ping-pong)]  ◀── samples canvas from the active producer
```

## Goals
- Keep **Skin layer** untouched (only reads from a generic producer).
- Allow runtime switching between **p5** and **three**.
- Maintain **DPR-aware** scanlines/subpixels and **persistence** behavior.
- Be safe for **wireframe/lightweight** three.js content.

---

## 1) Folder Structure (proposal, matches your repo)

```
.
├── js
│   ├── skin.js                     # existing: CRT skin + render loop
│   ├── p5_sketches/                # existing p5 sketches
│   └── producers/
│       ├── p5_producer.js          # NEW: wraps your p5 flow
│       └── three_producer.js       # NEW: renders three.js offscreen
└── shaders/                         # existing CRT shaders
```

> You can move your minimal p5 wiring out of `skin.js` and into `p5_producer.js`. The skin then becomes producer-agnostic.

---

## 2) Producer Adapter API

Each producer implements the same tiny interface:

```ts
interface FrameProducer {
  getCanvas(): HTMLCanvasElement | OffscreenCanvas | null;
  getSize(): { w: number; h: number };
  resize(cssW: number, cssH: number, dpr: number): void;
  start(): void;
  stop(): void;
}
```

- **getCanvas** — returns the producer's drawing surface
- **getSize** — current logical content size
- **resize** — called from your HTML layer when the window/DPR changes
- **start/stop** — manages the producer's animation loop

The skin does not know or care if frames are p5 or three.js. It just uploads the returned canvas each frame.

---

## 3) Integration Steps

1. **Create producers**
   - Add `js/producers/p5_producer.js` (wraps your current p5 Graphics flow).
   - Add `js/producers/three_producer.js` (offscreen three.js renderer with a simple scene).

2. **Update `index.html`**
   - Include three.js (CDN) *optionally*:
     ```html
     <script src="https://unpkg.com/three@0.158.0/build/three.min.js"></script>
     ```
   - Include the two producer scripts **before** `skin.js`.
   - (If you prefer modules, import them inside `skin.js` instead — see `skin_adapter_example.js`.)

3. **Adapt `skin.js`**
   - Replace any p5-specific references with calls to the producer API.
   - Keep a single `producer` instance (default to p5).
   - On `resize`, call `producer.resize(width, height, DPR)`.
   - In the frame loop, upload `producer.getCanvas()` to the `uTex` texture:
     ```js
     const src = producer.getCanvas();
     if (src) {
       gl.activeTexture(gl.TEXTURE0);
       gl.bindTexture(gl.TEXTURE_2D, srcTex);
       gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
       gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
     }
     ```

4. **Add a runtime toggle**
   - Expose global helpers to switch producers at runtime:
     ```js
     window.PFIIIVE = {
       useP5:    () => setProducer('p5'),
       useThree: () => setProducer('three'),
     };
     ```

5. **Test DPR/resize**
   - Confirm scanlines/subpixels stay aligned when toggling between p5 and three.js.
   - If perf dips on huge displays, cap the skin DPR to 2.0 and render producers at a sensible size (e.g., half the CSS width/height).

---

## 4) Architecture ASCII – Call Graph

```
+-------------------------+          +-------------------+
|   Producer: p5          |          | Producer: three   |
|  (p5_producer.js)       |          | (three_producer.js)|
|  - createGraphics       |          | - WebGLRenderer    |
|  - RAF loop updates     |          | - RAF render()     |
|  - getCanvas() -> <canvas>         | - getCanvas() -> <canvas>
+-------------+-----------+          +----------+--------+
              \                               /
               \                             /
                v                           v
               +------------------------------+
               |   HTML layer / skin.js       |
               | - DPR/resize                 |
               | - choose producer            |
               | - upload producer canvas ->  |
               |   gl.TEXTURE_2D (uTex)       |
               | - ping-pong uPrevTex         |
               +---------------+--------------+
                               |
                               v
               +-------------------------------+
               |   WebGL2 CRT Shader (crt.frag) |
               |  curvature → chroma/tint →     |
               |  raster (scanline/subpixel) →  |
               |  ambient → flicker →           |
               |  persistence → grain → output  |
               +--------------------------------+
```

---

## 5) Performance Notes (wireframe three.js is fine)

- **Wireframe** and simple materials are cheap. Upload cost (copying the producer canvas into the skin texture) is the dominant overhead.
- Keep the producer's render size modest; the CRT look is forgiving to mild upscaling.
- Cap skin DPR to 2.0 on laptops: the scanlines still look crisp.
- After the first upload, you may switch to `texSubImage2D` per frame to avoid reallocations (optional optimization).
- If your three.js scene loads cross-origin textures, make sure CORS is enabled (`TextureLoader().setCrossOrigin('anonymous')`) to keep the producer canvas sampleable by WebGL.

---

## 6) Future Option — One-Context Postprocess

If you need absolute best performance, integrate the CRT pass **inside** three.js using a `WebGLRenderTarget` (scene → target → FSQ with CRT shader to screen). This merges layers and loses the clean plug-in boundary, so it’s not the primary path in this plan.
