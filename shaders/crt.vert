  #version 300 es
  precision highp float;
  const vec2 verts[6] = vec2[6](
    vec2(-1.0,-1.0), vec2( 1.0,-1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2( 1.0,-1.0), vec2( 1.0, 1.0)
  );
  out vec2 vUV;
  void main() {
    vec2 p = verts[gl_VertexID];
    vUV = 0.5 * (p + 1.0);
    gl_Position = vec4(p, 0.0, 1.0);
  }
