'use client'

import { useState } from 'react'

type LineLoginButtonProps = {
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
 * LINEログインボタン
 *
 * LINE OAuth認証フローを開始するためのボタンコンポーネント。
 * バックエンドの `/api/v1/auth/line/login-url` を呼び出してLINE認証URLを取得し、
 * ユーザーをLINE認証ページにリダイレクトする。
 *
 * TODO: バックエンドLINE OAuth APIが実装されたら、実際のAPIを呼び出すように変更
 */
export function LineLoginButton({
  redirectPath = '/therapist/settings',
  variant = 'primary',
  label = 'LINEでログイン',
  className = '',
  disabled = false,
}: LineLoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // TODO: バックエンドAPI実装後に置き換え
      // const response = await fetch('/api/v1/auth/line/login-url', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ redirect_path: redirectPath }),
      // })
      // const data = await response.json()
      // window.location.href = data.login_url

      // 仮実装: LINE OAuth URLへの直接リダイレクト（デモ用）
      // 実際のLINE_CHANNEL_IDは環境変数から取得
      const lineChannelId = process.env.NEXT_PUBLIC_LINE_CHANNEL_ID
      if (!lineChannelId) {
        setError('LINE連携は現在準備中です')
        setIsLoading(false)
        return
      }

      const state = crypto.randomUUID()
      const redirectUri = encodeURIComponent(
        `${window.location.origin}/api/auth/line/callback`
      )
      const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${lineChannelId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid`

      // stateをセッションストレージに保存（CSRF対策）
      sessionStorage.setItem('line_oauth_state', state)
      sessionStorage.setItem('line_oauth_redirect', redirectPath)

      window.location.href = lineAuthUrl
    } catch (err) {
      console.error('LINE login error:', err)
      setError('LINEログインの開始に失敗しました')
      setIsLoading(false)
    }
  }

  const baseStyles = 'flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles = {
    primary: 'bg-[#06C755] text-white hover:bg-[#05B04D] active:bg-[#049E45]',
    outline: 'border-2 border-[#06C755] text-[#06C755] hover:bg-[#06C755] hover:text-white',
  }

  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      >
        {/* LINE Icon */}
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C6.48 2 2 5.82 2 10.5c0 4.01 3.44 7.37 8.09 8.27.32.07.75.22.86.5.1.26.06.66.03.92l-.14.84c-.04.26-.2 1.02.89.56 1.09-.46 5.91-3.48 8.06-5.96C21.46 13.04 22 11.82 22 10.5 22 5.82 17.52 2 12 2zm-3.4 11.16h-2.1c-.3 0-.54-.24-.54-.54V8.54c0-.3.24-.54.54-.54s.54.24.54.54v3.54h1.56c.3 0 .54.24.54.54s-.24.54-.54.54zm1.5-.54c0 .3-.24.54-.54.54s-.54-.24-.54-.54V8.54c0-.3.24-.54.54-.54s.54.24.54.54v4.08zm4.08.54c-.22 0-.42-.13-.5-.34l-1.58-3.64v3.44c0 .3-.24.54-.54.54s-.54-.24-.54-.54V8.54c0-.3.24-.54.54-.54.22 0 .42.13.5.34l1.58 3.64V8.54c0-.3.24-.54.54-.54s.54.24.54.54v4.08c0 .3-.24.54-.54.54zm3.12-.54c.3 0 .54-.24.54-.54s-.24-.54-.54-.54h-1.56V10.5h1.56c.3 0 .54-.24.54-.54s-.24-.54-.54-.54h-1.56V8.54h1.56c.3 0 .54-.24.54-.54s-.24-.54-.54-.54h-2.1c-.3 0-.54.24-.54.54v4.08c0 .3.24.54.54.54h2.1z" />
        </svg>
        {isLoading ? '接続中...' : label}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}

export default LineLoginButton
