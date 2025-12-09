'use client'

import clsx from 'clsx'
import { ReactNode, useEffect, useMemo, useState, useTransition } from 'react'

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

const STATUS_OPTIONS: {
  value: DashboardNotificationStatus
  label: string
  icon: string
  color: string
}[] = [
  { value: 'pending', label: '仮受付', icon: '⏳', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { value: 'confirmed', label: '確定', icon: '✅', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { value: 'declined', label: '辞退', icon: '🚫', color: 'bg-red-50 border-red-200 text-red-700' },
  { value: 'cancelled', label: 'キャンセル', icon: '❌', color: 'bg-neutral-100 border-neutral-300 text-neutral-700' },
  { value: 'expired', label: '期限切れ', icon: '⏰', color: 'bg-slate-100 border-slate-300 text-slate-700' },
]

const CHANNEL_CONFIG = {
  email: {
    icon: '📧',
    label: 'メール通知',
    description: '宛先は複数入力できます（改行またはカンマ区切り、最大 5 件）',
    color: 'from-blue-500 to-blue-600',
    bgActive: 'bg-blue-50 border-blue-200',
  },
  line: {
    icon: '💬',
    label: 'LINE Notify',
    description: '店舗が取得した LINE Notify トークンを入力します',
    color: 'from-green-500 to-green-600',
    bgActive: 'bg-green-50 border-green-200',
  },
  slack: {
    icon: '🔔',
    label: 'Slack Webhook',
    description: '運営チャンネルの Slack Incoming Webhook URL を入力します',
    color: 'from-purple-500 to-purple-600',
    bgActive: 'bg-purple-50 border-purple-200',
  },
}

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

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
            {icon}
          </span>
          <div>
            <h3 className="font-semibold text-neutral-900">{title}</h3>
            {description && <p className="text-sm text-neutral-500">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function ChannelCard({
  channelKey,
  enabled,
  onToggle,
  disabled,
  error,
  children,
}: {
  channelKey: keyof typeof CHANNEL_CONFIG
  enabled: boolean
  onToggle: () => void
  disabled: boolean
  error?: string
  children: ReactNode
}) {
  const config = CHANNEL_CONFIG[channelKey]

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-2xl border-2 transition-all duration-200',
        enabled ? config.bgActive : 'border-neutral-200 bg-white',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={clsx(
          'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <div
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all',
            enabled ? `bg-gradient-to-br ${config.color} text-white shadow-lg` : 'bg-neutral-100',
          )}
        >
          {config.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-900">{config.label}</span>
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500',
              )}
            >
              {enabled ? '有効' : '無効'}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">{config.description}</p>
        </div>
        <div
          className={clsx(
            'h-6 w-11 rounded-full p-0.5 transition-colors',
            enabled ? 'bg-emerald-500' : 'bg-neutral-300',
          )}
        >
          <div
            className={clsx(
              'h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
              enabled && 'translate-x-5',
            )}
          />
        </div>
      </button>

      {enabled && (
        <div className="border-t border-neutral-200/50 bg-white/80 px-5 py-4">
          {children}
          {error && (
            <p className="mt-2 flex items-center gap-1 text-sm text-red-600">
              <span>⚠️</span>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function StatusToggle({
  option,
  checked,
  onChange,
  disabled,
}: {
  option: (typeof STATUS_OPTIONS)[number]
  checked: boolean
  onChange: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={clsx(
        'flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all',
        checked
          ? option.color
          : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="text-lg">{option.icon}</span>
      <span>{option.label}</span>
      {checked && (
        <svg className="ml-auto h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  )
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

  const enabledChannelsCount = [
    formState.channels.email.enabled,
    formState.channels.line.enabled,
    formState.channels.slack.enabled,
  ].filter(Boolean).length

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
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">通知設定</h2>
          <p className="mt-1 text-sm text-neutral-600">
            予約ステータスが変更されたときに通知を受け取る設定を管理します
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm">
            <span className="text-lg">📡</span>
            <span className="font-medium text-neutral-700">
              {enabledChannelsCount} チャネル有効
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm">
            <span className="text-lg">🎯</span>
            <span className="font-medium text-neutral-700">
              {triggerSelections.length} トリガー設定
            </span>
          </div>
        </div>
      </div>

      {/* Notification channels */}
      <SectionCard
        icon="📬"
        title="通知チャネル"
        description="通知を受け取るチャネルを選択してください"
      >
        <div className="space-y-4">
          {/* Email */}
          <ChannelCard
            channelKey="email"
            enabled={formState.channels.email.enabled}
            onToggle={() =>
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
            disabled={isPending}
            error={fieldErrors.email}
          >
            <textarea
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition-colors focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-neutral-100"
              rows={3}
              value={formState.emailInput}
              disabled={isPending}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  emailInput: event.target.value,
                }))
              }
              placeholder="store@example.com&#10;manager@example.com"
            />
          </ChannelCard>

          {/* LINE */}
          <ChannelCard
            channelKey="line"
            enabled={formState.channels.line.enabled}
            onToggle={() => handleToggleChannel('line')}
            disabled={isPending}
            error={fieldErrors.line}
          >
            <input
              type="text"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition-colors focus:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-100 disabled:bg-neutral-100"
              value={formState.lineTokenInput}
              disabled={isPending}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  lineTokenInput: event.target.value,
                }))
              }
              placeholder="LINE Notify トークンを入力"
            />
          </ChannelCard>

          {/* Slack */}
          <ChannelCard
            channelKey="slack"
            enabled={formState.channels.slack.enabled}
            onToggle={() => handleToggleChannel('slack')}
            disabled={isPending}
            error={fieldErrors.slack}
          >
            <input
              type="url"
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition-colors focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100 disabled:bg-neutral-100"
              value={formState.slackUrlInput}
              disabled={isPending}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  slackUrlInput: event.target.value,
                }))
              }
              placeholder="https://hooks.slack.com/services/..."
            />
          </ChannelCard>
        </div>
      </SectionCard>

      {/* Trigger status */}
      <SectionCard
        icon="🎯"
        title="通知トリガー"
        description="どのステータス変更で通知を受け取るか選択してください"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STATUS_OPTIONS.map((option) => (
            <StatusToggle
              key={option.value}
              option={option}
              checked={formState.triggerStatus.has(option.value)}
              onChange={() => handleStatusToggle(option.value)}
              disabled={isPending}
            />
          ))}
        </div>
      </SectionCard>

      {/* Message */}
      {message.type !== 'idle' && (
        <div
          className={clsx(
            'flex items-center gap-3 rounded-2xl border-2 px-5 py-4',
            message.type === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
            message.type === 'error' && 'border-red-200 bg-red-50 text-red-700',
            message.type === 'info' && 'border-blue-200 bg-blue-50 text-blue-700',
          )}
        >
          <span className="text-xl">
            {message.type === 'success' ? '✅' : message.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <p className="flex-1 text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Action footer */}
      <div className="sticky bottom-0 -mx-4 bg-gradient-to-t from-white via-white to-white/80 px-4 pb-4 pt-4 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <span className="text-lg">🕐</span>
            <span>最終更新: {updatedAtLabel || '---'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-neutral-200 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>🧪</span>
              テスト送信
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-primary/25 transition-all hover:shadow-xl hover:shadow-brand-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>保存中…</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>設定を保存</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
