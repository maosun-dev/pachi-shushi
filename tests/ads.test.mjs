// js/ads.js と js/purchase.js のつながりのテスト（買った人には広告を出さない）
import test from 'node:test';
import assert from 'node:assert/strict';
import { flush, load, fakePrefs } from './helpers.mjs';

function fakeAdMob() {
  const calls = [];
  const rec = name => async () => { calls.push(name); return {}; };
  return {
    calls,
    trackingAuthorizationStatus: async () => { calls.push('trackingAuthorizationStatus'); return { status: 'notDetermined' }; },
    requestTrackingAuthorization: rec('requestTrackingAuthorization'),
    initialize: rec('initialize'),
    handlers: {},
    addListener(n, f) { calls.push('addListener:' + n); this.handlers[n] = f; },
    prepareInterstitial: rec('prepareInterstitial'),
    showInterstitial: rec('showInterstitial'),
    showBanner: rec('showBanner'),
    hideBanner: rec('hideBanner'),
    resumeBanner: rec('resumeBanner'),
    removeBanner: rec('removeBanner'),
  };
}
const adh = w => w.document.documentElement.style.props['--adh'];

test('owned_never_shows_banner：買った人にはバナーも追跡許可の確認も出さない', async () => {
  const admob = fakeAdMob();
  const w = load(['js/purchase.js', 'js/ads.js'], { admob, prefs: fakePrefs({ 'pachi-noads': '1' }) });
  // Apple も「買っている」と答える
  w.capacitorNativePurchases.NativePurchases.owned = true;
  await flush(30);
  assert.equal(admob.calls.includes('showBanner'), false);
  assert.equal(admob.calls.includes('requestTrackingAuthorization'), false);
  assert.equal(admob.calls.includes('prepareInterstitial'), false);
  assert.equal(adh(w), '0px');
});

test('not_owned_shows_banner：買っていない人には今までどおり広告', async () => {
  const admob = fakeAdMob();
  const w = load(['js/purchase.js', 'js/ads.js'], { admob });
  await flush(30);
  assert.equal(admob.calls.includes('showBanner'), true);
});

test('buy_removes_banner：買った直後にバナーを消し、全画面広告も出さない', async () => {
  const admob = fakeAdMob();
  const w = load(['js/purchase.js', 'js/ads.js'], { admob });
  await flush(30);
  await w.Purchase.buy();
  await flush(30);
  assert.equal(admob.calls.includes('removeBanner'), true);
  assert.equal(adh(w), '0px');
  for (let i = 0; i < 6; i++) w.Ads.afterAttach();
  await flush(30);
  assert.equal(admob.calls.includes('showInterstitial'), false);
});

test('refund_starts_ads：払い戻しで買っていない状態に戻ったら広告を始める', async () => {
  const admob = fakeAdMob();
  const w = load(['js/purchase.js', 'js/ads.js'], { admob, prefs: fakePrefs({ 'pachi-noads': '1' }) });
  await flush(30);   // Apple は「買っていない」と答える
  assert.equal(admob.calls.includes('showBanner'), true);
});

test('banner_loaded_after_buy_is_removed：読み込み中に買ってもバナーを残さない', async () => {
  const admob = fakeAdMob();
  const w = load(['js/purchase.js', 'js/ads.js'], { admob });
  await flush(30);
  await w.Purchase.buy();
  await flush(30);
  // 買ったあとで広告の読み込みが終わり、大きさの知らせが届く
  const before = admob.calls.filter(c => c === 'removeBanner').length;
  admob.handlers.bannerAdSizeChanged({ width: 320, height: 50 });
  await flush(30);
  assert.equal(admob.calls.filter(c => c === 'removeBanner').length, before + 1);
  assert.equal(adh(w), '0px');
});

test('show_in_flight_then_owned：showBanner の途中で買っても、終わったあとに外す', async () => {
  const admob = fakeAdMob();
  let finish;
  admob.showBanner = () => { admob.calls.push('showBanner'); return new Promise(r => { finish = r; }); };
  const w = load(['js/purchase.js', 'js/ads.js'], { admob });
  await flush(30);
  assert.equal(typeof finish, 'function');
  await w.Purchase.buy();
  await flush(30);
  finish({});
  await flush(30);
  assert.equal(admob.calls.includes('removeBanner'), true);
});

test('scheduled_interstitial_cancelled：予約済みの全画面広告も買ったら出さない', async () => {
  const admob = fakeAdMob();
  const w = load(['js/purchase.js', 'js/ads.js'], { admob });
  await flush(30);
  for (let i = 0; i < 3; i++) w.Ads.afterAttach();   // 3回目で予約される
  await w.Purchase.buy();
  await new Promise(r => setTimeout(r, 30));
  await flush(30);
  assert.equal(admob.calls.includes('showInterstitial'), false);
});
