/**
 * Cleanup Orphaned Vocabulary Progress Records
 *
 * This script identifies and removes orphaned UserVocabularyProgress records
 * where the referenced VocabularyTerm has been deleted. It creates a backup
 * before deletion to ensure data recovery if needed.
 *
 * Usage:
 *   ts-node cleanup-orphaned-progress.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

interface OrphanedRecord {
  user_id: string;
  term_id: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface OrphanedStats {
  count: bigint;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(80));
  console.log('Cleanup Orphaned Vocabulary Progress Records');
  console.log('='.repeat(80));
  console.log(
    `Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE (will delete)'}`,
  );
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log();

  // Step 1: Count orphaned records
  console.log('Step 1: Counting orphaned records...');
  const orphanedCountResult = await prisma.$queryRaw<OrphanedStats[]>`
    SELECT COUNT(*) as count
    FROM user_vocabulary_progress uvp
    LEFT JOIN vocabulary_terms vt ON uvp."termId" = vt.id
    WHERE vt.id IS NULL
  `;

  const orphanedCount = Number(orphanedCountResult[0]?.count || 0);
  console.log(`Found ${orphanedCount} orphaned records`);

  if (orphanedCount === 0) {
    console.log('✓ No orphaned records found. Database is clean!');
    return;
  }

  // Step 2: Show affected users
  console.log('\nStep 2: Analyzing affected users...');
  const affectedUsers = await prisma.$queryRaw<
    Array<{ user_id: string; orphaned_records: bigint }>
  >`
    SELECT uvp."userId" as user_id, COUNT(*) as orphaned_records
    FROM user_vocabulary_progress uvp
    LEFT JOIN vocabulary_terms vt ON uvp."termId" = vt.id
    WHERE vt.id IS NULL
    GROUP BY uvp."userId"
    ORDER BY orphaned_records DESC
    LIMIT 10
  `;

  console.log(`Affected users (top 10):`);
  affectedUsers.forEach((row, idx) => {
    console.log(
      `  ${idx + 1}. User ${row.user_id}: ${row.orphaned_records} orphaned records`,
    );
  });

  // Step 3: Sample orphaned records
  console.log('\nStep 3: Sample orphaned records (first 5)...');
  const sampleRecords = await prisma.$queryRaw<OrphanedRecord[]>`
    SELECT uvp."userId" as user_id, uvp."termId" as term_id,
           uvp.status, uvp."createdAt" as created_at, uvp."updatedAt" as updated_at
    FROM user_vocabulary_progress uvp
    LEFT JOIN vocabulary_terms vt ON uvp."termId" = vt.id
    WHERE vt.id IS NULL
    LIMIT 5
  `;

  sampleRecords.forEach((record, idx) => {
    console.log(
      `  ${idx + 1}. User: ${record.user_id.substring(0, 8)}..., ` +
        `Term: ${record.term_id.substring(0, 8)}..., Status: ${record.status}, ` +
        `Created: ${record.created_at.toISOString()}`,
    );
  });

  if (isDryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('DRY RUN MODE - No changes made');
    console.log(`Would delete ${orphanedCount} orphaned records`);
    console.log('='.repeat(80));
    return;
  }

  // Step 4: Create backup table
  console.log('\nStep 4: Creating backup table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_vocabulary_progress_orphaned_backup (
      user_id UUID NOT NULL,
      term_id UUID NOT NULL,
      status TEXT,
      ease_factor DOUBLE PRECISION,
      interval INTEGER,
      repetitions INTEGER,
      correct_count INTEGER,
      wrong_count INTEGER,
      last_review_at TIMESTAMP(3),
      next_review_at TIMESTAMP(3),
      created_at TIMESTAMP(3),
      updated_at TIMESTAMP(3),
      backed_up_at TIMESTAMP(3) DEFAULT NOW(),
      PRIMARY KEY (user_id, term_id)
    )
  `);
  console.log('✓ Backup table created/verified');

  // Step 5: Backup orphaned records
  console.log('\nStep 5: Backing up orphaned records...');
  const backupResult = await prisma.$executeRawUnsafe(`
    INSERT INTO user_vocabulary_progress_orphaned_backup
      (user_id, term_id, status, ease_factor, interval, repetitions,
       correct_count, wrong_count, last_review_at, next_review_at,
       created_at, updated_at, backed_up_at)
    SELECT
      uvp."userId", uvp."termId", uvp.status, uvp."easeFactor", uvp.interval,
      uvp.repetitions, uvp."correctCount", uvp."wrongCount", uvp."lastReviewAt",
      uvp."nextReviewAt", uvp."createdAt", uvp."updatedAt", NOW()
    FROM user_vocabulary_progress uvp
    LEFT JOIN vocabulary_terms vt ON uvp."termId" = vt.id
    WHERE vt.id IS NULL
    ON CONFLICT (user_id, term_id) DO UPDATE SET backed_up_at = NOW()
  `);
  console.log(`✓ Backed up ${backupResult} records`);

  // Step 6: Delete orphaned records
  console.log('\nStep 6: Deleting orphaned records...');
  const deleteResult = await prisma.$executeRaw`
    DELETE FROM user_vocabulary_progress uvp
    WHERE NOT EXISTS (
      SELECT 1 FROM vocabulary_terms vt
      WHERE vt.id = uvp."termId"
    )
  `;
  console.log(`✓ Deleted ${deleteResult} orphaned records`);

  // Step 7: Verify cleanup
  console.log('\nStep 7: Verifying cleanup...');
  const remainingOrphaned = await prisma.$queryRaw<OrphanedStats[]>`
    SELECT COUNT(*) as count
    FROM user_vocabulary_progress uvp
    LEFT JOIN vocabulary_terms vt ON uvp."termId" = vt.id
    WHERE vt.id IS NULL
  `;

  const remainingCount = Number(remainingOrphaned[0]?.count || 0);

  if (remainingCount === 0) {
    console.log('✓ Cleanup successful! Zero orphaned records remaining.');
  } else {
    console.error(`✗ Warning: ${remainingCount} orphaned records still exist!`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Cleanup Summary:');
  console.log(`  Original orphaned count: ${orphanedCount}`);
  console.log(`  Backed up: ${backupResult}`);
  console.log(`  Deleted: ${deleteResult}`);
  console.log(`  Remaining: ${remainingCount}`);
  console.log(`Completed at: ${new Date().toISOString()}`);
  console.log('='.repeat(80));
}

main()
  .catch((error) => {
    console.error('\n' + '='.repeat(80));
    console.error('ERROR: Cleanup failed!');
    console.error('='.repeat(80));
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
