// Downloads the Google Fonts the page uses, so the iPhone app shows the same fonts offline.
//   -> assets/fonts/*.woff2 + css/fonts.css
// Google splits Japanese fonts into many small pieces (unicode-range). All pieces are kept, so any
// character a user types in a memo or item name still uses the same font; the app only loads the
// pieces that are actually on screen.
// The web version keeps loading Google Fonts directly (build-www.mjs swaps the <link> in the app only).
// Shippori Mincho is only used for the amounts (yen() in the page: + − ± digits , 円), so only the
// weight 800 pieces that contain those characters are kept.
// Re-run only when the font list in pachi-shushi.html changes.
// Usage: node tools/offline/fetch-fonts.mjs
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CSS_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Shippori+Mincho:wght@600;800&display=swap';
// a modern browser user agent, so Google answers with woff2 + unicode-range
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const fontDir = join(root, 'assets', 'fonts');
rmSync(fontDir, { recursive: true, force: true });
mkdirSync(fontDir, { recursive: true });
mkdirSync(join(root, 'css'), { recursive: true });

const css = await (await fetch(CSS_URL, { headers: { 'User-Agent': UA } })).text();
const faces = css.match(/@font-face\s*{[^}]*}/g) || [];
if (!faces.length) throw new Error('no @font-face in the Google Fonts response');

// Shippori Mincho: only these characters, only weight 800
const MINCHO_CHARS = [...'+−±,0123456789円'].map(c => c.codePointAt(0));
const covers = (range, cps) => range.split(',').some(part => {
  const [a, b] = part.trim().replace(/^U\+/i, '').split('-').map(h => parseInt(h, 16));
  return cps.some(c => c >= a && c <= (b ?? a));
});

const out = [];
let bytes = 0;
const counts = {};
for (const face of faces) {
  const family = face.match(/font-family:\s*'([^']+)'/)[1];
  const weight = face.match(/font-weight:\s*(\d+)/)[1];
  if (family === 'Shippori Mincho') {
    if (weight !== '800' || !covers(face.match(/unicode-range:\s*([^;]+);/)[1], MINCHO_CHARS)) continue;
  }
  const url = face.match(/url\((https:[^)]+\.woff2)\)/)[1];
  const key = `${family}-${weight}`;
  const n = counts[key] = (counts[key] || 0) + 1;
  const file = `${family.replace(/\s+/g, '')}-${weight}-${String(n).padStart(3, '0')}.woff2`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(join(fontDir, file), buf);
  bytes += buf.length;
  out.push(face.replace(url, `../assets/fonts/${file}`));
}
writeFileSync(join(root, 'css', 'fonts.css'), `/* made by tools/offline/fetch-fonts.mjs - do not edit */\n${out.join('\n')}\n`);
console.log(`${out.length} font files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
for (const [k, n] of Object.entries(counts)) console.log(`  ${k}: ${n} pieces`);
