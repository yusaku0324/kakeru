'use client'

import { useState } from 'react'

type GoogleLoginButtonProps = {
  /** リダイレクト先（ログイン後のコールバック） */
  redirectPath?: string
  /** ボタンのバリアント */
  variant?: 'primary' | 'outline'
  /** ボタンテキスト */
  label?: string
  /** 追加のクラス名 */
  className?: string
  /** 無効状態 */
  disabled?: boolean
}

/**
 * Googleログインボタン
 *
 * Google OAuth認証フローを開始するためのボタンコンポーネント。
 * バックエンドの `/api/auth/google/login-url` を呼び出してGoogle認証URLを取得し、
 * ユーザーをGoogle認証ページにリダイレクトする。
 */
export function GoogleLoginButton({
  redirectPath = '/therapist/settings',
  variant = 'primary',
  label = 'Googleでログイン',
  className = '',
  disabled = false,
}: GoogleLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Next.js API Route経由でGoogle認可URLを取得（CORS回避）
      const response = await fetch('/api/auth/google/login-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_path: redirectPath }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 503) {
          setError('Google連携は現在準備中です')
        } else if (response.status === 429) {
          // Rate Limit - errorData.detail is {message, retry_after}
          const retryAfter = errorData.detail?.retry_after
          const retryMessage = retryAfter
            ? `しばらく待ってから再試行してください（${Math.ceil(retryAfter)}秒後）`
            : 'しばらく待ってから再試行してください'
          setError(retryMessage)
        } else {
          // detail can be string or object, handle both
          const errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : errorData.detail?.message || 'Googleログインの開始に失敗しました'
          setError(errorMessage)
        }
        setIsLoading(false)
        return
      }

      const data = await response.json()

      // stateをセッションストレージに保存（CSRF対策）
      sessionStorage.setItem('google_oauth_state', data.state)
      sessionStorage.setItem('google_oauth_redirect', redirectPath)

      // リダイレクト先をクッキーに保存（サーバーサイドで読み取るため）
      document.cookie = `google_oauth_redirect=${encodeURIComponent(redirectPath)}; path=/; max-age=600; SameSite=Lax`

      // Google認証ページにリダイレクト
      window.location.href = data.login_url
    } catch (err) {
      console.error('Google login error:', err)
      setError('Googleログインの開始に失敗しました')
      setIsLoading(false)
    }
  }

  const baseStyles = 'flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles = {
    primary: 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 shadow-sm',
    outline: 'border-2 border-gray-400 text-gray-600 hover:bg-gray-100',
  }

  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      >
        {/* Google Icon */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {isLoading ? '接続中...' : label}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}

export default GoogleLoginButton
