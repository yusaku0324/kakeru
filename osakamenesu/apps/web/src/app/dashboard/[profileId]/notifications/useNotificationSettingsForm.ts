'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import {
  DashboardNotificationChannels,
  DashboardNotificationSettingsResponse,
  DashboardNotificationStatus,
  DashboardNotificationsConflict,
  DashboardNotificationsError,
  DashboardNotificationsSuccess,
  DashboardNotificationsValidationError,
  testDashboardNotificationSettings,
  updateDashboardNotificationSettings,
} from '@/lib/dashboard-notifications'

const RECIPIENT_SEPARATOR = /[,\n]/

type MessageState =
  | { type: 'idle' }
  | { type: 'success'; text: string }
  | { type: 'error'; text: string }
  | { type: 'info'; text: string }

export type FieldErrors = {
  email?: string
  line?: string
  lineWebhook?: string
  slack?: string
}

type FormState = {
  updatedAt: string
  triggerStatus: Set<DashboardNotificationStatus>
  channels: DashboardNotificationChannels
  emailInput: string
  lineTokenInput: string
  lineWebhookInput: string
  slackUrlInput: string
}

type RunWithValidationResult =
  | DashboardNotificationSettingsResponse
  | DashboardNotificationsSuccess
  | DashboardNotificationsConflict
  | DashboardNotificationsValidationError
  | DashboardNotificationsError
  | null

const SERVER_FIELD_MAP: Record<string, keyof FieldErrors> = {
  email: 'email',
  line: 'line',
  line_token: 'line',
  line_webhook: 'lineWebhook',
  slack: 'slack',
}

