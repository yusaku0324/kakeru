# 姫デコ スクレイパー

姫デコ（https://spgirl.cityheaven.net/）の写メ日記プラットフォームをスクレイピングし、日記投稿を自動化するツールです。

## 機能

### 1. ログイン機能
- ユーザー認証
- クッキーの保存・読み込み
- セッション管理

### 2. 日記フォーム情報取得
- 投稿フォームのフィールド情報
- カテゴリ一覧
- アップロード制限（画像数、サイズ）
- 文字数制限

### 3. 日記投稿機能
- タイトル・本文の投稿
- カテゴリ選択
- 画像アップロード（最大3枚）

## セットアップ

### 1. 依存関係のインストール
```bash
pip install -r requirements.txt
```

### 2. アカウント設定
`accounts.yaml`にアカウント情報を追加：

```yaml
accounts:
  - screen_name: your_account_name
    cookie_path: cookies/your_account.json
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    proxy: null  # プロキシが必要な場合は設定
```

### 3. 環境変数（オプション）
`.env`ファイルで設定をカスタマイズ：

```env
HIMEDECO_URL=https://spgirl.cityheaven.net/
HIMEDECO_LOGIN_URL=http://spgirl.cityheaven.net/login/
```

## 使用方法

### ログイン（初回必須）
```bash
python 姫デコ.py --account your_account_name --username YOUR_USERNAME --password YOUR_PASSWORD --mode login
```

### 日記フォーム情報の取得
```bash
python 姫デコ.py --account your_account_name --mode scrape
```

### 日記の投稿
```bash
# 基本的な投稿
python 姫デコ.py --account your_account_name --mode post \
  --title "今日のタイトル" \
  --content "今日の出来事を書きます。"

# カテゴリと画像付き投稿
python 姫デコ.py --account your_account_name --mode post \
  --title "素敵な一日" \
  --content "今日は素晴らしい一日でした！" \
  --category "日常" \
  --images photo1.jpg photo2.jpg photo3.jpg
```

## コマンドラインオプション

| オプション | 説明 | 必須 |
|-----------|------|------|
| `--account` | アカウント名（accounts.yaml内のscreen_name） | ✓ |
| `--username` | ログインユーザー名 | loginモードで必須 |
| `--password` | ログインパスワード | loginモードで必須 |
| `--mode` | 実行モード（login/scrape/post） | |
| `--title` | 日記のタイトル | postモードで必須 |
| `--content` | 日記の本文 | postモードで必須 |
| `--category` | 日記のカテゴリ | |
| `--images` | アップロードする画像パス（スペース区切り） | |

## 注意事項

1. **初回実行時**：必ず`--mode login`でログインし、クッキーを保存してください

2. **セレクタの調整**：実際のサイトのHTML構造に合わせて、以下の部分の調整が必要な場合があります：
   - ログインフォームのフィールド名
   - 日記投稿フォームのフィールド名
   - ボタンやリンクのXPath/CSSセレクタ

3. **レート制限**：サーバーに負荷をかけないよう、適切な待機時間を設けています

4. **画像制限**：
   - 最大3枚まで
   - サポートされる形式：JPG, PNG, GIF（サイトの仕様による）
   - ファイルサイズ制限：5MB（サイトの仕様による）

5. **文字数制限**：
   - タイトル：最大50文字（サイトの仕様による）
   - 本文：最大2000文字（サイトの仕様による）

## トラブルシューティング

### ログインできない
- ユーザー名・パスワードが正しいか確認
- ログインURLが正しいか確認
- セレクタ（`By.NAME`の値）がサイトと一致しているか確認

### 日記が投稿できない
- ログイン状態が維持されているか確認
- 必須フィールドがすべて入力されているか確認
- 文字数制限を超えていないか確認

### エラーログの確認
```bash
tail -f himedeco_bot.log
```

## ログファイル

- `himedeco_bot.log`：実行ログ
- `cookies/`：アカウントごとのクッキー保存先
- `profiles/`：Chromeプロファイル保存先

## 開発者向け情報

### プロジェクト構造
```
姫デコ.py           # メインスクリプト
accounts.yaml      # アカウント設定
.env              # 環境変数（オプション）
cookies/          # クッキー保存ディレクトリ
profiles/         # Chromeプロファイル
himedeco_bot.log  # ログファイル
```

### カスタマイズ方法

1. **新しいフィールドの追加**：
   `get_diary_form_info()`関数に新しいフィールドの検出ロジックを追加

2. **投稿機能の拡張**：
   `post_diary()`関数に新しい機能を追加

3. **エラーハンドリングの改善**：
   各関数のtry-exceptブロックをカスタマイズ

## ライセンス

このプロジェクトのライセンスに従ってください。