/**
 * Migration Script: Normalize Assignment Points
 *
 * This script normalizes existing assignments:
 * 1. Sets totalPoints = 100 for all assignments
 * 2. Normalizes activity points to sum = 100
 * 3. Fixes invalid time windows (startTime > dueDate)
 *
 * Usage:
 *   npx ts-node scripts/migrate-assignment-points.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AssignmentWithActivities {
  id: string;
  title: string;
  totalPoints: number;
  startTime: Date | null;
  dueDate: Date | null;
  assignmentActivities: Array<{
    id: string;
    points: number;
  }>;
}

async function normalizeActivityPoints(
  activities: Array<{ id: string; points: number }>,
): Promise<Array<{ id: string; points: number }>> {
  if (!activities || activities.length === 0) {
    return activities;
  }

  const sumOfPoints = activities.reduce((sum, a) => sum + (a.points || 10), 0);

  if (sumOfPoints === 0 || sumOfPoints === 100) {
    return activities;
  }

  const scaleFactor = 100 / sumOfPoints;

  return activities.map((activity) => ({
    ...activity,
    points: Math.round((activity.points || 10) * scaleFactor),
  }));
}

async function migrateAssignments(dryRun: boolean = false) {
  console.log(`\n${dryRun ? '[DRY RUN]' : '[LIVE]'} Starting migration...\n`);

  // Find all assignments
  const assignments = await prisma.assignment.findMany({
    include: {
      assignmentActivities: {
        select: {
          id: true,
          points: true,
        },
      },
    },
  });

  console.log(`Found ${assignments.length} assignments\n`);

  let totalPointsFixed = 0;
  let activityPointsNormalized = 0;
  let timeWindowFixed = 0;

  for (const assignment of assignments) {
    const updates: any = {};
    let needsUpdate = false;

    // 1. Fix totalPoints > 100
    if (assignment.totalPoints > 100) {
      updates.totalPoints = 100;
      needsUpdate = true;
      totalPointsFixed++;
      console.log(
        `  [${assignment.id}] Fixing totalPoints: ${assignment.totalPoints} → 100`,
      );
    }

    // 2. Normalize activity points
    const activities = assignment.assignmentActivities;
    if (activities.length > 0) {
      const sumOfPoints = activities.reduce(
        (sum, a) => sum + (a.points || 10),
        0,
      );

      if (sumOfPoints !== 100 && sumOfPoints > 0) {
        const normalized = await normalizeActivityPoints(activities);
        const hasChanges = normalized.some(
          (n, i) => n.points !== activities[i].points,
        );

        if (hasChanges) {
          if (!dryRun) {
            // Update each activity
            for (const normalizedActivity of normalized) {
              await prisma.assignmentActivity.update({
                where: { id: normalizedActivity.id },
                data: { points: normalizedActivity.points },
              });
            }
          }
          activityPointsNormalized++;
          console.log(
            `  [${assignment.id}] Normalizing activity points: ${sumOfPoints} → 100`,
          );
        }
      }
    }

    // 3. Fix invalid time windows (startTime > dueDate)
    if (
      assignment.startTime &&
      assignment.dueDate &&
      assignment.startTime > assignment.dueDate
    ) {
      updates.startTime = null; // Remove invalid startTime
      needsUpdate = true;
      timeWindowFixed++;
      console.log(
        `  [${assignment.id}] Fixing time window: startTime > dueDate, removing startTime`,
      );
    }

    // Apply updates
    if (needsUpdate && !dryRun) {
      await prisma.assignment.update({
        where: { id: assignment.id },
        data: updates,
      });
    }
  }

  console.log(`\n=== Migration Summary ===`);
  console.log(`Total assignments: ${assignments.length}`);
  console.log(`totalPoints fixed: ${totalPointsFixed}`);
  console.log(`Activity points normalized: ${activityPointsNormalized}`);
  console.log(`Time windows fixed: ${timeWindowFixed}`);
  console.log(`\n${dryRun ? '[DRY RUN] No changes made' : '[LIVE] Migration completed'}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
    await migrateAssignments(dryRun);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

