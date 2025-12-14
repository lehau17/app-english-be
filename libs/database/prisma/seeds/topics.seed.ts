/* eslint-disable no-console */
import { DifficultyLevel, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const SEED_TOPICS = [
  // Daily Life (Beginner)
  {
    name: 'My Daily Routine',
    description: 'Talk about your daily activities and habits',
    category: 'daily_life',
    difficulty: DifficultyLevel.beginner,
    isFeatured: true,
  },
  {
    name: 'My Family and Friends',
    description: 'Describe your family members and friends',
    category: 'daily_life',
    difficulty: DifficultyLevel.beginner,
    isFeatured: true,
  },
  {
    name: 'Hobbies and Free Time',
    description: 'Share your hobbies and leisure activities',
    category: 'daily_life',
    difficulty: DifficultyLevel.beginner,
  },
  {
    name: 'Food and Cooking',
    description: 'Discuss your favorite foods and cooking experiences',
    category: 'daily_life',
    difficulty: DifficultyLevel.beginner,
  },

  // Travel (Elementary-Intermediate)
  {
    name: 'Planning a Vacation',
    description: 'Discuss vacation plans and travel destinations',
    category: 'travel',
    difficulty: DifficultyLevel.elementary,
    isFeatured: true,
  },
  {
    name: 'At the Airport',
    description: 'Practice common airport situations and conversations',
    category: 'travel',
    difficulty: DifficultyLevel.elementary,
  },
  {
    name: 'Exploring a New City',
    description: 'Talk about discovering new places and cultures',
    category: 'travel',
    difficulty: DifficultyLevel.intermediate,
  },
  {
    name: 'Cultural Differences',
    description: 'Discuss cultural experiences and differences',
    category: 'travel',
    difficulty: DifficultyLevel.intermediate,
  },

  // Work & Business (Intermediate-Advanced)
  {
    name: 'Job Interview Practice',
    description: 'Prepare for job interviews with common questions',
    category: 'business',
    difficulty: DifficultyLevel.intermediate,
    isFeatured: true,
  },
  {
    name: 'Office Small Talk',
    description: 'Practice casual workplace conversations',
    category: 'business',
    difficulty: DifficultyLevel.intermediate,
  },
  {
    name: 'Giving Presentations',
    description: 'Learn to present ideas effectively',
    category: 'business',
    difficulty: DifficultyLevel.advanced,
  },
  {
    name: 'Negotiation Skills',
    description: 'Practice business negotiation scenarios',
    category: 'business',
    difficulty: DifficultyLevel.advanced,
  },

  // Current Events (Intermediate-Expert)
  {
    name: 'Technology and AI',
    description: 'Discuss technology trends and artificial intelligence',
    category: 'current_events',
    difficulty: DifficultyLevel.intermediate,
    isFeatured: true,
  },
  {
    name: 'Climate Change',
    description: 'Talk about environmental issues and solutions',
    category: 'current_events',
    difficulty: DifficultyLevel.advanced,
  },
  {
    name: 'Social Media Impact',
    description: 'Explore social media influence on society',
    category: 'current_events',
    difficulty: DifficultyLevel.intermediate,
  },
  {
    name: 'Global Economics',
    description: 'Discuss economic trends and global markets',
    category: 'current_events',
    difficulty: DifficultyLevel.expert,
  },

  // Personal Growth (Various)
  {
    name: 'Setting Goals',
    description: 'Talk about personal goals and aspirations',
    category: 'personal',
    difficulty: DifficultyLevel.elementary,
  },
  {
    name: 'Health and Wellness',
    description: 'Discuss healthy lifestyle and wellness topics',
    category: 'personal',
    difficulty: DifficultyLevel.intermediate,
  },
  {
    name: 'Learning New Skills',
    description: 'Share experiences about learning and self-improvement',
    category: 'personal',
    difficulty: DifficultyLevel.intermediate,
  },
  {
    name: 'Life Philosophy',
    description: 'Explore deeper life questions and philosophies',
    category: 'personal',
    difficulty: DifficultyLevel.advanced,
  },
];

export async function seedTopics() {
  console.log('Seeding topics...');

  for (const topicData of SEED_TOPICS) {
    await prisma.topic.upsert({
      where: { name: topicData.name },
      update: topicData,
      create: {
        ...topicData,
        isActive: true,
        usageCount: 0,
        trendScore: 0,
      },
    });
  }

  console.log(`Seeded ${SEED_TOPICS.length} topics`);
}

// Run standalone if executed directly
if (require.main === module) {
  seedTopics()
    .catch((e) => {
      console.error('Topic seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
