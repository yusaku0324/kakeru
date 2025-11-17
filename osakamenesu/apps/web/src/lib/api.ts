const DEFAULT_SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'

type ServerBases = {
  internal: string
  publicBase: string
}

let cachedServerBases: ServerBases | null = null

function loadServerBases(): ServerBases {
  if (cachedServerBases) {
    return cachedServerBases
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getServerConfig } = require('./server-config') as typeof import('./server-config')
  const config = getServerConfig()
  cachedServerBases = {
    internal: config.internalApiBase,
    publicBase: config.publicApiBase || '/api',
  }
  return cachedServerBases
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, '')
}

function resolveSiteOrigin(): string {
  if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
    return normalizeBase(window.location.origin)
  }
  return normalizeBase(DEFAULT_SITE_ORIGIN)
}

export function resolveApiBases(): string[] {
  const bases: string[] = []
  const isBrowser = typeof window !== 'undefined'

  const addBase = (base: string | null | undefined) => {
    if (!base) return
    if (bases.includes(base)) return
    bases.push(base)
  }

  if (isBrowser) {
    const publicBase =
      process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE || process.env.NEXT_PUBLIC_API_BASE || '/api'
    addBase('/api')
    addBase(publicBase || '/api')
  } else {
    const { internal, publicBase } = loadServerBases()
    addBase(internal)
    addBase(publicBase || '/api')
    addBase('/api')
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

  const origin = resolveSiteOrigin()
  const absolute = candidate.startsWith('/')
    ? `${origin}${candidate}`
    : `${origin}/${candidate.replace(/^\/+/, '')}`
  return absolute
}
