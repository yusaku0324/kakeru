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
            return header.length === value.length && header === value
          }
        }
      }
    }
    return false
  }

  if (!cookie) return false
  return header.length === cookie.length && header === cookie
}
