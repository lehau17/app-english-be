import { GeminiService } from '@app/shared';
import { Injectable, Logger } from '@nestjs/common';
import { GoogleTranslateFreeService } from '../../google-translate/google-translate.service';
import { UploadService } from '../../upload/upload.service';
import { ActivityType, DifficultyLevel } from '../dto/generate-activities.dto';

interface ActivityContent {
  [key: string]: any;
}

interface GeneratedActivity {
  type: ActivityType;
  title: string;
  content: ActivityContent;
  difficulty?: DifficultyLevel;
  points?: number;
  orderNo: number;
  instructions?: string;
  passingScore?: number;
}

@Injectable()
export class ActivityAIService {
  private readonly logger = new Logger(ActivityAIService.name);

  constructor(
    private readonly geminiService: GeminiService,
    private readonly googleTranslateService: GoogleTranslateFreeService,
    private readonly uploadService: UploadService,
  ) { }

  async generateActivities(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    count: number,
    activityTypes: ActivityType[] | undefined,
    difficulty: DifficultyLevel | undefined,
  ): Promise<GeneratedActivity[]> {
    this.logger.log(
      `Generating ${count} activities for lesson: "${lessonTitle}"`,
    );

    // Default activity types if not provided
    const types =
      activityTypes && activityTypes.length > 0
        ? activityTypes
        : [ActivityType.VOCAB, ActivityType.QUIZ, ActivityType.LISTENING];

    const activities: GeneratedActivity[] = [];

    // Distribute count across activity types
    const distribution = this.distributeActivities(count, types);

    let orderNo = 1;
    for (const [type, typeCount] of Object.entries(distribution)) {
      for (let i = 0; i < typeCount; i++) {
        try {
          const activity = await this.generateActivityByType(
            type as ActivityType,
            courseTitle,
            courseDescription,
            lessonTitle,
            lessonDescription,
            userPrompt,
            difficulty || DifficultyLevel.BEGINNER,
            orderNo,
          );
          activities.push(activity);
          orderNo++;
          this.logger.log(
            `Generated activity ${orderNo - 1}/${count}: ${type}`,
          );
        } catch (error) {
          this.logger.error(`Failed to generate ${type} activity:`, error);
          // Continue generating other activities
        }
      }
    }

    return activities;
  }

  private distributeActivities(
    count: number,
    types: ActivityType[],
  ): Record<string, number> {
    const distribution: Record<string, number> = {};
    const perType = Math.floor(count / types.length);
    const remainder = count % types.length;

    types.forEach((type, index) => {
      distribution[type] = perType + (index < remainder ? 1 : 0);
    });

    return distribution;
  }

  private async generateActivityByType(
    type: ActivityType,
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    switch (type) {
      case ActivityType.VOCAB:
        return this.generateVocabActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.QUIZ:
        return this.generateQuizActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.LISTENING:
        return this.generateListeningActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.SPEAKING:
        return this.generateSpeakingActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.READING:
        return this.generateReadingActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.WRITING:
        return this.generateWritingActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.PRONUNCIATION:
        return this.generatePronunciationActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.FILL_BLANK:
        return this.generateFillBlankActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.DICTATION:
        return this.generateDictationActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.MATCHING:
        return this.generateMatchingActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.MINI_GAME:
        return this.generateMiniGameActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.GRAMMAR:
        return this.generateGrammarActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.FLASHCARD:
        return this.generateFlashcardActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      case ActivityType.CONVERSATION:
        return this.generateConversationActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
      default:
        // Fallback to quiz for any unknown types
        return this.generateQuizActivity(
          courseTitle,
          courseDescription,
          lessonTitle,
          lessonDescription,
          userPrompt,
          difficulty,
          orderNo,
        );
    }
  }

