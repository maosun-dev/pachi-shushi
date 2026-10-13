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
    addListener: (n, f) => { calls.push('addListener:' + n); },
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
  w.Capacitor.isNativePlatform = () => true;
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
