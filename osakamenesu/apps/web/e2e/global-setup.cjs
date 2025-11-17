const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const dns = require('node:dns').promises
const { request } = require('@playwright/test')

const ADMIN_WEB_HOST = (process.env.ADMIN_WEB_HOST || 'web').trim() || 'web'
const ADMIN_WEB_PORT = (process.env.ADMIN_WEB_PORT || '3000').trim() || '3000'
const ADMIN_WEB_PROTOCOL = (process.env.ADMIN_WEB_PROTOCOL || 'http').trim() || 'http'

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestWithRetry(factory, { attempts = 5, delayMs = 1000 } = {}) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await factory()
    } catch (error) {
      lastError = error
      const shouldRetry = error?.code === 'ECONNREFUSED' || error?.code === 'EAI_AGAIN'
      if (!shouldRetry || i === attempts - 1) {
        throw error
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastError
}

async function waitForHostname(hostname, { timeoutMs = 60_000, intervalMs = 1_000, label } = {}) {
  const deadline = Date.now() + timeoutMs
  let attempt = 0
  let lastError

  while (Date.now() < deadline) {
    attempt += 1
    try {
      console.log(`[playwright] [waitForHostname] ${label ?? hostname} attempt ${attempt}`)
      await dns.lookup(hostname)
      console.log(`[playwright] [waitForHostname] ${label ?? hostname} resolved`)
      return
    } catch (error) {
      lastError = error
      console.warn(
        `[playwright] [waitForHostname] ${label ?? hostname} attempt ${attempt} failed: ${error?.code ?? error?.message ?? error}`,
      )
    }
    await delay(intervalMs)
  }

  const reason = lastError ? `${lastError}` : 'unknown'
  throw new Error(
    `[playwright] hostname not reachable: ${label ?? hostname} (${reason}). ` +
      'This likely indicates a Docker networking / service-name issue.',
  )
}

function extractHostname(raw) {
  try {
    const url = new URL(raw)
    return url.hostname
  } catch {
    return null
  }
}

async function waitForService(
  baseUrl,
  { path = '/api/health', timeoutMs = 60_000, intervalMs = 2_000, label } = {},
) {
  const normalizedBase = baseUrl.replace(/\/$/, '')
  const target = `${normalizedBase}${path}`
  const hostname = /^https?:/i.test(normalizedBase) ? extractHostname(normalizedBase) : null
  const serviceLabel = label ?? target

  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    await waitForHostname(hostname, {
      timeoutMs,
      intervalMs: Math.min(intervalMs, 1_000),
      label: hostname,
    })
  }

  const deadline = Date.now() + timeoutMs
  let attempt = 0
  let lastError

  while (Date.now() < deadline) {
    attempt += 1
    console.log(`[playwright] [waitForService] ${serviceLabel} attempt ${attempt}`)
    const context = await request.newContext()
    try {
      const response = await context.get(target, { timeout: Math.min(5_000, intervalMs) })
      if (response.ok()) {
        console.log(`[playwright] [waitForService] ${serviceLabel} is ready`)
        return
      }
      lastError = new Error(`HTTP ${response.status()} ${response.statusText()}`)
      console.warn(
        `[playwright] [waitForService] ${serviceLabel} attempt ${attempt} failed: ${lastError.message}`,
      )
    } catch (error) {
      lastError = error
      console.warn(
        `[playwright] [waitForService] ${serviceLabel} attempt ${attempt} error: ${error?.code ?? error?.message ?? error}`,
      )
    } finally {
      await context.dispose()
    }

    await delay(intervalMs)
  }

  const reason = lastError ? `${lastError}` : 'unknown'
  throw new Error(
    `[playwright] service not reachable: ${serviceLabel} (${target}) after ${attempt} attempts (${reason})`,
  )
}

function resolvePythonCandidates() {
  if (process.env.E2E_PYTHON) {
    return [process.env.E2E_PYTHON]
  }
  if (process.platform === 'win32') {
    return ['python', 'python3']
  }
  return ['python3', 'python']
}

async function runSeed() {
  if (process.env.SKIP_E2E_SETUP === '1') {
    console.warn('[playwright] SKIP_E2E_SETUP=1 が設定されているためシード処理をスキップします')
    return
  }

  if (!process.env.E2E_SEED_API_BASE || !process.env.E2E_SEED_API_BASE.trim()) {
    const resolved = resolveApiBase()
    if (resolved) {
      process.env.E2E_SEED_API_BASE = resolved
    }
  }

  const repoRoot = path.resolve(__dirname, '..', '..', '..')
  const scriptPath = path.resolve(repoRoot, 'services', 'api', 'scripts', 'seed_admin_test_data.py')

  if (!fs.existsSync(scriptPath)) {
    console.warn(
      `[playwright] シードスクリプトが見つかりませんでした (${scriptPath})。処理をスキップします。`,
    )
    return
  }

  const pythonCandidates = resolvePythonCandidates()
  let lastStatus = null
  let lastError

  for (const executable of pythonCandidates) {
    const result = spawnSync(executable, [scriptPath], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    })
    lastStatus = result.status
    lastError = result.error
    if (result.status === 0) {
      return
    }
  }

  const errorMessage = lastError ? lastError.message : `exit status ${lastStatus}`
  throw new Error(`[playwright] シードスクリプトの実行に失敗しました: ${errorMessage}`)
}

