import pathlib
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).resolve().parent.parent / '.verify_out'
OUT.mkdir(parents=True, exist_ok=True)
URL = 'http://localhost:5178/'

errors = []
checks = []

def shot(pg, name):
    pg.screenshot(path=str(OUT / name), animations='disabled')

def log_check(name, ok, detail=''):
    checks.append((name, ok, detail))
    print(f'[{"PASS" if ok else "FAIL"}] {name} {detail}', flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch()

    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))

    page.goto(URL, wait_until='networkidle')
    page.wait_for_selector('#preloader.is-done', state='attached', timeout=10000)
    page.wait_for_timeout(300)

    # Sweep cursor across upper hero to verify live fluid steam/vapor reveal of cascading sprinkles
    for x, y in [(460, 400), (580, 320), (720, 290), (880, 330), (960, 410)]:
        page.mouse.move(x, y)
        page.wait_for_timeout(55)
    page.wait_for_timeout(140)
    shot(page, '01_hero_fluid.png')

    body_text = page.evaluate('document.body.innerText')
    log_check('Adapted cleanly to DONUT V (zero BOTTLE/KOVO)', ('DONUT V' in body_text) and ('BOTTLE' not in body_text) and ('KOVO' not in body_text))

    page.hover('.menu__group--02 .menu__name')
    page.wait_for_timeout(180)
    log_check('Header Coming Soon tooltip', page.locator('#soon-pill.is-visible').count() == 1)
    page.mouse.move(10, 10)

    def scroll_to_el(sel, ratio=0.0):
        page.evaluate('''([sel, ratio]) => {
            const el = document.querySelector(sel);
            const y = el.getBoundingClientRect().top + window.scrollY + (el.offsetHeight - window.innerHeight) * ratio;
            window.scrollTo(0, Math.max(0, y));
        }''', [sel, ratio])
        page.wait_for_timeout(240)

    scroll_to_el('.story__act1', 0.14)
    shot(page, '02_act1_strip.png')

    scroll_to_el('#story-act2', 0.45)
    shot(page, '03_act2_parting.png')

    scroll_to_el('#story-act3', 0.50)
    shot(page, '04_act3_torus_cad.png')

    scroll_to_el('#story-act4', 0.45)
    shot(page, '05_act4_spiral.png')

    scroll_to_el('#story-act56', 0.36)
    shot(page, '06_act5_card.png')
    page.click('[data-card-size="I"]')
    page.wait_for_timeout(120)
    log_check('Floating Card switches to DONUT V (I)', page.text_content('#card-title').strip() == 'DONUT V (I)')
    page.click('[data-card-size="III"]')

    scroll_to_el('#story-act56', 0.88)
    shot(page, '07_act6_blueprint.png')

    scroll_to_el('#collection', 0.0)
    shot(page, '08_collection.png')

    scroll_to_el('#studio', 0.0)
    shot(page, '09_studio_before.png')
    page.click('.studio__hit[data-tube="1"]')
    page.click('.studio__hit[data-tube="2"]')
    page.click('.studio__hit[data-tube="3"]')
    page.wait_for_timeout(320)
    log_check('Interactive Glaze Studio coats all 3 donuts', page.text_content('#studio-prompt').strip() == '3 / 3 GLAZED')
    shot(page, '10_studio_glazed.png')

    scroll_to_el('#footer', 0.0)
    page.wait_for_timeout(900)
    shot(page, '11_footer.png')

    page.evaluate('window.scrollTo(0, 0)')
    page.wait_for_timeout(180)
    page.click('#btn-store')
    page.wait_for_timeout(250)
    shot(page, '12_store_drawer.png')
    log_check('Store drawer opens', not page.locator('#store-drawer').is_hidden())

    page.click('.store-card--1')
    page.wait_for_timeout(300)
    log_check('PDP opens at /donut-v', '/donut-v' in page.url, page.url)
    page.click('.pdp__acc-btn >> nth=0')
    page.wait_for_timeout(150)
    shot(page, '13_pdp.png')

    page.click('.pdp__left [data-pdp-size="II"]')
    page.wait_for_timeout(200)
    log_check('PDP switches to (II) €10', page.text_content('#pdp-price').strip() == '€10')

    page.click('#pdp-add')
    page.wait_for_timeout(300)
    page.evaluate('Promise.all([...document.querySelectorAll("#cart-drawer img")].map(i => i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r })))')
    log_check('Add to Cart opens Cart drawer', not page.locator('#cart-drawer').is_hidden())
    shot(page, '14_cart.png')

    page.click('#btn-checkout')
    page.wait_for_timeout(250)
    log_check('Checkout opens at /checkout', '/checkout' in page.url, page.url)
    page.fill('#co-name', 'Elena Rossi')
    page.fill('#co-email', 'elena@atelier.example')
    page.click('#co-submit')
    page.wait_for_timeout(150)
    log_check('Morning batch form submits cleanly', 'Reserved for Elena Rossi' in page.text_content('#co-feedback'))
    shot(page, '15_checkout.png')

    page.click('#btn-about')
    page.wait_for_timeout(250)
    log_check('About modal opens at /about', '/about' in page.url, page.url)
    shot(page, '16_about.png')

    overflow_d = page.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth')
    log_check('Desktop zero horizontal overflow', not overflow_d)
    ctx.close()

    # Mobile 390x844
    mctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mpage = mctx.new_page()
    mpage.on('console', lambda m: errors.append(f'mob.console.{m.type}: {m.text}') if m.type == 'error' else None)
    mpage.on('pageerror', lambda e: errors.append(f'mob.pageerror: {e}'))

    mpage.goto(URL, wait_until='networkidle')
    mpage.wait_for_selector('#preloader.is-done', state='attached', timeout=10000)
    mpage.wait_for_timeout(250)
    shot(mpage, '17_mob_hero.png')
    overflow_m = mpage.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth')
    log_check('Mobile zero horizontal overflow', not overflow_m)
    mctx.close()
    browser.close()

print(f'\nConsole/Page Errors: {len(errors)}', flush=True)
for e in errors:
    print('  ERROR:', e, flush=True)
failed = [c for c in checks if not c[1]]
print(f'Summary: {len(checks) - len(failed)}/{len(checks)} checks passed.', flush=True)
if errors or failed:
    raise SystemExit(1)
