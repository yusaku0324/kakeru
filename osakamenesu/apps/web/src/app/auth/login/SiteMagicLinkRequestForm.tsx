'use client'

import { FormEvent, useState } from 'react'

import { ToastContainer, useToast } from '@/components/useToast'
import { requestSiteMagicLink } from '@/lib/auth'

type Status = 'idle' | 'sending' | 'success' | 'success_no_mail' | 'error'

export function SiteMagicLinkRequestForm() {
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

    const result = await requestSiteMagicLink(trimmed)
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-neutral-text">メールアドレス</span>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-full border border-white/50 bg-white/85 px-4 py-3 text-sm text-neutral-text shadow-sm transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            placeholder="you@example.com"
            required
          />
        </label>

        {errorMessage ? (
          <p className="rounded-[20px] border border-state-dangerBg bg-state-dangerBg/60 px-4 py-2 text-sm text-state-dangerText">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-primary/25 transition hover:from-brand-primary/90 hover:to-brand-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden>📨</span>
          {isSending ? '送信中...' : 'ログインリンクを送信'}
        </button>
      </form>

      {status === 'success' ? (
        <div className="rounded-[20px] border border-brand-primary/30 bg-brand-primary/5 px-4 py-3 text-sm text-brand-primary">
          メールに記載されたリンクを同じブラウザで開くとログインが完了します。リンクの有効期限は数分間です。
        </div>
      ) : status === 'success_no_mail' ? (
        <div className="rounded-[20px] border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ログインリンクは発行されましたが、メール送信が現在無効なため届きません。お手数ですがサーバー管理者にお問い合わせください。
        </div>
      ) : (
        <p className="text-sm text-neutral-textMuted">
          ログインリンクは数分間有効です。届かない場合は迷惑メールフォルダもご確認ください。
        </p>
      )}
    </div>
  )
}
