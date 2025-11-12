# Notifications UI Capture Guide

このディレクトリには通知設定関連のスクリーンショットを保管します。`docs/line-webhook-notification-ux.md` などの手順書から参照されるため、画像ファイルの命名・更新手順を以下に統一してください。

## 撮影手順

1. `apps/web` をローカルで起動し、通知設定ページ (`/dashboard/<profileId>/notifications`) を開く。  
2. ブラウザ幅は 1440px 前後を基準にし、Retina ディスプレイの場合は 2x サイズで撮影。  
3. 主要ステップ（トグル ON、フォーム入力、保存成功、エラー表示など）ごとにキャプチャする。  
4. PNG 形式で保存し、ファイル名は `line-settings-01.png` のように機能名＋連番で命名する。

## ファイル運用

- 画像を追加・差し替えた際は、この README と関連ドキュメントに記載されている例を最新のものへ更新する。  
- 不要になった画像は削除して差分を明示し、リリースノートや PR 説明で参照先を更新する。  
- 大きな UI 変更時は旧画像を `-old` などにリネームして履歴を残しつつ、必要ならアーカイブ用サブディレクトリを作成する。

### Playwright スクリプトの活用

`osakamenesu/apps/web/scripts/capture-notifications-screenshot.mjs` を利用すると、テスト用シークレット経由でダッシュボードに自動ログインし、通知設定ページを撮影できます。

```bash
cd osakamenesu/apps/web
E2E_TEST_AUTH_SECRET=local-secret npm run screenshot:notifications
# 保存成功メッセージを撮影したい場合
E2E_TEST_AUTH_SECRET=local-secret npm run screenshot:notifications -- --state saved --output ../../../docs/images/notifications/line-settings-02.png
# バリデーションエラーを撮影したい場合
E2E_TEST_AUTH_SECRET=local-secret npm run screenshot:notifications -- --state error --output ../../../docs/images/notifications/line-settings-03.png
```

引数 `--output <path>` で保存先を個別指定できます。撮影後は画像をレビューし、必要に応じてモザイク処理や差し替えを行ってください。

## リンクの貼り方

Markdown から参照する場合は相対パスで指定する:

```md
![LINE 設定フォームの例](images/notifications/line-settings-01.png)
```

画像を差し替えた場合は必ず PR でビルド・プレビューを確認し、リンク切れがないかをチェックすること。