function resolveAdminWebHealthBase() {
  if (/^https?:\/\//i.test(ADMIN_WEB_HOST)) {
    return ADMIN_WEB_HOST.replace(/\/$/, '')
  }
  const portSegment = ADMIN_WEB_PORT ? `:${ADMIN_WEB_PORT}` : ''
  return `${ADMIN_WEB_PROTOCOL}://${ADMIN_WEB_HOST}${portSegment}`
}

function resolveWebBase() {
  const adminOverride = ADMIN_WEB_HOST ? resolveAdminWebHealthBase() : null
  const candidates = [
    adminOverride,
    process.env.E2E_INTERNAL_WEB_BASE,
    process.env.E2E_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.replace(/\/$/, '')
    }
  }
  return resolveAdminWebHealthBase()
}

function resolveApiBase() {
  const candidates = [
    process.env.E2E_INTERNAL_API_BASE,
    process.env.E2E_SEED_API_BASE,
    process.env.OSAKAMENESU_API_INTERNAL_BASE,
    process.env.API_INTERNAL_BASE,
    process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE,
    process.env.NEXT_PUBLIC_API_BASE,
    process.env.E2E_API_BASE,
  ]
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) {
      return candidate.replace(/\/$/, '')
    }
  }
  return 'http://api:8000'
}

function parseSetCookieHeaders(setCookieValues, origin) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return setCookieValues
    .map((raw) => {
      const segments = raw
        .split(';')
        .map((segment) => segment.trim())
        .filter(Boolean)
      if (!segments.length) return null
      const [nameValue, ...attributes] = segments
      const separatorIndex = nameValue.indexOf('=')
      if (separatorIndex <= 0) return null
      const name = nameValue.slice(0, separatorIndex).trim()
      const value = nameValue.slice(separatorIndex + 1).trim()
      if (!name) return null

      const cookie = {
        name,
        value,
        domain: origin.hostname,
        path: '/',
        httpOnly: false,
        secure: origin.protocol === 'https:',
      }

      for (const attribute of attributes) {
        const [attrNameRaw, ...attrValueParts] = attribute.split('=')
        const attrName = attrNameRaw.trim().toLowerCase()
        const attrValue = attrValueParts.join('=').trim()

        switch (attrName) {
          case 'domain':
            if (attrValue) cookie.domain = attrValue.toLowerCase()
            break
          case 'path':
            if (attrValue) cookie.path = attrValue
            break
          case 'secure':
            cookie.secure = true
            break
          case 'httponly':
            cookie.httpOnly = true
            break
          case 'samesite':
            if (attrValue) {
              const normalized =
                attrValue.charAt(0).toUpperCase() + attrValue.slice(1).toLowerCase()
              if (['Lax', 'Strict', 'None'].includes(normalized)) {
                cookie.sameSite = normalized
              }
            }
            break
          case 'expires':
            if (attrValue) {
              const parsed = Date.parse(attrValue)
              if (!Number.isNaN(parsed)) cookie.expires = Math.floor(parsed / 1000)
            }
            break
          case 'max-age':
            if (attrValue) {
              const parsed = Number.parseInt(attrValue, 10)
              if (!Number.isNaN(parsed)) cookie.expires = nowSeconds + parsed
            }
            break
          default:
            break
        }
      }

      return cookie
    })
    .filter(Boolean)
}

