import { resolveInternalApiBase } from '@/lib/server-config'

export const runtime = 'edge'

export async function GET() {
  const base = resolveInternalApiBase()

  if (!base) {
    return new Response(JSON.stringify({ ok: false, error: 'API base env vars not set' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const target = `${base.replace(/\/+$/, '')}/api/v1/shops?page=1&page_size=1`

  try {
    const res = await fetch(target, { headers: { accept: 'application/json' }, cache: 'no-store' })
    const body = await res.text()
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, url: target, body }), {
      status: res.ok ? 200 : res.status,
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message, url: target }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
}
