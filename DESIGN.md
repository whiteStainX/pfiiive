# DESIGN.md — CRT Skin (Web) with p5 Logic

## 0) Purpose
Recreate **cool-retro-term**’s display look as a reusable **skin layer** in the browser, while keeping **p5.js** drawing logic decoupled. The skin emulates CRT traits (curvature, scanlines, aperture, phosphor persistence, vignette, noise, subtle flicker) and can sit on top of any 2D content (p5 canvas, image, video, or other WebGL output).

**Key constraints**
- No system hooks; runs purely in a webpage.
- Matching look & param semantics to the original QML/GLSL logic (without copying GPL text).
- DevicePixelRatio-aware (DPR) so scanlines/subpixels align to real pixels.

---

## 1) High-level Architecture

### Layering
```
[ Logic Layer ]      p5.js (or any producer) → draws into offscreen canvas (p5.Graphics)
        │
        ▼
[ HTML Layer ]       Owns canvases, DPR/layout, resize; exposes producer texture
        │
        ▼
[ Skin Layer ]       WebGL2 full-screen pass (CRT shader) + optional ping‑pong persistence
```

- **Logic layer**: your animation/drawing (p5). No shader knowledge required.
- **HTML layer**: creates the offscreen p5 canvas and the visible “skin-stage” canvas; performs **DPR scaling** and frame orchestration.
- **Skin layer**: one or two WebGL passes that sample the logic canvas and apply CRT effects.

### Rendering Flow
1. p5 draws into a `p5.Graphics` canvas at a stable logical size (`W×H`).
2. Each frame, the WebGL skin uploads (or `texSubImage2D`) the p5 canvas to `uTex`.
3. Fragment shader computes: curvature → sampling → chroma/tint → rasterization → ambient/flicker → persistence → grain → brightness.
4. Optional ping-pong FBO pair implements phosphor persistence (feedback).

---

## 2) Skin Shader Design

### Uniforms (Web)
| Uniform | Type | Purpose |
|---|---|---|
| `uTex` | sampler2D | Source texture (p5 canvas/image/video). |
| `uPrevTex` | sampler2D | Previous frame (for persistence). |
| `uResolution` | vec2 | Backing buffer size in pixels (post-DPR). |
| `uDPR` | float | DevicePixelRatio used to derive physical pixels. |
| `uVirtRes` | vec2 | Virtual raster grid (x,y). Lock scanlines/pixels to this grid. |
| `uTime` | float | Animation time (seconds). |
| `uCurvature` | float | Barrel distortion strength. |
| `uRasterStrength` | float | Blend amount for rasterization masks. |
| `uRasterMode` | int | 0=scanlines, 1=subpixel triads, 2=pixel cells. |
| `uChroma` | float | 0 mono ↔ 1 full color. |
| `uTint` | vec3 | Color multiplier (e.g., amber/green). |
| `uBrightness` | float | Final brightness multiplier. |
| `uAmbient` | float | Center glow amount. |
| `uFlicker` | float | Tiny brightness wobble. |
| `uPersistence` | float | Feedback mix from previous frame. |

### Coordinate Systems
- `vUV` in `[0,1]^2` for sampling the source.
- **Physical pixel space** derived from `(vUV * uResolution) / uDPR`. Use this to anchor scanlines/subpixels so they don’t “swim” with scaling.
- **Virtual grid**: multiply `screenUV` (i.e., `vUV`) by `uVirtRes` inside rasterization functions to lock line/cell boundaries.

### Pass Order (single fragment)
1. **Curvature**: subtle barrel warp
2. **Artifacts**: (optional) horizontal sync/jitter (future extension)
3. **Sample**: `color = texture(uTex, uv)`
4. **Chroma/Tint**: `mix(grey(color), color, uChroma) * uTint`
5. **Rasterization**: one of **scanline / subpixel / pixel-cell**
6. **Ambient**: center glow via vignette-shaped gain
7. **Flicker**: micro intensity wobble based on time/hash
8. **Persistence**: blend with `uPrevTex` (ping-pong)
9. **Grain**: tiny screen-space noise
10. **Brightness**: final multiplier

