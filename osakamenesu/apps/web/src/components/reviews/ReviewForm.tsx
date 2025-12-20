'use client'

import Link from 'next/link'
import type { FormEvent } from 'react'
import { ASPECT_LABELS, starLabel } from './shopReviewsUtils'
import type { ReviewAspectKey, ReviewFormState, AuthState } from './shopReviewsTypes'

type Props = {
  form: ReviewFormState
  onFieldChange: <K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) => void
  onAspectScoreChange: (key: ReviewAspectKey, value: number | null) => void
  onAspectNoteChange: (key: ReviewAspectKey, value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  isDemoEnvironment: boolean
  authState: AuthState
}

export function ReviewForm({
  form,
  onFieldChange,
  onAspectScoreChange,
  onAspectNoteChange,
  onSubmit,
  isSubmitting,
  isDemoEnvironment,
  authState,
}: Props) {
  const formDisabled = isDemoEnvironment || authState !== 'authenticated'

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-card border border-neutral-borderLight bg-neutral-surfaceAlt p-4"
    >
      <fieldset disabled={formDisabled} className="space-y-4">
        <div>
          <div className="text-sm font-semibold text-neutral-text">口コミを投稿する</div>
          <p className="mt-1 text-xs text-neutral-textMuted">
            店舗スタッフが内容を確認し、問題がなければ掲載されます。個人情報や誹謗中傷は掲載できません。
          </p>
          {isDemoEnvironment ? (
            <p className="mt-2 text-xs text-brand-primaryDark">
              サンプル表示中のため投稿機能はご利用いただけません。
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-neutral-text">
            <span className="font-semibold">総合評価 *</span>
            <select
              value={form.score}
              onChange={(event) => onFieldChange('score', Number(event.target.value))}
              className="w-full rounded border border-neutral-borderLight px-3 py-2"
              required
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} - {starLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm text-neutral-text">
            <span className="font-semibold">タイトル</span>
            <input
              value={form.title}
              onChange={(event) => onFieldChange('title', event.target.value)}
              placeholder="接客が丁寧でした など"
              className="w-full rounded border border-neutral-borderLight px-3 py-2"
              maxLength={160}
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-neutral-text">
            <span className="font-semibold">ニックネーム</span>
            <input
              value={form.authorAlias}
              onChange={(event) => onFieldChange('authorAlias', event.target.value)}
              placeholder="匿名希望でもOK"
              className="w-full rounded border border-neutral-borderLight px-3 py-2"
              maxLength={80}
            />
          </label>

          <label className="space-y-1 text-sm text-neutral-text">
            <span className="font-semibold">来店日</span>
            <input
              type="date"
              value={form.visitedAt}
              onChange={(event) => onFieldChange('visitedAt', event.target.value)}
              className="w-full rounded border border-neutral-borderLight px-3 py-2"
            />
          </label>
        </div>

        <label className="space-y-1 text-sm text-neutral-text">
          <span className="font-semibold">口コミ本文 *</span>
          <textarea
            value={form.body}
            onChange={(event) => onFieldChange('body', event.target.value)}
            className="min-h-[140px] w-full rounded border border-neutral-borderLight px-3 py-2"
            placeholder="利用したコースや接客の印象などを教えてください。"
            maxLength={4000}
            required
          />
        </label>

        <div className="space-y-3">
          <div className="text-sm font-semibold text-neutral-text">項目別の評価（任意）</div>
          <div className="grid gap-3 md:grid-cols-3">
            {(Object.keys(ASPECT_LABELS) as ReviewAspectKey[]).map((key) => (
              <div
                key={key}
                className="space-y-2 rounded-card border border-neutral-borderLight bg-white p-3"
              >
                <div className="space-y-1 text-sm">
                  <div className="font-semibold text-neutral-text">
                    {ASPECT_LABELS[key].label}
                  </div>
                  <div className="text-xs text-neutral-textMuted">{ASPECT_LABELS[key].help}</div>
                </div>
                <select
                  value={form.aspects[key].score ?? ''}
                  onChange={(event) => {
                    const value = event.target.value === '' ? null : Number(event.target.value)
                    onAspectScoreChange(key, value)
                  }}
                  className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                >
                  <option value="">未選択</option>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value}★
                    </option>
                  ))}
                </select>
                <input
                  value={form.aspects[key].note}
                  onChange={(event) => onAspectNoteChange(key, event.target.value)}
                  placeholder="気になった点など（任意）"
                  className="w-full rounded border border-neutral-borderLight px-3 py-2 text-sm"
                  maxLength={240}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-textMuted">
            利用規約に沿って掲載させていただきます。投稿内容により掲載までお時間をいただく場合があります。
          </p>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-badge bg-brand-primary px-5 py-2 text-sm font-semibold text-white hover:bg-brand-primaryDark disabled:opacity-60"
            disabled={isSubmitting || formDisabled}
          >
            {isSubmitting ? '送信中…' : '口コミを投稿する'}
          </button>
        </div>
      </fieldset>

      {authState !== 'authenticated' && !isDemoEnvironment ? (
        <div className="rounded-md border border-dashed border-neutral-300 bg-white/80 p-4 text-sm text-neutral-text">
          <p className="mb-2">
            口コミを投稿するにはログインが必要です。ログイン後、再度このページを開いて投稿してください。
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            ログインページへ
          </Link>
        </div>
      ) : null}
    </form>
  )
}
