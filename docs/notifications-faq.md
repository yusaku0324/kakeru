# 通知機能 FAQ（店舗サポート・開発者向け）

通知に関するよくある質問と、サポート対応時に確認すべきポイントをまとめています。メール／Slack／LINE 通知すべてを横断的に扱うため、問い合わせ一次対応やデバッグに活用してください。

## 共通チェックリスト

1. **通知設定ページの有効化状況**  
   - `/dashboard/<profileId>/notifications` の各チャネルが ON になっているか。  
   - 「設定を保存」直後に緑のサクセスメッセージが表示されたか。
2. **トリガーステータス**  
   - 対象イベント（pending/confirmed/declined など）がチェックされているか。  
   - 予約の現在ステータスと一致しているか。
3. **最新の設定が適用されているか**  
   - 直近で別ユーザーが更新していないか（競合時は青メッセージが出る）。  
   - `updated_at` タイムスタンプが想定どおり（タイムゾーンに注意）。
4. **バックエンドログ**  
   - `services/api` の通知ワーカーがエラーを出していないか。  
   - `notifications` テーブルに pending レコードが滞留していないか。

## メール通知

| 問題 | 確認事項 | 解決のヒント |
| ---- | -------- | ------------ |
| メールが届かない | 宛先が 1 件以上入力されているか / 重複・無効な形式ではないか | UI バリデーションで警告が出る。`normalizeRecipients()` は改行/カンマ区切り対応。 |
| 届くが迷惑メールに分類される | 送信ドメイン認証（SPF/DKIM）が設定済みか | Resend/SendGrid のダッシュボードでドメインステータス確認。 |
| 特定ステータスだけ送られない | `trigger_status` が対象ステータスを含むか | `pending` と `confirmed` がデフォルト。辞退/キャンセルは手動で追加。 |
| テスト送信が成功しない | SMTP/TLS 設定が正しいか (`NOTIFY_SMTP_*`) | `.env` のホスト/ポート/ユーザーを再確認。 |

## Slack Webhook

| 問題 | 確認事項 | 解決のヒント |
| ---- | -------- | ------------ |
| Webhook URL を貼り付けても保存できない | `https://hooks.slack.com/services/...` 形式か | ワークスペースの「受信 Webhook」アプリから取得。 |
| メッセージがチャンネルに表示されない | Webhook URL が失効していないか | Slack 側のセキュリティ設定で失効している場合がある。再生成して再保存。 |
| リンク展開がない | Slack のチャンネル設定で「リンクのプレビュー」が無効か | チャンネル > さらに表示 > 通知カスタマイズから設定。 |

## LINE 通知

詳細な UX 手順は `docs/line-webhook-notification-ux.md` を参照。

| 問題 | 確認事項 | 解決のヒント |
| ---- | -------- | ------------ |
| 保存時に「Webhook の更新に失敗しました」 | チャネルアクセストークンが無効/権限不足か、Webhook URL が 403 を返していないか | LINE Developers でチャネル設定を確認。URL が BASIC 認証等で保護されていないか。 |
| 予約時に通知が来ない | Webhook 受信サーバーの署名検証で 403 を返していないか | `X-Line-Signature` の検証コードを確認。ログに署名失敗が出ていないか。 |
| 複数店舗で共有したい | チャネルを店舗単位で分けるのが推奨 | 同一チャネルを使う場合、Webhook URL は上書きされる点に注意。 |
| LINE 側で再発行したトークンを忘れた | トークン再発行後は元のトークンが無効になる | 新トークンに更新するまで全通知が失敗するので早めに差し替える。 |

## 予約競合・通知抑制

- 同時間帯の予約が競合した場合、ダッシュボードから黄色の警告が表示される。競合状態で承認した場合でも通知は送信されるが、オペレーションとしては要注意。  
- 「再送」フローは未実装のため、通知失敗時はログを確認しつつ設定を見直し、必要であれば手動フォローする。

## ログ確認のポイント

| ログ場所 | 内容 |
| -------- | ---- |
| `services/api/app/notifications.py` | Slack/LINE/メールの送信処理。例外発生時は `notification worker iteration failed` が表示。 |
| `services/api/app/domains/dashboard/notifications/router.py` | 保存時のバリデーションと LINE Webhook 同期。HTTP 422 で詳細が出力。 |
| `apps/web/src/app/dashboard/[profileId]/notifications/NotificationSettingsForm.tsx` | フロント側のエラーメッセージ。必要に応じて翻訳/文言を調整。 |

## よくある運用質問

1. **「テスト送信 (バリデーションのみ)」は実際に通知されますか？**  
   → いいえ。サーバー側バリデーションと LINE Webhook 同期のシミュレーションのみ。  
2. **通知履歴は確認できますか？**  
   → 現状は管理画面の予約フィードでステータスを確認。詳細なログは今後開発予定。  
3. **通知の再送はできますか？**  
   → 未対応。失敗時は設定を修正した上で予約ステータスを更新し、手動でフォローする。  
4. **テスト環境・本番環境で設定を切り替えたい**  
   → プロフィール単位で設定が保存されるため、環境ごとに別プロフィールを用意するか、保存時に URL を切り替える。  
5. **API 経由で設定を変更できますか？**  
   → `/api/dashboard/shops/{profileId}/notifications` で GET/PUT が可能（Cookie 認証必須）。SaaS 連携時に利用。

## 参考資料

- `docs/line-webhook-notification-ux.md`
- `services/api/app/domains/dashboard/notifications/router.py`
- `apps/web/src/lib/dashboard-notifications.ts`
- `services/api/app/tests/test_notifications_queue.py`
- `docs/notification-worker.md`
