# 03: Bloom Effect Implementation

The bloom effect is what creates the soft, glowing halos around bright objects on the screen. It is one of the most important effects for achieving a realistic CRT look, and it is also the most architecturally complex, as it requires multiple rendering passes.

Our implementation is a standard and performant approach to real-time bloom.

---

## The Multi-Pass Pipeline

Unlike other effects that can be done in a single shader pass, bloom requires a sequence of operations. The output of each step is rendered to an offscreen framebuffer and then used as the input for the next step.

Here is a diagram of our bloom pipeline:

```ascii
[ Main CRT Scene ]
        |
        |  (Rendered to Framebuffer A)
        ▼
+--------------------+
| 1. Threshold Pass  |   (bloom_extract.frag)
+--------------------+
        |
        |  Extracts only the pixels brighter than a threshold.
        |  Result is a texture with just the bright spots.
        ▼
+--------------------+
| 2. Downsample      |   (Render to smaller texture)
+--------------------+
        |
        |  The bright-spot texture is rendered to a much smaller
        |  buffer (e.g., 1/2 or 1/4 resolution). Blurring a smaller
        |  image is much faster and produces a softer result.
        ▼
+--------------------+
| 3. Blur Passes     |   (bloom_blur.frag)
+--------------------+
        |
        |  A separable Gaussian blur is performed.
        |  a) The downsampled texture is blurred horizontally.
        |  b) The result of (a) is then blurred vertically.
        |  This two-pass approach is much more efficient than a 2D blur.
        ▼
+--------------------+
| 4. Composite Pass  |   (bloom_composite.frag)
+--------------------+
        |
        |  The final blurred bloom texture is blended on top of the
        |  original, full-resolution CRT scene using an
        |  additive blend.
        ▼
[ Final Image on Screen ]
```

## Implementation Details

### Shaders

-   `shaders/bloom_extract.frag`: Takes the main scene texture and a `uThreshold` uniform. It outputs the pixel color if its brightness is above the threshold, otherwise it outputs black.
-   `shaders/bloom_blur.frag`: A standard 9-tap Gaussian blur shader. It takes a `uDirection` vector (`(1,0)` for horizontal, `(0,1)` for vertical) to perform a separable blur.
-   `shaders/bloom_composite.frag`: Takes the original scene texture and the final blurred bloom texture. It adds them together, controlled by a `uBloomIntensity` uniform.

### Framebuffers

To manage these passes, `js/skin.js` creates and manages several offscreen framebuffers:

-   **`ping` / `pong`**: Two full-resolution framebuffers for the main CRT effect and its persistence/feedback loop.
-   **`bloom`**: A set of smaller, down-scaled framebuffers that are used for the threshold and blur passes.

### The `frame()` Loop

The main render loop in `js/skin.js` was significantly refactored to orchestrate this pipeline, carefully binding the correct input textures and output framebuffers for each pass in the correct sequence.
