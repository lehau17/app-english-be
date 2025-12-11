export interface MediaContext {
  source: 'course_activity' | 'assignment_activity' | 'podcast' | 'vocabulary_term';
  sourceId?: string;
  courseTitle?: string; // For course activity
  lessonTitle?: string; // For course activity
  activityTitle?: string; // For activity
  activityType?: string; // For activity
  assignmentTitle?: string; // For assignment activity
  podcastTitle?: string; // For podcast
  category?: string; // For podcast
  difficulty?: string;
  // For vocabulary term
  word?: string; // Vocabulary word (e.g., "tiger")
  definition?: string; // Vocabulary definition
  unitId?: string; // Vocabulary unit ID
}
