import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'

import { getSessionByScope } from '@/lib/session'

type Props = {
  children: ReactNode
}

// ADMIN_API_KEY is required for backend API calls
const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.OSAKAMENESU_ADMIN_API_KEY || ''

export default async function AdminLayout({ children }: Props) {
  // Check for dashboard session - admin users must be logged in
  const sessionToken = await getSessionByScope('dashboard')

  // Require both: 1) ADMIN_KEY configured on server, 2) user has valid session
  const hasAdminKeyConfigured = Boolean(ADMIN_KEY)
  const hasSession = Boolean(sessionToken)

  // If no session, redirect to dashboard login
  if (!hasSession) {
    redirect('/dashboard/login?redirect=/admin')
  }

  // If ADMIN_KEY is not configured, show configuration error
  if (!hasAdminKeyConfigured) {
    return (
      <div className="min-h-screen bg-neutral-surface">
        <div className="mx-auto max-w-3xl p-6 text-sm text-neutral-text">
          <h1 className="text-xl font-semibold text-red-600">管理画面設定エラー</h1>
          <p className="mt-2 text-neutral-textMuted">
            ADMIN_API_KEY 環境変数が設定されていません。サーバー管理者に連絡してください。
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-surface">
      <div className="border-b border-neutral-200 bg-white px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700">管理画面</span>
          <Link
            href="/dashboard"
            className="text-xs text-neutral-500 hover:text-neutral-700"
          >
            ダッシュボードに戻る
          </Link>
        </div>
      </div>
      {children}
    </div>
  )
}
