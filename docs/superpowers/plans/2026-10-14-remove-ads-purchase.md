# 広告を消す（買い切り）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** アプリ版に買い切り課金「広告を消す」（¥130）と「購入を復元」を足し、買った人にはバナーも全画面広告も出さない。

**Architecture:** 課金は新しい `js/purchase.js` にまとめ、`window.Purchase` だけを外に出す。ボタンの行も purchase.js が「収支の詳細」の CSV の行の下に自分で差し込む（pachi-shushi.html は触らない）。`js/ads.js` は起動時に `Purchase.ready` を待ち、買っていれば広告を一切始めない。

**Tech Stack:** Capacitor 8、`@capgo/native-purchases` 8.9.x（StoreKit 2）、`@capacitor/preferences`、Node 24 の `node:test`（手元のテスト）

**Spec:** `docs/superpowers/specs/2026-10-14-remove-ads-purchase-design.md`

## Global Constraints
- 課金の項目 ID：`io.github.maosundev.pachishushi.removeads`（非消耗型）
- 端末に覚えるキー（Preferences）：`pachi-noads`、値は `"1"` か無し
- 買った判定は `getPurchases({ onlyCurrentEntitlements: true })` に上の ID があるかどうか（払い戻しで消える）
- `pachi-shushi.html`（Web 版）は1文字も変えない。アプリ版だけの変更は `tools/app/build-www.mjs` と `js/` で行う
- 画面の並びは変えない。足すのは「収支の詳細」の CSV の行の下の1行だけ
- 文言（そのまま使う）：
  - ボタン：`広告を消す（{値段}）`、`購入を復元`、区切りは `・`。値段が取れないときは `広告を消す`
  - 買ったあと：`広告なし ✓`
  - `通信できませんでした。少しあとでもう一度お試しください`
  - `このApple IDでの購入は見つかりませんでした`
  - 買えた・復元できたとき：`広告を消しました`
- メッセージはページの `toast(文字)`（pachi-shushi.html の 506 行目、グローバル関数）で出す
- コメントとコミットメッセージは日本語

## Review Focus
1. 起動直後、Apple への問い合わせより先に ads.js が動く → 買った人に一瞬バナーが出てはいけない（Task 3 の「ready を待つ」テスト）
2. 払い戻し後の起動 → 覚えている `"1"` を消し、広告が戻る（Task 2 の `refund_clears_cache`）
3. 機内モードで起動 → 覚えている値を使い、広告を出さない（Task 2 の `offline_uses_cache`）
4. 買う途中でキャンセル → メッセージを出さず、状態も変えない（Task 2 の `cancel_is_silent`）
5. ボタン連打 → 2回目は無視（Task 2 の `busy_ignores_second_call`）

---

### Task 1: 課金の部品を入れて、アプリ版に読み込む

**Files:**
- Modify: `package.json`（dependencies に `@capgo/native-purchases`、scripts に `"test": "node --test tests/"`）
- Modify: `tools/app/build-www.mjs`（vendor に `'purchases.js': '@capgo/native-purchases/dist/plugin.js'`、コピーするファイルに `purchase.js`、script タグの順番を `... share.js, purchases.js` → `ads-config.js` → `app-native.js` → `purchase.js` → `ads.js`。冒頭のコメントにも1行足す）
- Create: `js/purchase.js`（この Task では中身は空の即時関数とコメントだけ）

**Interfaces:**
- Produces: アプリ版の `window.capacitorNativePurchases.NativePurchases`、`js/purchase.js` が `ads.js` より前に読まれること

- [ ] **Step 1:** `npm install @capgo/native-purchases@8.9.5 --save-exact`
- [ ] **Step 2:** build-www.mjs と js/purchase.js を上のとおり変える
- [ ] **Step 3:** `npm run build` → 出力が `www/: ... ads: test` で終わり、`www/index.html` に `js/vendor/purchases.js` と `js/purchase.js` が ads.js より前にあること（`grep -n "purchase" www/index.html`）
- [ ] **Step 4:** `git diff --stat pachi-shushi.html` が空であること
- [ ] **Step 5:** `npx cap sync ios` → `ios/App/CapApp-SPM/Package.swift` に CapgoNativePurchases が入ること
- [ ] **Step 6:** コミット「課金の部品を入れて、アプリ版で読み込むようにした」

### Task 2: purchase.js の中身（買った判定・買う・復元・覚える）

**Files:**
- Modify: `js/purchase.js`
- Create: `tests/purchase.test.mjs`

**Interfaces:**
- Consumes: `window.Capacitor.isNativePlatform()`、`window.capacitorNativePurchases.NativePurchases`、`window.capacitorPreferences.Preferences`
- Produces（アプリ版だけ。Web 版では `window.Purchase` は作らない）：
  - `Purchase.ready: Promise<boolean>` … 端末に覚えた値で決まる（Apple を待たない）
  - `Purchase.owned(): boolean`
  - `Purchase.onChange(fn: (owned: boolean) => void): void`
  - `Purchase.buy(): Promise<void>` … 失敗・キャンセルでも reject しない（メッセージは中で出す）
  - `Purchase.restore(): Promise<void>`
  - `Purchase.price(): string | null` … `getProduct` の `priceString`

テストのやり方：`node:vm` で purchase.js を読み、偽の `window`（`Capacitor`・`NativePurchases`・`Preferences`・`toast`、`document` は `readyState: 'loading'` と何もしない `addEventListener`）を渡す。偽の NativePurchases は `getPurchases`・`purchaseProduct`・`restorePurchases`・`getProduct` を差し替えられるようにする。

