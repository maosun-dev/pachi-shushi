/* ---------- 広告（iPhoneアプリ版だけ。Web版では読み込まれない） ----------
 * 画面の下の「広告」枠のところに AdMob のバナーを出す。
 * ・320x50 の決まった大きさのバナー（画面幅に合わせる種類は、広告の上下に黒い帯が出たのでやめた）
 * ・バナーの高さに合わせて --adh（広告枠の高さ）を変える。画面の並びは --adh を使っているので崩れない
 * ・キーボードが出ているとき（body.kb）、画像・動画を大きく見ているとき（#viewer.on）、店・機種・タグを選んでいるとき（#pick.on）はバナーを隠す
 * ・画像・動画の添付が終わったあと、何回かに1回だけ全画面広告（インタースティシャル）を出す。
 *   何回に1回かは CONFIG_URL の設定ファイルで決める（0なら出さない）。読めないときは DEFAULT_EVERY。
 *   添付ボタンを押した瞬間には出さない（写真の選択が開けなくなるのと、AdMob の規約で操作の途中の広告は禁止のため）
 * 開発中は Google のテスト広告。ストアに出す版だけ本物（ADS_PRODUCTION=1 でビルドしたとき）。
 */
(() => {
'use strict';
const cfg = window.ADS_CONFIG || null;            // アプリ版のビルドで作られる（tools/app/build-www.mjs）
const plugin = window.capacitorStripe || null;    // @capacitor-community/admob（配布ファイルのグローバル名がこの名前）
const cap = window.Capacitor;
const native = !!(cfg && plugin && cap && cap.isNativePlatform && cap.isNativePlatform());
if (!native) return;
const production = !!cfg.production;

// Google が用意しているテスト用の広告ユニット（開発中はこちらを使う）
const TEST = { banner: 'ca-app-pub-3940256099942544/2435281174', interstitial: 'ca-app-pub-3940256099942544/4411468910' };
// 本物の広告ユニット（ストアに出すビルドだけで使う）。AdMob でこのアプリ用に作った ID を入れる
const REAL = { banner: 'ca-app-pub-7017663942238206/6874372362', interstitial: 'ca-app-pub-7017663942238206/4248209025' };
const ids = production ? REAL : TEST;
const CONFIG_URL = 'https://maosun-dev.github.io/pachi-shushi/ad-config.json';
const DEFAULT_EVERY = 3;
const COUNT_KEY = 'pachi-attach-count';   // アプリを開き直しても数え続ける
const AdMob = plugin.AdMob;
const html = document.documentElement;

let created = false, height = 50, shown = false;
const setAdHeight = h => html.style.setProperty('--adh', Math.round(h) + 'px');
html.classList.add('app-ads');   // 灰色の仮の枠を消す（CSS は build-www.mjs が足す）

// キーボードや画像の拡大表示のときは隠す
const blocked = () => document.body.classList.contains('kb') || !!document.querySelector('#viewer.on, #pick.on');

async function update() {
  const want = !blocked();
  if (want === shown) return;
  shown = want;
  try {
    if (!want) { if (created) await AdMob.hideBanner(); return; }
    if (created) await AdMob.resumeBanner();
    else {
      await AdMob.showBanner({ adId: ids.banner, adSize: 'BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: !production });
      created = true;
    }
    if (blocked()) update();
  } catch (e) { shown = false; }
}

/* ---------- 添付のあとの全画面広告 ---------- */
let interEvery = DEFAULT_EVERY, interReady = false, interShowing = false;

async function loadConfig() {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(CONFIG_URL + '?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    const n = Math.floor(Number((await r.json()).attachInterstitialEvery));
    if (n >= 0) interEvery = n;
  } catch (e) {}   // 読めなければ DEFAULT_EVERY のまま
}
function loadInter() {
  interReady = false;
  AdMob.prepareInterstitial({ adId: ids.interstitial, isTesting: !production })
    .then(() => { interReady = true; })
    .catch(() => setTimeout(loadInter, 60000));
}
function finishInter() { interShowing = false; loadInter(); }

function afterAttach() {
  let n = 0;
  try { n = (parseInt(localStorage.getItem(COUNT_KEY), 10) || 0) + 1; localStorage.setItem(COUNT_KEY, String(n)); } catch (e) {}
  if (!(interEvery > 0 && n % interEvery === 0) || !interReady || interShowing) return;
  interReady = false; interShowing = true;
  // 「〇件 追加しました」が見えてから出す
  setTimeout(() => { AdMob.showInterstitial().catch(finishInter); }, 600);
}
window.Ads = { afterAttach };

async function init() {
  try {
    const s = await AdMob.trackingAuthorizationStatus();
    if (s.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
  } catch (e) {}
  try { await AdMob.initialize({ initializeForTesting: !production }); } catch (e) { return; }
  AdMob.addListener('interstitialAdDismissed', finishInter);
  AdMob.addListener('interstitialAdFailedToShow', finishInter);
  loadInter(); loadConfig();
  AdMob.addListener('bannerAdSizeChanged', s => { if (s && s.height) { height = s.height; setAdHeight(height); } });
  const watch = new MutationObserver(update);
  watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const viewer = document.getElementById('viewer');
  if (viewer) watch.observe(viewer, { attributes: true, attributeFilter: ['class'] });
  const pick = document.getElementById('pick');   // the store / machine / tag picker comes up from the bottom
  if (pick) watch.observe(pick, { attributes: true, attributeFilter: ['class'] });
  update();
}
init();
})();
