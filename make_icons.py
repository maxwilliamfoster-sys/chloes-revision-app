"""One-off: draw the home-screen icons (pink tile, white book + star)."""
from PIL import Image, ImageDraw, ImageFont
import pathlib
out = pathlib.Path(__file__).parent / 'docs'
out.mkdir(exist_ok=True)
S = 1024
im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=230, fill=(255, 106, 180))
d.rounded_rectangle([0, S - 120, S - 1, S - 1], radius=0, fill=(219, 69, 149))
d.rounded_rectangle([0, 0, S - 1, S - 60], radius=230, fill=(255, 106, 180))
try:
    f = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 640)
except OSError:
    f = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 640)
d.text((S / 2, S / 2 - 40), 'C', font=f, fill='white', anchor='mm')
# little yellow star
import math
cx, cy, R, r = 760, 250, 120, 50
pts = [(cx + (R if i % 2 == 0 else r) * math.sin(i * math.pi / 5), cy - (R if i % 2 == 0 else r) * math.cos(i * math.pi / 5)) for i in range(10)]
d.polygon(pts, fill=(255, 200, 0))
for n in (180, 192, 512):
    t = im.resize((n, n), Image.LANCZOS)
    if n == 180:  # iOS wants no transparency
        bg = Image.new('RGB', (n, n), (255, 106, 180)); bg.paste(t, mask=t); t = bg
    t.save(out / f'icon-{n}.png')
print('icons done')
