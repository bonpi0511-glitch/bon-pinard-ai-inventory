BON PINARD AI Inventory PWA版

BON PINARD AI在庫登録アプリ クリーン修正版

この版は、文字化けや手作業修正で壊れたファイルを避けるため、全コードを確認し直したクリーン版です。

機能:
- PDF / 写真アップロード
- 原本PDF/写真プレビュー
- 左側: 原本表示
- 右側: AI抽出結果・在庫明細
- PDF/写真をAI判定
- ワイン商品在庫へ自動登録
- 仕入先は伝票ごとにAI判定
- BON PINARD SAS は自社
- MAGNUM は仕入先候補の一つで固定しない
- 要確認フラグ
- 手修正
- Excel / CSV 出力
- 仕入先マスター / ワインマスター / 仕入価格履歴出力

起動:
1. .env.local に OpenAI API Key を設定
2. npm install
3. npm run dev
4. http://localhost:3000 を開く


PWA対応:
- iPhone/iPadホーム画面追加対応
- manifest.json
- Service Worker
- BON PINARDアイコン
- Safari向けメタタグ
- オフライン案内ページ

iPhone/iPadで使うには、Vercel等で公開URL化してください。
詳しくは `PWA_DEPLOY_iPhone_iPad手順.txt` を参照してください。
