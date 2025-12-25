#!/usr/bin/env bash

# Database restore script for Osakamenesu
# Usage: ./restore-database.sh <backup-file> [--from-s3]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-file> [--from-s3]"
    echo "Examples:"
    echo "  $0 backup_20240315_040000.sql.gz"
    echo "  $0 backup_20240315_040000.sql.gz --from-s3"
    exit 1
fi

BACKUP_FILE=$1
FROM_S3=${2:-""}

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL or use .env file"
    exit 1
fi

# Download from S3 if requested
if [ "$FROM_S3" == "--from-s3" ]; then
    if [ -z "${BACKUP_S3_BUCKET:-}" ] || [ -z "${BACKUP_S3_ENDPOINT:-}" ]; then
        echo -e "${RED}Error: S3 configuration not found${NC}"
        echo "Please set BACKUP_S3_BUCKET and BACKUP_S3_ENDPOINT environment variables"
        exit 1
    fi

    echo -e "${YELLOW}Downloading backup from S3/R2...${NC}"
    mkdir -p ./backups
    aws s3 cp "s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_FILE}" \
        "./backups/${BACKUP_FILE}" \
        --endpoint-url "${BACKUP_S3_ENDPOINT}"

    BACKUP_PATH="./backups/${BACKUP_FILE}"
else
    # Check if file exists locally
    if [ -f "./backups/${BACKUP_FILE}" ]; then
        BACKUP_PATH="./backups/${BACKUP_FILE}"
    elif [ -f "${BACKUP_FILE}" ]; then
        BACKUP_PATH="${BACKUP_FILE}"
    else
        echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}⚠️  WARNING: This will restore the database from backup!${NC}"
echo "Backup file: ${BACKUP_PATH}"
echo "Target database: ${DATABASE_URL%%@*}@..." # Hide password
echo ""
read -p "Are you sure you want to continue? (yes/NO): " -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create temporary uncompressed file
TEMP_SQL=$(mktemp)
trap "rm -f $TEMP_SQL" EXIT

echo -e "${YELLOW}Decompressing backup...${NC}"
gunzip -c "$BACKUP_PATH" > "$TEMP_SQL"

echo -e "${YELLOW}Restoring database...${NC}"
echo "This may take a while depending on the database size..."

# Restore the database
psql "${DATABASE_URL}" < "$TEMP_SQL"

echo -e "${GREEN}✅ Database restored successfully!${NC}"

# Run migrations to ensure schema is up to date
echo -e "${YELLOW}Running database migrations...${NC}"
cd "$(dirname "$0")/.."
alembic upgrade head

echo -e "${GREEN}✅ Restore process completed!${NC}"
