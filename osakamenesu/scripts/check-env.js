#!/usr/bin/env node

/**
 * 環境変数チェックスクリプト
 * 必要な環境変数が設定されているか確認します
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 色付きコンソール出力
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 環境変数の設定をチェック
function checkEnvVar(name, options = {}) {
  const value = process.env[name];
  const { required = true, pattern, minLength, type = 'string' } = options;

  if (!value) {
    if (required) {
      log(`  ❌ ${name}: 未設定`, 'red');
      return false;
    } else {
      log(`  ⚠️  ${name}: 未設定（オプション）`, 'yellow');
      return true;
    }
  }

  // 型チェック
  if (type === 'number' && isNaN(Number(value))) {
    log(`  ❌ ${name}: 数値である必要があります`, 'red');
    return false;
  }

  if (type === 'boolean' && !['true', 'false', '1', '0'].includes(value.toLowerCase())) {
    log(`  ❌ ${name}: ブール値である必要があります`, 'red');
    return false;
  }

  // パターンチェック
  if (pattern && !new RegExp(pattern).test(value)) {
    log(`  ❌ ${name}: 形式が正しくありません（期待: ${pattern}）`, 'red');
    return false;
  }

  // 長さチェック
  if (minLength && value.length < minLength) {
    log(`  ❌ ${name}: 最低${minLength}文字必要です（現在: ${value.length}文字）`, 'red');
    return false;
  }

  // マスクして表示
  let displayValue = value;
  if (name.includes('SECRET') || name.includes('PRIVATE') || name.includes('PASSWORD')) {
    displayValue = value.substring(0, 4) + '****' + value.substring(value.length - 4);
  } else if (value.length > 50) {
    displayValue = value.substring(0, 47) + '...';
  }

  log(`  ✅ ${name}: ${displayValue}`, 'green');
  return true;
}

// 環境変数グループのチェック
function checkEnvGroup(groupName, envVars) {
  log(`\n${groupName}:`, 'blue');
  let allValid = true;

  for (const [name, options] of Object.entries(envVars)) {
    if (!checkEnvVar(name, options)) {
      allValid = false;
    }
  }

  return allValid;
}

// メイン処理
function main() {
  log('\n🔍 環境変数チェック\n', 'magenta');

  // 実行環境を判定
  const isAPI = process.cwd().includes('services/api');
  const isWeb = process.cwd().includes('apps/web');

  let allValid = true;

  if (isAPI) {
    log('📦 APIサーバー環境変数チェック', 'magenta');

    // データベース
    allValid &= checkEnvGroup('データベース', {
      DATABASE_URL: { pattern: '^postgresql' },
      POSTGRES_USER: {},
      POSTGRES_PASSWORD: { minLength: 8 },
      POSTGRES_DB: {}
    });

    // Redis
    allValid &= checkEnvGroup('Redis', {
      REDIS_URL: { pattern: '^redis://' },
      RATE_LIMIT_REDIS_URL: { pattern: '^redis://', required: false }
    });

    // Meilisearch
    allValid &= checkEnvGroup('Meilisearch', {
      MEILI_MASTER_KEY: { minLength: 16 },
      MEILI_HOST: { pattern: '^https?://' }
    });

    // 認証
    allValid &= checkEnvGroup('認証', {
      JWT_SECRET_KEY: { minLength: 32 },
      JWT_ALGORITHM: { pattern: '^(HS256|HS384|HS512|RS256)$' },
      ACCESS_TOKEN_EXPIRE_MINUTES: { type: 'number' },
      ADMIN_API_KEY: { minLength: 16 }
    });

    // プッシュ通知
    allValid &= checkEnvGroup('プッシュ通知', {
      VAPID_PUBLIC_KEY: { pattern: '^[A-Za-z0-9_-]+$', minLength: 65 },
      VAPID_PRIVATE_KEY: { pattern: '^[A-Za-z0-9_-]+$', minLength: 43 },
      VAPID_SUBJECT: { pattern: '^mailto:' }
    });

    // Sentry（オプション）
    allValid &= checkEnvGroup('監視（Sentry）', {
      SENTRY_DSN: { pattern: '^https://', required: false },
      SENTRY_ENVIRONMENT: { required: false }
    });

    // S3（オプション）
    allValid &= checkEnvGroup('画像ストレージ（S3）', {
      AWS_ACCESS_KEY_ID: { minLength: 16, required: false },
      AWS_SECRET_ACCESS_KEY: { minLength: 32, required: false },
      S3_BUCKET_NAME: { required: false }
    });

  } else if (isWeb) {
    log('🌐 Webアプリ環境変数チェック', 'magenta');

    // 基本設定
    allValid &= checkEnvGroup('基本設定', {
      NEXT_PUBLIC_API_URL: { pattern: '^https?://' },
      NEXT_PUBLIC_SITE_URL: { pattern: '^https?://' }
    });

    // プッシュ通知
    allValid &= checkEnvGroup('プッシュ通知', {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: { pattern: '^[A-Za-z0-9_-]+$', minLength: 65 }
    });

    // Sentry（オプション）
    allValid &= checkEnvGroup('監視（Sentry）', {
      NEXT_PUBLIC_SENTRY_DSN: { pattern: '^https://', required: false },
      SENTRY_AUTH_TOKEN: { minLength: 32, required: false }
    });

    // 認証
    allValid &= checkEnvGroup('認証', {
      E2E_TEST_AUTH_SECRET: { required: false },
      ADMIN_BASIC_USER: { required: false },
      ADMIN_BASIC_PASS: { required: false }
    });

  } else {
    log('⚠️  プロジェクトルートで実行してください', 'yellow');
    log('使用方法:', 'yellow');
    log('  cd services/api && node ../../scripts/check-env.js', 'yellow');
    log('  cd apps/web && node ../../scripts/check-env.js', 'yellow');
    return;
  }

  // 結果サマリー
  log('\n' + '='.repeat(50), 'blue');

  if (allValid) {
    log('✅ すべての必須環境変数が正しく設定されています！', 'green');

    // 追加の推奨事項
    log('\n📝 推奨事項:', 'blue');
    log('1. 本番環境では、より強力なパスワードとキーを使用してください');
    log('2. 定期的にキーをローテーションしてください');
    log('3. 環境変数管理サービス（Vercel, Railway等）の使用を検討してください');
  } else {
    log('❌ 一部の環境変数が正しく設定されていません', 'red');
    log('\n対応方法:', 'yellow');
    log('1. 上記のエラーメッセージを確認してください');
    log('2. .env.exampleファイルを参考に.envファイルを作成してください');
    log('3. VAPID鍵の生成: node scripts/generate-vapid-keys.js');
    log('4. ドキュメントを確認: docs/features/environment-setup-guide.md');

    process.exit(1);
  }
}

// .envファイルの読み込み
function loadEnvFile() {
  const envFiles = ['.env.local', '.env.development', '.env', '.env.production'];

  for (const file of envFiles) {
    const envPath = path.join(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      log(`📄 ${file} を読み込み中...`, 'yellow');
      require('dotenv').config({ path: envPath });
    }
  }
}

// エントリーポイント
loadEnvFile();
main();