async function createDashboardStorage() {
  if (process.env.SKIP_DASHBOARD_STORAGE === '1') {
    console.warn(
      '[playwright] SKIP_DASHBOARD_STORAGE=1 が設定されているためストレージ生成をスキップします',
    )
    return
  }

  const secret = [process.env.E2E_TEST_AUTH_SECRET, process.env.TEST_AUTH_SECRET].find(
    (value) => value && value.trim(),
  )
  if (!secret) {
    console.warn(
      '[playwright] テスト用シークレットが未設定のため dashboard storage を生成できません',
    )
    return
  }

  const adminHealthBase = resolveAdminWebHealthBase()
  const webBase = resolveWebBase()
  const apiBase = resolveApiBase()
  const storageDir = path.resolve(__dirname, 'storage')
  const storagePath = path.resolve(storageDir, 'dashboard.json')
  const email = process.env.E2E_TEST_DASHBOARD_EMAIL ?? 'playwright-dashboard@example.com'
  const displayName = process.env.E2E_TEST_DASHBOARD_NAME ?? 'Playwright Dashboard User'
  const webHost = new URL(webBase).hostname

  console.log(`[playwright] admin web host=${ADMIN_WEB_HOST} port=${ADMIN_WEB_PORT}`)
  await waitForService(adminHealthBase, {
    path: '/api/health',
    label: `admin web (${adminHealthBase})`,
    timeoutMs: 60_000,
  })
  await waitForService(apiBase, { path: '/healthz' })
  const requestContext = await request.newContext()
  try {
    const response = await requestWithRetry(() =>
      requestContext.post(`${apiBase}/api/auth/test-login`, {
        data: {
          email,
          display_name: displayName,
          scope: 'dashboard',
        },
        headers: {
          'X-Test-Auth-Secret': secret,
        },
      }),
    )

    if (!response.ok()) {
      console.warn(`[playwright] test-login API が失敗しました (${response.status()})`)
      return
    }

    const cookieHeaders = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value)

    if (!cookieHeaders.length) {
      console.warn('[playwright] test-login API から Cookie が返されませんでした')
      return
    }

    const parsedCookies = parseSetCookieHeaders(cookieHeaders, new URL(webBase))
    if (!parsedCookies.length) {
      console.warn('[playwright] Cookie 解析に失敗しました')
      return
    }
    const cookiesForStorage = parsedCookies.map((cookie) => {
      if (!cookie.domain || cookie.domain === 'test_auth_secret_local') {
        return { ...cookie, domain: webHost }
      }
      return cookie
    })
    cookiesForStorage.push({
      name: 'osakamenesu_csrf',
      value: crypto.randomBytes(16).toString('hex'),
      domain: webHost,
      path: '/',
      httpOnly: false,
      secure: webBase.startsWith('https://'),
    })

    const storageState = {
      cookies: cookiesForStorage.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expires: cookie.expires ?? -1,
        httpOnly: cookie.httpOnly ?? false,
        secure: cookie.secure ?? false,
        sameSite: cookie.sameSite,
      })),
      origins: [],
    }

    fs.mkdirSync(storageDir, { recursive: true })
    fs.writeFileSync(storagePath, JSON.stringify(storageState, null, 2), 'utf8')
    process.env.PLAYWRIGHT_DASHBOARD_STORAGE = storagePath
    console.log(`[playwright] dashboard storage を生成しました: ${storagePath}`)
  } finally {
    await requestContext.dispose()
  }
}

async function createSiteStorage() {
  if (process.env.SKIP_SITE_STORAGE === '1') {
    console.warn(
      '[playwright] SKIP_SITE_STORAGE=1 が設定されているためサイト用ストレージ生成をスキップします',
    )
    return
  }

  const secret = [process.env.E2E_TEST_AUTH_SECRET, process.env.TEST_AUTH_SECRET].find(
    (value) => value && value.trim(),
  )
  if (!secret) {
    console.warn('[playwright] テスト用シークレットが未設定のため site storage を生成できません')
    return
  }

  const webBase = resolveWebBase()
  const storageDir = path.resolve(__dirname, 'storage')
  const storagePath = path.resolve(storageDir, 'site.json')
  const email = process.env.E2E_TEST_AUTH_EMAIL ?? 'playwright-site-user@example.com'
  const displayName = process.env.E2E_TEST_AUTH_DISPLAY_NAME ?? 'Playwright Site User'
  const webHost = new URL(webBase).hostname

  await waitForService(webBase)
  const requestContext = await request.newContext()
  try {
    const response = await requestWithRetry(() =>
      requestContext.post(`${webBase}/api/auth/test-login`, {
        data: {
          email,
          display_name: displayName,
          scope: 'site',
        },
        headers: {
          'X-Test-Auth-Secret': secret,
        },
      }),
    )

    if (!response.ok()) {
      console.warn(`[playwright] site 用 test-login API が失敗しました (${response.status()})`)
      return
    }

    const cookieHeaders = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value)

    if (!cookieHeaders.length) {
      console.warn('[playwright] site 用 test-login API から Cookie が返されませんでした')
      return
    }

    const parsedCookies = parseSetCookieHeaders(cookieHeaders, new URL(webBase))
    if (!parsedCookies.length) {
      console.warn('[playwright] site Cookie 解析に失敗しました')
      return
    }
    const cookiesForStorage = parsedCookies.map((cookie) => {
      const domain =
        !cookie.domain || cookie.domain === 'test_auth_secret_local' ? webHost : cookie.domain
      return {
        ...cookie,
        domain,
        secure: webBase.startsWith('https://'),
      }
    })

    cookiesForStorage.push({
      name: 'osakamenesu_csrf',
      value: crypto.randomBytes(16).toString('hex'),
      domain: webHost,
      path: '/',
      httpOnly: false,
      secure: webBase.startsWith('https://'),
    })

    const storageState = {
      cookies: cookiesForStorage.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expires: cookie.expires ?? -1,
        httpOnly: cookie.httpOnly ?? false,
        secure: cookie.secure ?? false,
        sameSite: cookie.sameSite,
      })),
      origins: [],
    }

    fs.mkdirSync(storageDir, { recursive: true })
    fs.writeFileSync(storagePath, JSON.stringify(storageState, null, 2), 'utf8')
    process.env.PLAYWRIGHT_SITE_STORAGE = storagePath
    console.log(`[playwright] site storage を生成しました: ${storagePath}`)
  } finally {
    await requestContext.dispose()
  }
}

async function globalSetup() {
  await runSeed()
  await createDashboardStorage()
  await createSiteStorage()
}

module.exports = globalSetup
