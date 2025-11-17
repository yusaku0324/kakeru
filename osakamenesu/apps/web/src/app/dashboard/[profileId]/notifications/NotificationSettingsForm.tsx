'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import {
  DashboardNotificationChannels,
  DashboardNotificationSettingsResponse,
  DashboardNotificationStatus,
  DashboardNotificationsConflict,
  DashboardNotificationsError,
  DashboardNotificationsValidationError,
  testDashboardNotificationSettings,
  updateDashboardNotificationSettings,
} from '@/lib/dashboard-notifications'

const STATUS_OPTIONS: { value: DashboardNotificationStatus; label: string }[] = [
  { value: 'pending', label: '仮受付 (pending)' },
  { value: 'confirmed', label: '確定 (confirmed)' },
  { value: 'declined', label: '辞退 (declined)' },
  { value: 'cancelled', label: 'キャンセル (cancelled)' },
  { value: 'expired', label: '期限切れ (expired)' },
]

type MessageState =
  | { type: 'idle' }
  | { type: 'success'; text: string }
  | { type: 'error'; text: string }
  | { type: 'info'; text: string }

type FieldErrors = {
  email?: string
  line?: string
  slack?: string
}

function normalizeRecipients(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toRecipientsText(recipients: string[]): string {
  return recipients.join('\n')
}

type FormState = {
  updatedAt: string
  triggerStatus: Set<DashboardNotificationStatus>
  channels: DashboardNotificationChannels
  emailInput: string
  lineTokenInput: string
  slackUrlInput: string
}

function buildInitialState(data: DashboardNotificationSettingsResponse): FormState {
  return {
    updatedAt: data.updated_at,
    triggerStatus: new Set(data.trigger_status),
    channels: JSON.parse(JSON.stringify(data.channels)) as DashboardNotificationChannels,
    emailInput: toRecipientsText(data.channels.email.recipients),
    lineTokenInput: data.channels.line.token ?? '',
    slackUrlInput: data.channels.slack.webhook_url ?? '',
  }
}

function validateForm(state: FormState): { formError?: string; fieldErrors: FieldErrors } | null {
  const channels = state.channels
  const enabledChannels = [channels.email.enabled, channels.line.enabled, channels.slack.enabled]
  const fieldErrors: FieldErrors = {}

  if (!enabledChannels.some(Boolean)) {
    return { formError: '少なくとも 1 つの通知チャネルを有効にしてください。', fieldErrors }
  }

  if (channels.email.enabled) {
    const recipients = normalizeRecipients(state.emailInput)
    if (!recipients.length) {
      fieldErrors.email = '宛先を 1 件以上入力してください。'
    } else if (recipients.length > 5) {
      fieldErrors.email = 'メール宛先は最大 5 件までです。'
    } else {
      const lowered = recipients.map((item) => item.toLowerCase())
      const hasDuplicate = lowered.some((item, index) => lowered.indexOf(item) !== index)
      if (hasDuplicate) {
        fieldErrors.email = '同じメールアドレスを重複して設定できません。'
      }
    }
  }

  if (channels.line.enabled) {
    const token = state.lineTokenInput.trim()
    if (!token) {
      fieldErrors.line = 'トークンを入力してください。'
    } else if (token.length < 40 || token.length > 60 || !/^[0-9A-Za-z_-]+$/.test(token)) {
      fieldErrors.line = 'LINE Notify トークンの形式が正しくありません。'
    }
  }

  if (channels.slack.enabled) {
    const url = state.slackUrlInput.trim()
    if (!url) {
      fieldErrors.slack = 'Webhook URL を入力してください。'
    } else if (!url.startsWith('https://hooks.slack.com/')) {
      fieldErrors.slack = 'Slack Webhook URL は https://hooks.slack.com/ で始まる必要があります。'
    }
  }

  if (fieldErrors.email || fieldErrors.line || fieldErrors.slack) {
    return { fieldErrors }
  }

  return null
}

function extractPayload(state: FormState): DashboardNotificationChannels {
  return {
    email: {
      enabled: state.channels.email.enabled,
      recipients: state.channels.email.enabled ? normalizeRecipients(state.emailInput) : [],
    },
    line: {
      enabled: state.channels.line.enabled,
      token: state.channels.line.enabled ? state.lineTokenInput.trim() || null : null,
    },
    slack: {
      enabled: state.channels.slack.enabled,
      webhook_url: state.channels.slack.enabled ? state.slackUrlInput.trim() || null : null,
    },
  }
}

function mergeConflict(conflict: DashboardNotificationSettingsResponse): FormState {
  return {
    updatedAt: conflict.updated_at,
    triggerStatus: new Set(conflict.trigger_status),
    channels: JSON.parse(JSON.stringify(conflict.channels)) as DashboardNotificationChannels,
    emailInput: toRecipientsText(conflict.channels.email.recipients),
    lineTokenInput: conflict.channels.line.token ?? '',
    slackUrlInput: conflict.channels.slack.webhook_url ?? '',
  }
}

type Props = {
  profileId: string
  initialData: DashboardNotificationSettingsResponse
}

export function NotificationSettingsForm({ profileId, initialData }: Props) {
  const [formState, setFormState] = useState<FormState>(() => buildInitialState(initialData))
  const [message, setMessage] = useState<MessageState>({ type: 'idle' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isPending, startTransition] = useTransition()
  const [updatedAtLabel, setUpdatedAtLabel] = useState('')

  useEffect(() => {
    setUpdatedAtLabel(new Date(formState.updatedAt).toLocaleString('ja-JP'))
  }, [formState.updatedAt])

  const triggerSelections = useMemo(
    () => Array.from(formState.triggerStatus),
    [formState.triggerStatus],
  )

  const handleToggleChannel = (key: keyof DashboardNotificationChannels) => {
    setFormState((prev) => {
      const nextChannels: DashboardNotificationChannels = {
        ...prev.channels,
        [key]: { ...prev.channels[key], enabled: !prev.channels[key].enabled },
      }
      if (key === 'line' && !nextChannels.line.enabled) {
        nextChannels.line = { enabled: false, token: null }
      }
      if (key === 'slack' && !nextChannels.slack.enabled) {
        nextChannels.slack = { enabled: false, webhook_url: null }
      }
      return { ...prev, channels: nextChannels }
    })
  }

  const handleStatusToggle = (status: DashboardNotificationStatus) => {
    setFormState((prev) => {
      const next = new Set(prev.triggerStatus)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return { ...prev, triggerStatus: next }
    })
  }

  const runWithValidation = async (
    action: () => Promise<
      | DashboardNotificationSettingsResponse
      | DashboardNotificationsConflict
      | DashboardNotificationsValidationError
      | DashboardNotificationsError
      | null
    >,
    successMessage: string,
  ) => {
    const validation = validateForm(formState)
    if (validation) {
      setFieldErrors(validation.fieldErrors)
      setMessage({ type: 'error', text: validation.formError ?? '入力内容を確認してください。' })
      return
    }

    startTransition(async () => {
      setMessage({ type: 'info', text: '処理中です…' })
      setFieldErrors({})
      const result = await action()
      if (!result) {
        return
      }
      if ('profile_id' in result) {
        setFormState(mergeConflict(result))
        setFieldErrors({})
        setMessage({ type: 'success', text: successMessage })
        return
      }

      if ('current' in result) {
        setFormState(mergeConflict(result.current))
        setFieldErrors({})
        setMessage({
          type: 'info',
          text: 'ほかのユーザーが設定を更新したため最新の内容を読み込みました。再度保存してください。',
        })
        return
      }

      if (result.status === 'validation_error') {
        setMessage({
          type: 'error',
          text: 'サーバー側のバリデーションでエラーが発生しました。入力内容を確認してください。',
        })
        return
      }

      setMessage({
        type: 'error',
        text:
          result.message ?? '処理中にエラーが発生しました。しばらくしてから再度お試しください。',
      })
    })
  }

  const handleSubmit = async () => {
    await runWithValidation(async () => {
      const payloadChannels = extractPayload(formState)
      const payloadTrigger = Array.from(formState.triggerStatus)
      const response = await updateDashboardNotificationSettings(profileId, {
        updated_at: formState.updatedAt,
        trigger_status: payloadTrigger,
        channels: payloadChannels,
      })

      switch (response.status) {
        case 'success':
          return response.data
        case 'conflict':
          return response
        case 'validation_error':
          return response
        case 'unauthorized':
          setMessage({ type: 'error', text: 'セッションが切れました。再度ログインしてください。' })
          return null
        case 'forbidden':
          setMessage({ type: 'error', text: '通知設定を更新する権限がありません。' })
          return null
        case 'not_found':
          setMessage({ type: 'error', text: '対象のプロフィールが見つかりません。' })
          return null
        case 'error':
        default:
          return response
      }
    }, '通知設定を保存しました。')
  }

  const handleTest = async () => {
    await runWithValidation(async () => {
      const payloadChannels = extractPayload(formState)
      const payloadTrigger = Array.from(formState.triggerStatus)
      const response = await testDashboardNotificationSettings(profileId, {
        trigger_status: payloadTrigger,
        channels: payloadChannels,
      })

      switch (response.status) {
        case 'success':
          return initialData
        case 'validation_error':
          return response
        case 'unauthorized':
          setMessage({ type: 'error', text: 'セッションが切れました。再度ログインしてください。' })
          return null
        case 'forbidden':
          setMessage({ type: 'error', text: '通知設定をテストする権限がありません。' })
          return null
        case 'not_found':
          setMessage({ type: 'error', text: '対象のプロフィールが見つかりません。' })
          return null
        case 'error':
        default:
          return response
      }
    }, 'テスト通知のバリデーションに成功しました。')
  }

  return (
    <section className="space-y-6 rounded border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">通知チャネル</h2>
          <p className="text-sm text-neutral-600">
            有効にする通知チャネルを選択し、必要な情報を入力してください。
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <input
              id="channel-email"
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={formState.channels.email.enabled}
              onChange={() =>
                setFormState((prev) => ({
                  ...prev,
                  channels: {
                    ...prev.channels,
                    email: {
                      ...prev.channels.email,
                      enabled: !prev.channels.email.enabled,
                    },
                  },
                }))
              }
            />
            <div className="flex-1">
              <label htmlFor="channel-email" className="font-medium text-neutral-800">
                メール通知
              </label>
              <p className="text-sm text-neutral-600">
                宛先は複数入力できます（改行またはカンマ区切り、最大 5 件）。
              </p>
              <textarea
                className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                rows={4}
                value={formState.emailInput}
                disabled={!formState.channels.email.enabled || isPending}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    emailInput: event.target.value,
                  }))
                }
                placeholder="store@example.com"
              />
              {formState.channels.email.enabled && fieldErrors.email && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="channel-line"
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={formState.channels.line.enabled}
              onChange={() => handleToggleChannel('line')}
            />
            <div className="flex-1">
              <label htmlFor="channel-line" className="font-medium text-neutral-800">
                LINE Notify
              </label>
              <p className="text-sm text-neutral-600">
                店舗が取得した LINE Notify トークンを入力します。
              </p>
              <input
                type="text"
                className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                value={formState.lineTokenInput}
                disabled={!formState.channels.line.enabled || isPending}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    lineTokenInput: event.target.value,
                  }))
                }
                placeholder="LINE Notify トークン"
              />
              {formState.channels.line.enabled && fieldErrors.line && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.line}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="channel-slack"
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={formState.channels.slack.enabled}
              onChange={() => handleToggleChannel('slack')}
            />
            <div className="flex-1">
              <label htmlFor="channel-slack" className="font-medium text-neutral-800">
                Slack Webhook
              </label>
              <p className="text-sm text-neutral-600">
                運営チャンネルの Slack Incoming Webhook URL を入力します。
              </p>
              <input
                type="url"
                className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
                value={formState.slackUrlInput}
                disabled={!formState.channels.slack.enabled || isPending}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    slackUrlInput: event.target.value,
                  }))
                }
                placeholder="https://hooks.slack.com/services/..."
              />
              {formState.channels.slack.enabled && fieldErrors.slack && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.slack}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">通知トリガー</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STATUS_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={formState.triggerStatus.has(option.value)}
                onChange={() => handleStatusToggle(option.value)}
                disabled={isPending}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {message.type !== 'idle' && (
        <div
          className={`rounded border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : message.type === 'error'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="inline-flex items-center rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {isPending ? '保存中…' : '設定を保存'}
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={isPending}
          className="inline-flex items-center rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-400"
        >
          テスト送信 (バリデーションのみ)
        </button>
        <p className="text-sm text-neutral-500">最後に保存した時刻: {updatedAtLabel || '---'}</p>
      </div>
    </section>
  )
}
