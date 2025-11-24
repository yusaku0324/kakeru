import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { buildApiUrl } from '@/lib/api'
import { resolveInternalApiBase } from '@/lib/server-config'

async function serializeCookieHeader(): Promise<string | undefined> {
  const store = await cookies()
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
  const cookieHeader = await serializeCookieHeader()
  const bases = ['/api', resolveInternalApiBase()]

  for (const base of bases) {
    const url = buildApiUrl(base, 'api/dashboard/shops?limit=1')

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
        continue
      }

      const data = (await res.json().catch(() => undefined)) as
        | { shops?: Array<{ id?: string }> }
        | undefined

      const first = data?.shops?.[0]
      if (first && typeof first?.id === 'string') {
        return { status: 'shop', id: first.id }
      }
    } catch {
      continue
    }
  }

  return { status: 'empty' }
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
