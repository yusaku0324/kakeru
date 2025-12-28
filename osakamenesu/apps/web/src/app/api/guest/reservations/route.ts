import { parseRequestBody, proxyToBackend } from '@/lib/api/route-helpers'

export async function POST(req: Request) {
  const parsed = await parseRequestBody(req)
  if ('error' in parsed) return parsed.error

  return proxyToBackend({
    method: 'POST',
    path: '/api/guest/reservations',
    body: JSON.stringify(parsed.data),
  })
}
