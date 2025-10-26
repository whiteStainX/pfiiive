# Project Progress: Web CRT Skin

> Goal: Recreate cool-retro-term’s display look as a reusable skin layer in the browser, with high fidelity to the original's effects and parameterization.

---

## Implemented Effects & Features

This section details the features that have been successfully implemented and verified in our prototype.

### Core Architecture
- [x] **Decoupled Structure**: Project is organized into separate HTML, CSS, JS, and GLSL shader files.
- [x] **Local Server Environment**: A robust `backend` server with a Python virtual environment is set up.
- [x] **Asynchronous Loading**: Shaders and assets are loaded asynchronously.

### Visual Effects Fidelity
- [x] **Curvature**: Implemented barrel distortion for the screen curvature effect.
- [x] **Rasterization Modes**: Implemented Scanlines, Subpixel, and Pixel-cell modes.
- [x] **DPR-Aware Rendering**: Scanlines and effects are correctly scaled based on Device Pixel Ratio.
- [x] **Texture-Based Noise**: Replaced procedural hash with a tiled noise texture (`allNoise512.png`) for more organic noise.
- [x] **Static Noise**: Implemented the grainy, static noise overlay.
- [x] **Flickering**: Implemented screen brightness flickering driven by the noise texture.
- [x] **Horizontal Sync**: Implemented the horizontal line distortion/wobble effect.
- [x] **Jitter**: Implemented subtle, random displacement of the image for an analog feel.
- [x] **Glowing Line**: Implemented the rolling bright line effect.
- [x] **Authentic Persistence**: Re-implemented the persistence/burn-in effect to use a `max()` blend with subtractive, time-based decay, closely matching the original's behavior.
- [x] **RGB Shift**: Implemented chromatic aberration effect that separates the R, G, and B channels.
- [x] **Parameterization**: Default values and effect ranges have been calibrated to match the original "Default Amber" profile from `cool-retro-term`.

---

## Next Steps

While the core look is nearly complete, the following tasks remain to finish the project.

1.  **Implement Bloom Effect**
    *   The current `ambientLight` is a simple vignette. A true bloom effect requires a more complex implementation:
        1.  **Extract Brightness**: Create a separate render pass that extracts the brightest parts of the source image into a new texture.
        2.  **Downsample & Blur**: Downsample the brightness texture and apply a multi-pass Gaussian blur to create a soft, glowing halo.
        3.  **Additive Blend**: Add the blurred texture back onto the final rendered image.
    *   This is the last major visual effect remaining for full fidelity.

2.  **Build a User Interface**
    *   Create a simple UI panel (e.g., using `dat.GUI` or a simple HTML form) to control all the exposed shader parameters in `js/skin.js`.
    *   This will allow for real-time tweaking of the effects without using the developer console.

3.  **Add Support for More Input Sources**
    *   Modify the `skin.js` and `index.html` to allow the CRT skin to be applied to other sources, such as a `<video>` element or a user-uploaded image, in addition to the p5.js canvas.

4.  **Code Cleanup & Optimization**
    *   Review the code for any potential optimizations.
    *   Consider moving the vertex shader calculations for `flicker` and `horizontalSync` (as seen in the original) if performance becomes a concern.
