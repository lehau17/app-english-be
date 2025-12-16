/**
 * Speaking Practice Lesson → Topic Category Mapping
 *
 * This file defines the mapping of all 50 lessons to topic categories and difficulty tiers.
 *
 * Difficulty Tier Mapping Rule:
 * - Level 1-2 → Tier 1 (Easy)
 * - Level 3 → Tier 2 (Medium)
 * - Level 4-5 → Tier 3 (Hard)
 */

export interface LessonCategoryMapping {
  category: string;
  tier: number; // 1=Easy, 2=Medium, 3=Hard
}

// Map lesson IDs to their category and tier
// Format: 'sp-lesson-L{level}-{orderIndex}' → { category, tier }
export const lessonCategoryMap: Record<string, LessonCategoryMapping> = {
  // ==================== LEVEL 1: Words - Tier 1 (Easy) ====================
  'sp-lesson-L1-1': { category: 'Animals', tier: 1 },
  'sp-lesson-L1-2': { category: 'Colors & Shapes', tier: 1 },
  'sp-lesson-L1-3': { category: 'Numbers & Time', tier: 1 },
  'sp-lesson-L1-4': { category: 'Family', tier: 1 },
  'sp-lesson-L1-5': { category: 'Food & Drinks', tier: 1 },
  'sp-lesson-L1-6': { category: 'Body & Health', tier: 1 },
  'sp-lesson-L1-7': { category: 'Shopping', tier: 1 }, // Clothes - part of shopping
  'sp-lesson-L1-8': { category: 'Daily Activities', tier: 1 }, // Weather - daily topic
  'sp-lesson-L1-9': { category: 'Hobbies & Interests', tier: 1 }, // Toys - interests
  'sp-lesson-L1-10': { category: 'Daily Activities', tier: 1 }, // Actions - daily

  // ==================== LEVEL 2: Phrases - Tier 1 (Easy) ====================
  'sp-lesson-L2-1': { category: 'Greetings', tier: 1 },
  'sp-lesson-L2-2': { category: 'Greetings', tier: 1 }, // Polite words - greetings
  'sp-lesson-L2-3': { category: 'Greetings', tier: 1 }, // Self intro - greetings
  'sp-lesson-L2-4': { category: 'School & Learning', tier: 1 },
  'sp-lesson-L2-5': { category: 'Daily Activities', tier: 1 }, // Asking questions - daily
  'sp-lesson-L2-6': { category: 'Daily Activities', tier: 1 },
  'sp-lesson-L2-7': { category: 'Daily Activities', tier: 1 }, // At home - daily
  'sp-lesson-L2-8': { category: 'Feelings & Emotions', tier: 1 },
  'sp-lesson-L2-9': { category: 'Shopping', tier: 1 },
  'sp-lesson-L2-10': { category: 'Hobbies & Interests', tier: 1 }, // Playing - hobbies

  // ==================== LEVEL 3: Sentences - Tier 2 (Medium) ====================
  'sp-lesson-L3-1': { category: 'Describing Things', tier: 2 }, // About me - describing
  'sp-lesson-L3-2': { category: 'Family', tier: 2 },
  'sp-lesson-L3-3': { category: 'School & Learning', tier: 2 },
  'sp-lesson-L3-4': { category: 'Hobbies & Interests', tier: 2 },
  'sp-lesson-L3-5': { category: 'Daily Activities', tier: 2 }, // Weather talk - daily
  'sp-lesson-L3-6': { category: 'Food & Drinks', tier: 2 },
  'sp-lesson-L3-7': { category: 'Daily Activities', tier: 2 }, // Asking for help - daily
  'sp-lesson-L3-8': { category: 'Past & Future', tier: 2 }, // Making plans - future
  'sp-lesson-L3-9': { category: 'Describing Things', tier: 2 },
  'sp-lesson-L3-10': { category: 'Past & Future', tier: 2 }, // Past events

  // ==================== LEVEL 4: Dialogues - Tier 3 (Hard) ====================
  'sp-lesson-L4-1': { category: 'Greetings', tier: 3 }, // Meeting new friends
  'sp-lesson-L4-2': { category: 'Food & Drinks', tier: 3 }, // At restaurant
  'sp-lesson-L4-3': { category: 'Shopping', tier: 3 }, // Shopping for clothes
  'sp-lesson-L4-4': { category: 'Travel & Directions', tier: 3 },
  'sp-lesson-L4-5': { category: 'Body & Health', tier: 3 }, // At doctor
  'sp-lesson-L4-6': { category: 'Daily Activities', tier: 3 }, // Phone call - daily
  'sp-lesson-L4-7': { category: 'Travel & Directions', tier: 3 }, // Planning trip
  'sp-lesson-L4-8': { category: 'Hobbies & Interests', tier: 3 }, // Birthday party
  'sp-lesson-L4-9': { category: 'School & Learning', tier: 3 }, // Library
  'sp-lesson-L4-10': { category: 'School & Learning', tier: 3 }, // Job interview

  // ==================== LEVEL 5: Free Talk - Tier 3 (Hard) ====================
  'sp-lesson-L5-1': { category: 'Past & Future', tier: 3 }, // My dream - future
  'sp-lesson-L5-2': { category: 'Describing Things', tier: 3 }, // Best friend
  'sp-lesson-L5-3': { category: 'Hobbies & Interests', tier: 3 }, // Movies
  'sp-lesson-L5-4': { category: 'Hobbies & Interests', tier: 3 }, // Weekend activities
  'sp-lesson-L5-5': { category: 'Animals', tier: 3 }, // My pet
  'sp-lesson-L5-6': { category: 'Food & Drinks', tier: 3 }, // Favorite food
  'sp-lesson-L5-7': { category: 'Past & Future', tier: 3 }, // Special holiday
  'sp-lesson-L5-8': { category: 'Body & Health', tier: 3 }, // Sports - health
  'sp-lesson-L5-9': { category: 'Describing Things', tier: 3 }, // My room
  'sp-lesson-L5-10': { category: 'Describing Things', tier: 3 }, // Neighborhood
};

