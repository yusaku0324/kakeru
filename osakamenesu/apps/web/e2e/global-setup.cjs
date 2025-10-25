const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

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

  const repoRoot = path.resolve(__dirname, '..', '..', '..')
  const scriptPath = path.resolve(repoRoot, 'services', 'api', 'scripts', 'seed_admin_test_data.py')

  if (!fs.existsSync(scriptPath)) {
    console.warn(`[playwright] シードスクリプトが見つかりませんでした (${scriptPath})。処理をスキップします。`)
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

module.exports = runSeed
