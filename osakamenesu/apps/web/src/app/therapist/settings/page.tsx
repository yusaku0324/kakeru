'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LineLoginButton } from '@/components/auth/LineLoginButton'

type LineConnectionStatus = 'connected' | 'not_connected' | 'loading'

/**
 * セラピスト設定ページ - LINE連携UI
 *
 * セラピストがLINE連携状態を確認・管理するためのページ。
 *
 * TODO:
 * - バックエンドAPIから連携状態を取得
 * - 連携解除APIの実装
 * - 認証状態の確認とリダイレクト
 */
export default function TherapistSettingsPage() {
  // TODO: 実際のAPIから取得
  const [connectionStatus] = useState<LineConnectionStatus>('not_connected')
  const [lineDisplayName] = useState<string | null>(null)
  const [isUnlinking, setIsUnlinking] = useState(false)

  const handleUnlinkLine = async () => {
    if (!confirm('LINE連携を解除しますか？\n解除すると、LINEでのログインや通知が利用できなくなります。')) {
      return
    }

    setIsUnlinking(true)
    try {
      // TODO: バックエンドAPI実装後に置き換え
      // await fetch('/api/v1/auth/line/unlink', { method: 'POST' })
      alert('LINE連携を解除しました（デモ）')
      // 実際にはページをリロードまたは状態を更新
    } catch (error) {
      console.error('Failed to unlink LINE:', error)
      alert('LINE連携の解除に失敗しました')
    } finally {
      setIsUnlinking(false)
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-neutral-900">設定</h1>
              <p className="text-xs text-neutral-500">セラピストポータル</p>
            </div>
            <Link
              href="/therapist"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              戻る
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        {/* LINE連携セクション */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-800 mb-4">
            LINE連携
          </h2>

          {connectionStatus === 'loading' ? (
            <div className="py-8 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-primary-600" />
              <p className="mt-2 text-sm text-neutral-500">読み込み中...</p>
            </div>
          ) : connectionStatus === 'connected' ? (
            /* 連携済み */
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#06C755]">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="white"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-green-800">LINE連携済み</p>
                  {lineDisplayName && (
                    <p className="text-sm text-green-700">{lineDisplayName}</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <h3 className="font-medium text-neutral-700 mb-2">連携中の機能</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    LINEでログイン
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    予約通知をLINEで受信
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    シフトリマインダー
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleUnlinkLine}
                disabled={isUnlinking}
                className="w-full rounded-lg border border-red-300 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                {isUnlinking ? '解除中...' : 'LINE連携を解除'}
              </button>
            </div>
          ) : (
            /* 未連携 */
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-amber-600 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <p className="font-medium text-amber-800">LINE未連携</p>
                    <p className="mt-1 text-sm text-amber-700">
                      LINEを連携すると、予約通知やシフトリマインダーをLINEで受け取れます。
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-neutral-50 p-4">
                <h3 className="font-medium text-neutral-700 mb-2">LINE連携のメリット</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    LINEで簡単ログイン
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    新規予約をLINEでお知らせ
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    シフト開始前のリマインダー
                  </li>
                </ul>
              </div>

              <LineLoginButton
                redirectPath="/therapist/settings"
                variant="primary"
                label="LINEで連携する"
                className="w-full"
              />
            </div>
          )}
        </section>

        {/* 通知設定セクション（将来用） */}
        <section className="rounded-xl bg-white p-6 shadow-sm opacity-50">
          <h2 className="text-lg font-semibold text-neutral-800 mb-4">
            通知設定
          </h2>
          <p className="text-sm text-neutral-500">
            LINE連携後に設定できます
          </p>
        </section>
      </div>
    </main>
  )
}
