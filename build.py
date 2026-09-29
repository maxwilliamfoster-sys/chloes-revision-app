"""Build Chloe's Revision into docs/ (served by GitHub Pages), plus the offline service worker."""
import hashlib, pathlib
root = pathlib.Path(__file__).parent
src, docs = root / 'src', root / 'docs'
shell = (src / 'shell.html').read_text(encoding='utf8')
css = (src / 'app.css').read_text(encoding='utf8')
data = '\n'.join((src / f).read_text(encoding='utf8') for f in
                 ['d-kit.js', 'd-maths.js', 'd-englang.js', 'd-englit.js', 'd-hsc.js', 'd-hosp.js', 'd-glossary.js'])
app = '\n'.join((src / f).read_text(encoding='utf8') for f in ['app.js', 'solver.js', 'assist.js'])
frag = shell.replace('/*CSS*/', css).replace('/*DATA*/', data).replace('/*APP*/', app)
head = ('<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="apple-touch-icon" href="icon-180.png">\n'
        '<link rel="icon" type="image/png" href="icon-192.png">\n')
page = head + frag.replace('<header', '</head>\n<body>\n<header', 1) + '\n</body>\n</html>\n'
docs.mkdir(exist_ok=True)
(docs / 'index.html').write_text(page, encoding='utf8')

# ---- service worker: everything needed offline ----
core = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'fonts/fonts.css'] + \
       sorted('fonts/' + p.name for p in (docs / 'fonts').glob('*.woff2'))
heavy = ['ai/webllm.js', 'ai/worker.js', 'ocr/esearch-ocr.js', 'ocr/ort.wasm.min.mjs', 'ocr/ort-wasm-simd-threaded.mjs',
         'ocr/ort-wasm-simd-threaded.wasm', 'ocr/pp/det.onnx', 'ocr/pp/rec.onnx', 'ocr/pp/dict.txt']
h = hashlib.sha1()
for f in core[1:] + heavy: h.update((docs / f).read_bytes())
ver = h.hexdigest()[:10]
sw = (src / 'sw.js').read_text(encoding='utf8').replace('__VERSION__', ver) \
    .replace('__CORE__', repr(core).replace("'", '"')).replace('__HEAVY__', repr(heavy).replace("'", '"'))
(docs / 'sw.js').write_text(sw, encoding='utf8')
print('built docs/index.html', len(page) // 1024, 'KB · sw', ver)
