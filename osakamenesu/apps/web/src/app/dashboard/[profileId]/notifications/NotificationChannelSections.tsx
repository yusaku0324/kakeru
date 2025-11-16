'use client'

type BaseProps = {
  isPending: boolean
}

type EmailChannelProps = BaseProps & {
  enabled: boolean
  value: string
  error?: string
  onToggle: () => void
  onChange: (value: string) => void
}

type LineChannelProps = BaseProps & {
  enabled: boolean
  token: string
  webhook: string
  tokenError?: string
  webhookError?: string
  onToggle: () => void
  onTokenChange: (value: string) => void
  onWebhookChange: (value: string) => void
}

type SlackChannelProps = BaseProps & {
  enabled: boolean
  value: string
  error?: string
  onToggle: () => void
  onChange: (value: string) => void
}

export function EmailChannelSection({
  enabled,
  value,
  error,
  isPending,
  onToggle,
  onChange,
}: EmailChannelProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id="channel-email"
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={enabled}
        onChange={onToggle}
      />
      <div className="flex-1">
        <label htmlFor="channel-email" className="font-medium text-neutral-800">
          メール通知
        </label>
        <p className="text-sm text-neutral-600">宛先は複数入力できます（改行またはカンマ区切り、最大 5 件）。</p>
        <textarea
          className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
          rows={4}
          value={value}
          disabled={!enabled || isPending}
          onChange={(event) => onChange(event.target.value)}
          placeholder="store@example.com"
        />
        {enabled && error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}

export function LineChannelSection({
  enabled,
  token,
  webhook,
  tokenError,
  webhookError,
  isPending,
  onToggle,
  onTokenChange,
  onWebhookChange,
}: LineChannelProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id="channel-line"
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={enabled}
        onChange={onToggle}
      />
      <div className="flex-1">
        <label htmlFor="channel-line" className="font-medium text-neutral-800">
          LINE 通知（Messaging API）
        </label>
        <p className="text-sm text-neutral-600">
          店舗が取得したチャネルアクセストークンと Webhook URL を設定します。保存時に入力された URL へ自動で Webhook 設定を同期します。
        </p>
        <input
          type="text"
          className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
          value={token}
          disabled={!enabled || isPending}
          onChange={(event) => onTokenChange(event.target.value)}
          placeholder="チャネルアクセストークン"
        />
        {enabled && tokenError && <p className="mt-1 text-sm text-red-600">{tokenError}</p>}
        <input
          type="url"
          className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
          value={webhook}
          disabled={!enabled || isPending}
          onChange={(event) => onWebhookChange(event.target.value)}
          placeholder="https://example.com/api/line/webhook"
        />
        {enabled && (
          <p className="mt-1 text-xs text-neutral-500">
            保存すると、入力した Webhook URL が LINE Messaging API に同期されます。テスト環境ではスタブのエンドポイントを指定し、動作確認後に本番 URL へ切り替えてください。
          </p>
        )}
        {enabled && webhookError && <p className="mt-1 text-sm text-red-600">{webhookError}</p>}
      </div>
    </div>
  )
}

export function SlackChannelSection({
  enabled,
  value,
  error,
  isPending,
  onToggle,
  onChange,
}: SlackChannelProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id="channel-slack"
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={enabled}
        onChange={onToggle}
      />
      <div className="flex-1">
        <label htmlFor="channel-slack" className="font-medium text-neutral-800">
          Slack Webhook
        </label>
        <p className="text-sm text-neutral-600">運営チャンネルの Slack Incoming Webhook URL を入力します。</p>
        <input
          type="url"
          className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
          value={value}
          disabled={!enabled || isPending}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://hooks.slack.com/services/..."
        />
        {enabled && error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
