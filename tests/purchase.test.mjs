// js/purchase.js のテスト（買ったかどうかの判定・買う・復元・覚える）
import test from 'node:test';
import assert from 'node:assert/strict';
import { ID, flush, load, fakePrefs, fakeStore } from './helpers.mjs';

const NET = '通信できませんでした。少しあとでもう一度お試しください';
const NOT_FOUND = 'このApple IDでの購入は見つかりませんでした';
const DONE = '広告を消しました';

test('cache_true_ready_true：覚えた値があれば ready は true', async () => {
  const w = load(['js/purchase.js'], { prefs: fakePrefs({ 'pachi-noads': '1' }) });
  assert.equal(await w.Purchase.ready, true);
  assert.equal(w.Purchase.owned(), true);
});

test('apple_owned_sets_cache：Apple が買っていると言えば覚えて知らせる', async () => {
  const prefs = fakePrefs(), np = fakeStore(); np.owned = true;
  const w = load(['js/purchase.js'], { prefs, np });
  const seen = []; w.Purchase.onChange(v => seen.push(v));
  assert.equal(await w.Purchase.ready, false);
  await flush();
  assert.equal(w.Purchase.owned(), true);
  assert.equal(prefs.store['pachi-noads'], '1');
  assert.deepEqual(seen, [true]);
});

test('refund_clears_cache：払い戻し後は覚えた値を消して広告を戻す', async () => {
  const prefs = fakePrefs({ 'pachi-noads': '1' });
  const w = load(['js/purchase.js'], { prefs });
  const seen = []; w.Purchase.onChange(v => seen.push(v));
  await w.Purchase.ready; await flush();
  assert.equal(w.Purchase.owned(), false);
  assert.equal('pachi-noads' in prefs.store, false);
  assert.deepEqual(seen, [false]);
});

test('offline_uses_cache：Apple につながらなければ覚えた値のまま', async () => {
  const np = fakeStore({ getPurchases: async () => { throw new Error('offline'); } });
  const w = load(['js/purchase.js'], { prefs: fakePrefs({ 'pachi-noads': '1' }), np });
  const seen = []; w.Purchase.onChange(v => seen.push(v));
  await w.Purchase.ready; await flush();
  assert.equal(w.Purchase.owned(), true);
  assert.deepEqual(seen, []);
});

test('buy_success：買えたら広告なしになり、知らせを出す', async () => {
  const w = load(['js/purchase.js']);
  await w.Purchase.ready; await flush();
  await w.Purchase.buy();
  assert.equal(w.Purchase.owned(), true);
  assert.deepEqual(w.toasts, [DONE]);
});

test('cancel_is_silent：途中でやめたら何も出さない', async () => {
  for (const err of [new Error('User cancelled'), Object.assign(new Error('x'), { code: 'USER_CANCELLED' }), new Error('Transaction pending')]) {
    const np = fakeStore({ purchaseProduct: async () => { throw err; } });
    const w = load(['js/purchase.js'], { np });
    await w.Purchase.ready; await flush();
    await w.Purchase.buy();
    assert.deepEqual(w.toasts, [], err.message);
    assert.equal(w.Purchase.owned(), false);
  }
});

test('buy_network_error：ほかのエラーは通信エラーの知らせ', async () => {
  const np = fakeStore({ purchaseProduct: async () => { throw new Error('network'); } });
  const w = load(['js/purchase.js'], { np });
  await w.Purchase.ready; await flush();
  await w.Purchase.buy();
  assert.deepEqual(w.toasts, [NET]);
});

test('restore_not_found：復元しても無ければそう知らせる', async () => {
  const w = load(['js/purchase.js']);
  await w.Purchase.ready; await flush();
  await w.Purchase.restore();
  assert.deepEqual(w.toasts, [NOT_FOUND]);
  assert.equal(w.Purchase.owned(), false);
});

test('restore_found：復元で見つかれば広告なし', async () => {
  const np = fakeStore(); np.restorePurchases = async () => { np.owned = true; };
  const w = load(['js/purchase.js'], { np });
  await w.Purchase.ready; await flush();
  await w.Purchase.restore();
  assert.equal(w.Purchase.owned(), true);
  assert.deepEqual(w.toasts, [DONE]);
});

test('busy_ignores_second_call：連打しても1回だけ', async () => {
  const np = fakeStore();
  const w = load(['js/purchase.js'], { np });
  await w.Purchase.ready; await flush();
  await Promise.all([w.Purchase.buy(), w.Purchase.buy()]);
  assert.equal(np.calls.purchaseProduct, 1);
});

test('price：Apple から取った値段を返す', async () => {
  const w = load(['js/purchase.js']);
  await w.Purchase.ready; await flush();
  assert.equal(w.Purchase.price(), '¥130');
});

test('web_does_nothing：Web版では何も作らない', () => {
  const w = load(['js/purchase.js'], { native: false });
  assert.equal(w.Purchase, undefined);
});

test('uses_product_id：決まった ID で買う', async () => {
  let asked = null;
  const np = fakeStore({ purchaseProduct: async o => { asked = o.productIdentifier; return {}; } });
  const w = load(['js/purchase.js'], { np });
  await w.Purchase.ready; await flush();
  await w.Purchase.buy();
  assert.equal(asked, ID);
});
