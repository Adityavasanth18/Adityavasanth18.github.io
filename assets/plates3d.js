/*
 * The project drawings as solid models.
 *
 * Each flat plate (AsterDB's storage layers, AgentOps' execution steps,
 * ApeironCode's nested gateways, the "what's underneath" ornament) gets a
 * small 3D scene built in that drawing's own colours. One shared WebGL
 * renderer paints all of them; each plate shows the result on a plain 2D
 * canvas, so the page never holds more than one extra GPU context.
 * Phones, reduced motion and browsers without WebGL2 keep the drawings.
 */
const status = (window.__plates3d = { state: "pending", count: 0 });
const fallback = (reason) => { status.state = "fallback"; status.reason = reason; };

const gate = () => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return "coarse-pointer";
  if (!matchMedia("(min-width: 900px)").matches) return "narrow";
  const probe = document.createElement("canvas").getContext("webgl2");
  if (!probe) return "no-webgl2";
  probe.getExtension("WEBGL_lose_context")?.loseContext();
  return null;
};

const MONO = '500 28px "Plex Mono", ui-monospace, monospace';
const SERIF = '400 120px Newsreader, Georgia, serif';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => v * v * (3 - 2 * v);

/* ---------- small scene kit ---------- */
function kit(THREE) {
  const solid = (hex, rough = 0.78) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0.04 });
  const edged = (mesh, hex, opacity = 0.6) => {
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30),
      new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity })));
    return mesh;
  };
  const box = (w, h, d, hex, edge) => edged(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), solid(hex)), edge);
  // Text drawn once to a texture: labels stay real type, in the site's faces.
  const label = (lines, w, h, pxPerUnit = 220) => {
    const c = document.createElement("canvas");
    c.width = Math.round(w * pxPerUnit); c.height = Math.round(h * pxPerUnit);
    const g = c.getContext("2d");
    g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach(({ text, font, color, y = 0.5, spacing = 0 }) => {
      g.font = font; g.fillStyle = color;
      try { g.letterSpacing = spacing + "px"; } catch {}
      g.fillText(text, c.width / 2, c.height * y);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.userData.tex = tex;
    return m;
  };
  const bead = (hex, r = 0.13) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: hex, transparent: true }));
  return { solid, edged, box, label, bead };
}

