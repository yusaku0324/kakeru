"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

type AuthState =
  | { status: 'checking' }
  | { status: 'guest' }
  | { status: 'authenticated'; displayName: string | null }

export default function SiteHeaderNav() {
  const [state, setState] = useState<AuthState>({ status: 'checking' })
  const [isLoggingOut, startLogout] = useTransition()
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function loadAuthState() {
      try {
        const res = await fetch('/api/auth/me/site', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (!active) {
          return
        }

        if (res.ok) {
          const data = await res.json().catch(() => ({}))
          const displayName =
            typeof data?.display_name === 'string' && data.display_name.trim()
              ? data.display_name.trim()
              : typeof data?.email === 'string'
              ? data.email
              : null
          setState({ status: 'authenticated', displayName })
          return
        }

        if (res.status === 401) {
          setState({ status: 'guest' })
          return
        }
      } catch {
        // ignore network errors and fall through to guest
      }
      if (active) {
        setState({ status: 'guest' })
      }
    }

    loadAuthState()
    return () => {
      active = false
    }
  }, [])

  const greeting = useMemo(() => {
    if (state.status !== 'authenticated') {
      return null
    }
    if (state.displayName) {
      return `${state.displayName} さん`
    }
    return 'ログイン中'
  }, [state])

  function handleLogout() {
    if (isLoggingOut) return
    startLogout(async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        })
      } catch {
        // logout failures are non-fatal for the UI; fall back to guest view
      } finally {
        setState({ status: 'guest' })
        router.refresh()
      }
    })
  }

  return (
    <nav aria-label="サイトナビゲーション" className="flex items-center gap-3 text-sm font-medium">
      {state.status === 'authenticated' ? (
        <>
          {greeting ? <span className="hidden text-neutral-600 sm:inline">{greeting}</span> : null}
          <Link
            href="/dashboard/favorites"
            className="rounded-full border border-transparent bg-neutral-900 px-4 py-1.5 text-white transition hover:bg-neutral-700"
          >
            お気に入り
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-1.5 text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-60"
          >
            {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
          </button>
        </>
      ) : (
        <>
          <Link
            href="/auth/login"
            className="inline-flex items-center rounded-full border border-neutral-300 px-4 py-1.5 text-neutral-700 transition hover:bg-neutral-100"
          >
            ログイン
          </Link>
          <Link
            href="/dashboard/favorites"
            className="hidden rounded-full border border-transparent bg-neutral-900 px-4 py-1.5 text-white transition hover:bg-neutral-700 sm:inline-flex"
          >
            お気に入り
          </Link>
        </>
      )}
    </nav>
  )
}
