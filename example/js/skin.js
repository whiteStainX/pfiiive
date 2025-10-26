// WebGL2 glue: renders CRT shader sampling the p5 graphics canvas.
// No bundler required. Uses shaders embedded in index.html.

const skin = document.getElementById('skin-stage');
const gl = skin.getContext('webgl2', { alpha: false, antialias: false });

if(!gl){
  alert('WebGL2 not available in this browser.');
  throw new Error('WebGL2 not available');
}

// --- Helpers ---
function getShaderSource(id){ return document.getElementById(id).textContent.trim(); }
function compile(gl, type, src){
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src); gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){
    const info = gl.getShaderInfoLog(sh);
    console.error(info, '\nSource:\n', src);
    throw new Error('Shader compile failed');
  }
  return sh;
}
function programFromSources(gl, vsSrc, fsSrc){
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){
    const info = gl.getProgramInfoLog(prog);
    console.error(info);
    throw new Error('Program link failed');
  }
  return prog;
}
function makeFullscreenVAO(gl){
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  // No buffers needed: vertex shader builds positions by gl_VertexID
  gl.bindVertexArray(null);
  return vao;
}
function createRenderTexture(gl, w, h){
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return tex;
}
function createFramebuffer(gl, tex){
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fb;
}

// --- Build pipeline ---
const program = programFromSources(gl, getShaderSource('crt-vert'), getShaderSource('crt-frag'));
const vao = makeFullscreenVAO(gl);
gl.useProgram(program);

// Uniform locations
const u = {
  uTex:           gl.getUniformLocation(program, 'uTex'),
  uPrevTex:       gl.getUniformLocation(program, 'uPrevTex'),
  uResolution:    gl.getUniformLocation(program, 'uResolution'),
  uTime:          gl.getUniformLocation(program, 'uTime'),
  uDPR:           gl.getUniformLocation(program, 'uDPR'),
  uVirtRes:       gl.getUniformLocation(program, 'uVirtRes'),
  uCurvature:     gl.getUniformLocation(program, 'uCurvature'),
  uRasterStrength:gl.getUniformLocation(program, 'uRasterStrength'),
  uChroma:        gl.getUniformLocation(program, 'uChroma'),
  uTint:          gl.getUniformLocation(program, 'uTint'),
  uBrightness:    gl.getUniformLocation(program, 'uBrightness'),
  uAmbient:       gl.getUniformLocation(program, 'uAmbient'),
  uFlicker:       gl.getUniformLocation(program, 'uFlicker'),
  uPersistence:   gl.getUniformLocation(program, 'uPersistence'),
  uRasterMode:    gl.getUniformLocation(program, 'uRasterMode'),
};

// State
let DPR = 1;
function resize(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.floor(window.innerWidth);
  const cssH = Math.floor(window.innerHeight);
  skin.style.width = cssW + 'px';
  skin.style.height = cssH + 'px';
  skin.width = Math.floor(cssW * DPR);
  skin.height = Math.floor(cssH * DPR);
  gl.viewport(0, 0, skin.width, skin.height);

  // Recreate ping-pong buffers at new size
  if(ping.texA) { gl.deleteTexture(ping.texA); gl.deleteTexture(ping.texB); gl.deleteFramebuffer(ping.fbA); gl.deleteFramebuffer(ping.fbB); }
  ping.texA = createRenderTexture(gl, skin.width, skin.height);
  ping.texB = createRenderTexture(gl, skin.width, skin.height);
  ping.fbA = createFramebuffer(gl, ping.texA);
  ping.fbB = createFramebuffer(gl, ping.texB);
}
window.addEventListener('resize', resize);

// Ping-pong buffers for persistence
const ping = { texA: null, texB: null, fbA: null, fbB: null, flip: false };

// Source texture from p5 canvas
const srcTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, srcTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// Defaults (match suggested values)
const params = {
  curvature: 0.10,
  rasterStrength: 0.45,
  chroma: 1.0,
  tint: [1.0, 1.0, 1.0],
  brightness: 1.0,
  ambient: 0.05,
  flicker: 0.01,
  persistence: 0.04,
  rasterMode: 0, // 0 scanline, 1 subpixel, 2 pixel
};

// Kick things off
resize();

// Draw loop
let start = performance.now();
function frame(now){
  const p5Canvas = window.getP5Canvas && window.getP5Canvas();
  const p5Size = window.getP5Size ? window.getP5Size() : {w:640, h:400};

  // Upload p5 canvas
  if(p5Canvas){
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p5Canvas);
  }

  // Decide prev/current ping textures
  const prevTex = ping.flip ? ping.texB : ping.texA;
  const currFB  = ping.flip ? ping.fbA  : ping.fbB;
  ping.flip = !ping.flip;

  // Render to current framebuffer
  gl.bindFramebuffer(gl.FRAMEBUFFER, currFB);
  gl.useProgram(program);
  gl.bindVertexArray(vao);

  // Uniforms
  gl.uniform1i(u.uTex, 0); // srcTex on unit 0
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, prevTex);
  gl.uniform1i(u.uPrevTex, 1);

  gl.uniform2f(u.uResolution, skin.width, skin.height);
  gl.uniform1f(u.uTime, (now - start) * 0.001);
  gl.uniform1f(u.uDPR, DPR);

  // Virtual grid: lock to physical pixels by default
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

  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Blit to screen (simple copy of currFB color to default framebuffer)
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

// Optional: expose a quick toggle UI via console
window.CRTParams = {
  setRasterMode: (m)=> params.rasterMode = m|0,
  setTint: (r,g,b)=> { params.tint = [r,g,b]; },
  amber: ()=> { params.tint=[1.0,0.73,0.2]; params.chroma=0.35; },
  green: ()=> { params.tint=[0.65,1.0,0.65]; params.chroma=0.35; },
  rgb:   ()=> { params.tint=[1.0,1.0,1.0]; params.chroma=1.0; },
};
