# Hero dial in 3D: short design

**Approved by Aditya on 2026-11-12.**

## Intent
Make the portfolio stand out to people hiring for backend, systems and AI
roles by turning the hero's flat project dial into a solid, lit 3D brass
instrument. It is the first thing a visitor sees.

## Goals
- The dial in the hero reads as a real metal object: depth, bevels, lighting.
- Same place, same size, same 23 projects, same selection behaviour
  (click, arrow keys, centre title, "open" link, sector arcs).
- It tilts toward the cursor and turns as the page scrolls.

## Non-goals
- No change to any other section, the text, the drawings, the essays page
  or the case-study pages.
- No model files, no React, no build step.

## Anti-goals (these would make it a failure)
- Any new colour. The palette is fixed: bronze `#d7ae78` / `#e0b87e` /
  `#c49a67`, dark ink `#1c1916` / `#221f1b` / `#2f2820` / `#49372a`,
  cream `#f0ddba`, plus the existing four patina category colours.
  Lights and materials are tinted only from these.
- A slower or broken hero on phones.
- Losing keyboard or screen-reader access to the project selector.

## Constraints
- Plain HTML/CSS/JS on GitHub Pages; libraries are vendored in
  `assets/vendor/` (as GSAP and Lenis are).
- The existing motion layer (`assets/motion.js`) already tilts and exits
  the dial; the 3D must cooperate with it, not fight it.

## Approaches considered
1. **Hero dial becomes a 3D instrument (chosen).** One signature moment,
   first screen, smallest footprint on the existing site.
2. Project drawings (AsterDB, AgentOps, Talvexis) become 3D models.
   Rejected: rewrites the drawings, against "keep the original intact".
3. Both. Rejected for the same reason.

## Design (builder's calls marked *call*)
- *call:* plain Three.js, vendored, loaded only when the 3D dial will run.
- *call:* geometry built in code: base plate, bevelled concentric rings,
  tick marks, rosette, a pointer for the selected project.
- *call:* the existing HTML project buttons and centre text stay as the
  real controls, layered over the 3D canvas. The flat SVG is hidden only
  once the 3D scene has rendered its first frame.
- **Fallback:** phones (coarse pointer or narrow screens), devices without
  WebGL2, and reduced-motion visitors keep today's flat dial untouched.
- The renderer pauses when the hero is off-screen.

## Delivery
Branch `dial-3d`. Preview video to Aditya before anything is merged; the
live site changes only on "ship it".
