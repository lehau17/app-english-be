import { PrismaClient } from '@prisma/client';
import { lessonCategoryMap, validateMapping } from './speaking-practice-category-mapping';

const prisma = new PrismaClient();

async function applyCategorization() {
  console.log('🔍 Validating mapping...');
  const { isValid, errors } = validateMapping();

  if (!isValid) {
    console.error('❌ Validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('✅ Mapping validated successfully!\n');
  console.log('📝 Applying categorization to lessons...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const [lessonId, { category, tier }] of Object.entries(lessonCategoryMap)) {
    try {
      await prisma.speakingPracticeLesson.update({
        where: { id: lessonId },
        data: {
          category,
          difficultyTier: tier,
        },
      });
      console.log(`✓ ${lessonId} → ${category} (Tier ${tier})`);
      successCount++;
    } catch (error: any) {
      console.error(`✗ Failed to update ${lessonId}: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  if (errorCount === 0) {
    console.log('\n🎉 All lessons categorized successfully!');
  }
}

applyCategorization()
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
