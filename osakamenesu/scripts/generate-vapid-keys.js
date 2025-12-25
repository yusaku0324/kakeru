#!/usr/bin/env node

/**
 * VAPID鍵生成スクリプト
 * Webプッシュ通知用のVAPID鍵ペアを生成します
 */

const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

// VAPID鍵を生成
const vapidKeys = webpush.generateVAPIDKeys();

console.log('🔐 VAPID鍵を生成しました\n');

console.log('==== 環境変数に追加してください ====\n');

console.log('# APIサーバー側 (services/api/.env)');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:support@osakamenesu.com\n');

console.log('# Webアプリ側 (apps/web/.env.local)');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}\n`);

console.log('==================================\n');

// .env.exampleファイルを更新する関数
function updateEnvExample(filePath, updates) {
  try {
    let content = '';

    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf8');
    }

    // 既存の値を更新または新規追加
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      const newLine = `${key}=${value}`;

      if (regex.test(content)) {
        content = content.replace(regex, newLine);
      } else {
        content += `\n${newLine}`;
      }
    }

    fs.writeFileSync(filePath, content.trim() + '\n');
    console.log(`✅ ${filePath} を更新しました`);
  } catch (error) {
    console.log(`⚠️  ${filePath} の更新をスキップしました:`, error.message);
  }
}

// オプション: .env.exampleファイルを自動更新
const updateExamples = process.argv.includes('--update-examples');

if (updateExamples) {
  console.log('\n📝 .env.exampleファイルを更新中...\n');

  // APIサーバーの.env.example
  updateEnvExample(
    path.join(__dirname, '../services/api/.env.example'),
    {
      VAPID_PUBLIC_KEY: 'your-vapid-public-key-here',
      VAPID_PRIVATE_KEY: 'your-vapid-private-key-here',
      VAPID_SUBJECT: 'mailto:support@osakamenesu.com'
    }
  );

  // Webアプリの.env.example
  updateEnvExample(
    path.join(__dirname, '../apps/web/.env.example'),
    {
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'your-vapid-public-key-here'
    }
  );
}

// セキュリティ注意事項
console.log('\n⚠️  セキュリティ注意事項:');
console.log('- 秘密鍵は絶対にGitにコミットしないでください');
console.log('- 本番環境では環境変数管理サービスを使用してください');
console.log('- 定期的にキーをローテーションしてください\n');

// オプション: 環境変数ファイルに直接書き込み
const writeToEnv = process.argv.includes('--write');

if (writeToEnv) {
  console.log('💾 環境変数ファイルに書き込み中...\n');

  // APIサーバーの.env
  const apiEnvPath = path.join(__dirname, '../services/api/.env');
  const apiEnvContent = `
# Web Push Notifications (VAPID)
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:support@osakamenesu.com
`;

  try {
    if (fs.existsSync(apiEnvPath)) {
      const existing = fs.readFileSync(apiEnvPath, 'utf8');
      if (!existing.includes('VAPID_PUBLIC_KEY')) {
        fs.appendFileSync(apiEnvPath, apiEnvContent);
        console.log('✅ services/api/.env に追加しました');
      } else {
        console.log('⚠️  services/api/.env に既にVAPID設定が存在します');
      }
    } else {
      fs.writeFileSync(apiEnvPath, apiEnvContent.trim() + '\n');
      console.log('✅ services/api/.env を作成しました');
    }
  } catch (error) {
    console.error('❌ APIの.envファイルの更新に失敗:', error.message);
  }

  // Webアプリの.env.local
  const webEnvPath = path.join(__dirname, '../apps/web/.env.local');
  const webEnvContent = `
# Web Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
`;

  try {
    if (fs.existsSync(webEnvPath)) {
      const existing = fs.readFileSync(webEnvPath, 'utf8');
      if (!existing.includes('NEXT_PUBLIC_VAPID_PUBLIC_KEY')) {
        fs.appendFileSync(webEnvPath, webEnvContent);
        console.log('✅ apps/web/.env.local に追加しました');
      } else {
        console.log('⚠️  apps/web/.env.local に既にVAPID設定が存在します');
      }
    } else {
      fs.writeFileSync(webEnvPath, webEnvContent.trim() + '\n');
      console.log('✅ apps/web/.env.local を作成しました');
    }
  } catch (error) {
    console.error('❌ Webの.env.localファイルの更新に失敗:', error.message);
  }
}

console.log('\n🎉 完了！');
console.log('使用方法:');
console.log('  node generate-vapid-keys.js                 # キーを表示のみ');
console.log('  node generate-vapid-keys.js --write         # .envファイルに書き込み');
console.log('  node generate-vapid-keys.js --update-examples # .env.exampleを更新');