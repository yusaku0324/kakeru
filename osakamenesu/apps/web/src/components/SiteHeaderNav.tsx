"use client"

import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { FavoriteHeartIcon } from '@/components/FavoriteHeartIcon'
import { SiteLoginContent } from '@/app/auth/login/SiteLoginContent'

type AuthState =
  | { status: 'checking' }
  | { status: 'guest' }
  | { status: 'authenticated'; displayName: string | null }

export default function SiteHeaderNav() {
  const [state, setState] = useState<AuthState>({ status: 'checking' })
  const [showLoginOverlay, setShowLoginOverlay] = useState(false)
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

  useEffect(() => {
    if (showLoginOverlay) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      const handleKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setShowLoginOverlay(false)
        }
      }
      window.addEventListener('keydown', handleKey)
      return () => {
        document.body.style.overflow = originalOverflow
        window.removeEventListener('keydown', handleKey)
      }
    }
  }, [showLoginOverlay])

  const baseButtonClass = 'inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-neutral-text transition hover:border-brand-primary hover:bg-brand-primary/5 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40 disabled:opacity-60'
  const iconButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/80 text-neutral-text transition hover:border-brand-primary hover:bg-brand-primary/10 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary/40'
  const gradientButtonClass = 'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:from-brand-primary/90 hover:to-brand-secondary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70'

  return (
    <nav aria-label="サイトナビゲーション" className="flex items-center gap-3 text-sm font-medium">
      {state.status === 'authenticated' ? (
        <>
          {greeting ? (
            <span className="hidden items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-semibold text-neutral-text sm:inline-flex">
              <span aria-hidden>👤</span>
              {greeting}
            </span>
          ) : null}
          <Link
            href="/dashboard/favorites"
            className={clsx(iconButtonClass, 'sm:hidden')}
            aria-label="お気に入り"
          >
            <FavoriteHeartIcon filled={false} className="h-5 w-5" />
          </Link>
          <Link href="/dashboard/favorites" className={clsx(gradientButtonClass, 'hidden sm:inline-flex')}>
            <FavoriteHeartIcon filled={false} className="h-4 w-4 text-white" />
            お気に入り
          </Link>
          <button type="button" onClick={handleLogout} disabled={isLoggingOut} className={baseButtonClass}>
            {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setShowLoginOverlay(true)} className={baseButtonClass}>
            ログイン
          </button>
          <Link href="/dashboard/login" className={baseButtonClass}>
            店舗ダッシュボード
          </Link>
          <Link
            href="/dashboard/favorites"
            className={clsx(iconButtonClass, 'sm:hidden')}
            aria-label="お気に入り"
          >
            <FavoriteHeartIcon filled={false} className="h-5 w-5" />
          </Link>
          <Link href="/dashboard/favorites" className={clsx(gradientButtonClass, 'hidden sm:inline-flex')}>
            <FavoriteHeartIcon filled={false} className="h-4 w-4 text-white" />
            お気に入り
          </Link>
        </>
      )}
      {showLoginOverlay ? (
        <div className="fixed inset-0 z-[999] flex items-start justify-center bg-neutral-950/40 pt-12 backdrop-blur-sm sm:pt-16">
          <div className="absolute inset-0 z-0" onClick={() => setShowLoginOverlay(false)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-5xl max-h-[88vh] overflow-y-auto rounded-[36px]">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[36px] bg-[radial-gradient(circle_at_top,#2563eb1a_0%,rgba(37,99,235,0)_65%),linear-gradient(180deg,#f0f8ff_0%,rgba(255,255,255,0.85)_100%)] blur-2xl" />
            <SiteLoginContent variant="overlay" onClose={() => setShowLoginOverlay(false)} />
          </div>
        </div>
      ) : null}
    </nav>
  )
}
