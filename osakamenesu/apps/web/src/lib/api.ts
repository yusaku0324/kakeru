const DEFAULT_SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, '')
}

export function resolveApiBases(): string[] {
  const internal =
    process.env.OSAKAMENESU_API_INTERNAL_BASE ||
    process.env.API_INTERNAL_BASE ||
    ''
  const publicBase =
    process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
    process.env.NEXT_PUBLIC_API_BASE ||
    ''

  const bases: string[] = []
  const isBrowser = typeof window !== 'undefined'

  const addBase = (base: string | null | undefined) => {
    if (!base) return
    if (bases.includes(base)) return
    bases.push(base)
  }

  if (isBrowser) {
    addBase('/api')
    addBase(publicBase || '/api')
    addBase(internal)
  } else {
    addBase(internal)
    addBase('/api')
    addBase(publicBase || '/api')
  }

  if (!bases.length) {
    bases.push('/api')
  }

  return bases
}

export function buildApiUrl(base: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  let candidate: string
  if (base.startsWith('http://') || base.startsWith('https://')) {
    candidate = `${normalizeBase(base)}${normalizedPath}`
  } else if (base.startsWith('//')) {
    candidate = `https:${normalizeBase(base)}${normalizedPath}`
  } else if (base) {
    const prefix = normalizeBase(base)
    if (!prefix) {
      candidate = normalizedPath
    } else if (normalizedPath.startsWith(`${prefix}/`) || normalizedPath === prefix) {
      candidate = normalizedPath
    } else {
      candidate = `${prefix}${normalizedPath}`
    }
  } else {
    candidate = normalizedPath
  }

  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return candidate
  }

  if (candidate.startsWith('//')) {
    return `https:${candidate}`
  }

  const origin = normalizeBase(DEFAULT_SITE_ORIGIN)
  const absolute = candidate.startsWith('/')
    ? `${origin}${candidate}`
    : `${origin}/${candidate.replace(/^\/+/, '')}`
  return absolute
}
