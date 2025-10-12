#!/bin/bash

# Fix Migration Drift - Triệt Để
# This script cleans orphaned migrations and applies baseline

set -e  # Exit on error

echo "🔧 Fixing Migration Drift Triệt Để..."
echo ""

cd "$(dirname "$0")"

# Step 1: Check database connection
echo "Step 1: Checking database connection..."
if ! npx prisma db execute --file clean-orphaned-migration.sql --schema libs/database/prisma/schema.prisma; then
    echo "❌ Failed to clean orphaned migration"
    echo ""
    echo "Please run this SQL manually in your database:"
    echo ""
    cat clean-orphaned-migration.sql
    echo ""
    exit 1
fi

echo "✅ Cleaned orphaned migration from database"
echo ""

# Step 2: Apply new migrations
echo "Step 2: Applying migrations..."
npx prisma migrate dev --schema libs/database/prisma/schema.prisma

echo ""
echo "✅ Migrations applied successfully"
echo ""

# Step 3: Verify
echo "Step 3: Verifying migration status..."
npx prisma migrate status --schema libs/database/prisma/schema.prisma

echo ""
echo "🎉 Done! Migration drift fixed triệt để!"
