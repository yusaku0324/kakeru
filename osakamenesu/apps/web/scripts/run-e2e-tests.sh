#!/bin/bash

# E2E Test Runner Script
# Runs different E2E test suites with proper environment setup

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
  echo -e "${GREEN}[E2E]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Parse command line arguments
TEST_SUITE="${1:-all}"
HEADED="${2:-false}"

# Check required environment variables
check_env() {
  local required_vars=(
    "ADMIN_BASIC_USER"
    "ADMIN_BASIC_PASS"
    "ADMIN_API_KEY"
  )

  for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
      print_warning "Environment variable $var is not set. Some tests may be skipped."
    fi
  done
}

# Setup test data
setup_test_data() {
  print_status "Setting up test data..."

  # Run seed script if available
  if [ -f "../../services/api/scripts/seed_admin_test_data.py" ]; then
    cd ../../services/api
    python3 scripts/seed_admin_test_data.py || print_warning "Seed script failed. Continuing anyway..."
    cd - > /dev/null
  else
    print_warning "Seed script not found. Skipping data setup."
  fi
}

# Install dependencies
install_deps() {
  print_status "Installing Playwright browsers..."
  npx playwright install
}

# Run specific test suite
run_tests() {
  local suite=$1
  local headed_flag=""

  if [ "$HEADED" = "true" ]; then
    headed_flag="--headed"
  fi

  case $suite in
    "all")
      print_status "Running all E2E tests..."
      npx playwright test $headed_flag
      ;;
    "desktop")
      print_status "Running desktop E2E tests..."
      npx playwright test --project=chromium --project=firefox --project=webkit $headed_flag
      ;;
    "mobile")
      print_status "Running mobile E2E tests..."
      npx playwright test --config=playwright.mobile.config.ts $headed_flag
      ;;
    "push")
      print_status "Running push notification tests..."
      npx playwright test push-notifications.spec.ts $headed_flag
      ;;
    "reservation")
      print_status "Running reservation flow tests..."
      npx playwright test reservation-*.spec.ts $headed_flag
      ;;
    "dashboard")
      print_status "Running dashboard tests..."
      npx playwright test dashboard-*.spec.ts admin-*.spec.ts $headed_flag
      ;;
    "pwa")
      print_status "Running PWA tests..."
      npx playwright test push-notifications.spec.ts mobile-experience.spec.ts $headed_flag
      ;;
    "smoke")
      print_status "Running smoke tests..."
      npx playwright test --grep "@smoke" $headed_flag
      ;;
    *)
      print_error "Unknown test suite: $suite"
      echo "Available suites: all, desktop, mobile, push, reservation, dashboard, pwa, smoke"
      exit 1
      ;;
  esac
}

# Generate test report
generate_report() {
  if [ -f "playwright-report/index.html" ]; then
    print_status "Test report generated at: playwright-report/index.html"

    # Open report in browser if not in CI
    if [ -z "$CI" ] && command -v open > /dev/null; then
      open playwright-report/index.html
    fi
  fi
}

# Main execution
main() {
  print_status "Starting E2E test runner..."
  print_status "Test suite: $TEST_SUITE"
  print_status "Headed mode: $HEADED"

  # Check environment
  check_env

  # Setup if not in CI
  if [ -z "$CI" ]; then
    setup_test_data
  fi

  # Install Playwright browsers if needed
  if ! npx playwright --version > /dev/null 2>&1; then
    install_deps
  fi

  # Run tests
  if run_tests "$TEST_SUITE"; then
    print_status "✅ All tests passed!"
    generate_report
    exit 0
  else
    print_error "❌ Some tests failed!"
    generate_report
    exit 1
  fi
}

# Show usage
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "Usage: $0 [test-suite] [headed]"
  echo ""
  echo "Test suites:"
  echo "  all         - Run all E2E tests (default)"
  echo "  desktop     - Run desktop browser tests"
  echo "  mobile      - Run mobile device tests"
  echo "  push        - Run push notification tests"
  echo "  reservation - Run reservation flow tests"
  echo "  dashboard   - Run admin dashboard tests"
  echo "  pwa         - Run PWA-specific tests"
  echo "  smoke       - Run smoke tests only"
  echo ""
  echo "Options:"
  echo "  headed      - Run tests in headed mode (true/false, default: false)"
  echo ""
  echo "Examples:"
  echo "  $0                    # Run all tests in headless mode"
  echo "  $0 mobile true        # Run mobile tests in headed mode"
  echo "  $0 smoke              # Run smoke tests"
  exit 0
fi

# Run main function
main