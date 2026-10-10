# Draws the app icon: "ワンタップ" over "収支" as one lockup, white on a deep green, and the
# semi-voiced mark of プ (゜) turned into a fingertip tap with ripples spreading from it.
# Design notes: tools/app/icon-design.md
# Output: tools/app/ios-icon-1024.png (1024x1024 RGB, no transparency), then run
#   powershell -ExecutionPolicy Bypass -File tools\app\make-ios-assets.ps1
# Usage: python tools/app/make-icon.py [--style center|dot|plain] [--mincho] [--out FILE]   (needs Pillow and numpy)
#   The app uses the defaults: ripples from the middle, ワンタップ in gothic.
# Fonts (SIL Open Font License), only the characters used, next to this script:
#   Shippori Mincho ExtraBold, Noto Sans JP Black
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
SIZE, S = 1024, 4                     # draw at 4x and shrink, for clean edges
N = SIZE * S

TOP, BOTTOM = (36, 132, 92), (14, 72, 48)    # green, lit from above (the app's plus green sits between)
INK = (250, 249, 244)                         # warm white
MINT = (140, 236, 190)                        # the tap
MINCHO = HERE / 'ShipporiMincho-ExtraBold-icon.ttf'
GOTHIC = HERE / 'NotoSansJP-Black-icon.ttf'

BLOCK_W = 0.68                        # both lines exactly this wide: one lockup, with room inside the rounded corners
GAP = 0.045                           # between the lines


def fit(text, path, width):
    """Font size at which text is exactly width wide (ink, not advance)."""
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    lo, hi = 10, 4000
    while lo < hi:
        m = (lo + hi + 1) // 2
        l, _, r, _ = d.textbbox((0, 0), text, font=ImageFont.truetype(str(path), m))
        lo, hi = (m, hi) if r - l <= width else (lo, m - 1)
    return ImageFont.truetype(str(path), lo)


def background():
    y = np.linspace(0, 1, N, dtype=np.float32)[:, None]
    top, bottom = np.array(TOP, np.float32), np.array(BOTTOM, np.float32)
    col = top + (bottom - top) * (y ** 1.15)[..., None]
    img = np.broadcast_to(col, (N, 1, 3)).repeat(N, axis=1)
    # a soft light from the top centre
    yy, xx = np.mgrid[0:N:16, 0:N:16].astype(np.float32) / N
    glow = np.clip(1 - np.hypot(xx - 0.5, (yy - 0.05) * 1.3) / 0.75, 0, 1) ** 2 * 26
    glow = np.asarray(Image.fromarray(glow.astype(np.float32)).resize((N, N), Image.BICUBIC))
    return Image.fromarray(np.clip(img + glow[..., None], 0, 255).astype(np.uint8))


def text_layer(text, font, xy):
    m = Image.new('L', (N, N), 0)
    ImageDraw.Draw(m).text(xy, text, font=font, fill=255)
    return m


def pieces_of(mask):
    """Separate 4-connected pieces of a boolean mask, as arrays of (y, x)."""
    h, w = mask.shape
    seen, out = np.zeros_like(mask), []
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack, cells = [(sy, sx)], []
        seen[sy, sx] = True
        while stack:
            cy, cx = stack.pop()
            cells.append((cy, cx))
            for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        out.append(np.array(cells))
    return out


