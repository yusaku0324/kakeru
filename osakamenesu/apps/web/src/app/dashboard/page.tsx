import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { buildApiUrl } from '@/lib/api'

const INTERNAL_API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  '/api'

function serializeCookieHeader(): string | undefined {
  const store = cookies()
  const entries = store.getAll()
  if (!entries.length) {
    return undefined
  }
  return entries.map((entry) => `${entry.name}=${entry.value}`).join('; ')
}

type DashboardResolveResult =
  | { status: 'shop'; id: string }
  | { status: 'unauthorized' }
  | { status: 'empty' }

async function resolveFirstDashboardShopId(): Promise<DashboardResolveResult> {
  const cookieHeader = serializeCookieHeader()
  const url = buildApiUrl(INTERNAL_API_BASE, 'api/dashboard/shops?limit=1')

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: 'no-store',
      credentials: cookieHeader ? 'omit' : 'include',
    })

    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthorized' }
    }

    if (!res.ok) {
      return { status: 'empty' }
    }

    const data = (await res.json().catch(() => undefined)) as
      | { shops?: Array<{ id?: string }> }
      | undefined

    const first = data?.shops?.[0]
    if (first && typeof first?.id === 'string') {
      return { status: 'shop', id: first.id }
    }
    return { status: 'empty' }
  } catch {
    return { status: 'empty' }
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardIndexPage() {
  const result = await resolveFirstDashboardShopId()

  if (result.status === 'shop') {
    redirect(`/dashboard/${result.id}`)
  }

  if (result.status === 'unauthorized') {
    redirect('/dashboard/favorites')
  }

  redirect('/dashboard/new')
}
