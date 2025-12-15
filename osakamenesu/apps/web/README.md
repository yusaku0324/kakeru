# Osaka Men-Esu Web Frontend

This app powers the public reservation/search experience used throughout the project.

## 開発メモ

- **依存関係のインストール**（リポジトリ直下で実行）
  ```bash
  cd /Users/yusaku/Repositories/kakeru-local/osakamenesu
  pnpm install   # apps/web も postinstall で自動インストールされます
  ```
- **開発サーバー**
  ```bash
  pnpm dev          # API + Web を Doppler 経由で同時起動
  pnpm dev:web      # Web のみ起動（Doppler で環境変数注入）
  pnpm dev:api      # API のみ起動（参考）
  ```
- **ユニットテスト**
  ```bash
  doppler run --project osakamenesu --config dev_web -- \
    pnpm --dir apps/web run test:unit
  ```
- **E2E テスト（Playwright）**
  ```bash
  doppler run --project osakamenesu --config dev_web -- \
    pnpm --dir apps/web run test:e2e
  ```
  Doppler から注入される API ベース URL / Sentry DSN を利用するため、追加の `.env.local` は不要です。
- **STG 向けE2E（admin shift → search → reservation）**
  ```bash
  # NOTE: repo root の `.env` で `API_INTERNAL_BASE=http://osakamenesu-api:8000` が設定されているため、
  # ローカルで STG API を参照する場合は internal/public の両方を明示的に上書きしてください。
  OSAKAMENESU_API_INTERNAL_BASE=https://osakamenesu-api-stg.fly.dev \
  NEXT_PUBLIC_OSAKAMENESU_API_BASE=https://osakamenesu-api-stg.fly.dev \
  E2E_WEB_BASE=http://localhost:3000 \
  E2E_API_BASE=https://osakamenesu-api-stg.fly.dev \
  E2E_ADMIN_BASE=https://osakamenesu-api-stg.fly.dev \
  E2E_ADMIN_KEY=dev_admin_key \
  E2E_SHOP_ID=... \
  E2E_THERAPIST_ID=... \
  pnpm --dir apps/web exec playwright test e2e/shift_reservation_flow.spec.ts
  ```
  `E2E_API_BASE` が STG 以外の場合はテスト側で skip されます（prod write 防止）。
- **管理画面データのシード**
  ```bash
  doppler run --project osakamenesu --config dev_web -- \
    pnpm --dir apps/web run e2e:setup
  ```

### 通知設定のローカル確認

予約ステータス更新で外部通知を送るには以下の環境変数を設定してください。`pnpm dev` / `pnpm dev:web` で起動すると Doppler が自動注入します。

```bash
SENTRY_DSN=...                  # 任意 (Sentry 集約)
NEXT_PUBLIC_SENTRY_DSN=...
SLACK_ERROR_WEBHOOK_URL=https://hooks.slack.com/services/...
LINE_NOTIFY_TOKEN=LINE-Notify-Token
NOTIFY_EMAIL_ENDPOINT=http://localhost:8000/mock/email      # API サービス側
NOTIFY_LINE_ENDPOINT=http://localhost:8000/mock/line
MAIL_API_KEY=your-sendgrid-key
MAIL_FROM_ADDRESS=no-reply@example.com
```

ダッシュボードで承認／辞退すると Slack / LINE / Mail 側に通知が入る想定です。ローカルで簡易確認する場合は FastAPI を `pnpm dev` で起動するか、モックエンドポイント（`services/api`）を別途動かしてください。

## 参考リンク

- Playwright 設定: `playwright.config.ts`
- E2E シナリオ: `e2e/*.spec.ts`
- 予約関連コンポーネント: `src/components/ReservationOverlay.tsx`, `src/components/ReservationForm.tsx`

## E2E テストと CI の挙動

### CI の main / PR 挙動分離

シフト→空き状況の整合性テスト (`shift-to-availability-sync.spec.ts`, `shift-availability-contract.spec.ts`) は、ブランチによって CI の挙動が異なります：

| ブランチ | E2E失敗時 | 理由 |
|---------|----------|------|
| `main` | CI が **fail** | 本番の不整合は必ず検知 |
| PR | CI は **continue** | ノイズを抑えつつ Step Summary で可視化 |

### continue-on-error 検証手順

CI設定が正しく機能しているか確認したい場合：

1. **意図的に1テストを落とす**（ダミー失敗）
   ```typescript
   // e2e/shift-to-availability-sync.spec.ts に一時追加
   test('DUMMY FAIL TEST', async () => {
     expect(1).toBe(2) // 必ず失敗
   })
   ```

2. **PR で CI 実行** → E2E ステップは `continue-on-error` で続行されるはず
   - Step Summary に失敗情報が出力される
   - ジョブ全体は成功（緑）

3. **main にマージ後** → E2E ステップ失敗でジョブ全体が fail（赤）

4. **ダミーテストを削除して正常に戻す**

### Step Summary の見方

E2E失敗時、GitHub Actions の Step Summary に診断情報が出力されます。

**最初の5秒で確認すべき項目**（テーブル形式）：
- `therapist_id`: 対象セラピスト
- `jst_today`: JSTでの「今日」
- `api_slots`: API が返した open/blocked 数
- `ui_slots`: UI に表示された ●/△/× 数
- `min_api_time` / `min_ui_time`: 最短時刻の一致確認
- `差分`: 問題のあるレイヤー（API層 / UI層 / 不整合）

**詳細情報**（折りたたみ）：
- Card / API / UI の詳細
- API レスポンス全文（JSON）

### ゴールデンケースE2E skip/fail条件（v2 - 本番障害見逃し防止版）

#### 設計原則
- **SKIPは最小化**: 「本日」候補が0件の場合のみSKIP（本番データ事情）
- **候補が1件でも取れたら、必ずPASSかFAIL**（skipにしない）
- **全候補失敗 = FAIL**（skipにしない - 本番障害の可能性）

#### FAILカテゴリ定義

| カテゴリ | 名称 | 責任範囲 | 条件 | 確度 |
|---------|------|----------|------|------|
| **INFRA** | 本番障害 | API到達性 | HTTP 5xx, 4xx継続, タイムアウト | 高 |
| **A層** | API/生成層 | シフト→空き枠生成 | 7日構造不整合, open/tentative=0 | 高 |
| **B層** | UI変換層 | API→UI変換 | APIにスロットあるがUIスロット=0 | 高 |
| **C層** | 表示層 | DOM描画、data属性 | data属性契約違反, 最短時刻不一致 | 高/中 |

#### 診断ルール（優先順位順）

1. **INFRA (high)**: HTTPエラー
   - 条件: API HTTP 5xx または 4xx（404以外）
   - 原因: 本番API障害

2. **A層 (high)**: API構造違反
   - 条件: API応答が7日構造でない
   - 原因: API実装の問題

3. **A層 (high)**: APIにスロットがない
   - 条件: カードに「本日」表示があるが、APIの `open/tentative` スロットが0件
   - 原因: シフト→空き枠生成の問題

4. **B層 (high)**: UIカウントが0
   - 条件: APIに `open/tentative` スロットがあるが、UIの ●/△ カウントが0
   - 原因: API→UI変換層の問題

5. **C層 (high)**: data属性契約違反
   - 条件: `dataAttributeContract.valid === false`
   - 例: `data-start-minutes` がNaN、`data-date` がYYYY-MM-DD形式でない

6. **C層 (medium)**: 時刻不一致
   - 条件: API最短時刻とUI最短時刻が不一致
   - 原因: 表示層またはdata属性の問題

#### data属性契約仕様

UIスロット（`slot-available`, `slot-pending`, `slot-blocked`）は以下の契約に従う必要があります：

| 属性 | 型 | 必須 | 仕様 |
|------|-----|-----|------|
| `data-date` | string | ✓ | YYYY-MM-DD 形式 |
| `data-start-minutes` | number | ✓ | 0-1439（分単位、NaN不可） |
| `data-start-at` | string | - | ISO 8601 形式（存在する場合） |

契約違反は Layer C / confidence=high として検出されます。

### Step Summaryサンプル出力

#### PASS の場合

```markdown
## Outcome: ✅ PASS

**ゴールデンケース: 不変条件検証（自動候補探索）**

| 項目 | 値 |
|------|-----|
| **候補** | ももな |
| **therapist_id** | `abc123` |
| **jst_today** | 2025-12-12 |

### 不変条件チェック
| チェック項目 | 結果 |
|-------------|------|
| API 7日構造 | ✅ |
| API open/tentative ≥1 | ✅ |
| UI ●/△ ≥1 | ✅ |
| 最短時刻一致 | ✅ |
| data属性契約 | ✅ |
```

#### SKIP の場合（本日候補0件）

```markdown
## Outcome: ⏭️ SKIP

**ゴールデンケース: 不変条件検証（自動候補探索）**

### スキップ理由（データ事情）
> 「本日」ラベルを持つセラピストが見つからない (検索カード数: 15)

| 項目 | 値 |
|------|-----|
| **jst_today** | 2025-12-12 |
| **「本日」候補数** | 0 |
| **備考** | 本番データ事情によるスキップ（障害ではない） |
```

#### FAIL の場合（全3候補で失敗）

```markdown
## Outcome: ❌ FAIL

**ゴールデンケース: 不変条件検証（自動候補探索）**

### 🎯 主障害: 🔴 INFRA(本番障害) (確度: high)
> API HTTP 503 エラー

| 項目 | 値 |
|------|-----|
| **jst_today** | 2025-12-12 |
| **候補数** | 3 |
| **全候補失敗** | Yes - 全3候補で検証失敗 |

### 候補別結果
| # | 候補名 | 結果 | カテゴリ | HTTP | 理由 |
|---|--------|------|----------|------|------|
| 1 | ももな | ❌ | 🔴 INFRA(本番障害) | HTTP 503 | API HTTP 503 エラー |
| 2 | りさ | ❌ | 🔴 INFRA(本番障害) | HTTP 503 | API HTTP 503 エラー |
| 3 | あい | ❌ | 🔴 INFRA(本番障害) | HTTP 503 | API HTTP 503 エラー |
```

### 日付生成ロジックのユニットテスト

JST日付境界（23:30〜00:30）での不整合を防ぐため、`src/lib/availability-date-range.ts` に純粋関数を切り出し、ユニットテストでカバーしています。

```bash
# ユニットテスト実行
pnpm test:unit src/lib/availability-date-range.test.ts
```

テストカバレッジ：
- JST 00:00 境界（UTC 15:00）
- UTC実行環境（Vercel）シミュレート
- 7日連続生成
- 月末・年末境界
- `is_today` フラグの正確性

## コンテナ運用メモ

### 1. びっくりアップデート防止（digest固定）

`Dockerfile` ではマニフェストリストの digest（`node:22-alpine@sha256:b2358...`）を `ARG NODE_IMAGE` で固定済みです。別アーキ digest を確認したいときは以下のように取得できます。

```bash
docker manifest inspect node:22-alpine \
  | jq -r '.manifests[] | "\(.platform.os)/\(.platform.architecture)\t\(.digest)"'
```

単一アーキ向けに縛りたい場合は、上記一覧から該当 digest を `FROM node:22-alpine@sha256:<arch-specific>` に差し替えてください。

### 2. ローカルは arm64 を強制（Rosetta 回避）

`docker-compose` 側で `platform: linux/arm64` を宣言済みですが、単体ビルドする際も必ず arm64 を指定してください。

```bash
# ビルド
docker buildx build --platform linux/arm64 -t osakamenesu/web:dev .

# 実行テスト
docker run --rm --platform=linux/arm64 node:22-alpine uname -m  # → arm64 など
```

### 3. CI / 本番（amd64）との両立

Cloud Run など amd64 が前提でも、マルチアーキで push しておくと後から Arm 移行が容易です。

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t gcr.io/your-prj/osakamenesu-web:$(date +%Y%m%d%H%M) \
  --push .
```

上記は manifest index digest が固定されているため、両アーキで同一バージョン集合を必ず取得できます。

### 4. 依存イメージが arm64 を持っているか監査

```bash
docker compose config --images | xargs -I{} sh -c \
'printf "%-40s " "{}"; docker buildx imagetools inspect "{}" 2>/dev/null | sed -n "s/Platforms: //p"'
```

`linux/arm64` を含まないイメージだけ抽出されるので、差し替えや自前ビルドの要否を判断できます。

### 5. SBOM / プロベナンス / 署名

ビルド時に SBOM や provenance を吐き出し、`cosign` などで署名検証する運用を想定しています。

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --sbom=true --provenance=mode=max \
  -t gcr.io/your-prj/osakamenesu-web:$(git rev-parse --short HEAD) \
  --push .

cosign verify gcr.io/your-prj/osakamenesu-web@sha256:<digest>
```
