#!/usr/bin/env bash

# Database backup script for Osakamenesu
# Usage: ./backup-database.sh [--upload]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"

# Check if DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
    echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
    echo "Please set DATABASE_URL or use .env file"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Starting database backup...${NC}"

# Create backup
echo "Creating backup file: ${BACKUP_FILE}"
pg_dump "${DATABASE_URL}" \
    --no-owner \
    --no-acl \
    --verbose \
    | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

# Get backup size
BACKUP_SIZE=$(ls -lh "${BACKUP_DIR}/${BACKUP_FILE}" | awk '{print $5}')
echo -e "${GREEN}✅ Backup created successfully!${NC}"
echo "File: ${BACKUP_DIR}/${BACKUP_FILE}"
echo "Size: ${BACKUP_SIZE}"

# Upload to S3/R2 if flag is provided
if [ "${1:-}" == "--upload" ]; then
    if [ -z "${BACKUP_S3_BUCKET:-}" ] || [ -z "${BACKUP_S3_ENDPOINT:-}" ]; then
        echo -e "${RED}Error: S3 configuration not found${NC}"
        echo "Please set BACKUP_S3_BUCKET and BACKUP_S3_ENDPOINT environment variables"
        exit 1
    fi

    echo -e "${YELLOW}Uploading to S3/R2...${NC}"
    aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" \
        "s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_FILE}" \
        --endpoint-url "${BACKUP_S3_ENDPOINT}"

    echo -e "${GREEN}✅ Upload completed!${NC}"
    echo "S3 Location: s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_FILE}"
fi

# Cleanup old local backups (keep last 7 days)
echo -e "${YELLOW}Cleaning up old local backups...${NC}"
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete

echo -e "${GREEN}Backup process completed!${NC}"
