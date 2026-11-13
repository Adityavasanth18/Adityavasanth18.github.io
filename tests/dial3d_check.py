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

async def open_page(b, w=1440, h=900, touch=False, reduced=False):
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch,
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
    pg = await open_page(b); await state(pg, "ready"); await pg.wait_for_timeout(3500); return pg

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
