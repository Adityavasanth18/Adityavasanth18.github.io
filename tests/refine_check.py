"""Pass 1 checks: structure, named featured projects, readable type, phone header.  Usage: python3 tests/refine_check.py http://localhost:8811/"""
import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1]; R = []
def check(name, ok, detail=""):
    R.append(ok); print(("PASS " if ok else "FAIL ") + name + (("  -- " + str(detail)[:500]) if not ok else ""))

SMALL = r"""(floor) => { const bad = {}; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
 while (w.nextNode()) { const n = w.currentNode; if (!n.nodeValue.trim()) continue; const el = n.parentElement;
  if (el.closest('[aria-hidden=true], script, style, noscript, svg, sup, sub')) continue; if (!el.getClientRects().length) continue;
  const fs = parseFloat(getComputedStyle(el).fontSize); if (fs >= floor || fs === 0) continue;  /* 0 = visually hidden label on an icon button */
  let h = el; while (h && !h.className.toString().trim()) h = h.parentElement;
  bad[(h ? '.' + h.className.toString().trim().split(/\s+/)[0] : el.tagName) + ' ' + fs] = 1 }
 return Object.keys(bad) }"""

async def page(b, w, h, touch=False):
    ctx = await b.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch, reduced_motion="reduce")
    pg = await ctx.new_page(); pg.errs = []
    pg.on("pageerror", lambda e: pg.errs.append(str(e)))
    await pg.goto(BASE, wait_until="load"); await pg.wait_for_timeout(900); return pg

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome")
        pg = await page(b, 1440, 900)
        order = await pg.evaluate("['#work','#spotlight','#experience','#research','#all-projects','#approach','#contact'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY))")
        check("experience_before_archive", order == sorted(order), order)
        nav = await pg.evaluate("[...document.querySelectorAll('#main-navigation a')].map(a => a.getAttribute('href'))")
        check("nav_matches_order", nav == ['/#work', '/#experience', '/#research', '/#all-projects', '/#contact'], nav)
        got = []
        for slug, name in [("asterdb", "AsterDB"), ("talvexis-browser", "Talvexis Browser"), ("agentops-studio", "AgentOps Studio"), ("apeironcode", "ApeironCode")]:
            await pg.click(f".atlas-featured [data-feature='{slug}']"); await pg.wait_for_timeout(150)
            got.append((await pg.inner_text(".atlas-project"), await pg.get_attribute(f".atlas-featured [data-feature='{slug}']", "aria-pressed")))
        check("featured_selects_project", got == [("AsterDB", "true"), ("Talvexis Browser", "true"), ("AgentOps Studio", "true"), ("ApeironCode", "true")], got)
        await pg.locator("[data-project-select]").nth(5).click(); await pg.wait_for_timeout(150)
        pressed = await pg.evaluate("[...document.querySelectorAll('.atlas-featured [aria-pressed=true]')].length")
        check("featured_clears_for_other_projects", pressed == 0, pressed)
        check("hero_has_resume", await pg.locator(".folio-hero-actions a[download]").count() == 1)
        check("desktop_type_floor_12", (s := await pg.evaluate(SMALL, 12)) == [], s)
        check("no_numbered_eyebrows", await pg.evaluate("[...document.querySelectorAll('.eyebrow')].filter(e => /^0\\d \\//.test(e.textContent)).length") == 0)
        fav = await pg.request.get(BASE + "assets/favicon.svg"); check("favicon_is_monogram", fav.ok and "mask" in await fav.text())
        check("no_errors_desktop", not pg.errs, pg.errs)
        for w in (360, 390, 430):
            ph = await page(b, w, 800, touch=True)
            m = await ph.evaluate("(()=>{const r=document.querySelector('.menu-toggle').getBoundingClientRect(); const s=document.querySelector('.site-switch').getBoundingClientRect(); const wm=document.querySelector('.wordmark').getBoundingClientRect(); return {right:r.right,w:r.width,h:r.height,gapL:r.left-s.right,gapW:s.left-wm.right,over:document.documentElement.scrollWidth-innerWidth}})()")
            check(f"phone_header_{w}", m["right"] <= w - 14 and m["w"] >= 44 and m["h"] >= 44 and m["gapL"] >= 8 and m["gapW"] >= 8 and m["over"] <= 0, m)
            if w == 390:
                hs = await ph.evaluate("[...document.querySelectorAll('.atlas-featured button')].map(b => Math.round(b.getBoundingClientRect().height))")
                check("phone_featured_targets_44", len(hs) == 4 and min(hs) >= 44, hs)
                check("phone_type_floor_12", (s := await ph.evaluate(SMALL, 12)) == [], s)
        await b.close()
    sys.exit(0 if all(R) else 1)
asyncio.run(main())
