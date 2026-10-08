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

## 残っている作業（あなたがやること）
1. ~~AdMob~~ 済み：アプリID `ca-app-pub-7017663942238206~3268888010`、バナー `/6874372362`、インタースティシャル `/4248209025`（コードに反映済み）。App Store に公開したら AdMob の「ストアを追加」でリンクする（審査が通るまで広告配信は制限される）。
   - アプリID → `ios/App/App/Info.plist` の `GADApplicationIdentifier`（今はGoogleのテスト用ID）
   - 広告ユニットID → `js/ads.js` の `REAL.banner` と `REAL.interstitial`（今は `TODO`）
   - どちらかが未設定のまま「本物の広告」でビルドすると止まるようにしてある。
2. **GitHub** に新しいリポジトリを作って push（例：`maosun-dev/pachi-shushi`）。
3. リポジトリの Secrets に転落牌と同じ4つを登録：`APPLE_TEAM_ID` `APPSTORE_API_KEY_ID` `APPSTORE_API_ISSUER_ID` `APPSTORE_API_PRIVATE_KEY`（鍵は転落牌と同じものを使える）。
4. **App Store Connect** で新しいアプリを作る。バンドルID：`io.github.maosundev.pachishushi`
5. Actions →「iPhone版をTestFlightへ」→ Run workflow（最初は「本物の広告」オフ）→ TestFlight で実機確認。
6. GitHub Pages を有効にして `privacy.html` と `ad-config.json` を公開（`https://maosun-dev.github.io/pachi-shushi/` の想定。リポジトリ名を変えるなら `js/ads.js` の `CONFIG_URL` も）。privacy.html のURLを App Store Connect に登録。

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
