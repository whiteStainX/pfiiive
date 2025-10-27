// WebGL2 glue: renders CRT shader sampling the p5 graphics canvas.
// Now loads shaders from external files.

import { createP5Producer } from "./producers/p5_producer.js";
import { createThreeProducer } from "./producers/three_producer.js";

async function main() {
  const defaultProducer = "three"; // 'p5' or 'three'

  const skin = document.getElementById("skin-stage");
  const gl = skin.getContext("webgl2", { alpha: false, antialias: false });

  if (!gl) {
    alert("WebGL2 not available in this browser.");
    throw new Error("WebGL2 not available");
  }

  // --- Producer Setup ---
  let producer =
    defaultProducer === "three" ? createThreeProducer() : createP5Producer();
  producer.start();

  function setProducer(kind) {
    producer.stop();
    producer = kind === "three" ? createThreeProducer() : createP5Producer();
    producer.start();
    resize(); // Ensure sizes are synced
  }

  window.PFIIIVE = {
    useP5: () => setProducer("p5"),
    useThree: () => setProducer("three"),
  };

  // --- Helpers ---
  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh);
      console.error(info, "\nSource:\n", src);
      throw new Error("Shader compile failed");
    }
    return sh;
  }

  function programFromSources(gl, vsSrc, fsSrc) {
    const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(prog);
      console.error(info);
      throw new Error("Program link failed");
    }
    return prog;
  }

  function makeFullscreenVAO(gl) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindVertexArray(null);
    return vao;
  }

  function createRenderTexture(gl, w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    return tex;
  }

  function createFramebuffer(gl, tex) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fb;
  }

  function loadTexture(gl, url) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    ); // 1x1 black pixel

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          img
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        resolve(tex);
      };
      img.src = url;
    });
  }

  // --- Fetch and build pipeline ---
  const [
    vsSrc,
    fsSrc,
    bloomExtractSrc,
    bloomBlurSrc,
    bloomCompositeSrc,
    noiseTex,
    params,
  ] = await Promise.all([
    fetch("shaders/crt.vert").then((res) => res.text()),
    fetch("shaders/crt.frag").then((res) => res.text()),
    fetch("shaders/bloom_extract.frag").then((res) => res.text()),
    fetch("shaders/bloom_blur.frag").then((res) => res.text()),
    fetch("shaders/bloom_composite.frag").then((res) => res.text()),
    loadTexture(gl, "assets/images/allNoise512.png"),
    fetch("config.json").then((res) => res.json()),
  ]);

  const crtProgram = programFromSources(gl, vsSrc, fsSrc);
  const bloomExtractProgram = programFromSources(gl, vsSrc, bloomExtractSrc);
  const bloomBlurProgram = programFromSources(gl, vsSrc, bloomBlurSrc);
  const bloomCompositeProgram = programFromSources(
    gl,
    vsSrc,
    bloomCompositeSrc
  );
  const vao = makeFullscreenVAO(gl);
  gl.useProgram(crtProgram);

  // Uniform locations
  const crtUniforms = {
    uTex: gl.getUniformLocation(crtProgram, "uTex"),
    uPrevTex: gl.getUniformLocation(crtProgram, "uPrevTex"),
    uNoiseTex: gl.getUniformLocation(crtProgram, "uNoiseTex"),
    uResolution: gl.getUniformLocation(crtProgram, "uResolution"),
    uTime: gl.getUniformLocation(crtProgram, "uTime"),
    uDPR: gl.getUniformLocation(crtProgram, "uDPR"),
    uVirtRes: gl.getUniformLocation(crtProgram, "uVirtRes"),
    uNoiseScale: gl.getUniformLocation(crtProgram, "uNoiseScale"),
    uCurvature: gl.getUniformLocation(crtProgram, "uCurvature"),
    uRasterStrength: gl.getUniformLocation(crtProgram, "uRasterStrength"),
    uChroma: gl.getUniformLocation(crtProgram, "uChroma"),
    uTint: gl.getUniformLocation(crtProgram, "uTint"),
    uBrightness: gl.getUniformLocation(crtProgram, "uBrightness"),
    uAmbient: gl.getUniformLocation(crtProgram, "uAmbient"),
    uFlicker: gl.getUniformLocation(crtProgram, "uFlicker"),
    uPersistence: gl.getUniformLocation(crtProgram, "uPersistence"),
    uRasterMode: gl.getUniformLocation(crtProgram, "uRasterMode"),
    uHorizontalSync: gl.getUniformLocation(crtProgram, "uHorizontalSync"),
    uGlowingLine: gl.getUniformLocation(crtProgram, "uGlowingLine"),
    uStaticNoise: gl.getUniformLocation(crtProgram, "uStaticNoise"),
    uJitter: gl.getUniformLocation(crtProgram, "uJitter"),
    uRgbShift: gl.getUniformLocation(crtProgram, "uRgbShift"),
    uDeltaTime: gl.getUniformLocation(crtProgram, "uDeltaTime"),
  };

  const bloomUniforms = {
    extract: {
      uScene: gl.getUniformLocation(bloomExtractProgram, "uScene"),
      uThreshold: gl.getUniformLocation(bloomExtractProgram, "uThreshold"),
      uSoftKnee: gl.getUniformLocation(bloomExtractProgram, "uSoftKnee"),
    },
    blur: {
      uInput: gl.getUniformLocation(bloomBlurProgram, "uInput"),
      uTexelSize: gl.getUniformLocation(bloomBlurProgram, "uTexelSize"),
      uDirection: gl.getUniformLocation(bloomBlurProgram, "uDirection"),
      uRadius: gl.getUniformLocation(bloomBlurProgram, "uRadius"),
    },
    composite: {
      uScene: gl.getUniformLocation(bloomCompositeProgram, "uScene"),
      uBloom: gl.getUniformLocation(bloomCompositeProgram, "uBloom"),
      uBloomIntensity: gl.getUniformLocation(
        bloomCompositeProgram,
        "uBloomIntensity"
      ),
      uBloomAlphaScale: gl.getUniformLocation(
        bloomCompositeProgram,
        "uBloomAlphaScale"
      ),
    },
  };

  // State
  let DPR = 1;
  let isResizing = false;
  function resize() {
    isResizing = true;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.floor(window.innerWidth);
    const cssH = Math.floor(window.innerHeight);
    skin.style.width = cssW + "px";
    skin.style.height = cssH + "px";
    skin.width = Math.floor(cssW * DPR);
    skin.height = Math.floor(cssH * DPR);
    gl.viewport(0, 0, skin.width, skin.height);

    producer.resize(cssW, cssH, DPR);

    // Recreate ping-pong buffers for main CRT effect

    if (ping.texA) {
      gl.deleteTexture(ping.texA);
      gl.deleteTexture(ping.texB);
      gl.deleteFramebuffer(ping.fbA);
      gl.deleteFramebuffer(ping.fbB);
    }
    ping.texA = createRenderTexture(gl, skin.width, skin.height);
    ping.texB = createRenderTexture(gl, skin.width, skin.height);
    ping.fbA = createFramebuffer(gl, ping.texA);
    ping.fbB = createFramebuffer(gl, ping.texB);

    if (bloom.texA) {
      gl.deleteTexture(bloom.texA);
      gl.deleteTexture(bloom.texB);
      gl.deleteFramebuffer(bloom.fbA);
      gl.deleteFramebuffer(bloom.fbB);
    }
    const bloomScale = Math.max(
      0.05,
      Math.min(1.0, params.bloomResolutionScale || 0.5)
    );
    bloom.width = Math.max(1, Math.floor(skin.width * bloomScale));
    bloom.height = Math.max(1, Math.floor(skin.height * bloomScale));
    bloom.texA = createRenderTexture(gl, bloom.width, bloom.height);
    bloom.texB = createRenderTexture(gl, bloom.width, bloom.height);
    bloom.fbA = createFramebuffer(gl, bloom.texA);
    bloom.fbB = createFramebuffer(gl, bloom.texB);
    isResizing = false;
  }
  window.addEventListener("resize", resize);

  const ping = { texA: null, texB: null, fbA: null, fbB: null, flip: false };
  const bloom = {
    texA: null,
    texB: null,
    fbA: null,
    fbB: null,
    width: 0,
    height: 0,
  };

  const srcTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  resize();

  const start = performance.now();
  let lastTime = start;

  function frame(now) {
    if (isResizing) {
      requestAnimationFrame(frame);
      return;
    }

    const deltaTime = (now - lastTime) * 0.001; // seconds
    lastTime = now;

    const p5Canvas = producer.getCanvas();

    if (p5Canvas) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        p5Canvas
      );
    }

    const prevTex = ping.flip ? ping.texB : ping.texA;
    const currTex = ping.flip ? ping.texA : ping.texB;
    const currFB = ping.flip ? ping.fbA : ping.fbB;
    ping.flip = !ping.flip;

    gl.bindFramebuffer(gl.FRAMEBUFFER, currFB);
    gl.viewport(0, 0, skin.width, skin.height);
    gl.useProgram(crtProgram);
    gl.bindVertexArray(vao);

    gl.uniform1i(crtUniforms.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(crtUniforms.uPrevTex, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(crtUniforms.uNoiseTex, 2);

    gl.uniform2f(crtUniforms.uResolution, skin.width, skin.height);
    gl.uniform1f(crtUniforms.uTime, (now - start) * 0.001);
    gl.uniform1f(crtUniforms.uDeltaTime, deltaTime);
    gl.uniform1f(crtUniforms.uDPR, DPR);

    // Match noise texture tiling from original
    const noiseW = 512;
    const noiseH = 512;
    gl.uniform2f(
      crtUniforms.uNoiseScale,
      (skin.width * 0.75) / noiseW,
      (skin.height * 0.75) / noiseH
    );

    gl.uniform2f(crtUniforms.uVirtRes, skin.width / DPR, skin.height / DPR);

    gl.uniform1f(crtUniforms.uCurvature, params.curvature);
    gl.uniform1f(crtUniforms.uRasterStrength, params.rasterStrength);
    gl.uniform1f(crtUniforms.uChroma, params.chroma);
    gl.uniform3f(
      crtUniforms.uTint,
      params.tint[0],
      params.tint[1],
      params.tint[2]
    );
    gl.uniform1f(crtUniforms.uBrightness, params.brightness);
    gl.uniform1f(crtUniforms.uAmbient, params.ambient);
    gl.uniform1f(crtUniforms.uFlicker, params.flicker);
    gl.uniform1f(crtUniforms.uPersistence, params.persistence);
    gl.uniform1i(crtUniforms.uRasterMode, params.rasterMode);
    gl.uniform1f(crtUniforms.uHorizontalSync, params.horizontalSync);
    gl.uniform1f(crtUniforms.uGlowingLine, params.glowingLine);
    gl.uniform1f(crtUniforms.uStaticNoise, params.staticNoise);
    gl.uniform1f(crtUniforms.uJitter, params.jitter);
    gl.uniform1f(crtUniforms.uRgbShift, params.rgbShift);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(crtUniforms.uTex, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    let bloomTexture = bloom.texA;
    const bloomEnabled =
      params.bloomIntensity > 0.0 && bloom.width > 0 && bloom.height > 0;

    if (bloomEnabled) {
      gl.viewport(0, 0, bloom.width, bloom.height);
      gl.useProgram(bloomExtractProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloom.fbA);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currTex);
      gl.uniform1i(bloomUniforms.extract.uScene, 0);
      gl.uniform1f(bloomUniforms.extract.uThreshold, params.bloomThreshold);
      gl.uniform1f(bloomUniforms.extract.uSoftKnee, params.bloomSoftKnee);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.useProgram(bloomBlurProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, bloom.fbB);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bloom.texA);
      gl.uniform1i(bloomUniforms.blur.uInput, 0);
      gl.uniform2f(
        bloomUniforms.blur.uTexelSize,
        1.0 / bloom.width,
        1.0 / bloom.height
      );
      gl.uniform2f(bloomUniforms.blur.uDirection, 1.0, 0.0);
      gl.uniform1f(bloomUniforms.blur.uRadius, params.bloomRadius);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.bindFramebuffer(gl.FRAMEBUFFER, bloom.fbA);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, bloom.texB);
      gl.uniform1i(bloomUniforms.blur.uInput, 0);
      gl.uniform2f(
        bloomUniforms.blur.uTexelSize,
        1.0 / bloom.width,
        1.0 / bloom.height
      );
      gl.uniform2f(bloomUniforms.blur.uDirection, 0.0, 1.0);
      gl.uniform1f(bloomUniforms.blur.uRadius, params.bloomRadius);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      bloomTexture = bloom.texA;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, skin.width, skin.height);
    gl.useProgram(bloomCompositeProgram);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currTex);
    gl.uniform1i(bloomUniforms.composite.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bloomTexture || currTex);
    gl.uniform1i(bloomUniforms.composite.uBloom, 1);
    gl.uniform1f(
      bloomUniforms.composite.uBloomIntensity,
      params.bloomIntensity
    );
    gl.uniform1f(
      bloomUniforms.composite.uBloomAlphaScale,
      params.bloomAlphaScale || 1.0
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.CRTParams = {
    setRgbShift: (s) => (params.rgbShift = s),
    setRasterMode: (m) => (params.rasterMode = m | 0),
    setTint: (r, g, b) => {
      params.tint = [r, g, b];
    },
    amber: () => {
      params.tint = [1.0, 0.73, 0.2];
      params.chroma = 0.35;
    },
    green: () => {
      params.tint = [0.65, 1.0, 0.65];
      params.chroma = 0.35;
    },
    rgb: () => {
      params.tint = [1.0, 1.0, 1.0];
      params.chroma = 1.0;
    },
    setBloomIntensity: (v) => {
      params.bloomIntensity = Math.max(0, v);
    },
    setBloomThreshold: (v) => {
      params.bloomThreshold = v;
    },
    setBloomRadius: (v) => {
      params.bloomRadius = v;
    },
    setBloomSoftKnee: (v) => {
      params.bloomSoftKnee = v;
    },
    setBloomResolutionScale: (v) => {
      params.bloomResolutionScale = Math.max(0.05, Math.min(1.0, v));
      resize();
    },
  };

  window.getDisplayAspectRatio = () => window.innerWidth / window.innerHeight;
}

main().catch((err) => console.error(err));
