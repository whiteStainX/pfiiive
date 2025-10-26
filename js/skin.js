// WebGL2 glue: renders CRT shader sampling the p5 graphics canvas.
// Now loads shaders from external files.

async function main() {
  const skin = document.getElementById('skin-stage');
  const gl = skin.getContext('webgl2', { alpha: false, antialias: false });

  if (!gl) {
    alert('WebGL2 not available in this browser.');
    throw new Error('WebGL2 not available');
  }

  // --- Helpers ---
  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh);
      console.error(info, '\nSource:\n', src);
      throw new Error('Shader compile failed');
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
      throw new Error('Program link failed');
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return tex;
  }

  function createFramebuffer(gl, tex) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return fb;
  }

  function loadTexture(gl, url) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255])); // 1x1 black pixel

    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
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
  const [vsSrc, fsSrc, noiseTex, params] = await Promise.all([
    fetch('shaders/crt.vert').then(res => res.text()),
    fetch('shaders/crt.frag').then(res => res.text()),
    loadTexture(gl, 'assets/images/allNoise512.png'),
    fetch('config.json').then(res => res.json()),
  ]);

  const program = programFromSources(gl, vsSrc, fsSrc);
  const vao = makeFullscreenVAO(gl);
  gl.useProgram(program);

  // Uniform locations
  const u = {
    uTex: gl.getUniformLocation(program, 'uTex'),
    uPrevTex: gl.getUniformLocation(program, 'uPrevTex'),
    uNoiseTex: gl.getUniformLocation(program, 'uNoiseTex'),
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uTime: gl.getUniformLocation(program, 'uTime'),
    uDPR: gl.getUniformLocation(program, 'uDPR'),
    uVirtRes: gl.getUniformLocation(program, 'uVirtRes'),
    uNoiseScale: gl.getUniformLocation(program, 'uNoiseScale'),
    uCurvature: gl.getUniformLocation(program, 'uCurvature'),
    uRasterStrength: gl.getUniformLocation(program, 'uRasterStrength'),
    uChroma: gl.getUniformLocation(program, 'uChroma'),
    uTint: gl.getUniformLocation(program, 'uTint'),
    uBrightness: gl.getUniformLocation(program, 'uBrightness'),
    uAmbient: gl.getUniformLocation(program, 'uAmbient'),
    uFlicker: gl.getUniformLocation(program, 'uFlicker'),
    uPersistence: gl.getUniformLocation(program, 'uPersistence'),
    uRasterMode: gl.getUniformLocation(program, 'uRasterMode'),
    uHorizontalSync: gl.getUniformLocation(program, 'uHorizontalSync'),
    uGlowingLine: gl.getUniformLocation(program, 'uGlowingLine'),
        uStaticNoise:   gl.getUniformLocation(program, 'uStaticNoise'),
        uJitter:        gl.getUniformLocation(program, 'uJitter'),
    uRgbShift:      gl.getUniformLocation(program, 'uRgbShift'),
    uDeltaTime:     gl.getUniformLocation(program, 'uDeltaTime'),
  };

  // State
  let DPR = 1;
  let isResizing = false;
  function resize() {
    isResizing = true;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.floor(window.innerWidth);
    const cssH = Math.floor(window.innerHeight);
    skin.style.width = cssW + 'px';
    skin.style.height = cssH + 'px';
    skin.width = Math.floor(cssW * DPR);
    skin.height = Math.floor(cssH * DPR);
    gl.viewport(0, 0, skin.width, skin.height);

    if (ping.texA) {
      gl.deleteTexture(ping.texA);
      gl.deleteTexture(ping.texB);
      gl.deleteFramebuffer(ping.fbA);
      gl.deleteFramebuffer(ping.fbB);
    }
    ping.texA = createRenderTexture(gl, skin.width, skin.height);
    ping.texB = createRenderTexture(gl, skin.width, skin.height);
    ping.fbA = createFramebuffer(gl, ping.texA);
    ping.fbB = createFramebuffer(gl, ping.fbB);
    isResizing = false;
  }
  window.addEventListener('resize', resize);

  const ping = { texA: null, texB: null, fbA: null, fbB: null, flip: false };

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

    

        const p5Canvas = window.getP5Canvas && window.getP5Canvas();
    const p5Size = window.getP5Size ? window.getP5Size() : { w: 640, h: 400 };

    if (p5Canvas) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srcTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p5Canvas);
    }

    const prevTex = ping.flip ? ping.texB : ping.texA;
    const currFB = ping.flip ? ping.fbA : ping.fbB;
    ping.flip = !ping.flip;

    gl.bindFramebuffer(gl.FRAMEBUFFER, currFB);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform1i(u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, prevTex);
    gl.uniform1i(u.uPrevTex, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(u.uNoiseTex, 2);

    gl.uniform2f(u.uResolution, skin.width, skin.height);
    gl.uniform1f(u.uTime, (now - start) * 0.001);
    gl.uniform1f(u.uDeltaTime, deltaTime);
    gl.uniform1f(u.uDPR, DPR);

    // Match noise texture tiling from original
    const noiseW = 512;
    const noiseH = 512;
    gl.uniform2f(u.uNoiseScale, skin.width * 0.75 / noiseW, skin.height * 0.75 / noiseH);

    gl.uniform2f(u.uVirtRes, skin.width / DPR, skin.height / DPR);

    gl.uniform1f(u.uCurvature, params.curvature);
    gl.uniform1f(u.uRasterStrength, params.rasterStrength);
    gl.uniform1f(u.uChroma, params.chroma);
    gl.uniform3f(u.uTint, params.tint[0], params.tint[1], params.tint[2]);
    gl.uniform1f(u.uBrightness, params.brightness);
    gl.uniform1f(u.uAmbient, params.ambient);
    gl.uniform1f(u.uFlicker, params.flicker);
    gl.uniform1f(u.uPersistence, params.persistence);
    gl.uniform1i(u.uRasterMode, params.rasterMode);
    gl.uniform1f(u.uHorizontalSync, params.horizontalSync);
    gl.uniform1f(u.uGlowingLine, params.glowingLine);
    gl.uniform1f(u.uStaticNoise, params.staticNoise);
    gl.uniform1f(u.uJitter, params.jitter);
    gl.uniform1f(u.uRgbShift, params.rgbShift);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, currFB);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(
      0, 0, skin.width, skin.height,
      0, 0, skin.width, skin.height,
      gl.COLOR_BUFFER_BIT, gl.NEAREST
    );

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.CRTParams = {
    setRgbShift: (s) => params.rgbShift = s,
    setRasterMode: (m) => params.rasterMode = m | 0,
    setTint: (r, g, b) => { params.tint = [r, g, b]; },
    amber: () => { params.tint = [1.0, 0.73, 0.2]; params.chroma = 0.35; },
    green: () => { params.tint = [0.65, 1.0, 0.65]; params.chroma = 0.35; },
    rgb: () => { params.tint = [1.0, 1.0, 1.0]; params.chroma = 1.0; },
  };
}

main().catch(err => console.error(err));
