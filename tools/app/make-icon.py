# Draws the app icon: "ワンタップ" (bold gothic) over a large "収支" (the app's Mincho), white on the
# app's plus green. Two lines so the words stay readable at home-screen size.
# Output: tools/app/ios-icon-1024.png (1024x1024 RGB, no transparency), then run
#   powershell -ExecutionPolicy Bypass -File tools\app\make-ios-assets.ps1
# Usage: python tools/app/make-icon.py   (needs Pillow)
# Fonts (SIL Open Font License), only the characters used, next to this script:
#   Noto Sans JP Black, Shippori Mincho ExtraBold
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
SIZE, S = 1024, 4                     # draw at 4x and shrink, for clean edges
N = SIZE * S

GREEN = (29, 107, 74)                 # --plus
WHITE = (255, 255, 255)
SANS = HERE / 'NotoSansJP-Black-icon.ttf'
MINCHO = HERE / 'ShipporiMincho-ExtraBold-icon.ttf'


def fit(d, text, path, width):
    """Largest font size at which text is at most width wide."""
    lo, hi = 10, 3000
    while lo < hi:
        m = (lo + hi + 1) // 2
        l, _, r, _ = d.textbbox((0, 0), text, font=ImageFont.truetype(str(path), m))
        lo, hi = (m, hi) if r - l <= width else (lo, m - 1)
    return ImageFont.truetype(str(path), lo)


def put(d, text, font, cx, cy):
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    d.text((cx - (l + r) / 2, cy - (t + b) / 2), text, font=font, fill=WHITE)


def main():
    img = Image.new('RGB', (N, N), GREEN)
    d = ImageDraw.Draw(img)
    put(d, 'ワンタップ', fit(d, 'ワンタップ', SANS, int(N * 0.74)), N / 2, N * 0.27)
    put(d, '収支', fit(d, '収支', MINCHO, int(N * 0.80)), N / 2, N * 0.63)
    img.resize((SIZE, SIZE), Image.LANCZOS).save(HERE / 'ios-icon-1024.png')
    print('wrote', HERE / 'ios-icon-1024.png')


if __name__ == '__main__':
    main()
