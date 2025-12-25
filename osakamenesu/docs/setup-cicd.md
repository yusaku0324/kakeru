# CI/CD セットアップガイド

## 🔐 GitHub Secrets の設定

Fly.io 自動デプロイを有効にするには、以下のシークレットを設定する必要があります。

### 1. FLY_API_TOKEN の取得

```bash
# Fly.io にログイン
fly auth login

# API トークンを生成
fly tokens create deploy-token
```

### 2. GitHub リポジトリに設定

1. GitHub リポジトリの Settings → Secrets and variables → Actions
2. "New repository secret" をクリック
3. 以下を設定：
   - Name: `FLY_API_TOKEN`
   - Secret: 上記で生成したトークン

### 3. 環境ごとの設定

#### Production 環境
- Settings → Environments → "production"
- Required reviewers を設定（推奨）
- Deployment branches: "main" のみ

#### Staging 環境
- Settings → Environments → "staging"
- Deployment branches: すべて許可

## 🚀 ワークフローの有効化

1. このPRをマージ
2. `services/api/` 配下のファイルを変更
3. main ブランチにプッシュ
4. Actions タブで自動デプロイが開始されることを確認

## 📊 モニタリング

### GitHub Actions
- リポジトリの Actions タブでワークフロー実行状況を確認
- 失敗時は自動で通知（要設定）

### Fly.io
```bash
# デプロイ履歴
fly releases --app osakamenesu-api

# アプリケーションログ
fly logs --app osakamenesu-api
```

## 🔧 トラブルシューティング

### デプロイが失敗する場合

1. **FLY_API_TOKEN の確認**
   ```bash
   fly tokens list
   ```

2. **アプリケーション権限の確認**
   ```bash
   fly apps list
   ```

3. **ビルドエラー**
   - Dockerfile の構文確認
   - 依存関係の確認

### ロールバック手順

GitHub Actions から直接ロールバック：
1. Actions → 成功した過去のデプロイを選択
2. "Re-run jobs" → "Re-run all jobs"

または手動で：
```bash
fly releases --app osakamenesu-api
fly deploy --app osakamenesu-api --image <過去のイメージ>
```
