# 02: Shader Implementation & QML Translation

This document details the process of translating the visual effects from the original `cool-retro-term` QML and GLSL code into our own WebGL fragment shaders. The goal was to achieve high-fidelity replication of the effects while writing original, license-safe code.

---

## Reference Files

The primary reference files from the original repository were:

-   `ShaderTerminal.qml`: The main post-processing shader that combines all the core CRT effects.
-   `ShaderLibrary.qml`: A helper file containing the functions for different rasterization modes.
-   `BurnInEffect.qml`: The implementation of the phosphor persistence (afterglow) effect.
-   `ApplicationSettings.qml`: The central configuration file defining default values and profiles.
-   `utils.js`: A utility script containing helper functions, most notably the `lint()` function for mapping UI slider values to shader uniform ranges.

---

## Key Learnings & Translation Strategy

Our analysis of the source files revealed several key implementation details that were crucial to replicating the final look.

### 1. Effect Order

By studying `ShaderTerminal.qml`, we determined the precise order in which the effects are applied. Our fragment shader pipeline in `crt.frag` was structured to match this order to ensure correct blending and interaction between effects:

1.  Curvature
2.  Horizontal Sync & Jitter
3.  Static Noise & Glowing Line
4.  Texture Sampling
5.  RGB Shift
6.  Chroma/Tint
7.  Persistence (Burn-In)
8.  Rasterization
9.  Flicker
10. Ambient Glow (Vignette)
11. Final Brightness

### 2. Texture-Based Noise

-   **Original**: The original uses a pre-generated noise texture (`allNoise512.png`) which is tiled and sampled to drive effects like `staticNoise`, `flicker`, and `jitter`.
-   **Our Implementation**: We abandoned our initial procedural `hash()` function in favor of this texture-based approach. We load `allNoise512.png` into a `uNoiseTex` sampler and animate the texture coordinates over time to create a dynamic, organic noise pattern that is much more authentic than a per-pixel hash.

### 3. Authentic Persistence (Burn-In)

-   **Original**: `BurnInEffect.qml` revealed that the persistence effect is not a simple alpha blend. It uses a `max(decayed_previous, current)` blending model.
-   **Our Implementation**: We replicated this logic in `crt.frag`. The key is that new, bright pixels are never dimmed by the fading after-image. We also implemented a time-based subtractive decay, where the `uPersistence` uniform acts as an intuitive "fade time" in seconds, and the `uDeltaTime` uniform ensures the fade rate is independent of the frame rate.

### 4. Parameterization

-   **Original**: The original uses a `lint()` (linear interpolation) function in `utils.js` and various multipliers in `ShaderTerminal.qml` and `ApplicationSettings.qml` to scale the 0.0-1.0 values from UI sliders into their final, effective ranges for the shader.
-   **Our Implementation**: We analyzed these scaling factors to inform the default values in our `config.json` file. For example, we learned that `screenCurvature` is scaled by `0.4` and `ambientLight` is scaled by `0.2`. We documented these effective ranges as comments in our configuration to guide future UI development.

### 5. RGB Shift

-   **Original**: The `rbgShift` effect works by sampling the source texture three times (center, and slightly left/right) and then recomposing the final pixel from a weighted average of the R, G, and B channels of these samples.
-   **Our Implementation**: We implemented this directly in `crt.frag`, using the `uRgbShift` uniform to control the displacement distance. This creates the subtle chromatic aberration characteristic of CRT displays.