def handakuten(font, x, y):
    """Centre and outer radius of the ゜ of プ as set in the line.
    Found by its hole (the empty inside of the little circle), which works even when the ゜ touches the stroke."""
    # プ is the last glyph, so it ends where the line ends: draw it alone, right-aligned to the line's ink
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    line_r = d.textbbox((x, y), 'ワンタップ', font=font)[2]
    _, _, pr, _ = d.textbbox((0, 0), 'プ', font=font)
    pu = np.asarray(text_layer('プ', font, (line_r - pr, y)))
    ys, xs = np.nonzero(pu > 100)
    oy, ox = ys.min() - 2, xs.min() - 2
    ink = pu[oy:ys.max() + 3, ox:xs.max() + 3] > 128
    h, w = ink.shape
    holes = [p for p in pieces_of(~ink)
             if p[:, 0].min() > 0 and p[:, 1].min() > 0 and p[:, 0].max() < h - 1 and p[:, 1].max() < w - 1]
    hole = max(holes, key=len)                           # the inside of ゜ (プ has no other closed space)
    hy, hx = hole[:, 0].mean(), hole[:, 1].mean()
    r_in = (hole[:, 1].max() - hole[:, 1].min()) / 2
    # ring thickness: from the hole's edge outwards until the background, looking up (away from the stroke)
    yy = int(hy - r_in) - 1
    t = 0
    while yy - t >= 0 and ink[yy - t, int(hx)]:
        t += 1
    return float(hx + ox), float(hy + oy), float(r_in + t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--style', choices=['center', 'dot', 'plain'], default='center',
                    help='center: ripples from the middle (the app icon); dot: ripples from the ゜ of プ; plain: no tap')
    ap.add_argument('--mincho', action='store_true', help='set ワンタップ in Mincho instead of gothic')
    ap.add_argument('--out', default=str(HERE / 'ios-icon-1024.png'))
    a = ap.parse_args()
    a.center, a.no_tap, a.gothic = a.style == 'center', a.style == 'plain', not a.mincho

    img = background()
    if a.center:
        # the whole icon is the moment of the tap: ripples spreading from the middle, behind the lettering
        c = N / 2
        glow = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        G = N * 0.30
        ImageDraw.Draw(glow).ellipse((c - G, c - G, c + G, c + G), fill=MINT + (70,))
        glow = glow.filter(ImageFilter.GaussianBlur(N * 0.09))
        img.paste(glow, (0, 0), glow)
        rings = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        rd = ImageDraw.Draw(rings)
        for rad, width, alpha in [(0.33, 0.014, 105), (0.42, 0.012, 85), (0.5, 0.009, 50), (0.58, 0.007, 28)]:
            R = N * rad
            rd.ellipse((c - R, c - R, c + R, c + R), outline=MINT + (alpha,), width=int(N * width))
        img.paste(rings, (0, 0), rings)
    d = ImageDraw.Draw(img)
    w = int(N * BLOCK_W)
    f1 = fit('ワンタップ', GOTHIC if a.gothic else MINCHO, w)
    f2 = fit('収支', MINCHO, w)
    b1, b2 = d.textbbox((0, 0), 'ワンタップ', font=f1), d.textbbox((0, 0), '収支', font=f2)
    h1, h2, gap = b1[3] - b1[1], b2[3] - b2[1], int(N * GAP)
    top = (N - (h1 + gap + h2)) / 2 + N * 0.01          # optical centre sits a touch low because of the tap above
    x1, y1 = (N - (b1[2] - b1[0])) / 2 - b1[0], top - b1[1]
    x2, y2 = (N - (b2[2] - b2[0])) / 2 - b2[0], top + h1 + gap - b2[1]

    d.text((x1, y1), 'ワンタップ', font=f1, fill=INK)
    d.text((x2, y2), '収支', font=f2, fill=INK)

    if a.center:
        # the ゜ of プ in the tap colour, a small echo of the ripples
        cx, cy, r0 = handakuten(f1, x1, y1)
        r = r0 * 1.1
        ImageDraw.Draw(img).ellipse((cx - r, cy - r, cx + r, cy + r), fill=MINT)
    elif not a.no_tap:
        cx, cy, r0 = handakuten(f1, x1, y1)
        # the tap, drawn over the ゜: ripples fading as they spread, a glow, and a solid fingertip point
        r = max(r0 * 1.5, N * 0.034)
        layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        for scale, width, color in [(2.2, 0.26, MINT + (215,)), (3.3, 0.18, MINT + (120,)), (4.4, 0.12, (255, 255, 255, 55))]:
            R, sw = r * scale, max(1, int(r * width))
            ld.ellipse((cx - R, cy - R, cx + R, cy + R), outline=color, width=sw)
        halo = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        H = r * 1.8
        ImageDraw.Draw(halo).ellipse((cx - H, cy - H, cx + H, cy + H), fill=MINT + (110,))
        halo = halo.filter(ImageFilter.GaussianBlur(float(r * 0.6)))
        img.paste(halo, (0, 0), halo)
        img.paste(layer, (0, 0), layer)
        ImageDraw.Draw(img).ellipse((cx - r, cy - r, cx + r, cy + r), fill=MINT)

    img.resize((SIZE, SIZE), Image.LANCZOS).save(a.out)
    print('wrote', a.out)


if __name__ == '__main__':
    main()
