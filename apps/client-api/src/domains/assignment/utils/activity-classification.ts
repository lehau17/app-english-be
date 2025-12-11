/**
 * Activity classification utilities for grading
 * Determines which activities are auto-graded, AI-graded, or require manual grading
 */

/**
 * Check if activity type is auto-gradable (deterministic scoring)
 * These activities can be scored by comparing student answers with correct answers
 */
export function isAutoGradable(type: string): boolean {
  const autoGradableTypes = [
    'quiz',
    'fill_blank',
    'matching',
    'vocab',
    'grammar',
    'dictation',
  ];
  return autoGradableTypes.includes(type.toLowerCase());
}

/**
 * Check if activity type is AI-gradable (AI provides initial score, teacher can override)
 * These activities use AI evaluation but teacher can override the score
 */
export function isAIGradable(type: string): boolean {
  const aiGradableTypes = [
    'speaking',
    'writing',
    'pronunciation',
  ];
  return aiGradableTypes.includes(type.toLowerCase());
}

/**
 * Check if activity type requires manual grading
 * These activities need teacher to evaluate manually
 */
export function requiresManualGrading(type: string): boolean {
  // LISTENING with audio-based questions typically needs manual review
  return type.toLowerCase() === 'listening';
}

/**
 * Get activity classification category
 * Returns: 'auto' | 'ai' | 'manual'
 */
export function getActivityClassification(type: string): 'auto' | 'ai' | 'manual' {
  if (isAutoGradable(type)) {
    return 'auto';
  }
  if (isAIGradable(type)) {
    return 'ai';
  }
  if (requiresManualGrading(type)) {
    return 'manual';
  }
  // Default to manual for unknown types
  return 'manual';
}




