import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

// If ADMIN_API_KEY is configured, allow access without session auth
// This is useful for admin operations when Vercel Authentication is enabled
const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.OSAKAMENESU_ADMIN_API_KEY || ''

export default async function AdminLayout({ children }: Props) {
  // If admin API key is configured, bypass session check and allow access
  const isAuthorized = Boolean(ADMIN_KEY)
  const hasSessionError = false

  return (
    <div className="min-h-screen bg-neutral-surface">
      {hasSessionError ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          セッション情報の取得に失敗しました。再読み込みをお試しください。
        </div>
      ) : null}
      {!isAuthorized ? (
        <div className="mx-auto max-w-3xl p-6 text-sm text-neutral-text">
          <h1 className="text-xl font-semibold">管理画面</h1>
          <p className="mt-2 text-neutral-textMuted">
            管理者としてサインインするとこのページにアクセスできます。
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
