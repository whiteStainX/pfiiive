# PLAN.md — Implementation & Study Plan for CRT Skin (Web) matching cool-retro-term

> Goal: implement a browser-based CRT skin whose **look and behavior** closely match _cool-retro-term_, while learning the structure of the original repo and staying license-safe.

---

## 0) Reference: Original Repo Structure (subset) refer to the files in ./example/ref_files_original_repo

_(Provided tree for orientation; focus files marked ★)_

```
.
├── app
│   ├── main.cpp
│   └── qml
│       ├── ShaderLibrary.qml        ★ rasterization functions & helpers
│       ├── ShaderTerminal.qml       ★ final post-processing chain (CRT look)
│       ├── BurnInEffect.qml         ☆ persistence/feedback behavior
│       ├── PreprocessedTerminal.qml ☆ input feeding into shader pipeline
│       ├── TimeManager.qml          ☆ time/flicker management
│       ├── SettingsEffectsTab.qml   ☆ parameter names/ranges/defaults
│       ├── ApplicationSettings.qml  ☆ preset wiring
│       ├── images/
│       │   ├── allNoise512.png      ☆ noise texture
│       │   └── crt256.png           ☆ frame/overlay texture (optional)
│       └── ...
├── qmltermwidget                    (terminal widget; not needed for the web skin)
└── ...
```

**Legend**: ★ must study & port concepts; ☆ helpful to match exact behavior.

---

## 1) Phased Implementation

### Phase 1 — Minimal skin MVP (done in exmaple folder)

**Objectives**

- Two-layer render: p5 → WebGL skin.
- Implement curvature, scanlines, tint/chroma, vignette, grain, flicker.
- DPR-aware scanlines anchored to physical pixels.

**Tasks**

1. Create `index.html` with embedded shaders and full-screen canvas.
2. Implement p5 offscreen producer (`p5.Graphics`, `pixelDensity(1)`), expose `getP5Canvas()`.
3. WebGL2 setup (`js/skin.js`): compile shaders, FSQ VAO, uniforms.
4. **Uniforms**: `uTex`, `uResolution`, `uTime`, `uDPR`, `uVirtRes`, `uCurvature`, `uRasterStrength`, `uChroma`, `uTint`, `uBrightness`, `uAmbient`, `uFlicker`, `uRasterMode`.
5. Rasterization mode **scanlines** only; compute in **screen space** using `(vUV * uResolution)/uDPR` and `uVirtRes`.
6. Add `CRTParams.rgb()/amber()/green()` console presets.

**Acceptance Criteria**

- Crisp scanlines at any window size/DPR.
- Subtle curvature & vignette; tiny flicker; stable 60 FPS on Apple Silicon.

---

### Phase 2 — Persistence (phosphor) + Subpixel & Pixel-cell modes

**Objectives**

- Implement ping‑pong FBO feedback (persistence).
- Add rasterization modes: subpixel triads & pixel-cell.

**Tasks**

1. Add ping‑pong textures `prev/curr` sized to `uResolution` (clamp DPR to ≤2 if needed).
2. Fragment: sample `uPrevTex` and blend: `col = mix(col, max(col, prev), uPersistence)`.
3. Implement **subpixel** and **pixel-cell** variants (ported from `ShaderLibrary.qml` semantics).
4. Expose `uPersistence` and `uRasterMode` switches; add presets.

**Acceptance Criteria**

- Subtle motion trails that decay; no runaway ghosting.
- Switching modes produces expected visual differences.

---

### Phase 3 — Exact Parameterization & Fidelity Pass

**Objectives**

- Match **behavior and range** of cool-retro-term’s exposed controls.

**Tasks**

1. Read `SettingsEffectsTab.qml` & `ApplicationSettings.qml`; note the parameter names, min/max, defaults.
2. Adjust our shader uniform ranges to **mirror QML UI semantics** (even if values are scaled differently internally).
3. Inspect `BurnInEffect.qml` for their exact **decay curve** and **blur/bloom** if present. Implement an **optional half‑res blur** of `uPrevTex` blended _before_ `max()`.
4. Implement **horizontalSyncStrength** (sine-based x distortion as a function of y + time) and **jitter** if desired.

**Acceptance Criteria**

