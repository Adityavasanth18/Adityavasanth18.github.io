"""Browser checks for the 3D hero dial.  Usage: python3 tests/dial3d_check.py http://localhost:8811/ [case ...]"""
import asyncio, sys, io, json, colorsys
from playwright.async_api import async_playwright
from PIL import Image

BASE = sys.argv[1]
ONLY = set(sys.argv[2:])
ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
RESULTS = []
CASES = []

def case(fn):
    CASES.append(fn); return fn

def check(name, ok, detail=""):
    RESULTS.append(ok); print(("PASS " if ok else "FAIL ") + name + (("  -- " + str(detail)) if detail and not ok else ""))

async def open_page(b, w=1440, h=900, touch=False, reduced=False, dsf=0.5):  # 0.5: software GL in CI is slow
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch, device_scale_factor=dsf,
                              reduced_motion="reduce" if reduced else "no-preference")
    pg = await ctx.new_page()
    pg.errs, pg.reqs = [], []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    pg.on("console", lambda m: pg.errs.append(m.text) if m.type == "error" else None)
    pg.on("request", lambda r: pg.reqs.append(r.url))
    await pg.goto(BASE, wait_until="networkidle")
    return pg

async def state(pg, want=None, timeout=8000):
    if want:
        try: await pg.wait_for_function(f"window.__dial3d && window.__dial3d.state === '{want}'", timeout=timeout)
        except Exception: pass
    return await pg.evaluate("window.__dial3d ? window.__dial3d.state : null")

async def ready(b):
    pg = await open_page(b); await state(pg, "ready"); await pg.wait_for_timeout(4500); return pg

async def canvas_image(pg):
    box = await pg.evaluate("(()=>{const c=document.querySelector('.dial3d-canvas'); if(!c) return null; const r=c.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}})()")
    if not box or box["width"] < 2: return None, None
    png = await pg.screenshot(clip=box)
    return Image.open(io.BytesIO(png)).convert("RGB"), box

@case
async def desktop_ready(b):
    pg = await open_page(b); s = await state(pg, "ready")
    size = await pg.evaluate("(()=>{const c=document.querySelector('.dial3d-canvas'); return c?[c.clientWidth,c.clientHeight]:null})()")
    check("desktop_ready", s == "ready" and size and size[0] > 100 and not pg.errs, (s, size, pg.errs[:3]))

async def _fallback(b, name, **kw):
    pg = await open_page(b, **kw); s = await state(pg, "fallback", 6000)
    canvas = await pg.evaluate("!!document.querySelector('.dial3d-canvas')")
    cls = await pg.evaluate("!!document.querySelector('.has-dial3d')")
    three = [u for u in pg.reqs if "three." in u]
    check(name, s == "fallback" and not canvas and not cls and not three and not pg.errs, (s, canvas, cls, three, pg.errs[:3]))

@case
async def phone_fallback(b): await _fallback(b, "phone_fallback", w=390, h=844, touch=True)

@case
async def reduced_fallback(b): await _fallback(b, "reduced_fallback", reduced=True)

@case
async def controls_intact(b):
    pg = await ready(b)
    n = await pg.evaluate("document.querySelectorAll('[data-project-select]').length")
    before = await pg.inner_text(".atlas-project")
    await pg.focus(".atlas-node.selected"); await pg.keyboard.press("ArrowRight"); await pg.wait_for_timeout(300)
    after = await pg.inner_text(".atlas-project")
    check("controls_intact", n == 23 and before != after, (n, before, after))

@case
async def canvas_painted(b):
    pg = await ready(b); im, box = await canvas_image(pg)
    if not im: return check("canvas_painted", False, "no canvas")
    await pg.evaluate("document.querySelector('.dial3d-canvas').style.visibility='hidden'")
    bare = Image.open(io.BytesIO(await pg.screenshot(clip=box))).convert("RGB")
    w, h = im.size; pts = [(int(w*.5), int(h*.14)), (int(w*.2), int(h*.5)), (int(w*.72), int(h*.72))]
    diff = [sum(abs(a-c) for a, c in zip(im.getpixel(p), bare.getpixel(p))) for p in pts]
    check("canvas_painted", all(d > 12 for d in diff), diff)

@case
async def palette_only(b):
    """Every painted canvas pixel is a shade of the site's own palette: bronze/cream/ink hues, or a patina accent."""
    pg = await ready(b); im, box = await canvas_image(pg)
    if not im: return check("palette_only", False, "no canvas")
    await pg.evaluate("document.querySelectorAll('.project-atlas > *, .m-engrave, .hero-lamp').forEach(e => e.style.visibility='hidden')")
    im = Image.open(io.BytesIO(await pg.screenshot(clip=box))).convert("RGB")
    await pg.evaluate("document.querySelector('.dial3d-canvas').style.visibility='hidden'")
    bare = Image.open(io.BytesIO(await pg.screenshot(clip=box))).convert("RGB")
    w, h = im.size; bad = []; painted = 0
    for i in range(60):
        for j in range(60):
            p = (int((i + .5) * w / 60), int((j + .5) * h / 60))
            r, g, bl = im.getpixel(p)
            if sum(abs(a - c) for a, c in zip((r, g, bl), bare.getpixel(p))) < 10: continue
            painted += 1
            hue, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, bl / 255); hue *= 360
            if sat < 0.12 or val < 0.08 or 15 <= hue <= 50 or 130 <= hue <= 152: continue
            bad.append((p, (r, g, bl)))
    check("palette_only", painted > 800 and not bad, (painted, bad[:5]))

