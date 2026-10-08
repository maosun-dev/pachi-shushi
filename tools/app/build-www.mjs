// Makes www/ for the iPhone app (Capacitor) from pachi-shushi.html.
// pachi-shushi.html itself stays the web version (window.claude, Google Fonts, grey ad slot).
//
// App-only changes (the web version never loads these):
//   - Google Fonts <link> -> css/fonts.css + assets/fonts/ (offline, see tools/offline/fetch-fonts.mjs)
//   - js/vendor/*: Capacitor and the plugins' browser side (AdMob, Preferences, Filesystem, Share)
//   - js/app-native.js: a stand-in for window.claude that saves on the phone (records, images/videos, CSV share)
//   - js/ads-config.js + js/ads.js: the AdMob banner in the ad slot. Real ads only when ADS_PRODUCTION=1
//     (set by the store build); otherwise Google's test ads.
// Usage: npm run build                   (test ads)
//        ADS_PRODUCTION=1 npm run build  (real ads)
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'www');
const production = process.env.ADS_PRODUCTION === '1';

// The store build must not ship with test or missing ad IDs.
if (production) {
  const ads = readFileSync(join(root, 'js/ads.js'), 'utf8');
  if (/TODO/.test(ads.match(/const REAL = .*/)[0])) throw new Error('js/ads.js: put the real ad unit IDs (banner, interstitial) in REAL');
  const plist = join(root, 'ios/App/App/Info.plist');
  if (existsSync(plist) && readFileSync(plist, 'utf8').includes('ca-app-pub-3940256099942544~')) {
    throw new Error('ios/App/App/Info.plist: GADApplicationIdentifier is still Google\'s test app ID');
  }
}
if (!existsSync(join(root, 'css/fonts.css'))) throw new Error('css/fonts.css missing: run node tools/offline/fetch-fonts.mjs');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'js/vendor'), { recursive: true });
cpSync(join(root, 'css'), join(out, 'css'), { recursive: true });
cpSync(join(root, 'assets/fonts'), join(out, 'assets/fonts'), { recursive: true });
for (const f of ['app-native.js', 'ads.js']) copyFileSync(join(root, 'js', f), join(out, 'js', f));

const vendor = {
  'capacitor.js': '@capacitor/core/dist/capacitor.js',
  'admob.js': '@capacitor-community/admob/dist/plugin.js',
  'preferences.js': '@capacitor/preferences/dist/plugin.js',
  'filesystem.js': '@capacitor/filesystem/dist/plugin.js',
  'share.js': '@capacitor/share/dist/plugin.js',
};
for (const [to, from] of Object.entries(vendor)) copyFileSync(join(root, 'node_modules', from), join(out, 'js/vendor', to));
// the Filesystem plugin expects its helper under the global name "synapse"
writeFileSync(join(out, 'js/vendor/synapse.js'),
  readFileSync(join(root, 'node_modules/@capacitor/synapse/dist/synapse.js'), 'utf8') + '\nwindow.synapse = window.outsystemsSynapse;\n');
writeFileSync(join(out, 'js/ads-config.js'), `window.ADS_CONFIG = ${JSON.stringify({ production })};\n`);

let html = readFileSync(join(root, 'pachi-shushi.html'), 'utf8');
const replaceOnce = (from, to) => {
  const n = typeof from === 'string' ? html.split(from).length - 1 : (html.match(new RegExp(from, 'g')) || []).length;
  if (n !== 1) throw new Error(`pachi-shushi.html: expected 1 match for ${from}, found ${n}`);
  html = html.replace(from, to);
};
// fonts: Google Fonts -> bundled
replaceOnce(/<link rel="preconnect"[^>]*>\s*<link rel="preconnect"[^>]*>\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/,
  '<link href="css/fonts.css" rel="stylesheet">');
// the grey placeholder disappears once the real banner takes its place (js/ads.js adds .app-ads)
replaceOnce('</style>', '.app-ads .ad .slot{background:none;color:transparent}\n</style>');
// app scripts, before the page's own script (window.claude must exist when it starts)
replaceOnce('<script>\nconst BASE=', [
  'capacitor.js', 'synapse.js', 'admob.js', 'preferences.js', 'filesystem.js', 'share.js',
].map(f => `<script src="js/vendor/${f}"></script>`).concat([
  '<script src="js/ads-config.js"></script>',
  '<script src="js/app-native.js"></script>',
  '<script src="js/ads.js"></script>',
]).join('\n') + '\n<script>\nconst BASE=');
writeFileSync(join(out, 'index.html'), html);

let bytes = 0, files = 0;
for (const e of readdirSync(out, { recursive: true, withFileTypes: true })) {
  if (e.isFile()) { bytes += statSync(join(e.parentPath, e.name)).size; files++; }
}
console.log(`www/: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, ads: ${production ? 'REAL' : 'test'}`);
