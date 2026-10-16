# ワンタップ収支：iPhoneアプリ化メモ

転落牌（`../tenrakuhai`）と同じ作り方：Capacitor で包む → AdMob → GitHub Actions の Mac で組み立てて TestFlight へ。

## 名前
- App Store に載せる名前：**ワンタップ収支 - パチンコ・パチスロ記録**（App Store Connect で入力する）
- ホーム画面の名前：**ワンタップ収支**（`capacitor.config.json` と `ios/App/App/Info.plist` の CFBundleDisplayName）
- リポジトリ名・バンドルID（`io.github.maosundev.pachishushi`）は利用者に見えないので旧名のまま

## できていること
- `pachi-shushi.html` はWeb版のまま（見た目・操作・データ構造は変えていない）。変えたのは2行だけ
  （画像の表示先を `assets.src` から取れるように、20MB制限を `assets.maxBytes` で外せるように）。
- `npm run build` で `www/` にアプリ版を作る（`tools/app/build-www.mjs`）。アプリ版だけ次を差し込む：
  | Web版 | アプリ版 |
  |---|---|
  | `claude.use("db")` `claude.use("user")` | `js/app-native.js` が同じ形で Preferences（消えにくい保存領域）に保存。localStorage が消されても次の起動で戻る |
  | `claude.use("assets")`（20MB制限） | 端末のファイル領域 `media/` に保存。制限なし。大きな動画も3MBずつ書く |
  | `claude.use("downloads")` | CSVを共有シートで保存・送信 |
  | 灰色の「広告」枠 | `js/ads.js` が AdMob バナーを同じ位置に。高さは広告に合わせて `--adh` を変える。キーボード表示中と画像の拡大表示中は隠す |
  | （なし） | 画像・動画の添付が終わったあと、N回に1回だけ全画面広告。N は `ad-config.json` の `attachInterstitialEvery`（GitHub Pages から読む。0で停止、読めないときは3） |
  | Googleフォント | `assets/fonts/` に同梱（`node tools/offline/fetch-fonts.mjs` で取り直し） |
- 上の時計・電池の文字色をライト／ダークに合わせる。
- iOSプロジェクト（`ios/`）：iPhoneのみ・縦固定・追跡許可の文・写真/カメラ/マイクの説明文。
- アイコンは仮（`tools/app/make-ios-assets.ps1`）。本番の絵は `tools/app/ios-icon-1024.png` に置いて再実行。
- `.github/workflows/ios-testflight.yml`：転落牌と同じ（Game Center の署名だけ削除）。
- `privacy.html`：プライバシーポリシー。

## 済んだこと（2026-10-08）
- GitHub：https://github.com/maosun-dev/pachi-shushi（公開）。Secrets 4つ登録済み（鍵は転落牌と同じチームキー）
- GitHub Pages：https://maosun-dev.github.io/pachi-shushi/privacy.html と ad-config.json
- Apple：App ID `io.github.maosundev.pachishushi` 登録、App Store Connect にアプリ作成（SKU `pachishushi`）
- AdMob：アプリID `ca-app-pub-7017663942238206~3268888010`、バナー `/6874372362`、インタースティシャル `/4248209025`（コードに反映済み）

## 残っている作業
1. ~~TestFlight で実機確認~~ 済み（2026-10-10、ビルド8まで）
2. ~~本番用アイコン~~ 済み（tools/app/make-icon.py、考え方は tools/app/icon-design.md）
3. App Store Connect に入力：掲載文・スクリーンショット・年齢制限・Appのプライバシーは docs/appstore-listing.md と docs/screenshots/ を使う
4. ~~審査に提出~~ 済み。2026-10-11 に 2.1「情報不足」（新しい開発者への追加質問）で一度却下 → 説明文（docs/review-reply-2.1.md、審査メモ欄にも保存）と実機の画面収録を返信し、ビルド12で再提出 → **2026-10-13 に合格し、同日 App Store で公開**：https://apps.apple.com/jp/app/id6820513646
5. ~~AdMob の「ストアを追加」~~ 済み（2026-10-13）。ただし **app-ads.txt の確認で不合格**（広告配信の制限が解けない）
   - ファイル自体は正しい（https://maosun-dev.com/app-ads.txt に pub-7017663942238206 の行がある）
   - 原因：App Store に載っているサイトが maosun-dev.github.io（サポートURL）で、そこから maosun-dev.com へ別ドメインに転送されるため、AdMob が辿らない。マーケティングURL（＝開発者サイト）も空
   - 直し方：公開中のバージョンのURLは書き換えられないので新バージョンが必要
   - **2026-10-13 に 1.0.1（ビルド14、中身は 1.0 と同じ）を審査に提出済み**。マーケティングURL https://maosun-dev.com/、サポートURL https://maosun-dev.com/support.html
   - 1.0.1 は 2026-10-14 に公開（App Store の開発者サイト＝https://maosun-dev.com/ になったのを確認済み）
   - 2026-10-16 に AdMob で「アップデートを確認」を押した。AdMob は「App Store のURL変更をクローラが見つけるまで7日ほどかかる」とのことで、まだ「デベロッパー ウェブサイトが見つかりません」のまま
   - **次にやる**：10/21 ごろにもう一度 AdMob → アプリ → app-ads.txt を見る。まだなら「アップデートを確認」を押し直す
