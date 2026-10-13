// テスト用：アプリ版のスクリプトを、偽の iPhone 環境（Capacitor・課金・保存・広告）の中で読み込む
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const ID = 'io.github.maosundev.pachishushi.removeads';
export const flush = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

// 小さな偽の DOM（要素の作成・挿入・id 検索・classList・style だけ）
function fakeDocument() {
  const byId = {};
  const make = tag => {
    const el = {
      tagName: tag.toUpperCase(), children: [], parentNode: null, attrs: {}, listeners: {},
      _text: '', disabled: false, hidden: false, className: '', onclick: null,
      classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } },
      style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
      get id() { return this.attrs.id; }, set id(v) { this.attrs.id = v; byId[v] = el; },
      get textContent() { return el._text + el.children.map(c => c.textContent).join(''); },
      set textContent(v) { el._text = String(v); el.children = []; },
      append(...cs) { for (const c of cs) { const n = typeof c === 'string' ? Object.assign(make('#text'), { _text: c }) : c; n.parentNode = el; el.children.push(n); if (n.attrs.id) byId[n.attrs.id] = n; } },
      replaceChildren(...cs) { el.children = []; el._text = ''; el.append(...cs); },
      after(n) { const p = el.parentNode; const i = p.children.indexOf(el); n.parentNode = p; p.children.splice(i + 1, 0, n); if (n.attrs.id) byId[n.attrs.id] = n; },
      get nextElementSibling() { const p = el.parentNode; return p ? p.children[p.children.indexOf(el) + 1] || null : null; },
      addEventListener(t, f) { (el.listeners[t] ||= []).push(f); },
      click() { if (el.disabled) return; if (el.onclick) el.onclick(); (el.listeners.click || []).forEach(f => f()); },
    };
    return el;
  };
  const html = make('html'), body = make('body');
  const listeners = {};
  const doc = {
    readyState: 'loading', documentElement: html, body,
    createElement: make,
    getElementById: id => byId[id] || null,
    querySelector: sel => {
      if (sel === '#sheetA .csvrow') return byId.__csvrow || null;
      if (sel.startsWith('#')) return byId[sel.slice(1)] || null;
      return null;
    },
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    fire(t) { (listeners[t] || []).forEach(f => f()); },
  };
  // 「収支の詳細」の CSV の行
  const sheet = make('div'); sheet.id = 'sheetA';
  const csv = make('div'); csv.className = 'csvrow'; sheet.append(csv); byId.__csvrow = csv;
  body.append(sheet);
  return doc;
}

export function fakePrefs(initial = {}) {
  const store = { ...initial };
  return {
    store,
    get: async ({ key }) => ({ value: key in store ? store[key] : null }),
    set: async ({ key, value }) => { store[key] = value; },
    remove: async ({ key }) => { delete store[key]; },
  };
}

export function fakeStore(over = {}) {
  const calls = { purchaseProduct: 0, restorePurchases: 0, getPurchases: 0 };
  const np = {
    calls,
    owned: false,
    getPurchases: async () => { calls.getPurchases++; return { purchases: np.owned ? [{ productIdentifier: ID }] : [] }; },
    purchaseProduct: async () => { calls.purchaseProduct++; np.owned = true; return { productIdentifier: ID, transactionId: '1' }; },
    restorePurchases: async () => { calls.restorePurchases++; },
    getProduct: async () => ({ product: { identifier: ID, priceString: '¥130' } }),
    addListener: async () => ({ remove() {} }),
    ...over,
  };
  return np;
}

// files: 読み込むスクリプト（例：['js/purchase.js']）
export function load(files, { native = true, prefs = fakePrefs(), np = fakeStore(), admob = null, extra = {} } = {}) {
  const toasts = [];
  const document = fakeDocument();
  const window = {
    document, toasts, console,
    toast: t => toasts.push(t),
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)), clearTimeout,
    localStorage: { s: {}, getItem(k) { return this.s[k] ?? null; }, setItem(k, v) { this.s[k] = String(v); } },
    MutationObserver: class { observe() {} },
    fetch: async () => { throw new Error('offline'); },
    AbortController,
    Promise,
    ...extra,
  };
  if (native) {
    window.Capacitor = { isNativePlatform: () => true };
    window.capacitorPreferences = { Preferences: prefs };
    window.capacitorNativePurchases = { NativePurchases: np };
    if (admob) { window.capacitorStripe = { AdMob: admob }; window.ADS_CONFIG = { production: false }; }
  }
  window.window = window;
  const ctx = vm.createContext(window);
  for (const f of files) vm.runInContext(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), ctx, { filename: f });
  return window;
}
