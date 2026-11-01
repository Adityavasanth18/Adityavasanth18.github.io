/*
 * The living engraving: a field of contour lines, like the guilloché on a
 * banknote or the hatching on an old plate, slowly breathing behind the hero
 * and the closing page. The cursor swells the lines like a lens over metal.
 * One small fragment shader per surface, paused whenever it is off-screen.
 */
(() => {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const VERT = `#version 300 es
  in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
  precision highp float;
  uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uHover;
  uniform float uScroll; uniform float uReveal; uniform float uDensity; uniform float uAlpha;
  uniform vec2 uQuiet; // x-range (0..1) where text sits and lines should hush
  out vec4 o;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
  void main(){
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / uRes.y;
    vec2 m = uMouse / uRes.y;
    float t = uTime * 0.03;
    vec2 q = uv * 1.35 + vec2(0.0, uScroll * 0.00035);
    vec2 w = vec2(fbm(q + vec2(t, -t * 0.6)), fbm(q + vec2(5.2, 1.3) - t * 0.8));
    float d = distance(uv, m);
    float lens = exp(-d * d * 14.0) * uHover;
    float h = fbm(q + 1.5 * w + lens * 0.45) + lens * 0.28;
    float f = h * uDensity;
    float dist = abs(fract(f + 0.5) - 0.5);
    float px = dist / max(fwidth(f), 1e-4);
    float line = 1.0 - smoothstep(0.35, 1.25, px);
    float idx = floor(f + 0.5);
    float major = 1.0 - step(0.001, abs(mod(idx, 5.0)));
    // hush where the words are, fade at the edges
    vec2 n = frag / uRes;
    float quiet = 1.0 - 0.62 * smoothstep(uQuiet.x - 0.08, uQuiet.x, n.x) * (1.0 - smoothstep(uQuiet.y, uQuiet.y + 0.08, n.x));
    float edge = smoothstep(0.0, 0.12, n.y) * smoothstep(1.0, 0.82, n.y);
    // reveal: the plate is inked outward from the centre of the instrument
    float r = distance(n * vec2(uRes.x / uRes.y, 1.0), vec2(0.72 * uRes.x / uRes.y, 0.5));
    float reveal = smoothstep(uReveal * 2.2, uReveal * 2.2 - 0.35, r);
    float a = line * (0.085 + 0.11 * major + 0.42 * lens) * quiet * edge * reveal * uAlpha;
    vec3 ink = mix(vec3(0.80, 0.62, 0.42), vec3(0.97, 0.80, 0.56), lens);
    o = vec4(ink * a, a);
  }`;

  const surfaces = [];

  function mount(host, opts) {
    const canvas = document.createElement("canvas");
    canvas.className = "engraving-field";
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: "low-power" });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
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
    ["uRes", "uTime", "uMouse", "uHover", "uScroll", "uReveal", "uDensity", "uAlpha", "uQuiet"].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
    gl.uniform1f(U.uDensity, opts.density);
    gl.uniform1f(U.uAlpha, opts.alpha);
    gl.uniform2f(U.uQuiet, opts.quiet[0], opts.quiet[1]);
    host.prepend(canvas);

    const s = {
      host, canvas, gl, U, visible: false, w: 1, h: 1, dpr: 1,
      mouse: { x: 0, y: 0, tx: 0, ty: 0 }, hover: 0, hoverT: 0,
      reveal: 0, revealT: 0, t0: performance.now() - Math.random() * 40000,
    };
    const resize = () => {
      const r = host.getBoundingClientRect();
      s.dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1 : 1.5);
      s.w = Math.max(1, Math.round(r.width * s.dpr)); s.h = Math.max(1, Math.round(r.height * s.dpr));
      canvas.width = s.w; canvas.height = s.h;
      gl.viewport(0, 0, s.w, s.h);
      s.mouse.tx = s.mouse.x = s.w * 0.72; s.mouse.ty = s.mouse.y = s.h * 0.5;
    };
    resize();
    new ResizeObserver(resize).observe(host);
    new IntersectionObserver(([e]) => { s.visible = e.isIntersecting; if (s.visible) kick(); }, { rootMargin: "80px" }).observe(host);
    host.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect();
      s.mouse.tx = (e.clientX - r.left) * s.dpr;
      s.mouse.ty = (r.bottom - e.clientY) * s.dpr;
      s.hoverT = 1;
    });
    host.addEventListener("pointerleave", () => (s.hoverT = 0));
    surfaces.push(s);
    return s;
  }

  let running = false;
  const frame = (now) => {
    running = false;
    let any = false;
    for (const s of surfaces) {
      if (!s.visible || document.hidden) continue;
      any = true;
      const { gl, U, mouse } = s;
      mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
      s.hover += (s.hoverT - s.hover) * 0.05;
      s.reveal += (s.revealT - s.reveal) * 0.028;
      gl.uniform2f(U.uRes, s.w, s.h);
      gl.uniform1f(U.uTime, (now - s.t0) / 1000);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform1f(U.uHover, s.hover);
      gl.uniform1f(U.uScroll, window.scrollY);
      gl.uniform1f(U.uReveal, s.reveal);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (any) kick();
  };
  const kick = () => { if (!running) { running = true; requestAnimationFrame(frame); } };
  document.addEventListener("visibilitychange", kick);

  const start = () => {
    const hero = document.querySelector(".hero-world");
    const foot = document.querySelector(".folio-contact");
    const a = hero && mount(hero, { density: 24, alpha: 1, quiet: [0.0, 0.5] });
    const b = foot && mount(foot, { density: 20, alpha: 0.8, quiet: [0.0, 0.0] });
    const reveal = (s, delay) => s && setTimeout(() => { s.revealT = 1; kick(); }, delay);
    if (window.__opening) document.addEventListener("folio:opened", () => reveal(a, 0), { once: true });
    else reveal(a, 300);
    if (b) {
      new IntersectionObserver(([e], io) => { if (e.isIntersecting) { reveal(b, 200); io.disconnect(); } }, { threshold: 0.2 }).observe(foot);
    }
    kick();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
