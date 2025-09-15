// Centralized types for podcast activities to avoid enum conflicts

export enum ListeningActivityType {
  FILL_BLANK = 'fill_blank',
}

export interface FillBlankQuestion {
  id: string;
  sentence: string;
  correctAnswers: string[];
}

export interface FillBlankContent {
  type: 'fill_blank';
  totalQuestions: number;
  questions: FillBlankQuestion[];
}

export interface AttemptResult {
  correctCount: number;
  totalQuestions: number;
  scorePercent: number;
}

export interface UserAnswers {
  [questionId: string]: string;
}
