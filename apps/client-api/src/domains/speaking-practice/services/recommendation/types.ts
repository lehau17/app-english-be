export interface PhonemeWeakness {
  phoneme: string;
  errorCount: number;
  correctCount: number;
  errorRate: number;
}

export interface TopicFreshness {
  category: string;
  lastPracticedAt: Date | null;
  daysSinceLastPractice: number;
  freshnessScore: number;
}

export interface TopicSuccessRate {
  category: string;
  avgScore: number;
  totalAttempts: number;
  successRateInverseFactor: number;
}

export interface TopicReviewDue {
  category: string;
  nextReviewDate: Date;
  isDue: boolean;
  srsScore: number;
}

export interface LessonRecommendation {
  lessonId: string;
  category: string;
  title: string;
  difficultyTier: number;
  score: number;
  reasoning: string[];
}
