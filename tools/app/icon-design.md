# アイコンの考え方

- 題材：スロットのリール。リールが1つ（ワン）、止まった絵柄が「1」（ワンタップ）。
- 「1」の上下には、収支のプラス（緑）とマイナス（赤）が転がっていく途中で見えている。
- 左右の緑の三角は、当たりのラインを示す目印。「1」に止まった＝当たり。
- 色と書体はアプリ本体と同じ：墨 #1A1A1A、紙 #FFFFFF、プラス #1D6B4A、マイナス #A8262C、数字は Shippori Mincho ExtraBold。
- ホーム画面の小ささ（60px 前後）でも「1」と緑の三角が読めることを優先する。

作り方：`python tools/app/make-icon.py` → `powershell -ExecutionPolicy Bypass -File tools\app\make-ios-assets.ps1`
