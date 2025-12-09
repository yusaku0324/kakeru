import { authClient } from '@/lib/http-clients'

export type MagicLinkRequestResult =
  | { status: 'success'; mailSent: boolean }
  | { status: 'rate_limited' }
  | { status: 'error'; message: string }

async function requestMagicLink(
  email: string,
  scope: 'dashboard' | 'site',
): Promise<MagicLinkRequestResult> {
  const result = await authClient.post<{ mail_sent?: boolean }>('request-link', {
    email: email.trim(),
    scope,
  })

  if (result.ok) {
    return { status: 'success', mailSent: result.data?.mail_sent === true }
  }

  if (result.status === 429) {
    return { status: 'rate_limited' }
  }

  return {
    status: 'error',
    message:
      ('error' in result ? result.error : null) ||
      'ログインリンクの送信に失敗しました。時間をおいて再度お試しください。',
  }
}

export async function requestDashboardMagicLink(email: string): Promise<MagicLinkRequestResult> {
  return requestMagicLink(email, 'dashboard')
}

export async function requestSiteMagicLink(email: string): Promise<MagicLinkRequestResult> {
  return requestMagicLink(email, 'site')
}
