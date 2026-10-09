# Draws the app icon: a large "1" (one tap) with tap ripples in the app's "plus" green.
# Design notes: tools/app/icon-design.md
# Output: tools/app/ios-icon-1024.png (1024x1024 RGB, no transparency), then run
#   powershell -ExecutionPolicy Bypass -File tools\app\make-ios-assets.ps1
# Usage: python tools/app/make-icon.py
# Font: Gloock (SIL Open Font License), copied next to this script.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
SIZE, S = 1024, 4               # draw at 4x and shrink, for clean edges
W = SIZE * S

BG_IN, BG_OUT = (18, 38, 29), (9, 11, 10)
GREEN = (92, 199, 154)          # --plus in dark mode
INK = (244, 243, 238)

CX, CY = W // 2, int(W * 0.5)
RINGS = [  # radius, stroke, opacity  (at 1024 scale)
    (352, 22, 1.00),
    (420, 14, 0.50),
    (474, 9, 0.22),
]


def radial_bg():
    small = Image.new('RGB', (256, 256))
    px = small.load()
    for y in range(256):
        for x in range(256):
            d = min(1.0, (((x - 128) ** 2 + (y - 128) ** 2) ** 0.5) / 181)
            t = d ** 1.4
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(BG_IN, BG_OUT))
    return small.resize((W, W), Image.BICUBIC)


def main():
    img = radial_bg()

    # ripples
    layer = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for r, stroke, a in RINGS:
        r, stroke = r * S, stroke * S
        d.ellipse((CX - r, CY - r, CX + r, CY + r), outline=GREEN + (round(255 * a),), width=stroke)
    img.paste(layer, (0, 0), layer)

    # soft glow where the tap lands
    glow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    gr = 290 * S
    ImageDraw.Draw(glow).ellipse((CX - gr, CY - gr, CX + gr, CY + gr), fill=GREEN + (70,))
    glow = glow.filter(ImageFilter.GaussianBlur(90 * S))
    img.paste(glow, (0, 0), glow)

    # the "1"
    font = ImageFont.truetype(str(HERE / 'Gloock-Regular.ttf'), 760 * S)
    td = ImageDraw.Draw(img)
    l, t, r, b = td.textbbox((0, 0), '1', font=font)
    x = CX - (l + r) / 2 - 8 * S       # optical nudge: the flag makes the figure look right-heavy
    y = CY - (t + b) / 2
    td.text((x, y), '1', font=font, fill=INK)

    out = img.resize((SIZE, SIZE), Image.LANCZOS).convert('RGB')
    out.save(HERE / 'ios-icon-1024.png')
    print('wrote', HERE / 'ios-icon-1024.png')


if __name__ == '__main__':
    main()
