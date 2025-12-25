#!/bin/bash

# Staging deployment script for Fly.io + Vercel
set -e

echo "🚀 Staging Deployment (Fly.io + Vercel)"
echo "======================================="

# Check if we're in the right directory
if [ ! -f "pnpm-lock.yaml" ]; then
    echo "Error: Must run from project root"
    exit 1
fi

# Deploy API to Fly.io staging
echo "📦 Deploying API to Fly.io staging..."
cd services/api

# Deploy to Fly.io staging with Doppler
doppler run --project osakamenesu --config stg -- \
    flyctl deploy -a osakamenesu-api-stg --remote-only -c fly.stg.toml || {
    echo "API deployment to Fly.io failed"
    exit 1
}

cd ../..

# Deploy Web to Vercel
echo "🌐 Deploying Web to Vercel staging..."
cd apps/web

# Use Vercel CLI with staging environment
doppler run --project osakamenesu --config stg_web -- \
    vercel --prod || {
    echo "Web deployment to Vercel failed"
    exit 1
}

cd ../..

echo "✅ Staging deployment completed!"
echo ""
echo "Check your deployments at:"
echo "  API: https://osakamenesu-api-stg.fly.dev/health"
echo "  Web: Check Vercel dashboard for URL"
echo ""
echo "Note: Staging API auto-scales to 0 when idle (cold start expected)"
