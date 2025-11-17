'use client'

import clsx from 'clsx'
import Link from 'next/link'

import { SiteMagicLinkRequestForm } from './SiteMagicLinkRequestForm'

type SiteLoginContentProps = {
  variant: 'page' | 'overlay'
  onClose?: () => void
}

export function SiteLoginContent({ variant, onClose }: SiteLoginContentProps) {
  const panelClass = clsx(
    'relative mx-auto flex w-full max-w-4xl flex-col rounded-[40px] border border-white/70 bg-gradient-to-b from-white/98 via-white/96 to-white/93 text-neutral-text shadow-[0_35px_90px_rgba(15,23,42,0.08),0_0_1px_rgba(15,23,42,0.08)] backdrop-blur',
    variant === 'page'
      ? 'gap-12 px-6 py-16 lg:gap-14 lg:px-12 lg:py-20'
      : 'gap-8 px-6 py-8 pb-10 sm:px-10 sm:py-10',
  )

  return (
    <div className={panelClass}>
      {variant === 'overlay' ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/90 text-neutral-text shadow-sm shadow-brand-primary/15 transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40"
          aria-label="ログインパネルを閉じる"
        >
          ✕
        </button>
      ) : null}

      <header className={clsx('flex flex-col gap-3 text-center sm:text-left')}>
        <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-brand-primary/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-primary sm:mx-0">
          🔐 ワンタップログイン
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
            <span className="block text-transparent bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text">
              お気に入りを安全に保存
            </span>
            ログインリンクをメールでお届けします
          </h1>
          <p className="text-sm leading-relaxed text-neutral-textMuted">
            登録済みのメールアドレスにマジックリンクを送信します。同じブラウザでリンクを開くとログインが完了し、お気に入り保存や予約フォームの入力を引き続きご利用いただけます。
          </p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6 rounded-[28px] border border-white/60 bg-white/95 p-6 shadow-[0_20px_55px_-30px_rgba(37,99,235,0.5)]">
          <div className="space-y-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-base text-white shadow-lg shadow-brand-primary/40">
              ✉️
            </div>
            <h2 className="text-lg font-semibold text-neutral-text">メールでワンタップログイン</h2>
            <p className="text-sm leading-relaxed text-neutral-textMuted">
              マジックリンクは数分間有効です。送信ボタンを押したら、受信したメールを開くだけでログインが完了します。
            </p>
          </div>
          <SiteMagicLinkRequestForm />
          <ul className="grid gap-1 text-sm text-neutral-textMuted">
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

        <aside className="space-y-5 rounded-[28px] border border-white/50 bg-white/90 p-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-neutral-text">店舗担当者の方はこちら</h3>
            <p className="text-sm leading-relaxed text-neutral-textMuted">
              掲載店舗の運用管理を行う場合はダッシュボード専用のログインページをご利用ください。
            </p>
            <Link
              href="/dashboard/login"
              className="inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-white px-4 py-2 text-sm font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary/10"
            >
              ダッシュボードにログイン
              <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/85 p-4 text-xs text-neutral-text">
            <h4 className="mb-1 font-semibold text-neutral-text">ログインメールが届かない場合</h4>
            <ul className="space-y-1 text-neutral-textMuted">
              <li>・迷惑メールフォルダを確認してください</li>
              <li>・「@osakamenes.com」ドメインを受信許可に追加</li>
              <li>・5分待っても届かない場合は再送してください</li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="space-y-3 rounded-[28px] border border-white/60 bg-white/92 p-6 text-sm text-neutral-text">
        <div className="flex items-center justify-between text-sm">
          <h2 className="text-base font-semibold text-neutral-text">よくあるご質問</h2>
          {variant === 'overlay' ? (
            <Link
              href="/auth/login"
              className="text-xs font-semibold text-brand-primary transition hover:text-brand-primary/80"
            >
              ログインページに移動 →
            </Link>
          ) : null}
        </div>
        <ul className="grid gap-2 text-neutral-textMuted">
          <li>
            <span className="font-semibold text-neutral-text">
              Q. マジックリンクはどれくらい有効ですか？
            </span>
            <p>リンクの有効期限は送信から数分間です。同じブラウザで開いてください。</p>
          </li>
          <li>
            <span className="font-semibold text-neutral-text">Q. ログイン履歴は残りますか？</span>
            <p>
              一定期間アクセスが無い場合は自動的にログアウトされます。お気に入りは再ログインで復元されます。
            </p>
          </li>
        </ul>
      </section>
    </div>
  )
}
