/**
 * Speaking Practice Events for Kafka async processing
 * Used for Word-Based + LLM Personalization
 */

export const SPEAKING_PRACTICE_TOPICS = {
  AI_SPEAKING_SESSION_COMPLETED: 'ai-speaking.session.completed',
  PRACTICE_ATTEMPT_COMPLETED: 'speaking-practice.attempt.completed',
} as const;

/**
 * Event emitted when AI Speaking Free Chat session is completed
 */
export interface AiSpeakingSessionCompletedEvent {
  sessionId: string;
  userId: string;
  source: 'free_chat';
  completedAt: string;
}

/**
 * Event emitted when Speaking Practice attempt is completed
 */
export interface PracticeAttemptCompletedEvent {
  attemptId: string;
  userId: string;
  lessonId: string;
  source: 'practice';
  score: number;
  mispronounceWords: MispronounceWordPayload[];
  completedAt: string;
}

/**
 * Payload for mispronounced word data
 */
export interface MispronounceWordPayload {
  word: string;
  expectedPronunciation?: string;
  userPronunciation?: string;
  contextSentence?: string;
  errorType?: string;
  problematicPhoneme?: string;
}

/**
 * LLM Analysis result for personalized drills
 */
export interface LLMAnalysisResult {
  summary: string;
  weakPhonemes: string[];
  drillWords: Array<{
    word: string;
    priority: number;
  }>;
  practiceSentences: string[];
}
