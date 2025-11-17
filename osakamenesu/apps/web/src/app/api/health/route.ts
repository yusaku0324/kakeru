export function GET() {
  return new Response('ok', { status: 200 })
}

export function HEAD() {
  return new Response(null, { status: 200 })
}
