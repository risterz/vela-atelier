import pathlib, http.server, socketserver, threading, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'img'
OUT.mkdir(parents=True, exist_ok=True)

SHOTS = [
    ('hero-bare', 1600, 1200, False),
    ('hero-reveal', 1600, 1200, False),
    ('donut-34', 800, 1000, False),
    ('donut-front', 800, 1000, False),
    ('donut-above', 800, 1000, False),
    ('donut-top', 800, 1000, False),
    ('donut-ii', 800, 1000, False),
    ('donut-i', 800, 1000, False),
    ('thumb-i', 400, 400, False),
    ('thumb-ii', 400, 400, False),
    ('thumb-iii', 400, 400, False),
    ('collection-choux', 800, 1000, False),
    ('collection-canele', 800, 1000, False),
    ('editorial-dining', 800, 1000, False),
    ('editorial-study', 800, 1000, False),
    ('editorial-plinth', 800, 1000, False),
    ('editorial-dark', 800, 1000, False),
    ('editorial-close', 800, 1000, False),
    ('studio-horizon', 1600, 900, False),
    ('studio-glaze-1', 1600, 900, True),
    ('studio-glaze-2', 1600, 900, True),
    ('studio-glaze-3', 1600, 900, True),
    ('studio-bowl-1', 1600, 900, True),
    ('studio-bowl-2', 1600, 900, True),
    ('studio-bowl-3', 1600, 900, True),
]

only = set(sys.argv[1:])
selected = [s for s in SHOTS if (not only or s[0] in only)]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, format, *args):
        pass

with socketserver.TCPServer(('127.0.0.1', 0), QuietHandler) as httpd:
    port = httpd.server_address[1]
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()

    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
        ])
        page = browser.new_page(viewport={'width': 1600, 'height': 1200})
        page.on('pageerror', lambda e: print('PAGE ERROR:', e, flush=True))
        page.goto(f'http://127.0.0.1:{port}/scripts/studio-renderer.html', wait_until='networkidle')
        page.wait_for_function('typeof window.renderShot === "function"')

        for name, w, h, transparent in selected:
            page.set_viewport_size({'width': w, 'height': h})
            page.evaluate('([n, w, h]) => window.renderShot(n, w, h)', [name, w, h])
            dest = OUT / f'{name}.png'
            page.screenshot(path=str(dest), omit_background=transparent)
            print(f'Rendered {name}.png ({w}x{h}) -> {dest.stat().st_size} bytes', flush=True)
            if name == 'studio-bowl-3':
                boxes = page.evaluate('window.__studioBowlBoxes || null')
                print('STUDIO_BOWL_BOXES:', boxes, flush=True)

        browser.close()
    httpd.shutdown()
print('ALL DONUT STUDIO RENDERS COMPLETE', flush=True)