6. AdMob の「お支払い」に住所・税・口座が登録済みか確認（売上の受け取りに必要。入力はユーザー本人）
7. EU でも配信するなら App Store Connect でトレーダーステータスを登録。日本だけなら配信国から EU を外す
8. ~~maosun-dev.github.io のトップの「App Store は準備中」を上のストアのリンクに差し替える~~ 済み（2026-10-13、「App Store で入手」ボタン）

## 次のアップデート（1.1）でやること
- **広告を消す（買い切り ¥130）** — 設計：docs/superpowers/specs/2026-10-14-remove-ads-purchase-design.md、手順：docs/superpowers/plans/2026-10-14-remove-ads-purchase.md
  - ~~アプリ側~~ 済み（2026-10-14）：`js/purchase.js`（@capgo/native-purchases）、`js/ads.js` のつながり、「収支の詳細」の CSV の下に「広告を消す（¥130）・購入を復元」。`npm test` で 24 件のテスト
  - ~~有料アプリ契約~~ 済み（2026-10-15）：契約・銀行口座・納税フォームすべて「有効」、新しい規約にも同意
  - ~~アプリ内課金の作成~~ 済み（2026-10-15）：非消耗型、ID `io.github.maosundev.pachishushi.removeads`（Apple ID 6823113889）、基準の国＝日本 ¥130、全ての国で配信、日本語の表示名「広告を消す」。状態は「提出準備中」
  - ~~実機確認~~ 済み（2026-10-15）：1.1.0（ビルド15・テスト広告）の TestFlight で「買う→広告が消える→入れ直す→復元→消える」まで通った。作った直後の1時間ほどは商品が取れず「通信できませんでした」になる
  - **残り**：
    1. App Store Small Business Program に申し込む（手数料15%。ユーザーが自分で）
    2. 審査に出すとき：課金項目に審査用スクリーンショット（買うボタンの画面）を載せて「審査用に追加」→ 1.1.0 と一緒に提出（本物の広告＝production オン で組み立て直す）
    3. （任意）機内モードで起動して、買った人に広告が出ないか
- ~~スクリーンショットの撮り直し~~ 済み（2026-10-16）。架空の店名・機種名で `docs/screenshots/` と `6.3/` の8枚を撮り直した。**1.1.0 を出すときに App Store Connect の画像を差し替える**
  - 今の画像に実在の店名（マルハン・エスパス）と他社の機種名（北斗・東京喰種・牙狼・エヴァ・海物語）が写っている。App Store の審査で落ちたり苦情が来たりするおそれがある
  - `mockups/seed.js` などの見本データを架空の名前（例：駅前ホール・海の物語）に変えて、`docs/screenshots/` と `docs/screenshots/6.3/` を撮り直す
  - 初回の審査で 5.2（他社の権利）などを理由に落ちたら、このアップデートを待たずにすぐやる
- ~~ライセンス表示~~ 済み（2026-10-16）：「収支の詳細」のいちばん下の「ライセンス」から開く画面（`#sheetX`）。書体（OFL）・Capacitor と部品（MIT）・課金の部品（MPL 2.0、ソースの場所）・Google 広告 SDK（規約の場所）と、全文。`assets/fonts/OFL.txt` も置いた
  - 部品を足したら、この画面にも足す
- （任意）キーワードの「スマスロ」を外すか考える。商標かどうかは確かめられなかった

## 実機で確かめること
- 記録・メモ・修正・削除、アプリを終了して開き直しても残るか
- 画像・動画の追加と再生（長い動画も）、削除
- CSVの書き出し（共有シート）と読み込み（ファイルアプリから）
- バナーの位置、キーボードを出したとき・画像を拡大したときに隠れるか
- 添付を3回したら全画面広告が出るか（添付ボタンを押した瞬間ではなく、追加が終わったあと）
- ライト／ダーク切り替えで上の時計の色が変わるか

## Web版からの引っ越し
Web版の詳細画面「CSV 書き出す」→ アプリ版の「読み込む」。画像・動画は移らない（件数だけ）。

## 申請まわりの注意
- ギャンブル関連の記録アプリなので、年齢制限（17+/18+相当）の設定と審査の確認が必要になる可能性がある。
- App のプライバシー（栄養ラベル）：AdMob ぶんの「識別子・利用状況データ（広告目的、トラッキングあり）」などを申告。

## 変更してはいけないところ
- 画面レイアウト（スクロールなしで1画面に収まる構成）
- 年額タップ → 区分別 → 日付 → 明細（メモ・画像・動画・修正）の流れ
- 「編集」でタップして並べ替える仕組み
- ライト／ダークの切り替え