  private buildContextPrompt(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
  ): string {
    return `
You are an expert ESL teacher creating engaging educational activities.

Course Context:
- Course Title: ${courseTitle}
${courseDescription ? `- Course Description: ${courseDescription}` : ''}

Lesson Context:
- Lesson Title: ${lessonTitle}
${lessonDescription ? `- Lesson Description: ${lessonDescription}` : ''}

${userPrompt ? `User Requirements:\n- ${userPrompt}` : ''}

Difficulty Level: ${difficulty}

Important Guidelines:
- All content must be relevant to the lesson topic
- Use age-appropriate and culturally sensitive examples
- Ensure accuracy in grammar, vocabulary, and definitions
- Make activities engaging and interactive
- Return ONLY valid JSON format without any markdown code blocks
`;
  }

  private async generateVocabActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a vocabulary activity with 8-10 words.

Requirements for each word:
1. word (string): The English word
2. definition (string): Clear, concise definition
3. translationVi (string): Vietnamese translation
4. pronunciation (string): IPA phonetic notation
5. partOfSpeech (string): noun, verb, adjective, adverb, etc.
6. examples (array of strings): 2-3 example sentences
7. synonyms (array of strings): 2-3 synonyms (if applicable)
8. antonyms (array of strings): 1-2 antonyms (if applicable)

Return JSON array format:
[
  {
    "word": "hello",
    "definition": "A greeting used when meeting someone",
    "translationVi": "xin chào",
    "pronunciation": "/həˈloʊ/",
    "partOfSpeech": "interjection",
    "examples": [
      "Hello, how are you today?",
      "She said hello to her neighbor"
    ],
    "synonyms": ["hi", "greetings", "hey"],
    "antonyms": ["goodbye", "farewell"]
  }
]

Generate the vocabulary list now:`;

    // Retry logic để xử lý khi AI trả về JSON không hợp lệ
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.geminiService.generateResponse(prompt);
        const cleanedResponse = this.cleanJsonResponse(response);
        const words = JSON.parse(cleanedResponse);

        // Generate audio for each word using Google Translate TTS
        for (const word of words) {
          try {
            const audioUrl =
              await this.googleTranslateService.createAudioWithUrl(
                word.word,
                'en',
              );
            word.audioUrl = audioUrl;
            word.imageUrl = ''; // No image for auto-generated vocab
            this.logger.log(`🎵 Generated audio for word: ${word.word}`);
          } catch (error) {
            this.logger.warn(
              `Failed to generate audio for word: ${word.word}`,
              error,
            );
            word.audioUrl = '';
            word.imageUrl = '';
          }
        }

        return {
          type: ActivityType.VOCAB,
          title: `Vocabulary: ${lessonTitle}`,
          content: { items: words },
          difficulty,
          points: words.length * 10,
          orderNo,
          instructions: userPrompt || `Learn ${words.length} vocabulary words related to ${lessonTitle}`,
        };
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          this.logger.warn(`Retry ${attempt + 1}/${MAX_RETRIES} for vocab activity due to JSON error`);
          continue;
        }
        this.logger.error('Failed to generate vocab activity:', error);
        throw error;
      }
    }
    // Fallback - should never reach here
    throw new Error('Failed to generate vocab activity after retries');
  }

  private async generateQuizActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a multiple-choice quiz with 5 questions.

Requirements for each question:
1. question (string): Clear question text
2. options (array of 4 strings): Four answer options
3. correctIndex (number): Index of correct answer (0-3)
4. explanation (string): Brief explanation of the correct answer

Return JSON array format:
[
  {
    "question": "What is the past tense of 'go'?",
    "options": ["goed", "went", "gone", "going"],
    "correctIndex": 1,
    "explanation": "The past tense of 'go' is 'went'. It's an irregular verb."
  }
]

Generate the quiz questions now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const questions = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.QUIZ,
        title: `Quiz: ${lessonTitle}`,
        content: { questions },
        difficulty,
        points: questions.length * 20,
        orderNo,
        passingScore: 60,
        instructions: userPrompt || `Complete this ${questions.length}-question quiz about ${lessonTitle}`,
      };
    } catch (error) {
      this.logger.error('Failed to generate quiz activity:', error);
      throw error;
    }
  }

  private async generateListeningActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a listening comprehension activity with a dialogue and questions.

Requirements:
1. dialogue (string): A natural conversation or monologue (50-100 words)
2. questions (array): 3-4 multiple-choice comprehension questions
   - question (string)
   - options (array of 4 strings)
   - correctIndex (number)

Return JSON format:
{
  "dialogue": "Hello! My name is Sarah. I'm from New York, and I'm a teacher. I love working with children...",
  "questions": [
    {
      "question": "What is Sarah's profession?",
      "options": ["Doctor", "Teacher", "Engineer", "Student"],
      "correctIndex": 1
    }
  ]
}

Generate the listening activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      // Generate audio for the dialogue
      let audioUrl = '';
      try {
        const result = await this.googleTranslateService.createAudioWithUrl(
          data.dialogue,
          'en',
        )
        audioUrl = result.url
        this.logger.log('🎵 Generated audio for listening dialogue');
      } catch (error) {
        this.logger.warn('Failed to generate dialogue audio', error);
      }

      return {
        type: ActivityType.LISTENING,
        title: `Listening: ${lessonTitle}`,
        content: {
          audioUrl,
          questions: data.questions,
        },
        difficulty,
        points: data.questions.length * 20,
        orderNo,
        passingScore: 60,
        instructions: userPrompt || `Listen to the audio and answer ${data.questions.length} questions`,
      };
    } catch (error) {
      this.logger.error('Failed to generate listening activity:', error);
      throw error;
    }
  }

  private async generateSpeakingActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a speaking activity with a prompt and tips.

Requirements:
1. prompt (string): Clear speaking prompt/question
2. minSeconds (number): Minimum speaking time (15-60 seconds)
3. tips (array of strings): 3-5 helpful tips for speaking

Return JSON format:
{
  "prompt": "Introduce yourself to a new classmate. Tell them about your hobbies and interests.",
  "minSeconds": 30,
  "tips": [
    "Speak clearly and at a natural pace",
    "Use complete sentences",
    "Include specific examples"
  ]
}

Generate the speaking activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.SPEAKING,
        title: `Speaking: ${lessonTitle}`,
        content: data,
        difficulty,
        points: 50,
        orderNo,
        instructions: userPrompt || `Record yourself speaking for at least ${data.minSeconds} seconds`,
      };
    } catch (error) {
      this.logger.error('Failed to generate speaking activity:', error);
      throw error;
    }
  }

  private async generateReadingActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a reading comprehension activity with a passage and questions.

Requirements:
1. passage (string): An engaging text (150-250 words)
2. questions (array): 4-5 comprehension questions
   - question (string)
   - options (array of 4 strings)
   - correctIndex (number)

Return JSON format:
{
  "passage": "The English language has over 170,000 words in current use...",
  "questions": [
    {
      "question": "How many words are currently used in English?",
      "options": ["Over 100,000", "Over 170,000", "Over 200,000", "Over 50,000"],
      "correctIndex": 1
    }
  ]
}

Generate the reading activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.READING,
        title: `Reading: ${lessonTitle}`,
        content: data,
        difficulty,
        points: data.questions.length * 20,
        orderNo,
        passingScore: 60,
        instructions: userPrompt || `Read the passage and answer ${data.questions.length} questions`,
      };
    } catch (error) {
      this.logger.error('Failed to generate reading activity:', error);
      throw error;
    }
  }

  private async generateWritingActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a writing activity with a prompt and rubric.

Requirements:
1. prompt (string): Clear writing prompt
2. minWords (number): Minimum word count (50-200)
3. rubric (array of strings): 4-5 grading criteria

Return JSON format:
{
  "prompt": "Write a paragraph describing your daily routine. Include specific times and activities.",
  "minWords": 100,
  "rubric": [
    "Grammar and punctuation",
    "Vocabulary usage",
    "Organization and coherence",
    "Content relevance"
  ]
}

Generate the writing activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.WRITING,
        title: `Writing: ${lessonTitle}`,
        content: data,
        difficulty,
        points: 100,
        orderNo,
        instructions: userPrompt || `Write at least ${data.minWords} words about the topic`,
      };
    } catch (error) {
      this.logger.error('Failed to generate writing activity:', error);
      throw error;
    }
  }

  private async generatePronunciationActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a pronunciation practice activity.

Requirements:
1. phrases (array): 1-3 phrases to practice, each with:
   - text (string): Target phrase/sentence to practice
2. tips (array of strings): 3-5 pronunciation tips
3. phonetics (string): IPA phonetic notation for the first phrase

Return JSON format:
{
  "phrases": [
    { "text": "The weather is beautiful today" }
  ],
  "tips": [
    "Pay attention to the 'th' sound in 'the' and 'weather'",
    "Stress the word 'beautiful'",
    "Use rising intonation at the end"
  ],
  "phonetics": "/ðə ˈwɛðər ɪz ˈbjutəfəl təˈdeɪ/"
}

Generate the pronunciation activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      // Ensure phrases is an array
      let phrases = data.phrases;
      if (!Array.isArray(phrases)) {
        // Convert single phrase format to array format
        phrases = [{ text: data.phrase || '' }];
      }

      // Generate sample audio for each phrase
      for (const phrase of phrases) {
        try {
          const result = await this.googleTranslateService.createAudioWithUrl(
            phrase.text,
            'en',
          );
          phrase.sampleUrl = result.url;
          this.logger.log(`🎵 Generated sample audio for phrase: ${phrase.text.substring(0, 30)}...`);
        } catch (error) {
          this.logger.warn(`Failed to generate sample audio for phrase`, error);
          phrase.sampleUrl = '';
        }
      }

      return {
        type: ActivityType.PRONUNCIATION,
        title: `Pronunciation: ${lessonTitle}`,
        content: {
          phrases,
          tips: data.tips || [],
          phonetics: data.phonetics || '',
        },
        difficulty,
        points: phrases.length * 30,
        orderNo,
        instructions: userPrompt || 'Practice pronouncing the phrase correctly',
      };
    } catch (error) {
      this.logger.error('Failed to generate pronunciation activity:', error);
      throw error;
    }
  }

  private async generateFillBlankActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a fill-in-the-blank activity.

Requirements:
1. passage (string): Text with blanks marked as [____]
2. blanks (array of strings): Correct answers in order

Return JSON format:
{
  "passage": "The [____] is a very important part of English grammar. It helps us understand the [____] of a sentence.",
  "blanks": ["subject", "structure"]
}

Generate the fill-blank activity now with 5-8 blanks:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.FILL_BLANK,
        title: `Fill in the Blanks: ${lessonTitle}`,
        content: data,
        difficulty,
        points: data.blanks.length * 10,
        orderNo,
        passingScore: 70,
        instructions: userPrompt || `Complete the passage by filling in ${data.blanks.length} blanks`,
      };
    } catch (error) {
      this.logger.error('Failed to generate fill-blank activity:', error);
      throw error;
    }
  }

  private async generateDictationActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a dictation activity.

Requirements:
1. transcript (string): Sentence or paragraph to dictate (30-80 words)
2. minWords (number): Minimum words expected (usually same as transcript word count)

Return JSON format:
{
  "transcript": "English is spoken by millions of people around the world. It is considered the international language of business and communication.",
  "minWords": 20
}

Generate the dictation activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      // Generate audio for dictation
      let audioUrl = '';
      try {
        const result = await this.googleTranslateService.createAudioWithUrl(
          data.transcript,
          'en',
        );
        audioUrl = result.url;
        this.logger.log('🎵 Generated dictation audio');
      } catch (error) {
        this.logger.warn('Failed to generate dictation audio', error);
      }

      return {
        type: ActivityType.DICTATION,
        title: `Dictation: ${lessonTitle}`,
        content: { ...data, audioUrl },
        difficulty,
        points: 50,
        orderNo,
        passingScore: 80,
        instructions: userPrompt || 'Listen and write exactly what you hear',
      };
    } catch (error) {
      this.logger.error('Failed to generate dictation activity:', error);
      throw error;
    }
  }

  private async generateMatchingActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a matching activity.

Requirements:
1. leftItems (array of strings): 6-8 items on the left side
2. rightItems (array of strings): Corresponding matches on the right side (same order)

Return JSON format:
{
  "leftItems": ["Hello", "Goodbye", "Thank you"],
  "rightItems": ["Xin chào", "Tạm biệt", "Cảm ơn"]
}

Generate the matching activity now with 6-8 pairs:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.MATCHING,
        title: `Matching: ${lessonTitle}`,
        content: data,
        difficulty,
        points: data.leftItems.length * 10,
        orderNo,
        passingScore: 70,
        instructions: userPrompt || `Match ${data.leftItems.length} pairs correctly`,
      };
    } catch (error) {
      this.logger.error('Failed to generate matching activity:', error);
      throw error;
    }
  }

  private async generateMiniGameActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a mini-game activity (word scramble/unscramble).

Requirements:
1. target (string): Target word or phrase
2. pool (array of strings): Scrambled letters or words
3. rounds (number): Number of attempts allowed (3-5)

Return JSON format:
{
  "target": "hello",
  "pool": ["h", "e", "l", "l", "o"],
  "rounds": 3
}

Generate the mini-game activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.MINI_GAME,
        title: `Mini Game: ${lessonTitle}`,
        content: data,
        difficulty,
        points: 40,
        orderNo,
        instructions: userPrompt || `Unscramble the letters to form the correct word`,
      };
    } catch (error) {
      this.logger.error('Failed to generate mini-game activity:', error);
      throw error;
    }
  }

  private async generateGrammarActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a grammar practice activity.

Requirements:
1. rule (string): Grammar rule explanation
2. exercises (array): 5-6 practice questions
   - question (string)
   - options (array of 3-4 strings)
   - correctIndex (number)

Return JSON format:
{
  "rule": "The present simple tense is used for habits and general truths. Add -s/-es to verbs with he/she/it.",
  "exercises": [
    {
      "question": "She ___ to school every day.",
      "options": ["go", "goes", "going", "gone"],
      "correctIndex": 1
    }
  ]
}

Generate the grammar activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.GRAMMAR,
        title: `Grammar: ${lessonTitle}`,
        content: data,
        difficulty,
        points: data.exercises.length * 15,
        orderNo,
        passingScore: 70,
        instructions: userPrompt || `Practice grammar with ${data.exercises.length} exercises`,
      };
    } catch (error) {
      this.logger.error('Failed to generate grammar activity:', error);
      throw error;
    }
  }

  private async generateFlashcardActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a flashcard set.

Requirements:
1. cards (array): 8-12 flashcards
   - front (string): Question or term
   - back (string): Answer or definition

Return JSON format:
{
  "cards": [
    {
      "front": "What is the capital of England?",
      "back": "London",
      "imageUrl": ""
    }
  ]
}

Generate the flashcard activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      // Ensure imageUrl is empty for auto-generated flashcards
      data.cards.forEach((card: any) => {
        if (!card.imageUrl) card.imageUrl = '';
      });

      return {
        type: ActivityType.FLASHCARD,
        title: `Flashcards: ${lessonTitle}`,
        content: data,
        difficulty,
        points: data.cards.length * 5,
        orderNo,
        instructions: userPrompt || `Study ${data.cards.length} flashcards`,
      };
    } catch (error) {
      this.logger.error('Failed to generate flashcard activity:', error);
      throw error;
    }
  }

  private async generateConversationActivity(
    courseTitle: string,
    courseDescription: string | undefined,
    lessonTitle: string,
    lessonDescription: string | undefined,
    userPrompt: string | undefined,
    difficulty: DifficultyLevel,
    orderNo: number,
  ): Promise<GeneratedActivity> {
    const contextPrompt = this.buildContextPrompt(
      courseTitle,
      courseDescription,
      lessonTitle,
      lessonDescription,
      userPrompt,
      difficulty,
    );

    const prompt = `${contextPrompt}

Task: Generate a conversation practice activity.

Requirements:
1. scenario (string): Conversation scenario description
2. initialDialog (array): 2-3 opening messages
   - role (string): "assistant" or "user"
   - text (string): Message content
3. suggestions (array of strings): 4-6 suggested responses

Return JSON format:
{
  "scenario": "You are at a restaurant ordering food",
  "initialDialog": [
    {"role": "assistant", "text": "Good evening! Welcome to our restaurant. Here's the menu."},
    {"role": "user", "text": "Thank you. What do you recommend?"}
  ],
  "suggestions": [
    "I'd like the grilled salmon, please",
    "What's the soup of the day?",
    "Could I see the dessert menu?"
  ]
}

Generate the conversation activity now:`;

    try {
      const response = await this.geminiService.generateResponse(prompt);
      const cleanedResponse = this.cleanJsonResponse(response);
      const data = JSON.parse(cleanedResponse);

      return {
        type: ActivityType.CONVERSATION,
        title: `Conversation: ${lessonTitle}`,
        content: data,
        difficulty,
        points: 60,
        orderNo,
        instructions: userPrompt || 'Practice a conversation based on the scenario',
      };
    } catch (error) {
      this.logger.error('Failed to generate conversation activity:', error);
      throw error;
    }
  }

  private cleanJsonResponse(response: string): string {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    cleaned = cleaned.trim();

    // Check if JSON is valid, if not try to repair
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      // Try to repair truncated/malformed JSON
      cleaned = this.attemptJsonRepair(cleaned);
    }

    return cleaned;
  }

  /**
   * Attempt to repair common JSON issues from truncated AI responses
   */
  private attemptJsonRepair(json: string): string {
    let repaired = json;

    // Count open/close brackets and braces
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;

    // Fix unterminated string - if odd number of unescaped quotes
    const unescapedQuotes = repaired.match(/(?<!\\)"/g) || [];
    if (unescapedQuotes.length % 2 !== 0) {
      // Find last meaningful content and close the string
      const lastQuoteIndex = repaired.lastIndexOf('"');
      if (lastQuoteIndex > 0) {
        repaired = repaired.substring(0, lastQuoteIndex + 1);
      }
    }

    // Remove trailing incomplete content after last complete element
    // Look for patterns like: ,"incomplete or ,{ incomplete
    repaired = repaired.replace(/,\s*"[^"]*$/g, '');
    repaired = repaired.replace(/,\s*\{[^}]*$/g, '');

    // Close unclosed braces first, then brackets
    const newOpenBraces = (repaired.match(/\{/g) || []).length;
    const newCloseBraces = (repaired.match(/\}/g) || []).length;
    for (let i = 0; i < newOpenBraces - newCloseBraces; i++) {
      repaired += '}';
    }

    const newOpenBrackets = (repaired.match(/\[/g) || []).length;
    const newCloseBrackets = (repaired.match(/\]/g) || []).length;
    for (let i = 0; i < newOpenBrackets - newCloseBrackets; i++) {
      repaired += ']';
    }

    // Remove trailing comma before closing bracket/brace
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    this.logger.warn(`Attempted JSON repair: ${openBrackets}[ ${closeBrackets}] ${openBraces}{ ${closeBraces}} -> repaired`);

    return repaired;
  }
}
