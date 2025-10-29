import { buildApiUrl, resolveApiBases } from '@/lib/api'

export type MagicLinkRequestResult =
  | { status: 'success' }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string }

async function requestMagicLink(email: string, scope: 'dashboard' | 'site'): Promise<MagicLinkRequestResult> {
  const payload = JSON.stringify({ email: email.trim(), scope })
  let lastError: string | null = null

  for (const base of resolveApiBases()) {
    try {
      const response = await fetch(buildApiUrl(base, 'api/auth/request-link'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: payload,
      })

      if (response.ok) {
        return { status: 'success' }
      }

      if (response.status === 429) {
        return { status: 'rate_limited' }
      }

      const detail = await response
        .json()
        .then((data) => (data && (data.detail || data.message)) as string | undefined)
        .catch(() => undefined)

      lastError =
        detail ??
        `ログインリンクの送信に失敗しました (status=${response.status})`
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : 'ログインリンクの送信中にエラーが発生しました'
    }
  }

  return {
    status: 'error',
    message: lastError ?? 'ログインリンクの送信に失敗しました。時間をおいて再度お試しください。',
  }
}

export async function requestDashboardMagicLink(email: string): Promise<MagicLinkRequestResult> {
  return requestMagicLink(email, 'dashboard')
}

export async function requestSiteMagicLink(email: string): Promise<MagicLinkRequestResult> {
  return requestMagicLink(email, 'site')
}
