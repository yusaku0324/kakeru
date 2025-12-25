#!/usr/bin/env node

/**
 * Sentry verification script
 * Tests that Sentry is properly configured and can send events
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkEnvFile(filePath, requiredVars) {
  log(`\nChecking ${filePath}...`, 'blue');

  if (!fs.existsSync(filePath)) {
    log(`❌ File not found: ${filePath}`, 'red');
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let allFound = true;

  for (const varName of requiredVars) {
    const regex = new RegExp(`^${varName}=.+`, 'm');
    if (regex.test(content)) {
      log(`✅ ${varName} is set`, 'green');
    } else {
      log(`❌ ${varName} is missing`, 'red');
      allFound = false;
    }
  }

  return allFound;
}

async function testAPIError() {
  log('\nTesting API error reporting...', 'blue');

  return new Promise((resolve) => {
    const apiPath = path.join(__dirname, '../services/api');
    const testScript = `
import sentry_sdk
import os

# Test if Sentry is initialized
if sentry_sdk.Hub.current.client:
    print("✅ Sentry SDK is initialized")

    # Send test error
    try:
        1 / 0
    except Exception as e:
        sentry_sdk.capture_exception(e)
        print("✅ Test error sent to Sentry")
else:
    print("❌ Sentry SDK is not initialized")
`;

    fs.writeFileSync(path.join(apiPath, 'test_sentry.py'), testScript);

    const python = spawn('python', ['test_sentry.py'], { cwd: apiPath });

    python.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    python.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    python.on('close', (code) => {
      fs.unlinkSync(path.join(apiPath, 'test_sentry.py'));
      resolve(code === 0);
    });
  });
}

async function testWebError() {
  log('\nTesting Web error reporting...', 'blue');

  const webPath = path.join(__dirname, '../apps/web');
  const testFile = path.join(webPath, 'test-sentry.js');

  const testScript = `
const Sentry = require('@sentry/nextjs');

// Check if Sentry is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  console.log('✅ Sentry DSN is configured');

  // Initialize for testing
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'test',
  });

  // Send test error
  Sentry.captureException(new Error('Test error from verification script'));
  console.log('✅ Test error sent to Sentry');

  // Flush events
  Sentry.flush(2000).then(() => {
    console.log('✅ Events flushed successfully');
  });
} else {
  console.log('❌ Sentry DSN is not configured');
}
`;

  fs.writeFileSync(testFile, testScript);

  return new Promise((resolve) => {
    const node = spawn('node', ['test-sentry.js'], {
      cwd: webPath,
      env: { ...process.env, NODE_ENV: 'production' }
    });

    node.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    node.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    node.on('close', (code) => {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
      resolve(code === 0);
    });
  });
}

async function main() {
  log('🔍 Sentry Configuration Verification\n', 'yellow');

  // Check environment files
  const apiEnvOk = await checkEnvFile(
    path.join(__dirname, '../services/api/.env.production'),
    ['SENTRY_DSN', 'SENTRY_ENVIRONMENT']
  );

  const webEnvOk = await checkEnvFile(
    path.join(__dirname, '../apps/web/.env.production'),
    ['NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN']
  );

  // Test error reporting
  if (apiEnvOk) {
    await testAPIError();
  }

  if (webEnvOk) {
    await testWebError();
  }

  // Summary
  log('\n📊 Verification Summary:', 'yellow');
  if (apiEnvOk && webEnvOk) {
    log('✅ All environment variables are configured', 'green');
    log('\nNext steps:', 'blue');
    log('1. Check your Sentry dashboard for the test errors');
    log('2. Configure alert rules and integrations');
    log('3. Deploy to staging and verify events are received');
  } else {
    log('❌ Some configuration is missing', 'red');
    log('\nPlease follow the setup guide in docs/deployment/sentry-setup.md', 'yellow');
  }
}

main().catch(console.error);