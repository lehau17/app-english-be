/**
 * Attendance Blocking Configuration
 * Default threshold for consecutive absences before blocking
 */
export const ATTENDANCE_BLOCKING_CONFIG = {
  /**
   * Default consecutive absences threshold
   * Can be overridden per classroom via Classroom.settings.attendanceBlocking.threshold
   */
  DEFAULT_CONSECUTIVE_ABSENCES_THRESHOLD: parseInt(
    process.env.ATTENDANCE_BLOCKING_THRESHOLD || '3',
    10,
  ),

  /**
   * Minimum threshold (safety check)
   */
  MIN_THRESHOLD: 1,

  /**
   * Maximum threshold (safety check)
   */
  MAX_THRESHOLD: 10,

  /**
   * Feature flag to enable/disable blocking globally
   */
  ENABLED: process.env.ATTENDANCE_BLOCKING_ENABLED !== 'false',
} as const;

/**
 * Get blocking threshold for a classroom
 * Checks classroom settings first, then falls back to default
 */
export function getBlockingThreshold(classroomSettings?: any): number {
  if (!ATTENDANCE_BLOCKING_CONFIG.ENABLED) {
    return 999; // Effectively disabled
  }

  const threshold =
    classroomSettings?.attendanceBlocking?.threshold ??
    ATTENDANCE_BLOCKING_CONFIG.DEFAULT_CONSECUTIVE_ABSENCES_THRESHOLD;

  // Validate threshold
  if (threshold < ATTENDANCE_BLOCKING_CONFIG.MIN_THRESHOLD) {
    return ATTENDANCE_BLOCKING_CONFIG.MIN_THRESHOLD;
  }
  if (threshold > ATTENDANCE_BLOCKING_CONFIG.MAX_THRESHOLD) {
    return ATTENDANCE_BLOCKING_CONFIG.MAX_THRESHOLD;
  }

  return threshold;
}







