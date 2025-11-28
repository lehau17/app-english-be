import { BadRequestException, Injectable } from '@nestjs/common';
import { DifficultyLevel } from '@prisma/client';
import * as XLSX from 'xlsx';
import { ACTIVITY_TYPES } from '../../course/dto';
import {
  ImportAssignmentResult,
  ImportedActivity,
} from '../dto/import-assignment.dto';

@Injectable()
export class AssignmentImportService {
  /**
   * Generate Excel template for assignment import with ALL activity type examples
   */
  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    // Assignment Info Sheet
    const assignmentInfoData = [
      ['Field', 'Value', 'Description', 'Required'],
      [
        'title',
        'Complete English Practice Assignment',
        'Assignment title',
        'Yes',
      ],
      [
        'description',
        'This assignment covers all activity types with sample questions',
        'Assignment description',
        'No',
      ],
      [
        'instructions',
        'Please complete all activities. Take your time and read carefully.',
        'General instructions',
        'No',
      ],
      ['dueDate', '2024-12-31T17:00:00Z', 'Due date (ISO format)', 'No'],
      ['totalPoints', '200', 'Total points possible', 'No'],
      ['timeLimit', '90', 'Time limit in minutes', 'No'],
      ['maxAttempts', '3', 'Maximum attempts allowed', 'No'],
      ['isPublished', 'false', 'Publish immediately (true/false)', 'No'],
      [
        'type',
        'HOMEWORK',
        'Assignment type (HOMEWORK, QUIZ, MIDTERM_EXAM, FINAL_EXAM)',
        'No',
      ],
      [
        'weight',
        '0.5',
        'Weight for final grade calculation (0-1, e.g., 0.5 for 50%)',
        'No',
      ],
      [
        'assignedTo',
        '',
        'Student IDs (comma-separated, leave empty to assign to all)',
        'No',
      ],
    ];

    const assignmentInfoWs = XLSX.utils.aoa_to_sheet(assignmentInfoData);
    XLSX.utils.book_append_sheet(wb, assignmentInfoWs, 'Assignment Info');

