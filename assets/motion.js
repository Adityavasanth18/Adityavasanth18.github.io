/*
 * Motion layer for the folio.
 * Language: a precision instrument being drawn and assembled.
 *   - Lenis gives the whole page its weight.
 *   - GSAP + ScrollTrigger choreograph: plates draw themselves, layers
 *     separate, steps fire in order, coloured "worlds" open like pages.
 *   - Native ports of React Bits ideas: BlurText, ScrollReveal, CountUp,
 *     Magnet, ClickSpark, ScrollVelocity.
 * One easing family everywhere: EASE for entrances, TURN for transitions.
 */
(() => {
  "use strict";
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const release = () => root.classList.remove("m", "curtain-in");

  if (reduce || !window.gsap || !window.ScrollTrigger) { release(); return; }
  window.__motion = true;

  const { gsap, ScrollTrigger } = window;
  const plugins = [ScrollTrigger, window.SplitText, window.DrawSVGPlugin].filter(Boolean);
  gsap.registerPlugin(...plugins);
  gsap.config({ nullTargetWarn: false });

  const EASE = "power3.out";
  const TURN = "expo.inOut";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasSplit = !!window.SplitText;
  const hasDraw = !!window.DrawSVGPlugin;

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.095, wheelMultiplier: 1 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    // "Back to the beginning" and other in-page links that Lenis may miss.
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      // Keyboard activation and the skip link keep native jump + focus behaviour.
      if (!a || e.defaultPrevented || e.detail === 0 || a.classList.contains("skip-link")) return;
      const id = a.getAttribute("href");
      const target = id === "#top" ? 0 : id.length > 1 && document.querySelector(id);
      if (target === null || target === false) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -72, duration: 1.4, easing: (x) => 1 - Math.pow(1 - x, 4) });
      if (id !== "#top") history.replaceState(null, "", id);
    });
  }

  /* ---------- helpers ---------- */
  const split = (el, type, extra = {}) =>
    hasSplit ? new window.SplitText(el, { type, charsClass: "m-char", wordsClass: "m-word", linesClass: "m-line", aria: "auto", ...extra }) : null;

  // BlurText: characters rise out of soft focus.
  const blurIn = (el, opts = {}) => {
    const s = split(el, "chars,words");
    gsap.set(el, { visibility: "visible" });
    if (!s) return gsap.from(el, { autoAlpha: 0, y: 24, duration: 0.9, ease: EASE, ...opts });
    return gsap.from(s.chars, {
      yPercent: 60, autoAlpha: 0, filter: "blur(10px)", duration: 1.1, ease: EASE,
      stagger: { each: 0.035 }, ...opts,
      onComplete: () => s.revert(),
    });
  };

  // Lines slide up from behind a mask.
  const lineReveal = (el, opts = {}) => {
    gsap.set(el, { visibility: "visible" });
    const s = el.querySelector(".desktop-break") ? null : split(el, "lines", { mask: "lines" });
    if (!s) return gsap.from(el, { autoAlpha: 0, y: 30, duration: 1, ease: EASE, ...opts });
    return gsap.from(s.lines, { yPercent: 105, duration: 1.1, ease: EASE, stagger: 0.12, ...opts, onComplete: () => s.revert() });
  };

  // CountUp, aware of "90 → 54" style figures: the second number travels from the first.
  const countUp = (strong, opts = {}) => {
    const nums = [];
    const walker = document.createTreeWalker(strong, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (/^\s*\d+(\.\d+)?\s*$/.test(n.nodeValue)) nums.push(n);
    }
    if (!nums.length) return null;
    strong.classList.add("tnum");
    const node = nums[nums.length - 1];
    const raw = node.nodeValue;
    const end = parseFloat(raw);
    const decimals = (raw.trim().split(".")[1] || "").length;
    const start = nums.length > 1 ? parseFloat(nums[0].nodeValue) : 0;
    const fmt = (v) => raw.replace(raw.trim(), v.toFixed(decimals));
    const o = { v: start };
    node.nodeValue = fmt(start);
    return gsap.to(o, {
      v: end, duration: 1.6, ease: "power2.out", ...opts,
      onUpdate: () => (node.nodeValue = fmt(o.v)),
      onComplete: () => (node.nodeValue = raw),
    });
  };

  const onEnter = (trigger, build, start = "top 80%") =>
    ScrollTrigger.create({ trigger, start, once: true, onEnter: () => build() });

  /* ---------- page curtain (between home and case studies) ---------- */
  const emblem = $(".brand-emblem svg");
  const makeCurtain = () => {
    const c = document.createElement("div");
    c.className = "page-curtain";
    c.setAttribute("aria-hidden", "true");
    if (emblem) c.appendChild(emblem.cloneNode(true));
    document.body.appendChild(c);
    return c;
  };
  if (root.classList.contains("curtain-in")) {
    const c = makeCurtain();
    root.classList.remove("curtain-in");
    gsap.to(c, { yPercent: -100, duration: 1, ease: TURN, delay: 0.15, onComplete: () => c.remove() });
    gsap.from($("svg", c), { rotation: -90, duration: 1, ease: TURN });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === "_blank" || a.hasAttribute("download") || a.closest(".site-switch")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname) return;
    const toWork = url.pathname.startsWith("/work/");
    const fromWork = location.pathname.startsWith("/work/");
    if (!toWork && !(fromWork && url.pathname === "/")) return;
    e.preventDefault();
    try { sessionStorage.setItem("curtain", "1"); } catch {}
    const c = makeCurtain();
    gsap.fromTo(c, { yPercent: 100 }, { yPercent: 0, duration: 0.7, ease: TURN, onComplete: () => (location.href = url.href) });
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) $$(".page-curtain").forEach((c) => c.remove());
  });

  /* ---------- header: progress hairline + tuck away on the way down ---------- */
  const header = $(".site-header");
  if (header) {
    const bar = document.createElement("span");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    header.appendChild(bar);
    gsap.to(bar, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
    const nav = document.getElementById("main-navigation");
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (self) => {
        const menuOpen = nav && nav.classList.contains("open");
        const focusInside = header.contains(document.activeElement) && document.activeElement.matches(":focus-visible");
        header.classList.toggle("is-tucked", self.direction === 1 && self.scroll() > 240 && !menuOpen && !focusInside);
      },
    });
  }

  /* ---------- everything that needs real font metrics ---------- */
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 900))]);

  fontsReady.then(() => {
    const mm = gsap.matchMedia();

    /* ===== HERO ===== */
    const hero = $(".folio-hero");
    if (hero) {
      const intro = $(".folio-intro", hero);
      const h1 = $("h1", intro);
      const tl = gsap.timeline({ defaults: { ease: EASE }, delay: 0.1 });
      const show = (els) => gsap.set(els, { visibility: "visible" });
      const top = $$(".folio-topline > *, .folio-bottomline > *", hero);
      show($$(".folio-topline, .folio-bottomline", hero));
      tl.from(top, { autoAlpha: 0, y: -10, duration: 0.8, stagger: 0.08 }, 0);

      const eyebrow = $(".eyebrow", intro);
      if (eyebrow) { show(eyebrow); tl.from(eyebrow, { autoAlpha: 0, letterSpacing: "0.5em", duration: 1.2 }, 0.1); }

      if (h1) {
        show(h1);
        const s = split(h1, "chars,words");
        if (s) {
          const italic = s.chars.filter((c) => c.closest("em"));
          const roman = s.chars.filter((c) => !c.closest("em"));
          tl.from(roman, { yPercent: 70, autoAlpha: 0, filter: "blur(12px)", duration: 1.2, stagger: 0.045 }, 0.2)
            .from(italic, { yPercent: 70, autoAlpha: 0, filter: "blur(12px)", rotation: 6, duration: 1.2, stagger: 0.03 }, 0.55)
            .add(() => s.revert());
        }
      }
      const rest = $$(":scope > *", intro).filter((el) => el !== h1 && el !== eyebrow);
      show(rest);
      const copy = rest.find((el) => el.tagName === "P" && !el.classList.contains("hero-status"));
      if (copy) tl.from(copy, { autoAlpha: 0, y: 26, filter: "blur(6px)", duration: 1.1, clearProps: "filter" }, 0.85);
      tl.from(rest.filter((el) => el !== copy && !el.classList.contains("hero-proof")), { autoAlpha: 0, y: 18, duration: 0.9, stagger: 0.1 }, 1.15);

      const proof = $$(".hero-proof > a", hero);
      if (proof.length) {
        tl.from(proof, { autoAlpha: 0, y: 22, duration: 0.9, stagger: 0.12 }, 1.35);
        proof.forEach((a, i) => { const st = $("strong", a); const t = st && countUp(st, { paused: true }); if (t) tl.add(t.play(), 1.45 + i * 0.12); });
      }

      // Cursor lamp over the hero world.
      const world = hero.closest(".hero-world") || hero;
      if (finePointer) {
        const lamp = document.createElement("div");
        lamp.className = "hero-lamp";
        lamp.setAttribute("aria-hidden", "true");
        world.appendChild(lamp);
        const lx = gsap.quickTo(lamp, "--lx", { duration: 0.6, ease: "power3" });
        const ly = gsap.quickTo(lamp, "--ly", { duration: 0.6, ease: "power3" });
        gsap.set(lamp, { "--lx": "70%", "--ly": "40%" });
        world.addEventListener("pointermove", (e) => {
          const r = world.getBoundingClientRect();
          lx(((e.clientX - r.left) / r.width) * 100 + "%");
          ly(((e.clientY - r.top) / r.height) * 100 + "%");
        });
      }

      // The instrument turns away as you scroll past it.
      mm.add("(min-width: 900px)", () => {
        const atlas = $(".project-atlas", hero);
        const intro2 = $(".folio-intro", hero);
        const exit = { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 };
        if (atlas) gsap.to(atlas, { rotation: -14, scale: 0.86, yPercent: -10, autoAlpha: 0.25, ease: "none", scrollTrigger: exit });
        if (intro2) gsap.to(intro2, { yPercent: -18, autoAlpha: 0.2, ease: "none", scrollTrigger: exit });
      });
    }

    /* ===== Section headings: the house style ===== */
    $$(".section-introduction h2, .folio-section-head h2, .collection-heading h2, #research-heading, .folio-about-copy h2").forEach((h) => {
      gsap.set(h, { visibility: "hidden" });
      onEnter(h, () => lineReveal(h));
    });
    $$(".section-introduction p, .collection-heading > p, .folio-research p:first-of-type").forEach((p) => {
      gsap.set(p, { autoAlpha: 0, y: 20 });
      onEnter(p, () => gsap.to(p, { autoAlpha: 1, y: 0, duration: 1, ease: EASE, delay: 0.25 }));
    });
    $$("main .eyebrow").filter((e) => !e.closest(".folio-hero")).forEach((e) => {
      gsap.set(e, { autoAlpha: 0, x: -12 });
      onEnter(e, () => gsap.to(e, { autoAlpha: 1, x: 0, duration: 0.9, ease: EASE }), "top 88%");
    });

    /* ===== Project chapters ===== */
    $$(".folio-project-copy").forEach((copy) => {
      const h3 = $("h3", copy);
      const premise = $(".folio-project-premise", copy);
      const others = $$(":scope > *", copy).filter((el) => el !== h3 && el !== premise && !el.classList.contains("eyebrow"));
      if (h3) gsap.set(h3, { visibility: "hidden" });
      if (premise) gsap.set(premise, { visibility: "hidden" });
      gsap.set(others, { autoAlpha: 0, y: 24 });
      onEnter(copy, () => {
        if (h3) blurIn(h3, { stagger: 0.03 });
        if (premise) lineReveal(premise, { delay: 0.35 });
        gsap.to(others, { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.08, delay: 0.5 });
      }, "top 75%");
    });

    /* ===== Plates: engraved illustrations draw themselves ===== */
    const drawPlate = (svg) => {
      const shapes = $$("path, line, polyline, circle, rect, ellipse, polygon", svg).filter((el) => !el.closest("defs, pattern"));
      const draw = [], fade = [];
      shapes.forEach((el) => {
        const cs = getComputedStyle(el);
        const dashed = cs.strokeDasharray && cs.strokeDasharray !== "none";
        if (hasDraw && cs.stroke !== "none" && cs.fill === "none" && !dashed) draw.push(el); else fade.push(el);
      });
      const texts = $$("text", svg);
      gsap.set(draw, { drawSVG: "0%" });
      gsap.set(fade, { autoAlpha: 0 });
      gsap.set(texts, { autoAlpha: 0, y: 6 });
      return () => {
        const tl = gsap.timeline();
        tl.to(draw, { drawSVG: "100%", duration: 1.5, ease: "power2.inOut", stagger: { amount: 1.1 } }, 0)
          .to(fade, { autoAlpha: 1, duration: 0.9, ease: "power1.out", stagger: { amount: 0.9 } }, 0.25)
          .to(texts, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE, stagger: 0.04 }, 0.9);
        return tl;
      };
    };

    $$(".folio-plate").forEach((svg) => {
      const play = drawPlate(svg);
      const label = svg.parentElement && $(".figure-label", svg.parentElement);
      if (label) gsap.set(label, { autoAlpha: 0 });
      onEnter(svg, () => {
        const tl = play();
        if (label) tl.to(label, { autoAlpha: 1, duration: 0.8 }, 1.4);
        // Plate-specific choreography after it is drawn.
        if (svg.classList.contains("runtime-plate")) {
          tl.from($$(".run-step", svg), { y: -14, autoAlpha: 0, duration: 0.7, ease: "back.out(1.6)", stagger: 0.18 }, 0.6);
        }
        if (svg.classList.contains("spotlight-plate")) {
          tl.from($$(".spot-marks > *", svg), { scale: 0, transformOrigin: "50% 50%", duration: 0.5, ease: "back.out(2)", stagger: 0.12 }, 1.1)
            .from($(".spot-routine", svg), { x: 30, autoAlpha: 0, duration: 0.9, ease: EASE }, 1.4);
        }
        if (svg.classList.contains("gateway-plate")) {
          const core = $(".gateway-core", svg);
          if (core) tl.add(() => gsap.to(core, { y: -6, duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1 }), 1.6);
        }
      }, "top 78%");
    });

    // A plate drifts slightly against its text (depth), desktop only.
    mm.add("(min-width: 900px)", () => {
      $$(".folio-plate").forEach((svg) =>
        gsap.fromTo(svg, { yPercent: 6 }, { yPercent: -6, ease: "none", scrollTrigger: { trigger: svg, start: "top bottom", end: "bottom top", scrub: 0.8 } }));

      // AsterDB: the storage layers separate like an exploded diagram as you read.
      const storage = $(".storage-plate");
      if (storage) {
        const layers = $$(".storage-layer", storage);
        if (layers.length === 3) {
          gsap.fromTo(layers[0], { y: 46 }, { y: -10, ease: "none", scrollTrigger: { trigger: storage, start: "top 85%", end: "center 35%", scrub: 0.8 } });
          gsap.fromTo(layers[2], { y: -46 }, { y: 10, ease: "none", scrollTrigger: { trigger: storage, start: "top 85%", end: "center 35%", scrub: 0.8 } });
        }
      }

      // Coloured worlds open like a page being turned toward you.
      $$(".folio-storage, .runtime-stage, .collection-world, .folio-contact").forEach((world) =>
        gsap.fromTo(world,
          { clipPath: "inset(7% 4% 0% 4% round 28px)" },
          { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none",
            scrollTrigger: { trigger: world, start: "top bottom", end: "clamp(top 35%)", scrub: 0.6 } }));
    });

    // AsterDB on small screens: still separate, but on enter.
    mm.add("(max-width: 899px)", () => {
      const layers = $$(".storage-plate .storage-layer");
      if (layers.length === 3) {
        gsap.set(layers[0], { y: 40 }); gsap.set(layers[2], { y: -40 });
        onEnter(".storage-plate", () => gsap.to([layers[0], layers[2]], { y: 0, duration: 1.4, ease: TURN, delay: 0.8 }));
      }
    });

    /* ===== Collection: rows arrive in reading order ===== */
    const rows = $$(".collection-row");
    if (rows.length) {
      gsap.set(rows, { autoAlpha: 0, y: 26 });
      ScrollTrigger.batch(rows, {
        start: "top 92%", once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.06, overwrite: true }),
      });
      $$(".collection-filters button, .collection-tools input").forEach((el) => {
        gsap.set(el, { autoAlpha: 0, y: 12 });
      });
      onEnter(".collection-tools", () => gsap.to($$(".collection-filters button, .collection-tools input"), { autoAlpha: 1, y: 0, stagger: 0.05, duration: 0.7, ease: EASE }), "top 90%");
      // Filtering or opening rows changes the page height.
      let t;
      const refresh = () => { clearTimeout(t); t = setTimeout(() => ScrollTrigger.refresh(), 120); };
      document.addEventListener("toggle", refresh, true);
      $$("[data-filter]").forEach((b) => b.addEventListener("click", () => { gsap.set(rows, { autoAlpha: 1, y: 0 }); refresh(); }));
      const search = document.getElementById("project-search");
      search && search.addEventListener("input", () => { gsap.set(rows, { autoAlpha: 1, y: 0 }); refresh(); });
    }

    /* ===== ScrollVelocity marquee (decorative) ===== */
    const collection = $(".collection-world");
    if (collection) {
      const words = ["Storage engines", "✦", "AI agents", "✦", "Developer tools", "✦", "Research", "✦"];
      const mq = document.createElement("div");
      mq.className = "m-marquee";
      mq.setAttribute("aria-hidden", "true");
      const row = () => `<div class="m-marquee-row">${words.map((w) => `<span>${w}</span>`).join("")}</div>`;
      mq.innerHTML = `<div class="m-marquee-track">${row()}${row()}</div>`;
      collection.appendChild(mq);
      const track = $(".m-marquee-track", mq);
      const half = () => track.scrollWidth / 2;
      let x = 0, skew = 0;
      const setX = gsap.quickSetter(track, "x", "px");
      const setSkew = gsap.quickSetter(track, "skewX", "deg");
      gsap.ticker.add((_, dt) => {
        const v = lenis ? lenis.velocity : 0;
        x -= (0.045 + Math.min(Math.abs(v), 60) * 0.012) * dt * (v < -0.5 ? -1 : 1);
        const w = half();
        if (w) { if (x <= -w) x += w; if (x > 0) x -= w; }
        skew += (gsap.utils.clamp(-8, 8, -v * 0.25) - skew) * 0.1;
        setX(x); setSkew(skew);
      });
    }

    /* ===== Experience ledger ===== */
    $$(".ledger-entry, .product-plate").forEach((entry) => {
      const parts = entry.classList.contains("ledger-entry") ? $$(".ledger-meta, .ledger-story > *", entry) : $$(":scope > *", entry);
      gsap.set(parts, { autoAlpha: 0, y: 24 });
      onEnter(entry, () => gsap.to(parts, { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.07 }), "top 78%");
      $$("svg", entry).forEach((svg) => {
        const play = drawPlate(svg);
        onEnter(entry, () => play(), "top 78%");
      });
    });

    /* ===== Gauges: every figure counts to its value ===== */
    $$(".research-figures strong, .ledger-results strong").forEach((st) => {
      const tween = countUp(st, { paused: true });
      if (tween) onEnter(st, () => tween.play(), "top 90%");
    });
    $$(".research-figures > div").forEach((d) => gsap.set(d, { autoAlpha: 0, y: 18 }));
    $$(".research-figures").forEach((f) =>
      onEnter(f, () => gsap.to($$(":scope > div", f), { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE, stagger: 0.12 }), "top 90%"));

    /* ===== Approach: the paragraph reads itself in (ScrollReveal) ===== */
    const about = $(".folio-about-copy > p");
    if (about && hasSplit) {
      const s = split(about, "words");
      gsap.fromTo(s.words, { opacity: 0.14 }, { opacity: 1, ease: "none", stagger: 0.05,
        scrollTrigger: { trigger: about, start: "top 82%", end: "bottom 45%", scrub: true } });
    }
    const ornament = $(".about-ornament svg");
    if (ornament) {
      // Nested frames turn at different rates: a tunnel into "what's underneath".
      const frames = $$("path", ornament);
      frames.forEach((p, i) => gsap.set(p, { transformOrigin: "50% 50%" }));
      gsap.fromTo(frames, { rotation: (i) => -(Math.floor(i / 2) * 2.2) }, {
        rotation: (i) => Math.floor(i / 2) * 2.2, ease: "none",
        scrollTrigger: { trigger: ornament, start: "top bottom", end: "bottom top", scrub: 1 },
      });
    }
    $$(".folio-about-copy > p:not(:first-of-type), .folio-credentials > div, .folio-tools p").forEach((el) => {
      gsap.set(el, { autoAlpha: 0, y: 22 });
      onEnter(el, () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 0.9, ease: EASE }), "top 88%");
    });

    /* ===== Contact: the closing line ===== */
    const contactH = $(".folio-contact-main h2");
    if (contactH) { gsap.set(contactH, { visibility: "hidden" }); onEnter(contactH, () => blurIn(contactH, { stagger: 0.025 }), "top 82%"); }
    const contactEmblem = $(".contact-emblem svg");
    if (contactEmblem) gsap.to(contactEmblem, { rotation: 180, ease: "none", scrollTrigger: { trigger: ".folio-contact", start: "top bottom", end: "bottom bottom", scrub: 1 } });
    $$(".folio-contact-main > div > *, .contact-links > *, .folio-colophon > *").forEach((el) => gsap.set(el, { autoAlpha: 0, y: 16 }));
    onEnter(".folio-contact-main", () => gsap.to($$(".folio-contact-main > div > *, .contact-links > *, .folio-colophon > *"), { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.06, delay: 0.4 }), "top 82%");

    /* ===== Case study pages ===== */
    const casePage = $(".case-page");
    if (casePage) {
      const h1 = $("h1", casePage);
      const tl = gsap.timeline({ delay: 0.25, defaults: { ease: EASE } });
      $$(".case-meta, .case-summary").forEach((el) => gsap.set(el, { visibility: "visible" }));
      if (h1) tl.add(blurIn(h1, { stagger: 0.03 }), 0);
      tl.from($$(".case-meta, .case-summary"), { autoAlpha: 0, y: 20, duration: 0.9, stagger: 0.1 }, 0.4);
      $$(".case-content h2").forEach((h) => { gsap.set(h, { visibility: "hidden" }); onEnter(h, () => lineReveal(h), "top 85%"); });
      $$(".case-content figure, .case-content svg, .case-explorer").forEach((el) => {
        if (el.closest("figure") && el.tagName === "svg") return;
        gsap.set(el, { autoAlpha: 0, y: 30 });
        onEnter(el, () => gsap.to(el, { autoAlpha: 1, y: 0, duration: 1, ease: EASE }), "top 85%");
      });
    }

    root.classList.remove("m");
    ScrollTrigger.refresh();
  });

  /* ---------- Magnet: calls to action lean toward the cursor ---------- */
  if (finePointer) {
    $$(".folio-cta, .contact-links .text-link, .site-header nav a:last-child, .folio-project-copy a").forEach((el) => {
      el.classList.add("m-magnet");
      const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener("pointerleave", () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)", overwrite: true });
      });
    });
  }

  /* ---------- ClickSpark: a bronze engraver's spark ---------- */
  const NS = "http://www.w3.org/2000/svg";
  document.addEventListener("click", (e) => {
    const hit = e.target.closest && e.target.closest(".folio-cta, .copy-email, .collection-filters button, .atlas-node, .hero-proof a");
    if (!hit || !e.clientX) return;
    const size = 70;
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "m-spark");
    svg.setAttribute("width", size); svg.setAttribute("height", size);
    svg.style.width = svg.style.height = size + "px";
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.style.left = e.clientX - size / 2 + "px";
    svg.style.top = e.clientY - size / 2 + "px";
    const lines = [];
    for (let i = 0; i < 8; i++) {
      const l = document.createElementNS(NS, "line");
      const a = (i / 8) * Math.PI * 2;
      const c = size / 2;
      l.setAttribute("x1", c + Math.cos(a) * 9); l.setAttribute("y1", c + Math.sin(a) * 9);
      l.setAttribute("x2", c + Math.cos(a) * 26); l.setAttribute("y2", c + Math.sin(a) * 26);
      l.setAttribute("stroke", "#d7ae78"); l.setAttribute("stroke-width", "1.2"); l.setAttribute("stroke-linecap", "round");
      svg.appendChild(l); lines.push(l);
    }
    document.body.appendChild(svg);
    if (hasDraw) {
      gsap.timeline({ onComplete: () => svg.remove() })
        .fromTo(lines, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.22, ease: "power2.out" })
        .to(lines, { drawSVG: "100% 100%", duration: 0.32, ease: "power2.in" });
    } else {
      gsap.fromTo(svg, { scale: 0.4, opacity: 1 }, { scale: 1.3, opacity: 0, duration: 0.5, onComplete: () => svg.remove() });
    }
  });
})();
