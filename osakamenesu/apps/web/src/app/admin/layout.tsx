import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

const STAFF_ROLES = ['admin', 'staff', 'editor']

export default async function AdminLayout({ children }: Props) {
  const cookieHeader = cookies().toString()
  let session: { authenticated?: boolean; user?: { role?: string | null } } | null = null
  let hasSessionError = false

  try {
    const resp = await fetch('/api/auth/session', {
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })
    if (resp.ok) {
      session = await resp.json()
    } else {
      hasSessionError = true
    }
  } catch {
    hasSessionError = true
  }

  const isAuthorized =
    session?.authenticated || (session?.user?.role ? STAFF_ROLES.includes(session.user.role) : false)

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
