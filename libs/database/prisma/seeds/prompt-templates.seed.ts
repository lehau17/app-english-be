import { PrismaClient, ActivityType, DifficultyLevel } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed data for AI activity generation prompt templates
 * Covers all 15 activity types with proficiency-level variations
 */
const promptTemplates = [
  // ========== VOCAB Templates ==========
  {
    name: 'VOCAB_A1_General',
    description: 'Basic vocabulary for beginners (A1 level)',
    activityType: 'VOCAB' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are an English vocabulary teacher creating beginner-level (A1) vocabulary exercises.
Focus on everyday words and simple contexts that absolute beginners can understand.`,
    userPrompt: `Generate {{count}} vocabulary words for {{proficiencyLevel}} level learners.
Topic: {{skill}}
Context: {{context}}

Return JSON:
{
  "title": "Vocabulary: [Topic]",
  "description": "Learn essential {{skill}} words",
  "words": [
    {
      "word": "example",
      "pronunciation": "/ɪɡˈzæm.pəl/",
      "partOfSpeech": "noun",
      "definition": "a thing characteristic of its kind",
      "example": "Can you give me an example?",
      "translation": "ví dụ",
      "imageUrl": null
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
  },

  {
    name: 'VOCAB_B1_Business',
    description: 'Business vocabulary for intermediate learners',
    activityType: 'VOCAB' as ActivityType,
    difficulty: 'MEDIUM' as DifficultyLevel,
    skill: 'business_vocabulary',
    systemPrompt: `You are a business English teacher creating intermediate-level (B1) vocabulary exercises.
Focus on professional contexts, workplace scenarios, and common business terminology.`,
    userPrompt: `Generate {{count}} business vocabulary words for {{proficiencyLevel}} level learners.
Weakness area: {{weakness}}
Context: {{context}}

Return JSON with business-relevant words including collocations and usage notes.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
  },

  {
    name: 'VOCAB_B2_Academic',
    description: 'Academic vocabulary for upper-intermediate learners',
    activityType: 'VOCAB' as ActivityType,
    difficulty: 'HARD' as DifficultyLevel,
    skill: 'academic_vocabulary',
    systemPrompt: `You are an academic English teacher creating upper-intermediate (B2) vocabulary exercises.
Focus on formal language, academic writing, and specialized terminology.`,
    userPrompt: `Generate {{count}} academic vocabulary words for {{proficiencyLevel}} level learners.
Subject area: {{skill}}
Include synonyms, antonyms, and collocations where appropriate.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
  },

  // ========== PRONUNCIATION Templates ==========
  {
    name: 'PRONUNCIATION_A2_Phonics',
    description: 'Basic phonics and pronunciation practice',
    activityType: 'PRONUNCIATION' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are a pronunciation teacher creating beginner-level phonics exercises.
Focus on individual sounds, minimal pairs, and simple words.`,
    userPrompt: `Generate {{count}} pronunciation exercises for {{proficiencyLevel}} level.
Target sound: {{skill}}
Difficulty: Simple words with clear pronunciation patterns

Return JSON:
{
  "title": "Pronunciation Practice: [Sound]",
  "exercises": [
    {
      "targetPhrase": "cat",
      "phonetic": "/kæt/",
      "audioUrl": null,
      "tips": "Focus on the short 'a' sound"
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.6,
    maxTokens: 1500,
  },

  {
    name: 'PRONUNCIATION_B1_Sentences',
    description: 'Sentence-level pronunciation with stress and intonation',
    activityType: 'PRONUNCIATION' as ActivityType,
    difficulty: 'MEDIUM' as DifficultyLevel,
    skill: 'intonation',
    systemPrompt: `You are a pronunciation teacher creating intermediate sentence pronunciation exercises.
Focus on word stress, sentence stress, and intonation patterns.`,
    userPrompt: `Generate {{count}} sentence pronunciation exercises for {{proficiencyLevel}} level.
Focus area: {{weakness}}
Include stress markers and intonation notes.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.6,
    maxTokens: 1500,
  },

  // ========== LISTENING Templates ==========
  {
    name: 'LISTENING_A1_Basic',
    description: 'Basic listening comprehension for beginners',
    activityType: 'LISTENING' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are a listening comprehension teacher for beginners (A1).
Create simple dialogues with clear, slow speech and basic vocabulary.`,
    userPrompt: `Generate a listening exercise for {{proficiencyLevel}} level.
Topic: {{skill}}
Duration: Short (30-60 seconds)

Return JSON:
{
  "title": "Listening: [Topic]",
  "transcript": "A: Hello! B: Hi there!",
  "audioUrl": null,
  "questions": [
    {
      "question": "What does person A say?",
      "options": ["Hello", "Goodbye", "Thank you", "Please"],
      "correctAnswer": 0
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
  },

  {
    name: 'LISTENING_B2_News',
    description: 'News and current affairs listening for advanced learners',
    activityType: 'LISTENING' as ActivityType,
    difficulty: 'HARD' as DifficultyLevel,
    skill: 'news_comprehension',
    systemPrompt: `You are a listening comprehension teacher for advanced learners (B2).
Create news-style content with natural speed and complex vocabulary.`,
    userPrompt: `Generate a news listening exercise for {{proficiencyLevel}} level.
Topic: {{context}}
Include comprehension questions that test inference and detail understanding.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
  },

  // ========== GRAMMAR Templates ==========
  {
    name: 'GRAMMAR_A1_Present_Simple',
    description: 'Present simple tense exercises for beginners',
    activityType: 'GRAMMAR' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: 'present_simple',
    systemPrompt: `You are a grammar teacher creating present simple tense exercises for beginners.
Focus on basic sentence structures and common verbs.`,
    userPrompt: `Generate {{count}} present simple grammar exercises for {{proficiencyLevel}} level.
Include affirmative, negative, and question forms.

Return JSON:
{
  "title": "Grammar: Present Simple",
  "explanation": "The present simple describes habits and facts.",
  "exercises": [
    {
      "instruction": "Complete with the correct form of the verb",
      "sentence": "She ___ (go) to school every day.",
      "correctAnswer": "goes",
      "options": ["go", "goes", "going", "went"]
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.6,
    maxTokens: 2000,
  },

  {
    name: 'GRAMMAR_B1_Past_Perfect',
    description: 'Past perfect tense for intermediate learners',
    activityType: 'GRAMMAR' as ActivityType,
    difficulty: 'MEDIUM' as DifficultyLevel,
    skill: 'past_perfect',
    systemPrompt: `You are a grammar teacher creating past perfect exercises for intermediate learners.
Focus on timeline relationships and contrasts with past simple.`,
    userPrompt: `Generate {{count}} past perfect grammar exercises for {{proficiencyLevel}} level.
Weakness: {{weakness}}
Include explanations of when to use past perfect vs past simple.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.6,
    maxTokens: 2000,
  },

  // ========== QUIZ Templates ==========
  {
    name: 'QUIZ_A2_General',
    description: 'General knowledge quiz for elementary learners',
    activityType: 'QUIZ' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating multiple-choice quizzes for elementary English learners (A2).
Use simple language and clear questions.`,
    userPrompt: `Generate a {{count}}-question quiz for {{proficiencyLevel}} level.
Topic: {{skill}}

Return JSON:
{
  "title": "Quiz: [Topic]",
  "questions": [
    {
      "question": "What is the capital of England?",
      "options": ["London", "Paris", "Berlin", "Rome"],
      "correctAnswer": 0,
      "explanation": "London is the capital city of England."
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
  },

  {
    name: 'QUIZ_B2_Advanced',
    description: 'Advanced comprehension quiz',
    activityType: 'QUIZ' as ActivityType,
    difficulty: 'HARD' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating advanced multiple-choice quizzes for upper-intermediate learners (B2).
Include questions that test inference, nuance, and critical thinking.`,
    userPrompt: `Generate a {{count}}-question advanced quiz for {{proficiencyLevel}} level.
Topic: {{skill}}
Include distractors that require careful reading.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2048,
  },

  // ========== FILL_BLANK Templates ==========
  {
    name: 'FILL_BLANK_A1_Basic',
    description: 'Basic gap-fill exercises for beginners',
    activityType: 'FILL_BLANK' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating gap-fill exercises for beginners (A1).
Use simple sentences with one clear answer per blank.`,
    userPrompt: `Generate {{count}} gap-fill exercises for {{proficiencyLevel}} level.
Topic: {{skill}}

Return JSON:
{
  "title": "Fill in the Blanks: [Topic]",
  "exercises": [
    {
      "sentence": "I ___ to school every day.",
      "correctAnswer": "go",
      "options": ["go", "goes", "going", "went"],
      "hint": "present simple for 'I'"
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.6,
    maxTokens: 1500,
  },

  {
    name: 'FILL_BLANK_B1_Cloze',
    description: 'Cloze test for intermediate learners',
    activityType: 'FILL_BLANK' as ActivityType,
    difficulty: 'MEDIUM' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating cloze tests for intermediate learners (B1).
Remove key words that test grammar and vocabulary understanding.`,
    userPrompt: `Generate a cloze test passage for {{proficiencyLevel}} level.
Topic: {{skill}}
Remove {{count}} words strategically to test comprehension.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  },

  // ========== READING Templates ==========
  {
    name: 'READING_A2_Short_Stories',
    description: 'Short reading passages for elementary learners',
    activityType: 'READING' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating short reading passages for elementary learners (A2).
Use simple sentences, common vocabulary, and clear narratives.`,
    userPrompt: `Generate a short reading passage (100-150 words) for {{proficiencyLevel}} level.
Topic: {{skill}}
Include comprehension questions.

Return JSON:
{
  "title": "Reading: [Topic]",
  "text": "The full passage text here...",
  "questions": [
    {
      "question": "What is the main idea?",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": 0
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2500,
  },

  {
    name: 'READING_B2_Articles',
    description: 'News articles and essays for advanced learners',
    activityType: 'READING' as ActivityType,
    difficulty: 'HARD' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating reading passages for advanced learners (B2).
Use complex sentence structures, varied vocabulary, and nuanced content.`,
    userPrompt: `Generate a reading article (300-400 words) for {{proficiencyLevel}} level.
Topic: {{skill}}
Include questions that test inference and critical analysis.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 3000,
  },

  // ========== WRITING Templates ==========
  {
    name: 'WRITING_A1_Sentences',
    description: 'Simple sentence writing for beginners',
    activityType: 'WRITING' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating sentence writing prompts for beginners (A1).
Provide clear examples and simple prompts.`,
    userPrompt: `Generate {{count}} sentence writing prompts for {{proficiencyLevel}} level.
Topic: {{skill}}

Return JSON:
{
  "title": "Writing Practice: Simple Sentences",
  "exercises": [
    {
      "prompt": "Write a sentence about your daily routine",
      "example": "I wake up at 7 AM every day.",
      "minWords": 5,
      "tips": "Use present simple tense"
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 1500,
  },

  {
    name: 'WRITING_B1_Paragraphs',
    description: 'Paragraph writing for intermediate learners',
    activityType: 'WRITING' as ActivityType,
    difficulty: 'MEDIUM' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating paragraph writing prompts for intermediate learners (B1).
Focus on coherence, organization, and variety in sentence structure.`,
    userPrompt: `Generate {{count}} paragraph writing prompts for {{proficiencyLevel}} level.
Topic: {{skill}}
Provide structure guidance (topic sentence, supporting details, conclusion).`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  },

  {
    name: 'WRITING_B2_Essays',
    description: 'Essay writing for advanced learners',
    activityType: 'WRITING' as ActivityType,
    difficulty: 'HARD' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating essay writing prompts for advanced learners (B2).
Require argumentation, analysis, and formal register.`,
    userPrompt: `Generate an essay prompt for {{proficiencyLevel}} level.
Topic: {{skill}}
Word count: 250-300 words
Include evaluation criteria for coherence, vocabulary, grammar, and argumentation.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  },

  // ========== MATCHING Templates ==========
  {
    name: 'MATCHING_A1_Word_Picture',
    description: 'Match words to pictures for beginners',
    activityType: 'MATCHING' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating word-picture matching exercises for beginners (A1).
Use concrete, everyday vocabulary.`,
    userPrompt: `Generate {{count}} word-picture matching pairs for {{proficiencyLevel}} level.
Topic: {{skill}}

Return JSON:
{
  "title": "Matching: [Topic]",
  "pairs": [
    {
      "left": "apple",
      "right": "a red fruit",
      "imageUrl": null
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.6,
    maxTokens: 1500,
  },

  {
    name: 'MATCHING_B1_Definitions',
    description: 'Match words to definitions for intermediate learners',
    activityType: 'MATCHING' as ActivityType,
    difficulty: 'MEDIUM' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating word-definition matching exercises for intermediate learners (B1).
Use varied vocabulary and clear definitions.`,
    userPrompt: `Generate {{count}} word-definition matching pairs for {{proficiencyLevel}} level.
Topic: {{skill}}
Include some challenging vocabulary.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 1500,
  },

  // ========== CONVERSATION Templates ==========
  {
    name: 'CONVERSATION_A2_Dialogues',
    description: 'Simple conversation practice for elementary learners',
    activityType: 'CONVERSATION' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating conversation dialogues for elementary learners (A2).
Use everyday situations and functional language.`,
    userPrompt: `Generate a conversation dialogue for {{proficiencyLevel}} level.
Situation: {{skill}}
Roles: 2 speakers
Length: 6-8 turns

Return JSON:
{
  "title": "Conversation: [Situation]",
  "scenario": "Two friends meeting at a cafe",
  "dialogue": [
    {
      "speaker": "A",
      "text": "Hi! How are you?"
    },
    {
      "speaker": "B",
      "text": "I'm fine, thanks. And you?"
    }
  ],
  "practicePrompts": [
    "Practice introducing yourself",
    "Ask about someone's day"
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  },

  {
    name: 'CONVERSATION_B2_Debates',
    description: 'Debate and discussion topics for advanced learners',
    activityType: 'CONVERSATION' as ActivityType,
    difficulty: 'HARD' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating debate topics and discussion guides for advanced learners (B2).
Include controversial topics and argumentative language.`,
    userPrompt: `Generate a debate/discussion topic for {{proficiencyLevel}} level.
Topic: {{skill}}
Include:
- Central question
- Arguments for both sides
- Useful phrases for argumentation
- Counterargument strategies`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2500,
  },

  // ========== DICTATION Templates ==========
  {
    name: 'DICTATION_A2_Sentences',
    description: 'Sentence dictation for elementary learners',
    activityType: 'DICTATION' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating dictation exercises with simple sentences for elementary learners (A2).
Use clear, short sentences with common vocabulary.`,
    userPrompt: `Generate {{count}} dictation sentences for {{proficiencyLevel}} level.
Topic: {{skill}}

Return JSON:
{
  "title": "Dictation Practice: [Topic]",
  "exercises": [
    {
      "text": "I go to school every day.",
      "audioUrl": null,
      "hints": "5 words, present simple tense"
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.6,
    maxTokens: 1500,
  },

  {
    name: 'DICTATION_B1_Passages',
    description: 'Passage dictation for intermediate learners',
    activityType: 'DICTATION' as ActivityType,
    difficulty: 'MEDIUM' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating dictation passages for intermediate learners (B1).
Use connected speech with natural rhythm and intonation.`,
    userPrompt: `Generate a dictation passage (50-80 words) for {{proficiencyLevel}} level.
Topic: {{skill}}
Include punctuation challenges and connected speech patterns.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  },

  // ========== FLASHCARD Templates ==========
  {
    name: 'FLASHCARD_A1_Basic_Words',
    description: 'Basic word flashcards for beginners',
    activityType: 'FLASHCARD' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating flashcards for beginners (A1).
Include word, definition, example, and visual cues.`,
    userPrompt: `Generate {{count}} flashcards for {{proficiencyLevel}} level.
Topic: {{skill}}

Return JSON:
{
  "title": "Flashcards: [Topic]",
  "cards": [
    {
      "front": "cat",
      "back": "a small furry animal that says meow",
      "example": "I have a cat at home.",
      "imageUrl": null,
      "audioUrl": null
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  },

  // ========== SPEAKING Templates ==========
  {
    name: 'SPEAKING_A2_Simple_Topics',
    description: 'Simple speaking prompts for elementary learners',
    activityType: 'SPEAKING' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating speaking prompts for elementary learners (A2).
Use personal, familiar topics.`,
    userPrompt: `Generate {{count}} speaking prompts for {{proficiencyLevel}} level.
Topic: {{skill}}

Return JSON:
{
  "title": "Speaking Practice: [Topic]",
  "prompts": [
    {
      "question": "Tell me about your family.",
      "tips": "Use present simple tense. Describe 2-3 family members.",
      "keyVocabulary": ["mother", "father", "brother", "sister"],
      "minTime": 30
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 1500,
  },

  {
    name: 'SPEAKING_B2_Presentations',
    description: 'Presentation topics for advanced learners',
    activityType: 'SPEAKING' as ActivityType,
    difficulty: 'HARD' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating presentation topics for advanced learners (B2).
Require structured responses with introduction, body, and conclusion.`,
    userPrompt: `Generate a presentation topic for {{proficiencyLevel}} level.
Topic area: {{skill}}
Duration: 2-3 minutes
Include structure guidance and evaluation criteria.`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  },

  // ========== MINI_GAME Templates ==========
  {
    name: 'MINI_GAME_A1_Word_Scramble',
    description: 'Word scramble game for beginners',
    activityType: 'MINI_GAME' as ActivityType,
    difficulty: 'EASY' as DifficultyLevel,
    skill: null,
    systemPrompt: `You are creating word scramble games for beginners (A1).
Use short, common words.`,
    userPrompt: `Generate {{count}} word scramble puzzles for {{proficiencyLevel}} level.
Topic: {{skill}}

Return JSON:
{
  "title": "Word Scramble: [Topic]",
  "games": [
    {
      "scrambled": "tca",
      "correct": "cat",
      "hint": "a furry pet",
      "imageUrl": null
    }
  ]
}`,
    modelName: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 1500,
  },
];

/**
 * Seed prompt templates into database
 */
export async function seedPromptTemplates() {
  console.log('🌱 Seeding prompt templates...');

  let created = 0;
  let skipped = 0;

  for (const template of promptTemplates) {
    try {
      // Check if template already exists
      const existing = await prisma.promptTemplate.findUnique({
        where: { name: template.name },
      });

      if (existing) {
        console.log(`  ⏭️  Skipping existing template: ${template.name}`);
        skipped++;
        continue;
      }

      // Create new template
      await prisma.promptTemplate.create({
        data: template,
      });

      console.log(`  ✅ Created template: ${template.name}`);
      created++;
    } catch (error) {
      console.error(`  ❌ Failed to create template ${template.name}:`, error);
    }
  }

  console.log(
    `\n✨ Prompt templates seeded: ${created} created, ${skipped} skipped`,
  );
  console.log(
    `📊 Total templates in DB: ${await prisma.promptTemplate.count()}`,
  );
}

// Run seed if executed directly
if (require.main === module) {
  seedPromptTemplates()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
