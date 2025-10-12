-- Clean orphaned migration from _prisma_migrations table
-- This removes the 20251012100000_fix_updatedAt_drift migration that no longer exists locally

DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251012100000_fix_updatedAt_drift';

-- Verify remaining migrations
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY finished_at DESC
LIMIT 10;
