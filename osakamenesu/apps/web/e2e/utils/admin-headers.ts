import { Buffer } from 'node:buffer'

export function resolveAdminExtraHeaders(): Record<string, string> | null {
  const headers: Record<string, string> = {}

  const adminKey = process.env.ADMIN_API_KEY ?? process.env.OSAKAMENESU_ADMIN_API_KEY
  if (adminKey && adminKey.trim()) {
    headers['X-Admin-Key'] = adminKey.trim()
  }

  const adminUser = process.env.ADMIN_BASIC_USER
  const adminPass = process.env.ADMIN_BASIC_PASS
  if (adminUser && adminPass) {
    const token = Buffer.from(`${adminUser}:${adminPass}`).toString('base64')
    headers.Authorization = `Basic ${token}`
  }

  return Object.keys(headers).length ? headers : null
}
