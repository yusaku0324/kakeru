# LINE Webhook 通知設定 UX ガイド

LINE Messaging API で予約通知を受け取るための UI フローと、店舗担当者が入力時に遭遇するメッセージをまとめています。ダッシュボードの文言を変更する際や、サポート FAQ を更新する際のリファレンスとして利用してください。

## 対象画面

- パス: `/dashboard/<profileId>/notifications`
- コンポーネント: `NotificationSettingsForm`
- LINE 関連フィールド:
  - 「LINE 通知（Messaging API）」トグル
  - 「チャネルアクセストークン」テキストボックス
  - 「Webhook URL」URL 入力欄
  - 「設定を保存」「テスト送信 (バリデーションのみ)」ボタン

## 事前に準備するもの

1. **LINE Developers コンソールで作成済みの Messaging API チャネル**
   - チャネルは **ボットプロバイダー > Messaging API** で作成。
   - チャネル基本設定 > メッセージ送受信設定 で「Webhook を利用する」を ON にしておく。
2. **チャネルアクセストークン (長期)**  
   - コンソールの「Messaging API 設定」から発行。40 文字以上。
   - 発行後は安全な場所に控えておき、再発行時は UI から再設定が必要。
3. **Webhook 受信エンドポイント (https)**  
   - `https://` で始まる公開 URL。
   - ステージング/本番で URL を分ける場合は、それぞれの環境に合わせたエンドポイントを用意。

## 入力ステップ

1. 管理画面で対象店舗の通知設定ページを開く。
2. 「LINE 通知（Messaging API）」のチェックボックスを ON にする。  
   → フィールドが有効化され、説明文が表示される。
3. 「チャネルアクセストークン」に LINE Developers で発行したトークンを貼り付ける。
4. 「Webhook URL」に受信エンドポイント (例: `https://example.com/api/line/webhook`) を入力する。
5. 必要に応じてメールや Slack も同時に設定する（少なくとも 1 チャネルを有効化しておく必要あり）。
6. 画面下部の「設定を保存」をクリック。

## 保存時の挙動

| 状況 | 期待される表示 | 補足 |
| ---- | -------------- | ---- |
| バリデーション成功 → API 成功 | 緑のアラートで「通知設定を保存しました。」 | `https://api.line.me/v2/bot/channel/webhook/urls` へ PUT、続けて `/enable` を POST。両方 2xx で完了。 |
| ローカルバリデーションエラー | 赤のアラートで「入力内容を確認してください。」| 下記「バリデーションメッセージ」を参照。該当フィールド下に赤字が表示される。 |
| 保存中 | 青のアラートで「処理中です…」 | `useTransition` によりボタンは disabled。 |
| 楽観ロックにより競合 | 青のアラートで「ほかのユーザーが設定を更新したため…」 | 最新の値がフォームへ再読み込みされる。改めて保存。 |
| LINE 側 API エラー | 赤のアラートで「Webhook の更新/有効化に失敗しました (status=xxx)」 | 不正なトークン・権限不足・URL 無効など。 |
| セッション切れ | 赤のアラートで「セッションが切れました。再度ログインしてください。」 | Cookie 期限切れ時。 |

### バリデーションメッセージ一覧

| フィールド | メッセージ | トリガー条件 |
| ---------- | ---------- | ------------ |
| 全体 | 「少なくとも 1 つの通知チャネルを有効にしてください。」 | 3 チャネルすべて OFF のまま保存。 |
| メール | 「宛先を 1 件以上入力してください。」 | 有効化済みだが宛先が空。 |
| メール | 「メール宛先は最大 5 件までです。」 | 6 件以上入力。 |
| メール | 「同じメールアドレスを重複して設定できません。」 | 大文字/小文字を無視した重複。 |
| LINE トークン | 「トークンを入力してください。」 | フィールドが空。 |
| LINE トークン | 「LINE チャネルアクセストークンの形式が正しくありません。」 | 40 文字未満 / 記号が含まれる。 |
| LINE Webhook | 「Webhook URL を入力してください。」 | フィールドが空。 |
| LINE Webhook | 「Webhook URL は https:// で始まる必要があります。」 | http / ftp など別プロトコル。 |

## テスト送信 (バリデーションのみ)

- 「テスト送信 (バリデーションのみ)」ボタンは **LINE への API 呼び出しや実際の通知送信を行いません**。
- サーバー側バリデーションを再度実行し、成功時は青いアラートで「テスト通知のバリデーションに成功しました。」が表示される。
- Webhook 実配信の確認は、LINE Developers の「接続確認」や実際の予約フローで行う。

## よくある質問

- **Webhook URL に BASIC 認証を付けたい**  
  → LINE 側は 401 を返すと再試行時も失敗するため、固定トークンや署名検証で保護する。
- **ステージングと本番で URL を切り替えるには？**  
  → 通知設定のプロフィール単位で保持されるため、環境ごとに別プロフィールを使うか、保存時に目的の URL に入れ替える。
- **複数店舗の設定は共有可能？**  
  → チャネルアクセストークンはチャネルごとに異なるため、店舗ごとに別の LINE チャネルを用意するのが安全。

## 運用メモ

