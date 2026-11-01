/*
 * Guilloché: the engraved interlacing hairlines of watch dials and banknotes,
 * drawn live in a fragment shader. Three families of curves (a waved rosette
 * and two crossing spirals) interfere into a lattice. The cursor acts as a
 * loupe that swells the lines beneath it; scroll slowly unwinds the pattern.
 *
 * window.Guilloche(canvas, options) -> { set(k, v), destroy() } or null
 */
(() => {
  "use strict";
  const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;      // canvas px
uniform vec2 uCenter;   // px, origin of the rosette
uniform float uScale;   // px per unit
uniform float uTime;
uniform vec2 uMouse;    // px
uniform float uLoupe;   // 0..1 cursor influence
uniform float uScroll;  // 0..1
uniform float uReveal;  // 0..1 rings spread from the centre
uniform float uAlpha;
uniform vec3 uColor;
uniform vec3 uColor2;
out vec4 o;

const float TAU = 6.28318530718;

// Anti-aliased hairline on the integer level sets of f. Width from the
// seam-free derivative estimate so atan's discontinuity never shows.
float hair(float f, float fw, float w) {
  float d = abs(fract(f + 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, fw * w, d);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = (frag - uCenter) / uScale;
  vec2 m = (uMouse - uCenter) / uScale;

  // Loupe: lines swell outward around the cursor.
  vec2 dm = q - m;
  float md2 = dot(dm, dm);
  q += dm * 0.32 * exp(-md2 * 9.0) * uLoupe;

  float r = length(q);
  if (r > 1.75) { o = vec4(0.0); return; }   // outside the plate: skip the work
  float a = atan(q.y, q.x);
  float b = atan(-q.y, -q.x);          // same angle, seam on the other side
  float t = uTime * 0.05 + uScroll * 1.8;

  // Family 1: waved concentric rosette.
  float w1a = sin(a * 12.0 + t * 2.0) * (0.55 + 0.45 * sin(r * 3.1 - t));
  float w1b = sin(b * 12.0 + t * 2.0 + 12.0 * 3.14159265) * (0.55 + 0.45 * sin(r * 3.1 - t));
  float f1a = r * 21.0 + 0.85 * w1a + 0.45 * sin(a * 5.0 - t * 1.3);
  float f1b = r * 21.0 + 0.85 * w1b + 0.45 * sin(b * 5.0 - t * 1.3 + 5.0 * 3.14159265);
  float fw1 = min(fwidth(f1a), fwidth(f1b));

  // Families 2 and 3: crossing spirals (integer turns keep them seamless).
  float s = 0.6 * sin(r * 9.0 - t * 2.4);
  float f2a = a / TAU * 16.0 + r * 8.5 + s;
  float f2b = (b + 3.14159265) / TAU * 16.0 + r * 8.5 + s;
  float f3a = -a / TAU * 16.0 + r * 8.5 - s + t * 0.35;
  float f3b = -(b + 3.14159265) / TAU * 16.0 + r * 8.5 - s + t * 0.35;
  float fw2 = min(fwidth(f2a), fwidth(f2b));
  float fw3 = min(fwidth(f3a), fwidth(f3b));

  float l1 = hair(f1a, fw1, 1.15);
  float l2 = hair(f2a, fw2, 1.0);
  float l3 = hair(f3a, fw3, 1.0);

  // Composition: dense near the centre, dissolving outward like a worn plate.
  float mask = smoothstep(1.7, 0.35, r) * smoothstep(0.04, 0.16, r);
  float reveal = smoothstep(uReveal * 2.0, uReveal * 2.0 - 0.35, r);
  float glow = exp(-md2 * 5.0) * uLoupe;

  float ink1 = l1 * (0.85 + 0.6 * glow);
  float ink2 = (l2 + l3) * 0.42 * (0.8 + 0.8 * glow);
  float alpha = (ink1 + ink2) * mask * reveal * uAlpha;
  vec3 col = mix(uColor, uColor2, clamp(glow * 1.4 + l1 * 0.15, 0.0, 1.0));
  o = vec4(col * alpha, alpha);
}`;

  const hex = (h) => {
    const n = parseInt(h.replace("#", ""), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };

  window.Guilloche = (canvas, opts = {}) => {
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: "low-power" });
    if (!gl) return null;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const U = {};
    ["uRes", "uCenter", "uScale", "uTime", "uMouse", "uLoupe", "uScroll", "uReveal", "uAlpha", "uColor", "uColor2"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

    const state = {
      center: opts.center || (() => [canvas.clientWidth / 2, canvas.clientHeight / 2]),
      scale: opts.scale || (() => Math.min(canvas.clientWidth, canvas.clientHeight) * 0.5),
      mouse: [-9999, -9999], loupe: 0, scroll: 0, reveal: opts.reveal ?? 1, alpha: opts.alpha ?? 0.22,
      color: hex(opts.color || "#c49a67"), color2: hex(opts.color2 || "#f0cf9c"),
    };
    let dpr = 1, w = 0, h = 0, visible = true, raf = 0, t0 = performance.now(), dead = false;

    let cap = opts.maxDpr || 1.5;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, cap);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { rootMargin: "100px" });
    io.observe(canvas);

    // Frame budget: if a slower machine struggles, render fewer pixels.
    let last = 0, ema = 16, frames = 0;
    const budget = (now) => {
      if (last) ema = ema * 0.94 + Math.min(now - last, 100) * 0.06;
      last = now;
      if (++frames > 90 && ema > 26 && cap > 0.6) { cap = Math.max(0.6, cap * 0.75); frames = 0; ema = 16; resize(); }
    };
    const frame = (now) => {
      raf = 0;
      if (dead || !visible || document.hidden) { last = 0; return; }
      budget(now);
      const c = state.center(), s = state.scale();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uCenter, c[0] * dpr, c[1] * dpr);
      gl.uniform1f(U.uScale, s * dpr);
      gl.uniform1f(U.uTime, (now - t0) / 1000);
      gl.uniform2f(U.uMouse, state.mouse[0] * dpr, state.mouse[1] * dpr);
      gl.uniform1f(U.uLoupe, state.loupe);
      gl.uniform1f(U.uScroll, state.scroll);
      gl.uniform1f(U.uReveal, state.reveal);
      gl.uniform1f(U.uAlpha, state.alpha);
      gl.uniform3fv(U.uColor, state.color);
      gl.uniform3fv(U.uColor2, state.color2);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      loop();
    };
    const loop = () => { if (!raf && !dead) raf = requestAnimationFrame(frame); };
    document.addEventListener("visibilitychange", loop);
    loop();

    return {
      state,
      set(k, v) { state[k] = v; },
      destroy() { dead = true; ro.disconnect(); io.disconnect(); cancelAnimationFrame(raf); },
    };
  };
})();
