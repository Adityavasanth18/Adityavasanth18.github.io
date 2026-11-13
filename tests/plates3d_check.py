"""3D project models: each replaces its flat drawing on capable desktops, in that drawing's own colours.  Usage: python3 tests/plates3d_check.py http://localhost:8811/"""
import asyncio, sys, colorsys, re
from playwright.async_api import async_playwright
BASE = sys.argv[1]; R = []
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
PLATES = ["storage", "runtime", "gateway", "ornament"]
def check(name, ok, detail=""):
    R.append(ok); print(("PASS " if ok else "FAIL ") + name + (("  -- " + str(detail)[:400]) if not ok else ""), flush=True)

SAMPLE = r"""(key) => { const host = document.querySelector(`[data-plate3d="${key}"]`); if (!host) return null;
  const c = host.querySelector('canvas.plate3d-canvas'); if (!c || !c.width) return {canvas: false};
  const svg = host.querySelector('svg'); const src = new Set();
  svg.querySelectorAll('*').forEach(e => ['fill','stroke'].forEach(a => { const v = e.getAttribute(a); if (v && v[0] === '#') src.add(v) }));
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const px = [];
  for (let y = 4; y < c.height; y += Math.ceil(c.height / 48)) for (let x = 4; x < c.width; x += Math.ceil(c.width / 48)) { const i = (y * c.width + x) * 4; if (d[i + 3] > 250) px.push([d[i], d[i + 1], d[i + 2]]) }
  return {canvas: true, cls: host.classList.contains('has-plate3d'), src: [...src], px, flat: [...svg.querySelectorAll(':scope > :not(defs):not(.plate-label)')].every(e => getComputedStyle(e).opacity === '0') ? 'hidden' : 'visible' } }"""

def hue(rgb):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb)); return h * 360, s, v

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", args=ARGS)
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=0.5)
        pg = await ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/dial3d.js*", lambda r: r.abort())   # keep software GL free for the plates
        await pg.goto(BASE, wait_until="load")
        try: await pg.wait_for_function("window.__plates3d && window.__plates3d.state === 'ready'", timeout=12000)
        except Exception: pass
        st = await pg.evaluate("window.__plates3d || null")
        check("desktop_ready", bool(st) and st.get("state") == "ready" and st.get("count") == 4 and not errs, (st, errs[:2]))
        gl = await pg.evaluate("[...document.querySelectorAll('canvas')].filter(c => c.classList.contains('plate3d-canvas')).length")
        check("four_canvases", gl == 4, gl)
        for key in PLATES:
            await pg.evaluate(f"document.querySelector('[data-plate3d=\"{key}\"]')?.scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(3500)
            s = await pg.evaluate(SAMPLE, key)
            if not s or not s.get("canvas"): check(f"{key}_painted", False, s); check(f"{key}_palette", False, "no canvas"); continue
            check(f"{key}_painted", s["cls"] and len(s["px"]) > 120 and s["flat"] == "hidden", (s["cls"], len(s["px"]), s["flat"]))
            hues = [hue(tuple(int(c[i:i+2], 16) for i in (1, 3, 5)))[0] for c in s["src"] if len(c) == 7]
            bad = []
            for rgb in s["px"]:
                h, sat, v = hue(rgb)
                if sat < 0.10 or v < 0.10: continue
                if min(min(abs(h - x), 360 - abs(h - x)) for x in hues) > 14: bad.append(rgb)
            check(f"{key}_palette", len(bad) <= len(s["px"]) * 0.01, (len(bad), len(s["px"]), bad[:4]))
        check("no_errors", not errs, errs[:3])
        for name, kw in [("phone", dict(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)), ("reduced_motion", dict(viewport={"width": 1440, "height": 900}, reduced_motion="reduce"))]:
            c2 = await b.new_context(**kw); p2 = await c2.new_page(); reqs = []
            p2.on("request", lambda r: reqs.append(r.url))
            await p2.goto(BASE, wait_until="load"); await p2.wait_for_timeout(2500)
            r = await p2.evaluate("[window.__plates3d && window.__plates3d.state, document.querySelectorAll('.plate3d-canvas').length, document.querySelectorAll('.has-plate3d').length]")
            check(f"{name}_keeps_flat_drawings", r == ["fallback", 0, 0] and not [u for u in reqs if "three." in u], (r, [u for u in reqs if "three." in u]))
        await b.close()
    sys.exit(0 if all(R) else 1)
asyncio.run(main())
