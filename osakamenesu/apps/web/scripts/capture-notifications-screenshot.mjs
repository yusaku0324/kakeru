#!/usr/bin/env node
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const args = argv.slice(2)
  const options = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--output' && args[index + 1]) {
      options.output = args[index + 1]
      index += 1
      continue
    }
    if (arg === '--base-url' && args[index + 1]) {
      options.baseURL = args[index + 1]
      index += 1
      continue
    }
    if (arg === '--profile-id' && args[index + 1]) {
      options.profileId = args[index + 1]
      index += 1
      continue
    }
    if (arg === '--help') {
      options.help = true
      break
    }
    if (arg === '--state' && args[index + 1]) {
      options.state = args[index + 1]
      index += 1
      continue
    }
  }

  return options
}

function printHelp() {
  console.log(`Usage: node scripts/capture-notifications-screenshot.mjs [options]

Options:
  --output <path>       保存先 (デフォルト: ../../../../docs/images/notifications/line-settings-01.png)
  --base-url <url>      対象のフロントエンド URL (デフォルト: http://127.0.0.1:3000)
  --profile-id <uuid>   指定すると該当店舗の通知設定ページを開く
  --state <form|saved>  撮影状態を選択 (デフォルト: form)

実行前に E2E_TEST_AUTH_SECRET もしくは TEST_AUTH_SECRET を環境変数に設定してください。`)
}

function parseSetCookieHeaders(setCookieValues, origin) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return setCookieValues
    .map((raw) => {
      const segments = raw.split(';').map((segment) => segment.trim()).filter(Boolean)
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
            if (attrValue) {
              cookie.domain = attrValue.toLowerCase()
            }
            break
          case 'path':
            if (attrValue) {
              cookie.path = attrValue
            }
            break
          case 'secure':
            cookie.secure = true
            break
          case 'httponly':
            cookie.httpOnly = true
            break
          case 'samesite':
            if (attrValue) {
              const normalized = attrValue.charAt(0).toUpperCase() + attrValue.slice(1).toLowerCase()
              if (normalized === 'Lax' || normalized === 'Strict' || normalized === 'None') {
                cookie.sameSite = normalized
              }
            }
            break
          case 'expires':
            if (attrValue) {
              const parsed = Date.parse(attrValue)
              if (!Number.isNaN(parsed)) {
                cookie.expires = Math.floor(parsed / 1000)
              }
            }
            break
          case 'max-age':
            if (attrValue) {
              const parsed = Number.parseInt(attrValue, 10)
              if (!Number.isNaN(parsed)) {
                cookie.expires = nowSeconds + parsed
              }
            }
            break
          default:
            break
        }
      }

      return cookie
    })
    .filter((cookie) => Boolean(cookie))
}

async function ensureDashboardAuthenticated(context, page, baseURL) {
  const normalizedBase = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  const secretCandidates = [process.env.E2E_TEST_AUTH_SECRET, process.env.TEST_AUTH_SECRET]
    .filter((value) => Boolean(value && value.trim()))

  if (!secretCandidates.length) {
    throw new Error('E2E_TEST_AUTH_SECRET もしくは TEST_AUTH_SECRET が必要です')
  }

  const email = process.env.E2E_TEST_DASHBOARD_EMAIL ?? 'screenshot-dashboard@example.com'
  const displayName = process.env.E2E_TEST_DASHBOARD_NAME ?? 'Dashboard Screenshot User'

  for (const secret of secretCandidates) {
    const response = await page.request.post(`${normalizedBase}/api/auth/test-login`, {
      data: {
        email,
        display_name: displayName,
        scope: 'dashboard',
      },
      headers: {
        'X-Test-Auth-Secret': secret,
      },
    })

    if (response.status() === 503) {
      throw new Error('dashboard test-login API が無効化されています')
    }
    if (response.status() === 401) {
      continue
    }
    if (!response.ok()) {
      throw new Error(`test-login API が失敗しました (status=${response.status()})`)
    }

    const cookieHeaders = response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value)

    if (!cookieHeaders.length) {
      throw new Error('Set-Cookie ヘッダーが応答に含まれていません')
    }

    const cookies = parseSetCookieHeaders(cookieHeaders, new URL(baseURL))
    if (!cookies.length) {
      throw new Error('Set-Cookie ヘッダーの解析に失敗しました')
    }

    await context.addCookies(cookies)
    return
  }

  throw new Error('テスト用シークレットが一致せずログインできませんでした')
}

