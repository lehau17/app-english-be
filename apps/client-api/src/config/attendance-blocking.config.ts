/**
 * Attendance Blocking Configuration
 * Default threshold for absence percentage before blocking
 */
export const ATTENDANCE_BLOCKING_CONFIG = {
  /**
   * Default absence percentage threshold (0.30 = 30%)
   * Blocks when (total_absences / total_sessions) >= this value
   * Can be overridden per classroom via Classroom.settings.attendanceBlocking.absencePercentageThreshold
   */
  DEFAULT_ABSENCE_PERCENTAGE_THRESHOLD: parseFloat(
    process.env.ATTENDANCE_BLOCKING_PERCENTAGE_THRESHOLD || '0.30',
  ),

  /**
   * Minimum threshold (safety check) - 10%
   */
  MIN_THRESHOLD: 0.1,

  /**
   * Maximum threshold (safety check) - 50%
   */
  MAX_THRESHOLD: 0.5,

  /**
   * Feature flag to enable/disable blocking globally
   */
  ENABLED: process.env.ATTENDANCE_BLOCKING_ENABLED !== 'false',
} as const;

/**
 * Get blocking threshold for a classroom
 * Returns percentage threshold (e.g., 0.30 for 30%)
 * Checks classroom settings first, then falls back to default
 */
export function getBlockingThreshold(classroomSettings?: any): number {
  if (!ATTENDANCE_BLOCKING_CONFIG.ENABLED) {
    return 1.0; // 100% - effectively disabled
  }

  const threshold =
    classroomSettings?.attendanceBlocking?.absencePercentageThreshold ??
    ATTENDANCE_BLOCKING_CONFIG.DEFAULT_ABSENCE_PERCENTAGE_THRESHOLD;

  // Validate threshold
  if (threshold < ATTENDANCE_BLOCKING_CONFIG.MIN_THRESHOLD) {
    return ATTENDANCE_BLOCKING_CONFIG.MIN_THRESHOLD;
  }
  if (threshold > ATTENDANCE_BLOCKING_CONFIG.MAX_THRESHOLD) {
    return ATTENDANCE_BLOCKING_CONFIG.MAX_THRESHOLD;
  }

  return threshold;
}
