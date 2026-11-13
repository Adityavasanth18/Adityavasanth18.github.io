/*
 * The hero's project dial as a solid brass instrument.
 *
 * A WebGL canvas sits behind .project-atlas. The scene is built in CSS
 * pixels and its camera reproduces the CSS perspective motion.js gives
 * the dial, so the metal's top face stays registered under the real HTML
 * controls. Anything that could go wrong leaves today's flat dial alone.
 */
const status = (window.__dial3d = { state: "pending" });
const PERSPECTIVE = 1100; // matches transformPerspective in motion.js
const MARGIN = 0.14;      // canvas overhang around the dial, per side

const fallback = (reason) => { status.state = "fallback"; status.reason = reason; };

const gate = () => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return "coarse-pointer";
  if (!matchMedia("(min-width: 900px)").matches) return "narrow";
  if (!document.querySelector(".folio-atlas-wrap .project-atlas")) return "no-dial";
  const probe = document.createElement("canvas").getContext("webgl2");
  if (!probe) return "no-webgl2";
  probe.getExtension("WEBGL_lose_context")?.loseContext();
  return null;
};

const motionReady = () => new Promise((resolve) => {
  const t0 = performance.now();
  (function poll() {
    if (window.__motion && window.gsap) return resolve(true);
    if (performance.now() - t0 > 4000) return resolve(false);
    setTimeout(poll, 60);
  })();
});

async function start() {
  const blocked = gate();
  if (blocked) return fallback(blocked);
  if (!(await motionReady())) return fallback("no-motion");

  const atlas = document.querySelector(".folio-atlas-wrap .project-atlas");
  const wrap = atlas.parentElement;
  let canvas = null;
  try {
    const THREE = await import("/assets/vendor/three.module.min.js");
    canvas = document.createElement("canvas");
    canvas.className = "dial3d-canvas";
    canvas.setAttribute("aria-hidden", "true");
    wrap.classList.add("dial3d-host");
    wrap.insertBefore(canvas, atlas);
    const dial = build(THREE, { canvas, atlas, wrap });
    run(THREE, dial, { canvas, atlas, wrap });
  } catch (err) {
    canvas?.remove();
    wrap.classList.remove("dial3d-host", "has-dial3d");
    fallback("error: " + (err && err.message));
  }
}

function build() { throw new Error("not built yet"); }
function run() {}

start();
