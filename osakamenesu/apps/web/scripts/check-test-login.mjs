#!/usr/bin/env node
import 'dotenv/config'

const base =
  process.env.OSAKAMENESU_API_INTERNAL_BASE ||
  process.env.NEXT_PUBLIC_OSAKAMENESU_API_BASE ||
  'http://127.0.0.1:8000'
const secret = process.env.E2E_TEST_AUTH_SECRET || process.env.TEST_AUTH_SECRET

if (!secret) {
  console.error('E2E_TEST_AUTH_SECRET が設定されていません')
  process.exit(1)
}

const url = `${base.replace(/\/$/, '')}/api/auth/test-login`
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Test-Auth-Secret': secret,
  },
  body: JSON.stringify({
    email: 'Playwright Test Login',
    display_name: 'Playwright Dev',
    scope: 'dashboard',
  }),
})

console.log('status', response.status)
try {
  console.log('body', await response.json())
} catch {
  console.log('text', await response.text())
}
