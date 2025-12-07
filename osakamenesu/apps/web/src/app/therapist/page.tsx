import Link from 'next/link'
import { LineLoginButton } from '@/components/auth/LineLoginButton'

/**
 * セラピストポータル - ログインページ
 *
 * セラピストがLINEでログインするためのページ。
 * ログイン済みの場合はダッシュボードにリダイレクト（TODO）。
 */
export default function TherapistLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900">
            セラピストポータル
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            大阪メンエス.com
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-neutral-800">
                ログイン
              </h2>
              <p className="mt-1 text-sm text-neutral-500">
                LINEアカウントでログインしてください
              </p>
            </div>

            <LineLoginButton
              redirectPath="/therapist/settings"
              variant="primary"
              label="LINEでログイン"
              className="w-full"
            />

            <div className="text-center">
              <p className="text-xs text-neutral-400">
                ログインすることで、
                <Link href="/terms" className="text-primary-600 hover:underline">
                  利用規約
                </Link>
                と
                <Link href="/privacy" className="text-primary-600 hover:underline">
                  プライバシーポリシー
                </Link>
                に同意したものとみなされます。
              </p>
            </div>
          </div>
        </div>

        {/* Help Links */}
        <div className="text-center space-y-2">
          <p className="text-sm text-neutral-500">
            初めてご利用の方は、所属店舗の管理者にお問い合わせください。
          </p>
          <Link
            href="/"
            className="inline-block text-sm text-primary-600 hover:text-primary-700 hover:underline"
          >
            トップページに戻る
          </Link>
        </div>
      </div>
    </main>
  )
}
