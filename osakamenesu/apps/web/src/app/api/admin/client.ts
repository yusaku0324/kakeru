import { Buffer } from 'node:buffer'

import { getServerConfig } from '@/lib/server-config'

export const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.OSAKAMENESU_ADMIN_API_KEY || ''
const serverConfig = getServerConfig()
export const PUBLIC_BASE = serverConfig.publicApiBase
export const INTERNAL_BASE =
  process.env.E2E_INTERNAL_API_BASE ||
  process.env.E2E_SEED_API_BASE ||
  serverConfig.internalApiBase

// Basic auth is only used when explicitly configured via environment variables
const ADMIN_BASIC_USER = process.env.ADMIN_BASIC_USER || ''
const ADMIN_BASIC_PASS = process.env.ADMIN_BASIC_PASS || ''
const BASIC_AUTH_HEADER =
  ADMIN_BASIC_USER && ADMIN_BASIC_PASS
    ? `Basic ${Buffer.from(`${ADMIN_BASIC_USER}:${ADMIN_BASIC_PASS}`, 'utf8').toString('base64')}`
    : null

if (!ADMIN_KEY && !BASIC_AUTH_HEADER) {
  console.warn(
    '[api/admin] Neither ADMIN_API_KEY nor ADMIN_BASIC_USER/ADMIN_BASIC_PASS is set; admin requests will fail',
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