// Category definitions with metadata
export const TOPIC_CATEGORIES = [
  { name: 'Animals', icon: '🐾', color: '#4CAF50' },
  { name: 'Food & Drinks', icon: '🍔', color: '#FF9800' },
  { name: 'Family', icon: '👨‍👩‍👧‍👦', color: '#E91E63' },
  { name: 'Colors & Shapes', icon: '🎨', color: '#9C27B0' },
  { name: 'Greetings', icon: '👋', color: '#2196F3' },
  { name: 'Numbers & Time', icon: '🔢', color: '#00BCD4' },
  { name: 'Body & Health', icon: '💪', color: '#F44336' },
  { name: 'School & Learning', icon: '📚', color: '#3F51B5' },
  { name: 'Daily Activities', icon: '☀️', color: '#FFEB3B' },
  { name: 'Feelings & Emotions', icon: '😊', color: '#FF5722' },
  { name: 'Shopping', icon: '🛒', color: '#795548' },
  { name: 'Travel & Directions', icon: '✈️', color: '#607D8B' },
  { name: 'Hobbies & Interests', icon: '⚽', color: '#8BC34A' },
  { name: 'Describing Things', icon: '📝', color: '#673AB7' },
  { name: 'Past & Future', icon: '⏰', color: '#009688' },
] as const;

export type CategoryName = typeof TOPIC_CATEGORIES[number]['name'];

// Validation function
export function validateMapping(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lessonIds = Object.keys(lessonCategoryMap);

  // Check total count
  if (lessonIds.length !== 50) {
    errors.push(`Expected 50 lessons, found ${lessonIds.length}`);
  }

  // Check all categories are valid
  const validCategories = new Set<string>(TOPIC_CATEGORIES.map(c => c.name));
  for (const [lessonId, mapping] of Object.entries(lessonCategoryMap)) {
    if (!validCategories.has(mapping.category as string)) {
      errors.push(`Invalid category "${mapping.category}" for lesson ${lessonId}`);
    }
    if (mapping.tier < 1 || mapping.tier > 3) {
      errors.push(`Invalid tier ${mapping.tier} for lesson ${lessonId}`);
    }
  }

  // Check distribution
  const categoryDistribution = new Map<CategoryName, { tier1: number; tier2: number; tier3: number }>();
  for (const mapping of Object.values(lessonCategoryMap)) {
    const category = mapping.category as CategoryName;
    if (!categoryDistribution.has(category)) {
      categoryDistribution.set(category, { tier1: 0, tier2: 0, tier3: 0 });
    }
    const dist = categoryDistribution.get(category)!;
    if (mapping.tier === 1) dist.tier1++;
    if (mapping.tier === 2) dist.tier2++;
    if (mapping.tier === 3) dist.tier3++;
  }

  // Log distribution
  console.log('\n📊 Category Distribution:');
  const categories = Array.from(categoryDistribution.entries());
  for (const [cat, dist] of categories) {
    const total = dist.tier1 + dist.tier2 + dist.tier3;
    console.log(`  ${cat}: Total=${total}, Easy=${dist.tier1}, Medium=${dist.tier2}, Hard=${dist.tier3}`);
  }

  return { isValid: errors.length === 0, errors };
}

// Run validation if called directly
if (require.main === module) {
  const { isValid, errors } = validateMapping();
  if (isValid) {
    console.log('\n✅ All validations passed!');
    process.exit(0);
  } else {
    console.error('\n❌ Validation failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }
}