- [ ] **Step 1: 失敗するテストを書く**（`tests/purchase.test.mjs`）
  - `cache_true_ready_true`：Preferences に `pachi-noads="1"` → `await ready === true`
  - `apple_owned_sets_cache`：覚えた値なし、getPurchases が ID を返す → 少し待つと `owned() === true`、Preferences に `"1"`、onChange が `true` で1回呼ばれる
  - `refund_clears_cache`：覚えた値 `"1"`、getPurchases が空 → `owned() === false`、キーが消える、onChange(false)
  - `offline_uses_cache`：覚えた値 `"1"`、getPurchases が reject → `owned() === true` のまま、onChange は呼ばれない
  - `buy_success`：purchaseProduct が成功 → `owned() === true`、toast が `広告を消しました`
  - `cancel_is_silent`：purchaseProduct が `{ code: 'USER_CANCELLED' }` か message に `cancel` を含むエラーで reject → toast 呼ばれない、`owned() === false`
  - `buy_network_error`：上以外のエラー → toast が `通信できませんでした。少しあとでもう一度お試しください`
  - `restore_not_found`：restorePurchases 成功、getPurchases が空 → toast が `このApple IDでの購入は見つかりませんでした`
  - `busy_ignores_second_call`：buy を2回続けて呼ぶ → purchaseProduct は1回だけ
  - `web_does_nothing`：`Capacitor` なし → `window.Purchase === undefined`
- [ ] **Step 2:** `npm test` → 全部 FAIL（Purchase が無い）
- [ ] **Step 3:** purchase.js を実装する。キャンセルの見分けは「`code` が `USER_CANCELLED`、または message を小文字にして `cancel` を含む」
- [ ] **Step 4:** `npm test` → 全部 PASS
- [ ] **Step 5:** コミット「買ったかどうかの判定・購入・復元を作った」

### Task 3: ボタンの行と、広告を止める仕組み

**Files:**
- Modify: `js/purchase.js`（行の差し込み）
- Modify: `js/ads.js`
- Modify: `tests/purchase.test.mjs`、Create: `tests/ads.test.mjs`

**Interfaces:**
- Consumes: Task 2 の `window.Purchase`
- Produces: `#sheetA .csvrow` の直後の `<div class="csvrow" id="adfreeRow">`（CSV の行と同じ見た目のクラスを使う）

ボタンの行（purchase.js、`DOMContentLoaded` のあとに差し込む）：
- 買う前：`<button id="buyNoAds">広告を消す（¥130）</button><span>・</span><button id="restoreNoAds">購入を復元</button>`
- 買ったあと：`広告なし ✓` の文字だけ（onChange で切り替える）
- 処理中は2つのボタンを `disabled`

ads.js：
- いまの `init();` を `(window.Purchase ? Purchase.ready : Promise.resolve(false)).then(owned => { if (!owned) init(); })` にする（追跡許可の確認も init の中なので、買った人には出ない）
- `Purchase.onChange(owned => …)`：true なら `AdMob.removeBanner()`、`setAdHeight(0)`、全画面広告を出さない印を立てる（`afterAttach` は印があれば何もしない）。false なら、まだ init していなければ init する
- 買った人は `html.classList.add('app-ads')` の時点で `--adh` を 0 にする（灰色の枠も出さない）

- [ ] **Step 1: 失敗するテストを書く**
  - purchase：`row_inserted_after_csv`（偽の document に `#sheetA .csvrow` を用意 → 直後に `#adfreeRow`）、`row_shows_owned`（onChange(true) のあと行の文字が `広告なし ✓`）
  - ads（`tests/ads.test.mjs`、偽の AdMob で ads.js を vm で読む）：`owned_never_shows_banner`（ready が true → showBanner も requestTrackingAuthorization も呼ばれない、`--adh` は `0px`）、`buy_removes_banner`（ready false で開始 → onChange(true) → removeBanner が呼ばれ `--adh` が `0px`、afterAttach を3回呼んでも showInterstitial なし）
- [ ] **Step 2:** `npm test` → 新しいテストが FAIL
- [ ] **Step 3:** 実装する
- [ ] **Step 4:** `npm test` → 全部 PASS。`npm run build` が通り、`git diff --stat pachi-shushi.html` が空
- [ ] **Step 5:** コミット「詳細画面に広告を消すボタンを足し、買った人には広告を出さないようにした」

### Task 4: App Store Connect の準備と実機確認（ご本人と一緒に）

**Files:**
- Modify: `HANDOFF.md`（「できていること」の表に課金の行、「済んだこと」と「次にやること」を更新）
- Modify: `docs/appstore-listing.md`（課金の表示名・説明・審査メモ）

- [ ] **Step 1:**（ご本人）有料アプリ契約が「有効」、Small Business Program に申し込み済み
- [ ] **Step 2:**（ご本人と画面を見ながら）アプリ内課金を作る：非消耗型、ID は上のもの、参照名「広告を消す」、¥130、**基準の国を日本**、表示名「広告を消す」、説明「バナー広告と全画面広告を表示しないようにします」、審査用スクリーンショット（ボタンの行が写った画面）
- [ ] **Step 3:** バージョン番号を 1.1.0 にして、GitHub Actions「iPhone版をTestFlightへ」を production オフで動かす（`gh workflow run` → `gh run watch`）
- [ ] **Step 4:**（ご本人の iPhone、TestFlight）設計メモの確かめ方 1〜4 を通しで確かめる
- [ ] **Step 5:** HANDOFF.md と docs/appstore-listing.md を更新してコミット「課金の準備と確認の結果を引き継ぎメモに書いた」

1.1 の審査提出は、スクショの撮り直しとライセンス画面がそろってから、まとめて行う（この計画の外）。