- Side‑by‑side “feel” is nearly indistinguishable on representative scenes.
- Sliders map intuitively to the same visual result as CRT for equivalent settings.

---

### Phase 4 — UX/Dev Polish

**Objectives**

- Add an on‑page control panel; preset manager; code cleanup.

**Tasks**

1. Build a small UI (e.g., `?panel=1`) with sliders for curvature, chroma/tint, raster strength, raster mode, persistence, ambient, brightness, flicker.
2. Add preset save/load (localStorage JSON of uniform set).
3. Implement input sources: image upload & `<video>` support; toggle p5/demo.
4. Optimize texture uploads (`texSubImage2D`), cap DPR in skin path to 2 if perf drops.

**Acceptance Criteria**

- Usable interactive demo page; profiles persist between reloads.
- Clean 60 FPS with persistence on under typical laptop loads.

---

## 2) Study Checklist (to achieve the exact look)

1. **ShaderLibrary.qml**

   - Confirm formulas for: scanlines, subpixel, pixel-cell; constants for bright/dark blends.
   - Note any intensity clamping/damping (e.g., avoid over-brightening).

2. **ShaderTerminal.qml**

   - Confirm pass order and curvature formula.
   - Observe where ambient/glow and flicker are applied (before/after rasterization).

3. **BurnInEffect.qml**

   - Capture the exact `mix()` factors, any decays as a function of time delta.
   - Check if blur is applied to previous frame (and at what scale).

4. **SettingsEffectsTab.qml**

   - Record uniform names & ranges (min/max/default); match these in UI.

5. **TimeManager.qml**

   - Determine animation cadence: is `time` in seconds? any base frequencies (50/60 Hz analog).

6. **images/**
   - If CRT uses external textures (noise/aperture), replicate **procedurally** or author your own to avoid GPL copying.

---

## 3) File Map (Web Project)

```
crt-skin-p5/
├─ index.html            # Shaders embedded for simplicity (no CORS)
├─ index_inline.html     # Single-file, file:// friendly demo
├─ css/
│  └─ style.css
├─ js/
│  ├─ skin.js            # WebGL pipeline (FSQ, ping-pong, uniforms, render loop)
│  └─ logic/
│     └─ sketch.js       # p5 offscreen producer (can be swapped with image/video)
```

---

## 4) Dev & Run Instructions

### Local server (recommended)

```bash
cd crt-skin-p5
python3 -m http.server 8000
# open http://localhost:8000
```

### Single-file demo (no server)

- Open `index_inline.html` directly (double-click).

---

## 5) Validation Steps (side-by-side with cool-retro-term)

1. Prepare a few **static** test images (color bars, high-contrast text, photos).
2. Record the **same parameters** in CRT (curvature, chroma/tint, raster strength, persistence if exposed).
3. In the web skin, set equivalent parameters; compare visually:

   - **Scanline alignment** at various window sizes & DPR.
   - **Curvature** magnitude vs edge crop.
   - **Subpixel triads**: verify colored fringing at steep diagonals.
   - **Persistence**: trail length on moving content (use p5 anim).

4. Adjust constant multipliers until match is convincing.

---

## 6) Risks & Mitigations

- **Legal**: copying GPL shaders/assets → **Re-implement**, don’t copy strings; create your own textures.
- **Performance**: large canvases with full-res feedback → **Downscale** persistence buffer (½ or ¼ res).
- **DPR inconsistencies**: scanline “swim” on resize → recompute `uResolution`, `uVirtRes`, and **avoid fractional DPR** when possible (cap to 2).

---

## 7) Milestones

- M1: Phase 1 MVP (scanlines + curvature + tint; DPR-correct) — _done prototype_.
- M2: Persistence + subpixel/pixel-cell; presets.
- M3: Fidelity pass (match CRT parameterization, optional blur/bloom for burn-in).
- M4: UI, inputs (image/video), packaging (deployable demo).

---

## 8) Deliverables

- `DESIGN.md` (this file’s counterpart) describing architecture & shader design.
- `PLAN.md` (this file) with phases, study targets, acceptance criteria.
- Working demo (`index.html`/`index_inline.html`) runnable locally.
- Optional: a minimal NPM project with a tiny dev server and UI panel.
