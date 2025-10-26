# PFiiive - A WebGL CRT Skin

PFiiive is a high-fidelity, reusable CRT (Cathode Ray Tube) screen effect, rendered in real-time using WebGL. It is designed to be a flexible "skin" that can be layered on top of any web-based visual content, such as a p5.js sketch, an HTML `<canvas>`, an image, or a video.

The project's primary goal is to faithfully recreate the look and feel of the `cool-retro-term` terminal emulator in a browser environment, focusing on performance, accuracy, and ease of use.

---

## Design Philosophy

The architecture of PFiiive is guided by a core principle: **decoupling the visual content (the "Logic Layer") from the visual effect (the "Skin Layer").**

-   **The Logic Layer**: This is the source of the image to be displayed. It can be any texture producer, such as a p5.js sketch drawing to an offscreen buffer. This layer knows nothing about the CRT effect; it simply draws its content to a fixed-size canvas.

-   **The Skin Layer**: This is a sophisticated, multi-pass WebGL pipeline that takes the output of the Logic Layer as a texture. It then applies a series of configurable, high-fidelity post-processing effects to emulate the distinct characteristics of a vintage CRT monitor.

This decoupled approach provides significant benefits:
1.  **Modularity**: Any p5.js sketch or other visual source can be swapped in as the content without altering the CRT effect logic.
2.  **Performance**: The Logic Layer can render to a small, fixed-size buffer (e.g., 640x400), while the Skin Layer handles the expensive upscaling and effects at the final display resolution. This ensures a high frame rate.
3.  **Responsiveness**: The Skin Layer is responsible for adapting to the browser window's size and aspect ratio. The Logic Layer can optionally query the display aspect ratio to make its internal composition responsive, without ever needing to know the true pixel dimensions of the screen.

## Features & Effects

PFiiive implements a wide range of authentic CRT effects, each with tunable parameters:

-   **Screen Curvature**: Simulates the gentle bulge of a glass tube.
-   **Scanlines & Rasterization**: Includes multiple modes for scanlines, subpixel triads, and chunky pixel cells.
-   **Phosphor Persistence (Burn-In)**: A time-based afterglow effect where bright pixels fade slowly.
-   **Bloom**: A multi-pass bloom that creates soft, glowing halos around bright areas.
-   **Analog Instability**: A combination of `Jitter`, `Horizontal Sync`, and `RGB Shift` to simulate the subtle wobble and color bleeding of an analog signal.
-   **Noise & Flicker**: Texture-based noise and micro-flicker for added realism.

## Usage

The project is designed to be run with a simple local server.

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
    *   Open your web browser and navigate to `http://localhost:8000`.

### Configuration

All visual effects are controlled by parameters in the `config.json` file in the project root. You can live-edit these values and refresh the browser to see the changes.

To change the visual content, simply edit the `index.html` file to point to a different p5.js sketch within the `js/p5_sketches/` directory.