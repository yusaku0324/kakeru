import { NextResponse } from 'next/server'

const INTERNAL_BASE = process.env.OSAKAMENESU_API_INTERNAL_BASE || process.env.API_INTERNAL_BASE || 'http://osakamenesu-api:8000'
const PUBLIC_BASE = process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '/api'

function uniqueBases(): string[] {
  const bases = [INTERNAL_BASE, PUBLIC_BASE, '/api']
  const seen = new Set<string>()
  const ordered: string[] = []
  for (const base of bases) {
    const candidate = base || '/api'
    if (!seen.has(candidate)) {
      seen.add(candidate)
      ordered.push(candidate)
    }
  }
  return ordered
}

export async function GET(req: Request) {
  const cookie = req.headers.get('cookie')
  const headers: Record<string, string> = {}
  if (cookie) {
    headers.cookie = cookie
  }

  let lastError: { status: number; body: any } | null = null

  for (const base of uniqueBases()) {
    try {
      const resp = await fetch(`${base}/api/auth/session`, {
        method: 'GET',
        headers,
        cache: 'no-store',
      })
      const text = await resp.text()
      let payload: any = null
      if (text) {
        try {
          payload = JSON.parse(text)
        } catch {
          payload = { detail: text }
        }
      }

      if (resp.ok) {
        return NextResponse.json(payload, { status: resp.status })
      }

      lastError = { status: resp.status, body: payload }
    } catch (error) {
      lastError = { status: 503, body: { detail: (error as Error).message || 'session endpoint unreachable' } }
    }
  }

  if (lastError) {
    return NextResponse.json(lastError.body ?? { detail: 'session status unavailable' }, { status: lastError.status })
  }

  return NextResponse.json({ detail: 'session status unavailable' }, { status: 503 })
}
