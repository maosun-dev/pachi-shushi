# Draws the app icon: one slot reel stopped on "1" (one tap), with the plus (green) and
# minus (red) of the balance rolling away above and below it, and payline markers on "1".
# Colors and the Mincho numerals are the app's own (pachi-shushi.html).
# Output: tools/app/ios-icon-1024.png (1024x1024 RGB, no transparency), then run
#   powershell -ExecutionPolicy Bypass -File tools\app\make-ios-assets.ps1
# Usage: python tools/app/make-icon.py   (needs Pillow and numpy)
# Font: Shippori Mincho ExtraBold, only "1+−" (SIL Open Font License), next to this script.
from math import asin, pi
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
SIZE, S = 1024, 4                     # draw at 4x and shrink, for clean edges
W = SIZE * S

INK = (26, 26, 26)                    # --ink
PAPER = (255, 255, 255)               # --bg
PLUS = (29, 107, 74)                  # --plus
MINUS = (168, 38, 44)                 # --minus
BEZEL = (52, 52, 52)

# reel window (1024 scale)
WX0, WY0, WX1, WY1 = 176, 128, 848, 896
WR = 26                               # window corner radius
PITCH = 500                           # distance between symbols on the reel strip
FONT = HERE / 'ShipporiMincho-ExtraBold-icon.ttf'


def s(v):
    return round(v * S)


def strip(width, half):
    """The flat reel strip: '+' above, '1' in the middle, '−' below. Centre row = half."""
    img = Image.new('RGB', (width, 2 * half), PAPER)
    d = ImageDraw.Draw(img)

    def put(ch, size, color, offset, nudge_x=0):
        f = ImageFont.truetype(str(FONT), s(size))
        l, t, r, b = d.textbbox((0, 0), ch, font=f)
        d.text((width / 2 - (l + r) / 2 + s(nudge_x), half + s(offset) - (t + b) / 2), ch, font=f, fill=color)

    put('1', 620, INK, 0, nudge_x=-6)          # optical nudge: the flag makes "1" look right-heavy
    put('+', 520, PLUS, -PITCH)
    put('−', 520, MINUS, PITCH)
    return img


def reel():
    """Wrap the strip onto a cylinder: rows squeeze and darken toward the top and bottom."""
    w, h = s(WX1 - WX0), s(WY1 - WY0)
    radius = h / 2 * 1.02
    half = int(radius * pi / 2) + 2
    flat = np.asarray(strip(w, half), dtype=np.float32)
    out = np.empty((h, w, 3), dtype=np.float32)
    for y in range(h):
        k = (y + 0.5 - h / 2) / radius               # -1 .. 1 across the window
        theta = asin(max(-1.0, min(1.0, k)))
        row = flat[min(2 * half - 1, max(0, int(half + radius * theta)))]
        light = 0.5 + 0.5 * (1 - k * k) ** 0.8      # cylinder shading
        out[y] = row * light
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def main():
    img = Image.new('RGB', (W, W), INK)
    d = ImageDraw.Draw(img)

    # bezel just outside the window
    b = 10
    d.rounded_rectangle((s(WX0 - b), s(WY0 - b), s(WX1 + b), s(WY1 + b)), radius=s(WR + b), fill=BEZEL)

    # reel, clipped to the rounded window
    mask = Image.new('L', (s(WX1 - WX0), s(WY1 - WY0)), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, mask.width - 1, mask.height - 1), radius=s(WR), fill=255)
    img.paste(reel(), (s(WX0), s(WY0)), mask)

    # payline markers pointing at "1"
    cy, tw, th = 512, 58, 44          # centre, depth, half-height
    gap = 18                          # space between marker tip and bezel
    lx = WX0 - b - gap
    d.polygon([(s(lx - tw), s(cy - th)), (s(lx), s(cy)), (s(lx - tw), s(cy + th))], fill=PLUS)
    rx = WX1 + b + gap
    d.polygon([(s(rx + tw), s(cy - th)), (s(rx), s(cy)), (s(rx + tw), s(cy + th))], fill=PLUS)

    img.resize((SIZE, SIZE), Image.LANCZOS).save(HERE / 'ios-icon-1024.png')
    print('wrote', HERE / 'ios-icon-1024.png')


if __name__ == '__main__':
    main()
