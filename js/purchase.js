/* ---------- 広告を消す（買い切りのアプリ内課金。iPhoneアプリ版だけ。Web版では読み込まれない） ----------
 * ・起動のたびに Apple に「この Apple ID が今も持っている購入」を問い合わせる（払い戻された購入は出てこない）
 * ・結果は端末にも覚える（Preferences の NOADS_KEY）。電波がなくて問い合わせられないときは、覚えた値を使う
 * ・ads.js には window.Purchase だけを渡す。ready（覚えた値で決まる。Apple を待たない）・owned()・onChange(fn)
 * ・「収支の詳細」の CSV の行の下に「広告を消す（値段）・購入を復元」の行を足す。買ったあとは「広告なし ✓」
 * 課金の項目は App Store Connect で作る（非消耗型、PRODUCT_ID、日本を基準に ¥130）。
 */
(() => {
'use strict';
const cap = window.Capacitor;
if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
const NP = window.capacitorNativePurchases && window.capacitorNativePurchases.NativePurchases;
const P = window.capacitorPreferences && window.capacitorPreferences.Preferences;
if (!NP || !P) return;

const PRODUCT_ID = 'io.github.maosundev.pachishushi.removeads';
const NOADS_KEY = 'pachi-noads';
const MSG = {
  done: '広告を消しました',
  net: '通信できませんでした。少しあとでもう一度お試しください',
  notFound: 'このApple IDでの購入は見つかりませんでした',
};

let owned = false, busy = false, priceText = null;
const listeners = [];
const say = t => { if (typeof window.toast === 'function') window.toast(t); };

function setOwned(v) {
  if (v === owned) return;
  owned = v;
  (v ? P.set({ key: NOADS_KEY, value: '1' }) : P.remove({ key: NOADS_KEY })).catch(() => {});
  render();
  for (const f of listeners) { try { f(v); } catch (e) {} }
}

// Apple に問い合わせる。true / false、つながらなければ null
async function check() {
  try {
    const { purchases } = await NP.getPurchases({ onlyCurrentEntitlements: true });
    const has = (purchases || []).some(t => t && t.productIdentifier === PRODUCT_ID);
    setOwned(has);
    return has;
  } catch (e) { return null; }
}

// 途中でやめた・保護者の承認待ち（あとで届いたら transactionUpdated で拾う）は知らせを出さない
const quiet = e => !!e && (e.code === 'USER_CANCELLED' || /cancel|pending/i.test(String(e.message || e)));

async function buy() {
  if (busy || owned) return;
  busy = true; render();
  try {
    await NP.purchaseProduct({ productIdentifier: PRODUCT_ID });
    setOwned(true);
    say(MSG.done);
  } catch (e) {
    if (!quiet(e)) say(MSG.net);
  } finally { busy = false; render(); }
}

async function restore() {
  if (busy) return;
  busy = true; render();
  try {
    await NP.restorePurchases();
    const has = await check();
    say(has === null ? MSG.net : has ? MSG.done : MSG.notFound);
  } catch (e) {
    if (!quiet(e)) say(MSG.net);
  } finally { busy = false; render(); }
}

/* ---------- 「収支の詳細」の行 ---------- */
let row = null;
function render() {
  if (!row) return;
  if (owned) { row.replaceChildren('広告なし ✓'); return; }
  const b = document.createElement('button');
  b.id = 'buyNoAds'; b.textContent = priceText ? `広告を消す（${priceText}）` : '広告を消す';
  b.disabled = busy; b.onclick = buy;
  const r = document.createElement('button');
  r.id = 'restoreNoAds'; r.textContent = '購入を復元';
  r.disabled = busy; r.onclick = restore;
  const sep = document.createElement('span'); sep.textContent = '・';
  row.replaceChildren(b, sep, r);
}
function mountRow() {
  const csv = document.querySelector('#sheetA .csvrow');
  if (!csv || row) return;
  row = document.createElement('div');
  row.className = 'csvrow'; row.id = 'adfreeRow';
  csv.after(row);
  render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountRow);
else mountRow();

/* ---------- 起動時 ---------- */
const ready = P.get({ key: NOADS_KEY })
  .then(r => { owned = !!r && r.value === '1'; render(); return owned; })
  .catch(() => false);
ready.then(() => {
  check();
  NP.getProduct({ productIdentifier: PRODUCT_ID })
    .then(r => { priceText = (r && r.product && r.product.priceString) || null; render(); })
    .catch(() => {});
  // 承認待ちだった購入や、別の端末での購入が届いたとき
  try { NP.addListener('transactionUpdated', () => { check(); }); } catch (e) {}
});

window.Purchase = {
  ready,
  owned: () => owned,
  onChange: fn => { listeners.push(fn); },
  buy,
  restore,
  price: () => priceText,
};
})();
