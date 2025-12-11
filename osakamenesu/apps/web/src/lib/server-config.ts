const DEFAULT_INTERNAL_API_BASE =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.API_INTERNAL_BASE ||
  process.env.OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  'http://osakamenesu-api:8000'

const DEFAULT_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://127.0.0.1:3000'

const DEFAULT_PUBLIC_API_BASE =
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE || process.env.NEXT_PUBLIC_API_BASE || ''

export type ServerConfig = {
  internalApiBase: string
  publicApiBase: string
  siteUrl: string
}

function normalizeBase(base: string): string {
  if (!base) return ''
  return base.replace(/\/+$/, '')
}

export function getServerConfig(): ServerConfig {
  return {
    internalApiBase: normalizeBase(DEFAULT_INTERNAL_API_BASE),
    publicApiBase: normalizeBase(DEFAULT_PUBLIC_API_BASE || '') || '/api',
    siteUrl: normalizeBase(DEFAULT_SITE_URL),
  }
}

export function resolveInternalApiBase(): string {
  return getServerConfig().internalApiBase
}
