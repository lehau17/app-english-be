#!/bin/bash

# Simple Fix - Mark migrations as resolved without running

set -e

echo "🔧 Simple Fix - Marking migrations as resolved..."
echo ""

cd "$(dirname "$0")"

# Step 1: Clean orphaned migration from DB
echo "Step 1: Cleaning orphaned migration from database..."
npx prisma db execute --file clean-orphaned-migration.sql --schema libs/database/prisma/schema.prisma

echo "✅ Orphaned migration cleaned"
echo ""

# Step 2: Mark baseline migration as applied (without running it)
echo "Step 2: Marking baseline migration as applied..."
npx prisma migrate resolve --applied 20251012110000_baseline_updatedAt --schema libs/database/prisma/schema.prisma

echo "✅ Baseline migration marked as applied"
echo ""

# Step 3: Verify
echo "Step 3: Verifying status..."
npx prisma migrate status --schema libs/database/prisma/schema.prisma

echo ""
echo "🎉 Done!"