    // Activities Sheet with ALL activity types
    const activitiesData = [
      [
        'type',
        'title',
        'instructions',
        'question',
        'option1',
        'option2',
        'option3',
        'option4',
        'correctIndex',
        'audioUrl',
        'passage',
        'phrase',
        'prompt',
        'word',
        'definition',
        'points',
        'timeLimit',
        'maxAttempts',
        'passingScore',
        'difficulty',
        'hints',
      ],
      // 1. Quiz Activity
      [
        'quiz',
        'Grammar Quiz - Present Simple',
        'Choose the correct verb form',
        'She _____ to school every day.',
        'go',
        'goes',
        'going',
        'gone',
        '1',
        '',
        '',
        '',
        '',
        '',
        '',
        '10',
        '3',
        '1',
        '70',
        'BEGINNER',
        'Think about third person singular;Look at the subject "She"',
      ],
      // 2. Quiz Activity 2
      [
        'quiz',
        'Vocabulary Quiz',
        'Select the best synonym',
        'What is another word for "happy"?',
        'Sad',
        'Joyful',
        'Angry',
        'Tired',
        '1',
        '',
        '',
        '',
        '',
        '',
        '',
        '10',
        '2',
        '1',
        '60',
        'BEGINNER',
        'Think about emotions;Joyful means feeling pleasure',
      ],
      // 3. Reading Activity
      [
        'reading',
        'Reading Comprehension - Camels',
        'Read the passage and answer the questions',
        'What do camel humps store?',
        'Water',
        'Fat',
        'Food',
        'Sand',
        '1',
        '',
        'Camels are amazing desert animals. They can survive for weeks without water. Their humps store fat, not water. Camels have two rows of eyelashes to protect their eyes from sand.',
        '',
        '',
        '',
        '',
        '15',
        '5',
        '1',
        '80',
        'INTERMEDIATE',
        'Look for the word "humps" in the passage;Read carefully about what humps contain',
      ],
      // 4. Reading Activity - Question 2
      [
        'reading',
        'Reading Comprehension - Camels',
        'Read the passage and answer',
        'How many rows of eyelashes do camels have?',
        'One',
        'Two',
        'Three',
        'Four',
        '1',
        '',
        'Camels are amazing desert animals. They can survive for weeks without water. Their humps store fat, not water. Camels have two rows of eyelashes to protect their eyes from sand.',
        '',
        '',
        '',
        '',
        '15',
        '5',
        '1',
        '80',
        'INTERMEDIATE',
        'Find the sentence about eyelashes;Count the number mentioned',
      ],
      // 5. Listening Activity
      [
        'listening',
        'Listening Practice - Greetings',
        'Listen to the audio and answer',
        'What greeting did you hear?',
        'Hello',
        'Goodbye',
        'Thank you',
        'Sorry',
        '0',
        'https://example.com/audio/hello.mp3',
        '',
        '',
        '',
        '',
        '',
        '15',
        '5',
        '2',
        '75',
        'BEGINNER',
        'Listen for the first word;Pay attention to the tone',
      ],
      // 6. Listening Activity - Question 2
      [
        'listening',
        'Listening Practice - Greetings',
        'Listen and choose',
        "What is the speaker's tone?",
        'Happy',
        'Sad',
        'Angry',
        'Nervous',
        '0',
        'https://example.com/audio/hello.mp3',
        '',
        '',
        '',
        '',
        '',
        '15',
        '5',
        '2',
        '75',
        'BEGINNER',
        'Focus on voice expression;Friendly tone = happy',
      ],
      // 7. Grammar Activity
      [
        'grammar',
        'Past Tense Exercise',
        'Choose the correct past tense form',
        'Yesterday, I _____ to the park.',
        'go',
        'goes',
        'went',
        'going',
        '2',
        '',
        '',
        '',
        '',
        '',
        '',
        '10',
        '3',
        '1',
        '70',
        'INTERMEDIATE',
        'Look for the time word "Yesterday";Use simple past tense',
      ],
      // 8. Pronunciation Activity
      [
        'pronunciation',
        'Pronunciation Practice - TH sound',
        'Practice pronouncing these phrases',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Think about it',
        '',
        '',
        '',
        '10',
        '5',
        '3',
        '60',
        'BEGINNER',
        'Put tongue between teeth;Practice slowly first',
      ],
      // 9. Pronunciation Activity - Phrase 2
      [
        'pronunciation',
        'Pronunciation Practice - TH sound',
        'Practice pronouncing these phrases',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Thank you',
        '',
        '',
        '',
        '10',
        '5',
        '3',
        '60',
        'BEGINNER',
        'Breathe out while saying TH;Listen to native speakers',
      ],
      // 10. Vocabulary Activity
      [
        'vocab',
        'Daily Vocabulary',
        'Learn these common words',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'apple',
        'A round fruit that is typically red, green, or yellow',
        '10',
        '',
        '1',
        '',
        'BEGINNER',
        'Think about fruits;Common in supermarkets',
      ],
      // 11. Vocabulary Activity - Word 2
      [
        'vocab',
        'Daily Vocabulary',
        'Learn these words',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'happy',
        'Feeling or showing pleasure or contentment',
        '10',
        '',
        '1',
        '',
        'BEGINNER',
        'Emotion word;Opposite of sad',
      ],
      // 12. Speaking Activity
      [
        'speaking',
        'Describe Your Day',
        'Speak for at least 30 seconds',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Describe what you did today. Talk about your morning, afternoon, and evening activities.',
        '',
        '',
        '15',
        '5',
        '2',
        '70',
        'INTERMEDIATE',
        'Use past tense verbs;Mention specific times;Talk about 3-4 activities',
      ],
      // 13. Writing Activity
      [
        'writing',
        'Write About Your Hobby',
        'Write at least 100 words',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Write a paragraph about your favorite hobby. Explain what it is, why you like it, and how often you do it.',
        '',
        '',
        '20',
        '15',
        '1',
        '75',
        'INTERMEDIATE',
        'Use complete sentences;Include examples;Check spelling and grammar',
      ],
      // 14. Flashcard Activity
      [
        'flashcard',
        'Common Phrases Flashcards',
        'Review these common English phrases',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'How are you?',
        "A greeting asking about someone's wellbeing",
        '5',
        '',
        '1',
        '',
        'BEGINNER',
        'Common greeting;Expected response: "I\'m fine, thank you"',
      ],
      // 15. Conversation Activity
      [
        'conversation',
        'Restaurant Conversation',
        'Practice ordering food',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'You are at a restaurant. Practice ordering food from the menu.',
        '',
        '',
        '15',
        '10',
        '2',
        '70',
        'INTERMEDIATE',
        'Be polite;Use "I would like...";Ask about recommendations',
      ],
      // 16. Mini Game Activity
      [
        'mini_game',
        'Word Matching Game',
        'Match words with their opposites',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Match these words with their opposites: hot, big, fast, happy',
        '',
        '',
        '10',
        '5',
        '3',
        '80',
        'BEGINNER',
        'Think about opposites;Hot opposite is cold',
      ],
      // 17. Fill Blank Activity
      [
        'fill_blank',
        'Complete the Sentences',
        'Fill in the missing words',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'The quick brown fox [____] over the lazy dog. The sun [____] in the east every morning.',
        '',
        '',
        '15',
        '5',
        '2',
        '70',
        'INTERMEDIATE',
        'First blank needs a verb of movement;Second blank needs present simple',
      ],
      // 18. Dictation Activity
      [
        'dictation',
        'Dictation Exercise',
        'Listen and write what you hear',
        '',
        '',
        '',
        '',
        '',
        '',
        'https://example.com/audio/dictation.mp3',
        '',
        '',
        '',
        '',
        '',
        '20',
        '10',
        '2',
        '80',
        'INTERMEDIATE',
        'Listen multiple times;Write what you hear;Check spelling',
      ],
      // 19. Matching Activity
      [
        'matching',
        'Match Words to Definitions',
        'Match each word with its correct meaning',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'Match: Cat, Dog, Bird with their descriptions',
        '',
        '',
        '10',
        '5',
        '2',
        '70',
        'BEGINNER',
        'Think about animal characteristics;Read all options first',
      ],
    ];

