#!/bin/bash

# Setup Staging Environment Script
# This script helps set up the staging environment and branch

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to print colored output
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_info "Setting up staging environment..."

# Check if we're in the git repository
if [ ! -d "$ROOT_DIR/.git" ]; then
    print_error "This script must be run from the project root"
    exit 1
fi

cd "$ROOT_DIR"

# Create staging branch if it doesn't exist
if ! git show-ref --verify --quiet refs/heads/staging; then
    print_info "Creating staging branch..."
    git checkout -b staging
    print_success "Created staging branch"
else
    print_info "Staging branch already exists"
    # Check if we're on staging branch
    current_branch=$(git branch --show-current)
    if [ "$current_branch" != "staging" ]; then
        print_info "Switching to staging branch..."
        git checkout staging
    fi
fi

# Ensure staging branch is up to date with main
print_info "Updating staging branch with latest from main..."
git fetch origin
git merge origin/main --no-edit || {
    print_warning "Merge conflict detected. Please resolve conflicts and run this script again."
    exit 1
}

# Setup environment files
print_info "Setting up environment files..."
"$SCRIPT_DIR/manage-env.sh" setup staging

# Verify Fly.io CLI is installed
if ! command -v flyctl &> /dev/null; then
    print_warning "Fly.io CLI not installed. Please install it first:"
    print_info "curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if staging app exists on Fly.io
print_info "Checking Fly.io staging app..."
if flyctl apps list | grep -q "osakamenesu-api-stg"; then
    print_info "Fly.io staging app already exists"
else
    print_warning "Fly.io staging app doesn't exist. Creating it..."
    print_info "Run: flyctl apps create osakamenesu-api-stg"
fi

# Verify Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    print_warning "Vercel CLI not installed. Please install it first:"
    print_info "npm i -g vercel"
fi

# Create deployment checklist
cat > "$ROOT_DIR/STAGING_DEPLOYMENT_CHECKLIST.md" << EOF
# Staging Deployment Checklist

## Prerequisites
- [ ] Fly.io CLI installed and authenticated
- [ ] Vercel CLI installed and authenticated
- [ ] Environment variables configured (run: ./scripts/manage-env.sh check staging)
- [ ] Staging branch created and up to date with main

## Fly.io Setup
- [ ] Create staging app: \`flyctl apps create osakamenesu-api-stg\`
- [ ] Set secrets: \`./scripts/manage-env.sh export staging\`
- [ ] Deploy: \`flyctl deploy --app osakamenesu-api-stg --config services/api/fly.stg.toml\`

## Vercel Setup
- [ ] Link project: \`cd services/web && vercel link\`
- [ ] Set environment variables in Vercel dashboard
- [ ] Configure staging domain (optional)

## GitHub Secrets Required
- [ ] \`FLY_API_TOKEN\` - Fly.io API token
- [ ] \`VERCEL_TOKEN\` - Vercel token
- [ ] \`VERCEL_ORG_ID\` - Vercel organization ID
- [ ] \`VERCEL_PROJECT_ID\` - Vercel project ID
- [ ] \`VERCEL_SCOPE\` - Vercel team scope (if using teams)

## First Deployment
1. Push to staging branch: \`git push origin staging\`
2. Monitor GitHub Actions workflow
3. Verify deployment:
   - API: https://osakamenesu-api-stg.fly.dev/health
   - Web: https://staging-osakamenesu.vercel.app

## Regular Workflow
1. Merge main into staging: \`git checkout staging && git merge main\`
2. Push to trigger deployment: \`git push origin staging\`
3. Run E2E tests on staging
4. If tests pass, create PR to main
EOF

print_success "Created staging deployment checklist at STAGING_DEPLOYMENT_CHECKLIST.md"

# Summary
echo ""
print_success "Staging environment setup complete!"
echo ""
print_info "Next steps:"
echo "  1. Review and update environment variables:"
echo "     ./scripts/manage-env.sh check staging"
echo ""
echo "  2. Export secrets for deployment:"
echo "     ./scripts/manage-env.sh export staging"
echo ""
echo "  3. Follow the checklist in STAGING_DEPLOYMENT_CHECKLIST.md"
echo ""
echo "  4. Push to staging branch to trigger deployment:"
echo "     git push origin staging"