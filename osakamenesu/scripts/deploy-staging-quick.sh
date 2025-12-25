#!/bin/bash

# Quick deployment script for staging (skips tests)
set -e

echo "🚀 Quick Staging Deployment (Tests Skipped)"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "pnpm-lock.yaml" ]; then
    echo "Error: Must run from project root"
    exit 1
fi

# Deploy API to Railway
echo "📦 Deploying API to Railway staging..."
cd services/api
doppler run --project osakamenesu --config stg -- railway up --environment staging --service osakamenesu-api-staging || {
    echo "API deployment failed"
    exit 1
}
cd ../..

# Deploy Web to Vercel
echo "🌐 Deploying Web to Vercel staging..."
cd apps/web
doppler run --project osakamenesu --config stg_web -- vercel --prod --env-file=.env.staging || {
    echo "Web deployment failed"
    exit 1
}
cd ../..

echo "✅ Staging deployment completed!"
echo ""
echo "Check your deployments at:"
echo "  API: https://api-staging.osakamenesu.com/health"
echo "  Web: https://staging.osakamenesu.com"