DBG = "window.__dial3d.debug"
ATLAS = "document.querySelector('.project-atlas')"

@case
async def tilt_follows(b):
    pg = await ready(b)
    hb = await pg.evaluate("(()=>{const r=document.querySelector('.hero-world, .folio-hero').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
    vals = []
    for fx, fy in [(.05, .2), (.95, .8)]:
        await pg.mouse.move(hb[0] + hb[2] * fx, min(hb[1] + hb[3] * fy, 860), steps=8); await pg.wait_for_timeout(1500)
        vals.append(await pg.evaluate(f"[{DBG}.rotY, gsap.getProperty({ATLAS},'rotationY')]"))
    ok = vals[0][0] * vals[1][0] < 0 and all(abs(a - c) < 0.01 for a, c in vals) and abs(vals[1][0]) > 6
    check("tilt_follows", ok, vals)

@case
async def select_follows(b):
    pg = await ready(b)
    await pg.locator("[data-project-select]").nth(9).click(); await pg.wait_for_timeout(400)
    check("select_follows", await pg.evaluate(f"{DBG}.selected") == 9, await pg.evaluate(f"{DBG}.selected"))

@case
async def pauses_offscreen(b):
    pg = await ready(b)
    f0 = await pg.evaluate(f"{DBG}.frames"); await pg.mouse.move(900, 300, steps=5); await pg.mouse.move(1100, 500, steps=5); await pg.wait_for_timeout(600); f1 = await pg.evaluate(f"{DBG}.frames")
    await pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)"); await pg.wait_for_timeout(1500)
    f2 = await pg.evaluate(f"{DBG}.frames"); await pg.evaluate("document.querySelector('[data-project-select]:nth-child(5)').click()"); await pg.wait_for_timeout(900); f3 = await pg.evaluate(f"{DBG}.frames")
    check("pauses_offscreen", f1 > f0 and f3 == f2, (f0, f1, f2, f3))

@case
async def resize_fallback(b):
    pg = await ready(b)
    await pg.set_viewport_size({"width": 800, "height": 900}); await pg.wait_for_timeout(700)
    small = await pg.evaluate("[!!document.querySelector('.has-dial3d'), getComputedStyle(document.querySelector('.dial3d-canvas')).display, window.__dial3d.state]")
    await pg.set_viewport_size({"width": 1440, "height": 900}); await pg.wait_for_timeout(1200)
    big = await pg.evaluate("[!!document.querySelector('.has-dial3d'), getComputedStyle(document.querySelector('.dial3d-canvas')).display, window.__dial3d.state]")
    check("resize_fallback", small == [False, "none", "fallback"] and big == [True, "block", "ready"] and not pg.errs, (small, big, pg.errs[:2]))

@case
async def context_lost(b):
    pg = await ready(b)
    await pg.evaluate("document.querySelector('.dial3d-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    await pg.wait_for_timeout(600)
    r = await pg.evaluate("[window.__dial3d.state, !!document.querySelector('.has-dial3d'), !!document.querySelector('.dial3d-canvas')]")
    flat = await pg.evaluate("getComputedStyle(document.querySelector('.atlas-geometry circle')).display")
    check("context_lost", r == ["fallback", False, False] and flat != "none", (r, flat))

@case
async def studs_registered(b):
    """At full tilt, the 3D collars sit exactly under their HTML buttons."""
    pg = await ready(b)
    hb = await pg.evaluate("(()=>{const r=document.querySelector('.hero-world, .folio-hero').getBoundingClientRect();return [r.x,r.y,r.width,r.height]})()")
    await pg.mouse.move(hb[0] + hb[2] * .97, hb[1] + min(hb[3], 800) * .12, steps=6); await pg.wait_for_timeout(2500)
    worst = 0; out = []
    for i in (0, 6, 12, 17):
        a = await pg.evaluate(f"{DBG}.studScreen({i})")
        c = await pg.evaluate(f"(()=>{{const r=document.querySelectorAll('[data-project-select]')[{i}].getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]}})()")
        d = ((a[0]-c[0])**2 + (a[1]-c[1])**2) ** .5; worst = max(worst, d); out.append((i, round(d, 2)))
    tilt = await pg.evaluate(f"[gsap.getProperty({ATLAS},'rotationX'), gsap.getProperty({ATLAS},'rotationY')]")
    check("studs_registered", worst < 2 and abs(tilt[1]) > 6, (out, tilt))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome", args=ARGS)
        for fn in CASES:
            if ONLY and fn.__name__ not in ONLY: continue
            try: await fn(b)
            except Exception as e: check(fn.__name__, False, repr(e)[:300])
        await b.close()
    sys.exit(0 if RESULTS and all(RESULTS) else 1)

if __name__ == "__main__":
    asyncio.run(main())