export function mapServerValidationErrors(detail: unknown): {
  fieldErrors: FieldErrors
  message?: string
} {
  const fieldErrors: FieldErrors = {}
  const messages: string[] = []

  const assignError = (field: string | undefined, message: string | undefined) => {
    if (field) {
      const key = SERVER_FIELD_MAP[field]
      if (key) {
        fieldErrors[key] = message ?? '入力内容を確認してください。'
      } else if (message) {
        messages.push(message)
      }
    } else if (message) {
      messages.push(message)
    }
  }

  const visit = (value: unknown): void => {
    if (value == null) {
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (typeof value === 'string') {
      messages.push(value)
      return
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>
      if (record.field || record.message) {
        const field = typeof record.field === 'string' ? record.field : undefined
        const message =
          typeof record.message === 'string'
            ? record.message
            : typeof record.msg === 'string'
              ? record.msg
              : undefined
        assignError(field, message)
      }
      if (record.detail) {
        visit(record.detail)
      }
      if (record.errors) {
        visit(record.errors)
      }
      return
    }
  }

  visit(detail)

  return {
    fieldErrors,
    message: messages.find(Boolean),
  }
}

function normalizeRecipients(value: string): string[] {
  return value
    .split(RECIPIENT_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean)
}

function toRecipientsText(recipients: string[]): string {
  return recipients.join('\n')
}

function buildInitialState(data: DashboardNotificationSettingsResponse): FormState {
  return {
    updatedAt: data.updated_at,
    triggerStatus: new Set(data.trigger_status),
    channels: JSON.parse(JSON.stringify(data.channels)) as DashboardNotificationChannels,
    emailInput: toRecipientsText(data.channels.email.recipients),
    lineTokenInput: data.channels.line.token ?? '',
    lineWebhookInput: data.channels.line.webhook_url ?? '',
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
    } else if (token.length < 40 || !/^[A-Za-z0-9._+\-/=]+$/.test(token)) {
      fieldErrors.line = 'LINE チャネルアクセストークンの形式が正しくありません。'
    }

    const webhook = state.lineWebhookInput.trim()
    if (!webhook) {
      fieldErrors.lineWebhook = 'Webhook URL を入力してください。'
    } else if (!webhook.startsWith('https://')) {
      fieldErrors.lineWebhook = 'Webhook URL は https:// で始まる必要があります。'
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

  if (fieldErrors.email || fieldErrors.line || fieldErrors.lineWebhook || fieldErrors.slack) {
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
      webhook_url: state.channels.line.enabled ? state.lineWebhookInput.trim() || null : null,
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
    lineWebhookInput: conflict.channels.line.webhook_url ?? '',
    slackUrlInput: conflict.channels.slack.webhook_url ?? '',
  }
}

export function useNotificationSettingsForm(
  profileId: string,
  initialData: DashboardNotificationSettingsResponse,
) {
  const [formState, setFormState] = useState<FormState>(() => buildInitialState(initialData))
  const [message, setMessage] = useState<MessageState>({ type: 'idle' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isPending, startTransition] = useTransition()
  const [updatedAtLabel, setUpdatedAtLabel] = useState('')

  const clearFieldError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) {
        return prev
      }
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  useEffect(() => {
    setUpdatedAtLabel(new Date(formState.updatedAt).toLocaleString('ja-JP'))
  }, [formState.updatedAt])

  const triggerSelections = useMemo(
    () => Array.from(formState.triggerStatus),
    [formState.triggerStatus],
  )

  const runWithValidation = async (
    action: () => Promise<RunWithValidationResult>,
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
      if ('status' in result) {
        switch (result.status) {
          case 'success': {
            const data = (result as DashboardNotificationsSuccess).data
            if (data) {
              setFormState(mergeConflict(data))
              setFieldErrors({})
            }
            setMessage({ type: 'success', text: successMessage })
            return
          }
          case 'conflict':
            setFormState(mergeConflict(result.current))
            setFieldErrors({})
            setMessage({
              type: 'info',
              text: 'ほかのユーザーが設定を更新したため最新の内容を読み込みました。再度保存してください。',
            })
            return
          case 'validation_error': {
            const { fieldErrors: serverErrors, message: validationMessage } =
              mapServerValidationErrors(result.detail)
            setFieldErrors(serverErrors)
            setMessage({ type: 'error', text: validationMessage ?? '入力内容を確認してください。' })
            return
          }
          case 'error':
            setMessage({
              type: 'error',
              text:
                result.message ??
                '処理中にエラーが発生しました。しばらくしてから再度お試しください。',
            })
            return
          default:
            return
        }
      }
      setFormState(mergeConflict(result))
      setFieldErrors({})
      setMessage({ type: 'success', text: successMessage })
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
          return null
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

  const toggleChannel = (key: keyof DashboardNotificationChannels) => {
    setFormState((prev) => {
      const nextChannels: DashboardNotificationChannels = {
        ...prev.channels,
        [key]: { ...prev.channels[key], enabled: !prev.channels[key].enabled },
      }
      if (key === 'line' && !nextChannels.line.enabled) {
        nextChannels.line = { enabled: false, token: null, webhook_url: null }
      }
      if (key === 'slack' && !nextChannels.slack.enabled) {
        nextChannels.slack = { enabled: false, webhook_url: null }
      }
      return {
        ...prev,
        channels: nextChannels,
        lineTokenInput: key === 'line' && !nextChannels.line.enabled ? '' : prev.lineTokenInput,
        lineWebhookInput: key === 'line' && !nextChannels.line.enabled ? '' : prev.lineWebhookInput,
        slackUrlInput: key === 'slack' && !nextChannels.slack.enabled ? '' : prev.slackUrlInput,
      }
    })
    if (key === 'email') {
      clearFieldError('email')
    }
    if (key === 'line') {
      clearFieldError('line')
      clearFieldError('lineWebhook')
    }
    if (key === 'slack') {
      clearFieldError('slack')
    }
  }

  const toggleTriggerStatus = (status: DashboardNotificationStatus) => {
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

  const setEmailInput = (value: string) => {
    setFormState((prev) => ({ ...prev, emailInput: value }))
    clearFieldError('email')
  }

  const setLineTokenInput = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      lineTokenInput: value,
      channels: {
        ...prev.channels,
        line: {
          ...prev.channels.line,
          token: prev.channels.line.enabled ? value : prev.channels.line.token,
        },
      },
    }))
    clearFieldError('line')
  }

  const setLineWebhookInput = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      lineWebhookInput: value,
      channels: {
        ...prev.channels,
        line: {
          ...prev.channels.line,
          webhook_url: prev.channels.line.enabled ? value : prev.channels.line.webhook_url,
        },
      },
    }))
    clearFieldError('lineWebhook')
  }

  const setSlackUrlInput = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      slackUrlInput: value,
      channels: {
        ...prev.channels,
        slack: {
          ...prev.channels.slack,
          webhook_url: prev.channels.slack.enabled ? value : prev.channels.slack.webhook_url,
        },
      },
    }))
    clearFieldError('slack')
  }

  return {
    formState,
    triggerSelections,
    updatedAtLabel,
    message,
    fieldErrors,
    isPending,
    toggleChannel,
    toggleTriggerStatus,
    setEmailInput,
    setLineTokenInput,
    setLineWebhookInput,
    setSlackUrlInput,
    setFormState,
    setMessage,
    setFieldErrors,
    handleSubmit,
    handleTest,
  }
}

export type { MessageState, RunWithValidationResult, FormState }
