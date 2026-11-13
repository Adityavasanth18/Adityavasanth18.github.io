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

/* ---------- the instrument ---------- */
// Palette: only colours the site already uses.
const INK = "#1c1916", INK_2 = "#221f1b", UMBER = "#2f2820", BRONZE_DARK = "#49372a";
const BRASS = "#c49a67", BRONZE = "#d7ae78", GOLD = "#e0b87e", CREAM = "#f0ddba";
const DEPTH = 40; // body thickness, in the SVG's 600-unit space

function build(THREE, { canvas, atlas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // keep palette colours unshifted

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 100, 4000);
  camera.position.set(0, 0, PERSPECTIVE);

  // A small studio lit only in palette colours, baked into reflections.
  const studio = new THREE.Scene();
  const panel = (hex, gain, w, h, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(gain), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
  };
  studio.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16),
    new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })));
  panel(CREAM, 1.9, 7, 2.2, 3, 7, 9);
  panel(CREAM, 1.1, 1.2, 9, -6, 1, 8);
  panel(BRONZE, 1.3, 9, 1.4, -2, -6, 8);
  panel(GOLD, 0.9, 2, 6, 9, -1, 5);
  panel(BRONZE_DARK, 1.4, 30, 6, 0, 12, -4);
  panel(BRONZE_DARK, 1.1, 30, 6, 0, -12, -4);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(studio, 0.03);
  scene.environment = envTarget.texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(CREAM, 1.1);
  key.position.set(300, 420, 700);
  const rim = new THREE.DirectionalLight(BRONZE, 0.5);
  rim.position.set(-500, -300, 300);
  scene.add(key, rim);

  // Spun-metal grain: concentric grooves, as left by a lathe.
  const grain = (() => {
    const n = 256, data = new Uint8Array(n * 4);
    let h = 0, prev = 0, seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      h = h * 0.55 + (rnd() - 0.5);
      const d = h - prev; prev = h;
      data.set([128, Math.max(0, Math.min(255, 128 + d * 150)), 255, 255], i * 4);
    }
    const t = new THREE.DataTexture(data, 1, n, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  })();

  const metal = (hex, roughness, extra = {}) => new THREE.MeshStandardMaterial({
    color: hex, metalness: 1, roughness, side: THREE.DoubleSide,
    normalMap: grain, normalScale: new THREE.Vector2(0.14, 0.14), ...extra });
  const mBrass = metal(BRASS, 0.36);
  const mBright = metal(GOLD, 0.3, { emissive: BRONZE, emissiveIntensity: 0.22 });
  const mBody = metal(UMBER, 0.62, { normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 0.8 });
  const mWell = new THREE.MeshStandardMaterial({ color: INK_2, metalness: 0.4, roughness: 0.82, side: THREE.DoubleSide });
  const mEngraved = new THREE.MeshStandardMaterial({ color: INK_2, metalness: 0.2, roughness: 0.9 });
  const mCollar = metal("#ffffff", 0.34);

  const group = new THREE.Group();
  scene.add(group);
  const lathe = (pts, material, seg = 160) => {
    const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg);
    g.rotateX(Math.PI / 2); // lathe axis -> toward the viewer
    const m = new THREE.Mesh(g, material); group.add(m); return m;
  };

  // Body: recessed well for the title, engraved field, node track, back.
  lathe([[0, -3], [130, -3]], mWell, 96);
  lathe([[140, 0], [210, 0], [212, -1.5], [264, -1.5], [264, -DEPTH + 2], [0, -DEPTH + 2]], mBody);
  // Brass: outer bezel, the ring that parts field from track, the well's rim.
  lathe([[262, -1.5], [264.5, 3.6], [267, 5], [279, 5], [283, 3.2], [285.5, -1], [285.5, -DEPTH + 3], [282, -DEPTH], [0, -DEPTH]], mBrass);
  lathe([[209.5, 0], [210.5, 1.8], [212.5, 2.4], [215, 1.8], [216, -1.5]], mBrass);
  lathe([[130, -3], [131.5, 2.2], [134, 3], [139, 3], [141.5, 1.6], [142.5, 0]], mBrass);

  // Bezel graduations: 120 engraved marks, every fifth one long.
  const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mEngraved, 120);
  const o = new THREE.Object3D();
  for (let i = 0; i < 120; i++) {
    const major = i % 5 === 0, len = major ? 10 : 4.5, r = 278 - len / 2, a = (i * 3 * Math.PI) / 180;
    o.position.set(Math.sin(a) * r, Math.cos(a) * r, 5.05);
    o.rotation.set(0, 0, -a); o.scale.set(major ? 1.1 : 0.7, len, 0.3); o.updateMatrix();
    ticks.setMatrixAt(i, o.matrix);
  }
  group.add(ticks);

  // The rosette: four squares, as fine raised wire on the field.
  const wires = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mBrass, 16);
  const R = 197, edge = R * Math.SQRT2, mid = R / Math.SQRT2;
  for (let k = 0, n = 0; k < 4; k++) for (let e = 0; e < 4; e++, n++) {
    const a = ((k * 22.5 + e * 90 + 45) * Math.PI) / 180;
    o.position.set(Math.sin(a) * mid, Math.cos(a) * mid, 0.3);
    o.rotation.set(0, 0, -a + Math.PI / 2); o.scale.set(0.8, edge, 0.7); o.updateMatrix();
    wires.setMatrixAt(n, o.matrix);
  }
  group.add(wires);

  // A collar under every project button, sized in screen pixels like the buttons.
  const nodes = [...atlas.querySelectorAll("[data-project-select]")];
  const studs = nodes.map((b) => [(parseFloat(b.style.left) / 100) * 600 - 300, 300 - (parseFloat(b.style.top) / 100) * 600]);
  const collarGeo = new THREE.LatheGeometry([[15.5, 0], [16.6, 2.8], [18.6, 3.6], [20.4, 2.6], [21.2, 0]].map(([r, z]) => new THREE.Vector2(r, z)), 40);
  collarGeo.rotateX(Math.PI / 2);
  const collars = new THREE.InstancedMesh(collarGeo, mCollar, nodes.length);
  group.add(collars);
  const brass = new THREE.Color(BRASS), tint = new THREE.Color();
  let unit = 1, selected = -1;
  const layCollars = () => {
    studs.forEach(([x, y], i) => {
      o.position.set(x, y, -1.5); o.rotation.set(0, 0, 0); o.scale.setScalar(1 / unit); o.updateMatrix();
      collars.setMatrixAt(i, o.matrix);
    });
    collars.instanceMatrix.needsUpdate = true;
  };
  nodes.forEach((_, i) => collars.setColorAt(i, brass));

  // The alidade: a ring that carries a hand to the selected project.
  const hand = new THREE.Group();
  group.add(hand);
  const ring = lathe([[142.5, 0], [143.5, 2.2], [146, 2.8], [149, 2.2], [150, 0]], mBright);
  group.remove(ring); hand.add(ring);
  const shape = new THREE.Shape();
  shape.moveTo(-3.6, 147); shape.lineTo(3.6, 147); shape.lineTo(1.3, 219); shape.lineTo(0, 227); shape.lineTo(-1.3, 219); shape.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 2 }), mBright);
  blade.position.z = 3.2;
  hand.add(blade);

  const setSelected = (index, colorHex, angleRad) => {
    if (selected >= 0) collars.setColorAt(selected, brass);
    selected = index;
    if (index >= 0) collars.setColorAt(index, tint.set(colorHex || GOLD));
    collars.instanceColor.needsUpdate = true;
    return angleRad;
  };

  const resize = () => {
    const w = atlas.offsetWidth, h = atlas.offsetHeight, mx = w * MARGIN, my = h * MARGIN;
    const cw = w + mx * 2, ch = h + my * 2;
    Object.assign(canvas.style, { left: atlas.offsetLeft - mx + "px", top: atlas.offsetTop - my + "px", width: cw + "px", height: ch + "px" });
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    camera.fov = (2 * Math.atan(ch / 2 / PERSPECTIVE) * 180) / Math.PI;
    camera.updateProjectionMatrix();
    unit = w / 600;
    layCollars();
    return unit;
  };

  const lowerQuality = () => {
    const now = renderer.getPixelRatio();
    if (now <= 1) return false;
    renderer.setPixelRatio(Math.max(1, now - 0.5));
    return true;
  };

  const probe = new THREE.Vector3();
  const studScreen = (i) => {
    group.updateMatrixWorld();
    probe.set(studs[i][0], studs[i][1], 0).applyMatrix4(group.matrixWorld).project(camera);
    const r = canvas.getBoundingClientRect();
    return [r.left + ((probe.x + 1) / 2) * r.width, r.top + ((1 - probe.y) / 2) * r.height];
  };

  const dispose = () => {
    scene.traverse((m) => { m.geometry?.dispose(); });
    [mBrass, mBright, mBody, mWell, mEngraved, mCollar].forEach((m) => m.dispose());
    grain.dispose(); envTarget.dispose(); renderer.dispose();
  };

  return { render: () => renderer.render(scene, camera), resize, lowerQuality, setSelected, dispose, group, hand, key, nodes, studScreen };
}

