'use client'

import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function AuthCompletePage() {
  return (
    <Suspense fallback={<AuthCompleteFallback />}>
      <AuthCompleteContent />
    </Suspense>
  )
}

function AuthCompleteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    let active = true
    let redirectTimer: ReturnType<typeof setTimeout> | undefined

    async function verify() {
      if (!token) {
        setStatus('error')
        setMessage('トークンが見つかりませんでした。再度お試しください。')
        return
      }

      setStatus('loading')
      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ token }),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => undefined)
          const detail = (data && (data.detail || data.message)) as string | undefined
          throw new Error(detail || '認証に失敗しました。リンクが古い可能性があります。')
        }

        const data = await res.json().catch(() => undefined)
        const scope = (data && typeof data.scope === 'string' ? data.scope : 'site') as
          | 'dashboard'
          | 'site'

        let redirectTarget = '/'
        let redirectLabel = 'トップ'

        if (scope === 'dashboard') {
          redirectLabel = 'ダッシュボード'
          redirectTarget = '/dashboard'

          try {
            const listRes = await fetch('/api/dashboard/shops?limit=1', {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            })

            if (listRes.ok) {
              const listData = (await listRes.json().catch(() => undefined)) as
                | { shops?: Array<{ id?: string }> }
                | undefined
              const first = listData?.shops?.[0]
              if (first?.id) {
                redirectTarget = `/dashboard/${first.id}`
              } else {
                redirectTarget = '/dashboard/new'
              }
            } else if (listRes.status === 404) {
              redirectTarget = '/dashboard/new'
            }
          } catch {
            redirectTarget = '/dashboard/new'
          }
        }

        if (active) {
          setStatus('success')
          setMessage(`ログインが完了しました。数秒後に${redirectLabel}へ移動します。`)
          redirectTimer = setTimeout(() => router.replace(redirectTarget), 2500)
        }
      } catch (err) {
        if (active) {
          setStatus('error')
          setMessage(err instanceof Error ? err.message : '認証に失敗しました。')
        }
      }
    }

    verify()
    return () => {
      active = false
      if (redirectTimer) {
        clearTimeout(redirectTimer)
      }
    }
  }, [router, token])

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">メール確認</h1>
      {status === 'loading' && <p>ログイン処理中です。しばらくお待ちください。</p>}
      {status === 'success' && <p>{message}</p>}
      {status === 'error' && (
        <div className="space-y-4">
          <p>{message}</p>
          <p>
            リンクの有効期限が切れている場合は、ログインページから新しいマジックリンクを再送信してください。
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => router.replace('/')}
        className="rounded bg-black px-4 py-2 text-white"
      >
        トップへ戻る
      </button>
    </main>
  )
}

function AuthCompleteFallback() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">メール確認</h1>
      <p>ログインリンクを確認しています。しばらくお待ちください。</p>
      <Link href="/" className="rounded bg-black px-4 py-2 text-white">
        トップへ戻る
      </Link>
    </main>
  )
}
