# Admin Shops UI Story

## シナリオ概要
- **目的:** 管理者が店舗の基本情報・メニュー・スタッフ・空き枠を素早く確認・編集できること。
- **アクター:** 店舗運営スタッフ（Web 管理画面から操作）。
- **主なフロー:**
  1. 左側の店舗リストから対象店舗を選択 / 新規作成ボタンから空のフォームを開く。
  2. `ShopDetailForm` で基本情報・住所・連絡先・サービスタグを編集。
  3. `ShopPhotosSection`・`ShopMenusSection`・`ShopStaffSection` で各リストを編集（行追加・削除・タグ編集）。
  4. `ShopReservationSummary` で日付別の空き枠を編集し、保存ボタンから API へ同期。
  5. 保存ボタンは `canSave` 条件（必須項目）を満たしている場合のみ活性化。

## UI コンポーネントの役割
| コンポーネント | 役割 |
| --- | --- |
| `ShopList` | 店舗の選択 / 新規作成エントリ。 |
| `ShopDetailForm` | 基本情報・サービスタグ・連絡先を扱うフォーム。 |
| `ShopPhotosSection` | 掲載写真 URL のリスト操作。 |
| `ShopMenusSection` | メニューの価格/時間/説明/タグ編集。 |
| `ShopStaffSection` | スタッフ紹介文と専門分野の編集。 |
| `ShopReservationSummary` | 日付ごとの空き枠編集。API 保存前にローカルで検証。 |

## 状態とユースケース
- `useAdminShopsController` が店舗一覧・選択済み詳細・フォーム値を一元管理。
- Availability の削除は、保存済みの日付なら API で空配列を PUT、未保存日ならローカルのみで削除。
- `canSave` フラグにより、必須項目が空の場合は保存ボタンが非活性となり UX を向上。

## 検証方法
- Storybook 代替として本ドキュメントを参照しつつ、`pnpm test:unit` でフォーム/空き枠の挙動テストを実行。
- E2E (`pnpm exec playwright test e2e/admin-dashboard.spec.ts --grep "店舗情報"`) でも保存/差し戻しフローを担保。

## コンポーネント別サンプル (Storybook 代替)

| コンポーネント | サンプル | 注記 |
| --- | --- | --- |
| `ShopMenusSection` | `apps/web/src/features/shops/ui/__stories__/ShopMenusSection.stories.tsx` | 2件のメニューと追加/削除/編集フローを client component で確認可能。 |
| `ShopStaffSection` | `apps/web/src/features/shops/ui/__stories__/ShopStaffSection.stories.tsx` | スタッフ一覧・専門タグの編集を useState で再現。 |
| `ShopReservationSummary` | `apps/web/src/features/shops/ui/__stories__/ShopReservationSummary.stories.tsx` | 日付・枠の追加/削除、保存トースト処理のモックを含む。 |

各ストーリーファイルは `useState` で簡易的な状態管理を行い、モックコールバックのみで UI の結合や `data-testid` を確認できる。Storybook を起動せずに Next.js の通常ページとして import すれば視覚確認が可能。

### Storybook / Chromatic 実行方法

```
cd apps/web
pnpm storybook             # ポート6006でローカル Storybook を起動
pnpm build-storybook       # storybook-static/ に静的ビルドを生成
CHROMATIC_PROJECT_TOKEN=xxxxx pnpm chromatic  # Chromatic へアップロード
```

- Chromatic 実行時は `CHROMATIC_PROJECT_TOKEN` を GitHub Secrets などに設定しておく。
- `story-storybook` コマンドは Next.js の設定 (`next.config.js`) を共有するよう `.storybook/main.ts` で指定済み。
- CI では `.github/workflows/ci-web.yml` の `web-storybook` ジョブが `pnpm build-storybook` → Chromatic 送信を自動で実行。`CHROMATIC_PROJECT_TOKEN` が未設定の場合はアップロードをスキップし、ビルドのみ通過する。
