import { Buffer } from 'node:buffer'

import { getServerConfig } from '@/lib/server-config'

const FALLBACK_USER = 'yusaku0324'
const FALLBACK_PASS = 'sakanon0402'

export const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.OSAKAMENESU_ADMIN_API_KEY || ''
const serverConfig = getServerConfig()
export const PUBLIC_BASE = serverConfig.publicApiBase
export const INTERNAL_BASE =
  process.env.E2E_INTERNAL_API_BASE ||
  process.env.E2E_SEED_API_BASE ||
  serverConfig.internalApiBase

const ADMIN_BASIC_USER = process.env.ADMIN_BASIC_USER || FALLBACK_USER
const ADMIN_BASIC_PASS = process.env.ADMIN_BASIC_PASS || FALLBACK_PASS
const BASIC_AUTH_HEADER =
  ADMIN_BASIC_USER && ADMIN_BASIC_PASS
    ? `Basic ${Buffer.from(`${ADMIN_BASIC_USER}:${ADMIN_BASIC_PASS}`, 'utf8').toString('base64')}`
    : null

if (!ADMIN_KEY) {
  console.warn(
    '[api/admin] ADMIN_API_KEY (or OSAKAMENESU_ADMIN_API_KEY) is not set; admin requests will fail',
  )
}

export function adminBases() {
  return [INTERNAL_BASE, PUBLIC_BASE]
}

export function buildAdminHeaders(base: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...base }
  if (ADMIN_KEY) {
    headers['X-Admin-Key'] = ADMIN_KEY
  }
  if (BASIC_AUTH_HEADER) {
    headers.authorization = BASIC_AUTH_HEADER
  }
  return headers
}
