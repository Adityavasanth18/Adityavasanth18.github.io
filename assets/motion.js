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

  /* ---------- the AD opening ---------- */
  // Plays once per browser session on the home page (the head script decides).
  const opening = root.classList.contains("intro");
  const killIntroCover = () => root.classList.remove("intro");
  const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—+";
  const scramble = (el, { duration = 0.8, delay = 0, text } = {}) => {
    const final = text != null ? text : el.textContent;
    if (el._scr) el._scr.kill();
    const o = { p: 0 };
    el._scr = gsap.to(o, {
      p: 1, duration, delay, ease: "none",
      onUpdate: () => {
        const n = Math.floor(o.p * final.length);
        let out = "";
        for (let i = 0; i < final.length; i++) {
          const ch = final[i];
          out += i < n || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
      },
      onComplete: () => (el.textContent = final),
    });
    return el._scr;
  };

  const runOpening = (charA, charD, onOpen) => {
    try { sessionStorage.setItem("ad-seen", "1"); } catch {}
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    if (lenis) lenis.stop();

    const vw = window.innerWidth, vh = window.innerHeight;
    const L = document.createElement("div");
    L.className = "ad-loader";
    L.setAttribute("aria-hidden", "true");
    // Dial ring: 120 engraved ticks that fill as the folio loads.
    let ticks = "";
    for (let i = 0; i < 120; i++) {
      const long = i % 10 === 0;
      ticks += `<path class="ad-tick" d="M200 ${long ? 14 : 20}V30" transform="rotate(${i * 3} 200 200)" stroke-width="${long ? 1.1 : 0.7}"/>`;
    }
    let petals = "";
    for (let i = 0; i < 6; i++) petals += `<ellipse cx="200" cy="200" rx="58" ry="150" transform="rotate(${i * 30} 200 200)"/>`;
    L.innerHTML = `
      <div class="ad-panel ad-panel-l"></div><div class="ad-panel ad-panel-r"></div>
      <div class="ad-stage"><svg class="ad-ring" viewBox="0 0 400 400">
        <g fill="none" stroke="#d7ae78">${ticks}
          <circle class="ad-c1" cx="200" cy="200" r="190" stroke-width=".6" opacity=".55"/>
          <circle class="ad-c2" cx="200" cy="200" r="162" stroke-width=".5" opacity=".35"/>
          <g class="ad-petals" stroke-width=".45" opacity=".22">${petals}</g>
        </g></svg></div>
      <span class="ad-meta ad-tl">Aditya Devarakonda</span>
      <span class="ad-meta ad-tr">A collection of work / 2026</span>
      <span class="ad-meta ad-bl"><b class="ad-count">000</b> Opening the folio</span>
      <span class="ad-meta ad-br">Systems · Agents · Developer tools</span>
      <span class="ad-progress"></span>`;
    document.body.appendChild(L);
    killIntroCover();

    // The two letters are real type, placed exactly where they will live in the
    // hero name, then transformed up to the centre as a monogram.
    const fly = (ch, cls) => {
      const r = ch.getBoundingClientRect();
      const cs = getComputedStyle(ch);
      const el = document.createElement("span");
      el.className = "ad-fly " + cls;
      el.textContent = ch.textContent;
      Object.assign(el.style, {
        left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px",
        lineHeight: r.height + "px", fontSize: cs.fontSize, fontStyle: cs.fontStyle, fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing, color: cs.color,
      });
      document.body.appendChild(el);
      return { el, r, fs: parseFloat(cs.fontSize) };
    };
    const A = fly(charA, "ad-a"), D = fly(charD, "ad-d");
    const size = Math.min(vh * 0.4, vw * 0.48);
    const sA = size / A.fs, sD = (size * 0.94) / D.fs;
    const cx = vw / 2, cy = vh / 2;
    const wA = A.r.width * sA, wD = D.r.width * sD;
    const startA = { x: cx - wA * 0.32 - (A.r.left + A.r.width / 2), y: cy - (A.r.top + A.r.height / 2), scale: sA };
    const startD = { x: cx + wD * 0.36 - (D.r.left + D.r.width / 2), y: cy + size * 0.06 - (D.r.top + D.r.height / 2), scale: sD };
    gsap.set(A.el, startA); gsap.set(D.el, { ...startD, rotation: 8 });

    const ring = $(".ad-ring", L), tickEls = $$(".ad-tick", L), count = $(".ad-count", L);
    const metas = $$(".ad-meta", L);
    const prog = { p: 0 };
    const paint = () => {
      const lit = Math.round(prog.p * tickEls.length);
      tickEls.forEach((t, i) => t.setAttribute("opacity", i < lit ? (i % 10 === 0 ? 1 : 0.75) : 0.12));
      count.textContent = String(Math.round(prog.p * 100)).padStart(3, "0");
      gsap.set($(".ad-progress", L), { scaleX: prog.p });
    };
    paint();

    const loaded = new Promise((r) => (document.readyState === "complete" ? r() : window.addEventListener("load", r, { once: true })));
    const tlIn = gsap.timeline({ defaults: { ease: EASE } });
    tlIn.from(ring, { scale: 0.84, rotation: -40, autoAlpha: 0, duration: 1.6, ease: TURN }, 0)
      .from($$(".ad-c1, .ad-c2, .ad-petals ellipse", L), { drawSVG: "0%", duration: 1.6, stagger: 0.06, ease: "power2.inOut" }, 0.1)
      .from(A.el, { autoAlpha: 0, yPercent: 26, filter: "blur(18px)", duration: 1.3 }, 0.25)
      .from(D.el, { autoAlpha: 0, yPercent: 26, rotation: 18, filter: "blur(18px)", duration: 1.3 }, 0.45)
      .add(() => gsap.set([A.el, D.el], { clearProps: "filter" }))
      .from(metas, { autoAlpha: 0, duration: 0.6, stagger: 0.08 }, 0.2)
      .add(() => metas.forEach((m, i) => { if (!m.querySelector("b")) scramble(m, { duration: 0.9, delay: i * 0.08 }); }), 0.2)
      .to(prog, { p: 0.86, duration: 1.7, ease: "power1.inOut", onUpdate: paint }, 0.15);
    // Slowly breathe while waiting, if the network is slow.
    gsap.to($(".ad-petals", L), { rotation: 30, transformOrigin: "50% 50%", duration: 12, ease: "none", repeat: -1 });

    // A click, key or scroll skips ahead.
    let skipped = false;
    const skip = () => { if (skipped) return; skipped = true; tlIn.timeScale(4); };
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach((t) => window.addEventListener(t, skip, { once: true, passive: true }));

    Promise.all([tlIn.then(), loaded]).then(() => {
      const out = gsap.timeline({ defaults: { ease: TURN } });
      out.to(prog, { p: 1, duration: 0.45, ease: "power2.out", onUpdate: paint })
        .add(() => scramble(count, { duration: 0.3, text: "100" }))
        .addLabel("open", "+=0.12")
        .to(metas, { autoAlpha: 0, y: (i) => (i < 2 ? -14 : 14), duration: 0.6, ease: "power2.in" }, "open")
        .to(ring, { scale: 1.9, rotation: 70, autoAlpha: 0, duration: 1.4 }, "open")
        .to($(".ad-progress", L), { autoAlpha: 0, duration: 0.4 }, "open")
        .to($(".ad-panel-l", L), { xPercent: -101, duration: 1.35 }, "open+=0.15")
        .to($(".ad-panel-r", L), { xPercent: 101, duration: 1.35 }, "open+=0.15")
        .to(A.el, { x: 0, y: 0, scale: 1, duration: 1.5 }, "open+=0.1")
        .to(D.el, { x: 0, y: 0, scale: 1, rotation: 0, duration: 1.5 }, "open+=0.18")
        .add(() => onOpen(), "open+=0.55")
        .add(() => {
          gsap.set([charA, charD], { autoAlpha: 1 });
          A.el.remove(); D.el.remove(); L.remove();
          if (lenis) lenis.start();
          document.dispatchEvent(new CustomEvent("folio:opened"));
        }, "open+=1.72");
    });
  };

  /* ---------- everything that needs real font metrics ---------- */
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 900))]);

  fontsReady.then(() => {
    const mm = gsap.matchMedia();

    /* ===== HERO (+ the AD opening on a first visit) ===== */
    const hero = $(".folio-hero");
    if (hero) {
      const intro = $(".folio-intro", hero);
      const h1 = $("h1", intro);
      const tl = gsap.timeline({ defaults: { ease: EASE }, paused: true });
      const show = (els) => gsap.set(els, { visibility: "visible" });
      const top = $$(".folio-topline > *, .folio-bottomline > *", hero);
      show($$(".folio-topline, .folio-bottomline", hero));
      tl.from(top, { autoAlpha: 0, y: -10, duration: 0.8, stagger: 0.08 }, 0);

      const eyebrow = $(".eyebrow", intro);
      if (eyebrow) { show(eyebrow); tl.from(eyebrow, { autoAlpha: 0, letterSpacing: "0.5em", duration: 1.2 }, 0.1); }

      let firstA = null, firstD = null, h1Split = null;
      if (h1) {
        show(h1);
        h1Split = split(h1, "chars,words");
        if (h1Split) {
          const italic = h1Split.chars.filter((c) => c.closest("em"));
          const roman = h1Split.chars.filter((c) => !c.closest("em"));
          if (opening) { firstA = roman.shift(); firstD = italic.shift(); gsap.set([firstA, firstD], { autoAlpha: 0 }); }
          tl.from(roman, { yPercent: 70, autoAlpha: 0, filter: "blur(12px)", duration: 1.2, stagger: 0.045 }, 0.2)
            .from(italic, { yPercent: 70, autoAlpha: 0, filter: "blur(12px)", rotation: 6, duration: 1.2, stagger: 0.03 }, 0.55);
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
      // The dial enters like an instrument being set down.
      const atlasWrap = $(".folio-atlas-wrap", hero);
      if (atlasWrap) tl.from(atlasWrap, { opacity: 0, scale: 0.92, rotation: -8, duration: 1.6, ease: TURN }, 0.1);

      /* Living type: after the intro, the name's letters lean toward the cursor. */
      const finishHero = () => {
        if (!h1Split) return;
        if (!finePointer) { h1Split.revert(); return; }
        const chars = h1Split.chars;
        gsap.set(chars, { clearProps: "filter,willChange" });
        const lifts = chars.map((c) => ({
          c, italic: !!c.closest("em"),
          y: gsap.quickTo(c, "y", { duration: 0.7, ease: "power3" }),
          r: gsap.quickTo(c, "rotation", { duration: 0.9, ease: "power3" }),
        }));
        let boxes = null;
        const measure = () => {
          const h = h1.getBoundingClientRect();
          boxes = chars.map((c) => { const r = c.getBoundingClientRect(); return [r.left - h.left + r.width / 2, r.top - h.top + r.height / 2]; });
        };
        window.addEventListener("resize", () => (boxes = null));
        const zone = hero.closest(".hero-world") || hero;
        zone.addEventListener("pointermove", (e) => {
          if (!boxes) measure();
          const h = h1.getBoundingClientRect();
          const px = e.clientX - h.left, py = e.clientY - h.top;
          lifts.forEach((l, i) => {
            const dx = px - boxes[i][0], dy = py - boxes[i][1];
            const f = Math.exp(-(dx * dx + dy * dy) / (2 * 85 * 85));
            l.y(-16 * f);
            l.r((l.italic ? -6 : -3) * f * Math.sign(dx || 1));
          });
        });
        zone.addEventListener("pointerleave", () => lifts.forEach((l) => { l.y(0); l.r(0); }));
      };
      tl.eventCallback("onComplete", finishHero);

      /* The engraved surface: live guilloché centred on the dial. */
      let engrave = null;
      const world0 = hero.closest(".hero-world") || hero;
      const dial = $(".project-atlas", hero);
      if (window.Guilloche && dial) {
        const cv = document.createElement("canvas");
        cv.className = "m-engrave";
        cv.setAttribute("aria-hidden", "true");
        world0.prepend(cv);
        engrave = window.Guilloche(cv, {
          center: () => {
            const w = world0.getBoundingClientRect(), d = dial.getBoundingClientRect();
            return [d.left - w.left + d.width / 2, d.top - w.top + d.height / 2];
          },
          scale: () => Math.max(dial.offsetWidth * 0.62, 260),
          reveal: 0, alpha: 0.2,
        });
        if (!engrave) cv.remove();
      }
      const revealEngrave = () => engrave && gsap.to(engrave.state, { reveal: 1, duration: 3.2, ease: "power2.out" });
      if (engrave) {
        world0.addEventListener("pointermove", (e) => {
          const r = world0.getBoundingClientRect();
          engrave.state.mouse = [e.clientX - r.left, e.clientY - r.top];
        });
        world0.addEventListener("pointerenter", () => gsap.to(engrave.state, { loupe: 1, duration: 0.8, ease: "power2.out" }));
        world0.addEventListener("pointerleave", () => gsap.to(engrave.state, { loupe: 0, duration: 1.2, ease: "power2.out" }));
        ScrollTrigger.create({
          trigger: world0, start: "top top", end: "bottom top",
          onUpdate: (self) => { engrave.state.scroll = self.progress; engrave.state.alpha = 0.2 * (1 - self.progress * 0.7); },
        });
      }

      if (opening && firstA && firstD) runOpening(firstA, firstD, () => { tl.play(); revealEngrave(); });
      else { killIntroCover(); tl.delay(0.1).play(); revealEngrave(); }

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
        // The dial tilts in your hand.
        const atlas = $(".project-atlas", hero);
        if (atlas) gsap.set(atlas, { transformPerspective: 1100 });
        const rx = atlas && gsap.quickTo(atlas, "rotationX", { duration: 0.9, ease: "power3" });
        const ry = atlas && gsap.quickTo(atlas, "rotationY", { duration: 0.9, ease: "power3" });
        world.addEventListener("pointermove", (e) => {
          const r = world.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
          lx(nx * 100 + "%"); ly(ny * 100 + "%");
          if (atlas) { ry((nx - 0.5) * 10); rx((0.5 - ny) * 8); }
        });
        world.addEventListener("pointerleave", () => { if (atlas) { rx(0); ry(0); } });
      }

      // The instrument turns away as you scroll past it.
      mm.add("(min-width: 900px)", () => {
        const atlas = $(".project-atlas", hero);
        const intro2 = $(".folio-intro", hero);
        const exit = { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6 };
        if (atlas) gsap.to(atlas, { rotation: -14, scale: 0.86, yPercent: -10, autoAlpha: 0.25, ease: "none", scrollTrigger: exit });
        if (intro2) gsap.to(intro2, { yPercent: -18, autoAlpha: 0.2, ease: "none", scrollTrigger: exit });
      });
    } else {
      killIntroCover();
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
      gsap.set(texts, { autoAlpha: 0 });
      return () => {
        const tl = gsap.timeline();
        tl.to(draw, { drawSVG: "100%", duration: 1.5, ease: "power2.inOut", stagger: { amount: 1.1 } }, 0)
          .to(fade, { autoAlpha: 1, duration: 0.9, ease: "power1.out", stagger: { amount: 0.9 } }, 0.25)
          .to(texts, { autoAlpha: 1, duration: 0.6, ease: EASE, stagger: 0.04 }, 0.9);
        return tl;
      };
    };

    $$(".folio-plate").forEach((svg) => {
      const play = drawPlate(svg);
      const label = svg.parentElement && $(".figure-label", svg.parentElement);
      if (label) gsap.set(label, { autoAlpha: 0 });
      onEnter(svg, () => {
        const tl = play();
        if (label) tl.to(label, { autoAlpha: 1, duration: 0.5 }, 1.4).add(() => scramble(label, { duration: 0.9 }), 1.4);
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

    /* ===== Collection: an engraved preview card follows the cursor ===== */
    const list = $(".collection-list");
    if (list && finePointer) {
      const peek = document.createElement("div");
      peek.className = "m-peek";
      peek.setAttribute("aria-hidden", "true");
      peek.innerHTML = '<div class="m-peek-top"><span class="m-peek-n"></span><span class="m-peek-cat"></span></div><div class="m-peek-icon"></div><div class="m-peek-name"></div><p class="m-peek-sum"></p><div class="m-peek-stack"></div>';
      document.body.appendChild(peek);
      const px = gsap.quickTo(peek, "x", { duration: 0.55, ease: "power3" });
      const py = gsap.quickTo(peek, "y", { duration: 0.55, ease: "power3" });
      const pr = gsap.quickTo(peek, "rotation", { duration: 0.8, ease: "power3" });
      gsap.set(peek, { autoAlpha: 0, scale: 0.85, xPercent: 0, yPercent: -50 });
      let lastX = 0, current = null, shown = false;
      const fill = (row) => {
        const q = (sel) => { const el = $(sel, row); return el ? el.textContent.trim() : ""; };
        $(".m-peek-n", peek).textContent = q(".collection-number");
        $(".m-peek-cat", peek).textContent = q(".collection-category");
        $(".m-peek-name", peek).textContent = q(".collection-name");
        $(".m-peek-sum", peek).textContent = q(".collection-summary");
        $(".m-peek-stack", peek).textContent = q(".collection-stack");
        const icon = $(".category-mark", row);
        $(".m-peek-icon", peek).replaceChildren(icon ? icon.cloneNode(true) : "");
      };
      const show = () => { if (!shown) { shown = true; gsap.to(peek, { autoAlpha: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)", overwrite: "auto" }); } };
      const hide = () => { if (shown) { shown = false; current = null; gsap.to(peek, { autoAlpha: 0, scale: 0.85, duration: 0.3, ease: "power2.in", overwrite: "auto" }); } };
      list.addEventListener("pointermove", (e) => {
        const row = e.target.closest(".collection-row");
        const onSummary = e.target.closest("summary");
        if (!row || !onSummary || row.open) return hide();
        if (row !== current) {
          current = row; fill(row);
          gsap.fromTo($$(".m-peek-icon, .m-peek-name, .m-peek-sum, .m-peek-stack", peek), { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.04, duration: 0.4, ease: EASE });
          scramble($(".m-peek-n", peek), { duration: 0.35 });
        }
        show();
        const right = e.clientX + 320 > window.innerWidth;
        px(right ? e.clientX - 330 : e.clientX + 48); py(e.clientY);
        pr(gsap.utils.clamp(-7, 7, (e.clientX - lastX) * 0.6));
        lastX = e.clientX;
      });
      list.addEventListener("pointerleave", hide);
      window.addEventListener("scroll", () => { if (shown && !list.matches(":hover")) hide(); }, { passive: true });
      list.addEventListener("click", hide);
    }

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

    /* ===== Decoding labels: mono captions type themselves in ===== */
    $$(".collection-heading .eyebrow, .folio-section-head .eyebrow, .section-introduction .eyebrow, .folio-about-copy > .eyebrow, .contact-prelude .eyebrow")
      .filter((el) => !el.children.length && el.textContent.trim().length < 60)
      .forEach((el) => onEnter(el, () => scramble(el, { duration: 0.9, delay: 0.1 }), "top 88%"));

    /* ===== Stacked chapters: each project slides over the last ===== */
    mm.add("(min-width: 1024px) and (min-height: 640px)", () => {
      const chapters = [$(".gateway-stage"), $(".folio-storage"), $(".runtime-stage")].filter(Boolean);
      const made = [];
      chapters.forEach((ch, i) => {
        gsap.set(ch, { position: "relative", zIndex: 2 + i });
        if (i === chapters.length - 1) return;
        const inner = $(":scope > article, :scope > .folio-storage-inner", ch) || ch.firstElementChild;
        const shade = document.createElement("div");
        shade.className = "m-shade";
        ch.appendChild(shade);
        made.push(shade);
        // Short chapters hold at the top; tall ones hold once fully read.
        const tall = () => ch.offsetHeight > window.innerHeight;
        const start = () => (tall() ? "bottom bottom" : "top top");
        // Hold exactly until the next card's top reaches the top of the screen.
        const end = () => "+=" + (tall() ? window.innerHeight : ch.offsetHeight);
        const range = { trigger: ch, start, end, scrub: true };
        const pinST = ScrollTrigger.create({ trigger: ch, start, end, pin: true, pinSpacing: false });
        // Keyboard users: a focused link must never sit under the next card.
        ch.addEventListener("focusin", () => {
          if (pinST.isActive && pinST.progress > 0.05) (lenis ? lenis.scrollTo(pinST.start, { immediate: true }) : window.scrollTo(0, pinST.start));
        });
        if (inner) gsap.to(inner, { scale: 0.9, yPercent: -4, transformOrigin: "50% 100%", ease: "none", scrollTrigger: range });
        gsap.to(shade, { opacity: 0.62, ease: "none", scrollTrigger: range });
      });
      return () => made.forEach((m) => m.remove());
    });

    /* ===== Plates tilt toward the cursor ===== */
    if (finePointer) {
      $$(".folio-plate").forEach((svg) => {
        const box = svg.parentElement;
        gsap.set(svg, { transformPerspective: 1200 });
        const rx = gsap.quickTo(svg, "rotationX", { duration: 0.8, ease: "power3" });
        const ry = gsap.quickTo(svg, "rotationY", { duration: 0.8, ease: "power3" });
        box.addEventListener("pointermove", (e) => {
          const r = box.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - 0.5) * 9);
          rx((0.5 - (e.clientY - r.top) / r.height) * 7);
        });
        box.addEventListener("pointerleave", () => { rx(0); ry(0); });
      });
    }

    /* ===== Folio index: the page number of the section you are reading ===== */
    if ($(".folio-hero")) {
      const idx = document.createElement("div");
      idx.className = "m-folio";
      idx.setAttribute("aria-hidden", "true");
      idx.innerHTML = '<span class="m-folio-n">00</span><span class="m-folio-bar"><i></i></span><span class="m-folio-t">Index</span>';
      document.body.appendChild(idx);
      const n = $(".m-folio-n", idx), t = $(".m-folio-t", idx);
      gsap.to($(".m-folio-bar i", idx), { scaleY: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });
      const map = [[".hero-world", "00", "Index"], ["#work", "01", "Selected work"], ["#spotlight", "+", "Now building"],
        ["#all-projects", "02", "Collection"], ["#experience", "03", "Experience"], ["#research", "04", "Research"],
        ["#approach", "05", "The person"], ["#contact", "06", "Contact"]];
      let current = "";
      map.forEach(([sel, num, label]) => {
        const sec = $(sel);
        if (!sec) return;
        ScrollTrigger.create({
          trigger: sec, start: "top 60%", end: "bottom 60%",
          onToggle: (self) => {
            if (!self.isActive || current === sel) return;
            current = sel;
            scramble(n, { duration: 0.4, text: num });
            scramble(t, { duration: 0.6, text: label });
          },
        });
      });
      const showIdx = () => gsap.to(idx, { opacity: 1, duration: 0.8, delay: 0.6 });
      if (opening) document.addEventListener("folio:opened", showIdx, { once: true }); else showIdx();
    }

    /* ===== Footer engraving: the same guilloché, quieter, under the name ===== */
    const contact = $(".folio-contact");
    if (contact && window.Guilloche) {
      const cv = document.createElement("canvas");
      cv.className = "m-engrave";
      cv.setAttribute("aria-hidden", "true");
      contact.prepend(cv);
      const g = window.Guilloche(cv, {
        center: () => [contact.clientWidth * 0.84, contact.clientHeight * 0.28],
        scale: () => Math.max(contact.clientWidth * 0.3, 240),
        reveal: 0, alpha: 0.14, maxDpr: 1.25,
      });
      if (!g) cv.remove();
      else {
        onEnter(contact, () => gsap.to(g.state, { reveal: 1, duration: 3, ease: "power2.out" }), "top 75%");
        contact.addEventListener("pointermove", (e) => { const r = contact.getBoundingClientRect(); g.state.mouse = [e.clientX - r.left, e.clientY - r.top]; });
        contact.addEventListener("pointerenter", () => gsap.to(g.state, { loupe: 1, duration: 0.8 }));
        contact.addEventListener("pointerleave", () => gsap.to(g.state, { loupe: 0, duration: 1.2 }));
      }
    }

    /* ===== Closing wordmark: the page ends where the opening began ===== */
    const colophon = $(".folio-colophon");
    if (colophon) {
      const wm = document.createElement("div");
      wm.className = "m-wordmark";
      wm.setAttribute("aria-hidden", "true");
      const word = (txt, tag) => `<${tag} class="m-wm-word">${[...txt].map((c) => `<span class="m-wm-ch">${c}</span>`).join("")}</${tag}>`;
      wm.innerHTML = word("Aditya", "span") + word("Devarakonda.", "em");
      colophon.before(wm);
      const chars = $$(".m-wm-ch", wm);
      gsap.set(chars, { yPercent: 110 });
      onEnter(wm, () => gsap.to(chars, { yPercent: 0, duration: 1.3, ease: TURN, stagger: { each: 0.035, from: "start" } }), "top 92%");
      gsap.fromTo(wm, { xPercent: 3 }, { xPercent: -3, ease: "none", scrollTrigger: { trigger: wm, start: "top bottom", end: "bottom top", scrub: 1 } });
    }

    root.classList.remove("m");
    ScrollTrigger.refresh();
  });

  /* ---------- Cursor: a bronze ring that knows what it is pointing at ---------- */
  if (finePointer) {
    const c = document.createElement("div");
    c.className = "m-cursor is-hidden";
    c.setAttribute("aria-hidden", "true");
    c.innerHTML = '<span class="m-cursor-follow"><span class="m-cursor-ring"><span class="m-cursor-label"></span></span></span><span class="m-cursor-dot"></span>';
    document.body.appendChild(c);
    root.classList.add("has-cursor");
    const follow = $(".m-cursor-follow", c), dot = $(".m-cursor-dot", c), label = $(".m-cursor-label", c);
    const fx = gsap.quickTo(follow, "x", { duration: 0.5, ease: "power3" }), fy = gsap.quickTo(follow, "y", { duration: 0.5, ease: "power3" });
    const dx = gsap.quickTo(dot, "x", { duration: 0.08 }), dy = gsap.quickTo(dot, "y", { duration: 0.08 });
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      c.classList.remove("is-hidden");
      fx(e.clientX); fy(e.clientY); dx(e.clientX); dy(e.clientY);
    }, { passive: true });
    document.addEventListener("pointerleave", () => c.classList.add("is-hidden"));
    window.addEventListener("pointerdown", () => c.classList.add("is-down"));
    window.addEventListener("pointerup", () => c.classList.remove("is-down"));
    const LABELS = [
      [".folio-project-copy a, .collection-row summary, a[href^='/work/']", "Open"],
      [".atlas-node", "Explore"], ["a[href^='mailto:']", "Write"], ["a[download]", "Save"],
      [".copy-email", "Copy"], ["a[href^='/essays/']", "Read"], ["a[target='_blank']", "Visit"],
    ];
    document.addEventListener("pointerover", (e) => {
      const el = e.target;
      let state = "", text = "";
      if (el.closest("input, textarea, [contenteditable]")) state = "is-text";
      else {
        for (const [sel, l] of LABELS) if (el.closest(sel)) { state = "is-label"; text = l; break; }
        if (!state && el.closest("a, button, summary, label, [role='button']")) state = "is-link";
      }
      c.classList.remove("is-link", "is-label", "is-text");
      if (state) c.classList.add(state);
      if (text && label.textContent !== text) label.textContent = text;
    });
  }

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
