# アイコンの考え方

- 「ワンタップ」（太いゴシック）と「収支」（アプリの金額と同じ明朝）の2段。1行に7文字並べると小さくて読めないため。
- 白い文字に、アプリの「プラス」の緑 #1D6B4A。勝ちの色で、ホーム画面でいちばん目を引く。
- ホーム画面の小ささ（60px 前後）でも「収支」がはっきり、「ワンタップ」も読めることを優先する。

作り方：`python tools/app/make-icon.py` → `powershell -ExecutionPolicy Bypass -File tools\app\make-ios-assets.ps1`
