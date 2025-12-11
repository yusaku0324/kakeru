export const CSRF_COOKIE_NAME = 'osakamenesu_csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'

export function isCsrfProtectedMethod(method: string) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())
}

export function shouldBypassCsrf(pathname: string) {
  if (pathname.startsWith('/api/auth/login')) return true
  if (pathname.startsWith('/api/health')) return true
  return false
}

/**
 * タイミング攻撃耐性のある文字列比較
 * 常に全文字を比較し、処理時間から情報が漏れないようにする
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 長さが違う場合でもダミー比較を行い、処理時間を均一化
    let result = 1
    const minLen = Math.min(a.length, b.length) || 1
    for (let i = 0; i < minLen; i++) {
      result |= a.charCodeAt(i % a.length) ^ b.charCodeAt(i % b.length)
    }
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export function validateCsrfToken(request: Request): boolean {
  const method = request.method?.toUpperCase?.() ?? 'GET'
  if (!isCsrfProtectedMethod(method)) {
    return true
  }

  const header = request.headers.get(CSRF_HEADER_NAME)
  if (!header) return false

  const cookie = (request as any).cookies?.get?.(CSRF_COOKIE_NAME)?.value
  if (!cookie && 'headers' in request) {
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      for (const part of cookieHeader.split(';')) {
        const [name, ...valueParts] = part.trim().split('=')
        if (name === CSRF_COOKIE_NAME) {
          const value = valueParts.join('=')
          if (value) {
            return timingSafeEqual(header, value)
          }
        }
      }
    }
    return false
  }

  if (!cookie) return false
  return timingSafeEqual(header, cookie)
}
