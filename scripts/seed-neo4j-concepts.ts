/**
 * Seed Neo4j with core English learning concepts
 * Phase 3: Manual seeding of 20+ concepts
 *
 * Run: npx ts-node scripts/seed-neo4j-concepts.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/client-api/src/app.module';
import { Neo4jGraphService } from '../apps/client-api/src/domains/learning-path/service/neo4j-graph.service';

async function seedConcepts() {
  console.log('🌱 Starting Neo4j concept seeding...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const graphService = app.get(Neo4jGraphService);

  // Core English learning concepts
  const concepts = [
    // Beginner Level - Fundamentals (1-8)
    {
      id: 'alphabet-basics',
      name: 'English Alphabet',
      description: 'Basic alphabet recognition and pronunciation',
      difficulty: 'beginner',
      skillType: 'foundational',
      prerequisites: [],
      skills: ['alphabet', 'pronunciation-basics'],
    },
    {
      id: 'numbers-counting',
      name: 'Numbers and Counting',
      description: 'Cardinal and ordinal numbers',
      difficulty: 'beginner',
      skillType: 'foundational',
      prerequisites: [],
      skills: ['numbers', 'counting'],
    },
    {
      id: 'common-greetings',
      name: 'Common Greetings',
      description: 'Basic greeting phrases and responses',
      difficulty: 'beginner',
      skillType: 'vocabulary',
      prerequisites: ['alphabet-basics'],
      skills: ['vocabulary', 'speaking-basics'],
    },
    {
      id: 'basic-pronouns',
      name: 'Personal Pronouns',
      description: 'Subject and object pronouns',
      difficulty: 'beginner',
      skillType: 'grammar',
      prerequisites: ['alphabet-basics'],
      skills: ['grammar', 'pronouns'],
    },
    {
      id: 'present-simple',
      name: 'Present Simple Tense',
      description: 'Basic present tense verb forms',
      difficulty: 'beginner',
      skillType: 'grammar',
      prerequisites: ['basic-pronouns'],
      skills: ['grammar', 'verb-tenses'],
    },
    {
      id: 'common-verbs',
      name: 'Common Action Verbs',
      description: 'Everyday action verbs (go, eat, sleep, etc.)',
      difficulty: 'beginner',
      skillType: 'vocabulary',
      prerequisites: ['present-simple'],
      skills: ['vocabulary', 'verbs'],
    },
    {
      id: 'basic-adjectives',
      name: 'Basic Adjectives',
      description: 'Descriptive adjectives (big, small, happy, sad)',
      difficulty: 'beginner',
      skillType: 'vocabulary',
      prerequisites: ['common-verbs'],
      skills: ['vocabulary', 'adjectives'],
    },
    {
      id: 'simple-questions',
      name: 'Simple Question Formation',
      description: 'WH-questions (who, what, where, when, why, how)',
      difficulty: 'beginner',
      skillType: 'grammar',
      prerequisites: ['present-simple', 'basic-pronouns'],
      skills: ['grammar', 'questions'],
    },

    // Intermediate Level - Building Skills (9-16)
    {
      id: 'past-simple',
      name: 'Past Simple Tense',
      description: 'Regular and irregular past tense',
      difficulty: 'intermediate',
      skillType: 'grammar',
      prerequisites: ['present-simple', 'common-verbs'],
      skills: ['grammar', 'verb-tenses'],
    },
    {
      id: 'future-tenses',
      name: 'Future Tenses',
      description: 'Will, going to, present continuous for future',
      difficulty: 'intermediate',
      skillType: 'grammar',
      prerequisites: ['past-simple'],
      skills: ['grammar', 'verb-tenses'],
    },
    {
      id: 'phrasal-verbs',
      name: 'Common Phrasal Verbs',
      description: 'Verb + preposition combinations',
      difficulty: 'intermediate',
      skillType: 'vocabulary',
      prerequisites: ['common-verbs', 'past-simple'],
      skills: ['vocabulary', 'phrasal-verbs'],
    },
    {
      id: 'comparatives-superlatives',
      name: 'Comparatives and Superlatives',
      description: 'Comparing things (bigger, biggest, more, most)',
      difficulty: 'intermediate',
      skillType: 'grammar',
      prerequisites: ['basic-adjectives'],
      skills: ['grammar', 'comparatives'],
    },
    {
      id: 'prepositions',
      name: 'Prepositions of Time and Place',
      description: 'In, on, at, from, to, etc.',
      difficulty: 'intermediate',
      skillType: 'grammar',
      prerequisites: ['simple-questions'],
      skills: ['grammar', 'prepositions'],
    },
    {
      id: 'conditional-sentences',
      name: 'Conditional Sentences (First)',
      description: 'If-clauses for real conditions',
      difficulty: 'intermediate',
      skillType: 'grammar',
      prerequisites: ['future-tenses'],
      skills: ['grammar', 'conditionals'],
    },
    {
      id: 'modal-verbs',
      name: 'Modal Verbs',
      description: 'Can, could, should, must, may, might',
      difficulty: 'intermediate',
      skillType: 'grammar',
      prerequisites: ['present-simple', 'past-simple'],
      skills: ['grammar', 'modals'],
    },
    {
      id: 'idioms-basic',
      name: 'Common English Idioms',
      description: 'Frequently used idiomatic expressions',
      difficulty: 'intermediate',
      skillType: 'vocabulary',
      prerequisites: ['phrasal-verbs'],
      skills: ['vocabulary', 'idioms'],
    },

    // Advanced Level - Mastery (17-24)
    {
      id: 'perfect-tenses',
      name: 'Perfect Tenses',
      description: 'Present perfect, past perfect, future perfect',
      difficulty: 'advanced',
      skillType: 'grammar',
      prerequisites: ['past-simple', 'future-tenses'],
      skills: ['grammar', 'verb-tenses'],
    },
    {
      id: 'passive-voice',
      name: 'Passive Voice',
      description: 'Transforming active to passive constructions',
      difficulty: 'advanced',
      skillType: 'grammar',
      prerequisites: ['perfect-tenses'],
      skills: ['grammar', 'voice'],
    },
    {
      id: 'reported-speech',
      name: 'Reported Speech',
      description: 'Direct vs indirect speech',
      difficulty: 'advanced',
      skillType: 'grammar',
      prerequisites: ['past-simple', 'modal-verbs'],
      skills: ['grammar', 'reported-speech'],
    },
    {
      id: 'advanced-conditionals',
      name: 'Advanced Conditionals',
      description: 'Second, third, and mixed conditionals',
      difficulty: 'advanced',
      skillType: 'grammar',
      prerequisites: ['conditional-sentences', 'perfect-tenses'],
      skills: ['grammar', 'conditionals'],
    },
    {
      id: 'relative-clauses',
      name: 'Relative Clauses',
      description: 'Defining and non-defining relative clauses',
      difficulty: 'advanced',
      skillType: 'grammar',
      prerequisites: ['simple-questions', 'prepositions'],
      skills: ['grammar', 'clauses'],
    },
    {
      id: 'advanced-vocabulary',
      name: 'Advanced Vocabulary',
      description: 'Academic and professional vocabulary',
      difficulty: 'advanced',
      skillType: 'vocabulary',
      prerequisites: ['idioms-basic', 'phrasal-verbs'],
      skills: ['vocabulary', 'academic'],
    },
    {
      id: 'collocations',
      name: 'Common Collocations',
      description: 'Word combinations that naturally go together',
      difficulty: 'advanced',
      skillType: 'vocabulary',
      prerequisites: ['advanced-vocabulary'],
      skills: ['vocabulary', 'collocations'],
    },
    {
      id: 'formal-informal',
      name: 'Formal vs Informal English',
      description: 'Register and tone in different contexts',
      difficulty: 'advanced',
      skillType: 'pragmatics',
      prerequisites: ['reported-speech', 'collocations'],
      skills: ['pragmatics', 'register'],
    },
  ];

  try {
    // Seed all concepts
    await graphService.seedConcepts(concepts);

    // Get and display graph overview
    const overview = await graphService.getGraphOverview();

    console.log('\n✅ Seeding complete!');
    console.log('\n📊 Graph Overview:');
    console.log(`   - Concepts: ${overview.conceptCount}`);
    console.log(`   - Skills: ${overview.skillCount}`);
    console.log(`   - Prerequisites: ${overview.prerequisiteCount}`);
    console.log(`   - Teaches relationships: ${overview.teachesCount}`);

    // Show some example learning paths
    console.log('\n📚 Example Learning Paths:');

    const exampleTargets = [
      'simple-questions',
      'modal-verbs',
      'advanced-conditionals',
    ];

    for (const targetId of exampleTargets) {
      const path = await graphService.getLearningPath(targetId);
      const target = concepts.find((c) => c.id === targetId);

      console.log(`\n   Path to "${target?.name}":`);
      path.forEach((step, idx) => {
        console.log(`      ${idx + 1}. ${step.name} (${step.difficulty})`);
      });
    }

    console.log('\n✨ Neo4j seeding completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Run seeding
seedConcepts().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
