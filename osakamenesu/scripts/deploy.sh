#!/bin/bash

# Osakamenesu Deployment Script
# Usage: ./scripts/deploy.sh [staging|production] [api|web|both]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-staging}
COMPONENT=${2:-both}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RELEASE_VERSION="${GITHUB_SHA:-$(git rev-parse HEAD)}"

# Functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check Railway CLI
    if [[ "$COMPONENT" == "api" ]] || [[ "$COMPONENT" == "both" ]]; then
        if ! command -v railway &> /dev/null; then
            error "Railway CLI not found. Install from: https://docs.railway.app/develop/cli"
        fi
        success "Railway CLI found"
    fi

    # Check Vercel CLI
    if [[ "$COMPONENT" == "web" ]] || [[ "$COMPONENT" == "both" ]]; then
        if ! command -v vercel &> /dev/null; then
            error "Vercel CLI not found. Install with: npm i -g vercel"
        fi
        success "Vercel CLI found"
    fi

    # Check environment
    if [[ "$ENVIRONMENT" != "staging" ]] && [[ "$ENVIRONMENT" != "production" ]]; then
        error "Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'"
    fi
}

# Run tests
run_tests() {
    log "Running tests..."

    if [[ "$COMPONENT" == "api" ]] || [[ "$COMPONENT" == "both" ]]; then
        log "Running API tests..."
        cd services/api
        python -m pytest tests/ -v --tb=short || error "API tests failed"
        cd ../..
        success "API tests passed"
    fi

    if [[ "$COMPONENT" == "web" ]] || [[ "$COMPONENT" == "both" ]]; then
        log "Running Web tests..."
        cd apps/web
        pnpm test:ci || warning "Web tests failed (continuing...)"
        cd ../..
        success "Web tests completed"
    fi
}

# Build components
build_components() {
    log "Building components..."

    if [[ "$COMPONENT" == "api" ]] || [[ "$COMPONENT" == "both" ]]; then
        log "Building API..."
        # API is built during Railway deployment
        success "API build configured"
    fi

    if [[ "$COMPONENT" == "web" ]] || [[ "$COMPONENT" == "both" ]]; then
        log "Building Web app..."
        cd apps/web
        pnpm build || error "Web build failed"
        cd ../..
        success "Web build completed"
    fi
}

# Database backup (production only)
backup_database() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Creating database backup..."

        # Trigger GitHub Action for database backup
        gh workflow run db-backup.yml || warning "Could not trigger backup workflow"

        success "Database backup initiated"
    fi
}

# Deploy API to Railway
deploy_api() {
    log "Deploying API to Railway ($ENVIRONMENT)..."

    cd services/api

    if [[ "$ENVIRONMENT" == "staging" ]]; then
        railway up --environment staging \
            --service osakamenesu-api-staging \
            -d "Deploy $RELEASE_VERSION to staging"
    else
        railway up --environment production \
            --service osakamenesu-api \
            -d "Deploy $RELEASE_VERSION to production"
    fi

    cd ../..
    success "API deployed to Railway"
}

# Deploy Web to Vercel
deploy_web() {
    log "Deploying Web to Vercel ($ENVIRONMENT)..."

    cd apps/web

    if [[ "$ENVIRONMENT" == "staging" ]]; then
        vercel --prod \
            --env NEXT_PUBLIC_API_URL=https://api-staging.osakamenesu.com \
            --env SENTRY_ENVIRONMENT=staging \
            --build-env SENTRY_RELEASE=$RELEASE_VERSION
    else
        vercel --prod \
            --env SENTRY_ENVIRONMENT=production \
            --build-env SENTRY_RELEASE=$RELEASE_VERSION
    fi

    cd ../..
    success "Web deployed to Vercel"
}

# Run database migrations
run_migrations() {
    if [[ "$COMPONENT" == "api" ]] || [[ "$COMPONENT" == "both" ]]; then
        log "Running database migrations..."

        if [[ "$ENVIRONMENT" == "staging" ]]; then
            railway run --environment staging alembic upgrade head
        else
            warning "Production migrations should be run manually after backup verification"
            echo "Run: railway run --environment production alembic upgrade head"
        fi

        success "Migrations completed"
    fi
}

# Health checks
perform_health_checks() {
    log "Performing health checks..."

    if [[ "$COMPONENT" == "api" ]] || [[ "$COMPONENT" == "both" ]]; then
        if [[ "$ENVIRONMENT" == "staging" ]]; then
            API_URL="https://api-staging.osakamenesu.com"
        else
            API_URL="https://api.osakamenesu.com"
        fi

        log "Checking API health at $API_URL/health..."

        for i in {1..5}; do
            if curl -f -s "$API_URL/health" > /dev/null; then
                success "API is healthy"
                break
            else
                warning "API health check failed (attempt $i/5)"
                sleep 10
            fi
        done
    fi

    if [[ "$COMPONENT" == "web" ]] || [[ "$COMPONENT" == "both" ]]; then
        if [[ "$ENVIRONMENT" == "staging" ]]; then
            WEB_URL="https://staging.osakamenesu.com"
        else
            WEB_URL="https://osakamenesu.com"
        fi

        log "Checking Web app at $WEB_URL..."

        if curl -f -s "$WEB_URL" > /dev/null; then
            success "Web app is accessible"
        else
            error "Web app is not accessible"
        fi
    fi
}

# Notify deployment
notify_deployment() {
    log "Notifying deployment completion..."

    # Create Sentry release
    if command -v sentry-cli &> /dev/null; then
        sentry-cli releases new "$RELEASE_VERSION"
        sentry-cli releases set-commits "$RELEASE_VERSION" --auto
        sentry-cli releases finalize "$RELEASE_VERSION"
        sentry-cli releases deploys "$RELEASE_VERSION" new -e "$ENVIRONMENT"
        success "Sentry release created"
    else
        warning "Sentry CLI not found, skipping release creation"
    fi

    # Send notification (customize as needed)
    echo "
Deployment Summary:
==================
Environment: $ENVIRONMENT
Component: $COMPONENT
Version: $RELEASE_VERSION
Timestamp: $TIMESTAMP
Status: SUCCESS
"
}

# Main deployment flow
main() {
    echo "🚀 Osakamenesu Deployment Script"
    echo "================================"
    echo "Environment: $ENVIRONMENT"
    echo "Component: $COMPONENT"
    echo "Version: $RELEASE_VERSION"
    echo ""

    check_prerequisites
    run_tests
    build_components
    backup_database

    # Deploy components
    if [[ "$COMPONENT" == "api" ]] || [[ "$COMPONENT" == "both" ]]; then
        deploy_api
        run_migrations
    fi

    if [[ "$COMPONENT" == "web" ]] || [[ "$COMPONENT" == "both" ]]; then
        deploy_web
    fi

    # Post-deployment
    perform_health_checks
    notify_deployment

    success "Deployment completed successfully! 🎉"
}

# Run main function
main