# Database Backup Scripts

このディレクトリには、Osakamenesuプロジェクトのデータベースバックアップ関連スクリプトが含まれています。

## スクリプト一覧

### 1. backup-database.sh
データベースのバックアップを作成するスクリプトです。

**使用方法:**
```bash
# ローカルバックアップのみ
./backup-database.sh

# S3/R2にもアップロード
./backup-database.sh --upload
```

**必要な環境変数:**
- `DATABASE_URL`: データベース接続URL（必須）
- `BACKUP_S3_BUCKET`: S3バケット名（アップロード時のみ）
- `BACKUP_S3_ENDPOINT`: S3エンドポイントURL（アップロード時のみ）
- `AWS_ACCESS_KEY_ID`: AWSアクセスキー（アップロード時のみ）
- `AWS_SECRET_ACCESS_KEY`: AWSシークレットキー（アップロード時のみ）

### 2. restore-database.sh
バックアップからデータベースを復元するスクリプトです。

**使用方法:**
```bash
# ローカルファイルから復元
./restore-database.sh backup_20240315_040000.sql.gz

# S3/R2からダウンロードして復元
./restore-database.sh backup_20240315_040000.sql.gz --from-s3
```

**注意事項:**
- データベース全体が上書きされます
- 実行前に確認プロンプトが表示されます
- 復元後、自動的にAlembicマイグレーションが実行されます

### 3. test-backup-restore.sh
バックアップ・リストア機能をテストするスクリプトです。

**使用方法:**
```bash
./test-backup-restore.sh
```

**テスト内容:**
1. バックアップの作成
2. バックアップファイルの検証
3. 必要なテーブルの存在確認
4. S3/R2接続のテスト（設定されている場合）

### 4. generate-api-docs.py
OpenAPIドキュメントを生成するPythonスクリプトです。

**使用方法:**
```bash
python generate-api-docs.py
```

**出力:**
- `api-docs/index.html`: Swagger UI + ReDoc統合版
- `api-docs/openapi.json`: OpenAPIスキーマ
- `api-docs/redoc.html`: ReDoc単体版
- `api-docs/api-reference.md`: Markdownドキュメント

## セットアップ手順

### 1. PostgreSQLクライアントツールのインストール

**macOS:**
```bash
brew install postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-client
```

### 2. AWS CLIのインストール（S3/R2を使用する場合）

**macOS:**
```bash
brew install awscli
```

**Ubuntu/Debian:**
```bash
sudo apt-get install awscli
```

### 3. 環境変数の設定

`.env`ファイルを作成:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
BACKUP_S3_BUCKET=your-backup-bucket
BACKUP_S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

## GitHub Actionsとの統合

`.github/workflows/db-backup.yml`が設定されており、以下のGitHub Secretsを設定することで自動バックアップが有効になります:

- `RAILWAY_DATABASE_URL`
- `BACKUP_S3_BUCKET`
- `BACKUP_S3_ENDPOINT`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SLACK_WEBHOOK_URL`（オプション）

## トラブルシューティング

### pg_dumpが見つからない場合
PostgreSQLクライアントツールがインストールされていることを確認してください。

### S3アップロードが失敗する場合
1. AWS認証情報が正しいか確認
2. バケットが存在するか確認
3. IAMポリシーで必要な権限があるか確認

### リストアが失敗する場合
1. データベースユーザーに必要な権限があるか確認
2. バックアップファイルが破損していないか確認
3. PostgreSQLのバージョンに互換性があるか確認

## 安全上の注意

- 本番環境でリストアを実行する前に必ずバックアップを取得してください
- `test-backup-restore.sh`は本番環境では実行しないでください
- バックアップファイルには機密情報が含まれる可能性があるため、適切に管理してください