/* ---------- the four models ---------- */
const MODELS = {
  // AsterDB: a write is ordered in the log, persisted, then revealed.
  storage(THREE, k) {
    const g = new THREE.Group();
    const defs = [["#733b2b", "IMMUTABLE TABLES"], ["#98573d", "SNAPSHOT VIEW"], ["#bd7953", "WRITE-AHEAD LOG"]];
    const slabs = defs.map(([hex, text]) => {
      const s = k.box(4, 0.3, 4, hex, "#f0cda6");
      const t = k.label([{ text, font: MONO.replace("28px", "58px"), color: "#ffe5b8", spacing: 9 }], 3.7, 0.5);
      t.rotation.x = -Math.PI / 2; t.position.set(0, 0.156, 1.66);
      s.add(t); g.add(s); return s;
    });
    for (let i = 0; i < 4; i++) {            // entries in the log
      const line = new THREE.Mesh(new THREE.BoxGeometry(2.3 - i * 0.28, 0.02, 0.07), new THREE.MeshBasicMaterial({ color: "#ffe5b8", transparent: true, opacity: 0.55 }));
      line.position.set(-0.3 + i * 0.14, 0.165, -1.0 + i * 0.42); slabs[2].add(line);
    }
    const write = k.bead("#fff0d9", 0.15); g.add(write);
    return {
      group: g, dir: [0, 0.66, 1], yaw: Math.PI / 4,
      update(t, p, hover) {
        const gap = 0.75 + 0.95 * smooth(clamp((p - 0.18) / 0.5)) + hover * 0.25;
        slabs.forEach((s, i) => (s.position.y = (i - 1) * gap));
        const c = (t % 3.6) / 3.6, top = gap + 0.32;
        write.position.set(0.2, c < 0.35 ? top + 2.2 * (1 - smooth(c / 0.35)) : top - (gap * 2) * smooth((c - 0.35) / 0.65), 0.2);
        write.material.opacity = c < 0.35 ? 1 : 0.9 - 0.75 * ((c - 0.35) / 0.65);
        write.scale.setScalar(c < 0.35 ? 1 : 0.8);
      },
    };
  },

  // AgentOps Studio: five boundaries a run crosses, state kept at each.
  runtime(THREE, k) {
    const g = new THREE.Group();
    const names = ["PLAN", "VALIDATE", "EXECUTE", "CHECKPOINT", "OBSERVE"];
    const fills = ["#30392e", "#354032", "#3c4938", "#45543e", "#4e6045"];
    const blocks = names.map((name, i) => {
      const b = k.box(1.22, 1.22, 1.22, fills[i], "#a9b38d");
      const t = k.label([{ text: "0" + (i + 1), font: SERIF, color: "#e9d8b3", y: 0.42 },
        { text: name, font: MONO.replace("28px", "30px"), color: "#c9c9a7", y: 0.8, spacing: 3 }], 1.22, 1.22);
      t.position.z = 0.612; b.add(t);
      b.userData.home = new THREE.Vector3((i - 2) * 1.62, (2 - i) * 0.56, 0);
      b.position.copy(b.userData.home); g.add(b); return b;
    });
    const trace = k.bead("#e6d5af", 0.12); g.add(trace);
    const stops = blocks.map((b) => b.userData.home.clone().add(new THREE.Vector3(0, 0.78, 0.25)));
    return {
      group: g, dir: [0.05, 0.36, 1], yaw: -0.34,
      update(t, p, hover) {
        const c = ((t * 0.55) % (stops.length + 0.6)), i = Math.min(Math.floor(c), stops.length - 1), f = smooth(clamp(c - i));
        const a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
        trace.position.lerpVectors(a, b, f); trace.position.y += Math.sin(f * Math.PI) * 0.5;
        trace.material.opacity = c > stops.length - 0.1 ? clamp(1 - (c - stops.length + 0.1) * 2) : 1;
        blocks.forEach((blk, n) => {
          const on = n === (f > 0.5 ? Math.min(i + 1, stops.length - 1) : i) ? 1 : 0;
          blk.position.y += ((blk.userData.home.y + on * 0.14 + hover * 0.04 * (2 - n)) - blk.position.y) * 0.12;
        });
      },
    };
  },

  // ApeironCode: six nested boundaries around one reviewable change.
  gateway(THREE, k) {
    const g = new THREE.Group();
    const A = [[94, 404, 229, 186, "#eadbc6"], [118, 400, 239, 162, "#e1c9ac"], [142, 396, 249, 138, "#d5b28d"],
      [166, 392, 259, 114, "#c99872"], [190, 388, 269, 90, "#b57c58"], [214, 384, 279, 66, "#915336"]];
    const u = (v) => v / 80, X = (x) => u(x - 280), Y = (y) => u(250 - y);
    const outline = (path, [xl, yb, ys, r]) => {
      path.moveTo(X(xl), Y(yb)); path.lineTo(X(xl), Y(ys));
      path.absarc(0, Y(ys), u(r), Math.PI, 0, true);
      path.lineTo(X(560 - xl), Y(yb)); path.closePath(); return path;
    };
    const arches = A.map((a, i) => {
      const shape = outline(new THREE.Shape(), a);
      if (A[i + 1]) shape.holes.push(outline(new THREE.Path(), A[i + 1]));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: false, curveSegments: 40 });
      const m = k.edged(new THREE.Mesh(geo, k.solid(a[4], 0.82)), "#8b593f", 0.5);
      g.add(m); return m;
    });
    const change = k.box(0.62, 0.8, 0.05, "#f6e8d3", "#8b593f");   // the reviewable change
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.4 - (i % 2) * 0.12, 0.035, 0.01), new THREE.MeshBasicMaterial({ color: "#986246" }));
      l.position.set(-0.02 - (i % 2) * 0.06, 0.2 - i * 0.13, 0.031); change.add(l);
    }
    g.add(change);
    return {
      group: g, dir: [-0.5, 0.22, 1], yaw: 0,
      update(t, p, hover) {
        const step = 0.36 + 0.2 * smooth(clamp((p - 0.2) / 0.5)) + hover * 0.14;
        arches.forEach((m, i) => (m.position.z = -i * step));
        change.position.set(0, Y(318) + Math.sin(t * 1.2) * 0.05, -(A.length - 1) * step + 0.75 + hover * 0.25);
      },
    };
  },

  // "I like understanding what's underneath": a well of nested frames.
  ornament(THREE, k) {
    const g = new THREE.Group();
    const fills = ["#b49b75", "#a38b67", "#96805e", "#897456", "#7a674d", "#6a5944", "#594b3a"];
    const half = (i) => (132 - i * 12) / 50;
    const sq = (path, h) => { path.moveTo(-h, -h); path.lineTo(h, -h); path.lineTo(h, h); path.lineTo(-h, h); path.closePath(); return path; };
    const frames = fills.map((hex, i) => {
      const shape = sq(new THREE.Shape(), half(i));
      if (i < fills.length - 1) shape.holes.push(sq(new THREE.Path(), half(i + 1)));
      const m = k.edged(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }), k.solid(hex, 0.85)), "#ddc69f", 0.55);
      m.position.z = -i * 0.3; g.add(m); return m;
    });
    const seed = k.box(0.3, 0.3, 0.3, "#ddc69f", "#ddc69f");
    seed.position.z = -(fills.length - 1) * 0.3 + 0.46; g.add(seed);
    return {
      group: g, dir: [0.42, 0.34, 1], yaw: 0,
      update(t, p, hover) {
        frames.forEach((m, i) => (m.rotation.z = (p - 0.5) * i * 0.16 + hover * i * 0.03));
        seed.rotation.z = t * 0.5; seed.rotation.x = t * 0.35;
      },
    };
  },
};

