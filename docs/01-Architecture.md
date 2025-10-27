# 01: Project Architecture

The architecture of PFiiive is guided by a core principle: **decoupling the visual content (the "Logic Layer") from the visual effect (the "Skin Layer").** This separation makes the project modular, performant, and easy to maintain.

This is achieved through a three-layer system:

1.  **The Logic Layer**: The source of the image.
2.  **The HTML/JavaScript Layer**: The orchestrator that connects the other two layers.
3.  **The Skin Layer**: The WebGL pipeline that applies the CRT effect.

---

## The Three Layers

Here is a visual representation of the data flow between the layers. The key is the abstraction of the "Logic Layer" into a generic **Producer** that runs a specific **Sketch**.

```ascii
+--------------------+
| Sketch: p5         |----(e.g., unknown_pleasures.js)
+--------------------+

+--------------------+
| Sketch: three.js   |----(e.g., unknown_pleasures_3d.js)
+--------------------+


      (select one sketch to load)
             |
             ▼
+------------------------------------+
| 1. Logic Layer (Producer)          |   (e.g., p5_producer.js)
| - Hosts the p5/three environment   |
| - Loads and runs a specific sketch |
| - Draws to a fixed-size buffer     |
+------------------------------------+
             |
             | getCanvas()
             ▼
+------------------------------------+
| 2. HTML/JS Layer (skin.js)         |
| - Grabs producer's canvas as input |
| - Manages final WebGL canvas       |
| - Orchestrates render passes       |
+------------------------------------+
             |
             ▼
+------------------------------------+
| 3. Skin Layer (WebGL Shaders)      |
| - Applies CRT & Bloom effects      |
| - Renders final image to screen    |
+------------------------------------+
             |
             ▼
      [ Final Display ]
```

### 1. The Logic Layer

-   **Responsibility**: To generate a source image.
-   **Implementation**: In our project, this is a p5.js sketch that draws to a `p5.Graphics` object (an offscreen canvas).
-   **Key Constraint**: This layer should be entirely self-contained. It should not have any knowledge of the DOM, the window size, or the CRT skin itself. It simply draws to its own fixed-resolution buffer. For responsiveness, it can optionally query a global aspect ratio provided by the HTML/JS layer to adjust its composition.

### 2. The HTML/JS Layer

-   **Responsibility**: To manage resources and orchestrate the rendering pipeline.
-   **Implementation**: This is handled by `index.html` and the main `js/skin.js` module.
-   **Key Tasks**:
    -   Creates the final, full-screen `<canvas>` element.
    -   Loads all shader files (`.vert`, `.frag`) and the `config.json`.
    -   Compiles all WebGL programs.
    -   Creates and manages all necessary Framebuffer Objects (FBOs) for the multi-pass rendering.
    -   Runs the main `requestAnimationFrame` loop, which executes the render passes in the correct order.
    -   Provides the p5.js sketch with the display aspect ratio for responsive layouts.

### 3. The Skin Layer

-   **Responsibility**: To apply all the visual effects.
-   **Implementation**: A collection of GLSL fragment shaders in the `shaders/` directory.
-   **Key Characteristics**:
    -   **Multi-Pass Pipeline**: The final image is generated through a sequence of rendering passes. The output of one pass becomes the input for the next. Our pipeline includes:
        1.  **Main CRT Pass**: Applies the core effects like curvature, persistence, noise, etc.
        2.  **Bloom Extract Pass**: Isolates the brightest parts of the image.
        3.  **Bloom Blur Passes**: A series of horizontal and vertical blurs to create the glow.
        4.  **Composite Pass**: Combines the original CRT image with the bloom texture for the final result.
    -   **Configurable**: All effects are controlled by `uniform` variables that are fed in from `skin.js`, based on the `config.json` file.
