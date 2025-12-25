# Playwright Test Agents 導入ガイド

## 概要

Playwright 1.56+ の Test Agents 機能を使用して、テストプランの自動生成、テストコードの変換、失敗テストの自動修復を行います。

## Test Agents の種類

1. **🎭 Planner**: アプリケーションを探索してMarkdown形式のテストプランを生成
2. **🎭 Generator**: Markdownプランを実行可能なPlaywrightテストコードに変換
3. **🎭 Healer**: テスト実行で失敗した箇所を自動修復

## ディレクトリ構成

```
apps/web/
├── playwright-agents.config.js  # Test Agents専用の設定
├── tests/
│   └── agents/
│       └── seed.spec.js        # Plannerの探索起点
└── specs/                      # Plannerが生成するテストプラン
    └── *.md
```

## 使用方法

### 1. Planner でテストプランを生成

```bash
# Test Agents を使用してサイトを探索
npx playwright test --config=playwright-agents.config.js --ui
```

UIモードで以下を実行：

1. "🎭 Planner" タブを選択
2. プロンプトを入力（以下の例を参照）
3. "Generate" をクリック

#### プロンプト例（日本語サイト向け）

```
大阪メンエス検索サイト（https://osakamenesu.com）を探索して、主要な機能に関する包括的なテストプランを作成してください。

シードファイル: tests/agents/seed.spec.js を使用

以下をカバーするテストプランを作成してください：

1. ホームページからの主要導線
   - 店舗検索フロー
   - セラピスト検索フロー
   - エリア別検索

2. 店舗詳細ページ
   - 基本情報の表示
   - セラピスト一覧
   - 予約フロー開始

3. 検索機能
   - キーワード検索
   - 絞り込み検索
   - 検索結果の表示

4. ユーザー機能
   - ログイン/ログアウト
   - お気に入り機能
   - 予約履歴

テストプランは specs/ ディレクトリにMarkdownファイルとして保存してください。
```

#### 英語版プロンプト例

```
Explore the Osaka Men's Esthetic search site (https://osakamenesu.com) and create a comprehensive test plan for the main features.

Using seed file: tests/agents/seed.spec.js

Please create a test plan that covers:

1. Main user journeys from homepage:
   - Shop search flow
   - Therapist search flow
   - Area-based search

2. Shop detail pages:
   - Basic information display
   - Therapist listings
   - Reservation flow initiation

3. Search functionality:
   - Keyword search
   - Filter search
   - Search results display

4. User features:
   - Login/Logout
   - Favorite functionality
   - Reservation history

Save the test plan as Markdown files in the specs/ directory.
```

### 2. 生成されたテストプランの確認

Planner は `specs/` ディレクトリに以下のようなMarkdownファイルを生成します：

- `shop-search-flow.md`
- `therapist-search.md`
- `reservation-journey.md`
- `user-authentication.md`
- など

### 3. Generator でテストコードに変換

```bash
# Markdownプランからテストコードを生成
npx playwright test --config=playwright-agents.config.js --ui
```

UIモードで：
1. "🎭 Generator" タブを選択
2. 変換したいMarkdownファイルを選択
3. "Generate" をクリック

### 4. Healer で失敗テストを修復

テストが失敗した場合：

```bash
# テストを実行して失敗を検出
npx playwright test

# Healerで自動修復
npx playwright test --config=playwright-agents.config.js --ui
```

UIモードで：
1. "🎭 Healer" タブを選択
2. 失敗したテストを選択
3. "Heal" をクリック

## 注意事項

### セキュリティ考慮事項

- **本番環境での実行注意**: Plannerは実際にサイトを操作するため、本番環境では読み取り専用の操作に限定してください
- **認証情報**: ログインが必要な機能をテストする場合は、テスト用アカウントを使用してください
- **レート制限**: 過度な探索はサーバーに負荷をかける可能性があります

### bot検出対策

Osakamenesuサイトでbot検出に引っかかる場合：

1. **User-Agentの設定**:
```javascript
// playwright-agents.config.js に追加
use: {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
}
```

2. **探索速度の調整**:
```javascript
// ゆっくりとした操作
use: {
  actionTimeout: 5000,
  navigationTimeout: 30000,
}
```

3. **ヘッドレスモードを無効化**（既に設定済み）

### トラブルシューティング

#### Plannerが途中で止まる場合

1. タイムアウトを延長:
```javascript
timeout: 120 * 1000, // 2分に延長
```

2. より具体的なプロンプトを使用:
```
ホームページから店舗一覧ページへの遷移のみをテストするプランを作成してください
```

#### 生成されたテストプランが不完全な場合

1. シードテストをより詳細に:
```javascript
test('Open homepage with verification', async ({ page }) => {
  await page.goto(baseUrl)
  await expect(page).toHaveTitle(/大阪メンエス/)
  await expect(page.locator('nav')).toBeVisible()
  await expect(page.locator('main')).toBeVisible()
})
```

## ベストプラクティス

1. **段階的な探索**: 最初は小さな範囲から始めて、徐々に拡大
2. **定期実行**: サイトの変更を検出するため、定期的にPlannerを実行
3. **レビュープロセス**: 生成されたテストプランは必ずレビュー
4. **カスタマイズ**: 生成されたテストコードは必要に応じて手動で調整

## 統合方法

### CI/CDでの活用

```yaml
# .github/workflows/test-agents.yml
name: Test Agents Check

on:
  schedule:
    - cron: '0 2 * * 1' # 毎週月曜日の2時

jobs:
  test-plan-generation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: pnpm install
      - run: npx playwright install
      - run: npx playwright test --config=playwright-agents.config.js
      - uses: actions/upload-artifact@v4
        with:
          name: test-plans
          path: specs/
```

### 既存E2Eテストとの併用

- 既存の手動作成E2Eテスト: `e2e/` ディレクトリ
- Test Agentsで生成: `tests/agents/` と `specs/`
- 両方を組み合わせて包括的なテストカバレッジを実現

## 次のステップ

1. まずPlannerでサイトを探索してテストプランを生成
2. 生成されたプランをレビューして調整
3. Generatorでテストコードに変換
4. 既存のE2Eテストスイートに統合
5. CI/CDパイプラインに組み込み