    const activitiesWs = XLSX.utils.aoa_to_sheet(activitiesData);

    // Set column widths for better readability
    activitiesWs['!cols'] = [
      { wch: 12 }, // type
      { wch: 30 }, // title
      { wch: 40 }, // instructions
      { wch: 50 }, // question
      { wch: 20 }, // option1
      { wch: 20 }, // option2
      { wch: 20 }, // option3
      { wch: 20 }, // option4
      { wch: 12 }, // correctIndex
      { wch: 40 }, // audioUrl
      { wch: 60 }, // passage
      { wch: 25 }, // phrase
      { wch: 60 }, // prompt
      { wch: 20 }, // word
      { wch: 50 }, // definition
      { wch: 8 }, // points
      { wch: 10 }, // timeLimit
      { wch: 12 }, // maxAttempts
      { wch: 12 }, // passingScore
      { wch: 12 }, // difficulty
      { wch: 60 }, // hints
    ];

    XLSX.utils.book_append_sheet(wb, activitiesWs, 'Activities');

    // Instructions Sheet
    const instructionsData = [
      ['🎓 ASSIGNMENT IMPORT TEMPLATE - COMPLETE GUIDE'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['1️⃣  ASSIGNMENT INFO SHEET'],
      ['═══════════════════════════════════════════════════════════════'],
      ['   Fill in the assignment details in the "Value" column'],
      ['    Only "title" is REQUIRED, other fields are optional'],
      ['   📅 Date format: ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)'],
      [
        '   type: HOMEWORK, QUIZ, MIDTERM_EXAM, FINAL_EXAM (default: HOMEWORK)',
      ],
      ['   ⚖️  weight: 0-100 for final grade calculation (default: 0)'],
      [
        '   👥 assignedTo: comma-separated student IDs (leave empty for all students)',
      ],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['2️⃣  ACTIVITIES SHEET - ALL TYPES INCLUDED!'],
      ['═══════════════════════════════════════════════════════════════'],
      ['   Template includes 19 sample activities covering ALL types'],
      [
        '   Each row = one activity (or one question for multi-question types)',
      ],
      ['   🗑️  Delete sample rows and add your own, or modify the samples'],
      ['   📌 Required fields vary by activity type (see below)'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['3️⃣  ACTIVITY TYPES & REQUIRED FIELDS'],
      ['═══════════════════════════════════════════════════════════════'],
      [''],
      ['   QUIZ (Single-choice question)'],
      ['      Required: type, title, question, option1-4, correctIndex'],
      ['      Example: "She _____ to school" with 4 options, correctIndex=1'],
      [''],
      ['   📖 READING (Comprehension with multiple questions)'],
      [
        '      Required: type, title, passage, question, option1-4, correctIndex',
      ],
      ['      Note: Use same passage for multiple questions (different rows)'],
      [
        '      Example: Camel passage with 2 questions about humps and eyelashes',
      ],
      [''],
      ['   🎧 LISTENING (Audio with multiple questions)'],
      [
        '      Required: type, title, audioUrl, question, option1-4, correctIndex',
      ],
      ['      Note: Use same audioUrl for multiple questions (different rows)'],
      ['      Example: Greeting audio with 2 questions about content and tone'],
      [''],
      ['   GRAMMAR (Grammar exercise)'],
      ['      Required: type, title, question, option1-4, correctIndex'],
      ['      Example: "Yesterday I _____ to the park" - past tense'],
      [''],
      ['    PRONUNCIATION (Phrases to practice, multiple allowed)'],
      ['      Required: type, title, phrase'],
      ['      Note: Add multiple rows with same title for multiple phrases'],
      ['      Example: "Think about it", "Thank you" (2 rows for TH sound)'],
      [''],
      ['   VOCAB (Vocabulary words, multiple allowed)'],
      ['      Required: type, title, word, definition'],
      ['      Note: Add multiple rows for multiple words'],
      ['      Example: apple, happy (2 rows for daily vocabulary)'],
      [''],
      ['   💬 SPEAKING (Speaking prompt)'],
      ['      Required: type, title, prompt'],
      ['      Example: "Describe what you did today..."'],
      [''],
      ['   ✍️ WRITING (Writing prompt)'],
      ['      Required: type, title, prompt'],
      ['      Example: "Write a paragraph about your favorite hobby..."'],
      [''],
      ['   🃏 FLASHCARD (Study cards)'],
      ['      Required: type, title, word (front), definition (back)'],
      ['      Example: "How are you?" → "A greeting asking about wellbeing"'],
      [''],
      ['   🎭 CONVERSATION (Dialogue practice)'],
      ['      Required: type, title, prompt'],
      ['      Example: "You are at a restaurant. Practice ordering food."'],
      [''],
      ['   🎮 MINI_GAME (Interactive game)'],
      ['      Required: type, title, prompt'],
      ['      Example: "Match words with their opposites"'],
      [''],
      ['   📄 FILL_BLANK (Fill in the blanks)'],
      ['      Required: type, title, prompt (with [____] markers)'],
      ['      Example: "The quick brown fox [____] over the lazy dog"'],
      [''],
      ['   🎙️ DICTATION (Listen and type)'],
      ['      Required: type, title, audioUrl'],
      ['      Example: Audio file with transcript for checking'],
      [''],
      ['   🔗 MATCHING (Match pairs)'],
      ['      Required: type, title, prompt'],
      ['      Example: "Match: Cat, Dog, Bird with their descriptions"'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['4️⃣  OPTIONAL FIELDS (ALL ACTIVITY TYPES)'],
      ['═══════════════════════════════════════════════════════════════'],
      ['   points: Activity points (default: 10)'],
      ['    timeLimit: Time limit in minutes'],
      ['   🔁 maxAttempts: Max attempts allowed (default: 1)'],
      ['   passingScore: Minimum score to pass (0-100)'],
      ['   difficulty: BEGINNER, INTERMEDIATE, or ADVANCED'],
      ['   hints: Multiple hints separated by semicolons (;)'],
      ['      Example: "Think about grammar;Use past tense;Check subject"'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['5️⃣  MULTI-QUESTION/MULTI-ITEM ACTIVITIES'],
      ['═══════════════════════════════════════════════════════════════'],
      [
        '   📖 READING: Add multiple rows with SAME passage, different questions',
      ],
      [
        '   🎧 LISTENING: Add multiple rows with SAME audioUrl, different questions',
      ],
      [
        '    PRONUNCIATION: Add multiple rows with SAME title, different phrases',
      ],
      ['   VOCAB: Add multiple rows with SAME title, different words'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['6️⃣  VALIDATION RULES'],
      ['═══════════════════════════════════════════════════════════════'],
      [
        '   correctIndex: Must be 0-3 (0=option1, 1=option2, 2=option3, 3=option4)',
      ],
      ['   At least 2 options required for quiz/reading/grammar/listening'],
      ['   audioUrl must be valid URL for listening/dictation'],
      ['   Type must be one of the supported types listed above'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['7️⃣  FINAL STEPS'],
      ['═══════════════════════════════════════════════════════════════'],
      ['   1. Review all sample activities to understand each type'],
      ['   2. Modify samples or delete and add your own'],
      ['   3. Save file as .xlsx format'],
      ['   4. Upload through the import interface'],
      ['   5. Review preview for any errors'],
      ['   6. Confirm import to create assignment'],
      [''],
      ['═══════════════════════════════════════════════════════════════'],
      ['NEED HELP?'],
      ['═══════════════════════════════════════════════════════════════'],
      ['   • Check the Activities sheet for working examples of each type'],
      ['   • All 19 sample activities are ready to use or modify'],
      ['   • Make sure required fields are filled for your activity type'],
      ['   • Use hints field to help students with difficult questions'],
      [''],
      ['✨ Happy Teaching! ✨'],
    ];

    const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
    instructionsWs['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Parse uploaded Excel file and extract assignment data
   */
  async parseImportFile(buffer: Buffer): Promise<ImportAssignmentResult> {
    try {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const result: ImportAssignmentResult = {
        assignment: { title: '' },
        activities: [],
        errors: [],
        warnings: [],
      };

      // Parse Assignment Info
      if (wb.SheetNames.includes('Assignment Info')) {
        try {
          const assignmentData = this.parseAssignmentInfo(
            wb.Sheets['Assignment Info'],
          );
          result.assignment = assignmentData;
        } catch (error) {
          result.errors.push(`Assignment Info parsing error: ${error.message}`);
        }
      } else {
        result.errors.push('Missing "Assignment Info" sheet');
      }

      // Parse Activities
      if (wb.SheetNames.includes('Activities')) {
        try {
          const activitiesData = this.parseActivities(wb.Sheets['Activities']);
          result.activities = activitiesData.activities;
          result.errors.push(...activitiesData.errors);
          result.warnings.push(...activitiesData.warnings);
        } catch (error) {
          result.errors.push(`Activities parsing error: ${error.message}`);
        }
      } else {
        result.errors.push('Missing "Activities" sheet');
      }

      return result;
    } catch (error) {
      throw new BadRequestException(
        `Failed to parse Excel file: ${error.message}`,
      );
    }
  }

  private parseAssignmentInfo(sheet: XLSX.WorkSheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const assignment: any = {};

    // Skip header row, process data rows
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.length >= 2) {
        const field = row[0]?.toString().trim();
        const value = row[1]?.toString().trim();

        if (field && value) {
          switch (field) {
            case 'title':
              assignment.title = value;
              break;
            case 'description':
              assignment.description = value;
              break;
            case 'instructions':
              assignment.instructions = value;
              break;
            case 'dueDate':
              assignment.dueDate = value;
              break;
            case 'totalPoints':
              assignment.totalPoints = parseInt(value) || 100;
              break;
            case 'timeLimit':
              assignment.timeLimit = parseInt(value);
              break;
            case 'maxAttempts':
              assignment.maxAttempts = parseInt(value) || 1;
              break;
            case 'isPublished':
              assignment.isPublished = value.toLowerCase() === 'true';
              break;
            case 'type':
              assignment.type = value as any;
              break;
            case 'weight':
              assignment.weight = parseFloat(value) || 0;
              break;
            case 'assignedTo':
              assignment.assignedTo = value
                .split(',')
                .map((id) => id.trim())
                .filter((id) => id);
              break;
          }
        }
      }
    }

    if (!assignment.title) {
      throw new Error('Assignment title is required');
    }

    return assignment;
  }

  private parseActivities(sheet: XLSX.WorkSheet) {
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const activities: ImportedActivity[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.length < 2) {
      throw new Error(
        'Activities sheet must have at least a header row and one data row',
      );
    }

    const headers = data[0] as string[];
    const headerMap = this.createHeaderMap(headers);

    // Group rows by activity type and title/key for multi-row activities
    const activityGroups = new Map<string, any[]>();

    // Process each data row and group them
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows

      const getValue = (field: string): string => {
        const index = headerMap.get(field.toLowerCase());
        return index !== undefined ? (row[index]?.toString() || '').trim() : '';
      };

      const type = getValue('type');
      const title = getValue('title');

      if (!type || !title) continue;

      // Create grouping key based on activity type
      let groupKey = `${type}:${title}`;

      // For listening, also group by audioUrl
      if (type === 'listening') {
        const audioUrl = getValue('audioUrl');
        groupKey = `${type}:${title}:${audioUrl}`;
      }

      // For reading, group by title and passage
      if (type === 'reading') {
        const passage = getValue('passage');
        groupKey = `${type}:${title}:${passage}`;
      }

      if (!activityGroups.has(groupKey)) {
        activityGroups.set(groupKey, []);
      }
      activityGroups.get(groupKey).push({ row, rowNumber: i + 1, getValue });
    }

    // Now process each group
    for (const [groupKey, rows] of activityGroups.entries()) {
      try {
        const firstRow = rows[0];
        const type = firstRow.getValue('type');

        let activity: ImportedActivity | null = null;

        // Handle multi-row activity types
        if (type === 'reading') {
          activity = this.parseReadingActivity(rows, headerMap);
        } else if (type === 'listening') {
          activity = this.parseListeningActivity(rows, headerMap);
        } else if (type === 'pronunciation') {
          activity = this.parsePronunciationActivity(rows, headerMap);
        } else if (type === 'vocab') {
          activity = this.parseVocabActivity(rows, headerMap);
        } else if (type === 'flashcard') {
          activity = this.parseFlashcardActivity(rows, headerMap);
        } else {
          // Single-row activities (quiz, grammar, speaking, writing, etc.)
          activity = this.parseActivityRow(
            firstRow.row,
            headerMap,
            firstRow.rowNumber,
          );
        }

        if (activity) {
          activities.push(activity);
        }
      } catch (error) {
        errors.push(`Activity group "${groupKey}": ${error.message}`);
      }
    }

    return { activities, errors, warnings };
  }

  private createHeaderMap(headers: string[]): Map<string, number> {
    const map = new Map<string, number>();
    headers.forEach((header, index) => {
      if (header) {
        map.set(header.toLowerCase().trim(), index);
      }
    });
    return map;
  }

  private parseActivityRow(
    row: any[],
    headerMap: Map<string, number>,
    rowNumber: number,
  ): ImportedActivity | null {
    const getValue = (field: string): string => {
      const index = headerMap.get(field.toLowerCase());
      return index !== undefined ? (row[index]?.toString() || '').trim() : '';
    };

    const type = getValue('type');
    const title = getValue('title');

    if (!type || !title) {
      throw new Error('Both type and title are required');
    }

    if (!ACTIVITY_TYPES.includes(type as any)) {
      throw new Error(
        `Invalid activity type: ${type}. Supported types: ${ACTIVITY_TYPES.join(', ')}`,
      );
    }

    const activity: ImportedActivity = {
      type,
      title,
      instructions: getValue('instructions') || undefined,
      content: {},
      points: parseInt(getValue('points')) || 10,
      timeLimit: parseInt(getValue('timeLimit')) || undefined,
      maxAttempts: parseInt(getValue('maxAttempts')) || undefined,
      passingScore: parseInt(getValue('passingScore')) || undefined,
      difficulty: this.parseDifficulty(getValue('difficulty')),
      hints: this.parseHints(getValue('hints')),
    };

    // Parse content based on activity type
    switch (type) {
      case 'quiz':
      case 'reading':
      case 'grammar':
        activity.content = this.parseQuizContent(getValue, rowNumber);
        break;
      case 'listening':
        activity.content = this.parseListeningContent(getValue, rowNumber);
        break;
      case 'vocab':
        activity.content = { items: [] }; // Placeholder
        break;
      case 'flashcard':
        activity.content = { cards: [] }; // Placeholder
        break;
      default:
        activity.content = { question: getValue('question') };
    }

    return activity;
  }

  private parseQuizContent(
    getValue: (field: string) => string,
    rowNumber: number,
  ) {
    const question = getValue('question');
    if (!question) {
      throw new Error(
        'Question is required for quiz/reading/grammar activities',
      );
    }

    const options = [
      getValue('option1'),
      getValue('option2'),
      getValue('option3'),
      getValue('option4'),
    ].filter((opt) => opt.length > 0);

    if (options.length < 2) {
      throw new Error('At least 2 options are required');
    }

    const correctIndex = parseInt(getValue('correctIndex'));
    if (
      isNaN(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      throw new Error(
        `correctIndex must be between 0 and ${options.length - 1}`,
      );
    }

    return {
      question,
      options,
      correctIndex,
    };
  }

  private parseListeningContent(
    getValue: (field: string) => string,
    rowNumber: number,
  ) {
    const audioUrl = getValue('audioUrl');
    const question = getValue('question');

    if (!audioUrl) {
      throw new Error('audioUrl is required for listening activities');
    }

    const options = [
      getValue('option1'),
      getValue('option2'),
      getValue('option3'),
      getValue('option4'),
    ].filter((opt) => opt.length > 0);

    if (options.length < 2) {
      throw new Error(
        'At least 2 options are required for listening activities',
      );
    }

    const correctIndex = parseInt(getValue('correctIndex'));
    if (
      isNaN(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= options.length
    ) {
      throw new Error(
        `correctIndex must be between 0 and ${options.length - 1}`,
      );
    }

    // Return new structure with questions array to match updated DTO
    return {
      audioUrl,
      questions: [
        {
          question:
            question ||
            getValue('prompt') ||
            'Listen and choose the correct answer',
          options,
          correctIndex,
        },
      ],
    };
  }

  private parseDifficulty(difficulty: string): DifficultyLevel | undefined {
    if (!difficulty) return undefined;

    const upper = difficulty.toUpperCase();
    if (Object.values(DifficultyLevel).includes(upper as DifficultyLevel)) {
      return upper as DifficultyLevel;
    }
    return undefined;
  }

  private parseHints(hintsString: string): string[] | undefined {
    if (!hintsString) return undefined;

    return hintsString
      .split(';')
      .map((hint) => hint.trim())
      .filter((hint) => hint.length > 0);
  }

  // Multi-row activity parsers

  private parseReadingActivity(
    rows: any[],
    headerMap: Map<string, number>,
  ): ImportedActivity | null {
    if (rows.length === 0) return null;

    const firstRow = rows[0];
    const getValue = firstRow.getValue;
    const type = getValue('type');
    const title = getValue('title');

    if (!type || !title) {
      throw new Error('Both type and title are required');
    }

    // Build questions array from all rows
    const questions = rows.map((rowData) => {
      const getVal = rowData.getValue;
      const question = getVal('question');

      if (!question) {
        throw new Error('Question is required for reading activities');
      }

      const options = [
        getVal('option1'),
        getVal('option2'),
        getVal('option3'),
        getVal('option4'),
      ].filter((opt) => opt.length > 0);

      if (options.length < 2) {
        throw new Error('At least 2 options are required');
      }

      const correctIndex = parseInt(getVal('correctIndex'));
      if (
        isNaN(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= options.length
      ) {
        throw new Error(
          `correctIndex must be between 0 and ${options.length - 1}`,
        );
      }

      return {
        question,
        options,
        correctIndex,
      };
    });

    const activity: ImportedActivity = {
      type,
      title,
      instructions: getValue('instructions') || undefined,
      content: {
        passage: getValue('passage') || undefined,
        questions,
      },
      points: parseInt(getValue('points')) || 10,
      timeLimit: parseInt(getValue('timeLimit')) || undefined,
      maxAttempts: parseInt(getValue('maxAttempts')) || undefined,
      passingScore: parseInt(getValue('passingScore')) || undefined,
      difficulty: this.parseDifficulty(getValue('difficulty')),
      hints: this.parseHints(getValue('hints')),
    };

    return activity;
  }

  private parseListeningActivity(
    rows: any[],
    headerMap: Map<string, number>,
  ): ImportedActivity | null {
    if (rows.length === 0) return null;

    const firstRow = rows[0];
    const getValue = firstRow.getValue;
    const type = getValue('type');
    const title = getValue('title');
    const audioUrl = getValue('audioUrl');

    if (!type || !title) {
      throw new Error('Both type and title are required');
    }

    if (!audioUrl) {
      throw new Error('audioUrl is required for listening activities');
    }

    // Build questions array from all rows
    const questions = rows.map((rowData) => {
      const getVal = rowData.getValue;
      const question = getVal('question');

      const options = [
        getVal('option1'),
        getVal('option2'),
        getVal('option3'),
        getVal('option4'),
      ].filter((opt) => opt.length > 0);

      if (options.length < 2) {
        throw new Error('At least 2 options are required for listening');
      }

      const correctIndex = parseInt(getVal('correctIndex'));
      if (
        isNaN(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= options.length
      ) {
        throw new Error(
          `correctIndex must be between 0 and ${options.length - 1}`,
        );
      }

      return {
        question: question || 'Listen and choose the correct answer',
        options,
        correctIndex,
      };
    });

    const activity: ImportedActivity = {
      type,
      title,
      instructions: getValue('instructions') || undefined,
      content: {
        audioUrl,
        questions,
      },
      points: parseInt(getValue('points')) || 10,
      timeLimit: parseInt(getValue('timeLimit')) || undefined,
      maxAttempts: parseInt(getValue('maxAttempts')) || undefined,
      passingScore: parseInt(getValue('passingScore')) || undefined,
      difficulty: this.parseDifficulty(getValue('difficulty')),
      hints: this.parseHints(getValue('hints')),
    };

    return activity;
  }

  private parsePronunciationActivity(
    rows: any[],
    headerMap: Map<string, number>,
  ): ImportedActivity | null {
    if (rows.length === 0) return null;

    const firstRow = rows[0];
    const getValue = firstRow.getValue;
    const type = getValue('type');
    const title = getValue('title');

    if (!type || !title) {
      throw new Error('Both type and title are required');
    }

    // Build phrases array from all rows
    const phrases = rows
      .map((rowData) => {
        const getVal = rowData.getValue;
        const phraseText = getVal('phrase');

        if (!phraseText || phraseText.length === 0) {
          return null;
        }

        return {
          text: phraseText,
          sampleUrl: getVal('audioUrl') || undefined,
        };
      })
      .filter((p) => p !== null);

    if (phrases.length === 0) {
      throw new Error(
        'At least one phrase is required for pronunciation activities',
      );
    }

    const activity: ImportedActivity = {
      type,
      title,
      instructions: getValue('instructions') || undefined,
      content: {
        phrases,
      },
      points: parseInt(getValue('points')) || 10,
      timeLimit: parseInt(getValue('timeLimit')) || undefined,
      maxAttempts: parseInt(getValue('maxAttempts')) || undefined,
      passingScore: parseInt(getValue('passingScore')) || undefined,
      difficulty: this.parseDifficulty(getValue('difficulty')),
      hints: this.parseHints(getValue('hints')),
    };

    return activity;
  }

  private parseVocabActivity(
    rows: any[],
    headerMap: Map<string, number>,
  ): ImportedActivity | null {
    if (rows.length === 0) return null;

    const firstRow = rows[0];
    const getValue = firstRow.getValue;
    const type = getValue('type');
    const title = getValue('title');

    if (!type || !title) {
      throw new Error('Both type and title are required');
    }

    // Build items array from all rows
    const items = rows
      .map((rowData) => {
        const getVal = rowData.getValue;
        const word = getVal('word');
        const definition = getVal('definition');

        if (!word || word.length === 0) {
          return null;
        }

        return {
          word,
          definition: definition || undefined,
          example: getVal('example') || undefined,
        };
      })
      .filter((item) => item !== null);

    const activity: ImportedActivity = {
      type,
      title,
      instructions: getValue('instructions') || undefined,
      content: {
        items,
      },
      points: parseInt(getValue('points')) || 10,
      timeLimit: parseInt(getValue('timeLimit')) || undefined,
      maxAttempts: parseInt(getValue('maxAttempts')) || undefined,
      passingScore: parseInt(getValue('passingScore')) || undefined,
      difficulty: this.parseDifficulty(getValue('difficulty')),
      hints: this.parseHints(getValue('hints')),
    };

    return activity;
  }

  private parseFlashcardActivity(
    rows: any[],
    headerMap: Map<string, number>,
  ): ImportedActivity | null {
    if (rows.length === 0) return null;

    const firstRow = rows[0];
    const getValue = firstRow.getValue;
    const type = getValue('type');
    const title = getValue('title');

    if (!type || !title) {
      throw new Error('Both type and title are required');
    }

    // Build cards array from all rows
    const cards = rows
      .map((rowData) => {
        const getVal = rowData.getValue;
        const word = getVal('word');
        const definition = getVal('definition');

        if (!word || word.length === 0) {
          return null;
        }

        return {
          front: word,
          back: definition || '',
        };
      })
      .filter((card) => card !== null);

    const activity: ImportedActivity = {
      type,
      title,
      instructions: getValue('instructions') || undefined,
      content: {
        cards,
      },
      points: parseInt(getValue('points')) || 10,
      timeLimit: parseInt(getValue('timeLimit')) || undefined,
      maxAttempts: parseInt(getValue('maxAttempts')) || undefined,
      passingScore: parseInt(getValue('passingScore')) || undefined,
      difficulty: this.parseDifficulty(getValue('difficulty')),
      hints: this.parseHints(getValue('hints')),
    };

    return activity;
  }
}
