"use client"

import clsx from 'clsx'
import Link from 'next/link'

import { SiteMagicLinkRequestForm } from './SiteMagicLinkRequestForm'

type SiteLoginContentProps = {
  variant: 'page' | 'overlay'
  onClose?: () => void
}

export function SiteLoginContent({ variant, onClose }: SiteLoginContentProps) {
  const wrapperClass = clsx(
    'relative mx-auto flex max-w-4xl flex-col',
    variant === 'page'
      ? 'gap-12 px-6 py-16 lg:gap-16 lg:py-20'
      : 'gap-10 px-6 py-10 pb-12 lg:gap-12 lg:py-12',
  )

  return (
    <div className={wrapperClass}>
      {variant === 'overlay' ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/80 text-neutral-text shadow-sm shadow-brand-primary/10 transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
          aria-label="ログインパネルを閉じる"
        >
          ✕
        </button>
      ) : null}

      <header className={clsx('flex flex-col gap-4', variant === 'overlay' ? 'text-center lg:text-left' : 'text-center lg:text-left')}>
        <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-brand-primary/15 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-brand-primary lg:mx-0">
          🔐 ワンタップログイン
        </span>
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-text sm:text-4xl">
            <span className="block text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text">
              お気に入りを安全に保存
            </span>
            ログインリンクをメールでお届けします
          </h1>
          <p className="text-sm text-neutral-textMuted sm:text-base">
            登録済みのメールアドレスにマジックリンクを送信します。同じブラウザでリンクを開くとログインが完了し、お気に入り保存や予約フォームの入力を引き続きご利用いただけます。
          </p>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-8 rounded-[32px] border border-white/50 bg-white/90 p-8 shadow-[0_24px_70px_-28px_rgba(21,93,252,0.45),0_0_0_1px_rgba(21,93,252,0.08)] backdrop-blur">
          <div className="space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/40">
              ✉️
            </div>
            <h2 className="text-xl font-semibold text-neutral-text">メールでワンタップログイン</h2>
            <p className="text-sm text-neutral-textMuted">
              マジックリンクは数分間有効です。送信ボタンを押したら、受信したメールを開くだけでログインが完了します。
            </p>
          </div>
          <SiteMagicLinkRequestForm />
          <ul className="grid gap-2 text-sm text-neutral-textMuted">
            <li className="inline-flex items-center gap-2">
              <span aria-hidden>✅</span> お気に入りや閲覧履歴を他デバイスと同期
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden>✅</span> パスワード不要でセキュアにログイン
            </li>
            <li className="inline-flex items-center gap-2">
              <span aria-hidden>✅</span> 予約フォームの入力内容を自動保存
            </li>
          </ul>
        </div>

        <aside className="space-y-6 rounded-[32px] border border-white/40 bg-white/80 p-6 shadow-[0_18px_50px_-30px_rgba(21,93,252,0.55)] backdrop-blur">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-text">店舗担当者の方はこちら</h3>
            <p className="text-sm text-neutral-textMuted">
              掲載店舗の運用管理を行う場合はダッシュボード専用のログインページをご利用ください。
            </p>
            <Link
              href="/dashboard/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/90 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10"
            >
              ダッシュボードにログイン
              <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="rounded-[24px] border border-white/60 bg-white/85 p-4 text-xs text-neutral-text">
            <h4 className="mb-1 font-semibold text-neutral-text">ログインメールが届かない場合</h4>
            <ul className="space-y-1 text-neutral-textMuted">
              <li>・迷惑メールフォルダを確認してください</li>
              <li>・「@osakamenes.com」ドメインを受信許可に追加</li>
              <li>・5分待っても届かない場合は再送してください</li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="space-y-4 rounded-[32px] border border-white/40 bg-white/85 p-6 text-sm text-neutral-text shadow-[0_18px_60px_-32px_rgba(21,93,252,0.4)] backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-text">よくあるご質問</h2>
          {variant === 'overlay' ? (
            <Link href="/auth/login" className="text-xs font-semibold text-brand-primary transition hover:text-brand-primary/80">
              ログインページに移動 →
            </Link>
          ) : null}
        </div>
        <ul className="grid gap-3 text-neutral-textMuted">
          <li>
            <span className="font-semibold text-neutral-text">Q. マジックリンクはどれくらい有効ですか？</span>
            <p>リンクの有効期限は送信から数分間です。同じブラウザで開いてください。</p>
          </li>
          <li>
            <span className="font-semibold text-neutral-text">Q. ログイン履歴は残りますか？</span>
            <p>一定期間アクセスが無い場合は自動的にログアウトされます。お気に入りは再ログインで復元されます。</p>
          </li>
        </ul>
      </section>
    </div>
  )
}
