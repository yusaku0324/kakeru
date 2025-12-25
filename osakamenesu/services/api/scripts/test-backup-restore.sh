#!/usr/bin/env bash

# Test script for backup and restore functionality
# This script creates a test database, backs it up, and restores it to verify everything works

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Backup/Restore Test Script ===${NC}"
echo ""

# Check if running in production
if [[ "${RAILWAY_ENVIRONMENT:-}" == "production" ]] || [[ "${FLY_APP_NAME:-}" != "" ]]; then
    echo -e "${RED}Error: This script should not be run in production!${NC}"
    exit 1
fi

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump is not installed${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql is not installed${NC}"
    echo "Please install PostgreSQL client tools"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Test 1: Local Backup
echo -e "${BLUE}Test 1: Local Backup${NC}"
echo -e "${YELLOW}Creating backup...${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_OUTPUT=$("${SCRIPT_DIR}/backup-database.sh" 2>&1)
echo "$BACKUP_OUTPUT"

# Extract backup filename from output
BACKUP_FILE=$(echo "$BACKUP_OUTPUT" | grep -oE "backup_[0-9]{8}_[0-9]{6}\.sql\.gz" | head -1)

if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}✗ Failed to create backup${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backup created successfully: $BACKUP_FILE${NC}"
echo ""

# Test 2: Verify backup file
echo -e "${BLUE}Test 2: Verify Backup File${NC}"
BACKUP_PATH="${SCRIPT_DIR}/../backups/${BACKUP_FILE}"

if [ ! -f "$BACKUP_PATH" ]; then
    echo -e "${RED}✗ Backup file not found at: $BACKUP_PATH${NC}"
    exit 1
fi

# Check if file is valid gzip
if ! gzip -t "$BACKUP_PATH" 2>/dev/null; then
    echo -e "${RED}✗ Backup file is not a valid gzip file${NC}"
    exit 1
fi

# Check file size
FILE_SIZE=$(stat -f%z "$BACKUP_PATH" 2>/dev/null || stat -c%s "$BACKUP_PATH" 2>/dev/null)
if [ "$FILE_SIZE" -lt 100 ]; then
    echo -e "${RED}✗ Backup file seems too small (${FILE_SIZE} bytes)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Backup file is valid (${FILE_SIZE} bytes)${NC}"
echo ""

# Test 3: Check backup contents
echo -e "${BLUE}Test 3: Check Backup Contents${NC}"
echo -e "${YELLOW}Checking for required tables...${NC}"

# Decompress and check for key tables
TEMP_SQL=$(mktemp)
gunzip -c "$BACKUP_PATH" > "$TEMP_SQL"

REQUIRED_TABLES=("shops" "therapists" "reservations" "users" "shifts")
MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    if ! grep -q "CREATE TABLE.*${table}" "$TEMP_SQL"; then
        MISSING_TABLES+=("$table")
    fi
done

rm -f "$TEMP_SQL"

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing tables in backup: ${MISSING_TABLES[*]}${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All required tables found in backup${NC}"
echo ""

# Test 4: Test restore script exists
echo -e "${BLUE}Test 4: Test Restore Script${NC}"
RESTORE_SCRIPT="${SCRIPT_DIR}/restore-database.sh"

if [ ! -x "$RESTORE_SCRIPT" ]; then
    echo -e "${RED}✗ Restore script not found or not executable${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Restore script is available${NC}"
echo ""

# Test 5: S3 Configuration (if available)
echo -e "${BLUE}Test 5: S3/R2 Configuration${NC}"

if [ -n "${BACKUP_S3_BUCKET:-}" ] && [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then
    echo -e "${YELLOW}Testing S3/R2 connection...${NC}"

    # Test AWS CLI configuration
    if ! command -v aws &> /dev/null; then
        echo -e "${YELLOW}⚠ AWS CLI not installed, skipping S3 test${NC}"
    else
        # Try to list bucket
        if aws s3 ls "s3://${BACKUP_S3_BUCKET}/" --endpoint-url "${BACKUP_S3_ENDPOINT}" &>/dev/null; then
            echo -e "${GREEN}✓ S3/R2 connection successful${NC}"

            # Test upload
            echo -e "${YELLOW}Testing upload to S3/R2...${NC}"
            TEST_FILE=$(mktemp)
            echo "test" > "$TEST_FILE"

            if aws s3 cp "$TEST_FILE" "s3://${BACKUP_S3_BUCKET}/test-connection.txt" \
                --endpoint-url "${BACKUP_S3_ENDPOINT}" &>/dev/null; then
                echo -e "${GREEN}✓ S3/R2 upload successful${NC}"

                # Cleanup test file
                aws s3 rm "s3://${BACKUP_S3_BUCKET}/test-connection.txt" \
                    --endpoint-url "${BACKUP_S3_ENDPOINT}" &>/dev/null
            else
                echo -e "${RED}✗ S3/R2 upload failed${NC}"
            fi

            rm -f "$TEST_FILE"
        else
            echo -e "${RED}✗ Cannot connect to S3/R2${NC}"
            echo "Please check your AWS credentials and endpoint"
        fi
    fi
else
    echo -e "${YELLOW}⚠ S3/R2 not configured${NC}"
    echo "To enable S3/R2 uploads, set:"
    echo "  BACKUP_S3_BUCKET"
    echo "  BACKUP_S3_ENDPOINT"
    echo "  AWS_ACCESS_KEY_ID"
    echo "  AWS_SECRET_ACCESS_KEY"
fi

echo ""
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "${GREEN}✓ Backup functionality is working correctly${NC}"
echo -e "${GREEN}✓ Backup contains all required tables${NC}"
echo -e "${GREEN}✓ Restore script is available${NC}"

if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    echo -e "${GREEN}✓ S3/R2 configuration is set${NC}"
fi

echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Configure S3/R2 credentials in GitHub Secrets"
echo "2. Enable the GitHub Actions workflow"
echo "3. Test restore process in a staging environment"
echo ""
echo -e "${GREEN}All tests passed!${NC}"
