# PLAN.md — Implementation Plan for CRT Skin

> Goal: Implement a browser-based CRT skin whose look and behavior closely match cool-retro-term, starting with a solid, well-structured foundation.

---

## 1) Phase 1: Project Setup & Core CRT Effects

This phase focuses on building a robust project structure and implementing the core visual effects of the CRT skin.

### Objectives

- Establish a clean, decoupled file structure for HTML, CSS, JavaScript, and shaders.
- Create a reliable, script-based local server environment.
- Implement the primary CRT effects: curvature, scanlines, tint/chroma, and ambient glow.
- Ensure rendering is DPR-aware to keep scanlines sharp on all displays.

### Tasks

1.  **HTML & CSS Structure**

    - Create a main `index.html` with a single `<canvas>` element for the WebGL output.
    - Create a `css/style.css` to make the canvas a full-screen element.

2.  **Decoupled Shaders**

    - Create a `shaders/` directory.
    - Implement the vertex shader in `shaders/crt.vert`.
    - Implement the fragment shader with all core CRT effects in `shaders/crt.frag`.

3.  **JavaScript Logic**

    - Create a `js/` directory.
    - Implement the main WebGL logic in `js/skin.js`. This script will be responsible for:
      - Asynchronously loading the `.vert` and `.frag` shaders.
      - Compiling the WebGL program.
      - Managing uniforms, framebuffers, and the main render loop (`requestAnimationFrame`).
    - Create a `js/p5_sketches/` directory to hold different visual demos.
    - Implement the default p5.js drawing logic in `js/p5_sketches/default_sketch.js`, ensuring it draws to an offscreen buffer.

4.  **Backend Server Environment**

    - Create a `backend/` directory.
    - Initialize a Python virtual environment inside it (`.venv`).
    - Create an executable `backend/run_server.sh` script to activate the venv and start the server.

5.  **Gitignore**
    - Update the root `.gitignore` file to exclude Python virtual environments, cache, and build artifacts.

### Acceptance Criteria

- The project runs successfully by executing the `run_server.sh` script.
- The webpage displays a full-screen p5.js animation with the CRT skin applied.
- Effects like curvature, scanlines, and tint are clearly visible.
- Scanlines remain crisp and pixel-aligned when resizing the browser window on high-DPR (Retina) and standard displays.

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

## 2) File Structure

The target file structure for the main project directory will be:

```
pfiiive/
├─ .gitignore
├─ DESIGN.md
├─ PLAN.md
├─ README.md
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ skin.js
│  └─ p5_sketches/
│     └─ default_sketch.js
├─ shaders/
│  ├─ crt.vert
│  └─ crt.frag
└─ backend/
   ├─ .venv/
   └─ run_server.sh
```

---

## 3) Development & Run Instructions

### One-Time Setup

1.  **Create the virtual environment:**

    ```bash
    # Navigate to the backend directory
    cd backend

    # Create the virtual environment
    python3 -m venv .venv
    ```

### Running the Server

1.  **Start the server:**
    ```bash
    # From the 'backend' directory, run the script
    ./run_server.sh
    ```
2.  **View the application:**
    - Open your web browser and navigate to `http://localhost:8000`.