/* ---------- keeping it in step with the page ---------- */
function run(THREE, dial, { canvas, atlas, wrap }) {
  const { gsap } = window;
  const get = (prop) => Number(gsap.getProperty(atlas, prop)) || 0;
  const RAD = Math.PI / 180;
  const debug = (status.debug = { frames: 0, rotY: 0, selected: -1, studScreen: dial.studScreen });
  const wide = matchMedia("(min-width: 900px)");
  let unit = dial.resize(), inView = true, alive = true, lastPose = "", cost = 0;
  dial.group.rotation.order = "ZYX";

  const select = () => {
    const i = dial.nodes.findIndex((n) => n.classList.contains("selected"));
    if (i === debug.selected) return;
    const node = dial.nodes[i];
    const colour = node && getComputedStyle(node).getPropertyValue(`--patina-${node.dataset.category}`).trim();
    dial.setSelected(i, colour);
    debug.selected = i;
    if (i < 0) return;
    // Turn the hand the short way round.
    const target = -(i * 2 * Math.PI) / dial.nodes.length, now = dial.hand.rotation.z;
    const delta = Math.atan2(Math.sin(target - now), Math.cos(target - now));
    gsap.to(dial.hand.rotation, { z: now + delta, duration: 0.9, ease: "power3.out", overwrite: true });
  };
  const watcher = new MutationObserver(select);
  watcher.observe(atlas.querySelector(".atlas-nodes"), { subtree: true, attributes: true, attributeFilter: ["class"] });
  select();
  dial.hand.rotation.z = -(Math.max(debug.selected, 0) * 2 * Math.PI) / dial.nodes.length;

  // The key light follows the cursor, like the lamp over the hero.
  const world = atlas.closest(".hero-world") || atlas.closest(".folio-hero") || wrap;
  const lamp = { x: 0.4, y: 0.5 };
  const lampX = gsap.quickTo(lamp, "x", { duration: 0.8, ease: "power3" });
  const lampY = gsap.quickTo(lamp, "y", { duration: 0.8, ease: "power3" });
  const onMove = (e) => {
    const r = atlas.getBoundingClientRect();
    lampX((e.clientX - (r.left + r.width / 2)) / r.width);
    lampY(((r.top + r.height / 2) - e.clientY) / r.height);
  };
  world.addEventListener("pointermove", onMove);

  const frame = () => {
    if (!alive || !inView || document.hidden || !wide.matches) return;
    const w = atlas.offsetWidth, h = atlas.offsetHeight;
    const g = dial.group;
    // Mirror the CSS transform (y points down there, up here).
    g.rotation.set(-get("rotationX") * RAD, get("rotationY") * RAD, -get("rotation") * RAD);
    g.position.set(get("x") + (get("xPercent") / 100) * w, -(get("y") + (get("yPercent") / 100) * h), 0);
    g.scale.setScalar(unit * (get("scaleX") || 1));
    canvas.style.opacity = getComputedStyle(atlas).visibility === "hidden" ? 0 : gsap.getProperty(atlas, "opacity");
    dial.key.position.set(lamp.x * 900, lamp.y * 900, 700);
    debug.rotY = get("rotationY");
    // Draw only when something moved.
    const pose = [g.rotation.x, g.rotation.y, g.rotation.z, g.position.x, g.position.y, g.scale.x, lamp.x, lamp.y, dial.hand.rotation.z, canvas.width]
      .map((v) => v.toFixed(4)).join();
    if (pose === lastPose) return;
    lastPose = pose;
    const t0 = performance.now();
    dial.render();
    debug.frames++;
    // Ease off resolution on machines that struggle.
    cost = cost * 0.9 + (performance.now() - t0) * 0.1;
    if (debug.frames % 45 === 0 && cost > 24 && dial.lowerQuality()) { cost = 0; unit = dial.resize(); }
  };
  gsap.ticker.add(frame);

  const seen = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { rootMargin: "80px" });
  seen.observe(wrap);
  const sized = new ResizeObserver(() => { if (alive && wide.matches) unit = dial.resize(); });
  sized.observe(atlas);

  const show = () => {
    canvas.style.display = "block"; unit = dial.resize(); lastPose = ""; frame();
    wrap.classList.add("has-dial3d"); status.state = "ready"; delete status.reason;
  };
  const hide = (reason) => { wrap.classList.remove("has-dial3d"); canvas.style.display = "none"; fallback(reason); };
  const onWidth = () => (wide.matches ? show() : hide("narrow"));
  wide.addEventListener("change", onWidth);

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    alive = false;
    gsap.ticker.remove(frame); watcher.disconnect(); seen.disconnect(); sized.disconnect();
    wide.removeEventListener("change", onWidth); world.removeEventListener("pointermove", onMove);
    wrap.classList.remove("has-dial3d", "dial3d-host");
    try { dial.dispose(); } catch {}
    canvas.remove();
    fallback("context-lost");
  });

  show();
}

start();
