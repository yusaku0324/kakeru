'use client'

import { FormEvent, useState } from 'react'

import { ToastContainer, useToast } from '@/components/useToast'
import { requestDashboardMagicLink } from '@/lib/auth'

type Status = 'idle' | 'sending' | 'success' | 'success_no_mail' | 'error'

export function MagicLinkRequestForm() {
  const { toasts, push, remove } = useToast()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = email.trim()
    if (!trimmed) {
      setErrorMessage('メールアドレスを入力してください。')
      return
    }

    setStatus('sending')
    setErrorMessage(null)

    const result = await requestDashboardMagicLink(trimmed)
    switch (result.status) {
      case 'success':
        if (result.mailSent) {
          setStatus('success')
          push('success', 'ログインリンクを送信しました。メールをご確認ください。')
        } else {
          setStatus('success_no_mail')
          // Note: using 'success' type since 'info' is not supported by useToast
          push('success', 'ログインリンクを発行しました。メール送信は現在無効です。')
        }
        break
      case 'rate_limited':
        setStatus('error')
        setErrorMessage(
          '短時間に複数回リクエストが行われました。しばらく時間をおいてから再度お試しください。',
        )
        break
      case 'error':
      default:
        setStatus('error')
        setErrorMessage(result.message)
        break
    }
  }

  const isSending = status === 'sending'

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={remove} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="space-y-1">
          <span className="text-sm font-medium text-neutral-text">メールアドレス</span>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
            placeholder="you@example.com"
            required
          />
        </label>

        {errorMessage ? <p className="text-sm text-state-dangerText">{errorMessage}</p> : null}

        <button
          type="submit"
          disabled={isSending}
          className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? '送信中...' : 'ログインリンクを送信'}
        </button>
      </form>

      {status === 'success' ? (
        <div className="rounded border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          メールに記載されたリンクを同じブラウザで開くと自動的にログインが完了します。リンクの有効期限は数分間です。
        </div>
      ) : status === 'success_no_mail' ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ログインリンクは発行されましたが、メール送信機能が現在無効のため、お手数ですがサーバーログからリンクを確認してください。本番環境では
          MAIL_APIKEY 環境変数を設定するとメールが送信されるようになります。
        </div>
      ) : (
        <p className="text-sm text-neutral-600">
          ログインリンクは数分間有効です。届かない場合は迷惑メールフォルダもご確認ください。
        </p>
      )}
    </div>
  )
}