async function resolveProfileId(page, explicitProfileId) {
  if (explicitProfileId) {
    return explicitProfileId
  }
  const response = await page.request.get('/api/dashboard/shops?limit=1')
  if (!response.ok()) {
    throw new Error(`/api/dashboard/shops の取得に失敗しました (status=${response.status()})`)
  }
  const json = await response.json()
  const items = Array.isArray(json?.items) ? json.items : Array.isArray(json?.shops) ? json.shops : []
  const firstShop = items[0]
  if (!firstShop?.id) {
    throw new Error('ダッシュボード用の店舗データが見つかりませんでした')
  }
  return firstShop.id
}

async function configureNotificationForm(page, state) {
  const lineToggle = page.locator('#channel-line')
  if (!(await lineToggle.isChecked())) {
    await lineToggle.check()
  }

  const emailToggle = page.locator('#channel-email')
  if (state === 'error') {
    if (await emailToggle.isChecked()) {
      await emailToggle.uncheck()
    }
  } else if (!(await emailToggle.isChecked())) {
    await emailToggle.check()
  }

  const tokenField = page.locator('input[placeholder="チャネルアクセストークン"]')
  const webhookField = page.locator('input[placeholder="https://example.com/api/line/webhook"]')
  const emailTextarea = page.locator('textarea[placeholder="store@example.com"]')

  if (state === 'error') {
    await tokenField.fill('')
    await webhookField.fill('')
    if ((await emailTextarea.isVisible()) && (await emailTextarea.isEnabled())) {
      await emailTextarea.fill('')
    }
  } else {
    await tokenField.fill('sample-channel-access-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx')
    await webhookField.fill('https://example.com/api/line/webhook')
    await emailTextarea.fill('notifications@example.com')
  }
}

async function main() {
  const options = parseArgs(process.argv)
  if (options.help) {
    printHelp()
    return
  }

  const defaultOutput = path.resolve(__dirname, '../../../../docs/images/notifications/line-settings-01.png')
  const outputPath = options.output ? path.resolve(process.cwd(), options.output) : defaultOutput
  const baseURL = options.baseURL ?? process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3000'
  const state = options.state ?? 'form'

  if (!['form', 'saved', 'error'].includes(state)) {
    throw new Error(`Unsupported state: ${state}`)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  try {
    await ensureDashboardAuthenticated(context, page, baseURL)
    const profileId = await resolveProfileId(page, options.profileId)
    await page.goto(`/dashboard/${profileId}/notifications`, { waitUntil: 'networkidle' })
    await page.waitForSelector('h2:text("通知チャネル")')

    await configureNotificationForm(page, state)

    if (state === 'saved') {
      const saveButton = page.getByRole('button', { name: '設定を保存' })
      await saveButton.click()
      await page.waitForResponse((response) => response.url().includes('/api/dashboard/shops/') && response.request().method() === 'PUT', { timeout: 10000 }).catch(() => null)
      await page.waitForSelector('text=通知設定を保存しました。', { timeout: 5000 }).catch(() => null)
      await page.waitForTimeout(400)
    } else if (state === 'error') {
      const saveButton = page.getByRole('button', { name: '設定を保存' })
      await saveButton.click()
      await page.waitForSelector('text=入力内容を確認してください。', { timeout: 5000 }).catch(() => null)
      await page.waitForTimeout(400)
    } else {
      await page.waitForTimeout(300)
    }

    await mkdir(path.dirname(outputPath), { recursive: true })
    await page.screenshot({ path: outputPath, fullPage: true })
    console.log(`Screenshot captured to ${outputPath}`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
