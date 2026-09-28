"""Build Chloe's Revision into one self-contained page: docs/index.html (served by GitHub Pages)."""
import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
shell = (src / 'shell.html').read_text(encoding='utf8')
css = (src / 'app.css').read_text(encoding='utf8')
data = '\n'.join((src / f).read_text(encoding='utf8') for f in
                 ['d-kit.js', 'd-maths.js', 'd-englang.js', 'd-englit.js', 'd-hsc.js', 'd-hosp.js'])
app = (src / 'app.js').read_text(encoding='utf8')
frag = shell.replace('/*CSS*/', css).replace('/*DATA*/', data).replace('/*APP*/', app)
head = ('<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="apple-touch-icon" href="icon-180.png">\n'
        '<link rel="icon" type="image/png" href="icon-192.png">\n')
page = head + frag.replace('<header', '</head>\n<body>\n<header', 1) + '\n</body>\n</html>\n'
(root / 'docs').mkdir(exist_ok=True)
(root / 'docs' / 'index.html').write_text(page, encoding='utf8')
print('built docs/index.html', len(page) // 1024, 'KB')