const HOSTS = { storage: ".storage-illustration", runtime: ".runtime-illustration", gateway: ".gateway-illustration", ornament: ".about-ornament" };

async function start() {
  const blocked = gate();
  if (blocked) return fallback(blocked);
  const found = Object.entries(HOSTS).map(([key, sel]) => [key, document.querySelector(sel)]).filter(([, el]) => el && el.querySelector("svg"));
  if (!found.length) return fallback("no-plates");

  let THREE, renderer;
  try {
    THREE = await import("/assets/vendor/three.module.min.js");
    await Promise.all([document.fonts.load(MONO), document.fonts.load(SERIF)]).catch(() => {});
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;            // palette colours stay as authored
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch (err) { return fallback("error: " + (err && err.message)); }

  const k = kit(THREE);
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const plates = [];

  for (const [key, host] of found) {
    try {
      const model = MODELS[key](THREE, k);
      const scene = new THREE.Scene();
      // White light only: shading changes brightness, never hue.
      scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 1.25));
      const sun = new THREE.DirectionalLight(0xffffff, 1.9);
      sun.position.set(-4, 7, 6); sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
      sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
      scene.add(sun, model.group);

      const svg = host.querySelector("svg");
      const canvas = document.createElement("canvas");
      canvas.className = "plate3d-canvas";
      canvas.setAttribute("aria-hidden", "true");
      host.dataset.plate3d = key;
      host.classList.add("plate3d-host");
      host.appendChild(canvas);

      // Frame the model once, from its own bounds.
      model.update(0, 0.5, 0);
      model.group.rotation.y = model.yaw;
      const sphere = new THREE.Box3().setFromObject(model.group).getBoundingSphere(new THREE.Sphere());
      const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
      const dir = new THREE.Vector3(...model.dir).normalize();
      const plate = { key, host, svg, canvas, ctx: canvas.getContext("2d"), scene, camera, model, sphere, dir,
        seen: false, hover: 0, hoverTo: 0, px: 0, py: 0, tx: 0, ty: 0, w: 0, h: 0, painted: false };
      host.addEventListener("pointerenter", () => (plate.hoverTo = 1));
      host.addEventListener("pointerleave", () => { plate.hoverTo = 0; plate.tx = plate.ty = 0; });
      host.addEventListener("pointermove", (e) => {
        const r = host.getBoundingClientRect();
        plate.tx = (e.clientX - r.left) / r.width - 0.5; plate.ty = (e.clientY - r.top) / r.height - 0.5;
      });
      plates.push(plate);
    } catch (err) { /* this drawing simply stays flat */ }
  }
  if (!plates.length) { renderer.dispose(); return fallback("no-models"); }

  const size = (p) => {
    const w = p.svg.clientWidth, h = p.svg.clientHeight;
    if (!w || !h) return false;
    if (w !== p.w || h !== p.h || p.dpr !== dpr) {
      p.w = w; p.h = h; p.dpr = dpr;
      Object.assign(p.canvas.style, { width: w + "px", height: h + "px" });
      p.canvas.width = Math.round(w * dpr); p.canvas.height = Math.round(h * dpr);
      p.camera.aspect = w / h;
      const fit = p.sphere.radius / Math.sin((p.camera.fov * Math.PI) / 360) * (w / h < 1 ? h / w : 1) * 1.04;
      p.camera.position.copy(p.sphere.center).addScaledVector(p.dir, fit);
      p.camera.lookAt(p.sphere.center); p.camera.updateProjectionMatrix();
    }
    return true;
  };

  const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
    const p = plates.find((x) => x.host === e.target); if (p) p.seen = e.isIntersecting;
  }), { rootMargin: "120px" });
  plates.forEach((p) => seen.observe(p.host));

  let alive = true, cost = 0, frames = 0;
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault(); alive = false;
    plates.forEach((p) => { p.host.classList.remove("has-plate3d", "plate3d-host"); p.canvas.remove(); });
    fallback("context-lost");
  });

  const t0 = performance.now();
  const frame = (now) => {
    if (!alive) return;
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const t = (now - t0) / 1000, vh = window.innerHeight;
    for (const p of plates) {
      if (!p.seen || !size(p)) continue;
      const r = p.host.getBoundingClientRect();
      // Sit exactly over the drawing, wherever layout and scroll effects have put it.
      const sr = p.svg.getBoundingClientRect();
      const left = Math.round(sr.left - r.left - p.host.clientLeft), top = Math.round(sr.top - r.top - p.host.clientTop);
      if (left !== p.left || top !== p.top) { p.left = left; p.top = top; p.canvas.style.left = left + "px"; p.canvas.style.top = top + "px"; }
      const progress = clamp((vh - r.top) / (vh + r.height));
      p.hover += (p.hoverTo - p.hover) * 0.08; p.px += (p.tx - p.px) * 0.07; p.py += (p.ty - p.py) * 0.07;
      p.model.update(t, progress, p.hover);
      p.model.group.rotation.y = p.model.yaw + (progress - 0.5) * 0.45 + p.px * 0.55;
      p.model.group.rotation.x = p.py * 0.3;
      const start = performance.now();
      renderer.setPixelRatio(1);
      renderer.setSize(p.canvas.width, p.canvas.height, false);
      renderer.render(p.scene, p.camera);
      p.ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
      p.ctx.drawImage(renderer.domElement, 0, 0);
      if (!p.painted) { p.painted = true; p.host.classList.add("has-plate3d"); }
      cost = cost * 0.9 + (performance.now() - start) * 0.1;
    }
    if (++frames % 60 === 0 && cost > 22 && dpr > 1) { dpr = Math.max(1, dpr - 0.5); cost = 0; }  // ease off on slow machines
  };

  status.count = plates.length;
  status.state = "ready";
  requestAnimationFrame(frame);
}

start();