### Curvature
```
cc = uv - 0.5;
d  = dot(cc, cc) * uCurvature;
uv' = uv - cc * (1 + d) * d;
```

### Rasterization Modes
Shared call signature:
```
vec3 applyRaster(vec2 screenUV, vec3 texel, vec2 virtRes, float strength)
```

- **Scanlines** (horizontal): compute row-local coord, blend bright/dark rows.
- **Subpixel** (RGB triads along X) + vertical scanlines.
- **Pixel-cell** (rounded diamondish cells) for chunky modes.

### Persistence (Phosphor)
- Two render textures (A/B). Each frame: render to current FBO while sampling the **previous**; `color = mix(color, max(color, prevColor), uPersistence);` then swap.
- Optional: compute a **downscaled blur** of the previous frame to simulate bloom halo, then blend lightly before `max()`.

### Vignette/Glow
- Use distance from center `r2 = dot(uv - 0.5, uv - 0.5)` and a smoothstep to form a multiplier >1 near center, ≤1 at edges.

### Noise/Flicker
- Hash-based per-pixel noise; amplitude in the 1–2% range.
- Flicker via tiny multiplier (e.g., ±1%) oscillating at ~50–60 Hz-like feel.

---

## 3) HTML & Canvas Management

### DPR & Resize
- CSS size: viewport (`100vw×100vh`).
- Backing store size: `css×DPR`, applied to the WebGL canvas.
- p5 logical size remains fixed (e.g., 640×400). Upscaling is handled by the skin.

### Offscreen p5
- Use `p5.createGraphics(W,H)` with `pixelDensity(1)`.
- Expose `window.getP5Canvas()` for the skin to upload each frame.

### Upload Strategy
- Simple approach: `gl.texImage2D(…)` each frame with the p5 canvas.
- Optimization later: `texSubImage2D` or `WebGLTexImage` via `texImage2D` is fine for MVP.

---

## 4) Extensibility

- **Inputs**: Replace p5 with `<video>`, image uploads, or other WebGL scenes.
- **Presets**: Amber/Green/Trinitron (RGB) as `uTint`/`uChroma` presets.
- **UI**: Add a small control panel (curvature, raster mode, strength, tint, persistence).
- **Performance**: Downscale persistence buffer; limit bloom cost; clamp DPR used by WebGL to ≤2 for laptops.

---

## 5) Fidelity Considerations vs cool-retro-term

- Match **parameter ranges** and **relative ordering** of effects to the QML version.
- Compute **scanlines/subpixels in pixel space** (via `uResolution` and `uDPR`) and **align to a virtual grid** via `uVirtRes`.
- Persistence blend should be **small** and **clamped** to avoid excessive ghosting; the author’s effect is restrained.
- For legal safety, **do not copy** shader strings verbatim. Re-implement math.

---

## 6) Files & Responsibilities (Web)

```
index.html
  ├─ <canvas id="skin-stage">           # visible CRT output
  ├─ <script type="x-shader/x-vertex">  # vertex shader (FSQ)
  ├─ <script type="x-shader/x-fragment"># fragment (CRT)
  └─ p5 + glue includes

css/style.css
  # simple black bg, full-screen canvas

js/logic/sketch.js
  # p5 code drawing into p5.Graphics, exposes getters

js/skin.js
  # WebGL init, shaders, ping-pong, uniforms, frame loop, DPR/resize
```

---

## 7) Test Matrix

- **Browsers**: Safari 17+, Chrome/Edge, Firefox — verify WebGL2 path.
- **DPRs**: 1.0, 1.5, 2.0, 3.0 — verify scanline alignment (no “swim”).
- **Window Resize**: lines remain crisp; persistence buffer resizes correctly.
- **Presets**: amber/green/RGB — color feel matches expectations.
- **Performance**: sustained 60 fps on Apple Silicon with persistence on; no runaway GPU usage.

---

## 8) Licensing Notes
- cool-retro-term is GPL; do **not** copy QML/GLSL text. Re-implement logic and generate your own assets. Distribute this web skin under your preferred license.