- LINE 側でトークンを再発行した場合は、必ずダッシュボードで新しい値に更新し直す。
- 受信エンドポイントでは `X-Line-Signature` を検証し、不正リクエストを拒否する。
- 監視用に Webhook サーバーで 4xx/5xx を計測し、Slack/メールへ通知できるようにしておく。

---

## 添付スクリーンショット（準備ガイド）

管理画面の UI が更新された際は、本ドキュメントに最新の画面キャプチャを添付して共有してください。

1. `apps/web` をローカルで起動し、通知設定ページを操作する。ブラウザ幅は 1440px 程度を基準にする。
2. 以下の状態を順番にキャプチャする（png 推奨、Retina の場合は 2x サイズ可）:
   - LINE チャネルが OFF → ON になる瞬間
   - トークン／Webhook URL を入力したフォーム
   - 保存完了後のサクセスメッセージ
   - バリデーションエラー表示例
3. 画像は `docs/images/notifications/` 配下に `line-settings-01.png` のような連番で配置し、Git で管理する。
4. 本ドキュメント内の該当セクションへ `![LINE 設定フォーム](images/notifications/line-settings-01.png)` の形式で埋め込む。
5. 旧スクリーンショットとの差分が大きい場合は、該当リリースノートにも記載する。

### Playwright を使って自動撮影する場合

`osakamenesu/apps/web` には Playwright を利用したキャプチャスクリプトがあります。

```bash
cd osakamenesu/apps/web
E2E_TEST_AUTH_SECRET=local-secret \
SCREENSHOT_BASE_URL=http://127.0.0.1:3000 \
npm run screenshot:notifications
```

- `E2E_TEST_AUTH_SECRET`（または `TEST_AUTH_SECRET`）を渡すと `/api/auth/test-login` で自動ログインします。  
- スクリーンショットは既定で `docs/images/notifications/line-settings-01.png` に保存。`--output` オプションで変更可能です。  
- 実行前に Next.js アプリが稼働していること、ダッシュボードで参照できる店舗データがあることを確認してください。
- 保存後の成功メッセージを撮影したい場合は `--state saved`。バリデーションエラー表示を撮影したい場合は `--state error` を指定します（例: `npm run screenshot:notifications -- --state error --output ../../../docs/images/notifications/line-settings-03.png`）。

---

## クイックスタート（店舗担当者向け抜粋）

1. LINE Developers で **Messaging API チャネル** を作成し、チャネルアクセストークン (長期) を発行する。  
2. Webhook URL（https で公開された予約通知エンドポイント）を用意する。テスト環境は別 URL にする。  
3. 管理画面 → 通知設定で「LINE 通知」を ON にし、アクセストークンと Webhook URL を貼り付けて保存。  
4. 保存メッセージが緑色で表示されたら成功。LINE Developers の「接続確認」で 200 が返るか確認する。  
5. 予約をテスト登録し、LINE チャットまたは管理ボットにメッセージが届くかチェック。  
6. トークンを再発行した場合は必ず再設定し、未使用のトークンは速やかに無効化する。

![LINE 通知設定フォームの例](images/notifications/line-settings-01.png)

![保存成功メッセージの例](images/notifications/line-settings-02.png)

![バリデーションエラー表示の例](images/notifications/line-settings-03.png)

## Webhook テスト手順

本番公開前に、Webhook 受信 API が正しくレスポンスするかを手元で確認します。

1. **署名用のチャネルシークレットをメモ**  
   - LINE Developers > Messaging API 設定 > 基本設定の「チャネルシークレット」を控える。
2. **テストペイロードを用意**  
   ```json
   {
     "destination": "U0123456789abcdef0123456789abcdef",
     "events": []
   }
   ```
3. **署名ヘッダを作成**  
   - `Channel Secret` を鍵、リクエストボディ（JSON 文字列）をメッセージとして HMAC-SHA256 を計算し、Base64 エンコードした値が `X-Line-Signature`。
   - 例: Python
     ```python
     import base64, hmac, hashlib, json

     body = {"destination": "U0123456789abcdef0123456789abcdef", "events": []}
     payload = json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
     secret = "YOUR_CHANNEL_SECRET".encode("utf-8")
     signature = base64.b64encode(hmac.new(secret, payload, hashlib.sha256).digest()).decode()
     print(signature)
     ```
4. **curl で送信**
   ```bash
   curl -X POST "https://{your-domain}/api/line/webhook" \
     -H "Content-Type: application/json" \
     -H "X-Line-Signature: ${SIGNATURE}" \
     --data '{"destination":"U0123456789abcdef0123456789abcdef","events":[]}'
   ```
5. **期待値**  
   - ステータスコード 200 (もしくは 204)。レスポンス本文は空、または `{"ok":true}` など任意。  
   - 署名が一致しない場合は 403 を返すよう実装しておく。

## サポート問い合わせテンプレート

```
件名: LINE 通知が受信できません
店舗ID / 店舗名:
発生日時:
入力した Webhook URL:
チャネルアクセストークンの再発行有無:
LINE Developers での接続確認ステータス (200/4xx 等):
管理画面のエラーメッセージ:
```

店舗担当者から問い合わせが来た場合は上記テンプレートを案内し、最低限の情報を揃えてもらってから調査に着手する。
