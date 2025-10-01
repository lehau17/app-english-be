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
   * Generate Excel template for assignment import
   */
  generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    // Assignment Info Sheet
    const assignmentInfoData = [
      ['Field', 'Value', 'Description', 'Required'],
      ['title', 'Sample Assignment', 'Assignment title', 'Yes'],
      [
        'description',
        'This is a sample assignment',
        'Assignment description',
        'No',
      ],
      [
        'instructions',
        'Please complete all activities',
        'General instructions',
        'No',
      ],
      ['dueDate', '2024-12-31T17:00:00Z', 'Due date (ISO format)', 'No'],
      ['totalPoints', '100', 'Total points possible', 'No'],
      ['timeLimit', '60', 'Time limit in minutes', 'No'],
      ['maxAttempts', '3', 'Maximum attempts allowed', 'No'],
      ['isPublished', 'false', 'Publish immediately (true/false)', 'No'],
      [
        'assignedTo',
        'student1,student2',
        'Student IDs (comma-separated)',
        'No',
      ],
    ];

    const assignmentInfoWs = XLSX.utils.aoa_to_sheet(assignmentInfoData);
    XLSX.utils.book_append_sheet(wb, assignmentInfoWs, 'Assignment Info');

    // Activities Sheet
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
        'prompt',
        'points',
        'timeLimit',
        'maxAttempts',
        'passingScore',
        'difficulty',
        'hints',
      ],
      [
        'quiz',
        'Sample Quiz Question',
        'Choose the correct answer',
        'What is the capital of France?',
        'London',
        'Berlin',
        'Paris',
        'Madrid',
        '2',
        '',
        '',
        '10',
        '5',
        '1',
        '70',
        'INTERMEDIATE',
        'Think about famous landmarks',
      ],
      [
        'listening',
        'Audio Comprehension',
        'Listen and answer',
        'What did the speaker say?',
        'Hello',
        'Goodbye',
        'Thank you',
        'Welcome',
        '0',
        'https://example.com/audio.mp3',
        '',
        '15',
        '10',
        '2',
        '80',
        'BEGINNER',
        'Focus on the tone of voice',
      ],
    ];

    const activitiesWs = XLSX.utils.aoa_to_sheet(activitiesData);
    XLSX.utils.book_append_sheet(wb, activitiesWs, 'Activities');

    // Instructions Sheet
    const instructionsData = [
      ['Assignment Import Template Instructions'],
      [''],
      ['1. Assignment Info Sheet:'],
      ['   - Fill in the assignment details in the "Value" column'],
      ['   - Only "title" is required, other fields are optional'],
      ['   - Date format: ISO 8601 (YYYY-MM-DDTHH:mm:ssZ)'],
      ['   - assignedTo: comma-separated list of student IDs'],
      [''],
      ['2. Activities Sheet:'],
      ['   - Each row represents one activity'],
      ['   - Remove the sample rows and add your own'],
      ['   - Required fields: type, title, question (for most types)'],
      [''],
      ['3. Activity Types Supported:'],
      [`   - ${ACTIVITY_TYPES.join(', ')}`],
      [''],
      ['4. Quiz/Reading/Grammar Activities:'],
      ['   - Fill: question, option1-4, correctIndex (0-3)'],
      ['   - correctIndex: 0 for option1, 1 for option2, etc.'],
      [''],
      ['5. Listening Activities:'],
      ['   - Fill: audioUrl, question, option1-4, correctIndex'],
      ['   - audioUrl: direct link to audio file'],
      ['   - Each row creates one question for the audio'],
      ['   - Multiple rows with same audioUrl will create multiple questions'],
      [''],
      ['6. Optional Fields:'],
      ['   - points: default 10'],
      ['   - timeLimit: in minutes'],
      ['   - maxAttempts: default 1'],
      ['   - passingScore: 0-100'],
      ['   - difficulty: BEGINNER, INTERMEDIATE, ADVANCED'],
      ['   - hints: separate multiple hints with semicolons'],
      [''],
      ['7. Save as .xlsx and upload through the import interface'],
    ];

    const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
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

    // Process each data row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows

      try {
        const activity = this.parseActivityRow(row, headerMap, i + 1);
        if (activity) {
          activities.push(activity);
        }
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
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
}
