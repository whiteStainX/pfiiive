# 05-Unknown-Pleasures-FIRST-STAGE.md

This kit reproduces **only the first segment** of poeti8’s visual: a field of stacked, audio-reactive lines—ported to **vanilla Three.js** so it can run as a **pfiiive** three-producer sketch, with your CRT skin applied afterward.

## How it maps to the original

| Original file | What we mirrored |
|---|---|
| `src/components/Lines/Lines.tsx` + `Line.tsx` | Rows of line meshes, per-line uniforms, progressive -Z spacing |
| `src/components/Audio/Audio.tsx` | Web Audio via `THREE.Audio` + `THREE.AudioAnalyser(fftSize=512)` |
| `src/shaders/line/line.vertex.glsl` | Vertex displacement using layered sines with 3 speeds + amplitude envelope |
| `src/animations/stages/stage.one.ts` | Slow camera dolly + amplitude ramp at start |

> We reimplemented shader logic (no copy-paste) to stay license-clean, but kept the semantics: `uTime`, `uWaveExpandAmplitude`, `uWaveSpeed1..3`, `uWaveExpandPower`.

## Files

- `js/three_sketches/unknown_pleasures_3d.js` — creates the scene and returns a `frame(t)` function (call from your producer’s RAF before `renderer.render`).  
- `shaders/unknown_lines.vert` — vertex shader (displaces Y using audio + waves).  
- `shaders/unknown_lines.frag` — fragment shader (simple white, optional fog).

## Parameters (defaults)

- ROWS = 69  
- COLS = 256  
- LINE_WIDTH = 6.0 (span in X)  
- GAP_Z = 0.075 (spacing between rows along -Z)  
- uWaveSpeed1/2/3 = 0.28 / 0.52 / 0.95  
- uWaveExpandPower = 1.35  
- Audio fftSize = 512, smoothingTimeConstant = 0.82

## Wiring into pfiiive

1. Place these files into your repo:
   ```
   docs/05-Unknown-Pleasures-FIRST-STAGE.md
   js/three_sketches/unknown_pleasures_3d.js
   shaders/unknown_lines.vert
   shaders/unknown_lines.frag
   ```

2. In your `three_producer.js`, load the sketch, pass `THREE` & `renderer`, then call the returned `frame()` in your tick:
   ```js
   import { createUnknownPleasuresScene } from "./three_sketches/unknown_pleasures_3d.js";

   const frame = createUnknownPleasuresScene(THREE, renderer, { audioUrl: "assets/track.mp3" });
   function tick(t){
     frame(t);
     renderer.render(scene, camera);
     requestAnimationFrame(tick);
   }
   ```

3. Keep your CRT skin unchanged — it will sample the producer canvas.

## Notes

- We render each line as a `THREE.Line` (positions updated in the **vertex shader**), not CPU-side geometry mutation.  
- If your platform forces 1px lines to be too thin, you can switch to strips built from triangle pairs and a custom line-width shader. The CRT post helps readability, so the simple `Line` usually looks great.
